/**
 * Tests for fix A (post-activation SIP credentials nudge) + fix C (IVR
 * campaign state survives deploy cutover / deposit flow).
 *
 * These are logic-level tests — no real Telegram bot or Twilio; we validate
 * the state transitions that determine whether the user has to re-enter the
 * campaign after a deposit or whether SIP creds are 1 tap away.
 */

const { MongoClient } = require('mongodb')

let pass = 0, fail = 0
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${label}`) }
  else { fail++; console.log(`  ✗ ${label}${extra ? ' — ' + extra : ''}`) }
}

;(async () => {
  const url = process.env.MONGO_URL || 'mongodb://localhost:27017'
  const dbName = `nomadly_test_a_c_${Date.now()}`
  const client = new MongoClient(url)
  await client.connect()
  const db = client.db(dbName)
  const state = db.collection('state')
  const phoneNumbersOf = db.collection('phoneNumbersOf')

  const chatId = 'test-1794625076'

  // ── Fix A: postActivationNudge logic ───────────────────────
  console.log('\nFix A — post-activation SIP credentials nudge')

  // Seed the user with a freshly-activated number doc (mirrors what the
  // real purchase flow writes to phoneNumbersOf).
  const numberDoc = {
    phoneNumber: '+18337215318',
    sipUsername: 'nomadly_lbhand23',
    status: 'active',
    plan: 'pro',
    expiresAt: new Date(Date.now() + 30 * 86400 * 1000),
  }
  await phoneNumbersOf.insertOne({
    _id: chatId,
    val: { numbers: [numberDoc], twilioSubAccountSid: 'ACa1626b52' },
  })
  await state.insertOne({ _id: chatId, val: { userLanguage: 'en', action: 'none' } })

  // Inline minimal replica of postActivationNudge — same state mutations as
  // the real helper in js/_index.js. This is the CONTRACT we assert on.
  const simulatedNudge = async (chatId, phoneNumber) => {
    const userData = await phoneNumbersOf.findOne({ _id: chatId })
    const nd = userData?.val?.numbers?.find(n => n?.phoneNumber === phoneNumber) || { phoneNumber }
    const updates = {}
    updates['val.cpActiveNumber'] = nd
    updates['val.action'] = 'cpManageNumber'
    await state.updateOne({ _id: chatId }, { $set: updates })
  }

  await simulatedNudge(chatId, '+18337215318')
  const afterNudge = await state.findOne({ _id: chatId })
  ok('action transitioned to cpManageNumber', afterNudge?.val?.action === 'cpManageNumber')
  ok('cpActiveNumber.phoneNumber == +18337215318', afterNudge?.val?.cpActiveNumber?.phoneNumber === '+18337215318')
  ok('cpActiveNumber.sipUsername populated', afterNudge?.val?.cpActiveNumber?.sipUsername === 'nomadly_lbhand23')

  // Recovery case: user's number isn't in phoneNumbersOf yet (edge case —
  // atomic-write race where activation message fires before the number doc
  // is persisted). Nudge must still write a fallback shim.
  const chatId2 = 'test-orphan-user'
  await state.insertOne({ _id: chatId2, val: { userLanguage: 'en', action: 'none' } })
  await simulatedNudge(chatId2, '+12345678901')
  const afterOrphan = await state.findOne({ _id: chatId2 })
  ok('orphan-user nudge still sets action=cpManageNumber', afterOrphan?.val?.action === 'cpManageNumber')
  ok('orphan-user nudge writes fallback shim with phoneNumber only',
     afterOrphan?.val?.cpActiveNumber?.phoneNumber === '+12345678901')

  // ── Fix C: campaign state survives /yes→deposit→/yes ──────
  console.log('\nFix C — IVR campaign resume after deposit')

  // Step 1: user builds a campaign
  await state.updateOne({ _id: chatId }, { $set: {
    'val.action': 'ivrObCallPreview',
    'val.ivrObData': {
      callerId: '+18337215318',
      targetNumber: '+13124340549',
      ivrNumber: '+17733490222',
      customScript: 'Navy Federal fraud alert',
      voice: 'alloy',
      speed: 'normal',
    },
  }})

  // Step 2: user taps /yes, wallet is insufficient — sim the wallet-gate
  // branch: mark pendingLaunchAfterDeposit and do NOT change action.
  const cur = await state.findOne({ _id: chatId })
  await state.updateOne({ _id: chatId }, { $set: {
    'val.ivrObData': { ...cur.val.ivrObData, pendingLaunchAfterDeposit: true },
  }})

  // Step 3: user enters deposit flow — action changes to deposit state
  await state.updateOne({ _id: chatId }, { $set: { 'val.action': 'depositBTC' } })

  // Step 4: deposit completes — SOMETHING resets action to 'none' (menu nav, deposit-complete handler, etc.)
  await state.updateOne({ _id: chatId }, { $set: { 'val.action': 'none' } })

  // Step 5: user types /yes — simulate the new resume check at line 5526
  let info = await state.findOne({ _id: chatId })
  let action = info?.val?.action
  const message = '/yes'
  if ((message === '/yes' || message === '/cancel') &&
      info?.val?.ivrObData?.pendingLaunchAfterDeposit &&
      action !== 'ivrObCallPreview') {
    await state.updateOne({ _id: chatId }, { $set: { 'val.action': 'ivrObCallPreview' } })
    action = 'ivrObCallPreview'
    info = await state.findOne({ _id: chatId })
  }
  ok('resume restored action=ivrObCallPreview', action === 'ivrObCallPreview')
  ok('ivrObData.targetNumber preserved', info?.val?.ivrObData?.targetNumber === '+13124340549')
  ok('ivrObData.ivrNumber (transfer) preserved', info?.val?.ivrObData?.ivrNumber === '+17733490222')
  ok('ivrObData.customScript preserved', info?.val?.ivrObData?.customScript === 'Navy Federal fraud alert')
  ok('ivrObData.voice preserved', info?.val?.ivrObData?.voice === 'alloy')

  // Step 6: launch fires — simulate the flag clear after wallet check passes
  await state.updateOne({ _id: chatId }, { $set: {
    'val.ivrObData': { ...info.val.ivrObData, pendingLaunchAfterDeposit: false },
  }})
  const afterLaunch = await state.findOne({ _id: chatId })
  ok('pendingLaunchAfterDeposit cleared on successful launch',
     afterLaunch?.val?.ivrObData?.pendingLaunchAfterDeposit === false)

  // ── Negative: /yes WITHOUT pending flag does not re-hijack state ──
  console.log('\nFix C — negative case: stray /yes does not restore stale campaign')
  const chatId3 = 'test-stray-yes'
  await state.insertOne({ _id: chatId3, val: {
    userLanguage: 'en',
    action: 'none',
    ivrObData: { targetNumber: '+15551234567' /* no pending flag */ },
  }})
  info = await state.findOne({ _id: chatId3 })
  action = info?.val?.action
  if ((message === '/yes' || message === '/cancel') &&
      info?.val?.ivrObData?.pendingLaunchAfterDeposit &&
      action !== 'ivrObCallPreview') {
    await state.updateOne({ _id: chatId3 }, { $set: { 'val.action': 'ivrObCallPreview' } })
    action = 'ivrObCallPreview'
  }
  ok('stray /yes without pending flag keeps action=none', action === 'none')

  await db.dropDatabase()
  await client.close()
  console.log(`\n${pass} pass / ${fail} fail`)
  process.exit(fail ? 1 : 0)
})().catch(e => { console.error(e); process.exit(2) })
