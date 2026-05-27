from typing import Any

from pydantic import BaseModel, Field


class MilitaryExerciseAreaEntry(BaseModel):
    name_and_lateral_limits: str
    upper_lower_limits_and_system: str = Field(default="")
    remarks_and_time_of_act: str = Field(default="")


class ADIZEntry(BaseModel):
    zone_name: str
    zone_coordinates: str = Field(default="")
    raw_data: str = Field(default="")


class Chart(BaseModel):
    chart_name: str
    pdf_url: str


class ENR52MilitaryAreasDocument(BaseModel):
    source_url: str
    military_exercise_and_training_areas: list[MilitaryExerciseAreaEntry] = Field(
        default_factory=list
    )
    air_defence_identification_zones_adiz: list[ADIZEntry] = Field(default_factory=list)
    charts: list[Chart] = Field(default_factory=list)
    summary: dict[str, Any] | None = None
