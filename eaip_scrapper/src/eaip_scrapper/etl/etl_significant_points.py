import json
import re

import boto3
import psycopg2
from psycopg2.extras import execute_values


class WaypointLoader:
    """Loads ENR 4.4 Significant Points from MinIO into the PostGIS database."""

    def __init__(self, bucket_name="ais"):
        self.s3 = boto3.client(
            "s3",
            endpoint_url="http://localhost:9000",
            aws_access_key_id=os.environ.get("MINIO_ACCESS_KEY"),
            aws_secret_access_key=os.environ.get("MINIO_SECRET_KEY"),
            region_name="us-east-1",
        )
        self.bucket_name = bucket_name

        self.conn = psycopg2.connect(
            dbname="aeronautical_information_system",
            user="postgres",
            password="postgres",
            host="localhost",
            port="5432",
        )
        self.conn.autocommit = False

    @staticmethod
    def dms_to_decimal(coord_str):
        """Converts strings like '273854N' or '0715353E' to decimal degrees."""
        if not coord_str:
            return None
        direction = coord_str[-1]
        numbers = coord_str[:-1]

        is_lat = direction in ["N", "S"]
        deg_len = 2 if is_lat else 3

        try:
            degrees = float(numbers[:deg_len])
            minutes = float(numbers[deg_len : deg_len + 2])
            seconds = float(numbers[deg_len + 2 :]) if len(numbers) > deg_len + 2 else 0.0

            decimal = degrees + (minutes / 60) + (seconds / 3600)
            if direction in ["S", "W"]:
                decimal *= -1
            return round(decimal, 6)
        except ValueError:
            return None

    @classmethod
    def parse_waypoints(cls, data):
        """
        Parses the JSON payload and returns a list of tuples matching the significant_points schema:
        (waypoint_name, routes, raw_coordinates, geom_ewkt)
        """
        records = []
        for item in data.get("significant_points", []):
            name = item.get("waypoint")
            coords_str = item.get("coordinates", "")
            routes = item.get("routes", [])

            match = re.match(r"(\d+[NS])\s+(\d+[EW])", coords_str)
            if match:
                lat_str, lng_str = match.groups()
                lat = cls.dms_to_decimal(lat_str)
                lng = cls.dms_to_decimal(lng_str)

                if lat and lng:
                    geom_ewkt = f"SRID=4326;POINT({lng} {lat})"
                    records.append((name, routes, coords_str, geom_ewkt))

        return records

    def load_from_minio(self, filename="enr_4_4_significant_points.json"):
        """Fetches the significant points JSON from MinIO and loads into PostGIS."""
        print(f"[*] Fetching '{filename}' from MinIO bucket '{self.bucket_name}'...")
        try:
            response = self.s3.get_object(Bucket=self.bucket_name, Key=filename)
            data = json.loads(response["Body"].read().decode("utf-8"))
        except Exception as e:
            print(f"[!] Failed to fetch or parse file from MinIO: {e}")
            return

        records = self.parse_waypoints(data)
        print(f"[*] Parsed {len(records)} waypoints. Pushing to database...")

        with self.conn.cursor() as cur:
            from eaip_scrapper.validation.schemas.database.significant_points import (
                SignificantPointsDatabaseValidator,
            )

            print("[*] Validating records...")
            try:
                SignificantPointsDatabaseValidator.validate_all(records)
                print("[+] Validation passed successfully.")
            except Exception as e:
                print(f"[!] Validation failed: {e}")
                raise e

            # Truncate for a clean idempotent reload
            cur.execute("TRUNCATE TABLE significant_points RESTART IDENTITY;")
            print("[!] Cleared existing records for a clean reload.")

            # Bulk insert all waypoints with upsert
            if records:
                execute_values(
                    cur,
                    """
                    INSERT INTO significant_points (waypoint_name, routes, raw_coordinates, geom)
                    VALUES %s
                    ON CONFLICT (waypoint_name)
                    DO UPDATE SET
                        routes = EXCLUDED.routes,
                        raw_coordinates = EXCLUDED.raw_coordinates,
                        geom = EXCLUDED.geom
                """,
                    records,
                    template="(%s, %s::text[], %s, ST_GeomFromEWKT(%s))",
                )

            self.conn.commit()

        print(f"[+] Successfully loaded {len(records)} waypoints into significant_points!")

    def close(self):
        """Closes the database connection."""
        if self.conn:
            self.conn.close()


if __name__ == "__main__":
    loader = WaypointLoader(bucket_name="ais")
    try:
        loader.load_from_minio(filename="output/enr_4_4_significant_points.json")
    finally:
        loader.close()
