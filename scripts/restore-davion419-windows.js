/**
 * Restore Windows OS on @davion419's vmi3220843 (instanceId 203220843).
 *
 * Background: User triggered "Reset Password" on his Windows RDP instance, which
 * hit a bug in resetPassword() that ran a Linux bash cloud-init reinstall —
 * silently turning Windows into Ubuntu 24.04. The bug is now fixed in code, but
 * the live instance needs a Windows reinstall to restore RDP for the user.
 *
 * Action:
 *   1. Look up the original Windows imageId (windows-server-2025-de — the same
 *      one used at original provisioning, captured in our prior provision script)
 *   2. Generate a fresh root/admin password + secret
 *   3. PUT /compute/instances/{id} with imageId=Windows + rootPassword (no userData,
 *      no sshKeys — Windows reinstall doesn't take Linux cloud-init)
 *   4. Update vpsPlansOf record: imageId, osType=Windows, isRDP=true,
 *      status='INSTALLING', defaultUser='admin', rootPasswordSecretId
 *
 * Idempotency: this script always runs the reinstall; safe to re-run if the user
 *   loses RDP again. We deliberately do NOT skip if osType is already Windows in
 *   the DB, because the DB might be stale vs. live Contabo state.
 */

require('dotenv').config()
const { MongoClient } = require('mongodb')
const contabo = require('../js/contabo-service')

const PROD_MONGO_URL = 'mongodb://mongo:UCPkknTGVOBzrnOiXoIYyVhampeslSIR@roundhouse.proxy.rlwy.net:52715'
const PROD_DB_NAME = 'test'

const INSTANCE_ID = 203220843        // vmi3220843
const CHAT_ID = '404562920'           // @davion419

async function main() {
  const client = new MongoClient(PROD_MONGO_URL, {
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
    socketTimeoutMS: 30000,
  })
  try {
    await client.connect()
    const db = client.db(PROD_DB_NAME)

    console.log('=== Step 1: Look up Windows imageId ===')
    const winImages = await contabo.listImages('windows')
    // Use the same Windows Server 2025 image originally provisioned for this
    // tier (V94 NVMe → "DE" edition), or any equivalent Server 2025 image.
    const targetWin = winImages.find(x => x.imageId === 'ef27e2fa-188f-4767-964b-7543fea74968')
                   || winImages.find(x => /windows-server-2025-de/i.test(x.name))
                   || winImages.find(x => /windows-server-2025/i.test(x.name))
                   || winImages[0]
    if (!targetWin) throw new Error('No Windows image available on Contabo')
    console.log(`  Using imageId=${targetWin.imageId} (${targetWin.name})`)

    console.log('\n=== Step 2: Generate fresh password + secret ===')
    const crypto = require('crypto')
    // Windows-safe charset (no shell-special chars; satisfies Contabo + Windows complexity)
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const lower = 'abcdefghijklmnopqrstuvwxyz'
    const digits = '0123456789'
    const symbols = '!@#-_+=.'
    const allChars = upper + lower + digits + symbols
    const rnd = (max) => crypto.randomBytes(4).readUInt32BE(0) % max
    const pwArr = [upper[rnd(upper.length)], lower[rnd(lower.length)], digits[rnd(digits.length)], symbols[rnd(symbols.length)]]
    while (pwArr.length < 20) pwArr.push(allChars[rnd(allChars.length)])
    for (let i = pwArr.length - 1; i > 0; i--) { const j = rnd(i + 1);[pwArr[i], pwArr[j]] = [pwArr[j], pwArr[i]] }
    const newPassword = pwArr.join('')
    const secret = await contabo.createSecret(`pwd-${INSTANCE_ID}-restore-win-${Date.now()}`, newPassword, 'password')
    console.log(`  Password generated, secretId=${secret.secretId}`)

    console.log('\n=== Step 3: Reinstall Windows on instance', INSTANCE_ID, '===')
    // Use reinstallInstance (PUT) with Windows imageId — NO userData, NO sshKeys
    // Contabo rejects sshKeys (even empty) for Windows reinstalls.
    const result = await contabo.reinstallInstance(INSTANCE_ID, {
      imageId: targetWin.imageId,
      rootPassword: secret.secretId,
    })
    console.log('  Reinstall API call sent. Contabo response:', JSON.stringify(result).slice(0, 200))

    console.log('\n=== Step 4: Update vpsPlansOf record ===')
    const upd = await db.collection('vpsPlansOf').updateOne(
      { contaboInstanceId: INSTANCE_ID, chatId: CHAT_ID },
      {
        $set: {
          imageId: targetWin.imageId,
          osType: 'Windows',
          isRDP: true,
          defaultUser: 'admin',
          status: 'INSTALLING',
          rootPasswordSecretId: secret.secretId,
          adminProvisioned: true,
          adminLastReinstalledAt: new Date(),
          adminLastReinstallReason: 'Restore Windows after resetPassword bug coerced OS to Ubuntu',
        },
      }
    )
    console.log(`  DB update: matched=${upd.matchedCount}, modified=${upd.modifiedCount}`)

    console.log('\n=== Step 5: Verify live Contabo state ===')
    const live = await contabo.getInstance(INSTANCE_ID)
    console.log('  status:', live.status)
    console.log('  imageId:', live.imageId)
    console.log('  osType:', live.osType)
    console.log('  defaultUser:', live.defaultUser)
    console.log('  ipv4:', live.ipConfig?.v4?.ip)

    console.log('\n=== Done ===')
    console.log('  Windows reinstall initiated. Provisioning typically takes 5–15 minutes.')
    console.log('  RDP credentials for @davion419:')
    console.log('    Host:', live.ipConfig?.v4?.ip || '66.94.96.183', ':3389')
    console.log('    Username: admin (or Administrator after install)')
    console.log('    Password:', newPassword)
    console.log('  ⚠️  These credentials must be relayed to the user via the bot/admin command.')
  } finally {
    await client.close().catch(() => {})
  }
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
