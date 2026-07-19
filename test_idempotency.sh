#!/bin/bash
BACKEND_URL="https://service-onboard-env.preview.emergentagent.com"

echo "TEST 3 — Persistent + atomic webhook idempotency"
echo ""

for i in 1 2 3; do
  echo "Attempt $i:"
  RESPONSE=$(curl -s -X POST "${BACKEND_URL}/api/dev/idempotency-test" \
    -H "Content-Type: application/json" \
    -d '{}')
  echo "$RESPONSE"
  echo ""
done
