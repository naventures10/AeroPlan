#!/usr/bin/env zsh
# .git/hooks/pre-commit
# Enforces tests and linting before allowing a commit

set -e

# Support Homebrew and local binary paths for non-standard shells
export PATH="/opt/homebrew/bin:/usr/local/bin:/Users/naveendevapalan/.local/bin:$PATH"

echo "======================================"
echo "    eAIP System Reliability Check"
echo "======================================"

# 1. Static Analysis (Fastest)
echo "[1/2] Phase 1: Static Analysis..."

# Frontend Lint
echo "➜ Running Frontend Lint..."
cd frontend
npm run lint || { echo "❌ Frontend Lint failed"; exit 1; }
cd ..

# Backend Lint & Typing
echo "➜ Running Backend Static Analysis..."
cd backend
uv run ruff check . || { echo "❌ Ruff Lint failed"; exit 1; }
uv run mypy . || { echo "❌ Mypy Typing failed"; exit 1; }
cd ..

# 2. Automated Testing
echo "[2/2] Phase 2: Automated Testing..."

# Frontend Tests
echo "➜ Running Frontend Test Suite..."
cd frontend
npm test || { echo "❌ Frontend Tests failed"; exit 1; }
cd ..

# Backend Tests
echo "➜ Running Backend Test Suite (Requires DB)..."
cd backend
uv run pytest || { echo "❌ Backend Tests failed. Ensure Postgres container is running."; exit 1; }
cd ..

echo "======================================"
echo "    ✅ Local Validation Passed!"
echo "       Commit Approved"
echo "======================================"
exit 0
