// Auto-Promo System - Sends 1 daily promotional message to bot users
// Rotates service focus: Mon=CloudPhone, Tue=DigitalProducts, Wed=Leads, Thu=Domains, Fri=Showcase
// AI-powered dynamic messages with static fallback + admin alerts + daily coupons

const schedule = require('node-schedule')
const { log } = require('console')
const BROADCAST_CONFIG = require('./broadcast-config.js')

// OpenAI - optional dependency (graceful fallback if missing)
let OpenAI = null
try { OpenAI = require('openai') } catch { log('[AutoPromo] openai package not installed, using static messages only') }

// OpenAI client (lazy init)
let openai = null
function getOpenAI() {
  if (!openai && OpenAI && process.env.APP_OPEN_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.APP_OPEN_API_KEY })
  }
  return openai
}

// Banner images for each promo theme
const PROMO_BANNERS = {
  showcase_morning: null, // Uses animated GIF via sendAnimation
  showcase_afternoon: null, // Text-only promo
}

// Language names for AI prompt
const LANG_NAMES = { en: 'English', fr: 'French', zh: 'Chinese (Simplified)', hi: 'Hindi' }

// Service details for AI context (keeps promos accurate)
const SERVICE_CONTEXT = {
  showcase_morning: {
    services: 'Nomadly Bot — all-in-one digital toolkit',
    details: [
      'Offshore DMCA-ignored domains: 400+ TLDs, free .sbs/.xyz with plans',
      'Shortit URL Shortener: 5 free trial links, custom branded URLs, analytics',
      'CloudPhone by SpeechCue: virtual numbers in 30+ countries, IVR, SMS, SIP — from $5/mo',
      'Digital Products: Twilio ($200-$450), Telnyx ($150-$400), AWS ($150-$400), Google Cloud ($300), Google Workspace ($100-$150), Zoho Mail ($100-$150), eSIM T-Mobile ($60) — all delivered in 30 min',
    ],
    cta: '/start',
    crossPromo: '',
  },
  showcase_afternoon: {
    services: 'Nomadly Bot — all-in-one digital toolkit',
    details: [
      'Offshore DMCA-ignored domains: 400+ TLDs, free .sbs/.xyz with plans',
      'Shortit URL Shortener: 5 free trial links, custom branded URLs, analytics',
      'CloudPhone by SpeechCue: virtual numbers in 30+ countries, IVR, SMS, SIP — from $5/mo',
      'Digital Products: Twilio ($200-$450), Telnyx ($150-$400), AWS ($150-$400), Google Cloud ($300), Google Workspace ($100-$150), Zoho Mail ($100-$150), eSIM T-Mobile ($60) — all delivered in 30 min',
      'Pay with crypto, bank, or wallet',
    ],
    cta: '/start',
    crossPromo: '',
  },
}

/**
 * Sanitize AI output for Telegram HTML
 */
function sanitizeForTelegram(text) {
  let s = text
  s = s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
  s = s.replace(/__(.+?)__/g, '<b>$1</b>')
  s = s.replace(/(?<!\w)\*([^*\n]+?)\*(?!\w)/g, '<i>$1</i>')
  s = s.replace(/(?<!\w)_([^_\n]+?)_(?!\w)/g, '<i>$1</i>')
  s = s.replace(/`([^`\n]+?)`/g, '<code>$1</code>')
  s = s.replace(/^#{1,3}\s+/gm, '')
  s = s.replace(/<(?!\/?(?:b|i|u|s|code|pre|a)\b)[^>]*>/gi, '')
  for (const tag of ['b', 'i', 'code']) {
    const opens = (s.match(new RegExp(`<${tag}>`, 'gi')) || []).length
    const closes = (s.match(new RegExp(`</${tag}>`, 'gi')) || []).length
    for (let i = 0; i < opens - closes; i++) s += `</${tag}>`
    if (closes > opens) {
      let excess = closes - opens
      s = s.replace(new RegExp(`</${tag}>`, 'gi'), (match) => {
        if (excess > 0) { excess--; return '' }
        return match
      })
    }
  }
  return s.trim()
}

/**
 * Generate a dynamic promo message using OpenAI (shorter ~300 chars)
 */
async function generateDynamicPromo(theme, lang) {
  const ai = getOpenAI()
  if (!ai) return null

  const ctx = SERVICE_CONTEXT[theme]
  const langName = LANG_NAMES[lang] || 'English'

  const prompt = `You are a Telegram bot copywriter. Create a unique, persuasive promotional message for ${ctx.services}.

Key services to highlight:
${ctx.details.map(d => '- ' + d).join('\n')}

Requirements:
- Write in ${langName}
- Use ONLY <b>bold</b> and <code>code</code> HTML tags (no other formatting)
- Start with a compelling <b>HEADLINE</b> that grabs attention
- Highlight ONE key benefit or unique value proposition
- Keep the message concise (under 400 characters)
- End with a clear call-to-action: type <b>/start</b> to explore
- Be creative and vary your approach each time
- Focus on benefits, not just features
- Do NOT mention hosting, VPS, RDP, leads, or @hostbay_bot
- No emoji characters

Return ONLY the promotional message text.`

  try {
    const res = await ai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 250,
      temperature: 0.9,
    })
    let content = res.choices?.[0]?.message?.content?.trim()
    if (!content || content.length < 30) {
      log(`[AutoPromo] OpenAI returned empty or too short content for ${theme}/${lang}`)
      return null
    }
    content = sanitizeForTelegram(content)
    if (content.length <= 1024) return content
    const truncated = content.substring(0, 500)
    const lastNewline = truncated.lastIndexOf('\n')
    return sanitizeForTelegram(lastNewline > 200 ? truncated.substring(0, lastNewline) : truncated)
  } catch (error) {
    log(`[AutoPromo] OpenAI error for ${theme}/${lang}: ${error.message}`)
    if (error.response) {
      log(`[AutoPromo] OpenAI response status: ${error.response.status}, data: ${JSON.stringify(error.response.data)}`)
    }
    return null
  }
}

// Timezone offsets per language
const TIMEZONE_OFFSETS = { en: 0, fr: 1, zh: 8, hi: 5.5 }
const LOCAL_TIMES = [{ hour: 10, minute: 0 }]
const THEMES = ['showcase_morning', 'showcase_afternoon']
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

// ─── Promo Messages — All-Product Showcase ──────────────────────────

const promoMessages = {
  en: {
    showcase_morning: [
      `<b>BUILD YOUR DIGITAL EMPIRE — ALL IN ONE PLACE</b>

<b>Offshore Domains</b> — Register DMCA-ignored domains across 400+ TLDs. Get free .sbs/.xyz with plans.

<b>Shortit URL Shortener</b> — Start with 5 FREE branded links. Track every click in real-time.

<b>CloudPhone</b> — Get virtual numbers in 30+ countries with IVR, SMS & SIP from just $5/mo.

<b>Digital Products</b> — Twilio, AWS, Google Cloud, Workspace, Zoho & more. Delivered in 30 minutes.

Pay with crypto or fiat. Everything instant.

Type <b>/start</b> to explore`,

      `<b>ONE BOT. ZERO LIMITS.</b>

Tired of juggling multiple platforms? Nomadly brings everything under one roof:

<b>Domains</b> — 400+ TLDs, offshore protection
<b>URL Shortener</b> — 5 free links to start
<b>CloudPhone</b> — Virtual numbers from $5/mo
<b>Digital Store</b> — Twilio, Telnyx, AWS, Google Cloud, Workspace, Zoho, eSIM

Crypto payments accepted. Instant delivery.

Type <b>/start</b> now`,

      `<b>SCALE YOUR BUSINESS WITH NOMADLY</b>

Get everything you need to grow online:

<b>DMCA-Ignored Domains</b> — 400+ TLDs available
<b>Branded Short Links</b> — 5 FREE trial links
<b>Virtual Phone Numbers</b> — 30+ countries, $5/mo
<b>Premium Digital Products</b> — Twilio, AWS, GCloud & more

All delivered via Telegram. Pay with crypto or bank.

Type <b>/start</b> to begin`,
    ],

    showcase_afternoon: [
      `<b>PREMIUM DIGITAL PRODUCTS — INSTANT DELIVERY</b>

<b>Top Services Available:</b>
Twilio Main $450 | Sub $200
Telnyx Main $400 | Sub $150
AWS Main $400 | Sub $150
Google Cloud $300
Google Workspace from $100
Zoho Mail from $100
eSIM T-Mobile $60

<b>Plus:</b> Offshore domains (400+ TLDs), URL shortener (5 free links), CloudPhone ($5/mo).

Crypto & bank payments. Delivered in 30 minutes via bot.

Type <b>/start</b> to order`,

      `<b>EVERYTHING YOU NEED TO RUN ONLINE</b>

<b>Domains</b> — DMCA-ignored, 400+ TLDs available
<b>Short Links</b> — 5 FREE branded URLs with analytics
<b>Virtual Numbers</b> — CloudPhone from $5/mo in 30+ countries

<b>Digital Store:</b>
Twilio, Telnyx, AWS, Google Cloud, Workspace, Zoho Mail, eSIM T-Mobile

Pay with crypto or bank. Instant delivery to your Telegram.

Type <b>/start</b> to explore`,

      `<b>WHY USE 10 PLATFORMS WHEN ONE IS ENOUGH?</b>

Nomadly Bot = Your complete digital toolkit.

<b>Get:</b> Offshore domains, branded short links, virtual phone numbers, premium digital products.

<b>Prices:</b>
Twilio from $200 | AWS from $150 | Telnyx from $150
Google Cloud $300 | Workspace $100+ | Zoho $100+

All delivered in 30 minutes. Crypto payments welcome.

Type <b>/start</b> now`,
    ],
  },

  fr: {
    showcase_morning: [
      `<b>TOUT CE DONT VOUS AVEZ BESOIN — UN SEUL BOT</b>

<b>DOMAINES</b>
Enregistrement offshore DMCA-ignore. 400+ TLDs.
.sbs/.xyz gratuits avec abonnements.
Appuyez sur <b>Enregistrer des noms de domaine</b>

<b>RACCOURCISSEUR D'URL SHORTIT</b>
5 liens d'essai GRATUITS. URLs personnalisees.
Analyses de clics en temps reel.
Appuyez sur <b>Raccourcisseur d'URL</b>

<b>PISTES SMS HQ</b>
Leads verifies par pays, etat, operateur.
A partir de $20/1K. Validation $15/1K.
Appuyez sur <b>Pistes SMS HQ</b>

<b>CLOUDPHONE par SpeechCue</b>
Numeros virtuels dans 30+ pays. IVR, SMS, SIP.
Forfaits des $5/mois.
Appuyez sur <b>CloudPhone</b>

<b>PRODUITS DIGITAUX</b>
Twilio | Telnyx | AWS | Google Cloud
Google Workspace | Zoho Mail | eSIM T-Mobile
Livraison en 30 minutes.
Appuyez sur <b>Produits Digitaux</b>

Tapez /start pour explorer`,

      `<b>NOMADLY BOT — TOUS LES SERVICES</b>

<b>Domaines Offshore</b> — 400+ TLDs, zero suppression
<b>Liens Shortit</b> — 5 gratuits, puis illimites
<b>Leads Telephone</b> — achat & validation en masse
<b>CloudPhone</b> — numeros virtuels des $5/mois
<b>Produits Digitaux</b> — Twilio, Telnyx, AWS, GCloud, Workspace, Zoho, eSIM

Crypto, virement ou portefeuille.
Tout livre via bot.

Tapez /start pour commencer`,

      `<b>VOTRE BOITE A OUTILS DIGITALE</b>

Domaines — DMCA-ignore, 400+ TLDs
Liens courts — 5 GRATUITS, URLs de marque
Leads — verifies par pays & operateur
CloudPhone — IVR, SMS, SIP des $5/mois
Boutique Digitale — 13 produits, livres en 30 min

Tout en un bot. Tapez /start`,
    ],

    showcase_afternoon: [
      `<b>NOMADLY BOT — VOTRE BOITE A OUTILS</b>

<b>Domaines Offshore</b> — 400+ TLDs, zero suppression
<b>Liens Shortit</b> — 5 gratuits, illimites avec abo
<b>Leads Telephone</b> — achat & validation en masse
<b>CloudPhone</b> — numeros virtuels des $5/mois
<b>Boutique Digitale :</b>
  Twilio Main $450 | Sub $200
  Telnyx Main $400 | Sub $150
  AWS Main $400 | Sub $150
  Google Cloud $300
  Google Workspace des $100
  Zoho Mail des $100
  eSIM T-Mobile $60

Crypto, virement ou portefeuille.
Tout livre via bot.

Tapez /start pour commencer`,

      `<b>UN BOT. CHAQUE OUTIL.</b>

Domaines DMCA-ignores — 400+ TLDs
Liens courts — 5 URLs de marque GRATUITS
Leads verifies — des $20/1K
Numero virtuel — CloudPhone des $5/mois

<b>Produits Digitaux :</b>
Twilio | Telnyx | AWS | Google Cloud
Google Workspace | Zoho Mail | eSIM

Crypto, virement ou portefeuille. Livraison instantanee.
Tapez /start`,

      `<b>ARRETEZ DE JONGLER ENTRE LES OUTILS</b>

Domaines + Liens + Leads + CloudPhone + Produits Digitaux — tout en un bot.

Twilio des $200 | Telnyx des $150
AWS des $150 | Google Cloud $300
Workspace des $100 | Zoho des $100
eSIM T-Mobile $60

Tout livre en 30 minutes.
Tapez /start pour explorer`,
    ],
  },

  zh: {
    showcase_morning: [
      `<b>一个机器人，满足所有需求</b>

<b>域名</b>
DMCA 忽略的离岸注册。400+ TLD。
订阅计划可免费获得 .sbs/.xyz。
点击 <b>注册域名</b>

<b>SHORTIT 短链接</b>
5 个免费试用链接。自定义品牌 URL。
实时点击分析。
点击 <b>URL 缩短器</b>

<b>高质量电话线索</b>
按国家、州、运营商筛选的验证线索。
$20/1K 起。验证 $15/1K。
点击 <b>购买有效线索</b>

<b>CLOUDPHONE by SpeechCue</b>
30+ 国家的虚拟号码。IVR、SMS、SIP。
$5/月起。
点击 <b>CloudPhone</b>

<b>数字产品</b>
Twilio | Telnyx | AWS | Google Cloud
Google Workspace | Zoho Mail | eSIM T-Mobile
30 分钟内交付。
点击 <b>数字产品</b>

输入 /start 开始探索`,

      `<b>NOMADLY BOT — 全部服务</b>

<b>离岸域名</b> — 400+ TLD，零下架
<b>Shortit 链接</b> — 5 个免费，之后无限
<b>电话线索</b> — 批量购买和验证
<b>CloudPhone</b> — 虚拟号码 $5/月起
<b>数字产品</b> — Twilio、Telnyx、AWS、GCloud、Workspace、Zoho、eSIM

加密货币、银行或钱包支付。
全部通过机器人交付。

输入 /start 开始`,

      `<b>您的数字工具箱</b>

域名 — DMCA 忽略，400+ TLD
短链接 — 5 个免费，品牌 URL
线索 — 按国家和运营商验证
CloudPhone — IVR、SMS、SIP $5/月起
数字商店 — 13 种产品，30 分钟交付

一个机器人搞定一切。输入 /start`,
    ],

    showcase_afternoon: [
      `<b>NOMADLY BOT — 您的数字工具箱</b>

<b>离岸域名</b> — 400+ TLD，零下架
<b>Shortit 链接</b> — 5 个免费，订阅后无限
<b>电话线索</b> — 批量购买和验证
<b>CloudPhone</b> — 虚拟号码 $5/月起
<b>数字商店：</b>
  Twilio Main $450 | Sub $200
  Telnyx Main $400 | Sub $150
  AWS Main $400 | Sub $150
  Google Cloud $300
  Google Workspace $100 起
  Zoho Mail $100 起
  eSIM T-Mobile $60

加密货币、银行或钱包支付。
全部通过机器人交付。

输入 /start 开始`,

      `<b>一个机器人，所有工具</b>

注册 DMCA 忽略域名 — 400+ TLD
缩短链接 — 5 个免费品牌 URL
购买验证线索 — $20/1K 起
虚拟号码 — CloudPhone $5/月起

<b>数字产品：</b>
Twilio | Telnyx | AWS | Google Cloud
Google Workspace | Zoho Mail | eSIM

加密货币、银行或钱包。即时交付。
输入 /start`,

      `<b>别再在工具之间切换了</b>

域名 + 短链接 + 线索 + CloudPhone + 数字产品 — 全在一个机器人里。

Twilio $200 起 | Telnyx $150 起
AWS $150 起 | Google Cloud $300
Workspace $100 起 | Zoho $100 起
eSIM T-Mobile $60

30 分钟内全部交付。
输入 /start 探索`,
    ],
  },

  hi: {
    showcase_morning: [
      `<b>आपकी हर ज़रूरत — एक बॉट</b>

<b>डोमेन</b>
DMCA-इग्नोर्ड ऑफशोर रजिस्ट्रेशन। 400+ TLD।
सब्सक्रिप्शन प्लान के साथ मुफ्त .sbs/.xyz।
टैप करें <b>डोमेन नाम रजिस्टर करें</b>

<b>SHORTIT URL शॉर्टनर</b>
5 मुफ्त ट्रायल लिंक। कस्टम ब्रांडेड URL।
रियल-टाइम क्लिक एनालिटिक्स।
टैप करें <b>URL शॉर्टनर</b>

<b>HQ फ़ोन लीड्स</b>
देश, राज्य, कैरियर से फ़िल्टर्ड वेरिफाइड लीड्स।
$20/1K से। वैलिडेशन $15/1K।
टैप करें <b>वैलिड लीड्स खरीदें</b>

<b>CLOUDPHONE by SpeechCue</b>
30+ देशों में वर्चुअल नंबर। IVR, SMS, SIP।
$5/माह से प्लान।
टैप करें <b>CloudPhone</b>

<b>डिजिटल प्रोडक्ट्स</b>
Twilio | Telnyx | AWS | Google Cloud
Google Workspace | Zoho Mail | eSIM T-Mobile
30 मिनट में डिलीवरी।
टैप करें <b>डिजिटल प्रोडक्ट्स</b>

/start टाइप करें`,

      `<b>NOMADLY BOT — सभी सेवाएं</b>

<b>ऑफशोर डोमेन</b> — 400+ TLD, ज़ीरो टेकडाउन
<b>Shortit लिंक</b> — 5 मुफ्त, फिर अनलिमिटेड
<b>फ़ोन लीड्स</b> — बल्क में खरीदें और वेरिफाई करें
<b>CloudPhone</b> — वर्चुअल नंबर $5/माह से
<b>डिजिटल प्रोडक्ट्स</b> — Twilio, Telnyx, AWS, GCloud, Workspace, Zoho, eSIM

क्रिप्टो, बैंक या वॉलेट से भुगतान।
सब बॉट के ज़रिए डिलीवर।

/start टाइप करें`,

      `<b>आपका डिजिटल टूलकिट</b>

डोमेन — DMCA-इग्नोर्ड, 400+ TLD
शॉर्ट लिंक — 5 मुफ्त, ब्रांडेड URL
लीड्स — देश और कैरियर द्वारा वेरिफाइड
CloudPhone — IVR, SMS, SIP $5/माह से
डिजिटल स्टोर — 13 प्रोडक्ट्स, 30 मिनट में डिलीवरी

एक बॉट में सब कुछ। /start टैप करें`,
    ],

    showcase_afternoon: [
      `<b>NOMADLY BOT — आपका डिजिटल टूलकिट</b>

<b>ऑफशोर डोमेन</b> — 400+ TLD, ज़ीरो टेकडाउन
<b>Shortit लिंक</b> — 5 मुफ्त, प्लान के साथ अनलिमिटेड
<b>फ़ोन लीड्स</b> — बल्क में खरीदें और वेरिफाई करें
<b>CloudPhone</b> — वर्चुअल नंबर $5/माह से
<b>डिजिटल स्टोर:</b>
  Twilio Main $450 | Sub $200
  Telnyx Main $400 | Sub $150
  AWS Main $400 | Sub $150
  Google Cloud $300
  Google Workspace $100 से
  Zoho Mail $100 से
  eSIM T-Mobile $60

क्रिप्टो, बैंक या वॉलेट से भुगतान।
सब बॉट के ज़रिए डिलीवर।

/start टाइप करें`,

      `<b>एक बॉट। हर टूल।</b>

DMCA-इग्नोर्ड डोमेन रजिस्टर करें — 400+ TLD
लिंक शॉर्ट करें — 5 मुफ्त ब्रांडेड URL
वेरिफाइड फ़ोन लीड्स — $20/1K से
वर्चुअल नंबर — CloudPhone $5/माह से

<b>डिजिटल प्रोडक्ट्स:</b>
Twilio | Telnyx | AWS | Google Cloud
Google Workspace | Zoho Mail | eSIM

क्रिप्टो, बैंक या वॉलेट। इंस्टेंट डिलीवरी।
/start टैप करें`,

      `<b>टूल्स के बीच स्विच करना बंद करें</b>

डोमेन + शॉर्ट लिंक + लीड्स + CloudPhone + डिजिटल प्रोडक्ट्स — सब एक बॉट में।

Twilio $200 से | Telnyx $150 से
AWS $150 से | Google Cloud $300
Workspace $100 से | Zoho $100 से
eSIM T-Mobile $60

30 मिनट में सब डिलीवर।
/start टाइप करें`,
    ],
  },
}

/**
 * Convert a local target time to UTC given a timezone offset
 */
function localToUtc(localHour, localMinute, offsetHours) {
  let utcHour = localHour - Math.floor(offsetHours)
  let utcMinute = localMinute - Math.round((offsetHours % 1) * 60)
  if (utcMinute < 0) { utcMinute += 60; utcHour -= 1 }
  if (utcMinute >= 60) { utcMinute -= 60; utcHour += 1 }
  if (utcHour < 0) utcHour += 24
  if (utcHour >= 24) utcHour -= 24
  return { hour: utcHour, minute: utcMinute }
}

/**
 * Initialize the auto-promo system
 */
function initAutoPromo(bot, db, nameOf, stateCol) {
  const promoTracker = db.collection('promoTracker')
  const promoOptOut = db.collection('promoOptOut')
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID

  let dailyCouponSystem = null
  function setDailyCouponSystem(sys) { dailyCouponSystem = sys }

  function alertAdmin(msg) {
    if (adminChatId) bot.sendMessage(adminChatId, `[AutoPromo Alert] ${msg}`).catch(() => {})
  }

  async function getRotationIndex(theme, lang) {
    const trackerId = `${theme}_${lang}`
    const tracker = await promoTracker.findOne({ _id: trackerId })
    const currentIndex = tracker?.index || 0
    const variations = promoMessages[lang]?.[theme] || promoMessages.en[theme] || []
    const totalVariations = variations.length || 1
    const nextIndex = (currentIndex + 1) % totalVariations
    await promoTracker.updateOne({ _id: trackerId }, { $set: { index: nextIndex, lastSent: new Date() } }, { upsert: true })
    return currentIndex
  }

  const OPTOUT_TTL_DAYS = 7 // Retry opted-out users after 7 days (only for recoverable errors like 'bot_blocked')

  // Permanent error reasons — these users will NEVER be re-opted-in automatically
  const PERMANENT_OPTOUT_REASONS = ['chat_not_found', 'user_deactivated']

  async function isOptedOut(chatId) {
    const record = await promoOptOut.findOne({ _id: chatId })
    if (!record?.optedOut) return false

    // NEVER re-opt-in users with permanent errors (chat not found, deactivated)
    if (PERMANENT_OPTOUT_REASONS.includes(record.reason)) return true

    // TTL: only re-opt-in users with recoverable errors (bot_blocked, no_rights, etc.)
    if (record.updatedAt) {
      const daysSinceOptOut = (Date.now() - new Date(record.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
      if (daysSinceOptOut >= OPTOUT_TTL_DAYS) {
        await promoOptOut.updateOne({ _id: chatId }, { $set: { optedOut: false, updatedAt: new Date(), reOptInReason: 'ttl_expired' } })
        log(`[AutoPromo] Re-opted-in ${chatId} after ${Math.floor(daysSinceOptOut)}d TTL (was: ${record.reason || 'unknown'})`)
        return false
      }
    }
    return true
  }

  async function setOptOut(chatId, optedOut, reason = 'unknown') {
    await promoOptOut.updateOne({ _id: chatId }, { $set: { optedOut, reason, updatedAt: new Date() } }, { upsert: true })
  }

  async function getAllChatIds() {
    try {
      const users = await nameOf.find({}).toArray()
      return users.map(u => u._id).filter(id => typeof id === 'number')
    } catch (error) {
      log(`[AutoPromo] Error fetching chat IDs: ${error.message}`)
      return []
    }
  }

  async function getUserLanguage(chatId) {
    try {
      const userState = await stateCol.findOne({ _id: chatId })
      const lang = userState?.userLanguage || 'en'
      return promoMessages[lang] ? lang : 'en'
    } catch { return 'en' }
  }

  function isUnreachableError(error) {
    const msg = error.message || ''
    return msg.includes('chat not found') || msg.includes('user is deactivated') || msg.includes('bot was blocked') || msg.includes('have no rights to send a message')
  }

  // Classify the opt-out reason for determining if re-opt-in is safe
  function classifyOptOutReason(error) {
    const msg = error.message || ''
    if (msg.includes('chat not found')) return 'chat_not_found'
    if (msg.includes('user is deactivated')) return 'user_deactivated'
    if (msg.includes('bot was blocked')) return 'bot_blocked'
    if (msg.includes('have no rights to send a message')) return 'no_rights'
    return 'unknown'
  }

  // GIF path for morning showcase promo
  const SHOWCASE_GIF = require('path').join(__dirname, 'assets', 'nomadly-showcase-promo.gif')

  async function sendPromoToUser(chatId, theme, variationIndex, lang, dynamicMessage, couponLine) {
    try {
      if (await isOptedOut(chatId)) return { success: true, skipped: true }
      const variations = promoMessages[lang]?.[theme] || promoMessages.en?.[theme]
      if (!variations || variations.length === 0) {
        log(`[AutoPromo] No variations found for theme=${theme} lang=${lang}, skipping ${chatId}`)
        return { success: false, error: 'no variations' }
      }
      let caption = dynamicMessage || variations[variationIndex % variations.length]
      if (couponLine) caption += '\n\n' + couponLine

      const trySend = async (useHtml) => {
        const opts = useHtml ? { parse_mode: 'HTML' } : {}

        // Use sendAnimation (GIF) for morning showcase
        if (theme === 'showcase_morning') {
          try {
            const fs = require('fs')
            if (fs.existsSync(SHOWCASE_GIF)) {
              await bot.sendAnimation(chatId, SHOWCASE_GIF, { caption, ...opts })
            } else {
              log(`[AutoPromo] GIF not found, text fallback for ${chatId}`)
              await bot.sendMessage(chatId, caption, { ...opts, disable_web_page_preview: true })
            }
          } catch (gifErr) {
            if (isUnreachableError(gifErr)) throw gifErr
            log(`[AutoPromo] GIF failed for ${chatId}, text fallback: ${gifErr.message}`)
            await bot.sendMessage(chatId, caption, { ...opts, disable_web_page_preview: true })
          }
          return
        }

        // Afternoon showcase: text only
        await bot.sendMessage(chatId, caption, { ...opts, disable_web_page_preview: true })
      }

      try { await trySend(true) }
      catch (parseErr) {
        if (isUnreachableError(parseErr)) throw parseErr
        if (parseErr.message?.includes('parse') || parseErr.response?.statusCode === 400) {
          log(`[AutoPromo] HTML parse error for ${chatId}, retrying plain`)
          await trySend(false)
        } else throw parseErr
      }
      return { success: true }
    } catch (error) {
      const code = error.response?.statusCode
      if (code === 403 || isUnreachableError(error)) {
        const reason = classifyOptOutReason(error)
        await setOptOut(chatId, true, reason)
        log(`[AutoPromo] User ${chatId} unreachable (${reason}), auto opted-out`)
      } else if (code === 429) {
        log(`[AutoPromo] Rate limited: ${chatId}`)
      } else {
        log(`[AutoPromo] Failed ${chatId}: [${code || 'unknown'}] ${error.message}`)
      }
      return { success: false, error: error.message }
    }
  }

  async function broadcastPromoForLang(themeIndex, lang) {
    if (themeIndex === undefined || themeIndex === null) {
      log(`[AutoPromo] Skipping broadcast for ${lang} — no theme index (likely weekend)`)
      return
    }
    const theme = THEMES[themeIndex]
    if (!theme) {
      log(`[AutoPromo] Skipping broadcast for ${lang} — invalid theme index: ${themeIndex}`)
      return
    }
    const variationIndex = await getRotationIndex(theme, lang)
    const allChatIds = await getAllChatIds()
    if (allChatIds.length === 0) return log(`[AutoPromo] No users found`)

    // Pre-filter permanently dead users (chat_not_found, user_deactivated) — they'll never come back
    const permanentlyDead = await promoOptOut.find({
      optedOut: true,
      reason: { $in: ['chat_not_found', 'user_deactivated'] }
    }).toArray()
    const deadSet = new Set(permanentlyDead.map(r => r._id))

    const targetChatIds = []
    let skippedDead = 0
    for (const chatId of allChatIds) {
      if (deadSet.has(chatId)) { skippedDead++; continue }
      const userLang = await getUserLanguage(chatId)
      if (userLang === lang) targetChatIds.push(chatId)
    }
    if (targetChatIds.length === 0) return log(`[AutoPromo] No ${lang} users for ${theme} (${skippedDead} permanently dead skipped)`)

    let dynamicMessage = null
    let usedAI = false
    try {
      dynamicMessage = await generateDynamicPromo(theme, lang)
      if (dynamicMessage) { usedAI = true; log(`[AutoPromo] AI ${theme}/${lang} (${dynamicMessage.length} chars)`) }
    } catch (err) { log(`[AutoPromo] AI fail: ${err.message}`) }

    if (!dynamicMessage) {
      log(`[AutoPromo] Static fallback for ${theme}/${lang}`)
      alertAdmin(`OpenAI failed for ${theme}/${lang}. Using static fallback.`)
    }

    log(`[AutoPromo] Broadcasting ${theme} (${usedAI ? 'AI' : 'static #' + (variationIndex + 1)}) to ${targetChatIds.length} ${lang} users (${skippedDead} permanently dead pre-filtered)`)

    let couponLine = null
    if (dailyCouponSystem) {
      try {
        const codes = await dailyCouponSystem.getTodayCoupons()
        const entries = Object.entries(codes)
        if (entries.length > 0) {
          const [code, info] = entries[Math.floor(Math.random() * entries.length)]
          couponLine = `<b>TODAY ONLY:</b> Use code <code>${code}</code> for ${info.discount}% off!`
        }
      } catch (err) { log(`[AutoPromo] Coupon error: ${err.message}`) }
    }

    const { BATCH_SIZE, DELAY_BETWEEN_BATCHES, DELAY_BETWEEN_MESSAGES } = BROADCAST_CONFIG
    let successCount = 0, errorCount = 0, skippedCount = 0

    for (let i = 0; i < targetChatIds.length; i += BATCH_SIZE) {
      const batch = targetChatIds.slice(i, i + BATCH_SIZE)
      const results = await Promise.allSettled(batch.map(async (chatId, index) => {
        await sleep(index * DELAY_BETWEEN_MESSAGES)
        return sendPromoToUser(chatId, theme, variationIndex, lang, dynamicMessage, couponLine)
      }))
      for (const result of results) {
        if (result.status === 'fulfilled') {
          if (result.value?.skipped) skippedCount++
          else if (result.value?.success) successCount++
          else errorCount++
        } else errorCount++
      }
      if (i + BATCH_SIZE < targetChatIds.length) await sleep(DELAY_BETWEEN_BATCHES)
    }

    const stats = { theme, lang, variation: usedAI ? 'ai' : variationIndex + 1, usedAI, total: targetChatIds.length, success: successCount, errors: errorCount, skipped: skippedCount, timestamp: new Date().toISOString() }
    log(`[AutoPromo] Done:`, JSON.stringify(stats))
    await db.collection('promoStats').insertOne(stats)
  }

  function getTodayThemes() {
    // Rotate service focus by day of week:
    // Mon/Wed/Fri = showcase_morning (index 0) — full service overview
    // Tue/Thu = showcase_afternoon (index 1) — product-focused
    // Sat/Sun = no promo (returns empty → skipped)
    const day = new Date().getDay()
    if (day === 0 || day === 6) return [] // No promos on weekends — reduces fatigue
    return day % 2 === 1 ? [0] : [1] // Alternate themes
  }

  const supportedLangs = Object.keys(TIMEZONE_OFFSETS)
  let scheduledCount = 0

  for (const lang of supportedLangs) {
    const offset = TIMEZONE_OFFSETS[lang]
    LOCAL_TIMES.forEach((localTime, slotIndex) => {
      const utcTime = localToUtc(localTime.hour, localTime.minute, offset)
      const cronExpr = `${utcTime.minute} ${utcTime.hour} * * *`
      schedule.scheduleJob(cronExpr, () => {
        const todayThemes = getTodayThemes()
        const themeIndex = todayThemes[slotIndex]
        if (themeIndex === undefined) {
          log(`[AutoPromo] Skipping ${lang} slot ${slotIndex + 1} — no promo scheduled today (weekend)`)
          return
        }
        log(`[AutoPromo] Triggered ${THEMES[themeIndex]} for ${lang} (local ${localTime.hour}:${String(localTime.minute).padStart(2, '0')})`)
        broadcastPromoForLang(themeIndex, lang).catch(err => log(`[AutoPromo] Broadcast error: ${err.message}`))
      })
      log(`[AutoPromo] Scheduled slot ${slotIndex + 1} for ${lang.toUpperCase()} at local ${localTime.hour}:${String(localTime.minute).padStart(2, '0')} (UTC ${utcTime.hour}:${String(utcTime.minute).padStart(2, '0')})`)
      scheduledCount++
    })
  }

  log(`[AutoPromo] Initialized with ${scheduledCount} scheduled jobs (${supportedLangs.length} languages x ${LOCAL_TIMES.length} slots, rotating ${THEMES.length} themes)`)

  return {
    setOptOut,
    isOptedOut,
    broadcastPromoForLang,
    setDailyCouponSystem,
    getPromoMessages: () => promoMessages,
    getThemes: () => THEMES,
  }
}

module.exports = { initAutoPromo, promoMessages, PROMO_BANNERS }
