"""AquaSense AI — database models.

Seven core tables required by the specification plus supporting tables for
nutrient recommendations, achievements, water-saving records and organizations.
PostgreSQL-compatible types only (JSON works on both SQLite and PostgreSQL).
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def utcnow() -> datetime:
    return datetime.utcnow()


class Farm(Base):
    __tablename__ = "farms"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), default="My Farm")
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)

    # --- required farmer inputs (spec section 5) ---
    crop_name: Mapped[str] = mapped_column(String(60))
    custom_crop_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    sowing_date: Mapped[str] = mapped_column(String(10))  # YYYY-MM-DD
    prev_irrigation_info: Mapped[str | None] = mapped_column(Text, nullable=True)

    # location — at least taluk precision
    taluk: Mapped[str | None] = mapped_column(String(120), nullable=True)
    district: Mapped[str | None] = mapped_column(String(120), nullable=True)
    state: Mapped[str | None] = mapped_column(String(120), nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    location_precision: Mapped[str] = mapped_column(String(30), default="approximate")

    # --- optional farm setup inputs ---
    growth_stage: Mapped[str | None] = mapped_column(String(40), nullable=True)
    area_ha: Mapped[float | None] = mapped_column(Float, nullable=True)
    soil_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    soil_moisture_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    soil_moisture_source: Mapped[str | None] = mapped_column(String(30), nullable=True)
    irrigation_method: Mapped[str | None] = mapped_column(String(40), nullable=True)
    last_irrigation_at: Mapped[str | None] = mapped_column(String(30), nullable=True)
    last_irrigation_qty_l: Mapped[float | None] = mapped_column(Float, nullable=True)
    soil_nutrients: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    previous_crop: Mapped[str | None] = mapped_column(String(60), nullable=True)
    unknown_fields: Mapped[list | None] = mapped_column(JSON, nullable=True)
    budget_hint: Mapped[str | None] = mapped_column(String(30), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow,
                                                 onupdate=utcnow)

    readings: Mapped[list["SensorReading"]] = relationship(
        back_populates="farm", cascade="all, delete-orphan")
    irrigation_events: Mapped[list["IrrigationEvent"]] = relationship(
        back_populates="farm", cascade="all, delete-orphan")


class SensorReading(Base):
    __tablename__ = "sensor_readings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    farm_id: Mapped[int] = mapped_column(ForeignKey("farms.id", ondelete="CASCADE"),
                                          index=True)
    ts: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    soil_moisture_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    soil_temp_c: Mapped[float | None] = mapped_column(Float, nullable=True)
    air_temp_c: Mapped[float | None] = mapped_column(Float, nullable=True)
    humidity_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    rainfall_mm: Mapped[float | None] = mapped_column(Float, nullable=True)
    # 'simulated' | 'user_supplied' | 'live_api'
    source: Mapped[str] = mapped_column(String(30), default="simulated")

    farm: Mapped["Farm"] = relationship(back_populates="readings")


class WeatherReading(Base):
    __tablename__ = "weather_readings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    farm_id: Mapped[int] = mapped_column(ForeignKey("farms.id", ondelete="CASCADE"),
                                          index=True)
    ts: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    kind: Mapped[str] = mapped_column(String(20), default="current")  # current|hourly|daily
    temp_c: Mapped[float | None] = mapped_column(Float, nullable=True)
    humidity_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    precip_mm: Mapped[float | None] = mapped_column(Float, nullable=True)
    precip_prob: Mapped[float | None] = mapped_column(Float, nullable=True)
    wind_kmh: Mapped[float | None] = mapped_column(Float, nullable=True)
    source: Mapped[str] = mapped_column(String(30), default="simulated")
    payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class IrrigationEvent(Base):
    __tablename__ = "irrigation_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    farm_id: Mapped[int] = mapped_column(ForeignKey("farms.id", ondelete="CASCADE"),
                                          index=True)
    ts: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    quantity_l: Mapped[float] = mapped_column(Float, default=0)
    method: Mapped[str | None] = mapped_column(String(40), nullable=True)
    area_ha: Mapped[float | None] = mapped_column(Float, nullable=True)
    moisture_before: Mapped[float | None] = mapped_column(Float, nullable=True)
    moisture_after: Mapped[float | None] = mapped_column(Float, nullable=True)
    recommendation_followed: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    source: Mapped[str] = mapped_column(String(30), default="simulated")

    farm: Mapped["Farm"] = relationship(back_populates="irrigation_events")


class Prediction(Base):
    __tablename__ = "predictions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    farm_id: Mapped[int] = mapped_column(ForeignKey("farms.id", ondelete="CASCADE"),
                                          index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    horizon_hours: Mapped[int] = mapped_column(Integer, default=24)
    predicted_moisture_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    actual_moisture_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    model_name: Mapped[str] = mapped_column(String(80), default="demo_model")
    model_kind: Mapped[str] = mapped_column(String(30), default="demo")  # trained|demo|rule_based
    metrics: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    features: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    trajectory: Mapped[list | None] = mapped_column(JSON, nullable=True)
    source: Mapped[str] = mapped_column(String(30), default="model_prediction")


class Recommendation(Base):
    __tablename__ = "recommendations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    farm_id: Mapped[int] = mapped_column(ForeignKey("farms.id", ondelete="CASCADE"),
                                          index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    irrigation_required: Mapped[bool] = mapped_column(Boolean, default=False)
    recommended_at: Mapped[str | None] = mapped_column(String(60), nullable=True)
    quantity_l: Mapped[float | None] = mapped_column(Float, nullable=True)
    quantity_l_per_ha: Mapped[float | None] = mapped_column(Float, nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    confidence: Mapped[str | None] = mapped_column(String(20), nullable=True)
    payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    source: Mapped[str] = mapped_column(String(30), default="rule_based")


class CropParameter(Base):
    """Static crop reference rows (seeded from crops.json)."""
    __tablename__ = "crop_parameters"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    crop: Mapped[str] = mapped_column(String(60), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(60))
    lifespan_days: Mapped[int] = mapped_column(Integer)
    base_kc: Mapped[float] = mapped_column(Float, default=0.5)
    total_water_req_mm: Mapped[float | None] = mapped_column(Float, nullable=True)
    stages: Mapped[list] = mapped_column(JSON, default=list)
    nutrient_demand: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    source: Mapped[str] = mapped_column(String(30), default="historical_dataset")


class NutrientRecommendation(Base):
    __tablename__ = "nutrient_recommendations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    farm_id: Mapped[int] = mapped_column(ForeignKey("farms.id", ondelete="CASCADE"),
                                          index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    estimated_depletion: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    legumes: Mapped[list | None] = mapped_column(JSON, nullable=True)
    manures: Mapped[list | None] = mapped_column(JSON, nullable=True)
    compatibility_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    warning: Mapped[str | None] = mapped_column(Text, nullable=True)
    explanation: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    source: Mapped[str] = mapped_column(String(30), default="estimated")


class WaterSavingRecord(Base):
    __tablename__ = "water_saving_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    farm_id: Mapped[int] = mapped_column(ForeignKey("farms.id", ondelete="CASCADE"),
                                          index=True)
    date: Mapped[str] = mapped_column(String(10), index=True)  # YYYY-MM-DD
    baseline_l: Mapped[float] = mapped_column(Float, default=0)
    ai_l: Mapped[float] = mapped_column(Float, default=0)
    saved_l: Mapped[float] = mapped_column(Float, default=0)
    rainwater_l: Mapped[float] = mapped_column(Float, default=0)
    source: Mapped[str] = mapped_column(String(30), default="estimated")


class Achievement(Base):
    __tablename__ = "achievements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    farm_id: Mapped[int] = mapped_column(ForeignKey("farms.id", ondelete="CASCADE"),
                                          index=True)
    metric: Mapped[str] = mapped_column(String(60), index=True)
    label: Mapped[str] = mapped_column(String(120))
    value: Mapped[float] = mapped_column(Float, default=0)
    unit: Mapped[str] = mapped_column(String(30), default="")
    history: Mapped[list | None] = mapped_column(JSON, nullable=True)
    source: Mapped[str] = mapped_column(String(30), default="estimated")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow,
                                                 onupdate=utcnow)


class Organization(Base):
    """Verified real organizations only — website links, no fabricated contacts."""
    __tablename__ = "organizations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    org_type: Mapped[str] = mapped_column(String(60), default="NGO")
    states: Mapped[list] = mapped_column(JSON, default=list)
    services: Mapped[list] = mapped_column(JSON, default=list)
    website: Mapped[str | None] = mapped_column(String(300), nullable=True)
    verified: Mapped[bool] = mapped_column(Boolean, default=True)
    source: Mapped[str] = mapped_column(String(30), default="historical_dataset")
