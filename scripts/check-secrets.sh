#!/usr/bin/env bash
# Local guard against accidentally committing secrets we know GitHub's
# push-protection will reject.  Run via:
#   bash scripts/check-secrets.sh           # check the working tree
#   bash scripts/check-secrets.sh --staged  # check only files staged for commit
#
# Patterns kept narrow so we don't false-positive on docs/changelogs that
# already contain redacted/historical references.
set -euo pipefail

mode="${1:---worktree}"

# Patterns that GH push-protection flags
PATTERNS=(
  'AC[a-f0-9]{32}'             # Twilio Account SID
  'SK[a-f0-9]{32}'             # Twilio API Key SID
  'AU[a-f0-9]{32}'             # Twilio Authy SID
  'sk_live_[a-zA-Z0-9]{20,}'   # Stripe live secret
  'rk_live_[a-zA-Z0-9]{20,}'   # Stripe live restricted
  'AIza[0-9A-Za-z_-]{35}'      # Google API key
  'gh[pousr]_[A-Za-z0-9]{36,}' # GitHub PAT
)

# Files we know are historical and not part of the new diff
SKIP_PATHS=(
  ':!**/CHANGELOG*'
  ':!**/test_credentials*'
  ':!memory/admin_reply_logs.json'
  ':!railway_logs_all.json'
  ':!railway_logs_older.json'
  ':!rail_env_scoreboard44_full.txt'
  ':!docs/archive/**'
  ':!tests/legacy/**'
)

case "$mode" in
  --staged)
    files=$(git diff --cached --name-only --diff-filter=ACMR | tr '\n' ' ')
    ;;
  --worktree)
    files=$(git ls-files --modified --others --exclude-standard | tr '\n' ' ')
    if [ -z "$files" ]; then files=$(git ls-files | tr '\n' ' '); fi
    ;;
  *)
    echo "Usage: $0 [--staged | --worktree]"
    exit 64
    ;;
esac

if [ -z "$files" ]; then
  echo "[check-secrets] nothing to scan"
  exit 0
fi

found=0
for pat in "${PATTERNS[@]}"; do
  # shellcheck disable=SC2086
  if matches=$(echo $files | tr ' ' '\n' | grep -v '^$' | xargs -r grep -nE "$pat" 2>/dev/null | grep -vE 'CHANGELOG|test_credentials|memory/admin_reply_logs|railway_logs_(all|older)\.json|rail_env_scoreboard44_full\.txt|docs/archive/|tests/legacy/' | head -5); then
    if [ -n "$matches" ]; then
      echo "❌ Possible secret matching /$pat/ found:"
      echo "$matches"
      echo
      found=1
    fi
  fi
done

if [ "$found" = "1" ]; then
  echo "Resolve the matches above (redact / move to .env / add to skip list) before committing."
  exit 1
fi

echo "[check-secrets] ✅ clean"
exit 0
