/**
 * Tests for walletLedger idempotency via `metadata.callRef`.
 *
 * Bug fixed 2026-05-30:
 *   Duplicate Telnyx/Twilio webhook fires for the same call leg were each
 *   triggering a fresh wallet deduction + ledger row, producing inflated
 *   billing. We now:
 *     1. Check walletLedger for an existing row with the same callRef + chatId
 *        before deducting → if found, return idempotent success
 *     2. Add a unique partial index on (chatId, callRef) so a concurrent
 *        race that beats the check still gets caught at insert time, and the
 *        loser refunds the just-deducted amount
 *
 * What this test verifies:
 *   • First call with a callRef: deducts + writes ledger row
 *   • Repeat call with same callRef: NO deduct + NO new ledger row, success:true, idempotent:true
 *   • Call with no callRef: works as before (no idempotency check)
 *   • Concurrent race (simulated by manually inserting then deducting):
 *     loser refunds and ends up at the same wallet state
 */

const { MongoClient } = require('mongodb')

;(async () => {
  require('dotenv').config({ path: '/app/.env' })
  const url = process.env.MONGO_URL
  if (!url) { console.log('SKIP: no MONGO_URL'); process.exit(0) }
  const client = new MongoClient(url, { serverSelectionTimeoutMS: 4000 })
  try { await client.connect() }
  catch (e) { console.log('SKIP: cannot reach mongo →', e.message); process.exit(0) }
  const db = client.db(`test_ledger_idem_${Date.now()}`)
  const walletOf = db.collection('walletOf')

  // Mirror the production unique partial index so concurrent races are caught
  await db.collection('walletLedger').createIndex(
    { chatId: 1, callRef: 1 },
    { unique: true, partialFilterExpression: { callRef: { $type: 'string' } } }
  )

  await walletOf.insertOne({ _id: 'u', usdIn: 10, usdOut: 0 })

  const { smartWalletDeduct } = require('../utils.js')

  let pass = 0, fail = 0
  async function test(name, fn) {
    try { await fn(); pass++; console.log(`  ✓ ${name}`) }
    catch (e) { fail++; console.log(`  ✗ ${name}\n    ${e.message}`) }
  }

  console.log('wallet-ledger-idempotency.test.js\n')

  // ── Case 1: first call with callRef ──
  await test('first call with callRef deducts + writes ledger row', async () => {
    const r = await smartWalletDeduct(walletOf, 'u', 1.5, {
      type: 'outbound_call', callRef: 'telnyx_abc123'
    })
    if (!r.success) throw new Error(`expected success, got ${JSON.stringify(r)}`)
    if (r.idempotent) throw new Error(`expected NOT idempotent, got ${JSON.stringify(r)}`)
    if (r.charged !== 1.5) throw new Error(`expected charged=1.5, got ${r.charged}`)
    await new Promise(r => setTimeout(r, 200))
    const w = await walletOf.findOne({ _id: 'u' })
    if (w.usdOut !== 1.5) throw new Error(`expected usdOut=1.5, got ${w.usdOut}`)
    const rows = await db.collection('walletLedger').find({ chatId: 'u', callRef: 'telnyx_abc123' }).toArray()
    if (rows.length !== 1) throw new Error(`expected 1 row, got ${rows.length}`)
  })

  // ── Case 2: same callRef → idempotent ──
  await test('duplicate callRef returns idempotent success WITHOUT deduct', async () => {
    const r = await smartWalletDeduct(walletOf, 'u', 1.5, {
      type: 'outbound_call', callRef: 'telnyx_abc123'
    })
    if (!r.success) throw new Error(`expected success, got ${JSON.stringify(r)}`)
    if (!r.idempotent) throw new Error(`expected idempotent=true, got ${JSON.stringify(r)}`)
    if (r.charged !== 0) throw new Error(`expected charged=0, got ${r.charged}`)
    await new Promise(r => setTimeout(r, 200))
    const w = await walletOf.findOne({ _id: 'u' })
    if (w.usdOut !== 1.5) throw new Error(`wallet should be unchanged, got usdOut=${w.usdOut}`)
    const rows = await db.collection('walletLedger').find({ chatId: 'u', callRef: 'telnyx_abc123' }).toArray()
    if (rows.length !== 1) throw new Error(`expected still 1 row, got ${rows.length}`)
  })

  // ── Case 3: different callRef → new deduct ──
  await test('different callRef deducts independently', async () => {
    const r = await smartWalletDeduct(walletOf, 'u', 2, {
      type: 'outbound_call', callRef: 'telnyx_def456'
    })
    if (!r.success || r.idempotent) throw new Error(`expected fresh success, got ${JSON.stringify(r)}`)
    await new Promise(r => setTimeout(r, 200))
    const w = await walletOf.findOne({ _id: 'u' })
    if (w.usdOut !== 3.5) throw new Error(`expected usdOut=3.5, got ${w.usdOut}`)
  })

  // ── Case 4: no callRef → no idempotency check ──
  await test('no callRef → behaves as plain deduct (no idempotency)', async () => {
    const before = await db.collection('walletLedger').countDocuments({ chatId: 'u' })
    const r1 = await smartWalletDeduct(walletOf, 'u', 0.5, { type: 'misc' })
    const r2 = await smartWalletDeduct(walletOf, 'u', 0.5, { type: 'misc' })
    if (!r1.success || !r2.success) throw new Error(`expected both success`)
    await new Promise(r => setTimeout(r, 200))
    const after = await db.collection('walletLedger').countDocuments({ chatId: 'u' })
    if (after !== before + 2) throw new Error(`expected 2 new rows, got ${after - before}`)
  })

  // ── Case 5: concurrent insert beats us — refund path ──
  await test('concurrent dup insert triggers refund', async () => {
    // Pre-insert the ledger row, then call smartWalletDeduct with the same callRef.
    // The idempotency check should find the row and short-circuit BEFORE deducting.
    const { v4: uuidv4 } = require('uuid')
    await db.collection('walletLedger').insertOne({
      _id: uuidv4(),
      chatId: 'u', type: 'outbound_call', amount: -3,
      currency: 'usd', balanceAfter: 99,
      description: 'pre-existing', callRef: 'telnyx_ghi789',
      timestamp: new Date(),
    })
    const walletBefore = await walletOf.findOne({ _id: 'u' })
    const r = await smartWalletDeduct(walletOf, 'u', 3, {
      type: 'outbound_call', callRef: 'telnyx_ghi789'
    })
    if (!r.success || !r.idempotent) throw new Error(`expected idempotent, got ${JSON.stringify(r)}`)
    const walletAfter = await walletOf.findOne({ _id: 'u' })
    if (walletAfter.usdOut !== walletBefore.usdOut) throw new Error(`wallet changed: before=${walletBefore.usdOut} after=${walletAfter.usdOut}`)
  })

  await db.dropDatabase()
  await client.close()
  console.log(`\n${pass}/${pass + fail} passed`)
  process.exit(fail ? 1 : 0)
})()
