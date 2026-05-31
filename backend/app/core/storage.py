from pathlib import Path

from app.core.config import settings


def get_storage_path(bucket_like_prefix: str, key: str) -> Path:
    """
    Resolves a storage path using the configured STORAGE_PATH (which can be a local
    folder in dev, or a GCS FUSE mount like /mnt/gcs in production).
    """
    base_path = Path(settings.STORAGE_PATH).resolve()

    # Strip any leading slashes or dots to prevent directory traversal
    clean_key = key.lstrip("/")

    # Resolve the combined path
    full_path = (base_path / clean_key).resolve()

    # Verify the path is within the base_path
    try:
        full_path.relative_to(base_path)
    except ValueError as e:
        raise ValueError(f"Directory traversal attempt detected: {key}") from e

    return full_path
