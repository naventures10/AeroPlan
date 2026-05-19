#!/usr/bin/env zsh
# .git/hooks/pre-merge-commit
# Enforces CodeRabbit AI review before allowing a merge commit

# Support Homebrew and local binary paths for non-standard shells
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:$PATH"

echo "======================================"
echo "    eAIP AI Merge Review Check"
echo "======================================"

# GUARD: Only run expensive AI review if merging into main
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$CURRENT_BRANCH" != "main" ]]; then
    echo "➜ Skipping AI review (Not on main branch)."
    exit 0
fi


echo "➜ Checking if branch is up-to-date with main..."
if ! git merge-base --is-ancestor main HEAD; then
    echo "❌ BRANCH OUTDATED: Your branch is missing recent changes from 'main'."
    echo "   Please rebase first: git rebase main"
    exit 1
fi
echo "✅ Branch is current."


echo "➜ Running E2E Integration Tests (Playwright)..."
# We run from root so we need to enter frontend
(cd frontend && npm run test:e2e -- --reporter=list)
EXIT_CODE_E2E=$?

if [ $EXIT_CODE_E2E -ne 0 ]; then
    echo "❌ E2E Tests Failed!"
    echo "   Please fix regressions before merging."
    exit 1
fi
echo "✅ E2E Tests passed."


echo "➜ Starting CodeRabbit Autonomous Review (Live Progress)..."

# Run CodeRabbit review in background to parse real-time logs and avoid blocking output
TEMP_OUT=$(mktemp)
coderabbit review --agent --base main > "$TEMP_OUT" 2>&1 &
CODERABBIT_PID=$!

spinner=( '⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏' )
idx=1

while kill -0 $CODERABBIT_PID 2>/dev/null; do
    # Try to extract the latest status message from the structured JSON stream
    current_status=$(grep -o '"status":"[^"]*"' "$TEMP_OUT" | tail -n1 | cut -d'"' -f4)
    if [[ -n "$current_status" ]]; then
        # Format snake_case to a clean Title Case string
        friendly_status=$(echo "$current_status" | tr '_' ' ' | awk '{for(i=1;i<=NF;i++)sub(/./,toupper(substr($i,1,1)),$i)}1')
        printf "\r\033[K➜ [CodeRabbit] %s  %s..." "${spinner[idx]}" "$friendly_status"
    else
        printf "\r\033[K➜ [CodeRabbit] %s  Analyzing changes..." "${spinner[idx]}"
    fi
    idx=$(( (idx % 10) + 1 ))
    sleep 0.15
done
wait $CODERABBIT_PID
EXIT_CODE=$?

CODERABBIT_OUT=$(cat "$TEMP_OUT")
rm -f "$TEMP_OUT"

# Clear the spinner line
printf "\r\033[K"

if [ $EXIT_CODE -ne 0 ]; then
    if echo "$CODERABBIT_OUT" | grep -q "rate_limit"; then
        echo "⚠️ CodeRabbit Rate Limit Exceeded. Skipping AI review for this merge."
        exit 0
    else
        echo "❌ CodeRabbit CLI failure:"
        echo "------------------------------------------------------------"
        echo "$CODERABBIT_OUT"
        echo "------------------------------------------------------------"
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
    
    # Save full output to a file to prevent truncation in CLI
    REVIEW_DIR=".code-review"
    mkdir -p "$REVIEW_DIR"
    echo "$CODERABBIT_OUT" > "$REVIEW_DIR/latest_review.txt"
    
    echo "------------------------------------------------------------"
    echo "Full review saved to: $REVIEW_DIR/latest_review.txt"
    echo "------------------------------------------------------------"
    echo "Please resolve these findings before merging."
    exit 1
else
    echo "======================================"
    echo "    ✅ AI Validation Passed!"
    echo "       Merge Approved"
    echo "======================================"
fi

exit 0
