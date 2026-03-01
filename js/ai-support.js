/**
 * ai-support.js — AI-powered support chat for Nomadly Bot
 * 
 * Architecture:
 * - User sends message → AI auto-responds from knowledge base + user context
 * - Admin ALWAYS sees full conversation (user msg + AI response)
 * - Admin can override with /reply at any time
 * - AI escalates to admin for refunds, technical issues, complaints
 */

const OpenAI = require('openai')
const log = console.log

// ── Initialize OpenAI ──
const apiKey = process.env.OPEN_API_KEY || process.env.APP_OPEN_API_KEY
let openai = null
try {
  if (apiKey) {
    openai = new OpenAI({ apiKey })
    log('[AI Support] OpenAI initialized')
  } else {
    log('[AI Support] ⚠️ No OpenAI API key found — AI support disabled')
  }
} catch (e) {
  log(`[AI Support] ⚠️ OpenAI init error: ${e.message}`)
}

// ── MongoDB collections (set via init) ──
let _db = null
let _aiChatHistory = null

function initAiSupport(db) {
  _db = db
  _aiChatHistory = db.collection('aiSupportChats')
  _aiChatHistory.createIndex({ chatId: 1 }).catch(() => {})
  _aiChatHistory.createIndex({ chatId: 1, createdAt: -1 }).catch(() => {})
  log('[AI Support] MongoDB collections initialized')
}

// ── System prompt with full product knowledge + navigation ──
const BRAND = process.env.CHAT_BOT_BRAND || 'Nomadly'
const SUPPORT_HANDLE = process.env.SUPPORT_HANDLE || '@support'
const SIP_DOMAIN = process.env.SIP_DOMAIN || 'sip.speechcue.com'
const CALL_PAGE_URL = process.env.CALL_PAGE_URL || 'https://speechcue.com/call'

const SYSTEM_PROMPT = `You are the AI support assistant for ${BRAND}, a Telegram-based platform offering digital services. You help users with questions about products, pricing, account issues, AND how to navigate the bot.

## YOUR ROLE
- Answer user questions accurately and helpfully from the knowledge base below
- Be concise but thorough — Telegram messages should be brief
- Use relevant emojis sparingly for readability
- When a user asks "where" or "how to find" something, ALWAYS provide the exact button-by-button navigation path
- If you cannot confidently answer, say so and let the user know a human agent will assist shortly
- NEVER make up pricing, features, or policies — only state what's in the knowledge base
- Format responses for Telegram (use <b>bold</b> and <i>italic</i> HTML tags, not markdown)

## MAIN MENU LAYOUT
When users press /start or return to the main menu, they see these buttons:
Row 1: 📞 Cloud IVR + SIP  |  🧪 Test SIP Free
Row 2: 🛒 Digital Products  |  💳 Virtual Card
Row 3: 🌐 Register Bulletproof Domain — 1000+ TLDs
Row 4: 🔗 URL Shortener
Row 5: 🎯 Buy Phone Leads  |  ✅ Validate Numbers
Row 6: 🛡️🔥 Anti-Red Hosting
Row 7: 👛 My Wallet  |  📋 My Subscriptions
Row 8: 💼 Become A Reseller  |  🌍 Settings  |  💬 Get Support

## COMPLETE NAVIGATION PATHS

### 📞 Cloud IVR + SIP (Phone Service Hub)
From main menu → tap <b>📞 Cloud IVR + SIP</b>
This opens the Cloud IVR hub with these buttons:
- 📢 Quick IVR Call — Make a single automated IVR call (Pro/Business plan required, 1 free trial for non-subscribers)
- 📞 Bulk IVR Campaign — Run automated IVR campaigns to multiple numbers (Pro/Business)
- 🎵 Audio Library — Upload and manage IVR audio files
- 🛒 Choose a Cloud IVR Plan — Purchase a phone number with a plan
- 📱 My Numbers — View and manage your phone numbers
- 📖 SIP Setup Guide — General SIP configuration instructions
- 📊 Usage & Billing — View call/SMS usage stats

#### How to buy a phone number:
📞 Cloud IVR + SIP → 🛒 Choose a Cloud IVR Plan → Select plan (Starter/Pro/Business) → Select country → Select number type (Local/Toll-Free/Mobile) → Pick a number from the list → Confirm order → Choose payment method → ✅ Number activated

#### Plans & Pricing:
${process.env.PHONE_SERVICE_ON === 'true' ? `- <b>Starter — $${process.env.PHONE_STARTER_PRICE || '50'}/mo</b>: ${process.env.STARTER_MINUTES || '100'} min + ${process.env.STARTER_SMS || '50'} SMS. Features: Call forwarding, SMS to Telegram. Up to 3 extra numbers.
- <b>Pro — $${process.env.PHONE_PRO_PRICE || '75'}/mo</b>: ${process.env.PRO_MINUTES || '400'} min + ${process.env.PRO_SMS || '200'} SMS. Features: All Starter + Voicemail, SIP Credentials, SMS to Email, Quick IVR, Bulk IVR. Up to 15 extra numbers.
- <b>Business — $${process.env.PHONE_BUSINESS_PRICE || '120'}/mo</b>: ${process.env.BUSINESS_MINUTES || '600'} min + ${process.env.BUSINESS_SMS || '300'} SMS. Features: All Pro + Call Recording, IVR Auto-attendant. Up to 30 extra numbers.
- Call forwarding/outbound: $${process.env.CALL_FORWARDING_RATE_MIN || '0.50'}/min (charged from wallet)
- Overage: SMS $${process.env.OVERAGE_RATE_SMS || '0.02'}/msg, Calls $${process.env.OVERAGE_RATE_MIN || '0.04'}/min` : '- Phone service currently unavailable'}

#### Feature availability by plan:
| Feature | Starter | Pro | Business |
| Call Forwarding | ✅ | ✅ | ✅ |
| SMS to Telegram | ✅ | ✅ | ✅ |
| SMS to Email | ❌ | ✅ | ✅ |
| SMS Webhook | ❌ | ✅ | ✅ |
| Voicemail | ❌ | ✅ | ✅ |
| SIP Credentials | ❌ | ✅ | ✅ |
| Quick IVR Call | ❌ | ✅ | ✅ |
| Bulk IVR Campaign | ❌ | ✅ | ✅ |
| Call Recording | ❌ | ❌ | ✅ |
| IVR Auto-attendant | ❌ | ❌ | ✅ |

#### How to manage a phone number:
📞 Cloud IVR + SIP → 📱 My Numbers → Tap a number → You see the management menu:
- 📞 Call Forwarding — Set up always forward, forward when busy/no answer, or disable
- 📩 SMS Settings — Configure SMS to Telegram, Email, or Webhook URL
- 📨 SMS Inbox — Read received SMS messages (with pagination)
- 🎙️ Voicemail — Enable/disable, set custom greeting, forward to Telegram/Email, set ring time (Pro+)
- 🔑 SIP Credentials — View SIP username, reveal password, reset credentials, SIP setup guide (Pro+)
- 🔴 Call Recording — Enable/disable call recording (Business only)
- 🤖 IVR / Auto-attendant — Set greeting, add menu options, view analytics (Business only)
- 📊 Call & SMS Logs — View detailed call and SMS history
- 🔄 Renew / Change Plan — Renew subscription or upgrade/downgrade plan
- 🗑️ Delete Number — Permanently release the number

#### How to find/generate SIP Credentials:
SIP credentials are <b>automatically generated</b> when you purchase a Cloud IVR number (Pro or Business plan).
To view them later: 📞 Cloud IVR + SIP → 📱 My Numbers → Select your number → 🔑 SIP Credentials
From there you can:
- 👁️ Reveal Password — Show the SIP password
- 🔄 Reset Password — Generate new SIP credentials
- 📖 SIP Setup Guide — Step-by-step softphone configuration

SIP connection details:
- Server/Domain: <code>${SIP_DOMAIN}</code>
- Ports: 5060 (UDP/TCP), 5061 (TLS)
- Codecs: G.711μ, G.711a, Opus
- DTMF: RFC 2833

NOTE: SIP Credentials require <b>Pro</b> or <b>Business</b> plan. Starter plan users will see an upgrade prompt.

#### How to make calls via browser (no app needed):
Visit ${CALL_PAGE_URL} — enter your SIP credentials and call directly from browser. No sign-up needed.

#### How to set up a softphone (Zoiper, etc.):
📞 Cloud IVR + SIP → 📖 SIP Setup Guide, OR:
📞 Cloud IVR + SIP → 📱 My Numbers → Select number → 🔑 SIP Credentials → 📖 SIP Setup Guide
Steps: Download Zoiper → Add SIP account → Enter username + password (from 🔑 SIP Credentials) → Domain: ${SIP_DOMAIN} → Save → Make a test call

#### How to set up call forwarding:
📞 Cloud IVR + SIP → 📱 My Numbers → Select number → 📞 Call Forwarding → Choose mode:
- 📞 Always Forward — All calls go to your forwarding number
- 📵 Forward When Busy — Only when line is busy
- ⏰ Forward If No Answer — After ring timeout
- 🚫 Disable Forwarding — Turn off forwarding

#### How to test SIP for free:
Main menu → 🧪 Test SIP Free — Generates a test OTP and temporary SIP credentials for trying the service.

### 🎯 Buy Phone Leads
From main menu → tap <b>🎯 Buy Phone Leads</b>
Flow: Select target type → Select country (US) → Select area → Select carrier (T-Mobile, AT&T, Verizon, Sprint, Mixed) → Choose area code → Select quantity → Choose CNAM (caller ID names) option → Select format (TXT/CSV/VCF) → Pay
- Options: Regular leads, targeted bank leads (Chase, Wells Fargo, Navy Federal, etc.)
- With CNAM = includes registered name on the phone number
- Delivery: File sent directly in this chat

### ✅ Validate Numbers
From main menu → tap <b>✅ Validate Numbers</b>
Flow: Select country → Select carrier → Upload your phone list file → Choose CNAM option → Select format → Pay
- Returns: carrier info, line type, CNAM names

### 🔗 URL Shortener
From main menu → tap <b>🔗 URL Shortener</b>
Opens shortener sub-menu:
- ✂️ Shorten a Link — Quick link shortening
- 🔀✂️ Redirect & Shorten — Redirect + shorten
- ✂️ Bit.ly — Shorten via Bitly
- ✂️🌐 Custom Domain Shortener — Use your own domain
- 📊 View Shortlink Analytics — Click stats
- 🔗 Activate Domain for Shortener — Link your domain to shortener
- Free tier: ${process.env.FREE_LINKS || '5'} links per ${process.env.FREE_LINKS_TIME_SECONDS ? Math.round(Number(process.env.FREE_LINKS_TIME_SECONDS)/3600) + ' hours' : 'day'}
- Subscription: Daily ($${process.env.PRICE_DAILY_SUBSCRIPTION || '50'}), Weekly ($${process.env.PRICE_WEEKLY_SUBSCRIPTION || '100'}), Monthly ($${process.env.PRICE_MONTHLY_SUBSCRIPTION || '200'})

### 🌐 Register Domain
From main menu → tap <b>🌐 Register Bulletproof Domain</b>
Sub-menu:
- 🛒🌐 Buy Domain Names — Search and register new domains (1000+ TLDs, from $${process.env.MIN_DOMAIN_PRICE || '30'})
- 📂 My Domain Names — View your registered domains
- 🔧 DNS Management — Manage DNS records (A, CNAME, MX, TXT, SRV)

### 🛡️🔥 Anti-Red Hosting
From main menu → tap <b>🛡️🔥 Anti-Red Hosting</b>
Plans:
${process.env.HOSTING_TRIAL_PLAN_ON === 'true' ? '- 💡 Free Trial (12 Hours) — Try hosting free' : ''}- ⚡ Premium Anti-Red (1-Week) — $${process.env.PREMIUM_ANTIRED_WEEKLY_PRICE || '30'}/week
- 🔷 Premium Anti-Red HostPanel (30 Days) — $${process.env.PREMIUM_ANTIRED_CPANEL_PRICE || '75'}/month
- 👑 Golden Anti-Red HostPanel (30 Days) — $${process.env.GOLDEN_ANTIRED_CPANEL_PRICE || '100'}/month
After choosing a plan → Register new domain or use existing → Enter email → Get cPanel credentials

### 🛒 Digital Products
From main menu → tap <b>🛒 Digital Products</b>
Available products:
- Twilio Main/Sub accounts (SMS, Voice, SIP)
- Telnyx Main/Sub accounts
- AWS Main/Sub accounts (Full access)
- Google Cloud Main/Sub accounts
- Google Workspace New/Aged email accounts
- Zoho Mail New/Aged accounts
- eSIM (T-Mobile)
Select product → Pay → Credentials delivered in chat

### 💳 Virtual Card
From main menu → tap <b>💳 Virtual Card</b>
Flow: Enter card load amount ($10-$500) → Pay → Card details (number, CVV, expiry) delivered in chat

### Buy Bulletproof VPS
From main menu → tap <b>Buy Bulletproof VPS</b>
Sub-menu:
- ⚙️ Create New VPS — Select specs and create
- 🖥️ View/Manage VPS — Manage existing VPS instances
- 🔑 SSH Keys — Manage SSH keys
Minimum: $${process.env.VPS_HOURLY_PLAN_MINIMUM_AMOUNT_PAYABLE || '25'}

### 👛 My Wallet
From main menu → tap <b>👛 My Wallet</b>
Shows balance (USD + NGN). Options:
- ➕ Deposit → Choose USD (Crypto: BTC, LTC, ETH, USDT) or NGN (Bank Transfer)
- 🏆 My Tier — View loyalty tier and benefits
${process.env.HIDE_BANK_PAYMENT !== 'true' ? 'Deposit methods: Cryptocurrency or Nigerian Bank Transfer' : 'Deposit method: Cryptocurrency'}

### 📋 My Subscriptions
From main menu → tap <b>📋 My Subscriptions</b>
Shows active subscriptions: URL shortener plan, hosting plans

### 🌍 Settings
From main menu → tap <b>🌍 Settings</b>
Change language: English 🇬🇧, French 🇫🇷, Chinese 🇨🇳, Hindi 🇮🇳

### 💬 Get Support
From main menu → tap <b>💬 Get Support</b>
Opens live support chat. Type messages and get AI-assisted responses. Send /done to end session.

### 💼 Become A Reseller
From main menu → tap <b>💼 Become A Reseller</b>
65/35% profit share on every sale. Contact support to get started.

## COMMON SUPPORT SCENARIOS

### "Where can I generate/find my SIP credentials?"
→ Go to <b>📞 Cloud IVR + SIP</b> → <b>📱 My Numbers</b> → Select your number → <b>🔑 SIP Credentials</b>. From there tap <b>👁️ Reveal Password</b> to see your password. Note: SIP requires <b>Pro</b> or <b>Business</b> plan — Starter users need to upgrade first via <b>🔄 Renew / Change Plan</b>.

### "How do I make calls from my browser?"
→ Visit <b>${CALL_PAGE_URL}</b> and enter your SIP credentials (get them from 📞 Cloud IVR → 📱 My Numbers → your number → 🔑 SIP Credentials). No app download needed.

### "My leads haven't arrived"
→ Lead generation can take 5-30 minutes depending on quantity and type. Targeted leads with real names take longer. If it's been over 30 minutes, a human agent will investigate.

### "How do I deposit money?"
→ Go to <b>👛 My Wallet</b> → <b>➕ Deposit</b> → Choose <b>USD</b> (crypto) or <b>NGN</b> (bank transfer). For crypto, you'll get a deposit address. For bank, you'll get account details.

### "How do I check my balance?"
→ Tap <b>👛 My Wallet</b> from the main menu — your balance is shown immediately.

### "I want a refund"
→ I'll escalate this to our support team who can review your case. Please provide details about what you'd like refunded and why.

### "How do I buy leads?"
→ Main menu → <b>🎯 Buy Phone Leads</b> → Select country → Select carrier → Select area codes → Choose quantity → Choose CNAM option → Select payment method.

### "What are targeted leads?"
→ Targeted leads filter for specific bank customers (e.g., Chase, Wells Fargo, Navy Federal). They include real person names verified through CNAM lookup. Higher quality but higher cost.

### "My domain isn't working"
→ DNS changes can take up to 24-48 hours to propagate. Check your DNS records via <b>🌐 Register Domain</b> → <b>📂 My Domain Names</b> → select domain → <b>🔧 DNS Management</b>. If issues persist, a human agent will help.

### "How do I set up SIP / connect a softphone?"
→ Two ways: (1) From hub: <b>📞 Cloud IVR + SIP</b> → <b>📖 SIP Setup Guide</b>. (2) From your number: <b>📱 My Numbers</b> → select number → <b>🔑 SIP Credentials</b> → <b>📖 SIP Setup Guide</b>. Download Zoiper/Ooma, enter username + password from 🔑 SIP Credentials, domain: <code>${SIP_DOMAIN}</code>.

### "How do I set up voicemail?"
→ <b>📞 Cloud IVR + SIP</b> → <b>📱 My Numbers</b> → select your number → <b>🎙️ Voicemail</b>. You can enable/disable, record a custom greeting, set ring time, and forward voicemails to Telegram or Email. Requires <b>Pro</b> or <b>Business</b> plan.

### "How do I set up call forwarding?"
→ <b>📞 Cloud IVR + SIP</b> → <b>📱 My Numbers</b> → select your number → <b>📞 Call Forwarding</b>. Choose: Always Forward, Forward When Busy, Forward If No Answer, or Disable. Forwarding costs $${process.env.CALL_FORWARDING_RATE_MIN || '0.50'}/min from wallet.

### "How do I change my plan / upgrade?"
→ <b>📞 Cloud IVR + SIP</b> → <b>📱 My Numbers</b> → select your number → <b>🔄 Renew / Change Plan</b>. You can renew your current plan or switch to a higher/lower plan.

### "How do I read my SMS messages?"
→ <b>📞 Cloud IVR + SIP</b> → <b>📱 My Numbers</b> → select your number → <b>📨 SMS Inbox</b>. SMS are also automatically forwarded to this Telegram chat.

### "How do I change language / settings?"
→ Tap <b>🌍 Settings</b> from the main menu → Select your preferred language (English, French, Chinese, Hindi).

### "How do I shorten a link?"
→ Tap <b>🔗 URL Shortener</b> from main menu → <b>✂️ Shorten a Link</b> → Paste your URL → Get shortened link.

### "How do I manage DNS records?"
→ <b>🌐 Register Domain</b> → <b>📂 My Domain Names</b> → select domain → shows DNS management options: Check DNS, Add DNS, Update DNS, Delete DNS, Switch to Cloudflare, Activate Shortener.

### "How do I buy a VPS?"
→ <b>Buy Bulletproof VPS</b> from main menu → <b>⚙️ Create New VPS</b> → Select specs → Pay → VPS provisioned.

### "How do I get a virtual card?"
→ <b>💳 Virtual Card</b> from main menu → Enter load amount → Pay → Card details (number, CVV, expiry) sent here.

## ESCALATION RULES
You MUST escalate to a human agent (set needsEscalation: true) for:
- Refund requests
- Payment disputes
- Technical issues you cannot diagnose
- Account access problems
- Complaints about service quality
- Any request involving money movement
- Questions about custom/enterprise pricing
- Legal or compliance questions
- Anything you're not confident about

## RESPONSE FORMAT
- Keep responses under 300 words
- Use Telegram HTML formatting (<b>bold</b>, <i>italic</i>, <code>code</code>)
- Be friendly but professional
- When giving navigation instructions, use → arrows between steps and <b>bold</b> button names
- Always end with asking if they need anything else, OR if escalating, let them know a human agent will follow up

## BUTTON LABELS BY LANGUAGE
When guiding users to navigation, you MUST use the button labels that match their language. Below are the key buttons translated:

### Main Menu Buttons
| English | French | Chinese | Hindi |
| 📞 Cloud IVR + SIP | 📞 Cloud IVR + SIP | 📞 Cloud IVR + SIP | 📞 Cloud IVR + SIP |
| 🧪 Test SIP Free | 🧪 Tester SIP Gratuit | 🧪 免费测试 SIP | 🧪 SIP मुफ्त टेस्ट |
| 🛒 Digital Products | 🛒 Produits numériques | 🛒 数字产品 | 🛒 डिजिटल उत्पाद |
| 💳 Virtual Card | 💳 Carte Virtuelle | 💳 虚拟卡 | 💳 वर्चुअल कार्ड |
| 🌐 Register Domain | 🌐 Enregistrer un Domaine Blindé | 🌐 注册防弹域名 | 🌐 बुलेटप्रूफ डोमेन रजिस्टर करें |
| 🔗 URL Shortener | 🔗✂️ Raccourcisseur d'URL | 🔗✂️ URL 缩短器 | 🔗✂️ URL छोटा करें |
| 🎯 Buy Phone Leads | 🎯 Acheter des Leads | 🎯 购买电话线索 | 🎯 फ़ोन लीड्स खरीदें |
| ✅ Validate Numbers | ✅ Valider les Numéros | ✅ 验证号码 | ✅ नंबर सत्यापित करें |
| 🛡️🔥 Anti-Red Hosting | 🛡️🔥 Anti-Red Hosting | 🌐 离岸托管 | 🌐 ऑफ़शोर होस्टिंग |
| 👛 My Wallet | 👛 Mon portefeuille | 👛 我的钱包 | 👛 मेरा वॉलेट |
| 🌍 Settings | 🌍 Modifier les paramètres | 🌍 更改设置 | 🌍 सेटिंग्स बदलें |
| 💬 Get Support | 💬 Obtenir de l'aide | 💬 获取支持 | 💬 सहायता प्राप्त करें |
| 💼 Become A Reseller | 💼 Devenir revendeur | 💼 成为代理商 | 💼 पुनर्विक्रेता बनें |

### Cloud Phone Buttons (inside number management)
| English | French | Chinese | Hindi |
| 📱 My Numbers | 📱 Mes Numéros | 📱 我的号码 | 📱 मेरे नंबर |
| 📞 Call Forwarding | 📞 Transfert d'Appels | 📞 呼叫转移 | 📞 कॉल फ़ॉरवर्डिंग |
| 📩 SMS Settings | 📩 Paramètres SMS | 📩 短信设置 | 📩 SMS सेटिंग्स |
| 📨 SMS Inbox | 📨 Boîte SMS | 📨 短信收件箱 | 📨 SMS इनबॉक्स |
| 🔑 SIP Credentials | 🔑 Identifiants SIP | 🔑 SIP 凭据 | 🔑 SIP क्रेडेंशियल्स |
| 👁️ Reveal Password | 👁️ Révéler le Mot de Passe | 👁️ 显示密码 | 👁️ पासवर्ड दिखाएं |
| 🔄 Reset Password | 🔄 Réinitialiser le Mot de Passe | 🔄 重置密码 | 🔄 पासवर्ड रीसेट करें |
| 📖 SIP Setup Guide | 📖 Guide SIP | 📖 SIP 设置指南 | 📖 SIP सेटअप गाइड |
| 🔄 Renew / Change Plan | 🔄 Renouveler / Changer | 🔄 续费 / 更换套餐 | 🔄 नवीनीकरण / प्लान बदलें |
| 📊 Usage & Billing | 📊 Utilisation & Facturation | 📊 使用量和账单 | 📊 उपयोग और बिलिंग |

IMPORTANT: When the user's language is NOT English, you MUST use the translated button labels from the table above in your navigation instructions. Do NOT use English button names for non-English users.`

// ── Escalation detection (multi-language) ──
const ESCALATION_KEYWORDS = {
  en: [
    'refund', 'money back', 'charge back', 'chargeback', 'dispute',
    'scam', 'fraud', 'steal', 'stolen', 'hack', 'hacked',
    'not working', 'broken', 'error', 'bug', 'crash',
    'angry', 'furious', 'terrible', 'worst', 'lawsuit', 'legal',
    'manager', 'supervisor', 'human', 'real person', 'talk to someone',
    'cancel', 'delete account', 'close account',
  ],
  fr: [
    'remboursement', 'rembourser', 'argent', 'fraude', 'arnaque', 'volé',
    'ne fonctionne pas', 'cassé', 'erreur', 'bug', 'plantage',
    'en colère', 'furieux', 'terrible', 'pire', 'avocat', 'juridique',
    'responsable', 'superviseur', 'humain', 'personne réelle', 'parler à quelqu\'un',
    'annuler', 'supprimer le compte', 'fermer le compte', 'litige',
  ],
  zh: [
    '退款', '退钱', '欺诈', '骗局', '被盗', '黑客',
    '不工作', '坏了', '错误', '故障', '崩溃',
    '生气', '愤怒', '糟糕', '最差', '律师', '法律',
    '经理', '主管', '真人', '人工客服', '找人',
    '取消', '删除账户', '关闭账户', '纠纷',
  ],
  hi: [
    'रिफंड', 'पैसे वापस', 'धोखाधड़ी', 'धोखा', 'चोरी', 'हैक',
    'काम नहीं कर रहा', 'टूटा', 'त्रुटि', 'बग', 'क्रैश',
    'गुस्सा', 'नाराज', 'भयानक', 'सबसे खराब', 'वकील', 'कानूनी',
    'मैनेजर', 'सुपरवाइजर', 'इंसान', 'असली व्यक्ति', 'किसी से बात',
    'रद्द', 'अकाउंट हटाओ', 'अकाउंट बंद', 'विवाद',
  ],
}

// Combine all language keywords for detection
const ALL_ESCALATION_KEYWORDS = Object.values(ESCALATION_KEYWORDS).flat()

function needsEscalation(message, lang) {
  const lower = message.toLowerCase()
  // Check keywords for the user's language + always check English as base
  const langKeywords = ESCALATION_KEYWORDS[lang] || []
  const keywords = [...new Set([...ESCALATION_KEYWORDS.en, ...langKeywords])]
  return keywords.some(kw => lower.includes(kw))
}

// ── Get user context for AI ──
async function getUserContext(chatId) {
  if (!_db) return ''
  try {
    const context = []

    // Wallet balance
    const wallet = await _db.collection('walletOf').findOne({ _id: chatId })
    if (wallet) {
      const usdBal = (wallet.usdIn || 0) - (wallet.usdOut || 0)
      const ngnBal = (wallet.ngnIn || 0) - (wallet.ngnOut || 0)
      context.push(`Wallet: $${usdBal.toFixed(2)} USD, ₦${ngnBal.toFixed(2)} NGN`)
    } else {
      context.push('Wallet: No deposits yet')
    }

    // Recent lead jobs
    const recentJobs = await _db.collection('leadJobs')
      .find({ chatId })
      .sort({ createdAt: -1 })
      .limit(3)
      .project({ results: 0 })
      .toArray()
    if (recentJobs.length > 0) {
      const jobSummary = recentJobs.map(j => {
        const status = j.status || 'unknown'
        const target = j.target || 'General'
        const count = j.phonesToGenerate || '?'
        const date = j.createdAt ? new Date(j.createdAt).toISOString().split('T')[0] : '?'
        return `${target} (${count} leads, ${status}, ${date})`
      }).join('; ')
      context.push(`Recent orders: ${jobSummary}`)
    }

    // Support session history
    const session = await _db.collection('supportSessions').findOne({ _id: chatId })
    if (session && session.val > 0) {
      context.push('Support session: Active')
    }

    return context.length > 0 ? `\n\n[USER CONTEXT]\n${context.join('\n')}` : ''
  } catch (e) {
    log(`[AI Support] Context error: ${e.message}`)
    return ''
  }
}

// ── Get conversation history ──
async function getConversationHistory(chatId, limit = 10) {
  if (!_aiChatHistory) return []
  try {
    const messages = await _aiChatHistory
      .find({ chatId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray()
    return messages.reverse().map(m => ({
      role: m.role,
      content: m.content,
    }))
  } catch (e) {
    return []
  }
}

// ── Save message to history ──
async function saveMessage(chatId, role, content) {
  if (!_aiChatHistory) return
  try {
    await _aiChatHistory.insertOne({
      chatId,
      role,
      content,
      createdAt: new Date(),
    })
  } catch (e) {
    log(`[AI Support] Save message error: ${e.message}`)
  }
}

// ── Language display names for AI instruction ──
const LANG_NAMES = {
  en: 'English',
  fr: 'French (Français)',
  zh: 'Chinese (中文)',
  hi: 'Hindi (हिन्दी)',
}

// ── Main AI response function ──
async function getAiResponse(chatId, userMessage, lang = 'en') {
  if (!openai) {
    return { response: null, escalate: needsEscalation(userMessage, lang), error: 'OpenAI not initialized' }
  }

  try {
    // Get user context and conversation history
    const [userContext, history] = await Promise.all([
      getUserContext(chatId),
      getConversationHistory(chatId),
    ])

    // Build language instruction
    const langName = LANG_NAMES[lang] || LANG_NAMES.en
    const langInstruction = lang !== 'en'
      ? `\n\n## LANGUAGE REQUIREMENT\n**CRITICAL**: The user's preferred language is ${langName}. You MUST:\n1. Respond entirely in ${langName}. Do NOT respond in English.\n2. Use the TRANSLATED BUTTON LABELS from the "BUTTON LABELS BY LANGUAGE" table above for the "${langName}" column. For example, instead of "📱 My Numbers" use the ${langName} version from the table.\n3. Use HTML tags (<b>, <i>, <code>) for formatting, not markdown.`
      : ''

    // Build messages array
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT + langInstruction + userContext },
      ...history,
      { role: 'user', content: userMessage },
    ]

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      max_tokens: 500,
      temperature: 0.7,
    })

    const aiResponse = completion.choices[0]?.message?.content || ''

    // Save both messages to history
    await saveMessage(chatId, 'user', userMessage)
    await saveMessage(chatId, 'assistant', aiResponse)

    // Check if AI itself flagged escalation or if keywords match
    const escalate = needsEscalation(userMessage, lang) ||
      aiResponse.toLowerCase().includes('human agent') ||
      aiResponse.toLowerCase().includes('support team') ||
      aiResponse.toLowerCase().includes('escalat') ||
      // Multi-language escalation phrases in AI response
      (lang === 'fr' && (aiResponse.toLowerCase().includes('agent humain') || aiResponse.toLowerCase().includes('équipe de support'))) ||
      (lang === 'zh' && (aiResponse.includes('人工客服') || aiResponse.includes('支持团队'))) ||
      (lang === 'hi' && (aiResponse.includes('सहायता टीम') || aiResponse.includes('मानव एजेंट')))

    return { response: aiResponse, escalate, error: null }
  } catch (e) {
    log(`[AI Support] OpenAI error: ${e.message}`)
    return { response: null, escalate: true, error: e.message }
  }
}

// ── Clear conversation history (when support session ends) ──
async function clearHistory(chatId) {
  if (!_aiChatHistory) return
  try {
    await _aiChatHistory.deleteMany({ chatId })
  } catch (e) {
    log(`[AI Support] Clear history error: ${e.message}`)
  }
}

module.exports = {
  initAiSupport,
  getAiResponse,
  clearHistory,
  needsEscalation,
  isAiEnabled: () => !!openai,
}
