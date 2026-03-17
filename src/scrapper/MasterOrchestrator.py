import requests
import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from src.scrapper.AIPManifestCreator import AIPManifestCreator
from src.scrapper.LiveTableExtractor import LiveTableExtractor
from src.scrapper.ChartExtractor import ChartExtractor
from src.scrapper.AIPSchemaMapper import AIPSchemaMapper


# Section definitions: (search_id, router_key, json_key, mode)
TARGET_SECTIONS = [
    ("AD 2.2", "AD_2_2", "geographical_data", "grid"),
    ("AD 2.3", "AD_2_3", "operational_hours", "grid"),
    ("AD 2.4", "AD_2_4", "handling_services", "grid"),
    ("AD 2.5", "AD_2_5", "passenger_facilities", "grid"),
    ("AD 2.6", "AD_2_6", "rescue_and_fire_fighting", "grid"),
    ("AD 2.7", "AD_2_7", "seasonal_clearing", "grid"),
    ("AD 2.8", "AD_2_8", "aprons_taxiways_checkpoints", "grid"),
    ("AD 2.9", "AD_2_9", "smgcs_markings", "grid"),
    ("AD 2.10", "AD_2_10", "obstacles", "grid"),
    ("AD 2.11", "AD_2_11", "meteorological_information", "grid"),
    ("AD 2.12", "AD_2_12", "runway_physical_characteristics", "grid"),
    ("AD 2.13", "AD_2_13", "declared_distances", "grid"),
    ("AD 2.14", "AD_2_14", "approach_runway_lighting", "grid"),
    ("AD 2.15", "AD_2_15", "other_lighting_power_supply", "grid"),
    ("AD 2.16", "AD_2_16", "helicopter_landing_area", "grid"),
    ("AD 2.17", "AD_2_17", "ats_airspace", "grid"),
    ("AD 2.18", "AD_2_18", "communications", "grid"),
    ("AD 2.19", "AD_2_19", "radio_navigation_and_landing_aids", "grid"),
    ("AD 2.20", "AD_2_20", "local_aerodrome_regulations", "document"),
    ("AD 2.21", "AD_2_21", "noise_abatement_procedures", "document"),
    ("AD 2.22", "AD_2_22", "flight_procedures", "document"),
    ("AD 2.23", "AD_2_23", "additional_information", "document"),
    (
        "AD 2.24 CHARTS RELATED TO AN AERODROME",
        "AD_2_24",
        "charts_related_to_aerodrome",
        "grid",
    ),
]


class MasterOrchestrator:
    def __init__(
        self, base_url, session=None, output_file="master_aip_data.json", max_workers=4
    ):
        self.base_url = base_url
        self.output_file = output_file
        self.max_workers = max_workers

        # 1. Initialize the Shared Session
        self.session = session or requests.Session()

        # 2. Instantiate all system components using the shared session
        self.manifest_creator = AIPManifestCreator(self.base_url)
        self.manifest_creator.session = self.session

        self.schema_mapper = AIPSchemaMapper()

    def _process_airport(self, entry):
        """
        Processes a single airport: fetches the page ONCE, extracts all tables
        and charts from the same parsed HTML, and returns the airport record.

        Thread-safe: each call uses its own LiveTableExtractor and ChartExtractor
        instances (sharing the thread-safe requests.Session for connection pooling).
        """
        icao = entry["icao"]
        url = entry["source_url"]

        print(f"\n[+] Processing [{icao}] - {entry['name']}")

        # Initialize per-thread extractors (sharing the session for connection reuse)
        table_extractor = LiveTableExtractor(session=self.session)
        chart_extractor = ChartExtractor(session=self.session)

        # === THE KEY OPTIMIZATION: Fetch the airport page exactly ONCE ===
        soup = table_extractor._fetch_soup(url)

        if soup is None:
            print(f"[!] Failed to fetch page for [{icao}]. Skipping.")
            return None

        # Initialize the JSON document for this specific airport
        airport_record = {
            "icao": icao,
            "name": entry["name"],
            "source_url": url,
            "data": {},
            "charts": [],
        }

        # --- Batch Extract ALL Tables from the single fetched page ---
        section_results = table_extractor.extract_all_sections(
            url, TARGET_SECTIONS, soup=soup
        )

        for json_key, (router_key, grid) in section_results.items():
            mapped_data = self.schema_mapper.process_grid(router_key, grid)
            airport_record["data"][json_key] = mapped_data.get(json_key, [])

        # Ensure all expected sections are present — missing document-mode
        # sections (e.g. "NIL" content embedded in the header table) get a
        # default NIL entry so the output schema is always complete.
        for _search_id, _router_key, json_key, mode in TARGET_SECTIONS:
            if json_key not in airport_record["data"]:
                if mode == "document":
                    airport_record["data"][json_key] = [
                        {"type": "paragraph", "content": "NIL"}
                    ]

        # --- Extract Charts from the same fetched page ---
        print("    -> Extracting PDF Charts...")
        charts = chart_extractor.extract_charts(url, soup=soup)
        airport_record["charts"] = charts

        return airport_record

    def run_pipeline(self):
        print("[*] Initiating Full eAIP Extraction Pipeline...")
        start_time = time.time()

        # Phase 1: Discovery
        print("\n--- PHASE 1: DISCOVERY ---")
        manifest = self.manifest_creator.run_discovery()

        if not manifest:
            print("[!] Discovery failed. Aborting pipeline.")
            return

        discovery_time = time.time()
        print(
            f"[*] Discovery completed in {discovery_time - start_time:.1f}s. Found {len(manifest)} airports."
        )

        work_queue = manifest

        print(
            f"\n--- PHASE 2: EXTRACTION ({len(work_queue)} airports, {self.max_workers} workers) ---"
        )

        # Phase 2: Concurrent Extraction
        master_database = []
        failed_airports = []

        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            # Submit all airport jobs
            future_to_entry = {
                executor.submit(self._process_airport, entry): entry
                for entry in work_queue
            }

            # Collect results as they complete
            for future in as_completed(future_to_entry):
                entry = future_to_entry[future]
                icao = entry["icao"]

                try:
                    result = future.result()
                    if result:
                        master_database.append(result)
                        print(f"[✓] [{icao}] completed successfully.")
                    else:
                        failed_airports.append(icao)
                        print(f"[✗] [{icao}] returned no data.")
                except Exception as e:
                    failed_airports.append(icao)
                    print(f"[✗] [{icao}] failed with exception: {e}")

        extraction_time = time.time()

        # Phase 3: Persistence
        print("\n--- PHASE 3: PERSISTENCE ---")
        print(f"[*] Saving scraped data to {self.output_file}...")

        with open(self.output_file, "w", encoding="utf-8") as file:
            json.dump(master_database, file, indent=2, ensure_ascii=False)

        # Summary
        total_time = time.time() - start_time
        print(f"\n{'=' * 50}")
        print(f"[+] PIPELINE COMPLETE")
        print(f"    Airports scraped : {len(master_database)}/{len(work_queue)}")
        print(
            f"    Failed           : {len(failed_airports)} {failed_airports if failed_airports else ''}"
        )
        print(f"    Discovery time   : {discovery_time - start_time:.1f}s")
        print(f"    Extraction time  : {extraction_time - discovery_time:.1f}s")
        print(f"    Total time       : {total_time:.1f}s")
        print(f"{'=' * 50}")
