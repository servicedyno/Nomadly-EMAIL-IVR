# 📊 Referral Funnel Investigation + Fix Summary (2026-06-21)

## Context
Funnel pulse showed `/start` dropped ~50% (peak 134 → 56-64) and the **`ref_` channel completely collapsed** — only **6 `/start ref_` events in 8 days, all self-referrals**.  Zero `[Referral]` log lines in production.

## Root cause: not a bug — it's two layered problems

### 1. Visibility problem (code-fixable)
The `/start ref_` handler logged "Wallet referral saved" only when:
- Not self-referral
- Referrer chatId resolved
- New referee (no existing referral)

Every other path — self-ref, referrer-not-found, already-referred, error — was **silently dropped**. With dozens of edge cases failing silently, the funnel was invisible.

### 2. Marketing / incentive problem (not code)
Pulled live from prod via the new `/admin/referral-stats` endpoint:

| Metric | All-time | Last 7 days |
|---|---:|---:|
| Wallet referrals saved | **19** | **1** |
| Qualified (referee spent $30) | **5** | — |
| Total payout | **$25** | — |
| Pending (referees still below $30) | 14 | — |
| Total cumulative spend pending | $25.02 | — |

**Diagnosis:**
- Only **5 of 19 referees** ever crossed the $30 threshold → **26% qualification rate**
- The remaining 14 pending referees have an avg cumulative spend of **$1.78** (basically nothing)
- Top referrers: `8273560746` (4 referees), `8625434794` (4 referees), then long tail
- Lifetime payout is **$25**. The incentive is weak.

## What was fixed in code (this commit)

### A. Edge-block 5xx → 4xx cosmetic fix (P2 from RCA)
`/app/js/_index.js` lines 38-57.

**Before:** `res.socket?.destroy()` — Railway gateway saw closed socket → logged 502 "Retried single replica" (≈600 per day during scanner bursts).

**After:** `res.status(403).end()` with `Connection: close` header — same effective behavior (zero work, immediate close), but Railway now correctly classifies these as 4xx (deny) instead of inflating 5xx metrics.

Validation (live):
```
GET /con5dldbuy.php  → 403  ✅
GET /.env            → 403  ✅
GET /admin/scanner-block-stats → 200 ✅
```

### B. `/start ref_` funnel instrumentation
`/app/js/_index.js` lines 11123-11187.

Every `/start ref_X` now emits one of these structured log lines:

```
[Referral] /start ref_<code> from chatId=<id>     # entry log (always)
[Referral] outcome=sip_test_credited      # 8-char code → SIP test bonus
[Referral] outcome=wallet_referral_saved  # new wallet referral
[Referral] outcome=already_referred       # user had existing referrer
[Referral] outcome=self_referral          # user clicked own link
[Referral] outcome=referrer_not_found     # invalid refcode/chatId
[Referral] outcome=empty_refcode          # malformed /start ref_
[Referral] outcome=error                  # DB error
```

This means **every funnel touch is now measurable** in Railway logs, even self-referrals (which tell us about user testing behaviour) and not-found errors (which tell us about broken share links being passed around).

### C. New `/admin/referral-stats` endpoint
`/app/js/routes/admin.js`.

Auth: `?key=<SESSION_SECRET[:16]>`

Returns:
```jsonc
{
  "windowDays": 7,
  "totals": {
    "allTimeRefs": 19,
    "inWindowRefs": 1,
    "qualified": 5,
    "pending": 14,
    "totalPayoutUSD": 25,
    "totalCumulativeSpendPending": 25.02
  },
  "topReferrers": [...],
  "webClicks": {                  // from /r/:code redirect tracker
    "totalClicks": <n>,
    "converted": <n>,
    "conversionRatePct": <%>
  }
}
```

## What needs *user* action (not code)

The referral system technically works. The drop-off is a real-world incentive/marketing issue:

1. **Reach out to top 2 affiliates** (`8273560746` and `8625434794`) personally — they've brought 4 each, but qualification rate is low. Ask if anything changed on their side.
2. **Lower the $30 threshold** or split it (e.g. $5 on first deposit + $5 more at $30) — current 26% qualification means most referees bounce before payout.
3. **Surface the share link in more places**:
   - After successful purchases ("You earned a bonus referral slot!")
   - In the wallet low-balance message
   - In `/start` greeting for users with no existing referees
4. **One-time double-rewards promo**: "this week, refer 1 friend = $10 (instead of $5)" — to re-prime the channel.
5. **Set `BOT_USERNAME=NomadlyBot` env var in Railway** (currently unset — works because t.me URLs are case-insensitive, but it's hidden tech debt).

## Files touched

- `/app/js/_index.js` — edge-block response + ref funnel instrumentation
- `/app/js/routes/admin.js` — new `/admin/referral-stats` endpoint
- `/app/scripts/dig_referral_funnel.py` — diagnostic script (this run)
