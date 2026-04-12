# BulkSMS App - Generic Failure Error Analysis

## Current Status (v2.1.2)
**Error Observed**: `generic_failure` (Android SmsManager error code `SmsManager.RESULT_ERROR_GENERIC_FAILURE`)

## What is "generic_failure"?

This is an Android system error returned by `SmsManager.sendTextMessage()` or `SmsManager.sendMultipartTextMessage()` when the SMS operation fails for carrier-related or system-level reasons.

## Common Causes (Most to Least Likely)

### 1. **SIM Card Has No SMS Credit/Balance** ⭐ MOST LIKELY
- **Symptom**: All messages fail immediately with `generic_failure`
- **Fix**: Add SMS credit to the SIM card (contact carrier)
- **Test**: Send a manual SMS from the device's native SMS app to verify SIM can send

### 2. **Carrier Rate Limiting / Spam Detection**
- **Symptom**: First few SMS succeed, then all fail with `generic_failure`
- **Fix**: Wait 5-30 minutes before retrying. Reduce send rate (increase gap time between messages)
- **Prevention**: Use gap time of 10+ seconds between messages

### 3. **Invalid Phone Number Format**
- **Symptom**: Only specific numbers fail
- **Fix**: Ensure all numbers include country code (e.g., +1234567890)
- **Test**: Try sending to a known-valid number

### 4. **Carrier Blocking Bulk SMS**
- **Symptom**: Manual SMS works, but app-sent SMS fails
- **Fix**: Contact carrier to enable "developer mode" or use a different SIM
- **Note**: Some carriers block SMS from third-party apps

### 5. **Device/Android SMS Limits**
- **Symptom**: Works for a few messages, then fails
- **Fix**: Some Android versions limit SMS per hour (e.g., 100/hour). Wait and retry.

### 6. **Network Issues (Temporary)**
- **Symptom**: Intermittent failures
- **Fix**: Check cellular signal strength. Retry in better coverage area.

## Debugging Steps for @Strew2t

### ✅ Step 1: Verify SIM Can Send SMS
1. Open device's **native SMS app** (not Nomadly)
2. Send a manual SMS to any number
3. **If this fails** → SIM has no credit OR carrier issue
4. **If this works** → Continue to Step 2

### ✅ Step 2: Check App Version
1. Open Nomadly SMS app
2. Check version in the app (should show **2.1.2**)
3. If older version, re-download from bot

### ✅ Step 3: Check Permissions
1. Go to **Android Settings** → **Apps** → **Nomadly SMS**
2. **Permissions** → Ensure **SMS** permission is **Allowed**
3. Retry sending

### ✅ Step 4: Test with Single Message
1. Create a test campaign with **ONLY 1 contact**
2. Set **Gap Time to 10 seconds**
3. Try sending
4. Check Railway logs for detailed error

### ✅ Step 5: Check Phone Number Format
- Ensure numbers include country code: `+1234567890` not `234567890`
- Remove spaces, dashes, parentheses

## What v2.1.2 Improves

1. **Enhanced Error Logging**: Now logs full Java exception details including `exceptionType`
2. **Better Error Reporting**: Server logs will show detailed error messages, not just codes
3. **User-Friendly Hints**: App now shows actionable advice for `generic_failure`:
   ```
   SMS blocked by carrier. Common causes:
   • SIM has no SMS credit/balance
   • Carrier rate limit (try waiting 5+ min)
   • Invalid phone number format
   • Carrier spam filter (contact your mobile provider)
   ```

## Next Steps

**For User (@Strew2t)**: 
1. Download and install **v2.1.2** from the bot
2. Follow debugging steps above
3. Report which step reveals the issue

**For Developer**: 
Once @Strew2t tests v2.1.2 and shares the Railway logs, we'll see:
- Detailed Java exception message (if any)
- Exception type (SecurityException, IllegalArgumentException, etc.)
- Whether the issue is SIM credit, carrier blocking, or something else

## Expected Railway Log Output (v2.1.2)

Before (v2.1.0):
```
[SmsApp] Error: generic_failure × 1 — user: 5494831680, campaign: xxx
```

After (v2.1.2):
```
[SmsApp] Error: generic_failure × 1 | Detail: <actual Java error message> — user: 5494831680, campaign: xxx
```

---

**Hypothesis**: Based on "all messages failing immediately", the most likely cause is **SIM card has no SMS credit/balance**. Recommend @Strew2t verify SIM can send manual SMS first.
