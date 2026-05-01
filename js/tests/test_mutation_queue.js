/**
 * End-to-end test for existing-user mutation queueing.
 *
 * Scenario:
 *   1. WHM control plane is DOWN.
 *   2. User taps "Take site offline" / "Bring online" / "Unlink addon" /
 *      "Cancel plan" / "Renew plan (when suspended)".
 *   3. The bot enqueues a `mutation` job, shows the user a calm "processing
 *      in background" message, NOT a server-down error.
 *   4. WHM comes back up → the queue worker drains, runs the mutation, DMs
 *      the user "✅ {label} completed".
 *
 * Run with: node js/tests/test_mutation_queue.js
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
  const dbName = `nomadly_test_mut_${Date.now()}`
  process.env.DB_NAME = dbName

  const mongo = new MongoClient(process.env.MONGO_URL)
  await mongo.connect()
  const db = mongo.db(dbName)

  for (const m of ['../cpanel-health', '../cpanel-job-queue', '../cpanel-job-handlers']) {
    try { delete require.cache[require.resolve(m)] } catch (_) {}
  }
  const cpHealth = require('../cpanel-health')
  const cpQueue  = require('../cpanel-job-queue')
  require('../cpanel-job-handlers')
  cpHealth._resetCache()

  // Stub the underlying cpanel/whm services so handler can run without real WHM
  const stub = (modPath, exports) => {
    const resolved = require.resolve(modPath)
    require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports }
  }
  let mutationsRun = []
  stub('../cpanel-proxy', {
    saveFileContent:    async () => ({ status: 1 }),
    removeAddonDomain:  async (cpUser, cpPass, addon) => { mutationsRun.push({ k: 'removeAddon', addon }); return { status: 1 } },
  })
  stub('../whm-service', {
    suspendAccount:     async (cpUser) => { mutationsRun.push({ k: 'suspend', cpUser }); return true },
    unsuspendAccount:   async (cpUser) => { mutationsRun.push({ k: 'unsuspend', cpUser }); return true },
  })
  stub('../site-status-service', {
    enableMaintenanceMode:  async (acct) => { mutationsRun.push({ k: 'enableMaint', cpUser: acct.cpUser }); return { ok: true } },
    disableMaintenanceMode: async (acct) => { mutationsRun.push({ k: 'disableMaint', cpUser: acct.cpUser }); return { ok: true } },
  })
  stub('../cpanel-auth', {
    decrypt: () => 'fake_pw',
    encrypt: () => ({ encrypted: 'enc', iv: 'iv', tag: 'tag' }),
  })

  // Seed a fake cpanel account
  const acctId = 'cpuser1'
  await db.collection('cpanelAccounts').insertOne({
    _id: acctId,
    chatId: '12345',
    cpUser: acctId,
    domain: 'example.com',
    addonDomains: ['addon.example.com'],
    cpPass_encrypted: 'enc', cpPass_iv: 'iv', cpPass_tag: 'tag',
    deleted: false,
  })

  const sent = []
  const send = (chatId, message) => sent.push({ chatId, message: String(message) })
  const notifyAdmin = (text) => sent.push({ admin: true, message: String(text) })

  cpQueue.init({ db, send, notifyAdmin })

  // Force WHM-down state in the cache
  let whmReachable = false
  cpHealth.isWhmReachable = async () => whmReachable

  // ── Test 1: enqueue 'suspend' mutation while WHM down ──
  await cpQueue.enqueue({
    type: 'mutation',
    chatId: '12345',
    lang: 'en',
    domain: 'example.com',
    params: { kind: 'suspend', label: 'Taking your site offline', args: { domain: 'example.com' } },
    dedupeKey: 'suspend:cpuser1',
  })
  ok('suspend job enqueued', (await db.collection(cpQueue._COLLECTION).countDocuments({ status: 'pending' })) === 1)
  ok('handler did NOT run yet (WHM down)', mutationsRun.length === 0, JSON.stringify(mutationsRun))

  // ── Test 2: bring WHM up → drain → handler runs ──
  whmReachable = true
  await cpQueue.drain()
  ok('after drain — suspend handler ran',
    mutationsRun.some(m => m.k === 'suspend' && m.cpUser === acctId), JSON.stringify(mutationsRun))
  ok('after drain — done count = 1',
    (await db.collection(cpQueue._COLLECTION).countDocuments({ status: 'done' })) === 1)
  ok('user got mutationDone DM',
    sent.some(s => /completed/i.test(s.message) && /Taking your site offline/.test(s.message)),
    sent.map(s=>s.message).join('\n').slice(0,300))
  ok('cpanelAccounts row updated to suspended=true',
    (await db.collection('cpanelAccounts').findOne({ _id: acctId })).suspended === true)

  // ── Test 3: dedupe — re-enqueueing same key while drain queue done is OK (gives new id) ──
  // (the current dedup only blocks active pending/running, not done — verified)
  await cpQueue.enqueue({
    type: 'mutation', chatId: '12345', lang: 'en', domain: 'example.com',
    params: { kind: 'unsuspend', label: 'Bringing your site back online', args: { domain: 'example.com' } },
    dedupeKey: 'unsuspend:cpuser1',
  })
  await cpQueue.drain()
  ok('unsuspend handler ran',
    mutationsRun.some(m => m.k === 'unsuspend' && m.cpUser === acctId))
  ok('cpanelAccounts row updated to suspended=false',
    (await db.collection('cpanelAccounts').findOne({ _id: acctId })).suspended === false)

  // ── Test 4: enableMaintenance + disableMaintenance ──
  await cpQueue.enqueue({
    type: 'mutation', chatId: '12345', lang: 'en', domain: 'example.com',
    params: { kind: 'enableMaintenance', label: 'Enabling maintenance', args: { domain: 'example.com' } },
  })
  await cpQueue.drain()
  ok('enableMaintenance ran', mutationsRun.some(m => m.k === 'enableMaint'))
  ok('cpanelAccounts maintenanceMode=true',
    (await db.collection('cpanelAccounts').findOne({ _id: acctId })).maintenanceMode === true)

  await cpQueue.enqueue({
    type: 'mutation', chatId: '12345', lang: 'en', domain: 'example.com',
    params: { kind: 'disableMaintenance', label: 'Disabling maintenance', args: { domain: 'example.com' } },
  })
  await cpQueue.drain()
  ok('disableMaintenance ran', mutationsRun.some(m => m.k === 'disableMaint'))
  ok('cpanelAccounts maintenanceMode=false',
    (await db.collection('cpanelAccounts').findOne({ _id: acctId })).maintenanceMode === false)

  // ── Test 5: unlinkAddon — handler removes from DB ──
  await cpQueue.enqueue({
    type: 'mutation', chatId: '12345', lang: 'en', domain: 'example.com',
    params: { kind: 'unlinkAddon', label: 'Unlinking addon', args: { domain: 'example.com', addonDomain: 'addon.example.com' } },
  })
  await cpQueue.drain()
  ok('removeAddonDomain proxy call ran',
    mutationsRun.some(m => m.k === 'removeAddon' && m.addon === 'addon.example.com'))
  const acctAfter = await db.collection('cpanelAccounts').findOne({ _id: acctId })
  ok('addonDomains array no longer contains the unlinked domain',
    !(acctAfter.addonDomains || []).includes('addon.example.com'),
    JSON.stringify(acctAfter.addonDomains))

  // ── Test 6: cancelPlan — sets deleted=true (no refund per spec) ──
  await cpQueue.enqueue({
    type: 'mutation', chatId: '12345', lang: 'en', domain: 'example.com',
    params: { kind: 'cancelPlan', label: 'Cancelling your plan', args: { domain: 'example.com' } },
  })
  await cpQueue.drain()
  const acctCancelled = await db.collection('cpanelAccounts').findOne({ _id: acctId })
  ok('cancelPlan → deleted=true', acctCancelled.deleted === true)
  ok('cancelPlan reason recorded', acctCancelled.deleteReason === 'user_cancellation')

  // ── Test 7: deferred (handler returns CPANEL_DOWN-shaped) → re-pending ──
  // Re-create acct (cancelled above)
  await db.collection('cpanelAccounts').updateOne({ _id: acctId }, { $set: { deleted: false } })
  // Stub WHM service to throw a CPANEL_DOWN-style error
  stub('../whm-service', {
    suspendAccount:   async () => { const e = new Error('connect ECONNREFUSED 127.0.0.1:2087'); e.code = 'ECONNREFUSED'; throw e },
    unsuspendAccount: async () => true,
  })
  await cpQueue.enqueue({
    type: 'mutation', chatId: '12345', lang: 'en', domain: 'example.com',
    params: { kind: 'suspend', label: 'Take site offline', args: { domain: 'example.com' } },
    dedupeKey: 'suspend-test7:cpuser1',
  })
  await cpQueue.drain()
  const stats = await cpQueue.getStats()
  ok('CPANEL_DOWN-shaped error → deferred (re-pending)', stats.pending === 1, JSON.stringify(stats))

  await db.dropDatabase()
  await mongo.close()
  console.log(`\n${pass} pass / ${fail} fail`)
  process.exit(fail > 0 ? 1 : 0)
})().catch(err => {
  console.error('Test crashed:', err)
  process.exit(2)
})
