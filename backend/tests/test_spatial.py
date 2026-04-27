import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_aerodrome_features(api_client: AsyncClient, db_session) -> None:
    from unittest.mock import MagicMock

    mock_result = MagicMock()
    # geojson feature collection
    mock_result.fetchone.return_value = ({
        "type": "FeatureCollection",
        "features": []
    },)

    async def mock_execute(*args, **kwargs):
        return mock_result

    db_session.execute.side_effect = mock_execute

    response = await api_client.get("/api/v1/features/VOMF")
    assert response.status_code == 200

    # empty
    mock_result.fetchone.return_value = None
    response_empty = await api_client.get("/api/v1/features/VOMF")
    assert response_empty.status_code == 200
