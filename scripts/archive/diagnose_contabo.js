#!/usr/bin/env node
/**
 * Diagnose Contabo API health — is the 500 on POST /compute/instances a global
 * outage, an account-specific issue, or product/region-specific capacity?
 */
require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')

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

async function call(method, path, data) {
  const t = await getToken()
  const headers = {
    Authorization: `Bearer ${t}`,
    'x-request-id': require('crypto').randomUUID(),
  }
  try {
    const r = await axios({ method, url: API_BASE + path, data, headers, timeout: 20000 })
    return { status: r.status, ok: true, data: r.data }
  } catch (e) {
    return {
      status: e.response?.status || 0,
      ok: false,
      data: e.response?.data || { message: e.message },
    }
  }
}

;(async () => {
  console.log('=== Step 1: token works? ===')
  try {
    const t = await getToken()
    console.log(`  ✓ token acquired (${t.slice(0,20)}…)`)
  } catch (e) {
    console.log(`  ✗ token FAILED: ${e.response?.data || e.message}`)
    process.exit(1)
  }

  console.log('\n=== Step 2: READ ops health (GET /compute/instances, /compute/images, /compute/products) ===')
  for (const path of ['/compute/instances?size=1', '/compute/images?size=1', '/compute/regions', '/users']) {
    const r = await call('GET', path)
    console.log(`  ${r.ok ? '✓' : '✗'} GET ${path}  HTTP ${r.status}${r.ok ? '' : '  ' + JSON.stringify(r.data).slice(0,150)}`)
  }

  console.log('\n=== Step 3: try a CREATE with the EXACT failing params from the user ===')
  const attempts = [
    { productId: 'V91', region: 'US-central', imageId: '1a5471c8-06f6-40cd-aff1-e946f72235a8', label: 'V91 US-central (failed for user)' },
    { productId: 'V92', region: 'US-east',    imageId: '1a5471c8-06f6-40cd-aff1-e946f72235a8', label: 'V92 US-east (failed for user)' },
    { productId: 'V91', region: 'EU',         imageId: '1a5471c8-06f6-40cd-aff1-e946f72235a8', label: 'V91 EU (control test)' },
    { productId: 'V92', region: 'EU',         imageId: '1a5471c8-06f6-40cd-aff1-e946f72235a8', label: 'V92 EU (control test)' },
    { productId: 'V93', region: 'US-central', imageId: '1a5471c8-06f6-40cd-aff1-e946f72235a8', label: 'V93 US-central (different tier)' },
  ]
  for (const a of attempts) {
    const payload = {
      productId: a.productId,
      region: a.region,
      imageId: a.imageId,
      displayName: `nomadly-diag-${Date.now()}`,
      defaultUser: 'root',
      period: 1,
    }
    const r = await call('POST', '/compute/instances', payload)
    const msg = r.ok ? 'OK' : (r.data?.message || JSON.stringify(r.data).slice(0,160))
    console.log(`  ${r.ok ? '✓' : '✗'} POST ${a.label.padEnd(38)} HTTP ${String(r.status).padEnd(4)} ${msg}`)
    if (r.ok && r.data?.data?.[0]?.instanceId) {
      const newId = r.data.data[0].instanceId
      console.log(`     created instance ${newId} — issuing immediate CANCEL to avoid charges`)
      const cancelR = await call('POST', `/compute/instances/${newId}/cancel`)
      console.log(`     cancel: HTTP ${cancelR.status} ${cancelR.ok ? 'OK' : JSON.stringify(cancelR.data).slice(0,200)}`)
    }
    await new Promise(r => setTimeout(r, 1500))
  }

  console.log('\n=== Step 4: list recent instances to check account billing state ===')
  const recent = await call('GET', '/compute/instances?size=10&orderBy=createdDate:desc')
  if (recent.ok) {
    const items = recent.data?.data || []
    console.log(`  total instances on account: ${recent.data?._pagination?.totalElements ?? items.length}`)
    for (const i of items.slice(0,5)) {
      console.log(`    ${i.instanceId}  ${i.name}  status=${i.status}  created=${i.createdDate}`)
    }
  } else {
    console.log(`  list failed: ${JSON.stringify(recent.data).slice(0,200)}`)
  }
})().catch(e => { console.error(e.message); process.exit(1) })
