@echo off
rem Doble clic: ejecuta EOS.py (abre sesiones de Claude listas para trabajar en In Transit).
title EOS - In Transit
where py >nul 2>nul
if %errorlevel%==0 (py -3 "%~dp0EOS.py" %*) else (python "%~dp0EOS.py" %*)
