"""
RNP procedures — metadata and chart linking for 3D terminal visualization.
"""

from __future__ import annotations

import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.rnp import (
    RnpPath3dResponse,
    RnpProcedureResponse,
)
from app.services.rnp_service import FT_TO_M, build_3d_paths
from app.utils.chart_key import normalize_chart_key

router = APIRouter(prefix="", tags=["RNP"])


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
            ST_XMin(ST_Extent(w.geom)) AS min_lng,
            ST_YMin(ST_Extent(w.geom)) AS min_lat,
            ST_XMax(ST_Extent(w.geom)) AS max_lng,
            ST_YMax(ST_Extent(w.geom)) AS max_lat
        FROM rnp_procedures p
        LEFT JOIN rnp_waypoints w ON p.id = w.procedure_id
        WHERE UPPER(TRIM(p.airport_id)) = UPPER(TRIM(:icao))
        GROUP BY p.id, p.name, p.runway, p.type
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


@router.get(
    "/rnp-procedures/{procedure_id}/path3d",
    response_model=RnpPath3dResponse,
)
async def get_rnp_path_3d(
    procedure_id: int, db: AsyncSession = Depends(get_db)
) -> RnpPath3dResponse:
    """
    Full 3D dynamically-built approach path(s) for an RNP procedure.
    Supports multiple parallel initial approach paths converging to a final path,
    plus a separate missed approach segment.
    """
    q_proc = text("""
        SELECT id, name, airport_id, runway, type
        FROM rnp_procedures
        WHERE id = :pid
    """)
    result = await db.execute(q_proc, {"pid": procedure_id})
    proc_row = result.fetchone()
    if proc_row is None:
        raise HTTPException(status_code=404, detail="Procedure not found")

    q_legs = text("""
        SELECT
            l.sequence_nr,
            l.source_serial,
            l.path_descriptor,
            l.waypoint_ident,
            l.altitude_numeric,
            l.altitude_constraint,
            l.role,
            l.course,
            l.distance,
            l.turn_direction,
            w.lon,
            w.lat,
            w.coordinates_raw
        FROM rnp_legs l
        LEFT JOIN LATERAL (
            SELECT ST_X(geom) AS lon, ST_Y(geom) AS lat, coordinates_raw
            FROM rnp_waypoints
            WHERE procedure_id = l.procedure_id
              AND (
                ident = l.waypoint_ident
                OR (l.waypoint_ident LIKE 'RW%' AND ident = REPLACE(l.waypoint_ident, 'RW', 'RWY'))
                OR (l.waypoint_ident LIKE 'RWY%' AND ident = REPLACE(l.waypoint_ident, 'RWY', 'RW'))
              )
            ORDER BY (
                CASE
                    WHEN ident = l.waypoint_ident THEN 0
                    WHEN l.waypoint_ident LIKE 'RW%' AND ident = REPLACE(l.waypoint_ident, 'RW', 'RWY') THEN 1
                    WHEN l.waypoint_ident LIKE 'RWY%' AND ident = REPLACE(l.waypoint_ident, 'RWY', 'RW') THEN 2
                    ELSE 3
                END
            )
            LIMIT 1
        ) w ON TRUE
        WHERE l.procedure_id = :pid
        ORDER BY l.sequence_nr
    """)
    legs_result = await db.execute(q_legs, {"pid": procedure_id})
    legs_rows = legs_result.fetchall()

    runway_threshold = None
    if proc_row.airport_id and proc_row.runway:
        q_ad = text("""
            SELECT aip_document->'data'->'runway_physical_characteristics'
            FROM aerodrome_documents
            WHERE icao_code = :icao
        """)
        ad_res = await db.execute(q_ad, {"icao": proc_row.airport_id.upper()})
        ad_row = ad_res.fetchone()
        if ad_row and ad_row[0]:
            rwy_chars = ad_row[0]
            # Find the characteristic for the specific runway designation
            target_rwy = str(proc_row.runway).strip().zfill(2)
            for char in rwy_chars:
                if str(char.get("designation")).strip().zfill(2) == target_rwy:
                    coords = char.get("coordinates", {})
                    lat = coords.get("decimal_lat")
                    lng = coords.get("decimal_lng")

                    # Parse elevation (e.g. "THR: 4617.0FT")
                    elev_ft = 0.0
                    elev_str = char.get("thr_elevation", "")
                    m = re.search(r"THR:\s*([\d\.]+)", str(elev_str))
                    if m:
                        elev_ft = float(m.group(1))

                    if lat is not None and lng is not None:
                        # [lon, lat, alt_m]
                        runway_threshold = [float(lng), float(lat), elev_ft * FT_TO_M]
                    break

    return build_3d_paths(proc_row, legs_rows, runway_threshold=runway_threshold)
