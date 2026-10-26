@echo off
chcp 65001 >nul
setlocal
set "PY=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
if not exist "%PY%" set "PY=python"
"%PY%" "%~dp0cargar_plantillas.py" %*
echo.
pause
