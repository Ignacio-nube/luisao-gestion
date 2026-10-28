@echo off
chcp 65001 >nul
title LUISAO - Datos ficticios
cd /d "%~dp0"
echo.
echo  Carga de datos ficticios (para pruebas y demos)
echo  ------------------------------------------------
echo  Crea personal, unos 150 productos con variantes y un anio de ventas.
echo.
echo   1. Agregar a los datos que ya hay
echo   2. BORRAR productos, ventas y stock actuales y cargar de cero
echo   3. Cancelar
echo.
choice /c 123 /n /m "Elegi una opcion [1-3]: "
if errorlevel 3 exit /b 0
set RESET=
if errorlevel 2 (
  echo.
  choice /c SN /n /m "Se van a borrar TODOS los productos, ventas y movimientos. Seguro? [S/N]: "
  if errorlevel 2 exit /b 0
  set RESET=--reset
)
echo.
call scripts\preparar.cmd || goto error
echo.
echo Generando datos, puede tardar un minuto...
call npx tsx scripts\datos-ficticios.ts %RESET% || goto error
echo.
echo  Listo. Abri el panel con iniciar-luisao.bat
pause
exit /b 0

:error
echo.
echo  Hubo un error. Revisa los mensajes de arriba.
pause
exit /b 1
