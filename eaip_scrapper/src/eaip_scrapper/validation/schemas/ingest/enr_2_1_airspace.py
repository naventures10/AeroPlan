from typing import Any

from pydantic import BaseModel, Field


class AirspaceService(BaseModel):
    unit_providing_service: str = Field(default="")
    callsign_language_hours: str = Field(default="")
    frequency: str = Field(default="")
    remarks: str = Field(default="")


class AirspaceEntry(BaseModel):
    name_and_limits: str
    services: list[AirspaceService] = Field(default_factory=list)


class ENR21SummarySections(BaseModel):
    flight_information_regions: int = 0
    control_areas: int = 0
    terminal_control_areas: int = 0
    military_control_zones: int = 0


class ENR21Summary(BaseModel):
    total_entries: int = 0
    total_charts: int = 0
    sections: dict[str, int] = Field(default_factory=dict)


class Chart(BaseModel):
    chart_name: str
    pdf_url: str


class ENR21AirspaceDocument(BaseModel):
    source_url: str
    flight_information_regions: list[AirspaceEntry] = Field(default_factory=list)
    control_areas: list[AirspaceEntry] = Field(default_factory=list)
    terminal_control_areas: list[AirspaceEntry] = Field(default_factory=list)
    military_control_zones: list[AirspaceEntry] = Field(default_factory=list)
    charts: list[Chart] = Field(default_factory=list)
    summary: dict[str, Any] | None = None
