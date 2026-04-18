import os
import re
import json
import logging
from pathlib import Path
from bs4 import BeautifulSoup
from collections import defaultdict
from .utils import clean_text, parse_coordinate, sanitize_header, MERGED_DIR, EXTRACTED_DIR

logger = logging.getLogger("RNP-ETL.Transformer")

class RNPTransformer:
    def __init__(self):
        self.roles = {'IAF', 'IF', 'FAF', 'MAPT', 'MATF', 'MAHF', 'LTP', 'FTP', 'FAP', 'THR', 'MAPT/MATF'}
        self.valid_paths = {"IF", "TF", "CF", "DF", "HM", "CA", "RF", "CI", "FA", "VA", "VM"}
        self.id_blacklist = {
            "IAF", "IF", "FAF", "MAPT", "MATF", "MAHF", "LTP", "FTP", 
            "FAP", "THR", "MAPTN", "MATFN", "FINAL", "MISAP", "BASE", 
            "TRANS", "IDENT", "TYPE", "LAT", "LONG", "COORD", "WGS84",
            "WPT", "FIX", "NAVAID"
        }

    def get_base_name(self, filename):
        name = filename.replace(".PDF.md", "").replace(".md", "")
        name = re.sub(r'-\d+$', '', name)
        name = name.replace("-CODING", "").replace("-WAYPOINTS", "")
        return name

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
            
        MERGED_DIR.mkdir(parents=True, exist_ok=True)
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
        if any(k in text_lower for k in ['coordinate', 'latitude', 'longitude', 'waypoint information']):
            return 'waypoint'
        return 'unknown'

    def extract_tabular(self, table, headers):
        rows = table.find_all('tr')
        data = []
        for row in rows:
            tds = row.find_all('td')
            if not tds: continue
            cells = []
            for td in tds:
                cells.extend([clean_text(td.get_text(strip=True))] * int(td.get('colspan', 1)))
            
            if len(cells) < len(headers): continue
            
            row_dict = {headers[i]: cells[i] for i in range(len(headers))}
            
            # Validation & Realignment
            serial = str(row_dict.get('serial_number') or '').strip()
            path = str(row_dict.get('path_descriptor') or '').strip().upper()
            if not (serial.isdigit() or path in self.valid_paths): continue
            
            # Realign row if role is in vpa_tch
            vpa_key = next((k for k in row_dict if 'vpa' in k), None)
            role_key = next((k for k in row_dict if 'role' in k), 'role')
            if vpa_key and row_dict[vpa_key] in self.roles:
                row_dict[role_key] = row_dict[vpa_key]
                row_dict[vpa_key] = None
                
            data.append(row_dict)
        return data

    def extract_waypoints(self, table):
        wpts = []
        rows = table.find_all('tr')
        for row in rows:
            tds = row.find_all(['td', 'th'])
            cells = [clean_text(td.get_text(strip=True)) for td in tds]
            if len(cells) < 2: continue
            
            # Look for coordinate pattern in row
            row_text = ' '.join(filter(None, cells))
            lat_dd, lon_dd = parse_coordinate(row_text)
            if lat_dd and lon_dd:
                # Identification logic: Skip numbers (line numbers) and roles
                ident = None
                for c in cells:
                    if not c: continue
                    c_clean = str(c).upper().strip().strip("'").strip("`")
                    if (3 <= len(c_clean) <= 7 and 
                        c_clean.isalnum() and 
                        not c_clean.isdigit() and 
                        c_clean not in self.id_blacklist):
                        ident = c_clean
                        break
                
                if ident:
                    wpts.append({
                        "waypoint_id": ident,
                        "coordinates_raw": row_text,
                        "lat_dd": lat_dd,
                        "lon_dd": lon_dd
                    })
        return wpts

    def parse_file(self, filepath):
        with open(filepath, 'r') as f:
            soup = BeautifulSoup(f.read(), 'html.parser')
        
        proc_data = {
            "procedure_name": filepath.stem,
            "tabular_description": [],
            "waypoints": []
        }
        
        for table in soup.find_all('table'):
            t_type = self.classify_table(table)
            if t_type == 'tabular':
                # Extract headers
                h_row = table.find('tr')
                if h_row:
                    raw_h = [sanitize_header(td.get_text(strip=True)) for td in h_row.find_all(['td', 'th'])]
                    # Deduplicate
                    seen = {}
                    headers = []
                    for h in raw_h:
                        if h in seen:
                            seen[h] += 1
                            headers.append(f"{h}_{seen[h]}")
                        else:
                            seen[h] = 0
                            headers.append(h)
                    proc_data["tabular_description"].extend(self.extract_tabular(table, headers))
            
            if t_type in ('waypoint', 'unknown'):
                proc_data["waypoints"].extend(self.extract_waypoints(table))
        
        return proc_data
