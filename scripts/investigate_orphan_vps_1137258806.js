/**
 * Investigate the orphan VPS reference for chatId 1137258806 → instance #203251506.
 * Check current state of the user + Contabo instance + decide if vpsPlansOf backfill is needed.
 */
require('dotenv').config({ path: '/app/backend/.env' })
const { MongoClient } = require('mongodb')
const contabo = require('/app/js/contabo-service.js')

;(async () => {
  console.log('\n=== Step 1: Contabo instance #203251506 details ===')
  try {
    const ins = await contabo.getInstance(203251506)
    console.log(JSON.stringify({
      instanceId: ins?.instanceId,
      name: ins?.name,
      displayName: ins?.displayName,
      status: ins?.status,
      productId: ins?.productId,
      productType: ins?.productType,
      region: ins?.region,
      defaultUser: ins?.defaultUser,
      osType: ins?.osType,
      imageId: ins?.imageId,
      createdDate: ins?.createdDate,
      cancelDate: ins?.cancelDate,
      ipConfig: ins?.ipConfig,
      autoScalingType: ins?.autoScalingType,
    }, null, 2))
  } catch (e) {
    console.error('getInstance FAILED:', e.message)
  }

  console.log('\n=== Step 2: MongoDB state for chatId 1137258806 ===')
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db(process.env.DB_NAME || 'test')

  const state = await db.collection('state').findOne({ _id: '1137258806' })
  console.log('state[1137258806]:', JSON.stringify(state?.val || state, null, 2))

  const vps = await db.collection('vpsPlansOf').find({ chatId: '1137258806' }).toArray()
  console.log(`\nvpsPlansOf records for 1137258806: ${vps.length}`)
  for (const v of vps) console.log(' -', JSON.stringify(v, null, 2))

  const vpsByInstance = await db.collection('vpsPlansOf').find({ 'val.instanceId': 203251506 }).toArray()
  console.log(`\nvpsPlansOf records referring to instance #203251506: ${vpsByInstance.length}`)
  for (const v of vpsByInstance) console.log(' -', JSON.stringify(v, null, 2))

  const user = await db.collection('dataOfUsers').findOne({ chatId: '1137258806' })
  console.log('\ndataOfUsers[1137258806]:', JSON.stringify({
    chatId: user?.chatId,
    username: user?.username,
    telegramUsername: user?.telegramUsername,
    walletBalance: user?.walletBalance,
  }, null, 2))

  // Also list ALL Contabo instances to see which ones lack a vpsPlansOf record
  console.log('\n=== Step 3: Cross-reference ALL Contabo instances vs vpsPlansOf ===')
  const allInstances = await contabo.listInstances()
  console.log(`Total Contabo instances: ${allInstances.length}`)
  for (const i of allInstances) {
    const dbRec = await db.collection('vpsPlansOf').findOne({ 'val.instanceId': i.instanceId })
    const owner = dbRec ? dbRec.chatId : '— NO DB MATCH —'
    console.log(`  ${i.instanceId} | ${i.status.padEnd(10)} | ${(i.name || '').padEnd(28)} | created=${i.createdDate?.slice(0,10)} | owner=${owner}`)
  }

  await client.close()
})().catch(e => { console.error('Fatal:', e); process.exit(1) })
