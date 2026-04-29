#!/usr/bin/env zsh

# Setup the hook in the local .git directory
SCRIPT_DIR="${0:A:h}"
PROJECT_ROOT="${SCRIPT_DIR:h}"

# Find the actual git directory (handles worktrees)
GIT_DIR=$(git -C "$PROJECT_ROOT" rev-parse --git-common-dir)
if [ ! -d "$GIT_DIR/hooks" ]; then
    mkdir -p "$GIT_DIR/hooks"
fi

HOOK_TARGET="$GIT_DIR/hooks/pre-commit"
PRE_COMMIT_SCRIPT="$SCRIPT_DIR/pre-commit.zsh"

echo "Installing eAIP Pre-Commit hook..."
if [ ! -f "$PRE_COMMIT_SCRIPT" ]; then
    echo "❌ Error: Cannot find pre-commit.zsh at $PRE_COMMIT_SCRIPT"
    exit 1
fi

cp "$PRE_COMMIT_SCRIPT" "$HOOK_TARGET"
chmod +x "$HOOK_TARGET"

echo "✅ Pre-Commit hook successfully bound to $HOOK_TARGET"

# Setup the merge hook
MERGE_HOOK_TARGET="$GIT_DIR/hooks/pre-merge-commit"
PRE_MERGE_SCRIPT="$SCRIPT_DIR/pre-merge-commit.zsh"

echo "Installing eAIP Pre-Merge-Commit hook..."
if [ ! -f "$PRE_MERGE_SCRIPT" ]; then
    echo "❌ Error: Cannot find pre-merge-commit.zsh at $PRE_MERGE_SCRIPT"
    exit 1
fi

cp "$PRE_MERGE_SCRIPT" "$MERGE_HOOK_TARGET"
chmod +x "$MERGE_HOOK_TARGET"

echo "✅ Pre-Merge-Commit hook successfully bound to $MERGE_HOOK_TARGET"
