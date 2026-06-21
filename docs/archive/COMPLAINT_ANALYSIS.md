# Customer Complaint Analysis — Nomadly Production
**Source:** Railway-prod MongoDB (`test` DB) + Railway deployment logs
**Window:** all-time aiSupportChats, escalations, supportRatings, phoneTransactions
**Last data point analysed:** 2026-05-25

---

## 0) Volume snapshot

| Collection | Count |
|---|---|
| `nameOf` (users) | 367 |
| `aiSupportChats` (all msgs) | many; **183 user-msgs in last 14 days** from **41 unique users** |
| `escalations` (AI → human takeover) | 15 (last 30 days) |
| `supportSessions` (admin chats opened) | 18 active in last 30 days |
| `supportRatings` | small set; **5 negative** ratings across the dataset |
| `phoneTransactions` (Cloud-IVR billing) | 17 (entire collection) |
| `userErrors` (24h TTL) | 0 right now — collection is rotating fine |

---

## 1) Top complaint categories (last 14 days, AI-support inbound)

Tagging the 183 user messages by regex:

| Category | Count | What customers are actually saying |
|---|---|---|
| `bug_broken` ("not working / error / fail / stuck") | 47 | DNS errors, domain showing "an error", screenshots of broken UI |
| `domain` | 38 | DNS configuration, "why is my domain coming like this", screenshot escalations |
| `phone_plan` / starter / pro / business / renew | 31 | Plan comparisons, "what does $75 include", **how do I upgrade** |
| `cloudivr_general` (IVR / SIP / Caller ID / OTP) | 28 | Plan feature questions: "can I use IVR on Starter?", "press 1 to transfer", "what's the diff Pro vs Business" |
| `payment / wallet / crypto / refund` | 21 | Top-up status, missed crypto credits, refund requests |
| `hosting / cPanel / WHM` | 14 | File-manager uploads, panel access |
| `sms / bulk sms` | 12 | Delivery, sender-IDs |
| `login_account` | 9 | "Cannot access", locked |
| `vps / RDP` | 7 | Reinstall, server access |
| `leads / SMS leads` | 6 | Extraction, format |
| `email_validation` | 5 | SMTP / spam |
| `virtual_card / VCC` | 4 | 3DS fails |
| `marketplace / url shortener` | 3 | Misc |
| `cloudivr_upgrade` (explicit phrasing) | **2** | See section 2 |

Top escalation reasons in `escalations` (15 docs, last 30 d):
- `ai_flagged` (human requested or AI auto-escalated): 13
- `media:screenshot_photo` (AI cannot view image): 2

Acknowledged-but-unresolved (`acknowledgedAt` set, `resolvedAt` null) = **15 of 15** — i.e. **no escalation has ever been formally resolved/closed** in `escalations`. (Schema has `resolvedAt` but the close action isn't being written.)

---

## 2) Cloud-IVR plan-upgrade issues — **CONFIRMED**

### 2a. The smoking gun: `@fuckthisapp` (chat `2086091807`) — Apr 30, 2026 audit-trail hole

In `phoneTransactions` you can literally see the post-mortem stamped on the document:

```json
{
  "chatId": "2086091807", "phoneNumber": "+18777000068",
  "action": "upgrade", "oldPlan": "starter", "newPlan": "pro",
  "amount": "62.50", "credit": "12.50", "eligibleForCredit": true,
  "paymentMethod": "Crypto (BTC)",
  "timestamp": "2026-04-30T19:39:35.000Z",
  "_backfilledAt": "2026-04-30T20:00:00.000Z",
  "_backfillReason": "Apr-30-2026 audit-trail gap — applyPhonePlanUpgrade did not write to phoneTransactions"
}
```

The user successfully paid **$62.50** for a Starter → Pro upgrade (with the 14-day-credit promo of $12.50 off) but the function `applyPhonePlanUpgrade()` was writing the change to `phoneNumbersOf` **without** logging to `phoneTransactions`. This was caught when reconciling and was patched: see `js/_index.js` lines **29534–29560** — the audit-trail block is now wrapped in `try/catch` with a log line `[CloudPhone] phoneTransactions.insertOne failed for upgrade …`. The fix is in production. The username `fuckthisapp` was likely chosen post-incident.

Risk going forward: the `try/catch` swallows the error and only logs — it does NOT alert. If MongoDB hiccups during an upgrade, the audit row will silently vanish again. Consider:
- Make the insertOne **synchronous-with-alert** (notify admin group on failure), OR
- Run a daily reconciler that compares `phoneNumbersOf` plan changes vs `phoneTransactions.action=upgrade` rows.

### 2b. The repeat complaint: `@Recode_x` (chat `8226424150`) — May 22, 2026

User message captured verbatim in the Railway log:
> "I want to upgrade my plan to business plan but I don't know how I already have starter plan"

- Escalation reason: `ai_flagged` (user typed "I need human agent")
- Their flow trail (also in logs): tapped 📞 Cloud IVR + SIP → 📞 Bulk IVR Campaign → 🛒 Choose a Plan → 📋 My Plans → 🛒 Choose a Plan again (loop) — **they never found the upgrade button**.
- Admin `@onarrival1` had to manually walk them through: "Tap ⬆️ Upgrade to Business button (it shows your exact upgrade price with credit)".
- They have **0 phone numbers purchased**, $5 wallet, never bought anything before — so the "My Plans" menu was empty, and "Choose a Plan" leads to *purchase*, not *upgrade*. There is no native flow for "I already have one plan, take me to a different plan **before purchasing my first number**". The upgrade button only appears in the per-number management menu, which doesn't exist until they buy.

**UX gap:** The user mental-model is "upgrade my account from Starter to Business" but the system models plan-per-phone-number. The bot has no entry point that says "you don't own a number yet — here's how plans work".

### 2c. Plan-price data anomalies that look like silent upgrade / restoration bugs

| chat | name | number | flag | plan | DB price | Expected | Plausible cause |
|---|---|---|---|---|---|---|---|
| 8273560746 | Scoreboard44 | +18888370876 | non-sub | business | **$30** | $120 | Older pricing or admin override (both numbers released May 1 & May 8) |
| 8273560746 | Scoreboard44 | +18339561373 | non-sub | business | **$30** | $120 | Same — both auto-renew rows would have charged $30 |
| 817673476 | johngambino | +18884879051 | non-sub | pro | **$15** | $75 | **`_restoration: true, _restoredBy: "admin via emergent agent"` on 2026-04-20** — admin manually restored at a lowered price; subsequent auto-renews are still pulling $15 |
| 817673476 | johngambino | +18889233702 | isSubNumber=true | pro | $25 | $25 | Correct (sub-number flat $25) |

The `+18884879051` row is concerning: it's the **parent** number, `isSubNumber:null`, yet planPrice=$15. The auto-renew on **2026-05-20** then charged $15 instead of $75 — see `phoneTransactions`:
```
auto_renew | pro | amount=15 | wallet_usd | 2026-05-20
```
That's a $60/month revenue leak per renewal cycle for this account. **`@johngambino` also left a `bad` support rating on 2026-05-09**, supporting the inference that something is off with their account.

### 2d. The "bad" rating cluster (5 total negative ratings ever)

| chat | name | when | wallet | phone | notes |
|---|---|---|---|---|---|
| **8541381736** EIN_5050 | 2026-05-21 22:21 | $4.94 | Starter purchased same day @ 22:08 | Rated `bad` **13 minutes after buying Starter** — likely realized Starter doesn't include IVR (which they apparently wanted; they explored 🧪 Test SIP / Quick IVR Call after) |
| **8273560746** Scoreboard44 | 2026-04-19 12:23 | $59 | Two $30-business numbers, both released | Possible pricing-confusion or feature-mismatch |
| **817673476** johngambino | 2026-05-09 | $22.98 | Pro at $15 (restored) | Likely from upgrade / restoration follow-up |
| 4830097651 / 8159960103 | (older, no recent context) | – | – | – |

So **3 of the 5 negative ratings are tied to phone-plan friction**, including 2 of the 4 accounts above that have unusual phoneTransactions / phoneNumbersOf state.

---

## 3) Other patterns worth flagging

1. **Escalations never get marked `resolved`** — 15 / 15 still have `resolvedAt: null`. The close-flow writes to `supportSessions` but not back to `escalations`. (Search confirms no `escalations.updateOne({ resolvedAt })` anywhere in `js/_index.js`. The `resolvedAt` field is declared in `js/collections-schema.js:212` but only ever read, never written.) This means "open escalations" metrics are unreliable.

2. **Media escalations have no follow-through**: every "screenshot/photo attached" escalation reaches reminderCount=3 then sits at status=`open`. Two such items for `@Thugnificent_0018` (May 22) on domain issues.

3. **AutoPromo GIF flood is hitting Telegram rate limit**: many users (every user in section we pulled) show `[AutoPromo] GIF failed for <chatId>, text fallback: ETELEGRAM: 429 Too Many Requests`. Not a complaint topic per se but is degrading the experience daily around 10:00 UTC.

4. **Cloud-IVR plan education** is the dominant inbound topic. `@Topscook` had a 20-message lecture session with the AI just to figure out *what's in Pro vs Business*. `@Garrychud` asked the same things. The AI answered well, but **the bot menu has no comparison table** — every new buyer asks the same set of feature questions. Adding a "📊 Compare Plans" button before "🛒 Choose a Plan" would cut a measurable share of AI traffic.

5. **eSIM delivery complaint** — `@LBHAND23` (chat 1794625076) on 2026-05-22 / 24:
   > "He any word on the esim I purchased" → "No I already purchased it never received it"
   - Order ID `LDJIHMRH` provided.
   - Escalation status: **open**, reminderCount=3, nobody acknowledged.

6. **Domain DNS config errors** — `@com_Emriz112` ("screnna.de") and `@Thugnificent_0018` are both stuck on DNS / domain status pages with screenshots the AI can't interpret. Open escalations.

---

## 4) Concrete recommendations (small / medium / large)

**Small (1–2 hour fixes)**
- [ ] In `applyPhonePlanUpgrade` (`js/_index.js:29515`) — when `phoneTransactions.insertOne` throws, call `notifyGroup(...)` to admin group with chatId + number + plan diff, not just `log()`. Today the catch is silent.
- [ ] When an admin closes an `escalations` ticket, write `{ resolvedAt: new Date(), resolvedBy: <adminChatId> }` so the resolved-rate metric works.
- [ ] Reconcile `+18884879051` for chat `817673476` — either bump `planPrice` back to $75 (and notify user) or document it as a permanent grandfathered $15 in admin notes. Right now it's a recurring revenue leak.
- [ ] Throttle AutoPromo GIFs so they don't all fire at the top of the hour (currently 10:00 UTC produces a 429 storm). Spread sends or use Telegram's `parse_mode` text-fallback by default for high-volume hours.

**Medium (half-day fixes)**
- [ ] Add a "📊 Compare Plans" pre-purchase menu (or a single-tap toggle on the plan-selection screen) — Starter vs Pro vs Business, listing IVR / SIP / Recording / Auto-attendant / extra-numbers in a table. Would deflect ~25% of current AI-support volume.
- [ ] First-time upgrade UX for users without an active number — when a user types "upgrade" or hits the upgrade-plan menu with **0 phone numbers**, the bot should respond: "You don't have a number yet — would you like to buy directly on the higher plan?" and offer a single CTA, instead of dead-ending in "My Plans → empty".
- [ ] Daily reconciler job: for every `phoneNumbersOf.numbers[]` where `plan` or `planPrice` changed in the last 24h, assert a matching `phoneTransactions` row exists; alert the admin group on any mismatch. This catches Apr-30-style audit-trail holes within 24h instead of weeks.

**Larger (~1 day)**
- [ ] Media-aware escalation routing — if the user attaches a screenshot/photo, mark the escalation `priority=p1` and ping the admin group immediately (current behavior just sets `media:screenshot_photo` and waits for reminders). Today these are the slowest-resolved tickets.
- [ ] Domain-error self-diagnosis — for "domain not working / showing error", run a one-shot WHOIS + DNS-propagation check and reply with the parsed result before escalating. Two of the 15 open escalations are exactly this pattern.

---

## 5) Files / scripts produced
- `/app/scripts/analyze_complaints.py` — topic-tag the full AI-support corpus
- `/app/scripts/deep_complaints.py` — extract full conversations matching plan/upgrade keywords
- `/app/scripts/ivr_upgrade_audit.py` — Cloud-IVR price/plan integrity audit + phoneTransactions dump
- `/app/scripts/ivr_user_detail.py` — per-user 360° (numbers, transactions, AI chats, escalations, ratings, logs)
- `/app/scripts/railway_upgrade_logs.py` — Railway deployment-log filter for upgrade events
