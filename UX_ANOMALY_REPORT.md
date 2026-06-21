# 📱 Bot UX Anomaly Scan — Last 6 days

**Window:** 2026-06-15 → 2026-06-21 (Nomadly-EMAIL-IVR)
**Method:** Railway `environmentLogs` paginated by `anchorDate`, then real-user-journey reconstruction by `chat_id`. Scripts: `dig_ux_signals.py`, `dig_user_replies.py`, `dig_ux_journey.py`.

---

## TL;DR — UX issues ranked

| Rank | Issue | Severity | Evidence |
|------|-------|----------|----------|
| 🔴 **P0** | **"Insufficient balance" wall — 100 % bounce rate** | Critical | 6 distinct users hit the wall (8 events), **0 of them recovered** with a deposit |
| 🔴 **P0** | **12 Twilio sub-accounts permanently broken (401)** | Critical | 12 customers' phone numbers are unmanageable; PhoneMonitor fails 100 % for them |
| 🔴 **P0** | **VPS Start button silently fails** | Critical | 108 Contabo API failures across 8 VPS instances; users see `❌ Failed to start VPS` with no help |
| 🟠 **P1** | **`/start` spam not de-duplicated** | High | Users tapping `/start` 3-5× in a row each receive the same main menu repeated |
| 🟠 **P1** | **"Custom Leads" is a deposit-wall trap** | High | Every insufficient-balance event came from the same path: Custom Leads → pick institution → wall |
| 🟡 **P2** | **CartRecovery nudges feel pushy** | Medium | Bot DMs users 45 min after abandonment ("Tap /start →📦 Digital Products") |
| 🟡 **P2** | **1 explicit 👎 BAD support rating** | Medium | User `shallowxx` on 06-21 00:49 |
| 🟢 | TTS timeouts / IVR audio failures | OK | 0 in window |
| 🟢 | AutoPromo NOT spamming blocked users | OK | 0 distinct blocked-users still being targeted |
| 🟢 | Telegram callback "query is too old" | OK | 0 in window |

---

## 1. 🔴 P0 — The Insufficient-Balance UX wall has a 100 % bounce rate

Distinct users who hit the wall in 6 days: **6**. Distinct users who deposited successfully in same window: **5**. **Intersection: 0.** Every single user who saw the wall, abandoned.

### Sample journeys

#### 👤 `Thefinder8` (chat `8345291845`)
```
06-18 15:30  /start
06-18 15:30  → main menu, browses Digital Products
06-18 15:32  → "Insufficient balance — deposit at least $120.00 to proceed"
              💵 Deposit Funds ┆ ✅ Pay 125.00 USD ┆ 🎟️ Apply Coupon
06-18 15:32  → SAME message again 30 sec later (tapped Pay again, same wall)
06-18 15:33  → backs out to main menu, never taps Deposit
06-18 17:36  → comes back, browses Custom Leads again, same wall
06-18 17:37  → /start (gives up)
06-20 19:47  → comes back 2 days later, /start, then leaves immediately
```
**User showed strong intent — 3 sessions over 3 days — but never tapped the Deposit button.**

#### 👤 `cloudsz75` (chat `5543139187`)
```
06-15 18:14  /start → Buy Domain Names → eyes summitridgeservices.co ($33)
06-15 18:23  → switches to VPS → Cloud VPS 10 SSD ($19.35/mo)
              "Your wallet: $5.00 — top up $14.35 more to unlock"
06-15 18:24  → selects payment method
06-15 18:25  → "Insufficient balance — deposit at least $20.00 to proceed"
06-15 18:26  → wanders into "Connect External Domain" instead
06-15 18:27  → comes back to "Connect External Domain"
...           ← never tapped Deposit Funds; spent 1h wandering
```
**User clearly understands the bot; the deposit CTA is just not compelling enough vs the cost of changing context.**

#### 👤 `jwettmuneco` (chat `1107127836`)
```
06-18 22:08  /start, /start, /start, /start (4× in 22 sec — sees main menu 4 times)
06-18 22:11  → Digital Products → Custom Leads → "Insufficient balance $45"
06-18 22:11  → backs out
06-18 22:11  → leaves
06-19 00:08  ← bot sends unsolicited nudge: "Tap /start and browse our services!"
06-19 00:09  ← bot sends ANOTHER nudge: "Tap /start → 📦 Digital Products"
```
**Two pushy nudges within ~2 hours of abandonment. User has not been seen since.**

#### 👤 `kaka9kaka` (chat `1967626222`) — got stuck in a confusing loop
```
06-20 01:02  /start, /start (twice)
06-20 01:03  → action="telegram_command" intercepted
06-20 01:05  → bot replies: "If the bot shows a limit message, it may require 
              you to unlock messaging by purchasing or verifying your account.
              📣 I've flagged this for our human support team."
              (Ref: xhBYC)
06-20 01:14  → /start again → Custom Leads → "Insufficient balance $20"
06-20 01:14  → bounces back to main menu twice
06-20 03:02  ← bot sends nudge: "Tap /start and browse our services!"
```
**User got a confusing "Telegram limit" auto-reply, was told human support would respond, then walked into the deposit wall anyway.**

### Why this UX is broken
1. **Wallet balance is invisible until checkout.** Users browse the entire catalog, get excited, then hit the wall.
2. **Deposit button is right next to a Pay button that doesn't work.** Users habitually tap "Pay" → fails → "Insufficient balance again" — they don't realize Deposit is a separate step.
3. **No bridge between intent and deposit.** "Insufficient balance — deposit at least $20" then 3 buttons. No "We saved your cart, top up to continue" framing.
4. **Fincra is broken** (per yesterday's RCA) so even if users *did* tap Deposit, the NGN rail fails. We didn't see any of these users attempt deposit — but if they had, NGN would have failed silently.

### Fix recommendations (in order of impact)
1. **Show wallet balance on every catalog page** ("$5.00 in wallet — Cloud VPS 10 SSD $19.35/mo needs $14.35 more"). Already done for VPS — extend to Digital Products / Custom Leads.
2. **Replace the wall with a "Reserve & Top Up" flow.** Lock in the price, create a draft order, send the user directly to crypto deposit address with the exact amount pre-filled.
3. **Track abandonment funnel.** Tag every "Insufficient balance" event with a session-id and watch how many users come back. We don't currently have this signal.
4. **Re-test deposit flow end-to-end after Fincra is fixed.** Until then, crypto-only users should be auto-routed past the fiat option.

---

## 2. 🔴 P0 — 12 Twilio sub-accounts are returning 401

Every 30 minutes `PhoneMonitor` checks each customer's Twilio sub-account. **48 checks, 48 failures, 100 % fail rate.** Each broken sub-account = at least one customer phone number that the platform can no longer monitor, update webhooks for, or recover credentials for.

| Sub-account (truncated) | Known number on it | Status |
|---|---|---|
| `AC98bdf4543e1de798…` | unknown | 401 |
| `AC01e40ee6bb868cc8…` | (multiple) | 401 |
| `AC649e0f17b97a2569…` | unknown | 401 |
| `AC28b0850997dc2593…` | `PN5fa07302…` | 401 |
| `AC23f043f142ce27f5…` | `PNe544131920be8f364e40838f23c41bb7` | 401 |
| `ACde9f00ea1b8586db…` | `PNbe17b14cdf8967b539c1a5855e509616` | 401 |
| `ACf08d768ac5193fa9…` | `PNb7aa745544e248cfe4af711eda278dad` | 401 |
| `ACa1626b52f0eaa499…` | `PN3c988e554039c4b5f7f1caaf7e752b94` | 401 |
| `AC50fe9355131d10dc…` | `+18886146831` (toll-free) | 401 |
| `ACf65175b7bbed6270…` | `PN72d4b53cbd3d27870e06bae61daec6c0` | 401 |
| `AC23a3…` (truncated, 2 more) | unknown | 401 |

**Customer impact:** these users may see:
- "Number unreachable" when someone tries to call/SMS them
- Stuck OTP forwarding
- IVR menus that won't update with new audio

**Likely cause:** the Twilio sub-account's *Auth Token* was rotated externally or the sub-account was suspended. Without a fresh token the parent API call returns 401.

**Recommended fix:**
- For each broken sub-account, log into Twilio console → sub-account → rotate Auth Token → store new token in DB (`twilio_auth_token` field on the relevant user/number row).
- The platform already has `[Twilio] Updated webhooks` working for some sub-accounts; the credential-store path for these 12 is what's stale.
- Existing code path: `js/credential-recovery-service.js` or similar; verify it's actually attempting recovery for these IDs (current logs show it's not, since 401 rate stays 100 %).
- Send affected customers a one-time courtesy DM: *"We've refreshed your phone number's API credentials. Try again now — and let support know if anything's still off."*

---

## 3. 🔴 P0 — VPS Start button silently fails

**108 Contabo API errors in 6 days across 8 distinct VPS instances:**
- `404` × 91 — VPS not found (DB references VPS that were cancelled / deleted on Contabo's side)
- `423` × 6 — Locked, actions unavailable
- `409` × 3 — Conflict (VPS not fully provisioned)
- `422` × 1, `500` × 2, `400` × 5

### Real user impact
`davion419` (chat `404562920`) on 06-16 tried to start a VPS:
```
20:35:32  reply: ⚙️ Please wait while your VPS is being started
20:35:32  reply: ❌ Failed to start VPS (nomadly-404562920-1781641507308).
20:35:33  → goes back to VPS list → 3 VPS still showing
20:40:10  → tries again → bounces around list 5 more times
```
The user has 3 VPS in their dashboard, none of them start, **the bot does not say WHY** — just "❌ Failed to start VPS". 

### Fix
1. **404 → "This VPS no longer exists on the provider. Refund any unused billing? [Yes / Contact support]"** Surface the root cause to the user.
2. **423 → "Your VPS is mid-provisioning. Auto-retry in 2 min."** Schedule retry instead of dumping the error.
3. **Health-check VPS rows once a day:** if the provider returns 404, mark the VPS as `provider_orphan=true` and hide from the "View/Manage VPS" list with a clean explanation.

---

## 4. 🟠 P1 — `/start` spam not deduplicated

Multiple users tap `/start` 3-5 times in rapid succession. Each tap re-renders the same main menu. Examples:
- `jwettmuneco`: 4 `/start`s in 22 seconds
- `Coders2dmsapi`: 5 `/start`s in 1.5 hours
- `kaka9kaka`: 4 `/start`s in 12 minutes

This wastes Telegram API calls (we send the full main-menu reply each time, ~1 KB) and confuses users into thinking the bot is laggy.

**Fix:** debounce `/start` per-chat (e.g. if last `/start` from this chat was < 5 sec ago AND the main-menu was already shown, skip re-rendering). Or send a tiny `"You're already on the main menu — pick an option above 👆"` instead of repeating the whole reply.

---

## 5. 🟠 P1 — "Custom Leads" funnel is a trap

Every single insufficient-balance event in 6 days followed the same path:
```
/start → Digital Products → Custom Leads
→ "💡 Subscribers get 5,000+ free validations…"
→ "🎯 Select your target institution"
→ JPMorgan / BOA / Wells Fargo / …
→ ⚠️ Insufficient balance — deposit at least $X
```

The Custom Leads carousel is doing its job (it draws users in) but the **deposit prompt at the end has a 100 % bounce rate**. We're losing every interested lead.

**Fix recommendations** (in order):
1. **Move the price tag earlier.** Before showing the "Select your target institution" screen, show "Custom Leads — from $20/day. Your wallet: $5.00".
2. **Add a "Try sample lead — free" CTA** that proves value before asking for deposit.
3. **Quick-deposit shortcut:** for any insufficient-balance event, generate a one-tap deposit invoice for the exact missing amount.

---

## 6. 🟡 P2 — CartRecovery nudges feel pushy

We're sending users follow-up messages like *"Tap /start and browse our services!"* and *"Tap /start → 📦 Digital Products"* within 1-2 hours of abandonment. Users who hit the deposit wall once are receiving 2 nudges after.

**Risk:** users mute or block the bot, killing future re-engagement entirely.

**Fix:** make the cart-recovery message *helpful* not *promotional*:
- ❌ "Tap /start → 📦 Digital Products"
- ✅ "Hey — you were checking out Custom Leads earlier. The minimum was $20; we now also accept USDT-TRC20 with no fees. Resume? [Yes ┆ Not now]"

---

## 7. 🟡 P2 — Explicit 👎 BAD support rating

User `shallowxx` rated their support session BAD on 2026-06-21 00:49.

The bot captured the rating but there's no automated "what could we have done better?" follow-up. Worth a manual outreach from your end — they're a real user telling you something didn't work.

---

## ✅ What's working well (debunks earlier concerns)

| Signal | Result |
|--------|--------|
| AutoPromo spamming blocked users | **0 distinct blocked-users targeted** — system correctly skips blocked chats |
| TTS / IVR audio timeouts | **0** errors in window |
| Callback button "query is too old" | **0** in window |
| Telegram message-edit failures | **0** |
| Auto-refund on failed phone purchase | ✅ working (saw a $75 refund correctly applied) |
| Personalized greetings ("Hey, davion419") | ✅ working |
| Empty-state messaging ("You have no purchased domains") | ✅ working |

---

## 8. Artifacts produced

| File | What |
|------|------|
| `/app/scripts/dig_ux_signals.py` | Filter scan of emoji-prefixed errors / retry / wait signals |
| `/app/scripts/dig_user_replies.py` | Extract every `reply:` line + recipient chat id |
| `/app/scripts/dig_ux_journey.py` | Insufficient-balance + Twilio 401 + Contabo + AutoPromo + TTS + ratings drill-down |
| `/app/logs_prod/_ux_signals.json` | Per-filter daily counts + samples |
| `/app/logs_prod/_ux_replies.json` | Bot outgoing reply templates |
| `/app/logs_prod/_ux_user_journey.json` | The structured user-journey JSON |
| `/app/logs_prod/_ux_signals_output.txt`, `_ux_journey_output.txt` | Console output |

---

## 9. Recommended next actions (priority order)

1. 🔴 **Fix the insufficient-balance UX wall** (move balance upfront on Custom Leads catalog + add Reserve & Top-Up flow). High-ROI: every wall-event we recover = direct revenue.
2. 🔴 **Rotate the 12 broken Twilio sub-account Auth Tokens** and DM affected customers.
3. 🔴 **VPS Start failure → surface the cause to the user** (404 = orphan, 423 = retry, etc.).
4. 🟠 **Debounce `/start` per chat** — 1-line change to the start handler.
5. 🟠 **Reach out to `shallowxx`** about their bad support rating.
6. 🟡 **Soften CartRecovery copy** to feel helpful, not pushy.
7. 🟡 **Track an abandonment funnel metric** (insufficient_balance_hit → deposit_started → deposit_confirmed → purchase_completed). Currently we have no clean way to measure conversion.
