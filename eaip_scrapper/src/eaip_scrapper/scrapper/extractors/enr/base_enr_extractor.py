import json
from datetime import datetime, timedelta, timezone
from urllib.parse import quote, urljoin

import requests
from bs4 import BeautifulSoup

from eaip_scrapper.scrapper.extractors.chart_extractor import ChartExtractor
from eaip_scrapper.scrapper.extractors.live_table_extractor import TableParser


class BaseENRExtractor:
    """
    Base class for ENR data extractors.
    Handles AIRAC cycle resolution, session management, generic page fetching,
    and standard JSON packaging.
    """

    def __init__(self, active_eaip_url, section_code, title, output_file, session=None):
        self.active_eaip_url = active_eaip_url
        self.section_code = section_code
        self.title = title
        self.output_file = output_file
        self.session = session or requests.Session()

        # Core components
        self.parser = TableParser()
        self.chart_extractor = ChartExtractor(session=self.session)

        # eAIP base directory for assembling targeted HTML paths
        self.eaip_base = urljoin(self.active_eaip_url, "eAIP/")

    def _fetch_soup(self, href):
        """Standardized, safe fetching of an eAIP sub-page by its href link."""
        target_url = urljoin(self.eaip_base, quote(href))
        try:
            resp = self.session.get(target_url, timeout=30)
            resp.raise_for_status()
            return BeautifulSoup(resp.text, "html.parser"), target_url
        except requests.RequestException as e:
            print(f"[!] Failed to fetch {href}: {e}")
            return None, None

    def _build_metadata(self):
        """Builds standard metadata payload for JSON extraction."""
        ist = timezone(timedelta(hours=5, minutes=30))
        return {
            "section": self.section_code,
            "title": self.title,
            "extracted_at": datetime.now(ist).isoformat(),
            "airac_base_url": self.active_eaip_url,
        }

    def _save_output(self, data):
        """Validates the output data and streams it directly to MinIO."""
        from eaip_scrapper.scrapper.core.minio_storage import MinioStorage
        from eaip_scrapper.validation.core.central_validator import ValidationRouter

        file_name = self.output_file.split("/")[-1]

        # Serialize and validate in-memory
        json_str = json.dumps(data, ensure_ascii=False)
        validator = ValidationRouter()
        validator.validate_ingest_json_string(file_name, json_str)

        # Upload directly to MinIO
        storage = MinioStorage()
        storage.save_json(self.output_file, data)

        print(f"[+] {self.section_code} extraction complete. MinIO Object: {self.output_file}")
        print("=" * 50)

    def extract_and_save(self):
        """
        Main execution block:
        Child classes MUST implement `_extract_data()` which returns the specific
        data payload (lists/dicts) directly. This method takes care of the wrapper
        and writing mechanism.
        """
        print("\n" + "=" * 50)
        print(f"[*] {self.section_code}: {self.title}")
        print("=" * 50)

        # Child classes implement this extraction core
        extracted_data = self._extract_data()

        if extracted_data is None:
            print(f"[!] {self.section_code} extraction failed or yielded no data.")
            return None

        # Package payload with metadata wrapper
        output = {"metadata": self._build_metadata(), **extracted_data}

        self._save_output(output)
        return output

    def _extract_data(self):
        """Must be implemented by subclasses returning { 'data_key': [] } dict"""
        raise NotImplementedError("Subclasses must implement _extract_data()")
