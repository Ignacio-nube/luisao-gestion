import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { FileSpreadsheetIcon, FileTextIcon, SearchIcon, TableIcon } from "lucide-react"
import { toast } from "sonner"

import { DataPagination } from "@/components/data-pagination"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { usePagination } from "@/hooks/use-pagination"
import { api, qs } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { exportExcel, exportPdf, formatCell } from "@/lib/export"
import { formatDate, todayISO } from "@/lib/format"
import type { ReportData, ReportDataset } from "@/lib/types"
import { cn } from "@/lib/utils"

type Preset = "hoy" | "mes" | "30d" | "anio" | "todo"

const PRESETS: { value: Preset; label: string }[] = [
  { value: "hoy", label: "Hoy" },
  { value: "mes", label: "Este mes" },
  { value: "30d", label: "30 días" },
  { value: "anio", label: "Este año" },
  { value: "todo", label: "Todo" },
]

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function presetRange(p: Preset): { from: string; to: string } {
  const now = new Date()
  switch (p) {
    case "hoy":
      return { from: todayISO(), to: todayISO() }
    case "mes":
      return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: todayISO() }
    case "30d":
      return { from: iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29)), to: todayISO() }
    case "anio":
      return { from: iso(new Date(now.getFullYear(), 0, 1)), to: todayISO() }
    case "todo":
      return { from: "", to: "" }
  }
}

const isRight = (type: string) => type === "money" || type === "number"

export function ReportsPage() {
  const { user } = useAuth()
  const [dataset, setDataset] = useState<string | null>(null)
  const [preset, setPreset] = useState<Preset | null>("mes")
  const [range, setRange] = useState(presetRange("mes"))
  const [q, setQ] = useState("")
  const search = useDebouncedValue(q.trim())
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null)
  const pagination = usePagination(25)

  const datasets = useQuery({
    queryKey: ["reports"],
    queryFn: () => api.get<{ datasets: ReportDataset[] }>("/reports").then((r) => r.datasets),
  })
  const current = datasets.data?.find((d) => d.key === dataset) ?? datasets.data?.[0]
  const filters = current?.dated ? { from: range.from, to: range.to, q: search } : { q: search }

  const report = useQuery({
    queryKey: ["reports", current?.key, filters, pagination.page, pagination.pageSize],
    queryFn: () =>
      api.get<ReportData>(
        `/reports/${current!.key}${qs({ ...filters, page: pagination.page, pageSize: pagination.pageSize })}`
      ),
    enabled: !!current,
    placeholderData: (prev) => prev,
  })

  const period = !current?.dated
    ? "Estado actual"
    : range.from || range.to
      ? `Del ${range.from ? formatDate(`${range.from}T00:00:00`) : "inicio"} al ${
          range.to ? formatDate(`${range.to}T00:00:00`) : "hoy"
        }`
      : "Todo el historial"

  async function onExport(kind: "xlsx" | "pdf") {
    if (!current) return
    setExporting(kind)
    try {
      // Se exporta todo lo filtrado, no solo la página visible.
      const all = await api.get<ReportData>(`/reports/${current.key}${qs({ ...filters, all: 1 })}`)
      const meta = { period, generatedBy: user?.name ?? "" }
      if (kind === "xlsx") await exportExcel(all, meta)
      else await exportPdf(all, meta)
      toast.success(`${all.title}: ${all.total} registros exportados`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo exportar")
    } finally {
      setExporting(null)
    }
  }

  const data = report.data?.title === current?.title ? report.data : undefined

  return (
    <>
      <PageHeader
        title="Reportes"
        description="Consultá todos los datos del local y exportalos a Excel o PDF."
        actions={
          <>
            <Button variant="outline" disabled={!data?.total || !!exporting} onClick={() => onExport("xlsx")}>
              {exporting === "xlsx" ? <Spinner data-icon="inline-start" /> : <FileSpreadsheetIcon data-icon="inline-start" />}
              Excel
            </Button>
            <Button variant="outline" disabled={!data?.total || !!exporting} onClick={() => onExport("pdf")}>
              {exporting === "pdf" ? <Spinner data-icon="inline-start" /> : <FileTextIcon data-icon="inline-start" />}
              PDF
            </Button>
          </>
        }
      />

      {datasets.data && current && (
        <Tabs
          value={current.key}
          onValueChange={(v) => {
            setDataset(v as string)
            pagination.reset()
          }}
        >
          <div className="-mx-1 overflow-x-auto px-1">
            <TabsList>
              {datasets.data.map((d) => (
                <TabsTrigger key={d.key} value={d.key}>
                  {d.title}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>
      )}

      <div className="flex flex-wrap items-end gap-4">
        {current?.dated && (
          <>
            <Field className="w-auto">
              <FieldLabel>Período</FieldLabel>
              <ToggleGroup
                variant="outline"
                className="flex-wrap"
                value={preset ? [preset] : []}
                onValueChange={(v) => {
                  const p = v[0] as Preset | undefined
                  if (!p) return
                  setPreset(p)
                  setRange(presetRange(p))
                  pagination.reset()
                }}
              >
                {PRESETS.map((p) => (
                  <ToggleGroupItem key={p.value} value={p.value}>
                    {p.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>
            <Field className="w-auto">
              <FieldLabel htmlFor="r-from">Desde</FieldLabel>
              <Input
                id="r-from"
                type="date"
                value={range.from}
                onChange={(e) => {
                  setRange((r) => ({ ...r, from: e.target.value }))
                  setPreset(null)
                  pagination.reset()
                }}
              />
            </Field>
            <Field className="w-auto">
              <FieldLabel htmlFor="r-to">Hasta</FieldLabel>
              <Input
                id="r-to"
                type="date"
                value={range.to}
                onChange={(e) => {
                  setRange((r) => ({ ...r, to: e.target.value }))
                  setPreset(null)
                  pagination.reset()
                }}
              />
            </Field>
          </>
        )}
        {current?.key !== "ventas" && (
          <InputGroup className="max-w-xs">
            <InputGroupInput
              placeholder="Buscar…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                pagination.reset()
              }}
            />
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
          </InputGroup>
        )}
      </div>

      <Card className="py-0">
        {!data ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : !data.items.length ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <TableIcon />
              </EmptyMedia>
              <EmptyTitle>Sin datos</EmptyTitle>
              <EmptyDescription>No hay registros para los filtros elegidos.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {data.columns.map((c) => (
                  <TableHead key={c.key} className={cn(isRight(c.type) && "text-right")}>
                    {c.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((row, i) => (
                <TableRow key={i}>
                  {data.columns.map((c) => (
                    <TableCell
                      key={c.key}
                      className={cn("whitespace-nowrap", isRight(c.type) && "text-right tabular-nums")}
                    >
                      {formatCell(row[c.key], c.type)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
            {data.totals && (
              <TableFooter>
                <TableRow>
                  {data.columns.map((c, i) => (
                    <TableCell
                      key={c.key}
                      className={cn("font-semibold whitespace-nowrap", isRight(c.type) && "text-right tabular-nums")}
                    >
                      {i === 0 ? "Total" : data.totals?.[c.key] != null ? formatCell(data.totals[c.key], c.type) : ""}
                    </TableCell>
                  ))}
                </TableRow>
              </TableFooter>
            )}
          </Table>
        )}
      </Card>

      {data && (
        <DataPagination
          page={data.page}
          pageCount={data.pageCount}
          pageSize={data.pageSize}
          total={data.total}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
          pageSizeOptions={[25, 50, 100]}
          itemLabel="registros"
        />
      )}
      {data?.totals && current?.dated && (
        <p className="text-xs text-muted-foreground">
          Los totales abarcan todo el período filtrado; las ventas anuladas no suman.
        </p>
      )}
    </>
  )
}
