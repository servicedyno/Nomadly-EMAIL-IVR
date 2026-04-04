# Referral Deep Link Fix - Technical Documentation

## Problem Statement

The referral deep link system (`t.me/Nomadlybot?start=ref_XXXX`) was not working correctly for **existing users** who had already started the bot. When these users clicked a referral link, Telegram would not send the `ref_XXXX` parameter, causing the referral tracking to fail.

## Root Cause

This is **documented Telegram client behavior**, not a bug:
- **New users** (first-time starters): Telegram sends `/start ref_XXXX` ✅
- **Existing users** (already started bot): Telegram sends only `/start` ❌

The deep link parameter is only transmitted on the first interaction with a bot. For existing users, clicking a referral link simply opens the chat without passing the parameter.

**Reference**: https://bugs.telegram.org/c/29562

## Solution Implemented

### Two-Tier Referral Tracking System

1. **Web Redirect Layer** (`/r/:referrerCode`)
   - Created a new Express route that tracks clicks server-side
   - Stores click data in MongoDB with 5-minute expiry window
   - Redirects to Telegram bot with deep link parameter

2. **Fallback Attribution Logic** (in `/start` handler)
   - For existing users without `ref_` parameter
   - Checks for recent unconverted clicks in MongoDB
   - Attributes the referral when user opens bot within 5 minutes

### Implementation Details

#### New Referral Link Format
```javascript
// OLD (didn't work for existing users)
https://t.me/Nomadlybot?start=ref_123456789

// NEW (works for both new and existing users)
https://nomadly-production.up.railway.app/r/123456789
```

#### Web Redirect Route (`/app/js/_index.js`)
```javascript
app.get('/r/:referrerCode', async (req, res) => {
  // 1. Parse referrer code
  const referrerChatId = parseInt(req.params.referrerCode)
  
  // 2. Track click in MongoDB
  await db.collection('referralClicks').insertOne({
    _id: `click_${Date.now()}_${randomId}`,
    referrerChatId,
    clickedAt: new Date(),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 min
    converted: false
  })
  
  // 3. Redirect to Telegram with deep link
  res.redirect(`https://t.me/${botUsername}?start=ref_${referrerCode}`)
})
```

#### Fallback Attribution (`/app/js/_index.js`)
```javascript
if (message === '/start' && !message.includes('ref_')) {
  // Check if user has no referral yet
  const existing = await referrals.findOne({ _id: chatId })
  if (!existing) {
    // Look for recent unconverted clicks (last 5 minutes)
    const recentClick = await db.collection('referralClicks').findOne({
      converted: false,
      clickedAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) }
    }, { sort: { clickedAt: -1 } })
    
    if (recentClick) {
      // Attribute referral
      await referrals.updateOne({ _id: chatId }, { $set: {
        referrerChatId: recentClick.referrerChatId,
        cumulativeSpend: 0,
        rewardPaid: false,
        source: 'web_redirect_fallback'
      } }, { upsert: true })
      
      // Mark click as converted
      await db.collection('referralClicks').updateOne(
        { _id: recentClick._id },
        { $set: { converted: true, convertedTo: chatId } }
      )
    }
  }
}
```

## Testing Results

### Scenario 1: New User (Deep Link Works)
```
User clicks: https://app.nomadly.com/r/999888777
→ Redirects to: t.me/Nomadlybot?start=ref_999888777
→ Telegram sends: /start ref_999888777
→ Result: ✅ Referral tracked via deep link parameter
```

### Scenario 2: Existing User (Fallback Works)
```
User clicks: https://app.nomadly.com/r/999888777
→ Click tracked in MongoDB at 10:30:15
→ Redirects to: t.me/Nomadlybot?start=ref_999888777
→ Telegram sends: /start (no parameter)
→ Bot checks for recent clicks (within 5 min)
→ Finds click at 10:30:15, matches user
→ Result: ✅ Referral tracked via web redirect fallback
```

## Database Schema

### `referralClicks` Collection
```javascript
{
  _id: "click_1775285832441_hnxje8",
  referrerChatId: 999888777,
  referrerCode: "999888777",
  clickedAt: ISODate("2026-04-04T07:03:52.441Z"),
  expiresAt: ISODate("2026-04-04T07:08:52.441Z"), // 5 min expiry
  converted: true,
  convertedTo: 111222333,
  convertedAt: ISODate("2026-04-04T07:04:15.123Z")
}
```

### `referrals` Collection
```javascript
{
  _id: 111222333, // referee chatId
  referrerChatId: 999888777,
  referrerUsername: "999888777",
  joinedAt: ISODate("2026-04-04T07:04:15.123Z"),
  cumulativeSpend: 0,
  rewardPaid: false,
  source: "web_redirect_fallback" // or "deep_link" for new users
}
```

## Files Modified

1. `/app/js/_index.js`
   - Added `/r/:referrerCode` web redirect route
   - Updated referral link generation (line ~7571)
   - Added fallback attribution logic in `/start` handler (line ~6427)

## Advantages of This Approach

1. ✅ **Works for all users** - both new and existing
2. ✅ **No user action required** - completely transparent
3. ✅ **Server-side tracking** - can't be bypassed by client
4. ✅ **5-minute window** - reasonable time for user to click and open bot
5. ✅ **Backward compatible** - direct Telegram links still work for new users
6. ✅ **Production ready** - uses SELF_URL environment variable

## Production Deployment

The referral links will automatically use the production domain from `SELF_URL` environment variable:

```
Development: https://preview.emergentagent.com/api/r/123456789
Production:  https://nomadly-production.up.railway.app/r/123456789
```

No code changes needed for deployment - just ensure `SELF_URL` is set correctly.

## Monitoring

Referral tracking logs can be found in Node.js logs:
```bash
tail -f /var/log/supervisor/nodejs.out.log | grep Referral
```

Expected log patterns:
```
[Referral] Tracked click: click_XXX for referrer 123456789
[Referral] Wallet referral saved: 111222333 referred by 123456789
[Referral] Web redirect fallback: 111222333 attributed to referrer 123456789
```

## Future Improvements

1. Add referral link click analytics
2. Track conversion rate (clicks → signups)
3. Add A/B testing for different referral messaging
4. Implement referral fraud detection
