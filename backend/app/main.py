import os
import time
import traceback

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.database import AsyncSessionLocal
from app.logging_config import setup_logging
from app.routers import (
    aerodromes,
    ats_routes,
    charts,
    daylight,
    navaids,
    notams,
    search,
    spatial,
    weather,
)
from app.schemas.geojson import HealthResponse

# ── Initialise structured logging ────────────────────────────────────────────
setup_logging(json_format=os.getenv("LOG_FORMAT", "").lower() == "json")
logger = structlog.get_logger()

# ── Application ──────────────────────────────────────────────────────────────
app = FastAPI(title="Aero Plan API", version="0.1.0")

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Logging Middleware ───────────────────────────────────────────────────────
@app.middleware("http")
async def logging_middleware(request: Request, call_next):  # type: ignore[no-untyped-def]
    """Log every HTTP request with method, path, status, and duration."""
    start = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        logger.error(
            "request_failed",
            method=request.method,
            path=request.url.path,
            duration_ms=duration_ms,
            exc_info=True,
        )
        raise
    duration_ms = round((time.perf_counter() - start) * 1000, 2)
    logger.info(
        "request_completed",
        method=request.method,
        path=request.url.path,
        status=response.status_code,
        duration_ms=duration_ms,
    )
    return response


# ── Global Exception Handler ────────────────────────────────────────────────
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all for unhandled exceptions. Logs full traceback."""
    logger.error(
        "unhandled_exception",
        method=request.method,
        path=request.url.path,
        error_type=type(exc).__name__,
        error_message=str(exc),
        traceback=traceback.format_exc(),
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


# ── Health Check ─────────────────────────────────────────────────────────────
@app.get("/api/health", response_model=HealthResponse)
async def health_check() -> dict:
    """
    Returns service status and database connectivity.
    """
    db_status = "unknown"
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as exc:
        db_status = "error"
        logger.warning("health_check_db_failed", error=str(exc))

    return {"status": "online", "database": db_status}


# ── Register Routers ─────────────────────────────────────────────────────────
app.include_router(aerodromes.router)
app.include_router(search.router)
app.include_router(charts.router)
app.include_router(spatial.router)
app.include_router(weather.router)
app.include_router(notams.router)
app.include_router(daylight.router)
app.include_router(ats_routes.router)
app.include_router(navaids.router)
