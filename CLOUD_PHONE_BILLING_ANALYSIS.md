# Cloud Phone / IVR Billing Analysis — Nomadly (Telnyx + Twilio)

_Read-only audit of how bot-user phone numbers are billed for inbound calls, forwarding
(US/CA + international), auto-attendant/IVR, outbound/SIP, and edge cases. No code changed._

Sources: `js/phone-config.js`, `js/voice-service.js` (Telnyx), `js/_index.js`
(`/twilio/*` webhooks), `js/twilio-service.js`, `js/bulk-call-service.js`,
`js/loyalty-service.js`, `js/retroactive-ivr-billing.js`.

---

## 1. Rate card (env → phone-config.js)

| Item | Var | Value |
|------|-----|-------|
| Starter plan | `PHONE_STARTER_PRICE` / `STARTER_MINUTES` / `STARTER_SMS` | $50/mo · 100 inbound min · 50 SMS |
| Pro plan | `PHONE_PRO_PRICE` / `PRO_MINUTES` / `PRO_SMS` | $75/mo · 400 min · 200 SMS |
| Business plan | `PHONE_BUSINESS_PRICE` / `BUSINESS_MINUTES` / `BUSINESS_SMS` | $120/mo · 600 min (or "Unlimited") · 300 SMS |
| Overage / US+CA per-min | `OVERAGE_RATE_MIN` | **$0.15/min** |
| Forwarding / intl per-min | `CALL_FORWARDING_RATE_MIN` | **$0.50/min** |
| Connection fee | `CALL_CONNECTION_FEE` | **$0.03/call** (SIP outbound only) |
| SMS overage | `OVERAGE_RATE_SMS` | $0.02/SMS |
| IVR / bulk per-min | `BULK_CALL_RATE_PER_MIN` (`IVR_CALL_RATE`) | **$0.15/min flat, any destination** |
| Loyalty discount | `loyalty-service.js` | Silver 5% ($100 spend) · Gold 10% ($500) · Platinum 15% ($1000). Multiplies the per-minute rate on **all** call billing. |

**Destination rate rule** (`getCallRate`): number starting `+1` (US/Canada) → $0.15/min;
everything else (international) → $0.50/min. IVR call types ignore this and use the flat $0.15.

---

## 2. The two billing buckets

`billCallMinutesUnified(chatId, phoneNumber, minutes, destination, callType, callRef)` is the
single choke-point for **all** call billing. It splits on `callType`:

**A. INBOUND** → plan minutes first, then wallet overage
- Call types: `Inbound` (Telnyx), `Twilio_Inbound`
- Increments `minutesUsed` on the number; once monthly allowance is exhausted, the **extra**
  minutes are charged from wallet at `getCallRate(destination)`.

**B. OUTBOUND** → charged **directly from wallet, plan minutes NOT used** (`OUTBOUND_CALL_TYPES`)
- `SIPOutbound`, `Forwarding`, `Bridge_Transfer`, `IVR_Outbound`, `IVR_Transfer`,
  `IVR_Outbound_Twilio`, `Twilio_SIP_Bridge`, `Twilio_SIP_Outbound`, `Twilio_Forwarding`,
  `Telnyx_SIP_Leg`, `AutoRoute_SIPOutbound`.

> ⚠️ **Key consequence:** _call forwarding is a wallet charge, not a plan-minute charge._
> The plan's "inbound minutes" only cover calls that terminate **on Nomadly** (SIP softphone,
> voicemail, IVR playback). The moment a call is forwarded to an external PSTN number it bills
> the wallet at $0.15 (US/CA) or $0.50 (intl) per minute.

---

## 3. Duration → minutes rounding & minimums

- `minutesBilled = Math.ceil(durationSeconds / 60)` — **always rounds up** (3s = 1 min, 61s = 2 min).
- **Outbound & forwarded (Telnyx):** 1-minute minimum even if unanswered (`duration 0 → 1`).
- **Inbound missed:** **0** — receiver never pays for a missed inbound call.
- **Bulk / IVR outbound:** `Math.max(1, ceil)` — always ≥ 1 min, **charged whether answered or not**.

---

## 4. Per-scenario matrix

| Scenario | Telnyx path | Twilio path | Billed to | Rate |
|----------|-------------|-------------|-----------|------|
| Inbound → SIP softphone / voicemail | `handleCallHangup` → `Inbound` | `sip-ring-result` → `Twilio_Inbound` | Plan minutes → wallet overage | $0.15 (US/CA caller) / $0.50 (intl caller) overage |
| Inbound → forward to **US/CA** | `Forwarding` / `Bridge_Transfer` | `voice-dial-status` (completed) → `Twilio_Forwarding` | Wallet | $0.15/min |
| Inbound → forward to **international** | same | same | Wallet | $0.50/min |
| Auto-attendant (IVR) menu playback + digit gather | (inbound leg) | `inbound-ivr-gather` | **Unbilled** (see §6.3) | — |
| IVR key-press → forward leg | `IVR_Transfer` | `voice-dial-status?fwdTo=…` → `Twilio_Forwarding` | Wallet | dest rate |
| Outbound SIP (softphone dials out) | real-time per-min timer + `SIPOutbound` | `Twilio_SIP_Outbound` | Wallet | dest rate + **$0.03 connection fee** |
| SIP bridge (2 carrier legs) | `Telnyx_SIP_Leg` | `Twilio_SIP_Bridge` | Wallet (**both legs**) | dest rate ×2 (see §6.4) |
| Quick / Bulk IVR outbound campaign | `IVR_Outbound` | `IVR_Outbound_Twilio` | Wallet | **flat $0.15/min**, answered or not |

---

## 5. Safety & integrity mechanisms (working as designed)

- **Pre-dial wallet gate + LOW_BALANCE lock:** calling locked when balance `< $1`
  (`LOW_BALANCE_TRIGGER`); requires `$50` (`LOW_BALANCE_RESUME`) to unlock. Telnyx SIP outbound
  runs a **real-time per-minute timer** that hangs up mid-call if the wallet empties.
- **Idempotency:** every charge keyed by `callRef = telnyx_<callControlId>` / `twilio_<CallSid>`
  → duplicate/retried webhooks never double-charge.
- **Debt force-settle (`forceWalletDebit`):** if a call was already connected but the wallet
  can't cover it, the charge is force-applied (balance may go negative) instead of leaking
  revenue; cleared on next deposit. New calls blocked while negative.
- **Concurrency reservation:** in-flight call cost is reserved so rapid concurrent dialing can't
  over-commit a thin balance.
- **Blocked forwarding prefixes:** premium/satellite/high-termination prefixes (900x, Inmarsat
  87x, Iridium 88x, Cuban 535, etc.) are refused for forwarding.
- **Post-call nudges:** `notifyLowBalance` / `notifyLowForwardingBalance` warn before the wallet
  can no longer sustain calls.

---

## 6. Findings — edge cases, asymmetries & risks

**6.1 Inbound overage rate depends on the _caller's_ country, not a flat inbound rate.**
For inbound overage the rate = `getCallRate(from)`. A call **from** a `+44` UK number **to** the
user's US number, once monthly minutes are exhausted, bills overage at **$0.50/min** (intl), not
$0.15. Non-obvious to customers who think of it as "my inbound minutes".

**6.2 Telnyx vs Twilio no-answer forwarding is inconsistent (3 different behaviors).**
- Telnyx single-leg forward (`phase='forwarding'`): **1-min minimum billed even on no-answer**.
- Telnyx bridge-transfer forward: bills **only if the destination answered** (`phase='bridged'`).
- Twilio plain forward: **$0 on no-answer/busy/failed** (only `sip_bridge`/`sip_outbound` get the
  1-min minimum). → Same customer action can cost differently depending on carrier/mechanism.

**6.3 Auto-attendant (IVR) menu time is unbilled.** The greeting playback + DTMF gather before a
key-press is not billed for either provider (only the forward leg is). The retroactive script even
notes "31s total − 6s IVR greeting". The carrier still charges Nomadly for that inbound air-time →
small structural margin leak, and unlimited/long IVR trees cost Nomadly nothing-per-customer.

**6.4 Twilio SIP-bridge double per-minute.** A bridged SIP call bills **both** the Telnyx SIP leg
(`Telnyx_SIP_Leg`) **and** the Twilio PSTN leg (`Twilio_SIP_Bridge`) for the same wall-clock
minutes → effectively ~2× the per-minute rate on bridged calls. Likely intentional (two real
carrier legs) but should be confirmed against actual carrier cost so it isn't an over-charge.

**6.5 Forward billing depends on a status callback that has failed before.** Twilio forward legs
are only billed when `/twilio/voice-dial-status` fires with `completed`. A missing/failed callback
= unbilled forward (a real past bug — `retroactive-ivr-billing.js` was written to recover those).
There is **no standing reconciliation sweeper**; if the callback silently stops, forwards leak
again until someone notices.

**6.6 Connection fee only on SIP outbound.** The $0.03 `CALL_CONNECTION_FEE` is applied to SIP
outbound / auto-routed calls but **not** to forwarding or inbound — the most common flow (inbound
→ forward) never incurs it. Confirm this is intended (vs. per-connected-call).

**6.7 Flat $0.50 international rate ignores true termination cost.** Beyond the blocked-prefix
list, every non-`+1` destination bills a flat $0.50/min. Some destinations cost Telnyx more than
$0.50 (margin loss), many cost far less (high margin). It's a deliberate simplification, not a
cost-plus model.

**6.8 Ceil rounding + 1-min minimums stack on short/failed attempts.** Repeated failed outbound
retries each bill a full minute; a 3-second forward bills a full minute. Standard telecom, but can
surprise users doing many short calls.

**6.9 Burst dialing can go slightly negative before the $1 lock.** The concurrency reservation is
an _estimate_; a burst of simultaneous outbound calls can push the balance below zero before the
lock engages (then force-settled as debt). Bounded (new calls blocked while negative) but real.

---

## 7. Suggested follow-ups (if you want to act)

1. **Standing billing-reconciliation cron** — sweep for connected forward/bridge legs with no
   matching `payments` row (generalize `retroactive-ivr-billing.js`) so callback failures can't
   silently leak revenue.
2. **Normalize no-answer forwarding** across Telnyx/Twilio (pick: never bill unanswered forwards,
   or always bill the 1-min minimum).
3. **Decide IVR-menu air-time policy** (either absorb it explicitly, or count it toward inbound
   plan minutes).
4. **Verify the Twilio SIP-bridge dual charge** against real carrier cost; document it in the
   Usage & Billing screen so bridged calls aren't perceived as double-charged.
5. **Clarify the inbound-overage-by-caller-country behavior** to users, or switch inbound overage
   to a single flat rate.
