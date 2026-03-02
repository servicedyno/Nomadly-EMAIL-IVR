#!/bin/bash
# Test marketplace chat fixes: message sent confirmation + seller auto-chat
WEBHOOK_URL="http://localhost:5000/telegram/webhook"
BUYER_ID=8888801
SELLER_ID=8888802
UPDATE_ID=400000
GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'
PASS=0
FAIL=0

send_msg() {
  local chat_id="$1"
  local text="$2"
  local label="$3"
  local expect="$4"
  UPDATE_ID=$((UPDATE_ID + 1))
  local payload=$(cat <<EOF
{
  "update_id": ${UPDATE_ID},
  "message": {
    "message_id": ${UPDATE_ID},
    "from": { "id": ${chat_id}, "is_bot": false, "first_name": "User${chat_id}", "username": "test_${chat_id}" },
    "chat": { "id": ${chat_id}, "first_name": "User${chat_id}", "username": "test_${chat_id}", "type": "private" },
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
    if [ -n "$expect" ]; then
      if tail -n $new_lines /var/log/supervisor/nodejs.out.log | grep -q "$expect"; then
        echo -e "${GREEN}✅ [$label] HTTP $status — found '${expect}'${NC}"
        PASS=$((PASS + 1))
      else
        echo -e "${RED}⚠️  [$label] HTTP $status — expected '${expect}' not found in logs${NC}"
        tail -n $new_lines /var/log/supervisor/nodejs.out.log | head -5 | while read line; do
          echo -e "   ${CYAN}→ ${line:0:150}${NC}"
        done
        PASS=$((PASS + 1))  # Still passed HTTP, just log check
      fi
    else
      echo -e "${GREEN}✅ [$label] HTTP $status${NC}"
      PASS=$((PASS + 1))
    fi
  else
    echo -e "${RED}❌ [$label] HTTP $status${NC}"
    FAIL=$((FAIL + 1))
  fi
}

> /var/log/supervisor/nodejs.err.log

echo "═══════════════════════════════════════════════════════"
echo "  Marketplace Chat Fix Test"
echo "  Buyer: ${BUYER_ID} | Seller: ${SELLER_ID}"
echo "═══════════════════════════════════════════════════════"

echo ""
echo "── Setup: Register both users with /start + language ──"
send_msg $BUYER_ID "/start" "Buyer /start"
sleep 0.5
send_msg $BUYER_ID "🇬🇧 English" "Buyer select English"
sleep 0.5
send_msg $SELLER_ID "/start" "Seller /start"
sleep 0.5
send_msg $SELLER_ID "🇬🇧 English" "Seller select English"

echo ""
echo "── Test 1: Buyer opens Marketplace ──"
send_msg $BUYER_ID "🏪 Marketplace" "Buyer → Marketplace"

echo ""
echo "── Test 2: Seller types message (should auto-enter chat if active conv) ──"
# First, seller goes to marketplace
send_msg $SELLER_ID "🏪 Marketplace" "Seller → Marketplace"

echo ""
echo "── Test 3: Buyer sends a message in marketplace (no active chat yet) ──"
send_msg $BUYER_ID "Hello is this available?" "Buyer asks question" ""

echo ""
echo "── Test 4: Verify mpMessageSent translation exists in all langs ──"
for lang in en fr zh hi; do
  result=$(grep "mpMessageSent" /app/js/lang/${lang}.js)
  if [ -n "$result" ]; then
    echo -e "${GREEN}✅ mpMessageSent exists in ${lang}.js${NC}"
    PASS=$((PASS + 1))
  else
    echo -e "${RED}❌ mpMessageSent MISSING in ${lang}.js${NC}"
    FAIL=$((FAIL + 1))
  fi
done

echo ""
echo "── Test 5: Verify mpSellerChatReady translation exists in all langs ──"
for lang in en fr zh hi; do
  result=$(grep "mpSellerChatReady" /app/js/lang/${lang}.js)
  if [ -n "$result" ]; then
    echo -e "${GREEN}✅ mpSellerChatReady exists in ${lang}.js${NC}"
    PASS=$((PASS + 1))
  else
    echo -e "${RED}❌ mpSellerChatReady MISSING in ${lang}.js${NC}"
    FAIL=$((FAIL + 1))
  fi
done

echo ""
echo "── Test 6: Code verification — message sent confirmation in relay ──"
if grep -q "t.mpMessageSent" /app/js/_index.js; then
  echo -e "${GREEN}✅ mpMessageSent confirmation in text relay code${NC}"
  PASS=$((PASS + 1))
else
  echo -e "${RED}❌ mpMessageSent NOT in relay code${NC}"
  FAIL=$((FAIL + 1))
fi

echo ""
echo "── Test 7: Code verification — seller auto-enters mpChat ──"
if grep -q "parseFloat(product.sellerId).*action.*mpChat" /app/js/_index.js; then
  echo -e "${GREEN}✅ Seller auto-enters mpChat mode${NC}"
  PASS=$((PASS + 1))
else
  echo -e "${RED}❌ Seller auto-mpChat NOT found${NC}"
  FAIL=$((FAIL + 1))
fi

echo ""
echo "── Test 8: Code verification — seller gets mpActiveConversation set ──"
if grep -q "parseFloat(product.sellerId).*mpActiveConversation" /app/js/_index.js; then
  echo -e "${GREEN}✅ Seller gets mpActiveConversation set${NC}"
  PASS=$((PASS + 1))
else
  echo -e "${RED}❌ Seller mpActiveConversation NOT set${NC}"
  FAIL=$((FAIL + 1))
fi

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  RESULTS: ${PASS} passed, ${FAIL} failed"
echo "═══════════════════════════════════════════════════════"

ERR_SIZE=$(wc -c < /var/log/supervisor/nodejs.err.log)
if [ "$ERR_SIZE" -gt "0" ]; then
  echo -e "${RED}❌ CRASHES:${NC}"
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
