import json
import os
import sys

from pydantic import TypeAdapter, ValidationError

from eaip_scrapper.validation.schemas.ingest.aerodrome import AerodromeDocument


class ValidationRouter:
    """
    Centralized router for verifying 100% data integrity before data is synced to MinIO or DB.
    """

    def __init__(self):
        # Register the schemas mapped to their respective filenames
        self.schema_registry = {
            "master_aip_data.json": TypeAdapter(list[AerodromeDocument]),
            # We will add ENR schemas here one by one as we build them.
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
