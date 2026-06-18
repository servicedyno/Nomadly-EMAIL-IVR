# Wallet-Address Forensics — User 7191777173 (Versace438)

**Investigated:** 2026-06-18
**Source data:** Mongo (`payments`, `transactions`, `chatIdOfDynopayPayment`), Railway logs (`chat_7191777173_logs.json`), DynoPay API, blockstream.info BTC public explorer.

## Summary

| # | Ref | Time (UTC) | Address shared with user (DynoPay) | Crypto amount received | USD credited | Used? |
|---|---|---|---|---|---|---|
| 1 | `z02SZ` | 2026-06-18 03:42 | **`bc1qfgv4f6fz7w2z9z0zcs02c4hzn943vztd64j4l2`** | **0.00093443 BTC** (93,443 sats) | $30 | ✅ Yes — paid on-chain |
| 2 | `drKee` | 2026-06-18 ~11:14 | **UNKNOWN** (not stored — `chatIdOfDynopayPayment` is cleared after webhook ack) | **0.00031227 BTC** per DynoPay webhook | $20 | ✅ Webhook fired; no matching on-chain TX to address #1 |
| 3* | `4Ua6g` | 2026-06-18 ~11:01 | `bc1qfgv4f6fz7w2z9z0zcs02c4hzn943vztd64j4l2` (same as #1 — DynoPay shared a hot wallet) | **N/A** — abandoned | — | ❌ Generated for domain purchase but user paid via wallet instead |

*Item 3 is a domain-purchase invoice (`action=payDomain`, $30, `onlinechaseportal.com`) — not a wallet deposit, so it doesn't count toward the dispute. But it is the **only DynoPay address record still alive in Mongo** for this user (`chatIdOfDynopayPayment._id=4Ua6g`). It happens to be the same physical BTC address that received deposit #1; DynoPay reuses this hot wallet across customers.

## On-Chain Evidence (Deposit #1)

User submitted hash `01abbd84bf3934831a9513886fb1843b7a1886eab6702ae45de586082df228c1` in support chat at 11:11:18 UTC. Pulled from blockstream.info:

- **Confirmed in block 954183** at `2026-06-18T03:51:56Z`
- **Sender wallet (user's):** `bc1qjfnpl362zygzx09uhwn005zs3sflw7has35lxw`
- **Recipient (DynoPay):** `bc1qfgv4f6fz7w2z9z0zcs02c4hzn943vztd64j4l2`
- **Amount sent:** 93,443 sats = **0.00093443 BTC** ✅ matches DynoPay webhook & bot DB exactly
- **Network fee paid by user:** 282 sats
- **Change returned to sender:** 4,896 sats (0.00004896 BTC) → `bc1qca5rt4lj83emwq3mme3j4l0smn8jf3rf245803`
- **DynoPay credited:** $30 USD (BTC ≈ $32,103/BTC at conversion time)

## On-Chain Forensics for Deposit #2

The user's known sending wallet `bc1qjfnpl362zygzx09uhwn005zs3sflw7has35lxw` has **only ONE outgoing transaction** in its entire history — TX `01abbd84…28c1` (deposit #1). It did **NOT** send a second BTC transaction.

Scan of recent inbound TXs to DynoPay hot wallet `bc1qfgv4f6fz...`: between 03:51:56 (deposit #1) and 11:14:55 (drKee webhook), **NO TXs landed at this address**. The next inbound after deposit #1 was already past 11:14:55, and none matched 31,227 sats.

This means **deposit #2 (drKee, 0.00031227 BTC) did not arrive at the same on-chain address that received deposit #1**. Either:

1. DynoPay issued a different per-session BTC address for drKee (typical for HD-wallet-based processors), and we have no record of which address because `chatIdOfDynopayPayment` was deleted after webhook ack (`_index.js:33973`).
2. DynoPay credit this from an internal/balanced source (e.g., already-received UTXO matched by amount + memo).

DynoPay's API (`/user/getSingleTransaction/{payment_id}` → "Please provide a valid transaction_id!") does not accept the stored `payment_id` (which is the bot's webhook key) as a lookup key, so we cannot ask DynoPay directly which address it generated for drKee.

## How the Address Was Lost

`/app/js/_index.js:33973` runs `del(chatIdOfDynopayPayment, ref)` immediately after the webhook is processed. This cleans up state but **destroys forensic traceability** — the only thing left after a successful deposit is the `payments` collection row, which stores a CSV-encoded summary string but no address:

```
Crypto,Wallet,wallet,$20,7191777173,Versace438,Thu Jun 18 2026 11:14:55 GMT+0000 ...,0.00031227 BTC,transaction,a2b3a5a8-c103-4d63-bf89-8df4e5c1aadd
```

The bot DOES log the message text containing the address when it sends it (`_index.js:8373`), but the Railway log retention captured only the trailing keyboard button text (`"Nomadly Bot 📞 Cloud IVR..."` etc.) — the long deposit-info message with the address appears to have been truncated/filtered in the dump at `/app/memory/chat_7191777173_logs.json`.

## Implications for the $60-vs-$30 Dispute

The user's complaint was based on a misunderstanding. The on-chain trace **proves** they sent exactly **0.00093443 BTC** for deposit #1, which was correctly credited as $30. Whether they ever sent a second BTC TX for deposit #2 is unclear — DynoPay says yes, on-chain we can't see it on the address we know about. Either way, the bot's wallet for this user reconciles cleanly (`usdIn=$60, usdOut=$60`, balance $0).

## Recommended Hardening (P2 — not a blocker)

1. **Persist DynoPay deposit addresses** in a separate ledger row before calling `del(chatIdOfDynopayPayment, ref)`. Store `{ref, chatId, address, coin, expectedAmountUsd, generatedAt, sweepTxId?}` so future disputes are 100% traceable.
2. **Append the address** to the `payments[*].val` CSV string (currently 10 columns; add `address` as column 11). Backwards-compatible.
3. Capture the **DynoPay webhook payload verbatim** (incl. `from_address`, `txid`, `confirmations` fields when present) into a `dynopayWebhooks` collection at top of `app.post('/dynopay/crypto-wallet', ...)`.

## Files

- `/app/js/scripts/forensic_7191777173.js` — Mongo dump (wallet, payments, transactions, state)
- `/app/js/scripts/forensic_7191777173_v2.js` — walletLedger, walletAudit, hostingTransactions
- `/app/js/scripts/find_7191777173_addresses.js` — DB scan + DynoPay API probes
- `/app/js/scripts/onchain_trace_7191777173.js` — blockstream lookup of user-submitted TX hash
- `/app/js/scripts/onchain_trace_deposit2.js` — sender wallet + DynoPay hot wallet sweep
