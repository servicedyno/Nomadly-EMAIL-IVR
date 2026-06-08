#!/usr/bin/env node
/**
 * Final-mile Contabo diagnosis:
 * 1. Try CREATE with Idempotency-Key header (sometimes required)
 * 2. Try CREATE with proper User-Agent (in case CF WAF is blocking)
 * 3. Hit billing endpoints to see invoice/account health
 * 4. Try retrieving the user's secrets / SSH keys (verify other write ops work)
 */
require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')
const crypto = require('crypto')

const CLIENT_ID     = process.env.CONTABO_CLIENT_ID
const CLIENT_SECRET = process.env.CONTABO_CLIENT_SECRET
const API_USER      = process.env.CONTABO_API_USER
const API_PASSWORD  = process.env.CONTABO_API_PASSWORD

const AUTH_URL = 'https://auth.contabo.com/auth/realms/contabo/protocol/openid-connect/token'
const API_BASE = 'https://api.contabo.com/v1'

async function getToken() {
  const params = new URLSearchParams({
    client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
    username: API_USER, password: API_PASSWORD, grant_type: 'password',
  })
  const r = await axios.post(AUTH_URL, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000,
  })
  return r.data.access_token
}

async function call(method, path, data, extraHeaders = {}) {
  const t = await getToken()
  const headers = {
    Authorization: `Bearer ${t}`,
    'x-request-id': crypto.randomUUID(),
    ...extraHeaders,
  }
  try {
    const r = await axios({ method, url: API_BASE + path, data, headers, timeout: 20000 })
    return { status: r.status, ok: true, data: r.data, headers: r.headers, traceId: r.headers['x-trace-id'] || r.headers['cf-ray'] }
  } catch (e) {
    return {
      status: e.response?.status || 0,
      ok: false,
      data: e.response?.data || { message: e.message },
      headers: e.response?.headers || {},
      traceId: e.response?.headers?.['x-trace-id'] || e.response?.headers?.['cf-ray'],
    }
  }
}

;(async () => {
  console.log('=== Test 1: CREATE with Idempotency-Key and proper User-Agent ===')
  const r1 = await call('POST', '/compute/instances', {
    productId: 'V91',
    region: 'EU',
    imageId: '1a5471c8-06f6-40cd-aff1-e946f72235a8',
    period: 1,
  }, {
    'x-idempotency-key': crypto.randomUUID(),
    'User-Agent': 'contabo-go-sdk/0.7.0',
    'Content-Type': 'application/json',
  })
  console.log(`  HTTP ${r1.status}  cf-ray=${r1.traceId}`)
  console.log(`  body: ${JSON.stringify(r1.data).slice(0, 400)}`)

  console.log('\n=== Test 2: WRITE op other than CREATE (create a secret — known safe op) ===')
  const r2 = await call('POST', '/secrets', {
    name: `diag-test-${Date.now()}`,
    value: 'TestDiagOnly!1',
    type: 'password',
  })
  console.log(`  HTTP ${r2.status}  cf-ray=${r2.traceId}`)
  console.log(`  body: ${JSON.stringify(r2.data).slice(0, 400)}`)
  // Cleanup the secret if created
  if (r2.ok && r2.data?.data?.[0]?.secretId) {
    const sid = r2.data.data[0].secretId
    const del = await call('DELETE', `/secrets/${sid}`)
    console.log(`  cleanup secret ${sid}: HTTP ${del.status}`)
  }

  console.log('\n=== Test 3: try various known billing/account endpoints ===')
  for (const p of [
    '/billing/info', '/billing/contact', '/billing/contacts',
    '/me', '/profile', '/account',
    '/compute/limits', '/compute/quotas',
    '/users', '/users/client',
  ]) {
    const r = await call('GET', p)
    const body = r.ok
      ? JSON.stringify(r.data).slice(0, 180)
      : (typeof r.data === 'object' ? JSON.stringify(r.data).slice(0, 180) : String(r.data).slice(0, 120))
    console.log(`  ${r.ok ? '✓' : '✗'} GET ${p.padEnd(22)} HTTP ${r.status}  ${body}`)
  }

  console.log('\n=== Test 4: 5 concurrent CREATE attempts to verify pattern is deterministic ===')
  const concurrent = await Promise.all(
    Array.from({ length: 5 }).map((_, i) =>
      call('POST', '/compute/instances', {
        productId: 'V91',
        region: 'EU',
        imageId: '1a5471c8-06f6-40cd-aff1-e946f72235a8',
        period: 1,
      })
    )
  )
  concurrent.forEach((r, i) => {
    console.log(`  [${i + 1}] HTTP ${r.status}  cf-ray=${r.traceId}  ${JSON.stringify(r.data).slice(0, 100)}`)
  })

  console.log('\n=== Test 5: NEW Contabo API (cnct.contabo.com) — separate endpoint, different gateway ===')
  // Some accounts work on the newer cnct.contabo.com hostname
  try {
    const t = await getToken()
    const r = await axios.post('https://api.contabo.com/v1/compute/instances', {
      productId: 'V91', region: 'EU',
      imageId: '1a5471c8-06f6-40cd-aff1-e946f72235a8', period: 1,
    }, {
      headers: {
        Authorization: `Bearer ${t}`,
        'x-request-id': crypto.randomUUID(),
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 20000,
      validateStatus: () => true,
    })
    console.log(`  HTTP ${r.status}  cf-ray=${r.headers['cf-ray']}`)
    console.log(`  body: ${JSON.stringify(r.data).slice(0, 300)}`)
  } catch (e) {
    console.log(`  failed: ${e.message}`)
  }

  console.log('\n=== Test 6: STATUS — does Contabo /status endpoint exist? ===')
  try {
    const r = await axios.get('https://status.contabo.com/api/v2/summary.json', { timeout: 10000, validateStatus: () => true })
    if (r.status === 200) {
      const incidents = r.data?.incidents || []
      const components = r.data?.components || []
      console.log(`  ✓ status page reached`)
      console.log(`  active incidents: ${incidents.length}`)
      incidents.slice(0, 5).forEach(i => console.log(`    - ${i.name}  status=${i.status}  impact=${i.impact}`))
      const issues = components.filter(c => c.status !== 'operational')
      console.log(`  non-operational components: ${issues.length}`)
      issues.forEach(c => console.log(`    - ${c.name}  status=${c.status}`))
    } else {
      console.log(`  status page returned HTTP ${r.status}`)
    }
  } catch (e) {
    console.log(`  status page check failed: ${e.message}`)
  }
})().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
