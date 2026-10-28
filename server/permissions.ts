export const MODULES = [
  "dashboard",
  "productos",
  "stock",
  "ventas",
  "reportes",
  "usuarios",
  "roles",
] as const

export type Module = (typeof MODULES)[number]
export type Action = "view" | "create" | "edit" | "delete"

export type PermissionSet = Record<
  Module,
  { view: boolean; create: boolean; edit: boolean; delete: boolean }
>

type PermissionRow = {
  module: string
  canView: boolean
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
}

export const ADMIN_ROLE = "Admin"

export function buildPermissionSet(
  roleName: string,
  rows: PermissionRow[]
): PermissionSet {
  const isAdmin = roleName === ADMIN_ROLE
  const set = {} as PermissionSet
  for (const module of MODULES) {
    const row = rows.find((r) => r.module === module)
    set[module] = {
      view: isAdmin || !!row?.canView,
      create: isAdmin || !!row?.canCreate,
      edit: isAdmin || !!row?.canEdit,
      delete: isAdmin || !!row?.canDelete,
    }
  }
  return set
}
