#!/usr/bin/env node
/**
 * investigate_failed_leadjobs.js
 *
 * Pulls the failed lead jobs for chatId 7080940684 (onlicpe) and analyzes:
 *   - what status values exist in leadJobs collection
 *   - what these failed jobs actually contain (data shape, error reasons)
 *   - why they got marked failed when _index.js never writes 'failed'
 *   - whether wallet was charged for them
 *   - if there's a pattern with carrier (BOA / U.S Bnk) vs the successful ones
 *
 * READ-ONLY.
 */
require('dotenv').config({ path: '/app/.env' })
const { MongoClient } = require('mongodb')
const fs = require('fs')

const MONGO_URL = process.env.MONGO_URL
const DB_NAME = process.env.DB_NAME
const TARGET_CHAT = 7080940684

function fmtDate(d) { try { return d ? new Date(d).toISOString().slice(0, 19).replace('T', ' ') : '-' } catch { return String(d) } }

async function main() {
  console.log('═════════════════════════════════════════════════════════')
  console.log('  Lead Jobs Investigation — chatId 7080940684 (onlicpe)')
  console.log('═════════════════════════════════════════════════════════\n')

  const client = new MongoClient(MONGO_URL)
  await client.connect()
  const db = client.db(DB_NAME)
  const col = db.collection('leadJobs')

  // 1. Status distribution (whole collection)
  console.log('── Status distribution across ALL leadJobs ──')
  const allStatuses = await col.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }, { $sort: { count: -1 } }]).toArray()
  for (const s of allStatuses) console.log(`  ${(s._id || 'null').padEnd(22)}: ${s.count}`)
  console.log()

  // 2. Failed jobs for this chatId
  console.log(`── This user's jobs (chatId ${TARGET_CHAT}) ──`)
  const userJobs = await col.find({ chatId: { $in: [TARGET_CHAT, String(TARGET_CHAT)] } }).sort({ createdAt: 1 }).toArray()
  console.log(`Total: ${userJobs.length}\n`)

  for (const j of userJobs) {
    const keys = Object.keys(j)
    console.log(`  [${fmtDate(j.createdAt)}]  status=${j.status}  target=${j.target}  carrier=${j.carrier}  phonesToGenerate=${j.phonesToGenerate}  results=${(j.results || []).length}  realNameCount=${j.realNameCount || 0}  price=$${j.price}  walletDeducted=${j.walletDeducted}`)
    if (j.failReason) console.log(`     failReason: ${j.failReason}`)
    if (j.error) console.log(`     error: ${String(j.error).slice(0, 200)}`)
    if (j.completedAt) console.log(`     completedAt: ${fmtDate(j.completedAt)}`)
    if (j.interruptedAt) console.log(`     interruptedAt: ${fmtDate(j.interruptedAt)}`)
    if (j.updatedAt) console.log(`     updatedAt: ${fmtDate(j.updatedAt)}`)
    const otherKeys = keys.filter(k => !['_id', 'jobId', 'chatId', 'carrier', 'phonesToGenerate', 'countryCode', 'areaCodes', 'cnam', 'requireRealName', 'target', 'price', 'lang', 'walletDeducted', 'paymentCoin', 'status', 'results', 'realNameCount', 'totalGenerated', 'createdAt', 'updatedAt', 'failReason', 'error', 'completedAt', 'interruptedAt'].includes(k))
    if (otherKeys.length > 0) console.log(`     other keys: ${otherKeys.join(', ')}`)
  }

  // 3. Carrier failure rates
  console.log('\n── Failure rate by carrier (whole collection) ──')
  const byCarrier = await col.aggregate([
    { $group: { _id: { carrier: '$carrier', status: '$status' }, count: { $sum: 1 } } },
    { $group: { _id: '$_id.carrier', total: { $sum: '$count' }, statuses: { $push: { status: '$_id.status', count: '$count' } } } },
    { $sort: { total: -1 } },
  ]).toArray()
  for (const c of byCarrier) {
    const s = c.statuses.reduce((acc, x) => { acc[x.status || 'null'] = x.count; return acc }, {})
    const success = (s.completed || 0)
    const partial = (s.partial_delivered || 0)
    const failed = (s.failed || 0) + (s.resume_error || 0)
    const running = (s.running || 0) + (s.interrupted || 0)
    const completionPct = c.total > 0 ? (((success + partial) / c.total) * 100).toFixed(0) : '?'
    console.log(`  ${String(c._id).padEnd(20)}  total:${String(c.total).padStart(3)}  ✅${success}  ⚠️${partial}  ❌${failed}  🔄${running}  → ${completionPct}% success`)
  }

  // 4. Specifically look at the 3 historical 'failed' jobs - check their raw shape to find the bug source
  console.log('\n── Raw shape of the 3 oldest "failed" jobs (status==="failed") for this user ──')
  const failed = userJobs.filter(j => j.status === 'failed')
  for (const j of failed) {
    console.log(`\n  jobId: ${j.jobId}`)
    const printableKeys = ['carrier', 'phonesToGenerate', 'countryCode', 'areaCodes', 'cnam', 'requireRealName', 'target', 'price', 'walletDeducted', 'totalGenerated', 'realNameCount', 'failReason', 'error', 'createdAt', 'updatedAt', 'completedAt', 'status']
    for (const k of printableKeys) {
      if (j[k] !== undefined) console.log(`    ${k.padEnd(20)}: ${typeof j[k] === 'object' ? JSON.stringify(j[k]) : j[k]}`)
    }
    // All other keys (raw — could reveal where 'failed' status came from)
    const otherKeys = Object.keys(j).filter(k => !printableKeys.includes(k) && k !== '_id' && k !== 'jobId' && k !== 'chatId' && k !== 'results' && k !== 'lang' && k !== 'paymentCoin')
    for (const k of otherKeys) console.log(`    [other] ${k.padEnd(14)}: ${typeof j[k] === 'object' ? JSON.stringify(j[k]).slice(0, 200) : String(j[k]).slice(0, 200)}`)
  }

  fs.writeFileSync('/app/memory/leadjobs_investigation.json', JSON.stringify({
    runAt: new Date().toISOString(),
    chatId: TARGET_CHAT,
    statusDistribution: allStatuses,
    userJobs,
    byCarrier,
  }, null, 2))
  console.log('\n📄 Saved -> /app/memory/leadjobs_investigation.json')

  await client.close()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
