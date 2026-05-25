from src.scrapper.BaseENRExtractor import BaseENRExtractor


class ENRMilitaryExerciseAreasExtractor(BaseENRExtractor):
    """
    Extracts ENR 5.2 - MILITARY EXERCISE AND TRAINING AREAS AND AIR DEFENCE IDENTIFICATION ZONE (ADIZ).
    This handles multiple table structures:
    1. Military Exercise / Training Areas (usually 3 main columns regarding limits and remarks)
    2. ADIZ boundary coordinate records
    """

    def __init__(
        self,
        active_eaip_url,
        session=None,
        output_file="output/enr_5_2_military_exercise_adiz.json",
    ):
        super().__init__(
            active_eaip_url=active_eaip_url,
            section_code="ENR 5.2",
            title="MILITARY EXERCISE AND TRAINING AREAS AND AIR DEFENCE IDENTIFICATION ZONE (ADIZ)",
            output_file=output_file,
            session=session,
        )

    def _extract_data(self):
        href = "IN-ENR 5.2-en-GB.html"
        soup, actual_url = self._fetch_soup(href)
        if not soup:
            return None

        tables = soup.find_all("table")

        military_exercise_areas = []
        adiz_zones = []

        for table in tables:
            grid = self.parser.build_virtual_grid(table)
            if not grid:
                continue

            row_count = len(grid)
            col_count = len(grid[0]) if row_count > 0 else 0

            # Use headers or shape to detect table type
            header_row = [str(c).lower() for c in grid[0]]

            # --- Type 1: Military Exercise/Training Areas (3 main columns) ---
            if col_count == 3 and "name" in header_row[0] and "limits" in header_row[1]:
                # Loop through the rows
                for row_data in grid[1:]:
                    # Skip sub-headers or empty structural padding
                    if not any(row_data) or row_data[0] == row_data[1]:
                        continue

                    military_exercise_areas.append(
                        {
                            "name_and_lateral_limits": row_data[0],
                            "upper_lower_limits_and_system": row_data[1],
                            "remarks_and_time_of_act": row_data[2],
                        }
                    )

            # --- Type 2: ADIZ Zones ---
            # Even if columns are merged, they usually contain 'name' and 'lateral'
            elif col_count == 1 and ("name" in header_row[0] and "lateral" in header_row[0]):
                for row_data in grid[1:]:
                    # Row data will be a single string often split by '|' if spans were merged by other parsers,
                    # but TableParser strips tags. ADIZ tables typically have Zone Name and Coordinates
                    raw_text = row_data[0]
                    if not raw_text.strip():
                        continue

                    # Best-effort parse Zone name vs coordinates using pipe or colon if it exists
                    # Typically formats look like "ADIZ Central | The entire airspace..."
                    parts = [p.strip() for p in raw_text.split("|")]

                    zone_name = parts[0]
                    coordinates = " | ".join(parts[1:]) if len(parts) > 1 else raw_text

                    adiz_zones.append(
                        {
                            "zone_name": zone_name,
                            "zone_coordinates": coordinates,
                            "raw_data": raw_text,
                        }
                    )

        # Extract Charts
        charts = self.chart_extractor.extract_charts(actual_url, soup)

        print(
            f"[+] Extracted {len(military_exercise_areas)} Military Exercise Areas, {len(adiz_zones)} ADIZ zones."
        )

        return {
            "source_url": actual_url,
            "military_exercise_and_training_areas": military_exercise_areas,
            "air_defence_identification_zones_adiz": adiz_zones,
            "charts": charts,
            "summary": {
                "total_military_areas": len(military_exercise_areas),
                "total_adiz_zones": len(adiz_zones),
                "total_charts": len(charts),
            },
        }
