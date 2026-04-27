import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_global_search_empty_query(api_client: AsyncClient) -> None:
    """Test that empty queries return bad request or empty list."""
    response = await api_client.get("/api/v1/search?q=")
    assert response.status_code == 200
    assert response.json() == []

@pytest.mark.asyncio
async def test_global_search_whitespace_query(api_client: AsyncClient) -> None:
    """Test that queries with only whitespace return empty list."""
    response = await api_client.get("/api/v1/search?q=   ")
    assert response.status_code == 200
    assert response.json() == []

@pytest.mark.asyncio
async def test_global_search_no_regex_fallback(api_client: AsyncClient, db_session) -> None:
    """Test fallback when no safe regex tokens are generated."""
    from unittest.mock import MagicMock

    mock_row = MagicMock()
    mock_row.id = "!"
    mock_row.name = "!"
    mock_row.type = "WAYPOINT"
    mock_row.lng = None
    mock_row.lat = None
    mock_row.min_lng = None
    mock_row.min_lat = None
    mock_row.max_lng = None
    mock_row.max_lat = None
    mock_row.route_type = None
    mock_row.properties = {}
    # We must explicitly define it as having no route_type attribute or have it set
    del mock_row.route_type
    del mock_row.properties

    async def mock_execute(*args, **kwargs):
        mock_result = MagicMock()
        mock_result.fetchall.return_value = [mock_row]
        return mock_result

    db_session.execute.side_effect = mock_execute

    response = await api_client.get("/api/v1/search?q=!")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == "!"
    assert data[0]["route_type"] is None
    assert data[0]["properties"] == {}


@pytest.mark.asyncio
async def test_global_search_valid_query(api_client: AsyncClient, db_session) -> None:
    """Test a basic global search logic with mocked DB."""
    from unittest.mock import MagicMock

    mock_row1 = MagicMock()
    mock_row1.id = "VOMF"
    mock_row1.name = "CHENNAI FIR"
    mock_row1.type = "AERODROME"
    mock_row1.lng = 80.0
    mock_row1.lat = 13.0
    mock_row1.min_lng = None
    mock_row1.min_lat = None
    mock_row1.max_lng = None
    mock_row1.max_lat = None
    mock_row1.route_type = None
    mock_row1.properties = {"airport_name": "CHENNAI FIR"}

    mock_row2 = MagicMock()
    mock_row2.id = "V4"
    mock_row2.name = "V4"
    mock_row2.type = "ATS_ROUTE"
    mock_row2.lng = 75.0
    mock_row2.lat = 10.0
    mock_row2.min_lng = 74.0
    mock_row2.min_lat = 9.0
    mock_row2.max_lng = 76.0
    mock_row2.max_lat = 11.0
    mock_row2.route_type = "RNAV"
    mock_row2.properties = {"route_designator": "V4"}

    async def mock_execute(*args, **kwargs):
        mock_result = MagicMock()
        mock_result.fetchall.return_value = [mock_row1, mock_row2]
        return mock_result

    db_session.execute.side_effect = mock_execute

    response = await api_client.get("/api/v1/search?q=VOMF")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 2

    first_result = data[0]
    assert first_result["type"] == "AERODROME"
    assert first_result["id"] == "VOMF"
    assert first_result["center"] == [80.0, 13.0]

    second_result = data[1]
    assert second_result["type"] == "ATS_ROUTE"
    assert second_result["bounds"] == [74.0, 9.0, 76.0, 11.0]

@pytest.mark.asyncio
async def test_global_search_alphanumeric_split(api_client: AsyncClient, db_session) -> None:
    """Test search logic tokenizing complex queries like 'V4' into 'V' and '4'."""
    from unittest.mock import MagicMock

    mock_row = MagicMock()
    mock_row.id = "V4"
    mock_row.name = "V4"
    mock_row.type = "ATS_ROUTE"
    mock_row.lng = None
    mock_row.lat = None
    mock_row.min_lng = None
    mock_row.min_lat = None
    mock_row.max_lng = None
    mock_row.max_lat = None
    mock_row.route_type = "RNAV"
    mock_row.properties = {}

    async def mock_execute(*args, **kwargs):
        # params are passed as second positional argument in db.execute
        params = args[1]
        assert "V" in params["regex_term"] or "4" in params["regex_term"]
        mock_result = MagicMock()
        mock_result.fetchall.return_value = [mock_row]
        return mock_result

    db_session.execute.side_effect = mock_execute

    response = await api_client.get("/api/v1/search?q=V-4")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == "V4"
    assert data[0]["center"] is None
