# NGN Wallet Deposit Email Removal

**Date**: 2026-04-11  
**Change Type**: User Experience Improvement  
**Impact**: NGN wallet deposit flow simplified

---

## Problem

When users deposited to their wallet using NGN bank transfer, the system asked for their email address. This extra step was unnecessary since:
1. Email is only used for Fincra payment gateway metadata
2. Users already have a Telegram account (chatId is the primary identifier)
3. Extra friction in the deposit flow

---

## Solution

**Removed email prompt** - System now uses a predefined admin email from environment variables.

---

## Changes Made

### 1. Environment Variable Added

**Local** (`/app/backend/.env`):
```bash
DEPOSIT_EMAIL=noreply@nomadly.app
```

**Railway Production**:
```bash
DEPOSIT_EMAIL=noreply@nomadly.app
```
✅ Added via Railway GraphQL API

**Fallback logic**:
```javascript
const email = process.env.DEPOSIT_EMAIL || 
              process.env.SINGAPORE_ADMIN_EMAIL || 
              'deposits@nomadly.app'
```

---

### 2. Code Changes

#### **File**: `/app/js/_index.js`

**Change 1: Skip email prompt in deposit flow**

**Location**: Line ~13846  
**Before**:
```javascript
if (bankLabel && message === bankLabel) {
  // Bank (Naira) selected → ask for email then Fincra checkout
  return goto[a.askEmailForNGN]()
}
```

**After**:
```javascript
if (bankLabel && message === bankLabel) {
  // Bank (Naira) selected → proceed directly to checkout (no email prompt)
  return goto.showDepositNgnInfo()
}
```

---

**Change 2: Use env email instead of user input**

**Location**: Line ~4761  
**Before**:
```javascript
const email = info?.email  // User's email from input
```

**After**:
```javascript
const email = process.env.DEPOSIT_EMAIL || 
              process.env.SINGAPORE_ADMIN_EMAIL || 
              'deposits@nomadly.app'
```

---

**Change 3: Remove email validation handler**

**Location**: Line ~13874  
**Before**:
```javascript
if (action === a.askEmailForNGN) {
  if (message === t.back) return goto[a.depositMethodSelect]()
  
  const email = message
  if (!isValidEmail(email)) return send(chatId, t.askValidEmail)
  await saveInfo('email', email)
  return goto.showDepositNgnInfo()
}
```

**After**:
```javascript
// Email prompt handler removed - now uses DEPOSIT_EMAIL from .env
```

---

**Change 4: Update legacy flow**

**Location**: Line ~13872  
**Before**:
```javascript
return goto[a.askEmailForNGN]()  // Ask for email
```

**After**:
```javascript
return goto.showDepositNgnInfo()  // Skip email prompt
```

---

## New User Flow

### Before (4 steps):
```
1. User: "Deposit" 
2. User: "Bank (Naira)"
3. System: "Enter your email"
4. User: "user@example.com"
5. System: "Pay ₦65,000" → Payment link
```

### After (3 steps):
```
1. User: "Deposit"
2. User: "Bank (Naira)"  
3. System: "Pay ₦65,000" → Payment link
```

**Improvement**: 1 less step, faster deposit experience ✅

---

## Technical Details

### Email Usage in Fincra
The email passed to `createCheckout()` is used by Fincra for:
- Payment receipt (optional)
- Payment gateway metadata

**Impact of using admin email**:
- ✅ Payment still processes correctly
- ✅ User still gets Telegram notification
- ✅ Admin receives payment receipts (instead of user)
- ✅ No impact on wallet crediting or service delivery

---

## Testing Checklist

- [x] NGN deposit flow bypasses email prompt
- [x] Payment checkout URL generated correctly
- [x] Fincra webhook credits wallet correctly
- [x] User receives Telegram confirmation
- [x] Environment variable added to Railway
- [x] Service restarted successfully

---

## Environment Variables

### Production (Railway)
Ensure these are set:
- ✅ `DEPOSIT_EMAIL=noreply@nomadly.app`
- ✅ `API_KEY_CURRENCY_EXCHANGE=3082ac7c273f44b182f17e06b6d50490`
- ✅ All other existing variables preserved

---

## Rollback Instructions

If needed, restore email prompt:

1. **Revert code changes**:
```bash
# Line ~13846
if (bankLabel && message === bankLabel) {
  return goto[a.askEmailForNGN]()  // Restore email prompt
}

# Line ~4761
const email = info?.email  // Use user's email

# Line ~13874-13880
if (action === a.askEmailForNGN) {
  if (message === t.back) return goto[a.depositMethodSelect]()
  const email = message
  if (!isValidEmail(email)) return send(chatId, t.askValidEmail)
  await saveInfo('email', email)
  return goto.showDepositNgnInfo()
}
```

2. **Restart service**:
```bash
sudo supervisorctl restart nodejs
```

---

## Related Files

- `/app/js/_index.js` - Main bot logic (3 sections modified)
- `/app/backend/.env` - Added `DEPOSIT_EMAIL`
- Railway production environment - Added `DEPOSIT_EMAIL`

---

**Status**: ✅ Implemented and deployed  
**User Impact**: Positive - Faster deposit flow  
**Breaking Changes**: None
