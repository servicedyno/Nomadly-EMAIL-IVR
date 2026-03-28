/**
 * contabo-service.js — Contabo API v1 wrapper
 *
 * Handles: OAuth2 auth, products catalog, regions, images,
 *          instance CRUD, secrets (SSH keys), pricing with markup.
 *
 * Replaces the dead Nameword intermediary.
 */

require('dotenv').config()
const axios = require('axios')
const { v4: uuidv4 } = require('uuid')

// ─── Contabo OAuth2 credentials ───────────────────────────────────────────
const AUTH_URL = 'https://auth.contabo.com/auth/realms/contabo/protocol/openid-connect/token'
const API_BASE = 'https://api.contabo.com/v1'

const CLIENT_ID     = process.env.CONTABO_CLIENT_ID
const CLIENT_SECRET = process.env.CONTABO_CLIENT_SECRET
const API_USER      = process.env.CONTABO_API_USER
const API_PASSWORD  = process.env.CONTABO_API_PASSWORD

const MARKUP_PERCENT = parseFloat(process.env.VPS_MARKUP_PERCENT || '50')
const WINDOWS_LICENSE_MONTHLY = parseFloat(process.env.VPS_WINDOWS_LICENSE || '4.99')

// ─── Token cache ──────────────────────────────────────────────────────────
let _tokenCache = { token: null, expiresAt: 0 }

/**
 * Get a valid OAuth2 access token. Caches & auto-refreshes 60s before expiry.
 */
async function getAccessToken() {
  const now = Date.now()
  if (_tokenCache.token && now < _tokenCache.expiresAt - 60000) {
    return _tokenCache.token
  }

  try {
    const params = new URLSearchParams({
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      username:      API_USER,
      password:      API_PASSWORD,
      grant_type:    'password'
    })

    const res = await axios.post(AUTH_URL, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000
    })

    _tokenCache = {
      token:     res.data.access_token,
      expiresAt: now + (res.data.expires_in * 1000)
    }

    console.log(`[Contabo] Token acquired, expires in ${res.data.expires_in}s`)
    return _tokenCache.token
  } catch (err) {
    console.error('[Contabo] Token fetch failed:', err?.response?.data || err.message)
    throw new Error('Contabo authentication failed')
  }
}

/**
 * Make an authenticated request to the Contabo API.
 */
async function apiRequest(method, path, data = null, params = null) {
  const token = await getAccessToken()
  const config = {
    method,
    url: `${API_BASE}${path}`,
    headers: {
      'Authorization':  `Bearer ${token}`,
      'x-request-id':   uuidv4(),
      'Content-Type':   'application/json'
    },
    timeout: 30000
  }
  if (data)   config.data   = data
  if (params) config.params = params

  try {
    const res = await axios(config)
    return res.data
  } catch (err) {
    const errData = err?.response?.data || err.message
    const status  = err?.response?.status || 'unknown'
    console.error(`[Contabo] API ${method} ${path} failed (${status}):`, JSON.stringify(errData))
    throw { status, message: errData?.message || errData, raw: errData }
  }
}

// ─── Product Catalog (hardcoded — Contabo has no products API) ────────────
// Prices are Contabo's base monthly prices in USD (as of March 2026).
// productType 'nvme' → half the disk of 'ssd' but faster.
const PRODUCT_CATALOG = [
  {
    productId:   'V45',
    name:        'Cloud VPS 1',
    cpuCores:    4,
    ramMb:       8192,
    diskMb:      51200,    // 50 GB NVMe
    diskType:    'nvme',
    bandwidthTb: 32,
    portSpeedMbps: 200,
    basePriceUsd: 4.50,
    tier: 1
  },
  {
    productId:   'V47',
    name:        'Cloud VPS 2',
    cpuCores:    6,
    ramMb:       16384,
    diskMb:      102400,   // 100 GB NVMe
    diskType:    'nvme',
    bandwidthTb: 32,
    portSpeedMbps: 300,
    basePriceUsd: 7.50,
    tier: 2
  },
  {
    productId:   'V49',
    name:        'Cloud VPS 3',
    cpuCores:    8,
    ramMb:       24576,
    diskMb:      204800,   // 200 GB NVMe
    diskType:    'nvme',
    bandwidthTb: 32,
    portSpeedMbps: 600,
    basePriceUsd: 14.00,
    tier: 3
  },
  {
    productId:   'V51',
    name:        'Cloud VPS 4',
    cpuCores:    12,
    ramMb:       49152,
    diskMb:      256000,   // 250 GB NVMe
    diskType:    'nvme',
    bandwidthTb: 32,
    portSpeedMbps: 800,
    basePriceUsd: 25.00,
    tier: 4
  },
  {
    productId:   'V53',
    name:        'Cloud VPS 5',
    cpuCores:    16,
    ramMb:       65536,
    diskMb:      307200,   // 300 GB NVMe
    diskType:    'nvme',
    bandwidthTb: 32,
    portSpeedMbps: 1000,
    basePriceUsd: 37.00,
    tier: 5
  },
  {
    productId:   'V55',
    name:        'Cloud VPS 6',
    cpuCores:    18,
    ramMb:       98304,
    diskMb:      358400,   // 350 GB NVMe
    diskType:    'nvme',
    bandwidthTb: 32,
    portSpeedMbps: 1000,
    basePriceUsd: 49.00,
    tier: 6
  }
]

// SSD variants (2x disk, same price)
const PRODUCT_CATALOG_SSD = [
  { productId: 'V92',  name: 'Cloud VPS 1 SSD', cpuCores: 4,  ramMb: 8192,  diskMb: 153600, diskType: 'ssd', bandwidthTb: 32, portSpeedMbps: 200,  basePriceUsd: 4.50,  tier: 1 },
  { productId: 'V93',  name: 'Cloud VPS 2 SSD', cpuCores: 6,  ramMb: 16384, diskMb: 204800, diskType: 'ssd', bandwidthTb: 32, portSpeedMbps: 300,  basePriceUsd: 7.50,  tier: 2 },
  { productId: 'V94',  name: 'Cloud VPS 3 SSD', cpuCores: 8,  ramMb: 24576, diskMb: 409600, diskType: 'ssd', bandwidthTb: 32, portSpeedMbps: 600,  basePriceUsd: 14.00, tier: 3 },
  { productId: 'V95',  name: 'Cloud VPS 4 SSD', cpuCores: 12, ramMb: 49152, diskMb: 512000, diskType: 'ssd', bandwidthTb: 32, portSpeedMbps: 800,  basePriceUsd: 25.00, tier: 4 },
  { productId: 'V96',  name: 'Cloud VPS 5 SSD', cpuCores: 16, ramMb: 65536, diskMb: 614400, diskType: 'ssd', bandwidthTb: 32, portSpeedMbps: 1000, basePriceUsd: 37.00, tier: 5 },
  { productId: 'V97',  name: 'Cloud VPS 6 SSD', cpuCores: 18, ramMb: 98304, diskMb: 716800, diskType: 'ssd', bandwidthTb: 32, portSpeedMbps: 1000, basePriceUsd: 49.00, tier: 6 }
]

// Region surcharges (monthly, USD) — applied on top of base price
const REGION_SURCHARGE = {
  'EU':         0.00,
  'US-central': 0.95,
  'US-east':    0.95,
  'US-west':    0.95,
  'UK':         0.95,
  'SIN':        3.95,
  'JPN':        3.95,
  'AUS':        1.95,
  'IND':        1.95
}

const REGION_DISPLAY = {
  'EU':         { emoji: '🇪🇺', label: 'Europe (EU)' },
  'US-central': { emoji: '🇺🇸', label: 'US Central' },
  'US-east':    { emoji: '🇺🇸', label: 'US East' },
  'US-west':    { emoji: '🇺🇸', label: 'US West' },
  'UK':         { emoji: '🇬🇧', label: 'United Kingdom' },
  'SIN':        { emoji: '🇸🇬', label: 'Singapore' },
  'JPN':        { emoji: '🇯🇵', label: 'Japan' },
  'AUS':        { emoji: '🇦🇺', label: 'Australia' },
  'IND':        { emoji: '🇮🇳', label: 'India' }
}

// ─── Pricing ──────────────────────────────────────────────────────────────

/**
 * Apply markup % to a base price. Returns number rounded to 2 decimals.
 */
function applyMarkup(basePrice) {
  return Math.round(basePrice * (1 + MARKUP_PERCENT / 100) * 100) / 100
}

/**
 * Calculate total monthly price for a plan + region + optional Windows license.
 * Returns { basePrice, regionSurcharge, windowsLicense, totalBeforeMarkup, totalWithMarkup }
 */
function calculatePrice(product, regionSlug, isWindows = false) {
  const base          = product.basePriceUsd
  const surcharge     = REGION_SURCHARGE[regionSlug] || 0
  const windowsFee    = isWindows ? WINDOWS_LICENSE_MONTHLY : 0
  const totalBefore   = base + surcharge + windowsFee
  const totalMarkedUp = applyMarkup(totalBefore)

  return {
    basePriceUsd:       base,
    regionSurcharge:    surcharge,
    windowsLicense:     windowsFee,
    totalBeforeMarkup:  Math.round(totalBefore * 100) / 100,
    totalWithMarkup:    totalMarkedUp,
    markupPercent:      MARKUP_PERCENT
  }
}

// ─── Products ─────────────────────────────────────────────────────────────

/**
 * List available VPS products with pricing for a given region.
 * @param {string} regionSlug - e.g. 'EU', 'US-east'
 * @param {boolean} isWindows - true = RDP, adds Windows license fee
 * @param {string} diskPreference - 'nvme' or 'ssd'
 */
function listProducts(regionSlug = 'EU', isWindows = false, diskPreference = 'nvme') {
  const catalog = diskPreference === 'ssd' ? PRODUCT_CATALOG_SSD : PRODUCT_CATALOG
  return catalog.map(p => ({
    ...p,
    ramGb:     Math.round(p.ramMb / 1024),
    diskGb:    Math.round(p.diskMb / 1024),
    pricing:   calculatePrice(p, regionSlug, isWindows)
  }))
}

/**
 * Get a single product by productId.
 */
function getProduct(productId) {
  return PRODUCT_CATALOG.find(p => p.productId === productId) ||
         PRODUCT_CATALOG_SSD.find(p => p.productId === productId) || null
}

// ─── Regions ──────────────────────────────────────────────────────────────

/**
 * List available regions with surcharges. Fetches from API and enriches with local data.
 */
async function listRegions() {
  try {
    // Fetch live data centers from Contabo
    const page1 = await apiRequest('GET', '/data-centers', null, { size: 50 })
    const dataCenters = page1.data || []

    // Group by region slug and deduplicate
    const regionMap = {}
    for (const dc of dataCenters) {
      if (!dc.capabilities.includes('VPS')) continue
      const slug = dc.regionSlug
      if (!regionMap[slug]) {
        regionMap[slug] = {
          regionSlug:  slug,
          regionName:  dc.regionName,
          dataCenters: [],
          surchargeUsd: REGION_SURCHARGE[slug] || 0,
          display: REGION_DISPLAY[slug] || { emoji: '🌍', label: dc.regionName }
        }
      }
      regionMap[slug].dataCenters.push({ name: dc.name, slug: dc.slug })
    }

    return Object.values(regionMap)
  } catch (err) {
    console.error('[Contabo] listRegions failed, using fallback:', err.message || err)
    // Fallback to hardcoded regions
    return Object.entries(REGION_DISPLAY).map(([slug, disp]) => ({
      regionSlug:   slug,
      regionName:   disp.label,
      dataCenters:  [],
      surchargeUsd: REGION_SURCHARGE[slug] || 0,
      display:      disp
    }))
  }
}

// ─── Images ───────────────────────────────────────────────────────────────

// Preferred Windows image for RDP (latest standard edition, no Plesk)
const DEFAULT_WINDOWS_IMAGE = 'windows-server-2025-se'

/**
 * List available OS images from Contabo API.
 * @param {string} filter - 'all', 'linux', 'windows', 'rdp'
 */
async function listImages(filter = 'all') {
  const res = await apiRequest('GET', '/compute/images', null, { size: 100, standardImage: true })
  let images = (res.data || []).filter(img => img.standardImage)

  // Filter out Plesk/cPanel variants for cleaner display (unless showing all)
  if (filter !== 'all') {
    images = images.filter(img => !img.name.includes('plesk') && !img.name.includes('cpanel'))
  }

  if (filter === 'linux') {
    images = images.filter(img => img.osType === 'Linux')
  } else if (filter === 'windows' || filter === 'rdp') {
    images = images.filter(img => img.osType === 'Windows')
  }

  return images.map(img => ({
    imageId:   img.imageId,
    name:      img.name,
    osType:    img.osType,
    version:   img.version,
    isWindows: img.osType === 'Windows'
  }))
}

/**
 * Get the default Windows image ID for RDP deployments.
 */
async function getDefaultWindowsImageId() {
  const images = await listImages('windows')
  // Prefer windows-server-2025-se (Standard Edition, no Plesk)
  const preferred = images.find(img => img.name === DEFAULT_WINDOWS_IMAGE)
  if (preferred) return preferred.imageId

  // Fallback: any Windows 2025, then 2022, then any
  const fallback = images.find(img => img.name.includes('2025') && !img.name.includes('plesk')) ||
                   images.find(img => img.name.includes('2022') && !img.name.includes('plesk')) ||
                   images[0]
  return fallback ? fallback.imageId : null
}

// ─── Secrets (SSH Keys & Passwords) ───────────────────────────────────────

/**
 * Create a secret (SSH public key or password).
 * @param {string} name - Secret name
 * @param {string} value - SSH public key string or password
 * @param {string} type - 'ssh' or 'password'
 */
async function createSecret(name, value, type = 'ssh') {
  const res = await apiRequest('POST', '/secrets', { name, value, type })
  return res.data?.[0] || res.data
}

/**
 * List all secrets, optionally filtered by type.
 */
async function listSecrets(type = null) {
  const res = await apiRequest('GET', '/secrets', null, { size: 100 })
  let secrets = res.data || []
  if (type) secrets = secrets.filter(s => s.type === type)
  return secrets
}

/**
 * Get a single secret by ID.
 */
async function getSecret(secretId) {
  const res = await apiRequest('GET', `/secrets/${secretId}`)
  return res.data?.[0] || res.data
}

/**
 * Delete a secret by ID.
 */
async function deleteSecret(secretId) {
  await apiRequest('DELETE', `/secrets/${secretId}`)
  return true
}

// ─── Instances ────────────────────────────────────────────────────────────

/**
 * Create a new VPS instance.
 * @param {Object} opts
 * @param {string} opts.productId   - e.g. 'V45' (NVMe) or 'V92' (SSD)
 * @param {string} opts.region      - e.g. 'EU', 'US-east'
 * @param {string} opts.imageId     - OS image UUID
 * @param {string} [opts.displayName] - Friendly name
 * @param {number[]} [opts.sshKeys]   - Array of secret IDs for SSH keys
 * @param {number} [opts.rootPassword] - Secret ID for root password
 * @param {string} [opts.userData]   - cloud-init user data
 * @param {number} [opts.period]     - Billing period in months (1=monthly)
 */
async function createInstance(opts) {
  const body = {
    imageId:   opts.imageId,
    productId: opts.productId,
    region:    opts.region,
    period:    opts.period || 1  // monthly billing
  }

  if (opts.displayName)  body.displayName = opts.displayName
  if (opts.sshKeys?.length) body.sshKeys  = opts.sshKeys
  if (opts.rootPassword) body.rootPassword = opts.rootPassword
  if (opts.userData)     body.userData     = opts.userData

  console.log(`[Contabo] Creating instance: productId=${opts.productId}, region=${opts.region}, image=${opts.imageId}`)
  const res = await apiRequest('POST', '/compute/instances', body)
  const instance = res.data?.[0] || res.data
  console.log(`[Contabo] Instance created: id=${instance?.instanceId}, name=${instance?.name}`)
  return instance
}

/**
 * Get instance details by ID.
 */
async function getInstance(instanceId) {
  const res = await apiRequest('GET', `/compute/instances/${instanceId}`)
  return res.data?.[0] || res.data
}

/**
 * List all instances on the account.
 * @param {Object} [filters] - Optional filters like { status, name, region }
 */
async function listInstances(filters = {}) {
  const params = { size: 100, ...filters }
  const res = await apiRequest('GET', '/compute/instances', null, params)
  return res.data || []
}

/**
 * Start an instance.
 */
async function startInstance(instanceId) {
  const res = await apiRequest('POST', `/compute/instances/${instanceId}/actions/start`)
  return res.data?.[0] || res.data
}

/**
 * Stop an instance.
 */
async function stopInstance(instanceId) {
  const res = await apiRequest('POST', `/compute/instances/${instanceId}/actions/stop`)
  return res.data?.[0] || res.data
}

/**
 * Restart an instance.
 */
async function restartInstance(instanceId) {
  const res = await apiRequest('POST', `/compute/instances/${instanceId}/actions/restart`)
  return res.data?.[0] || res.data
}

/**
 * Shutdown an instance gracefully.
 */
async function shutdownInstance(instanceId) {
  const res = await apiRequest('POST', `/compute/instances/${instanceId}/actions/shutdown`)
  return res.data?.[0] || res.data
}

/**
 * Reset the root/admin password for an instance.
 * Creates a password secret and applies it.
 * Returns the new password.
 */
async function resetPassword(instanceId) {
  // Contabo's resetPassword action uses a secretId for the new password
  // First generate a random password
  const crypto = require('crypto')
  const newPassword = crypto.randomBytes(16).toString('base64url').slice(0, 20)

  // Create a secret for the password
  const secret = await createSecret(`pwd-${instanceId}-${Date.now()}`, newPassword, 'password')
  const secretId = secret.secretId

  // Apply the reset
  const res = await apiRequest('POST', `/compute/instances/${instanceId}/actions/resetPassword`, {
    sshKeys: [],
    rootPassword: secretId
  })

  return { password: newPassword, secretId, response: res.data?.[0] || res.data }
}

/**
 * Reinstall an instance with a new OS image.
 */
async function reinstallInstance(instanceId, opts = {}) {
  const body = {}
  if (opts.imageId)      body.imageId      = opts.imageId
  if (opts.sshKeys)      body.sshKeys      = opts.sshKeys
  if (opts.rootPassword) body.rootPassword  = opts.rootPassword
  if (opts.userData)     body.userData      = opts.userData

  const res = await apiRequest('PUT', `/compute/instances/${instanceId}`, body)
  return res.data?.[0] || res.data
}

/**
 * Cancel (terminate) an instance.
 */
async function cancelInstance(instanceId) {
  console.log(`[Contabo] Cancelling instance ${instanceId}`)
  const res = await apiRequest('POST', `/compute/instances/${instanceId}/cancel`)
  console.log(`[Contabo] Instance ${instanceId} cancelled`)
  return res.data?.[0] || res.data
}

/**
 * Upgrade an instance to a higher plan.
 * Contabo API supports in-place upgrades!
 */
async function upgradeInstance(instanceId, newProductId) {
  console.log(`[Contabo] Upgrading instance ${instanceId} to ${newProductId}`)
  const res = await apiRequest('POST', `/compute/instances/${instanceId}/upgrade`, {
    productId: newProductId
  })
  console.log(`[Contabo] Instance ${instanceId} upgraded to ${newProductId}`)
  return res.data?.[0] || res.data
}

/**
 * Update instance display name.
 */
async function updateInstanceName(instanceId, displayName) {
  const res = await apiRequest('PATCH', `/compute/instances/${instanceId}`, { displayName })
  return res.data?.[0] || res.data
}

// ─── Snapshots ────────────────────────────────────────────────────────────

async function createSnapshot(instanceId, name, description = '') {
  const res = await apiRequest('POST', `/compute/instances/${instanceId}/snapshots`, {
    name, description
  })
  return res.data?.[0] || res.data
}

async function listSnapshots(instanceId) {
  const res = await apiRequest('GET', `/compute/instances/${instanceId}/snapshots`)
  return res.data || []
}

async function deleteSnapshot(instanceId, snapshotId) {
  await apiRequest('DELETE', `/compute/instances/${instanceId}/snapshots/${snapshotId}`)
  return true
}

// ─── Tags (for user-instance mapping) ─────────────────────────────────────

async function createTag(name, color = '#0d6efd') {
  const res = await apiRequest('POST', '/tags', { name, color })
  return res.data?.[0] || res.data
}

async function listTags() {
  const res = await apiRequest('GET', '/tags', null, { size: 100 })
  return res.data || []
}

async function deleteTag(tagId) {
  await apiRequest('DELETE', `/tags/${tagId}`)
  return true
}

// ─── Utility / Formatting ─────────────────────────────────────────────────

/**
 * Format instance data for display in Telegram bot.
 */
function formatInstanceForDisplay(instance) {
  const ip      = instance.ipConfig?.v4?.ip || 'Provisioning...'
  const ipv6    = instance.ipConfig?.v6?.ip || ''
  const product = getProduct(instance.productId)
  const ramGb   = Math.round((instance.ramMb || 0) / 1024)
  const diskGb  = Math.round((instance.diskMb || 0) / 1024)
  const statusEmoji = {
    running:      '🟢',
    stopped:      '🔴',
    provisioning: '🟡',
    installing:   '🟡',
    error:        '❌',
    unknown:      '⚪'
  }

  return {
    instanceId:   instance.instanceId,
    name:         instance.displayName || instance.name,
    status:       instance.status,
    statusEmoji:  statusEmoji[instance.status] || '⚪',
    ip,
    ipv6,
    region:       instance.region,
    regionName:   instance.regionName || REGION_DISPLAY[instance.region]?.label || instance.region,
    productId:    instance.productId,
    productName:  product?.name || instance.productName || instance.productId,
    cpuCores:     instance.cpuCores,
    ramGb,
    diskGb,
    osType:       instance.osType,
    isWindows:    instance.osType === 'Windows',
    createdDate:  instance.createdDate,
    cancelDate:   instance.cancelDate,
    defaultUser:  instance.defaultUser || (instance.osType === 'Windows' ? 'Administrator' : 'root')
  }
}

/**
 * Format specs for display message.
 */
function formatSpecs(product) {
  const ramGb  = Math.round(product.ramMb / 1024)
  const diskGb = Math.round(product.diskMb / 1024)
  return `${product.cpuCores} vCPU | ${ramGb} GB RAM | ${diskGb} GB ${product.diskType?.toUpperCase() || 'NVMe'}`
}

/**
 * Quick health check — verifies token + lists instances.
 */
async function healthCheck() {
  try {
    await getAccessToken()
    const instances = await listInstances()
    return {
      ok: true,
      message: 'Contabo API connected',
      instanceCount: instances.length,
      tokenValid: true
    }
  } catch (err) {
    return { ok: false, message: err.message || 'Contabo API connection failed', tokenValid: false }
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────
module.exports = {
  // Auth
  getAccessToken,

  // Products & Pricing
  listProducts,
  getProduct,
  calculatePrice,
  applyMarkup,
  PRODUCT_CATALOG,
  PRODUCT_CATALOG_SSD,
  REGION_SURCHARGE,
  REGION_DISPLAY,
  MARKUP_PERCENT,
  WINDOWS_LICENSE_MONTHLY,

  // Regions
  listRegions,

  // Images
  listImages,
  getDefaultWindowsImageId,
  DEFAULT_WINDOWS_IMAGE,

  // Secrets
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

  // Low-level
  apiRequest
}
