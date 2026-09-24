"""ML prediction service — loads the trained artifact, predicts soil moisture
+24h and builds multi-day trajectories. Degrades to a clearly-labelled
rule-based estimate when no model artifact exists."""
from __future__ import annotations

import json
from datetime import datetime
from functools import lru_cache

from app.core.config import ML_ARTIFACT_DIR
from app.ml.train import CROPS, FEATURES, SOIL_CODES, SOIL_PROPS, train

RULE = "rule_based_water_balance"


@lru_cache
def _artifact():
    path = ML_ARTIFACT_DIR / "model.joblib"
    if path.exists():
        try:
            import joblib
            art = joblib.load(path)
            return art
        except Exception:
            return None
    return None


def ensure_model() -> dict:
    """Train synchronously on first startup if the artifact is missing."""
    art = _artifact()
    if art is None:
        train()
        _artifact.cache_clear()
        art = _artifact()
    return metrics()


def metrics() -> dict:
    mpath = ML_ARTIFACT_DIR / "metrics.json"
    if mpath.exists():
        try:
            with open(mpath, encoding="utf-8") as fh:
                return json.load(fh
                                 )
        except Exception:
            pass
    return {
        "model_name": RULE, "data_basis": "unavailable",
        "note": "No trained model artifact found; rule-based estimates in use.",
    }


def _soil_code(soil: str | None) -> int:
    return SOIL_CODES.get((soil or "other").lower().replace(" ", "_"), 5)


def _crop_code(crop: str | None) -> int:
    c = (crop or "other").lower()
    return CROPS.index(c) if c in CROPS else CROPS.index("other")


def _feature_row(state: dict) -> list[float]:
    return [
        state.get("soil_moisture", 30.0),
        state.get("temp_c", 30.0),
        state.get("humidity", 60.0),
        state.get("rainfall_mm", 0.0),
        state.get("wind_kmh", 10.0),
        state.get("solar_mj", 18.0),
        _soil_code(state.get("soil_type")),
        _crop_code(state.get("crop")),
        int(state.get("stage_code", 2)),
        state.get("prev_irrig_mm", 0.0),
        state.get("hours_since_irrig", 72.0),
        state.get("forecast_rain_mm", 0.0),
    ]


def _rule_predict(state: dict) -> float:
    """Transparent bucket water balance — used only when no model exists."""
    soil = (state.get("soil_type") or "other").lower().replace(" ", "_")
    fc, wp, sat, _awc, infil = SOIL_PROPS.get(soil, SOIL_PROPS["other"])
    root_mm = 700
    kc = state.get("kc", 1.0)
    eto = state.get("eto_mm_day", 5.0)
    et = kc * eto
    rain = state.get("rainfall_mm", 0.0) + state.get("forecast_rain_mm", 0.0)
    irr = state.get("prev_irrig_mm", 0.0) * 0.6
    delta = (rain * infil + irr - et) / root_mm * 100
    return round(max(wp - 3, min(sat - 1, state.get("soil_moisture", 30.0) + delta)), 2)


def predict_24h(state: dict) -> dict:
    """Predict soil moisture 24 hours ahead from the current state."""
    art = _artifact()
    row = [_feature_row(state)]
    if art is not None:
        try:
            import numpy as np
            value = float(art["model"].predict(np.array(row))[0])
            m = metrics()
            return {
                "predicted_moisture_pct": round(value, 2),
                "horizon_hours": 24,
                "model_name": art.get("name", "trained_model"),
                "model_kind": "trained_simulated_data",
                "metrics": {k: m.get(k) for k in
                            ("mae_pct_points", "rmse_pct_points", "r2",
                             "n_samples", "data_basis")},
                "source": "model_prediction",
                "label": "Model prediction (trained on simulated water-balance data)",
            }
        except Exception:
            pass
    return {
        "predicted_moisture_pct": _rule_predict(state),
        "horizon_hours": 24,
        "model_name": RULE,
        "model_kind": "rule_based",
        "metrics": None,
        "source": "rule_based",
        "label": "Rule-based water-balance estimate (no trained model available)",
    }


def predict_trajectory(state: dict, daily_forecast: list[dict],
                       steps: int = 7) -> list[dict]:
    """Iterative 24h-step forecast out to `steps` days.

    Days beyond 72h are presented as extended outlook, not validated forecasts.
    """
    art = _artifact()
    out = []
    moist = float(state.get("soil_moisture", 30.0))
    now = datetime.utcnow()
    for step in range(1, steps + 1):
        fcst = daily_forecast[step - 1] if step - 1 < len(daily_forecast) else {}
        s = dict(state)
        s["soil_moisture"] = moist
        s["rainfall_mm"] = fcst.get("precip_mm", 0.0)
        s["forecast_rain_mm"] = fcst.get("precip_mm", 0.0)
        s["temp_c"] = fcst.get("temp_max_c", s.get("temp_c", 30))
        predicted = predict_24h(s)
        moist = predicted["predicted_moisture_pct"]
        out.append({
            "offset_hours": step * 24,
            "date": (now.replace(hour=9, minute=0, second=0, microsecond=0)
                     .isoformat(timespec="seconds")),
            "predicted_moisture_pct": moist,
            "forecast_rain_mm": fcst.get("precip_mm", 0.0),
            "forecast_prob_pct": fcst.get("precip_prob_pct", 0),
            "horizon_class": "short_range" if step <= 3 else "extended_outlook",
            "model_kind": predicted["model_kind"],
            "confidence": "medium" if step <= 3 else "low",
        })
    return out
