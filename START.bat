@echo off
cls
echo ========================================
echo    ERP System v2.1 (CORRECTED)
echo ========================================
echo.
echo [1/3] Installing...
call npm install
echo.
echo [2/3] Starting...
start /B node server.js
echo.
echo [3/3] Opening browser...
timeout /t 3 >nul
start http://localhost:3000
echo.
echo ========================================
echo    System Running!
echo    Press Ctrl+C to stop
echo ========================================
pause
