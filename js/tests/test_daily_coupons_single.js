/**
 * Regression test: daily-coupons generates ONE 10% code per day.
 *
 * Context: on 2026-05-03 we reduced the daily coupon count from 2 (5% + 10%)
 * to 1 (10% only) after 15 days of production data showed the 5% sibling saw
 * zero redemptions while diluting urgency next to the 10% offer.
 */

const assert = require('assert')
const path = require('path')

// In-memory Mongo stub — just enough API surface for daily-coupons.js to work.
function makeCol() {
  const store = new Map()
  return {
    store,
    async findOne(q) { return store.get(q.date) || null },
    async insertOne(doc) { store.set(doc.date, { ...doc }); return { insertedId: doc._id } },
    async updateOne(q, upd) {
      const doc = store.get(q.date)
      if (!doc) return { matchedCount: 0 }
      // Only handle $push for markCouponUsed (not needed for generation test)
      if (upd.$push) {
        for (const [k, v] of Object.entries(upd.$push)) {
          const parts = k.split('.')
          let cursor = doc
          for (let i = 0; i < parts.length - 1; i++) cursor = cursor[parts[i]]
          const last = parts[parts.length - 1]
          if (!Array.isArray(cursor[last])) cursor[last] = []
          cursor[last].push(v)
        }
      }
      return { matchedCount: 1 }
    },
  }
}

const col = makeCol()
const db = { collection: (name) => col }
const botMessages = []
const bot = { sendMessage: async (chatId, text, opts) => { botMessages.push({ chatId, text, opts }); return { message_id: 1 } } }

// Stub node-schedule so initDailyCoupons doesn't register a real cron job
require.cache[require.resolve('node-schedule')] = {
  exports: { scheduleJob: () => ({ cancel: () => {} }) },
}

// Delete the cached daily-coupons module so it picks up the stubbed schedule
delete require.cache[require.resolve(path.resolve(__dirname, '../daily-coupons.js'))]
const { initDailyCoupons } = require(path.resolve(__dirname, '../daily-coupons.js'))

process.env.TELEGRAM_ADMIN_CHAT_ID = '12345'

function run(name, fn) {
  try { fn(); console.log(`✓ ${name}`) }
  catch (e) { console.error(`✗ ${name}\n   ${e.message}`); process.exit(1) }
}

;(async () => {
  const api = initDailyCoupons(db, bot, {}, {})
  // The init call triggers generateDailyCoupons() on startup (async, fire-and-forget).
  // Wait a tick for it to land in the collection.
  await new Promise(r => setImmediate(r))
  await new Promise(r => setTimeout(r, 10))

  const today = new Date().toISOString().slice(0, 10)
  const doc = col.store.get(today)

  run('Generates exactly ONE coupon per day', () => {
    assert.ok(doc, 'document exists for today')
    const codes = Object.keys(doc.codes || {})
    assert.strictEqual(codes.length, 1, `expected 1 code, got ${codes.length}: ${codes.join(', ')}`)
  })

  run('The single code is a 10% discount with NMD10 prefix', () => {
    const [code, info] = Object.entries(doc.codes)[0]
    assert.ok(code.startsWith('NMD10'), `code should start with NMD10, got ${code}`)
    assert.strictEqual(info.discount, 10, 'discount should be 10')
    assert.deepStrictEqual(info.usedBy, [], 'usedBy should start empty')
  })

  run('No 5% / NMD5-prefixed code is generated', () => {
    const codes = Object.keys(doc.codes)
    const fiveCodes = codes.filter(c => c.startsWith('NMD5') && !c.startsWith('NMD10'))
    assert.strictEqual(fiveCodes.length, 0, `expected zero NMD5* codes, got: ${fiveCodes.join(', ')}`)
  })

  run('Admin is notified with the new singular-coupon message shape', () => {
    assert.ok(botMessages.length >= 1, 'admin should have received at least one DM')
    const msg = botMessages[botMessages.length - 1]
    assert.strictEqual(String(msg.chatId), '12345')
    assert.ok(msg.text.includes('Daily Coupon Generated'), 'should use singular "Daily Coupon" header')
    assert.ok(!msg.text.includes('5% off'), 'should not reference 5% anymore')
    assert.ok(msg.text.includes('10% off'), 'should reference 10%')
  })

  run('Second call on same day is idempotent (no duplicate generation)', async () => {
    const before = Object.keys(col.store.get(today).codes).length
    const again = await api.generateDailyCoupons()
    const after = Object.keys(col.store.get(today).codes).length
    assert.strictEqual(before, after, 'code count must not change on re-run')
    assert.strictEqual(again.date, today, 'should return the existing doc')
  })

  run('validateDailyCoupon accepts the new single code', async () => {
    const code = Object.keys(col.store.get(today).codes)[0]
    const res = await api.validateDailyCoupon(code, 999)
    assert.deepStrictEqual(res, { discount: 10 })
  })

  run('validateDailyCoupon rejects unknown codes (e.g. yesterday NMD5*)', async () => {
    const res = await api.validateDailyCoupon('NMD5ABCDEF', 999)
    assert.strictEqual(res, null, 'unknown code should return null')
  })

  console.log('\nAll daily-coupons tests passed.')
})().catch(e => { console.error(e); process.exit(1) })
