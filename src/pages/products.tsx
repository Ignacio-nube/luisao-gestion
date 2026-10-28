import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "react-router"
import { PlusIcon, SearchIcon, ShirtIcon } from "lucide-react"

import { DataPagination } from "@/components/data-pagination"
import { PageHeader } from "@/components/page-header"
import { SimpleSelect } from "@/components/simple-select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { usePagination } from "@/hooks/use-pagination"
import { api, qs } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { formatMoney } from "@/lib/format"
import type { Category, Paginated, Product } from "@/lib/types"

export function ProductsPage() {
  const { can } = useAuth()
  const navigate = useNavigate()
  const [q, setQ] = useState("")
  const [categoryId, setCategoryId] = useState<string | null>(null)

  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<{ categories: Category[] }>("/categories").then((r) => r.categories),
  })
  const pagination = usePagination(20)
  const products = useQuery({
    queryKey: ["products", q, categoryId, pagination.page, pagination.pageSize],
    queryFn: () =>
      api.get<Paginated<Product>>(
        `/products${qs({ q, categoryId, page: pagination.page, pageSize: pagination.pageSize })}`
      ),
    placeholderData: (prev) => prev,
  })

  return (
    <>
      <PageHeader
        title="Productos"
        description="Catálogo con variantes por talle y color."
        actions={
          can("productos", "create") && (
            <Button nativeButton={false} render={<Link to="/productos/nuevo" />}>
              <PlusIcon data-icon="inline-start" />
              Nuevo producto
            </Button>
          )
        }
      />

      <div className="flex flex-wrap gap-2">
        <InputGroup className="max-w-sm">
          <InputGroupInput
            placeholder="Buscar por nombre o SKU…"
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
        <SimpleSelect
          className="w-48"
          value={categoryId}
          onValueChange={(v) => {
            setCategoryId(v)
            pagination.reset()
          }}
          items={[
            { label: "Todas las categorías", value: null },
            ...(categories.data ?? []).map((c) => ({ label: c.name, value: String(c.id) })),
          ]}
        />
      </div>

      <Card className="py-0">
        {products.isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : !products.data?.items.length ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ShirtIcon />
              </EmptyMedia>
              <EmptyTitle>No hay productos</EmptyTitle>
              <EmptyDescription>
                {q || categoryId ? "Probá con otra búsqueda." : "Cargá el primer producto del catálogo."}
              </EmptyDescription>
            </EmptyHeader>
            {can("productos", "create") && !q && (
              <EmptyContent>
                <Button nativeButton={false} render={<Link to="/productos/nuevo" />}>
                  Nuevo producto
                </Button>
              </EmptyContent>
            )}
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead className="hidden md:table-cell">Categoría</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Variantes</TableHead>
                <TableHead className="text-right">Stock</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.data.items.map((p) => {
                const stock = p.variants.reduce((acc, v) => acc + v.stock, 0)
                const low = p.variants.some((v) => v.stock <= v.minStock)
                return (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/productos/${p.id}`)}
                  >
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {p.name} {!p.active && <Badge variant="outline">Inactivo</Badge>}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">{p.sku}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {p.category?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(p.price)}</TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">
                      {p.variants.length}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={low ? "destructive" : "secondary"} className="tabular-nums">
                        {stock}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {products.data && (
        <DataPagination
          page={products.data.page}
          pageCount={products.data.pageCount}
          pageSize={products.data.pageSize}
          total={products.data.total}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
          itemLabel="productos"
        />
      )}
    </>
  )
}
