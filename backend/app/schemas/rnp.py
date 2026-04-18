from pydantic import BaseModel, Field


class RnpProcedureResponse(BaseModel):
    procedure_id: int = Field(..., description="Primary key of rnp_procedures")
    name: str
    runway: str | None = None
    procedure_type: str | None = Field(None, description="Procedure type (e.g. RNP)", alias="type")
    chart_key: str
    min_lng: float | None = None
    min_lat: float | None = None
    max_lng: float | None = None
    max_lat: float | None = None

    model_config = {"populate_by_name": True}
