import os
import re
from pathlib import Path

# Configuration
EXTRACTED_DIR = Path("/Users/naveendevapalan/Desktop/Naveen/PROJECTS/eAIP/eaip_scrapper/output/extracted_data")

# Enhanced Coordinate Regex for LlamaCloud output (often lacks spaces or uses specific separators)
# Matches: N 13:11:23.04E 77:41:23.92 or N 13:11:23.04 E 77:41:23.92
COORD_REGEX = r'[NS]\s?\d{2,3}[:\d]\d{2}[:\d]\d{2}\.?\d*\s?[EW]\s?\d{2,3}[:\d]\d{2}[:\d]\d{2}\.?\d*'

def check_markdown_integrity(file_path):
    issues = []
    try:
        with open(file_path, "r") as f:
            content = f.read()
        
        # 1. Basic Structure Check (HTML table tags)
        if "<table>" not in content or "</table>" not in content:
            issues.append("No Markdown/HTML table tags found")
            return issues

        # 2. Section Check
        if "TABULAR" not in content.upper() and "WAYPOINT" not in content.upper():
            issues.append("Missing standard section headers (Tabular Description or Waypoint Information)")

        # 3. Coordinate Table Check
        # Waypoint info section should have coordinate patterns
        coords_found = re.findall(COORD_REGEX, content)
        if len(coords_found) < 3: # Most procedures have at least 3 waypoints
            issues.append(f"Low coordinate count ({len(coords_found)} found)")

        # 4. Mandatory Column Check (in the HTML table content)
        mandatory_headers = ["Serial", "Waypoint", "Course", "Distance"]
        missing_headers = [h for h in mandatory_headers if h.lower() not in content.lower()]
        if len(missing_headers) > 2: # Allow for some fuzzy naming
            issues.append(f"Evidence of missing columns: {', '.join(missing_headers)}")

    except Exception as e:
        issues.append(f"Processing error: {e}")
    
    return issues

def validate_all():
    files = list(EXTRACTED_DIR.glob("*.md"))
    
    print(f"Validating {len(files)} LlamaCloud Markdown files...")
    
    summary = {
        "total_files": len(files),
        "passed": 0,
        "failed_files": []
    }

    for f in files:
        issues = check_markdown_integrity(f)
        if issues:
            summary["failed_files"].append({"file": f.name, "issues": issues})
        else:
            summary["passed"] += 1

    return summary

if __name__ == "__main__":
    results = validate_all()
    print("\n--- RNP Extraction Integrity Report (LlamaCloud) ---")
    print(f"Total Charts: {results['total_files']}")
    print(f"Passed: {results['passed']}")
    print(f"Failed/Suspect: {len(results['failed_files'])}")
    
    if results["failed_files"]:
        print("\nDetails of Failures:")
        for failure in results["failed_files"]:
            print(f"  - {failure['file']}: {', '.join(failure['issues'])}")
