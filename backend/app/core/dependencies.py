from fastapi import HTTPException

from app.core.config import settings


def check_feature_lock(setting_name: str):
    """
    Returns a FastAPI dependency that checks if the specified feature lock is enabled.
    If the flag is True, raises an HTTP 403 Forbidden exception.
    """

    async def dependency() -> None:
        if getattr(settings, setting_name, False):
            raise HTTPException(status_code=403, detail="Feature is locked")

    return dependency
