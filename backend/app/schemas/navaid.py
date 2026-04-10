from pydantic import BaseModel


class NavAidDetailResponse(BaseModel):
    station_name: str
    ident: str
    aid_type: str | None = None
    frequency: str | None = None
    hours_of_operation: str | None = None
    elevation: str | None = None
    remarks: str | None = None
    raw_coordinates: str | None = None
