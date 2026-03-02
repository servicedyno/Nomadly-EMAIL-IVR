#!/bin/bash
# Webhook simulator for testing Nomadly Telegram bot button flows
# Uses @hostbay_support test user

WEBHOOK_URL="http://localhost:5000/telegram/webhook"
TEST_CHAT_ID=9999999
UPDATE_ID=100000
USERNAME="hostbay_support"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

send_message() {
  local text="$1"
  local label="$2"
  UPDATE_ID=$((UPDATE_ID + 1))
  
  local payload=$(cat <<EOF
{
  "update_id": ${UPDATE_ID},
  "message": {
    "message_id": ${UPDATE_ID},
    "from": {
      "id": ${TEST_CHAT_ID},
      "is_bot": false,
      "first_name": "TestUser",
      "username": "${USERNAME}"
    },
    "chat": {
      "id": ${TEST_CHAT_ID},
      "first_name": "TestUser",
      "username": "${USERNAME}",
      "type": "private"
    },
    "date": $(date +%s),
    "text": "${text}"
  }
}
EOF
)

  local status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d "$payload")
  
  if [ "$status" = "200" ]; then
    echo -e "${GREEN}✅ [$label] -> HTTP $status${NC}"
  else
    echo -e "${RED}❌ [$label] -> HTTP $status${NC}"
  fi
  sleep 1
}

echo "═══════════════════════════════════════════"
echo "  Nomadly Bot Button Flow Test"
echo "  Test user: @${USERNAME} (${TEST_CHAT_ID})"
echo "═══════════════════════════════════════════"
echo ""

# Clear error log first
> /var/log/supervisor/nodejs.err.log

# Mark test start in log
echo "===TEST_START===" >> /var/log/supervisor/nodejs.out.log

echo "── Phase 0: /start ──"
send_message "/start" "START command"

echo ""
echo "── Phase 1: Cloud IVR + SIP (submenu5) ──"
send_message "📞 Cloud IVR + SIP" "Cloud IVR main button"
sleep 1
send_message "🧪 Test SIP Free" "Test SIP Free (inside Cloud IVR)"

echo ""
echo "── Phase 2: Marketplace ──"
send_message "/start" "RESET to main menu"
sleep 1
send_message "🏪 Marketplace" "Marketplace button"

echo ""
echo "── Phase 3: Digital Products ──"
send_message "/start" "RESET to main menu"
sleep 1
send_message "🛒 Digital Products" "Digital Products button"

echo ""
echo "── Phase 4: Virtual Card ──"
send_message "/start" "RESET to main menu"
sleep 1
send_message "💳 Virtual Card" "Virtual Card button"

echo ""
echo "── Phase 5: Bulletproof Domains ──"
send_message "/start" "RESET to main menu"
sleep 1
send_message "🌐 Bulletproof Domains" "Bulletproof Domains button"

echo ""
echo "── Phase 6: Anti-Red Hosting ──"
send_message "/start" "RESET to main menu"
sleep 1
send_message "🛡️🔥 Anti-Red Hosting" "Anti-Red Hosting button"

echo ""
echo "── Phase 7: URL Shortener ──"
send_message "/start" "RESET to main menu"
sleep 1
send_message "🔗 URL Shortener" "URL Shortener button"

echo ""
echo "── Phase 8: Leads & Validation ──"
send_message "/start" "RESET to main menu"
sleep 1
send_message "🎯 Leads & Validation" "Leads & Validation combined button"

echo ""
echo "── Phase 9: Wallet ──"
send_message "/start" "RESET to main menu"
sleep 1
send_message "👛 Wallet" "Wallet button"

echo ""
echo "── Phase 10: My Plans ──"
send_message "/start" "RESET to main menu"
sleep 1
send_message "📋 My Plans" "My Plans button"

echo ""
echo "── Phase 11: Settings → submenu ──"
send_message "/start" "RESET to main menu"
sleep 1
send_message "🌍 Settings" "Settings button (should show submenu)"
sleep 1
send_message "🌍 Change Language" "Change Language (inside Settings)"
sleep 1

echo ""
echo "── Phase 12: Settings → Join Channel ──"
send_message "/start" "RESET to main menu"
sleep 1
send_message "🌍 Settings" "Settings button again"
sleep 1
send_message "📢 Join Channel" "Join Channel (inside Settings)"

echo ""
echo "── Phase 13: Support ──"
send_message "/start" "RESET to main menu"
sleep 1
send_message "💬 Support" "Support button"

echo ""
echo "═══════════════════════════════════════════"
echo "  TEST COMPLETE - Checking for errors..."
echo "═══════════════════════════════════════════"

# Check for crashes
ERR_SIZE=$(wc -c < /var/log/supervisor/nodejs.err.log)
if [ "$ERR_SIZE" -gt "0" ]; then
  echo -e "${RED}❌ ERRORS FOUND in nodejs.err.log:${NC}"
  cat /var/log/supervisor/nodejs.err.log
else
  echo -e "${GREEN}✅ No crashes — nodejs.err.log is empty${NC}"
fi

echo ""
echo "── Relevant log output (after test start): ──"
sed -n '/===TEST_START===/,$p' /var/log/supervisor/nodejs.out.log | grep -E "message:|📨|Error|error|❌|unhandled|UnhandledPromiseRejection|Cannot read" | tail -40
