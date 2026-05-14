/* global process */
/**
 * Hosting Upgrade Credit Nudge
 *
 * Once a day, scans cPanel accounts and DMs the owner exactly 2 days before
 * their loyalty-credit window closes — patterned on `sendDay12UpgradeCreditNudges`
 * (the phone-plan equivalent in _index.js).
 *
 * Sweet spot (in DAYS since the cycle anchor = `lastRenewedAt || createdAt`):
 *   • Weekly plan       window=3  → fire on days 1.0–2.0
 *   • Premium monthly   window=14 → fire on days 12.0–13.0
 *
 * Idempotency:
 *   We stamp `creditNudgeAt: <Date>` on the account when sent. A renewal
 *   resets the anchor; if `creditNudgeAt < anchorDate`, the next cycle can
 *   nudge again. This keeps it ONE nudge per credit window naturally.
 */

const schedule = require('node-schedule')
const { log } = require('console')

const {
  getCycleAnchorDate,
  getCreditWindowDays,
  getBestUpgradeQuote,
} = require('./hosting-upgrade-credit')

const MS_PER_DAY = 24 * 60 * 60 * 1000

const { getPlanPrice } = require('./hosting-scheduler')

/**
 * Localized message bodies.
 * Falls back to English if the user's lang is missing.
 */
function buildMessage(lang, { domain, daysRemaining, planName, targetName, chargeAmount, originalPrice, creditApplied, deadlineStr }) {
  const daysLeftRounded = Math.max(1, Math.ceil(daysRemaining))
  const bodies = {
    en: `🎁 <b>${daysLeftRounded === 1 ? 'Last day' : `${daysLeftRounded} days left`} for your $${creditApplied.toFixed(2)} upgrade credit</b>\n\n` +
      `Your <b>${planName}</b> on <b>${domain}</b> still qualifies for a 50% loyalty credit.\n\n` +
      `Upgrade to <b>${targetName}</b> now for <b>$${chargeAmount.toFixed(2)}</b> ` +
      `(list $${originalPrice.toFixed(2)}, you save $${creditApplied.toFixed(2)}).\n\n` +
      `<i>Credit expires ${deadlineStr}. Open 🌐 My Hosting Plans → tap your domain → 🎁 Use $${creditApplied.toFixed(2)} credit.</i>`,
    fr: `🎁 <b>${daysLeftRounded === 1 ? 'Dernier jour' : `Plus que ${daysLeftRounded} jours`} pour votre crédit de $${creditApplied.toFixed(2)}</b>\n\n` +
      `Votre <b>${planName}</b> sur <b>${domain}</b> bénéficie encore d'un crédit fidélité de 50 %.\n\n` +
      `Passez à <b>${targetName}</b> maintenant pour <b>$${chargeAmount.toFixed(2)}</b> ` +
      `(prix normal $${originalPrice.toFixed(2)}, vous économisez $${creditApplied.toFixed(2)}).\n\n` +
      `<i>Le crédit expire le ${deadlineStr}. Ouvrez 🌐 Mes hébergements → appuyez sur votre domaine → 🎁 Utiliser le crédit.</i>`,
    zh: `🎁 <b>升级抵扣 $${creditApplied.toFixed(2)} ${daysLeftRounded === 1 ? '今天最后一天' : `还剩 ${daysLeftRounded} 天`}</b>\n\n` +
      `您在 <b>${domain}</b> 上的 <b>${planName}</b> 仍可享受 50% 忠诚抵扣。\n\n` +
      `立即升级到 <b>${targetName}</b>，仅需 <b>$${chargeAmount.toFixed(2)}</b> ` +
      `（原价 $${originalPrice.toFixed(2)}，节省 $${creditApplied.toFixed(2)}）。\n\n` +
      `<i>抵扣 ${deadlineStr} 到期。打开 🌐 我的托管套餐 → 点击您的域名 → 🎁 使用抵扣。</i>`,
    hi: `🎁 <b>$${creditApplied.toFixed(2)} अपग्रेड क्रेडिट के ${daysLeftRounded === 1 ? 'आज आखिरी दिन' : `${daysLeftRounded} दिन शेष`}</b>\n\n` +
      `<b>${domain}</b> पर आपका <b>${planName}</b> अभी भी 50% लॉयल्टी क्रेडिट के लिए योग्य है।\n\n` +
      `अभी <b>${targetName}</b> में अपग्रेड करें — केवल <b>$${chargeAmount.toFixed(2)}</b> ` +
      `(लिस्ट $${originalPrice.toFixed(2)}, आप $${creditApplied.toFixed(2)} बचाते हैं)।\n\n` +
      `<i>क्रेडिट ${deadlineStr} को समाप्त। 🌐 मेरे होस्टिंग प्लान्स खोलें → अपना डोमेन टैप करें → 🎁 क्रेडिट का उपयोग करें।</i>`,
  }
  return bodies[lang] || bodies.en
}

/**
 * Decide whether an account is in the "2 days before window closes" sweet spot.
 * Returns the daysSinceAnchor if eligible, otherwise null.
 */
function inSweetSpot(planDoc, now = new Date()) {
  const anchor = getCycleAnchorDate(planDoc)
  if (!anchor) return null
  const windowDays = getCreditWindowDays(planDoc?.plan)
  if (windowDays <= 0) return null
  const daysSince = (now.getTime() - anchor.getTime()) / MS_PER_DAY
  // Fire when there are roughly 1–2 days remaining in the window.
  // i.e. daysSince is in [windowDays - 2, windowDays - 1).
  // This catches every account exactly once even if the cron misses a day
  // (next day the account would have already-stamped `creditNudgeAt`).
  const lo = windowDays - 2
  const hi = windowDays - 1
  if (daysSince < lo) return null
  if (daysSince >= hi) return null
  return { daysSince, windowDays, anchor }
}

/**
 * Idempotency check — a nudge is already considered "sent for this cycle"
 * if `creditNudgeAt` is set AND it is *after* the current anchor date.
 */
function alreadyNudgedThisCycle(planDoc) {
  if (!planDoc?.creditNudgeAt) return false
  const stamp = new Date(planDoc.creditNudgeAt).getTime()
  const anchor = getCycleAnchorDate(planDoc)
  if (!anchor) return true // be conservative — don't double-send if anchor is gone
  return stamp >= anchor.getTime()
}

/**
 * Run one nudge sweep.
 *
 * @param {object} deps
 * @param {object} deps.bot                - node-telegram-bot-api instance
 * @param {object} deps.db                 - mongo DB handle
 * @param {Date}   [deps.now]              - override "now" (used by tests)
 * @returns {Promise<{ scanned, sent, errors }>}
 */
async function runNudgeSweep({ bot, db, now } = {}) {
  const cpanelAccounts = db.collection('cpanelAccounts')
  const stateCol = db.collection('state')
  const _now = now instanceof Date ? now : new Date()

  let scanned = 0
  let sent = 0
  let errors = 0

  try {
    // Narrow query: only plans with an upgrade path (weekly OR premium-monthly,
    // never golden). The /week/i regex matches "Premium Anti-Red (1-Week)"
    // and the (premium ... 30 days) regex matches the monthly cPanel plan.
    const cursor = cpanelAccounts.find(
      {
        $or: [
          { plan: /week/i },
          { plan: /premium.*30\s*days/i },
        ],
        // Exclude already-cancelled / dead accounts
        cancelled: { $ne: true },
        suspended: { $ne: true },
      },
      { projection: { _id: 1, chatId: 1, domain: 1, plan: 1, createdAt: 1, lastRenewedAt: 1, creditNudgeAt: 1 } }
    )

    while (await cursor.hasNext()) {
      const acct = await cursor.next()
      scanned += 1

      // Must be in the sweet spot
      const spot = inSweetSpot(acct, _now)
      if (!spot) continue

      // Skip if we already nudged this cycle
      if (alreadyNudgedThisCycle(acct)) continue

      // Need a non-null upgrade quote (price > 0 etc.)
      const oldPrice = getPlanPrice(acct.plan)
      const best = getBestUpgradeQuote({ planDoc: acct, oldPrice, now: _now })
      if (!best || best.quote.creditApplied <= 0) continue

      try {
        const userState = await stateCol.findOne({ _id: String(acct.chatId) }).catch(() => null)
        const lang = userState?.userLanguage || 'en'
        const deadlineStr = best.deadlineDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

        const body = buildMessage(lang, {
          domain: acct.domain,
          daysRemaining: best.daysRemaining,
          planName: acct.plan,
          targetName: best.target.name,
          chargeAmount: best.quote.chargeAmount,
          originalPrice: best.quote.originalPrice,
          creditApplied: best.quote.creditApplied,
          deadlineStr,
        })

        await bot.sendMessage(acct.chatId, body, { parse_mode: 'HTML' })

        // Stamp atomically to prevent double-send if two workers race
        await cpanelAccounts.updateOne(
          { _id: acct._id },
          { $set: { creditNudgeAt: new Date() } }
        )
        sent += 1
        log(`[HostingUpgradeNudge] Sent ${acct.chatId} · ${acct.domain} · ${acct.plan} → ${best.target.name} · $${best.quote.creditApplied.toFixed(2)} credit · ${spot.daysSince.toFixed(2)}d in`)
      } catch (innerErr) {
        errors += 1
        log(`[HostingUpgradeNudge] Send failed for ${acct.chatId}/${acct.domain}: ${innerErr.message}`)
      }
    }
  } catch (e) {
    errors += 1
    log(`[HostingUpgradeNudge] Sweep error: ${e.message}`)
  }

  if (sent > 0 || errors > 0) {
    log(`[HostingUpgradeNudge] Cycle complete — scanned:${scanned} sent:${sent} errors:${errors}`)
  }
  return { scanned, sent, errors }
}

/**
 * Initialize the daily cron. Patterned on `sendDay12UpgradeCreditNudges` —
 * runs at 14:15 UTC (15 minutes after the phone nudge to avoid spiking
 * outbound Telegram API at the same instant).
 */
function init({ bot, db }) {
  schedule.scheduleJob('15 14 * * *', () => runNudgeSweep({ bot, db }))
  log('[HostingUpgradeNudge] Initialized — daily at 14:15 UTC')
}

module.exports = {
  init,
  runNudgeSweep,
  // exported for tests
  inSweetSpot,
  alreadyNudgedThisCycle,
  buildMessage,
}
