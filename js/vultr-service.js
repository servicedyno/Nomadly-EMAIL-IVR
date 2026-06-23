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
  // Static — the customer-facing region slugs that Vultr supports.
  return Object.entries(REGION_DISPLAY).map(([slug, info]) => ({
    slug, ...info, vultrId: REGION_TO_VULTR_ID[slug],
  }))
}

// ─── Images / OS ─────────────────────────────────────────────────────────
async function listImages(filter = 'all') {
  // Filter: 'all' | 'linux' | 'windows'
  const d = await apiRequest('GET', '/os')
  const list = d.os || []
  if (filter === 'windows') return list.filter(o => /windows/i.test(o.family || o.name || ''))
  if (filter === 'linux')   return list.filter(o => !/windows/i.test(o.family || o.name || ''))
  return list
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
/**
 * Create a Vultr VPS instance.
 * @param {Object} opts
 *   - productId     (string) plan id like 'vc2-4c-8gb'
 *   - regionSlug    (string) one of the keys in REGION_TO_VULTR_ID
 *   - osId          (number) Vultr OS id (e.g. 501 for Win Srv 2022 Std)
 *   - label         (string) human-friendly label
 *   - tag           (string|null) optional tag
 *   - sshKeyIds     (array|null) optional Vultr SSH key IDs (Linux only)
 *   - userData      (string|null) optional cloud-init / user-data
 * @returns {Promise<{instanceId, mainIp, defaultPassword, status, raw}>}
 */
async function createInstance(opts) {
  const {
    productId, regionSlug, osId, label = null, tag = null,
    sshKeyIds = null, userData = null,
  } = opts || {}

  if (!productId || !regionSlug || !osId) {
    throw new Error('createInstance requires { productId, regionSlug, osId }')
  }
  const region = REGION_TO_VULTR_ID[regionSlug]
  if (!region) throw new Error(`Unknown region slug: ${regionSlug}`)

  const body = {
    region,
    plan:  productId,
    os_id: osId,
    label: label || `vps-${Date.now().toString(36)}`,
    enable_ipv6: false,
    backups: 'disabled',
  }
  if (tag) body.tag = tag
  if (Array.isArray(sshKeyIds) && sshKeyIds.length) body.sshkey_id = sshKeyIds
  if (userData) body.user_data = Buffer.from(userData, 'utf-8').toString('base64')

  try {
    const data = await apiRequest('POST', '/instances', body)
    const inst = data.instance || {}
    _trackCreateResult(true)
    return {
      instanceId:      inst.id,
      mainIp:          inst.main_ip || null,
      defaultPassword: inst.default_password || null,
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

async function resetPassword(instanceId) {
  // Vultr re-installs the OS to generate a new admin password — destructive,
  // matches Contabo's behaviour where resetPassword is also destructive.
  const data = await apiRequest('POST', `/instances/${instanceId}/reinstall`, {})
  const inst = data.instance || {}
  return { newPassword: inst.default_password || null, raw: inst }
}

async function reinstallInstance(instanceId, opts = {}) {
  const body = {}
  if (opts.osId) body.image_id = opts.osId  // Vultr uses image_id for app/iso, os_id for OS
  return apiRequest('POST', `/instances/${instanceId}/reinstall`, body)
}

async function cancelInstance(instanceId) {
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
async function createSecret(name, value, type = 'ssh') {
  if (type !== 'ssh') throw new Error('Vultr only supports SSH keys via /ssh-keys')
  const data = await apiRequest('POST', '/ssh-keys', { name, ssh_key: value })
  return { id: data.ssh_key?.id, name: data.ssh_key?.name }
}

async function listSecrets(_type = null) {
  const data = await apiRequest('GET', '/ssh-keys')
  return (data.ssh_keys || []).map(k => ({ id: k.id, name: k.name }))
}

async function getSecret(secretId) {
  const data = await apiRequest('GET', `/ssh-keys/${secretId}`)
  return data.ssh_key || null
}

async function deleteSecret(secretId) {
  return apiRequest('DELETE', `/ssh-keys/${secretId}`)
}

// ─── Helpers ─────────────────────────────────────────────────────────────
function isNVMeProduct(_productId) { return true }  // Every Vultr plan is NVMe
function isSSDProduct(_productId)  { return false }

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
  listRegions,
  // Images / OS
  listImages,
  getDefaultWindowsImageId,
  getCompatibleWindowsImage,
  getCompatibleLinuxImage,
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
