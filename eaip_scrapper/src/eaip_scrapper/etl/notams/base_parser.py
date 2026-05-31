import os
import re
from datetime import datetime
from pathlib import Path

# MinIO Config
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "http://localhost:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY")
MINIO_BUCKET = os.getenv("MINIO_BUCKET", "ais")

ICAO_PATTERN = re.compile(r"\b(V[A-Z]{3})\b(?<!VIII)")  # Exclude VIII
NOTAM_ID_PATTERN = re.compile(r"([A-Za-z]\d{4}/\d{2})")
VALIDITY_PATTERN = re.compile(r"(\d{10})\s*/\s*(\d{10}|PERM|.+?EST|.+?PERM)")

# Mapping FIR City Names to ICAO for header detection
FIR_NAME_TO_ICAO = {
    "CHENNAI": "VOMF",
    "DELHI": "VIDF",
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
        self._current_airport = None
        self.series = None
        self.seen_airports = set()

    @property
    def current_airport(self):
        return self._current_airport

    @current_airport.setter
    def current_airport(self, value):
        self._current_airport = value
        if value:
            self.seen_airports.add(value)

    def validate_extraction(self, filename: str):
        airports_with_notams = set(
            r.get("airport_icao") for r in self.records if r.get("airport_icao")
        )
        empty_airports = self.seen_airports - airports_with_notams
        if empty_airports:
            print(
                f"  [WARN] {filename}: The following airports had headers but NO NOTAMs extracted: {', '.join(empty_airports)}. Please verify manually!"
            )

    def _extract_icao_from_text(self, text):
        return ICAO_PATTERN.findall(text)

    def _is_new_notam(self, text):
        found_ids = NOTAM_ID_PATTERN.findall(text)
        if not found_ids:
            return False, None
        primary_id = found_ids[0]
        prefix = text.split(primary_id)[0]
        if all(c in " \t\n\r*-_#|>|[]" for c in prefix):
            return True, primary_id
        return False, None

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
            if text_upper == f"{name} FIR":
                return "fir", [icao]

        # FIR keyword match must be in a short row (max 6 words)
        word_count = len(text_upper.split())
        is_fir = (re.search(r"\bFIR\b", text_upper) and word_count <= 6) or (
            icaos and any(icao in ["VOMF", "VIDF", "VABF", "VECF"] for icao in icaos)
        )
        if is_fir:
            return "fir", icaos if icaos else None

        # Extensive stop words that heavily indicate this is a description, NOT a header
        stop_words = [
            "AVBL",
            "NOT",
            "DUE",
            "WIP",
            "EXER",
            "CTN",
            "CLOSED",
            "CLSD",
            "WILL",
            "PLACE",
            "OPS",
            "ACT",
            "AREA",
            "ILS",
            "RWY",
            "APPROACH",
            "APCH",
            "GLIDE",
            "PATH",
            "GP",
            "MAINT",
            "TAR",
            "RADAR",
            "NDB",
            "DME",
            "FREQ",
            "MHZ",
            "TWR",
            "TOWER",
            "LAT",
            "LONG",
            "COORD",
            "DEG",
            "MIN",
            "SEC",
            "AT",
            "ON",
            "OF",
            "FOR",
            "AND",
            "TO",
            "IN",
            "WITH",
            "FROM",
            "BETWEEN",
            "BTN",
            "OUT",
            "OVER",
            "UNDER",
            "UPTO",
            "UP",
            "DOWN",
            "DRG",
            "DURING",
            "AFT",
            "AFTER",
            "BFR",
            "BEFORE",
            "ABV",
            "ABOVE",
            "BLW",
            "BELOW",
            "SFC",
            "SURFACE",
            "GND",
            "GROUND",
            "AMSL",
            "AGL",
            "MSL",
            "ELEV",
            "ELEVATION",
            "HGT",
            "HEIGHT",
            "DIST",
            "DISTANCE",
            "LEN",
            "LENGTH",
            "WID",
            "WIDTH",
            "DPT",
            "DEPTH",
            "ASDA",
            "TODA",
            "TORA",
            "LDA",
            "RESA",
            "PCN",
            "TR",
            "TRACK",
            "TAXI",
            "TWY",
            "APRN",
            "APRON",
            "PRKG",
            "PARKING",
            "STAND",
            "BAY",
            "CAT",
            "FLT",
            "FLIGHT",
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
            if not re.search(r"\d", remainder) and re.fullmatch(r"([A-Z\s\(\)/\-\|]+)", text_upper):
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
        raise NotImplementedError("FIR Parsers must implement their own extraction logic")
