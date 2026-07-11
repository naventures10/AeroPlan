FROM python:3.13-slim

# Install uv
COPY --from=ghcr.io/astral-sh/uv:0.5.21 /uv /uvx /usr/local/bin/

WORKDIR /app

# Copy dependency manifests first for layer caching
COPY pyproject.toml uv.lock ./

# Install production dependencies only (no dev group)
RUN uv sync --frozen --no-dev

# Copy application source
COPY app/ ./app/
COPY jobs/ ./jobs/

# Create logs directory
RUN mkdir -p /app/logs

EXPOSE 8000

CMD ["sh", "-c", "uv run python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
