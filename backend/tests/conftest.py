"""
Pytest configuration and shared fixtures for backend testing.
"""

import os

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import NullPool
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Force the application to use a dedicated test database
os.environ["POSTGRES_DB"] = "test_aeronautical_information_system"

from app import models  # noqa: F401 - Ensure all models are registered on Base
from app.config import settings
from app.database import Base, get_db
from app.main import app

# Create a test-specific async engine
test_engine = create_async_engine(settings.database_url, echo=False, poolclass=NullPool)
TestingSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def override_get_db():
    """Dependency override to yield the test database session."""
    async with TestingSessionLocal() as session:
        yield session


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="session", autouse=True)
async def setup_test_db():
    """Create all tables in the test database before the test session starts."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def db_session():
    """Provide a database session fixture for direct database interactions in tests."""
    async with TestingSessionLocal() as session:
        yield session


@pytest.fixture
async def api_client():
    """
    Provide an async API client for testing endpoints.
    Bypasses the real network and talks directly to the ASGI app.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client
