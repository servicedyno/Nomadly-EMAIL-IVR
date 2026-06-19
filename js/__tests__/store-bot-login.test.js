/* eslint-env node */
/**
 * Unit tests for the Bot→Web auto-login token helpers in store-routes.js.
 * No HTTP, no DB — exercises mintBotLoginToken / verifyBotLoginToken purely.
 *
 * Run: node js/__tests__/store-bot-login.test.js
 */
require('dotenv').config({ path: '/app/backend/.env' })
const assert = require('assert')
const path = require('path')

// Ensure JWT_SECRET (used to derive BOT_LINK_KEY) is stable across requires.
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-fixed-session-secret-do-not-use-in-prod'

const cfPath = path.resolve('/app/js/store-routes.js')
delete require.cache[cfPath]
const { mintBotLoginToken, verifyBotLoginToken } = require(cfPath)

function test_round_trip() {
  const token = mintBotLoginToken('123456789')
  assert.ok(typeof token === 'string' && token.includes('.'), 'token format: <body>.<sig>')
  const v = verifyBotLoginToken(token)
  assert.strictEqual(v.ok, true, 'should verify')
  assert.strictEqual(v.chatId, '123456789')
  assert.ok(typeof v.nonce === 'string' && v.nonce.length >= 8, 'nonce present')
  assert.ok(v.exp > Math.floor(Date.now() / 1000), 'exp in the future')
  console.log('  PASS: round-trip')
}

function test_unique_nonce() {
  const a = mintBotLoginToken('1')
  const b = mintBotLoginToken('1')
  assert.notStrictEqual(a, b, 'two mints for same chatId should differ (nonce randomized)')
  const va = verifyBotLoginToken(a)
  const vb = verifyBotLoginToken(b)
  assert.notStrictEqual(va.nonce, vb.nonce, 'nonces should differ')
  console.log('  PASS: unique nonce')
}

function test_tampered_payload() {
  const token = mintBotLoginToken('555')
  // Try to replace chatId by editing the base64 body
  const [body, sig] = token.split('.')
  const decoded = Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
  const obj = JSON.parse(decoded)
  obj.c = '999'  // tamper
  const tamperedBody = Buffer.from(JSON.stringify(obj)).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const tamperedToken = `${tamperedBody}.${sig}`
  const v = verifyBotLoginToken(tamperedToken)
  assert.strictEqual(v.ok, false, 'tampered payload must fail')
  assert.strictEqual(v.error, 'bad_signature')
  console.log('  PASS: tampered payload rejected')
}

function test_tampered_signature() {
  const token = mintBotLoginToken('777')
  const [body] = token.split('.')
  const fake = `${body}.${'a'.repeat(64)}`
  const v = verifyBotLoginToken(fake)
  assert.strictEqual(v.ok, false)
  assert.strictEqual(v.error, 'bad_signature')
  console.log('  PASS: bad signature rejected')
}

function test_expired() {
  // Manually craft an already-expired token
  const crypto = require('crypto')
  const payload = { c: '111', e: Math.floor(Date.now() / 1000) - 10, n: 'deadbeef' }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const key = crypto.createHmac('sha256', process.env.SESSION_SECRET).update('store-bot-link-v1').digest()
  const sig = crypto.createHmac('sha256', key).update(body).digest('hex')
  const token = `${body}.${sig}`
  const v = verifyBotLoginToken(token)
  assert.strictEqual(v.ok, false)
  assert.strictEqual(v.error, 'expired')
  console.log('  PASS: expired token rejected')
}

function test_malformed() {
  for (const bad of ['', 'no-dot-here', 'a.b.c', 'invalid_body!@.deadbeef', null, undefined]) {
    const v = verifyBotLoginToken(bad)
    assert.strictEqual(v.ok, false, `should reject ${JSON.stringify(bad)}`)
  }
  console.log('  PASS: malformed tokens rejected')
}

function test_minted_for_numeric_chatId() {
  // Telegram chatIds are numbers — verify they're stringified safely
  const tok = mintBotLoginToken(987654321)
  const v = verifyBotLoginToken(tok)
  assert.strictEqual(v.ok, true)
  assert.strictEqual(v.chatId, '987654321')
  console.log('  PASS: numeric chatId → string')
}

function main() {
  console.log('━━━ store-bot-login unit tests ━━━')
  test_round_trip()
  test_unique_nonce()
  test_tampered_payload()
  test_tampered_signature()
  test_expired()
  test_malformed()
  test_minted_for_numeric_chatId()
  console.log('\n✅ ALL 7 TESTS PASS')
}
main()
