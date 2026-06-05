import logging
import os
import re
import sys
from pathlib import Path

import boto3
from dotenv import load_dotenv

# Initialize paths
BASE_DIR = Path(os.getenv("RNP_BASE_DIR", Path(__file__).resolve().parent.parent.parent))
SCRATCH_DIR = BASE_DIR / "scratch"
OUTPUT_DIR = BASE_DIR / "output"
EXTRACTED_DIR = OUTPUT_DIR / "extracted_data"
MERGED_DIR = OUTPUT_DIR / "merged_data"
LOG_FILE = BASE_DIR.parent / "logs" / "rnp_etl_run.log"

load_dotenv(BASE_DIR.parent / ".env")

# India bounding box (with generous margin for approach paths)
INDIA_LAT_MIN = 5.0
INDIA_LAT_MAX = 40.0
INDIA_LON_MIN = 66.0
INDIA_LON_MAX = 100.0


def setup_logging(level=logging.INFO):
    """Configures centralized logging for the eaip_scrapper.etl process."""
    # Ensure LOG_FILE directory exists
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)

    logging.basicConfig(
        level=level,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[logging.FileHandler(LOG_FILE), logging.StreamHandler(sys.stdout)],
        force=True,
    )
    return logging.getLogger("RNP-eaip_scrapper.etl")


def get_s3_client():
    """Initializes and returns a boto3 S3 client for MinIO using environment variables."""
    endpoint = os.getenv("MINIO_ENDPOINT", "http://localhost:9000")
    access_key = os.getenv("MINIO_ACCESS_KEY")
    secret_key = os.getenv("MINIO_SECRET_KEY")
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name="us-east-1",
    )


def dms_to_dd(degrees, minutes, seconds, direction):
    """Convert Degrees-Minutes-Seconds to Decimal Degrees."""
    dd = float(degrees) + float(minutes) / 60 + float(seconds) / (60 * 60)
    if direction in ("S", "W"):
        dd *= -1
    return dd


def is_valid_coord(lat, lon):
    """Check if a coordinate pair falls within valid ranges and India's airspace."""
    if lat is None or lon is None:
        return False
    if not (-90 <= lat <= 90):
        return False
    if not (-180 <= lon <= 180):
        return False
    # India-specific sanity check
    if not (INDIA_LAT_MIN <= lat <= INDIA_LAT_MAX):
        return False
    return INDIA_LON_MIN <= lon <= INDIA_LON_MAX


def parse_coordinate(coord_str):
    """
    Parse a coordinate string into (lat_dd, lon_dd).

    Handles these formats:
      1. "N 15:23:23.17 E 75:19:16.68"       — Direction-prefixed DMS with colons
      2. "15°23'23.17''N 75°19'16.68''E"      — DMS with degree/prime symbols
      3. "265049.2745N 0810506.6552E"          — Compact DDMMSS.ssss with trailing dir
      4. "N 22:50:58.77 E 88:35:26.81"        — Direction-prefixed DMS with spaces

    CRITICAL: Direction (N/S/E/W) is determined per-field, NOT by scanning the
    entire string for 'S' or 'W' (which would be poisoned by words like
    "Waypoint", "Serial", "RW…", etc.).
    """
    if not coord_str or coord_str.strip() in ("-", "", "N/A"):
        return None, None
    coord_str = coord_str.replace("\n", " ").replace("\r", "").strip()

    lat_dd = None
    lon_dd = None

    # ── Strategy 1: Compact format  DDMMSS.ffffD / DDDMMSS.ffffD ──────────
    # e.g. "265049.2745N" or "0810506.6552E"
    compact_lat = re.search(r"(\d{2})(\d{2})(\d{2}(?:\.\d+)?)\s*([NS])", coord_str, re.IGNORECASE)
    compact_lon = re.search(r"(\d{2,3})(\d{2})(\d{2}(?:\.\d+)?)\s*([EW])", coord_str, re.IGNORECASE)
    if compact_lat and compact_lon:
        lat_dir = compact_lat.group(4).upper()
        lon_dir = compact_lon.group(4).upper()
        lat_dd = dms_to_dd(
            compact_lat.group(1), compact_lat.group(2), compact_lat.group(3), lat_dir
        )
        lon_dd = dms_to_dd(
            compact_lon.group(1), compact_lon.group(2), compact_lon.group(3), lon_dir
        )
        lat_dd = round(lat_dd, 7)
        lon_dd = round(lon_dd, 7)
        if is_valid_coord(lat_dd, lon_dd):
            return lat_dd, lon_dd
        # If invalid, fall through to other strategies

    # ── Strategy 2: Direction-prefixed  "N dd:mm:ss.ss E ddd:mm:ss.ss" ────
    # Matches:  N 15:23:23.17  or  S 09°50'01.42"
    prefixed = re.findall(
        r"([NSEW])\s*(\d{1,3})\s*[:°\s]\s*(\d{1,2})\s*[:\'′\u2018\u2019\s]\s*(\d{1,2}(?:\.\d+)?)",
        coord_str,
        re.IGNORECASE,
    )
    if len(prefixed) >= 2:
        lat_part = None
        lon_part = None
        for direction, d, m, s in prefixed:
            direction = direction.upper()
            if direction in ("N", "S") and lat_part is None:
                lat_part = (d, m, s, direction)
            elif direction in ("E", "W") and lon_part is None:
                lon_part = (d, m, s, direction)
        if lat_part and lon_part:
            lat_dd = round(dms_to_dd(*lat_part), 7)
            lon_dd = round(dms_to_dd(*lon_part), 7)
            if is_valid_coord(lat_dd, lon_dd):
                return lat_dd, lon_dd

    # ── Strategy 3: Direction-suffixed  "dd°mm'ss.ss''N ddd°mm'ss.ss''E" ──
    suffixed = re.findall(
        r'(\d{1,3})\s*[:°\s]\s*(\d{1,2})\s*[:\'′\u2018\u2019\s]\s*(\d{1,2}(?:\.\d+)?)\s*[\'′"″\u2018\u2019\u201c\u201d\s]*\s*([NSEW])',
        coord_str,
        re.IGNORECASE,
    )
    if len(suffixed) >= 2:
        lat_part = None
        lon_part = None
        for d, m, s, direction in suffixed:
            direction = direction.upper()
            if direction in ("N", "S") and lat_part is None:
                lat_part = (d, m, s, direction)
            elif direction in ("E", "W") and lon_part is None:
                lon_part = (d, m, s, direction)
        if lat_part and lon_part:
            lat_dd = round(dms_to_dd(*lat_part), 7)
            lon_dd = round(dms_to_dd(*lon_part), 7)
            if is_valid_coord(lat_dd, lon_dd):
                return lat_dd, lon_dd

    # ── Strategy 4: Lat with direction, lon without direction ─────────────
    # e.g. "24:19:45.88N 86:28:25.19" — lon defaults to E (Indian airspace)
    lat_with_dir = re.search(
        r"(\d{1,3})\s*[:°]\s*(\d{1,2})\s*[:\'′]\s*(\d{1,2}(?:\.\d+)?)\s*([NS])",
        coord_str,
        re.IGNORECASE,
    )
    if lat_with_dir:
        # Look for a second DMS block (without direction) after the lat
        remaining = coord_str[lat_with_dir.end() :]
        lon_no_dir = re.search(
            r"(\d{1,3})\s*[:°]\s*(\d{1,2})\s*[:\'′]\s*(\d{1,2}(?:\.\d+)?)", remaining
        )
        if lon_no_dir:
            lat_dir = lat_with_dir.group(4).upper()
            lat_dd = round(
                dms_to_dd(
                    lat_with_dir.group(1),
                    lat_with_dir.group(2),
                    lat_with_dir.group(3),
                    lat_dir,
                ),
                7,
            )
            # Default to East for Indian airspace
            lon_dd = round(
                dms_to_dd(lon_no_dir.group(1), lon_no_dir.group(2), lon_no_dir.group(3), "E"),
                7,
            )
            if is_valid_coord(lat_dd, lon_dd):
                return lat_dd, lon_dd

    return None, None


def parse_altitude(alt_str):
    """Normalizes altitude strings into numeric feet (absolute values)."""
    if not alt_str:
        return None
    alt_str = str(alt_str).upper().strip()
    matches = re.findall(r"(?:FL\s*(\d+))|([-+]?\s*\d+(?:\.\d+)?)", alt_str)

    vals = []
    for fl, num in matches:
        if fl:
            vals.append(float(fl) * 100)
        elif num:
            vals.append(abs(float(num.replace(" ", ""))))

    if not vals:
        return None
    return min(vals)  # Return lower bound for safety profile


def sanitize_header(raw_header: str) -> str:
    """Convert a raw table header into a clean snake_case key."""
    h = raw_header.strip()
    h = re.sub(r"\s+", " ", h).lower()
    h = re.sub(r"[°\*]+[mMtT()/]*", "", h)
    h = re.sub(r"\([^)]*\)", "", h)
    h = re.sub(r"[°\'\"*`]", "", h).strip()

    if "transition" in h:
        h = "transition"
    elif "serial" in h or "seq" in h or "sl" in h:
        h = "serial_number"
    elif "waypoint" in h or "fix" in h or "ident" in h or "identifier" in h or h == "wpt":
        h = "waypoint_identifier"
    elif "path" in h or "terminator" in h or "descriptor" in h or "designator" in h:
        h = "path_descriptor"
    elif "fly" in h:
        h = "fly_over"
    elif "course" in h or "track" in h:
        h = "course"
    elif "turn" in h:
        h = "turn_direction"
    elif "altitude" in h:
        h = "altitude"
    elif "speed" in h:
        h = "speed_limit"
    elif "dist" in h or "dst" in h or "time" in h:
        h = "distance"
    elif "vpa" in h or "va/" in h or "tch" in h or "vertical" in h:
        h = "vpa_tch"
    elif "role" in h or "function" in h:
        h = "role"
    elif "nav" in h or "navigation" in h or "spec" in h:
        h = "nav_spec"

    h = re.sub(r"[^a-z0-9]+", "_", h).strip("_")
    if h == "terminator":
        return "path_descriptor"
    if h == "designator":
        return "path_descriptor"
    if h == "ident":
        return "waypoint_identifier"
    return h if h else "unknown"


def clean_text(text):
    """Clean raw cell text from OCR artifacts."""
    if not text:
        return None
    val = text.replace("\n", " ").replace("\r", "").strip()
    val = val.strip("`").strip()
    val = re.sub(r"\s+", " ", val)
    if val in ("-", "", "N/A"):
        return None
    return val


def normalize_course(course_str):
    """Normalize course values to [Mag]° M / [True]° T format."""
    if not course_str:
        return None
    val_clean = str(course_str).strip()
    if val_clean in ("-", "", "N/A"):
        return None
    matches = re.findall(r"(\d+(?:\.\d+)?)", val_clean)
    if len(matches) >= 2:
        return f"{matches[0]}° M / {matches[1]}° T"
    elif len(matches) == 1:
        return f"{matches[0]}° M / {matches[0]}° T"
    return None


def normalize_altitude(alt_str):
    """Normalize altitude constraint strings (e.g. +2000, -3000, @2000, +2600 / -5000)."""
    if not alt_str:
        return None
    val_clean = str(alt_str).strip()
    if val_clean in ("-", "", "N/A"):
        return None

    # Parse constraints using regex
    matches = re.findall(r"([\-+@]?)\s*(?:FL\s*)?(\d+(?:\.\d+)?)", val_clean, re.IGNORECASE)
    if not matches:
        return None

    parsed_constraints = []
    for prefix, value in matches:
        is_fl = "FL" in val_clean.upper() and bool(
            re.search(rf"FL\s*{value.split('.')[0]}", val_clean, re.I)
        )
        numeric_val = float(value)
        if is_fl:
            numeric_val *= 100
        int_val = int(numeric_val)

        # If no prefix is present, default to mandatory "@"
        if not prefix:
            prefix = "@"
        parsed_constraints.append((prefix, int_val))

    # Look for min (+) and max (-) constraints to form a window
    min_alt = next((val for pre, val in parsed_constraints if pre == "+"), None)
    max_alt = next((val for pre, val in parsed_constraints if pre == "-"), None)

    if min_alt is not None and max_alt is not None:
        return f"+{min_alt} / -{max_alt}"
    elif min_alt is not None:
        return f"+{min_alt}"
    elif max_alt is not None:
        return f"-{max_alt}"
    else:
        # Fallback to the first parsed constraint
        prefix, val = parsed_constraints[0]
        return f"{prefix}{val}"


def normalize_speed(speed_str):
    """Normalize speed constraint strings (e.g. -185, @230)."""
    if not speed_str:
        return None
    val_clean = str(speed_str).strip()
    if val_clean in ("-", "", "N/A"):
        return None

    match = re.search(r"([\-+@]?)\s*(\d+(?:\.\d+)?)", val_clean)
    if not match:
        return None

    prefix = match.group(1)
    if not prefix:
        prefix = "@"
    val = int(float(match.group(2)))
    return f"{prefix}{val}"


def normalize_distance(dist_str):
    """Normalize distance values (float string or time based e.g. 1 MIN)."""
    if not dist_str:
        return None
    val_clean = str(dist_str).strip()
    if val_clean in ("-", "", "N/A"):
        return None

    if "min" in val_clean.lower() or "minute" in val_clean.lower():
        match = re.search(r"(\d+)", val_clean)
        if match:
            return f"{match.group(1)} MIN"
        return None

    match = re.search(r"(\d+(?:\.\d+)?)", val_clean)
    if not match:
        return None

    val = float(match.group(1))
    if val.is_integer():
        return str(int(val))
    return f"{val:.2f}".rstrip("0").rstrip(".")


def normalize_vpa_tch(vt_str):
    """Normalize VPA/TCH values to -[Angle] / [TCH] format (e.g. -3.00 / 50)."""
    if not vt_str:
        return None
    val_clean = str(vt_str).strip()
    if val_clean in ("-", "", "N/A"):
        return None

    matches = re.findall(r"(-?\d+(?:\.\d+)?)", val_clean)
    if len(matches) >= 2:
        vpa = float(matches[0])
        tch = int(float(matches[1]))
        return f"-{abs(vpa):.2f} / {tch}"
    elif len(matches) == 1:
        vpa = float(matches[0])
        return f"-{abs(vpa):.2f}"
    return None


def normalize_nav_spec(ns_str):
    """Normalize navigation specifications (e.g. RNP APCH)."""
    if not ns_str:
        return None
    val_clean = str(ns_str).strip()
    if val_clean in ("-", "", "N/A"):
        return None

    ns_upper = val_clean.upper().replace(" ", "").replace("-", "")
    if "RNPAPCH" in ns_upper:
        return "RNP APCH"
    if "RNP1" in ns_upper:
        return "RNP 1"
    if "RNAV1" in ns_upper:
        return "RNAV 1"
    if "RNAV2" in ns_upper:
        return "RNAV 2"
    if "RNAV5" in ns_upper:
        return "RNAV 5"
    if "BAROVNAV" in ns_upper:
        return "BARO VNAV"
    return val_clean


def normalize_turn(turn_str):
    """Normalize turn directions to L or R."""
    if not turn_str:
        return None
    val_clean = str(turn_str).strip().upper()
    if "L" in val_clean:
        return "L"
    if "R" in val_clean:
        return "R"
    return None
