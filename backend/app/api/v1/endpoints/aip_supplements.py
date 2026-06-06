import anyio
import structlog
from fastapi import APIRouter, HTTPException

from app.core.storage_client import UnifiedStorageClient
from app.schemas.aip_supplements import AipSupplement

logger = structlog.get_logger()
router = APIRouter(prefix="/aip-supplements", tags=["AIP Supplements"])

FILE_KEY = "aip_supplements.json"

storage_client = UnifiedStorageClient()


@router.get("/", response_model=list[AipSupplement])
async def get_aip_supplements():
    """
    Fetch the latest AIP Supplements from the storage provider using UnifiedStorageClient.
    """
    try:

        def _read() -> list | dict | None:
            return storage_client.read_json(FILE_KEY)

        parsed_data = await anyio.to_thread.run_sync(_read)

        if parsed_data is None:
            logger.warning("aip_supplements_not_found", key=FILE_KEY)
            return []

        if not isinstance(parsed_data, list):
            logger.error("aip_supplements_invalid_format", data_type=type(parsed_data).__name__)
            raise HTTPException(status_code=500, detail="Invalid data format in storage.")

        # Validate through Pydantic
        supplements = [AipSupplement(**item) for item in parsed_data]
        return supplements

    except HTTPException:
        raise
    except Exception as e:
        logger.error("aip_supplements_unknown_error", error=str(e))
        raise HTTPException(status_code=500, detail="An unexpected error occurred.") from e
