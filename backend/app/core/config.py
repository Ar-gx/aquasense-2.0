"""Application configuration loaded from environment / .env file."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]  # backend/
DATA_DIR = BASE_DIR / "app" / "data"
ML_ARTIFACT_DIR = BASE_DIR / "app" / "ml" / "artifacts"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "AquaSense AI"
    app_version: str = "1.0.0"

    # Database — empty means SQLite fallback (hackathon friendly)
    database_url: str = ""

    # Live data sources (all optional — cascading fallbacks exist)
    openweather_api_key: str = ""
    data_gov_api_key: str = ""
    data_gov_rainfall_id: str = "6c05cd1b-ed59-40c2-bc31-e314f39c6971"
    data_gov_gw_id: str = "1de54e45-5df3-4626-9167-a4c8ad2309e0"
    data_gov_crop_id: str = "35be999b-0208-4354-b557-f6ca9a5355de"
    usda_nass_api_key: str = ""

    nasa_power_enabled: bool = True
    open_meteo_enabled: bool = True
    geocoder_enabled: bool = True

    force_simulated_weather: bool = False
    reference_cache_ttl: int = 21600

    # CORS for the Vite dev server
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    @property
    def resolved_database_url(self) -> str:
        if self.database_url and self.database_url.strip():
            return self.database_url
        return f"sqlite:///{BASE_DIR / 'aquasense.db'}"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
