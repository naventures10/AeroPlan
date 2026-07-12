import json
import os
import subprocess
import sys
import tempfile

import boto3
import requests
from dotenv import load_dotenv

from eaip_scrapper.validation.core.central_validator import ValidationRouter

load_dotenv()

MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY")
ERC_MAP_POLYGON = os.getenv("ERC_MAP_POLYGON")

if not all([MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY]):
    raise ValueError("Missing MinIO credentials in environment variables")
MINIO_BUCKET = "ais"
MINIO_METADATA_KEY = "output/enr_6_en_route_charts.json"

TARGET_CHART_NAME = "En route Chart- INDIA.pdf"
OUTPUT_PMTILES_KEY = "output/ERC-VOMF.pmtiles"

EXTERNAL_CMD_TIMEOUT = 600  # 10 minutes max for heavy gdal processing


class ERCChartsETL:
    def __init__(self):
        print("[*] Initializing ERC Charts eaip_scrapper.etl engine...")
        self.s3 = boto3.client(
            "s3",
            endpoint_url=MINIO_ENDPOINT,
            aws_access_key_id=MINIO_ACCESS_KEY,
            aws_secret_access_key=MINIO_SECRET_KEY,
            region_name="us-east-1",
        )

    def get_pdf_url(self) -> str:
        """Fetch ENR 6 metadata and find the target chart PDF URL."""
        print(f"[*] Fetching metadata from MinIO: {MINIO_METADATA_KEY}")
        response = self.s3.get_object(Bucket=MINIO_BUCKET, Key=MINIO_METADATA_KEY)
        json_string = response["Body"].read().decode("utf-8")

        # VALIDATION BOUNDARY
        validator = ValidationRouter()
        validator.validate_ingest_json_string(os.path.basename(MINIO_METADATA_KEY), json_string)

        metadata = json.loads(json_string)

        charts = metadata.get("charts", [])
        for chart in charts:
            if chart.get("chart_name") == TARGET_CHART_NAME:
                url = chart["pdf_url"]
                print(f"[+] Found target chart URL: {url}")
                return url

        raise ValueError(
            f"Chart '{TARGET_CHART_NAME}' not found in metadata. "
            f"Available: {[c.get('chart_name') for c in charts]}"
        )

    def download_pdf(self, url: str) -> str:
        """Download the PDF to a temporary file."""
        print(f"[*] Downloading PDF from: {url}")
        resp = requests.get(url, timeout=120)
        resp.raise_for_status()

        tmp = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
        tmp.write(resp.content)
        tmp.close()

        size_mb = len(resp.content) / (1024 * 1024)
        print(f"[+] Downloaded {size_mb:.1f} MB -> {tmp.name}")
        return tmp.name

    def delete_existing_pmtiles(self):
        """Delete existing PMTiles from MinIO to ensure a clean state for the new AIRAC cycle."""
        print(f"\n[*] Checking for existing PMTiles at {OUTPUT_PMTILES_KEY}...")
        try:
            self.s3.head_object(Bucket=MINIO_BUCKET, Key=OUTPUT_PMTILES_KEY)
            print(f"    Found existing file. Deleting {OUTPUT_PMTILES_KEY}...")
            self.s3.delete_object(Bucket=MINIO_BUCKET, Key=OUTPUT_PMTILES_KEY)
            print("    [+] Deletion successful.")
        except Exception:
            print("    [-] No existing file found. Proceeding...")

    def process_to_pmtiles(self, pdf_path: str) -> str:
        """Use GDAL and pmtiles CLI to convert PDF to PMTiles with zoom levels 4-11."""
        print("\n[*] Starting GDAL processing...")
        tif_path = pdf_path.replace(".pdf", ".tif")
        mbtiles_path = pdf_path.replace(".pdf", ".mbtiles")
        pmtiles_path = pdf_path.replace(".pdf", ".pmtiles")

        # 1. Reproject to an intermediate GeoTIFF (Web Mercator)
        print("  [Step 1] Reprojecting GeoPDF to intermediate GeoTIFF (EPSG:3857)...")
        # -co GDAL_PDF_DPI=300 ensures crisp text when rendering the PDF.
        cmd_warp = [
            "gdalwarp",
            "-t_srs",
            "EPSG:3857",
            "-r",
            "cubic",
            "--config",
            "GDAL_PDF_DPI",
            "300",
        ]

        cutline_path = None
        if ERC_MAP_POLYGON:
            try:
                coords = json.loads(ERC_MAP_POLYGON)
                geojson_data = {
                    "type": "FeatureCollection",
                    "features": [
                        {
                            "type": "Feature",
                            "properties": {},
                            "geometry": {
                                "type": "Polygon",
                                "coordinates": [coords],
                            },
                        }
                    ],
                }
                tmp_geojson = tempfile.NamedTemporaryFile(suffix=".geojson", delete=False)
                tmp_geojson.write(json.dumps(geojson_data).encode("utf-8"))
                tmp_geojson.close()
                cutline_path = tmp_geojson.name

                print(f"    Applying crop cutline polygon with {len(coords)} vertices.")
                cmd_warp.extend(
                    [
                        "-cutline",
                        cutline_path,
                        "-crop_to_cutline",
                        "-cutline_srs",
                        "EPSG:4326",
                        "-dstalpha",
                    ]
                )
            except Exception as e:
                print(f"    [!] Error parsing ERC_MAP_POLYGON or writing temp GeoJSON: {e}")

        cmd_warp.extend([pdf_path, tif_path])

        try:
            subprocess.run(
                cmd_warp,
                check=True,
                capture_output=True,
                timeout=EXTERNAL_CMD_TIMEOUT,
            )
            print(f"    [+] Successfully created intermediate TIF at {tif_path}")
        except subprocess.CalledProcessError as e:
            print(f"    [X] gdalwarp failed: {e.stderr.decode('utf-8', errors='replace')}")
            raise
        finally:
            if cutline_path and os.path.exists(cutline_path):
                os.remove(cutline_path)

        # 2. Translate GeoTIFF to MBTiles
        print("  [Step 2] Translating GeoTIFF to MBTiles database...")
        cmd_translate = [
            "gdal_translate",
            "-of",
            "MBTILES",
            "-co",
            "TILE_FORMAT=PNG",
            "-co",
            "ZOOM_LEVEL_STRATEGY=UPPER",
            "-co",
            "NAME=ERC INDIA",
            "-co",
            "DESCRIPTION=High-Res Enroute Chart",
            "-co",
            "TYPE=baselayer",
            tif_path,
            mbtiles_path,
        ]

        try:
            subprocess.run(
                cmd_translate,
                check=True,
                capture_output=True,
                timeout=EXTERNAL_CMD_TIMEOUT,
            )
            print(f"    [+] Successfully created base MBTiles at {mbtiles_path}")
        except subprocess.CalledProcessError as e:
            print(f"    [X] gdal_translate failed: {e.stderr.decode('utf-8', errors='replace')}")
            raise
        finally:
            if os.path.exists(tif_path):
                os.remove(tif_path)

        # 3. Add overviews (Zoom levels down to 4)
        print("  [Step 3] Generating Overviews (Zoom Levels)...")
        # Factors for pyramid: 2, 4, 8, 16, 32, 64, 128
        cmd_addo = [
            "gdaladdo",
            "-r",
            "average",
            mbtiles_path,
            "2",
            "4",
            "8",
            "16",
            "32",
            "64",
            "128",
        ]

        try:
            subprocess.run(cmd_addo, check=True, capture_output=True, timeout=EXTERNAL_CMD_TIMEOUT)
            print("    [+] Successfully added overview zoom levels.")
        except subprocess.CalledProcessError as e:
            print(f"    [X] gdaladdo failed: {e.stderr.decode('utf-8', errors='replace')}")
            raise

        # 4. Convert MBTiles to PMTiles
        print("  [Step 4] Converting MBTiles to PMTiles format...")
        cmd_pmtiles = [
            "pmtiles",
            "convert",
            mbtiles_path,
            pmtiles_path,
        ]

        try:
            subprocess.run(
                cmd_pmtiles,
                check=True,
                capture_output=True,
                timeout=EXTERNAL_CMD_TIMEOUT,
            )
            print(f"    [+] Successfully created PMTiles at {pmtiles_path}")
        except subprocess.CalledProcessError as e:
            print(f"    [X] pmtiles convert failed: {e.stderr.decode('utf-8', errors='replace')}")
            raise
        finally:
            if os.path.exists(mbtiles_path):
                os.remove(mbtiles_path)

        return pmtiles_path

    def upload_pmtiles(self, pmtiles_path: str):
        """Upload the finished PMTiles to MinIO, ensuring the file is valid."""
        print(f"\n[*] Uploading PMTiles to MinIO: {OUTPUT_PMTILES_KEY}")

        if not os.path.exists(pmtiles_path):
            print(f"[!] Artifact Validation Failed: {pmtiles_path} does not exist.")
            sys.exit(1)

        file_size_mb = os.path.getsize(pmtiles_path) / (1024 * 1024)
        print(f"    File size: {file_size_mb:.1f} MB")

        # Verify the file is not empty or corruptly small (e.g., < 0.1 MB)
        if file_size_mb < 0.1:
            print(
                "[!] Artifact Validation Failed: Generated PMTiles file is too small (less than 100KB)."
            )
            print("[!] Pipeline halted to prevent corrupting MinIO storage.")
            sys.exit(1)

        self.s3.upload_file(pmtiles_path, MINIO_BUCKET, OUTPUT_PMTILES_KEY)
        print("[+] Upload complete.")


def main():
    etl = ERCChartsETL()
    pdf_path = None
    pmtiles_path = None

    try:
        pdf_url = etl.get_pdf_url()
        etl.delete_existing_pmtiles()
        pdf_path = etl.download_pdf(pdf_url)
        pmtiles_path = etl.process_to_pmtiles(pdf_path)
        etl.upload_pmtiles(pmtiles_path)

    except Exception as e:
        print(f"\n[!] PIPELINE FAILURE: {e}")
        raise

    finally:
        print("\n[*] Cleaning up temporary files...")
        if pdf_path and os.path.exists(pdf_path):
            os.remove(pdf_path)
            print(f"    Removed {pdf_path}")
        if pmtiles_path and os.path.exists(pmtiles_path):
            os.remove(pmtiles_path)
            print(f"    Removed {pmtiles_path}")

    print("\n" + "=" * 50)
    print("[+] ERC Charts eaip_scrapper.etl pipeline completed successfully.")
    print("=" * 50)


if __name__ == "__main__":
    main()
