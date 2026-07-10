import json
from typing import Any

import structlog
from redis.asyncio import Redis, from_url

from app.core.config import settings

logger = structlog.get_logger()

redis_client: Redis | None = None


async def init_redis() -> Redis:
    """
    Initialise the global Redis connection pool.
    """
    global redis_client
    if redis_client is None:
        logger.info("Initializing Redis client connection pool...", url=settings.redis_url)
        redis_client = from_url(settings.redis_url, decode_responses=True)
    return redis_client


async def close_redis() -> None:
    """
    Close the global Redis client and connection pool.
    """
    global redis_client
    if redis_client is not None:
        logger.info("Closing Redis client...")
        await redis_client.close()
        redis_client = None


def get_redis() -> Redis:
    """
    Get the global Redis client.
    Raises RuntimeError if Redis client is not initialized.
    """
    if redis_client is None:
        raise RuntimeError("Redis client is not initialized. Call init_redis() first.")
    return redis_client


async def get_cached_json(key: str) -> Any | None:
    """
    Get and decode JSON value from Redis by key.
    Returns None if key doesn't exist or on Redis error.
    """
    try:
        client = get_redis()
        data = await client.get(key)
        if data:
            return json.loads(data)
    except Exception as exc:
        logger.warning("redis_cache_get_failed", key=key, error=str(exc))
    return None


async def set_cached_json(key: str, value: Any, ttl_seconds: int = 3600) -> bool:
    """
    Encode value as JSON and store it in Redis with an optional TTL.
    Returns True if stored successfully, False otherwise.
    """
    try:
        client = get_redis()
        serialized = json.dumps(value)
        await client.set(key, serialized, ex=ttl_seconds)
        return True
    except Exception as exc:
        logger.warning("redis_cache_set_failed", key=key, error=str(exc))
        return False
