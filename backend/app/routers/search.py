"""
Search Router — Global search across aerodromes, navaids, waypoints, and ATS routes.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db

router = APIRouter(prefix="/api", tags=["Search"])


@router.get("/search")
async def global_search(q: str, db: AsyncSession = Depends(get_db)):
    """
    Searches across Aerodromes, NavAids, Waypoints, and ATS Routes.
    Calculates geographic center and bounding boxes for LineStrings
    so the frontend can frame them on click.
    """
    if not q or len(q.strip()) < 2:
        return []

    term = f"%{q.strip().upper()}%"

    query = text("""
        WITH search_results AS (
            -- 1. Aerodromes
            SELECT
                ad.icao_code AS id,
                ad.airport_name AS name,
                'AERODROME' AS type,
                ST_Centroid(sf.geom) AS center_geom,
                NULL::box2d AS computed_bounds
            FROM aerodrome_documents ad
            JOIN spatial_features sf ON sf.icao_code = ad.icao_code AND sf.feature_category = 'ARP'
            WHERE ad.icao_code ILIKE :term OR ad.airport_name ILIKE :term

            UNION ALL

            -- 2. NavAids
            SELECT
                ident AS id,
                station_name AS name,
                'NAVAID' AS type,
                ST_Centroid(geom) AS center_geom,
                NULL::box2d AS computed_bounds
            FROM radio_nav_aids
            WHERE ident ILIKE :term OR station_name ILIKE :term

            UNION ALL

            -- 3. Waypoints
            SELECT
                waypoint_name AS id,
                waypoint_name AS name,
                'WAYPOINT' AS type,
                ST_Centroid(geom) AS center_geom,
                NULL::box2d AS computed_bounds
            FROM ats_waypoints_grouped
            WHERE waypoint_name ILIKE :term

            UNION ALL

            -- 4. ATS Routes (Airways)
            SELECT
                route_id AS id,
                COALESCE(route_designator, route_id) AS name,
                'ATS_ROUTE' AS type,
                ST_Centroid(geom) AS center_geom,
                Box2D(geom) AS computed_bounds
            FROM ats_routes_geom
            WHERE route_id ILIKE :term OR route_designator ILIKE :term
        )
        SELECT
            id,
            name,
            type,
            ST_X(center_geom) AS lng,
            ST_Y(center_geom) AS lat,
            ST_XMin(computed_bounds) AS min_lng,
            ST_YMin(computed_bounds) AS min_lat,
            ST_XMax(computed_bounds) AS max_lng,
            ST_YMax(computed_bounds) AS max_lat
        FROM search_results
        LIMIT 20;
    """)

    result = await db.execute(query, {"term": term})
    rows = result.fetchall()

    output = []
    for r in rows:
        match = {
            "id": r.id,
            "name": r.name,
            "type": r.type,
            "center": [r.lng, r.lat] if r.lng is not None and r.lat is not None else None,
            "bounds": None,
        }
        if r.min_lng is not None:
            match["bounds"] = [r.min_lng, r.min_lat, r.max_lng, r.max_lat]
        output.append(match)

    return output
