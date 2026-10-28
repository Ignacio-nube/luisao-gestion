# LUISAO · Indumentaria táctica — Panel de gestión

Panel de administración del local: usuarios con roles y permisos, productos con variantes (talle/color), stock, ventas (caja) y dashboard.

**Stack:** Vite + React + shadcn/ui (Base UI, sidebar-07) · Express 5 + Prisma 7 + SQLite · sesión con cookie httpOnly (JWT).

## Uso rápido en Windows (doble clic)

| Archivo | Qué hace |
| --- | --- |
| `iniciar-luisao.bat` | Instala lo necesario la primera vez, prepara la base, compila el panel, lo levanta en http://localhost:3001 y abre el navegador. Para cerrarlo, cerrá la ventana. |
| `cargar-datos-ficticios.bat` | Carga datos de prueba en volumen: 10 cuentas del personal (contraseña `demo1234`), ~150 productos con ~2000 variantes y un año de ventas (~11.000) con sus movimientos de stock. Permite agregarlos o borrar productos/ventas y cargar de cero. |

Solo hace falta tener instalado [Node.js](https://nodejs.org) 22 o superior.

## Primer uso (desde la terminal)

```bash
npm install
cp .env.example .env        # y cambiá JWT_SECRET por una clave larga
npm run setup               # crea la base, genera el cliente y carga datos de ejemplo
npm run dev                 # API en :3001 + panel en http://localhost:5173
```

Usuario inicial: **admin / admin123**. El sistema pide cambiar la contraseña en el primer ingreso.

## Permisos

- Cada usuario tiene un **rol**; cada rol tiene permisos **Ver / Crear / Editar / Eliminar** por módulo
  (Dashboard, Productos, Stock, Ventas, Usuarios, Roles). Se editan en *Administración → Roles y permisos*.
- El rol **Admin** es del sistema: tiene todo y no se puede editar ni borrar.
- Los permisos se validan en el servidor en cada request; el menú lateral solo muestra lo permitido.
- Desde *Usuarios* el admin puede crear cuentas, cambiar rol, desactivar y **cambiar la contraseña de cualquier cuenta**
  (opcionalmente obligando a cambiarla al ingresar). Cambiar contraseña, rol o desactivar cierra las sesiones abiertas de ese usuario.
- Protecciones: no se puede desactivar/eliminar al último admin activo, ni desactivarse o borrarse a uno mismo.
  Solo un Admin puede crear/modificar a otros Admin.

## Productos y SKU

- El **SKU base** se genera solo a partir del nombre (iniciales + números completos):
  "Pantalón cargo ripstop" → `PCR`, "Mochila asalto 40 litros" → `MA40L`. Si ya existe se numera (`PCR-2`).
  Se puede escribir uno a mano; el botón de la varita vuelve al automático.
- Los SKU de variantes que se dejen vacíos se arman como `BASE-COLOR-TALLE` (ej. `MA40L-NEG-UNICO`).

## Listados

Usuarios, roles, productos, stock, movimientos, historial de ventas y el buscador de la caja están
paginados en el servidor (`?page=&pageSize=`), con selector de cantidad por página. En el historial,
el total del pie corresponde a todo el período filtrado, no solo a la página visible.

## Reportes y exportación

*Reportes* muestra todos los datos en tablas paginadas: ventas, ventas por producto, productos, stock
(valorizado a costo y a precio), movimientos de stock y usuarios. Tiene filtros por período y búsqueda,
y exporta **todo lo filtrado** (no solo la página visible) a **Excel** (con números y fechas reales,
filtros y encabezado fijo) o **PDF**. Requiere el permiso *Reportes → Ver* y además poder ver el módulo
de origen (por ejemplo, el reporte de usuarios solo lo ve quien puede ver Usuarios).

> En una base creada antes de esta versión, el rol Encargado no tiene Reportes: activalo en *Roles y permisos*.

## Caja y tickets

- En la caja, lo que se agrega al carrito se descuenta del stock que muestra la lista ("2 en carrito").
  El stock real de la base se descuenta recién al cobrar, así un carrito abandonado no deja prendas reservadas.
- Al cobrar se abre el **ticket** de la venta (formato 80 mm), listo para imprimir o guardar como PDF.
  También se puede reimprimir desde *Historial* (botón de impresora o detalle de la venta). Las anuladas salen con el sello "VENTA ANULADA".

## Scripts

| Script | Qué hace |
| --- | --- |
| `npm run dev` | API + Vite con recarga |
| `npm run build` | Typecheck y build del panel en `dist/` |
| `npm start` | Servidor que sirve la API y el panel compilado (puerto 3001) |
| `npm run db:migrate` | Nueva migración tras cambiar `prisma/schema.prisma` |
| `npm run db:seed` | Carga roles, admin y productos de ejemplo (no duplica) |
| `npm run db:studio` | Explorar la base en Prisma Studio |
| `npm run db:fake` | Datos ficticios (`-- --reset` borra productos y ventas antes; `-- --dias=180 --ventas-por-dia=50` ajusta el volumen) |

## Estructura

```
server/            API Express (auth, permisos, rutas por módulo, reportes)
scripts/           datos ficticios y preparación usada por los .bat
prisma/            schema, migraciones y seed (dev.db es la base SQLite)
src/components/    sidebar, layout y componentes shadcn (ui/)
src/pages/         pantallas del panel
src/lib/           cliente API, auth, tipos y formato (ARS)
```
