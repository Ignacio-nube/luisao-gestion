import bcrypt from "bcryptjs"
import { Router } from "express"
import { z } from "zod"
import {
  clearSessionCookie,
  loadAuthUser,
  requireAuth,
  setSessionCookie,
} from "../auth.ts"
import { prisma } from "../db.ts"
import { HttpError } from "../http.ts"

export const passwordSchema = z
  .string()
  .min(6, "La contraseña debe tener al menos 6 caracteres")
  .max(100)

export const authRouter = Router()

authRouter.post("/login", async (req, res) => {
  const { username, password } = z
    .object({ username: z.string().trim().min(1), password: z.string().min(1) })
    .parse(req.body)

  const user = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
  })
  const ok = user && (await bcrypt.compare(password, user.passwordHash))
  if (!user || !ok) throw new HttpError(401, "Usuario o contraseña incorrectos")
  if (!user.active) throw new HttpError(403, "La cuenta está desactivada. Hablá con el administrador.")

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
  await setSessionCookie(res, user)
  res.json({ user: await loadAuthUser(user.id) })
})

authRouter.post("/logout", (_req, res) => {
  clearSessionCookie(res)
  res.json({ ok: true })
})

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user })
})

/** El usuario logueado cambia su propia contraseña. */
authRouter.post("/change-password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = z
    .object({ currentPassword: z.string().min(1), newPassword: passwordSchema })
    .parse(req.body)

  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } })
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new HttpError(400, "La contraseña actual es incorrecta")
  }
  if (currentPassword === newPassword) {
    throw new HttpError(400, "La nueva contraseña debe ser distinta a la actual")
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(newPassword, 10),
      mustChangePassword: false,
      sessionVersion: { increment: 1 },
    },
  })
  // Cierra otras sesiones abiertas pero mantiene la actual.
  await setSessionCookie(res, updated)
  res.json({ user: await loadAuthUser(user.id) })
})
