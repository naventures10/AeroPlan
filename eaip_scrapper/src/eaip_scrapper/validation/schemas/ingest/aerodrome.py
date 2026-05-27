from pydantic import BaseModel, Field


class GeographicalData(BaseModel):
    arp_coordinates_site: str | None = Field(default=None)
    elevation_reference_temp: str | None = Field(default=None)


class RunwayCharacteristic(BaseModel):
    designation: str | None = Field(default=None)
    coordinates: str | None = Field(default=None)
    thr_elevation: str | None = Field(default=None)


class Obstacle(BaseModel):
    coordinates: str | None = Field(default=None)
    elevation: str | None = Field(default=None)
    marking_lgt: str | None = Field(default=None)
    obstacle_type: str | None = Field(default=None)
    remarks: str | None = Field(default=None)


class NavAid(BaseModel):
    coordinates: str | None = Field(default=None)
    identification: str | None = Field(default=None)
    type_of_aid: str | None = Field(default=None)
    elevation: str | None = Field(default=None)


class Helipad(BaseModel):
    coordinates_tlof_fato: str | None = Field(default=None)
    elevation_tlof_fato: str | None = Field(default=None)


class Chart(BaseModel):
    chart_name: str | None = Field(default=None)
    pdf_url: str | None = Field(default=None)


class AerodromeData(BaseModel):
    geographical_data: GeographicalData | None = Field(default=None)
    runway_physical_characteristics: list[RunwayCharacteristic] = Field(default_factory=list)
    obstacles: list[Obstacle] = Field(default_factory=list)
    radio_navigation_and_landing_aids: list[NavAid] = Field(default_factory=list)
    helicopter_landing_area: Helipad | None = Field(default=None)
    charts: list[Chart] = Field(default_factory=list)


class AerodromeDocument(BaseModel):
    icao: str
    name: str | None = Field(default=None)
    source_url: str | None = Field(default=None)
    data: AerodromeData | None = Field(default=None)
