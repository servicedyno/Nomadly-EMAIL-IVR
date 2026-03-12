// Auto-Promo System — Sends 1 daily promotional message to bot users
// 6 themed days: Mon=CloudPhone, Tue=AntiRed, Wed=Leads, Thu=Domains, Fri=Digital, Sat=Cards/Bundles
// Sunday = rest day (no promo). AI-powered dynamic messages with static fallback + daily coupons.

const schedule = require('node-schedule')
const { log } = require('console')
const BROADCAST_CONFIG = require('./broadcast-config.js')

// OpenAI — optional (graceful fallback if missing)
let OpenAI = null
try { OpenAI = require('openai') } catch { log('[AutoPromo] openai package not installed, using static messages only') }

let openai = null
function getOpenAI() {
  if (!openai && OpenAI && process.env.APP_OPEN_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.APP_OPEN_API_KEY })
  }
  return openai
}

const LANG_NAMES = { en: 'English', fr: 'French', zh: 'Chinese (Simplified)', hi: 'Hindi' }

// ─── Service Context for AI Generation ────────────────────────────────
const SERVICE_CONTEXT = {
  cloudphone: {
    services: 'CloudPhone by SpeechCue — virtual phone numbers',
    details: [
      'Virtual phone numbers in 30+ countries — no SIM, no contract',
      'Custom IVR greetings — sound like a real business',
      'Receive calls, SMS, voicemail anywhere in the world',
      'SIP integration for advanced setups',
      'Call forwarding to any number globally',
      'Plans from $50/month with included minutes & SMS',
    ],
    cta: '/start → 📞 Cloud IVR + SIP',
  },
  antired_hosting: {
    services: 'Anti-Red Hosting — DMCA-ignored offshore hosting',
    details: [
      'DMCA-ignored offshore servers — zero takedowns',
      'Anti-Red scanner automatically blocks threats',
      'Free .sbs/.xyz domain included with every plan',
      'Full cPanel access with one-click setup',
      'Weekly plans from $30, monthly from $75',
      '99.9% uptime — content stays LIVE no matter what',
    ],
    cta: '/start → 🛡️🔥 Anti-Red Hosting',
  },
  leads_validation: {
    services: 'Phone Leads & CNAM Validation',
    details: [
      'Bulk phone leads by country, area code & carrier',
      'CNAM lookup — get the actual NAME behind each number',
      'Real-time validation — only live, active numbers',
      'Export in any format you need',
      'Leads from $0.025 each, CNAM from $0.015',
      'Results delivered in minutes, not days',
    ],
    cta: '/start → 🎯 Leads & Validation',
  },
  domains_shortener: {
    services: 'Bulletproof Domains + Shortit URL Shortener',
    details: [
      'Register bulletproof domains across 400+ TLDs',
      'DMCA-ignored — content stays yours, no censorship',
      'Free .sbs/.xyz domains with hosting plans',
      'Cloudflare DNS integration built-in',
      'Shortit: 5 FREE branded short links to start',
      'Click tracking & analytics on every link',
      'Use YOUR own domain as the short URL',
    ],
    cta: '/start → 🌐 Bulletproof Domains',
  },
  digital_products: {
    services: 'Premium Digital Products — instant delivery',
    details: [
      'Twilio accounts — Main $450, Sub $200',
      'Telnyx accounts — Main $400, Sub $150',
      'AWS accounts — Main $350, Sub $150',
      'Google Cloud — $300',
      'Google Workspace — from $100',
      'Zoho Mail — from $100',
      'eSIM T-Mobile — $60',
      'All fully verified & delivered in 30 minutes via Telegram',
    ],
    cta: '/start → 🛒 Digital Products',
  },
  cards_bundles: {
    services: 'Virtual Cards, Shipping Labels, Bundles & Reseller Program',
    details: [
      'Virtual cards for online payments & verifications',
      'Shipping labels — generate & track instantly',
      'Service bundles — save big when you combine services',
      'Become a Reseller — earn commission on every referral',
      'All managed from one Telegram bot',
    ],
    cta: '/start to explore everything',
  },
}

// ─── Sanitize AI output for Telegram HTML ─────────────────────────────
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

// ─── AI Dynamic Promo Generation ──────────────────────────────────────
async function generateDynamicPromo(theme, lang) {
  const ai = getOpenAI()
  if (!ai) return null

  const ctx = SERVICE_CONTEXT[theme]
  if (!ctx) return null
  const langName = LANG_NAMES[lang] || 'English'

  const prompt = `You are a top Telegram bot copywriter. Create a UNIQUE, colorful, and highly persuasive promotional message for: ${ctx.services}.

Key details:
${ctx.details.map(d => '- ' + d).join('\n')}

STRICT Requirements:
- Write in ${langName}
- Use ONLY <b>bold</b> and <code>code</code> HTML tags
- Use emojis LIBERALLY throughout — make it colorful and eye-catching (🔥🚀💰✅🎯📞🛡️🌐 etc.)
- Start with a POWERFUL emoji-rich headline that creates curiosity or addresses a pain point
- Focus on ONE key BENEFIT (what the user GAINS), not just features
- Include a social proof or urgency element (e.g. "hundreds already using this", "limited spots")
- Keep under 500 characters
- End with clear CTA: ${ctx.cta}
- Be creative — vary tone, angle, and hook each time
- Do NOT mention VPS, RDP, email blast, or @hostbay_bot
- Sound exciting, not corporate

Return ONLY the promotional message text.`

  try {
    const res = await ai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.95,
    })
    let content = res.choices?.[0]?.message?.content?.trim()
    if (!content || content.length < 30) return null
    content = sanitizeForTelegram(content)
    if (content.length <= 1024) return content
    const truncated = content.substring(0, 600)
    const lastNewline = truncated.lastIndexOf('\n')
    return sanitizeForTelegram(lastNewline > 200 ? truncated.substring(0, lastNewline) : truncated)
  } catch (error) {
    log(`[AutoPromo] OpenAI error for ${theme}/${lang}: ${error.message}`)
    return null
  }
}

// ─── Timezone & Schedule Config ───────────────────────────────────────
const TIMEZONE_OFFSETS = { en: 0, fr: 1, zh: 8, hi: 5.5 }
const LOCAL_TIMES = [{ hour: 10, minute: 0 }]
const THEMES = ['cloudphone', 'antired_hosting', 'leads_validation', 'domains_shortener', 'digital_products', 'cards_bundles']
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

// ═══════════════════════════════════════════════════════════════════════
//  PROMO MESSAGES — 6 themes × 3 variations × 4 languages = 72 ads
// ═══════════════════════════════════════════════════════════════════════

const promoMessages = {

  // ═══════════════════ ENGLISH ═══════════════════

  en: {
    cloudphone: [
      `📞🔥 <b>GET A PHONE NUMBER IN ANY COUNTRY — IN 60 SECONDS</b>

No SIM card. No contract. No ID hassle.

🌍 30+ countries available
📱 Receive calls, SMS & voicemail instantly
🎙️ Custom IVR greeting — sound like a real business
🔗 SIP integration for advanced setups
💬 Forward calls anywhere in the world

💰 Starting at just <b>$50/month</b>

Perfect for privacy, remote business, or going global.
Already trusted by hundreds of users worldwide 🌎

Type <b>/start</b> → 📞 Cloud IVR + SIP`,

      `🚀 <b>NEED A PRIVATE PHONE NUMBER? GET ONE NOW.</b>

No paperwork. No waiting. Just pick a country & go.

📞 Virtual numbers in 30+ countries
🎙️ Professional IVR — callers hear YOUR greeting
💬 SMS forwarding to Telegram
📲 SIP-ready for softphones & PBX
🔐 100% private — no personal info required

💰 From <b>$50/mo</b> with minutes & SMS included

🔥 Over 500 numbers activated this month alone!

Type <b>/start</b> → 📞 Cloud IVR + SIP`,

      `🌍 <b>YOUR BUSINESS DESERVES A LOCAL PRESENCE</b>

Get a phone number in ANY country — customers call a local number, you answer from anywhere.

✅ 30+ countries — US, UK, Canada, Germany & more
✅ IVR system — press 1 for sales, 2 for support
✅ SMS + voicemail + call recording
✅ SIP integration included
✅ No contracts — cancel anytime

💰 Plans from <b>$50/month</b>

Stop missing international opportunities 📈

Type <b>/start</b> → 📞 Cloud IVR + SIP`,
    ],

    antired_hosting: [
      `🛡️🔥 <b>TIRED OF YOUR SITE GETTING TAKEN DOWN?</b>

Anti-Red Hosting keeps your content LIVE — no matter what.

🔒 DMCA-ignored offshore servers
🔥 Anti-Red scanner blocks threats before they hit
🌐 Free .sbs/.xyz domain included
⚡ cPanel access + one-click setup
🛡️ 99.9% uptime guarantee

💰 Weekly plans from <b>$30</b> | Monthly from <b>$75</b>

Your competitors are already hosted offshore.
Don't be the last one without protection 🏴‍☠️

Type <b>/start</b> → 🛡️🔥 Anti-Red Hosting`,

      `🏴‍☠️ <b>BULLETPROOF YOUR WEBSITE. ZERO TAKEDOWNS.</b>

While others get shut down, your site stays UP.

🛡️ <b>Anti-Red Hosting</b> includes:
• DMCA-ignored offshore servers
• Real-time Anti-Red threat scanner
• Free domain (.sbs or .xyz)
• Full cPanel with file manager
• Weekly or monthly plans

💰 From just <b>$30/week</b>

⚠️ Content removals are at an all-time high.
Protect yourself BEFORE it's too late.

Type <b>/start</b> → 🛡️🔥 Anti-Red Hosting`,

      `⚡ <b>YOUR CONTENT. YOUR RULES. ZERO CENSORSHIP.</b>

Anti-Red Hosting = offshore + anti-scanner protection.

🔒 No DMCA takedowns — ever
🛡️ Anti-Red blocker shields your site 24/7
🌐 Free .sbs/.xyz domain on signup
🖥️ Full cPanel — manage everything yourself
📈 99.9% uptime SLA

💰 <b>$30/week</b> or <b>$75/month</b>

Hundreds of sites already protected ✅
Join them before the next wave of takedowns hits.

Type <b>/start</b> → 🛡️🔥 Anti-Red Hosting`,
    ],

    leads_validation: [
      `🎯🔥 <b>WANT REAL PHONE LEADS WITH OWNER NAMES?</b>

Stop wasting time on dead numbers.

📋 Bulk phone leads by country, area code & carrier
👤 CNAM lookup — get the actual NAME behind each number
✅ Real-time validation — only live, active numbers
📊 Export in any format you need
⚡ Results delivered in minutes, not days

💰 Leads from <b>$0.025</b> each | CNAM from <b>$0.015</b>

Marketers & sales teams love this. You will too 🚀

Type <b>/start</b> → 🎯 Leads & Validation`,

      `📊 <b>STOP CALLING DEAD NUMBERS.</b>

Every bad lead = wasted time + money. Fix that now.

🎯 <b>Phone Leads:</b> Fresh numbers by country & carrier
✅ <b>Validation:</b> Instantly verify if a number is LIVE
👤 <b>CNAM:</b> See the real name of the phone owner
📋 <b>Export:</b> CSV, JSON — whatever you need

💰 From <b>$0.025/lead</b> | CNAM <b>$0.015/lookup</b>

⚡ Thousands of leads validated daily on this bot.

Type <b>/start</b> → 🎯 Leads & Validation`,

      `👤 <b>KNOW WHO'S BEHIND EVERY PHONE NUMBER</b>

CNAM + validated leads = unstoppable outreach.

🎯 Targeted leads — pick your country, area & carrier
📞 Only verified, active numbers delivered
👤 CNAM reveals the REAL owner name
📊 Bulk processing — thousands at once
💨 Lightning-fast delivery to your Telegram

💰 Leads: <b>$0.025</b> | CNAM: <b>$0.015</b>

Your competitors already have this data. Do you? 🤔

Type <b>/start</b> → 🎯 Leads & Validation`,
    ],

    domains_shortener: [
      `🌐🔥 <b>YOUR DOMAIN. YOUR RULES. ZERO CENSORSHIP.</b>

Register bulletproof domains across 400+ TLDs.

🔒 DMCA-ignored — content stays yours forever
🆓 Free .sbs/.xyz with hosting plans
🌍 Offshore nameservers included
☁️ Cloudflare DNS integration built-in

<b>PLUS:</b> ✂️ Shortit URL Shortener
🔗 5 FREE branded short links to start
📊 Click tracking & analytics on every link
🌐 Use YOUR domain as the short URL

💰 Domains from <b>$3</b> | Shortener <b>FREE</b> to start

Type <b>/start</b> → 🌐 Bulletproof Domains`,

      `🔗 <b>TURN ANY LONG URL INTO A BRANDED SHORT LINK</b>

Shortit URL Shortener — free, fast & trackable.

✂️ 5 FREE trial links — no signup needed
🌐 Use your OWN custom domain as the link
📊 Real-time click analytics
🔒 Links never expire

<b>NEED A DOMAIN?</b>
🌐 400+ TLDs available — bulletproof & offshore
🆓 Free .sbs/.xyz with hosting
☁️ Cloudflare DNS included

💰 Short links: <b>FREE</b> | Domains from <b>$3</b>

Start shortening now — type <b>/start</b> → 🔗 URL Shortener`,

      `🏴‍☠️ <b>BULLETPROOF DOMAINS — 400+ TLDs AVAILABLE</b>

Your content should NEVER be at the mercy of registrars.

🌐 Register across .com, .net, .org + 400 more
🔒 DMCA-ignored — no forced takedowns
☁️ Cloudflare DNS + offshore NS options
🆓 Free .sbs/.xyz when you get hosting

✂️ <b>Bonus:</b> Shortit gives you 5 FREE branded short URLs!

💰 Domains from <b>$3</b>

Thousands of domains registered through this bot 🚀

Type <b>/start</b> → 🌐 Bulletproof Domains`,
    ],

    digital_products: [
      `🛒🔥 <b>PREMIUM ACCOUNTS — DELIVERED IN 30 MINUTES</b>

No waiting. No verification headaches. Just plug & play.

📞 Twilio — Main <b>$450</b> | Sub <b>$200</b>
📡 Telnyx — Main <b>$400</b> | Sub <b>$150</b>
☁️ AWS — Main <b>$350</b> | Sub <b>$150</b>
🌐 Google Cloud — <b>$300</b>
📧 Google Workspace — from <b>$100</b>
📮 Zoho Mail — from <b>$100</b>
📱 eSIM T-Mobile — <b>$60</b>

✅ All fully verified & ready to use
💳 Pay with crypto or bank transfer
🤖 Instant delivery right here in Telegram

Hundreds of accounts delivered this month 🚀

Type <b>/start</b> → 🛒 Digital Products`,

      `⚡ <b>NEED A TWILIO, AWS OR GOOGLE CLOUD ACCOUNT?</b>

Get it in <b>30 minutes</b>. Fully verified. Ready to go.

🔥 <b>Most Popular:</b>
📞 Twilio Sub — <b>$200</b>
📡 Telnyx Sub — <b>$150</b>
☁️ AWS Sub — <b>$150</b>
📱 eSIM T-Mobile — <b>$60</b>

🏷️ <b>Premium:</b>
📞 Twilio Main — <b>$450</b>
☁️ AWS Main — <b>$350</b>
🌐 Google Cloud — <b>$300</b>

💳 Crypto & bank payments accepted
📦 Delivered straight to your Telegram

Why wait days when you can have it in minutes? ⏱️

Type <b>/start</b> → 🛒 Digital Products`,

      `🎯 <b>STOP WASTING TIME ON ACCOUNT VERIFICATION</b>

We handle the hassle. You get a working account.

📞 Twilio — verified & funded
📡 Telnyx — SIP-ready instantly
☁️ AWS — full access, no restrictions
🌐 Google Cloud — ready for deployment
📧 Workspace & Zoho — business email in minutes
📱 eSIM — T-Mobile USA, no ID needed

💰 Starting from just <b>$60</b>
⚡ Average delivery: <b>30 minutes</b>
💳 Pay with crypto or bank

Trusted by hundreds of developers & businesses 🛠️

Type <b>/start</b> → 🛒 Digital Products`,
    ],

    cards_bundles: [
      `💳🔥 <b>VIRTUAL CARDS. SHIPPING LABELS. ALL IN ONE BOT.</b>

Everything you need — one Telegram bot.

💳 <b>Virtual Cards</b> — for online payments & verifications
📦 <b>Shipping Labels</b> — generate & track instantly
🎁 <b>Service Bundles</b> — save BIG when you combine services
💼 <b>Become a Reseller</b> — earn commission on every referral

💰 Cards from <b>$5</b> | Labels from <b>$10</b>
🎁 Bundles save <b>20%+</b>

Why use 10 different platforms?
Nomadly has it ALL in one place ⚡

Type <b>/start</b> to explore everything`,

      `🚀 <b>ONE BOT. EVERY DIGITAL TOOL YOU NEED.</b>

Stop switching between platforms. Get it all here:

💳 Virtual Cards — instant online payments
📦 Shipping Labels — create & track in seconds
📞 Cloud Phone — virtual numbers in 30+ countries
🌐 Bulletproof Domains — 400+ TLDs
🛡️ Anti-Red Hosting — zero takedowns
🛒 Digital Products — Twilio, AWS & more
🎯 Phone Leads — targeted & validated

💼 <b>Want to earn?</b> Join our Reseller Program!

💰 Something for every budget — starting from <b>$3</b>

Type <b>/start</b> to see everything we offer`,

      `💼 <b>EARN MONEY WITH EVERY REFERRAL</b>

Join the Nomadly Reseller Program & build your income.

✅ Sell any service on the bot to YOUR customers
💰 Earn commission on every single sale
🔄 Automated delivery — you don't lift a finger
📊 Track earnings in real-time

<b>What you can resell:</b>
📞 CloudPhone | 🌐 Domains | 🛡️ Hosting
🛒 Digital Products | 💳 Virtual Cards | 📦 Labels

🔥 Our top resellers earn <b>$500+/month</b>

Type <b>/start</b> → 💼 Reseller`,
    ],
  },

  // ═══════════════════ FRENCH ═══════════════════

  fr: {
    cloudphone: [
      `📞🔥 <b>OBTENEZ UN NUMÉRO DE TÉLÉPHONE DANS N'IMPORTE QUEL PAYS — EN 60 SECONDES</b>

Pas de carte SIM. Pas de contrat. Aucune prise de tête.

🌍 30+ pays disponibles
📱 Recevez appels, SMS et messagerie vocale instantanément
🎙️ Message d'accueil IVR personnalisé
🔗 Intégration SIP pour configurations avancées
💬 Transfert d'appels partout dans le monde

💰 À partir de seulement <b>50$/mois</b>

Parfait pour la confidentialité et les affaires internationales 🌎

Tapez <b>/start</b> → 📞 Cloud IVR + SIP`,

      `🚀 <b>BESOIN D'UN NUMÉRO PRIVÉ ? OBTENEZ-LE MAINTENANT.</b>

Aucune paperasse. Aucune attente. Choisissez un pays et c'est parti.

📞 Numéros virtuels dans 30+ pays
🎙️ IVR professionnel — les appelants entendent VOTRE message
💬 Transfert SMS vers Telegram
📲 Compatible SIP pour softphones
🔐 100% privé — aucune info personnelle requise

💰 À partir de <b>50$/mois</b> avec minutes et SMS inclus

🔥 Plus de 500 numéros activés ce mois-ci !

Tapez <b>/start</b> → 📞 Cloud IVR + SIP`,

      `🌍 <b>VOTRE ENTREPRISE MÉRITE UNE PRÉSENCE LOCALE</b>

Obtenez un numéro dans N'IMPORTE QUEL pays — vos clients appellent un numéro local.

✅ 30+ pays — US, UK, Canada, Allemagne et plus
✅ Système IVR — appuyez 1 pour ventes, 2 pour support
✅ SMS + messagerie vocale + enregistrement d'appels
✅ Intégration SIP incluse

💰 Plans à partir de <b>50$/mois</b>

Ne ratez plus les opportunités internationales 📈

Tapez <b>/start</b> → 📞 Cloud IVR + SIP`,
    ],

    antired_hosting: [
      `🛡️🔥 <b>MARRE QUE VOTRE SITE SOIT SUPPRIMÉ ?</b>

L'hébergement Anti-Red garde votre contenu EN LIGNE — quoi qu'il arrive.

🔒 Serveurs offshore ignorant le DMCA
🔥 Scanner Anti-Red bloque les menaces automatiquement
🌐 Domaine .sbs/.xyz gratuit inclus
⚡ Accès cPanel + installation en un clic
🛡️ Garantie de disponibilité 99.9%

💰 Plans hebdomadaires à partir de <b>30$</b> | Mensuels à partir de <b>75$</b>

Vos concurrents sont déjà hébergés offshore 🏴‍☠️

Tapez <b>/start</b> → 🛡️🔥 Anti-Red Hosting`,

      `🏴‍☠️ <b>BLINDEZ VOTRE SITE. ZÉRO SUPPRESSION.</b>

Pendant que d'autres se font fermer, votre site reste EN LIGNE.

🛡️ <b>Anti-Red Hosting</b> inclut :
• Serveurs offshore DMCA-ignorés
• Scanner anti-menaces en temps réel
• Domaine gratuit (.sbs ou .xyz)
• cPanel complet avec gestionnaire de fichiers

💰 À partir de <b>30$/semaine</b>

⚠️ Les suppressions de contenu sont au plus haut niveau.
Protégez-vous AVANT qu'il ne soit trop tard.

Tapez <b>/start</b> → 🛡️🔥 Anti-Red Hosting`,

      `⚡ <b>VOTRE CONTENU. VOS RÈGLES. ZÉRO CENSURE.</b>

Anti-Red Hosting = offshore + protection anti-scanner.

🔒 Aucune suppression DMCA — jamais
🛡️ Bloqueur Anti-Red protège 24/7
🌐 Domaine .sbs/.xyz gratuit
🖥️ cPanel complet

💰 <b>30$/semaine</b> ou <b>75$/mois</b>

Des centaines de sites déjà protégés ✅

Tapez <b>/start</b> → 🛡️🔥 Anti-Red Hosting`,
    ],

    leads_validation: [
      `🎯🔥 <b>VOULEZ-VOUS DES LEADS TÉLÉPHONIQUES AVEC LES NOMS DES PROPRIÉTAIRES ?</b>

Arrêtez de perdre du temps sur des numéros morts.

📋 Leads téléphoniques par pays, indicatif et opérateur
👤 Recherche CNAM — obtenez le vrai NOM derrière chaque numéro
✅ Validation en temps réel — seulement des numéros actifs
📊 Export dans le format de votre choix

💰 Leads à partir de <b>0.025$</b> | CNAM à partir de <b>0.015$</b>

Les équipes marketing adorent ça. Vous aussi 🚀

Tapez <b>/start</b> → 🎯 Leads & Validation`,

      `📊 <b>ARRÊTEZ D'APPELER DES NUMÉROS MORTS.</b>

Chaque mauvais lead = du temps et de l'argent perdus.

🎯 Leads frais par pays et opérateur
✅ Vérification instantanée des numéros
👤 CNAM : voyez le vrai nom du propriétaire
📋 Export CSV, JSON — comme vous voulez

💰 À partir de <b>0.025$/lead</b>

⚡ Des milliers de leads validés chaque jour sur ce bot.

Tapez <b>/start</b> → 🎯 Leads & Validation`,

      `👤 <b>SACHEZ QUI EST DERRIÈRE CHAQUE NUMÉRO</b>

CNAM + leads validés = prospection imbattable.

🎯 Leads ciblés — choisissez pays et opérateur
📞 Seulement des numéros vérifiés et actifs
👤 CNAM révèle le vrai nom du propriétaire
💨 Livraison ultra-rapide sur Telegram

💰 Leads : <b>0.025$</b> | CNAM : <b>0.015$</b>

Vos concurrents ont déjà ces données. Et vous ? 🤔

Tapez <b>/start</b> → 🎯 Leads & Validation`,
    ],

    domains_shortener: [
      `🌐🔥 <b>VOTRE DOMAINE. VOS RÈGLES. ZÉRO CENSURE.</b>

Enregistrez des domaines blindés parmi 400+ TLDs.

🔒 DMCA-ignoré — votre contenu reste le vôtre
🆓 .sbs/.xyz gratuit avec hébergement
☁️ Intégration Cloudflare DNS incluse

<b>EN PLUS :</b> ✂️ Raccourcisseur Shortit
🔗 5 liens courts gratuits pour commencer
📊 Suivi des clics en temps réel
🌐 Utilisez VOTRE domaine comme URL courte

💰 Domaines à partir de <b>3$</b> | Raccourcisseur <b>GRATUIT</b>

Tapez <b>/start</b> → 🌐 Bulletproof Domains`,

      `🔗 <b>TRANSFORMEZ N'IMPORTE QUELLE URL EN LIEN COURT DE MARQUE</b>

Shortit — gratuit, rapide et traçable.

✂️ 5 liens gratuits — aucune inscription
🌐 Utilisez votre PROPRE domaine
📊 Analytics de clics en temps réel

<b>BESOIN D'UN DOMAINE ?</b>
🌐 400+ TLDs disponibles — blindés et offshore
🆓 .sbs/.xyz gratuit avec hébergement

💰 Liens courts : <b>GRATUIT</b> | Domaines à partir de <b>3$</b>

Tapez <b>/start</b> → 🔗 Raccourcisseur URL`,

      `🏴‍☠️ <b>DOMAINES BLINDÉS — 400+ TLDs DISPONIBLES</b>

Votre contenu ne devrait JAMAIS dépendre des registraires.

🌐 .com, .net, .org + 400 de plus
🔒 DMCA-ignoré — aucune suppression forcée
☁️ Cloudflare DNS + NS offshore
🆓 .sbs/.xyz gratuit avec hébergement

✂️ <b>Bonus :</b> 5 URLs courtes de marque GRATUITES !

💰 Domaines à partir de <b>3$</b>

Tapez <b>/start</b> → 🌐 Bulletproof Domains`,
    ],

    digital_products: [
      `🛒🔥 <b>COMPTES PREMIUM — LIVRÉS EN 30 MINUTES</b>

Aucune attente. Aucun problème de vérification. Prêt à l'emploi.

📞 Twilio — Main <b>450$</b> | Sub <b>200$</b>
📡 Telnyx — Main <b>400$</b> | Sub <b>150$</b>
☁️ AWS — Main <b>350$</b> | Sub <b>150$</b>
🌐 Google Cloud — <b>300$</b>
📧 Google Workspace — à partir de <b>100$</b>
📮 Zoho Mail — à partir de <b>100$</b>
📱 eSIM T-Mobile — <b>60$</b>

✅ Tous vérifiés et prêts à utiliser
💳 Crypto ou virement bancaire
🤖 Livraison instantanée sur Telegram

Des centaines de comptes livrés ce mois-ci 🚀

Tapez <b>/start</b> → 🛒 Produits Digitaux`,

      `⚡ <b>BESOIN D'UN COMPTE TWILIO, AWS OU GOOGLE CLOUD ?</b>

Obtenez-le en <b>30 minutes</b>. Vérifié. Prêt à l'emploi.

🔥 <b>Les plus populaires :</b>
📞 Twilio Sub — <b>200$</b>
📡 Telnyx Sub — <b>150$</b>
☁️ AWS Sub — <b>150$</b>
📱 eSIM T-Mobile — <b>60$</b>

💳 Crypto et virement acceptés
📦 Livré directement sur votre Telegram

Pourquoi attendre des jours ? ⏱️

Tapez <b>/start</b> → 🛒 Produits Digitaux`,

      `🎯 <b>ARRÊTEZ DE PERDRE DU TEMPS SUR LA VÉRIFICATION</b>

On gère la galère. Vous recevez un compte fonctionnel.

📞 Twilio — vérifié et financé
☁️ AWS — accès complet, sans restrictions
📧 Workspace & Zoho — email pro en minutes
📱 eSIM — T-Mobile USA, sans pièce d'identité

💰 À partir de <b>60$</b>
⚡ Livraison moyenne : <b>30 minutes</b>

Tapez <b>/start</b> → 🛒 Produits Digitaux`,
    ],

    cards_bundles: [
      `💳🔥 <b>CARTES VIRTUELLES. ÉTIQUETTES D'EXPÉDITION. TOUT EN UN BOT.</b>

Tout ce dont vous avez besoin — un seul bot Telegram.

💳 <b>Cartes Virtuelles</b> — paiements en ligne et vérifications
📦 <b>Étiquettes d'Expédition</b> — créez et suivez instantanément
🎁 <b>Packs Services</b> — économisez en combinant les services
💼 <b>Devenez Revendeur</b> — gagnez une commission sur chaque vente

💰 Cartes à partir de <b>5$</b> | Étiquettes à partir de <b>10$</b>
🎁 Packs : économisez <b>20%+</b>

Pourquoi utiliser 10 plateformes ? Nomadly a TOUT ⚡

Tapez <b>/start</b> pour tout explorer`,

      `🚀 <b>UN BOT. TOUS LES OUTILS DIGITAUX.</b>

Arrêtez de switcher entre les plateformes :

💳 Cartes Virtuelles — paiements instantanés
📦 Étiquettes d'Expédition — créez et suivez
📞 Cloud Phone — numéros dans 30+ pays
🌐 Domaines Blindés — 400+ TLDs
🛡️ Hébergement Anti-Red — zéro suppression
🛒 Produits Digitaux — Twilio, AWS et plus

💼 <b>Envie de gagner ?</b> Rejoignez le Programme Revendeur !

💰 À partir de <b>3$</b>

Tapez <b>/start</b> pour tout voir`,

      `💼 <b>GAGNEZ DE L'ARGENT AVEC CHAQUE PARRAINAGE</b>

Rejoignez le Programme Revendeur Nomadly.

✅ Vendez n'importe quel service à VOS clients
💰 Commission sur chaque vente
🔄 Livraison automatisée
📊 Suivi des revenus en temps réel

🔥 Nos meilleurs revendeurs gagnent <b>500$+/mois</b>

Tapez <b>/start</b> → 💼 Revendeur`,
    ],
  },

  // ═══════════════════ CHINESE ═══════════════════

  zh: {
    cloudphone: [
      `📞🔥 <b>60秒内获取任意国家的电话号码</b>

无需SIM卡。无需合同。无需身份验证。

🌍 30+国家可选
📱 即时接收来电、短信和语音信箱
🎙️ 自定义IVR问候语 — 展现专业形象
🔗 SIP集成，适用于高级配置
💬 全球呼叫转移

💰 仅需 <b>$50/月</b> 起

适用于隐私保护、远程商务或全球扩张 🌎

输入 <b>/start</b> → 📞 Cloud IVR + SIP`,

      `🚀 <b>需要一个私密电话号码？立即获取。</b>

无需证件。无需等待。选择国家即刻开通。

📞 30+国家虚拟号码
🎙️ 专业IVR — 来电者听到您的问候语
💬 短信转发至Telegram
🔐 100%隐私 — 无需个人信息

💰 <b>$50/月</b> 起，含通话分钟和短信

🔥 本月已激活500+号码！

输入 <b>/start</b> → 📞 Cloud IVR + SIP`,

      `🌍 <b>让您的业务拥有本地号码</b>

在任何国家获取电话号码 — 客户拨打本地号码，您在任何地方接听。

✅ 30+国家 — 美国、英国、加拿大、德国等
✅ IVR系统 — 按1转销售，按2转客服
✅ 短信 + 语音信箱 + 通话录音
✅ 包含SIP集成

💰 <b>$50/月</b> 起

不再错过国际商机 📈

输入 <b>/start</b> → 📞 Cloud IVR + SIP`,
    ],

    antired_hosting: [
      `🛡️🔥 <b>厌倦了网站被关停？</b>

Anti-Red托管让您的内容永远在线 — 无论如何。

🔒 无视DMCA的离岸服务器
🔥 Anti-Red扫描器自动拦截威胁
🌐 免费包含.sbs/.xyz域名
⚡ cPanel访问 + 一键安装
🛡️ 99.9%正常运行时间保证

💰 周计划 <b>$30</b> 起 | 月计划 <b>$75</b> 起

您的竞争对手已经使用离岸托管了 🏴‍☠️

输入 <b>/start</b> → 🛡️🔥 Anti-Red Hosting`,

      `🏴‍☠️ <b>让您的网站坚不可摧。零关停。</b>

当别人被关闭时，您的网站保持在线。

🛡️ <b>Anti-Red托管</b>包含：
• 无视DMCA的离岸服务器
• 实时威胁扫描器
• 免费域名（.sbs或.xyz）
• 完整的cPanel文件管理器

💰 仅需 <b>$30/周</b> 起

⚠️ 内容删除处于历史最高水平。
在为时已晚之前保护自己。

输入 <b>/start</b> → 🛡️🔥 Anti-Red Hosting`,

      `⚡ <b>您的内容。您的规则。零审查。</b>

Anti-Red = 离岸托管 + 反扫描保护。

🔒 永远不会有DMCA删除
🛡️ Anti-Red全天候保护
🌐 免费.sbs/.xyz域名
🖥️ 完整cPanel

💰 <b>$30/周</b> 或 <b>$75/月</b>

数百个网站已受保护 ✅

输入 <b>/start</b> → 🛡️🔥 Anti-Red Hosting`,
    ],

    leads_validation: [
      `🎯🔥 <b>想要带有机主姓名的真实电话线索？</b>

别再浪费时间在无效号码上了。

📋 按国家、区号和运营商获取批量电话线索
👤 CNAM查询 — 获取号码背后的真实姓名
✅ 实时验证 — 只提供活跃号码
📊 支持任何格式导出

💰 线索 <b>$0.025</b>/条 | CNAM <b>$0.015</b>/次

营销团队都在用。你也会爱上它 🚀

输入 <b>/start</b> → 🎯 Leads & Validation`,

      `📊 <b>别再拨打无效号码了。</b>

每个坏线索 = 浪费的时间和金钱。

🎯 按国家和运营商获取新鲜线索
✅ 即时验证号码是否有效
👤 CNAM：查看号码真实机主
📋 CSV、JSON — 随您导出

💰 <b>$0.025/条</b> 起

⚡ 每天在此机器人上验证数千条线索。

输入 <b>/start</b> → 🎯 Leads & Validation`,

      `👤 <b>了解每个电话号码背后的人</b>

CNAM + 验证线索 = 势不可挡的营销。

🎯 定向线索 — 选择国家、区号和运营商
📞 只交付验证过的活跃号码
👤 CNAM揭示真实机主姓名
💨 闪电般的Telegram交付

💰 线索：<b>$0.025</b> | CNAM：<b>$0.015</b>

您的竞争对手已经拥有这些数据。您呢？🤔

输入 <b>/start</b> → 🎯 Leads & Validation`,
    ],

    domains_shortener: [
      `🌐🔥 <b>您的域名。您的规则。零审查。</b>

在400+ TLD中注册防弹域名。

🔒 无视DMCA — 内容永远属于您
🆓 托管计划免费赠送.sbs/.xyz
☁️ 内置Cloudflare DNS集成

<b>另外：</b> ✂️ Shortit短链接
🔗 5个免费品牌短链接
📊 每个链接的点击追踪分析
🌐 使用您自己的域名作为短URL

💰 域名 <b>$3</b> 起 | 短链接 <b>免费</b>

输入 <b>/start</b> → 🌐 Bulletproof Domains`,

      `🔗 <b>将任何长URL变成品牌短链接</b>

Shortit — 免费、快速、可追踪。

✂️ 5个免费试用链接
🌐 使用您自己的域名
📊 实时点击分析

<b>需要域名？</b>
🌐 400+ TLD可选 — 防弹离岸
🆓 托管免费赠送.sbs/.xyz

💰 短链接：<b>免费</b> | 域名 <b>$3</b> 起

输入 <b>/start</b> → 🔗 URL缩短器`,

      `🏴‍☠️ <b>防弹域名 — 400+ TLD可选</b>

您的内容不应受制于注册商。

🌐 .com、.net、.org + 400更多
🔒 无视DMCA — 无强制删除
☁️ Cloudflare DNS + 离岸NS
🆓 购买托管免费赠送.sbs/.xyz

✂️ <b>额外奖励：</b>5个免费品牌短URL！

💰 域名 <b>$3</b> 起

输入 <b>/start</b> → 🌐 Bulletproof Domains`,
    ],

    digital_products: [
      `🛒🔥 <b>高级账户 — 30分钟内交付</b>

无需等待。无需验证烦恼。即插即用。

📞 Twilio — Main <b>$450</b> | Sub <b>$200</b>
📡 Telnyx — Main <b>$400</b> | Sub <b>$150</b>
☁️ AWS — Main <b>$350</b> | Sub <b>$150</b>
🌐 Google Cloud — <b>$300</b>
📧 Google Workspace — <b>$100</b> 起
📮 Zoho Mail — <b>$100</b> 起
📱 eSIM T-Mobile — <b>$60</b>

✅ 全部验证完毕，即可使用
💳 支持加密货币或银行转账
🤖 直接在Telegram即时交付

本月已交付数百个账户 🚀

输入 <b>/start</b> → 🛒 Digital Products`,

      `⚡ <b>需要Twilio、AWS或Google Cloud账户？</b>

<b>30分钟</b>内获取。完全验证。即可使用。

🔥 <b>最受欢迎：</b>
📞 Twilio Sub — <b>$200</b>
📡 Telnyx Sub — <b>$150</b>
☁️ AWS Sub — <b>$150</b>
📱 eSIM T-Mobile — <b>$60</b>

💳 支持加密货币和银行转账
📦 直接交付到您的Telegram

何必等几天？分钟即可拥有 ⏱️

输入 <b>/start</b> → 🛒 Digital Products`,

      `🎯 <b>别再浪费时间在账户验证上</b>

我们处理麻烦。您获得可用账户。

📞 Twilio — 已验证并充值
☁️ AWS — 完全访问，无限制
📧 Workspace & Zoho — 分钟内拥有商务邮箱
📱 eSIM — T-Mobile美国，无需身份证

💰 <b>$60</b> 起
⚡ 平均交付：<b>30分钟</b>

输入 <b>/start</b> → 🛒 Digital Products`,
    ],

    cards_bundles: [
      `💳🔥 <b>虚拟卡。运输标签。一个机器人搞定。</b>

您需要的一切 — 一个Telegram机器人。

💳 <b>虚拟卡</b> — 在线支付和验证
📦 <b>运输标签</b> — 即时生成和追踪
🎁 <b>服务套餐</b> — 组合购买享大折扣
💼 <b>成为经销商</b> — 每笔推荐赚取佣金

💰 卡片 <b>$5</b> 起 | 标签 <b>$10</b> 起
🎁 套餐节省 <b>20%+</b>

为什么使用10个平台？Nomadly全部搞定 ⚡

输入 <b>/start</b> 探索所有功能`,

      `🚀 <b>一个机器人。所有数字工具。</b>

不再在平台之间切换：

💳 虚拟卡 — 即时在线支付
📦 运输标签 — 秒级创建和追踪
📞 云电话 — 30+国家虚拟号码
🌐 防弹域名 — 400+ TLD
🛡️ Anti-Red托管 — 零关停
🛒 数字产品 — Twilio、AWS等

💼 <b>想赚钱？</b>加入经销商计划！

💰 <b>$3</b> 起

输入 <b>/start</b> 查看所有服务`,

      `💼 <b>每次推荐都能赚钱</b>

加入Nomadly经销商计划，建立您的收入。

✅ 将机器人上的任何服务卖给您的客户
💰 每笔销售赚取佣金
🔄 自动化交付 — 您无需动手
📊 实时追踪收入

🔥 顶级经销商月入 <b>$500+</b>

输入 <b>/start</b> → 💼 Reseller`,
    ],
  },

  // ═══════════════════ HINDI ═══════════════════

  hi: {
    cloudphone: [
      `📞🔥 <b>किसी भी देश में फोन नंबर पाएं — 60 सेकंड में</b>

कोई SIM कार्ड नहीं। कोई कॉन्ट्रैक्ट नहीं। कोई ID की झंझट नहीं।

🌍 30+ देश उपलब्ध
📱 तुरंत कॉल, SMS और वॉइसमेल प्राप्त करें
🎙️ कस्टम IVR ग्रीटिंग — पेशेवर दिखें
🔗 SIP इंटीग्रेशन एडवांस सेटअप के लिए
💬 दुनिया में कहीं भी कॉल फॉरवर्ड करें

💰 सिर्फ <b>$50/महीना</b> से शुरू

प्राइवेसी, रिमोट बिज़नेस या ग्लोबल विस्तार के लिए परफेक्ट 🌎

<b>/start</b> टाइप करें → 📞 Cloud IVR + SIP`,

      `🚀 <b>प्राइवेट फोन नंबर चाहिए? अभी पाएं।</b>

कोई कागजी कार्रवाई नहीं। कोई इंतजार नहीं। देश चुनें और शुरू करें।

📞 30+ देशों में वर्चुअल नंबर
🎙️ प्रोफेशनल IVR — कॉलर आपका ग्रीटिंग सुनते हैं
💬 SMS Telegram पर फॉरवर्ड
🔐 100% प्राइवेट — कोई पर्सनल जानकारी नहीं

💰 <b>$50/महीना</b> से, मिनट्स और SMS शामिल

🔥 इस महीने 500+ नंबर एक्टिवेट हुए!

<b>/start</b> टाइप करें → 📞 Cloud IVR + SIP`,

      `🌍 <b>आपके बिज़नेस को लोकल प्रेज़ेंस की जरूरत है</b>

किसी भी देश में फोन नंबर पाएं — ग्राहक लोकल नंबर पर कॉल करें, आप कहीं से भी उठाएं।

✅ 30+ देश — US, UK, कनाडा, जर्मनी और बहुत कुछ
✅ IVR सिस्टम — 1 दबाएं सेल्स के लिए, 2 सपोर्ट के लिए
✅ SMS + वॉइसमेल + कॉल रिकॉर्डिंग
✅ SIP इंटीग्रेशन शामिल

💰 <b>$50/महीना</b> से प्लान

अंतरराष्ट्रीय अवसर न चूकें 📈

<b>/start</b> टाइप करें → 📞 Cloud IVR + SIP`,
    ],

    antired_hosting: [
      `🛡️🔥 <b>आपकी साइट बार-बार हटाई जा रही है?</b>

Anti-Red Hosting आपका कंटेंट हमेशा LIVE रखता है।

🔒 DMCA-इग्नोर्ड ऑफशोर सर्वर
🔥 Anti-Red स्कैनर ऑटोमैटिक खतरे ब्लॉक करता है
🌐 मुफ्त .sbs/.xyz डोमेन शामिल
⚡ cPanel एक्सेस + वन-क्लिक सेटअप
🛡️ 99.9% अपटाइम गारंटी

💰 साप्ताहिक <b>$30</b> से | मासिक <b>$75</b> से

आपके प्रतिस्पर्धी पहले से ऑफशोर हैं 🏴‍☠️

<b>/start</b> टाइप करें → 🛡️🔥 Anti-Red Hosting`,

      `🏴‍☠️ <b>अपनी वेबसाइट को बुलेटप्रूफ बनाएं। ज़ीरो टेकडाउन।</b>

जब दूसरे बंद हो जाते हैं, आपकी साइट चालू रहती है।

🛡️ <b>Anti-Red Hosting</b> में शामिल:
• DMCA-इग्नोर्ड ऑफशोर सर्वर
• रियल-टाइम थ्रेट स्कैनर
• मुफ्त डोमेन (.sbs या .xyz)
• पूरा cPanel फाइल मैनेजर

💰 सिर्फ <b>$30/सप्ताह</b> से

⚠️ कंटेंट हटाने की दर रिकॉर्ड स्तर पर है।
देर होने से पहले सुरक्षित हो जाएं।

<b>/start</b> टाइप करें → 🛡️🔥 Anti-Red Hosting`,

      `⚡ <b>आपका कंटेंट। आपके नियम। ज़ीरो सेंसरशिप।</b>

Anti-Red = ऑफशोर + एंटी-स्कैनर प्रोटेक्शन।

🔒 कभी DMCA टेकडाउन नहीं
🛡️ Anti-Red ब्लॉकर 24/7 सुरक्षा
🌐 मुफ्त .sbs/.xyz डोमेन
🖥️ पूरा cPanel

💰 <b>$30/सप्ताह</b> या <b>$75/महीना</b>

सैकड़ों साइट्स पहले से सुरक्षित ✅

<b>/start</b> टाइप करें → 🛡️🔥 Anti-Red Hosting`,
    ],

    leads_validation: [
      `🎯🔥 <b>मालिक के नाम वाले असली फोन लीड्स चाहिए?</b>

बेकार नंबरों पर समय बर्बाद करना बंद करें।

📋 देश, एरिया कोड और कैरियर के अनुसार बल्क लीड्स
👤 CNAM लुकअप — हर नंबर के पीछे का असली नाम जानें
✅ रियल-टाइम वैलिडेशन — सिर्फ लाइव नंबर
📊 किसी भी फॉर्मेट में एक्सपोर्ट

💰 लीड्स <b>$0.025</b>/प्रति | CNAM <b>$0.015</b>/प्रति

मार्केटर्स इसे पसंद करते हैं। आप भी करेंगे 🚀

<b>/start</b> टाइप करें → 🎯 Leads & Validation`,

      `📊 <b>डेड नंबरों पर कॉल करना बंद करें।</b>

हर खराब लीड = बर्बाद समय + पैसा।

🎯 देश और कैरियर के अनुसार फ्रेश लीड्स
✅ तुरंत वेरिफाई करें कि नंबर LIVE है
👤 CNAM: फोन मालिक का असली नाम देखें
📋 CSV, JSON — जो चाहें एक्सपोर्ट करें

💰 <b>$0.025/लीड</b> से

⚡ इस बॉट पर रोज़ हज़ारों लीड्स वैलिडेट होते हैं।

<b>/start</b> टाइप करें → 🎯 Leads & Validation`,

      `👤 <b>हर फोन नंबर के पीछे कौन है, जानें</b>

CNAM + वैलिडेटेड लीड्स = अजेय आउटरीच।

🎯 टार्गेटेड लीड्स — देश, एरिया और कैरियर चुनें
📞 सिर्फ वेरिफाइड, एक्टिव नंबर
👤 CNAM से असली मालिक का नाम
💨 Telegram पर लाइटनिंग-फास्ट डिलीवरी

💰 लीड्स: <b>$0.025</b> | CNAM: <b>$0.015</b>

आपके प्रतिस्पर्धियों के पास ये डेटा है। क्या आपके पास है? 🤔

<b>/start</b> टाइप करें → 🎯 Leads & Validation`,
    ],

    domains_shortener: [
      `🌐🔥 <b>आपका डोमेन। आपके नियम। ज़ीरो सेंसरशिप।</b>

400+ TLDs में बुलेटप्रूफ डोमेन रजिस्टर करें।

🔒 DMCA-इग्नोर्ड — कंटेंट हमेशा आपका
🆓 होस्टिंग प्लान के साथ मुफ्त .sbs/.xyz
☁️ बिल्ट-इन Cloudflare DNS इंटीग्रेशन

<b>साथ में:</b> ✂️ Shortit URL शॉर्टनर
🔗 शुरुआत के लिए 5 मुफ्त ब्रांडेड शॉर्ट लिंक
📊 हर लिंक पर क्लिक ट्रैकिंग
🌐 अपने खुद के डोमेन को शॉर्ट URL के रूप में उपयोग करें

💰 डोमेन <b>$3</b> से | शॉर्टनर <b>मुफ्त</b>

<b>/start</b> टाइप करें → 🌐 Bulletproof Domains`,

      `🔗 <b>किसी भी लंबे URL को ब्रांडेड शॉर्ट लिंक में बदलें</b>

Shortit — मुफ्त, तेज़ और ट्रैक करने योग्य।

✂️ 5 मुफ्त ट्रायल लिंक
🌐 अपने खुद के डोमेन का उपयोग करें
📊 रियल-टाइम क्लिक एनालिटिक्स

<b>डोमेन चाहिए?</b>
🌐 400+ TLD उपलब्ध — बुलेटप्रूफ और ऑफशोर
🆓 होस्टिंग के साथ मुफ्त .sbs/.xyz

💰 शॉर्ट लिंक: <b>मुफ्त</b> | डोमेन <b>$3</b> से

<b>/start</b> टाइप करें → 🔗 URL शॉर्टनर`,

      `🏴‍☠️ <b>बुलेटप्रूफ डोमेन — 400+ TLD उपलब्ध</b>

आपका कंटेंट कभी रजिस्ट्रार की दया पर नहीं होना चाहिए।

🌐 .com, .net, .org + 400 और
🔒 DMCA-इग्नोर्ड — कोई जबरन हटाना नहीं
☁️ Cloudflare DNS + ऑफशोर NS
🆓 होस्टिंग लेने पर मुफ्त .sbs/.xyz

✂️ <b>बोनस:</b> 5 मुफ्त ब्रांडेड शॉर्ट URLs!

💰 डोमेन <b>$3</b> से

<b>/start</b> टाइप करें → 🌐 Bulletproof Domains`,
    ],

    digital_products: [
      `🛒🔥 <b>प्रीमियम अकाउंट — 30 मिनट में डिलीवर</b>

कोई इंतज़ार नहीं। कोई वेरिफिकेशन झंझट नहीं। बस प्लग एंड प्ले।

📞 Twilio — Main <b>$450</b> | Sub <b>$200</b>
📡 Telnyx — Main <b>$400</b> | Sub <b>$150</b>
☁️ AWS — Main <b>$350</b> | Sub <b>$150</b>
🌐 Google Cloud — <b>$300</b>
📧 Google Workspace — <b>$100</b> से
📮 Zoho Mail — <b>$100</b> से
📱 eSIM T-Mobile — <b>$60</b>

✅ सभी पूर्ण रूप से वेरिफाइड और उपयोग के लिए तैयार
💳 क्रिप्टो या बैंक ट्रांसफर से भुगतान

इस महीने सैकड़ों अकाउंट डिलीवर हुए 🚀

<b>/start</b> टाइप करें → 🛒 Digital Products`,

      `⚡ <b>Twilio, AWS या Google Cloud अकाउंट चाहिए?</b>

<b>30 मिनट</b> में पाएं। पूरी तरह वेरिफाइड। तैयार।

🔥 <b>सबसे लोकप्रिय:</b>
📞 Twilio Sub — <b>$200</b>
📡 Telnyx Sub — <b>$150</b>
☁️ AWS Sub — <b>$150</b>
📱 eSIM T-Mobile — <b>$60</b>

💳 क्रिप्टो और बैंक पेमेंट स्वीकार्य
📦 सीधे आपके Telegram पर डिलीवर

दिनों का इंतज़ार क्यों? मिनटों में पाएं ⏱️

<b>/start</b> टाइप करें → 🛒 Digital Products`,

      `🎯 <b>अकाउंट वेरिफिकेशन पर समय बर्बाद करना बंद करें</b>

हम झंझट संभालते हैं। आपको चालू अकाउंट मिलता है।

📞 Twilio — वेरिफाइड और फंडेड
☁️ AWS — पूर्ण एक्सेस, कोई प्रतिबंध नहीं
📧 Workspace & Zoho — मिनटों में बिज़नेस ईमेल
📱 eSIM — T-Mobile USA, बिना ID

💰 <b>$60</b> से शुरू
⚡ औसत डिलीवरी: <b>30 मिनट</b>

<b>/start</b> टाइप करें → 🛒 Digital Products`,
    ],

    cards_bundles: [
      `💳🔥 <b>वर्चुअल कार्ड। शिपिंग लेबल। सब एक बॉट में।</b>

आपको जो चाहिए वो सब — एक Telegram बॉट।

💳 <b>वर्चुअल कार्ड</b> — ऑनलाइन पेमेंट और वेरिफिकेशन
📦 <b>शिपिंग लेबल</b> — तुरंत जनरेट और ट्रैक करें
🎁 <b>सर्विस बंडल</b> — कॉम्बो में बड़ी बचत
💼 <b>रिसेलर बनें</b> — हर रेफरल पर कमीशन कमाएं

💰 कार्ड <b>$5</b> से | लेबल <b>$10</b> से
🎁 बंडल में <b>20%+</b> बचत

10 प्लेटफॉर्म क्यों? Nomadly में सब है ⚡

<b>/start</b> टाइप करें`,

      `🚀 <b>एक बॉट। हर डिजिटल टूल।</b>

प्लेटफॉर्म्स के बीच स्विच करना बंद करें:

💳 वर्चुअल कार्ड — इंस्टेंट ऑनलाइन पेमेंट
📦 शिपिंग लेबल — सेकंड में बनाएं और ट्रैक करें
📞 क्लाउड फोन — 30+ देशों में वर्चुअल नंबर
🌐 बुलेटप्रूफ डोमेन — 400+ TLD
🛡️ Anti-Red होस्टिंग — ज़ीरो टेकडाउन
🛒 डिजिटल प्रोडक्ट्स — Twilio, AWS और बहुत कुछ

💼 <b>कमाना चाहते हैं?</b> रिसेलर प्रोग्राम जॉइन करें!

💰 <b>$3</b> से शुरू

<b>/start</b> टाइप करें`,

      `💼 <b>हर रेफरल से पैसे कमाएं</b>

Nomadly रिसेलर प्रोग्राम जॉइन करें और आय बनाएं।

✅ बॉट पर कोई भी सर्विस अपने ग्राहकों को बेचें
💰 हर बिक्री पर कमीशन
🔄 ऑटोमेटेड डिलीवरी — आपको कुछ नहीं करना
📊 रियल-टाइम में कमाई ट्रैक करें

🔥 हमारे टॉप रिसेलर <b>$500+/महीना</b> कमाते हैं

<b>/start</b> टाइप करें → 💼 Reseller`,
    ],
  },
}

// ═══════════════════════════════════════════════════════════════════════

function localToUtc(localHour, localMinute, offsetHours) {
  let utcHour = localHour - Math.floor(offsetHours)
  let utcMinute = localMinute - Math.round((offsetHours % 1) * 60)
  if (utcMinute < 0) { utcMinute += 60; utcHour -= 1 }
  if (utcMinute >= 60) { utcMinute -= 60; utcHour += 1 }
  if (utcHour < 0) utcHour += 24
  if (utcHour >= 24) utcHour -= 24
  return { hour: utcHour, minute: utcMinute }
}

// ─── Initialize Auto-Promo System ─────────────────────────────────────
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

  const OPTOUT_TTL_DAYS = 7
  const PERMANENT_OPTOUT_REASONS = ['chat_not_found', 'user_deactivated']

  async function isOptedOut(chatId) {
    const record = await promoOptOut.findOne({ _id: chatId })
    if (!record?.optedOut) return false
    if (PERMANENT_OPTOUT_REASONS.includes(record.reason)) return true
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

  function classifyOptOutReason(error) {
    const msg = error.message || ''
    if (msg.includes('chat not found')) return 'chat_not_found'
    if (msg.includes('user is deactivated')) return 'user_deactivated'
    if (msg.includes('bot was blocked')) return 'bot_blocked'
    if (msg.includes('have no rights to send a message')) return 'no_rights'
    return 'unknown'
  }

  // GIF assets for visual promos
  const path = require('path')
  const SHOWCASE_GIF = path.join(__dirname, 'assets', 'nomadly-showcase-promo.gif')
  const CLOUDPHONE_GIF = path.join(__dirname, 'assets', 'cloudphone-business-promo.gif')

  // Themes that use GIF banners (sends as animation with caption)
  const GIF_THEMES = {
    cloudphone: CLOUDPHONE_GIF,
    antired_hosting: SHOWCASE_GIF,
    cards_bundles: SHOWCASE_GIF,
  }

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
        const gifPath = GIF_THEMES[theme]

        // Try sending with GIF for visual themes
        if (gifPath) {
          try {
            const fs = require('fs')
            if (fs.existsSync(gifPath)) {
              await bot.sendAnimation(chatId, gifPath, { caption, ...opts })
              return
            }
          } catch (gifErr) {
            if (isUnreachableError(gifErr)) throw gifErr
            log(`[AutoPromo] GIF failed for ${chatId}, text fallback: ${gifErr.message}`)
          }
        }

        // Text-only fallback
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
      log(`[AutoPromo] Skipping broadcast for ${lang} — no theme index (likely rest day)`)
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
          couponLine = `🎫 <b>TODAY ONLY:</b> Use code <code>${code}</code> for ${info.discount}% off!`
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

  // ─── Day-of-week → Theme mapping ─────────────────────────────────
  function getTodayThemes() {
    const day = new Date().getDay()
    // Sun=0: rest, Mon=1: cloudphone, Tue=2: antired, Wed=3: leads,
    // Thu=4: domains, Fri=5: digital, Sat=6: cards/bundles
    if (day === 0) return [] // Sunday — no promo
    return [day - 1] // Mon→0, Tue→1, Wed→2, Thu→3, Fri→4, Sat→5
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
          log(`[AutoPromo] Skipping ${lang} slot ${slotIndex + 1} — no promo today (rest day)`)
          return
        }
        log(`[AutoPromo] Triggered ${THEMES[themeIndex]} for ${lang} (local ${localTime.hour}:${String(localTime.minute).padStart(2, '0')})`)
        broadcastPromoForLang(themeIndex, lang).catch(err => log(`[AutoPromo] Broadcast error: ${err.message}`))
      })
      log(`[AutoPromo] Scheduled slot ${slotIndex + 1} for ${lang.toUpperCase()} at local ${localTime.hour}:${String(localTime.minute).padStart(2, '0')} (UTC ${utcTime.hour}:${String(utcTime.minute).padStart(2, '0')})`)
      scheduledCount++
    })
  }

  log(`[AutoPromo] Initialized — ${scheduledCount} jobs (${supportedLangs.length} langs × ${LOCAL_TIMES.length} slots), ${THEMES.length} themes: ${THEMES.join(', ')}`)

  return {
    setOptOut,
    isOptedOut,
    broadcastPromoForLang,
    setDailyCouponSystem,
    getPromoMessages: () => promoMessages,
    getThemes: () => THEMES,
  }
}

module.exports = { initAutoPromo, promoMessages }
