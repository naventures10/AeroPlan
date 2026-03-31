import re
import json
from pathlib import Path
from bs4 import BeautifulSoup
from datetime import datetime
from sqlalchemy import create_engine, text

ICAO_PATTERN = re.compile(r"\b(V[A-Z]{3})\b(?<!VIII)") # Exclude VIII
NOTAM_ID_PATTERN = re.compile(r"([A-Za-z]\d{4}/\d{2})")
VALIDITY_PATTERN = re.compile(r"(\d{10})\s*/\s*(\d{10}|PERM|.+?EST|.+?PERM)")

# Mapping FIR City Names to ICAO for header detection
FIR_NAME_TO_ICAO = {
    "CHENNAI": "VOMF",
    "DELHI": "VIDP",
    "MUMBAI": "VABF",
    "KOLKATA": "VECF",
}


class BaseNotamParser:
    """
    Abstract Base Parser containing universal helpers.
    Actual extraction logic is overridden by FIR-specific child classes.
    """

    def __init__(self):
        self.records = []
        self.current_fir = None
        self.default_fir = None
        self.current_airport = None
        self.series = None

    def _extract_icao_from_text(self, text):
        return ICAO_PATTERN.findall(text)

    def _classify_header(self, text):
        # Strip HTML tags and markdown bold/italic markers
        clean_text = re.sub(r"<[^>]+>", "", text)
        clean_text = re.sub(r"[\*_]", "", clean_text)
        text_upper = re.sub(r"\s+", " ", clean_text).upper().strip()
        
        # Headers are usually short and don't contain @ symbols or sentences
        if not text_upper or len(text_upper) > 60 or "@" in text_upper:
            return None, None

        # If it contains a NOTAM ID, it's NOT a header/state-change row
        if NOTAM_ID_PATTERN.search(text_upper):
            return None, None

        # Hard match for HAL Airport headers
        if "HAL" in text_upper:
            if "AIRPORT" in text_upper or "BENGALURU" in text_upper:
                return "airport", ["VOBG"]
            return None, None

        icaos = self._extract_icao_from_text(text_upper)
        
        # FIR detection: Check known FIR names STRICTLY (no mid-sentence match)
        for name, icao in FIR_NAME_TO_ICAO.items():
            if text_upper == name or text_upper == f"{name} FIR":
                return "fir", [icao]

        # FIR keyword match must be in a short row (max 6 words)
        word_count = len(text_upper.split())
        is_fir = (re.search(r"\bFIR\b", text_upper) and word_count <= 6) or (icaos and any(icao in ["VOMF", "VIDP", "VABF", "VECF"] for icao in icaos))
        if is_fir:
            return "fir", icaos if icaos else None

        # Extensive stop words that heavily indicate this is a description, NOT a header
        stop_words = [
            "AVBL", "NOT", "DUE", "WIP", "EXER", "CTN", "CLOSED", "CLSD", "WILL", "PLACE", "OPS", "ACT", "AREA",
            "ILS", "RWY", "APPROACH", "APCH", "GLIDE", "PATH", "GP", "MAINT", "TAR", "RADAR", "NDB", "DME", "FREQ",
            "MHZ", "TWR", "TOWER", "LAT", "LONG", "COORD", "DEG", "MIN", "SEC", "AT", "ON", "OF", "FOR", "AND", "TO",
            "IN", "WITH", "FROM", "BETWEEN", "BTN", "OUT", "OVER", "UNDER", "UPTO", "UP", "DOWN", "DRG", "DURING",
            "AFT", "AFTER", "BFR", "BEFORE", "ABV", "ABOVE", "BLW", "BELOW", "SFC", "SURFACE", "GND", "GROUND",
            "AMSL", "AGL", "MSL", "ELEV", "ELEVATION", "HGT", "HEIGHT", "DIST", "DISTANCE", "LEN", "LENGTH", "WID",
            "WIDTH", "DPT", "DEPTH", "ASDA", "TODA", "TORA", "LDA", "RESA", "PCN", "TR", "TRACK", "TAXI", "TWY",
            "APRN", "APRON", "PRKG", "PARKING", "STAND", "BAY", "CAT", "FLT", "FLIGHT"
        ]
        
        words = text_upper.split()
        if any(sw in words for sw in stop_words):
            return None, None

        # Pure 4-char ICAO header
        if len(text_upper) == 4 and text_upper.startswith("V") and text_upper.isalpha():
             return "airport", [text_upper]

        # Dynamic Airport detection: Look for exactly one ICAO in a short phrase completely devoid of numbers and stop words
        word_count = len(words)
        if word_count <= 8 and icaos and len(icaos) == 1:
            icao = icaos[0]
            remainder = text_upper.replace(icao, "").strip()
            # Exclude if it has digits, as headers are typically just names and the ICAO code
            if not re.search(r"\d", remainder):
                # Ensure the string is purely letters, spaces, parenthesis, and standard marks
                if re.fullmatch(r"([A-Z\s\(\)/\-]+)", text_upper):
                    return "airport", [icao]

        return None, None

    def parse_notam_time(self, ts_str):
        if not ts_str:
            return None
        ts_str = ts_str.strip()
        if "PERM" in ts_str.upper():
            return datetime(2099, 12, 31, 23, 59)
        if "EST" in ts_str.upper():
            ts_str = ts_str.replace("EST", "").strip()

        try:
            full_ts = "20" + ts_str[:8] + ts_str[8:12]
            return datetime.strptime(full_ts, "%Y%m%d%H%M")
        except Exception:
            return None

    def calculate_duration_category(self, rec):
        if rec.get("is_permanent"):
            return "PERMANENT"

        f = rec.get("valid_from")
        t = rec.get("valid_to")
        if f and t:
            delta_days = (t - f).days
            if delta_days > 90:
                return "LONG DURATION"
            return "TEMPORARY"

        scope = rec.get("scope", "")
        if scope == "INT_L":
            return "LONG DURATION"
        if scope == "INT_S":
            return "TEMPORARY"
        return "UNKNOWN"

    def extract_from_md(self, file_path: Path):
        raise NotImplementedError(
            "FIR Parsers must implement their own extraction logic"
        )


class ChennaiLlamaParser(BaseNotamParser):
    """
    Parser bespoke to Chennai Series A/C formats from LlamaParse Markdown.
    Uses BeautifulSoup to extract logical NOTAM blocks from HTML tables.
    """

    def extract_from_md(self, file_path: Path):
        print(f"  [*] Parsing Chennai Markdown: {file_path.name}...")

        match = re.search(r"([A-Za-z]+)_([A-Z])_(\d{4})_(\d{2})", file_path.name)
        if match:
            fir_raw = match.group(1).upper()
            self.current_fir = "VOMF" if fir_raw == "CHENNAI" else fir_raw
            self.series = match.group(2).upper()
        else:
            self.current_fir = "VOMF"
            self.series = "A" if "_A_" in file_path.name else "C"
            
        self.default_fir = self.current_fir

        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        
        current_notam = None

        def commit_notam():
            nonlocal current_notam
            if current_notam and current_notam.get("valid_from_raw"):
                # Clean up description
                current_notam["description"] = re.sub(r"\s+", " ", current_notam["description"]).strip()
                
                # Check for empty description only at very end or ID switch if desired,
                # but better to keep it and see what's missing.
                if not current_notam["description"] and not current_notam.get("is_permanent"):
                     # Some temporary NOTAMs might have empty descriptions if extraction failed, 
                     # but let's keep them for now to avoid data loss.
                     pass

                # Assign duration category and parse times
                s = current_notam["series"]
                current_notam["scope"] = (
                    "INT_L" if s == "A" else
                    "INT_S" if s == "B" else
                    "DOM" if s == "C" else
                    "MIL_DOM" if s == "D" else
                    "GEN" if s == "G" else
                    "SNOWTAM" if s.startswith("SW") else "UNKNOWN"
                )
                current_notam["is_permanent"] = "PERM" in (current_notam.get("valid_to_raw") or "").upper()
                current_notam["is_estimated"] = "EST" in (current_notam.get("valid_to_raw") or "").upper()
                current_notam["valid_from"] = self.parse_notam_time(current_notam["valid_from_raw"])
                current_notam["valid_to"] = self.parse_notam_time(current_notam["valid_to_raw"])
                current_notam["duration_category"] = self.calculate_duration_category(current_notam)
                current_notam["raw_json"] = {"source": file_path.name}
                
                self.records.append(current_notam)
            current_notam = None

        # Extract unified blocks of text
        segments = re.split(r"(<table.*?>.*?</table>)", content, flags=re.DOTALL)
        blocks = []
        for seg in segments:
            seg = seg.strip()
            if not seg:
                continue
                
            if seg.startswith("<table"):
                table_soup = BeautifulSoup(seg, "html.parser")
                for row in table_soup.find_all("tr"):
                    cells = row.find_all(["td", "th"])
                    for c in cells:
                        for br in c.find_all("br"):
                            br.replace_with("\n")
                        txt = c.get_text(separator="\n").strip()
                        if txt:
                            # Split strictly by newline to simulate linear flow
                            for line in txt.split("\n"):
                                line = line.strip()
                                # Clean any rogue markdown markers
                                line = re.sub(r"^\*+|\*+$|^#+", "", line).strip()
                                if line:
                                    blocks.append(line)
            else:
                for line in seg.split("\n"):
                    line = line.strip()
                    line = re.sub(r"^\*+|\*+$|^#+", "", line).strip()
                    if line:
                        blocks.append(line)

        # FSM States
        STATE_SEEKING_HEADER = 0
        STATE_SEEKING_NOTAM = 1
        STATE_BUILDING_NOTAM = 2

        state = STATE_SEEKING_HEADER
        passed_checklist = False

        for block in blocks:
            upper_block = block.upper()
            
            # 1. End of Document Fencing
            if "LATEST PUBLICATIONS" in upper_block or "AIP SUP CHECKLIST AS ON" in upper_block or "AIP AIRAC AMDT" in upper_block:
                break
                
            # 2. Checklist Fencing
            if not passed_checklist:
                if "CHECKLIST" in upper_block and "AIP" not in upper_block:
                    continue
                # Once we encounter a valid header, the checklist is over.
                htype, icaos = self._classify_header(block)
                if htype:
                    passed_checklist = True
                else:
                    continue

            # FSM Transitions
            if state == STATE_SEEKING_HEADER:
                htype, icaos = self._classify_header(block)
                if htype:
                    if htype == "fir":
                        self.current_fir = "/".join(icaos) if icaos else self.current_fir
                        self.current_airport = None
                    elif htype == "airport":
                        self.current_airport = icaos[0] if icaos else None
                        self.current_fir = self.default_fir
                    state = STATE_SEEKING_NOTAM
                continue

            elif state == STATE_SEEKING_NOTAM:
                # Check for Header Change
                htype, icaos = self._classify_header(block)
                if htype and not NOTAM_ID_PATTERN.search(block):
                    if htype == "fir":
                        self.current_fir = "/".join(icaos) if icaos else self.current_fir
                        self.current_airport = None
                    elif htype == "airport":
                        self.current_airport = icaos[0] if icaos else None
                        self.current_fir = self.default_fir
                    continue

                # Check for NOTAM ID
                found_ids = NOTAM_ID_PATTERN.findall(block)
                if found_ids:
                    primary_id = found_ids[0]
                    current_notam = {
                        "notam_id": primary_id, "series": self.series,
                        "fir": self.current_fir, "airport_icao": self.current_airport,
                        "valid_from_raw": None, "valid_to_raw": None, "description": ""
                    }
                    state = STATE_BUILDING_NOTAM
                    
                    # Process remaining text in building block
                    remainder = block.replace(primary_id, "").strip()
                    if remainder:
                        v_match = VALIDITY_PATTERN.search(remainder)
                        if v_match:
                            current_notam["valid_from_raw"] = v_match.group(1)
                            current_notam["valid_to_raw"] = v_match.group(2)
                            desc = remainder[v_match.end():].strip()
                            if desc:
                                current_notam["description"] += desc + "\n"
                        else:
                            current_notam["description"] += remainder + "\n"
                continue

            elif state == STATE_BUILDING_NOTAM:
                # Check for Header Change
                htype, icaos = self._classify_header(block)
                if htype and not NOTAM_ID_PATTERN.search(block):
                    commit_notam()
                    if htype == "fir":
                        self.current_fir = "/".join(icaos) if icaos else self.current_fir
                        self.current_airport = None
                    elif htype == "airport":
                        self.current_airport = icaos[0] if icaos else None
                        self.current_fir = self.default_fir
                    state = STATE_SEEKING_NOTAM
                    continue

                # Check for New NOTAM
                found_ids = NOTAM_ID_PATTERN.findall(block)
                if found_ids:
                    commit_notam()
                    primary_id = found_ids[0]
                    current_notam = {
                        "notam_id": primary_id, "series": self.series,
                        "fir": self.current_fir, "airport_icao": self.current_airport,
                        "valid_from_raw": None, "valid_to_raw": None, "description": ""
                    }
                    
                    remainder = block.replace(primary_id, "").strip()
                    if remainder:
                        v_match = VALIDITY_PATTERN.search(remainder)
                        if v_match:
                            current_notam["valid_from_raw"] = v_match.group(1)
                            current_notam["valid_to_raw"] = v_match.group(2)
                            desc = remainder[v_match.end():].strip()
                            if desc:
                                current_notam["description"] += desc + "\n"
                        else:
                            current_notam["description"] += remainder + "\n"
                    continue

                # Append to current description
                if not current_notam.get("valid_from_raw"):
                    v_match = VALIDITY_PATTERN.search(block)
                    if v_match:
                        current_notam["valid_from_raw"] = v_match.group(1)
                        current_notam["valid_to_raw"] = v_match.group(2)
                        desc = block[v_match.end():].strip()
                        if desc:
                            current_notam["description"] += desc + "\n"
                    else:
                        current_notam["description"] += block + "\n"
                else:
                    current_notam["description"] += block + "\n"

        commit_notam()
        return self.records


class DelhiLlamaParser(BaseNotamParser):
    """
    Parser bespoke to Delhi Series A/C/G formats from LlamaParse Markdown.
    Uses BeautifulSoup to extract logical NOTAM blocks from HTML tables,
    and preserves table formatting within NOTAM descriptions.
    """

    def extract_from_md(self, file_path: Path):
        print(f"  [*] Parsing Delhi Markdown: {file_path.name}...")

        match = re.search(r"([A-Za-z]+)_([A-Z])_(\d{4})_(\d{2})", file_path.name)
        if match:
            fir_raw = match.group(1).upper()
            self.current_fir = "VIDP" if fir_raw == "DELHI" else fir_raw
            self.series = match.group(2).upper()
        else:
            self.current_fir = "VIDP"
            self.series = "A" if "_A_" in file_path.name else ("C" if "_C_" in file_path.name else "G")
            
        self.default_fir = self.current_fir

        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        
        current_notam = None

        def commit_notam():
            nonlocal current_notam
            if current_notam and current_notam.get("valid_from_raw"):
                current_notam["description"] = re.sub(r"\n{3,}", "\n\n", current_notam["description"]).strip()
                s = current_notam["series"]
                current_notam["scope"] = (
                    "INT_L" if s == "A" else
                    "INT_S" if s == "B" else
                    "DOM" if s == "C" else
                    "MIL_DOM" if s == "D" else
                    "GEN" if s == "G" else
                    "SNOWTAM" if s.startswith("SW") else "UNKNOWN"
                )
                current_notam["is_permanent"] = "PERM" in (current_notam.get("valid_to_raw") or "").upper()
                current_notam["is_estimated"] = "EST" in (current_notam.get("valid_to_raw") or "").upper()
                current_notam["valid_from"] = self.parse_notam_time(current_notam["valid_from_raw"])
                current_notam["valid_to"] = self.parse_notam_time(current_notam["valid_to_raw"])
                current_notam["duration_category"] = self.calculate_duration_category(current_notam)
                current_notam["raw_json"] = {"source": file_path.name}
                self.records.append(current_notam)
            current_notam = None

        blocks = []
        segments = re.split(r"(<table.*?>.*?</table>)", content, flags=re.DOTALL)
        for seg in segments:
            seg = seg.strip()
            if not seg:
                continue
                
            if seg.startswith("<table"):
                table_soup = BeautifulSoup(seg, "html.parser")
                for row in table_soup.find_all("tr"):
                    cells = row.find_all(["td", "th"])
                    row_texts = []
                    for c in cells:
                        for br in c.find_all("br"):
                            br.replace_with("\n")
                        txt = c.get_text(separator="\n").strip()
                        row_texts.append(txt)
                    if row_texts:
                        blocks.append({"type": "table_row", "data": row_texts})
            else:
                for line in seg.split("\n"):
                    line = line.strip()
                    if line:
                        blocks.append({"type": "text", "data": line})

        STATE_SEEKING_HEADER = 0
        STATE_SEEKING_NOTAM = 1
        STATE_BUILDING_NOTAM = 2

        state = STATE_SEEKING_HEADER
        passed_checklist = False

        for block in blocks:
            if block["type"] == "text":
                raw_text = block["data"]
                clean_text = re.sub(r"^[>\*\-#]+\s*", "", raw_text).strip()
                unformatted_text = re.sub(r"\*+", "", clean_text).strip()
            else:
                raw_text = " | ".join(cell.replace("\n", " ") for cell in block["data"])
                clean_text = " ".join(block["data"])
                unformatted_text = clean_text

            upper_text = unformatted_text.upper()
            
            if "LATEST PUBLICATIONS" in upper_text or "AIP SUP CHECKLIST AS ON" in upper_text or "AIP AIRAC AMDT" in upper_text:
                break
                
            if not passed_checklist:
                if "CHECKLIST" in upper_text and "AIP" not in upper_text:
                    continue
                htype, icaos = self._classify_header(unformatted_text)
                if htype:
                    passed_checklist = True
                else:
                    continue

            htype, icaos = self._classify_header(unformatted_text)
            if htype and not NOTAM_ID_PATTERN.search(unformatted_text):
                commit_notam()
                if htype == "fir":
                    self.current_fir = "/".join(icaos) if icaos else self.current_fir
                    self.current_airport = None
                elif htype == "airport":
                    self.current_airport = icaos[0] if icaos else None
                    self.current_fir = self.default_fir
                state = STATE_SEEKING_NOTAM
                continue

            found_ids = NOTAM_ID_PATTERN.findall(unformatted_text)
            if found_ids:
                commit_notam()
                primary_id = found_ids[0]
                current_notam = {
                    "notam_id": primary_id, "series": self.series,
                    "fir": self.current_fir, "airport_icao": self.current_airport,
                    "valid_from_raw": None, "valid_to_raw": None, "description": ""
                }
                state = STATE_BUILDING_NOTAM
                
                if block["type"] == "table_row" and len(block["data"]) >= 2:
                    cell_0 = block["data"][0]
                    cell_1 = block["data"][1]
                    if primary_id in cell_0:
                        v_match = VALIDITY_PATTERN.search(cell_1)
                        if v_match:
                            current_notam["valid_from_raw"] = v_match.group(1)
                            current_notam["valid_to_raw"] = v_match.group(2)
                            desc = cell_1[v_match.end():].strip()
                            if desc:
                                current_notam["description"] += desc + "\n"
                        else:
                            current_notam["description"] += cell_1 + "\n"
                        
                        if len(block["data"]) > 2:
                            current_notam["description"] += " | ".join(block["data"][2:]) + "\n"
                        continue

                remainder = clean_text.replace(primary_id, "").strip()
                if remainder:
                    v_match = VALIDITY_PATTERN.search(remainder)
                    if v_match:
                        current_notam["valid_from_raw"] = v_match.group(1)
                        current_notam["valid_to_raw"] = v_match.group(2)
                        desc = remainder[v_match.end():].strip()
                        if desc:
                            current_notam["description"] += desc + "\n"
                    else:
                        current_notam["description"] += remainder + "\n"
                continue

            if state == STATE_BUILDING_NOTAM:
                if not current_notam.get("valid_from_raw"):
                    v_match = VALIDITY_PATTERN.search(unformatted_text)
                    if v_match:
                        current_notam["valid_from_raw"] = v_match.group(1)
                        current_notam["valid_to_raw"] = v_match.group(2)
                        desc = clean_text[v_match.end():].strip()
                        if desc:
                            current_notam["description"] += desc + "\n"
                        continue
                
                if block["type"] == "text":
                    current_notam["description"] += clean_text + "\n"
                else:
                    current_notam["description"] += raw_text + "\n"

        commit_notam()
        return self.records


class KolkataLlamaParser(BaseNotamParser):
    """
    Parser bespoke to Kolkata Series A/C formats from LlamaParse Markdown.
    Uses BeautifulSoup to extract logical NOTAM blocks from HTML tables,
    and supports capturing descriptions spanning multiple rows inside tables.
    """

    def extract_from_md(self, file_path: Path):
        print(f"  [*] Parsing Kolkata Markdown: {file_path.name}...")

        match = re.search(r"([A-Za-z]+)_([A-Z])_(\d{4})_(\d{2})", file_path.name)
        if match:
            fir_raw = match.group(1).upper()
            self.current_fir = "VECF" if fir_raw == "KOLKATA" else fir_raw
            self.series = match.group(2).upper()
        else:
            self.current_fir = "VECF"
            self.series = "A" if "_A_" in file_path.name else "C"
            
        self.default_fir = self.current_fir

        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        
        current_notam = None

        def commit_notam():
            nonlocal current_notam
            if current_notam and current_notam.get("valid_from_raw"):
                current_notam["description"] = re.sub(r"\n{3,}", "\n\n", current_notam["description"]).strip()
                s = current_notam["series"]
                current_notam["scope"] = (
                    "INT_L" if s == "A" else
                    "INT_S" if s == "B" else
                    "DOM" if s == "C" else
                    "MIL_DOM" if s == "D" else
                    "GEN" if s == "G" else
                    "SNOWTAM" if s.startswith("SW") else "UNKNOWN"
                )
                current_notam["is_permanent"] = "PERM" in (current_notam.get("valid_to_raw") or "").upper()
                current_notam["is_estimated"] = "EST" in (current_notam.get("valid_to_raw") or "").upper()
                current_notam["valid_from"] = self.parse_notam_time(current_notam["valid_from_raw"])
                current_notam["valid_to"] = self.parse_notam_time(current_notam["valid_to_raw"])
                current_notam["duration_category"] = self.calculate_duration_category(current_notam)
                current_notam["raw_json"] = {"source": file_path.name}
                self.records.append(current_notam)
            current_notam = None

        blocks = []
        segments = re.split(r"(<table.*?>.*?</table>)", content, flags=re.DOTALL)
        for seg in segments:
            seg = seg.strip()
            if not seg:
                continue
                
            if seg.startswith("<table"):
                table_soup = BeautifulSoup(seg, "html.parser")
                for row in table_soup.find_all("tr"):
                    cells = row.find_all(["td", "th"])
                    row_texts = []
                    for c in cells:
                        for br in c.find_all("br"):
                            br.replace_with("\n")
                        txt = c.get_text(separator="\n").strip()
                        row_texts.append(txt)
                    if row_texts:
                        blocks.append({"type": "table_row", "data": row_texts})
            else:
                for line in seg.split("\n"):
                    line = line.strip()
                    if line:
                        blocks.append({"type": "text", "data": line})

        STATE_SEEKING_HEADER = 0
        STATE_SEEKING_NOTAM = 1
        STATE_BUILDING_NOTAM = 2

        state = STATE_SEEKING_HEADER
        passed_checklist = False

        for block in blocks:
            if block["type"] == "text":
                raw_text = block["data"]
                clean_text = re.sub(r"^[>\*\-#]+\s*", "", raw_text).strip()
                unformatted_text = re.sub(r"\*+", "", clean_text).strip()
            else:
                raw_text = " | ".join(cell.replace("\n", " ") for cell in block["data"])
                clean_text = " ".join(block["data"])
                unformatted_text = clean_text

            upper_text = unformatted_text.upper()
            
            if "LATEST PUBLICATIONS" in upper_text or "AIP SUP CHECKLIST AS ON" in upper_text or "AIP AIRAC AMDT" in upper_text or "NOTE: FOR TEXT OF NOTAM PERTAINING" in upper_text:
                if "NOTE: FOR TEXT OF NOTAM PERTAINING" in upper_text and not passed_checklist:
                     pass
                elif "LATEST PUBLICATIONS" in upper_text or "AIP SUP CHECKLIST AS ON" in upper_text or "AIP AIRAC AMDT" in upper_text:
                    break
                
            if not passed_checklist:
                if "CHECKLIST" in upper_text and "AIP" not in upper_text:
                    continue
                htype, icaos = self._classify_header(unformatted_text)
                if htype or "AGARTALA" in upper_text or "ANDAMAN" in upper_text:
                    passed_checklist = True
                else:
                    continue

            htype, icaos = self._classify_header(unformatted_text)
            if htype and not NOTAM_ID_PATTERN.search(unformatted_text):
                commit_notam()
                if htype == "fir":
                    self.current_fir = "/".join(icaos) if icaos else self.current_fir
                    self.current_airport = None
                elif htype == "airport":
                    self.current_airport = icaos[0] if icaos else None
                    self.current_fir = self.default_fir
                state = STATE_SEEKING_NOTAM
                continue

            found_ids = NOTAM_ID_PATTERN.findall(unformatted_text)
            if found_ids:
                commit_notam()
                primary_id = found_ids[0]
                current_notam = {
                    "notam_id": primary_id, "series": self.series,
                    "fir": self.current_fir, "airport_icao": self.current_airport,
                    "valid_from_raw": None, "valid_to_raw": None, "description": ""
                }
                state = STATE_BUILDING_NOTAM
                
                if block["type"] == "table_row" and len(block["data"]) >= 2:
                    cell_0 = block["data"][0]
                    cell_1 = block["data"][1]
                    if primary_id in cell_0:
                        v_match = VALIDITY_PATTERN.search(cell_1)
                        if v_match:
                            current_notam["valid_from_raw"] = v_match.group(1)
                            current_notam["valid_to_raw"] = v_match.group(2)
                            desc = cell_1[v_match.end():].strip()
                            if desc:
                                current_notam["description"] += desc + "\n"
                        else:
                            current_notam["description"] += cell_1 + "\n"
                        
                        if len(block["data"]) > 2:
                            current_notam["description"] += " ".join(cell for cell in block["data"][2:] if cell.strip()) + "\n"
                        continue

                remainder = clean_text.replace(primary_id, "").strip()
                if remainder:
                    v_match = VALIDITY_PATTERN.search(remainder)
                    if v_match:
                        current_notam["valid_from_raw"] = v_match.group(1)
                        current_notam["valid_to_raw"] = v_match.group(2)
                        desc = remainder[v_match.end():].strip()
                        if desc:
                            current_notam["description"] += desc + "\n"
                    else:
                        current_notam["description"] += remainder + "\n"
                continue

            if state == STATE_BUILDING_NOTAM:
                if not current_notam.get("valid_from_raw"):
                    v_match = VALIDITY_PATTERN.search(unformatted_text)
                    if v_match:
                        current_notam["valid_from_raw"] = v_match.group(1)
                        current_notam["valid_to_raw"] = v_match.group(2)
                        desc = clean_text[v_match.end():].strip()
                        if desc:
                            current_notam["description"] += desc + "\n"
                        continue
                
                if block["type"] == "text":
                    current_notam["description"] += clean_text + "\n"
                else:
                    non_empty = [c for c in block["data"] if c.strip()]
                    if non_empty:
                        current_notam["description"] += " ".join(non_empty) + "\n"

        commit_notam()
        return self.records


class MumbaiLlamaParser(BaseNotamParser):
    """
    Parser bespoke to Mumbai Series A/C formats from LlamaParse Markdown.
    Follows a similar extraction paradigm to Kolkata but implemented modularly
    for isolated future updates.
    """

    def extract_from_md(self, file_path: Path):
        print(f"  [*] Parsing Mumbai Markdown: {file_path.name}...")

        match = re.search(r"([A-Za-z]+)_([A-Z])_(\d{4})_(\d{2})", file_path.name)
        if match:
            fir_raw = match.group(1).upper()
            self.current_fir = "VABF" if fir_raw == "MUMBAI" else fir_raw
            self.series = match.group(2).upper()
        else:
            self.current_fir = "VABF"
            self.series = "A" if "_A_" in file_path.name else "C"
            
        self.default_fir = self.current_fir

        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        
        current_notam = None

        def commit_notam():
            nonlocal current_notam
            if current_notam and current_notam.get("valid_from_raw"):
                current_notam["description"] = re.sub(r"\n{3,}", "\n\n", current_notam["description"]).strip()
                s = current_notam["series"]
                current_notam["scope"] = (
                    "INT_L" if s == "A" else
                    "INT_S" if s == "B" else
                    "DOM" if s == "C" else
                    "MIL_DOM" if s == "D" else
                    "GEN" if s == "G" else
                    "SNOWTAM" if s.startswith("SW") else "UNKNOWN"
                )
                current_notam["is_permanent"] = "PERM" in (current_notam.get("valid_to_raw") or "").upper()
                current_notam["is_estimated"] = "EST" in (current_notam.get("valid_to_raw") or "").upper()
                current_notam["valid_from"] = self.parse_notam_time(current_notam["valid_from_raw"])
                current_notam["valid_to"] = self.parse_notam_time(current_notam["valid_to_raw"])
                current_notam["duration_category"] = self.calculate_duration_category(current_notam)
                current_notam["raw_json"] = {"source": file_path.name}
                self.records.append(current_notam)
            current_notam = None

        blocks = []
        segments = re.split(r"(<table.*?>.*?</table>)", content, flags=re.DOTALL)
        for seg in segments:
            seg = seg.strip()
            if not seg:
                continue
                
            if seg.startswith("<table"):
                table_soup = BeautifulSoup(seg, "html.parser")
                for row in table_soup.find_all("tr"):
                    cells = row.find_all(["td", "th"])
                    row_texts = []
                    for c in cells:
                        for br in c.find_all("br"):
                            br.replace_with("\n")
                        txt = c.get_text(separator="\n").strip()
                        row_texts.append(txt)
                    if row_texts:
                        blocks.append({"type": "table_row", "data": row_texts})
            else:
                for line in seg.split("\n"):
                    line = line.strip()
                    if line:
                        blocks.append({"type": "text", "data": line})

        STATE_SEEKING_HEADER = 0
        STATE_SEEKING_NOTAM = 1
        STATE_BUILDING_NOTAM = 2

        state = STATE_SEEKING_HEADER
        passed_checklist = False

        for block in blocks:
            if block["type"] == "text":
                raw_text = block["data"]
                clean_text = re.sub(r"^[>\*\-#]+\s*", "", raw_text).strip()
                unformatted_text = re.sub(r"\*+", "", clean_text).strip()
            else:
                raw_text = " | ".join(cell.replace("\n", " ") for cell in block["data"])
                clean_text = " ".join(block["data"])
                unformatted_text = clean_text

            upper_text = unformatted_text.upper()
            
            if "LATEST PUBLICATIONS" in upper_text or "AIP SUP CHECKLIST AS ON" in upper_text or "AIP AIRAC AMDT" in upper_text or "NOTE: FOR TEXT OF NOTAM PERTAINING" in upper_text:
                if "NOTE: FOR TEXT OF NOTAM PERTAINING" in upper_text and not passed_checklist:
                     pass
                elif "LATEST PUBLICATIONS" in upper_text or "AIP SUP CHECKLIST AS ON" in upper_text or "AIP AIRAC AMDT" in upper_text:
                    break
                
            if not passed_checklist:
                if "CHECKLIST" in upper_text and "AIP" not in upper_text:
                    continue
                htype, icaos = self._classify_header(unformatted_text)
                if htype or "AHMEDABAD" in upper_text or "MUMBAI" in upper_text:
                    passed_checklist = True
                else:
                    continue

            htype, icaos = self._classify_header(unformatted_text)
            if htype and not NOTAM_ID_PATTERN.search(unformatted_text):
                commit_notam()
                if htype == "fir":
                    self.current_fir = "/".join(icaos) if icaos else self.current_fir
                    self.current_airport = None
                elif htype == "airport":
                    self.current_airport = icaos[0] if icaos else None
                    self.current_fir = self.default_fir
                state = STATE_SEEKING_NOTAM
                continue

            found_ids = NOTAM_ID_PATTERN.findall(unformatted_text)
            if found_ids:
                commit_notam()
                primary_id = found_ids[0]
                current_notam = {
                    "notam_id": primary_id, "series": self.series,
                    "fir": self.current_fir, "airport_icao": self.current_airport,
                    "valid_from_raw": None, "valid_to_raw": None, "description": ""
                }
                state = STATE_BUILDING_NOTAM
                
                if block["type"] == "table_row" and len(block["data"]) >= 2:
                    cell_0 = block["data"][0]
                    cell_1 = block["data"][1]
                    if primary_id in cell_0:
                        v_match = VALIDITY_PATTERN.search(cell_1)
                        if v_match:
                            current_notam["valid_from_raw"] = v_match.group(1)
                            current_notam["valid_to_raw"] = v_match.group(2)
                            desc = cell_1[v_match.end():].strip()
                            if desc:
                                current_notam["description"] += desc + "\n"
                        else:
                            current_notam["description"] += cell_1 + "\n"
                        
                        if len(block["data"]) > 2:
                            current_notam["description"] += " ".join(cell for cell in block["data"][2:] if cell.strip()) + "\n"
                        continue

                remainder = clean_text.replace(primary_id, "").strip()
                if remainder:
                    v_match = VALIDITY_PATTERN.search(remainder)
                    if v_match:
                        current_notam["valid_from_raw"] = v_match.group(1)
                        current_notam["valid_to_raw"] = v_match.group(2)
                        desc = remainder[v_match.end():].strip()
                        if desc:
                            current_notam["description"] += desc + "\n"
                    else:
                        current_notam["description"] += remainder + "\n"
                continue

            if state == STATE_BUILDING_NOTAM:
                if not current_notam.get("valid_from_raw"):
                    v_match = VALIDITY_PATTERN.search(unformatted_text)
                    if v_match:
                        current_notam["valid_from_raw"] = v_match.group(1)
                        current_notam["valid_to_raw"] = v_match.group(2)
                        desc = clean_text[v_match.end():].strip()
                        if desc:
                            current_notam["description"] += desc + "\n"
                        continue
                
                if block["type"] == "text":
                    current_notam["description"] += clean_text + "\n"
                else:
                    non_empty = [c for c in block["data"] if c.strip()]
                    if non_empty:
                        current_notam["description"] += " ".join(non_empty) + "\n"

        commit_notam()
        return self.records


class NOTAMETL:
    def __init__(self, db_url):
        self.engine = create_engine(db_url)

    def select_parser(self, filepath: Path) -> BaseNotamParser:
        name = filepath.name.lower()
        if "chennai" in name:
            return ChennaiLlamaParser()
        if "delhi" in name:
            return DelhiLlamaParser()
        if "kolkata" in name:
            return KolkataLlamaParser()
        if "mumbai" in name:
            return MumbaiLlamaParser()
        # Pending classes for other FIRs
        return BaseNotamParser()

    def process_all(self, directory: Path):
        all_markdowns = sorted(
            [
                f
                for f in directory.glob("*.md")
                if re.search(r"[A-Za-z]+_[A-Z]_\d{4}_\d{2}", f.name)
            ]
        )
        if not all_markdowns:
            print("[!] No .md files found.")
            return

        all_records = []
        description_cache = {}

        for md_file in all_markdowns:
            # We will process Chennai, Delhi, Kolkata, and Mumbai
            if not any(fir in md_file.name.lower() for fir in ["chennai", "delhi", "kolkata", "mumbai"]):
                continue

            # Skip Delhi January files as their active NOTAMs are carried forward
            match = re.search(r"([A-Za-z]+)_([A-Z])_(\d{4})_(\d{2})", md_file.name)
            if match and match.group(1).lower() == "delhi" and match.group(4) == "01":
                continue

            parser = self.select_parser(md_file)
            recs = parser.extract_from_md(md_file)

            # Apply Description Caching Logic
            for r in recs:
                notam_id = r.get("notam_id")
                desc = r.get("description", "").strip()
                # Stripping asterisks and whitespace to ensure it's truly a description
                import re as core_re
                clean_desc = core_re.sub(r"[\*\s\|]+", "", desc).upper()
                if clean_desc and clean_desc not in ("EST", "PERM"):
                    description_cache[notam_id] = desc
                else:
                    r["description"] = description_cache.get(notam_id, "")

            print(f"  [+] Extracted {len(recs)} NOTAMs.")
            all_records.extend(recs)

        if all_records:
            self.load_to_db(all_records)

        print("\n[!] ETL Process Completed Successfully.")

    def load_to_db(self, records):
        if not records:
            return

        print(
            f"[*] Loading {len(records)} records to PostgreSQL mapping entirely to ICAO (3.5.1/3.5.2)..."
        )

        with self.engine.begin() as conn:
            conn.execute(
                text("""
                DROP TABLE IF EXISTS notams;
                CREATE TABLE notams (
                    notam_id TEXT,
                    source_file TEXT,
                    series TEXT,
                    scope TEXT,
                    fir TEXT,
                    combined_fir TEXT,
                    airport_icao TEXT,
                    valid_from TIMESTAMP,
                    valid_to TIMESTAMP,
                    is_permanent BOOLEAN,
                    is_estimated BOOLEAN,
                    duration_category TEXT,
                    description TEXT,
                    raw_json JSONB,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (notam_id, source_file)
                );
            """)
            )

        with self.engine.begin() as conn:
            for r in records:
                stmt = text("""
                    INSERT INTO notams (notam_id, source_file, series, scope, fir, combined_fir, airport_icao, valid_from, valid_to, is_permanent, is_estimated, duration_category, description, raw_json)
                    VALUES (:notam_id, :source_file, :series, :scope, :fir, :combined_fir, :airport_icao, :valid_from, :valid_to, :is_permanent, :is_estimated, :duration_category, :description, :raw_json)
                    ON CONFLICT (notam_id, source_file) DO UPDATE SET
                        series = EXCLUDED.series,
                        scope = EXCLUDED.scope,
                        fir = EXCLUDED.fir,
                        combined_fir = EXCLUDED.combined_fir,
                        airport_icao = EXCLUDED.airport_icao,
                        valid_from = EXCLUDED.valid_from,
                        valid_to = EXCLUDED.valid_to,
                        is_permanent = EXCLUDED.is_permanent,
                        is_estimated = EXCLUDED.is_estimated,
                        duration_category = EXCLUDED.duration_category,
                        description = EXCLUDED.description,
                        raw_json = EXCLUDED.raw_json,
                        updated_at = CURRENT_TIMESTAMP;
                """)
                data = {
                    "notam_id": r["notam_id"],
                    "source_file": r.get("raw_json", {}).get("source", "unknown"),
                    "series": r["series"],
                    "scope": r.get("scope", "UNKNOWN"),
                    "fir": r.get("fir").split("/")[0] if r.get("fir") else None,
                    "combined_fir": r.get("fir") if (r.get("fir") and "/" in r.get("fir")) else None,
                    "airport_icao": r.get("airport_icao"),
                    "valid_from": r.get("valid_from"),
                    "valid_to": r.get("valid_to"),
                    "is_permanent": r.get("is_permanent", False),
                    "is_estimated": r.get("is_estimated", False),
                    "duration_category": r.get("duration_category", "UNKNOWN"),
                    "description": r.get("description", ""),
                    "raw_json": json.dumps(r.get("raw_json", {})),
                }
                conn.execute(stmt, data)


if __name__ == "__main__":
    db_url = (
        "postgresql://postgres:postgres@localhost:5432/aeronautical_information_system"
    )
    etl_pipeline = NOTAMETL(db_url)

    output_dir = Path(__file__).resolve().parent.parent.parent / "output"
    etl_pipeline.process_all(output_dir)
