import json
import logging
import os
import tempfile

import requests
import urllib3
from bs4 import BeautifulSoup

from jobs.storage_client import UnifiedStorageClient

# Disable insecure request warnings
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# Constants
URL = "https://aim-india.aai.aero/aip-supplements"
BASE_URL = "https://aim-india.aai.aero"
FILE_KEY = "output/aip_supplements.json"


def scrape_supplements() -> list | None:
    logger.info(f"Fetching AIP Supplements from {URL}")
    try:
        verify_tls = os.getenv("AIP_VERIFY_TLS", "false").lower() == "true"
        if not verify_tls:
            logger.warning(
                "TLS verification is disabled for AAI supplements fetch due to known certificate issues."
            )
        response = requests.get(URL, verify=verify_tls, timeout=60)
        response.raise_for_status()
    except Exception as e:
        logger.error(f"Failed to fetch page: {e}")
        return None

    soup = BeautifulSoup(response.text, "html.parser")
    table = soup.find("table")

    if not table:
        logger.error("Could not find table on the page.")
        return None

    tbody = table.find("tbody")
    # Sometimes there's no tbody, just trs directly in table
    rows = table.find_all("tr")[1:] if not tbody else tbody.find_all("tr")

    results = []

    for row in rows:
        try:
            cols = row.find_all("td")
            if len(cols) >= 4:
                s_no = cols[0].get_text(strip=True)

                title_cell = cols[1]
                title = title_cell.get_text(strip=True)

                link_tag = title_cell.find("a")
                pdf_link = link_tag.get("href", "") if link_tag else ""
                # pyrefly: ignore [missing-attribute]
                if pdf_link and pdf_link.startswith("/"):
                    # pyrefly: ignore [unsupported-operation]
                    pdf_link = BASE_URL + pdf_link

                eff_date = cols[2].get_text(strip=True)
                remarks = cols[3].get_text(strip=True) if len(cols) > 3 else ""

                results.append(
                    {
                        "supplement_number": s_no,
                        "title": title,
                        "pdf_link": pdf_link,
                        "effective_date": eff_date,
                        "remarks": remarks,
                    }
                )
        except Exception as row_err:
            logger.error(f"Error parsing row: {row_err}")
            continue

    logger.info(f"Successfully extracted {len(results)} supplements.")
    return results


def run_scraper() -> bool:
    logger.info("Starting AIP Supplements Scraper...")
    try:
        data = scrape_supplements()
        if not data:
            logger.warning("No data extracted. Skipping upload.")
            return False

        storage_client = UnifiedStorageClient()
        # Download existing to check for updates
        with tempfile.NamedTemporaryFile(delete=False, suffix=".json") as tmp:
            tmp_path = tmp.name

        needs_upload = True
        try:
            logger.info(f"Checking existing supplements at '{FILE_KEY}'")
            storage_client.download_file(FILE_KEY, tmp_path)

            with open(tmp_path, encoding="utf-8") as f:
                existing_data = json.load(f)

            if existing_data and len(existing_data) > 0:
                incoming_set = {
                    item.get("supplement_number") for item in data if item.get("supplement_number")
                }
                existing_set = {
                    item.get("supplement_number")
                    for item in existing_data
                    if item.get("supplement_number")
                }

                if incoming_set and incoming_set.issubset(existing_set):
                    logger.info(
                        "No updates detected (all incoming supplements already exist). Skipping upload."
                    )
                    needs_upload = False
        except Exception as e:
            logger.warning(f"Could not retrieve or parse existing data (might be first run): {e}")
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

        if needs_upload:
            logger.info(f"Uploading new supplements data to '{FILE_KEY}'")
            # pyrefly: ignore [bad-argument-type]
            storage_client.upload_json(data, FILE_KEY)
            logger.info("Upload complete.")

        return True
    except Exception as e:
        logger.error(f"Unexpected error in scraping cycle: {e}")
        return False


if __name__ == "__main__":
    import sys

    sys.exit(0 if run_scraper() else 1)
