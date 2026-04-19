"""
RNP procedures — metadata and chart linking for 3D terminal visualization.
"""

from __future__ import annotations

import math

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.rnp import RnpPath3dResponse, RnpProcedureResponse
from app.utils.chart_key import normalize_chart_key

router = APIRouter(prefix="/api", tags=["RNP"])

FT_TO_M = 0.3048


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


def _haversine_nm(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    """Great-circle distance in nautical miles."""
    r_nm = 3440.065
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2) ** 2
    )
    return r_nm * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _smooth_path_3d(
    path: list[list[float]], max_turn_dist_nm: float = 1.5, steps: int = 12
) -> list[list[float]]:
    """
    Applies a corner-cutting quadratic Bezier spline to make Fly-By
    waypoint turns look like realistic aircraft tracks (curved) rather
    than sharp instantaneous angles. Maps cut distances in Nautical Miles
    to avoid massive under-turning on long segments.
    """
    if len(path) < 3:
        return path

    smoothed = [path[0]]

    for i in range(1, len(path) - 1):
        p_a = path[i - 1]
        p_b = path[i]
        p_c = path[i + 1]

        # Calculate real-world nautical miles between points
        dist_ab = _haversine_nm(p_a[0], p_a[1], p_b[0], p_b[1])
        dist_bc = _haversine_nm(p_b[0], p_b[1], p_c[0], p_c[1])

        # Determine the physical cut distance. Max 1.5 NM, or 30% of the segment if it's very short
        cut_ab = min(max_turn_dist_nm, dist_ab * 0.3) if dist_ab > 0 else 0
        cut_bc = min(max_turn_dist_nm, dist_bc * 0.3) if dist_bc > 0 else 0

        alpha_ab = (cut_ab / dist_ab) if dist_ab > 0 else 0
        alpha_bc = (cut_bc / dist_bc) if dist_bc > 0 else 0

        # q0 is on segment AB, retreating alpha_ab distance from b
        q0 = [
            p_b[0] + alpha_ab * (p_a[0] - p_b[0]),
            p_b[1] + alpha_ab * (p_a[1] - p_b[1]),
            p_b[2] + alpha_ab * (p_a[2] - p_b[2]),
        ]

        # q2 is on segment BC, retreating alpha_bc distance from b
        q2 = [
            p_b[0] + alpha_bc * (p_c[0] - p_b[0]),
            p_b[1] + alpha_bc * (p_c[1] - p_b[1]),
            p_b[2] + alpha_bc * (p_c[2] - p_b[2]),
        ]

        smoothed.append(q0)

        # Generate quadratic Bezier curve around corner b
        for j in range(1, steps):
            t = j / steps
            inv_t = 1.0 - t

            x = (inv_t**2) * q0[0] + 2 * inv_t * t * p_b[0] + (t * t) * q2[0]
            y = (inv_t**2) * q0[1] + 2 * inv_t * t * p_b[1] + (t * t) * q2[1]
            z = (inv_t**2) * q0[2] + 2 * inv_t * t * p_b[2] + (t * t) * q2[2]

            smoothed.append([x, y, z])

        smoothed.append(q2)

    smoothed.append(path[-1])
    return smoothed


@router.get(
    "/rnp-procedures/{procedure_id}/path3d",
    response_model=RnpPath3dResponse,
)
async def get_rnp_path_3d(
    procedure_id: int, db: AsyncSession = Depends(get_db)
) -> RnpPath3dResponse:
    """
    Full 3D approach path for a single RNP procedure.

    Returns [lon, lat, altitude_metres] coordinate triplets with cumulative
    distance timestamps (in nautical miles) for DeckGL TripsLayer animation,
    plus waypoint markers with name / role / altitude.
    """
    # 1. Fetch procedure geometry (3D LineString)
    q_proc = text("""
        SELECT
            p.id,
            p.name,
            p.airport_id,
            p.runway,
            ST_AsGeoJSON(p.geom_3d)::json -> 'coordinates' AS coords
        FROM rnp_procedures p
        WHERE p.id = :pid AND p.geom_3d IS NOT NULL
    """)
    result = await db.execute(q_proc, {"pid": procedure_id})
    row = result.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Procedure not found or has no geometry")

    raw_coords: list[list[float]] = row.coords  # [[lon, lat, alt_ft], …]

    # Convert altitude from feet → metres
    path: list[list[float]] = [[c[0], c[1], c[2] * FT_TO_M] for c in raw_coords]

    # Smooth the corners for a realistic RNP visual track
    path = _smooth_path_3d(path, max_turn_dist_nm=1.5, steps=16)

    # Compute cumulative distance in NM as timestamps for TripsLayer
    timestamps: list[float] = [0.0]
    for i in range(1, len(path)):
        seg = _haversine_nm(path[i - 1][0], path[i - 1][1], path[i][0], path[i][1])
        # DeckGL TripsLayer requires strictly monotonically increasing timestamps.
        # If consecutive points have the same 2D coordinates (e.g. altitude change only),
        # seg is 0. Give it a minimum artificial distance of 0.01 NM.
        seg = max(seg, 0.01)
        timestamps.append(round(timestamps[-1] + seg, 3))

    # 2. Fetch waypoints with coordinates and roles from legs table
    q_wpts = text("""
        SELECT
            w.ident,
            ST_X(w.geom) AS lon,
            ST_Y(w.geom) AS lat,
            l.altitude_numeric AS alt_ft,
            l.role
        FROM rnp_legs l
        JOIN rnp_waypoints w
          ON w.ident = l.waypoint_ident
         AND w.procedure_id = l.procedure_id
        WHERE l.procedure_id = :pid
        ORDER BY l.sequence_nr
    """)
    wpt_result = await db.execute(q_wpts, {"pid": procedure_id})
    waypoints = []
    seen = set()
    for w in wpt_result.fetchall():
        if w.ident in seen:
            continue
        seen.add(w.ident)
        alt_m = float(w.alt_ft) * FT_TO_M if w.alt_ft else 0.0
        waypoints.append(
            {
                "name": w.ident,
                "position": [float(w.lon), float(w.lat), alt_m],
                "role": w.role,
            }
        )

    return RnpPath3dResponse(
        procedure_id=row.id,
        name=row.name,
        airport_id=row.airport_id or "",
        runway=row.runway or "",
        path=path,
        timestamps=timestamps,
        total_distance_nm=timestamps[-1] if timestamps else 0.0,
        waypoints=waypoints,
    )
