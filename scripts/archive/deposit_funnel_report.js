// Deposit funnel report — measures crypto top-up "address generated → completed"
// conversion over time, from the depositFunnel collection (see js/deposit-funnel.js).
// Usage: node scripts/deposit_funnel_report.js [days]   (default 21)
'use strict'
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') })
const { MongoClient } = require('mongodb')

const DAYS = Number(process.argv[2]) || 21
const DAY = 86400000, now = Date.now()
const isoDay = d => new Date(d).toISOString().slice(0, 10)

async function main() {
  const client = new MongoClient(process.env.MONGO_URL); await client.connect()
  const db = client.db(process.env.DB_NAME)
  const col = db.collection('depositFunnel')

  const total = await col.estimatedDocumentCount()
  console.log(`depositFunnel total docs: ${total}`)
  if (total === 0) {
    console.log('\n(No data yet — instrumentation starts recording from the next deposit attempt.)')
    await client.close(); return
  }

  const since = new Date(now - DAYS * DAY)
  const rows = await col.find({ generatedAt: { $gte: since } }).toArray()
  console.log(`\n===== Daily deposit funnel (last ${DAYS} days) =====`)
  console.log('  date         attempts  completed  conv%   $completed')
  const byDay = {}
  for (const r of rows) {
    if (!r.generatedAt) continue
    const d = isoDay(r.generatedAt)
    byDay[d] = byDay[d] || { att: 0, done: 0, usd: 0 }
    byDay[d].att++
    if (r.status === 'completed') { byDay[d].done++; byDay[d].usd += Number(r.creditedUsd || r.amountUsd || 0) }
  }
  let tA = 0, tD = 0, tU = 0
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = isoDay(now - i * DAY); const r = byDay[d] || { att: 0, done: 0, usd: 0 }
    const conv = r.att ? Math.round(r.done / r.att * 100) : 0
    tA += r.att; tD += r.done; tU += r.usd
    console.log(`  ${d}   ${String(r.att).padStart(6)}   ${String(r.done).padStart(7)}   ${String(conv).padStart(3)}%   $${r.usd.toFixed(0)}`)
  }
  console.log(`  ${'-'.repeat(52)}`)
  console.log(`  TOTAL        ${String(tA).padStart(6)}   ${String(tD).padStart(7)}   ${tA ? Math.round(tD/tA*100) : 0}%   $${tU.toFixed(0)}`)

  // Abandonment breakdown by coin (attempts that never completed)
  console.log('\n===== Attempts vs completions by coin (last ' + DAYS + 'd) =====')
  const byCoin = {}
  for (const r of rows) { const c = r.coin || '(unknown)'; byCoin[c] = byCoin[c] || { att: 0, done: 0 }; byCoin[c].att++; if (r.status === 'completed') byCoin[c].done++ }
  Object.entries(byCoin).sort((a, b) => b[1].att - a[1].att).forEach(([c, v]) => {
    console.log(`  ${c.padEnd(22)} attempts=${String(v.att).padStart(4)}  completed=${String(v.done).padStart(4)}  conv=${v.att ? Math.round(v.done/v.att*100) : 0}%`)
  })

  await client.close()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
