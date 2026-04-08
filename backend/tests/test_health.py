import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_check_success(api_client: AsyncClient) -> None:
    """Test that the health check endpoint returns 200 OK and DB is connected."""
    response = await api_client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert data["database"] == "connected"
