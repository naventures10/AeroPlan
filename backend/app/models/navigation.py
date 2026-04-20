from geoalchemy2 import Geometry
from sqlalchemy import Column, DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY as PG_ARRAY
from sqlalchemy.sql import func

from app.core.database import Base


class SignificantPoint(Base):
    __tablename__ = "significant_points"

    id = Column(Integer, primary_key=True, index=True)
    waypoint_name = Column(String(10), nullable=False)
    routes = Column(PG_ARRAY(String))
    raw_coordinates = Column(String(30))
    geom = Column(Geometry("GEOMETRY", srid=4326))
    created_at = Column(DateTime, server_default=func.now())


class RadioNavAid(Base):
    __tablename__ = "radio_nav_aids"

    id = Column(Integer, primary_key=True, index=True)
    station_name = Column(String(100), nullable=False)
    ident = Column(String(10), nullable=False, index=True)
    aid_type = Column(String(30))
    frequency = Column(String(30))
    hours_of_operation = Column(String(100))
    elevation = Column(String(30))
    remarks = Column(Text)
    raw_coordinates = Column(String(40))
    geom = Column(Geometry("GEOMETRY", srid=4326))
    created_at = Column(DateTime, server_default=func.now())
