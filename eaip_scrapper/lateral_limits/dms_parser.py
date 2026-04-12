"""
DMS (Degrees-Minutes-Seconds) coordinate parser.

Handles all observed DGCA eAIP coordinate formats:
  - Full:        311959.3N 0785954.3E   (DDMMSS.sH DDDMMSS.sH)
  - Standard:    250000N 0760000E       (DDMMSSH DDdmmssh)
  - Abbreviated: 0958N 07600E           (DMMSSH or DDDMMH — fewer digits)
  - Compact:     0958N 0760130E         (mixed lengths)
"""

from __future__ import annotations

import re
from typing import Optional

from .models import Coordinate


# Regex for a single lat or lng token.
# Captures: digits (possibly with decimal), hemisphere letter.
_COORD_TOKEN = re.compile(r"(\d+(?:\.\d+)?)\s*([NSEWnsew])")


def _parse_single_component(digits: str, hemisphere: str) -> float:
    """Parse a single DMS component string into decimal degrees."""
    h = hemisphere.upper()
    is_longitude = h in ("E", "W")

    # Split off any decimal portion
    if "." in digits:
        whole_part, frac_part = digits.split(".", 1)
    else:
        whole_part = digits
        frac_part = ""

    length = len(whole_part)

    if is_longitude:
        if length >= 7:
            deg = int(whole_part[:3])
            mins = int(whole_part[3:5])
            secs_str = whole_part[5:]
        elif length == 6:
            deg = int(whole_part[:3])
            mins = int(whole_part[3:5])
            secs_str = whole_part[5:]
        elif length == 5:
            deg = int(whole_part[:3])
            mins = int(whole_part[3:5])
            secs_str = ""
        elif length <= 4:
            if length >= 3:
                deg = int(whole_part[:3])
                mins = int(whole_part[3:]) if length > 3 else 0
            else:
                deg = int(whole_part)
                mins = 0
            secs_str = ""
        else:
            deg = int(whole_part[:3])
            mins = int(whole_part[3:5]) if length > 3 else 0
            secs_str = whole_part[5:] if length > 5 else ""
    else:
        if length >= 6:
            deg = int(whole_part[:2])
            mins = int(whole_part[2:4])
            secs_str = whole_part[4:]
        elif length == 5:
            deg = int(whole_part[:2])
            mins = int(whole_part[2:4])
            secs_str = whole_part[4:]
        elif length == 4:
            deg = int(whole_part[:2])
            mins = int(whole_part[2:4])
            secs_str = ""
        elif length == 3:
            deg = int(whole_part[:1])
            mins = int(whole_part[1:3])
            secs_str = ""
        elif length <= 2:
            deg = int(whole_part)
            mins = 0
            secs_str = ""
        else:
            deg = int(whole_part[:2])
            mins = int(whole_part[2:4]) if length > 2 else 0
            secs_str = whole_part[4:] if length > 4 else ""

    # Parse seconds
    if secs_str or frac_part:
        full_secs = secs_str + ("." + frac_part if frac_part else "")
        secs = float(full_secs) if full_secs else 0.0
    else:
        secs = 0.0

    decimal = deg + mins / 60.0 + secs / 3600.0

    if h in ("S", "W"):
        decimal = -decimal

    return round(decimal, 8)


def parse_dms_pair(text: str) -> Optional[Coordinate]:
    """Extract a single lat/lng coordinate pair from a text fragment."""
    tokens = _COORD_TOKEN.findall(text)
    if len(tokens) < 2:
        return None

    lat_val = None
    lng_val = None

    for digits, hemi in tokens:
        h = hemi.upper()
        if h in ("N", "S"):
            if lat_val is None:
                lat_val = _parse_single_component(digits, h)
        elif h in ("E", "W"):
            if lng_val is None:
                lng_val = _parse_single_component(digits, h)

        if lat_val is not None and lng_val is not None:
            break

    if lat_val is None or lng_val is None:
        return None

    try:
        return Coordinate(lat=lat_val, lng=lng_val)
    except ValueError:
        return None


def extract_all_coordinates(text: str) -> list[Coordinate]:
    """Extract all coordinate pairs from a lateral limits text string."""
    tokens = _COORD_TOKEN.findall(text)
    coordinates: list[Coordinate] = []

    i = 0
    while i < len(tokens) - 1:
        digits1, hemi1 = tokens[i]
        digits2, hemi2 = tokens[i + 1]

        h1 = hemi1.upper()
        h2 = hemi2.upper()

        if h1 in ("N", "S") and h2 in ("E", "W"):
            lat = _parse_single_component(digits1, h1)
            lng = _parse_single_component(digits2, h2)
            try:
                coord = Coordinate(lat=lat, lng=lng)
                coordinates.append(coord)
            except ValueError:
                pass
            i += 2
        else:
            i += 1

    return coordinates
