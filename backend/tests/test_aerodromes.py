import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_all_aerodromes(api_client: AsyncClient) -> None:
    """Test retrieving the list of aerodromes."""
    response = await api_client.get("/api/v1/aerodromes")
    assert response.status_code == 200

    data = response.json()
    assert isinstance(data, dict)
    assert "type" in data
    assert data["type"] == "FeatureCollection"
    assert "features" in data
    assert isinstance(data["features"], list)


@pytest.mark.asyncio
async def test_get_aerodrome_metadata_not_found(api_client: AsyncClient) -> None:
    """Test retrieving aerodrome metadata for a non-existent ICAO."""
    response = await api_client.get("/api/v1/aerodromes/XYZXYZ")
    assert response.status_code == 404
