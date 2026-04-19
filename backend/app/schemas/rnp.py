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


class RnpApproachPath(BaseModel):
    label: str = Field(..., description='e.g. "via TP607"')
    entry_waypoint: str = Field(..., description="IAF ident")
    path: list[list[float]] = Field(..., description="[lon, lat, alt_m][]")
    timestamps: list[float] = Field(..., description="cumulative NM")
    total_distance_nm: float
    segment_type: str = Field(..., description='"approach"')


class RnpMissedApproachPath(BaseModel):
    path: list[list[float]] = Field(..., description="[lon, lat, alt_m][]")
    timestamps: list[float] = Field(..., description="cumulative NM")
    total_distance_nm: float


class RnpPath3dResponse(BaseModel):
    procedure_id: int
    name: str
    airport_id: str
    runway: str
    approach_paths: list[RnpApproachPath] = Field(..., description="Parallel animated trails")
    missed_approach_path: RnpMissedApproachPath | None = None
    max_distance_nm: float = Field(..., description="Longest approach path (animation loop)")
    waypoints: list[RnpWaypointMarker]
