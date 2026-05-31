from pathlib import Path

from app.core.config import settings
from app.core.storage import get_storage_path


def test_get_storage_path() -> None:
    """Test resolving a storage path."""
    expected = Path(settings.STORAGE_PATH).resolve() / "test-key"
    assert get_storage_path("test-bucket", "test-key") == expected
