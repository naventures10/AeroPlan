import re
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator, model_validator


class NotamDatabaseRecord(BaseModel):
    notam_id: str
    source_file: str
    series: str
    scope: str = Field(default="UNKNOWN")
    fir: str | None = None
    combined_fir: str | None = None
    airport_icao: str | None = None
    valid_from: datetime | None = None
    valid_to: datetime | None = None
    is_permanent: bool = False
    is_estimated: bool = False
    duration_category: str = Field(default="UNKNOWN")
    description: str
    raw_json: dict[str, Any] = Field(default_factory=dict)

    @field_validator("notam_id")
    @classmethod
    def validate_notam_id(cls, v: str) -> str:
        v = v.strip()
        if not re.match(r"^[A-Za-z]\d{4}/\d{2}$", v):
            raise ValueError(f"Invalid NOTAM ID format: {v}")
        return v

    @field_validator("source_file")
    @classmethod
    def validate_non_empty_source(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("source_file cannot be empty")
        return v.strip()

    @field_validator("scope")
    @classmethod
    def validate_scope(cls, v: str) -> str:
        valid_scopes = {"INT_L", "INT_S", "DOM", "MIL_DOM", "GEN", "SNOWTAM", "UNKNOWN"}
        v_upper = v.strip().upper()
        if v_upper not in valid_scopes:
            raise ValueError(f"Invalid NOTAM scope: {v_upper}")
        return v_upper

    @field_validator("duration_category")
    @classmethod
    def validate_duration_category(cls, v: str) -> str:
        valid_categories = {"PERMANENT", "LONG DURATION", "TEMPORARY", "UNKNOWN"}
        v_upper = v.strip().upper()
        if v_upper not in valid_categories:
            raise ValueError(f"Invalid duration category: {v_upper}")
        return v_upper

    @field_validator("fir", "airport_icao")
    @classmethod
    def validate_icao(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v_upper = v.strip().upper()
        if not v_upper:
            return None
        # Split combined codes if any (though usually handled by combined_fir)
        for code in v_upper.split("/"):
            if not re.match(r"^[A-Z0-9]{4}$", code):
                raise ValueError(f"Invalid 4-character ICAO code: {code}")
        return v_upper

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("description cannot be empty")
        return v.strip()

    @model_validator(mode="after")
    def validate_logic(self) -> "NotamDatabaseRecord":
        # Check that valid_from is present if not permanent
        if not self.is_permanent and self.valid_from is None:
            raise ValueError("Non-permanent NOTAM must have a valid_from timestamp")
        return self
