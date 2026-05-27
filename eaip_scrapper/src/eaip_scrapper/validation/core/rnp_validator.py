import logging
import math

from eaip_scrapper.rnp_processor.utils import (
    is_valid_coord,
)

logger = logging.getLogger("RNP-eaip_scrapper.etl.Validator")


class RNPValidator:
    def __init__(self):
        self.path_values = {
            "IF",
            "TF",
            "CF",
            "DF",
            "HM",
            "CA",
            "RF",
            "CI",
            "FA",
            "VA",
            "VM",
        }
        self.blacklist = {
            "IF",
            "TF",
            "CF",
            "DF",
            "HM",
            "CA",
            "RF",
            "IAF",
            "FAF",
            "MAPT",
            "THR",
        }

    def validate_procedure_data(self, proc_data):
        """Validates the structured procedure dict before loading.

        Returns dict with:
          success: bool
          issues: list[str]
          status: "SUCCESS" | "WARNING" | "FAILED"
        """
        issues = []
        proc_data.get("procedure_name", "UNKNOWN")

        tab_ids = {
            str(leg.get("waypoint_identifier")).upper()
            for leg in proc_data.get("tabular_description", [])
            if leg.get("waypoint_identifier")
        }
        coord_ids = {str(wp.get("waypoint_id")).upper() for wp in proc_data.get("waypoints", [])}

        # ── 1. Connectivity Check ─────────────────────────────────────────────
        missing_coords = tab_ids - coord_ids
        # Filter out runways and known non-coordinate points
        missing_coords = {
            wid
            for wid in missing_coords
            if not (wid.startswith("RW") or "RWY" in wid or wid == "DER")
        }
        if missing_coords:
            issues.append(f"Waypoints missing coordinates: {sorted(missing_coords)}")

        # ── 2. Schema Check ───────────────────────────────────────────────────
        for i, leg in enumerate(proc_data.get("tabular_description", []), 1):
            path = str(leg.get("path_descriptor", "")).upper()
            if path and path not in self.path_values:
                issues.append(f"Row {i}: Invalid path descriptor '{path}'")

        # ── 3. Spatial Sanity: coordinates within India bbox ──────────────────
        for wp in proc_data.get("waypoints", []):
            lat = wp.get("lat_dd")
            lon = wp.get("lon_dd")
            if lat is not None and lon is not None and not is_valid_coord(lat, lon):
                issues.append(
                    f"Waypoint {wp.get('waypoint_id')} out of bounds: lat={lat}, lon={lon}"
                )

        # ── 4. Path Continuity: detect massive jumps (>500 NM ≈ ~8.3°) ──────
        wpt_lookup = {
            str(wp.get("waypoint_id", "")).upper(): (wp.get("lat_dd"), wp.get("lon_dd"))
            for wp in proc_data.get("waypoints", [])
            if wp.get("waypoint_id")
            and wp.get("lat_dd") is not None
            and wp.get("lon_dd") is not None
        }
        prev_coord = None
        for leg in proc_data.get("tabular_description", []):
            ident = leg.get("waypoint_identifier")
            if ident and ident.upper() in wpt_lookup:
                coord = wpt_lookup[ident.upper()]
                if prev_coord:
                    dlat = abs(coord[0] - prev_coord[0])
                    dlon = abs(coord[1] - prev_coord[1])
                    dist_deg = math.sqrt(dlat**2 + dlon**2)
                    if dist_deg > 8.3:  # ~500 NM
                        issues.append(f"Massive jump ({dist_deg:.1f}°) between legs near {ident}")
                prev_coord = coord

        # ── 5. FAS Pollution Check ────────────────────────────────────────────
        fas_keywords = ["operation type", "calculated crc", "fpap"]
        raw_dump = str(proc_data).lower()
        if sum(1 for kw in fas_keywords if kw in raw_dump) >= 2:
            issues.append("Probable FAS DATA BLOCK pollution detected")

        # ── 6. Empty Data Check ───────────────────────────────────────────────
        if not proc_data.get("tabular_description"):
            issues.append("No tabular description rows extracted")
        if not proc_data.get("waypoints"):
            issues.append("No waypoints extracted")

        # ── Determine Status ──────────────────────────────────────────────────
        if not issues:
            status = "SUCCESS"
        elif all("Waypoints missing coordinates" in i for i in issues):
            # Missing coordinates is recoverable — mark as WARNING
            status = "WARNING"
        else:
            status = "FAILED"

        return {
            "success": len(issues) == 0,
            "issues": issues,
            "status": status,
        }
