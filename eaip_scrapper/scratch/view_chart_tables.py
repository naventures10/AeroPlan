# ruff: noqa: E402
import os
import sys
from pathlib import Path

from bs4 import BeautifulSoup

# Add src to path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.append(str(BASE_DIR / "src"))

from eaip_scrapper.rnp_processor.utils import get_s3_client


def main():
    s3_client = get_s3_client()
    bucket = os.getenv("MINIO_BUCKET", "ais")
    key = "output/rnp/merged_data/VIND-RNP-RWY-28-CODING.md"

    print(f"Fetching {key}...")
    obj_resp = s3_client.get_object(Bucket=bucket, Key=key)
    content = obj_resp["Body"].read().decode("utf-8")

    soup = BeautifulSoup(content, "html.parser")
    tables = soup.find_all("table")
    print(f"Found {len(tables)} tables.")

    for idx, table in enumerate(tables):
        print(f"\n--- TABLE {idx} ---")
        rows = table.find_all("tr")
        for r_idx, row in enumerate(rows):
            cells = row.find_all(["td", "th"])
            cell_texts = [c.get_text(strip=True) for c in cells]
            print(f"Row {r_idx}: {cell_texts}")


if __name__ == "__main__":
    main()
