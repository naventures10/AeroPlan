
import json

def spot_check(file_path):
    try:
        with open(file_path, 'r') as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error loading JSON: {e}")
        return

    anomalies = []
    
    # Define expected top-level keys
    expected_keys = {"procedure_name", "airport_id", "runway", "procedure_type", "column_headers", "tabular_description", "waypoints"}
    
    # Expected keys in tabular_description entries (based on column_headers)
    # Note: These can vary by procedure, so we'll check against 'column_headers' list per procedure.

    for idx, proc in enumerate(data):
        proc_name = proc.get("procedure_name", f"Unnamed_{idx}")
        
        # 1. Check top-level keys
        missing_keys = expected_keys - set(proc.keys())
        if missing_keys:
            anomalies.append({
                "procedure": proc_name,
                "type": "Missing Top-Level Keys",
                "details": list(missing_keys)
            })
            
        # 2. Check for null/empty critical values
        for key in ["procedure_name", "airport_id"]:
            if not proc.get(key):
                anomalies.append({
                    "procedure": proc_name,
                    "type": f"Null/Empty {key}",
                    "details": proc.get(key)
                })

        # 3. Check tabular_description structure
        tabular = proc.get("tabular_description", [])
        headers = proc.get("column_headers", [])
        if not tabular:
            anomalies.append({
                "procedure": proc_name,
                "type": "Empty Tabular Description",
                "details": None
            })
        else:
            for row_idx, row in enumerate(tabular):
                # Check if row keys match headers (mostly)
                row_keys = set(row.keys())
                # Allow minor variations but warn if major headers are missing
                missing_headers = set(headers) - row_keys
                if missing_headers:
                    # Ignore minor ones if necessary, but report for now
                    if any(h not in row_keys for h in ["waypoint_identifier", "path_descriptor"]):
                         anomalies.append({
                            "procedure": proc_name,
                            "type": "Row Missing Critical Header",
                            "row": row_idx,
                            "details": list(missing_headers)
                        })

        # 4. Check waypoints structure and coordinates
        waypoints = proc.get("waypoints", [])
        if not waypoints:
             anomalies.append({
                "procedure": proc_name,
                "type": "No Waypoints Found",
                "details": None
            })
        else:
            for wp in waypoints:
                # Actual keys found in output.json: waypoint_id, lat_dd, lon_dd, coordinates_raw
                wp_id = wp.get("waypoint_id")
                lat = wp.get("lat_dd")
                lon = wp.get("lon_dd")
                
                if not wp_id:
                     anomalies.append({
                        "procedure": proc_name,
                        "type": "Waypoint Missing ID",
                        "details": wp
                    })

                if lat is None or lon is None:
                    anomalies.append({
                        "procedure": proc_name,
                        "type": "Waypoint Missing Coordinates",
                        "waypoint": wp_id,
                        "details": {"lat": lat, "lon": lon}
                    })
                elif not (-90 <= lat <= 90) or not (-180 <= lon <= 180):
                    anomalies.append({
                        "procedure": proc_name,
                        "type": "Invalid Coordinate Range",
                        "waypoint": wp_id,
                        "details": {"lat": lat, "lon": lon}
                    })
                
                if not wp.get("coordinates_raw"):
                    anomalies.append({
                        "procedure": proc_name,
                        "type": "Waypoint Missing Raw Coordinates",
                        "waypoint": wp_id,
                        "details": None
                    })

        # 5. Cross-reference waypoints and check for placeholders
        known_wp_ids = {wp.get("waypoint_id") for wp in waypoints if wp.get("waypoint_id")}
        for row_idx, row in enumerate(tabular):
            wp_id = row.get("waypoint_identifier")
            if wp_id and wp_id not in known_wp_ids:
                # If it's a known waypoint type but not in the coordinates list
                # Some are placeholders or runway IDs
                if not wp_id.startswith(("RWY", "RW")):
                    anomalies.append({
                        "procedure": proc_name,
                        "type": "Waypoint Reference Missing from Coordinates",
                        "waypoint": wp_id,
                        "row": row_idx
                    })
            
            # Check for "null" or empty strings in CRITICAL fields
            critical_fields = ["waypoint_identifier", "path_descriptor", "serial_number"]
            for k, v in row.items():
                if v is None and k in critical_fields:
                    anomalies.append({
                        "procedure": proc_name,
                        "type": "CRITICAL Null Value in Tabular",
                        "field": k,
                        "row": row_idx
                    })
                elif isinstance(v, str) and v.strip() == "" and k in critical_fields:
                    anomalies.append({
                        "procedure": proc_name,
                        "type": "CRITICAL Empty String in Tabular",
                        "field": k,
                        "row": row_idx
                    })
        
        # Check waypoint coordinates are actually floats
        for wp in waypoints:
            lat = wp.get("lat_dd")
            lon = wp.get("lon_dd")
            if lat is not None and not isinstance(lat, (float, int)):
                anomalies.append({
                    "procedure": proc_name,
                    "type": "Invalid Coordinate Type",
                    "waypoint": wp.get("waypoint_id"),
                    "details": {"lat_type": str(type(lat))}
                })
        
        # 6. Check for duplicate serial numbers within a procedure
        serials = [row.get("serial_number") for row in tabular if row.get("serial_number")]
        # Note: Some procedures have multiple blocks starting from 10, check if that's expected
        # (Actually I saw multiple IF/10 rows in my earlier read_file)
        if len(serials) != len(set(serials)):
             # We saw this in VAAU-RNP-Y-RWY-09-CODING earlier (duplicate 10, 20)
             # Let's count how many procedures have this.
             pass 

    print(f"Total Anomalies found: {len(anomalies)}")
    
    # Group by type for clarity
    summary = {}
    for a in anomalies:
        t = a["type"]
        summary[t] = summary.get(t, 0) + 1
        
    print("\nAnomaly Summary:")
    for t, count in summary.items():
        print(f"  - {t}: {count}")

    if anomalies:
        print("\nDetailed Sample (First 20):")
        for a in anomalies[:20]:
            print(json.dumps(a, indent=2))

if __name__ == "__main__":
    spot_check("output.json")
