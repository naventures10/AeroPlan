.PHONY: frontend dev test test-frontend test-backend test-build frontend-audit \
       docker-up docker-down observability-up observability-down help

help: ## Show available commands
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'

# ── Docker ────────────────────────────────────────────────────────────────────

docker-up: ## Start the Docker Compose stack (backend, db, tile server, etc.)
	docker compose up -d

docker-down: ## Stop the Docker Compose stack
	docker compose down

observability-up: ## Start the observability stack (Alloy → Grafana Cloud)
	docker compose -f monitoring/docker-compose.observability.yml up -d

observability-down: ## Stop the observability stack
	docker compose -f monitoring/docker-compose.observability.yml down

# ── Frontend ──────────────────────────────────────────────────────────────────

dev: ## Start the Vite dev server (React + TypeScript)
	cd frontend && npm run dev

frontend: dev ## Alias for dev

# ── Testing ───────────────────────────────────────────────────────────────────

test: ## Run all tests (frontend and backend)
	$(MAKE) test-backend
	$(MAKE) test-frontend
	$(MAKE) test-build

test-frontend: ## Run frontend unit tests (Vitest)
	cd frontend && npm test

test-backend: ## Run backend integration tests (Pytest)
	cd backend && uv run pytest

test-build: ## Run frontend build
	cd frontend && npm run build

frontend-audit: ## Run Lighthouse audit on the frontend app and save reports to frontend/lighthouse-reports
	cd frontend && npm run audit


# ── ETL & Data Pipelines ───────────────────────────────────────────────────

etl-airspaces: ## Run the Airspace ETL (Geometry Extraction) via QGIS Python
	/Applications/QGIS.app/Contents/MacOS/python eaip_scrapper/src/ETL/etl_airspaces.py

etl-metadata: ## Run the Airspace Metadata enrichment ETL
	cd eaip_scrapper && uv run src/ETL/etl_airspace_metadata.py

etl-all: etl-airspaces etl-metadata ## Run full Airspace ETL pipeline (Geom + Metadata)
