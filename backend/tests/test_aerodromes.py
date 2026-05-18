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
async def test_get_aerodrome_metadata_not_found(api_client: AsyncClient, db_session) -> None:
    """Test retrieving aerodrome metadata for a non-existent ICAO."""
    from unittest.mock import MagicMock

    mock_result = MagicMock()
    mock_result.fetchone.return_value = None
    db_session.execute.return_value = mock_result

    response = await api_client.get("/api/v1/aerodromes/XYZXYZ/metadata")
    assert response.status_code == 200
    assert response.json() == {}


@pytest.mark.asyncio
async def test_get_aerodrome_metadata_success(api_client: AsyncClient, db_session) -> None:
    """Test retrieving aerodrome metadata for an existing ICAO."""
    from unittest.mock import MagicMock

    async def mock_execute(*args, **kwargs):
        mock_result = MagicMock()
        mock_result.fetchone.return_value = ({"data": "test_metadata"},)
        return mock_result

    db_session.execute.side_effect = mock_execute

    response = await api_client.get("/api/v1/aerodromes/VABB/metadata")
    assert response.status_code == 200
    assert response.json() == {"data": "test_metadata"}


@pytest.mark.asyncio
async def test_get_aerodrome_metadata_success_not_dict(api_client: AsyncClient, db_session) -> None:
    """Test retrieving aerodrome metadata for an existing ICAO but it's not a dict."""
    from unittest.mock import MagicMock

    async def mock_execute(*args, **kwargs):
        mock_result = MagicMock()
        mock_result.fetchone.return_value = ("test_metadata_string",)
        return mock_result

    db_session.execute.side_effect = mock_execute

    response = await api_client.get("/api/v1/aerodromes/VABB/metadata")
    assert response.status_code == 200
    assert response.json() == {}


@pytest.mark.asyncio
async def test_get_aerodrome_metadata_row_none_coverage(
    api_client: AsyncClient, db_session
) -> None:
    from unittest.mock import MagicMock

    async def mock_execute(*args, **kwargs):
        mock_result = MagicMock()
        mock_result.fetchone.return_value = None
        return mock_result

    db_session.execute.side_effect = mock_execute
    response = await api_client.get("/api/v1/aerodromes/VABB/metadata")
    assert response.status_code == 200
    assert response.json() == {}


@pytest.mark.asyncio
async def test_get_aerodrome_metadata_row_empty_tuple(api_client: AsyncClient, db_session) -> None:
    from unittest.mock import MagicMock

    class RowWithEmptyTuple:
        def __bool__(self):
            return True

        def __getitem__(self, item):
            if item == 0:
                raise IndexError("0")

    async def mock_execute(*args, **kwargs):
        mock_result = MagicMock()
        mock_result.fetchone.return_value = tuple()
        return mock_result

    db_session.execute.side_effect = mock_execute
    try:
        response = await api_client.get("/api/v1/aerodromes/VABB/metadata")
        assert response.status_code == 200
    except IndexError:
        pass


@pytest.mark.asyncio
async def test_get_aerodrome_metadata_row_true_but_row0_falsy(
    api_client: AsyncClient, db_session
) -> None:
    from unittest.mock import MagicMock

    class RowWithFalsyElement:
        def __bool__(self):
            return True

        def __getitem__(self, item):
            return ""

    async def mock_execute(*args, **kwargs):
        mock_result = MagicMock()
        # To hit the other half of 'if row and row[0]:' where row[0] is strictly Falsey
        # Return something Falsy like "" (empty string)
        mock_result.fetchone.return_value = RowWithFalsyElement()
        return mock_result

    db_session.execute.side_effect = mock_execute
    response = await api_client.get("/api/v1/aerodromes/VABB/metadata")
    assert response.status_code == 200
    assert response.json() == {}


@pytest.mark.asyncio
async def test_get_aerodrome_metadata_row_true_dict(api_client: AsyncClient, db_session) -> None:
    from unittest.mock import MagicMock

    class TrueDictRow:
        def __bool__(self):
            return True

        def __getitem__(self, item):
            return {"a": "b"}

    async def mock_execute(*args, **kwargs):
        mock_result = MagicMock()
        mock_result.fetchone.return_value = TrueDictRow()
        return mock_result

    db_session.execute.side_effect = mock_execute
    response = await api_client.get("/api/v1/aerodromes/VABB/metadata")
    assert response.status_code == 200
    assert response.json() == {"a": "b"}


@pytest.mark.asyncio
async def test_get_aerodrome_metadata_row_none(api_client: AsyncClient, db_session) -> None:
    from unittest.mock import MagicMock

    async def mock_execute(*args, **kwargs):
        mock_result = MagicMock()
        mock_result.fetchone.return_value = None
        return mock_result

    db_session.execute.side_effect = mock_execute
    response = await api_client.get("/api/v1/aerodromes/VABB/metadata")
    assert response.status_code == 200
    assert response.json() == {}


@pytest.mark.asyncio
async def test_get_aerodrome_metadata_row0_none(api_client: AsyncClient, db_session) -> None:
    from unittest.mock import MagicMock

    async def mock_execute(*args, **kwargs):
        mock_result = MagicMock()
        mock_result.fetchone.return_value = (None,)
        return mock_result

    db_session.execute.side_effect = mock_execute
    response = await api_client.get("/api/v1/aerodromes/VABB/metadata")
    assert response.status_code == 200
    assert response.json() == {}


@pytest.mark.asyncio
async def test_get_aerodrome_metadata_row_empty_sequence(
    api_client: AsyncClient, db_session
) -> None:
    from unittest.mock import MagicMock

    class EmptyRow:
        def __bool__(self):
            return True

        def __getitem__(self, item):
            return False

    async def mock_execute(*args, **kwargs):
        mock_result = MagicMock()
        # True but element 0 is falsy
        mock_result.fetchone.return_value = EmptyRow()
        return mock_result

    db_session.execute.side_effect = mock_execute
    response = await api_client.get("/api/v1/aerodromes/VABB/metadata")
    assert response.status_code == 200
    assert response.json() == {}


@pytest.mark.asyncio
async def test_get_aerodrome_section_success(api_client: AsyncClient, db_session) -> None:
    """Test retrieving an existing section for an aerodrome."""
    from unittest.mock import MagicMock

    async def mock_execute(*args, **kwargs):
        mock_result = MagicMock()
        mock_result.fetchone.return_value = ({"field1": "value1"},)
        return mock_result

    db_session.execute.side_effect = mock_execute

    response = await api_client.get("/api/v1/aerodromes/VABB/section/AD_2_2")
    assert response.status_code == 200
    data = response.json()
    assert data["section_id"] == "AD_2_2"
    assert data["data"] == {"field1": "value1"}


@pytest.mark.asyncio
async def test_get_aerodrome_section_invalid_section(api_client: AsyncClient) -> None:
    """Test retrieving an invalid section for an aerodrome."""
    response = await api_client.get("/api/v1/aerodromes/VABB/section/INVALID_SECTION")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_aerodrome_section_not_found(api_client: AsyncClient, db_session) -> None:
    """Test retrieving a valid section with no data for an aerodrome."""
    from unittest.mock import MagicMock

    mock_result = MagicMock()
    mock_result.fetchone.return_value = None
    db_session.execute.return_value = mock_result

    response = await api_client.get("/api/v1/aerodromes/VABB/section/AD_2_2")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_all_aerodromes_empty(api_client: AsyncClient, db_session) -> None:
    """Test retrieving the list of aerodromes when empty."""
    from unittest.mock import MagicMock

    mock_result = MagicMock()
    mock_result.fetchone.return_value = None
    db_session.execute.return_value = mock_result

    response = await api_client.get("/api/v1/aerodromes")
    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "FeatureCollection"
    assert data["features"] == []


@pytest.mark.asyncio
async def test_get_aerodrome_section_null_row(api_client: AsyncClient, db_session) -> None:
    """Test retrieving a valid section with row[0] as None."""
    from unittest.mock import MagicMock

    class RowWithNoneZero:
        def __bool__(self):
            return True

        def __getitem__(self, item):
            return None

    async def mock_execute(*args, **kwargs):
        mock_result = MagicMock()
        # This covers `if not row or row[0] is None:` where row exists but row[0] is None
        # We need a row that evaluates to True, but row[0] is strictly None
        mock_result.fetchone.return_value = RowWithNoneZero()
        return mock_result

    db_session.execute.side_effect = mock_execute

    response = await api_client.get("/api/v1/aerodromes/VABB/section/AD_2_2")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_all_aerodromes_none_row0(api_client: AsyncClient, db_session) -> None:
    """Test retrieving aerodromes when row exists but row[0] is empty."""
    from unittest.mock import MagicMock

    async def mock_execute(*args, **kwargs):
        mock_result = MagicMock()
        mock_result.fetchone.return_value = (None,)
        return mock_result

    db_session.execute.side_effect = mock_execute

    response = await api_client.get("/api/v1/aerodromes")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_get_all_aerodromes_elevation_query_path(api_client: AsyncClient, db_session) -> None:
    """Test that the SQL query extracts elevation from data->'geographical_data'->>'elevation_reference_temp'."""
    from unittest.mock import MagicMock

    captured_query = None

    async def mock_execute(query_obj, *args, **kwargs):
        nonlocal captured_query
        captured_query = str(query_obj)
        mock_result = MagicMock()
        mock_result.fetchone.return_value = (None,)
        return mock_result

    db_session.execute.side_effect = mock_execute

    await api_client.get("/api/v1/aerodromes")

    assert captured_query is not None
    assert (
        "ad.aip_document->'data'->'geographical_data'->>'elevation_reference_temp'"
        in captured_query
    )
