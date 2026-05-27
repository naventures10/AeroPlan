import json
import os
import re

import boto3
import psycopg2
from psycopg2.extras import execute_values


class NavAidLoader:
    """Loads ENR 4.1 Radio Navigation Aids from MinIO into the PostGIS database."""

    # Classify the aid type from the station name
    AID_TYPE_PATTERNS = [
        ("DVOR/DME", "DVOR/DME"),
        ("VOR/DME", "VOR/DME"),
        ("DVOR", "DVOR"),
        ("VOR", "VOR"),
        ("NDB", "NDB"),
        ("DME", "DME"),
        ("TACAN", "TACAN"),
    ]

    def __init__(self, bucket_name="ais"):
        self.s3 = boto3.client(
            "s3",
            endpoint_url="http://localhost:9000",
            aws_access_key_id=os.environ.get("MINIO_ACCESS_KEY"),
            aws_secret_access_key=os.environ.get("MINIO_SECRET_KEY"),
            region_name="us-east-1",
        )
        self.bucket_name = bucket_name

        pg_user = os.getenv("PG_USER")
        pg_password = os.getenv("PG_PASSWORD")
        if not pg_user or not pg_password:
            raise ValueError("Missing required env var PG_USER/PG_PASSWORD")

        self.conn = psycopg2.connect(
            dbname="aeronautical_information_system",
            user=pg_user,
            password=pg_password,
            host="localhost",
            port="5432",
        )
        self.conn.autocommit = False

    @staticmethod
    def dms_to_decimal(coord_str):
        """Converts DMS strings with decimal seconds like '235325.48N' or '0911419.13E' to decimal degrees."""
        if not coord_str:
            return None

        match = re.match(r"([\d.]+)([NSEW])", coord_str)
        if not match:
            return None

        numbers, hemisphere = match.groups()
        is_lat = hemisphere in ["N", "S"]
        deg_len = 2 if is_lat else 3

        try:
            degrees = float(numbers[:deg_len])
            minutes = float(numbers[deg_len : deg_len + 2])
            seconds = float(numbers[deg_len + 2 :])

            decimal = degrees + (minutes / 60) + (seconds / 3600)
            if hemisphere in ["S", "W"]:
                decimal *= -1
            return round(decimal, 6)
        except ValueError:
            return None

    @classmethod
    def classify_aid_type(cls, station_name, frequency="", remarks=""):
        """Extracts the aid type (e.g. DVOR/DME, NDB) from the station name, frequency, and remarks."""
        upper_name = station_name.upper()

        # 1. Primary check: Station Name patterns
        for pattern, aid_type in cls.AID_TYPE_PATTERNS:
            if pattern in upper_name:
                return aid_type

        # 2. Secondary check: Frequency unit/format
        upper_freq = frequency.upper()
        if "KHZ" in upper_freq:
            return "NDB"
        if re.search(r"\b\d+[XY]\b", upper_freq) or re.match(r"^\d+[XY]$", upper_freq.strip()):
            return "DME"

        # 3. Tertiary check: Remarks
        upper_remarks = remarks.upper()
        if "VOR" in upper_remarks:
            return "VOR"
        if "NDB" in upper_remarks:
            return "NDB"
        if "DME" in upper_remarks:
            return "DME"

        return "UNKNOWN"

    @classmethod
    def parse_nav_aids(cls, data):
        """
        Parses the JSON payload and returns a list of tuples matching the radio_nav_aids schema:
        (station_name, ident, aid_type, frequency, hours_of_operation, elevation, remarks, raw_coordinates, geom_ewkt)
        """
        records = []
        for item in data.get("radio_navigation_aids", []):
            station_name = item.get("station_name", "")
            ident = item.get("id", "")
            frequency = item.get("frequency", "").replace("\n", " ").strip()
            hours = item.get("hours_of_operation", "")
            elevation = item.get("elevation", "").strip()
            remarks = item.get("remarks", "").strip()
            coords_str = item.get("coordinates", "")
            aid_type = cls.classify_aid_type(station_name, frequency=frequency, remarks=remarks)

            # Parse coordinates: "235325.48N 0911419.13E"
            lat_matches = re.findall(r"([\d.]+[NS])", coords_str.upper())
            lng_matches = re.findall(r"([\d.]+[EW])", coords_str.upper())

            if lat_matches and lng_matches:
                lat = cls.dms_to_decimal(lat_matches[0])
                lng = cls.dms_to_decimal(lng_matches[0])

                if lat and lng:
                    geom_ewkt = f"SRID=4326;POINT({lng} {lat})"
                    records.append(
                        (
                            station_name,
                            ident,
                            aid_type,
                            frequency,
                            hours,
                            elevation,
                            remarks,
                            coords_str,
                            geom_ewkt,
                        )
                    )

        return records

    def load_from_minio(self, filename="output/enr_4_1_radio_nav_aids.json"):
        """Fetches the radio nav aids JSON from MinIO and loads into PostGIS."""
        import sys

        from eaip_scrapper.validation.core.central_validator import ValidationRouter
        from eaip_scrapper.validation.schemas.database.nav_aids import NavAidDatabaseRecord

        print(f"[*] Fetching '{filename}' from MinIO bucket '{self.bucket_name}'...")
        try:
            response = self.s3.get_object(Bucket=self.bucket_name, Key=filename)
            raw_json_bytes = response["Body"].read()
            raw_json_string = raw_json_bytes.decode("utf-8")
            data = json.loads(raw_json_string)
        except Exception as e:
            print(f"[!] Failed to fetch or parse file from MinIO: {e}")
            sys.exit(1)

        # Ingest validation
        validator = ValidationRouter()
        validator.validate_ingest_json_string("enr_4_1_radio_nav_aids.json", raw_json_string)

        records = self.parse_nav_aids(data)

        # Strict DB-level validation
        print("[*] Performing strict database-level validation on all parsed nav aids...")
        for r in records:
            try:
                NavAidDatabaseRecord(
                    station_name=r[0],
                    ident=r[1],
                    aid_type=r[2],
                    frequency=r[3],
                    hours_of_operation=r[4],
                    elevation=r[5],
                    remarks=r[6],
                    raw_coordinates=r[7],
                    geom_ewkt=r[8],
                )
            except Exception as e:
                print(f"[!] Strict database validation failed for station '{r[0]}' ({r[1]}): {e}")
                sys.exit(1)

        print(f"[*] Parsed and validated {len(records)} nav aids. Pushing to database...")

        with self.conn.cursor() as cur:
            # Truncate for a clean idempotent reload
            cur.execute("TRUNCATE TABLE radio_nav_aids RESTART IDENTITY;")
            print("[!] Cleared existing records for a clean reload.")

            # Bulk insert all nav aids
            if records:
                execute_values(
                    cur,
                    """
                    INSERT INTO radio_nav_aids
                        (station_name, ident, aid_type, frequency, hours_of_operation, elevation, remarks, raw_coordinates, geom)
                    VALUES %s
                """,
                    records,
                    template="(%s, %s, %s, %s, %s, %s, %s, %s, ST_GeomFromEWKT(%s))",
                )

            self.conn.commit()

        print(f"[+] Successfully loaded {len(records)} radio nav aids into radio_nav_aids!")

    def close(self):
        """Closes the database connection."""
        if self.conn:
            self.conn.close()


if __name__ == "__main__":
    loader = NavAidLoader(bucket_name="ais")
    try:
        loader.load_from_minio(filename="output/enr_4_1_radio_nav_aids.json")
    finally:
        loader.close()
