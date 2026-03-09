from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db

# Initialize the router
router = APIRouter(prefix="/api", tags=["Aero Plan"])


@router.get("/aerodromes")
async def get_all_aerodromes(db: AsyncSession = Depends(get_db)):
    """
    Fetches all Aerodrome Reference Points (ARP) from spatial_features and aerodrome_documents
    Returns a GeoJSON FeatureCollection natively from PostGIS.
    """
    query = text("""
        SELECT jsonb_build_object(
            'type', 'FeatureCollection',
            'features', COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'type',       'Feature',
                        'geometry',   ST_AsGeoJSON(sf.geom)::jsonb,
                        'properties', jsonb_build_object(
                            'icao_code', sf.icao_code,
                            'name', ad.airport_name,
                            'elevation', sf.elevation_m
                        )
                    )
                ),
                '[]'::jsonb
            )
        ) AS geojson
        FROM spatial_features sf
        JOIN aerodrome_documents ad ON sf.icao_code = ad.icao_code
        WHERE sf.feature_category = 'ARP';
    """)
    result = await db.execute(query)
    row = result.fetchone()
    if row and row[0]:
        return row[0]
    return {"type": "FeatureCollection", "features": []}


@router.get("/aerodromes/{icao_code}/metadata")
async def get_aerodrome_metadata(icao_code: str, db: AsyncSession = Depends(get_db)):
    """
    Fetches the JSONB AIP document metadata for a specific aerodrome to power tooltips.
    """
    query = text("""
        SELECT aip_document
        FROM aerodrome_documents
        WHERE icao_code = :icao;
    """)
    result = await db.execute(query, {"icao": icao_code.upper()})
    row = result.fetchone()
    if row and row[0]:
        return row[0]
    return {}


@router.get("/features/{icao_code}")
async def get_aerodrome_features(icao_code: str, db: AsyncSession = Depends(get_db)):
    """
    Fetches 3D spatial features (obstacles, buildings) for a specific aerodrome.
    Returns a perfectly formatted GeoJSON FeatureCollection natively from PostGIS.
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
        return row[0]
    return {"type": "FeatureCollection", "features": []}
