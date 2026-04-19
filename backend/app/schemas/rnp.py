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


class RnpWaypointMarker(BaseModel):
    name: str
    position: list[float] = Field(..., description="[lon, lat, altitude_m]")
    role: str | None = None


class RnpPath3dResponse(BaseModel):
    procedure_id: int
    name: str
    airport_id: str
    runway: str
    path: list[list[float]] = Field(
        ..., description="Ordered [lon, lat, altitude_metres] coordinate triplets"
    )
    timestamps: list[float] = Field(
        ..., description="Cumulative distance in NM for each path vertex (TripsLayer animation)"
    )
    total_distance_nm: float
    waypoints: list[RnpWaypointMarker]
