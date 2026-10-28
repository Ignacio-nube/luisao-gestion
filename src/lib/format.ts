const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
})

const dateTime = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "short",
  timeStyle: "short",
})

const date = new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" })

export const formatMoney = (value: number) => currency.format(value)
export const formatDateTime = (value: string | Date) => dateTime.format(new Date(value))
export const formatDate = (value: string | Date) => date.format(new Date(value))

export function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("")
}
