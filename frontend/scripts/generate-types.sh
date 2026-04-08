#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# generate-types.sh — Build-time script to extract the OpenAPI spec from
# the FastAPI app and generate TypeScript types.
#
# Usage:  ./scripts/generate-types.sh
# Prerequisite: Backend dependencies installed (uv sync in ../backend)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$(dirname "$FRONTEND_DIR")/backend"
OUTPUT_FILE="$FRONTEND_DIR/src/types/api.generated.ts"
SPEC_FILE="$FRONTEND_DIR/openapi.json"

echo "📋 Step 1: Extracting OpenAPI spec from FastAPI..."

# We generate the spec via a tiny Python script that imports the app.
# Dummy env vars satisfy pydantic-settings validation without needing
# real credentials — we never actually connect to the database.
cd "$BACKEND_DIR"
POSTGRES_PASSWORD=dummy \
MINIO_ACCESS_KEY=dummy \
MINIO_SECRET_KEY=dummy \
uv run python -c "
from app.main import app
import json, pathlib
spec = app.openapi()
pathlib.Path('$SPEC_FILE').write_text(json.dumps(spec, indent=2))
print(f'  ✅ Wrote {len(spec[\"paths\"])} paths to $SPEC_FILE')
"

echo "📋 Step 2: Generating TypeScript types..."
cd "$FRONTEND_DIR"
npx --yes openapi-typescript "$SPEC_FILE" -o "$OUTPUT_FILE"

echo "📋 Step 3: Cleaning up spec file..."
rm -f "$SPEC_FILE"

echo "✅ Types generated at: $OUTPUT_FILE"
