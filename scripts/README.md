# AquaSense AI — run scripts

| Script | What it does |
| --- | --- |
| `start_backend.bat` | Creates `.venv` on first run, installs `requirements.txt`, starts FastAPI on `127.0.0.1:8000` with `--reload`. Docs at `http://127.0.0.1:8000/docs`. |
| `start_frontend.bat` | Installs `node_modules` on first run, starts Vite on `http://localhost:5173` (proxies `/api` → `:8000`). |
| `scripts\dev.ps1` | Starts both together in two minimized windows. |
| `scripts\smoke_test.ps1` | API-level end-to-end test of every endpoint the UI calls (run while backend is up). |

## Typical first run

```bat
:: terminal 1
start_backend.bat

:: terminal 2
start_frontend.bat

:: optional — verify the API surface
powershell -ExecutionPolicy Bypass -File scripts\smoke_test.ps1
```

Then open `http://localhost:5173` and click **Try Demo Farm**.

## Reset the database

Stop the backend and delete `backend\aquasense.db*` — reference data re-seeds on
next startup.

## Re-train the model

```bat
cd backend
python -m app.ml.train
```

Auto-trains on startup if the artifact is missing; falls back to the rule-based
water-balance model if training fails.
