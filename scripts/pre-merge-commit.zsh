#!/usr/bin/env zsh
# .git/hooks/pre-merge-commit
# Enforces CodeRabbit AI review before allowing a merge commit

# Support Homebrew and local binary paths for non-standard shells
export PATH="/opt/homebrew/bin:/usr/local/bin:/Users/naveendevapalan/.local/bin:$PATH"

echo "======================================"
echo "    eAIP AI Merge Review Check"
echo "======================================"

echo "➜ Starting CodeRabbit Autonomous Review (Live Progress)..."

# Use 'tee /dev/tty' to show live output while capturing for parsing
CODERABBIT_OUT=$(coderabbit review --agent --base main 2>&1 | tee /dev/tty)
EXIT_CODE=$?

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
    echo "------------------------------------------------------------"
    echo "$CODERABBIT_OUT"
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
