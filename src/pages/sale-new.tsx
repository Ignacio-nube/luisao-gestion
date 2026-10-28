import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { MinusIcon, PlusIcon, SearchIcon, ShoppingCartIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import { DataPagination } from "@/components/data-pagination"
import { PageHeader } from "@/components/page-header"
import { SaleTicketDialog } from "@/components/sale-ticket"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { usePagination } from "@/hooks/use-pagination"
import { api, qs } from "@/lib/api"
import { formatMoney } from "@/lib/format"
import {
  PAYMENT_METHODS,
  type Paginated,
  type PaymentMethod,
  type PosVariant,
  type Sale,
} from "@/lib/types"

type CartLine = { variant: PosVariant; qty: number }

export function NewSalePage() {
  const queryClient = useQueryClient()
  const [q, setQ] = useState("")
  const [cart, setCart] = useState<CartLine[]>([])
  const [discount, setDiscount] = useState("")
  const [payment, setPayment] = useState<PaymentMethod>("EFECTIVO")
  const [ticketId, setTicketId] = useState<number | null>(null)

  const pagination = usePagination(10)
  const results = useQuery({
    queryKey: ["pos-search", q, pagination.page, pagination.pageSize],
    queryFn: () =>
      api.get<Paginated<PosVariant>>(
        `/sales/search${qs({ q, page: pagination.page, pageSize: pagination.pageSize })}`
      ),
    placeholderData: (prev) => prev,
  })

  const subtotal = cart.reduce((acc, l) => acc + l.variant.product.price * l.qty, 0)
  const discountValue = Math.min(Number(discount) || 0, subtotal)
  const total = subtotal - discountValue

  // Lo que ya está en el carrito se descuenta del stock que muestra la lista.
  const inCart = new Map(cart.map((l) => [l.variant.id, l.qty]))
  const available = (v: PosVariant) => v.stock - (inCart.get(v.id) ?? 0)

  function add(variant: PosVariant) {
    // Mientras se cobra, el carrito se va a vaciar: no sumar ítems que se perderían.
    if (checkout.isPending) return
    setCart((prev) => {
      const line = prev.find((l) => l.variant.id === variant.id)
      const inCart = line?.qty ?? 0
      if (inCart >= variant.stock) {
        toast.warning(`No hay más stock de ${variant.product.name} ${variant.size}/${variant.color}`)
        return prev
      }
      return line
        ? prev.map((l) => (l.variant.id === variant.id ? { ...l, qty: l.qty + 1 } : l))
        : [...prev, { variant, qty: 1 }]
    })
  }

  function setQty(id: number, qty: number) {
    setCart((prev) =>
      prev.flatMap((l) => {
        if (l.variant.id !== id) return [l]
        if (qty <= 0) return []
        return [{ ...l, qty: Math.min(qty, l.variant.stock) }]
      })
    )
  }

  const checkout = useMutation({
    mutationFn: () =>
      api.post<{ sale: Sale }>("/sales", {
        items: cart.map((l) => ({ variantId: l.variant.id, qty: l.qty })),
        discount: discountValue,
        paymentMethod: payment,
      }),
    onSuccess: ({ sale }) => {
      toast.success(`Venta #${sale.id} registrada · ${formatMoney(sale.total)}`)
      setCart([])
      setDiscount("")
      setPayment("EFECTIVO")
      setTicketId(sale.id)
      queryClient.invalidateQueries({ queryKey: ["pos-search"] })
      queryClient.invalidateQueries({ queryKey: ["sales"] })
      queryClient.invalidateQueries({ queryKey: ["stock"] })
      queryClient.invalidateQueries({ queryKey: ["products"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })

  return (
    <>
      <PageHeader title="Nueva venta" description="Buscá productos, armá el carrito y cobrá." />

      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle>Productos</CardTitle>
            <CardDescription>Tocá una variante para sumarla al carrito.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <InputGroup>
              <InputGroupInput
                autoFocus
                placeholder="Buscar por nombre o escanear SKU…"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value)
                  pagination.reset()
                }}
                onKeyDown={(e) => {
                  // Lector de código de barras: Enter con coincidencia exacta de SKU.
                  if (e.key !== "Enter") return
                  const exact = results.data?.items.find((v) => v.sku === q.trim().toUpperCase())
                  if (exact) {
                    add(exact)
                    setQ("")
                  }
                }}
              />
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
            </InputGroup>

            {results.isLoading ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Variante</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.data?.items.map((v) => {
                    const left = available(v)
                    return (
                      <TableRow key={v.id}>
                        <TableCell className="font-medium">{v.product.name}</TableCell>
                        <TableCell>
                          {v.size} / {v.color}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(v.product.price)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={left <= 0 ? "destructive" : "secondary"} className="tabular-nums">
                            {left}
                          </Badge>
                          {left !== v.stock && (
                            <div className="text-xs text-muted-foreground">{v.stock - left} en carrito</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button size="icon-sm" disabled={left <= 0 || checkout.isPending} onClick={() => add(v)}>
                            <PlusIcon />
                            <span className="sr-only">Agregar</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
            {results.data && (
              <DataPagination
                page={results.data.page}
                pageCount={results.data.pageCount}
                pageSize={results.data.pageSize}
                total={results.data.total}
                onPageChange={pagination.setPage}
                onPageSizeChange={pagination.setPageSize}
                pageSizeOptions={[10, 20, 50]}
                itemLabel="variantes"
              />
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2 xl:self-start">
          <CardHeader>
            <CardTitle>Carrito</CardTitle>
            <CardDescription>
              {cart.length ? `${cart.reduce((a, l) => a + l.qty, 0)} prendas` : "Vacío"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {cart.length === 0 ? (
              <Empty className="border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ShoppingCartIcon />
                  </EmptyMedia>
                  <EmptyTitle>Carrito vacío</EmptyTitle>
                  <EmptyDescription>Agregá productos desde la lista.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="flex flex-col gap-3">
                {cart.map((l) => (
                  <div key={l.variant.id} className="flex items-center gap-2">
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">{l.variant.product.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {l.variant.size} / {l.variant.color} · {formatMoney(l.variant.product.price)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon-xs" variant="outline" onClick={() => setQty(l.variant.id, l.qty - 1)}>
                        <MinusIcon />
                        <span className="sr-only">Restar</span>
                      </Button>
                      <span className="w-6 text-center text-sm tabular-nums">{l.qty}</span>
                      <Button size="icon-xs" variant="outline" onClick={() => setQty(l.variant.id, l.qty + 1)}>
                        <PlusIcon />
                        <span className="sr-only">Sumar</span>
                      </Button>
                    </div>
                    <span className="w-24 text-right text-sm font-medium tabular-nums">
                      {formatMoney(l.variant.product.price * l.qty)}
                    </span>
                    <Button size="icon-xs" variant="ghost" onClick={() => setQty(l.variant.id, 0)}>
                      <Trash2Icon />
                      <span className="sr-only">Quitar</span>
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <Separator />

            <FieldGroup>
              <Field>
                <FieldLabel>Medio de pago</FieldLabel>
                <ToggleGroup
                  variant="outline"
                  className="flex-wrap"
                  value={[payment]}
                  onValueChange={(v) => v[0] && setPayment(v[0] as PaymentMethod)}
                >
                  {(Object.keys(PAYMENT_METHODS) as PaymentMethod[]).map((m) => (
                    <ToggleGroupItem key={m} value={m}>
                      {PAYMENT_METHODS[m]}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </Field>
              <Field>
                <FieldLabel htmlFor="discount">Descuento</FieldLabel>
                <InputGroup>
                  <InputGroupAddon>
                    <InputGroupText>$</InputGroupText>
                  </InputGroupAddon>
                  <InputGroupInput
                    id="discount"
                    type="number"
                    min={0}
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                  />
                </InputGroup>
              </Field>
            </FieldGroup>

            <div className="flex flex-col gap-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatMoney(subtotal)}</span>
              </div>
              {discountValue > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Descuento</span>
                  <span className="tabular-nums">−{formatMoney(discountValue)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{formatMoney(total)}</span>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              size="lg"
              className="w-full"
              disabled={cart.length === 0 || checkout.isPending}
              onClick={() => checkout.mutate()}
            >
              {checkout.isPending && <Spinner data-icon="inline-start" />}
              Cobrar {formatMoney(total)}
            </Button>
          </CardFooter>
        </Card>
      </div>

      {ticketId && <SaleTicketDialog id={ticketId} onClose={() => setTicketId(null)} />}
    </>
  )
}
