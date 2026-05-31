import json
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


@patch("app.api.v1.endpoints.aip_supplements.get_storage_path")
async def test_get_aip_supplements_success(mock_get_path, api_client: AsyncClient, tmp_path: Path):
    file_path = tmp_path / "aip_supplements.json"
    file_path.write_text(json.dumps(MOCK_SUPPLEMENTS), encoding="utf-8")
    mock_get_path.return_value = file_path

    response = await api_client.get("/api/v1/aip-supplements/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["supplement_number"] == "108/2026"
    assert data[0]["title"] == "Realignment of ATS Route W90"


@patch("app.api.v1.endpoints.aip_supplements.get_storage_path")
async def test_get_aip_supplements_not_found(
    mock_get_path, api_client: AsyncClient, tmp_path: Path
):
    file_path = tmp_path / "nonexistent.json"
    mock_get_path.return_value = file_path

    response = await api_client.get("/api/v1/aip-supplements/")
    assert response.status_code == 200
    assert response.json() == []


@patch("app.api.v1.endpoints.aip_supplements.get_storage_path")
async def test_get_aip_supplements_internal_error(
    mock_get_path, api_client: AsyncClient, tmp_path: Path
):
    file_path = tmp_path / "aip_supplements.json"
    file_path.write_text("invalid json", encoding="utf-8")
    mock_get_path.return_value = file_path

    response = await api_client.get("/api/v1/aip-supplements/")
    assert response.status_code == 500
    assert response.json()["detail"] == "Invalid data format in storage."
