import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_global_search_empty_query(api_client: AsyncClient) -> None:
    """Test that empty queries return bad request or empty list."""
    response = await api_client.get("/api/search?q=")
    assert response.status_code in (200, 422)


@pytest.mark.asyncio
@pytest.mark.skip(
    reason="FTS features require materialized views or text search vectors not created by create_all"
)
async def test_global_search_valid_query(api_client: AsyncClient) -> None:
    """Test a basic global search logic."""
    response = await api_client.get("/api/search?q=VOMF")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    if len(data) > 0:
        first_result = data[0]
        assert "type" in first_result
        assert "matched_text" in first_result
