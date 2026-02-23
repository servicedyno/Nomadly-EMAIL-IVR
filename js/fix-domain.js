const fs = require('fs')
fs.readFileSync('/app/backend/.env', 'utf8').split('\n').forEach(l => {
  const [k,...v] = l.split('=')
  if (k && v.length) process.env[k.trim()] = v.join('=').trim()
})

const { MongoClient } = require('mongodb')
const opService = require('./op-service')
const cfService = require('./cf-service')
const { deploySharedWorkerRoute } = require('./anti-red-service')

async function main() {
  const domain = 'testingplancrypto.sbs'
  const chatId = 5168006768
  
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db('test')
  
  console.log(`\n=== Fixing ${domain} for chatId ${chatId} ===\n`)
  
  // Step 1: Get existing CF zone info
  console.log('Step 1: Checking Cloudflare zone...')
  const zone = await cfService.getZoneByName(domain)
  if (zone) {
    console.log(`  CF zone exists: ${zone.id}, status: ${zone.status}`)
    console.log(`  CF nameservers: ${zone.name_servers}`)
  } else {
    console.log('  No CF zone found, creating...')
    const cfResult = await cfService.createZone(domain)
    console.log('  CF zone created:', cfResult)
  }
  
  const cfNameservers = zone ? zone.name_servers : []
  const cfZoneId = zone ? zone.id : null
  
  // Step 2: Register at OpenProvider with CF nameservers
  console.log('\nStep 2: Registering at OpenProvider...')
  const regResult = await opService.registerDomain(domain, cfNameservers)
  console.log('  Registration result:', JSON.stringify(regResult, null, 2))
  
  if (regResult.error) {
    // Domain might already be registered - try updating NS instead
    console.log('  Registration failed, trying NS update...')
    const domainInfo = await opService.getDomainInfo(domain)
    if (domainInfo) {
      console.log('  Domain already exists at OP:', domainInfo.id)
      const nsResult = await opService.updateNameservers(domain, cfNameservers)
      console.log('  NS update result:', JSON.stringify(nsResult))
    }
  }
  
  // Step 3: Add to domainsOf and registeredDomains
  console.log('\nStep 3: Updating MongoDB...')
  const domainKey = domain.replace('.', '@')
  
  await db.collection('domainsOf').updateOne(
    { _id: chatId },
    { $set: { [domainKey]: true } },
    { upsert: true }
  )
  console.log(`  Added ${domainKey} to domainsOf for chatId ${chatId}`)
  
  await db.collection('registeredDomains').updateOne(
    { _id: domain },
    { $set: {
      val: {
        domain,
        provider: 'OpenProvider',
        registrar: 'OpenProvider',
        nameserverType: 'cloudflare',
        nameservers: cfNameservers,
        autoRenew: true,
        ownerChatId: chatId,
        status: 'registered',
        registeredAt: new Date(),
        linkedAt: new Date(),
        cfZoneId: cfZoneId,
        opDomainId: regResult.domainId || null
      }
    }},
    { upsert: true }
  )
  console.log(`  Created registeredDomains entry`)
  
  // Step 4: Deploy anti-red worker route
  if (cfZoneId) {
    console.log('\nStep 4: Deploying anti-red worker route...')
    const workerResult = await deploySharedWorkerRoute(domain, cfZoneId)
    console.log('  Worker result:', JSON.stringify(workerResult, null, 2))
  }
  
  // Verify
  const rd = await db.collection('registeredDomains').findOne({ _id: domain })
  console.log('\n=== Final State ===')
  console.log('  Registrar:', rd?.val?.registrar)
  console.log('  NS type:', rd?.val?.nameserverType)
  console.log('  CF zone:', rd?.val?.cfZoneId)
  console.log('  Nameservers:', rd?.val?.nameservers)
  
  await client.close()
  console.log('\n✅ Domain fix complete!')
}

main().catch(err => { console.error('FATAL:', err); process.exit(1) })
