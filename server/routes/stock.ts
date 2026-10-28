import { Router } from "express"
import { z } from "zod"
import { requirePermission } from "../auth.ts"
import { prisma } from "../db.ts"
import { HttpError, paginated, parsePagination } from "../http.ts"

export const stockRouter = Router()

stockRouter.get("/", requirePermission("stock", "view"), async (req, res) => {
  const pg = parsePagination(req.query, 25)
  const q = String(req.query.q ?? "").trim()
  const low = req.query.low === "1"

  const where = {
    ...(q
      ? {
          OR: [
            { sku: { contains: q.toUpperCase() } },
            { color: { contains: q } },
            { product: { name: { contains: q } } },
          ],
        }
      : {}),
    // Compara dos columnas de la misma fila (stock <= mínimo).
    ...(low ? { stock: { lte: prisma.variant.fields.minStock } } : {}),
  }
  const [variants, total] = await Promise.all([
    prisma.variant.findMany({
      where,
      include: { product: { select: { id: true, name: true, sku: true, active: true } } },
      orderBy: [{ product: { name: "asc" } }, { id: "asc" }],
      skip: pg.skip,
      take: pg.take,
    }),
    prisma.variant.count({ where }),
  ])
  res.json(paginated(variants, total, pg))
})

stockRouter.post("/adjust", requirePermission("stock", "edit"), async (req, res) => {
  const data = z
    .object({
      variantId: z.number().int(),
      type: z.enum(["ENTRADA", "SALIDA", "AJUSTE"]),
      qty: z.number().int().min(0),
      reason: z.string().trim().max(200).default(""),
    })
    .parse(req.body)

  const variant = await prisma.$transaction(async (tx) => {
    const v = await tx.variant.findUnique({ where: { id: data.variantId } })
    if (!v) throw new HttpError(404, "Variante no encontrada")

    let newStock: number
    let delta: number
    if (data.type === "AJUSTE") {
      newStock = data.qty
      delta = data.qty - v.stock
    } else {
      if (data.qty === 0) throw new HttpError(400, "La cantidad debe ser mayor a 0")
      delta = data.type === "ENTRADA" ? data.qty : -data.qty
      newStock = v.stock + delta
    }
    if (newStock < 0) throw new HttpError(400, `Stock insuficiente (hay ${v.stock})`)

    await tx.stockMovement.create({
      data: { variantId: v.id, type: data.type, qty: delta, reason: data.reason, userId: req.user!.id },
    })
    return tx.variant.update({ where: { id: v.id }, data: { stock: newStock } })
  })
  res.json({ variant })
})

stockRouter.get("/movements", requirePermission("stock", "view"), async (req, res) => {
  const pg = parsePagination(req.query, 25)
  const variantId = req.query.variantId ? Number(req.query.variantId) : undefined
  const where = variantId ? { variantId } : {}
  const [movements, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      include: {
        user: { select: { name: true } },
        variant: { select: { size: true, color: true, sku: true, product: { select: { name: true } } } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: pg.skip,
      take: pg.take,
    }),
    prisma.stockMovement.count({ where }),
  ])
  res.json(paginated(movements, total, pg))
})
