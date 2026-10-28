import { OwnPasswordForm } from "@/components/own-password-form"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/lib/auth"
import { ACTION_LABELS, MODULE_LABELS, MODULES, type Action } from "@/lib/types"

export function ProfilePage() {
  const { user } = useAuth()
  if (!user) return null

  return (
    <>
      <PageHeader title="Mi cuenta" description={`${user.name} · @${user.username}`} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cambiar contraseña</CardTitle>
            <CardDescription>Elegí una contraseña que no uses en otros lados.</CardDescription>
          </CardHeader>
          <CardContent>
            <OwnPasswordForm />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Mis permisos</CardTitle>
            <CardDescription>
              Rol <Badge variant="secondary">{user.roleName}</Badge>
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {MODULES.map((m) => {
              const actions = (Object.keys(ACTION_LABELS) as Action[]).filter(
                (a) => user.permissions[m][a]
              )
              return (
                <div key={m} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>{MODULE_LABELS[m]}</span>
                  <div className="flex flex-wrap gap-1">
                    {actions.length ? (
                      actions.map((a) => (
                        <Badge key={a} variant="outline">
                          {ACTION_LABELS[a]}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground">Sin acceso</span>
                    )}
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
