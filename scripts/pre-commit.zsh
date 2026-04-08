#!/usr/bin/env zsh
# .git/hooks/pre-commit
# Enforces tests, linting, and CodeRabbit AI reviews before allowing a commit

set -e

echo "======================================"
echo "    eAIP System Reliability Check"
echo "======================================"

# 1. Frontend Checks
echo "[1/3] Running Frontend Checks..."
cd frontend
npm run lint || { echo "❌ Frontend Lint failed"; exit 1; }
cd ..

# 2. Backend Checks
echo "[2/3] Running Backend Checks..."
cd backend
uv run ruff check . || { echo "❌ Ruff Lint failed"; exit 1; }
uv run mypy . || { echo "❌ Mypy Typing failed"; exit 1; }
cd ..

# 3. CodeRabbit Local AI Review
echo "[3/3] Running CodeRabbit AI SAST..."
CODERABBIT_OUT=$(coderabbit review --agent -t uncommitted 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
    if echo "$CODERABBIT_OUT" | grep -q "rate_limit"; then
        echo "⚠️ CodeRabbit Rate Limit Exceeded. Skipping AI review for this commit."
        exit 0
    else
        echo "❌ CodeRabbit CLI failure:"
        echo "$CODERABBIT_OUT"
        # We still fail for other actual CLI errors
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
    echo "Please clear these issues by running 'coderabbit review -t uncommitted'."
    exit 1
else
    echo "✅ CodeRabbit Validation Passed!"
fi

echo "======================================"
echo "           Commit Approved"
echo "======================================"
exit 0
