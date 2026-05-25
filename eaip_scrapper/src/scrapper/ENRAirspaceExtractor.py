from src.scrapper.BaseENRExtractor import BaseENRExtractor

# Maps section header table text to section keys and titles
SECTION_MAP = [
    ("2.1.1", "flight_information_regions", "Flight Information Region"),
    ("2.1.2", "control_areas", "Control Area"),
    ("2.1.3", "terminal_control_areas", "Terminal Control Area"),
    ("2.1.4", "military_control_zones", "Military Control Zones"),
]


class ENRAirspaceExtractor(BaseENRExtractor):
    """
    Standalone scraper for ENR 2.1 - FIR, UIR, TMA AND CTA.

    Inherits AIRAC cycle resolution and JSON extraction boilerplate.
    Parses the 5-column tables for each airspace section and extracts PDF
    chart links from iframes using ChartExtractor.
    """

    def __init__(self, active_eaip_url, session=None, output_file="enr_2_1_airspace.json"):
        super().__init__(
            active_eaip_url=active_eaip_url,
            section_code="ENR 2.1",
            title="FIR, UIR, TMA AND CTA",
            output_file=output_file,
            session=session,
        )

    def _extract_data(self):
        """Extracts significant point data and charts from ENR 2.1 page."""
        soup, page_url = self._fetch_soup("IN-ENR 2.1-en-GB.html")
        if not soup:
            return None

        tables = soup.find_all("table")
        print(f"[*] Found {len(tables)} table(s) on the ENR 2.1 page.")
        sections = self._classify_tables(tables)

        # Extract data from each section
        airspace_data = {}
        total_entries = 0

        for _section_id, section_key, section_title in SECTION_MAP:
            grids = sections.get(section_key, [])
            entries = []
            for grid in grids:
                entries.extend(self._extract_airspace_entries(grid))

            airspace_data[section_key] = entries
            total_entries += len(entries)
            print(f"[+] {section_title}: {len(entries)} entries")

        # Extract charts using standard ChartExtractor functionality
        print("\n[*] Extracting charts from iframes...")
        charts = self.chart_extractor.extract_charts(page_url, soup=soup)

        return {
            "source_url": page_url,
            **airspace_data,
            "charts": charts,
            "summary": {
                "total_entries": total_entries,
                "total_charts": len(charts),
                "sections": {key: len(airspace_data.get(key, [])) for _, key, _ in SECTION_MAP},
            },
        }

    def _classify_tables(self, tables):
        """
        Walks through all tables and groups them by section.

        The ENR 2.1 page has section header tables (1 row, 1 col) interleaved
        with data tables (multi-row, 5 cols). This method pairs each header
        with its data table(s).

        Returns: dict mapping section_key -> list of data grids
        """
        sections = {}
        current_section_key = None

        for table in tables:
            grid = self.parser.build_virtual_grid(table)
            if not grid:
                continue

            # Check if this is a section header table (1 row, 1 col with section ID)
            if len(grid) == 1 and len(grid[0]) == 1:
                header_text = grid[0][0].strip()
                for section_id, section_key, _ in SECTION_MAP:
                    if section_id in header_text:
                        current_section_key = section_key
                        sections[section_key] = []
                        print(f"    -> Section detected: {header_text}")
                        break
                continue

            # Also skip 2-row single-col tables (like 2.1.4 which has a subtitle)
            if len(grid) <= 2 and all(len(row) == 1 for row in grid):
                header_text = grid[0][0].strip()
                for section_id, section_key, _ in SECTION_MAP:
                    if section_id in header_text:
                        current_section_key = section_key
                        sections[section_key] = []
                        print(f"    -> Section detected: {header_text}")
                        break
                continue

            # This is a data table — attach to current section
            if current_section_key and current_section_key in sections:
                sections[current_section_key].append(grid)

        return sections

    def _extract_airspace_entries(self, grid):
        """
        Extracts airspace entries from a 5-column virtual grid, grouping
        rows that share the same airspace name.

        Multiple rows for the same airspace (e.g. Chennai FIR has rows for
        MWARA, RDARA, SAR, ACC) are merged into a single entry with a
        nested `services` array.

        Columns:
          0: Name, Lateral Limits, Vertical Limits, Class of airspace
          1: Unit providing service
          2: Call sign, Languages, Area and condition of use, Hours of service
          3: Frequency/Purpose
          4: Remarks
        """
        from collections import OrderedDict  # preserve insertion order

        def clean(c):
            return c.replace(" | ", "\n").strip() if isinstance(c, str) else ""

        grouped = OrderedDict()  # key: name_and_limits -> entry dict

        for row in grid:
            if len(row) < 5:
                continue

            name_limits = row[0].strip()
            unit = row[1].strip()
            callsign_info = row[2].strip()
            frequency = row[3].strip()
            remarks = row[4].strip()

            # Skip empty rows
            if not name_limits:
                continue

            # Skip header rows
            name_upper = name_limits.upper()
            if "NAME," in name_upper and "LATERAL" in name_upper:
                continue

            cleaned_name = clean(name_limits)

            service = {
                "unit_providing_service": clean(unit),
                "callsign_language_hours": clean(callsign_info),
                "frequency": clean(frequency),
                "remarks": clean(remarks),
            }

            if cleaned_name in grouped:
                # Append service to existing airspace entry
                grouped[cleaned_name]["services"].append(service)
            else:
                # Create new airspace entry
                grouped[cleaned_name] = {
                    "name_and_limits": cleaned_name,
                    "services": [service],
                }

        return list(grouped.values())
