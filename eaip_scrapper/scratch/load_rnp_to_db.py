import json
import psycopg2
import re
from psycopg2.extras import execute_values

# DB Connection Config
DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "database": "aeronautical_information_system",
    "user": "postgres",
    "password": "postgres"  # Updated from 'password' to 'postgres'
}

JSON_PATH = "/Users/naveendevapalan/Desktop/Naveen/PROJECTS/eAIP/eaip_scrapper/scratch/output.json"

def parse_altitude(alt_str):
    if not alt_str:
        return None
    alt_str = str(alt_str).upper().strip()
    
    # Extract all potential altitude values from the string
    # Matches FLxxx or numbers with + / -
    matches = re.findall(r'(?:FL\s*(\d+))|([-+]?\s*\d+(?:\.\d+)?)', alt_str)
    
    vals = []
    for fl, num in matches:
        if fl:
            vals.append(float(fl) * 100)
        elif num:
            vals.append(abs(float(num.replace(' ', ''))))
            
    if not vals:
        return None
        
    # If a range is given, return the minimum (lower bound) for approach profile safety,
    # unless it's a single value.
    return min(vals)

def validate_procedure(proc):
    """
    Data Validation Layer:
    - Connectivity: Waypoint exists in coords table?
    - Continuity: At least 2 points?
    - Altitude: Descending profile sanity check?
    """
    legs = proc.get("tabular_description", [])
    waypoints = {w["waypoint_id"]: w for w in proc.get("waypoints", [])}
    
    issues = []
    points_3d = []
    last_alt = None
    
    for leg in legs:
        ident = leg.get("waypoint_identifier") or leg.get("ident")
        if not ident: continue
            
        if ident not in waypoints:
            if not ident.startswith("RW"):
                issues.append(f"Missing coords for {ident}")
            continue
            
        wp = waypoints[ident]
        alt_raw = leg.get("altitude_ft") or leg.get("altitude") or leg.get("altitude_lower")
        alt = parse_altitude(alt_raw)
        
        # Interpolate altitude if missing
        if alt is None:
            alt = last_alt
        else:
            last_alt = alt
            
        if wp.get("lat_dd") is not None and wp.get("lon_dd") is not None:
            points_3d.append((wp["lon_dd"], wp["lat_dd"], alt or 0))
    
    # Backward interpolation for initial points if they missed first alt
    if points_3d:
        first_known_alt = next((p[2] for p in points_3d if p[2] > 0), 10000) # Default to 10k if none
        points_3d = [(p[0], p[1], p[2] if p[2] > 0 else first_known_alt) for p in points_3d]

    if len(points_3d) < 2:
        issues.append("Insufficient 3D points")
        
    return {
        "is_valid": len(issues) == 0,
        "notes": "; ".join(issues),
        "points": points_3d
    }

def construct_linestring_z(points):
    if not points:
        return None
    # LINESTRING Z (lon lat z, lon lat z, ...)
    p_strs = [f"{p[0]} {p[1]} {p[2]}" for p in points]
    return f"LINESTRING Z ({', '.join(p_strs)})"

def load():
    with open(JSON_PATH, 'r') as f:
        data = json.load(f)
        
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    
    print(f"Loading {len(data)} procedures...")
    
    # 1. Waypoints Ingestion
    all_wpts = {}
    for proc in data:
        for wp in proc.get("waypoints", []):
            wid = wp["waypoint_id"]
            if wid not in all_wpts:
                all_wpts[wid] = wp
                
    wpt_data = [
        (wid, f"POINT({wp['lon_dd']} {wp['lat_dd']})", wp.get("coordinates_raw"))
        for wid, wp in all_wpts.items()
        if wp.get("lon_dd") is not None
    ]
    
    execute_values(cur, """
        INSERT INTO rnp_waypoints (ident, geom, coordinates_raw)
        VALUES %s ON CONFLICT (ident) DO UPDATE SET geom = EXCLUDED.geom
    """, wpt_data, template="(%s, ST_GeomFromText(%s, 4326), %s)")
    
    print(f"Upserted {len(wpt_data)} unique waypoints.")
    
    # 2. Procedures & Legs Ingestion
    for proc in data:
        p_name = proc["procedure_name"]
        
        # Validation Layer
        val_res = validate_procedure(proc)
        status = "SUCCESS" if val_res["is_valid"] else "FAILED"
        
        linestring = construct_linestring_z(val_res["points"])
        
        try:
            cur.execute("""
                INSERT INTO rnp_procedures (name, airport_id, runway, type, geom_3d, validation_status, validation_notes)
                VALUES (%s, %s, %s, %s, ST_GeomFromText(%s, 4326), %s, %s)
                ON CONFLICT (name) DO UPDATE SET geom_3d = EXCLUDED.geom_3d, validation_status = EXCLUDED.validation_status
                RETURNING id
            """, (p_name, proc.get("airport_id"), proc.get("runway"), proc.get("procedure_type"), 
                  linestring, status, val_res["notes"]))
            
            proc_db_id = cur.fetchone()[0]
            
            # Legs
            cur.execute("DELETE FROM rnp_legs WHERE procedure_id = %s", (proc_db_id,))
            leg_data = []
            for i, leg in enumerate(proc.get("tabular_description", []), 1):
                ident = leg.get("waypoint_identifier") or leg.get("ident")
                alt_raw = leg.get("altitude_ft") or leg.get("altitude") or leg.get("altitude_lower")
                alt_num = parse_altitude(alt_raw)
                
                leg_data.append((
                    proc_db_id, i, leg.get("path_descriptor"), ident,
                    alt_num, alt_raw, leg.get("speed_limit_kt") or leg.get("speed_limit"),
                    leg.get("course"), leg.get("distance_nm") or leg.get("distance"),
                    leg.get("role")
                ))
            
            execute_values(cur, """
                INSERT INTO rnp_legs (procedure_id, sequence_nr, path_descriptor, waypoint_ident, altitude_numeric, altitude_constraint, speed_limit, course, distance, role)
                VALUES %s
            """, leg_data)
            
        except Exception as e:
            print(f"Error loading {p_name}: {e}")
            conn.rollback()
            continue
            
    conn.commit()
    cur.close()
    conn.close()
    print("Loading complete.")

if __name__ == "__main__":
    load()
