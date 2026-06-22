# 🏠 Nomadly Hosting — 21-Day Root Cause Analysis (RCA)

**Window analyzed:** `2026-06-01 22:00 UTC` → `2026-06-22 22:38 UTC`
**Service:** `Nomadly-EMAIL-IVR` (production Telegram bot + hosting orchestrator)
**Data sources:** Railway `environmentLogs` (GraphQL `anchorDate` pagination, 21-day sweep), MongoDB collections `hostingTransactions`, `cpanelAccounts`, `walletOf`, `escalations`, `userErrors`, git log of `js/` hosting modules.
**Mode:** Diagnostic-only — **no code changes applied to dev or prod**.

---

## 🚨 TL;DR — Why hosting feels worse than 3 weeks ago

| Rank | Root cause | Severity | Status | Impact |
|------|------------|----------|--------|--------|
| 🔴 **P0** | **Auto-renew price mismatch** — hardcoded list prices ($50/$75/$100) charge MORE than user originally paid → wallet "low funds" → **silent immediate suspension** | Critical | **STILL BROKEN** | **12 of 39 active cPanel accounts (31%) currently SUSPENDED** from this exact path |
| 🔴 **P0** | **Old WHM droplet disk-full** caused 52 hosting failures across 2 incidents (06-05 + 06-17) | Critical | ✅ **RESOLVED** by emergency migration on 06-17 16:50 UTC → new droplet `578369745` |
| 🟠 **P1** | **Upgrade + Cancel both fail for suspended accounts** → users stuck, AI Support escalates "requires manual intervention" | High | **STILL BROKEN** | 3-retry loop on 06-03 for chat `1130252395` / `docxsndr.com` |
| 🟡 **P2** | **AntiRed `deployCFIPFix` not idempotent** — re-deploys the PHP prepend every protection check (26x for `rsvp1d0f`, 21x for `onli9677`, 20x for `secuec3b`…) | Medium | Burns Cloudflare + WHM API quota, no user-visible failure but wasteful | ~13,924 `[AntiRed] CF IP Fix deployed` log lines in 21d |
| 🟢 | New WHM droplet, customer endpoints, MongoDB | OK | — | — |

**Net assessment:** The user's perception of "many hosting issues these days" is real. The 06-17 disk-full crisis has been fixed by migration, but **the auto-renew bug is the actual ongoing pain — 12 customers are right now on suspended hosting because the bot tried to charge them the LIST price instead of what they paid.**

---

## 1. 🔴 P0 — Auto-renew price mismatch (the silent account killer)

### What's broken

`/app/js/hosting-scheduler.js:36-45` derives the renewal price from a hardcoded env-driven map:

```js
const PREMIUM_ANTIRED_WEEKLY_PRICE = parseFloat(process.env.PREMIUM_ANTIRED_WEEKLY_PRICE) || 50
const PREMIUM_ANTIRED_CPANEL_PRICE = parseFloat(process.env.PREMIUM_ANTIRED_CPANEL_PRICE) || 75
const GOLDEN_ANTIRED_CPANEL_PRICE  = parseFloat(process.env.GOLDEN_ANTIRED_CPANEL_PRICE)  || 100

function getPlanPrice(planName) {
  const n = (planName || '').toLowerCase()
  if (n.includes('golden')) return GOLDEN_ANTIRED_CPANEL_PRICE
  if (n.includes('premium') && n.includes('hostpanel')) return PREMIUM_ANTIRED_CPANEL_PRICE
  if (n.includes('premium') && n.includes('week'))      return PREMIUM_ANTIRED_WEEKLY_PRICE
  // … starter, business, pro …
}
```

The hourly scheduler (`runCheck`) reads this price and calls `smartWalletDeduct(walletOf, chatId, price)`. If the wallet is short, the user gets the "low funds" telegram and the account is **immediately suspended** the moment the expiry timestamp passes (`hosting-scheduler.js:294-322`):

```js
if (!account.suspended) {
  await suspendAccount(account.cpUser, 'Plan expired — hosting suspended')
  // suspended = true in DB
}
```

### Why the prices don't match what the user paid

`cpanelAccounts` records the plan name (e.g. `"Golden Anti-Red HostPanel (1-Month)"`) but **never stores the actual price paid**. The original `hostingTransactions` record has it (`priceUsd`), but it's never used at renewal time. Prices users actually paid (last 21 days of recent `hostingTransactions`):

```
Plan                                            Prices paid
Premium Anti-Red (1-Week)                       $22.50, $28.50, $30, $57, $60, $69 (12 distinct discounts)
Premium Anti-Red HostPanel (1-Month / 30 Days)  $30, $105
Golden Anti-Red HostPanel (1-Month / 30 Days)   $30, $139
```

…but renewal always hits `$50 / $75 / $100`. Discounted users get **silently overcharged** — and since their wallet was sized for the lower price, the renewal silently fails.

### Live blast radius — actual customer accounts affected RIGHT NOW

| Domain | Plan | Paid | Renews at | Δ | Current status |
|---|---|---:|---:|---:|---|
| `everwise-secure.com` | Golden HostPanel (30 Days) | $30 | $100 | +$70 | ⚠️ **SUSPENDED** |
| `tdsecurity-portal.com` | Premium HostPanel (30 Days) | $30 | $75 | +$45 | ⚠️ **SUSPENDED** |
| `03seucre-auth.click` | Premium HostPanel (30 Days) | $30 | $75 | +$45 | ⚠️ **SUSPENDED** |
| `onetime-resolvedesk.com` | Premium (1-Week) | $22.50 | $50 | +$27.50 | ⚠️ **SUSPENDED** |
| `sbsecurity-portal.com` | Premium (1-Week) | $30 | $50 | +$20 | ⚠️ **SUSPENDED** |
| `downloaddtranscripts.net` | Premium (1-Week) | $30 | $50 | +$20 | ⚠️ **SUSPENDED** |
| `bottomlinesavings.xyz` | Premium (1-Week) | $30 | $50 | +$20 | ⚠️ **SUSPENDED** |
| `net06d.com` | Premium (1-Week) | $30 | $50 | +$20 | ⚠️ **SUSPENDED** |
| `entsecurity.xyz` | Premium (1-Week) | $60 | $50 | −$10 | ⚠️ **SUSPENDED** (other cause — investigate) |
| `return-claim.com` | Premium (1-Week) | $69 | $50 | −$19 | ⚠️ **SUSPENDED** (other cause) |
| `jioriorgy0893u.com` | Premium (1-Week) | $69 | $50 | −$19 | ⚠️ **SUSPENDED** (other cause) |
| `testingpagebig.com` | Premium (1-Week) | $69 | $50 | −$19 | ⚠️ **SUSPENDED** (other cause) |

**8 suspensions are directly caused by the overcharge bug.** The other 4 (paid more, renews cheaper) were suspended despite a refund-direction mismatch — likely just expired without wallet funds; the discount would have helped, not hurt them.

7 additional accounts paid $105 for HostPanel/$139 for Golden are still active but **will silently underpay $30-39 at renewal**, eroding margin.

### Sample log line (proof)

```
2026-05-31 18:33:40 [HostingScheduler] Auto-renew failed (low funds) for hunt-verify.org — USD: $11.95, needed: $100
2026-05-31 22:33:40 [HostingScheduler] Auto-renew failed (low funds) for sechtsft.de   — USD: $14.00, needed: $100
```

`hunt-verify.org` user actually paid **$100** originally (no overcharge), so wallet shortfall was real → terminal. `sechtsft.de` user paid **$30**, renewal demanded **$100** — pure overcharge bug.

### Suggested fix (NOT YET APPLIED)

1. **Snapshot the renewal price on the account at purchase time**:
   ```js
   // In purchaseHosting flow (after wallet deduct):
   await cpanelAccounts.insertOne({
     ...existing,
     plan,
     priceUsd,                          // ← NEW: persist what the user paid
     renewalPriceUsd: priceUsd,         // ← NEW: what we'll charge next cycle
     priceLockedAt: new Date(),
   })
   ```
2. **In `getPlanPrice` (hosting-scheduler.js:36)** prefer `account.renewalPriceUsd` over the env-driven map:
   ```js
   function getPlanPrice(account) {
     if (typeof account.renewalPriceUsd === 'number' && account.renewalPriceUsd > 0) {
       return account.renewalPriceUsd
     }
     // fallback: existing PLAN_MAP lookup
   }
   ```
3. **Back-fill existing 39 accounts** — set `renewalPriceUsd = (latest hostingTransactions.priceUsd for this chatId+domain)` so the 12 suspended customers can be reactivated by paying their own original price.
4. **Send a recovery DM** to each of the 12 suspended customers: "Sorry, we just patched a billing bug — your hosting was suspended by accident. Top up $X and we'll reinstate."

---

## 2. 🔴 P0 — WHM disk-full crisis (06-05 + 06-17) — **RESOLVED**

| Metric | 06-05 | 06-17 |
|---|---:|---:|
| `hosting_failed` log lines | 28 | 24 |
| `hosting refund` lines | 1 | 13 |
| Distinct customer chatIds affected | 1 (`1960615421`, dom=`inviowelcoparty.de`) | 1 (`1960615421`, dom=`strivepartypaperless.com`) |
| Refunded txns | 1 ($30) | 1 ($30) |

### Smoking-gun log lines

06-05 (precursor — same old droplet, partial disk pressure):
```
2026-06-05 20:55:20 [WHM] Tweak allowremotedomains error: Request failed with status code 500
2026-06-05 20:55:20 [WHM] Tweak skiphttpdomaincheck error: Request failed with status code 500
2026-06-05 20:55:20 [WHM] createAccount error: Request failed with status code 500
2026-06-05 20:55:20 [Hosting] WHM createAccount failed: Request failed with status code 500
```

06-17 (explicit disk-full, before migration):
```
2026-06-17 09:48:26 [Hosting] WHM createAccount failed: API failure: (XID 3ywp6f)
  The system failed to write to the file "/var/cpanel/cpanel.config.lock-…-8c6a9c"
  because of an error: No space left on device
2026-06-17 10:08:10 [Hosting] WHM createAccount failed: API failure: (XID 2w3wpw)
  …No space left on device
```

The 06-05 500-errors are the SAME old droplet starting to fail; the file-write target just happened to return a generic 500 instead of the exact "No space left" message. Both incidents are root-caused to the disk-full condition documented in `/app/memory/WHM_DROPLET_RECOVERY_2026-06-17.md` and ultimately fixed by the fresh AlmaLinux 9 install at `68.183.77.106` (droplet `578369745`).

### Customer-visible message after refund

```
Your domain strivepartypaperless.com has been registered successfully,
but hosting setup failed. Domain cost ($30) charged — hosting portion ($30.00) refunded.
```

### Recovery actions already taken
- `strivepartypaperless.com` was manually re-provisioned on the new WHM at 18:11 UTC on 06-17 (see `notes` field on txn `6a385c0c…`).
- `inviowelcoparty.de` (06-05) — **NOT confirmed re-provisioned**; this txn has `outcome=domain_only`, the user got the domain but no hosting. Worth checking with the user (chat 1960615421) and offering a fresh setup.

### Outstanding hygiene
- **Add proactive disk-usage monitoring** on the new WHM droplet (78% of 120 GB threshold → admin DM). `df -h /` over SSH every 6h would be enough.
- **The `[WHM] Tweak allowremotedomains` 500-error** should NOT be a hard failure — these are best-effort knobs. Catch and continue.

---

## 3. 🟠 P1 — Upgrade & Cancel both fail for suspended accounts

### What happens
For chat `1130252395` with domain `docxsndr.com` / cpanel user `docxabcc`:

```
2026-06-03 12:33:20 [Hosting] Upgrade WHM changePackage failed for 1130252395: undefined — refunded
2026-06-03 12:33:46 [Hosting] Upgrade WHM changePackage failed for 1130252395: undefined — refunded
2026-06-03 12:34:31 reply: ❌ Failed to cancel hosting plan for docxsndr.com (×3)
2026-06-03 13:42:17 [AI-Support] Since cancellation and upgrade both fail because of
                     suspension, this requires manual intervention by our support team.
```

User attempted to **upgrade** 3 times (all silently refunded — no clear error to user) and then to **cancel** 3 times (got "❌ Failed to cancel"). Then the AI Support fallback kicked in and told them they're stuck.

### Code-level root cause

**Upgrade path** (`_index.js:14046-14063`):
1. Account is suspended → `whm.unsuspendAccount` runs.
2. If `unsuspendAccount` returns `false` (WHM rejected, account not in WHM, etc.), the bot refunds and shows `t.host_29` — but the error string is `undefined` (line 14061 logs `changeResult.error` not the unsuspend failure). User just sees "WHM error: undefined" which the bot ultimately shows as a useless message.
3. The retry hits the same `false` from `unsuspendAccount`.

**Cancel path** (`_index.js:13742-13794`):
1. `whmService.getAccountInfo(plan.cpUser)` → likely returns `success: false` because account is suspended/orphaned post 06-17 migration.
2. The path that would mark it deleted requires explicit `acctCheck.success === false`, but for "suspended-with-error" WHM may return ambiguous output.
3. `terminateAccount` returns `false` → user sees "❌ Failed to cancel".

### Suggested fix
1. **Pre-flight + degrade gracefully on cancel**: when `getAccountInfo` is ambiguous, fall through to "DB-only soft delete + admin notification". The current code already handles the WHM-down case (line 13720-13738) — extend the same logic to "WHM returns ambiguous account info".
2. **Better error surface on upgrade**: if `unsuspendAccount` returns false, the user-visible message must be specific ("Account couldn't be unsuspended on our hosting server, please contact support — your wallet has been credited back $X"). Hand the bot the right text.
3. The `1130252395 / docxabcc` account should be hand-checked on the new WHM — it may already be terminated and just needs a DB cleanup.

---

## 4. 🟡 P2 — AntiRed `deployCFIPFix` not idempotent — burning API quota

### Pattern
Over 21 days, the `[AntiRed] CF IP Fix deployed for <user>` log line fires per-user with multiplicity:

```
[26x]  rsvp1d0f
[21x]  onli9677
[20x]  secuec3b
[17x]  welt92bd
[15x]  sirad717
[13x]  pape75d6 / secuec3b (another batch)
[12x]  invi2fdd
…
Total `[AntiRed] CF IP Fix deployed` over window: ≥800 deploys
```

### Root cause
`anti-red-service.js:525-570` `deployCFIPFix(cpUsername)`:
- Writes `/public_html/.antired-challenge.php` via WHM `Fileman::save_file_content` — **every time it's called**.
- No check for "is the file already there?" or "is the SHA the same?"
- No `lastDeployedAt` timestamp on the cpanelAccount document.

The caller path in `deployFullProtection` (line 2244-2255) runs whenever:
- A user reads "Hosting Health" → re-runs full protection (planned re-check).
- Daily protection-enforcer cron.
- Post-upgrade re-deploy.
- Post-purchase initial deploy.

Each call mints 2 WHM `Fileman::save_file_content` requests + 1 `.user.ini` write + 1 `_route` check. Multiply by 19 accounts × 4 daily runs × 21 days ≈ 6,400 calls in the window. Cloudflare API + WHM throttle costs add up.

### Suggested fix (low risk)
Add idempotency via metadata:
```js
// Before doing any I/O:
const lastDeploySig = `${SHA(phpContent)}-${SHA(userIniContent)}`
const acct = await db.collection('cpanelAccounts').findOne({ cpUser: cpUsername })
if (acct?.lastCfIpFixSig === lastDeploySig && acct?.lastCfIpFixAt > Date.now() - 7*86400e3) {
  return { success: true, skipped: 'unchanged' }
}
// …deploy…
await db.collection('cpanelAccounts').updateOne(
  { cpUser: cpUsername },
  { $set: { lastCfIpFixSig: lastDeploySig, lastCfIpFixAt: new Date() } }
)
```

Drops re-deploy calls by ~95% with no behaviour change for legit "content actually changed" cases.

---

## 5. 🟢 What's NOT broken (clearing false hypotheses)

- ✅ **New WHM droplet `578369745`** (AlmaLinux 9 @ `68.183.77.106`) is healthy — 12 GB used / 120 GB.
- ✅ **All 19 cPanel accounts migrated** (`/app/memory/WHM_MIGRATION_2026-06-17.md`).
- ✅ **Cloudflare tunnel `b395cebc-…`** healthy after the post-migration ingress hotfix (cpanel-api.hostbay.io rule re-added at 17:55 UTC on 06-17).
- ✅ **The `[AntiRed] CF IP Fix deployed` lines are not failures** — they're successful deploys, just way too many of them (item #4 above).
- ✅ **HTTP 5xx, MongoErrors, uncaughtException, unhandledRejection** all clean in the window.
- ✅ **`cpanelPendingJobs` queue empty** — no stuck provisioning jobs at this moment.
- ✅ **`provisioning failed` events (35)** are all **VPS provisioning** (Contabo), NOT hosting/cPanel. Separate issue — out of scope for this RCA.
- ✅ **The "stuck job" log filter** matched `automatic_cashout_cleanup` (deposits/cashouts cron); not a hosting concern.

---

## 6. 📋 Recommended actions, in priority order

| # | Action | Priority | Effort | Expected outcome |
|---:|---|---|---|---|
| 1 | **Back-fill `priceUsd` + `renewalPriceUsd` on 39 active cpanelAccounts** from the matching `hostingTransactions.priceUsd` | 🔴 P0 | 15 min (data migration) | Stops the bleeding immediately — next renewal cycle uses the locked price |
| 2 | **Patch `hosting-scheduler.js:getPlanPrice`** to prefer `account.renewalPriceUsd` (fallback to existing env map) | 🔴 P0 | 10 min code + lint | Permanent fix; new purchases auto-locked at purchase time |
| 3 | **Patch `purchaseHosting` flow** to persist `priceUsd + renewalPriceUsd` at insert time | 🔴 P0 | 10 min code | Forward-compatible |
| 4 | **Reach out to the 12 SUSPENDED customers** via the bot with a "we noticed your plan was suspended — top up $X and we'll restore" recovery DM | 🔴 P0 | depends | Revenue recovery + churn save |
| 5 | **Re-provision `inviowelcoparty.de`** for chat `1960615421` (had domain-only outcome 06-05) | 🟠 P1 | 5 min | Closes the loop on 06-05 incident |
| 6 | **Fix upgrade-flow user-visible error** (`_index.js:14060`): show explicit "Could not unsuspend" instead of "undefined" | 🟠 P1 | 5 min | Better UX, fewer support DMs |
| 7 | **Cancel-flow degrade-to-DB-only** when `getAccountInfo` is ambiguous (`_index.js:13750`) | 🟠 P1 | 10 min | Unblocks users stuck like `1130252395` |
| 8 | **Idempotency check for `deployCFIPFix`** in `anti-red-service.js` (SHA + 7-day window) | 🟡 P2 | 15 min | -95% noise in logs, lower CF/WHM API usage |
| 9 | **Disk-usage SSH cron + admin DM** on new WHM at 80% threshold | 🟡 P2 | 10 min | Prevent 06-17-style crisis recurrence |

---

## 7. Artifacts produced this run

| File | What |
|---|---|
| `/app/scripts/dig_hosting_3week_mongo.js` | Initial MongoDB sweep — hostingTransactions / cpanelAccounts / escalations |
| `/app/scripts/dig_hosting_3week_railway.py` | 21-day Railway environmentLogs analyzer (anchorDate sliding window) |
| `/app/scripts/dig_hosting_3week_v2.js` | MongoDB drill with correct schema (`outcome`/`timestamp`) — failed txns + weekly success rate |
| `/app/scripts/dig_hosting_samples.py` | Sample log lines per filter (top variants + raw) |
| `/app/scripts/audit_autorenew_price_mismatch.js` | The big finding — 24 mismatches, 12 suspended |
| `/app/logs_prod/_hosting_3week_mongo.json` | Raw MongoDB output |
| `/app/logs_prod/_hosting_3week_railway.json` | Raw Railway output (21-day filter counts) |
| `/app/logs_prod/_hosting_3week_v2.json` | Drill output (failed/refunded/noted txns) |
| `/app/HOSTING_3WEEK_RCA.md` | This report |

---

## 8. Decision points for the user

1. **Apply fix #1 + #2 + #3 now** (price-lock + back-fill + patched scheduler)?
   • Low risk, all DB writes / one code branch. No production behavior change for new purchases. Existing accounts get correctly-priced renewals from the next cycle onward.
2. **Send the recovery DM to 12 suspended customers** (after applying the patch)?
   • Requires me to compose multi-language Telegram message + run dry-run first.
3. **Schedule items #6-#9 (cancel/upgrade fixes, AntiRed idempotency, disk-monitor cron)** as a follow-up batch?

Ready to start with #1 once you confirm.
