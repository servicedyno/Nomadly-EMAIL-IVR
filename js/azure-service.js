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
const _B_TIERS = [
  {
    productId:   'Standard_B1ms',
    name:        'Cloud VPS 10',
    cpuCores:    1, ramMb: 2048, diskMb: 64 * 1024,
    diskType:    'ssd', bandwidthTb: 0.1, portSpeedMbps: 1000,
    basePriceUsd: 30, tier: 1,
    azureSku:    'Standard_B1ms', osDiskSizeGB: 64,
  },
  {
    productId:   'Standard_B2s',
    name:        'Cloud VPS 20',
    cpuCores:    2, ramMb: 4096, diskMb: 64 * 1024,
    diskType:    'ssd', bandwidthTb: 0.1, portSpeedMbps: 1000,
    basePriceUsd: 52, tier: 2,
    azureSku:    'Standard_B2s', osDiskSizeGB: 64,
  },
  {
    productId:   'Standard_B2ms',
    name:        'Cloud VPS 30',
    cpuCores:    2, ramMb: 8192, diskMb: 128 * 1024,
    diskType:    'ssd', bandwidthTb: 0.2, portSpeedMbps: 1000,
    basePriceUsd: 96, tier: 3,
    azureSku:    'Standard_B2ms', osDiskSizeGB: 128,
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
// Final catalog = B-tier always + D-tier when env flag enabled
const PRODUCT_CATALOG = DSV5_ENABLED ? [..._B_TIERS, ..._D_TIERS] : _B_TIERS
const PRODUCT_CATALOG_SSD = PRODUCT_CATALOG // alias for cross-provider compat

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
  return PRODUCT_CATALOG.find(p => p.productId === productId) || null
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
const WINDOWS_IMAGES = [
  {
    imageId:   'win2022-datacenter',
    name:      'Windows Server 2022 Datacenter',
    family:    'Windows Server',
    publisher: 'MicrosoftWindowsServer',
    offer:     'WindowsServer',
    sku:       '2022-Datacenter',
    version:   'latest',
    isDefault: true,
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
    imageId:   'win2019-datacenter',
    name:      'Windows Server 2019 Datacenter',
    family:    'Windows Server',
    publisher: 'MicrosoftWindowsServer',
    offer:     'WindowsServer',
    sku:       '2019-Datacenter',
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
  return 'win2022-datacenter'
}
async function getCompatibleWindowsImage(currentImageId, _productId) {
  return currentImageId || 'win2022-datacenter'
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
 *   osId           — optional, defaults to 'win2022-datacenter'
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
  const osId       = o.osId || o.imageId || 'win2022-datacenter'
  const labelHint  = o.label || o.displayName || ''
  const customer   = o.tag || (o.chatId ? `chat-${o.chatId}` : 'nomadly-customer')

  if (!productId)  throw new Error('createInstance requires productId')
  if (!regionSlug) throw new Error('createInstance requires regionSlug')

  const product = getProduct(productId)
  if (!product) throw new Error(`Unknown productId: ${productId}`)
  const location = REGION_TO_AZURE[regionSlug]
  if (!location) throw new Error(`Unknown regionSlug: ${regionSlug}`)
  const imgRef = _imageReference(osId)

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
    const ip = await apiRequest(
      'PUT',
      `/subscriptions/${SUB_ID}/resourceGroups/${RG}/providers/Microsoft.Network/publicIPAddresses/${ipName}`,
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
    await apiRequest(
      'PUT',
      `/subscriptions/${SUB_ID}/resourceGroups/${RG}/providers/Microsoft.Network/networkSecurityGroups/${nsgName}`,
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
    await apiRequest(
      'PUT',
      `/subscriptions/${SUB_ID}/resourceGroups/${RG}/providers/Microsoft.Network/virtualNetworks/${vnetName}`,
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
    const subnetId = `/subscriptions/${SUB_ID}/resourceGroups/${RG}/providers/Microsoft.Network/virtualNetworks/${vnetName}/subnets/${subnetName}`

    // ── 4. NIC ──────────────────────────────────────────────────────────
    log(`  [4/5] NIC ${nicName}`)
    await apiRequest(
      'PUT',
      `/subscriptions/${SUB_ID}/resourceGroups/${RG}/providers/Microsoft.Network/networkInterfaces/${nicName}`,
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
            networkSecurityGroup: {
              id: `/subscriptions/${SUB_ID}/resourceGroups/${RG}/providers/Microsoft.Network/networkSecurityGroups/${nsgName}`,
            },
          },
          tags,
        },
      }
    )

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
    // Best-effort cleanup so a partial provision doesn't leave orphan resources
    log(`  ❌ createInstance failed: ${err.message} — attempting cleanup`)
    for (const [kind, name] of [
      ['virtualMachines', vmName],
      ['networkInterfaces', nicName],
      ['networkSecurityGroups', nsgName],
      ['virtualNetworks', vnetName],
      ['publicIPAddresses', ipName],
    ]) {
      try {
        const provider = (kind === 'virtualMachines') ? 'Microsoft.Compute' : 'Microsoft.Network'
        await apiRequest('DELETE', `/subscriptions/${SUB_ID}/resourceGroups/${RG}/providers/${provider}/${kind}/${name}`,
          { apiVersion: '2024-11-01' })
      } catch (_) { /* ignore — resource may not have been created */ }
    }
    throw err
  }
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
    osId:            'win2022-datacenter',
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
  const imgRef    = _imageReference(opts.osId || opts.imageId || 'win2022-datacenter')
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
    try {
      await apiRequest('DELETE', `/subscriptions/${SUB_ID}/resourceGroups/${RG}/providers/${type}/${name}`,
        { apiVersion: type.startsWith('Microsoft.Compute') ? '2024-11-01' : '2023-09-01' })
      results.push({ type, name, deleted: true })
    } catch (e) {
      // 404 is fine (already gone). Other errors logged but don't abort the
      // remaining deletes — best-effort teardown.
      if (e.status !== 404) log(`  warn deleting ${type}/${name}: ${e.message}`)
      results.push({ type, name, deleted: false, err: e.status })
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
async function createSnapshot(instanceId, name, description = '') {
  const vmName = _stripIdPrefix(instanceId)
  const vm = await apiRequest('GET', _vmPath(vmName), { apiVersion: '2024-11-01' })
  const osDisk = vm.properties?.storageProfile?.osDisk?.managedDisk?.id
  if (!osDisk) throw new Error('VM has no managed OS disk')
  const snapName = String(name || `${vmName}-snap-${Date.now()}`).replace(/[^a-zA-Z0-9-]/g, '-').slice(0, 80)
  return apiRequest('PUT',
    `/subscriptions/${SUB_ID}/resourceGroups/${RG}/providers/Microsoft.Compute/snapshots/${snapName}`,
    {
      apiVersion: '2024-11-01',
      body: {
        location: vm.location,
        properties: { creationData: { createOption: 'Copy', sourceResourceId: osDisk } },
        tags: { ...(vm.tags || {}), description: description.slice(0, 200), 'snapshot-of': vmName },
      },
    }
  )
}

async function listSnapshots(instanceId) {
  const d = await apiRequest('GET',
    `/subscriptions/${SUB_ID}/resourceGroups/${RG}/providers/Microsoft.Compute/snapshots`,
    { apiVersion: '2024-11-01' })
  const all = d.value || []
  if (!instanceId) return all
  const vmName = _stripIdPrefix(instanceId)
  return all.filter(s => s.tags?.['snapshot-of'] === vmName)
}

async function deleteSnapshot(_instanceId, snapshotId) {
  // snapshotId can be a short name or full ARM id
  const path = snapshotId.startsWith('/subscriptions/')
    ? snapshotId
    : `/subscriptions/${SUB_ID}/resourceGroups/${RG}/providers/Microsoft.Compute/snapshots/${snapshotId}`
  return apiRequest('DELETE', path, { apiVersion: '2024-11-01' })
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
