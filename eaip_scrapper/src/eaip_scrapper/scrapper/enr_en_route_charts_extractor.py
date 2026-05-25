from eaip_scrapper.scrapper.base_enr_extractor import BaseENRExtractor


class ENREnRouteChartsExtractor(BaseENRExtractor):
    """
    Extracts ENR 6 - EN-ROUTE CHARTS.
    This section is very simple with an index table of charts and iframed PDFs.
    """

    def __init__(
        self,
        active_eaip_url,
        session=None,
        output_file="output/enr_6_en_route_charts.json",
    ):
        super().__init__(
            active_eaip_url=active_eaip_url,
            section_code="ENR 6",
            title="EN-ROUTE CHARTS",
            output_file=output_file,
            session=session,
        )

    def _extract_data(self):
        href = "IN-ENR 6-en-GB.html"
        soup, actual_url = self._fetch_soup(href)
        if not soup:
            return None

        tables = soup.find_all("table")

        chart_index = []

        for table in tables:
            grid = self.parser.build_virtual_grid(table)
            if not grid:
                continue

            row_count = len(grid)
            col_count = len(grid[0]) if row_count > 0 else 0

            # Extract standard 2-column Chart Index table
            if col_count == 2:
                header_row = [str(c).lower() for c in grid[0]]
                if "charts" in header_row[0] and "page" in header_row[1]:
                    for row_data in grid[1:]:
                        if not any(row_data) or row_data[0] == row_data[1]:
                            continue

                        chart_index.append(
                            {
                                "type_of_chart": row_data[0].strip(),
                                "page": row_data[1].strip(),
                            }
                        )

        # Extract Charts (the actual PDFs)
        charts = self.chart_extractor.extract_charts(actual_url, soup)

        print(f"[+] Extracted {len(chart_index)} Chart Index entries and {len(charts)} PDF Charts.")

        return {
            "source_url": actual_url,
            "chart_index": chart_index,
            "charts": charts,
            "summary": {
                "total_index_entries": len(chart_index),
                "total_charts": len(charts),
            },
        }
