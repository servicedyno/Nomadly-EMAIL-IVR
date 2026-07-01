/* global process */
/**
 * cpanel-auto-recover.js
 * ----------------------
 * Last-resort recovery hook for the cPanel/WHM origin droplet.
 *
 * Why this exists
 *   On 2026-05-30 the DigitalOcean droplet hosting WHM/cPanel
 *   (`209.38.241.9`, id `557194941`) entered a soft-hang state — powered
 *   on per DO's API but unresponsive on ALL ports (including SSH/22).
 *   All hosting customers got Cloudflare 530 errors on HostPanel and
 *   the only remedy was a manual `power_cycle` via the DO web console.
 *   This module automates that last-resort recovery so an operator
 *   doesn't have to be woken up for it.
 *
 * How it works
 *   1. Listens to `cpanel-health.onDown(...)` events.
 *   2. Only acts when:
 *      • `WHM_DROPLET_ID` is set (operator opt-in)
 *      • `DIGITALOCEAN_API_TOKEN` is set
 *      • last reboot was > `WHM_AUTO_REBOOT_COOLDOWN_MS` ago (default 30min)
 *      • we're not already in the middle of issuing one (re-entrancy guard)
 *   3. Confirms outage is genuine via a TCP probe on port 22 — if SSH
 *      answers we know the OS is fine and the issue is the tunnel/WHM
 *      itself (which a reboot won't fix faster than the operator can
 *      diagnose), so we *skip* the reboot.
 *   4. Issues a `power_cycle` action via the DO API, polls the action,
 *      waits for SSH:22 to come back, then waits for the tunnel HTTPS
 *      probe to return any HTTP code.
 *   5. Every step is logged + the admin chat is DM'd before / after.
 *
 * Disabled by default: must set `WHM_DROPLET_ID` to enable.
 */

const net = require('net')
const https = require('https')
const { log } = require('console')

const DROPLET_ID = process.env.WHM_DROPLET_ID
const DO_TOKEN = process.env.DIGITALOCEAN_API_TOKEN
const WHM_HOST = process.env.WHM_HOST
const WHM_API_URL = (process.env.WHM_API_URL || '').replace(/\/+$/, '')
const COOLDOWN_MS = Number(process.env.WHM_AUTO_REBOOT_COOLDOWN_MS) || 30 * 60 * 1000

let _lastRebootAt = 0
let _inFlight = false

function _tcpProbe(host, port, timeoutMs) {
  return new Promise(resolve => {
    const sock = new net.Socket()
    let done = false
    const finish = (ok, reason) => {
      if (done) return
      done = true
      try { sock.destroy() } catch (_) {}
      resolve({ ok, reason })
    }
    sock.setTimeout(timeoutMs)
    sock.once('connect', () => finish(true, 'connected'))
    sock.once('timeout', () => finish(false, 'TIMEOUT'))
    sock.once('error', e => finish(false, e.code || e.message || 'ERR'))
    sock.connect(port, host)
  })
}

// Cloudflare error statuses that mean the origin (behind the tunnel) is
// unreachable — see comment in cpanel-health.js for full list.
const CF_ORIGIN_ERROR_STATUSES = new Set([520, 521, 522, 523, 524, 525, 526, 527, 530])

function _httpsProbe(url, timeoutMs) {
  return new Promise(resolve => {
    let done = false
    const finish = (ok, reason) => {
      if (done) return
      done = true
      resolve({ ok, reason })
    }
    try {
      const req = https.request(url + '/login/', {
        method: 'HEAD', timeout: timeoutMs, rejectUnauthorized: true,
      }, res => {
        const code = res.statusCode
        try { res.resume() } catch (_) {}
        // A CF-origin-error status means the edge answered but the tunnel is
        // still down (cloudflared hasn't reconnected yet). Report ok=false so
        // _waitForHostBack keeps polling instead of falsely declaring "healed".
        if (CF_ORIGIN_ERROR_STATUSES.has(code)) finish(false, `cf_origin_${code}`)
        else finish(true, `http_${code}`)
      })
      req.on('timeout', () => { try { req.destroy() } catch (_) {}; finish(false, 'TIMEOUT') })
      req.on('error', e => finish(false, e.code || e.message))
      req.end()
    } catch (e) { finish(false, e.message) }
  })
}

function _doApi(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null
    const req = https.request({
      hostname: 'api.digitalocean.com',
      path,
      method,
      headers: {
        Authorization: `Bearer ${DO_TOKEN}`,
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
      timeout: 15000,
    }, res => {
      let buf = ''
      res.on('data', c => { buf += c })
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(buf) }) }
        catch (_) { resolve({ status: res.statusCode, body: buf }) }
      })
    })
    req.on('timeout', () => { try { req.destroy() } catch (_) {}; reject(new Error('DO API timeout')) })
    req.on('error', reject)
    if (data) req.write(data)
    req.end()
  })
}

async function _waitForAction(actionId, maxSeconds = 90) {
  for (let i = 0; i < maxSeconds / 3; i++) {
    const { body } = await _doApi('GET', `/v2/actions/${actionId}`)
    const status = body?.action?.status
    if (status === 'completed') return true
    if (status === 'errored') return false
    await new Promise(r => setTimeout(r, 3000))
  }
  return false
}

async function _waitForHostBack({ notify, sshTimeoutS = 120, tunnelTimeoutS = 60 }) {
  log('[AutoRecover] waiting for SSH:22 to come back…')
  let sshUp = false
  for (let i = 0; i < sshTimeoutS / 5; i++) {
    const { ok } = await _tcpProbe(WHM_HOST, 22, 4000)
    if (ok) { sshUp = true; break }
    await new Promise(r => setTimeout(r, 5000))
  }
  if (!sshUp) {
    if (notify) notify('⚠️ <b>auto-recover</b>: power_cycle issued but SSH:22 still not back after 2min — manual check required.')
    return false
  }
  if (!WHM_API_URL) return true
  log('[AutoRecover] SSH back; waiting for tunnel HTTPS probe to answer…')
  for (let i = 0; i < tunnelTimeoutS / 5; i++) {
    const { ok } = await _httpsProbe(WHM_API_URL, 6000)
    if (ok) return true
    await new Promise(r => setTimeout(r, 5000))
  }
  if (notify) notify('⚠️ <b>auto-recover</b>: SSH is back but the tunnel is still 530 — cloudflared may be wedged. Manual SSH + <code>systemctl restart cloudflared</code> required.')
  return false
}

/**
 * Attempt to recover the WHM origin via DO power_cycle.
 * Returns { attempted, recovered, reason }.
 */
async function attemptRecovery({ reason = 'unknown', notify } = {}) {
  if (!DROPLET_ID) return { attempted: false, recovered: false, reason: 'not_configured' }
  if (!DO_TOKEN) return { attempted: false, recovered: false, reason: 'no_do_token' }
  if (!WHM_HOST) return { attempted: false, recovered: false, reason: 'no_whm_host' }

  if (_inFlight) {
    log('[AutoRecover] skip — recovery already in flight')
    return { attempted: false, recovered: false, reason: 'in_flight' }
  }
  const now = Date.now()
  if (now - _lastRebootAt < COOLDOWN_MS) {
    const wait = Math.ceil((COOLDOWN_MS - (now - _lastRebootAt)) / 60000)
    log(`[AutoRecover] skip — cooldown active, ${wait}min remaining`)
    return { attempted: false, recovered: false, reason: 'cooldown' }
  }

  // Sanity check 1: SSH-alive semantics vary by outage type
  // ─────────────────────────────────────────────────────────
  // Case A — reason=TIMEOUT/ECONNREFUSED (OS-level hard hang):
  //   SSH is definitionally part of that hang. If SSH answers, the OS is
  //   fine and something WHM-service-level is the issue — do NOT reboot.
  //
  // Case B — reason=cf_origin_5xx (Cloudflare Tunnel connector dead):
  //   The OS is up (SSH answers), but cloudflared has crashed and we can't
  //   restart it remotely (password SSH is disabled; no key deployed here).
  //   The ONLY automated remediation available is a droplet power_cycle,
  //   which bounces the box for ~75s but restores cloudflared via its
  //   systemd unit's Restart= policy. This is default-on because the
  //   alternative — silent multi-hour outage until a human notices — is
  //   strictly worse. See @ciroovblzz 2026-07-01 incident: tunnel died at
  //   22:48 UTC and stayed dead for 3+ hours before manual diagnosis.
  //
  //   Safety net: 3× consecutive health-probe misses (~60s hysteresis) are
  //   required before onDown fires, and this module has a 30-min cooldown
  //   between reboots, so false positives can't cause a reboot loop.
  //
  //   Emergency opt-out: set WHM_DISABLE_AUTO_REBOOT=true in the env to
  //   force manual-only recovery (e.g., during scheduled maintenance).
  const isCfTunnelDown = /^cf_origin_/i.test(String(reason || ''))
  const autoRebootDisabled = String(process.env.WHM_DISABLE_AUTO_REBOOT || '').toLowerCase() === 'true'
  const ssh = await _tcpProbe(WHM_HOST, 22, 5000)
  if (ssh.ok) {
    if (!isCfTunnelDown) {
      // Case A: not a tunnel error, SSH alive → WHM service-level issue.
      // Reboot won't help faster than a human can diagnose.
      log('[AutoRecover] SSH:22 still answers — OS is alive, not rebooting (reason was probably cloudflared/WHM-level)')
      return { attempted: false, recovered: false, reason: 'ssh_alive' }
    }
    // Case B: cf_origin_5xx AND SSH alive → cloudflared is dead.
    if (autoRebootDisabled) {
      const msg =
        `🛠️ <b>cloudflared connector down on WHM origin</b>\n` +
        `Host: <code>${WHM_HOST}</code>  droplet: <code>${DROPLET_ID}</code>\n` +
        `Reason: <code>${reason}</code>  (Cloudflare Tunnel returned ${reason.replace('cf_origin_', '')} to health probe)\n` +
        `SSH:22 <b>is still answering</b> — the OS is alive.\n\n` +
        `⚠️ <b>Auto-reboot is DISABLED</b> (<code>WHM_DISABLE_AUTO_REBOOT=true</code>). Manual fix:\n` +
        `<code>ssh root@${WHM_HOST}\n` +
        `sudo systemctl status cloudflared\n` +
        `sudo journalctl -u cloudflared -n 100 --no-pager\n` +
        `sudo systemctl restart cloudflared</code>`
      log(`[AutoRecover] tunnel-down (${reason}) but WHM_DISABLE_AUTO_REBOOT=true — paging admin with manual fix`)
      if (notify) notify(msg)
      return { attempted: false, recovered: false, reason: 'tunnel_down_reboot_disabled' }
    }
    // Default path: self-heal by power-cycling the droplet.
    log(`[AutoRecover] tunnel-down (${reason}) + SSH alive → SELF-HEAL: power_cycling droplet ${DROPLET_ID} to restart cloudflared`)
    if (notify) notify(
      `🚨 <b>Cloudflare Tunnel connector down — SELF-HEALING</b>\n` +
      `Host: <code>${WHM_HOST}</code>  droplet: <code>${DROPLET_ID}</code>\n` +
      `Reason: <code>${reason}</code>  (Cloudflare edge returned ${reason.replace('cf_origin_', '')} to health probe for ~60s)\n` +
      `SSH:22 is alive but cloudflared can't be remotely restarted from here.\n` +
      `<b>Power-cycling droplet now</b> — expect ~75s downtime, then cloudflared should auto-start via systemd.\n\n` +
      `<i>To opt out of this behavior: set <code>WHM_DISABLE_AUTO_REBOOT=true</code> in Railway env.</i>`
    )
  }

  _inFlight = true
  _lastRebootAt = now
  try {
    const modeTag = ssh.ok ? 'cloudflared-dead-ssh-alive' : 'hard-hung-no-ssh'
    log(`[AutoRecover] WHM ${modeTag} (downReason=${reason}, ssh=${ssh.ok ? 'ALIVE' : 'TIMEOUT'}) — issuing DO power_cycle on droplet ${DROPLET_ID}`)
    if (notify && !ssh.ok) {
      // Fresh alert only for hard-hang. Tunnel-down case already sent its
      // detailed SELF-HEALING alert a few lines above; sending another
      // "issuing power_cycle" here would spam the admin chat.
      notify(`🛠️ <b>auto-recover</b>: WHM origin <code>${WHM_HOST}</code> hard-hung (no SSH). Issuing DO power_cycle…`)
    }

    const { status, body } = await _doApi('POST', `/v2/droplets/${DROPLET_ID}/actions`, { type: 'power_cycle' })
    if (status >= 400 || !body?.action?.id) {
      log(`[AutoRecover] DO API rejected power_cycle: HTTP ${status} ${JSON.stringify(body).slice(0, 200)}`)
      if (notify) notify(`⚠️ <b>auto-recover</b>: DO API rejected power_cycle (HTTP ${status}). Manual reboot required.`)
      return { attempted: true, recovered: false, reason: `do_api_${status}` }
    }
    const actionId = body.action.id
    log(`[AutoRecover] power_cycle action=${actionId} in progress`)
    const ok = await _waitForAction(actionId, 120)
    if (!ok) {
      if (notify) notify(`⚠️ <b>auto-recover</b>: power_cycle action ${actionId} did not complete in 2min.`)
      return { attempted: true, recovered: false, reason: 'action_not_completed' }
    }
    log('[AutoRecover] power_cycle completed — waiting for host to come back')
    const back = await _waitForHostBack({ notify })
    if (back) {
      if (notify) notify(`✅ <b>auto-recover</b>: WHM origin <code>${WHM_HOST}</code> recovered via power_cycle. Tunnel + WHM responding again.`)
      return { attempted: true, recovered: true, reason: 'ok' }
    }
    return { attempted: true, recovered: false, reason: 'host_not_back' }
  } catch (e) {
    log(`[AutoRecover] fatal: ${e.message}`)
    if (notify) notify(`💥 <b>auto-recover</b>: fatal error — ${e.message}`)
    return { attempted: true, recovered: false, reason: e.message }
  } finally {
    _inFlight = false
  }
}

module.exports = {
  attemptRecovery,
  _isConfigured: () => Boolean(DROPLET_ID && DO_TOKEN && WHM_HOST),
  _cooldownMs: () => COOLDOWN_MS,
}
