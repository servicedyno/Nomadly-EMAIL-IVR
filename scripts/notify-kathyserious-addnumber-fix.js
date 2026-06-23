/**
 * Reset @kathyserious's stale state and DM her with the corrected path to
 * "Add a Number to Plan". Stale `cpIsSubNumber/cpSubParent*` state was set
 * during an aborted earlier attempt; clearing it prevents weird behavior
 * when she re-enters the flow.
 */
process.env.BOT_ENVIRONMENT = 'production'
require('dotenv').config({ path: '/app/backend/.env' })
require('../js/config-setup')
const { MongoClient } = require('mongodb')
const TelegramBot = require('node-telegram-bot-api')

const CHAT_ID = '8690991604'

;(async () => {
  const client = new MongoClient(process.env.MONGO_URL, { serverSelectionTimeoutMS: 20000 })
  await client.connect()
  const db = client.db(process.env.DB_NAME || 'test')

  // Reset her state to a clean baseline
  const reset = await db.collection('state').updateOne(
    { _id: CHAT_ID },
    { $set: {
      action: 'none',
      cpIsSubNumber: false,
      cpSubParentNumber: null,
      cpSubParentPlan: null,
      cpSubParentPlanPrice: null,
      cpSubParentExpiresAt: null,
      cpSelectedNumber: null,
      cpPrice: null,
      cpCountryCode: null,
      cpCountryName: null,
      cpProvider: null,
      cpPlanKey: null,
      cpNumberType: null,
      cpSearchResults: null,
      cpSelectedCapabilities: null,
      cpPendingCoin: null,
      cpPendingPriceUsd: null,
      cpPendingPriceNgn: null,
      cpPaymentMethod: null,
      lastUpdated: new Date(),
    }}
  )
  console.log('[Kathy] State reset:', reset.modifiedCount)

  // Send her the corrected guidance
  const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { webHook: false, polling: false })
  const msg =
    `🔧 <b>Update — found the issue you reported</b>\n\n`
    + `Hi! We pinpointed why "Add Number to Plan" was hard to find. We've shipped a fix so the 📋 My Plans view now lets you tap a number directly to manage it.\n\n`
    + `<b>Path to add an extra number to your Pro plan:</b>\n`
    + `1️⃣ Tap <b>📞 Cloud IVR + SIP</b>\n`
    + `2️⃣ Tap <b>📋 My Plans</b>\n`
    + `3️⃣ Tap <b>1</b> (your <code>+1 (888) 983-8571</code> number)\n`
    + `4️⃣ Tap <b>➕ Add Number to Plan</b>\n\n`
    + `Or, even faster: tap <b>📋 My Plans</b> and then <b>🛒 Buy Another Number</b> — this auto-routes to the discounted sub-number flow on your existing Pro plan.\n\n`
    + `<i>Pro plan allows up to 15 extra numbers · 0/15 used</i>\n\n`
    + `Try it now — let support know if anything's still unclear. 🙏`
  await bot.sendMessage(CHAT_ID, msg, { parse_mode: 'HTML', disable_web_page_preview: true })
  console.log('[Kathy] DM sent')

  await client.close()
  setTimeout(() => process.exit(0), 1000)
})().catch(e => { console.error(e); process.exit(1) })
