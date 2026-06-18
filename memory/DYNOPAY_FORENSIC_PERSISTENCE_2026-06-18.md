# DynoPay Forensic Persistence — 2026-06-18

**Type:** P2 hardening (zero-bug fix; prevents future support-ticket pain)
**Trigger:** 2026-06-18 user-7191777173 deposit dispute proved that the bot was erasing every BTC/USDT address it ever generated, immediately after the webhook acked the credit.

## What Was Broken

`del(chatIdOfDynopayPayment, ref)` runs inside each of the 12 DynoPay webhook handlers (`/dynopay/crypto-wallet`, `/crypto-pay-hosting`, `/crypto-pay-vps`, etc.). The deletion happens RIGHT after the user is credited.

Side effect: the only durable record left in Mongo is `payments[ref].val`, a 10-column CSV string that does NOT contain the deposit address. So when a user 12 hours later says *"I sent $60, only got $30"*, there's no trail.

DynoPay's own API doesn't help — `/user/getSingleTransaction/{payment_id}` rejects our stored `payment_id` ("Please provide a valid transaction_id!"), and `/user/getCryptoTransaction/{address}` rejects swept addresses ("Please add valid address!").

## What This Patch Adds

### 1. `dynopayWebhooks` collection — every event archived verbatim

`authDyno` middleware (`/app/js/_index.js`) now calls `dynopayForensic.captureWebhook(db, req)` as its first instruction. **Every** webhook (pending / underpaid / failed / confirmed / settled) is persisted as:

```js
{
  receivedAt, endpoint, hostname, ip,
  refId, paymentId, event, status,
  amount, baseAmount, currency, address, txId,
  body: <full req.body verbatim>,
}
```

365-day TTL on `receivedAt`; lookup indexes on `refId` + `paymentId`.

### 2. `cryptoDepositAddresses` collection — address+session frozen before deletion

Right before `next()` (i.e. just after `authDyno` validates the session but BEFORE the handler runs `del(...)`), `dynopayForensic.archiveDepositAddress(db, ref, pay, req.body)` upserts:

```js
{
  _id: ref,
  chatId, action, address, coin, tickerView, expectedAmountUsd,
  domain, orderId, product, generatedAt,
  webhookEvent, webhookStatus, webhookPaymentId, webhookTxId,
  webhookBody: <full req.body of the confirming webhook>,
  archivedAt,
}
```

**No TTL** — these are audit records forever. Lookup indexes on `chatId`, `address`, `webhookPaymentId`.

### 3. `payments[*].val` CSV — backwards-compatible column-11 (address)

Wallet-top-up payments row now has 11 columns instead of 10. Last column is the deposit address. Older rows stay valid (readers must tolerate both lengths).

### 4. `ensureIndexes` runs once at boot

Wired into `startServer()` so the TTL + lookup indexes get created idempotently.

## Files

| File | Change |
|---|---|
| `/app/js/dynopay-forensic.js` | **new** — `captureWebhook`, `archiveDepositAddress`, `ensureIndexes` |
| `/app/js/_index.js` | `authDyno` calls `captureWebhook` + `archiveDepositAddress`; wallet handler appends address as CSV col-11; `startServer` calls `ensureIndexes` |
| `/app/js/__tests__/dynopay-forensic.test.js` | **new** — 36 assertions |

## What This Lets the Operator Do

After the next confirmed deposit lands:

```js
// Find every deposit by chatId — with addresses + on-chain txIds.
db.cryptoDepositAddresses.find({ chatId: '7191777173' }).sort({ archivedAt: -1 })

// Find which user a specific BTC address belonged to.
db.cryptoDepositAddresses.findOne({ address: 'bc1q...' })

// Replay the exact webhook payload of any past event.
db.dynopayWebhooks.find({ refId: 'z02SZ' })

// Find the on-chain TX hash for a disputed deposit instantly.
db.cryptoDepositAddresses.findOne({ _id: 'drKee' }).webhookTxId
```

No more "guessing" the on-chain trail.

## Important Caveat

This patch is **forward-only**. Historical deposits made BEFORE the patch ships (like the 2026-06-18 drKee transaction) remain undocumented at the DB level. The patch prevents future blind spots.

## Verified

- ESLint clean.
- 36/36 assertions pass: `node /app/js/__tests__/dynopay-forensic.test.js`.
- Tested with broken-db shim — both helpers swallow exceptions, never break the webhook flow.

## Regression Test Coverage

| Behavior | Assertion |
|---|---|
| Full webhook payload persisted | ✅ |
| refId/paymentId/event/status fields extracted | ✅ |
| Address + txId fields surfaced for fast lookup | ✅ |
| `cryptoDepositAddresses` keyed by ref (upsert) | ✅ |
| Re-archiving same ref updates instead of duplicating | ✅ |
| DB error in either helper never throws | ✅ |
| Correct TTL on dynopayWebhooks (365d) | ✅ |
| NO TTL on cryptoDepositAddresses (forever) | ✅ |
| Correct lookup indexes wired | ✅ |
| Helpers tolerate null inputs | ✅ |
