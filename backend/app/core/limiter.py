from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings

# Use memory:// storage during tests to avoid external Redis/network dependencies
storage_uri = "memory://" if settings.ENVIRONMENT == "testing" else settings.redis_url

# Initialize Limiter with remote address (IP) as key, Redis/memory storage, and default rate limits
limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=storage_uri,
    default_limits=[settings.RATE_LIMIT_DEFAULT],
    swallow_errors=True,
    strategy="moving-window",
)
