"""
OpenTelemetry tracing setup for Aero Plan.

Instruments:
  - FastAPI (HTTP spans for every request)
  - SQLAlchemy (DB query spans with statement text)
  - httpx (outbound HTTP spans for weather scraping, etc.)

Traces are exported to:
  - Console (in dev, when OTEL_EXPORTER=console)
  - OTLP/HTTP endpoint (when OTEL_EXPORTER_OTLP_ENDPOINT is set)

To disable entirely, set OTEL_ENABLED=false.
"""

import os

from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import (
    BatchSpanProcessor,
    ConsoleSpanExporter,
    SimpleSpanProcessor,
)


def setup_tracing() -> None:
    """
    Initialise the OpenTelemetry tracer provider and auto-instrumentation.

    Must be called BEFORE the FastAPI app is created (or at least before
    the first request).  Typically called from main.py.
    """
    if os.getenv("OTEL_ENABLED", "true").lower() not in ("1", "true"):
        return

    resource = Resource.create({
        "service.name": os.getenv("OTEL_SERVICE_NAME", "aero-plan-api"),
        "service.version": "0.1.0",
        "deployment.environment": os.getenv("ENVIRONMENT", "development"),
    })

    provider = TracerProvider(resource=resource)

    # ── Exporter selection ───────────────────────────────────────────
    otlp_endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
    exporter_mode = os.getenv("OTEL_EXPORTER", "console").lower()

    if otlp_endpoint:
        # Production: send spans to a collector (Jaeger, Grafana Tempo, etc.)
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import (
            OTLPSpanExporter,
        )
        exporter = OTLPSpanExporter(endpoint=f"{otlp_endpoint}/v1/traces")
        provider.add_span_processor(BatchSpanProcessor(exporter))
    elif exporter_mode == "console":
        # Dev: print spans to stdout
        provider.add_span_processor(SimpleSpanProcessor(ConsoleSpanExporter()))

    trace.set_tracer_provider(provider)

    # ── Auto-instrumentation ─────────────────────────────────────────
    # These patch the libraries *globally*, so any FastAPI app, any
    # SQLAlchemy engine, and any httpx client will emit spans.

    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
    from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
    from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor

    FastAPIInstrumentor().instrument()
    SQLAlchemyInstrumentor().instrument(enable_commenter=True)
    HTTPXClientInstrumentor().instrument()
