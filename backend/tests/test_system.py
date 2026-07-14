from unittest.mock import MagicMock

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
async def test_get_system_airac_success(api_client: AsyncClient, db_session: AsyncSession) -> None:
    """Test fetching the active AIRAC cycle successfully."""
    mock_row = MagicMock()
    mock_row.__getitem__.return_value = "eAIP India AMDT 02/2026 (Effective Date: 19 MAR 2026)"

    async def mock_execute(*args, **kwargs):
        mock_result = MagicMock()
        mock_result.fetchone.return_value = mock_row
        return mock_result

    db_session.execute.side_effect = mock_execute

    response = await api_client.get("/api/v1/system/airac")
    assert response.status_code == 200
    data = response.json()
    assert data["effective_date"] == "19 Mar 2026 UTC"
    assert data["next_date"] == "16 Apr 2026 UTC"


@pytest.mark.asyncio
async def test_get_system_airac_not_found(
    api_client: AsyncClient, db_session: AsyncSession
) -> None:
    """Test fetching the active AIRAC cycle when not found."""

    async def mock_execute(*args, **kwargs):
        mock_result = MagicMock()
        mock_result.fetchone.return_value = None
        return mock_result

    db_session.execute.side_effect = mock_execute

    response = await api_client.get("/api/v1/system/airac")
    assert response.status_code == 404
    data = response.json()
    assert data["detail"] == "AIRAC cycle information not found"
