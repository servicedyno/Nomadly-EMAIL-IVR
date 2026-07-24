#!/bin/bash
BACKEND_URL="https://cred-deploy.preview.emergentagent.com"

echo "TEST 2 — Two-source valuation (DynoPay settlement rate primary, BlockBee fallback)"
echo ""

# Test 2a
echo "Test 2a: TRX payment with DynoPay rate"
RESPONSE=$(curl -s -X POST "${BACKEND_URL}/api/dev/resolve-credit-preview" \
  -H "Content-Type: application/json" \
  -d '{"amount":"17.72","exchange_rate":"0.33","base_currency":"USD","base_amount":"100","currency":"TRX","fee_payer":"company"}')
echo "Response: $RESPONSE"
echo ""

# Test 2b
echo "Test 2b: USDT-TRC20 payment with rate 1.0"
RESPONSE=$(curl -s -X POST "${BACKEND_URL}/api/dev/resolve-credit-preview" \
  -H "Content-Type: application/json" \
  -d '{"amount":"58.94","exchange_rate":"1.0","base_currency":"USD","base_amount":"105","currency":"USDT-TRC20","fee_payer":"company"}')
echo "Response: $RESPONSE"
echo ""

# Test 2c
echo "Test 2c: Non-USD base_currency (should ignore DynoPay rate)"
RESPONSE=$(curl -s -X POST "${BACKEND_URL}/api/dev/resolve-credit-preview" \
  -H "Content-Type: application/json" \
  -d '{"amount":"100","exchange_rate":"0.5","base_currency":"NGN","base_amount":"100","currency":"USDT-TRC20","fee_payer":"company"}')
echo "Response: $RESPONSE"
echo ""
