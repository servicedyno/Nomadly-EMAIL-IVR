#!/usr/bin/env node
/**
 * Finalize davion419 remediation:
 *  - Hide his 3 dead RDP records (broken paid Contabo + 2 orphaned comps) so the
 *    bot shows exactly ONE working RDP (the new Azure one) + his working Linux VPS.
 *  - Verify the resulting bot VPS list via the real fetchUserVPSList().
 *  - Report Azure VM power state.
 */
'use strict'
require('dotenv').config()
const { MongoClient } = require('mongodb')
const CHAT = '404562920'
const DEAD_RDP = ['203378282', '203368045', '203368052'] // broken paid + 2 orphaned comps

;(async () => {
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db(process.env.DB_NAME || 'test')
  const col = db.collection('vpsPlansOf')

  // 1. Archive/hide the dead RDP records (status DELETED is excluded by fetchUserVPSList)
  for (const iid of DEAD_RDP) {
    const r = await col.findOne({ contaboInstanceId: isNaN(Number(iid)) ? iid : Number(iid) })
    if (!r) { console.log(`[clean] ${iid} not found`); continue }
    await col.updateOne({ _id: r._id }, { $set: {
      status: 'DELETED',
      _orphanArchivedAt: new Date(),
      _orphanArchiveReason: 'contabo-orphan/broken RDP replaced by Azure az-nmdcbaec20f3 (one-RDP remediation 2026-06)'
    }})
    console.log(`[clean] hid dead RDP ${iid} (was status=${r.status})`)
  }

  // 2. Verify resulting list via the bot's own function
  const vmSetup = require('/app/js/vm-instance-setup.js')
  vmSetup.initVpsDb(db)
  console.log('\n[verify] fetchUserVPSList(404562920):')
  const list = await vmSetup.fetchUserVPSList(CHAT)
  for (const v of list) {
    console.log(`   - ${v.name} | _id=${v._id} | status=${v.status} | ip=${v.host} | isRDP=${v.isRDP} | region=${v.region}`)
  }

  // 3. Azure VM power state for the new RDP
  const azure = require('/app/js/azure-service.js')
  console.log('\n[verify] Azure VM az-nmdcbaec20f3 live:')
  try {
    const live = await azure.getInstance('az-nmdcbaec20f3')
    console.log('   status:', live.status, '| ip:', live.ipConfig?.v4?.ip || live.mainIp, '| cpu:', live.cpuCores, '| ramMb:', live.ramMb, '| defaultUser:', live.defaultUser)
  } catch (e) { console.log('   getInstance err:', e.message) }

  await client.close()
  console.log('\nDONE')
  process.exit(0)
})().catch(e => { console.error('FATAL', e); process.exit(1) })
