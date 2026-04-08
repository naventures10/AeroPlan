#!/usr/bin/env zsh

# Setup the hook in the local .git directory
SCRIPT_DIR="${0:h}"
HOOK_TARGET="$SCRIPT_DIR/../.git/hooks/pre-commit"
PRE_COMMIT_SCRIPT="$SCRIPT_DIR/pre-commit.zsh"

echo "Installing eAIP Pre-Commit hook..."
if [ ! -f "$PRE_COMMIT_SCRIPT" ]; then
    echo "❌ Error: Cannot find pre-commit.zsh at $PRE_COMMIT_SCRIPT"
    exit 1
fi

cp "$PRE_COMMIT_SCRIPT" "$HOOK_TARGET"
chmod +x "$HOOK_TARGET"

echo "✅ Pre-Commit hook successfully bound to .git/hooks/pre-commit"
