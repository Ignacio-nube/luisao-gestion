import type { ErrorRequestHandler } from "express"
import { ZodError } from "zod"

export class HttpError extends Error {
  status: number
  code?: string

  constructor(status: number, message: string, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, code: err.code })
    return
  }
  if (err instanceof ZodError) {
    const first = err.issues[0]
    res.status(400).json({
      error: first ? `${first.path.join(".") || "dato"}: ${first.message}` : "Datos inválidos",
    })
    return
  }
  if (err?.code === "P2002") {
    res.status(409).json({ error: "Ya existe un registro con ese valor (duplicado)" })
    return
  }
  console.error(err)
  res.status(500).json({ error: "Error interno del servidor" })
}

export function parseId(value: unknown): number {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "ID inválido")
  return id
}

const MAX_PAGE_SIZE = 100

/** Lee ?page=&pageSize= y devuelve los valores listos para Prisma. */
export function parsePagination(query: Record<string, unknown>, defaultSize = 20) {
  const page = Math.max(1, Math.floor(Number(query.page)) || 1)
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Math.floor(Number(query.pageSize)) || defaultSize)
  )
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize }
}

export function paginated<T>(items: T[], total: number, p: { page: number; pageSize: number }) {
  return {
    items,
    total,
    page: p.page,
    pageSize: p.pageSize,
    pageCount: Math.max(1, Math.ceil(total / p.pageSize)),
  }
}
