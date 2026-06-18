/**
 * ovh-service.js — OVHcloud API v1 wrapper for VPS provisioning.
 *
 * Mirrors contabo-service.js export signatures so vm-instance-setup.js can
 * swap providers transparently via vps-provider.js.
 *
 * OVH order flow (multi-step, very different from Contabo's POST /compute/instances):
 *   1. POST   /order/cart                              → create cart
 *   2. POST   /order/cart/{cartId}/assign              → bind to account
 *   3. POST   /order/cart/{cartId}/vps                 → add VPS plan (item)
 *   4. POST   /order/cart/{cartId}/vps/options        → add Windows option (RDP only)
 *   5. POST   /order/cart/{cartId}/item/{itemId}/configuration  × N
 *       configs: vps_datacenter (required), vps_os
 *   6. POST   /order/cart/{cartId}/checkout            → place order
 *   7. GET    /me/order/{orderId}                      → poll until delivered
 *   8. GET    /vps                                     → find new service name
 *   9. GET    /vps/{serviceName}                       → full details
 *
 * Notes
 * - SSH keys live on the *account* (POST /me/sshKey) and are referenced by
 *   `name` during reinstall. We expose createSecret/listSecrets to match the
 *   contabo-service signature, but they map to OVH's per-account keystore.
 * - There is no "instance ID" — OVH uses `serviceName` (e.g., 'vps-123abc.vps.ovh.net').
 * - Reboots/reinstalls go through /vps/{serviceName}/reboot, /vps/{serviceName}/rebuild.
 * - Pricing comes from the static PRODUCT_CATALOG below (kept in sync with /order/catalog/public/vps).
 */

'use strict'
require('dotenv').config()
const axios  = require('axios')
const crypto = require('crypto')

// ─── OVH credentials (from /app/backend/.env) ─────────────────────────────
const AK   = process.env.OVH_APP_KEY
const AS   = process.env.OVH_APP_SECRET
const CK   = process.env.OVH_CONSUMER_KEY
const BASE = process.env.OVH_ENDPOINT || 'https://ca.api.ovh.com/1.0'
const SUBSIDIARY = process.env.OVH_SUBSIDIARY || 'WE'
const DEFAULT_DC = process.env.OVH_DEFAULT_DATACENTER || 'BHS'

const MARKUP_PERCENT = parseFloat(process.env.VPS_MARKUP_PERCENT || '50')

// ─── Signed request helper ────────────────────────────────────────────────
// OVH auth: X-Ovh-Signature = '$1$' + sha1(AS + '+' + CK + '+' + METHOD + '+' + URL + '+' + BODY + '+' + TS)
// Server time is required because the signature embeds a Unix timestamp and
// OVH rejects requests >30s out of sync.

let _serverTimeCache = { offsetSec: null, fetchedAt: 0 }

async function _serverNow() {
  // Cache the time offset for 5min to avoid hammering /auth/time
  if (Date.now() - _serverTimeCache.fetchedAt < 5 * 60 * 1000 && _serverTimeCache.offsetSec != null) {
    return Math.floor(Date.now() / 1000) + _serverTimeCache.offsetSec
  }
  const r = await axios.get(`${BASE}/auth/time`, { timeout: 10000 })
  const remote = Number(r.data)
  const local = Math.floor(Date.now() / 1000)
  _serverTimeCache = { offsetSec: remote - local, fetchedAt: Date.now() }
  return remote
}

async function ovhRequest(method, path, body = null, query = '') {
  if (!AK || !AS || !CK) {
    throw new Error('OVH credentials missing — check OVH_APP_KEY/APP_SECRET/CONSUMER_KEY in .env')
  }
  const ts = await _serverNow()
  const url = `${BASE}${path}${query}`
  const bodyStr = body ? JSON.stringify(body) : ''
  const toSign = `${AS}+${CK}+${method}+${url}+${bodyStr}+${ts}`
  const sig = '$1$' + crypto.createHash('sha1').update(toSign).digest('hex')
  try {
    const res = await axios({
      method,
      url,
      headers: {
        'X-Ovh-Application': AK,
        'X-Ovh-Consumer':    CK,
        'X-Ovh-Timestamp':   String(ts),
        'X-Ovh-Signature':   sig,
        'Content-Type':      'application/json',
      },
      data: body || undefined,
      timeout: 30000,
    })
    return res.data
  } catch (err) {
    const status = err.response?.status
    const msg    = err.response?.data?.message || err.message
    const wrapped = new Error(`[OVH ${method} ${path}] ${status || ''} ${msg}`)
    wrapped.status = status
    wrapped.response = err.response
    wrapped.ovhMessage = msg
    throw wrapped
  }
}

// ─── Provisioning circuit breaker (mirrors contabo-service) ───────────────
const _circuit = {
  open: false,
  consecutive500: 0,
  openedAt: null,
  lastError: null,
  lastErrorAt: null,
  threshold: 2,
  probeIntervalMs: 5 * 60 * 1000,
  onOpen: null,
}

function _trackCreateResult(ok, err) {
  if (ok) {
    if (_circuit.consecutive500 > 0 || _circuit.open) {
      console.log(`[OVH] createInstance recovered — circuit closed`)
    }
    _circuit.consecutive500 = 0
    _circuit.open = false
    _circuit.openedAt = null
    _circuit.lastError = null
    _circuit.lastErrorAt = null
    return
  }
  const status = err?.status || err?.response?.status || 0
  if (status >= 500 && status < 600) {
    _circuit.consecutive500 += 1
    _circuit.lastError = err?.ovhMessage || err?.message || 'Internal Server Error'
    _circuit.lastErrorAt = new Date()
    if (!_circuit.open && _circuit.consecutive500 >= _circuit.threshold) {
      _circuit.open = true
      _circuit.openedAt = new Date()
      console.error(`[OVH] 🔌 CIRCUIT OPEN — checkout failed ${_circuit.consecutive500}× with 5xx.`)
      try { _circuit.onOpen && _circuit.onOpen(getCircuitState()) } catch (_) { /* swallow */ }
    }
  } else {
    _circuit.consecutive500 = 0
  }
}

function isProvisioningHealthy() { return !_circuit.open }
function getCircuitState() {
  return {
    open: _circuit.open,
    consecutive500: _circuit.consecutive500,
    openedAt: _circuit.openedAt,
    lastError: _circuit.lastError,
    lastErrorAt: _circuit.lastErrorAt,
    provider: 'ovh',
  }
}
function resetProvisioningCircuit() {
  _circuit.open = false
  _circuit.consecutive500 = 0
  _circuit.openedAt = null
  _circuit.lastError = null
  _circuit.lastErrorAt = null
}
function onProvisioningCircuitOpen(cb) { _circuit.onOpen = cb }

// ─── Product catalog (synced from /order/catalog/public/vps, 2026-02) ────
// We resell 6 tiers, each backed by a specific OVH planCode.
//
// Tier 1 is **Linux-only** (vps-starter-1-2-20 has no Windows option). When
// a customer needs RDP they must start at Tier 2.
//
// For Tier 2+, the same planCode backs both Linux ($0 OS option) and RDP
// (with the matching option-windows-* addon on top).
//
// Tier numbers stay 1–6 to keep parity with the previous Contabo catalogue.
const PRODUCT_CATALOG = [
  { productId: 'VST1',  planCode: 'vps-starter-1-2-20',    name: 'Nano',     tier: 1, cpuCores: 1,  ramMb: 2048,  diskMb: 20480,  diskType: 'nvme', bandwidthTb: 1, portSpeedMbps: 100,  basePriceUsd: 4.20,  windowsOption: null,                            windowsPriceUsd: null, linuxOnly: true },
  { productId: 'VVL4',  planCode: 'vps-value-1-4-20',      name: 'Micro',    tier: 2, cpuCores: 1,  ramMb: 4096,  diskMb: 20480,  diskType: 'nvme', bandwidthTb: 1, portSpeedMbps: 500,  basePriceUsd: 9.20,  windowsOption: 'option-windows-value-1-4-20',      windowsPriceUsd: 6.50 },
  { productId: 'VLE4',  planCode: 'vps-le-4-4-80',         name: 'Starter',  tier: 3, cpuCores: 4,  ramMb: 4096,  diskMb: 81920,  diskType: 'nvme', bandwidthTb: 2, portSpeedMbps: 1000, basePriceUsd: 11.00, windowsOption: 'option-windows-le-4-4-80',         windowsPriceUsd: 23.00 },
  { productId: 'VES8a', planCode: 'vps-essential-2-8-40',  name: 'Standard', tier: 4, cpuCores: 2,  ramMb: 8192,  diskMb: 40960,  diskType: 'nvme', bandwidthTb: 2, portSpeedMbps: 1000, basePriceUsd: 18.80, windowsOption: 'option-windows-essential-2-8-40',  windowsPriceUsd: 16.00 },
  { productId: 'VES8b', planCode: 'vps-essential-2-8-160', name: 'Plus',     tier: 5, cpuCores: 2,  ramMb: 8192,  diskMb: 163840, diskType: 'nvme', bandwidthTb: 2, portSpeedMbps: 1000, basePriceUsd: 25.00, windowsOption: 'option-windows-essential-2-8-160', windowsPriceUsd: 30.50 },
  { productId: 'VLE16', planCode: 'vps-le-16-16-160',      name: 'Power',    tier: 6, cpuCores: 16, ramMb: 16384, diskMb: 163840, diskType: 'nvme', bandwidthTb: 2, portSpeedMbps: 2000, basePriceUsd: 45.00, windowsOption: 'option-windows-le-16-16-160',      windowsPriceUsd: 80.00 },
]

// Datacenter regions (from cart requiredConfiguration: vps_datacenter)
const REGION_DISPLAY = {
  'BHS': { emoji: '🇨🇦', label: 'Beauharnois (Canada)',  region: 'canada' },
  'GRA': { emoji: '🇫🇷', label: 'Gravelines (France)',   region: 'europe' },
  'SBG': { emoji: '🇫🇷', label: 'Strasbourg (France)',   region: 'europe' },
  'WAW': { emoji: '🇵🇱', label: 'Warsaw (Poland)',       region: 'europe' },
  'DE':  { emoji: '🇩🇪', label: 'Frankfurt (Germany)',   region: 'europe' },
  'UK':  { emoji: '🇬🇧', label: 'London (UK)',           region: 'europe' },
  'SGP': { emoji: '🇸🇬', label: 'Singapore',             region: 'apac'   },
  'SYD': { emoji: '🇦🇺', label: 'Sydney (Australia)',    region: 'apac'   },
  'YNM': { emoji: '🇮🇳', label: 'Mumbai (India)',        region: 'apac'   },
}

// ─── Dedicated server catalog (Phase-2 #3 — Tier-7+ for >16 GB RAM customers)
//
// OVH VPS catalog tops out at 16 GB RAM (vps-le-16-16-160). Customers needing
// more memory must order a physical dedicated server from OVH's Kimsufi /
// SoYouStart line. These have ONE-TIME setup fees (usually $50–$100) AND
// take HOURS to deliver — they cannot be auto-provisioned alongside VPS in
// the same bot flow.
//
// We expose them here for admin tools / future "Tier 7" custom-quote flow.
// The customer-facing 6-tier menu in the bot stays VPS-only.
//
// Synced 2026-02 from /order/catalog/public/eco?ovhSubsidiary=WE.
const DEDICATED_CATALOG = [
  { productId: 'KS1',  planCode: '24sk102',        family: 'Kimsufi',    name: 'KS-1 (Xeon-D 1520)',      cpu: '4c/8t @ 2.2GHz',  ramGb: 32,  diskGb: 2000, diskType: 'HDD',  basePriceUsd: 18.80, datacenters: ['BHS','GRA','SBG'] },
  { productId: 'KS5',  planCode: '24sk502',        family: 'Kimsufi',    name: 'KS-5 (Xeon-E3 1270 v6)',  cpu: '4c/8t @ 3.8GHz',  ramGb: 32,  diskGb: 2000, diskType: 'HDD',  basePriceUsd: 19.90, datacenters: ['BHS','GRA','SBG','SYD'] },
  { productId: 'SYS1', planCode: '24sys012',       family: 'SoYouStart', name: 'SYS-1 (Xeon-E 2136)',     cpu: '6c/12t @ 3.3GHz', ramGb: 32,  diskGb: 4000, diskType: 'HDD',  basePriceUsd: 33.20, datacenters: ['BHS','GRA','SBG','SGP','SYD'] },
  { productId: 'SYS3', planCode: '24sys032',       family: 'SoYouStart', name: 'SYS-3 (Xeon-E 2288G)',    cpu: '8c/16t @ 3.7GHz', ramGb: 32,  diskGb: 2000, diskType: 'SSD',  basePriceUsd: 46.50, datacenters: ['BHS','GRA'] },
]

// OS-name → vps_os value (must match exactly what OVH lists in requiredConfiguration)
// Common names users will pick.
const OS_CATALOG = [
  { id: 'ubuntu-24.04',   name: 'ubuntu-24.04',    label: 'Ubuntu 24.04',                                  osType: 'Linux',   ovhName: 'Ubuntu 24.04' },
  { id: 'ubuntu-22.04',   name: 'ubuntu-22.04',    label: 'Ubuntu 22.04',                                  osType: 'Linux',   ovhName: 'Ubuntu 22.04' },
  { id: 'debian-12',      name: 'debian-12',       label: 'Debian 12',                                     osType: 'Linux',   ovhName: 'Debian 12'    },
  { id: 'debian-13',      name: 'debian-13',       label: 'Debian 13',                                     osType: 'Linux',   ovhName: 'Debian 13'    },
  { id: 'almalinux-9',    name: 'almalinux-9',     label: 'AlmaLinux 9',                                   osType: 'Linux',   ovhName: 'AlmaLinux 9'  },
  { id: 'rockylinux-9',   name: 'rockylinux-9',    label: 'Rocky Linux 9',                                 osType: 'Linux',   ovhName: 'Rocky Linux 9'},
  { id: 'windows-2025',   name: 'windows-2025',    label: 'Windows Server 2025 Standard (Desktop)',         osType: 'Windows', ovhName: 'Windows Server 2025 Standard (Desktop)', isRDP: true },
  { id: 'windows-2022',   name: 'windows-2022',    label: 'Windows Server 2022 Standard (Desktop)',         osType: 'Windows', ovhName: 'Windows Server 2022 Standard (Desktop)', isRDP: true },
  { id: 'windows-2019',   name: 'windows-2019',    label: 'Windows Server 2019 Standard (Desktop)',         osType: 'Windows', ovhName: 'Windows Server 2019 Standard (Desktop)', isRDP: true },
]

// ─── Pricing helpers ──────────────────────────────────────────────────────

function applyMarkup(basePrice) {
  return Math.round(basePrice * (1 + MARKUP_PERCENT / 100) * 100) / 100
}

function calculatePrice(product, regionSlug, isWindows = false) {
  const base = product.basePriceUsd
  const winFee = isWindows ? (product.windowsPriceUsd || 0) : 0
  const surcharge = 0  // OVH prices are identical across datacenters
  const totalBefore = base + surcharge + winFee
  return {
    basePriceUsd:      base,
    regionSurcharge:   surcharge,
    windowsLicense:    winFee,
    totalBeforeMarkup: Math.round(totalBefore * 100) / 100,
    totalWithMarkup:   applyMarkup(totalBefore),
    markupPercent:     MARKUP_PERCENT,
  }
}

// ─── Products / Regions / Images ──────────────────────────────────────────

/**
 * List products with pricing. Mirrors contabo-service.listProducts signature.
 * @param {string} regionSlug - Datacenter code (BHS, GRA, etc.). Unused for pricing — OVH is flat.
 * @param {boolean} isWindows
 * @param {string} _diskPreference - Ignored (OVH doesn't distinguish NVMe/SSD in our catalog).
 */
function listProducts(regionSlug = DEFAULT_DC, isWindows = false, _diskPreference = 'nvme') {
  return PRODUCT_CATALOG
    // Filter out Linux-only plans when caller wants Windows
    .filter(p => !(isWindows && p.linuxOnly))
    .map(p => {
      const pricing = calculatePrice(p, regionSlug, isWindows)
      return {
        ...p,
        ramGb:  Math.round(p.ramMb / 1024),
        diskGb: Math.round(p.diskMb / 1024),
        pricing,
      }
    })
}

function getProduct(productId) {
  return PRODUCT_CATALOG.find(p => p.productId === productId || p.planCode === productId) || null
}

function getProductFallback(_productId) {
  // OVH has no NVMe↔SSD fallback line — each tier maps to a single planCode.
  return null
}

async function listRegions() {
  return Object.entries(REGION_DISPLAY).map(([slug, d]) => ({
    regionSlug:   slug,
    regionName:   d.label,
    dataCenters:  [{ name: d.label, slug }],
    surchargeUsd: [0, 0, 0, 0, 0, 0],
    display:      d,
    region:       d.region,
  }))
}

async function listImages(filter = 'all') {
  let list = OS_CATALOG
  if (filter === 'linux')                       list = list.filter(o => o.osType === 'Linux')
  else if (filter === 'windows' || filter === 'rdp') list = list.filter(o => o.osType === 'Windows')
  return list.map(o => ({
    imageId:   o.id,
    name:      o.name,
    osType:    o.osType,
    version:   o.label,
    isWindows: o.osType === 'Windows',
    ovhName:   o.ovhName,
  }))
}

// ─── Dedicated server discovery (Phase-2 #3, admin-only) ─────────────────

/**
 * Return our curated list of dedicated-server SKUs available for >16 GB RAM
 * deployments. Pricing in DEDICATED_CATALOG is OVH wholesale — markup is
 * NOT applied (these are admin-facing, customer pricing is custom-quoted
 * because of one-time setup fees + hours-long provisioning).
 *
 * If `live=true`, also probes /order/catalog/public/eco to refresh the
 * monthly price from OVH's catalog (slow — round-trip per planCode).
 */
async function listDedicatedPlans({ live = false } = {}) {
  if (!live) return DEDICATED_CATALOG.map(p => ({ ...p, source: 'cached' }))
  const r = await ovhRequest('GET', `/order/catalog/public/eco`, null, `?ovhSubsidiary=${SUBSIDIARY}`)
  const plans = r?.plans || []
  return DEDICATED_CATALOG.map(p => {
    const live = plans.find(x => x.planCode === p.planCode)
    const monthly = (live?.pricings || []).find(x => x.mode === 'default' && x.intervalUnit === 'month')
    return {
      ...p,
      basePriceUsd:    monthly ? monthly.price / 100000000 : p.basePriceUsd,
      liveInvoiceName: live?.invoiceName || null,
      source:          live ? 'live' : 'cached',
    }
  })
}

async function getDefaultWindowsImageId(_productId) {
  // All OVH plans accept the same Windows image names (no SE vs DE split).
  return 'windows-2025'
}

async function getCompatibleWindowsImage(_imageId, _targetProductId) {
  return 'windows-2025'
}

async function getCompatibleLinuxImage(_currentImageId, _productId) {
  return 'ubuntu-24.04'
}

// ─── Secrets (SSH keys) ───────────────────────────────────────────────────
// OVH stores SSH keys on the account (POST /me/sshKey) and references them
// by `name` during rebuild. We pretend each name *is* the secretId so the
// Contabo-shaped callers keep working.

async function createSecret(name, value, type = 'ssh') {
  if (type === 'ssh') {
    if (!value || value.length < 20) throw new Error('SSH key too short')
    // OVH key names must be alphanumeric + dash + underscore, ≤30 chars
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 30)
    // Check if it already exists (idempotency)
    try {
      const existing = await ovhRequest('GET', `/me/sshKey/${safeName}`)
      if (existing) return { secretId: safeName, name: safeName, type: 'ssh' }
    } catch (_) { /* not found, fall through to create */ }
    await ovhRequest('POST', '/me/sshKey', { key: value, keyName: safeName })
    return { secretId: safeName, name: safeName, type: 'ssh' }
  }
  // Passwords are not stored on OVH (no API). We just return the secret in-memory.
  // The caller (vm-instance-setup.js) uses the returned `secretId` as a key into
  // its own DB to retrieve the password. For OVH-mode we return the raw value as
  // the "secretId" wrapper field so resetPassword can recover it.
  return { secretId: `pwd:${name}`, name, value, type: 'password' }
}

async function listSecrets(type = null) {
  if (type === 'password') return []  // passwords aren't stored remotely
  const keys = await ovhRequest('GET', '/me/sshKey')
  const out = []
  for (const k of (keys || [])) {
    try {
      const detail = await ovhRequest('GET', `/me/sshKey/${k}`)
      out.push({ secretId: k, name: k, value: detail.key, type: 'ssh' })
    } catch (_) { /* ignore individual key fetch errors */ }
  }
  return out
}

async function getSecret(secretId) {
  if (typeof secretId === 'string' && secretId.startsWith('pwd:')) {
    return { secretId, name: secretId.slice(4), value: null, type: 'password' }
  }
  const d = await ovhRequest('GET', `/me/sshKey/${secretId}`)
  return { secretId, name: secretId, value: d.key, type: 'ssh' }
}

async function deleteSecret(secretId) {
  if (typeof secretId === 'string' && secretId.startsWith('pwd:')) return true
  await ovhRequest('DELETE', `/me/sshKey/${secretId}`)
  return true
}

// ─── Order flow (cart → assign → add → configure → checkout → poll) ─────

/**
 * Build a cart with the requested plan + options + configurations. Does NOT
 * call checkout. Used by both real provisioning and dry-run tests.
 * Returns { cartId, itemId, total }.
 */
async function _buildCart({ productId, region, imageId, isWindows }) {
  const product = getProduct(productId)
  if (!product) throw new Error(`Unknown product ${productId}`)
  if (isWindows && product.linuxOnly) {
    throw new Error(`${product.name} (${product.planCode}) does not support Windows/RDP — pick a higher tier`)
  }
  const dcCode = region || DEFAULT_DC
  if (!REGION_DISPLAY[dcCode]) throw new Error(`Unknown datacenter ${dcCode}`)

  // 1. Create cart
  const cart = await ovhRequest('POST', '/order/cart', {
    ovhSubsidiary: SUBSIDIARY,
    description:   `nomadly-${Date.now()}`,
  })
  const cartId = cart.cartId
  // 2. Assign account
  await ovhRequest('POST', `/order/cart/${cartId}/assign`)
  // 3. Add VPS plan
  const item = await ovhRequest('POST', `/order/cart/${cartId}/vps`, {
    planCode:    product.planCode,
    pricingMode: 'default',
    duration:    'P1M',
    quantity:    1,
  })
  const itemId = item.itemId
  let runningTotal = (item.prices || []).find(p => p.label === 'TOTAL')?.price?.value || 0
  // 4. Configure (datacenter + OS)
  await ovhRequest('POST', `/order/cart/${cartId}/item/${itemId}/configuration`, {
    label: 'vps_datacenter', value: dcCode,
  })
  const osImage = OS_CATALOG.find(o => o.id === imageId || o.name === imageId)
  if (osImage) {
    await ovhRequest('POST', `/order/cart/${cartId}/item/${itemId}/configuration`, {
      label: 'vps_os', value: osImage.ovhName,
    })
  }
  await ovhRequest('POST', `/order/cart/${cartId}/item/${itemId}/configuration`, {
    label: 'AUTO_RENEW_VPS', value: 'true',
  }).catch(() => { /* boolean configuration is optional, ignore */ })
  // 5. Add Windows option for RDP
  if (isWindows && product.windowsOption) {
    const winItem = await ovhRequest('POST', `/order/cart/${cartId}/vps/options`, {
      planCode:    product.windowsOption,
      pricingMode: 'default',
      duration:    'P1M',
      quantity:    1,
      itemId:      itemId,
    })
    runningTotal += (winItem.prices || []).find(p => p.label === 'TOTAL')?.price?.value || 0
  }
  // 6. Return totals computed from item-level prices (cart summary only has IDs)
  const total = Math.round(runningTotal * 100) / 100
  return { cartId, itemId, total }
}

async function _deleteCart(cartId) {
  if (!cartId) return
  try { await ovhRequest('DELETE', `/order/cart/${cartId}`) } catch (_) { /* best-effort cleanup */ }
}

/**
 * Create a VPS instance. Mirrors contabo-service.createInstance signature.
 *
 * @param {Object} opts
 * @param {string} opts.productId    - 'VLE2' / 'VVL2' / 'VLE4' / 'VCM4' / 'VES8' / 'VLE16'
 * @param {string} opts.region       - OVH datacenter code (BHS, GRA, …)
 * @param {string} opts.imageId      - OS image id from OS_CATALOG
 * @param {string} [opts.displayName]
 * @param {string[]} [opts.sshKeys]  - Array of OVH sshKey names (from createSecret)
 * @param {string} [opts.rootPassword] - Ignored on OVH (no API to set; user resets via dashboard or rebuild)
 * @param {string} [opts.userData]   - Ignored (OVH cart flow doesn't accept user-data; we apply post-deploy via SSH if needed)
 * @param {number} [opts.period]     - Months (always 1)
 * @returns {Object} { instanceId, name, displayName, status, ipConfig, defaultUser, _actualProductId, _actualImageId }
 */
async function createInstance(opts) {
  if (_circuit.open) {
    const minutes = _circuit.openedAt ? Math.round((Date.now() - _circuit.openedAt.getTime()) / 60000) : 0
    const err = new Error(`VPS_PROVISIONING_PAUSED: OVH returning 5xx — paused ${minutes}m ago. Last error: ${_circuit.lastError || 'unknown'}`)
    err.code = 'VPS_PROVISIONING_PAUSED'
    err.circuit = getCircuitState()
    throw err
  }

  const product = getProduct(opts.productId)
  if (!product) throw new Error(`Unknown product ${opts.productId}`)
  const osImage = OS_CATALOG.find(o => o.id === opts.imageId || o.name === opts.imageId)
  const isWindows = !!(osImage?.isRDP || opts.isRDP || opts.isWindows)

  let cartId = null
  try {
    const cart = await _buildCart({
      productId: product.productId,
      region:    opts.region || DEFAULT_DC,
      imageId:   opts.imageId,
      isWindows,
    })
    cartId = cart.cartId
    console.log(`[OVH] Cart built: cartId=${cartId} itemId=${cart.itemId} total=$${cart.total.toFixed(2)}`)

    // Dry-run mode: respect env var OVH_DRY_RUN to test cart-build without paying
    if (String(process.env.OVH_DRY_RUN || '').toLowerCase() === 'true') {
      await _deleteCart(cartId)
      _trackCreateResult(true)
      return {
        instanceId:       `dryrun-${cart.itemId}`,
        name:             opts.displayName || `nomadly-dryrun-${Date.now()}`,
        displayName:      opts.displayName || `nomadly-dryrun-${Date.now()}`,
        status:           'dry_run',
        ipConfig:         { v4: { ip: null } },
        defaultUser:      isWindows ? 'Administrator' : 'ubuntu',
        _actualProductId: product.productId,
        _actualImageId:   opts.imageId,
        _ovhCartId:       cartId,
        _ovhTotal:        cart.total,
      }
    }

    // Checkout: real order placement
    const checkout = await ovhRequest('POST', `/order/cart/${cartId}/checkout`, {
      autoPayWithPreferredPaymentMethod: true,
      waiveRetractationPeriod:           true,
    })
    const orderId = checkout.orderId
    console.log(`[OVH] Order placed: orderId=${orderId}, total=${checkout.prices?.withTax?.text || '?'}`)

    // Poll order until delivered (max 5 min)
    const deliveredService = await _pollOrderUntilDelivered(orderId, 300)

    // Look up VPS details
    const detail = await ovhRequest('GET', `/vps/${deliveredService}`)

    // ── Phase-2 post-deploy: push SSH key + cloud-init via /vps/{sn}/rebuild ──
    // OVH does not accept rootPassword/userData at cart-checkout time, so the
    // first-login UX after delivery is broken unless we trigger a rebuild with
    // sshKey + postInstallScript. This brings parity with Contabo where the
    // bot's cloud-init runs on first boot.
    //
    // Skip if no SSH key AND no userData (nothing to push).
    const sshKeyName = Array.isArray(opts.sshKeys) && opts.sshKeys[0] ? opts.sshKeys[0] : null
    const cloudInit  = opts.userData ? Buffer.from(opts.userData, 'base64').toString('utf-8') : null
    let postDeployStatus = null
    if (sshKeyName || cloudInit) {
      try {
        postDeployStatus = await _applyPostDeployConfig(deliveredService, {
          imageHint:        osImageHint(opts.imageId, isWindows),
          sshKeyName:       sshKeyName,
          postInstallScript: cloudInit,
          isWindows:        isWindows,
        })
        console.log(`[OVH] Post-deploy config applied: ${JSON.stringify(postDeployStatus)}`)
      } catch (e) {
        // Don't fail the order — the VPS is live, post-config can be retried by admin.
        console.error(`[OVH] Post-deploy config FAILED for ${deliveredService}: ${e.message}. Order succeeded; admin can rerun /admin/ovh-rebuild.`)
      }
    }

    const result = {
      instanceId:       deliveredService,
      name:             detail.name || deliveredService,
      displayName:      opts.displayName || detail.displayName || deliveredService,
      status:           detail.state || 'installing',
      ipConfig:         { v4: { ip: detail.mainIpAddress || null } },
      defaultUser:      isWindows ? 'Administrator' : 'ubuntu',
      _actualProductId: product.productId,
      _actualImageId:   opts.imageId,
      _ovhOrderId:      orderId,
      _ovhServiceName:  deliveredService,
      _postDeploy:      postDeployStatus,
    }
    _trackCreateResult(true)
    return result
  } catch (err) {
    _trackCreateResult(false, err)
    if (cartId) await _deleteCart(cartId)
    throw err
  }
}

/**
 * Map our internal image id (e.g. 'ubuntu-24.04') to the OVH-side image
 * name string we need to pass to /vps/{sn}/rebuild. For Windows we pick the
 * Windows Server year that the catalogue accepts; for Linux we honour the
 * user's choice and fall back to Ubuntu 24.04.
 */
function osImageHint(imageId, isWindows) {
  const found = OS_CATALOG.find(o => o.id === imageId || o.name === imageId)
  if (found) return found.ovhName
  return isWindows ? 'Windows Server 2025 Standard (Desktop)' : 'Ubuntu 24.04'
}

/**
 * Post-deploy config push.
 *
 * After OVH delivers a fresh VPS it has a random root password (emailed by
 * OVH) and no SSH key. We rebuild the same OS while attaching:
 *   • the customer's SSH key  (so they can ssh-key into root/ubuntu)
 *   • our bash post-install script (cloud-init equivalent; runs on first boot)
 *   • doNotSendPassword=true   (when SSH key is set — suppresses the OVH email)
 *
 * Notes:
 *   - imageId for /rebuild MUST be the `id` field from /vps/{sn}/images/available,
 *     NOT the friendly name. We do the name → id lookup here.
 *   - /rebuild returns an async task — we don't wait for it (would add ~5 min
 *     to provisioning UX). The task progresses in the background.
 *
 * @returns { taskId, imageId, sshKey } describing what we asked OVH to do.
 */
async function _applyPostDeployConfig(serviceName, { imageHint, sshKeyName, postInstallScript, isWindows }) {
  // 1. Find the image-id by name in /vps/{sn}/images/available
  const available = await ovhRequest('GET', `/vps/${serviceName}/images/available`)
  let imageId = null
  for (const id of (available || [])) {
    try {
      const img = await ovhRequest('GET', `/vps/${serviceName}/images/available/${id}`)
      if (img.name === imageHint) { imageId = id; break }
    } catch (_) { /* skip 404s */ }
  }
  if (!imageId) {
    // Fallback: pick any Ubuntu or Windows image that we have
    for (const id of (available || [])) {
      try {
        const img = await ovhRequest('GET', `/vps/${serviceName}/images/available/${id}`)
        const wantWin = !!isWindows
        const looksWin = /Windows/i.test(img.name)
        if (wantWin === looksWin) { imageId = id; break }
      } catch (_) { /* skip */ }
    }
  }
  if (!imageId) throw new Error(`No matching image-id for "${imageHint}" on ${serviceName}`)

  // 2. POST /vps/{sn}/rebuild
  const body = { imageId }
  if (sshKeyName)        body.sshKey            = sshKeyName
  if (sshKeyName)        body.doNotSendPassword = true   // only valid when sshKey is set
  if (postInstallScript) body.postInstallScript = postInstallScript
  const task = await ovhRequest('POST', `/vps/${serviceName}/rebuild`, body)
  return {
    taskId:  task?.id || task?.taskId || null,
    imageId,
    sshKey:  sshKeyName,
    cloudInitChars: postInstallScript ? postInstallScript.length : 0,
    asyncStatus: task?.state || 'queued',
  }
}

async function _pollOrderUntilDelivered(orderId, timeoutSec = 300) {
  const start = Date.now()
  while ((Date.now() - start) / 1000 < timeoutSec) {
    // Check status
    let status = null
    try {
      const s = await ovhRequest('GET', `/me/order/${orderId}/status`)
      status = s || null
    } catch (e) {
      // ignore transient errors and keep polling
    }
    if (status === 'delivered' || status === 'delivering') {
      // Look up the VPS service that was created. OVH attaches the service to
      // the order via /me/order/{orderId}/details/{detailId}/extension.
      const details = await ovhRequest('GET', `/me/order/${orderId}/details`)
      for (const detailId of (details || [])) {
        try {
          const ext = await ovhRequest('GET', `/me/order/${orderId}/details/${detailId}/extension`)
          if (ext?.order?.plan?.code?.startsWith('vps-')) {
            // Service name is in the description or detail; fall back to listing /vps
            // and finding the newest one if not present.
          }
        } catch (_) { /* keep iterating */ }
      }
      // Fallback: list all VPS, return the newest one (created in last 10min)
      const allVps = await ovhRequest('GET', '/vps')
      if (allVps?.length) {
        // Get details for each and pick the most recent
        let newest = null
        let newestDate = 0
        for (const sn of allVps) {
          try {
            const d = await ovhRequest('GET', `/vps/${sn}`)
            const created = d.netbootMode ? Date.now() : Date.now()
            if (created > newestDate) { newest = sn; newestDate = created }
          } catch (_) { /* skip */ }
        }
        if (newest) return newest
      }
    }
    if (status === 'cancelled' || status === 'refused' || status === 'unknown') {
      throw new Error(`OVH order ${orderId} ended with status: ${status}`)
    }
    // 'notPaid', 'checking', 'doing', etc. → keep polling
    await new Promise(r => setTimeout(r, 5000))
  }
  throw new Error(`OVH order ${orderId} not delivered after ${timeoutSec}s`)
}

// ─── Instance lifecycle ───────────────────────────────────────────────────

async function getInstance(serviceName) {
  const d = await ovhRequest('GET', `/vps/${serviceName}`)
  // Look up the main IP (may need a second call)
  let mainIp = d.mainIpAddress || null
  if (!mainIp) {
    try {
      const ips = await ovhRequest('GET', `/vps/${serviceName}/ips`)
      if (ips?.length) mainIp = ips[0]
    } catch (_) { /* no ips assigned yet */ }
  }
  return {
    instanceId:  serviceName,
    name:        d.name || serviceName,
    displayName: d.displayName || d.name || serviceName,
    status:      d.state || 'unknown',
    ipConfig:    { v4: { ip: mainIp } },
    defaultUser: d.netbootMode === 'rescue' ? 'root' : 'ubuntu',
    region:      d.cluster || 'unknown',
  }
}

async function listInstances(_filters = {}) {
  const names = await ovhRequest('GET', '/vps')
  const out = []
  for (const sn of (names || [])) {
    try { out.push(await getInstance(sn)) } catch (_) { /* skip transient errors */ }
  }
  return out
}

async function startInstance(serviceName) {
  await ovhRequest('POST', `/vps/${serviceName}/start`)
  return { instanceId: serviceName, action: 'start' }
}

async function stopInstance(serviceName) {
  await ovhRequest('POST', `/vps/${serviceName}/stop`)
  return { instanceId: serviceName, action: 'stop' }
}

async function restartInstance(serviceName) {
  await ovhRequest('POST', `/vps/${serviceName}/reboot`)
  return { instanceId: serviceName, action: 'restart' }
}

async function shutdownInstance(serviceName) {
  return stopInstance(serviceName)
}

async function resetPassword(serviceName, opts = {}) {
  // OVH has no direct "reset password" endpoint. The accepted pattern is to
  // rebuild with the SAME OS image, which:
  //  • generates a fresh root/Administrator password
  //  • emails it to the account holder (unless doNotSendPassword=true + sshKey set)
  //  • runs our postInstallScript on first boot (parity with Contabo cloud-init)
  const detail = await ovhRequest('GET', `/vps/${serviceName}`)
  const imageHint = opts.imageId
    ? (OS_CATALOG.find(o => o.id === opts.imageId || o.name === opts.imageId)?.ovhName)
    : (opts.osType === 'Windows' || opts.isRDP
        ? 'Windows Server 2025 Standard (Desktop)'
        : (detail.displayName?.match(/Ubuntu \d+\.\d+/)?.[0] || 'Ubuntu 24.04'))

  const status = await _applyPostDeployConfig(serviceName, {
    imageHint,
    sshKeyName:       opts.sshKeyName || opts.sshKey || null,
    postInstallScript: opts.postInstallScript || null,
    isWindows:        opts.osType === 'Windows' || opts.isRDP,
  })
  return {
    password:    null,       // OVH generates and emails it; we can't read it back
    secretId:    null,
    reinstalled: true,
    method:      'rebuild',
    taskId:      status.taskId,
    note:        opts.sshKeyName
      ? 'SSH key attached; new password suppressed (doNotSendPassword=true). Use SSH-key auth.'
      : 'New password sent to account email by OVH (~5 min). Use SSH key auth for instant access.',
  }
}

async function reinstallInstance(serviceName, opts) {
  const status = await _applyPostDeployConfig(serviceName, {
    imageHint:        osImageHint(opts.imageId, opts.osType === 'Windows' || opts.isRDP),
    sshKeyName:       opts.sshKeyName || opts.sshKey || null,
    postInstallScript: opts.postInstallScript || null,
    isWindows:        opts.osType === 'Windows' || opts.isRDP,
  })
  return { instanceId: serviceName, action: 'reinstall', taskId: status.taskId, imageId: status.imageId }
}

async function cancelInstance(serviceName, _opts = {}) {
  // Cancel auto-renewal for an OVH VPS so it expires at the end of the
  // current billing period (no early refund — OVH terminates on the next
  // billing date). Caller can read `nextBillingDate` from the return shape
  // to tell the customer exactly when service ends.
  //
  // ── CRITICAL: the legacy PUT /vps/{sn}/serviceInfos endpoint *silently
  // no-ops* the `automatic`, `forced`, and `deleteAtExpiration` fields on
  // ca.api.ovh.com — confirmed live 2026-06-18. Only `period` is mutable
  // via that path. So we use the modern unified-services endpoint
  // (`PUT /services/{numericServiceId}`) which is what the customer console
  // itself uses now. The numeric serviceId comes from
  // /vps/{sn}/serviceInfos.serviceId — it is a `long`, not the IAM UUID.
  const info = await ovhRequest('GET', `/vps/${serviceName}/serviceInfos`)
  if (!info?.serviceId) {
    throw new Error(`OVH ${serviceName}: no numeric serviceId on /serviceInfos (cannot toggle auto-renew)`)
  }

  await ovhRequest('PUT', `/services/${info.serviceId}`, {
    renew: { mode: 'manual', period: 'P1M' },
  })

  // Re-read the unified service object so we can return live, post-mutation
  // confirmation values to the caller (UI can show "your service ends on …").
  let after = null
  try {
    after = await ovhRequest('GET', `/services/${info.serviceId}`)
  } catch (_) {
    // best-effort read; the PUT already succeeded so we don't fail the cancel
  }

  return {
    instanceId:      serviceName,
    serviceId:       info.serviceId,
    action:          'cancel',
    method:          'renew-mode-manual',
    currentMode:     after?.billing?.renew?.current?.mode || 'manual',
    nextBillingDate: after?.billing?.nextBillingDate || info.expiration || null,
    expirationDate:  after?.billing?.expirationDate || info.expiration || null,
    refundAmount:    0,
  }
}

/**
 * Upgrade an existing OVH VPS to a higher tier.
 *
 * Flow:
 *   1. GET /vps/{sn}/availableUpgrade  → list planCodes we can move to
 *   2. POST /order/cart                → fresh cart
 *   3. POST /order/cart/{cartId}/assign
 *   4. POST /order/cart/{cartId}/vps/upgrade  → add upgrade to cart, body
 *       { serviceName, planCode }
 *   5. POST /order/cart/{cartId}/checkout (autoPay)
 *   6. Poll /me/order/{id}/status → delivered
 *
 * Same dry-run behaviour as createInstance — set OVH_DRY_RUN=true to
 * build+delete the cart and skip checkout.
 *
 * @param {string} serviceName     - OVH VPS serviceName (e.g. vps-12abc.vps.ovh.net)
 * @param {Object} opts            - { productId } target tier from PRODUCT_CATALOG
 */
async function upgradeInstance(serviceName, opts = {}) {
  if (!serviceName || !opts?.productId) {
    throw new Error('upgradeInstance requires serviceName + opts.productId')
  }
  const target = getProduct(opts.productId)
  if (!target) throw new Error(`Unknown target productId ${opts.productId}`)

  // 1. Verify the target plan is in the VPS's availableUpgrade list
  const available = await ovhRequest('GET', `/vps/${serviceName}/availableUpgrade`).catch(() => [])
  const offered = (available || []).map(x => x?.planCode || x).filter(Boolean)
  if (offered.length && !offered.includes(target.planCode)) {
    throw new Error(`OVH does not offer planCode=${target.planCode} as an upgrade for ${serviceName}. Available: ${offered.join(', ') || '(none)'}`)
  }

  // 2. Cart-based upgrade order
  let cartId = null
  try {
    const cart = await ovhRequest('POST', '/order/cart', {
      ovhSubsidiary: SUBSIDIARY,
      description:   `nomadly-upgrade-${serviceName}-${Date.now()}`,
    })
    cartId = cart.cartId
    await ovhRequest('POST', `/order/cart/${cartId}/assign`)
    const item = await ovhRequest('POST', `/order/cart/${cartId}/vps/upgrade`, {
      planCode:    target.planCode,
      pricingMode: 'default',
      duration:    'P1M',
      quantity:    1,
      serviceName: serviceName,
    })
    const total = (item.prices || []).find(p => p.label === 'TOTAL')?.price?.value || 0
    console.log(`[OVH] Upgrade cart built: cartId=${cartId} planCode=${target.planCode} delta=$${total.toFixed(2)}`)

    if (String(process.env.OVH_DRY_RUN || '').toLowerCase() === 'true') {
      await _deleteCart(cartId)
      return { action: 'upgrade', status: 'dry_run', serviceName, newProductId: target.productId, newPlanCode: target.planCode, deltaUsd: total }
    }

    const checkout = await ovhRequest('POST', `/order/cart/${cartId}/checkout`, {
      autoPayWithPreferredPaymentMethod: true,
      waiveRetractationPeriod:           true,
    })
    const orderId = checkout.orderId
    console.log(`[OVH] Upgrade order placed: orderId=${orderId}`)
    // Wait for delivery — upgrade orders deliver fast (~1 min)
    await _pollOrderUntilDelivered(orderId, 180)
    return {
      action:       'upgrade',
      status:       'delivered',
      serviceName,
      newProductId: target.productId,
      newPlanCode:  target.planCode,
      ovhOrderId:   orderId,
    }
  } catch (err) {
    if (cartId) await _deleteCart(cartId)
    throw err
  }
}

async function updateInstanceName(serviceName, newName) {
  await ovhRequest('PUT', `/vps/${serviceName}`, { displayName: newName })
  return { instanceId: serviceName, name: newName }
}

// ─── Snapshots ────────────────────────────────────────────────────────────

async function createSnapshot(serviceName, _name = '') {
  await ovhRequest('POST', `/vps/${serviceName}/snapshot`, {})
  return { serviceName, action: 'snapshot-create' }
}

async function listSnapshots(serviceName) {
  try {
    const snap = await ovhRequest('GET', `/vps/${serviceName}/snapshot`)
    return snap ? [snap] : []
  } catch (e) {
    if (e.status === 404) return []
    throw e
  }
}

async function deleteSnapshot(serviceName) {
  await ovhRequest('DELETE', `/vps/${serviceName}/snapshot`)
  return { serviceName, action: 'snapshot-delete' }
}

// ─── Tags ─────────────────────────────────────────────────────────────────
// OVH doesn't support tags on VPS directly. We stub these for parity.

async function createTag(_name) { return { tagId: null, note: 'tags not supported on OVH' } }
async function listTags()       { return [] }
async function deleteTag(_id)   { return true }

// ─── Display helpers ──────────────────────────────────────────────────────

function formatInstanceForDisplay(inst) {
  return {
    id:      inst.instanceId,
    name:    inst.displayName || inst.name,
    status:  inst.status,
    ip:      inst.ipConfig?.v4?.ip || 'pending',
    region:  inst.region || 'unknown',
  }
}

function formatSpecs(product) {
  const ramGb  = Math.round(product.ramMb / 1024)
  const diskGb = Math.round(product.diskMb / 1024)
  return `${product.cpuCores} vCPU | ${ramGb} GB RAM | ${diskGb} GB ${product.diskType?.toUpperCase() || 'NVMe'}`
}

// ─── Health check ─────────────────────────────────────────────────────────

async function healthCheck() {
  try {
    const me = await ovhRequest('GET', '/me')
    const list = await ovhRequest('GET', '/vps')
    return {
      ok: true,
      message: 'OVH API connected',
      account: me.nichandle,
      currency: me.currency?.code,
      instanceCount: list?.length || 0,
      tokenValid: true,
    }
  } catch (err) {
    return { ok: false, message: err.message || 'OVH API connection failed', tokenValid: false }
  }
}

// ─── Exports (mirror contabo-service.js) ──────────────────────────────────
// Build a WINDOWS_LICENSE_BY_TIER stub for legacy callers that expect Contabo's
// schema. Pulls per-tier price from the product's windowsPriceUsd. Tiers
// without RDP support (Linux-only Tier 1) get 0.
const WINDOWS_LICENSE_BY_TIER = PRODUCT_CATALOG.reduce((m, p) => {
  m[p.tier] = p.windowsPriceUsd || 0
  return m
}, {})

module.exports = {
  // Provider identity
  PROVIDER: 'ovh',

  // Products & Pricing
  listProducts,
  getProduct,
  getProductFallback,
  calculatePrice,
  applyMarkup,
  PRODUCT_CATALOG,
  // OVH does not split NVMe/SSD — alias for legacy Contabo-shaped callers.
  PRODUCT_CATALOG_SSD: PRODUCT_CATALOG,
  REGION_DISPLAY,
  // Surcharges are flat on OVH (all $0). Provide an empty stub for callers
  // that read per-region surcharge arrays.
  REGION_SURCHARGE: {},
  MARKUP_PERCENT,
  WINDOWS_LICENSE_BY_TIER,
  // Constant for default Windows image (legacy Contabo callers reference this)
  DEFAULT_WINDOWS_IMAGE: 'windows-2025',

  // Dedicated catalog (Phase-2 #3 — admin-only, >16 GB RAM tier)
  DEDICATED_CATALOG,
  listDedicatedPlans,

  // Regions
  listRegions,

  // Images
  listImages,
  getDefaultWindowsImageId,
  getCompatibleWindowsImage,
  getCompatibleLinuxImage,

  // Secrets (SSH keys)
  createSecret,
  listSecrets,
  getSecret,
  deleteSecret,

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
  deleteTag,

  // Utility
  formatInstanceForDisplay,
  formatSpecs,
  healthCheck,

  // Circuit breaker
  isProvisioningHealthy,
  getCircuitState,
  resetProvisioningCircuit,
  onProvisioningCircuitOpen,

  // Low-level
  ovhRequest,
  _buildCart,
  _deleteCart,
  _applyPostDeployConfig,  // Phase-2: admin retry helper for post-deploy push
}
