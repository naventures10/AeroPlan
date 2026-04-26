from geoalchemy2 import Geometry
from sqlalchemy import Column, Date, DateTime, Integer, String, Time
from sqlalchemy.sql import func

from app.core.database import Base


class DaylightTime(Base):
    __tablename__ = "daylight_times"

    id = Column(Integer, primary_key=True)
    airport_icao = Column(String, nullable=False, index=True)
    airport_name = Column(String, nullable=False)
    coordinates = Column(Geometry("POINT", srid=4326))
    date = Column(Date, nullable=False)
    twilight_from = Column(Time)
    sunrise = Column(Time)
    sunset = Column(Time)
    twilight_to = Column(Time)
    year = Column(Integer, nullable=False)
    updated_at = Column(DateTime, server_default=func.now())
