#!/usr/bin/env node
'use strict'
require('dotenv').config()
const net = require('net')
const { MongoClient } = require('mongodb')

;(async () => {
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db(process.env.DB_NAME || 'test')
  const vmSetup = require('/app/js/vm-instance-setup.js')
  vmSetup.initVpsDb(db)
  const azure = require('/app/js/azure-service.js')

  // 1. Detail view (what the bot shows when he taps the RDP)
  console.log('=== fetchVPSDetails(404562920, az-nmdcbaec20f3) ===')
  const d = await vmSetup.fetchVPSDetails('404562920', 'az-nmdcbaec20f3')
  if (!d) { console.log('  ❌ returned false (detail view broken!)') }
  else {
    console.log('  ✅ name:', d.name, '| status:', d.status, '| ip:', d.host, '| isRDP:', d.isRDP,
                '| product:', d.productName, '| specs:', JSON.stringify(d.planDetails?.specs), '| defaultUser:', d.defaultUser)
  }

  // 2. Power state via instanceView
  console.log('\n=== Azure power state ===')
  try {
    const raw = await azure.apiRequest('GET',
      `/subscriptions/${process.env.AZURE_SUBSCRIPTION_ID}/resourceGroups/${process.env.AZURE_RESOURCE_GROUP}/providers/Microsoft.Compute/virtualMachines/nmdcbaec20f3/instanceView`,
      { apiVersion: '2024-11-01' })
    const statuses = (raw.statuses || []).map(s => s.code).join(', ')
    console.log('  statuses:', statuses)
  } catch (e) { console.log('  err:', e.message) }

  // 3. RDP port 3389 reachability
  console.log('\n=== TCP 20.125.117.70:3389 (RDP) ===')
  await new Promise((resolve) => {
    const sock = new net.Socket()
    let done = false
    sock.setTimeout(8000)
    sock.on('connect', () => { console.log('  ✅ RDP port OPEN — Windows is accepting RDP'); done = true; sock.destroy(); resolve() })
    sock.on('timeout', () => { if (!done) { console.log('  ⏳ timeout (VM may still be booting / NSG)'); sock.destroy(); resolve() } })
    sock.on('error', (e) => { if (!done) { console.log('  ❌ ' + e.message); resolve() } })
    sock.connect(3389, '20.125.117.70')
  })

  await client.close()
  console.log('\nDONE')
  process.exit(0)
})().catch(e => { console.error('FATAL', e); process.exit(1) })
