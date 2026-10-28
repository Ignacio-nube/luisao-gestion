import { Router } from "express"
import { requirePermission } from "../auth.ts"
import { prisma } from "../db.ts"

export const dashboardRouter = Router()

function dayKey(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

dashboardRouter.get("/", requirePermission("dashboard", "view"), async (_req, res) => {
  const now = new Date()
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const start30 = new Date(startToday)
  start30.setDate(start30.getDate() - 29)
  const since = start30 < startMonth ? start30 : startMonth

  const [sales, variants] = await Promise.all([
    prisma.sale.findMany({
      where: { status: "COMPLETADA", createdAt: { gte: since } },
      include: { items: { include: { variant: { include: { product: { select: { name: true } } } } } } },
    }),
    prisma.variant.findMany({
      where: { product: { active: true } },
      include: { product: { select: { name: true } } },
    }),
  ])

  const sum = (list: typeof sales) => list.reduce((acc, s) => acc + s.total, 0)
  const todaySales = sales.filter((s) => s.createdAt >= startToday)
  const monthSales = sales.filter((s) => s.createdAt >= startMonth)

  const daily = new Map<string, { date: string; total: number; count: number }>()
  for (let i = 0; i < 30; i++) {
    const d = new Date(start30)
    d.setDate(d.getDate() + i)
    daily.set(dayKey(d), { date: dayKey(d), total: 0, count: 0 })
  }
  const top = new Map<string, { name: string; qty: number; total: number }>()
  const byPayment = new Map<string, number>()

  for (const s of sales) {
    if (s.createdAt >= start30) {
      const entry = daily.get(dayKey(s.createdAt))
      if (entry) {
        entry.total += s.total
        entry.count += 1
      }
    }
    if (s.createdAt >= startMonth) {
      byPayment.set(s.paymentMethod, (byPayment.get(s.paymentMethod) ?? 0) + s.total)
      for (const item of s.items) {
        const name = item.variant.product.name
        const t = top.get(name) ?? { name, qty: 0, total: 0 }
        t.qty += item.qty
        t.total += item.subtotal
        top.set(name, t)
      }
    }
  }

  const lowStock = variants
    .filter((v) => v.stock <= v.minStock)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 10)
    .map((v) => ({
      id: v.id,
      product: v.product.name,
      size: v.size,
      color: v.color,
      sku: v.sku,
      stock: v.stock,
      minStock: v.minStock,
    }))

  res.json({
    today: { total: sum(todaySales), count: todaySales.length },
    month: {
      total: sum(monthSales),
      count: monthSales.length,
      avgTicket: monthSales.length ? Math.round(sum(monthSales) / monthSales.length) : 0,
    },
    stockUnits: variants.reduce((acc, v) => acc + v.stock, 0),
    lowStockCount: variants.filter((v) => v.stock <= v.minStock).length,
    daily: [...daily.values()],
    topProducts: [...top.values()].sort((a, b) => b.qty - a.qty).slice(0, 5),
    byPayment: [...byPayment].map(([method, total]) => ({ method, total })),
    lowStock,
  })
})
