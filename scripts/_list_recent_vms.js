// READ-ONLY: list DO droplets + Azure VMs created within the last N hours.
require('dotenv').config({ path: '/app/backend/.env' })
const HOURS = Number(process.argv[2] || 36)
const cutoff = Date.now() - HOURS * 3600 * 1000

const DO_TOKEN = process.env.DIGITALOCEAN_API_TOKEN
const SUB = process.env.AZURE_SUBSCRIPTION_ID
const RG = process.env.AZURE_RESOURCE_GROUP
const TENANT_ID = process.env.AZURE_TENANT_ID
const CLIENT_ID = process.env.AZURE_CLIENT_ID
const CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET

const ownerFromName = (n) => {
  const m = String(n || '').match(/nomadly-(\d+)-/)
  return m ? m[1] : '(unknown)'
}

async function listDO() {
  const out = []
  let url = 'https://api.digitalocean.com/v2/droplets?per_page=200'
  while (url) {
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + DO_TOKEN } })
    if (!r.ok) { console.log('DO list HTTP', r.status, (await r.text()).slice(0, 200)); break }
    const j = await r.json()
    for (const d of (j.droplets || [])) {
      const created = new Date(d.created_at).getTime()
      if (created >= cutoff) {
        const ip = (d.networks?.v4 || []).find(n => n.type === 'public')?.ip_address || '—'
        out.push({ id: d.id, name: d.name, owner: ownerFromName(d.name), ip, created_at: d.created_at, region: d.region?.slug, size: d.size_slug })
      }
    }
    url = j.links?.pages?.next || null
  }
  return out
}

async function azToken() {
  const body = new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: 'client_credentials', scope: 'https://management.azure.com/.default' })
  const r = await fetch(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })
  return (await r.json()).access_token
}

async function listAzure() {
  const tok = await azToken()
  const out = []
  // List VMs in subscription (instanceView gives timeCreated via 2023-07-01)
  const url = `https://management.azure.com/subscriptions/${SUB}/providers/Microsoft.Compute/virtualMachines?api-version=2023-07-01`
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + tok } })
  if (!r.ok) { console.log('Azure list HTTP', r.status, (await r.text()).slice(0, 200)); return out }
  const j = await r.json()
  for (const vm of (j.value || [])) {
    const tc = vm.properties?.timeCreated ? new Date(vm.properties.timeCreated).getTime() : null
    if (tc == null || tc >= cutoff) {
      out.push({
        name: vm.name, owner: ownerFromName(vm.name), id: vm.id,
        rg: vm.id.split('/resourceGroups/')[1]?.split('/')[0],
        location: vm.location, size: vm.properties?.hardwareProfile?.vmSize,
        timeCreated: vm.properties?.timeCreated || '(unknown)',
      })
    }
  }
  return out
}

;(async () => {
  console.log(`\n=== Cutoff: items created on/after ${new Date(cutoff).toISOString()} (last ${HOURS}h) ===`)
  const dos = await listDO()
  console.log(`\n--- DigitalOcean droplets (VPS): ${dos.length} ---`)
  dos.forEach(d => console.log(`  [${d.owner}] id=${d.id} ${d.name} ip=${d.ip} ${d.region}/${d.size} created=${d.created_at}`))
  const az = await listAzure()
  console.log(`\n--- Azure VMs (RDP): ${az.length} (timeCreated unknown shown too) ---`)
  az.forEach(v => console.log(`  [${v.owner}] ${v.name} ${v.location}/${v.size} rg=${v.rg} created=${v.timeCreated}`))
  const owners = new Set([...dos, ...az].map(x => x.owner))
  console.log(`\n=== Distinct owners affected: ${[...owners].join(', ') || '(none)'} ===`)
})().catch(e => console.error('ERR', e.message))
