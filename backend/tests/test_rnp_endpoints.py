import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_rnp_procedures(api_client: AsyncClient, db_session) -> None:
    from unittest.mock import MagicMock

    mock_row = MagicMock()
    mock_row.procedure_id = 1
    mock_row.name = "RNP RWY 09"
    mock_row.runway = "09"
    mock_row.procedure_type = "APPROACH"
    mock_row.min_lng = 72.0
    mock_row.min_lat = 19.0
    mock_row.max_lng = 73.0
    mock_row.max_lat = 20.0

    async def mock_execute(*args, **kwargs):
        mock_result = MagicMock()
        mock_result.fetchall.return_value = [mock_row]
        return mock_result

    db_session.execute.side_effect = mock_execute

    response = await api_client.get("/api/v1/aerodromes/VABB/rnp-procedures")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["procedure_id"] == 1
    assert data[0]["name"] == "RNP RWY 09"
    assert data[0]["min_lng"] == 72.0


@pytest.mark.asyncio
async def test_list_rnp_procedures_none_bounds(api_client: AsyncClient, db_session) -> None:
    from unittest.mock import MagicMock

    mock_row = MagicMock()
    mock_row.procedure_id = 1
    mock_row.name = "RNP RWY 09"
    mock_row.runway = "09"
    mock_row.procedure_type = "APPROACH"
    mock_row.min_lng = None
    mock_row.min_lat = None
    mock_row.max_lng = None
    mock_row.max_lat = None

    async def mock_execute(*args, **kwargs):
        mock_result = MagicMock()
        mock_result.fetchall.return_value = [mock_row]
        return mock_result

    db_session.execute.side_effect = mock_execute

    response = await api_client.get("/api/v1/aerodromes/VABB/rnp-procedures")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["min_lng"] is None


@pytest.mark.asyncio
async def test_get_rnp_path_3d_not_found(api_client: AsyncClient, db_session) -> None:
    from unittest.mock import MagicMock

    async def mock_execute(*args, **kwargs):
        mock_result = MagicMock()
        mock_result.fetchone.return_value = None
        return mock_result

    db_session.execute.side_effect = mock_execute

    response = await api_client.get("/api/v1/rnp-procedures/999/path3d")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_rnp_path_3d_success(api_client: AsyncClient, db_session) -> None:
    from unittest.mock import MagicMock

    mock_proc = MagicMock()
    mock_proc.id = 1
    mock_proc.name = "RNP RWY 09"
    mock_proc.airport_id = "VABB"
    mock_proc.runway = "09"
    mock_proc.type = "APPROACH"

    mock_leg = MagicMock()
    mock_leg.sequence_nr = 10
    mock_leg.source_serial = "1"
    mock_leg.path_descriptor = "IF"
    mock_leg.waypoint_ident = "START"
    mock_leg.altitude_numeric = 3000.0
    mock_leg.altitude_constraint = "3000"
    mock_leg.role = "IF"
    mock_leg.course = None
    mock_leg.distance = None
    mock_leg.turn_direction = None
    mock_leg.lon = 72.5
    mock_leg.lat = 19.5

    # Actually fetchone returns a tuple
    call_count = 0

    async def mock_execute(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        mock_result = MagicMock()
        if call_count == 1:
            mock_result.fetchone.return_value = mock_proc
        elif call_count == 2:
            mock_result.fetchall.return_value = [mock_leg]
        elif call_count == 3:
            mock_result.fetchone.return_value = (
                [
                    {
                        "designation": "09",
                        "coordinates": {"decimal_lat": 19.1, "decimal_lng": 72.8},
                        "thr_elevation": "THR: 50.0FT",
                    }
                ],
            )
        return mock_result

    db_session.execute.side_effect = mock_execute

    response = await api_client.get("/api/v1/rnp-procedures/1/path3d")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_get_rnp_path_3d_success_runway_chars_no_coords(
    api_client: AsyncClient, db_session
) -> None:
    from unittest.mock import MagicMock

    mock_proc = MagicMock()
    mock_proc.id = 1
    mock_proc.name = "RNP RWY 09"
    mock_proc.airport_id = "VABB"
    mock_proc.runway = "09"
    mock_proc.type = "APPROACH"

    mock_leg = MagicMock()
    mock_leg.sequence_nr = 10
    mock_leg.source_serial = "1"
    mock_leg.path_descriptor = "IF"
    mock_leg.waypoint_ident = "START"
    mock_leg.altitude_numeric = 3000.0
    mock_leg.altitude_constraint = "3000"
    mock_leg.role = "IF"
    mock_leg.course = None
    mock_leg.distance = None
    mock_leg.turn_direction = None
    mock_leg.lon = 72.5
    mock_leg.lat = 19.5

    call_count = 0

    async def mock_execute(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        mock_result = MagicMock()
        if call_count == 1:
            mock_result.fetchone.return_value = mock_proc
        elif call_count == 2:
            mock_result.fetchall.return_value = [mock_leg]
        elif call_count == 3:
            # missing coords
            mock_result.fetchone.return_value = ([{"designation": "09", "coordinates": {}}],)
        return mock_result

    db_session.execute.side_effect = mock_execute

    response = await api_client.get("/api/v1/rnp-procedures/1/path3d")
    assert response.status_code == 200
    data = response.json()
    assert "approach_paths" in data


@pytest.mark.asyncio
async def test_get_rnp_path_3d_success_no_runway(api_client: AsyncClient, db_session) -> None:
    from unittest.mock import MagicMock

    mock_proc = MagicMock()
    mock_proc.id = 1
    mock_proc.name = "RNP RWY 09"
    mock_proc.airport_id = "VABB"
    # Null runway to hit branch where proc_row.airport_id and proc_row.runway is false
    mock_proc.runway = None
    mock_proc.type = "APPROACH"

    mock_leg = MagicMock()
    mock_leg.sequence_nr = 10
    mock_leg.source_serial = "1"
    mock_leg.path_descriptor = "IF"
    mock_leg.waypoint_ident = "START"
    mock_leg.altitude_numeric = 3000.0
    mock_leg.altitude_constraint = "3000"
    mock_leg.role = "IF"
    mock_leg.course = None
    mock_leg.distance = None
    mock_leg.turn_direction = None
    mock_leg.lon = 72.5
    mock_leg.lat = 19.5

    call_count = 0

    async def mock_execute(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        mock_result = MagicMock()
        if call_count == 1:
            mock_result.fetchone.return_value = mock_proc
        elif call_count == 2:
            mock_result.fetchall.return_value = [mock_leg]
        return mock_result

    db_session.execute.side_effect = mock_execute

    response = await api_client.get("/api/v1/rnp-procedures/1/path3d")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_get_rnp_path_3d_success_empty_runway_chars(
    api_client: AsyncClient, db_session
) -> None:
    from unittest.mock import MagicMock

    mock_proc = MagicMock()
    mock_proc.id = 1
    mock_proc.name = "RNP RWY 09"
    mock_proc.airport_id = "VABB"
    mock_proc.runway = "09"
    mock_proc.type = "APPROACH"

    mock_leg = MagicMock()
    mock_leg.sequence_nr = 10
    mock_leg.source_serial = "1"
    mock_leg.path_descriptor = "IF"
    mock_leg.waypoint_ident = "START"
    mock_leg.altitude_numeric = 3000.0
    mock_leg.altitude_constraint = "3000"
    mock_leg.role = "IF"
    mock_leg.course = None
    mock_leg.distance = None
    mock_leg.turn_direction = None
    mock_leg.lon = 72.5
    mock_leg.lat = 19.5

    call_count = 0

    async def mock_execute(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        mock_result = MagicMock()
        if call_count == 1:
            mock_result.fetchone.return_value = mock_proc
        elif call_count == 2:
            mock_result.fetchall.return_value = [mock_leg]
        elif call_count == 3:
            # ad_row is present but no match for target runway
            mock_result.fetchone.return_value = (
                [
                    {
                        "designation": "27",
                        "coordinates": {"decimal_lat": 19.1, "decimal_lng": 72.8},
                        "thr_elevation": "THR: 50.0FT",
                    }
                ],
            )
        return mock_result

    db_session.execute.side_effect = mock_execute

    response = await api_client.get("/api/v1/rnp-procedures/1/path3d")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_get_rnp_path_3d_success_no_runway_chars(api_client: AsyncClient, db_session) -> None:
    from unittest.mock import MagicMock

    mock_proc = MagicMock()
    mock_proc.id = 1
    mock_proc.name = "RNP RWY 09"
    mock_proc.airport_id = "VABB"
    mock_proc.runway = "09"
    mock_proc.type = "APPROACH"

    mock_leg = MagicMock()
    mock_leg.sequence_nr = 10
    mock_leg.source_serial = "1"
    mock_leg.path_descriptor = "IF"
    mock_leg.waypoint_ident = "START"
    mock_leg.altitude_numeric = 3000.0
    mock_leg.altitude_constraint = "3000"
    mock_leg.role = "IF"
    mock_leg.course = None
    mock_leg.distance = None
    mock_leg.turn_direction = None
    mock_leg.lon = 72.5
    mock_leg.lat = 19.5

    call_count = 0

    async def mock_execute(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        mock_result = MagicMock()
        if call_count == 1:
            mock_result.fetchone.return_value = mock_proc
        elif call_count == 2:
            mock_result.fetchall.return_value = [mock_leg]
        elif call_count == 3:
            mock_result.fetchone.return_value = None
        return mock_result

    db_session.execute.side_effect = mock_execute

    response = await api_client.get("/api/v1/rnp-procedures/1/path3d")
    assert response.status_code == 200
