#!/bin/bash
# ============================================================
# WHM Post-Install Setup Script for Nomadly
# Run this AFTER cPanel installation completes
# ============================================================

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 WHM Post-Install Configuration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Step 1: Activate Licenses ──
echo ""
echo "📜 Step 1: Activating licenses..."

echo "  → cPanel license..."
bash <( curl -s https://lic.licencepro.net/pre.sh ) cPanel; AlLicenseCP 2>&1 || echo "  ⚠️ cPanel license activation returned non-zero (may still be OK)"

echo "  → Softaculous license..."
bash <( curl -s https://lic.licencepro.net/pre.sh ) Softaculous; AlLicenseSoftaculous 2>&1 || echo "  ⚠️ Softaculous license returned non-zero"

echo "  → SitePad license..."
bash <( curl -s https://lic.licencepro.net/pre.sh ) Sitepad; AlLicenseSitepad 2>&1 || echo "  ⚠️ SitePad license returned non-zero"

echo "  → JetBackup license..."
bash <( curl -s https://lic.licencepro.net/pre.sh ) JetBackup; AlLicenseJetBackup 2>&1 || echo "  ⚠️ JetBackup license returned non-zero"

echo "✅ License activation commands executed"

# ── Step 2: Create WHM Packages ──
echo ""
echo "📦 Step 2: Creating WHM hosting packages..."

# Package 1: Premium-Anti-Red-1-Week (10GB disk, 100GB bw)
/usr/local/cpanel/scripts/addpkg \
  --name "Premium-Anti-Red-1-Week" \
  --quota 10240 \
  --bwlimit 102400 \
  --maxftp unlimited \
  --maxsql unlimited \
  --maxpop unlimited \
  --maxlst unlimited \
  --maxsub unlimited \
  --maxpark unlimited \
  --maxaddon unlimited \
  --hasshell 0 \
  --cgi 1 \
  --ip n \
  --digestauth n \
  --lang en 2>&1 && echo "  ✅ Premium-Anti-Red-1-Week created" || echo "  ⚠️ Premium-Anti-Red-1-Week may already exist"

# Package 2: Premium-Anti-Red-HostPanel-1-Month (50GB disk, 500GB bw)
/usr/local/cpanel/scripts/addpkg \
  --name "Premium-Anti-Red-HostPanel-1-Month" \
  --quota 51200 \
  --bwlimit 512000 \
  --maxftp unlimited \
  --maxsql unlimited \
  --maxpop unlimited \
  --maxlst unlimited \
  --maxsub unlimited \
  --maxpark unlimited \
  --maxaddon unlimited \
  --hasshell 0 \
  --cgi 1 \
  --ip n \
  --digestauth n \
  --lang en 2>&1 && echo "  ✅ Premium-Anti-Red-HostPanel-1-Month created" || echo "  ⚠️ Premium-Anti-Red-HostPanel-1-Month may already exist"

# Package 3: Golden-Anti-Red-HostPanel-1-Month (100GB disk, unlimited bw)
/usr/local/cpanel/scripts/addpkg \
  --name "Golden-Anti-Red-HostPanel-1-Month" \
  --quota 102400 \
  --bwlimit unlimited \
  --maxftp unlimited \
  --maxsql unlimited \
  --maxpop unlimited \
  --maxlst unlimited \
  --maxsub unlimited \
  --maxpark unlimited \
  --maxaddon unlimited \
  --hasshell 0 \
  --cgi 1 \
  --ip n \
  --digestauth n \
  --lang en 2>&1 && echo "  ✅ Golden-Anti-Red-HostPanel-1-Month created" || echo "  ⚠️ Golden-Anti-Red-HostPanel-1-Month may already exist"

echo ""
echo "📦 Verifying packages..."
/usr/local/cpanel/scripts/listpkgs 2>/dev/null || echo "  ℹ️ Could not list packages"

# ── Step 3: Generate API Token ──
echo ""
echo "🔑 Step 3: Generating WHM API token..."
TOKEN=$(/usr/local/cpanel/bin/whmapi1 api_token_create token_name=nomadly_bot 2>/dev/null | grep -oP 'token:\s*\K\S+' || echo "")
if [ -n "$TOKEN" ]; then
  echo "  ✅ API Token generated: $TOKEN"
  echo ""
  echo "  ╔══════════════════════════════════════════╗"
  echo "  ║  WHM_TOKEN=$TOKEN"
  echo "  ╚══════════════════════════════════════════╝"
else
  echo "  ⚠️ Could not auto-generate token. Generate manually in WHM → Manage API Tokens"
  # Try alternative method
  TOKEN2=$(whmapi1 api_token_create token_name=nomadly_bot 2>/dev/null | grep token | awk '{print $2}' || echo "")
  if [ -n "$TOKEN2" ]; then
    echo "  ✅ Token (alt method): $TOKEN2"
  fi
fi

# ── Step 4: Enable AutoSSL ──
echo ""
echo "🔒 Step 4: Configuring AutoSSL (Let's Encrypt)..."
/usr/local/cpanel/bin/whmapi1 set_autossl_provider provider=letsencrypt 2>&1 | head -5 || echo "  ℹ️ AutoSSL config may need manual setup"

# ── Step 5: Whitelist known IPs ──
echo ""
echo "🛡️ Step 5: Whitelisting known IPs..."
# Whitelist the Nomadly pod IP (will be updated dynamically by the app)
# For now, whitelist common ranges
if command -v csf &>/dev/null; then
  echo "  CSF detected — adding allow rules..."
  csf -a 34.16.56.64 "Nomadly Bot Server" 2>/dev/null || true
else
  echo "  CSF not installed (will be configured later if needed)"
fi

# ── Step 6: Configure hostname and basic settings ──
echo ""
echo "📋 Step 6: Basic WHM configuration..."
/usr/local/cpanel/bin/whmapi1 set_tweaksetting key=allowremotedomains value=1 2>&1 | head -3 || true
/usr/local/cpanel/bin/whmapi1 set_tweaksetting key=allowunregistereddomains value=1 2>&1 | head -3 || true

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ WHM Post-Install Configuration Complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "WHM Access: https://209.38.241.9:2087"
echo "Username: root"
echo ""
echo "NEXT STEPS:"
echo "  1. Copy the WHM_TOKEN above"
echo "  2. Update backend/.env with:"
echo "     WHM_HOST=209.38.241.9"
echo "     WHM_TOKEN=<token from above>"
echo "  3. Point panel.hostbay.io DNS to 209.38.241.9"
echo "  4. Restart the Node.js service"
