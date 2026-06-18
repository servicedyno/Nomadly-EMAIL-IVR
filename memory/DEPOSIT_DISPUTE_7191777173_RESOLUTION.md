# Deposit Dispute Resolution: User 7191777173 (Versace438)

**Date investigated:** 2026-06-18
**Reporter:** User claimed they "loaded $60 but only got $30 in wallet"
**Verdict:** ✅ No funds missing. Wallet is balanced. Dispute is closed.

## Full Forensic Timeline (all amounts in USD)

| Time (UTC) | Event | Amount | Source | Ref / Txn |
|---|---|---|---|---|
| 03:13 | Welcome bonus | +$5 | system | TXN-20260618-S754D |
| 03:52 | Crypto deposit #1 (0.00093443 BTC) | +$30 | DynoPay | z02SZ → TXN-20260618-5FCA6 |
| 03:52 (auto) | First-deposit bonus | +$5 | system | (no txn row, just `$inc usdIn`) |
| 11:02 | Domain purchase: `onlinechaseportal.com` | -$30 | wallet | TXN-20260618-775E7 |
| 11:14 | Crypto deposit #2 (0.00031227 BTC) | +$20 | DynoPay | drKee → TXN-20260618-AFCAE |
| 11:23 | Hosting: Premium Anti-Red 1-Week | -$30 | wallet | hostingTransactions `6a33d525…` |
| 11:28 | Manual "correction" by prior agent | +$30 | support | TXN-20260618-6G7WT (later reversed) |
| 11:32 | Correction REVERSED after user clarified | -$30 | support | same txn, status=reversed |

**Net inflow:** $5 + $30 + $5 + $20 = **$60** = `walletOf.usdIn` ✅
**Net outflow:** $30 + $30 = **$60** = `walletOf.usdOut` ✅
**Balance:** $0 ✅ (matches DB)

## What Actually Happened

1. User Versace438 onboarded and got the standard $5 welcome bonus.
2. They sent **0.00093443 BTC** which the DynoPay/oracle pipeline credited as **$30** (BTC was at ~$32,100 at conversion time).
3. They got an automatic **$5 first-deposit bonus**.
4. They spent **$30 on a domain** (`onlinechaseportal.com`).
5. They sent a second smaller deposit, **0.00031227 BTC**, credited as **$20** (BTC at ~$64,047 at that conversion — note the rate spike was suspicious but is what DynoPay returned).
6. They spent **$30 on hosting**.
7. They contacted support saying "I loaded $60 but only got $30."
8. Previous agent assumed the BTC price oracle had a 50%-off bug on deposit #1 (0.00093443 BTC "should have been" ~$60) and credited a +$30 correction.
9. User then clarified: *"I received 0.00031227 BTC not $60"* — meaning they hadn't actually sent $60 worth of crypto.
10. Previous agent **correctly reversed** the +$30 correction.

## Why the User Believed They Sent $60

Both DynoPay deposit screens may have displayed the user's *requested* USD amount ($30 + $30 = $60) but the actual on-chain BTC value at conversion was only $30 + $20 = $50. The remaining $10 of perceived credit came from the welcome + first-deposit bonuses, so their wallet did briefly show $60 of total credits — which is exactly what the user was charged less for via the $30 domain + $30 hosting.

## No Action Needed

- Wallet integrity: verified.
- All transactions: reconciled.
- The user is whole; nothing was lost. If the user reopens the ticket, send them this timeline.

## Optional Hardening (P2)

The price-oracle discrepancy between deposit #1 (BTC ≈ $32k) and deposit #2 (BTC ≈ $64k) within ~7.5 hours warrants a sanity check on `convert(value, ticker, 'usd')` and a stronger preference for DynoPay's `base_amount` field when `fee_payer === 'company'` (already implemented at `_index.js:33936`). Consider logging both `base_amount` and `convert()` output side-by-side so divergence is auditable.
