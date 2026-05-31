from pathlib import Path

from app.core.config import settings


def get_storage_path(bucket_like_prefix: str, key: str) -> Path:
    """
    Resolves a storage path using the configured STORAGE_PATH (which can be a local
    folder in dev, or a GCS FUSE mount like /mnt/gcs in production).
    """
    base_path = Path(settings.STORAGE_PATH).resolve()
    # In S3, bucket and key are distinct. For a local file system, we combine them.
    # We ignore the 'bucket' part in our FUSE setup, as the FUSE mount IS the bucket.
    # Alternatively, if we mount multiple buckets, it would be /mnt/gcs/bucket_name.
    # Here we assume STORAGE_PATH points directly inside the bucket or local data folder.
    full_path = base_path / key
    return full_path
