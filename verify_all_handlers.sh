#!/bin/bash
# Verify all 11 DynoPay product handlers use computeDepositCreditUsd

handlers=(
  "crypto-pay-plan"
  "crypto-pay-domain"
  "crypto-pay-hosting"
  "crypto-pay-phone"
  "crypto-pay-phone-upgrade"
  "crypto-pay-leads"
  "crypto-pay-vps"
  "crypto-pay-upgrade-vps"
  "crypto-pay-digital-product"
  "crypto-pay-marketplace-access"
  "crypto-pay-virtual-card"
)

echo "Verifying all 11 DynoPay product handlers use computeDepositCreditUsd..."
echo ""

all_pass=true
for handler in "${handlers[@]}"; do
  # Find the handler line number
  line=$(grep -n "app.post('/dynopay/$handler'" /app/js/_index.js | cut -d: -f1)
  
  if [ -z "$line" ]; then
    echo "❌ Handler $handler NOT FOUND"
    all_pass=false
    continue
  fi
  
  # Check if computeDepositCreditUsd is used within the next 100 lines
  end_line=$((line + 100))
  if sed -n "${line},${end_line}p" /app/js/_index.js | grep -q "computeDepositCreditUsd"; then
    echo "✅ $handler (line $line) uses computeDepositCreditUsd"
  else
    echo "❌ $handler (line $line) does NOT use computeDepositCreditUsd"
    all_pass=false
  fi
done

echo ""
if [ "$all_pass" = true ]; then
  echo "✅ All 11 handlers verified"
  exit 0
else
  echo "❌ Some handlers missing the fix"
  exit 1
fi
