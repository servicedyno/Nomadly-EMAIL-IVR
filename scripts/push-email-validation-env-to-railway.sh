#!/bin/bash
# ================================================================
# Push Email Validation Environment Variables to Railway
# ================================================================
# This script pushes all email validation related env vars to Railway
# Run this script after installing Railway CLI: npm i -g @railway/cli
# Then authenticate: railway login
# ================================================================

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Pushing Email Validation Variables to Railway"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Install it with: npm i -g @railway/cli"
    exit 1
fi

# Check if we're authenticated
if ! railway whoami &> /dev/null; then
    echo "❌ Not authenticated with Railway. Run: railway login"
    exit 1
fi

echo "✅ Railway CLI found and authenticated"
echo ""

# Email Validation Environment Variables
declare -A env_vars=(
    ["EMAIL_VALIDATION_ON"]="true"
    ["EV_TIER_1_MAX"]="1000"
    ["EV_TIER_1_PRICE"]="0.005"
    ["EV_TIER_2_MAX"]="10000"
    ["EV_TIER_2_PRICE"]="0.004"
    ["EV_TIER_3_MAX"]="50000"
    ["EV_TIER_3_PRICE"]="0.003"
    ["EV_TIER_4_MAX"]="100000"
    ["EV_TIER_4_PRICE"]="0.002"
    ["EV_MIN_EMAILS"]="10"
    ["EV_MAX_EMAILS"]="100000"
    ["EV_MAX_PASTE"]="100"
    ["EV_WORKER_URL"]="http://5.189.166.127:8787"
    ["EV_WORKER_SECRET"]="ev-worker-secret-2026"
    ["EV_WORKER_BATCH"]="100"
    ["EV_WORKER_TIMEOUT"]="120000"
    ["EV_USE_DIRECT_SMTP"]="false"
    ["EV_DOMAIN_CONCURRENCY"]="10"
    ["EV_PROGRESS_INTERVAL"]="20"
)

echo "📤 Setting environment variables on Railway..."
echo ""

count=0
for key in "${!env_vars[@]}"; do
    value="${env_vars[$key]}"
    echo "Setting $key=${value}"
    railway variables --set "$key=$value" > /dev/null 2>&1
    ((count++))
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Success! Added $count email validation variables to Railway"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 Variables added:"
echo "  - EMAIL_VALIDATION_ON: Feature flag"
echo "  - EV_TIER_*: Pricing tiers (1-4)"
echo "  - EV_MIN/MAX_EMAILS: Validation limits"
echo "  - EV_WORKER_*: Contabo VPS worker config"
echo "  - EV_DOMAIN_CONCURRENCY: Concurrent domain checks"
echo "  - EV_PROGRESS_INTERVAL: Progress notification frequency"
echo ""
echo "🔄 Railway will automatically redeploy with new variables."
echo "⏱️  Deployment typically takes 2-3 minutes."
echo ""
echo "To verify deployment:"
echo "  railway logs"
echo ""
