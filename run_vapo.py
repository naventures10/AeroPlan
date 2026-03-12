import json
import sys

from src.scrapper.MasterOrchestrator import MasterOrchestrator

orchestrator = MasterOrchestrator("https://aim-india.aai.aero/eaip/eaip-v2-01-2026/eAIP/IN-menu-en-GB.html")
test_entry = {"icao": "VAPO", "name": "Pune", "source_url": "https://aim-india.aai.aero/eaip/eaip-v2-01-2026/eAIP/IN-AD%202.1VAPO-en-GB.html"}

result = orchestrator._process_airport(test_entry)

# Re-read master_aip_data.json
with open("../output/master_aip_data.json", "r", encoding="utf-8") as f:
    data = json.load(f)

# Find and replace VAPO
replaced = False
for i, d in enumerate(data):
    if d["icao"] == "VAPO":
        data[i] = result
        print(f"Replaced VAPO data at index {i}")
        replaced = True
        break

if not replaced:
    print("VAPO not found in master_aip_data.json!")

# Write back
with open("../output/master_aip_data.json", "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print("VAPO update complete! Check master_aip_data.json.")
