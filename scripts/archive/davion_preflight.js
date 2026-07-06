require('dotenv').config({ path: '/app/backend/.env' })
const { MongoClient } = require('mongodb')
const contabo = require('/app/js/contabo-service.js')

;(async () => {
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db(process.env.DB_NAME || 'test')

  const CHATID = '404562920'
  const SSH_KEY_NAME = 'key-59789d69563f'

  console.log('=== SSH Key resolution ===')
  const sshKey = await db.collection('sshKeysOf').findOne({
    telegramId: CHATID,
    sshKeyName: SSH_KEY_NAME,
  })
  if (!sshKey) {
    console.log(`  ✗ SSH key '${SSH_KEY_NAME}' NOT found for chatId ${CHATID}`)
  } else {
    console.log(`  ✓ Found: contaboSecretId=${sshKey.contaboSecretId}, name=${sshKey.contaboName}`)
  }

  console.log('\n=== Contabo product lookup ===')
  const product = contabo.getProduct('V94')
  console.log('  V94:', JSON.stringify(product, null, 2))

  console.log('\n=== Default Windows image for V94 (NVMe) ===')
  try {
    const imgId = await contabo.getDefaultWindowsImageId('V94')
    console.log(`  imageId: ${imgId}`)
  } catch (e) { console.log('  err:', e.message) }

  console.log('\n=== Contabo regions ===')
  console.log('  Region in user state: "US-west"')

  console.log('\n=== Pricing estimate (real Contabo billing) ===')
  const basePrice = product.basePriceUsd  // 7.95
  const winLicense = parseFloat(process.env.VPS_WINDOWS_LICENSE || '8.63')
  // Region surcharge for non-EU: ~$2.80 (per user state)
  const regionSurcharge = 2.80
  const perInstance = basePrice + winLicense + regionSurcharge
  console.log(`  Per instance (V94 + Win RDP + US-west): ~$${perInstance.toFixed(2)}/mo`)
  console.log(`  Total for 2 instances: ~$${(perInstance * 2).toFixed(2)}/mo`)
  console.log(`  User-facing markup price (from state.vpsDetails): $32.25 each, $64.50 total — NOT charged`)

  await client.close()
})().catch(e => { console.error(e.message); process.exit(1) })
