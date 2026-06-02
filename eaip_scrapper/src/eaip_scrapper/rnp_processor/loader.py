import logging

import psycopg2
from psycopg2.extras import execute_values

from .utils import is_valid_coord, parse_altitude

logger = logging.getLogger("RNP-eaip_scrapper.etl.Loader")

SCHEMA_SQL = """
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS rnp_procedures (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE,
    airport_id VARCHAR(10),
    runway VARCHAR(10),
    type VARCHAR(50),
    geom_3d GEOMETRY(LineStringZ, 4326),
    validation_status VARCHAR(20),
    validation_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rnp_waypoints (
    procedure_id INT REFERENCES rnp_procedures(id) ON DELETE CASCADE,
    ident VARCHAR(10),
    geom GEOMETRY(Point, 4326),
    coordinates_raw TEXT,
    role VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (procedure_id, ident)
);

CREATE TABLE IF NOT EXISTS rnp_legs (
    id SERIAL PRIMARY KEY,
    procedure_id INT REFERENCES rnp_procedures(id) ON DELETE CASCADE,
    sequence_nr INT,
    source_serial VARCHAR(10),
    path_descriptor VARCHAR(5),
    waypoint_ident VARCHAR(10),
    altitude_numeric NUMERIC,
    altitude_constraint TEXT,
    speed_limit TEXT,
    course TEXT,
    distance TEXT,
    turn_direction VARCHAR(10),
    vpa_tch VARCHAR(20),
    nav_spec VARCHAR(50),
    role TEXT,
    fly_over BOOLEAN
);

CREATE INDEX IF NOT EXISTS idx_rnp_proc_geom ON rnp_procedures USING GIST (geom_3d);
CREATE INDEX IF NOT EXISTS idx_rnp_waypoints_geom ON rnp_waypoints USING GIST (geom);

ALTER TABLE rnp_waypoints ADD COLUMN IF NOT EXISTS role VARCHAR(50);
"""


class RNPLoader:
    def __init__(self, db_config):
        self.db_config = db_config

    def init_schema(self):
        try:
            with psycopg2.connect(**self.db_config) as conn, conn.cursor() as cur:
                cur.execute(SCHEMA_SQL)
                conn.commit()
            logger.info("Database schema initialized successfully.")
        except Exception as e:
            logger.error(f"Failed to initialize schema: {e}")
            raise

    def load_procedure(self, proc_data, validation_status="SUCCESS", validation_notes=None):
        """Loads a single procedure and its 3D geometry.

        Args:
            proc_data: Parsed procedure dict from transformer.
            validation_status: Status from validator ("SUCCESS", "WARNING", "FAILED").
            validation_notes: Stringified issues list from validator.
        """
        try:
            # 1. Build 3D Geometry — deduplicate consecutive identical points
            p_name = proc_data.get("procedure_name")
            if not p_name:
                logger.error("Missing procedure_name in proc_data")
                return False

            points_3d = []
            last_alt = 10000  # Default initial altitude (feet)
            prev_point = None

            for leg in proc_data.get("tabular_description", []):
                ident = leg.get("waypoint_identifier")
                if not ident:
                    continue
                wp = next(
                    (
                        w
                        for w in proc_data.get("waypoints", [])
                        if w.get("waypoint_id") == ident.upper()
                    ),
                    None,
                )
                if not wp:
                    continue
                lat = wp.get("lat_dd")
                lon = wp.get("lon_dd")
                if not is_valid_coord(lat, lon):
                    continue

                alt_raw = leg.get("altitude") or leg.get("altitude_lower")
                alt = parse_altitude(alt_raw)
                if alt is None:
                    alt = last_alt
                else:
                    last_alt = alt

                point_key = (round(lon, 6), round(lat, 6), round(alt, 1))
                if point_key == prev_point:
                    # Skip duplicate consecutive vertex
                    continue
                prev_point = point_key
                points_3d.append(f"{lon} {lat} {alt}")

            geom_3d_wkt = None
            if len(points_3d) >= 2:
                geom_3d_wkt = f"LINESTRING Z ({', '.join(points_3d)})"

            with psycopg2.connect(**self.db_config) as conn, conn.cursor() as cur:
                # 2. Insert/Update Procedure — use ST_MakeValid for safety
                if geom_3d_wkt:
                    cur.execute(
                        """
                            INSERT INTO rnp_procedures
                                (name, airport_id, runway, type, geom_3d, validation_status, validation_notes)
                            VALUES (%s, %s, %s, %s,
                                    ST_MakeValid(ST_GeomFromText(%s, 4326)),
                                    %s, %s)
                            ON CONFLICT (name) DO UPDATE SET
                                geom_3d = ST_MakeValid(EXCLUDED.geom_3d),
                                airport_id = EXCLUDED.airport_id,
                                runway = EXCLUDED.runway,
                                type = EXCLUDED.type,
                                validation_status = EXCLUDED.validation_status,
                                validation_notes = EXCLUDED.validation_notes
                            RETURNING id
                        """,
                        (
                            p_name,
                            proc_data.get("airport_id"),
                            proc_data.get("runway"),
                            proc_data.get("procedure_type"),
                            geom_3d_wkt,
                            validation_status,
                            validation_notes,
                        ),
                    )
                else:
                    cur.execute(
                        """
                            INSERT INTO rnp_procedures
                                (name, airport_id, runway, type, geom_3d, validation_status, validation_notes)
                            VALUES (%s, %s, %s, %s, NULL, %s, %s)
                            ON CONFLICT (name) DO UPDATE SET
                                geom_3d = NULL,
                                airport_id = EXCLUDED.airport_id,
                                runway = EXCLUDED.runway,
                                type = EXCLUDED.type,
                                validation_status = EXCLUDED.validation_status,
                                validation_notes = EXCLUDED.validation_notes
                            RETURNING id
                        """,
                        (
                            p_name,
                            proc_data.get("airport_id"),
                            proc_data.get("runway"),
                            proc_data.get("procedure_type"),
                            validation_status,
                            validation_notes,
                        ),
                    )

                proc_pk = cur.fetchone()[0]

                # 3. Upsert Waypoints — scoped to procedure_id
                for wp in proc_data.get("waypoints", []):
                    lat = wp.get("lat_dd")
                    lon = wp.get("lon_dd")
                    if not is_valid_coord(lat, lon):
                        logger.warning(
                            f"Skipping waypoint {wp.get('waypoint_id')} — "
                            f"invalid coords: ({lat}, {lon})"
                        )
                        continue
                    cur.execute(
                        """
                            INSERT INTO rnp_waypoints (procedure_id, ident, geom, coordinates_raw, role)
                            VALUES (%s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326), %s, %s)
                            ON CONFLICT (procedure_id, ident) DO UPDATE SET
                                geom = EXCLUDED.geom,
                                coordinates_raw = EXCLUDED.coordinates_raw,
                                role = EXCLUDED.role
                        """,
                        (
                            proc_pk,
                            wp.get("waypoint_id"),
                            lon,
                            lat,
                            wp.get("coordinates_raw"),
                            wp.get("role"),
                        ),
                    )

                # 4. Insert Legs
                cur.execute("DELETE FROM rnp_legs WHERE procedure_id = %s", (proc_pk,))
                legs = []
                for i, leg in enumerate(proc_data.get("tabular_description", []), 1):
                    alt_raw = leg.get("altitude") or leg.get("altitude_lower")

                    # Parse fly_over as boolean (usually encoded as 'Y' or ' ' in AIPs)
                    fly_over_raw = str(leg.get("fly_over", "")).strip().upper()
                    is_fly_over = fly_over_raw == "Y"

                    legs.append(
                        (
                            proc_pk,
                            i,
                            str(leg.get("serial_number", ""))[:10]
                            if leg.get("serial_number")
                            else None,
                            leg.get("path_descriptor"),
                            leg.get("waypoint_identifier"),
                            parse_altitude(alt_raw),
                            alt_raw,
                            leg.get("speed_limit"),
                            leg.get("course"),
                            leg.get("distance"),
                            leg.get("turn_direction"),
                            leg.get("vpa_tch"),
                            leg.get("nav_spec"),
                            leg.get("role"),
                            is_fly_over,
                        )
                    )

                if legs:
                    execute_values(
                        cur,
                        """
                            INSERT INTO rnp_legs
                                (procedure_id, sequence_nr, source_serial, path_descriptor, waypoint_ident,
                                 altitude_numeric, altitude_constraint, speed_limit,
                                 course, distance, turn_direction, vpa_tch, nav_spec, role, fly_over)
                            VALUES %s
                        """,
                        legs,
                    )

                conn.commit()
            return True
        except Exception as e:
            logger.error(f"Error loading {proc_data.get('procedure_name')}: {e}")
            return False
