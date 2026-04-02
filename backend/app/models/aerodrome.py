from geoalchemy2 import Geometry
from sqlalchemy import Column, DateTime, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func

from app.database import Base


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


class AerodromeChart(Base):
    __tablename__ = "aerodrome_charts"

    chart_id = Column(Integer, primary_key=True, index=True)
    icao_code = Column(String(10), index=True)
    chart_title = Column(String(255))
    chart_index = Column(String(50))
    chart_url = Column(Text)
