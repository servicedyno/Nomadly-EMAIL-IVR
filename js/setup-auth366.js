// Load env vars from file
const fs = require('fs')
const envContent = fs.readFileSync('/app/backend/.env', 'utf8')
envContent.split('\n').forEach(line => {
  const [key, ...valParts] = line.split('=')
  if (key && valParts.length) process.env[key.trim()] = valParts.join('=').trim()
})

const { MongoClient } = require('mongodb')

async function main() {
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db('test')
  
  const domain = 'auth366.com'
  
  console.log(`\n=== Setting up ${domain} with Cloudflare + Anti-Red ===\n`)
  
  // 1. Switch to Cloudflare
  const domainService = require('/app/js/domain-service')
  console.log('Step 1: Switching to Cloudflare (create zone + update NS at OpenProvider)...')
  const switchResult = await domainService.switchToCloudflare(domain, db)
  console.log('Switch result:', JSON.stringify(switchResult, null, 2))
  
  let zoneId = switchResult.zoneId
  
  if (switchResult.error) {
    console.log('Switch error (checking if already on CF):', switchResult.error)
    
    const cfService = require('/app/js/cf-service')
    const zone = await cfService.getZoneByName(domain)
    if (zone) {
      zoneId = zone.id
      console.log(`\n✅ Domain already has CF zone: ${zone.id}, Status: ${zone.status}`)
      console.log('Nameservers:', zone.name_servers)
      
      await db.collection('registeredDomains').updateOne(
        { _id: domain },
        { $set: { 
          'val.nameserverType': 'cloudflare', 
          'val.cfZoneId': zone.id, 
          'val.nameservers': zone.name_servers,
          'val.cfStatus': zone.status
        }}
      )
      console.log('DB updated with CF zone info')
    } else {
      console.log('❌ No CF zone found and switch failed. Aborting.')
      await client.close()
      return
    }
  } else {
    console.log('✅ Switched to Cloudflare! NS:', switchResult.nameservers)
  }
  
  // 2. Deploy anti-red worker route  
  if (zoneId) {
    console.log(`\nStep 2: Deploying anti-red worker route (zoneId: ${zoneId})...`)
    const { deploySharedWorkerRoute } = require('/app/js/anti-red-service')
    const workerResult = await deploySharedWorkerRoute(domain, zoneId)
    console.log('Worker route result:', JSON.stringify(workerResult, null, 2))
  }
  
  // 3. Verify
  const rd = await db.collection('registeredDomains').findOne({ _id: domain })
  console.log('\n=== Final State ===')
  console.log('  nameserverType:', rd?.val?.nameserverType)
  console.log('  cfZoneId:', rd?.val?.cfZoneId)
  console.log('  nameservers:', rd?.val?.nameservers)
  console.log('  cfStatus:', rd?.val?.cfStatus)
  
  await client.close()
  console.log('\n✅ Done!')
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
