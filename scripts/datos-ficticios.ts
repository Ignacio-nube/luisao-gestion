/**
 * Carga datos ficticios en volumen para probar el panel: personal, ~150 productos con variantes,
 * un año de ventas (con algunas anuladas) y todos los movimientos de stock coherentes.
 *
 *   npx tsx scripts/datos-ficticios.ts            agrega datos a los existentes
 *   npx tsx scripts/datos-ficticios.ts --reset    borra productos, ventas y movimientos antes
 *   --dias=365  --ventas-por-dia=30               ajustan el volumen
 */
import "dotenv/config"
import bcrypt from "bcryptjs"
import { prisma } from "../server/db.ts"
import { skuPrefix, variantSku } from "../server/sku.ts"

const args = process.argv.slice(2)
const RESET = args.includes("--reset")
const arg = (name: string, def: number) => {
  const v = args.find((a) => a.startsWith(`--${name}=`))
  return v ? Math.max(1, Number(v.split("=")[1]) || def) : def
}
const DAYS = arg("dias", 365)
const SALES_PER_DAY = arg("ventas-por-dia", 30)
const DEMO_PASSWORD = "demo1234"

const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
const pick = <T>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)]
const chance = (p: number) => Math.random() < p
const round100 = (n: number) => Math.round(n / 100) * 100

const COLORS = ["Negro", "Verde oliva", "Coyote", "Multicam", "Gris", "Azul marino", "Arena"] as const
const SIZES = {
  calzado: ["38", "39", "40", "41", "42", "43", "44", "45"],
  pantalon: ["38", "40", "42", "44", "46", "48"],
  ropa: ["S", "M", "L", "XL", "XXL"],
  unico: ["Único"],
  guantes: ["S", "M", "L", "XL"],
}

type Template = { name: string; category: string; sizes: string[]; price: [number, number] }

const TEMPLATES: Template[] = [
  { name: "Borcego táctico", category: "Calzado", sizes: SIZES.calzado, price: [75000, 140000] },
  { name: "Zapatilla trekking", category: "Calzado", sizes: SIZES.calzado, price: [60000, 110000] },
  { name: "Bota de combate", category: "Calzado", sizes: SIZES.calzado, price: [90000, 160000] },
  { name: "Pantalón cargo", category: "Pantalones", sizes: SIZES.pantalon, price: [35000, 65000] },
  { name: "Pantalón táctico", category: "Pantalones", sizes: SIZES.pantalon, price: [40000, 75000] },
  { name: "Bermuda cargo", category: "Pantalones", sizes: SIZES.pantalon, price: [25000, 40000] },
  { name: "Remera dry-fit", category: "Remeras", sizes: SIZES.ropa, price: [12000, 22000] },
  { name: "Remera manga larga", category: "Remeras", sizes: SIZES.ropa, price: [16000, 28000] },
  { name: "Chomba operativa", category: "Remeras", sizes: SIZES.ropa, price: [20000, 32000] },
  { name: "Campera softshell", category: "Camperas", sizes: SIZES.ropa, price: [85000, 140000] },
  { name: "Parka impermeable", category: "Camperas", sizes: SIZES.ropa, price: [110000, 190000] },
  { name: "Buzo polar", category: "Buzos", sizes: SIZES.ropa, price: [38000, 60000] },
  { name: "Buzo con capucha", category: "Buzos", sizes: SIZES.ropa, price: [42000, 68000] },
  { name: "Chaleco porta placas", category: "Equipamiento", sizes: SIZES.unico, price: [65000, 130000] },
  { name: "Cinturón táctico", category: "Equipamiento", sizes: SIZES.ropa, price: [15000, 30000] },
  { name: "Mochila asalto 30 litros", category: "Mochilas", sizes: SIZES.unico, price: [55000, 90000] },
  { name: "Mochila asalto 45 litros", category: "Mochilas", sizes: SIZES.unico, price: [70000, 120000] },
  { name: "Riñonera táctica", category: "Mochilas", sizes: SIZES.unico, price: [14000, 25000] },
  { name: "Gorra táctica", category: "Accesorios", sizes: SIZES.unico, price: [9000, 18000] },
  { name: "Cuello multiuso", category: "Accesorios", sizes: SIZES.unico, price: [5000, 9000] },
  { name: "Guantes tácticos", category: "Accesorios", sizes: SIZES.guantes, price: [14000, 28000] },
  { name: "Medias térmicas", category: "Accesorios", sizes: SIZES.guantes, price: [5000, 9000] },
]
const LINES = ["Delta", "Comando", "Ranger", "Urban", "Pro", "Recon", "Alpha", "Sierra"]

const STAFF = [
  ["Sofía Ruiz", "sofia.ruiz", "Encargado"],
  ["Martín Gómez", "martin.gomez", "Encargado"],
  ["Lucía Fernández", "lucia.fernandez", "Vendedor"],
  ["Tomás Pereyra", "tomas.pereyra", "Vendedor"],
  ["Camila Sosa", "camila.sosa", "Vendedor"],
  ["Julián Benítez", "julian.benitez", "Vendedor"],
  ["Valentina Díaz", "valentina.diaz", "Vendedor"],
  ["Federico Acosta", "federico.acosta", "Vendedor"],
  ["Agustina Romero", "agustina.romero", "Vendedor"],
  ["Nicolás Herrera", "nicolas.herrera", "Vendedor"],
] as const

const PAYMENTS = [
  ["EFECTIVO", 30],
  ["DEBITO", 25],
  ["CREDITO", 20],
  ["TRANSFERENCIA", 10],
  ["MERCADOPAGO", 15],
] as const

function weightedPayment() {
  let r = Math.random() * 100
  for (const [method, w] of PAYMENTS) {
    if ((r -= w) < 0) return method
  }
  return "EFECTIVO"
}

async function chunked<T>(rows: T[], size: number, insert: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += size) await insert(rows.slice(i, i + size))
}

async function main() {
  const started = Date.now()
  const admin = await prisma.user.findUnique({ where: { username: "admin" } })
  if (!admin) throw new Error("Falta el usuario admin. Corré primero `npm run setup`.")

  if (RESET) {
    console.log("Borrando productos, ventas y movimientos…")
    await prisma.saleItem.deleteMany()
    await prisma.sale.deleteMany()
    await prisma.stockMovement.deleteMany()
    await prisma.variant.deleteMany()
    await prisma.product.deleteMany()
    await prisma.category.deleteMany()
  }

  // ---------- Personal ----------
  const roles = new Map((await prisma.role.findMany()).map((r) => [r.name, r.id]))
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10)
  const staff = [admin.id]
  for (const [name, username, role] of STAFF) {
    const roleId = roles.get(role)
    if (!roleId) continue
    const u = await prisma.user.upsert({
      where: { username },
      update: {},
      create: { name, username, roleId, passwordHash: hash, createdAt: new Date(Date.now() - DAYS * 86400000) },
    })
    staff.push(u.id)
  }

  // ---------- Productos y variantes ----------
  const takenProductSkus = new Set((await prisma.product.findMany({ select: { sku: true } })).map((p) => p.sku))
  const takenVariantSkus = new Set((await prisma.variant.findMany({ select: { sku: true } })).map((v) => v.sku))
  const usedNames = new Set((await prisma.product.findMany({ select: { name: true } })).map((p) => p.name))

  type V = { id: number; price: number; stock: number; minStock: number; popularity: number }
  const variants: V[] = []
  const created = { products: 0, variants: 0 }

  for (const t of TEMPLATES) {
    const category = await prisma.category.upsert({ where: { name: t.category }, update: {}, create: { name: t.category } })
    for (const line of [...LINES].sort(() => Math.random() - 0.5).slice(0, rand(5, 8))) {
      const name = `${t.name} ${line}`
      if (usedNames.has(name)) continue
      usedNames.add(name)

      let sku = skuPrefix(name)
      for (let n = 2; takenProductSkus.has(sku); n++) sku = `${skuPrefix(name)}-${n}`
      takenProductSkus.add(sku)

      const price = round100(rand(t.price[0], t.price[1]))
      const product = await prisma.product.create({
        data: {
          name,
          sku,
          price,
          cost: round100(price * (0.45 + Math.random() * 0.15)),
          categoryId: category.id,
          description: `${t.name} línea ${line}.`,
          active: !chance(0.03),
          createdAt: new Date(Date.now() - DAYS * 86400000),
        },
      })
      created.products++
      const popularity = 0.3 + Math.random() * 1.7
      for (const color of [...COLORS].sort(() => Math.random() - 0.5).slice(0, rand(2, 4))) {
        for (const size of t.sizes) {
          const v = await prisma.variant.create({
            data: {
              productId: product.id,
              size,
              color,
              sku: variantSku(sku, color, size, takenVariantSkus),
              minStock: t.sizes.length === 1 ? 3 : 2,
            },
          })
          takenVariantSkus.add(v.sku)
          created.variants++
          // Talles del medio venden más.
          const mid = Math.abs(t.sizes.indexOf(size) - (t.sizes.length - 1) / 2)
          variants.push({ id: v.id, price, stock: 0, minStock: v.minStock, popularity: popularity / (1 + mid * 0.4) })
        }
      }
    }
  }
  if (!variants.length) throw new Error("No se crearon productos nuevos (¿ya estaban cargados? probá con --reset).")

  // ---------- Simulación de un año ----------
  const movements: { variantId: number; type: string; qty: number; reason: string; userId: number; createdAt: Date }[] = []
  const sales: {
    id: number
    userId: number
    subtotal: number
    discount: number
    total: number
    paymentMethod: string
    status: string
    createdAt: Date
  }[] = []
  const items: { saleId: number; variantId: number; qty: number; unitPrice: number; subtotal: number }[] = []

  const start = new Date()
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - DAYS)

  for (const v of variants) {
    v.stock = rand(6, 20)
    movements.push({ variantId: v.id, type: "ENTRADA", qty: v.stock, reason: "Stock inicial", userId: admin.id, createdAt: new Date(start.getTime() + 8 * 3600000) })
  }

  // Selección ponderada por popularidad.
  const totalWeight = variants.reduce((a, v) => a + v.popularity, 0)
  function randomVariant() {
    let r = Math.random() * totalWeight
    for (const v of variants) if ((r -= v.popularity) < 0) return v
    return variants[variants.length - 1]
  }

  let nextSaleId = ((await prisma.sale.aggregate({ _max: { id: true } }))._max.id ?? 0) + 1

  for (let d = 0; d <= DAYS; d++) {
    const day = new Date(start)
    day.setDate(start.getDate() + d)
    if (day.getDay() === 0 && chance(0.7)) continue // domingos casi siempre cerrado

    // Reposición semanal de lo que quedó bajo (las últimas semanas no, así hay alertas de stock bajo).
    if (day.getDay() === 1 && d < DAYS - 21) {
      for (const v of variants) {
        if (v.stock <= v.minStock + 1 && chance(0.85)) {
          const qty = rand(8, 20)
          v.stock += qty
          movements.push({ variantId: v.id, type: "ENTRADA", qty, reason: "Reposición proveedor", userId: pick(staff.slice(0, 3)), createdAt: new Date(day.getTime() + 9 * 3600000) })
        }
      }
    }

    // Más ventas los sábados, en diciembre y en el día del padre (junio).
    const month = day.getMonth()
    let factor = day.getDay() === 6 ? 1.5 : 1
    if (month === 11) factor *= 1.8
    if (month === 5) factor *= 1.3
    if (month === 0 || month === 1) factor *= 0.75
    const count = Math.round(SALES_PER_DAY * factor * (0.6 + Math.random() * 0.8))
    const sellers = staff.slice(1).sort(() => Math.random() - 0.5).slice(0, 3)

    const times = Array.from({ length: count }, () => rand(10 * 60, 20 * 60 + 30)).sort((a, b) => a - b)
    for (const minute of times) {
      const createdAt = new Date(day.getTime() + minute * 60000 + rand(0, 59) * 1000)
      if (createdAt > new Date()) break

      const lines = new Map<V, number>()
      const n = chance(0.55) ? 1 : chance(0.7) ? 2 : rand(3, 5)
      for (let i = 0; i < n; i++) {
        const v = randomVariant()
        const already = lines.get(v) ?? 0
        if (v.stock - already <= 0) continue
        lines.set(v, already + (chance(0.15) ? 2 : 1))
      }
      for (const [v, q] of lines) if (q > v.stock) lines.set(v, v.stock)
      if (!lines.size) continue

      const id = nextSaleId++
      const subtotal = [...lines].reduce((a, [v, q]) => a + v.price * q, 0)
      const discount = chance(0.12) ? round100(subtotal * pick([0.05, 0.1, 0.15])) : 0
      const cancelled = chance(0.02)
      const userId = pick(sellers.length ? sellers : staff)
      sales.push({
        id,
        userId,
        subtotal,
        discount,
        total: subtotal - discount,
        paymentMethod: weightedPayment(),
        status: cancelled ? "ANULADA" : "COMPLETADA",
        createdAt,
      })
      for (const [v, q] of lines) {
        items.push({ saleId: id, variantId: v.id, qty: q, unitPrice: v.price, subtotal: v.price * q })
        movements.push({ variantId: v.id, type: "VENTA", qty: -q, reason: `Venta #${id}`, userId, createdAt })
        if (cancelled) {
          const later = new Date(createdAt.getTime() + rand(5, 90) * 60000)
          movements.push({ variantId: v.id, type: "ANULACION", qty: q, reason: `Anulación venta #${id}`, userId: staff[1] ?? admin.id, createdAt: later })
        } else {
          v.stock -= q
        }
      }
    }

    // Algún ajuste de inventario esporádico.
    if (chance(0.08)) {
      const v = randomVariant()
      if (v.stock > 0) {
        v.stock -= 1
        movements.push({ variantId: v.id, type: "AJUSTE", qty: -1, reason: pick(["Prenda dañada", "Diferencia de inventario", "Falla de fábrica"]), userId: admin.id, createdAt: new Date(day.getTime() + 19 * 3600000) })
      }
    }
  }

  console.log(`Guardando ${sales.length} ventas, ${items.length} ítems y ${movements.length} movimientos…`)
  await chunked(sales, 1000, (c) => prisma.sale.createMany({ data: c }))
  await chunked(items, 2000, (c) => prisma.saleItem.createMany({ data: c }))
  await chunked(movements, 2000, (c) => prisma.stockMovement.createMany({ data: c }))
  for (const v of variants) await prisma.variant.update({ where: { id: v.id }, data: { stock: v.stock } })

  // Último ingreso del personal = su última venta.
  for (const id of staff) {
    const last = await prisma.sale.findFirst({ where: { userId: id }, orderBy: { createdAt: "desc" } })
    if (last && id !== admin.id) await prisma.user.update({ where: { id }, data: { lastLoginAt: last.createdAt } })
  }

  console.log(
    [
      "",
      "Datos ficticios cargados:",
      `  ${created.products} productos / ${created.variants} variantes`,
      `  ${sales.length} ventas (${sales.filter((s) => s.status === "ANULADA").length} anuladas) en ${DAYS} días`,
      `  ${movements.length} movimientos de stock`,
      `  ${STAFF.length} cuentas del personal (contraseña: ${DEMO_PASSWORD})`,
      `Listo en ${((Date.now() - started) / 1000).toFixed(1)} s`,
    ].join("\n")
  )
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
