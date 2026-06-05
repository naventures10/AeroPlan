import logging
import math
import os
import re

import psycopg2
from dotenv import load_dotenv

from eaip_scrapper.rnp_processor.utils import normalize_distance, parse_altitude

load_dotenv()

logger = logging.getLogger("RNP-eaip_scrapper.etl.Geometry")

FT_TO_M = 0.3048


def haversine_nm(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    """Calculate the Great-Circle distance between two points in NM."""
    # Radius of Earth in NM
    R = 3440.065

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))

    return R * c


def project_point(lon: float, lat: float, brg_true: float, dist_nm: float) -> list[float]:
    """Project a coordinate from (lon, lat) given a true bearing and distance in NM."""
    R = 3440.065

    lat_rad = math.radians(lat)
    lon_rad = math.radians(lon)
    brg_rad = math.radians(brg_true)

    d_div_r = dist_nm / R

    lat_out = math.asin(
        math.sin(lat_rad) * math.cos(d_div_r)
        + math.cos(lat_rad) * math.sin(d_div_r) * math.cos(brg_rad)
    )
    lon_out = lon_rad + math.atan2(
        math.sin(brg_rad) * math.sin(d_div_r) * math.cos(lat_rad),
        math.cos(d_div_r) - math.sin(lat_rad) * math.sin(lat_out),
    )

    lon_out = (lon_out + math.pi) % (2.0 * math.pi) - math.pi

    return [math.degrees(lon_out), math.degrees(lat_out)]


def extract_true_course(course_str: str | None) -> float | None:
    """Extract the true bearing from a course string formatted as '[Mag]° M / [True]° T'."""
    if not course_str:
        return None
    match = re.search(r"/\s*(\d+(?:\.\d+)?)°\s*T", course_str)
    if match:
        return float(match.group(1))
    match = re.search(r"(\d+(?:\.\d+)?)", course_str)
    if match:
        return float(match.group(1))
    return None


def get_runway_threshold_coords(airport_id: str, runway: str) -> list[float] | None:
    """Query the aerodrome_documents table to find the runway threshold coordinates."""
    postgres_password = os.getenv("POSTGRES_PASSWORD")
    if not postgres_password:
        return None

    db_config = {
        "host": os.getenv("POSTGRES_HOST", "localhost"),
        "port": int(os.getenv("POSTGRES_PORT", 5432)),
        "database": os.getenv("POSTGRES_DB", "aeronautical_information_system"),
        "user": os.getenv("POSTGRES_USER", "postgres"),
        "password": postgres_password,
    }

    try:
        with psycopg2.connect(**db_config) as conn, conn.cursor() as cur:
            cur.execute(
                "SELECT aip_document->'data'->'runway_physical_characteristics' FROM aerodrome_documents WHERE UPPER(icao_code) = UPPER(%s)",
                (airport_id,),
            )
            row = cur.fetchone()
            if row and row[0]:
                rwy_chars = row[0]
                target_rwy = str(runway).strip().upper()
                target_rwy_padded = target_rwy.zfill(2)
                for char in rwy_chars:
                    designation = str(char.get("designation") or "").strip().upper()
                    if designation in (target_rwy, target_rwy_padded):
                        coords = char.get("coordinates", {})
                        lat = coords.get("decimal_lat")
                        lng = coords.get("decimal_lng")
                        if lat is not None and lng is not None:
                            elev_ft = 0.0
                            elev_str = char.get("thr_elevation", "")
                            m = re.search(r"THR:\s*([\d\.]+)", str(elev_str))
                            if m:
                                elev_ft = float(m.group(1))
                            return [float(lng), float(lat), elev_ft * FT_TO_M]
    except Exception as e:
        logger.debug(f"Failed to query runway coords from DB for {airport_id}-{runway}: {e}")
    return None


def reconstruct_path_3d(proc_data: dict) -> list[list[float]]:
    """Reconstruct the 3D geometry of the procedure by projecting legs

    and interpolating altitudes, similar to backend app/services/rnp_service.py.
    Also programmatically updates missing leg distances in-place.
    Returns a list of [lon, lat, alt_m] points.
    """
    # 1. Build waypoint lookup
    wpt_lookup = {}
    for wp in proc_data.get("waypoints", []):
        wid = str(wp.get("waypoint_id") or "").strip().upper()
        lat = wp.get("lat_dd")
        lon = wp.get("lon_dd")
        if wid and lat is not None and lon is not None:
            wpt_lookup[wid] = (lat, lon)

    # 2. Determine initial position (runway threshold for SIDs)
    is_sid = (
        str(proc_data.get("procedure_type") or "").upper() == "SID"
        or "SID" in str(proc_data.get("procedure_name") or "").upper()
        or "DEPARTURE" in str(proc_data.get("procedure_name") or "").upper()
    )
    rwy = str(proc_data.get("runway") or "").strip().upper()
    initial_pos = None
    if rwy:
        # Search for a runway waypoint like 'RW05' or 'RWY05' in waypoint list
        rwy_wpt_key = next((k for k in wpt_lookup if k.startswith("RW") and rwy in k), None)
        if rwy_wpt_key:
            lat, lon = wpt_lookup[rwy_wpt_key]
            initial_pos = [lon, lat, None]
        else:
            # Fallback: Query aerodrome runway characteristics in database
            airport_id = str(proc_data.get("airport_id") or "").strip().upper()
            db_coords = get_runway_threshold_coords(airport_id, rwy)
            if db_coords:
                initial_pos = db_coords

    path_3d = []

    # If it is a SID, start at the runway threshold if available
    if is_sid and initial_pos:
        path_3d.append([initial_pos[0], initial_pos[1], initial_pos[2]])

    # Default initial altitude to 10000 ft or first leg altitude
    start_alt_ft = 10000.0
    for leg in proc_data.get("tabular_description", []):
        alt = parse_altitude(leg.get("altitude"))
        if alt is not None:
            start_alt_ft = alt
            break

    for leg in proc_data.get("tabular_description", []):
        path = str(leg.get("path_descriptor") or "").upper()
        ident = str(leg.get("waypoint_identifier") or "").strip().upper()

        alt_ft = parse_altitude(leg.get("altitude"))
        alt_m = alt_ft * FT_TO_M if alt_ft is not None else None

        coords = wpt_lookup.get(ident) if ident else None
        if coords:
            lat, lon = coords

            # In-place distance calculation for TF/CF legs missing distance
            if path in ("TF", "CF") and not leg.get("distance"):
                if path_3d:
                    prev_lon, prev_lat = path_3d[-1][0], path_3d[-1][1]
                    dist = haversine_nm(prev_lon, prev_lat, lon, lat)
                    leg["distance"] = normalize_distance(str(dist))
                    logger.info(
                        f"Resolved missing distance for {path} leg to {ident}: {leg['distance']} NM"
                    )

            if not path_3d or (path_3d[-1][0] != lon or path_3d[-1][1] != lat):
                path_3d.append([lon, lat, alt_m])
            else:
                if alt_m is not None and path_3d[-1][2] is None:
                    path_3d[-1][2] = alt_m
        else:
            # Reconstruct missing coordinate for heading/vector legs (CA, VA, VI, CF, DF, VM, FA, HM)
            if path_3d and path in ("CA", "VA", "VI", "CF", "DF", "HM", "FA", "VM"):
                course_true = extract_true_course(leg.get("course"))
                if course_true is not None:
                    dist_nm = None
                    dist_str = leg.get("distance")
                    if dist_str:
                        try:
                            clean_dist = str(dist_str).replace("NM", "").replace("MIN", "").strip()
                            dist_nm = float(clean_dist)
                        except ValueError:
                            pass

                    if dist_nm is None:
                        # Fallback calculation using altitude difference
                        prev_alt_m = path_3d[-1][2]
                        if prev_alt_m is not None and alt_m is not None:
                            climb_ft = (alt_m - prev_alt_m) / FT_TO_M
                            dist_nm = max(climb_ft / 200.0, 2.5) if climb_ft > 0 else 3.0
                        else:
                            dist_nm = 3.0

                    v_lon, v_lat = project_point(
                        path_3d[-1][0], path_3d[-1][1], course_true, dist_nm
                    )
                    path_3d.append([v_lon, v_lat, alt_m])

    if not path_3d:
        return []

    # Assign start/end altitudes
    if path_3d[0][2] is None:
        path_3d[0][2] = start_alt_ft * FT_TO_M
    if path_3d[-1][2] is None:
        path_3d[-1][2] = path_3d[0][2]

    # Linear interpolation for middle altitudes
    for i in range(1, len(path_3d) - 1):
        if path_3d[i][2] is None:
            prev_idx = i - 1
            next_idx = i + 1
            while next_idx < len(path_3d) and path_3d[next_idx][2] is None:
                next_idx += 1

            alt_prev = path_3d[prev_idx][2]
            alt_next = path_3d[next_idx][2]

            dist_prev = sum(
                haversine_nm(path_3d[j][0], path_3d[j][1], path_3d[j + 1][0], path_3d[j + 1][1])
                for j in range(prev_idx, i)
            )
            dist_next = sum(
                haversine_nm(path_3d[j][0], path_3d[j][1], path_3d[j + 1][0], path_3d[j + 1][1])
                for j in range(i, next_idx)
            )

            total_dist = dist_prev + dist_next
            if total_dist > 0:
                path_3d[i][2] = alt_prev + (alt_next - alt_prev) * (dist_prev / total_dist)
            else:
                path_3d[i][2] = alt_prev

    return path_3d
