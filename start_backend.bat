@echo off
REM AquaSense AI — start backend (FastAPI) on 127.0.0.1:8000
cd /d "%~dp0backend"
if not exist ".venv" (
  echo Creating virtual environment...
  python -m venv .venv
  call .venv\Scripts\activate.bat
  pip install -r requirements.txt
) else (
  call .venv\Scripts\activate.bat
)
echo Starting AquaSense backend on http://127.0.0.1:8000  (docs at /docs)
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
