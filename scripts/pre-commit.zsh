#!/usr/bin/env zsh
# .git/hooks/pre-commit
# Enforces tests, linting, and CodeRabbit AI reviews before allowing a commit

set -e

echo "======================================"
echo "    eAIP System Reliability Check"
echo "======================================"

# 1. Static Analysis (Fastest)
echo "[1/3] Phase 1: Static Analysis..."

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
echo "[2/3] Phase 2: Automated Testing..."

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

# 3. CodeRabbit AI Review (Slowest)
echo "[3/3] Phase 3: CodeRabbit AI SAST..."
echo "➜ Starting Autonomous Review (Live Progress)..."

# Use 'tee /dev/tty' to show live output while capturing for parsing
CODERABBIT_OUT=$(coderabbit review --agent -t uncommitted 2>&1 | tee /dev/tty)
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
    if echo "$CODERABBIT_OUT" | grep -q "rate_limit"; then
        echo "⚠️ CodeRabbit Rate Limit Exceeded. Skipping AI review for this commit."
        exit 0
    else
        echo "❌ CodeRabbit CLI failure:"
        echo "$CODERABBIT_OUT"
        exit 1
    fi
fi

FINDINGS=$(echo "$CODERABBIT_OUT" | grep -o '"findings":[0-9]*' | tail -n1 | grep -o '[0-9]*')

if [[ -z "$FINDINGS" ]]; then
    echo "⚠️ CodeRabbit Output Parse Failed. Proceeding locally, please verify."
    exit 0
fi

if (( FINDINGS > 0 )); then
    echo "❌ CodeRabbit found $FINDINGS unresolved issues!"
    echo "--------------------------------------"
    echo "$CODERABBIT_OUT"
    echo "--------------------------------------"
    exit 1
else
    echo "✅ CodeRabbit Validation Passed!"
fi

echo "======================================"
echo "           Commit Approved"
echo "======================================"
exit 0
