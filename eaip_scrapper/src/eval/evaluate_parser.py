"""
Deterministic NOTAM Parser Evaluator
=====================================
Compares LlamaParse Markdown extraction against pdfplumber raw PDF ground truth
using regex pattern matching. Zero API calls, runs in under 1 second.
"""

import re
import argparse
import pdfplumber
from pathlib import Path
from collections import defaultdict

# Import existing ETL logic — reuse the same parsers and regex patterns
import sys
sys.path.append(str(Path(__file__).resolve().parent.parent))
from ETL.etl_notams import (
    NOTAMETL,
    NOTAM_ID_PATTERN,
    VALIDITY_PATTERN,
)


def extract_ground_truth_from_pdf(pdf_path: Path) -> dict:
    """
    Extract ground truth NOTAM data directly from the raw PDF using pdfplumber
    and the same VALIDITY_PATTERN regex used by the ETL parsers.

    Returns a dict: {notam_id: {"valid_from": str, "valid_to": str}}
    """
    raw_text = ""
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                raw_text += page_text + "\n"

    ground_truth = {}
    lines = raw_text.split("\n")

    # Join all lines into a flat stream and scan for NOTAM blocks
    full_text = " ".join(lines)

    # Find all NOTAM IDs and their positions
    id_matches = list(NOTAM_ID_PATTERN.finditer(full_text))

    for i, id_match in enumerate(id_matches):
        notam_id = id_match.group(1)

        # Define the search window: from this ID to the next ID (or end of text)
        start = id_match.end()
        end = id_matches[i + 1].start() if i + 1 < len(id_matches) else len(full_text)
        window = full_text[start:end]

        # Extract validity dates from the window
        v_match = VALIDITY_PATTERN.search(window)
        if v_match:
            ground_truth[notam_id] = {
                "valid_from": v_match.group(1).strip(),
                "valid_to": v_match.group(2).strip(),
            }

    return ground_truth


def normalize(value: str) -> str:
    """Normalize a date string for comparison."""
    if not value:
        return ""
    return re.sub(r"\s+", "", value).upper().strip()


def evaluate_document(pdf_path: Path, md_path: Path, etl: NOTAMETL) -> dict:
    """
    Evaluate a single PDF/MD pair by comparing ETL-parsed Markdown records
    against regex-extracted PDF ground truth.
    """
    # 1. Extract ground truth from raw PDF
    ground_truth = extract_ground_truth_from_pdf(pdf_path)

    # 2. Parse Markdown using the existing ETL parser
    md_parser = etl.select_parser(md_path)
    parsed_records = md_parser.extract_from_md(md_path)

    results = {
        "file": md_path.name,
        "total_md_records": len(parsed_records),
        "total_pdf_records": len(ground_truth),
        "passed": [],
        "failed": [],
        "missing_in_pdf": [],
        "missing_in_md": [],
    }

    md_ids = set()

    for rec in parsed_records:
        notam_id = rec.get("notam_id")
        md_ids.add(notam_id)

        md_from = normalize(rec.get("valid_from_raw", ""))
        md_to = normalize(rec.get("valid_to_raw", ""))

        if notam_id not in ground_truth:
            results["missing_in_pdf"].append(notam_id)
            continue

        gt = ground_truth[notam_id]
        gt_from = normalize(gt["valid_from"])
        gt_to = normalize(gt["valid_to"])

        from_match = md_from == gt_from
        to_match = md_to == gt_to

        if from_match and to_match:
            results["passed"].append(notam_id)
        else:
            results["failed"].append({
                "notam_id": notam_id,
                "expected_from": gt_from,
                "actual_from": md_from,
                "from_match": from_match,
                "expected_to": gt_to,
                "actual_to": md_to,
                "to_match": to_match,
            })

    # Check for NOTAMs in PDF but missing from Markdown
    for gt_id in ground_truth:
        if gt_id not in md_ids:
            results["missing_in_md"].append(gt_id)

    return results


def print_results(all_results: list):
    """Print a comprehensive evaluation report."""
    total_passed = 0
    total_failed = 0
    total_missing_pdf = 0
    total_missing_md = 0
    total_md = 0
    total_pdf = 0
    all_failures = []

    print("\n" + "=" * 60)
    print("🎯 DETERMINISTIC EVALUATION RESULTS")
    print("=" * 60)

    for res in all_results:
        passed = len(res["passed"])
        failed = len(res["failed"])
        missing_pdf = len(res["missing_in_pdf"])
        missing_md = len(res["missing_in_md"])
        total = passed + failed

        total_passed += passed
        total_failed += failed
        total_missing_pdf += missing_pdf
        total_missing_md += missing_md
        total_md += res["total_md_records"]
        total_pdf += res["total_pdf_records"]

        rate = (passed / total * 100) if total > 0 else 0
        status = "✅" if failed == 0 else "⚠️"

        print(f"\n{status} {res['file']}")
        print(f"   Markdown NOTAMs: {res['total_md_records']}  |  PDF NOTAMs: {res['total_pdf_records']}")
        print(f"   Matched: {passed}/{total} ({rate:.1f}%)")

        if missing_pdf:
            print(f"   ⚠️  {missing_pdf} NOTAMs in MD but not found in PDF: {', '.join(res['missing_in_pdf'][:5])}{'...' if missing_pdf > 5 else ''}")
        if missing_md:
            print(f"   ⚠️  {missing_md} NOTAMs in PDF but not found in MD: {', '.join(res['missing_in_md'][:5])}{'...' if missing_md > 5 else ''}")

        if res["failed"]:
            for f in res["failed"]:
                all_failures.append({**f, "file": res["file"]})

    # Summary
    grand_total = total_passed + total_failed
    grand_rate = (total_passed / grand_total * 100) if grand_total > 0 else 0

    print("\n" + "=" * 60)
    print("📊 SUMMARY")
    print("=" * 60)
    print(f"   Documents evaluated:  {len(all_results)}")
    print(f"   Total MD NOTAMs:      {total_md}")
    print(f"   Total PDF NOTAMs:     {total_pdf}")
    print(f"   Compared:             {grand_total}")
    print(f"   ✅ Passed:             {total_passed} ({grand_rate:.1f}%)")
    print(f"   ❌ Failed:             {total_failed}")
    print(f"   ⚠️  Missing in PDF:    {total_missing_pdf}")
    print(f"   ⚠️  Missing in MD:     {total_missing_md}")

    # Detailed failure report
    if all_failures:
        print("\n" + "=" * 60)
        print("❌ FAILURE DETAILS")
        print("=" * 60)
        for f in all_failures:
            print(f"\n   NOTAM: {f['notam_id']}  ({f['file']})")
            if not f["from_match"]:
                print(f"     Valid From:  expected={f['expected_from']}  actual={f['actual_from']}")
            if not f["to_match"]:
                print(f"     Valid To:    expected={f['expected_to']}  actual={f['actual_to']}")
    else:
        print("\n   🎉 Zero hallucinations detected! LlamaParse extraction is perfect.")

    print("")


def main():
    parser = argparse.ArgumentParser(
        description="Deterministic NOTAM Parser Evaluator — Regex-based, zero API calls."
    )
    parser.add_argument("--pdf", required=False, help="Path to a specific PDF file.")
    parser.add_argument("--md", required=False, help="Path to a specific Markdown file.")
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Limit evaluation to N document pairs.",
    )
    args = parser.parse_args()

    OUTPUT_DIR = Path(__file__).resolve().parent.parent.parent / "output"
    RAW_PDF_DIR = OUTPUT_DIR / "raw_pdfs"

    files_to_eval = []
    if args.pdf and args.md:
        pdf_path = Path(args.pdf)
        md_path = Path(args.md)
        if pdf_path.exists() and md_path.exists():
            files_to_eval.append((pdf_path, md_path))
        else:
            print("[!] Input files not found!")
            return
    else:
        # Auto-discover all PDF/MD pairs
        for pdf_file in sorted(RAW_PDF_DIR.glob("*.pdf")):
            md_file = OUTPUT_DIR / pdf_file.name.replace(".pdf", ".md")
            if md_file.exists():
                files_to_eval.append((pdf_file, md_file))

        if not files_to_eval:
            print(f"[!] No PDF/MD pairs discovered in {RAW_PDF_DIR} / {OUTPUT_DIR}")
            return

        print(f"[*] Auto-discovered {len(files_to_eval)} document pairs to evaluate.")

    if args.limit:
        files_to_eval = files_to_eval[:args.limit]
        print(f"[*] Limiting to {args.limit} document pair(s).")

    # Use a dummy DB URL — we only need the parser selection logic
    etl = NOTAMETL("sqlite:///:memory:")

    all_results = []
    for pdf_path, md_path in files_to_eval:
        result = evaluate_document(pdf_path, md_path, etl)
        all_results.append(result)

    print_results(all_results)


if __name__ == "__main__":
    main()
