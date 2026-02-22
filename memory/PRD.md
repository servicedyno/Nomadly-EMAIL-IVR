# Nomadly - PRD & Setup Log

## Original Problem Statement
1. Set up environment variables for the Nomadly application on Emergent pod
2. Investigate Railway deployment logs for phone number +18777000068
3. Fix SIP credentials "unauthorized" error for user johngambino
4. Fix bug where user's support message didn't reach admin bot
5. Fix underlying code bug: SIP credentials mismatch (local vs Telnyx-generated)
6. Add admin notification safety net for fallen-through support messages
7. Fix outbound SIP call failures ("Can not issue an answer command on an outbound call")

## Architecture
- **Application**: Node.js Telegram bot (`tg-bot-link-shorten`)
- **Repo**: Moxxcompany/NomadlyPhoneCloud (branch: WHM-Setup)
- **Database**: MongoDB on Railway (`caboose.proxy.rlwy.net:59668`)
- **Telephony**: Telnyx (SIP, Voice, SMS) + Twilio (SIP domains, bridge)
- **SIP Proxy**: `sip.speechcue.com` → Telnyx (192.76.120.10 = sip.telnyx.com)
- **Pod URL**: https://setup-wizard-113.preview.emergentagent.com

## What's Been Implemented

### Session 1: Environment Setup (Feb 22, 2026)
- 144 environment variables configured in backend `.env`
- SELF_URL set to current pod URL with /api

### Session 2: Bug Investigation & Data Fixes (Feb 22, 2026)
- Updated MongoDB SIP credentials for +18777000068 and +18556820054 with correct Telnyx values

### Session 3: Code Fixes - SIP Credentials + Support Chat (Feb 22, 2026)
**File: `js/_index.js`** (60 insertions, 20 deletions)
- Fix 1: SIP credentials — use Telnyx API response instead of local (4 locations)
- Fix 2: `/reply` handler re-opens support session
- Fix 3: Fallback admin notification for recent support sessions

### Session 4: Code Fixes - Outbound SIP Calls (Feb 22, 2026)
**File: `js/voice-service.js`** (78 insertions, 46 deletions)

#### Bug: "Can not issue an answer command on an outbound call"
**Root Cause (3 issues)**:
1. **SIP-originated detection too strict** (line 623): Only checked `rawFrom.startsWith('sip:')` but Telnyx sends `username@domain` without `sip:` prefix. Legitimate SIP calls were being IGNORED as "not SIP-originated".
2. **answerCall on outbound calls** (lines 650, 661, 675, 706): Multiple rejection paths tried `answerCall()` + `speakOnCall()` on outbound calls. Telnyx doesn't allow answering outbound calls — they're already live from the SIP client's perspective.
3. **Twilio bridge tried answerCall before transfer** (line 726): For Twilio numbers, the code answered the Telnyx leg before transferring to Twilio SIP. Fails on outbound calls.

**Fixes Applied**:
1. SIP detection: `rawFrom.startsWith('sip:') || rawFrom.includes('@')` — catches both `sip:user@domain` and `user@domain` formats
2. SIP username parsing: `rawFrom.replace(/^sip:/, '').split('@')[0]` — works for both formats
3. All rejection paths: Replaced `answerCall + speakOnCall + hangupCall` with direct `hangupCall` + Telegram notification to user
4. Twilio bridge: Skip `answerCall`, transfer directly — SIP leg is already live

## All Code Changes Summary
| File | Changes | Description |
|------|---------|-------------|
| `js/_index.js` | +60/-20 | SIP creds from Telnyx response, support session re-open, fallback admin notification |
| `js/voice-service.js` | +78/-46 | Fix SIP detection, remove answerCall from outbound paths, Telegram notifications |

## Prioritized Backlog
- P0: Deploy code changes to Railway (push to GitHub → auto-deploy)
- P1: Verify outbound SIP call works after deploy
- P1: Verify SIP credentials work for new phone purchases
- P2: Clean up orphaned Telnyx credentials
- P3: Migrate full app to Emergent pod

## Next Tasks
- Push code changes to GitHub → Railway auto-deploys from WHM-Setup branch
- Test johngambino's outbound call to +17866412370
- Verify new phone purchases store correct Telnyx SIP credentials
