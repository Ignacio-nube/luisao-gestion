import { createPortal } from "react-dom"
import { useQuery } from "@tanstack/react-query"
import { PrinterIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import { formatDateTime, formatMoney } from "@/lib/format"
import { PAYMENT_METHODS, type Sale } from "@/lib/types"

export const ticketNumber = (id: number) => `0001-${String(id).padStart(8, "0")}`

/** Comprobante de una venta, igual en pantalla y en papel (80 mm). */
function Ticket({ sale }: { sale: Sale }) {
  const units = sale.items?.reduce((a, i) => a + i.qty, 0) ?? 0
  return (
    <div className="flex flex-col gap-3 font-mono text-xs">
      <div className="flex flex-col items-center text-center">
        <span className="text-base font-bold tracking-widest">LUISAO</span>
        <span>Indumentaria táctica</span>
      </div>
      <Separator />
      <div className="flex flex-col gap-0.5">
        <div className="flex justify-between">
          <span>Ticket</span>
          <span>{ticketNumber(sale.id)}</span>
        </div>
        <div className="flex justify-between">
          <span>Fecha</span>
          <span>{formatDateTime(sale.createdAt)}</span>
        </div>
        <div className="flex justify-between">
          <span>Atendió</span>
          <span>{sale.user.name}</span>
        </div>
      </div>
      {sale.status === "ANULADA" && (
        <div className="border border-current py-1 text-center font-bold tracking-widest">VENTA ANULADA</div>
      )}
      <Separator />
      <div className="flex flex-col gap-2">
        {sale.items?.map((item) => (
          <div key={item.id} className="flex flex-col">
            <span className="font-semibold">{item.variant.product.name}</span>
            <div className="flex justify-between gap-2">
              <span>
                {item.qty} x {formatMoney(item.unitPrice)} · {item.variant.size}/{item.variant.color}
              </span>
              <span>{formatMoney(item.subtotal)}</span>
            </div>
          </div>
        ))}
      </div>
      <Separator />
      <div className="flex flex-col gap-0.5">
        <div className="flex justify-between">
          <span>Subtotal ({units} {units === 1 ? "prenda" : "prendas"})</span>
          <span>{formatMoney(sale.subtotal)}</span>
        </div>
        {sale.discount > 0 && (
          <div className="flex justify-between">
            <span>Descuento</span>
            <span>−{formatMoney(sale.discount)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm font-bold">
          <span>TOTAL</span>
          <span>{formatMoney(sale.total)}</span>
        </div>
        <div className="flex justify-between">
          <span>Pago</span>
          <span>{PAYMENT_METHODS[sale.paymentMethod]}</span>
        </div>
      </div>
      <Separator />
      <div className="flex flex-col items-center text-center">
        <span>¡Gracias por tu compra!</span>
        <span>Cambios dentro de los 30 días con este ticket.</span>
        <span>Comprobante no válido como factura.</span>
      </div>
    </div>
  )
}

export function SaleTicketDialog({ id, onClose }: { id: number; onClose: () => void }) {
  const sale = useQuery({
    queryKey: ["sales", "detail", id],
    queryFn: () => api.get<{ sale: Sale }>(`/sales/${id}`).then((r) => r.sale),
  })
  const s = sale.data

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Ticket de la venta #{id}</DialogTitle>
          <DialogDescription>Imprimilo o guardalo como PDF desde el diálogo de impresión.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60svh] overflow-y-auto rounded-lg border p-4">
          {s ? <Ticket sale={s} /> : <Skeleton className="h-64 w-full" />}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          <Button disabled={!s} onClick={() => window.print()}>
            <PrinterIcon data-icon="inline-start" />
            Imprimir
          </Button>
        </DialogFooter>
      </DialogContent>
      {/* Copia fuera del diálogo: al imprimir solo se muestra esto (ver index.css). */}
      {s && createPortal(<div className="ticket-print"><Ticket sale={s} /></div>, document.body)}
    </Dialog>
  )
}
