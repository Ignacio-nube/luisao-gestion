import "dotenv/config"
import bcrypt from "bcryptjs"
import { prisma } from "../server/db.ts"
import { MODULES, type Module } from "../server/permissions.ts"

type Perm = { view?: boolean; create?: boolean; edit?: boolean; delete?: boolean }

function rows(perms: Partial<Record<Module, Perm>>) {
  return MODULES.map((module) => {
    const p = perms[module] ?? {}
    return {
      module,
      canView: !!p.view,
      canCreate: !!p.create,
      canEdit: !!p.edit,
      canDelete: !!p.delete,
    }
  })
}

const all = { view: true, create: true, edit: true, delete: true }

async function main() {
  const admin = await prisma.role.upsert({
    where: { name: "Admin" },
    update: {},
    create: {
      name: "Admin",
      description: "Acceso total. Gestiona cuentas, roles y contraseñas.",
      isSystem: true,
      permissions: { create: rows(Object.fromEntries(MODULES.map((m) => [m, all]))) },
    },
  })

  await prisma.role.upsert({
    where: { name: "Encargado" },
    update: {},
    create: {
      name: "Encargado",
      description: "Gestiona productos, stock y ventas. Ve el dashboard.",
      permissions: {
        create: rows({
          dashboard: { view: true },
          productos: all,
          stock: { view: true, create: true, edit: true },
          ventas: all,
          reportes: { view: true },
          usuarios: { view: true },
        }),
      },
    },
  })

  await prisma.role.upsert({
    where: { name: "Vendedor" },
    update: {},
    create: {
      name: "Vendedor",
      description: "Cobra ventas en caja y consulta productos y stock.",
      permissions: {
        create: rows({
          productos: { view: true },
          stock: { view: true },
          ventas: { view: true, create: true },
        }),
      },
    },
  })

  const existingAdmin = await prisma.user.findUnique({ where: { username: "admin" } })
  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        name: "Administrador",
        username: "admin",
        passwordHash: await bcrypt.hash("admin123", 10),
        mustChangePassword: true,
        roleId: admin.id,
      },
    })
  }

  if ((await prisma.product.count()) === 0) {
    const cat = async (name: string) =>
      (await prisma.category.upsert({ where: { name }, update: {}, create: { name } })).id

    const calzado = await cat("Calzado")
    const pantalones = await cat("Pantalones")
    const remeras = await cat("Remeras")
    const equipo = await cat("Equipamiento")
    const abrigos = await cat("Camperas")

    const products = [
      {
        name: "Borcego táctico 8\"",
        sku: "BOR-8",
        price: 89000,
        cost: 52000,
        categoryId: calzado,
        colors: ["Negro", "Coyote"],
        sizes: ["40", "41", "42", "43", "44"],
      },
      {
        name: "Pantalón cargo ripstop",
        sku: "PCR",
        price: 42000,
        cost: 21000,
        categoryId: pantalones,
        colors: ["Negro", "Verde oliva", "Multicam"],
        sizes: ["38", "40", "42", "44", "46"],
      },
      {
        name: "Remera dry-fit",
        sku: "RDF",
        price: 15000,
        cost: 6500,
        categoryId: remeras,
        colors: ["Negro", "Verde oliva", "Arena"],
        sizes: ["S", "M", "L", "XL"],
      },
      {
        name: "Chaleco porta placas",
        sku: "CPP",
        price: 75000,
        cost: 41000,
        categoryId: equipo,
        colors: ["Negro", "Coyote"],
        sizes: ["Único"],
      },
      {
        name: "Campera softshell",
        sku: "CSS",
        price: 98000,
        cost: 55000,
        categoryId: abrigos,
        colors: ["Negro", "Verde oliva"],
        sizes: ["S", "M", "L", "XL", "XXL"],
      },
    ]

    const adminUser = await prisma.user.findUniqueOrThrow({ where: { username: "admin" } })
    for (const { colors, sizes, ...p } of products) {
      const product = await prisma.product.create({ data: p })
      for (const color of colors) {
        for (const size of sizes) {
          const stock = Math.floor(Math.random() * 9)
          const variant = await prisma.variant.create({
            data: {
              productId: product.id,
              color,
              size,
              sku: `${p.sku}-${color.slice(0, 3).toUpperCase()}-${size.toUpperCase()}`
                .normalize("NFD")
                .replace(/[̀-ͯ]/g, ""),
              stock,
              minStock: 2,
            },
          })
          if (stock > 0) {
            await prisma.stockMovement.create({
              data: { variantId: variant.id, type: "ENTRADA", qty: stock, reason: "Stock inicial", userId: adminUser.id },
            })
          }
        }
      }
    }
  }

  console.log("Seed listo. Usuario: admin / Contraseña: admin123 (se pide cambiarla al ingresar)")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
