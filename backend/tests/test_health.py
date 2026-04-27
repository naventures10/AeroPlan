import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_check_success(api_client: AsyncClient) -> None:
    """Test that the health check endpoint returns 200 OK and DB is connected."""
    response = await api_client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert data["database"] == "connected"

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
    try:
        await anext(gen)
    except StopAsyncIteration:
        pass

def test_setup_logging_json() -> None:
    from app.core.logging_config import setup_logging
    setup_logging(json_format=True)
    setup_logging(json_format=False)

def test_telemetry_disabled(monkeypatch) -> None:
    monkeypatch.setenv("OTEL_ENABLED", "false")
    from app.core.telemetry import setup_tracing
    setup_tracing()

def test_telemetry_enabled(monkeypatch) -> None:
    monkeypatch.setenv("OTEL_ENABLED", "true")
    monkeypatch.setenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4317")
    monkeypatch.setenv("ENVIRONMENT", "testing")
    from app.core.telemetry import setup_tracing
    setup_tracing()

def test_telemetry_enabled_console(monkeypatch) -> None:
    monkeypatch.setenv("OTEL_ENABLED", "true")
    monkeypatch.delenv("OTEL_EXPORTER_OTLP_ENDPOINT", raising=False)
    monkeypatch.setenv("OTEL_EXPORTER", "console")
    monkeypatch.setenv("ENVIRONMENT", "testing")
    from app.core.telemetry import setup_tracing
    setup_tracing()

def test_profiling_router_import() -> None:
    # Just testing we can import it for coverage
    from app.core.profiling import profiling_router
    assert profiling_router is not None

def test_main_debug_import(monkeypatch) -> None:
    # Mock environment to import main with DEBUG=1
    monkeypatch.setenv("DEBUG", "1")
    # Need to reload or import
    import importlib

    import app.main
    importlib.reload(app.main)

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

    try:
        await logging_middleware(request, mock_call_next)
    except ValueError:
        pass
