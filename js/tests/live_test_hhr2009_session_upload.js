#!/usr/bin/env node
/* eslint-disable no-console */
// ─────────────────────────────────────────────────────────────────────────────
// LIVE end-to-end File Manager sanity test — WHM impersonation session fix
//
// Runs the FULL Panel /files/* flow against a real cPanel account:
//   mkdir → list (retry, cache lag) → single-shot upload → chunked upload →
//   .zip upload → extract → delete each artifact → delete folders →
//   verify parent listing shows the test dir gone.
//
// This is the ONLY test that catches:
//   • WHM /json-api multipart drop (unit tests can't see the gateway)
//   • cpsrvd HTTP-200-with-login-HTML (real network path only)
//   • Stale cpPass session-fallback wire-up (needs real WHM to mint session)
//
// Snapshots Mongo before/after and ASSERTS `cpPass_encrypted` is UNCHANGED —
// the WHM session architecture doesn't rotate passwords (retires the earlier
// _repairCpPass approach entirely).
//
// USAGE:
//   NODE_TEST_CP_USER=<cpUser> node js/tests/live_test_hhr2009_session_upload.js
//   (auto-picks the first cpanelAccounts doc if NODE_TEST_CP_USER unset)
//
// Test artifacts live under /home/<cpUser>/nomadly_selfheal_test/ — outside
// public_html, so the live website is untouched. Cleaned up at the end.
// ─────────────────────────────────────────────────────────────────────────────

require('dotenv').config()
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const { MongoClient, ObjectId: _oid } = require('mongodb')
const axios = require('axios')
const FormData = require('form-data')

// Reuse the app's own AES-GCM helpers so we're decrypting with the same key.
const cpAuth = require('../cpanel-auth')

const NODE_URL = process.env.NODE_LIVE_URL || 'http://127.0.0.1:5000'
const MONGO_URL = process.env.MONGO_URL
const DB_NAME = process.env.DB_NAME || 'smadav'

const TEST_DIR_NAME = 'nomadly_selfheal_test'    // parent test folder
const CHILD_DIR_NAME = 'sub'                     // for chunk-upload test
const SINGLE_FILE = 'single_upload.txt'
const CHUNK_FILE  = 'chunked_upload.bin'
const ZIP_FILE    = 'extract_probe.zip'
const EXTRACTED_FILE = 'inside_zip.txt'
const CHUNK_SIZE = 2.5 * 1024 * 1024              // 2.5 MB × 3 chunks = 7.5 MB
const CHUNK_COUNT = 3

let passed = 0
let failed = 0
const failures = []
function assert(cond, name) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); return true }
  failed++
  failures.push(name)
  console.error(`  ✗ ${name}`)
  return false
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// WHM cache lag can be 1-2s between mkdir and list — retry with backoff.
async function withRetry(fn, tries = 5, delayMs = 700) {
  for (let i = 0; i < tries; i++) {
    const r = await fn()
    if (r) return r
    await sleep(delayMs * (i + 1))
  }
  return null
}

async function main() {
  if (!MONGO_URL) throw new Error('MONGO_URL missing from env')
  const mc = new MongoClient(MONGO_URL)
  await mc.connect()
  const col = mc.db(DB_NAME).collection('cpanelAccounts')

  const cpUserFilter = process.env.NODE_TEST_CP_USER
    ? { _id: process.env.NODE_TEST_CP_USER.toLowerCase() }
    : {}
  const account = await col.findOne(cpUserFilter)
  if (!account) {
    console.error(`No cpanelAccounts doc found ${cpUserFilter._id ? `for _id=${cpUserFilter._id}` : '(collection is empty on this pod)'}`)
    console.error('Nothing to test against — exiting with skip status.')
    await mc.close()
    process.exit(2) // 2 = SKIP (no account), distinct from real test failure
  }
  const cpUser  = account.cpUser  || account._id
  const domain  = account.domain  || 'test.example.com'
  const chatId  = account.chatId
  console.log(`\n▶ Live test target: cpUser=${cpUser} · domain=${domain} · chatId=${chatId}`)
  console.log(`▶ Node URL:         ${NODE_URL}`)
  console.log(`▶ Test dir:         /home/${cpUser}/${TEST_DIR_NAME}/  (OUTSIDE public_html)\n`)

  // ── Snapshot Mongo BEFORE to prove cpPass_encrypted is unchanged after ──
  const before = {
    cpPass_encrypted: account.cpPass_encrypted,
    cpPass_iv: account.cpPass_iv,
    cpPass_tag: account.cpPass_tag,
  }

  // Decrypt cpPass so we can mint a JWT the way login would
  const _cpPass = cpAuth.decrypt({
    encrypted: account.cpPass_encrypted,
    iv: account.cpPass_iv,
    tag: account.cpPass_tag,
  })
  // Mint JWT via cpAuth.createToken (skip PIN flow — this is a diagnostic tool)
  const token = cpAuth.createToken({ cpUser, domain, chatId, whmHost: account.whmHost })
  const auth = { Authorization: `Bearer ${token}` }
  const homeDir = `/home/${cpUser}`
  const testDir = `${homeDir}/${TEST_DIR_NAME}`
  const subDir  = `${testDir}/${CHILD_DIR_NAME}`

  // Wrapper — panel uses /panel prefix and multipart for uploads
  const api = axios.create({ baseURL: NODE_URL, headers: auth, validateStatus: () => true, timeout: 300000 })

  const cleanupSteps = []
  try {
    // ── (1) mkdir /home/<user>/nomadly_selfheal_test ──
    console.log('\n[1/9] mkdir parent test dir')
    let r = await api.post('/panel/files/mkdir', { dir: homeDir, name: TEST_DIR_NAME })
    assert(r.data?.status === 1, `mkdir ${TEST_DIR_NAME} status:1`)
    cleanupSteps.push(async () => api.post('/panel/files/delete', { dir: homeDir, name: TEST_DIR_NAME, isDirectory: true }))

    // ── (2) list — verify created (retry for WHM cache lag) ──
    console.log('[2/9] list parent, verify test dir appears')
    const listedParent = await withRetry(async () => {
      const rr = await api.get(`/panel/files?dir=${encodeURIComponent(homeDir)}`)
      return (rr.data?.data || []).some(f => f.file === TEST_DIR_NAME) ? rr : null
    })
    assert(listedParent, `list ${homeDir} contains ${TEST_DIR_NAME}`)

    // ── (3) mkdir child sub-dir ──
    console.log('[3/9] mkdir sub-dir for chunk upload')
    r = await api.post('/panel/files/mkdir', { dir: testDir, name: CHILD_DIR_NAME })
    assert(r.data?.status === 1, `mkdir ${CHILD_DIR_NAME}`)

    // ── (4) single-shot upload ──
    console.log('[4/9] single-shot upload')
    const singleBody = Buffer.from(`self-heal test @ ${new Date().toISOString()}\ncpUser=${cpUser}\n`)
    const singleForm = new FormData()
    singleForm.append('dir', testDir)
    singleForm.append('file', singleBody, { filename: SINGLE_FILE })
    r = await api.post('/panel/files/upload', singleForm, { headers: { ...auth, ...singleForm.getHeaders() } })
    assert(r.data?.status === 1, `single upload ${SINGLE_FILE} status:1`)
    console.log(`      via: ${r.data?.via || 'primary'}`)

    // ── (5) chunked upload (2.5 MB × 3) ──
    console.log(`[5/9] chunked upload (${CHUNK_COUNT} × ${(CHUNK_SIZE / 1024 / 1024).toFixed(1)} MB)`)
    const uploadId = crypto.randomBytes(8).toString('hex')
    let chunkOk = true
    for (let i = 0; i < CHUNK_COUNT; i++) {
      const chunk = crypto.randomBytes(CHUNK_SIZE)
      const cf = new FormData()
      cf.append('dir', subDir)
      cf.append('fileName', CHUNK_FILE)
      cf.append('uploadId', uploadId)
      cf.append('chunkIndex', i)
      cf.append('totalChunks', CHUNK_COUNT)
      cf.append('chunk', chunk, { filename: `chunk-${i}` })
      const rr = await api.post('/panel/files/upload-chunk', cf, { headers: { ...auth, ...cf.getHeaders() } })
      const isLast = i === CHUNK_COUNT - 1
      const okShape = isLast ? rr.data?.cpanelStatus === 1 : rr.data?.status === 'received'
      if (!okShape) { chunkOk = false; break }
    }
    assert(chunkOk, `chunked upload ${CHUNK_FILE} all chunks + assemble OK`)

    // ── (6) upload .zip probe for extract ──
    console.log('[6/9] upload .zip for extract test')
    const admZipPath = (() => { try { return require.resolve('adm-zip') } catch (_) { return null } })()
    if (!admZipPath) {
      console.log('      SKIP: adm-zip not installed (add to devDependencies to enable)')
    } else {
      const AdmZip = require(admZipPath)
      const zip = new AdmZip()
      zip.addFile(EXTRACTED_FILE, Buffer.from(`extracted at ${new Date().toISOString()}\n`))
      const zipBuf = zip.toBuffer()
      const zf = new FormData()
      zf.append('dir', testDir)
      zf.append('file', zipBuf, { filename: ZIP_FILE })
      r = await api.post('/panel/files/upload', zf, { headers: { ...auth, ...zf.getHeaders() } })
      assert(r.data?.status === 1, `upload ${ZIP_FILE}`)

      // ── (7) extract ──
      console.log('[7/9] extract')
      r = await api.post('/panel/files/extract', { dir: testDir, file: ZIP_FILE })
      assert(r.data?.status === 1, `extract ${ZIP_FILE}`)

      // ── (7b) verify extracted content appears ──
      const listedAfter = await withRetry(async () => {
        const rr = await api.get(`/panel/files?dir=${encodeURIComponent(testDir)}`)
        return (rr.data?.data || []).some(f => f.file === EXTRACTED_FILE) ? rr : null
      })
      assert(listedAfter, `extracted file ${EXTRACTED_FILE} appears in listing`)
    }

    // ── (8) delete each artifact ──
    console.log('[8/9] delete artifacts')
    r = await api.post('/panel/files/delete', { dir: testDir, name: SINGLE_FILE })
    assert(r.data?.status === 1, `delete ${SINGLE_FILE}`)
    r = await api.post('/panel/files/delete', { dir: subDir, name: CHUNK_FILE })
    assert(r.data?.status === 1, `delete ${CHUNK_FILE}`)
    if (admZipPath) {
      r = await api.post('/panel/files/delete', { dir: testDir, name: ZIP_FILE })
      assert(r.data?.status === 1, `delete ${ZIP_FILE}`)
      r = await api.post('/panel/files/delete', { dir: testDir, name: EXTRACTED_FILE })
      assert(r.data?.status === 1, `delete ${EXTRACTED_FILE}`)
    }
    r = await api.post('/panel/files/delete', { dir: testDir, name: CHILD_DIR_NAME, isDirectory: true })
    assert(r.data?.status === 1, `delete sub-dir ${CHILD_DIR_NAME}`)
    r = await api.post('/panel/files/delete', { dir: homeDir, name: TEST_DIR_NAME, isDirectory: true })
    assert(r.data?.status === 1, `delete parent ${TEST_DIR_NAME}`)
    cleanupSteps.length = 0 // successful — nothing to force-clean

    // ── (9) parent listing verifies test dir is gone ──
    console.log('[9/9] verify parent listing no longer shows test dir')
    const listedFinal = await withRetry(async () => {
      const rr = await api.get(`/panel/files?dir=${encodeURIComponent(homeDir)}`)
      return !(rr.data?.data || []).some(f => f.file === TEST_DIR_NAME) ? rr : null
    })
    assert(listedFinal, `${TEST_DIR_NAME} no longer appears in ${homeDir}`)

    // ── Mongo snapshot after — cpPass MUST be unchanged ──
    console.log('\n[assert] Mongo cpPass_encrypted UNCHANGED (session doesn\'t rotate passwords)')
    const after = await col.findOne({ _id: account._id })
    assert(after.cpPass_encrypted === before.cpPass_encrypted, 'cpPass_encrypted unchanged')
    assert(after.cpPass_iv === before.cpPass_iv,               'cpPass_iv unchanged')
    assert(after.cpPass_tag === before.cpPass_tag,             'cpPass_tag unchanged')
    // Retired _repairCpPass would have written cpPassRotatedAt — must be absent
    // or unchanged from BEFORE.
    assert(String(after.cpPassRotatedAt || '') === String(account.cpPassRotatedAt || ''), 'cpPassRotatedAt unchanged (no rotation happened)')
  } finally {
    // Best-effort cleanup if we bailed mid-flow
    for (const step of cleanupSteps) {
      try { await step() } catch (_) { /* silent */ }
    }
    await mc.close()
  }

  console.log(`\n─── ${passed} passed, ${failed} failed ───`)
  if (failed) {
    console.error('\nFailures:')
    failures.forEach(f => console.error(`  • ${f}`))
    process.exit(1)
  }
  console.log('✓ Live end-to-end File Manager flow OK. Session-cookie architecture verified.')
  process.exit(0)
}

main().catch(e => {
  console.error('EXCEPTION:', e.stack || e.message)
  process.exit(1)
})
