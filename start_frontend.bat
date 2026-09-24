@echo off
REM AquaSense AI — start frontend (Vite) on http://localhost:5173
cd /d "%~dp0frontend"
if not exist "node_modules" (
  echo Installing dependencies...
  call npm install
)
echo Starting AquaSense frontend on http://localhost:5173
call npm run dev
