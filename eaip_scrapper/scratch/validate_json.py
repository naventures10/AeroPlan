#!/usr/bin/env python3
import json
import re
from pathlib import Path


JSON_PATH = Path("/Users/naveendevapalan/Desktop/Naveen/PROJECTS/eAIP/eaip_scrapper/scratch/output.json")

FAS_KEYWORDS = ["OPERATION TYPE", "CALCULATED CRC", "DATA BLOCK", "FPAP", "HAL (METRES)", "VAL (METRES)"]
PATH_VALUES = {"IF", "TF", "CF", "DF", "HM", "CA", "RF", "CI", "FA", "VA", "VM"}
TURN_VALUES = {"L", "R", "LT", "RT"}


def is_blank(value) -> bool:
    return value is None or (isinstance(value, str) and value.strip().upper() in {"", "-", "—", "--", "N/A"})


def is_waypoint_like(value: str) -> bool:
    if is_blank(value):
        return True
    value = str(value).strip().upper()
    if value == "N/A":
        return False
    return bool(re.fullmatch(r"[A-Z0-9]{2,8}", value))


def is_path_descriptor_like(value: str) -> bool:
    if is_blank(value):
        return True
    return str(value).strip().upper() in PATH_VALUES


def is_fly_over_like(value: str) -> bool:
    if is_blank(value):
        return True
    return str(value).strip().upper() in {"Y", "N"}


def is_turn_like(value: str) -> bool:
    if is_blank(value):
        return True
    return str(value).strip().upper() in TURN_VALUES


def is_course_like(value: str) -> bool:
    if is_blank(value):
        return True
    value = str(value).strip()
    if value.upper() in {"N/A", "- / -"}:
        return True
    if re.search(r"\d", value) is None:
        return False
    if "MAG" in value.upper() or "TRUE" in value.upper():
        return True
    if re.search(r"\b[MT]\b", value.upper()):
        return True
    if re.search(r"\d+(?:\.\d+)?\s*[°]?\s*\(\s*\d+(?:\.\d+)?\s*[°]?\s*\)", value):
        return True
    if re.search(r"\d+(?:\.\d+)?\s*[°]?\s*/?\s*\(\s*\d+(?:\.\d+)?\s*[°]?\s*\)", value):
        return True
    if re.search(r"\d+(?:\.\d+)?\s*[°]?\s+\d+(?:\.\d+)?\s*[°]?", value):
        return True
    if re.search(r"\d+(?:\.\d+)?\s+\d+(?:\.\d+)?", value):
        return True
    return False


def is_altitude_like(value: str) -> bool:
    if is_blank(value):
        return True
    value = str(value).strip().upper()
    if any(token in value for token in ["RNP", "APCH", "MAG", "TRUE", "°"]):
        return False
    if re.fullmatch(r"[@+\-]?\s*FL\d{2,3}", value):
        return True
    if re.fullmatch(r"[@+\-]?\s*\d+(?:\.\d+)?", value):
        return True
    if re.fullmatch(r"[@+\-]?\s*FL\d{2,3}\s+[@+\-]?\s*\d+(?:\.\d+)?", value):
        return True
    if re.fullmatch(r"[@+\-]?\s*\d+(?:\.\d+)?\s*/\s*[@+\-]?\s*(?:FL\d{2,3}|\d+(?:\.\d+)?)", value):
        return True
    if re.fullmatch(r"[@+\-]?\s*(?:FL\d{2,3}|\d+(?:\.\d+)?)\s*/\s*[@+\-]?\s*(?:FL\d{2,3}|\d+(?:\.\d+)?)", value):
        return True
    if re.fullmatch(r"[@+\-]?\s*(?:FL\d{2,3}|\d+(?:\.\d+)?)\s+[@+\-]?\s*(?:FL\d{2,3}|\d+(?:\.\d+)?)", value):
        return True
    return False


def is_speed_like(value: str) -> bool:
    if is_blank(value):
        return True
    value = str(value).strip().upper()
    if value == "N/A":
        return True
    return bool(re.fullmatch(r"[-+]?\s*\d+(?:\.\d+)?", value))


def is_distance_like(value: str) -> bool:
    if is_blank(value):
        return True
    value = str(value).strip().upper()
    if value == "N/A":
        return True
    if re.fullmatch(r"\d+(?:\.\d+)?", value):
        return True
    if re.fullmatch(r"\d+(?:\.\d+)?\s*MIN", value):
        return True
    if re.fullmatch(r"\d+(?:\.\d+)?\s*NM", value):
        return True
    if re.fullmatch(r"\d+(?:\.\d+)?\s*MIN\s*[-]?", value):
        return True
    return False


def is_vpa_like(value: str) -> bool:
    if is_blank(value):
        return True
    value = str(value).strip()
    return bool(
        re.fullmatch(r"[-+]?\d+(?:\.\d+)?\s*/\s*\d+(?:\.\d+)?", value)
        or re.fullmatch(r"[-+]?\d+(?:\.\d+)?", value)
    )


def is_nav_spec_like(value: str) -> bool:
    if is_blank(value):
        return True
    value = str(value).strip().upper()
    if re.search(r"\d", value) and "RNP" not in value and "RNAV" not in value and "GNSS" not in value and "APCH" not in value:
        return False
    return any(token in value for token in ["RNP", "RNAV", "GNSS", "APCH", "STAR", "SID"])


def validator_for_key(key: str):
    key = key.lower()
    if "waypoint_identifier" in key or key == "ident":
        return is_waypoint_like
    if "path_descriptor" in key:
        return is_path_descriptor_like
    if "fly_over" in key:
        return is_fly_over_like
    if key.startswith("course"):
        return is_course_like
    if "turn_direction" in key or key == "turn":
        return is_turn_like
    if "altitude" in key:
        return is_altitude_like
    if "speed_limit" in key:
        return is_speed_like
    if "distance" in key or "tm_dst" in key or "dst_time" in key:
        return is_distance_like
    if "vpa" in key or "tch" in key or key == "va":
        return is_vpa_like
    if "nav_spec" in key or "navigation_specification" in key:
        return is_nav_spec_like
    return None


def main():
    with JSON_PATH.open("r", encoding="utf-8") as f:
        data = json.load(f)

    errors = []

    for proc in data:
        proc_name = proc.get("procedure_name", "UNKNOWN")
        headers = proc.get("column_headers", [])
        rows = proc.get("tabular_description", [])
        waypoints = proc.get("waypoints", [])

        procedure_str = json.dumps(proc).upper()
        for kw in FAS_KEYWORDS:
            if kw in procedure_str:
                errors.append(f"{proc_name}: FAS pollution detected (found '{kw}')")

        header_set = set(headers)
        waypoint_ids = {wp.get("waypoint_id") for wp in waypoints if wp.get("waypoint_id")}
        referenced_ids = set()

        for idx, row in enumerate(rows, start=1):
            row_keys = set(row.keys())
            if header_set and row_keys != header_set:
                errors.append(
                    f"{proc_name}: row {idx} keys do not match column_headers "
                    f"(row={sorted(row_keys)}, headers={sorted(header_set)})"
                )

            for key, value in row.items():
                check = validator_for_key(key)
                if check and not check(value):
                    errors.append(
                        f"{proc_name}: row {idx} field '{key}' has misplaced/non-conforming value '{value}'"
                    )

                if key.lower() == "waypoint_identifier" and not is_blank(value):
                    referenced_ids.add(str(value).strip().upper())

            # Cross-field leakage checks
            for key, value in row.items():
                if is_blank(value):
                    continue
                sval = str(value).strip()
                if "altitude" in key.lower() and is_course_like(sval):
                    errors.append(f"{proc_name}: row {idx} altitude-like column '{key}' contains course-like value '{value}'")
                if key.lower().startswith("course") and is_altitude_like(sval) and not is_course_like(sval):
                    errors.append(f"{proc_name}: row {idx} course-like column '{key}' contains altitude-like value '{value}'")
                if ("waypoint_identifier" in key.lower() or key.lower() == "ident") and not is_waypoint_like(sval):
                    errors.append(f"{proc_name}: row {idx} waypoint column '{key}' contains non-waypoint value '{value}'")

        for wid in sorted(referenced_ids):
            if wid not in waypoint_ids:
                errors.append(f"{proc_name}: waypoint '{wid}' appears in tabular data but is missing from waypoint table")

        if referenced_ids and waypoint_ids and not (referenced_ids & waypoint_ids):
            errors.append(f"{proc_name}: zero overlap between tabular waypoint identifiers and waypoint table IDs")

        for wp_idx, wp in enumerate(waypoints, start=1):
            wid = wp.get("waypoint_id")
            if not is_waypoint_like(wid):
                errors.append(f"{proc_name}: waypoint row {wp_idx} has invalid waypoint_id '{wid}'")
            raw = wp.get("coordinates_raw")
            if is_blank(raw):
                errors.append(f"{proc_name}: waypoint row {wp_idx} missing coordinates_raw")
            if wp.get("lat_dd") is None or wp.get("lon_dd") is None:
                errors.append(f"{proc_name}: waypoint row {wp_idx} missing decimal coordinates")

    if errors:
        print(f"ANOMALIES FOUND: {len(errors)}")
        for err in errors:
            print(" -", err)
    else:
        print("SUCCESS: schema-aligned validation passed; no misplaced data detected.")


if __name__ == "__main__":
    main()
