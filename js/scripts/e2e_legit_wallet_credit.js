/**
 * E2E LEGITIMATE-PAYMENT REGRESSION HARNESS  (2026 — post underpayment-fix)
 * ---------------------------------------------------------------------------
 * Goal: prove that NORMAL / legitimate DynoPay crypto wallet deposits still
 * credit the correct USD amount end-to-end through the REAL authDyno +
 * /dynopay/crypto-wallet handler — "just like before the fix".
 *
 * SAFETY (this pod is wired to the LIVE PRODUCTION MongoDB):
 *   • Uses a synthetic chatId ('E2E-<ts>') that belongs to NO real user and is
 *     non-numeric so it can never collide with a real Telegram chatId.
 *   • Seeds only its own throwaway session, fires the webhook, asserts, then
 *     DELETES every artifact it created across all touched collections and
 *     re-scans to confirm ZERO residue. Leaves the DB pristine.
 *   • Deposits are kept < $20 (FIRST_DEPOSIT_MIN_USD) so the first-deposit
 *     bonus never fires and each credited delta is an exact, unambiguous match.
 *
 * Run: node /app/js/scripts/e2e_legit_wallet_credit.js
 */
require('dotenv').config({ path: '/app/.env' })
const http = require('http')
const { MongoClient } = require('mongodb')

const NODE_URL = 'http://localhost:5000/dynopay/crypto-wallet'
const TS = Date.now()
const CHAT_ID = 'E2E-' + TS                 // synthetic, non-numeric, no real user
const PROBE_ID = 'PROBE-NOOP-DO-NOT-CREDIT' // leftover from earlier reachability probe

let pass = 0, fail = 0
const ok = (name, cond, extra = '') => { if (cond) { console.log('  ✅ ' + name + (extra ? ' — ' + extra : '')); pass++ } else { console.log('  ❌ ' + name + (extra ? ' — ' + extra : '')); fail++ } }

function post(body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body)
    const req = http.request(NODE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      timeout: 20000,
    }, (res) => { let b = ''; res.on('data', c => b += c); res.on('end', () => resolve({ status: res.statusCode, body: b })) })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
    req.write(payload); req.end()
  })
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// A legitimate confirmed webhook. base_currency=USD + exchange_rate → DynoPay
// settlement value (amount×rate) is the authoritative "USD received".
function mkWebhook({ ref, paymentId, amount, rate, baseAmount, coin = 'USDT-TRC20' }) {
  return {
    event: 'payment.confirmed', status: 'confirmed',
    payment_id: paymentId, currency: coin,
    amount: String(amount), exchange_rate: String(rate),
    base_currency: 'USD', base_amount: String(baseAmount),
    fee_payer: 'company',
    meta_data: { refId: ref },
    address: 'TEST-ADDR-' + ref,
  }
}

;(async () => {
  const c = new MongoClient(process.env.MONGO_URL)
  await c.connect()
  const db = c.db(process.env.DB_NAME)
  const W = db.collection('walletOf')

  const refs = [], pids = []
  const usdIn = async () => { const d = await W.findOne({ _id: CHAT_ID }); return d ? Number(d.usdIn || 0) : 0 }

  console.log('\n=== E2E LEGITIMATE WALLET-CREDIT REGRESSION ===')
  console.log('Synthetic chatId:', CHAT_ID, '\n')

  // ── Pre-flight: the synthetic user must not already exist ──
  console.log('[0] Pre-flight isolation')
  ok('walletOf has no synthetic doc', !(await W.findOne({ _id: CHAT_ID })))
  ok('state has no synthetic doc', !(await db.collection('state').findOne({ _id: CHAT_ID })))

  // Scenario runner: seed session → fire webhook → assert credited delta.
  async function scenario(label, { amount, rate, baseAmount, expectCredit, coin }) {
    const ref = 'e2e' + Math.random().toString(36).slice(2, 8)
    const paymentId = 'E2E-PID-' + TS + '-' + refs.length
    refs.push(ref); pids.push(paymentId)
    // Seed the pay session exactly as set(chatIdOfDynopayPayment, ref, {...}) stores it (wrapped in .val)
    await db.collection('chatIdOfDynopayPayment').updateOne(
      { _id: ref },
      { $set: { val: { chatId: CHAT_ID, action: 'walletFund', address: 'TEST-ADDR-' + ref, _createdAt: new Date().toISOString() } } },
      { upsert: true }
    )
    const before = await usdIn()
    const r = await post(mkWebhook({ ref, paymentId, amount, rate, baseAmount, coin }))
    await sleep(1500) // let post-credit async writes settle
    const after = await usdIn()
    const delta = Math.round((after - before) * 100) / 100
    console.log(`[${label}] http=${r.status} before=$${before} after=$${after} delta=$${delta} (expect $${expectCredit})`)
    ok(`${label}: credited exactly $${expectCredit}`, Math.abs(delta - expectCredit) < 0.001, `got $${delta}`)
    return { ref, paymentId }
  }

  // ── 1. EXACT legit deposit: 10 USDT @ $1.00 vs $10 invoice → credit $10 ──
  console.log('\n[1] Exact payment (10 USDT-TRC20 = $10 vs $10 invoice)')
  const s1 = await scenario('exact', { amount: 10, rate: 1.0, baseAmount: 10, expectCredit: 10 })

  // ── 2. OVERPAYMENT: 12 USDT vs $8 invoice → credit ACTUAL $12 (Versace438) ──
  console.log('\n[2] Overpayment (12 USDT = $12 vs $8 invoice)')
  await scenario('overpay', { amount: 12, rate: 1.0, baseAmount: 8, expectCredit: 12 })

  // ── 3. MINOR fee-shave: 9.6 USDT vs $10 invoice (96%) → credit INVOICE $10 ──
  console.log('\n[3] Minor fee-shave goodwill (9.6 USDT = $9.60 vs $10 invoice, 96%)')
  await scenario('feeshave', { amount: 9.6, rate: 1.0, baseAmount: 10, expectCredit: 10 })

  // ── 4. IDEMPOTENCY: replay scenario-1 payment_id → NO additional credit ──
  console.log('\n[4] Idempotency replay (re-fire scenario-1 payment_id)')
  const beforeReplay = await usdIn()
  const rr = await post(mkWebhook({ ref: s1.ref, paymentId: s1.paymentId, amount: 10, rate: 1.0, baseAmount: 10 }))
  await sleep(1000)
  const afterReplay = await usdIn()
  console.log(`    http=${rr.status} before=$${beforeReplay} after=$${afterReplay}`)
  ok('idempotent replay does NOT double-credit', Math.abs(afterReplay - beforeReplay) < 0.001, `delta=$${Math.round((afterReplay - beforeReplay) * 100) / 100}`)

  const expectedTotal = 10 + 12 + 10
  const finalBal = await usdIn()
  ok('cumulative wallet balance correct', Math.abs(finalBal - expectedTotal) < 0.001, `$${finalBal} (expect $${expectedTotal})`)

  // ── CLEANUP: wipe every artifact created by this harness (+ earlier probe) ──
  console.log('\n[5] Cleanup — deleting all synthetic artifacts')
  const delById = async (col, ids) => (await db.collection(col).deleteMany({ _id: { $in: ids } })).deletedCount
  const delBy = async (col, filter) => (await db.collection(col).deleteMany(filter)).deletedCount

  const removed = {}
  removed.walletOf = await delById('walletOf', [CHAT_ID])
  removed.state = await delById('state', [CHAT_ID])
  removed.transactions = await delBy('transactions', { chatId: CHAT_ID })
  removed.funnelEvents = await delBy('funnelEvents', { chatId: CHAT_ID })
  removed.userConversion = await delBy('userConversion', { chatId: CHAT_ID }) + await delById('userConversion', [CHAT_ID])
  removed.abandonedCarts = await delBy('abandonedCarts', { chatId: CHAT_ID })
  removed.scheduledEvents = await delBy('scheduledEvents', { chatId: CHAT_ID })
  removed.referrals = await delBy('referrals', { chatId: CHAT_ID })
  removed.walletAudit = await delBy('walletAudit', { chatId: CHAT_ID })
  removed.nameOf = await delById('nameOf', [CHAT_ID])
  removed.chatIdOfDynopayPayment = await delById('chatIdOfDynopayPayment', refs)
  removed.depositFunnel = await delById('depositFunnel', refs)
  removed.cryptoDepositAddresses = await delById('cryptoDepositAddresses', refs)
  removed.payments = await delById('payments', refs)
  removed.dynopayProcessed = await delById('dynopayProcessed', [...pids, PROBE_ID])
  removed.dynopayWebhooks = await delBy('dynopayWebhooks', { paymentId: { $in: [...pids, PROBE_ID] } })
  console.log('    removed:', JSON.stringify(removed))

  // ── Verify ZERO residue ──
  console.log('\n[6] Zero-residue verification')
  const residue =
    (await W.countDocuments({ _id: CHAT_ID })) +
    (await db.collection('state').countDocuments({ _id: CHAT_ID })) +
    (await db.collection('transactions').countDocuments({ chatId: CHAT_ID })) +
    (await db.collection('funnelEvents').countDocuments({ chatId: CHAT_ID })) +
    (await db.collection('userConversion').countDocuments({ chatId: CHAT_ID })) +
    (await db.collection('chatIdOfDynopayPayment').countDocuments({ _id: { $in: refs } })) +
    (await db.collection('depositFunnel').countDocuments({ _id: { $in: refs } })) +
    (await db.collection('cryptoDepositAddresses').countDocuments({ _id: { $in: refs } })) +
    (await db.collection('payments').countDocuments({ _id: { $in: refs } })) +
    (await db.collection('dynopayProcessed').countDocuments({ _id: { $in: [...pids, PROBE_ID] } })) +
    (await db.collection('dynopayWebhooks').countDocuments({ paymentId: { $in: [...pids, PROBE_ID] } }))
  ok('DB left pristine (0 synthetic docs remain)', residue === 0, residue + ' residual docs')

  await c.close()
  console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`)
  process.exit(fail === 0 ? 0 : 1)
})().catch(e => { console.error('HARNESS ERROR:', e); process.exit(1) })
