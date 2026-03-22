import re
import json
from pathlib import Path
from bs4 import BeautifulSoup
from datetime import datetime

NOTAM_ID_PATTERN = re.compile(r"([A-Za-z]\d{4}/\d{2})")
VALIDITY_PATTERN = re.compile(r"(\d{10})\s*/\s*(\d{10}|PERM|.+?EST|.+?PERM)")
AIRPORT_NAME_TO_ICAO = {
    "CHENNAI": "VOMF", "DELHI": "VIDF", "MUMBAI": "VABF", "KOLKATA": "VECF",
    "HAL AIRPORT": "VOBG", "BENGALURU": "VOBG", "KEMPEGOWDA": "VOBL",
}

def parse_notam_time(ts_str):
    if not ts_str: return None
    ts_str = ts_str.strip()
    if "PERM" in ts_str.upper(): return datetime(2099, 12, 31, 23, 59)
    if "EST" in ts_str.upper(): ts_str = ts_str.replace("EST", "").strip()
    try:
        full_ts = "20" + ts_str[:8] + ts_str[8:12]
        return datetime.strptime(full_ts, "%Y%m%d%H%M")
    except Exception: return None

def extract_from_md(file_path: Path):
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    soup = BeautifulSoup(content, 'html.parser')
    records = []
    
    current_notam = None
    current_airport = None
    current_fir = None
    
    match = re.search(r"([A-Za-z]+)_([A-Z])_(\d{4})_(\d{2})", file_path.name)
    series = "A"
    if match:
        current_fir = match.group(1).upper()
        series = match.group(2).upper()

    def commit_notam():
        if current_notam and current_notam.get("valid_from_raw") and current_notam.get("description"):
            current_notam["description"] = re.sub(r"\s+", " ", current_notam["description"]).strip()
            records.append(current_notam)

    for table in soup.find_all("table"):
        for row in table.find_all("tr"):
            cells = row.find_all(["td", "th"])
            if not cells: continue
            
            cell_texts = [re.sub(r"<[^>]+>", " ", c.get_text(separator="\n")).strip() for c in cells]
            first_cell_text = cell_texts[0]
            
            # Check for header/airport changes
            if "FIR" in first_cell_text.upper():
                continue # simplified for test
            temp_airport = None
            for name, icao in AIRPORT_NAME_TO_ICAO.items():
                if name in first_cell_text.upper():
                    temp_airport = icao
                    break
            if temp_airport and not NOTAM_ID_PATTERN.search(first_cell_text):
                current_airport = temp_airport
                continue

            found_ids = NOTAM_ID_PATTERN.findall(first_cell_text)
            
            if found_ids:
                commit_notam()
                primary_id = found_ids[0]
                current_notam = {
                    "notam_id": primary_id, "series": series,
                    "fir": current_fir, "airport_icao": current_airport,
                    "valid_from_raw": None, "valid_to_raw": None, "description": ""
                }
                
                # Check column 2 for validity and possible description
                if len(cell_texts) > 1:
                    second_cell = cell_texts[1]
                    v_match = VALIDITY_PATTERN.search(second_cell)
                    if v_match:
                        current_notam["valid_from_raw"] = v_match.group(1)
                        current_notam["valid_to_raw"] = v_match.group(2)
                        # description is everything after validity
                        desc = second_cell[v_match.end():].strip()
                        if desc:
                            current_notam["description"] += " " + desc
                    else:
                        current_notam["description"] += " " + second_cell
                        
                # Add any remaining columns
                for txt in cell_texts[2:]:
                    current_notam["description"] += " " + txt
            
            elif current_notam:
                # Continuation of description
                for txt in cell_texts:
                    current_notam["description"] += "\n" + txt

    commit_notam()
    return records

if __name__ == "__main__":
    p = Path("/Users/naveendevapalan/Desktop/Naveen/PROJECTS/eAIP/eaip_scrapper/output/Chennai_A_2026_03.md")
    res = extract_from_md(p)
    print(f"Extracted {len(res)} NOTAMs from {p.name}")
    if res:
        print("First:", json.dumps(res[0], indent=2))
        print("Last:", json.dumps(res[-1], indent=2))
