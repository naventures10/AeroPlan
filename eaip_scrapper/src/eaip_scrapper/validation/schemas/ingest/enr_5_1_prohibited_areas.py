from typing import Any

from pydantic import BaseModel, Field


class ProhibitedAreaEntry(BaseModel):
    identification: str
    name: str = Field(default="")
    lateral_limits: str = Field(default="")
    upper_limit: str = Field(default="")
    lower_limit: str = Field(default="")
    remarks: str = Field(default="")


class Chart(BaseModel):
    chart_name: str
    pdf_url: str


class ENR51ProhibitedAreasDocument(BaseModel):
    source_url: str
    definitions: str = Field(default="")
    regions: dict[str, list[ProhibitedAreaEntry]] = Field(default_factory=dict)
    charts: list[Chart] = Field(default_factory=list)
    summary: dict[str, Any] | None = None
