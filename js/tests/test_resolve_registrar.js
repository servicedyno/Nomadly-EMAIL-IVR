/* global require, module, process */
/**
 * Tests for resolveRegistrar / isRegistrarUnclear — the auto-heal helper
 * for domains with missing or sentinel registrar tags (e.g. legacy
 * 'external' tags from the "Connect External Domain" hosting flow).
 *
 * @Mrdoitright53 / itsonlytravel.com regression test.
 *
 * Strategy: hot-swap opService and the cr-domain-details-get module via
 * Module._load so we never call the real APIs. The in-memory DB mock is a
 * minimal shape that mimics MongoDB's updateOne / findOne for the two
 * collections the helper touches.
 */
const assert = require('assert')
const Module = require('module')
const path = require('path')

// ── Module hot-swap helpers ──────────────────────────────────────────
const _origLoad = Module._load
const _mocks = {}

function mockModule(name, impl) {
  _mocks[name] = impl
}
function clearMocks() {
  Object.keys(_mocks).forEach(k => delete _mocks[k])
}
Module._load = function (request, parent, ...rest) {
  const key = Object.keys(_mocks).find(k =>
    request === k ||
    request.endsWith('/' + k) ||
    (parent && parent.filename && path.resolve(path.dirname(parent.filename), request).endsWith('/' + k))
  )
  if (key) return _mocks[key]
  return _origLoad.call(this, request, parent, ...rest)
}

// ── In-memory DB mock ────────────────────────────────────────────────
function makeDb() {
  const collections = {
    domainsOf: new Map(),
    registeredDomains: new Map(),
  }
  return {
    _collections: collections,
    collection(name) {
      const store = collections[name] || (collections[name] = new Map())
      return {
        async findOne(query) {
          // Support {domainName: x} for domainsOf and {_id: x} for registeredDomains
          const key = query.domainName ?? query._id
          return store.get(key) || null
        },
        async updateOne(query, update, _opts) {
          const key = query.domainName ?? query._id
          const existing = store.get(key) || {}
          const $set = update.$set || {}
          const next = { ...existing }
          for (const [k, v] of Object.entries($set)) {
            // Support dotted paths like 'val.registrar'
            if (k.includes('.')) {
              const parts = k.split('.')
              let cursor = next
              for (let i = 0; i < parts.length - 1; i++) {
                if (!cursor[parts[i]]) cursor[parts[i]] = {}
                cursor = cursor[parts[i]]
              }
              cursor[parts[parts.length - 1]] = v
            } else {
              next[k] = v
            }
          }
          store.set(key, next)
          return { acknowledged: true }
        },
      }
    },
  }
}

// ── Reset module cache + require under mocks ─────────────────────────
function loadDomainService(opMock, crMock) {
  // Clear cached modules
  delete require.cache[require.resolve('../domain-service.js')]
  delete require.cache[require.resolve('../op-service.js')]
  try { delete require.cache[require.resolve('../cr-domain-details-get.js')] } catch (_) {}
  try { delete require.cache[require.resolve('../cf-service.js')] } catch (_) {}
  clearMocks()
  if (opMock) mockModule('op-service.js', opMock)
  if (opMock) mockModule('./op-service', opMock)
  if (crMock) mockModule('cr-domain-details-get.js', crMock)
  if (crMock) mockModule('./cr-domain-details-get', crMock)
  // Stub cf-service so we never try to hit Cloudflare
  mockModule('./cf-service', {
    createZone: async () => ({ success: false }),
    getZoneByName: async () => null,
    listDNSRecords: async () => [],
  })
  // Stub other CR deps the module pulls in (avoid env-var requires)
  mockModule('./cr-domain-price-get', { checkDomainPriceOnline: async () => ({}) })
  mockModule('./cr-domain-register', { buyDomainOnline: async () => ({}) })
  return require('../domain-service.js')
}

// ── Tests ────────────────────────────────────────────────────────────
let passed = 0, failed = 0
function it(name, fn) {
  try {
    const r = fn()
    if (r && r.then) {
      return r.then(() => { console.log(`✓ ${name}`); passed++ })
        .catch(err => { console.error(`✗ ${name}: ${err.message}`); failed++ })
    }
    console.log(`✓ ${name}`); passed++
  } catch (err) {
    console.error(`✗ ${name}: ${err.message}`); failed++
  }
}

async function run() {
  // ─── isRegistrarUnclear ───────────────────────────────────────────
  await it('isRegistrarUnclear: null → unclear', () => {
    const ds = loadDomainService()
    assert.strictEqual(ds.isRegistrarUnclear(null), true)
  })
  await it('isRegistrarUnclear: undefined → unclear', () => {
    const ds = loadDomainService()
    assert.strictEqual(ds.isRegistrarUnclear(undefined), true)
  })
  await it('isRegistrarUnclear: empty string → unclear', () => {
    const ds = loadDomainService()
    assert.strictEqual(ds.isRegistrarUnclear(''), true)
  })
  await it('isRegistrarUnclear: whitespace only → unclear', () => {
    const ds = loadDomainService()
    assert.strictEqual(ds.isRegistrarUnclear('   '), true)
  })
  await it('isRegistrarUnclear: legacy "external" → unclear (mis-tag candidate)', () => {
    const ds = loadDomainService()
    assert.strictEqual(ds.isRegistrarUnclear('external'), true)
    assert.strictEqual(ds.isRegistrarUnclear('EXTERNAL'), true)
    assert.strictEqual(ds.isRegistrarUnclear('External'), true)
  })
  await it('isRegistrarUnclear: "unknown" / "manual" / "none" / "null" / "undefined" → unclear', () => {
    const ds = loadDomainService()
    for (const v of ['unknown', 'manual', 'none', 'null', 'undefined']) {
      assert.strictEqual(ds.isRegistrarUnclear(v), true, `expected unclear for "${v}"`)
    }
  })
  await it('isRegistrarUnclear: OpenProvider → definitive (not unclear)', () => {
    const ds = loadDomainService()
    assert.strictEqual(ds.isRegistrarUnclear('OpenProvider'), false)
    assert.strictEqual(ds.isRegistrarUnclear('openprovider'), false)
  })
  await it('isRegistrarUnclear: ConnectReseller → definitive', () => {
    const ds = loadDomainService()
    assert.strictEqual(ds.isRegistrarUnclear('ConnectReseller'), false)
    assert.strictEqual(ds.isRegistrarUnclear('connectreseller'), false)
  })
  await it('isRegistrarUnclear: external_unmanaged → definitive (verified-not-ours)', () => {
    const ds = loadDomainService()
    assert.strictEqual(ds.isRegistrarUnclear('external_unmanaged'), false)
    assert.strictEqual(ds.isRegistrarUnclear('External_Unmanaged'), false)
  })
  await it('isRegistrarUnclear: numeric / other type → unclear (safe default)', () => {
    const ds = loadDomainService()
    assert.strictEqual(ds.isRegistrarUnclear(42), true)
    assert.strictEqual(ds.isRegistrarUnclear({}), true)
    assert.strictEqual(ds.isRegistrarUnclear([]), true)
  })

  // ─── resolveRegistrar happy path (already definitive) ─────────────
  await it('resolveRegistrar: definitive OpenProvider → no probe, no heal', async () => {
    let opCalls = 0
    const opMock = { getDomainInfo: async () => { opCalls++; return null } }
    const ds = loadDomainService(opMock, async () => null)
    const db = makeDb()
    await db.collection('domainsOf').updateOne(
      { domainName: 'good.com' },
      { $set: { domainName: 'good.com', registrar: 'OpenProvider', opDomainId: 123 } }
    )
    const res = await ds.resolveRegistrar('good.com', db)
    assert.strictEqual(res.registrar, 'OpenProvider')
    assert.strictEqual(res.healed, false)
    assert.strictEqual(opCalls, 0, 'must NOT probe OP when registrar is already definitive')
  })

  await it('resolveRegistrar: definitive ConnectReseller → no probe, no heal', async () => {
    let opCalls = 0
    const opMock = { getDomainInfo: async () => { opCalls++; return null } }
    const ds = loadDomainService(opMock, async () => null)
    const db = makeDb()
    await db.collection('domainsOf').updateOne(
      { domainName: 'cr.com' },
      { $set: { domainName: 'cr.com', registrar: 'ConnectReseller' } }
    )
    const res = await ds.resolveRegistrar('cr.com', db)
    assert.strictEqual(res.registrar, 'ConnectReseller')
    assert.strictEqual(res.healed, false)
    assert.strictEqual(opCalls, 0)
  })

  await it('resolveRegistrar: definitive external_unmanaged → no probe (already verified-not-ours)', async () => {
    let opCalls = 0
    const opMock = { getDomainInfo: async () => { opCalls++; return null } }
    const ds = loadDomainService(opMock, async () => null)
    const db = makeDb()
    await db.collection('domainsOf').updateOne(
      { domainName: 'mine.com' },
      { $set: { domainName: 'mine.com', registrar: 'external_unmanaged' } }
    )
    const res = await ds.resolveRegistrar('mine.com', db)
    assert.strictEqual(res.registrar, 'external_unmanaged')
    assert.strictEqual(res.healed, false)
    assert.strictEqual(opCalls, 0, 'must NOT re-probe a verified-external domain')
  })

  // ─── resolveRegistrar heal path (sentinel → detected at OP) ───────
  await it('resolveRegistrar: legacy "external" tag → re-probes and heals to OpenProvider (@Mrdoitright53/itsonlytravel.com case)', async () => {
    let opCalls = 0
    const opMock = {
      getDomainInfo: async (d) => {
        opCalls++
        if (d === 'itsonlytravel.com') return { domainId: 987654, nameservers: [], status: 'ACT', expiresAt: '2027-04-07' }
        return null
      }
    }
    const crMock = async () => ({ responseData: null })
    const ds = loadDomainService(opMock, crMock)
    const db = makeDb()
    // Seed the broken doc: external-flow domain with `val.registrar = 'external'` + cfZoneId
    await db.collection('registeredDomains').updateOne(
      { _id: 'itsonlytravel.com' },
      { $set: {
        val: {
          domain: 'itsonlytravel.com',
          registrar: 'external',
          nameserverType: 'cloudflare',
          cfZoneId: 'abc123',
          nameservers: ['fred.ns.cloudflare.com', 'kate.ns.cloudflare.com'],
          ownerChatId: '8737445617',
        }
      } }
    )
    const res = await ds.resolveRegistrar('itsonlytravel.com', db)
    assert.strictEqual(res.registrar, 'OpenProvider')
    assert.strictEqual(res.healed, true)
    assert.ok(opCalls >= 1, 'must probe OP at least once')
    // Verify persistence on registeredDomains
    const persisted = await db.collection('registeredDomains').findOne({ _id: 'itsonlytravel.com' })
    assert.strictEqual(persisted.val.registrar, 'OpenProvider')
    assert.strictEqual(persisted.val.opDomainId, 987654, 'opDomainId must be persisted')
  })

  await it('resolveRegistrar: missing registrar tag → re-probes and heals to ConnectReseller', async () => {
    const opMock = { getDomainInfo: async () => null }
    const crMock = async (d) => d === 'crtag.com'
      ? { responseData: { domainNameId: 9999 } }
      : { responseData: null }
    const ds = loadDomainService(opMock, crMock)
    const db = makeDb()
    await db.collection('registeredDomains').updateOne(
      { _id: 'crtag.com' },
      { $set: { val: { domain: 'crtag.com', nameserverType: 'cloudflare', cfZoneId: 'xyz' } } } // NO registrar tag
    )
    const res = await ds.resolveRegistrar('crtag.com', db)
    assert.strictEqual(res.registrar, 'ConnectReseller')
    assert.strictEqual(res.healed, true)
  })

  await it('resolveRegistrar: legacy "external" tag, not in OP/CR → upgrades to "external_unmanaged" so next read is a no-op', async () => {
    let opCalls = 0
    let crCalls = 0
    const opMock = { getDomainInfo: async () => { opCalls++; return null } }
    const crMock = async () => { crCalls++; return { responseData: null } }
    const ds = loadDomainService(opMock, crMock)
    const db = makeDb()
    await db.collection('registeredDomains').updateOne(
      { _id: 'trulyexternal.com' },
      { $set: { val: { domain: 'trulyexternal.com', registrar: 'external', nameserverType: 'cloudflare' } } }
    )
    const res1 = await ds.resolveRegistrar('trulyexternal.com', db)
    assert.strictEqual(res1.registrar, 'external_unmanaged')
    assert.strictEqual(res1.healed, false)
    // Verify the tag was upgraded
    const persisted = await db.collection('registeredDomains').findOne({ _id: 'trulyexternal.com' })
    assert.strictEqual(persisted.val.registrar, 'external_unmanaged')
    // Second call: must NOT probe again
    const beforeOp = opCalls, beforeCr = crCalls
    const res2 = await ds.resolveRegistrar('trulyexternal.com', db)
    assert.strictEqual(res2.registrar, 'external_unmanaged')
    assert.strictEqual(opCalls, beforeOp, 'must not re-probe OP after upgrade')
    assert.strictEqual(crCalls, beforeCr, 'must not re-probe CR after upgrade')
  })

  await it('resolveRegistrar: pre-fetched meta is honoured (no extra DB hit)', async () => {
    const opMock = { getDomainInfo: async () => null }
    const ds = loadDomainService(opMock, async () => null)
    const db = makeDb()
    const fakeMeta = { domainName: 'pre.com', registrar: 'OpenProvider', opDomainId: 1 }
    const res = await ds.resolveRegistrar('pre.com', db, fakeMeta)
    assert.strictEqual(res.registrar, 'OpenProvider')
    assert.strictEqual(res.healed, false)
    assert.strictEqual(res.meta, fakeMeta, 'pre-fetched meta must be passed through unchanged')
  })

  // ─── End-to-end: updateAllNameservers self-heals via resolveRegistrar
  await it('updateAllNameservers: mis-tagged "external" doc → resolves to OP and updates NS (the @Mrdoitright53 fix in action)', async () => {
    let opUpdateCalled = false
    const opMock = {
      getDomainInfo: async (d) => d === 'itsonlytravel.com' ? { domainId: 111, nameservers: [] } : null,
      updateNameservers: async (d, ns) => {
        opUpdateCalled = true
        assert.strictEqual(d, 'itsonlytravel.com')
        assert.deepStrictEqual(ns, ['fred.ns.cloudflare.com', 'kate.ns.cloudflare.com'])
        return { success: true }
      },
    }
    const ds = loadDomainService(opMock, async () => ({ responseData: null }))
    const db = makeDb()
    await db.collection('registeredDomains').updateOne(
      { _id: 'itsonlytravel.com' },
      { $set: { val: {
        domain: 'itsonlytravel.com',
        registrar: 'external',
        nameserverType: 'cloudflare',
        cfZoneId: 'zone1',
        nameservers: ['old.ns'],
      } } }
    )
    const res = await ds.updateAllNameservers('itsonlytravel.com', ['fred.ns.cloudflare.com', 'kate.ns.cloudflare.com'], db)
    assert.ok(!res.error, `expected success, got error: ${res.error}`)
    assert.strictEqual(opUpdateCalled, true, 'OP updateNameservers must have been called')
    const persisted = await db.collection('registeredDomains').findOne({ _id: 'itsonlytravel.com' })
    assert.strictEqual(persisted.val.registrar, 'OpenProvider', 'registrar tag must be healed on disk')
  })

  await it('updateAllNameservers: truly-external domain → returns "externally_managed" error (no API call)', async () => {
    const opMock = {
      getDomainInfo: async () => null,
      updateNameservers: async () => { throw new Error('should not be called'); }
    }
    const ds = loadDomainService(opMock, async () => ({ responseData: null }))
    const db = makeDb()
    await db.collection('registeredDomains').updateOne(
      { _id: 'trulyexternal.com' },
      { $set: { val: { domain: 'trulyexternal.com', registrar: 'external_unmanaged', nameserverType: 'cloudflare' } } }
    )
    const res = await ds.updateAllNameservers('trulyexternal.com', ['ns1.x.com', 'ns2.x.com'], db)
    assert.strictEqual(res.error, 'externally_managed')
  })

  // ─── Summary ───────────────────────────────────────────────────────
  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}

run().catch(e => { console.error('runner crashed:', e); process.exit(2) })
