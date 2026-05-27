from pydantic import BaseModel, HttpUrl, field_validator


class ChartIndexEntry(BaseModel):
    type_of_chart: str
    page: str

    @field_validator("type_of_chart", "page")
    @classmethod
    def validate_non_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Field cannot be empty")
        return v.strip()


class ChartEntry(BaseModel):
    chart_name: str
    pdf_url: HttpUrl

    @field_validator("chart_name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Chart name cannot be empty")
        return v.strip()


class SummaryEntry(BaseModel):
    total_index_entries: int
    total_charts: int


class ENR6Schema(BaseModel):
    source_url: HttpUrl
    chart_index: list[ChartIndexEntry]
    charts: list[ChartEntry]
    summary: SummaryEntry

    @field_validator("charts")
    @classmethod
    def validate_charts_not_empty(cls, v: list[ChartEntry]) -> list[ChartEntry]:
        if not v:
            raise ValueError("Charts array cannot be empty")
        return v
