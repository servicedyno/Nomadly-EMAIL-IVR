#!/bin/bash
# Web Storefront Phase 2 Backend Testing using curl
# More reliable from inside container than Python requests

BASE_URL="https://cred-deploy.preview.emergentagent.com/api/store"

echo "================================================================================"
echo "WEB STOREFRONT PHASE 2 BACKEND TESTING (curl)"
echo "================================================================================"
echo ""

# Login to get tokens
echo "=== Setting up authentication ==="
BUYER_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"storebuyer@example.com","password":"password1234"}')
BUYER_TOKEN=$(echo "$BUYER_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

BROKE_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"storebroke@example.com","password":"password1234"}')
BROKE_TOKEN=$(echo "$BROKE_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$BUYER_TOKEN" ]; then
  echo "❌ Failed to login BUYER"
  exit 1
fi
if [ -z "$BROKE_TOKEN" ]; then
  echo "❌ Failed to login BROKE"
  exit 1
fi

echo "✅ BUYER token: ${BUYER_TOKEN:0:20}..."
echo "✅ BROKE token: ${BROKE_TOKEN:0:20}..."
echo ""

PASS_COUNT=0
FAIL_COUNT=0

# Test 1: GET /plans (no auth)
echo "=== Test 1: GET /plans (no auth) ==="
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/plans")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)
if [ "$HTTP_CODE" = "200" ]; then
  PLAN_COUNT=$(echo "$BODY" | grep -o '"id"' | wc -l)
  if [ "$PLAN_COUNT" = "3" ]; then
    echo "✅ Test 1 PASS: 200, 3 plans found"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "❌ Test 1 FAIL: Expected 3 plans, got $PLAN_COUNT"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
else
  echo "❌ Test 1 FAIL: Expected 200, got $HTTP_CODE"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi
echo ""

# Test 2: GET /my-plans (BUYER)
echo "=== Test 2: GET /my-plans (BUYER) ==="
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/my-plans" \
  -H "Authorization: Bearer $BUYER_TOKEN")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)
if [ "$HTTP_CODE" = "200" ]; then
  if echo "$BODY" | grep -q "weblinked-test.example"; then
    echo "✅ Test 2 PASS: 200, contains weblinked-test.example"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "❌ Test 2 FAIL: weblinked-test.example not found"
    echo "Body: $BODY"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
else
  echo "❌ Test 2 FAIL: Expected 200, got $HTTP_CODE"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi
echo ""

# Test 3: POST /open-panel (BUYER) valid
echo "=== Test 3: POST /open-panel (BUYER) valid cpUser ==="
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/open-panel" \
  -H "Authorization: Bearer $BUYER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cpUser":"webtest01"}')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)
if [ "$HTTP_CODE" = "200" ]; then
  if echo "$BODY" | grep -q '"token"' && echo "$BODY" | grep -q "weblinked-test.example"; then
    echo "✅ Test 3 PASS: 200, token + domain present"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "❌ Test 3 FAIL: token or domain missing"
    echo "Body: $BODY"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
else
  echo "❌ Test 3 FAIL: Expected 200, got $HTTP_CODE"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi
echo ""

# Test 4: POST /open-panel (BUYER) invalid
echo "=== Test 4: POST /open-panel (BUYER) invalid cpUser ==="
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/open-panel" \
  -H "Authorization: Bearer $BUYER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cpUser":"doesnotexist"}')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "404" ]; then
  echo "✅ Test 4 PASS: 404"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo "❌ Test 4 FAIL: Expected 404, got $HTTP_CODE"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi
echo ""

# Test 5: GET /wallet (BUYER)
echo "=== Test 5: GET /wallet (BUYER) ==="
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/wallet" \
  -H "Authorization: Bearer $BUYER_TOKEN")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)
if [ "$HTTP_CODE" = "200" ]; then
  if echo "$BODY" | grep -q '"balanceUsd":200'; then
    echo "✅ Test 5 PASS: 200, balanceUsd=200"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "❌ Test 5 FAIL: balanceUsd not 200"
    echo "Body: $BODY"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
else
  echo "❌ Test 5 FAIL: Expected 200, got $HTTP_CODE"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi
echo ""

# Test 6: POST /hosting/purchase invalid plan
echo "=== Test 6: POST /hosting/purchase invalid plan ==="
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/hosting/purchase" \
  -H "Authorization: Bearer $BUYER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"planId":"nope","domain":"x.com","domainMode":"byo"}')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "400" ]; then
  echo "✅ Test 6 PASS: 400 (unknown plan)"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo "❌ Test 6 FAIL: Expected 400, got $HTTP_CODE"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi
echo ""

# Test 7: POST /hosting/purchase duplicate domain
echo "=== Test 7: POST /hosting/purchase duplicate domain ==="
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/hosting/purchase" \
  -H "Authorization: Bearer $BUYER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"planId":"premium-weekly","domain":"weblinked-test.example","domainMode":"byo"}')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "409" ]; then
  echo "✅ Test 7 PASS: 409 (domain already has hosting)"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo "❌ Test 7 FAIL: Expected 409, got $HTTP_CODE"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi
echo ""

# Test 8: POST /hosting/purchase insufficient balance
echo "=== Test 8: POST /hosting/purchase insufficient balance ==="
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/hosting/purchase" \
  -H "Authorization: Bearer $BROKE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"planId":"premium-weekly","domain":"brokebuy-test.example","domainMode":"byo"}')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)
if [ "$HTTP_CODE" = "402" ]; then
  if echo "$BODY" | grep -q '"needTopup":true'; then
    echo "✅ Test 8 PASS: 402, needTopup=true"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "❌ Test 8 FAIL: needTopup not true"
    echo "Body: $BODY"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
else
  echo "❌ Test 8 FAIL: Expected 402, got $HTTP_CODE"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi
echo ""

# Test 9: REFUND INTEGRITY
echo "=== Test 9: REFUND INTEGRITY (most important) ==="
# Get initial balance
INITIAL_RESPONSE=$(curl -s "$BASE_URL/wallet" -H "Authorization: Bearer $BUYER_TOKEN")
INITIAL_BALANCE=$(echo "$INITIAL_RESPONSE" | grep -o '"balanceUsd":[0-9]*' | cut -d':' -f2)
echo "Initial balance: \$$INITIAL_BALANCE"

# Generate random domain
RANDOM_SUFFIX=$(cat /dev/urandom | tr -dc 'a-z0-9' | fold -w 8 | head -n 1)
TEST_DOMAIN="refundtest-$RANDOM_SUFFIX.example"
echo "Attempting purchase with domain: $TEST_DOMAIN"
echo "(Expected to fail with 502 due to WHM unreachable - this is EXPECTED)"

# Attempt purchase (will fail, takes ~10-20s for WHM retries)
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/hosting/purchase" \
  -H "Authorization: Bearer $BUYER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"planId\":\"premium-weekly\",\"domain\":\"$TEST_DOMAIN\",\"domainMode\":\"byo\"}" \
  --max-time 30)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
echo "Purchase response: $HTTP_CODE"

if [ "$HTTP_CODE" = "502" ]; then
  echo "✓ Got expected 502 (provisioning failed)"
  
  # Check balance is restored
  sleep 1
  FINAL_RESPONSE=$(curl -s "$BASE_URL/wallet" -H "Authorization: Bearer $BUYER_TOKEN")
  FINAL_BALANCE=$(echo "$FINAL_RESPONSE" | grep -o '"balanceUsd":[0-9]*' | cut -d':' -f2)
  echo "Final balance: \$$FINAL_BALANCE"
  
  if [ "$INITIAL_BALANCE" = "200" ] && [ "$FINAL_BALANCE" = "200" ]; then
    echo "✅ Test 9 PASS: 502 + balance restored to \$200 (refund worked)"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "❌ Test 9 FAIL: Balance not restored (before: \$$INITIAL_BALANCE, after: \$$FINAL_BALANCE)"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
else
  echo "❌ Test 9 FAIL: Expected 502, got $HTTP_CODE"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi
echo ""

# Test 10: GET /wallet (no auth)
echo "=== Test 10: GET /wallet (no auth) ==="
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/wallet")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "401" ]; then
  echo "✅ Test 10 PASS: 401 Unauthorized"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo "❌ Test 10 FAIL: Expected 401, got $HTTP_CODE"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi
echo ""

# Summary
echo "================================================================================"
echo "TEST SUMMARY"
echo "================================================================================"
echo "Total tests: 10"
echo "✅ Passed: $PASS_COUNT"
echo "❌ Failed: $FAIL_COUNT"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
  echo "🎉 ALL TESTS PASSED!"
  exit 0
else
  echo "Some tests failed."
  exit 1
fi
