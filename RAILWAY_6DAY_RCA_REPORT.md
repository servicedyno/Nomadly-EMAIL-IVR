# 📉 Railway Sales Drop-off RCA — Last 6 Days

**Window analyzed:** `2026-06-14` → `2026-06-20`
**Services:** `Nomadly-EMAIL-IVR` (primary Telegram bot/backend), `HostingBotNew`, `LockbayNewFIX`
**Data sources:** Railway GraphQL API — `httpMetricsGroupedByStatus`, `httpLogs`, `environmentLogs` (with `Project-Access-Token` auth + `Mozilla/5.0` UA).

---

## TL;DR — root causes ranked

| Rank | Issue | Severity | Started | Status |
|------|-------|----------|---------|--------|
| 🔴 **P0** | **Fincra fiat-payment service AUTH BROKEN** (returns "Unauthorized") | Critical | **2026-06-10** (10 days ago) | **CURRENTLY BROKEN** |
| 🔴 **P0** | **Confirmed payments down 77%** (53/day → 12/day) | Critical | Started 06-12 | Worsening |
| 🟠 **P1** | **Referral channel collapsed** (peak 11/day → 2/day) | High | Trend since 06-14 | Worsening |
| 🟠 **P1** | **`/start` commands down 65%** (156 → 54) | High | Since 06-15 | Worsening |
| 🟠 **P1** | **Twilio errors spike 06-16** (2,208 errors that day) | High | One-day spike | Resolved (200/day now) |
| 🟡 **P2** | **49 redeploys in 7 days** — high deploy churn, mini-outages | Medium | Ongoing | Ongoing |
| 🟡 **P2** | **Contabo VPS API 500 errors** | Medium | Chronic | Ongoing |
| 🟢 | Telegram webhook healthy, no pending updates, no `last_error_message` | OK | — | — |

---

## 1. The data behind the drop-off

### HTTP 2xx (real success) per day — Nomadly-EMAIL-IVR
```
Day        Total   2xx    3xx     4xx*    5xx
06-14     43,246  1,602  242   41,402     0
06-15     19,873  3,303  295   16,275     0
06-16     26,759  2,620  282   23,856     1
06-17     34,085  5,363  471   28,251     0   ← peak 2xx
06-18     22,367  2,628  266   19,473     0   (-51%)
06-19     21,628  1,245  296   20,087     0   (-77%)
06-20     32,363    787  231   31,345     0   (-85%, partial day)
```
\* 95% of 4xx are a **vulnerability scanner** pounding `/con5dldbuy.php` (top hit: `[404] 1,978 GET /con5dldbuy.php` in 90 min). This is **NOT real customer traffic** and should be filtered/blocked at the edge to clean up dashboards, but it is not the cause of the sales drop.

### Real sales activity (filtered, from environmentLogs)

| Metric | 06-10 | 06-14 | 06-17 | 06-18 | 06-19 | 06-20 | Δ from peak |
|---|---:|---:|---:|---:|---:|---:|---:|
| `payment confirmed` | **53** | 4 | 15 | 27 | 14 | **12** | **-77%** |
| `deposit confirmed` | **75** | 5 | 15 | 28 | 48 | 20 | **-73%** |
| `/start` command | — | 68 | 65 | 71 | 56 | **54** | **-65% vs 06-15 peak 156** |
| referral (`ref_…`) | — | **11** | 2 | 1 | 0 | **2** | **-82%** |
| `Wallet Balance` queries | 37 | 7 | 32 | 43 | 42 | **19** | **-78% vs 06-09 peak 86** |
| Telegram callbacks (real) | — | low | low | low | high (new logger) | high | logging only ⬆ |

---

## 2. 🔴 P0 — Fincra is broken (the smoking gun)

Sample log line (production):
```
2026-06-20 13:45:25 services.fincra_service - ERROR -
  Fincra authentication failed: {'message': 'Unauthorized',
  'request_id': '8949fd34cc77c872d39999045f71834c'}
2026-06-20 13:45:25 services.fincra_service - ERROR -
  Check FINCRA_API_KEY and ensure it matches the environment (LIVE/TEST)
2026-06-20 13:45:25 services.fincra_service - ERROR -
  ❌ BALANCE_FETCH_FAILED: No cached Fincra data available and fresh fetch failed
```

### Timeline (paginated through all logs back to retention boundary)

```
Fincra "authentication failed" occurrences per day
06-10:  54  ← first day it appears (started mid-day)
06-11:  96
06-12:  96
06-13:  96
06-14:  96
06-15: 130
06-16: 163
06-17:  96
06-18:  96
06-19:  96
06-20:  83
TOTAL: 1,102 auth failures in 10 days
```

`BALANCE_FETCH_FAILED` follows the same pattern (~300–400/day). Every minute-ish heartbeat that tries to refresh the Fincra balance is failing.

### Customer impact
Fincra is the **fiat-NGN deposit rail**. Nigerian and West-African users cannot deposit Naira → cannot top up wallet → see "Insufficient balance" → bounce. This is consistent with the **`Insufficient balance` reply messages** we see in logs being sent at high volume.

### Fix (action for you)
1. Log into Fincra dashboard and **rotate `FINCRA_API_KEY`** (and `FINCRA_API_SECRET` if applicable).
2. Verify the key is for the LIVE environment, not TEST.
3. Update `FINCRA_API_KEY` in Railway → `Nomadly-EMAIL-IVR` → Variables.
4. Trigger redeploy.
5. Verify with: `curl -H "api-key: $FINCRA_API_KEY" https://api.fincra.com/profile/business/me` should return 200.

---

## 3. 🟠 P1 — Referral channel collapsed (peak 11/day → 2/day)

```
Daily /start with ref_… code:
05-31: 8     06-12: 6    06-14: 11 ← peak this window
06-15: 3     06-17: 2    06-18: 1    06-20: 2
```

This is the largest *relative* drop in the dataset. Possible causes:
- **Top referrer stopped sharing** (ask top 5 affiliates if anything changed on their side)
- **Reward changed / payout failed** (a Fincra-funded referral bonus would be stuck = affiliates stop promoting)
- **Deep-link broken** (test `t.me/<bot>?start=ref_TEST` — should track and credit the referrer)

There is a known previous patch — `/app/REFERRAL_DEEP_LINK_FIX.md` — that touches this path. Worth verifying it's still working in production. A quick e2e test from a fresh Telegram session would confirm.

---

## 4. 🟠 P1 — Twilio 06-16 spike (2,208 errors that day)

```
Twilio error events / day:
06-13:    163
06-14:    381
06-15:    755
06-16:  2,208  ← MASSIVE spike
06-17:  1,221
06-18:    759
06-19:  1,141
06-20:    200  (resolved)
```

Phone-IVR / SMS users on 06-16 likely got broken numbers. The errors trail off after 06-17 but the customer churn from a bad day is sticky. The cleanup script `/app/scripts/audit_origin_leaks.py` and `[Twilio Sync] Webhook sync complete: 16 updated, 0 failed` cron lines suggest internal cleanup. Recommended:
- Drill into 06-16 16-22 UTC errors specifically to confirm root cause (likely a Twilio account-flag or carrier change).
- Audit which numbers were dropped to send recovery DMs to affected users.

---

## 5. 🟡 P2 — Deploy churn (49 deploys in 7 days)

| Day | Successful deploys (Nomadly-EMAIL-IVR) |
|---|---:|
| 06-12 | 1 |
| 06-13 | 2 |
| 06-16 | 9 |
| 06-17 | **15** |
| 06-18 | 6 |
| 06-19 | **15** |
| 06-20 (so far) | 4 |

Each deploy = ~30–90 sec where the webhook URL returns nothing → Telegram retries → if the retry window misses, the update is dropped silently. 27 deploys on 06-17 + 06-19 alone is unhealthy. Consider:
- A staging environment to absorb test commits.
- A canary / rolling restart strategy if Railway supports it.

---

## 6. 🟢 What is NOT broken
- **Telegram webhook is healthy** — `getWebhookInfo` returned the live URL, `pending_update_count: 0`, **no `last_error_message`**, IP `69.46.46.32`. The bot is reachable and processing messages.
- **MongoDB is fine** — `MongoError` count = 0 across 6 days.
- **No process crashes** — `uncaughtException` = 0, `unhandledRejection` = 0, no 5xx HTTP responses.
- **Domain registration flow alive** — 64–232 successes per day, no degradation.
- **DynoPay (crypto rail) appears OK** — 271 events in window, no auth failures.
- **The 4xx flood is just a scanner**, not real customers.

---

## 7. Recommended next steps (in priority order)

1. **🔴 NOW — Rotate Fincra API key** in Railway env (`FINCRA_API_KEY`). Confirm via Fincra dashboard the right env (LIVE vs TEST). This alone should restore NGN deposits and pull a chunk of sales back.
2. **🔴 Verify by deposit test:** after redeploy, watch logs for the next 30 min — `Fincra authentication failed` should hit 0 and `deposit confirmed` should re-appear in the NGN flow.
3. **🟠 Audit referral funnel:** Run `/start ref_TEST` from a fresh Telegram account; verify the credit lands; reach out to top 5 affiliates for feedback.
4. **🟠 06-16 Twilio retro:** Drill `06-16T16:00:00Z` → `06-16T22:00:00Z` Twilio errors, identify affected users, send recovery DMs.
5. **🟡 Reduce deploy churn:** Use staging branch; batch commits.
6. **🟡 Add edge block for `/con5dldbuy.php`** scanner in Railway proxy / Cloudflare worker. Cleans dashboards, reduces wasted Node.js CPU.

---

## 8. Artifacts produced during this investigation

| File | What it contains |
|---|---|
| `/app/scripts/analyze_railway_6day.py` | Aggregated HTTP status + log filter counts (the fixed v2 with UA header) |
| `/app/scripts/dig_http_logs.py` | Deployment-by-deployment httpLogs pull (used to identify scanner) |
| `/app/scripts/dig_real_traffic.py` | Scanner-filtered real-traffic breakdown |
| `/app/scripts/dig_events_v2.py` | environmentLogs business-event analysis (anchorDate paginated) |
| `/app/logs_prod/_6day_summary.json` | Raw HTTP daily counts |
| `/app/logs_prod/_6day_business_events.json` | Per-filter daily counts + sample messages |
| `/app/logs_prod/_real_traffic.json` | Sample of scanner-filtered HTTP logs |
| `/app/logs_prod/_6day_analysis_output.txt` | Console output of main analyzer |
| `/app/logs_prod/_6day_business_events_output.txt` | Console output of business events run |
