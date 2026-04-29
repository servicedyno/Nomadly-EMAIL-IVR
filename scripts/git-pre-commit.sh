#!/bin/bash
# Optional pre-commit hook — runs lint:await + lint:lang locally before commit.
# Install: ln -s ../../scripts/git-pre-commit.sh .git/hooks/pre-commit
# Or:      cp scripts/git-pre-commit.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit

set -e

# Skip if no JS files in the staged changes (fast path)
if git diff --cached --name-only | grep -qE '\.js$'; then
  echo "[pre-commit] Running lint:await…"
  node scripts/lint_async_in_if.js
fi

# Skip if no lang files staged
if git diff --cached --name-only | grep -qE '^js/lang/.*\.js$'; then
  echo "[pre-commit] Running lint:lang…"
  node scripts/check_lang_parity.js
fi

echo "[pre-commit] OK"
