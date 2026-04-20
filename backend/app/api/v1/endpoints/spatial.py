"""
Spatial Features Router — 3D building/obstacle features for the terminal view.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.geojson import GeoJsonFeatureCollection

router = APIRouter(prefix="", tags=["Spatial"])


@router.get("/features/{icao_code}", response_model=GeoJsonFeatureCollection)
async def get_aerodrome_features(
    icao_code: str, db: AsyncSession = Depends(get_db)
) -> GeoJsonFeatureCollection:
    """
    Fetches 3D spatial features (obstacles, buildings) for a specific aerodrome.
    Returns a GeoJSON FeatureCollection natively from PostGIS.
    """
    query = text("""
        SELECT jsonb_build_object(
            'type', 'FeatureCollection',
            'features', COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'type',       'Feature',
                        'geometry',   ST_AsGeoJSON(geom)::jsonb,
                        'properties', jsonb_build_object(
                            'name', feature_name,
                            'height', elevation_m,
                            'category', feature_category
                        )
                    )
                ),
                '[]'::jsonb
            )
        ) AS geojson
        FROM spatial_features
        WHERE icao_code = :icao;
    """)
    result = await db.execute(query, {"icao": icao_code.upper()})
    row = result.fetchone()
    if row and row[0]:
        return GeoJsonFeatureCollection(**row[0])
    return GeoJsonFeatureCollection(type="FeatureCollection", features=[])
