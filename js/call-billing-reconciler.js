'use strict'
/**
 * Call-Billing Reconciler
 * ────────────────────────────────────────────────────────────────────────────
 * Closes the "connected-but-unbilled" revenue leak (LEAK #1 from the billing
 * audit — the same class of bug that `retroactive-ivr-billing.js` was a one-off
 * fix for).
 *
 * ROOT CAUSE: Twilio forward / IVR-forward legs are only billed when the
 * `/twilio/voice-dial-status` callback fires with DialCallStatus=completed. If
 * that callback is dropped (webhook downtime during a Railway redeploy, a 5xx,
 * a proxy hiccup) the connected forward is billed $0 — permanently, with no
 * standing safety net.
 *
 * DESIGN (double-charge-proof):
 *  1. At dial time we write a durable `pendingCallBills` worklist row keyed by
 *     the EXACT `callRef` the billing webhook will use (`twilio_<parentCallSid>`).
 *  2. When the webhook bills, it writes a `walletLedger` row with that callRef
 *     (existing behaviour — idempotency ledger).
 *  3. This sweeper periodically compares the two:
 *       • pending row HAS a matching walletLedger callRef  → webhook worked, mark settled.
 *       • pending row has NO matching walletLedger callRef  → the callback was
 *         missed. Fetch the leg's true duration from the provider and settle via
 *         the EXISTING idempotent `billCallMinutesUnified(...)` (same callRef →
 *         a later duplicate webhook can never double-charge).
 *
 * SAFETY: settlement WRITES to wallets, so it is gated to production. On the dev
 * sandbox (`SKIP_WEBHOOK_SYNC=true`) the scheduled sweep is skipped and the admin
 * endpoint refuses non-dry-run. Dry-run mode is read-only and is exactly the
 * "quantify the leak" report.
 */

let _db = null
let _bot = null
let _notifyAdmin = null
let _pending = null        // pendingCallBills collection
let _walletLedger = null   // idempotency + charge ledger (keyed by callRef)
let log = (...a) => console.log('[CallRecon]', ...a)

const GRACE_MINUTES = parseInt(process.env.CALL_RECON_GRACE_MIN || '10', 10)
const MAX_AGE_HOURS = parseInt(process.env.CALL_RECON_MAX_AGE_HOURS || '72', 10)
const OVERAGE_RATE_MIN = parseFloat(process.env.OVERAGE_RATE_MIN || '0.15')
const CALL_FORWARDING_RATE_MIN = parseFloat(process.env.CALL_FORWARDING_RATE_MIN || '0.50')

function isUSCanada(phone) {
  return !!phone && phone.replace(/[^+\d]/g, '').startsWith('+1')
}
// Mirror of voice-service.getCallRate so estimated leak $ matches production billing.
function estRate(dest) {
  return isUSCanada(dest) ? OVERAGE_RATE_MIN : CALL_FORWARDING_RATE_MIN
}

/**
 * Fix #2 helper — provider-drift-tolerant number lookup for the Twilio webhook.
 * Strict match first (phoneNumber + provider==='twilio'); if the `provider`
 * field drifted, fall back to phoneNumber-only so a real, connected, billable
 * forward is never silently skipped. Pure function (no I/O) → unit-testable.
 * @returns {{ num: object|null, drifted: boolean }}
 */
function resolveOwnedTwilioNumber(numbers, phoneNumber) {
  if (!Array.isArray(numbers) || !phoneNumber) return { num: null, drifted: false }
  const strict = numbers.find(n => n && n.phoneNumber === phoneNumber && n.provider === 'twilio')
  if (strict) return { num: strict, drifted: false }
  const loose = numbers.find(n => n && n.phoneNumber === phoneNumber)
  if (loose) return { num: loose, drifted: true }
  return { num: null, drifted: false }
}

function init({ db, bot, notifyAdmin, logger } = {}) {
  _db = db
  _bot = bot || null
  _notifyAdmin = notifyAdmin || null
  if (typeof logger === 'function') log = logger
  if (db) {
    _pending = db.collection('pendingCallBills')
    _walletLedger = db.collection('walletLedger')
    // Best-effort indexes (idempotent). _id === callRef already guarantees uniqueness.
    _pending.createIndex({ status: 1, createdAt: 1 }).catch(() => {})
  }
  return module.exports
}

/**
 * Record a durable pending-bill worklist row at dial time. Best-effort and
 * NON-THROWING — this runs inside the hot webhook path and must never break the
 * TwiML response. Keyed by `_id = callRef` so re-records for the same call no-op.
 */
async function recordPendingBill(rec = {}) {
  try {
    if (!_pending || !rec.callRef) return
    await _pending.updateOne(
      { _id: rec.callRef },
      {
        $setOnInsert: {
          _id: rec.callRef,
          callRef: rec.callRef,
          chatId: rec.chatId != null ? String(rec.chatId) : null,
          phoneNumber: rec.phoneNumber || null,
          destination: rec.destination || null,
          callType: rec.callType || 'Twilio_Forwarding',
          provider: rec.provider || 'twilio',
          subAccountSid: rec.subAccountSid || null,
          status: 'pending',
          createdAt: new Date(),
        },
      },
      { upsert: true }
    )
  } catch (_) { /* swallow — never break billing/hangup path */ }
}

/** Mark a pending row settled (best-effort). */
async function markBillSettled(callRef, via = 'webhook') {
  try {
    if (!_pending || !callRef) return
    await _pending.updateOne(
      { _id: callRef },
      { $set: { status: 'settled', settledVia: via, settledAt: new Date() } }
    )
  } catch (_) { /* best-effort */ }
}

/**
 * Fetch the answered forward-leg duration (seconds) for a Twilio parent call.
 * The forward leg is a CHILD call (`parentCallSid = <parent>`). Master creds can
 * read a sub-account's calls via `client.api.v2010.accounts(subSid)`.
 * @returns {{connected:boolean, seconds:number}|null}  null = indeterminate
 */
async function fetchTwilioLegDuration(parentSid, subAccountSid) {
  try {
    if (!parentSid) return null
    const twilioService = require('./twilio-service.js')
    const client = twilioService.getClient && twilioService.getClient()
    if (!client) return null
    const acct = subAccountSid ? client.api.v2010.accounts(subAccountSid) : client
    const children = await acct.calls.list({ parentCallSid: parentSid, limit: 10 })
    let best = null
    for (const c of children) {
      const dur = parseInt(c.duration || '0', 10)
      if (c.status === 'completed' && dur > 0 && (best == null || dur > best)) best = dur
    }
    if (best != null) return { connected: true, seconds: best }
    return { connected: false, seconds: 0 }
  } catch (e) {
    log('leg-duration fetch error:', e.message)
    return null
  }
}

/**
 * Sweep the pending worklist and reconcile against walletLedger.
 * @param {object} opts
 * @param {boolean} opts.dryRun  default TRUE (read-only, safe). false = settle wallets.
 * @param {number}  opts.graceMinutes  only sweep rows older than this (webhook still in-flight otherwise)
 * @param {number}  opts.maxAgeHours   don't try to bill calls older than this (mark stale)
 * @param {string}  opts.callRefPrefix optional isolation filter (used by the dev test)
 */
async function sweepPendingBills(opts = {}) {
  const dryRun = opts.dryRun !== false
  const grace = opts.graceMinutes != null ? opts.graceMinutes : GRACE_MINUTES
  const maxAgeH = opts.maxAgeHours != null ? opts.maxAgeHours : MAX_AGE_HOURS
  const summary = {
    dryRun, scanned: 0, reconciledByWebhook: 0, leaksFound: 0, leakedUsd: 0,
    settled: 0, needsReview: 0, noCharge: 0, stale: 0, details: [],
  }
  if (!_pending || !_walletLedger) return summary

  const now = Date.now()
  const olderThan = new Date(now - grace * 60 * 1000)
  const floor = new Date(now - maxAgeH * 3600 * 1000)
  const query = { status: 'pending', createdAt: { $lte: olderThan } }
  if (opts.callRefPrefix) query.callRef = { $regex: '^' + opts.callRefPrefix }

  const rows = await _pending.find(query).sort({ createdAt: 1 }).limit(opts.limit || 500).toArray()

  for (const row of rows) {
    summary.scanned++

    // Too old to reliably reconstruct/bill → close as stale.
    if (row.createdAt < floor) {
      summary.stale++
      if (!dryRun) await _pending.updateOne({ _id: row._id }, { $set: { status: 'stale', settledAt: new Date() } }).catch(() => {})
      continue
    }

    // Already billed? walletLedger is keyed by callRef.
    const led = await _walletLedger.findOne({ callRef: row.callRef })
    if (led) {
      summary.reconciledByWebhook++
      if (!dryRun) await markBillSettled(row.callRef, 'webhook')
      continue
    }

    // No ledger row → suspected leak (connected forward the webhook never billed).
    let connected = null
    let minutes = null
    if (row.provider === 'twilio') {
      const parentSid = (row.callRef || '').replace(/^twilio_/, '')
      const legs = await fetchTwilioLegDuration(parentSid, row.subAccountSid)
      if (legs) {
        connected = legs.connected
        if (legs.connected) minutes = Math.max(1, Math.ceil(legs.seconds / 60))
      }
    }

    // Provider confirms the leg never connected → nothing owed. Close it.
    if (connected === false) {
      summary.noCharge++
      if (!dryRun) await _pending.updateOne({ _id: row._id }, { $set: { status: 'no_charge', settledAt: new Date() } }).catch(() => {})
      continue
    }

    // This IS a leak (either confirmed connected, or duration indeterminate).
    summary.leaksFound++
    const rate = estRate(row.destination)
    const estCharge = minutes != null ? +(minutes * rate).toFixed(4) : null
    if (estCharge) summary.leakedUsd += estCharge
    summary.details.push({
      callRef: row.callRef, chatId: row.chatId, phoneNumber: row.phoneNumber,
      destination: row.destination, callType: row.callType, connected, minutes, rate, estCharge,
    })

    if (minutes == null) {
      // Couldn't determine duration (no subAccount, provider read failed, non-twilio) → human review.
      summary.needsReview++
      if (!dryRun) await _pending.updateOne({ _id: row._id }, { $set: { status: 'needs_review', lastSweptAt: new Date() } }).catch(() => {})
      continue
    }

    // We know the minutes → settle via the EXISTING idempotent biller (unless dry-run).
    if (!dryRun) {
      try {
        const voiceService = require('./voice-service.js')
        await voiceService.billCallMinutesUnified(
          row.chatId, row.phoneNumber, minutes, row.destination,
          row.callType || 'Twilio_Forwarding', row.callRef
        )
        await markBillSettled(row.callRef, 'sweeper')
        summary.settled++
      } catch (e) {
        log('settle error', row.callRef, e.message)
        summary.needsReview++
      }
    }
  }

  if (summary.leaksFound > 0 && _notifyAdmin && !dryRun) {
    _notifyAdmin(
      `🧾 [CallRecon] sweep ${dryRun ? '(DRY-RUN)' : ''}: ${summary.leaksFound} unbilled connected leg(s) ~$${summary.leakedUsd.toFixed(2)}` +
      `${dryRun ? '' : `, settled ${summary.settled}`}. scanned=${summary.scanned} webhookOk=${summary.reconciledByWebhook} needsReview=${summary.needsReview} noCharge=${summary.noCharge}`
    ).catch(() => {})
  }
  return summary
}

module.exports = {
  init,
  recordPendingBill,
  markBillSettled,
  sweepPendingBills,
  resolveOwnedTwilioNumber, // Fix #2
  fetchTwilioLegDuration,
  isUSCanada,
  estRate,
}
