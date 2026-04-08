"""
Reusable GeoJSON Pydantic models.

These are intentionally permissive (using `Any` for geometry/properties)
because the actual GeoJSON is constructed dynamically by PostGIS.
The value here is *documenting the contract* in the OpenAPI spec so that
``openapi-typescript`` can generate correct frontend types.
"""

from typing import Any

from pydantic import BaseModel, Field


class GeoJsonFeature(BaseModel):
    type: str = "Feature"
    geometry: dict[str, Any] | None = None
    properties: dict[str, Any] | None = None


class GeoJsonFeatureCollection(BaseModel):
    type: str = "FeatureCollection"
    features: list[GeoJsonFeature] = Field(default_factory=list)


class HealthResponse(BaseModel):
    status: str
    database: str | None = None
