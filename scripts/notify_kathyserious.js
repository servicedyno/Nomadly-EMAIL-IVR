#!/usr/bin/env node
// Notify @kathyserious about the failed AU purchase + fix.
require('dotenv').config({ path: '/app/backend/.env' })
const https = require('https')

function getProdVars() {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      query: `query { variables(projectId: "${process.env.RAILWAY_PROJECT_ID}", environmentId: "${process.env.RAILWAY_ENVIRONMENT_ID}", serviceId: "${process.env.RAILWAY_SERVICE_ID}") }`
    })
    const req = https.request({
      hostname: 'backboard.railway.app', path: '/graphql/v2', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body),
        'User-Agent': 'Mozilla/5.0', 'Project-Access-Token': process.env.RAILWAY_PROJECT_TOKEN }
    }, res => {
      let chunks = ''
      res.on('data', c => chunks += c)
      res.on('end', () => { try { resolve(JSON.parse(chunks).data.variables) } catch (e) { reject(e) } })
    })
    req.on('error', reject); req.write(body); req.end()
  })
}

function tg(token, chatId, text) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true })
    const req = https.request({
      hostname: 'api.telegram.org', path: `/bot${token}/sendMessage`, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, res => {
      let chunks = ''
      res.on('data', c => chunks += c)
      res.on('end', () => { try { resolve(JSON.parse(chunks)) } catch { resolve({ ok: false, status: res.statusCode, raw: chunks }) } })
    })
    req.on('error', e => resolve({ ok: false, error: e.message }))
    req.write(body); req.end()
  })
}

;(async () => {
  const v = await getProdVars()
  const TOKEN = v.TELEGRAM_BOT_TOKEN_PROD
  const ADMIN_GROUP = v.TELEGRAM_NOTIFY_GROUP_ID
  const USER_CHAT = '8690991604'

  const userMsg =
    `🛠 <b>Quick update on your Australian number purchase</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Hi! Earlier today (10:02 UTC) your Cloud IVR purchase didn't complete after you sent your address. ` +
    `Apologies — there were two bugs on our side:\n\n` +
    `1️⃣ Twilio requires a <b>postal code</b> for Australian numbers, and our address parser was silently ignoring it.\n` +
    `2️⃣ When the address creation failed, our error message itself crashed before reaching you, so you never saw what went wrong.\n\n` +
    `<b>Both bugs are now fixed</b> ✅\n\n` +
    `💰 <b>Your money is safe:</b> the $91 was refunded to your wallet immediately. Current balance: <b>$96</b>.\n\n` +
    `🔁 <b>To retry — no need to re-pay crypto:</b>\n` +
    `1. Tap 📞☁️ <b>Cloud IVR + SIP</b>\n` +
    `2. Tap 🛒 <b>Buy Phone Number</b>\n` +
    `3. Pick your plan + Australia 🇦🇺 again\n` +
    `4. Choose 💰 <b>Pay from Wallet</b> ($91 will be debited from your $96)\n` +
    `5. When asked for your address, please send it in this exact format:\n\n` +
    `   <code>Street, City, Postcode, Country</code>\n\n` +
    `   ✅ <i>Example for AU:</i>\n` +
    `   <code>42 George St, Sydney, 2000, Australia</code>\n\n` +
    `   ❌ Don't omit the postcode — that's what tripped us up before.\n\n` +
    `If you'd prefer help, just reply here and an admin will guide you through. Sorry for the trouble! 🙏`

  console.log(`[Notify] Sending DM to ${USER_CHAT}…`)
  const r1 = await tg(TOKEN, USER_CHAT, userMsg)
  console.log(`[Notify] User DM: ok=${r1.ok}${r1.ok ? '' : ' err=' + JSON.stringify(r1).substring(0,300)}`)

  const adminMsg =
    `🐛 <b>BUG FIX deployed — Cloud IVR address purchase</b>\n\n` +
    `<b>Incident:</b> @kathyserious (chat 8690991604) lost $91 LTC → wallet → silent failure on AU address.\n\n` +
    `<b>Two bugs found:</b>\n` +
    `• <code>refNgn is not defined</code> ReferenceError in <code>js/_index.js</code> error handler — crashed before sending the user message (6 occurrences fixed)\n` +
    `• Address parser treated <code>parts[2]</code> as <code>region</code> instead of <code>postal_code</code>, and never passed the postal code to <code>twilioService.createAddress()</code> — Twilio default <code>'00000'</code> rejected by AU.\n\n` +
    `<b>Fixes:</b>\n` +
    `• Validate &lt;4 comma-separated parts → reject with helpful error (keep payment held)\n` +
    `• Parse postal code from second-to-last part; optional state if 5+ parts\n` +
    `• Removed all 6 <code>refNgn</code> references (showWallet only takes USD anyway)\n\n` +
    `<b>User status:</b> refund of $91 still in their wallet ($96 total). DM sent with retry instructions.`

  if (ADMIN_GROUP) {
    const r2 = await tg(TOKEN, ADMIN_GROUP, adminMsg)
    console.log(`[Notify] Admin: ok=${r2.ok}`)
  }
})().catch(e => { console.error(e); process.exit(1) })
