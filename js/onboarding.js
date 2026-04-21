/**
 * New User Onboarding Flow
 * Guides first-time users through the platform
 */

/**
 * Check if user has completed onboarding
 */
async function hasCompletedOnboarding(db, chatId) {
  try {
    const user = await db.collection('users').findOne({ 
      _id: String(chatId),
      hasCompletedOnboarding: true
    })
    return !!user
  } catch (err) {
    console.error('[Onboarding] Check error:', err.message)
    return false // Assume not completed on error, show onboarding
  }
}

/**
 * Mark onboarding as complete
 */
async function markOnboardingComplete(db, chatId) {
  try {
    await db.collection('users').updateOne(
      { _id: String(chatId) },
      { 
        $set: { 
          hasCompletedOnboarding: true,
          onboardingCompletedAt: new Date()
        } 
      },
      { upsert: true }
    )
    return true
  } catch (err) {
    console.error('[Onboarding] Mark complete error:', err.message)
    return false
  }
}

/**
 * Generate onboarding welcome message
 */
function getOnboardingMessage(botName, lang = 'en') {
  const messages = {
    en: {
      title: `👋 Welcome to ${botName}!`,
      intro: 'Digital services platform',
      services: [
        '🌐 Domains — $30/year',
        '🏠 Anti-Red Hosting — $30/week',
        '📱 Cloud Phones',
        '🔗 URL Shortener — 5 free links',
      ],
      popular: '\n✨ <b>Start free:</b> Get 5 short links',
      buttons: {
        claim: '✨ Claim Free Links',
        tour: '🎬 Watch Tour',
        browse: '📱 Browse All Services',
        skip: '⏭️ Skip Intro'
      }
    },
    fr: {
      title: `👋 Bienvenue sur ${botName} !`,
      intro: 'Plateforme de services numériques',
      services: [
        '🌐 Domaines — 30$/an',
        '🏠 Hébergement Anti-Red — 30$/semaine',
        '📱 Téléphones Cloud',
        '🔗 Raccourcisseur URL — 5 liens gratuits',
      ],
      popular: '\n✨ <b>Commencer gratuitement:</b> Obtenez 5 liens courts',
      buttons: {
        claim: '✨ Réclamer des liens gratuits',
        tour: '🎬 Regarder la visite',
        browse: '📱 Parcourir tous les services',
        skip: '⏭️ Passer l\'intro'
      }
    },
    zh: {
      title: `👋 欢迎来到 ${botName}！`,
      intro: '数字服务平台',
      services: [
        '🌐 域名 — 每年 $30',
        '🏠 Anti-Red主机 — 每周 $30',
        '📱 云电话',
        '🔗 URL短链接 — 5个免费',
      ],
      popular: '\n✨ <b>免费开始:</b> 获取5个短链接',
      buttons: {
        claim: '✨ 领取免费链接',
        tour: '🎬 观看导览',
        browse: '📱 浏览所有服务',
        skip: '⏭️ 跳过介绍'
      }
    },
    hi: {
      title: `👋 ${botName} में आपका स्वागत है!`,
      intro: 'डिजिटल सेवा मंच',
      services: [
        '🌐 डोमेन — $30/वर्ष',
        '🏠 Anti-Red होस्टिंग — $30/सप्ताह',
        '📱 क्लाउड फोन',
        '🔗 URL शॉर्टनर — 5 मुफ्त',
      ],
      popular: '\n✨ <b>मुफ्त शुरू करें:</b> 5 शॉर्ट लिंक प्राप्त करें',
      buttons: {
        claim: '✨ मुफ्त लिंक का दावा करें',
        tour: '🎬 टूर देखें',
        browse: '📱 सभी सेवाएं ब्राउज़ करें',
        skip: '⏭️ परिचय छोड़ें'
      }
    }
  }

  const t = messages[lang] || messages.en

  let message = `${t.title}\n\n${t.intro}\n\n`
  t.services.forEach(service => {
    message += `${service}\n`
  })
  message += t.popular

  return {
    message,
    keyboard: [
      [t.buttons.claim],
      [t.buttons.tour, t.buttons.browse],
      [t.buttons.skip]
    ]
  }
}

/**
 * Show onboarding to new user
 */
async function showOnboarding(bot, chatId, botName, lang = 'en') {
  const { message, keyboard } = getOnboardingMessage(botName, lang)
  
  try {
    await bot.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      reply_markup: {
        keyboard: keyboard.map(row => row.map(text => ({ text }))),
        resize_keyboard: true,
        one_time_keyboard: false
      }
    })
    return true
  } catch (err) {
    console.error('[Onboarding] Show error:', err.message)
    return false
  }
}

module.exports = {
  hasCompletedOnboarding,
  markOnboardingComplete,
  getOnboardingMessage,
  showOnboarding
}
