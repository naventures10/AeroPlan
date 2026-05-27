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
        questionary.Choice(
            "ENR Extractors (Airspace, Routes, Nav Aids, etc.)", value="enr", checked=True
        ),
        questionary.Choice(
            "AD Pipeline (Aerodromes Master Orchestrator)", value="ad", checked=True
        ),
        questionary.Choice("AIP Supplements", value="supplements", checked=True),
        questionary.Choice("Daylight Tables", value="daylight", checked=True),
        questionary.Choice("NOTAMs", value="notam", checked=True),
    ]

    selected = questionary.checkbox(
        "Select which scrapers to run (Space to toggle, Enter to confirm):", choices=choices
    ).ask()

    if selected is None or not selected:
        print("No scrapers selected. Exiting.")
        sys.exit(0)

    run_enr = "enr" in selected
    run_ad = "ad" in selected
    run_supplements = "supplements" in selected
    run_daylight = "daylight" in selected
    run_notam = "notam" in selected

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

    if run_enr:
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
    if run_ad:
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
        if run_supplements:
            aip_supplements_scrapper.main()
        else:
            print("[*] Skipping AIP Supplements...")

        if run_daylight:
            asyncio.run(daylight_scrapper.main())
        else:
            print("[*] Skipping Daylight Tables...")

        if run_notam:
            asyncio.run(notam_scrapper.main())
        else:
            print("[*] Skipping NOTAMs...")
    except Exception as e:
        import sys

        print(f"[!] A standalone scraper failed: {e}")
        print("[!] Halting the entire pipeline due to scrapper failure.")
        sys.exit(1)

    print("\n[*] All pipelines completed successfully. Outputs are stored directly in MinIO.")
