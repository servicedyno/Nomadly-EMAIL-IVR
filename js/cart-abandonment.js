// Cart Abandonment Recovery System
// Detects when users reach a payment screen then cancel/back out
// Sends a follow-up nudge 30-60 minutes later with a coupon incentive

const log = (...args) => console.log(new Date().toISOString().slice(11, 19), ...args)

// Payment-related action states (when user is at a payment screen)
const PAYMENT_ACTIONS = new Set([
  'domainSelectPayment', 'domainPay', 'domainPayConfirm',
  'hostingSelectPayment', 'hostingPay',
  'vpsPay', 'vpsPayConfirm', 'proceedWithVpsPayment', 'askVpsUpgradePayment',
  'virtualCardPay', 'vcSelectCrypto', 'vcPayConfirm',
  'digitalProductPay', 'dpSelectCrypto', 'dpPayConfirm',
  'selectPaymentMethod', 'proceedWithPaymentProcess',
  'cloudPhonePay', 'cpSelectPayment',
  'bundlePay', 'bundleSelectPayment',
  'walletSelectCurrency', 'walletSelectCurrencyConfirm',
  'depositUSD', 'depositNGN', 'selectCryptoToDeposit',
  'confirmUpgradeHostingPay',
  'emailValidationPay', 'emailBulkPay',
  'leadsPayment', 'leadsSelectPayment'
])

// Cancel/Back messages that indicate abandonment
const CANCEL_MESSAGES = new Set([
  'cancel', 'back', '🔙 back', '↩️ back', '⬅️ back', '❌ cancel', '❌ cancel order'
])

// Nudge messages per product category
const NUDGE_MESSAGES = {
  domain: {
    en: '🌐 Hey! You were checking out a domain earlier. It might not be available for long.\n\n💡 Use your daily coupon for a discount — just type /menu and look for 🎟️ Daily Coupon!',
    fr: '🌐 Hé ! Vous regardiez un domaine plus tôt. Il pourrait ne plus être disponible longtemps.\n\n💡 Utilisez votre coupon quotidien pour une réduction !',
  },
  hosting: {
    en: '🛡️ Still thinking about hosting? Our bulletproof hosting keeps your sites running no matter what.\n\n💡 Check your daily coupon for a discount — /menu → 🎟️ Daily Coupon',
    fr: '🛡️ Vous hésitez encore pour l\'hébergement ? Notre hébergement anti-blocage garde vos sites en ligne.\n\n💡 Vérifiez votre coupon quotidien !',
  },
  cloudphone: {
    en: '📞 Your Cloud IVR plan is still waiting! Make unlimited calls with custom voice menus.\n\n💡 Grab your daily coupon for savings — /menu → 🎟️ Daily Coupon',
  },
  virtualcard: {
    en: '💳 Need that virtual card? Perfect for online payments with full privacy.\n\n💡 Daily coupon available — /menu → 🎟️ Daily Coupon',
  },
  wallet: {
    en: '👛 Your wallet deposit didn\'t go through. Top up now and unlock all services instantly.\n\n💡 Check your daily coupon — /menu → 🎟️ Daily Coupon',
  },
  general: {
    en: '👋 Looks like you were about to make a purchase! Come back and finish your order.\n\n💡 Your daily coupon is waiting — /menu → 🎟️ Daily Coupon',
    fr: '👋 On dirait que vous alliez faire un achat ! Revenez terminer votre commande.\n\n💡 Votre coupon quotidien vous attend !',
    zh: '👋 看起来你要购买了！回来完成你的订单吧。\n\n💡 你的每日优惠券正在等你！',
    hi: '👋 लगता है आप खरीदारी करने वाले थे! वापस आकर अपना ऑर्डर पूरा करें।\n\n💡 आपका दैनिक कूपन इंतज़ार कर रहा है!',
  }
}

// Map action names to product categories
function actionToCategory(action) {
  if (!action) return 'general'
  const a = action.toLowerCase()
  if (a.includes('domain')) return 'domain'
  if (a.includes('hosting') || a.includes('vps') || a.includes('antired')) return 'hosting'
  if (a.includes('cloud') || a.includes('phone') || a.includes('ivr') || a.includes('sip')) return 'cloudphone'
  if (a.includes('virtual') || a.includes('vcard') || a.includes('vc')) return 'virtualcard'
  if (a.includes('wallet') || a.includes('deposit')) return 'wallet'
  return 'general'
}

function initCartAbandonment(bot, db, stateCol) {
  const abandonedCarts = db.collection('abandonedCarts')

  // Cooldown: don't nudge the same user more than once per 24 hours
  const NUDGE_COOLDOWN_MS = 24 * 60 * 60 * 1000
  // Delay before sending nudge after abandonment
  const NUDGE_DELAY_MS = 45 * 60 * 1000 // 45 minutes

  // Active nudge timers (chatId → timeout)
  const pendingNudges = new Map()

  // Record that a user reached a payment screen
  async function recordPaymentReached(chatId, action, productInfo = {}) {
    try {
      if (!PAYMENT_ACTIONS.has(action)) return

      await abandonedCarts.updateOne(
        { chatId },
        {
          $set: {
            chatId,
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
    } catch (err) {
      // Non-critical
    }
  }

  // Record that a user completed payment
  async function recordPaymentCompleted(chatId) {
    try {
      // Cancel any pending nudge
      if (pendingNudges.has(chatId)) {
        clearTimeout(pendingNudges.get(chatId))
        pendingNudges.delete(chatId)
      }
      await abandonedCarts.updateOne(
        { chatId, status: 'in_progress' },
        { $set: { status: 'completed', completed: true, completedAt: new Date() } }
      )
    } catch (err) {
      // Non-critical
    }
  }

  // Record that a user abandoned at payment
  async function recordAbandonment(chatId, lang = 'en') {
    try {
      const cart = await abandonedCarts.findOne({ chatId, status: 'in_progress' })
      if (!cart) return

      // Check cooldown — don't spam users
      const recentNudge = await abandonedCarts.findOne({
        chatId,
        nudgedAt: { $gte: new Date(Date.now() - NUDGE_COOLDOWN_MS) }
      })
      if (recentNudge) {
        log(`[CartRecovery] Skipping ${chatId} — nudged recently`)
        await abandonedCarts.updateOne({ _id: cart._id }, { $set: { status: 'abandoned_cooldown' } })
        return
      }

      await abandonedCarts.updateOne(
        { _id: cart._id },
        { $set: { status: 'abandoned', abandonedAt: new Date(), lang } }
      )

      log(`[CartRecovery] User ${chatId} abandoned ${cart.category} (action: ${cart.action}). Scheduling nudge in ${NUDGE_DELAY_MS / 60000} min`)

      // Schedule nudge after delay
      if (pendingNudges.has(chatId)) {
        clearTimeout(pendingNudges.get(chatId))
      }
      const timer = setTimeout(async () => {
        pendingNudges.delete(chatId)
        await sendNudge(chatId, cart.category, lang, cart._id)
      }, NUDGE_DELAY_MS)
      pendingNudges.set(chatId, timer)

    } catch (err) {
      log(`[CartRecovery] Error recording abandonment: ${err.message}`)
    }
  }

  // Send follow-up nudge
  async function sendNudge(chatId, category, lang, cartId) {
    try {
      // Double-check the user didn't complete a purchase since
      const cart = await abandonedCarts.findOne({ _id: cartId })
      if (!cart || cart.status === 'completed') return

      const messages = NUDGE_MESSAGES[category] || NUDGE_MESSAGES.general
      const message = messages[lang] || messages.en || NUDGE_MESSAGES.general.en

      await bot.sendMessage(chatId, message, { parse_mode: 'HTML', disable_web_page_preview: true })
      await abandonedCarts.updateOne({ _id: cartId }, { $set: { status: 'nudged', nudgedAt: new Date() } })
      log(`[CartRecovery] ✅ Nudged ${chatId} for ${category} abandonment`)

      // Track stats
      await db.collection('cartRecoveryStats').updateOne(
        { date: new Date().toISOString().slice(0, 10) },
        { $inc: { nudgesSent: 1, [`categories.${category}`]: 1 } },
        { upsert: true }
      )
    } catch (err) {
      log(`[CartRecovery] Nudge failed for ${chatId}: ${err.message}`)
    }
  }

  // Check if a message is a cancel/back from payment
  function isPaymentCancelMessage(message) {
    return CANCEL_MESSAGES.has((message || '').toLowerCase().trim())
  }

  log(`[CartRecovery] Initialized — nudge delay: ${NUDGE_DELAY_MS / 60000}min, cooldown: ${NUDGE_COOLDOWN_MS / 3600000}h`)

  return {
    recordPaymentReached,
    recordPaymentCompleted,
    recordAbandonment,
    isPaymentCancelMessage,
    PAYMENT_ACTIONS,
  }
}

module.exports = { initCartAbandonment }
