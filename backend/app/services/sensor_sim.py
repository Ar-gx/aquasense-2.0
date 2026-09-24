"""Deterministic simulated sensor history for farms without IoT hardware.

Everything produced here is SIMULATED and stored with source='simulated'
so no simulated reading can ever be mistaken for a live measurement.

Physics: daily bucket balance (rainfall infiltration, Kc x ETo crop ET,
irrigation at method efficiency), then the whole series is shifted so the
final reading lands exactly on the farm's declared current moisture.
"""
from __future__ import annotations

import random
from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from app.models import IrrigationEvent, SensorReading

INFIL = {"sandy": 0.9, "sandy_loam": 0.8, "loamy": 0.7, "clay_loam": 0.55,
         "clay": 0.4, "other": 0.65}


def generate_history(
    db: Session,
    farm_id: int,
    soil_type: str,
    area_ha: float,
    irrigation_method: str,
    method_eff: float,
    current_moisture: float,
    fc: float,
    wp: float,
    eto_mm_day: float,
    kc_now: float,
    days: int = 30,
    irrigation_interval: int = 5,
    irrigation_qty_l: float = 1_650_000,
) -> dict:
    existing = db.query(SensorReading).filter(
        SensorReading.farm_id == farm_id).count()
    if existing:
        return {"created": False, "reason": "history already present"}

    today = date.today()
    rng = random.Random(farm_id * 31)
    root_mm = 700.0
    infil = INFIL.get(soil_type, 0.65)

    # forward simulation of raw moisture
    raw: list[tuple[date, float, float, float, float]] = []
    moisture = fc - 3.0
    for i in range(days):
        d = today - timedelta(days=days - i)
        s = (farm_id * 977 + d.toordinal()) % 10_000
        rain = 0.0
        if s % 6 == 0:
            rain = round(4 + (s % 15) * 1.6, 1)
        elif s % 11 == 0:
            rain = round(20 + (s % 20) * 2.4, 1)
        tmean = round(23 + (s % 80) / 10.0, 1)
        humid = 48 + (s % 45)

        irrigated = (i % irrigation_interval == 0) and irrigation_qty_l > 0
        if irrigated:
            net_mm = (irrigation_qty_l * method_eff) / (area_ha * 10_000)
            moisture += net_mm / root_mm * 100
            moisture = min(moisture, fc + 2.0)  # excess drains away
        moisture += (rain * infil) / root_mm * 100
        moisture -= (kc_now * eto_mm_day) / root_mm * 100
        moisture = max(wp + 1.0, min(fc + 2.0, moisture))
        raw.append((d, moisture, tmean, rain, float(humid)))

    # shift so the final reading matches the farm's declared moisture
    shift = current_moisture - raw[-1][1]
    shifted = [(d, round(max(wp + 0.5, min(fc + 2.0, m + shift)), 1),
                t, r, h) for d, m, t, r, h in raw]

    for d, m, tmean, rain, humid in shifted:
        db.add(SensorReading(
            farm_id=farm_id,
            ts=datetime.combine(d, datetime.min.time()).replace(hour=9),
            soil_moisture_pct=m,
            soil_temp_c=round(tmean + 2.5, 1),
            air_temp_c=tmean,
            humidity_pct=humid,
            rainfall_mm=rain,
            source="simulated",
        ))
        if rain:
            db.add(SensorReading(
                farm_id=farm_id,
                ts=datetime.combine(d, datetime.min.time()).replace(hour=15),
                soil_moisture_pct=None,
                air_temp_c=round(tmean + 3.5, 1),
                humidity_pct=float(min(98, humid + 10)),
                rainfall_mm=rain, source="simulated"))

    # traditional irrigation events: every `interval` days, most recent
    # `last_offset` days ago is handled by the caller's quantity choice
    event_count = 0
    for k in range(1, days // irrigation_interval + 1):
        d = today - timedelta(days=k * irrigation_interval)
        if d <= today - timedelta(days=days):
            continue
        db.add(IrrigationEvent(
            farm_id=farm_id,
            ts=datetime.combine(d, datetime.min.time()).replace(hour=6, minute=30),
            quantity_l=irrigation_qty_l, method=irrigation_method,
            area_ha=area_ha, source="simulated"))
        event_count += 1
    db.commit()
    return {"created": True, "days": days, "irrigation_events": event_count,
            "source": "simulated"}
