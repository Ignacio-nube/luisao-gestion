import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router"
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"

import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { formatMoney } from "@/lib/format"
import { PAYMENT_METHODS, type DashboardData } from "@/lib/types"

const chartConfig = {
  total: { label: "Ventas", color: "var(--chart-1)" },
} satisfies ChartConfig

const shortDate = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" })

function parseDay(iso: string) {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y, m - 1, d)
}

export function DashboardPage() {
  const { can, user } = useAuth()
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<DashboardData>("/dashboard"),
    refetchInterval: 60_000,
  })

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    )
  }

  const monthPaymentTotal = data.byPayment.reduce((a, p) => a + p.total, 0)

  const stats = [
    { label: "Ventas de hoy", value: formatMoney(data.today.total), hint: `${data.today.count} operaciones` },
    { label: "Ventas del mes", value: formatMoney(data.month.total), hint: `${data.month.count} operaciones` },
    { label: "Ticket promedio", value: formatMoney(data.month.avgTicket), hint: "Mes en curso" },
    {
      label: "Stock bajo",
      value: String(data.lowStockCount),
      hint: `${data.stockUnits} prendas en stock`,
    },
  ]

  return (
    <>
      <PageHeader
        title={`Hola, ${user?.name.split(" ")[0]}`}
        description="Resumen del local."
        actions={
          can("ventas", "create") && (
            <Button nativeButton={false} render={<Link to="/ventas/nueva" />}>
              Nueva venta
            </Button>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader>
              <CardDescription>{s.label}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{s.value}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">{s.hint}</CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ventas de los últimos 30 días</CardTitle>
          <CardDescription>Total facturado por día (ventas completadas)</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
            <BarChart data={data.daily} margin={{ left: 4, right: 4 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
                tickFormatter={(v: string) => shortDate.format(parseDay(v))}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(v) => shortDate.format(parseDay(String(v)))}
                    formatter={(value) => formatMoney(Number(value))}
                  />
                }
              />
              <Bar dataKey="total" fill="var(--color-total)" radius={4} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Más vendidos del mes</CardTitle>
          </CardHeader>
          <CardContent>
            {data.topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no hay ventas este mes.</p>
            ) : (
              <Table>
                <TableBody>
                  {data.topProducts.map((p, i) => (
                    <TableRow key={p.name}>
                      <TableCell className="w-6 text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.qty} u.</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Medios de pago</CardTitle>
            <CardDescription>Mes en curso</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {data.byPayment.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin datos todavía.</p>
            ) : (
              data.byPayment
                .sort((a, b) => b.total - a.total)
                .map((p) => {
                  const pct = monthPaymentTotal ? Math.round((p.total / monthPaymentTotal) * 100) : 0
                  return (
                    <div key={p.method} className="flex flex-col gap-1">
                      <div className="flex justify-between text-sm">
                        <span>{PAYMENT_METHODS[p.method]}</span>
                        <span className="tabular-nums">
                          {formatMoney(p.total)} <span className="text-muted-foreground">· {pct}%</span>
                        </span>
                      </div>
                      <Progress value={pct} aria-label={PAYMENT_METHODS[p.method]} />
                    </div>
                  )
                })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reponer</CardTitle>
            <CardDescription>Variantes en o debajo del mínimo</CardDescription>
            {can("stock") && (
              <CardAction>
                <Button variant="link" size="sm" nativeButton={false} render={<Link to="/stock" />}>
                  Ver stock
                </Button>
              </CardAction>
            )}
          </CardHeader>
          <CardContent>
            {data.lowStock.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todo el stock está por encima del mínimo.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Variante</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.lowStock.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell>
                        <div className="font-medium">{v.product}</div>
                        <div className="text-xs text-muted-foreground">
                          {v.size} / {v.color}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={v.stock === 0 ? "destructive" : "secondary"} className="tabular-nums">
                          {v.stock}/{v.minStock}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
