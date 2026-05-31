// Smoke-test for the cPanel MySQL manager (Issue 6 from Railway log analysis).
//
// Verifies:
//   1) cpanel-proxy exposes all 13 MySQL helper functions (listDatabases,
//      createDatabase, createDatabaseUser, setUserPrivilegesOnDatabase, etc).
//   2) cpanel-routes.js mounts all 14 /mysql/* HTTP routes under the
//      Gold-plan gate (mysqlAuth = [...auth, requireGold]).
//   3) Each helper is async, takes (cpUser, cpPass, ...args) and would
//      route to the correct UAPI module/function (without actually hitting
//      cPanel).
//
// Run with:  node tests/test_mysql_manager_smoke.js

'use strict'

const fs = require('fs')
const path = require('path')

let passed = 0
let failed = 0
const assert = (cond, name) => {
  if (cond) { console.log(`  ✅ ${name}`); passed++ }
  else { console.log(`  ❌ ${name}`); failed++ }
}

// ── 1. cpanel-proxy MySQL helpers ────────────────────────────────────────
console.log('\nTest A: cpanel-proxy exports all MySQL helpers')
// Stub axios so importing cpanel-proxy doesn't try to call WHM
const axiosPath = require.resolve('axios')
const captured = { calls: [] }
require.cache[axiosPath] = {
  id: axiosPath, filename: axiosPath, loaded: true,
  exports: {
    create: () => ({}),
    get: async (url, opts) => {
      captured.calls.push({ method: 'GET', url, params: opts && opts.params })
      return { data: { status: 1, data: [] } }
    },
    post: async (url, body, opts) => {
      captured.calls.push({ method: 'POST', url, body, params: opts && opts.params })
      return { data: { status: 1, data: [] } }
    },
    request: async (cfg) => {
      captured.calls.push({ method: cfg.method, url: cfg.url, params: cfg.params, data: cfg.data })
      return { data: { status: 1, data: [] } }
    },
  },
}

const proxy = require('../js/cpanel-proxy')
const expectedFns = [
  'listDatabases', 'listDatabaseUsers', 'createDatabase', 'deleteDatabase',
  'renameDatabase', 'checkDatabase', 'repairDatabase',
  'createDatabaseUser', 'deleteDatabaseUser', 'setDatabaseUserPassword',
  'renameDatabaseUser', 'setUserPrivilegesOnDatabase',
  'revokeUserPrivilegesOnDatabase',
  'listMysqlRemoteHosts', 'addMysqlRemoteHost', 'deleteMysqlRemoteHost',
]
for (const fn of expectedFns) {
  assert(typeof proxy[fn] === 'function', `A.${fn} exported as function`)
}

// ── 2. cpanel-routes mounts /mysql/* routes ─────────────────────────────
console.log('\nTest B: cpanel-routes mounts /mysql/* routes (Gold-only)')
const routesSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'cpanel-routes.js'), 'utf8')

const expectedRoutes = [
  "router.get('/mysql/databases'",
  "router.post('/mysql/databases/create'",
  "router.post('/mysql/databases/delete'",
  "router.post('/mysql/databases/rename'",
  "router.post('/mysql/databases/repair'",
  "router.post('/mysql/databases/check'",
  "router.get('/mysql/users'",
  "router.post('/mysql/users/create'",
  "router.post('/mysql/users/delete'",
  "router.post('/mysql/users/password'",
  "router.post('/mysql/users/rename'",
  "router.post('/mysql/privileges/grant'",
  "router.post('/mysql/privileges/revoke'",
  "router.get('/mysql/remote-hosts'",
  "router.post('/mysql/remote-hosts/add'",
  "router.post('/mysql/remote-hosts/delete'",
  "router.get('/mysql/phpmyadmin'",
]
for (const r of expectedRoutes) {
  assert(routesSrc.indexOf(r) >= 0, `B route ${r.match(/\/mysql\/[^']+/)[0]} mounted`)
}
assert(routesSrc.indexOf('const mysqlAuth = [...auth, requireGold]') >= 0,
  'B mysqlAuth gate includes requireGold (Gold plan only)')

// ── 3. Helper signatures route to correct UAPI module ───────────────────
console.log('\nTest C: helpers call UAPI Mysql module with correct function names')
captured.calls = []
;(async () => {
  await proxy.listDatabases('cpuser', 'pin')
  await proxy.createDatabase('cpuser', 'pin', 'mydb')
  await proxy.setUserPrivilegesOnDatabase('cpuser', 'pin', 'u', 'd', ['SELECT', 'INSERT'])
  await proxy.addMysqlRemoteHost('cpuser', 'pin', '1.2.3.4')

  // uapi() encodes the UAPI module/func in the URL path: `${baseUrl}/execute/${module}/${func}`
  const parsed = captured.calls.map((c) => {
    const m = String(c.url || '').match(/\/execute\/([^/]+)\/([^/?]+)/)
    return { module: m && m[1], func: m && m[2], call: c }
  })
  const modules = parsed.map((p) => p.module)
  const fns = parsed.map((p) => p.func)

  assert(modules.every((m) => m === 'Mysql'),
    `C all 4 helper calls route to UAPI module=Mysql (got: ${[...new Set(modules)].join(',')})`)
  assert(fns.includes('list_databases'), 'C list_databases called')
  assert(fns.includes('create_database'), 'C create_database called')
  assert(fns.includes('set_privileges_on_database'), 'C set_privileges_on_database called')
  assert(fns.includes('add_host'), 'C add_host called')

  // For POST calls, params object is the request BODY (axios.post(url, params, ...))
  const privCall = parsed.find((p) => p.func === 'set_privileges_on_database')
  const privValue = privCall && privCall.call.body && privCall.call.body.privileges
  assert(privValue === 'SELECT,INSERT',
    `C privileges joined with comma (got: ${privValue})`)

  console.log(`\nResults: ${passed} passed, ${failed} failed`)
  process.exit(failed === 0 ? 0 : 1)
})().catch((e) => { console.error('runner crash:', e); process.exit(2) })
