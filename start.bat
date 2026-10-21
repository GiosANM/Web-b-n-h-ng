@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 24 or newer from https://nodejs.org/
  pause
  exit /b 1
)
echo Starting Gio Studio. Open http://localhost:3000 in your browser.
echo Press Ctrl+C to stop the server.
node server/index.js
pause
