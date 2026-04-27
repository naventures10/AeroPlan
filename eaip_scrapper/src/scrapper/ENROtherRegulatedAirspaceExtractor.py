from src.scrapper.BaseENRExtractor import BaseENRExtractor


class ENROtherRegulatedAirspaceExtractor(BaseENRExtractor):
    """
    Standalone scraper for ENR 2.2 - OTHER REGULATED AIRSPACE.

    Inherits AIRAC cycle resolution and JSON extraction boilerplate.
    Parses the 6-column table (Aerodrome, Hours, Lateral Limits,
    Upper Limit, Language, Remarks) and extracts PDF chart links from iframes.
    """

    def __init__(
        self,
        active_eaip_url,
        session=None,
        output_file="enr_2_2_other_regulated_airspace.json",
    ):
        super().__init__(
            active_eaip_url=active_eaip_url,
            section_code="ENR 2.2",
            title="OTHER REGULATED AIRSPACE",
            output_file=output_file,
            session=session,
        )

    def _extract_data(self):
        """Extracts regulated airspace and charts from ENR 2.2 page."""
        soup, page_url = self._fetch_soup("IN-ENR 2.2-en-GB.html")
        if not soup:
            return None

        # Re-use extract logic
        entries = self._extract_regulated_airspace(soup)

        print("\n[*] Extracting charts from iframes...")
        charts = self.chart_extractor.extract_charts(page_url, soup=soup)

        if not entries and not charts:
            print("[!] No ENR 2.2 data extracted.")
            return None

        return {
            "source_url": page_url,
            "regulated_airspace": entries,
            "charts": charts,
            "total_count": len(entries),
            "total_charts": len(charts),
        }

    def _extract_regulated_airspace(self, soup):
        """
        Extracts regulated airspace entries from the 6-column table.

        Columns:
          0: Aerodrome
          1: Hours of Ops
          2: Controlled airspace lateral limits
          3: Upper limit
          4: Language
          5: Remarks
        """
        entries = []
        tables = soup.find_all("table")

        if not tables:
            print("[!] No tables found on the ENR 2.2 page.")
            return entries

        print(f"[*] Found {len(tables)} table(s) on the ENR 2.2 page.")
        clean = lambda c: c.replace(" | ", "\n").strip() if isinstance(c, str) else ""

        for table in tables:
            grid = self.parser.build_virtual_grid(table)
            if not grid:
                continue

            for row in grid:
                if len(row) < 6:
                    continue

                aerodrome = row[0].strip()
                hours = row[1].strip()
                lateral_limits = row[2].strip()
                upper_limit = row[3].strip()
                language = row[4].strip()
                remarks = row[5].strip()

                # Skip empty rows
                if not aerodrome:
                    continue

                # Skip header row
                if "AERODROME" in aerodrome.upper() and "HOURS" in hours.upper():
                    continue

                entries.append(
                    {
                        "aerodrome": clean(aerodrome),
                        "hours_of_ops": clean(hours),
                        "lateral_limits": clean(lateral_limits),
                        "upper_limit": clean(upper_limit),
                        "language": clean(language),
                        "remarks": clean(remarks),
                    }
                )

        print(f"[+] Extracted {len(entries)} regulated airspace entries.")
        return entries
