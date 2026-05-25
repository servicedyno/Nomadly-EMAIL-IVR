# Bug Fix — Cloud IVR Address Purchase Failure (Australia)
**Incident:** 2026-05-25 10:02 UTC
**User:** @kathyserious (chat 8690991604)
**Amount in flight:** $91 (LTC → wallet → purchase)
**Outcome:** Refund auto-completed, fixes deployed, user notified.

## Root cause

Two compounding bugs in the Cloud IVR address-collection flow (`a.cpEnterAddress` handler in `js/_index.js`):

### Bug 1 — `refNgn is not defined` (ReferenceError)
```js
const { usdBal: refUsd } = await getBalance(walletOf, chatId)
// ...
send(chatId, `... ${t.showWallet(refUsd, refNgn)} ...`)  // ← refNgn never declared
```
The catch block tried to send a refund-confirmation message that interpolated `refNgn`, which was never destructured. The send crashed, so the user saw "🔄 Purchasing your number…" and then silence — no idea what happened.

`refNgn` was a holdover from when `t.showWallet()` took both USD + NGN. The current `showWallet()` (lang/en.js:902) takes only USD. The `refNgn` argument was dead code in 6 places.

### Bug 2 — Address parser ignored postal code
```js
const region = parts.length >= 4 ? parts[2] : ''
await twilioService.createAddress(name, street, city, region, '', countryCode, ...)
//                                                            ^^ postal_code was ALWAYS empty
```
- User was prompted with: `Street, City, Postal Code, Country` (4-part)
- Parser read `parts[2]` as **region** (state), but the user's `parts[2]` was actually the **postal code** per the prompt
- `postal_code` was hard-coded to `''`, which `twilio-service.js` then defaulted to `'00000'`
- Twilio AU rejected `'00000'` — AU postcodes are 1000–9999
- Result: every AU/UK/EU 4-part address was guaranteed to fail

## Fixes (deployed)

`js/_index.js` (`a.cpEnterAddress` handler):
1. **Up-front validation:** reject input with `<4` parts and send a localized error in en/fr/zh/hi explaining the format + an AU example, while keeping the pending payment intact so the user can simply re-send their address (no re-pay).
2. **Correct parsing:**
   ```js
   const street = parts[0]
   const city = parts[1]
   const postalCode = parts[parts.length - 2]    // second-to-last
   const region = parts.length >= 5 ? parts[2] : ''  // optional state (5+ parts)
   ```
3. **6 × `refNgn` removed** from `t.showWallet(refUsd, refNgn)` → `t.showWallet(refUsd)`.

## @kathyserious recovery

- Refund of $91 was auto-applied by the existing catch block ✅
- Current wallet: **$96 USD** (verified in prod)
- State is clean: `action: null`, no stale `cpPending*`
- DM sent: explained the bugs, confirmed $96 balance, gave AU-format example
- She can retry from Cloud IVR + SIP → Buy Phone Number → AU → Pay from Wallet, no re-pay needed

## How widespread was this?

Railway log search across the failing deployment (11fada3b…):
- `refNgn`: **1 hit** (only @kathyserious)
- `Address failed for`: **1 hit** (only @kathyserious)
- `cpEnterAddress`: **0 other hits**

She was the first AU buyer in this deployment window, hence the first to hit it.

## Files touched
- `js/_index.js` (address validation + refNgn removal)
- `scripts/investigate_kathyserious.py` (forensics)
- `scripts/notify_kathyserious.js` (Telegram outreach)
- `memory/KATHYSERIOUS_FIX_2026-05-25.md` (this file)
