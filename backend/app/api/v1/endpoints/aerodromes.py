"""
Aerodromes Router — Aerodrome data, metadata, and AIP section lookups.
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.aerodrome import AerodromeSectionResponse
from app.schemas.geojson import GeoJsonFeatureCollection

router = APIRouter(prefix="", tags=["Aerodromes"])


# ── AIP Section ID → Database JSON Key Mapping ──────────────────────────────
SECTION_MAP: dict[str, dict] = {
    "AD_2_2": {
        "key": "geographical_data",
        "title": "Aerodrome Geographical and Administrative Data",
        "data_type": "object",
    },
    "AD_2_3": {"key": "operational_hours", "title": "Operational Hours", "data_type": "object"},
    "AD_2_4": {
        "key": "handling_services",
        "title": "Handling Services and Facilities",
        "data_type": "object",
    },
    "AD_2_5": {
        "key": "passenger_facilities",
        "title": "Passenger Facilities",
        "data_type": "object",
    },
    "AD_2_6": {
        "key": "rescue_and_fire_fighting",
        "title": "Rescue and Fire Fighting Services",
        "data_type": "object",
    },
    "AD_2_7": {
        "key": "seasonal_clearing",
        "title": "Seasonal Availability — Clearing",
        "data_type": "object",
    },
    "AD_2_8": {
        "key": "aprons_taxiways_checkpoints",
        "title": "Aprons, Taxiways and Check Locations",
        "data_type": "object",
    },
    "AD_2_9": {
        "key": "smgcs_markings",
        "title": "Surface Movement Guidance and Control System",
        "data_type": "object",
    },
    "AD_2_10": {"key": "obstacles", "title": "Aerodrome Obstacles", "data_type": "array"},
    "AD_2_11": {
        "key": "meteorological_information",
        "title": "Meteorological Information Provided",
        "data_type": "object",
    },
    "AD_2_12": {
        "key": "runway_physical_characteristics",
        "title": "Runway Physical Characteristics",
        "data_type": "array",
    },
    "AD_2_13": {"key": "declared_distances", "title": "Declared Distances", "data_type": "array"},
    "AD_2_14": {
        "key": "approach_runway_lighting",
        "title": "Approach and Runway Lighting",
        "data_type": "array",
    },
    "AD_2_15": {
        "key": "other_lighting_power_supply",
        "title": "Other Lighting, Secondary Power Supply",
        "data_type": "object",
    },
    "AD_2_16": {
        "key": "helicopter_landing_area",
        "title": "Helicopter Landing Area",
        "data_type": "object",
    },
    "AD_2_17": {"key": "ats_airspace", "title": "ATS Airspace", "data_type": "object"},
    "AD_2_18": {
        "key": "communications",
        "title": "ATS Communication Facilities",
        "data_type": "array",
    },
    "AD_2_19": {
        "key": "radio_navigation_and_landing_aids",
        "title": "Radio Navigation and Landing Aids",
        "data_type": "array",
    },
    "AD_2_20": {
        "key": "local_aerodrome_regulations",
        "title": "Local Aerodrome Regulations",
        "data_type": "hybrid",
    },
    "AD_2_21": {
        "key": "noise_abatement_procedures",
        "title": "Noise Abatement Procedures",
        "data_type": "hybrid",
    },
    "AD_2_22": {"key": "flight_procedures", "title": "Flight Procedures", "data_type": "hybrid"},
    "AD_2_23": {
        "key": "additional_information",
        "title": "Additional Information",
        "data_type": "hybrid",
    },
    "AD_2_24": {
        "key": "charts_related_to_aerodrome",
        "title": "Charts Related to an Aerodrome",
        "data_type": "array",
    },
}


@router.get("/aerodromes", response_model=GeoJsonFeatureCollection)
async def get_all_aerodromes(db: AsyncSession = Depends(get_db)) -> GeoJsonFeatureCollection:
    """
    Fetches all Aerodrome Reference Points (ARP) from spatial_features and aerodrome_documents.
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
                            'communications', ad.aip_document->'data'->'communications',
                            'notam_count', (
                                SELECT count(*)
                                FROM notams n
                                WHERE n.airport_icao = sf.icao_code
                                  AND (n.valid_from IS NULL OR n.valid_from <= NOW())
                                  AND (n.valid_to >= NOW() OR n.is_permanent = TRUE)
                            )
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
        return GeoJsonFeatureCollection(**row[0])
    return GeoJsonFeatureCollection(type="FeatureCollection", features=[])


@router.get("/aerodromes/{icao_code}/metadata", response_model=dict[str, Any])
async def get_aerodrome_metadata(
    icao_code: str, db: AsyncSession = Depends(get_db)
) -> dict[str, Any]:
    """Fetches the JSONB AIP document metadata for a specific aerodrome."""
    query = text("""
        SELECT aip_document
        FROM aerodrome_documents
        WHERE icao_code = :icao;
    """)
    result = await db.execute(query, {"icao": icao_code.upper()})
    row = result.fetchone()
    if row and row[0]:
        return row[0] if isinstance(row[0], dict) else {}
    return {}


@router.get("/aerodromes/{icao_code}/section/{section_id}", response_model=AerodromeSectionResponse)
async def get_aerodrome_section(
    icao_code: str,
    section_id: str,
    db: AsyncSession = Depends(get_db),
) -> AerodromeSectionResponse:
    """Returns a specific AIP sub-section for an aerodrome."""
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
        raise HTTPException(
            status_code=404,
            detail=f"No data found for {icao_code.upper()} section {section_id_upper}",
        )

    return AerodromeSectionResponse(
        section_id=section_id_upper,
        title=section_meta["title"],
        data_type=section_meta["data_type"],
        data=row[0],
    )
