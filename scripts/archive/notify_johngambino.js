#!/usr/bin/env node
// Send user + admin notifications for the johngambino back-charge (already applied)
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
  const USER_CHAT = '817673476'
  const BACK_CHARGE = 60

  const userMsg =
    `💳 <b>Plan Price Correction</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Hi! We noticed your Pro-plan number <code>+18884879051</code> was being renewed at the wrong price ($15/mo instead of the standard $75/mo). ` +
    `This happened because of an admin restoration on April 20 that copied an old grandfathered amount into your number's record.\n\n` +
    `📋 <b>Correction applied today:</b>\n` +
    `• Plan: Pro (unchanged)\n` +
    `• Stored price: $15 → <b>$75/mo</b> (correct rate)\n` +
    `• One-time recovery: <b>$60.00</b> debited from your USD wallet — this is the underpayment from your May 20 renewal\n\n` +
    `⚠️ <b>Your wallet balance is now -$37.02</b> (was $22.98). Please top up so your <b>June 20 renewal</b> goes through smoothly (next charge will be $75).\n\n` +
    `If you believe this was a comp / promotional rate that should have remained at $15, please reply here and we'll review with admin. Apologies for the confusion 🙏`

  console.log(`[Notify] Sending DM to user ${USER_CHAT}…`)
  const r1 = await tg(TOKEN, USER_CHAT, userMsg)
  console.log(`[Notify] User DM: ok=${r1.ok}${r1.ok ? '' : ' err=' + JSON.stringify(r1).substring(0,300)}`)

  const adminMsg =
    `✅ <b>Back-charge applied (johngambino, chat 817673476)</b>\n\n` +
    `📞 +18884879051\n` +
    `📦 Pro: planPrice $15 → <b>$75</b>\n` +
    `💵 Wallet debited: <b>$${BACK_CHARGE}.00</b>\n` +
    `💰 New balance: <b>-$37.02</b>\n` +
    `🧾 phoneTransactions <code>back_charge_correction</code> row written\n` +
    `📩 User notified via DM\n\n` +
    `<i>Root cause: phone-scheduler.js was reading num.planPrice verbatim. Now self-heals + alerts on mismatch (this commit). Daily reconciler runs at 0:30 UTC.</i>\n` +
    `<i>Also grandfathered 2 released Scoreboard44 numbers ($30 business legacy) to silence reconciler.</i>`

  if (ADMIN_GROUP) {
    console.log(`[Notify] Sending admin group ${ADMIN_GROUP}…`)
    const r2 = await tg(TOKEN, ADMIN_GROUP, adminMsg)
    console.log(`[Notify] Admin notification: ok=${r2.ok}${r2.ok ? '' : ' err=' + JSON.stringify(r2).substring(0,300)}`)
  }
})().catch(e => { console.error(e); process.exit(1) })
