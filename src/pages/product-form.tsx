import { useState, type FormEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate, useParams } from "react-router"
import { PlusIcon, SparklesIcon, Trash2Icon, WandSparklesIcon } from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { PageHeader } from "@/components/page-header"
import { SimpleSelect } from "@/components/simple-select"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"
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
import { Textarea } from "@/components/ui/textarea"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { api, qs } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { formatMoney } from "@/lib/format"
import type { Category, Product } from "@/lib/types"

type VariantDraft = {
  key: string
  id?: number
  size: string
  color: string
  sku: string
  stock: number
  minStock: number
}

let keySeq = 0
const newKey = () => `v${++keySeq}`

function previewVariantSku(base: string, color: string, size: string) {
  return [base || "SKU", slug(color).slice(0, 3), slug(size).slice(0, 6)].filter(Boolean).join("-")
}

function slug(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
}

export function ProductFormPage() {
  const { id } = useParams()

  const product = useQuery({
    queryKey: ["product", id],
    queryFn: () => api.get<{ product: Product }>(`/products/${id}`).then((r) => r.product),
    enabled: !!id,
  })

  if (id && product.isError) {
    return <p className="text-sm text-muted-foreground">{product.error.message}</p>
  }

  if (id && !product.data) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }

  // key: reinicia el formulario al cambiar de producto.
  return <ProductForm key={id ?? "new"} id={id} product={product.data ?? null} />
}

function ProductForm({ id, product }: { id?: string; product: Product | null }) {
  const isNew = !id
  const { can } = useAuth()
  const readOnly = isNew ? !can("productos", "create") : !can("productos", "edit")
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [name, setName] = useState(product?.name ?? "")
  // Vacío = SKU automático a partir del nombre.
  const [sku, setSku] = useState(product?.sku ?? "")
  const [description, setDescription] = useState(product?.description ?? "")
  const [price, setPrice] = useState(product ? String(product.price) : "")
  const [cost, setCost] = useState(product ? String(product.cost) : "")
  const [active, setActive] = useState(product?.active ?? true)
  const [categoryId, setCategoryId] = useState<string | null>(
    product?.categoryId ? String(product.categoryId) : null
  )
  const [variants, setVariants] = useState<VariantDraft[]>(
    () => product?.variants.map((v) => ({ ...v, key: newKey() })) ?? []
  )
  const [generatorOpen, setGeneratorOpen] = useState(false)
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<{ categories: Category[] }>("/categories").then((r) => r.categories),
  })

  const debouncedName = useDebouncedValue(name.trim(), 350)
  const suggestion = useQuery({
    queryKey: ["sku-suggestion", debouncedName, id],
    queryFn: () =>
      api
        .get<{ sku: string }>(`/products/sku-suggestion${qs({ name: debouncedName, excludeId: id })}`)
        .then((r) => r.sku),
    enabled: !sku && !!debouncedName,
    placeholderData: (prev) => prev,
  })
  const effectiveSku = sku || (debouncedName ? (suggestion.data ?? "") : "")

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name,
        sku: effectiveSku,
        description,
        price: Number(price) || 0,
        cost: Number(cost) || 0,
        active,
        categoryId: categoryId ? Number(categoryId) : null,
        variants: variants.map(({ key: _k, ...v }) => v),
      }
      return isNew ? api.post("/products", body) : api.patch(`/products/${id}`, body)
    },
    onSuccess: () => {
      toast.success(isNew ? "Producto creado" : "Producto actualizado")
      queryClient.invalidateQueries({ queryKey: ["products"] })
      queryClient.invalidateQueries({ queryKey: ["product", id] })
      queryClient.invalidateQueries({ queryKey: ["stock"] })
      navigate("/productos")
    },
  })

  const remove = useMutation({
    mutationFn: () => api.delete(`/products/${id}`),
    onSuccess: () => {
      toast.success("Producto eliminado")
      queryClient.invalidateQueries({ queryKey: ["products"] })
      navigate("/productos")
    },
  })

  function updateVariant(key: string, patch: Partial<VariantDraft>) {
    setVariants((prev) => prev.map((v) => (v.key === key ? { ...v, ...patch } : v)))
  }

  function addVariant(size = "", color = "") {
    setVariants((prev) => [
      ...prev,
      {
        key: newKey(),
        size,
        color,
        sku: "",
        stock: 0,
        minStock: 2,
      },
    ])
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!variants.length) {
      toast.error("Agregá al menos una variante (talle/color)")
      return
    }
    save.mutate()
  }

  const margin = Number(price) > 0 && Number(cost) > 0 ? ((Number(price) - Number(cost)) / Number(price)) * 100 : null

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <PageHeader
        title={isNew ? "Nuevo producto" : name || "Producto"}
        description={isNew ? "Cargá los datos y las variantes de talle y color." : `SKU ${effectiveSku}`}
        actions={
          <>
            {!isNew && can("productos", "delete") && (
              <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2Icon data-icon="inline-start" />
                Eliminar
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => navigate("/productos")}>
              Volver
            </Button>
            {!readOnly && (
              <Button type="submit" disabled={save.isPending}>
                {save.isPending && <Spinner data-icon="inline-start" />}
                Guardar
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Datos del producto</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldSet disabled={readOnly}>
              <FieldGroup>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field className="sm:col-span-2">
                    <FieldLabel htmlFor="p-name">Nombre</FieldLabel>
                    <Input id="p-name" required value={name} onChange={(e) => setName(e.target.value)} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="p-sku">SKU base</FieldLabel>
                    <InputGroup>
                      <InputGroupInput
                        id="p-sku"
                        className="font-mono uppercase"
                        placeholder="Automático"
                        value={effectiveSku}
                        onChange={(e) => setSku(e.target.value.toUpperCase())}
                      />
                      {sku && !readOnly && (
                        <InputGroupAddon align="inline-end">
                          <InputGroupButton size="icon-xs" onClick={() => setSku("")}>
                            <WandSparklesIcon />
                            <span className="sr-only">Generar automáticamente</span>
                          </InputGroupButton>
                        </InputGroupAddon>
                      )}
                    </InputGroup>
                    <FieldDescription>
                      {sku ? "SKU manual." : "Se genera del nombre. Podés editarlo."}
                    </FieldDescription>
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="p-desc">Descripción</FieldLabel>
                  <Textarea
                    id="p-desc"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="p-cat">Categoría</FieldLabel>
                    <div className="flex gap-2">
                      <SimpleSelect
                        id="p-cat"
                        className="flex-1"
                        value={categoryId}
                        onValueChange={setCategoryId}
                        items={[
                          { label: "Sin categoría", value: null },
                          ...(categories.data ?? []).map((c) => ({ label: c.name, value: String(c.id) })),
                        ]}
                      />
                      {can("productos", "create") && !readOnly && (
                        <Button type="button" variant="outline" size="icon" onClick={() => setCategoryOpen(true)}>
                          <PlusIcon />
                          <span className="sr-only">Nueva categoría</span>
                        </Button>
                      )}
                    </div>
                  </Field>
                  <Field orientation="horizontal" className="self-end">
                    <Switch id="p-active" checked={active} onCheckedChange={setActive} />
                    <FieldLabel htmlFor="p-active" className="font-normal">
                      Activo (se puede vender)
                    </FieldLabel>
                  </Field>
                </div>
              </FieldGroup>
            </FieldSet>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Precio</CardTitle>
            <CardDescription>Montos en pesos, sin centavos.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldSet disabled={readOnly}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="p-price">Precio de venta</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <InputGroupText>$</InputGroupText>
                    </InputGroupAddon>
                    <InputGroupInput
                      id="p-price"
                      type="number"
                      min={0}
                      step={1}
                      required
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                    />
                  </InputGroup>
                </Field>
                <Field>
                  <FieldLabel htmlFor="p-cost">Costo</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <InputGroupText>$</InputGroupText>
                    </InputGroupAddon>
                    <InputGroupInput
                      id="p-cost"
                      type="number"
                      min={0}
                      step={1}
                      value={cost}
                      onChange={(e) => setCost(e.target.value)}
                    />
                  </InputGroup>
                  {margin !== null && (
                    <FieldDescription>
                      Margen {margin.toFixed(0)}% · Ganancia {formatMoney(Number(price) - Number(cost))}
                    </FieldDescription>
                  )}
                </Field>
              </FieldGroup>
            </FieldSet>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Variantes</CardTitle>
          <CardDescription>
            Cada combinación de talle y color tiene su SKU (automático si lo dejás vacío) y stock.
            {!isNew && " El stock de variantes existentes se ajusta desde Stock."}
          </CardDescription>
          {!readOnly && (
            <CardAction className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setGeneratorOpen(true)}>
                <SparklesIcon data-icon="inline-start" />
                Generar
              </Button>
              <Button type="button" variant="outline" onClick={() => addVariant()}>
                <PlusIcon data-icon="inline-start" />
                Agregar
              </Button>
            </CardAction>
          )}
        </CardHeader>
        <CardContent>
          {variants.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Todavía no hay variantes. Usá “Generar” para crear todas las combinaciones de talles y colores.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Talle</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="w-24">Stock</TableHead>
                  <TableHead className="w-24">Mínimo</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {variants.map((v) => (
                  <TableRow key={v.key}>
                    <TableCell>
                      <Input
                        aria-label="Talle"
                        required
                        disabled={readOnly}
                        value={v.size}
                        onChange={(e) => updateVariant(v.key, { size: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        aria-label="Color"
                        required
                        disabled={readOnly}
                        value={v.color}
                        onChange={(e) => updateVariant(v.key, { color: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        aria-label="SKU"
                        disabled={readOnly}
                        className="font-mono uppercase"
                        placeholder={previewVariantSku(effectiveSku, v.color, v.size)}
                        value={v.sku}
                        onChange={(e) => updateVariant(v.key, { sku: e.target.value.toUpperCase() })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        aria-label="Stock"
                        type="number"
                        min={0}
                        disabled={readOnly || !!v.id}
                        value={v.stock}
                        onChange={(e) => updateVariant(v.key, { stock: Number(e.target.value) })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        aria-label="Stock mínimo"
                        type="number"
                        min={0}
                        disabled={readOnly}
                        value={v.minStock}
                        onChange={(e) => updateVariant(v.key, { minStock: Number(e.target.value) })}
                      />
                    </TableCell>
                    <TableCell>
                      {!readOnly && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setVariants((prev) => prev.filter((x) => x.key !== v.key))}
                        >
                          <Trash2Icon />
                          <span className="sr-only">Quitar variante</span>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {generatorOpen && (
        <VariantGenerator
          onClose={() => setGeneratorOpen(false)}
          onGenerate={(sizes, colors) => {
            const existing = new Set(variants.map((v) => `${v.size}|${v.color}`.toLowerCase()))
            for (const color of colors) {
              for (const size of sizes) {
                if (!existing.has(`${size}|${color}`.toLowerCase())) addVariant(size, color)
              }
            }
            setGeneratorOpen(false)
          }}
        />
      )}

      {categoryOpen && (
        <NewCategoryDialog
          onClose={() => setCategoryOpen(false)}
          onCreated={(c) => {
            setCategoryId(String(c.id))
            setCategoryOpen(false)
          }}
        />
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="¿Eliminar producto?"
        description="Se eliminan también sus variantes. Si tiene ventas, desactivalo en su lugar."
        confirmLabel="Eliminar"
        destructive
        pending={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </form>
  )
}

function splitList(value: string) {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

function VariantGenerator({
  onClose,
  onGenerate,
}: {
  onClose: () => void
  onGenerate: (sizes: string[], colors: string[]) => void
}) {
  const [sizes, setSizes] = useState("S, M, L, XL")
  const [colors, setColors] = useState("Negro, Verde oliva")
  const count = splitList(sizes).length * splitList(colors).length

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generar variantes</DialogTitle>
          <DialogDescription>Se crea una variante por cada combinación de talle y color.</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="g-sizes">Talles</FieldLabel>
            <Input id="g-sizes" value={sizes} onChange={(e) => setSizes(e.target.value)} />
            <FieldDescription>Separados por coma. Ej: 38, 40, 42 o S, M, L</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="g-colors">Colores</FieldLabel>
            <Input id="g-colors" value={colors} onChange={(e) => setColors(e.target.value)} />
            <FieldDescription>Ej: Negro, Coyote, Multicam</FieldDescription>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={count === 0}
            onClick={() => onGenerate(splitList(sizes), splitList(colors))}
          >
            Generar {count} variantes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function NewCategoryDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (c: Category) => void
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState("")
  const create = useMutation({
    mutationFn: () => api.post<{ category: Category }>("/categories", { name }),
    onSuccess: ({ category }) => {
      queryClient.invalidateQueries({ queryKey: ["categories"] })
      toast.success("Categoría creada")
      onCreated(category)
    },
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva categoría</DialogTitle>
          <DialogDescription>Ej: Calzado, Mochilas, Accesorios.</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="c-name">Nombre</FieldLabel>
          <Input
            id="c-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                if (name.trim()) create.mutate()
              }
            }}
          />
        </Field>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>
            {create.isPending && <Spinner data-icon="inline-start" />}
            Crear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
