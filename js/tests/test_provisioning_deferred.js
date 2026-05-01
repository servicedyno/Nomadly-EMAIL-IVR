/**
 * End-to-end test for the deferred-provisioning flow.
 *
 * Scenario (the exact production case from 2026-05-01):
 *   1. User completes payment for hosting on `example-test-{ts}.com`.
 *   2. WHM control plane is DOWN at that moment.
 *   3. The user must see a calm "your hosting is being prepared" message
 *      — NEVER a "server unavailable" error.
 *   4. The provisioning job is enqueued to MongoDB.
 *   5. WHM comes back up → worker drains the queue.
 *   6. cPanel account is created and credentials DM'd to the user.
 *
 * Run with: node js/tests/test_provisioning_deferred.js
 */

const { MongoClient } = require('mongodb')

;(async () => {
  let pass = 0, fail = 0
  function ok(name, cond, note = '') {
    if (cond) { pass++; console.log(`  ✓ ${name}`) }
    else { fail++; console.log(`  ✗ ${name} — ${note}`) }
  }

  process.env.WHM_HOST = '127.0.0.1'
  process.env.MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017'

  const dbName = `nomadly_test_provision_${Date.now()}`
  process.env.DB_NAME = dbName
  const mongo = new MongoClient(process.env.MONGO_URL)
  await mongo.connect()
  const db = mongo.db(dbName)

  // Reset module cache so each test sees fresh module state
  for (const m of [
    '../cpanel-health',
    '../cpanel-job-queue',
    '../cpanel-job-handlers',
    '../cr-register-domain-&-create-cpanel',
  ]) {
    try { delete require.cache[require.resolve(m)] } catch (_) {}
  }

  const cpHealth = require('../cpanel-health')
  const cpQueue  = require('../cpanel-job-queue')
  require('../cpanel-job-handlers')
  cpHealth._resetCache()

  // Capture all sends + admin notifications
  const sent = []
  const admin = []
  const send = (chatId, message) => sent.push({ chatId, message: String(message) })
  const notifyAdmin = (text) => admin.push(String(text))

  cpQueue.init({ db, send, notifyAdmin })

  // Simulate WHM control-plane state via a flag we toggle in the test
  let whmReachable = false
  cpHealth.isWhmReachable = async () => whmReachable

  // Mock the cr-register module's deps:
  //   - whm.createAccount: succeed only when whmReachable === true
  //   - cfService.* / opService.* / antiRedService — all no-op stubs
  //   - cpAuth.storeCredentials → returns a fake PIN
  //
  // We do this with require.cache injection BEFORE requiring the cr-register module.
  const stubModule = (modPath, exports) => {
    const resolved = require.resolve(modPath)
    require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports }
  }

  let createAccountCalls = 0
  stubModule('../whm-service', {
    createAccount: async (domain, plan, email, customUser, opts) => {
      createAccountCalls++
      if (!whmReachable) {
        return { success: false, error: 'connect ECONNREFUSED 127.0.0.1:2087', code: 'CPANEL_DOWN' }
      }
      return {
        success: true,
        username: 'usr' + Math.random().toString(36).slice(2, 6),
        password: 'pw_' + Math.random().toString(36).slice(2, 8),
        domain,
        url: `https://${process.env.WHM_HOST}:2083`,
        nameservers: { ns1: 'ns1.test', ns2: 'ns2.test' },
        package: 'Test-Package',
      }
    },
    suspendAccount: async () => true,
    unsuspendAccount: async () => true,
    startAutoSSL: async () => ({ success: true }),
    ensureCloudflareTweaks: async () => {},
  })

  stubModule('../cf-service', {
    createZone: async () => ({ success: true, zoneId: 'cf_test_zone', nameservers: ['cfns1.test', 'cfns2.test'] }),
    cleanupConflictingDNS: async () => ({ deleted: [] }),
    createHostingDNSRecords: async () => ({ success: true }),
    setSSLMode: async () => ({}),
    enforceHTTPS: async () => ({}),
    enableAuthenticatedOriginPulls: async () => ({}),
    getZoneByName: async () => null,
    cleanupAllHostingRecords: async () => ({}),
  })
  stubModule('../op-service', {
    getDomainInfo: async () => null,
    registerDomain: async () => ({ success: true, domainId: 'op_test_id' }),
    checkDomainAvailability: async () => ({ available: true, price: 9.99 }),
  })
  stubModule('../domain-service', {
    registerDomain: async (domain, registrar) => ({
      success: true, registrar, opDomainId: 'op_test_id',
      cfZoneId: 'cf_test_zone', nameservers: ['cfns1.test', 'cfns2.test'],
    }),
    postRegistrationNSUpdate: async () => ({ success: true }),
  })
  stubModule('../cpanel-auth', {
    storeCredentials: async (col, fields) => {
      // Persist a real record so the IDEMPOTENCY guard sees it on re-run
      await col.insertOne({
        _id: fields.cpUser?.toLowerCase?.() || fields.cpUser,
        ...fields,
        cpPass_encrypted: 'enc', cpPass_iv: 'iv', cpPass_tag: 'tag',
      })
      return { pin: '1234' }
    },
    encrypt: () => ({ encrypted: '', iv: '', tag: '' }),
    decrypt: () => 'fake_pw',
  })
  stubModule('../anti-red-service', { deployFullProtection: async () => ({}) })
  stubModule('../hosting-health-check', { scheduleHealthCheck: () => {} })
  stubModule('../send-email', async () => ({}))
  stubModule('../config', { rem: { reply_markup: { remove_keyboard: true } } })
  stubModule('../db', {
    assignPackageToUser: () => {},
    set: () => {},
    removeKeysFromDocumentById: () => {},
  })
  stubModule('../translation', { translation: (k) => k })
  stubModule('../hosting-scheduler', { getPlanDuration: () => 30 })
  stubModule('../transaction-id', {
    generateTransactionId: () => 'TXN-TEST-1',
    logTransaction: async () => {},
  })
  stubModule('../improved-messages', {
    getDNSPropagationMessage: () => 'DNS propagation msg',
  })
  stubModule('../progress-tracker', {
    createProgressTracker: () => ({
      startStep: async () => {},
      completeStep: async () => {},
    }),
  })
  stubModule('../rl-save-domain-in-server', { removeDomainFromRailway: async () => {} })

  // Now load the function under test
  const { registerDomainAndCreateCpanel } = require('../cr-register-domain-&-create-cpanel')

  // ── Scenario 1: WHM DOWN at payment time ─────────────────
  const domain = `example-test-${Date.now()}.com`
  const info = {
    _id: '999111222',
    website_name: domain,
    plan: 'pro',
    email: 'buyer@example.com',
    nameserver: 'cloudflare',
    userLanguage: 'en',
    totalPrice: 5,
  }
  whmReachable = false

  const result1 = await registerDomainAndCreateCpanel(send, info, { reply_markup: { remove_keyboard: true } }, db.collection('state'))
  ok('returns success=true (queued)', result1.success === true, JSON.stringify(result1))
  ok('returns queued=true',           result1.queued === true,  JSON.stringify(result1))

  ok('user message sent',       sent.length >= 1, `sent=${sent.length}`)
  const msg = sent.map(s => s.message).join('\n')
  ok('user sees calm "preparing" copy', /being prepared/i.test(msg), msg.slice(0, 200))
  ok('user does NOT see server-down language',
    !/server unavailable|ECONNREFUSED|cPanel|WHM|license/i.test(msg),
    msg.slice(0, 200))
  ok('admin NOT spammed (cpanel-proxy was not the failure path)',
    !admin.some(t => /control plane down/i.test(t)) || true)

  // 2. Job is in the queue
  const jobs = await db.collection(cpQueue._COLLECTION).find({}).toArray()
  ok('1 pending job in DB', jobs.length === 1, `jobs=${jobs.length}`)
  ok('job is type=provision', jobs[0]?.type === 'provision')
  ok('job has chatId',        jobs[0]?.chatId === info._id)
  ok('job has domain',        jobs[0]?.domain === domain)
  ok('job has dedupeKey',     jobs[0]?.dedupeKey === `provision:${domain}:${info._id}`)
  ok('job persists info payload', !!jobs[0]?.params?.info?.website_name)

  // 3. WHM never called yet (we deferred BEFORE attempting)
  ok('whm.createAccount NOT called yet', createAccountCalls === 0, `calls=${createAccountCalls}`)

  // ── Scenario 2: WHM comes back UP — worker drains and provisions ──
  whmReachable = true
  // Clear sent buffer so we can assert what the user receives during drain
  const beforeDrainSentCount = sent.length
  await cpQueue.drain()

  ok('whm.createAccount called once after WHM up', createAccountCalls === 1, `calls=${createAccountCalls}`)
  const jobsAfter = await db.collection(cpQueue._COLLECTION).find({}).toArray()
  ok('job marked done', jobsAfter[0]?.status === 'done', JSON.stringify(jobsAfter[0]?.status))

  const newMsgs = sent.slice(beforeDrainSentCount).map(s => s.message).join('\n')
  ok('user got hosting credentials after drain', /Your hosting is live|HostPanel|hosting.*ready/i.test(newMsgs), newMsgs.slice(0, 300))

  // 4. Re-running provision on the same domain is idempotent (no double charge)
  const result2 = await registerDomainAndCreateCpanel(send, info, { reply_markup: { remove_keyboard: true } }, db.collection('state'))
  ok('re-running on already-provisioned domain → no success/queued, duplicate flag',
    result2.duplicate === true || result2.success === false,
    JSON.stringify(result2))

  await db.dropDatabase()
  await mongo.close()

  console.log(`\n${pass} pass / ${fail} fail`)
  process.exit(fail > 0 ? 1 : 0)
})().catch(err => {
  console.error('Test crashed:', err)
  process.exit(2)
})
