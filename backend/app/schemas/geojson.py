"""
Reusable GeoJSON Pydantic models.

These are intentionally permissive (using `Any` for geometry/properties)
because the actual GeoJSON is constructed dynamically by PostGIS.
The value here is *documenting the contract* in the OpenAPI spec so that
``openapi-typescript`` can generate correct frontend types.
"""

from typing import Any, Literal

from pydantic import BaseModel, Field


class GeoJsonFeature(BaseModel):
    type: Literal["Feature"] = "Feature"
    geometry: dict[str, Any] | None = None
    properties: dict[str, Any] | None = None


class GeoJsonFeatureCollection(BaseModel):
    type: Literal["FeatureCollection"] = "FeatureCollection"
    features: list[GeoJsonFeature] = Field(default_factory=list)


class HealthResponse(BaseModel):
    status: str
    database: str | None = None
