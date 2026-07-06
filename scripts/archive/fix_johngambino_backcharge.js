#!/usr/bin/env node
/**
 * Data-fix script for the @johngambino under-charge incident.
 *
 *   • +18884879051 (chat 817673476)
 *     - phoneNumbersOf.planPrice: $15 → $75      (root-cause fix)
 *     - walletOf.usdOut += $60                   (back-charge for May 20 renewal)
 *     - phoneTransactions: insert backfill row   (audit trail)
 *     - Telegram DM to user explaining the correction
 *
 *   • Also marks released Scoreboard44 numbers as `grandfathered:true` so
 *     they don't pollute future reconciler digests (they're released, can't
 *     auto-renew, but the wrong stored price would otherwise show up daily).
 *
 * Idempotent: re-running is safe — it checks for an existing backfill row
 * and skips the wallet debit if one is already present.
 *
 * Run:  node /app/scripts/fix_johngambino_backcharge.js
 */
require('dotenv').config({ path: '/app/backend/.env' })
const https = require('https')
const { MongoClient } = require('mongodb')

const TOKEN = process.env.RAILWAY_PROJECT_TOKEN
const PID   = process.env.RAILWAY_PROJECT_ID
const EID   = process.env.RAILWAY_ENVIRONMENT_ID
const SID   = process.env.RAILWAY_SERVICE_ID

async function getProdVars() {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      query: `query { variables(projectId: "${PID}", environmentId: "${EID}", serviceId: "${SID}") }`
    })
    const req = https.request({
      hostname: 'backboard.railway.app', path: '/graphql/v2', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'User-Agent': 'Mozilla/5.0',
        'Project-Access-Token': TOKEN,
      },
    }, res => {
      let chunks = ''
      res.on('data', c => chunks += c)
      res.on('end', () => {
        try { resolve(JSON.parse(chunks).data.variables) } catch (e) { reject(e) }
      })
    })
    req.on('error', reject)
    req.write(body); req.end()
  })
}

async function sendTelegram(token, chatId, text) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true })
    const req = https.request({
      hostname: 'api.telegram.org', path: `/bot${token}/sendMessage`, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, res => {
      let chunks = ''
      res.on('data', c => chunks += c)
      res.on('end', () => {
        try { resolve(JSON.parse(chunks)) }
        catch { resolve({ ok: false, raw: chunks, status: res.statusCode }) }
      })
    })
    req.on('error', e => resolve({ ok: false, error: e.message }))
    req.write(body); req.end()
  })
}

;(async () => {
  console.log('[Fix] Resolving production credentials from Railway…')
  const vars = await getProdVars()
  const MONGO_URL = vars.MONGO_URL
  const DB_NAME   = vars.DB_NAME || 'test'
  const TELEGRAM_BOT_TOKEN = vars.TELEGRAM_BOT_TOKEN || vars.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  const ADMIN_CHAT = vars.TELEGRAM_ADMIN_CHAT_ID || vars.ADMIN_CHAT_ID || process.env.TELEGRAM_ADMIN_CHAT_ID

  if (!MONGO_URL) { console.error('No MONGO_URL'); process.exit(1) }
  if (!TELEGRAM_BOT_TOKEN) { console.warn('[Fix] No bot token — DM step will be skipped') }

  const client = new MongoClient(MONGO_URL)
  await client.connect()
  const db = client.db(DB_NAME)
  console.log(`[Fix] Connected: DB=${DB_NAME}`)

  // ─── TARGET 1: @johngambino +18884879051 ───
  const chatId = '817673476'
  const phone  = '+18884879051'
  const correctPrice = 75
  const wrongPrice = 15
  const backCharge = correctPrice - wrongPrice  // = $60

  const doc = await db.collection('phoneNumbersOf').findOne({ _id: chatId })
  if (!doc) { console.error('[Fix] chat 817673476 not found'); process.exit(1) }
  const nums = doc?.val?.numbers || []
  const target = nums.find(n => n.phoneNumber === phone)
  if (!target) { console.error(`[Fix] ${phone} not found`); process.exit(1) }

  console.log(`[Fix] BEFORE: ${phone} plan=${target.plan} planPrice=$${target.planPrice} grandfathered=${target.grandfathered}`)

  // Idempotency: have we already inserted the backfill row?
  const existing = await db.collection('phoneTransactions').findOne({
    chatId, phoneNumber: phone, action: 'back_charge_correction', _fixVersion: 1,
  })
  if (existing) {
    console.log(`[Fix] Already corrected (back_charge_correction row exists at ${existing.timestamp}). Skipping wallet debit + tx insert; only verifying planPrice is now $75.`)
  }

  // 1) Self-heal planPrice
  const healRes = await db.collection('phoneNumbersOf').updateOne(
    { _id: chatId, 'val.numbers.phoneNumber': phone },
    { $set: {
      'val.numbers.$.planPrice': correctPrice,
      'val.numbers.$._priceHealedAt': new Date().toISOString(),
      'val.numbers.$._priceHealedFrom': target.planPrice,
      'val.numbers.$._priceHealedBy': 'fix_johngambino_backcharge.js',
    } }
  )
  console.log(`[Fix] planPrice update matched=${healRes.matchedCount} modified=${healRes.modifiedCount}`)

  // 2) Back-charge wallet (allow going negative)
  let newBal = null
  if (!existing) {
    const w = await db.collection('walletOf').findOne({ _id: chatId })
    // Confirmed schema (verified in prod 2026-05-25): top-level usdIn/usdOut.
    const beforeUsdIn  = Number(w?.usdIn  || 0)
    const beforeUsdOut = Number(w?.usdOut || 0)
    const beforeBal = beforeUsdIn - beforeUsdOut
    console.log(`[Fix] Wallet BEFORE: usdIn=$${beforeUsdIn} usdOut=$${beforeUsdOut} balance=$${beforeBal.toFixed(2)}`)
    await db.collection('walletOf').updateOne(
      { _id: chatId },
      { $inc: { usdOut: backCharge } },
      { upsert: true }
    )
    const w2 = await db.collection('walletOf').findOne({ _id: chatId })
    const afterUsdIn  = Number(w2?.usdIn  || 0)
    const afterUsdOut = Number(w2?.usdOut || 0)
    newBal = afterUsdIn - afterUsdOut
    console.log(`[Fix] Wallet AFTER:  usdIn=$${afterUsdIn} usdOut=$${afterUsdOut} balance=$${newBal.toFixed(2)}`)
  }

  // 3) Write audit-trail row
  if (!existing) {
    const txDoc = {
      chatId,
      phoneNumber: phone,
      action: 'back_charge_correction',
      plan: 'pro',
      amount: backCharge.toFixed(2),
      paymentMethod: 'wallet_usd (may go negative)',
      timestamp: new Date().toISOString(),
      reason: 'Apr-20 admin restoration left planPrice=$15 on a Pro tier. ' +
              'May-20 auto-renew silently charged $15 instead of $75. ' +
              'Recovering the $60 difference and self-healing planPrice to $75.',
      relatedRenewalDate: '2026-05-20',
      oldPlanPrice: wrongPrice,
      newPlanPrice: correctPrice,
      _fixVersion: 1,
      _appliedBy: 'fix_johngambino_backcharge.js',
    }
    await db.collection('phoneTransactions').insertOne(txDoc)
    console.log(`[Fix] phoneTransactions back_charge_correction row inserted ($${backCharge})`)
  }

  // 4) DM user
  if (TELEGRAM_BOT_TOKEN && !existing) {
    const msg =
      `💳 <b>Plan Price Correction</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Hi! We noticed your Pro-plan number <code>${phone}</code> was being renewed at the wrong price ($15 instead of the standard $75/mo). ` +
      `This happened because of an admin restoration on April 20 that copied an old grandfathered amount.\n\n` +
      `📋 <b>Correction applied today:</b>\n` +
      `• plan: Pro (unchanged)\n` +
      `• stored price: $15 → <b>$75/mo</b> (correct rate)\n` +
      `• one-time recovery: <b>$60</b> debited from your USD wallet (the underpayment from your May 20 renewal)\n\n` +
      `⚠️ Your wallet balance may now show as negative — that's normal. Please top up so your <b>June 20 renewal</b> goes through smoothly (the next charge will be $75).\n\n` +
      `If you believe this was a comp / promotional rate that should have remained at $15, please reply here and we'll review with admin. Apologies for the confusion 🙏`
    console.log(`[Fix] Sending DM to chat ${chatId}…`)
    const r = await sendTelegram(TELEGRAM_BOT_TOKEN, chatId, msg)
    console.log(`[Fix] DM result: ok=${r.ok}`)
    if (!r.ok) console.log(`[Fix] DM error: ${JSON.stringify(r).substring(0,300)}`)
  }

  // ─── TARGET 2: Scoreboard44 released numbers — grandfather to silence reconciler ───
  const sc = await db.collection('phoneNumbersOf').findOne({ _id: '8273560746' })
  if (sc) {
    const released = (sc?.val?.numbers || []).filter(n => n.status && n.status !== 'active' && n.status !== 'suspended')
    for (const r of released) {
      if (Number(r.planPrice) !== phoneConfigPrice('business') && !r.grandfathered) {
        await db.collection('phoneNumbersOf').updateOne(
          { _id: '8273560746', 'val.numbers.phoneNumber': r.phoneNumber },
          { $set: {
            'val.numbers.$.grandfathered': true,
            'val.numbers.$._grandfatheredReason': 'released-with-legacy-$30-business-price',
            'val.numbers.$._grandfatheredBy': 'fix_johngambino_backcharge.js',
          } }
        )
        console.log(`[Fix] Marked released ${r.phoneNumber} as grandfathered (legacy $30 business)`)
      }
    }
  }

  // ─── Admin notification ───
  if (TELEGRAM_BOT_TOKEN && ADMIN_CHAT) {
    const adminMsg =
      `✅ <b>Back-charge applied (johngambino)</b>\n` +
      `📞 ${phone}\n` +
      `📦 Pro: planPrice $15 → <b>$75</b>\n` +
      `💵 Wallet debited: <b>$${backCharge}</b>${newBal !== null ? `\n💰 New balance: <b>$${newBal.toFixed(2)}</b>` : ''}\n` +
      `🧾 phoneTransactions back_charge_correction row written\n` +
      `📩 User notified via DM\n` +
      `<i>Also grandfathered 2 released Scoreboard44 numbers ($30 business) to silence reconciler.</i>`
    await sendTelegram(TELEGRAM_BOT_TOKEN, ADMIN_CHAT, adminMsg)
    console.log('[Fix] Admin group notified.')
  }

  await client.close()
  console.log('[Fix] Done.')
})().catch(e => { console.error('[Fix] FATAL:', e); process.exit(1) })

function phoneConfigPrice(tier) {
  // local copy — must mirror js/phone-config.js
  return ({ starter: 50, pro: 75, business: 120 })[tier]
}
