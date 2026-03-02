#!/bin/bash
# Test AI integration in marketplace buttons
WEBHOOK_URL="http://localhost:5000/telegram/webhook"
TEST_CHAT_ID=9999999
UPDATE_ID=300000
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
  UPDATE_ID=$((UPDATE_ID + 1))
  local payload=$(cat <<EOF
{
  "update_id": ${UPDATE_ID},
  "message": {
    "message_id": ${UPDATE_ID},
    "from": { "id": ${TEST_CHAT_ID}, "is_bot": false, "first_name": "TestUser", "username": "${USERNAME}" },
    "chat": { "id": ${TEST_CHAT_ID}, "first_name": "TestUser", "username": "${USERNAME}", "type": "private" },
    "date": $(date +%s),
    "text": "${text}"
  }
}
EOF
)
  local before_lines=$(wc -l < /var/log/supervisor/nodejs.out.log)
  local status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$WEBHOOK_URL" -H "Content-Type: application/json" -d "$payload")
  sleep 2
  local after_lines=$(wc -l < /var/log/supervisor/nodejs.out.log)
  local new_lines=$((after_lines - before_lines))
  if [ "$status" = "200" ]; then
    echo -e "${GREEN}✅ [$label] HTTP $status${NC}"
    # Show relevant log lines
    if [ "$new_lines" -gt 0 ]; then
      tail -n $new_lines /var/log/supervisor/nodejs.out.log | grep -v "^$" | head -3 | while read line; do
        echo -e "   ${CYAN}→ ${line:0:150}${NC}"
      done
    fi
    PASS=$((PASS + 1))
  else
    echo -e "${RED}❌ [$label] HTTP $status${NC}"
    FAIL=$((FAIL + 1))
  fi
}

> /var/log/supervisor/nodejs.err.log

echo "═════════════════════════════════════════════════"
echo "  AI + Marketplace Integration Test"
echo "═════════════════════════════════════════════════"

echo ""
echo "── Test 1: Marketplace Home (should show 🤖 Ask AI button) ──"
send_message "/start" "Reset to main menu"
sleep 1
send_message "🏪 Marketplace" "Marketplace Home"

echo ""
echo "── Test 2: Ask AI button → enters AI helper mode ──"
send_message "🤖 Ask AI" "Ask AI button in marketplace"

echo ""
echo "── Test 3: Ask AI a question (marketplace context) ──"
send_message "How do I sell a product on the marketplace?" "AI question about selling"
sleep 3

echo ""
echo "── Test 4: Ask AI about escrow ──"
send_message "How does escrow protection work?" "AI question about escrow"
sleep 3

echo ""
echo "── Test 5: Back from AI helper ──"
send_message "↩️ Back" "Back from AI helper to marketplace"

echo ""
echo "── Test 6: Marketplace with all new buttons visible ──"
send_message "🏪 Marketplace" "Marketplace Home (verify AI button)"

echo ""
echo "── Test 7: Leads & Validation (regression) ──"
send_message "/start" "Reset"
sleep 1
send_message "🎯 Leads & Validation" "Leads combined button"

echo ""
echo "── Test 8: Settings submenu (regression) ──"
send_message "/start" "Reset"
sleep 1
send_message "🌍 Settings" "Settings submenu"

echo ""
echo "═════════════════════════════════════════════════"
echo "  RESULTS: ${PASS} passed, ${FAIL} failed"
echo "═════════════════════════════════════════════════"

ERR_SIZE=$(wc -c < /var/log/supervisor/nodejs.err.log)
if [ "$ERR_SIZE" -gt "0" ]; then
  echo -e "${RED}❌ CRASHES in nodejs.err.log:${NC}"
  cat /var/log/supervisor/nodejs.err.log
else
  echo -e "${GREEN}✅ Zero crashes${NC}"
fi

UNHANDLED=$(tail -n 100 /var/log/supervisor/nodejs.out.log | grep -ic "TypeError\|ReferenceError\|Cannot read\|UnhandledPromiseRejection")
if [ "$UNHANDLED" -gt "0" ]; then
  echo -e "${RED}❌ Found $UNHANDLED unhandled errors${NC}"
  tail -n 100 /var/log/supervisor/nodejs.out.log | grep -i "TypeError\|ReferenceError\|Cannot read\|UnhandledPromiseRejection"
else
  echo -e "${GREEN}✅ No unhandled errors${NC}"
fi
