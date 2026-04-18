"""
RNP procedures — metadata and chart linking for 3D terminal visualization.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.rnp import RnpProcedureResponse
from app.utils.chart_key import normalize_chart_key

router = APIRouter(prefix="/api", tags=["RNP"])


@router.get(
    "/aerodromes/{icao_code}/rnp-procedures",
    response_model=list[RnpProcedureResponse],
)
async def list_rnp_procedures(
    icao_code: str, db: AsyncSession = Depends(get_db)
) -> list[RnpProcedureResponse]:
    """
    RNP procedures for an aerodrome (airport_id matches ICAO), with chart_key
    derived from procedure name for matching aerodrome_charts URLs/titles.
    """
    query = text("""
        SELECT
            p.id AS procedure_id,
            p.name,
            p.runway,
            p.type AS procedure_type,
            CASE
                WHEN p.geom_3d IS NOT NULL THEN ST_XMin(ST_Envelope(p.geom_3d::geometry))
                ELSE NULL
            END AS min_lng,
            CASE
                WHEN p.geom_3d IS NOT NULL THEN ST_YMin(ST_Envelope(p.geom_3d::geometry))
                ELSE NULL
            END AS min_lat,
            CASE
                WHEN p.geom_3d IS NOT NULL THEN ST_XMax(ST_Envelope(p.geom_3d::geometry))
                ELSE NULL
            END AS max_lng,
            CASE
                WHEN p.geom_3d IS NOT NULL THEN ST_YMax(ST_Envelope(p.geom_3d::geometry))
                ELSE NULL
            END AS max_lat
        FROM rnp_procedures p
        WHERE UPPER(TRIM(p.airport_id)) = UPPER(TRIM(:icao))
        ORDER BY p.name;
    """)

    result = await db.execute(query, {"icao": icao_code.upper().strip()})
    rows = result.fetchall()

    out: list[RnpProcedureResponse] = []
    for r in rows:
        ck = normalize_chart_key(r.name)
        out.append(
            RnpProcedureResponse(
                procedure_id=r.procedure_id,
                name=r.name,
                runway=r.runway,
                procedure_type=r.procedure_type,
                chart_key=ck,
                min_lng=float(r.min_lng) if r.min_lng is not None else None,
                min_lat=float(r.min_lat) if r.min_lat is not None else None,
                max_lng=float(r.max_lng) if r.max_lng is not None else None,
                max_lat=float(r.max_lat) if r.max_lat is not None else None,
            )
        )
    return out
