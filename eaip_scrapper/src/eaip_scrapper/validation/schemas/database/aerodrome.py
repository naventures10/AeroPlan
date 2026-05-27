import re

from pydantic import BaseModel, field_validator

# Strict Regex for PostGIS EWKT (e.g., "SRID=4326;POINT(76.5 8.2)")
EWKT_REGEX = re.compile(r"^SRID=\d+;POINT\(-?\d+(?:\.\d+)? -?\d+(?:\.\d+)?\)$")


class SpatialFeature(BaseModel):
    icao_code: str
    feature_category: str
    feature_name: str
    elevation_m: float | None = None
    marking_lgt: str | None = None
    is_grouped: bool
    height_m: float | None = None
    geom: str | None = None

    @field_validator("geom")
    @classmethod
    def validate_geom(cls, v: str | None) -> str | None:
        if v and not EWKT_REGEX.match(v):
            raise ValueError(f"Invalid PostGIS EWKT format: '{v}'")
        return v


class ChartFeature(BaseModel):
    icao_code: str
    chart_title: str
    chart_index: str
    chart_url: str


class DatabaseValidator:
    @staticmethod
    def validate_spatial_features(tuples: list[tuple]):
        """Validates a list of spatial feature tuples right before DB insertion."""
        for t in tuples:
            SpatialFeature(
                icao_code=t[0],
                feature_category=t[1],
                feature_name=t[2],
                elevation_m=t[3],
                marking_lgt=t[4],
                is_grouped=t[5],
                height_m=t[6],
                geom=t[7],
            )

    @staticmethod
    def validate_chart_features(tuples: list[tuple]):
        """Validates a list of chart feature tuples right before DB insertion."""
        for t in tuples:
            ChartFeature(icao_code=t[0], chart_title=t[1], chart_index=t[2], chart_url=t[3])
