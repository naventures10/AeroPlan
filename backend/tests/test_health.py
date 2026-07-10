import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_check_success(api_client: AsyncClient) -> None:
    """Test that the health check endpoint returns 200 OK and DB/Redis are connected."""
    response = await api_client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert data["database"] == "connected"
    assert data["redis"] == "connected"


@pytest.mark.asyncio
async def test_health_check_redis_error(api_client: AsyncClient, monkeypatch) -> None:
    """Test health check when Redis is down."""
    from unittest.mock import AsyncMock

    mock_failing_redis = AsyncMock()
    mock_failing_redis.ping.side_effect = Exception("Redis Down")

    monkeypatch.setattr("app.core.redis.get_redis", lambda: mock_failing_redis)

    response = await api_client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert data["database"] == "connected"
    assert data["redis"] == "error"


@pytest.mark.asyncio
async def test_health_check_db_error(api_client: AsyncClient, monkeypatch) -> None:
    """Test health check when the DB is down."""
    import app.main as main_app

    class MockFailingSession:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

        async def execute(self, *args, **kwargs):
            raise Exception("DB Down")

    monkeypatch.setattr(main_app, "AsyncSessionLocal", MockFailingSession)

    response = await api_client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert data["database"] == "error"


@pytest.mark.asyncio
async def test_get_db() -> None:
    from app.core.database import get_db

    gen = get_db()
    session = await anext(gen)
    assert session is not None
    # We expect anext to raise StopAsyncIteration
    import contextlib

    with contextlib.suppress(StopAsyncIteration):
        await anext(gen)


def test_setup_logging_json() -> None:
    from app.core.logging_config import setup_logging

    setup_logging(json_format=True)
    setup_logging(json_format=False)


@pytest.mark.asyncio
async def test_unhandled_exception_route(api_client: AsyncClient) -> None:
    # We can invoke the handler manually instead to get the coverage.
    from fastapi import Request

    from app.main import logging_middleware, unhandled_exception_handler

    # Just mock a request
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/foo",
        "url": "http://test/foo",
        "headers": [],
    }
    request = Request(scope)

    exc = ValueError("Intentional Error")
    response = await unhandled_exception_handler(request, exc)
    assert response.status_code == 500

    # Also test the middleware branch
    async def mock_call_next(req):
        raise ValueError("Intentional middleware error")

    import contextlib

    with contextlib.suppress(ValueError):
        await logging_middleware(request, mock_call_next)
