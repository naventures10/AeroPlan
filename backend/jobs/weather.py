import asyncio
import time

import structlog
from sqlalchemy import select

from app.api.v1.endpoints.weather import _fetch_weather
from app.core.database import AsyncSessionLocal
from app.models.aerodrome import AerodromeDocument

logger = structlog.get_logger()

_weather_task: asyncio.Task | None = None


async def update_weather_cache_loop() -> None:
    """
    Background loop that queries all aerodromes from the database and updates
    their METAR/TAF weather details in Redis. Runs every 30 minutes.
    """
    logger.info("Starting weather cache update background loop...")
    while True:
        try:
            start_time = time.time()
            logger.info("Triggering periodic weather cache update...")

            async with AsyncSessionLocal() as session:
                stmt = select(AerodromeDocument.icao_code)
                result = await session.execute(stmt)
                icao_codes = [row[0] for row in result.fetchall() if row[0]]

            logger.info(f"Found {len(icao_codes)} aerodromes to update weather cache for.")

            # Concurrently update cache with a limit of 2 concurrent scrapes to protect OLBS sources
            sem = asyncio.Semaphore(2)

            async def fetch_and_cache(icao: str, sem=sem) -> None:
                async with sem:
                    try:
                        await _fetch_weather(icao)
                        logger.debug("weather_cached_successfully", icao=icao)
                    except Exception as exc:
                        logger.warning("weather_cache_update_failed", icao=icao, error=str(exc))
                    await asyncio.sleep(1.0)  # Gentle delay between requests to avoid rate limits

            tasks = [fetch_and_cache(icao) for icao in icao_codes]
            await asyncio.gather(*tasks, return_exceptions=True)

            elapsed = time.time() - start_time
            logger.info(
                "Finished periodic weather cache update.", elapsed_seconds=round(elapsed, 2)
            )
            # Sleep until the next 30-minute system clock boundary (e.g. XX:00 or XX:30)
            sleep_seconds = 1800 - (time.time() % 1800)
            logger.info(
                "Sleeping until next system clock boundary...",
                sleep_seconds=round(sleep_seconds, 2),
            )
            await asyncio.sleep(sleep_seconds)
        except asyncio.CancelledError:
            logger.info("Weather cache update loop task cancelled.")
            break
        except Exception as exc:
            logger.error("weather_cache_loop_error", error=str(exc))
            # Sleep for 60 seconds to avoid a hot loop on errors
            try:
                await asyncio.sleep(60)
            except asyncio.CancelledError:
                logger.info("Weather cache update loop task cancelled during error cooldown.")
                break


def start_weather_cache_task() -> None:
    """Start the periodic weather update background loop."""
    global _weather_task
    if _weather_task is None or _weather_task.done():
        _weather_task = asyncio.create_task(update_weather_cache_loop())
        logger.info("Weather cache background task started.")


async def stop_weather_cache_task() -> None:
    """Stop the periodic weather update background loop."""
    global _weather_task
    if _weather_task and not _weather_task.done():
        logger.info("Stopping weather cache background task...")
        _weather_task.cancel()
        import contextlib

        with contextlib.suppress(asyncio.CancelledError):
            await _weather_task
        _weather_task = None
        logger.info("Weather cache background task stopped.")
