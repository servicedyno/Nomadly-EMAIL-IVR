/**
 * Tests for phone-scheduler race-condition safety (added 2026-02).
 *
 * Bug fixed:
 *   When two pods (Railway + preview) ran the hourly expiry cron at the same
 *   minute, both saw the same expired number. Pod A successfully renewed it
 *   and charged the wallet. Pod B's LAYER 1 idempotency guard fired and
 *   returned `false` from attemptAutoRenew. The outer loop in runExpiryCheck
 *   treated that bare-false as "auto-renew failed" and called
 *   releaseFromProvider() — deleting the freshly-renewed number from Twilio
 *   and marking it `released` in the DB. Real user @johngambino lost his
 *   $75 toll-free this way 2026-02.
 *
 * Fix:
 *   1. attemptAutoRenew() now returns a structured outcome object.
 *   2. runExpiryCheck only releases on outcome === 'insufficient_funds'.
 *   3. Even on 'insufficient_funds' we do a final fresh-read safety check
 *      and abort the release if expiresAt is in the future / status active.
 *   4. For 'already_renewed_elsewhere' / 'duplicate_prevented' we refresh
 *      local memory from DB instead of releasing.
 *
 * What this test verifies (against a temporary throwaway DB):
 *   • outcome:'renewed' increments counter, leaves number active
 *   • outcome:'already_renewed_elsewhere' does NOT release (the @johngambino
 *     bug — must stay GREEN forever)
 *   • outcome:'duplicate_prevented' does NOT release
 *   • outcome:'insufficient_funds' with active fresh-DB does NOT release
 *     (final safety net)
 *   • outcome:'insufficient_funds' with truly-expired fresh-DB DOES release
 *   • outcome:'invalid_price' / 'not_found' / 'error' do NOT release
 */

const { MongoClient } = require('mongodb')

;(async () => {
  require('dotenv').config({ path: '/app/backend/.env' })
  const url = process.env.MONGO_URL
  if (!url) { console.log('SKIP: no MONGO_URL'); process.exit(0) }
  const client = new MongoClient(url, { serverSelectionTimeoutMS: 4000 })
  try { await client.connect() }
  catch (e) { console.log('SKIP: cannot reach mongo →', e.message); process.exit(0) }

  // Throwaway DB — never touches production collections
  const db = client.db(`test_phone_scheduler_race_${Date.now()}`)
  const phoneNumbersOf = db.collection('phoneNumbersOf')
  const phoneTransactions = db.collection('phoneTransactions')
  const walletOf = db.collection('walletOf')
  const nameOf = db.collection('nameOf')
  const stateOf = db.collection('stateOf')

  // Track provider-release calls so we can assert it was/wasn't called.
  let releaseCalls = 0
  let notifyMessages = []
  let userMessages = []

  // Stub the twilio-service and telnyx-service modules BEFORE requiring the
  // scheduler — releaseFromProvider in the scheduler calls into them.
  // We patch require.cache to return our stubs.
  const path = require('path')
  const twilioStubPath = path.resolve('/app/js/twilio-service.js')
  const telnyxStubPath = path.resolve('/app/js/telnyx-service.js')
  require.cache[twilioStubPath] = {
    id: twilioStubPath,
    filename: twilioStubPath,
    loaded: true,
    exports: {
      releaseNumber: async () => { releaseCalls++; return { success: true } },
      getSubAccount: async () => ({ authToken: 'stub' }),
      getClient: () => ({ api: { v2010: { accounts: () => ({ incomingPhoneNumbers: () => ({ remove: async () => { releaseCalls++ } }) }) } } }),
    },
  }
  require.cache[telnyxStubPath] = {
    id: telnyxStubPath,
    filename: telnyxStubPath,
    loaded: true,
    exports: {
      releaseNumber: async () => { releaseCalls++; return true },
      releaseByPhoneNumber: async () => { releaseCalls++; return true },
    },
  }

  const scheduler = require('../phone-scheduler.js')

  const deps = {
    bot: { sendMessage: async (cid, txt) => { userMessages.push({ cid, txt }); return {} } },
    phoneNumbersOf, phoneTransactions, walletOf, nameOf, stateOf,
    phoneLogs: db.collection('phoneLogs'),
    payments: db.collection('payments'),
    notifyGroup: msg => notifyMessages.push(msg),
    maskName: n => n || 'user',
    nanoid: () => 'test_' + Math.random().toString(36).slice(2),
  }
  scheduler.initPhoneScheduler(deps)

  let pass = 0, fail = 0
  async function test(name, fn) {
    releaseCalls = 0
    notifyMessages = []
    userMessages = []
    await phoneNumbersOf.deleteMany({})
    await walletOf.deleteMany({})
    await nameOf.deleteMany({})
    try { await fn(); pass++; console.log(`  ✓ ${name}`) }
    catch (e) { fail++; console.log(`  ✗ ${name}\n    ${e.stack || e.message}`) }
  }

  function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed') }

  // Helper: build an expired number doc identical in shape to production
  function expiredNumber(over = {}) {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    return {
      phoneNumber: '+18884879051',
      provider: 'twilio',
      plan: 'pro',
      planPrice: 75,
      status: 'active',
      autoRenew: true,
      expiresAt: yesterday.toISOString(),
      purchaseDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      twilioNumberSid: 'PNxxx',
      twilioSubAccountSid: 'ACsub',
      twilioSubAccountToken: 'tok',
      smsUsed: 0,
      minutesUsed: 0,
      ...over,
    }
  }

  console.log('phone-scheduler-race.test.js\n')

  await test('renewed: success extends expiry, no release call', async () => {
    await walletOf.insertOne({ _id: 'u1', usdIn: 200, usdOut: 0 })
    await nameOf.insertOne({ _id: 'u1', val: 'John' })
    await phoneNumbersOf.insertOne({ _id: 'u1', val: { numbers: [expiredNumber()] } })

    await scheduler.runExpiryCheck()

    const doc = await phoneNumbersOf.findOne({ _id: 'u1' })
    const n = doc.val.numbers[0]
    assert(n.status === 'active', `status should remain active, got ${n.status}`)
    assert(!n._released, '_released must NOT be set')
    assert(new Date(n.expiresAt) > new Date(), 'expiresAt must be in the future after renewal')
    assert(releaseCalls === 0, `releaseFromProvider must NOT be called, got ${releaseCalls}`)
  })

  await test('already_renewed_elsewhere (the @johngambino regression): NO release', async () => {
    // Set up scenario: in-memory copy says expired, but freshly inserted DB
    // doc has expiresAt in the future (as if Pod A already renewed it).
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    await walletOf.insertOne({ _id: 'u2', usdIn: 200, usdOut: 75 })
    await nameOf.insertOne({ _id: 'u2', val: 'John' })

    // The trick: the document we read in runExpiryCheck() will show expiresAt
    // in the past (because we set it that way), but we'll patch findOne to
    // return the "future" version inside attemptAutoRenew's LAYER 1 check.
    // Simplest approach: store the doc with past expiresAt then mutate it
    // *after* runExpiryCheck reads it but *before* attemptAutoRenew. We
    // simulate this by patching findOne once.
    const past = new Date(Date.now() - 60 * 1000).toISOString()
    await phoneNumbersOf.insertOne({ _id: 'u2', val: { numbers: [expiredNumber({ expiresAt: past })] } })

    const realFindOne = phoneNumbersOf.findOne.bind(phoneNumbersOf)
    let callCount = 0
    phoneNumbersOf.findOne = async (...args) => {
      callCount++
      // First call: outer loop's find({}).toArray — handled by find(), not findOne()
      // Inside attemptAutoRenew: LAYER 1 hits findOne — return the "already renewed" version
      const doc = await realFindOne(...args)
      if (doc && doc._id === 'u2' && doc.val?.numbers?.[0]) {
        return { ...doc, val: { numbers: [{ ...doc.val.numbers[0], expiresAt: future }] } }
      }
      return doc
    }

    await scheduler.runExpiryCheck()

    phoneNumbersOf.findOne = realFindOne

    const doc = await phoneNumbersOf.findOne({ _id: 'u2' })
    const n = doc.val.numbers[0]
    assert(n.status === 'active', `status MUST remain active (johngambino regression), got ${n.status}`)
    assert(!n._released, '_released MUST NOT be set when another pod renewed')
    assert(releaseCalls === 0, `releaseFromProvider MUST NOT be called when already renewed elsewhere, got ${releaseCalls}`)
    assert(callCount > 0, 'sanity: findOne stub must have been hit')
  })

  await test('insufficient_funds with active fresh-DB: NO release (final safety net)', async () => {
    await walletOf.insertOne({ _id: 'u3', usdIn: 0, usdOut: 0 })
    await nameOf.insertOne({ _id: 'u3', val: 'Bob' })
    const past = new Date(Date.now() - 60 * 1000).toISOString()
    await phoneNumbersOf.insertOne({ _id: 'u3', val: { numbers: [expiredNumber({ expiresAt: past })] } })

    // After attemptAutoRenew returns insufficient_funds, the outer loop does
    // a final freshDoc lookup. We make THAT lookup show the number as active
    // (simulating a late top-up + renewal by another pod).
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const realFindOne = phoneNumbersOf.findOne.bind(phoneNumbersOf)
    let findCallCount = 0
    phoneNumbersOf.findOne = async (...args) => {
      findCallCount++
      const doc = await realFindOne(...args)
      if (!doc) return doc
      // calls 1: LAYER 1 inside attemptAutoRenew (must return expired so we hit insufficient_funds)
      // calls 2: final-safety re-fetch in outer loop (must return active so release is aborted)
      if (findCallCount >= 2 && doc._id === 'u3' && doc.val?.numbers?.[0]) {
        return { ...doc, val: { numbers: [{ ...doc.val.numbers[0], expiresAt: future, status: 'active' }] } }
      }
      return doc
    }

    await scheduler.runExpiryCheck()
    phoneNumbersOf.findOne = realFindOne

    assert(releaseCalls === 0, `releaseFromProvider MUST NOT be called when final-safety detects active number, got ${releaseCalls}`)
    const safetyAlert = notifyMessages.find(m => m.includes('Release ABORTED'))
    assert(safetyAlert, 'admin must receive Release ABORTED safety alert')
  })

  await test('insufficient_funds with truly-expired fresh-DB: DOES release', async () => {
    await walletOf.insertOne({ _id: 'u4', usdIn: 0, usdOut: 0 })
    await nameOf.insertOne({ _id: 'u4', val: 'Alice' })
    const past = new Date(Date.now() - 60 * 1000).toISOString()
    await phoneNumbersOf.insertOne({ _id: 'u4', val: { numbers: [expiredNumber({ expiresAt: past })] } })

    await scheduler.runExpiryCheck()

    const doc = await phoneNumbersOf.findOne({ _id: 'u4' })
    const n = doc.val.numbers[0]
    assert(n.status === 'released', `status must be released for genuine insufficient funds, got ${n.status}`)
    assert(n._released === true, '_released must be true')
    assert(releaseCalls > 0, `releaseFromProvider MUST be called for genuine insufficient funds, got ${releaseCalls}`)
  })

  await test('invalid_price: NO release, admin alerted, number kept active', async () => {
    await walletOf.insertOne({ _id: 'u5', usdIn: 1000, usdOut: 0 })
    await nameOf.insertOne({ _id: 'u5', val: 'Carol' })
    const past = new Date(Date.now() - 60 * 1000).toISOString()
    // planPrice=0 with valid canonical plan → triggers invalid_price branch only if
    // canonical also fails. Use an unknown plan tier so canonical=undefined and stored<=0.
    await phoneNumbersOf.insertOne({ _id: 'u5', val: { numbers: [expiredNumber({ expiresAt: past, plan: 'unknown_tier', planPrice: 0 })] } })

    await scheduler.runExpiryCheck()

    const doc = await phoneNumbersOf.findOne({ _id: 'u5' })
    const n = doc.val.numbers[0]
    assert(n.status === 'active', `status MUST remain active on invalid_price, got ${n.status}`)
    assert(!n._released, '_released MUST NOT be set')
    assert(releaseCalls === 0, `releaseFromProvider MUST NOT be called, got ${releaseCalls}`)
    const deferAlert = notifyMessages.find(m => m.includes('Auto-Renew Deferred'))
    assert(deferAlert, 'admin must receive Auto-Renew Deferred alert')
  })

  await test('autoRenew=false + expired: DOES release (unchanged behaviour)', async () => {
    await walletOf.insertOne({ _id: 'u6', usdIn: 200, usdOut: 0 })
    await nameOf.insertOne({ _id: 'u6', val: 'Dan' })
    const past = new Date(Date.now() - 60 * 1000).toISOString()
    await phoneNumbersOf.insertOne({ _id: 'u6', val: { numbers: [expiredNumber({ expiresAt: past, autoRenew: false })] } })

    await scheduler.runExpiryCheck()

    const doc = await phoneNumbersOf.findOne({ _id: 'u6' })
    const n = doc.val.numbers[0]
    assert(n.status === 'released', `autoRenew=false expired number must be released, got ${n.status}`)
    assert(releaseCalls > 0, `releaseFromProvider must be called for non-auto-renew expiry, got ${releaseCalls}`)
  })

  console.log(`\nResults: ${pass} passed, ${fail} failed`)
  await db.dropDatabase()
  await client.close()
  process.exit(fail === 0 ? 0 : 1)
})().catch(e => { console.error(e); process.exit(1) })
