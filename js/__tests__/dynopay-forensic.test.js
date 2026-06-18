/**
 * Regression test for the 2026-06-18 DynoPay-forensic persistence patch.
 *
 * Bug history
 *   Crypto wallet top-ups via DynoPay used to call
 *     `del(chatIdOfDynopayPayment, ref)`
 *   immediately after crediting the user wallet. That erased the only
 *   record of which BTC/USDT address was generated. When user 7191777173
 *   disputed a deposit ("I sent $60, only got $30") on 2026-06-18, we
 *   could not pull the on-chain trail because:
 *     • chatIdOfDynopayPayment was empty
 *     • payments[ref].val CSV had 10 cols and no address column
 *     • DynoPay's /user/getSingleTransaction/{payment_id} rejected our
 *       stored payment_id with "valid transaction_id required"
 *
 * What this test locks in
 *   • captureWebhook inserts a full-payload row in dynopayWebhooks for
 *     every webhook event (incl. pending / failed) with extracted
 *     refId, paymentId, event, status, amount fields.
 *   • archiveDepositAddress inserts/updates cryptoDepositAddresses keyed
 *     by ref with the address, coin, chatId + the full confirming body.
 *   • Both helpers are non-fatal: a thrown db error must NOT propagate.
 *   • ensureIndexes wires the right TTL + lookup indexes.
 */

const { captureWebhook, archiveDepositAddress, ensureIndexes } = require('../dynopay-forensic')

let failed = 0
const t = (label, cond) => {
  if (cond) console.log(`  ✅ ${label}`)
  else { console.log(`  ❌ ${label}`); failed++ }
}

// ── In-memory mongo shim ──
function makeDb() {
  const colls = {}
  const indexCalls = []
  const get = (name) => {
    if (!colls[name]) colls[name] = []
    return {
      insertOne: async (doc) => { colls[name].push({ _id: doc._id || `gen-${colls[name].length}`, ...doc }); return { acknowledged: true } },
      updateOne: async (filter, update, opts) => {
        const idx = colls[name].findIndex(d => d._id === filter._id)
        const cur = idx >= 0 ? colls[name][idx] : (opts?.upsert ? { _id: filter._id } : null)
        if (!cur) return { matchedCount: 0 }
        Object.assign(cur, update.$set || {})
        if (idx >= 0) colls[name][idx] = cur
        else colls[name].push(cur)
        return { matchedCount: 1 }
      },
      createIndex: async (spec, opts) => { indexCalls.push({ coll: name, spec, opts }); return name },
    }
  }
  return { collection: get, __colls: colls, __indexCalls: indexCalls }
}

;(async () => {
  console.log('DynoPay forensic persistence regression test\n')

  // ── 1. captureWebhook persists raw payload ──
  console.log('Case 1: captureWebhook persists full body')
  const db1 = makeDb()
  const req1 = {
    originalUrl: '/dynopay/crypto-wallet',
    hostname: 'bot.example.com',
    ip: '1.2.3.4',
    body: {
      event: 'payment.confirmed',
      status: 'confirmed',
      payment_id: '2fd3c05b-0654-48b1-a201-f165e587dcb8',
      amount: 0.00093443,
      base_amount: 30,
      currency: 'BTC',
      address: 'bc1qfgv4f6fz7w2z9z0zcs02c4hzn943vztd64j4l2',
      txId: '01abbd84bf3934831a9513886fb1843b7a1886eab6702ae45de586082df228c1',
      meta_data: { refId: 'z02SZ' },
    },
  }
  await captureWebhook(db1, req1)
  const rows1 = db1.__colls.dynopayWebhooks
  t('dynopayWebhooks has exactly 1 row', rows1?.length === 1)
  const row1 = rows1?.[0]
  t('endpoint stored', row1?.endpoint === '/dynopay/crypto-wallet')
  t('refId extracted from meta_data', row1?.refId === 'z02SZ')
  t('paymentId stored', row1?.paymentId === '2fd3c05b-0654-48b1-a201-f165e587dcb8')
  t('event stored', row1?.event === 'payment.confirmed')
  t('amount stored', row1?.amount === 0.00093443)
  t('baseAmount stored', row1?.baseAmount === 30)
  t('address stored', row1?.address === 'bc1qfgv4f6fz7w2z9z0zcs02c4hzn943vztd64j4l2')
  t('txId stored', row1?.txId === '01abbd84bf3934831a9513886fb1843b7a1886eab6702ae45de586082df228c1')
  t('full body preserved', row1?.body === req1.body)

  // ── 2. archiveDepositAddress upserts by ref ──
  console.log('\nCase 2: archiveDepositAddress upserts by ref')
  const db2 = makeDb()
  const pay = {
    chatId: '7191777173',
    action: 'walletFund',
    address: 'bc1qfgv4f6fz7w2z9z0zcs02c4hzn943vztd64j4l2',
    _createdAt: '2026-06-18T03:42:30.000Z',
    price: 30,
  }
  await archiveDepositAddress(db2, 'z02SZ', pay, req1.body)
  const rows2 = db2.__colls.cryptoDepositAddresses
  t('cryptoDepositAddresses has 1 row', rows2?.length === 1)
  const row2 = rows2?.[0]
  t('keyed by ref', row2?._id === 'z02SZ')
  t('chatId persisted as string', row2?.chatId === '7191777173')
  t('action persisted', row2?.action === 'walletFund')
  t('address persisted', row2?.address === 'bc1qfgv4f6fz7w2z9z0zcs02c4hzn943vztd64j4l2')
  t('coin from webhook body', row2?.coin === 'BTC')
  t('expectedAmountUsd from pay', row2?.expectedAmountUsd === 30)
  t('generatedAt from pay._createdAt', row2?.generatedAt === '2026-06-18T03:42:30.000Z')
  t('archivedAt is a Date', row2?.archivedAt instanceof Date)
  t('webhookEvent stored', row2?.webhookEvent === 'payment.confirmed')
  t('webhookTxId stored', row2?.webhookTxId === '01abbd84bf3934831a9513886fb1843b7a1886eab6702ae45de586082df228c1')
  t('full webhookBody preserved', row2?.webhookBody === req1.body)

  // Re-archive same ref → should update, not duplicate
  await archiveDepositAddress(db2, 'z02SZ', { ...pay, chatId: '9999' }, req1.body)
  t('re-archive does not duplicate (upsert by _id)', db2.__colls.cryptoDepositAddresses.length === 1)
  t('re-archive updates the row', db2.__colls.cryptoDepositAddresses[0].chatId === '9999')

  // ── 3. Non-fatal on db errors ──
  console.log('\nCase 3: helpers swallow db errors (non-fatal)')
  const brokenDb = { collection: () => { throw new Error('boom') } }
  try { await captureWebhook(brokenDb, req1); t('captureWebhook did not throw on broken db', true) }
  catch (e) { t('captureWebhook did not throw on broken db (got: ' + e.message + ')', false) }
  try { await archiveDepositAddress(brokenDb, 'r', pay, req1.body); t('archiveDepositAddress did not throw on broken db', true) }
  catch (e) { t('archiveDepositAddress did not throw on broken db (got: ' + e.message + ')', false) }

  // ── 4. ensureIndexes wires TTL + lookups ──
  console.log('\nCase 4: ensureIndexes creates the right indexes')
  const db4 = makeDb()
  await ensureIndexes(db4)
  const idx = db4.__indexCalls
  t('TTL index on dynopayWebhooks.receivedAt with 365d expiry', !!idx.find(c => c.coll === 'dynopayWebhooks' && c.spec.receivedAt === 1 && c.opts?.expireAfterSeconds === 365 * 24 * 60 * 60))
  t('refId index on dynopayWebhooks', !!idx.find(c => c.coll === 'dynopayWebhooks' && c.spec.refId === 1))
  t('paymentId index on dynopayWebhooks', !!idx.find(c => c.coll === 'dynopayWebhooks' && c.spec.paymentId === 1))
  t('chatId index on cryptoDepositAddresses', !!idx.find(c => c.coll === 'cryptoDepositAddresses' && c.spec.chatId === 1))
  t('address index on cryptoDepositAddresses', !!idx.find(c => c.coll === 'cryptoDepositAddresses' && c.spec.address === 1))
  t('webhookPaymentId index on cryptoDepositAddresses', !!idx.find(c => c.coll === 'cryptoDepositAddresses' && c.spec.webhookPaymentId === 1))
  t('NO TTL on cryptoDepositAddresses (forever audit)', !idx.find(c => c.coll === 'cryptoDepositAddresses' && c.opts?.expireAfterSeconds))

  // ── 5. Missing inputs ──
  console.log('\nCase 5: helpers tolerate missing inputs')
  const db5 = makeDb()
  await captureWebhook(null, req1)
  await captureWebhook(db5, null)
  await archiveDepositAddress(db5, null, pay, req1.body)
  await archiveDepositAddress(db5, 'ref', null, req1.body)
  t('no rows written when key inputs missing', !db5.__colls.dynopayWebhooks && !db5.__colls.cryptoDepositAddresses)

  if (failed) {
    console.error(`\n${failed} assertion(s) failed`)
    process.exit(1)
  }
  console.log('\nAll DynoPay forensic-persistence guards in place.')
})().catch(e => { console.error('FATAL:', e); process.exit(1) })
