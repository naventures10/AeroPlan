"""Normalize chart / procedure names for cross-linking PDF charts to DB rows."""

import re
from urllib.parse import unquote, urlparse


def normalize_chart_key(text: str | None) -> str:
    """
    Uppercase, strip trailing .pdf, collapse separators (-, _, whitespace) to a
    single '-', and remove other noise so chart filenames match procedure names.
    """
    if not text:
        return ""

    s = text.strip()
    if not s:
        return ""

    parsed = urlparse(s)
    if parsed.scheme in ("http", "https") and parsed.path:
        s = unquote(parsed.path.rsplit("/", 1)[-1])
    elif "/" in s:
        s = s.rsplit("/", 1)[-1]

    s = s.upper()
    if s.endswith(".PDF"):
        s = s[:-4]

    s = re.sub(r"[_\s]+", "-", s)
    s = re.sub(r"-+", "-", s)

    # Strip common secondary chart suffixes so tables/coding charts match the base procedure
    for suffix in [
        "-CODING",
        "-TABLES",
        "-TABLE",
        "-CAT-A-B-C-D",
        "-CAT-A-B-C",
        "-CAT-A-B",
        "-FAS-DATA",
        "-PROFILE",
    ]:
        if suffix in s:
            s = s.replace(suffix, "")

    s = re.sub(r"-+", "-", s)
    s = s.strip("-")

    return s
