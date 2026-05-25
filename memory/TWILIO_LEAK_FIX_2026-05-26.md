# Twilio White-Label Brand Leak Fix — 2026-05-26

## Issue Reported
User `@kathyserious` (a CloudIVR Australian-number purchaser) realized that the Nomadly bot uses **Twilio** under the hood, breaking the white-label promise.

## Root Cause
The **"📤 Test Outbound SIP"** success message exposed the raw provider name in plain sight:

```
✅ Outbound SIP verified

📞 Number: +1...
🔑 SIP user: gencredABC
🌐 Provider: twilio        ←  LEAK ❌
📍 You dialed: +1...
⏱️ Latency to our servers: 0.3s
```

The provider value (`twilio` or `telnyx`) flowed from `voice-service.js#handleOutboundSipCall` → `matchPendingTest(...)` in `test-outbound-sip.js`, then was passed verbatim into the localized `testOutboundSip.success` template in `phone-config.js` (all 4 locales: en/fr/zh/hi).

This same flow exists in the fallback hardcoded English message at `test-outbound-sip.js:202`.

## Fix
**File: `js/test-outbound-sip.js`** (single source of truth — fixes all 4 locales at once).

Added a sanitizer that maps the raw carrier brand to the public-facing brand BEFORE the value enters any user-visible template:

```js
const userVisibleProvider = (
  provider === 'twilio' || provider === 'telnyx' ||
  provider === 'Twilio' || provider === 'Telnyx'
) ? 'Speechcue' : provider
```

The sanitized value (`Speechcue` — matches the SIP domain already shown to users: `sip.speechcue.com`) is passed to:
1. The localized `testOutboundSip.success` template (en/fr/zh/hi).
2. The hardcoded English fallback message.

Internal `_log(...)` still keeps the raw provider for debugging — only the user-visible text changes.

## Verification
- Created regression test `js/tests/test_twilio_brand_leak_fix.js` — 66 assertions, all pass.
- Existing test suite `js/tests/test_test_outbound_sip.js` — 68 assertions, all pass.
- After-fix message:
```
🌐 Provider: Speechcue       ←  CLEAN ✅
```

## Other Twilio Mentions Audited (Intentional — NOT Leaks)
- `js/auto-promo.js`, `js/lang/*.js` digital-products promos → Twilio accounts are SOLD as actual digital products; users buy login credentials. Brand mention is intentional.
- `js/ai-support.js` line 381–382 → same Digital Products SKU listing.
- `js/balance-monitor.js`, `js/phone-monitor.js` → admin-only alerts (already provider-neutral user message via `phoneCallerIdFlaggedBody`).
- `js/twilio-service.js` + `js/_index.js` `cpEnterAddress` errors → already routed through `sanitizeProviderError()` (existing helper at `js/sanitize-provider.js`).

## Files Changed
- `js/test-outbound-sip.js` — added `userVisibleProvider` sanitizer (lines 182–188, 209, 210).
- `js/tests/test_twilio_brand_leak_fix.js` — new regression test (66 assertions).

## Deployment
- Restarted Node.js bot via `sudo supervisorctl restart nodejs`. Confirmed running and webhook verified.
