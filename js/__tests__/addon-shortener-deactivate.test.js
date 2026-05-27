/**
 * Tests for the addon-domain ↔ URL-shortener auto-deactivation guard
 * added in addon-domain-flow.js after the 2026-05-27 tuestbnk.org incident.
 *
 * Scenario (real prod incident):
 *   • User bought tuestbnk.org, bot auto-activated URL shortener
 *     (set CNAME → cfargotunnel, Railway custom-domain registered,
 *      shortenerActivations doc inserted).
 *   • User then added tuestbnk.org as addon on an existing cPanel.
 *   • Old code: addon flow rewrote DNS for hosting but left
 *     shortenerActivations + Railway registration dangling →
 *     `status: "needs_reactivation"` and broken state.
 *   • New code: before running WHM addaddondomain, addon flow checks for
 *     an active shortener and deactivates it cleanly (Railway unlink +
 *     mongo status update).
 *
 * Run:  node js/__tests__/addon-shortener-deactivate.test.js
 */

const Module = require('module')
const path = require('path')

// ── Capture calls to ./rl-save-domain-in-server.js without hitting Railway ──
const railwayCalls = []
const railwayMockPath = path.resolve(__dirname, '../rl-save-domain-in-server.js')
const origResolve = Module._resolveFilename
const origLoad = Module._load
Module._load = function (request, parent, isMain) {
  if (parent && parent.filename === path.resolve(__dirname, '../addon-domain-flow.js')) {
    if (request === './rl-save-domain-in-server.js') {
      return {
        removeDomainFromRailway: async (domain) => {
          railwayCalls.push(domain)
          return { success: true, note: 'mocked' }
        },
      }
    }
    if (request === './cpanel-proxy') {
      return { addAddonDomain: async () => ({ status: 1 }) }
    }
    if (request === './cf-service') {
      return {
        getZoneByName: async () => ({ id: 'mock-zone' }),
        createZone: async () => ({ success: true, zoneId: 'mock-zone' }),
        cleanupConflictingDNS: async () => ({ success: true, deleted: [] }),
        createHostingDNSRecords: async () => ({ success: true, results: [] }),
        setSSLMode: async () => true,
        enforceHTTPS: async () => true,
      }
    }
    if (request === './whm-service') {
      return { getAddonLimit: () => -1 }
    }
    if (request === './anti-red-service') {
      return {
        deploy: async () => ({ success: true }),
        deployFullProtection: async () => ({ success: true }),
      }
    }
    if (request === './hosting-health-check') {
      return { scheduleHealthCheck: () => {} }
    }
    if (request === './translation') {
      return { translation: { en: {} } }
    }
  }
  return origLoad.apply(this, arguments)
}

// ── Build a minimal mongo-like in-memory collection ──
function makeCol(name, seed = []) {
  const docs = [...seed]
  const findOne = async (q) => {
    if (q._id !== undefined) {
      const found = docs.find((d) => d._id === q._id)
      if (!found) return null
      if (q.status && q.status.$nin) return q.status.$nin.includes(found.status) ? null : found
      return found
    }
    if (q.$or) {
      for (const cond of q.$or) {
        for (const d of docs) {
          for (const k of Object.keys(cond)) {
            if (Array.isArray(d[k])) {
              if (d[k].includes(cond[k])) return d
            } else if (d[k] === cond[k]) {
              return d
            }
          }
        }
      }
      return null
    }
    return docs.find((d) => Object.keys(q).every((k) => d[k] === q[k])) || null
  }
  return {
    name,
    docs,
    findOne,
    updateOne: async (q, upd) => {
      const target = await findOne(q)
      if (target && upd.$set) Object.assign(target, upd.$set)
      if (target && upd.$addToSet) {
        for (const k of Object.keys(upd.$addToSet)) {
          target[k] = target[k] || []
          if (!target[k].includes(upd.$addToSet[k])) target[k].push(upd.$addToSet[k])
        }
      }
      return { matchedCount: target ? 1 : 0, modifiedCount: target ? 1 : 0 }
    },
  }
}

function makeDb(seed) {
  const cols = {}
  return {
    collection: (n) => (cols[n] = cols[n] || makeCol(n, seed[n] || [])),
    _cols: cols,
  }
}

// ── Test runner ──
const results = []
function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      results.push({ name, ok: true })
      console.log(`  ✓ ${name}`)
    })
    .catch((e) => {
      results.push({ name, ok: false, err: e })
      console.log(`  ✗ ${name}\n     ${e.message}`)
    })
}

;(async () => {
  // Bind findOne's `this` context properly
  const { attachAddonDomain } = require('../addon-domain-flow.js')

  console.log('addon-shortener-deactivate.test.js\n')

  // ── Case 1: domain has an ACTIVE shortener → must auto-deactivate ──
  railwayCalls.length = 0
  const db1 = makeDb({
    shortenerActivations: [
      {
        _id: 'tuestbnk.org',
        chatId: '7513061815',
        status: 'completed',
        server: '9e7pvb5e.up.railway.app',
      },
    ],
    cpanelAccounts: [],
    blockedDomains: [],
  })
  await test('auto-deactivates active shortener before addon attach', async () => {
    const r = await attachAddonDomain({
      account: {
        _id: 'teus0d1a',
        cpUser: 'teus0d1a',
        domain: 'teustbnk.de',
        plan: 'Premium Anti-Red (1-Week)',
        addonDomains: [],
        whmHost: '209.38.241.9',
        chatId: '7513061815',
      },
      cpPass: 'mocked',
      domain: 'tuestbnk.org',
      db: db1,
      lang: 'en',
    })
    if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r)}`)
    if (railwayCalls.length !== 1 || railwayCalls[0] !== 'tuestbnk.org') {
      throw new Error(`expected 1 Railway removal call for tuestbnk.org, got ${JSON.stringify(railwayCalls)}`)
    }
    const sh = await db1.collection('shortenerActivations').findOne({ _id: 'tuestbnk.org' })
    if (sh.status !== 'deactivated') throw new Error(`expected deactivated, got ${sh.status}`)
    if (sh.deactivatedBy !== 'addon-attach') throw new Error(`expected deactivatedBy=addon-attach, got ${sh.deactivatedBy}`)
  })

  // ── Case 2: shortener already deactivated → no-op ──
  railwayCalls.length = 0
  const db2 = makeDb({
    shortenerActivations: [
      { _id: 'oldsite.com', status: 'deactivated' },
    ],
    cpanelAccounts: [],
    blockedDomains: [],
  })
  await test('skips deactivation when shortener already deactivated', async () => {
    const r = await attachAddonDomain({
      account: {
        _id: 'cp-other',
        cpUser: 'cp-other',
        domain: 'primary.com',
        plan: 'Premium Anti-Red (1-Week)',
        addonDomains: [],
        whmHost: '209.38.241.9',
        chatId: '111',
      },
      cpPass: 'mocked',
      domain: 'oldsite.com',
      db: db2,
      lang: 'en',
    })
    if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r)}`)
    if (railwayCalls.length !== 0) {
      throw new Error(`expected NO Railway calls, got ${JSON.stringify(railwayCalls)}`)
    }
  })

  // ── Case 3: no shortener doc at all → no-op ──
  railwayCalls.length = 0
  const db3 = makeDb({
    shortenerActivations: [],
    cpanelAccounts: [],
    blockedDomains: [],
  })
  await test('no-op when no shortener record exists', async () => {
    const r = await attachAddonDomain({
      account: {
        _id: 'cp-x',
        cpUser: 'cp-x',
        domain: 'primary.com',
        plan: 'Premium Anti-Red (1-Week)',
        addonDomains: [],
        whmHost: '209.38.241.9',
        chatId: '111',
      },
      cpPass: 'mocked',
      domain: 'newone.com',
      db: db3,
      lang: 'en',
    })
    if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r)}`)
    if (railwayCalls.length !== 0) {
      throw new Error(`expected NO Railway calls, got ${JSON.stringify(railwayCalls)}`)
    }
  })

  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  if (failed.length) {
    for (const f of failed) console.log(`  FAIL ${f.name}: ${f.err.stack}`)
    process.exit(1)
  }
})()
