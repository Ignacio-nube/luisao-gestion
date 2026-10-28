import { Router } from "express"
import { z } from "zod"
import { requirePermission } from "../auth.ts"
import { prisma } from "../db.ts"
import { HttpError, paginated, parseId, parsePagination } from "../http.ts"
import { cleanSku, suggestProductSku, variantSku } from "../sku.ts"

export const productsRouter = Router()
export const categoriesRouter = Router()

const money = z.number().int("Usá montos enteros").min(0)

const variantSchema = z.object({
  id: z.number().int().optional(),
  size: z.string().trim().min(1, "Ingresá el talle").max(20),
  color: z.string().trim().min(1, "Ingresá el color").max(30),
  // Vacío = se genera automáticamente.
  sku: z.string().trim().toUpperCase().max(40).default(""),
  stock: z.number().int().min(0).default(0),
  minStock: z.number().int().min(0).default(2),
})

const productSchema = z.object({
  name: z.string().trim().min(1, "Ingresá el nombre").max(120),
  // Vacío = se genera a partir del nombre.
  sku: z.string().trim().toUpperCase().max(40).default(""),
  description: z.string().trim().max(1000).default(""),
  price: money,
  cost: money.default(0),
  active: z.boolean().default(true),
  categoryId: z.number().int().nullable().default(null),
  variants: z.array(variantSchema).min(1, "Agregá al menos una variante (talle/color)"),
})

function assertUniqueVariantSkus(variants: { sku: string }[]) {
  const skus = variants.map((v) => v.sku).filter(Boolean)
  if (new Set(skus).size !== skus.length) {
    throw new HttpError(400, "Hay variantes con el SKU repetido")
  }
}

/** Completa los SKU de variantes vacíos evitando choques con los ya usados. */
async function fillVariantSkus<T extends { id?: number; sku: string; size: string; color: string }>(
  base: string,
  variants: T[]
) {
  const ownIds = variants.flatMap((v) => (v.id ? [v.id] : []))
  const taken = new Set(
    (
      await prisma.variant.findMany({
        where: { sku: { startsWith: base }, id: { notIn: ownIds } },
        select: { sku: true },
      })
    ).map((v) => v.sku)
  )
  for (const v of variants) if (v.sku) taken.add(v.sku)
  return variants.map((v) => (v.sku ? v : { ...v, sku: variantSku(base, v.color, v.size, taken) }))
}

/** Sugerencia de SKU base para el formulario (se recalcula al escribir el nombre). */
productsRouter.get("/sku-suggestion", requirePermission("productos", "view"), async (req, res) => {
  const name = String(req.query.name ?? "").trim()
  const excludeId = req.query.excludeId ? Number(req.query.excludeId) : undefined
  res.json({ sku: name ? await suggestProductSku(name, excludeId) : "" })
})

productsRouter.get("/", requirePermission("productos", "view"), async (req, res) => {
  const pg = parsePagination(req.query)
  const q = String(req.query.q ?? "").trim()
  const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined
  const where = {
    ...(q ? { OR: [{ name: { contains: q } }, { sku: { contains: q.toUpperCase() } }] } : {}),
    ...(categoryId ? { categoryId } : {}),
  }
  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { category: true, variants: { orderBy: { id: "asc" } } },
      orderBy: { name: "asc" },
      skip: pg.skip,
      take: pg.take,
    }),
    prisma.product.count({ where }),
  ])
  res.json(paginated(products, total, pg))
})

productsRouter.get("/:id", requirePermission("productos", "view"), async (req, res) => {
  const product = await prisma.product.findUnique({
    where: { id: parseId(req.params.id) },
    include: { category: true, variants: { orderBy: { id: "asc" } } },
  })
  if (!product) throw new HttpError(404, "Producto no encontrado")
  res.json({ product })
})

productsRouter.post("/", requirePermission("productos", "create"), async (req, res) => {
  const parsed = productSchema.parse(req.body)
  assertUniqueVariantSkus(parsed.variants)
  const userId = req.user!.id
  const sku = parsed.sku ? cleanSku(parsed.sku) : await suggestProductSku(parsed.name)
  const data = { ...parsed, sku, variants: undefined }
  const variants = await fillVariantSkus(sku, parsed.variants)

  const product = await prisma.$transaction(async (tx) => {
    const product = await tx.product.create({ data })
    for (const { id: _ignored, ...v } of variants) {
      const variant = await tx.variant.create({ data: { ...v, productId: product.id } })
      if (v.stock > 0) {
        await tx.stockMovement.create({
          data: { variantId: variant.id, type: "ENTRADA", qty: v.stock, reason: "Stock inicial", userId },
        })
      }
    }
    return product
  })
  res.status(201).json({ product })
})

/**
 * Edita el producto y sus variantes. El stock de variantes existentes no se toca
 * acá (se maneja desde Stock para que quede registrado el movimiento).
 */
productsRouter.patch("/:id", requirePermission("productos", "edit"), async (req, res) => {
  const id = parseId(req.params.id)
  const parsed = productSchema.parse(req.body)
  assertUniqueVariantSkus(parsed.variants)
  const userId = req.user!.id
  const sku = parsed.sku ? cleanSku(parsed.sku) : await suggestProductSku(parsed.name, id)
  const data = { ...parsed, sku, variants: undefined }

  const existing = await prisma.product.findUnique({
    where: { id },
    include: { variants: { include: { _count: { select: { saleItems: true } } } } },
  })
  if (!existing) throw new HttpError(404, "Producto no encontrado")

  const variants = await fillVariantSkus(sku, parsed.variants)
  const keepIds = new Set(variants.filter((v) => v.id).map((v) => v.id))
  const removed = existing.variants.filter((v) => !keepIds.has(v.id))
  const blocked = removed.find((v) => v._count.saleItems > 0)
  if (blocked) {
    throw new HttpError(409, `La variante ${blocked.size} / ${blocked.color} tiene ventas y no se puede eliminar`)
  }

  await prisma.$transaction(async (tx) => {
    await tx.product.update({ where: { id }, data })
    if (removed.length) {
      await tx.variant.deleteMany({ where: { id: { in: removed.map((v) => v.id) } } })
    }
    for (const { id: variantId, stock, ...v } of variants) {
      if (variantId && existing.variants.some((ev) => ev.id === variantId)) {
        await tx.variant.update({ where: { id: variantId }, data: v })
      } else {
        const created = await tx.variant.create({ data: { ...v, stock, productId: id } })
        if (stock > 0) {
          await tx.stockMovement.create({
            data: { variantId: created.id, type: "ENTRADA", qty: stock, reason: "Stock inicial", userId },
          })
        }
      }
    }
  })
  res.json({ ok: true })
})

productsRouter.delete("/:id", requirePermission("productos", "delete"), async (req, res) => {
  const id = parseId(req.params.id)
  const sold = await prisma.saleItem.count({ where: { variant: { productId: id } } })
  if (sold > 0) {
    throw new HttpError(409, "El producto tiene ventas registradas. Desactivalo en lugar de eliminarlo.")
  }
  await prisma.product.delete({ where: { id } })
  res.json({ ok: true })
})

categoriesRouter.get("/", async (_req, res) => {
  const categories = await prisma.category.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { name: "asc" },
  })
  res.json({ categories })
})

categoriesRouter.post("/", requirePermission("productos", "create"), async (req, res) => {
  const { name } = z.object({ name: z.string().trim().min(1).max(60) }).parse(req.body)
  const category = await prisma.category.create({ data: { name } })
  res.status(201).json({ category })
})

categoriesRouter.delete("/:id", requirePermission("productos", "delete"), async (req, res) => {
  await prisma.category.delete({ where: { id: parseId(req.params.id) } })
  res.json({ ok: true })
})
