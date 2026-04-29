/**
 * Functional unit tests for the verify-and-retry control flow in
 * `cpanel-proxy.deleteFile`. Mocks axios so we don't hit a real cPanel.
 *
 * Three scenarios:
 *  1. Primary op succeeds → no retry
 *  2. Primary op silent-no-ops (returns success but listing still has target) → retry with fallback
 *  3. Both ops silent-no-op → returns status:0 with attempted_ops + diagnostic
 *
 * Run: `node js/tests/test_delete_verify_retry.js`
 */

/* eslint-disable no-console */
const assert = require('assert')

let failed = 0
const check = (name, fn) => {
  return (async () => {
    try {
      await fn()
      console.log(`  ✓ ${name}`)
    } catch (e) {
      failed++
      console.log(`  ✗ ${name}\n    ${e.stack || e.message}`)
    }
  })()
}

console.log('cpanel-proxy verify-and-retry functional tests')

// ── Mock harness: replace axios so the proxy uses our mock. ──
const callLog = []
let scenario // populated per test

// We need to intercept BOTH top-level `axios.get` (used by uapi) AND
// any `axios.create().get` style calls. Build a mock that handles both
// list_files (UAPI) and fileop (API2 — also called via top-level axios.get).
const respondTo = (url, opts) => {
  const params = opts?.params || {}
  const isFileop = /\/json-api\/cpanel/.test(url) // API2 path
  const isListFiles = /\/execute\/Fileman\/list_files/.test(url) // UAPI path
  if (isFileop) {
    const op = params.op
    callLog.push({ kind: 'fileop', url, op, sourcefiles: params.sourcefiles })
    const idx = callLog.filter(c => c.kind === 'fileop').length - 1
    const opResult = scenario.fileops[idx]
    if (!opResult) throw new Error(`No more fileop responses scripted (idx=${idx})`)
    return { data: { cpanelresult: { data: [opResult], event: { result: opResult.result } } } }
  }
  if (isListFiles) {
    callLog.push({ kind: 'list_files', url, dir: params.dir })
    const idx = callLog.filter(c => c.kind === 'list_files').length - 1
    const listing = scenario.listings[idx]
    if (!listing) throw new Error(`No more listing responses scripted (idx=${idx})`)
    return { data: { status: 1, data: listing } }
  }
  throw new Error(`Unmocked URL: ${url}`)
}

const axiosMock = {
  get: async (url, opts) => respondTo(url, opts),
  post: async (url, body, opts) => respondTo(url, opts),
  create: () => axiosMock,
}

// Intercept require('axios') so the proxy uses our mock.
const Module2 = require('module')
const origLoad = Module2._load
Module2._load = function (request, parent, ...rest) {
  if (request === 'axios') return axiosMock
  return origLoad.call(this, request, parent, ...rest)
}

// Force a fresh require of cpanel-proxy after patching axios
delete require.cache[require.resolve('../cpanel-proxy.js')]
const { deleteFile } = require('../cpanel-proxy.js')

// Test data
const TARGET_DIR = '/home/test/public_html'
const TARGET_FILE = 'BluFCU_Upload_Ready'
const STILL_PRESENT_LISTING = [
  { file: 'index.html', type: 'file' },
  { file: TARGET_FILE, type: 'dir' },
]
const GONE_LISTING = [
  { file: 'index.html', type: 'file' },
]

// Scenario 1: primary op (trash) succeeds, verify shows gone — no retry
;(async () => {
  await check('Scenario 1 — primary op succeeds, no retry', async () => {
    callLog.length = 0
    scenario = {
      fileops: [{ result: 1 }],
      listings: [GONE_LISTING],
    }
    const result = await deleteFile('test', 'pass', TARGET_DIR, TARGET_FILE, null, true)
    assert.strictEqual(result.status, 1, 'expected status=1')
    assert.deepStrictEqual(result.attempted_ops, ['trash'])
    assert.strictEqual(result.verified_via, 'primary')
    const fileops = callLog.filter(c => c.kind === 'fileop')
    assert.strictEqual(fileops.length, 1, `expected 1 fileop call, got ${fileops.length}`)
    assert.strictEqual(fileops[0].op, 'trash')
  })

  // Scenario 2: primary silently no-ops, fallback succeeds
  await check('Scenario 2 — primary silent no-op, fallback (unlink) succeeds', async () => {
    callLog.length = 0
    scenario = {
      // Both ops "succeed" per cPanel's response, but only the second one
      // actually clears the listing.
      fileops: [{ result: 1 }, { result: 1 }],
      listings: [STILL_PRESENT_LISTING, GONE_LISTING],
    }
    const result = await deleteFile('test', 'pass', TARGET_DIR, TARGET_FILE, null, true)
    assert.strictEqual(result.status, 1)
    assert.deepStrictEqual(result.attempted_ops, ['trash', 'unlink'])
    assert.strictEqual(result.verified_via, 'fallback')
    const fileops = callLog.filter(c => c.kind === 'fileop')
    assert.strictEqual(fileops.length, 2)
    assert.strictEqual(fileops[0].op, 'trash')
    assert.strictEqual(fileops[1].op, 'unlink')
  })

  // Scenario 3: both ops silently no-op — return status:0 with diagnostic
  await check('Scenario 3 — both ops silent no-op, returns status:0 + diagnostic', async () => {
    callLog.length = 0
    scenario = {
      fileops: [{ result: 1 }, { result: 1 }],
      listings: [STILL_PRESENT_LISTING, STILL_PRESENT_LISTING],
    }
    const result = await deleteFile('test', 'pass', TARGET_DIR, TARGET_FILE, null, true)
    assert.strictEqual(result.status, 0)
    assert.deepStrictEqual(result.attempted_ops, ['trash', 'unlink'])
    assert.ok(Array.isArray(result.errors) && result.errors.length > 0)
    assert.ok(/still present/i.test(result.errors[0]))
    assert.ok(result.fallback_response, 'expected fallback_response field for diagnostic')
  })

  // Scenario 4: file (not directory) — primary is `unlink`, fallback is `trash`
  await check('Scenario 4 — file delete uses unlink primary, trash fallback', async () => {
    callLog.length = 0
    scenario = {
      fileops: [{ result: 1 }, { result: 1 }],
      listings: [STILL_PRESENT_LISTING, GONE_LISTING],
    }
    await deleteFile('test', 'pass', TARGET_DIR, TARGET_FILE, null, false)
    const fileops = callLog.filter(c => c.kind === 'fileop')
    assert.strictEqual(fileops.length, 2)
    assert.strictEqual(fileops[0].op, 'unlink')
    assert.strictEqual(fileops[1].op, 'trash')
  })

  // Scenario 5: listing call fails — must NOT retry (gone===null fall-through)
  await check('Scenario 5 — verify call fails, returns primary result without retry', async () => {
    callLog.length = 0
    // Make list_files throw
    const origGet = axiosMock.get
    axiosMock.get = async (url, opts) => {
      if (/\/execute\/Fileman\/list_files/.test(url)) {
        throw new Error('cPanel API timeout')
      }
      return origGet(url, opts)
    }
    scenario = {
      fileops: [{ result: 1 }],
      listings: [],
    }
    const result = await deleteFile('test', 'pass', TARGET_DIR, TARGET_FILE, null, true)
    // Restore
    axiosMock.get = origGet
    // Should have made 1 fileop call (primary) and not retried
    const fileops = callLog.filter(c => c.kind === 'fileop')
    assert.strictEqual(fileops.length, 1, `expected 1 fileop, got ${fileops.length}`)
    assert.ok(result, 'expected non-null result')
  })

  Module2._load = origLoad
  if (failed) {
    console.log(`\n${failed} test(s) failed`)
    process.exit(1)
  }
  console.log('\nAll verify-and-retry functional tests passed')
})()
