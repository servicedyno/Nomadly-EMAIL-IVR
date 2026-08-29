/**
 * vps-ssh-reachability.js
 * ────────────────────────────────────────────────────────────────────────
 * Lightweight TCP reachability probe used when we CANNOT log in over SSH to a
 * customer's VPS (to set/show a password).
 *
 * WHY THIS EXISTS
 *   DigitalOcean has no API to set/return a root password on a running droplet
 *   (user_data is create-only, rebuild wipes the disk, and `password_reset`
 *   only emails a random value to the ACCOUNT owner — the customer never sees
 *   it). The only way to set a KNOWN password on a live box is over SSH, which
 *   needs port 22 reachable. The single most common failure is the customer
 *   enabling their own guest firewall (ufw) which silently closes port 22.
 *
 *   Before falling back to DO's useless "we emailed it" path, we probe the box:
 *     • 22 open                       → 'ok'          (SSH reachable — creds issue)
 *     • 22 closed but 80/443 open     → 'ssh-blocked' (box is UP, firewall blocks SSH)
 *     • nothing answers               → 'host-down'   (box down / wrong host)
 *
 *   For 'ssh-blocked' we tell the customer EXACTLY how to reopen SSH from their
 *   provider's recovery console (`ufw allow OpenSSH` / `ufw reload`) instead of
 *   emailing a password they will never receive.
 *
 * Pure + side-effect free except the raw TCP connect in `_probePort`. Kept in
 * its own module so the regression test can exercise it against a throwaway
 * localhost listener with zero real DigitalOcean/Telegram traffic.
 */

'use strict'

const net = require('net')

const DEFAULT_TIMEOUT_MS = 4000

/**
 * Attempt a raw TCP connect. Resolves true if the port accepts a connection,
 * false on refusal/timeout/error. Never throws.
 */
function _probePort(host, port, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return new Promise((resolve) => {
    if (!host || !port) return resolve(false)
    const socket = new net.Socket()
    let settled = false
    const done = (open) => {
      if (settled) return
      settled = true
      try { socket.destroy() } catch (_) { /* noop */ }
      resolve(!!open)
    }
    socket.setTimeout(Number(timeoutMs) || DEFAULT_TIMEOUT_MS)
    socket.once('connect', () => done(true))
    socket.once('timeout', () => done(false))
    socket.once('error', () => done(false))
    try {
      socket.connect(Number(port), String(host))
    } catch (_) {
      done(false)
    }
  })
}

/**
 * PURE verdict classifier. Given whether SSH (22) and a web port (80/443) are
 * open, return the reachability verdict.
 *   ssh open              → 'ok'
 *   ssh closed, web open  → 'ssh-blocked'
 *   nothing open          → 'host-down'
 */
function classifyReachability({ sshOpen, webOpen } = {}) {
  if (sshOpen) return 'ok'
  if (webOpen) return 'ssh-blocked'
  return 'host-down'
}

/**
 * Probe a host: check SSH (22) first, then (only if 22 is closed) a web port to
 * distinguish "firewall blocking SSH" from "host down".
 *
 * @returns {Promise<{verdict:string, host:string|null, sshOpen:boolean, webOpen:boolean, sshPort:number, webPortsChecked:number[], openWebPort:number|null}>}
 */
async function probeReachability(opts = {}) {
  const {
    host,
    sshPort = 22,
    webPorts = [80, 443],
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = opts

  if (!host) {
    return {
      verdict: 'host-down',
      host: null,
      sshOpen: false,
      webOpen: false,
      sshPort,
      webPortsChecked: webPorts,
      openWebPort: null,
    }
  }

  const sshOpen = await _probePort(host, sshPort, timeoutMs)
  let webOpen = false
  let openWebPort = null
  if (!sshOpen) {
    for (const p of webPorts) {
      const open = await _probePort(host, p, timeoutMs)
      if (open) { webOpen = true; openWebPort = p; break }
    }
  }

  return {
    verdict: classifyReachability({ sshOpen, webOpen }),
    host,
    sshOpen,
    webOpen,
    sshPort,
    webPortsChecked: webPorts,
    openWebPort,
  }
}

/**
 * PURE, self-contained actionable message shown to the customer when their VPS
 * is online but SSH port 22 is firewalled. MUST contain the literal
 * `ufw allow OpenSSH` guidance (the exact fix for the root cause).
 */
function sshBlockedGuidance({ name, host, username = 'root' } = {}) {
  const label = name ? `"${name}" ` : ''
  const target = host || 'your server'
  const user = username || 'root'
  return [
    `🔒 <b>SSH is blocked on your VPS</b>`,
    ``,
    `Your VPS ${label}(<code>${target}</code>) is <b>online</b>, but SSH <b>port 22 is blocked</b> — almost always by the server's own firewall (ufw).`,
    ``,
    `Because we can't log in over SSH, we could not set or show a password. <b>Nothing was emailed.</b>`,
    ``,
    `<b>Fix it yourself in ~1 minute:</b>`,
    `1. Open your provider's <b>Recovery / Web Console</b> (this works even when SSH is blocked).`,
    `2. Log in as <code>${user}</code>.`,
    `3. Run these two commands:`,
    `   <code>ufw allow OpenSSH</code>`,
    `   <code>ufw reload</code>`,
    ``,
    `Then come back here and tap 🔑 <b>Reset Password</b> again — it will work instantly.`,
  ].join('\n')
}

module.exports = {
  probeReachability,
  classifyReachability,
  sshBlockedGuidance,
  _probePort,
  DEFAULT_TIMEOUT_MS,
}
