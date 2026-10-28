import { useState, type FormEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowDownUpIcon, BoxesIcon, SearchIcon } from "lucide-react"
import { toast } from "sonner"

import { DataPagination } from "@/components/data-pagination"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { usePagination } from "@/hooks/use-pagination"
import { api, qs } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { formatDateTime } from "@/lib/format"
import type { Paginated, StockMovement, StockVariant } from "@/lib/types"

const MOVEMENT_LABELS: Record<StockMovement["type"], string> = {
  ENTRADA: "Entrada",
  SALIDA: "Salida",
  AJUSTE: "Ajuste",
  VENTA: "Venta",
  ANULACION: "Anulación",
}

export function StockPage() {
  const { can } = useAuth()
  const [q, setQ] = useState("")
  const [lowOnly, setLowOnly] = useState(false)
  const [adjusting, setAdjusting] = useState<StockVariant | null>(null)

  const stockPage = usePagination(25)
  const movementsPage = usePagination(25)

  const stock = useQuery({
    queryKey: ["stock", "list", q, lowOnly, stockPage.page, stockPage.pageSize],
    queryFn: () =>
      api.get<Paginated<StockVariant>>(
        `/stock${qs({ q, low: lowOnly && "1", page: stockPage.page, pageSize: stockPage.pageSize })}`
      ),
    placeholderData: (prev) => prev,
  })

  const movements = useQuery({
    queryKey: ["stock", "movements", movementsPage.page, movementsPage.pageSize],
    queryFn: () =>
      api.get<Paginated<StockMovement>>(
        `/stock/movements${qs({ page: movementsPage.page, pageSize: movementsPage.pageSize })}`
      ),
    placeholderData: (prev) => prev,
  })

  return (
    <>
      <PageHeader title="Stock" description="Existencias por variante y registro de movimientos." />

      <Tabs defaultValue="inventario">
        <TabsList>
          <TabsTrigger value="inventario">Inventario</TabsTrigger>
          <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
        </TabsList>

        <TabsContent value="inventario" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <InputGroup className="max-w-sm">
              <InputGroupInput
                placeholder="Buscar producto, color o SKU…"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value)
                  stockPage.reset()
                }}
              />
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
            </InputGroup>
            <Field orientation="horizontal" className="w-auto">
              <Switch
                id="low-only"
                checked={lowOnly}
                onCheckedChange={(v) => {
                  setLowOnly(v)
                  stockPage.reset()
                }}
              />
              <FieldLabel htmlFor="low-only" className="font-normal">
                Solo stock bajo
              </FieldLabel>
            </Field>
          </div>

          <Card className="py-0">
            {stock.isLoading ? (
              <div className="flex flex-col gap-2 p-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : !stock.data?.items.length ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <BoxesIcon />
                  </EmptyMedia>
                  <EmptyTitle>{lowOnly ? "Nada con stock bajo" : "Sin resultados"}</EmptyTitle>
                  <EmptyDescription>
                    {lowOnly ? "Todas las variantes están por encima del mínimo." : "Probá con otra búsqueda."}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Talle</TableHead>
                    <TableHead>Color</TableHead>
                    <TableHead className="hidden md:table-cell">SKU</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">Mínimo</TableHead>
                    {can("stock", "edit") && <TableHead className="w-28" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stock.data.items.map((v) => {
                    const low = v.stock <= v.minStock
                    return (
                      <TableRow key={v.id}>
                        <TableCell className="font-medium">{v.product.name}</TableCell>
                        <TableCell>{v.size}</TableCell>
                        <TableCell>{v.color}</TableCell>
                        <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">
                          {v.sku}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={low ? "destructive" : "secondary"} className="tabular-nums">
                            {v.stock}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden text-right text-muted-foreground tabular-nums sm:table-cell">
                          {v.minStock}
                        </TableCell>
                        {can("stock", "edit") && (
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" onClick={() => setAdjusting(v)}>
                              <ArrowDownUpIcon data-icon="inline-start" />
                              Ajustar
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
          {stock.data && (
            <DataPagination
              page={stock.data.page}
              pageCount={stock.data.pageCount}
              pageSize={stock.data.pageSize}
              total={stock.data.total}
              onPageChange={stockPage.setPage}
              onPageSizeChange={stockPage.setPageSize}
              pageSizeOptions={[25, 50, 100]}
              itemLabel="variantes"
            />
          )}
        </TabsContent>

        <TabsContent value="movimientos" className="flex flex-col gap-4">
          <Card className="py-0">
            {movements.isLoading ? (
              <div className="flex flex-col gap-2 p-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="hidden md:table-cell">Motivo</TableHead>
                    <TableHead className="hidden sm:table-cell">Usuario</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.data?.items.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDateTime(m.createdAt)}
                      </TableCell>
                      <TableCell>
                        {m.variant.product.name}{" "}
                        <span className="text-muted-foreground">
                          {m.variant.size} / {m.variant.color}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{MOVEMENT_LABELS[m.type]}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {m.qty > 0 ? `+${m.qty}` : m.qty}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">
                        {m.reason || "—"}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{m.user.name}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
          {movements.data && (
            <DataPagination
              page={movements.data.page}
              pageCount={movements.data.pageCount}
              pageSize={movements.data.pageSize}
              total={movements.data.total}
              onPageChange={movementsPage.setPage}
              onPageSizeChange={movementsPage.setPageSize}
              pageSizeOptions={[25, 50, 100]}
              itemLabel="movimientos"
            />
          )}
        </TabsContent>
      </Tabs>

      {adjusting && <AdjustDialog variant={adjusting} onClose={() => setAdjusting(null)} />}
    </>
  )
}

type AdjustType = "ENTRADA" | "SALIDA" | "AJUSTE"

function AdjustDialog({ variant, onClose }: { variant: StockVariant; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [type, setType] = useState<AdjustType>("ENTRADA")
  const [qty, setQty] = useState("")
  const [reason, setReason] = useState("")

  const n = Number(qty) || 0
  const result = type === "AJUSTE" ? n : type === "ENTRADA" ? variant.stock + n : variant.stock - n

  const save = useMutation({
    mutationFn: () => api.post("/stock/adjust", { variantId: variant.id, type, qty: n, reason }),
    onSuccess: () => {
      toast.success("Stock actualizado")
      queryClient.invalidateQueries({ queryKey: ["stock"] })
      queryClient.invalidateQueries({ queryKey: ["products"] })
      onClose()
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    save.mutate()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>Ajustar stock</DialogTitle>
            <DialogDescription>
              {variant.product.name} · {variant.size} / {variant.color} · stock actual{" "}
              <strong>{variant.stock}</strong>
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel>Tipo de movimiento</FieldLabel>
              <ToggleGroup
                variant="outline"
                value={[type]}
                onValueChange={(v) => v[0] && setType(v[0] as AdjustType)}
              >
                <ToggleGroupItem value="ENTRADA">Entrada</ToggleGroupItem>
                <ToggleGroupItem value="SALIDA">Salida</ToggleGroupItem>
                <ToggleGroupItem value="AJUSTE">Fijar cantidad</ToggleGroupItem>
              </ToggleGroup>
            </Field>
            <Field data-invalid={result < 0 || undefined}>
              <FieldLabel htmlFor="adj-qty">{type === "AJUSTE" ? "Stock real contado" : "Cantidad"}</FieldLabel>
              <Input
                id="adj-qty"
                type="number"
                min={0}
                required
                autoFocus
                aria-invalid={result < 0 || undefined}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
              <FieldDescription>
                Stock resultante: <strong>{result}</strong>
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="adj-reason">Motivo</FieldLabel>
              <Input
                id="adj-reason"
                placeholder="Ej: compra a proveedor, falla, conteo mensual"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={save.isPending || result < 0 || qty === ""}>
              {save.isPending && <Spinner data-icon="inline-start" />}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
