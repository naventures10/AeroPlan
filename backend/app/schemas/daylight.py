from pydantic import BaseModel


class DaylightRecord(BaseModel):
    date: str
    twilight_from: str | None = None
    sunrise: str | None = None
    sunset: str | None = None
    twilight_to: str | None = None


class DaylightResponse(BaseModel):
    airport_icao: str
    airport_name: str
    records: list[DaylightRecord] = []
