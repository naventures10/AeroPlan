import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_ats_route_labels(api_client: AsyncClient, db_session, monkeypatch) -> None:
    """Test fetching ats route labels."""
    import app.api.v1.endpoints.ats_routes as routes
    monkeypatch.setattr(routes, "_labels_cache", {"data": None, "ts": 0.0})

    from unittest.mock import MagicMock
    mock_result = MagicMock()
    # Need to return a dict structure to pass GeoJsonFeatureCollection checks
    mock_result.fetchone.return_value = ({
        "type": "FeatureCollection",
        "features": [{"type": "Feature", "geometry": {"type": "Point", "coordinates": [0,0]}, "properties": {}}]
    },)

    async def mock_execute(*args, **kwargs):
        return mock_result

    db_session.execute.side_effect = mock_execute

    response = await api_client.get("/api/v1/ats-route-labels")
    assert response.status_code == 200

    data = response.json()
    assert isinstance(data, dict)
    assert data["type"] == "FeatureCollection"
    assert len(data["features"]) == 1

    # Hit cache branch
    response2 = await api_client.get("/api/v1/ats-route-labels")
    assert response2.status_code == 200


@pytest.mark.asyncio
async def test_get_ats_route_labels_empty(api_client: AsyncClient, db_session, monkeypatch) -> None:
    """Test fetching ats route labels empty fallback."""
    # Reset cache
    import app.api.v1.endpoints.ats_routes as routes
    monkeypatch.setattr(routes, "_labels_cache", {"data": None, "ts": 0.0})

    from unittest.mock import MagicMock
    mock_result = MagicMock()
    mock_result.fetchone.return_value = None
    db_session.execute.return_value = mock_result

    response = await api_client.get("/api/v1/ats-route-labels")
    assert response.status_code == 200
    assert response.json()["features"] == []


@pytest.mark.asyncio
async def test_get_ats_route_details_success(
    api_client: AsyncClient, db_session
) -> None:
    """
    Test retrieving full ATS route details.
    Seeds a dummy route and verifies the API returns it correctly.
    """
    # 1. Setup mock data
    from collections import namedtuple
    from unittest.mock import MagicMock

    RouteRow = namedtuple("RouteRow", ["route_id", "route_designator", "route_type", "remarks"])
    WaypointRow = namedtuple("WaypointRow", ["sequence_number", "waypoint_name", "raw_coordinates", "navaid_info"])
    SegmentRow = namedtuple("SegmentRow", ["sequence_number", "from_waypoint", "to_waypoint", "from_coordinates", "to_coordinates", "track_magnetic", "distance_nm", "upper_limit", "lower_limit", "airspace_class", "moca", "lateral_limits", "direction_odd", "direction_even"])

    mock_route_result = MagicMock()
    mock_route_result.fetchone.return_value = RouteRow("TEST1", "TEST (A-B)", "CONVENTIONAL", "Test remarks")

    mock_wp_result = MagicMock()
    mock_wp_result.fetchall.return_value = [
        WaypointRow(1, "POINT A", "000000N 0000000E", "VOR A"),
        WaypointRow(2, "POINT B", "010101N 0101010E", "VOR B"),
    ]

    mock_seg_result = MagicMock()
    mock_seg_result.fetchall.return_value = [
        SegmentRow(1, "POINT A", "POINT B", "000000N 0000000E", "010101N 0101010E", "090", 50.5, "FL 460", "FL 100", "D", "2000 FT", "20 NM", None, None),
        SegmentRow(2, "POINT B", "POINT C", "010101N 0101010E", "020202N 0202020E", "090", None, "FL 460", "FL 100", "D", "2000 FT", "20 NM", None, None)
    ]

    async def mock_execute(query, params=None):
        query_str = str(query).lower()
        if "from ats_routes" in query_str:
            return mock_route_result
        if "from ats_route_waypoints" in query_str:
            return mock_wp_result
        if "from ats_route_segments" in query_str:
            return mock_seg_result
        return MagicMock()

    db_session.execute.side_effect = mock_execute

    # 2. Call API
    response = await api_client.get("/api/v1/ats-routes/TEST1/details")

    # 3. Assertions
    assert response.status_code == 200
    data = response.json()

    assert data["route_id"] == "TEST1"
    assert data["route_designator"] == "TEST (A-B)"
    assert data["total_distance_nm"] == 50.5
    assert len(data["waypoints"]) == 2
    assert len(data["segments"]) == 2

    segment = data["segments"][0]
    assert segment["from_waypoint"] == "POINT A"
    assert segment["to_waypoint"] == "POINT B"
    assert segment["moca"] == "2000 FT"
    assert "mea" not in segment  # Ensure rename is reflected in API


@pytest.mark.asyncio
async def test_get_ats_route_details_not_found(api_client: AsyncClient, db_session) -> None:
    """Test 404 for non-existent route."""
    from unittest.mock import MagicMock
    mock_result = MagicMock()
    mock_result.fetchone.return_value = None
    db_session.execute.return_value = mock_result

    response = await api_client.get("/api/v1/ats-routes/NONEXISTENT/details")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()
