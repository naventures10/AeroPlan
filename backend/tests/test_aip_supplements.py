import json
from unittest.mock import MagicMock, patch

import pytest
from botocore.exceptions import ClientError
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


@patch("app.api.v1.endpoints.aip_supplements.get_storage_client")
async def test_get_aip_supplements_success(mock_get_client, api_client: AsyncClient):
    # Mock the boto3 s3 client
    mock_s3 = MagicMock()

    # Create a mock response for get_object
    mock_response = {"Body": MagicMock()}
    mock_response["Body"].read.return_value = json.dumps(MOCK_SUPPLEMENTS).encode("utf-8")
    mock_s3.get_object.return_value = mock_response
    mock_get_client.return_value = mock_s3

    response = await api_client.get("/api/v1/aip-supplements/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["supplement_number"] == "108/2026"
    assert data[0]["title"] == "Realignment of ATS Route W90"


@patch("app.api.v1.endpoints.aip_supplements.get_storage_client")
async def test_get_aip_supplements_not_found(mock_get_client, api_client: AsyncClient):
    # Mock the boto3 s3 client to raise NoSuchKey
    mock_s3 = MagicMock()

    # We must properly simulate the exception
    error_response = {
        "Error": {"Code": "NoSuchKey", "Message": "The specified key does not exist."}
    }
    mock_s3.exceptions.NoSuchKey = type("NoSuchKey", (Exception,), {})

    # Let's mock raising the generic ClientError with Code=NoSuchKey
    # since it's easier and caught in the endpoint
    mock_s3.get_object.side_effect = ClientError(error_response, "GetObject")
    mock_get_client.return_value = mock_s3

    response = await api_client.get("/api/v1/aip-supplements/")
    # Our endpoint returns [] when not found
    assert response.status_code == 200
    assert response.json() == []


@patch("app.api.v1.endpoints.aip_supplements.get_storage_client")
async def test_get_aip_supplements_internal_error(mock_get_client, api_client: AsyncClient):
    # Mock a generic MinIO connection error
    mock_s3 = MagicMock()
    error_response = {
        "Error": {"Code": "InternalError", "Message": "We encountered an internal error."}
    }
    mock_s3.get_object.side_effect = ClientError(error_response, "GetObject")
    mock_get_client.return_value = mock_s3

    response = await api_client.get("/api/v1/aip-supplements/")
    assert response.status_code == 500
    assert response.json()["detail"] == "Failed to retrieve data from storage."
