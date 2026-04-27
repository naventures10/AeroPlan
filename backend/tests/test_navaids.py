import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
async def test_get_navaid_details_success(
    api_client: AsyncClient, db_session: AsyncSession
) -> None:
    """Test fetching navaid details successfully."""
    from unittest.mock import MagicMock

    navaid_mock = MagicMock()
    navaid_mock.station_name = "COCHIN DVOR /DME"
    navaid_mock.ident = "CIB"
    navaid_mock.aid_type = "DVOR"
    navaid_mock.frequency = "117.300MHZ"
    navaid_mock.hours_of_operation = "H24"
    navaid_mock.elevation = "155.18 FT"
    navaid_mock.remarks = "THIS IS A TEST REMARK"
    navaid_mock.raw_coordinates = "100700.80N 0764050.10E"

    async def mock_execute(*args, **kwargs):
        mock_result = MagicMock()
        mock_result.fetchone.return_value = navaid_mock
        return mock_result

    db_session.execute.side_effect = mock_execute

    response = await api_client.get("/api/v1/navaids/CIB")
    assert response.status_code == 200
    data = response.json()
    assert data["ident"] == "CIB"
    assert data["remarks"] == "THIS IS A TEST REMARK"
    assert data["station_name"] == "COCHIN DVOR /DME"


@pytest.mark.asyncio
async def test_get_navaid_details_not_found(api_client: AsyncClient) -> None:
    """Test fetching navaid details for a non-existent identifier."""
    response = await api_client.get("/api/v1/navaids/NONEXISTENT")
    assert response.status_code == 404
