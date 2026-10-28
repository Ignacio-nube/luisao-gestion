// Crea .env a partir de .env.example con una clave de sesión aleatoria (solo si no existe).
import { randomBytes } from "node:crypto"
import { existsSync, readFileSync, writeFileSync } from "node:fs"

if (existsSync(".env")) process.exit(0)
const env = readFileSync(".env.example", "utf8").replace(
  /JWT_SECRET=.*/,
  `JWT_SECRET="${randomBytes(48).toString("base64url")}"`
)
writeFileSync(".env", env)
console.log("Se creó el archivo .env con una clave nueva.")
