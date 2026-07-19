// ============================================================
// reverse_underpaid_products.js — reverse the two exploited product grants
// from the underpayment over-credit bug (2026-07-19 remediation):
//   • 3R9ly: hosting cPanel account evit8c7c (evitelesspost.com), chatId 8011229362
//            — paid $58.94 for a $105 "Premium Anti-Red HostPanel (1-Month)".
//            Action: SUSPEND (reversible) via WHM + mark DB. (NOT hard-terminate.)
//   • sAoKK: marketplace access, chatId 8980682151 (billy58712)
//            — paid $4.23 for the $50 one-time access. Action: REVOKE.
// Full audit trail. READ/WRITE — run once.
// ============================================================
require('dotenv').config()
const { MongoClient } = require('mongodb')
const whm = require('../whm-service.js')

const HOST_CID = '8011229362'
const CPUSER = 'evit8c7c'
const DOMAIN = 'evitelesspost.com'
const MP_CID = '8980682151'
const REASON = 'fraud-remediation: underpaid crypto (invoice>>actual) — over-credit bug 2026-07-19'
const APPLIED_BY = 'operator-remediation-2026-07-19'

async function main() {
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db(process.env.DB_NAME || 'test')
  const now = new Date()

  // ===== 1) HOSTING: verify + suspend =====
  console.log(`[H1] Reading WHM account info for ${CPUSER} ...`)
  let info = null
  try { info = await whm.getAccountInfo(CPUSER) } catch (e) { console.log('    getAccountInfo err:', e.message) }
  console.log('    WHM account info:', info ? JSON.stringify(info).slice(0, 300) : '(null / unreachable)')

  console.log(`[H2] Suspending WHM account ${CPUSER} (reversible) ...`)
  let suspended = false
  try { suspended = await whm.suspendAccount(CPUSER, REASON) } catch (e) { console.log('    suspend err:', e.message) }
  console.log('    WHM suspendAccount result:', suspended)

  const cpUpd = await db.collection('cpanelAccounts').updateOne(
    { _id: CPUSER },
    { $set: {
        status: suspended ? 'suspended' : 'suspend-pending',
        autoRenewable: false,
        cancelledForFraud: true,
        fraudReason: REASON,
        fraudActionAt: now.toISOString(),
        whmSuspended: suspended,
    } }
  )
  console.log(`[H3] cpanelAccounts.${CPUSER} DB updated (matched=${cpUpd.matchedCount} modified=${cpUpd.modifiedCount})`)

  // ===== 2) MARKETPLACE: revoke access =====
  const mpBefore = await db.collection('marketplaceAccess').findOne({ _id: { $in: [Number(MP_CID), MP_CID] } })
  console.log('[M1] marketplaceAccess before:', JSON.stringify(mpBefore))
  const del = await db.collection('marketplaceAccess').deleteOne({ _id: { $in: [Number(MP_CID), MP_CID] } })
  console.log(`[M2] marketplaceAccess revoked — deleted=${del.deletedCount}`)

  // ===== 3) Audit =====
  await db.collection('walletAudit').insertMany([
    { chatId: HOST_CID, type: 'fraud_hosting_suspend', reason: REASON, appliedBy: APPLIED_BY, at: now,
      cpUser: CPUSER, domain: DOMAIN, whmSuspended: suspended, relatedRef: '3R9ly', relatedTxn: 'TXN-20260703-6D69D' },
    { chatId: MP_CID, type: 'fraud_marketplace_revoke', reason: REASON, appliedBy: APPLIED_BY, at: now,
      revokedDoc: mpBefore, deleted: del.deletedCount, relatedRef: 'sAoKK' },
  ])
  console.log('[A] audit rows written to walletAudit')

  // ===== 4) Verify =====
  const mpAfter = await db.collection('marketplaceAccess').findOne({ _id: { $in: [Number(MP_CID), MP_CID] } })
  const cpAfter = await db.collection('cpanelAccounts').findOne({ _id: CPUSER })
  console.log('\n=== VERIFY ===')
  console.log('  marketplaceAccess after:', mpAfter ? 'STILL PRESENT ❌' : 'revoked ✅ (null)')
  console.log(`  cpanelAccounts.${CPUSER}: status=${cpAfter?.status} whmSuspended=${cpAfter?.whmSuspended} autoRenewable=${cpAfter?.autoRenewable}`)
  console.log('\n=== DONE ===')
  await client.close()
}
main().catch(e => { console.error('FATAL:', e); process.exit(1) })
