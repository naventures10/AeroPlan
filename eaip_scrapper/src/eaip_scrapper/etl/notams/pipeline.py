import json
import re
import sys
import tempfile
from pathlib import Path

import boto3
from sqlalchemy import create_engine, text

from eaip_scrapper.etl.notams.base_parser import (
    MINIO_ACCESS_KEY,
    MINIO_BUCKET,
    MINIO_ENDPOINT,
    MINIO_SECRET_KEY,
    BaseNotamParser,
)
from eaip_scrapper.etl.notams.parsers import (
    ChennaiLlamaParser,
    DelhiLlamaParser,
    KolkataLlamaParser,
    MumbaiLlamaParser,
)
from eaip_scrapper.validation.schemas.database.notams import NotamDatabaseRecord


class NOTAMETL:
    def __init__(self, db_url):
        self.engine = create_engine(db_url)
        self.s3 = boto3.client(
            "s3",
            endpoint_url=MINIO_ENDPOINT,
            aws_access_key_id=MINIO_ACCESS_KEY,
            aws_secret_access_key=MINIO_SECRET_KEY,
        )
        self.bucket = MINIO_BUCKET

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
        print(f"[*] Fetching NOTAM markdowns from MinIO bucket '{self.bucket}'...")
        try:
            response = self.s3.list_objects_v2(Bucket=self.bucket, Prefix="output/notams/")
            if "Contents" not in response:
                print("[!] No NOTAM files found in MinIO.")
                return

            objects = response["Contents"]

            with tempfile.TemporaryDirectory() as temp_dir:
                temp_path = Path(temp_dir)
                for obj in objects:
                    if not obj["Key"].endswith(".md"):
                        continue
                    local_path = temp_path / obj["Key"].split("/")[-1]
                    self.s3.download_file(self.bucket, obj["Key"], str(local_path))

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
                # Stripping asterisks and whitespace to ensure it's truly a description
                import re as core_re

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

        with self.engine.begin() as conn:
            conn.execute(
                text("""
                DROP TABLE IF EXISTS notams;
                CREATE TABLE notams (
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
            """)
            )

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
    db_url = "postgresql://postgres:postgres@localhost:5432/aeronautical_information_system"
    etl_pipeline = NOTAMETL(db_url)
    etl_pipeline.process_from_minio()


if __name__ == "__main__":
    main()
