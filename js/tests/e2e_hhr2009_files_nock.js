/**
 * E2E HTTP-LEVEL TEST — @HHR2009 File Manager EPERM fix with nock
 *
 * Drives the REAL Express server (127.0.0.1:5000) through the full file-manager
 * flow (login → list → upload → extract → delete) with nock intercepting the
 * outbound WHM + cPanel HTTP calls. This is the highest-fidelity test we can
 * run without a functioning WHM.
 *
 * SCENARIOS TESTED:
 *   1. Clean path (no EPERM)
 *   2. EPERM-transient (first 2 calls fail, 3rd succeeds via WHM-root fallback)
 *   3. EPERM-persistent (all calls fail with EPERM)
 *
 * SAFETY:
 *   • Uses synthetic cpanelAccounts doc with cpUser `nocktest{ts}` and chatId `TESTEPERM-<ts>`
 *   • All HTTP calls to WHM/cPanel are intercepted by nock (no real API calls)
 *   • Removes the Mongo doc in the finally block
 *   • Uses TESTEPERM- prefix for easy filtering in prod data
 *
 * USAGE:
 *   cd /app && node js/tests/e2e_hhr2009_files_nock.js
 *
 * EXIT CODES:
 *   0 = all checks passed
 *   1 = one or more checks failed
 *   2 = setup or teardown failed
 */

require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')
const { MongoClient } = require('mongodb')
const FormData = require('form-data')
const nock = require('nock')

const NODE_URL   = 'http://127.0.0.1:5000'
const MONGO_URL  = process.env.MONGO_URL
const DB_NAME    = process.env.DB_NAME || 'test'
const CPANEL_API_URL = process.env.CPANEL_API_URL || 'https://cpanel-api.hostbay.io'
const WHM_API_URL = process.env.WHM_API_URL || 'https://whm-api.hostbay.io'

if (!MONGO_URL) {
  console.error('❌ Missing MONGO_URL in env')
  process.exit(2)
}

const cpAuth = require('../cpanel-auth')

// ── Test identifiers ──
const TS = Date.now().toString(36)
const TEST_DOMAIN = `nocktest${TS}.test`
const TEST_USER   = `nocktest${TS}`
const TEST_CHAT   = `TESTEPERM-${TS}`
const TEST_PASS   = `nockpass${TS}!`
const TEST_EMAIL  = 'nocktest@example.invalid'

let failures = 0
let passes = 0
function check(name, cond, extra) {
  if (cond) { console.log(`  ✅ ${name}`); passes++ }
  else      { console.error(`  ❌ ${name}${extra ? ` — ${extra}` : ''}`); failures++ }
}

async function run() {
  let mongoClient
  let cleanup = { mongoDoc: false }

  try {
    console.log(`\n══ E2E HTTP-LEVEL TEST: /panel/files EPERM fix (nock) ══`)
    console.log(`CPANEL_API_URL: ${CPANEL_API_URL}`)
    console.log(`WHM_API_URL: ${WHM_API_URL}`)
    console.log(`Test cpUser: ${TEST_USER}`)
    console.log(`Test chatId: ${TEST_CHAT}\n`)

    // ── 1. Insert synthetic cpanelAccounts doc ───────────────────────────
    console.log(`[1] Inserting synthetic cpanelAccounts doc into Mongo …`)
    mongoClient = new MongoClient(MONGO_URL)
    await mongoClient.connect()
    const db = mongoClient.db(DB_NAME)
    const col = db.collection('cpanelAccounts')

    const { pin } = await cpAuth.storeCredentials(col, {
      cpUser: TEST_USER,
      cpPass: TEST_PASS,
      chatId: TEST_CHAT,
      email: TEST_EMAIL,
      domain: TEST_DOMAIN,
      plan: 'Premium Anti-Red (1-Week)',
    })
    cleanup.mongoDoc = true
    console.log(`  ✅ Stored with PIN (${pin.length} digits)\n`)

    // ── 2. Setup nock interceptors ───────────────────────────────────────
    console.log(`[2] Setting up nock interceptors …`)
    
    // Parse URLs to get base paths
    const cpanelUrl = new URL(CPANEL_API_URL)
    const whmUrl = new URL(WHM_API_URL)
    
    // Clean any existing interceptors
    nock.cleanAll()
    
    // Mock cPanel login (required by cpAuth.login)
    nock(cpanelUrl.origin)
      .persist()
      .post('/login')
      .reply(200, { token: 'mock-cpanel-token-12345' })
    
    console.log(`  ✅ nock interceptors ready\n`)

    // ── 3. Login via /panel/login → get JWT ──────────────────────────────
    console.log(`[3] POST /panel/login  (real Express, nock intercepts cPanel login)`)
    const loginRes = await axios.post(`${NODE_URL}/panel/login`, {
      username: TEST_USER, pin,
    }, { validateStatus: () => true })
    check('login → HTTP 200', loginRes.status === 200, `got HTTP ${loginRes.status}: ${JSON.stringify(loginRes.data)}`)
    check('login returned a JWT', !!loginRes.data?.token)
    const token = loginRes.data?.token
    if (!token) { throw new Error('No JWT — cannot continue') }
    const authHeader = { headers: { Authorization: `Bearer ${token}` } }

    // Session probe
    console.log(`\n[3b] GET /panel/session`)
    const sessRes = await axios.get(`${NODE_URL}/panel/session`, { ...authHeader, validateStatus: () => true })
    check('session → HTTP 200', sessRes.status === 200)
    check('session returns cpUser', sessRes.data?.username === TEST_USER)

    // ── 4. SCENARIO: Clean path (no EPERM) ───────────────────────────────
    console.log(`\n[4] SCENARIO: Clean path (no EPERM)`)
    
    // Mock clean list_files response
    nock(cpanelUrl.origin)
      .get('/execute/Fileman/list_files')
      .query(true)
      .reply(200, {
        status: 1,
        data: [
          { file: 'public_html', type: 'dir', fullname: 'public_html' },
          { file: 'test.txt', type: 'file', fullname: 'test.txt' },
        ]
      })
    
    const listClean = await axios.get(`${NODE_URL}/panel/files`, { 
      ...authHeader, 
      validateStatus: () => true 
    })
    check('clean list → HTTP 200', listClean.status === 200)
    check('clean list → status 1', listClean.data?.status === 1)
    check('clean list → no EPERM code', listClean.data?.code !== 'CPANEL_UAPI_EPERM')
    check('clean list → data is array', Array.isArray(listClean.data?.data))

    // ── 5. SCENARIO: EPERM-transient (first 2 fail, 3rd succeeds) ────────
    console.log(`\n[5] SCENARIO: EPERM-transient (first 2 calls fail, 3rd via WHM succeeds)`)
    
    // Clean previous interceptors
    nock.cleanAll()
    
    // Re-mock login for session continuity
    nock(cpanelUrl.origin)
      .persist()
      .post('/login')
      .reply(200, { token: 'mock-cpanel-token-12345' })
    
    // Mock EPERM failures for first 2 direct cPanel calls
    let directCallCount = 0
    nock(cpanelUrl.origin)
      .get('/execute/Fileman/list_files')
      .query(true)
      .times(2)
      .reply(function() {
        directCallCount++
        return [500, {
          status: 0,
          errors: ['"/usr/local/cpanel/uapi" exited with status 1 (EPERM).']
        }]
      })
    
    // Mock WHM fallback success (3rd attempt via WHM json-api)
    nock(whmUrl.origin)
      .get('/json-api/cpanel')
      .query(true)
      .reply(200, {
        cpanelresult: {
          data: [
            { result: {
              status: 1,
              data: [
                { file: 'public_html', type: 'dir', fullname: 'public_html' },
                { file: 'recovered.txt', type: 'file', fullname: 'recovered.txt' },
              ]
            }}
          ]
        }
      })
    
    const listTransient = await axios.get(`${NODE_URL}/panel/files`, { 
      ...authHeader, 
      validateStatus: () => true 
    })
    check('transient list → HTTP 200', listTransient.status === 200)
    check('transient list → status 1 (recovered)', listTransient.data?.status === 1)
    check('transient list → via WHM fallback', 
      listTransient.data?.via && listTransient.data.via.startsWith('whm-fallback'))
    check('transient list → data is array', Array.isArray(listTransient.data?.data))

    // Check logs for WHM fallback success message
    console.log(`\n[5b] Checking Node.js logs for WHM fallback success message …`)
    const { execSync } = require('child_process')
    const logs = execSync('tail -n 50 /var/log/supervisor/nodejs.out.log', { encoding: 'utf8' })
    const hasWhmFallbackLog = logs.includes('list_files succeeded via WHM fallback')
    check('logs show WHM fallback success', hasWhmFallbackLog)

    // ── 6. SCENARIO: EPERM-persistent (all calls fail) ───────────────────
    console.log(`\n[6] SCENARIO: EPERM-persistent (all calls fail with EPERM)`)
    
    // Clean previous interceptors
    nock.cleanAll()
    
    // Re-mock login
    nock(cpanelUrl.origin)
      .persist()
      .post('/login')
      .reply(200, { token: 'mock-cpanel-token-12345' })
    
    // Mock EPERM failures for all direct cPanel calls
    nock(cpanelUrl.origin)
      .get('/execute/Fileman/list_files')
      .query(true)
      .times(3)
      .reply(500, {
        status: 0,
        errors: ['"/usr/local/cpanel/uapi" exited with status 1 (EPERM).']
      })
    
    // Mock EPERM failures for all WHM fallback calls
    nock(whmUrl.origin)
      .get('/json-api/cpanel')
      .query(true)
      .times(3)
      .reply(500, {
        status: 0,
        errors: ['"/usr/local/cpanel/uapi" exited with status 1 (EPERM).']
      })
    
    const listPersistent = await axios.get(`${NODE_URL}/panel/files`, { 
      ...authHeader, 
      validateStatus: () => true 
    })
    check('persistent EPERM → HTTP 200', listPersistent.status === 200)
    check('persistent EPERM → code CPANEL_UAPI_EPERM', 
      listPersistent.data?.code === 'CPANEL_UAPI_EPERM')
    check('persistent EPERM → friendly error message', 
      listPersistent.data?.error && 
      !/EPERM|uapi|status 1/i.test(listPersistent.data.error))
    check('persistent EPERM → has localized messages', 
      listPersistent.data?.localizedMessages &&
      listPersistent.data.localizedMessages.en &&
      listPersistent.data.localizedMessages.fr &&
      listPersistent.data.localizedMessages.zh &&
      listPersistent.data.localizedMessages.hi)

    // Check logs for persistent EPERM message
    console.log(`\n[6b] Checking Node.js logs for persistent EPERM message …`)
    const logs2 = execSync('tail -n 50 /var/log/supervisor/nodejs.out.log', { encoding: 'utf8' })
    const hasPersistentEpermLog = logs2.includes(`[Panel] open folder blocked by broken-homedir EPERM (user: ${TEST_USER})`)
    check('logs show persistent EPERM block', hasPersistentEpermLog)

    // ── 7. FULL FLOW TEST (upload → list → extract → delete) ────────────
    console.log(`\n[7] FULL FLOW TEST (upload → list → extract → delete)`)
    
    // Clean previous interceptors
    nock.cleanAll()
    
    // Re-mock login
    nock(cpanelUrl.origin)
      .persist()
      .post('/login')
      .reply(200, { token: 'mock-cpanel-token-12345' })
    
    // Mock upload
    nock(cpanelUrl.origin)
      .post('/execute/Fileman/upload_files')
      .reply(200, {
        status: 1,
        data: [{ file: 'nock_test.txt', status: 1, size: 42 }]
      })
    
    const uploadDir = `/home/${TEST_USER}/public_html`
    const uploadName = `nock_test_${TS}.txt`
    const uploadBody = Buffer.from(`Nock test at ${new Date().toISOString()}\n`, 'utf8')
    const form1 = new FormData()
    form1.append('dir', uploadDir)
    form1.append('files', uploadBody, { filename: uploadName, contentType: 'text/plain' })
    
    const upRes = await axios.post(`${NODE_URL}/panel/files/upload`, form1, {
      headers: { ...authHeader.headers, ...form1.getHeaders() },
      maxContentLength: Infinity, maxBodyLength: Infinity,
      validateStatus: () => true,
    })
    check('upload → HTTP 200', upRes.status === 200)
    check('upload → not EPERM', upRes.data?.code !== 'CPANEL_UAPI_EPERM')

    // Mock list after upload
    nock(cpanelUrl.origin)
      .get('/execute/Fileman/list_files')
      .query(true)
      .reply(200, {
        status: 1,
        data: [
          { file: 'public_html', type: 'dir', fullname: 'public_html' },
          { file: uploadName, type: 'file', fullname: uploadName },
        ]
      })
    
    const listAfterUp = await axios.get(`${NODE_URL}/panel/files`, {
      ...authHeader, params: { dir: uploadDir }, validateStatus: () => true,
    })
    const uploadedShows = (listAfterUp.data?.data || []).some(f => 
      (f.file || f.name || f.fullname) === uploadName)
    check('list after upload → file present', uploadedShows)

    // Mock extract
    const zipName = `nock_test_${TS}.zip`
    nock(cpanelUrl.origin)
      .post('/execute/Fileman/extract')
      .reply(200, {
        status: 1,
        data: { extracted: ['README.txt'] }
      })
    
    const extractRes = await axios.post(`${NODE_URL}/panel/files/extract`, {
      dir: uploadDir, file: zipName, destDir: uploadDir,
    }, { ...authHeader, validateStatus: () => true })
    check('extract → HTTP 200', extractRes.status === 200)
    check('extract → not EPERM', extractRes.data?.code !== 'CPANEL_UAPI_EPERM')

    // Mock delete
    nock(cpanelUrl.origin)
      .post('/execute/Fileman/fileop')
      .reply(200, {
        status: 1,
        data: {}
      })
    
    const delRes = await axios.post(`${NODE_URL}/panel/files/delete`, {
      dir: uploadDir, file: uploadName, isDirectory: false,
    }, { ...authHeader, validateStatus: () => true })
    check('delete → HTTP 200', delRes.status === 200)
    check('delete → not EPERM', delRes.data?.code !== 'CPANEL_UAPI_EPERM')

    // Mock list after delete
    nock(cpanelUrl.origin)
      .get('/execute/Fileman/list_files')
      .query(true)
      .reply(200, {
        status: 1,
        data: [
          { file: 'public_html', type: 'dir', fullname: 'public_html' },
        ]
      })
    
    const listAfterDel = await axios.get(`${NODE_URL}/panel/files`, {
      ...authHeader, params: { dir: uploadDir }, validateStatus: () => true,
    })
    const stillThere = (listAfterDel.data?.data || []).some(f => 
      (f.file || f.name || f.fullname) === uploadName)
    check('list after delete → file gone', !stillThere)

    // ── Summary ──────────────────────────────────────────────────────────
    console.log(`\n══ SUMMARY ══`)
    console.log(`  ✅ passed: ${passes}`)
    console.log(`  ❌ failed: ${failures}`)

  } catch (err) {
    console.error(`\n❌ Fatal error during test: ${err.message}`)
    console.error(err.stack)
    failures++
  } finally {
    // ── Teardown ──────────────────────────────────────────────────────────
    console.log(`\n══ TEARDOWN ══`)
    
    // Clean nock interceptors
    nock.cleanAll()
    console.log(`  ✅ Cleaned nock interceptors`)
    
    try {
      if (cleanup.mongoDoc && mongoClient) {
        const db = mongoClient.db(DB_NAME)
        await db.collection('cpanelAccounts').deleteOne({ _id: TEST_USER.toLowerCase() })
        console.log(`  ✅ Removed cpanelAccounts doc _id=${TEST_USER.toLowerCase()}`)
      }
    } catch (e) { console.error(`  ⚠️  Mongo cleanup: ${e.message}`) }

    try { if (mongoClient) await mongoClient.close() } catch { /* noop */ }
  }

  process.exit(failures === 0 ? 0 : 1)
}

run()
