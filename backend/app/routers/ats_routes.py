"""
ATS Routes Router — Handles ATS route segments, waypoints, and labels.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db

router = APIRouter(prefix="/api", tags=["ATS Routes"])


@router.get("/ats-route-labels")
async def get_ats_route_labels(db: AsyncSession = Depends(get_db)):
    """
    Returns the midpoints of all ATS route segments as GeoJSON points.
    Includes route_id, route_type, and the segment bearing for labeling.
    """
    query = text("""
        SELECT jsonb_build_object(
            'type', 'FeatureCollection',
            'features', COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'type',       'Feature',
                        'geometry',   ST_AsGeoJSON(
                            ST_Transform(
                                ST_LineInterpolatePoint(ST_Transform(geom, 3857), 0.5), 
                            4326)
                        )::jsonb,
                        'properties', jsonb_build_object(
                            'id', id,
                            'route_id', route_id,
                            'route_type', route_type,
                            'bearing', (
                                CASE 
                                    WHEN (90 - degrees(ST_Azimuth(
                                        ST_Transform(ST_LineInterpolatePoint(ST_Transform(geom, 3857), 0.49), 4326),
                                        ST_Transform(ST_LineInterpolatePoint(ST_Transform(geom, 3857), 0.51), 4326)
                                    ))) < -90 
                                    THEN (90 - degrees(ST_Azimuth(
                                        ST_Transform(ST_LineInterpolatePoint(ST_Transform(geom, 3857), 0.49), 4326),
                                        ST_Transform(ST_LineInterpolatePoint(ST_Transform(geom, 3857), 0.51), 4326)
                                    ))) + 180
                                    ELSE (90 - degrees(ST_Azimuth(
                                        ST_Transform(ST_LineInterpolatePoint(ST_Transform(geom, 3857), 0.49), 4326),
                                        ST_Transform(ST_LineInterpolatePoint(ST_Transform(geom, 3857), 0.51), 4326)
                                    )))
                                END
                            )
                        )
                    )
                ),
                '[]'::jsonb
            )
        ) AS geojson
        FROM v_ats_route_segments;
    """)
    result = await db.execute(query)
    row = result.fetchone()
    if row and row[0]:
        return row[0]
    return {"type": "FeatureCollection", "features": []}
