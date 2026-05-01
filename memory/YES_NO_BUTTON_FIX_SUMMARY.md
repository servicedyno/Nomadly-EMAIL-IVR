# Yes/No Button Fix — askDomainToUseWithShortener Flow

**Date:** 2026-05-01
**Severity:** P0 (user-facing, users stuck in flow)
**File:** `/app/js/_index.js` lines 15464–15480

## Problem
Users reported that clicking **Yes** or **No** on the "Use this domain as a custom URL shortener?" prompt did nothing — the bot kept re-prompting.

## Root Cause
- Bot sends keyboard `[t.yes, t.no]` → displayed to user as **`✅ Yes`** / **`❌ No`** (emoji-prefixed).
- When the user tapped a button, Telegram returned the message text **`✅ Yes`**.
- The handler validated with `yesNo.includes(message)` where `yesNo = ['Yes', 'No']` (plain strings, **no emoji**).
- `['Yes', 'No'].includes('✅ Yes')` → `false`, so the bot responded with `t.what` and the user was stuck.

## Evidence (Railway prod logs)
```
2026-05-01T16:16:19Z | <prompt>... ✅ Yes,❌ No,↩️ Back,Back,Cancel  to: 7893016294
2026-05-01T16:16:26Z | message: ✅ Yes                              from: 7893016294
2026-05-01T16:17:27Z | <same prompt resent> ...                     (user stuck, retried)
```
User `7893016294` hit the dead-end at least 7 times over ~50 minutes.

## Fix
Replaced the brittle plain-text comparison with the already-existing robust matchers `isYesPress()` / `isNoPress()` (defined at `_index.js:1177` / `1189`) which handle:
- Emoji-prefixed: `✅ Yes`, `❌ No`, `✔️ Yes`
- Plain locales: `Yes`, `Oui`, `是`, `हाँ`
- Plain locales: `No`, `Non`, `否`, `नहीं`
- Confirm synonyms: `Confirm`, `Confirmer`, `确认`, `पुष्टि करें`

### Diff
```diff
   if (action === a.askDomainToUseWithShortener) {
-    const yesNo = trans('yesNo')
     if (isBackPress(message)) return goto['choose-domain-to-buy']()
-    if (!yesNo.includes(message)) return send(chatId, t.what)
-    saveInfo('askDomainToUseWithShortener', message === yesNo[0])
+    const yesPressed = isYesPress(message)
+    const noPressed = isNoPress(message)
+    if (!yesPressed && !noPressed) return send(chatId, t.what)
+    saveInfo('askDomainToUseWithShortener', yesPressed)

     // Yes = shortener: skip NS selection, use Cloudflare for DNS management
-    if (message === yesNo[0]) {
+    if (yesPressed) {
       saveInfo('nsChoice', 'cloudflare')
       return goto['domain-pay']()
     }
     // No = no shortener: show NS selection
     return goto.domainNsSelect()
   }
```

## Audit of other Yes/No flows (no action needed)
| Line | Action | Keyboard | Validation | Status |
|------|--------|----------|------------|--------|
| 9955 | `adminConfirmMessage` | `[t.yes, t.no]` emoji | `isNoPress` + `message !== t.yes` | ✅ OK |
| 15823 | `get-free-domain` | `[t.yes, t.no]` emoji | `isNoPress` + `message !== t.yes` | ✅ OK |
| 16373 | `confirm-switch-to-cloudflare` | `yes_no` plain | `isNoPress` + `message !== t.yes && !== 'Yes'` | ✅ OK |
| 16412 | `confirm-switch-to-provider-default` | `[t.yes, t.no]` emoji | `isNoPress` + `message !== t.yes && !== 'Yes'` | ✅ OK |
| 16539 | `confirm-dns-record-id-to-delete` | `[t.yes, t.no]` emoji | `isNoPress` + `message !== t.yes` | ✅ OK |
| 17109 | `dns-confirm-conflict-replace` | `[t.yes, t.no]` emoji | `isNoPress` + `message !== t.yes && !== 'Yes'` | ✅ OK |
| 17371 | `walletSelectCurrencyConfirm` | `[t.yes], [t.no]` emoji | `isNoPress` + `message !== t.yes` | ✅ OK |
| 25827 | `listen_reset_login` | `yes_no` plain | `isYesPress` | ✅ OK |

Only **one** handler was broken (the shortener prompt). All others already used either `message !== t.yes` (matches the emoji keyboard buttons) or the robust matchers.

## Verification
- ✅ Lint passes (`mcp_lint_javascript` — 0 issues)
- ✅ Node.js service restarted cleanly, webhook re-registered
- ✅ Matcher unit test confirmed `isYesPress('✅ Yes')` → `true`, `isNoPress('❌ No')` → `true` in all 4 languages (en/fr/zh/hi)

## Production Deployment
The fix is applied in **dev** (`/app/js/_index.js`). Production runs on Railway and will auto-deploy when the commit lands on the connected branch — use the **Save to GitHub** button in Emergent to push.
