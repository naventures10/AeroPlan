import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_weather_success(api_client: AsyncClient, monkeypatch, mock_redis) -> None:
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
    mock_redis.get.return_value = None

    response = await api_client.get("/api/v1/weather/VABF")
    assert response.status_code == 200

    data = response.json()
    assert "icao" in data
    assert data["icao"] == "VABF"


@pytest.mark.asyncio
async def test_get_weather_no_tables(api_client: AsyncClient, monkeypatch, mock_redis) -> None:
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
    mock_redis.get.return_value = None

    response = await api_client.get("/api/v1/weather/VABF")
    assert response.status_code == 200
    assert response.json()["metar"] is None


@pytest.mark.asyncio
async def test_get_weather_httpx_error(api_client: AsyncClient, monkeypatch, mock_redis) -> None:
    import httpx

    # clear cache before test
    mock_redis.get.return_value = None

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
async def test_get_weather_cache_hit(api_client: AsyncClient, monkeypatch, mock_redis) -> None:
    import json

    # Pre-populate cache
    mock_redis.get.return_value = json.dumps(
        {
            "data": {"icao": "VABF", "metar": "METAR VABF 260830Z", "taf": [["TAF VABF 260830Z"]]},
            "fetched_at": "2026-07-11T05:30:00Z",
            "sources_used": ["chennai"],
        }
    )

    response = await api_client.get("/api/v1/weather/VABF")
    assert response.status_code == 200
    assert response.json()["cached"] is True


@pytest.mark.asyncio
async def test_get_weather_both_sources_success(
    api_client: AsyncClient, monkeypatch, mock_redis
) -> None:
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
    mock_redis.get.return_value = None

    response = await api_client.get("/api/v1/weather/VABF")
    assert response.status_code == 200

    # Ensure it picked Delhi (181230Z is newer than 181130Z)
    assert response.json()["metar"] == "METAR VABF 181230Z"


@pytest.mark.asyncio
async def test_get_weather_one_source_fails(
    api_client: AsyncClient, monkeypatch, mock_redis
) -> None:
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
    mock_redis.get.return_value = None

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
async def test_get_weather_both_sources_match(
    api_client: AsyncClient, monkeypatch, mock_redis
) -> None:
    from unittest.mock import MagicMock

    import httpx

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.raise_for_status = MagicMock()
    mock_resp.text = "<html><b>METAR</b><br>METAR VABF 181130Z<br></html>"

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

    mock_redis.get.return_value = None

    response = await api_client.get("/api/v1/weather/VABF")
    assert response.status_code == 200
    data = response.json()
    assert data["metar"] == "METAR VABF 181130Z"
    assert "chennai" in data["sources_available"]
    assert "delhi" in data["sources_available"]


@pytest.mark.asyncio
async def test_get_weather_cache_expiration(
    api_client: AsyncClient, monkeypatch, mock_redis
) -> None:
    """Test cache expiration (simulated via Redis cache miss)."""
    mock_redis.get.return_value = None

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
async def test_parse_weather_html_all_sources_fail(
    api_client: AsyncClient, monkeypatch, mock_redis
) -> None:
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

    mock_redis.get.return_value = None

    response = await api_client.get("/api/v1/weather/VABF")
    assert response.status_code == 502


@pytest.mark.asyncio
async def test_extract_metar_time_branches() -> None:
    from app.api.v1.endpoints.weather import _extract_metar_time

    assert _extract_metar_time(None) == 0
    assert _extract_metar_time("foo") == 0


@pytest.mark.asyncio
async def test_get_weather_manifest_success(api_client: AsyncClient, monkeypatch) -> None:
    from app.api.v1.endpoints.weather import get_storage_client

    storage_client = get_storage_client()

    mock_manifest = {
        "metadata": {"generated_at": "2026-05-31T09:20:27Z"},
        "layers": {
            "wind": ["weather_001_20260531_092027_step009.tif"],
            "cloud": ["weather_002_20260531_092027_step009.tif"],
        },
    }

    monkeypatch.setattr(storage_client, "read_json", lambda key: mock_manifest)

    response = await api_client.get("/api/v1/weather/weather_manifest.json")
    assert response.status_code == 200
    assert response.json() == mock_manifest


@pytest.mark.asyncio
async def test_get_weather_manifest_not_found(api_client: AsyncClient, monkeypatch) -> None:
    from app.api.v1.endpoints.weather import get_storage_client

    storage_client = get_storage_client()

    monkeypatch.setattr(storage_client, "read_json", lambda key: None)

    response = await api_client.get("/api/v1/weather/weather_manifest.json")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_weather_file_success(api_client: AsyncClient, monkeypatch, tmp_path) -> None:
    from app.core.config import settings

    monkeypatch.setattr(settings, "STORAGE_PATH", str(tmp_path))

    # Create weather directory and write mock tif file
    weather_dir = tmp_path / "weather"
    weather_dir.mkdir(parents=True, exist_ok=True)
    tif_file = weather_dir / "weather_001_20260531_092027_step009.tif"
    tif_file.write_bytes(b"mock_geotiff_data_bytes_long_enough_to_test")

    response = await api_client.get("/api/v1/weather/files/weather_001_20260531_092027_step009.tif")
    assert response.status_code == 200
    assert response.content == b"mock_geotiff_data_bytes_long_enough_to_test"


@pytest.mark.asyncio
async def test_get_weather_file_range_request(
    api_client: AsyncClient, monkeypatch, tmp_path
) -> None:
    from app.core.config import settings

    monkeypatch.setattr(settings, "STORAGE_PATH", str(tmp_path))

    # Create weather directory and write mock tif file
    weather_dir = tmp_path / "weather"
    weather_dir.mkdir(parents=True, exist_ok=True)
    tif_file = weather_dir / "weather_001_20260531_092027_step009.tif"
    content = b"mock_geotiff_data_bytes_long_enough_to_test"
    tif_file.write_bytes(content)

    headers = {"Range": "bytes=5-14"}
    response = await api_client.get(
        "/api/v1/weather/files/weather_001_20260531_092027_step009.tif", headers=headers
    )
    assert response.status_code == 206
    assert response.content == content[5:15]
    assert response.headers["Content-Range"] == f"bytes 5-14/{len(content)}"
    assert response.headers["Content-Length"] == "10"


@pytest.mark.asyncio
async def test_get_weather_file_range_request_out_of_bounds(
    api_client: AsyncClient, monkeypatch, tmp_path
) -> None:
    from app.core.config import settings

    monkeypatch.setattr(settings, "STORAGE_PATH", str(tmp_path))

    # Create weather directory and write mock tif file
    weather_dir = tmp_path / "weather"
    weather_dir.mkdir(parents=True, exist_ok=True)
    tif_file = weather_dir / "weather_001_20260531_092027_step009.tif"
    content = b"mock_geotiff_data_bytes_long_enough_to_test"
    tif_file.write_bytes(content)

    headers = {"Range": "bytes=100-200"}
    response = await api_client.get(
        "/api/v1/weather/files/weather_001_20260531_092027_step009.tif", headers=headers
    )
    assert response.status_code == 416
    assert response.headers["Content-Range"] == f"bytes */{len(content)}"


@pytest.mark.asyncio
async def test_get_weather_file_head_request(
    api_client: AsyncClient, monkeypatch, tmp_path
) -> None:
    from app.core.config import settings

    monkeypatch.setattr(settings, "STORAGE_PATH", str(tmp_path))

    # Create weather directory and write mock tif file
    weather_dir = tmp_path / "weather"
    weather_dir.mkdir(parents=True, exist_ok=True)
    tif_file = weather_dir / "weather_001_20260531_092027_step009.tif"
    content = b"mock_geotiff_data_bytes_long_enough_to_test"
    tif_file.write_bytes(content)

    response = await api_client.request(
        "HEAD", "/api/v1/weather/files/weather_001_20260531_092027_step009.tif"
    )
    assert response.status_code == 200
    assert response.headers["Content-Length"] == str(len(content))
    assert response.headers["Accept-Ranges"] == "bytes"


@pytest.mark.asyncio
async def test_get_weather_file_not_found(api_client: AsyncClient, monkeypatch, tmp_path) -> None:
    from app.core.config import settings

    monkeypatch.setattr(settings, "STORAGE_PATH", str(tmp_path))

    response = await api_client.get("/api/v1/weather/files/nonexistent.tif")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_weather_file_invalid_name(
    api_client: AsyncClient, monkeypatch, tmp_path
) -> None:
    from app.core.config import settings

    monkeypatch.setattr(settings, "STORAGE_PATH", str(tmp_path))

    response = await api_client.get("/api/v1/weather/files/foo..bar")
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_get_weather_manifest_with_forecasts(api_client: AsyncClient, monkeypatch) -> None:
    from app.api.v1.endpoints.weather import get_storage_client

    storage_client = get_storage_client()

    mock_manifest = {
        "forecasts": [
            {
                "valid_time": "2026-06-03T12:00:00Z",
                "files": {
                    "surface": "/api/v1/weather/files/weather_surface_step000.tif",
                    "050": "/api/v1/weather/files/weather_050_step000.tif",
                },
            }
        ]
    }

    monkeypatch.setattr(storage_client, "read_json", lambda key: mock_manifest)

    # Mock storage_client.generate_presigned_url
    def mock_generate_presigned_url(s3_key: str, expiration: int = 7200) -> str:
        return f"https://mocked-signed-url/{s3_key}"

    monkeypatch.setattr(storage_client, "generate_presigned_url", mock_generate_presigned_url)

    response = await api_client.get("/api/v1/weather/weather_manifest.json")
    assert response.status_code == 200

    data = response.json()
    assert (
        data["forecasts"][0]["files"]["surface"]
        == "https://mocked-signed-url/weather/weather_surface_step000.tif"
    )
    assert (
        data["forecasts"][0]["files"]["050"]
        == "https://mocked-signed-url/weather/weather_050_step000.tif"
    )


@pytest.mark.asyncio
async def test_update_weather_cache_loop(monkeypatch, mock_redis, db_session) -> None:
    """Test the periodic background scheduler update loop."""
    import asyncio

    # 1. Mock database query response for ICAO codes
    from unittest.mock import AsyncMock, MagicMock

    from jobs import weather as weather_job

    mock_result = MagicMock()
    mock_result.fetchall.return_value = [("VABB",)]
    db_session.execute = AsyncMock(return_value=mock_result)

    # 2. Mock _fetch_weather to trace calls
    mock_fetch = AsyncMock(return_value={"icao": "VABB"})
    monkeypatch.setattr(weather_job, "_fetch_weather", mock_fetch)

    # 3. Force the infinite loop to raise CancelledError immediately on sleep
    mock_sleep = AsyncMock(side_effect=asyncio.CancelledError)
    monkeypatch.setattr(asyncio, "sleep", mock_sleep)

    # 4. Trigger one iteration of the loop
    await weather_job.update_weather_cache_loop()

    # 5. Assert it correctly scraped VABB
    mock_fetch.assert_called_once_with("VABB")
