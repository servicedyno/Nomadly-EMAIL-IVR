# Payment Methods Confirmation Report

**Date**: 2026-04-11  
**Scope**: Multi-payment method verification for services

---

## ✅ CONFIRMED: Users Can Pay Using Multiple Methods

### Payment Options Available

When users purchase any service (Plans, Domains, Hosting, VPS, Phone Numbers, Products, etc.), they are presented with **3 payment methods**:

```javascript
const payIn = {
  crypto: 'Crypto',                              // ₿ Crypto payments (BlockBee + Dynopay)
  bank: 'Bank ₦aira + Card🏦💳',                  // 🏦 NGN Bank transfers (Fincra)
  wallet: '👛 Wallet',                            // 💰 USD Wallet balance
}
```

---

## Payment Flow Breakdown

### 1. **USD Wallet Balance** 👛
**How it works**:
- User selects "👛 Wallet" payment method
- System checks if USD wallet balance >= service price
- If sufficient: Deducts from `usdOut`, delivers service
- If insufficient: Shows error with current balance

**Location in code**: Line 5953+ (`walletOk` object)
```javascript
if (usdBal < priceUsd) return send(chatId, t.walletBalanceLowAmount(priceUsd, usdBal))
await atomicIncrement(walletOf, chatId, 'usdOut', priceUsd)
// Deliver service...
```

---

### 2. **Bank (NGN) Direct Payment** 🏦

**How it works**:
- User selects "Bank ₦aira + Card🏦💳"
- System shows NGN amount equivalent via Fincra payment gateway
- User pays NGN via bank transfer or card
- Webhook receives payment → converts NGN to USD → delivers service

**Payment webhooks** (all updated with no tolerance):
- `/api/bank-pay-plan` - Subscription plans
- `/api/bank-pay-domain` - Domain registration
- `/api/bank-pay-hosting` - Hosting services
- `/api/bank-pay-vps` - VPS instances
- `/api/bank-pay-phone` - Cloud phone numbers
- `/api/bank-pay-leads` - Lead generation
- `/api/bank-pay-digital-product` - Digital products
- `/api/bank-pay-virtual-card` - Virtual cards
- `/api/bank-pay-email-blast` - Email campaigns

**Underpayment behavior (NEW)**:
```javascript
const usdIn = await ngnToUsd(ngnIn)  // Convert actual NGN received to USD
if (usdIn < price) {
  addFundsTo(walletOf, chatId, 'ngn', ngnIn, lang)  // Credit wallet with USD equivalent
  // Service NOT delivered
}
```

**Example**:
- Service costs: $50
- User pays: ₦45,000 NGN (equivalent to $48 USD)
- Result: $48 credited to wallet, service NOT delivered (must pay at least $50)

---

### 3. **Crypto Direct Payment** ₿

**How it works**:
- User selects "Crypto" payment method
- System generates crypto payment address (BTC, ETH, USDT, etc.)
- User sends crypto payment
- Webhook receives payment → converts crypto to USD → delivers service

**Payment webhooks** (BlockBee):
- `/api/crypto-pay-plan`
- `/api/crypto-pay-domain`
- `/api/crypto-pay-hosting`
- `/api/crypto-pay-vps`
- `/api/crypto-pay-upgrade-vps`
- `/api/crypto-pay-phone`
- `/api/crypto-pay-leads`
- `/api/crypto-pay-digital-product`
- `/api/crypto-pay-virtual-card`

**Payment webhooks** (Dynopay):
- `/api/dynopay/crypto-pay-plan`
- `/api/dynopay/crypto-pay-domain`
- `/api/dynopay/crypto-pay-hosting`
- `/api/dynopay/crypto-pay-vps`
- `/api/dynopay/crypto-pay-upgrade-vps`
- `/api/dynopay/crypto-pay-phone`
- `/api/dynopay/crypto-pay-leads`
- `/api/dynopay/crypto-pay-digital-product`
- `/api/dynopay/crypto-pay-virtual-card`

**Underpayment behavior (NEW)**:
```javascript
const usdIn = await convert(value, coin, 'usd')  // Convert crypto to USD
if (usdIn < price) {
  addFundsTo(walletOf, chatId, 'usd', usdIn, lang)  // Credit wallet
  // Service NOT delivered
}
```

**Example**:
- Service costs: $50
- User pays: 0.0012 BTC (equivalent to $48 USD)
- Result: $48 credited to wallet, service NOT delivered

---

## Combined Payment Support ✅

### Users CAN combine methods:

**Scenario 1**: Partial wallet + Direct payment
1. User has $30 in wallet
2. Wants to buy $50 service
3. Options:
   - Pay $50 directly via Bank/Crypto (wallet untouched)
   - OR use wallet ($30 deducted) + system will require full $50 payment

**Scenario 2**: Build wallet balance first
1. Deposit $100 via Bank (NGN) → Converted to USD wallet
2. Deposit $50 via Crypto → Added to USD wallet
3. Wallet now has $150 USD
4. Buy services using wallet balance

---

## Key Points

### ✅ What Works:
1. **Direct service purchase with NGN** - Pays bank NGN, gets service instantly
2. **Direct service purchase with Crypto** - Pays crypto, gets service instantly
3. **Service purchase with USD wallet** - Uses existing wallet balance
4. **Deposit to wallet via NGN** - Converts NGN to USD wallet balance
5. **Deposit to wallet via Crypto** - Converts crypto to USD wallet balance

### ✅ Conversion Handled Automatically:
- NGN → USD (via OpenExchangeRates API + configurable markup)
- Crypto → USD (via BlockBee/Dynopay real-time rates)
- All final balances and charges are in USD

### ⚠️ Important Notes:
1. **System uses single USD wallet** - No dual currency balances
2. **NGN payments auto-convert** - User pays NGN, system stores USD
3. **Exact payment required** - No tolerance for underpayment (changed today)
4. **Overpayment refunded** - Excess amount credited to wallet

---

## Payment Method Selection UI

When user clicks to purchase, they see:

```
💰 Payment for [Service Name]
💵 Total: $XX.XX

Select payment method:
┌────────────────────┐
│  Crypto            │  ← Direct crypto payment
│  Bank ₦aira + Card │  ← Direct NGN payment  
│  👛 Wallet         │  ← Use USD wallet balance
│  ⬅️ Back           │
└────────────────────┘
```

**Hidden condition**: If `HIDE_BANK_PAYMENT=true` in .env, bank option is hidden.

---

## Code References

### Payment keyboard definition
**File**: `/app/js/lang/en.js`  
**Line**: 1257-1261
```javascript
const payIn = {
  crypto: 'Crypto',
  ...(HIDE_BANK_PAYMENT !== 'true' && { bank: 'Bank ₦aira + Card🏦💳' }),
  wallet: '👛 Wallet',
}
```

### Wallet payment handler
**File**: `/app/js/_index.js`  
**Line**: 5953+ (walletOk object)

### Bank payment webhooks
**File**: `/app/js/_index.js`  
**Lines**: 21804+ (bankApis object)

### Crypto payment webhooks
**File**: `/app/js/_index.js`  
**Lines**: 22646+ (BlockBee), 23286+ (Dynopay)

---

## Summary

**YES ✅** - Users can pay for services using:
- **Direct NGN payment** (bank transfer or card)
- **Direct Crypto payment** (BTC, ETH, USDT, etc.)
- **USD Wallet balance** (funded via NGN or Crypto deposits)

All three methods work independently and in combination. The system handles all currency conversions automatically and stores everything as USD for simplified accounting.

---

**Last Updated**: 2026-04-11
