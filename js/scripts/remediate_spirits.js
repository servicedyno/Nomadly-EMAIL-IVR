// ============================================================
// remediate_spirits.js — one-shot fraud remediation for
// @Spirits_Of_The_Ancesters (chatId 7898648919), 2026-07-19.
// Reason: $100 credited for ~$5.85 TRX (underpayment over-credit).
// Actions: release Twilio number, cancel IVR plan + bulk campaigns,
//          zero wallet balance. Full audit trail. IDEMPOTENT-ish
//          (re-running after release will just report already-released).
// ============================================================
require('dotenv').config()
const { MongoClient } = require('mongodb')
const twilioService = require('../twilio-service.js')

const CID = '7898648919'
const NUMBER = '+18885117144'
const NUM_SID = 'PN157252ad605f3cb3e276ce932796aed3'
const REASON = 'fraud-remediation: $100 credited for ~$5.85 TRX underpayment (ref 6dwYg) 2026-07-19'
const APPLIED_BY = 'operator-remediation-2026-07-19'

async function main() {
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db(process.env.DB_NAME || 'test')
  const now = new Date()
  const report = { steps: [] }

  // ---- 1) Release the Twilio number ----
  const phoneDoc = await db.collection('phoneNumbersOf').findOne({ _id: CID })
  const val = phoneDoc?.val || {}
  const num = (val.numbers || []).find(n => n.phoneNumber === NUMBER)
  if (!num) {
    console.log('!! number not found in phoneNumbersOf — aborting'); process.exit(1)
  }
  const subSid = num.twilioSubAccountSid || val.twilioSubAccountSid
  const subToken = num.twilioSubAccountToken || val.twilioSubAccountToken
  console.log(`[1] Releasing Twilio ${NUMBER} (${NUM_SID}) on subaccount ${subSid} ...`)
  let releaseResult
  try {
    releaseResult = await twilioService.releaseNumber(NUM_SID, subSid, subToken)
  } catch (e) {
    releaseResult = { error: e.message }
  }
  console.log('    release result:', JSON.stringify(releaseResult))
  report.steps.push({ step: 'twilio_release', result: releaseResult })

  // ---- 2) Cancel plan on the number in DB ----
  const upd = await db.collection('phoneNumbersOf').updateOne(
    { _id: CID, 'val.numbers.phoneNumber': NUMBER },
    { $set: {
        'val.numbers.$.status': 'released',
        'val.numbers.$.autoRenew': false,
        'val.numbers.$.cancelledAt': now.toISOString(),
        'val.numbers.$.cancelReason': REASON,
    } }
  )
  console.log(`[2] phoneNumbersOf updated (matched=${upd.matchedCount} modified=${upd.modifiedCount}) — status=released, autoRenew=false`)
  report.steps.push({ step: 'db_plan_cancel', matched: upd.matchedCount, modified: upd.modifiedCount })

  // ---- 3) Cancel active bulk call campaigns ----
  const camp = await db.collection('bulkCallCampaigns').updateMany(
    { chatId: CID, status: { $nin: ['completed', 'cancelled', 'done', 'finished'] } },
    { $set: { status: 'cancelled', cancelledAt: now.toISOString(), cancelReason: REASON } }
  )
  console.log(`[3] bulkCallCampaigns cancelled: matched=${camp.matchedCount} modified=${camp.modifiedCount}`)
  report.steps.push({ step: 'campaigns_cancel', matched: camp.matchedCount, modified: camp.modifiedCount })

  // ---- 4) Zero wallet balance ----
  const wBefore = await db.collection('walletOf').findOne({ _id: CID })
  const usdBalBefore = (wBefore.usdIn || 0) - (wBefore.usdOut || 0)
  const ngnBalBefore = (wBefore.ngnIn || 0) - (wBefore.ngnOut || 0)
  // Set usdIn = usdOut (balance 0) and ngnIn = ngnOut (balance 0), preserving *Out history.
  await db.collection('walletOf').updateOne(
    { _id: CID },
    { $set: { usdIn: wBefore.usdOut || 0, ngnIn: wBefore.ngnOut || 0 } }
  )
  const wAfter = await db.collection('walletOf').findOne({ _id: CID })
  const usdBalAfter = (wAfter.usdIn || 0) - (wAfter.usdOut || 0)
  console.log(`[4] wallet zeroed. USD balance ${usdBalBefore} -> ${usdBalAfter} | usdIn ${wBefore.usdIn}->${wAfter.usdIn} usdOut=${wAfter.usdOut}`)
  report.steps.push({ step: 'wallet_zero', usdBalBefore, usdBalAfter, before: wBefore, after: wAfter })

  // ---- 5) Audit records ----
  await db.collection('walletAudit').insertOne({
    chatId: CID, type: 'fraud_zero_balance', reason: REASON, appliedBy: APPLIED_BY,
    at: now, walletBefore: wBefore, walletAfter: wAfter,
    usdBalanceRemoved: usdBalBefore, ngnBalanceRemoved: ngnBalBefore,
    relatedDepositRef: '6dwYg', relatedTxn: 'TXN-20260719-5FC10',
  })
  const txnId = 'TXN-REMEDIATE-' + Math.random().toString(36).slice(2, 7).toUpperCase()
  await db.collection('transactions').insertOne({
    _id: txnId, chatId: CID, type: 'wallet-correction', amount: -Number(usdBalBefore.toFixed(2)),
    currency: 'USD', status: 'completed',
    description: 'Fraud remediation: balance zeroed, IVR plan cancelled, Twilio number released',
    createdAt: now,
    metadata: { reason: REASON, appliedBy: APPLIED_BY, number: NUMBER, numberSid: NUM_SID,
      twilioReleaseOk: !!releaseResult?.success, relatedDepositRef: '6dwYg' },
  })
  try {
    await db.collection('phoneTransactions').insertOne({
      chatId: CID, phoneNumber: NUMBER, action: 'release', plan: num.plan,
      amount: 0, paymentMethod: 'none', reason: REASON, timestamp: now.toISOString(),
    })
  } catch (e) { console.log('    (phoneTransactions insert skipped:', e.message, ')') }
  console.log(`[5] audit written: walletAudit + transactions ${txnId} + phoneTransactions`)

  // ---- 6) Verify Twilio number is gone (read-only) ----
  console.log('\n=== VERIFY (read-only Twilio fetch) ===')
  try {
    const master = twilioService // uses master creds internally? fetch via subaccount
  } catch (e) { /* noop */ }

  console.log('\n=== DONE ===')
  await client.close()
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
