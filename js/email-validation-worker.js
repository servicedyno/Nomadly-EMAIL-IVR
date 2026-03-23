/**
 * Email SMTP Verification Worker — Runs on VPS with open port 25
 *
 * Deployed on Contabo VPS (5.189.166.127) for SMTP RCPT TO verification.
 * Receives batches of emails via HTTP, performs SMTP verification, returns results.
 *
 * Endpoints:
 *   GET  /health           — Health check
 *   POST /verify-smtp      — Verify a batch of emails via SMTP
 *
 * Auth: Bearer token via WORKER_SECRET env var
 */

const http = require('http')
const dns = require('dns').promises
const net = require('net')

const PORT = parseInt(process.env.WORKER_PORT || '8787', 10)
const SECRET = process.env.WORKER_SECRET || 'ev-worker-secret-2026'
const MAX_BATCH = 200
const SMTP_TIMEOUT = 12000       // 12s per SMTP probe
const DOMAIN_CONCURRENCY = 3     // max simultaneous SMTP connections per MX host
const GLOBAL_CONCURRENCY = 15    // max simultaneous SMTP connections total
const DOMAIN_COOLDOWN_MS = 500   // pause between connections to same MX

// ── Rate limiter per MX host ──
const activeMxConnections = new Map() // mxHost → count
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

// ── MX Resolution Cache (5 min TTL) ──
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

// ── SMTP RCPT TO Verification ──
function smtpVerifySingle(email, mxHost, timeout = SMTP_TIMEOUT) {
  return new Promise((resolve) => {
    const socket = net.createConnection(25, mxHost)
    let step = 0
    let buf = ''

    const timer = setTimeout(() => {
      socket.destroy()
      resolve({ email, status: 'unknown', reason: 'timeout', code: null })
    }, timeout)

    socket.setEncoding('utf8')

    socket.on('data', (chunk) => {
      buf += chunk
      // Wait for complete response line(s) ending with \r\n
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
      resolve({ email, status: 'unknown', reason: 'connection_error', code: null, error: err.message })
    })

    socket.on('timeout', () => {
      clearTimeout(timer); socket.destroy()
      resolve({ email, status: 'unknown', reason: 'socket_timeout', code: null })
    })
  })
}

// ── Catch-all Detection ──
// Send RCPT TO for a random non-existent address; if accepted → domain is catch-all
async function detectCatchAll(domain, mxHost) {
  const randomLocal = `ev-catchall-test-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const fakeEmail = `${randomLocal}@${domain}`
  const result = await smtpVerifySingle(fakeEmail, mxHost, 10000)
  return result.status === 'valid' // If a random address is "accepted", it's catch-all
}

// ── Batch Verification ──
async function verifyBatch(emails) {
  // Group by domain
  const domainGroups = new Map()
  for (const email of emails) {
    const domain = email.split('@')[1]
    if (!domainGroups.has(domain)) domainGroups.set(domain, [])
    domainGroups.get(domain).push(email)
  }

  const results = []
  const catchAllCache = new Map()

  // Process domains with controlled concurrency
  const domainEntries = [...domainGroups.entries()]
  const domainQueue = [...domainEntries]

  async function processDomain(domain, domainEmails) {
    const mx = await resolveMx(domain)
    if (!mx || !mx.length) {
      for (const e of domainEmails) {
        results.push({ email: e, status: 'invalid', reason: 'no_mx', code: null, catch_all: false })
      }
      return
    }
    const mxHost = mx[0].exchange

    // Check catch-all first (one probe per domain)
    let isCatchAll = catchAllCache.get(domain)
    if (isCatchAll === undefined) {
      // Wait for slot
      while (!canConnect(mxHost)) await sleep(100)
      trackConnect(mxHost)
      try {
        isCatchAll = await detectCatchAll(domain, mxHost)
        catchAllCache.set(domain, isCatchAll)
      } catch { isCatchAll = false }
      trackDisconnect(mxHost)
      await sleep(DOMAIN_COOLDOWN_MS)
    }

    // Verify each email in the domain
    for (const email of domainEmails) {
      while (!canConnect(mxHost)) await sleep(100)
      trackConnect(mxHost)
      try {
        const r = await smtpVerifySingle(email, mxHost)
        r.catch_all = isCatchAll
        // If domain is catch-all and email was "accepted", mark as risky not valid
        if (isCatchAll && r.status === 'valid') {
          r.status = 'catch_all'
          r.reason = 'catch_all_domain'
        }
        results.push(r)
      } catch (e) {
        results.push({ email, status: 'unknown', reason: 'error', code: null, catch_all: isCatchAll, error: e.message })
      }
      trackDisconnect(mxHost)
      await sleep(DOMAIN_COOLDOWN_MS)
    }
  }

  // Process up to 5 domains concurrently
  const DOMAIN_PARALLEL = 5
  const running = []
  for (const [domain, domainEmails] of domainQueue) {
    const p = processDomain(domain, domainEmails)
    running.push(p)
    if (running.length >= DOMAIN_PARALLEL) {
      await Promise.race(running)
      // Clean up finished
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
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Content-Type', 'application/json')

  if (req.method === 'GET' && req.url === '/health') {
    return res.end(JSON.stringify({ status: 'ok', active: globalActive, cached_mx: mxCache.size }))
  }

  // Auth check
  const auth = req.headers.authorization
  if (!auth || auth !== `Bearer ${SECRET}`) {
    res.statusCode = 401
    return res.end(JSON.stringify({ error: 'Unauthorized' }))
  }

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

  res.statusCode = 404
  res.end(JSON.stringify({ error: 'Not found' }))
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[EmailWorker] SMTP verification worker running on port ${PORT}`)
  console.log(`[EmailWorker] Max batch: ${MAX_BATCH}, Global concurrency: ${GLOBAL_CONCURRENCY}`)
})
