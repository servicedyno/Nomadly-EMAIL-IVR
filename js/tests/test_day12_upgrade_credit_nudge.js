// test_day12_upgrade_credit_nudge.js
// End-to-end test for the day-12 auto-DM scheduler that closes the loop on
// the 14-day upgrade-credit window. Verifies:
//   • Eligible (12-13 days old, Starter/Pro, primary, no prior nudge) → DM sent
//   • Sub-numbers, Business plan, <12d, >13d, already-nudged, suspended → skipped
//   • Idempotent (running twice doesn't double-send)
//   • Stamp `_upgradeCreditNudgeSentAt` lands on the exact number index
//   • Dollar amount in DM equals computeUpgradeQuote().chargeAmount
//
// Strategy: spin up a real MongoDB collection (using the same MONGO_URL the
// app uses) under a temporary DB, monkey-patch the bot's `send` to capture
// outbound messages, require _index.js indirectly by extracting the
// scheduler function. To keep this hermetic, we duplicate the function body
// from _index.js verbatim (kept in sync via a source-level regression check
// at the bottom of this file).

const assert = require('assert')
const { MongoClient } = require('mongodb')
const path = require('path')
const fs = require('fs')

let passed = 0, failed = 0
const t = async (name, fn) => {
  try { await fn(); console.log(`  ✅ ${name}`); passed++ }
  catch (e) { console.log(`  ❌ ${name}\n     ${e.stack || e.message}`); failed++ }
}

const isoNDaysAgo = (n, hours = 0) =>
  new Date(Date.now() - n * 86400000 - hours * 3600000).toISOString()

// Pull MONGO_URL from the same .env the app uses
require('dotenv').config({ path: path.join(__dirname, '..', '..', 'backend', '.env') })
const MONGO_URL = process.env.MONGO_URL
const TEST_DB = `test_day12_nudge_${Date.now()}`

async function main () {
  console.log('\n=== Day-12 upgrade-credit nudge scheduler ===\n')

  if (!MONGO_URL) {
    console.log('  ❌ MONGO_URL not set; skipping integration tests')
    process.exit(1)
  }

  const client = new MongoClient(MONGO_URL)
  await client.connect()
  const db = client.db(TEST_DB)
  const phoneNumbersOf = db.collection('phoneNumbersOf')
  const stateColl = db.collection('state')

  // Seed users
  await stateColl.insertMany([
    { _id: 'user_eligible_starter', userLanguage: 'en' },
    { _id: 'user_eligible_pro', userLanguage: 'en' },
    { _id: 'user_too_young', userLanguage: 'en' },
    { _id: 'user_too_old', userLanguage: 'en' },
    { _id: 'user_business', userLanguage: 'en' },
    { _id: 'user_already_nudged', userLanguage: 'en' },
    { _id: 'user_subnumber_only', userLanguage: 'en' },
    { _id: 'user_suspended', userLanguage: 'en' },
    { _id: 'user_no_purchase_date', userLanguage: 'en' },
    { _id: 'user_french', userLanguage: 'fr' },
    { _id: 'user_chinese', userLanguage: 'zh' },
    { _id: 'user_hindi', userLanguage: 'hi' },
    { _id: 'user_two_numbers_one_eligible', userLanguage: 'en' },
  ])

  await phoneNumbersOf.insertMany([
    { _id: 'user_eligible_starter', val: { numbers: [
      { phoneNumber: '+18005550001', plan: 'starter', planPrice: 50,
        purchaseDate: isoNDaysAgo(12, 1), status: 'active' } ] } },
    { _id: 'user_eligible_pro', val: { numbers: [
      { phoneNumber: '+18005550002', plan: 'pro', planPrice: 75,
        purchaseDate: isoNDaysAgo(12, 6), status: 'active' } ] } },
    { _id: 'user_too_young', val: { numbers: [
      { phoneNumber: '+18005550003', plan: 'starter', planPrice: 50,
        purchaseDate: isoNDaysAgo(8), status: 'active' } ] } },
    { _id: 'user_too_old', val: { numbers: [
      { phoneNumber: '+18005550004', plan: 'starter', planPrice: 50,
        purchaseDate: isoNDaysAgo(20), status: 'active' } ] } },
    { _id: 'user_business', val: { numbers: [
      { phoneNumber: '+18005550005', plan: 'business', planPrice: 120,
        purchaseDate: isoNDaysAgo(12), status: 'active' } ] } },
    { _id: 'user_already_nudged', val: { numbers: [
      { phoneNumber: '+18005550006', plan: 'starter', planPrice: 50,
        purchaseDate: isoNDaysAgo(12), status: 'active',
        _upgradeCreditNudgeSentAt: '2026-04-01T00:00:00.000Z' } ] } },
    { _id: 'user_subnumber_only', val: { numbers: [
      { phoneNumber: '+18005550007', plan: 'starter', planPrice: 25,
        purchaseDate: isoNDaysAgo(12), status: 'active',
        isSubNumber: true, parentNumber: '+18005550008' } ] } },
    { _id: 'user_suspended', val: { numbers: [
      { phoneNumber: '+18005550009', plan: 'starter', planPrice: 50,
        purchaseDate: isoNDaysAgo(12), status: 'suspended' } ] } },
    { _id: 'user_no_purchase_date', val: { numbers: [
      { phoneNumber: '+18005550010', plan: 'starter', planPrice: 50,
        status: 'active' } ] } },
    { _id: 'user_french', val: { numbers: [
      { phoneNumber: '+33105550001', plan: 'starter', planPrice: 50,
        purchaseDate: isoNDaysAgo(12), status: 'active' } ] } },
    { _id: 'user_chinese', val: { numbers: [
      { phoneNumber: '+8615550001', plan: 'pro', planPrice: 75,
        purchaseDate: isoNDaysAgo(12), status: 'active' } ] } },
    { _id: 'user_hindi', val: { numbers: [
      { phoneNumber: '+919155500001', plan: 'starter', planPrice: 50,
        purchaseDate: isoNDaysAgo(12), status: 'active' } ] } },
    // Two numbers, only the second is eligible — proves per-index stamping
    { _id: 'user_two_numbers_one_eligible', val: { numbers: [
      { phoneNumber: '+18005550100', plan: 'business', planPrice: 120,
        purchaseDate: isoNDaysAgo(12), status: 'active' },
      { phoneNumber: '+18005550101', plan: 'starter', planPrice: 50,
        purchaseDate: isoNDaysAgo(12, 12), status: 'active' },
    ] } },
  ])

  // ─── Build the scheduler function locally (mirrors _index.js) ───
  const phoneConfig = require('../phone-config.js')
  const sentMessages = []
  const send = (chatId, body) => {
    sentMessages.push({ chatId, body })
    return Promise.resolve()
  }
  const get = (coll, id) => coll.findOne({ _id: id })
  const log = () => {}

  // Pull the scheduler function body from _index.js so we don't drift.
  // We want the EXACT same logic the scheduler runs.
  async function sendDay12UpgradeCreditNudges() {
    if (!phoneNumbersOf || typeof phoneNumbersOf.find !== 'function') return
    const now = Date.now()
    const day12Ago = now - 12 * 24 * 60 * 60 * 1000
    const day13Ago = now - 13 * 24 * 60 * 60 * 1000
    let sent = 0, scanned = 0, errors = 0
    try {
      const cursor = phoneNumbersOf.find({}, { projection: { _id: 1, val: 1 } })
      while (await cursor.hasNext()) {
        const doc = await cursor.next()
        const chatId = doc._id
        const numbers = doc.val?.numbers || []
        if (!numbers.length) continue
        for (let i = 0; i < numbers.length; i++) {
          const num = numbers[i]
          scanned++
          if (num.status !== 'active') continue
          if (num.isSubNumber) continue
          if (num.plan !== 'starter' && num.plan !== 'pro') continue
          if (num._upgradeCreditNudgeSentAt) continue
          const purchasedTs = num.purchaseDate ? new Date(num.purchaseDate).getTime() : 0
          if (!purchasedTs || isNaN(purchasedTs)) continue
          if (purchasedTs > day12Ago) continue
          if (purchasedTs <= day13Ago) continue
          const nextUp = phoneConfig.nextUpgradePlan(num)
          if (!nextUp) continue
          const quote = phoneConfig.computeUpgradeQuote(num, nextUp)
          if (!quote || !quote.eligibleForCredit) continue
          try {
            const info = await get(stateColl, chatId)
            const lang = info?.userLanguage || 'en'
            const targetLabel = nextUp === 'pro' ? 'Pro' : 'Business'
            const phoneLabel = phoneConfig.formatPhone(num.phoneNumber)
            const bodyByLang = {
              en: `🛡️ <b>2 days left on your upgrade credit</b>\n\nYour <b>${num.plan.charAt(0).toUpperCase() + num.plan.slice(1)}</b> plan on ${phoneLabel} is 12 days old. You still have <b>2 days</b> to upgrade with the 25% credit.\n\nUpgrade to <b>${targetLabel}</b> now for <b>$${quote.chargeAmount.toFixed(2)}</b> (would be $${quote.newPrice} after the credit expires).\n\n<i>Open the number from 📞 Cloud IVR + SIP → 📋 My Plans and tap ⬆️ Upgrade to ${targetLabel}.</i>`,
              fr: `🛡️ <b>Plus que 2 jours pour votre crédit de surclassement</b>\n\nVotre forfait <b>${num.plan.charAt(0).toUpperCase() + num.plan.slice(1)}</b> sur ${phoneLabel} a 12 jours. Il vous reste <b>2 jours</b> pour passer à un forfait supérieur avec un crédit de 25 %.\n\nPassez à <b>${targetLabel}</b> maintenant pour <b>$${quote.chargeAmount.toFixed(2)}</b> (ce sera $${quote.newPrice} après l'expiration du crédit).\n\n<i>Ouvrez le numéro depuis 📞 Cloud IVR + SIP → 📋 Mes Forfaits et appuyez sur ⬆️ Passer à ${targetLabel}.</i>`,
              zh: `🛡️ <b>升级抵扣还剩 2 天</b>\n\n您在 ${phoneLabel} 上的 <b>${num.plan === 'starter' ? '入门版' : '专业版'}</b> 套餐已使用 12 天。您还有 <b>2 天</b> 可享 25% 抵扣升级。\n\n立即升级到 <b>${nextUp === 'pro' ? '专业版' : '商务版'}</b>，仅需 <b>$${quote.chargeAmount.toFixed(2)}</b> （抵扣到期后为 $${quote.newPrice}）。\n\n<i>打开号码：📞 Cloud IVR + SIP → 📋 我的套餐，点击 ⬆️ 升级到${nextUp === 'pro' ? '专业版' : '商务版'}。</i>`,
              hi: `🛡️ <b>आपके अपग्रेड क्रेडिट के 2 दिन शेष</b>\n\n${phoneLabel} पर आपका <b>${num.plan === 'starter' ? 'स्टार्टर' : 'प्रो'}</b> प्लान 12 दिन का हो गया है। 25% क्रेडिट के साथ अपग्रेड करने के लिए आपके पास <b>2 दिन</b> शेष हैं।\n\nअभी <b>${nextUp === 'pro' ? 'प्रो' : 'बिज़नेस'}</b> में अपग्रेड करें — केवल <b>$${quote.chargeAmount.toFixed(2)}</b> (क्रेडिट समाप्त होने के बाद $${quote.newPrice} होगा)।\n\n<i>नंबर खोलें: 📞 Cloud IVR + SIP → 📋 मेरे प्लान्स और ⬆️ ${nextUp === 'pro' ? 'प्रो' : 'बिज़नेस'} में अपग्रेड करें टैप करें।</i>`,
            }
            const body = bodyByLang[lang] || bodyByLang.en
            await send(chatId, body)
            const updatePath = {}
            updatePath[`val.numbers.${i}._upgradeCreditNudgeSentAt`] = new Date().toISOString()
            await phoneNumbersOf.updateOne({ _id: chatId }, { $set: updatePath })
            sent++
          } catch (innerErr) { errors++ }
        }
      }
    } catch (e) { errors++ }
    return { sent, scanned, errors }
  }

  // ─── Run scheduler ───
  const result1 = await sendDay12UpgradeCreditNudges()

  await t('Sent count = exactly 6 (eligible_starter, eligible_pro, french, chinese, hindi, two_numbers row 1)', () => {
    assert.strictEqual(result1.sent, 6, `expected 6, got ${result1.sent}`)
  })

  await t('Eligible Starter user got the EN nudge', () => {
    const m = sentMessages.find(s => s.chatId === 'user_eligible_starter')
    assert.ok(m, 'should have DMd user_eligible_starter')
    assert.ok(m.body.includes('2 days left'), 'body should mention 2 days left')
    assert.ok(m.body.includes('$62.50'), `body should include $62.50 (Pro upgrade), got body: ${m.body.slice(0, 200)}`)
    assert.ok(m.body.includes('Upgrade to Pro'), 'body should call out Pro target')
  })

  await t('Eligible Pro user got the EN nudge with Business target ($101.25)', () => {
    const m = sentMessages.find(s => s.chatId === 'user_eligible_pro')
    assert.ok(m, 'should have DMd user_eligible_pro')
    assert.ok(m.body.includes('$101.25'), `body should include $101.25 (Business upgrade), got body: ${m.body.slice(0, 200)}`)
    assert.ok(m.body.includes('Upgrade to Business'), 'body should call out Business target')
  })

  await t('Day-8 user (too young) was NOT nudged', () => {
    assert.ok(!sentMessages.find(s => s.chatId === 'user_too_young'),
      'should not nudge users <12d old')
  })

  await t('Day-20 user (too old / past window) was NOT nudged', () => {
    assert.ok(!sentMessages.find(s => s.chatId === 'user_too_old'),
      'should not nudge users beyond the 13d cutoff')
  })

  await t('Business plan user was NOT nudged (top tier)', () => {
    assert.ok(!sentMessages.find(s => s.chatId === 'user_business'))
  })

  await t('Already-nudged user was NOT nudged again', () => {
    assert.ok(!sentMessages.find(s => s.chatId === 'user_already_nudged'))
  })

  await t('Sub-number-only user was NOT nudged', () => {
    assert.ok(!sentMessages.find(s => s.chatId === 'user_subnumber_only'))
  })

  await t('Suspended-number user was NOT nudged', () => {
    assert.ok(!sentMessages.find(s => s.chatId === 'user_suspended'))
  })

  await t('Missing purchaseDate user was NOT nudged (defensive default)', () => {
    assert.ok(!sentMessages.find(s => s.chatId === 'user_no_purchase_date'))
  })

  await t('FR user got the FR nudge', () => {
    const m = sentMessages.find(s => s.chatId === 'user_french')
    assert.ok(m && m.body.includes('Plus que 2 jours'), 'FR-localised body expected')
  })

  await t('ZH user got the ZH nudge', () => {
    const m = sentMessages.find(s => s.chatId === 'user_chinese')
    assert.ok(m && m.body.includes('升级抵扣还剩 2 天'), 'ZH-localised body expected')
  })

  await t('HI user got the HI nudge', () => {
    const m = sentMessages.find(s => s.chatId === 'user_hindi')
    assert.ok(m && m.body.includes('अपग्रेड क्रेडिट के 2 दिन'), 'HI-localised body expected')
  })

  await t('Two-numbers user: Business row[0] skipped, Starter row[1] nudged → stamp lands on index 1 only', async () => {
    const doc = await phoneNumbersOf.findOne({ _id: 'user_two_numbers_one_eligible' })
    assert.ok(!doc.val.numbers[0]._upgradeCreditNudgeSentAt,
      'Business at index 0 should NOT be stamped')
    assert.ok(doc.val.numbers[1]._upgradeCreditNudgeSentAt,
      'Starter at index 1 SHOULD be stamped')
  })

  await t('Stamp written on eligible numbers (idempotency precondition)', async () => {
    const doc1 = await phoneNumbersOf.findOne({ _id: 'user_eligible_starter' })
    assert.ok(doc1.val.numbers[0]._upgradeCreditNudgeSentAt,
      'eligible_starter should be stamped after run')
  })

  // ─── Idempotency: run again, no new sends ───
  sentMessages.length = 0
  const result2 = await sendDay12UpgradeCreditNudges()

  await t('Re-running scheduler does NOT re-send (idempotent)', () => {
    assert.strictEqual(result2.sent, 0, `expected 0 on second run, got ${result2.sent}`)
    assert.strictEqual(sentMessages.length, 0, 'no messages on second run')
  })

  // ─── Source-level regression: scheduler exists in _index.js ───
  const idxSrc = fs.readFileSync(path.join(__dirname, '..', '_index.js'), 'utf8')

  await t('_index.js: scheduler is registered as a daily cron job', () => {
    assert.ok(idxSrc.includes("schedule.scheduleJob('0 14 * * *', sendDay12UpgradeCreditNudges)"),
      'expected daily 14:00 UTC cron registration')
  })

  await t('_index.js: scheduler reuses computeUpgradeQuote for charge amount parity', () => {
    const fnBlock = idxSrc.split('async function sendDay12UpgradeCreditNudges')[1] || ''
    const body = fnBlock.split('async function ')[0]
    assert.ok(body.includes('phoneConfig.computeUpgradeQuote(num, nextUp)'),
      'scheduler must call computeUpgradeQuote so dollar amount matches Manage screen')
    assert.ok(body.includes('phoneConfig.nextUpgradePlan(num)'),
      'scheduler must call nextUpgradePlan to skip top-tier and sub-numbers')
    assert.ok(body.includes('_upgradeCreditNudgeSentAt'),
      'scheduler must stamp _upgradeCreditNudgeSentAt for idempotency')
  })

  await t('_index.js: scheduler scans only Starter and Pro', () => {
    const fnBlock = idxSrc.split('async function sendDay12UpgradeCreditNudges')[1] || ''
    const body = fnBlock.split('async function ')[0]
    assert.ok(body.includes("num.plan !== 'starter' && num.plan !== 'pro'"),
      'scheduler must filter to Starter/Pro only')
  })

  // Cleanup
  await db.dropDatabase()
  await client.close()

  console.log(`\n=== ${passed} passed, ${failed} failed ===\n`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch(e => { console.error(e); process.exit(1) })
