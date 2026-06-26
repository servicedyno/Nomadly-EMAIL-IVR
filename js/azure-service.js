/* eslint-disable no-empty */
/**
 * azure-service.js — Microsoft Azure Virtual Machines provider implementation.
 *
 * Mirrors the surface of vultr-service.js / digitalocean-service.js so the
 * existing vps-provider.js abstraction can route to Azure via
 * `VPS_DEFAULT_PROVIDER=azure` or per-record routing on
 * `provider === 'azure'` / `contaboInstanceId` starting with `az-`.
 *
 * Tier strategy (2026-06-24):
 *   • MVP launch with B-series ONLY (B1ms / B2s / B2ms) — fresh subscriptions
 *     get 10 cores per region / 0 D-series cores. D-series tiers (D2s_v5 /
 *     D4s_v5) are gated behind `AZURE_DSV5_ENABLED=true`, switch on once a
 *     quota-increase ticket is approved.
 *   • Windows Server 2022 Datacenter default image — RDP-ready out of the box.
 *
 * ID convention:
 *   • Azure ARM full path:  /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Compute/virtualMachines/{vm}
 *   • Bot-stored short id:  `az-<vmname>` (e.g. `az-nmd1a2b3c4`)
 *   • vps-provider's dispatchByInstanceId recognises `^az-` and routes here.
 *   • Internal: _stripIdPrefix unwraps `az-` to get the VM name; the full
 *     ARM path is reconstructed using SUB_ID + RESOURCE_GROUP env vars.
 *
 * Resource layout per VM (all in shared resource group `AZURE_RESOURCE_GROUP`):
 *   • 1 VM
 *   • 1 Public IP (Standard SKU, static)
 *   • 1 NIC (with NSG association)
 *   • 1 VNet + Subnet (10.x.0.0/24 — per-VM private network)
 *   • 1 NSG (RDP/3389 open from Internet)
 *   • 1 OS managed disk (Premium SSD, 127 GB Windows default)
 *   • Tags: chatId, vpsId, productId, createdBy=nomadly
 *
 * Docs: https://learn.microsoft.com/en-us/rest/api/compute/
 */

'use strict'
require('dotenv').config()
const axios = require('axios')
const crypto = require('crypto')

const PROVIDER     = 'azure'
const ID_PREFIX    = 'az-'

const TENANT_ID    = process.env.AZURE_TENANT_ID         || ''
const CLIENT_ID    = process.env.AZURE_CLIENT_ID         || ''
const CLIENT_SECRET= process.env.AZURE_CLIENT_SECRET     || ''
const SUB_ID       = process.env.AZURE_SUBSCRIPTION_ID   || ''
const RG           = process.env.AZURE_RESOURCE_GROUP    || 'nomadly-vps'
const DEFAULT_LOC  = process.env.AZURE_DEFAULT_LOCATION  || 'eastus'
const DSV5_ENABLED = String(process.env.AZURE_DSV5_ENABLED || 'false').toLowerCase() === 'true'
const MARKUP_PERCENT = parseFloat(process.env.VPS_MARKUP_PERCENT || '200')

const ARM_BASE = 'https://management.azure.com'

const log = (...a) => console.log('[Azure]', ...a)

// ─── Token cache & auth ──────────────────────────────────────────────────
const _tokenCache = { token: null, expiresAt: 0 }

async function _getToken() {
  if (_tokenCache.token && Date.now() < _tokenCache.expiresAt - 60_000) {
    return _tokenCache.token
  }
  if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('Azure auth not configured (need AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET)')
  }
  const body = new URLSearchParams({
    grant_type:    'client_credentials',
    client_id:     CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope:         'https://management.azure.com/.default',
  })
  const resp = await axios.post(
    `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
    body.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 20_000 }
  )
  _tokenCache.token = resp.data.access_token
  _tokenCache.expiresAt = Date.now() + (resp.data.expires_in * 1000)
  return _tokenCache.token
}

// ─── ARM HTTP helper ─────────────────────────────────────────────────────
async function apiRequest(method, path, { body = null, apiVersion = '2024-11-01', query = {} } = {}) {
  const token = await _getToken()
  const params = new URLSearchParams({ 'api-version': apiVersion, ...query })
  const url = path.startsWith('http') ? `${path}?${params}` : `${ARM_BASE}${path}?${params}`
  try {
    const resp = await axios.request({
      method,
      url,
      data: body || undefined,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      timeout: 60_000,
      validateStatus: () => true, // we handle ourselves so we can read body on 4xx/5xx
    })
    if (resp.status >= 400) {
      const e = new Error(`Azure ARM ${method} ${path.split('?')[0]} → HTTP ${resp.status}: ${
        resp.data?.error?.message || resp.data?.message || JSON.stringify(resp.data).slice(0, 300)
      }`)
      e.status = resp.status
      e.code = resp.data?.error?.code
      e.responseBody = resp.data
      throw e
    }
    return resp.data
  } catch (err) {
    if (err.status) throw err
    const wrapped = new Error(`Azure ARM ${method} ${path.split('?')[0]} failed: ${err.message}`)
    wrapped.cause = err
    throw wrapped
  }
}

/**
 * Poll a network/compute resource until `properties.provisioningState === 'Succeeded'`.
 *
 * Azure ARM PUTs return as soon as the request is accepted; dependent resources
 * can hit HTTP 429 `ReferencedResourceNotProvisioned` if we create them too
 * early. This helper covers the gap by GET-polling for a short window
 * (default 30s, every 2s).
 */
async function _waitForResource(armPath, { apiVersion = '2023-09-01', maxAttempts = 15, intervalMs = 2000 } = {}) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const d = await apiRequest('GET', armPath, { apiVersion })
      const state = d?.properties?.provisioningState
      if (state === 'Succeeded') return d
      if (state === 'Failed' || state === 'Canceled') {
        const e = new Error(`Azure resource ${armPath.split('/').pop()} provisioning ${state}`)
        e.responseBody = d
        throw e
      }
      // still Creating / Updating — wait and retry
    } catch (e) {
      // GET 404 means the resource hasn't yet appeared in ARM's read store
      if (e.status !== 404) throw e
    }
    await new Promise(r => setTimeout(r, intervalMs))
  }
  // Last-ditch: return whatever the final GET shows even if not Succeeded;
  // caller will hit the same race anyway. Logging happens at caller.
  log(`  ⚠️  _waitForResource: ${armPath.split('/').pop()} did not reach Succeeded after ${maxAttempts * intervalMs / 1000}s — continuing`)
  return null
}

// ─── ID helpers ──────────────────────────────────────────────────────────
function _stripIdPrefix(id) {
  if (id == null) return null
  const s = String(id)
  return s.startsWith(ID_PREFIX) ? s.slice(ID_PREFIX.length) : s
}

function _wrapId(vmName) {
  if (vmName == null) return null
  const s = String(vmName)
  return s.startsWith(ID_PREFIX) ? s : `${ID_PREFIX}${s}`
}

function _vmPath(vmName) {
  const name = _stripIdPrefix(vmName)
  return `/subscriptions/${SUB_ID}/resourceGroups/${RG}/providers/Microsoft.Compute/virtualMachines/${name}`
}

// ─── Circuit breaker ─────────────────────────────────────────────────────
const _circuit = { failures: 0, lastFailureAt: null, lastSuccessAt: null }
const _CIRCUIT_THRESHOLD = 5
const _CIRCUIT_COOLDOWN_MS = 5 * 60 * 1000
const _onOpenCallbacks = []

function _trackCreateResult(ok, err) {
  if (ok) {
    _circuit.failures = 0
    _circuit.lastSuccessAt = new Date()
  } else {
    _circuit.failures++
    _circuit.lastFailureAt = new Date()
    if (_circuit.failures >= _CIRCUIT_THRESHOLD) {
      log(`Circuit opened after ${_circuit.failures} failures. Last: ${err?.message || err}`)
      for (const cb of _onOpenCallbacks) { try { cb({ failures: _circuit.failures, lastError: err }) } catch (_) {} }
    }
  }
}

function isProvisioningHealthy() {
  if (_circuit.failures < _CIRCUIT_THRESHOLD) return true
  if (!_circuit.lastFailureAt) return true
  return (Date.now() - _circuit.lastFailureAt.getTime()) > _CIRCUIT_COOLDOWN_MS
}
function getCircuitState() {
  return { healthy: isProvisioningHealthy(), failures: _circuit.failures,
           lastFailureAt: _circuit.lastFailureAt, lastSuccessAt: _circuit.lastSuccessAt }
}
function resetProvisioningCircuit() {
  _circuit.failures = 0; _circuit.lastFailureAt = null
  log('Circuit manually reset')
}
function onProvisioningCircuitOpen(cb) {
  if (typeof cb === 'function') _onOpenCallbacks.push(cb)
}

// ─── Product Catalog ─────────────────────────────────────────────────────
// MVP: 3 B-series tiers. Catalog includes the all-in cost (VM + OS managed
// disk + Standard Public IP) since calculatePrice applies the markup.
//
// Pricing baseline = eastus PAYG Windows + 64 GB Standard SSD + Static IP.
// We treat pricing as FLAT across regions; Azure does vary slightly (US is
// cheapest, Australia/Japan ~10-20% premium) but the differences are small
// enough that single-price-everywhere keeps the catalog simple.
// ─── Catalog ─────────────────────────────────────────────────────────────
// 2026-06-25 update (RCA: @Hostbay_support RDP failures):
// The Bsv2-series catalog we previously shipped is UNPROVISIONABLE on this
// subscription. Live ARM usage check across ALL regions shows:
//     standardBASv2Family = 0/0   standardBsv2Family = 0/0   (limit 0 = denied)
//     standardDSv5Family  = 0/0   (also denied)
//     StandardDsv6Family  = 0/10  ← the ONLY family with real cores
// So every RDP order on Bsv2 returned HTTP 409 "exceeding approved
// standardBasv2Family Cores quota (Current Limit: 0)" → provisioning failed →
// the bot auto-refunded $90 and showed "VPS provisioning failed".
//
// Fix: move the customer-facing RDP catalog onto the **Dsv6-series**, which is
// the family this subscription actually has quota for (the smoke-test tier
// already validated Standard_D2s_v6 provisions cleanly). Dsv6 is a Gen2 /
// Trusted-Launch capable SSD-only family — the win2022-datacenter-g2 image and
// the existing createInstance() body work unchanged.
//
// Names are RDP-distinct ("RDP 10/20/30") so they no longer collide with the
// DigitalOcean Linux catalog ("Cloud VPS 10/20/30") — this is what made VPS &
// RDP look like "the same plans at different prices" in the UI.
//
// Prices are unchanged for the business ($90 / $156 / $288 = base × markup 200%);
// customers simply get more RAM/cores at the same price on Dsv6.
const _DSV6_TIERS = [
  {
    productId:   'Standard_D2s_v6',
    name:        'RDP 10',
    cpuCores:    2, ramMb: 8192, diskMb: 127 * 1024,
    diskType:    'ssd', bandwidthTb: 0.1, portSpeedMbps: 1000,
    basePriceUsd: 30, tier: 1,
    azureSku:    'Standard_D2s_v6', osDiskSizeGB: 127,
  },
  {
    productId:   'Standard_D4s_v6',
    name:        'RDP 20',
    cpuCores:    4, ramMb: 16384, diskMb: 128 * 1024,
    diskType:    'ssd', bandwidthTb: 0.2, portSpeedMbps: 1000,
    basePriceUsd: 52, tier: 2,
    azureSku:    'Standard_D4s_v6', osDiskSizeGB: 128,
  },
  {
    productId:   'Standard_D8s_v6',
    name:        'RDP 30',
    cpuCores:    8, ramMb: 32768, diskMb: 256 * 1024,
    diskType:    'ssd', bandwidthTb: 0.4, portSpeedMbps: 1000,
    basePriceUsd: 96, tier: 3,
    azureSku:    'Standard_D8s_v6', osDiskSizeGB: 256,
  },
]
const _D_TIERS = [
  {
    productId:   'Standard_D2s_v5',
    name:        'Cloud VPS 40',
    cpuCores:    2, ramMb: 8192, diskMb: 128 * 1024,
    diskType:    'ssd', bandwidthTb: 0.2, portSpeedMbps: 1000,
    basePriceUsd: 150, tier: 4,
    azureSku:    'Standard_D2s_v5', osDiskSizeGB: 128,
  },
  {
    productId:   'Standard_D4s_v5',
    name:        'Cloud VPS 50',
    cpuCores:    4, ramMb: 16384, diskMb: 256 * 1024,
    diskType:    'ssd', bandwidthTb: 0.4, portSpeedMbps: 1000,
    basePriceUsd: 290, tier: 5,
    azureSku:    'Standard_D4s_v5', osDiskSizeGB: 256,
  },
]
// Final catalog = Dsv6 tier always + D-series (v5) when env flag enabled
const PRODUCT_CATALOG = DSV5_ENABLED ? [..._DSV6_TIERS, ..._D_TIERS] : _DSV6_TIERS
const PRODUCT_CATALOG_SSD = PRODUCT_CATALOG // alias for cross-provider compat

// ── Smoke-test only SKU ─────────────────────────────────────────────────
// Standard_D2s_v6 is the cheapest "actually provisionable" D-series SKU
// available in westeurope for newer subscriptions whose `standardBSFamily`
// quota is denied but `StandardDsv6Family` has cores. We expose it via
// getProduct() (NOT listProducts() — it's never shown to customers) so the
// smoke test can verify the live createInstance/cancelInstance integration.
const _SMOKE_TEST_TIER = {
  productId:   'Standard_D2s_v6',
  name:        'Smoke Test (Cloud VPS 25)',
  cpuCores:    2, ramMb: 8192, diskMb: 127 * 1024,
  diskType:    'ssd', bandwidthTb: 0.1, portSpeedMbps: 1000,
  basePriceUsd: 75, tier: 99,
  azureSku:    'Standard_D2s_v6', osDiskSizeGB: 127,
}

// Customer-facing region → Azure region slug
const REGION_TO_AZURE = {
  'EU':         'westeurope',
  'US-east':    'eastus',
  'US-west':    'westus3',
  'US-central': 'eastus2',
  'UK':         'uksouth',
  'SG':         'southeastasia',
  'AU':         'australiaeast',
  'IN':         'centralindia',
  'JP':         'japaneast',
}
const REGION_DISPLAY = {
  'EU':         { emoji: '🇪🇺', label: 'Europe (West)' },
  'US-east':    { emoji: '🇺🇸', label: 'US East' },
  'US-west':    { emoji: '🇺🇸', label: 'US West' },
  'US-central': { emoji: '🇺🇸', label: 'US Central' },
  'UK':         { emoji: '🇬🇧', label: 'United Kingdom' },
  'SG':         { emoji: '🇸🇬', label: 'Singapore' },
  'AU':         { emoji: '🇦🇺', label: 'Australia' },
  'IN':         { emoji: '🇮🇳', label: 'India' },
  'JP':         { emoji: '🇯🇵', label: 'Japan' },
}
const REGION_SURCHARGE = Object.fromEntries(
  Object.keys(REGION_DISPLAY).map(k => [k, [0, 0, 0, 0, 0]])
)

// Windows licence is INCLUDED in the basePriceUsd above (the prices reflect
// the Windows premium pre-rolled in). So WINDOWS_LICENSE_BY_TIER reports 0
// for cross-provider compatibility with vultr-service's signature.
const WINDOWS_LICENSE_BY_TIER = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }

// ─── Pricing ─────────────────────────────────────────────────────────────
function applyMarkup(basePrice) {
  return Math.round(basePrice * (1 + MARKUP_PERCENT / 100) * 100) / 100
}

function calculatePrice(product, regionSlug, isWindows = true) {
  // Azure is positioned as the WINDOWS/RDP-only tier in the bot. We accept
  // isWindows=false to be cross-provider-compatible but treat it as no-op
  // (we don't currently catalog Linux Azure VMs — Vultr/DO already cover Linux).
  const surchargeArr = REGION_SURCHARGE[regionSlug]
  if (!surchargeArr) return null
  const surcharge = surchargeArr[(product.tier || 1) - 1] ?? 0
  const totalBefore = product.basePriceUsd + surcharge
  return {
    basePriceUsd:      product.basePriceUsd,
    regionSurcharge:   surcharge,
    windowsLicense:    0, // bundled
    totalBeforeMarkup: Math.round(totalBefore * 100) / 100,
    totalWithMarkup:   applyMarkup(totalBefore),
    markupPercent:     MARKUP_PERCENT,
  }
}

function listProducts(regionSlug = 'EU', isWindows = true, _diskPreference = 'ssd') {
  // Azure tier is Windows/RDP-only. listProducts(_, isWindows=false) returns
  // empty so the bot's "Linux on Azure" UI path doesn't show anything
  // (use Vultr/DO for Linux).
  if (!isWindows) return []
  return PRODUCT_CATALOG
    .map(p => {
      const pricing = calculatePrice(p, regionSlug, true)
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
  return PRODUCT_CATALOG.find(p => p.productId === productId)
    || (productId === _SMOKE_TEST_TIER.productId ? _SMOKE_TEST_TIER : null)
}

// ─── Capacity / quota pre-flight ─────────────────────────────────────────
// Maps an Azure VM SKU to the compute-usage "family" name reported by the ARM
// usages API (case-insensitive match). Used to verify we actually have cores
// quota BEFORE attempting a create (Bsv2/Dsv5 are denied = 0 on this sub;
// only Dsv6 has cores — see _DSV6_TIERS RCA note).
function _skuFamily(productId) {
  const s = String(productId || '')
  if (/_D\d+l?s_v6$/i.test(s)) return 'standardDSv6Family'
  if (/_D\d+l?s_v5$/i.test(s)) return 'standardDSv5Family'
  if (/_B\d+als_v2$/i.test(s)) return 'standardBASv2Family'
  if (/_B\d+s_v2$/i.test(s))   return 'standardBSv2Family'
  return 'cores'
}

/**
 * Check whether the subscription has enough free cores to provision `productId`
 * in `regionSlug`. Returns { ok, family, location, need, familyAvailable,
 * familyLimit, totalAvailable }. On any ARM error we FAIL-OPEN (ok:true,
 * degraded:true) so a transient usages-API hiccup never blocks a sale — the
 * real create call still surfaces a hard error if capacity is genuinely gone.
 */
async function checkCapacity(productId, regionSlug) {
  const product = getProduct(productId)
  const location = REGION_TO_AZURE[regionSlug] || regionSlug || DEFAULT_LOC
  const family = _skuFamily(productId)
  const need = product?.cpuCores || 2
  if (!SUB_ID) return { ok: true, degraded: true, reason: 'no_subscription', family, location, need }
  try {
    const data = await apiRequest(
      'GET',
      `/subscriptions/${SUB_ID}/providers/Microsoft.Compute/locations/${location}/usages`,
      { apiVersion: '2023-07-01' }
    )
    const rows = data?.value || []
    const norm = (r) => String(r?.name?.value || '').toLowerCase()
    const fam = rows.find(r => norm(r) === family.toLowerCase())
    const tot = rows.find(r => norm(r) === 'cores')
    const familyAvailable = fam ? (fam.limit - fam.currentValue) : null
    const totalAvailable  = tot ? (tot.limit - tot.currentValue) : null
    const famOk = familyAvailable == null ? false : familyAvailable >= need
    const totOk = totalAvailable == null ? true : totalAvailable >= need
    return {
      ok: famOk && totOk,
      family, location, need,
      familyAvailable, familyLimit: fam ? fam.limit : null,
      totalAvailable,
    }
  } catch (e) {
    log(`checkCapacity error for ${productId}@${location}: ${e.message}`)
    return { ok: true, degraded: true, error: e.message, family, location, need }
  }
}

async function listRegions() {
  return Object.entries(REGION_DISPLAY).map(([slug, info]) => ({
    regionSlug:   slug,
    regionName:   info.label,
    dataCenters:  [{ name: info.label, slug }],
    surchargeUsd: REGION_SURCHARGE[slug],
    display:      info,
    azureSlug:    REGION_TO_AZURE[slug],
    slug, emoji: info.emoji, label: info.label,
  }))
}

// ─── Images (Windows-only for MVP) ───────────────────────────────────────
// Default = Windows Server 2022 Datacenter Gen2 (compatible with all modern
// Azure VM SKUs — Bsv2, Dsv5, Dsv6, Dsv7 etc. require Gen2). Gen1 image
// `2022-Datacenter` is kept as a fallback for legacy B-series (B1ms/B2s/B2ms)
// that are Gen1-only.
const WINDOWS_IMAGES = [
  {
    imageId:   'win2022-datacenter-g2',
    name:      'Windows Server 2022 Datacenter',
    family:    'Windows Server',
    publisher: 'MicrosoftWindowsServer',
    offer:     'WindowsServer',
    sku:       '2022-datacenter-g2',
    version:   'latest',
    isDefault: true,
    isWindows: true,
  },
  {
    imageId:   'win2022-datacenter',
    name:      'Windows Server 2022 Datacenter (Gen1 legacy)',
    family:    'Windows Server',
    publisher: 'MicrosoftWindowsServer',
    offer:     'WindowsServer',
    sku:       '2022-Datacenter',
    version:   'latest',
    isWindows: true,
  },
  {
    imageId:   'win2022-datacenter-azure',
    name:      'Windows Server 2022 Datacenter — Azure Edition (faster boot, hot-patch)',
    family:    'Windows Server',
    publisher: 'MicrosoftWindowsServer',
    offer:     'WindowsServer',
    sku:       '2022-datacenter-azure-edition',
    version:   'latest',
    isWindows: true,
  },
  {
    imageId:   'win2019-datacenter-g2',
    name:      'Windows Server 2019 Datacenter',
    family:    'Windows Server',
    publisher: 'MicrosoftWindowsServer',
    offer:     'WindowsServer',
    sku:       '2019-datacenter-g2',
    version:   'latest',
    isWindows: true,
  },
]

async function listImages(filter = 'all') {
  if (filter === 'linux') return [] // Azure tier is Windows-only here
  return WINDOWS_IMAGES.map(i => ({
    imageId:   i.imageId,
    name:      i.name,
    osType:    'Windows',
    version:   i.name,
    isWindows: true,
    id:        i.imageId,
    family:    i.family,
    arch:      'x86_64',
  }))
}

async function getDefaultWindowsImageId(_productId) {
  return 'win2022-datacenter-g2'
}
async function getCompatibleWindowsImage(currentImageId, _productId) {
  return currentImageId || 'win2022-datacenter-g2'
}
async function getCompatibleLinuxImage(_currentImageId, _productId) {
  return null // Azure tier is Windows-only
}
function _imageReference(imageId) {
  const img = WINDOWS_IMAGES.find(i => i.imageId === imageId) || WINDOWS_IMAGES[0]
  return {
    publisher: img.publisher,
    offer:     img.offer,
    sku:       img.sku,
    version:   img.version,
  }
}

// ─── Azure-compliant password generation ─────────────────────────────────
// Rules: 12-72 chars; contain at least 3 of (upper, lower, digit, special);
// must NOT contain the admin username; certain reserved patterns disallowed.
// We generate 20 chars by default with all 4 character classes guaranteed.
const _SPECIAL = '!@#$%^&*()-_=+[]{}'
function _randPick(s) { return s[crypto.randomInt(s.length)] }
function _generateAzurePassword(length = 20, excludeUsername = '') {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghijkmnpqrstuvwxyz'
  const digit = '23456789'
  const all   = upper + lower + digit + _SPECIAL
  for (let attempt = 0; attempt < 20; attempt++) {
    let chars = [
      _randPick(upper),
      _randPick(lower),
      _randPick(digit),
      _randPick(_SPECIAL),
    ]
    for (let i = chars.length; i < length; i++) chars.push(_randPick(all))
    // Fisher-Yates shuffle so the guaranteed chars aren't always at the start
    for (let i = chars.length - 1; i > 0; i--) {
      const j = crypto.randomInt(i + 1)
      ;[chars[i], chars[j]] = [chars[j], chars[i]]
    }
    const pwd = chars.join('')
    // Reject if it contains the admin username (Azure forbids)
    if (excludeUsername && pwd.toLowerCase().includes(excludeUsername.toLowerCase())) continue
    return pwd
  }
  // Fallback (extremely unlikely): force a known-good random
  return 'Nm' + crypto.randomBytes(10).toString('hex') + '!9'
}

// Azure reserves several admin usernames. Use `nomadly` by default (safe).
const _RESERVED_USERNAMES = new Set([
  'administrator','admin','user','user1','test','user2','test1','user3',
  'admin1','1','123','a','actuser','adm','admin2','aspnet','backup','console',
  'david','guest','john','owner','root','server','sql','support','support_388945a0',
  'sys','test2','test3','user4','user5',
])
function _safeUsername(label) {
  let u = (label || 'nomadly').toLowerCase().replace(/[^a-z0-9]/g, '')
  if (u.length < 3 || u.length > 20 || _RESERVED_USERNAMES.has(u)) u = 'nomadly'
  return u
}

// ─── Password secret cache (Contabo-compat shim) ─────────────────────────
const _passwordSecrets = new Map()
function _isFakePwdId(id) { return typeof id === 'string' && id.startsWith('az-pwd-') }
function _resolvePasswordSecret(idOrPassword) {
  if (!idOrPassword) return null
  if (_isFakePwdId(idOrPassword)) {
    const c = _passwordSecrets.get(idOrPassword)
    if (c?.password) return c.password
  }
  return String(idOrPassword)
}

// ─── VM name helpers ─────────────────────────────────────────────────────
// Windows VM name: 1-15 chars, alphanumeric + hyphens, no leading/trailing hyphen.
function _generateVmName(prefix = 'nmd') {
  // 12-char name = prefix(3) + 9 random hex chars → 12 total, fits 15-char limit.
  const id = crypto.randomBytes(6).toString('hex').slice(0, 9)
  return `${prefix}${id}`
}

// ─── createInstance — multi-resource provisioning ────────────────────────
/**
 * Provision a Windows VM with Public IP, NIC, VNet, NSG (RDP/3389 open),
 * and a 64-128 GB OS managed disk. All resources are tagged for traceability
 * and grouped in the shared `nomadly-vps` resource group.
 *
 * Returns: { instanceId, mainIp, defaultPassword, defaultUser, status, raw }
 *
 * Cross-provider opts:
 *   productId      — required (e.g. 'Standard_B2s')
 *   regionSlug     — required (e.g. 'EU', 'US-east')
 *   osId           — optional, defaults to 'win2022-datacenter-g2'
 *   label          — optional display name, sanitised into VM name
 *   tag            — optional Azure tag (string applied as `tag:` value)
 *   password       — optional explicit password OR a fake-secret-id
 *   sshKeyIds      — IGNORED (Azure RDP doesn't use SSH keys)
 *   userData       — optional Base64 cloud-init equivalent (ignored for Windows)
 */
async function createInstance(opts) {
  if (!SUB_ID) throw new Error('AZURE_SUBSCRIPTION_ID not configured')
  if (!RG)     throw new Error('AZURE_RESOURCE_GROUP not configured')
  const o = opts || {}
  const productId  = o.productId
  const regionSlug = o.regionSlug || o.region
  const osId       = o.osId || o.imageId || 'win2022-datacenter-g2'
  const labelHint  = o.label || o.displayName || ''
  const customer   = o.tag || (o.chatId ? `chat-${o.chatId}` : 'nomadly-customer')

  if (!productId)  throw new Error('createInstance requires productId')
  if (!regionSlug) throw new Error('createInstance requires regionSlug')

  const product = getProduct(productId)
  if (!product) throw new Error(`Unknown productId: ${productId}`)
  const location = REGION_TO_AZURE[regionSlug]
  if (!location) throw new Error(`Unknown regionSlug: ${regionSlug}`)
  const imgRef = _imageReference(osId)

  // ── Pre-flight capacity check ──────────────────────────────────────────
  // Verify the subscription has cores quota for this SKU family in this region
  // BEFORE we create any IP/NSG/VNet/NIC (which would otherwise be orphaned by
  // a 409 on the VM step). Throws a typed CAPACITY_UNAVAILABLE error so callers
  // can show a clean "temporarily out of capacity" message and refund.
  const cap = await checkCapacity(productId, regionSlug)
  if (!cap.ok && !cap.degraded) {
    const e = new Error(
      `Azure capacity unavailable: ${cap.family} in ${cap.location} has ` +
      `${cap.familyAvailable}/${cap.familyLimit} cores free (need ${cap.need}).`
    )
    e.code = 'CAPACITY_UNAVAILABLE'
    e.capacity = cap
    log(`  ⛔ Pre-flight capacity check failed: ${e.message}`)
    throw e
  }

  const vmName     = _generateVmName('nmd')
  const ipName     = `${vmName}-ip`
  const nicName    = `${vmName}-nic`
  const nsgName    = `${vmName}-nsg`
  const vnetName   = `${vmName}-vnet`
  const subnetName = 'default'

  const adminUser = _safeUsername(labelHint)
  const adminPwd  = _resolvePasswordSecret(o.password || o.rootPassword) || _generateAzurePassword(20, adminUser)

  const tags = {
    'created-by': 'nomadly',
    'customer':   String(customer).slice(0, 100),
    'chat-id':    String(o.chatId || '').slice(0, 50),
    'vps-id':     String(o.vpsId  || '').slice(0, 50),
    'product':    productId,
  }

  log(`createInstance: vm=${vmName} sku=${productId} region=${regionSlug}→${location} image=${osId} adminUser=${adminUser}`)

  try {
    // ── 1. Public IP (Standard SKU, static) ─────────────────────────────
    log(`  [1/5] Public IP ${ipName}`)
    const ipPath = `/subscriptions/${SUB_ID}/resourceGroups/${RG}/providers/Microsoft.Network/publicIPAddresses/${ipName}`
    let ip = await apiRequest(
      'PUT',
      ipPath,
      {
        apiVersion: '2023-09-01',
        body: {
          location,
          sku: { name: 'Standard', tier: 'Regional' },
          properties: { publicIPAllocationMethod: 'Static', publicIPAddressVersion: 'IPv4' },
          tags,
        },
      }
    )

    // ── 2. NSG with RDP rule ────────────────────────────────────────────
    log(`  [2/5] NSG ${nsgName} (RDP/3389 open)`)
    const nsgPath = `/subscriptions/${SUB_ID}/resourceGroups/${RG}/providers/Microsoft.Network/networkSecurityGroups/${nsgName}`
    await apiRequest(
      'PUT',
      nsgPath,
      {
        apiVersion: '2023-09-01',
        body: {
          location,
          properties: {
            securityRules: [{
              name: 'AllowRDP',
              properties: {
                protocol: 'Tcp',
                sourcePortRange: '*',
                destinationPortRange: '3389',
                sourceAddressPrefix: 'Internet',
                destinationAddressPrefix: '*',
                access: 'Allow',
                priority: 1000,
                direction: 'Inbound',
              },
            }],
          },
          tags,
        },
      }
    )

    // ── 3. VNet + Subnet ────────────────────────────────────────────────
    log(`  [3/5] VNet ${vnetName}`)
    const vnetPath = `/subscriptions/${SUB_ID}/resourceGroups/${RG}/providers/Microsoft.Network/virtualNetworks/${vnetName}`
    await apiRequest(
      'PUT',
      vnetPath,
      {
        apiVersion: '2023-09-01',
        body: {
          location,
          properties: {
            addressSpace: { addressPrefixes: ['10.0.0.0/24'] },
            subnets: [{ name: subnetName, properties: { addressPrefix: '10.0.0.0/24' } }],
          },
          tags,
        },
      }
    )
    const subnetId = `${vnetPath}/subnets/${subnetName}`

    // Wait for the 3 network prerequisites to finish provisioning before
    // creating the NIC (which references all three). Without this, Azure ARM
    // returns HTTP 429 `ReferencedResourceNotProvisioned`.
    log(`  [3.5/5] Waiting for IP, NSG, VNet to reach Succeeded…`)
    await Promise.all([
      _waitForResource(ipPath,   { apiVersion: '2023-09-01' }),
      _waitForResource(nsgPath,  { apiVersion: '2023-09-01' }),
      _waitForResource(vnetPath, { apiVersion: '2023-09-01' }),
    ])
    // Refresh the IP doc so we have the final allocated address (Standard
    // static IPs are assigned during the Succeeded transition).
    ip = await apiRequest('GET', ipPath, { apiVersion: '2023-09-01' })

    // ── 4. NIC ──────────────────────────────────────────────────────────
    log(`  [4/5] NIC ${nicName}`)
    const nicPath = `/subscriptions/${SUB_ID}/resourceGroups/${RG}/providers/Microsoft.Network/networkInterfaces/${nicName}`
    await apiRequest(
      'PUT',
      nicPath,
      {
        apiVersion: '2023-09-01',
        body: {
          location,
          properties: {
            ipConfigurations: [{
              name: 'ipconfig1',
              properties: {
                subnet: { id: subnetId },
                publicIPAddress: { id: ip.id },
                privateIPAllocationMethod: 'Dynamic',
              },
            }],
            networkSecurityGroup: { id: nsgPath },
          },
          tags,
        },
      }
    )
    // Wait for the NIC too before attaching it to the VM
    await _waitForResource(nicPath, { apiVersion: '2023-09-01' })

    // ── 5. VM ───────────────────────────────────────────────────────────
    log(`  [5/5] VM ${vmName} (${productId} Windows Server)`)
    const vm = await apiRequest(
      'PUT',
      _vmPath(vmName),
      {
        apiVersion: '2024-11-01',
        body: {
          location,
          properties: {
            hardwareProfile: { vmSize: productId },
            storageProfile: {
              imageReference: imgRef,
              osDisk: {
                name: `${vmName}-osdisk`,
                createOption: 'FromImage',
                managedDisk: { storageAccountType: 'Premium_LRS' },
                diskSizeGB: product.osDiskSizeGB,
                caching: 'ReadWrite',
              },
            },
            osProfile: {
              computerName: vmName,
              adminUsername: adminUser,
              adminPassword: adminPwd,
              windowsConfiguration: {
                provisionVMAgent: true,
                enableAutomaticUpdates: true,
              },
            },
            networkProfile: {
              networkInterfaces: [{
                id: `/subscriptions/${SUB_ID}/resourceGroups/${RG}/providers/Microsoft.Network/networkInterfaces/${nicName}`,
                properties: { primary: true },
              }],
            },
          },
          tags,
        },
      }
    )

    // Persist the password as a fake-secret-id (Contabo-compat) so the bot can
    // store the id in vpsPlansOf without writing the raw password.
    const secretId = `az-pwd-${vmName}-${Date.now().toString(36)}`
    _passwordSecrets.set(secretId, { password: adminPwd, name: secretId, createdAt: Date.now() })

    _trackCreateResult(true)
    log(`  ✅ VM ${vmName} provisioning started (Azure async — full IP/Ready in ~3-5 min)`)
    return {
      instanceId:      _wrapId(vmName),
      mainIp:          ip.properties?.ipAddress || null,
      defaultPassword: adminPwd,
      defaultUser:     adminUser,
      passwordSecretId: secretId,
      status:          vm.properties?.provisioningState || 'Creating',
      raw:             { vm, ip },
    }
  } catch (err) {
    _trackCreateResult(false, err)
    // Full cleanup so a partial/failed provision never leaves orphan resources.
    // Orphan Public IPs / NICs / NSGs / VNets bill silently. The OLD loop used a
    // Compute api-version for NETWORK resources AND fired all deletes at once
    // with no ordering, so IP/VNet deletes 400'd ("in use" by the still-present
    // NIC) and were swallowed → orphans accumulated (2026-06 RCA: 15 orphans
    // found across 4 failed attempts). Now we delete in dependency order with
    // the correct api-version and wait for each to fully disappear.
    log(`  ❌ createInstance failed: ${err.message} — cleaning up`)
    try { await _cleanupVmResources({ vmName, nicName, nsgName, vnetName, ipName }) }
    catch (ce) { log(`  cleanup error (manual check may be needed): ${ce.message}`) }
    throw err
  }
}

// ─── Cleanup helpers (delete partial/failed provisions with no orphans) ──────
async function _deleteAndWait(provider, kind, name, apiVersion, { maxAttempts = 30, intervalMs = 3000 } = {}) {
  if (!name) return true
  const path = `/subscriptions/${SUB_ID}/resourceGroups/${RG}/providers/${provider}/${kind}/${name}`
  try { await apiRequest('DELETE', path, { apiVersion }) }
  catch (e) { if (e.status !== 404) log(`  cleanup DELETE ${kind}/${name} → ${e.message}`) }
  // Poll GET until 404 (fully gone) so dependent deletes don't 400 "in use".
  for (let i = 0; i < maxAttempts; i++) {
    try { await apiRequest('GET', path, { apiVersion }) }
    catch (e) { if (e.status === 404) return true }
    await new Promise(r => setTimeout(r, intervalMs))
  }
  return false
}

async function _cleanupVmResources({ vmName, nicName, nsgName, vnetName, ipName }) {
  const NET = '2023-09-01'
  // Order matters: VM releases the NIC; NIC releases the IP + subnet.
  if (vmName)  await _deleteAndWait('Microsoft.Compute', 'virtualMachines', vmName, '2024-11-01')
  if (nicName) await _deleteAndWait('Microsoft.Network', 'networkInterfaces', nicName, NET)
  // Managed OS disk left behind by VM delete (bills too).
  if (vmName)  { try { await _deleteAndWait('Microsoft.Compute', 'disks', `${vmName}-osdisk`, '2023-04-02', { maxAttempts: 12 }) } catch (_) {} }
  await Promise.all([
    ipName   ? _deleteAndWait('Microsoft.Network', 'publicIPAddresses', ipName, NET)     : null,
    nsgName  ? _deleteAndWait('Microsoft.Network', 'networkSecurityGroups', nsgName, NET) : null,
    vnetName ? _deleteAndWait('Microsoft.Network', 'virtualNetworks', vnetName, NET)      : null,
  ].filter(Boolean))
  log(`  🧹 cleanup complete for ${vmName || nicName || ipName}`)
}

// ─── Live SKU availability + multi-region fallback ───────────────────────────
// Azure quota (usages API) only says how many cores you MAY use — NOT whether a
// region currently has hardware for a SKU. The SKUs API exposes per-region
// `restrictions` (NotAvailableForSubscription / location / zone) which flips
// minute-to-minute. We use it to SKIP regions that can't serve the SKU right
// now and to drive cross-region fallback so a single capacity blip never fails
// the whole purchase.
async function isSkuAvailableInRegion(productId, regionSlug) {
  const location = REGION_TO_AZURE[regionSlug] || regionSlug
  if (!location || !SUB_ID) return true // fail-open
  try {
    const data = await apiRequest('GET',
      `/subscriptions/${SUB_ID}/providers/Microsoft.Compute/skus`,
      { apiVersion: '2021-07-01', query: { '$filter': `location eq '${location}'` } })
    const sku = (data?.value || []).find(s => s.name === productId && s.resourceType === 'virtualMachines')
    if (!sku) return false                       // not offered in this region
    return (sku.restrictions || []).length === 0 // no restriction = available now
  } catch (e) {
    log(`isSkuAvailableInRegion(${productId}@${location}) error: ${e.message} — fail-open`)
    return true
  }
}

// Sensible default rotation (requested region is always tried first).
const DEFAULT_REGION_FALLBACK = ['US-east', 'US-west', 'US-central', 'EU', 'UK', 'AU', 'SG', 'IN', 'JP']

function _isCapacityError(err) {
  if (!err) return false
  const code = String(err.code || '')
  if (['CAPACITY_UNAVAILABLE', 'SkuNotAvailable', 'AllocationFailed', 'OverconstrainedAllocationRequest', 'ZonalAllocationFailed', 'NO_CAPACITY_ANY_REGION'].includes(code)) return true
  const msg = String(err.message || '')
  return err.status === 409 && /not available|capacity|allocation|sku/i.test(msg)
}

/**
 * createInstance with automatic cross-region fallback. Tries the requested
 * region first, then rotates through DEFAULT_REGION_FALLBACK, skipping any
 * region where the SKU is currently restricted (live SKUs API check) and
 * retrying the next region on a capacity 409. Each failed attempt is fully
 * cleaned up by createInstance's own catch. Returns the createInstance result
 * augmented with `_actualRegion` (the region that actually succeeded).
 */
async function createInstanceWithFallback(opts) {
  const o = opts || {}
  const productId = o.productId
  const requested = o.regionSlug || o.region
  const candidates = [requested, ...DEFAULT_REGION_FALLBACK].filter((r, i, a) => r && a.indexOf(r) === i)
  const attempts = []
  let lastErr = null
  for (const region of candidates) {
    const avail = await isSkuAvailableInRegion(productId, region)
    if (!avail) { attempts.push(`${region}:restricted`); log(`[fallback] ${productId} restricted in ${region} — skip`); continue }
    try {
      log(`[fallback] attempting ${productId} in ${region}`)
      const res = await createInstance({ ...o, region, regionSlug: region })
      res._actualRegion = region
      res._regionAttempts = attempts.concat(`${region}:OK`)
      if (region !== requested) log(`[fallback] ✅ ${productId} provisioned in ${region} (requested ${requested} was unavailable)`)
      return res
    } catch (e) {
      attempts.push(`${region}:${e.code || e.status || 'err'}`)
      lastErr = e
      if (_isCapacityError(e)) { log(`[fallback] capacity miss in ${region}: ${e.message} — next region`); continue }
      log(`[fallback] non-capacity error in ${region}: ${e.message} — aborting`)
      throw e
    }
  }
  const err = new Error(`Azure: no capacity for ${productId} in any candidate region. Attempts: ${attempts.join(', ')}`)
  err.code = 'NO_CAPACITY_ANY_REGION'
  err.cause = lastErr
  throw err
}

// ─── getInstance / listInstances ─────────────────────────────────────────
async function getInstance(instanceId) {
  const vmName = _stripIdPrefix(instanceId)
  // GET VM with instanceView so we can read powerState
  const vm = await apiRequest('GET', _vmPath(vmName), { apiVersion: '2024-11-01', query: { '$expand': 'instanceView' } })
  // Look up associated public IP
  let mainIp = null
  try {
    const nicRefs = vm.properties?.networkProfile?.networkInterfaces || []
    if (nicRefs.length) {
      const nic = await apiRequest('GET', nicRefs[0].id, { apiVersion: '2023-09-01' })
      const ipRef = nic.properties?.ipConfigurations?.[0]?.properties?.publicIPAddress?.id
      if (ipRef) {
        const ip = await apiRequest('GET', ipRef, { apiVersion: '2023-09-01' })
        mainIp = ip.properties?.ipAddress || null
      }
    }
  } catch (_) { /* ignore — IP may not have been allocated yet on a fresh VM */ }

  const provState = vm.properties?.provisioningState
  const power = (vm.properties?.instanceView?.statuses || [])
    .find(s => (s.code || '').startsWith('PowerState/'))
  const powerState = power ? power.code.replace('PowerState/', '') : 'unknown'

  return {
    instanceId:      _wrapId(vmName),
    mainIp,
    defaultPassword: null,
    defaultUser:     vm.properties?.osProfile?.adminUsername || null,
    status:          (powerState === 'running') ? 'active' : powerState,
    powerStatus:     powerState,
    serverStatus:    provState,
    region:          vm.location,
    plan:            vm.properties?.hardwareProfile?.vmSize,
    osId:            'win2022-datacenter-g2',
    label:           vm.name,
    tag:             vm.tags?.customer || null,
    dateCreated:     vm.properties?.timeCreated || null,
    isWindows:       true,
    ipConfig:        { v4: { ip: mainIp }, v6: { ip: null } },
    ipv4:            mainIp,
    raw:             vm,
  }
}

async function listInstances(filters = {}) {
  const d = await apiRequest('GET', `/subscriptions/${SUB_ID}/resourceGroups/${RG}/providers/Microsoft.Compute/virtualMachines`,
    { apiVersion: '2024-11-01' })
  const vms = d.value || []
  return vms
    .filter(v => !filters.tag || (v.tags?.customer === filters.tag))
    .map(v => ({
      instanceId: _wrapId(v.name),
      status:     v.properties?.provisioningState,
      region:     v.location,
      plan:       v.properties?.hardwareProfile?.vmSize,
      label:      v.name,
      tag:        v.tags?.customer || null,
      raw:        v,
    }))
}

// ─── Power actions (Azure async — POST returns 202 Accepted) ─────────────
async function _vmAction(instanceId, action) {
  const name = _stripIdPrefix(instanceId)
  return apiRequest('POST',
    `/subscriptions/${SUB_ID}/resourceGroups/${RG}/providers/Microsoft.Compute/virtualMachines/${name}/${action}`,
    { apiVersion: '2024-11-01' })
}

async function startInstance(instanceId)    { return _vmAction(instanceId, 'start') }
async function stopInstance(instanceId)     { return _vmAction(instanceId, 'powerOff') }       // ungraceful, retains IP
async function shutdownInstance(instanceId) { return _vmAction(instanceId, 'deallocate') }    // graceful + releases compute charges
async function restartInstance(instanceId)  { return _vmAction(instanceId, 'restart') }

// ─── resetPassword via VMAccessAgent extension ──────────────────────────
async function resetPassword(instanceId, opts = {}) {
  const vmName = _stripIdPrefix(instanceId)
  const vm = await apiRequest('GET', _vmPath(vmName), { apiVersion: '2024-11-01' })
  const adminUser = vm.properties?.osProfile?.adminUsername || 'nomadly'
  const newPassword = _generateAzurePassword(20, adminUser)
  // Use VMAccessAgent extension to reset password without rebuilding
  await apiRequest('PUT',
    `/subscriptions/${SUB_ID}/resourceGroups/${RG}/providers/Microsoft.Compute/virtualMachines/${vmName}/extensions/enablevmaccess`,
    {
      apiVersion: '2024-11-01',
      body: {
        location: vm.location,
        properties: {
          publisher: 'Microsoft.Compute',
          type: 'VMAccessAgent',
          typeHandlerVersion: '2.4',
          autoUpgradeMinorVersion: true,
          settings: { UserName: adminUser },
          protectedSettings: { Password: newPassword },
        },
      },
    }
  )
  const secretId = `az-pwd-${vmName}-${Date.now().toString(36)}`
  _passwordSecrets.set(secretId, { password: newPassword, name: secretId, createdAt: Date.now() })
  return {
    password:    newPassword,
    newPassword: newPassword,
    secretId,
    reinstalled: false,
    note:        'Azure VMAccessAgent extension reset the admin password in-place; no reboot or data loss. New password is delivered via Azure WAAgent (1-2 min). User name unchanged.',
    raw:         { vmName, adminUser },
  }
}

// ─── reinstallInstance (rebuild, IP preserved) ───────────────────────────
/**
 * Reinstall by destroying the VM + OS disk, then recreating in place with
 * the SAME NIC + Public IP. Customer's saved RDP credentials keep working
 * because the IP is unchanged. Data is wiped (intended).
 */
async function reinstallInstance(instanceId, opts = {}) {
  const vmName = _stripIdPrefix(instanceId)
  const vm = await apiRequest('GET', _vmPath(vmName), { apiVersion: '2024-11-01' })
  const location  = vm.location
  const sku       = vm.properties?.hardwareProfile?.vmSize
  const adminUser = vm.properties?.osProfile?.adminUsername || 'nomadly'
  const nicId     = vm.properties?.networkProfile?.networkInterfaces?.[0]?.id
  const tags      = vm.tags || {}
  const osDisk    = vm.properties?.storageProfile?.osDisk?.name
  const diskSize  = vm.properties?.storageProfile?.osDisk?.diskSizeGB || 64
  const imgRef    = _imageReference(opts.osId || opts.imageId || 'win2022-datacenter-g2')
  const product   = getProduct(sku) || { osDiskSizeGB: diskSize }
  const adminPwd  = _resolvePasswordSecret(opts.password || opts.rootPassword) || _generateAzurePassword(20, adminUser)

  log(`reinstallInstance: ${vmName} — destroying VM + OS disk, keeping NIC+IP`)
  // Step 1: delete VM
  await apiRequest('DELETE', _vmPath(vmName), { apiVersion: '2024-11-01' })
  // Step 2: delete the old OS disk
  if (osDisk) {
    try {
      await apiRequest('DELETE', `/subscriptions/${SUB_ID}/resourceGroups/${RG}/providers/Microsoft.Compute/disks/${osDisk}`,
        { apiVersion: '2024-11-01' })
    } catch (_) { /* may already be gone */ }
  }
  // Step 3: recreate VM bound to existing NIC
  log(`  Recreating ${vmName} on same NIC+IP`)
  const newVm = await apiRequest('PUT', _vmPath(vmName), {
    apiVersion: '2024-11-01',
    body: {
      location,
      properties: {
        hardwareProfile: { vmSize: sku },
        storageProfile: {
          imageReference: imgRef,
          osDisk: {
            name: `${vmName}-osdisk`,
            createOption: 'FromImage',
            managedDisk: { storageAccountType: 'Premium_LRS' },
            diskSizeGB: product.osDiskSizeGB || diskSize,
            caching: 'ReadWrite',
          },
        },
        osProfile: {
          computerName: vmName,
          adminUsername: adminUser,
          adminPassword: adminPwd,
          windowsConfiguration: { provisionVMAgent: true, enableAutomaticUpdates: true },
        },
        networkProfile: {
          networkInterfaces: [{ id: nicId, properties: { primary: true } }],
        },
      },
      tags,
    },
  })
  return { instanceId: _wrapId(vmName), password: adminPwd, defaultUser: adminUser, raw: newVm }
}

// ─── cancelInstance (delete VM + all associated resources) ───────────────
async function cancelInstance(instanceId, opts = {}) {
  if (opts.scheduleOnly) {
    log(`scheduleOnly cancel requested for ${instanceId} — no-op (Azure has no scheduled cancel; track via vpsPlansOf.autoRenewable=false)`)
    return { success: true, scheduleOnly: true, note: 'Azure has no scheduled cancellation; DB flag controls renewal.' }
  }
  const vmName = _stripIdPrefix(instanceId)
  log(`cancelInstance: ${vmName} — destroying VM + NIC + IP + NSG + VNet + OS disk`)
  // Delete in safe order: VM → NIC → IP → NSG → VNet → OS Disk
  const targets = [
    ['Microsoft.Compute/virtualMachines',          vmName],
    ['Microsoft.Network/networkInterfaces',        `${vmName}-nic`],
    ['Microsoft.Network/publicIPAddresses',        `${vmName}-ip`],
    ['Microsoft.Network/networkSecurityGroups',    `${vmName}-nsg`],
    ['Microsoft.Network/virtualNetworks',          `${vmName}-vnet`],
    ['Microsoft.Compute/disks',                    `${vmName}-osdisk`],
  ]
  const results = []
  for (const [type, name] of targets) {
    let lastErr = null
    let deleted = false
    // For Network resources we may need to retry: when VM provisioning fails
    // partway through, Azure holds the NIC "reserved" for up to ~180s, which
    // also blocks NSG / IP / VNet deletion. Up to 4 retries × 30s = 2 min.
    const maxRetries = type.startsWith('Microsoft.Network') ? 4 : 1
    // Per-resource API version. Disks accept 2025-01-02 (not 2024-11-01).
    const apiVersion = type === 'Microsoft.Compute/disks' ? '2025-01-02'
                     : type.startsWith('Microsoft.Compute') ? '2024-11-01'
                     : '2023-09-01'
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await apiRequest('DELETE', `/subscriptions/${SUB_ID}/resourceGroups/${RG}/providers/${type}/${name}`,
          { apiVersion })
        deleted = true
        break
      } catch (e) {
        lastErr = e
        if (e.status === 404) { deleted = true; break } // already gone
        // Only retry on transient conflicts; bail immediately for auth/other errors
        if (e.status !== 400 && e.status !== 409) break
        if (attempt < maxRetries) {
          log(`  retry [${attempt}/${maxRetries - 1}] deleting ${type}/${name} in 30s (status=${e.status})`)
          await new Promise(r => setTimeout(r, 30_000))
        }
      }
    }
    if (deleted) {
      results.push({ type, name, deleted: true })
    } else {
      log(`  warn deleting ${type}/${name}: ${lastErr?.message}`)
      results.push({ type, name, deleted: false, err: lastErr?.status })
    }
  }
  return { success: true, results }
}

// ─── upgradeInstance — resize VM SKU ─────────────────────────────────────
async function upgradeInstance(instanceId, newProductId) {
  const vmName = _stripIdPrefix(instanceId)
  const product = getProduct(newProductId)
  if (!product) throw new Error(`Unknown productId: ${newProductId}`)
  const vm = await apiRequest('GET', _vmPath(vmName), { apiVersion: '2024-11-01' })
  // PATCH for resize — Azure handles power-off/resize/power-on internally for B-series.
  return apiRequest('PATCH', _vmPath(vmName), {
    apiVersion: '2024-11-01',
    body: { properties: { hardwareProfile: { vmSize: product.azureSku } } },
  }).then(d => ({ instanceId: _wrapId(vmName), newSize: product.azureSku, raw: d }))
   .catch(e => { throw new Error(`resize ${vmName} → ${newProductId} failed: ${e.message}`) })
}

async function updateInstanceName(instanceId, displayName) {
  // Azure VM name is immutable post-create. We update the customer-facing
  // tag instead so the bot UI can display a friendly name.
  const vmName = _stripIdPrefix(instanceId)
  return apiRequest('PATCH', _vmPath(vmName), {
    apiVersion: '2024-11-01',
    body: { tags: { customer: String(displayName).slice(0, 100) } },
  })
}

// ─── Snapshots ───────────────────────────────────────────────────────────
// Azure ARM uses a different api-version namespace for snapshots vs VMs.
// Snapshots accept up to `2025-01-02` (2024-11-01 returns NoRegisteredProviderFound).
const _SNAPSHOT_API_VERSION = '2025-01-02'

async function createSnapshot(instanceId, name, description = '') {
  const vmName = _stripIdPrefix(instanceId)
  const vm = await apiRequest('GET', _vmPath(vmName), { apiVersion: '2024-11-01' })
  const osDisk = vm.properties?.storageProfile?.osDisk?.managedDisk?.id
  if (!osDisk) throw new Error('VM has no managed OS disk')
  const snapName = String(name || `${vmName}-snap-${Date.now()}`).replace(/[^a-zA-Z0-9-]/g, '-').slice(0, 80)
  const result = await apiRequest('PUT',
    `/subscriptions/${SUB_ID}/resourceGroups/${RG}/providers/Microsoft.Compute/snapshots/${snapName}`,
    {
      apiVersion: _SNAPSHOT_API_VERSION,
      body: {
        location: vm.location,
        properties: { creationData: { createOption: 'Copy', sourceResourceId: osDisk } },
        tags: { ...(vm.tags || {}), description: description.slice(0, 200), 'snapshot-of': vmName },
      },
    }
  )
  return { ...result, snapshotId: snapName, name: snapName }
}

async function listSnapshots(instanceId) {
  const d = await apiRequest('GET',
    `/subscriptions/${SUB_ID}/resourceGroups/${RG}/providers/Microsoft.Compute/snapshots`,
    { apiVersion: _SNAPSHOT_API_VERSION })
  const all = d.value || []
  // Normalise to cross-provider shape (snapshotId + name).
  const normalised = all.map(s => ({
    ...s,
    snapshotId:   s.name,
    snapshotName: s.name,
  }))
  if (!instanceId) return normalised
  const vmName = _stripIdPrefix(instanceId)
  return normalised.filter(s => s.tags?.['snapshot-of'] === vmName)
}

async function deleteSnapshot(_instanceId, snapshotId) {
  // snapshotId can be a short name or full ARM id
  const path = snapshotId.startsWith('/subscriptions/')
    ? snapshotId
    : `/subscriptions/${SUB_ID}/resourceGroups/${RG}/providers/Microsoft.Compute/snapshots/${snapshotId}`
  return apiRequest('DELETE', path, { apiVersion: _SNAPSHOT_API_VERSION })
}

// ─── Tags ────────────────────────────────────────────────────────────────
async function createTag(name, _color) {
  // Azure tags are key-value pairs on resources, not stand-alone objects.
  // No-op for cross-provider compatibility.
  return { id: name, name }
}
async function listTags() { return [] }

// ─── Secrets / SSH (compat shim) ─────────────────────────────────────────
async function createSecret(name, value, type = 'password') {
  if (type === 'password') {
    const secretId = `az-pwd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    _passwordSecrets.set(secretId, { password: value, name, createdAt: Date.now() })
    return { secretId, id: secretId, name, type: 'password' }
  }
  // Azure RDP doesn't use SSH keys (Windows). Stash the value as a fake
  // secret so the upstream call sites don't break, but it's unused.
  if (type === 'ssh') {
    const secretId = `az-ssh-${Date.now().toString(36)}`
    _passwordSecrets.set(secretId, { password: value, name, type: 'ssh', createdAt: Date.now() })
    return { secretId, id: secretId, name, type: 'ssh', note: 'Azure RDP does not use SSH keys' }
  }
  throw new Error(`Azure createSecret: unsupported type "${type}"`)
}
async function listSecrets(_type = null) { return [] }
async function getSecret(secretId) {
  if (_isFakePwdId(secretId)) {
    const c = _passwordSecrets.get(secretId)
    return c ? { id: secretId, name: c.name, type: c.type || 'password' } : null
  }
  return null
}
async function deleteSecret(secretId) {
  if (_isFakePwdId(secretId)) {
    _passwordSecrets.delete(secretId)
    return { success: true }
  }
  return { success: true }
}

// ─── Display helpers ─────────────────────────────────────────────────────
function isNVMeProduct(_productId) { return false }
function isSSDProduct(_productId)  { return true }

function formatSpecs(product) {
  const ramGb  = product.ramGb  || Math.round((product.ramMb  || 0) / 1024)
  const diskGb = product.diskGb || Math.round((product.diskMb || 0) / 1024)
  return `${product.cpuCores} vCPU | ${ramGb} GB RAM | ${diskGb} GB SSD`
}

function _reverseRegionLabel(azureSlug) {
  for (const [cust, az] of Object.entries(REGION_TO_AZURE)) {
    if (az === azureSlug) return REGION_DISPLAY[cust]?.label || azureSlug
  }
  return azureSlug
}

function formatInstanceForDisplay(instance) {
  const ip = instance.mainIp || instance.ip || 'Provisioning...'
  const product = getProduct(instance.productId || instance.plan)
  const power = (instance.powerStatus || instance.status || 'unknown').toLowerCase()
  const statusEmoji = {
    running: '🟢', active: '🟢',
    stopped: '🔴', deallocated: '🔴', off: '🔴',
    creating: '🟡', provisioning: '🟡', starting: '🟡', updating: '🟡',
    failed: '❌', error: '❌',
    unknown: '⚪',
  }[power] || '⚪'
  return {
    instanceId:   instance.instanceId,
    name:         instance.displayName || instance.label || instance.name,
    status:       power,
    statusEmoji,
    ip,
    ipv6:         '',
    region:       instance.region || '',
    regionName:   _reverseRegionLabel(instance.region),
    productId:    instance.productId || instance.plan,
    productName:  product?.name || instance.productName || instance.plan,
    cpuCores:     instance.cpuCores || product?.cpuCores,
    ramGb:        Math.round((instance.ramMb || product?.ramMb || 0) / 1024),
    diskGb:       Math.round((instance.diskMb || product?.diskMb || 0) / 1024),
    osType:       'Windows',
    isWindows:    true,
    createdDate:  instance.createdDate || instance.dateCreated,
    cancelDate:   null,
    defaultUser:  instance.defaultUser || 'nomadly',
  }
}

// ─── Public surface ──────────────────────────────────────────────────────
module.exports = {
  PROVIDER,
  ID_PREFIX,
  // Pricing
  MARKUP_PERCENT,
  applyMarkup,
  calculatePrice,
  // Products
  PRODUCT_CATALOG,
  PRODUCT_CATALOG_SSD,
  listProducts,
  getProduct,
  checkCapacity,
  isNVMeProduct,
  isSSDProduct,
  // Regions
  REGION_DISPLAY,
  REGION_TO_AZURE,
  REGION_SURCHARGE,
  listRegions,
  // Images / OS
  listImages,
  getDefaultWindowsImageId,
  getCompatibleWindowsImage,
  getCompatibleLinuxImage,
  WINDOWS_LICENSE_BY_TIER,
  // Display
  formatSpecs,
  formatInstanceForDisplay,
  // Instances
  createInstance,
  createInstanceWithFallback,
  isSkuAvailableInRegion,
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
  // Secrets
  createSecret,
  listSecrets,
  getSecret,
  deleteSecret,
  // Circuit breaker
  isProvisioningHealthy,
  getCircuitState,
  resetProvisioningCircuit,
  onProvisioningCircuitOpen,
  // Internal helpers (exported for tests)
  _stripIdPrefix,
  _wrapId,
  _generateAzurePassword,
  _safeUsername,
  _generateVmName,
  _imageReference,
  // Low-level
  apiRequest,
  _getToken,
}
