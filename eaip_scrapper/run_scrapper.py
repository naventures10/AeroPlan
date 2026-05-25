import concurrent.futures
import os

import boto3
import requests
import urllib3
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from src.scrapper.AIRACResolver import AIRACResolver
from src.scrapper.ENRAirspaceExtractor import ENRAirspaceExtractor
from src.scrapper.ENREnRouteChartsExtractor import ENREnRouteChartsExtractor
from src.scrapper.ENRHelicopterRoutesExtractor import ENRHelicopterRoutesExtractor
from src.scrapper.ENRMilitaryExerciseAreasExtractor import (
    ENRMilitaryExerciseAreasExtractor,
)
from src.scrapper.ENROtherRegulatedAirspaceExtractor import (
    ENROtherRegulatedAirspaceExtractor,
)
from src.scrapper.ENRProhibitedAreasExtractor import ENRProhibitedAreasExtractor
from src.scrapper.ENRRadioNavAidsExtractor import ENRRadioNavAidsExtractor
from src.scrapper.ENRRoutesExtractor import ENRRoutesExtractor
from src.scrapper.ENRSignificantPointsExtractor import ENRSignificantPointsExtractor
from src.scrapper.ENRUPRZonesExtractor import ENRUPRZonesExtractor
from src.scrapper.MasterOrchestrator import MasterOrchestrator

# Concurrency tuning: number of parallel airport workers
MAX_WORKERS = 4

if __name__ == "__main__":
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

    os.makedirs("output", exist_ok=True)

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

    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        future_to_enr = {executor.submit(task): name for task, name in enr_tasks}
        for future in concurrent.futures.as_completed(future_to_enr):
            name = future_to_enr[future]
            try:
                future.result()
                print(f"[+] {name} completed successfully.")
            except Exception as exc:
                print(f"[!] ENR Scraper {name} generated an exception: {exc}")

    print("\n[*] All standalone ENR extractors completed. Transitioning to AD Pipeline...")

    # AD Pipeline: Aerodrome Data Extraction
    orchestrator = MasterOrchestrator(
        active_eaip_url,
        session=master_session,
        max_workers=MAX_WORKERS,
        output_file="output/master_aip_data.json",
    )
    orchestrator.run_pipeline()

    # MinIO Upload Sequence
    def upload_output_to_minio(output_dir="output", bucket_name="ais"):
        print("\n[*] Starting MinIO synchronization...")
        s3 = boto3.client(
            "s3",
            endpoint_url="http://localhost:9000",
            aws_access_key_id="ais_admin",
            aws_secret_access_key="AviationData2026!",
            region_name="us-east-1",
        )

        # Ensure bucket exists
        try:
            s3.head_bucket(Bucket=bucket_name)
        except Exception:
            print(f"[*] Bucket '{bucket_name}' not found. Creating it...")
            s3.create_bucket(Bucket=bucket_name)

        for root, _dirs, files in os.walk(output_dir):
            for file in files:
                if not file.endswith(".json"):
                    continue
                file_path = os.path.join(root, file)
                # Ensure the object key uses forward slashes regardless of OS
                object_key = file_path.replace(os.sep, "/")
                print(f"    -> Uploading {object_key}...")
                s3.upload_file(file_path, bucket_name, object_key)

        print(
            f"[+] MinIO synchronization complete. All files uploaded to bucket '{bucket_name}'.\n"
        )

    upload_output_to_minio()
