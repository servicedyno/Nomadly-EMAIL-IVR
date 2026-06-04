#!/usr/bin/env node
/**
 * Bisect Contabo POST /compute/instances payloads to identify what triggers 500.
 *
 * Strategy: from inside the existing apiRequest helper, hit Contabo with
 * progressively richer payloads until either we succeed OR we figure out
 * which field flips us from 4xx to 5xx.
 */

require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')
const { v4: uuidv4 } = require('uuid')
const contabo = require('../contabo-service.js')

const SLEEP = ms => new Promise(r => setTimeout(r, ms))

async function rawCreate(body, label) {
  const token = await contabo.getAccessToken()
  const requestId = uuidv4()
  console.log(`\n=== ${label} ===`)
  console.log(`payload: ${JSON.stringify(body)}`)
  console.log(`x-request-id: ${requestId}`)
  try {
    const res = await axios.post(
      'https://api.contabo.com/v1/compute/instances',
      body,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-request-id': requestId,
          'Content-Type': 'application/json'
        },
        timeout: 60000,
        validateStatus: () => true   // never throw, we want the raw response
      }
    )
    console.log(`HTTP ${res.status}`)
    console.log(`body:`, JSON.stringify(res.data, null, 2))
    return { status: res.status, data: res.data }
  } catch (err) {
    console.log(`NETWORK error: ${err.message}`)
    return { status: 'network', data: err.message }
  }
}

async function main() {
  // 1) Get a valid linux image id so we know we're not using a deprecated one.
  console.log('Fetching live linux images …')
  const linuxImages = await contabo.listImages('linux')
  const ubuntu24 = linuxImages.find(i => i.name === 'ubuntu-24.04')
                  || linuxImages.find(i => i.name === 'ubuntu-22.04')
                  || linuxImages[0]
  if (!ubuntu24) { console.log('No linux image available – abort'); return }
  console.log(`Using linuxImage = ${ubuntu24.name} (${ubuntu24.imageId})`)

  // 2) Make sure account auth works
  const me = await contabo.healthCheck()
  console.log('healthCheck:', me)

  // 3) Walk a series of payloads
  const productId = 'V92'   // Cloud VPS 10 SSD — cheapest tier
  const region    = 'EU'

  // Test 1: bare minimum (no region) — many Contabo example payloads omit region
  await rawCreate({
    imageId:   ubuntu24.imageId,
    productId,
    period:    1
  }, 'A: minimal — no region')
  await SLEEP(2000)

  // Test 2: add region
  await rawCreate({
    imageId:   ubuntu24.imageId,
    productId,
    region,
    period:    1
  }, 'B: + region=EU')
  await SLEEP(2000)

  // Test 3: + displayName
  await rawCreate({
    imageId:   ubuntu24.imageId,
    productId,
    region,
    period:    1,
    displayName: 'bisect-test'
  }, 'C: + displayName')
  await SLEEP(2000)

  // Test 4: + defaultUser=admin (newer Contabo API examples include this)
  await rawCreate({
    imageId:   ubuntu24.imageId,
    productId,
    region,
    period:    1,
    displayName: 'bisect-test',
    defaultUser: 'admin'
  }, 'D: + defaultUser=admin')
  await SLEEP(2000)

  // Test 5: a password secret (real user flow always has one)
  const secret = await contabo.createSecret(
    `bisect-pwd-${Date.now()}`,
    'BisectTest_' + Math.random().toString(36).slice(2, 10) + '!',
    'password'
  )
  console.log('Created password secret:', secret.secretId)

  await rawCreate({
    imageId:      ubuntu24.imageId,
    productId,
    region,
    period:       1,
    displayName:  'bisect-test',
    rootPassword: secret.secretId
  }, 'E: + rootPassword (secretId)')
  await SLEEP(2000)

  // Test 6: + addons:[] (some examples include empty addons)
  await rawCreate({
    imageId:      ubuntu24.imageId,
    productId,
    region,
    period:       1,
    displayName:  'bisect-test',
    rootPassword: secret.secretId,
    addOns:       []
  }, 'F: + addOns:[]')
  await SLEEP(2000)

  // Test 7: license: null (some old examples include)
  await rawCreate({
    imageId:      ubuntu24.imageId,
    productId,
    region,
    period:       1,
    displayName:  'bisect-test',
    rootPassword: secret.secretId,
    license:      null
  }, 'G: + license=null')
  await SLEEP(2000)

  // Cleanup secret
  try { await contabo.deleteSecret(secret.secretId) } catch (e) { console.log('cleanup err', e.message) }
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
