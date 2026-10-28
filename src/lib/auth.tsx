import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createContext, useCallback, useContext, useEffect, type ReactNode } from "react"
import { api, ApiError } from "@/lib/api"
import type { Action, AuthUser, Module } from "@/lib/types"

type AuthContextValue = {
  user: AuthUser | null
  loading: boolean
  login: (username: string, password: string) => Promise<AuthUser>
  logout: () => Promise<void>
  refresh: () => Promise<unknown>
  can: (module: Module, action?: Action) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

const ME_KEY = ["auth", "me"]

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ME_KEY,
    queryFn: async () => {
      try {
        return (await api.get<{ user: AuthUser }>("/auth/me")).user
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null
        throw e
      }
    },
    staleTime: 60_000,
    retry: false,
  })

  // Cualquier 401/403 de cambio de contraseña refresca el usuario (redirige vía guards).
  useEffect(() => {
    const handler = () => void refetch()
    window.addEventListener("auth:invalid", handler)
    return () => window.removeEventListener("auth:invalid", handler)
  }, [refetch])

  // No usar queryClient.clear(): elimina también la query del usuario y deja a este
  // provider observando una query huérfana, así que la UI no se entera del login.
  const resetData = useCallback(
    (user: AuthUser | null) => {
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== ME_KEY[0] })
      queryClient.setQueryData(ME_KEY, user)
    },
    [queryClient]
  )

  const login = useCallback(
    async (username: string, password: string) => {
      const { user } = await api.post<{ user: AuthUser }>("/auth/login", { username, password })
      resetData(user)
      return user
    },
    [resetData]
  )

  const logout = useCallback(async () => {
    await api.post("/auth/logout")
    resetData(null)
  }, [resetData])

  const user = data ?? null
  const can = useCallback(
    (module: Module, action: Action = "view") => !!user?.permissions[module][action],
    [user]
  )

  return (
    <AuthContext.Provider value={{ user, loading: isLoading, login, logout, refresh: refetch, can }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider")
  return ctx
}

export const meQueryKey = ME_KEY
