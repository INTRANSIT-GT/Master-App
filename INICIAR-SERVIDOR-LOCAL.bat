@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Servidor local - Master App (cierra esta ventana para detenerlo)
where node >nul 2>nul
if %errorlevel%==0 (
  echo Servidor local con Node.js en http://localhost:8080
  echo Deja esta ventana abierta mientras pruebas. Para detener: Ctrl+C o cerrar la ventana.
  start "" /b cmd /c "ping -n 5 127.0.0.1 >nul & start http://localhost:8080/prueba-visual.html"
  call npx --yes http-server . -p 8080 -c-1
  goto fin
)
where py >nul 2>nul
if %errorlevel%==0 (
  echo Servidor local con Python en http://localhost:8080
  start "" /b cmd /c "ping -n 5 127.0.0.1 >nul & start http://localhost:8080/prueba-visual.html"
  py -m http.server 8080
  goto fin
)
echo No se encontro Node.js ni Python.
echo Instala Node.js LTS desde https://nodejs.org y vuelve a ejecutar este archivo.
pause
:fin
