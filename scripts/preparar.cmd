@echo off
rem Deja todo listo para arrancar: dependencias, .env, base de datos y cliente de Prisma.
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Falta Node.js. Instalalo desde https://nodejs.org ^(version 22 o superior^) y volve a abrir este archivo.
  exit /b 1
)
if not exist node_modules (
  echo [1/4] Instalando dependencias, la primera vez tarda unos minutos...
  call npm install --no-fund --no-audit || exit /b 1
) else (
  echo [1/4] Dependencias OK
)
echo [2/4] Configuracion
node scripts\crear-env.mjs || exit /b 1
if not exist server\generated (
  call npx prisma generate || exit /b 1
)
echo [3/4] Base de datos
call npx prisma migrate deploy || exit /b 1
echo [4/4] Datos iniciales
call npx tsx prisma\seed.ts || exit /b 1
exit /b 0
