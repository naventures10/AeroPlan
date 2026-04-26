import glob
import json
import os
import subprocess
from datetime import UTC, datetime, timedelta

import structlog
from ecmwf.opendata import Client

from app.core.config import settings

logger = structlog.get_logger(__name__)


def cleanup_old_files(output_dir: str, keep_count: int):
    """Keep only the most recent N .tif files to prevent disk bloat."""
    tif_files = glob.glob(os.path.join(output_dir, "wind_surface_*.tif"))
    # Sort by modification time (oldest first)
    tif_files.sort(key=os.path.getmtime)

    if len(tif_files) > keep_count:
        files_to_delete = tif_files if keep_count == 0 else tif_files[:-keep_count]
        for f in files_to_delete:
            try:
                os.remove(f)
                logger.info("deleted_old_weather_file", filename=os.path.basename(f))
            except Exception as e:
                logger.error("failed_to_delete_old_weather_file", filename=f, error=str(e))


def run_pipeline():
    logger.info("starting_weather_pipeline")

    # Ensure output directory exists
    os.makedirs(settings.WEATHER_OUTPUT_DIR, exist_ok=True)

    # Generate timestamps for unique filenames and manifest metadata
    now = datetime.now(UTC)
    timestamp_str = now.strftime("%Y%m%d_%H%M%S")

    # Temporary file for the download (in the same directory as the service)
    # Using a more robust temp path might be better, but sticking to logic
    raw_grib_file = os.path.join(os.getcwd(), f"temp_wind_{timestamp_str}.grib2")
    final_cog_filename = f"wind_surface_{timestamp_str}.tif"
    final_cog_path = os.path.join(settings.WEATHER_OUTPUT_DIR, final_cog_filename)
    manifest_path = os.path.join(settings.WEATHER_OUTPUT_DIR, "weather_manifest.json")

    # --- STEP 1: Download ---
    logger.info("downloading_ecmwf_data", source="aws")
    client = Client(source="aws")
    try:
        # Requesting +24hr forecast from the most recent run (time=0)
        # Parameters: 10m u-component of wind (10u), 10m v-component of wind (10v)
        result = client.retrieve(
            time=0, step=24, type="fc", param=["10u", "10v"], target=raw_grib_file
        )
        # Calculate when this forecast is actually valid
        valid_time = result.datetime + timedelta(hours=24)
        logger.info("download_complete", valid_time=valid_time.isoformat())

    except Exception as e:
        logger.error("download_failed", error=str(e))
        if os.path.exists(raw_grib_file):
            os.remove(raw_grib_file)
        return

    # --- STEP 2: Translate & Crop via GDAL ---
    logger.info("converting_to_cog", target=final_cog_path)
    # Bounding Box: [minX, maxY, maxX, minY] -> [65, 40, 100, 5]
    # NOTE: -outsize must be a multiple of 4 for luma.gl v9 WebGPU bytesPerRow alignment.
    # The natural ECMWF grid gives ~141px; we force 140x140.
    gdal_args = [
        settings.GDAL_CMD,
        "-of",
        "COG",
        "-ot",
        "Float32",
        "-b",
        "1",
        "-b",
        "2",
        "-projwin",
        "65",
        "40",
        "100",
        "5",
        "-outsize",
        "140",
        "140",
        "-co",
        "COMPRESS=DEFLATE",
        "-co",
        "PREDICTOR=3",
        raw_grib_file,
        final_cog_path,
    ]

    try:
        subprocess.run(gdal_args, check=True, capture_output=True, text=True)
        logger.info("cog_generated", path=final_cog_path)
    except subprocess.CalledProcessError as e:
        logger.error("gdal_processing_failed", error=e.stderr)
        if os.path.exists(raw_grib_file):
            os.remove(raw_grib_file)
        return

    # --- STEP 3: Generate Manifest ---
    logger.info("updating_manifest", path=manifest_path)
    manifest_data = {
        "wind_surface": {
            "url": f"{settings.WEATHER_BASE_URL}/{final_cog_filename}",
            "valid_time": valid_time.isoformat().replace("+00:00", "Z"),
            "generated_at": now.isoformat().replace("+00:00", "Z"),
        }
    }

    # Write atomically (write to temp file, then rename)
    temp_manifest = manifest_path + ".tmp"
    try:
        with open(temp_manifest, "w") as f:
            json.dump(manifest_data, f, indent=2)
        os.replace(temp_manifest, manifest_path)
        logger.info("manifest_updated")
    except Exception as e:
        logger.error("manifest_update_failed", error=str(e))

    # --- STEP 4: Cleanup ---
    if os.path.exists(raw_grib_file):
        os.remove(raw_grib_file)

    cleanup_old_files(settings.WEATHER_OUTPUT_DIR, settings.WEATHER_KEEP_RUNS)
    logger.info("pipeline_completed_successfully")


if __name__ == "__main__":
    run_pipeline()
