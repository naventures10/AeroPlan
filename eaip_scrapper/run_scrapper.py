import concurrent.futures

import requests
import urllib3
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from eaip_scrapper.scrapper.core.airac_resolver import AIRACResolver
from eaip_scrapper.scrapper.core.master_orchestrator import MasterOrchestrator
from eaip_scrapper.scrapper.extractors.enr.enr_airspace_extractor import ENRAirspaceExtractor
from eaip_scrapper.scrapper.extractors.enr.enr_en_route_charts_extractor import (
    ENREnRouteChartsExtractor,
)
from eaip_scrapper.scrapper.extractors.enr.enr_helicopter_routes_extractor import (
    ENRHelicopterRoutesExtractor,
)
from eaip_scrapper.scrapper.extractors.enr.enr_military_exercise_areas_extractor import (
    ENRMilitaryExerciseAreasExtractor,
)
from eaip_scrapper.scrapper.extractors.enr.enr_other_regulated_airspace_extractor import (
    ENROtherRegulatedAirspaceExtractor,
)
from eaip_scrapper.scrapper.extractors.enr.enr_prohibited_areas_extractor import (
    ENRProhibitedAreasExtractor,
)
from eaip_scrapper.scrapper.extractors.enr.enr_radio_nav_aids_extractor import (
    ENRRadioNavAidsExtractor,
)
from eaip_scrapper.scrapper.extractors.enr.enr_routes_extractor import ENRRoutesExtractor
from eaip_scrapper.scrapper.extractors.enr.enr_significant_points_extractor import (
    ENRSignificantPointsExtractor,
)
from eaip_scrapper.scrapper.extractors.enr.enr_upr_zones_extractor import ENRUPRZonesExtractor

# Concurrency tuning: number of parallel airport workers
MAX_WORKERS = 4

if __name__ == "__main__":
    import sys

    import questionary

    print("\n======================================")
    print("    eAIP Scraper Pipeline Selection")
    print("======================================\n")

    choices = [
        questionary.Choice("[SCRAPE] ENR Extractors", value="scrape_enr", checked=True),
        questionary.Choice(
            "[LOAD]   ENR ETL (Airspaces, Routes, Sig Points, Nav Aids, Charts)",
            value="load_enr",
            checked=True,
        ),
        questionary.Choice("[SCRAPE] AD Pipeline (Aerodromes)", value="scrape_ad", checked=True),
        questionary.Choice("[LOAD]   AD ETL (Aerodromes)", value="load_ad", checked=True),
        questionary.Choice("[SCRAPE] Daylight Tables", value="scrape_daylight", checked=True),
        questionary.Choice("[LOAD]   Daylight ETL", value="load_daylight", checked=True),
        questionary.Choice("[SCRAPE] NOTAMs", value="scrape_notam", checked=True),
        questionary.Choice("[LOAD]   NOTAMs ETL", value="load_notam", checked=True),
        questionary.Choice("[SCRAPE] AIP Supplements", value="scrape_supplements", checked=True),
        questionary.Choice(
            "[ALL]    RNP Pipeline (Extract -> Merge -> Parse -> Load)",
            value="all_rnp",
            checked=True,
        ),
    ]

    selected = questionary.checkbox("Select pipeline components to execute:", choices=choices).ask()

    if selected is None or not selected:
        print("No components selected. Exiting.")
        sys.exit(0)

    run_scrape_enr = "scrape_enr" in selected
    run_load_enr = "load_enr" in selected
    run_scrape_ad = "scrape_ad" in selected
    run_load_ad = "load_ad" in selected
    run_scrape_daylight = "scrape_daylight" in selected
    run_load_daylight = "load_daylight" in selected
    run_scrape_notam = "scrape_notam" in selected
    run_load_notam = "load_notam" in selected
    run_scrape_supplements = "scrape_supplements" in selected
    run_all_rnp = "all_rnp" in selected

    HOME_URL = "https://aim-india.aai.aero/"

    # 1. Create the Master Session
    master_session = requests.Session()
    master_session.verify = False
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

    # 2. Add a standard Browser User-Agent
    master_session.headers.update(
        {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
        }
    )

    # 3. Mount a robust Retry Strategy (Retries 3 times, with increasing delays)
    retry_strategy = Retry(
        total=3,
        backoff_factor=2,  # Wait 2s, then 4s, then 8s between retries
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["HEAD", "GET", "OPTIONS"],
    )
    # Pool size matches worker count for optimal connection reuse under concurrency
    adapter = HTTPAdapter(
        max_retries=retry_strategy,
        pool_connections=MAX_WORKERS + 2,
        pool_maxsize=MAX_WORKERS + 2,
    )
    master_session.mount("https://", adapter)
    master_session.mount("http://", adapter)

    # Removed local output directory creation
    # --- Centralized AIRAC Resolution ---
    print("[*] Resolving Active AIRAC Cycle (Master Node)")
    master_resolver = AIRACResolver(HOME_URL, session=master_session)
    active_eaip_url = master_resolver.get_current_eaip_url()

    if not active_eaip_url:
        print("[!] Critical Failure: Could not resolve a valid eAIP target URL. Exiting.")
        exit(1)

    print(f"[+] AIRAC cycle resolved globally. Target: {active_eaip_url}\n")

    print("[*] Launching ENR standalone extractors concurrently...")

    # ENR Scraper Task Definitions
    enr_tasks = [
        (
            ENRRadioNavAidsExtractor(
                active_eaip_url,
                session=master_session,
                output_file="output/enr_4_1_radio_nav_aids.json",
            ).extract_and_save,
            "ENR 4.1",
        ),
        (
            ENRAirspaceExtractor(
                active_eaip_url,
                session=master_session,
                output_file="output/enr_2_1_airspace.json",
            ).extract_and_save,
            "ENR 2.1",
        ),
        (
            ENROtherRegulatedAirspaceExtractor(
                active_eaip_url,
                session=master_session,
                output_file="output/enr_2_2_other_regulated_airspace.json",
            ).extract_and_save,
            "ENR 2.2",
        ),
        (
            ENRProhibitedAreasExtractor(
                active_eaip_url,
                session=master_session,
                output_file="output/enr_5_1_prohibited_restricted_danger.json",
            ).extract_and_save,
            "ENR 5.1",
        ),
        (
            ENRMilitaryExerciseAreasExtractor(
                active_eaip_url,
                session=master_session,
                output_file="output/enr_5_2_military_exercise_adiz.json",
            ).extract_and_save,
            "ENR 5.2",
        ),
        (
            ENRHelicopterRoutesExtractor(
                active_eaip_url,
                session=master_session,
                output_file="output/enr_3_3_1_helicopter_routes.json",
            ).extract_and_save,
            "ENR 3.3.1",
        ),
        (
            ENRUPRZonesExtractor(
                active_eaip_url,
                session=master_session,
                output_file="output/enr_3_3_2_upr_zones.json",
            ).extract_and_save,
            "ENR 3.3.2",
        ),
        (
            ENREnRouteChartsExtractor(
                active_eaip_url,
                session=master_session,
                output_file="output/enr_6_en_route_charts.json",
            ).extract_and_save,
            "ENR 6",
        ),
        (
            ENRRoutesExtractor(
                active_eaip_url,
                session=master_session,
                output_file_31="output/enr_3_1_conventional_routes.json",
                output_file_32="output/enr_3_2_rnav_routes.json",
            ).extract_and_save,
            "ENR 3.1 & 3.2",
        ),
        (
            ENRSignificantPointsExtractor(
                active_eaip_url,
                session=master_session,
                output_file="output/enr_4_4_significant_points.json",
            ).extract_and_save,
            "ENR 4.4",
        ),
    ]

    if run_scrape_enr:
        with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            future_to_enr = {executor.submit(task): name for task, name in enr_tasks}
            for future in concurrent.futures.as_completed(future_to_enr):
                name = future_to_enr[future]
                try:
                    future.result()
                    print(f"[+] {name} completed successfully.")
                except Exception as exc:
                    import sys

                    print(f"[!] ENR Scraper {name} generated an exception: {exc}")
                    print("[!] Halting the entire pipeline due to scrapper failure.")
                    sys.exit(1)

        print("\n[*] All standalone ENR extractors completed. Transitioning to AD Pipeline...")
    else:
        print("\n[*] Skipping ENR Extractors...")

    # AD Pipeline: Aerodrome Data Extraction
    if run_scrape_ad:
        orchestrator = MasterOrchestrator(
            active_eaip_url,
            session=master_session,
            max_workers=MAX_WORKERS,
            output_file="output/master_aip_data.json",
        )
        orchestrator.run_pipeline()
    else:
        print("\n[*] Skipping AD Pipeline...")

    print("\n[*] Starting standalone PDF & HTML Scrapers...")
    import asyncio

    from eaip_scrapper.scrapper.scrappers import (
        aip_supplements_scrapper,
        daylight_scrapper,
        notam_scrapper,
    )

    try:
        if run_scrape_supplements:
            aip_supplements_scrapper.main()
        else:
            print("[*] Skipping AIP Supplements...")

        if run_scrape_daylight:
            asyncio.run(daylight_scrapper.main())
        else:
            print("[*] Skipping Daylight Tables...")

        if run_scrape_notam:
            asyncio.run(notam_scrapper.main())
        else:
            print("[*] Skipping NOTAMs...")
    except Exception as e:
        import sys

        print(f"[!] A standalone scraper failed: {e}")
        print("[!] Halting the entire pipeline due to scrapper failure.")
        sys.exit(1)

    print("\n[*] All scraping tasks completed. Transitioning to ETL Loading Phase...")
    import subprocess

    def run_etl(script_path: str):
        print(f"\n[>>>] Triggering ETL Pipeline: {script_path}")
        result = subprocess.run([sys.executable, script_path])
        if result.returncode != 0:
            print(f"[!] ETL Pipeline {script_path} failed.")
            sys.exit(1)

    if run_load_enr:
        print("\n[*] Starting ENR ETL Pipelines...")
        run_etl("src/eaip_scrapper/etl/etl_airspaces.py")
        run_etl("src/eaip_scrapper/etl/etl_routes.py")
        run_etl("src/eaip_scrapper/etl/etl_significant_points.py")
        run_etl("src/eaip_scrapper/etl/etl_nav_aids.py")
        run_etl("src/eaip_scrapper/etl/etl_erc_charts.py")
    else:
        print("\n[*] Skipping ENR ETL Pipelines...")

    if run_load_ad:
        print("\n[*] Starting AD ETL Pipeline...")
        run_etl("src/eaip_scrapper/etl/etl_aerodromes.py")
    else:
        print("\n[*] Skipping AD ETL Pipeline...")

    if run_load_daylight:
        print("\n[*] Starting Daylight ETL Pipeline...")
        run_etl("src/eaip_scrapper/etl/etl_daylight.py")
    else:
        print("\n[*] Skipping Daylight ETL Pipeline...")

    if run_load_notam:
        print("\n[*] Starting NOTAM ETL Pipeline...")
        run_etl("src/eaip_scrapper/etl/etl_notams.py")
    else:
        print("\n[*] Skipping NOTAM ETL Pipeline...")

    if run_all_rnp:
        print("\n[*] Starting Complete RNP Pipeline (Extract -> Merge -> Parse -> Load)...")
        run_etl("src/eaip_scrapper/etl/rnp_etl.py")
    else:
        print("\n[*] Skipping RNP Pipeline...")

    print("\n[*] All requested orchestrator pipelines completed successfully.")
