"""
NOTAM response schema and serialization helper.

The ``serialize_notam`` function replaces the 17-line dict literal that was
previously copy-pasted three times across notams.py.
"""

from datetime import datetime

from pydantic import BaseModel


class NotamResponse(BaseModel):
    notam_id: str
    source_file: str
    series: str | None = None
    scope: str | None = None
    fir: str | None = None
    combined_fir: str | None = None
    airport_icao: str | None = None
    valid_from: str | None = None
    valid_to: str | None = None
    is_permanent: bool | None = None
    is_estimated: bool | None = None
    duration_category: str | None = None
    description: str | None = None


def serialize_notam(row) -> dict:
    """Convert a SQLAlchemy row to a plain dict matching NotamResponse."""
    return {
        "notam_id": row.notam_id,
        "source_file": row.source_file,
        "series": row.series,
        "scope": row.scope,
        "fir": row.fir,
        "combined_fir": row.combined_fir,
        "airport_icao": row.airport_icao,
        "valid_from": row.valid_from.isoformat() if row.valid_from else None,
        "valid_to": row.valid_to.isoformat() if row.valid_to else None,
        "is_permanent": row.is_permanent,
        "is_estimated": row.is_estimated,
        "duration_category": row.duration_category,
        "description": row.description,
    }
