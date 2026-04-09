import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.navigation import RadioNavAid


@pytest.mark.asyncio
async def test_get_navaid_details_success(
    api_client: AsyncClient, db_session: AsyncSession
) -> None:
    """Test fetching navaid details successfully."""
    # Seed data
    navaid = RadioNavAid(
        station_name="COCHIN DVOR /DME",
        ident="CIB",
        aid_type="DVOR",
        frequency="117.300MHZ",
        hours_of_operation="H24",
        elevation="155.18 FT",
        remarks="THIS IS A TEST REMARK",
        raw_coordinates="100700.80N 0764050.10E",
    )
    db_session.add(navaid)
    await db_session.commit()

    response = await api_client.get("/api/navaids/CIB")
    assert response.status_code == 200
    data = response.json()
    assert data["ident"] == "CIB"
    assert data["remarks"] == "THIS IS A TEST REMARK"
    assert data["station_name"] == "COCHIN DVOR /DME"


@pytest.mark.asyncio
async def test_get_navaid_details_not_found(api_client: AsyncClient) -> None:
    """Test fetching navaid details for a non-existent identifier."""
    response = await api_client.get("/api/navaids/NONEXISTENT")
    assert response.status_code == 404
