from pydantic import BaseModel, Field


class RegulatedAirspaceEntry(BaseModel):
    aerodrome: str = Field(default="")
    hours_of_ops: str = Field(default="")
    lateral_limits: str = Field(default="")
    upper_limit: str = Field(default="")
    language: str = Field(default="")
    remarks: str = Field(default="")


class Chart(BaseModel):
    chart_name: str
    pdf_url: str


class ENR22RegulatedAirspaceDocument(BaseModel):
    source_url: str
    regulated_airspace: list[RegulatedAirspaceEntry] = Field(default_factory=list)
    charts: list[Chart] = Field(default_factory=list)
    total_count: int = 0
    total_charts: int = 0
