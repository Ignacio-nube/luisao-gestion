import { useState, type FormEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { LockIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { DataPagination } from "@/components/data-pagination"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { usePagination } from "@/hooks/use-pagination"
import { api, qs } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import {
  ACTION_LABELS,
  MODULE_LABELS,
  MODULES,
  type Action,
  type Module,
  type Paginated,
  type PermissionSet,
  type Role,
} from "@/lib/types"

const ACTIONS = Object.keys(ACTION_LABELS) as Action[]

function emptyPermissions(): PermissionSet {
  return Object.fromEntries(
    MODULES.map((m) => [m, { view: false, create: false, edit: false, delete: false }])
  ) as PermissionSet
}

export function RolesPage() {
  const { can, refresh } = useAuth()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<Role | "new" | null>(null)
  const [deleting, setDeleting] = useState<Role | null>(null)

  const pagination = usePagination(6)
  const roles = useQuery({
    queryKey: ["roles", pagination.page, pagination.pageSize],
    queryFn: () =>
      api.get<Paginated<Role>>(`/roles${qs({ page: pagination.page, pageSize: pagination.pageSize })}`),
    placeholderData: (prev) => prev,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["roles"] })
    // Si cambiaron los permisos de mi propio rol, el sidebar se actualiza.
    void refresh()
  }

  const remove = useMutation({
    mutationFn: (r: Role) => api.delete(`/roles/${r.id}`),
    onSuccess: () => {
      toast.success("Rol eliminado")
      setDeleting(null)
      invalidate()
    },
  })

  return (
    <>
      <PageHeader
        title="Roles y permisos"
        description="Definí qué puede ver y hacer cada rol en cada módulo."
        actions={
          can("roles", "create") && (
            <Button onClick={() => setEditing("new")}>
              <PlusIcon data-icon="inline-start" />
              Nuevo rol
            </Button>
          )
        }
      />

      {roles.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-72 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {roles.data?.items.map((role) => (
            <Card key={role.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {role.name}
                  {role.isSystem && (
                    <Badge variant="secondary">
                      <LockIcon data-icon="inline-start" />
                      Sistema
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {role.description || "Sin descripción"} · {role.userCount}{" "}
                  {role.userCount === 1 ? "usuario" : "usuarios"}
                </CardDescription>
                {!role.isSystem && (
                  <CardAction className="flex gap-1">
                    {can("roles", "edit") && (
                      <Button variant="ghost" size="icon-sm" onClick={() => setEditing(role)}>
                        <PencilIcon />
                        <span className="sr-only">Editar</span>
                      </Button>
                    )}
                    {can("roles", "delete") && (
                      <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(role)}>
                        <Trash2Icon />
                        <span className="sr-only">Eliminar</span>
                      </Button>
                    )}
                  </CardAction>
                )}
              </CardHeader>
              <CardContent>
                <PermissionMatrix permissions={role.permissions} readOnly />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {roles.data && (
        <DataPagination
          page={roles.data.page}
          pageCount={roles.data.pageCount}
          pageSize={roles.data.pageSize}
          total={roles.data.total}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
          pageSizeOptions={[4, 6, 12]}
          itemLabel="roles"
        />
      )}

      {editing && (
        <RoleDialog
          role={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={invalidate}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`¿Eliminar el rol ${deleting?.name}?`}
        description="Solo se pueden eliminar roles sin usuarios asignados."
        confirmLabel="Eliminar"
        destructive
        pending={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
      />
    </>
  )
}

function PermissionMatrix({
  permissions,
  readOnly,
  onChange,
}: {
  permissions: PermissionSet
  readOnly?: boolean
  onChange?: (module: Module, action: Action, value: boolean) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Módulo</TableHead>
          {ACTIONS.map((a) => (
            <TableHead key={a} className="text-center">
              {ACTION_LABELS[a]}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {MODULES.map((m) => (
          <TableRow key={m}>
            <TableCell className="font-medium">{MODULE_LABELS[m]}</TableCell>
            {ACTIONS.map((a) => (
              <TableCell key={a} className="text-center">
                <Checkbox
                  aria-label={`${ACTION_LABELS[a]} ${MODULE_LABELS[m]}`}
                  checked={permissions[m][a]}
                  disabled={readOnly}
                  onCheckedChange={(v) => onChange?.(m, a, !!v)}
                />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function RoleDialog({
  role,
  onClose,
  onSaved,
}: {
  role: Role | null
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(role?.name ?? "")
  const [description, setDescription] = useState(role?.description ?? "")
  const [permissions, setPermissions] = useState<PermissionSet>(
    role ? structuredClone(role.permissions) : emptyPermissions()
  )

  function toggle(module: Module, action: Action, value: boolean) {
    setPermissions((prev) => {
      const next = structuredClone(prev)
      next[module][action] = value
      // Crear/editar/eliminar requiere ver; quitar "ver" quita todo.
      if (value && action !== "view") next[module].view = true
      if (!value && action === "view") {
        next[module] = { view: false, create: false, edit: false, delete: false }
      }
      return next
    })
  }

  const save = useMutation({
    mutationFn: () => {
      const body = { name, description, permissions }
      return role ? api.patch(`/roles/${role.id}`, body) : api.post("/roles", body)
    },
    onSuccess: () => {
      toast.success(role ? "Rol actualizado" : "Rol creado")
      onSaved()
      onClose()
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    save.mutate()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <form onSubmit={onSubmit} className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>{role ? `Editar rol ${role.name}` : "Nuevo rol"}</DialogTitle>
            <DialogDescription>
              Los cambios se aplican al instante a todos los usuarios con este rol.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="r-name">Nombre</FieldLabel>
              <Input id="r-name" required value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="r-desc">Descripción</FieldLabel>
              <Textarea
                id="r-desc"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
          </FieldGroup>
          <PermissionMatrix permissions={permissions} onChange={toggle} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Spinner data-icon="inline-start" />}
              Guardar rol
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
