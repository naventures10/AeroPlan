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


class RnpLeg(BaseModel):
    path_descriptor: str | None = None
    waypoint_ident: str | None = None
    altitude_constraint: str | None = None
    speed_limit: str | None = None
    course: str | None = None
    distance: str | None = None
    role: str | None = None
    turn_direction: str | None = None


class RnpApproachPath(BaseModel):
    label: str = Field(..., description='e.g. "via TP607"')
    entry_waypoint: str = Field(..., description="IAF ident")
    path: list[list[float]] = Field(..., description="[lon, lat, alt_m][]")
    timestamps: list[float] = Field(..., description="cumulative NM")
    total_distance_nm: float
    segment_type: str = Field(..., description='"approach"')
    legs: list[RnpLeg] = Field(default_factory=list, description="ARINC 424 legs")


class RnpMissedApproachPath(BaseModel):
    path: list[list[float]] = Field(..., description="[lon, lat, alt_m][]")
    timestamps: list[float] = Field(..., description="cumulative NM")
    total_distance_nm: float
    legs: list[RnpLeg] = Field(default_factory=list, description="ARINC 424 legs")


class RnpHoldPattern(BaseModel):
    waypoint_ident: str
    path: list[list[float]] = Field(..., description="[lon, lat, alt_m][]")
    turn_direction: str | None = None
    inbound_course: float | None = None
    leg_distance_nm: float
    original_distance_str: str | None = None
    altitude_ft: float | None = None
    speed_limit_kt: float | None = None


class RnpPath3dResponse(BaseModel):
    procedure_id: int
    name: str
    airport_id: str
    runway: str
    approach_paths: list[RnpApproachPath] = Field(..., description="Parallel animated trails")
    missed_approach_path: RnpMissedApproachPath | None = None
    max_distance_nm: float = Field(..., description="Longest approach path (animation loop)")
    waypoints: list[RnpWaypointMarker]
    hold_patterns: list[RnpHoldPattern] = Field(
        default_factory=list, description="Procedural hold patterns"
    )
