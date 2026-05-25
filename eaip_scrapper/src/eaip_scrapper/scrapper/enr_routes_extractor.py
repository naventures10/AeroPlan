import concurrent.futures
import json
import re
from datetime import datetime, timedelta, timezone
from urllib.parse import quote, urljoin

import requests
from bs4 import BeautifulSoup

from eaip_scrapper.scrapper.live_table_extractor import TableParser


class ENRRoutesExtractor:
    """
    Standalone scraper for ENR 3.1 (Conventional Navigation Routes) and
    ENR 3.2 (Area Navigation Routes).

    Each route lives on its own page (e.g. IN-ENR 3.1A201-en-GB.html).
    The route list is discovered dynamically from the eAIP navigation menu
    frame (Menu-en-GB.html). Both sections share the same 8-column table:

      Col 0: Route icon
      Col 1: Waypoint name & coordinates
      Col 2: Track / Magnetic / VOR Radial / Distance
      Col 3: Upper Limit / Lower Limit / Airspace Class
      Col 4: Lateral Limits
      Col 5: Direction (Odd)
      Col 6: Direction (Even)
      Col 7: Remarks / Controlling Unit / Frequency
    """

    def __init__(
        self,
        active_eaip_url,
        session=None,
        output_file_31="enr_3_1_conventional_routes.json",
        output_file_32="enr_3_2_rnav_routes.json",
    ):
        self.active_eaip_url = active_eaip_url
        self.session = session or requests.Session()
        self.output_file_31 = output_file_31
        self.output_file_32 = output_file_32
        self.parser = TableParser()
        # base URL for the eAIP directory
        self.eaip_base = urljoin(self.active_eaip_url, "eAIP/")

    def _discover_routes(self, section):
        """
        Discovers route page URLs from the navigation menu frame.

        Args:
            section: "3.1" or "3.2"

        Returns:
            List of (route_id, relative_href) tuples, deduplicated.
        """
        menu_url = urljoin(self.active_eaip_url, "eAIP/Menu-en-GB.html")
        print(f"[*] Fetching navigation menu: {menu_url}")

        try:
            resp = self.session.get(menu_url, timeout=30)
            resp.raise_for_status()
        except requests.RequestException as e:
            print(f"[!] Failed to fetch navigation menu: {e}")
            return []

        soup = BeautifulSoup(resp.text, "html.parser")
        # Match links like "IN-ENR 3.1A201-en-GB.html" with a title attribute
        pattern = re.compile(rf"IN-ENR {re.escape(section)}")
        links = soup.find_all("a", href=pattern, title=True)

        # Deduplicate by title (route ID) — first link with a title wins
        seen = set()
        routes = []
        for link in links:
            # pyrefly: ignore [missing-attribute]
            route_id = link["title"].strip()
            if route_id and route_id not in seen:
                seen.add(route_id)
                routes.append((route_id, link["href"]))

        print(f"[+] Discovered {len(routes)} routes for ENR {section}")
        return routes

    def _parse_route_page(self, route_id, page_url):
        """
        Fetches and parses a single route page.

        Returns a dict with route metadata, waypoints, and remarks.
        """
        try:
            resp = self.session.get(page_url, timeout=30)
            resp.raise_for_status()
        except requests.RequestException as e:
            print(f"    [!] Failed to fetch {route_id}: {e}")
            return None

        soup = BeautifulSoup(resp.text, "html.parser")
        tables = soup.find_all("table")

        def clean(c):
            return c.replace(" | ", "\n").strip() if isinstance(c, str) else ""

        route_data = {
            "route_id": route_id,
            "route_designator": "",
            "waypoints": [],
            "remarks": "",
        }

        for table in tables:
            grid = self.parser.build_virtual_grid(table)
            if not grid:
                continue

            # Single-col tables are remarks blocks
            if len(grid[0]) == 1:
                text = clean(grid[0][0])
                if text and "REMARKS" in text.upper():
                    route_data["remarks"] = text
                continue

            # 8-column data table
            if len(grid[0]) < 7:
                continue

            for row in grid:
                if len(row) < 8:
                    continue

                col0 = row[0].strip()
                col1 = row[1].strip()
                col2 = row[2].strip()
                col3 = row[3].strip()
                col4 = row[4].strip()
                col5 = row[5].strip()
                col6 = row[6].strip()
                col7 = row[7].strip()

                # Skip header rows
                if "ROUTE DESIGNATOR" in col0.upper() or "ROUTE DESIGNATOR" in col1.upper():
                    continue
                if col5.upper() == "ODD" or col6.upper() == "EVEN":
                    continue

                # Skip empty rows
                if not col1 and not col2:
                    continue

                # Route designator row (spans cols 1-7)
                if col1 and col1 == col2 == col3 == col4:
                    route_data["route_designator"] = clean(col1)
                    continue

                # Waypoint row (has name/coords in col1) or segment row (has track in col2)
                entry = {}

                if col1:
                    # Waypoint entry
                    parts = clean(col1).split("\n", 1)
                    entry["waypoint_name"] = parts[0].strip()
                    entry["coordinates"] = parts[1].strip() if len(parts) > 1 else ""

                if col2:
                    # Segment data (track/distance between waypoints)
                    entry["track_distance"] = clean(col2)

                if col3:
                    entry["limits_class"] = clean(col3)

                if col4:
                    entry["lateral_limits"] = clean(col4)

                if col5:
                    entry["direction_odd"] = col5
                if col6:
                    entry["direction_even"] = col6

                if col7:
                    entry["remarks"] = clean(col7)

                if entry:
                    route_data["waypoints"].append(entry)

        return route_data

    def _extract_section(self, section, output_file):
        """Extracts all routes for a given ENR section."""
        section_name = (
            "CONVENTIONAL NAVIGATION ROUTES"
            if section == "3.1"
            else "AREA NAVIGATION (RNAV) ROUTES"
        )
        print(f"\n{'=' * 50}")
        print(f"[*] ENR {section} {section_name}")
        print(f"{'=' * 50}")

        routes_list = self._discover_routes(section)
        if not routes_list:
            print(f"[!] No routes found for ENR {section}. Skipping.")
            return None

        all_routes = []
        total = len(routes_list)

        # Parallel extraction limit
        max_workers = 10

        def scrape_route(idx, route_id, href):
            safe_href = quote(href)
            page_url = urljoin(self.eaip_base, safe_href)
            if idx % max_workers == 1 or idx == total:
                print(f"[*] Extracting route {idx}/{total}: {route_id}")
            return self._parse_route_page(route_id, page_url)

        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_route = {
                executor.submit(scrape_route, idx, route_id, href): route_id
                for idx, (route_id, href) in enumerate(routes_list, 1)
            }

            for future in concurrent.futures.as_completed(future_to_route):
                route_id = future_to_route[future]
                try:
                    data = future.result()
                    if data:
                        all_routes.append(data)
                except Exception as exc:
                    print(f"    [!] Target {route_id} generated an exception: {exc}")

        # Sort routes explicitly to ensure output consistency despite async completion
        all_routes.sort(key=lambda r: r.get("route_id", ""))

        print(f"[+] Successfully extracted {len(all_routes)}/{total} routes")

        # Build output
        ist = timezone(timedelta(hours=5, minutes=30))
        output = {
            "metadata": {
                "section": f"ENR {section}",
                "title": section_name,
                "extracted_at": datetime.now(ist).isoformat(),
                "airac_base_url": self.active_eaip_url,
            },
            "routes": all_routes,
            "total_count": len(all_routes),
        }

        print(f"[*] Writing {len(all_routes)} routes to {output_file}...")
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(output, f, indent=2, ensure_ascii=False)

        print(f"[+] ENR {section} extraction complete. Output: {output_file}")
        print("=" * 50)
        return output

    def extract_and_save(self):
        """Main entry point: extract ENR 3.1 and 3.2."""
        print("\n" + "=" * 50)
        print("[*] ENR 3 ROUTE EXTRACTION (3.1 + 3.2)")
        print("=" * 50)

        result_31 = self._extract_section("3.1", self.output_file_31)
        result_32 = self._extract_section("3.2", self.output_file_32)

        return {"enr_3_1": result_31, "enr_3_2": result_32}
