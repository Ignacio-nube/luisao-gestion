import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "react-router"
import { PlusIcon, PrinterIcon, ReceiptIcon } from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { DataPagination } from "@/components/data-pagination"
import { PageHeader } from "@/components/page-header"
import { SaleTicketDialog } from "@/components/sale-ticket"
import { SimpleSelect } from "@/components/simple-select"
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
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { usePagination } from "@/hooks/use-pagination"
import { api, qs } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { formatDateTime, formatMoney, todayISO } from "@/lib/format"
import { PAYMENT_METHODS, type Paginated, type PaymentMethod, type Sale } from "@/lib/types"

export function SalesPage() {
  const { can } = useAuth()
  const [from, setFrom] = useState(todayISO())
  const [to, setTo] = useState(todayISO())
  const [payment, setPayment] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<number | null>(null)
  const [ticketId, setTicketId] = useState<number | null>(null)

  const pagination = usePagination(20)
  const sales = useQuery({
    queryKey: ["sales", "list", from, to, payment, pagination.page, pagination.pageSize],
    queryFn: () =>
      api.get<Paginated<Sale> & { summary: { count: number; total: number } }>(
        `/sales${qs({ from, to, paymentMethod: payment, page: pagination.page, pageSize: pagination.pageSize })}`
      ),
    placeholderData: (prev) => prev,
  })
  const summary = sales.data?.summary

  return (
    <>
      <PageHeader
        title="Ventas"
        description="Historial de ventas con filtros por fecha y medio de pago."
        actions={
          can("ventas", "create") && (
            <Button nativeButton={false} render={<Link to="/ventas/nueva" />}>
              <PlusIcon data-icon="inline-start" />
              Nueva venta
            </Button>
          )
        }
      />

      <div className="flex flex-wrap items-end gap-4">
        <Field className="w-auto">
          <FieldLabel htmlFor="from">Desde</FieldLabel>
          <Input id="from" type="date" value={from} onChange={(e) => {
              setFrom(e.target.value)
              pagination.reset()
            }} />
        </Field>
        <Field className="w-auto">
          <FieldLabel htmlFor="to">Hasta</FieldLabel>
          <Input id="to" type="date" value={to} onChange={(e) => {
              setTo(e.target.value)
              pagination.reset()
            }} />
        </Field>
        <Field className="w-48">
          <FieldLabel htmlFor="payment">Medio de pago</FieldLabel>
          <SimpleSelect
            id="payment"
            value={payment}
            onValueChange={(v) => {
              setPayment(v)
              pagination.reset()
            }}
            items={[
              { label: "Todos", value: null },
              ...(Object.keys(PAYMENT_METHODS) as PaymentMethod[]).map((m) => ({
                label: PAYMENT_METHODS[m],
                value: m,
              })),
            ]}
          />
        </Field>
      </div>

      <Card className="py-0">
        {sales.isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : !sales.data?.items.length ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ReceiptIcon />
              </EmptyMedia>
              <EmptyTitle>Sin ventas en el período</EmptyTitle>
              <EmptyDescription>Cambiá el rango de fechas o registrá una venta nueva.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="hidden sm:table-cell">Vendedor</TableHead>
                <TableHead>Pago</TableHead>
                <TableHead className="hidden md:table-cell">Estado</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.data.items.map((s) => (
                <TableRow key={s.id} className="cursor-pointer" onClick={() => setDetailId(s.id)}>
                  <TableCell className="font-mono">{s.id}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDateTime(s.createdAt)}</TableCell>
                  <TableCell className="hidden sm:table-cell">{s.user.name}</TableCell>
                  <TableCell>{PAYMENT_METHODS[s.paymentMethod]}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant={s.status === "ANULADA" ? "destructive" : "outline"}>
                      {s.status === "ANULADA" ? "Anulada" : "Completada"}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className={
                      s.status === "ANULADA"
                        ? "text-right text-muted-foreground tabular-nums line-through"
                        : "text-right font-medium tabular-nums"
                    }
                  >
                    {formatMoney(s.total)}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Ticket de la venta ${s.id}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        setTicketId(s.id)
                      }}
                    >
                      <PrinterIcon />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={5}>
                  {summary?.count ?? 0} {summary?.count === 1 ? "venta completada" : "ventas completadas"} en el
                  período
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatMoney(summary?.total ?? 0)}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </Card>

      {sales.data && (
        <DataPagination
          page={sales.data.page}
          pageCount={sales.data.pageCount}
          pageSize={sales.data.pageSize}
          total={sales.data.total}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
          itemLabel="ventas"
        />
      )}

      {detailId && (
        <SaleDetailDialog
          id={detailId}
          onClose={() => setDetailId(null)}
          onTicket={() => {
            setDetailId(null)
            setTicketId(detailId)
          }}
        />
      )}
      {ticketId && <SaleTicketDialog id={ticketId} onClose={() => setTicketId(null)} />}
    </>
  )
}

function SaleDetailDialog({ id, onClose, onTicket }: { id: number; onClose: () => void; onTicket: () => void }) {
  const { can } = useAuth()
  const queryClient = useQueryClient()
  const [confirm, setConfirm] = useState(false)

  const sale = useQuery({
    queryKey: ["sales", "detail", id],
    queryFn: () => api.get<{ sale: Sale }>(`/sales/${id}`).then((r) => r.sale),
  })

  const cancel = useMutation({
    mutationFn: () => api.post(`/sales/${id}/cancel`),
    onSuccess: () => {
      toast.success(`Venta #${id} anulada. El stock fue repuesto.`)
      setConfirm(false)
      queryClient.invalidateQueries({ queryKey: ["sales"] })
      queryClient.invalidateQueries({ queryKey: ["stock"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })

  const s = sale.data

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Venta #{id}</DialogTitle>
            <DialogDescription>
              {s
                ? `${formatDateTime(s.createdAt)} · ${s.user.name} · ${PAYMENT_METHODS[s.paymentMethod]}`
                : "Cargando…"}
            </DialogDescription>
          </DialogHeader>
          {!s ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Cant.</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {s.items?.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      {item.variant.product.name}
                      <div className="text-xs text-muted-foreground">
                        {item.variant.size} / {item.variant.color} · {formatMoney(item.unitPrice)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{item.qty}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(item.subtotal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                {s.discount > 0 && (
                  <TableRow>
                    <TableCell colSpan={2}>Descuento</TableCell>
                    <TableCell className="text-right tabular-nums">−{formatMoney(s.discount)}</TableCell>
                  </TableRow>
                )}
                <TableRow>
                  <TableCell colSpan={2}>Total</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{formatMoney(s.total)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
          <DialogFooter>
            {s?.status === "ANULADA" && <Badge variant="destructive">Anulada</Badge>}
            {s?.status === "COMPLETADA" && can("ventas", "delete") && (
              <Button variant="destructive" onClick={() => setConfirm(true)}>
                Anular venta
              </Button>
            )}
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
            <Button disabled={!s} onClick={onTicket}>
              <PrinterIcon data-icon="inline-start" />
              Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`¿Anular la venta #${id}?`}
        description="Las prendas vuelven al stock y la venta deja de contar en los totales."
        confirmLabel="Anular"
        destructive
        pending={cancel.isPending}
        onConfirm={() => cancel.mutate()}
      />
    </>
  )
}
