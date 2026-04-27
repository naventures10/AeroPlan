import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_weather_success(api_client: AsyncClient, monkeypatch) -> None:
    from unittest.mock import MagicMock

    import httpx

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.raise_for_status = MagicMock()
    mock_response.text = """
        <html>
            <table id="metar"><tr><td>METAR VABF 260830Z</td></tr></table>
            <table id="taf"><tr><td>TAF VABF 260830Z</td></tr></table>
        </html>
    """

    class MockClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

        async def get(self, *args, **kwargs):
            return mock_response

    monkeypatch.setattr(httpx, "AsyncClient", MockClient)

    # clear cache before test
    from app.api.v1.endpoints import weather

    if "VABF" in weather._weather_cache:
        weather._weather_cache.pop("VABF")

    response = await api_client.get("/api/v1/weather/VABF")
    assert response.status_code == 200

    data = response.json()
    assert "icao" in data
    assert data["icao"] == "VABF"


@pytest.mark.asyncio
async def test_get_weather_no_tables(api_client: AsyncClient, monkeypatch) -> None:
    from unittest.mock import MagicMock

    import httpx

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.raise_for_status = MagicMock()
    # Provide multiple unparseable elements to hit missing branches
    # We need a `b` tag, followed by siblings, where one is not a string, and then no string is found.
    mock_response.text = '<html>No tables here <b class="something">METAR</b><p></p><b>TAF</b><p></p><b>TAF</b></html>'

    class MockClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

        async def get(self, *args, **kwargs):
            return mock_response

    monkeypatch.setattr(httpx, "AsyncClient", MockClient)

    # clear cache before test
    from app.api.v1.endpoints import weather

    if "VABF" in weather._weather_cache:
        weather._weather_cache.pop("VABF")

    response = await api_client.get("/api/v1/weather/VABF")
    assert response.status_code == 200
    assert response.json()["metar"] is None


@pytest.mark.asyncio
async def test_get_weather_httpx_error(api_client: AsyncClient, monkeypatch) -> None:
    import httpx

    # clear cache before test
    from app.api.v1.endpoints import weather

    weather._weather_cache.clear()

    class MockClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

        async def get(self, *args, **kwargs):
            raise httpx.RequestError("Mock error")

    monkeypatch.setattr(httpx, "AsyncClient", MockClient)

    response = await api_client.get("/api/v1/weather/VABF")
    assert response.status_code == 502


@pytest.mark.asyncio
async def test_get_weather_cache_hit(api_client: AsyncClient, monkeypatch) -> None:
    import time

    from app.api.v1.endpoints import weather

    # Pre-populate cache
    weather._weather_cache["VABF"] = {
        "data": {"icao": "VABF", "metar": "METAR VABF 260830Z", "taf": [["TAF VABF 260830Z"]]},
        "fetched_at": time.time(),
        "sources_used": ["chennai"],
    }

    response = await api_client.get("/api/v1/weather/VABF")
    assert response.status_code == 200
    assert response.json()["cached"] is True

    # clean up
    weather._weather_cache.pop("VABF")


@pytest.mark.asyncio
async def test_get_weather_both_sources_success(api_client: AsyncClient, monkeypatch) -> None:
    from unittest.mock import MagicMock

    import httpx

    mock_chennai = MagicMock()
    mock_chennai.status_code = 200
    mock_chennai.raise_for_status = MagicMock()
    mock_chennai.text = "<html><b>METAR</b><br>METAR VABF 181130Z<br></html>"

    mock_delhi = MagicMock()
    mock_delhi.status_code = 200
    mock_delhi.raise_for_status = MagicMock()
    mock_delhi.text = "<html><b>METAR</b><br>METAR VABF 181230Z<br></html>"

    class MockClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

        async def get(self, url, *args, **kwargs):
            if "chennai" in url:
                return mock_chennai
            return mock_delhi

    monkeypatch.setattr(httpx, "AsyncClient", MockClient)

    # clear cache before test
    from app.api.v1.endpoints import weather

    weather._weather_cache.clear()

    response = await api_client.get("/api/v1/weather/VABF")
    assert response.status_code == 200

    # Ensure it picked Delhi (181230Z is newer than 181130Z)
    assert response.json()["metar"] == "METAR VABF 181230Z"


@pytest.mark.asyncio
async def test_get_weather_one_source_fails(api_client: AsyncClient, monkeypatch) -> None:
    from unittest.mock import MagicMock

    import httpx

    mock_chennai = MagicMock()
    mock_chennai.status_code = 200
    mock_chennai.raise_for_status = MagicMock()
    mock_chennai.text = "<html><b>METAR</b><br>METAR VABF 181130Z<br></html>"

    class MockClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

        async def get(self, url, *args, **kwargs):
            if "chennai" in url:
                return mock_chennai
            raise Exception("Delhi failed")

    monkeypatch.setattr(httpx, "AsyncClient", MockClient)

    # clear cache before test
    from app.api.v1.endpoints import weather

    weather._weather_cache.clear()

    response = await api_client.get("/api/v1/weather/VABF")
    assert response.status_code == 200
    assert response.json()["metar"] == "METAR VABF 181130Z"


@pytest.mark.asyncio
async def test_parse_weather_html_extract_metar_time() -> None:
    """Cover the _extract_metar_time function's missing branches."""
    from app.api.v1.endpoints.weather import _extract_metar_time

    assert _extract_metar_time(None) == 0
    assert _extract_metar_time("INVALID METAR") == 0
    assert _extract_metar_time("METAR VABF 181130Z") == 181130


@pytest.mark.asyncio
async def test_get_weather_both_sources_match(api_client: AsyncClient, monkeypatch) -> None:
    from unittest.mock import MagicMock

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.raise_for_status = MagicMock()
    mock_resp.text = "<html><b>METAR</b><br>METAR VABF 181130Z<br></html>"


@pytest.mark.asyncio
async def test_get_weather_cache_expiration(api_client: AsyncClient, monkeypatch) -> None:
    """Test cache expiration."""
    import time

    from app.api.v1.endpoints import weather

    # Pre-populate cache with old timestamp
    weather._weather_cache["VABF"] = {
        "data": {"icao": "VABF", "metar": "METAR VABF 260830Z", "taf": [["TAF VABF 260830Z"]]},
        "fetched_at": time.time() - 400,  # 400 > 300 (CACHE_TTL_SECONDS)
        "sources_used": ["chennai"],
    }

    from unittest.mock import MagicMock

    import httpx

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.raise_for_status = MagicMock()
    mock_resp.text = "<html><b>METAR</b><br>METAR VABF 260900Z<br></html>"

    class MockClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

        async def get(self, url, *args, **kwargs):
            return mock_resp

    monkeypatch.setattr(httpx, "AsyncClient", MockClient)

    response = await api_client.get("/api/v1/weather/VABF")
    assert response.status_code == 200
    assert response.json()["cached"] is False
    assert response.json()["metar"] == "METAR VABF 260900Z"


@pytest.mark.asyncio
async def test_parse_weather_html_all_sources_fail(api_client: AsyncClient, monkeypatch) -> None:
    """Test that all sources failing returns 502."""

    import httpx

    class MockClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

        async def get(self, url, *args, **kwargs):
            # To correctly hit the error handler in `_fetch_from_source`, we just throw an Exception
            raise Exception("Force an arbitrary exception for coverage")

    monkeypatch.setattr(httpx, "AsyncClient", MockClient)

    from app.api.v1.endpoints import weather

    weather._weather_cache.clear()

    response = await api_client.get("/api/v1/weather/VABF")
    assert response.status_code == 502


@pytest.mark.asyncio
async def test_extract_metar_time_branches() -> None:
    from app.api.v1.endpoints.weather import _extract_metar_time

    assert _extract_metar_time(None) == 0
    assert _extract_metar_time("foo") == 0
