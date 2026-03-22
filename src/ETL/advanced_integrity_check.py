import sys
import re
from pathlib import Path
from sqlalchemy import create_engine, text
from collections import defaultdict

# Adjust path to import ETL modules
sys.path.append(str(Path(__file__).parent.parent))
from ETL.etl_notams import ChennaiLlamaParser

def advanced_verify():
    print("=" * 60)
    print("       ADVANCED NOTAM DATA INTEGRITY VALIDATOR")
    print("=" * 60)
    
    db_url = "postgresql://postgres:postgres@localhost:5432/aeronautical_information_system"
    engine = create_engine(db_url)
    
    output_dir = Path("/Users/naveendevapalan/Desktop/Naveen/PROJECTS/eAIP/eaip_scrapper/output")
    
    # Identify files - for now concentrating on Chennai
    check_files = sorted(list(output_dir.glob("Chennai_*.md")))
    if not check_files:
        print("[!] No source files found for verification.")
        return

    # Tracking dictionaries
    expected_by_airport = defaultdict(set)
    id_to_sources = defaultdict(set)

    print("\n[STEP 1] Re-Parsing Source Files for Ground Truth...")
    for fpath in check_files:
        # Use specialized parser (currently only Chennai)
        parser = ChennaiLlamaParser() 
        parsed_recs = parser.extract_from_md(fpath)
        
        for r in parsed_recs:
            icao = r["airport_icao"] or "FIR_SECTION"
            expected_by_airport[icao].add(r["notam_id"])
            id_to_sources[r["notam_id"]].add(fpath.name)

    all_expected_ids = set(id_to_sources.keys())
    print(f"  [+] Total unique NOTAMs parsed: {len(all_expected_ids)}")
    print(f"  [+] Total Airports/Sections found: {len(expected_by_airport)}")

    print("\n[STEP 2] Querying Database State...")
    db_records = defaultdict(set)
    actual_all_ids = set()
    
    with engine.connect() as conn:
        result = conn.execute(text("SELECT notam_id, airport_icao FROM notams"))
        for row in result:
            nid, icao = row[0], row[1] or "FIR_SECTION"
            db_records[icao].add(nid)
            actual_all_ids.add(nid)

    print(f"  [+] Total unique NOTAMs in DB: {len(actual_all_ids)}")

    print("\n[STEP 3] Integrity Intersection Audit...")
    
    overall_passed = True
    
    # 1. Global ID Presence Check
    missing_ids = all_expected_ids - actual_all_ids
    if missing_ids:
        print(f"  [✘] GLOBAL FAIL: {len(missing_ids)} NOTAMs missing from DB.")
        overall_passed = False
        for nid in sorted(missing_ids)[:5]:
            print(f"      - {nid} (Sources: {id_to_sources[nid]})")
    else:
        print("  [✔] Global ID Registry Check: PASS")

    # 2. Per-Airport Attribution Check
    print("\n  [AIRPORT ATTRIBUTION BREAKDOWN]")
    airports = sorted(expected_by_airport.keys())
    for icao in airports:
        expected = expected_by_airport[icao]
        actual = db_records[icao]
        
        # We check if the IDs we expected for THIS airport are assigned to THIS airport in DB
        missing_for_airport = expected - actual
        
        symbol = "✔" if not missing_for_airport else "✘"
        match_pc = 100.0 * len(expected - missing_for_airport) / len(expected)
        
        print(f"    [{symbol}] {icao:12}: {len(expected):3} expected | {match_pc:5.1f}% match")
        
        if missing_for_airport:
            overall_passed = False
            print(f"        Missing IDs: {', '.join(sorted(missing_for_airport))}")

    print("\n" + "=" * 60)
    if overall_passed:
        print("    FINAL RESULT: 100% DATA INTEGRITY VERIFIED")
    else:
        print("    FINAL RESULT: INTEGRITY AUDIT FAILED")
    print("=" * 60 + "\n")

if __name__ == "__main__":
    advanced_verify()
