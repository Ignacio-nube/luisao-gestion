export class ApiError extends Error {
  status: number
  code?: string

  constructor(status: number, message: string, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

type Method = "GET" | "POST" | "PATCH" | "DELETE"

async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new ApiError(res.status, data.error ?? "Error inesperado", data.code)
    if (err.code === "UNAUTHENTICATED" || err.code === "MUST_CHANGE_PASSWORD") {
      window.dispatchEvent(new CustomEvent("auth:invalid", { detail: err.code }))
    }
    throw err
  }
  return data as T
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {}),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
}

export function qs(params: Record<string, string | number | undefined | null | false>) {
  const s = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== false && v !== "") s.set(k, String(v))
  }
  const str = s.toString()
  return str ? `?${str}` : ""
}
