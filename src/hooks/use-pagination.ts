import { useState } from "react"

/** Estado de página/tamaño. Usar `reset()` al cambiar filtros para volver a la página 1. */
export function usePagination(initialPageSize = 20) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSizeState] = useState(initialPageSize)

  return {
    page,
    pageSize,
    setPage,
    setPageSize: (size: number) => {
      setPageSizeState(size)
      setPage(1)
    },
    reset: () => setPage(1),
  }
}
