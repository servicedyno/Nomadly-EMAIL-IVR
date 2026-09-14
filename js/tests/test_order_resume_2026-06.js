/**
 * Verification for audit fix #16 — Order Resume after top-up.
 *  • RUNTIME: session-recovery.js save/get/clear round-trip + resume prompt copy.
 *  • SOURCE : _index.js wiring (shared wall saves a resumable order, deposit
 *    webhooks offer resume, resume buttons route back into the confirm→pay flow).
 *
 * Run: node js/tests/test_order_resume_2026-06.js  (exit 0 = pass)
 */
const fs = require('fs')
const path = require('path')
const JS = path.join(__dirname, '..')
const src = (f) => fs.readFileSync(path.join(JS, f), 'utf8')

let pass = 0, fail = 0
const failures = []
const check = (name, cond, detail) => {
  if (cond) { pass++; console.log(`  ✅ ${name}`) }
  else { fail++; failures.push(name + (detail ? ` — ${detail}` : '')); console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`) }
}
const section = (t) => console.log(`\n── ${t} ──`)

// ── In-memory Mongo mock (just enough for session-recovery.js) ──
function makeMockDb() {
  const store = new Map()
  return {
    _store: store,
    collection() {
      return {
        async updateOne(filter, update, opts) {
          const id = filter._id
          const cur = store.get(id) || {}
          store.set(id, { ...cur, ...(update.$set || {}) })
          return { upsertedCount: opts?.upsert ? 1 : 0, modifiedCount: 1 }
        },
        async findOne(filter) {
          const doc = store.get(filter._id)
          if (!doc) return null
          if (filter.expiresAt && filter.expiresAt.$gt && !(doc.expiresAt > filter.expiresAt.$gt)) return null
          return doc
        },
        async deleteOne(filter) { store.delete(filter._id); return { deletedCount: 1 } },
      }
    },
  }
}

;(async () => {
  section('Runtime — session-recovery round-trip')
  const sr = require('../session-recovery.js')
  const db = makeMockDb()
  const chatId = '999000111'

  const saved = await sr.saveResumableSession(db, chatId, {
    flowType: 'domain-purchase', step: 'domain-pay',
    data: { price: 65, coin: 'usd', label: 'exbytes.com.au' },
  })
  check('saveResumableSession returns true', saved === true)

  const got = await sr.getResumableSession(db, chatId)
  check('getResumableSession returns the saved order', got && got.step === 'domain-pay' && got.data.price === 65, JSON.stringify(got && got.data))

  const prompt = sr.generateResumePrompt(got, 'en')
  check('resume prompt uses the unified "Complete My Order" button', JSON.stringify(prompt.keyboard).includes('✅ Complete My Order'))
  check('resume prompt shows the order label + price', prompt.message.includes('exbytes.com.au') && prompt.message.includes('$65.00'), prompt.message.replace(/\n/g, ' '))
  const promptFr = sr.generateResumePrompt(got, 'fr')
  check('resume prompt localised (fr) button', JSON.stringify(promptFr.keyboard).includes('✅ Terminer ma commande'))

  await sr.clearResumableSession(db, chatId)
  const gone = await sr.getResumableSession(db, chatId)
  check('clearResumableSession removes the order', gone === null)

  // expiry: an expired session must not be returned
  await sr.saveResumableSession(db, chatId, { flowType: 'order', step: 'plan-pay', data: { price: 75 }, expiresAt: new Date(Date.now() - 1000) })
  const expired = await sr.getResumableSession(db, chatId)
  check('expired session is not returned', expired === null)

  section('Source — _index.js wiring')
  const s = src('_index.js')
  check('shared balance wall helper defined (_showBalanceWall)', /const _showBalanceWall = async \(usdBal, priceUsd\) =>/.test(s))
  check('wall saves a resumable order', /const _showBalanceWall[\s\S]{0,1400}saveResumableSession\(db, chatId, \{/.test(s))
  check('wall emits the insufficient_balance_wall funnel event', /const _showBalanceWall[\s\S]{0,2200}event: 'insufficient_balance_wall'[\s\S]{0,200}funnel: 'wallet_purchase'/.test(s))
  const wallUses = (s.match(/return _showBalanceWall\(usdBal, /g) || []).length
  check('all wallet balance checks route through the shared wall (>=10)', wallUses >= 10, `found ${wallUses}`)
  check('no inline getInsufficientBalanceMessage wall one-liners remain', !/if \(usdBal < \w+\) \{ const _w = getInsufficientBalanceMessage/.test(s))

  check('maybeOfferResume helper defined', /async function maybeOfferResume\(chatId, lang = 'en'\)/.test(s))
  check('resume offer only fires when the new balance covers the order', /maybeOfferResume[\s\S]{0,400}if \(!\(usdBal >= price\)\) return/.test(s))
  const offerCalls = (s.match(/await maybeOfferResume\(chatId, lang\)/g) || []).length
  check('resume offered after both crypto deposit webhooks (DynoPay + BlockBee)', offerCalls >= 2, `found ${offerCalls}`)

  check('"Complete My Order" tap handled', /RESUME_ORDER_CTA_ALL\.includes\(message\)/.test(s))
  check('resume routes into the existing confirm→pay flow', /RESUME_ORDER_CTA_ALL[\s\S]{0,1300}goto\.walletSelectCurrencyConfirm\(\)/.test(s))
  check('resume re-shows the wall if the top-up still fell short', /RESUME_ORDER_CTA_ALL[\s\S]{0,1000}_showBalanceWall\(_rBal, _price\)/.test(s))
  check('"Start Fresh" tap clears the saved order', /RESUME_DISMISS_CTA_ALL\.includes\(message\)[\s\S]{0,120}clearResumableSession\(db, chatId\)/.test(s))

  console.log(`\n════════════════════════════════════════════`)
  console.log(`RESULT: ${pass} passed, ${fail} failed`)
  if (fail) { console.log('FAILURES:'); failures.forEach(f => console.log('  • ' + f)) }
  console.log(`════════════════════════════════════════════`)
  process.exit(fail ? 1 : 0)
})()
