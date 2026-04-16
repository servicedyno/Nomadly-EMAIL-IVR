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
      _id: parseFloat(chatId),
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
      { _id: parseFloat(chatId) },
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
      intro: 'We\'re a complete digital services platform. Here\'s what you can do:',
      services: [
        '🌐 <b>Domain Registration</b> - From $30/year',
        '🏠 <b>Web Hosting</b> - Starting at $4.99/mo',
        '📱 <b>Cloud Phone Numbers</b> - US & International',
        '🔗 <b>URL Shortener</b> - 10 free links to start',
        '📧 <b>Professional Email</b> - your@domain.com',
        '🛡️ <b>DDoS Protection</b> - Keep your site secure'
      ],
      popular: '\n✨ <b>Most popular first step:</b>\nGet 10 Free Short Links (No credit card needed!)',
      buttons: {
        claim: '✨ Claim Free Links',
        tour: '🎬 Watch Tour',
        browse: '📱 Browse All Services',
        skip: '⏭️ Skip Intro'
      }
    },
    fr: {
      title: `👋 Bienvenue sur ${botName} !`,
      intro: 'Nous sommes une plateforme complète de services numériques. Voici ce que vous pouvez faire :',
      services: [
        '🌐 <b>Enregistrement de domaine</b> - À partir de 30$/an',
        '🏠 <b>Hébergement Web</b> - À partir de 4,99$/mois',
        '📱 <b>Numéros de téléphone cloud</b> - US et international',
        '🔗 <b>Raccourcisseur d\'URL</b> - 10 liens gratuits pour commencer',
        '📧 <b>Email professionnel</b> - vous@domaine.com',
        '🛡️ <b>Protection DDoS</b> - Sécurisez votre site'
      ],
      popular: '\n✨ <b>Première étape la plus populaire :</b>\nObtenez 10 liens courts gratuits (Aucune carte de crédit requise !)',
      buttons: {
        claim: '✨ Réclamer des liens gratuits',
        tour: '🎬 Regarder la visite',
        browse: '📱 Parcourir tous les services',
        skip: '⏭️ Passer l\'intro'
      }
    },
    zh: {
      title: `👋 欢迎来到 ${botName}！`,
      intro: '我们是一个完整的数字服务平台。以下是您可以做的：',
      services: [
        '🌐 <b>域名注册</b> - 每年 $30 起',
        '🏠 <b>虚拟主机</b> - 每月 $4.99 起',
        '📱 <b>云电话号码</b> - 美国和国际',
        '🔗 <b>URL 短链接</b> - 10 个免费链接开始',
        '📧 <b>专业电子邮件</b> - 您的@域名.com',
        '🛡️ <b>DDoS 保护</b> - 保护您的网站安全'
      ],
      popular: '\n✨ <b>最受欢迎的第一步：</b>\n获得 10 个免费短链接（无需信用卡！）',
      buttons: {
        claim: '✨ 领取免费链接',
        tour: '🎬 观看导览',
        browse: '📱 浏览所有服务',
        skip: '⏭️ 跳过介绍'
      }
    },
    hi: {
      title: `👋 ${botName} में आपका स्वागत है!`,
      intro: 'हम एक संपूर्ण डिजिटल सेवा प्लेटफ़ॉर्म हैं। यहाँ आप क्या कर सकते हैं:',
      services: [
        '🌐 <b>डोमेन पंजीकरण</b> - $30/वर्ष से',
        '🏠 <b>वेब होस्टिंग</b> - $4.99/माह से शुरू',
        '📱 <b>क्लाउड फोन नंबर</b> - यूएस और अंतर्राष्ट्रीय',
        '🔗 <b>URL शॉर्टनर</b> - शुरू करने के लिए 10 मुफ्त लिंक',
        '📧 <b>व्यावसायिक ईमेल</b> - आपका@डोमेन.com',
        '🛡️ <b>DDoS सुरक्षा</b> - अपनी साइट को सुरक्षित रखें'
      ],
      popular: '\n✨ <b>सबसे लोकप्रिय पहला कदम:</b>\n10 मुफ्त शॉर्ट लिंक प्राप्त करें (क्रेडिट कार्ड की आवश्यकता नहीं!)',
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
