.PHONY: frontend backend dev test test-frontend test-backend help

help: ## Show available commands
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

dev: ## Start both frontend and backend simultaneously
	$(MAKE) -j2 frontend backend

frontend: ## Start the Vite dev server (React + TypeScript)
	cd frontend && npm run dev

backend: ## Start the FastAPI server (uvicorn with hot-reload)
	cd backend && uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

test: ## Run all tests (frontend and backend)
	$(MAKE) test-backend
	$(MAKE) test-frontend

test-frontend: ## Run frontend unit tests (Vitest)
	cd frontend && npm test

test-backend: ## Run backend integration tests (Pytest)
	cd backend && uv run pytest
