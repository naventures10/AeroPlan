import json
import os

import boto3
from google.cloud import storage


class UnifiedStorageClient:
    """
    Unified Storage Client wrapper that supports:
    1. Direct AWS S3 compatibility via boto3 client for local MinIO in development.
    2. Native GCP Google Cloud Storage client for staging and production (fully keyless with ADC).
    """

    def __init__(self):
        self.env = os.getenv("ENVIRONMENT", "development").lower()
        self.is_gcs = self.env in ("staging", "production")

        # Bucket is shared across both implementations
        self.bucket_name = os.getenv("MINIO_BUCKET", "ais")

        if self.is_gcs:
            # Native GCP GCS client (authenticates using ADC or service accounts automatically)
            self.gcs_client = storage.Client()
            print(f"[*] UnifiedStorageClient initialized in {self.env.upper()} GCS mode.")
        else:
            # boto3 S3 client for MinIO local dev
            from dotenv import load_dotenv

            load_dotenv()

            minio_endpoint = os.getenv("MINIO_ENDPOINT")
            minio_access_key = os.getenv("MINIO_ACCESS_KEY")
            minio_secret_key = os.getenv("MINIO_SECRET_KEY")
            if not minio_access_key or not minio_secret_key:
                raise ValueError(
                    "MINIO_ACCESS_KEY and MINIO_SECRET_KEY environment variables must be set "
                    "for development mode"
                )

            self.s3_client = boto3.client(
                "s3",
                endpoint_url=minio_endpoint,
                aws_access_key_id=minio_access_key,
                aws_secret_access_key=minio_secret_key,
                region_name="us-east-1",
            )
            print(
                f"[*] UnifiedStorageClient initialized in DEVELOPMENT S3/MinIO mode (endpoint: {minio_endpoint})."
            )

    def upload_file(self, local_path: str, s3_key: str) -> None:
        """Upload a local file to the storage provider."""
        if self.is_gcs:
            bucket = self.gcs_client.bucket(self.bucket_name)
            blob = bucket.blob(s3_key)
            blob.upload_from_filename(local_path)
        else:
            self.s3_client.upload_file(local_path, self.bucket_name, s3_key)

    def upload_json(self, data: dict, s3_key: str) -> None:
        """Serialize and upload a JSON document to the storage provider."""
        if self.is_gcs:
            bucket = self.gcs_client.bucket(self.bucket_name)
            blob = bucket.blob(s3_key)
            blob.upload_from_string(json.dumps(data, indent=2), content_type="application/json")
        else:
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=s3_key,
                Body=json.dumps(data, indent=2).encode("utf-8"),
                ContentType="application/json",
            )

    def list_objects(self, prefix: str) -> list[dict]:
        """
        List all object summaries under a prefix.
        Returns a list of dicts with key "Key" for backward-compatibility.
        """
        if self.is_gcs:
            bucket = self.gcs_client.bucket(self.bucket_name)
            blobs = bucket.list_blobs(prefix=prefix)
            return [{"Key": b.name} for b in blobs]
        else:
            # Paginated loop to collect all keys
            paginator = self.s3_client.get_paginator("list_objects_v2")
            pages = paginator.paginate(Bucket=self.bucket_name, Prefix=prefix)
            objects = []
            for page in pages:
                if "Contents" in page:
                    objects.extend(page["Contents"])
            return objects

    def download_file(self, s3_key: str, local_path: str) -> None:
        """Download an object to a local file path."""
        if self.is_gcs:
            bucket = self.gcs_client.bucket(self.bucket_name)
            blob = bucket.blob(s3_key)
            blob.download_to_filename(local_path)
        else:
            self.s3_client.download_file(self.bucket_name, s3_key, local_path)

    def delete_object(self, s3_key: str) -> None:
        """Delete an object from the bucket."""
        if self.is_gcs:
            bucket = self.gcs_client.bucket(self.bucket_name)
            blob = bucket.blob(s3_key)
            blob.delete()
        else:
            self.s3_client.delete_object(Bucket=self.bucket_name, Key=s3_key)
