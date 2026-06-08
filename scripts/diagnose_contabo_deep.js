#!/usr/bin/env node
/**
 * Deep diagnostic for Contabo HTTP 500 on POST /compute/instances.
 * - Capture full response headers (trace IDs etc.)
 * - Try minimal payload (no defaultUser, no period) to rule out body-shape issue
 * - Try with non-default period (12 months) — sometimes provisioning is restricted
 * - Hit /compute/quotas to see if there's a hidden account limit
 * - Check upcoming instance limits, billing state via /users/client
 * - Compare with a brand-new image lookup (in case the stored UUID is stale)
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
  const xReqId = crypto.randomUUID()
  const headers = {
    Authorization: `Bearer ${t}`,
    'x-request-id': xReqId,
    ...extraHeaders,
  }
  try {
    const r = await axios({ method, url: API_BASE + path, data, headers, timeout: 25000 })
    return { status: r.status, ok: true, data: r.data, headers: r.headers, xReqId }
  } catch (e) {
    return {
      status: e.response?.status || 0,
      ok: false,
      data: e.response?.data || { message: e.message },
      headers: e.response?.headers || {},
      xReqId,
    }
  }
}

;(async () => {
  console.log('=== Step A: minimal payload (no defaultUser, no period) ===')
  const minimalPayload = {
    productId: 'V91',
    region: 'EU',
    imageId: '1a5471c8-06f6-40cd-aff1-e946f72235a8',
  }
  const a = await call('POST', '/compute/instances', minimalPayload)
  console.log(`  HTTP ${a.status}  xReqId=${a.xReqId}`)
  console.log('  response headers:', JSON.stringify({
    'x-trace-id': a.headers['x-trace-id'],
    'x-request-id': a.headers['x-request-id'],
    'cf-ray': a.headers['cf-ray'],
    'server': a.headers['server'],
    'date': a.headers['date'],
  }, null, 2))
  console.log('  response body:', JSON.stringify(a.data, null, 2))

  console.log('\n=== Step B: lookup a fresh Ubuntu image to ensure imageId is still valid ===')
  const imgList = await call('GET', '/compute/images?size=20&standardImage=true')
  if (imgList.ok) {
    const ubuntu = (imgList.data?.data || []).filter(i => i.name?.toLowerCase().includes('ubuntu'))
    console.log(`  ${ubuntu.length} ubuntu images available:`)
    ubuntu.slice(0, 5).forEach(i => console.log(`    ${i.imageId}  ${i.name}  format=${i.format}  status=${i.status}`))

    // Use the freshest Ubuntu image (the one we know is supposed to work)
    if (ubuntu.length) {
      const freshImage = ubuntu[0].imageId
      console.log(`\n=== Step C: retry CREATE with freshest Ubuntu image ${freshImage} ===`)
      const c = await call('POST', '/compute/instances', {
        productId: 'V91', region: 'EU', imageId: freshImage, period: 1,
      })
      console.log(`  HTTP ${c.status}  xReqId=${c.xReqId}`)
      console.log('  body:', JSON.stringify(c.data).slice(0, 300))
    }
  } else {
    console.log(`  FAILED to list images: HTTP ${imgList.status}`)
  }

  console.log('\n=== Step D: check account / user state (/users/client/me, /tenants) ===')
  for (const p of ['/users/client', '/users/client/me', '/users/me', '/users/client?size=1', '/tenants', '/billing/info']) {
    const r = await call('GET', p)
    const body = r.ok ? JSON.stringify(r.data).slice(0, 250) : (r.data?.message || JSON.stringify(r.data).slice(0, 200))
    console.log(`  ${r.ok ? '✓' : '✗'} GET ${p.padEnd(28)} HTTP ${r.status}  ${body}`)
  }

  console.log('\n=== Step E: try period=12 instead of 1 (account discount tiers sometimes restrict provisioning) ===')
  const p12 = await call('POST', '/compute/instances', {
    productId: 'V91', region: 'EU',
    imageId: '1a5471c8-06f6-40cd-aff1-e946f72235a8',
    period: 12,
  })
  console.log(`  HTTP ${p12.status}  xReqId=${p12.xReqId}  body:`, JSON.stringify(p12.data).slice(0, 300))

  console.log('\n=== Step F: check if recent instances were created via API or panel ===')
  const recent = await call('GET', '/compute/instances?size=10&orderBy=createdDate:desc')
  if (recent.ok) {
    const items = recent.data?.data || []
    items.forEach(i => console.log(`  ${i.instanceId}  ${i.name}  created=${i.createdDate}  status=${i.status}  region=${i.region}  productId=${i.productId}`))
    const newestDate = items[0]?.createdDate
    if (newestDate) {
      const ageDays = (Date.now() - new Date(newestDate).getTime()) / 86400000
      console.log(`  >> Newest instance is ${ageDays.toFixed(1)} days old`)
    }
  }

  console.log('\n=== Step G: check for any "limit reached" hints via list with various filters ===')
  const limCheck = await call('GET', '/compute/instances?size=1&status=provisioning')
  console.log(`  provisioning count: HTTP ${limCheck.status}  ${JSON.stringify(limCheck.data).slice(0, 200)}`)
})().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
