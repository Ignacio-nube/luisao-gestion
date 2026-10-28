import { useState, type FormEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  KeyRoundIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  PowerIcon,
  SearchIcon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react"
import { useNavigate } from "react-router"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { DataPagination } from "@/components/data-pagination"
import { PageHeader } from "@/components/page-header"
import { SimpleSelect } from "@/components/simple-select"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
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
import { usePagination } from "@/hooks/use-pagination"
import { api, qs } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { formatDateTime, initials } from "@/lib/format"
import type { Paginated, User } from "@/lib/types"

type RoleOption = { id: number; name: string }

export function UsersPage() {
  const { can, user: me, logout } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [editing, setEditing] = useState<User | "new" | null>(null)
  const [passwordFor, setPasswordFor] = useState<User | null>(null)
  const [deleting, setDeleting] = useState<User | null>(null)

  const pagination = usePagination(10)
  const [q, setQ] = useState("")
  const users = useQuery({
    queryKey: ["users", q, pagination.page, pagination.pageSize],
    queryFn: () =>
      api.get<Paginated<User>>(
        `/users${qs({ q, page: pagination.page, pageSize: pagination.pageSize })}`
      ),
    placeholderData: (prev) => prev,
  })
  const roles = useQuery({
    queryKey: ["roles", "options"],
    queryFn: () => api.get<{ roles: RoleOption[] }>("/roles/options").then((r) => r.roles),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["users"] })

  const toggleActive = useMutation({
    mutationFn: (u: User) => api.patch(`/users/${u.id}`, { active: !u.active }),
    onSuccess: (_d, u) => {
      toast.success(u.active ? `${u.name} fue desactivado` : `${u.name} fue activado`)
      invalidate()
    },
  })

  const remove = useMutation({
    mutationFn: (u: User) => api.delete(`/users/${u.id}`),
    onSuccess: () => {
      toast.success("Usuario eliminado")
      setDeleting(null)
      invalidate()
    },
  })

  return (
    <>
      <PageHeader
        title="Usuarios"
        description="Cuentas del personal, su rol y acceso al sistema."
        actions={
          can("usuarios", "create") && (
            <Button onClick={() => setEditing("new")}>
              <PlusIcon data-icon="inline-start" />
              Nuevo usuario
            </Button>
          )
        }
      />

      <InputGroup className="max-w-sm">
        <InputGroupInput
          placeholder="Buscar por nombre o usuario…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            pagination.reset()
          }}
        />
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
      </InputGroup>

      <Card className="py-0">
        {users.isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : !users.data?.items.length ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UsersIcon />
              </EmptyMedia>
              <EmptyTitle>Sin usuarios</EmptyTitle>
              <EmptyDescription>
                {q ? "Ningún usuario coincide con la búsqueda." : "Creá la primera cuenta del personal."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="hidden md:table-cell">Último ingreso</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.data.items.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>{initials(u.name)}</AvatarFallback>
                      </Avatar>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">
                          {u.name}
                          {u.id === me?.id && <span className="text-muted-foreground"> (vos)</span>}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">@{u.username}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.role.name === "Admin" ? "default" : "secondary"}>{u.role.name}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant={u.active ? "outline" : "destructive"}>
                        {u.active ? "Activo" : "Inactivo"}
                      </Badge>
                      {u.mustChangePassword && <Badge variant="secondary">Debe cambiar contraseña</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Nunca"}
                  </TableCell>
                  <TableCell>
                    {(can("usuarios", "edit") || can("usuarios", "delete")) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
                          <MoreHorizontalIcon />
                          <span className="sr-only">Acciones</span>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-48">
                          {can("usuarios", "edit") && (
                            <DropdownMenuGroup>
                              <DropdownMenuItem onClick={() => setEditing(u)}>
                                <PencilIcon />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setPasswordFor(u)}>
                                <KeyRoundIcon />
                                Cambiar contraseña
                              </DropdownMenuItem>
                              {u.id !== me?.id && (
                                <DropdownMenuItem onClick={() => toggleActive.mutate(u)}>
                                  <PowerIcon />
                                  {u.active ? "Desactivar" : "Activar"}
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuGroup>
                          )}
                          {can("usuarios", "delete") && u.id !== me?.id && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuGroup>
                                <DropdownMenuItem variant="destructive" onClick={() => setDeleting(u)}>
                                  <Trash2Icon />
                                  Eliminar
                                </DropdownMenuItem>
                              </DropdownMenuGroup>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {users.data && (
        <DataPagination
          page={users.data.page}
          pageCount={users.data.pageCount}
          pageSize={users.data.pageSize}
          total={users.data.total}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
          itemLabel="usuarios"
        />
      )}

      {editing && (
        <UserFormDialog
          user={editing === "new" ? null : editing}
          roles={roles.data ?? []}
          onClose={() => setEditing(null)}
          onSaved={invalidate}
        />
      )}

      {passwordFor && (
        <AdminPasswordDialog
          user={passwordFor}
          onClose={() => setPasswordFor(null)}
          onSaved={async (selfChanged) => {
            invalidate()
            if (selfChanged) {
              toast.info("Cambiaste tu propia contraseña. Volvé a ingresar.")
              await logout()
              navigate("/login", { replace: true })
            }
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`¿Eliminar a ${deleting?.name}?`}
        description="Esta acción no se puede deshacer. Si el usuario tiene ventas registradas, desactivalo en su lugar."
        confirmLabel="Eliminar"
        destructive
        pending={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
      />
    </>
  )
}

function UserFormDialog({
  user,
  roles,
  onClose,
  onSaved,
}: {
  user: User | null
  roles: RoleOption[]
  onClose: () => void
  onSaved: () => void
}) {
  const isNew = !user
  const [name, setName] = useState(user?.name ?? "")
  const [username, setUsername] = useState(user?.username ?? "")
  const [roleId, setRoleId] = useState<string | null>(
    user ? String(user.roleId) : (roles.find((r) => r.name === "Vendedor")?.id.toString() ?? null)
  )
  const [password, setPassword] = useState("")
  const [mustChange, setMustChange] = useState(true)

  const save = useMutation({
    mutationFn: () =>
      isNew
        ? api.post("/users", {
            name,
            username,
            password,
            roleId: Number(roleId),
            mustChangePassword: mustChange,
          })
        : api.patch(`/users/${user.id}`, { name, username, roleId: Number(roleId) }),
    onSuccess: () => {
      toast.success(isNew ? "Usuario creado" : "Usuario actualizado")
      onSaved()
      onClose()
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!roleId) return
    save.mutate()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>{isNew ? "Nuevo usuario" : `Editar ${user.name}`}</DialogTitle>
            <DialogDescription>
              {isNew
                ? "Creá la cuenta y asignale un rol. Los permisos dependen del rol."
                : "Cambiar el rol cierra las sesiones abiertas de este usuario."}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="u-name">Nombre y apellido</FieldLabel>
              <Input id="u-name" required value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="u-username">Usuario</FieldLabel>
              <Input
                id="u-username"
                required
                autoComplete="off"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
              />
              <FieldDescription>Con este nombre ingresa al sistema. Sin espacios.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="u-role">Rol</FieldLabel>
              <SimpleSelect
                id="u-role"
                value={roleId}
                onValueChange={setRoleId}
                items={[
                  { label: "Elegí un rol", value: null },
                  ...roles.map((r) => ({ label: r.name, value: String(r.id) })),
                ]}
              />
            </Field>
            {isNew && (
              <>
                <Field>
                  <FieldLabel htmlFor="u-password">Contraseña inicial</FieldLabel>
                  <Input
                    id="u-password"
                    type="text"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </Field>
                <Field orientation="horizontal">
                  <Checkbox
                    id="u-must-change"
                    checked={mustChange}
                    onCheckedChange={(v) => setMustChange(!!v)}
                  />
                  <FieldLabel htmlFor="u-must-change" className="font-normal">
                    Pedir que la cambie al ingresar por primera vez
                  </FieldLabel>
                </Field>
              </>
            )}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={save.isPending || !roleId}>
              {save.isPending && <Spinner data-icon="inline-start" />}
              {isNew ? "Crear usuario" : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** El admin define una contraseña nueva para otra cuenta (sin conocer la anterior). */
function AdminPasswordDialog({
  user,
  onClose,
  onSaved,
}: {
  user: User
  onClose: () => void
  onSaved: (selfChanged: boolean) => void
}) {
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [mustChange, setMustChange] = useState(true)

  const mismatch = confirm.length > 0 && password !== confirm
  const tooShort = password.length > 0 && password.length < 6

  const save = useMutation({
    mutationFn: () =>
      api.post<{ ok: true; selfChanged: boolean }>(`/users/${user.id}/password`, {
        password,
        mustChangePassword: mustChange,
      }),
    onSuccess: (res) => {
      toast.success(`Contraseña de ${user.name} actualizada`)
      onClose()
      onSaved(res.selfChanged)
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (mismatch || tooShort || !password) return
    save.mutate()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>Cambiar contraseña</DialogTitle>
            <DialogDescription>
              Nueva contraseña para <strong>{user.name}</strong> (@{user.username}). Se cerrarán todas sus
              sesiones abiertas.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field data-invalid={tooShort || undefined}>
              <FieldLabel htmlFor="ap-password">Nueva contraseña</FieldLabel>
              <Input
                id="ap-password"
                type="password"
                required
                autoComplete="new-password"
                aria-invalid={tooShort || undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {tooShort && <FieldError>Mínimo 6 caracteres.</FieldError>}
            </Field>
            <Field data-invalid={mismatch || undefined}>
              <FieldLabel htmlFor="ap-confirm">Repetir contraseña</FieldLabel>
              <Input
                id="ap-confirm"
                type="password"
                required
                autoComplete="new-password"
                aria-invalid={mismatch || undefined}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
              {mismatch && <FieldError>Las contraseñas no coinciden.</FieldError>}
            </Field>
            <Field orientation="horizontal">
              <Checkbox id="ap-must" checked={mustChange} onCheckedChange={(v) => setMustChange(!!v)} />
              <FieldLabel htmlFor="ap-must" className="font-normal">
                Obligar a cambiarla en el próximo ingreso
              </FieldLabel>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={save.isPending || mismatch || tooShort || !password}>
              {save.isPending && <Spinner data-icon="inline-start" />}
              Guardar contraseña
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
