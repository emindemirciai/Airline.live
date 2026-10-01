@echo off
setlocal
cd /d "%~dp0"

echo.
echo ============================================================
echo   AI PROJECT - GITHUB + GOOGLE DRIVE BACKUP
echo ============================================================
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0push-and-backup.ps1"

echo.
echo ============================================================
echo   Pencereyi kapatmak icin bir tusa basin.
echo ============================================================
pause >nul
endlocal
