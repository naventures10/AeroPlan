import logging
import math
import re

from eaip_scrapper.rnp_processor.geometry import haversine_nm, reconstruct_path_3d
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
            "FINAL",
            "INITB",
            "INITL",
            "INITR",
            "MISAP",
            "BASE",
            "TRANS",
            "MAPT/MATF",
            "DER",
        }

    def validate_procedure_data(self, proc_data):
        """Validates the structured procedure dict before loading.

        Returns dict with:
          success: bool
          issues: list[str]
          status: "SUCCESS" | "WARNING" | "FAILED"
        """
        errors = []
        warnings = []
        proc_data.get("procedure_name", "UNKNOWN")

        # Reconstruct path early to resolve any missing distances programmatically
        if proc_data.get("tabular_description") and proc_data.get("waypoints"):
            reconstruct_path_3d(proc_data)

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
            if wid not in self.blacklist and not (wid.startswith("RW") or "RWY" in wid)
        }
        if missing_coords:
            errors.append(f"Waypoints missing coordinates: {sorted(missing_coords)}")

        # ── 2. Schema Check ───────────────────────────────────────────────────
        for i, leg in enumerate(proc_data.get("tabular_description", []), 1):
            path = str(leg.get("path_descriptor", "")).upper()
            if path and path not in self.path_values:
                errors.append(f"Row {i}: Invalid path descriptor '{path}'")

            # Course Format Check
            course = leg.get("course", "")
            if course:
                course_str = str(course)
                if not re.match(r"^\d+(?:\.\d+)?° M / \d+(?:\.\d+)?° T$", course_str):
                    errors.append(
                        f"Row {i}: Course '{course_str}' is not in normalized format '[Mag]° M / [True]° T'"
                    )

            # Altitude Constraint Check
            altitude = leg.get("altitude", "")
            if altitude:
                alt_str = str(altitude)
                if not re.match(r"^(?:@\d+|\+\d+|-\d+|\+\d+ / -\d+)$", alt_str):
                    errors.append(
                        f"Row {i}: Altitude constraint '{alt_str}' is not in normalized format"
                    )

            # Speed Limit Check
            speed = leg.get("speed_limit", "")
            if speed:
                speed_str = str(speed)
                if not re.match(r"^(?:@\d+|\+\d+|-\d+)$", speed_str):
                    errors.append(f"Row {i}: Speed limit '{speed_str}' is not in normalized format")

            # Distance Check
            distance = leg.get("distance", "")
            if distance:
                dist_str = str(distance)
                if not re.match(r"^(?:\d+(?:\.\d+)?|\d+ MIN)$", dist_str):
                    errors.append(f"Row {i}: Distance '{dist_str}' is not in normalized format")

            # VPA/TCH Check
            vpa_tch = leg.get("vpa_tch", "")
            if vpa_tch:
                vt_str = str(vpa_tch)
                if not re.match(r"^-\d+(?:\.\d+)?(?: / \d+)?$", vt_str):
                    errors.append(f"Row {i}: VPA/TCH '{vt_str}' is not in normalized format")

            # Nav Spec Check
            nav_spec = leg.get("nav_spec", "")
            if nav_spec:
                ns_str = str(nav_spec)
                if ns_str not in {"RNP APCH", "RNP 1", "RNAV 1", "RNAV 2", "RNAV 5", "BARO VNAV"}:
                    errors.append(f"Row {i}: Nav spec '{ns_str}' is not in allowed list")

            # Turn Direction Check
            turn = leg.get("turn_direction", "")
            if turn:
                turn_str = str(turn)
                if turn_str not in {"L", "R"}:
                    errors.append(f"Row {i}: Turn direction '{turn_str}' is invalid")

            # Mandatory Distance Check
            if path in ("TF", "CF") and not leg.get("distance"):
                errors.append(f"Row {i}: Missing mandatory distance for {path} leg")

            # Holding Pattern Completeness Check
            if path in ("HM", "HA", "HF"):
                missing_hold_params = []
                if not leg.get("waypoint_identifier"):
                    missing_hold_params.append("waypoint_identifier")
                if not leg.get("course"):
                    missing_hold_params.append("course")
                if not leg.get("turn_direction"):
                    missing_hold_params.append("turn_direction")
                if not leg.get("distance"):
                    missing_hold_params.append("distance/time")
                if missing_hold_params:
                    errors.append(
                        f"Row {i}: Holding pattern ({path}) is missing parameters: {', '.join(missing_hold_params)}"
                    )

            # Bundled Transitions Warning (IF not at start)
            if path == "IF" and i > 1:
                warnings.append(
                    f"Row {i}: IF leg found in the middle of procedure (possible bundled transitions)"
                )

        # Altitude Profile Presence Check
        has_altitude = any(leg.get("altitude") for leg in proc_data.get("tabular_description", []))
        if not has_altitude:
            errors.append("No altitude constraints defined in the procedure")

        # ── 3. Spatial Sanity: coordinates within India bbox ──────────────────
        for wp in proc_data.get("waypoints", []):
            lat = wp.get("lat_dd")
            lon = wp.get("lon_dd")
            if lat is not None and lon is not None and not is_valid_coord(lat, lon):
                errors.append(
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
                        errors.append(f"Massive jump ({dist_deg:.1f}°) between legs near {ident}")
                prev_coord = coord

        # ── 5. FAS Pollution Check ────────────────────────────────────────────
        fas_keywords = ["operation type", "calculated crc", "fpap"]
        raw_dump = str(proc_data).lower()
        if sum(1 for kw in fas_keywords if kw in raw_dump) >= 2:
            errors.append("Probable FAS DATA BLOCK pollution detected")

        # ── 6. Empty Data Check ───────────────────────────────────────────────
        if not proc_data.get("tabular_description"):
            errors.append("No tabular description rows extracted")
        if not proc_data.get("waypoints"):
            errors.append("No waypoints extracted")

        # ── 7. Reconstructed Path Validation ──────────────────────────────────
        if proc_data.get("tabular_description") and proc_data.get("waypoints"):
            path_points = reconstruct_path_3d(proc_data)
            if len(path_points) < 2:
                errors.append("Reconstructed 3D path has fewer than 2 points")
            else:
                for j in range(1, len(path_points)):
                    p1 = path_points[j - 1]
                    p2 = path_points[j]
                    dist = haversine_nm(p1[0], p1[1], p2[0], p2[1])
                    if dist > 500.0:
                        errors.append(
                            f"Massive jump ({dist:.1f} NM) in reconstructed geometry between point {j - 1} and point {j}"
                        )

        # ── Determine Status ──────────────────────────────────────────────────
        status = "FAILED" if errors else ("WARNING" if warnings else "SUCCESS")

        return {
            "success": len(errors) == 0,
            "issues": errors + warnings,
            "status": status,
        }
