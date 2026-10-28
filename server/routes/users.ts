import bcrypt from "bcryptjs"
import { Router } from "express"
import { z } from "zod"
import { requirePermission } from "../auth.ts"
import { prisma } from "../db.ts"
import { HttpError, paginated, parseId, parsePagination } from "../http.ts"
import { ADMIN_ROLE } from "../permissions.ts"
import { passwordSchema } from "./auth.ts"

export const usersRouter = Router()

const userSelect = {
  id: true,
  name: true,
  username: true,
  active: true,
  mustChangePassword: true,
  createdAt: true,
  lastLoginAt: true,
  roleId: true,
  role: { select: { id: true, name: true } },
} as const

const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "El usuario debe tener al menos 3 caracteres")
  .max(30)
  .regex(/^[a-z0-9._-]+$/, "Solo letras, números, punto, guion y guion bajo")

async function isAdminRole(roleId: number) {
  const role = await prisma.role.findUnique({ where: { id: roleId } })
  if (!role) throw new HttpError(400, "El rol no existe")
  return role.name === ADMIN_ROLE
}

/** Evita que el sistema se quede sin ningún administrador activo. */
async function assertNotLastAdmin(userId: number) {
  const others = await prisma.user.count({
    where: { id: { not: userId }, active: true, role: { name: ADMIN_ROLE } },
  })
  if (others === 0) {
    throw new HttpError(409, "No se puede: es el único administrador activo")
  }
}

usersRouter.get("/", requirePermission("usuarios", "view"), async (req, res) => {
  const pg = parsePagination(req.query)
  const q = String(req.query.q ?? "").trim()
  const where = q ? { OR: [{ name: { contains: q } }, { username: { contains: q.toLowerCase() } }] } : {}
  const [users, total] = await Promise.all([
    prisma.user.findMany({ where, select: userSelect, orderBy: { name: "asc" }, skip: pg.skip, take: pg.take }),
    prisma.user.count({ where }),
  ])
  res.json(paginated(users, total, pg))
})

usersRouter.post("/", requirePermission("usuarios", "create"), async (req, res) => {
  const data = z
    .object({
      name: z.string().trim().min(1, "Ingresá el nombre").max(80),
      username: usernameSchema,
      password: passwordSchema,
      roleId: z.number().int(),
      mustChangePassword: z.boolean().default(true),
    })
    .parse(req.body)

  if ((await isAdminRole(data.roleId)) && !req.user!.isAdmin) {
    throw new HttpError(403, "Solo un administrador puede crear otros administradores")
  }

  const user = await prisma.user.create({
    data: {
      name: data.name,
      username: data.username,
      roleId: data.roleId,
      mustChangePassword: data.mustChangePassword,
      passwordHash: await bcrypt.hash(data.password, 10),
    },
    select: userSelect,
  })
  res.status(201).json({ user })
})

usersRouter.patch("/:id", requirePermission("usuarios", "edit"), async (req, res) => {
  const id = parseId(req.params.id)
  const data = z
    .object({
      name: z.string().trim().min(1).max(80).optional(),
      username: usernameSchema.optional(),
      roleId: z.number().int().optional(),
      active: z.boolean().optional(),
    })
    .parse(req.body)

  const target = await prisma.user.findUnique({ where: { id }, include: { role: true } })
  if (!target) throw new HttpError(404, "Usuario no encontrado")
  const targetIsAdmin = target.role.name === ADMIN_ROLE

  if (targetIsAdmin && !req.user!.isAdmin) {
    throw new HttpError(403, "Solo un administrador puede modificar a otro administrador")
  }
  if (data.roleId !== undefined && data.roleId !== target.roleId) {
    const toAdmin = await isAdminRole(data.roleId)
    if (toAdmin && !req.user!.isAdmin) {
      throw new HttpError(403, "Solo un administrador puede asignar el rol Admin")
    }
    if (targetIsAdmin && !toAdmin) {
      if (id === req.user!.id) throw new HttpError(409, "No podés quitarte a vos mismo el rol Admin")
      await assertNotLastAdmin(id)
    }
  }
  if (data.active === false) {
    if (id === req.user!.id) throw new HttpError(409, "No podés desactivar tu propia cuenta")
    if (targetIsAdmin) await assertNotLastAdmin(id)
  }

  const deactivating = data.active === false && target.active
  const user = await prisma.user.update({
    where: { id },
    data: {
      ...data,
      // Desactivar o cambiar de rol corta las sesiones abiertas de ese usuario.
      ...(deactivating || (data.roleId && data.roleId !== target.roleId)
        ? { sessionVersion: { increment: 1 } }
        : {}),
    },
    select: userSelect,
  })
  res.json({ user })
})

/** El administrador cambia la contraseña de cualquier cuenta. */
usersRouter.post("/:id/password", requirePermission("usuarios", "edit"), async (req, res) => {
  const id = parseId(req.params.id)
  const { password, mustChangePassword } = z
    .object({ password: passwordSchema, mustChangePassword: z.boolean().default(false) })
    .parse(req.body)

  const target = await prisma.user.findUnique({ where: { id }, include: { role: true } })
  if (!target) throw new HttpError(404, "Usuario no encontrado")
  if (target.role.name === ADMIN_ROLE && !req.user!.isAdmin) {
    throw new HttpError(403, "Solo un administrador puede cambiar la contraseña de otro administrador")
  }

  await prisma.user.update({
    where: { id },
    data: {
      passwordHash: await bcrypt.hash(password, 10),
      // Si el admin cambia su propia contraseña desde acá, no lo obligamos a cambiarla otra vez.
      mustChangePassword: id === req.user!.id ? false : mustChangePassword,
      sessionVersion: { increment: 1 },
    },
  })
  res.json({ ok: true, selfChanged: id === req.user!.id })
})

usersRouter.delete("/:id", requirePermission("usuarios", "delete"), async (req, res) => {
  const id = parseId(req.params.id)
  if (id === req.user!.id) throw new HttpError(409, "No podés eliminar tu propia cuenta")

  const target = await prisma.user.findUnique({
    where: { id },
    include: { role: true, _count: { select: { sales: true, movements: true } } },
  })
  if (!target) throw new HttpError(404, "Usuario no encontrado")
  if (target.role.name === ADMIN_ROLE) {
    if (!req.user!.isAdmin) throw new HttpError(403, "Solo un administrador puede eliminar a otro administrador")
    await assertNotLastAdmin(id)
  }
  if (target._count.sales > 0 || target._count.movements > 0) {
    throw new HttpError(409, "El usuario tiene ventas o movimientos registrados. Desactivalo en lugar de eliminarlo.")
  }

  await prisma.user.delete({ where: { id } })
  res.json({ ok: true })
})
