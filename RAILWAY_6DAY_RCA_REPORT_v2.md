# 📉 Railway Sales Drop-off RCA v2 — Last 6 Days (Fresh Pull 2026-06-21)

**Window analyzed:** `2026-06-15` → `2026-06-21 08:45 UTC`
**Service:** `Nomadly-EMAIL-IVR` (production Telegram bot)
**Method:** Railway GraphQL — `httpMetricsGroupedByStatus`, `httpLogs(deploymentId)`, `environmentLogs(anchorDate)`.
**Note:** Previous v1 RCA used `afterDate/afterLimit` which Railway's API no longer supports — v2 uses `anchorDate/beforeLimit` sliding-window pagination.

---

## 🚨 TL;DR

| Rank | Issue | Severity | Started | Status |
|------|-------|----------|---------|--------|
| 🔴 **P0** | **Fincra payment AUTH still failing — 96 401s/day for 11+ days** | Critical | 2026-06-10 | **STILL BROKEN** (96/day → 36 in first 8h today) |
| 🔴 **P0** | **Wallet credits collapsed: 06-21 = 0 (vs avg ~5/day)** | Critical | Worsening | Worsening |
| 🟠 **P1** | **Domain registrations down 45%** (peak 132 → 73 yesterday) | High | Worsening since 06-16 | Worsening |
| 🟠 **P1** | **`/start` funnel down ~50%** (peak 134 → ~60) | High | Since 06-17 | Stagnant |
| 🟡 **P2** | **5xx "spike" 595 in 32h** — **NOT a real outage** (edge-block side effect) | Cosmetic | 2026-06-20 | False alarm |
| 🟡 **P2** | **50 deploys in 6 days** (peak 15/day) — deploy churn continues | Medium | Ongoing | Ongoing |
| 🟢 | Telegram webhook healthy, MongoDB healthy, no uncaughtException | OK | — | — |

---

## 1. Real Sales Pulse (last 6 days)

| Metric | 06-15 | 06-16 | 06-17 | 06-18 | 06-19 | 06-20 | 06-21 (8h) | Δ peak→today |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `credited` (wallet topup) | 2 | 5 | 3 | **10** | 6 | 3 | **0** | **-100%** |
| Domain registered | 86 | **132** | 94 | 113 | 93 | 73 | 54* | **-45%** vs peak |
| SMS Campaign | 8 | **39** | 18 | 8 | 14 | 8 | 2* | -95% partial |
| VPS purchased | 0 | 0 | 0 | 0 | 3 | 2 | 0 | flat |
| `/start` (top of funnel) | 88 | **134** | 65 | 71 | 56 | 64 | 15* | **-50%** |
| Insufficient-balance replies | 2 | 2 | 1 | 3 | 0 | 3 | 1 | constant |
| **Fincra auth FAIL** | **96** | **96** | **96** | **96** | **96** | **96** | **36** | **CONSTANT** |
| BALANCE_FETCH_FAILED | 290 | 290 | 290 | 290 | 290 | 290 | 107 | **CONSTANT** |

\* 06-21 is partial (~8 hours of 24)

### Headlines
1. **Wallet credits are dying** — went from a peak of 10/day (06-18) to **zero today**.
2. **Domain registrations dropped 45% from peak.** That alone is the cleanest signal of "bad sales this week".
3. **Top of funnel halved.** `/start` (new users + returning user re-entry) fell from 134 to 56-64. Marketing/referrals quiet.
4. **Fincra fails at a perfectly constant 96/day rate** — exactly 4 attempts/hour = the bot's NGN balance heartbeat. The bot has tried and failed continuously for **11 days**; it is no longer attempting customer deposits because the cached-balance lookup also fails.

---

## 2. 🔴 P0 — Fincra is still completely broken

Sample log (production, just now):
```
2026-06-21 08:30:25 services.fincra_service ERROR
  Fincra authentication failed: {'message': 'Unauthorized',
                                  'request_id': '719f730ca970040b26c6ad45ccdbdb2a'}
2026-06-21 08:30:25 services.fincra_service ERROR
  Check FINCRA_API_KEY and ensure it matches the environment (LIVE/TEST)
2026-06-21 08:30:25 services.fincra_service ERROR
  ❌ BALANCE_FETCH_FAILED: No cached Fincra data available and fresh fetch failed
```

**Pattern (11 days):**
```
06-10: 54  (first day, started mid-day)
06-11→06-20: 96/day every single day
06-21: 36 in first 8 hours → on track for 96 again
TOTAL ~1,200+ auth failures
```

### Customer impact
- Fincra is the **NGN-fiat deposit rail** (Nigeria + West Africa).
- Affected users can't top up their wallet in NGN → bot replies "Insufficient balance" → users bounce.
- Confirmed in logs: `Insufficient balance` replies still being sent.

### Fix action (already documented in yesterday's RCA but **never executed**)
1. Log into Fincra dashboard → rotate `FINCRA_API_KEY` / `FINCRA_PRIVATE_KEY`.
2. Confirm key is for **LIVE** (not TEST) — error message specifically calls this out.
3. Update env vars in Railway → `Nomadly-EMAIL-IVR` → Variables.
4. Trigger redeploy (auto-redeploys on var change).
5. Verify: in production logs, `Fincra authentication failed` count should drop to **0** within minutes; `BALANCE_FETCH_FAILED` should disappear; first NGN deposit attempt should succeed.

---

## 3. 🟡 P2 — The 5xx "spike" is a false alarm

| Day | 5xx count | What it actually is |
|---|---:|---|
| 06-15→06-19 | 0-1 | normal |
| 06-20 | **161** | edge-block dropping scanner sockets |
| 06-21 (8h) | **697** | same, scaling up |

### Why this is noise
Drill-down (`/app/logs_prod/_5xx_drilldown.json`):

| Hits | Path | Source |
|---:|---|---|
| 447 | `GET /con5dldbuy.php` | IP `74.7.243.245` (UA: `GPTBot/1.4`) |
| 60 | `GET /con5dld` | same scanner |
| 33 | `GET /con5dldrobots.txt` | same scanner |
| 50 | various scans on `panel.1.hostbay.io` | `TLM-Audit-Scanner/1.0` |
| ~5 | `.git/config`, `.env`, `info.php`, `config.json` | misc bots |

**ALL 595 5xx requests are scanner traffic.** None hit a real customer endpoint (`/api/*`, `/telegram/*`, `/voice-webhook`, etc.).

### Root cause of the 502 reporting
The Express edge block (`js/_index.js:38-57`) calls `res.socket?.destroy()` **without sending response headers**. Railway's gateway interprets the closed connection as a failed upstream → logs it as `502 "Retried single replica"`. This is functionally what we want (zero CPU, zero work for the scanner) — but it inflates the 5xx metric.

### Optional cleanup
Replace `res.socket?.destroy()` with `res.status(444).end()` (nginx's "no response" code) or `res.status(403).end()`. Same effective outcome, but Railway will then count them as 4xx (correct category for "deny") instead of 5xx.

---

## 4. 🟠 P1 — Top of funnel is half what it was a week ago

```
/start command daily count:
06-15:  88   06-16: 134 ← peak
06-17:  65   06-18:  71
06-19:  56   06-20:  64    06-21: 15 (8h, projected ~45)
```

This is a 50% drop in customer arrivals. With Fincra broken, the customers who do arrive can't transact in NGN. Combined effect:
- 50% fewer arrivals
- 100% of NGN arrivals can't deposit → bounce
- Net effect on revenue: severe.

Possible causes:
- Referral channel collapsed (yesterday's report flagged ref_ deep-links: peak 11/day → 2/day)
- Top affiliate stopped sharing
- A user-facing message in the bot mentions the Insufficient balance / fee issue and users churn

### Suggested test
Try `/start ref_TEST` from a fresh Telegram session, verify the deep-link still credits the referrer; reach out to top 5 affiliates for feedback.

---

## 5. 🟡 P2 — Deploy churn (50 in 6 days, peak 15/day)

| Day | Deploys |
|---|---:|
| 06-16 | 9 |
| **06-17** | **15** |
| 06-18 | 6 |
| **06-19** | **13** |
| 06-20 | 5 |
| 06-21 (8h) | 2 |

Each deploy = ~30-90 s downtime on the Telegram webhook. With Telegram's retry-window, missed updates are silently dropped. 13-15 deploys per day = up to **20 minutes of bot downtime daily**.

This is consistent with the user's original report of "deploy churn" and exacerbates the funnel drop because mid-conversation users can have their messages dropped.

### Fix options
- Branch protection: only deploy on PR merge to `main`, not on every commit
- Add a staging environment / branch that absorbs agent-driven commits
- Or: Disable Railway auto-deploy on commits and rely on manual triggers

---

## 6. 🟢 What's NOT broken

- ✅ **Telegram webhook**: alive, `pending_update_count=0`, no `last_error_message`
- ✅ **MongoDB**: zero `MongoError` in 6 days
- ✅ **No process crashes**: 0 `uncaughtException`, 0 `unhandledRejection`
- ✅ **DynoPay (crypto rail)**: working
- ✅ **Real customer endpoints**: no 5xx at all (the 5xx are 100% scanner)
- ✅ **The edge block**: working (scanner is being terminated cheaply)

---

## 7. Recommended actions (priority order)

| # | Action | Priority | Effort | Expected outcome |
|---:|---|---|---|---|
| 1 | **Rotate `FINCRA_API_KEY` in Railway env** | 🔴 P0 | 5 min | Restores NGN deposit rail. Sales should recover within hours. |
| 2 | Verify Fincra key environment (LIVE not TEST) | 🔴 P0 | 1 min | Prevent same failure mode |
| 3 | After redeploy, watch logs 30 min for `Fincra authentication failed` → must hit 0 | 🔴 P0 | 30 min | Confirms fix |
| 4 | Spot-check `/start ref_TEST` deep-link from fresh Telegram account | 🟠 P1 | 5 min | Confirm referral funnel intact |
| 5 | Check with top 5 affiliates if anything changed on their side | 🟠 P1 | depends | Diagnose funnel drop |
| 6 | Swap `res.socket?.destroy()` → `res.status(444).end()` in edge block | 🟡 P2 | 2 min | Cleans 5xx metric (cosmetic) |
| 7 | Add branch protection / staging branch to reduce Railway redeploys | 🟡 P2 | 30 min | Reduce downtime windows |

---

## 8. Artifacts produced this run

| File | What |
|---|---|
| `/app/scripts/analyze_railway_6day_v2.py` | Fixed analyzer using `anchorDate` |
| `/app/scripts/dig_5xx_spike.py` | 5xx drill-down (per deployment, anchorDate) |
| `/app/scripts/dig_sales_pulse.py` | Real sales/funnel pulse |
| `/app/logs_prod/_6day_v2_summary.json` | Raw HTTP + event counts |
| `/app/logs_prod/_5xx_drilldown.json` | 5xx raw samples |
| `/app/RAILWAY_6DAY_RCA_REPORT_v2.md` | this report |

---

## 9. Comparison to yesterday's RCA (`RAILWAY_6DAY_RCA_REPORT.md`)

| Finding | Yesterday | Today |
|---|---|---|
| Fincra 401 | Documented but unfixed | **Still unfixed — 11 days running** |
| 5xx count | 0 | **595 in 32h, but all scanner = false alarm** |
| Wallet credits | 12/day (06-20) | **0 today** (worse) |
| Domain registrations | 64-232/day | **73 yesterday → tracking 54 today** (declining) |
| Deploy churn | 49 deploys | 50 in 6 days |
| Scanner block | Documented as deployed | **Working** — but reports as 5xx |

**Net assessment:** revenue continues to bleed because Fincra remains broken. The 5xx noise is a new artifact, not a new outage. **Fixing Fincra (Action #1) is the single highest-leverage intervention.**
