import re
from datetime import date, time

from pydantic import BaseModel, field_validator, model_validator


class DaylightRecord(BaseModel):
    airport_icao: str
    airport_name: str
    lat: float | None = None
    lon: float | None = None
    date: date
    twilight_from: time | None = None
    sunrise: time | None = None
    sunset: time | None = None
    twilight_to: time | None = None
    year: int

    @field_validator("airport_icao")
    @classmethod
    def validate_icao(cls, v: str) -> str:
        if not re.match(r"^[A-Z]{4}$", v):
            raise ValueError(f"Invalid ICAO code: {v}")
        return v

    @field_validator("airport_name")
    @classmethod
    def validate_airport_name(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Airport name cannot be empty")
        return v.strip()

    @field_validator("lat")
    @classmethod
    def validate_lat(cls, v: float | None) -> float | None:
        if v is not None and not (-90.0 <= v <= 90.0):
            raise ValueError(f"Latitude must be between -90 and 90, got {v}")
        return v

    @field_validator("lon")
    @classmethod
    def validate_lon(cls, v: float | None) -> float | None:
        if v is not None and not (-180.0 <= v <= 180.0):
            raise ValueError(f"Longitude must be between -180 and 180, got {v}")
        return v

    @model_validator(mode="after")
    def validate_year(self) -> "DaylightRecord":
        if self.date.year != self.year:
            raise ValueError(f"Year {self.year} does not match date year {self.date.year}")
        return self


class DaylightDatabaseValidator:
    @staticmethod
    def validate_metadata_record(metadata: dict) -> None:
        """Validates the raw metadata dictionary before SQL construction."""
        DaylightRecord(**metadata)
