import re
import json


class AIPSchemaMapper:
    def __init__(self):
        # The router dictionary maps table IDs to specific processing functions
        self.strategy_router = {
            "AD_2_2": self.map_aerodrome_geo_table,
            "AD_2_3": self.map_operational_hours_table,
            "AD_2_4": self.map_handling_services_table,
            "AD_2_5": self.map_passenger_facilities_table,
            "AD_2_6": self.map_rescue_and_fire_fighting_table,
            "AD_2_7": self.map_seasonal_clearing_table,
            "AD_2_8": self.map_aprons_taxiways_table,
            "AD_2_9": self.map_smgcs_markings_table,
            "AD_2_10": self.map_obstacles_table,
            "AD_2_11": self.map_meteorological_info_table,
            "AD_2_12": self.map_runway_physical_characteristics,
            "AD_2_13": self.map_declared_distances_table,
            "AD_2_14": self.map_approach_runway_lighting,
            "AD_2_15": self.map_other_lighting_power_supply,
            "AD_2_16": self.map_helicopter_landing_area,
            "AD_2_17": self.map_ats_airspace_table,
            "AD_2_18": self.map_communications_table,
            "AD_2_19": self.map_radio_navigation_aids,
            "AD_2_20": self.map_local_regulations,
            "AD_2_21": self.map_noise_abatement_procedures,
            "AD_2_22": self.map_flight_procedures,
            "AD_2_23": self.map_additional_information,
            "AD_2_24": self.map_charts_related_to_aerodrome,
        }

    def process_grid(self, table_id, virtual_grid):
        """
        Logic: Routes the 2D grid to the correct mapping strategy.
        """
        mapping_function = self.strategy_router.get(table_id)

        if not mapping_function:
            print(
                f"[!] No mapping strategy defined for {table_id}. Returning raw grid."
            )
            return {"raw_data": virtual_grid}

        return mapping_function(virtual_grid)

    def map_communications_table(self, grid):
        """
        Logic Strategy: Horizontal Tabular Table.
        Skips the first two header rows and maps columns to strict JSON keys.
        """
        communications_data = []

        # Guard clause: Ensure the table has data rows
        if len(grid) < 3:
            return communications_data

        # Loop starting from index 2 (skipping header rows 0 and 1)
        for row in grid[2:]:
            # Guard clause: Ensure the row has enough columns to prevent IndexError
            if len(row) < 6:
                continue

            # Skip empty rows or header continuation rows
            if not row[0].strip() or "Service" in row[0]:
                continue

            # The Data Contract Mapping
            frequency_record = {
                "service_type": row[0].strip(),
                "call_sign": row[1].strip(),
                "frequency": row[2].strip(),
                "hours_of_operation": row[5].strip(),
                "Remarks": row[6].strip(),
            }

            communications_data.append(frequency_record)

        return {"communications": communications_data}

    def map_obstacles_table(self, grid):
        """
        Logic Strategy: Horizontal Tabular Table.
        Skips the first 3 header rows and maps 6 specific columns to JSON keys.
        """
        obstacles_data = []

        # Guard clause: Ensure the table has data rows beyond the 3 headers
        if len(grid) < 4:
            return obstacles_data

        # Loop starting from index 3 (skipping header rows 0, 1, and 2)
        for row in grid[3:]:
            # Guard clause: Ensure the row has enough columns
            if len(row) < 6:
                continue

            # Skip empty rows or rows that just contain numbers
            if not row[0].strip() or all(
                c.strip().isdigit() or not c.strip() for c in row
            ):
                continue

            # Helper to clean up Virtual Grid delimiters into clean newlines
            clean = lambda c: (
                c.replace(" | ", "\n").strip() if isinstance(c, str) else ""
            )

            # The Data Contract Mapping
            obstacle_record = {
                "area_affected": clean(row[0]),
                "obstacle_type": clean(row[1]),
                "coordinates": clean(row[2]),
                "elevation": clean(row[3]),
                "marking_lgt": clean(row[4]),
                "remarks": clean(row[5]),
            }

            obstacles_data.append(obstacle_record)

        return {"obstacles": obstacles_data}

    def map_aerodrome_geo_table(self, grid):
        """
        Logic Strategy: Vertical Key-Value Questionnaire.
        Groups rows by their Index ID (1-7) to handle nested rowspans,
        and deduplicates cells to handle colspans before mapping to strict JSON keys.
        """
        temp_data = {}

        for row in grid:
            if len(row) < 3:
                continue

            row_id = row[0].strip()

            if not row_id.isdigit():
                continue

            # Extract cells from col 2 onwards
            raw_parts = [cell.strip() for cell in row[2:] if cell.strip()]

            # THE FIX: Deduplicate to handle Virtual Grid colspan cloning
            value_parts = list(dict.fromkeys(raw_parts))

            value_string = " | ".join(value_parts)

            # If we've already seen this ID, append it on a new line
            if row_id in temp_data:
                # Avoid appending empty lines
                if value_string:
                    temp_data[row_id] += f" \n {value_string}"
            else:
                temp_data[row_id] = value_string

        # The Data Contract Mapping
        geo_data = {
            "arp_coordinates_site": temp_data.get("1", ""),
            "direction_distance": temp_data.get("2", ""),
            "elevation_reference_temp": temp_data.get("3", ""),
            "magnetic_variation": temp_data.get("4", ""),
            "operator_details": temp_data.get("5", ""),
            "types_of_traffic": temp_data.get("6", ""),
            "remarks": temp_data.get("7", ""),
        }

        return {"geographical_data": geo_data}

    def map_operational_hours_table(self, grid):
        """
        Logic Strategy: Vertical Key-Value Questionnaire.
        Groups rows by their Index ID (1-12) to handle nested rowspans,
        and maps them to strict JSON keys.
        """
        temp_data = {}

        for row in grid:
            if len(row) < 3:
                continue

            row_id = row[0].strip()

            # Only process legitimate data rows (must start with an index number)
            if not row_id.isdigit():
                continue

            # Extract cells from col 2 onwards and deduplicate
            raw_parts = [cell.strip() for cell in row[2:] if cell.strip()]
            value_parts = list(dict.fromkeys(raw_parts))
            value_string = " | ".join(value_parts)

            # Group multi-row answers (like the Remarks section)
            if row_id in temp_data:
                if value_string:
                    temp_data[row_id] += f" \n {value_string}"
            else:
                temp_data[row_id] = value_string

        # The Data Contract Mapping
        ops_hours = {
            "aerodrome_operator": temp_data.get("1", ""),
            "customs_and_immigration": temp_data.get("2", ""),
            "health_and_sanitation": temp_data.get("3", ""),
            "ais_briefing_office": temp_data.get("4", ""),
            "ats_reporting_office": temp_data.get("5", ""),
            "met_briefing_office": temp_data.get("6", ""),
            "air_traffic_service": temp_data.get("7", ""),
            "fuelling": temp_data.get("8", ""),
            "handling": temp_data.get("9", ""),
            "security": temp_data.get("10", ""),
            "de_icing": temp_data.get("11", ""),
            "remarks": temp_data.get("12", ""),
        }

        return {"operational_hours": ops_hours}

    def map_handling_services_table(self, grid):
        """
        Logic Strategy: Vertical Key-Value Questionnaire.
        Groups rows by their Index ID (1-7) to handle nested rowspans,
        and maps them to strict JSON keys.
        """
        temp_data = {}

        for row in grid:
            if len(row) < 3:
                continue

            row_id = row[0].strip()

            # Only process legitimate data rows (must start with an index number)
            if not row_id.isdigit():
                continue

            # Extract cells from col 2 onwards and deduplicate
            raw_parts = [cell.strip() for cell in row[2:] if cell.strip()]
            value_parts = list(dict.fromkeys(raw_parts))
            value_string = " | ".join(value_parts)

            # Group multi-row answers
            if row_id in temp_data:
                if value_string:
                    temp_data[row_id] += f" \n {value_string}"
            else:
                temp_data[row_id] = value_string

        # The Data Contract Mapping
        handling_services = {
            "cargo_handling_facilities": temp_data.get("1", ""),
            "fuel_and_oil_types": temp_data.get("2", ""),
            "fuelling_facilities_capacity": temp_data.get("3", ""),
            "de_icing_facilities": temp_data.get("4", ""),
            "hangar_space": temp_data.get("5", ""),
            "repair_facilities": temp_data.get("6", ""),
            "remarks": temp_data.get("7", ""),
        }

        return {"handling_services": handling_services}

    def map_passenger_facilities_table(self, grid):
        """
        Logic Strategy: Vertical Key-Value Questionnaire.
        Groups rows by their Index ID (1-7), deduplicates cells to handle colspans,
        and maps them to strict JSON keys.
        """
        temp_data = {}

        for row in grid:
            if len(row) < 3:
                continue

            row_id = row[0].strip()

            # Only process legitimate data rows (must start with an index number)
            if not row_id.isdigit():
                continue

            # Extract cells from col 2 onwards and deduplicate
            raw_parts = [cell.strip() for cell in row[2:] if cell.strip()]
            value_parts = list(dict.fromkeys(raw_parts))
            value_string = " | ".join(value_parts)

            # Group multi-row answers
            if row_id in temp_data:
                if value_string:
                    temp_data[row_id] += f" \n {value_string}"
            else:
                temp_data[row_id] = value_string

        # The Data Contract Mapping
        passenger_facilities = {
            "hotels": temp_data.get("1", ""),
            "restaurants": temp_data.get("2", ""),
            "transportation": temp_data.get("3", ""),
            "medical_facilities": temp_data.get("4", ""),
            "bank_and_post_office": temp_data.get("5", ""),
            "tourist_office": temp_data.get("6", ""),
            "remarks": temp_data.get("7", ""),
        }

        return {"passenger_facilities": passenger_facilities}

    def map_rescue_and_fire_fighting_table(self, grid):
        """
        Logic Strategy: Vertical Key-Value Questionnaire.
        Groups rows by their Index ID (1-4), deduplicates cells to handle colspans,
        and maps them to strict JSON keys.
        """
        temp_data = {}

        for row in grid:
            if len(row) < 3:
                continue

            row_id = row[0].strip()

            # Only process legitimate data rows (must start with an index number)
            if not row_id.isdigit():
                continue

            # Extract cells from col 2 onwards and deduplicate
            raw_parts = [cell.strip() for cell in row[2:] if cell.strip()]
            value_parts = list(dict.fromkeys(raw_parts))
            value_string = " | ".join(value_parts)

            # Group multi-row answers
            if row_id in temp_data:
                if value_string:
                    temp_data[row_id] += f" \n {value_string}"
            else:
                temp_data[row_id] = value_string

        # The Data Contract Mapping
        rescue_fire_fighting = {
            "aerodrome_category": temp_data.get("1", ""),
            "rescue_equipment": temp_data.get("2", ""),
            "removal_capability": temp_data.get("3", ""),
            "remarks": temp_data.get("4", ""),
        }

        return {"rescue_and_fire_fighting": rescue_fire_fighting}

    def map_seasonal_clearing_table(self, grid):
        """
        Logic Strategy: Vertical Key-Value Questionnaire.
        Groups rows by their Index ID (1-3), deduplicates cells to handle colspans,
        and maps them to strict JSON keys.
        """
        temp_data = {}

        for row in grid:
            if len(row) < 3:
                continue

            row_id = row[0].strip()

            # Only process legitimate data rows (must start with an index number)
            if not row_id.isdigit():
                continue

            # Extract cells from col 2 onwards and deduplicate
            raw_parts = [cell.strip() for cell in row[2:] if cell.strip()]
            value_parts = list(dict.fromkeys(raw_parts))
            value_string = " | ".join(value_parts)

            # Group multi-row answers
            if row_id in temp_data:
                if value_string:
                    temp_data[row_id] += f" \n {value_string}"
            else:
                temp_data[row_id] = value_string

        # The Data Contract Mapping
        seasonal_clearing = {
            "clearing_equipment": temp_data.get("1", ""),
            "clearance_priorities": temp_data.get("2", ""),
            "remarks": temp_data.get("3", ""),
        }

        return {"seasonal_clearing": seasonal_clearing}

    def map_aprons_taxiways_table(self, grid):
        """
        Logic Strategy: Vertical Key-Value Questionnaire.
        Groups rows by their Index ID (1-6), deduplicates cells to handle colspans,
        and maps them to strict JSON keys.
        """
        temp_data = {}

        for row in grid:
            if len(row) < 3:
                continue

            row_id = row[0].strip()

            # Only process legitimate data rows (must start with an index number)
            if not row_id.isdigit():
                continue

            # Extract cells from col 2 onwards and deduplicate
            raw_parts = [cell.strip() for cell in row[2:] if cell.strip()]
            value_parts = list(dict.fromkeys(raw_parts))
            value_string = " | ".join(value_parts)

            # Group multi-row answers (crucial for the massive Remarks section)
            if row_id in temp_data:
                if value_string:
                    temp_data[row_id] += f" \n {value_string}"
            else:
                temp_data[row_id] = value_string

        # The Data Contract Mapping
        aprons_taxiways = {
            "aprons_designation_surface_strength": temp_data.get("1", ""),
            "taxiways_designation_width_surface_strength": temp_data.get("2", ""),
            "altimeter_checkpoints": temp_data.get("3", ""),
            "vor_checkpoints": temp_data.get("4", ""),
            "ins_checkpoints": temp_data.get("5", ""),
            "remarks": temp_data.get("6", ""),
        }

        return {"aprons_taxiways_checkpoints": aprons_taxiways}

    def map_smgcs_markings_table(self, grid):
        """
        Logic Strategy: Vertical Key-Value Questionnaire.
        Groups rows by their Index ID (1-4), deduplicates cells to handle colspans,
        and maps them to strict JSON keys.
        """
        temp_data = {}

        for row in grid:
            if len(row) < 3:
                continue

            row_id = row[0].strip()

            # Only process legitimate data rows (must start with an index number)
            if not row_id.isdigit():
                continue

            # Extract cells from col 2 onwards and deduplicate
            raw_parts = [cell.strip() for cell in row[2:] if cell.strip()]
            value_parts = list(dict.fromkeys(raw_parts))
            value_string = " | ".join(value_parts)

            # Group multi-row answers (captures the 9-line RWY/TWY marking breakdown)
            if row_id in temp_data:
                if value_string:
                    temp_data[row_id] += f" \n {value_string}"
            else:
                temp_data[row_id] = value_string

        # The Data Contract Mapping
        smgcs_markings = {
            "use_of_signs_and_guidance": temp_data.get("1", ""),
            "runway_and_taxiway_markings_and_lights": temp_data.get("2", ""),
            "stop_bars": temp_data.get("3", ""),
            "remarks": temp_data.get("4", ""),
        }

        return {"smgcs_markings": smgcs_markings}

    def map_meteorological_info_table(self, grid):
        """
        Logic Strategy: Vertical Key-Value Questionnaire.
        Groups rows by their Index ID (1-10), deduplicates cells to handle colspans,
        and maps them to strict JSON keys.
        """
        temp_data = {}

        for row in grid:
            if len(row) < 3:
                continue

            row_id = row[0].strip()

            # Only process legitimate data rows (must start with an index number)
            if not row_id.isdigit():
                continue

            # Extract cells from col 2 onwards and deduplicate
            raw_parts = [cell.strip() for cell in row[2:] if cell.strip()]
            value_parts = list(dict.fromkeys(raw_parts))
            value_string = " | ".join(value_parts)

            # Group multi-row answers
            if row_id in temp_data:
                if value_string:
                    temp_data[row_id] += f" \n {value_string}"
            else:
                temp_data[row_id] = value_string

        # The Data Contract Mapping
        meteorological_info = {
            "associated_met_office": temp_data.get("1", ""),
            "hours_of_service": temp_data.get("2", ""),
            "office_responsible_for_taf_preparation": temp_data.get("3", ""),
            "trend_forecast_availability": temp_data.get("4", ""),
            "briefing_and_consultation_provided": temp_data.get("5", ""),
            "flight_documentation_supplied": temp_data.get("6", ""),
            "charts_and_other_info_available": temp_data.get("7", ""),
            "supplementary_equipment_available": temp_data.get("8", ""),
            "ats_units_provided_with_info": temp_data.get("9", ""),
            "additional_information": temp_data.get("10", ""),
        }

        return {"meteorological_information": meteorological_info}

    def map_runway_physical_characteristics(self, grid):
        """
        Logic Strategy: Stitched Horizontal.
        The DynamicTableExtractor already horizontally stitches the 3 sub-tables into
        a single 14-column row. We use regex to find the runway rows and map indices 0-13 directly.
        """
        runways = []

        # Flexible regex: optionally matches "RWY " prefix, then 01-36 with optional L/C/R
        designator_pattern = re.compile(
            r"^(?:RWY\s+)?(0[1-9]|[12][0-9]|3[0-6])\s*([LCR])?$"
        )

        # Helper to clean up Virtual Grid delimiters into clean newlines
        clean = lambda c: c.replace(" | ", "\n").strip() if isinstance(c, str) else ""

        for row in grid:
            # If the row has data and column 0 is a valid runway designator
            match = designator_pattern.match(row[0].strip()) if len(row) > 0 else None
            if match:
                # Normalize to bare designator (e.g., "RWY 18" -> "18", "09L" -> "09L")
                bare_designator = match.group(1) + (match.group(2) or "")

                # Directly map the 14 columns across the horizontally stitched grid
                rwy_data = {
                    "designation": bare_designator,
                    "true_bearing": clean(row[1]) if len(row) > 1 else "",
                    "dimensions": clean(row[2]) if len(row) > 2 else "",
                    "strength_and_surface": clean(row[3]) if len(row) > 3 else "",
                    "coordinates": clean(row[4]) if len(row) > 4 else "",
                    "thr_elevation": clean(row[5]) if len(row) > 5 else "",
                    "slope": clean(row[6]) if len(row) > 6 else "",
                    "stopway_dimensions": clean(row[7]) if len(row) > 7 else "",
                    "clearway_dimensions": clean(row[8]) if len(row) > 8 else "",
                    "strip_dimensions": clean(row[9]) if len(row) > 9 else "",
                    "resa_dimensions": clean(row[10]) if len(row) > 10 else "",
                    "arresting_system": clean(row[11]) if len(row) > 11 else "",
                    "obstacle_free_zone": clean(row[12]) if len(row) > 12 else "",
                    "remarks": clean(row[13]) if len(row) > 13 else "",
                }

                runways.append(rwy_data)

        return {"runway_physical_characteristics": runways}

    def map_declared_distances_table(self, grid):
        """
        Logic Strategy: Horizontal Tabular (Regex Driven).
        Uses strict regex to bypass headers/numbering and exclusively find runway rows,
        then maps the 6 columns to strict JSON keys.
        """
        declared_distances = []

        # Flexible regex: optionally matches "RWY " prefix, then 01-36 with optional L/C/R
        designator_pattern = re.compile(
            r"^(?:RWY\s+)?(0[1-9]|[12][0-9]|3[0-6])\s*([LCR])?$"
        )

        # Helper to clean up Virtual Grid delimiters into clean newlines
        clean = lambda c: c.replace(" | ", "\n").strip() if isinstance(c, str) else ""

        for row in grid:
            # Check if row contains data and the first column is a valid runway designator
            match = designator_pattern.match(row[0].strip()) if len(row) > 0 else None
            if match:
                # Normalize to bare designator (e.g., "RWY 18" -> "18")
                bare_designator = match.group(1) + (match.group(2) or "")

                # The Data Contract Mapping
                distance_data = {
                    "designator": bare_designator,
                    "tora": clean(row[1]) if len(row) > 1 else "",
                    "toda": clean(row[2]) if len(row) > 2 else "",
                    "asda": clean(row[3]) if len(row) > 3 else "",
                    "lda": clean(row[4]) if len(row) > 4 else "",
                    "remarks": clean(row[5]) if len(row) > 5 else "",
                }

                declared_distances.append(distance_data)

        return {"declared_distances": declared_distances}

    def map_approach_runway_lighting(self, grid):
        """
        Logic Strategy: Stitched Horizontal (Regex Driven).
        The DynamicTableExtractor horizontally stitches the 2 sub-tables into a
        single 10-column row. We use regex to find the runway rows and map indices 0-9 directly.
        """
        runway_lighting = []

        # Flexible regex: optionally matches "RWY " prefix, then 01-36 with optional L/C/R
        designator_pattern = re.compile(
            r"^(?:RWY\s+)?(0[1-9]|[12][0-9]|3[0-6])\s*([LCR])?$"
        )

        # Helper to clean up Virtual Grid delimiters into clean newlines
        clean = lambda c: c.replace(" | ", "\n").strip() if isinstance(c, str) else ""

        for row in grid:
            # Check if row contains data and the first column is a valid runway designator
            match = designator_pattern.match(row[0].strip()) if len(row) > 0 else None
            if match:
                # Normalize to bare designator (e.g., "RWY 18" -> "18")
                bare_designator = match.group(1) + (match.group(2) or "")

                # The Data Contract Mapping for 10 columns
                lighting_data = {
                    "designator": bare_designator,
                    "approach_lighting_system": clean(row[1]) if len(row) > 1 else "",
                    "threshold_lights": clean(row[2]) if len(row) > 2 else "",
                    "visual_slope_indicator": clean(row[3]) if len(row) > 3 else "",
                    "touchdown_zone_lights": clean(row[4]) if len(row) > 4 else "",
                    "centre_line_lights": clean(row[5]) if len(row) > 5 else "",
                    "edge_lights": clean(row[6]) if len(row) > 6 else "",
                    "end_lights_and_wing_bars": clean(row[7]) if len(row) > 7 else "",
                    "stopway_lights": clean(row[8]) if len(row) > 8 else "",
                    "remarks": clean(row[9]) if len(row) > 9 else "",
                }

                runway_lighting.append(lighting_data)

        return {"approach_runway_lighting": runway_lighting}

    def map_other_lighting_power_supply(self, grid):
        """
        Logic Strategy: Vertical Key-Value Questionnaire.
        Groups rows by their Index ID (1-5), naturally capturing and
        flattening nested sub-rows (like ABN/IBN or Edge/Centre Line).
        """
        temp_data = {}

        for row in grid:
            if len(row) < 3:
                continue

            row_id = row[0].strip()

            # Only process legitimate data rows (must start with an index number)
            if not row_id.isdigit():
                continue

            # Extract cells from col 2 onwards and deduplicate
            raw_parts = [cell.strip() for cell in row[2:] if cell.strip()]
            value_parts = list(dict.fromkeys(raw_parts))
            value_string = " | ".join(value_parts)

            # Group multi-row answers (This perfectly captures the nested ABN/IBN structure)
            if row_id in temp_data:
                if value_string:
                    temp_data[row_id] += f" \n {value_string}"
            else:
                temp_data[row_id] = value_string

        # The Data Contract Mapping
        other_lighting = {
            "aerodrome_beacon_identification_beacon": temp_data.get("1", ""),
            "anemometer_landing_direction_indicator": temp_data.get("2", ""),
            "taxiway_edge_centre_line_lights": temp_data.get("3", ""),
            "secondary_power_supply_switch_over_time": temp_data.get("4", ""),
            "remarks": temp_data.get("5", ""),
        }

        return {"other_lighting_power_supply": other_lighting}

    def map_helicopter_landing_area(self, grid):
        """
        Logic Strategy: Vertical Key-Value Questionnaire.
        Groups rows by their Index ID (1-7), deduplicates cells to handle colspans,
        and maps them to strict JSON keys.
        """
        temp_data = {}

        for row in grid:
            if len(row) < 3:
                continue

            row_id = row[0].strip()

            # Only process legitimate data rows (must start with an index number)
            if not row_id.isdigit():
                continue

            # Extract cells from col 2 onwards and deduplicate
            raw_parts = [cell.strip() for cell in row[2:] if cell.strip()]
            value_parts = list(dict.fromkeys(raw_parts))
            value_string = " | ".join(value_parts)

            # Group multi-row answers
            if row_id in temp_data:
                if value_string:
                    temp_data[row_id] += f" \n {value_string}"
            else:
                temp_data[row_id] = value_string

        # The Data Contract Mapping
        heli_landing_area = {
            "coordinates_tlof_fato": temp_data.get("1", ""),
            "elevation_tlof_fato": temp_data.get("2", ""),
            "dimensions_surface_strength_marking": temp_data.get("3", ""),
            "true_bearings_fato": temp_data.get("4", ""),
            "declared_distances": temp_data.get("5", ""),
            "approach_fato_lighting": temp_data.get("6", ""),
            "remarks": temp_data.get("7", ""),
        }

        return {"helicopter_landing_area": heli_landing_area}

    def map_ats_airspace_table(self, grid):
        """
        Logic Strategy: Vertical Key-Value Questionnaire.
        Groups rows by their Index ID (1-7), deduplicates cells to handle colspans,
        and maps them to strict JSON keys.
        """
        temp_data = {}

        for row in grid:
            if len(row) < 3:
                continue

            row_id = row[0].strip()

            # Only process legitimate data rows (must start with an index number)
            if not row_id.isdigit():
                continue

            # Extract cells from col 2 onwards and deduplicate
            raw_parts = [cell.strip() for cell in row[2:] if cell.strip()]
            value_parts = list(dict.fromkeys(raw_parts))
            value_string = " | ".join(value_parts)

            # Group multi-row answers to capture split lines cleanly
            if row_id in temp_data:
                if value_string:
                    temp_data[row_id] += f" \n {value_string}"
            else:
                temp_data[row_id] = value_string

        # The Data Contract Mapping
        ats_airspace = {
            "designation_and_lateral_limits": temp_data.get("1", ""),
            "vertical_limits": temp_data.get("2", ""),
            "airspace_classification": temp_data.get("3", ""),
            "call_sign_and_language": temp_data.get("4", ""),
            "transition_altitude": temp_data.get("5", ""),
            "hours_of_applicability": temp_data.get("6", ""),
            "remarks": temp_data.get("7", ""),
        }

        return {"ats_airspace": ats_airspace}

    def map_radio_navigation_aids(self, grid):
        """
        Logic Strategy: Stitched Horizontal.
        The DynamicTableExtractor horizontally stitches the 2 sub-tables into a
        single 8-column row. We bypass the header rows and map indices 0-7 directly.
        """
        radio_aids = []

        # Helper to clean up Virtual Grid delimiters into clean newlines
        clean = lambda c: c.replace(" | ", "\n").strip() if isinstance(c, str) else ""

        for row in grid:
            if len(row) < 4:
                continue

            col0_text = row[0].strip().upper()

            # Skip empty rows, numbering rows (e.g., "1"), and header rows
            if (
                not col0_text
                or col0_text.isdigit()
                or "TYPE OF" in col0_text
                or "GEOGRAPHICAL" in col0_text
            ):
                continue

            # The Data Contract Mapping for 8 columns
            aid_data = {
                "type_of_aid": clean(row[0]),
                "identification": clean(row[1]) if len(row) > 1 else "",
                "frequency_channel": clean(row[2]) if len(row) > 2 else "",
                "hours_of_operation": clean(row[3]) if len(row) > 3 else "",
                "coordinates": clean(row[4]) if len(row) > 4 else "",
                "elevation": clean(row[5]) if len(row) > 5 else "",
                "service_volume_radius": clean(row[6]) if len(row) > 6 else "",
                "remarks": clean(row[7]) if len(row) > 7 else "",
            }

            radio_aids.append(aid_data)

        return {"radio_navigation_and_landing_aids": radio_aids}

    def map_local_regulations(self, grid):
        """
        Logic Strategy: Hybrid Document Parsing.
        Analyzes row shapes dynamically. Groups single-column rows into text blocks,
        and multi-column rows into structured data tables, preserving reading order.
        """
        document = []
        current_table = []
        current_text_block = []

        # Standard headers to filter out if they bleed into the grid
        ignore_headers = ["AD 2.20", "LOCAL AERODROME REGULATIONS", "VAAH", "VAAM"]

        for row in grid:
            # Clean all cells to preserve grid alignment for proper frontend rendering
            cleaned_cells = [cell.replace(" | ", "\n").strip() for cell in row]

            # Find unique non-empty values to route row type
            non_empty_unique = list(dict.fromkeys([c for c in cleaned_cells if c]))

            if not non_empty_unique:
                continue

            # Skip title headers
            if len(non_empty_unique) == 1 and any(
                h == non_empty_unique[0].upper() for h in ignore_headers
            ):
                continue

            # HYBRID ROUTER: If the row has multiple distinct values, it is a Table
            if len(non_empty_unique) > 1:
                # If we were previously reading text, flush it to the document first
                if current_text_block:
                    document.append(
                        {"type": "text", "content": "\n\n".join(current_text_block)}
                    )
                    current_text_block = []

                # Append the FULL aligned row to the active table
                current_table.append(cleaned_cells)

            # HYBRID ROUTER: If the row has only 1 unique value, it is a Paragraph/Heading
            else:
                # If we were previously reading a table, flush it to the document first
                if current_table:
                    document.append({"type": "table", "content": current_table})
                    current_table = []

                # Avoid appending duplicate consecutive lines
                text_val = non_empty_unique[0]
                paragraphs = [p.strip() for p in text_val.split("\n") if p.strip()]

                for p in paragraphs:
                    # Prevent appending the exact same paragraph twice in a row (handles rowspan duplicates)
                    if not document or document[-1].get("content") != p:
                        document.append({"type": "paragraph", "content": p})

        # Final Flush for any remaining tables
        if current_table:
            document.append({"type": "table", "content": current_table})

        return {"local_aerodrome_regulations": document}

    def map_noise_abatement_procedures(self, grid):
        """
        Logic Strategy: Hybrid Document Parsing.
        Uses the same dynamic shape-analysis as AD 2.20 to process
        unstructured text blocks and embedded tables seamlessly.
        """
        document = []
        current_table = []
        current_text_block = []

        # Standard headers to filter out if they bleed into the grid
        ignore_headers = [
            "AD 2.21",
            "NOISE ABATEMENT PROCEDURES",
            "VAAH",
            "VAAM",
            "VABB",
            "VIDP",
        ]

        for row in grid:
            # Clean all cells to preserve grid alignment for proper frontend rendering
            cleaned_cells = [cell.replace(" | ", "\n").strip() for cell in row]

            non_empty_unique = list(dict.fromkeys([c for c in cleaned_cells if c]))

            if not non_empty_unique:
                continue

            # Skip title headers
            if len(non_empty_unique) == 1 and any(
                h == non_empty_unique[0].upper() for h in ignore_headers
            ):
                continue

            # HYBRID ROUTER: Multi-column = Table
            if len(non_empty_unique) > 1:
                if current_text_block:
                    document.append(
                        {"type": "text", "content": "\n\n".join(current_text_block)}
                    )
                    current_text_block = []
                current_table.append(cleaned_cells)

            # HYBRID ROUTER: Single-column = Paragraph
            else:
                if current_table:
                    document.append({"type": "table", "content": current_table})
                    current_table = []

                text_val = non_empty_unique[0]
                paragraphs = [p.strip() for p in text_val.split("\n") if p.strip()]

                for p in paragraphs:
                    # Prevent appending the exact same paragraph twice in a row (handles rowspan duplicates)
                    if not document or document[-1].get("content") != p:
                        document.append({"type": "paragraph", "content": p})

        # Final Flush for any remaining tables
        if current_table:
            document.append({"type": "table", "content": current_table})

        return {"noise_abatement_procedures": document}

    def map_flight_procedures(self, grid):
        """
        Logic Strategy: Granular Hybrid Document Parsing.
        Extracts multi-column rows into tables, but keeps single-column text
        separated as individual paragraph nodes for clean UI rendering.
        """
        document = []
        current_table = []

        # Standard headers to filter out
        ignore_headers = [
            "AD 2.22",
            "FLIGHT PROCEDURES",
            "VAAH",
            "VAAM",
            "VABB",
            "VIDP",
        ]

        for row in grid:
            # Clean all cells to preserve grid alignment for proper frontend rendering
            cleaned_cells = [cell.replace(" | ", "\n").strip() for cell in row]

            non_empty_unique = list(dict.fromkeys([c for c in cleaned_cells if c]))

            if not non_empty_unique:
                continue

            # Skip title headers
            if len(non_empty_unique) == 1 and any(
                h == non_empty_unique[0].upper() for h in ignore_headers
            ):
                continue

            # HYBRID ROUTER: Multi-column = Table
            if len(non_empty_unique) > 1:
                current_table.append(cleaned_cells)

            # HYBRID ROUTER: Single-column = Paragraph
            else:
                # If we were building a table, flush it to the document first
                if current_table:
                    document.append({"type": "table", "content": current_table})
                    current_table = []

                text_val = non_empty_unique[0]

                # The Virtual Grid may have concatenated multiple <p> tags into one cell.
                # We split them by newline to ensure every paragraph gets its own node.
                paragraphs = [p.strip() for p in text_val.split("\n") if p.strip()]

                for p in paragraphs:
                    # Prevent appending the exact same paragraph twice in a row (handles rowspan duplicates)
                    if not document or document[-1].get("content") != p:
                        document.append({"type": "paragraph", "content": p})

        # Final Flush for any remaining tables
        if current_table:
            document.append({"type": "table", "content": current_table})

        return {"flight_procedures": document}

    def map_additional_information(self, grid):
        """
        Logic Strategy: Granular Hybrid Document Parsing.
        Extracts multi-column rows into tables, but keeps single-column text
        separated as individual paragraph nodes for clean UI rendering.
        """
        document = []
        current_table = []

        # Standard headers to filter out
        ignore_headers = [
            "AD 2.23",
            "ADDITIONAL INFORMATION",
            "VAAH",
            "VAAM",
            "VABB",
            "VIDP",
        ]

        for row in grid:
            cleaned_cells = [cell.replace(" | ", "\n").strip() for cell in row]
            non_empty_unique = list(dict.fromkeys([c for c in cleaned_cells if c]))

            if not non_empty_unique:
                continue

            # Skip title headers
            if len(non_empty_unique) == 1 and any(
                h == non_empty_unique[0].upper() for h in ignore_headers
            ):
                continue

            # HYBRID ROUTER: Multi-column = Table
            if len(non_empty_unique) > 1:
                current_table.append(cleaned_cells)

            # HYBRID ROUTER: Single-column = Paragraph
            else:
                if current_table:
                    document.append({"type": "table", "content": current_table})
                    current_table = []

                text_val = non_empty_unique[0]
                paragraphs = [p.strip() for p in text_val.split("\n") if p.strip()]

                for p in paragraphs:
                    if not document or document[-1].get("content") != p:
                        document.append({"type": "paragraph", "content": p})

        if current_table:
            document.append({"type": "table", "content": current_table})

        return {"additional_information": document}

    def map_charts_related_to_aerodrome(self, grid):
        """
        Logic Strategy: Horizontal Tabular.
        Maps the 2-column table into an array of chart reference objects.
        """
        charts = []

        for row in grid:
            if len(row) < 2:
                continue

            col0_text = row[0].strip()

            # Identify valid data rows (they always start with an index number, e.g., "1" or "1.")
            if not re.match(r"^\d+\.?$", col0_text):
                continue

            # The Data Contract Mapping
            # We replace ' | ' with a space in case the TableParser captured both <del> and <ins> tags
            chart_data = {
                "index": col0_text,
                "chart_name": row[1].replace(" | ", " ").strip(),
            }

            charts.append(chart_data)

        return {"charts_related_to_aerodrome": charts}
