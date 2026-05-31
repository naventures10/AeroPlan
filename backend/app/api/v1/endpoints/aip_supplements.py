import json
import os

import structlog
from fastapi import APIRouter, HTTPException

from app.core.storage import get_storage_path
from app.schemas.aip_supplements import AipSupplement

logger = structlog.get_logger()
router = APIRouter(prefix="/aip-supplements", tags=["AIP Supplements"])

MINIO_BUCKET = os.getenv("MINIO_BUCKET", "ais")
FILE_KEY = "output/aip_supplements.json"


@router.get("/", response_model=list[AipSupplement])
async def get_aip_supplements():
    """
    Fetch the latest AIP Supplements extracted from MinIO.
    """
    filepath = get_storage_path(MINIO_BUCKET, FILE_KEY)

    try:
        if not filepath.exists():
            logger.warning("aip_supplements_not_found", path=str(filepath))
            return []

        with open(filepath, encoding="utf-8") as f:
            parsed_data = json.load(f)

        if not isinstance(parsed_data, list):
            logger.error("aip_supplements_invalid_format", data_type=type(parsed_data).__name__)
            raise HTTPException(status_code=500, detail="Invalid data format in storage.")

        # Validate through Pydantic
        supplements = [AipSupplement(**item) for item in parsed_data]
        return supplements

    except json.JSONDecodeError as e:
        logger.error("aip_supplements_json_decode_error", error=str(e))
        raise HTTPException(status_code=500, detail="Invalid data format in storage.") from e
    except Exception as e:
        logger.error("aip_supplements_unknown_error", error=str(e))
        raise HTTPException(status_code=500, detail="An unexpected error occurred.") from e
