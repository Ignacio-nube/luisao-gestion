import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type SelectOption = { label: string; value: string | null }

/** Select de valores string con label, compuesto según la API de Base UI. */
export function SimpleSelect({
  id,
  value,
  onValueChange,
  items,
  className,
  invalid,
}: {
  id?: string
  value: string | null
  onValueChange: (value: string | null) => void
  items: SelectOption[]
  className?: string
  invalid?: boolean
}) {
  return (
    <Select items={items} value={value} onValueChange={(v) => onValueChange(v as string | null)}>
      <SelectTrigger id={id} className={className} aria-invalid={invalid || undefined}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {items.map((item) => (
            <SelectItem key={item.value ?? "__null"} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
