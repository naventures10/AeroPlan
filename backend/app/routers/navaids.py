"""
NavAids Router — Detailed information for Radio Navigation Aids.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.navaid import NavAidDetailResponse

router = APIRouter(prefix="/api/navaids", tags=["NavAids"])


@router.get("/{ident}", response_model=NavAidDetailResponse)
async def get_navaid_details(
    ident: str, db: AsyncSession = Depends(get_db)
) -> NavAidDetailResponse:
    """
    Returns full details for a specific Radio NavAid by its identifier.
    """
    query = text("""
        SELECT
            station_name,
            ident,
            aid_type,
            frequency,
            hours_of_operation,
            elevation,
            remarks,
            raw_coordinates
        FROM radio_nav_aids
        WHERE ident = :ident
        LIMIT 1;
    """)
    result = await db.execute(query, {"ident": ident.upper()})
    row = result.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail=f"NavAid '{ident}' not found")

    return NavAidDetailResponse(
        station_name=row.station_name,
        ident=row.ident,
        aid_type=row.aid_type,
        frequency=row.frequency,
        hours_of_operation=row.hours_of_operation,
        elevation=row.elevation,
        remarks=row.remarks,
        raw_coordinates=row.raw_coordinates,
    )
