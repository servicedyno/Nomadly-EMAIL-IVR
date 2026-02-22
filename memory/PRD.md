# Nomadly - PRD & Setup Log

## Original Problem Statement
1. Set up environment variables for the Nomadly application on Emergent pod
2. Investigate Railway deployment logs for phone number +18777000068
3. Fix SIP credentials "unauthorized" error for user johngambino
4. Fix bug where user's support message didn't reach admin bot

## Architecture
- **Application**: Node.js Telegram bot (running on Railway)
- **Database**: MongoDB on Railway (`caboose.proxy.rlwy.net:59668`)
- **Telephony**: Telnyx (SIP, Voice, SMS) + Twilio (SIP domains, backup)
- **SIP Proxy**: `sip.speechcue.com` → Telnyx (192.76.120.10 = sip.telnyx.com)
- **Pod URL**: https://setup-wizard-113.preview.emergentagent.com

## What's Been Implemented (Feb 22, 2026)

### Session 1: Environment Setup
- 144 environment variables configured in backend `.env`
- SELF_URL set to current pod URL with /api

### Session 2: Bug Investigation & Fixes

#### Bug 1: SIP "Unauthorized" - FIXED
**Root Cause**: The app creates Telnyx telephony credentials via API, but stores locally-generated usernames/passwords in MongoDB instead of the actual Telnyx-generated ones.
- MongoDB had: `sipUsername: sc_n1779q`, `sipPassword: OS7d3X1R7pkVPdRV`
- Telnyx actual: `sip_username: gencredkJZwdIwtDlUIepwmvF54J61vk58v9TBhVG2t3aIFSP`, `sip_password: 97cf928f8b564277927d441f7a4b4453`
- `sip.speechcue.com` resolves to Telnyx SIP (192.76.120.10), NOT Twilio (54.172.60.1)
- **Fix Applied**: Updated MongoDB `phoneNumbersOf` collection with correct Telnyx credentials for both numbers:
  - +18777000068 (user 817673476 / johngambino)
  - +18556820054 (user 5168006768)
- Also created Twilio SIP credential (as backup) in credential list CLfe5ba0b48274412e6e953eb58901c9ce

#### Bug 2: Support Message Not Reaching Admin - DIAGNOSED
**Root Cause**: User typed `/done` at 23:03:54 closing support session. Admin then replied at 23:05:16 with `/reply 817673476`. Message was delivered to user, but session wasn't re-opened. When user responded at 23:06:08 ("When I input my sip credentials..."), the bot treated it as a regular command (matched "SIP" keyword → showed CloudPhone menu) instead of forwarding to admin.
- Session state in MongoDB: `supportSessions._id: 817673476, val: 0` (closed)
- Bot state: `action: "none"` (default menu state)
- **Code Fix Needed**: The `/reply` command handler should re-open the support session when admin replies to a closed session. This requires access to the Node.js source code.

## Key Findings
- Railway deployment: `34ec6022-77f2-4695-8b01-2a9410d72149` (SUCCESS, Feb 22 2026)
- App: `tg-bot-link-shorten@1.0.0`, entry: `node js/start-bot.js`
- Telnyx SIP Connection: 2898118323872990714
- Twilio SIP Domain: speechcue-7937a0.sip.twilio.com (SDdb6525d35a1f09e4d1dfc19a2128ed96)
- 3 Telnyx SIP credentials found, all with auto-generated usernames (not matching MongoDB)

## Prioritized Backlog
- **P0**: Fix source code to store actual Telnyx SIP credentials instead of locally-generated ones (affects all future phone purchases)
- **P0**: Fix `/reply` command to re-open support session when admin replies after user closes session
- **P1**: Migrate Nomadly bot codebase to Emergent pod
- **P2**: Update all webhook URLs from Railway to Emergent pod
- **P3**: Clean up Twilio SIP credential lists (inconsistent data)

## Next Tasks
- Need access to the Node.js source code to fix the credential generation bug and support session bug
- User should test SIP with updated credentials (view "SIP Credentials" in bot for updated username)
