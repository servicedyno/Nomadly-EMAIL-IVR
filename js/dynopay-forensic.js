/**
 * dynopay-forensic.js — persist DynoPay webhook payloads + deposit-address
 * sessions BEFORE the bot deletes them, so future support disputes can be
 * resolved from local DB without going back to the gateway.
 *
 * Why this exists
 *   The webhook handlers in `_index.js` do
 *     `del(chatIdOfDynopayPayment, ref)`
 *   right after a successful credit. That cleans up active intent state but
 *   erases the only record of which BTC/USDT address we generated for the
 *   user. When a user later disputes a deposit ("I sent $60, only got $30")
 *   we have to guess the on-chain trail.
 *
 *   Real incident: 2026-06-18 user 7191777173 deposit dispute. We had refs
 *   (z02SZ / drKee) and DynoPay payment_ids but no addresses — DynoPay's
 *   getSingleTransaction API returns "valid transaction_id required" for
 *   payment_ids, so the address chain was unrecoverable.
 *
 *   This module closes the gap.
 *
 * Two collections written:
 *
 *   dynopayWebhooks — every authDyno hit (incl. pending/underpaid/failed)
 *     {
 *       _id: <auto>,
 *       receivedAt: ISO,
 *       endpoint: '/dynopay/crypto-wallet' | '/dynopay/crypto-pay-hosting' | ...,
 *       hostname, ip,
 *       refId: <if extractable>,
 *       paymentId, event, status,
 *       body: <full req.body verbatim>,
 *     }
 *   Retention: capped at 100k rows via TTL index on receivedAt (365 days).
 *
 *   cryptoDepositAddresses — one row per active deposit-address generation
 *     {
 *       _id: ref,
 *       chatId, action, address,
 *       coin, tickerView,
 *       expectedAmountUsd,
 *       generatedAt: ISO,
 *       webhookEvent: 'payment.confirmed' | 'payment.settled' | ...,
 *       webhookPayload: <full req.body of the confirming webhook>,
 *       archivedAt: ISO,
 *     }
 *   Survives the `del(chatIdOfDynopayPayment, ref)` — it is the durable copy.
 */

const captureWebhook = async (db, req) => {
  if (!db || !req) return
  try {
    const body = req.body || {}
    await db.collection('dynopayWebhooks').insertOne({
      receivedAt: new Date(),
      endpoint: req.originalUrl || req.url || '',
      hostname: req.hostname || '',
      ip: req.ip || (req.headers && req.headers['x-forwarded-for']) || '',
      refId: body?.meta_data?.refId || null,
      paymentId: body?.payment_id || null,
      event: body?.event || null,
      status: body?.status || null,
      amount: body?.amount ?? null,
      baseAmount: body?.base_amount ?? null,
      currency: body?.currency || null,
      address: body?.address || null,
      txId: body?.txId || body?.transaction_reference || null,
      body,
    })
  } catch (e) {
    // Forensic logging must never break the webhook flow.
    try { console.log('[DynopayForensic] captureWebhook err (non-fatal):', e.message) } catch (_) { /* ignore */ }
  }
}

const archiveDepositAddress = async (db, ref, pay, webhookBody) => {
  if (!db || !ref || !pay) return
  try {
    await db.collection('cryptoDepositAddresses').updateOne(
      { _id: ref },
      {
        $set: {
          chatId: pay.chatId ? String(pay.chatId) : null,
          action: pay.action || null,
          address: pay.address || webhookBody?.address || null,
          coin: webhookBody?.currency || null,
          tickerView: pay.tickerView || null,
          expectedAmountUsd: pay.price || pay.amount || pay.expectedAmountUsd || null,
          domain: pay.domain || null,
          orderId: pay.orderId || null,
          product: pay.product || null,
          generatedAt: pay._createdAt || null,
          archivedAt: new Date(),
          webhookEvent: webhookBody?.event || null,
          webhookStatus: webhookBody?.status || null,
          webhookPaymentId: webhookBody?.payment_id || null,
          webhookTxId: webhookBody?.txId || webhookBody?.transaction_reference || null,
          webhookBody: webhookBody || null,
        },
      },
      { upsert: true }
    )
  } catch (e) {
    try { console.log('[DynopayForensic] archiveDepositAddress err (non-fatal):', e.message) } catch (_) { /* ignore */ }
  }
}

/**
 * Create TTL + lookup indexes on first use. Call once at boot.
 */
const ensureIndexes = async (db) => {
  if (!db) return
  try {
    // 365-day TTL on webhook payloads
    await db.collection('dynopayWebhooks').createIndex(
      { receivedAt: 1 },
      { expireAfterSeconds: 365 * 24 * 60 * 60 }
    )
    await db.collection('dynopayWebhooks').createIndex({ refId: 1 })
    await db.collection('dynopayWebhooks').createIndex({ paymentId: 1 })

    // No TTL on cryptoDepositAddresses — we want these forever for audit.
    await db.collection('cryptoDepositAddresses').createIndex({ chatId: 1 })
    await db.collection('cryptoDepositAddresses').createIndex({ address: 1 })
    await db.collection('cryptoDepositAddresses').createIndex({ webhookPaymentId: 1 })
  } catch (e) {
    try { console.log('[DynopayForensic] ensureIndexes warning (non-fatal):', e.message) } catch (_) { /* ignore */ }
  }
}

module.exports = {
  captureWebhook,
  archiveDepositAddress,
  ensureIndexes,
}
