/* eslint-disable no-empty */
/**
 * vultr-service.js — Vultr VPS provider implementation.
 *
 * Mirrors the surface of contabo-service.js so the existing
 * vps-provider.js abstraction can route to Vultr via `VPS_DEFAULT_PROVIDER=vultr`
 * or per-record routing on `provider === 'vultr'`.
 *
 * Highlights vs Contabo/OVH:
 *   • No per-region surcharge — Vultr prices are flat across 33 regions.
 *   • Windows licence is BUNDLED in the plan price (no extra Windows fee).
 *   • RDP works out of the box on every Windows image (port 3389, admin
 *     password returned in `instance.default_password`).
 *   • Heads-up: Vultr is materially more expensive than Contabo at
 *     comparable specs (7-11× depending on tier). Treat as PREMIUM tier.
 *
 * Docs: https://www.vultr.com/api/
 */

'use strict'
require('dotenv').config()
const axios = require('axios')

const API_KEY     = process.env.VULTR_API_KEY || ''
const API_BASE    = 'https://api.vultr.com/v2'
const MARKUP_PERCENT = parseFloat(process.env.VPS_MARKUP_PERCENT || '200')
// Vultr bundles Windows licence in the plan price — no extra fee.
const WINDOWS_LICENSE_BY_TIER = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }

const PROVIDER = 'vultr'

const log = (...a) => console.log('[Vultr]', ...a)

const http = axios.create({
  baseURL: API_BASE,
  timeout: 20000,
  headers: {
    Authorization: `Bearer ${API_KEY}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
})

// ─── Circuit breaker ─────────────────────────────────────────────────────
const _circuit = { failures: 0, lastFailureAt: null, lastSuccessAt: null }
const _CIRCUIT_THRESHOLD = 5  // 5 consecutive failures opens the circuit
const _CIRCUIT_COOLDOWN_MS = 5 * 60 * 1000  // 5 minutes
const _onOpenCallbacks = []

function _trackCreateResult(ok, err) {
  if (ok) {
    _circuit.failures = 0
    _circuit.lastSuccessAt = new Date()
  } else {
    _circuit.failures++
    _circuit.lastFailureAt = new Date()
    if (_circuit.failures >= _CIRCUIT_THRESHOLD) {
      log(`Circuit opened after ${_circuit.failures} failures. Last error: ${err?.message || err}`)
      for (const cb of _onOpenCallbacks) {
        try { cb({ failures: _circuit.failures, lastError: err }) } catch (_) {}
      }
    }
  }
}

function isProvisioningHealthy() {
  if (_circuit.failures < _CIRCUIT_THRESHOLD) return true
  if (!_circuit.lastFailureAt) return true
  return (Date.now() - _circuit.lastFailureAt.getTime()) > _CIRCUIT_COOLDOWN_MS
}

function getCircuitState() {
  return {
    healthy: isProvisioningHealthy(),
    failures: _circuit.failures,
    lastFailureAt: _circuit.lastFailureAt,
    lastSuccessAt: _circuit.lastSuccessAt,
  }
}

function resetProvisioningCircuit() {
  _circuit.failures = 0
  _circuit.lastFailureAt = null
  log('Circuit manually reset')
}

function onProvisioningCircuitOpen(cb) {
  if (typeof cb === 'function') _onOpenCallbacks.push(cb)
}

// ─── Low-level HTTP ──────────────────────────────────────────────────────
async function apiRequest(method, path, data = null, params = null) {
  if (!API_KEY) {
    const err = new Error('VULTR_API_KEY not configured')
    throw err
  }
  try {
    const resp = await http.request({ method, url: path, data: data || undefined, params: params || undefined })
    return resp.data
  } catch (err) {
    const status = err.response?.status
    const reason = err.response?.data?.error || err.response?.data || err.message
    const wrappedErr = new Error(`Vultr ${method} ${path} failed (${status}): ${typeof reason === 'string' ? reason : JSON.stringify(reason)}`)
    wrappedErr.status = status
    wrappedErr.responseBody = err.response?.data
    throw wrappedErr
  }
}

// ─── Product Catalog (Option A — price-matched, RDP-viable from tier 1) ──
// Customer-facing names use neutral "Premium Cloud VPS" branding so the
// provider identity stays hidden — same UX policy as Contabo's "Cloud VPS".
//
// Vultr is flat-priced across all 9 regions (no surcharge). Windows licence
// is bundled in the plan price (no extra fee).
const PRODUCT_CATALOG = [
  {
    productId:   'vc2-1c-2gb',
    name:        'Premium Cloud VPS 10',
    cpuCores:    1, ramMb: 2048, diskMb: 55 * 1024,
    diskType:    'nvme', bandwidthTb: 2,
    portSpeedMbps: 10000, basePriceUsd: 10.0, tier: 1,
  },
  {
    productId:   'vc2-2c-2gb',
    name:        'Premium Cloud VPS 20',
    cpuCores:    2, ramMb: 2048, diskMb: 65 * 1024,
    diskType:    'nvme', bandwidthTb: 3,
    portSpeedMbps: 10000, basePriceUsd: 15.0, tier: 2,
  },
  {
    productId:   'vc2-2c-4gb',
    name:        'Premium Cloud VPS 30',
    cpuCores:    2, ramMb: 4096, diskMb: 80 * 1024,
    diskType:    'nvme', bandwidthTb: 3,
    portSpeedMbps: 10000, basePriceUsd: 24.0, tier: 3,
  },
  {
    productId:   'vc2-4c-8gb',
    name:        'Premium Cloud VPS 40',
    cpuCores:    4, ramMb: 8192, diskMb: 160 * 1024,
    diskType:    'nvme', bandwidthTb: 4,
    portSpeedMbps: 10000, basePriceUsd: 40.0, tier: 4,
  },
  {
    productId:   'vc2-6c-16gb',
    name:        'Premium Cloud VPS 50',
    cpuCores:    6, ramMb: 16384, diskMb: 320 * 1024,
    diskType:    'nvme', bandwidthTb: 5,
    portSpeedMbps: 10000, basePriceUsd: 80.0, tier: 5,
  },
  {
    productId:   'vc2-8c-32gb',
    name:        'Premium Cloud VPS 60',
    cpuCores:    8, ramMb: 32768, diskMb: 640 * 1024,
    diskType:    'nvme', bandwidthTb: 6,
    portSpeedMbps: 10000, basePriceUsd: 160.0, tier: 6,
  },
]

// Vultr is flat-priced across all regions — surcharge is 0 for every tier.
const REGION_SURCHARGE = {
  // Same set of region slugs as Contabo for cross-provider customer UX.
  // Internally these map to Vultr region IDs (see REGION_TO_VULTR_ID).
  'EU':         [0, 0, 0, 0, 0, 0],
  'US-central': [0, 0, 0, 0, 0, 0],
  'US-east':    [0, 0, 0, 0, 0, 0],
  'US-west':    [0, 0, 0, 0, 0, 0],
  'UK':         [0, 0, 0, 0, 0, 0],
  'SG':         [0, 0, 0, 0, 0, 0],
  'JP':         [0, 0, 0, 0, 0, 0],
  'AU':         [0, 0, 0, 0, 0, 0],
  'IN':         [0, 0, 0, 0, 0, 0],
}

const REGION_DISPLAY = {
  'EU':         { emoji: '🇪🇺', label: 'Europe (EU)' },
  'US-central': { emoji: '🇺🇸', label: 'US Central' },
  'US-east':    { emoji: '🇺🇸', label: 'US East' },
  'US-west':    { emoji: '🇺🇸', label: 'US West' },
  'UK':         { emoji: '🇬🇧', label: 'United Kingdom' },
  'SG':         { emoji: '🇸🇬', label: 'Singapore' },
  'JP':         { emoji: '🇯🇵', label: 'Japan' },
  'AU':         { emoji: '🇦🇺', label: 'Australia' },
  'IN':         { emoji: '🇮🇳', label: 'India' },
}

// Customer-facing region slug → Vultr region ID.
const REGION_TO_VULTR_ID = {
  'EU':         'fra',   // Frankfurt
  'US-central': 'ord',   // Chicago
  'US-east':    'ewr',   // New Jersey
  'US-west':    'lax',   // Los Angeles
  'UK':         'lhr',   // London
  'SG':         'sgp',   // Singapore
  'JP':         'nrt',   // Tokyo
  'AU':         'syd',   // Sydney
  'IN':         'bom',   // Mumbai
}

// ─── Pricing ─────────────────────────────────────────────────────────────
function applyMarkup(basePrice) {
  return Math.round(basePrice * (1 + MARKUP_PERCENT / 100) * 100) / 100
}

function calculatePrice(product, regionSlug, isWindows = false) {
  const base         = product.basePriceUsd
  const tier         = product.tier || 1
  const surchargeArr = REGION_SURCHARGE[regionSlug]
  if (!surchargeArr) return null
  const surcharge    = surchargeArr[tier - 1] ?? 0
  const windowsFee   = isWindows ? (WINDOWS_LICENSE_BY_TIER[tier] || 0) : 0
  const totalBefore  = base + surcharge + windowsFee
  const totalMarkup  = applyMarkup(totalBefore)
  return {
    basePriceUsd:      base,
    regionSurcharge:   surcharge,
    windowsLicense:    windowsFee,
    totalBeforeMarkup: Math.round(totalBefore * 100) / 100,
    totalWithMarkup:   totalMarkup,
    markupPercent:     MARKUP_PERCENT,
  }
}

// ─── Products / catalog ──────────────────────────────────────────────────
// Vultr has no SSD-vs-NVMe choice (all plans are NVMe), so the catalog
// is exposed BOTH as PRODUCT_CATALOG and as PRODUCT_CATALOG_SSD (alias)
// to satisfy vm-instance-setup.js which sometimes branches on disk type.
const PRODUCT_CATALOG_SSD = PRODUCT_CATALOG

function listProducts(regionSlug = 'EU', isWindows = false, _diskPreference = 'nvme') {
  // _diskPreference is accepted for API parity with contabo-service but
  // ignored — every Vultr plan is NVMe.
  return PRODUCT_CATALOG
    .map(p => {
      const pricing = calculatePrice(p, regionSlug, isWindows)
      if (!pricing) return null
      return {
        ...p,
        ramGb:  Math.round(p.ramMb / 1024),
        diskGb: Math.round(p.diskMb / 1024),
        pricing,
      }
    })
    .filter(Boolean)
}

function getProduct(productId) {
  return PRODUCT_CATALOG.find(p => p.productId === productId) || null
}

async function listRegions() {
  // Shape-compatible with contabo-service.js + ovh-service.js so the consumer
  // (vm-instance-setup.js) can use the same `r.display.{emoji,label}` and
  // `r.regionSlug` properties regardless of provider. Don't change the shape
  // without updating BOTH this file AND fetchAvailableCountries /
  // fetchAvailableRegionsOfCountry in vm-instance-setup.js — the consumer
  // crash there (Cannot read .display.emoji) was the prod blocker on
  // 2026-06-23 that killed every RDP purchase after VPS_DEFAULT_PROVIDER=vultr.
  return Object.entries(REGION_DISPLAY).map(([slug, info]) => ({
    regionSlug:   slug,
    regionName:   info.label,
    dataCenters:  [{ name: info.label, slug }],
    surchargeUsd: REGION_SURCHARGE[slug] || [0, 0, 0, 0, 0, 0],
    display:      info,
    vultrId:      REGION_TO_VULTR_ID[slug],
    // Legacy flat fields preserved for any existing consumer that read them
    slug,
    emoji:        info.emoji,
    label:        info.label,
  }))
}

// ─── Images / OS ─────────────────────────────────────────────────────────
// Shape-compatible with contabo-service.js + ovh-service.js. The consumer
// (vm-instance-setup.js fetchAvailableOS) expects `imageId`, `name`, `osType`,
// `version`, `isWindows` — Vultr's /os endpoint returns `id`, `name`, `family`,
// `arch` so we normalize here.
async function listImages(filter = 'all') {
  // Filter: 'all' | 'linux' | 'windows'
  const d = await apiRequest('GET', '/os')
  let list = d.os || []
  if (filter === 'windows') list = list.filter(o => /windows/i.test(o.family || o.name || ''))
  else if (filter === 'linux') list = list.filter(o => !/windows/i.test(o.family || o.name || ''))
  return list.map(o => {
    const isWindows = /windows/i.test(o.family || o.name || '')
    return {
      imageId:   o.id,
      name:      o.name,
      osType:    isWindows ? 'Windows' : 'Linux',
      version:   o.name,
      isWindows,
      // legacy flat fields preserved
      id:        o.id,
      family:    o.family,
      arch:      o.arch,
    }
  })
}

// Sensible Windows default for a tier — Vultr ships Server 2022 STD on every tier.
async function getDefaultWindowsImageId(_productId) {
  return 501  // Windows 2022 Standard x64
}

async function getCompatibleWindowsImage(imageId, _targetProductId) {
  // Vultr Windows images work on all plans with ≥2GB RAM (every tier qualifies).
  return imageId
}

async function getCompatibleLinuxImage(currentImageId, _productId) {
  return currentImageId
}

// ─── Instances ───────────────────────────────────────────────────────────
//
// Vultr's API has a different mental model than Contabo's:
//   • Contabo separates `createSecret('password', value)` (returns secretId)
//     from `createInstance({ rootPassword: secretId })`. The bot is hard-wired
//     to that 2-step pattern.
//   • Vultr just generates `default_password` automatically on createInstance,
//     OR accepts a plain `password` string.
//
// To make Vultr a drop-in replacement, we simulate the secret-id pattern: the
// bot calls `createSecret(name, value, 'password')` → we cache the password
// in-memory keyed by a fake `secretId` and return that id. When the bot later
// calls `createInstance({ rootPassword: <secretId> })` or
// `reinstallInstance({ rootPassword: <secretId> })`, we look the password up
// from the cache and forward it inline to Vultr's API.
//
// Cache lives only in-process — same lifecycle as Contabo's secrets in
// practice, since the bot creates → consumes secrets within the same async
// function (vm-instance-setup.js:587-660 / _index.js:17392-17401).
const _passwordSecrets = new Map()  // fakeSecretId → { password, name, createdAt }

function _isFakePasswordSecretId(id) {
  return typeof id === 'string' && id.startsWith('vultr-pwd-')
}

/**
 * Helper: accept either a fake-secret-id (from createSecret('password',…))
 * or a raw password string. Returns the raw password to pass to Vultr's API.
 */
function _resolvePasswordSecret(secretIdOrPassword) {
  if (!secretIdOrPassword) return null
  if (_isFakePasswordSecretId(secretIdOrPassword)) {
    const cached = _passwordSecrets.get(secretIdOrPassword)
    if (cached?.password) return cached.password
  }
  // Treat as raw password
  return String(secretIdOrPassword)
}

/**
 * Helper: detect whether a string is already-base64. We can't be 100% sure,
 * but a string that decodes cleanly back to printable text is almost
 * certainly already encoded. The bot pre-base64s userData scripts before
 * calling createInstance (matching Contabo's convention).
 */
function _isLikelyBase64(s) {
  if (typeof s !== 'string' || !s) return false
  // Base64 alphabet only + length is multiple of 4
  if (!/^[A-Za-z0-9+/=\r\n]+$/.test(s)) return false
  if (s.replace(/[\r\n]/g, '').length % 4 !== 0) return false
  try {
    const decoded = Buffer.from(s, 'base64').toString('utf-8')
    // Round-trip must reconstruct (allowing for line-break differences)
    const reEncoded = Buffer.from(decoded, 'utf-8').toString('base64')
    return reEncoded.replace(/[\r\n]/g, '') === s.replace(/[\r\n]/g, '')
  } catch { return false }
}

/**
 * Create a Vultr VPS instance.
 *
 * Accepts BOTH the native Vultr param names AND the bot's existing
 * Contabo-style names so the same `vm-instance-setup.js createVPSInstance`
 * call works on either provider. Aliases:
 *   regionSlug   ← region
 *   osId         ← imageId
 *   label        ← displayName
 *   sshKeyIds    ← sshKeys
 *   password     ← rootPassword (resolved from fake-secret-id if needed)
 */
async function createInstance(opts) {
  const o = opts || {}
  // Accept legacy Contabo-style aliases for cross-provider compatibility.
  const productId   = o.productId
  const regionSlug  = o.regionSlug || o.region
  const osId        = o.osId       || o.imageId
  const label       = o.label      || o.displayName || `vps-${Date.now().toString(36)}`
  const tag         = o.tag        || null
  const sshKeyIds   = o.sshKeyIds  || o.sshKeys || null
  const userDataIn  = o.userData   || null
  const password    = _resolvePasswordSecret(o.password || o.rootPassword)

  if (!productId || !regionSlug || !osId) {
    throw new Error(`createInstance requires { productId, regionSlug, osId } — got productId=${productId} regionSlug=${regionSlug} osId=${osId}`)
  }
  const region = REGION_TO_VULTR_ID[regionSlug]
  if (!region) throw new Error(`Unknown region slug: ${regionSlug}`)

  // userData: bot pre-base64s scripts (matches Contabo convention). If we
  // detect already-base64, pass it through verbatim. Otherwise encode here.
  let userDataB64 = null
  if (userDataIn) {
    userDataB64 = _isLikelyBase64(userDataIn)
      ? userDataIn
      : Buffer.from(userDataIn, 'utf-8').toString('base64')
  }

  const body = {
    region,
    plan:  productId,
    os_id: typeof osId === 'string' && /^\d+$/.test(osId) ? parseInt(osId, 10) : osId,
    label,
    enable_ipv6: false,
    backups: 'disabled',
  }
  if (tag) body.tag = tag
  if (Array.isArray(sshKeyIds) && sshKeyIds.length) body.sshkey_id = sshKeyIds
  if (userDataB64) body.user_data = userDataB64
  if (password) body.password = password // Vultr accepts a raw `password` field

  try {
    const data = await apiRequest('POST', '/instances', body)
    const inst = data.instance || {}
    _trackCreateResult(true)
    return {
      instanceId:      inst.id,
      mainIp:          inst.main_ip || null,
      defaultPassword: inst.default_password || password || null,
      status:          inst.status,
      raw:             inst,
    }
  } catch (err) {
    _trackCreateResult(false, err)
    throw err
  }
}

async function getInstance(instanceId) {
  const data = await apiRequest('GET', `/instances/${instanceId}`)
  const inst = data.instance || null
  if (!inst) return null
  return {
    instanceId:      inst.id,
    mainIp:          inst.main_ip || null,
    defaultPassword: inst.default_password || null,
    status:          inst.status,
    powerStatus:     inst.power_status,
    serverStatus:    inst.server_status,
    region:          inst.region,
    plan:            inst.plan,
    osId:            inst.os_id,
    label:           inst.label,
    tag:             inst.tag,
    dateCreated:     inst.date_created,
    // Cross-provider compatibility shims so consumers reading Contabo-style
    // fields (`ipConfig.v4.ip`, `ipv4`) get the right value on Vultr too.
    ipConfig:        { v4: { ip: inst.main_ip || null }, v6: { ip: inst.v6_main_ip || null } },
    ipv4:            inst.main_ip || null,
    raw:             inst,
  }
}

async function listInstances(filters = {}) {
  const params = {}
  if (filters.tag) params.tag = filters.tag
  if (filters.label) params.label = filters.label
  const data = await apiRequest('GET', '/instances', null, params)
  return (data.instances || []).map(i => ({
    instanceId: i.id, mainIp: i.main_ip, status: i.status,
    region: i.region, plan: i.plan, label: i.label, tag: i.tag,
    raw: i,
  }))
}

async function startInstance(instanceId)   { return apiRequest('POST', `/instances/${instanceId}/start`) }
async function stopInstance(instanceId)    { return apiRequest('POST', `/instances/${instanceId}/halt`) }
async function restartInstance(instanceId) { return apiRequest('POST', `/instances/${instanceId}/reboot`) }
async function shutdownInstance(instanceId){ return apiRequest('POST', `/instances/${instanceId}/halt`) }

/**
 * Reset the root/admin password for a Vultr instance.
 *
 * Cross-provider contract (matches Contabo / OVH return shape):
 *   → { password, secretId, reinstalled, note }
 *
 * Vultr has no in-place password change endpoint — we have to /reinstall to
 * get a new admin password. That destroys data, but matches Contabo's
 * resetPassword semantics for non-root Linux + Windows.
 */
async function resetPassword(instanceId, opts = {}) {
  const data = await apiRequest('POST', `/instances/${instanceId}/reinstall`, {})
  const inst = data.instance || {}
  const newPassword = inst.default_password || null

  // Cache as a fake secret so the caller can store the secretId for tracking
  // (matches Contabo's flow where resetPassword returns a real secretId).
  let secretId = null
  if (newPassword) {
    secretId = `vultr-pwd-${instanceId}-${Date.now().toString(36)}`
    _passwordSecrets.set(secretId, { password: newPassword, name: secretId, createdAt: Date.now() })
  }

  const isRDP = opts.isRDP || opts.osType === 'Windows'
  return {
    password:    newPassword,         // bot UX shape (not `newPassword`)
    newPassword: newPassword,         // legacy alias kept for direct callers
    secretId,
    reinstalled: true,                // Vultr always reinstalls on password reset
    note:        isRDP
      ? 'Vultr reinstalled the Windows image to apply a new Administrator password.'
      : 'Vultr reinstalled the OS to apply a new root password. SSH keys still attached.',
    raw: inst,
  }
}

/**
 * Reinstall an instance.
 *
 * Cross-provider contract — accepts the bot's existing call signature:
 *   { imageId, rootPassword, sshKeys, userData, osType, isRDP }
 *
 * `imageId` = OS id (Vultr uses `os_id`). Password is resolved from the
 * fake-secret cache if needed. SSH keys + userData are best-effort: Vultr's
 * /reinstall doesn't accept them at the same call (the new instance gets the
 * same SSH keys it was originally created with), so we accept them silently
 * for interface parity.
 */
async function reinstallInstance(instanceId, opts = {}) {
  const body = {}
  const osId = opts.osId || opts.imageId
  if (osId) {
    body.os_id = typeof osId === 'string' && /^\d+$/.test(osId)
      ? parseInt(osId, 10)
      : osId
  }
  // hostname / label changes can be supplied at reinstall time too
  if (opts.hostname) body.hostname = opts.hostname

  // Note: Vultr does NOT accept password / user_data / sshkey_id on reinstall.
  // The new password is regenerated automatically. The bot expects to be able
  // to set the password — so AFTER the reinstall we extract the new
  // default_password and cache it under the bot-provided secret id (if any).
  const data = await apiRequest('POST', `/instances/${instanceId}/reinstall`, body)
  const inst = data.instance || {}
  const newPassword = inst.default_password || null
  const cached = _resolvePasswordSecret(opts.password || opts.rootPassword)
  if (newPassword && opts.rootPassword && _isFakePasswordSecretId(opts.rootPassword)) {
    // Update cache so subsequent reads of this secretId reflect the new password
    _passwordSecrets.set(opts.rootPassword, {
      password: newPassword, name: opts.rootPassword, createdAt: Date.now(),
    })
  }
  return {
    instanceId,
    password: newPassword || cached || null,
    raw: inst,
  }
}

/**
 * Cancel/delete a Vultr instance.
 *
 * IMPORTANT: Vultr has only IMMEDIATE delete (DELETE /instances/{id}). It
 * does NOT support Contabo's "cancel-on-end-of-period" model.
 *
 * The bot uses `cancelInstance` in two distinct contexts:
 *   1. End-of-life: user clicked "Delete VPS" or scheduler cleanup → we
 *      DO want a real DELETE. (default behaviour)
 *   2. Cancel-on-create: right after createInstance to disable provider
 *      auto-renew while keeping the box running. On Vultr this would
 *      DESTROY the just-created VPS — must be a no-op.
 *
 * Pass `opts.scheduleOnly: true` (cancel-on-create) → no API call, returns
 * { success: true, scheduleOnly: true, note: ... }.
 *
 * Default: real DELETE.
 */
async function cancelInstance(instanceId, opts = {}) {
  if (opts.scheduleOnly) {
    log(`scheduleOnly cancel requested for ${instanceId} — no-op (Vultr has no scheduled cancel; track via vpsPlansOf.autoRenewable=false instead)`)
    return { success: true, scheduleOnly: true, note: 'Vultr has no scheduled cancellation; instance keeps running until DB-driven scheduler decides to expire it.' }
  }
  return apiRequest('DELETE', `/instances/${instanceId}`)
}

async function upgradeInstance(instanceId, newProductId) {
  // Vultr supports plan upgrade via PATCH /instances/{id} with `plan`
  return apiRequest('PATCH', `/instances/${instanceId}`, { plan: newProductId })
}

async function updateInstanceName(instanceId, displayName) {
  return apiRequest('PATCH', `/instances/${instanceId}`, { label: displayName })
}

// ─── Snapshots ───────────────────────────────────────────────────────────
async function createSnapshot(instanceId, name, description = '') {
  return apiRequest('POST', '/snapshots', {
    instance_id: instanceId,
    description: name + (description ? ` — ${description}` : ''),
  })
}

async function listSnapshots(instanceId) {
  const data = await apiRequest('GET', '/snapshots')
  const all = data.snapshots || []
  return instanceId ? all.filter(s => s.instance_id === instanceId) : all
}

async function deleteSnapshot(_instanceId, snapshotId) {
  return apiRequest('DELETE', `/snapshots/${snapshotId}`)
}

// ─── Tags ────────────────────────────────────────────────────────────────
// Vultr tags are simple strings attached at instance create time —
// no separate create endpoint. Provided as no-ops for interface parity.
async function createTag(_name, _color) { return { id: _name } }
async function listTags() {
  const data = await apiRequest('GET', '/instances?per_page=500')
  const tags = new Set()
  for (const i of (data.instances || [])) if (i.tag) tags.add(i.tag)
  return Array.from(tags).map(t => ({ name: t }))
}

// ─── Secrets / SSH keys ──────────────────────────────────────────────────
//
// Cross-provider parity: Contabo has a unified /secrets endpoint that accepts
// both 'password' and 'ssh' types. Vultr only has /ssh-keys. To make Vultr
// look like Contabo to the bot, we:
//   • type='ssh'      → real /ssh-keys API call (returns { secretId, name })
//   • type='password' → cache locally and return a fake `vultr-pwd-...` id
//                       so callers can pass it as `rootPassword`/`password`
//                       to createInstance/reinstallInstance/resetPassword
//                       and we transparently resolve it at use time.
async function createSecret(name, value, type = 'ssh') {
  if (type === 'password') {
    // Simulate Contabo's password-secret model in-process.
    const secretId = `vultr-pwd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    _passwordSecrets.set(secretId, { password: value, name, createdAt: Date.now() })
    return { secretId, id: secretId, name, type: 'password' }
  }
  if (type !== 'ssh') throw new Error(`Vultr createSecret: unsupported type "${type}" (only 'ssh' and 'password')`)
  const data = await apiRequest('POST', '/ssh-keys', { name, ssh_key: value })
  // Match Contabo's `secretId` field name so vm-instance-setup.js works
  // unchanged — `passwordSecret.secretId` access points at line 763.
  return {
    secretId: data.ssh_key?.id,
    id:       data.ssh_key?.id,
    name:     data.ssh_key?.name,
    type:     'ssh',
  }
}

async function listSecrets(_type = null) {
  const data = await apiRequest('GET', '/ssh-keys')
  return (data.ssh_keys || []).map(k => ({ id: k.id, secretId: k.id, name: k.name }))
}

async function getSecret(secretId) {
  if (_isFakePasswordSecretId(secretId)) {
    const cached = _passwordSecrets.get(secretId)
    return cached ? { id: secretId, name: cached.name, type: 'password' } : null
  }
  const data = await apiRequest('GET', `/ssh-keys/${secretId}`)
  return data.ssh_key || null
}

async function deleteSecret(secretId) {
  if (_isFakePasswordSecretId(secretId)) {
    _passwordSecrets.delete(secretId)
    return { success: true }
  }
  return apiRequest('DELETE', `/ssh-keys/${secretId}`)
}

// ─── Helpers ─────────────────────────────────────────────────────────────
function isNVMeProduct(_productId) { return true }  // Every Vultr plan is NVMe
function isSSDProduct(_productId)  { return false }

/**
 * Format specs for display message — shape-compatible with contabo-service.js
 * + ovh-service.js. Consumer: vm-instance-setup.js fetchAvailableVPSConfigs().
 */
function formatSpecs(product) {
  const ramGb  = product.ramGb  || Math.round((product.ramMb  || 0) / 1024)
  const diskGb = product.diskGb || Math.round((product.diskMb || 0) / 1024)
  const dt     = (product.diskType || 'nvme').toUpperCase()
  return `${product.cpuCores} vCPU | ${ramGb} GB RAM | ${diskGb} GB ${dt}`
}

/**
 * Format instance data for display in the Telegram bot.
 * Shape-compatible with contabo-service.js + ovh-service.js. Vultr instances
 * come back from /instances/{id} with snake_case fields, so we adapt here.
 */
function formatInstanceForDisplay(instance) {
  const ip     = instance.mainIp || instance.main_ip || instance.ip || 'Provisioning...'
  const ipv6   = instance.v6_main_ip || instance.ipv6 || ''
  const ramMb  = instance.ramMb  || instance.ram     || 0
  const diskMb = instance.diskMb || instance.disk    || 0
  const ramGb  = Math.round(ramMb / 1024)
  const diskGb = Math.round(diskMb / 1024)
  const osType = instance.osType || (/windows/i.test(instance.os || '') ? 'Windows' : 'Linux')
  const region = instance.region || ''
  const product = getProduct(instance.productId || instance.plan)
  const statusEmoji = {
    running:      '🟢',
    active:       '🟢',
    stopped:      '🔴',
    halted:       '🔴',
    provisioning: '🟡',
    pending:      '🟡',
    installing:   '🟡',
    error:        '❌',
    unknown:      '⚪',
  }
  const status = (instance.status || instance.power_status || 'unknown').toLowerCase()
  return {
    instanceId:   instance.instanceId || instance.id,
    name:         instance.displayName || instance.label || instance.name,
    status,
    statusEmoji:  statusEmoji[status] || '⚪',
    ip,
    ipv6,
    region,
    regionName:   REGION_DISPLAY[region]?.label || region,
    productId:    instance.productId || instance.plan,
    productName:  product?.name || instance.productName || instance.plan,
    cpuCores:     instance.cpuCores || instance.vcpu_count,
    ramGb,
    diskGb,
    osType,
    isWindows:    osType === 'Windows',
    createdDate:  instance.createdDate || instance.date_created,
    cancelDate:   instance.cancelDate || null,
    defaultUser:  instance.defaultUser || (osType === 'Windows' ? 'Administrator' : 'root'),
  }
}

// ─── Public surface ──────────────────────────────────────────────────────
module.exports = {
  PROVIDER,
  // Pricing
  MARKUP_PERCENT,
  applyMarkup,
  calculatePrice,
  // Products
  PRODUCT_CATALOG,
  PRODUCT_CATALOG_SSD,
  listProducts,
  getProduct,
  isNVMeProduct,
  isSSDProduct,
  // Regions
  REGION_DISPLAY,
  REGION_TO_VULTR_ID,
  REGION_SURCHARGE,
  listRegions,
  // Images / OS
  listImages,
  getDefaultWindowsImageId,
  getCompatibleWindowsImage,
  getCompatibleLinuxImage,
  WINDOWS_LICENSE_BY_TIER,
  // Display helpers (parity with contabo/ovh)
  formatSpecs,
  formatInstanceForDisplay,
  // Instances
  createInstance,
  getInstance,
  listInstances,
  startInstance,
  stopInstance,
  restartInstance,
  shutdownInstance,
  resetPassword,
  reinstallInstance,
  cancelInstance,
  upgradeInstance,
  updateInstanceName,
  // Snapshots
  createSnapshot,
  listSnapshots,
  deleteSnapshot,
  // Tags
  createTag,
  listTags,
  // Secrets / SSH keys
  createSecret,
  listSecrets,
  getSecret,
  deleteSecret,
  // Circuit breaker
  isProvisioningHealthy,
  getCircuitState,
  resetProvisioningCircuit,
  onProvisioningCircuitOpen,
  // Low-level
  apiRequest,
}
