#!/bin/bash
# ============================================================
# Nomadly Node.js Server Setup Script
# ============================================================
# This script sets up the Node.js Express server that the
# FastAPI backend proxies to. Run this ONCE on fresh deployment.
#
# What it does:
#   1. Installs Node.js dependencies (yarn install)
#   2. Creates .env symlink so Node.js reads backend/.env
#   3. Updates SELF_URL / SELF_URL_PROD to current pod URL + /api
#   4. Creates supervisor config for the Node.js process
#   5. Starts the Node.js server via supervisor
#
# Usage:
#   bash /app/scripts/setup-nodejs.sh
# ============================================================

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Nomadly Node.js Server Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Step 1: Detect current pod URL ──
POD_URL=$(grep 'REACT_APP_BACKEND_URL=' /app/frontend/.env | cut -d'=' -f2 | tr -d '"' | tr -d "'")
if [ -z "$POD_URL" ]; then
  echo "❌ Could not detect pod URL from frontend/.env"
  exit 1
fi
WEBHOOK_BASE="${POD_URL}/api"
echo "📍 Detected pod URL: $POD_URL"
echo "📡 Webhook base: $WEBHOOK_BASE"

# ── Step 2: Update SELF_URL in backend/.env ──
if grep -q '^SELF_URL=' /app/backend/.env; then
  sed -i "s|^SELF_URL=.*|SELF_URL=${WEBHOOK_BASE}|" /app/backend/.env
  echo "✅ Updated SELF_URL=${WEBHOOK_BASE}"
else
  echo "SELF_URL=${WEBHOOK_BASE}" >> /app/backend/.env
  echo "✅ Added SELF_URL=${WEBHOOK_BASE}"
fi

if grep -q '^SELF_URL_PROD=' /app/backend/.env; then
  sed -i "s|^SELF_URL_PROD=.*|SELF_URL_PROD=${WEBHOOK_BASE}|" /app/backend/.env
  echo "✅ Updated SELF_URL_PROD=${WEBHOOK_BASE}"
else
  echo "SELF_URL_PROD=${WEBHOOK_BASE}" >> /app/backend/.env
  echo "✅ Added SELF_URL_PROD=${WEBHOOK_BASE}"
fi

# ── Step 3: Create .env symlink for Node.js dotenv ──
if [ ! -L /app/.env ]; then
  ln -sf /app/backend/.env /app/.env
  echo "✅ Created symlink /app/.env → /app/backend/.env"
else
  echo "✅ Symlink /app/.env already exists"
fi

# ── Step 4: Install Node.js dependencies ──
if [ ! -d /app/node_modules ]; then
  echo "📦 Installing Node.js dependencies..."
  cd /app && yarn install
  echo "✅ Node.js dependencies installed"
else
  echo "✅ Node.js dependencies already installed"
fi

# ── Step 5: Create supervisor config ──
NODEJS_CONF="/etc/supervisor/conf.d/supervisord_nodejs.conf"
if [ ! -f "$NODEJS_CONF" ]; then
  cat > "$NODEJS_CONF" << 'SUPERVISOR_EOF'
[program:nodejs]
command=node js/start-bot.js
directory=/app
autostart=true
autorestart=true
stderr_logfile=/var/log/supervisor/nodejs.err.log
stdout_logfile=/var/log/supervisor/nodejs.out.log
stopsignal=TERM
stopwaitsecs=30
stopasgroup=true
killasgroup=true
SUPERVISOR_EOF
  echo "✅ Created supervisor config for Node.js"
else
  echo "✅ Supervisor config already exists"
fi

# ── Step 6: Start/restart Node.js via supervisor ──
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl restart nodejs 2>/dev/null || sudo supervisorctl start nodejs
echo "✅ Node.js server started"

# ── Step 7: Verify ──
sleep 3
if sudo supervisorctl status nodejs | grep -q RUNNING; then
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "✅ Setup complete! All services running."
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "Services:"
  sudo supervisorctl status
  echo ""
  echo "Webhook URLs:"
  echo "  Voice:  ${WEBHOOK_BASE}/telnyx/voice-webhook"
  echo "  SMS:    ${WEBHOOK_BASE}/telnyx/sms-webhook"
  echo "  Telegram: ${WEBHOOK_BASE}/telegram/webhook"
else
  echo "❌ Node.js failed to start. Check logs:"
  echo "  tail -n 50 /var/log/supervisor/nodejs.out.log"
  echo "  tail -n 50 /var/log/supervisor/nodejs.err.log"
  exit 1
fi
