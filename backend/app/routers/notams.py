"""
NOTAMs Router — Query NOTAMs from the database by ICAO code or FIR.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.notam import serialize_notam

router = APIRouter(prefix="/api", tags=["NOTAMs"])


@router.get("/notams/{icao_code}")
async def get_notams_by_airport(
    icao_code: str,
    active_only: bool = Query(False, description="If true, return only currently active NOTAMs"),
    db: AsyncSession = Depends(get_db),
):
    """Returns all NOTAMs for a specific airport ICAO code, ordered by valid_from DESC."""
    icao = icao_code.upper()
    active_filter = "AND (valid_to IS NULL OR valid_to > NOW())" if active_only else ""

    query = text(f"""
        SELECT notam_id, source_file, series, scope, fir, combined_fir, airport_icao,
               valid_from, valid_to, is_permanent, is_estimated, duration_category, description
        FROM notams
        WHERE airport_icao = :icao {active_filter}
        ORDER BY valid_from DESC;
    """)

    result = await db.execute(query, {"icao": icao})
    return [serialize_notam(r) for r in result.fetchall()]


@router.get("/notams")
async def get_all_notams(
    icao: str | None = Query(None, description="Filter by airport ICAO code"),
    active_only: bool = Query(False, description="If true, return only currently active NOTAMs"),
    db: AsyncSession = Depends(get_db),
):
    """Returns NOTAMs with optional filters. Without params, returns all NOTAMs."""
    conditions = []
    params: dict = {}

    if icao:
        conditions.append("airport_icao = :icao")
        params["icao"] = icao.upper()

    if active_only:
        conditions.append("(valid_to IS NULL OR valid_to > NOW())")

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    query = text(f"""
        SELECT notam_id, source_file, series, scope, fir, combined_fir, airport_icao,
               valid_from, valid_to, is_permanent, is_estimated, duration_category, description
        FROM notams
        {where_clause}
        ORDER BY valid_from DESC;
    """)

    result = await db.execute(query, params)
    return [serialize_notam(r) for r in result.fetchall()]


@router.get("/notams/fir/{fir_code}")
async def get_notams_by_fir(
    fir_code: str,
    active_only: bool = Query(False, description="If true, return only currently active NOTAMs"),
    db: AsyncSession = Depends(get_db),
):
    """Returns all NOTAMs for a specific FIR (e.g., VOMF, VABF)."""
    fir_pattern = f"%{fir_code.upper()}%"
    active_filter = "AND (valid_to IS NULL OR valid_to > NOW())" if active_only else ""

    query = text(f"""
        SELECT notam_id, source_file, series, scope, fir, combined_fir, airport_icao,
               valid_from, valid_to, is_permanent, is_estimated, duration_category, description
        FROM notams
        WHERE fir ILIKE :fir_pattern {active_filter}
        ORDER BY valid_from DESC;
    """)

    result = await db.execute(query, {"fir_pattern": fir_pattern})
    return [serialize_notam(r) for r in result.fetchall()]
