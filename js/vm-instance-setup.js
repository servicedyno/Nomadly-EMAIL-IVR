/**
 * vm-instance-setup.js — REWRITTEN for Contabo API
 *
 * Keeps the same 28+ export signatures so _index.js doesn't break.
 * Routes everything through contabo-service.js.
 * Uses MongoDB (vpsPlansOf, sshKeysOf) for per-user tracking.
 *
 * KEY CHANGES vs old Nameword version:
 *  - Region selection is flat (9 regions, no country→region→zone hierarchy)
 *  - Disk type is part of the product (NVMe vs SSD variants)
 *  - Billing is always monthly (no hourly/quarterly/annual via API)
 *  - SSH keys stored as Contabo secrets (named with telegramId prefix)
 *  - cPanel/Plesk: NOT available via Contabo API — graceful fallback
 *  - "RDP" = Windows Server (auto-selects Windows image)
 */

require('dotenv').config()
const crypto = require('crypto')
const nodemailer = require('nodemailer')
const contabo = require('./contabo-service')

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

// ─── MongoDB references (set by initVpsDb from _index.js) ────────────────
let _db = null
let _vpsPlansOf = null
let _sshKeysOf = null

/**
 * Must be called once from _index.js after DB connects.
 * Sets the MongoDB collections for VPS tracking.
 */
function initVpsDb(db) {
  _db = db
  _vpsPlansOf = db.collection('vpsPlansOf')
  _sshKeysOf = db.collection('sshKeysOf')
  // Ensure indexes
  _vpsPlansOf.createIndex({ chatId: 1 }).catch(() => {})
  _vpsPlansOf.createIndex({ contaboInstanceId: 1 }).catch(() => {})
  _sshKeysOf.createIndex({ telegramId: 1 }).catch(() => {})
}

// ─── Utility ──────────────────────────────────────────────────────────────

function generateRandomName(prefix, number = 12) {
  const randomSuffix = crypto.randomBytes(number).toString('hex').substring(0, 12)
  return `${prefix}-${randomSuffix}`
}

function generateRandomPassword(length = 16) {
  const upperCase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lowerCase = 'abcdefghijklmnopqrstuvwxyz'
  const numbers = '0123456789'
  // RDP-safe symbols only — avoid % ^ $ & * ( ) which break Windows auth,
  // shell escaping, and Contabo secret provisioning
  const symbols = '!@#-_+=.'
  const allCharacters = upperCase + lowerCase + numbers + symbols
  const getRandomIndex = (max) => {
    const randomBuffer = crypto.randomBytes(4)
    return randomBuffer.readUInt32BE(0) % max
  }
  let password = [
    upperCase[getRandomIndex(upperCase.length)],
    lowerCase[getRandomIndex(lowerCase.length)],
    numbers[getRandomIndex(numbers.length)],
    symbols[getRandomIndex(symbols.length)],
  ]
  for (let i = password.length; i < length; i++) {
    password.push(allCharacters[getRandomIndex(allCharacters.length)])
  }
  for (let i = password.length - 1; i > 0; i--) {
    const j = getRandomIndex(i + 1)
    ;[password[i], password[j]] = [password[j], password[i]]
  }
  return password.join('')
}

// ─── Region / Country / Zone  ─────────────────────────────────────────────
// Contabo has flat regions, no country→region→zone hierarchy.
// We still export the 3 old functions but flatten the flow.

/**
 * OLD: fetchAvailableCountries() → ['Americas','Europe','Asia Pacific']
 * NEW: Returns Contabo region slugs as "countries".
 *      _index.js uses these as button labels.
 */
async function fetchAvailableCountries() {
  try {
    const regions = await contabo.listRegions()
    // Return array of display labels — used as button text
    return regions.map(r => `${r.display.emoji} ${r.display.label}`)
  } catch (err) {
    console.log('Error in fetchAvailableCountries (contabo):', err.message || err)
    return false
  }
}

/**
 * OLD: fetchAvailableRegionsOfCountry(country) → [{value, label}]
 * NEW: Since regions are already flat, this just returns the single region.
 *      The "country" param is the button label from fetchAvailableCountries.
 */
async function fetchAvailableRegionsOfCountry(country) {
  try {
    const regions = await contabo.listRegions()
    // Find the region matching the button label
    const match = regions.find(r => `${r.display.emoji} ${r.display.label}` === country)
    if (match) {
      return [{ value: match.regionSlug, label: `${match.display.emoji} ${match.display.label}` }]
    }
    // If exact match fails, return all regions
    return regions.map(r => ({ value: r.regionSlug, label: `${r.display.emoji} ${r.display.label}` }))
  } catch (err) {
    console.log('Error in fetchAvailableRegionsOfCountry (contabo):', err.message || err)
    return false
  }
}

/**
 * OLD: fetchAvailableZones(region) → [{name, label}]
 * NEW: Contabo has no zones. Returns the region slug as a single "zone".
 */
async function fetchAvailableZones(region) {
  try {
    // region is the value from fetchAvailableRegionsOfCountry (regionSlug)
    const display = contabo.REGION_DISPLAY[region]
    if (display) {
      return [{ name: region, label: `${display.emoji} ${display.label}` }]
    }
    return [{ name: region, label: region }]
  } catch (err) {
    console.log('Error in fetchAvailableZones (contabo):', err.message || err)
    return false
  }
}

// ─── Disk Types ───────────────────────────────────────────────────────────

/**
 * OLD: fetchAvailableDiskTpes(zone) → [disk type objects]
 * NEW: Returns NVMe and SSD as options. Disk is part of the product in Contabo.
 */
async function fetchAvailableDiskTpes(zone) {
  try {
    return [
      { id: 'nvme', _id: 'nvme', name: 'NVMe', value: 'nvme', label: '⚡ NVMe — Faster Speed', type: 'nvme', description: '⚡ <b>NVMe — Faster Speed</b>\n   └ Best for databases, apps & heavy I/O\n   └ Up to 10× faster read/write vs SSD' },
      { id: 'ssd',  _id: 'ssd',  name: 'SSD',  value: 'ssd',  label: '💾 SSD — 2× More Storage', type: 'ssd', description: '💾 <b>SSD — 2× More Storage</b>\n   └ Same price, double the disk space\n   └ Great for file hosting & backups' }
    ]
  } catch (err) {
    console.log('Error in fetchAvailableDiskTpes (contabo):', err.message || err)
    return false
  }
}

// ─── VPS Plans / Configs ──────────────────────────────────────────────────

/**
 * OLD: fetchAvailableVPSConfigs(telegramId, vpsDetails) → [plan objects with billingCycles]
 * NEW: Returns Contabo product catalog with markup pricing.
 *      vpsDetails should have: { region, diskType, isRDP }
 */
async function fetchAvailableVPSConfigs(telegramId, vpsDetails) {
  try {
    const region = vpsDetails.region || 'EU'
    const diskType = vpsDetails.diskType || 'nvme'
    const isRDP = vpsDetails.isRDP || false

    const products = contabo.listProducts(region, isRDP, diskType)
    
    // Adapt to old format expected by _index.js
    return products.map(p => ({
      _id: p.productId,
      name: p.name,
      cpuCores: p.cpuCores,
      ramMb: p.ramMb,
      ramGb: p.ramGb,
      diskMb: p.diskMb,
      diskGb: p.diskGb,
      diskType: p.diskType,
      bandwidthTb: p.bandwidthTb,
      portSpeedMbps: p.portSpeedMbps,
      tier: p.tier,
      // Pricing adapted to old format
      monthlyPrice: p.pricing.totalWithMarkup,
      basePriceUsd: p.pricing.basePriceUsd,
      regionSurcharge: p.pricing.regionSurcharge,
      windowsLicense: p.pricing.windowsLicense,
      totalBeforeMarkup: p.pricing.totalBeforeMarkup,
      billingCycles: [
        {
          type: 'Monthly',
          price: p.pricing.totalWithMarkup,
          period: 1
        }
      ],
      // Spec display (object for templates, string for fallback)
      specs: { vCPU: p.cpuCores, RAM: p.ramGb, disk: p.diskGb, diskType: p.diskType?.toUpperCase() || 'NVMe' },
      specsStr: contabo.formatSpecs(p),
      // Flag for display
      isRDP: isRDP
    }))
  } catch (err) {
    console.log('Error in fetchAvailableVPSConfigs (contabo):', err.message || err)
    return false
  }
}

// ─── OS / Images ──────────────────────────────────────────────────────────

/**
 * OLD: fetchAvailableOS(cpanel) → [{ id, name, ... }]
 * NEW: Returns Contabo OS images + "RDP" as a special option.
 *      If cpanel param is truthy, returns empty (no cPanel in Contabo API).
 */
async function fetchAvailableOS(cpanel) {
  try {
    if (cpanel) {
      // No cPanel/Plesk via Contabo API
      return []
    }

    const linuxImages = await contabo.listImages('linux')
    const osOptions = linuxImages.map(img => ({
      id: img.imageId,
      name: img.name,
      os_name: img.name,
      osType: 'Linux',
      isRDP: false,
      price: 0
    }))

    // Add RDP as a special option at the top
    const windowsImageId = await contabo.getDefaultWindowsImageId()
    osOptions.unshift({
      id: windowsImageId || 'rdp',
      value: 'win',
      name: '🖥 RDP',
      os_name: 'Windows Server 2025',
      osType: 'Windows',
      isRDP: true,
      price: contabo.WINDOWS_LICENSE_BY_TIER[2] || 19.10  // display price (tier 2 as default); actual price computed per-tier by pricing engine
    })

    return osOptions
  } catch (err) {
    console.log('Error in fetchAvailableOS (contabo):', err.message || err)
    return false
  }
}

/**
 * OLD: fetchSelectedCpanelOptions(cpanel) → cpanel data
 * NEW: No cPanel in Contabo API. Returns empty/false.
 */
async function fetchSelectedCpanelOptions(cpanel) {
  console.log('[Contabo] cPanel not available via Contabo API')
  return false
}

// ─── User Registration (Nameword → MongoDB) ──────────────────────────────

/**
 * OLD: registerVpsTelegram(telegramId, email) → registers on Nameword
 * NEW: No-op — user already exists in MongoDB. Returns true.
 */
async function registerVpsTelegram(telegramId, email) {
  try {
    console.log(`[Contabo] User registration (no-op): ${telegramId} ${email}`)
    return true
  } catch (err) {
    console.log('Error in registerVpsTelegram:', err.message || err)
    return false
  }
}

/**
 * OLD: checkMissingEmailForNameword(telegramId) → { hasEmail: bool }
 * NEW: Always returns hasEmail:true since we don't need Nameword email.
 */
async function checkMissingEmailForNameword(telegramId) {
  return { hasEmail: true }
}

/**
 * OLD: addUserEmailForNameWord(telegramId, email) → updates Nameword user
 * NEW: No-op — email is stored in state collection already.
 */
async function addUserEmailForNameWord(telegramId, email) {
  return true
}

// ─── SSH Keys ─────────────────────────────────────────────────────────────
// Keys are stored as Contabo secrets, named with telegramId prefix.

/**
 * OLD: fetchUserSSHkeyList(telegramId, vpsId) → array of key objects
 * NEW: Fetches from Contabo Secrets API, filtered by telegramId prefix.
 */
async function fetchUserSSHkeyList(telegramId, vpsId) {
  try {
    const allSecrets = await contabo.listSecrets('ssh')
    // Filter by naming convention: ssh-{telegramId}-{name}
    const userKeys = allSecrets.filter(s => s.name.startsWith(`ssh-${telegramId}-`))
    
    // Also check local DB for any stored key metadata
    let localKeys = []
    if (_sshKeysOf) {
      localKeys = await _sshKeysOf.find({ telegramId: String(telegramId) }).toArray()
    }

    const keys = userKeys.map(s => {
      const localMatch = localKeys.find(lk => lk.contaboSecretId === s.secretId)
      return {
        _id: s.secretId,
        secretId: s.secretId,
        sshKeyName: s.name.replace(`ssh-${telegramId}-`, ''),
        name: s.name.replace(`ssh-${telegramId}-`, ''),
        telegramId: telegramId,
        createdAt: s.createdAt,
        privateKeyStored: localMatch ? true : false
      }
    })
    // Return in old format { keys: [...] } for backward compat with _index.js
    return { keys }
  } catch (err) {
    console.log('Error in fetchUserSSHkeyList (contabo):', err.message || err)
    return false
  }
}

/**
 * OLD: generateNewSSHkey(telegramId, sshName) → { data: { sshKeyName, publicKey, privateKey } }
 * NEW: Generates key pair locally, stores public key on Contabo.
 */
async function generateNewSSHkey(telegramId, sshName) {
  try {
    const keyName = sshName || generateRandomName('key')
    const contaboName = `ssh-${telegramId}-${keyName}`

    // Generate RSA key pair locally
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 4096,
      publicKeyEncoding:  { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    })

    // Convert PEM to OpenSSH format for Contabo
    const sshPubKey = convertPemToOpenSSH(publicKey, `${telegramId}@nomadly`)

    // Guard: if conversion failed, don't send invalid key to Contabo
    if (!sshPubKey) {
      console.log('[SSH] Failed to convert PEM to OpenSSH format for', telegramId)
      return false
    }

    // Store on Contabo
    const secret = await contabo.createSecret(contaboName, sshPubKey, 'ssh')

    // Store private key in MongoDB for user download
    if (_sshKeysOf) {
      await _sshKeysOf.insertOne({
        telegramId: String(telegramId),
        contaboSecretId: secret.secretId,
        sshKeyName: keyName,
        contaboName: contaboName,
        privateKey: privateKey,
        publicKey: sshPubKey,
        createdAt: new Date()
      })
    }

    // Return in old format for backward compat with _index.js
    // _index.js references newSShKey.sshKeyName directly
    return {
      sshKeyName: keyName,
      secretId: secret.secretId,
      publicKey: sshPubKey,
      privateKey: privateKey,
      contaboName: contaboName,
      data: {
        sshKeyName: keyName,
        secretId: secret.secretId,
        publicKey: sshPubKey,
        privateKey: privateKey,
        contaboName: contaboName
      }
    }
  } catch (err) {
    console.log('Error in generateNewSSHkey (contabo):', err.message || err)
    return false
  }
}

/**
 * Convert PEM public key to OpenSSH format.
 * Fix #3: Previous implementation exported SPKI DER as base64, which is NOT valid OpenSSH format.
 * Contabo rejected these keys with "Ssh key is not valid. Valid formats [ dsa | ecdsa | ed25519 | rsa ]".
 * Now properly constructs SSH wire format: string("ssh-rsa") + mpint(e) + mpint(n).
 */
function convertPemToOpenSSH(pemKey, comment = '') {
  try {
    const keyObj = crypto.createPublicKey(pemKey)
    // Export as JWK to get raw key components (e = exponent, n = modulus)
    const jwk = keyObj.export({ format: 'jwk' })

    if (jwk.kty !== 'RSA' || !jwk.e || !jwk.n) {
      throw new Error('Not an RSA key or missing e/n components')
    }

    const e = Buffer.from(jwk.e, 'base64url')
    const n = Buffer.from(jwk.n, 'base64url')

    // SSH wire format helper: 4-byte big-endian length prefix + data
    const encodeSSHString = (buf) => {
      const len = Buffer.alloc(4)
      len.writeUInt32BE(buf.length)
      return Buffer.concat([len, buf])
    }

    // SSH mpint: if high bit set, prepend 0x00 to indicate positive number
    const encodeSSHMpint = (buf) => {
      if (buf[0] & 0x80) {
        buf = Buffer.concat([Buffer.from([0x00]), buf])
      }
      const len = Buffer.alloc(4)
      len.writeUInt32BE(buf.length)
      return Buffer.concat([len, buf])
    }

    // Construct: string("ssh-rsa") + mpint(e) + mpint(n)
    const typeStr = Buffer.from('ssh-rsa')
    const sshBuf = Buffer.concat([
      encodeSSHString(typeStr),
      encodeSSHMpint(e),
      encodeSSHMpint(n),
    ])

    return `ssh-rsa ${sshBuf.toString('base64')} ${comment}`.trim()
  } catch (err) {
    console.log('[SSH] PEM-to-OpenSSH conversion error:', err.message)
    // Return null so caller knows conversion failed (don't send garbage to Contabo)
    return null
  }
}

/**
 * OLD: uploadSSHPublicKey(telegramId, key, sshName) → { data: { sshKeyName } }
 * NEW: Uploads the provided public key to Contabo as a secret.
 */
async function uploadSSHPublicKey(telegramId, key, sshName) {
  try {
    const keyName = sshName || generateRandomName('key')
    const contaboName = `ssh-${telegramId}-${keyName}`

    const secret = await contabo.createSecret(contaboName, key.trim(), 'ssh')

    // Store metadata in MongoDB
    if (_sshKeysOf) {
      await _sshKeysOf.insertOne({
        telegramId: String(telegramId),
        contaboSecretId: secret.secretId,
        sshKeyName: keyName,
        contaboName: contaboName,
        publicKey: key.trim(),
        privateKey: null, // User uploaded public key only
        createdAt: new Date()
      })
    }

    // Return in old format for backward compat with _index.js
    return {
      sshKeyName: keyName,
      secretId: secret.secretId,
      contaboName: contaboName,
      data: {
        sshKeyName: keyName,
        secretId: secret.secretId,
        contaboName: contaboName
      }
    }
  } catch (err) {
    console.log('Error in uploadSSHPublicKey (contabo):', err.message || err)
    return false
  }
}

/**
 * OLD: downloadSSHKeyFile(telegramId, sshKeyName) → Buffer (private key file)
 * NEW: Retrieves stored private key from MongoDB.
 */
async function downloadSSHKeyFile(telegramId, sshKeyName) {
  try {
    if (!_sshKeysOf) return false
    const keyDoc = await _sshKeysOf.findOne({
      telegramId: String(telegramId),
      sshKeyName: sshKeyName
    })
    if (!keyDoc || !keyDoc.privateKey) {
      console.log(`[Contabo] No private key stored for ${telegramId}/${sshKeyName}`)
      return false
    }
    return Buffer.from(keyDoc.privateKey, 'utf8')
  } catch (err) {
    console.log('Error in downloadSSHKeyFile (contabo):', err.message || err)
    return false
  }
}

/**
 * OLD: unlinkSSHKeyFromVps(telegramId, key, vpsDetails) → unlinks key
 * NEW: Reinstalls instance without that SSH key.
 *      NOTE: This is destructive — requires OS reinstall on Contabo.
 *      We'll just remove the key from Contabo secrets instead.
 */
async function unlinkSSHKeyFromVps(telegramId, key, vpsDetails) {
  try {
    // For Contabo, unlinking SSH key from a running instance isn't possible
    // without reinstall. We'll just delete the key from the account.
    // The key will no longer be available for future instances.
    const secretId = key._id || key.secretId || key
    await contabo.deleteSecret(secretId)

    // Remove from local DB
    if (_sshKeysOf) {
      await _sshKeysOf.deleteOne({ contaboSecretId: secretId })
    }

    return { success: true, message: 'SSH key removed from account' }
  } catch (err) {
    console.log('Error in unlinkSSHKeyFromVps (contabo):', err.message || err)
    return false
  }
}

// ─── VPS Instance CRUD ────────────────────────────────────────────────────

/**
 * OLD: createVPSInstance(telegramId, vpsDetails) → { success: true, data: { _id, vps_name, label, host, status, subscription: { subscriptionEnd } } }
 * NEW: Creates Contabo instance + stores mapping in MongoDB.
 */
async function createVPSInstance(telegramId, vpsDetails) {
  try {
    // Determine OS image
    let imageId = vpsDetails.os?.id
    let isRDP = vpsDetails.os?.isRDP || vpsDetails.isRDP || false

    // Build create request (determine product first so we can pick the right image)
    const productId = vpsDetails.config?._id || vpsDetails.productId
    
    if (isRDP && (!imageId || imageId === 'rdp')) {
      // Pass productId so the correct Windows edition (SE for NVMe, DE for SSD) is selected
      imageId = await contabo.getDefaultWindowsImageId(productId)
    }

    if (!imageId) {
      return { error: 'No OS image selected' }
    }

    const region = vpsDetails.zone || vpsDetails.region || 'EU'
    
    // Generate a root password for the instance
    // Fix #6: Ensure minimum 20 chars (Contabo requires at least 8)
    const rootPassword = generateRandomPassword(Math.max(20, 20))
    const passwordSecret = await contabo.createSecret(
      `pwd-${telegramId}-${Date.now()}`,
      rootPassword,
      'password'
    )

    const createOpts = {
      productId:    productId,
      region:       region,
      imageId:      imageId,
      displayName:  `nomadly-${telegramId}-${Date.now()}`,
      rootPassword: passwordSecret.secretId,
      period:       1 // monthly
    }

    // Attach SSH keys if provided
    if (vpsDetails.sshKeySecretId) {
      createOpts.sshKeys = [vpsDetails.sshKeySecretId]
    }

    // Fix: On modern Linux distros (Ubuntu 24.04+), the root account is locked
    // and a non-root user (e.g., 'admin') is used instead. The Contabo resetPassword
    // API only resets the ROOT password, so we need to:
    // 1. Unlock root account so Contabo's resetPassword API works
    // 2. Enable PermitRootLogin so SSH as root works
    // 3. Enable PasswordAuthentication for both root and default user
    // 4. Sync root password with the provisioned password
    if (!isRDP) {
      const cloudInitScript = [
        '#!/bin/bash',
        '# === Nomadly VPS Setup ===',
        '# Enable password authentication',
        'sed -i "s/^#*PasswordAuthentication.*/PasswordAuthentication yes/" /etc/ssh/sshd_config',
        'sed -i "s/^#*PermitRootLogin.*/PermitRootLogin yes/" /etc/ssh/sshd_config',
        '# Fix drop-in config files (Ubuntu 24.04+ uses /etc/ssh/sshd_config.d/)',
        'for f in /etc/ssh/sshd_config.d/*.conf; do',
        '  [ -f "$f" ] && sed -i "s/^PasswordAuthentication no/PasswordAuthentication yes/" "$f"',
        '  [ -f "$f" ] && sed -i "s/^PermitRootLogin prohibit-password/PermitRootLogin yes/" "$f"',
        '  [ -f "$f" ] && sed -i "s/^PermitRootLogin no/PermitRootLogin yes/" "$f"',
        'done',
        '# Unlock root account (Ubuntu 24.04 locks it by default)',
        'passwd -u root 2>/dev/null',
        '# Copy ROOT password hash to default user so both accounts work',
        '# (Contabo rootPassword secret sets root password; we sync it to admin/default user)',
        'ROOT_HASH=$(getent shadow root | cut -d: -f2)',
        'if [ -n "$ROOT_HASH" ] && [ "$ROOT_HASH" != "!" ] && [ "$ROOT_HASH" != "*" ] && [ "$ROOT_HASH" != "!*" ]; then',
        '  DEFAULT_USER=$(grep "^[^:]*:[^!*]" /etc/shadow | grep -v "root\\|nobody\\|systemd" | head -1 | cut -d: -f1)',
        '  if [ -n "$DEFAULT_USER" ] && [ "$DEFAULT_USER" != "root" ]; then',
        '    usermod -p "$ROOT_HASH" "$DEFAULT_USER"',
        '  fi',
        'fi',
        '# Restart SSH daemon',
        'systemctl restart sshd 2>/dev/null || systemctl restart ssh 2>/dev/null || service ssh restart 2>/dev/null',
      ].join('\n')
      createOpts.userData = Buffer.from(cloudInitScript).toString('base64')
      console.log(`[Contabo] Added cloud-init for Linux VPS: enable password auth + unlock root`)
    }

    console.log(`[Contabo] Creating instance for user ${telegramId}:`, JSON.stringify(createOpts))
    const instance = await contabo.createInstance(createOpts)

    if (!instance || !instance.instanceId) {
      return { error: 'Failed to create instance — no instanceId returned' }
    }

    // Use the actual product/image that was deployed (may differ from request due to fallback)
    const actualProductId = instance._actualProductId || productId
    const actualImageId = instance._actualImageId || imageId
    if (actualProductId !== productId) {
      console.log(`[Contabo] Product fallback used: requested=${productId}, actual=${actualProductId}`)
    }
    if (actualImageId !== imageId) {
      console.log(`[Contabo] Image fallback used: requested=${imageId}, actual=${actualImageId}`)
    }

    // Calculate expiry (monthly billing)
    const now = new Date()
    const expiresAt = new Date(now)
    expiresAt.setMonth(expiresAt.getMonth() + 1)

    // Adapt to old return format expected by _index.js
    const vpsData = {
      _id: String(instance.instanceId),
      vps_name: instance.name || instance.displayName || createOpts.displayName,
      label: createOpts.displayName,
      host: instance.ipConfig?.v4?.ip || 'provisioning...',
      status: instance.status || 'provisioning',
      contaboInstanceId: instance.instanceId,
      region: region,
      productId: actualProductId,
      osType: isRDP ? 'Windows' : 'Linux',
      isRDP: isRDP,
      subscription: {
        subscriptionEnd: expiresAt.toISOString()
      },
      credentials: {
        username: instance.defaultUser || (isRDP ? 'admin' : 'root'),
        password: rootPassword
      }
    }

    // Store in MongoDB for tracking
    if (_vpsPlansOf) {
      await _vpsPlansOf.insertOne({
        chatId: String(telegramId),
        contaboInstanceId: instance.instanceId,
        name: vpsData.vps_name,
        label: vpsData.label,
        vpsId: String(instance.instanceId),
        host: vpsData.host,
        region: region,
        productId: actualProductId,
        osType: vpsData.osType,
        isRDP: isRDP,
        imageId: actualImageId,
        defaultUser: instance.defaultUser || (isRDP ? 'admin' : 'root'),
        start_time: now,
        end_time: expiresAt,
        plan: 'Monthly',
        planPrice: vpsDetails.plantotalPrice || vpsDetails.monthlyPrice,
        status: vpsData.status,
        rootPasswordSecretId: passwordSecret.secretId,
        sshKeySecretId: vpsDetails.sshKeySecretId || null,
        timestamp: new Date()
      })
    }

    return { success: true, data: vpsData }
  } catch (err) {
    const errorMessage = `Error creating VPS instance: ${err.message || JSON.stringify(err)}`
    console.error(errorMessage)
    return { error: errorMessage }
  }
}

/**
 * OLD: attachSSHKeysToVM(payload) → attaches SSH keys post-creation
 * NEW: In Contabo, keys are attached at creation time. This is a no-op.
 *      If keys need to be added later, it requires reinstall.
 */
async function attachSSHKeysToVM(payload) {
  try {
    console.log('[Contabo] SSH keys are attached at instance creation time. No separate attach needed.')
    return { success: true, message: 'SSH keys applied at creation' }
  } catch (err) {
    console.log('Error in attachSSHKeysToVM (contabo):', err.message || err)
    return false
  }
}

/**
 * OLD: fetchUserVPSList(telegramId) → array of VPS objects
 * NEW: Queries MongoDB for user's instances, enriches with live Contabo status.
 */
async function fetchUserVPSList(telegramId) {
  try {
    if (!_vpsPlansOf) {
      // Fallback: get all Contabo instances (account-level)
      const instances = await contabo.listInstances()
      return instances.map(i => contabo.formatInstanceForDisplay(i))
    }

    // Get user's instances from MongoDB
    const userRecords = await _vpsPlansOf.find({
      chatId: String(telegramId),
      status: { $ne: 'DELETED' }
    }).toArray()

    if (!userRecords.length) return []

    // Enrich with live Contabo status
    const enriched = []
    for (const record of userRecords) {
      try {
        const live = await contabo.getInstance(record.contaboInstanceId)
        const ip = live?.ipConfig?.v4?.ip || record.host || 'provisioning...'
        enriched.push({
          _id: record.vpsId,
          contaboInstanceId: record.contaboInstanceId,
          name: record.name,
          label: record.label,
          host: ip,
          status: live?.status?.toUpperCase() || record.status,
          region: record.region,
          productId: record.productId,
          osType: record.osType,
          isRDP: record.isRDP,
          plan: record.plan,
          planPrice: record.planPrice,
          start_time: record.start_time,
          end_time: record.end_time,
          autoRenewable: record.autoRenewable || false,
          subscription_id: record.vpsId, // for compatibility
          subscription: {
            subscriptionEnd: record.end_time,
            osId: { os_name: record.osType === 'Windows' ? 'Windows Server 2025' : 'Ubuntu' }
          }
        })

        // Update IP if it changed (provisioning → assigned)
        if (ip !== record.host && ip !== 'provisioning...') {
          await _vpsPlansOf.updateOne(
            { _id: record._id },
            { $set: { host: ip } }
          )
        }
      } catch (apiErr) {
        // Instance might be deleted on Contabo side
        enriched.push({
          _id: record.vpsId,
          name: record.name,
          label: record.label,
          host: record.host || 'unknown',
          status: 'UNKNOWN',
          region: record.region,
          plan: record.plan,
          planPrice: record.planPrice
        })
      }
    }

    return enriched
  } catch (err) {
    console.log('Error in fetchUserVPSList (contabo):', err.message || err)
    return false
  }
}

/**
 * OLD: fetchVPSDetails(telegramId, vpsId) → detailed VPS object
 * NEW: Gets live instance data from Contabo + local MongoDB record.
 */
async function fetchVPSDetails(telegramId, vpsId) {
  try {
    // First get the local record
    let localRecord = null
    if (_vpsPlansOf) {
      localRecord = await _vpsPlansOf.findOne({
        chatId: String(telegramId),
        vpsId: String(vpsId)
      })
    }

    const instanceId = localRecord?.contaboInstanceId || vpsId
    const live = await contabo.getInstance(instanceId)

    if (!live) return false

    const ip = live.ipConfig?.v4?.ip || localRecord?.host || 'provisioning...'
    const product = contabo.getProduct(live.productId)
    const isRDP = live.osType === 'Windows'
    const diskType = (product?.diskType || localRecord?.productId || '').includes('nvme') ? 'nvme' : 'ssd'

    return {
      _id: String(vpsId),
      contaboInstanceId: live.instanceId,
      name: live.name || live.displayName || localRecord?.label,
      label: localRecord?.label || live.displayName,
      host: ip,
      ipv6: live.ipConfig?.v6?.ip || '',
      status: live.status?.toUpperCase() || 'UNKNOWN',
      region: live.region,
      productId: live.productId,
      productName: product?.name || live.productId,
      cpuCores: live.cpuCores,
      ramMb: live.ramMb,
      diskMb: live.diskMb,
      osType: live.osType,
      isRDP: isRDP,
      plan: localRecord?.plan || 'Monthly',
      planPrice: localRecord?.planPrice,
      start_time: localRecord?.start_time,
      end_time: localRecord?.end_time,
      autoRenewable: localRecord?.autoRenewable || false,
      subscription_id: String(vpsId),
      zone: live.region, // compatibility
      subscription: {
        subscriptionEnd: localRecord?.end_time || new Date(),
        osId: { os_name: isRDP ? 'Windows Server' : (live.imageId || 'Ubuntu') }
      },
      defaultUser: live.defaultUser || (isRDP ? 'admin' : 'root'),

      // ── Compat fields required by lang/en.js selectedVpsData template ──
      planDetails: {
        name: product?.name || live.productId || 'Cloud VPS',
        specs: {
          vCPU: live.cpuCores || product?.cpuCores || '?',
          RAM:  Math.round((live.ramMb || product?.ramMb || 0) / 1024) || '?',
          disk: Math.round((live.diskMb || product?.diskMb || 0) / 1024) || '?',
        }
      },
      diskTypeDetails: {
        type: diskType.toUpperCase()
      },
      osDetails: {
        name: isRDP ? '🖥 Windows Server (RDP)' : (live.osType || 'Linux')
      },
      cPanelPlanDetails: null
    }
  } catch (err) {
    console.log('Error in fetchVPSDetails (contabo):', err.message || err)
    return false
  }
}

// ─── Instance Status Changes ──────────────────────────────────────────────

/**
 * OLD: changeVpsInstanceStatus(vpsDetails, changeStatus) → { success, data }
 * NEW: Maps to Contabo start/stop/restart.
 */
async function changeVpsInstanceStatus(vpsDetails, changeStatus) {
  try {
    const instanceId = vpsDetails.contaboInstanceId || vpsDetails._id
    let result

    switch (changeStatus) {
      case 'start':
        result = await contabo.startInstance(instanceId)
        break
      case 'stop':
        result = await contabo.stopInstance(instanceId)
        break
      case 'restart':
        result = await contabo.restartInstance(instanceId)
        break
      case 'shutdown':
        result = await contabo.shutdownInstance(instanceId)
        break
      default:
        return { error: `Unknown status: ${changeStatus}` }
    }

    // Update MongoDB status
    if (_vpsPlansOf) {
      const newStatus = changeStatus === 'start' ? 'RUNNING' :
                       changeStatus === 'stop' ? 'STOPPED' :
                       changeStatus === 'restart' ? 'RUNNING' :
                       changeStatus === 'shutdown' ? 'STOPPED' : 'UNKNOWN'
      await _vpsPlansOf.updateOne(
        { vpsId: String(instanceId) },
        { $set: { status: newStatus } }
      )
    }

    return { success: true, data: result }
  } catch (err) {
    const errorMessage = `Error changing VPS status to ${changeStatus}: ${err.message || JSON.stringify(err)}`
    console.error(errorMessage)
    return { error: errorMessage }
  }
}

/**
 * OLD: deleteVPSinstance(chatId, vpsId) → { success, data }
 * NEW: Cancels instance on Contabo + marks as DELETED in MongoDB.
 */
async function deleteVPSinstance(chatId, vpsId) {
  try {
    const instanceId = vpsId
    
    // Get the local record to find contaboInstanceId
    let localRecord = null
    if (_vpsPlansOf) {
      localRecord = await _vpsPlansOf.findOne({
        chatId: String(chatId),
        vpsId: String(vpsId)
      })
    }

    const contaboId = localRecord?.contaboInstanceId || instanceId

    const result = await contabo.cancelInstance(contaboId)

    // Mark as deleted in MongoDB
    if (_vpsPlansOf) {
      await _vpsPlansOf.updateOne(
        { vpsId: String(vpsId) },
        { $set: { status: 'DELETED', deletedAt: new Date() } }
      )
    }

    return { success: true, data: result }
  } catch (err) {
    const errorMessage = `Error deleting VPS instance: ${err.message || JSON.stringify(err)}`
    console.error(errorMessage)
    return { error: errorMessage }
  }
}

// ─── Credentials ──────────────────────────────────────────────────────────

/**
 * OLD: setVpsSshCredentials(host) → { success, data: { username, password } }
 * NEW: Uses Contabo resetPassword API, OR returns the stored password from creation.
 */
async function setVpsSshCredentials(host) {
  try {
    // Find instance by IP
    let instanceId = null
    let defaultUser = 'root'
    if (_vpsPlansOf) {
      const record = await _vpsPlansOf.findOne({ host: host })
      instanceId = record?.contaboInstanceId
      defaultUser = record?.defaultUser || 'root'
    }

    if (!instanceId) {
      // Try to find from live instances
      const instances = await contabo.listInstances()
      const match = instances.find(i => i.ipConfig?.v4?.ip === host)
      instanceId = match?.instanceId
      // Use defaultUser from Contabo API response
      if (match?.defaultUser) defaultUser = match.defaultUser
    }

    if (instanceId) {
      // Pass defaultUser, imageId, osType, isRDP so resetPassword can decide:
      //  - Linux non-root → reinstall with bash cloud-init (preserves Ubuntu)
      //  - Windows (any defaultUser) → standard resetPassword API (preserves Windows)
      // Without osType/isRDP, the resetPassword path used to coerce Windows to Ubuntu.
      const resetOpts = {}
      if (_vpsPlansOf) {
        const record = await _vpsPlansOf.findOne({ contaboInstanceId: instanceId })
        if (record?.defaultUser) resetOpts.defaultUser = record.defaultUser
        if (record?.imageId) resetOpts.imageId = record.imageId
        if (record?.osType) resetOpts.osType = record.osType
        if (typeof record?.isRDP === 'boolean') resetOpts.isRDP = record.isRDP
      }
      const { password } = await contabo.resetPassword(instanceId, resetOpts)
      return {
        success: true,
        data: {
          username: defaultUser,
          password: password
        }
      }
    }

    // Fallback: generate random password (can't apply without instanceId)
    return {
      success: true,
      data: {
        username: defaultUser,
        password: generateRandomPassword()
      }
    }
  } catch (err) {
    const errorMessage = `Error setting VPS credentials: ${err.message || JSON.stringify(err)}`
    console.error(errorMessage)
    return { error: errorMessage }
  }
}

/**
 * OLD: createPleskResetLink(telegramId, vpsData) → { link }
 * NEW: Not available in Contabo API.
 */
async function createPleskResetLink(telegramId, vpsData) {
  console.log('[Contabo] Plesk password reset not available via Contabo API')
  return false
}

// ─── Auto-Renewal ─────────────────────────────────────────────────────────

/**
 * OLD: changeVpsAutoRenewal(telegramId, vpsDetails) → toggles auto renewal
 * NEW: Toggles in MongoDB. Contabo billing is separate.
 */
async function changeVpsAutoRenewal(telegramId, vpsDetails) {
  try {
    if (!_vpsPlansOf) return false

    const vpsId = vpsDetails._id || vpsDetails.vpsId
    const newValue = !vpsDetails.autoRenewable

    await _vpsPlansOf.updateOne(
      { chatId: String(telegramId), vpsId: String(vpsId) },
      { $set: { autoRenewable: newValue } }
    )

    return { autoRenewable: newValue }
  } catch (err) {
    console.log('Error in changeVpsAutoRenewal (contabo):', err.message || err)
    return false
  }
}

// ─── Upgrades ─────────────────────────────────────────────────────────────

/**
 * OLD: fetchVpsUpgradeOptions(telegramId, vpsId, upgradeType) → array of upgrade options
 * NEW: Returns higher-tier products from Contabo catalog.
 */
async function fetchVpsUpgradeOptions(telegramId, vpsId, upgradeType = 'vps') {
  try {
    // Get current instance details
    const vpsDetails = await fetchVPSDetails(telegramId, vpsId)
    if (!vpsDetails) return false

    const currentProduct = contabo.getProduct(vpsDetails.productId)
    if (!currentProduct) return false

    const isRDP = vpsDetails.isRDP || false
    const region = vpsDetails.region || 'EU'

    if (upgradeType === 'vps' || upgradeType === 'plan') {
      // Return higher-tier products of the same disk type
      const allProducts = contabo.listProducts(region, isRDP, currentProduct.diskType)
      const upgrades = allProducts.filter(p => p.tier > currentProduct.tier)

      return upgrades.map(p => ({
        _id: p.productId,
        from: currentProduct.name,
        to: p.name,
        fromTier: currentProduct.tier,
        toTier: p.tier,
        currentPrice: contabo.calculatePrice(currentProduct, region, isRDP).totalWithMarkup,
        monthlyPrice: p.pricing.totalWithMarkup,
        priceDifference: Math.round((p.pricing.totalWithMarkup - contabo.calculatePrice(currentProduct, region, isRDP).totalWithMarkup) * 100) / 100,
        specs: contabo.formatSpecs(p),
        cpuCores: p.cpuCores,
        ramGb: p.ramGb,
        diskGb: p.diskGb,
        diskType: p.diskType,
        billingCycle: 'Monthly'
      }))
    } else if (upgradeType === 'disk') {
      // Switch disk type: NVMe ↔ SSD
      const otherDiskType = currentProduct.diskType === 'nvme' ? 'ssd' : 'nvme'
      const sametierProduct = (otherDiskType === 'ssd' ? contabo.PRODUCT_CATALOG_SSD : contabo.PRODUCT_CATALOG)
        .find(p => p.tier === currentProduct.tier)

      if (!sametierProduct) return []

      const pricing = contabo.calculatePrice(sametierProduct, region, isRDP)
      return [{
        _id: sametierProduct.productId,
        from: currentProduct.name,
        to: sametierProduct.name,
        monthlyPrice: pricing.totalWithMarkup,
        specs: contabo.formatSpecs(sametierProduct),
        diskType: otherDiskType
      }]
    }

    return []
  } catch (err) {
    console.log('Error in fetchVpsUpgradeOptions (contabo):', err.message || err)
    return false
  }
}

/**
 * OLD: getVpsUpgradePrice(vpsDetails) → price number
 * NEW: Returns monthly price of the upgrade target.
 */
const getVpsUpgradePrice = (vpsDetails) => {
  return vpsDetails.upgradeOption?.monthlyPrice || vpsDetails.totalPrice || 0
}

/**
 * OLD: upgradeVPSPlanType(telegramId, vpsDetails) → { success, data }
 * NEW: Uses Contabo in-place upgrade API.
 */
async function upgradeVPSPlanType(telegramId, vpsDetails) {
  try {
    const instanceId = vpsDetails.contaboInstanceId || vpsDetails._id
    const newProductId = vpsDetails.upgradeOption?._id || vpsDetails.newProductId

    if (!newProductId) return { error: 'No upgrade target specified' }

    const result = await contabo.upgradeInstance(instanceId, newProductId)

    // Update MongoDB record
    if (_vpsPlansOf) {
      const newProduct = contabo.getProduct(newProductId)
      await _vpsPlansOf.updateOne(
        { vpsId: String(vpsDetails._id) },
        { $set: {
          productId: newProductId,
          planPrice: vpsDetails.totalPrice
        }}
      )
    }

    return {
      success: true,
      data: {
        price: vpsDetails.totalPrice,
        productId: newProductId,
        ...result
      }
    }
  } catch (err) {
    const errorMessage = `Error upgrading VPS plan: ${err.message || JSON.stringify(err)}`
    console.error(errorMessage)
    return { error: errorMessage }
  }
}

/**
 * OLD: upgradeVPSDiskType(telegramId, vpsDetails) → { success, data }
 * NEW: Uses Contabo in-place upgrade API (NVMe ↔ SSD swap).
 */
async function upgradeVPSDiskType(telegramId, vpsDetails) {
  try {
    const instanceId = vpsDetails.contaboInstanceId || vpsDetails._id
    const newProductId = vpsDetails.upgradeOption?._id || vpsDetails.newProductId

    if (!newProductId) return { error: 'No disk upgrade target specified' }

    const result = await contabo.upgradeInstance(instanceId, newProductId)

    // Update MongoDB record
    if (_vpsPlansOf) {
      await _vpsPlansOf.updateOne(
        { vpsId: String(vpsDetails._id) },
        { $set: {
          productId: newProductId,
          planPrice: vpsDetails.totalPrice
        }}
      )
    }

    return {
      success: true,
      data: {
        subscription: { price: vpsDetails.totalPrice },
        productId: newProductId,
        ...result
      }
    }
  } catch (err) {
    const errorMessage = `Error upgrading VPS disk type: ${err.message || JSON.stringify(err)}`
    console.error(errorMessage)
    return { error: errorMessage }
  }
}

// ─── Renewal ──────────────────────────────────────────────────────────────

/**
 * OLD: renewVPSPlan(telegramId, subscriptionId) → { success, data }
 * NEW: Extends the end_time in MongoDB by 1 month. Contabo handles its own billing.
 */
async function renewVPSPlan(telegramId, subscriptionId) {
  try {
    if (!_vpsPlansOf) return { error: 'Database not available' }

    const record = await _vpsPlansOf.findOne({ vpsId: String(subscriptionId) })
    if (!record) return { error: 'VPS record not found' }

    const currentEnd = new Date(record.end_time)
    const newEnd = new Date(currentEnd)
    newEnd.setMonth(newEnd.getMonth() + 1)

    await _vpsPlansOf.updateOne(
      { vpsId: String(subscriptionId) },
      { $set: { end_time: newEnd, status: 'RUNNING', _autoRenewAttempted: false, _reminder3DaySent: false, _reminder1DaySent: false } }
    )

    return {
      success: true,
      data: {
        subscriptionEnd: newEnd.toISOString(),
        plan: record.plan,
        planPrice: record.planPrice
      }
    }
  } catch (err) {
    const errorMessage = `Error renewing VPS plan: ${err.message || JSON.stringify(err)}`
    console.error(errorMessage)
    return { error: errorMessage }
  }
}

/**
 * OLD: renewVPSCPanel(telegramId, subscriptionId) → { success, data }
 * NEW: Not available in Contabo. Returns error.
 */
async function renewVPSCPanel(telegramId, subscriptionId) {
  return { error: 'cPanel renewal not available with current VPS provider' }
}

// ─── Email ────────────────────────────────────────────────────────────────

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_DOMAIN,
  port: process.env.MAIL_PORT,
  auth: {
    user: process.env.MAIL_AUTH_USER,
    pass: process.env.MAIL_AUTH_PASSWORD,
  },
})

/**
 * Send VPS credentials email. Adapted for Contabo data shape.
 * Handles both Linux (SSH) and Windows (RDP) credentials.
 */
async function sendVPSCredentialsEmail(info, response, vpsDetails, credentials) {
  const isRDP = vpsDetails.isRDP || vpsDetails.os?.isRDP || response.osType === 'Windows'
  const plan = isRDP ? 'RDP Plan' : 'VPS Plan'
  const connectionInfo = isRDP
    ? `<tr><td style="font-size: 16px; padding: 15px; background-color: #eee; border: 1px solid #ddd; border-radius: 5px;">
          <strong>🖥 RDP Connection:</strong> ${response.host}:3389
       </td></tr>`
    : `<tr><td style="font-size: 16px; padding: 15px; background-color: #eee; border: 1px solid #ddd; border-radius: 5px;">
          <strong>SSH Command:</strong> ssh ${credentials?.username || 'root'}@${response.host}
       </td></tr>`

  const emailHtml = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #007bff; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0;">🎉 Congratulations!</h1>
        </div>
        <div style="padding: 10px 20px; background-color: #f9f9f9; border-radius: 0 0 10px 10px;">
            <p style="font-size: 18px; line-height: 1.6;">
                Hello <strong>${info.username || 'User'}</strong>,
            </p>
            <p style="font-size: 18px; line-height: 1.6;">
                Your <strong style="text-transform: capitalize;">${plan}</strong> has been successfully activated!
            </p>
            <p style="font-size: 18px; line-height: 1.6; color: #007bff;">
                Here's your order summary:
            </p>
            <table style="width: 100%; margin-top: 10px; border-collapse: separate; border-spacing: 0 10px;">
              <tr>
                  <td style="font-size: 16px; padding: 15px; background-color: #eee; border: 1px solid #ddd; border-radius: 5px;">
                      <strong>Instance Name:</strong> ${response.name || response.vps_name}
                  </td>
              </tr>
              <tr>
                  <td style="font-size: 16px; padding: 15px; background-color: #eee; border: 1px solid #ddd; border-radius: 5px;">
                      <strong>IP Address:</strong> ${response.host}
                  </td>
              </tr>
              ${connectionInfo}
              <tr>
                  <td style="font-size: 16px; padding: 15px; background-color: #eee; border: 1px solid #ddd; border-radius: 5px;">
                      <strong>OS:</strong> ${vpsDetails.os ? vpsDetails.os.name : (isRDP ? 'Windows Server 2025' : 'Linux')}
                  </td>
              </tr>
              <tr>
                  <td style="font-size: 16px; padding: 15px; background-color: #eee; border: 1px solid #ddd; border-radius: 5px;">
                      <strong>Username:</strong> ${credentials?.username || (isRDP ? 'admin' : 'root')}
                  </td>
              </tr>
              <tr>
                  <td style="font-size: 16px; padding: 15px; background-color: #eee; border: 1px solid #ddd; border-radius: 5px;">
                      <strong>Password:</strong> ${credentials?.password || 'Set during provisioning'}
                  </td>
              </tr>
            </table>
            <p style="font-size: 18px; margin-top: 10px; line-height: 1.6;">
                If you need any assistance, feel free to contact our support team.
            </p>
            <p style="font-size: 18px; line-height: 1.6; margin-top: 15px;">
                Best regards,<br>
                Nomadly Team
            </p>
        </div>
    </div>`

  try {
    const mailResponse = await transporter.sendMail({
      from: process.env.MAIL_SENDER,
      to: info.userEmail,
      subject: `🎉 Your ${plan} has been Activated!`,
      html: emailHtml,
    })
    console.log('VPS credentials email sent:', mailResponse.messageId)
  } catch (error) {
    console.error('Error sending VPS credentials email:', error)
  }
}

// ─── Expiry Date ──────────────────────────────────────────────────────────

const getExpiryDateVps = (plan) => {
  const now = new Date()
  let expiresAt
  switch (plan) {
    case 'Hourly':
      expiresAt = new Date(now.getTime() + 1 * 60 * 60 * 1000)
      break
    case 'Monthly':
      expiresAt = new Date(now)
      expiresAt.setMonth(expiresAt.getMonth() + 1)
      break
    case 'Quarterly':
    case 'Quaterly':  // keep old typo compatibility
      expiresAt = new Date(now)
      expiresAt.setMonth(expiresAt.getMonth() + 3)
      break
    case 'Annually':
      expiresAt = new Date(now)
      expiresAt.setFullYear(expiresAt.getFullYear() + 1)
      break
    default:
      expiresAt = new Date(now)
      expiresAt.setMonth(expiresAt.getMonth() + 1) // default monthly
      break
  }
  return expiresAt
}

// ─── Exports ──────────────────────────────────────────────────────────────
module.exports = {
  // DB initialization
  initVpsDb,

  // Region/Country/Zone (flattened for Contabo)
  fetchAvailableCountries,
  fetchAvailableRegionsOfCountry,
  fetchAvailableZones,

  // Disk types
  fetchAvailableDiskTpes,

  // VPS configs / plans
  fetchAvailableVPSConfigs,

  // OS images
  fetchAvailableOS,
  fetchSelectedCpanelOptions,

  // User registration (no-ops for Contabo)
  registerVpsTelegram,
  checkMissingEmailForNameword,
  addUserEmailForNameWord,

  // SSH keys
  fetchUserSSHkeyList,
  generateNewSSHkey,
  uploadSSHPublicKey,
  downloadSSHKeyFile,
  unlinkSSHKeyFromVps,

  // Instance CRUD
  createVPSInstance,
  attachSSHKeysToVM,
  fetchUserVPSList,
  fetchVPSDetails,
  changeVpsInstanceStatus,
  deleteVPSinstance,

  // Credentials
  setVpsSshCredentials,
  createPleskResetLink,

  // Auto-renewal
  changeVpsAutoRenewal,

  // Upgrades
  fetchVpsUpgradeOptions,
  getVpsUpgradePrice,
  upgradeVPSPlanType,
  upgradeVPSDiskType,

  // Renewal
  renewVPSPlan,
  renewVPSCPanel,

  // Email
  sendVPSCredentialsEmail,

  // Utility
  getExpiryDateVps,
  generateRandomName,
  generateRandomPassword
}
