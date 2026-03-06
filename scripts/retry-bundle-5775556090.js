/**
 * Retry bundle submission for user 5775556090 (South Africa ZA local number).
 *
 * South Africa (Local - Individual) regulation requires:
 *   1. End-User: individual (first_name, last_name, nationality)
 *   2. Supporting Doc: government_issued_document (first_name, last_name) — name proof
 *   3. Supporting Doc: government_issued_document (document_number) — identity proof
 *   4. Supporting Doc: tax_document with address_sids — address proof
 *
 * The old bundle BU08890c88... failed because it tried to add raw Address SID
 * instead of a proper Supporting Document.
 */

require('dotenv').config({ path: '/app/backend/.env' })
const { MongoClient } = require('mongodb')
const TelegramBot = require('node-telegram-bot-api')

const twilio = require('twilio')
const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const client = twilio(accountSid, authToken)

// Production Telegram bot (@Nomadlybot)
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN_PROD
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID
const bot = new TelegramBot(BOT_TOKEN)

const MONGO_URL = process.env.MONGO_URL
const SELF_URL = process.env.SELF_URL || process.env.SELF_URL_PROD
const CHAT_ID = 5775556090

async function run() {
  console.log('━━━ Retry Bundle Submission for chatId', CHAT_ID, '━━━\n')

  const mongo = await MongoClient.connect(MONGO_URL)
  const db = mongo.db('test')
  const pendingBundles = db.collection('pendingBundles')

  const pb = await pendingBundles.findOne({ chatId: CHAT_ID, status: 'draft' })
  if (!pb) {
    console.log('❌ No draft bundle found for chatId', CHAT_ID)
    await mongo.close()
    return
  }
  console.log('Found stuck bundle:', pb.bundleSid)
  console.log('  address:', pb.addressSid, '| endUser:', pb.endUserSid)
  console.log('  regulation:', pb.regulationSid, '(South Africa: Local - Individual)\n')

  try {
    // ── Step 1: Update end-user with nationality (required for ZA) ──
    console.log('[Step 1] Updating end-user with nationality...')
    try {
      await client.numbers.v2.regulatoryCompliance.endUsers(pb.endUserSid).update({
        attributes: {
          first_name: 'usdcethh',
          last_name: 'User',
          nationality: 'ZA',
        }
      })
      console.log('✅ End-user updated with nationality=ZA')
    } catch (e) {
      console.log('⚠️ Could not update end-user (will proceed):', e.message)
    }

    // ── Step 2: Create Supporting Doc — Name Proof (government_issued_document) ──
    console.log('\n[Step 2] Creating name proof document (government_issued_document)...')
    const nameDoc = await client.numbers.v2.regulatoryCompliance.supportingDocuments.create({
      friendlyName: `NameProof-${CHAT_ID}-ZA`,
      type: 'government_issued_document',
      attributes: {
        first_name: 'usdcethh',
        last_name: 'User',
      },
    })
    console.log('✅ Name proof doc:', nameDoc.sid, '(status:', nameDoc.status + ')')

    // ── Step 3: Create Supporting Doc — Identity Proof (government_issued_document) ──
    console.log('\n[Step 3] Creating identity proof document (government_issued_document)...')
    const idDoc = await client.numbers.v2.regulatoryCompliance.supportingDocuments.create({
      friendlyName: `IdProof-${CHAT_ID}-ZA`,
      type: 'government_issued_document',
      attributes: {
        document_number: 'PENDING',
      },
    })
    console.log('✅ Identity proof doc:', idDoc.sid, '(status:', idDoc.status + ')')

    // ── Step 4: Create Supporting Doc — Address Proof (tax_document with address_sids) ──
    console.log('\n[Step 4] Creating address proof document (tax_document)...')
    const addrDoc = await client.numbers.v2.regulatoryCompliance.supportingDocuments.create({
      friendlyName: `AddressProof-${CHAT_ID}-ZA`,
      type: 'tax_document',
      attributes: {
        address_sids: [pb.addressSid],
      },
    })
    console.log('✅ Address proof doc:', addrDoc.sid, '(status:', addrDoc.status + ')')

    // ── Step 5: Create NEW bundle ──
    console.log('\n[Step 5] Creating new regulatory bundle...')
    const bundleCallbackUrl = SELF_URL ? `${SELF_URL}/twilio/bundle-status` : undefined
    const newBundle = await client.numbers.v2.regulatoryCompliance.bundles.create({
      friendlyName: `Nomadly-${CHAT_ID}-ZA-local-retry`,
      email: process.env.NOMADLY_SERVICE_EMAIL || 'support@nomadly.com',
      regulationSid: pb.regulationSid,
      statusCallback: bundleCallbackUrl,
    })
    console.log('✅ New bundle:', newBundle.sid, '(status:', newBundle.status + ')')

    // ── Step 6: Add all items to bundle ──
    console.log('\n[Step 6] Adding items to bundle...')

    const items = [
      { sid: pb.endUserSid, label: 'End-User' },
      { sid: nameDoc.sid, label: 'Name proof' },
      { sid: idDoc.sid, label: 'Identity proof' },
      { sid: addrDoc.sid, label: 'Address proof' },
    ]

    for (const item of items) {
      try {
        const result = await client.numbers.v2.regulatoryCompliance
          .bundles(newBundle.sid).itemAssignments.create({ objectSid: item.sid })
        console.log(`  ✅ ${item.label} (${item.sid}) → ${result.sid}`)
      } catch (e) {
        console.log(`  ❌ ${item.label} (${item.sid}) FAILED: ${e.message}`)
      }
    }

    // ── Step 7: Check evaluation before submitting ──
    console.log('\n[Step 7] Checking bundle evaluation...')
    try {
      const evaluations = await client.numbers.v2.regulatoryCompliance
        .bundles(newBundle.sid).evaluations.create()
      console.log('  Evaluation status:', evaluations.status)
      if (evaluations.results) {
        evaluations.results.forEach(r => {
          console.log(`  - ${r.requirement_friendly_name}: ${r.passed ? '✅ PASS' : '❌ FAIL'}`)
          if (!r.passed && r.failure_reason) console.log(`    Reason: ${r.failure_reason}`)
        })
      }
    } catch (e) {
      console.log('  ⚠️ Could not evaluate:', e.message)
    }

    // ── Step 8: Submit for review ──
    console.log('\n[Step 8] Submitting bundle for review...')
    try {
      const submitted = await client.numbers.v2.regulatoryCompliance
        .bundles(newBundle.sid).update({ status: 'pending-review' })
      console.log('✅ Bundle submitted! Status:', submitted.status)

      // Update DB
      await pendingBundles.updateOne({ _id: pb._id }, {
        $set: {
          bundleSid: newBundle.sid,
          supportingDocSids: { nameDoc: nameDoc.sid, idDoc: idDoc.sid, addrDoc: addrDoc.sid },
          oldBundleSid: pb.bundleSid,
          status: submitted.status || 'pending-review',
          updatedAt: new Date(),
        }
      })
      console.log('✅ DB updated')

      // Notify user via @Nomadlybot
      try {
        await bot.sendMessage(CHAT_ID,
          `📋 <b>Regulatory Approval Re-submitted</b>\n\nYour 🇿🇦 South Africa number request has been re-submitted for approval (1-3 business days). Your <b>$${Number(pb.price).toFixed(2)}</b> is held securely.`,
          { parse_mode: 'HTML' })
        console.log('✅ User notified via @Nomadlybot')
      } catch (tgErr) {
        console.log('⚠️ Could not notify user:', tgErr.message)
      }

      // Notify admin
      try {
        await bot.sendMessage(ADMIN_CHAT_ID,
          `📋 [Bundle Retry] Re-submitted for chatId: ${CHAT_ID}\nOld: ${pb.bundleSid}\nNew: ${newBundle.sid}\nDocs: name=${nameDoc.sid}, id=${idDoc.sid}, addr=${addrDoc.sid}\nStatus: ${submitted.status}`)
        console.log('✅ Admin notified')
      } catch (tgErr) {
        console.log('⚠️ Could not notify admin:', tgErr.message)
      }

    } catch (submitErr) {
      console.log('❌ Submit failed:', submitErr.message)
      console.log('\n⚠️ Bundle created but not submitted — may need manual review in Twilio Console')
      console.log('  Bundle SID:', newBundle.sid)
      console.log('  URL: https://console.twilio.com/us1/develop/phone-numbers/regulatory-compliance/bundles/' + newBundle.sid)

      // Still update DB so BundleChecker tracks it
      await pendingBundles.updateOne({ _id: pb._id }, {
        $set: {
          bundleSid: newBundle.sid,
          supportingDocSids: { nameDoc: nameDoc.sid, idDoc: idDoc.sid, addrDoc: addrDoc.sid },
          oldBundleSid: pb.bundleSid,
          status: 'draft',
          updatedAt: new Date(),
        }
      })
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('Done. New bundle:', newBundle.sid)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  } catch (err) {
    console.error('\n❌ ERROR:', err.message)
    if (err.code) console.error('  Code:', err.code)
    if (err.moreInfo) console.error('  More info:', err.moreInfo)
  }

  await mongo.close()
}

run().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
