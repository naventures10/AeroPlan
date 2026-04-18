import logging
import psycopg2
from psycopg2.extras import execute_values
from .utils import parse_altitude

logger = logging.getLogger("RNP-ETL.Loader")

SCHEMA_SQL = """
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
    ident VARCHAR(10) PRIMARY KEY,
    geom GEOMETRY(Point, 4326),
    coordinates_raw TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rnp_legs (
    id SERIAL PRIMARY KEY,
    procedure_id INT REFERENCES rnp_procedures(id) ON DELETE CASCADE,
    sequence_nr INT,
    path_descriptor VARCHAR(5),
    waypoint_ident VARCHAR(10),
    altitude_numeric NUMERIC,
    altitude_constraint TEXT,
    speed_limit TEXT,
    course TEXT,
    distance TEXT,
    role TEXT,
    fly_over BOOLEAN
);

CREATE INDEX IF NOT EXISTS idx_rnp_proc_geom ON rnp_procedures USING GIST (geom_3d);
CREATE INDEX IF NOT EXISTS idx_rnp_waypoints_geom ON rnp_waypoints USING GIST (geom);
"""

class RNPLoader:
    def __init__(self, db_config):
        self.db_config = db_config

    def init_schema(self):
        try:
            conn = psycopg2.connect(**self.db_config)
            cur = conn.cursor()
            cur.execute(SCHEMA_SQL)
            conn.commit()
            cur.close()
            conn.close()
            logger.info("Database schema initialized successfully.")
        except Exception as e:
            logger.error(f"Failed to initialize schema: {e}")
            raise

    def load_procedure(self, proc_data):
        """Loads a single procedure and its 3D geometry."""
        try:
            conn = psycopg2.connect(**self.db_config)
            cur = conn.cursor()
            
            # 1. Upsert Waypoints
            for wp in proc_data.get("waypoints", []):
                cur.execute("""
                    INSERT INTO rnp_waypoints (ident, geom, coordinates_raw)
                    VALUES (%s, ST_GeomFromText(%s, 4326), %s)
                    ON CONFLICT (ident) DO UPDATE SET geom = EXCLUDED.geom
                """, (wp["waypoint_id"], f"POINT({wp['lon_dd']} {wp['lat_dd']})", wp["coordinates_raw"]))
            
            # 2. Insert Procedure
            p_name = proc_data["procedure_name"]
            
            # Generate 3D Geometry
            points_3d = []
            last_alt = 10000 # Default initial
            for leg in proc_data.get("tabular_description", []):
                ident = leg.get("waypoint_identifier")
                wp = next((w for w in proc_data["waypoints"] if w["waypoint_id"] == ident), None)
                if wp:
                    alt_raw = leg.get("altitude") or leg.get("altitude_lower")
                    alt = parse_altitude(alt_raw)
                    if alt is None: alt = last_alt
                    else: last_alt = alt
                    points_3d.append(f"{wp['lon_dd']} {wp['lat_dd']} {alt}")
            
            geom_3d_wkt = f"LINESTRING Z ({', '.join(points_3d)})" if len(points_3d) >= 2 else None
            
            cur.execute("""
                INSERT INTO rnp_procedures (name, airport_id, runway, type, geom_3d, validation_status)
                VALUES (%s, %s, %s, %s, ST_GeomFromText(%s, 4326), %s)
                ON CONFLICT (name) DO UPDATE SET geom_3d = EXCLUDED.geom_3d
                RETURNING id
            """, (p_name, proc_data.get("airport_id"), proc_data.get("runway"), 
                  proc_data.get("procedure_type"), geom_3d_wkt, "SUCCESS"))
            
            proc_id = cur.fetchone()[0]
            
            # 3. Insert Legs
            cur.execute("DELETE FROM rnp_legs WHERE procedure_id = %s", (proc_id,))
            legs = []
            for i, leg in enumerate(proc_data.get("tabular_description", []), 1):
                alt_raw = leg.get("altitude") or leg.get("altitude_lower")
                legs.append((
                    proc_id, i, leg.get("path_descriptor"), leg.get("waypoint_identifier"),
                    parse_altitude(alt_raw), alt_raw, leg.get("speed_limit"),
                    leg.get("course"), leg.get("distance"), leg.get("role")
                ))
            
            execute_values(cur, """
                INSERT INTO rnp_legs (procedure_id, sequence_nr, path_descriptor, waypoint_ident, altitude_numeric, altitude_constraint, speed_limit, course, distance, role)
                VALUES %s
            """, legs)
            
            conn.commit()
            cur.close()
            conn.close()
            return True
        except Exception as e:
            logger.error(f"Error loading {proc_data.get('procedure_name')}: {e}")
            return False
