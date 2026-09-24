# Submission screenshot shot-list

Capture checklist for the AquaSense AI hackathon submission (PS-2B).
All app shots: browser window 1440×900, dark theme, logged-in state = demo farm
(load the demo first so every page has data).

## 1 — Hero & problem statement
- Open `http://localhost:5173/` — full landing page.
- Second shot: scroll to `#problem` section — the §2 problem statement table
  (irrigating by the calendar / waterlogging / invisible soil health).

## 2 — Zero-typing location picker
- Onboarding wizard → location step: browser geolocation prompt + reverse-geocode
  chip + place search + map click, and the **“I don’t know”** fallback options.

## 3 — Demo farm run (the money shot)
- Landing → **▶ Try the Demo Farm** → capture the **analysis overlay mid-run**
  (stages: weather → soil → crop → ML → optimization firing in sequence).
- Then the completed overlay → dashboard transition.

## 4 — Dashboard
- KPI row: baseline vs AI vs **saved litres** (separate rainwater bucket) and
  the 42.3 % reduction with its `model scenario` chip visible.
- Recommendation card showing its source chip (`hybrid ML + rules`).

## 5 — The 8 solutions (one shot each)
| # | Route | Highlight |
|---|---|---|
| 01 | `/crop-analysis` | stage timeline, flowering day 78/130, yield benchmark card with *“context only”* warning |
| 02 | `/irrigation` | if/when/how-much result, 05:00–08:00 window, efficiency selector |
| 03 | `/soil-health` | nutrient replenishment plan + waterlogging/leaching warnings |
| 04 | `/how-it-works` | modern irrigation methods (drip/sprinkler) comparison |
| 05 | `/water-analytics` | charts: irrigation vs rainwater vs saved (three separate buckets) |
| 06 | `/dashboard` warnings panel | active warning + why it fired |
| 07 | `/connect` | NGO cards with **official website links**, state + service filters |
| 08 | `/achievements` | earned vs locked achievements |

## 6 — Data honesty (judge bait)
- `/data` — source-chip legend (`live_api` / `historical_dataset` /
  `model_prediction` / `simulated`), AQUASTAT + NASS cards with 2024 yields,
  weather-cascade status panel.
- Hover a chart tooltip showing the per-value source label.

## 7 — Supporting evidence
- Terminal: `scripts\smoke_test.ps1` → **22/22 passing**.
- Terminal: `npx tsc -b` clean + `npm run build` success.
- `http://127.0.0.1:8000/docs` — interactive API docs.
- Optional: `backend/app/ml/artifacts/metrics.json` — MAE 0.714,
  R² 0.985 with `data_basis: simulated` visible.

## Honesty rules for every shot
- Never crop out a `simulated` / `estimated` / `model scenario` chip.
- Never present savings as metered field results — the label must be visible.
- Demo numbers to expect (pristine DB): baseline **12,500,000 L**, AI
  **7,217,666 L**, irrigation saved **2,782,334 L**, rainwater **2,500,000 L**,
  reduction **42.3 %**. Recommendation flips between *Irrigation Required* and
  *Monitor* depending on live weather — both are correct states.
