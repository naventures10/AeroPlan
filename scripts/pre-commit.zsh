#!/usr/bin/env zsh
# .git/hooks/pre-commit
# Enforces tests and linting before allowing a commit

# Support Homebrew and local binary paths for non-standard shells
export PATH="/opt/homebrew/bin:/usr/local/bin:/Users/naveendevapalan/.local/bin:$PATH"

FAILED_STEPS=()
TEMP_LOG=$(mktemp)

echo "======================================"
echo "    eAIP System Reliability Check"
echo "======================================"

# ── Function to run checks ───────────────────────────────────────────
run_check() {
    local step_name=$1
    local command=$2
    local dir=$3

    echo "➜ Running $step_name..."
    
    # Run in subshell to handle directory change safely
    (
        if [[ -n "$dir" ]]; then cd "$dir" || exit 1; fi
        eval "$command" > "$TEMP_LOG" 2>&1
    )
    local exit_code=$?
    
    if [ $exit_code -ne 0 ]; then
        echo "❌ $step_name failed:"
        echo "------------------------------------------------------------"
        cat "$TEMP_LOG"
        echo "------------------------------------------------------------"
        FAILED_STEPS+=("$step_name")
    else
        echo "✅ $step_name passed"
    fi
}

# 1. Static Analysis
echo "\n[1/3] Phase 1: Static Analysis..."
run_check "Frontend Lint" "npm run lint" "frontend"
run_check "Frontend Format" "npm run format:check" "frontend"
run_check "Frontend Type Check" "npm run type-check" "frontend"
run_check "Frontend Fallow" "npx fallow" "frontend"
run_check "Backend Ruff" "uv run ruff check ." "backend"
run_check "Backend Format" "uv run ruff format --check ." "backend"
run_check "Backend Vulture" "uv run vulture ." "backend"
run_check "Backend Deptry" "uv run deptry ." "backend"
run_check "Backend pyrefly" "uv run pyrefly check" "backend"
run_check "Scraper Ruff" "uv run ruff check ." "eaip_scrapper"
run_check "Scraper Format" "uv run ruff format --check ." "eaip_scrapper"
run_check "Scraper pyrefly" "uv run pyrefly check" "eaip_scrapper"

# 2. Automated Testing
echo "\n[2/3] Phase 2: Automated Testing..."
run_check "Frontend Tests" "npm test" "frontend"
run_check "Backend Tests" "uv run python -m pytest" "backend"
run_check "Scraper Tests" "uv run python -m pytest" "eaip_scrapper"

# 3. Build Verification
echo "\n[3/3] Phase 3: Build Verification..."
run_check "Frontend Build" "npm run build" "frontend"

# ── Final Report ─────────────────────────────────────────────────────
echo "\n======================================"

if [ ${#FAILED_STEPS[@]} -eq 0 ]; then
    echo "    ✅ All Checks Passed!"
    echo "       Commit Approved"
    echo "======================================"
    rm -f "$TEMP_LOG"
    exit 0
else
    echo "    ❌ Reliability Check Failed"
    echo "    Please fix issues in:"
    for item in "${FAILED_STEPS[@]}"; do
        echo "     - $item"
    done
    echo "======================================"
    rm -f "$TEMP_LOG"
    exit 1
fi
