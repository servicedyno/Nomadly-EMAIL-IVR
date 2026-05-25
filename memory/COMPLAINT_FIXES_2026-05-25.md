# Customer Complaint Fix — 2026-05-25

## What was fixed

### Code (Node.js, deployed via `sudo supervisorctl restart nodejs`)

1. **Root-cause fix — auto-renew price validation** (`js/phone-scheduler.js`)
   - `attemptAutoRenew()` now computes the canonical price from `phoneConfig.plans[plan].price`
   - On mismatch (non-grandfathered): alerts admin group, self-heals the stored `planPrice`, and charges the canonical price
   - Sub-numbers have a separate floor check against `SUB_NUMBER_BASE_PRICE`
   - Invalid stored prices (≤0, null) abort the renewal with an admin alert instead of silently failing
   - Escape hatch: set `grandfathered: true` on a number doc to permanently lock the stored price

2. **Daily pricing reconciler** (`js/phone-scheduler.js` — new function `runPricingReconciler`)
   - Scheduled at 0:30 UTC daily
   - Scans every active phoneNumbersOf entry, emits a single admin digest of any anomalies
   - Quiet on no-anomaly days

3. **Audit-trail failure alert** (`js/_index.js`, `applyPhonePlanUpgrade()`)
   - The Apr-30-2026 @fuckthisapp incident happened because `phoneTransactions.insertOne()` failure was silent
   - Now sends an admin-group alert with all the upgrade details so backfill can happen within hours instead of weeks

4. **Escalation auto-resolution on session close** (`js/_index.js`)
   - New helper `resolveOpenEscalationsForChat()` called from both:
     - `aCS:` button (admin tapping ✖️ Close Session)
     - `/close <chatId>` command
   - Fixes the "every escalation has `resolvedAt: null`" metric bug. Pre-fix, the 15 most recent escalations were all stuck at `status=acknowledged` forever.

5. **AutoPromo log-noise reduction** (`js/auto-promo.js`)
   - GIF send failures with status 429 are no longer logged (text fallback handles them cleanly)
   - Cuts the top-of-hour log spam

### Data (applied via `/app/scripts/fix_johngambino_backcharge.js`, idempotent)

| Target | Before | After |
|---|---|---|
| chat=817673476 `+18884879051` planPrice | $15 | **$75** |
| chat=817673476 walletOf usdOut | $1671.015 | $1731.015 (+$60) |
| chat=817673476 wallet balance | $22.98 | **−$37.02** |
| `phoneTransactions` audit row | (missing) | inserted `back_charge_correction` $60 |
| chat=8273560746 `+18888370876`, `+18339561373` (released) | – | `grandfathered:true` (silences reconciler) |

User DM and admin group notification both delivered (Telegram `ok:true`).

## How to extend

- **Grandfather a customer at a comped price:** add `grandfathered:true` to that entry in `val.numbers[]`. The reconciler and auto-renew will skip price validation.
- **Re-run the fix safely:** the script checks for the `back_charge_correction` row and skips the wallet debit if it's already present. The planPrice self-heal is idempotent.
- **Verify state:** `python3 /app/scripts/full_pricing_audit.py` should report `Pricing anomalies: 0` on a healthy system.

## Files added
- `/app/COMPLAINT_ANALYSIS.md` — original analysis
- `/app/scripts/analyze_complaints.py`, `deep_complaints.py`, `ivr_upgrade_audit.py`, `ivr_user_detail.py`, `railway_upgrade_logs.py`, `full_pricing_audit.py` — investigation tools
- `/app/scripts/fix_johngambino_backcharge.js` — the one-time data fix
- `/app/scripts/notify_johngambino.js` — Telegram notification (already sent)
- `/app/memory/COMPLAINT_FIXES_2026-05-25.md` — this file

## Deferred (proposed but not done)
- "📊 Compare Plans" button before 🛒 Buy Phone Number — moderate scope
- First-time-user upgrade UX (Recode_x dead-end) — AI support already handles ad-hoc
- Domain DNS self-diagnosis — separate feature
- Media-aware escalation priority bump — separate feature
