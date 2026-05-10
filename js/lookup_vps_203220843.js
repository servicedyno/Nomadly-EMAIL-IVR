#!/usr/bin/env node
// One-off lookup: full state of VPS 203220843 (chatId 404562920) so we can answer
// the "does the user still have access?" question with hard data.

require('dotenv').config({ path: '/app/.env' })
const { MongoClient } = require('mongodb')
const contabo = require('./contabo-service.js')

async function main() {
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db(process.env.DB_NAME)

  console.log('═════════════════════════════════════════════════════════')
  console.log('  Lookup: VPS 203220843 / chatId 404562920')
  console.log('═════════════════════════════════════════════════════════\n')

  const dbRecord = await db.collection('vpsPlansOf').findOne({
    $or: [{ contaboInstanceId: 203220843 }, { vpsId: '203220843' }, { contaboInstanceId: '203220843' }],
  })
  console.log('── DB record (vpsPlansOf) ──')
  if (!dbRecord) {
    console.log('  NOT FOUND')
  } else {
    const interesting = ['_id', 'chatId', 'vpsId', 'contaboInstanceId', 'label', 'status', 'host',
      'osType', 'isRDP', 'planPrice', 'autoRenewable', 'end_time', 'subscriptionEnd',
      'cancelledAt', 'deletedAt', 'cancelReason', 'contaboCancelDate', '_contaboCancelledEarly',
      '_autoRenewAttempted', 'defaultUser', 'imageId', 'productId', 'region']
    for (const k of interesting) {
      if (dbRecord[k] !== undefined) console.log(`  ${k.padEnd(26)}: ${JSON.stringify(dbRecord[k])}`)
    }
  }

  console.log('\n── Live Contabo state ──')
  try {
    const live = await contabo.getInstance(203220843)
    const f = ['instanceId', 'name', 'displayName', 'status', 'productId', 'region',
      'osType', 'createdDate', 'cancelDate', 'autoScalingType', 'tenantId']
    for (const k of f) {
      if (live[k] !== undefined) console.log(`  ${k.padEnd(26)}: ${JSON.stringify(live[k])}`)
    }
    if (live.ipConfig) {
      console.log(`  ipConfig.v4.ip            : ${live.ipConfig.v4?.ip}`)
      console.log(`  ipConfig.v6.ip            : ${live.ipConfig.v6?.ip}`)
    }
  } catch (e) {
    console.log(`  ❌ ${e.message}`)
  }

  console.log('\n── User wallet (current balance) ──')
  const wallet = await db.collection('walletOf').findOne({ _id: 404562920 })
  if (wallet) {
    const usdBal = (wallet.usdIn || 0) - (wallet.usdOut || 0)
    console.log(`  usdIn: ${wallet.usdIn} | usdOut: ${wallet.usdOut} | balance: $${usdBal.toFixed(2)}`)
  } else {
    console.log('  (no wallet record)')
  }

  console.log('\n── User Telegram identity ──')
  const name = await db.collection('nameOf').findOne({ _id: 404562920 })
  console.log(`  ${JSON.stringify(name)}`)

  await client.close()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
