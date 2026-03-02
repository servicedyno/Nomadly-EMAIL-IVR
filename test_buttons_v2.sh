#!/bin/bash
# Webhook simulator for testing Nomadly Telegram bot button flows
# Uses @hostbay_support test user — WITH language selection first

WEBHOOK_URL="http://localhost:5000/telegram/webhook"
TEST_CHAT_ID=9999999
UPDATE_ID=200000
USERNAME="hostbay_support"

GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

PASS=0
FAIL=0

send_message() {
  local text="$1"
  local label="$2"
  local expect_reply="$3"  # optional string to look for in logs
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

  # Mark before send
  local before_lines=$(wc -l < /var/log/supervisor/nodejs.out.log)
  
  local status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d "$payload")
  
  sleep 1.5
  
  # Get new log lines
  local after_lines=$(wc -l < /var/log/supervisor/nodejs.out.log)
  local new_lines=$((after_lines - before_lines))
  local reply_text=$(tail -n $new_lines /var/log/supervisor/nodejs.out.log | grep "reply:" | head -1)
  
  if [ "$status" = "200" ]; then
    if [ -n "$expect_reply" ]; then
      if tail -n $new_lines /var/log/supervisor/nodejs.out.log | grep -q "$expect_reply"; then
        echo -e "${GREEN}✅ [$label] HTTP $status — reply contains '$expect_reply'${NC}"
        PASS=$((PASS + 1))
      else
        echo -e "${RED}❌ [$label] HTTP $status — expected '$expect_reply' but got:${NC}"
        echo "   $reply_text"
        FAIL=$((FAIL + 1))
      fi
    else
      echo -e "${GREEN}✅ [$label] HTTP $status${NC}"
      if [ -n "$reply_text" ]; then
        echo -e "   ${CYAN}→ ${reply_text:0:120}${NC}"
      fi
      PASS=$((PASS + 1))
    fi
  else
    echo -e "${RED}❌ [$label] HTTP $status${NC}"
    FAIL=$((FAIL + 1))
  fi
}

echo "═══════════════════════════════════════════════"
echo "  Nomadly Bot — Full Button Flow Test"
echo "  Test user: @${USERNAME} (${TEST_CHAT_ID})"
echo "═══════════════════════════════════════════════"
echo ""

# Clear error log
> /var/log/supervisor/nodejs.err.log

echo "── Step 0: Initialize user + select language ──"
send_message "/start" "START command" "language"
sleep 0.5
send_message "🇬🇧 English" "Select English language" ""

echo ""
echo "── Step 1: Cloud IVR + SIP → submenu with Test SIP ──"
send_message "📞 Cloud IVR + SIP" "Cloud IVR button" "Cloud IVR"
sleep 0.5
send_message "🧪 Test SIP Free" "Test SIP Free (inside Cloud IVR)" "SIP"

echo ""
echo "── Step 2: Reset + Marketplace ──"
send_message "/start" "RESET" ""
sleep 0.5
send_message "🏪 Marketplace" "Marketplace button" "MARKETPLACE"

echo ""
echo "── Step 3: Reset + Digital Products ──"
send_message "/start" "RESET" ""
sleep 0.5
send_message "🛒 Digital Products" "Digital Products button" ""

echo ""
echo "── Step 4: Reset + Virtual Card ──"
send_message "/start" "RESET" ""
sleep 0.5
send_message "💳 Virtual Card" "Virtual Card button" ""

echo ""
echo "── Step 5: Reset + Bulletproof Domains ──"
send_message "/start" "RESET" ""
sleep 0.5
send_message "🌐 Bulletproof Domains" "Bulletproof Domains button" ""

echo ""
echo "── Step 6: Reset + Anti-Red Hosting ──"
send_message "/start" "RESET" ""
sleep 0.5
send_message "🛡️🔥 Anti-Red Hosting" "Anti-Red Hosting button" ""

echo ""
echo "── Step 7: Reset + URL Shortener ──"
send_message "/start" "RESET" ""
sleep 0.5
send_message "🔗 URL Shortener" "URL Shortener button" ""

echo ""
echo "── Step 8: Reset + Leads & Validation → submenu ──"
send_message "/start" "RESET" ""
sleep 0.5
send_message "🎯 Leads & Validation" "Leads & Validation combined" "Leads"

echo ""
echo "── Step 9: Reset + Wallet ──"
send_message "/start" "RESET" ""
sleep 0.5
send_message "👛 Wallet" "Wallet button" "Wallet"

echo ""
echo "── Step 10: Reset + My Plans ──"
send_message "/start" "RESET" ""
sleep 0.5
send_message "📋 My Plans" "My Plans button" ""

echo ""
echo "── Step 11: Settings → Change Language ──"
send_message "/start" "RESET" ""
sleep 0.5
send_message "🌍 Settings" "Settings button" "Settings"
sleep 0.5
send_message "🌍 Change Language" "Change Language (inside Settings)" "language"

echo ""
echo "── Step 12: Settings → Join Channel ──"
send_message "/start" "RESET" ""
sleep 0.5
send_message "🌍 Settings" "Settings button" "Settings"
sleep 0.5
send_message "📢 Join Channel" "Join Channel (inside Settings)" "Channel"

echo ""
echo "── Step 13: Support ──"
send_message "/start" "RESET" ""
sleep 0.5
send_message "💬 Support" "Support button" ""

echo ""
echo "═══════════════════════════════════════════════"
echo "  RESULTS: ${PASS} passed, ${FAIL} failed"
echo "═══════════════════════════════════════════════"

# Check for crashes
ERR_SIZE=$(wc -c < /var/log/supervisor/nodejs.err.log)
if [ "$ERR_SIZE" -gt "0" ]; then
  echo -e "${RED}❌ CRASHES found in nodejs.err.log:${NC}"
  cat /var/log/supervisor/nodejs.err.log
else
  echo -e "${GREEN}✅ Zero crashes — nodejs.err.log is empty${NC}"
fi

# Check for unhandled errors
UNHANDLED=$(tail -n 200 /var/log/supervisor/nodejs.out.log | grep -ic "unhandled\|Cannot read\|TypeError\|ReferenceError")
if [ "$UNHANDLED" -gt "0" ]; then
  echo -e "${RED}❌ Found $UNHANDLED unhandled errors in logs${NC}"
  tail -n 200 /var/log/supervisor/nodejs.out.log | grep -i "unhandled\|Cannot read\|TypeError\|ReferenceError"
else
  echo -e "${GREEN}✅ No unhandled errors in logs${NC}"
fi
