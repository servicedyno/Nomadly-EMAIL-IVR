/* global process */
/**
 * cPanel/WHM Health Probe
 * ------------------------
 * Lightweight TCP probe + cached license check for the WHM control plane.
 *
 * Used by:
 *   - cpanel-proxy.js  → short-circuit known-down requests (no kernel round-trip)
 *   - cpanel-job-queue → decide whether to drain the deferred-jobs queue
 *   - cr-register-domain-&-create-cpanel → queue post-payment provisioning
 *     instead of failing in front of a paying user
 *
 * Caching strategy:
 *   - reachable check (TCP connect to :2087): TTL 15s when up, 5s when down
 *   - license check (verify.cpanel.net):       TTL 5min  (rate-limit friendly)
 */

const net = require('net')
const https = require('https')
const { log } = require('console')

const WHM_HOST = process.env.WHM_HOST
const WHM_PORT = 2087
// ── Tunnel routing for health probe ──
// When WHM_API_URL is set we no longer have direct TCP access to WHM_HOST:2087
// (the firewall blocks public access). Instead we probe the tunnel hostname
// with an HTTPS HEAD — any HTTP response (including 401) means the control
// plane is up. Falls back to the legacy TCP probe when the env var is unset.
const WHM_API_URL = (process.env.WHM_API_URL || '').replace(/\/+$/, '')
const REACHABLE_TTL_UP_MS = 15 * 1000
const REACHABLE_TTL_DOWN_MS = 5 * 1000
const LICENSE_TTL_MS = 5 * 60 * 1000
const PROBE_TIMEOUT_MS = 2000

let _cache = {
  reachable: null,        // true | false | null (never probed)
  reachableCheckedAt: 0,
  reachableReason: '',
  licensed: null,         // true | false | null
  licenseCheckedAt: 0,
  // observability
  consecutiveDownProbes: 0,
  firstDownAt: 0,
  lastUpAt: 0,
  // listeners for state transitions (e.g. queue worker)
  _onUpListeners: [],
  _onDownListeners: [],
}

function _tcpProbe(host, port, timeoutMs) {
  return new Promise(resolve => {
    let resolved = false
    const sock = new net.Socket()
    const finish = (ok, reason) => {
      if (resolved) return
      resolved = true
      try { sock.destroy() } catch (_) {}
      resolve({ ok, reason })
    }
    sock.setTimeout(timeoutMs)
    sock.once('connect', () => finish(true, 'connected'))
    sock.once('timeout', () => finish(false, 'TIMEOUT'))
    sock.once('error', err => finish(false, err.code || err.message || 'ERR'))
    sock.connect(port, host)
  })
}

/**
 * HTTPS reachability probe via the Cloudflare Tunnel hostname.
 * Used when WHM_API_URL is set (production lockdown — direct TCP to :2087 is
 * blocked at the firewall). Any HTTP response (including 401) means the
 * cloudflared daemon is connected and the WHM server is responding to
 * requests from the tunnel side.
 */
function _tunnelHttpsProbe(url, timeoutMs) {
  return new Promise(resolve => {
    let resolved = false
    const finish = (ok, reason) => {
      if (resolved) return
      resolved = true
      resolve({ ok, reason })
    }
    try {
      const req = https.request(url + '/login/', {
        method: 'HEAD',
        timeout: timeoutMs,
        // The cert at this hostname is Cloudflare's, served by CF edge
        rejectUnauthorized: true,
      }, res => {
        // Any HTTP response = control plane reachable end-to-end
        finish(true, `http_${res.statusCode}`)
        try { res.resume() } catch (_) {}
      })
      req.on('timeout', () => { try { req.destroy() } catch (_) {}; finish(false, 'TIMEOUT') })
      req.on('error', err => finish(false, err.code || err.message || 'ERR'))
      req.end()
    } catch (e) {
      finish(false, e.message || 'ERR')
    }
  })
}

/**
 * Probe whether the WHM control-plane port is accepting connections.
 * Distinct from "licensed": the daemon may be running but the license invalid,
 * or vice-versa. Both must be true for control-plane API calls to succeed.
 */
async function isWhmReachable({ force = false } = {}) {
  if (!WHM_HOST) return false
  const now = Date.now()
  const ttl = _cache.reachable === false ? REACHABLE_TTL_DOWN_MS : REACHABLE_TTL_UP_MS
  if (!force && _cache.reachable !== null && (now - _cache.reachableCheckedAt) < ttl) {
    return _cache.reachable
  }

  const { ok, reason } = WHM_API_URL
    ? await _tunnelHttpsProbe(WHM_API_URL, PROBE_TIMEOUT_MS)
    : await _tcpProbe(WHM_HOST, WHM_PORT, PROBE_TIMEOUT_MS)
  const wasReachable = _cache.reachable
  _cache.reachable = ok
  _cache.reachableReason = reason
  _cache.reachableCheckedAt = now

  if (ok) {
    _cache.lastUpAt = now
    _cache.consecutiveDownProbes = 0
    if (wasReachable === false) {
      log(`[cPanel Health] ✅ WHM control-plane back UP after ${Math.round((now - _cache.firstDownAt) / 1000)}s downtime`)
      _cache.firstDownAt = 0
      _emit('up', { at: now })
    }
  } else {
    _cache.consecutiveDownProbes += 1
    if (wasReachable !== false) {
      _cache.firstDownAt = now
      log(`[cPanel Health] ⛔️ WHM control-plane DOWN — first detection (${reason})`)
      _emit('down', { at: now, reason })
    }
  }
  return ok
}

/**
 * Lightweight (non-blocking) read of the last cached reachability decision.
 * Used by hot-path code that wants to skip the kernel round-trip when WHM
 * is known-down — does NOT trigger a probe. Returns true if cache is empty
 * (default to "try the call") so we never refuse on a cold cache.
 */
function isWhmReachableCached() {
  if (_cache.reachable === null) return true
  // expire downstream "down" caches faster — on the second look, force a re-probe
  return _cache.reachable
}

/**
 * Async license-state read. Calls verify.cpanel.net once per 5 minutes.
 * Returns:
 *   true  — license is valid
 *   false — verify.cpanel.net says "Not licensed"
 *   null  — could not determine (network error, parse error, etc.)
 */
function isLicensed({ force = false } = {}) {
  if (!WHM_HOST) return Promise.resolve(null)
  const now = Date.now()
  if (!force && _cache.licensed !== null && (now - _cache.licenseCheckedAt) < LICENSE_TTL_MS) {
    return Promise.resolve(_cache.licensed)
  }
  return new Promise(resolve => {
    const url = `https://verify.cpanel.net/app/verify?ip=${encodeURIComponent(WHM_HOST)}`
    const req = https.get(url, {
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0 NomadlyHealthCheck/1.0' },
    }, res => {
      let body = ''
      res.on('data', c => { body += c })
      res.on('end', () => {
        let parsed = null
        if (/Not\s+licensed/i.test(body)) parsed = false
        else if (/alert-success|License is currently active|Active license|Results:\s*Active/i.test(body)) parsed = true
        // unknown markup → keep as null so caller can ignore
        _cache.licensed = parsed
        _cache.licenseCheckedAt = now
        if (parsed === false) {
          log(`[cPanel Health] ⚠️ verify.cpanel.net says ${WHM_HOST} is NOT LICENSED`)
        } else if (parsed === true) {
          log(`[cPanel Health] ✅ verify.cpanel.net confirms ${WHM_HOST} licensed`)
        }
        resolve(parsed)
      })
    })
    req.on('timeout', () => { try { req.destroy() } catch (_) {}; resolve(null) })
    req.on('error', err => {
      log(`[cPanel Health] license check error: ${err.message}`)
      resolve(null)
    })
  })
}

/**
 * One-shot status snapshot — useful for /hostingstatus admin command + UI.
 */
async function getStatus({ refresh = false } = {}) {
  const reachable = await isWhmReachable({ force: refresh })
  const licensed = await isLicensed({ force: refresh })
  let summary = 'up'
  if (!reachable) summary = licensed === false ? 'unlicensed' : 'down'
  return {
    summary,
    reachable,
    licensed,
    reachableReason: _cache.reachableReason,
    consecutiveDownProbes: _cache.consecutiveDownProbes,
    firstDownAt: _cache.firstDownAt || null,
    lastUpAt: _cache.lastUpAt || null,
    host: WHM_HOST,
  }
}

// ─── State-transition listeners ─────────────────────────

function onUp(fn) { if (typeof fn === 'function') _cache._onUpListeners.push(fn) }
function onDown(fn) { if (typeof fn === 'function') _cache._onDownListeners.push(fn) }
function _emit(kind, payload) {
  const list = kind === 'up' ? _cache._onUpListeners : _cache._onDownListeners
  for (const fn of list) {
    try { fn(payload) } catch (e) { log(`[cPanel Health] listener error: ${e.message}`) }
  }
}

/**
 * Start the periodic probe loop. Idempotent.
 */
let _loopHandle = null
function startProbeLoop({ intervalMs = 20 * 1000 } = {}) {
  if (_loopHandle) return
  // immediate first probe + license check, then schedule
  isWhmReachable({ force: true }).catch(() => {})
  isLicensed({ force: false }).catch(() => {})
  _loopHandle = setInterval(() => {
    isWhmReachable({ force: true }).catch(() => {})
    // license re-check piggybacks but uses its own TTL
    isLicensed({ force: false }).catch(() => {})
  }, intervalMs)
  if (typeof _loopHandle.unref === 'function') _loopHandle.unref()
}

function stopProbeLoop() {
  if (_loopHandle) { clearInterval(_loopHandle); _loopHandle = null }
}

module.exports = {
  isWhmReachable,
  isWhmReachableCached,
  isLicensed,
  getStatus,
  onUp,
  onDown,
  startProbeLoop,
  stopProbeLoop,
  // exposed for tests
  _resetCache: () => {
    _cache = {
      reachable: null, reachableCheckedAt: 0, reachableReason: '',
      licensed: null, licenseCheckedAt: 0,
      consecutiveDownProbes: 0, firstDownAt: 0, lastUpAt: 0,
      _onUpListeners: [], _onDownListeners: [],
    }
  },
}
