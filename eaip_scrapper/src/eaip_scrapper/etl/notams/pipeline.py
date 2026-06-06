import argparse
import json
import re
import sys
import tempfile
from pathlib import Path

from sqlalchemy import create_engine, text

from eaip_scrapper.etl.notams.base_parser import BaseNotamParser
from eaip_scrapper.etl.notams.parsers import (
    ChennaiLlamaParser,
    DelhiLlamaParser,
    KolkataLlamaParser,
    MumbaiLlamaParser,
)
from eaip_scrapper.etl.storage_client import UnifiedStorageClient
from eaip_scrapper.validation.schemas.database.notams import NotamDatabaseRecord


class NOTAMETL:
    def __init__(self, db_url, force_recreate=False):
        self.engine = create_engine(db_url)
        self.storage_client = UnifiedStorageClient()
        self.force_recreate = force_recreate

    def select_parser(self, filepath: Path) -> BaseNotamParser:
        name = filepath.name.lower()
        if "chennai" in name:
            return ChennaiLlamaParser()
        if "delhi" in name:
            return DelhiLlamaParser()
        if "kolkata" in name:
            return KolkataLlamaParser()
        if "mumbai" in name:
            return MumbaiLlamaParser()
        # Pending classes for other FIRs
        return BaseNotamParser()

    def process_from_minio(self):
        print("[*] Fetching NOTAM markdowns from storage...")
        try:
            objects = self.storage_client.list_objects("output/notams/")
            if not objects:
                print("[!] No NOTAM files found in storage.")
                return

            with tempfile.TemporaryDirectory() as temp_dir:
                temp_path = Path(temp_dir)
                for obj in objects:
                    key = obj["Key"]
                    if not key.endswith(".md"):
                        continue
                    local_path = temp_path / key.split("/")[-1]
                    self.storage_client.download_file(key, str(local_path))

                # Process the downloaded files in the temporary directory
                self.process_all(temp_path)

        except Exception as e:
            print(f"[!] Failed to fetch from MinIO: {e}")

    def process_all(self, directory: Path):
        all_markdowns = sorted(
            [f for f in directory.glob("*.md") if re.search(r"[A-Za-z]+_[A-Z]_\d{4}_\d{2}", f.name)]
        )
        if not all_markdowns:
            print("[!] No .md files found.")
            return

        all_records = []
        description_cache = {}

        for md_file in all_markdowns:
            # We will process Chennai, Delhi, Kolkata, and Mumbai
            if not any(
                fir in md_file.name.lower() for fir in ["chennai", "delhi", "kolkata", "mumbai"]
            ):
                continue

            # Skip Delhi January files as their active NOTAMs are carried forward
            match = re.search(r"([A-Za-z]+)_([A-Z])_(\d{4})_(\d{2})", md_file.name)
            if match and match.group(1).lower() == "delhi" and match.group(4) == "01":
                continue

            parser = self.select_parser(md_file)
            recs = parser.extract_from_md(md_file)
            parser.validate_extraction(md_file.name)

            # Apply Description Caching Logic
            last_desc = ""
            for r in recs:
                notam_id = r.get("notam_id")
                desc = r.get("description", "").strip()

                # Clean HTML comments and tags from the description
                import re as core_re

                desc = core_re.sub(r"<!--.*?(?:-->|$)", "", desc, flags=core_re.DOTALL)
                desc = core_re.sub(r"<[^>]+>", "", desc)
                desc = desc.strip()
                r["description"] = desc

                # Stripping asterisks and whitespace to ensure it's truly a description
                clean_desc = core_re.sub(r"[\*\s\|]+", "", desc).upper()
                if clean_desc and clean_desc not in ("EST", "PERM"):
                    description_cache[notam_id] = desc
                    last_desc = desc
                else:
                    cached = description_cache.get(notam_id, "")
                    if cached:
                        r["description"] = cached
                    else:
                        r["description"] = last_desc

            print(f"  [+] Extracted {len(recs)} NOTAMs.")
            all_records.extend(recs)

        if all_records:
            self.load_to_db(all_records)

        print("\n[!] eaip_scrapper.etl Process Completed Successfully.")

    def load_to_db(self, records):
        if not records:
            return

        print(
            f"[*] Loading {len(records)} records to PostgreSQL mapping entirely to ICAO (3.5.1/3.5.2)..."
        )

        schema_query = """
        CREATE TABLE IF NOT EXISTS notams (
            notam_id TEXT,
            source_file TEXT,
            series TEXT,
            scope TEXT,
            fir TEXT,
            combined_fir TEXT,
            airport_icao TEXT,
            valid_from TIMESTAMP,
            valid_to TIMESTAMP,
            is_permanent BOOLEAN,
            is_estimated BOOLEAN,
            duration_category TEXT,
            description TEXT,
            raw_json JSONB,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (notam_id, source_file)
        );
        """

        # Perform atomic table creation and truncation inside a transaction
        with self.engine.begin() as conn:
            if self.force_recreate:
                print("[!] --force-recreate passed. Recreating notams table...")
                conn.execute(text("DROP TABLE IF EXISTS notams;"))

            # Ensure the table is constructed
            conn.execute(text(schema_query))

            # Empty the table atomically under a single transaction
            print("[*] Performing atomic truncation of notams table...")
            conn.execute(text("TRUNCATE TABLE notams;"))

        with self.engine.begin() as conn:
            for r in records:
                data = {
                    "notam_id": r["notam_id"],
                    "source_file": r.get("raw_json", {}).get("source", "unknown"),
                    "series": r["series"],
                    "scope": r.get("scope", "UNKNOWN"),
                    "fir": r.get("fir").split("/")[0] if r.get("fir") else None,
                    "combined_fir": r.get("fir")
                    if (r.get("fir") and "/" in r.get("fir"))
                    else None,
                    "airport_icao": r.get("airport_icao"),
                    "valid_from": r.get("valid_from"),
                    "valid_to": r.get("valid_to"),
                    "is_permanent": r.get("is_permanent", False),
                    "is_estimated": r.get("is_estimated", False),
                    "duration_category": r.get("duration_category", "UNKNOWN"),
                    "description": r.get("description", ""),
                    "raw_json": r.get("raw_json", {}),
                }

                # Rigorous Pydantic schema validation
                try:
                    NotamDatabaseRecord(**data)
                except Exception as e:
                    print(
                        f"\n[!] DATABASE INTEGRITY FAILURE: NOTAM record {data.get('notam_id')} failed validation!"
                    )
                    print(e)
                    print("[!] Halting ETL pipeline to prevent invalid data write to PostgreSQL.")
                    sys.exit(1)

                stmt = text("""
                    INSERT INTO notams (notam_id, source_file, series, scope, fir, combined_fir, airport_icao, valid_from, valid_to, is_permanent, is_estimated, duration_category, description, raw_json)
                    VALUES (:notam_id, :source_file, :series, :scope, :fir, :combined_fir, :airport_icao, :valid_from, :valid_to, :is_permanent, :is_estimated, :duration_category, :description, :raw_json)
                    ON CONFLICT (notam_id, source_file) DO UPDATE SET
                        series = EXCLUDED.series,
                        scope = EXCLUDED.scope,
                        fir = EXCLUDED.fir,
                        combined_fir = EXCLUDED.combined_fir,
                        airport_icao = EXCLUDED.airport_icao,
                        valid_from = EXCLUDED.valid_from,
                        valid_to = EXCLUDED.valid_to,
                        is_permanent = EXCLUDED.is_permanent,
                        is_estimated = EXCLUDED.is_estimated,
                        duration_category = EXCLUDED.duration_category,
                        description = EXCLUDED.description,
                        raw_json = EXCLUDED.raw_json,
                        updated_at = CURRENT_TIMESTAMP;
                """)
                insert_data = data.copy()
                insert_data["raw_json"] = json.dumps(data["raw_json"])
                conn.execute(stmt, insert_data)


def main():
    import os

    parser = argparse.ArgumentParser(description="AeroPlan NOTAM ETL Pipeline")
    parser.add_argument(
        "--force-recreate",
        action="store_true",
        help="Drop and recreate the notams table before inserting",
    )
    args = parser.parse_args()

    from dotenv import load_dotenv

    load_dotenv()

    # Get database URL from env, or construct it from separate parts, or fallback to default
    db_url = os.getenv("DB_URL")
    if not db_url:
        db_user = os.getenv("DB_USER")
        db_pass = os.getenv("DB_PASSWORD")
        db_host = os.getenv("DB_HOST")
        db_port = os.getenv("DB_PORT")
        db_name = os.getenv("DB_NAME")
        if not all([db_user, db_pass, db_host, db_port, db_name]):
            raise ValueError(
                "DB_URL or individual DB credentials must be set in environment variables."
            )
        db_url = f"postgresql://{db_user}:{db_pass}@{db_host}:{db_port}/{db_name}"

    etl_pipeline = NOTAMETL(db_url, force_recreate=args.force_recreate)
    etl_pipeline.process_from_minio()


if __name__ == "__main__":
    main()
