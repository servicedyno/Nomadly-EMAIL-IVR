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

1. **`[VPS Scheduler] Error: trans is not defined`** — recurring whenever Phase 1 / Phase 4 runs. (Bug A above.)
2. **`[Twilio] Voice status error: _twilioBilledCallSids is not defined`** — same class of bug (undefined variable) in voice billing path (May 9 14:26, 14:27).
3. **`[ProtectionHeartbeat] Done in 3.5s — total:14 ok:0 repaired:0 errors:14`** — recurring HOURLY since 2026-05-09 13:35 UTC. **All 14 monitored cPanel domains failing** — likely linked to:
4. **`[cPanel Proxy] Fileman::list_files / SSL::installed_hosts / DomainInfo::list_domains error (401)`** — repeated 401 Unauthorized against WHM/cPanel. Token / IP-whitelist issue.
5. **`checkDomainPriceOnline … status code 401 … Maybe IP Not Whitelisted`** (ConnectReseller) — ~01:50 May 10. Reseller IP whitelist drift after the May 9 19:50 redeploy (Railway likely changed egress IP).
6. **`[AntiRed] Worker auto-deploy error for peakfirmllp.com: Request failed with status code 403`** — stale Cloudflare zone for one domain.
7. **Deployment churn:** prod was redeployed 2026-05-09 19:50 (current) and the 19:52 SIGTERM is the old container shutting down — clean handoff, no crash.

None of (2)–(7) cause the €30 charge, but #3 + #4 + #5 (cPanel/WHM/Reseller 401s) are a follow-up to-do.

---

## 5 · Recommended fixes (NOT YET APPLIED)

1. **Fix Bug A** — replace every `trans(...)` call inside `checkVPSPlansExpiryandPayment` with a properly-scoped helper. Either:
   - Inject `const trans = (k, ...a) => translation(k, lang, ...a)` per-iteration after fetching `lang = (await state.findOne({ _id: String(chatId) }))?.userLanguage || 'en'`, OR
   - Call `translation('t.util_X', lang, …)` directly (already imported).

2. **Fix Bug B (the actual leak)** — cancel on Contabo as soon as `autoRenewable=false` is observed, not at the 5 h mark.
   - In `changeVpsAutoRenewal()` (vm-instance-setup.js:1080): if the user is toggling OFF and the instance is still RUNNING with `cancelDate` not yet set on Contabo, call `contabo.cancelInstance(contaboInstanceId)` and store `contaboCancelDate` on the record. (No status change to CANCELLED yet — the user still owns the box until the current period ends.)
   - Add an "uncancel" call in the same function when toggling back ON (Contabo supports re-activating a cancelled instance via the Customer Control Panel; their API has `POST /v1/compute/instances/{id}/actions/uncancel` or similar — or surface a clear UI message that re-enabling needs a new order).
   - In Phase 1 (`if (!autoRenewable)` branch, line 27433): also call `deleteVPSinstance` immediately. Idempotent if `cancelDate` is already set.

3. **One-time housekeeping for current orphans:**
   - `203220819` (test-probe) and `203250431` (pending_payment ghost) — delete via [my.contabo.com](https://my.contabo.com) → Customer Control Panel → "Unpaid Orders". Their state is `pending_payment`, so the API `cancelInstance` will return a soft-success without effect (already documented in vm-instance-setup.js:980).

4. **Background follow-ups:**
   - Fix `_twilioBilledCallSids is not defined`.
   - Re-whitelist Railway egress IP at WHM (panel.1.hostbay.io) and ConnectReseller (Render/Railway IP changed after the redeploy at 19:50).
   - Investigate `ProtectionHeartbeat 14/14 errors` since 13:35 May 9 — root cause is likely the same WHM 401.

---

## 6 · TL;DR for the user

- The €30 charge is one Contabo monthly auto-renewal for VPS `203220843` (chatId `404562920`), invoiced just before the May 10 expiry.
- The user had auto-renew off, and our scheduler **did** cancel — successfully — but only at **05:30 h before expiry**. By that time Contabo's prepaid billing had already triggered the next period, so cancellation took effect on **June 9** instead of **May 10**, and the user paid one more month (~€27.46 = the €30 you saw).
- A second silent bug (`trans is not defined`) crashes the user/admin Telegram notifications around cancellation, masking these events from view.
- Going forward leakage is **€0/mo** (the offending instance is already cancelled at Contabo). To prevent recurrence, cancel on Contabo the moment auto-renew is turned off (PR-ready fix outlined above).
- Two `pending_payment` orphan instances need manual cleanup via Contabo's Unpaid-Orders dashboard — they don't bill but waste capacity.
