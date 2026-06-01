import json
from unittest.mock import MagicMock, patch

import pytest

from jobs.aip_supplements_scrapper import run_scraper, scrape_supplements


@pytest.fixture
def mock_html():
    return """
    <html>
      <table>
        <tbody>
          <tr>
            <td>101/2024</td>
            <td><a href="/test.pdf">Some Supplement</a></td>
            <td>01 JAN 2024</td>
            <td>Test Remark</td>
          </tr>
        </tbody>
      </table>
    </html>
    """


@patch("jobs.aip_supplements_scrapper.requests.get")
def test_scrape_supplements(mock_get, mock_html):
    mock_response = MagicMock()
    mock_response.raise_for_status.return_value = None
    mock_response.text = mock_html
    mock_get.return_value = mock_response

    result = scrape_supplements()
    assert result is not None
    assert len(result) == 1
    assert result[0]["supplement_number"] == "101/2024"
    assert result[0]["pdf_link"] == "https://aim-india.aai.aero/test.pdf"


@patch("jobs.aip_supplements_scrapper.UnifiedStorageClient")
@patch("jobs.aip_supplements_scrapper.scrape_supplements")
def test_run_scraper_new_data(mock_scrape, mock_storage_client):
    mock_scrape.return_value = [{"supplement_number": "102/2024"}]

    mock_instance = MagicMock()
    mock_storage_client.return_value = mock_instance

    mock_instance.download_file.side_effect = Exception("Not found")

    assert run_scraper() is True
    mock_instance.upload_json.assert_called_once()


@patch("jobs.aip_supplements_scrapper.UnifiedStorageClient")
@patch("jobs.aip_supplements_scrapper.scrape_supplements")
def test_run_scraper_skip_upload(mock_scrape, mock_storage_client):
    mock_scrape.return_value = [{"supplement_number": "101/2024"}]

    mock_instance = MagicMock()
    mock_storage_client.return_value = mock_instance

    def mock_download(key, local_path):
        with open(local_path, "w", encoding="utf-8") as f:
            json.dump([{"supplement_number": "101/2024"}], f)

    mock_instance.download_file.side_effect = mock_download

    assert run_scraper() is True
    mock_instance.upload_json.assert_not_called()
