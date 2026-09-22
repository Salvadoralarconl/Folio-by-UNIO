@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-office.ps1" %*
exit /b %errorlevel%
