# Wallet Top-Up Notification Issues

## User's Observation (Railway Logs)

```
💰 Wallet Top-Up!
User tw*** just loaded their wallet and is ready to buy domains, leads & more.
Fund yours in seconds — /start
— Nomadly Bot
```

**Problems Identified:**
1. ❌ **Missing payment method** - Can't tell if user paid via Bank NGN, Crypto (BlockBee), or Crypto (DynoPay)
2. ❌ **Duplicate notifications** - Sent to BOTH group AND admin (redundant if admin is in the group)

---

## Root Cause Analysis

### Issue 1: Payment Method Not Shown

**Current Code (3 locations):**

All three payment methods send **identical** notifications:

```javascript
// Line 22812 - Bank NGN
notifyGroup(`💰 <b>Wallet Top-Up!</b>\nUser ${maskName(name)} just loaded their wallet and is ready to buy domains, leads & more.\nFund yours in seconds — /start`)

// Line 23663 - BlockBee Crypto  
notifyGroup(`💰 <b>Wallet Top-Up!</b>\nUser ${maskName(name)} just loaded their wallet and is ready to buy domains, leads & more.\nFund yours in seconds — /start`)

// Line 24418 - DynoPay Crypto
notifyGroup(`💰 <b>Wallet Top-Up!</b>\nUser ${maskName(name)} just loaded their wallet and is ready to buy domains, leads & more.\nFund yours in seconds — /start`)
```

**Problem:** 
- Impossible to tell which payment gateway was used
- Amount not shown in notification (though it's logged in `payments` collection)
- Payment data exists but not included in message:
  - Bank NGN: `${ngnIn} NGN` converted to `$${usdIn}`
  - BlockBee: `${value} ${coin}` converted to `$${usdIn}`
  - DynoPay: `${value} ${coin}` converted to `$${usdIn}`

---

### Issue 2: Duplicate Notifications

**How `notifyGroup()` Works:**

```javascript
const notifyGroup = async (message) => {
  const sentTo = new Set()

  // 1. Send to TELEGRAM_NOTIFY_GROUP_ID (if set)
  if (TELEGRAM_NOTIFY_GROUP_ID) {
    sentTo.add(Number(TELEGRAM_NOTIFY_GROUP_ID))
    bot.sendMessage(TELEGRAM_NOTIFY_GROUP_ID, message)
  }

  // 2. ALWAYS send to TELEGRAM_ADMIN_CHAT_ID (if different from group)
  if (TELEGRAM_ADMIN_CHAT_ID && !sentTo.has(Number(TELEGRAM_ADMIN_CHAT_ID))) {
    sentTo.add(Number(TELEGRAM_ADMIN_CHAT_ID))
    bot.sendMessage(TELEGRAM_ADMIN_CHAT_ID, message)
  }

  // 3. Send to all auto-registered groups
  const groups = await notifyGroupsCol.find({}).toArray()
  for (const group of groups) {
    if (!sentTo.has(group._id)) {
      bot.sendMessage(group._id, message)
    }
  }
}
```

**Problem:**
- Function sends to BOTH `TELEGRAM_NOTIFY_GROUP_ID` AND `TELEGRAM_ADMIN_CHAT_ID`
- If admin is already in the notification group, they receive **duplicate messages**
- The deduplication (`sentTo.has()`) only works if the IDs are identical
- **BUT** if `TELEGRAM_NOTIFY_GROUP_ID` is a GROUP ID and `TELEGRAM_ADMIN_CHAT_ID` is a USER ID, they're different numbers, so both get notified

**This is actually BY DESIGN** - ensures admin always gets notified even if group notification fails. However, if the group notification includes the admin, it feels redundant.

---

## Recommended Fixes

### Fix 1: Add Payment Method & Amount to Notification

**Enhanced Notification Messages:**

```javascript
// Bank NGN (Line 22812)
notifyGroup(`💰 <b>Wallet Top-Up!</b>
User ${maskName(name)} just loaded <b>$${usdIn.toFixed(2)}</b> via <b>🏦 Bank Transfer</b> (${ngnIn} NGN)
Fund yours in seconds — /start`)

// BlockBee Crypto (Line 23663)
notifyGroup(`💰 <b>Wallet Top-Up!</b>
User ${maskName(name)} just loaded <b>$${usdIn.toFixed(2)}</b> via <b>₿ Crypto</b> (${value} ${coin.toUpperCase()})
Fund yours in seconds — /start`)

// DynoPay Crypto (Line 24418)
notifyGroup(`💰 <b>Wallet Top-Up!</b>
User ${maskName(name)} just loaded <b>$${usdIn.toFixed(2)}</b> via <b>💎 DynoPay</b> (${value} ${coin.toUpperCase()})
Fund yours in seconds — /start`)
```

**Benefits:**
- ✅ Clear payment method identification
- ✅ Shows USD amount immediately
- ✅ Shows original currency amount
- ✅ Helps admin understand payment flow trends

---

### Fix 2: Reduce Duplicate Notifications (Optional)

**Option A: Keep Current Behavior**
- Leave as-is (by design for reliability)
- Admin gets notified in group + private message
- Ensures critical notifications aren't missed

**Option B: Smart Deduplication**
- Only send to admin privately if they're NOT in the notification group
- Requires checking group membership via Telegram API
- More complex, may not be worth it

**Option C: Add Admin-Only Details**
- Public group: Generic notification (no sensitive data)
- Admin private: Full details including chatId, exact amount, payment reference

**Recommended: Option C** - Different message content:

```javascript
// Public group notification
notifyGroup(`💰 <b>Wallet Top-Up!</b>
User ${maskName(name)} just loaded $${usdIn.toFixed(2)} via Bank Transfer
Fund yours in seconds — /start`)

// Private admin notification (more details)
sendMessage(TELEGRAM_ADMIN_CHAT_ID, `💰 <b>Wallet Top-Up - Admin Details</b>

👤 User: ${name} (ID: ${chatId})
💵 Amount: $${usdIn.toFixed(2)} (${ngnIn} NGN)
💳 Method: Bank Transfer
📅 Date: ${new Date().toLocaleString()}
🔗 Payment Ref: ${ref}`, { parse_mode: 'HTML' })
```

---

## Implementation Priority

### High Priority (Implement Now)
✅ **Fix 1: Add payment method & amount to notifications**
- Simple change, high value
- Makes notifications actually useful for admin
- No downside

### Low Priority (Consider Later)
⚠️ **Fix 2: Duplicate notification handling**
- Current behavior is by design (reliability)
- Admin can mute group notifications if desired
- Not critical unless admin complains

---

## Code Locations

**Files to Modify:**
- `/app/js/_index.js`
  - Line 22812: Bank NGN notification
  - Line 23663: BlockBee notification
  - Line 24418: DynoPay notification

**Payment Methods Available:**
1. **Bank NGN** (`/bank-pay-wallet` webhook)
2. **Crypto (BlockBee)** (`/crypto-pay-wallet` webhook)
3. **Crypto (DynoPay)** (`/dynopay-webhook` for wallet top-ups)

---

## Current Payment Data Logged

All three methods already log payment details to `payments` collection:

```javascript
// Bank NGN
set(payments, ref, `Bank,Wallet,wallet,$${usdIn},${chatId},${name},${new Date()},${ngnIn} NGN`)

// BlockBee
set(payments, ref, `Crypto,Wallet,wallet,$${usdIn},${chatId},${name},${new Date()},${value} ${coin}`)

// DynoPay
set(payments, ref, `Crypto,Wallet,wallet,$${usdIn},${chatId},${name},${new Date()},${value} ${coin},transaction,${id}`)
```

**The data exists - just not shown in notifications!**

---

## Summary

**Current State:**
- ❌ Can't identify payment method from notification
- ❌ Amount not shown
- ⚠️ Duplicate to group + admin (by design, but feels redundant)

**Recommended Action:**
1. ✅ Add payment method + amount to notification (high value, low effort)
2. ⚠️ Consider admin-only detailed message with sensitive info (optional enhancement)
3. ⚠️ Keep duplicate behavior as-is for reliability (unless admin requests change)
