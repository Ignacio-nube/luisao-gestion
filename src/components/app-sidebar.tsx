import * as React from "react"
import { Link } from "react-router"
import {
  BoxesIcon,
  FileSpreadsheetIcon,
  LayoutDashboardIcon,
  ShieldCheckIcon,
  ShieldIcon,
  ShirtIcon,
  ShoppingCartIcon,
  UsersIcon,
} from "lucide-react"

import { NavMain, type NavSection } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { useAuth } from "@/lib/auth"

const sections: NavSection[] = [
  {
    label: "General",
    items: [{ title: "Dashboard", url: "/", icon: <LayoutDashboardIcon />, module: "dashboard" }],
  },
  {
    label: "Comercial",
    items: [
      {
        title: "Ventas",
        url: "/ventas",
        icon: <ShoppingCartIcon />,
        module: "ventas",
        items: [
          { title: "Nueva venta (caja)", url: "/ventas/nueva", module: "ventas", action: "create" },
          { title: "Historial", url: "/ventas", module: "ventas" },
        ],
      },
      { title: "Productos", url: "/productos", icon: <ShirtIcon />, module: "productos" },
      { title: "Stock", url: "/stock", icon: <BoxesIcon />, module: "stock" },
      { title: "Reportes", url: "/reportes", icon: <FileSpreadsheetIcon />, module: "reportes" },
    ],
  },
  {
    label: "Administración",
    items: [
      { title: "Usuarios", url: "/usuarios", icon: <UsersIcon />, module: "usuarios" },
      { title: "Roles y permisos", url: "/roles", icon: <ShieldCheckIcon />, module: "roles" },
    ],
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { can } = useAuth()

  const visible = sections
    .map((section) => ({
      ...section,
      items: section.items
        .filter((item) => can(item.module, item.action))
        .map((item) => ({
          ...item,
          items: item.items?.filter((sub) => can(sub.module, sub.action)),
        })),
    }))
    .filter((section) => section.items.length > 0)

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link to="/" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <ShieldIcon />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-heading font-bold tracking-widest">LUISAO</span>
                <span className="truncate text-xs text-muted-foreground">Indumentaria táctica</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain sections={visible} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
