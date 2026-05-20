// Unit test for the registrar auto-detect fix in /app/js/domain-service.js
//
// Background: production bot user @Mrdoitright53 got the error
//   "❌ Failed to update nameservers: Could not find domain at registrar"
// when trying to update nameservers. Root cause was domain-service.js
// line ~489:
//     const registrar = meta.registrar || 'ConnectReseller'
// which silently defaulted untagged/mis-tagged domains to ConnectReseller,
// then queried CR which didn't have the domain (it was actually at
// OpenProvider).
//
// The fix:
//   1. New helper detectRegistrarForDomain(domain, db) probes BOTH OP and CR
//      in parallel and returns whichever finds the domain. It also persists
//      the detected registrar back to domainsOf / registeredDomains.
//   2. updateAllNameservers calls it when meta.registrar is missing.
//   3. updateAllNameservers ALSO calls it as a safety net when meta says CR
//      but CR returns no domainNameId — so mis-tagged docs self-heal.
//
// This test stubs the OP and CR network calls so it runs offline and proves
// the dispatch logic + DB persist behavior without hitting real registrars.

const assert = require('assert')
const Module = require('module')

// ─── Mock-loader infrastructure ─────────────────────────────────────
const originalResolve = Module._resolve_filename || Module._resolveFilename
const mocks = new Map()
const origLoad = Module._load
Module._load = function (request, parent, isMain) {
  if (mocks.has(request)) return mocks.get(request)
  return origLoad.call(this, request, parent, isMain)
}

// In-memory DB mock that records every collection().updateOne(...) call
function makeDbMock() {
  const writes = []
  const db = {
    collection: (name) => ({
      updateOne: async (filter, update, opts) => {
        writes.push({ coll: name, filter, update, opts })
        return { matchedCount: 1, modifiedCount: 1 }
      },
      findOne: async () => null,
    }),
  }
  return { db, writes }
}

// Mock op-service with a configurable response
let opGetInfoImpl = () => null
let opUpdateNsImpl = () => ({ success: true })
mocks.set('./op-service', {
  getDomainInfo: (...a) => opGetInfoImpl(...a),
  updateNameservers: (...a) => opUpdateNsImpl(...a),
  checkDomainAvailability: async () => ({ available: false }),
})

// Mock cr-domain-details-get with a configurable response
let crDetailsImpl = () => null
mocks.set('./cr-domain-details-get', (...a) => crDetailsImpl(...a))

// Don't load real CF/CR pricing modules
mocks.set('./cf-service', { listDNSRecords: async () => [], createZone: async () => ({}) })
mocks.set('./cr-domain-price-get', { checkDomainPriceOnline: async () => ({ available: false }) })
mocks.set('./cr-domain-register', { buyDomainOnline: async () => ({}) })
mocks.set('./cr-dns-record-update-ns', { updateDNSRecordNs: async () => ({ success: true }) })

// Now require domain-service under our mock loader
const domainService = require('../domain-service')

// ─── Tests ──────────────────────────────────────────────────────────

async function testDetectFindsOP() {
  console.log('— detectRegistrarForDomain: domain at OP →')
  opGetInfoImpl = async () => ({ domainId: 999111, nameservers: ['ns1.x'] })
  crDetailsImpl = async () => ({ responseData: {} })
  const { db, writes } = makeDbMock()
  const reg = await domainService.detectRegistrarForDomain('foo.com', db)
  assert.strictEqual(reg, 'OpenProvider', 'should detect OP when getDomainInfo returns a domainId')
  // Should persist to BOTH collections
  const dofWrite = writes.find((w) => w.coll === 'domainsOf')
  const regdWrite = writes.find((w) => w.coll === 'registeredDomains')
  assert.ok(dofWrite, 'should write to domainsOf')
  assert.ok(regdWrite, 'should write to registeredDomains')
  assert.strictEqual(dofWrite.update.$set.registrar, 'OpenProvider', 'domainsOf.registrar=OpenProvider')
  assert.strictEqual(dofWrite.update.$set.opDomainId, 999111, 'domainsOf.opDomainId persisted')
  assert.strictEqual(regdWrite.update.$set['val.registrar'], 'OpenProvider', 'registeredDomains.val.registrar=OpenProvider')
  console.log('  ✓ OP detected + persisted to both collections')
}

async function testDetectFindsCR() {
  console.log('— detectRegistrarForDomain: domain at CR →')
  opGetInfoImpl = async () => null
  crDetailsImpl = async () => ({ responseData: { domainNameId: 'crd-123' } })
  const { db, writes } = makeDbMock()
  const reg = await domainService.detectRegistrarForDomain('bar.com', db)
  assert.strictEqual(reg, 'ConnectReseller', 'should detect CR when getDomainDetails returns domainNameId')
  const dofWrite = writes.find((w) => w.coll === 'domainsOf')
  assert.ok(dofWrite, 'should write to domainsOf')
  assert.strictEqual(dofWrite.update.$set.registrar, 'ConnectReseller', 'domainsOf.registrar=ConnectReseller')
  assert.ok(!('opDomainId' in dofWrite.update.$set), 'no opDomainId for CR detection')
  console.log('  ✓ CR detected + persisted')
}

async function testDetectFindsNeither() {
  console.log('— detectRegistrarForDomain: domain at neither →')
  opGetInfoImpl = async () => null
  crDetailsImpl = async () => ({ responseData: {} })
  const { db, writes } = makeDbMock()
  const reg = await domainService.detectRegistrarForDomain('nope.com', db)
  assert.strictEqual(reg, null, 'should return null when neither registrar has the domain')
  assert.strictEqual(writes.length, 0, 'should not persist anything when nothing detected')
  console.log('  ✓ null returned + no DB writes')
}

async function testDetectOPWins() {
  console.log('— detectRegistrarForDomain: domain at BOTH, OP wins →')
  opGetInfoImpl = async () => ({ domainId: 5, nameservers: [] })
  crDetailsImpl = async () => ({ responseData: { domainNameId: 'crd' } })
  const { db } = makeDbMock()
  const reg = await domainService.detectRegistrarForDomain('both.com', db)
  assert.strictEqual(reg, 'OpenProvider', 'OP must take precedence when both registrars know the domain')
  console.log('  ✓ OP wins tie-break (correct — OP is more authoritative for our flow)')
}

async function testUpdateAllNameserversAutoDetectsWhenRegistrarMissing() {
  console.log('— updateAllNameservers: untagged domain → auto-detects + updates →')
  // Stub OP to know the domain, OP update to succeed
  opGetInfoImpl = async () => ({ domainId: 42, nameservers: ['old.ns'] })
  opUpdateNsImpl = async () => ({ success: true })
  crDetailsImpl = async () => ({ responseData: {} })

  // DB returns a meta WITHOUT a registrar field
  const writes = []
  const db = {
    collection: (name) => ({
      findOne: async (filter) => {
        if (name === 'domainsOf' && filter.domainName === 'untagged.com') {
          return { domainName: 'untagged.com' /* no registrar */, nameservers: ['old.ns'] }
        }
        return null
      },
      updateOne: async (filter, update, opts) => {
        writes.push({ coll: name, filter, update, opts })
        return { matchedCount: 1, modifiedCount: 1 }
      },
    }),
  }

  const result = await domainService.updateAllNameservers(
    'untagged.com',
    ['new1.example.com', 'new2.example.com'],
    db
  )
  assert.strictEqual(result.success, true, 'update should succeed via auto-detect path')
  assert.deepStrictEqual(result.nameservers, ['new1.example.com', 'new2.example.com'], 'should return the new NS list')

  // Should have persisted the auto-detected registrar
  const persistedRegistrar = writes.some(
    (w) => w.coll === 'domainsOf' && w.update.$set && w.update.$set.registrar === 'OpenProvider'
  )
  assert.ok(persistedRegistrar, 'must persist auto-detected registrar=OpenProvider to domainsOf')
  // Should have persisted the new NS list
  const persistedNS = writes.some(
    (w) => w.coll === 'domainsOf' && w.update.$set && Array.isArray(w.update.$set.nameservers)
  )
  assert.ok(persistedNS, 'must persist new nameservers to domainsOf')
  console.log('  ✓ untagged domain self-heals (registrar persisted) AND nameservers updated')
}

async function testUpdateAllNameserversFallsBackWhenCRMistagged() {
  console.log('— updateAllNameservers: meta says CR but CR has nothing → OP fallback →')
  // CR initially returns no domainNameId — simulating a mis-tagged record
  opGetInfoImpl = async () => ({ domainId: 7, nameservers: ['old.ns'] })
  opUpdateNsImpl = async () => ({ success: true })
  crDetailsImpl = async () => ({ responseData: {} }) // CR has nothing

  const writes = []
  const db = {
    collection: (name) => ({
      findOne: async (filter) => {
        if (name === 'domainsOf' && filter.domainName === 'mistagged.com') {
          return { domainName: 'mistagged.com', registrar: 'ConnectReseller', nameservers: [] }
        }
        return null
      },
      updateOne: async (filter, update, opts) => {
        writes.push({ coll: name, filter, update, opts })
        return { matchedCount: 1, modifiedCount: 1 }
      },
    }),
  }

  const result = await domainService.updateAllNameservers(
    'mistagged.com',
    ['ns1.cf.com', 'ns2.cf.com'],
    db
  )
  assert.strictEqual(result.success, true, 'mis-tagged record should silently fall back to OP and succeed')
  assert.deepStrictEqual(result.nameservers, ['ns1.cf.com', 'ns2.cf.com'])

  // Should have rewritten the registrar tag to OpenProvider
  const corrected = writes.some(
    (w) => w.coll === 'domainsOf' && w.update.$set && w.update.$set.registrar === 'OpenProvider'
  )
  assert.ok(corrected, 'mis-tagged registrar must be corrected to OpenProvider in domainsOf')
  console.log('  ✓ mis-tagged CR record self-heals via OP fallback')
}

async function testUpdateAllNameserversStillFailsWhenDomainTrulyAbsent() {
  console.log('— updateAllNameservers: domain absent at BOTH registrars → user-friendly error →')
  opGetInfoImpl = async () => null
  crDetailsImpl = async () => ({ responseData: {} })

  const db = {
    collection: (name) => ({
      findOne: async (filter) => {
        if (name === 'domainsOf' && filter.domainName === 'gone.com') {
          return { domainName: 'gone.com' /* no registrar */, nameservers: [] }
        }
        return null
      },
      updateOne: async () => ({}),
    }),
  }
  const result = await domainService.updateAllNameservers('gone.com', ['a.b.c', 'd.e.f'], db)
  assert.ok(result.error, 'should still return an error if neither registrar finds the domain')
  assert.match(
    result.error,
    /Could not find domain at registrar/i,
    'preserve the legacy user-facing error text when domain truly is gone'
  )
  console.log('  ✓ true "domain missing" still surfaces the same error string')
}

;(async () => {
  console.log('=== domain-service.js — registrar auto-detect tests ===\n')
  await testDetectFindsOP()
  await testDetectFindsCR()
  await testDetectFindsNeither()
  await testDetectOPWins()
  await testUpdateAllNameserversAutoDetectsWhenRegistrarMissing()
  await testUpdateAllNameserversFallsBackWhenCRMistagged()
  await testUpdateAllNameserversStillFailsWhenDomainTrulyAbsent()
  console.log('\n✅ All registrar auto-detect tests passed.')
  process.exit(0)
})().catch((e) => {
  console.error('\n❌ TEST FAILURE:', e.message)
  console.error(e.stack)
  process.exit(1)
})
