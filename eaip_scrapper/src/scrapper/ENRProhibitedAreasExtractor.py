from src.scrapper.BaseENRExtractor import BaseENRExtractor


class ENRProhibitedAreasExtractor(BaseENRExtractor):
    """
    Standalone scraper for ENR 5.1 - PROHIBITED, RESTRICTED AND DANGER AREAS.

    Inherits AIRAC cycle resolution and JSON extraction boilerplate.
    Parses the 4-column tables for regions and extracts PDF chart links
    from iframes using ChartExtractor.
    """

    def __init__(
        self,
        active_eaip_url,
        session=None,
        output_file="enr_5_1_prohibited_restricted_danger.json",
    ):
        super().__init__(
            active_eaip_url=active_eaip_url,
            section_code="ENR 5.1",
            title="PROHIBITED, RESTRICTED AND DANGER AREAS",
            output_file=output_file,
            session=session,
        )

    def _extract_data(self):
        """Extracts prohibited areas and charts from ENR 5.1 page."""
        soup, page_url = self._fetch_soup("IN-ENR 5.1-en-GB.html")
        if not soup:
            return None

        # Re-use extract logic
        regions, definitions = self._extract_areas(soup)
        total_entries = sum(len(entries) for entries in regions.values())

        for region_name, entries in regions.items():
            print(f"[+] {region_name}: {len(entries)} areas")

        print("\n[*] Extracting charts from iframes...")
        charts = self.chart_extractor.extract_charts(page_url, soup=soup)

        if total_entries == 0 and not charts:
            print("[!] No ENR 5.1 data extracted.")
            return None

        # Build output
        return {
            "source_url": page_url,
            "definitions": definitions,
            "regions": regions,
            "charts": charts,
            "summary": {
                "total_areas": total_entries,
                "total_charts": len(charts),
                "by_region": {r: len(e) for r, e in regions.items()},
            },
        }

    def _extract_areas(self, soup):
        """
        Extracts prohibited, restricted, and danger area data from all tables.

        The page has interleaved header tables (1 row, 1 col — region name)
        and data tables (multi-row, 4 cols). This method groups entries by
        their FIR region.

        Columns in data tables:
          0: Identification & Name (e.g. "VOD 171 | Chirala")
          1: Lateral Limits
          2: Upper Limit / Lower Limit (e.g. "UNL / GND")
          3: Type of restriction / Remarks
        """
        tables = soup.find_all("table")
        if not tables:
            print("[!] No tables found on the ENR 5.1 page.")
            return {}, ""

        print(f"[*] Found {len(tables)} table(s) on the ENR 5.1 page.")

        clean = lambda c: c.replace(" | ", "\n").strip() if isinstance(c, str) else ""
        definitions = ""
        regions = {}
        current_region = None

        for table in tables:
            grid = self.parser.build_virtual_grid(table)
            if not grid:
                continue

            # Single-column tables are either definitions or region headers
            if all(len(row) == 1 for row in grid):
                first_text = grid[0][0].strip()

                # Check if it's a region header
                if "Prohibited, Restricted and Danger" in first_text:
                    # Extract region name (e.g. "Chennai Region", "Delhi Region")
                    parts = first_text.split(" - ")
                    current_region = parts[-1].strip() if len(parts) > 1 else first_text
                    regions[current_region] = []
                    print(f"    -> Region detected: {current_region}")
                elif (
                    "Prohibited Area" in first_text
                    or "Restricted Area" in first_text
                    or "Danger Area" in first_text
                ):
                    # Definitions table — capture the text
                    definitions = clean(
                        "\n".join(row[0] for row in grid if row[0].strip())
                    )
                continue

            # Data table (4 cols) — attach to current region
            if len(grid[0]) >= 4 and current_region:
                for row in grid:
                    if len(row) < 4:
                        continue

                    identification = row[0].strip()
                    lateral_limits = row[1].strip()
                    upper_lower = row[2].strip()
                    restriction_remarks = row[3].strip()

                    # Skip empty and header rows
                    if not identification:
                        continue
                    if (
                        "IDENTIFICATION" in identification.upper()
                        and "NAME" in identification.upper()
                    ):
                        continue

                    # Parse identification & name (split on newline from the | delimiter)
                    cleaned_id = clean(identification)
                    id_parts = cleaned_id.split("\n", 1)
                    area_id = id_parts[0].strip()
                    area_name = id_parts[1].strip() if len(id_parts) > 1 else ""

                    # Parse upper/lower limits
                    cleaned_limits = clean(upper_lower)
                    limit_parts = cleaned_limits.split("/", 1)
                    upper_limit = limit_parts[0].strip()
                    lower_limit = limit_parts[1].strip() if len(limit_parts) > 1 else ""

                    entry = {
                        "identification": area_id,
                        "name": area_name,
                        "lateral_limits": clean(lateral_limits),
                        "upper_limit": upper_limit,
                        "lower_limit": lower_limit,
                        "remarks": clean(restriction_remarks),
                    }

                    regions[current_region].append(entry)

        return regions, definitions
