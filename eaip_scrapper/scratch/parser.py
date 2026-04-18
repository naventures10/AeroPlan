import os
import glob
import json
from bs4 import BeautifulSoup
import re


# ── Coordinate Helpers ─────────────────────────────────────────────────────────

def dms_to_dd(degrees, minutes, seconds, direction):
    dd = float(degrees) + float(minutes)/60 + float(seconds)/(60*60)
    if direction in ['S', 'W']:
        dd *= -1
    return dd

def parse_coordinate(coord_str):
    if not coord_str or coord_str.strip() == "-" or coord_str.strip() == "":
        return None, None
    coord_str = coord_str.replace('\n', ' ').replace('\r', '').strip()
    
    # Extract sets of D, M, S numbers regardless of separators
    blocks = re.findall(
        r"(\d{2,3})[\s\u00b0:\'\x22\u2018\u2019\u201c\u201d]+(\d{2})[\s\u00b0:\'\x22\u2018\u2019\u201c\u201d]+(\d{2}(?:\.\d+)?)",
        coord_str
    )
    
    if len(blocks) < 2:
        # Try finding continuous sequence DDMMSS.SS lacking delimiters
        lat_match = re.search(r'(\d{2})(\d{2})(\d{2}(?:\.\d+)?)[\s]*(?:N|S)', coord_str, re.IGNORECASE)
        lon_match = re.search(r'(\d{2,3})(\d{2})(\d{2}(?:\.\d+)?)[\s]*(?:E|W)', coord_str, re.IGNORECASE)
        
        if lat_match and lon_match:
            blocks = [lat_match.groups(), lon_match.groups()]
            
    if len(blocks) >= 2:
        lat = blocks[0]
        lon = blocks[1]
        
        # Determine direction from characters present
        lat_dir = 'S' if 'S' in coord_str.upper() else 'N'
        lon_dir = 'W' if 'W' in coord_str.upper() else 'E'
        
        lat_dd = dms_to_dd(lat[0], lat[1], lat[2], lat_dir)
        lon_dd = dms_to_dd(lon[0], lon[1], lon[2], lon_dir)
        return round(lat_dd, 7), round(lon_dd, 7)
        
    return None, None

def clean_text(text):
    if not text:
        return None
    val = text.replace('\n', ' ').replace('\r', '').strip()
    # Remove stray backticks from OCR artifacts
    val = val.strip('`').strip()
    val = re.sub(r'\s+', ' ', val)
    if val == '-' or val == '':
        return None
    return val


# ── Header Normalization ───────────────────────────────────────────────────────

def sanitize_header(raw_header: str) -> str:
    """
    Convert a raw table header like 'Course °M(°T)' or 'Fly-Over'
    into a clean snake_case key like 'course' or 'fly_over'.
    """
    h = raw_header.strip()
    h = re.sub(r'\s+', ' ', h)         # collapse whitespace
    h = h.lower()
    # Remove units and parenthetical notes: (ft), (Nm), °M(°T), etc.
    h = re.sub(r'[°0\*]+[mMtT()/]*', '', h)   # degree symbols + M/T markers
    h = re.sub(r'\([^)]*\)', '', h)            # anything in parens
    h = re.sub(r'[°\'\"*`]', '', h)            # stray symbols
    h = h.strip()
    # Known synonym normalization
    h = re.sub(r'\bsl\.?\s*no\.?\b', 'serial_number', h)
    h = re.sub(r'\bserial_?\s*no\.?\b', 'serial_number', h)
    h = re.sub(r'\bseq\.?\s*n[or]\.?\b', 'serial_number', h)
    h = re.sub(r'\bseq\.?\s*num\b', 'serial_number', h)
    h = re.sub(r'\bserial\s*number\b', 'serial_number', h)
    h = re.sub(r'\bfix\s*ident(?:ifier)?\b', 'waypoint_identifier', h)
    h = re.sub(r'\bwaypoint\s*ident(?:ifier)?\b', 'waypoint_identifier', h)
    h = re.sub(r'\bpath\s*(?:and\s*)?(?:descriptor|designator|terminator)\b', 'path_descriptor', h)
    h = re.sub(r'\bpath\s*description\b', 'path_descriptor', h)
    h = re.sub(r'\bfly[\s\-–]*over\b', 'fly_over', h)
    h = re.sub(r'\bcourse(?:\s*angle)?\b', 'course', h)
    h = re.sub(r'\bturn\s*(?:direction)?\b', 'turn_direction', h)
    h = re.sub(r'\bupper\s*limit\s*altitude\b', 'altitude_upper', h)
    h = re.sub(r'\blower\s*limit\s*altitude\b', 'altitude_lower', h)
    h = re.sub(r'\baltitude\b', 'altitude', h)
    h = re.sub(r'\bspeed\s*limit\b', 'speed_limit', h)
    h = re.sub(r'\bdistance/?(?:\s*time)?\b', 'distance', h)
    h = re.sub(r'\btm\s*dst\b', 'distance', h)
    h = re.sub(r'\bdst/?time\b', 'distance', h)
    h = re.sub(r'\bv(?:pa|a)/?tch\b', 'vpa_tch', h)
    h = re.sub(r'\bvertical\s*angle\b', 'vpa_tch', h)
    h = re.sub(r'\bva\b', 'vpa_tch', h)
    h = re.sub(r'\brole(?:\s*of\s*the\s*fix)?\b', 'role', h)
    h = re.sub(r'\bnavigation\s*specification\b', 'nav_spec', h)
    h = re.sub(r'\biap\s*transition\s*ident\b', 'iap_transition', h)
    # Final cleanup: replace remaining non-alnum with underscore
    h = re.sub(r'[^a-z0-9]+', '_', h)
    h = h.strip('_')
    # Collapse multiple underscores
    h = re.sub(r'_+', '_', h)
    
    # Specific common aeronautical abbreviations normalization
    if h == 'terminator': return 'path_descriptor'
    if h == 'designator': return 'path_descriptor'
    if h == 'ident': return 'waypoint_identifier'
    
    return h if h else 'unknown'


def is_header_row(cells: list[str]) -> bool:
    """Detect if a row is a header row for Tabular Description."""
    text = ' '.join(c or '' for c in cells).lower()
    return any(k in text for k in ['serial number', 'path descriptor', 'waypoint identifier', 'fly-over', 'course', 'path terminator'])


def is_waypoint_header_row(cells: list[str]) -> bool:
    """Detect if a row is a header row for Waypoint List."""
    text = ' '.join(c or '' for c in cells).lower()
    return 'latitude' in text and 'longitude' in text and 'ident' in text


# ── FAS Detection ──────────────────────────────────────────────────────────────

FAS_KEYWORDS = ["operation type", "calculated crc", "fpap", "ltp/ftp"]

def is_fas_row(tr_text: str) -> bool:
    """Check if a row belongs to a FAS DATA BLOCK."""
    return any(kw in tr_text for kw in FAS_KEYWORDS)


# ── Table Classification ──────────────────────────────────────────────────────

def classify_table(table) -> str:
    """
    Returns 'tabular', 'waypoint', 'fas', or 'unknown'.
    Based on header content and row patterns.
    """
    text_lower = table.get_text(separator=' ').lower()
    
    # FAS DATA BLOCK
    if ("operation type" in text_lower and "ltp/ftp" in text_lower):
        return 'fas'
    
    # Tabular / sequence table
    if any(k in text_lower for k in ['serial', 'path', 'descriptor', 'designator', 'terminator', 'seq num', 'sl. no', 'sl no']):
        return 'tabular'
    
    # Waypoint / coordinate table
    if any(k in text_lower for k in ['coordinate', 'latitude', 'longitude', 'waypoint information', 'waypoint list']):
        return 'waypoint'
    
    # Content-based fallback: look for coordinate patterns
    COORD_PATTERN = re.compile(
        r'[NS]\s*\d{1,3}[\s:°]|'
        r'\d{1,3}[\s°].*[NS]',
        re.IGNORECASE
    )
    sample_rows = table.find_all('tr')[:5]
    for row in sample_rows:
        if COORD_PATTERN.search(row.get_text(separator=' ')):
            return 'waypoint'
    
    return 'unknown'


# ── Header Extraction ──────────────────────────────────────────────────────────

def extract_headers(table) -> list[str]:
    """
    Extract column headers from a table.
    Strategy:
      1. Look for <th> elements in the first few rows
      2. If no <th>, look for the first row that looks like a header
    Returns a list of sanitized header keys.
    """
    rows = table.find_all('tr')
    
    for row in rows[:3]:
        ths = row.find_all('th')
        if ths:
            raw_headers = []
            for th in ths:
                colspan = int(th.get('colspan', 1))
                header_text = th.get_text(separator=' ', strip=True)
                sanitized = sanitize_header(header_text)
                if colspan > 1 and sanitized in ('', 'unknown'):
                    # Skip spanning title headers like "RNP Y RWY 28"
                    continue
                raw_headers.append(sanitized)
            if len(raw_headers) >= 5:  # Must have enough columns to be a real header
                return raw_headers
    
    # Fallback: check first row with <td> that looks header-like
    for row in rows[:3]:
        tds = row.find_all('td')
        if len(tds) >= 5:
            texts = [td.get_text(separator=' ', strip=True).lower() for td in tds]
            if any(k in ' '.join(texts) for k in ['serial', 'path', 'waypoint', 'seq', 'fix']):
                return [sanitize_header(td.get_text(separator=' ', strip=True)) for td in tds]
    
    return []


def deduplicate_headers(headers: list[str]) -> list[str]:
    """
    Handle duplicate header names by appending _1, _2, etc.
    Also handles the common case of two 'altitude' columns → altitude_upper, altitude_lower.
    """
    seen = {}
    result = []
    
    # Special case: detect two altitude columns
    alt_indices = [i for i, h in enumerate(headers) if h == 'altitude']
    
    for i, h in enumerate(headers):
        # Specific re-mapping for Holding tables if mixed in
        if 'track' in h and 'inbound' in h: h = 'course'
        if 'holding' in h and 'altitude' in h: h = 'altitude'
        if 'fix' in h and 'holding' in h: h = 'waypoint_identifier'
        if 'terminator' in h: h = 'path_descriptor'
        
        if h == 'altitude' and len(alt_indices) == 2:
            if i == alt_indices[0]:
                result.append('altitude_upper')
            else:
                result.append('altitude_lower')
        elif h in seen:
            seen[h] += 1
            result.append(f'{h}_{seen[h]}')
        else:
            seen[h] = 1
            result.append(h)
    
    return result


def realign_row(row_data: dict) -> dict:
    """
    Heuristic to fix column shifts. 
    E.g., if 'vpa_tch' contains a Role like 'IAF', shift it to 'role'.
    """
    roles = {'IAF', 'IF', 'FAF', 'MAPT', 'MATF', 'MAHF', 'LTP', 'FTP', 'FAP', 'THR', 'MAPT/MATF'}
    
    # Check for Shift 1: Role in VPA/TCH column
    vpa_key = next((k for k in row_data if 'vpa' in k or 'tch' in k), None)
    role_key = next((k for k in row_data if 'role' in k), None)
    nav_spec_key = next((k for k in row_data if 'nav_spec' in k), None)
    
    if vpa_key and row_data[vpa_key] and str(row_data[vpa_key]).strip().upper() in roles:
        role_val = row_data[vpa_key]
        nav_val = row_data.get(role_key)
        # Shift
        row_data[vpa_key] = None
        if role_key:
            row_data[role_key] = role_val
        if nav_spec_key and nav_val:
            row_data[nav_spec_key] = nav_val
            
    return row_data


# ── Tabular Data Extraction ───────────────────────────────────────────────────

def is_data_row(cells: list[str]) -> bool:
    """Check if a row contains actual data (not empty separator or sub-header)."""
    non_empty = [c for c in cells if c is not None]
    if len(non_empty) == 0:
        return False
    # Single-cell spanning rows are section headers
    if len(non_empty) == 1 and len(cells) <= 2:
        return False
    return True


def extract_tabular_data(table, headers: list[str]) -> list[dict]:
    """
    Extract tabular description rows using the header-derived column map.
    """
    rows = table.find_all('tr')
    data = []
    
    active_headers = headers
    
    for row in rows:
        tds = row.find_all('td')
        if not tds:
            continue
        
        # Detect row cells
        flat_cells = []
        for td in tds:
            colspan = int(td.get('colspan', 1))
            cleaned = clean_text(td.get_text(separator=' ', strip=True))
            flat_cells.extend([cleaned] * colspan)
        
        # Skip section headers / titles
        if len(tds) == 1 and int(tds[0].get('colspan', 1)) > 5:
            continue
            
        row_text = ' '.join(c or '' for c in flat_cells).lower()

        # Stop if we hit a waypoint list header mid-table
        if is_waypoint_header_row(flat_cells):
            break
            
        # Detect header changes mid-table -> Stop extraction (avoiding schema mismatch)
        if is_header_row(flat_cells):
            # If it's the very first possible header row, we might already have active_headers from extract_headers()
            # If it's a DIFFERENT header row later, we should stop to avoid mixing schemas
            row_headers = [sanitize_header(c or '') for c in flat_cells]
            if any(h not in active_headers for h in row_headers if h != 'unknown' and len(h) > 3):
                break
            continue

        # Skip FAS rows
        if is_fas_row(row_text):
            continue
        
        # Skip rows that look like repeat sub-headers
        if any(k in row_text for k in ['serial number', 'path descriptor', 'nm/min', 'kt']):
            has_seq = any(c and c.strip().isdigit() for c in flat_cells[:1])
            if not has_seq:
                continue
        
        if not is_data_row(flat_cells):
            continue
        
        # Build the row dict
        row_data = {}
        for i, header_key in enumerate(active_headers):
            if i < len(flat_cells):
                row_data[header_key] = flat_cells[i]
            else:
                row_data[header_key] = None
        
        # Strict row validation to prevent leakage
        # A valid data row MUST have a serial number or a valid path descriptor
        serial_val = str(row_data.get('serial_number') or '').strip()
        path_val = str(row_data.get('path_descriptor') or '').strip().upper()
        
        valid_paths = {"IF", "TF", "CF", "DF", "HM", "CA", "RF", "CI", "FA", "VA", "VM"}
        
        is_valid_serial = serial_val.isdigit() and len(serial_val) <= 4
        is_valid_path = path_val in valid_paths
        
        if not is_valid_serial and not is_valid_path:
            continue
            
        # Heuristic re-alignment
        row_data = realign_row(row_data)
        
        data.append(row_data)
    
    return data


# ── Waypoint Extraction ───────────────────────────────────────────────────────

def extract_waypoint_data(table) -> list[dict]:
    """
    Extract waypoint coordinates from a waypoint/coordinate table.
    Handles:
      - Single coordinate cell: "N 15:23:23.17 E 75:19:16.68"
      - Split lat/lon cells: "09°50'01.42''N" | "078°04'51.03''E"
      - DMS with colons, degrees, or prime separators
    """
    waypoints = []
    rows = table.find_all('tr')
    seen_ids = set()
    
    for row in rows:
        tds = row.find_all(['td', 'th'])
        if not tds:
            continue
        
        flat_cells = []
        for td in tds:
            colspan = int(td.get('colspan', 1))
            cleaned = clean_text(td.get_text(separator=' ', strip=True))
            flat_cells.extend([cleaned] * colspan)
        
        if len(flat_cells) < 2:
            continue
        
        wpt_id = None
        coord_raw = None
        lat_cell = None
        lon_cell = None
        
        for cid, cell in enumerate(flat_cells):
            if not cell:
                continue
            
            c_lower = cell.lower()
            has_ns = "n" in c_lower or "s" in c_lower
            has_ew = "e" in c_lower or "w" in c_lower
            has_digits = bool(re.search(r'\d', cell))
            
            if has_ns and has_ew and has_digits:
                coord_raw = cell
                if cid > 0:
                    blacklist = ["IF", "TF", "CF", "DF", "HM", "CA", "RF", "VA", "VM",
                                 "IAF", "FAF", "MAPT", "MATF", "LTP", "FTP", "MAHF",
                                 "THR", "FAP", "INITL", "INITR", "INITB", "FINAL",
                                 "MISAP", "BASE", "MATF/MAPT", "FAF/FAP", "LTP/FTP", "IAF/MAHF"]
                    cid_search = cid - 1
                    wpt_id = flat_cells[cid_search]
                    while cid_search > 0 and (wpt_id == cell or wpt_id is None or wpt_id.upper().strip() in blacklist): 
                        cid_search -= 1
                        wpt_id = flat_cells[cid_search]
                break
            elif has_ns and not has_ew and re.search(r'\d{2}', cell):
                lat_cell = cell
            elif has_ew and not has_ns and re.search(r'\d{2}', cell):
                lon_cell = cell
                
        if not coord_raw and lat_cell and lon_cell:
            coord_raw = f"{lat_cell} {lon_cell}"
            wpt_id = flat_cells[0]
                    
        if not coord_raw:
            # Simple 2-column layout: Ident | Lat/Lon
            if len(flat_cells) == 2:
                wpt_id = flat_cells[0]
                coord_raw = flat_cells[1]
            elif len(flat_cells) >= 3:
                blacklist = ["IF", "TF", "CF", "DF", "HM", "CA", "RF", "VA", "VM",
                             "IAF", "FAF", "MAPT", "MATF", "LTP", "FTP", "MAHF",
                             "THR", "FAP", "INITL", "INITR", "INITB", "FINAL",
                             "MISAP", "BASE", "MATF/MAPT", "FAF/FAP", "LTP/FTP", "IAF/MAHF"]
                c1_clean = flat_cells[1].upper().strip() if flat_cells[1] else ""
                if c1_clean and c1_clean not in blacklist and 3 <= len(c1_clean) <= 6:
                    wpt_id = flat_cells[1]
                else:
                    wpt_id = flat_cells[0]
                coord_raw = flat_cells[2]
                
        if wpt_id:
            wpt_id = wpt_id.upper().strip()
            # Remove stray backticks from OCR
            wpt_id = wpt_id.strip('`')
            if wpt_id.startswith("RWY"):
                wpt_id = "RW" + wpt_id[3:]
            
        if wpt_id and coord_raw and not (wpt_id == coord_raw) and wpt_id not in seen_ids:
            # Remove stray backticks from coordinates
            coord_raw = coord_raw.strip('`')
            if "°" in coord_raw or ":" in coord_raw or re.search(r'\d{5}', coord_raw):
                lat_dd, lon_dd = parse_coordinate(coord_raw)
                if lat_dd and lon_dd:
                    seen_ids.add(wpt_id)
                    waypoints.append({
                        "waypoint_id": wpt_id,
                        "coordinates_raw": clean_text(coord_raw),
                        "lat_dd": lat_dd,
                        "lon_dd": lon_dd
                    })
    
    return waypoints


# ── Main Parser ────────────────────────────────────────────────────────────────

def parse_markdown_files(directory):
    procedures = []
    
    for filepath in sorted(glob.glob(os.path.join(directory, "*.md"))):
        filename = os.path.basename(filepath)
        proc_name = filename.replace('.PDF.md', '').replace('.md', '')
        
        parts = proc_name.split('-')
        airport_id = parts[0] if parts else ""
        runway = ""
        proc_type = ""
        
        for i, p in enumerate(parts):
            if "RWY" in p:
                if p == "RWY": 
                    runway = parts[i+1] if i+1 < len(parts) else ""
                else: 
                    runway = p.replace("RWY", "").strip()
            
            if p in ["RNP", "SID", "STAR"]:
                if i+1 < len(parts) and parts[i+1] in ["Y", "Z", "X"]:
                    proc_type = f"{p} {parts[i+1]}"
                else:
                    proc_type = p
                    
        runway = runway.replace("CODING", "").strip().rstrip('-')
                    
        with open(filepath, 'r') as f:
            content = f.read()
            
        soup = BeautifulSoup(content, 'html.parser')
        tables = soup.find_all('table')
        
        tabular_data = []
        waypoint_data = []
        column_headers = []  # Store the actual headers found
        
        for table in tables:
            table_type = classify_table(table)
            
            if table_type == 'fas':
                continue
            
            if table_type == 'tabular':
                res_headers = extract_headers(table)
                if res_headers:
                    column_headers = deduplicate_headers(res_headers)
                    rows = extract_tabular_data(table, column_headers)
                    tabular_data.extend(rows)
            
            # Extract waypoints from any table that might have them
            if table_type in ('waypoint', 'unknown', 'tabular'):
                wpts = extract_waypoint_data(table)
                # Merge without duplicates
                existing_ids = {w['waypoint_id'] for w in waypoint_data}
                for w in wpts:
                    if w['waypoint_id'] not in existing_ids:
                        waypoint_data.append(w)
                        existing_ids.add(w['waypoint_id'])

        procedure = {
            "procedure_name": proc_name,
            "airport_id": airport_id,
            "runway": runway,
            "procedure_type": proc_type,
            "column_headers": column_headers,
            "tabular_description": tabular_data,
            "waypoints": waypoint_data,
            "filename": filename
        }
        procedures.append(procedure)

    return procedures


if __name__ == "__main__":
    input_dir = "/Users/naveendevapalan/Desktop/Naveen/PROJECTS/eAIP/eaip_scrapper/output/merged_data"
    output_file = "/Users/naveendevapalan/Desktop/Naveen/PROJECTS/eAIP/eaip_scrapper/scratch/output.json"
    
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    
    data = parse_markdown_files(input_dir)
    
    with open(output_file, 'w') as f:
        json.dump(data, f, indent=2)
        
    print(f"Parsing complete. Processed {len(data)} procedures.")
    
    # Quality report
    missing_tab = []
    missing_wpt = []
    empty_headers = []
    
    for p in data:
        if not p["tabular_description"]:
            missing_tab.append(p["filename"])
        if not p["waypoints"]:
            missing_wpt.append(p["filename"])
        if not p["column_headers"]:
            empty_headers.append(p["filename"])
            
    if missing_tab:
        print(f"\nWARNING: {len(missing_tab)} files lack Tabular Data:")
        for f in missing_tab: print(f"  - {f}")
    if missing_wpt:
        print(f"\nWARNING: {len(missing_wpt)} files lack Waypoint Data:")
        for f in missing_wpt: print(f"  - {f}")
    if empty_headers:
        print(f"\nWARNING: {len(empty_headers)} files had no detectable headers:")
        for f in empty_headers: print(f"  - {f}")
    
    if not missing_tab and not missing_wpt:
        print("\n✓ All procedures have both tabular and waypoint data.")
