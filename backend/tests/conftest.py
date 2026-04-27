import os
from unittest.mock import AsyncMock, MagicMock

import pytest
import pytest_asyncio

# 1. Environment Variables Mocking (Before anything else imports settings)
os.environ["POSTGRES_PASSWORD"] = "mock_db_password"
os.environ["MINIO_ACCESS_KEY"] = "mock_minio_access"
os.environ["MINIO_SECRET_KEY"] = "mock_minio_secret"
os.environ["DATABASE_URL"] = "postgresql+asyncpg://postgres:mock_db_password@localhost/test_db"
os.environ["POSTGRES_DB"] = "test_aeronautical_information_system"

from app.core.config import settings


@pytest.fixture(autouse=True)
def mock_weather_output_dir(tmp_path, monkeypatch):
    """Mock WEATHER_OUTPUT_DIR to use pytest's tmp_path."""
    d = tmp_path / "weather_output"
    d.mkdir()
    monkeypatch.setattr(settings, "WEATHER_OUTPUT_DIR", str(d))
    yield str(d)


@pytest.fixture(autouse=True)
def mock_gdal(monkeypatch):
    """Mock subprocess.run for GDAL commands."""
    mock_run = MagicMock()
    # If the process output needs to be read, we can mock it here
    monkeypatch.setattr("subprocess.run", mock_run)
    yield mock_run


@pytest.fixture(autouse=True)
def mock_boto3(monkeypatch):
    """Mock boto3 client."""
    mock_client = MagicMock()
    mock_boto3_module = MagicMock()
    mock_boto3_module.client.return_value = mock_client
    monkeypatch.setattr("boto3.client", mock_boto3_module.client)
    yield mock_client


@pytest.fixture(autouse=True)
def mock_httpx(monkeypatch):
    """Mock httpx.AsyncClient.get for weather scraping."""
    # Note: If tests need specific responses, they can modify this mock.
    mock_get = AsyncMock()
    mock_client_instance = MagicMock()
    mock_client_instance.get = mock_get

    # We need to mock httpx.AsyncClient as an async context manager or just the get method
    class MockAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return mock_client_instance

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

        get = mock_get

    monkeypatch.setattr("httpx.AsyncClient", MockAsyncClient)
    yield mock_get


from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession  # noqa: E402

from app.core.database import get_db  # noqa: E402
from app.main import app  # noqa: E402


@pytest_asyncio.fixture
async def db_session():
    """Mocked database session."""
    session = AsyncMock(spec=AsyncSession)

    # Make execute an AsyncMock that returns an object where fetchall / fetchone return lists/None instead of AsyncMocks
    async def mock_execute(*args, **kwargs):
        mock_result = MagicMock()
        mock_result.fetchall.return_value = []
        mock_result.fetchone.return_value = None
        mock_result.scalar_one_or_none.return_value = None
        return mock_result

    session.execute.side_effect = mock_execute
    session.scalar = AsyncMock()
    session.scalars = AsyncMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    session.refresh = AsyncMock()

    yield session


@pytest.fixture(autouse=True)
def mock_async_session_local(monkeypatch, db_session):
    """Mock AsyncSessionLocal used in health checks and elsewhere directly."""

    class MockSessionManager:
        async def __aenter__(self):
            return db_session

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

    monkeypatch.setattr("app.main.AsyncSessionLocal", MockSessionManager)
    monkeypatch.setattr("app.core.database.AsyncSessionLocal", MockSessionManager)
    yield db_session


@pytest.fixture(autouse=True)
def override_get_db(db_session):
    async def _get_db():
        yield db_session

    app.dependency_overrides[get_db] = _get_db
    yield
    # Clean up override
    app.dependency_overrides.pop(get_db, None)


@pytest_asyncio.fixture
async def api_client():
    """
    Provide an async API client for testing endpoints.
    Bypasses the real network and talks directly to the ASGI app.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client
