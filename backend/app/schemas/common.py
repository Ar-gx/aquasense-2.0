"""Pydantic request/response schemas — input validation for every endpoint."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

SoilType = Literal["sandy", "loamy", "clay", "sandy_loam", "clay_loam", "other"]
Stage = Literal["Germination", "Vegetative", "Flowering",
                "Fruiting / Grain Filling", "Maturity"]
Method = Literal["flood", "furrow", "sprinkler", "drip", "center_pivot",
                 "manual", "rainfed"]


class FarmCreate(BaseModel):
    name: str = "My Farm"
    crop_name: str = Field(..., min_length=1, max_length=60)
    custom_crop_name: str | None = Field(None, max_length=120)
    sowing_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    prev_irrigation_info: str | None = Field(None, max_length=500)

    # location (at least taluk)
    taluk: str | None = Field(None, max_length=120)
    district: str | None = Field(None, max_length=120)
    state: str | None = Field(None, max_length=120)
    latitude: float | None = Field(None, ge=-90, le=90)
    longitude: float | None = Field(None, ge=-180, le=180)
    location_precision: str = "approximate"

    # optional
    growth_stage: Stage | None = None
    area_ha: float | None = Field(None, gt=0, le=100000)
    soil_type: SoilType | None = None
    soil_moisture_pct: float | None = Field(None, ge=0, le=100)
    irrigation_method: Method | None = None
    last_irrigation_at: str | None = None
    last_irrigation_qty_l: float | None = Field(None, ge=0)
    soil_nutrients: dict | None = None
    previous_crop: str | None = Field(None, max_length=60)
    unknown_fields: list[str] = []
    budget_hint: Literal["low", "medium", "high"] | None = None

    @field_validator("crop_name")
    @classmethod
    def strip_crop(cls, v: str) -> str:
        return v.strip()


class FarmUpdate(BaseModel):
    name: str | None = None
    growth_stage: Stage | None = None
    area_ha: float | None = Field(None, gt=0, le=100000)
    soil_type: SoilType | None = None
    soil_moisture_pct: float | None = Field(None, ge=0, le=100)
    soil_moisture_source: Literal["user_supplied", "estimated",
                                   "simulated"] | None = None
    irrigation_method: Method | None = None
    last_irrigation_at: str | None = None
    last_irrigation_qty_l: float | None = Field(None, ge=0)
    prev_irrigation_info: str | None = None
    previous_crop: str | None = None
    soil_nutrients: dict | None = None
    unknown_fields: list[str] | None = None
    budget_hint: Literal["low", "medium", "high"] | None = None
    taluk: str | None = None
    district: str | None = None
    state: str | None = None
    latitude: float | None = Field(None, ge=-90, le=90)
    longitude: float | None = Field(None, ge=-180, le=180)
    location_precision: str | None = None


class SensorReadingCreate(BaseModel):
    farm_id: int
    soil_moisture_pct: float | None = Field(None, ge=0, le=100)
    soil_temp_c: float | None = Field(None, ge=-50, le=90)
    air_temp_c: float | None = Field(None, ge=-50, le=90)
    humidity_pct: float | None = Field(None, ge=0, le=100)
    rainfall_mm: float | None = Field(None, ge=0, le=1000)
    ts: datetime | None = None
    source: Literal["user_supplied", "live_api", "simulated"] = "user_supplied"


class IrrigationEventCreate(BaseModel):
    farm_id: int
    quantity_l: float = Field(..., ge=0, le=100_000_000)
    method: Method | None = None
    moisture_before: float | None = Field(None, ge=0, le=100)
    moisture_after: float | None = Field(None, ge=0, le=100)
    recommendation_followed: bool | None = None
    ts: datetime | None = None
    source: Literal["user_supplied", "simulated"] = "user_supplied"


class ReverseRequest(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


class CalculatorRequest(BaseModel):
    baseline_per_ha_l: float = Field(..., ge=0, le=10_000_000)
    ai_per_ha_l: float = Field(..., ge=0, le=10_000_000)
    area_ha: float = Field(..., ge=0, le=100000)


class PredictResponse(BaseModel):
    model_config = {"protected_namespaces": ()}

    farm_id: int
    horizon_hours: int
    predicted_moisture_pct: float
    model_name: str
    model_kind: str
    metrics: dict | None
    source: str
