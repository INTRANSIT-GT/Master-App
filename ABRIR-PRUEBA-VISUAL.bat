@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Abriendo la prueba visual en tu navegador...
start "" "%~dp0prueba-visual.html"
