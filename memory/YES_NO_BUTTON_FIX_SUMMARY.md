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

## Follow-up refactor — defence-in-depth across ALL Yes/No handlers

After the initial fix, **all** confirmation handlers were migrated to the robust
`isYesPress()` / `isNoPress()` matchers so no future keyboard-text change can
silently break them. Each of these lines previously relied on brittle
`message !== t.yes` / `message === 'No'` string comparisons:

| Line | Action | Before | After |
|------|--------|--------|-------|
| 9956 | `adminConfirmMessage` | `message !== t.yes` | `!isYesPress(message)` |
| 15825 | `get-free-domain` | `message !== t.yes` | `!isYesPress(message)` |
| 16374–75 | `confirm-switch-to-cloudflare` | `message === 'No'` / `message !== t.yes && !== 'Yes'` | `isNoPress(message)` / `!isYesPress(message)` |
| 16413–14 | `confirm-switch-to-provider-default` | same as above | same refactor |
| 16541 | `confirm-dns-record-id-to-delete` | `message !== t.yes` | `!isYesPress(message)` |
| 17110–13 | `dns-confirm-conflict-replace` | `message === 'No'` / `message !== t.yes && !== 'Yes'` | `isNoPress(message)` / `!isYesPress(message)` |
| 17394 | `walletSelectCurrencyConfirm` | `message !== t.yes` | `!isYesPress(message)` |
| 25828 | `listen_reset_login` | already `isYesPress` | no change |

Every confirmation prompt now accepts emoji-prefixed, plain, and multilingual
(EN / FR / ZH / HI) Yes/No in a single consistent idiom.

## Verification
- ✅ Lint passes (`mcp_lint_javascript` — 0 issues)
- ✅ Node.js service restarted cleanly, webhook re-registered, zero startup errors
- ✅ Matcher unit test confirmed `isYesPress('✅ Yes')` → `true`, `isNoPress('❌ No')` → `true` in all 4 languages (en/fr/zh/hi)
- ✅ **Targeted Yes/No regression test** (`/app/test_yes_no_flows.py`) — 12/12 pass (all button-text variants across 4 languages + end-to-end `askDomainToUseWithShortener` flow)
- ✅ **Comprehensive webhook simulator** (`/app/webhook_sim.py`) — 128/128 pass across EN/FR/ZH/HI (main menu, domain/wallet submenus, digital-products, virtual-card, anti-red hosting, subscriptions, reseller, back/cancel navigation, buy-leads flow, validate-numbers, support)
- ✅ Driven via `@hostbay_support` (chatId 5168006768) — existing test identity baked into the simulator

## Production Deployment
The fix is applied in **dev** (`/app/js/_index.js`). Production runs on Railway and will auto-deploy when the commit lands on the connected branch — use the **Save to GitHub** button in Emergent to push.
