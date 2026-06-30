/**
 * Unit + integration tests for marketplace one-time access fee.
 *
 * Covers:
 *  T1. MARKETPLACE_ACCESS_FEE_USD reads from env (default 50, configurable).
 *  T2. hasMarketplaceAccess() returns null for new user, doc for paid user.
 *  T3. grantMarketplaceAccess() is idempotent (double-grant does NOT create
 *     two rows, returns existing).
 *  T4. revokeMarketplaceAccess() flips the user back to unpaid.
 *  T5. Admin chatIds (TELEGRAM_ADMIN_CHAT_ID) bypass — hasMarketplaceAccess
 *     returns a synthetic doc { mode: 'admin' } without DB lookup.
 *  T6. chatId stored as number vs string match correctly (cross-type lookup).
 *  T7. Service is wired into module exports.
 */
'use strict'

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '..', 'backend', '.env') })

const { MongoClient } = require('mongodb')

let pass = 0
let fail = 0
const it = (label, cond, detail = '') => {
  if (cond) { console.log(`  ✅ ${label}`); pass++ }
  else      { console.log(`  ❌ ${label}${detail ? '\n     ' + detail : ''}`); fail++ }
}

async function main() {
  // T1: env reads
  const ms = require('../marketplace-service')
  it('MARKETPLACE_ACCESS_FEE_USD exported', typeof ms.MARKETPLACE_ACCESS_FEE_USD === 'number')
  it(`MARKETPLACE_ACCESS_FEE_USD = 50 from .env (got ${ms.MARKETPLACE_ACCESS_FEE_USD})`, ms.MARKETPLACE_ACCESS_FEE_USD === 50)

  it('hasMarketplaceAccess exported', typeof ms.hasMarketplaceAccess === 'function')
  it('grantMarketplaceAccess exported', typeof ms.grantMarketplaceAccess === 'function')
  it('revokeMarketplaceAccess exported', typeof ms.revokeMarketplaceAccess === 'function')

  // Wire up to actual DB for integration tests, using a TEST PREFIX so we
  // don't pollute real users' state.
  const TEST_CHAT_ID_NUM = 999999991  // fake number-style
  const TEST_CHAT_ID_STR = '999999992' // fake string-style
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db(process.env.DB_NAME)

  await ms.initMarketplace(db)

  // ── Cleanup any leftover from prior runs ─────────────────────────────
  await db.collection('marketplaceAccess').deleteMany({
    _id: { $in: [TEST_CHAT_ID_NUM, TEST_CHAT_ID_STR, String(TEST_CHAT_ID_NUM), Number(TEST_CHAT_ID_STR)] }
  })

  // T2: fresh user → null
  const initial = await ms.hasMarketplaceAccess(TEST_CHAT_ID_NUM)
  it('fresh user has no access (returns null)', initial === null, `got: ${JSON.stringify(initial)}`)

  // T3: grant then check
  const granted = await ms.grantMarketplaceAccess(TEST_CHAT_ID_NUM, {
    amountUsd: 50, mode: 'wallet', txnId: 'TEST-TXN-001', walletBalAfter: 25.50,
  })
  it('grant returns paid:true doc', granted && granted.paid === true && granted.mode === 'wallet')
  it('grant amountUsd persisted', granted.amountUsd === 50)
  it('grant txnId persisted', granted.txnId === 'TEST-TXN-001')

  const afterGrant = await ms.hasMarketplaceAccess(TEST_CHAT_ID_NUM)
  it('hasMarketplaceAccess returns paid doc after grant', afterGrant && afterGrant.paid === true)

  // T3b: idempotency — second grant returns existing without overwrite
  const regrant = await ms.grantMarketplaceAccess(TEST_CHAT_ID_NUM, {
    amountUsd: 999, mode: 'admin_grant', txnId: 'SHOULD-NOT-OVERWRITE',
  })
  it('re-grant is idempotent (does NOT overwrite)', regrant.amountUsd === 50 && regrant.txnId === 'TEST-TXN-001')
  // Verify DB has only ONE row
  const allDocs = await db.collection('marketplaceAccess').find({
    _id: { $in: [TEST_CHAT_ID_NUM, String(TEST_CHAT_ID_NUM)] }
  }).toArray()
  it('only ONE access doc exists per user', allDocs.length === 1, `found ${allDocs.length}: ${JSON.stringify(allDocs)}`)

  // T4: revoke
  const revoke = await ms.revokeMarketplaceAccess(TEST_CHAT_ID_NUM)
  it('revoke returns revoked:true', revoke.revoked === true)
  const afterRevoke = await ms.hasMarketplaceAccess(TEST_CHAT_ID_NUM)
  it('hasMarketplaceAccess returns null after revoke', afterRevoke === null)

  // T5: admin bypass
  const adminId = process.env.TELEGRAM_ADMIN_CHAT_ID
  if (adminId) {
    const adminAccess = await ms.hasMarketplaceAccess(adminId)
    it(`admin chatId (${adminId}) bypasses paywall`, adminAccess && adminAccess.mode === 'admin')
  } else {
    console.log('  ⚠️  TELEGRAM_ADMIN_CHAT_ID not set — skipping admin bypass test')
  }
  // Negative — non-admin still gated
  const nonAdminBefore = await ms.hasMarketplaceAccess(TEST_CHAT_ID_NUM)
  it('non-admin user remains gated', nonAdminBefore === null)

  // T6: number vs string cross-type lookup
  // Grant as NUMBER, query as STRING (and vice versa)
  await ms.grantMarketplaceAccess(TEST_CHAT_ID_NUM, { amountUsd: 50, mode: 'wallet', txnId: 'TXN-2' })
  const byNumber = await ms.hasMarketplaceAccess(TEST_CHAT_ID_NUM)
  const byString = await ms.hasMarketplaceAccess(String(TEST_CHAT_ID_NUM))
  it('cross-type lookup: number→found', byNumber && byNumber.paid === true)
  it('cross-type lookup: string→same doc', byString && byString.paid === true)

  // Grant as STRING, query as NUMBER
  await ms.grantMarketplaceAccess(TEST_CHAT_ID_STR, { amountUsd: 50, mode: 'wallet', txnId: 'TXN-3' })
  const byStr2 = await ms.hasMarketplaceAccess(TEST_CHAT_ID_STR)
  const byNum2 = await ms.hasMarketplaceAccess(Number(TEST_CHAT_ID_STR))
  it('cross-type lookup (string-grant): string→found', byStr2 && byStr2.paid === true)
  it('cross-type lookup (string-grant): number→found', byNum2 && byNum2.paid === true)

  // ── Cleanup ──────────────────────────────────────────────────────────
  await db.collection('marketplaceAccess').deleteMany({
    _id: { $in: [TEST_CHAT_ID_NUM, TEST_CHAT_ID_STR, String(TEST_CHAT_ID_NUM), Number(TEST_CHAT_ID_STR)] }
  })

  await client.close()

  console.log(`\n═══ ${pass} passed, ${fail} failed ═══`)
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => { console.error('FATAL:', e?.stack || e); process.exit(2) })
