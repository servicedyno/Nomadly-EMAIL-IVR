/**
 * Regression test for the 2026-06-18 addon-domain NS-delegation bug.
 *
 * Bug
 *   `attachAddonDomain` created a Cloudflare zone for the addon but never
 *   asked the registrar (OpenProvider) to delegate NS to Cloudflare.
 *   Result: CF zone stays `pending` (`ns_delegated_from_provider`), live DNS
 *   queries hit OP's empty default NS, hosting panel shows "domain not
 *   pointed to this server", SSL/AOP can't issue.
 *
 *   Confirmed live failure: HHR2009 (1960615421) / `inviolivepaperless.com`
 *   purchased + attached at 2026-06-18 11:30. CF zone created with anderson/
 *   leanna.ns.cloudflare.com, OP delegation kept at ns1/2/3.openprovider.*.
 *
 * Test approach
 *   Mock cf-service.createZone (returns nameservers) and op-service.
 *   updateNameservers (records the call), then call attachAddonDomain
 *   directly with an in-memory `db` shim and assert:
 *     1. opService.updateNameservers was called once with the CF NS.
 *     2. registeredDomains was updated with val.nameservers set.
 *     3. nsAuditLog row inserted.
 *     4. If domain was already delegated, no second OP call.
 *     5. Non-OpenProvider registrars are skipped (only logged).
 */

const Module = require('module')

let failed = 0
const t = (label, cond) => {
  if (cond) console.log(`  ✅ ${label}`)
  else { console.log(`  ❌ ${label}`); failed++ }
}

// ── In-memory mongo shim ──
function makeDb({ registeredDomain }) {
  const stores = {
    registeredDomains: new Map(),
    blockedDomains: new Map(),
    cpanelAccounts: new Map(),
    shortenerActivations: new Map(),
    nsAuditLog: [],
  }
  if (registeredDomain) stores.registeredDomains.set(registeredDomain._id, registeredDomain)
  return {
    stores,
    collection(name) {
      const s = stores[name]
      return {
        findOne: async filter => {
          if (!s) return null
          if (filter._id) return s.get(filter._id) || null
          // simple $or scan
          for (const v of (s instanceof Map ? s.values() : s)) {
            return v
          }
          return null
        },
        find: () => ({ toArray: async () => [] }),
        updateOne: async (filter, update, opts) => {
          if (!filter._id) return { matchedCount: 0 }
          const existing = s.get(filter._id) || (opts?.upsert ? { _id: filter._id } : null)
          if (!existing) return { matchedCount: 0 }
          const setOps = update.$set || {}
          for (const [k, v] of Object.entries(setOps)) {
            const parts = k.split('.')
            let cur = existing
            for (let i = 0; i < parts.length - 1; i++) {
              cur[parts[i]] = cur[parts[i]] || {}
              cur = cur[parts[i]]
            }
            cur[parts[parts.length - 1]] = v
          }
          if (update.$addToSet) {
            for (const [k, v] of Object.entries(update.$addToSet)) {
              existing[k] = existing[k] || []
              if (!existing[k].includes(v)) existing[k].push(v)
            }
          }
          s.set(filter._id, existing)
          return { matchedCount: 1 }
        },
        insertOne: async doc => { s.push ? s.push(doc) : s.set(doc._id || Math.random(), doc); return { acknowledged: true } },
      }
    },
  }
}

// ── Mock cf-service & op-service & whm-service & anti-red-service ──
const mocks = {
  cfCalls: [],
  opCalls: [],
  cpProxyCalls: [],
  antiRedCalls: [],
}

function installMocks() {
  const origResolve = Module._resolveFilename
  Module._resolveFilename = function (req, parent, ...rest) {
    if (req === './cpanel-proxy') return require.resolve('./fixtures/mock-cpanel-proxy')
    if (req === './cf-service') return require.resolve('./fixtures/mock-cf-service')
    if (req === './whm-service') return require.resolve('./fixtures/mock-whm-service')
    if (req === './anti-red-service') return require.resolve('./fixtures/mock-anti-red-service')
    if (req === './op-service') return require.resolve('./fixtures/mock-op-service')
    if (req === './translation') return require.resolve('./fixtures/mock-translation')
    if (req === './hosting-health-check') return require.resolve('./fixtures/mock-hosting-health-check')
    if (req === './rl-save-domain-in-server.js') return require.resolve('./fixtures/mock-rl-save')
    return origResolve.call(this, req, parent, ...rest)
  }
}

// Write mocks as actual files (because cjs caches by resolved path)
const fs = require('fs')
const path = require('path')
const fixDir = path.join(__dirname, 'fixtures')
try { fs.mkdirSync(fixDir, { recursive: true }) } catch (_) { /* ok */ }

function w(name, src) { fs.writeFileSync(path.join(fixDir, name), src) }

w('mock-cpanel-proxy.js', `
module.exports = {
  addAddonDomain: async () => { return { status: 1, errors: [] } },
}
`)
w('mock-cf-service.js', `
const calls = []
module.exports = {
  __calls: calls,
  getZoneByName: async () => null,
  createZone: async (domain) => {
    calls.push(['createZone', domain])
    return { success: true, zoneId: 'zone-' + domain, nameservers: ['anderson.ns.cloudflare.com', 'leanna.ns.cloudflare.com'], status: 'pending' }
  },
  cleanupConflictingDNS: async () => { calls.push(['cleanupConflictingDNS']) },
  createHostingDNSRecords: async () => { calls.push(['createHostingDNSRecords']) },
  setSSLMode: async () => { calls.push(['setSSLMode']) },
  enforceHTTPS: async () => { calls.push(['enforceHTTPS']) },
  enableAuthenticatedOriginPulls: async () => { calls.push(['AOP']) },
  generateOriginCACert: async () => ({ success: false, error: 'mock-skip' }),
}
`)
w('mock-whm-service.js', `
module.exports = {
  getAddonLimit: () => -1,
  installDomainSSL: async () => ({ success: false }),
  excludeDomainsFromAutoSSL: async () => ({ success: true }),
}
`)
w('mock-anti-red-service.js', `
module.exports = {
  deployFullProtection: async () => { return true },
  verifyProtection: async () => ({ active: true }),
}
`)
w('mock-op-service.js', `
const calls = []
module.exports = {
  __calls: calls,
  updateNameservers: async (domain, ns) => {
    calls.push({ domain, ns })
    return { success: true, propagation: { verified: true, matched: ns.length, elapsedMs: 1000, attempts: 1 } }
  },
}
`)
w('mock-translation.js', `module.exports = { translation: () => 'msg' }`)
w('mock-hosting-health-check.js', `module.exports = { scheduleHealthCheck: () => {} }`)
w('mock-rl-save.js', `module.exports = { removeDomainFromRailway: async () => ({ ok: true }) }`)

installMocks()

const addonFlow = require('../addon-domain-flow')
const mockOp = require('./fixtures/mock-op-service')
const mockCf = require('./fixtures/mock-cf-service')

;(async () => {
  console.log('addon-domain NS delegation regression test\n')

  // ── Test 1: OpenProvider registrar — NS update triggered ──
  console.log('Case 1: registrar=OpenProvider, NS missing → updateNameservers called')
  mockOp.__calls.length = 0
  const db1 = makeDb({
    registeredDomain: { _id: 'newaddon.com', val: { registrar: 'OpenProvider', provider: 'OpenProvider' } },
  })
  const r1 = await addonFlow.attachAddonDomain({
    account: { _id: 'cpUser1', cpUser: 'cpUser1', domain: 'primary.com', plan: 'Premium Anti-Red (1-Week)', addonDomains: [], chatId: '1234567890', whmHost: '1.2.3.4' },
    cpPass: 'pw',
    domain: 'newaddon.com',
    db: db1,
    lang: 'en',
  })
  t('attachAddonDomain ok=true', r1.ok === true)

  // background pipeline is fire-and-forget — wait briefly
  await new Promise(r => setTimeout(r, 200))

  t('opService.updateNameservers was called once', mockOp.__calls.length === 1)
  t('updateNameservers called with the addon domain', mockOp.__calls[0]?.domain === 'newaddon.com')
  t('updateNameservers called with the CF nameservers', JSON.stringify(mockOp.__calls[0]?.ns) === JSON.stringify(['anderson.ns.cloudflare.com', 'leanna.ns.cloudflare.com']))
  const reg1 = db1.stores.registeredDomains.get('newaddon.com')
  t('registeredDomains.val.nameservers set to CF NS', JSON.stringify(reg1?.val?.nameservers) === JSON.stringify(['anderson.ns.cloudflare.com', 'leanna.ns.cloudflare.com']))
  t('nsAuditLog row inserted with action=addon_ns_delegation', db1.stores.nsAuditLog.length === 1 && db1.stores.nsAuditLog[0].action === 'addon_ns_delegation')

  // ── Test 2: Already delegated — no second OP call ──
  console.log('\nCase 2: already delegated → no NS update')
  mockOp.__calls.length = 0
  const db2 = makeDb({
    registeredDomain: { _id: 'already.com', val: {
      registrar: 'OpenProvider',
      nameservers: ['anderson.ns.cloudflare.com', 'leanna.ns.cloudflare.com'],
    }},
  })
  await addonFlow.attachAddonDomain({
    account: { _id: 'cpUser2', cpUser: 'cpUser2', domain: 'primary.com', plan: 'Premium Anti-Red (1-Week)', addonDomains: [], chatId: '111' },
    cpPass: 'pw', domain: 'already.com', db: db2, lang: 'en',
  })
  await new Promise(r => setTimeout(r, 200))
  t('updateNameservers NOT called (already delegated)', mockOp.__calls.length === 0)

  // ── Test 3: non-OpenProvider registrar → skipped ──
  console.log('\nCase 3: registrar=Hostbay → NS update skipped')
  mockOp.__calls.length = 0
  const db3 = makeDb({
    registeredDomain: { _id: 'host.com', val: { registrar: 'Hostbay', provider: 'Hostbay' } },
  })
  await addonFlow.attachAddonDomain({
    account: { _id: 'cpUser3', cpUser: 'cpUser3', domain: 'primary.com', plan: 'Premium Anti-Red (1-Week)', addonDomains: [], chatId: '222' },
    cpPass: 'pw', domain: 'host.com', db: db3, lang: 'en',
  })
  await new Promise(r => setTimeout(r, 200))
  t('updateNameservers NOT called (non-OP registrar)', mockOp.__calls.length === 0)

  // ── Test 4: registrar unknown → safe-default skip ──
  console.log('\nCase 4: registrar field missing → safe-default skip')
  mockOp.__calls.length = 0
  const db4 = makeDb({ registeredDomain: { _id: 'unknown.com', val: { /* no registrar */ } } })
  await addonFlow.attachAddonDomain({
    account: { _id: 'cpUser4', cpUser: 'cpUser4', domain: 'primary.com', plan: 'Premium Anti-Red (1-Week)', addonDomains: [], chatId: '333' },
    cpPass: 'pw', domain: 'unknown.com', db: db4, lang: 'en',
  })
  await new Promise(r => setTimeout(r, 200))
  t('updateNameservers NOT called when registrar unknown', mockOp.__calls.length === 0)

  if (failed) {
    console.error(`\n${failed} assertion(s) failed`)
    process.exit(1)
  }
  console.log('\nAll addon-domain NS delegation guards in place.')
})().catch(e => { console.error('FATAL:', e); process.exit(1) })
