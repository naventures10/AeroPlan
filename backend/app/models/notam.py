from sqlalchemy import Boolean, Column, DateTime, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func

from app.core.database import Base


class Notam(Base):
    __tablename__ = "notams"

    notam_id = Column(String, primary_key=True)
    source_file = Column(String, primary_key=True)
    series = Column(String)
    scope = Column(String)
    fir = Column(String)
    combined_fir = Column(String)
    airport_icao = Column(String, index=True)
    valid_from = Column(DateTime)
    valid_to = Column(DateTime)
    is_permanent = Column(Boolean)
    is_estimated = Column(Boolean)
    duration_category = Column(String)
    description = Column(Text)
    raw_json = Column(JSONB)
    updated_at = Column(DateTime, server_default=func.now())
