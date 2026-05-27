from eaip_scrapper.scrapper.base_enr_extractor import BaseENRExtractor


class ENRUPRZonesExtractor(BaseENRExtractor):
    """
    Extracts ENR 3.3.2 - UPR ZONES (Other Routes)
    Mostly contains free-text tabular guidelines and charts.
    """

    def __init__(
        self,
        active_eaip_url,
        session=None,
        output_file="output/enr_3_3_2_upr_zones.json",
    ):
        super().__init__(
            active_eaip_url=active_eaip_url,
            section_code="ENR 3.3.2",
            title="UPR ZONES",
            output_file=output_file,
            session=session,
        )

    def _extract_data(self):
        href = "IN-ENR 3.3.2-en-GB.html"
        soup, actual_url = self._fetch_soup(href)
        if not soup:
            return None

        tables = soup.find_all("table")

        raw_table_data = []

        for table in tables:
            grid = self.parser.build_virtual_grid(table)
            if not grid:
                continue

            # Since these are text-heavy guidelines formatted loosely as tables
            # we just dump the raw rows for complete data retention as requested.
            table_rows = []
            for row in grid:
                # Filter entirely empty rows
                if not any(str(cell).strip() for cell in row):
                    continue
                table_rows.append(row)

            if table_rows:
                raw_table_data.append(table_rows)

        # Extract Charts
        charts = self.chart_extractor.extract_charts(actual_url, soup)

        print(f"[+] Extracted {len(raw_table_data)} Tables of Raw Data and {len(charts)} Charts.")

        return {
            "source_url": actual_url,
            "upr_zones_raw_tables": raw_table_data,
            "charts": charts,
            "summary": {
                "total_tables": len(raw_table_data),
                "total_charts": len(charts),
            },
        }
