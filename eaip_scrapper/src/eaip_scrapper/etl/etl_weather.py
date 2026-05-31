"""
Weather Pipeline ETL — Download ECMWF forecast data, generate Cloud-Optimized
GeoTIFFs, and upload them to MinIO object storage.

This module is the canonical entrypoint for weather data ingestion. It runs as
a standalone script, typically triggered by macOS launchd on a schedule.

Usage:
    uv run python -m eaip_scrapper.etl.etl_weather
"""

import gc
import glob
import json
import logging
import os
import shutil
import subprocess
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FuturesTimeoutError
from datetime import UTC, datetime, timedelta
from pathlib import Path

import boto3
import cfgrib
import numpy as np
import rasterio
import structlog
import xarray as xr
from ecmwf.opendata import Client
from rasterio.transform import from_origin

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "http://localhost:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY")
MINIO_BUCKET = os.getenv("MINIO_BUCKET", "ais")

WEATHER_S3_PREFIX = "weather"
WEATHER_BASE_URL = "/api/v1/weather/files"
GDAL_CMD = os.getenv("GDAL_CMD", "gdal_translate")

# Logging setup
LOG_DIR = Path(__file__).resolve().parents[3] / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE = LOG_DIR / "weather_pipeline.log"


def _setup_logging() -> None:
    """Configure structlog with file + console output."""
    file_handler = logging.FileHandler(str(LOG_FILE))
    file_handler.setLevel(logging.DEBUG)

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)

    logging.basicConfig(
        format="%(message)s",
        level=logging.DEBUG,
        handlers=[file_handler, console_handler],
    )

    structlog.configure(
        processors=[
            structlog.stdlib.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.dev.ConsoleRenderer(),
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )


_setup_logging()
logger = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# S3 helpers
# ---------------------------------------------------------------------------


def _get_s3_client():
    """Create a boto3 S3 client pointing at MinIO."""
    return boto3.client(
        "s3",
        endpoint_url=MINIO_ENDPOINT,
        aws_access_key_id=MINIO_ACCESS_KEY,
        aws_secret_access_key=MINIO_SECRET_KEY,
        region_name="us-east-1",
    )


def _upload_file(s3, local_path: str, s3_key: str) -> None:
    """Upload a local file to S3."""
    s3.upload_file(local_path, MINIO_BUCKET, s3_key)
    logger.info("uploaded_to_s3", key=s3_key, bucket=MINIO_BUCKET)


def _upload_json(s3, data: dict, s3_key: str) -> None:
    """Upload a JSON document to S3."""
    s3.put_object(
        Bucket=MINIO_BUCKET,
        Key=s3_key,
        Body=json.dumps(data, indent=2).encode("utf-8"),
        ContentType="application/json",
    )
    logger.info("uploaded_manifest_to_s3", key=s3_key, bucket=MINIO_BUCKET)


def _cleanup_stale_s3_files(s3, active_filenames: set[str]) -> None:
    """Delete weather/*.tif files in S3 that are not in the active set."""
    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=MINIO_BUCKET, Prefix=f"{WEATHER_S3_PREFIX}/"):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            basename = os.path.basename(key)
            if basename.endswith(".tif") and basename not in active_filenames:
                try:
                    s3.delete_object(Bucket=MINIO_BUCKET, Key=key)
                    logger.info("deleted_stale_s3_file", key=key)
                except Exception as e:
                    logger.error("failed_to_delete_stale_s3_file", key=key, error=str(e))


# ---------------------------------------------------------------------------
# GDAL resolution
# ---------------------------------------------------------------------------


def _resolve_gdal_cmd() -> str:
    """Resolve the GDAL binary for non-interactive environments like cron/launchd."""
    configured_cmd = GDAL_CMD

    # Respect an explicit absolute/relative path first.
    if os.path.sep in configured_cmd:
        if os.path.isfile(configured_cmd) and os.access(configured_cmd, os.X_OK):
            return configured_cmd
        raise FileNotFoundError(
            f"Configured GDAL command does not exist or is not executable: {configured_cmd}"
        )

    resolved_cmd = shutil.which(configured_cmd)
    if resolved_cmd:
        return resolved_cmd

    fallback_paths = [
        f"/opt/homebrew/bin/{configured_cmd}",
        f"/usr/local/bin/{configured_cmd}",
    ]
    for fallback in fallback_paths:
        if os.path.isfile(fallback) and os.access(fallback, os.X_OK):
            logger.warning(
                "gdal_cmd_resolved_from_fallback",
                configured_cmd=configured_cmd,
                resolved_cmd=fallback,
            )
            return fallback

    raise FileNotFoundError(
        f"Unable to locate GDAL command '{configured_cmd}'. "
        "Set GDAL_CMD to an absolute path or ensure it is available on PATH."
    )


# ---------------------------------------------------------------------------
# GRIB cleanup
# ---------------------------------------------------------------------------


def safe_remove_grib(file_path: str) -> None:
    """Remove a GRIB file and any associated .idx files created by cfgrib."""
    if not file_path:
        return
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
        # Also remove any .idx files generated by cfgrib (e.g. file.grib2.5b7b6.idx)
        idx_files = glob.glob(f"{file_path}*.idx")
        for idx in idx_files:
            if os.path.exists(idx):
                os.remove(idx)
    except Exception as e:
        logger.error("failed_to_cleanup_temp_grib", path=file_path, error=str(e))


# ---------------------------------------------------------------------------
# Forecast run/step calculation
# ---------------------------------------------------------------------------


def _get_run_and_steps_for_time(
    now: datetime, offset_hours: int = 0
) -> tuple[int, datetime, list[int]]:
    """
    Determine the ECMWF run and forecast steps, optionally stepping back
    by a multiple of 6 hours.
    """
    latency_hours = 2 + offset_hours
    available_now = now - timedelta(hours=latency_hours)
    run_hour = (available_now.hour // 6) * 6
    run_time = available_now.replace(hour=run_hour, minute=0, second=0, microsecond=0)

    elapsed_hours = (now - run_time).total_seconds() / 3600
    start_step = max(3, round(elapsed_hours / 3) * 3)

    # 5 steps = 12 hour window (0, +3, +6, +9, +12)
    steps = [start_step + (i * 3) for i in range(5)]
    return run_hour, run_time, steps


def _get_run_and_steps(now: datetime) -> tuple[int, datetime, list[int]]:
    """
    Determine the most recent available ECMWF run and the forecast steps to
    target a 12-hour valid_time window starting close to "now".
    """
    run_hour, run_time, steps = _get_run_and_steps_for_time(now, 0)
    logger.info(
        "computed_forecast_target",
        run_date=run_time.strftime("%Y-%m-%d"),
        run_utc=f"{run_hour:02d}Z",
        steps=steps,
    )
    return run_hour, run_time, steps


# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------


def run_pipeline() -> bool:
    with tempfile.TemporaryDirectory() as temp_dir:
        return _run_pipeline_impl(temp_dir)


def _run_pipeline_impl(temp_dir: str) -> bool:
    logger.info("starting_weather_pipeline")

    s3 = _get_s3_client()
    gdal_cmd = _resolve_gdal_cmd()

    now = datetime.now(UTC)
    timestamp_str = now.strftime("%Y%m%d_%H%M%S")

    raw_sfc_file = os.path.join(temp_dir, f"temp_sfc_{timestamp_str}.grib2")
    raw_pl_file = os.path.join(temp_dir, f"temp_pl_{timestamp_str}.grib2")

    # --- STEP 1: Download with Fallback Loop ---
    max_backwards_cycles = 4
    download_success = False
    run_hour, run_time, steps = _get_run_and_steps_for_time(now, 0)

    for cycle_idx in range(max_backwards_cycles):
        offset_hours = cycle_idx * 6
        run_hour, run_time, steps = _get_run_and_steps_for_time(now, offset_hours)
        run_date_str = run_time.strftime("%Y-%m-%d")

        # Rotate sources based on the current day and hour to distribute load
        base_sources = ["azure", "aws", "google", "ecmwf"]
        shift = (now.hour // 6 + now.timetuple().tm_yday) % len(base_sources)
        rotated_sources = base_sources[shift:] + base_sources[:shift]

        for source in rotated_sources:
            logger.info(
                "downloading_ecmwf_data",
                source=source,
                date=run_date_str,
                run=f"{run_hour:02d}Z",
                steps=steps,
                attempt=cycle_idx + 1,
            )

            client = Client(source=source)
            try:

                def _download(c=client, d=run_date_str, t=run_hour, s=steps):
                    # Surface levels
                    c.retrieve(
                        date=d,
                        time=t,
                        step=s,
                        type="fc",
                        levtype="sfc",
                        param=["10u", "10v", "2t", "2d", "msl", "tcc", "10fg", "tp"],
                        target=raw_sfc_file,
                    )

                    time.sleep(5)  # Avoid SlowDown error

                    # Pressure levels
                    c.retrieve(
                        date=d,
                        time=t,
                        step=s,
                        type="fc",
                        levtype="pl",
                        levelist=[1000, 925, 850, 700, 500, 400, 300, 250, 200, 150],
                        param=["u", "v", "t", "r"],
                        target=raw_pl_file,
                    )

                with ThreadPoolExecutor(max_workers=1) as executor:
                    future = executor.submit(_download)
                    try:
                        # 3-minute timeout to avoid infinite hangs on cloud storage providers
                        future.result(timeout=180)
                    except FuturesTimeoutError as e:
                        raise TimeoutError(
                            f"Download from {source} timed out after 3 minutes"
                        ) from e

                logger.info(
                    "download_complete",
                    num_steps=len(steps),
                    run=f"{run_hour:02d}Z",
                    date=run_date_str,
                    source=source,
                )
                download_success = True
                break
            except Exception as e:
                logger.warning(
                    "download_failed_for_source",
                    source=source,
                    run=f"{run_hour:02d}Z",
                    date=run_date_str,
                    error=str(e),
                )
                safe_remove_grib(raw_sfc_file)
                safe_remove_grib(raw_pl_file)

        if download_success:
            break
        else:
            logger.warning(
                "download_failed_for_cycle",
                run=f"{run_hour:02d}Z",
                date=run_date_str,
                will_retry_previous_cycle=(cycle_idx + 1 < max_backwards_cycles),
            )

    if not download_success:
        logger.error("all_download_attempts_failed")
        return False

    # --- STEP 2: Interpolate & Generate COGs ---
    logger.info("processing_and_interpolating_data")
    manifest_data: dict = {
        "generated_at": now.isoformat().replace("+00:00", "Z"),
        "run_info": {
            "run_hour": run_hour,
            "run_time": run_time.isoformat().replace("+00:00", "Z"),
            "steps": steps,
        },
        "band_mapping": {
            "altitude": {
                "1": "u_wind_ms",
                "2": "v_wind_ms",
                "3": "temp_c",
                "4": "rel_humidity_pct",
            },
            "surface": {
                "1": "u10_wind_ms",
                "2": "v10_wind_ms",
                "3": "temp2m_c",
                "4": "rel_humidity_pct",
                "5": "wind_gust_ms",
                "6": "total_precip_m",
                "7": "total_cloud_cover_0_1",
                "8": "msl_pressure_pa",
            },
        },
        "forecasts": [],
    }

    # Track all filenames uploaded for later cleanup
    active_filenames: set[str] = set()

    try:
        # cfgrib.open_datasets auto-splits the GRIB into compatible groups
        sfc_datasets = cfgrib.open_datasets(raw_sfc_file)
        logger.info(
            "sfc_grib_groups",
            count=len(sfc_datasets),
            vars=[list(ds.data_vars) for ds in sfc_datasets],
        )

        # Build a lookup: variable name -> dataset that contains it
        sfc_var_map: dict[str, xr.Dataset] = {}
        for ds in sfc_datasets:
            for var_name in ds.data_vars:
                sfc_var_map[var_name] = ds

        ds_pl = xr.open_dataset(raw_pl_file, engine="cfgrib", backend_kwargs={"indexpath": ""})

        # Ensure 'step' is a dimension
        for i, ds in enumerate(sfc_datasets):
            if "step" not in ds.dims:
                sfc_datasets[i] = ds.expand_dims("step")
                for var_name in ds.data_vars:
                    sfc_var_map[var_name] = sfc_datasets[i]
        if "step" not in ds_pl.dims:
            ds_pl = ds_pl.expand_dims("step")

        # Altitude mapping (hPa -> approx feet)
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

        # ECMWF Open Data 0.25 degree resolution
        transform = from_origin(-180.0, 90.0, 0.25, 0.25)
        target_alts = np.arange(0, 40000, 1000)

        _level_coords = {
            "heightAboveGround",
            "surface",
            "entireAtmosphere",
            "meanSea",
            "nominalTop",
        }

        # Export each slice step-by-step to save memory
        for step_idx, step_td in enumerate(ds_pl.step.values):
            step_hours = int(step_td.astype("timedelta64[h]").astype(int))
            valid_time = run_time + timedelta(hours=step_hours)

            step_manifest: dict = {
                "valid_time": valid_time.isoformat().replace("+00:00", "Z"),
                "step": step_hours,
                "files": {},
            }

            # --- Process Pressure Levels for this step ---
            step_pl = ds_pl.isel(step=step_idx)
            step_combined = step_pl[["u", "v", "t", "r"]].copy()
            step_combined["t"] = step_combined["t"] - 273.15  # Kelvin to Celsius
            step_combined = step_combined.assign_coords(
                altitude=(
                    "isobaricInhPa",
                    [alt_map[int(float(p))] for p in step_combined.isobaricInhPa.values],
                )
            ).swap_dims({"isobaricInhPa": "altitude"})

            # --- Process Surface for this step ---
            def _sfc_var_step(
                name: str, fallback: str | None = None, _step_idx: int = step_idx
            ) -> xr.DataArray:
                if name in sfc_var_map:
                    da = sfc_var_map[name][name]
                elif fallback and fallback in sfc_var_map:
                    da = sfc_var_map[fallback][fallback]
                else:
                    raise KeyError(
                        f"Surface var '{name}' (fallback '{fallback}') "
                        f"not found. Available: {list(sfc_var_map.keys())}"
                    )
                da_step = da.isel(step=_step_idx)
                drop = [c for c in da_step.coords if c in _level_coords]
                return da_step.drop_vars(drop) if drop else da_step

            t2m_data = _sfc_var_step("t2m", "2t") - 273.15
            d2m_data = _sfc_var_step("d2m", "2d") - 273.15
            es = 6.112 * np.exp((17.67 * t2m_data) / (t2m_data + 243.5))
            e = 6.112 * np.exp((17.67 * d2m_data) / (d2m_data + 243.5))
            rh_sfc = (e / es) * 100.0
            rh_sfc = rh_sfc.clip(0, 100)

            # Build surface dataset from individual GRIB groups
            step_sfc = xr.Dataset(
                {
                    "u": _sfc_var_step("u10"),
                    "v": _sfc_var_step("v10"),
                    "t": t2m_data,
                    "r": rh_sfc,
                    "fg10": _sfc_var_step("fg10", "10fg"),
                    "tp": _sfc_var_step("tp"),
                    "tcc": _sfc_var_step("tcc"),
                    "msl": _sfc_var_step("msl"),
                }
            )

            step_sfc = step_sfc.assign_coords(altitude=0).expand_dims("altitude")

            # Cleanup coords before concat
            keep_coords = ["altitude", "latitude", "longitude", "step", "valid_time"]
            step_combined = step_combined.drop_vars(
                [c for c in step_combined.coords if c not in keep_coords]
            )
            step_sfc = step_sfc.drop_vars([c for c in step_sfc.coords if c not in keep_coords])

            # Combine
            step_full = xr.concat([step_sfc, step_combined], dim="altitude").sortby("altitude")

            # Interpolate (only for this single step)
            ds_step = step_full.interp(altitude=target_alts, method="linear")

            for alt in target_alts:
                alt_slice = ds_step.sel(altitude=alt)

                # Prepare data bands
                bands = []
                bands.append(np.nan_to_num(alt_slice["u"].values.astype(np.float32), nan=0.0))
                bands.append(np.nan_to_num(alt_slice["v"].values.astype(np.float32), nan=0.0))
                bands.append(np.nan_to_num(alt_slice["t"].values.astype(np.float32), nan=0.0))
                bands.append(np.nan_to_num(alt_slice["r"].values.astype(np.float32), nan=0.0))

                if alt == 0:
                    for var in ["fg10", "tp", "tcc", "msl"]:
                        bands.append(
                            np.nan_to_num(alt_slice[var].values.astype(np.float32), nan=0.0)
                        )

                temp_tif = os.path.join(temp_dir, f"temp_out_{int(alt)}_{step_hours}.tif")

                with rasterio.open(
                    temp_tif,
                    "w",
                    driver="GTiff",
                    height=bands[0].shape[0],
                    width=bands[0].shape[1],
                    count=len(bands),
                    dtype=bands[0].dtype,
                    crs="+proj=latlong",
                    transform=transform,
                    nodata=0.0,
                ) as dst:
                    for i, band_data in enumerate(bands):
                        dst.write(band_data, i + 1)

                level_name = "surface" if alt == 0 else f"{int(alt // 1000):03d}"
                final_cog_filename = (
                    f"weather_{level_name}_{timestamp_str}_step{step_hours:03d}.tif"
                )
                final_cog_path = os.path.join(temp_dir, final_cog_filename)

                # Prepare GDAL bands arguments
                band_args = []
                for i in range(len(bands)):
                    band_args.extend(["-b", str(i + 1)])

                gdal_args = [
                    gdal_cmd,
                    "-of",
                    "COG",
                    "-ot",
                    "Float32",
                    *band_args,
                    "-projwin",
                    "20",
                    "80",
                    "180",
                    "-10",
                    "-outsize",
                    "640",
                    "360",
                    "-co",
                    "COMPRESS=DEFLATE",
                    "-co",
                    "PREDICTOR=3",
                    temp_tif,
                    final_cog_path,
                ]
                subprocess.run(gdal_args, check=True, capture_output=True, text=True)

                # Upload COG to S3
                s3_key = f"{WEATHER_S3_PREFIX}/{final_cog_filename}"
                _upload_file(s3, final_cog_path, s3_key)
                active_filenames.add(final_cog_filename)

                step_manifest["files"][level_name] = f"{WEATHER_BASE_URL}/{final_cog_filename}"

                os.remove(temp_tif)
                os.remove(final_cog_path)

            manifest_data["forecasts"].append(step_manifest)

            # Explicitly free memory for this step
            del ds_step, step_full, step_sfc, step_combined, step_pl
            del t2m_data, d2m_data, es, e, rh_sfc
            gc.collect()

        logger.info("cogs_generated", count=len(target_alts) * len(steps))

    except Exception as e:
        logger.error("processing_failed", error=str(e))
        safe_remove_grib(raw_pl_file)
        safe_remove_grib(raw_sfc_file)
        return False
    finally:
        if "ds_pl" in locals():
            ds_pl.close()
        if "sfc_datasets" in locals():
            for ds in sfc_datasets:
                ds.close()

    # --- STEP 3: Upload Manifest to S3 ---
    manifest_s3_key = f"{WEATHER_S3_PREFIX}/weather_manifest.json"
    logger.info("uploading_manifest", key=manifest_s3_key)
    try:
        _upload_json(s3, manifest_data, manifest_s3_key)
        logger.info("manifest_uploaded")
    except Exception as e:
        logger.error("manifest_upload_failed", error=str(e))

    # --- STEP 4: Cleanup stale files in S3 ---
    safe_remove_grib(raw_pl_file)
    safe_remove_grib(raw_sfc_file)

    _cleanup_stale_s3_files(s3, active_filenames)
    logger.info("pipeline_completed_successfully")
    return True


if __name__ == "__main__":
    raise SystemExit(0 if run_pipeline() else 1)
