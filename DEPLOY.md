# Deploying AquaSense AI 🌍

**Target stack (all free, works as a permanent public site):**

| Piece | Provider | Cost | Behaviour |
|---|---|---|---|
| Frontend (React SPA) | **Vercel** | $0 forever | Always on, instant loads, `*.vercel.app` HTTPS |
| Backend (FastAPI) | **Render** | $0 forever | Sleeps after 15 idle min → ~60 s cold start (keep-warm optional, step 5) |
| Database | **Neon Postgres** (optional) | $0 forever | Data survives redeploys/restarts. Without it the app runs on SQLite and **resets on every redeploy** |
| Live-weather keys | OpenWeather / data.gov.in | — | Optional — every source has a fallback |

The browser only ever talks to **one origin** (the Vercel URL). Vercel's
`rewrites` in `frontend/vercel.json` proxy `/api/*` to the Render backend, so
there is no CORS configuration, no mixed content and no hardcoded host in the
frontend bundle.

---

## 0. Prerequisites

* A GitHub account (repo already at `https://github.com/Ar-gx/aquasense-2.0`)
* A Render account (free, no credit card)
* A Vercel account (free, no credit card — sign in with GitHub)
* *(Optional, recommended for real data persistence)* a Neon account (free, no credit card)

---

## 1. Push the deployment config

Everything below is already written and needs to be on GitHub:

```bat
git add -A
git commit -m "Add Render + Vercel deployment config"
git push
```

Files involved:

| File | Purpose |
|---|---|
| `render.yaml` | Render Blueprint — provisions the backend automatically |
| `frontend/vercel.json` | `/api/*` → Render proxy + SPA deep-link fallback |
| `backend/requirements.txt` | `psycopg2-binary` driver + `sqlalchemy<2.1` pin (2.1 switched the Postgres driver) |
| `backend/app/db/session.py` | driver-explicit URL + connection pooling that survives DB restarts |
| `.github/workflows/keep-warm.yml` | keeps the API warm **and** fails if the database isn't ready |

---

## 2. Deploy the backend on Render

1. <https://dashboard.render.com> → **New → Blueprint** → connect the
   `aquasense-2.0` GitHub repo.
2. Render finds `render.yaml` and shows the service `aquasense-api`
   (root dir `backend`, start `uvicorn … --port $PORT`).
3. It prompts for the `sync: false` secrets. **Every one is optional** —
   leave blank and paste them later in *Environment* if you have them:
   `DATABASE_URL`, `OPENWEATHER_API_KEY`, `DATA_GOV_API_KEY`, `USDA_NASS_API_KEY`.
4. **Create Blueprint** → first build takes ~2–4 min (pip installs
   scikit-learn / xgboost / pandas).
5. Note your URL: `https://aquasense-api-ngg1.onrender.com` (Render appends a
   random suffix if the name is taken — copy the real one from the dashboard).

Verify: <https://aquasense-api-ngg1.onrender.com/api/v1/health> →
`{"status":"success","data":{"status":"healthy",…}}`
Interactive docs: <https://aquasense-api-ngg1.onrender.com/docs>

> The trained model ships in the repo (`backend/app/ml/artifacts/model.joblib`)
> so no training happens at deploy time. If the artifact were ever missing the
> backend auto-trains on boot, or falls back to the rule-based model.

---

## 3. Point the frontend at your Render URL

`frontend/vercel.json` must proxy to **your** Render host — already set to the
assigned URL:

```json
{ "source": "/api/:path*", "destination": "https://aquasense-api-ngg1.onrender.com/api/:path*" }
```

If you ever rename/recreate the Render service, update that destination and
push — otherwise every API call from the Vercel site 404s.

---

## 4. Deploy the frontend on Vercel

1. <https://vercel.com/new> → import `Ar-gx/aquasense-2.0`.
2. **Root Directory → `frontend`** (Edit button — this is the important step;
   it makes Vercel detect Vite and read `frontend/vercel.json`).
3. Leave the rest on auto-pilot: Framework **Vite**, Build `npm run build`,
   Output `dist`. → **Deploy**.
4. Open `https://<project>.vercel.app` → **▶ Try the Demo Farm**.

Verify the proxy end-to-end:
`https://<project>.vercel.app/api/v1/health` must return the same JSON as
step 2 (that request travelled Vercel → Render).

Deep links like `/dashboard` and `/irrigation` must render the app, not a 404 —
that is the second rewrite in `vercel.json`.

---

## 5. *(Optional)* Keep the backend awake

Without this, a visitor arriving after 15 quiet minutes waits ~60 s for Render
to wake the service.

The workflow in this repo is already scheduled (`*/10 * * * *`) and does two
things on every run:

1. Pings `/api/v1/health` so Render never spins down.
2. Fails if the payload says `database.ready: false` — a broken deploy turns
   the Actions tab red, which is free uptime *and* database monitoring.

Budget: Render grants **750 free instance-hours/month**; one always-on service
uses ~730–744. It fits **only while `aquasense-api` is your only always-on free
service** — a second one gets suspended. GitHub also auto-disables scheduled
workflows after 60 days of repo inactivity (re-enable from the Actions tab).

Cheaper alternative: do nothing and accept the occasional cold start, or pay
$7/mo on Render to remove spin-down entirely.

---

## 6. *(Optional but recommended)* Persistent database

Why: on the free plan Render has **no persistent disk**, so the SQLite file
wipes on every redeploy/restart. Reference data (crops, soils, NGOs) re-seeds
itself automatically, but visitor-created farms, events and predictions are
lost.

**Neon free Postgres is permanent** (0.5 GB, no expiry, no credit card):

1. <https://console.neon.tech> → create a project → copy the connection string
   (use the **pooled** one, it ends in `-pooler`, and keep `?sslmode=require`).
2. Render → `aquasense-api` → **Environment** → add
   `DATABASE_URL` = that string → **Save** (the service redeploys).
3. First boot creates all tables (`Base.metadata.create_all`) and seeds the
   reference data.

Check the logs for `AquaSense AI ready — DB: postgresql+psycopg2://…`.

> Not recommended: Render's own free Postgres **expires after 30 days**
> (14-day grace, then deletion). SQLite on Render free also resets — it has no
> disk. Neon is the only free option here with no expiry.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Vercel site loads but every API call 404s | `frontend/vercel.json` destination ≠ your real Render URL (step 3) |
| Deep link (`/dashboard`) returns 404 | `vercel.json` not committed, or **Root Directory** isn't `frontend` |
| Render build fails on pip | check `PYTHON_VERSION` is set to `3.11.9` in the service's Environment |
| **Deploy failed** but the build succeeded (`update_failed`, exit 1) | The app died at boot. Render *discards the logs of a dead deploy* — open `https://<your-api>/api/v1/health` and read `data.database.error`; it holds the full traceback. Root cause that hit this repo: **SQLAlchemy 2.1 (Sep 2026) made bare `postgresql://` mean psycopg3**, which wasn't installed → fixed by pinning `sqlalchemy<2.1` and naming `postgresql+psycopg2://` in code |
| `/health` returns 200 but `"ready": false` | Backend is up, database is not — `data.database.error` explains why. The keep-warm Action fails in this state so you get alerted |
| `could not connect to server` in Render logs | `DATABASE_URL` typo, or Neon paused — run the query again and it wakes in ~1 s |
| First page load takes ~60 s | Render free cold start — enable the keep-warm (step 5) |
| Weather shows *simulated* | expected without API keys — add `OPENWEATHER_API_KEY` (step 2) |

## Reset / maintenance

* Re-deploy: push to `main` (both platforms auto-deploy on push).
* Wipe the database: delete the Neon project's rows, or remove `DATABASE_URL`
  to fall back to ephemeral SQLite.
* Re-train the model: `cd backend && python -m app.ml.train`.
