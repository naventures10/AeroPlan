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
                            'elevation', substring(ad.aip_document->'data'->'geographical_data'->>'elevation_reference_temp' from '([0-9.]+)\\s*FT'),
                            'magnetic_variation', ad.aip_document->'data'->'geographical_data'->>'magnetic_variation',
                            'remarks', COALESCE(ad.aip_document->'data'->'geographical_data'->>'remarks', 'None'),
                            'communications', ad.aip_document->'data'->'communications'
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


@router.get("/search")
async def global_search(q: str, db: AsyncSession = Depends(get_db)):
    """
    Searches across Aerodromes, NavAids, Waypoints, and ATS Routes.
    Calculates geographic center and bounding boxes (ST_Extent) for LineStrings (ATS Routes) 
    so the frontend can frame them nicely on click.
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
            "bounds": None
        }
        
        # If the query calculated an ST_Extent (bounding box), inject it
        if r.min_lng is not None:
            match["bounds"] = [r.min_lng, r.min_lat, r.max_lng, r.max_lat]
            
        output.append(match)
        
    return output
