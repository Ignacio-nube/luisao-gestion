import { Router } from "express"
import { z } from "zod"
import { can, requirePermission } from "../auth.ts"
import { prisma } from "../db.ts"
import { HttpError, paginated, parsePagination } from "../http.ts"
import type { Module } from "../permissions.ts"

export const reportsRouter = Router()

type ColumnType = "text" | "number" | "money" | "date" | "datetime"
type Column = { key: string; label: string; type: ColumnType }
type Row = Record<string, string | number | null>
type Filters = { from?: Date; to?: Date; q: string }
type Page = { skip: number; take: number }

type Dataset = {
  title: string
  /** Además de "reportes: ver", hace falta poder ver el módulo de origen. */
  module: Module
  dated: boolean
  columns: Column[]
  load: (f: Filters, p: Page) => Promise<{ rows: Row[]; total: number; totals?: Row }>
}

const PAYMENT: Record<string, string> = {
  EFECTIVO: "Efectivo",
  DEBITO: "Débito",
  CREDITO: "Crédito",
  TRANSFERENCIA: "Transferencia",
  MERCADOPAGO: "Mercado Pago",
}
const STATUS: Record<string, string> = { COMPLETADA: "Completada", ANULADA: "Anulada" }
const MOVEMENT: Record<string, string> = {
  ENTRADA: "Entrada",
  SALIDA: "Salida",
  AJUSTE: "Ajuste",
  VENTA: "Venta",
  ANULACION: "Anulación",
}

function dateRange(f: Filters) {
  if (!f.from && !f.to) return {}
  return { createdAt: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lt: f.to } : {}) } }
}

const datasets: Record<string, Dataset> = {
  ventas: {
    title: "Ventas",
    module: "ventas",
    dated: true,
    columns: [
      { key: "id", label: "N°", type: "number" },
      { key: "fecha", label: "Fecha", type: "datetime" },
      { key: "vendedor", label: "Vendedor", type: "text" },
      { key: "pago", label: "Medio de pago", type: "text" },
      { key: "estado", label: "Estado", type: "text" },
      { key: "prendas", label: "Prendas", type: "number" },
      { key: "subtotal", label: "Subtotal", type: "money" },
      { key: "descuento", label: "Descuento", type: "money" },
      { key: "total", label: "Total", type: "money" },
    ],
    async load(f, p) {
      const where = dateRange(f)
      const [sales, total, sum] = await Promise.all([
        prisma.sale.findMany({
          where,
          include: { user: { select: { name: true } } },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          ...p,
        }),
        prisma.sale.count({ where }),
        prisma.sale.aggregate({
          where: { ...where, status: "COMPLETADA" },
          _sum: { subtotal: true, discount: true, total: true },
        }),
      ])
      // Prendas por venta en una sola consulta agrupada (incluir los ítems de miles de ventas es lento).
      // Con pocas ventas se filtra por id; al exportar todo, por el mismo rango (evita listas IN enormes).
      const ids = sales.map((s) => s.id)
      const qty = await prisma.saleItem.groupBy({
        by: ["saleId"],
        where: ids.length <= 500 ? { saleId: { in: ids } } : { sale: where },
        _sum: { qty: true },
      })
      const qtyBySale = new Map(qty.map((q) => [q.saleId, q._sum.qty ?? 0]))
      return {
        total,
        rows: sales.map((s) => ({
          id: s.id,
          fecha: s.createdAt.toISOString(),
          vendedor: s.user.name,
          pago: PAYMENT[s.paymentMethod] ?? s.paymentMethod,
          estado: STATUS[s.status] ?? s.status,
          prendas: qtyBySale.get(s.id) ?? 0,
          subtotal: s.subtotal,
          descuento: s.discount,
          total: s.total,
        })),
        // Las anuladas no suman.
        totals: {
          subtotal: sum._sum.subtotal ?? 0,
          descuento: sum._sum.discount ?? 0,
          total: sum._sum.total ?? 0,
        },
      }
    },
  },

  "ventas-detalle": {
    title: "Ventas por producto",
    module: "ventas",
    dated: true,
    columns: [
      { key: "venta", label: "Venta", type: "number" },
      { key: "fecha", label: "Fecha", type: "datetime" },
      { key: "producto", label: "Producto", type: "text" },
      { key: "sku", label: "SKU", type: "text" },
      { key: "talle", label: "Talle", type: "text" },
      { key: "color", label: "Color", type: "text" },
      { key: "cantidad", label: "Cant.", type: "number" },
      { key: "precio", label: "Precio unit.", type: "money" },
      { key: "subtotal", label: "Subtotal", type: "money" },
      { key: "vendedor", label: "Vendedor", type: "text" },
      { key: "estado", label: "Estado", type: "text" },
    ],
    async load(f, p) {
      const where = {
        sale: dateRange(f),
        ...(f.q ? { variant: { product: { name: { contains: f.q } } } } : {}),
      }
      const [items, total, sum] = await Promise.all([
        prisma.saleItem.findMany({
          where,
          include: {
            sale: { select: { createdAt: true, status: true, user: { select: { name: true } } } },
            variant: { select: { sku: true, size: true, color: true, product: { select: { name: true } } } },
          },
          orderBy: [{ sale: { createdAt: "desc" } }, { id: "desc" }],
          ...p,
        }),
        prisma.saleItem.count({ where }),
        prisma.saleItem.aggregate({
          where: { ...where, sale: { ...where.sale, status: "COMPLETADA" } },
          _sum: { qty: true, subtotal: true },
        }),
      ])
      return {
        total,
        rows: items.map((i) => ({
          venta: i.saleId,
          fecha: i.sale.createdAt.toISOString(),
          producto: i.variant.product.name,
          sku: i.variant.sku,
          talle: i.variant.size,
          color: i.variant.color,
          cantidad: i.qty,
          precio: i.unitPrice,
          subtotal: i.subtotal,
          vendedor: i.sale.user.name,
          estado: STATUS[i.sale.status] ?? i.sale.status,
        })),
        totals: { cantidad: sum._sum.qty ?? 0, subtotal: sum._sum.subtotal ?? 0 },
      }
    },
  },

  productos: {
    title: "Productos",
    module: "productos",
    dated: false,
    columns: [
      { key: "sku", label: "SKU", type: "text" },
      { key: "nombre", label: "Producto", type: "text" },
      { key: "categoria", label: "Categoría", type: "text" },
      { key: "precio", label: "Precio", type: "money" },
      { key: "costo", label: "Costo", type: "money" },
      { key: "margen", label: "Margen %", type: "number" },
      { key: "variantes", label: "Variantes", type: "number" },
      { key: "stock", label: "Stock", type: "number" },
      { key: "estado", label: "Estado", type: "text" },
    ],
    async load(f, p) {
      const where = f.q ? { OR: [{ name: { contains: f.q } }, { sku: { contains: f.q.toUpperCase() } }] } : {}
      const [products, total, units] = await Promise.all([
        prisma.product.findMany({
          where,
          include: { category: true, variants: { select: { stock: true } } },
          orderBy: { name: "asc" },
          ...p,
        }),
        prisma.product.count({ where }),
        prisma.variant.aggregate({ where: { product: where }, _sum: { stock: true } }),
      ])
      return {
        total,
        rows: products.map((pr) => ({
          sku: pr.sku,
          nombre: pr.name,
          categoria: pr.category?.name ?? "",
          precio: pr.price,
          costo: pr.cost,
          margen: pr.price ? Math.round(((pr.price - pr.cost) / pr.price) * 100) : 0,
          variantes: pr.variants.length,
          stock: pr.variants.reduce((a, v) => a + v.stock, 0),
          estado: pr.active ? "Activo" : "Inactivo",
        })),
        totals: { stock: units._sum.stock ?? 0 },
      }
    },
  },

  stock: {
    title: "Stock",
    module: "stock",
    dated: false,
    columns: [
      { key: "sku", label: "SKU", type: "text" },
      { key: "producto", label: "Producto", type: "text" },
      { key: "talle", label: "Talle", type: "text" },
      { key: "color", label: "Color", type: "text" },
      { key: "stock", label: "Stock", type: "number" },
      { key: "minimo", label: "Mínimo", type: "number" },
      { key: "valorCosto", label: "Valor a costo", type: "money" },
      { key: "valorVenta", label: "Valor a precio", type: "money" },
      { key: "estado", label: "Estado", type: "text" },
    ],
    async load(f, p) {
      const where = f.q
        ? { OR: [{ sku: { contains: f.q.toUpperCase() } }, { color: { contains: f.q } }, { product: { name: { contains: f.q } } }] }
        : {}
      const [variants, total, all] = await Promise.all([
        prisma.variant.findMany({
          where,
          include: { product: { select: { name: true, price: true, cost: true } } },
          orderBy: [{ product: { name: "asc" } }, { id: "asc" }],
          ...p,
        }),
        prisma.variant.count({ where }),
        // Para los totales valorizados hace falta el precio de cada variante.
        prisma.variant.findMany({ where, select: { stock: true, product: { select: { price: true, cost: true } } } }),
      ])
      return {
        total,
        rows: variants.map((v) => ({
          sku: v.sku,
          producto: v.product.name,
          talle: v.size,
          color: v.color,
          stock: v.stock,
          minimo: v.minStock,
          valorCosto: v.stock * v.product.cost,
          valorVenta: v.stock * v.product.price,
          estado: v.stock === 0 ? "Sin stock" : v.stock <= v.minStock ? "Bajo" : "OK",
        })),
        totals: {
          stock: all.reduce((a, v) => a + v.stock, 0),
          valorCosto: all.reduce((a, v) => a + v.stock * v.product.cost, 0),
          valorVenta: all.reduce((a, v) => a + v.stock * v.product.price, 0),
        },
      }
    },
  },

  movimientos: {
    title: "Movimientos de stock",
    module: "stock",
    dated: true,
    columns: [
      { key: "fecha", label: "Fecha", type: "datetime" },
      { key: "tipo", label: "Tipo", type: "text" },
      { key: "producto", label: "Producto", type: "text" },
      { key: "sku", label: "SKU", type: "text" },
      { key: "cantidad", label: "Cantidad", type: "number" },
      { key: "motivo", label: "Motivo", type: "text" },
      { key: "usuario", label: "Usuario", type: "text" },
    ],
    async load(f, p) {
      const where = {
        ...dateRange(f),
        ...(f.q ? { variant: { product: { name: { contains: f.q } } } } : {}),
      }
      const [moves, total] = await Promise.all([
        prisma.stockMovement.findMany({
          where,
          include: {
            user: { select: { name: true } },
            variant: { select: { sku: true, size: true, color: true, product: { select: { name: true } } } },
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          ...p,
        }),
        prisma.stockMovement.count({ where }),
      ])
      return {
        total,
        rows: moves.map((m) => ({
          fecha: m.createdAt.toISOString(),
          tipo: MOVEMENT[m.type] ?? m.type,
          producto: `${m.variant.product.name} ${m.variant.size}/${m.variant.color}`,
          sku: m.variant.sku,
          cantidad: m.qty,
          motivo: m.reason,
          usuario: m.user.name,
        })),
      }
    },
  },

  usuarios: {
    title: "Usuarios",
    module: "usuarios",
    dated: false,
    columns: [
      { key: "nombre", label: "Nombre", type: "text" },
      { key: "usuario", label: "Usuario", type: "text" },
      { key: "rol", label: "Rol", type: "text" },
      { key: "estado", label: "Estado", type: "text" },
      { key: "ventas", label: "Ventas", type: "number" },
      { key: "ultimoIngreso", label: "Último ingreso", type: "datetime" },
      { key: "alta", label: "Alta", type: "date" },
    ],
    async load(f, p) {
      const where = f.q ? { OR: [{ name: { contains: f.q } }, { username: { contains: f.q.toLowerCase() } }] } : {}
      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          include: { role: { select: { name: true } }, _count: { select: { sales: true } } },
          orderBy: { name: "asc" },
          ...p,
        }),
        prisma.user.count({ where }),
      ])
      return {
        total,
        rows: users.map((u) => ({
          nombre: u.name,
          usuario: u.username,
          rol: u.role.name,
          estado: u.active ? "Activo" : "Inactivo",
          ventas: u._count.sales,
          ultimoIngreso: u.lastLoginAt?.toISOString() ?? null,
          alta: u.createdAt.toISOString(),
        })),
      }
    },
  },
}

/** Tope de filas para exportar de una vez. */
const EXPORT_LIMIT = 100_000

reportsRouter.get("/", requirePermission("reportes", "view"), (req, res) => {
  res.json({
    datasets: Object.entries(datasets)
      .filter(([, d]) => can(req.user, d.module, "view"))
      .map(([key, d]) => ({ key, title: d.title, dated: d.dated })),
  })
})

reportsRouter.get("/:key", requirePermission("reportes", "view"), async (req, res) => {
  const dataset = datasets[String(req.params.key)]
  if (!dataset) throw new HttpError(404, "Reporte no encontrado")
  if (!can(req.user, dataset.module, "view")) {
    throw new HttpError(403, "No tenés permiso para ver este reporte", "FORBIDDEN")
  }

  const { from, to, q, all } = z
    .object({
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      q: z.string().trim().default(""),
      all: z.string().optional(),
    })
    .parse(req.query)

  const filters: Filters = { q }
  if (dataset.dated && from) filters.from = new Date(`${from}T00:00:00`)
  if (dataset.dated && to) {
    const end = new Date(`${to}T00:00:00`)
    end.setDate(end.getDate() + 1)
    filters.to = end
  }

  const pg = all ? { page: 1, pageSize: EXPORT_LIMIT, skip: 0, take: EXPORT_LIMIT } : parsePagination(req.query, 25)
  const { rows, total, totals } = await dataset.load(filters, { skip: pg.skip, take: pg.take })
  res.json({ title: dataset.title, columns: dataset.columns, totals: totals ?? null, ...paginated(rows, total, pg) })
})
