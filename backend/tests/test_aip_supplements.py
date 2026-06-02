from pathlib import Path
from unittest.mock import patch

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio

MOCK_SUPPLEMENTS = [
    {
        "supplement_number": "108/2026",
        "title": "Realignment of ATS Route W90",
        "pdf_link": "https://aim-india.aai.aero/path.pdf",
        "effective_date": "09 Jul 2026",
        "remarks": "",
    }
]


@patch("app.api.v1.endpoints.aip_supplements.storage_client.read_json")
async def test_get_aip_supplements_success(mock_read_json, api_client: AsyncClient, tmp_path: Path):
    mock_read_json.return_value = MOCK_SUPPLEMENTS

    response = await api_client.get("/api/v1/aip-supplements/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["supplement_number"] == "108/2026"
    assert data[0]["title"] == "Realignment of ATS Route W90"


@patch("app.api.v1.endpoints.aip_supplements.storage_client.read_json")
async def test_get_aip_supplements_not_found(
    mock_read_json, api_client: AsyncClient, tmp_path: Path
):
    mock_read_json.return_value = None

    response = await api_client.get("/api/v1/aip-supplements/")
    assert response.status_code == 200
    assert response.json() == []


@patch("app.api.v1.endpoints.aip_supplements.storage_client.read_json")
async def test_get_aip_supplements_internal_error(
    mock_read_json, api_client: AsyncClient, tmp_path: Path
):
    mock_read_json.return_value = {"invalid": "format"}

    response = await api_client.get("/api/v1/aip-supplements/")
    assert response.status_code == 500
    assert response.json()["detail"] == "Invalid data format in storage."
