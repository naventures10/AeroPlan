"""Ingest validation schemas for ENR 3.1 (Conventional) and ENR 3.2 (RNAV) routes.

These schemas validate the structural shape of the JSON produced by
``ENRRoutesExtractor`` — ensuring dicts have expected keys and lists are
non-empty — without strictly parsing raw DMS coordinate strings or flight
level formats.  Heavy parsing is deferred to the ETL / database layer.
"""

from typing import Any

from pydantic import BaseModel, Field, model_validator

# ------------------------------------------------------------------
# Waypoint / Segment entries (interleaved in the "waypoints" list)
# ------------------------------------------------------------------


class RouteWaypointEntryIngest(BaseModel):
    """A waypoint dict inside the route's interleaved list."""

    waypoint_name: str
    coordinates: str = Field(default="")
    # Segments fields may also appear on the same dict in edge cases
    track_distance: str | None = None
    limits_class: str | None = None
    lateral_limits: str | None = None
    direction_odd: str | None = None
    direction_even: str | None = None
    remarks: str | None = None


class RouteSegmentEntryIngest(BaseModel):
    """A segment dict inside the route's interleaved list."""

    track_distance: str
    limits_class: str | None = None
    lateral_limits: str | None = None
    direction_odd: str | None = None
    direction_even: str | None = None
    remarks: str | None = None


# ------------------------------------------------------------------
# Per-route structure
# ------------------------------------------------------------------


class RouteIngest(BaseModel):
    """A single route object as emitted by the scraper."""

    route_id: str
    route_designator: str = Field(default="")
    waypoints: list[dict[str, Any]] = Field(default_factory=list)
    remarks: str = Field(default="")

    @model_validator(mode="after")
    def validate_waypoints_not_empty(self) -> "RouteIngest":
        if not self.waypoints:
            raise ValueError(f"Route '{self.route_id}' has an empty waypoints list")
        return self

    def validated_entries(
        self,
    ) -> list[RouteWaypointEntryIngest | RouteSegmentEntryIngest]:
        """Parse each raw dict into the appropriate typed model."""
        entries: list[RouteWaypointEntryIngest | RouteSegmentEntryIngest] = []
        for entry in self.waypoints:
            if "waypoint_name" in entry:
                entries.append(RouteWaypointEntryIngest(**entry))
            elif "track_distance" in entry:
                entries.append(RouteSegmentEntryIngest(**entry))
            else:
                raise ValueError(f"Route '{self.route_id}': unrecognized waypoint entry: {entry}")
        return entries


# ------------------------------------------------------------------
# Root document (the complete JSON file)
# ------------------------------------------------------------------


class ENR3RoutesMetadataIngest(BaseModel):
    """Metadata block at the top of the JSON output."""

    section: str
    title: str
    extracted_at: str
    airac_base_url: str


class ENR3RoutesDocumentIngest(BaseModel):
    """Root structure for ``enr_3_1_conventional_routes.json`` or
    ``enr_3_2_rnav_routes.json``."""

    metadata: ENR3RoutesMetadataIngest
    routes: list[RouteIngest]
    total_count: int = Field(ge=0)

    @model_validator(mode="after")
    def validate_count_matches(self) -> "ENR3RoutesDocumentIngest":
        if self.total_count != len(self.routes):
            raise ValueError(
                f"total_count ({self.total_count}) does not match "
                f"actual routes length ({len(self.routes)})"
            )
        return self
