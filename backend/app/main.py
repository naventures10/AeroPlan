import os
import time
import traceback

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from opentelemetry import metrics, trace
from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from sqlalchemy import text

from app.api.v1.api import api_router
from app.core.database import AsyncSessionLocal
from app.core.logging_config import setup_logging
from app.schemas.geojson import HealthResponse

# ── Initialise structured logging ────────────────────────────────────────────
setup_logging(json_format=os.getenv("LOG_FORMAT", "").lower() == "json")
logger = structlog.get_logger()


# ── OpenTelemetry Instrumentation ────────────────────────────────────────────
resource = Resource.create({"service.name": "eaip-backend"})

# Traces
provider = TracerProvider(resource=resource)
processor = BatchSpanProcessor(OTLPSpanExporter(endpoint="http://localhost:4318/v1/traces"))
provider.add_span_processor(processor)
trace.set_tracer_provider(provider)

# Metrics
metric_reader = PeriodicExportingMetricReader(
    OTLPMetricExporter(endpoint="http://localhost:4318/v1/metrics")
)
meter_provider = MeterProvider(resource=resource, metric_readers=[metric_reader])
metrics.set_meter_provider(meter_provider)

# ── Application ──────────────────────────────────────────────────────────────
app = FastAPI(title="Aero Plan API", version="0.1.0")

FastAPIInstrumentor.instrument_app(app)
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
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
@app.get("/api/v1/health", response_model=HealthResponse)
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
app.include_router(api_router, prefix="/api/v1")
