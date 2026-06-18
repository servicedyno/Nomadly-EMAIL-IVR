# Open-Ended Wallet Deposit Flow — 2026-06-18

**Type**: P1 UX upgrade
**Goal**: Remove friction from crypto wallet top-ups. No more typing amounts.

---

## Old vs. New Flow

| Step | OLD (4 inputs to address) | NEW (2 taps to address) |
|---|---|---|
| 1 | `➕💵 Deposit` | `➕💵 Deposit` |
| 2 | **Type amount** (e.g. `30`) | (skipped) |
| 3 | Pick method (Crypto) | (skipped — HIDE_BANK_PAYMENT=true) |
| 4 | Pick coin (`₿ BTC`) | Pick coin (`₿ BTC`) |
| 5 | Receive fixed-amount invoice (`Send 0.0004662 BTC = $30`) | Receive **open-ended address** (`Send any amount worth ≥ $10`) |

Address message now reads:

> 💎 **Send any amount of BTC** worth at least **$10 USD** to:
> `bc1q…`
>
> We'll credit the full market-value of whatever you send.
>
> ⚠️ **Deposits below $10 USD are forfeit** — the network fee to sweep them costs more than the deposit itself.

QR code encodes the **address only** (no amount embedded) — Option A per operator decision.

---

## Per-Coin Floors

Configured in `/app/js/config.js`:

| Coin | Floor | Why |
|---|---|---|
| BTC, LTC, DOGE, BCH, ETH, TRX, USDT-ERC20 | $10 | Low mempool/network fees |
| USDT-TRC20 | $20 | TRX-energy fee eats anything less |
| (unknown) | $10 (default) | Safe fallback |

Helper: `walletDepositMinFor(internalTicker)` — returns the floor for a coin or the default.

---

## Webhook Receipt Semantics

`/dynopay/crypto-wallet` now distinguishes two modes via `req.pay.openEnded`:

| Mode | How identified | Credit logic |
|---|---|---|
| **Open-ended** (new default) | `req.pay.openEnded === true` (set by `showDepositCryptoInfo` when creating the session) | Credit raw `convertedValue` — placeholder invoice ignored |
| **Legacy fixed-amount** | `openEnded` falsy | `max(invoice, convertedValue)` — preserves Versace438 overpayment fix |

After credit decision, both modes hit a uniform **per-coin floor check**:

```js
if (usdIn < walletDepositMinFor(ticker)) {
  // FORFEIT — log to dustDeposits, no wallet credit, no notification
  return res.send('Below minimum — forfeit (logged)')
}
await addFundsTo(walletOf, chatId, 'usd', usdIn, lang)
```

Forfeited deposits are logged to a new `dustDeposits` collection with full provenance:

```js
{
  chatId, ref, coin, ticker, value, receivedUsd, baseAmount,
  convertedValue, feePayer, minUsd, paymentId, address, txId,
  createdAt, body // full webhook payload
}
```

Operator can elect to refund manually (e.g. via a `/dispute <chatId>` admin command) — the data is all there.

---

## Files Changed

| File | Change |
|---|---|
| `/app/js/config.js` | Added `WALLET_DEPOSIT_MIN_DEFAULT_USD`, `WALLET_DEPOSIT_MIN_PER_COIN`, `walletDepositMinFor()` |
| `/app/js/_index.js` | `[a.selectCurrencyToDeposit]` goto now short-circuits to crypto picker when `HIDE_BANK_PAYMENT=true`; `showDepositCryptoInfo` uses min as placeholder invoice, sends address-only QR via `sendQr`, displays open-ended message; `selectCryptoToDeposit` action removes the TRC20 user-amount intercept; webhook handler adds `openEnded` branch + per-coin floor + dust-forfeit logging |
| `/app/js/lang/en.js`, `fr.js`, `zh.js`, `hi.js` | New `showDepositCryptoInfoOpenEnded(minUsd, tickerView, address)` string in all 4 languages |
| `/app/js/__tests__/wallet-deposit-open-ended.test.js` | New — 32 assertions |

The legacy fixed-amount code paths (and the deprecated `confirmTrc20MinDeposit` screen) remain in place as defensive dead code; they're unreachable from the new UX but harmless if some future flow re-introduces amount input.

---

## Verification

- ESLint clean.
- **5/5 regression suites green** (TRC20 intercept, addon-domain NS, DynoPay forensic, overpayment credit, open-ended deposit) — **97 total assertions**.
- Bot syntax check loads cleanly (dev-pod safety guard pauses startup as expected).
- Versace438 wallet integrity preserved ($90.10 in / $60 out / $30.10 balance).

---

## What This Closes

| Bug | Status |
|---|---|
| Friction of typing amount before depositing | ✅ Removed |
| Overpayment swallowed by base_amount logic | ✅ Fixed (Versace438 refund + code patch) |
| TRC20 sub-$20 bypass via display-key string comparison | ✅ Fixed (now receipt-time enforcement is the canonical check) |
| Below-min "dust" deposits credited fully (free-money for tiny sends) | ✅ Fixed — explicit forfeit + audit trail |

---

## Possible Follow-Ups (P2)

1. **`/dispute <chatId>` admin command**: surface `dynopayWebhooks` + `cryptoDepositAddresses` + `dustDeposits` for one chatId, formatted as a reconciled timeline. Resolve any future complaint in 2 seconds.
2. **Retrospective sweep**: query historical `payments` collection for any wallet-topup where `base_amount` may have under-credited overpayers. Make whole if found.
3. **(SHIPPED 2026-06-18) Telegram notification on dust forfeit**: when a deposit is below the floor, the bot now sends the user a localised message explaining the situation and directing them to 💬 Support if they need help. Localised in en/fr/zh/hi. Test coverage: 252 assertions in `__tests__/dust-deposit-notification.test.js`. The `dustDeposits` row carries `userNotified: true` + `userNotifiedAt` once the message is dispatched. No auto-combine / upsell logic — kept simple per operator decision.
