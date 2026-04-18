import os
import json
import time
import requests
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from threading import Lock
from dotenv import load_dotenv
from llama_cloud import LlamaCloud

# Load environment variables
load_dotenv()

# Configuration
MASTER_JSON = "/Users/naveendevapalan/Desktop/Naveen/PROJECTS/eAIP/output/master_aip_data.json"
OUTPUT_DIR = Path("/Users/naveendevapalan/Desktop/Naveen/PROJECTS/eAIP/eaip_scrapper/output/extracted_data")
TEMP_DIR = Path("/Users/naveendevapalan/Desktop/Naveen/PROJECTS/eAIP/eaip_scrapper/temp_extraction")
LOG_FILE = Path("/Users/naveendevapalan/Desktop/Naveen/PROJECTS/eAIP/eaip_scrapper/scratch/processing_log.json")

# API Keys for rotation
LLAMA_KEYS = [
    os.getenv("LLAMA_CLOUD_API_KEY_1"),
    os.getenv("LLAMA_CLOUD_API_KEY_2"),
    os.getenv("LLAMA_CLOUD_API_KEY_3"),
    os.getenv("LLAMA_CLOUD_API_KEY_4")
]
LLAMA_KEYS = [k for k in LLAMA_KEYS if k]

# Thread safety for key selection and logging
key_lock = Lock()
log_lock = Lock()
current_key_index = 0

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
TEMP_DIR.mkdir(parents=True, exist_ok=True)

def get_keys():
    global current_key_index
    with key_lock:
        key = LLAMA_KEYS[current_key_index % len(LLAMA_KEYS)]
        current_key_index += 1
        return key

def get_all_rnp_charts():
    with open(MASTER_JSON, "r") as f:
        data = json.load(f)
    charts = []
    for entry in data:
        for key in ["charts", "charts_related_to_aerodrome"]:
            for chart in entry.get(key, []):
                name = chart.get("chart_name", "").upper()
                url = chart.get("pdf_url", "")
                if "RNP" in name and ("CODING" in name or "WAYPOINTS" in name) and url:
                    charts.append({"name": name, "url": url})
    return charts

def load_log():
    if LOG_FILE.exists():
        with open(LOG_FILE, "r") as f:
            return json.load(f)
    return {}

def update_log(url, status):
    with log_lock:
        log = load_log()
        log[url] = status
        with open(LOG_FILE, "w") as f:
            json.dump(log, f, indent=2)

def download_pdf(url, local_path):
    if local_path.exists():
        return True
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        with open(local_path, "wb") as f:
            f.write(response.content)
        return True
    except Exception as e:
        print(f"  [ERROR] Download failed for {url}: {e}")
        return False

def process_chart(chart):
    name = chart["name"].replace(" ", "_").replace("/", "_")
    url = chart["url"]
    output_file = OUTPUT_DIR / f"{name}.md"
    
    # Skip if already exists (Requirement: "you can skip if files are already present")
    if output_file.exists():
        print(f"Skipping (exists): {name}")
        return

    pdf_path = TEMP_DIR / f"{name}.pdf"
    if not download_pdf(url, pdf_path):
        return

    api_key = get_keys()
    print(f"Processing: {name} (via LlamaCloud)...")
    
    try:
        client = LlamaCloud(api_key=api_key)
        # Upload
        file = client.files.create(file=str(pdf_path), purpose="parse")
        # Parse - Agentic Tier
        result = client.parsing.parse(
            file_id=file.id,
            tier="agentic",
            version="latest",
            expand=["markdown"]
        )
        
        if result.markdown and result.markdown.pages:
            full_md = "\n\n".join([p.markdown for p in result.markdown.pages])
            with open(output_file, "w") as f:
                f.write(full_md)
            update_log(url, "SUCCESS")
            print(f"  [SUCCESS] {name}")
        else:
            print(f"  [WARNING] No markdown returned for {name}")
            update_log(url, "EMPTY_RESULT")

    except Exception as e:
        print(f"  [ERROR] LlamaCloud failed for {name}: {e}")
        update_log(url, f"FAILED: {str(e)}")

def main():
    charts = get_all_rnp_charts()
    print(f"Found {len(charts)} RNP Coding charts total.")
    
    # Parallel processing with 4 workers (utilizing 4 keys)
    with ThreadPoolExecutor(max_workers=4) as executor:
        executor.map(process_chart, charts)

if __name__ == "__main__":
    main()
