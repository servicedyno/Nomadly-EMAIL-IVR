/**
 * Retry bundle for user 5775556090 — Fixed: single combined gov doc for ZA.
 */
require('dotenv').config({ path: '/app/backend/.env' })
const { MongoClient } = require('mongodb')
const TelegramBot = require('node-telegram-bot-api')
const twilio = require('twilio')

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN_PROD)
const CHAT_ID = 5775556090
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID

async function run() {
  console.log('━━━ Retry Bundle for chatId', CHAT_ID, '(combined docs) ━━━\n')

  const mongo = await MongoClient.connect(process.env.MONGO_URL)
  const db = mongo.db('test')
  const pb = await db.collection('pendingBundles').findOne({ chatId: CHAT_ID })
  if (!pb) { console.log('No bundle found'); await mongo.close(); return }
  console.log('Found bundle:', pb.bundleSid, '| status:', pb.status, '| addr:', pb.addressSid)

  try {
    // 1. ONE combined government_issued_document (name + ID number)
    console.log('\n[1] Creating combined government ID document (name + doc number)...')
    const govDoc = await client.numbers.v2.regulatoryCompliance.supportingDocuments.create({
      friendlyName: `GovID-${CHAT_ID}-ZA`,
      type: 'government_issued_document',
      attributes: { first_name: 'usdcethh', last_name: 'User', document_number: 'PENDING-DOC-UPLOAD' },
    })
    console.log('   ✅', govDoc.sid)

    // 2. Address proof (tax_document with address_sids array)
    console.log('[2] Creating address proof document...')
    const addrDoc = await client.numbers.v2.regulatoryCompliance.supportingDocuments.create({
      friendlyName: `AddressProof-${CHAT_ID}-ZA`,
      type: 'tax_document',
      attributes: { address_sids: [pb.addressSid] },
    })
    console.log('   ✅', addrDoc.sid)

    // 3. New bundle
    console.log('\n[3] Creating new bundle...')
    const selfUrl = process.env.SELF_URL || process.env.SELF_URL_PROD
    const newBundle = await client.numbers.v2.regulatoryCompliance.bundles.create({
      friendlyName: `Nomadly-${CHAT_ID}-ZA-local-retry3`,
      email: process.env.NOMADLY_SERVICE_EMAIL || 'support@nomadly.com',
      regulationSid: pb.regulationSid,
      statusCallback: selfUrl ? `${selfUrl}/twilio/bundle-status` : undefined,
    })
    console.log('   ✅', newBundle.sid)

    // 4. Add items (end-user + 2 docs = 3 items, no duplicates)
    console.log('\n[4] Adding items...')
    for (const { sid, label } of [
      { sid: pb.endUserSid, label: 'End-User' },
      { sid: govDoc.sid, label: 'Gov ID (name+number)' },
      { sid: addrDoc.sid, label: 'Address proof' },
    ]) {
      try {
        const r = await client.numbers.v2.regulatoryCompliance.bundles(newBundle.sid).itemAssignments.create({ objectSid: sid })
        console.log(`   ✅ ${label}: ${r.sid}`)
      } catch (e) {
        console.log(`   ❌ ${label}: ${e.message}`)
      }
    }

    // 5. Evaluate
    console.log('\n[5] Evaluating...')
    try {
      const ev = await client.numbers.v2.regulatoryCompliance.bundles(newBundle.sid).evaluations.create()
      console.log('   Status:', ev.status)
      if (ev.results) ev.results.forEach(r => {
        console.log(`   - ${r.requirement_friendly_name}: ${r.passed ? '✅' : '❌'}${r.failure_reason ? ' — ' + r.failure_reason : ''}`)
      })
    } catch (e) { console.log('   ⚠️', e.message) }

    // 6. Submit
    console.log('\n[6] Submitting...')
    try {
      const submitted = await client.numbers.v2.regulatoryCompliance.bundles(newBundle.sid).update({ status: 'pending-review' })
      console.log('   ✅ Status:', submitted.status)

      await db.collection('pendingBundles').updateOne({ _id: pb._id }, {
        $set: {
          bundleSid: newBundle.sid, oldBundleSid: pb.bundleSid,
          supportingDocSids: { govDoc: govDoc.sid, addrDoc: addrDoc.sid },
          status: submitted.status || 'pending-review', updatedAt: new Date(),
        }
      })
      console.log('   ✅ DB updated')

      try {
        await bot.sendMessage(CHAT_ID, `📋 <b>Regulatory Approval Re-submitted</b>\n\nYour 🇿🇦 South Africa number has been re-submitted (1-3 business days). Your <b>$${Number(pb.price).toFixed(2)}</b> is held securely.`, { parse_mode: 'HTML' })
        console.log('   ✅ User notified')
      } catch (e) { console.log('   ⚠️ Could not message user:', e.message) }

      try {
        await bot.sendMessage(Number(ADMIN_CHAT_ID), `📋 [Bundle Retry] chatId=${CHAT_ID}\nNew: ${newBundle.sid}\nStatus: ${submitted.status}`)
        console.log('   ✅ Admin notified')
      } catch (e) { console.log('   ⚠️ Could not message admin:', e.message) }

    } catch (submitErr) {
      console.log('   ❌ Submit failed:', submitErr.message)
      await db.collection('pendingBundles').updateOne({ _id: pb._id }, {
        $set: { bundleSid: newBundle.sid, oldBundleSid: pb.bundleSid, status: 'needs-docs', updatedAt: new Date() }
      })

      try {
        await bot.sendMessage(CHAT_ID, `📋 <b>Documents Required</b>\n\nYour 🇿🇦 South Africa number requires identity documents for approval. Your balance of <b>$${Number(pb.price).toFixed(2)}</b> is safe. Please go to ☎️ Cloud Phone → 🇿🇦 South Africa to re-submit with the new document upload process.`, { parse_mode: 'HTML' })
      } catch (e) { console.log('   ⚠️ Could not message user:', e.message) }
    }

    console.log('\n━━━ Done ━━━')
  } catch (err) {
    console.error('\n❌ ERROR:', err.message)
  }
  await mongo.close()
}

run().catch(console.error)
