from pydantic import BaseModel


class WeatherResponse(BaseModel):
    icao: str
    metar: str | None = None
    taf: list[list[str]] = []
    source: str | None = None
    fetched_at: str | None = None
    sources_available: list[str] = []
    cached: bool = False
