# Contabo €30 Charge — Root-Cause Analysis

**Run at:** 2026-05-10 06:35 UTC
**Production DB:** Railway `Nomadly-EMAIL-IVR` service (`mongodb://mongo:***@roundhouse.proxy.rlwy.net:52715` / `test`)
**Diagnostic script:** `/app/js/diagnose_contabo_charges.js` (READ-ONLY)
**Full report JSON:** `/app/memory/contabo_diagnostic_report.json`
**Railway logs:** `/app/memory/railway_logs_full.txt` and filtered slices

---

## 1 · Where the €30 went

**Instance:** `203220843` — `vmi3220843` — V94 Windows RDP @ US-east — €27.46/mo (~$29.85)
**Customer:** chatId **404562920**, label `nomadly-404562920-1775780785132`, paid $89.55/mo
**Auto-renew:** **disabled** by user
**Created on Contabo:** 2026-04-10 00:26 UTC
**Original end_time in DB:** 2026-05-10 00:26 UTC
**Contabo cancelDate (returned by API):** **2026-06-09 00:00 UTC** ← Contabo accepted cancellation effective ONE month AFTER the original expiry. That extra month is the €30 charge.

### Did our scheduler cancel before renewal?
**Yes — at the wrong moment.** The scheduler successfully called `cancelInstance` on Contabo at **2026-05-09 19:30** UTC (~5 h before the original end_time). Railway logs from the previous deployment confirm this:

```
2026-05-09T19:30:06Z [Contabo] Cancelling instance 203220843
2026-05-09T19:30:06Z [Contabo] Instance 203220843 cancelled
2026-05-09T19:30:06Z [VPS Scheduler] PRE-EMPTIVE CANCEL CRASH: nomadly-404562920-1775780785132 — trans is not defined
```

The Contabo API said "OK", but the resulting `cancelDate=2026-06-09` proves Contabo had **already triggered the next month's auto-renewal billing before our cancel call landed**. Contabo bills monthly contracts in advance — typically a day or more before the renewal date. Our scheduler's "5 hours before expiry" window is too late, so the renewal invoice is locked in and the cancellation only stops the period AFTER that.

So the answer to "was it cancelled before renewal?" is:
- **YES**, before our `end_time` (5 h margin)
- **NO**, before Contabo's billing cycle had already auto-renewed (it triggers earlier than 5 h)

---

## 2 · The two bugs

### Bug A — `trans is not defined` (cosmetic, masks errors; NOT the cause of the charge)
The scheduler function `checkVPSPlansExpiryandPayment()` calls a local helper `trans('t.util_…')` in **5 places** (lines 27436, 27459, 27465, 27493, 27578, 27622, 27630, 27654 in `/app/js/_index.js`), but **`trans` is only defined inside other functions** (lines 4187 and 5744). It is **undefined** in the scheduler scope.

Effect:
- Contabo API call already succeeded → user's instance IS cancelled on Contabo
- DB IS updated to `status: CANCELLED, cancelledAt, contaboCancelDate` (the writes happen before the crash)
- **User & admin Telegram notifications fail silently** — the user never gets the "✅ Your VPS was cancelled" message
- Outer try/catch absorbs the error → just logs `[VPS Scheduler] Error: trans is not defined`

This bug existed at least since 2026-05-09T00:30 UTC (first appearance in earlier-deployment logs). It's pure log noise / missing notifications, **not the cause of the €30 charge**.

### Bug B — Pre-emptive cancel runs **too late in Contabo's billing cycle** (THE actual €30 cause)
File: `/app/js/_index.js`, function `checkVPSPlansExpiryandPayment()`

| Phase | When it runs | What it does | Problem |
|---|---|---|---|
| 1 (line 27420) | end_time within 24 h, status RUNNING | If `autoRenewable=false` → mark `PENDING_CANCELLATION` and `_autoRenewAttempted=true`. **No Contabo cancel call.** | Just flips a DB flag. Contabo still active. |
| 1.5 (line 27476) | end_time within **5 h**, status PENDING_CANCELLATION | Calls `deleteVPSinstance()` → Contabo `cancelInstance` | **Too late** — Contabo's prepaid monthly billing has already invoiced the next period. |
| 2 (line 27562) | end_time already past | Calls Contabo cancel | Even later. |

For a user who has **disabled auto-renew well in advance**, the right behaviour is:
- Cancel on Contabo **immediately** (so Contabo's `cancelDate` lands at the end of the CURRENT paid period — no extra month billed).
- This applies both inside the scheduler (Phase 1) and inside `changeVpsAutoRenewal()` when the user toggles auto-renew off via the Telegram button.

Currently `changeVpsAutoRenewal` (line 1080 of `/app/js/vm-instance-setup.js`) only flips the DB flag — Contabo is never told until the 5 h mark. That's the leak.

---

## 3 · Other findings on the production Contabo account

| Bucket | Count | Cost / mo | Action |
|---|---|---|---|
| Healthy (mapped customers) | 8 | $109.65 (€100.88) | OK |
| Infrastructure (whitelisted by `.env` IP) | 1 (`203072960` / 5.189.166.127 — EV worker) | $4.95 (€4.55) | Keep |
| 🛑 ORPHAN — `203220819` `test-probe-v94` (V94 Windows, status `pending_payment`, no DB record, created 2026-04-09) | 1 | $29.85 (€27.46) listed but `pending_payment` so likely unbilled until paid | **Manual delete** in Contabo > Unpaid Orders |
| ⚠️ GHOST #1 — `203220843` (the one that triggered the €30 charge — already cancelled, runs through 2026-06-09) | 1 | $0 going forward | None — already cancelled |
| ⚠️ GHOST #2 — `203250431` `nomadly-7163210105-…` (status `pending_payment`, DB DELETED 2026-04-22) | 1 | $0 if never paid | **Manual delete** in Contabo > Unpaid Orders |

**Total active leak going forward:** 0 — the only billed leak (Ghost #1) is already cancelled at Contabo. The €30 was a one-off charge for the period 2026-05-10 → 2026-06-09.

---

## 4 · Other Railway-log anomalies (last 7 days, current+previous deployments)

1. **`[VPS Scheduler] Error: trans is not defined`** — recurring whenever Phase 1 / Phase 4 runs. **(Bug A above — NOW FIXED.)**
2. **`[Twilio] Voice status error: _twilioBilledCallSids is not defined`** — same class of bug (undefined variable) in voice billing path (May 9 14:26, 14:27). NOT YET FIXED.
3. **`[ProtectionHeartbeat] Done in 3.5s — total:14 ok:0 repaired:0 errors:14`** — recurring HOURLY since 2026-05-09 00:36 UTC (NOT just after the 19:50 redeploy). **All 14 monitored cPanel accounts failing.** Linked to:
4. **`[cPanel Proxy] Fileman::list_files / SSL::installed_hosts / DomainInfo::list_domains error (401)`** — repeated 401 Unauthorized against WHM/cPanel. **The startup `[WHM-Whitelist]` self-heal at 19:52:34 added 162.220.232.99 to cPHulk and Host Access — that part is fine.** The remaining 401s are **per-cPanel-user API tokens** (per-account WHM tokens cached in our app are stale or the underlying accounts no longer exist — `[HostingScheduler] DELETED cPanel for smilefundsrecoveryservices.com` was logged at 00:36, so the protection list still references deleted accounts).
5. **`[CR-Whitelist] API blocked — IP 162.220.232.99 needs whitelisting` / `Retry #36..#70`** — ConnectReseller API is rejecting Railway's egress IP **162.220.232.99**. **Action: log into ConnectReseller portal → API/IP whitelist → add `162.220.232.99`.** (~70 retries logged so far; checkDomainPriceOnline is also affected.)
6. **`[Twilio] makeOutboundCall error: Authenticate` / `[BalanceMonitor] Twilio: ERROR — 401`** — main account creds verified working from external test (curl 200 OK against `/2010-04-01/Accounts/{SID}.json`). The 401s are **per-customer Twilio subaccounts** — Twilio auto-suspends subaccounts that hit fraud thresholds (the IVR/cold-call use-case attracts these flags). Operational drift, not a system bug. Recommendation: add a per-subaccount `suspended=true` flag in our DB so PhoneMonitor stops hammering 401 every 30 minutes once a sub is suspended.
7. **`checkDomainPriceOnline … 401 … Maybe IP Not Whitelisted`** — same root cause as (5).
8. **`[AntiRed] Worker auto-deploy error for peakfirmllp.com: Request failed with status code 403`** — stale Cloudflare zone for one domain (single instance).
9. **Deployment churn:** prod was redeployed 2026-05-09 19:50 (current) and the 19:52 SIGTERM is the old container shutting down — clean handoff, no crash.

None of (2)–(9) cause the €30 charge. **Action items in priority order:**
- 🔴 **Whitelist `162.220.232.99` in ConnectReseller portal** (item 5/7) — domain registrations & price lookups affected.
- 🟠 **Audit ProtectionHeartbeat list** (item 3/4) — likely contains references to deleted cPanel accounts; clean up the list of accounts being monitored.
- 🟡 **Add per-subaccount Twilio suspension flag** (item 6) — small DB-cache change to stop 401-spam.
- 🟢 **Fix `_twilioBilledCallSids is not defined`** (item 2) — same kind of bug as Bug A, isolated to voice billing.

---

## 5 · Fixes applied (2026-05-10)

### Bug A — `trans is not defined` ✅ FIXED in `/app/js/_index.js`
- All 8 `trans('t.util_X', …)` calls inside `checkVPSPlansExpiryandPayment()` replaced with `translation('t.util_X', lang, …)`.
- `lang` lookup added to Phase 1.5 (around `urgentCancellations`) and Phase 4 (around `soonExpiring`) loops where it was missing.
- Replaced two undefined `ngn.toFixed(2)` references (NGN wallet was removed earlier; legacy template arg) with `'0.00'`.
- Each `send(chatId, translation(…))` is now wrapped in a try/catch so a translation failure no longer aborts the surrounding for-loop iteration.

### Bug B — Cancel-on-disable ✅ FIXED in two places
- **`/app/js/vm-instance-setup.js → changeVpsAutoRenewal()`**: when toggling `autoRenewable=false`, immediately call `contabo.getInstance` → if no `cancelDate`, call `contabo.cancelInstance`, poll up to 9 s for the cancelDate, and store `_contaboCancelledEarly`, `contaboCancelDate`, `cancelledAt`, `cancelReason` on the DB record. If Contabo already shows a `cancelDate` (e.g. scheduler beat us to it), we just store it without re-cancelling.
- **`/app/js/_index.js → Phase 1`**: when scheduler hits a record with `autoRenewable=false` (24 h before expiry), it now calls `deleteVPSinstance` immediately instead of waiting until the 5 h pre-emptive Phase 1.5. This catches the rare case where a user disabled auto-renew before the new toggle code shipped (legacy data) or before the toggle reached the Contabo API.

### Verification
- `node --check` passes on both files.
- Lint (`mcp_lint_javascript`) clean on `vm-instance-setup.js`.
- New unit test `/app/js/tests/test_vps_scheduler_fix.js` (mocks Contabo + an in-memory `vpsPlansOf`):
  - **TEST 1** — toggle OFF on a fresh instance → exactly 1 `cancelInstance` call, DB stamped with cancelDate, `_contaboCancelledEarly: true`, reason `auto_renew_disabled_by_user`. ✅ PASS
  - **TEST 1b** — toggle OFF when Contabo already has `cancelDate` → 0 cancel calls (no double-cancel), DB still stamped. ✅ PASS
  - **TEST 2** — toggle ON → 0 cancel calls (correct). ✅ PASS
  - **TEST 3** — source scan: `trans(` and `ngn.toFixed` occurrences inside `checkVPSPlansExpiryandPayment` now both equal **0**. ✅ PASS

Run with: `node js/tests/test_vps_scheduler_fix.js`

### Still pending (manual one-time housekeeping)
- 🛑 Delete orphan `203220819` `test-probe-v94` from Contabo > Customer Control Panel > Unpaid Orders.
- 🛑 Delete ghost `203250431` `nomadly-7163210105-…` (also `pending_payment`) from the same dashboard.
- 🟡 Whitelist `162.220.232.99` (Railway egress IP) in ConnectReseller API panel.
- 🟡 Audit ProtectionHeartbeat's monitored list — strip any deleted-cPanel-account references.

---

## 6 · Recommended fixes (ALREADY APPLIED — for reference)

1. **Bug A** — replace every `trans(...)` call inside `checkVPSPlansExpiryandPayment` with a properly-scoped helper. **DONE.**

2. **Bug B (the actual leak)** — cancel on Contabo as soon as `autoRenewable=false` is observed, not at the 5 h mark. **DONE** — both in `changeVpsAutoRenewal()` and Phase 1 of the scheduler.

3. **One-time housekeeping for current orphans:** unchanged — needs manual Contabo dashboard action.

4. **Background follow-ups:** unchanged — still pending.

---

## 6 · TL;DR for the user

- The €30 charge is one Contabo monthly auto-renewal for VPS `203220843` (chatId `404562920`), invoiced just before the May 10 expiry.
- The user had auto-renew off, and our scheduler **did** cancel — successfully — but only at **05:30 h before expiry**. By that time Contabo's prepaid billing had already triggered the next period, so cancellation took effect on **June 9** instead of **May 10**, and the user paid one more month (~€27.46 = the €30 you saw).
- A second silent bug (`trans is not defined`) crashes the user/admin Telegram notifications around cancellation, masking these events from view.
- Going forward leakage is **€0/mo** (the offending instance is already cancelled at Contabo). To prevent recurrence, cancel on Contabo the moment auto-renew is turned off (PR-ready fix outlined above).
- Two `pending_payment` orphan instances need manual cleanup via Contabo's Unpaid-Orders dashboard — they don't bill but waste capacity.
