import re
from datetime import date, datetime, time, timedelta
from pathlib import Path

from sqlalchemy import create_engine, text

# Regex for 4-letter ICAO code in parentheses like "(VEAT)"
ICAO_PAREN_PATTERN = re.compile(r"\(([A-Z]{4})\)")
# Regex for standard DMS coordinates: "235326N 0911421E"
DMS_STANDARD_PATTERN = re.compile(r"(\d{6})[NS]\s+(\d{7})[EW]")
# Regex for decimal-seconds DMS: "264513.99N 0820901.02E" or "222318.0N 0710246.0E"
DMS_DECIMAL_PATTERN = re.compile(r"(\d{6}(?:\.\d+)?[NS])\s+(\d{7}(?:\.\d+)?[EW])")
# Regex for date like "01-Jan-2026"
DATE_PATTERN = re.compile(r"\d{2}-[A-Z][a-z]{2}-\d{4}")
# Regex for time like "05:43"
TIME_PATTERN = re.compile(r"^\d{2}:\d{2}$")

# Known airports missing ICAO from headers — mapped by airport name substring
AIRPORT_NAME_TO_ICAO = {
    "Hirasar": "VAHS",
}

DB_URL = "postgresql://postgres:postgres@localhost:5432/aeronautical_information_system"
OUTPUT_DIR = Path(__file__).resolve().parent.parent.parent / "output"
MD_FILENAME = "GEN_2.7_Sunrise_Sunset%20%282026%29.md"

# Lines 1–39 are introductory text and airport list table — skip them
HEADER_SKIP_LINES = 39


class DaylightETL:
    def __init__(self, db_url: str):
        self.engine = create_engine(db_url)

    @staticmethod
    def parse_dms_to_decimal(dms_str: str) -> tuple[float, float]:
        """
        Convert DMS coordinate string to decimal degrees.
        Handles both standard ('235326N 0911421E') and decimal-second
        formats ('264513.99N 0820901.02E', '222318.0N 0710246.0E').
        """
        match = DMS_DECIMAL_PATTERN.search(dms_str)
        if not match:
            # pyrefly: ignore [bad-return]
            return None, None

        lat_str, lon_str = match.group(1), match.group(2)

        # Latitude: DDMMSS[.ss]N/S
        lat_dir = lat_str[-1]
        lat_num = lat_str[:-1]
        lat_deg = int(lat_num[0:2])
        lat_min = int(lat_num[2:4])
        lat_sec = float(lat_num[4:])
        lat = lat_deg + lat_min / 60.0 + lat_sec / 3600.0
        if lat_dir == "S":
            lat = -lat

        # Longitude: DDDMMSS[.ss]E/W
        lon_dir = lon_str[-1]
        lon_num = lon_str[:-1]
        lon_deg = int(lon_num[0:3])
        lon_min = int(lon_num[3:5])
        lon_sec = float(lon_num[5:])
        lon = lon_deg + lon_min / 60.0 + lon_sec / 3600.0
        if lon_dir == "W":
            lon = -lon

        return lat, lon

    @staticmethod
    def parse_time(t_str: str) -> time | None:
        """Parse a time string like '05:43' into a time object."""
        t_str = t_str.strip()
        if TIME_PATTERN.match(t_str):
            h, m = map(int, t_str.split(":"))
            return time(h, m)
        return None

    @staticmethod
    def parse_date(d_str: str) -> date | None:
        """Parse a date string like '01-Jan-2026' into a date object."""
        d_str = d_str.strip()
        if DATE_PATTERN.match(d_str):
            try:
                return datetime.strptime(d_str, "%d-%b-%Y").date()
            except ValueError:
                return None
        return None

    @staticmethod
    def try_parse_merged_cell(
        cell_text: str,
    ) -> tuple[date, time, time, time, time] | None:
        """
        Try to parse a merged cell like '31-May-2026 05:25 05:49 19:03 19:28'
        where docling merged date + 4 time values into a single cell.
        Returns (date, twil_from, sunrise, sunset, twil_to) or None.
        """
        cell_text = cell_text.strip()
        # Match: DD-Mmm-YYYY HH:MM HH:MM HH:MM HH:MM
        match = re.match(
            r"(\d{2}-[A-Z][a-z]{2}-\d{4})\s+"
            r"(\d{2}:\d{2})\s+(\d{2}:\d{2})\s+(\d{2}:\d{2})\s+(\d{2}:\d{2})",
            cell_text,
        )
        if not match:
            return None
        try:
            d = datetime.strptime(match.group(1), "%d-%b-%Y").date()
            times = []
            for i in range(2, 6):
                h, m = map(int, match.group(i).split(":"))
                times.append(time(h, m))
            return (d, times[0], times[1], times[2], times[3])
        except (ValueError, IndexError):
            return None

    def _detect_icao_from_header(self, cell_text: str) -> str | None:
        """
        Extract ICAO code from a header cell.
        First tries parenthesized pattern (VEAT), then falls back to
        known airport name mapping.
        """
        match = ICAO_PAREN_PATTERN.search(cell_text)
        if match:
            return match.group(1)

        # Fallback: check known airport names
        for name, icao in AIRPORT_NAME_TO_ICAO.items():
            if name.lower() in cell_text.lower():
                return icao

        return None

    def _detect_airport_name(self, cell_text: str) -> str:
        """Extract airport name from header cell, cleaning up any embedded coords."""
        text = cell_text.strip()
        # Remove ICAO in parens
        text = ICAO_PAREN_PATTERN.sub("", text).strip()
        # Remove DMS coordinates
        text = DMS_DECIMAL_PATTERN.sub("", text).strip()
        # Clean trailing comma
        text = text.rstrip(",").strip()
        return text

    def _is_header_row(self, first_cell: str) -> bool:
        """
        Check if a table row is an airport header row (not a data row).
        Header rows contain airport names, not dates or times.
        """
        # It's NOT a header if it starts with a date
        if DATE_PATTERN.match(first_cell.strip()):
            return False
        # It's NOT a header if it's a pure time
        if TIME_PATTERN.match(first_cell.strip()):
            return False
        # It's NOT a header if it's "Day/Month" (column header)
        if "Day/Month" in first_cell:
            return False
        # It's NOT a header if it's empty
        if not first_cell.strip():
            return False
        # It's NOT a header if it looks like a DMS-only row
        stripped = first_cell.strip()
        if DMS_DECIMAL_PATTERN.match(stripped) and not any(
            c.isalpha() and c not in "NSEW" for c in stripped
        ):
            return False

        # Heuristic: contains airport-ish words or ICAO code
        if self._detect_icao_from_header(first_cell):
            return True
        # Contains "Airport" keyword
        return bool("Airport" in first_cell or "airport" in first_cell)

    def parse_markdown(self, md_path: Path) -> list[dict]:
        """
        Parses the daylight Markdown file into a list of records.
        Handles all docling edge cases:
        - Headers with/without ICAO codes in parentheses
        - Coordinates embedded in header rows or missing entirely
        - Decimal-second DMS coordinates
        - Merged cells (31-May rows where date+times are jammed together)
        - Missing coordinates rows (goes straight to Day/Month)
        - Coordinates merged into column header rows
        """
        records = []

        with open(md_path, encoding="utf-8") as f:
            lines = f.readlines()

        # Skip introductory header lines
        lines = lines[HEADER_SKIP_LINES:]

        current_icao = None
        current_name = None
        current_lat = None
        current_lon = None
        in_data_rows = False

        for line in lines:
            line = line.strip()
            if not line:
                continue

            # Skip table divider lines (|---|---|...)
            if line.startswith("|") and all(c in "|- " for c in line):
                continue

            if not line.startswith("|"):
                continue

            # Parse table cells
            cells = [c.strip() for c in line.split("|")]
            if cells and cells[0] == "":
                cells = cells[1:]
            if cells and cells[-1] == "":
                cells = cells[:-1]

            if not cells:
                continue

            first_cell = cells[0]

            # --- Detect Airport Header Row ---
            if self._is_header_row(first_cell):
                icao = self._detect_icao_from_header(first_cell)
                if icao:
                    current_icao = icao
                    current_name = self._detect_airport_name(first_cell)
                    in_data_rows = False

                    # Check if coordinates are embedded in the header
                    dms_match = DMS_DECIMAL_PATTERN.search(first_cell)
                    if dms_match:
                        lat, lon = self.parse_dms_to_decimal(first_cell)
                        current_lat = lat
                        current_lon = lon
                    else:
                        # Reset coords; will be picked up from a coords row
                        current_lat = None
                        current_lon = None
                    continue

            # --- Detect Coordinates-Only Row ---
            # A row where the first cell is purely DMS coordinates
            stripped_first = first_cell.strip()
            if DMS_DECIMAL_PATTERN.search(stripped_first) and current_icao and not in_data_rows:
                # Check it's not a data row (shouldn't start with a date)
                if not DATE_PATTERN.match(stripped_first):
                    lat, lon = self.parse_dms_to_decimal(stripped_first)
                    if lat is not None:
                        current_lat = lat
                        current_lon = lon
                    continue

            # --- Detect Column Header Row (Day/Month) ---
            if "Day/Month" in first_cell:
                in_data_rows = True
                # Also try to extract coordinates if they were embedded
                # in this row (e.g. "Twilight From 082847N" in another cell)
                if current_lat is None and current_icao:
                    full_row = " ".join(cells)
                    dms_match = DMS_DECIMAL_PATTERN.search(full_row)
                    if dms_match:
                        lat, lon = self.parse_dms_to_decimal(full_row)
                        if lat is not None:
                            current_lat = lat
                            current_lon = lon
                continue

            # --- Parse Data Rows ---
            if in_data_rows and current_icao:
                # CASE 1: Normal row — 15 cells with proper separation
                # Each row has 3 groups of (Day/Month, TwilFrom, Sunrise, Sunset, TwilTo)
                parsed_any = False

                for group_idx in range(3):
                    start = group_idx * 5
                    end = start + 5

                    if start >= len(cells):
                        break

                    group = cells[start:end]

                    # Try normal parsing if we have 5 cells
                    if len(group) >= 5:
                        date_str = group[0]
                        twil_from_str = group[1]
                        sunrise_str = group[2]
                        sunset_str = group[3]
                        twil_to_str = group[4]

                        parsed_date = self.parse_date(date_str)
                        if parsed_date:
                            twil_from = self.parse_time(twil_from_str)
                            sunrise = self.parse_time(sunrise_str)
                            sunset = self.parse_time(sunset_str)
                            twil_to = self.parse_time(twil_to_str)

                            if any([twil_from, sunrise, sunset, twil_to]):
                                records.append(
                                    {
                                        "airport_icao": current_icao,
                                        "airport_name": current_name,
                                        "lat": current_lat,
                                        "lon": current_lon,
                                        "date": parsed_date,
                                        "twilight_from": twil_from,
                                        "sunrise": sunrise,
                                        "sunset": sunset,
                                        "twilight_to": twil_to,
                                        "year": parsed_date.year,
                                    }
                                )
                                parsed_any = True
                                continue

                        # CASE 2: Merged cell — "31-May-2026 05:25 05:49 19:03 19:28"
                        merged = self.try_parse_merged_cell(date_str)
                        if merged:
                            m_date, m_tf, m_sr, m_ss, m_tt = merged
                            records.append(
                                {
                                    "airport_icao": current_icao,
                                    "airport_name": current_name,
                                    "lat": current_lat,
                                    "lon": current_lon,
                                    "date": m_date,
                                    "twilight_from": m_tf,
                                    "sunrise": m_sr,
                                    "sunset": m_ss,
                                    "twilight_to": m_tt,
                                    "year": m_date.year,
                                }
                            )
                            parsed_any = True
                            continue

                # CASE 3: Partially merged row where cell structure is broken
                # e.g. first cell empty, then "31-May-2026 04:40 05:06", then times
                if not parsed_any:
                    full_row_text = " ".join(cells)
                    # Try to find any date+times pattern in the full row
                    merged_matches = re.finditer(
                        r"(\d{2}-[A-Z][a-z]{2}-\d{4})\s+"
                        r"(\d{2}:\d{2})\s+(\d{2}:\d{2})\s+(\d{2}:\d{2})\s+(\d{2}:\d{2})",
                        full_row_text,
                    )
                    for m in merged_matches:
                        try:
                            d = datetime.strptime(m.group(1), "%d-%b-%Y").date()
                            # pyrefly: ignore [bad-argument-type]
                            tf = time(*map(int, m.group(2).split(":")))
                            # pyrefly: ignore [bad-argument-type]
                            sr = time(*map(int, m.group(3).split(":")))
                            # pyrefly: ignore [bad-argument-type]
                            ss = time(*map(int, m.group(4).split(":")))
                            # pyrefly: ignore [bad-argument-type]
                            tt = time(*map(int, m.group(5).split(":")))
                            records.append(
                                {
                                    "airport_icao": current_icao,
                                    "airport_name": current_name,
                                    "lat": current_lat,
                                    "lon": current_lon,
                                    "date": d,
                                    "twilight_from": tf,
                                    "sunrise": sr,
                                    "sunset": ss,
                                    "twilight_to": tt,
                                    "year": d.year,
                                }
                            )
                        except (ValueError, IndexError):
                            continue

                    # CASE 4: Partially split — "31-May-2026 04:40 05:06" in one cell,
                    # and remaining times split across other cells
                    if not parsed_any:
                        partial_match = re.search(
                            r"(\d{2}-[A-Z][a-z]{2}-\d{4})\s+"
                            r"(\d{2}:\d{2})\s+(\d{2}:\d{2})",
                            full_row_text,
                        )
                        if partial_match:
                            # Collect ALL times from the remaining cells
                            all_times_in_row = re.findall(r"\b(\d{2}:\d{2})\b", full_row_text)
                            # Need at least 4 times for one complete record
                            if len(all_times_in_row) >= 4:
                                try:
                                    d = datetime.strptime(partial_match.group(1), "%d-%b-%Y").date()
                                    # pyrefly: ignore [bad-argument-type]
                                    tf = time(*map(int, all_times_in_row[0].split(":")))
                                    # pyrefly: ignore [bad-argument-type]
                                    sr = time(*map(int, all_times_in_row[1].split(":")))
                                    # pyrefly: ignore [bad-argument-type]
                                    ss = time(*map(int, all_times_in_row[2].split(":")))
                                    # pyrefly: ignore [bad-argument-type]
                                    tt = time(*map(int, all_times_in_row[3].split(":")))
                                    records.append(
                                        {
                                            "airport_icao": current_icao,
                                            "airport_name": current_name,
                                            "lat": current_lat,
                                            "lon": current_lon,
                                            "date": d,
                                            "twilight_from": tf,
                                            "sunrise": sr,
                                            "sunset": ss,
                                            "twilight_to": tt,
                                            "year": d.year,
                                        }
                                    )
                                except (ValueError, IndexError):
                                    pass

        # Deduplicate records by (airport_icao, date) — keep last occurrence
        seen = {}
        for r in records:
            key = (r["airport_icao"], r["date"])
            seen[key] = r
        deduped = list(seen.values())

        # Fill missing days via interpolation
        deduped = self.interpolate_missing_days(deduped)

        return deduped

    @staticmethod
    def _avg_time(t1: time | None, t2: time | None) -> time | None:
        """Average two time values. Returns None if both are None."""
        if t1 is None and t2 is None:
            return None
        if t1 is None:
            return t2
        if t2 is None:
            return t1
        mins1 = t1.hour * 60 + t1.minute
        mins2 = t2.hour * 60 + t2.minute
        avg = round((mins1 + mins2) / 2)
        return time(avg // 60, avg % 60)

    def interpolate_missing_days(self, records: list[dict]) -> list[dict]:
        """
        Fill any missing dates per airport by averaging time values from
        adjacent dates. Sunrise/sunset changes ~1 min/day, so interpolation
        from neighbours is accurate to within ±30 seconds.
        """
        # Group records by airport
        by_airport = {}
        for r in records:
            by_airport.setdefault(r["airport_icao"], {})[r["date"]] = r

        year = 2026
        all_dates = [date(year, 1, 1) + timedelta(days=i) for i in range(365)]
        interpolated = []
        interpolated_count = 0

        for icao, date_map in by_airport.items():
            # Get airport metadata from any existing record
            sample = next(iter(date_map.values()))

            for d in all_dates:
                if d in date_map:
                    interpolated.append(date_map[d])
                else:
                    # Find nearest previous and next existing dates
                    prev_r = None
                    next_r = None

                    for offset in range(1, 10):
                        prev_d = d - timedelta(days=offset)
                        if prev_d in date_map:
                            prev_r = date_map[prev_d]
                            break
                    for offset in range(1, 10):
                        next_d = d + timedelta(days=offset)
                        if next_d in date_map:
                            next_r = date_map[next_d]
                            break

                    if prev_r or next_r:
                        base = prev_r or next_r
                        other = next_r or prev_r
                        interpolated.append(
                            {
                                "airport_icao": icao,
                                "airport_name": sample["airport_name"],
                                "lat": sample["lat"],
                                "lon": sample["lon"],
                                "date": d,
                                "twilight_from": self._avg_time(
                                    # pyrefly: ignore [missing-attribute]
                                    base.get("twilight_from"),
                                    # pyrefly: ignore [missing-attribute]
                                    other.get("twilight_from"),
                                ),
                                "sunrise": self._avg_time(
                                    # pyrefly: ignore [missing-attribute]
                                    base.get("sunrise"),
                                    other.get("sunrise"),
                                ),
                                # pyrefly: ignore [missing-attribute]
                                "sunset": self._avg_time(base.get("sunset"), other.get("sunset")),
                                "twilight_to": self._avg_time(
                                    # pyrefly: ignore [missing-attribute]
                                    base.get("twilight_to"),
                                    other.get("twilight_to"),
                                ),
                                "year": year,
                            }
                        )
                        interpolated_count += 1
                    else:
                        print(f"    [!] Cannot interpolate {icao} {d} — no neighbours")

        if interpolated_count > 0:
            print(f"  [*] Interpolated {interpolated_count} missing records from adjacent days")

        return interpolated

    def create_table(self):
        """Create the daylight_times table if it doesn't exist."""
        with self.engine.begin() as conn:
            conn.execute(
                text("""
                CREATE TABLE IF NOT EXISTS daylight_times (
                    id              SERIAL PRIMARY KEY,
                    airport_icao    TEXT NOT NULL,
                    airport_name    TEXT NOT NULL,
                    coordinates     GEOMETRY(Point, 4326),
                    date            DATE NOT NULL,
                    twilight_from   TIME,
                    sunrise         TIME,
                    sunset          TIME,
                    twilight_to     TIME,
                    year            INTEGER NOT NULL,
                    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

                    CONSTRAINT uq_daylight UNIQUE (airport_icao, date)
                );
            """)
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS idx_daylight_icao ON daylight_times (airport_icao);"
                )
            )
            conn.execute(
                text("CREATE INDEX IF NOT EXISTS idx_daylight_date ON daylight_times (date);")
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS idx_daylight_coords ON daylight_times USING GIST (coordinates);"
                )
            )

    def load_to_db(self, records: list[dict]):
        """Bulk upsert records into the daylight_times table."""
        if not records:
            print("  [!] No records to load.")
            return

        print(f"  [*] Loading {len(records)} records to database...")

        self.create_table()

        # Truncate and reload for clean state
        with self.engine.begin() as conn:
            conn.execute(text("TRUNCATE TABLE daylight_times RESTART IDENTITY;"))

        stmt = text("""
            INSERT INTO daylight_times
                (airport_icao, airport_name, coordinates, date, twilight_from, sunrise, sunset, twilight_to, year)
            VALUES
                (:airport_icao, :airport_name,
                 CASE WHEN :lat IS NOT NULL AND :lon IS NOT NULL
                      THEN ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)
                      ELSE NULL END,
                 :date, :twilight_from, :sunrise, :sunset, :twilight_to, :year)
            ON CONFLICT (airport_icao, date) DO UPDATE SET
                airport_name = EXCLUDED.airport_name,
                coordinates  = EXCLUDED.coordinates,
                twilight_from = EXCLUDED.twilight_from,
                sunrise      = EXCLUDED.sunrise,
                sunset       = EXCLUDED.sunset,
                twilight_to  = EXCLUDED.twilight_to,
                year         = EXCLUDED.year,
                updated_at   = CURRENT_TIMESTAMP;
        """)

        batch_size = 1000
        with self.engine.begin() as conn:
            for i in range(0, len(records), batch_size):
                batch = records[i : i + batch_size]
                params = []
                for r in batch:
                    params.append(
                        {
                            "airport_icao": r["airport_icao"],
                            "airport_name": r["airport_name"],
                            "lat": r["lat"],
                            "lon": r["lon"],
                            "date": r["date"],
                            "twilight_from": r["twilight_from"],
                            "sunrise": r["sunrise"],
                            "sunset": r["sunset"],
                            "twilight_to": r["twilight_to"],
                            "year": r["year"],
                        }
                    )
                conn.execute(stmt, params)
                print(f"    Inserted batch {i // batch_size + 1} ({len(batch)} rows)")

        print(f"  [✓] Loaded {len(records)} records successfully.")


def main():
    md_path = OUTPUT_DIR / MD_FILENAME

    if not md_path.exists():
        print(f"[!] Markdown file not found: {md_path}")
        print("    Run the daylight_scrapper.py first to generate the Markdown.")
        return

    print("=" * 60)
    print(" Daylight Tables eaip_scrapper.etl")
    print("=" * 60)

    etl = DaylightETL(DB_URL)

    # Step 1: Parse the Markdown
    print("\n[1/2] Parsing Markdown...")
    records = etl.parse_markdown(md_path)
    print(f"  [✓] Extracted {len(records)} records")

    # Show summary by airport
    airports = {}
    for r in records:
        airports.setdefault(r["airport_icao"], {"name": r["airport_name"], "count": 0})
        airports[r["airport_icao"]]["count"] += 1

    print(f"  [✓] Found {len(airports)} unique airports")

    # Show any airports with < 365 days
    incomplete = {k: v for k, v in airports.items() if v["count"] < 365}
    if incomplete:
        print(f"\n  [!] Airports with < 365 days ({len(incomplete)}):")
        for icao, info in sorted(incomplete.items(), key=lambda x: x[1]["count"]):
            print(
                f"      {icao} ({info['name']}): {info['count']} days (missing {365 - info['count']})"
            )
    else:
        print("  [✓] All airports have 365 days — perfect coverage!")

    # Step 2: Load to database
    print("\n[2/2] Loading to database...")
    etl.load_to_db(records)

    print("\n" + "=" * 60)
    print(f" Done! {len(records)} records across {len(airports)} airports.")
    print("=" * 60)


if __name__ == "__main__":
    main()
