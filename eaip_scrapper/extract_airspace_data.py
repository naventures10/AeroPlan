#!/usr/bin/env python3
"""
Extract airspace name, lateral limits, and vertical limits from eAIP JSON files,
categorize by airspace type, and produce a combined structured JSON output.

Sources:
  - ENR 2.1: FIR, UIR, TMA, CTA
  - ENR 2.2: Other Regulated Airspace (ATZ, CTR)
  - ENR 5.1: Prohibited, Restricted, Danger Areas
  - ENR 5.2: Military Exercise/Training Areas (TRA, TSA) and ADIZ
"""

import json
import os
import re
from datetime import datetime, timezone


# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(BASE_DIR, "output")

INPUT_FILES = {
    "ENR 2.1": os.path.join(OUTPUT_DIR, "enr_2_1_airspace.json"),
    "ENR 2.2": os.path.join(OUTPUT_DIR, "enr_2_2_other_regulated_airspace.json"),
    "ENR 5.1": os.path.join(OUTPUT_DIR, "enr_5_1_prohibited_restricted_danger.json"),
    "ENR 5.2": os.path.join(OUTPUT_DIR, "enr_5_2_military_exercise_adiz.json"),
}

OUTPUT_FILE = os.path.join(OUTPUT_DIR, "combined_airspace_data.json")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _clean(text: str) -> str:
    """Strip and collapse excessive whitespace while preserving newlines."""
    if not text:
        return ""
    return text.strip()


def _extract_vertical_limits(text: str):
    """
    Try to pull an upper/lower vertical limit pair from a text blob.
    Common patterns:
        UNL / GND
        FL 460 / FL 255
        FL 155/4 000 ft AMSL
    Returns (upper, lower) or (None, None).
    """
    # Look for patterns like  "FL 460 / FL 255"  or  "UNL / GND"
    pattern = re.compile(
        r"(UNL|FL\s*\d+|[\d,]+\s*(?:FT|ft)\s*(?:AMSL|AGL|MSL)?)\s*/\s*"
        r"(UNL|FL\s*\d+|GND|MSL|[\d,]+\s*(?:FT|ft)\s*(?:AMSL|AGL|MSL)?)",
        re.IGNORECASE,
    )
    m = pattern.search(text)
    if m:
        return _clean(m.group(1)), _clean(m.group(2))
    return None, None


def _make_entry(name, airspace_type, lateral_limits, upper_limit, lower_limit, source):
    """Build a normalized airspace entry dict."""
    return {
        "name": _clean(name),
        "type": airspace_type,
        "lateral_limits": _clean(lateral_limits),
        "upper_limit": _clean(upper_limit) if upper_limit else "",
        "lower_limit": _clean(lower_limit) if lower_limit else "",
        "source": source,
    }


# ---------------------------------------------------------------------------
# ENR 2.1 — FIR, UIR, TMA, CTA
# ---------------------------------------------------------------------------
def _parse_name_and_limits_blob(blob: str):
    """
    Parse the combined 'name_and_limits' blob from ENR 2.1.
    First line = name.
    Everything between the name and the first vertical-limit line = lateral limits.
    Lines after the vertical-limit line (e.g. airspace classification) are excluded.
    """
    lines = [l.strip() for l in blob.split("\n") if l.strip()]
    if not lines:
        return "", "", "", ""

    # --- Name: first line ---
    name = lines[0]

    # --- Scan from line 1 onward to find the vertical limit line ---
    # We collect everything BEFORE the first vertical-limit match as lateral limits.
    # Lines AFTER the vertical limit (airspace class notes etc.) are dropped.
    upper, lower = None, None
    limit_line_idx = None

    for i, line in enumerate(lines[1:], start=1):
        u, l = _extract_vertical_limits(line)
        if u:
            upper = u
            lower = l
            limit_line_idx = i
            break

    # Lateral limits = all lines between name and the vertical-limit line
    if limit_line_idx is not None:
        lateral_parts = lines[1:limit_line_idx]
    else:
        # No vertical limit found — treat all remaining lines as lateral
        # but exclude lines that look like airspace classification notes
        lateral_parts = []
        for line in lines[1:]:
            low = line.lower()
            if low.startswith("•") or "airspace" in low and "classified" in low:
                continue
            lateral_parts.append(line)

    lateral_limits = "\n".join(lateral_parts) if lateral_parts else ""

    return name, lateral_limits, upper or "", lower or ""


def _classify_enr21_type(name: str, section_key: str) -> str:
    """Determine the airspace sub-type from ENR 2.1 based on name and section."""
    lower = name.lower()
    if section_key == "flight_information_regions":
        if "sub fir" in lower:
            return "Sub-FIR"
        return "FIR"
    # control_areas
    if (
        "upper control area" in lower
        or "upper acc" in lower
        or "udp" in lower
        or "sector u" in lower.replace("sector upper", "sector u")
    ):
        return "Upper CTA"
    if "control area" in lower or "cta" in lower:
        return "CTA"
    if "tma" in lower:
        return "TMA"
    return "CTA"


def parse_enr_2_1(data: dict) -> list:
    """Parse ENR 2.1 data and return normalized entries."""
    entries = []
    source = "ENR 2.1"

    for section_key in ("flight_information_regions", "control_areas"):
        items = data.get(section_key, [])
        for item in items:
            blob = item.get("name_and_limits", "")
            name, lateral, upper, lower = _parse_name_and_limits_blob(blob)
            airspace_type = _classify_enr21_type(name, section_key)
            entries.append(
                _make_entry(name, airspace_type, lateral, upper, lower, source)
            )

    return entries


# ---------------------------------------------------------------------------
# ENR 2.2 — Other Regulated Airspace
# ---------------------------------------------------------------------------
def parse_enr_2_2(data: dict) -> list:
    """Parse ENR 2.2 data and return normalized entries."""
    entries = []
    source = "ENR 2.2"

    for item in data.get("regulated_airspace", []):
        name = item.get("aerodrome", "")
        lateral = item.get("lateral_limits", "")
        upper = item.get("upper_limit", "")
        lower = "GND"  # ENR 2.2 items are surface-level airspace
        entries.append(
            _make_entry(name, "Regulated_Airspace", lateral, upper, lower, source)
        )

    return entries


# ---------------------------------------------------------------------------
# ENR 5.1 — Prohibited, Restricted, Danger Areas
# ---------------------------------------------------------------------------
def _classify_enr51_type(identification: str) -> str:
    """Determine P/R/D from the identification code."""
    ident_upper = identification.upper()
    if "P " in ident_upper or ident_upper.startswith("V") and "P" in ident_upper[:4]:
        # e.g. VOP 190, VIP 89
        for part in ident_upper.split():
            if "P" in part and not part.replace("P", "").isdigit():
                return "Prohibited"
    if "D " in ident_upper or ident_upper.startswith("V") and "D" in ident_upper[:4]:
        for part in ident_upper.split():
            if "D" in part and not part.replace("D", "").isdigit():
                return "Danger"
    if "R " in ident_upper or ident_upper.startswith("V") and "R" in ident_upper[:4]:
        for part in ident_upper.split():
            if "R" in part and not part.replace("R", "").isdigit():
                return "Restricted"

    # Fallback: pattern like VO(D), VA(P), VE(R), etc.
    # Or codes: VOP=Prohibited, VOR=Restricted, VOD=Danger, VID=Danger, VIP=Prohibited, VIR=Restricted, VER=Restricted
    code = ident_upper.replace(" ", "")
    if re.match(r"^V[A-Z]{1,2}P", code):
        return "Prohibited"
    if re.match(r"^V[A-Z]{1,2}D", code):
        return "Danger"
    if re.match(r"^V[A-Z]{1,2}R", code):
        return "Restricted"

    return "Restricted"  # safe default


def parse_enr_5_1(data: dict) -> list:
    """Parse ENR 5.1 data and return normalized entries."""
    entries = []
    source = "ENR 5.1"

    regions = data.get("regions", {})
    for region_name, items in regions.items():
        for item in items:
            identification = item.get("identification", "")
            name = item.get("name", "")
            lateral = item.get("lateral_limits", "")
            upper = item.get("upper_limit", "")
            lower = item.get("lower_limit", "")

            # Skip intentionally blank entries
            if not lateral and not name:
                continue

            display_name = (
                f"{identification} {name}".strip() if name else identification
            )
            airspace_type = _classify_enr51_type(identification)

            entry = _make_entry(
                display_name, airspace_type, lateral, upper, lower, source
            )
            entry["region"] = region_name
            entries.append(entry)

    return entries


# ---------------------------------------------------------------------------
# ENR 5.2 — Military Exercise / Training Areas and ADIZ
# ---------------------------------------------------------------------------
def _classify_enr52_type(name_field: str) -> str:
    """Classify TRA vs TSA from the name field."""
    upper = name_field.upper()
    if upper.startswith("TSA"):
        return "TSA"
    return "TRA"


def parse_enr_5_2(data: dict) -> list:
    """Parse ENR 5.2 data and return normalized entries."""
    entries = []
    source = "ENR 5.2"

    # --- Military exercise and training areas (TRA / TSA) ---
    for item in data.get("military_exercise_and_training_areas", []):
        raw = item.get("name_and_lateral_limits", "")
        limits_raw = item.get("upper_lower_limits_and_system", "")

        # Split name | lateral limits
        parts = raw.split("|", 1)
        name = _clean(parts[0]) if parts else ""
        lateral = _clean(parts[1]) if len(parts) > 1 else ""

        # Parse vertical limits
        upper, lower = _extract_vertical_limits(limits_raw)
        if not upper:
            # Fallback: use the whole string
            upper = _clean(limits_raw)
            lower = ""

        airspace_type = _classify_enr52_type(name)
        entries.append(_make_entry(name, airspace_type, lateral, upper, lower, source))

    # --- ADIZ zones ---
    for item in data.get("air_defence_identification_zones_adiz", []):
        zone_name = item.get("zone_name", "")
        coords = item.get("zone_coordinates", "")
        entries.append(_make_entry(zone_name, "ADIZ", coords, "UNL", "GND", source))

    return entries


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    all_entries = []
    sources_used = []

    parsers = {
        "ENR 2.1": parse_enr_2_1,
        "ENR 2.2": parse_enr_2_2,
        "ENR 5.1": parse_enr_5_1,
        "ENR 5.2": parse_enr_5_2,
    }

    for source_label, filepath in INPUT_FILES.items():
        if not os.path.exists(filepath):
            print(f"⚠️  Skipping {source_label}: file not found at {filepath}")
            continue

        print(f"📄 Parsing {source_label}: {os.path.basename(filepath)}")
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)

        parser = parsers[source_label]
        entries = parser(data)
        print(f"   → Extracted {len(entries)} entries")
        all_entries.extend(entries)
        sources_used.append(source_label)

    # --- Categorize by type ---
    categories = {}
    for entry in all_entries:
        cat = entry["type"]
        categories.setdefault(cat, []).append(entry)

    # --- Build output ---
    output = {
        "metadata": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "sources": sources_used,
            "total_entries": len(all_entries),
            "category_counts": {k: len(v) for k, v in sorted(categories.items())},
        },
        "airspace_by_category": {k: v for k, v in sorted(categories.items())},
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"\n✅ Combined output written to: {OUTPUT_FILE}")
    print(f"   Total entries: {len(all_entries)}")
    print("   Breakdown by category:")
    for cat, items in sorted(categories.items()):
        print(f"     {cat}: {len(items)}")


if __name__ == "__main__":
    main()
