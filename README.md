# AeroInfo - Aeronautical Information System

A comprehensive platform for Indian airspace visualization, NOTAM processing, and AI-powered flight planning.

## Packages

| Package | Description | Tech |
|---------|-------------|------|
| [`frontend/`](./frontend/) | Interactive map & dashboard UI | React, Vite, TypeScript, Tailwind, deck.gl, MapLibre |
| [`backend/`](./backend/) | REST API server | FastAPI, SQLAlchemy, asyncpg, UV |
| [`eaip_scrapper/`](./eaip_scrapper/) | NOTAM scraper & ETL pipeline | Python, Docling, LLaMA/MLX, UV |

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) ≥ 20
- [UV](https://docs.astral.sh/uv/) (Python package manager)
- PostgreSQL running (via Docker)

### Run

```bash
# Frontend dev server
make frontend

# Backend API server
make backend
```

Or run individually:

```bash
# Frontend
cd frontend && npm install && npm run dev

# Backend
cd backend && uv sync && uv run uvicorn app.main:app --reload

# Scrapper (on demand)
cd eaip_scrapper && uv sync && uv run python run_scrapper.py
```

### Environment Variables

Copy `.env.example` to `.env` inside each package directory:

```bash
cp backend/.env.example backend/.env
cp eaip_scrapper/.env.example eaip_scrapper/.env
```

## Architecture

```
eAIP/
├── frontend/         # React SPA (Vite)
├── backend/          # FastAPI server + DB models
└── eaip_scrapper/    # Scraper + ETL + LLM parsers
```

Each Python package (`backend`, `eaip_scrapper`) is an independent UV workspace with its own `.venv` — they are intentionally kept separate due to incompatible dependencies (ML libs vs lightweight API server).
