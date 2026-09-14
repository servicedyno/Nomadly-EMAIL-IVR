// Cart Abandonment Recovery System
// Detects when users reach a payment screen then cancel/back out
// Sends a follow-up nudge 45 minutes later with a coupon incentive
// Supports all 4 languages: English, French, Chinese, Hindi

const log = (...args) => console.log(new Date().toISOString().slice(11, 19), ...args)

// ─────────────────────────────────────────────────────────────────────
// PAYMENT_ACTIONS — the EXACT action values stored in MongoDB state
// These come from: set(state, chatId, 'action', '<value>') in _index.js
// ─────────────────────────────────────────────────────────────────────
const PAYMENT_ACTIONS = new Set([
  // Direct payment selection screens (user picks Crypto / Bank / Wallet)
  'domain-pay',
  'hosting-pay',
  'plan-pay',
  'phone-pay',
  'leads-pay',
  'vps-plan-pay',
  'vps-upgrade-plan-pay',
  'digital-product-pay',     // a.digitalProductPay value
  'virtual-card-pay',        // a.virtualCardPay value

  // Bank payment awaiting states (user selected Bank, waiting for completion)
  'bank-pay-domain',
  'bank-pay-hosting',
  'bank-pay-plan',
  'bank-pay-phone',
  'bank-pay-leads',
  'bank-pay-vps',
  'bank-pay-vps-upgrade',
  'bank-pay-digital-product',
  'bank-pay-virtual-card',
  'bank-pay-email-blast',

  // Crypto payment awaiting states (user selected Crypto, waiting for completion)
  'crypto-pay-domain',
  'crypto-pay-hosting',
  'crypto-pay-plan',
  'crypto-pay-phone',
  'crypto-pay-leads',
  'crypto-pay-vps',
  'crypto-pay-vps-upgrade',
  'crypto-pay-digital-product',
  'crypto-pay-virtual-card',

  // Wallet payment flow
  'walletSelectCurrency',
  'walletSelectCurrencyConfirm',
  'walletPayUsd',
  'walletPayNgn',

  // Deposit / Top-up flow
  'depositUSD',
  'depositNGN',
  'selectCryptoToDeposit',

  // Hosting / Plan payment flow
  'proceedWithPaymentProcess',
  'confirmUpgradeHostingPay',
  'hosting-apply-coupon',
  'confirmRenewNow',

  // VPS payment flow
  'proceedWithVpsPayment',
  'askVpsUpgradePayment',
  'confirmVPSRenewDetails',

  // Bundle payment
  'bundleConfirm',

  // Cloud Phone order
  'cpOrderSummary',
  'cpSubAddConfirm',
  'cpRenewPlan',

  // Email Validation / Blast
  'evConfirmPay',
  'ebPayment',

  // Domain selection (pre-payment, high intent)
  'choose-domain-to-buy',

  // Leads payment
  'targetLeadsConfirm',
])

// ── Multi-language cancel/back keywords ──────────────────────────────
// Exact-match words (after lowercasing + trimming)
const CANCEL_WORDS = new Set([
  // English
  'cancel', 'back',
  // French
  'annuler', 'retour',
  // Chinese
  '取消', '返回',
  // Hindi
  'रद्द करें', 'वापस',
])

// Prefix patterns — messages starting with these indicate back/cancel
const CANCEL_PREFIXES = ['⬅️', '🔙', '↩️', '❌']

// Substring patterns — if the message contains these, it's a cancel/back
const CANCEL_SUBSTRINGS = [
  // English
  'back to', 'cancel order', 'cancel & refund',
  // French
  'retour à', 'retour aux', 'retourner',
  // Chinese
  '返回到', '返回免费', '返回主机', '返回购买',
  // Hindi
  'वापस जाएं', 'वापस लें',
]

// Check if a message is a cancel/back from payment (multi-language smart matching)
function isPaymentCancelMessage(message) {
  if (!message) return false
  const msg = message.toLowerCase().trim()

  // 1. Exact match
  if (CANCEL_WORDS.has(msg)) return true

  // 2. Starts with cancel/back emoji prefix
  for (const prefix of CANCEL_PREFIXES) {
    if (msg.startsWith(prefix.toLowerCase())) return true
  }

  // 3. Contains cancel/back substring
  for (const sub of CANCEL_SUBSTRINGS) {
    if (msg.includes(sub.toLowerCase())) return true
  }

  return false
}

// ── Map action values to product categories ──────────────────────────
function actionToCategory(action) {
  if (!action) return 'general'
  const a = action.toLowerCase()

  // Domain
  if (a.includes('domain') && !a.includes('dns') && !a.includes('shorten') && !a.includes('manage'))
    return 'domain'

  // Hosting / Plan / VPS
  if (a.includes('hosting') || a === 'plan-pay' || a === 'bank-pay-plan' || a === 'crypto-pay-plan'
    || a === 'proceedwithpaymentprocess' || a === 'confirmupgradehostingpay'
    || a === 'hosting-apply-coupon' || a === 'confirmrenewnow')
    return 'hosting'

  // VPS
  if (a.includes('vps'))
    return 'hosting' // group VPS with hosting

  // Cloud Phone / IVR
  if (a.includes('phone') || a.includes('cpordersummary') || a.includes('cpsubadd')
    || a.includes('cprenew') || a.includes('ivr'))
    return 'cloudphone'

  // Virtual Card
  if (a.includes('virtual') || a.includes('card'))
    return 'virtualcard'

  // Wallet / Deposit
  if (a.includes('wallet') || a.includes('deposit') || a.includes('selectcryptotodeposit'))
    return 'wallet'

  // Digital Product
  if (a.includes('digital'))
    return 'digitalproduct'

  // Bundle
  if (a.includes('bundle'))
    return 'bundle'

  // Email services
  if (a.includes('email') || a.includes('ev') || a.includes('eb'))
    return 'digitalproduct' // group email services with digital products

  // Leads
  if (a.includes('lead') || a.includes('target'))
    return 'digitalproduct' // group leads with digital products

  return 'general'
}

// ── Nudge hook messages per category — all 4 languages ───────────────
// NOTE: the coupon line + working CTA are appended dynamically in sendNudge()
// (a live coupon code + a /start deep-link back to the product). We no longer
// tell users to "type /menu → 🎟️ Daily Coupon" — /menu was never a command and
// there is no Daily Coupon button, so that instruction dead-ended every nudge.
const NUDGE_MESSAGES = {
  domain: {
    en: '🌐 You were checking out a domain earlier — grab it before someone else does.',
    fr: '🌐 Vous regardiez un domaine plus tôt — réservez-le avant qu\'il ne parte.',
    zh: '🌐 您刚才在看一个域名 — 趁还没被注册赶快拿下。',
    hi: '🌐 आप पहले एक डोमेन देख रहे थे — किसी और के लेने से पहले इसे पा लें।',
  },
  hosting: {
    en: '🛡️ Still thinking about hosting? Our bulletproof hosting keeps your sites online no matter what.',
    fr: '🛡️ Vous hésitez pour l\'hébergement ? Notre hébergement anti-blocage garde vos sites en ligne.',
    zh: '🛡️ 还在考虑主机？我们的防封主机让您的网站始终在线。',
    hi: '🛡️ अभी भी होस्टिंग सोच रहे हैं? हमारी बुलेटप्रूफ होस्टिंग आपकी साइट्स को हर हाल में चालू रखती है।',
  },
  cloudphone: {
    en: '📞 Your Cloud IVR + SIP number is still waiting — real calls, SMS & voice menus.',
    fr: '📞 Votre numéro Cloud IVR + SIP vous attend — appels réels, SMS et menus vocaux.',
    zh: '📞 您的云IVR + SIP号码还在等您 — 真实通话、短信和语音菜单。',
    hi: '📞 आपका Cloud IVR + SIP नंबर अभी भी इंतज़ार कर रहा है — असली कॉल, SMS और वॉइस मेनू।',
  },
  virtualcard: {
    en: '💳 Need that virtual card? Perfect for online payments with full privacy.',
    fr: '💳 Besoin de cette carte virtuelle ? Parfaite pour les paiements en ligne en toute confidentialité.',
    zh: '💳 需要虚拟卡？完全隐私的在线支付利器。',
    hi: '💳 वर्चुअल कार्ड चाहिए? पूरी प्राइवेसी के साथ ऑनलाइन भुगतान के लिए एकदम सही।',
  },
  wallet: {
    en: '👛 Your wallet top-up didn\'t finish. Add funds now and unlock all services instantly.',
    fr: '👛 Votre recharge n\'a pas abouti. Ajoutez des fonds et débloquez tous les services.',
    zh: '👛 您的钱包充值未完成。立即充值，解锁所有服务。',
    hi: '👛 आपकी वॉलेट टॉप-अप पूरी नहीं हुई। अभी फंड जोड़ें और सभी सेवाएं तुरंत अनलॉक करें।',
  },
  digitalproduct: {
    en: '🛒 Still interested in that digital product? Verified sellers, instant delivery.',
    fr: '🛒 Toujours intéressé par ce produit numérique ? Vendeurs vérifiés, livraison instantanée.',
    zh: '🛒 还对那个数字产品感兴趣吗？认证卖家，即时交付。',
    hi: '🛒 उस डिजिटल प्रोडक्ट में अभी भी रुचि है? सत्यापित विक्रेता, तुरंत डिलीवरी।',
  },
  bundle: {
    en: '🎁 You were looking at a service bundle — combine services and save big!',
    fr: '🎁 Vous regardiez un pack de services — combinez les services et économisez !',
    zh: '🎁 您之前在看服务套餐 — 组合服务，大幅节省！',
    hi: '🎁 आप सर्विस बंडल देख रहे थे — सेवाएं मिलाकर बड़ी बचत करें!',
  },
  general: {
    en: '👋 Looks like you were about to make a purchase — come back and finish your order.',
    fr: '👋 On dirait que vous alliez faire un achat — revenez terminer votre commande.',
    zh: '👋 看起来你快要下单了 — 回来完成你的订单吧。',
    hi: '👋 लगता है आप खरीदारी करने वाले थे — वापस आकर अपना ऑर्डर पूरा करें।',
  }
}

// Live coupon line (shown only when the user actually has an active coupon).
const NUDGE_COUPON_LINE = {
  en: (code, pct) => `\n\n🎟️ <b>${pct}% OFF</b> waiting — coupon <code>${code}</code>. Enter it at checkout.`,
  fr: (code, pct) => `\n\n🎟️ <b>${pct}% DE RÉDUCTION</b> — coupon <code>${code}</code>. Saisissez-le au paiement.`,
  zh: (code, pct) => `\n\n🎟️ <b>${pct}% 折扣</b> 等您 — 优惠码 <code>${code}</code>。结账时输入。`,
  hi: (code, pct) => `\n\n🎟️ <b>${pct}% छूट</b> इंतज़ार कर रही है — कूपन <code>${code}</code>। चेकआउट पर दर्ज करें।`,
}

// Working call-to-action (a real /start deep-link back to the abandoned hub).
const NUDGE_CTA = {
  en: (link) => `\n\n👉 <a href="${link}">Tap here to finish your order</a>`,
  fr: (link) => `\n\n👉 <a href="${link}">Appuyez ici pour terminer votre commande</a>`,
  zh: (link) => `\n\n👉 <a href="${link}">点击这里完成订单</a>`,
  hi: (link) => `\n\n👉 <a href="${link}">अपना ऑर्डर पूरा करने के लिए यहां टैप करें</a>`,
}

// Map an abandoned-cart category → the /start deep-link payload that reopens it.
const CATEGORY_DEEPLINK = {
  domain: 'open_domains',
  hosting: 'open_hosting',
  cloudphone: 'open_cloudphone',
  virtualcard: 'open_vcard',
  digitalproduct: 'open_digital',
  bundle: 'open_bundle',
  wallet: 'open_wallet',
  general: '',
}

// ── Silent Abandonment Detection ─────────────────────────────────────
// If a user reaches a payment screen and doesn't interact for SILENT_TIMEOUT,
// treat it as abandonment (they closed the app without pressing Back/Cancel)
const SILENT_TIMEOUT_MS = 20 * 60 * 1000 // 20 minutes of silence = abandoned

function initCartAbandonment(bot, db, stateCol, onPaymentCompleted) {
  const abandonedCarts = db.collection('abandonedCarts')

  // Cooldown: don't nudge the same user more than once per 24 hours
  const NUDGE_COOLDOWN_MS = 24 * 60 * 60 * 1000
  // Delay before sending nudge after abandonment
  const NUDGE_DELAY_MS = 45 * 60 * 1000 // 45 minutes

  // Active nudge timers (chatId → timeout)
  const pendingNudges = new Map()
  // Silent abandonment timers (chatId → timeout)
  const silentTimers = new Map()

  // Record that a user reached a payment screen
  async function recordPaymentReached(chatId, action, productInfo = {}) {
    try {
      if (!PAYMENT_ACTIONS.has(action)) return

      await abandonedCarts.updateOne(
        { chatId: String(chatId) },
        {
          $set: {
            chatId: String(chatId),
            action,
            category: actionToCategory(action),
            productInfo,
            reachedAt: new Date(),
            status: 'in_progress',
            completed: false,
          }
        },
        { upsert: true }
      )

      // Start/reset silent abandonment timer
      startSilentTimer(chatId, action)

    } catch (err) {
      // Non-critical
    }
  }

  // Start a silent abandonment timer — if user goes quiet for 20 min at payment screen
  function startSilentTimer(chatId, action) {
    const cid = String(chatId)
    if (silentTimers.has(cid)) {
      clearTimeout(silentTimers.get(cid))
    }
    const timer = setTimeout(async () => {
      silentTimers.delete(cid)
      // Check if user is STILL at a payment action (didn't navigate away)
      try {
        const userState = await stateCol.findOne({ _id: cid })
        const currentAction = userState?.action
        if (PAYMENT_ACTIONS.has(currentAction)) {
          log(`[CartRecovery] Silent abandonment detected for ${cid} at action: ${currentAction}`)
          // Read language from state
          const lang = userState?.userLanguage || 'en'
          await recordAbandonment(cid, lang)
        }
      } catch (err) {
        // Non-critical
      }
    }, SILENT_TIMEOUT_MS)
    silentTimers.set(cid, timer)
  }

  // Record that a user completed payment — cancel all pending timers
  async function recordPaymentCompleted(chatId) {
    try {
      const cid = String(chatId)

      // Cancel any pending nudge
      if (pendingNudges.has(cid)) {
        clearTimeout(pendingNudges.get(cid))
        pendingNudges.delete(cid)
      }
      // Cancel silent timer
      if (silentTimers.has(cid)) {
        clearTimeout(silentTimers.get(cid))
        silentTimers.delete(cid)
      }

      await abandonedCarts.updateOne(
        { chatId: cid, status: { $in: ['in_progress', 'abandoned'] } },
        { $set: { status: 'completed', completed: true, completedAt: new Date() } }
      )
      log(`[CartRecovery] Payment completed for ${cid} — cart cleared`)
      // Redeem any coupon that was applied to this purchase (deferred burn — coupons are
      // only consumed on actual payment completion, never on a failed/abandoned attempt).
      if (typeof onPaymentCompleted === 'function') {
        try { await onPaymentCompleted(cid) } catch (e) { /* non-critical */ }
      }
    } catch (err) {
      // Non-critical
    }
  }

  // Record that a user abandoned at payment
  async function recordAbandonment(chatId, lang = 'en') {
    try {
      const cid = String(chatId)

      // Cancel silent timer since we're now recording the abandonment
      if (silentTimers.has(cid)) {
        clearTimeout(silentTimers.get(cid))
        silentTimers.delete(cid)
      }

      const cart = await abandonedCarts.findOne({ chatId: cid, status: 'in_progress' })
      if (!cart) return

      // Check cooldown — don't spam users
      const recentNudge = await abandonedCarts.findOne({
        chatId: cid,
        nudgedAt: { $gte: new Date(Date.now() - NUDGE_COOLDOWN_MS) }
      })
      if (recentNudge) {
        log(`[CartRecovery] Skipping ${cid} — nudged recently`)
        await abandonedCarts.updateOne({ _id: cart._id }, { $set: { status: 'abandoned_cooldown' } })
        return
      }

      await abandonedCarts.updateOne(
        { _id: cart._id },
        { $set: { status: 'abandoned', abandonedAt: new Date(), lang } }
      )

      log(`[CartRecovery] User ${cid} abandoned ${cart.category} (action: ${cart.action}). Scheduling nudge in ${NUDGE_DELAY_MS / 60000} min`)

      // Schedule nudge after delay
      scheduleNudge(cid, cart.category, lang, cart._id)

    } catch (err) {
      log(`[CartRecovery] Error recording abandonment: ${err.message}`)
    }
  }

  // Schedule a nudge timer
  function scheduleNudge(chatId, category, lang, cartId, delayMs = NUDGE_DELAY_MS) {
    const cid = String(chatId)
    if (pendingNudges.has(cid)) {
      clearTimeout(pendingNudges.get(cid))
    }
    const timer = setTimeout(async () => {
      pendingNudges.delete(cid)
      await sendNudge(cid, category, lang, cartId)
    }, delayMs)
    pendingNudges.set(cid, timer)
  }

  // Send follow-up nudge
  async function sendNudge(chatId, category, lang, cartId) {
    try {
      // Double-check the user didn't complete a purchase since
      const cart = await abandonedCarts.findOne({ _id: cartId })
      if (!cart || cart.status === 'completed') {
        log(`[CartRecovery] Skipping nudge for ${chatId} — cart already completed`)
        return
      }

      const hooks = NUDGE_MESSAGES[category] || NUDGE_MESSAGES.general
      const hook = hooks[lang] || hooks.en || NUDGE_MESSAGES.general.en

      // ── Live coupon: prefer the user's unused welcome-offer coupon, else today's daily coupon ──
      let couponLine = ''
      try {
        const cid = String(chatId)
        const now = new Date()
        const wc = await db.collection('welcomeCoupons').findOne({ chatId: cid, used: false, expiresAt: { $gt: now } })
        if (wc?.code) {
          couponLine = (NUDGE_COUPON_LINE[lang] || NUDGE_COUPON_LINE.en)(wc.code, wc.discount || 25)
        } else {
          const today = now.toISOString().slice(0, 10)
          const dc = await db.collection('dailyCoupons').findOne({ date: today })
          const code = dc?.codes ? Object.keys(dc.codes)[0] : null
          const pct = code ? dc.codes[code]?.discount : null
          if (code && pct) couponLine = (NUDGE_COUPON_LINE[lang] || NUDGE_COUPON_LINE.en)(code, pct)
        }
      } catch (_) { /* coupon lookup is best-effort */ }

      // ── Working /start deep-link back to the abandoned hub (replaces the dead "/menu") ──
      const botUser = process.env.BOT_USERNAME || 'Nomadlybot'
      const payload = CATEGORY_DEEPLINK[category] || ''
      const link = payload ? `https://t.me/${botUser}?start=${payload}` : `https://t.me/${botUser}?start`
      const cta = (NUDGE_CTA[lang] || NUDGE_CTA.en)(link)

      const message = `${hook}${couponLine}${cta}`

      await bot.sendMessage(chatId, message, { parse_mode: 'HTML', disable_web_page_preview: true })
      await abandonedCarts.updateOne({ _id: cartId }, { $set: { status: 'nudged', nudgedAt: new Date() } })
      log(`[CartRecovery] ✅ Nudged ${chatId} for ${category} abandonment (lang: ${lang})`)

      // Track stats
      await db.collection('cartRecoveryStats').updateOne(
        { date: new Date().toISOString().slice(0, 10) },
        { $inc: { nudgesSent: 1, [`categories.${category}`]: 1 } },
        { upsert: true }
      )
    } catch (err) {
      // Mark as nudge_failed so we don't retry forever
      if (cartId) {
        await abandonedCarts.updateOne({ _id: cartId }, { $set: { status: 'nudge_failed', nudgeError: err.message } }).catch(() => {})
      }
      log(`[CartRecovery] Nudge failed for ${chatId}: ${err.message}`)
    }
  }

  // ── Startup Recovery ──────────────────────────────────────────────
  // Re-schedule nudges for carts abandoned before server restart
  async function recoverPendingNudges() {
    try {
      const pendingCarts = await abandonedCarts.find({
        status: 'abandoned',
        abandonedAt: { $gte: new Date(Date.now() - NUDGE_DELAY_MS - 5 * 60 * 1000) }
      }).toArray()

      if (!pendingCarts.length) {
        log(`[CartRecovery] No pending nudges to recover`)
        return
      }

      let recovered = 0
      for (const cart of pendingCarts) {
        const elapsed = Date.now() - new Date(cart.abandonedAt).getTime()
        const remaining = NUDGE_DELAY_MS - elapsed

        if (remaining > 0) {
          scheduleNudge(cart.chatId, cart.category, cart.lang || 'en', cart._id, remaining)
          recovered++
        } else {
          // Delay already passed — send nudge soon (1 minute)
          scheduleNudge(cart.chatId, cart.category, cart.lang || 'en', cart._id, 60 * 1000)
          recovered++
        }
      }

      log(`[CartRecovery] Recovered ${recovered} pending nudges from before restart`)
    } catch (err) {
      log(`[CartRecovery] Recovery scan error: ${err.message}`)
    }
  }

  // Run recovery on startup (after a short delay to let bot fully initialize)
  setTimeout(() => recoverPendingNudges(), 30 * 1000)

  log(`[CartRecovery] Initialized — nudge delay: ${NUDGE_DELAY_MS / 60000}min, cooldown: ${NUDGE_COOLDOWN_MS / 3600000}h, silent timeout: ${SILENT_TIMEOUT_MS / 60000}min, languages: en/fr/zh/hi`)
  log(`[CartRecovery] Tracking ${PAYMENT_ACTIONS.size} payment action states`)

  return {
    recordPaymentReached,
    recordPaymentCompleted,
    recordAbandonment,
    isPaymentCancelMessage,
    PAYMENT_ACTIONS,
  }
}

module.exports = { initCartAbandonment }
