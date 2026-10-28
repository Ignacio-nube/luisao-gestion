import { prisma } from "./db.ts"

const STOP_WORDS = new Set(["de", "del", "la", "el", "los", "las", "y", "con", "para", "en", "x"])

export function skuPart(value: string, max = 6) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, max)
}

/** "Pantalón cargo ripstop" -> "PCR", "Borcego" -> "BOR", "Mochila 40 litros" -> "M40L". */
export function skuPrefix(name: string) {
  const words = name
    .split(/\s+/)
    .map((w) => skuPart(w))
    .filter((w, i) => w && (i === 0 || !STOP_WORDS.has(w.toLowerCase())))
  if (words.length === 0) return "PROD"
  if (words.length === 1) return words[0].slice(0, 3).padEnd(3, "X")
  // Las palabras numéricas (talles, litros, modelos) se mantienen completas.
  return words
    .slice(0, 4)
    .map((w) => (/^\d+$/.test(w) ? w.slice(0, 3) : w[0]))
    .join("")
}

/** SKU base libre para un producto nuevo. */
export async function suggestProductSku(name: string, excludeProductId?: number) {
  const base = skuPrefix(name)
  const taken = new Set(
    (
      await prisma.product.findMany({
        where: { sku: { startsWith: base }, ...(excludeProductId ? { id: { not: excludeProductId } } : {}) },
        select: { sku: true },
      })
    ).map((p) => p.sku)
  )
  if (!taken.has(base)) return base
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`
    if (!taken.has(candidate)) return candidate
  }
}

/** SKU de variante: BASE-COLOR-TALLE, con sufijo si ya existe. */
export function variantSku(base: string, color: string, size: string, taken: Set<string>) {
  const sku = [base, skuPart(color, 3), skuPart(size, 6)].filter(Boolean).join("-")
  let candidate = sku
  for (let n = 2; taken.has(candidate); n++) candidate = `${sku}-${n}`
  taken.add(candidate)
  return candidate
}

/** Normaliza un SKU escrito a mano: mayúsculas, sin acentos, solo letras, números y guiones. */
export function cleanSku(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 40)
}
