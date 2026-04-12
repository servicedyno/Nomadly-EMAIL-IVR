# User Diagnostic Questions - BulkSMS App Issue

## Critical Information Needed from @Strew2t

Please ask @Strew2t to provide the following information:

### 1. App Version Check
**Question**: What version does the app show?
- Open Nomadly SMS app
- Look at the bottom of the login screen or settings
- Should show **v2.1.3**
- If it shows older version (2.1.0, 2.1.1, 2.1.2), please re-download from bot

### 2. Permission Status
**Question**: When you open the app, do you see a **yellow warning banner** at the top of the dashboard?

**If YES (yellow banner appears)**:
- What does the banner say?
- Did you click "Grant Now"?
- What happened after clicking?

**If NO (no banner)**:
- Go to Android Settings > Apps > Nomadly SMS > Permissions
- Is SMS permission set to "Allow"? (screenshot if possible)

### 3. Error Details
**Question**: When you try to send SMS, what EXACT error message appears in the app?

Examples:
- "SMS permission DENIED. Go to Android Settings..."
- "Sending Failed" with hint about SIM credit
- "generic_failure"
- Something else?

### 4. Manual SMS Test
**Question**: Can the device send SMS via the native/default Android SMS app?

**Test**:
1. Close Nomadly app
2. Open device's built-in SMS app (not Nomadly)
3. Try sending a manual SMS to any number
4. Did it send successfully?

### 5. Logs/Screenshots
**If possible, please provide**:
- Screenshot of the error message in Nomadly app
- Screenshot of the Permissions screen (Settings > Apps > Nomadly SMS > Permissions)
- Time when the test was performed (so we can check Railway logs)

---

## What We're Diagnosing

### Scenario A: Permission Not Granted
- App should show yellow banner
- Attempting to send should show: "SMS permission DENIED..."
- **No error report reaches server** (sending is blocked before attempt)

### Scenario B: Permission Granted, SIM Issue
- No yellow banner
- Attempting to send should show: "Sending Failed" with hint about SIM credit/carrier
- Error report reaches server with details

### Scenario C: Different Issue
- Need exact error message to diagnose

---

## Current Status from Logs

**Last Error Logged**: 12:51 UTC (over 2 hours ago)
- Error: `generic_failure`
- User: 5494831680
- Campaign: 06d5dfa2-01f4-4d76-ac98-20f0320354b5

**Since v2.1.3 deployment (14:40 UTC)**: NO new error reports in logs

This suggests either:
- User hasn't tested v2.1.3 yet
- User is being blocked by permission check (expected behavior)
- App needs to be reinstalled to pick up new version

---

## Immediate Action Items

1. **Confirm user downloaded v2.1.3** (version number visible in app)
2. **Check if yellow permission banner appears** (yes/no)
3. **If banner appears, grant permission** via "Grant Now" button
4. **Test manual SMS** from native app to verify SIM works
5. **Share exact error message** from app when attempting to send
6. **Note the time** of test so we can check Railway logs

Without this information, we're working blind. The logs show no recent activity, so we need to know what the user is actually experiencing.
