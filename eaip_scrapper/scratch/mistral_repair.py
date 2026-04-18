#!/usr/bin/env python3
"""
Mistral Repair Engine
---------------------
Reads the failed_extractions.json produced by global_validator.py,
maps each failed file back to its source PDF URL via master_aip_data.json,
calls Mistral OCR for each, converts the structured JSON response into a
unified Markdown format, and overwrites the defective file in extracted_data/.

Usage:
    uv run scratch/mistral_repair.py
"""

import os
import json
import re
import time
import requests
from pathlib import Path
from dotenv import load_dotenv
from mistralai.client import Mistral

load_dotenv()

# ── Paths ──────────────────────────────────────────────────────────────────────
MASTER_JSON   = Path("/Users/naveendevapalan/Desktop/Naveen/PROJECTS/eAIP/output/master_aip_data.json")
EXTRACTED_DIR = Path("/Users/naveendevapalan/Desktop/Naveen/PROJECTS/eAIP/eaip_scrapper/output/extracted_data")
FAILED_LOG    = Path("/Users/naveendevapalan/Desktop/Naveen/PROJECTS/eAIP/eaip_scrapper/scratch/failed_extractions.json")
REPAIR_LOG    = Path("/Users/naveendevapalan/Desktop/Naveen/PROJECTS/eAIP/eaip_scrapper/scratch/repair_log.json")

# Split-page files are handled by merge_split_files.py — but ONLY if
# the complementary half has the data this half is missing.
# FAS DATA BLOCK pages are ignored by the parser — skip them too.
FAS_KEYWORDS = ["operation type", "calculated crc", "fpap", "ltp/ftp latitude"]

def should_skip_file(filename: str, issue: str) -> tuple[bool, str]:
    """
    Determine if a failed file can be safely skipped.
    Returns (should_skip, reason).
    """
    # WAYPOINTS-only files are always handled by merge
    if "-WAYPOINTS.PDF.md" in filename:
        return True, "split WAYPOINTS file (handled by merge script)"

    # Check if this is a FAS-only page
    filepath = EXTRACTED_DIR / filename
    if is_fas_page(filepath):
        return True, "FAS DATA BLOCK page (ignored by parser)"

    # For -1/-2 split pages: only skip if the issue is structural
    # (MISSING_TABULAR or MISSING_WAYPOINT) AND the complement has the missing data
    if filename.endswith("-1.PDF.md") or filename.endswith("-2.PDF.md"):
        # Find complement
        if filename.endswith("-1.PDF.md"):
            complement = filename.replace("-1.PDF.md", "-2.PDF.md")
        else:
            complement = filename.replace("-2.PDF.md", "-1.PDF.md")

        complement_path = EXTRACTED_DIR / complement
        if complement_path.exists():
            # If the complement is just FAS, we CAN'T skip — merge won't recover
            if is_fas_page(complement_path):
                return False, ""

            # Structural splits where merging the two halves solves the issue
            if issue in ("MISSING_TABULAR_TABLE", "MISSING_WAYPOINT_TABLE", "MISSING_COORDINATES"):
                return True, "split-page file (complement has missing data)"

    return False, ""

def is_fas_page(filepath: Path) -> bool:
    """Returns True if the file is a FAS DATA BLOCK page (ignored by parser)."""
    if not filepath.exists():
        return False
    content = filepath.read_text(encoding='utf-8').lower()
    return sum(1 for kw in FAS_KEYWORDS if kw in content) >= 2

# ── Helpers ────────────────────────────────────────────────────────────────────

def build_url_map() -> dict[str, str]:
    """
    Returns a mapping: normalized_chart_name → pdf_url
    e.g. "VOMD-RNP-Y-RWY-09-CODING" → "https://aim-india.aai.aero/..."
    """
    with open(MASTER_JSON) as f:
        data = json.load(f)

    url_map: dict[str, str] = {}
    for entry in data:
        for key in ["charts", "charts_related_to_aerodrome"]:
            for chart in entry.get(key, []):
                name = chart.get("chart_name", "").strip().upper()
                url  = chart.get("pdf_url", "").strip()
                if "RNP" in name and ("CODING" in name or "WAYPOINTS" in name) and url:
                    # Normalize to match filename style: spaces → underscores → hyphens
                    norm = re.sub(r"[\s_/]+", "-", name)
                    url_map[norm] = url
    return url_map


def filename_to_key(filename: str) -> str:
    """
    Convert a filename like VOMD-RNP-Y-RWY-09-CODING.PDF.md
    to a lookup key like VOMD-RNP-Y-RWY-09-CODING
    Strips -1 / -2 suffixes because those are split pages of the same PDF.
    """
    stem = filename.replace(".PDF.md", "").replace(".md", "")
    # Remove trailing -1 or -2 split-page suffixes
    stem = re.sub(r"-[12]$", "", stem)
    return stem.upper()


def mistral_ocr(pdf_url: str, client: Mistral) -> dict | None:
    """Call Mistral OCR and return the raw response dict."""
    try:
        response = client.ocr.process(
            model="mistral-ocr-latest",
            document={"type": "document_url", "document_url": pdf_url},
            table_format="html",
        )
        return response
    except Exception as exc:
        print(f"    [Mistral ERROR] {exc}")
        return None


def mistral_response_to_markdown(response) -> str:
    """
    Converts a Mistral OCR response object to unified Markdown.

    Strategy:
      - For each page, take page.markdown as the base text.
      - Replace each `[tbl-X.html](tbl-X.html)` placeholder with the
        actual HTML table content from page.tables.
    """
    parts: list[str] = []

    for page in response.pages:
        md = page.markdown or ""

        # Build a lookup: table_id → html_content
        table_lookup: dict[str, str] = {}
        for tbl in (page.tables or []):
            table_lookup[tbl.id] = tbl.content

        # Replace placeholders like [tbl-0.html](tbl-0.html) with HTML content
        def replace_table(m):
            tbl_id = m.group(1)
            return table_lookup.get(tbl_id, f"<!-- Table {tbl_id} not found -->")

        md = re.sub(r"\[([^\]]+\.html)\]\([^\)]+\)", replace_table, md)
        parts.append(md)

    return "\n\n---\n\n".join(parts)


def repair_file(failed_entry: dict, url_map: dict[str, str], client: Mistral) -> bool:
    filename = failed_entry["file"]
    output_path = EXTRACTED_DIR / filename

    skip, reason = should_skip_file(filename, failed_entry.get("issue", ""))
    if skip:
        print(f"  [SKIP] {filename} — {reason}.")
        return True

    key = filename_to_key(filename)

    # Direct match first
    url = url_map.get(key)

    # Fuzzy match: strip trailing -CODING suffix variants
    if not url:
        for map_key, map_url in url_map.items():
            if key in map_key or map_key in key:
                url = map_url
                break

    if not url:
        print(f"  [NO URL] Could not find PDF URL for: {filename}  (key={key})")
        return False

    print(f"  [OCR] Repairing: {filename}")
    print(f"          URL: {url}")

    response = mistral_ocr(url, client)
    if not response:
        return False

    md = mistral_response_to_markdown(response)
    if not md.strip():
        print(f"    [WARN] Empty markdown from Mistral for {filename}")
        return False

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(md)

    print(f"    [SAVED] {output_path}")
    return True


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    api_key = os.environ.get("MISTRAL_API_KEY")
    if not api_key:
        raise ValueError("MISTRAL_API_KEY not found. Check your .env file.")

    with open(FAILED_LOG) as f:
        failures: list[dict] = json.load(f)

    print(f"Failures to repair: {len(failures)}")

    url_map = build_url_map()
    print(f"URL map entries  : {len(url_map)}")

    client = Mistral(api_key=api_key)
    repair_results: list[dict] = []

    for i, entry in enumerate(failures, 1):
        filename = entry["file"]
        print(f"\n[{i}/{len(failures)}] {filename}  ({entry['issue'].split(':')[0]})")

        success = repair_file(entry, url_map, client)
        repair_results.append({"file": filename, "repaired": success})

        # Brief pause to avoid rate-limiting
        time.sleep(0.5)

    # Save repair log
    with open(REPAIR_LOG, "w") as f:
        json.dump(repair_results, f, indent=4)

    repaired = sum(1 for r in repair_results if r["repaired"])
    print(f"\nRepair pass complete. {repaired}/{len(failures)} files repaired.")
    print(f"Repair log saved to: {REPAIR_LOG}")
    print("\nNext step: run global_validator.py again to verify.")


if __name__ == "__main__":
    main()
