import json
import os
import re

import boto3
import psycopg2
from psycopg2.extras import execute_values


class RouteLoader:
    """Loads ENR 3.1 Conventional Routes and ENR 3.2 RNAV Routes from MinIO into PostGIS."""

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
        """Converts DMS strings like '232703N' or '0932748E' to decimal degrees."""
        if not coord_str:
            return None

        match = re.match(r"([\d.]+)([NSEW])", coord_str.strip())
        if not match:
            return None

        numbers, hemisphere = match.groups()
        is_lat = hemisphere in ["N", "S"]
        deg_len = 2 if is_lat else 3

        try:
            degrees = float(numbers[:deg_len])
            minutes = float(numbers[deg_len : deg_len + 2])
            seconds = float(numbers[deg_len + 2 :]) if len(numbers) > deg_len + 2 else 0.0

            decimal = degrees + (minutes / 60) + (seconds / 3600)
            if hemisphere in ["S", "W"]:
                decimal *= -1
            return round(decimal, 6)
        except (ValueError, IndexError):
            return None

    @classmethod
    def parse_coordinates(cls, coord_text):
        """
        Extracts lat/lng from coordinate strings which may contain navaid info.
        E.g. 'DVOR/DME (AAT)\n235325N   0911419E' or '232703N   0932748E'
        Returns (lat, lng, raw_coords, navaid_info)
        """
        if not coord_text:
            return None, None, None, None

        # Extract navaid info if present (e.g. "DVOR/DME (AAT)")
        navaid_info = None
        navaid_match = re.search(
            r"((?:DVOR|VOR|NDB|DME|TACAN)[^\n]*\([A-Z]{2,4}\))",
            coord_text,
            re.IGNORECASE,
        )
        if navaid_match:
            navaid_info = navaid_match.group(1).strip()

        # Extract coordinate pair
        lat_matches = re.findall(r"(\d{5,}(?:\.\d+)?[NS])", coord_text)
        lng_matches = re.findall(r"(\d{6,}(?:\.\d+)?[EW])", coord_text)

        if lat_matches and lng_matches:
            lat_str = lat_matches[-1]  # Take last match (skip duplicates in messy data)
            lng_str = lng_matches[-1]

            lat = cls.dms_to_decimal(lat_str)
            lng = cls.dms_to_decimal(lng_str)

            raw_coords = f"{lat_str} {lng_str}"
            return lat, lng, raw_coords, navaid_info

        return None, None, None, navaid_info

    @staticmethod
    def parse_segment(entry):
        """
        Parses a segment entry and returns a tuple of parsed fields:
        (track_magnetic, distance_nm, upper_limit, lower_limit, airspace_class, moca, lateral_limits, dir_odd, dir_even)
        """
        # Parse track/distance: "282/102\n47.1 NM"
        td_raw = entry.get("track_distance", "")
        track_magnetic = None
        distance_nm = None

        td_lines = td_raw.split("\n")
        if td_lines:
            track_magnetic = td_lines[0].strip()
        if len(td_lines) > 1:
            dist_match = re.search(r"([\d.]+)\s*NM", td_lines[1])
            if dist_match:
                distance_nm = float(dist_match.group(1))

        # Parse limits/class: "FL 460\nFL 270\nClass E\n10100 FT"
        lc_raw = entry.get("limits_class", "")
        lc_lines = [line.strip() for line in lc_raw.split("\n") if line.strip()]

        upper_limit = lc_lines[0] if len(lc_lines) > 0 else None
        lower_limit = lc_lines[1] if len(lc_lines) > 1 else None
        airspace_class = None
        moca = None

        for line in lc_lines[2:]:
            if line.startswith("Class"):
                # Handle "Class E", "ClassE", or just "Class"
                extracted_class = line.replace("Class", "").strip()
                airspace_class = extracted_class if extracted_class else None
            elif re.search(r"\d+\s*(?:FT|M\b)", line, re.IGNORECASE):
                moca = line.strip()

        lateral_limits = entry.get("lateral_limits", "").strip() or None
        dir_odd = entry.get("direction_odd", "").strip() or None
        dir_even = entry.get("direction_even", "").strip() or None

        return (
            track_magnetic,
            distance_nm,
            upper_limit,
            lower_limit,
            airspace_class,
            moca,
            lateral_limits,
            dir_odd,
            dir_even,
        )

    def process_routes(self, data, route_type):
        """
        Processes the JSON data for one file and returns:
        (route_records, waypoint_records, segment_records)
        """
        route_records = []
        waypoint_records = []
        segment_records = []

        for route in data.get("routes", []):
            route_id = route.get("route_id", "").strip()
            if not route_id:
                continue

            route_designator = route.get("route_designator", "")
            remarks = route.get("remarks", "").strip()

            route_records.append((route_id, route_designator, route_type, remarks))

            # Separate waypoints and segments from the interleaved list
            wpt_seq = 0
            seg_seq = 0

            for entry in route.get("waypoints", []):
                if "waypoint_name" in entry:
                    # It's a waypoint
                    wpt_seq += 1
                    lat, lng, raw_coords, navaid_info = self.parse_coordinates(
                        entry.get("coordinates", "")
                    )

                    geom_ewkt = None
                    if lat and lng:
                        geom_ewkt = f"SRID=4326;POINT({lng} {lat})"

                    waypoint_records.append(
                        (
                            route_id,
                            wpt_seq,
                            entry["waypoint_name"],
                            raw_coords,
                            navaid_info,
                            geom_ewkt,
                        )
                    )

                elif "track_distance" in entry:
                    # It's a segment
                    seg_seq += 1
                    parsed = self.parse_segment(entry)
                    segment_records.append((route_id, seg_seq, *parsed))

        return route_records, waypoint_records, segment_records

    def load_from_minio(self, files):
        """
        Fetches route JSON files from MinIO and loads all into PostGIS.
        files: list of (filename, route_type) tuples
        """
        all_routes = []
        all_waypoints = []
        all_segments = []

        for filename, route_type in files:
            print(f"[*] Fetching '{filename}' from MinIO bucket '{self.bucket_name}'...")
            try:
                response = self.s3.get_object(Bucket=self.bucket_name, Key=filename)
                data = json.loads(response["Body"].read().decode("utf-8"))
            except Exception as e:
                print(f"[!] Failed to fetch {filename}: {e}")
                continue

            routes, waypoints, segments = self.process_routes(data, route_type)
            all_routes.extend(routes)
            all_waypoints.extend(waypoints)
            all_segments.extend(segments)
            print(
                f"    Parsed {len(routes)} {route_type} routes, {len(waypoints)} waypoints, {len(segments)} segments."
            )

        print(
            f"\n[*] Total: {len(all_routes)} routes, {len(all_waypoints)} waypoints, {len(all_segments)} segments."
        )

        from eaip_scrapper.validation.schemas.database.ats_routes import ATSRouteDatabaseValidator

        print("[*] Validating records...")
        try:
            ATSRouteDatabaseValidator.validate_all(all_routes, all_waypoints, all_segments)
            print("[+] Validation passed successfully.")
        except Exception as e:
            print(f"[!] Validation failed: {e}")
            raise e

        print("[*] Pushing to database...")

        with self.conn.cursor() as cur:
            # Ensure database extension and tables exist
            cur.execute("CREATE EXTENSION IF NOT EXISTS postgis;")
            cur.execute("""
                CREATE TABLE IF NOT EXISTS ats_routes (
                    id SERIAL PRIMARY KEY,
                    route_id VARCHAR(20) NOT NULL,
                    route_designator VARCHAR(100),
                    route_type VARCHAR(20) NOT NULL,
                    remarks TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS ix_ats_routes_id ON ats_routes (id);
                CREATE INDEX IF NOT EXISTS ix_ats_routes_route_id ON ats_routes (route_id);
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS ats_route_segments (
                    id SERIAL PRIMARY KEY,
                    route_id VARCHAR(20) NOT NULL,
                    sequence_number INTEGER NOT NULL,
                    track_magnetic VARCHAR(20),
                    distance_nm NUMERIC,
                    upper_limit VARCHAR(20),
                    lower_limit VARCHAR(20),
                    airspace_class VARCHAR(10),
                    moca VARCHAR(20),
                    lateral_limits VARCHAR(20),
                    direction_odd VARCHAR(5),
                    direction_even VARCHAR(5),
                    geom GEOMETRY(GEOMETRY, 4326)
                );
                CREATE INDEX IF NOT EXISTS ix_ats_route_segments_id ON ats_route_segments (id);
                CREATE INDEX IF NOT EXISTS ix_ats_route_segments_route_id ON ats_route_segments (route_id);
                CREATE INDEX IF NOT EXISTS idx_ats_route_segments_geom ON ats_route_segments USING GIST (geom);
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS ats_route_waypoints (
                    id SERIAL PRIMARY KEY,
                    route_id VARCHAR(20) NOT NULL,
                    sequence_number INTEGER NOT NULL,
                    waypoint_name VARCHAR(50),
                    raw_coordinates VARCHAR(60),
                    navaid_info VARCHAR(50),
                    geom GEOMETRY(GEOMETRY, 4326)
                );
                CREATE INDEX IF NOT EXISTS ix_ats_route_waypoints_id ON ats_route_waypoints (id);
                CREATE INDEX IF NOT EXISTS ix_ats_route_waypoints_route_id ON ats_route_waypoints (route_id);
                CREATE INDEX IF NOT EXISTS idx_ats_route_waypoints_geom ON ats_route_waypoints USING GIST (geom);
            """)

            # Clean slate for idempotent reload (explicitly truncate children since there are no hard foreign keys)
            cur.execute(
                "TRUNCATE TABLE ats_routes, ats_route_segments, ats_route_waypoints RESTART IDENTITY CASCADE;"
            )
            print("[!] Cleared existing route records for a clean reload.")

            # 1. Insert routes
            if all_routes:
                execute_values(
                    cur,
                    """
                    INSERT INTO ats_routes (route_id, route_designator, route_type, remarks)
                    VALUES %s
                """,
                    all_routes,
                )

            # 2. Insert waypoints
            if all_waypoints:
                # Split into those with geometry and those without
                wpts_with_geom = [w for w in all_waypoints if w[5] is not None]
                wpts_no_geom = [w[:5] for w in all_waypoints if w[5] is None]

                if wpts_with_geom:
                    execute_values(
                        cur,
                        """
                        INSERT INTO ats_route_waypoints (route_id, sequence_number, waypoint_name, raw_coordinates, navaid_info, geom)
                        VALUES %s
                    """,
                        wpts_with_geom,
                        template="(%s, %s, %s, %s, %s, ST_GeomFromEWKT(%s))",
                    )

                if wpts_no_geom:
                    execute_values(
                        cur,
                        """
                        INSERT INTO ats_route_waypoints (route_id, sequence_number, waypoint_name, raw_coordinates, navaid_info)
                        VALUES %s
                    """,
                        wpts_no_geom,
                    )

            # 3. Insert segments
            if all_segments:
                execute_values(
                    cur,
                    """
                    INSERT INTO ats_route_segments
                        (route_id, sequence_number, track_magnetic, distance_nm, upper_limit, lower_limit,
                         airspace_class, moca, lateral_limits, direction_odd, direction_even)
                    VALUES %s
                """,
                    all_segments,
                )

            # 4. Synthesize Segment Geometry
            print("[*] Synthesizing LineStrings for segment geometries from waypoints...")
            cur.execute("""
                UPDATE ats_route_segments s
                SET geom = ST_MakeLine(w1.geom, w2.geom)
                FROM ats_route_waypoints w1
                JOIN ats_route_waypoints w2
                  ON w1.route_id = w2.route_id
                  AND w2.sequence_number = w1.sequence_number + 1
                WHERE s.route_id = w1.route_id
                  AND s.sequence_number = w1.sequence_number
                  AND w1.geom IS NOT NULL
                  AND w2.geom IS NOT NULL;
            """)

            # 5. Recreate View (Ensures MOCA terminology is reflected)
            print("[*] Recreating v_ats_route_segments view...")
            cur.execute("""
                CREATE OR REPLACE VIEW v_ats_route_segments AS
                SELECT
                    s.id,
                    s.route_id,
                    r.route_designator,
                    r.route_type,
                    r.remarks,
                    s.sequence_number,
                    s.track_magnetic,
                    s.distance_nm,
                    s.upper_limit,
                    s.lower_limit,
                    s.airspace_class,
                    s.moca,
                    s.lateral_limits,
                    s.direction_odd,
                    s.direction_even,
                    s.geom
                FROM ats_route_segments s
                JOIN ats_routes r ON s.route_id = r.route_id
                WHERE s.geom IS NOT NULL;
            """)

            # 6. Ensure Materialized Views exist
            print("[*] Recreating mv_ats_route_labels materialized view...")
            cur.execute("""
                CREATE MATERIALIZED VIEW IF NOT EXISTS mv_ats_route_labels AS
                SELECT
                    s.id,
                    s.route_id,
                    r.route_type,
                    ST_LineInterpolatePoint(s.geom, 0.5) AS midpoint_geom,
                    COALESCE(
                        NULLIF(REGEXP_REPLACE(split_part(s.track_magnetic, '/', 1), '[^0-9.]', '', 'g'), '')::numeric,
                        degrees(ST_Azimuth(ST_StartPoint(s.geom), ST_EndPoint(s.geom)))::numeric,
                        0
                    ) AS bearing
                FROM ats_route_segments s
                JOIN ats_routes r ON s.route_id = r.route_id
                WHERE s.geom IS NOT NULL;
            """)
            print("[*] Refreshing mv_ats_route_labels materialized view...")
            cur.execute("""
                REFRESH MATERIALIZED VIEW mv_ats_route_labels;
            """)

            print("[*] Recreating ats_waypoints_grouped materialized view...")
            cur.execute("""
                CREATE MATERIALIZED VIEW IF NOT EXISTS ats_waypoints_grouped AS
                SELECT
                    MIN(id)::integer as id,
                    waypoint_name,
                    array_agg(DISTINCT route_id)::text[] AS route_ids,
                    ST_Centroid(ST_Collect(geom)) AS geom
                FROM ats_route_waypoints
                WHERE geom IS NOT NULL
                GROUP BY waypoint_name;
            """)
            print("[*] Refreshing ats_waypoints_grouped materialized view...")
            cur.execute("""
                REFRESH MATERIALIZED VIEW ats_waypoints_grouped;
            """)

            # 7. Ensure Spatial Indexes exist
            print("[*] Ensuring spatial indexes exist for high-performance tile serving...")
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_ats_route_segments_geom
                ON public.ats_route_segments USING gist (geom);

                CREATE INDEX IF NOT EXISTS idx_mv_ats_route_labels_geom
                ON public.mv_ats_route_labels USING gist (midpoint_geom);

                CREATE UNIQUE INDEX IF NOT EXISTS idx_ats_waypoints_grouped_name
                ON public.ats_waypoints_grouped (waypoint_name);

                CREATE INDEX IF NOT EXISTS idx_ats_waypoints_grouped_geom
                ON public.ats_waypoints_grouped USING gist (geom);
            """)

            self.conn.commit()

        print(f"[+] Successfully loaded {len(all_routes)} routes into the database!")

    def close(self):
        """Closes the database connection."""
        if self.conn:
            self.conn.close()


if __name__ == "__main__":
    loader = RouteLoader(bucket_name="ais")
    try:
        loader.load_from_minio(
            [
                ("output/enr_3_1_conventional_routes.json", "CONVENTIONAL"),
                ("output/enr_3_2_rnav_routes.json", "RNAV"),
            ]
        )
    finally:
        loader.close()
