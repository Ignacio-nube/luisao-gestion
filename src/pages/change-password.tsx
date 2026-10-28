import { Navigate, useNavigate } from "react-router"

import { FullPageSpinner } from "@/components/full-page-spinner"
import { OwnPasswordForm } from "@/components/own-password-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/lib/auth"

/** Pantalla obligatoria cuando el admin marcó "cambiar contraseña al ingresar". */
export function ChangePasswordPage() {
  const { user, loading, logout } = useAuth()
  const navigate = useNavigate()

  if (loading) return <FullPageSpinner />
  if (!user) return <Navigate to="/login" replace />
  if (!user.mustChangePassword) return <Navigate to="/" replace />

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted p-6 md:p-10">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Cambiá tu contraseña</CardTitle>
          <CardDescription>
            Hola {user.name}. Por seguridad tenés que elegir una contraseña nueva antes de continuar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OwnPasswordForm onDone={() => navigate("/", { replace: true })} />
        </CardContent>
        <CardFooter>
          <Button
            variant="link"
            className="px-0"
            onClick={async () => {
              await logout()
              navigate("/login", { replace: true })
            }}
          >
            Salir
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
