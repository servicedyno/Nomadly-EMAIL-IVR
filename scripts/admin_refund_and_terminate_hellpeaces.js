// ADMIN action: refund $75 auto-renewal to @hellpeaces + terminate cPanel account prevc2b4.
// Idempotent. Verifies each step. Run: node scripts/admin_refund_and_terminate_hellpeaces.js
require('dotenv').config({ path: '/app/backend/.env' })
const { MongoClient } = require('/app/node_modules/mongodb')
const { v4: uuidv4 } = require('/app/node_modules/uuid')

const CHAT = '5522767823'
const CPUSER = 'prevc2b4'
const DOMAIN = 'previteletterviews.com'
const REFUND = 75
const REFUND_MARKER = 'renewal_refund:5522767823:2026-08-03T13:02'  // idempotency key

;(async () => {
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db(process.env.DB_NAME || 'test')
  const walletOf = db.collection('walletOf')
  const walletLedger = db.collection('walletLedger')
  const transactions = db.collection('transactions')
  const cpanelAccounts = db.collection('cpanelAccounts')

  // ── STEP 1: Refund $75 (idempotent) ──────────────────────────
  console.log('── STEP 1: Refund $%d ──', REFUND)
  const existingRefund = await walletLedger.findOne({ chatId: CHAT, refundMarker: REFUND_MARKER })
  const wBefore = await walletOf.findOne({ _id: CHAT })
  console.log('  wallet before: usdIn=%s usdOut=%s bal=$%s', wBefore.usdIn, wBefore.usdOut, ((wBefore.usdIn||0)-(wBefore.usdOut||0)).toFixed(2))
  if (existingRefund) {
    console.log('  ✔ refund already applied (ledger %s) — skipping', existingRefund._id)
  } else {
    // reverse the deduction: usdOut -= 75
    await walletOf.updateOne({ _id: CHAT }, { $inc: { usdOut: -REFUND } })
    const wAfter = await walletOf.findOne({ _id: CHAT })
    const balAfter = (wAfter.usdIn || 0) - (wAfter.usdOut || 0)
    await walletLedger.insertOne({
      _id: uuidv4(), chatId: CHAT, type: 'hosting_renewal_refund', amount: +REFUND, currency: 'usd',
      balanceAfter: parseFloat(balAfter.toFixed(4)),
      description: `Refund $${REFUND}: auto-renewal reversed + hosting account cancelled (admin)`,
      refundMarker: REFUND_MARKER, domain: DOMAIN, cpUser: CPUSER, timestamp: new Date(),
    })
    await transactions.insertOne({
      _id: `TXN-REFUND-${Date.now().toString(36).toUpperCase()}`, chatId: CHAT, type: 'refund',
      amount: REFUND, currency: 'USD', status: 'completed',
      metadata: { reason: 'auto_renewal_reversed_account_cancelled', domain: DOMAIN, cpUser: CPUSER, admin: true, refundMarker: REFUND_MARKER },
      createdAt: new Date(), updatedAt: new Date(),
    })
    console.log('  ✅ refunded. wallet now: usdIn=%s usdOut=%s bal=$%s', wAfter.usdIn, wAfter.usdOut, balAfter.toFixed(2))
  }

  // ── STEP 2: Terminate cPanel account on WHM ─────────────────
  console.log('\n── STEP 2: Terminate WHM account %s ──', CPUSER)
  const whmService = require('/app/js/whm-service')
  let whmResult = 'unknown'
  try {
    const info = await whmService.getAccountInfo(CPUSER)
    if (info && info.success) {
      const ok = await whmService.terminateAccount(CPUSER)
      whmResult = ok ? 'removed' : 'removeacct_returned_false'
      console.log('  WHM getAccountInfo: exists=true → terminateAccount ->', ok)
    } else {
      whmResult = 'already_gone'
      console.log('  WHM getAccountInfo: account not found (already terminated)')
    }
  } catch (e) { whmResult = 'error:' + e.message; console.log('  WHM ERR', e.message) }

  // ── STEP 3: Cloudflare cleanup (worker routes + hosting DNS) ─
  console.log('\n── STEP 3: Cloudflare cleanup for %s ──', DOMAIN)
  try {
    const cfService = require('/app/js/cf-service')
    const antiRed = require('/app/js/anti-red-service')
    const zone = await cfService.getZoneByName(DOMAIN)
    if (zone) {
      await (antiRed.removeWorkerRoutes ? antiRed.removeWorkerRoutes(DOMAIN, zone.id).catch(e => console.log('  removeWorkerRoutes warn:', e.message)) : Promise.resolve())
      await cfService.cleanupAllHostingRecords(zone.id, DOMAIN).catch(e => console.log('  cleanupAllHostingRecords warn:', e.message))
      console.log('  ✅ CF cleanup attempted for zone', zone.id)
    } else {
      console.log('  (no CF zone found for', DOMAIN, '— skipping)')
    }
  } catch (e) { console.log('  CF cleanup ERR', e.message) }

  // ── STEP 4: Mark account deleted in DB ──────────────────────
  console.log('\n── STEP 4: Soft-delete cpanelAccounts doc ──')
  await cpanelAccounts.updateOne(
    { _id: CPUSER },
    { $set: {
      deleted: true, deletedAt: new Date(), deletedBy: 'admin', cancelledByUser: false,
      autoRenew: false, terminatedOnWhm: whmResult === 'removed' || whmResult === 'already_gone',
      terminationNote: `Admin cancel + $${REFUND} refund (unwanted auto-renew + comma-filename could not be deleted). WHM: ${whmResult}`,
      refundedUsd: REFUND, refundMarker: REFUND_MARKER,
      ...(whmResult === 'removeacct_returned_false' || whmResult.startsWith('error') ? { whmTerminatePending: true } : {}),
    } }
  )
  const acct = await cpanelAccounts.findOne({ _id: CPUSER })
  console.log('  cpanelAccounts now: deleted=%s autoRenew=%s terminatedOnWhm=%s refundedUsd=%s', acct.deleted, acct.autoRenew, acct.terminatedOnWhm, acct.refundedUsd)

  // ── FINAL VERIFY ────────────────────────────────────────────
  const wFinal = await walletOf.findOne({ _id: CHAT })
  console.log('\n═══ FINAL ═══')
  console.log('  wallet: usdIn=%s usdOut=%s → balance=$%s', wFinal.usdIn, wFinal.usdOut, ((wFinal.usdIn||0)-(wFinal.usdOut||0)).toFixed(2))
  console.log('  WHM termination result:', whmResult)
  console.log('  account deleted flag:', acct.deleted)
  await client.close()
})().catch(e => { console.error('FATAL', e); process.exit(1) })
