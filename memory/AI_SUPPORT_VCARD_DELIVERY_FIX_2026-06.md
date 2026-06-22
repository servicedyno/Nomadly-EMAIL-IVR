# AI Support — Virtual Card "paid but not delivered" handling fix (2026-06)

## Why
Real users paid for virtual cards via **confirmed crypto** but the orders sat
`pending` (cards are issued MANUALLY). When they asked support, the AI replied
with a FALSE + harmful line:

> "your wallet shows $0.00 … the payment might not have completed successfully"

Crypto payments never touch the wallet balance, so $0 wallet is normal. The AI
had **no visibility** into `digitalOrders`, so it guessed wrong and looped users.

Evidence (prod):
- @billymind (6773976684) — order `WMYLXTVB`, Virtual Card $70 (paid $90 BTC),
  `payment.confirmed` 2026-06-20 16:01 UTC, status still `pending`. AI told him
  payment may not have completed → escalated, never delivered.
- @azsoft788 (6177444784) — order `XK17PIGG`, Virtual Card $50 (paid $70 LTC),
  confirmed 2026-06-21 15:00 UTC, status `pending`. Admin chatted but never
  issued the card; user called it a "scam".

## What changed — `js/ai-support.js`
1. **`getUserContext()` now reads `digitalOrders`** (last 5) and surfaces each
   order's product/price/payment-method/status + `PAYMENT CONFIRMED <ts>`. When
   an order is paid/confirmed but undelivered it emits a
   `🚨 PAID-BUT-UNDELIVERED` guidance block telling the AI: this is normal
   (manual issuance), do NOT say the payment failed / "check your wallet", and
   ESCALATE so a human issues it.
2. **KB corrected**: removed the false "Delivery: Instant" claim from both
   Virtual Card blocks → cards are "issued manually by our team after payment
   confirms"; crypto payments don't show in wallet balance.
3. **New KB Q&A**: "I paid for my virtual card but haven't received it" with
   explicit do/don'ts and an always-escalate rule.
4. **Escalation MUST-list**: added "Paid-but-undelivered orders (virtual card /
   digital product PAID/CONFIRMED but still PENDING)".
5. Exported `getUserContext` for testing.

## Verification
`node /tmp/test_ai_vcard.js` → 9/9 pass:
- Context for @billymind + @azsoft788 now shows the order + PAID-BUT-UNDELIVERED flag (read-only).
- Seeded isolated test user: AI reply now = "your payment is confirmed … being
  issued manually … flagging for our team", `escalate=true`, no "payment failed"
  language. (test data cleaned up afterward)

## Deploy to production
Dev pod validated. To make it live for real users: **Save to GitHub** in chat →
Railway auto-redeploys the Nomadly-EMAIL-IVR bot.

## NOT addressed here (separate decisions, awaiting user)
- The two stuck orders (`WMYLXTVB`, `XK17PIGG`) are still undelivered — need
  manual issuance or refund.
- Systemic: virtual card fulfilment is fully manual with no SLA/auto-nudge;
  consider an admin reminder for `digitalOrders` pending > N hours.
