import os
import re
import json
import logging
from pathlib import Path
from bs4 import BeautifulSoup
from collections import defaultdict
from .utils import clean_text, parse_coordinate, sanitize_header, is_valid_coord, MERGED_DIR, EXTRACTED_DIR

logger = logging.getLogger("RNP-ETL.Transformer")


class RNPTransformer:
    def __init__(self):
        self.roles = {'IAF', 'IF', 'FAF', 'MAPT', 'MATF', 'MAHF', 'LTP', 'FTP', 'FAP', 'THR', 'MAPT/MATF'}
        self.valid_paths = {"IF", "TF", "CF", "DF", "HM", "CA", "RF", "CI", "FA", "VA", "VM"}
        self.id_blacklist = {
            "IAF", "IF", "FAF", "MAPT", "MATF", "MAHF", "LTP", "FTP",
            "FAP", "THR", "MAPTN", "MATFN", "FINAL", "MISAP", "BASE",
            "TRANS", "IDENT", "TYPE", "LAT", "LONG", "COORD", "WGS84",
            "WPT", "FIX", "NAVAID", "INITL", "INITR", "INITB", "MISAP",
            "MAPT/MATF", "FAF/FAP", "LTP/FTP", "IAF/MAHF", "TP",
        }

    def get_base_name(self, filename):
        name = filename.replace(".PDF.md", "").replace(".md", "")
        name = re.sub(r'-\d+$', '', name)
        name = name.replace("-CODING", "").replace("-TABLES", "").replace("-TABLE", "").replace("-WAYPOINTS", "")
        return name

    def extract_metadata(self, filename):
        """Extract airport_id, runway, and procedure_type from the filename.

        Filename patterns:
          VOHB-RNP-Y-RWY26
          VECC-RNP-Y-RWY-19R
          VOCL-RNP-Y-RWY-28
          VOPB-RNP-Y-RWY-04-TABLES
        """
        stem = filename.replace(".PDF.md", "").replace(".md", "")
        # Remove CODING and TABLES suffixes before processing
        stem = stem.replace("-CODING", "").replace("-TABLES", "").replace("-TABLE", "")
        parts = stem.split('-')
        if len(parts) == 1 and ' ' in stem:
            parts = stem.split()
            
        airport_id = parts[0] if parts else ""
        runway = ""
        proc_type = ""

        for i, p in enumerate(parts):
            if "RWY" in p:
                if p == "RWY":
                    runway = parts[i + 1] if i + 1 < len(parts) else ""
                else:
                    runway = p.replace("RWY", "").strip()
            if p in ("RNP", "SID", "STAR"):
                if i + 1 < len(parts) and parts[i + 1] in ("Y", "Z", "X"):
                    proc_type = f"{p} {parts[i + 1]}"
                else:
                    proc_type = p

        # Strip any remaining stray suffixes from runway
        runway = runway.replace("CODING", "").replace("TABLES", "").replace("TABLE", "").strip().rstrip('-')

        return airport_id, runway, proc_type

    def merge_files(self):
        """Merges parts of the same procedure into unified markdown files."""
        if MERGED_DIR.exists():
            import shutil
            shutil.rmtree(MERGED_DIR)
        MERGED_DIR.mkdir(parents=True, exist_ok=True)

        files = list(EXTRACTED_DIR.glob("*.md"))
        groups = defaultdict(list)
        for f in files:
            groups[self.get_base_name(f.name)].append(f)

        for base_name, file_list in groups.items():
            file_list.sort(key=lambda x: x.name)
            merged_content = []
            for f in file_list:
                with open(f, "r") as src:
                    merged_content.append(f"<!-- Source: {f.name} -->\n" + src.read())

            output_file = MERGED_DIR / f"{base_name}.md"
            with open(output_file, "w") as dest:
                dest.write("\n\n---\n\n".join(merged_content))
        logger.info(f"Merged {len(files)} parts into {len(groups)} procedures.")

    def classify_table(self, table):
        text_lower = table.get_text(separator=' ').lower()
        if "operation type" in text_lower and "ltp/ftp" in text_lower:
            return 'fas'
        if any(k in text_lower for k in ['serial', 'path', 'descriptor', 'terminator', 'seq num']):
            return 'tabular'
        if any(k in text_lower for k in ['coordinate', 'latitude', 'longitude', 'waypoint information', 'waypoint list']):
            return 'waypoint'
        return 'unknown'

    def extract_tabular(self, table, headers):
        rows = table.find_all('tr')
        data = []
        for row in rows:
            tds = row.find_all('td')
            if not tds:
                continue
            cells = []
            for td in tds:
                cells.extend([clean_text(td.get_text(strip=True))] * int(td.get('colspan', 1)))

            if len(cells) < len(headers):
                continue

            row_dict = {headers[i]: cells[i] for i in range(len(headers))}

            # Validation & Realignment
            serial = str(row_dict.get('serial_number') or '').strip()
            path = str(row_dict.get('path_descriptor') or '').strip().upper()
            if not (serial.isdigit() or path in self.valid_paths):
                continue

            # Realign row if role is in vpa_tch
            vpa_key = next((k for k in row_dict if 'vpa' in k), None)
            role_key = next((k for k in row_dict if 'role' in k), 'role')
            if vpa_key and row_dict.get(vpa_key) and str(row_dict[vpa_key]).strip().upper() in self.roles:
                row_dict[role_key] = row_dict[vpa_key]
                row_dict[vpa_key] = None

            data.append(row_dict)
        return data

    def extract_waypoints(self, table):
        """Extract waypoints with per-field direction parsing."""
        wpts = []
        seen_ids = set()
        rows = table.find_all('tr')
        for row in rows:
            tds = row.find_all(['td', 'th'])
            cells = [clean_text(td.get_text(strip=True)) for td in tds]
            if len(cells) < 2:
                continue

            # Try parsing coordinates from individual cells first (split lat/lon columns)
            lat_dd, lon_dd = None, None

            # Check if individual cells contain coordinate data
            for cell in cells:
                if cell:
                    lat_dd, lon_dd = parse_coordinate(cell)
                    if lat_dd is not None and lon_dd is not None:
                        break

            # If single-cell parse failed, try combining cells
            if lat_dd is None or lon_dd is None:
                # Try combining adjacent cells that might be split lat + lon
                for i in range(len(cells) - 1):
                    if cells[i] and cells[i + 1]:
                        combined = f"{cells[i]} {cells[i + 1]}"
                        lat_dd, lon_dd = parse_coordinate(combined)
                        if lat_dd is not None and lon_dd is not None:
                            break

            if lat_dd is None or lon_dd is None:
                continue

            # Validate the parsed coordinate
            if not is_valid_coord(lat_dd, lon_dd):
                logger.debug(f"Rejecting out-of-bounds coordinate: {lat_dd}, {lon_dd}")
                continue

            # Find identifier: skip roles, numbers, and blacklisted terms
            ident = None
            for c in cells:
                if not c:
                    continue
                c_clean = str(c).upper().strip().strip("'").strip("`")
                if (2 <= len(c_clean) <= 7
                        and c_clean.isalnum()
                        and not c_clean.isdigit()
                        and c_clean not in self.id_blacklist):
                    ident = c_clean
                    break

            if ident and ident not in seen_ids:
                seen_ids.add(ident)
                wpts.append({
                    "waypoint_id": ident,
                    "coordinates_raw": ' '.join(filter(None, cells)),
                    "lat_dd": lat_dd,
                    "lon_dd": lon_dd
                })
        return wpts

    def parse_file(self, filepath):
        with open(filepath, 'r') as f:
            soup = BeautifulSoup(f.read(), 'html.parser')

        airport_id, runway, proc_type = self.extract_metadata(filepath.name)

        proc_data = {
            "procedure_name": filepath.stem,
            "airport_id": airport_id,
            "runway": runway,
            "procedure_type": proc_type,
            "tabular_description": [],
            "waypoints": []
        }

        for table in soup.find_all('table'):
            t_type = self.classify_table(table)
            if t_type == 'fas':
                continue

            if t_type == 'tabular':
                # Extract headers — skip spanning title rows and unit rows
                headers = []
                for candidate_row in table.find_all('tr'):
                    cells = candidate_row.find_all(['td', 'th'])
                    # Skip single-cell spanning title rows
                    if len(cells) == 1 and int(cells[0].get('colspan', 1)) > 3:
                        continue
                    # Need at least 5 real columns to be a header row
                    if len(cells) < 5:
                        continue
                    # Check if it looks like a header (contains known header keywords)
                    row_text = ' '.join(c.get_text(strip=True).lower() for c in cells)
                    is_header = any(kw in row_text for kw in [
                        'serial', 'path', 'waypoint', 'fix', 'seq',
                        'descriptor', 'terminator', 'course', 'altitude'
                    ])
                    # Skip unit rows (ft, kt, NM, °/ft)
                    is_unit = all(
                        c.get_text(strip=True).lower() in ('', 'ft', 'kt', 'nm', '°/ft', 'min')
                        for c in cells
                    )
                    if is_header and not is_unit:
                        raw_h = [sanitize_header(c.get_text(strip=True)) for c in cells]
                        # Deduplicate
                        seen = {}
                        for h in raw_h:
                            if h in seen:
                                seen[h] += 1
                                headers.append(f"{h}_{seen[h]}")
                            else:
                                seen[h] = 0
                                headers.append(h)
                        break  # Found the header row
                if headers:
                    proc_data["tabular_description"].extend(self.extract_tabular(table, headers))

            # Extract waypoints from waypoint tables AND unknown tables
            if t_type in ('waypoint', 'unknown', 'tabular'):
                wpts = self.extract_waypoints(table)
                existing_ids = {w['waypoint_id'] for w in proc_data["waypoints"]}
                for w in wpts:
                    if w['waypoint_id'] not in existing_ids:
                        proc_data["waypoints"].append(w)
                        existing_ids.add(w['waypoint_id'])

        return proc_data
