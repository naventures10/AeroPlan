import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_daylight(api_client: AsyncClient, db_session) -> None:
    from datetime import date, time
    from unittest.mock import MagicMock

    mock_result = MagicMock()
    # Need to return DaylightRow-like objects
    class DaylightRow:
        def __init__(self):
            self.airport_icao = "VOMF"
            self.airport_name = "CHENNAI"
            self.date = date(2026, 3, 18)
            self.twilight_from = time(5, 30)
            self.sunrise = time(6, 0)
            self.sunset = time(18, 0)
            self.twilight_to = time(18, 30)

    mock_result.fetchall.return_value = [
        DaylightRow()
    ]
    db_session.execute.return_value = mock_result

    # Use monkeypatch/mock side_effect properly to match MagicMock behaviour since result is reused

    async def mock_execute(*args, **kwargs):
        return mock_result

    db_session.execute.side_effect = mock_execute

    # Current month
    response = await api_client.get("/api/v1/daylight/VOMF")
    assert response.status_code == 200
    data = response.json()
    assert len(data["records"]) == 1

    # Specific month
    response = await api_client.get("/api/v1/daylight/VOMF?month=3")
    assert response.status_code == 200

    # Specific date
    response = await api_client.get("/api/v1/daylight/VOMF?date=2026-03-18")
    assert response.status_code == 200

    # Invalid date
    response = await api_client.get("/api/v1/daylight/VOMF?date=invalid")
    assert response.status_code == 400

    # Empty
    mock_result.fetchall.return_value = []
    response = await api_client.get("/api/v1/daylight/VOMF")
    assert response.status_code == 404
