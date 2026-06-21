#!/usr/bin/env bash
# One-time setup: installs the pre-commit secret-scanner hook into .git/hooks/.
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
chmod +x "$ROOT/scripts/check-secrets.sh" "$ROOT/scripts/git-hooks/pre-commit"
cp "$ROOT/scripts/git-hooks/pre-commit" "$ROOT/.git/hooks/pre-commit"
echo "✅ pre-commit hook installed → $ROOT/.git/hooks/pre-commit"
echo "   Test it: touch /tmp/x && echo 'AC$(openssl rand -hex 16)' >> README.md && git add README.md && git commit -m test"
