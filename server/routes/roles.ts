import { Router } from "express"
import { z } from "zod"
import { requirePermission } from "../auth.ts"
import { prisma } from "../db.ts"
import { HttpError, paginated, parseId, parsePagination } from "../http.ts"
import { buildPermissionSet, MODULES } from "../permissions.ts"

export const rolesRouter = Router()

const actionsSchema = z.object({
  view: z.boolean(),
  create: z.boolean(),
  edit: z.boolean(),
  delete: z.boolean(),
})

const permissionsSchema = z.partialRecord(z.enum(MODULES), actionsSchema)

const roleSchema = z.object({
  name: z.string().trim().min(2, "El nombre es muy corto").max(40),
  description: z.string().trim().max(200).default(""),
  permissions: permissionsSchema,
})

function toRows(permissions: z.infer<typeof permissionsSchema>) {
  return MODULES.map((module) => {
    const p = permissions[module]
    // Cualquier acción implica poder ver el módulo.
    const anyAction = !!(p?.create || p?.edit || p?.delete)
    return {
      module,
      canView: !!p?.view || anyAction,
      canCreate: !!p?.create,
      canEdit: !!p?.edit,
      canDelete: !!p?.delete,
    }
  })
}

rolesRouter.get("/", requirePermission("roles", "view"), async (req, res) => {
  const pg = parsePagination(req.query, 6)
  const [roles, total] = await Promise.all([
    prisma.role.findMany({
      include: { permissions: true, _count: { select: { users: true } } },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
      skip: pg.skip,
      take: pg.take,
    }),
    prisma.role.count(),
  ])
  res.json(
    paginated(
      roles.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        isSystem: r.isSystem,
        userCount: r._count.users,
        permissions: buildPermissionSet(r.name, r.permissions),
      })),
      total,
      pg
    )
  )
})

/** Lista mínima de roles para selects (la usa la pantalla de usuarios). */
rolesRouter.get("/options", requirePermission("usuarios", "view"), async (_req, res) => {
  const roles = await prisma.role.findMany({
    select: { id: true, name: true },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
  })
  res.json({ roles })
})

rolesRouter.post("/", requirePermission("roles", "create"), async (req, res) => {
  const data = roleSchema.parse(req.body)
  const role = await prisma.role.create({
    data: {
      name: data.name,
      description: data.description,
      permissions: { create: toRows(data.permissions) },
    },
  })
  res.status(201).json({ role })
})

rolesRouter.patch("/:id", requirePermission("roles", "edit"), async (req, res) => {
  const id = parseId(req.params.id)
  const data = roleSchema.parse(req.body)
  const role = await prisma.role.findUnique({ where: { id } })
  if (!role) throw new HttpError(404, "Rol no encontrado")
  if (role.isSystem) {
    throw new HttpError(409, "El rol Admin es del sistema: siempre tiene todos los permisos")
  }

  await prisma.$transaction([
    prisma.permission.deleteMany({ where: { roleId: id } }),
    prisma.role.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        permissions: { create: toRows(data.permissions) },
      },
    }),
  ])
  res.json({ ok: true })
})

rolesRouter.delete("/:id", requirePermission("roles", "delete"), async (req, res) => {
  const id = parseId(req.params.id)
  const role = await prisma.role.findUnique({
    where: { id },
    include: { _count: { select: { users: true } } },
  })
  if (!role) throw new HttpError(404, "Rol no encontrado")
  if (role.isSystem) throw new HttpError(409, "El rol Admin no se puede eliminar")
  if (role._count.users > 0) {
    throw new HttpError(409, "Hay usuarios con este rol. Reasignalos antes de eliminarlo.")
  }
  await prisma.role.delete({ where: { id } })
  res.json({ ok: true })
})
