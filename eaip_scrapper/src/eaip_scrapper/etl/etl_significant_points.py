import json
import os
import re

import boto3
import psycopg2
from psycopg2.extras import execute_values


class WaypointLoader:
    """Loads ENR 4.4 Significant Points from MinIO into the PostGIS database."""

    def __init__(self, bucket_name="ais"):
        from dotenv import load_dotenv

        load_dotenv()

        self.s3 = boto3.client(
            "s3",
            endpoint_url=os.getenv("MINIO_ENDPOINT", "http://localhost:9000"),
            aws_access_key_id=os.environ.get("MINIO_ACCESS_KEY"),
            aws_secret_access_key=os.environ.get("MINIO_SECRET_KEY"),
            region_name="us-east-1",
        )
        self.bucket_name = bucket_name

        db_host = os.getenv("DB_HOST")
        db_port = os.getenv("DB_PORT")
        db_name = os.getenv("DB_NAME")
        db_user = os.getenv("DB_USER")
        db_password = os.getenv("DB_PASSWORD")

        if not all([db_host, db_port, db_name, db_user, db_password]):
            raise ValueError("Missing required DB credentials in environment variables")

        self.conn = psycopg2.connect(
            dbname=db_name,
            user=db_user,
            password=db_password,
            host=db_host,
            port=db_port,
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

            # Ensure database extension and tables exist
            cur.execute("CREATE EXTENSION IF NOT EXISTS postgis;")
            cur.execute("""
                CREATE TABLE IF NOT EXISTS significant_points (
                    id SERIAL PRIMARY KEY,
                    waypoint_name VARCHAR(10) NOT NULL UNIQUE,
                    routes TEXT[],
                    raw_coordinates VARCHAR(30),
                    geom GEOMETRY(GEOMETRY, 4326),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS ix_significant_points_id ON significant_points (id);
                CREATE INDEX IF NOT EXISTS idx_significant_points_geom ON significant_points USING GIST (geom);
            """)

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
