#!/usr/bin/env python
# ruff: noqa: E402
import argparse
import json
import logging
import os
import re
import sys
from collections import defaultdict
from pathlib import Path

from bs4 import BeautifulSoup

# Add src to path for absolute imports
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.append(str(BASE_DIR / "src"))

from eaip_scrapper.rnp_processor.utils import get_s3_client, sanitize_header

# Setup localized logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("extract_headers")


def extract_table_headers(table):
    """
    Extracts candidate header rows from a table.
    Heuristics:
    1. Rows containing <th> elements.
    2. First 3 rows containing <td> elements that:
       - Contain at least one standard header keyword (to prevent data rows from matching).
       - Do not look like data rows (no coordinates).
       - Are not purely unit rows (e.g. ft, kt, nm, °, including variations in parentheses).
       - Have at least 2 non-empty cells.
    """
    rows = table.find_all("tr")
    header_rows = []

    # Known header keywords (lowercase)
    header_keywords = [
        "serial",
        "path",
        "waypoint",
        "fix",
        "seq",
        "descriptor",
        "terminator",
        "course",
        "altitude",
        "turn",
        "speed",
        "vpa",
        "tch",
        "navigation",
        "identifier",
        "latitude",
        "longitude",
        "wgs84",
        "role",
        "function",
        "coordinate",
        "coordinates",
        "nav",
        "spec",
        "fly",
        "ident",
        "terminator",
    ]

    for idx, row in enumerate(rows):
        # 1. <th> elements
        th_cells = row.find_all("th")
        if th_cells:
            header_rows.append((idx, [c.get_text(strip=True) for c in th_cells]))
            continue

        # 2. <td> candidate rows in the first 3 rows
        if idx < 3:
            td_cells = row.find_all("td")
            if not td_cells:
                continue

            # Skip single-cell title spans
            try:
                colspan = int(td_cells[0].get("colspan", 1))
            except (ValueError, TypeError):
                colspan = 1
            if len(td_cells) == 1 and colspan > 3:
                continue

            texts = [c.get_text(strip=True) for c in td_cells]

            # Build cleaned lowercase string of the whole row
            row_text = " ".join(t.lower() for t in texts if t)

            # Heuristic: Must contain at least one header keyword
            has_keyword = any(kw in row_text for kw in header_keywords)
            if not has_keyword:
                continue

            # Heuristic: Check if this contains coordinate data
            is_data = False
            for text in texts:
                if not text:
                    continue
                # Coordinate formats
                if re.search(r"\d{2}:\d{2}", text) or re.search(r"\d{6}[NS]", text):
                    is_data = True
                    break

            if is_data:
                continue

            # Heuristic: Check if it is a unit row (strip parentheses first)
            is_unit_row = all(
                re.sub(r"[()]+", "", t.lower().strip())
                in (
                    "",
                    "ft",
                    "kt",
                    "nm",
                    "°/ft",
                    "min",
                    "mag",
                    "true",
                    "deg",
                    "degree",
                    "degrees",
                    "°",
                )
                for t in texts
            )
            if is_unit_row:
                continue

            # Heuristic: Need at least 2 non-empty elements to be a valid header row
            non_empty = [t for t in texts if t.strip()]
            if len(non_empty) < 2:
                continue

            header_rows.append((idx, texts))

    return header_rows


def main():
    parser = argparse.ArgumentParser(
        description="Extract table headers from all merged charts in MinIO."
    )
    parser.add_argument(
        "--limit", type=int, help="Limit the number of files scanned for quick testing"
    )
    args = parser.parse_args()

    s3_client = get_s3_client()
    bucket = os.getenv("MINIO_BUCKET", "ais")
    prefix = "output/rnp/merged_data/"

    logger.info(f"Listing merged files in MinIO bucket '{bucket}' under prefix '{prefix}'...")
    try:
        response = s3_client.list_objects_v2(Bucket=bucket, Prefix=prefix)
    except Exception as e:
        logger.error(f"Failed to connect to MinIO/S3: {e}")
        sys.exit(1)

    merged_keys = [obj["Key"] for obj in response.get("Contents", []) if obj["Key"].endswith(".md")]
    merged_keys.sort()

    if args.limit:
        merged_keys = merged_keys[: args.limit]
        logger.info(f"Limiting scan to the first {args.limit} files.")

    logger.info(f"Scanning {len(merged_keys)} merged markdown files...")

    # Statistics dictionaries
    # raw_header -> count
    header_counts = defaultdict(int)
    # raw_header -> list of (file, sanitized_name)
    header_info = defaultdict(list)

    for key_idx, key in enumerate(merged_keys):
        filename = os.path.basename(key)
        logger.info(f"[{key_idx + 1}/{len(merged_keys)}] Processing {filename}...")

        try:
            obj_resp = s3_client.get_object(Bucket=bucket, Key=key)
            content = obj_resp["Body"].read().decode("utf-8")
        except Exception as e:
            logger.error(f"Failed to download {key}: {e}")
            continue

        soup = BeautifulSoup(content, "html.parser")
        tables = soup.find_all("table")

        for _t_idx, table in enumerate(tables):
            header_rows = extract_table_headers(table)
            for _r_idx, row_cells in header_rows:
                for _col_idx, cell_text in enumerate(row_cells):
                    raw_val = cell_text.strip()
                    if not raw_val:
                        continue

                    # Sanitize the header using standard logic
                    sanitized_val = sanitize_header(raw_val)

                    header_counts[raw_val] += 1
                    # Track mapping and source (limit sample files list to 5 to avoid blow up)
                    sources = header_info[raw_val]
                    if len(sources) < 5 and not any(s[0] == filename for s in sources):
                        sources.append((filename, sanitized_val))

    # Compile the final statistics
    headers_summary = []
    for raw_h, count in sorted(header_counts.items(), key=lambda item: item[1], reverse=True):
        sources = header_info[raw_h]
        sanitized = sources[0][1] if sources else "unknown"
        sample_files = [s[0] for s in sources]
        headers_summary.append(
            {
                "raw_header": raw_h,
                "count": count,
                "sanitized_name": sanitized,
                "sample_files": sample_files,
            }
        )

    # Save to scratch folder in workspace
    scratch_dir = BASE_DIR / "scratch"
    scratch_dir.mkdir(parents=True, exist_ok=True)

    json_path = scratch_dir / "headers_report.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(headers_summary, f, indent=2, ensure_ascii=False)
    logger.info(f"Saved JSON report to {json_path}")

    # Generate Markdown Report
    md_path = scratch_dir / "headers_report.md"
    with open(md_path, "w", encoding="utf-8") as f:
        f.write("# RNP Chart Table Headers Analysis Report\n\n")
        f.write(f"Total Unique Raw Headers Found: {len(headers_summary)}\n\n")

        # Section 1: Unknown Headers (Gaps)
        unknown_headers = [h for h in headers_summary if h["sanitized_name"] == "unknown"]
        f.write("## ⚠️ Headers Mapping to 'unknown'\n")
        f.write(
            "These headers do not match any rules in `sanitize_header` and might contain missing data.\n\n"
        )
        if unknown_headers:
            f.write("| Raw Header | Count | Sample Files |\n")
            f.write("|---|---|---|\n")
            for h in unknown_headers:
                sample_list = h["sample_files"]
                samples = (
                    ", ".join(str(s) for s in sample_list) if isinstance(sample_list, list) else ""
                )
                f.write(f"| `{h['raw_header']}` | {h['count']} | {samples} |\n")
        else:
            f.write("*None found! All headers matched standard rules.*\n")
        f.write("\n---\n\n")

        # Section 2: Full List of Mappings
        f.write("## 📋 All Table Headers and Mappings\n")
        f.write("Sorted by occurrence count.\n\n")
        f.write("| Raw Header | Count | Sanitized Key | Sample Files |\n")
        f.write("|---|---|---|---|\n")
        for h in headers_summary:
            sample_list = h["sample_files"]
            samples = (
                ", ".join(str(s) for s in sample_list) if isinstance(sample_list, list) else ""
            )
            f.write(
                f"| `{h['raw_header']}` | {h['count']} | `{h['sanitized_name']}` | {samples} |\n"
            )

    logger.info(f"Saved Markdown report to {md_path}")
    logger.info("Done extracting headers!")


if __name__ == "__main__":
    main()
