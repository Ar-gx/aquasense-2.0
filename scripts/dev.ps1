# One-command dev startup for AquaSense AI
# Starts backend (8000) and frontend (5173) together; Ctrl+C stops both.
# Windows: powershell -ExecutionPolicy Bypass -File scripts\dev.ps1
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

# --- backend ---
$be = Start-Process powershell -PassThru -WindowStyle Minimized -ArgumentList @(
  "-NoExit", "-Command",
  "cd '$root\backend'; " +
  "if (-not (Test-Path .venv)) { python -m venv .venv }; " +
  ".\.venv\Scripts\Activate.ps1; " +
  "pip install -q -r requirements.txt; " +
  "uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"
)

# --- frontend ---
$fe = Start-Process powershell -PassThru -WindowStyle Minimized -ArgumentList @(
  "-NoExit", "-Command",
  "cd '$root\frontend'; " +
  "if (-not (Test-NodeModules)) {}; " +
  "if (-not (Test-Path node_modules)) { npm install }; " +
  "npm run dev"
)

Write-Host "Backend  PID $($be.Id)  -> http://127.0.0.1:8000  (docs: /docs)"
Write-Host "Frontend PID $($fe.Id)  -> http://localhost:5173"
Write-Host "Open http://localhost:5173 and click 'Try Demo Farm'."
Write-Host "Close the minimized windows (or Ctrl+C here) to stop."
