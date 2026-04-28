import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_notams_by_airport(api_client: AsyncClient, db_session) -> None:
    from datetime import UTC, datetime
    from unittest.mock import MagicMock

    mock_notam = MagicMock()
    mock_notam.notam_id = "A0001/23"
    mock_notam.source_file = "test.txt"
    mock_notam.series = "A"
    mock_notam.scope = "AE"
    mock_notam.fir = "VABF"
    mock_notam.combined_fir = "false"
    mock_notam.airport_icao = "VABB"
    mock_notam.valid_from = datetime.now(UTC)
    mock_notam.valid_to = datetime.now(UTC)
    mock_notam.is_permanent = False
    mock_notam.is_estimated = False
    mock_notam.duration_category = "TEMPORARY"
    mock_notam.description = "Test NOTAM"

    async def mock_execute(*args, **kwargs):
        mock_result = MagicMock()
        mock_result.fetchall.return_value = [mock_notam]
        return mock_result

    db_session.execute.side_effect = mock_execute

    response = await api_client.get("/api/v1/notams/VABB?active_only=true")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["notam_id"] == "A0001/23"
    assert data[0]["airport_icao"] == "VABB"


@pytest.mark.asyncio
async def test_get_notams_by_fir(api_client: AsyncClient, db_session) -> None:
    from datetime import UTC, datetime
    from unittest.mock import MagicMock

    mock_notam = MagicMock()
    mock_notam.notam_id = "A0002/23"
    mock_notam.source_file = "test.txt"
    mock_notam.series = "A"
    mock_notam.scope = "AE"
    mock_notam.fir = "VABF"
    mock_notam.combined_fir = "false"
    mock_notam.airport_icao = "VABB"
    mock_notam.valid_from = datetime.now(UTC)
    mock_notam.valid_to = datetime.now(UTC)
    mock_notam.is_permanent = False
    mock_notam.is_estimated = False
    mock_notam.duration_category = "TEMPORARY"
    mock_notam.description = "Test NOTAM FIR"

    async def mock_execute(*args, **kwargs):
        mock_result = MagicMock()
        mock_result.fetchall.return_value = [mock_notam]
        return mock_result

    db_session.execute.side_effect = mock_execute

    response = await api_client.get("/api/v1/notams/fir/VABF?active_only=false")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["notam_id"] == "A0002/23"
    assert data[0]["fir"] == "VABF"


@pytest.mark.asyncio
async def test_get_all_notams(api_client: AsyncClient, db_session) -> None:
    from datetime import UTC, datetime
    from unittest.mock import MagicMock

    mock_notam = MagicMock()
    mock_notam.notam_id = "A0003/23"
    mock_notam.source_file = "test.txt"
    mock_notam.series = "A"
    mock_notam.scope = "AE"
    mock_notam.fir = "VABF"
    mock_notam.combined_fir = "false"
    mock_notam.airport_icao = "VABB"
    mock_notam.valid_from = datetime.now(UTC)
    mock_notam.valid_to = datetime.now(UTC)
    mock_notam.is_permanent = False
    mock_notam.is_estimated = False
    mock_notam.duration_category = "TEMPORARY"
    mock_notam.description = "Test NOTAM All"

    async def mock_execute(*args, **kwargs):
        mock_result = MagicMock()
        mock_result.fetchall.return_value = [mock_notam]
        return mock_result

    db_session.execute.side_effect = mock_execute

    response = await api_client.get("/api/v1/notams")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["notam_id"] == "A0003/23"


@pytest.mark.asyncio
async def test_get_all_notams_with_icao_and_active(api_client: AsyncClient, db_session) -> None:
    from datetime import UTC, datetime
    from unittest.mock import MagicMock

    mock_notam = MagicMock()
    mock_notam.notam_id = "A0004/23"
    mock_notam.source_file = "test.txt"
    mock_notam.series = "A"
    mock_notam.scope = "AE"
    mock_notam.fir = "VABF"
    mock_notam.combined_fir = "false"
    mock_notam.airport_icao = "VABB"
    mock_notam.valid_from = datetime.now(UTC)
    mock_notam.valid_to = datetime.now(UTC)
    mock_notam.is_permanent = False
    mock_notam.is_estimated = False
    mock_notam.duration_category = "TEMPORARY"
    mock_notam.description = "Test NOTAM Filters"

    async def mock_execute(*args, **kwargs):
        mock_result = MagicMock()
        mock_result.fetchall.return_value = [mock_notam]
        return mock_result

    db_session.execute.side_effect = mock_execute

    response = await api_client.get("/api/v1/notams?icao=VABB&active_only=true")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["notam_id"] == "A0004/23"
    assert data[0]["airport_icao"] == "VABB"
