import glob
import json
import os
import subprocess
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

import numpy as np
import rasterio
import structlog
import xarray as xr
from ecmwf.opendata import Client
from rasterio.transform import from_origin

# Add the backend directory to sys.path to allow 'from app' imports
sys.path.append(str(Path(__file__).parents[2]))

# Set dummy environment variables for required fields not used by this script
# to prevent Pydantic validation errors during standalone runs.
os.environ.setdefault("POSTGRES_PASSWORD", "dummy")
os.environ.setdefault("MINIO_ACCESS_KEY", "dummy")
os.environ.setdefault("MINIO_SECRET_KEY", "dummy")

from app.core.config import settings

logger = structlog.get_logger(__name__)


def cleanup_old_files(output_dir: str, keep_runs: int):
    """Keep only the most recent N runs of .tif files to prevent disk bloat."""
    tif_files = glob.glob(os.path.join(output_dir, "wind_*.tif"))

    # Extract unique timestamps from filenames (e.g. wind_050_20260426_194402.tif)
    runs = set()
    for f in tif_files:
        parts = os.path.basename(f).replace(".tif", "").split("_")
        if len(parts) >= 3:
            ts = f"{parts[-2]}_{parts[-1]}"
            runs.add(ts)

    sorted_runs = sorted(list(runs), reverse=True)

    if len(sorted_runs) > keep_runs:
        runs_to_delete = sorted_runs[keep_runs:]
        for run in runs_to_delete:
            files_to_del = glob.glob(os.path.join(output_dir, f"wind_*_{run}.tif"))
            for f in files_to_del:
                try:
                    os.remove(f)
                    logger.info("deleted_old_weather_file", filename=os.path.basename(f))
                except Exception as e:
                    logger.error("failed_to_delete_old_weather_file", filename=f, error=str(e))


def run_pipeline():
    logger.info("starting_weather_pipeline")

    os.makedirs(settings.WEATHER_OUTPUT_DIR, exist_ok=True)

    now = datetime.now(UTC)
    timestamp_str = now.strftime("%Y%m%d_%H%M%S")

    raw_pl_file = os.path.join(os.getcwd(), f"temp_pl_{timestamp_str}.grib2")
    manifest_path = os.path.join(settings.WEATHER_OUTPUT_DIR, "weather_manifest.json")

    # --- STEP 1: Download ---
    logger.info("downloading_ecmwf_data", source="azure")
    client = Client(source="azure")
    try:
        # Pressure levels (Single call batch approach to avoid 503 Slow Down)
        # 1000hPa is used as the base level (approx 364ft) to serve as "Surface"
        result = client.retrieve(
            time=0,
            step=24,
            type="fc",
            levtype="pl",
            levelist=[1000, 925, 850, 700, 500, 400, 300, 250, 200, 150],
            param=["u", "v"],
            target=raw_pl_file,
        )
        valid_time = result.datetime + timedelta(hours=24)
        logger.info("download_complete", valid_time=valid_time.isoformat())

    except Exception as e:
        logger.error("download_failed", error=str(e))
        if os.path.exists(raw_pl_file):
            os.remove(raw_pl_file)
        return

    # --- STEP 2: Interpolate & Generate COGs ---
    logger.info("processing_and_interpolating_data")
    manifest_data = {}

    try:
        ds_pl = xr.open_dataset(raw_pl_file, engine="cfgrib")

        # Altitude mapping for pressure levels (hPa -> approx feet, std atmosphere)
        alt_map = {
            1000: 364,
            925: 2500,
            850: 4781,
            700: 9882,
            500: 18289,
            400: 23564,
            300: 30065,
            250: 33994,
            200: 38662,
            150: 44300,
        }

        # Add altitude coordinate
        ds_combined = ds_pl[["u", "v"]]
        ds_combined = ds_combined.assign_coords(
            altitude=(
                "isobaricInhPa",
                [alt_map[int(float(p))] for p in ds_combined.isobaricInhPa.values],
            )
        )
        ds_combined = ds_combined.swap_dims({"isobaricInhPa": "altitude"})

        # To support "Surface" (0 ft), we use 1000 hPa (364 ft) as the base anchor
        ds_sfc = ds_combined.sel(altitude=364).assign_coords(altitude=0).expand_dims("altitude")
        ds_combined = xr.concat([ds_sfc, ds_combined], dim="altitude").sortby("altitude")

        # Interpolate to 1000ft intervals
        target_alts = np.arange(0, 40000, 1000)
        ds_interp = ds_combined.interp(altitude=target_alts, method="linear")

        # Export each slice
        transform = from_origin(0.0, 90.0, 0.4, 0.4)

        for alt in target_alts:
            alt_slice = ds_interp.sel(altitude=alt)
            u_data = alt_slice["u"].values.astype(np.float32)
            v_data = alt_slice["v"].values.astype(np.float32)

            temp_tif = os.path.join(os.getcwd(), f"temp_out_{int(alt)}.tif")

            # Handle NaNs
            u_data = np.nan_to_num(u_data, nan=0.0)
            v_data = np.nan_to_num(v_data, nan=0.0)

            with rasterio.open(
                temp_tif,
                "w",
                driver="GTiff",
                height=u_data.shape[0],
                width=u_data.shape[1],
                count=2,
                dtype=u_data.dtype,
                crs="+proj=latlong",
                transform=transform,
                nodata=0.0,
            ) as dst:
                dst.write(u_data, 1)
                dst.write(v_data, 2)

            level_name = "surface" if alt == 0 else f"{int(alt // 1000):03d}"
            final_cog_filename = f"wind_{level_name}_{timestamp_str}.tif"
            final_cog_path = os.path.join(settings.WEATHER_OUTPUT_DIR, final_cog_filename)

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
                temp_tif,
                final_cog_path,
            ]
            subprocess.run(gdal_args, check=True, capture_output=True, text=True)

            manifest_data[f"wind_{level_name}"] = {
                "url": f"{settings.WEATHER_BASE_URL}/{final_cog_filename}",
                "valid_time": valid_time.isoformat().replace("+00:00", "Z"),
                "generated_at": now.isoformat().replace("+00:00", "Z"),
                "altitude_ft": int(alt),
            }

            os.remove(temp_tif)

        logger.info("cogs_generated", count=len(target_alts))

    except Exception as e:
        logger.error("processing_failed", error=str(e))
        if os.path.exists(raw_pl_file):
            os.remove(raw_pl_file)
        return

    # --- STEP 3: Generate Manifest ---
    logger.info("updating_manifest", path=manifest_path)
    temp_manifest = manifest_path + ".tmp"
    try:
        with open(temp_manifest, "w") as f:
            json.dump(manifest_data, f, indent=2)
        os.replace(temp_manifest, manifest_path)
        logger.info("manifest_updated")
    except Exception as e:
        logger.error("manifest_update_failed", error=str(e))

    # --- STEP 4: Cleanup ---
    if os.path.exists(raw_pl_file):
        os.remove(raw_pl_file)

    cleanup_old_files(settings.WEATHER_OUTPUT_DIR, settings.WEATHER_KEEP_RUNS)
    logger.info("pipeline_completed_successfully")


if __name__ == "__main__":
    run_pipeline()
