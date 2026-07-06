/**
 * Manually provision missing VPS records for @davion419 (chatId 404562920).
 *
 * Background: Both instances exist on Contabo under our reseller account but were
 * never recorded in `vpsPlansOf` collection, so the user's Telegram bot account
 * doesn't see them in "My VPS". This script inserts both with the same schema
 * `vm-instance-setup.js -> createVPSInstance()` uses, plus `adminProvisioned: true`
 * to distinguish from organic purchases.
 *
 * Expiry policy: 1 month from each instance's actual createdDate (Contabo).
 *   - vmi3220843 (RDP)   created 2026-04-10 → expires 2026-05-10
 *   - vmi3228089 (Linux) created 2026-04-12 → expires 2026-05-12
 *
 * Idempotent: if a record with the same contaboInstanceId already exists, it
 * will be UPDATED with the canonical schema (no duplicate insert).
 */

require('dotenv').config()
const { MongoClient } = require('mongodb')
const contabo = require('../js/contabo-service')

// Production Railway MongoDB
const PROD_MONGO_URL = 'mongodb://mongo:UCPkknTGVOBzrnOiXoIYyVhampeslSIR@roundhouse.proxy.rlwy.net:52715'
const PROD_DB_NAME = 'test'

const CHAT_ID = '404562920' // @davion419

const TARGETS = [
  // RDP from April 10
  { instanceId: 203220843, expectedProductId: 'V94', expectedIp: '66.94.96.183', isRDP: true },
  // VPS from April 12
  { instanceId: 203228089, expectedProductId: 'V93', expectedIp: '147.93.4.242', isRDP: false },
]

function addOneMonth(d) {
  const out = new Date(d)
  out.setMonth(out.getMonth() + 1)
  return out
}

// V93 / V96 / V99 / V102 / V105 are Storage VPS — not in our catalog.
// Use Contabo's published Storage VPS pricing as base (no markup applied,
// since user prepaid Contabo directly for these special instances).
const STORAGE_VPS_BASE_PRICE = {
  V93:  7.99,   // Storage VPS 10 (no setup)
  V96:  10.99,  // Storage VPS 20
  V99:  19.99,  // Storage VPS 30
  V102: 39.99,  // Storage VPS 40
  V105: 79.99,  // Storage VPS 50
}

async function computePlanPrice(productId, region, isRDP) {
  const product = contabo.getProduct(productId)
  if (product) {
    const pricing = contabo.calculatePrice(product, region, isRDP)
    return pricing?.totalWithMarkup || null
  }
  // Storage VPS fallback
  const base = STORAGE_VPS_BASE_PRICE[productId]
  if (base) {
    const markupPercent = parseFloat(process.env.VPS_MARKUP_PERCENT || '50')
    return Math.round(base * (1 + markupPercent / 100) * 100) / 100
  }
  return null
}

async function main() {
  const client = new MongoClient(PROD_MONGO_URL, {
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
    socketTimeoutMS: 30000,
  })

  try {
    await client.connect()
    const db = client.db(PROD_DB_NAME)
    const vpsPlansOf = db.collection('vpsPlansOf')

    // Confirm user
    const user = await db.collection('state').findOne({ _id: CHAT_ID })
    if (!user) throw new Error(`User ${CHAT_ID} not found`)
    console.log(`✅ User confirmed: chatId=${user._id} username=@${user.username || '?'}`)

    // Ensure isRegisteredTelegramForVps is set (required for VPS menu access)
    if (!user.isRegisteredTelegramForVps) {
      await db.collection('state').updateOne(
        { _id: CHAT_ID },
        { $set: { isRegisteredTelegramForVps: true } }
      )
      console.log(`  → Set isRegisteredTelegramForVps=true`)
    }

    for (const t of TARGETS) {
      console.log(`\n=== Processing instance ${t.instanceId} ===`)

      // Pull live data from Contabo
      const live = await contabo.getInstance(t.instanceId)
      if (!live) {
        console.log(`  ❌ Skipped — instance not accessible on Contabo API`)
        continue
      }

      const ip = live.ipConfig?.v4?.ip || t.expectedIp
      const createdDate = new Date(live.createdDate)
      const expiryDate = addOneMonth(createdDate)
      const isRDP = live.osType === 'Windows'
      const region = live.region || 'US-east'
      const planPrice = await computePlanPrice(live.productId, region, isRDP)

      const doc = {
        chatId: CHAT_ID,
        contaboInstanceId: live.instanceId,
        name: live.displayName || live.name,
        label: live.displayName || live.name,
        vpsId: String(live.instanceId),
        host: ip,
        region: region,
        productId: live.productId,
        osType: live.osType,
        isRDP: isRDP,
        imageId: live.imageId,
        defaultUser: live.defaultUser || (isRDP ? 'admin' : 'root'),
        start_time: createdDate,
        end_time: expiryDate,
        plan: 'Monthly',
        planPrice: planPrice,
        status: (live.status || 'running').toUpperCase(),
        rootPasswordSecretId: null, // password was set outside our flow
        sshKeySecretId: null,
        timestamp: createdDate,
        autoRenewable: false,
        adminProvisioned: true,
        adminProvisionedAt: new Date(),
        _reminder3DaySent: false,
        _reminder1DaySent: false,
        _autoRenewAttempted: false,
      }

      // Idempotent upsert by contaboInstanceId
      const result = await vpsPlansOf.updateOne(
        { contaboInstanceId: live.instanceId },
        { $set: doc, $setOnInsert: { createdAt: new Date() } },
        { upsert: true }
      )

      if (result.upsertedCount === 1) {
        console.log(`  ✅ INSERTED record (id=${result.upsertedId._id})`)
      } else if (result.modifiedCount === 1) {
        console.log(`  ✅ UPDATED existing record`)
      } else {
        console.log(`  ✅ Already canonical (no-op)`)
      }
      console.log(`     name=${doc.name}`)
      console.log(`     IP=${doc.host} | productId=${doc.productId} | osType=${doc.osType} | isRDP=${doc.isRDP}`)
      console.log(`     start=${doc.start_time.toISOString()} → end=${doc.end_time.toISOString()}`)
      console.log(`     planPrice=${doc.planPrice !== null ? `$${doc.planPrice}` : 'null'} | autoRenewable=${doc.autoRenewable}`)
    }

    // Final verification: list all records for this user
    console.log(`\n=== Final state: vpsPlansOf for chatId=${CHAT_ID} ===`)
    const all = await vpsPlansOf.find({ chatId: CHAT_ID }).toArray()
    console.log(`Total records: ${all.length}`)
    for (const r of all) {
      const daysLeft = Math.ceil((new Date(r.end_time) - Date.now()) / (24 * 3600 * 1000))
      console.log(`  ${r.contaboInstanceId} | ${r.name.padEnd(40)} | ${r.osType.padEnd(7)} | end=${r.end_time.toISOString().slice(0,10)} (${daysLeft}d left) | $${r.planPrice}`)
    }

    console.log(`\n✅ Done — both VPS provisions recorded with 1-month expiry from purchase date.`)
  } finally {
    await client.close().catch(() => {})
  }
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
