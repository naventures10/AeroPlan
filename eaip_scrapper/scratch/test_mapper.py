import re

def map_cells(flat_cells):
    seq_num = None; path_descriptor = None; waypoint_id = None
    fly_over = False; course = None; distance = None
    turn_dir = None; altitude = None; speed_limit = None
    vpa_tch = None; nav_spec = None
    
    for i, cell in enumerate(flat_cells):
        if not cell: continue
        c = cell.strip()
        c_up = c.upper()
        
        if seq_num is None and c.isdigit() and len(c) <= 4:
            seq_num = c; continue
        if path_descriptor is None and c_up in ['IF', 'TF', 'CF', 'DF', 'HM', 'CA', 'RF']:
            path_descriptor = c_up; continue
        if c_up == 'Y' and len(c_up) == 1:
            fly_over = True; continue
        if c_up in ['R', 'L'] and len(c_up) == 1:
            turn_dir = c_up; continue
        if "°" in c_up or "MAG" in c_up or "TRUE" in c_up or "/" in c_up and "TRUE" in c_up:
            course = c; continue
        if bool(re.search(r'-?\d{1,2}\.?\d*/\d{1,3}', c)):
            vpa_tch = c; continue
        if ("+" in c_up or "@" in c_up or "FL" in c_up or "FT" in c_up) and not "°" in c_up:
            # Avoid overwriting altitude if multiple exist (like -FL060 +4600.00 might be parsed as 1 cell)
            if altitude is None: altitude = c
            else: altitude = f"{altitude} {c}"
            continue
        if "RNP" in c_up or "APCH" in c_up or "IAF" in c_up or "FAF" in c_up or "MAPT" in c_up or (c_up == "IF" and path_descriptor is not None):
            nav_spec = c; continue
            
        # Distinguishing Speed vs Distance vs Waypoint ID
        # Speed: e.g. 210, -210, 210.00
        speed_match = re.match(r'^-?(\d{3})(?:\.\d+)?$', c)
        if speed_match and 100 <= int(speed_match.group(1)) <= 350:
            speed_limit = c; continue
            
        # Distance: e.g. 7.00, 1.00 min
        if "MIN" in c_up or bool(re.match(r'^\d{1,3}\.\d{1,2}$', c)):
            distance = c; continue
            
        if waypoint_id is None and 4 <= len(c) <= 6 and c.replace('-', '').isalnum():
            waypoint_id = c; continue
            
    return {
        "seq_num": seq_num, "path_descriptor": path_descriptor, "waypoint_id": waypoint_id,
        "fly_over": fly_over, "course": course, "distance": distance, "turn_dir": turn_dir,
        "altitude": altitude, "speed_limit": speed_limit, "vpa_tch": vpa_tch, "nav_spec": nav_spec
    }

print(map_cells(["10", "IF", "HB364", "+4500.00", "210", "RNP APCH"]))
print(map_cells(["20", "TF", "HB363", "264.49° Mag 262.99° True", "7.00", "R", "+4500.00", "RNP APCH"]))
print(map_cells(["30", "TF", "RW09", "Y", "090.06° Mag 089.39° True", "6.38", "@1967.00", "-3.00/50", "RNP APCH"]))
print(map_cells(["40", "HM", "AU702", "Y", "0.00° Mag / 359.33° True", "1.00 min", "R", "+4600.00", "-230.00", "RNP APCH"]))

