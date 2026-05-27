import json
import os
import re
import sys

from pydantic import TypeAdapter, ValidationError

from eaip_scrapper.validation.schemas.ingest.aerodrome import AerodromeDocument
from eaip_scrapper.validation.schemas.ingest.enr_2_1_airspace import ENR21AirspaceDocument
from eaip_scrapper.validation.schemas.ingest.enr_2_2_regulated_airspace import (
    ENR22RegulatedAirspaceDocument,
)
from eaip_scrapper.validation.schemas.ingest.enr_3_3_2_upr_zones import ENR332UPRZonesDocument
from eaip_scrapper.validation.schemas.ingest.enr_4_1 import ENR41RadioNavAidsDocument
from eaip_scrapper.validation.schemas.ingest.enr_5_1_prohibited_areas import (
    ENR51ProhibitedAreasDocument,
)
from eaip_scrapper.validation.schemas.ingest.enr_5_2_military_areas import (
    ENR52MilitaryAreasDocument,
)
from eaip_scrapper.validation.schemas.ingest.enr_6 import ENR6Schema


class ValidationRouter:
    """
    Centralized router for verifying 100% data integrity before data is synced to MinIO or DB.
    """

    def __init__(self):
        # Register the schemas mapped to their respective filenames
        self.schema_registry = {
            "master_aip_data.json": TypeAdapter(list[AerodromeDocument]),
            "enr_2_1_airspace.json": TypeAdapter(ENR21AirspaceDocument),
            "enr_2_2_other_regulated_airspace.json": TypeAdapter(ENR22RegulatedAirspaceDocument),
            "enr_5_1_prohibited_restricted_danger.json": TypeAdapter(ENR51ProhibitedAreasDocument),
            "enr_5_2_military_exercise_adiz.json": TypeAdapter(ENR52MilitaryAreasDocument),
            "enr_3_3_2_upr_zones.json": TypeAdapter(ENR332UPRZonesDocument),
            "enr_6_en_route_charts.json": TypeAdapter(ENR6Schema),
            "enr_4_1_radio_nav_aids.json": TypeAdapter(ENR41RadioNavAidsDocument),
        }

    def validate_local_file(self, file_path: str) -> bool:
        """
        Reads a local JSON file and validates its contents against the registered schema.
        Returns True if valid or if no schema is registered (to allow progressive rollout).
        Raises SystemExit on validation failure to enforce strict halting.
        """
        file_name = os.path.basename(file_path)
        print(f"\n[*] Central Validator: Inspecting '{file_name}'...")

        schema_adapter = self.schema_registry.get(file_name)

        if not schema_adapter:
            print(f"  [WARN] Bypassed: No Pydantic schema registered yet for '{file_name}'.")
            return True

        try:
            with open(file_path, encoding="utf-8") as f:
                raw_data = json.load(f)
        except Exception as e:
            print(f"  [!] CRITICAL: Failed to read or parse JSON for '{file_name}': {e}")
            sys.exit(1)

        try:
            print(
                f"  -> Applying rigorous Pydantic schema validation for {len(raw_data)} records..."
            )
            schema_adapter.validate_python(raw_data)
            print(f"  [✓] '{file_name}' is 100% compliant with the data contract.")
            return True
        except ValidationError as e:
            print(f"\n[!] DATA INTEGRITY FAILURE IN '{file_name}'!")
            print(e)
            print(
                "[!] The scraper output violates the schema contract. Halting pipeline to prevent bad data upload."
            )
            sys.exit(1)

    def validate_ingest_json_string(self, file_name: str, json_string: str) -> bool:
        """
        Validates a raw JSON string against the registered schema.
        Raises SystemExit on validation failure.
        """
        print(f"\n[*] Central Validator: Inspecting '{file_name}' from MinIO payload...")

        schema_adapter = self.schema_registry.get(file_name)

        if not schema_adapter:
            print(f"  [WARN] Bypassed: No Pydantic schema registered yet for '{file_name}'.")
            return True

        try:
            raw_data = json.loads(json_string)
        except Exception as e:
            print(f"  [!] CRITICAL: Failed to parse JSON for '{file_name}': {e}")
            sys.exit(1)

        try:
            print("  -> Applying rigorous Pydantic schema validation...")
            schema_adapter.validate_python(raw_data)
            print(f"  [✓] '{file_name}' is 100% compliant with the data contract.")
            return True
        except ValidationError as e:
            print(f"\n[!] DATA INTEGRITY FAILURE IN '{file_name}'!")
            print(e)
            print("[!] The fetched data violates the schema contract. Halting pipeline.")
            sys.exit(1)

    def validate_raw_markdown(self, content: str, source_name: str, strict: bool = True) -> bool:
        """
        Validates that raw unstructured markdown/HTML data is substantially present
        and does not contain corrupted dates or empty records.

        Args:
            content: The raw markdown/HTML text to validate.
            source_name: A human-readable identifier for logging.
            strict: If True, applies the OCR corruption threshold check.
                    If False (lenient mode), skips corruption checks — used as a
                    last resort when both OCR engines reproduce source-level noise.
        """
        if not content or len(content.strip()) < 1000:
            print(f"\n[!] DATA INTEGRITY FAILURE IN {source_name}!")
            print(f"[!] Content is too short or empty (length: {len(content)}).")
            return False

        # Ensure it has some tabular structures
        if "<table>" not in content and "<tr" not in content and "|" not in content:
            print(f"\n[!] DATA INTEGRITY FAILURE IN {source_name}!")
            print("[!] Content does not contain expected tabular structures (HTML or Markdown).")
            return False

        # Threshold-based OCR date corruption check (strict mode only)
        # Validity timestamps should be exactly 10 digits (YYMMDDHHMM).
        # A few corrupted timestamps (<= 5%) indicate source-level PDF noise.
        # In strict mode, we have zero tolerance for corrupted timestamps (11 or 12 digits),
        # which indicates OCR hallucination (e.g. reading border lines as digits).
        if strict:
            timestamp_pattern = re.compile(r"(\d{10,12})\s*/\s*(\d{10,12}|PERM|\S+?EST|\S+?PERM)")
            all_matches = timestamp_pattern.findall(content)
            total_count = len(all_matches)

            if total_count > 0:
                corrupted_count = sum(
                    1
                    for from_ts, to_ts in all_matches
                    if len(from_ts) > 10 or (to_ts.isdigit() and len(to_ts) > 10)
                )

                if corrupted_count > 0:
                    corruption_rate = corrupted_count / total_count
                    print(f"\n[!] DATA INTEGRITY FAILURE IN {source_name}!")
                    print(
                        f"[!] OCR corruption detected: {corrupted_count}/{total_count} "
                        f"timestamps ({corruption_rate:.1%}) have 11-12 digits. "
                        f"Zero tolerance threshold in strict mode."
                    )
                    return False

        # Ensure that there is at least one NOTAM ID present in the text (e.g., A1234/26, C0123/25)
        # to guarantee the OCR didn't completely skip or fail to extract the actual NOTAM content.
        notam_id_pattern = re.compile(r"\b[A-Za-z]\d{4}/\d{2}\b")
        if not notam_id_pattern.search(content):
            print(f"\n[!] DATA INTEGRITY FAILURE IN {source_name}!")
            print("[!] No NOTAM IDs found in the markdown, indicating possible extraction failure.")
            return False

        mode_label = "strictly" if strict else "leniently (source-level corruption accepted)"
        print(f"[✓] {source_name} raw structure and content {mode_label} validated.")
        return True
