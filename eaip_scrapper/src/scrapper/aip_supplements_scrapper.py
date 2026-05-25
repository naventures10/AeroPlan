import json
import logging
import os
import time

import boto3
import requests
import urllib3
from botocore.exceptions import ClientError
from bs4 import BeautifulSoup

# Disable insecure request warnings
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# Constants
URL = "https://aim-india.aai.aero/aip-supplements"
BASE_URL = "https://aim-india.aai.aero"

# MinIO Config
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "http://localhost:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "ais_admin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "AviationData2026!")
MINIO_BUCKET = os.getenv("MINIO_BUCKET", "ais")
FILE_KEY = "output/aip_supplements.json"

# 12 hours in seconds
SCRAPE_INTERVAL = 12 * 3600


def scrape_supplements():
    logger.info(f"Fetching AIP Supplements from {URL}")
    try:
        response = requests.get(URL, verify=False, timeout=60)
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
        cols = row.find_all("td")
        if len(cols) >= 4:
            s_no = cols[0].get_text(strip=True)

            title_cell = cols[1]
            # Get text but remove nested elements like 'New' img text if any
            title = title_cell.get_text(strip=True)

            link_tag = title_cell.find("a")
            pdf_link = link_tag["href"] if link_tag else ""
            if pdf_link and pdf_link.startswith("/"):
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

    logger.info(f"Successfully extracted {len(results)} supplements.")
    return results


def upload_to_minio(data):
    logger.info(f"Uploading to MinIO bucket '{MINIO_BUCKET}' at '{FILE_KEY}'")
    s3 = boto3.client(
        "s3",
        endpoint_url=MINIO_ENDPOINT,
        aws_access_key_id=MINIO_ACCESS_KEY,
        aws_secret_access_key=MINIO_SECRET_KEY,
    )

    try:
        # Ensure bucket exists or just put object (assuming bucket is managed externally)
        json_data = json.dumps(data, indent=2)
        s3.put_object(
            Bucket=MINIO_BUCKET,
            Key=FILE_KEY,
            Body=json_data.encode("utf-8"),
            ContentType="application/json",
        )
        logger.info("Upload complete.")
    except ClientError as e:
        logger.error(f"Failed to upload to MinIO: {e}")


def main():
    logger.info("Starting AIP Supplements Scraper service...")
    while True:
        try:
            data = scrape_supplements()
            if data:
                upload_to_minio(data)
            else:
                logger.warning("No data extracted. Skipping upload.")
        except Exception as e:
            logger.error(f"Unexpected error in scraping cycle: {e}")

        logger.info(f"Sleeping for {SCRAPE_INTERVAL // 3600} hours...")
        time.sleep(SCRAPE_INTERVAL)


if __name__ == "__main__":
    main()
