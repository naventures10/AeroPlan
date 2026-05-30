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
import json
import os
import re
import time
from datetime import UTC, datetime

import httpx
import structlog
from bs4 import BeautifulSoup
from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import JSONResponse, StreamingResponse

from app.core.storage import get_storage_client
from app.schemas.weather import WeatherResponse

logger = structlog.get_logger()

router = APIRouter(prefix="", tags=["Weather"])

# ── Configuration ────────────────────────────────────────────────────────────
SOURCES = {
    "chennai": "https://olbs.amsschennai.gov.in/nsweb/FlightBriefing/weathermap/station.php?icao={}",
    "delhi": "https://olbs.amssdelhi.gov.in/nsweb/FlightBriefing/weathermap/station.php?icao={}",
}
CACHE_TTL_SECONDS = 300  # 5 minutes

MINIO_BUCKET = os.getenv("MINIO_BUCKET", "ais")
WEATHER_S3_PREFIX = "weather"

# ── In-Memory Cache ──────────────────────────────────────────────────────────
# { "VABB": { "data": {...}, "fetched_at": float, "source": str } }
_weather_cache: dict[str, dict] = {}


def _is_cache_fresh(icao: str) -> bool:
    entry = _weather_cache.get(icao)
    if not entry:
        return False
    return (time.time() - float(entry["fetched_at"])) < CACHE_TTL_SECONDS


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
        async with httpx.AsyncClient(verify=False, timeout=15.0) as client:
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

        # Clean up internal field
        for p in parsed:
            p.pop("_metar_time", None)

    now = time.time()

    # Cache the best result
    _weather_cache[icao_upper] = {
        "data": {k: v for k, v in best.items() if k != "_metar_time"},
        "fetched_at": now,
        "sources_used": sources_used,
    }

    return {
        **{k: v for k, v in best.items() if k != "_metar_time"},
        "fetched_at": datetime.fromtimestamp(now, tz=UTC).isoformat(),
        "sources_available": sources_used,
    }


# ── Forecast Data Proxy Endpoints (from MinIO) ──────────────────────────────
# These MUST be defined BEFORE the dynamic /weather/{icao_code} route below.


@router.get("/weather/weather_manifest.json")
async def get_weather_manifest() -> JSONResponse:
    """
    Fetch the weather manifest from MinIO and rewrite file URLs to point
    through the API proxy.
    """
    s3 = get_storage_client()
    s3_key = f"{WEATHER_S3_PREFIX}/weather_manifest.json"

    try:
        response = s3.get_object(Bucket=MINIO_BUCKET, Key=s3_key)
        manifest = json.loads(response["Body"].read().decode("utf-8"))
    except s3.exceptions.NoSuchKey:
        raise HTTPException(status_code=404, detail="Weather manifest not found") from None
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
    # Validate filename to prevent path traversal
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    s3 = get_storage_client()
    s3_key = f"{WEATHER_S3_PREFIX}/{filename}"

    try:
        if request.method == "HEAD":
            # For HEAD requests, just get the object metadata
            head_resp = s3.head_object(Bucket=MINIO_BUCKET, Key=s3_key)
            return Response(
                headers={
                    "Content-Length": str(head_resp.get("ContentLength", 0)),
                    "Accept-Ranges": "bytes",
                    "Cache-Control": "public, max-age=31536000, immutable",
                }
            )

        # For GET requests, check if there's a Range header
        range_header = request.headers.get("range")
        kwargs = {"Bucket": MINIO_BUCKET, "Key": s3_key}
        if range_header:
            kwargs["Range"] = range_header

        response = s3.get_object(**kwargs)
    except s3.exceptions.ClientError as e:
        error_code = e.response["Error"]["Code"]
        if error_code == "404" or error_code == "NoSuchKey":
            raise HTTPException(
                status_code=404, detail=f"Weather file not found: {filename}"
            ) from None
        logger.error("weather_file_fetch_failed", filename=filename, error=str(e))
        raise HTTPException(status_code=502, detail="Failed to fetch weather file") from e
    except Exception as e:
        logger.error("weather_file_fetch_failed", filename=filename, error=str(e))
        raise HTTPException(status_code=502, detail="Failed to fetch weather file") from e

    content_type = "image/tiff"
    if filename.endswith(".json"):
        content_type = "application/json"

    status_code = 206 if range_header else 200
    headers = {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Disposition": f"inline; filename={filename}",
        "Accept-Ranges": "bytes",
        "Content-Length": str(response.get("ContentLength", 0)),
    }

    if "ContentRange" in response:
        headers["Content-Range"] = response["ContentRange"]

    return StreamingResponse(
        response["Body"],
        status_code=status_code,
        media_type=content_type,
        headers=headers,
    )


# ── METAR/TAF Endpoint ──────────────────────────────────────────────────────
@router.get("/weather/{icao_code}", response_model=WeatherResponse)
async def get_weather(icao_code: str) -> WeatherResponse:
    """
    Returns live METAR and TAF for a given ICAO airport code.

    Scrapes both Chennai and Delhi OLBS concurrently for redundancy.
    Returns the freshest data; falls back to whichever source is available.
    Data is cached in-memory for 5 minutes.
    """
    icao = icao_code.upper()

    if _is_cache_fresh(icao):
        entry = _weather_cache[icao]
        return WeatherResponse(
            **entry["data"],
            fetched_at=datetime.fromtimestamp(entry["fetched_at"], tz=UTC).isoformat(),
            sources_available=entry.get("sources_used", []),
            cached=True,
        )

    result = await _fetch_weather(icao)
    result["cached"] = False
    return WeatherResponse(**result)
