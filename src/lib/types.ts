export const MODULES = ["dashboard", "productos", "stock", "ventas", "reportes", "usuarios", "roles"] as const
export type Module = (typeof MODULES)[number]
export type Action = "view" | "create" | "edit" | "delete"
export type Actions = Record<Action, boolean>
export type PermissionSet = Record<Module, Actions>

export const MODULE_LABELS: Record<Module, string> = {
  dashboard: "Dashboard",
  productos: "Productos",
  stock: "Stock",
  ventas: "Ventas",
  reportes: "Reportes",
  usuarios: "Usuarios",
  roles: "Roles y permisos",
}

export const ACTION_LABELS: Record<Action, string> = {
  view: "Ver",
  create: "Crear",
  edit: "Editar",
  delete: "Eliminar",
}

export type AuthUser = {
  id: number
  name: string
  username: string
  roleId: number
  roleName: string
  isAdmin: boolean
  mustChangePassword: boolean
  permissions: PermissionSet
}

export type User = {
  id: number
  name: string
  username: string
  active: boolean
  mustChangePassword: boolean
  createdAt: string
  lastLoginAt: string | null
  roleId: number
  role: { id: number; name: string }
}

export type Role = {
  id: number
  name: string
  description: string
  isSystem: boolean
  userCount: number
  permissions: PermissionSet
}

export type Category = { id: number; name: string; _count?: { products: number } }

export type Variant = {
  id: number
  productId: number
  size: string
  color: string
  sku: string
  stock: number
  minStock: number
}

export type Product = {
  id: number
  name: string
  sku: string
  description: string
  price: number
  cost: number
  active: boolean
  categoryId: number | null
  category: Category | null
  variants: Variant[]
}

export type StockVariant = Variant & {
  product: { id: number; name: string; sku: string; active: boolean }
}

export type StockMovement = {
  id: number
  type: "ENTRADA" | "SALIDA" | "AJUSTE" | "VENTA" | "ANULACION"
  qty: number
  reason: string
  createdAt: string
  user: { name: string }
  variant: { size: string; color: string; sku: string; product: { name: string } }
}

export const PAYMENT_METHODS = {
  EFECTIVO: "Efectivo",
  DEBITO: "Débito",
  CREDITO: "Crédito",
  TRANSFERENCIA: "Transferencia",
  MERCADOPAGO: "Mercado Pago",
} as const
export type PaymentMethod = keyof typeof PAYMENT_METHODS

export type Sale = {
  id: number
  subtotal: number
  discount: number
  total: number
  paymentMethod: PaymentMethod
  status: "COMPLETADA" | "ANULADA"
  createdAt: string
  user: { name: string }
  _count?: { items: number }
  items?: {
    id: number
    qty: number
    unitPrice: number
    subtotal: number
    variant: Variant & { product: { name: string } }
  }[]
}

export type PosVariant = Variant & { product: { name: string; price: number } }

export type DashboardData = {
  today: { total: number; count: number }
  month: { total: number; count: number; avgTicket: number }
  stockUnits: number
  lowStockCount: number
  daily: { date: string; total: number; count: number }[]
  topProducts: { name: string; qty: number; total: number }[]
  byPayment: { method: PaymentMethod; total: number }[]
  lowStock: {
    id: number
    product: string
    size: string
    color: string
    sku: string
    stock: number
    minStock: number
  }[]
}

export type Paginated<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export type ReportCell = string | number | null
export type ReportColumn = { key: string; label: string; type: "text" | "number" | "money" | "date" | "datetime" }
export type ReportData = Paginated<Record<string, ReportCell>> & {
  title: string
  columns: ReportColumn[]
  totals: Record<string, ReportCell> | null
}
export type ReportDataset = { key: string; title: string; dated: boolean }
