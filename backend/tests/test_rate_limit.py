import pytest
from httpx import AsyncClient
from limits.storage import MemoryStorage
from slowapi.wrappers import LimitGroup

from app.core.limiter import limiter


@pytest.mark.asyncio
async def test_rate_limiting_triggers_429(api_client: AsyncClient) -> None:
    """Test that rate limiting works and returns 429 when the limit is exceeded."""
    original_limits = limiter._default_limits
    # Set a very low limit: 2 requests per minute
    limiter._default_limits = [
        LimitGroup("2/minute", limiter._key_func, None, False, None, None, None, 1, False)
    ]

    # Ensure memory storage is clear
    if isinstance(limiter._storage, MemoryStorage):
        limiter._storage.storage.clear()

    try:
        # 1st request -> success (200)
        response = await api_client.get("/api/v1/health")
        assert response.status_code == 200

        # 2nd request -> success (200)
        response = await api_client.get("/api/v1/health")
        assert response.status_code == 200

        # 3rd request -> rate limited (429)
        response = await api_client.get("/api/v1/health")
        assert response.status_code == 429
        assert response.json() == {"detail": "Rate limit exceeded"}
    finally:
        # Restore original limits and clear storage
        limiter._default_limits = original_limits
        if isinstance(limiter._storage, MemoryStorage):
            limiter._storage.storage.clear()
