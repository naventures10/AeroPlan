import re
from pathlib import Path
from datetime import datetime
from sqlalchemy import create_engine, text


# Known airport name -> ICAO mappings for headers that might not have ICAO inline
AIRPORT_NAME_TO_ICAO = {
    "HAL AIRPORT": "VOBG",
    "HALAIRPORT": "VOBG",
    "KEMPEGOWDA": "VOBL",
    "BENGALURU": "VOBG", # In Series A, standalone Bengaluru often refers to HAL (VOBG) context
    "COCHIN INTERNATIONAL": "VOCI",
    "MANGALORE": "VOML",
    "MANGLORE": "VOML",
    "VIJAYAWADA": "VOBZ",
    "VISHAKAPATNAM": "VOVZ",
    "VISAKHAPATNAM": "VOVZ",
    "THIRUVANANTHAPURAM": "VOTV",
    "TIRUCHIRAPPALLI": "VOTR",
    "RAJAHMUNDRY": "VORY",
    "SRI VIJAYA PURAM": "VOPB",
    "RAJIV GANDHI": "VOHS",
    "HUBBALLI": "VOHB",
    "BELAGAVI": "VOBM",
    "BIDAR": "VOBR",
    "KALABURAGI": "VOKB",
    "SINDHUDURG": "VOSR",
    "TIRUPATI": "VOTP",
    "SHIVAMOGA": "VOSH",
    "JINDAL VIJAYANAGAR": "VOJV",
    "MYSURU": "VOMY",
    "KADAPA": "VOCP",
    "PUDUCHERRY": "VOPC",
    "SALEM": "VOSM",
    "KURNOOL": "VOKU",
    "TUTICORIN": "VOTK",
    "MOPA": "VOGA",
    "GOA": "VOGO",
}

# Regex for a 4-letter Indian ICAO code
ICAO_PATTERN = re.compile(r"(V[A-Z]{3})(?![A-Z])")
NOTAM_ID_PATTERN = re.compile(r"([AC]\d{4}/\d{2})")
# Matches YYMMDDHHMM / YYMMDDHHMM or YYMMDDHHMM / PERM
VALIDITY_PATTERN = re.compile(r"(\d{10})\s*/\s*(\d{10}|PERM)")


class NOTAMETL:
    def __init__(self, db_url):
        self.engine = create_engine(db_url)

    def parse_notam_time(self, ts_str):
        """Parses NOTAM timestamp string (YYMMDDHHMM) into datetime."""
        if ts_str == "PERM":
            return datetime(2099, 12, 31, 23, 59)
        try:
            full_ts = "20" + ts_str
            return datetime.strptime(full_ts, "%Y%m%d%H%M")
        except Exception:
            return None

    def _extract_icao_from_text(self, text):
        """Extract all ICAO codes (V + 3 uppercase letters) from a string."""
        return ICAO_PATTERN.findall(text)

    def _classify_header(self, text):
        """
        Classify text as FIR or AIRPORT header.
        Returns (type, icao_list) or (None, None).
        """
        text_upper = text.upper()
        
        # Explicitly prioritize HAL AIRPORT for VOBG
        if re.search(r"\bHAL\b", text_upper):
            return "airport", ["VOBG"]
            
        icaos = self._extract_icao_from_text(text_upper)
        
        if re.search(r"\bFIR\b", text_upper):
            return "fir", icaos if icaos else None
        
        if icaos:
            return "airport", icaos
        
        for name, icao in AIRPORT_NAME_TO_ICAO.items():
            if name in text_upper:
                return "airport", [icao]
        
        return None, None

    def extract_notams_from_markdown(self, md_path):
        """
        Parses Markdown file line-by-line to extract NOTAMs with state-tracked context.
        """
        records = []
        series = "A" if "_A_" in md_path.name or "Series_A" in md_path.name else "C"
        
        current_fir = None
        current_airport = None
        current_notam = None

        print(f"  [*] Processing {md_path.name}...")

        with open(md_path, "r", encoding="utf-8") as f:
            lines = f.readlines()

        for line in lines:
            line_raw = line
            line = line.strip()
            if not line:
                # If we are in a free-text NOTAM, a blank line might just be whitespace.
                # However, in docling MD, blank lines are common between paragraphs.
                # We'll keep appending to description if a NOTAM is active and not a table.
                if current_notam and not line_raw.startswith("|"):
                     # Just add a newline placeholder or ignore to clean up later
                     pass
                continue

            # --- 1. Detect External Headers (Markdown Style) ---
            if line.startswith("#"):
                clean_header = line.lstrip("# ").strip()
                # Ignore summary headers
                if "SUMMARY" in clean_header.upper():
                    continue
                
                htype, icaos = self._classify_header(clean_header)
                if htype:
                    # Real header change -> save previous NOTAM
                    if current_notam:
                        records.append(current_notam)
                        current_notam = None
                        
                    if htype == "fir":
                        current_fir = "/".join(icaos) if icaos else current_fir
                        current_airport = None
                    elif htype == "airport":
                        current_airport = icaos[0] if icaos else None
                continue

            # --- 2. Detect Table Rows ---
            if line.startswith("|") and line.endswith("|"):
                cells = [c.strip() for c in line.split("|")]
                if len(cells) < 3:
                    continue
                
                # Check for table divider line
                if all(re.match(r"^-+$", c) for c in cells[1:-1] if c):
                    continue

                col0 = cells[1]
                col1 = cells[2] if len(cells) > 2 else ""
                
                # Table-based NOTAM ID detection
                id_match = NOTAM_ID_PATTERN.search(col0)
                if id_match:
                    if current_notam:
                        records.append(current_notam)
                    
                    notam_id = id_match.group(1)
                    current_notam = {
                        "notam_id": notam_id,
                        "series": series,
                        "fir": current_fir,
                        "airport_icao": current_airport,
                        "valid_from_raw": None,
                        "valid_to_raw": None,
                        "description": "",
                    }
                    
                    v_match = VALIDITY_PATTERN.search(col0) or VALIDITY_PATTERN.search(col1)
                    if v_match:
                        current_notam["valid_from_raw"] = v_match.group(1)
                        current_notam["valid_to_raw"] = v_match.group(2)
                    
                    desc_part = col1
                    if v_match and v_match.group(0) in desc_part:
                        desc_part = desc_part.replace(v_match.group(0), "").strip()
                    if desc_part:
                        current_notam["description"] = desc_part
                    continue

                # Table-based Header detection
                htype = None
                if col0:
                    combined_for_htype = " ".join(cells).strip()
                    htype, icaos = self._classify_header(combined_for_htype)
                
                if htype:
                    if current_notam:
                        records.append(current_notam)
                        current_notam = None
                    if htype == "fir":
                        current_fir = "/".join(icaos) if icaos else current_fir
                        current_airport = None
                    elif htype == "airport":
                        current_airport = icaos[0] if icaos else None
                    continue

                # Table-based Description continuation
                if current_notam and not col0 and col1:
                    if "---" in col1: continue 
                    if current_notam["description"]:
                        current_notam["description"] += " "
                    current_notam["description"] += col1
                    continue
                
                # Table-based generic reset
                if not current_notam and col0:
                    if "CHECKLIST" in col0.upper() or "SUMMARY" in col0.upper():
                        current_airport = None
                continue

            # --- 3. Free-Text Detection (NOT in a table) ---
            # A. Detect NOTAM ID in free text (entire line or start of line)
            if NOTAM_ID_PATTERN.fullmatch(line) or (NOTAM_ID_PATTERN.match(line) and len(line) < 15):
                if current_notam:
                    records.append(current_notam)
                
                notam_id = NOTAM_ID_PATTERN.search(line).group(1)
                current_notam = {
                    "notam_id": notam_id,
                    "series": series,
                    "fir": current_fir,
                    "airport_icao": current_airport,
                    "valid_from_raw": None,
                    "valid_to_raw": None,
                    "description": "",
                }
                continue

            # B. Detect Validity in free text
            if current_notam and not current_notam["valid_from_raw"]:
                v_match = VALIDITY_PATTERN.search(line)
                if v_match:
                    current_notam["valid_from_raw"] = v_match.group(1)
                    current_notam["valid_to_raw"] = v_match.group(2)
                    continue

            # C. Gather Description in free text
            if current_notam:
                # If we hit another docling header or table, it's handled above.
                # Here we just accumulate lines.
                if current_notam["description"]:
                    current_notam["description"] += " "
                current_notam["description"] += line

        # Add last NOTAM
        if current_notam:
            records.append(current_notam)

        # Post-process timestamps
        for r in records:
            r["valid_from"] = self.parse_notam_time(r["valid_from_raw"])
            r["valid_to"] = self.parse_notam_time(r["valid_to_raw"])
            r["description"] = r["description"].strip()
            # Clean up double spaces
            r["description"] = re.sub(r"\s+", " ", r["description"])
            # raw_json is now just the source file for traceability
            r["raw_json"] = {"source_file": md_path.name}

        return [r for r in records if r["notam_id"] and r["description"]]

    def load_to_db(self, records):
        """Pushes records to Postgres using SQLAlchemy."""
        if not records:
            return
        
        print(f"[*] Loading {len(records)} records to database...")
        
        # Ensure schema exists (same as before)
        with self.engine.begin() as conn:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS notams (
                    notam_id TEXT PRIMARY KEY,
                    series TEXT,
                    fir TEXT,
                    airport_icao TEXT,
                    valid_from TIMESTAMP,
                    valid_to TIMESTAMP,
                    description TEXT,
                    raw_json JSONB,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """))

        with self.engine.begin() as conn:
            for r in records:
                import json
                stmt = text("""
                    INSERT INTO notams (notam_id, series, fir, airport_icao, valid_from, valid_to, description, raw_json)
                    VALUES (:notam_id, :series, :fir, :airport_icao, :valid_from, :valid_to, :description, :raw_json)
                    ON CONFLICT (notam_id) DO UPDATE SET
                        fir = EXCLUDED.fir,
                        airport_icao = EXCLUDED.airport_icao,
                        valid_from = EXCLUDED.valid_from,
                        valid_to = EXCLUDED.valid_to,
                        description = EXCLUDED.description,
                        raw_json = EXCLUDED.raw_json,
                        updated_at = CURRENT_TIMESTAMP;
                """)
                # Prepare dict for insertion
                data = {
                    "notam_id": r["notam_id"],
                    "series": r["series"],
                    "fir": r["fir"],
                    "airport_icao": r["airport_icao"],
                    "valid_from": r["valid_from"],
                    "valid_to": r["valid_to"],
                    "description": r["description"],
                    "raw_json": json.dumps(r["raw_json"])
                }
                conn.execute(stmt, data)


def main():
    db_url = "postgresql://postgres:postgres@localhost:5432/aeronautical_information_system"
    etl = NOTAMETL(db_url)
    
    output_dir = Path(__file__).resolve().parent.parent.parent / "output"
    md_files = sorted(list(output_dir.glob("Chennai_*_2026_03.md")))
    
    if not md_files:
        print("[!] No Markdown files found in output directory.")
        return
    
    all_recs = []
    for mf in md_files:
        recs = etl.extract_notams_from_markdown(mf)
        print(f"  [+] Extracted {len(recs)} records.")
        all_recs.extend(recs)
        
    if all_recs:
        etl.load_to_db(all_recs)
        
    print("\n[!] ETL Process Completed Successfully.")


if __name__ == "__main__":
    main()
