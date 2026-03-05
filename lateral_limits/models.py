"""
Pydantic data models for structured airspace geometry.

Handles all observed lateral limit patterns from Indian eAIP data:
- Circles (single radius + center)
- Bounding boxes (lat range × lng range)
- Annular rings (inner + outer radius)
- Simple polygons (straight-line segments only)
- Complex polygons (arcs, topological boundaries, mixed segments)
"""

from __future__ import annotations

from pydantic import BaseModel, Field, model_validator
from typing import List, Union, Literal, Optional


# ---------------------------------------------------------------------------
# Coordinate
# ---------------------------------------------------------------------------

class Coordinate(BaseModel):
    """A precise geographic point in decimal degrees."""

    lat: float = Field(
        ...,
        description="Latitude in decimal degrees (e.g., 21.7544). Positive = North.",
    )
    lng: float = Field(
        ...,
        description="Longitude in decimal degrees (e.g., 72.1905). Positive = East.",
    )

    @model_validator(mode="after")
    def validate_range(self) -> "Coordinate":
        if not (-90 <= self.lat <= 90):
            raise ValueError(f"Latitude {self.lat} out of range [-90, 90]")
        if not (-180 <= self.lng <= 180):
            raise ValueError(f"Longitude {self.lng} out of range [-180, 180]")
        return self


# ---------------------------------------------------------------------------
# Boundary Segments (used inside ComplexPolygonAirspace)
# ---------------------------------------------------------------------------

class StraightSegment(BaseModel):
    """A straight line to the next coordinate."""

    segment_type: Literal["straight"] = "straight"
    end_coordinate: Coordinate


class ArcSegment(BaseModel):
    """A curved arc segment defined by a center, radius, direction, and end point."""

    segment_type: Literal["arc"] = "arc"
    arc_center: Coordinate
    radius_value: float = Field(..., description="The numeric radius value")
    radius_unit: Literal["NM", "KM"] = Field(
        "NM", description="Radius unit — Nautical Miles (NM) or Kilometers (KM)"
    )
    direction: Literal["clockwise", "counter-clockwise"]
    end_coordinate: Coordinate


class TopologicalBoundary(BaseModel):
    """A boundary that follows a geographic/political feature (e.g., international border)."""

    segment_type: Literal["topological"] = "topological"
    boundary_description: str = Field(
        ...,
        description=(
            "The original textual description of this border segment, e.g. "
            "'along International Boundary of India and Pakistan'"
        ),
    )
    boundary_entities: List[str] = Field(
        ...,
        description=(
            "List country names involved (e.g., ['India', 'Pakistan']). "
            "DO NOT append words like 'Border' or 'Line'."
        ),
    )
    end_coordinate: Coordinate


# ---------------------------------------------------------------------------
# Geometry Types
# ---------------------------------------------------------------------------

class CircularAirspace(BaseModel):
    """An airspace defined entirely by a single circle."""

    geometry_type: Literal["circle"] = "circle"
    center: Coordinate
    radius_value: float = Field(..., gt=0, description="The numeric radius value")
    radius_unit: Literal["NM", "KM"] = Field("NM", description="NM or KM")


class BoundingBoxAirspace(BaseModel):
    """An airspace defined by a lat range × lng range (rectangle)."""

    geometry_type: Literal["bounding_box"] = "bounding_box"
    lat_south: float = Field(..., description="Southern latitude in decimal degrees")
    lat_north: float = Field(..., description="Northern latitude in decimal degrees")
    lng_west: float = Field(..., description="Western longitude in decimal degrees")
    lng_east: float = Field(..., description="Eastern longitude in decimal degrees")

    @model_validator(mode="after")
    def validate_ordering(self) -> "BoundingBoxAirspace":
        if self.lat_south > self.lat_north:
            raise ValueError(
                f"lat_south ({self.lat_south}) > lat_north ({self.lat_north})"
            )
        if self.lng_west > self.lng_east:
            raise ValueError(
                f"lng_west ({self.lng_west}) > lng_east ({self.lng_east})"
            )
        return self


class AnnularRingAirspace(BaseModel):
    """An airspace defined by an annular ring (donut) between two radii."""

    geometry_type: Literal["annular_ring"] = "annular_ring"
    center: Coordinate
    inner_radius_value: float = Field(..., gt=0)
    outer_radius_value: float = Field(..., gt=0)
    radius_unit: Literal["NM", "KM"] = Field("NM")

    @model_validator(mode="after")
    def validate_radii(self) -> "AnnularRingAirspace":
        if self.inner_radius_value >= self.outer_radius_value:
            raise ValueError(
                f"inner ({self.inner_radius_value}) >= outer ({self.outer_radius_value})"
            )
        return self


class SimplePolygonAirspace(BaseModel):
    """An airspace defined by a closed polygon with only straight-line edges."""

    geometry_type: Literal["simple_polygon"] = "simple_polygon"
    coordinates: List[Coordinate] = Field(
        ..., min_length=3, description="Ordered list of polygon vertices"
    )


class ComplexPolygonAirspace(BaseModel):
    """An airspace with a mix of straight, arc, and topological boundary segments.

    This is the geometry type sent to the LLM for extraction.
    """

    geometry_type: Literal["complex_polygon"] = "complex_polygon"
    starting_coordinate: Coordinate
    boundaries: List[Union[StraightSegment, ArcSegment, TopologicalBoundary]]

    @model_validator(mode="after")
    def prevent_fragmented_borders(self) -> "ComplexPolygonAirspace":
        """Prevents back-to-back topological boundaries — they must be merged."""
        for i in range(len(self.boundaries) - 1):
            cur = self.boundaries[i]
            nxt = self.boundaries[i + 1]
            if cur.segment_type == "topological" and nxt.segment_type == "topological":
                raise ValueError(
                    "Back-to-back TopologicalBoundary segments detected. "
                    "Merge consecutive border entities into a single segment. "
                    f"Segments: {cur.boundary_entities} and {nxt.boundary_entities}"
                )
        return self


# ---------------------------------------------------------------------------
# Union of all geometry types
# ---------------------------------------------------------------------------

AirspaceGeometry = Union[
    CircularAirspace,
    BoundingBoxAirspace,
    AnnularRingAirspace,
    SimplePolygonAirspace,
    ComplexPolygonAirspace,
]


# ---------------------------------------------------------------------------
# Top-level extraction result
# ---------------------------------------------------------------------------

class AirspaceExtraction(BaseModel):
    """The complete structured extraction of one airspace entry."""

    name: str = Field(..., description="Name of the airspace")
    airspace_type: str = Field(..., description="Category (e.g. CTA, FIR, Danger)")
    upper_limit: str = Field(..., description="Vertical upper limit (e.g. 'FL 460')")
    lower_limit: str = Field(..., description="Vertical lower limit (e.g. 'GND')")
    source: str = Field(..., description="eAIP source section (e.g. 'ENR 2.1')")
    geometry: AirspaceGeometry
    parse_method: Literal["deterministic", "llm"] = Field(
        ..., description="Whether this was parsed by regex or LLM"
    )
    original_text: str = Field(
        ..., description="The original lateral_limits text for traceability"
    )
    confidence: Optional[float] = Field(
        None,
        ge=0.0,
        le=1.0,
        description="Confidence score (1.0 for deterministic, LLM self-assessed)",
    )


# ---------------------------------------------------------------------------
# LLM Output Model (subset sent to the LLM for complex cases)
# ---------------------------------------------------------------------------

class LLMGeometryOutput(BaseModel):
    """The geometry the LLM must produce. Used as Pydantic AI output_type."""

    geometry: Union[CircularAirspace, ComplexPolygonAirspace]
