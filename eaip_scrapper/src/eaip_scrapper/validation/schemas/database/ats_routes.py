"""Strict database validation schemas for ATS Route tables.

These schemas enforce data integrity constraints **before** rows are inserted
into ``ats_routes``, ``ats_route_waypoints``, and ``ats_route_segments``.
They are intentionally strict to prevent data corruption in PostGIS.
"""

import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator

# ------------------------------------------------------------------
# ats_routes
# ------------------------------------------------------------------


class ATSRouteRecord(BaseModel):
    """Validates a row destined for the ``ats_routes`` table."""

    route_id: str
    route_designator: str = Field(default="")
    route_type: Literal["CONVENTIONAL", "RNAV"]
    remarks: str = Field(default="")

    @field_validator("route_id")
    @classmethod
    def validate_route_id(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("route_id cannot be empty")
        # ATS route IDs are alphanumeric designators like "A201", "W15", "Q1"
        if not re.match(r"^[A-Z]{1,3}\d{1,4}[A-Z]?$", v):
            raise ValueError(
                f"Invalid ATS route ID format: '{v}'. Expected pattern like 'A201', 'W15', 'Q1'."
            )
        return v


# ------------------------------------------------------------------
# ats_route_waypoints
# ------------------------------------------------------------------

# EWKT pattern: SRID=4326;POINT(<lng> <lat>)
_EWKT_PATTERN = re.compile(
    r"^SRID=4326;POINT\("
    r"(-?\d{1,3}\.\d+) "  # longitude
    r"(-?\d{1,2}\.\d+)"  # latitude
    r"\)$"
)


class ATSRouteWaypointRecord(BaseModel):
    """Validates a row destined for the ``ats_route_waypoints`` table."""

    route_id: str
    sequence_number: int = Field(gt=0)
    waypoint_name: str
    raw_coordinates: str | None = None
    navaid_info: str | None = None
    geom: str | None = None  # EWKT string, e.g. "SRID=4326;POINT(93.275 23.451)"

    @field_validator("waypoint_name")
    @classmethod
    def validate_waypoint_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("waypoint_name cannot be empty")
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


# ------------------------------------------------------------------
# ats_route_segments
# ------------------------------------------------------------------


class ATSRouteSegmentRecord(BaseModel):
    """Validates a row destined for the ``ats_route_segments`` table."""

    route_id: str
    sequence_number: int = Field(gt=0)
    track_magnetic: str | None = None
    distance_nm: float | None = Field(default=None, gt=0)
    upper_limit: str | None = None
    lower_limit: str | None = None
    airspace_class: str | None = None
    moca: str | None = None
    lateral_limits: str | None = None
    direction_odd: str | None = None
    direction_even: str | None = None

    @field_validator("airspace_class")
    @classmethod
    def validate_airspace_class(cls, v: str | None) -> str | None:
        if v is None:
            return v
        valid_classes = {"A", "B", "C", "D", "E", "F", "G"}
        v_stripped = v.strip().upper()
        if v_stripped not in valid_classes:
            raise ValueError(
                f"Invalid airspace class: '{v}'. Must be one of {sorted(valid_classes)}"
            )
        return v_stripped


# ------------------------------------------------------------------
# Convenience validator class (mirrors AirspaceMetadataDatabaseValidator)
# ------------------------------------------------------------------


class ATSRouteDatabaseValidator:
    """Static helpers for validating raw dicts / tuples before DB insertion."""

    @staticmethod
    def validate_route(data: dict) -> ATSRouteRecord:
        """Validate a route dict."""
        return ATSRouteRecord(**data)

    @staticmethod
    def validate_route_params(params: tuple) -> ATSRouteRecord:
        """Validate the 4-element tuple used in ``execute_values``."""
        if len(params) != 4:
            raise ValueError(f"Expected 4 route params, got {len(params)}")
        return ATSRouteRecord(
            route_id=params[0],
            route_designator=params[1],
            route_type=params[2],
            remarks=params[3],
        )

    @staticmethod
    def validate_waypoint(data: dict) -> ATSRouteWaypointRecord:
        """Validate a waypoint dict."""
        return ATSRouteWaypointRecord(**data)

    @staticmethod
    def validate_waypoint_params(params: tuple) -> ATSRouteWaypointRecord:
        """Validate the 6-element tuple used in ``execute_values``."""
        if len(params) != 6:
            raise ValueError(f"Expected 6 waypoint params, got {len(params)}")
        return ATSRouteWaypointRecord(
            route_id=params[0],
            sequence_number=params[1],
            waypoint_name=params[2],
            raw_coordinates=params[3],
            navaid_info=params[4],
            geom=params[5],
        )

    @staticmethod
    def validate_segment(data: dict) -> ATSRouteSegmentRecord:
        """Validate a segment dict."""
        return ATSRouteSegmentRecord(**data)

    @staticmethod
    def validate_segment_params(params: tuple) -> ATSRouteSegmentRecord:
        """Validate the 11-element tuple used in ``execute_values``."""
        if len(params) != 11:
            raise ValueError(f"Expected 11 segment params, got {len(params)}")
        return ATSRouteSegmentRecord(
            route_id=params[0],
            sequence_number=params[1],
            track_magnetic=params[2],
            distance_nm=params[3],
            upper_limit=params[4],
            lower_limit=params[5],
            airspace_class=params[6],
            moca=params[7],
            lateral_limits=params[8],
            direction_odd=params[9],
            direction_even=params[10],
        )

    @classmethod
    def validate_all(
        cls,
        routes: list[tuple],
        waypoints: list[tuple],
        segments: list[tuple],
    ) -> None:
        """Validate complete ETL output before database insertion."""
        for r in routes:
            cls.validate_route_params(r)
        for w in waypoints:
            cls.validate_waypoint_params(w)
        for s in segments:
            cls.validate_segment_params(s)
