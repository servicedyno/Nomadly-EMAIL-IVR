require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')
const headers = { 'Project-Access-Token': process.env.API_KEY_RAILWAY, 'Content-Type': 'application/json' }
async function gql(q, v = {}) {
  const r = await axios.post('https://backboard.railway.com/graphql/v2', { query: q, variables: v }, { headers, timeout: 40000 })
  if (r.data?.errors) throw new Error(JSON.stringify(r.data.errors).slice(0, 500))
  return r.data?.data
}

// live deployments
const DEPLOYMENTS = {
  'Nomadly-EMAIL-IVR (node bot)': 'd25621b5-f793-4294-a117-8ccec47d5b0d',
  'HostingBotNew (python front)': '8eda72b0-c127-479a-8eb1-a904b65b8f1f',
  'LockbayNewFIX (payments)': 'aee35bc1-c7e6-4978-90b5-96801c9b73ef',
}
const FILTERS = ['error', 'fail', 'exception', 'traceback', 'unhandled', 'timeout', 'reject', 'critical', 'ECONN', '❌', 'not whitelisted', 'refused', 'undefined is not', 'cannot read']

const HOURS = Number(process.argv[2] || 72)
const startDate = new Date(Date.now() - HOURS * 3600000).toISOString()
const endDate = new Date().toISOString()

// normalize a message into a signature (strip volatile ids/numbers/timestamps)
function signature(msg) {
  return (msg || '')
    .replace(/\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}[.,]?\d*/g, '<ts>')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<uuid>')
    .replace(/\b\d{6,}\b/g, '<id>')
    .replace(/\b\d+\b/g, '<n>')
    .replace(/[a-z0-9._-]+@[a-z0-9.-]+/gi, '<email>')
    .replace(/https?:\/\/\S+/g, '<url>')
    .replace(/\/[\w./-]+/g, '<path>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160)
}

async function fetchDep(depId) {
  const seen = new Map() // ts+msg -> {timestamp,severity,message}
  for (const f of FILTERS) {
    try {
      const d = await gql(
        `query($id:String!,$s:DateTime,$e:DateTime,$f:String,$n:Int!){ deploymentLogs(deploymentId:$id,startDate:$s,endDate:$e,filter:$f,limit:$n){timestamp message severity} }`,
        { id: depId, s: startDate, e: endDate, f, n: 800 },
      )
      for (const l of (d.deploymentLogs || [])) {
        const key = (l.timestamp || '') + '|' + (l.message || '').slice(0, 80)
        if (!seen.has(key)) seen.set(key, l)
      }
    } catch (e) { /* filter may not match, ignore */ }
  }
  return [...seen.values()]
}

;(async () => {
  console.log(`\n==================== ANOMALY SCAN — last ${HOURS}h (since ${startDate}) ====================`)
  for (const [name, depId] of Object.entries(DEPLOYMENTS)) {
    const logs = await fetchDep(depId)
    logs.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''))
    const oldest = logs[0]?.timestamp?.slice(0, 19) || 'n/a'
    const newest = logs[logs.length - 1]?.timestamp?.slice(0, 19) || 'n/a'
    // group by signature
    const groups = new Map()
    for (const l of logs) {
      const sig = signature(l.message)
      if (!sig) continue
      if (!groups.has(sig)) groups.set(sig, { count: 0, first: l.timestamp, last: l.timestamp, sample: l.message })
      const g = groups.get(sig)
      g.count++
      if ((l.timestamp || '') < g.first) g.first = l.timestamp
      if ((l.timestamp || '') > g.last) g.last = l.timestamp
    }
    const sorted = [...groups.entries()].sort((a, b) => b[1].count - a[1].count)
    console.log(`\n\n########## ${name} ##########`)
    console.log(`matched anomaly lines: ${logs.length} | window covered: ${oldest} → ${newest} | distinct signatures: ${groups.size}`)
    console.log(`---- distinct anomaly patterns (by frequency) ----`)
    for (const [sig, g] of sorted) {
      console.log(`\n[${g.count}x]  ${g.first?.slice(5, 19)} → ${g.last?.slice(5, 19)}`)
      console.log(`   ${(g.sample || '').replace(/\n/g, ' ').slice(0, 300)}`)
    }
  }
  console.log('\n==================== END ====================')
})().catch(e => console.error('FATAL', e.message))
