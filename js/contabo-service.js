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
    throw new Error('VPS provider authentication failed')
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

// ─── Product Catalog (from Contabo /v1/products API — April 2026) ────────────
// Prices are Contabo's monthly USD prices (no setup fee).
// Pattern: NVMe (V91,V94,V97,V100,V103,V106), SSD (V92,V95,V98,V101,V104,V107)
// The old V45-V55 (NVMe) and V92-V97 (SSD) IDs are DEPRECATED.
const PRODUCT_CATALOG = [
  {
    productId:   'V91',
    name:        'Cloud VPS 10',
    cpuCores:    4,
    ramMb:       8192,
    diskMb:      76800,    // 75 GB NVMe
    diskType:    'nvme',
    bandwidthTb: 32,
    portSpeedMbps: 200,
    basePriceUsd: 4.95,
    tier: 1
  },
  {
    productId:   'V94',
    name:        'Cloud VPS 20',
    cpuCores:    6,
    ramMb:       12288,
    diskMb:      102400,   // 100 GB NVMe
    diskType:    'nvme',
    bandwidthTb: 32,
    portSpeedMbps: 300,
    basePriceUsd: 7.95,
    tier: 2
  },
  {
    productId:   'V97',
    name:        'Cloud VPS 30',
    cpuCores:    8,
    ramMb:       24576,
    diskMb:      204800,   // 200 GB NVMe
    diskType:    'nvme',
    bandwidthTb: 32,
    portSpeedMbps: 600,
    basePriceUsd: 15.00,
    tier: 3
  },
  {
    productId:   'V100',
    name:        'Cloud VPS 40',
    cpuCores:    12,
    ramMb:       49152,
    diskMb:      256000,   // 250 GB NVMe
    diskType:    'nvme',
    bandwidthTb: 32,
    portSpeedMbps: 800,
    basePriceUsd: 26.00,
    tier: 4
  },
  {
    productId:   'V103',
    name:        'Cloud VPS 50',
    cpuCores:    16,
    ramMb:       65536,
    diskMb:      307200,   // 300 GB NVMe
    diskType:    'nvme',
    bandwidthTb: 32,
    portSpeedMbps: 1000,
    basePriceUsd: 46.00,
    tier: 5
  },
  {
    productId:   'V106',
    name:        'Cloud VPS 60',
    cpuCores:    18,
    ramMb:       98304,
    diskMb:      358400,   // 350 GB NVMe
    diskType:    'nvme',
    bandwidthTb: 32,
    portSpeedMbps: 1000,
    basePriceUsd: 59.00,
    tier: 6
  }
]

// SSD variants (2x disk, same compute specs, same price)
const PRODUCT_CATALOG_SSD = [
  { productId: 'V92',  name: 'Cloud VPS 10 SSD', cpuCores: 4,  ramMb: 8192,  diskMb: 153600, diskType: 'ssd', bandwidthTb: 32, portSpeedMbps: 200,  basePriceUsd: 4.95,  tier: 1 },
  { productId: 'V95',  name: 'Cloud VPS 20 SSD', cpuCores: 6,  ramMb: 12288, diskMb: 204800, diskType: 'ssd', bandwidthTb: 32, portSpeedMbps: 300,  basePriceUsd: 7.95,  tier: 2 },
  { productId: 'V98',  name: 'Cloud VPS 30 SSD', cpuCores: 8,  ramMb: 24576, diskMb: 409600, diskType: 'ssd', bandwidthTb: 32, portSpeedMbps: 600,  basePriceUsd: 15.00, tier: 3 },
  { productId: 'V101', name: 'Cloud VPS 40 SSD', cpuCores: 12, ramMb: 49152, diskMb: 512000, diskType: 'ssd', bandwidthTb: 32, portSpeedMbps: 800,  basePriceUsd: 26.00, tier: 4 },
  { productId: 'V104', name: 'Cloud VPS 50 SSD', cpuCores: 16, ramMb: 65536, diskMb: 614400, diskType: 'ssd', bandwidthTb: 32, portSpeedMbps: 1000, basePriceUsd: 46.00, tier: 5 },
  { productId: 'V107', name: 'Cloud VPS 60 SSD', cpuCores: 18, ramMb: 98304, diskMb: 716800, diskType: 'ssd', bandwidthTb: 32, portSpeedMbps: 1000, basePriceUsd: 59.00, tier: 6 }
]

// Region surcharges (monthly, USD converted from EUR × 1.15)
// Per-tier surcharges — Contabo charges different surcharges for different plan sizes
// null = region not available for that tier
const REGION_SURCHARGE = {
  //                    tier1   tier2   tier3   tier4   tier5   tier6
  'EU':         [      0,      0,      0,      0,      0,      0     ],
  'US-central': [   1.09,   1.67,   3.39,   6.04,   8.97,  11.85   ],
  'US-east':    [   1.61,   2.53,   5.06,   9.03,  13.34,  17.65   ],
  'US-west':    [   1.32,   2.13,   4.20,   7.53,  11.10,  14.72   ],
  'UK':         [   1.09,   1.67,   3.39,   6.04,   8.97,  11.85   ],
  'SIN':        [   null,   null,   null,   null,  21.62,  28.64   ],
  'JPN':        [   2.70,   4.20,   8.40,  14.95,   null,   null   ],
  'AUS':        [   2.24,   3.45,   6.96,  12.42,  18.34,  24.32   ],
  'IND':        [   2.47,   3.85,   7.71,  13.69,  20.30,   null   ]
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
  const tier          = product.tier || 1
  const surchargeArr  = REGION_SURCHARGE[regionSlug]
  const surcharge     = surchargeArr ? (surchargeArr[tier - 1] ?? null) : 0
  if (surcharge === null) return null  // Region not available for this tier
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
  return catalog
    .map(p => {
      const pricing = calculatePrice(p, regionSlug, isWindows)
      if (!pricing) return null  // Region not available for this tier
      return {
        ...p,
        ramGb:     Math.round(p.ramMb / 1024),
        diskGb:    Math.round(p.diskMb / 1024),
        pricing
      }
    })
    .filter(Boolean)
}

/**
 * Get a single product by productId.
 */
function getProduct(productId) {
  return PRODUCT_CATALOG.find(p => p.productId === productId) ||
         PRODUCT_CATALOG_SSD.find(p => p.productId === productId) || null
}

/**
 * NVMe ↔ SSD product fallback mapping (Contabo V91-V107 product range).
 * Each Cloud VPS tier has NVMe + SSD variant with same compute specs.
 * Pattern: NVMe=V91,V94,V97,V100,V103,V106  SSD=V92,V95,V98,V101,V104,V107
 * NOTE: V93,V96,V99,V102,V105 are Storage VPS — NEVER use as Cloud VPS fallback!
 */
const NVME_TO_SSD_FALLBACK = { V91: 'V92', V94: 'V95', V97: 'V98', V100: 'V101', V103: 'V104', V106: 'V107' }
const SSD_TO_NVME_FALLBACK = { V92: 'V91', V95: 'V94', V98: 'V97', V101: 'V100', V104: 'V103', V107: 'V106' }

function getProductFallback(productId) {
  return NVME_TO_SSD_FALLBACK[productId] || SSD_TO_NVME_FALLBACK[productId] || null
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
          surchargeUsd: REGION_SURCHARGE[slug] || [0,0,0,0,0,0],
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

// ── Windows image edition rules ──
// NVMe products (V45-V55): use SE (Standard Edition) images
// SSD products (V92-V97):  use DE (DataCenter Edition) images
const NVME_PRODUCT_IDS = new Set(['V45', 'V47', 'V49', 'V51', 'V53', 'V55'])
const SSD_PRODUCT_IDS  = new Set(['V92', 'V93', 'V94', 'V95', 'V96', 'V97'])

function isNVMeProduct(productId) { return NVME_PRODUCT_IDS.has(productId) }
function isSSDProduct(productId)  { return SSD_PRODUCT_IDS.has(productId) }

// Preferred Windows images per product type (no Plesk)
const DEFAULT_WINDOWS_IMAGE_NVME = 'windows-server-2025-se'  // SE for NVMe
const DEFAULT_WINDOWS_IMAGE_SSD  = 'windows-server-2025-de'  // DE for SSD
const DEFAULT_WINDOWS_IMAGE = DEFAULT_WINDOWS_IMAGE_SSD       // default to SSD-safe

/**
 * List available OS images from Contabo API.
 * @param {string} filter - 'all', 'linux', 'windows', 'rdp'
 */
async function listImages(filter = 'all') {
  const res = await apiRequest('GET', '/compute/images', null, { size: 100 })
  let images = (res.data || [])

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
 * @param {string} [productId] - Product ID to determine SE vs DE edition
 *   NVMe products → SE (Standard Edition)
 *   SSD products  → DE (DataCenter Edition)
 *   If omitted, defaults to DE (safe for both when NVMe is unavailable)
 */
async function getDefaultWindowsImageId(productId) {
  const images = await listImages('windows')
  const useSSD = !productId || isSSDProduct(productId) || !isNVMeProduct(productId)
  const edition = useSSD ? 'de' : 'se'
  const preferredName = useSSD ? DEFAULT_WINDOWS_IMAGE_SSD : DEFAULT_WINDOWS_IMAGE_NVME

  console.log(`[Contabo] Selecting Windows image: product=${productId || 'unknown'}, edition=${edition}, preferred=${preferredName}`)

  // Prefer the exact preferred image
  const preferred = images.find(img => img.name === preferredName)
  if (preferred) return preferred.imageId

  // Fallback: same edition in different year, then any non-plesk
  const fallback = images.find(img => img.name.includes('2025') && img.name.endsWith(`-${edition}`)) ||
                   images.find(img => img.name.includes('2022') && img.name.endsWith(`-${edition}`)) ||
                   images.find(img => img.name.includes('2025') && !img.name.includes('plesk')) ||
                   images.find(img => img.name.includes('2022') && !img.name.includes('plesk')) ||
                   images[0]
  return fallback ? fallback.imageId : null
}

/**
 * Swap a Windows image from SE↔DE when falling back between NVMe↔SSD products.
 * @param {string} imageId - Current image ID
 * @param {string} targetProductId - The fallback product we're switching to
 * @returns {Promise<string>} - Compatible image ID for the target product
 */
async function getCompatibleWindowsImage(imageId, targetProductId) {
  // If switching to SSD, we need DE edition; if switching to NVMe, we need SE edition
  const images = await listImages('windows')
  const currentImage = images.find(img => img.imageId === imageId)
  if (!currentImage) return imageId // can't find it, return as-is

  const currentName = currentImage.name
  const isSwitchingToSSD = isSSDProduct(targetProductId)
  const targetEdition = isSwitchingToSSD ? 'de' : 'se'
  const currentEdition = currentName.endsWith('-se') ? 'se' : currentName.endsWith('-de') ? 'de' : null

  // Already correct edition
  if (currentEdition === targetEdition) return imageId

  // Swap edition: windows-server-2025-se → windows-server-2025-de
  if (currentEdition) {
    const swappedName = currentName.replace(`-${currentEdition}`, `-${targetEdition}`)
    const swapped = images.find(img => img.name === swappedName)
    if (swapped) {
      console.log(`[Contabo] Swapped Windows image: ${currentName} → ${swappedName} for product ${targetProductId}`)
      return swapped.imageId
    }
  }

  // Fallback: get default for the target product type
  return await getDefaultWindowsImageId(targetProductId)
}

// ─── Secrets (SSH Keys & Passwords) ───────────────────────────────────────

/**
 * Create a secret (SSH public key or password).
 * @param {string} name - Secret name
 * @param {string} value - SSH public key string or password
 * @param {string} type - 'ssh' or 'password'
 */
async function createSecret(name, value, type = 'ssh') {
  // Fix #6: Guard against empty/short values that Contabo rejects
  if (!value || (type === 'password' && value.length < 8)) {
    throw new Error(`Secret value too short (${value?.length || 0} chars, min 8 for passwords)`)
  }
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
  try {
    const res = await apiRequest('POST', '/compute/instances', body)
    const instance = res.data?.[0] || res.data
    console.log(`[Contabo] Instance created: id=${instance?.instanceId}, name=${instance?.name}`)
    return instance
  } catch (err) {
    // Fix #4: If product is unavailable, try the fallback (NVMe ↔ SSD)
    const errMsg = err.message || ''
    if (errMsg.includes('is not available') || errMsg.includes('Product')) {
      const fallbackId = getProductFallback(opts.productId)
      if (fallbackId) {
        console.log(`[Contabo] Product ${opts.productId} unavailable — trying fallback ${fallbackId}`)
        body.productId = fallbackId
        // Fix #7: When switching NVMe↔SSD, also swap Windows image edition (SE↔DE)
        if (opts.imageId) {
          try {
            const compatImage = await getCompatibleWindowsImage(opts.imageId, fallbackId)
            if (compatImage && compatImage !== opts.imageId) {
              console.log(`[Contabo] Also swapping image for fallback: ${opts.imageId} → ${compatImage}`)
              body.imageId = compatImage
            }
          } catch (imgErr) {
            console.log(`[Contabo] Image swap failed, keeping original: ${imgErr.message}`)
          }
        }
        const res = await apiRequest('POST', '/compute/instances', body)
        const instance = res.data?.[0] || res.data
        console.log(`[Contabo] Instance created via fallback: id=${instance?.instanceId}, product=${fallbackId}`)
        return instance
      }
    }
    // Fix #7b: If image is incompatible with product, try compatible image
    if (errMsg.includes('cannot use this image') || errMsg.includes('image')) {
      console.log(`[Contabo] Image incompatible — trying compatible image for product ${body.productId}`)
      try {
        const compatImage = await getCompatibleWindowsImage(opts.imageId, body.productId)
        if (compatImage && compatImage !== body.imageId) {
          console.log(`[Contabo] Retrying with compatible image: ${body.imageId} → ${compatImage}`)
          body.imageId = compatImage
          const res = await apiRequest('POST', '/compute/instances', body)
          const instance = res.data?.[0] || res.data
          console.log(`[Contabo] Instance created with compatible image: id=${instance?.instanceId}`)
          return instance
        }
      } catch (imgErr) {
        console.log(`[Contabo] Compatible image retry also failed: ${imgErr.message}`)
      }
    }
    throw err // Re-throw if no fallback available or fallback also failed
  }
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
  const res = await apiRequest('POST', `/compute/instances/${instanceId}/actions/start`, {})
  return res.data?.[0] || res.data
}

/**
 * Stop an instance.
 */
async function stopInstance(instanceId) {
  const res = await apiRequest('POST', `/compute/instances/${instanceId}/actions/stop`, {})
  return res.data?.[0] || res.data
}

/**
 * Restart an instance.
 */
async function restartInstance(instanceId) {
  const res = await apiRequest('POST', `/compute/instances/${instanceId}/actions/restart`, {})
  return res.data?.[0] || res.data
}

/**
 * Shutdown an instance gracefully.
 */
async function shutdownInstance(instanceId) {
  const res = await apiRequest('POST', `/compute/instances/${instanceId}/actions/shutdown`, {})
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
      message: 'VPS API connected',
      instanceCount: instances.length,
      tokenValid: true
    }
  } catch (err) {
    return { ok: false, message: err.message || 'VPS API connection failed', tokenValid: false }
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────
module.exports = {
  // Auth
  getAccessToken,

  // Products & Pricing
  listProducts,
  getProduct,
  getProductFallback,
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
  getCompatibleWindowsImage,
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
