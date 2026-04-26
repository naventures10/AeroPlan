# 🚀 Backend Testing Manifest: Zero-Regression & 100% Coverage

This manifest provides the necessary context and instructions for an external AI agent to implement a complete testing suite for the `Aero Plan` backend.

## 📋 Project Context
- **Framework**: FastAPI (Asynchronous)
- **Database**: PostgreSQL + PostGIS (SQLAlchemy Async)
- **Tile Server**: Martin (configured via `martin.yaml.example`)
- **Key Logic**: 3D Flight path generation (RNP), Weather data scraping & processing.

---

## 🛠️ Testing Stack Requirements
- **Framework**: `pytest`
- **Async Support**: `pytest-asyncio` (Mode: `auto`)
- **HTTP Client**: `httpx` (using `ASGITransport` for endpoint tests)
- **Mocking**: `pytest-mock` or `unittest.mock`
- **Coverage**: `pytest-cov`

---

## ⚠️ Mandatory Mocking & Setup (Sandbox Preparation)
The agent must address these environment constraints immediately to avoid startup failures:

### 1. Pydantic Settings
`app/core/config.py` requires several variables without defaults. Mock these in `tests/conftest.py` or via environment variables:
- `POSTGRES_PASSWORD`
- `MINIO_ACCESS_KEY`
- `MINIO_SECRET_KEY`
- **Note**: `PROJECT_ROOT` resolves to four levels up. Mock `settings.WEATHER_OUTPUT_DIR` to a path inside the `backend` sandbox.

### 2. External Services (Zero Network Policy)
- **Database**: Use the existing `db_session` fixture. Mock `AsyncSession` for pure unit tests.
- **S3 (MinIO)**: Mock `boto3.client` in `app/core/storage.py`.
- **GDAL**: Mock `subprocess.run` calls in `app/services/weather_pipeline.py`.
- **Weather Sources**: Mock `httpx.AsyncClient.get` for Chennai/Delhi OLBS scraping in `app/api/v1/endpoints/weather.py`.

---

## 🎯 High-Priority Coverage Targets

### 1. `app/services/rnp_service.py` (Complex Geometry)
This is the highest risk area for regression.
- **D-Arc Logic**: Test `smooth_path_3d` with >163° turns (U-turns). Verify the "teardrop" semicircle generation.
- **Bezier Smoothing**: Verify quadratic fly-by logic for medium turns.
- **Interpolation**: Test 3D path generation where intermediate waypoints are missing altitude data.
- **Regex Robustness**: Test `extract_true_course` with various course string formats found in AIP data.

### 2. `app/services/weather_pipeline.py` (File/OS Logic)
- **Cleanup**: Verify `cleanup_old_files` correctly identifies and deletes only the oldest `.tif` files.
- **Atomic Manifest**: Ensure `weather_manifest.json` is updated atomically via temporary file replacement.

### 3. `app/api/v1/endpoints/charts.py` (Security)
- **Proxy Validation**: Test the `_validate_proxy_url` function with both allowed and forbidden domains to prevent SSRF regressions.

---

## 🔍 Schema Synchronization Test (Critical for Tiles)
Create a test that parses `martin.yaml.example` and cross-references it with `app/models/`.
- **Verify**: Every table, `id_column`, and property listed in Martin's config must exist in the SQLAlchemy models.
- **Regression Goal**: Ensure that renaming a DB column in Python triggers a test failure if the Tile Server config isn't also updated.

---

## 📈 Success Criteria
1. **100% Statement Coverage**: All logic in `app/` must be executed.
2. **100% Branch Coverage**: All conditional paths (especially in `rnp_service.py`) must be verified.
3. **Green Build**: All existing tests in `tests/` must pass alongside new ones.
4. **No Side Effects**: Tests must not attempt to reach the real internet or real S3/DB instances.

---

## 💡 Pro-Tip for the Agent
> Use the existing `tests/conftest.py` as your base. It already handles DB table creation/dropping for integration tests. If your sandbox lacks a real PostgreSQL, you must pivot to full mocking of the `db_session`.
