'use strict'
// ─────────────────────────────────────────────────────────────────────────
// Deposit funnel instrumentation
// ─────────────────────────────────────────────────────────────────────────
// Records two lightweight events per CRYPTO wallet-top-up so we can measure
// the "address generated → deposit completed" conversion over time — the
// single most important funnel for revenue (most services are paid from the
// wallet). Keyed by the deposit `ref` (same ref used for the PSP invoice /
// webhook), so intent and completion rows are joined automatically.
//
// Collection: depositFunnel  { _id: ref, chatId, amountUsd, coin, provider,
//   status: 'address_generated' | 'completed', generatedAt, completedAt,
//   creditedUsd }
//
// All writes are best-effort and MUST NEVER throw into the caller (a funnel
// write failure must not break a real deposit).
// ─────────────────────────────────────────────────────────────────────────

let _db = null

function initDepositFunnel(db) {
  _db = db
  // Index for time-series reporting (best-effort).
  try {
    _db.collection('depositFunnel').createIndex({ generatedAt: 1 }).catch(() => {})
    _db.collection('depositFunnel').createIndex({ status: 1, generatedAt: 1 }).catch(() => {})
  } catch (e) { /* ignore */ }
}

async function recordDepositIntent({ chatId, ref, amountUsd, coin, provider }) {
  if (!_db || !ref) return
  try {
    await _db.collection('depositFunnel').updateOne(
      { _id: String(ref) },
      {
        $set: {
          chatId: String(chatId),
          amountUsd: Number(amountUsd) || 0,
          coin: coin || null,
          provider: provider || null,
          status: 'address_generated',
          generatedAt: new Date(),
        },
      },
      { upsert: true }
    )
  } catch (e) { /* non-fatal */ }
}

async function recordDepositCompleted({ chatId, ref, amountUsd, provider }) {
  if (!_db || !ref) return
  try {
    await _db.collection('depositFunnel').updateOne(
      { _id: String(ref) },
      {
        $set: {
          chatId: String(chatId),
          status: 'completed',
          completedAt: new Date(),
          creditedUsd: Number(amountUsd) || 0,
          ...(provider ? { provider } : {}),
        },
        // If somehow no intent row exists (e.g. completion without a tracked
        // address step), keep the doc consistent.
        $setOnInsert: { generatedAt: null, amountUsd: Number(amountUsd) || 0 },
      },
      { upsert: true }
    )
  } catch (e) { /* non-fatal */ }
}

module.exports = { initDepositFunnel, recordDepositIntent, recordDepositCompleted }
