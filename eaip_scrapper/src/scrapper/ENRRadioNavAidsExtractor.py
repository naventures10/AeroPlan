import requests
import json
import re
from datetime import datetime, timezone, timedelta
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from src.scrapper.LiveTableExtractor import TableParser
from src.scrapper.AIRACResolver import AIRACResolver
from src.scrapper.BaseENRExtractor import BaseENRExtractor


class ENRRadioNavAidsExtractor(BaseENRExtractor):
    """
    Standalone scraper for ENR 4.1 (Radio Navigation Aids - En-Route).
    Inherits AIRAC cycle resolution and JSON extraction boilerplate.
    """

    def __init__(
        self, active_eaip_url, session=None, output_file="enr_4_1_radio_nav_aids.json"
    ):
        super().__init__(
            active_eaip_url=active_eaip_url,
            section_code="ENR 4.1",
            title="RADIO NAVIGATION AIDS - EN-ROUTE",
            output_file=output_file,
            session=session,
        )
        self.parser = TableParser()
        # AIRACResolver is now handled by BaseENRExtractor
        # self.resolver = AIRACResolver(self.home_url, session=self.session)
        # self.active_eaip_url = None # Handled by BaseENRExtractor

    # Removed _resolve_enr_page_url and _fetch_and_parse as they are now handled by BaseENRExtractor

    def _extract_radio_nav_aids(self, soup):
        """
        Extracts radio navigation aid data from all tables on the ENR 4.1 page.

        The page contains a table with 7 columns:
          - Column 0: Name of the Station (e.g. AGARTALA DVOR/DME)
          - Column 1: ID (e.g. AAT)
          - Column 2: Frequency / Channel (e.g. 116.100MHZ | (108X))
          - Column 3: Hours of operation (e.g. H24)
          - Column 4: Coordinates (e.g. 235325.48N 0911419.13E)
          - Column 5: DME Antenna Elevation (e.g. 87.00 FT)
          - Column 6: Remarks (e.g. 1. Vertical datum: EGM08)

        Returns a list of structured nav aid dictionaries.
        """
        nav_aids = []
        tables = soup.find_all("table")

        if not tables:
            print("[!] No tables found on the ENR 4.1 page.")
            return nav_aids

        print(f"[*] Found {len(tables)} table(s) on the ENR 4.1 page.")

        # Exact header cell values to skip (first row of the table)
        header_values = {
            "NAME OF THE STATION",
            "NAME OF STATION",
            "ID",
            "FREQUENCY",
            "HOURS OF OPERATION",
            "COORDINATES",
            "DME ANTENNA",
            "ELEVATION",
            "REMARKS",
            "(VAR)",
            "(VOR: DECLINATION)",
            "(CHANNEL)",
        }

        # Regex for coordinates pattern (DMS with decimals)
        coord_pattern = re.compile(r"\d{4,6}[\.\d]*[NS]\s+\d{5,7}[\.\d]*[EW]")

        for table in tables:
            grid = self.parser.build_virtual_grid(table)

            if not grid:
                continue

            for row in grid:
                if len(row) < 7:
                    continue

                station_name = row[0].strip()
                ident = row[1].strip()
                frequency = row[2].strip()
                hours = row[3].strip()
                coordinates = row[4].strip()
                elevation = row[5].strip()
                remarks = row[6].strip()

                # Skip empty rows
                if not station_name:
                    continue

                # Skip header rows by checking for exact header cell values
                if station_name.upper() in header_values:
                    continue

                # Skip the header row that contains multi-part text via the | delimiter
                if (
                    "NAME OF THE STATION" in station_name.upper()
                    or "NAME OF STATION" in station_name.upper()
                ):
                    continue

                # Skip column numbering rows (e.g. "1.", "2.", etc.)
                if re.match(r"^\d+\.?$", station_name):
                    continue

                # Validate: must have coordinates in the expected DMS format
                if not coord_pattern.search(coordinates):
                    continue

                # Clean up delimiter artifacts from TableParser
                clean = lambda c: (
                    c.replace(" | ", "\n").strip() if isinstance(c, str) else ""
                )

                nav_aid = {
                    "station_name": clean(station_name),
                    "id": clean(ident),
                    "frequency": clean(frequency),
                    "hours_of_operation": clean(hours),
                    "coordinates": clean(coordinates),
                    "elevation": clean(elevation),
                    "remarks": clean(remarks),
                }

                nav_aids.append(nav_aid)

        print(f"[+] Extracted {len(nav_aids)} radio navigation aids.")
        return nav_aids

    def _extract_data(self):
        """Extracts radio navigation aids from ENR 4.1."""
        soup, page_url = self._fetch_soup("IN-ENR 4.1-en-GB.html")
        if not soup:
            return None

        all_aids = self._extract_radio_nav_aids(soup)

        if not all_aids:
            print("[!] No radio navigation aids extracted.")
            return None

        return {"radio_navigation_aids": all_aids, "total_count": len(all_aids)}

    # Removed extract_and_save as it's now handled by BaseENRExtractor's run() method
