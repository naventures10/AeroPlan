from pydantic import BaseModel


class AerodromeSectionResponse(BaseModel):
    section_id: str
    title: str
    data_type: str
    data: dict | list | None = None


class ChartResponse(BaseModel):
    chart_id: int
    chart_title: str | None = None
    chart_index: str | None = None
    chart_url: str | None = None
