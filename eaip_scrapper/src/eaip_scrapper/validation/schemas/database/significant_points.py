"""Strict database validation schemas for Significant Points.

These schemas enforce data integrity constraints **before** rows are inserted
into the ``significant_points`` PostGIS table.
"""

import re

from pydantic import BaseModel, Field, field_validator

# EWKT pattern: SRID=4326;POINT(<lng> <lat>)
_EWKT_PATTERN = re.compile(
    r"^SRID=4326;POINT\("
    r"(-?\d{1,3}\.\d+) "  # longitude
    r"(-?\d{1,2}\.\d+)"  # latitude
    r"\)$"
)


class SignificantPointRecord(BaseModel):
    """Validates a row destined for the ``significant_points`` table."""

    waypoint_name: str
    routes: list[str] = Field(default_factory=list)
    raw_coordinates: str
    geom: str | None = None  # EWKT string

    @field_validator("waypoint_name")
    @classmethod
    def validate_waypoint_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("waypoint_name cannot be empty")
        # Standard waypoints are uppercase letters, usually 5 chars, but we allow 3-5 just in case.
        if not v.isalpha() or not v.isupper() or not (3 <= len(v) <= 5):
            raise ValueError(
                f"Invalid waypoint name format: '{v}'. Expected 3-5 uppercase letters."
            )
        return v

    @field_validator("geom")
    @classmethod
    def validate_geom_ewkt(cls, v: str | None) -> str | None:
        if v is None:
            return v
        match = _EWKT_PATTERN.match(v)
        if not match:
            raise ValueError(
                f"Invalid EWKT geometry: '{v}'. Expected format: SRID=4326;POINT(<lng> <lat>)"
            )
        try:
            lon = float(match.group(1))
            lat = float(match.group(2))
        except (ValueError, TypeError) as err:
            raise ValueError(f"Invalid EWKT geometry coordinates: '{v}'") from err

        if not (-180.0 <= lon <= 180.0 and -90.0 <= lat <= 90.0):
            raise ValueError(f"Coordinates out of bounds: lon={lon}, lat={lat}")
        return v


class SignificantPointsDatabaseValidator:
    """Static helpers for validating raw tuples before DB insertion."""

    @staticmethod
    def validate_point_params(params: tuple) -> SignificantPointRecord:
        """Validate the 4-element tuple used in ``execute_values``."""
        if len(params) != 4:
            raise ValueError(f"Expected 4 point params, got {len(params)}")
        return SignificantPointRecord(
            waypoint_name=params[0],
            routes=params[1],
            raw_coordinates=params[2],
            geom=params[3],
        )

    @classmethod
    def validate_all(cls, points: list[tuple]) -> None:
        """Validate complete ETL output before database insertion."""
        for p in points:
            cls.validate_point_params(p)
