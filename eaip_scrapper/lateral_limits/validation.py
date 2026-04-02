"""
Validation layer for parsed airspace geometries.

Checks:
  - Coordinate range validity
  - Polygon closure (last point ≈ first point)
  - Radius sanity (0 < r < 500)
  - Minimum vertex count for polygons
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Optional

from .models import (
    AirspaceGeometry,
    CircularAirspace,
    BoundingBoxAirspace,
    AnnularRingAirspace,
    SimplePolygonAirspace,
    ComplexPolygonAirspace,
    Coordinate,
)


@dataclass
class ValidationResult:
    """Result of validating a parsed geometry."""
    is_valid: bool = True
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


def _distance_deg(a: Coordinate, b: Coordinate) -> float:
    """Approximate distance in degrees between two points."""
    return math.sqrt((a.lat - b.lat) ** 2 + (a.lng - b.lng) ** 2)


def _check_india_region(coord: Coordinate) -> Optional[str]:
    """Warn if coordinate is far outside greater Indian region."""
    if not (-5 <= coord.lat <= 45):
        return f"Latitude {coord.lat:.4f} is far outside Indian region"
    if not (55 <= coord.lng <= 100):
        return f"Longitude {coord.lng:.4f} is far outside Indian region"
    return None


def validate_geometry(
    geometry: AirspaceGeometry,
    name: str = "",
    closure_threshold_deg: float = 0.5,
) -> ValidationResult:
    """Validate a parsed geometry for sanity."""
    result = ValidationResult()
    prefix = f"[{name}] " if name else ""

    if isinstance(geometry, CircularAirspace):
        warn = _check_india_region(geometry.center)
        if warn:
            result.warnings.append(f"{prefix}Center: {warn}")

        max_radius = 500 if geometry.radius_unit == "NM" else 1000
        if geometry.radius_value > max_radius:
            result.errors.append(
                f"{prefix}Radius {geometry.radius_value} {geometry.radius_unit} "
                f"exceeds maximum {max_radius}"
            )
            result.is_valid = False

    elif isinstance(geometry, BoundingBoxAirspace):
        for lat, lng, label in [
            (geometry.lat_south, geometry.lng_west, "SW corner"),
            (geometry.lat_north, geometry.lng_east, "NE corner"),
        ]:
            coord = Coordinate(lat=lat, lng=lng)
            warn = _check_india_region(coord)
            if warn:
                result.warnings.append(f"{prefix}{label}: {warn}")

        lat_span = geometry.lat_north - geometry.lat_south
        lng_span = geometry.lng_east - geometry.lng_west
        if lat_span > 10 or lng_span > 10:
            result.warnings.append(
                f"{prefix}Very large bounding box: {lat_span:.2f}° × {lng_span:.2f}°"
            )

    elif isinstance(geometry, AnnularRingAirspace):
        warn = _check_india_region(geometry.center)
        if warn:
            result.warnings.append(f"{prefix}Center: {warn}")

    elif isinstance(geometry, SimplePolygonAirspace):
        if len(geometry.coordinates) < 3:
            result.errors.append(
                f"{prefix}Polygon has only {len(geometry.coordinates)} vertices"
            )
            result.is_valid = False

        for i, coord in enumerate(geometry.coordinates):
            warn = _check_india_region(coord)
            if warn:
                result.warnings.append(f"{prefix}Vertex {i}: {warn}")

        if len(geometry.coordinates) >= 3:
            first = geometry.coordinates[0]
            last = geometry.coordinates[-1]
            dist = _distance_deg(first, last)
            if dist > closure_threshold_deg:
                result.warnings.append(
                    f"{prefix}Polygon may not be closed: first→last distance = {dist:.4f}°"
                )

    elif isinstance(geometry, ComplexPolygonAirspace):
        warn = _check_india_region(geometry.starting_coordinate)
        if warn:
            result.warnings.append(f"{prefix}Starting point: {warn}")

        for i, seg in enumerate(geometry.boundaries):
            warn = _check_india_region(seg.end_coordinate)
            if warn:
                result.warnings.append(
                    f"{prefix}Segment {i} endpoint: {warn}"
                )

            if seg.segment_type == "arc":
                max_r = 500 if seg.radius_unit == "NM" else 1000
                if seg.radius_value > max_r:
                    result.errors.append(
                        f"{prefix}Segment {i} arc radius {seg.radius_value} "
                        f"{seg.radius_unit} exceeds max {max_r}"
                    )
                    result.is_valid = False

        if geometry.boundaries:
            last_end = geometry.boundaries[-1].end_coordinate
            dist = _distance_deg(geometry.starting_coordinate, last_end)
            if dist > closure_threshold_deg:
                result.warnings.append(
                    f"{prefix}Complex polygon may not be closed: "
                    f"start→last distance = {dist:.4f}°"
                )

    return result
