import re

from pydantic import BaseModel, Field, field_validator, model_validator


class NavAidDatabaseRecord(BaseModel):
    station_name: str
    ident: str
    aid_type: str
    frequency: str = Field(default="")
    hours_of_operation: str = Field(default="")
    elevation: str = Field(default="")
    remarks: str = Field(default="")
    raw_coordinates: str = Field(default="")
    geom_ewkt: str = Field(default="")

    @field_validator("station_name", "ident")
    @classmethod
    def validate_non_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Field cannot be empty")
        return v.strip()

    @field_validator("aid_type")
    @classmethod
    def validate_aid_type(cls, v: str) -> str:
        v_upper = v.strip().upper()
        if v_upper == "UNKNOWN":
            raise ValueError("Aid type cannot be UNKNOWN")
        return v.strip()

    @model_validator(mode="after")
    def validate_coordinates(self) -> "NavAidDatabaseRecord":
        if not self.geom_ewkt:
            raise ValueError("geom_ewkt cannot be empty")

        # Parse longitude and latitude from SRID=4326;POINT(lng lat)
        match = re.search(r"POINT\(([-\d.]+)\s+([-\d.]+)\)", self.geom_ewkt)
        if not match:
            raise ValueError(f"Invalid geom_ewkt format: {self.geom_ewkt}")

        lng_str, lat_str = match.groups()
        try:
            lng = float(lng_str)
            lat = float(lat_str)
        except ValueError as err:
            raise ValueError(
                f"Could not convert coordinates to float: {lng_str}, {lat_str}"
            ) from err

        if not (-90.0 <= lat <= 90.0):
            raise ValueError(f"Latitude must be between -90 and 90, got {lat}")
        if not (-180.0 <= lng <= 180.0):
            raise ValueError(f"Longitude must be between -180 and 180, got {lng}")

        return self
