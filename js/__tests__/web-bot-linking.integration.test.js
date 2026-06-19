/* eslint-env node */
/**
 * Integration tests for seamless web↔bot account linking.
 *
 * Three scenarios:
 *   A) User signs up on web FIRST → later opens bot (a cpanelAccount exists
 *      with their email and a chatId) → bot-login MUST link to the existing
 *      webUser instead of creating a synthetic tg-<chatId>@bot.local doc.
 *   B) User buys hosting via bot (cpanelAccount with chatId+email) →
 *      later signs up on web with the same email → signup MUST auto-link.
 *   C) Same as (B) but the user uses /auth/login (not signup) — existing
 *      webUser missing tgChatId, after email login we MUST set tgChatId.
 *
 * Runs against the dev pod's live /api/store/* endpoints via REACT_APP_BACKEND_URL.
 * Cleans up all test docs at end.
 *
 * Run: node js/__tests__/web-bot-linking.integration.test.js
 */
require('dotenv').config({ path: '/app/backend/.env' })
const path = require('path')
const assert = require('assert')
const { MongoClient } = require('mongodb')
const fs = require('fs')

// Resolve the public preview URL the frontend uses
const envFront = fs.readFileSync('/app/frontend/.env', 'utf8')
const m = envFront.match(/REACT_APP_BACKEND_URL=(.*)/)
const API = (m ? m[1] : '').trim().replace(/\/+$/, '')
if (!API) throw new Error('REACT_APP_BACKEND_URL missing in /app/frontend/.env')

const { mintBotLoginToken } = require(path.resolve('/app/js/store-routes.js'))

const TEST_EMAIL_A = 'linktest-a@example.com'
const TEST_EMAIL_B = 'linktest-b@example.com'
const TEST_EMAIL_C = 'linktest-c@example.com'
const CHAT_A = '900100001'
const CHAT_B = '900100002'
const CHAT_C = '900100003'
const PASS = 'linktest-password-123'

async function clean(db) {
  await db.collection('webUsers').deleteMany({ email: { $in: [TEST_EMAIL_A, TEST_EMAIL_B, TEST_EMAIL_C] } })
  await db.collection('webUsers').deleteMany({ tgChatId: { $in: [CHAT_A, CHAT_B, CHAT_C] } })
  await db.collection('webBotLoginConsumed').deleteMany({ chatId: { $in: [CHAT_A, CHAT_B, CHAT_C] } })
  await db.collection('cpanelAccounts').deleteMany({ _id: { $regex: /^linktest_/ } })
}

async function postJSON(p, body) {
  const r = await fetch(`${API}/api/store${p}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  let data; try { data = await r.json() } catch { data = null }
  return { status: r.status, data }
}

async function testA(db) {
  // 1) User signs up on web FIRST
  let r = await postJSON('/auth/signup', { email: TEST_EMAIL_A, password: PASS })
  assert.strictEqual(r.status, 200, `signup status ${r.status}: ${JSON.stringify(r.data)}`)
  assert.ok(r.data.token, 'signup returns token')
  const webUserId = r.data.user.id
  assert.strictEqual(r.data.user.tgLinked, false, 'no tg link yet at signup time (no cpanel)')

  // 2) Later, the bot has a cpanelAccount with this email + chatId
  await db.collection('cpanelAccounts').insertOne({
    _id: 'linktest_cp_a',
    chatId: Number(CHAT_A),
    email: TEST_EMAIL_A,
    domain: 'linktest-a.example',
    cpUser: 'linktest_cp_a',
    plan: 'Premium Anti-Red HostPanel (1-Month)',
    createdAt: new Date(),
    deleted: false,
  })

  // 3) Bot user taps /web → mints token → web /auth/bot-login
  const bt = mintBotLoginToken(CHAT_A)
  r = await postJSON('/auth/bot-login', { bt })
  assert.strictEqual(r.status, 200, `bot-login status ${r.status}: ${JSON.stringify(r.data)}`)
  // CRITICAL: it must return the SAME webUser, not create a synthetic one
  assert.strictEqual(r.data.user.id, webUserId, `expected same webUser ${webUserId}, got ${r.data.user.id}`)
  assert.strictEqual(r.data.user.email, TEST_EMAIL_A, 'returned email must be the original web signup email, NOT tg-<chatId>@bot.local')
  assert.strictEqual(r.data.user.tgLinked, true, 'tgLinked must be true after auto-link')
  assert.strictEqual(r.data.user.tgChatId, CHAT_A)

  // 4) No duplicate webUser must have been created
  const count = await db.collection('webUsers').countDocuments({ $or: [{ email: TEST_EMAIL_A }, { email: `tg-${CHAT_A}@bot.local` }, { tgChatId: CHAT_A }] })
  assert.strictEqual(count, 1, `expected exactly 1 webUser for this person, found ${count}`)

  // 5) The cpanelAccount must now be reverse-linked to this webUser
  const cp = await db.collection('cpanelAccounts').findOne({ _id: 'linktest_cp_a' })
  assert.strictEqual(cp.webUserId, webUserId, 'cpanelAccount must be reverse-linked to webUser')

  console.log('  PASS (A): web-first → bot-login auto-links to existing webUser')
}

async function testB(db) {
  // 1) Bot user buys hosting (cpanelAccount with chatId + email, no webUserId yet)
  await db.collection('cpanelAccounts').insertOne({
    _id: 'linktest_cp_b',
    chatId: Number(CHAT_B),
    email: TEST_EMAIL_B,
    domain: 'linktest-b.example',
    cpUser: 'linktest_cp_b',
    plan: 'Golden',
    createdAt: new Date(),
    deleted: false,
  })

  // 2) User signs up on web with the same email
  const r = await postJSON('/auth/signup', { email: TEST_EMAIL_B, password: PASS })
  assert.strictEqual(r.status, 200)
  // Must auto-link
  assert.strictEqual(r.data.user.tgLinked, true, 'signup must auto-link to chatId via cpanel email match')
  assert.strictEqual(r.data.user.tgChatId, CHAT_B)
  assert.ok(r.data.link?.linked, 'response.link.linked must be true')
  assert.strictEqual(r.data.link.chatId, CHAT_B)

  // 3) cpanelAccount must be reverse-linked to the new webUser
  const cp = await db.collection('cpanelAccounts').findOne({ _id: 'linktest_cp_b' })
  assert.strictEqual(cp.webUserId, r.data.user.id, 'cpanelAccount.webUserId must be set')

  console.log('  PASS (B): bot-first → web signup auto-links via shared email')
}

async function testC(db) {
  // 1) Web user exists already (NO tgChatId)
  const bcrypt = require('bcryptjs')
  const passwordHash = await bcrypt.hash(PASS, 10)
  const userId = `linktest-c-${Date.now()}`
  await db.collection('webUsers').insertOne({
    _id: userId,
    email: TEST_EMAIL_C,
    passwordHash,
    walletUsd: 0,
    createdAt: new Date(),
  })

  // 2) cpanelAccount with chatId + email (created later by bot)
  await db.collection('cpanelAccounts').insertOne({
    _id: 'linktest_cp_c',
    chatId: Number(CHAT_C),
    email: TEST_EMAIL_C,
    domain: 'linktest-c.example',
    cpUser: 'linktest_cp_c',
    plan: 'Premium',
    createdAt: new Date(),
    deleted: false,
  })

  // 3) Web user logs in with email+password → should auto-link
  const r = await postJSON('/auth/login', { email: TEST_EMAIL_C, password: PASS })
  assert.strictEqual(r.status, 200, `login status ${r.status}: ${JSON.stringify(r.data)}`)
  assert.strictEqual(r.data.user.tgLinked, true, 'login must auto-link to chatId via cpanel email match')
  assert.strictEqual(r.data.user.tgChatId, CHAT_C)
  assert.strictEqual(r.data.user.id, userId)

  // 4) Re-login → already linked, no double-link issue (idempotent)
  const r2 = await postJSON('/auth/login', { email: TEST_EMAIL_C, password: PASS })
  assert.strictEqual(r2.status, 200)
  assert.strictEqual(r2.data.user.tgChatId, CHAT_C)

  console.log('  PASS (C): bot-first cpanel + later web login → auto-links')
}

async function testD_ambiguous(db) {
  // Two cpanel accounts under same email but DIFFERENT chatIds → must NOT auto-link
  await db.collection('cpanelAccounts').insertMany([
    { _id: 'linktest_cp_d1', chatId: 555111, email: 'ambig@example.com', domain: 'd1.example', cpUser: 'linktest_cp_d1', plan: 'P', createdAt: new Date(), deleted: false },
    { _id: 'linktest_cp_d2', chatId: 555222, email: 'ambig@example.com', domain: 'd2.example', cpUser: 'linktest_cp_d2', plan: 'P', createdAt: new Date(), deleted: false },
  ])
  const r = await postJSON('/auth/signup', { email: 'ambig@example.com', password: PASS })
  assert.strictEqual(r.status, 200)
  assert.strictEqual(r.data.user.tgLinked, false, 'must NOT auto-link when 2+ chatIds match same email')
  assert.strictEqual(r.data.link?.reason, 'ambiguous', 'link reason must be ambiguous')

  console.log('  PASS (D): ambiguous email match → no auto-link (safe)')

  // Cleanup
  await db.collection('webUsers').deleteOne({ email: 'ambig@example.com' })
  await db.collection('cpanelAccounts').deleteMany({ _id: { $in: ['linktest_cp_d1', 'linktest_cp_d2'] } })
}

async function main() {
  console.log(`━━━ Web↔Bot linking integration tests (API=${API}) ━━━`)
  const c = await MongoClient.connect(process.env.MONGO_URL)
  const db = c.db(process.env.DB_NAME)
  try {
    await clean(db)
    await testA(db)
    await testB(db)
    await testC(db)
    await testD_ambiguous(db)
  } finally {
    await clean(db)
    await c.close()
  }
  console.log('\n✅ ALL 4 LINKING SCENARIOS PASS')
}

main().catch(e => { console.error('❌ TEST FAILURE:', e.message); process.exit(1) })
