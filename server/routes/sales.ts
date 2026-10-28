import { Router } from "express"
import { z } from "zod"
import { requirePermission } from "../auth.ts"
import { prisma } from "../db.ts"
import { HttpError, paginated, parseId, parsePagination } from "../http.ts"

export const PAYMENT_METHODS = ["EFECTIVO", "DEBITO", "CREDITO", "TRANSFERENCIA", "MERCADOPAGO"] as const

export const salesRouter = Router()

salesRouter.get("/", requirePermission("ventas", "view"), async (req, res) => {
  const { from, to, paymentMethod, status } = z
    .object({
      from: z.string().optional(),
      to: z.string().optional(),
      page: z.string().optional(),
      pageSize: z.string().optional(),
      paymentMethod: z.enum(PAYMENT_METHODS).optional(),
      status: z.enum(["COMPLETADA", "ANULADA"]).optional(),
    })
    .parse(req.query)

  const createdAt: { gte?: Date; lt?: Date } = {}
  if (from) createdAt.gte = new Date(`${from}T00:00:00`)
  if (to) {
    const end = new Date(`${to}T00:00:00`)
    end.setDate(end.getDate() + 1)
    createdAt.lt = end
  }

  const pg = parsePagination(req.query)
  const where = {
    ...(from || to ? { createdAt } : {}),
    ...(paymentMethod ? { paymentMethod } : {}),
    ...(status ? { status } : {}),
  }
  const [sales, total, completed] = await Promise.all([
    prisma.sale.findMany({
      where,
      include: { user: { select: { name: true } }, _count: { select: { items: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: pg.skip,
      take: pg.take,
    }),
    prisma.sale.count({ where }),
    // Totales de todo el período filtrado, no solo de la página.
    prisma.sale.aggregate({
      where: { ...where, status: "COMPLETADA" },
      _sum: { total: true },
      _count: true,
    }),
  ])
  res.json({
    ...paginated(sales, total, pg),
    summary: { count: completed._count, total: completed._sum.total ?? 0 },
  })
})

/** Búsqueda de variantes para la caja. */
salesRouter.get("/search", requirePermission("ventas", "create"), async (req, res) => {
  const pg = parsePagination(req.query, 10)
  const q = String(req.query.q ?? "").trim()
  const where = {
    product: { active: true },
    ...(q
      ? {
          OR: [
            { sku: { contains: q.toUpperCase() } },
            { color: { contains: q } },
            { product: { name: { contains: q } } },
            { product: { sku: { contains: q.toUpperCase() } } },
          ],
        }
      : {}),
  }
  const [variants, total] = await Promise.all([
    prisma.variant.findMany({
      where,
      include: { product: { select: { name: true, price: true } } },
      orderBy: [{ product: { name: "asc" } }, { id: "asc" }],
      skip: pg.skip,
      take: pg.take,
    }),
    prisma.variant.count({ where }),
  ])
  res.json(paginated(variants, total, pg))
})

salesRouter.get("/:id", requirePermission("ventas", "view"), async (req, res) => {
  const sale = await prisma.sale.findUnique({
    where: { id: parseId(req.params.id) },
    include: {
      user: { select: { name: true } },
      items: { include: { variant: { include: { product: { select: { name: true } } } } } },
    },
  })
  if (!sale) throw new HttpError(404, "Venta no encontrada")
  res.json({ sale })
})

salesRouter.post("/", requirePermission("ventas", "create"), async (req, res) => {
  const data = z
    .object({
      items: z
        .array(z.object({ variantId: z.number().int(), qty: z.number().int().min(1) }))
        .min(1, "El carrito está vacío"),
      discount: z.number().int().min(0).default(0),
      paymentMethod: z.enum(PAYMENT_METHODS),
    })
    .parse(req.body)

  const userId = req.user!.id

  const sale = await prisma.$transaction(async (tx) => {
    // Agrupa por variante por si vino repetida.
    const qtyByVariant = new Map<number, number>()
    for (const item of data.items) {
      qtyByVariant.set(item.variantId, (qtyByVariant.get(item.variantId) ?? 0) + item.qty)
    }

    const variants = await tx.variant.findMany({
      where: { id: { in: [...qtyByVariant.keys()] } },
      include: { product: true },
    })

    const lines = [...qtyByVariant].map(([variantId, qty]) => {
      const v = variants.find((x) => x.id === variantId)
      if (!v) throw new HttpError(400, "Una de las variantes ya no existe")
      if (!v.product.active) throw new HttpError(400, `${v.product.name} está desactivado`)
      if (v.stock < qty) {
        throw new HttpError(409, `Stock insuficiente de ${v.product.name} ${v.size}/${v.color} (hay ${v.stock})`)
      }
      return { variantId, qty, unitPrice: v.product.price, subtotal: v.product.price * qty }
    })

    const subtotal = lines.reduce((acc, l) => acc + l.subtotal, 0)
    if (data.discount > subtotal) throw new HttpError(400, "El descuento no puede superar el subtotal")

    const sale = await tx.sale.create({
      data: {
        userId,
        subtotal,
        discount: data.discount,
        total: subtotal - data.discount,
        paymentMethod: data.paymentMethod,
        items: { create: lines },
      },
    })

    for (const l of lines) {
      // updateMany con condición de stock evita sobreventa si dos cajas venden a la vez.
      const updated = await tx.variant.updateMany({
        where: { id: l.variantId, stock: { gte: l.qty } },
        data: { stock: { decrement: l.qty } },
      })
      if (updated.count === 0) throw new HttpError(409, "El stock cambió mientras se cobraba. Reintentá.")
      await tx.stockMovement.create({
        data: { variantId: l.variantId, type: "VENTA", qty: -l.qty, reason: `Venta #${sale.id}`, userId },
      })
    }
    return sale
  })

  res.status(201).json({ sale })
})

salesRouter.post("/:id/cancel", requirePermission("ventas", "delete"), async (req, res) => {
  const id = parseId(req.params.id)
  const userId = req.user!.id

  await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findUnique({ where: { id }, include: { items: true } })
    if (!sale) throw new HttpError(404, "Venta no encontrada")
    if (sale.status === "ANULADA") throw new HttpError(409, "La venta ya está anulada")

    await tx.sale.update({ where: { id }, data: { status: "ANULADA" } })
    for (const item of sale.items) {
      await tx.variant.update({ where: { id: item.variantId }, data: { stock: { increment: item.qty } } })
      await tx.stockMovement.create({
        data: { variantId: item.variantId, type: "ANULACION", qty: item.qty, reason: `Anulación venta #${id}`, userId },
      })
    }
  })
  res.json({ ok: true })
})
