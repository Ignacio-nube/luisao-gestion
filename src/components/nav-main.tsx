import { useState } from "react"
import { Link, useLocation } from "react-router"
import { ChevronRightIcon } from "lucide-react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import type { Action, Module } from "@/lib/types"

type NavSubItem = { title: string; url: string; module: Module; action?: Action }

export type NavItem = NavSubItem & {
  icon: React.ReactNode
  items?: NavSubItem[]
}

export type NavSection = { label: string; items: NavItem[] }

function isActivePath(pathname: string, url: string) {
  return url === "/" ? pathname === "/" : pathname === url || pathname.startsWith(`${url}/`)
}

export function NavMain({ sections }: { sections: NavSection[] }) {
  const { pathname } = useLocation()
  // Abierto por defecto si contiene la ruta actual; después respeta lo que elija el usuario.
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({})

  return sections.map((section) => (
    <SidebarGroup key={section.label}>
      <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
      <SidebarMenu>
        {section.items.map((item) =>
          item.items?.length ? (
            <Collapsible
              key={item.title}
              open={openItems[item.title] ?? isActivePath(pathname, item.url)}
              onOpenChange={(open) => setOpenItems((prev) => ({ ...prev, [item.title]: open }))}
              className="group/collapsible"
              render={<SidebarMenuItem />}
            >
              <CollapsibleTrigger
                render={
                  <SidebarMenuButton
                    tooltip={item.title}
                    isActive={isActivePath(pathname, item.url)}
                  />
                }
              >
                {item.icon}
                <span>{item.title}</span>
                <ChevronRightIcon className="ml-auto transition-transform duration-200 group-data-open/collapsible:rotate-90" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {item.items.map((sub) => (
                    <SidebarMenuSubItem key={sub.url}>
                      <SidebarMenuSubButton
                        isActive={pathname === sub.url}
                        render={<Link to={sub.url} />}
                      >
                        <span>{sub.title}</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </CollapsibleContent>
            </Collapsible>
          ) : (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                tooltip={item.title}
                isActive={isActivePath(pathname, item.url)}
                render={<Link to={item.url} />}
              >
                {item.icon}
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        )}
      </SidebarMenu>
    </SidebarGroup>
  ))
}
