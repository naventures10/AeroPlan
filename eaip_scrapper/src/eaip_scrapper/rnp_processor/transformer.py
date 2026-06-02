import logging
import os
import re
from collections import defaultdict

from bs4 import BeautifulSoup

from .utils import (
    clean_text,
    get_s3_client,
    is_valid_coord,
    parse_coordinate,
    sanitize_header,
)

logger = logging.getLogger("RNP-eaip_scrapper.etl.Transformer")


class RNPTransformer:
    def __init__(self):
        self.s3_client = get_s3_client()
        self.bucket = os.getenv("MINIO_BUCKET", "ais")
        self.roles = {
            "IAF",
            "IF",
            "FAF",
            "MAPT",
            "MATF",
            "MAHF",
            "LTP",
            "FTP",
            "FAP",
            "THR",
            "MAPT/MATF",
        }
        self.valid_paths = {
            "IF",
            "TF",
            "CF",
            "DF",
            "HM",
            "CA",
            "RF",
            "CI",
            "FA",
            "VA",
            "VM",
        }
        self.id_blacklist = {
            "IAF",
            "IF",
            "FAF",
            "MAPT",
            "MATF",
            "MAHF",
            "LTP",
            "FTP",
            "FAP",
            "THR",
            "MAPTN",
            "MATFN",
            "FINAL",
            "MISAP",
            "BASE",
            "TRANS",
            "IDENT",
            "TYPE",
            "LAT",
            "LONG",
            "COORD",
            "WGS84",
            "WPT",
            "FIX",
            "NAVAID",
            "INITL",
            "INITR",
            "INITB",
            "MAPT/MATF",
            "FAF/FAP",
            "LTP/FTP",
            "IAF/MAHF",
            "TP",
        }

    def get_base_name(self, filename):
        name = filename.replace(".PDF.md", "").replace(".md", "")
        # Remove any CODING, TABLE, WAYPOINT and trailing numbers/spaces
        name = re.sub(r"(?i)[-\s]*(CODING|TABLES|TABLE|WAYPOINTS|WAYPOINT)[\s\d]*$", "", name)
        # Also remove trailing -1 or -2 if any remains
        name = re.sub(r"-\d+$", "", name)
        return name.strip()

    def extract_metadata(self, filename):
        """Extract airport_id, runway, and procedure_type from the filename.

        Filename patterns:
          VOHB-RNP-Y-RWY26
          VECC-RNP-Y-RWY-19R
          VOCL-RNP-Y-RWY-28
          VOPB-RNP-Y-RWY-04-TABLES
          VEBU RNP RWY- 35- TABLE.pdf
        """
        stem = filename.replace(".PDF.md", "").replace(".md", "")

        # Standard Indian ICAO is 4 letters at the start
        airport_id_match = re.match(r"^([A-Z]{4})", stem, re.IGNORECASE)
        airport_id = airport_id_match.group(1).upper() if airport_id_match else "UNKN"

        runway_match = re.search(r"RWY[-\s]*([0-9]{2}[LRC]?)", stem, re.IGNORECASE)
        runway = runway_match.group(1).upper() if runway_match else ""

        proc_type_match = re.search(r"RNP[-\s]*([XYZ])\b", stem, re.IGNORECASE)
        proc_type = "RNP-" + proc_type_match.group(1).upper() if proc_type_match else "RNP"

        return airport_id, runway, proc_type

    def merge_files(self):
        """Merges parts of the same procedure into unified markdown files in MinIO."""
        paginator = self.s3_client.get_paginator("list_objects_v2")
        keys = []
        for page in paginator.paginate(Bucket=self.bucket, Prefix="output/rnp/extracted_data/"):
            keys.extend(
                obj["Key"] for obj in page.get("Contents", []) if obj["Key"].endswith(".md")
            )

        groups = defaultdict(list)
        for key in keys:
            filename = os.path.basename(key)
            groups[self.get_base_name(filename)].append(key)

        for base_name, key_list in groups.items():
            key_list.sort()
            merged_content = []
            for key in key_list:
                filename = os.path.basename(key)
                obj_resp = self.s3_client.get_object(Bucket=self.bucket, Key=key)
                content = obj_resp["Body"].read().decode("utf-8")
                merged_content.append(f"<!-- Source: {filename} -->\n" + content)

            merged_s3_key = f"output/rnp/merged_data/{base_name}.md"
            self.s3_client.put_object(
                Bucket=self.bucket,
                Key=merged_s3_key,
                Body="\n\n---\n\n".join(merged_content).encode("utf-8"),
            )
        logger.info(f"Merged {len(keys)} parts into {len(groups)} procedures in MinIO.")

    def classify_table(self, table):
        text_lower = table.get_text(separator=" ").lower()
        if "operation type" in text_lower and "ltp/ftp" in text_lower:
            return "fas"
        if any(k in text_lower for k in ["serial", "path", "descriptor", "terminator", "seq num"]):
            return "tabular"
        if any(
            k in text_lower
            for k in [
                "coordinate",
                "latitude",
                "longitude",
                "waypoint information",
                "waypoint list",
            ]
        ):
            return "waypoint"
        return "unknown"

    def extract_tabular(self, table, headers):
        rows = table.find_all("tr")
        data = []
        for row in rows:
            tds = row.find_all("td")
            if not tds:
                continue
            cells = []
            for td in tds:
                try:
                    colspan = int(td.get("colspan", 1))
                except (ValueError, TypeError):
                    colspan = 1
                cells.extend([clean_text(td.get_text(strip=True))] * colspan)

            if len(cells) < len(headers):
                continue

            row_dict = {headers[i]: cells[i] for i in range(len(headers))}

            # Validation & Realignment
            serial = str(row_dict.get("serial_number") or "").strip()
            path = str(row_dict.get("path_descriptor") or "").strip().upper()
            if not (serial.isdigit() or path in self.valid_paths):
                continue

            # Realign row if role is in vpa_tch
            vpa_key = next((k for k in row_dict if "vpa" in k), None)
            role_key = next((k for k in row_dict if "role" in k), "role")
            if (
                vpa_key
                and row_dict.get(vpa_key)
                and str(row_dict[vpa_key]).strip().upper() in self.roles
            ):
                row_dict[role_key] = row_dict[vpa_key]
                row_dict[vpa_key] = None

            data.append(row_dict)
        return data

    def extract_waypoints(self, table):
        """Extract waypoints with per-field direction parsing."""
        wpts = []
        seen_ids = set()
        rows = table.find_all("tr")

        # 1. Try to find a header row and map columns
        ident_idx = None
        role_idx = None
        coord_indices = []
        header_row_index = -1

        for idx, row in enumerate(rows):
            tds = row.find_all(["td", "th"])
            cells = [clean_text(td.get_text(strip=True)) for td in tds]
            if not cells:
                continue

            # A row is a header row if it contains header keywords and no coordinate values
            row_text_lower = [c.lower() for c in cells if c]
            if not row_text_lower:
                continue

            is_header = any(
                any(
                    kw in cell
                    for kw in [
                        "waypoint",
                        "identifier",
                        "latitude",
                        "longitude",
                        "wgs84",
                        "role",
                        "function",
                        "coordinate",
                    ]
                )
                for cell in row_text_lower
            )
            # Exclude rows that contain coordinates (to avoid matching body data rows)
            is_data = any(
                re.search(r"\d{2}:\d{2}", c) or re.search(r"\d{6}[NS]", c) for c in cells if c
            )

            if is_header and not is_data:
                headers_clean = []
                for cell in cells:
                    if not cell:
                        headers_clean.append("")
                        continue
                    h = re.sub(r"\s+", " ", cell).lower()
                    h = re.sub(r"[°\'\"*`]", "", h).strip()
                    headers_clean.append(h)

                # Identify columns
                for c_idx, h in enumerate(headers_clean):
                    if any(
                        k in h
                        for k in [
                            "waypoint identifier",
                            "waypoint identified",
                            "waypoint ident",
                            "ident",
                            "fix",
                            "wpt",
                            "waypoint",
                        ]
                    ):
                        if ident_idx is None:
                            ident_idx = c_idx

                for c_idx, h in enumerate(headers_clean):
                    if any(k in h for k in ["role", "function"]):
                        role_idx = c_idx
                        break
                    if "type" in h and c_idx != ident_idx:
                        role_idx = c_idx
                        break

                for c_idx, h in enumerate(headers_clean):
                    if any(
                        k in h for k in ["latitude", "longitude", "coordinate", "wgs84", "coords"]
                    ):
                        coord_indices.append(c_idx)

                if ident_idx is not None:
                    header_row_index = idx
                    break

        # 2. Iterate through all rows and extract waypoints
        for idx, row in enumerate(rows):
            if header_row_index != -1 and idx <= header_row_index:
                continue

            tds = row.find_all(["td", "th"])
            cells = [clean_text(td.get_text(strip=True)) for td in tds]
            if len(cells) < 2:
                continue

            lat_dd, lon_dd = None, None

            # If we mapped columns via headers, try using them first
            if header_row_index != -1 and ident_idx is not None:
                for c_idx in coord_indices:
                    if c_idx < len(cells) and cells[c_idx]:
                        lat_dd, lon_dd = parse_coordinate(cells[c_idx])
                        if lat_dd is not None and lon_dd is not None:
                            break

                if (lat_dd is None or lon_dd is None) and len(coord_indices) >= 2:
                    for i in range(len(coord_indices) - 1):
                        c1 = coord_indices[i]
                        c2 = coord_indices[i + 1]
                        if c1 < len(cells) and c2 < len(cells) and cells[c1] and cells[c2]:
                            combined = f"{cells[c1]} {cells[c2]}"
                            lat_dd, lon_dd = parse_coordinate(combined)
                            if lat_dd is not None and lon_dd is not None:
                                break

            # Fallback coordinate parsing (check all cells individually)
            if lat_dd is None or lon_dd is None:
                for cell in cells:
                    if cell:
                        lat_dd, lon_dd = parse_coordinate(cell)
                        if lat_dd is not None and lon_dd is not None:
                            break

            # Fallback coordinate parsing (check combined adjacent cells)
            if lat_dd is None or lon_dd is None:
                for i in range(len(cells) - 1):
                    if cells[i] and cells[i + 1]:
                        combined = f"{cells[i]} {cells[i + 1]}"
                        lat_dd, lon_dd = parse_coordinate(combined)
                        if lat_dd is not None and lon_dd is not None:
                            break

            if lat_dd is None or lon_dd is None:
                continue

            # Validate the parsed coordinate
            if not is_valid_coord(lat_dd, lon_dd):
                logger.debug(f"Rejecting out-of-bounds coordinate: {lat_dd}, {lon_dd}")
                continue

            # Extract waypoint identifier & role
            ident = None
            role = None

            if header_row_index != -1 and ident_idx is not None:
                ident_val = cells[ident_idx] if ident_idx < len(cells) else None
                role_val = (
                    cells[role_idx] if (role_idx is not None and role_idx < len(cells)) else None
                )

                # Detect if columns are swapped (ident_val is blacklisted, but role_val is not)
                if ident_val and role_val:
                    id_upper = str(ident_val).upper().strip()
                    role_upper = str(role_val).upper().strip()
                    if id_upper in self.id_blacklist and role_upper not in self.id_blacklist:
                        ident_val, role_val = role_val, ident_val

                # Parse identifier
                if ident_val:
                    val_clean = str(ident_val).upper().strip().strip("'").strip("`")
                    if (
                        2 <= len(val_clean) <= 7
                        and val_clean.isalnum()
                        and not val_clean.isdigit()
                        and val_clean not in self.id_blacklist
                    ):
                        ident = val_clean

                # Parse role
                if role_val:
                    role_clean = str(role_val).strip().upper()
                    if role_clean and role_clean not in ("-", "N/A", "N/A.", "N / A"):
                        role = role_clean

            if not ident:
                for c in cells:
                    if not c:
                        continue
                    c_clean = str(c).upper().strip().strip("'").strip("`")
                    if (
                        2 <= len(c_clean) <= 7
                        and c_clean.isalnum()
                        and not c_clean.isdigit()
                        and c_clean not in self.id_blacklist
                    ):
                        ident = c_clean
                        break

            if ident and ident not in seen_ids:
                seen_ids.add(ident)

                wpts.append(
                    {
                        "waypoint_id": ident,
                        "coordinates_raw": " ".join(filter(None, cells)),
                        "lat_dd": lat_dd,
                        "lon_dd": lon_dd,
                        "role": role,
                    }
                )
        return wpts

    def parse_file(self, s3_key):
        filename = os.path.basename(s3_key)
        stem = os.path.splitext(filename)[0]

        obj_resp = self.s3_client.get_object(Bucket=self.bucket, Key=s3_key)
        content = obj_resp["Body"].read().decode("utf-8")
        soup = BeautifulSoup(content, "html.parser")

        airport_id, runway, proc_type = self.extract_metadata(filename)

        proc_data = {
            "procedure_name": stem,
            "airport_id": airport_id,
            "runway": runway,
            "procedure_type": proc_type,
            "tabular_description": [],
            "waypoints": [],
        }

        for table in soup.find_all("table"):
            t_type = self.classify_table(table)
            if t_type == "fas":
                continue

            if t_type == "tabular":
                # Extract headers — skip spanning title rows and unit rows
                headers = []
                for candidate_row in table.find_all("tr"):
                    cells = candidate_row.find_all(["td", "th"])
                    # Skip single-cell spanning title rows
                    try:
                        # pyrefly: ignore [bad-argument-type]
                        colspan = int(cells[0].get("colspan", 1))
                    except (ValueError, TypeError):
                        colspan = 1
                    if len(cells) == 1 and colspan > 3:
                        continue
                    # Need at least 5 real columns to be a header row
                    if len(cells) < 5:
                        continue
                    # Check if it looks like a header (contains known header keywords)
                    row_text = " ".join(c.get_text(strip=True).lower() for c in cells)
                    is_header = any(
                        kw in row_text
                        for kw in [
                            "serial",
                            "path",
                            "waypoint",
                            "fix",
                            "seq",
                            "descriptor",
                            "terminator",
                            "course",
                            "altitude",
                        ]
                    )
                    # Skip unit rows (ft, kt, NM, °/ft)
                    is_unit = all(
                        c.get_text(strip=True).lower() in ("", "ft", "kt", "nm", "°/ft", "min")
                        for c in cells
                    )
                    if is_header and not is_unit:
                        raw_h = [sanitize_header(c.get_text(strip=True)) for c in cells]
                        # Deduplicate
                        seen = {}
                        for h in raw_h:
                            if h in seen:
                                seen[h] += 1
                                headers.append(f"{h}_{seen[h]}")
                            else:
                                seen[h] = 0
                                headers.append(h)
                        break  # Found the header row
                if headers:
                    proc_data["tabular_description"].extend(self.extract_tabular(table, headers))

            # Extract waypoints from waypoint tables AND unknown tables
            if t_type in ("waypoint", "unknown", "tabular"):
                wpts = self.extract_waypoints(table)
                existing_ids = {w["waypoint_id"] for w in proc_data["waypoints"]}
                for w in wpts:
                    if w["waypoint_id"] not in existing_ids:
                        proc_data["waypoints"].append(w)
                        existing_ids.add(w["waypoint_id"])

        return proc_data
