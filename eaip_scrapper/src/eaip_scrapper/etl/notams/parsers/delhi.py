import re
from pathlib import Path

from bs4 import BeautifulSoup

from eaip_scrapper.etl.notams.base_parser import (
    NOTAM_ID_PATTERN,
    VALIDITY_PATTERN,
    BaseNotamParser,
)


class DelhiLlamaParser(BaseNotamParser):
    """
    Parser bespoke to Delhi Series A/C/G formats from LlamaParse Markdown.
    Uses BeautifulSoup to extract logical NOTAM blocks from HTML tables,
    and preserves table formatting within NOTAM descriptions.
    """

    def extract_from_md(self, file_path: Path):
        print(f"  [*] Parsing Delhi Markdown: {file_path.name}...")

        match = re.search(r"([A-Za-z]+)_([A-Z])_(\d{4})_(\d{2})", file_path.name)
        if match:
            fir_raw = match.group(1).upper()
            self.current_fir = "VIDF" if fir_raw == "DELHI" else fir_raw
            self.series = match.group(2).upper()
        else:
            self.current_fir = "VIDF"
            self.series = (
                "A" if "_A_" in file_path.name else ("C" if "_C_" in file_path.name else "G")
            )

        self.default_fir = self.current_fir

        with open(file_path, encoding="utf-8") as f:
            content = f.read()

        current_notam = None

        def commit_notam():
            nonlocal current_notam
            if current_notam and current_notam.get("valid_from_raw"):
                # pyrefly: ignore [no-matching-overload]
                current_notam["description"] = re.sub(
                    r"\n{3,}", "\n\n", current_notam["description"]
                ).strip()
                s = current_notam["series"]
                current_notam["scope"] = (
                    "INT_L"
                    if s == "A"
                    else "INT_S"
                    if s == "B"
                    else "DOM"
                    if s == "C"
                    else "MIL_DOM"
                    if s == "D"
                    else "GEN"
                    if s == "G"
                    else "SNOWTAM"
                    # pyrefly: ignore [missing-attribute]
                    if s.startswith("SW")
                    else "UNKNOWN"
                )
                current_notam["is_permanent"] = (
                    "PERM" in (current_notam.get("valid_to_raw") or "").upper()
                )
                current_notam["is_estimated"] = (
                    "EST" in (current_notam.get("valid_to_raw") or "").upper()
                )
                current_notam["valid_from"] = self.parse_notam_time(current_notam["valid_from_raw"])
                current_notam["valid_to"] = self.parse_notam_time(current_notam["valid_to_raw"])
                current_notam["duration_category"] = self.calculate_duration_category(current_notam)
                current_notam["raw_json"] = {"source": file_path.name}
                self.records.append(current_notam)
            current_notam = None

        blocks = []
        segments = re.split(r"(<table.*?>.*?</table>)", content, flags=re.DOTALL)
        for seg in segments:
            seg = seg.strip()
            if not seg:
                continue

            if seg.startswith("<table"):
                table_soup = BeautifulSoup(seg, "html.parser")
                for row in table_soup.find_all("tr"):
                    cells = row.find_all(["td", "th"])
                    row_texts = []
                    for c in cells:
                        for br in c.find_all("br"):
                            br.replace_with("\n")
                        txt = c.get_text(separator="\n").strip()
                        row_texts.append(txt)
                    if row_texts:
                        blocks.append({"type": "table_row", "data": row_texts})
            else:
                for line in seg.split("\n"):
                    line = line.strip()
                    if line:
                        blocks.append({"type": "text", "data": line})

        STATE_SEEKING_HEADER = 0
        STATE_SEEKING_NOTAM = 1
        STATE_BUILDING_NOTAM = 2

        state = STATE_SEEKING_HEADER
        passed_checklist = False

        for block in blocks:
            if block["type"] == "text":
                raw_text = block["data"]
                # pyrefly: ignore [no-matching-overload]
                clean_text = re.sub(r"^[>\*\-#]+\s*", "", raw_text).strip()
                unformatted_text = re.sub(r"\*+", "", clean_text).strip()
            else:
                raw_text = " | ".join(cell.replace("\n", " ") for cell in block["data"])
                clean_text = " ".join(block["data"])
                unformatted_text = clean_text

            upper_text = unformatted_text.upper()

            if (
                "LATEST PUBLICATIONS" in upper_text
                or "AIP SUP CHECKLIST AS ON" in upper_text
                or "AIP AIRAC AMDT" in upper_text
            ):
                break

            if not passed_checklist:
                if "CHECKLIST" in upper_text and "AIP" not in upper_text:
                    continue
                htype, icaos = self._classify_header(unformatted_text)
                if htype:
                    passed_checklist = True
                else:
                    continue

            htype, icaos = self._classify_header(unformatted_text)
            if htype and not NOTAM_ID_PATTERN.search(unformatted_text):
                commit_notam()
                if htype == "fir":
                    self.current_fir = "/".join(icaos) if icaos else self.current_fir
                    self.current_airport = None
                elif htype == "airport":
                    self.current_airport = icaos[0] if icaos else None
                    self.current_fir = self.default_fir
                state = STATE_SEEKING_NOTAM
                continue

            is_new, primary_id = self._is_new_notam(unformatted_text)
            if is_new:
                commit_notam()
                current_notam = {
                    "notam_id": primary_id,
                    "series": self.series,
                    "fir": self.current_fir,
                    "airport_icao": self.current_airport,
                    "valid_from_raw": None,
                    "valid_to_raw": None,
                    "description": "",
                }
                state = STATE_BUILDING_NOTAM

                if block["type"] == "table_row" and len(block["data"]) >= 2:
                    cell_0 = block["data"][0]
                    cell_1 = block["data"][1]
                    if primary_id and primary_id in cell_0:
                        v_match = VALIDITY_PATTERN.search(cell_1)
                        if v_match:
                            current_notam["valid_from_raw"] = v_match.group(1)
                            current_notam["valid_to_raw"] = v_match.group(2)
                            desc = cell_1[v_match.end() :].strip()
                            if desc:
                                current_notam["description"] += desc + "\n"
                        else:
                            current_notam["description"] += cell_1 + "\n"

                        if len(block["data"]) > 2:
                            current_notam["description"] += " | ".join(block["data"][2:]) + "\n"
                        continue

                remainder = clean_text.replace(primary_id or "", "").strip()
                if remainder:
                    v_match = VALIDITY_PATTERN.search(remainder)
                    if v_match:
                        current_notam["valid_from_raw"] = v_match.group(1)
                        current_notam["valid_to_raw"] = v_match.group(2)
                        desc = remainder[v_match.end() :].strip()
                        if desc:
                            current_notam["description"] += desc + "\n"
                    else:
                        current_notam["description"] += remainder + "\n"
                continue

            if state == STATE_BUILDING_NOTAM:
                # pyrefly: ignore [missing-attribute]
                if not current_notam.get("valid_from_raw"):
                    v_match = VALIDITY_PATTERN.search(unformatted_text)
                    if v_match:
                        # pyrefly: ignore [unsupported-operation]
                        current_notam["valid_from_raw"] = v_match.group(1)
                        # pyrefly: ignore [unsupported-operation]
                        current_notam["valid_to_raw"] = v_match.group(2)
                        desc = clean_text[v_match.end() :].strip()
                        if desc:
                            # pyrefly: ignore [unsupported-operation]
                            current_notam["description"] += desc + "\n"
                        continue

                if block["type"] == "text":
                    # pyrefly: ignore [unsupported-operation]
                    current_notam["description"] += clean_text + "\n"
                else:
                    # pyrefly: ignore [unsupported-operation]
                    current_notam["description"] += raw_text + "\n"

        commit_notam()
        return self.records
