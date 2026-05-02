/**
 * Regression test: cpanel-proxy retry behaviour for idempotent reads.
 *
 * Context: @ciroovblzz production report showed sporadic WHM/UAPI timeouts
 * (e.g. "Fileman::list_files error: timeout of 30000ms exceeded") causing the
 * panel to render a scary error screen right after login. The proxy now does a
 * single automatic retry for KNOWN-IDEMPOTENT reads (list_files, list_domains,
 * installed_hosts, etc.) so transient blips are self-healing and the user
 * never sees them.
 *
 * This is a black-box test: we monkey-patch axios to return a timeout on the
 * first call and a valid UAPI body on the second, then assert the uapi()
 * helper returned the success response (i.e. the retry fired).
 */

const path = require('path')
process.env.WHM_HOST = 'whm.test.local'

const Module = require('module')
const axios = require('axios')
const assert = require('assert')

let calls = []
const origGet = axios.get
const origPost = axios.post

function mockAxios({ failFirst = true, method = 'GET' } = {}) {
  calls = []
  const handler = async (url, arg2, arg3) => {
    calls.push({ url, method })
    if (failFirst && calls.length === 1) {
      const err = new Error('timeout of 30000ms exceeded')
      err.code = 'ECONNABORTED'
      throw err
    }
    return { data: { status: 1, data: [{ file: 'index.html', type: 'file' }], errors: [] } }
  }
  axios.get = handler
  axios.post = handler
}

function restoreAxios() {
  axios.get = origGet
  axios.post = origPost
}

// Fresh-require to pick up our mocked axios
delete require.cache[require.resolve(path.resolve(__dirname, '../cpanel-proxy.js'))]
const cpProxy = require(path.resolve(__dirname, '../cpanel-proxy.js'))

async function runTest(name, fn) {
  try {
    await fn()
    console.log(`✓ ${name}`)
  } catch (e) {
    console.error(`✗ ${name}\n   ${e.message}`)
    process.exit(1)
  }
}

;(async () => {
  // 1. Retry happens for idempotent read (Fileman::list_files)
  mockAxios({ failFirst: true })
  await runTest('list_files retries once on transient timeout', async () => {
    const res = await cpProxy.uapi('u', 'p', 'Fileman', 'list_files', { dir: '/home/u/public_html' })
    assert.strictEqual(calls.length, 2, `expected 2 calls (first fail + retry), got ${calls.length}`)
    assert.strictEqual(res.status, 1, 'should return success shape after retry')
    assert.ok(Array.isArray(res.data) && res.data.length === 1, 'should include list data')
  })

  // 2. No retry for write-like UAPI calls (not in safe list)
  mockAxios({ failFirst: true })
  await runTest('Email::add_pop does NOT retry (mutation)', async () => {
    const res = await cpProxy.uapi('u', 'p', 'Email', 'add_pop', { domain: 'x.com' })
    assert.strictEqual(calls.length, 1, `expected 1 call (no retry), got ${calls.length}`)
    assert.ok((res.errors || [])[0], 'should surface the error')
  })

  // 3. Retry covers list_domains
  mockAxios({ failFirst: true })
  await runTest('DomainInfo::list_domains retries once on transient timeout', async () => {
    const res = await cpProxy.uapi('u', 'p', 'DomainInfo', 'list_domains')
    assert.strictEqual(calls.length, 2, `expected 2 calls, got ${calls.length}`)
    assert.strictEqual(res.status, 1, 'should return success shape')
  })

  // 4. Second failure is surfaced (no infinite retry)
  calls = []
  axios.get = async () => {
    calls.push(1)
    const err = new Error('timeout of 30000ms exceeded')
    err.code = 'ECONNABORTED'
    throw err
  }
  await runTest('Persistent timeout returns errors[] (max 2 attempts)', async () => {
    const res = await cpProxy.uapi('u', 'p', 'Fileman', 'list_files')
    assert.strictEqual(calls.length, 2, `expected 2 calls then give up, got ${calls.length}`)
    assert.ok(res.errors && res.errors[0], 'should surface the timeout error')
    assert.strictEqual(res.status, 0, 'should indicate failure')
  })

  restoreAxios()
  console.log('\nAll cpanel-proxy retry tests passed.')
})().catch(e => { console.error(e); process.exit(1) })
