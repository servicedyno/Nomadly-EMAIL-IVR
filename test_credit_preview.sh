#!/bin/bash
BACKEND_URL="https://naughty-raman-8.preview.emergentagent.com"

echo "TEST 4 — Regression of existing preview endpoint"
echo ""

# Test 4d
echo "Test 4d: Major underpayment scenario"
RESPONSE=$(curl -s -X POST "${BACKEND_URL}/api/dev/credit-preview" \
  -H "Content-Type: application/json" \
  -d '{"invoiceUsd":100,"convertedValue":5.85,"feePayer":"company"}')
echo "Response: $RESPONSE"
echo ""

# Test 4e
echo "Test 4e: Exact payment scenario"
RESPONSE=$(curl -s -X POST "${BACKEND_URL}/api/dev/credit-preview" \
  -H "Content-Type: application/json" \
  -d '{"invoiceUsd":50,"convertedValue":50,"feePayer":"company"}')
echo "Response: $RESPONSE"
echo ""
