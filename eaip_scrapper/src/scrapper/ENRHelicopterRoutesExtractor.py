from src.scrapper.BaseENRExtractor import BaseENRExtractor


class ENRHelicopterRoutesExtractor(BaseENRExtractor):
    """
    Extracts ENR 3.3.1 - HELICOPTER ROUTES.

    This page contains a mix of helipad tables and route tables.
    Helipad Tables (typically 6-cols):
      Col 0: Sl. No.
      Col 1: Helipad
      Col 2: Elevation (FT)
      Col 3: Landing and T/O
      Col 4: Dimension (M)
      Col 5: Surface

    Route Tables (typically 6-8 cols):
      Can vary depending on the region (e.g. Mumbai Routes, Kolkata Routes)
    """

    def __init__(
        self,
        active_eaip_url,
        session=None,
        output_file="output/enr_3_3_1_helicopter_routes.json",
    ):
        super().__init__(
            active_eaip_url=active_eaip_url,
            section_code="ENR 3.3.1",
            title="HELICOPTER ROUTES",
            output_file=output_file,
            session=session,
        )

    def _extract_data(self):
        href = "IN-ENR 3.3.1-en-GB.html"
        soup, actual_url = self._fetch_soup(href)
        if not soup:
            return None

        tables = soup.find_all("table")
        print(f"[*] Found {len(tables)} table(s) on the ENR 3.3.1 page.")

        helipads = []
        routes = []

        # State tracking for grouping
        current_region = "Unknown Region"

        # Helper to classify pseudo-text tables
        seen_guidelines = set()
        guidelines = []

        for idx, table in enumerate(tables):
            # Check for pseudo text tables first
            rows = table.find_all("tr")
            p_tags = table.find_all(["p", "li", "h3", "h4"])

            is_pseudo_table = False
            if len(rows) > 0 and len(p_tags) > 0:
                cells = rows[0].find_all(["td", "th"])
                if len(cells) <= 2:
                    is_pseudo_table = True
                    for p in p_tags:
                        text = p.get_text(" ", strip=True)
                        if text and len(text) > 10 and text not in seen_guidelines:
                            guidelines.append(text)
                            seen_guidelines.add(text)

            if is_pseudo_table:
                continue

            grid = self.parser.build_virtual_grid(table)
            if not grid:
                continue

            row_count = len(grid)
            col_count = len(grid[0]) if row_count > 0 else 0

            # Find closest preceding heading (h3 or h4) to identify region/grouping
            # This is a bit heuristic but often helps categorize the tables.
            heading = table.find_previous(["h3", "h4", "h5", "p"])
            if heading and heading.text.strip():
                text = heading.text.strip()
                if len(text) > 3 and "TABLE" not in text.upper():
                    current_region = text

            clean = lambda c: c.replace("\n", " ").strip() if isinstance(c, str) else ""

            # Detect Helipad Table
            if col_count == 6 and row_count > 2:
                header = " ".join(grid[0]).upper()
                if (
                    "HELIPAD" in header
                    or "ELEVATION" in header
                    or "DIMENSION" in header
                ):
                    for row in grid[2:]:  # Skip multi-line headers
                        if not any(row[1:]):
                            continue

                        sl_no = clean(row[0])
                        name = clean(row[1])
                        elevation = clean(row[2])
                        landing_to = clean(row[3])
                        dimension = clean(row[4])
                        surface = clean(row[5])

                        if name and name.upper() != "HELIPAD":
                            helipads.append(
                                {
                                    "region": current_region,
                                    "helipad_name": name,
                                    "elevation_ft": elevation,
                                    "landing_takeoff_direction": landing_to,
                                    "dimension_m": dimension,
                                    "surface": surface,
                                }
                            )
                    continue

            # Detect Route Table (e.g. Kolkata Routes, Mumbai Routes)
            if col_count >= 6 and row_count > 2:
                header = " ".join(grid[0]).upper()
                if "ROUTE" in header or "RADIAL" in header or "DESIGNATOR" in header:
                    for row in grid[2:]:
                        if not any(row):
                            continue

                        # Handle Mumbai style (Radial From, Radial To, Entry/Exit, Designator, Route, Remarks)
                        if col_count == 6:
                            col0 = clean(row[0])

                            if "FROM" in col0.upper() or "RADIAL" in col0.upper():
                                continue

                            routes.append(
                                {
                                    "region": current_region,
                                    "radial_from": clean(row[0]),
                                    "radial_to": clean(row[1]),
                                    "entry_exit_points": clean(row[2]),
                                    "route_designator": clean(row[3]),
                                    "route_description": clean(row[4]),
                                    "remarks": clean(row[5]),
                                }
                            )

                        # Handle Kolkata style (Designator, Route, Remarks) mapped across 8 cols
                        elif col_count >= 8:
                            # Usually 8 cols in the virtual grid due to merging:
                            # 0: Designator, 1-4: Route, 5-7: Remarks
                            col0 = clean(row[0])
                            if "DESIGNATOR" in col0.upper() or "ROUTE" in col0.upper():
                                continue

                            routes.append(
                                {
                                    "region": current_region,
                                    "route_designator": clean(row[0]),
                                    "route_description": clean(row[1]),
                                    "remarks": clean(row[5]),
                                }
                            )

        # Extract Charts
        charts = self.chart_extractor.extract_charts(actual_url, soup)

        print(
            f"[+] Extracted {len(helipads)} Helipads, {len(routes)} Routes, and {len(guidelines)} flight rules."
        )

        return {
            "source_url": actual_url,
            "flight_rules_and_guidelines": guidelines,
            "helipads": helipads,
            "routes": routes,
            "charts": charts,
            "summary": {
                "total_text_blocks": len(guidelines),
                "total_helipads": len(helipads),
                "total_routes": len(routes),
                "total_charts": len(charts),
            },
        }
