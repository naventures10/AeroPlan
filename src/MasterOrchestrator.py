import requests
import json
import time
from src.AIPManifestCreator import AIPManifestCreator
from src.LiveTableExtractor import LiveTableExtractor
from src.ChartExtractor import ChartExtractor
from src.AIPSchemaMapper import AIPSchemaMapper


class MasterOrchestrator:
    def __init__(self, base_url, session=None, output_file="master_aip_data.json"):
        self.base_url = base_url
        self.output_file = output_file
        
        # 1. Initialize the Shared Session
        self.session = session or requests.Session()
        
        # 2. Instantiate all system components using the shared session
        self.manifest_creator = AIPManifestCreator(self.base_url)
        self.manifest_creator.session = self.session 
        
        self.table_extractor = LiveTableExtractor()
        self.table_extractor.session = self.session
        
        self.chart_extractor = ChartExtractor(self.session)
        self.schema_mapper = AIPSchemaMapper()

    def run_pipeline(self):
        print("[*] Initiating Full eAIP Extraction Pipeline...")
        
        # Phase 1: Discovery
        print("\n--- PHASE 1: DISCOVERY ---")
        manifest = self.manifest_creator.run_discovery()
        
        if not manifest:
            print("[!] Discovery failed. Aborting pipeline.")
            return
            
        master_database = []
        test_limit = 1 # Limiting to 3 for testing purposes
        
        print(f"\n--- PHASE 2: EXTRACTION (Testing first {test_limit} airports) ---")
        
        # Phase 2: Extraction Loop
        for entry in manifest[:test_limit]:
            icao = entry['icao']
            url = entry['source_url']
            
            print(f"\n[+] Processing [{icao}] - {entry['name']}")
            
            # Initialize the JSON document for this specific airport
            airport_record = {
                "icao": icao,
                "name": entry['name'],
                "source_url": url,
                "data": {},
                "charts": []
            }
            
            # --- Extract Tables ---
            target_sections = [
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
                ("AD 2.24", "AD_2_24", "charts_related_to_aerodrome", "grid")
            ]

            for search_id, router_key, json_key, mode in target_sections:
                print(f"    -> Extracting Table: {search_id} in {mode.upper()} mode...")
                
                # Pass the mode into the extractor
                grid = self.table_extractor.extract_section(url, search_id, mode=mode)
                
                if grid:
                    mapped_data = self.schema_mapper.process_grid(router_key, grid)
                    airport_record["data"][json_key] = mapped_data.get(json_key, [])
                else:
                    print(f"    [-] {search_id} not found or empty.")

            # --- Extract Charts ---
            print("    -> Extracting PDF Charts...")
            charts = self.chart_extractor.extract_charts(url)
            airport_record["charts"] = charts
            
            # Append the completed record to the master database
            master_database.append(airport_record)
            
            # Politeness Delay: Wait 1 second before hitting the next airport
            time.sleep(1)

        # Phase 3: Persistence
        print("\n--- PHASE 3: PERSISTENCE ---")
        print(f"[*] Saving scraped data to {self.output_file}...")
        
        with open(self.output_file, 'w', encoding='utf-8') as file:
            json.dump(master_database, file, indent=2, ensure_ascii=False)
            
        print("[+] System Execution Complete. Data secured.")