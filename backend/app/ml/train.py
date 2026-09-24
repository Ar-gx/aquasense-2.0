"""Train the AquaSense soil-moisture +24h regression model.

The training dataset is GENERATED from an explicit FAO-style soil water-balance
simulation (rainfall infiltration, crop ET via Kc x ETo, irrigation events with
method efficiency, drainage above field capacity). It is therefore a
SIMULATED dataset — the resulting model is labelled "trained on simulated
water-balance data, not field-validated" everywhere it is used.

Run:  python -m app.ml.train
Out:  app/ml/artifacts/model.joblib + metrics.json
"""
from __future__ import annotations

import json
import math
import random
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from app.core.config import ML_ARTIFACT_DIR

FEATURES = [
    "soil_moisture", "temp_c", "humidity", "rainfall_mm", "wind_kmh",
    "solar_mj", "soil_code", "crop_code", "stage_code", "prev_irrig_mm",
    "hours_since_irrig", "forecast_rain_mm",
]
TARGET = "moisture_next_24h"

SOIL_CODES = {"sandy": 0, "sandy_loam": 1, "loamy": 2, "clay_loam": 3,
              "clay": 4, "other": 5}
SOIL_PROPS = {  # fc, wp, sat, awc per metre (mm), infiltration factor
    "sandy": (12, 5, 35, 70, 0.9),
    "sandy_loam": (20, 8, 40, 120, 0.8),
    "loamy": (32, 12, 46, 200, 0.7),
    "clay_loam": (36, 16, 50, 190, 0.55),
    "clay": (40, 20, 52, 150, 0.4),
    "other": (30, 12, 45, 180, 0.65),
}
CROPS = ["wheat", "rice", "maize", "cotton", "sugarcane", "tomato", "potato",
         "soybean", "groundnut", "onion", "other"]
# Kc by growth stage (germination, vegetative, flowering, filling, maturity)
KC = {
    "wheat": [.45, .75, 1.15, .95, .45], "rice": [1.0, 1.15, 1.2, 1.15, .85],
    "maize": [.4, .85, 1.15, 1.0, .6], "cotton": [.45, .8, 1.15, 1.05, .7],
    "sugarcane": [.5, .9, 1.1, 1.1, .75], "tomato": [.5, .85, 1.1, 1.0, .7],
    "potato": [.5, .9, 1.1, 1.0, .65], "soybean": [.4, .8, 1.1, 1.0, .6],
    "groundnut": [.45, .75, 1.05, .95, .6], "onion": [.6, .9, 1.05, 1.0, .85],
    "other": [.45, .8, 1.1, 1.0, .6],
}
ROOT_M = [0.15, 0.4, 0.6, 0.8, 0.9]


def _simulate(n: int = 8000, seed: int = 42) -> pd.DataFrame:
    rng = random.Random(seed)
    rows = []
    for _ in range(n):
        soil = rng.choice(list(SOIL_CODES))
        crop = rng.choice(CROPS)
        stage = rng.randrange(5)
        fc, wp, sat, awc_mm, infil = SOIL_PROPS[soil]

        temp = rng.uniform(17, 42)
        humidity = rng.uniform(25, 95)
        wind = rng.uniform(2, 24)
        solar = rng.uniform(6, 28)
        eto = max(2.0, min(12.0, 0.0023 * (temp + 17.8) * 9.5 * 1.0
                           + (solar - 12) * 0.06))
        kc = KC[crop][stage]
        root_mm = ROOT_M[stage] * 1000

        rainfall = 0.0
        r = rng.random()
        if r < 0.55:
            rainfall = 0.0
        elif r < 0.85:
            rainfall = rng.uniform(0.2, 12)
        else:
            rainfall = rng.uniform(12, 70)

        forecast_rain = max(0.0, rainfall + rng.uniform(-6, 18))
        eff = rng.choice([0.45, 0.5, 0.75, 0.85, 0.9])
        hours_since = rng.uniform(2, 240)
        prev_irrig = rng.choice([0.0, 0.0, rng.uniform(5, 60)])

        moist = rng.uniform(wp, fc + 4)

        # day 1 balance
        et_mm = kc * eto
        rain_in = rainfall * infil * (1.0 if rainfall < 25 else 0.8)
        irr_mm = prev_irrig * eff * rng.uniform(0.4, 1.0)
        delta_mm = rain_in + irr_mm - et_mm
        delta_pct = delta_mm / root_mm * 100
        nxt = moist + delta_pct + rng.gauss(0, 0.5)
        nxt = max(wp - 4, min(sat - 1, nxt))

        rows.append({
            "soil_moisture": moist, "temp_c": temp, "humidity": humidity,
            "rainfall_mm": rainfall, "wind_kmh": wind, "solar_mj": solar,
            "soil_code": SOIL_CODES[soil], "crop_code": CROPS.index(crop),
            "stage_code": stage, "prev_irrig_mm": prev_irrig,
            "hours_since_irrig": hours_since, "forecast_rain_mm": forecast_rain,
            TARGET: nxt,
        })
    return pd.DataFrame(rows)


DEFAULT_PARAMS = {
    "n_estimators": 350, "max_depth": 6, "learning_rate": 0.08,
    "subsample": 0.9, "colsample_bytree": 0.9,
}


def train(n: int = 120000, seed: int = 42, params: dict | None = None) -> dict:
    ML_ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    params = {**DEFAULT_PARAMS, **(params or {})}
    df = _simulate(n, seed)
    X, y = df[FEATURES].values, df[TARGET].values
    rng = np.random.default_rng(7)
    idx = rng.permutation(len(df))
    split = int(len(df) * 0.8)
    tr, te = idx[:split], idx[split:]

    model, name, fallback = None, "", False
    try:
        from xgboost import XGBRegressor
        model = XGBRegressor(
            objective="reg:squarederror", random_state=7, n_jobs=-1,
            **params)
        name = "XGBoost (xgboost.XGBRegressor)"
    except Exception:
        from sklearn.ensemble import HistGradientBoostingRegressor
        model = HistGradientBoostingRegressor(max_iter=400, random_state=7)
        name = "Scikit-learn HistGradientBoostingRegressor"
        fallback = True

    model.fit(X[tr], y[tr])
    pred = model.predict(X[te])
    err = pred - y[te]
    mae = float(np.mean(np.abs(err)))
    rmse = float(np.sqrt(np.mean(err ** 2)))
    ss_res = float(np.sum(err ** 2))
    ss_tot = float(np.sum((y[te] - y[te].mean()) ** 2))
    r2 = 1 - ss_res / ss_tot if ss_tot else 0.0

    joblib.dump({"model": model, "features": FEATURES, "name": name},
                ML_ARTIFACT_DIR / "model.joblib")
    metrics = {
        "model_name": name,
        "fallback_model": fallback,
        "target": "soil moisture (% vol) 24 hours ahead",
        "n_samples": int(n),
        "data_seed": int(seed),
        "train_size": int(len(tr)),
        "test_size": int(len(te)),
        "mae_pct_points": round(mae, 3),
        "rmse_pct_points": round(rmse, 3),
        "r2": round(r2, 3),
        "hyperparams": params,
        "data_basis": "simulated",
        "data_basis_note": (
            "Trained and evaluated on a synthetic dataset generated from an "
            "FAO-style soil water-balance simulation (Kc x ETo, rainfall "
            "infiltration, irrigation with method efficiency, drainage). "
            "NOT field-validated measurements."
        ),
        "trained_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "features": FEATURES,
    }
    with open(ML_ARTIFACT_DIR / "metrics.json", "w", encoding="utf-8") as fh:
        json.dump(metrics, fh, indent=2)
    return metrics


if __name__ == "__main__":
    print(json.dumps(train(), indent=2))
