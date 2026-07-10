import os
import time
import traceback
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request, Response
from fastapi.concurrency import iterate_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from opentelemetry import metrics, trace
from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from sqlalchemy import text

from app.api.v1.api import api_router
from app.core.database import AsyncSessionLocal, engine
from app.core.logging_config import setup_logging
from app.core.redis import close_redis, get_cached_json, init_redis, set_cached_json
from app.schemas.geojson import HealthResponse

# ── Initialise structured logging ────────────────────────────────────────────
setup_logging(json_format=os.getenv("LOG_FORMAT", "").lower() == "json")
logger = structlog.get_logger()


# ── OpenTelemetry Instrumentation ────────────────────────────────────────────
resource = Resource.create({"service.name": os.getenv("OTEL_SERVICE_NAME", "eaip-backend")})

# Traces — endpoint + auth read from OTEL_EXPORTER_OTLP_TRACES_ENDPOINT / OTEL_EXPORTER_OTLP_HEADERS env vars
provider = TracerProvider(resource=resource)
processor = BatchSpanProcessor(OTLPSpanExporter())
provider.add_span_processor(processor)
trace.set_tracer_provider(provider)

# Metrics — endpoint + auth read from OTEL_EXPORTER_OTLP_METRICS_ENDPOINT / OTEL_EXPORTER_OTLP_HEADERS env vars
metric_reader = PeriodicExportingMetricReader(OTLPMetricExporter())
meter_provider = MeterProvider(resource=resource, metric_readers=[metric_reader])
metrics.set_meter_provider(meter_provider)


# ── Lifespan Handler ─────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialise Redis connection pool
    try:
        await init_redis()
    except Exception as exc:
        logger.error("redis_init_failed", error=str(exc))
    yield
    # Shutdown: Clean up Redis connections
    await close_redis()


# ── Application ──────────────────────────────────────────────────────────────
app = FastAPI(title="Aero Plan API", version="0.1.0", lifespan=lifespan)

FastAPIInstrumentor.instrument_app(app)

# Instrument SQLAlchemy — exposes DB query spans as children inside request traces
# Uses engine.sync_engine because SQLAlchemyInstrumentor hooks into sync event system
SQLAlchemyInstrumentor().instrument(engine=engine.sync_engine)
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


# ── Caching Middleware ───────────────────────────────────────────────────────
@app.middleware("http")
async def cache_middleware(request: Request, call_next):  # type: ignore[no-untyped-def]
    """Cache all JSON GET requests in Redis, excluding health and auth endpoints."""
    # Only cache GET requests
    if request.method != "GET":
        return await call_next(request)

    path = request.url.path
    # Exclude health and auth endpoints
    if path.endswith("/health") or "/auth" in path:
        return await call_next(request)

    # Generate cache key (based on path and query parameters)
    query_string = request.url.query
    cache_key = f"api_cache:{path}"
    if query_string:
        cache_key += f"?{query_string}"

    try:
        cached_response = await get_cached_json(cache_key)
        if cached_response:
            return Response(
                content=cached_response["body"],
                status_code=cached_response["status_code"],
                media_type=cached_response.get("media_type", "application/json"),
                headers={"X-Cache": "HIT"},
            )
    except Exception as exc:
        logger.warning("cache_middleware_read_failed", key=cache_key, error=str(exc))

    response = await call_next(request)

    # Cache only successful 200 OK JSON/GeoJSON responses
    content_type = response.headers.get("content-type", "")
    if response.status_code == 200 and "application/json" in content_type:
        try:
            # Consume stream to get body content
            body_parts = []
            async for chunk in response.body_iterator:
                body_parts.append(chunk)

            # Reconstruct body_iterator
            response.body_iterator = iterate_in_threadpool(iter(body_parts))

            body_content = b"".join(body_parts).decode("utf-8")

            cache_data = {
                "body": body_content,
                "status_code": response.status_code,
                "media_type": content_type,
            }
            # Cache for 5 minutes (300 seconds)
            await set_cached_json(cache_key, cache_data, ttl_seconds=300)
            response.headers["X-Cache"] = "MISS"
        except Exception as exc:
            logger.warning("cache_middleware_write_failed", key=cache_key, error=str(exc))

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
    Returns service status, database connectivity, and redis connectivity.
    """
    db_status = "unknown"
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as exc:
        db_status = "error"
        logger.warning("health_check_db_failed", error=str(exc))

    redis_status = "unknown"
    try:
        from app.core.redis import get_redis

        client = get_redis()
        await client.ping()
        redis_status = "connected"
    except Exception as exc:
        redis_status = "error"
        logger.warning("health_check_redis_failed", error=str(exc))

    return {"status": "online", "database": db_status, "redis": redis_status}


# ── Register Routers ─────────────────────────────────────────────────────────
app.include_router(api_router, prefix="/api/v1")
