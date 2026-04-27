from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from httpx import AsyncClient

from app.api.v1.endpoints.charts import _validate_proxy_url


@pytest.mark.asyncio
async def test_get_aerodrome_charts(api_client: AsyncClient, db_session) -> None:
    from collections import namedtuple
    ChartRow = namedtuple("ChartRow", ["chart_id", "chart_title", "chart_index", "chart_url"])

    mock_result = MagicMock()
    mock_result.fetchall.return_value = [
        ChartRow(chart_id=123, chart_title="Test Chart", chart_index="1", chart_url="https://aim-india.aai.aero/test.pdf")
    ]

    async def mock_execute(*args, **kwargs):
        return mock_result

    db_session.execute.side_effect = mock_execute

    response = await api_client.get("/api/v1/aerodromes/VOMF/charts")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["chart_id"] == 123
    assert data[0]["chart_title"] == "Test Chart"
    assert data[0]["chart_index"] == "1"
    assert data[0]["chart_url"] == "https://aim-india.aai.aero/test.pdf"

def test_validate_proxy_url():
    # Valid urls
    _validate_proxy_url("https://aim-india.aai.aero/test.pdf")
    _validate_proxy_url("http://www.aai.aero/test.pdf")
    _validate_proxy_url("https://eaip.aai.aero/test.pdf")

    # Invalid scheme
    with pytest.raises(HTTPException) as exc_info:
        _validate_proxy_url("ftp://aim-india.aai.aero/test.pdf")
    assert exc_info.value.status_code == 400
    assert "Only HTTP(S)" in exc_info.value.detail

    # Invalid domain
    with pytest.raises(HTTPException) as exc_info:
        _validate_proxy_url("https://malicious.com/test.pdf")
    assert exc_info.value.status_code == 403
    assert "not in the allow-list" in exc_info.value.detail

@pytest.mark.asyncio
async def test_proxy_pdf_success(api_client: AsyncClient, mock_httpx) -> None:
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.content = b"fake-pdf-content"

    # Configure mock httpx client to return this response
    mock_httpx.return_value = mock_response

    response = await api_client.get("/api/v1/proxy-pdf?url=https://aim-india.aai.aero/test.pdf")
    assert response.status_code == 200
    assert response.content == b"fake-pdf-content"
    assert response.headers["content-type"] == "application/pdf"

@pytest.mark.asyncio
async def test_proxy_pdf_upstream_error(api_client: AsyncClient, mock_httpx) -> None:
    mock_response = MagicMock()
    mock_response.status_code = 404
    mock_response.content = b""
    mock_httpx.return_value = mock_response

    response = await api_client.get("/api/v1/proxy-pdf?url=https://aim-india.aai.aero/notfound.pdf")
    assert response.status_code == 404
    assert b"Upstream returned 404" in response.content

@pytest.mark.asyncio
async def test_proxy_pdf_request_error(api_client: AsyncClient, monkeypatch) -> None:
    import httpx

    # We need to mock the real httpx.AsyncClient.get for this test
    # Conftest already mocks httpx.AsyncClient, but it mocks it with mock_httpx.
    # Let's override that just for this test
    class MockClient:
        def __init__(self, *args, **kwargs):
            pass
        async def __aenter__(self):
            return self
        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass
        async def get(self, *args, **kwargs):
            raise httpx.RequestError("Mock request error")

    monkeypatch.setattr("httpx.AsyncClient", MockClient)

    response = await api_client.get("/api/v1/proxy-pdf?url=https://aim-india.aai.aero/test.pdf")
    assert response.status_code == 502
    assert b"Proxy error" in response.content
