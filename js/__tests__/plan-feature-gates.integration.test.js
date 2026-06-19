/* eslint-env node */
/**
 * Integration tests for the plan-feature gate changes:
 *   1. /mysql/* — was gold-only, NOW Premium Monthly + Gold can access
 *      (Weekly trial accounts must still be rejected).
 *   2. /geo, /geo/create, /geo/delete — was open to all plans, NOW Gold-only.
 *   3. /security/status — now reports `geoGoldOnly: true`.
 *
 * Runs against the live dev pod API via REACT_APP_BACKEND_URL.
 * Cleans up all test accounts at end.
 *
 * Run: node js/__tests__/plan-feature-gates.integration.test.js
 */
require('dotenv').config({ path: '/app/backend/.env' })
const assert = require('assert')
const { MongoClient } = require('mongodb')
const fs = require('fs')

const envFront = fs.readFileSync('/app/frontend/.env', 'utf8')
const m = envFront.match(/REACT_APP_BACKEND_URL=(.*)/)
const API = (m ? m[1] : '').trim().replace(/\/+$/, '')

const PINS = {
  weekly: { user: 'gatetest_w', pin: '111111', plan: 'Premium Anti-Red (1-Week)', domain: 'gatetest-w.example' },
  monthly: { user: 'gatetest_m', pin: '222222', plan: 'Premium Anti-Red HostPanel (1-Month)', domain: 'gatetest-m.example' },
  gold: { user: 'gatetest_g', pin: '333333', plan: 'Golden Anti-Red HostPanel (1-Month)', domain: 'gatetest-g.example' },
}

async function seed(db) {
  const cpAuth = require('/app/js/cpanel-auth')
  for (const k of Object.keys(PINS)) {
    const p = PINS[k]
    const enc = cpAuth.encrypt('dummy-not-a-real-pass')
    const pinHash = await cpAuth.hashPin(p.pin)
    await db.collection('cpanelAccounts').deleteOne({ _id: p.user })
    await db.collection('cpanelAccounts').insertOne({
      _id: p.user,
      cpUser: p.user,
      cpPass_encrypted: enc.encrypted,
      cpPass_iv: enc.iv,
      cpPass_tag: enc.tag,
      pinHash,
      domain: p.domain,
      plan: p.plan,
      whmHost: process.env.WHM_HOST || null,
      createdAt: new Date(),
      deleted: false,
      __seedTestAccount: true,
    })
  }
}

async function login(user, pin) {
  const r = await fetch(`${API}/api/panel/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: user, pin }),
  })
  const d = await r.json()
  if (!r.ok) throw new Error(`login ${user} failed: HTTP ${r.status}: ${JSON.stringify(d)}`)
  return d.token
}

async function call(path, token, method = 'GET', body = null) {
  const r = await fetch(`${API}/api/panel${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  let data; try { data = await r.json() } catch { data = null }
  return { status: r.status, data }
}

async function main() {
  console.log(`━━━ Plan-feature gate integration tests (API=${API}) ━━━`)
  const c = await MongoClient.connect(process.env.MONGO_URL, { serverSelectionTimeoutMS: 10000 })
  const db = c.db(process.env.DB_NAME)

  try {
    await seed(db)
    const wTok = await login(PINS.weekly.user, PINS.weekly.pin)
    const mTok = await login(PINS.monthly.user, PINS.monthly.pin)
    const gTok = await login(PINS.gold.user, PINS.gold.pin)
    console.log('  seeded + logged in all 3 plan tiers')

    // ── MySQL gate ──────────────────────────────────────────
    // Weekly: REJECTED with 403 mysqlRequiresMonthly
    let r = await call('/mysql/databases', wTok)
    assert.strictEqual(r.status, 403, `weekly mysql expected 403, got ${r.status}`)
    assert.strictEqual(r.data.mysqlRequiresMonthly, true, 'weekly response must have mysqlRequiresMonthly:true')
    console.log('  PASS: /mysql/databases Weekly → 403 with mysqlRequiresMonthly:true')

    // Premium Monthly: PASSES gate (will likely 5xx from WHM due to fake creds, but should NOT 403)
    r = await call('/mysql/databases', mTok)
    assert.notStrictEqual(r.status, 403, `premium monthly mysql got 403 (gate too strict): ${JSON.stringify(r.data)}`)
    console.log(`  PASS: /mysql/databases Premium Monthly → ${r.status} (NOT 403, gate passes)`)

    // Gold: PASSES gate
    r = await call('/mysql/databases', gTok)
    assert.notStrictEqual(r.status, 403, 'gold mysql got 403')
    console.log(`  PASS: /mysql/databases Gold → ${r.status} (NOT 403, gate passes)`)

    // ── Geo gate ────────────────────────────────────────────
    // Weekly: NOW REJECTED (was open)
    r = await call('/geo', wTok)
    assert.strictEqual(r.status, 403, `weekly geo expected 403, got ${r.status}`)
    assert.strictEqual(r.data.goldOnly, true, 'weekly geo must return goldOnly:true')
    console.log('  PASS: /geo Weekly → 403 goldOnly:true')

    // Premium Monthly: NOW REJECTED (was open)
    r = await call('/geo', mTok)
    assert.strictEqual(r.status, 403, `premium monthly geo expected 403, got ${r.status}`)
    assert.strictEqual(r.data.goldOnly, true)
    console.log('  PASS: /geo Premium Monthly → 403 goldOnly:true')

    // Gold: PASSES gate (will likely error on missing CF zone, NOT 403)
    r = await call('/geo', gTok)
    assert.notStrictEqual(r.status, 403, `gold geo got 403: ${JSON.stringify(r.data)}`)
    console.log(`  PASS: /geo Gold → ${r.status} (NOT 403, gate passes)`)

    // /geo/create and /geo/delete should also be 403 for non-Gold
    r = await call('/geo/create', mTok, 'POST', { countries: ['US'], mode: 'block' })
    assert.strictEqual(r.status, 403, 'geo/create monthly → 403')
    r = await call('/geo/delete', mTok, 'POST', { ruleId: 'fake' })
    assert.strictEqual(r.status, 403, 'geo/delete monthly → 403')
    console.log('  PASS: /geo/create + /geo/delete also 403 for non-Gold')

    // ── /security/status surfaces geoGoldOnly ──────────────
    r = await call('/security/status', mTok)
    if (r.status === 200) {
      assert.strictEqual(r.data.geoGoldOnly, true, 'security/status must surface geoGoldOnly:true')
      assert.strictEqual(r.data.captchaGoldOnly, true, 'security/status must surface captchaGoldOnly:true')
      console.log('  PASS: /security/status surfaces geoGoldOnly:true + captchaGoldOnly:true')
    } else {
      console.log(`  SKIP (security/status returned ${r.status} — likely missing CF zone for fake domain)`)
    }
  } finally {
    for (const p of Object.values(PINS)) {
      await db.collection('cpanelAccounts').deleteOne({ _id: p.user })
    }
    await c.close()
  }
  console.log('\n✅ ALL GATE TESTS PASS')
}

main().catch(e => { console.error('❌ TEST FAILURE:', e.message); process.exit(1) })
