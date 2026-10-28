@echo off
chcp 65001 >nul
title LUISAO - Gestion
cd /d "%~dp0"
echo.
echo  ==============================================
echo   LUISAO - Indumentaria tactica - Gestion
echo  ==============================================
echo.
call scripts\preparar.cmd || goto error

echo.
echo Compilando el panel...
call npm run build --silent || goto error

set PORT=3001
for /f "tokens=2 delims==" %%p in ('findstr /b "PORT=" .env') do set PORT=%%p
echo.
echo  Listo. El panel queda en http://localhost:%PORT%
echo  Para cerrarlo, cerra esta ventana.
echo.
rem Abre el navegador cuando el servidor ya este escuchando.
start "" /b cmd /c "timeout /t 4 /nobreak >nul & start http://localhost:%PORT%"
call npm start
goto :eof

:error
echo.
echo  Hubo un error. Revisa los mensajes de arriba.
pause
exit /b 1
