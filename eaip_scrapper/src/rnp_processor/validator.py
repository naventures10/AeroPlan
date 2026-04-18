import logging
import re
from .utils import clean_text

logger = logging.getLogger("RNP-ETL.Validator")

class RNPValidator:
    def __init__(self):
        self.path_values = {"IF", "TF", "CF", "DF", "HM", "CA", "RF", "CI", "FA", "VA", "VM"}
        self.blacklist = {"IF", "TF", "CF", "DF", "HM", "CA", "RF", "IAF", "FAF", "MAPT", "THR"}

    def is_valid_wpt_id(self, s):
        if not s: return False
        s = s.upper().strip()
        if s in self.blacklist: return False
        if not (3 <= len(s) <= 8): return False
        if not s.isalnum(): return False
        if s[0].isdigit(): return False
        return any(c.isalpha() for c in s) and any(c.isdigit() for c in s)

    def validate_procedure_data(self, proc_data):
        """Validates the structured procedure dict before loading."""
        issues = []
        name = proc_data.get("procedure_name", "UNKNOWN")
        
        tab_ids = {str(leg.get("waypoint_identifier")).upper() for leg in proc_data.get("tabular_description", []) if leg.get("waypoint_identifier")}
        coord_ids = {str(wp.get("waypoint_id")).upper() for wp in proc_data.get("waypoints", [])}
        
        # 1. Connectivity Check
        missing_coords = tab_ids - coord_ids
        # Filter out runways and known non-coordinate points
        missing_coords = {
            wid for wid in missing_coords 
            if not (wid.startswith("RW") or "RWY" in wid or wid == 'DER')
        }
        if missing_coords:
            issues.append(f"Waypoints missing coordinates: {list(missing_coords)}")
            
        # 2. Schema Check
        for i, leg in enumerate(proc_data.get("tabular_description", []), 1):
            path = str(leg.get("path_descriptor", "")).upper()
            if path and path not in self.path_values:
                issues.append(f"Row {i}: Invalid path descriptor '{path}'")
                
        # 3. FAS Pollution Check
        fas_keywords = ["operation type", "calculated crc", "fpap"]
        raw_dump = str(proc_data).lower()
        if sum(1 for kw in fas_keywords if kw in raw_dump) >= 2:
            issues.append("Probable FAS DATA BLOCK pollution detected")
            
        return {
            "success": len(issues) == 0,
            "issues": issues,
            "status": "SUCCESS" if not issues else "WARNING" if all("Missing coords" in i for i in issues) else "FAILED"
        }
