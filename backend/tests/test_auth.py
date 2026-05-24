import uuid
from datetime import UTC
from unittest.mock import MagicMock

import pytest
from httpx import AsyncClient

from app.core.security import get_password_hash
from app.models.user import User

pytestmark = pytest.mark.asyncio


async def test_register_new_user(api_client: AsyncClient, db_session):
    mock_scalars = MagicMock()
    mock_scalars.first.return_value = None
    mock_result = MagicMock()
    mock_result.scalars.return_value = mock_scalars
    db_session.execute.side_effect = None
    db_session.execute.return_value = mock_result

    def mock_add(user):
        from datetime import datetime

        user.id = uuid.uuid4()
        user.is_active = True
        user.created_at = datetime.now(UTC)
        user.updated_at = datetime.now(UTC)
        return user

    db_session.add.side_effect = mock_add

    response = await api_client.post(
        "/api/v1/auth/register", json={"email": "test@example.com", "password": "securepassword"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "test@example.com"
    assert data["is_active"] is True
    assert "id" in data


async def test_register_existing_user(api_client: AsyncClient, db_session):
    existing_user = User(email="test@example.com", hashed_password="hashed")
    mock_scalars = MagicMock()
    mock_scalars.first.return_value = existing_user
    mock_result = MagicMock()
    mock_result.scalars.return_value = mock_scalars
    db_session.execute.side_effect = None
    db_session.execute.return_value = mock_result

    response = await api_client.post(
        "/api/v1/auth/register", json={"email": "test@example.com", "password": "securepassword"}
    )
    assert response.status_code == 400


async def test_login_success(api_client: AsyncClient, db_session):
    password = "securepassword"
    existing_user = User(
        id=uuid.uuid4(),
        email="test@example.com",
        hashed_password=get_password_hash(password),
        is_active=True,
    )
    mock_scalars = MagicMock()
    mock_scalars.first.return_value = existing_user
    mock_result = MagicMock()
    mock_result.scalars.return_value = mock_scalars
    db_session.execute.side_effect = None
    db_session.execute.return_value = mock_result

    response = await api_client.post(
        "/api/v1/auth/login", json={"email": "test@example.com", "password": "securepassword"}
    )
    assert response.status_code == 200
    assert response.json()["message"] == "Successfully logged in"
    assert "access_token" in response.cookies


async def test_login_wrong_password(api_client: AsyncClient, db_session):
    password = "securepassword"
    existing_user = User(
        id=uuid.uuid4(),
        email="test@example.com",
        hashed_password=get_password_hash(password),
        is_active=True,
    )
    mock_scalars = MagicMock()
    mock_scalars.first.return_value = existing_user
    mock_result = MagicMock()
    mock_result.scalars.return_value = mock_scalars
    db_session.execute.side_effect = None
    db_session.execute.return_value = mock_result

    response = await api_client.post(
        "/api/v1/auth/login", json={"email": "test@example.com", "password": "wrongpassword"}
    )
    assert response.status_code == 400


async def test_logout(api_client: AsyncClient):
    response = await api_client.post("/api/v1/auth/logout")
    assert response.status_code == 200
    assert response.json()["message"] == "Successfully logged out"
