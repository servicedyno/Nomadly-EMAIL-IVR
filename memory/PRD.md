# Nomadly - PRD & Setup Log

## Original Problem Statement
1. Set up environment variables for the Nomadly application on Emergent pod
2. Investigate Railway deployment logs for phone number +18777000068
3. Fix SIP credentials "unauthorized" error for user johngambino
4. Fix bug where user's support message didn't reach admin bot
5. Fix underlying code bug: SIP credentials mismatch (local vs Telnyx-generated)
6. Add admin notification safety net for fallen-through support messages

## Architecture
- **Application**: Node.js Telegram bot (`tg-bot-link-shorten`)
- **Repo**: Moxxcompany/NomadlyPhoneCloud (branch: WHM-Setup)
- **Database**: MongoDB on Railway (`caboose.proxy.rlwy.net:59668`)
- **Telephony**: Telnyx (SIP, Voice, SMS) + Twilio (SIP domains, backup)
- **SIP Proxy**: `sip.speechcue.com` → Telnyx (192.76.120.10 = sip.telnyx.com)
- **Pod URL**: https://setup-wizard-113.preview.emergentagent.com

## What's Been Implemented

### Session 1: Environment Setup (Feb 22, 2026)
- 144 environment variables configured in backend `.env`
- SELF_URL set to current pod URL with /api

### Session 2: Bug Investigation & Data Fixes (Feb 22, 2026)
- Updated MongoDB SIP credentials for +18777000068 and +18556820054 with correct Telnyx values
- Created Twilio SIP credential in credential list CLfe5ba0b48274412e6e953eb58901c9ce

### Session 3: Code Fixes (Feb 22, 2026)
**File changed**: `js/_index.js` (60 insertions, 20 deletions)

#### Fix 1: SIP Credentials — Use Telnyx API Response (4 locations)
- **Line 566-579**: Twilio purchase with dual SIP — now captures `telnyxCred` response and uses `sip_username`/`sip_password` from Telnyx
- **Line 3509-3518**: Telnyx purchase (main wallet flow) — same fix
- **Line 11616-11626**: Bank NGN Telnyx purchase — same fix
- **Line 9740-9765**: SIP password reset — uses Telnyx-returned credentials, updates username if changed

#### Fix 2: Support Session Re-open on Admin `/reply` (Line 1156-1165)
- `/reply` handler now re-opens the support session (`supportSessions` + `state.action = 'supportChat'`)
- Also shows `/done` keyboard to user when admin replies

#### Fix 3: Fallback Admin Notification (Line 10811-10823)
- When unrecognized message comes from a user with a support session within the last hour
- Forwards the message to admin with "Missed support message" alert
- Re-opens the session automatically
- User gets confirmation message with `/done` keyboard

## Prioritized Backlog
- P0: Deploy code changes to Railway (push to GitHub → auto-deploy)
- P1: Verify SIP credentials work for johngambino after code deploy
- P2: Clean up orphaned Telnyx credentials (auto-generated ones that don't match any number)
- P3: Migrate full app to Emergent pod

## Next Tasks
- Push code changes to GitHub (use "Save to Github" feature)
- Railway will auto-deploy from WHM-Setup branch
- Verify the fix with a test phone number purchase
