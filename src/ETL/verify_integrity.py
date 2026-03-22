import sys
import re
from pathlib import Path
from sqlalchemy import create_engine, text

# Adjust path to import ETL modules
sys.path.append(str(Path(__file__).parent.parent))
from ETL.etl_notams import ChennaiLlamaParser

def verify_integrity():
    db_url = "postgresql://postgres:postgres@localhost:5432/aeronautical_information_system"
    engine = create_engine(db_url)
    
    output_dir = Path("/Users/naveendevapalan/Desktop/Naveen/PROJECTS/eAIP/eaip_scrapper/output")
    chennai_files = [
        "Chennai_A_2026_01.md",
        "Chennai_A_2026_03.md",
        "Chennai_C_2026_01.md",
        "Chennai_C_2026_03.md"
    ]
    
    parser = ChennaiLlamaParser()
    expected_ids = set()
    file_stats = {}

    print("--- PARSING SOURCE MARKDOWN ---")
    for fname in chennai_files:
        fpath = output_dir / fname
        if not fpath.exists():
            print(f"[!] Warning: {fname} missing.")
            continue
            
        parser.records = []
        parsed_recs = parser.extract_from_md(fpath)
        ids = {r["notam_id"] for r in parsed_recs}
        expected_ids.update(ids)
        file_stats[fname] = len(ids)
        print(f"  {fname}: {len(ids)} NOTAMs found.")

    print(f"\nTotal unique IDs expected across all 4 files: {len(expected_ids)}")

    print("\n--- QUERYING DATABASE ---")
    with engine.connect() as conn:
        result = conn.execute(text("SELECT notam_id FROM notams"))
        actual_ids = {r[0] for r in result}

    print(f"Total unique IDs in database: {len(actual_ids)}")

    # Discrepancies
    missing_in_db = expected_ids - actual_ids
    extra_in_db = actual_ids - expected_ids # Could be from other non-Chennai files if they were loaded

    print("\n--- INTEGRITY RESULTS ---")
    if not missing_in_db:
        print("[SUCCESS] All NOTAMs extracted from Doctags are present in the database.")
    else:
        print(f"[FAILURE] {len(missing_in_db)} NOTAMs are MISSING from the database:")
        for nid in sorted(missing_in_db):
            print(f"  - {nid}")

    if extra_in_db:
        print(f"\n[NOTE] {len(extra_in_db)} records exist in DB but were not in these 4 Chennai files.")
        print("  (This is normal if you have already loaded Delhi, Mumbai, etc., or older data).")

    # Overall Metrics
    print("\n--- SUMMARY METRICS ---")
    print(f"  Expected: {len(expected_ids)}")
    print(f"  Actual:   {len(actual_ids.intersection(expected_ids))}")
    print(f"  Match:    {100.0 * len(actual_ids.intersection(expected_ids)) / len(expected_ids):.2f}%")

if __name__ == "__main__":
    verify_integrity()
