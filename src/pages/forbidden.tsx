import { Link } from "react-router"
import { ShieldAlertIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

export function ForbiddenPage() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ShieldAlertIcon />
        </EmptyMedia>
        <EmptyTitle>Acceso restringido</EmptyTitle>
        <EmptyDescription>
          Tu rol no tiene permiso para ver esta sección. Si lo necesitás, pedíselo al administrador.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" nativeButton={false} render={<Link to="/perfil" />}>
          Ir a mi cuenta
        </Button>
      </EmptyContent>
    </Empty>
  )
}
