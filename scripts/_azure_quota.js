// Check Azure compute quota/usage across regions for the families we use.
require('dotenv').config({ path: '/app/backend/.env' })
const SUB = process.env.AZURE_SUBSCRIPTION_ID
const TENANT_ID = process.env.AZURE_TENANT_ID
const CLIENT_ID = process.env.AZURE_CLIENT_ID
const CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET

async function getToken() {
  const body = new URLSearchParams({
    client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
    grant_type: 'client_credentials', scope: 'https://management.azure.com/.default',
  })
  const r = await fetch(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
  })
  const j = await r.json()
  if (!j.access_token) throw new Error('token fail: ' + JSON.stringify(j))
  return j.access_token
}

const FAMILIES = ['standardBASv2Family', 'standardBsv2Family', 'standardBSFamily', 'standardDSv5Family', 'standardDSv6Family']
const LOCATIONS = ['westeurope', 'eastus', 'eastus2', 'westus3', 'uksouth', 'southeastasia', 'centralindia', 'australiaeast', 'japaneast', 'northeurope']

;(async () => {
  const tok = await getToken()
  for (const loc of LOCATIONS) {
    const url = `https://management.azure.com/subscriptions/${SUB}/providers/Microsoft.Compute/locations/${loc}/usages?api-version=2023-07-01`
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + tok } })
    if (!r.ok) { console.log(loc, 'HTTP', r.status, (await r.text()).slice(0,120)); continue }
    const j = await r.json()
    const rows = (j.value || []).filter(v => {
      const n = (v.name?.value || '').toLowerCase()
      return n.includes('bsv2') || n.includes('basv2') || n.includes('bfamily') || n.includes('dsv5') || n.includes('dsv6') || n === 'cores'
    })
    const out = rows.map(v => `${v.name.value}=${v.currentValue}/${v.limit}`).join('  ')
    console.log(`\n[${loc}] ${out}`)
  }
})().catch(e => console.error('ERR', e.message))
