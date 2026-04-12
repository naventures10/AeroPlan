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


echo "➜ Starting CodeRabbit Autonomous Review (Live Progress)..."

# Run CodeRabbit review and capture output
CODERABBIT_OUT=$(coderabbit review --agent --base main 2>&1)
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
