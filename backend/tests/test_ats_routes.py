import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
async def test_get_ats_route_details_success(api_client: AsyncClient, db_session: AsyncSession) -> None:
    """
    Test retrieving full ATS route details.
    Seeds a dummy route and verifies the API returns it correctly.
    """
    # 1. Seed dummy data
    # We use raw SQL to avoid dependency on SQLAlchemy models for simple seeding in tests
    await db_session.execute(text("""
        INSERT INTO ats_routes (route_id, route_designator, route_type, remarks)
        VALUES ('TEST1', 'TEST (A-B)', 'CONVENTIONAL', 'Test remarks')
    """))

    await db_session.execute(text("""
        INSERT INTO ats_route_waypoints (route_id, sequence_number, waypoint_name, raw_coordinates, navaid_info)
        VALUES
        ('TEST1', 1, 'POINT A', '000000N 0000000E', 'VOR A'),
        ('TEST1', 2, 'POINT B', '010101N 0101010E', 'VOR B')
    """))

    await db_session.execute(text("""
        INSERT INTO ats_route_segments
        (route_id, sequence_number, track_magnetic, distance_nm, upper_limit, lower_limit, airspace_class, moca, lateral_limits)
        VALUES
        ('TEST1', 1, '090', 50.5, 'FL 460', 'FL 100', 'D', '2000 FT', '20 NM')
    """))

    await db_session.commit()

    # 2. Call API
    response = await api_client.get("/api/ats-routes/TEST1/details")

    # 3. Assertions
    assert response.status_code == 200
    data = response.json()

    assert data["route_id"] == "TEST1"
    assert data["route_designator"] == "TEST (A-B)"
    assert data["total_distance_nm"] == 50.5
    assert len(data["waypoints"]) == 2
    assert len(data["segments"]) == 1

    segment = data["segments"][0]
    assert segment["from_waypoint"] == "POINT A"
    assert segment["to_waypoint"] == "POINT B"
    assert segment["moca"] == "2000 FT"
    assert "mea" not in segment  # Ensure rename is reflected in API

@pytest.mark.asyncio
async def test_get_ats_route_details_not_found(api_client: AsyncClient) -> None:
    """Test 404 for non-existent route."""
    response = await api_client.get("/api/ats-routes/NONEXISTENT/details")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()
