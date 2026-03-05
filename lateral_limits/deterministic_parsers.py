"""
Deterministic (regex-based) parsers for lateral limits text.

These handle the ~60-70% of entries that can be parsed with 100% accuracy
without an LLM:

  1. Circles       → "circle/circular...radius...centered at"
  2. Bounding boxes → "bounded by X to Y and X to Y"
  3. Annular rings  → "between X NM and Y NM radius"
  4. Simple polygons → entries with ONLY coordinate lists (no arcs, no borders)
"""

from __future__ import annotations

import re
from typing import Optional

from .dms_parser import parse_dms_pair, extract_all_coordinates
from .models import (
    CircularAirspace,
    BoundingBoxAirspace,
    AnnularRingAirspace,
    SimplePolygonAirspace,
    AirspaceGeometry,
)


# ---------------------------------------------------------------------------
# Pattern detection helpers
# ---------------------------------------------------------------------------

def _has_arc_language(text: str) -> bool:
    """Check if text contains arc/curve language requiring LLM."""
    arc_patterns = [
        r"(?:clockwise|counter[\s-]?clockwise)\s+arc",
        r"arc\s+of\s+(?:a\s+)?circle",
        r"along\s+(?:the\s+)?(?:clockwise|counter)",
        r"sector\s+of\s+circle",
        r"azimuth\s+angle",
    ]
    for pat in arc_patterns:
        if re.search(pat, text, re.IGNORECASE):
            return True
    return False


def _has_topological_language(text: str) -> bool:
    """Check if text contains border/boundary language requiring LLM."""
    border_patterns = [
        r"international\s+bound",
        r"Indo[\s-](?:Pakistan|Nepal|Bangladesh|China|Myanmar|Bhutan)",
        r"border\s+(?:of|with)\s+",
        r"line\s+of\s+(?:actual\s+)?control",
        r"along\s+(?:the\s+)?(?:coast|river|boundary|border)",
        r"FIR\s+boundary",
        r"(?:geographical|geopolitical)\s+boundar",
        r"territorial\s+waters",
    ]
    for pat in border_patterns:
        if re.search(pat, text, re.IGNORECASE):
            return True
    return False


def _has_exclusion_language(text: str) -> bool:
    """Check if text excludes sub-areas requiring complex handling."""
    return bool(re.search(r"exclud(?:ing|ed)\s+(?:the\s+)?(?:airspace|portions?|area)",
                          text, re.IGNORECASE))


# ---------------------------------------------------------------------------
# Pattern: CIRCLE
# ---------------------------------------------------------------------------

_CIRCLE_RADIUS_CENTER = re.compile(
    r"(?:circle|circular)\s+(?:area\s+)?(?:of\s+)?radius\s+"
    r"(\d+(?:\.\d+)?)\s*(NM|KM|nm|km)\s+"
    r"(?:centered?|centred?)\s+(?:at|on)\s+"
    r"(\d+(?:\.\d+)?[NS]\s+\d+(?:\.\d+)?[EW])",
    re.IGNORECASE,
)

_CIRCLE_CENTER_RADIUS = re.compile(
    r"(?:circle|circular)\s+(?:area\s+)?(?:centered?|centred?)\s+(?:at|on)\s+"
    r"(\d+(?:\.\d+)?[NS]\s+\d+(?:\.\d+)?[EW])\s+"
    r"(?:within|with)\s+(?:a\s+)?(\d+(?:\.\d+)?)\s*(NM|KM|nm|km)?\s*radius",
    re.IGNORECASE,
)

_CIRCLE_BOUNDED_CENTER_RADIUS = re.compile(
    r"(?:bounded\s+by\s+)?(?:a\s+)?(?:circle|circular)\s+(?:area\s+)?(?:of\s+)?radius\s+"
    r"(\d+(?:\.\d+)?)\s*(NM|KM|nm|km)\s+"
    r"(?:centered?|centred?)\s+(?:at|on)\s+"
    r"(\d+(?:\.\d+)?[NS]\s+\d+(?:\.\d+)?[EW])",
    re.IGNORECASE,
)

_CIRCLE_BOUNDED_BY = re.compile(
    r"Area\s+bounded\s+by\s+(?:a\s+)?circle\s+of\s+radius\s+"
    r"(\d+(?:\.\d+)?)\s*(NM|KM|nm|km)\s+"
    r"(?:centered?|centred?)\s+(?:at|on)\s+"
    r"(\d+(?:\.\d+)?[NS]\s+\d+(?:\.\d+)?[EW])",
    re.IGNORECASE,
)


def parse_circle(text: str) -> Optional[CircularAirspace]:
    """Try to parse a circular airspace from text. Returns None if not a circle."""
    if _has_arc_language(text) or _has_topological_language(text):
        return None

    for pattern in [_CIRCLE_BOUNDED_BY, _CIRCLE_RADIUS_CENTER, _CIRCLE_BOUNDED_CENTER_RADIUS]:
        m = pattern.search(text)
        if m:
            groups = m.groups()
            if len(groups) == 3:
                if pattern == _CIRCLE_CENTER_RADIUS:
                    coord_str, radius_str, unit_str = groups
                else:
                    radius_str, unit_str, coord_str = groups

                coord = parse_dms_pair(coord_str)
                if coord is None:
                    continue

                unit = (unit_str or "NM").upper()
                if unit not in ("NM", "KM"):
                    unit = "NM"

                return CircularAirspace(
                    center=coord,
                    radius_value=float(radius_str),
                    radius_unit=unit,
                )

    m = _CIRCLE_CENTER_RADIUS.search(text)
    if m:
        coord_str, radius_str, unit_str = m.groups()
        coord = parse_dms_pair(coord_str)
        if coord:
            unit = (unit_str or "NM").upper()
            if unit not in ("NM", "KM"):
                unit = "NM"
            return CircularAirspace(
                center=coord,
                radius_value=float(radius_str),
                radius_unit=unit,
            )

    return None


# ---------------------------------------------------------------------------
# Pattern: BOUNDING BOX
# ---------------------------------------------------------------------------

_BOUNDING_BOX = re.compile(
    r"(?:Area\s+)?bounded\s+by\s+"
    r"(\d+(?:\.\d+)?[NS])\s+to\s+(\d+(?:\.\d+)?[NS])\s+"
    r"and\s+"
    r"(\d+(?:\.\d+)?[EW])\s+to\s+(\d+(?:\.\d+)?[EW])",
    re.IGNORECASE,
)


def parse_bounding_box(text: str) -> Optional[BoundingBoxAirspace]:
    """Try to parse a bounding-box airspace. Returns None if not a bounding box."""
    m = _BOUNDING_BOX.search(text)
    if not m:
        return None

    lat1_str, lat2_str, lng1_str, lng2_str = m.groups()

    from .dms_parser import _parse_single_component, _COORD_TOKEN

    def parse_one(s: str) -> Optional[float]:
        tok = _COORD_TOKEN.match(s)
        if not tok:
            return None
        return _parse_single_component(tok.group(1), tok.group(2))

    lat1 = parse_one(lat1_str)
    lat2 = parse_one(lat2_str)
    lng1 = parse_one(lng1_str)
    lng2 = parse_one(lng2_str)

    if any(v is None for v in [lat1, lat2, lng1, lng2]):
        return None

    lat_south = min(lat1, lat2)
    lat_north = max(lat1, lat2)
    lng_west = min(lng1, lng2)
    lng_east = max(lng1, lng2)

    try:
        return BoundingBoxAirspace(
            lat_south=lat_south,
            lat_north=lat_north,
            lng_west=lng_west,
            lng_east=lng_east,
        )
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# Pattern: ANNULAR RING
# ---------------------------------------------------------------------------

_ANNULAR_RING = re.compile(
    r"(?:contained\s+)?between\s+"
    r"(\d+(?:\.\d+)?)\s*(NM|KM)?\s+"
    r"and\s+"
    r"(\d+(?:\.\d+)?)\s*(NM|KM)?\s+"
    r"radius\s+"
    r"(?:centered?|centred?)\s+(?:at|on)\s+"
    r"(\d+(?:\.\d+)?[NS]\s+\d+(?:\.\d+)?[EW])",
    re.IGNORECASE,
)


def parse_annular_ring(text: str) -> Optional[AnnularRingAirspace]:
    """Try to parse an annular ring airspace. Returns None if not an annular ring."""
    m = _ANNULAR_RING.search(text)
    if not m:
        return None

    r1_str, u1_str, r2_str, u2_str, coord_str = m.groups()
    coord = parse_dms_pair(coord_str)
    if coord is None:
        return None

    r1 = float(r1_str)
    r2 = float(r2_str)
    unit = (u1_str or u2_str or "NM").upper()
    if unit not in ("NM", "KM"):
        unit = "NM"

    try:
        return AnnularRingAirspace(
            center=coord,
            inner_radius_value=min(r1, r2),
            outer_radius_value=max(r1, r2),
            radius_unit=unit,
        )
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# Pattern: SIMPLE POLYGON
# ---------------------------------------------------------------------------

def parse_simple_polygon(text: str) -> Optional[SimplePolygonAirspace]:
    """Try to parse a simple polygon (only straight-line edges)."""
    if _has_arc_language(text) or _has_topological_language(text):
        return None

    coords = extract_all_coordinates(text)

    if len(coords) < 3:
        return None

    try:
        return SimplePolygonAirspace(coordinates=coords)
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# Classifier
# ---------------------------------------------------------------------------

def classify_and_parse(text: str) -> tuple[str, Optional[AirspaceGeometry]]:
    """Classify a lateral_limits text and attempt deterministic parsing."""
    clean = text.replace("\n", " ").strip()

    result = parse_circle(clean)
    if result is not None:
        return ("circle", result)

    result = parse_bounding_box(clean)
    if result is not None:
        return ("bounding_box", result)

    result = parse_annular_ring(clean)
    if result is not None:
        return ("annular_ring", result)

    if _has_arc_language(clean) or _has_topological_language(clean):
        return ("complex", None)

    result = parse_simple_polygon(clean)
    if result is not None:
        return ("simple_polygon", result)

    return ("complex", None)
