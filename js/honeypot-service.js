/**
 * Honeypot Service
 * 
 * Manages honeypot traps for anti-red protection:
 * 1. Cloudflare KV namespace for banned IPs (edge-level banning)
 * 2. MongoDB logging for honeypot trigger analytics
 * 3. Express routes for receiving reports from CF Workers
 * 
 * 6 honeypot types:
 *   - Link: Hidden links bots click
 *   - Form: Invisible form fields bots fill
 *   - Mouse: No mouse movement detection
 *   - Cookie: Cookie tampering detection
 *   - JS: Fake APIs bots probe
 *   - robots.txt: Disallowed paths bots access
 */

require('dotenv').config()
const axios = require('axios')
const { log } = require('console')

const CF_API_KEY = process.env.CLOUDFLARE_API_KEY
const CF_EMAIL = process.env.CLOUDFLARE_EMAIL
const ACCOUNT_ID = 'ed6035ebf6bd3d85f5b26c60189a21e2'

const KV_NAMESPACE_TITLE = 'antired-honeypot-bans'

let honeypotTriggersCol = null
let kvNamespaceId = null

// ─── MongoDB Initialization ─────────────────────────────

function initHoneypot(db) {
  if (!db) {
    log('[Honeypot] No database provided, skipping init')
    return
  }

  honeypotTriggersCol = db.collection('honeypotTriggers')

  // Create indexes
  honeypotTriggersCol.createIndex({ triggeredAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 }) // 30 day TTL
  honeypotTriggersCol.createIndex({ ip: 1 })
  honeypotTriggersCol.createIndex({ domain: 1 })
  honeypotTriggersCol.createIndex({ type: 1 })

  log('[Honeypot] MongoDB collection initialized with indexes')
}

// ─── MongoDB Logging ────────────────────────────────────

async function logHoneypotTrigger({ ip, type, path, domain, ua, details }) {
  if (!honeypotTriggersCol) return

  try {
    await honeypotTriggersCol.insertOne({
      ip,
      type,        // 'link' | 'form' | 'mouse' | 'cookie' | 'js' | 'robots'
      path,
      domain,
      ua,
      details,
      triggeredAt: new Date(),
    })
    log(`[Honeypot] 🍯 Logged trigger: type=${type} ip=${ip} domain=${domain} path=${path}`)
  } catch (err) {
    log(`[Honeypot] Log error: ${err.message}`)
  }
}

// ─── MongoDB Analytics ──────────────────────────────────

async function getHoneypotStats(domain) {
  if (!honeypotTriggersCol) return { total: 0, byType: {}, recentIPs: [] }

  try {
    const filter = domain ? { domain } : {}

    const [total, byType, recentIPs, last24h] = await Promise.all([
      honeypotTriggersCol.countDocuments(filter),
      honeypotTriggersCol.aggregate([
        { $match: filter },
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]).toArray(),
      honeypotTriggersCol.find(filter)
        .sort({ triggeredAt: -1 })
        .limit(20)
        .project({ ip: 1, type: 1, domain: 1, path: 1, triggeredAt: 1 })
        .toArray(),
      honeypotTriggersCol.countDocuments({
        ...filter,
        triggeredAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      }),
    ])

    const typeMap = {}
    byType.forEach(t => { typeMap[t._id] = t.count })

    return { total, last24h, byType: typeMap, recentIPs }
  } catch (err) {
    log(`[Honeypot] Stats error: ${err.message}`)
    return { total: 0, byType: {}, recentIPs: [], error: err.message }
  }
}

// ─── Cloudflare KV Namespace Management ─────────────────

async function getOrCreateKVNamespace() {
  if (kvNamespaceId) return kvNamespaceId
  if (!CF_API_KEY || !CF_EMAIL) {
    log('[Honeypot] Missing Cloudflare credentials, KV not available')
    return null
  }

  const cfHeaders = {
    'X-Auth-Email': CF_EMAIL,
    'X-Auth-Key': CF_API_KEY,
    'Content-Type': 'application/json',
  }

  try {
    // List existing namespaces to find ours
    const listRes = await axios.get(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces?per_page=100`,
      { headers: cfHeaders, timeout: 15000 }
    )

    const existing = (listRes.data?.result || []).find(ns => ns.title === KV_NAMESPACE_TITLE)
    if (existing) {
      kvNamespaceId = existing.id
      log(`[Honeypot] Found existing KV namespace: ${kvNamespaceId}`)
      return kvNamespaceId
    }

    // Create new namespace
    const createRes = await axios.post(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces`,
      { title: KV_NAMESPACE_TITLE },
      { headers: cfHeaders, timeout: 15000 }
    )

    if (createRes.data?.success && createRes.data?.result?.id) {
      kvNamespaceId = createRes.data.result.id
      log(`[Honeypot] Created KV namespace: ${kvNamespaceId}`)
      return kvNamespaceId
    }

    log(`[Honeypot] KV namespace creation failed: ${JSON.stringify(createRes.data?.errors)}`)
    return null
  } catch (err) {
    log(`[Honeypot] KV namespace error: ${err.message}`)
    return null
  }
}

function getKVNamespaceId() {
  return kvNamespaceId
}

// ─── Ban IP via Cloudflare KV (from backend for manual bans) ──

async function banIPViaKV(ip, reason, details, ttlSeconds = 86400) {
  const nsId = await getOrCreateKVNamespace()
  if (!nsId) return false

  const cfHeaders = {
    'X-Auth-Email': CF_EMAIL,
    'X-Auth-Key': CF_API_KEY,
    'Content-Type': 'application/json',
  }

  try {
    // URL-encode the IP for the key (dots are fine, but be safe)
    await axios.put(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${nsId}/values/${encodeURIComponent(ip)}`,
      JSON.stringify({ reason, details, bannedAt: Date.now() }),
      {
        headers: {
          ...cfHeaders,
          'Content-Type': 'application/octet-stream',
        },
        params: { expiration_ttl: ttlSeconds },
        timeout: 10000,
      }
    )
    log(`[Honeypot] Banned IP via KV: ${ip} (${reason})`)
    return true
  } catch (err) {
    log(`[Honeypot] KV ban error: ${err.message}`)
    return false
  }
}

// ─── Express Route Handlers ─────────────────────────────

function createHoneypotRoutes(app) {
  // Receive honeypot trigger reports from Cloudflare Workers
  app.post('/honeypot/report', async (req, res) => {
    try {
      const { ip, type, path, domain, ua, details } = req.body || {}

      if (!ip || !type) {
        return res.status(400).json({ error: 'Missing ip or type' })
      }

      // Log to MongoDB
      await logHoneypotTrigger({ ip, type, path, domain, ua, details })

      // Also ban via KV (backup — worker already bans on trigger, this is for persistence)
      await banIPViaKV(ip, `honeypot_${type}`, `${path || ''} on ${domain || 'unknown'}`)

      res.json({ success: true, message: `Honeypot trigger logged: ${type} from ${ip}` })
    } catch (err) {
      log(`[Honeypot] Report endpoint error: ${err.message}`)
      res.status(500).json({ error: err.message })
    }
  })

  // Get honeypot analytics (admin)
  app.get('/honeypot/stats', async (req, res) => {
    try {
      const { domain } = req.query
      const stats = await getHoneypotStats(domain || null)
      res.json({ success: true, ...stats })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // Get ban status for an IP
  app.get('/honeypot/check/:ip', async (req, res) => {
    try {
      const { ip } = req.params
      if (!honeypotTriggersCol) return res.json({ banned: false })

      const trigger = await honeypotTriggersCol.findOne({ ip }, { sort: { triggeredAt: -1 } })
      res.json({
        banned: !!trigger,
        trigger: trigger ? { type: trigger.type, domain: trigger.domain, at: trigger.triggeredAt } : null,
      })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  log('[Honeypot] Express routes mounted: POST /honeypot/report, GET /honeypot/stats, GET /honeypot/check/:ip')
}

module.exports = {
  initHoneypot,
  logHoneypotTrigger,
  getHoneypotStats,
  getOrCreateKVNamespace,
  getKVNamespaceId,
  banIPViaKV,
  createHoneypotRoutes,
  KV_NAMESPACE_TITLE,
  ACCOUNT_ID,
}
