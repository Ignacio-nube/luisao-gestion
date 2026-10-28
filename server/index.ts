import "dotenv/config"
import { existsSync } from "node:fs"
import { resolve } from "node:path"
import cookieParser from "cookie-parser"
import express from "express"
import { requireAuth, requirePasswordOk } from "./auth.ts"
import { errorHandler, HttpError } from "./http.ts"
import { authRouter } from "./routes/auth.ts"
import { dashboardRouter } from "./routes/dashboard.ts"
import { categoriesRouter, productsRouter } from "./routes/products.ts"
import { reportsRouter } from "./routes/reports.ts"
import { rolesRouter } from "./routes/roles.ts"
import { salesRouter } from "./routes/sales.ts"
import { stockRouter } from "./routes/stock.ts"
import { usersRouter } from "./routes/users.ts"

const app = express()
app.disable("x-powered-by")
app.use(express.json({ limit: "1mb" }))
app.use(cookieParser())

app.use("/api/auth", authRouter)

const api = express.Router()
api.use(requireAuth, requirePasswordOk)
api.use("/dashboard", dashboardRouter)
api.use("/users", usersRouter)
api.use("/roles", rolesRouter)
api.use("/products", productsRouter)
api.use("/categories", categoriesRouter)
api.use("/stock", stockRouter)
api.use("/sales", salesRouter)
api.use("/reports", reportsRouter)
app.use("/api", api)

app.use("/api", () => {
  throw new HttpError(404, "Ruta no encontrada")
})

// En producción el mismo servidor sirve el frontend compilado.
const dist = resolve(import.meta.dirname, "../dist")
if (existsSync(dist)) {
  app.use(express.static(dist))
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(resolve(dist, "index.html")))
}

app.use(errorHandler)

const port = Number(process.env.PORT ?? 3001)
app.listen(port, () => {
  console.log(`LUISAO API escuchando en http://localhost:${port}`)
})
