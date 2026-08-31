/* READ-ONLY VPS audit. Cross-checks vpsPlansOf (Mongo) vs live DigitalOcean
 * droplets, verifies payment records, and computes profitability.
 * Does NOT create/modify/delete anything. */
require('dotenv').config({ path: '/app/backend/.env' })
const { MongoClient } = require('mongodb')
const axios = require('axios')

const DO_TOKEN = process.env.DIGITALOCEAN_API_TOKEN
const WHM_DROPLET_ID = String(process.env.WHM_DROPLET_ID || '')

// DO list prices (our cost) by size_slug — from digitalocean-service PRODUCT_CATALOG
const DO_COST = {
  's-1vcpu-1gb': 6, 's-1vcpu-2gb': 12, 's-2vcpu-2gb': 18,
  's-2vcpu-4gb': 24, 's-4vcpu-8gb': 48, 's-8vcpu-16gb': 96,
  's-1vcpu-512mb-10gb': 4, 's-2vcpu-4gb-120gb-intel': 28,
}

function fmtDate(d) { try { return new Date(d).toISOString().slice(0, 16).replace('T', ' ') } catch { return String(d) } }

async function listAllDroplets() {
  const out = []
  let url = 'https://api.digitalocean.com/v2/droplets?per_page=200'
  while (url) {
    const res = await axios.get(url, { headers: { Authorization: `Bearer ${DO_TOKEN}` }, timeout: 30000 })
    out.push(...(res.data.droplets || []))
    url = res.data.links?.pages?.next || null
  }
  return out
}

async function getBalanceInfo() {
  try {
    const res = await axios.get('https://api.digitalocean.com/v2/customers/my/balance', {
      headers: { Authorization: `Bearer ${DO_TOKEN}` }, timeout: 20000,
    })
    return res.data
  } catch (e) { return { error: e.response?.status || e.message } }
}

;(async () => {
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db(process.env.DB_NAME || 'test')
  const vpsPlansOf = db.collection('vpsPlansOf')
  const vpsRevoked = db.collection('vpsPlansOf_revoked')
  const vpsTx = db.collection('vpsTransactions')
  const payments = db.collection('payments')

  const all = await vpsPlansOf.find({}).toArray()
  const revoked = await vpsRevoked.find({}).toArray()

  // Provider grouping
  const byProvider = {}
  for (const p of all) {
    const prov = (p.provider || 'unknown').toLowerCase()
    byProvider[prov] = (byProvider[prov] || 0) + 1
  }
  console.log('\n==================== vpsPlansOf OVERVIEW ====================')
  console.log('Total active records:', all.length, '| revoked collection:', revoked.length)
  console.log('By provider:', JSON.stringify(byProvider))
  const byStatus = {}
  for (const p of all) { const s = p.status || '?'; byStatus[s] = (byStatus[s] || 0) + 1 }
  console.log('By status:', JSON.stringify(byStatus))

  // DigitalOcean records
  const doRecs = all.filter(p => (p.provider || '').toLowerCase() === 'digitalocean')
  console.log(`\n==================== DIGITALOCEAN RECORDS (${doRecs.length}) ====================`)
  const now = new Date()
  for (const p of doRecs) {
    const end = p.end_time ? new Date(p.end_time) : null
    const expired = end && end <= now
    const cost = DO_COST[p.productId] ?? null
    const paid = Number(p.planPrice) || 0
    const marginPct = cost ? Math.round(((paid - cost) / paid) * 1000) / 10 : null
    console.log(
      `- vpsId=${p.vpsId || p.contaboInstanceId} chat=${p.chatId} size=${p.productId} region=${p.region} ` +
      `status=${p.status} autoRenew=${p.autoRenewable} paid=$${paid}/mo doCost=$${cost}/mo ` +
      `${marginPct != null ? `margin=${marginPct}%` : ''} ` +
      `start=${fmtDate(p.start_time)} end=${fmtDate(p.end_time)} ${expired ? '‼️EXPIRED' : ''} host=${p.host}`
    )
  }

  // Live DO droplets
  console.log('\n==================== LIVE DIGITALOCEAN DROPLETS ====================')
  let droplets = []
  try { droplets = await listAllDroplets() } catch (e) { console.log('DO API error:', e.response?.status, e.message) }
  console.log('Live droplets on DO account:', droplets.length)
  const trackedIds = new Set(doRecs.map(r => String(r.vpsId || r.contaboInstanceId)))
  const trackedIps = new Set(doRecs.map(r => r.host).filter(Boolean))

  for (const d of droplets) {
    const ip = (d.networks?.v4 || []).find(n => n.type === 'public')?.ip_address || '?'
    const isInfra = String(d.id) === WHM_DROPLET_ID
    const tracked = trackedIds.has(String(d.id)) || trackedIps.has(ip)
    const cost = DO_COST[d.size_slug] ?? d.size?.price_monthly ?? '?'
    let tag = tracked ? 'TRACKED(customer)' : (isInfra ? 'INFRA(WHM)' : '⚠️UNTRACKED')
    console.log(`- id=${d.id} name=${d.name} size=${d.size_slug} ($${cost}/mo) region=${d.region?.slug} status=${d.status} ip=${ip} created=${fmtDate(d.created_at)} → ${tag}`)
  }

  // Leak analysis
  console.log('\n==================== LEAK / DELETION ANALYSIS ====================')
  const liveIds = new Set(droplets.map(d => String(d.id)))
  const liveIps = new Set(droplets.flatMap(d => (d.networks?.v4 || []).filter(n => n.type === 'public').map(n => n.ip_address)))

  const expiredButRunning = doRecs.filter(p => p.end_time && new Date(p.end_time) <= now && ['RUNNING', 'running'].includes(p.status))
  console.log(`Records EXPIRED but still status=RUNNING: ${expiredButRunning.length}`, expiredButRunning.map(p => p.vpsId || p.contaboInstanceId))

  const cancelledStillLive = doRecs.filter(p => ['CANCELLED', 'PENDING_CANCELLATION'].includes(p.status) &&
    (liveIds.has(String(p.vpsId || p.contaboInstanceId)) || liveIps.has(p.host)))
  console.log(`Records CANCELLED/PENDING but droplet STILL LIVE on DO (=leak, we pay): ${cancelledStillLive.length}`,
    cancelledStillLive.map(p => `${p.vpsId}(${p.status})`))

  const untracked = droplets.filter(d => String(d.id) !== WHM_DROPLET_ID &&
    !trackedIds.has(String(d.id)) &&
    !trackedIps.has((d.networks?.v4 || []).find(n => n.type === 'public')?.ip_address))
  console.log(`UNTRACKED live droplets (not any customer, not WHM infra): ${untracked.length}`,
    untracked.map(d => `${d.id}/${d.name}/${d.size_slug}`))

  // Payment verification (sample: DO customers)
  console.log('\n==================== PAYMENT VERIFICATION (DO customers) ====================')
  for (const p of doRecs) {
    const chatId = String(p.chatId)
    const txCount = await vpsTx.countDocuments({ chatId })
    const payMatch = await payments.countDocuments({ _id: { $exists: true }, $or: [{ value: new RegExp(`VPS.*${chatId}`) }] }).catch(() => 0)
    console.log(`- chat=${chatId} vps=${p.vpsId} paid=$${p.planPrice} → vpsTransactions=${txCount} paymentsHits=${payMatch}`)
  }

  // Balance
  console.log('\n==================== DO ACCOUNT BALANCE ====================')
  console.log(JSON.stringify(await getBalanceInfo()))

  await client.close()
  console.log('\n[done]')
})().catch(e => { console.error('FATAL', e); process.exit(1) })
