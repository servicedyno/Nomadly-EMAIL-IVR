/**
 * Comprehensive test for the "Attach addon domain to existing hosting plan"
 * shared helper (js/addon-domain-flow.js) and surrounding glue.
 *
 * Coverage:
 *   1. Happy path — attach + persist + DNS pipeline scheduled
 *   2. Idempotency — re-attaching the same domain returns alreadyAttached: true
 *   3. Pre-flight — primary domain rejected as duplicate
 *   4. Pre-flight — blocklisted domain rejected
 *   5. Pre-flight — plan addon-limit enforced
 *   6. Pre-flight — domain already on a different plan rejected
 *   7. WHM down — returns errorKind='cpanel_down' so caller can queue
 *   8. WHM hard error — returns errorKind='whm_failed' with cPanel reason
 *   9. Folder default — getAddonDocRoot returns `public_html/<domain>`
 *  10. Source guards on _index.js — button + handlers wired up correctly
 *  11. Lang parity — all 4 locales have the new strings
 *  12. cpanel-job-handlers `linkAddon` mutation kind exists for queue replay
 *
 * Run with: node js/tests/test_addon_from_bot.js
 */
const { MongoClient } = require('mongodb')
const fs = require('fs')
const path = require('path')

;(async () => {
  let pass = 0, fail = 0
  function ok(name, cond, note = '') {
    if (cond) { pass++; console.log(`  ✓ ${name}`) }
    else { fail++; console.log(`  ✗ ${name} — ${note}`) }
  }

  process.env.MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017'
  process.env.WHM_HOST = '127.0.0.1'
  const dbName = `nomadly_test_addon_${Date.now()}`
  process.env.DB_NAME = dbName

  const mongo = new MongoClient(process.env.MONGO_URL)
  await mongo.connect()
  const db = mongo.db(dbName)

  // Stub modules so the helper can run without real WHM/CF/anti-red.
  const stub = (modPath, exports) => {
    const resolved = require.resolve(modPath)
    require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports }
  }

  const whmCalls = []
  const cfCalls = []
  const antiRedCalls = []

  // Default WHM stub — success path
  stub('../cpanel-proxy', {
    addAddonDomain: async (cpUser, cpPass, domain, subDomain, dir, host) => {
      whmCalls.push({ cpUser, domain, subDomain, dir, host })
      return { status: 1, data: { result: 1 }, errors: null }
    },
  })

  stub('../cf-service', {
    getZoneByName:           async () => ({ id: 'zone1' }),
    createZone:              async () => ({ success: true, zoneId: 'zone1' }),
    cleanupConflictingDNS:   async (zid, d) => { cfCalls.push({ k: 'cleanup', zid, d }); return { success: true, deleted: [] } },
    createHostingDNSRecords: async (zid, d) => { cfCalls.push({ k: 'records', zid, d }); return { success: true, results: [] } },
    setSSLMode:              async () => ({ success: true }),
    enforceHTTPS:            async () => ({ success: true }),
    enableAuthenticatedOriginPulls: async () => ({ success: true }),
  })

  stub('../whm-service', {
    getAddonLimit: (planName) => {
      const lc = (planName || '').toLowerCase()
      if (lc.includes('golden')) return -1
      if (lc.includes('premium') && lc.includes('weekly')) return 0  // Premium Weekly = no addons
      if (lc.includes('premium')) return 1                            // Premium Monthly = 1 addon
      return 0
    },
  })

  stub('../anti-red-service', {
    deployFullProtection:    async (cpUser, domain) => { antiRedCalls.push({ k: 'deployFull', cpUser, domain }); return { success: true } },
    deploySharedWorkerRoute: async () => ({ success: true }),
    verifyProtection:        async () => ({ active: true, workerDetected: true, challengeDetected: true }),
    removeWorkerRoutes:      async () => ({ success: true }),
  })

  stub('../hosting-health-check', {
    scheduleHealthCheck: () => {},
  })

  // Reset addon-domain-flow cache so it picks up our stubs
  try { delete require.cache[require.resolve('../addon-domain-flow')] } catch (_) {}
  const addonFlow = require('../addon-domain-flow')

  // ───── 1. Happy path ─────
  await db.collection('cpanelAccounts').insertOne({
    _id: 'cpuser1',
    chatId: '12345',
    cpUser: 'cpuser1',
    domain: 'primary.com',
    plan: 'Golden Anti-Red HostPanel (1-Month)',
    addonDomains: [],
    cpPass_encrypted: 'enc', cpPass_iv: 'iv', cpPass_tag: 'tag',
    deleted: false,
    whmHost: '127.0.0.1',
  })
  const acct = await db.collection('cpanelAccounts').findOne({ _id: 'cpuser1' })

  const r1 = await addonFlow.attachAddonDomain({
    account: acct, cpPass: 'pw', domain: 'newaddon.com', db,
  })
  ok('1.a happy path returns ok=true', r1.ok === true, JSON.stringify(r1))
  ok('1.b returns docRoot = public_html/<domain>', r1.docRoot === 'public_html/newaddon.com', r1.docRoot)
  ok('1.c WHM addAddonDomain called once', whmCalls.length === 1)
  ok('1.d WHM call uses lowercased domain', whmCalls[0].domain === 'newaddon.com')
  ok('1.e WHM call uses default subDomain (alphanumeric)', whmCalls[0].subDomain === 'newaddoncom', whmCalls[0].subDomain)
  ok('1.f WHM call uses default dir', whmCalls[0].dir === 'public_html/newaddon.com', whmCalls[0].dir)

  // Persistence is synchronous after successful WHM call
  const acctAfter1 = await db.collection('cpanelAccounts').findOne({ _id: 'cpuser1' })
  ok('1.g addonDomains[] contains the new addon',
    (acctAfter1.addonDomains || []).includes('newaddon.com'),
    JSON.stringify(acctAfter1.addonDomains))

  // DNS pipeline runs fire-and-forget — give it a moment
  await new Promise(r => setTimeout(r, 100))
  ok('1.h cf cleanup invoked', cfCalls.some(c => c.k === 'cleanup' && c.d === 'newaddon.com'))
  ok('1.i cf createHostingDNSRecords invoked', cfCalls.some(c => c.k === 'records' && c.d === 'newaddon.com'))
  ok('1.j anti-red deployFullProtection invoked', antiRedCalls.some(c => c.k === 'deployFull' && c.domain === 'newaddon.com'))

  // ───── 2. Idempotency — re-attach same domain ─────
  whmCalls.length = 0
  const acctAfter1b = await db.collection('cpanelAccounts').findOne({ _id: 'cpuser1' })
  const r2 = await addonFlow.attachAddonDomain({
    account: acctAfter1b, cpPass: 'pw', domain: 'newaddon.com', db,
  })
  ok('2.a re-attach returns ok=true', r2.ok === true)
  ok('2.b re-attach sets alreadyAttached=true', r2.alreadyAttached === true)
  ok('2.c re-attach does NOT call WHM again', whmCalls.length === 0)

  // ───── 3. Primary-domain rejection ─────
  whmCalls.length = 0
  const r3 = await addonFlow.attachAddonDomain({
    account: acctAfter1b, cpPass: 'pw', domain: 'primary.com', db,
  })
  ok('3.a primary domain rejected', r3.ok === false && r3.errorKind === 'duplicate', JSON.stringify(r3))
  ok('3.b WHM never called for primary', whmCalls.length === 0)

  // ───── 4. Blocklist rejection ─────
  whmCalls.length = 0
  await db.collection('blockedDomains').insertOne({ domain: 'phishy.com', reason: 'phishing' })
  const r4 = await addonFlow.attachAddonDomain({
    account: acctAfter1b, cpPass: 'pw', domain: 'PHISHY.COM', db,
  })
  ok('4.a blocked domain rejected (case-insensitive)', r4.ok === false && r4.errorKind === 'blocked', JSON.stringify(r4))
  ok('4.b WHM never called for blocked', whmCalls.length === 0)

  // ───── 5. Plan addon-limit enforcement ─────
  whmCalls.length = 0
  await db.collection('cpanelAccounts').insertOne({
    _id: 'cpuser2',
    chatId: '67890',
    cpUser: 'cpuser2',
    domain: 'primary2.com',
    plan: 'Premium Anti-Red HostPanel (1-Month)',  // 1 addon allowed
    addonDomains: ['existing-addon.com'],
    cpPass_encrypted: 'enc', cpPass_iv: 'iv', cpPass_tag: 'tag',
    deleted: false,
  })
  const acct2 = await db.collection('cpanelAccounts').findOne({ _id: 'cpuser2' })
  const r5 = await addonFlow.attachAddonDomain({
    account: acct2, cpPass: 'pw', domain: 'shouldfail.com', db,
  })
  ok('5.a limit-reached returns errorKind=limit', r5.ok === false && r5.errorKind === 'limit', JSON.stringify(r5))
  ok('5.b limit response includes limit=1', r5.limit === 1)
  ok('5.c limit response includes currentAddons=1', r5.currentAddons === 1)
  ok('5.d WHM not called when at limit', whmCalls.length === 0)

  // ───── 6. Cross-plan duplicate rejection ─────
  whmCalls.length = 0
  // cpuser2 already has 'existing-addon.com'. Try to attach it to cpuser1.
  const r6 = await addonFlow.attachAddonDomain({
    account: acctAfter1b, cpPass: 'pw', domain: 'existing-addon.com', db,
  })
  ok('6.a domain on another plan rejected', r6.ok === false && r6.errorKind === 'duplicate', JSON.stringify(r6))
  ok('6.b WHM not called when duplicate', whmCalls.length === 0)

  // ───── 7. WHM down — returns cpanel_down ─────
  stub('../cpanel-proxy', {
    addAddonDomain: async () => ({ status: 0, code: 'CPANEL_DOWN', errors: ['CPANEL_DOWN'] }),
  })
  try { delete require.cache[require.resolve('../addon-domain-flow')] } catch (_) {}
  const addonFlowDown = require('../addon-domain-flow')
  const r7 = await addonFlowDown.attachAddonDomain({
    account: acctAfter1b, cpPass: 'pw', domain: 'whendown.com', db,
  })
  ok('7.a WHM down returns errorKind=cpanel_down', r7.ok === false && r7.errorKind === 'cpanel_down', JSON.stringify(r7))

  // ───── 8. WHM hard error ─────
  stub('../cpanel-proxy', {
    addAddonDomain: async () => ({ status: 0, errors: ['Account quota exceeded'] }),
  })
  try { delete require.cache[require.resolve('../addon-domain-flow')] } catch (_) {}
  const addonFlowHard = require('../addon-domain-flow')
  const r8 = await addonFlowHard.attachAddonDomain({
    account: acctAfter1b, cpPass: 'pw', domain: 'quotafail.com', db,
  })
  ok('8.a WHM hard error returns errorKind=whm_failed', r8.ok === false && r8.errorKind === 'whm_failed', JSON.stringify(r8))
  ok('8.b error message surfaces cPanel reason', /Account quota exceeded/.test(r8.error || ''), r8.error)

  // ───── 9. Folder default helper ─────
  ok('9.a getAddonDocRoot returns public_html/<domain>',
    addonFlowHard.getAddonDocRoot('Foo.Bar') === 'public_html/foo.bar',
    addonFlowHard.getAddonDocRoot('Foo.Bar'))

  // ───── 10. Source guards on _index.js — wiring ─────
  const indexSrc = fs.readFileSync(path.resolve(__dirname, '../_index.js'), 'utf8')

  ok('10.a _index has addDomainToPlan button check',
    /message === user\.addDomainToPlan/.test(indexSrc))
  ok('10.b _index sets a.selectDomainToAttach action',
    /a\.selectDomainToAttach/.test(indexSrc))
  ok('10.c _index sets a.confirmAttachAddonDomain action',
    /a\.confirmAttachAddonDomain/.test(indexSrc))
  ok('10.d _index has selectDomainToAttach action handler',
    /if \(action === a\.selectDomainToAttach\)/.test(indexSrc))
  ok('10.e _index has confirmAttachAddonDomain action handler',
    /if \(action === a\.confirmAttachAddonDomain\)/.test(indexSrc))
  ok('10.f _index calls addonFlow.attachAddonDomain',
    /addonFlow\.attachAddonDomain/.test(indexSrc))
  ok('10.g _index passes "linkAddon" kind to tryWhmOrQueue',
    /kind: 'linkAddon'/.test(indexSrc))
  ok('10.h _index renders addDomainToPlan button on plan detail when not at limit',
    /if \(!atLimit\) buttons\.push\(\[user\.addDomainToPlan\]\)/.test(indexSrc))
  ok('10.i _index pre-checks plan addon-limit before listing',
    /attachDomainLimitReached/.test(indexSrc))
  ok('10.j _index pre-checks ownership against getPurchasedDomains',
    indexSrc.includes('await getPurchasedDomains(chatId)') &&
    /attachAddonDomain/.test(indexSrc))
  ok('10.k _index uses getAddonDocRoot from helper for confirm prompt',
    /addonFlow\.getAddonDocRoot/.test(indexSrc))

  // ───── 11. Lang parity — all 4 locales ─────
  const langs = ['en', 'fr', 'zh', 'hi']
  const userKeys = ['addDomainToPlan', 'confirmAttachBtn']
  const tKeys = [
    'selectDomainToAttachHeader', 'noEligibleDomainsToAttach', 'confirmAttachDomain',
    'attachingDomain', 'attachDomainSuccess', 'attachDomainFailed',
    'attachDomainAlreadyOnPlan', 'attachDomainLimitReached', 'attachDomainBlocked',
    'attachDomainAlreadyAttached',
  ]
  for (const l of langs) {
    const src = fs.readFileSync(path.resolve(__dirname, `../lang/${l}.js`), 'utf8')
    for (const k of userKeys) {
      ok(`11.${l}.user.${k} present`, new RegExp(`\\b${k}\\s*:`).test(src))
    }
    for (const k of tKeys) {
      ok(`11.${l}.t.${k} present`, new RegExp(`\\b${k}\\s*:`).test(src))
    }
  }

  // ───── 12. cpanel-job-handlers has linkAddon kind ─────
  const handlersSrc = fs.readFileSync(path.resolve(__dirname, '../cpanel-job-handlers.js'), 'utf8')
  ok('12.a cpanel-job-handlers has linkAddon case', /case 'linkAddon':/.test(handlersSrc))
  ok('12.b linkAddon delegates to addonFlow.attachAddonDomain',
    /addonFlow\.attachAddonDomain/.test(handlersSrc))
  ok('12.c linkAddon defers on cpanel_down', /errorKind === 'cpanel_down'/.test(handlersSrc))

  // ───── 13. cpanel-routes uses shared helper ─────
  const routesSrc = fs.readFileSync(path.resolve(__dirname, '../cpanel-routes.js'), 'utf8')
  ok('13.a panel route uses shared addon helper',
    /addonFlow\.attachAddonDomain/.test(routesSrc))
  ok('13.b panel route maps errorKind=blocked → 403',
    /errorKind === 'blocked'/.test(routesSrc) && /403/.test(routesSrc))
  ok('13.c panel route maps errorKind=limit → 403 with limitReached',
    /errorKind === 'limit'/.test(routesSrc) && /limitReached/.test(routesSrc))
  ok('13.d panel route maps cpanel_down → 503',
    /errorKind === 'cpanel_down'/.test(routesSrc) && /503/.test(routesSrc))

  // ───── 14. Idempotency-on-duplicate-other-plan: domain on different plan ─────
  // Already covered by test 6, but verify the cross-plan check uses _id !== current.
  const flowSrc = fs.readFileSync(path.resolve(__dirname, '../addon-domain-flow.js'), 'utf8')
  ok('14.a helper has cross-plan duplicate check excluding self',
    /_id: { \$ne: cpUserId }/.test(flowSrc))

  await db.dropDatabase()
  await mongo.close()
  console.log(`\n${pass} pass / ${fail} fail`)
  process.exit(fail > 0 ? 1 : 0)
})().catch(err => {
  console.error('Test crashed:', err)
  process.exit(2)
})
