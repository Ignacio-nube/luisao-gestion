import type { MouseEvent } from "react"

import { SimpleSelect } from "@/components/simple-select"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { cn } from "@/lib/utils"

/** Páginas a mostrar: 1 … 4 5 [6] 7 8 … 20 */
function pageWindow(page: number, pageCount: number): (number | "…")[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1)
  const pages: (number | "…")[] = [1]
  const start = Math.max(2, page - 1)
  const end = Math.min(pageCount - 1, page + 1)
  if (start > 2) pages.push("…")
  for (let p = start; p <= end; p++) pages.push(p)
  if (end < pageCount - 1) pages.push("…")
  pages.push(pageCount)
  return pages
}

export function DataPagination({
  page,
  pageCount,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
  itemLabel = "registros",
  className,
}: {
  page: number
  pageCount: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
  pageSizeOptions?: number[]
  itemLabel?: string
  className?: string
}) {
  if (total === 0) return null

  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  const go = (p: number) => (e: MouseEvent) => {
    e.preventDefault()
    if (p >= 1 && p <= pageCount && p !== page) onPageChange(p)
  }

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3", className)}>
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>
          {from}–{to} de {total} {itemLabel}
        </span>
        {onPageSizeChange && (
          <SimpleSelect
            className="w-28"
            value={String(pageSize)}
            onValueChange={(v) => v && onPageSizeChange(Number(v))}
            items={pageSizeOptions.map((n) => ({ label: `${n} / pág.`, value: String(n) }))}
          />
        )}
      </div>
      {pageCount > 1 && (
        <Pagination className="mx-0 w-auto">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                text="Anterior"
                aria-label="Página anterior"
                aria-disabled={page <= 1}
                className={cn(page <= 1 && "pointer-events-none opacity-50")}
                onClick={go(page - 1)}
              />
            </PaginationItem>
            {pageWindow(page, pageCount).map((p, i) =>
              p === "…" ? (
                <PaginationItem key={`e${i}`} className="hidden sm:block">
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={p} className={cn(p !== page && "hidden sm:block")}>
                  <PaginationLink href="#" isActive={p === page} onClick={go(p)}>
                    {p}
                  </PaginationLink>
                </PaginationItem>
              )
            )}
            <PaginationItem>
              <PaginationNext
                href="#"
                text="Siguiente"
                aria-label="Página siguiente"
                aria-disabled={page >= pageCount}
                className={cn(page >= pageCount && "pointer-events-none opacity-50")}
                onClick={go(page + 1)}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  )
}
