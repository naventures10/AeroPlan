"""
Search Router — Global search across aerodromes, navaids, waypoints, and ATS routes.
"""

from fastapi import APIRouter, Depends
from opentelemetry import trace
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.search import SearchResultResponse

tracer = trace.get_tracer(__name__)

router = APIRouter(prefix="/api", tags=["Search"])


@router.get("/search", response_model=list[SearchResultResponse])
async def global_search(q: str, db: AsyncSession = Depends(get_db)) -> list[SearchResultResponse]:
    """
    Searches across Aerodromes, NavAids, Waypoints, and ATS Routes.
    Calculates geographic center and bounding boxes for LineStrings
    so the frontend can frame them on click.
    """
    if not q or len(q.strip()) < 1:
        return []

    q_clean = q.strip().upper()
    exact_term = q_clean
    start_term = f"{q_clean}%"
    contains_term = f"%{q_clean}%"

    import re
    # Extract alphanumeric parts for fuzzy matching
    parts = [p for p in re.split(r'[^A-Z0-9]+', q_clean) if p]
    if not parts:
        parts = list(q_clean)

    # Split 'V4' into 'V' and '4' for fuzzier fallback
    fuzzy_tokens = []
    for part in parts:
        fuzzy_tokens.extend(re.findall(r'[A-Z]+|\d+', part))

    tokens = list(set(fuzzy_tokens)) if fuzzy_tokens else list(q_clean)

    # Safe regex for any of the tokens
    safe_tokens = [re.escape(t) for t in tokens]
    regex_term = f"({'|'.join(safe_tokens)})" if safe_tokens else re.escape(q_clean)

    query = text("""
        WITH
        -- Pre-aggregate segment data per route ONCE (replaces 8 correlated subqueries)
        route_seg_agg AS (
            SELECT
                route_id,
                (array_agg(direction_odd)  FILTER (WHERE direction_odd  IS NOT NULL))[1] AS direction_odd,
                (array_agg(direction_even) FILTER (WHERE direction_even IS NOT NULL))[1] AS direction_even,
                (array_agg(track_magnetic) FILTER (WHERE track_magnetic IS NOT NULL))[1] AS track_magnetic,
                SUM(distance_nm) AS distance_nm,
                (array_agg(upper_limit)    FILTER (WHERE upper_limit    IS NOT NULL))[1] AS upper_limit,
                (array_agg(lower_limit)    FILTER (WHERE lower_limit    IS NOT NULL))[1] AS lower_limit,
                (array_agg(lateral_limits) FILTER (WHERE lateral_limits IS NOT NULL))[1] AS lateral_limits,
                (array_agg(moca)           FILTER (WHERE moca           IS NOT NULL))[1] AS moca
            FROM ats_route_segments
            GROUP BY route_id
        ),
        search_results AS (
            -- 1. Aerodromes
            SELECT
                ad.icao_code AS id,
                ad.airport_name AS name,
                'AERODROME' AS type,
                ST_Centroid(sf.geom) AS center_geom,
                NULL::box2d AS computed_bounds,
                NULL::VARCHAR AS route_type,
                jsonb_build_object(
                    'icao_code', ad.icao_code,
                    'airport_name', ad.airport_name
                ) AS properties
            FROM aerodrome_documents ad
            JOIN spatial_features sf ON sf.icao_code = ad.icao_code AND sf.feature_category = 'ARP'
            WHERE ad.icao_code ~* :regex_term OR ad.airport_name ~* :regex_term

            UNION ALL

            -- 2. NavAids
            SELECT
                ident AS id,
                station_name AS name,
                'NAVAID' AS type,
                ST_Centroid(geom) AS center_geom,
                NULL::box2d AS computed_bounds,
                NULL::VARCHAR AS route_type,
                jsonb_build_object(
                    'ident', ident,
                    'station_name', station_name,
                    'aid_type', aid_type,
                    'frequency', frequency,
                    'hours_of_operation', hours_of_operation,
                    'elevation', elevation,
                    'remarks', remarks,
                    'raw_coordinates', raw_coordinates
                ) AS properties
            FROM radio_nav_aids
            WHERE ident ~* :regex_term OR station_name ~* :regex_term

            UNION ALL

            -- 3. Waypoints
            SELECT
                waypoint_name AS id,
                waypoint_name AS name,
                'WAYPOINT' AS type,
                ST_Centroid(geom) AS center_geom,
                NULL::box2d AS computed_bounds,
                NULL::VARCHAR AS route_type,
                jsonb_build_object(
                    'waypoint_name', waypoint_name,
                    'route_ids', route_ids
                ) AS properties
            FROM ats_waypoints_grouped
            WHERE waypoint_name ~* :regex_term

            UNION ALL

            -- 4. ATS Routes — uses pre-aggregated segment data (no correlated subqueries)
            SELECT
                r.route_id AS id,
                COALESCE(r.route_designator, r.route_id) AS name,
                'ATS_ROUTE' AS type,
                ST_Centroid(ST_Collect(w.geom)) AS center_geom,
                Box2D(ST_Collect(w.geom)) AS computed_bounds,
                r.route_type AS route_type,
                jsonb_build_object(
                    'route_id', r.route_id,
                    'route_designator', r.route_designator,
                    'route_type', r.route_type,
                    'remarks', r.remarks,
                    'direction_odd', sa.direction_odd,
                    'direction_even', sa.direction_even,
                    'track_magnetic', sa.track_magnetic,
                    'distance_nm', sa.distance_nm,
                    'upper_limit', sa.upper_limit,
                    'lower_limit', sa.lower_limit,
                    'lateral_limits', sa.lateral_limits,
                    'moca', sa.moca
                ) AS properties
            FROM ats_routes r
            JOIN ats_route_waypoints w ON r.route_id = w.route_id
            LEFT JOIN route_seg_agg sa ON sa.route_id = r.route_id
            WHERE r.route_id ~* :regex_term OR r.route_designator ~* :regex_term
            GROUP BY r.route_id, r.route_designator, r.route_type, r.remarks,
                     sa.direction_odd, sa.direction_even, sa.track_magnetic,
                     sa.distance_nm, sa.upper_limit, sa.lower_limit,
                     sa.lateral_limits, sa.moca
        ),
        final_search AS (
            SELECT DISTINCT ON (id, type)
                id,
                name,
                type,
                ST_X(center_geom) AS lng,
                ST_Y(center_geom) AS lat,
                ST_XMin(computed_bounds) AS min_lng,
                ST_YMin(computed_bounds) AS min_lat,
                ST_XMax(computed_bounds) AS max_lng,
                ST_YMax(computed_bounds) AS max_lat,
                route_type,
                properties,
                (
                    CASE WHEN id ILIKE :exact_term THEN 2000 ELSE 0 END +
                    CASE WHEN COALESCE(name, '') ILIKE :exact_term THEN 2000 ELSE 0 END +
                    CASE WHEN id ILIKE :start_term THEN 1000 - LEAST(LENGTH(id::text), 500) ELSE 0 END +
                    CASE WHEN COALESCE(name, '') ILIKE :start_term THEN 1000 - LEAST(LENGTH(COALESCE(name::text, '')), 500) ELSE 0 END +
                    CASE WHEN id ILIKE :contains_term THEN 500 - LEAST(LENGTH(id::text), 300) ELSE 0 END +
                    CASE WHEN COALESCE(name, '') ILIKE :contains_term THEN 500 - LEAST(LENGTH(COALESCE(name::text, '')), 300) ELSE 0 END +
                    CASE WHEN id ~* :regex_term THEN 100 ELSE 0 END +
                    CASE WHEN COALESCE(name, '') ~* :regex_term THEN 100 ELSE 0 END
                ) AS relevance
            FROM search_results
            ORDER BY
                id, type,
                relevance DESC,
                CASE type
                    WHEN 'AERODROME' THEN 1
                    WHEN 'NAVAID' THEN 2
                    WHEN 'WAYPOINT' THEN 3
                    WHEN 'ATS_ROUTE' THEN 4
                    ELSE 5
                END,
                name ASC
        )
        SELECT * FROM final_search ORDER BY relevance DESC, name ASC LIMIT 20;
    """)

    with tracer.start_as_current_span(
        "search.execute",
        attributes={"search.query": q_clean, "search.token_count": len(tokens)},
    ) as span:
        result = await db.execute(query, {
            "exact_term": exact_term,
            "start_term": start_term,
            "contains_term": contains_term,
            "regex_term": regex_term
        })
        rows = result.fetchall()
        span.set_attribute("search.result_count", len(rows))

    output = []
    for r in rows:
        match = {
            "id": r.id,
            "name": r.name,
            "type": r.type,
            "center": [r.lng, r.lat] if r.lng is not None and r.lat is not None else None,
            "bounds": None,
            "route_type": r.route_type if hasattr(r, "route_type") else None,
            "properties": r.properties if hasattr(r, "properties") else {},
        }
        if r.min_lng is not None:
            match["bounds"] = [r.min_lng, r.min_lat, r.max_lng, r.max_lat]
        output.append(match)

    return [SearchResultResponse(**m) for m in output]
