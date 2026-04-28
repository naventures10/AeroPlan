.PHONY: frontend backend dev test test-frontend test-backend \
       debug profile-start profile-stop profile-bundle profile-db profile-queries profile-jaeger \
       profile-tiles restart-martin refresh-mv help

help: ## Show available commands
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

dev: ## Start both frontend and backend simultaneously
	$(MAKE) -j2 frontend backend

frontend: ## Start the Vite dev server (React + TypeScript)
	cd frontend && npm run dev

backend: ## Start the FastAPI server (uvicorn with hot-reload)
	cd backend && uv run python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000


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

# ── Profiling & Debugging ────────────────────────────────────────────────────

debug: ## Start backend in DEBUG mode (yappi + OTel console tracing)
	cd backend && DEBUG=true OTEL_EXPORTER=console uv run python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

profile-start: ## Start backend profiling session (requires `make debug` running)
	curl -X POST http://localhost:8000/api/debug/profiling/start

profile-stop: ## Stop backend profiling session and print hotspot summary
	curl -X POST http://localhost:8000/api/debug/profiling/stop

profile-bundle: ## Analyze frontend bundle size (opens stats.html)
	cd frontend && ANALYZE=true npx vite build && open stats.html

profile-queries: ## Run EXPLAIN ANALYZE on the 3 hottest queries
	@echo "\n\033[36m━━━ Global Search Query ━━━\033[0m"
	@docker exec eaip-postgres psql -U postgres -d aeronautical_information_system -c \
		"EXPLAIN (ANALYZE, BUFFERS) \
		WITH route_seg_agg AS ( \
			SELECT route_id, SUM(distance_nm) AS distance_nm FROM ats_route_segments GROUP BY route_id \
		), search_results AS ( \
			SELECT ad.icao_code AS id, 'AERODROME' AS type FROM aerodrome_documents ad \
			JOIN spatial_features sf ON sf.icao_code = ad.icao_code AND sf.feature_category = 'ARP' \
			WHERE ad.icao_code ~* 'VABB' \
		) SELECT * FROM search_results LIMIT 5;"
	@echo "\n\033[36m━━━ ATS Route Labels (Materialized View) ━━━\033[0m"
	@docker exec eaip-postgres psql -U postgres -d aeronautical_information_system -c \
		"EXPLAIN (ANALYZE, BUFFERS) SELECT count(*) FROM mv_ats_route_labels;"
	@echo "\n\033[36m━━━ Aerodromes ━━━\033[0m"
	@docker exec eaip-postgres psql -U postgres -d aeronautical_information_system -c \
		"EXPLAIN (ANALYZE, BUFFERS) SELECT count(*) FROM spatial_features sf \
		JOIN aerodrome_documents ad ON sf.icao_code = ad.icao_code WHERE sf.feature_category = 'ARP';"

profile-db: ## Show top-10 slowest queries (pg_stat_statements)
	@docker exec eaip-postgres psql -U postgres -d aeronautical_information_system -c \
		"SELECT LEFT(query, 80) AS query, calls, \
		round(total_exec_time::numeric, 1) AS total_ms, \
		round(mean_exec_time::numeric, 1) AS avg_ms \
		FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 10;"

profile-jaeger: ## Start Jaeger + backend with OTLP tracing (UI at :16686)
	@docker start jaeger 2>/dev/null || docker run -d --name jaeger -p 16686:16686 -p 4318:4318 jaegertracing/jaeger:latest
	@echo "\033[36mJaeger UI:\033[0m http://localhost:16686"
	cd backend && OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 uv run python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

refresh-mv: ## Refresh the ATS route labels materialized view
	@docker exec eaip-postgres psql -U postgres -d aeronautical_information_system -c \
		"REFRESH MATERIALIZED VIEW mv_ats_route_labels;" && echo "\033[32m✓ Materialized view refreshed\033[0m"

restart-martin: ## Pulls latest Martin and restarts with metrics enabled
	@docker pull ghcr.io/maplibre/martin:latest
	@docker stop martin || true && docker rm martin || true
	@docker run -d --name martin \
		-p 3000:3000 -p 9091:9091 \
		-v $(PWD)/backend/martin.yaml:/config/martin.yaml \
		-v $(PWD)/backend/data:/data \
		ghcr.io/maplibre/martin:latest --config /config/martin.yaml

profile-tiles: ## Start Prometheus to monitor Martin (UI at :9090)
	@echo "\n\033[36m━━━ Starting Prometheus ━━━\033[0m"
	@docker stop prometheus || true
	@docker rm prometheus || true
	@docker run -d --name prometheus \
		-p 9090:9090 \
		-v $(PWD)/backend/prometheus.yml:/etc/prometheus/prometheus.yml \
		prom/prometheus:latest
	@echo "\033[36mPrometheus UI:\033[0m http://localhost:9090"

# ── ETL & Data Pipelines ───────────────────────────────────────────────────

etl-airspaces: ## Run the Airspace ETL (Geometry Extraction) via QGIS Python
	/Applications/QGIS.app/Contents/MacOS/python eaip_scrapper/src/ETL/etl_airspaces.py

etl-metadata: ## Run the Airspace Metadata enrichment ETL
	cd eaip_scrapper && uv run src/ETL/etl_airspace_metadata.py

etl-all: etl-airspaces etl-metadata ## Run full Airspace ETL pipeline (Geom + Metadata)
