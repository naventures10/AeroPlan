import json
import os

import structlog
from botocore.exceptions import ClientError
from fastapi import APIRouter, HTTPException

from app.core.storage import get_storage_client
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
    s3_client = get_storage_client()
    try:
        response = s3_client.get_object(Bucket=MINIO_BUCKET, Key=FILE_KEY)
        data = response["Body"].read().decode("utf-8")
        parsed_data = json.loads(data)

        if not isinstance(parsed_data, list):
            logger.error("aip_supplements_invalid_format", data_type=type(parsed_data).__name__)
            raise HTTPException(status_code=500, detail="Invalid data format in storage.")

        # Validate through Pydantic
        supplements = [AipSupplement(**item) for item in parsed_data]
        return supplements

    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code")
        if error_code == "NoSuchKey":
            logger.warning("aip_supplements_not_found", bucket=MINIO_BUCKET, key=FILE_KEY)
            return []
        logger.error("minio_client_error", error=str(e), bucket=MINIO_BUCKET, key=FILE_KEY)
        raise HTTPException(status_code=500, detail="Failed to retrieve data from storage.") from e
    except json.JSONDecodeError as e:
        logger.error("aip_supplements_json_decode_error", error=str(e))
        raise HTTPException(status_code=500, detail="Invalid data format in storage.") from e
    except Exception as e:
        logger.error("aip_supplements_unknown_error", error=str(e))
        raise HTTPException(status_code=500, detail="An unexpected error occurred.") from e
