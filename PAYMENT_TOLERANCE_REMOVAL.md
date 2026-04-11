# Payment Tolerance Removal - Change Summary

**Date**: 2026-04-11  
**Change Type**: Payment Logic Update  
**Impact**: All payment webhooks (Bank NGN + Crypto)

---

## Changes Made

### 1. Removed 6% Underpayment Tolerance

**Previous Behavior**:
- Allowed users to pay up to 6% less than required price
- Example: $100 service could be purchased with $94.34 payment

**New Behavior**:
- Requires exact payment or more
- Example: $100 service requires minimum $100 payment

---

## Technical Details

### Files Modified
- `/app/js/_index.js` (28 instances updated)

### Changes Applied

#### Bank Payment Webhooks (NGN)
**Before**:
```javascript
if (usdIn * 1.06 < price) {
  // User paid too little - refund to wallet
}
```

**After**:
```javascript
if (usdIn < price) {
  // User paid too little - refund to wallet
}
```

#### Crypto Payment Webhooks (BlockBee & Dynopay)
**Before**:
```javascript
const usdNeed = usdIn * 1.06
if (usdNeed < price) {
  // User paid too little - refund to wallet
}
```

**After**:
```javascript
const usdNeed = usdIn
if (usdNeed < price) {
  // User paid too little - refund to wallet
}
```

---

## Affected Payment Types

### Bank Payments (NGN)
1. `/api/bank-pay-plan` - Subscription plans
2. `/api/bank-pay-domain` - Domain registration
3. `/api/bank-pay-hosting` - Hosting services
4. `/api/bank-pay-vps` - VPS instances
5. `/api/bank-pay-phone` - Cloud phone numbers
6. `/api/bank-pay-leads` - Lead generation
7. `/api/bank-pay-digital-product` - Digital products
8. `/api/bank-pay-virtual-card` - Virtual cards
9. `/api/bank-pay-email-blast` - Email campaigns
10. `/api/bank-wallet` - Wallet deposits

### Crypto Payments (BlockBee)
1. `/api/crypto-pay-plan`
2. `/api/crypto-pay-domain`
3. `/api/crypto-pay-hosting`
4. `/api/crypto-pay-vps`
5. `/api/crypto-pay-upgrade-vps`
6. `/api/crypto-pay-phone`
7. `/api/crypto-pay-leads`
8. `/api/crypto-pay-digital-product`
9. `/api/crypto-pay-virtual-card`

### Crypto Payments (Dynopay)
1. `/api/dynopay/crypto-pay-plan`
2. `/api/dynopay/crypto-pay-domain`
3. `/api/dynopay/crypto-pay-hosting`
4. `/api/dynopay/crypto-pay-vps`
5. `/api/dynopay/crypto-pay-upgrade-vps`
6. `/api/dynopay/crypto-pay-phone`
7. `/api/dynopay/crypto-pay-leads`
8. `/api/dynopay/crypto-pay-digital-product`
9. `/api/dynopay/crypto-pay-virtual-card`

**Total**: 28 payment endpoints updated

---

## Payment Flow Logic

### Underpayment (usdReceived < priceRequired)
1. ✅ Convert received amount to USD
2. ✅ Credit USD wallet with actual amount received
3. ✅ Send "paid less than required" message to user
4. ❌ Do NOT deliver service
5. ✅ Return error response to payment gateway

### Exact Payment (usdReceived == priceRequired)
1. ✅ Deduct exact price
2. ✅ Deliver service (activate plan, register domain, etc.)
3. ✅ Send success confirmation

### Overpayment (usdReceived > priceRequired)
1. ✅ Deduct exact price
2. ✅ Refund difference to USD wallet
3. ✅ Deliver service
4. ✅ Send "paid more, excess refunded" message

---

## Exchange Rate Handling

### NGN Payments
- Converts NGN to USD using OpenExchangeRates.org API
- Formula: `usdAmount = ngnAmount / (rate * (1 + PERCENT_INCREASE_USD_TO_NAIRA))`
- Current markup: `PERCENT_INCREASE_USD_TO_NAIRA = 0.00` (no markup)

### Crypto Payments
- Converts crypto to USD using real-time rates
- BlockBee: `convert(value, coin, 'usd')`
- Dynopay: Uses `base_amount` if available, else converts via ticker

---

## User Impact

### For Users Paying Less
**Before**: Could complete purchase with 6% underpayment  
**After**: Payment refunded to wallet, service not delivered

**Example**:
- Service price: $100
- User pays: $95 (NGN equivalent)
- **Old behavior**: Service delivered ✅
- **New behavior**: $95 credited to wallet, service not delivered ❌

### For Users Paying Exact or More
**No change** - Works exactly as before

---

## Testing Recommendations

1. **Underpayment Test**:
   - Initiate $50 service purchase
   - Pay $45 NGN equivalent
   - Verify: Wallet credited $45, service NOT delivered

2. **Exact Payment Test**:
   - Initiate $50 service purchase
   - Pay exactly $50 NGN equivalent
   - Verify: Service delivered, wallet unchanged

3. **Overpayment Test**:
   - Initiate $50 service purchase
   - Pay $55 NGN equivalent
   - Verify: Service delivered, $5 refunded to wallet

---

## Rollback Instructions

If needed, restore previous behavior:

```bash
cp /app/js/_index.js.backup /app/js/_index.js
sudo supervisorctl restart nodejs
```

Backup file: `/app/js/_index.js.backup`

---

## Related Files

- `/app/js/_index.js` - Main payment webhook handlers
- `/app/js/utils.js` - Currency conversion functions
- `/app/backend/.env` - Exchange rate API key configuration

---

**Status**: ✅ Implemented and deployed  
**Service Restart**: Required (completed)  
**Backward Compatibility**: Maintained (existing logic preserved, only tolerance removed)
