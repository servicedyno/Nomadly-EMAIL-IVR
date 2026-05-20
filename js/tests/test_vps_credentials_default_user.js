// Regression test for the @spoofed VPS credentials bug
// (chatId 6996287179, 2026-05-19, Railway logs).
//
// Bug: vm-instance-setup.js used `instance.defaultUser || 'root'` for the
// username in the credentials message. Contabo's POST /compute/instances
// response returns `defaultUser: undefined` until the OS finishes
// provisioning — so users got `Username: root` for modern Ubuntu images
// (where the real default user is `admin` and root is locked). Login
// failed forever with "permission denied", users complained "password not
// working", and a password reset (which had time for `defaultUser` to
// populate in our DB and which uses it directly in the success message)
// was the only thing that ever worked.
//
// Fix: after createInstance, poll getInstance() up to 5×3s until
// `defaultUser` populates. Use that resolved value in BOTH the credentials
// message and the persisted _vpsPlansOf record.

const assert = require('assert')
const Module = require('module')

// ─── Test plumbing: stub contabo-service so we control its responses ──
let createInstanceImpl = async () => ({})
let getInstanceImpl = async () => null
let createSecretImpl = async () => ({ secretId: 999 })
let cancelInstanceImpl = async () => ({})

const mocks = new Map()
mocks.set('./contabo-service', {
  createInstance: (...a) => createInstanceImpl(...a),
  getInstance: (...a) => getInstanceImpl(...a),
  createSecret: (...a) => createSecretImpl(...a),
  cancelInstance: (...a) => cancelInstanceImpl(...a),
  listInstances: async () => [],
  listProductsRaw: async () => [],
  listImages: async () => [],
  resetPassword: async () => ({}),
  reinstallInstance: async () => ({}),
  upgradeInstance: async () => ({}),
  listSecrets: async () => [],
  deleteSecret: async () => ({}),
  getSecret: async () => ({}),
})

const origLoad = Module._load
Module._load = function (request, parent, isMain) {
  if (mocks.has(request)) return mocks.get(request)
  return origLoad.call(this, request, parent, isMain)
}

const vm = require('../vm-instance-setup')

// Speed up the polling delays for tests
const origSetTimeout = global.setTimeout
global.setTimeout = (fn) => origSetTimeout(fn, 0)

// Set the module-level db so insertOne in the code path is exercised
const insertedDocs = []
const fakeVpsPlansOf = {
  insertOne: async (doc) => { insertedDocs.push(doc); return { acknowledged: true } },
  updateOne: async () => ({ acknowledged: true }),
  findOne: async () => null,
  createIndex: async () => 'idx',
}
const fakeSshKeysOf = {
  insertOne: async () => ({ acknowledged: true }),
  findOne: async () => null,
  createIndex: async () => 'idx',
}
const fakeDb = {
  collection: (name) => {
    if (name === 'vpsPlansOf') return fakeVpsPlansOf
    if (name === 'sshKeysOf') return fakeSshKeysOf
    return { findOne: async () => null, updateOne: async () => ({}), insertOne: async () => ({}), createIndex: async () => 'idx' }
  },
}
vm.initVpsDb(fakeDb)

async function runCreate(vpsDetails) {
  insertedDocs.length = 0
  return vm.createVPSInstance(String(6996287179), vpsDetails)
}

const UBUNTU_2204_UUID = 'afecbb85-e2fc-46f0-9684-b46b1faf00bb'
const baseVpsDetails = {
  os: { id: UBUNTU_2204_UUID, name: 'Ubuntu 22.04' },
  productId: 'V92',
  config: { _id: 'V92' },
  zone: 'IND',
  plantotalPrice: 14.85,
  monthlyPrice: 14.85,
}

async function testDefaultUserPopulatedImmediately() {
  console.log('— Contabo returns defaultUser=admin immediately →')
  createInstanceImpl = async () => ({
    instanceId: 11111, name: 'vmi11111', displayName: 'nomadly-test',
    status: 'running', region: 'IND', productId: 'V92',
    imageId: 'afecbb85-e2fc-46f0-9684-b46b1faf00bb',
    osType: 'Linux',
    defaultUser: 'admin',
    ipConfig: { v4: { ip: '1.2.3.4' } },
    _actualProductId: 'V92',
    _actualImageId: 'afecbb85-e2fc-46f0-9684-b46b1faf00bb',
  })
  getInstanceImpl = async () => ({ defaultUser: 'admin', ipConfig: { v4: { ip: '1.2.3.4' } }, status: 'running' })

  const out = await runCreate(baseVpsDetails)
  assert.ok(out.success, `expected success=true, got: ${JSON.stringify(out)}`)
  const r = out.data
  assert.strictEqual(r.credentials.username, 'admin', 'username must equal admin when Contabo returns it')
  assert.ok(r.credentials.password && r.credentials.password.length >= 20, 'password is generated')
  assert.strictEqual(insertedDocs.length, 1, 'one DB record inserted')
  assert.strictEqual(insertedDocs[0].defaultUser, 'admin', 'DB record must store defaultUser=admin')
  console.log('  ✓ username=admin (direct)')
}

async function testDefaultUserPopulatesAfterPoll() {
  console.log('— Contabo returns defaultUser=undefined initially, populates after 2 polls →')
  createInstanceImpl = async () => ({
    instanceId: 22222, name: 'vmi22222', displayName: 'nomadly-test',
    status: 'provisioning', region: 'IND', productId: 'V92',
    imageId: 'afecbb85-e2fc-46f0-9684-b46b1faf00bb',
    osType: 'Linux',
    // No defaultUser yet (exact bug scenario)
    ipConfig: { v4: { ip: '0.0.0.0' } },
    _actualProductId: 'V92',
    _actualImageId: 'afecbb85-e2fc-46f0-9684-b46b1faf00bb',
  })
  let polls = 0
  getInstanceImpl = async () => {
    polls++
    if (polls >= 2) return { defaultUser: 'admin', ipConfig: { v4: { ip: '5.6.7.8' } }, status: 'running' }
    return { defaultUser: undefined, ipConfig: { v4: { ip: '0.0.0.0' } }, status: 'provisioning' }
  }

  const out = await runCreate(baseVpsDetails)
  assert.ok(out.success, `expected success=true, got: ${JSON.stringify(out)}`)
  const r = out.data
  assert.ok(polls >= 2, 'should have polled at least twice')
  assert.strictEqual(r.credentials.username, 'admin', 'username must equal admin after poll picks it up — NOT default fallback root')
  assert.strictEqual(insertedDocs[0].defaultUser, 'admin', 'DB must persist the polled defaultUser')
  // Bonus: the polled snapshot's IP should be picked up too
  assert.strictEqual(r.host, '5.6.7.8', 'host should be updated from the polled snapshot')
  console.log('  ✓ username=admin (poll), host updated to refreshed IP')
}

async function testDefaultUserNeverPopulatesFallsBackToRoot() {
  console.log('— Contabo never returns defaultUser → falls back to root →')
  createInstanceImpl = async () => ({
    instanceId: 33333, name: 'vmi33333', displayName: 'nomadly-test',
    status: 'provisioning', region: 'IND', productId: 'V92',
    imageId: 'afecbb85-e2fc-46f0-9684-b46b1faf00bb',
    osType: 'Linux',
    ipConfig: { v4: { ip: '9.9.9.9' } },
    _actualProductId: 'V92',
    _actualImageId: 'afecbb85-e2fc-46f0-9684-b46b1faf00bb',
  })
  getInstanceImpl = async () => ({ defaultUser: undefined, ipConfig: { v4: { ip: '9.9.9.9' } }, status: 'provisioning' })

  const out = await runCreate(baseVpsDetails)
  assert.ok(out.success, `expected success=true, got: ${JSON.stringify(out)}`)
  const r = out.data
  assert.strictEqual(r.credentials.username, 'root', 'fallback to root when Contabo never reports defaultUser')
  assert.strictEqual(insertedDocs[0].defaultUser, 'root', 'DB record stores the fallback root')
  console.log('  ✓ falls back to root only as last resort')
}

async function testRdpUsesAdminWithoutPolling() {
  console.log('— RDP/Windows instance uses admin without defaultUser-poll wait →')
  // Track defaultUser-specific polls vs incidental cancel-on-create polls.
  // The defaultUser-poll path returns truthy defaultUser, but in this test we
  // assert that the FIRST polling iteration (defaultUser branch) is skipped
  // entirely. We do this by detecting timing: a defaultUser poll would block
  // for ~15s in real time (5×3s). In tests we monkey-patched setTimeout to 0,
  // so we instead inspect the resolved username.
  createInstanceImpl = async () => ({
    instanceId: 44444, name: 'vmi44444', displayName: 'nomadly-test',
    status: 'running', region: 'IND', productId: 'V92',
    osType: 'Windows',
    // No defaultUser (which for Linux would trigger the polling loop)
    ipConfig: { v4: { ip: '1.1.1.1' } },
    _actualProductId: 'V92',
    _actualImageId: 'win2022',
  })
  // If the RDP branch DID poll for defaultUser, it would either receive null
  // or our test stub would have to return a Linux user — both wrong for RDP.
  // We return a non-Linux poll response and rely on the code skipping it.
  getInstanceImpl = async () => ({ defaultUser: 'shouldNotBeUsedForRDP', ipConfig: { v4: { ip: '1.1.1.1' } } })

  const out = await runCreate({ ...baseVpsDetails, os: { id: 'win2022', name: 'Windows Server 2022', isRDP: true }, isRDP: true })
  assert.ok(out.success, `expected success=true, got: ${JSON.stringify(out)}`)
  const r = out.data
  assert.strictEqual(r.credentials.username, 'admin', 'RDP uses admin as the default (no Linux-user contamination from poll)')
  assert.strictEqual(insertedDocs[0].defaultUser, 'admin', 'DB record stores admin for RDP')
  console.log('  ✓ RDP=admin, defaultUser-poll branch correctly skipped')
}

;(async () => {
  console.log('=== vm-instance-setup.js — VPS credentials defaultUser bug ===\n')
  await testDefaultUserPopulatedImmediately()
  await testDefaultUserPopulatesAfterPoll()
  await testDefaultUserNeverPopulatesFallsBackToRoot()
  await testRdpUsesAdminWithoutPolling()
  console.log('\n✅ All @spoofed VPS-credentials regression tests passed.')
  process.exit(0)
})().catch((e) => {
  console.error('\n❌ TEST FAILURE:', e.message)
  console.error(e.stack)
  process.exit(1)
})
