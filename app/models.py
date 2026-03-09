from geoalchemy2 import Geometry
from sqlalchemy import BIGINT, Boolean, Column, DateTime, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import ARRAY as PG_ARRAY
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func

from app.database import Base


class SignificantPoint(Base):
    __tablename__ = "significant_points"

    id = Column(Integer, primary_key=True, index=True)
    waypoint_name = Column(String(10), nullable=False)
    routes = Column(PG_ARRAY(String))
    raw_coordinates = Column(String(30))
    geom = Column(Geometry("GEOMETRY", srid=4326))
    created_at = Column(DateTime, server_default=func.now())


class AerodromeDocument(Base):
    __tablename__ = "aerodrome_documents"

    icao_code = Column(String(10), primary_key=True, index=True)
    airport_name = Column(String(255))
    source_url = Column(Text)
    aip_document = Column(JSONB, nullable=False)
    last_updated = Column(DateTime, server_default=func.now(), onupdate=func.now())


class SpatialFeature(Base):
    __tablename__ = "spatial_features"

    feature_id = Column(Integer, primary_key=True, index=True)
    icao_code = Column(String(10), index=True)
    feature_category = Column(String(50))
    feature_name = Column(String(100))
    elevation_m = Column(Numeric)
    geom = Column(Geometry("GEOMETRY", srid=4326))


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


class AerodromeChart(Base):
    __tablename__ = "aerodrome_charts"

    chart_id = Column(Integer, primary_key=True, index=True)
    icao_code = Column(String(10), index=True)
    chart_title = Column(String(255))
    chart_index = Column(String(50))
    minio_url = Column(Text)


class AtsRoutesGeom(Base):
    __tablename__ = "ats_routes_geom"

    # NOTE: Table lacks formal PK in DB, utilizing route_id as SQLAlchemy requires a Primary Key
    route_id = Column(String(20), primary_key=True, index=True)
    route_designator = Column(String(100))
    route_type = Column(String(20))
    remarks = Column(Text)
    waypoint_count = Column(BIGINT)
    geom = Column(Geometry("GEOMETRY", srid=4326))


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


class AtsRoute(Base):
    __tablename__ = "ats_routes"

    id = Column(Integer, primary_key=True, index=True)
    route_id = Column(String(20), nullable=False, index=True)
    route_designator = Column(String(100))
    route_type = Column(String(20), nullable=False)
    remarks = Column(Text)
    created_at = Column(DateTime, server_default=func.now())


class AtsRouteWaypoint(Base):
    __tablename__ = "ats_route_waypoints"

    id = Column(Integer, primary_key=True, index=True)
    route_id = Column(String(20), nullable=False, index=True)
    sequence_number = Column(Integer, nullable=False)
    waypoint_name = Column(String(50))
    raw_coordinates = Column(String(60))
    navaid_info = Column(String(50))
    geom = Column(Geometry("GEOMETRY", srid=4326))
