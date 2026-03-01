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

// ── System prompt with full product knowledge ──
const BRAND = process.env.CHAT_BOT_BRAND || 'Nomadly'
const SUPPORT_HANDLE = process.env.SUPPORT_HANDLE || '@support'

const SYSTEM_PROMPT = `You are the AI support assistant for ${BRAND}, a Telegram-based platform offering digital services. You help users with questions about products, pricing, and account issues.

## YOUR ROLE
- Answer user questions accurately and helpfully from the knowledge base below
- Be concise but thorough — Telegram messages should be brief
- Use relevant emojis sparingly for readability
- If you cannot confidently answer, say so and let the user know a human agent will assist shortly
- NEVER make up pricing, features, or policies — only state what's in the knowledge base
- Format responses for Telegram (use <b>bold</b> and <i>italic</i> HTML tags, not markdown)

## PRODUCTS & SERVICES

### 1. Phone Leads (Buy Leads)
- Generate verified US/international phone numbers with carrier info
- Options: with CNAM (caller ID names), with real person names, targeted bank leads
- Pricing: Varies by quantity and type ($25-$100+ depending on volume and target)
- Delivery: Files sent directly in Telegram chat
- Supported carriers: T-Mobile, AT&T, Verizon, Sprint, Mixed Carriers
- Area codes: User selects specific US area codes
- Leads with CNAM include the registered name on the phone number

### 2. Phone Validation (Validate Leads)
- Upload your own phone list for validation
- Returns: carrier info, line type, CNAM names
- Pricing: Based on quantity of numbers validated

### 3. URL Shortener
- Custom domain URL shortening (like Bitly)
- Custom domains supported: ${process.env.CUSTOM_DOMAIN || 'custom domains available'}
- Free tier: ${process.env.FREE_LINKS || '5'} links per ${process.env.FREE_LINKS_TIME_SECONDS ? Math.round(Number(process.env.FREE_LINKS_TIME_SECONDS)/3600) + ' hours' : 'day'}
- Subscription plans: Daily ($${process.env.PRICE_DAILY_SUBSCRIPTION || '50'}), Weekly ($${process.env.PRICE_WEEKLY_SUBSCRIPTION || '100'}), Monthly ($${process.env.PRICE_MONTHLY_SUBSCRIPTION || '200'})

### 4. Domain Names
- Register domains across 1000+ TLDs
- DNS management (A, CNAME, MX, TXT, SRV records)
- Minimum price: $${process.env.MIN_DOMAIN_PRICE || '30'}

### 5. Anti-Red Hosting (cPanel/Plesk)
- Bulletproof web hosting with cPanel
- Premium plan: $${process.env.PREMIUM_ANTIRED_CPANEL_PRICE || '75'}/week
- Golden plan: $${process.env.GOLDEN_ANTIRED_CPANEL_PRICE || '100'}/week
${process.env.HOSTING_TRIAL_PLAN_ON === 'true' ? '- Free trial available!' : ''}

### 6. Cloud IVR + SIP (Phone Service)
${process.env.PHONE_SERVICE_ON === 'true' ? `- Cloud phone numbers with call forwarding, SMS, and SIP
- Starter: $${process.env.PHONE_STARTER_PRICE || '50'} (${process.env.STARTER_MINUTES || '100'} min, ${process.env.STARTER_SMS || '50'} SMS)
- Pro: $${process.env.PHONE_PRO_PRICE || '75'} (${process.env.PRO_MINUTES || '400'} min, ${process.env.PRO_SMS || '200'} SMS)
- Business: $${process.env.PHONE_BUSINESS_PRICE || '120'} (${process.env.BUSINESS_MINUTES || '600'} min, ${process.env.BUSINESS_SMS || '300'} SMS)
- Call forwarding: $${process.env.CALL_FORWARDING_RATE_MIN || '0.50'}/min
- Overage rates: SMS $${process.env.OVERAGE_RATE_SMS || '0.02'}/msg, Calls $${process.env.OVERAGE_RATE_MIN || '0.04'}/min` : '- Phone service currently unavailable'}

### 7. Digital Products
- Twilio accounts, Telnyx accounts, Google Workspace, eSIM, AWS, Google Cloud accounts
- Pricing varies by product

### 8. VPS (Bulletproof VPS)
- Hourly and monthly billing available
- Minimum: $${process.env.VPS_HOURLY_PLAN_MINIMUM_AMOUNT_PAYABLE || '25'}

## PAYMENT METHODS
- Wallet (USD and NGN)
- Cryptocurrency (BTC, LTC, etc.)
${process.env.HIDE_BANK_PAYMENT !== 'true' ? '- Bank Transfer (NGN)' : ''}
- Deposit via: Crypto or Bank Transfer

## COMMON SUPPORT SCENARIOS

### "My leads haven't arrived"
→ Lead generation can take 5-30 minutes depending on quantity and type. Targeted leads with real names take longer. Check if you received a confirmation message. If it's been over 30 minutes, a human agent will investigate.

### "How do I deposit money?"
→ Go to main menu → 💰 Wallet → ➕ Deposit → Choose Crypto or Bank Transfer. For crypto, you'll get a deposit address. For bank, you'll get account details.

### "How do I check my balance?"
→ Go to main menu → 💰 Wallet → Your balance will be displayed.

### "I want a refund"
→ I'll escalate this to our support team who can review your case. Please provide details about what you'd like refunded and why.

### "How do I buy leads?"
→ Go to main menu → 📊 Buy Leads → Select country → Select carrier → Select area codes → Choose quantity → Choose CNAM option → Select payment method.

### "What are targeted leads?"
→ Targeted leads filter for specific bank customers (e.g., Chase, Wells Fargo, Navy Federal). They include real person names verified through CNAM lookup. They cost more but provide higher quality contacts.

### "My domain isn't working"
→ DNS changes can take up to 24-48 hours to propagate. Check your DNS records are correct. If issues persist, a human agent will help troubleshoot.

### "How do I set up SIP?"
→ After purchasing a phone plan, go to Cloud IVR → Your Number → SIP Settings. You'll get SIP credentials (username, password, domain: ${process.env.SIP_DOMAIN || 'sip.speechcue.com'}).

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
- Always end with asking if they need anything else, OR if escalating, let them know a human agent will follow up`

// ── Escalation detection ──
const ESCALATION_KEYWORDS = [
  'refund', 'money back', 'charge back', 'chargeback', 'dispute',
  'scam', 'fraud', 'steal', 'stolen', 'hack', 'hacked',
  'not working', 'broken', 'error', 'bug', 'crash',
  'angry', 'furious', 'terrible', 'worst', 'lawsuit', 'legal',
  'manager', 'supervisor', 'human', 'real person', 'talk to someone',
  'cancel', 'delete account', 'close account',
]

function needsEscalation(message) {
  const lower = message.toLowerCase()
  return ESCALATION_KEYWORDS.some(kw => lower.includes(kw))
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

// ── Main AI response function ──
async function getAiResponse(chatId, userMessage) {
  if (!openai) {
    return { response: null, escalate: needsEscalation(userMessage), error: 'OpenAI not initialized' }
  }

  try {
    // Get user context and conversation history
    const [userContext, history] = await Promise.all([
      getUserContext(chatId),
      getConversationHistory(chatId),
    ])

    // Build messages array
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT + userContext },
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
    const escalate = needsEscalation(userMessage) ||
      aiResponse.toLowerCase().includes('human agent') ||
      aiResponse.toLowerCase().includes('support team') ||
      aiResponse.toLowerCase().includes('escalat')

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
