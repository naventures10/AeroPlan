import re
from pathlib import Path

from bs4 import BeautifulSoup

from eaip_scrapper.etl.notams.base_parser import (
    NOTAM_ID_PATTERN,
    VALIDITY_PATTERN,
    BaseNotamParser,
)


class ChennaiLlamaParser(BaseNotamParser):
    """
    Parser bespoke to Chennai Series A/C formats from LlamaParse Markdown.
    Uses BeautifulSoup to extract logical NOTAM blocks from HTML tables.
    """

    def extract_from_md(self, file_path: Path):
        print(f"  [*] Parsing Chennai Markdown: {file_path.name}...")

        match = re.search(r"([A-Za-z]+)_([A-Z])_(\d{4})_(\d{2})", file_path.name)
        if match:
            fir_raw = match.group(1).upper()
            self.current_fir = "VOMF" if fir_raw == "CHENNAI" else fir_raw
            self.series = match.group(2).upper()
        else:
            self.current_fir = "VOMF"
            self.series = "A" if "_A_" in file_path.name else "C"

        self.default_fir = self.current_fir

        with open(file_path, encoding="utf-8") as f:
            content = f.read()

        current_notam = None

        def commit_notam():
            nonlocal current_notam
            if current_notam and current_notam.get("valid_from_raw"):
                # Clean up description
                # pyrefly: ignore [no-matching-overload]
                current_notam["description"] = re.sub(
                    r"\s+", " ", current_notam["description"]
                ).strip()

                # Check for empty description only at very end or ID switch if desired,
                # but better to keep it and see what's missing.
                if not current_notam["description"] and not current_notam.get("is_permanent"):
                    # Some temporary NOTAMs might have empty descriptions if extraction failed,
                    # but let's keep them for now to avoid data loss.
                    pass

                # Assign duration category and parse times
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

        # Extract unified blocks of text
        segments = re.split(r"(<table.*?>.*?</table>)", content, flags=re.DOTALL)
        blocks = []
        for seg in segments:
            seg = seg.strip()
            if not seg:
                continue

            if seg.startswith("<table"):
                table_soup = BeautifulSoup(seg, "html.parser")
                for row in table_soup.find_all("tr"):
                    cells = row.find_all(["td", "th"])
                    for c in cells:
                        for br in c.find_all("br"):
                            br.replace_with("\n")
                        txt = c.get_text(separator="\n").strip()
                        if txt:
                            # Split strictly by newline to simulate linear flow
                            for line in txt.split("\n"):
                                line = line.strip()
                                # Clean any rogue markdown markers
                                line = re.sub(r"^\*+|\*+$|^#+", "", line).strip()
                                if line:
                                    blocks.append(line)
            else:
                for line in seg.split("\n"):
                    line = line.strip()
                    line = re.sub(r"^\*+|\*+$|^#+", "", line).strip()
                    if line:
                        blocks.append(line)

        # FSM States
        STATE_SEEKING_HEADER = 0
        STATE_SEEKING_NOTAM = 1
        STATE_BUILDING_NOTAM = 2

        state = STATE_SEEKING_HEADER
        passed_checklist = False

        for block in blocks:
            upper_block = block.upper()

            # 1. End of Document Fencing
            if (
                "LATEST PUBLICATIONS" in upper_block
                or "AIP SUP CHECKLIST AS ON" in upper_block
                or "AIP AIRAC AMDT" in upper_block
            ):
                break

            # 2. Checklist Fencing
            if not passed_checklist:
                if "CHECKLIST" in upper_block and "AIP" not in upper_block:
                    continue
                # Once we encounter a valid header, the checklist is over.
                htype, icaos = self._classify_header(block)
                if htype:
                    passed_checklist = True
                else:
                    continue

            # FSM Transitions
            if state == STATE_SEEKING_HEADER:
                htype, icaos = self._classify_header(block)
                if htype:
                    if htype == "fir":
                        self.current_fir = "/".join(icaos) if icaos else self.current_fir
                        self.current_airport = None
                    elif htype == "airport":
                        self.current_airport = icaos[0] if icaos else None
                        self.current_fir = self.default_fir
                    state = STATE_SEEKING_NOTAM
                continue

            elif state == STATE_SEEKING_NOTAM:
                # Check for Header Change
                htype, icaos = self._classify_header(block)
                if htype and not NOTAM_ID_PATTERN.search(block):
                    if htype == "fir":
                        self.current_fir = "/".join(icaos) if icaos else self.current_fir
                        self.current_airport = None
                    elif htype == "airport":
                        self.current_airport = icaos[0] if icaos else None
                        self.current_fir = self.default_fir
                    continue

                # Check for NOTAM ID
                is_new, primary_id = self._is_new_notam(block)
                if is_new:
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

                    # Process remaining text in building block
                    remainder = block.replace(primary_id or "", "").strip()
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

            elif state == STATE_BUILDING_NOTAM:
                # Check for Header Change
                htype, icaos = self._classify_header(block)
                if htype and not NOTAM_ID_PATTERN.search(block):
                    commit_notam()
                    if htype == "fir":
                        self.current_fir = "/".join(icaos) if icaos else self.current_fir
                        self.current_airport = None
                    elif htype == "airport":
                        self.current_airport = icaos[0] if icaos else None
                        self.current_fir = self.default_fir
                    state = STATE_SEEKING_NOTAM
                    continue

                # Check for New NOTAM
                is_new, primary_id = self._is_new_notam(block)
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

                    remainder = block.replace(primary_id or "", "").strip()
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

                # Append to current description
                # pyrefly: ignore [missing-attribute]
                if not current_notam.get("valid_from_raw"):
                    v_match = VALIDITY_PATTERN.search(block)
                    if v_match:
                        # pyrefly: ignore [unsupported-operation]
                        current_notam["valid_from_raw"] = v_match.group(1)
                        # pyrefly: ignore [unsupported-operation]
                        current_notam["valid_to_raw"] = v_match.group(2)
                        desc = block[v_match.end() :].strip()
                        if desc:
                            # pyrefly: ignore [unsupported-operation]
                            current_notam["description"] += desc + "\n"
                    else:
                        # pyrefly: ignore [unsupported-operation]
                        current_notam["description"] += block + "\n"
                else:
                    # pyrefly: ignore [unsupported-operation]
                    current_notam["description"] += block + "\n"

        commit_notam()
        return self.records
