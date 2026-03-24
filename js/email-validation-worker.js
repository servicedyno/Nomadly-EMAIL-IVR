/**
 * Email SMTP Verification Worker v2 — Multi-IP with Auto-Failover
 *
 * Deployed on Contabo VPS for SMTP RCPT TO verification.
 * Features:
 *   - IP pool with health tracking per outbound IP
 *   - Auto-failover: if an IP gets blocked, switch to next healthy IP
 *   - Admin notification via callback when failover occurs
 *   - Management endpoints: GET /ips, POST /ips, DELETE /ips
 *
 * Endpoints:
 *   GET  /health           — Health check + IP pool status
 *   POST /verify-smtp      — Verify a batch of emails via SMTP
 *   GET  /ips              — List IPs with health stats
 *   POST /ips              — Add a new outbound IP
 *   DELETE /ips            — Remove an outbound IP (body: { ip })
 *   POST /ips/reset        — Reset health stats for all or specific IP
 */

const http = require('http')
const https = require('https')
const dns = require('dns').promises
const net = require('net')
const fs = require('fs')

const PORT = parseInt(process.env.WORKER_PORT || '8787', 10)
const SECRET = process.env.WORKER_SECRET || 'ev-worker-secret-2026'
const MAX_BATCH = 200
const SMTP_TIMEOUT = 12000
const DOMAIN_CONCURRENCY = 3
const GLOBAL_CONCURRENCY = 15
const DOMAIN_COOLDOWN_MS = 500

// ── IP Failover Configuration ──
const FAIL_THRESHOLD = 10         // consecutive SMTP failures before marking IP unhealthy
const BLOCK_DETECTION_WINDOW = 60000  // 60s window to count failures
const IP_RECOVERY_INTERVAL = 300000   // 5min — re-check blocked IPs
const NOTIFY_URL = process.env.NOTIFY_URL || ''  // callback URL for failover alerts
const IP_POOL_FILE = '/root/ev-ip-pool.json'     // persist IP pool across restarts

// ── IP Pool ──
const ipPool = []   // [{ ip, healthy, failures, lastFail, lastSuccess, totalSent, totalFail, addedAt }]

function initIpPool() {
  // Try to load saved pool
  try {
    if (fs.existsSync(IP_POOL_FILE)) {
      const saved = JSON.parse(fs.readFileSync(IP_POOL_FILE, 'utf-8'))
      if (Array.isArray(saved) && saved.length > 0) {
        for (const entry of saved) {
          ipPool.push({
            ip: entry.ip,
            healthy: true,       // reset health on restart
            failures: 0,
            lastFail: null,
            lastSuccess: null,
            totalSent: entry.totalSent || 0,
            totalFail: entry.totalFail || 0,
            addedAt: entry.addedAt || new Date().toISOString(),
          })
        }
        console.log(`[IPPool] Loaded ${ipPool.length} IPs from ${IP_POOL_FILE}`)
        return
      }
    }
  } catch (e) {
    console.log(`[IPPool] Could not load ${IP_POOL_FILE}: ${e.message}`)
  }

  // Default: seed from ENV or hardcoded
  const envIps = (process.env.OUTBOUND_IPS || '').split(',').map(s => s.trim()).filter(Boolean)
  const defaultIps = envIps.length > 0 ? envIps : ['5.189.166.127', '109.199.115.95']

  for (const ip of defaultIps) {
    ipPool.push({
      ip,
      healthy: true,
      failures: 0,
      lastFail: null,
      lastSuccess: null,
      totalSent: 0,
      totalFail: 0,
      addedAt: new Date().toISOString(),
    })
  }
  console.log(`[IPPool] Initialized with ${ipPool.length} IPs: ${ipPool.map(p => p.ip).join(', ')}`)
  saveIpPool()
}

function saveIpPool() {
  try {
    fs.writeFileSync(IP_POOL_FILE, JSON.stringify(ipPool.map(p => ({
      ip: p.ip, totalSent: p.totalSent, totalFail: p.totalFail, addedAt: p.addedAt,
    })), null, 2))
  } catch (e) {
    console.log(`[IPPool] Could not save: ${e.message}`)
  }
}

function getHealthyIp() {
  // Return the first healthy IP, preferring the one with fewer recent failures
  const healthy = ipPool.filter(p => p.healthy)
  if (healthy.length === 0) {
    // All IPs blocked — force-use the one with oldest block time
    console.log('[IPPool] WARNING: All IPs unhealthy — forcing least-recently-blocked IP')
    const sorted = [...ipPool].sort((a, b) => (a.lastFail || 0) - (b.lastFail || 0))
    return sorted[0] || null
  }
  // Prefer the one with most success / least failures
  healthy.sort((a, b) => a.failures - b.failures)
  return healthy[0]
}

function recordSuccess(ipEntry) {
  ipEntry.failures = 0
  ipEntry.lastSuccess = Date.now()
  ipEntry.totalSent++
}

function recordFailure(ipEntry, reason) {
  ipEntry.failures++
  ipEntry.totalFail++
  ipEntry.lastFail = Date.now()

  if (ipEntry.failures >= FAIL_THRESHOLD && ipEntry.healthy) {
    ipEntry.healthy = false
    console.log(`[IPPool] ⚠️ IP ${ipEntry.ip} marked UNHEALTHY after ${ipEntry.failures} failures (${reason})`)
    notifyFailover(ipEntry, reason)
    saveIpPool()
  }
}

async function notifyFailover(blockedIp, reason) {
  const healthy = ipPool.filter(p => p.healthy)
  const payload = {
    event: 'ip_failover',
    blockedIp: blockedIp.ip,
    reason,
    failures: blockedIp.failures,
    remainingHealthy: healthy.length,
    healthyIps: healthy.map(p => p.ip),
    allIps: ipPool.map(p => ({ ip: p.ip, healthy: p.healthy, failures: p.failures })),
    timestamp: new Date().toISOString(),
  }

  console.log(`[IPPool] Failover notification:`, JSON.stringify(payload))

  // Notify main server via callback
  const url = NOTIFY_URL
  if (!url) return
  try {
    const urlObj = new URL(url)
    const lib = urlObj.protocol === 'https:' ? https : http
    const data = JSON.stringify(payload)
    const req = lib.request({
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      timeout: 5000,
    })
    req.on('error', () => {})
    req.write(data)
    req.end()
  } catch (e) {
    console.log(`[IPPool] Notify error: ${e.message}`)
  }
}

// ── Periodic IP Recovery Check ──
setInterval(() => {
  for (const entry of ipPool) {
    if (!entry.healthy) {
      // If blocked for longer than recovery interval, try to re-enable
      const elapsed = Date.now() - (entry.lastFail || 0)
      if (elapsed > IP_RECOVERY_INTERVAL) {
        console.log(`[IPPool] 🔄 Re-enabling IP ${entry.ip} for retry (blocked ${Math.round(elapsed / 1000)}s ago)`)
        entry.healthy = true
        entry.failures = 0
        saveIpPool()
      }
    }
  }
}, IP_RECOVERY_INTERVAL)

// ── Rate limiter per MX host ──
const activeMxConnections = new Map()
let globalActive = 0

function canConnect(mxHost) {
  if (globalActive >= GLOBAL_CONCURRENCY) return false
  return (activeMxConnections.get(mxHost) || 0) < DOMAIN_CONCURRENCY
}
function trackConnect(mxHost) {
  activeMxConnections.set(mxHost, (activeMxConnections.get(mxHost) || 0) + 1)
  globalActive++
}
function trackDisconnect(mxHost) {
  const c = activeMxConnections.get(mxHost) || 1
  if (c <= 1) activeMxConnections.delete(mxHost)
  else activeMxConnections.set(mxHost, c - 1)
  globalActive = Math.max(0, globalActive - 1)
}

// ── MX Resolution Cache ──
const mxCache = new Map()
const MX_CACHE_TTL = 5 * 60 * 1000

async function resolveMx(domain) {
  const cached = mxCache.get(domain)
  if (cached && Date.now() - cached.ts < MX_CACHE_TTL) return cached.records
  try {
    const records = await dns.resolveMx(domain)
    if (records && records.length) {
      records.sort((a, b) => a.priority - b.priority)
      mxCache.set(domain, { records, ts: Date.now() })
      return records
    }
  } catch {}
  return null
}

// ── SMTP RCPT TO Verification (with source IP binding) ──
function smtpVerifySingle(email, mxHost, sourceIp, timeout = SMTP_TIMEOUT) {
  return new Promise((resolve) => {
    const connOpts = { port: 25, host: mxHost }
    if (sourceIp) connOpts.localAddress = sourceIp

    const socket = net.createConnection(connOpts)
    let step = 0
    let buf = ''

    const timer = setTimeout(() => {
      socket.destroy()
      resolve({ email, status: 'unknown', reason: 'timeout', code: null })
    }, timeout)

    socket.setEncoding('utf8')

    socket.on('data', (chunk) => {
      buf += chunk
      if (!buf.includes('\r\n') && !buf.includes('\n')) return
      const response = buf.trim()
      buf = ''

      if (step === 0) {
        if (response.match(/^220/)) {
          socket.write('EHLO verify.worker.local\r\n')
          step = 1
        } else {
          clearTimeout(timer); socket.destroy()
          resolve({ email, status: 'unknown', reason: 'bad_greeting', code: response.slice(0, 3) })
        }
      } else if (step === 1) {
        if (response.match(/^250/)) {
          socket.write(`MAIL FROM:<verify@worker.local>\r\n`)
          step = 2
        } else {
          clearTimeout(timer); socket.destroy()
          resolve({ email, status: 'unknown', reason: 'ehlo_rejected', code: response.slice(0, 3) })
        }
      } else if (step === 2) {
        if (response.match(/^250/)) {
          socket.write(`RCPT TO:<${email}>\r\n`)
          step = 3
        } else {
          clearTimeout(timer); socket.destroy()
          resolve({ email, status: 'unknown', reason: 'mail_from_rejected', code: response.slice(0, 3) })
        }
      } else if (step === 3) {
        clearTimeout(timer)
        socket.write('QUIT\r\n')
        socket.end()
        const code = response.slice(0, 3)
        if (code === '250') {
          resolve({ email, status: 'valid', reason: 'accepted', code })
        } else if (['550', '551', '552', '553', '554'].includes(code)) {
          resolve({ email, status: 'invalid', reason: 'rejected', code })
        } else if (code === '450' || code === '451' || code === '452') {
          resolve({ email, status: 'unknown', reason: 'greylisted', code })
        } else {
          resolve({ email, status: 'unknown', reason: 'unexpected_code', code })
        }
      }
    })

    socket.on('error', (err) => {
      clearTimeout(timer)
      const msg = err.message || ''
      // Detect IP-block signatures
      const isBlock = msg.includes('ECONNREFUSED') || msg.includes('EHOSTUNREACH') ||
                      msg.includes('ENETUNREACH') || msg.includes('EADDRNOTAVAIL') ||
                      msg.includes('ECONNRESET') || msg.includes('421') || msg.includes('blocked')
      resolve({ email, status: 'unknown', reason: isBlock ? 'ip_blocked' : 'connection_error', code: null, error: msg, possibleBlock: isBlock })
    })

    socket.on('timeout', () => {
      clearTimeout(timer); socket.destroy()
      resolve({ email, status: 'unknown', reason: 'socket_timeout', code: null })
    })
  })
}

// ── Catch-all Detection ──
async function detectCatchAll(domain, mxHost, sourceIp) {
  const randomLocal = `ev-catchall-test-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const fakeEmail = `${randomLocal}@${domain}`
  const result = await smtpVerifySingle(fakeEmail, mxHost, sourceIp, 10000)
  return result.status === 'valid'
}

// ── Batch Verification with IP Failover ──
async function verifyBatch(emails) {
  const domainGroups = new Map()
  for (const email of emails) {
    const domain = email.split('@')[1]
    if (!domainGroups.has(domain)) domainGroups.set(domain, [])
    domainGroups.get(domain).push(email)
  }

  const results = []
  const catchAllCache = new Map()

  async function processDomain(domain, domainEmails) {
    const mx = await resolveMx(domain)
    if (!mx || !mx.length) {
      for (const e of domainEmails) {
        results.push({ email: e, status: 'invalid', reason: 'no_mx', code: null, catch_all: false })
      }
      return
    }
    const mxHost = mx[0].exchange

    // Get healthy outbound IP
    let ipEntry = getHealthyIp()
    if (!ipEntry) {
      for (const e of domainEmails) {
        results.push({ email: e, status: 'unknown', reason: 'no_healthy_ip', code: null, catch_all: false })
      }
      return
    }
    let sourceIp = ipEntry.ip

    // Check catch-all first
    let isCatchAll = catchAllCache.get(domain)
    if (isCatchAll === undefined) {
      while (!canConnect(mxHost)) await sleep(100)
      trackConnect(mxHost)
      try {
        isCatchAll = await detectCatchAll(domain, mxHost, sourceIp)
        catchAllCache.set(domain, isCatchAll)
        recordSuccess(ipEntry)
      } catch {
        isCatchAll = false
        recordFailure(ipEntry, 'catch_all_probe_error')
      }
      trackDisconnect(mxHost)
      await sleep(DOMAIN_COOLDOWN_MS)
    }

    // Verify each email
    let consecutiveBlockFails = 0
    for (const email of domainEmails) {
      // Re-check IP health (might have switched during batch)
      if (!ipEntry.healthy || consecutiveBlockFails >= 3) {
        const newIp = getHealthyIp()
        if (newIp && newIp.ip !== sourceIp) {
          console.log(`[IPPool] Switching from ${sourceIp} → ${newIp.ip} for ${domain}`)
          ipEntry = newIp
          sourceIp = newIp.ip
          consecutiveBlockFails = 0
        }
      }

      while (!canConnect(mxHost)) await sleep(100)
      trackConnect(mxHost)
      try {
        const r = await smtpVerifySingle(email, mxHost, sourceIp)
        r.catch_all = isCatchAll
        r.sourceIp = sourceIp

        if (isCatchAll && r.status === 'valid') {
          r.status = 'catch_all'
          r.reason = 'catch_all_domain'
        }

        // Track IP health based on result
        if (r.possibleBlock || r.reason === 'ip_blocked') {
          recordFailure(ipEntry, r.reason)
          consecutiveBlockFails++
        } else if (r.status !== 'unknown' || r.reason === 'accepted' || r.reason === 'rejected') {
          recordSuccess(ipEntry)
          consecutiveBlockFails = 0
        }

        results.push(r)
      } catch (e) {
        recordFailure(ipEntry, 'exception')
        results.push({ email, status: 'unknown', reason: 'error', code: null, catch_all: isCatchAll, error: e.message })
      }
      trackDisconnect(mxHost)
      await sleep(DOMAIN_COOLDOWN_MS)
    }
  }

  // Process up to 5 domains concurrently
  const DOMAIN_PARALLEL = 5
  const domainQueue = [...domainGroups.entries()]
  const running = []
  for (const [domain, domainEmails] of domainQueue) {
    const p = processDomain(domain, domainEmails)
    running.push(p)
    if (running.length >= DOMAIN_PARALLEL) {
      await Promise.race(running)
      for (let i = running.length - 1; i >= 0; i--) {
        const settled = await Promise.race([running[i].then(() => true), Promise.resolve(false)])
        if (settled) running.splice(i, 1)
      }
    }
  }
  await Promise.allSettled(running)

  return results
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// ── HTTP Server ──
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Content-Type', 'application/json')

  // Health check (public)
  if (req.method === 'GET' && req.url === '/health') {
    const healthy = ipPool.filter(p => p.healthy)
    return res.end(JSON.stringify({
      status: 'ok',
      active: globalActive,
      cached_mx: mxCache.size,
      ips: { total: ipPool.length, healthy: healthy.length },
      activeIp: getHealthyIp()?.ip || 'none',
    }))
  }

  // Auth check for all other endpoints
  const auth = req.headers.authorization
  if (!auth || auth !== `Bearer ${SECRET}`) {
    res.statusCode = 401
    return res.end(JSON.stringify({ error: 'Unauthorized' }))
  }

  // ── SMTP Verification ──
  if (req.method === 'POST' && req.url === '/verify-smtp') {
    let body = ''
    req.on('data', c => { body += c; if (body.length > 1e6) req.destroy() })
    req.on('end', async () => {
      try {
        const { emails, timeout } = JSON.parse(body)
        if (!Array.isArray(emails) || !emails.length) {
          res.statusCode = 400
          return res.end(JSON.stringify({ error: 'emails array required' }))
        }
        if (emails.length > MAX_BATCH) {
          res.statusCode = 400
          return res.end(JSON.stringify({ error: `Max ${MAX_BATCH} emails per batch` }))
        }
        const results = await verifyBatch(emails)
        res.end(JSON.stringify({ results, count: results.length }))
      } catch (e) {
        res.statusCode = 500
        res.end(JSON.stringify({ error: e.message }))
      }
    })
    return
  }

  // ── IP Pool Management ──
  if (req.method === 'GET' && req.url === '/ips') {
    return res.end(JSON.stringify({
      ips: ipPool.map(p => ({
        ip: p.ip,
        healthy: p.healthy,
        failures: p.failures,
        totalSent: p.totalSent,
        totalFail: p.totalFail,
        lastFail: p.lastFail ? new Date(p.lastFail).toISOString() : null,
        lastSuccess: p.lastSuccess ? new Date(p.lastSuccess).toISOString() : null,
        addedAt: p.addedAt,
      })),
      activeIp: getHealthyIp()?.ip || 'none',
    }))
  }

  if (req.method === 'POST' && req.url === '/ips') {
    let body = ''
    req.on('data', c => body += c)
    req.on('end', () => {
      try {
        const { ip } = JSON.parse(body)
        if (!ip || !/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
          res.statusCode = 400
          return res.end(JSON.stringify({ error: 'Valid IPv4 required' }))
        }
        if (ipPool.some(p => p.ip === ip)) {
          res.statusCode = 409
          return res.end(JSON.stringify({ error: 'IP already in pool' }))
        }
        ipPool.push({
          ip, healthy: true, failures: 0, lastFail: null, lastSuccess: null,
          totalSent: 0, totalFail: 0, addedAt: new Date().toISOString(),
        })
        saveIpPool()
        console.log(`[IPPool] Added IP ${ip}`)
        res.end(JSON.stringify({ ok: true, message: `IP ${ip} added`, total: ipPool.length }))
      } catch (e) {
        res.statusCode = 400
        res.end(JSON.stringify({ error: e.message }))
      }
    })
    return
  }

  if (req.method === 'DELETE' && req.url === '/ips') {
    let body = ''
    req.on('data', c => body += c)
    req.on('end', () => {
      try {
        const { ip } = JSON.parse(body)
        const idx = ipPool.findIndex(p => p.ip === ip)
        if (idx === -1) {
          res.statusCode = 404
          return res.end(JSON.stringify({ error: 'IP not in pool' }))
        }
        if (ipPool.length <= 1) {
          res.statusCode = 400
          return res.end(JSON.stringify({ error: 'Cannot remove last IP' }))
        }
        ipPool.splice(idx, 1)
        saveIpPool()
        console.log(`[IPPool] Removed IP ${ip}`)
        res.end(JSON.stringify({ ok: true, message: `IP ${ip} removed`, total: ipPool.length }))
      } catch (e) {
        res.statusCode = 400
        res.end(JSON.stringify({ error: e.message }))
      }
    })
    return
  }

  if (req.method === 'POST' && req.url === '/ips/reset') {
    let body = ''
    req.on('data', c => body += c)
    req.on('end', () => {
      try {
        const { ip } = JSON.parse(body || '{}')
        const targets = ip ? ipPool.filter(p => p.ip === ip) : ipPool
        for (const p of targets) {
          p.healthy = true
          p.failures = 0
          p.lastFail = null
        }
        saveIpPool()
        res.end(JSON.stringify({ ok: true, message: `Reset ${targets.length} IP(s)` }))
      } catch (e) {
        res.statusCode = 400
        res.end(JSON.stringify({ error: e.message }))
      }
    })
    return
  }

  res.statusCode = 404
  res.end(JSON.stringify({ error: 'Not found' }))
})

// ── Start ──
initIpPool()
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[EmailWorker] SMTP verification worker v2 running on port ${PORT}`)
  console.log(`[EmailWorker] IP Pool: ${ipPool.map(p => `${p.ip} (${p.healthy ? 'healthy' : 'blocked'})`).join(', ')}`)
  console.log(`[EmailWorker] Max batch: ${MAX_BATCH}, Global concurrency: ${GLOBAL_CONCURRENCY}`)
  if (NOTIFY_URL) console.log(`[EmailWorker] Failover notifications → ${NOTIFY_URL}`)
})
