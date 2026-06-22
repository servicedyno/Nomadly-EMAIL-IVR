require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')
const fs = require('fs')
const TOKEN = process.env.API_KEY_RAILWAY
const headers = { 'Project-Access-Token': TOKEN, 'Content-Type': 'application/json' }
const DEP = '2fa81c2d-3725-450c-adc2-48c8e2cac38d'
async function gql(q, v = {}) {
  const r = await axios.post('https://backboard.railway.com/graphql/v2', { query: q, variables: v }, { headers, timeout: 60000 })
  if (r.data?.errors) throw new Error(JSON.stringify(r.data.errors).substring(0, 800))
  return r.data?.data
}
;(async () => {
  const d = await gql(`query($id:String!,$n:Int!){ deploymentLogs(deploymentId:$id, limit:$n){timestamp message severity} }`, { id: DEP, n: 5000 })
  const logs = d?.deploymentLogs || []
  console.log('TOTAL LOG LINES FETCHED:', logs.length)
  if (logs.length) {
    console.log('TIME RANGE:', logs[0].timestamp, '->', logs[logs.length - 1].timestamp)
  }
  // Save full
  fs.writeFileSync('/tmp/nomadly_logs.txt', logs.map(l => `[${l.timestamp}] [${l.severity}] ${l.message}`).join('\n'))

  const kw = /vps|contabo|\bovh\b|vm-instance|vpsprovider|provision|reinstall|vst|\brdp\b|windows license|hourly plan|datacenter|snapshot|\bsn\b|cancel|order/i
  const errkw = /error|fail|❌|exception|reject|undefined|timeout|insufficient|refund|could not|unable|invalid|denied|5\d\d/i

  const vpsLines = logs.filter(l => kw.test(l.message || ''))
  console.log(`\n===== VPS-related lines: ${vpsLines.length} =====`)
  for (const l of vpsLines) console.log(`[${(l.timestamp||'').substring(0,19)}] ${(l.message||'').substring(0,400)}`)

  console.log(`\n===== VPS lines that ALSO look like errors =====`)
  for (const l of vpsLines.filter(l => errkw.test(l.message || ''))) console.log(`[${(l.timestamp||'').substring(0,19)}] ${(l.message||'').substring(0,500)}`)
})().catch(e => console.error('ERR', e.message))
