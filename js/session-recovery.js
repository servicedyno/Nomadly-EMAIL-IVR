/**
 * Session Recovery System
 * Allows users to resume interrupted flows
 */

/**
 * Save resumable session to database
 */
async function saveResumableSession(db, chatId, flowData) {
  const {
    flowType, // 'domain-purchase', 'hosting-setup', 'phone-order', etc.
    step, // Current step in flow
    data, // Flow-specific data
    expiresAt = null // Optional expiration
  } = flowData

  const session = {
    _id: `resume_${chatId}`,
    chatId: parseFloat(chatId),
    flowType,
    step,
    data,
    createdAt: new Date(),
    updatedAt: new Date(),
    expiresAt: expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours default
  }

  try {
    await db.collection('resumableSessions').updateOne(
      { _id: session._id },
      { $set: session },
      { upsert: true }
    )
    console.log(`[SessionRecovery] Saved ${flowType} session for ${chatId}`)
    return true
  } catch (err) {
    console.error('[SessionRecovery] Failed to save session:', err.message)
    return false
  }
}

/**
 * Get resumable session for user
 */
async function getResumableSession(db, chatId) {
  try {
    const session = await db.collection('resumableSessions').findOne({
      _id: `resume_${chatId}`,
      expiresAt: { $gt: new Date() }
    })
    return session
  } catch (err) {
    console.error('[SessionRecovery] Failed to get session:', err.message)
    return null
  }
}

/**
 * Clear resumable session
 */
async function clearResumableSession(db, chatId) {
  try {
    await db.collection('resumableSessions').deleteOne({ _id: `resume_${chatId}` })
    console.log(`[SessionRecovery] Cleared session for ${chatId}`)
    return true
  } catch (err) {
    console.error('[SessionRecovery] Failed to clear session:', err.message)
    return false
  }
}

/**
 * Generate resume prompt for user
 */
function generateResumePrompt(session, lang = 'en') {
  const flowNames = {
    en: {
      'domain-purchase': 'Domain Purchase',
      'hosting-setup': 'Hosting Setup',
      'phone-order': 'Phone Number Order',
      'wallet-topup': 'Wallet Top-Up',
      'leads-purchase': 'Leads Purchase',
      'vps-order': 'VPS Order'
    },
    fr: {
      'domain-purchase': 'Achat de domaine',
      'hosting-setup': 'Configuration hébergement',
      'phone-order': 'Commande de numéro',
      'wallet-topup': 'Recharge portefeuille',
      'leads-purchase': 'Achat de leads',
      'vps-order': 'Commande VPS'
    },
    zh: {
      'domain-purchase': '域名购买',
      'hosting-setup': '主机设置',
      'phone-order': '电话号码订购',
      'wallet-topup': '钱包充值',
      'leads-purchase': '潜在客户购买',
      'vps-order': 'VPS 订购'
    },
    hi: {
      'domain-purchase': 'डोमेन खरीद',
      'hosting-setup': 'होस्टिंग सेटअप',
      'phone-order': 'फोन नंबर ऑर्डर',
      'wallet-topup': 'वॉलेट टॉप-अप',
      'leads-purchase': 'लीड्स खरीद',
      'vps-order': 'VPS ऑर्डर'
    }
  }

  const messages = {
    en: {
      title: '👋 Welcome back!',
      incomplete: 'You have an incomplete',
      resume: '✅ Resume Where I Left Off',
      startFresh: '🆕 Start Fresh'
    },
    fr: {
      title: '👋 Bon retour !',
      incomplete: 'Vous avez un',
      resume: '✅ Reprendre où j\'ai laissé',
      startFresh: '🆕 Recommencer'
    },
    zh: {
      title: '👋 欢迎回来！',
      incomplete: '您有一个未完成的',
      resume: '✅ 从我离开的地方继续',
      startFresh: '🆕 重新开始'
    },
    hi: {
      title: '👋 वापसी पर स्वागत है!',
      incomplete: 'आपके पास एक अधूरा है',
      resume: '✅ जहां छोड़ा था वहीं से शुरू करें',
      startFresh: '🆕 नए सिरे से शुरू करें'
    }
  }

  const t = messages[lang] || messages.en
  const flowName = (flowNames[lang] || flowNames.en)[session.flowType] || session.flowType

  // Generate details based on flow type
  let details = ''
  if (session.data.domain) {
    details = `Domain: <b>${session.data.domain}</b>`
  } else if (session.data.phone) {
    details = `Phone: <b>${session.data.phone}</b>`
  } else if (session.data.amount) {
    details = `Amount: <b>$${session.data.amount}</b>`
  }

  const message = `${t.title}\n\n` +
    `${t.incomplete} <b>${flowName}</b>:\n` +
    (details ? `${details}\n` : '') +
    `\nWould you like to resume?`

  return {
    message,
    keyboard: [
      [t.resume],
      [t.startFresh]
    ]
  }
}

/**
 * Update session progress
 */
async function updateSessionProgress(db, chatId, newData) {
  try {
    await db.collection('resumableSessions').updateOne(
      { _id: `resume_${chatId}` },
      { 
        $set: { 
          data: newData,
          updatedAt: new Date()
        } 
      }
    )
    return true
  } catch (err) {
    console.error('[SessionRecovery] Failed to update session:', err.message)
    return false
  }
}

module.exports = {
  saveResumableSession,
  getResumableSession,
  clearResumableSession,
  generateResumePrompt,
  updateSessionProgress
}
