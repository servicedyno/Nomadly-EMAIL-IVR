/* eslint-env node */
/**
 * Unit tests for maxsql-migration.js — verifies:
 *   1. Skips when migrations marker already exists (idempotent)
 *   2. Skips when WHM env vars are missing (no crash)
 *   3. Calls modifypkg + modifyacct for each Premium Monthly account
 *   4. Sets the migrations marker only on full success
 *   5. Does NOT set the marker on CF Access 403 (so retry happens next startup)
 *   6. Skips the cpanel-account loop entry when modifypkg itself returns 403
 *
 * Mocks axios with Module._load + provides a fake MongoDB-ish db.
 *
 * Run: node js/__tests__/maxsql-migration.test.js
 */
require('dotenv').config({ path: '/app/backend/.env' })
const assert = require('assert')
const path = require('path')
const Module = require('module')

const calls = []
let stubResponder = null
function makeStubAxios() {
  const handler = (method) => async (url, cfg) => {
    calls.push({ method: method.toUpperCase(), url, params: cfg?.params })
    return stubResponder({ method: method.toUpperCase(), url, params: cfg?.params })
  }
  const inst = { get: handler('get'), post: handler('post'), delete: handler('delete') }
  inst.create = () => inst
  return inst
}

const origLoad = Module._load
Module._load = function (req, parent, ...rest) {
  if (req === 'axios') return makeStubAxios()
  return origLoad.call(this, req, parent, ...rest)
}
process.env.WHM_API_URL = 'http://stub-whm/'
process.env.WHM_TOKEN = 'stub-token'

delete require.cache[path.resolve('/app/js/maxsql-migration.js')]
const { runMaxsqlMigration, MIGRATION_ID } = require('/app/js/maxsql-migration')
Module._load = origLoad

// Fake DB
function makeFakeDb(opts = {}) {
  const migrationsDocs = opts.migrationsDocs || {}
  const cpanelDocs = opts.cpanelDocs || []
  const updates = []
  return {
    collection(name) {
      if (name === 'migrations') {
        return {
          findOne: async (q) => migrationsDocs[q._id] || null,
          updateOne: async (q, u) => {
            updates.push({ name, q, u })
            const id = q._id
            migrationsDocs[id] = { _id: id, ...u.$set }
            return { acknowledged: true }
          },
        }
      }
      if (name === 'cpanelAccounts') {
        return {
          find: (q) => {
            return {
              project: () => ({
                toArray: async () => cpanelDocs.filter(d => {
                  if (q.plan instanceof RegExp) return q.plan.test(d.plan || '')
                  return true
                }),
              }),
            }
          },
        }
      }
      throw new Error('unknown collection: ' + name)
    },
    _migrations: migrationsDocs,
    _updates: updates,
  }
}

function reset() { calls.length = 0 }

async function test_skips_when_marker_exists() {
  reset()
  const db = makeFakeDb({ migrationsDocs: { [MIGRATION_ID]: { _id: MIGRATION_ID, completedAt: new Date() } } })
  stubResponder = () => { throw new Error('should not call WHM') }
  await runMaxsqlMigration(() => db)
  assert.strictEqual(calls.length, 0, 'must not call WHM when marker is set')
  console.log('  PASS: skips when marker already exists')
}

async function test_skips_when_whm_env_missing() {
  reset()
  const saved = process.env.WHM_API_URL
  delete process.env.WHM_API_URL
  // Force fresh require so client builder sees the missing env
  delete require.cache[path.resolve('/app/js/maxsql-migration.js')]
  Module._load = function (req, parent, ...rest) {
    if (req === 'axios') return makeStubAxios()
    return origLoad.call(this, req, parent, ...rest)
  }
  const m = require('/app/js/maxsql-migration')
  Module._load = origLoad
  const db = makeFakeDb()
  stubResponder = () => { throw new Error('should not be called') }
  await m.runMaxsqlMigration(() => db)
  assert.strictEqual(calls.length, 0, 'must not call WHM when env missing')
  assert.strictEqual(db._updates.length, 0, 'must not set marker')
  process.env.WHM_API_URL = saved
  console.log('  PASS: skips when WHM_API_URL missing (no crash)')
}

async function test_happy_path() {
  reset()
  const db = makeFakeDb({
    cpanelDocs: [
      { _id: 'a1', cpUser: 'a1', domain: 'a.com', plan: 'Premium Anti-Red HostPanel (1-Month)' },
      { _id: 'a2', cpUser: 'a2', domain: 'b.com', plan: 'Premium Anti-Red HostPanel (1-Month)' },
      { _id: 'a3', cpUser: 'a3', domain: 'c.com', plan: 'Golden Anti-Red HostPanel (1-Month)' }, // not matched
    ],
  })
  // Restore env
  process.env.WHM_API_URL = 'http://stub-whm/'
  // Re-require to bind axios stub
  delete require.cache[path.resolve('/app/js/maxsql-migration.js')]
  Module._load = function (req, parent, ...rest) {
    if (req === 'axios') return makeStubAxios()
    return origLoad.call(this, req, parent, ...rest)
  }
  const m = require('/app/js/maxsql-migration')
  Module._load = origLoad

  stubResponder = ({ url, params }) => {
    if (url === '/modifypkg') {
      assert.strictEqual(params.name, 'Premium-Anti-Red-HostPanel-1-Month')
      assert.strictEqual(params.MAXSQL, 5)
      return { status: 200, data: { metadata: { result: 1, reason: 'OK' } } }
    }
    if (url === '/modifyacct') {
      assert.strictEqual(params.MAXSQL, 5)
      assert.ok(['a1', 'a2'].includes(params.user))
      return { status: 200, data: { metadata: { result: 1 } } }
    }
    throw new Error('unexpected: ' + url)
  }

  await m.runMaxsqlMigration(() => db)
  // Should have hit: 1× modifypkg + 2× modifyacct
  assert.strictEqual(calls.filter(c => c.url === '/modifypkg').length, 1)
  assert.strictEqual(calls.filter(c => c.url === '/modifyacct').length, 2, 'must skip non-Premium Monthly accounts')
  // Marker set
  assert.ok(db._migrations[MIGRATION_ID]?.completedAt, 'marker must be set on success')
  assert.strictEqual(db._migrations[MIGRATION_ID].stats.ok, 2)
  console.log('  PASS: happy path — modifypkg + modifyacct per Premium Monthly account + marker set')
}

async function test_defers_on_cf_access_403_modifypkg() {
  reset()
  process.env.WHM_API_URL = 'http://stub-whm/'
  delete require.cache[path.resolve('/app/js/maxsql-migration.js')]
  Module._load = function (req, parent, ...rest) {
    if (req === 'axios') return makeStubAxios()
    return origLoad.call(this, req, parent, ...rest)
  }
  const m = require('/app/js/maxsql-migration')
  Module._load = origLoad

  const db = makeFakeDb({
    cpanelDocs: [{ _id: 'a1', cpUser: 'a1', domain: 'a.com', plan: 'Premium Anti-Red HostPanel (1-Month)' }],
  })
  stubResponder = ({ url }) => {
    if (url === '/modifypkg') return { status: 403, data: { errors: ['CF Access denied'] } }
    throw new Error('modifyacct should not be reached')
  }
  await m.runMaxsqlMigration(() => db)
  assert.strictEqual(calls.filter(c => c.url === '/modifyacct').length, 0, 'must not loop modifyacct after modifypkg 403')
  assert.strictEqual(db._updates.length, 0, 'must NOT set marker on 403 — retry next startup')
  console.log('  PASS: defers (no marker) when modifypkg returns 403')
}

async function test_defers_on_cf_access_403_modifyacct() {
  reset()
  process.env.WHM_API_URL = 'http://stub-whm/'
  delete require.cache[path.resolve('/app/js/maxsql-migration.js')]
  Module._load = function (req, parent, ...rest) {
    if (req === 'axios') return makeStubAxios()
    return origLoad.call(this, req, parent, ...rest)
  }
  const m = require('/app/js/maxsql-migration')
  Module._load = origLoad

  const db = makeFakeDb({
    cpanelDocs: [
      { _id: 'a1', cpUser: 'a1', domain: 'a.com', plan: 'Premium Anti-Red HostPanel (1-Month)' },
      { _id: 'a2', cpUser: 'a2', domain: 'b.com', plan: 'Premium Anti-Red HostPanel (1-Month)' },
    ],
  })
  let acctCount = 0
  stubResponder = ({ url }) => {
    if (url === '/modifypkg') return { status: 200, data: { metadata: { result: 1 } } }
    if (url === '/modifyacct') {
      acctCount++
      // First account OK, second returns 403 → migration must abort & defer
      if (acctCount === 1) return { status: 200, data: { metadata: { result: 1 } } }
      return { status: 403, data: { errors: ['CF Access denied'] } }
    }
    throw new Error('unexpected')
  }
  await m.runMaxsqlMigration(() => db)
  assert.strictEqual(db._updates.length, 0, 'must NOT set marker when any modifyacct returns 403')
  console.log('  PASS: defers (no marker) when modifyacct returns 403 mid-loop')
}

async function main() {
  console.log('━━━ MAXSQL migration unit tests ━━━')
  await test_skips_when_marker_exists()
  await test_skips_when_whm_env_missing()
  await test_happy_path()
  await test_defers_on_cf_access_403_modifypkg()
  await test_defers_on_cf_access_403_modifyacct()
  console.log('\n✅ ALL 5 TESTS PASS')
}
main().catch(e => { console.error('❌ TEST FAILURE:', e); process.exit(1) })
