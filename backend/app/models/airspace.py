from geoalchemy2 import Geometry
from sqlalchemy import Column, DateTime, Integer, Numeric, String, Text
from sqlalchemy.sql import func

from app.database import Base


class AtsRoute(Base):
    __tablename__ = "ats_routes"

    id = Column(Integer, primary_key=True, index=True)
    route_id = Column(String(20), nullable=False, index=True)
    route_designator = Column(String(100))
    route_type = Column(String(20), nullable=False)
    remarks = Column(Text)
    created_at = Column(DateTime, server_default=func.now())


class AtsRouteSegment(Base):
    __tablename__ = "ats_route_segments"

    id = Column(Integer, primary_key=True, index=True)
    route_id = Column(String(20), nullable=False, index=True)
    sequence_number = Column(Integer, nullable=False)
    track_magnetic = Column(String(20))
    distance_nm = Column(Numeric)
    upper_limit = Column(String(20))
    lower_limit = Column(String(20))
    airspace_class = Column(String(10))
    mea = Column(String(20))
    lateral_limits = Column(String(20))
    direction_odd = Column(String(5))
    direction_even = Column(String(5))
    geom = Column(Geometry("GEOMETRY", srid=4326))


class AtsRouteWaypoint(Base):
    __tablename__ = "ats_route_waypoints"

    id = Column(Integer, primary_key=True, index=True)
    route_id = Column(String(20), nullable=False, index=True)
    sequence_number = Column(Integer, nullable=False)
    waypoint_name = Column(String(50))
    raw_coordinates = Column(String(60))
    navaid_info = Column(String(50))
    geom = Column(Geometry("GEOMETRY", srid=4326))
