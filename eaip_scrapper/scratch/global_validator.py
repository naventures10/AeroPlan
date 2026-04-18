#!/usr/bin/env python3
"""
Global Validator: Batch audits all extracted markdown files for data integrity.
A valid Waypoint ID must:
  - Be 3–6 characters long
  - Contain at least one uppercase letter AND at least one digit
  - Be composed only of alphanumeric characters
  - NOT be on the functional keyword blacklist
"""
import os
import re
import json
import glob
from bs4 import BeautifulSoup

EXTRACTED_DIR = "/Users/naveendevapalan/Desktop/Naveen/PROJECTS/eAIP/eaip_scrapper/output/extracted_data"
FAILED_LOG = "/Users/naveendevapalan/Desktop/Naveen/PROJECTS/eAIP/eaip_scrapper/scratch/failed_extractions.json"

# Functional keywords that must never be treated as a waypoint ID
BLACKLIST = {
    "IF", "TF", "CF", "DF", "HM", "CA", "RF", "CI", "FA",
    "IAF", "FAF", "MAPT", "MATF", "LTP", "FTP", "MAHF", "THR", "FAP",
    "LTP/FTP", "FAF/FAP", "IAF/MAHF", "MATF/MAPT",
    "INITL", "INITR", "INITB", "FINAL", "MISAP", "BASE",
    "TURN", "ROLE", "OTHER", "TYPE", "IDENT", "COORD",
    "APCH", "RNAV", "RNAV1", "RNP", "RNP1", "GNSS",
    "OVER", "SPEC", "DESC", "CODE",
    # Time-based distance notations
    "1MIN", "2MIN", "3MIN",
}

# Patterns that should NEVER match a real waypoint ID
# (These would pass alphanumeric + has_letter + has_digit, but are not real IDs)
REJECT_PATTERNS = [
    re.compile(r'^FL\d+$'),     # FL80, FL110, FL245
    re.compile(r'^\dMIN$'),     # 1MIN, 2MIN
    re.compile(r'^RNP\d+$'),    # RNP1, RNP10
    re.compile(r'^RNAV\d+$'),   # RNAV1
]


def is_valid_wpt_id(s: str) -> bool:
    """
    A valid waypoint ID must:
    - Be between 3 and 6 characters long
    - Consist only of alphanumeric characters (no spaces, no /)
    - Contain at least one letter and at least one digit
      (e.g., RW26 ✓, KN413 ✓, 1MIN ✗, FL80 ✗, TURN ✗)
    - Not be on the functional keyword blacklist
    - Not match any known non-waypoint pattern
    """
    if not s:
        return False
    s = s.upper()
    if s in BLACKLIST:
        return False
    if not (3 <= len(s) <= 6):
        return False
    if not s.isalnum():
        return False
    for pattern in REJECT_PATTERNS:
        if pattern.match(s):
            return False
    has_letter = any(c.isalpha() for c in s)
    has_digit = any(c.isdigit() for c in s)
    # Reject if starts with a digit (time notations like 1MIN start with digit)
    if s[0].isdigit():
        return False
    return has_letter and has_digit


def extract_ids_from_sequence_table(soup) -> set:
    """
    Scans tables that look like a Tabular Description / sequence table
    and extracts valid waypoint IDs from the Waypoint Identifier column.
    """
    ids = set()
    for table in soup.find_all('table'):
        text_lower = table.get_text(separator=' ').lower()
        # Must look like a sequence table
        is_sequence = (
            "serial" in text_lower or
            "path" in text_lower or
            "descriptor" in text_lower or
            "terminator" in text_lower
        )
        if not is_sequence:
            continue
        # Skip FAS DATA BLOCK tables — they contain reference IDs like G27A, not waypoints.
        # "FAS" heading is outside the <table>, so detect by internal FAS-specific cell content.
        is_fas = ("operation type" in text_lower and "ltp/ftp" in text_lower)
        if is_fas:
            continue

        rows = table.find_all('tr')
        for row in rows:
            tds = row.find_all('td')
            ths = row.find_all('th')
            # Skip pure-header rows (section labels like "ANIRO 1", "VEMBO 1")
            if ths and not tds:
                continue
            # Skip section-header rows using td with large colspan (e.g., "DAGNI 1")
            if len(tds) == 1 and tds[0].get('colspan'):
                continue
            cells = [c.get_text(separator=' ', strip=True).upper() for c in tds]
            for cell in cells:
                cell_clean = re.sub(r'\s+', '', cell)  # remove internal spaces
                if is_valid_wpt_id(cell_clean):
                    # Normalize RWY -> RW
                    if cell_clean.startswith("RWY"):
                        cell_clean = "RW" + cell_clean[3:]
                    ids.add(cell_clean)
    return ids


def extract_ids_from_waypoint_table(soup) -> set:
    """
    Scans tables that look like a Waypoint Information / coordinate table
    and extracts valid waypoint IDs.

    Detection strategy:
      1. Header-based: table text contains "coordinate", "latitude", etc.
      2. Content-based fallback: table rows contain coordinate patterns
         like "N 13:46:26.46 E 79:47:08.80" — used for headerless tables
         (e.g., VOTP SID/STAR).
    """
    # Match any coordinate: "N 15:23:23.17 E 75:19:16.68" OR "17°42'10.23\"N 083°28'47.30\"E"
    # OR "09°50'01.42''N 078°04'51.03''E"
    COORD_PATTERN = re.compile(
        r'[NS]\s*\d{1,3}[\s:°\u00b0]'   # N/S + digits + separator
        r'|'
        r'\d{1,3}[\s°\u00b0].*[NS]',      # digits + separator ... N/S (alternate order)
        re.IGNORECASE
    )

    ids = set()
    for table in soup.find_all('table'):
        text_lower = table.get_text(separator=' ').lower()

        # Method 1: Header keywords
        is_waypoint_table = (
            "coordinate" in text_lower or
            "latitude" in text_lower or
            "longitude" in text_lower or
            "waypoint information" in text_lower or
            "waypoint list" in text_lower
        )

        # Method 2: Content fallback — check if any row contains coordinate data
        if not is_waypoint_table:
            sample_rows = table.find_all('tr')[:5]  # Check first 5 rows
            for row in sample_rows:
                row_text = row.get_text(separator=' ')
                if COORD_PATTERN.search(row_text):
                    is_waypoint_table = True
                    break

        if not is_waypoint_table:
            continue

        rows = table.find_all('tr')
        for row in rows:
            row_text = row.get_text(separator=' ')
            # CRITICAL: Only extract IDs from rows that ACTUALLY contain coordinate data.
            # This prevents the false-OK when tabular + waypoint sections share one <table>.
            if not COORD_PATTERN.search(row_text):
                continue
            cells = [c.get_text(separator=' ', strip=True).upper() for c in row.find_all(['td', 'th'])]
            for cell in cells:
                cell_clean = re.sub(r'\s+', '', cell)
                if is_valid_wpt_id(cell_clean):
                    if cell_clean.startswith("RWY"):
                        cell_clean = "RW" + cell_clean[3:]
                    ids.add(cell_clean)
    return ids


def validate_all():
    files = sorted(glob.glob(os.path.join(EXTRACTED_DIR, "*.md")))
    failures = []
    passed = 0

    for filepath in files:
        filename = os.path.basename(filepath)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        soup = BeautifulSoup(content, 'html.parser')

        tab_ids = extract_ids_from_sequence_table(soup)
        coord_ids = extract_ids_from_waypoint_table(soup)

        # Determine failure reason
        issue = None
        missing = set()

        if not tab_ids and not coord_ids:
            issue = "EMPTY_OR_UNSTRUCTURED"
        elif not tab_ids:
            issue = "MISSING_TABULAR_TABLE"
        elif not coord_ids:
            issue = "MISSING_WAYPOINT_TABLE"
        else:
            missing = tab_ids - coord_ids
            if missing:
                issue = f"MISSING_COORDINATES: {sorted(missing)}"

        if issue:
            entry = {
                "file": filename,
                "issue": issue,
                "missing_wpt_ids": sorted(missing),
                "tabular_ids_found": sorted(tab_ids),
                "coord_ids_found": sorted(coord_ids),
            }
            failures.append(entry)
            print(f"  FAILED [{issue.split(':')[0]}]: {filename}")
        else:
            passed += 1
            print(f"  OK: {filename}")

    # Save the failure list
    with open(FAILED_LOG, 'w', encoding='utf-8') as f:
        json.dump(failures, f, indent=4)

    print(f"\n{'='*60}")
    print(f"Audit Complete.")
    print(f"  Total Files : {len(files)}")
    print(f"  Passed      : {passed}")
    print(f"  Failed      : {len(failures)}")
    print(f"  Failure log : {FAILED_LOG}")

    if failures:
        print("\nFailure Summary:")
        for f in failures:
            print(f"  - {f['file']}: {f['issue']}")

    return failures


if __name__ == "__main__":
    validate_all()
