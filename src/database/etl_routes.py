import json
import re
import boto3
import psycopg2
from psycopg2.extras import execute_values


class RouteLoader:
    """Loads ENR 3.1 Conventional Routes and ENR 3.2 RNAV Routes from MinIO into PostGIS."""

    def __init__(self, bucket_name="ais"):
        self.s3 = boto3.client('s3',
            endpoint_url='http://localhost:9000',
            aws_access_key_id='ais_admin',
            aws_secret_access_key='AviationData2026!',
            region_name='us-east-1'
        )
        self.bucket_name = bucket_name

        self.conn = psycopg2.connect(
            dbname="aeronautical_information_system", user="postgres", password="postgres",
            host="localhost", port="5432"
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
        is_lat = hemisphere in ['N', 'S']
        deg_len = 2 if is_lat else 3

        try:
            degrees = float(numbers[:deg_len])
            minutes = float(numbers[deg_len:deg_len + 2])
            seconds = float(numbers[deg_len + 2:]) if len(numbers) > deg_len + 2 else 0.0

            decimal = degrees + (minutes / 60) + (seconds / 3600)
            if hemisphere in ['S', 'W']:
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
        navaid_match = re.search(r"((?:DVOR|VOR|NDB|DME|TACAN)[^\n]*\([A-Z]{2,4}\))", coord_text, re.IGNORECASE)
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
        (track_magnetic, distance_nm, upper_limit, lower_limit, airspace_class, mea, lateral_limits, dir_odd, dir_even)
        """
        # Parse track/distance: "282/102\n47.1 NM"
        td_raw = entry.get('track_distance', '')
        track_magnetic = None
        distance_nm = None

        td_lines = td_raw.split('\n')
        if td_lines:
            track_magnetic = td_lines[0].strip()
        if len(td_lines) > 1:
            dist_match = re.search(r"([\d.]+)\s*NM", td_lines[1])
            if dist_match:
                distance_nm = float(dist_match.group(1))

        # Parse limits/class: "FL 460\nFL 270\nClass E\n10100 FT"
        lc_raw = entry.get('limits_class', '')
        lc_lines = [l.strip() for l in lc_raw.split('\n') if l.strip()]

        upper_limit = lc_lines[0] if len(lc_lines) > 0 else None
        lower_limit = lc_lines[1] if len(lc_lines) > 1 else None
        airspace_class = None
        mea = None

        for line in lc_lines[2:]:
            if line.startswith('Class'):
                airspace_class = line.replace('Class ', '').strip()
            elif 'FT' in line or 'M' in line:
                mea = line.strip()

        lateral_limits = entry.get('lateral_limits', '').strip() or None
        dir_odd = entry.get('direction_odd', '').strip() or None
        dir_even = entry.get('direction_even', '').strip() or None

        return (track_magnetic, distance_nm, upper_limit, lower_limit,
                airspace_class, mea, lateral_limits, dir_odd, dir_even)

    def process_routes(self, data, route_type):
        """
        Processes the JSON data for one file and returns:
        (route_records, waypoint_records, segment_records)
        """
        route_records = []
        waypoint_records = []
        segment_records = []

        for route in data.get('routes', []):
            route_id = route.get('route_id', '').strip()
            if not route_id:
                continue

            route_designator = route.get('route_designator', '')
            remarks = route.get('remarks', '').strip()

            route_records.append((route_id, route_designator, route_type, remarks))

            # Separate waypoints and segments from the interleaved list
            wpt_seq = 0
            seg_seq = 0

            for entry in route.get('waypoints', []):
                if 'waypoint_name' in entry:
                    # It's a waypoint
                    wpt_seq += 1
                    lat, lng, raw_coords, navaid_info = self.parse_coordinates(entry.get('coordinates', ''))

                    geom_ewkt = None
                    if lat and lng:
                        geom_ewkt = f"SRID=4326;POINT({lng} {lat})"

                    waypoint_records.append((
                        route_id, wpt_seq, entry['waypoint_name'],
                        raw_coords, navaid_info, geom_ewkt
                    ))

                elif 'track_distance' in entry:
                    # It's a segment
                    seg_seq += 1
                    parsed = self.parse_segment(entry)
                    segment_records.append((route_id, seg_seq) + parsed)

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
                data = json.loads(response['Body'].read().decode('utf-8'))
            except Exception as e:
                print(f"[!] Failed to fetch {filename}: {e}")
                continue

            routes, waypoints, segments = self.process_routes(data, route_type)
            all_routes.extend(routes)
            all_waypoints.extend(waypoints)
            all_segments.extend(segments)
            print(f"    Parsed {len(routes)} {route_type} routes, {len(waypoints)} waypoints, {len(segments)} segments.")

        print(f"\n[*] Total: {len(all_routes)} routes, {len(all_waypoints)} waypoints, {len(all_segments)} segments.")
        print("[*] Pushing to database...")

        with self.conn.cursor() as cur:
            # Clean slate for idempotent reload (cascade deletes children)
            cur.execute("TRUNCATE TABLE ats_routes RESTART IDENTITY CASCADE;")
            print("[!] Cleared existing route records for a clean reload.")

            # 1. Insert routes
            if all_routes:
                execute_values(cur, """
                    INSERT INTO ats_routes (route_id, route_designator, route_type, remarks)
                    VALUES %s
                """, all_routes)

            # 2. Insert waypoints
            if all_waypoints:
                # Split into those with geometry and those without
                wpts_with_geom = [w for w in all_waypoints if w[5] is not None]
                wpts_no_geom = [w[:5] for w in all_waypoints if w[5] is None]

                if wpts_with_geom:
                    execute_values(cur, """
                        INSERT INTO ats_route_waypoints (route_id, sequence_number, waypoint_name, raw_coordinates, navaid_info, geom)
                        VALUES %s
                    """, wpts_with_geom, template="(%s, %s, %s, %s, %s, ST_GeomFromEWKT(%s))")

                if wpts_no_geom:
                    execute_values(cur, """
                        INSERT INTO ats_route_waypoints (route_id, sequence_number, waypoint_name, raw_coordinates, navaid_info)
                        VALUES %s
                    """, wpts_no_geom)

            # 3. Insert segments
            if all_segments:
                execute_values(cur, """
                    INSERT INTO ats_route_segments 
                        (route_id, sequence_number, track_magnetic, distance_nm, upper_limit, lower_limit,
                         airspace_class, mea, lateral_limits, direction_odd, direction_even)
                    VALUES %s
                """, all_segments)

            self.conn.commit()

        print(f"[+] Successfully loaded {len(all_routes)} routes into the database!")

    def close(self):
        """Closes the database connection."""
        if self.conn:
            self.conn.close()


if __name__ == "__main__":
    loader = RouteLoader(bucket_name="ais")
    try:
        loader.load_from_minio([
            ("output/enr_3_1_conventional_routes.json", "CONVENTIONAL"),
            ("output/enr_3_2_rnav_routes.json", "RNAV"),
        ])
    finally:
        loader.close()
