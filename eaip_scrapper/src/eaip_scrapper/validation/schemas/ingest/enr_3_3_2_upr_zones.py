from typing import Any

from pydantic import BaseModel, Field


class Chart(BaseModel):
    chart_name: str
    pdf_url: str


class ENR332UPRZonesDocument(BaseModel):
    source_url: str
    upr_zones_raw_tables: list[list[list[str]]] = Field(default_factory=list)
    charts: list[Chart] = Field(default_factory=list)
    summary: dict[str, Any] | None = None
