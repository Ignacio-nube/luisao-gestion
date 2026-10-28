import type { RequestHandler, Response } from "express"
import { jwtVerify, SignJWT } from "jose"
import { prisma } from "./db.ts"
import { HttpError } from "./http.ts"
import {
  ADMIN_ROLE,
  buildPermissionSet,
  type Action,
  type Module,
  type PermissionSet,
} from "./permissions.ts"

export const COOKIE_NAME = "luisao_session"
const SESSION_DAYS = 7

if (!process.env.JWT_SECRET) {
  console.warn("⚠  JWT_SECRET no definido: usando una clave de desarrollo. Definilo en .env para producción.")
}
const secret = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "luisao-dev-secret-cambiar-en-produccion"
)

export type AuthUser = {
  id: number
  name: string
  username: string
  roleId: number
  roleName: string
  isAdmin: boolean
  mustChangePassword: boolean
  permissions: PermissionSet
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

export async function setSessionCookie(
  res: Response,
  user: { id: number; sessionVersion: number }
) {
  const token = await new SignJWT({ sv: user.sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret)

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    path: "/",
  })
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, { path: "/" })
}

export async function loadAuthUser(userId: number): Promise<AuthUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: { include: { permissions: true } } },
  })
  if (!user || !user.active) return null
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    roleId: user.roleId,
    roleName: user.role.name,
    isAdmin: user.role.name === ADMIN_ROLE,
    mustChangePassword: user.mustChangePassword,
    permissions: buildPermissionSet(user.role.name, user.role.permissions),
  }
}

/** Valida la cookie, que el usuario siga activo y que la sesión no haya sido invalidada. */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const token = req.cookies?.[COOKIE_NAME]
  if (!token) throw new HttpError(401, "No autenticado", "UNAUTHENTICATED")

  let userId: number
  let sv: number
  try {
    const { payload } = await jwtVerify(token, secret)
    userId = Number(payload.sub)
    sv = Number(payload.sv)
  } catch {
    throw new HttpError(401, "Sesión inválida o vencida", "UNAUTHENTICATED")
  }

  const current = await prisma.user.findUnique({
    where: { id: userId },
    select: { sessionVersion: true },
  })
  if (!current || current.sessionVersion !== sv) {
    throw new HttpError(401, "La sesión fue cerrada. Volvé a ingresar.", "UNAUTHENTICATED")
  }

  const user = await loadAuthUser(userId)
  if (!user) throw new HttpError(401, "Usuario inactivo", "UNAUTHENTICATED")
  req.user = user
  next()
}

/** Bloquea todo excepto el cambio de contraseña mientras sea obligatorio. */
export const requirePasswordOk: RequestHandler = (req, _res, next) => {
  if (req.user?.mustChangePassword) {
    throw new HttpError(403, "Tenés que cambiar tu contraseña antes de continuar", "MUST_CHANGE_PASSWORD")
  }
  next()
}

export function can(user: AuthUser | undefined, module: Module, action: Action) {
  return !!user?.permissions[module][action]
}

export function requirePermission(module: Module, action: Action): RequestHandler {
  return (req, _res, next) => {
    if (!can(req.user, module, action)) {
      throw new HttpError(403, "No tenés permiso para realizar esta acción", "FORBIDDEN")
    }
    next()
  }
}
