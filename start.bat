@echo off
REM Massive Mobility Charging Simulator launcher
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0"

where npm >nul 2>&1
if errorlevel 1 (
  echo Node.js not found at "C:\Program Files\nodejs".
  echo Install from https://nodejs.org or fix the path in start.bat
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Installing dependencies...
  call npm run install:all
)

echo Starting Massive Mobility Charging Simulator...
echo   UI:  http://localhost:5173
echo   API: http://localhost:8787
call npm run dev
