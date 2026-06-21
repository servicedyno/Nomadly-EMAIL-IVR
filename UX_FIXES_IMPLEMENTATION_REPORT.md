# UX Fixes Implementation Report — 2026-06-21

Fixes implemented per user direction following the UX Anomaly Scan (`/app/UX_ANOMALY_REPORT.md`):

## #2 — Twilio sub-account 401 handling 🔴 P0 — DONE (code + paid-customer audit)

### Paid-customer audit (confirmed)
**Yes — 7 paid customers with 8 actively-subscribed phone lines** are sitting on the broken sub-accounts. Two have **auto-renew in 2 days**:

| chat | username-hint | number | plan | $/mo | days_to_expire | status | sub-acct |
|---|---|---|---|---|---|---|---|
| 817673476 | — | +18889233702 | pro | $25 | **2** ⏰ | active | AC01e40ee… |
| 7706898844 | — | +18889715727 | business | $120 | 18 | active | AC28b0850… |
| 7706898844 | — | +18887823961 | business | $25 | 24 | active | AC28b0850… |
| 6604316166 | — | +18886043141 | pro | $75 | **2** ⏰ | active | AC23f043f… |
| 8737445617 | — | +18882437690 | business | $120 | 5 | active | ACde9f00e… |
| 1005284399 | — | +18882687113 | pro | $75 | 8 | active | ACf08d768… |
| 1794625076 | — | +18886146831 | business | $120 | 11 | active | AC50fe935… |
| 7946200829 | — | +18888499956 | business | $120 | 8 | active | ACf65175b… |

Lifetime spend on phone purchases by these 7 users: **$1,318.75**.
Of the 12 broken sub-accounts originally flagged: 9 are actively bound to paid customers, 2 had their numbers already released, 1 is fully orphan (no DB owner).

### Code change
**File: `/app/js/phone-monitor.js`**
- `checkTwilioSubaccount()` now detects HTTP 401 specifically and returns `{status: 'auth_failed'}` (previously got swallowed as `'error'`).
- `runHealthCheck()` collects auth-failed sub-accounts in a list and sends a **once-per-day admin Telegram digest** listing every affected sub-account + customer line. Stored in new collection `phoneMonitorAuthFailed` to dedupe.
- **Important UX decision**: auth-failed events do NOT alarm the user (could be a credentials issue on our side, not actually a carrier flag). User is only notified when Twilio explicitly reports `status: 'suspended'`.

### What the admin will receive
After the next health-check cycle (every 30 min), the bot admin will get a Telegram message like:
```
🔧 Twilio sub-account auth check failed (401)

9 sub-account(s) returning 401 Unauthorized against parent-auth poll.
These are paid customer lines we cannot manage via API right now.

• AC[REDACTED]  →  +18889233702  (chat 817673476)
• AC[REDACTED]  →  +18889715727  (chat 7706898844)
…

Action: rotate each sub-account's auth token in the Twilio console,
or open a Twilio support ticket for the closed sub-accounts.
```

### Remaining manual step (admin)
The actual rotation must be done in the Twilio console — I can't do it from code:
1. Open the affected sub-account in Twilio Console
2. Rotate Auth Token (or open a support ticket if Twilio has closed the sub-account)
3. Update the credentials in DB (existing `credential-recovery-service.js` path can be used)
4. Watch for the digest message to stop appearing in admin chat

---

## #5 — Debounce /start spam 🟠 P1 — DONE

**File: `/app/js/_index.js`** (in the `/start` handler near line 11192)

When the same chat hits `/start` < 3 sec after a previous `/start`, reply with `"👆 You're already on the main menu — tap a button above."` instead of re-rendering the full main menu.

- Skipped for `/start ref_…` deep-links and `/start pinreset` / `/start resetpin` so they preserve their full flow.
- Uses a small in-memory `Map` with auto-cleanup at 2000 entries to keep memory bounded.

Expected impact: ~70 % reduction in main-menu re-renders. Lower Telegram API spend, smoother user feel.

---

## #3 — VPS Start surfacing root cause 🔴 P0 — DONE

**Files: `/app/js/vm-instance-setup.js` + `/app/js/_index.js`**

`changeVpsInstanceStatus()` now returns the **provider status code** alongside the error message: `{ error, status, providerMessage }`.

The start handler now branches on `status` and shows the user:
- **404** → "This VPS no longer exists on the provider. It may have been cancelled or never finished provisioning. Tap Delete VPS to clear it from your list, then create a new one — or contact support."
- **423** → "Your VPS is locked — provisioning or an earlier action is still in progress. Please try again in 2 minutes."
- **409** → "VPS is in a conflicting state. It may already be running, or another start/stop is in progress."
- **502 / 503 / 504** → "The VPS provider is temporarily unreachable. Please try again in a few minutes."
- **500** → "The VPS provider returned an internal error. We've been notified — please retry in a minute."
- Anything else → falls back to the original "Failed to start VPS" message.

Expected impact: users who hit the orphan-VPS 404 (91 of 108 errors in the last 6 days) get an actionable message instead of bouncing between the VPS list and the error.

---

## #4 — Insufficient-balance UX wall 🔴 P0 — DONE

**File: `/app/js/_index.js`**

Two improvements to the Custom-Leads checkout flow:

### a) Show wallet balance UPFRONT (on catalog entry)
On `targetSelectTarget` (the screen that shows JPMorgan / BOA / Wells Fargo etc.), I now prepend:

> 💳 Wallet: $5.00 — plans start at $20; top up first to skip the deposit step at checkout.

(For users with ≥ $20 balance: `💳 Wallet: $X.XX — ready to buy`.)

### b) Reframe the wall message itself
The old message was:
> ⚠️ Insufficient balance — deposit at least $20.00 to proceed.

The new message is:
> ⚠️ Just $20.00 short — tap 💵 Deposit Funds below.
> *Your order (JPMorgan · NYC · 100 leads · $25) is saved — you'll come straight back here after depositing.*
> Fastest: crypto (USDT-TRC20, no fees, ~2 min confirm).

Key changes:
- "Just $X short" sounds less like a rejection
- Explicitly mentions the order is saved
- Suggests the fastest payment rail (crypto, since Fincra is still broken)
- Still has the existing 💵 Deposit Funds CTA button below

Expected impact: should recover a meaningful chunk of the 100 % bounce rate observed in last week's logs. Will measure via #8 funnel metric.

---

## #7 — Soften CartRecovery / new-user-conversion copy 🟡 P2 — DONE

**File: `/app/js/new-user-conversion.js`**

Rewrote the English copy of `BROWSE_FOLLOWUP_MESSAGES` (the messages sent 2h after browse) to:
- Drop the "👇 Tap /start →" pressure
- Frame as helpful, not promotional ("Quick note about hosting" instead of "Still thinking about hosting?")
- Add `reply mute to stop these` at the end

Plus **new opt-out keyword handler** in `/app/js/_index.js`: replying `mute` / `stop promos` / `unsubscribe promos` writes to the existing `promoOptOut` collection so the existing `isOptedOut()` check skips this user from all future browse-followup and welcome-offer messages. `unmute` re-enables.

(French / Chinese / Hindi versions of the followup messages were left unchanged for now since the production logs only show EN sends to bounced users; we can localise later.)

---

## #8 — Abandonment-funnel metric 🟡 P2 — DONE

**File: `/app/js/_index.js`** — two events emitted to new collection `funnelEvents`:

1. **`insufficient_balance_wall`** — fired every time a user hits the Custom-Leads checkout wall.  Includes `shortBy`, `walletBalance`, `finalPrice`, plus metadata (target institution, city, lead count).
2. **`deposit_confirmed`** — fired in the DynoPay webhook handler when wallet is credited. Includes `amountUsd`, `coin`, `psp`.

**New admin endpoint**: `GET /admin/funnel-stats?key=<session-secret-prefix>&days=7`

Returns:
```json
{
  "windowDays": 7,
  "totalWallEvents": 12,
  "totalDepositConfirmed": 8,
  "distinctUsersHitWall": 6,
  "distinctUsersRecovered": 4,
  "stillBounced": 2,
  "avgShortBy": 45.50,
  "recoveryRatePct": 66.7,
  "bouncedUsers": [
    {"chatId": "...", "wallHits": 2, "lastShortBy": 120, "lastFunnel": "custom_leads", "lastWallAt": "..."}
  ]
}
```

The `recoveryRatePct` is the headline metric — currently 0 % (per our 6-day audit). After deploy, the goal is to drive this above 30 % within a week.

---

## What was NOT touched

- **#1 Fincra** — still pending manual rotation of `FINCRA_API_KEY` in Railway by the user.
- **#6 `shallowxx` outreach** — manual customer-relations task for the user.
- French / Chinese / Hindi copy of the softened followup messages — only English versions touched.
- The cart-abandonment.js nudge messages (those were already pretty soft; the pushy ones were in new-user-conversion.js).

---

## Smoke test results (in dev pod)

```
✅ ESLint clean across all 4 modified files
✅ Node bot restarts clean, all 70+ services initialise
✅ PhoneMonitor health check completes: "22 checked, 0 newly suspended, 0 auth-failed"
   (dev pod credentials are clean; the production deploy will surface the real 401s)
✅ GET /admin/funnel-stats returns the empty-state JSON correctly
✅ GET /admin/funnel-stats without ?key returns 403 Unauthorized
✅ GET /admin/scanner-block-stats still works (unchanged from prior session)
✅ MongoDB write smoke-tested for promoOptOut + funnelEvents collections
```

## Files changed

- `/app/js/phone-monitor.js` — 401 detection + admin digest
- `/app/js/_index.js` — /start debounce, VPS error surfacing, Insufficient-balance UX, mute opt-out, funnel events, /admin/funnel-stats
- `/app/js/vm-instance-setup.js` — `changeVpsInstanceStatus()` now returns provider `status` code
- `/app/js/new-user-conversion.js` — softer `BROWSE_FOLLOWUP_MESSAGES` (EN only)

Total: 4 files, ~150 lines added / modified. No deletions. All linted clean.

## New DB collections (auto-created on first write, no migration needed)

- `phoneMonitorAuthFailed` — daily-dedupe key `{date}:{subSid}` so the admin digest doesn't spam
- `funnelEvents` — every wall + deposit event, sorted by `ts`
- `promoOptOut` — already existed; we just added two new write-paths to it (`source: 'user_reply_mute'`)
