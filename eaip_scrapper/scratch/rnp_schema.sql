-- rnp_schema.sql
-- Initialize RNP Procedure tables in PostGIS

-- Procedure Metadata & 3D Geometry
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

-- RNP Waypoint Cache (Deduplicated across procedures)
CREATE TABLE IF NOT EXISTS rnp_waypoints (
    ident VARCHAR(10) PRIMARY KEY,
    geom GEOMETRY(Point, 4326),
    coordinates_raw TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- RNP Procedure Legs (ARINC 424 sequence)
CREATE TABLE IF NOT EXISTS rnp_legs (
    id SERIAL PRIMARY KEY,
    procedure_id INT REFERENCES rnp_procedures(id) ON DELETE CASCADE,
    sequence_nr INT,
    path_descriptor VARCHAR(5),
    waypoint_ident VARCHAR(10),
    altitude_numeric NUMERIC, -- Normalized feet
    altitude_constraint TEXT,
    speed_limit TEXT,
    course TEXT,
    distance TEXT,
    role TEXT,
    fly_over BOOLEAN
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_rnp_proc_geom ON rnp_procedures USING GIST (geom_3d);
CREATE INDEX IF NOT EXISTS idx_rnp_waypoints_geom ON rnp_waypoints USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_rnp_legs_proc_id ON rnp_legs (procedure_id);
