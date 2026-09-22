'use strict'
/**
 * digitalocean-rdp-service.js — Windows RDP on DigitalOcean, ported from the
 * standalone RDP-DIGITALOCEAN FastAPI backend (do_client.py + provisioning.py +
 * database.py catalog) into Nomadly's provider interface.
 *
 * WHY: DigitalOcean has no native Windows. This provider creates an Ubuntu
 * droplet and runs a cloud-init script (js/rdp-scripts/convert_to_windows.sh +
 * autounattend.xml.tmpl) that QEMU-installs Windows Server, enables RDP with a
 * unique Administrator password, and reports progress via a token-gated
 * callback (POST {SELF_URL}/provision/callback → Node /provision/callback).
 * A faster "golden image" snapshot path is used automatically when available.
 *
 * It implements the SAME interface every other VPS/RDP provider exposes
 * (js/vps-provider.js + reseller-api.js vps*Handlers):
 *   PROVIDER, listProducts, getProduct, calculatePrice,
 *   createInstance / createInstanceWithFallback, getInstance,
 *   startInstance, stopInstance, restartInstance, shutdownInstance,
 *   cancelInstance, getSecretPassword.
 *
 * State lives in Mongo `doRdpServers` (droplet id, callback token, status,
 * progress, logs, expiry). The reseller API stores the returned instanceId
 * (our server_id) on vpsPlansOf; every action resolves droplet_id from here.
 */

const axios = require('axios')
const crypto = require('crypto')
const net = require('net')
const fs = require('fs')
const path = require('path')

const secretStore = require('./vps-secret-store')

const log = (...a) => console.log('[DO-RDP]', ...a)
const PROVIDER = 'digitalocean'
const DO_BASE = 'https://api.digitalocean.com/v2'
const SCRIPTS_DIR = path.join(__dirname, 'rdp-scripts')

// ─────────────────────────────────────────────────────────────
// Catalog (imported verbatim from the repo's database.py)
// ─────────────────────────────────────────────────────────────
const DURATIONS = [1, 2, 3]

const TIERS = [
  { slug: 'starter',  name: 'Starter',  vcpu: 1, ram_gb: 2,  disk_gb: 50,  do_size_slug: 's-1vcpu-2gb',  monthly_do_cost: 12 },
  { slug: 'standard', name: 'Standard', vcpu: 2, ram_gb: 4,  disk_gb: 80,  do_size_slug: 's-2vcpu-4gb',  monthly_do_cost: 24 },
  { slug: 'pro',      name: 'Pro',      vcpu: 4, ram_gb: 8,  disk_gb: 160, do_size_slug: 's-4vcpu-8gb',  monthly_do_cost: 48 },
  { slug: 'power',    name: 'Power',    vcpu: 8, ram_gb: 16, disk_gb: 320, do_size_slug: 's-8vcpu-16gb', monthly_do_cost: 96 },
]

const VIRTIO = 'https://fedorapeople.org/groups/virt/virtio-win/direct-downloads/stable-virtio/virtio-win.iso'
const OS_OPTIONS = {
  ws2019: { id: 'ws2019', name: 'Windows Server 2019', image_name: 'Windows Server 2019 SERVERSTANDARD', virtio_dir: '2k19', iso_url: 'https://go.microsoft.com/fwlink/p/?linkid=2195167&clcid=0x409&culture=en-us&country=US', virtio_url: VIRTIO, install_method: 'qemu', image_url: '' },
  ws2022: { id: 'ws2022', name: 'Windows Server 2022', image_name: 'Windows Server 2022 SERVERSTANDARD', virtio_dir: '2k22', iso_url: 'https://go.microsoft.com/fwlink/p/?LinkID=2195280&clcid=0x409&culture=en-us&country=US', virtio_url: VIRTIO, install_method: 'qemu', image_url: '' },
  ws2025: { id: 'ws2025', name: 'Windows Server 2025', image_name: 'Windows Server 2025 SERVERSTANDARD', virtio_dir: '2k25', iso_url: 'https://go.microsoft.com/fwlink/?linkid=2293312&clcid=0x409&culture=en-us&country=US', virtio_url: VIRTIO, install_method: 'qemu', image_url: '' },
}
const DEFAULT_OS_ID = String(process.env.DO_RDP_DEFAULT_OS || 'ws2022').toLowerCase()

// Reseller region codes → DigitalOcean region slugs. Also accepts a raw DO slug.
const REGION_TO_DO = {
  EU: 'fra1', DE: 'fra1', NL: 'ams3', UK: 'lon1', GB: 'lon1',
  US: 'nyc3', USA: 'nyc3', 'US-EAST': 'nyc3', 'US-WEST': 'sfo3',
  CA: 'tor1', IN: 'blr1', SG: 'sgp1', SGP: 'sgp1', AU: 'syd1', SYD: 'syd1',
}
function regionToSlug(region) {
  const r = String(region || '').trim()
  if (/^[a-z]{3}\d$/i.test(r)) return r.toLowerCase() // already a DO slug e.g. nyc3
  return REGION_TO_DO[r.toUpperCase()] || 'nyc3'
}

// Golden-image build droplet needs >=4 GB for the QEMU install; its 80 GB disk
// becomes the minimum disk for droplets launched from the snapshot.
const BUILD_SIZE = 's-2vcpu-4gb'
const BUILD_DISK_GB = 80
const UBUNTU_IMAGE = process.env.DO_UBUNTU_IMAGE || 'ubuntu-22-04-x64'

// ─────────────────────────────────────────────────────────────
// Products (tier × duration). productId encodes both, so it slots into the
// generic reseller vps flow (which has no duration param). Price = repo's
// monthly_do_cost × months × 2 (no extra Nomadly markup — per product decision).
// ─────────────────────────────────────────────────────────────
function sellPrice(tier, months) { return Math.round(tier.monthly_do_cost * months * 2 * 100) / 100 }

function _products() {
  const out = []
  for (const t of TIERS) {
    for (const m of DURATIONS) {
      const price = sellPrice(t, m)
      out.push({
        productId: `${t.slug}-${m}m`,
        slug: t.slug,
        durationMonths: m,
        name: `${t.name} — Windows RDP (${m} month${m > 1 ? 's' : ''})`,
        vcpus: t.vcpu, ramGb: t.ram_gb, diskGb: t.disk_gb,
        do_size_slug: t.do_size_slug,
        pricing: { base: price, markup: 0, totalWithMarkup: price, currency: 'usd', durationMonths: m },
      })
    }
  }
  return out
}
const PRODUCTS = _products()
const PRODUCT_BY_ID = new Map(PRODUCTS.map(p => [p.productId, p]))

function listProducts(_regionSlug = 'EU', isWindows = true /* , diskPreference */) {
  if (isWindows === false) return [] // this provider is RDP-only
  return PRODUCTS
}
function getProduct(planId) { return PRODUCT_BY_ID.get(String(planId || '')) || null }
function calculatePrice(product, _regionSlug, _isWindows) {
  const p = typeof product === 'string' ? getProduct(product) : product
  if (!p || !p.pricing) return null
  return p.pricing
}

// ─────────────────────────────────────────────────────────────
// DigitalOcean v2 client (token stays server-side)
// ─────────────────────────────────────────────────────────────
function _token() { return process.env.DIGITALOCEAN_API_TOKEN || '' }
async function doRequest(method, urlPath, body) {
  const token = _token()
  if (!token) throw new Error('DIGITALOCEAN_API_TOKEN not configured')
  const res = await axios({
    method, url: `${DO_BASE}${urlPath}`,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: body || undefined, timeout: 60000, validateStatus: () => true,
  })
  if (res.status >= 400) {
    const detail = (res.data && res.data.message) || (typeof res.data === 'string' ? res.data.slice(0, 300) : `HTTP ${res.status}`)
    const err = new Error(`DigitalOcean API error ${res.status}: ${detail}`)
    err.status = res.status
    throw err
  }
  return res.data || {}
}
const doCreateDroplet = (b) => doRequest('POST', '/droplets', b)
const doGetDroplet = (id) => doRequest('GET', `/droplets/${id}`)
const doDropletAction = (id, b) => doRequest('POST', `/droplets/${id}/actions`, b)
const doDeleteDroplet = (id) => doRequest('DELETE', `/droplets/${id}`)

// ─────────────────────────────────────────────────────────────
// Mongo state (doRdpServers) — initialised once from _index.js
// ─────────────────────────────────────────────────────────────
let _servers = null
let _osCol = null
function init(db) {
  try {
    if (!db || typeof db.collection !== 'function') return false
    _servers = db.collection('doRdpServers')
    _osCol = db.collection('doRdpOsOptions')
    _servers.createIndex({ server_id: 1 }, { unique: true }).catch(() => {})
    _servers.createIndex({ status: 1, expires_at: 1 }).catch(() => {})
    // Seed golden-image state rows for each OS (idempotent).
    for (const id of Object.keys(OS_OPTIONS)) {
      _osCol.updateOne(
        { _id: id },
        { $setOnInsert: { _id: id, golden_status: 'none', golden_image_id: null, golden_regions: [], golden_min_disk_gb: 0 } },
        { upsert: true },
      ).catch(() => {})
    }
    log('initialised (collections=doRdpServers, doRdpOsOptions)')
    // Expiry sweep — NEVER on a dev sandbox (would power off real servers).
    if (process.env.SKIP_WEBHOOK_SYNC !== 'true') {
      setInterval(() => { processExpiries().catch(e => log('expiry sweep error:', e.message)) }, 60 * 60 * 1000)
    } else {
      log('SKIP_WEBHOOK_SYNC=true — expiry sweep DISABLED (dev sandbox)')
    }
    return true
  } catch (e) {
    log('init failed:', e.message || e)
    return false
  }
}

async function getOsOption(osId) {
  const base = OS_OPTIONS[osId] || OS_OPTIONS[DEFAULT_OS_ID]
  let golden = null
  try { if (_osCol) golden = await _osCol.findOne({ _id: base.id }) } catch (_) {}
  return { ...base, golden_status: (golden && golden.golden_status) || 'none', golden_image_id: golden && golden.golden_image_id, golden_regions: (golden && golden.golden_regions) || [], golden_min_disk_gb: (golden && golden.golden_min_disk_gb) || 0 }
}

// ─────────────────────────────────────────────────────────────
// Helpers ported from provisioning.py
// ─────────────────────────────────────────────────────────────
const PW_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#%^*()-_=+'
function genPassword(n = 18) {
  let s = ''
  for (let i = 0; i < n; i++) s += PW_ALPHABET[crypto.randomInt(PW_ALPHABET.length)]
  return s
}
function genToken() { return crypto.randomBytes(24).toString('base64url') }
function callbackBase() { return String(process.env.SELF_URL || '').replace(/\/+$/, '') } // already ends with /api

/** Build the Ubuntu→Windows conversion cloud-init user-data (full path). */
function buildUserData(server, osOption) {
  let script = fs.readFileSync(path.join(SCRIPTS_DIR, 'convert_to_windows.sh'), 'utf8')
  let answer = fs.readFileSync(path.join(SCRIPTS_DIR, 'autounattend.xml.tmpl'), 'utf8')
  const base = callbackBase()
  answer = answer.split('{{ADMIN_PASSWORD}}').join(server.admin_password)
  answer = answer.split('{{IMAGE_NAME}}').join(osOption.image_name)
  answer = answer.split('{{BOOTSCRIPT_URL}}').join(`${base}/provision/bootscript`)
  const answerB64 = Buffer.from(answer, 'utf8').toString('base64')
  const repl = {
    '{{ISO_URL}}': osOption.iso_url,
    '{{VIRTIO_URL}}': osOption.virtio_url,
    '{{INSTALL_METHOD}}': osOption.install_method || 'qemu',
    '{{IMAGE_URL}}': osOption.image_url || '',
    '{{VIRTIO_DIR}}': osOption.virtio_dir || '2k22',
    '{{CALLBACK_URL}}': `${base}/provision/callback`,
    '{{CALLBACK_TOKEN}}': server.callback_token,
    '{{SERVER_ID}}': server.server_id,
    '{{ADMIN_PASSWORD}}': server.admin_password,
    '{{AUTOUNATTEND_B64}}': answerB64,
  }
  for (const [k, v] of Object.entries(repl)) script = script.split(k).join(v)
  return script
}

/** Plain KEY=VALUE user-data read by the baked apply.ps1 on golden droplets. */
function buildMetadataUserData(server) {
  const base = callbackBase()
  return `ADMIN_PASSWORD=${server.admin_password}\n` +
         `CALLBACK_URL=${base}/provision/callback\n` +
         `CALLBACK_TOKEN=${server.callback_token}\n` +
         `SERVER_ID=${server.server_id}\n`
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function addLog(serverId, stage, message, progress, status) {
  if (!_servers) return
  const set = { updated_at: new Date() }
  if (progress != null) set.progress = progress
  if (status != null) set.status = status
  try {
    await _servers.updateOne({ server_id: serverId },
      { $push: { logs: { ts: new Date(), stage, message } }, $set: set })
  } catch (e) { log(`addLog(${serverId}) warn: ${e.message}`) }
}

function tcpOpen(ip, port = 3389, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const sock = new net.Socket()
    let done = false
    const finish = (ok) => { if (done) return; done = true; try { sock.destroy() } catch (_) {} resolve(ok) }
    sock.setTimeout(timeoutMs)
    sock.once('connect', () => finish(true))
    sock.once('timeout', () => finish(false))
    sock.once('error', () => finish(false))
    try { sock.connect(port, ip) } catch (_) { finish(false) }
  })
}

async function waitBootIp(dropletId, tries = 72) {
  for (let i = 0; i < tries; i++) {
    await sleep(5000)
    let d
    try { d = (await doGetDroplet(dropletId)).droplet || {} } catch (_) { continue }
    if (d.status === 'active') {
      const v4 = (d.networks && d.networks.v4) || []
      const pub = v4.find(n => n.type === 'public')
      if (pub && pub.ip_address) return pub.ip_address
    }
  }
  return null
}

async function applyActivation(server) {
  const activated = new Date()
  const expires = new Date(activated.getTime() + 30 * (server.duration_months || 1) * 86400000)
  await _servers.updateOne({ server_id: server.server_id },
    { $set: { status: 'active', progress: 100, activated_at: activated, expires_at: expires } })
}

async function pollRdp(serverId, ip, minutes = 90) {
  let waited = 0
  const interval = 30000, deadline = minutes * 60000
  while (waited < deadline) {
    await sleep(interval); waited += interval
    let s
    try { s = await _servers.findOne({ server_id: serverId }, { projection: { status: 1 } }) } catch (_) { s = null }
    if (!s || ['destroyed', 'failed', 'active', 'suspended', 'expired'].includes(s.status)) return
    if (await tcpOpen(ip, 3389)) {
      const srv = await _servers.findOne({ server_id: serverId })
      await applyActivation(srv)
      await addLog(serverId, 'rdp_ready', `RDP reachable at ${ip}:3389. Server is active.`, 100, 'active')
      return
    }
  }
  await addLog(serverId, 'failed', `RDP not reachable at ${ip}:3389 after ${minutes} min. Windows conversion did not complete.`, null, 'failed')
}

// Fire-and-forget provisioning orchestrator (golden fast-path → conversion fallback).
async function provisionServer(serverId) {
  try {
    const server = await _servers.findOne({ server_id: serverId })
    if (!server) return
    const osOption = await getOsOption(server.os_id)
    const name = `rdp-${serverId.slice(0, 8)}`
    const goldenReady = osOption.golden_status === 'available' && osOption.golden_image_id
    const diskOk = (server.disk_gb || 0) >= (osOption.golden_min_disk_gb || 1e9)
    const regionReady = (osOption.golden_regions || []).includes(server.region)

    if (goldenReady && diskOk && regionReady) {
      await addLog(serverId, 'creating', 'Creating droplet from golden image (fast, ~2-3 min)...', 10, 'creating')
      const data = await doCreateDroplet({ name, region: server.region, size: server.do_size_slug, image: osOption.golden_image_id, user_data: buildMetadataUserData(server), tags: ['rdp-reseller'] })
      const dropletId = data.droplet && data.droplet.id
      await _servers.updateOne({ server_id: serverId }, { $set: { do_droplet_id: dropletId } })
      await addLog(serverId, 'booting', `Droplet ${dropletId} created from image. Booting...`, 30, 'booting')
      const ip = await waitBootIp(dropletId)
      if (ip) {
        await _servers.updateOne({ server_id: serverId }, { $set: { ip_address: ip } })
        await addLog(serverId, 'installing', `Booted from image at ${ip}. Applying config + password.`, 60, 'installing')
        pollRdp(serverId, ip, 20).catch(() => {})
      } else {
        await addLog(serverId, 'installing', 'Droplet active; awaiting first boot.', 60, 'installing')
      }
      return
    }

    // Full Ubuntu → Windows conversion.
    await addLog(serverId, 'creating', 'Creating DigitalOcean droplet...', 5, 'creating')
    const userData = buildUserData(server, osOption)
    const data = await doCreateDroplet({ name, region: server.region, size: server.do_size_slug, image: UBUNTU_IMAGE, user_data: userData, tags: ['rdp-reseller'] })
    const dropletId = data.droplet && data.droplet.id
    await _servers.updateOne({ server_id: serverId }, { $set: { do_droplet_id: dropletId } })
    await addLog(serverId, 'booting', `Droplet ${dropletId} created. Waiting for boot...`, 10, 'booting')
    const ip = await waitBootIp(dropletId)
    if (ip) {
      await _servers.updateOne({ server_id: serverId }, { $set: { ip_address: ip } })
      await addLog(serverId, 'converting', `Ubuntu booted at ${ip}. Windows conversion running on host (20-45 min).`, 15, 'converting')
      pollRdp(serverId, ip).catch(() => {})
    } else {
      await addLog(serverId, 'converting', 'Droplet active; awaiting Windows conversion callbacks.', 15, 'converting')
    }
  } catch (e) {
    await addLog(serverId, 'failed', `Provisioning error: ${e.message}`, null, 'failed')
  }
}

// ─────────────────────────────────────────────────────────────
// Provider interface (consumed by reseller-api vps*Handlers)
// ─────────────────────────────────────────────────────────────
async function createInstance(opts = {}) {
  const product = getProduct(opts.productId)
  if (!product) throw new Error(`createInstance: unknown plan_id "${opts.productId}"`)
  const region = regionToSlug(opts.regionSlug)
  const osId = String(opts.osId || DEFAULT_OS_ID).toLowerCase()
  const serverId = crypto.randomUUID()
  const adminPassword = genPassword()
  const callbackToken = genToken()

  const doc = {
    server_id: serverId, os_id: osId, tier_slug: product.slug,
    duration_months: product.durationMonths, region, do_size_slug: product.do_size_slug,
    disk_gb: product.diskGb, do_droplet_id: null, ip_address: null,
    admin_username: 'Administrator', callback_token: callbackToken,
    status: 'queued', progress: 0, logs: [], label: opts.label || null,
    created_at: new Date(), activated_at: null, expires_at: null,
  }
  if (_servers) await _servers.insertOne(doc)
  // Store the password durably so /rdp/:id/credentials can reveal it later.
  await secretStore.putSecret(serverId, adminPassword, { name: `rdp-${serverId.slice(0, 8)}`, provider: PROVIDER })

  // Kick off provisioning asynchronously; return immediately.
  provisionServer(serverId).catch(e => log(`provisionServer(${serverId}) error: ${e.message}`))

  return {
    instanceId: serverId,
    mainIp: null,
    status: 'provisioning',
    passwordSecretId: serverId,
    defaultPassword: adminPassword,
  }
}
// No cross-provider fallback for DO-RDP (golden→conversion fallback is internal).
async function createInstanceWithFallback(opts) { return createInstance(opts) }

async function getInstance(instanceId) {
  const s = _servers ? await _servers.findOne({ server_id: instanceId }) : null
  if (!s) return { status: 'unknown', mainIp: null }
  // Best-effort live refresh of IP from DO.
  if (s.do_droplet_id && !s.ip_address) {
    try {
      const d = (await doGetDroplet(s.do_droplet_id)).droplet || {}
      const pub = ((d.networks && d.networks.v4) || []).find(n => n.type === 'public')
      if (pub && pub.ip_address) { s.ip_address = pub.ip_address; await _servers.updateOne({ server_id: instanceId }, { $set: { ip_address: pub.ip_address } }) }
    } catch (_) {}
  }
  return { status: s.status, mainIp: s.ip_address || null, progress: s.progress, expires_at: s.expires_at || null, logs: (s.logs || []).slice(-10) }
}

async function _dropletActionByServer(instanceId, actionBody, newStatus) {
  const s = _servers ? await _servers.findOne({ server_id: instanceId }) : null
  if (!s || !s.do_droplet_id) throw new Error('server has no droplet yet')
  const r = await doDropletAction(s.do_droplet_id, actionBody)
  if (newStatus) await _servers.updateOne({ server_id: instanceId }, { $set: { status: newStatus } })
  return { action: r.action || null }
}
const startInstance    = (id) => _dropletActionByServer(id, { type: 'power_on' }, 'active')
const stopInstance     = (id) => _dropletActionByServer(id, { type: 'power_off' }, 'suspended')
const shutdownInstance = (id) => _dropletActionByServer(id, { type: 'shutdown' }, null)
const restartInstance  = (id) => _dropletActionByServer(id, { type: 'reboot' }, null)

async function cancelInstance(instanceId) {
  const s = _servers ? await _servers.findOne({ server_id: instanceId }) : null
  if (s && s.do_droplet_id) { try { await doDeleteDroplet(s.do_droplet_id) } catch (e) { if (e.status !== 404) throw e } }
  if (_servers) await _servers.updateOne({ server_id: instanceId }, { $set: { status: 'destroyed', ip_address: null, do_droplet_id: null } })
  try { await secretStore.deleteSecret(instanceId) } catch (_) {}
  return { destroyed: true }
}

async function getSecretPassword(secretId) {
  try { return await secretStore.getSecretPassword(secretId) } catch (_) { return null }
}

async function processExpiries() {
  if (!_servers) return []
  const now = new Date()
  const suspended = []
  const cursor = _servers.find({ status: 'active', expires_at: { $lte: now } })
  for await (const s of cursor) {
    try { if (s.do_droplet_id) await doDropletAction(s.do_droplet_id, { type: 'power_off' }) } catch (_) {}
    await _servers.updateOne({ server_id: s.server_id }, { $set: { status: 'expired' } })
    suspended.push(s.server_id)
  }
  if (suspended.length) log(`processExpiries: powered off ${suspended.length} expired server(s)`)
  return suspended
}

// ─────────────────────────────────────────────────────────────
// Callback + bootscript router (mounted at /provision by _index.js)
// The on-droplet script posts progress here; token-gated by callback_token.
// ─────────────────────────────────────────────────────────────
function provisionRouter() {
  const express = require('express')
  const router = express.Router()
  router.get('/bootscript', (req, res) => {
    try { res.type('text/plain').send(fs.readFileSync(path.join(SCRIPTS_DIR, 'apply.ps1'), 'utf8')) }
    catch (e) { res.status(500).send(`# bootscript unavailable: ${e.message}`) }
  })
  router.post('/callback', express.json({ limit: '256kb' }), async (req, res) => {
    try {
      const { server_id, token, stage, message, progress, status } = req.body || {}
      if (!server_id || !token) return res.status(400).json({ error: 'missing server_id/token' })
      const s = _servers ? await _servers.findOne({ server_id }) : null
      if (!s || s.callback_token !== token) return res.status(403).json({ error: 'Invalid callback token' })
      if (stage === 'rdp_ready' || (progress != null && Number(progress) >= 100)) {
        await applyActivation(s)
        await addLog(server_id, 'rdp_ready', message || 'Windows is live.', 100, 'active')
      } else if (stage === 'failed') {
        await addLog(server_id, 'failed', message || 'Conversion failed.', progress, 'failed')
      } else {
        await addLog(server_id, stage || 'converting', message || stage || 'progress', progress, status || 'converting')
      }
      res.json({ ok: true })
    } catch (e) { log(`callback error: ${e.message}`); res.status(500).json({ error: 'callback_error' }) }
  })
  return router
}

module.exports = {
  PROVIDER,
  init,
  // catalog / pricing
  listProducts, getProduct, calculatePrice,
  // lifecycle
  createInstance, createInstanceWithFallback, getInstance,
  startInstance, stopInstance, restartInstance, shutdownInstance,
  cancelInstance, getSecretPassword,
  // ops
  processExpiries, provisionRouter,
  // exported for tests / internal use
  _buildUserData: buildUserData, _buildMetadataUserData: buildMetadataUserData,
  _products: () => PRODUCTS, regionToSlug, _genPassword: genPassword, getOsOption,
  DURATIONS, TIERS, OS_OPTIONS, DEFAULT_OS_ID,
}
