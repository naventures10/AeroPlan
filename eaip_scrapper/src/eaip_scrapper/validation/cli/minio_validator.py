import argparse
import json
import sys

import boto3
from pydantic import TypeAdapter, ValidationError

from eaip_scrapper.validation.schemas.ingest.aerodrome import AerodromeDocument


class MinioValidator:
    def __init__(self, bucket_name="ais", endpoint_url="http://localhost:9000"):
        self.s3 = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id="ais_admin",
            aws_secret_access_key="AviationData2026!",
            region_name="us-east-1",
        )
        self.bucket_name = bucket_name

    def validate_minio_file(self, filename: str):
        print(f"[*] Fetching '{filename}' from MinIO bucket '{self.bucket_name}' for validation...")
        try:
            response = self.s3.get_object(Bucket=self.bucket_name, Key=filename)
            raw_data = json.loads(response["Body"].read().decode("utf-8"))
        except Exception as e:
            print(f"[!] Failed to fetch or parse file from MinIO: {e}")
            sys.exit(1)

        print(f"[*] Validating {len(raw_data)} aerodrome records...")

        adapter = TypeAdapter(list[AerodromeDocument])
        try:
            adapter.validate_python(raw_data)
            print(f"[✓] Validation successful. All {len(raw_data)} records adhere to the schema.")
        except ValidationError as e:
            print(f"[!] VALIDATION FAILED for '{filename}'!")
            print(e)
            print(
                "\n[!] The scraper output does not match the required schema or contains invalid coordinate formats."
            )
            print("[!] Halting pipeline. Please fix the scraper and run it again.")
            sys.exit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Strict Validation for Aerodromes Scraper Output")
    parser.add_argument("--bucket", type=str, default="ais", help="MinIO bucket name")
    parser.add_argument(
        "--filename",
        type=str,
        default="output/master_aip_data.json",
        help="MinIO object key to validate",
    )
    args = parser.parse_args()

    validator = MinioValidator(bucket_name=args.bucket)
    validator.validate_minio_file(filename=args.filename)
