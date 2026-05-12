# BulkSMS `[name]` placeholder fixes (4 bugs)

## Incident
- chatId `7080940684` opened a support session at 2026-05-12T09:10 complaining
  `[name]` was not being substituted in BulkSMS test campaigns.
- The AI replied 4 times with hallucinated answers (CNAM, lead orders, settings
  panel) — none of which are relevant to the actual root causes.

## Root causes (found by reading prod `smsCampaigns` for this user)

### Bug A — Contact parser silently mis-parses space-separated lines
`sms-app/www/js/app.js:855-866` (old):
```js
const parts = line.split(',').map(p => p.trim())
const phone = (parts[0] || '').replace(/[^+\d]/g, '')
if (phone.length >= 7) {
  contacts.push({ phoneNumber: parts[0].trim(), name: parts.slice(1).join(',').trim() || '' })
}
```
Input `+12138686239 Steve Edith` (no comma) → `phoneNumber = "+12138686239 Steve Edith"`, `name = ""`.
- SMS sent to non-existent recipient
- `[name]` substituted with `''`
- User sees the issue but app gives no feedback

### Bug B — Only `[name]` syntax recognised
Users intuitively try `{name}`, `<name>`, `%name%`, `$name`. The hard-coded
`/\[name\]/gi` regex left those tokens literal. Confirmed in user's campaign
`Yy` (2026-05-12T09:00): template was `Hi {name}, …` → curly braces never
substituted.

### Bug C — AI support KB has no entry on this
`ai-support.js` SYSTEM_PROMPT had 0 mentions of `[name]` substitution. The
LLM filled the gap with a confident but wrong CNAM theory.

### Bug D — Review screen hides the failure
`populateReview` previewed with `sampleName = 'there'` whenever the first
contact had no name. User couldn't see the broken substitution until SMS hit
their phone.

## Fixes applied

### A. Contact parser (`app.js` parseContacts)
- Two-stage parse: first try `\t` or `,` as delimiter; fall back to whitespace
  after a phone-like token.
- `phoneNumber` is now the digit-only form (`+12138686239` not the verbatim
  line) — eliminates the "SMS to garbage number" mode.
- Tolerates spaces/parens/dashes inside the phone field
  (`+1 (213) 868-6239 Steve` → `+12138686239` / `Steve`).

### B. Multi-syntax substitution (`app.js` new helpers)
- New `App._substituteName(template, name)` — accepts `[name]`, `{name}`,
  `<name>`, `%name%`, `$name`, `$$name`, case-insensitive.
- Two call sites (`populateReview`, `processNextContact`) now use the helper.

### C. AI support KB entry (`ai-support.js`)
- New section `"[name] is not working in my BulkSMS message"`
- Explicit guard rail: **"Do NOT tell users that [name] uses CNAM lookup — it
  does NOT. CNAM is only for the Phone Leads flow."**
- 4-step diagnostic checklist for the AI to walk users through.
- Tells AI to recommend v2.7.6+.

### D. Review-screen warning banner (`index.html` + `app.js` populateReview)
- New `<div id="rvNameWarning">` element below the preview, only shown when:
  1. Template uses variant-only syntax (`{name}` etc.) → "Use [name] instead"
  2. All contacts missing names → "[name] will be blank in every SMS"
  3. Some contacts missing names → "N of M contacts have no name"

### Version bump
- `package.json`: 2.7.4 → 2.7.6
- `index.html` meta: 2.7.5 → 2.7.6
- Triggers the existing `versionsBehind ≥ 1` reminder in `sms-app-service.js`
  so users on the broken APK get nudged to update.

## Verification
- `node /app/scripts/test_bulksms_placeholders.js` → 23/23 pass
- `node /app/scripts/test_ai_support_bulksms_kb.js` → 7/7 pass
- `pytest /app/backend/tests/test_bulksms_placeholder_fixes.py` → 6/6 pass
- `pytest /app/backend/tests/test_stall_detector.py` → 4/4 pass (regression OK)
- `pytest /app/backend/tests/test_phoneGenTimeout_fix.py` → 3/3 pass (regression OK)
- Total: 13/13 pytest, 30/30 JS unit assertions.
- Lint: clean (`app.js`, `ai-support.js`)
- Node.js service restarts clean (no syntax/import errors).

## Railway deploy steps (your turn)
1. Push via **Save to GitHub** in chat. Railway auto-deploys the bot (so the
   new AI support KB goes live immediately).
2. ✅ **APK rebuilt and deployed locally** (2026-05-12T09:41 UTC):
   - APK: 3.82 MB (md5 `a4877161be1dd40afd142c4a504cd636`)
   - Bundled version: `2.7.6` (verified inside `assets/public/index.html`)
   - All 4 fixes confirmed inside the APK (`_substituteName` × 7,
     `explicitMatch/phoneDigits` × 7, `rvNameWarning` in both HTML + JS)
   - Served at `GET /api/sms-app/download` (FastAPI proxy) — verified e2e:
     200 OK, 3 823 287 bytes streamed, md5 matches local file
   - Locations: `/app/backend/static/nomadly-sms.apk` and
     `/app/static/nomadly-sms.apk` (both updated)
3. **Save to GitHub** also pushes the updated APK + source so Railway serves the
   same file. Once new APK is live, users on older versions get the
   `versionsBehind ≥ 1` nag via `sms-app-service.js:878-895`.

### Build command (for future rebuilds)
```bash
bash /app/scripts/build_apk.sh
# tail -f /tmp/apk_build.log
```
Idempotent — skips SDK/aapt2 install if already present. ~2 min on a clean
pod, ~30 s if SDK is cached.

## Files touched
- `sms-app/www/js/app.js` — new helpers (`_substituteName`,
  `_templateHasPlaceholder`, `_templateHasVariantOnly`), patched
  `parseContacts`, patched `populateReview`, patched `processNextContact`.
- `sms-app/www/index.html` — `#rvNameWarning` banner, hint copy, version bump.
- `sms-app/package.json` — version bump.
- `js/ai-support.js` — new BulkSMS `[name]` KB entry.
- `scripts/test_bulksms_placeholders.js` — NEW (23 JS unit tests).
- `scripts/test_ai_support_bulksms_kb.js` — NEW (7 KB assertions).
- `backend/tests/test_bulksms_placeholder_fixes.py` — NEW (6 pytest wrappers).
