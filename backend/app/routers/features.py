import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db

# Initialize the router
router = APIRouter(prefix="/api", tags=["Aero Plan"])


# ── AIP Section ID → Database JSON Key Mapping ──────────────────────────────
# Derived from AIPSchemaMapper.strategy_router (AD 2.2 – AD 2.24)
SECTION_MAP: dict[str, dict] = {
    "AD_2_2":  {"key": "geographical_data",                  "title": "Aerodrome Geographical and Administrative Data", "data_type": "object"},
    "AD_2_3":  {"key": "operational_hours",                  "title": "Operational Hours",                              "data_type": "object"},
    "AD_2_4":  {"key": "handling_services",                  "title": "Handling Services and Facilities",               "data_type": "object"},
    "AD_2_5":  {"key": "passenger_facilities",               "title": "Passenger Facilities",                           "data_type": "object"},
    "AD_2_6":  {"key": "rescue_and_fire_fighting",           "title": "Rescue and Fire Fighting Services",              "data_type": "object"},
    "AD_2_7":  {"key": "seasonal_clearing",                  "title": "Seasonal Availability — Clearing",               "data_type": "object"},
    "AD_2_8":  {"key": "aprons_taxiways_checkpoints",        "title": "Aprons, Taxiways and Check Locations",           "data_type": "object"},
    "AD_2_9":  {"key": "smgcs_markings",                     "title": "Surface Movement Guidance and Control System",   "data_type": "object"},
    "AD_2_10": {"key": "obstacles",                          "title": "Aerodrome Obstacles",                            "data_type": "array"},
    "AD_2_11": {"key": "meteorological_information",         "title": "Meteorological Information Provided",            "data_type": "object"},
    "AD_2_12": {"key": "runway_physical_characteristics",    "title": "Runway Physical Characteristics",                "data_type": "array"},
    "AD_2_13": {"key": "declared_distances",                 "title": "Declared Distances",                             "data_type": "array"},
    "AD_2_14": {"key": "approach_runway_lighting",           "title": "Approach and Runway Lighting",                   "data_type": "array"},
    "AD_2_15": {"key": "other_lighting_power_supply",        "title": "Other Lighting, Secondary Power Supply",         "data_type": "object"},
    "AD_2_16": {"key": "helicopter_landing_area",            "title": "Helicopter Landing Area",                        "data_type": "object"},
    "AD_2_17": {"key": "ats_airspace",                       "title": "ATS Airspace",                                   "data_type": "object"},
    "AD_2_18": {"key": "communications",                     "title": "ATS Communication Facilities",                   "data_type": "array"},
    "AD_2_19": {"key": "radio_navigation_and_landing_aids",  "title": "Radio Navigation and Landing Aids",              "data_type": "array"},
    "AD_2_20": {"key": "local_aerodrome_regulations",        "title": "Local Aerodrome Regulations",                    "data_type": "hybrid"},
    "AD_2_21": {"key": "noise_abatement_procedures",         "title": "Noise Abatement Procedures",                     "data_type": "hybrid"},
    "AD_2_22": {"key": "flight_procedures",                  "title": "Flight Procedures",                              "data_type": "hybrid"},
    "AD_2_23": {"key": "additional_information",             "title": "Additional Information",                          "data_type": "hybrid"},
    "AD_2_24": {"key": "charts_related_to_aerodrome",        "title": "Charts Related to an Aerodrome",                 "data_type": "array"},
}



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


@router.get("/aerodromes/{icao_code}/section/{section_id}")
async def get_aerodrome_section(icao_code: str, section_id: str, db: AsyncSession = Depends(get_db)):
    """
    Returns a specific AIP sub-section for an aerodrome.
    Uses SECTION_MAP to extract only the relevant JSONB fragment.
    """
    section_id_upper = section_id.upper()
    section_meta = SECTION_MAP.get(section_id_upper)
    if not section_meta:
        raise HTTPException(status_code=404, detail=f"Unknown section: {section_id}")

    json_key = section_meta["key"]

    query = text("""
        SELECT aip_document->'data'->:json_key AS section_data
        FROM aerodrome_documents
        WHERE icao_code = :icao;
    """)
    result = await db.execute(query, {"icao": icao_code.upper(), "json_key": json_key})
    row = result.fetchone()

    if not row or row[0] is None:
        raise HTTPException(status_code=404, detail=f"No data found for {icao_code.upper()} section {section_id_upper}")

    return {
        "section_id": section_id_upper,
        "title": section_meta["title"],
        "data_type": section_meta["data_type"],
        "data": row[0],
    }


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


@router.get("/aerodromes/{icao_code}/charts")
async def get_aerodrome_charts(icao_code: str, db: AsyncSession = Depends(get_db)):
    """
    Returns the list of available aerodrome charts for a given ICAO code.
    """
    query = text("""
        SELECT chart_id, chart_title, chart_index, chart_url
        FROM aerodrome_charts
        WHERE icao_code = :icao
        ORDER BY chart_index;
    """)
    result = await db.execute(query, {"icao": icao_code.upper()})
    rows = result.fetchall()
    return [
        {
            "chart_id": r.chart_id,
            "chart_title": r.chart_title,
            "chart_index": r.chart_index,
            "chart_url": r.chart_url,
        }
        for r in rows
    ]


@router.get("/proxy-pdf")
async def proxy_pdf(url: str = Query(..., description="Remote PDF URL to proxy")):
    """
    Proxies a remote PDF through the backend so the frontend can render it
    in an iframe without CORS issues.
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    }
    try:
        async with httpx.AsyncClient(
            follow_redirects=True, timeout=30.0, verify=False
        ) as client:
            resp = await client.get(url, headers=headers)
        if resp.status_code != 200:
            return Response(
                content=f"Upstream returned {resp.status_code}",
                status_code=resp.status_code,
            )
        return Response(
            content=resp.content,
            media_type="application/pdf",
            headers={"Content-Disposition": "inline"},
        )
    except httpx.RequestError as exc:
        return Response(content=f"Proxy error: {exc}", status_code=502)
