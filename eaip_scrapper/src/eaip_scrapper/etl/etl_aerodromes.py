import json
import os
import re

import boto3
import psycopg2
from psycopg2.extras import Json, execute_values


class CoordinateConverter:
    @staticmethod
    def parse_dms(dms_string):
        if not dms_string or not isinstance(dms_string, str):
            return {"raw_dms": dms_string, "decimal_lat": None, "decimal_lng": None}

        # Sanitize: Remove all newlines and whitespace that could bisect decimals (e.g. '2538.\n73N')
        clean_string = re.sub(r"[\s\n\r]+", "", dms_string.upper())

        # The Regex Hunter: safely extracts the first valid Lat/Lng pair
        lat_matches = re.findall(r"(\d+(?:\.\d+)?[NS])", clean_string)
        lng_matches = re.findall(r"(\d+(?:\.\d+)?[EW])", clean_string)

        if not lat_matches or not lng_matches:
            return {"raw_dms": dms_string, "decimal_lat": None, "decimal_lng": None}

        lat_str = lat_matches[0]
        lng_str = lng_matches[0]

        def convert_to_decimal(coord_str, is_lat):
            match = re.match(r"([\d\.]+)([NSEW])", coord_str)
            if not match:
                return None

            numbers, hemisphere = match.groups()
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

        return {
            "raw_dms": dms_string,
            "decimal_lat": convert_to_decimal(lat_str, is_lat=True),
            "decimal_lng": convert_to_decimal(lng_str, is_lat=False),
        }


class SpatialRouter:
    @staticmethod
    def extract_number(text):
        """Helper to extract clean numbers from messy strings like '185 FT' and convert to meters if needed."""
        if not text:
            return None
        text_str = str(text).upper()
        match = re.search(r"(\d+(?:\.\d+)?)", text_str)
        if match:
            val = float(match.group(1))
            # If the text explicitly mentions FT or FEET, convert to Meters
            if "FT" in text_str or "FEET" in text_str:
                return round(val / 3.28084, 1)
            return val
        return None

    @staticmethod
    def create_point(coord_dict):
        """Helper to generate PostGIS WKT format."""
        if not coord_dict:
            return None
        lat, lng = coord_dict.get("decimal_lat"), coord_dict.get("decimal_lng")
        if lat and lng:
            return f"SRID=4326;POINT({lng} {lat})"
        return None

    @classmethod
    def route_features(cls, icao, enriched_doc):
        """Iterates through the JSON and segregates spatial data into a flat list."""
        features = []
        data = enriched_doc.get("data", {})

        # 1. ARP (Aerodrome Reference Point)
        arp_coords = data.get("geographical_data", {}).get("arp_coordinates_site", {})
        arp_geom = cls.create_point(arp_coords)
        arp_elev = None
        if arp_geom:
            arp_elev_str = data.get("geographical_data", {}).get("elevation_reference_temp")
            arp_elev = cls.extract_number(arp_elev_str)
            features.append(
                (
                    icao,
                    "ARP",
                    f"{icao} Reference Point",
                    arp_elev,
                    "NIL",
                    False,
                    0,
                    arp_geom,
                )
            )

        # 2. RUNWAY THRESHOLDS
        runways = data.get("runway_physical_characteristics", [])
        for rwy in runways:
            geom = cls.create_point(rwy.get("coordinates", {}))
            if geom:
                elev = cls.extract_number(rwy.get("thr_elevation"))
                features.append(
                    (
                        icao,
                        "RUNWAY_THRESHOLD",
                        f"RWY {rwy.get('designation', 'Unknown')}",
                        elev,
                        "NIL",
                        False,
                        0,
                        geom,
                    )
                )

        # 3. OBSTACLES
        obstacles = data.get("obstacles", [])
        for obs in obstacles:
            geom = cls.create_point(obs.get("coordinates", {}))
            if geom:
                elev = cls.extract_number(obs.get("elevation"))
                marking = obs.get("marking_lgt", "NIL")
                obs_type = str(obs.get("obstacle_type") or "Unknown")
                remarks = str(obs.get("remarks") or "")

                is_grouped = False
                if "GROUP" in obs_type.upper() or "GROUP" in remarks.upper():
                    is_grouped = True
                # Calculate Height relative to Aerodrome elevation
                height_m = None
                if elev is not None and arp_elev is not None:
                    height_m = round(elev - arp_elev, 1)

                features.append(
                    # pyrefly: ignore [bad-argument-type]
                    (
                        icao,
                        "OBSTACLE",
                        obs_type,
                        elev,
                        marking,
                        is_grouped,
                        height_m,
                        geom,
                    )
                )

        # 4. NAV AIDS
        navaids = data.get("radio_navigation_and_landing_aids", [])
        for nav in navaids:
            geom = cls.create_point(nav.get("coordinates", {}))
            if geom:
                name = f"{nav.get('identification', '')} {nav.get('type_of_aid', '')}".strip()
                elev = cls.extract_number(nav.get("elevation"))
                features.append((icao, "NAVAID", name, elev, "NIL", False, 0, geom))

        # 5. HELIPADS (TLOF/FATO)
        helipad_coords = data.get("helicopter_landing_area", {}).get("coordinates_tlof_fato", {})
        heli_geom = cls.create_point(helipad_coords)
        if heli_geom:
            elev = cls.extract_number(
                data.get("helicopter_landing_area", {}).get("elevation_tlof_fato")
            )
            features.append((icao, "HELIPAD", f"{icao} Helipad", elev, "NIL", False, 0, heli_geom))

        return features

    @classmethod
    def route_charts(cls, icao, enriched_doc):
        """Extracts chart metadata for the MinIO Bridge table."""
        charts_list = []
        charts = enriched_doc.get("charts", [])

        for idx, chart in enumerate(charts):
            title = chart.get("chart_name", f"Chart {idx}")
            # We preserve the original URL for now, later we will update this to the MinIO s3:// path
            url = chart.get("pdf_url", "")
            charts_list.append((icao, title, "AD 2.24", url))

        return charts_list


class DBLoader:
    def __init__(self, bucket_name="ais"):
        self.s3 = boto3.client(
            "s3",
            endpoint_url="http://localhost:9000",
            aws_access_key_id=os.environ.get("MINIO_ACCESS_KEY"),
            aws_secret_access_key=os.environ.get("MINIO_SECRET_KEY"),
            region_name="us-east-1",
        )
        self.bucket_name = bucket_name

        # Connecting to the newly named database!
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
        self.conn.autocommit = False  # We manage transactions manually now for safety

    def close(self):
        if self.conn:
            self.conn.close()
            self.conn = None  # pyrefly: ignore [bad-assignment]

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is not None and self.conn and not self.conn.autocommit:
            self.conn.rollback()
        self.close()

    def enrich_payload(self, data):
        """Recursively hunts for coordinate fields and upgrades them."""
        if isinstance(data, dict):
            for k, v in list(data.items()):
                coord_keys = [
                    "coordinates",
                    "coordinates_tlof_fato",
                    "arp_coordinates_site",
                ]
                if k in coord_keys and isinstance(v, str):
                    data[k] = CoordinateConverter.parse_dms(v)
                else:
                    self.enrich_payload(v)
        elif isinstance(data, list):
            for item in data:
                self.enrich_payload(item)
        return data

    def load_from_minio(self, filename):
        print(f"[*] Fetching '{filename}' from MinIO bucket '{self.bucket_name}'...")
        try:
            response = self.s3.get_object(Bucket=self.bucket_name, Key=filename)
            master_data = json.loads(response["Body"].read().decode("utf-8"))
        except Exception as e:
            print(f"[!] Failed to fetch or parse file from MinIO: {e}")
            return

        print(f"[*] Found {len(master_data)} airports. Commencing segregated DB ingestion...")

        # Hard Reset: Truncate existing data to ensure a fresh reload
        print("[!] Dropping all existing records for a complete refresh...")
        with self.conn.cursor() as cur:
            cur.execute(
                "TRUNCATE TABLE aerodrome_documents, spatial_features, aerodrome_charts RESTART IDENTITY CASCADE;"
            )
            self.conn.commit()

        success_count = 0
        total_features = 0

        with self.conn.cursor() as cur:
            for airport in master_data:
                icao = airport.get("icao")
                name = airport.get("name")
                url = airport.get("source_url")

                try:
                    # 1. Transform: Enrich coordinates
                    enriched_doc = self.enrich_payload(airport)

                    # 2. Extract: Segregate the data
                    spatial_records = SpatialRouter.route_features(icao, enriched_doc)
                    chart_records = SpatialRouter.route_charts(icao, enriched_doc)

                    # 3. Load: The Transaction Block
                    # A. Upsert the Anchor Document
                    cur.execute(
                        """
                        INSERT INTO aerodrome_documents (icao_code, airport_name, source_url, aip_document)
                        VALUES (%s, %s, %s, %s)
                        ON CONFLICT (icao_code)
                        DO UPDATE SET
                            airport_name = EXCLUDED.airport_name,
                            source_url = EXCLUDED.source_url,
                            aip_document = EXCLUDED.aip_document,
                            last_updated = CURRENT_TIMESTAMP;
                    """,
                        (icao, name, url, Json(enriched_doc)),
                    )

                    # B. Clear old child records (Idempotency)
                    cur.execute("DELETE FROM spatial_features WHERE icao_code = %s", (icao,))
                    cur.execute("DELETE FROM aerodrome_charts WHERE icao_code = %s", (icao,))

                    # C. Bulk Insert Spatial Features
                    if spatial_records:
                        from eaip_scrapper.validation.schemas.database.aerodrome import (
                            DatabaseValidator,
                        )

                        print(
                            f"  -> DB-Schema Validating {len(spatial_records)} spatial records..."
                        )
                        DatabaseValidator.validate_spatial_features(spatial_records)
                        execute_values(
                            cur,
                            """
                            INSERT INTO spatial_features (icao_code, feature_category, feature_name, elevation_m, marking_lgt, is_grouped, height_m, geom)
                            VALUES %s
                        """,
                            spatial_records,
                            template="(%s, %s, %s, %s, %s, %s, %s, ST_GeomFromEWKT(%s))",
                        )
                        total_features += len(spatial_records)

                    # D. Bulk Insert Chart References
                    if chart_records:
                        from eaip_scrapper.validation.schemas.database.aerodrome import (
                            DatabaseValidator,
                        )

                        print(f"  -> DB-Schema Validating {len(chart_records)} chart records...")
                        DatabaseValidator.validate_chart_features(chart_records)
                        execute_values(
                            cur,
                            """
                            INSERT INTO aerodrome_charts (icao_code, chart_title, chart_index, chart_url)
                            VALUES %s
                        """,
                            chart_records,
                        )

                    # Commit the transaction for this airport
                    self.conn.commit()
                    print(f"  [✓] {icao} - Segregated {len(spatial_records)} spatial features.")
                    success_count += 1

                except Exception as e:
                    self.conn.rollback()  # Abort changes if anything fails
                    print(f"  [✗] Failed to process {icao}: {e}")

        print(
            f"\n[+] Ingestion Complete! Loaded {success_count} airports and {total_features} total spatial points into PostGIS."
        )


if __name__ == "__main__":
    loader = DBLoader(bucket_name="ais")
    loader.load_from_minio(filename="output/master_aip_data.json")
