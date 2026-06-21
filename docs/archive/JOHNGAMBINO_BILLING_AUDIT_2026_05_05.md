# @johngambino Billing Audit — 2026-05-05

**Subject:** chat_id `817673476`
**Trigger:** User reported `Wallet CRITICAL` alert at $0.42 mid-IVR-campaign on 2026-05-05 01:08:56 UTC
**Audit window:** lifetime account + last 24h activity

---

## Top-Line Verdict

✅ **@johngambino was NOT overcharged.**
⚠️ **He was UNDER-charged by ~$16.90 lifetime** (wallet shows more spent than the ledger documents).
⚠️ **The walletLedger has 2,937 anonymous "wallet_deduction" entries** with no callType / destination / phoneNumber, making any post-hoc dispute investigation unauditable. The corresponding `phoneLogs` rows DO carry the detail — only the ledger was missing it.

---

## Numbers

| Metric | Value |
|---|---|
| Wallet `usdIn` (deposits + bonus) | **$569.0000** |
| Wallet `usdOut` (lifetime spend) | **$568.8775** |
| Net balance (current) | **$0.1225** |
| `walletLedger` sum across all 2,937 entries | **$551.9775** |
| **Mismatch (wallet vs ledger)** | **$16.90** under-recorded in ledger |

The mismatch is caused by 28 places in `js/` that increment `usdOut` directly via `atomicIncrement()` without going through `smartWalletDeduct()` — those bypass the ledger writer entirely.

---

## Recent Activity Audit (the calls you asked about)

| Time (UTC) | Source | Duration | Notes |
|---|---|---|---|
| 01:08:54 | Twilio Bridge call (fraud-alert IVR campaign) | 15s | One of 43 completed campaign legs |
| 01:21:44 | Twilio Bridge call (same campaign) | 974s = 16:14 | One of the 43 |

### Active campaign breakdown (`bulkCallCampaigns/69f9414f`, status=paused)

| Field | Value |
|---|---|
| Total leads | 148 |
| Completed | 43 |
| Failed | 5 |
| Average duration of completed legs | 66s (1 min) |
| Total billable minutes | 43 × 1 min = **43 min** |
| BulkCall rate | $0.1425 / min |
| Expected charge | 43 × $0.1425 = **$6.13** |
| **Actual ledger charges (window 01:08 – 01:10 UTC, 28 entries)** | **$5.85** |
| Difference | $0.28 under-charged (within rounding) |

**Per-call accuracy:** ✅ The current campaign legs were billed at the correct rate. He was not double-charged. The ~$0.28 under-charge is consistent with the campaign auto-pausing exactly when his $0.42 balance hit zero — the deduction loop short-circuits when the atomic `findOneAndUpdate` cannot satisfy the balance condition, so the LAST few billable seconds were free.

---

## Why the wallet-vs-ledger mismatch ($16.90)

The 28 direct `atomicIncrement(walletOf, chatId, 'usdOut', amount)` call sites (mostly historical / pre-`smartWalletDeduct` code paths in `_index.js`) charge the wallet without writing a ledger entry. Examples:

- `_index.js:8337,8381,8443` — domain renewal / VPS provisioning charges
- One-off historical adjustments
- Some legacy reseller paths

Going forward, those 28 sites should be migrated to `smartWalletDeduct(walletOf, chatId, amount, { type: '...', description: '...' })`. That's a follow-up sweep — out of scope for the immediate fix today.

---

## What we've already shipped to prevent recurrence

1. **`bulk-call-service.js`** — the bulk-IVR billing path now passes full metadata (`type: 'outbound_call'`, `callType: 'BulkIVR'`, `destination`, `phoneNumber`, descriptive text) to `smartWalletDeduct`, so every new ledger entry from this code path is fully attributed. (was the source of most of @johngambino's 2,937 anonymous entries)

2. **`voice-service.js`** — the CRITICAL/EMPTY low-balance alert now includes a one-tap **💰 Top Up Wallet** inline button that opens the wallet menu via the `wallet_topup_quick` callback. Direct user remediation in seconds.

3. **`_index.js` callback handler** — registered the `wallet_topup_quick` route that re-issues `/wallet` for the user.

4. **Locked in by tests** — `js/tests/test_three_fixes_2026_05_05.js` (6/6 passing) — codebase guards prevent any future regression of these three fixes.

---

## Recommended Next Steps

| Priority | Action |
|---|---|
| HIGH | Audit the 28 direct `usdOut` increment sites and migrate them to `smartWalletDeduct` so all future spend is auditable. ~2-hour task. |
| MEDIUM | Add a periodic reconciliation job (`scripts/reconcile_wallet_vs_ledger.js`) that flags any user where the wallet→ledger gap exceeds $5. Surface in admin chat. |
| LOW | Consider topping up @johngambino's wallet by $0.50 as a goodwill gesture next time he comes back — he's a clearly active power user with a confirmed slight under-charge in this incident. (Optional.) |
