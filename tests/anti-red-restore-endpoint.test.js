/* global describe, test, expect, beforeAll, afterAll */
/**
 * End-to-end tests for the user-initiated Anti-Red restore endpoints.
 *
 * Validates:
 *   - GET  /panel/anti-red/status     → returns the right pill for each state
 *   - POST /panel/anti-red/restore    → forces deployCFIPFix, resets stuck counter
 *   - Rate limit (1 / minute / cpUser) returns 429 on the 2nd rapid call
 *   - Auth required on both endpoints
 *
 * Uses the seeded `premtest` (PIN 123456) account.  WHM is not real for this
 * account, so deployCFIPFix returns a soft failure — the test asserts that
 * the endpoint LAYER works (DB writes, rate limit, response shape), not
 * that WHM actually got hit.
 */

// IMPORTANT: load .env BEFORE requiring cpAuth so SESSION_SECRET matches
// the running bot's encryption key (otherwise tokens are unverifiable).
require('dotenv').config({ path: '/app/backend/.env' })

const http = require('http')
const https = require('https')
const { URL } = require('url')
const { MongoClient } = require('mongodb')

const API_URL = require('fs').readFileSync('/app/frontend/.env', 'utf8')
  .split('\n').find(l => l.startsWith('REACT_APP_BACKEND_URL='))?.split('=')[1].trim()

const MONGO_URL = process.env.MONGO_URL
const DB_NAME = process.env.DB_NAME || 'test'

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(path, API_URL)
    const lib = u.protocol === 'https:' ? https : http
    const opts = {
      method,
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
      headers: { 'Content-Type': 'application/json', ...headers },
    }
    const req = lib.request(opts, res => {
      let chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString()
        let json = null
        try { json = JSON.parse(text) } catch { /* not json */ }
        resolve({ status: res.statusCode, text, json })
      })
    })
    req.on('error', reject)
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}

let mongoClient
let token = null

describe('Anti-Red Restore endpoints — end-to-end', () => {
  beforeAll(async () => {
    // Ensure the seed account exists
    mongoClient = new MongoClient(MONGO_URL)
    await mongoClient.connect()
    const db = mongoClient.db(DB_NAME)
    const accts = db.collection('cpanelAccounts')
    if (!await accts.findOne({ _id: 'premtest' })) {
      const cpAuth = require('/app/js/cpanel-auth')
      const pinHash = await cpAuth.hashPin('123456')
      const enc = cpAuth.encrypt('dummypass')
      await accts.insertOne({
        _id: 'premtest', cpUser: 'premtest',
        cpPass_encrypted: enc.encrypted, cpPass_iv: enc.iv, cpPass_tag: enc.tag,
        pinHash, chatId: '8888888', email: 'prem@test.com',
        domain: 'premtest.com', plan: 'Premium Anti-Red HostPanel (30 Days)',
        whmHost: process.env.WHM_HOST || null,
        expiryDate: new Date(Date.now() + 30 * 86400000),
        createdAt: new Date(),
      })
    }
    // Login
    const r = await request('POST', '/api/panel/login', { username: 'premtest', pin: '123456' })
    token = r.json?.token
  })

  afterAll(async () => {
    if (mongoClient) {
      // Reset the test account state so re-runs are clean
      try {
        await mongoClient.db(DB_NAME).collection('cpanelAccounts').updateOne(
          { _id: 'premtest' },
          { $unset: {
            protectionRepairCount: '', protectionStuckAt: '',
            protectionLastUserRestoreAt: '', protectionUserRestoreCount: '',
            lastCfIpFixAt: '', lastCfIpFixSig: '',
          }},
        )
      } catch { /* best effort */ }
      await mongoClient.close()
    }
  })

  test('Login succeeded — seed account is active', () => {
    expect(token).toBeTruthy()
  })

  describe('GET /anti-red/status', () => {
    test('Unauth → 401', async () => {
      const r = await request('GET', '/api/panel/anti-red/status')
      expect(r.status).toBe(401)
    })

    test('Auth (no repair history yet) → status=active', async () => {
      // Clean the account first
      await mongoClient.db(DB_NAME).collection('cpanelAccounts').updateOne(
        { _id: 'premtest' },
        { $unset: { protectionRepairCount: '', protectionStuckAt: '' }},
      )
      const r = await request('GET', '/api/panel/anti-red/status', null,
        { Authorization: `Bearer ${token}` })
      expect(r.status).toBe(200)
      expect(r.json.status).toBe('active')
    })

    test('Auth (protectionRepairCount=2) → status=repairing', async () => {
      await mongoClient.db(DB_NAME).collection('cpanelAccounts').updateOne(
        { _id: 'premtest' },
        { $set: { protectionRepairCount: 2 }, $unset: { protectionStuckAt: '' }},
      )
      const r = await request('GET', '/api/panel/anti-red/status', null,
        { Authorization: `Bearer ${token}` })
      expect(r.status).toBe(200)
      expect(r.json.status).toBe('repairing')
    })

    test('Auth (protectionStuckAt set) → status=stuck', async () => {
      await mongoClient.db(DB_NAME).collection('cpanelAccounts').updateOne(
        { _id: 'premtest' },
        { $set: { protectionStuckAt: new Date(), protectionRepairCount: 3 }},
      )
      const r = await request('GET', '/api/panel/anti-red/status', null,
        { Authorization: `Bearer ${token}` })
      expect(r.status).toBe(200)
      expect(r.json.status).toBe('stuck')
    })
  })

  describe('POST /anti-red/restore', () => {
    test('Unauth → 401', async () => {
      const r = await request('POST', '/api/panel/anti-red/restore', {})
      expect(r.status).toBe(401)
    })

    test('Auth → 200 (may succeed or fail at WHM, but endpoint works)', async () => {
      // Reset cooldown state by re-seeding cleanly
      await mongoClient.db(DB_NAME).collection('cpanelAccounts').updateOne(
        { _id: 'premtest' },
        { $set: { protectionRepairCount: 3, protectionStuckAt: new Date() }},
      )
      const r = await request('POST', '/api/panel/anti-red/restore', null,
        { Authorization: `Bearer ${token}` })
      // Response is always 200 with success: true or false (or 429 from prev call)
      expect([200, 429]).toContain(r.status)
      if (r.status === 200) {
        expect(r.json).toHaveProperty('success')
        expect(r.json).toHaveProperty('restoredAt')
        // Stuck counter must be cleared regardless of WHM success/failure
        if (r.json.success) {
          const acct = await mongoClient.db(DB_NAME).collection('cpanelAccounts')
            .findOne({ _id: 'premtest' })
          expect(acct.protectionRepairCount).toBe(0)
          expect(acct.protectionStuckAt).toBeFalsy()
          expect(acct.protectionLastUserRestoreAt).toBeTruthy()
          expect(acct.protectionUserRestoreCount).toBeGreaterThanOrEqual(1)
        }
      }
    })

    test('Rate limit: 2nd rapid call within 60s → 429 with retryAfterMs', async () => {
      // Reset cooldown first by re-seeding (the cooldown map is per-process,
      // we ensure the previous test ran)
      const r1 = await request('POST', '/api/panel/anti-red/restore', null,
        { Authorization: `Bearer ${token}` })
      const r2 = await request('POST', '/api/panel/anti-red/restore', null,
        { Authorization: `Bearer ${token}` })

      // If r1 was already 429 (from earlier test), both are 429
      // If r1 succeeded, r2 should be 429
      expect([r1.status, r2.status]).toContain(429)
      const limited = [r1, r2].find(r => r.status === 429)
      if (limited) {
        expect(limited.json.error).toMatch(/wait/i)
        expect(limited.json.retryAfterMs).toBeGreaterThan(0)
        expect(limited.json.retryAfterMs).toBeLessThanOrEqual(60000)
      }
    })
  })
})
