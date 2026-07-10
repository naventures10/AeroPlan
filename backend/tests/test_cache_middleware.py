import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_cache_middleware_get_miss_and_hit(api_client: AsyncClient, mock_redis) -> None:
    """Test that a GET request results in a cache miss, writes to cache, and subsequent requests hit the cache."""
    # 1. First Request: Cache Miss
    # Reset mock calls
    mock_redis.get.reset_mock()
    mock_redis.set.reset_mock()

    # Mock Redis to return None (Cache Miss)
    mock_redis.get.return_value = None

    response = await api_client.get("/api/v1/aerodromes")
    assert response.status_code == 200
    # The header should be MISS or absent depending on timing, but it should have attempted to write to cache
    mock_redis.get.assert_called_once()
    mock_redis.set.assert_called_once()

    # 2. Second Request: Cache Hit
    # Mock Redis to return a cached response
    mock_redis.get.reset_mock()
    mock_redis.get.return_value = (
        '{"body": "{\\"cached\\": true}", "status_code": 200, "media_type": "application/json"}'
    )

    response2 = await api_client.get("/api/v1/aerodromes")
    assert response2.status_code == 200
    assert response2.headers.get("X-Cache") == "HIT"
    assert response2.json() == {"cached": True}
    mock_redis.get.assert_called_once()


@pytest.mark.asyncio
async def test_cache_middleware_excluded_paths(api_client: AsyncClient, mock_redis) -> None:
    """Test that health checks and auth paths bypass the cache completely."""
    mock_redis.get.reset_mock()
    mock_redis.set.reset_mock()

    # Request health check
    response = await api_client.get("/api/v1/health")
    assert response.status_code == 200

    # Assert no cache lookup/write occurred for health check
    mock_redis.get.assert_not_called()
    mock_redis.set.assert_not_called()

    # Request auth/me
    await api_client.get("/api/v1/auth/me")
    # Even if unauthorized (e.g. 401), cache middleware shouldn't process/look up auth
    mock_redis.get.assert_not_called()
    mock_redis.set.assert_not_called()


@pytest.mark.asyncio
async def test_cache_middleware_non_get_requests(api_client: AsyncClient, mock_redis) -> None:
    """Test that POST or other HTTP methods are never looked up or saved in cache."""
    mock_redis.get.reset_mock()
    mock_redis.set.reset_mock()

    # Post to register (returns validation error 422 because of empty request body, but triggers route)
    await api_client.post("/api/v1/auth/register", json={})

    # Verify no cache interactions
    mock_redis.get.assert_not_called()
    mock_redis.set.assert_not_called()
