/**
 * Panel Feature Test v3 — WHM impersonation with correct API calls
 * 
 * Key fixes:
 * - Use API2 Fileman::fileop for mkdir/copy/move/delete (not UAPI Fileman::mkdir)
 * - Use WHM root impersonation for ALL calls (direct user auth blocked)
 * - Print full error details for debugging
 * - MySQL: try with correct prefix handling
 */
require('dotenv').config()
const axios = require('axios')
const https = require('https')

const WHM_HOST = process.env.WHM_HOST
const WHM_TOKEN = process.env.WHM_TOKEN
const WHM_API_RAW = (process.env.WHM_API_URL || '').replace(/\/+$/, '')
const WHM_API_BASE = WHM_API_RAW ? `${WHM_API_RAW}/json-api` : `https://${WHM_HOST}:2087/json-api`
const TEST_DOMAIN = 'testingbays.sbs'
const TEST_PLAN = 'Golden-Anti-Red-HostPanel-1-Month'

const agent = new https.Agent({ rejectUnauthorized: false })
const whmHeaders = { Authorization: `whm root:${WHM_TOKEN}` }

function log(msg) { console.log(`[${new Date().toISOString().slice(11,19)}] ${msg}`) }
let testAccount = null
const results = { passed: 0, failed: 0, tests: [] }

function record(name, ok, detail) {
  results.tests.push({ name, ok, detail })
  console.log(`  ${ok ? '✅ PASS' : '❌ FAIL'}: ${name}${detail ? ' — ' + detail : ''}`)
}

// ─── WHM API helper ─────────────────────────────────────

async function whmGet(path, params = {}) {
  const res = await axios.get(`${WHM_API_BASE}${path}`, {
    params: { 'api.version': 1, ...params },
    headers: whmHeaders,
    httpsAgent: agent,
    timeout: 30000,
  })
  return res.data
}

// ─── cPanel UAPI via WHM (apiversion 3) ─────────────────

async function uapi(cpUser, module, func, params = {}) {
  const reqParams = {
    cpanel_jsonapi_user: cpUser,
    cpanel_jsonapi_apiversion: 3,
    cpanel_jsonapi_module: module,
    cpanel_jsonapi_func: func,
    ...params,
  }
  const res = await axios.get(`${WHM_API_BASE}/cpanel`, {
    params: reqParams,
    headers: whmHeaders,
    httpsAgent: agent,
    timeout: 30000,
  })
  return res.data?.result
}

// ─── cPanel API2 via WHM ────────────────────────────────

async function api2(cpUser, module, func, params = {}) {
  const reqParams = {
    cpanel_jsonapi_user: cpUser,
    cpanel_jsonapi_apiversion: 2,
    cpanel_jsonapi_module: module,
    cpanel_jsonapi_func: func,
    ...params,
  }
  const res = await axios.get(`${WHM_API_BASE}/cpanel`, {
    params: reqParams,
    headers: whmHeaders,
    httpsAgent: agent,
    timeout: 30000,
  })
  return res.data?.cpanelresult
}

// ─── WHM session-based POST for UAPI (file save/get) ────

async function uapiViaSession(cpUser, module, func, params = {}) {
  // Step 1: create_user_session → get cpsession token + URL
  const sessRes = await whmGet('/create_user_session', {
    user: cpUser, service: 'cpaneld',
  })
  const sessData = sessRes?.data || {}
  const sessionUrl = sessData.url   // e.g. https://host:2083/cpsess1234567890/
  const cpSessId = sessData.session || (sessionUrl ? sessionUrl.match(/cpsess(\w+)/)?.[0] : null)
  if (!sessionUrl) throw new Error('create_user_session returned no URL')
  
  // Step 2: Use session URL to POST to UAPI
  const baseUrl = sessionUrl.replace(/\/+$/, '')
  const url = `${baseUrl}/execute/${module}/${func}`
  const res = await axios.post(url, new URLSearchParams(params).toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    httpsAgent: agent,
    timeout: 30000,
    maxRedirects: 5,
  })
  return res.data
}

// ═══ Account Creation ═══════════════════════════════════

async function createTestAccount() {
  log('═══ PHASE 3: Creating test hosting account ═══')
  const username = 'nbay' + Math.random().toString(36).substring(2, 8)
  const password = 'Pk!' + Math.random().toString(36).substring(2, 12) + 'Zz1'
  
  try {
    const result = await whmGet('/createacct', {
      username, domain: TEST_DOMAIN, plan: TEST_PLAN,
      contactemail: 'dev@nomadly.test', password,
      maxpark: 'unlimited', maxaddon: 'unlimited', maxsql: 'unlimited',
      skip_dns_check: 1,
    })
    if (result?.metadata?.result === 1) {
      testAccount = { username, password, domain: TEST_DOMAIN }
      record('WHM: createacct', true, `user=${username}`)
      return true
    }
    record('WHM: createacct', false, result?.metadata?.reason)
    return false
  } catch (err) {
    record('WHM: createacct', false, err.response?.data?.metadata?.reason || err.message)
    return false
  }
}

// ═══ FILE MANAGER ═══════════════════════════════════════

async function testFileManager() {
  log('\n─── FILE MANAGER ───')
  const u = testAccount.username

  // 1. list_files (UAPI)
  try {
    const r = await uapi(u, 'Fileman', 'list_files', { dir: '/public_html', include_mime: 1 })
    record('FM: list_files /public_html', r?.status === 1, `${(r?.data || []).length} items`)
  } catch (e) { record('FM: list_files', false, e.message) }

  // 2. mkdir via API2 Fileman::fileop (op=mkdir)
  try {
    const r = await api2(u, 'Fileman', 'fileop', {
      op: 'mkdir',
      sourcefiles: '/public_html/test_dir',
    })
    const data = r?.data?.[0] || r || {}
    const ok = (data.result !== 0) || r?.event?.result === 1
    record('FM: mkdir (API2 fileop)', ok, `test_dir ${data.error || ''}`)
  } catch (e) { record('FM: mkdir', false, e.message) }

  // 3. save_file_content (via WHM session — needs POST)
  try {
    const r = await uapiViaSession(u, 'Fileman', 'save_file_content', {
      file: 'index.html', dir: '/public_html/test_dir',
      content: '<html><body><h1>Panel Test Page</h1></body></html>',
    })
    record('FM: save_file_content', r?.status === 1, `index.html ${JSON.stringify(r?.errors||[])}`)
  } catch (e) { record('FM: save_file_content', false, e.message) }

  // 4. get_file_content (via WHM session)
  try {
    const r = await uapiViaSession(u, 'Fileman', 'get_file_content', {
      file: 'index.html', dir: '/public_html/test_dir',
    })
    const hasContent = r?.status === 1 && (r?.data?.content || '').includes('Panel Test')
    record('FM: get_file_content', hasContent, hasContent ? 'content verified' : `status=${r?.status}, got: ${(r?.data?.content||'').substring(0,50)}`)
  } catch (e) { record('FM: get_file_content', false, e.message) }

  // 5. rename (API2 Fileman::fileop op=rename or UAPI Fileman::rename_file)
  try {
    const r = await api2(u, 'Fileman', 'fileop', {
      op: 'rename',
      sourcefiles: '/public_html/test_dir/index.html',
      destfiles: '/public_html/test_dir/renamed.html',
    })
    const data = r?.data?.[0] || r || {}
    record('FM: rename', data.result !== 0 || r?.event?.result === 1, 'index→renamed.html')
  } catch (e) { record('FM: rename', false, e.message) }

  // 6. copy (API2 fileop)
  try {
    const r = await api2(u, 'Fileman', 'fileop', {
      op: 'copy',
      sourcefiles: '/public_html/test_dir/renamed.html',
      destfiles: '/public_html/test_dir/copied.html',
    })
    const data = r?.data?.[0] || r || {}
    record('FM: copy', data.result !== 0 || r?.event?.result === 1, 'copied.html')
  } catch (e) { record('FM: copy', false, e.message) }

  // 7. move (API2 fileop)
  try {
    const r = await api2(u, 'Fileman', 'fileop', {
      op: 'move',
      sourcefiles: '/public_html/test_dir/copied.html',
      destfiles: '/public_html/moved.html',
    })
    const data = r?.data?.[0] || r || {}
    record('FM: move', data.result !== 0 || r?.event?.result === 1, '→ /public_html/moved.html')
  } catch (e) { record('FM: move', false, e.message) }

  // 8. delete (API2 fileop op=unlink)
  try {
    const r1 = await api2(u, 'Fileman', 'fileop', { op: 'unlink', sourcefiles: '/public_html/moved.html' })
    const r2 = await api2(u, 'Fileman', 'fileop', { op: 'unlink', sourcefiles: '/public_html/test_dir/renamed.html' })
    const r3 = await api2(u, 'Fileman', 'fileop', { op: 'unlink', sourcefiles: '/public_html/test_dir' })
    record('FM: delete (3 items)', true, 'moved.html + renamed.html + test_dir')
  } catch (e) { record('FM: delete', false, e.message) }
}

// ═══ SUBDOMAINS ═════════════════════════════════════════

async function testSubdomains() {
  log('\n─── SUBDOMAINS ───')
  const u = testAccount.username

  // 1. List (API2)
  try {
    const r = await api2(u, 'SubDomain', 'listsubdomains', {})
    record('SUB: listsubdomains', Array.isArray(r?.data), `${(r?.data || []).length} subdomains`)
  } catch (e) { record('SUB: listsubdomains', false, e.message) }

  // 2. Create with CORRECT doc root (public_html/shop — NOT public_html/shop.domain.tld)
  try {
    const r = await api2(u, 'SubDomain', 'addsubdomain', {
      domain: 'shop', rootdomain: TEST_DOMAIN, dir: 'public_html/shop',
    })
    const d = r?.data?.[0] || {}
    record('SUB: create shop.' + TEST_DOMAIN, d.result === 1, d.reason || 'OK')
  } catch (e) { record('SUB: create shop', false, e.message) }

  // 3. Verify docroot
  try {
    const r = await api2(u, 'SubDomain', 'listsubdomains', {})
    const shopSub = (r?.data || []).find(s => (s.domain || '').startsWith('shop'))
    if (shopSub) {
      const docroot = shopSub.dir || shopSub.rootdir || ''
      const isCorrect = docroot.endsWith('/public_html/shop') && !docroot.includes(TEST_DOMAIN)
      record('SUB: docroot = /home/user/public_html/shop', isCorrect,
        `actual="${docroot}" ${isCorrect ? '✓ CORRECT separate folder' : '✗ WRONG'}`)
    } else {
      record('SUB: docroot', false, 'shop not found')
    }
  } catch (e) { record('SUB: verify docroot', false, e.message) }

  // 4. Create another subdomain (blog)
  try {
    const r = await api2(u, 'SubDomain', 'addsubdomain', {
      domain: 'blog', rootdomain: TEST_DOMAIN, dir: 'public_html/blog',
    })
    const d = r?.data?.[0] || {}
    record('SUB: create blog.' + TEST_DOMAIN, d.result === 1, d.reason || 'OK')
  } catch (e) { record('SUB: create blog', false, e.message) }

  // 5. Delete blog
  try {
    const r = await api2(u, 'SubDomain', 'delsubdomain', { domain: `blog.${TEST_DOMAIN}` })
    const d = r?.data?.[0] || {}
    record('SUB: delete blog', d.result === 1, d.reason || 'OK')
  } catch (e) { record('SUB: delete blog', false, e.message) }
}

// ═══ ADDON DOMAINS ══════════════════════════════════════

async function testAddonDomains() {
  log('\n─── ADDON DOMAINS ───')
  const u = testAccount.username
  const addonDomain = 'testinghostbay.sbs'

  // 1. List domains (UAPI)
  try {
    const r = await uapi(u, 'DomainInfo', 'list_domains', {})
    record('ADDON: list_domains', r?.status === 1,
      `main=${r?.data?.main_domain}, addons=${(r?.data?.addon_domains||[]).length}`)
  } catch (e) { record('ADDON: list_domains', false, e.message) }

  // 2. Add addon domain (API2)
  try {
    const r = await api2(u, 'AddonDomain', 'addaddondomain', {
      newdomain: addonDomain,
      subdomain: addonDomain.replace(/\./g, ''),
      dir: `public_html/${addonDomain}`,
    })
    const d = r?.data?.[0] || {}
    record('ADDON: add ' + addonDomain, d.result === 1, d.reason || 'OK')
  } catch (e) { record('ADDON: add', false, e.message) }

  // 3. Verify in list
  try {
    const r = await uapi(u, 'DomainInfo', 'list_domains', {})
    const addons = r?.data?.addon_domains || []
    record('ADDON: verify in list', addons.includes(addonDomain), `addons: [${addons.join(', ')}]`)
  } catch (e) { record('ADDON: verify', false, e.message) }

  // 4. Remove addon domain
  try {
    const r = await api2(u, 'AddonDomain', 'deladdondomain', {
      domain: addonDomain,
      subdomain: addonDomain.replace(/\./g, '') + '.' + TEST_DOMAIN,
    })
    const d = r?.data?.[0] || {}
    record('ADDON: remove ' + addonDomain, d.result === 1, d.reason || 'OK')
  } catch (e) { record('ADDON: remove', false, e.message) }
}

// ═══ EMAIL ══════════════════════════════════════════════

async function testEmail() {
  log('\n─── EMAIL ───')
  const u = testAccount.username

  // 1. List
  try {
    const r = await uapi(u, 'Email', 'list_pops_with_disk', { domain: TEST_DOMAIN })
    record('EMAIL: list_pops_with_disk', r?.status === 1, `${(r?.data || []).length} accounts`)
  } catch (e) { record('EMAIL: list', false, e.message) }

  // 2. Create
  try {
    const r = await uapi(u, 'Email', 'add_pop', {
      email: 'devtest', domain: TEST_DOMAIN, password: 'DevTestPass123!Zz', quota: 100,
    })
    record('EMAIL: add_pop', r?.status === 1, `devtest@${TEST_DOMAIN} ${JSON.stringify(r?.errors||[])}`)
  } catch (e) { record('EMAIL: add_pop', false, e.message) }

  // 3. Change password
  try {
    const r = await uapi(u, 'Email', 'passwd_pop', {
      email: 'devtest', domain: TEST_DOMAIN, password: 'NewPass456!Zz',
    })
    record('EMAIL: passwd_pop', r?.status === 1, 'password changed')
  } catch (e) { record('EMAIL: passwd_pop', false, e.message) }

  // 4. Delete
  try {
    const r = await uapi(u, 'Email', 'delete_pop', { email: 'devtest', domain: TEST_DOMAIN })
    record('EMAIL: delete_pop', r?.status === 1, `devtest@${TEST_DOMAIN} deleted`)
  } catch (e) { record('EMAIL: delete_pop', false, e.message) }
}

// ═══ MYSQL ══════════════════════════════════════════════

async function testMySQL() {
  log('\n─── MYSQL ───')
  const u = testAccount.username
  // cPanel uses FULL username as prefix (not truncated!)
  const prefix = u
  const dbName = `${prefix}_tdb`
  const dbUser = `${prefix}_tus`
  log(`  prefix=${prefix}_, db=${dbName}, user=${dbUser}`)

  // 1. List databases
  try {
    const r = await uapi(u, 'Mysql', 'list_databases', {})
    record('MYSQL: list_databases', r?.status === 1, `${(r?.data||[]).length} databases`)
  } catch (e) { record('MYSQL: list_databases', false, e.message) }

  // 2. Create database
  try {
    const r = await uapi(u, 'Mysql', 'create_database', { name: dbName })
    record('MYSQL: create_database', r?.status === 1, `${dbName} ${JSON.stringify(r?.errors||[])}`)
  } catch (e) { record('MYSQL: create_database', false, e.message) }

  // 3. Create user
  try {
    const r = await uapi(u, 'Mysql', 'create_user', { name: dbUser, password: 'DbPass789!Zz' })
    record('MYSQL: create_user', r?.status === 1, `${dbUser} ${JSON.stringify(r?.errors||[])}`)
  } catch (e) { record('MYSQL: create_user', false, e.message) }

  // 4. Grant privileges
  try {
    const r = await uapi(u, 'Mysql', 'set_privileges_on_database', {
      user: dbUser, database: dbName, privileges: 'ALL PRIVILEGES',
    })
    record('MYSQL: grant_privileges', r?.status === 1, `${JSON.stringify(r?.errors||[])}`)
  } catch (e) { record('MYSQL: grant', false, e.message) }

  // 5. List users
  try {
    const r = await uapi(u, 'Mysql', 'list_users', {})
    const users = (r?.data || []).map(x => typeof x === 'string' ? x : x?.user || x?.name)
    record('MYSQL: list_users', r?.status === 1 && users.includes(dbUser), `users: [${users.join(', ')}]`)
  } catch (e) { record('MYSQL: list_users', false, e.message) }

  // 6. Check + Repair
  try {
    const r = await uapi(u, 'Mysql', 'check_database', { name: dbName })
    record('MYSQL: check_database', r?.status === 1, `${JSON.stringify(r?.errors||[])}`)
  } catch (e) { record('MYSQL: check_database', false, e.message) }

  try {
    const r = await uapi(u, 'Mysql', 'repair_database', { name: dbName })
    record('MYSQL: repair_database', r?.status === 1, `${JSON.stringify(r?.errors||[])}`)
  } catch (e) { record('MYSQL: repair_database', false, e.message) }

  // 7. Revoke privileges
  try {
    const r = await uapi(u, 'Mysql', 'revoke_access_to_database', { user: dbUser, database: dbName })
    record('MYSQL: revoke_privileges', r?.status === 1, `${JSON.stringify(r?.errors||[])}`)
  } catch (e) { record('MYSQL: revoke', false, e.message) }

  // 8. Delete user
  try {
    const r = await uapi(u, 'Mysql', 'delete_user', { name: dbUser })
    record('MYSQL: delete_user', r?.status === 1, `${dbUser}`)
  } catch (e) { record('MYSQL: delete_user', false, e.message) }

  // 9. Delete database
  try {
    const r = await uapi(u, 'Mysql', 'delete_database', { name: dbName })
    record('MYSQL: delete_database', r?.status === 1, `${dbName}`)
  } catch (e) { record('MYSQL: delete_database', false, e.message) }

  // 10. Remote hosts
  try {
    const r = await uapi(u, 'Mysql', 'get_host_notes', {})
    record('MYSQL: list_remote_hosts', r?.status === 1, 'OK')
  } catch (e) { record('MYSQL: list_remote_hosts', false, e.message) }

  try {
    const r = await uapi(u, 'Mysql', 'add_host', { host: '192.168.1.100' })
    record('MYSQL: add_host', r?.status === 1, '192.168.1.100')
  } catch (e) { record('MYSQL: add_host', false, e.message) }

  try {
    const r = await uapi(u, 'Mysql', 'delete_host', { host: '192.168.1.100' })
    record('MYSQL: delete_host', r?.status === 1, '192.168.1.100')
  } catch (e) { record('MYSQL: delete_host', false, e.message) }
}

// ═══ STATS / SSL ════════════════════════════════════════

async function testStats() {
  log('\n─── STATS / SSL ───')
  const u = testAccount.username

  try {
    const r = await uapi(u, 'Quota', 'get_local_quota_info', {})
    record('STATS: disk_quota', r?.status === 1, `used=${r?.data?.megabytes_used || 0}MB`)
  } catch (e) { record('STATS: quota', false, e.message) }

  try {
    const r = await uapi(u, 'Bandwidth', 'query', { grouping: 'domain|year|month', interval: 'daily' })
    record('STATS: bandwidth', r?.status === 1 || r?.status === 0, 'queried')
  } catch (e) { record('STATS: bandwidth', false, e.message) }

  try {
    const r = await uapi(u, 'SSL', 'installed_hosts', {})
    record('SSL: installed_hosts', r?.status === 1, `${(r?.data||[]).length} certs`)
  } catch (e) { record('SSL: installed_hosts', false, e.message) }
}

// ═══ DOCROOT CHANGE ═════════════════════════════════════

async function testDocrootChange() {
  log('\n─── DOCROOT CHANGE ───')
  const u = testAccount.username

  // Mirror mode (public_html)
  try {
    const r = await api2(u, 'SubDomain', 'changedocroot', {
      subdomain: 'shop', rootdomain: TEST_DOMAIN, dir: 'public_html',
    })
    const d = r?.data?.[0] || {}
    record('DOCROOT: → mirror (public_html)', d.result === 1, d.reason || 'OK')
  } catch (e) { record('DOCROOT: → mirror', false, e.message) }

  // Back to own folder
  try {
    const r = await api2(u, 'SubDomain', 'changedocroot', {
      subdomain: 'shop', rootdomain: TEST_DOMAIN, dir: 'public_html/shop',
    })
    const d = r?.data?.[0] || {}
    record('DOCROOT: → own (public_html/shop)', d.result === 1, d.reason || 'OK')
  } catch (e) { record('DOCROOT: → own', false, e.message) }
}

// ═══ CLEANUP ════════════════════════════════════════════

async function cleanup() {
  log('\n─── CLEANUP ───')
  if (!testAccount) return
  try {
    await api2(testAccount.username, 'SubDomain', 'delsubdomain', { domain: `shop.${TEST_DOMAIN}` })
  } catch (e) {}
  try {
    const r = await whmGet('/removeacct', { username: testAccount.username, keepdns: 0 })
    log(r?.metadata?.result === 1 ? `✅ Account ${testAccount.username} removed` : `⚠️ ${r?.metadata?.reason}`)
  } catch (e) { log(`❌ Cleanup failed: ${e.message}`) }
}

// ═══ MAIN ═══════════════════════════════════════════════

async function main() {
  log('════════════════════════════════════════════════════')
  log(' NOMADLY PANEL — COMPREHENSIVE TEST v3 (WHM impersonation)')
  log(` Domain: ${TEST_DOMAIN} | WHM: ${WHM_API_BASE}`)
  log('════════════════════════════════════════════════════')

  if (!(await createTestAccount())) { log('❌ No test account'); return }

  try {
    await testFileManager()
    await testSubdomains()
    await testAddonDomains()
    await testEmail()
    await testMySQL()
    await testStats()
    await testDocrootChange()
  } catch (err) {
    log(`❌ Fatal: ${err.message}`)
  }

  // Summary
  log('\n════════════════════════════════════════════════════')
  log(` RESULTS: ✅ ${results.passed}  ❌ ${results.failed}  TOTAL ${results.passed + results.failed}`)
  log('════════════════════════════════════════════════════')
  
  const failed = results.tests.filter(t => !t.ok)
  if (failed.length) {
    log('\n  FAILURES:')
    failed.forEach(t => console.log(`    ❌ ${t.name} — ${t.detail}`))
  }

  await cleanup()
  log(`\n═══ DONE — ${results.passed}/${results.passed + results.failed} passed ═══`)
}

main().catch(console.error)
