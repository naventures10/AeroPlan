import os
import re
import logging
import sys
from pathlib import Path
from dotenv import load_dotenv

# Initialize paths
BASE_DIR = Path("/Users/naveendevapalan/Desktop/Naveen/PROJECTS/eAIP/eaip_scrapper")
SCRATCH_DIR = BASE_DIR / "scratch"
OUTPUT_DIR = BASE_DIR / "output"
EXTRACTED_DIR = OUTPUT_DIR / "extracted_data"
MERGED_DIR = OUTPUT_DIR / "merged_data"
LOG_FILE = BASE_DIR / "rnp_etl_run.log"

load_dotenv(BASE_DIR / ".env")

def setup_logging(level=logging.INFO):
    """Configures centralized logging for the ETL process."""
    logging.basicConfig(
        level=level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(LOG_FILE),
            logging.StreamHandler()
        ],
        force=True
    )
    return logging.getLogger("RNP-ETL")

def dms_to_dd(degrees, minutes, seconds, direction):
    dd = float(degrees) + float(minutes)/60 + float(seconds)/(60*60)
    if direction in ['S', 'W']:
        dd *= -1
    return dd

def parse_coordinate(coord_str):
    if not coord_str or coord_str.strip() in ("-", "", "N/A"):
        return None, None
    coord_str = coord_str.replace('\n', ' ').replace('\r', '').strip()
    
    blocks = re.findall(
        r"(\d{2,3})[\s\u00b0:\'\x22\u2018\u2019\u201c\u201d]+(\d{2})[\s\u00b0:\'\x22\u2018\u2019\u201c\u201d]+(\d{2}(?:\.\d+)?)",
        coord_str
    )
    
    if len(blocks) < 2:
        lat_match = re.search(r'(\d{2})(\d{2})(\d{2}(?:\.\d+)?)[\s]*(?:N|S)', coord_str, re.IGNORECASE)
        lon_match = re.search(r'(\d{2,3})(\d{2})(\d{2}(?:\.\d+)?)[\s]*(?:E|W)', coord_str, re.IGNORECASE)
        if lat_match and lon_match:
            blocks = [lat_match.groups(), lon_match.groups()]
            
    if len(blocks) >= 2:
        lat = blocks[0]
        lon = blocks[1]
        lat_dir = 'S' if 'S' in coord_str.upper() else 'N'
        lon_dir = 'W' if 'W' in coord_str.upper() else 'E'
        try:
            lat_dd = dms_to_dd(lat[0], lat[1], lat[2], lat_dir)
            lon_dd = dms_to_dd(lon[0], lon[1], lon[2], lon_dir)
            return round(lat_dd, 7), round(lon_dd, 7)
        except (ValueError, IndexError):
            pass
    return None, None

def parse_altitude(alt_str):
    if not alt_str:
        return None
    alt_str = str(alt_str).upper().strip()
    matches = re.findall(r'(?:FL\s*(\d+))|([-+]?\s*\d+(?:\.\d+)?)', alt_str)
    
    vals = []
    for fl, num in matches:
        if fl:
            vals.append(float(fl) * 100)
        elif num:
            vals.append(abs(float(num.replace(' ', ''))))
            
    if not vals:
        return None
    return min(vals)

def sanitize_header(raw_header: str) -> str:
    h = raw_header.strip()
    h = re.sub(r'\s+', ' ', h).lower()
    h = re.sub(r'[°0\*]+[mMtT()/]*', '', h)
    h = re.sub(r'\([^)]*\)', '', h)
    h = re.sub(r'[°\'\"*`]', '', h).strip()
    
    if 'serial' in h or 'seq' in h: h = 'serial_number'
    elif 'waypoint' in h or 'fix ident' in h: h = 'waypoint_identifier'
    elif 'path' in h or 'terminator' in h: h = 'path_descriptor'
    elif 'fly' in h and 'over' in h: h = 'fly_over'
    elif 'course' in h: h = 'course'
    elif 'turn' in h: h = 'turn_direction'
    elif 'altitude' in h: h = 'altitude'
    elif 'speed' in h: h = 'speed_limit'
    elif 'dist' in h: h = 'distance'
    elif 'vpa' in h or 'va/' in h or 'tch' in h: h = 'vpa_tch'
    elif 'role' in h: h = 'role'
    elif 'nav' in h and 'spec' in h: h = 'nav_spec'
    
    h = re.sub(r'[^a-z0-9]+', '_', h).strip('_')
    if h == 'terminator': return 'path_descriptor'
    if h == 'designator': return 'path_descriptor'
    if h == 'ident': return 'waypoint_identifier'
    return h if h else 'unknown'

def clean_text(text):
    if not text:
        return None
    val = text.replace('\n', ' ').replace('\r', '').strip()
    val = val.strip('`').strip()
    val = re.sub(r'\s+', ' ', val)
    if val in ('-', '', 'N/A'):
        return None
    return val
