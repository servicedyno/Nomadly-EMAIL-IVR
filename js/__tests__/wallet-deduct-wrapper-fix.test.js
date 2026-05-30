/**
 * Regression test for the 2026-05-30 walletLedger / smartWalletDeduct bug.
 *
 * Bug summary
 *   utils.js:smartWalletDeduct called walletOf.findOneAndUpdate without
 *   `includeResultMetadata: false`. In mongo driver v5 this returns a
 *   wrapper `{value, lastErrorObject, ok}` instead of the doc, and the
 *   wrapper is truthy even when the filter matches nothing. As a result:
 *     (1) `if (usdResult)` was true even for insufficient-balance failures
 *         → ledger row written + caller told "success"
 *     (2) `usdResult.usdIn` lived on the inner `.value`, so it read as
 *         undefined → `balanceAfter` always computed to `0 - 0 = 0`
 *
 *   Production audit on 2026-05-30 found 100% of 14,018 walletLedger rows
 *   had `balanceAfter: 0` and ~63% of "outbound_call" entries for one
 *   user were ghosts (no actual wallet deduction).
 *
 * What this test locks in
 *   • Sufficient balance → success path: 1 ledger row, correct balanceAfter
 *   • Insufficient balance → ONLY one ledger row (no ghost), success=false,
 *     usdBal returned so caller can act
 *   • Successful deduction wallet doc reflects the increment
 */

const { MongoClient } = require('mongodb')

;(async () => {
  // Use a throwaway db on the local mongo from .env
  require('dotenv').config({ path: '/app/.env' })
  const url = process.env.MONGO_URL
  if (!url) {
    console.log('SKIP: no MONGO_URL in .env')
    process.exit(0)
  }
  const client = new MongoClient(url, { serverSelectionTimeoutMS: 4000 })
  try {
    await client.connect()
  } catch (e) {
    console.log('SKIP: cannot reach mongo →', e.message)
    process.exit(0)
  }
  const db = client.db(`test_wallet_${Date.now()}`)
  const walletOf = db.collection('walletOf')

  // Seed a wallet
  await walletOf.insertOne({ _id: 'chatX', usdIn: 10, usdOut: 0 })

  const { smartWalletDeduct } = require('../utils.js')

  let pass = 0, fail = 0
  async function test(name, fn) {
    try { await fn(); pass++; console.log(`  ✓ ${name}`) }
    catch (e) { fail++; console.log(`  ✗ ${name}\n    ${e.message}`) }
  }

  console.log('wallet-deduct-wrapper-fix.test.js\n')

  // ── Case 1: sufficient balance ──
  await test('sufficient balance → success + 1 ledger row + correct balanceAfter', async () => {
    const r = await smartWalletDeduct(walletOf, 'chatX', 4, {
      type: 'unit_test', description: 'cover charge'
    })
    if (!r.success) throw new Error(`expected success, got ${JSON.stringify(r)}`)
    if (r.charged !== 4) throw new Error(`expected charged=4, got ${r.charged}`)
    const w = await walletOf.findOne({ _id: 'chatX' })
    if (w.usdOut !== 4) throw new Error(`expected usdOut=4, got ${w.usdOut}`)
    // Ledger row inserted async via fire-and-forget; give it a tick
    await new Promise(r => setTimeout(r, 200))
    const ledger = await db.collection('walletLedger').find({ chatId: 'chatX' }).toArray()
    if (ledger.length !== 1) throw new Error(`expected 1 ledger row, got ${ledger.length}`)
    if (ledger[0].balanceAfter !== 6) throw new Error(`expected balanceAfter=6 (10 in - 4 out), got ${ledger[0].balanceAfter}`)
    if (ledger[0].amount !== -4) throw new Error(`expected amount=-4, got ${ledger[0].amount}`)
  })

  // ── Case 2: insufficient balance ──
  await test('insufficient balance → success:false + NO ghost ledger row', async () => {
    const before = await db.collection('walletLedger').countDocuments({ chatId: 'chatX' })
    const r = await smartWalletDeduct(walletOf, 'chatX', 100, {
      type: 'unit_test', description: 'should fail'
    })
    if (r.success !== false) throw new Error(`expected success=false, got ${JSON.stringify(r)}`)
    if (typeof r.usdBal !== 'number') throw new Error(`expected usdBal in response, got ${JSON.stringify(r)}`)
    // wallet must be unchanged
    const w = await walletOf.findOne({ _id: 'chatX' })
    if (w.usdOut !== 4) throw new Error(`wallet usdOut should still be 4, got ${w.usdOut}`)
    // ledger must NOT have a new row
    await new Promise(r => setTimeout(r, 200))
    const after = await db.collection('walletLedger').countDocuments({ chatId: 'chatX' })
    if (after !== before) throw new Error(`ghost ledger row written: before=${before} after=${after}`)
  })

  // ── Case 3: exact-balance edge ──
  await test('deduct exact remaining balance → success + balanceAfter=0', async () => {
    const r = await smartWalletDeduct(walletOf, 'chatX', 6, { type: 'unit_test' })
    if (!r.success) throw new Error(`expected success, got ${JSON.stringify(r)}`)
    const w = await walletOf.findOne({ _id: 'chatX' })
    if (w.usdOut !== 10) throw new Error(`expected usdOut=10, got ${w.usdOut}`)
    await new Promise(r => setTimeout(r, 200))
    const ledger = await db.collection('walletLedger').find({ chatId: 'chatX' }).sort({ timestamp: -1 }).toArray()
    if (ledger[0].balanceAfter !== 0) throw new Error(`expected balanceAfter=0, got ${ledger[0].balanceAfter}`)
  })

  // Cleanup test database
  await db.dropDatabase()
  await client.close()
  console.log(`\n${pass}/${pass + fail} passed`)
  process.exit(fail ? 1 : 0)
})()
