import json
import os
import re
import sys

import boto3
import psycopg2
from psycopg2.extras import Json
from pydantic import ValidationError

from eaip_scrapper.validation.schemas.database.airspace import AirspaceMetadataDatabaseValidator

# --- Configuration ---
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "http://localhost:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY")
MINIO_BUCKET = os.getenv("MINIO_BUCKET", "ais")

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "aeronautical_information_system")
DB_USER = os.getenv("DB_USER")
DB_PASS = os.getenv("DB_PASS")

# Files to process
METADATA_FILES = [
    "output/enr_2_1_airspace.json",
    "output/enr_2_2_other_regulated_airspace.json",
    "output/enr_5_1_prohibited_restricted_danger.json",
    "output/enr_5_2_military_exercise_adiz.json",
    "output/enr_3_3_2_upr_zones.json",
]


class CoordinateParser:
    """Parses aeronautical coordinates from text."""

    # Pattern 1: Compact (1135N, 07200E, 250000N, 311959.3N)
    COORD_PATTERN_COMPACT = re.compile(r"(\d{4,7}(?:\.\d+)?)([NSEW])")

    # Pattern 2: Descriptive (11°35´N, 072°00´E)
    COORD_PATTERN_DESCRIPTIVE = re.compile(r"(\d{1,3})°(\d{1,2})(?:[´'])?([NSEW])")

    @staticmethod
    def parse_to_decimal(
        val: str, hemi: str, minutes: str | None = None, seconds: str | None = None
    ) -> float:
        """Converts degrees/minutes/seconds to decimal degrees."""
        if minutes is not None:
            # Handle descriptive format
            d = int(val)
            m = int(minutes)
            s = int(seconds) if seconds else 0
        else:
            # Handle compact format
            # Remove decimals for length check, but keep for seconds
            raw_val = val.split(".")[0]
            if len(raw_val) == 4:  # DDMM
                d, m, s_f = int(raw_val[:2]), int(raw_val[2:]), 0.0
            elif len(raw_val) == 5:  # DDDMM
                d, m, s_f = int(raw_val[:3]), int(raw_val[3:]), 0.0
            elif len(raw_val) == 6:  # DDMMSS
                d, m, s_f = int(raw_val[:2]), int(raw_val[2:4]), float(val[4:])
            elif len(raw_val) == 7:  # DDDMMSS
                d, m, s_f = int(raw_val[:3]), int(raw_val[3:5]), float(val[5:])
            else:
                return 0.0

            decimal = d + (m / 60.0) + (s_f / 3600.0)
            return -decimal if hemi in ["S", "W"] else decimal

        decimal = d + (m / 60.0) + (s / 3600.0)
        return -decimal if hemi in ["S", "W"] else decimal

    @classmethod
    def extract_points(cls, text: str) -> list[tuple[float, float]]:
        """Extracts all coordinate pairs from a text string."""
        if not text:
            return []

        points = []

        # Try Descriptive first
        desc_matches = cls.COORD_PATTERN_DESCRIPTIVE.findall(text)
        if desc_matches:
            temp_lat = None
            for d, m, hemi in desc_matches:
                decimal = cls.parse_to_decimal(d, hemi, minutes=m)
                if hemi in ["N", "S"]:
                    temp_lat = decimal
                elif hemi in ["E", "W"] and temp_lat is not None:
                    points.append((decimal, temp_lat))
                    temp_lat = None
            if points:
                return points

        # Try Compact
        compact_matches = cls.COORD_PATTERN_COMPACT.findall(text)
        temp_lat = None
        for val, hemi in compact_matches:
            decimal = cls.parse_to_decimal(val, hemi)
            if hemi in ["N", "S"]:
                temp_lat = decimal
            elif hemi in ["E", "W"] and temp_lat is not None:
                points.append((decimal, temp_lat))
                temp_lat = None

        return points


class AirspaceMetadataETL:
    def __init__(self):
        self.s3 = boto3.client(
            "s3",
            endpoint_url=MINIO_ENDPOINT,
            aws_access_key_id=MINIO_ACCESS_KEY,
            aws_secret_access_key=MINIO_SECRET_KEY,
            region_name="us-east-1",
        )
        self.conn = psycopg2.connect(
            host=DB_HOST, port=DB_PORT, dbname=DB_NAME, user=DB_USER, password=DB_PASS
        )
        self.conn.autocommit = True
        self._ensure_schema()

    def _ensure_schema(self):
        """Ensures the metadata table exists."""
        sql = """
        CREATE TABLE IF NOT EXISTS airspaces_metadata (
            id SERIAL PRIMARY KEY,
            name TEXT,
            identification TEXT,
            lateral_limits TEXT,
            upper_limit TEXT,
            lower_limit TEXT,
            classifications TEXT,
            remarks TEXT,
            source_file TEXT,
            services JSONB,
            airspace_type VARCHAR,
            geom Geometry(Point, 4326)
        );
        """
        with self.conn.cursor() as cur:
            cur.execute(sql)

    def process_file(self, file_key: str):
        print(f"\n[*] Processing metadata file: {file_key}")
        try:
            response = self.s3.get_object(Bucket=MINIO_BUCKET, Key=file_key)
            data = json.loads(response["Body"].read().decode("utf-8"))
        except Exception as e:
            print(f"  [X] Failed to fetch {file_key}: {e}")
            return

        if "flight_information_regions" in data:
            self._process_enr_2_1(data, file_key)
        elif "regulated_airspace" in data:
            self._process_enr_2_2(data, file_key)
        elif "regions" in data:  # ENR 5.1
            self._process_enr_5_1(data, file_key)
        elif (
            "military_exercise_and_training_areas" in data
            or "air_defence_identification_zones_adiz" in data
        ):
            self._process_enr_5_2(data, file_key)
        elif "upr_zones_raw_tables" in data:
            self._process_upr_zones(data, file_key)
        else:
            print(f"  [!] Unknown JSON structure in {file_key}")

    def _process_enr_2_1(self, data: dict, source_file: str):
        sections = [
            ("flight_information_regions", "FIR"),
            ("terminal_control_areas", "CTA_UPPER"),
            ("military_control_zones", "CTR"),
        ]

        for key, airspace_type in sections:
            if key in data:
                print(f"  [*] Processing {key} ({airspace_type})")
                for entry in data[key]:
                    name_and_limits = entry.get("name_and_limits", "")
                    lines = name_and_limits.split("\n")
                    name = lines[0] if lines else "Unknown"

                    vertical_limits = ""
                    for line in lines:
                        if "/" in line and ("GND" in line or "FL" in line or "UNL" in line):
                            vertical_limits = line
                            break

                    metadata = {
                        "name": name,
                        "lateral_limits": name_and_limits,
                        "vertical_limits": vertical_limits,
                        "services": entry.get("services", []),
                        "source_file": source_file,
                        "airspace_type": airspace_type,
                    }
                    self._insert_metadata(metadata)

    def _process_enr_2_2(self, data: dict, source_file: str):
        print("  [*] Processing Regulated Airspace")
        for entry in data.get("regulated_airspace", []):
            metadata = {
                "name": entry.get("aerodrome", "Regulated Airspace"),
                "lateral_limits": entry.get("lateral_limits", ""),
                "upper_limit": entry.get("upper_limit", ""),
                "remarks": entry.get("remarks", ""),
                "source_file": source_file,
                "airspace_type": "CTA_LOWER",
            }
            self._insert_metadata(metadata)

    def _process_enr_5_1(self, data: dict, source_file: str):
        for region_name, entries in data.get("regions", {}).items():
            print(f"  [*] Processing region: {region_name}")
            for entry in entries:
                metadata = {
                    "name": entry.get("name", ""),
                    "identification": entry.get("identification", ""),
                    "lateral_limits": entry.get("lateral_limits", ""),
                    "upper_limit": entry.get("upper_limit", ""),
                    "lower_limit": entry.get("lower_limit", ""),
                    "remarks": entry.get("remarks", ""),
                    "source_file": source_file,
                    "airspace_type": None,
                }

                ident = metadata["identification"].upper()
                if re.search(r"V[AEOI]D", ident):
                    metadata["airspace_type"] = "DANGER"
                elif re.search(r"V[AEOI]P", ident):
                    metadata["airspace_type"] = "PROHIBITED"
                elif re.search(r"V[AEOI]R", ident):
                    metadata["airspace_type"] = "RESTRICTED"
                elif "VOT" in ident or "TSA" in ident:
                    metadata["airspace_type"] = "TSA"
                elif "TRA" in ident:
                    metadata["airspace_type"] = "TRA"

                self._insert_metadata(metadata)

    @staticmethod
    def _infer_mil_type(name: str) -> str:
        """Infer TSA vs TRA from the name/identification string."""
        upper = name.upper()
        if re.search(r"\bTSA\d*", upper):
            return "TSA"
        return "TRA"

    @staticmethod
    def _extract_identification(name: str) -> str | None:
        """Extract the identification code (e.g. TSA802(C), TRA101) from a name string."""
        m = re.match(r"((?:TSA|TRA)\d+(?:\([A-Z]\))?)", name.strip(), re.IGNORECASE)
        return m.group(1).upper() if m else None

    def _process_enr_5_2(self, data: dict, source_file: str):
        mil_areas = data.get("military_exercise_and_training_areas", [])
        if isinstance(mil_areas, list):
            print(f"  [*] Processing Military Exercise Areas ({len(mil_areas)})")
            for entry in mil_areas:
                text = entry.get("name_and_lateral_limits", "")
                first_line = text.split("\n")[0] if text else "Unknown Military Area"
                # Strip coordinate junk after the pipe separator
                name = first_line.split("|")[0].strip() if "|" in first_line else first_line
                identification = self._extract_identification(name)
                airspace_type = self._infer_mil_type(name)
                metadata = {
                    "name": name,
                    "identification": identification,
                    "lateral_limits": text,
                    "upper_limit": entry.get("upper_lower_limits_and_system", ""),
                    "remarks": entry.get("remarks_and_time_of_act", ""),
                    "source_file": source_file,
                    "airspace_type": airspace_type,
                }
                self._insert_metadata(metadata)

        adiz_areas = data.get("air_defence_identification_zones_adiz", [])
        print(f"  [*] Processing ADIZ Areas ({len(adiz_areas)})")
        for entry in adiz_areas:
            text = entry.get("zone_coordinates") or entry.get("name_and_lateral_limits") or ""
            name = entry.get("zone_name") or (text.split("\n")[0] if text else "Unknown ADIZ")
            metadata = {
                "name": name,
                "lateral_limits": text,
                "upper_limit": entry.get("upper_lower_limits_and_system", "UNL"),
                "remarks": entry.get("remarks_and_time_of_act", ""),
                "source_file": source_file,
                "airspace_type": "ADIZ",
            }
            self._insert_metadata(metadata)

    def _process_upr_zones(self, data: dict, source_file: str):
        print("  [*] Processing UPR Zones")
        for table in data.get("upr_zones_raw_tables", []):
            for row in table:
                if len(row) < 2:
                    continue
                text_content = row[1]
                if "The UPR airspace for the" in text_content:
                    print("    [*] Found descriptive UPR text in table")
                    parts = re.split(r"(The UPR airspace for the)", text_content)
                    for i in range(1, len(parts), 2):
                        sub_text = parts[i + 1]
                        if "is the airspace within" in sub_text:
                            split_result = sub_text.split("is the airspace within", 1)
                            if len(split_result) == 2:
                                name_part, limits_part = split_result
                                name = name_part.strip()
                                metadata = {
                                    "name": f"UPR {name}",
                                    "lateral_limits": limits_part,
                                    "upper_limit": "FL280 to FL460",
                                    "remarks": "Scraped from descriptive block",
                                    "source_file": source_file,
                                    "airspace_type": "UPR_ZONE",
                                }
                                self._insert_metadata(metadata)
                else:
                    name = row[0]
                    if not name or "Designator" in name or "IDENTIFICATION" in name.upper():
                        continue
                    metadata = {
                        "name": name,
                        "lateral_limits": row[1],
                        "upper_limit": row[2] if len(row) > 2 else "",
                        "remarks": row[3] if len(row) > 3 else "",
                        "source_file": source_file,
                        "airspace_type": "UPR_ZONE",
                    }
                    self._insert_metadata(metadata)

    def _insert_metadata(self, metadata: dict):
        try:
            AirspaceMetadataDatabaseValidator.validate_metadata_record(metadata)
        except ValidationError as e:
            print("\n[!] DATA INTEGRITY FAILURE IN METADATA DICT!")
            print(e)
            print("[!] The metadata dict violates the schema contract. Halting pipeline.")
            sys.exit(1)

        # 1. Combine all text values to find coordinates anywhere in the block
        all_text_values = []
        for _k, v in metadata.items():
            if isinstance(v, str):
                all_text_values.append(v)
            elif isinstance(v, (list, dict)):
                all_text_values.append(json.dumps(v))

        combined_text = " ".join(all_text_values)

        # 2. Extract points
        points = CoordinateParser.extract_points(combined_text)

        geom_sql = "NULL"
        if points:
            # We will use PostgreSQL to calculate the centroid.
            # Convert list of points to a WKT MULTIPOINT string
            wkt_points = ", ".join([f"{lon} {lat}" for lon, lat in points])
            multipoint_wkt = f"'MULTIPOINT({wkt_points})'"
            # ST_Centroid on ST_GeomFromText gives the geometric center of all extracted points
            geom_sql = f"ST_SetSRID(ST_Centroid(ST_GeomFromText({multipoint_wkt})), 4326)"

        sql_insert = f"""
        INSERT INTO airspaces_metadata (
            name, identification, lateral_limits, upper_limit, lower_limit,
            classifications, remarks, source_file, services, airspace_type, geom
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, {geom_sql}
        )
        """
        try:
            params = (
                metadata.get("name"),
                metadata.get("identification"),
                metadata.get("lateral_limits"),
                metadata.get("upper_limit") or metadata.get("vertical_limits"),
                metadata.get("lower_limit"),
                metadata.get("classifications"),
                metadata.get("remarks"),
                metadata.get("source_file"),
                Json(metadata.get("services")) if metadata.get("services") else None,
                metadata.get("airspace_type"),
            )
            try:
                AirspaceMetadataDatabaseValidator.validate_metadata_params(params)
            except ValidationError as e:
                print("\n[!] DATA INTEGRITY FAILURE IN DB PARAMS!")
                print(e)
                print("[!] The parameter tuple violates the schema contract. Halting pipeline.")
                sys.exit(1)

            with self.conn.cursor() as cur:
                cur.execute(sql_insert, params)
                if points:
                    print(
                        # pyrefly: ignore [unsupported-operation]
                        f"    [+] Inserted '{metadata.get('name')[:30]}...' with centroid of {len(points)} coords"
                    )
                else:
                    print(
                        # pyrefly: ignore [unsupported-operation]
                        f"    [!] Inserted '{metadata.get('name')[:30]}...' WITHOUT geometry (No coords found)"
                    )
        except Exception as e:
            print(f"    [X] Failed to insert '{metadata.get('name')}': {e}")
            # self.conn.rollback()  # No-op since autocommit is True

    def run(self):
        print("[*] Truncating airspaces_metadata for fresh ingestion...")
        with self.conn.cursor() as cur:
            cur.execute("TRUNCATE TABLE airspaces_metadata RESTART IDENTITY CASCADE;")

        for file_key in METADATA_FILES:
            self.process_file(file_key)

        self.conn.close()


if __name__ == "__main__":
    etl = AirspaceMetadataETL()
    etl.run()
