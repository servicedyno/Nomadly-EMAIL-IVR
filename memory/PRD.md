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
- **Database**: MongoDB on Railway
- **Telephony**: Telnyx (SIP, Voice, SMS) + Twilio (SIP domains, bridge)
- **SIP Proxy**: `sip.speechcue.com` → Telnyx (192.76.120.10)
- **Telnyx SIP Connection**: 2898118323872990714 (Nomadly Cloud Phone SIP)
- **Outbound Voice Profile**: 2897375459551478845

## All Changes Summary

| File | Changes | Description |
|------|---------|-------------|
| `js/_index.js` | +60/-20 | SIP creds from Telnyx response, support session re-open, fallback admin notification |
| `js/voice-service.js` | +71/-53 | Fix SIP detection, answerCall error handling, outbound hangup_cause logging, Telegram notifications |
| `js/telnyx-service.js` | +26/-3 | Auto-link outbound voice profile to SIP connection on startup |

### Critical Infrastructure Fix
- **Outbound Voice Profile was NULL on SIP Connection** → Telnyx couldn't route outbound calls to PSTN → all calls dropped instantly with 0 duration
- Fixed via API: `PATCH /credential_connections/{id}` with `outbound.outbound_voice_profile_id`
- Added startup check in `initializeTelnyxResources()` to auto-link profile if missing

### Code Fixes
1. **SIP credential mismatch** (4 locations in _index.js): Use Telnyx API response credentials
2. **Support session re-open**: `/reply` handler re-opens session + fallback notification
3. **SIP-originated detection**: Check `@` in from field, not just `sip:` prefix
4. **answerCall on outbound**: Replaced with `hangupCall` + Telegram notification
5. **Inbound handler**: Wrapped `answerCall` with try-catch, redirects to outbound handler on mismatch
6. **Outbound hangup logging**: Added `hangup_cause` and `hangup_source` to outbound call hangup logs

## Next Tasks
- Push all 3 files to GitHub → Railway auto-deploys
- Have johngambino retry outbound call after deploy
- Monitor logs for hangup_cause to diagnose if carrier-level issues persist
