import type { ReactNode } from "react"
import { Navigate, Route, Routes, useLocation } from "react-router"

import { FullPageSpinner } from "@/components/full-page-spinner"
import { PanelLayout } from "@/components/panel-layout"
import { useAuth } from "@/lib/auth"
import type { Action, Module } from "@/lib/types"
import { MODULES } from "@/lib/types"
import { ChangePasswordPage } from "@/pages/change-password"
import { DashboardPage } from "@/pages/dashboard"
import { ForbiddenPage } from "@/pages/forbidden"
import { LoginPage } from "@/pages/login"
import { ProductFormPage } from "@/pages/product-form"
import { ProductsPage } from "@/pages/products"
import { ProfilePage } from "@/pages/profile"
import { ReportsPage } from "@/pages/reports"
import { RolesPage } from "@/pages/roles"
import { NewSalePage } from "@/pages/sale-new"
import { SalesPage } from "@/pages/sales"
import { StockPage } from "@/pages/stock"
import { UsersPage } from "@/pages/users"

const HOME_BY_MODULE: Record<(typeof MODULES)[number], string> = {
  dashboard: "/",
  ventas: "/ventas",
  reportes: "/reportes",
  productos: "/productos",
  stock: "/stock",
  usuarios: "/usuarios",
  roles: "/roles",
}

function RequireSession({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullPageSpinner />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (user.mustChangePassword) return <Navigate to="/cambiar-password" replace />
  return children
}

function RequirePermission({
  module,
  action = "view",
  children,
}: {
  module: Module
  action?: Action
  children: ReactNode
}) {
  const { can } = useAuth()
  return can(module, action) ? children : <ForbiddenPage />
}

/** Si el rol no tiene dashboard, lleva al primer módulo permitido. */
function Home() {
  const { can } = useAuth()
  if (can("dashboard")) return <DashboardPage />
  const first = MODULES.find((m) => can(m))
  return first ? <Navigate to={HOME_BY_MODULE[first]} replace /> : <ForbiddenPage />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/cambiar-password" element={<ChangePasswordPage />} />
      <Route
        element={
          <RequireSession>
            <PanelLayout />
          </RequireSession>
        }
      >
        <Route index element={<Home />} />
        <Route
          path="ventas"
          element={<RequirePermission module="ventas"><SalesPage /></RequirePermission>}
        />
        <Route
          path="ventas/nueva"
          element={<RequirePermission module="ventas" action="create"><NewSalePage /></RequirePermission>}
        />
        <Route
          path="productos"
          element={<RequirePermission module="productos"><ProductsPage /></RequirePermission>}
        />
        <Route
          path="productos/nuevo"
          element={<RequirePermission module="productos" action="create"><ProductFormPage /></RequirePermission>}
        />
        <Route
          path="productos/:id"
          element={<RequirePermission module="productos"><ProductFormPage /></RequirePermission>}
        />
        <Route
          path="stock"
          element={<RequirePermission module="stock"><StockPage /></RequirePermission>}
        />
        <Route
          path="reportes"
          element={<RequirePermission module="reportes"><ReportsPage /></RequirePermission>}
        />
        <Route
          path="usuarios"
          element={<RequirePermission module="usuarios"><UsersPage /></RequirePermission>}
        />
        <Route
          path="roles"
          element={<RequirePermission module="roles"><RolesPage /></RequirePermission>}
        />
        <Route path="perfil" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
