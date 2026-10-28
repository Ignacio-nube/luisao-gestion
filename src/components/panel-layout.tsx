import { Link, Outlet, useLocation } from "react-router"

import { AppSidebar } from "@/components/app-sidebar"
import { ErrorBoundary } from "@/components/error-boundary"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"

const CRUMBS: { match: RegExp; trail: { label: string; to?: string }[] }[] = [
  { match: /^\/$/, trail: [{ label: "Dashboard" }] },
  { match: /^\/ventas\/nueva$/, trail: [{ label: "Ventas", to: "/ventas" }, { label: "Nueva venta" }] },
  { match: /^\/ventas$/, trail: [{ label: "Ventas" }] },
  { match: /^\/productos\/nuevo$/, trail: [{ label: "Productos", to: "/productos" }, { label: "Nuevo" }] },
  { match: /^\/productos\/\d+$/, trail: [{ label: "Productos", to: "/productos" }, { label: "Editar" }] },
  { match: /^\/productos$/, trail: [{ label: "Productos" }] },
  { match: /^\/stock$/, trail: [{ label: "Stock" }] },
  { match: /^\/reportes$/, trail: [{ label: "Reportes" }] },
  { match: /^\/usuarios$/, trail: [{ label: "Administración" }, { label: "Usuarios" }] },
  { match: /^\/roles$/, trail: [{ label: "Administración" }, { label: "Roles y permisos" }] },
  { match: /^\/perfil$/, trail: [{ label: "Mi cuenta" }] },
]

export function PanelLayout() {
  const { pathname } = useLocation()
  const trail = CRUMBS.find((c) => c.match.test(pathname))?.trail ?? []

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 data-vertical:h-4 data-vertical:self-auto" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink render={<Link to="/" />}>LUISAO</BreadcrumbLink>
                </BreadcrumbItem>
                {trail.map((crumb, i) => (
                  <span key={crumb.label} className="contents">
                    <BreadcrumbSeparator className={i === 0 ? "hidden md:block" : undefined} />
                    <BreadcrumbItem>
                      {i === trail.length - 1 || !crumb.to ? (
                        <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink render={<Link to={crumb.to} />}>{crumb.label}</BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </span>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <main className="flex min-w-0 flex-1 flex-col gap-6 p-4 md:p-6">
          {/* key: al navegar se limpia el error de la vista anterior */}
          <ErrorBoundary key={pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
