.PHONY: frontend backend dev prod frontend-prod backend-prod test test-frontend test-backend \
       help

help: ## Show available commands
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

dev: ## Start both frontend and backend simultaneously
	$(MAKE) -j2 frontend backend

frontend: ## Start the Vite dev server (React + TypeScript)
	cd frontend && npm run dev

backend: ## Start the FastAPI server (uvicorn with hot-reload)
	cd backend && uv run python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 2>&1 | tee logs/backend.log

prod: ## Start both frontend preview and backend simultaneously
	$(MAKE) -j2 frontend-prod backend-prod

frontend-prod: ## Build and start the Vite preview server (React + TypeScript)
	cd frontend && npm run build && npm run preview

backend-prod: ## Start the FastAPI server in production mode (no hot-reload)
	cd backend && uv run python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 2>&1 | tee logs/backend.log


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



# ── ETL & Data Pipelines ───────────────────────────────────────────────────

etl-airspaces: ## Run the Airspace ETL (Geometry Extraction) via QGIS Python
	/Applications/QGIS.app/Contents/MacOS/python eaip_scrapper/src/ETL/etl_airspaces.py

etl-metadata: ## Run the Airspace Metadata enrichment ETL
	cd eaip_scrapper && uv run src/ETL/etl_airspace_metadata.py

etl-all: etl-airspaces etl-metadata ## Run full Airspace ETL pipeline (Geom + Metadata)
