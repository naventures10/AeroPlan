from src.scrapper.BaseENRExtractor import BaseENRExtractor


class ENRSignificantPointsExtractor(BaseENRExtractor):
    """
    Standalone scraper for ENR 4.4 - NAME CODE DESIGNATORS FOR SIGNIFICANT POINTS.

    Inherits AIRAC cycle resolution and JSON extraction boilerplate.
    Parses the 3-column table (Waypoint, Coordinates, Routes).
    """

    def __init__(
        self,
        active_eaip_url,
        session=None,
        output_file="enr_4_4_significant_points.json",
    ):
        super().__init__(
            active_eaip_url=active_eaip_url,
            section_code="ENR 4.4",
            title="NAME CODE DESIGNATORS FOR SIGNIFICANT POINTS",
            output_file=output_file,
            session=session,
        )

    def _extract_data(self):
        """Extracts significant point data from all tables on the ENR 4.4 page."""
        soup, page_url = self._fetch_soup("IN-ENR 4.4-en-GB.html")
        if not soup:
            return None

        significant_points = []
        tables = soup.find_all("table")

        if not tables:
            print("[!] No tables found on the ENR 4.4 page.")
            return significant_points

        print(f"[*] Found {len(tables)} table(s) on the ENR 4.4 page.")

        for table in tables:
            grid = self.parser.build_virtual_grid(table)

            if not grid:
                continue

            for row in grid:
                if len(row) < 3:
                    continue

                waypoint = row[0].strip()
                coordinates = row[1].strip()
                routes_raw = row[2].strip()

                # Skip header rows and empty rows
                if not waypoint or waypoint.upper() in (
                    "WAYPOINTS",
                    "WAYPOINT",
                    "NAME CODE",
                ):
                    continue

                # Validate waypoint: should be uppercase letters, typically 5 chars
                if not waypoint.isalpha() or not waypoint.isupper():
                    continue

                # Skip if coordinates field looks like a header
                if "COORDINATES" in coordinates.upper():
                    continue

                # Parse routes into a clean list
                routes = [r.strip() for r in routes_raw.split(",") if r.strip()]

                significant_points.append(
                    {"waypoint": waypoint, "coordinates": coordinates, "routes": routes}
                )

        if not significant_points:
            print("[!] No significant points extracted.")
            return None

        return {
            "source_url": page_url,
            "significant_points": significant_points,
            "total_count": len(significant_points),
        }
