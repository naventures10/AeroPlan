"""
Weather Router — Non-persistent, on-demand METAR/TAF with in-memory TTL cache,
plus MinIO proxy endpoints for weather forecast GeoTIFF data.

Redundant dual-source architecture for METAR/TAF:
  1. Chennai OLBS  (olbs.amsschennai.gov.in)
  2. Delhi OLBS    (olbs.amssdelhi.gov.in)

Both sources are scraped concurrently. If both succeed, the data is compared and
the most recent observation is returned. If one source fails, the other is used
as fallback. Results are cached in-memory for CACHE_TTL_SECONDS (default 300s).

Weather Forecast Data:
  GeoTIFF files and manifest are stored in MinIO (ais bucket, weather/ prefix)
  and served via API proxy endpoints.
"""

import asyncio
import re
import time
from datetime import UTC, datetime

import httpx
import structlog
from bs4 import BeautifulSoup
from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse

from app.core.redis import get_cached_json, set_cached_json
from app.core.storage import get_storage_path
from app.core.storage_client import UnifiedStorageClient
from app.schemas.weather import WeatherResponse

logger = structlog.get_logger()

router = APIRouter(prefix="", tags=["Weather"])

_storage_client = None


def get_storage_client() -> UnifiedStorageClient:
    global _storage_client
    if _storage_client is None:
        _storage_client = UnifiedStorageClient()
    return _storage_client


# ── Configuration ────────────────────────────────────────────────────────────
SOURCES = {
    "chennai": "https://olbs.amsschennai.gov.in/nsweb/FlightBriefing/weathermap/station.php?icao={}",
    "delhi": "https://olbs.amssdelhi.gov.in/nsweb/FlightBriefing/weathermap/station.php?icao={}",
}
CACHE_TTL_SECONDS = 300  # 5 minutes

WEATHER_S3_PREFIX = "weather"

# Strict filename whitelist: alphanumeric, underscores, hyphens, and .tif/.tiff/.json extensions
SAFE_FILENAME_RE = re.compile(r"^[A-Za-z0-9_\-]+\.(tiff?|json)$")


# ── Redis Cache ──────────────────────────────────────────────────────────────
def _get_cache_key(icao: str) -> str:
    """Build the Redis cache key for a given ICAO code."""
    return f"weather:icao:{icao.upper()}"


def _parse_weather_html(html: str, icao: str) -> dict:
    """Parse METAR and TAF from the station HTML response."""
    soup = BeautifulSoup(html, "html.parser")
    data: dict = {"icao": icao, "metar": None, "taf": []}

    # Extract METAR
    metar_b = soup.find("b", string=re.compile(r"^\s*METAR\s*$", re.IGNORECASE))  # type: ignore
    if metar_b:
        metar_text = ""
        current = metar_b.next_sibling
        while current and current.name != "b":
            if isinstance(current, str):
                metar_text += current.strip() + " "
            current = current.next_sibling
        cleaned = metar_text.strip()
        if cleaned:
            data["metar"] = cleaned

    # Extract all TAFs
    taf_bs = soup.find_all("b", string=re.compile(r"^\s*TAF\s*$", re.IGNORECASE))  # type: ignore
    for taf_b in taf_bs:
        taf_text = ""
        current = taf_b.next_sibling
        while current and current.name != "b":
            if isinstance(current, str):
                taf_text += current.strip() + "\n"
            current = current.next_sibling
        taf_lines = [line.strip() for line in taf_text.split("\n") if line.strip()]
        if taf_lines:
            data["taf"].append(taf_lines)

    return data


def _extract_metar_time(metar: str | None) -> int:
    """
    Extract the DDHHMMz observation time from a METAR string.
    Returns an integer like 181130 for comparison — higher = more recent within a day.
    Returns 0 if the METAR is missing or unparseable.
    """
    if not metar:
        return 0
    # METAR format: ICAO DDHHMMz ...  e.g. "VABB 181130Z ..."
    match = re.search(r"\b(\d{6})Z\b", metar, re.IGNORECASE)
    return int(match.group(1)) if match else 0


async def _fetch_from_source(source_name: str, url: str) -> dict | None:
    """Fetch and parse weather from a single source. Returns None on failure."""
    try:
        # Disable SSL verification (verify=False) because Chennai and Delhi OLBS government
        # servers frequently use self-signed certificates or incomplete certificate chains.
        async with httpx.AsyncClient(timeout=15.0, verify=False) as client:
            resp = await client.get(url)
            resp.raise_for_status()
        return {"source": source_name, "html": resp.text}
    except Exception as exc:
        logger.warning("weather_source_failed", source=source_name, error=str(exc))
        return None


async def _fetch_weather(icao: str) -> dict:
    """
    Fetch weather from both Chennai and Delhi concurrently.
    Compare results and return the freshest data.
    """
    icao_upper = icao.upper()

    # Fire both requests concurrently
    tasks = {
        name: _fetch_from_source(name, url.format(icao_upper)) for name, url in SOURCES.items()
    }
    results = await asyncio.gather(*tasks.values())
    source_results = dict(zip(tasks.keys(), results, strict=False))

    # Parse successful responses
    parsed: list[dict] = []
    for source_name, result in source_results.items():
        if result is not None:
            data = _parse_weather_html(result["html"], icao_upper)
            data["source"] = source_name
            parsed.append(data)

    if not parsed:
        raise HTTPException(
            status_code=502,
            detail=f"All weather sources failed for {icao_upper}. Both Chennai and Delhi OLBS are unreachable.",
        )

    # Pick the best result — prefer the one with the most recent METAR observation
    if len(parsed) == 1:
        best = parsed[0]
        sources_used = [best["source"]]
    else:
        # Both sources returned data — compare METAR timestamps
        for p in parsed:
            p["_metar_time"] = _extract_metar_time(p.get("metar"))

        parsed.sort(key=lambda x: x["_metar_time"], reverse=True)
        best = parsed[0]
        sources_used = [p["source"] for p in parsed]

        # Log comparison

        times = {p["source"]: p["_metar_time"] for p in parsed}
        metars_match = parsed[0].get("metar") == parsed[1].get("metar")
        logger.info(
            "weather_comparison",
            icao=icao_upper,
            metar_times=times,
            metars_match=metars_match,
        )

    # Prevent overwriting valid cache with empty data if a source failed
    if not best.get("metar") and not best.get("taf") and len(parsed) < len(SOURCES):
        # Check if we are about to overwrite previously valid data
        old_cache = await get_cached_json(_get_cache_key(icao_upper))
        if old_cache and (
            old_cache.get("data", {}).get("metar") or old_cache.get("data", {}).get("taf")
        ):
            raise HTTPException(
                status_code=502,
                detail=f"Partial failure: {sources_used} returned no data, and other sources failed. Refusing to overwrite valid cache with empty data.",
            )
            # If the cache was already empty or expired, we allow it to cache the null result
            # This ensures genuinely empty airports (or permanently blocked sources) don't cause
            # 15-second timeouts on every frontend request.

    now = time.time()
    fetched_at_str = datetime.fromtimestamp(now, tz=UTC).isoformat()

    # Cache the best result in Redis with a 1-hour TTL (3600s)
    cache_data = {
        "data": {k: v for k, v in best.items() if k != "_metar_time"},
        "fetched_at": fetched_at_str,
        "sources_used": sources_used,
    }
    await set_cached_json(_get_cache_key(icao_upper), cache_data, ttl_seconds=3600)

    return {
        **{k: v for k, v in best.items() if k != "_metar_time"},
        "fetched_at": fetched_at_str,
        "sources_available": sources_used,
    }


# ── Forecast Data Proxy Endpoints (from MinIO) ──────────────────────────────
# These MUST be defined BEFORE the dynamic /weather/{icao_code} route below.


@router.get("/weather/weather_manifest.json")
async def get_weather_manifest() -> JSONResponse:
    """
    Fetch the weather manifest from MinIO/GCS and rewrite file URLs to point
    directly to pre-signed MinIO/GCS storage objects.
    """
    s3_key = f"{WEATHER_S3_PREFIX}/weather_manifest.json"

    try:
        manifest = get_storage_client().read_json(s3_key)
        if manifest is None:
            raise HTTPException(status_code=404, detail="Weather manifest not found")

        # Dynamically generate signed URLs for each forecast file
        if isinstance(manifest, dict) and "forecasts" in manifest:
            for forecast in manifest["forecasts"]:
                if "files" in forecast:
                    for level_name, file_url in list(forecast["files"].items()):
                        if file_url:
                            filename = file_url.split("/")[-1]
                            file_s3_key = f"{WEATHER_S3_PREFIX}/{filename}"
                            try:
                                signed_url = get_storage_client().generate_presigned_url(
                                    file_s3_key
                                )
                                forecast["files"][level_name] = signed_url
                            except Exception as e:
                                logger.error(
                                    "failed_to_generate_presigned_url_for_manifest",
                                    s3_key=file_s3_key,
                                    error=str(e),
                                )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("weather_manifest_fetch_failed", error=str(e))
        raise HTTPException(status_code=502, detail="Failed to fetch weather manifest") from e

    return JSONResponse(
        content=manifest,
        headers={"Cache-Control": "no-cache, no-store, must-revalidate"},
    )


@router.api_route("/weather/files/{filename}", methods=["GET", "HEAD"])
async def get_weather_file(filename: str, request: Request):
    """
    Stream a weather GeoTIFF file from MinIO with long-lived cache headers.
    Supports HTTP HEAD and Range requests for Cloud-Optimized GeoTIFF (COG) streaming.
    """
    # Validate filename with strict whitelist to prevent path traversal (including URL-encoded)
    if not SAFE_FILENAME_RE.match(filename):
        raise HTTPException(status_code=400, detail="Invalid filename")

    s3_key = f"{WEATHER_S3_PREFIX}/{filename}"
    filepath = get_storage_path(s3_key)

    if not filepath.exists():
        raise HTTPException(status_code=404, detail=f"Weather file not found: {filename}")

    file_size = filepath.stat().st_size
    content_type = "application/json" if filename.endswith(".json") else "image/tiff"

    if request.method == "HEAD":
        return Response(
            media_type=content_type,
            headers={
                "Content-Length": str(file_size),
                "Accept-Ranges": "bytes",
                "Cache-Control": "public, max-age=31536000, immutable",
            },
        )

    range_header = request.headers.get("range")
    if range_header:
        # Simple range parser
        match = re.search(r"bytes=(\d+)-(\d*)", range_header)
        if match:
            byte1 = int(match.group(1))
            byte2 = int(match.group(2)) if match.group(2) else file_size - 1

            # Validate bounds
            if byte1 >= file_size or byte1 < 0:
                return Response(
                    status_code=416,
                    headers={
                        "Content-Range": f"bytes */{file_size}",
                        "Cache-Control": "public, max-age=31536000, immutable",
                    },
                )

            byte2 = min(byte2, file_size - 1)
            length = byte2 - byte1 + 1

            def file_iterator():
                with open(filepath, "rb") as f:
                    f.seek(byte1)
                    yield f.read(length)

            headers = {
                "Content-Range": f"bytes {byte1}-{byte2}/{file_size}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(length),
                "Cache-Control": "public, max-age=31536000, immutable",
                "Content-Disposition": f"inline; filename={filename}",
            }
            return StreamingResponse(
                file_iterator(),
                status_code=206,
                media_type=content_type,
                headers=headers,
            )

    # Return full file if no range header
    return FileResponse(
        path=filepath,
        media_type=content_type,
        filename=filename,
        headers={
            "Accept-Ranges": "bytes",
            "Cache-Control": "public, max-age=31536000, immutable",
        },
    )


# ── METAR/TAF Endpoint ──────────────────────────────────────────────────────
@router.get("/weather/{icao_code}", response_model=WeatherResponse)
async def get_weather(icao_code: str) -> WeatherResponse:
    """
    Returns live METAR and TAF for a given ICAO airport code.

    Scrapes both Chennai and Delhi OLBS concurrently for redundancy.
    Returns the freshest data; falls back to whichever source is available.
    Data is cached in Redis for up to 1 hour, updated periodically every 30 minutes.
    """
    icao = icao_code.upper()
    cache_key = _get_cache_key(icao)

    cached_data = await get_cached_json(cache_key)
    if cached_data:
        return WeatherResponse(
            **cached_data["data"],
            fetched_at=cached_data.get("fetched_at"),
            sources_available=cached_data.get("sources_used", []),
            cached=True,
        )

    result = await _fetch_weather(icao)
    result["cached"] = False
    return WeatherResponse(**result)
