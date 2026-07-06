/**
 * Deep investigate the $60-vs-$30 complaint from chatId 7191777173:
 *   1. Pull every Railway log line mentioning this chatId in the last 7 days
 *      (to find the txn hash they shared + any deposit-flow events)
 *   2. Pull Mongo wallet/transaction history for this chatId
 *   3. Try to identify the on-chain txn hash they sent so we can compare
 *      claim ($60) against actual blockchain receipt amount
 */
require('dotenv').config({ path: '/app/.env' })
const https = require('https')
const fs = require('fs')
const { MongoClient } = require('mongodb')

const TOKEN = process.env.RAILWAY_PROJECT_TOKEN || process.env.API_KEY_RAILWAY
const EID = process.env.RAILWAY_ENVIRONMENT_ID
const SID = process.env.RAILWAY_SERVICE_ID
const CHAT = '7191777173'

function gql(q, v) {
  return new Promise((res, rej) => {
    const r = https.request({ hostname: 'backboard.railway.app', path: '/graphql/v2', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Project-Access-Token': TOKEN } },
      (rr) => { let b = ''; rr.on('data', c => b += c); rr.on('end', () => { try { res(JSON.parse(b)) } catch { res({ raw: b }) } }) })
    r.on('error', rej); r.write(JSON.stringify({ query: q, variables: v })); r.end()
  })
}

;(async () => {
  // 1. all log lines for the chatId across all deployments
  const dr = await gql(`query D($e: String!, $s: String!) {
    deployments(input: { environmentId: $e, serviceId: $s, status: { in: [SUCCESS, REMOVED] } }, first: 25) {
      edges { node { id status createdAt } }
    }
  }`, { e: EID, s: SID })
  const deps = (dr?.data?.deployments?.edges || []).map(e => e.node)

  const seen = new Set()
  const all = []
  for (const dep of deps) {
    const r = await gql(
      `query L($d: String!, $f: String, $l: Int) { deploymentLogs(deploymentId: $d, filter: $f, limit: $l) { timestamp message severity } }`,
      { d: dep.id, f: CHAT, l: 500 }
    )
    for (const l of (r?.data?.deploymentLogs || [])) {
      const k = `${l.timestamp}|${l.message}`
      if (!seen.has(k)) { seen.add(k); all.push(l) }
    }
  }
  all.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  console.log(`=== ${all.length} log lines for chatId ${CHAT} ===\n`)
  for (const l of all) {
    console.log(`[${l.timestamp.slice(0,19)}] ${l.message.slice(0, 380)}`)
  }
  fs.writeFileSync(`/app/memory/chat_${CHAT}_logs.json`, JSON.stringify(all, null, 2))

  // 2. Mongo: user identity + wallet history
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`Mongo records for chatId ${CHAT}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  const c = new MongoClient(process.env.MONGO_URL); await c.connect()
  const db = c.db(process.env.DB_NAME || 'test')

  for (const coll of ['nameOf', 'usernameOf', 'walletOf', 'langOf']) {
    if ((await db.listCollections({ name: coll }).toArray()).length === 0) continue
    for (const k of [CHAT, Number(CHAT)]) {
      const doc = await db.collection(coll).findOne({ _id: k })
      if (doc) console.log(`  ${coll}: ${JSON.stringify(doc)}`)
    }
  }

  // wallet/deposit collections
  for (const coll of ['walletHistoryOf', 'depositOf', 'depositsOf', 'transactions', 'walletTransactions', 'paymentsOf', 'transactionHistoryOf']) {
    if ((await db.listCollections({ name: coll }).toArray()).length === 0) continue
    for (const k of [CHAT, Number(CHAT)]) {
      let docs = []
      // try _id key first
      const d1 = await db.collection(coll).findOne({ _id: k })
      if (d1) docs.push(d1)
      // try chatId field
      docs.push(...await db.collection(coll).find({ chatId: k }).limit(20).sort([['ts', -1], ['createdAt', -1]]).toArray())
      if (docs.length) {
        console.log(`\n  --- ${coll} ---`)
        for (const d of docs) {
          console.log('  ' + JSON.stringify(d).slice(0, 700))
        }
      }
    }
  }

  await c.close()
})().catch(e => { console.error('FATAL', e); process.exit(1) })
