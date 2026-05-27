import json
import os

import boto3


class MinioStorage:
    """Helper class to abstract MinIO storage operations for scrapers."""

    def __init__(self, bucket_name="ais"):
        self.s3 = boto3.client(
            "s3",
            endpoint_url=os.getenv("MINIO_ENDPOINT", "http://localhost:9000"),
            aws_access_key_id=os.getenv("MINIO_ACCESS_KEY"),
            aws_secret_access_key=os.getenv("MINIO_SECRET_KEY"),
            region_name=os.getenv("MINIO_REGION", "us-east-1"),
        )
        self.bucket_name = bucket_name

    def save_json(self, object_key: str, data: dict | list) -> None:
        """
        Serializes data to a JSON string and uploads directly to MinIO.
        """
        print(f"[*] Uploading '{object_key}' to MinIO bucket '{self.bucket_name}'...")
        json_str = json.dumps(data, indent=2, ensure_ascii=False)
        self.s3.put_object(
            Bucket=self.bucket_name,
            Key=object_key,
            Body=json_str.encode("utf-8"),
            ContentType="application/json",
        )
        print(f"[+] Successfully uploaded '{object_key}' to MinIO.")
