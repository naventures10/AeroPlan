import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_active_notams(api_client: AsyncClient) -> None:
    """Test fetching active NOTAMs for a given FIR/Aerodrome."""
    response = await api_client.get("/api/notams/VOMF?active_only=true")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_get_notam_summary(api_client: AsyncClient) -> None:
    """Test fetching aggregated NOTAM statistics."""
    response = await api_client.get("/api/notams/summary")
    assert response.status_code == 200
    data = response.json()
    if isinstance(data, dict):
        assert "total_active" in data
    else:
        assert isinstance(data, list)
