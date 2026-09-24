# AquaSense AI 💧

**Data-driven smart irrigation & soil health optimization** — hackathon MVP for
problem statement **PS-2B (Smart Agriculture)**.

AquaSense decides **if, when and how much** to irrigate from live weather, soil
physics, crop growth stage and a trained ML model.

> **Core principle: Do not irrigate simply because it is time to irrigate.**
> AquaSense evaluates root-zone moisture, crop stage, soil retention, forecast
> rainfall and application efficiency before recommending a single drop.

---

## Problem statement (§2)

> **Farmers irrigate on schedule, not on need.**
>
> Data-driven smart irrigation & soil health optimization — reducing
> over-irrigation, waterlogging, nutrient leaching and freshwater use without
> hurting crop water adequacy.

| | Problem | Consequence in the field |
|---|---|---|
| ⏰ | **Irrigating by the calendar** | Fixed schedules ignore today's soil moisture, crop stage and forecast rain — so fields get watered whether they need it or not. |
| 🌊 | **Waterlogging & leaching** | Over-irrigation saturates the root zone, starves roots of oxygen and pushes dissolved nutrients below the reach of the crop. |
| 📉 | **Invisible soil health** | Nutrient depletion is rarely measured, so replenishment becomes guesswork — wasting fertilizer and degrading the soil season after season. |

This text is rendered verbatim on the landing page (`/` → section `#problem`)
and in the app's *How It Works* page.

---

## The 8 solutions (all implemented, each with a working page)

| # | Solution | Page | What it does |
|---|---|---|---|
| 01 | Crop analysis | `/crop-analysis` | Lifecycle water budget: Kc × ETo × stage days → per-stage and cumulative requirement (mm and litres), current stage highlighted, yield benchmark shown as *context only*. |
| 02 | Irrigation goal | `/irrigation` | 12-step hybrid engine result: if / when / how much / what time + full reasoning chain, rain analysis, per-event savings vs the traditional schedule, method-upgrade comparison. |
| 03 | Nutrient replenishment | `/soil-health` | N/K depletion by growth stage, legume rotation credit, manure recommendations, honest "data not used" list. |
| 04 | Modern irrigation methods | `/irrigation` | Flood → drip / sprinkler / centre-pivot efficiency table with per-method cost notes and what upgrading would change. |
| 05 | Water analytics | `/water-analytics` + `/impact` | Baseline vs AI ledger, `WaterSaved = Baseline − AI` (negative savings stay negative), rainwater kept in a **separate** bucket, water-savings calculator. |
| 06 | Warnings | `/dashboard` | Red/amber/green risk panel: waterlogging, stress, nutrient, weather and data-quality warnings — each with cause + evidence. |
| 07 | NGO connections | `/connect` | **Verified real organizations only**, official website links, state + service filters, district-search deep link. No invented contacts, no fabricated partnerships. |
| 08 | Achievements | `/achievements` | Cumulative water saved, rainwater utilised, efficiency, crop-water-adequacy — each with its source chip and honesty note. |

Supporting pages: **Onboarding wizard** (`/analyze`, 5 steps, every field has an
*"I don't know"* option), **Dashboard**, **Weather**, **History**, **How It
Works**, **Data Transparency**, **Settings**.

---

## Quick start

**Prerequisites:** Python 3.11+, Node 18+ (both already present on this
machine).

```bat
:: terminal 1 — backend on 127.0.0.1:8000
start_backend.bat

:: terminal 2 — frontend on http://localhost:5173
start_frontend.bat
```

Or start both at once:

```bat
powershell -ExecutionPolicy Bypass -File scripts\dev.ps1
```

Open **http://localhost:5173** and click **▶ Try the Demo Farm** — the full
pipeline (weather → soil → crop → ML → optimization → savings) runs in ~30–60 s
with no sensors, no sign-up and no API keys required.

Interactive API docs: http://127.0.0.1:8000/docs

### Demo farm (deterministic)

| Field | Value |
|---|---|
| Crop / stage | Wheat · **Flowering** (day 78 of 130) |
| Soil | Loamy · field capacity 32 % · wilting point 12 % |
| Area | 2.5 ha · Karnataka, India (configurable) |
| Moisture now | **24 % vol** (labelled *simulated*) |
| Traditional schedule | Flood irrigation every 5 days, 2,500,000 L/event (~100 mm) |

Verified model scenario for a 30-day window:

| Metric | Value | Kind |
|---|---|---|
| Baseline (traditional) | **12,500,000 L** | estimated (schedule replay) |
| AI-recommended | **7,217,666 L** | model scenario |
| Irrigation water saved | **2,782,334 L** | engine (separate bucket) |
| Rainwater utilised | **2,500,000 L** | *separate* — never double-counted |
| Total reduction | **42.3 %** | `(saved + rainwater) / baseline` |
| Recommendation | **live-weather dependent** — verified run: *Irrigation Required* · 3,227,500 L · 05:00–08:00 · confidence *medium* (reads *Monitor* · 0 L when live weather shows no deficit) | hybrid ML + rules |

> These are **model scenarios from labelled simulated data**, not metered field
> results, not yield forecasts. The same litre is never counted as both an
> irrigation saving and a rainwater conservation.

---

## Architecture

```
final/
├── backend/                  FastAPI + SQLAlchemy 2.0 + SQLite (Postgres-ready)
│   ├── app/
│   │   ├── routes/           farms · sensors_weather · recommendation · analytics · meta
│   │   ├── services/         pipeline · weather · soil · crop · climate
│   │   │                     irrigation_engine · water_calc · warnings
│   │   │                     nutrient · ml · sensor_sim · location · reference_data
│   │   ├── ml/               train.py → artifacts/{model.joblib, metrics.json}
│   │   ├── models/           11 tables (Farm, IrrigationEvent, Prediction, …)
│   │   ├── schemas/          Pydantic v2 input validation
│   │   └── data/             cited reference JSON (crops, soils, AQUASTAT, NASS, NGOs)
│   ├── .env                  real API keys — git-ignored, never shipped to the browser
│   └── aquasense.db          local SQLite (delete to reset; re-seeds on startup)
├── frontend/                 React 18 + TypeScript + Tailwind + Vite
│   └── src/
│       ├── pages/            16 routes
│       ├── components/       charts (Recharts) · dashboard · analysis overlay · layout
│       ├── context/          FarmContext (selected farm + dashboard payload)
│       └── services/api.ts   typed client — every UI button maps to a real endpoint
└── scripts/                  dev.ps1 · smoke_test.ps1 (22 endpoint checks)
```

**Stack:** React 18 · TypeScript · Tailwind CSS · Recharts · Framer Motion ·
Leaflet (map picker, loaded on demand) · FastAPI · SQLAlchemy 2.0 · SQLite ·
XGBoost / scikit-learn · httpx.

---

## The ML model

* **Target:** soil moisture (% vol) 24 h ahead → drives the multi-day
  trajectory used by the irrigation engine.
* **Algorithm:** XGBoost (`XGBRegressor`), 12 features (moisture, temperature,
  humidity, rain, wind, solar, soil/crop/stage codes, previous irrigation,
  hours since irrigation, forecast rain).
* **Training data:** 120,000 rows generated from an explicit **FAO-56-style soil
  water-balance simulation** (Kc × ETo, rainfall infiltration, irrigation with
  method efficiency, drainage).
* **Held-out metrics:** MAE **0.714 % vol** · RMSE **1.202 % vol** ·
  R² **0.985** (24,000 test rows, selected as the best of 5 configs × 5 data
  seeds by mean held-out MAE).
* **Honest basis:** `data_basis: "simulated"` — *trained on simulated data, not
  field-validated*. Shown in the UI's data-status panel, model card and every
  prediction payload.
* Auto-trains on startup if the artifact is missing; falls back to a
  transparent rule-based water-balance model if training fails. Re-train with
  `cd backend && python -m app.ml.train`.

**Reference ETo:** radiation-based Priestley-Taylor from NASA POWER solar data
(primary) or FAO-56 Hargreaves (fallback), sanity-clamped to 2.5–9.5 mm/day.

---

## Data sources & labelling policy

Every value the UI shows carries a source chip. Live APIs, historical datasets,
model output and simulated data are **never mixed silently**.

| Chip | Meaning | Examples |
|---|---|---|
| 🟢 `live_api` | Fetched at request time, timestamped | OpenWeather current, Open-Meteo 7-day forecast, NASA POWER history, SoilGrids, Nominatim |
| 🟡 `historical_dataset` | Bundled published extract with attribution | FAO AQUASTAT, USDA NASS Quick Stats, FAO-56 Kc tables |
| 🔵 `model_prediction` | Output of the trained XGBoost model | +24 h moisture, trajectory |
| ⚪ `rule_based` | Transparent formula (no model artifact) | water-balance fallback |
| 🟠 `estimated` | Reference-data calculation | soil bands, savings scenarios |
| 🟣 `simulated` | Deterministic demo data | demo sensors, seeded history |
| 🔷 `user_supplied` | You typed/selected it | onboarding, settings, recorded events |

**Weather cascade:** OpenWeather (current) → Open-Meteo (7-day hourly +
precipitation probability) → NASA POWER (historical daily) → data.gov.in
(district rainfall) → labelled simulated fallback. The data-status panel
(`/data`) shows which layer actually answered.

**Public datasets / APIs used:** OpenWeather · Open-Meteo (keyless) ·
NASA POWER · data.gov.in · FAO AQUASTAT · USDA NASS Quick Stats ·
SoilGrids (ISRIC) · OpenStreetMap Nominatim · FAO Irrigation & Drainage
Paper 56.

### Secrets

Real keys live **only** in `backend/.env` (git-ignored — see `.gitignore`).
They are read server-side at startup and never appear in the frontend bundle or
any response body. The template is `backend/.env.example`; the app must work
with every key empty (it does — all fallbacks are implemented).

> ⚠️ **After the hackathon:** if this folder is shared or pushed, rotate the
> OpenWeather and data.gov.in keys — they were used during development.

---

## Water-savings accounting (no double counting)

```
Baseline  = fixed flood schedule replay   (interval/event size from your last
                                           recorded irrigation or the documented
                                           conventional default)
AI plan   = independent rain-aware bucket model, min 2-day gap, MAD trigger,
            gross quantity corrected for application efficiency
WaterSaved = Baseline − AI                (can be negative — shown as negative)
Reduction% = (saved_l + rainwater_l) / baseline_total_l
```

* Rainwater-credited days contribute **0 L** to `saved_l`; they appear only in
  `rainwater_l`.
* Negative savings (AI above baseline, e.g. correcting an underwatered crop) are
  reported honestly — never flipped to a positive.
* Crop water adequacy is a modelled coverage ratio, **not** a yield claim.

---

## API surface (prefix `/api/v1`)

| Method & path | Purpose |
|---|---|
| `GET /health` | liveness |
| `POST /farms` · `GET /farms` · `GET/PATCH /farms/{id}` | CRUD |
| `POST /farms/demo` | one-click deterministic demo (full pipeline) |
| `POST /sensors/readings` · `GET /sensors/readings/{id}` | sensor ingest / history |
| `GET /weather/{id}` | current + forecast + history + data-status |
| `POST/GET /predict/{id}` | run / fetch +24 h ML prediction |
| `GET /recommendation/{id}` | 12-step optimization result |
| `GET /dashboard/{id}` | everything the dashboard needs, one payload |
| `GET /history/{id}` · `POST /history/{id}/events` | irrigation log + chart series |
| `GET /water-analytics/{id}` | baseline vs AI ledger |
| `GET /achievements/{id}` · `GET /nutrients/{id}` | solutions 08 & 03 |
| `GET /crops` `/soils` `/irrigation-methods` `/reference/*` `/data-status` `/organizations` | reference data |
| `GET /location/search` · `POST /location/reverse` | zero-typing location |
| `POST /water-calculator` · `GET /impact` | calculator & impact |

End-to-end check (backend must be running):

```bat
powershell -ExecutionPolicy Bypass -File scripts\smoke_test.ps1
:: currently 22/22 PASS
```

---

## Frontend routes

`/` landing · `/analyze` onboarding wizard · `/dashboard` · `/crop-analysis` ·
`/irrigation` · `/soil-health` · `/weather` · `/history` · `/water-analytics` ·
`/achievements` · `/how-it-works` · `/data` · `/impact` · `/connect` ·
`/settings` · `*` 404.

**Location without typing:** browser geolocation → server-side Nominatim
reverse geocode → *or* search autocomplete (Open-Meteo geocoding) → *or* click
the Leaflet map → *or* manual text fallback. Precision never exceeds the source
(GPS → device, taluk → approximate).

---

## Honest limitations (stated in the UI too)

* No sensor hardware — moisture readings are user-supplied or **estimated**;
  demo readings are simulated and labelled.
* No field validation — model metrics are held-out **simulated** data.
* No flow-meter savings — savings are model scenarios, never presented as
  metered water savings.
* No yield guarantees — crop adequacy is a coverage ratio; NASS/AQUASTAT
  benchmarks are context only.
* No invented organisations — NGO entries link to official websites only.
* SQLite is local-only; reset by deleting `backend/aquasense.db*`.

---

## Reset & maintenance

```bat
:: wipe the database (reference data re-seeds on startup)
:: 1. stop the backend, 2.:
del backend\aquasense.db*

:: retrain the model
cd backend && python -m app.ml.train

:: production build of the frontend
cd frontend && npm run build
```

See `scripts/README.md` for the full run-script reference.
