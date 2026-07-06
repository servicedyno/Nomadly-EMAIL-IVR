/**
 * ADMIN ORDER: 1000 leads per area code (260 + 574), all carriers, no CNAM,
 * combined TXT, delivered to @onarrival1 (chatId 5590563715) via prod bot.
 *
 * Runs as a standalone process but uses PRODUCTION:
 *   - Prod bot token (TELEGRAM_BOT_TOKEN_PROD) for sending messages/files
 *   - Prod Mongo (for leadJobs persistence)
 *   - Prod carrier validation API keys (Alcazar, Signalwire, NPL, Neutrino)
 *
 * @onarrival1 will see live progress messages and the final TXT file in his
 * normal Telegram conversation with the production Nomadly bot.
 */

require('dotenv').config()

// ─── Step 1: fetch ALL prod env from Railway BEFORE requiring app modules ───
async function loadProdEnv() {
  const TOKEN = process.env.RAILWAY_PROJECT_TOKEN
  const PID = process.env.RAILWAY_PROJECT_ID
  const EID = process.env.RAILWAY_ENVIRONMENT_ID
  const SID = process.env.RAILWAY_SERVICE_ID
  const r = await fetch('https://backboard.railway.app/graphql/v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Project-Access-Token': TOKEN },
    body: JSON.stringify({
      query: `query { variables(projectId: "${PID}", environmentId: "${EID}", serviceId: "${SID}") }`,
    }),
  })
  return (await r.json()).data.variables
}

;(async () => {
  console.log('═'.repeat(72))
  console.log('  ADMIN LEAD ORDER — 260 + 574 (1000 each), Mixed Carriers, no CNAM')
  console.log('═'.repeat(72))

  const prod = await loadProdEnv()
  console.log(`Prod Mongo: ${prod.MONGO_URL.split('@')[1]?.split('/')[0]}, DB=${prod.DB_NAME}`)
  console.log(`Prod Bot Token (first 8): ${prod.TELEGRAM_BOT_TOKEN_PROD?.substring(0, 8)}...`)

  // Override process.env with prod values BEFORE requiring any validators
  // (they read API keys from process.env at require-time)
  const KEYS_TO_OVERRIDE = [
    'MONGO_URL', 'DB_NAME',
    'TELEGRAM_BOT_TOKEN_PROD', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_ADMIN_CHAT_ID',
    'API_ALCAZAR',
    'TOKEN_SIGNALWIRE', 'MULTITEL_USERNAME', 'MULTITEL_PASSWORD',
    'NUMBER_PROBABLITY_API_ID', 'NUMBER_PROBABLITY_API_PASS',
    'NEUTRINO_ID', 'NEUTRINO_KEY',
    'TELNYX_API_KEY',
    'BOT_ENVIRONMENT', 'NODE_ENV',
  ]
  for (const k of KEYS_TO_OVERRIDE) {
    if (prod[k] !== undefined) process.env[k] = prod[k]
  }
  // Ensure both PROD and generic token aliases are set for any module that reads either
  if (prod.TELEGRAM_BOT_TOKEN_PROD) {
    process.env.TELEGRAM_BOT_TOKEN = prod.TELEGRAM_BOT_TOKEN_PROD
  }

  // ─── Step 2: connect to prod Mongo ───
  const { MongoClient } = require('mongodb')
  const mongo = new MongoClient(prod.MONGO_URL)
  await mongo.connect()
  const db = mongo.db(prod.DB_NAME)
  console.log(`✅ Connected to prod Mongo`)

  // ─── Step 3: init job persistence ───
  const { initLeadJobPersistence } = require('../js/lead-job-persistence')
  initLeadJobPersistence(db)

  // ─── Step 4: init prod bot client (no polling, just for sending) ───
  const TelegramBot = require('node-telegram-bot-api')
  const bot = new TelegramBot(prod.TELEGRAM_BOT_TOKEN_PROD)
  // Sanity check
  const me = await bot.getMe()
  console.log(`✅ Bot ready: @${me.username} (id=${me.id})`)

  // ─── Step 5: require the lead generator (env is now prod) ───
  const { validateBulkNumbers } = require('../js/validatePhoneBulk')

  const TARGET_CHAT_ID = '5590563715' // @onarrival1
  const AREA_CODES = ['260', '574']
  const PER_AREA = 1000
  const COUNTRY_CODE = '1' // USA
  const CARRIER = 'Mixed Carriers'
  const CNAM = false

  // ─── Step 6: announce start to @onarrival1 ───
  await bot.sendMessage(
    TARGET_CHAT_ID,
    `🚀 <b>Admin lead order started</b>\n\n📍 Area codes: <code>${AREA_CODES.join(', ')}</code>\n📊 Amount: ${PER_AREA.toLocaleString()} per area code (${(PER_AREA * AREA_CODES.length).toLocaleString()} total)\n📞 Carrier: All (Mixed Carriers)\n📛 CNAM: disabled\n💰 Cost: $0 (admin order)\n\n⏳ Estimated time: 10–30 min. You'll get progress updates and the final file when done.`,
    { parse_mode: 'HTML' },
  )
  console.log(`✅ Sent start notification to chatId ${TARGET_CHAT_ID}`)

  // ─── Step 7: run two passes (260, then 574) ───
  const startedAt = Date.now()
  const allNumbers = []
  const breakdown = {}

  for (let i = 0; i < AREA_CODES.length; i++) {
    const ac = AREA_CODES[i]
    const acStarted = Date.now()
    console.log(`\n── [${i + 1}/${AREA_CODES.length}] Generating area code ${ac} (${PER_AREA} leads) ──`)
    await bot.sendMessage(
      TARGET_CHAT_ID,
      `📍 [${i + 1}/${AREA_CODES.length}] Starting area code <b>${ac}</b>...`,
      { parse_mode: 'HTML' },
    )

    const results = await validateBulkNumbers(
      CARRIER,
      PER_AREA,
      COUNTRY_CODE,
      [ac],
      CNAM,
      bot,
      TARGET_CHAT_ID,
      'en',
      false, // requireRealName
      {
        target: `Admin order: AC ${ac}`,
        price: 0,
        walletDeducted: false,
        paymentCoin: 'ADMIN_ORDER',
        adminOrdered: true,
      },
    )
    const numbers = (results || []).map(r => r[0])
    breakdown[ac] = numbers.length
    allNumbers.push(...numbers)
    const elapsed = ((Date.now() - acStarted) / 60000).toFixed(1)
    console.log(`✅ Area code ${ac}: ${numbers.length} validated (${elapsed} min)`)
    await bot.sendMessage(
      TARGET_CHAT_ID,
      `✅ Area code <b>${ac}</b>: <b>${numbers.length.toLocaleString()}</b> validated leads (${elapsed} min)`,
      { parse_mode: 'HTML' },
    )
  }

  // ─── Step 8: write combined TXT and deliver ───
  const ts = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19)
  const filename = `admin_leads_${AREA_CODES.join('_')}_${allNumbers.length}_${ts}.txt`
  const filepath = `/tmp/${filename}`
  const fs = require('fs')
  fs.writeFileSync(filepath, allNumbers.join('\n'))

  const totalMin = ((Date.now() - startedAt) / 60000).toFixed(1)
  const breakdownStr = Object.entries(breakdown).map(([ac, n]) => `${ac}: ${n.toLocaleString()}`).join(' | ')

  console.log(`\n📦 Sending file: ${filename} (${allNumbers.length} numbers)`)
  await bot.sendDocument(
    TARGET_CHAT_ID,
    filepath,
    {
      caption: `📦 <b>Admin lead order — DELIVERED</b>\n\n📊 Total leads: <b>${allNumbers.length.toLocaleString()}</b>\n📍 Breakdown: ${breakdownStr}\n📞 Carrier: All\n📛 CNAM: disabled\n⏱️ Total time: ${totalMin} min\n💰 Cost: $0 (admin order)`,
      parse_mode: 'HTML',
    },
    { filename, contentType: 'text/plain' },
  )

  try { fs.unlinkSync(filepath) } catch (_) {}
  await mongo.close()

  console.log('\n' + '═'.repeat(72))
  console.log(`  ✅ DONE — ${allNumbers.length} leads delivered to chatId ${TARGET_CHAT_ID} in ${totalMin} min`)
  console.log(`     Breakdown: ${breakdownStr}`)
  console.log('═'.repeat(72))
  process.exit(0)
})().catch(err => {
  console.error('\n❌ FATAL:', err.message)
  console.error(err.stack)
  process.exit(1)
})
