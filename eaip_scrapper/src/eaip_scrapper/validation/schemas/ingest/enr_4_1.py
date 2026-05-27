from typing import Any

from pydantic import BaseModel, Field


class RadioNavAidItem(BaseModel):
    station_name: str = Field(default="")
    id: str = Field(default="")
    frequency: str = Field(default="")
    hours_of_operation: str = Field(default="")
    coordinates: str = Field(default="")
    elevation: str = Field(default="")
    remarks: str = Field(default="")


class ENR41RadioNavAidsDocument(BaseModel):
    metadata: dict[str, Any] = Field(default_factory=dict)
    radio_navigation_aids: list[RadioNavAidItem] = Field(default_factory=list)
    total_count: int = Field(default=0)
