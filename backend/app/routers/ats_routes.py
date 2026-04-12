import time
from typing import TypedDict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.geojson import GeoJsonFeatureCollection

router = APIRouter(prefix="/api", tags=["ATS Routes"])


class LabelsCache(TypedDict):
    data: GeoJsonFeatureCollection | None
    ts: float


# ── In-memory cache for ATS route labels (rarely changes) ────────────────
_labels_cache: LabelsCache = {"data": None, "ts": 0.0}
_LABELS_TTL = 3600  # 1 hour


@router.get("/ats-route-labels", response_model=GeoJsonFeatureCollection)
async def get_ats_route_labels(db: AsyncSession = Depends(get_db)) -> GeoJsonFeatureCollection:
    """
    Returns the midpoints of all ATS route segments as GeoJSON points.
    Reads from a pre-computed materialized view (mv_ats_route_labels)
    and caches the result in-memory for 1 hour.
    """
    # Return cached response if still fresh
    if _labels_cache["data"] is not None and (time.monotonic() - _labels_cache["ts"]) < _LABELS_TTL:
        return _labels_cache["data"]

    query = text("""
        SELECT jsonb_build_object(
            'type', 'FeatureCollection',
            'features', COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'type',       'Feature',
                        'geometry',   ST_AsGeoJSON(midpoint_geom)::jsonb,
                        'properties', jsonb_build_object(
                            'id', id,
                            'route_id', route_id,
                            'route_type', route_type,
                            'bearing', bearing
                        )
                    )
                ),
                '[]'::jsonb
            )
        ) AS geojson
        FROM mv_ats_route_labels;
    """)
    result = await db.execute(query)
    row = result.fetchone()
    if row and row[0]:
        data = GeoJsonFeatureCollection(**row[0])
        _labels_cache["data"] = data
        _labels_cache["ts"] = time.monotonic()
        return data
    return GeoJsonFeatureCollection(type="FeatureCollection", features=[])


@router.get("/ats-routes/{route_id}/details")
async def get_ats_route_details(route_id: str, db: AsyncSession = Depends(get_db)) -> dict:
    """
    Returns the full breakdown of an ATS route: route metadata,
    ordered waypoints, and ordered segments with from/to waypoint names.
    """
    # 1. Route metadata
    route_query = text("""
        SELECT route_id, route_designator, route_type, remarks
        FROM ats_routes
        WHERE route_id = :route_id
        LIMIT 1;
    """)
    route_result = await db.execute(route_query, {"route_id": route_id})
    route_row = route_result.fetchone()
    if not route_row:
        raise HTTPException(status_code=404, detail=f"Route '{route_id}' not found")

    # 2. Waypoints (ordered)
    waypoints_query = text("""
        SELECT sequence_number, waypoint_name, raw_coordinates, navaid_info
        FROM ats_route_waypoints
        WHERE route_id = :route_id
        ORDER BY sequence_number;
    """)
    wp_result = await db.execute(waypoints_query, {"route_id": route_id})
    waypoints = [
        {
            "sequence_number": r.sequence_number,
            "waypoint_name": r.waypoint_name,
            "raw_coordinates": r.raw_coordinates,
            "navaid_info": r.navaid_info,
        }
        for r in wp_result.fetchall()
    ]

    # 3. Segments with from/to waypoint names (ordered)
    segments_query = text("""
        SELECT
            s.sequence_number,
            w1.waypoint_name AS from_waypoint,
            w2.waypoint_name AS to_waypoint,
            w1.raw_coordinates AS from_coordinates,
            w2.raw_coordinates AS to_coordinates,
            s.track_magnetic,
            s.distance_nm,
            s.upper_limit,
            s.lower_limit,
            s.airspace_class,
            s.moca,
            s.lateral_limits,
            s.direction_odd,
            s.direction_even
        FROM ats_route_segments s
        JOIN ats_route_waypoints w1
            ON s.route_id = w1.route_id AND s.sequence_number = w1.sequence_number
        JOIN ats_route_waypoints w2
            ON s.route_id = w2.route_id AND w2.sequence_number = s.sequence_number + 1
        WHERE s.route_id = :route_id
        ORDER BY s.sequence_number;
    """)
    seg_result = await db.execute(segments_query, {"route_id": route_id})
    segments = [
        {
            "sequence_number": r.sequence_number,
            "from_waypoint": r.from_waypoint,
            "to_waypoint": r.to_waypoint,
            "from_coordinates": r.from_coordinates,
            "to_coordinates": r.to_coordinates,
            "track_magnetic": r.track_magnetic,
            "distance_nm": float(r.distance_nm) if r.distance_nm else None,
            "upper_limit": r.upper_limit,
            "lower_limit": r.lower_limit,
            "airspace_class": r.airspace_class,
            "moca": r.moca,
            "lateral_limits": r.lateral_limits,
            "direction_odd": r.direction_odd,
            "direction_even": r.direction_even,
        }
        for r in seg_result.fetchall()
    ]

    total_distance = sum(s["distance_nm"] for s in segments if s["distance_nm"])

    return {
        "route_id": route_row.route_id,
        "route_designator": route_row.route_designator,
        "route_type": route_row.route_type,
        "remarks": route_row.remarks,
        "total_distance_nm": round(total_distance, 1),
        "waypoints": waypoints,
        "segments": segments,
    }
