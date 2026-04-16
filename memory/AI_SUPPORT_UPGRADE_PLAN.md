# Nomadly AI Support — Intelligence Upgrade Plan
## Deep Analysis & Feature Collection for Smarter AI Support

**Document Version:** 1.0
**Created:** July 2025
**File:** `/app/js/ai-support.js` (1,115 lines)

---

## 1. Current Architecture Review

### 1.1 How It Works Today

```
User sends message → 💬 Support
       ↓
Support session opens (action = 'supportChat')
       ↓
User types message
       ↓
┌──────────────────────────────────────────────┐
│ 1. Forward user message to admin (always)     │
│ 2. Check admin takeover → if yes, skip AI     │
│ 3. Build context:                             │
│    - System prompt (750 lines knowledge base) │
│    - User context (wallet, plan, SIP, orders) │
│    - Conversation history (last 10 messages)  │
│    - Language instruction                     │
│ 4. Call GPT-4o (max 500 tokens, temp 0.7)     │
│ 5. Convert markdown → Telegram HTML           │
│ 6. Check escalation (keywords + AI phrases)   │
│ 7. Send response to user + admin              │
└──────────────────────────────────────────────┘
       ↓
Admin can /reply at any time to take over
       ↓
User types /done → session ends, history cleared
```

### 1.2 AI Models Used

| Model | Purpose | Cost |
|---|---|---|
| `gpt-4o` | Main support chat | ~$2.50/1M input, $10/1M output |
| `gpt-4o-mini` | Marketplace moderation (scam detection) | ~$0.15/1M input, $0.60/1M output |
| `gpt-4o-mini` | Marketplace Q&A helper | ~$0.15/1M input, $0.60/1M output |

### 1.3 Knowledge Base Coverage (System Prompt)

| Category | Sections | Lines |
|---|---|---|
| Subscription plans | 3 plans + features | ~50 lines |
| Main menu navigation | Full layout + submenus | ~15 lines |
| Cloud IVR + SIP | Plans, setup, OTP, troubleshooting | ~130 lines |
| SMS Leads | Buy/validate flow | ~15 lines |
| URL Shortener | All sub-features | ~10 lines |
| Domains | Buy/manage/DNS | ~10 lines |
| Anti-Red Hosting | Plans + setup | ~8 lines |
| Digital Products | Full catalog + pricing | ~20 lines |
| VPS/RDP | Plans + flow | ~15 lines |
| Virtual Card | Flow | ~5 lines |
| Email Validation/Blast | Pricing + flow | ~15 lines |
| Marketplace | Buy/sell/escrow/moderation | ~50 lines |
| Wallet & Loyalty | Deposit/tiers | ~15 lines |
| Common Q&A scenarios | 30+ scenarios | ~150 lines |
| Multi-language buttons | 4 language tables | ~50 lines |
| Escalation rules | Keywords + behavior | ~50 lines |
| **Total** | | **~750 lines** |

### 1.4 User Context Injected

| Data | Source Collection | Example |
|---|---|---|
| Wallet balance | `walletOf` | "Wallet: $25.50 USD" |
| Subscription plan | `planOf` + `planEndingTime` | "Plan: weekly, expires in 3 days" |
| SIP test status | `testCredentials` | "Test SIP: 1/2 calls used, active" |
| Cloud phones | `phoneNumbersOf` | "Cloud phones: +1234 (Pro plan)" |
| Recent orders | `leadJobs` | "Recent: Chase leads (500, completed)" |
| Support session | `supportSessions` | "Support session: Active" |
| Marketplace | `marketplaceProducts` + conversations | "2 active listings, 1 conversation" |

### 1.5 What's Missing from Context (GAPS)

| Missing Data | Why It Matters | Source |
|---|---|---|
| **User's last action** | When user opens support after a failure, AI doesn't know what they were doing | `stateOf` collection |
| **Recent errors** | If shortlink failed, AI should know without user explaining | Application logs / error collections |
| **Active flow state** | If user is mid-VPS-creation, AI should know the step | `stateOf.info` |
| **Transaction history** | User asks "where's my payment?" — AI can't check | `walletOf` transactions / crypto payments |
| **Hosting status** | User's hosting plan, domain, expiry | `hostOf` collection |
| **Domain details** | User's registered domains and DNS status | `domainsOf` collection |
| **Shortlink history** | Recent shortened URLs and analytics | `linksOf` collection |
| **Device info** | SMS app device, version, last sync | `smsDevices` collection |
| **Referral status** | Referral earnings, pending referrals | `referrals` collection |
| **Login/activity time** | When user last interacted (activity pattern) | Message timestamps |

---

## 2. Real User Interaction Analysis

### 2.1 Case Study: @flmzv2 — Shortlink Failure Support

**Timeline:**
```
15:36:19 — Shortlink failed (bug)
15:36:39 — Retry failed
15:36:59 — Opened 💬 Support
15:37:03 — User: "Link shortening failed. Please try again or tap 💬 Get Support."
15:37:06 — AI: "I see you're having trouble shortening a link... describe any error messages"
           → ESCALATED (NEEDS HUMAN ATTENTION)
```

**What went wrong:**
1. AI didn't know user had JUST failed at shortening (no last-action context)
2. AI asked user to "describe the error" when the user literally pasted the error message
3. AI couldn't check if the shortener service was down or if it was a user-specific issue
4. AI escalated immediately instead of trying to help first (keyword "error" triggered escalation)

**What AI SHOULD have done:**
```
"I can see you just tried to shorten a link and it failed. Let me check...

🔍 It looks like there's a temporary issue with the Shortit shortener.

Here's what you can try:
1. Try the Bitly shortener instead → 🔗 URL Shortener → ✂️ Bit.ly
2. Or try the Custom Domain Shortener if you have one set up

If neither works, I'll escalate this to our technical team."
```

### 2.2 Common AI Interaction Patterns

From log analysis, AI Support interactions show:
- **Escalation rate is too high** — almost every session gets flagged "NEEDS HUMAN ATTENTION"
- **AI asks for more info too often** — instead of using available context
- **No resolution tracking** — can't tell if AI actually solved the user's problem
- **No follow-up** — after giving advice, AI doesn't check if it helped

---

## 3. Improvement Plan — 15 Features in 3 Tiers

### TIER 1: High Impact, Low Effort ⚡

#### Feature 1: Last-Action Context Injection
**What:** Add user's last bot action and recent errors to AI context.
**Why:** AI should know what user was doing before opening support.
**How:**
```javascript
// In getUserContext(), add:
const userState = await _db.collection('stateOf').findOne({ _id: chatId })
if (userState) {
  context.push(`Last action: ${userState.val?.action || 'none'}`)
  if (userState.val?.info) {
    context.push(`Flow state: ${JSON.stringify(userState.val.info).substring(0, 200)}`)
  }
}
```
**Impact:** AI can immediately acknowledge what user was doing ("I see you were trying to shorten a link...")

#### Feature 2: Recent Error Context
**What:** Track recent user-facing errors in a collection and inject into AI context.
**Why:** When AI sees "Last error: shortlink failed 30s ago", it can diagnose immediately.
**How:**
- Add a `userErrors` collection that stores recent errors per user
- In catch blocks (shortlink, VPS, payment, etc.), log: `{ chatId, error, feature, timestamp }`
- In `getUserContext()`, fetch last 3 errors from last 30 minutes
```javascript
const recentErrors = await _db.collection('userErrors')
  .find({ chatId, timestamp: { $gt: new Date(Date.now() - 30*60*1000) } })
  .sort({ timestamp: -1 }).limit(3).toArray()
if (recentErrors.length > 0) {
  context.push(`Recent errors: ${recentErrors.map(e => `${e.feature}: ${e.error} (${timeAgo(e.timestamp)})`).join('; ')}`)
}
```
**Impact:** AI can diagnose issues without asking "what happened?"

#### Feature 3: Suggested Action Buttons After AI Response
**What:** After AI responds, show relevant action buttons instead of just /done.
**Why:** Users don't know how to act on AI's advice — buttons reduce friction.
**How:**
- Parse AI response for suggested navigation paths
- Map product mentions to buttons: "URL Shortener" → `[🔗 URL Shortener]`
- Always show: `[[relevant_action], [💬 Talk to Human], [/done End Session]]`
```javascript
// After AI response, extract suggested buttons
const suggestedButtons = extractActionButtons(aiResponse, lang)
const keyboard = [
  ...suggestedButtons.map(b => [b]),
  ['💬 Talk to Human', '/done']
]
send(chatId, formattedResponse, { parse_mode: 'HTML', reply_markup: { keyboard, resize_keyboard: true } })
```
**Impact:** Users can act on AI suggestions with one tap instead of navigating back

#### Feature 4: Smarter Escalation Logic
**What:** Reduce false escalations by adding context-aware escalation.
**Why:** Currently "error" and "not working" always trigger escalation, even for simple issues.
**How:**
- Move from keyword-only to keyword + context scoring
- If AI can answer confidently (response has navigation path), don't escalate
- Only escalate for: refunds, account issues, persistent failures (3+ same error), explicit human request
```javascript
function needsEscalation(message, aiResponse, context, lang) {
  // Critical: always escalate
  if (hasCriticalKeyword(message, lang)) return true  // refund, scam, legal
  
  // Soft: only escalate if AI can't help
  if (hasSoftKeyword(message, lang)) {
    // If AI gave a confident response with navigation path, don't escalate
    if (aiResponse && aiResponse.includes('→')) return false
    return true
  }
  
  // Check for repeated errors (user has been trying for a while)
  if (context.includes('Recent errors') && context.match(/errors.*\d+ min ago.*\d+ min ago/)) return true
  
  return false
}
```
**Impact:** Fewer false flags for admin, AI handles more cases independently

#### Feature 5: Post-Session Satisfaction Rating
**What:** After /done, ask user "Was this helpful? 👍 / 👎"
**Why:** Track AI effectiveness, identify knowledge gaps.
**How:**
```javascript
// After /done:
send(chatId, 'Was our support helpful?\n\n👍 Yes, solved my issue\n👎 No, I still need help', {
  reply_markup: { inline_keyboard: [
    [{ text: '👍 Helpful', callback_data: `rate_support_good_${chatId}` }],
    [{ text: '👎 Not helpful', callback_data: `rate_support_bad_${chatId}` }]
  ]}
})
// Store rating in supportRatings collection
```
**Impact:** Data-driven improvement — know which topics AI fails at

---

### TIER 2: High Impact, Medium Effort 🔧

#### Feature 6: OpenAI Function Calling (Tool Use)
**What:** Give AI tools to look up real-time data during conversation.
**Why:** AI can check things itself instead of asking user or guessing.
**Tools to add:**

```javascript
const tools = [
  {
    type: 'function',
    function: {
      name: 'check_wallet_balance',
      description: 'Check the user\'s current wallet balance and recent transactions',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'check_order_status',
      description: 'Check the status of a user\'s recent order (leads, hosting, domain, VPS)',
      parameters: {
        type: 'object',
        properties: {
          order_type: { type: 'string', enum: ['leads', 'hosting', 'domain', 'vps', 'phone'] }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'check_service_status',
      description: 'Check if a specific service is currently operational',
      parameters: {
        type: 'object',
        properties: {
          service: { type: 'string', enum: ['shortener', 'sip', 'hosting', 'leads', 'email', 'vps'] }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'check_recent_shortlinks',
      description: 'Check user\'s recent URL shortening attempts and their status',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'check_sip_credentials',
      description: 'Check if user has active SIP credentials and their status',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'check_hosting_status',
      description: 'Check user\'s hosting plan status, domain, and expiry',
      parameters: { type: 'object', properties: {} }
    }
  }
]
```
**Impact:** AI becomes a real support agent — can diagnose issues in real time

#### Feature 7: Proactive Support Triggers
**What:** Automatically suggest support when errors occur, instead of waiting for user to open 💬 Support.
**Why:** Many users don't know to tap Support, or give up after errors.
**How:**
```javascript
// In error catch blocks (shortlink, payment, etc.), add:
const errCount = await incrementUserError(chatId, feature)
if (errCount >= 2) {
  send(chatId, `⚠️ It looks like you're having trouble with ${featureName}.\n\n` +
    `Would you like help?\n` +
    `💬 Chat with AI Support\n` +
    `🔄 Try Again`, {
    reply_markup: { inline_keyboard: [
      [{ text: '💬 Get Help', callback_data: `auto_support_${chatId}` }],
      [{ text: '🔄 Try Again', callback_data: `retry_${feature}_${chatId}` }]
    ]}
  })
}
```
**Impact:** Users who would have abandoned get helped proactively

#### Feature 8: Smart Model Routing
**What:** Use GPT-4o-mini for simple FAQ questions, GPT-4o for complex/ambiguous queries.
**Why:** 90% of questions are simple FAQ → save ~10x on API costs.
**How:**
```javascript
// Classify question complexity first
function getModelForQuery(message, context) {
  const simpleFAQ = [
    'how to deposit', 'how to subscribe', 'where is wallet', 'how to shorten',
    'what plans', 'how much', 'pricing', 'where to find', 'how to buy',
    'what is', 'how does'
  ]
  const isSimple = simpleFAQ.some(q => message.toLowerCase().includes(q))
  const hasErrors = context.includes('Recent errors')
  const isComplex = hasErrors || message.length > 200 || message.includes('not working')
  
  return isComplex ? 'gpt-4o' : 'gpt-4o-mini'
}
```
**Impact:** ~60-80% cost reduction on AI support calls with same quality for FAQ

#### Feature 9: Extended User Activity Trail
**What:** Add user's last 5-10 bot interactions (what they tapped, what they saw) to context.
**Why:** Gives AI full picture of user journey — "I see you browsed VPS, selected NVMe, then went Back..."
**How:**
- Create a lightweight `userActivityTrail` collection
- On each user message/action, push to trail: `{ chatId, action, timestamp }`
- In `getUserContext()`, fetch last 10 trail entries
```javascript
const trail = await _db.collection('userActivityTrail')
  .find({ chatId }).sort({ timestamp: -1 }).limit(10).toArray()
if (trail.length > 0) {
  const trailStr = trail.reverse().map(t => `${t.action} (${timeAgo(t.timestamp)})`).join(' → ')
  context.push(`Recent activity: ${trailStr}`)
}
```
**Impact:** AI understands user's full journey — "I see you were looking at VPS plans and went back at the storage selection step. Were the options confusing?"

#### Feature 10: FAQ Cache with Semantic Similarity
**What:** Cache AI responses for common questions, serve from cache if similar question asked before.
**Why:** 80%+ of questions are repeats ("how to deposit", "pricing", "how to shorten").
**How:**
- Store Q&A pairs in MongoDB with embedding vectors
- On new question, compute embedding → cosine similarity against cache
- If similarity > 0.92, serve cached response (with user-specific variables replaced)
- If < 0.92, call GPT and cache the result
```javascript
// Using OpenAI embeddings
const embedding = await openai.embeddings.create({
  model: 'text-embedding-3-small',
  input: userMessage
})
const cached = await findSimilarCached(embedding.data[0].embedding, 0.92)
if (cached) {
  return { response: personalizeResponse(cached.response, userContext), escalate: false }
}
// Else call GPT and cache
```
**Impact:** 60-80% faster responses, significantly lower API costs, consistent answers

---

### TIER 3: Medium Impact, High Effort 🏗️

#### Feature 11: Agentic AI (Action Execution)
**What:** Give AI ability to PERFORM actions for users, not just advise.
**Why:** Instead of "Go to Wallet → Deposit," AI could initiate the deposit flow.
**Actions AI could perform:**
- Generate new SIP test OTP
- Check shortlink status / retry shortening
- Show wallet balance and recent transactions
- Show order status details
- Initiate deposit flow
- Resend hosting credentials
- Check DNS propagation status
**How:** Implement as function calling with side effects. Requires careful permission model.
**Impact:** AI resolves issues end-to-end without user navigation

#### Feature 12: Admin Feedback Learning
**What:** When admin corrects AI or responds differently, feed back into training data.
**Why:** AI improves over time based on real admin responses.
**How:**
- Store admin overrides alongside AI responses
- Weekly: export divergences where admin responded differently than AI
- Use as few-shot examples in system prompt or fine-tuning data
- Track topics where admin corrects AI most frequently
**Impact:** AI accuracy improves continuously

#### Feature 13: Image/Screenshot Support
**What:** Accept and analyze screenshots/images in support chat.
**Why:** Users can't describe visual bugs easily — "it shows a red screen" is vague.
**How:**
- Detect photo messages in support chat
- Use GPT-4o vision to analyze the screenshot
- Include image description in AI context
```javascript
if (msg.photo) {
  const fileId = msg.photo[msg.photo.length - 1].file_id
  const imageUrl = await bot.getFileLink(fileId)
  // Add to messages with image content
  messages.push({
    role: 'user',
    content: [
      { type: 'text', text: 'The user sent this screenshot of their issue:' },
      { type: 'image_url', image_url: { url: imageUrl } }
    ]
  })
}
```
**Impact:** AI can diagnose visual issues directly

#### Feature 14: Flow-Aware Support
**What:** When user opens support mid-flow, AI knows exactly which step they're on.
**Why:** Instead of "what are you trying to do?", AI says "I see you're on step 3 of VPS creation (storage selection)."
**How:**
- Each flow (VPS, domain, hosting, phone) stores step info in state
- `getUserContext()` parses the state to determine exact flow + step
- System prompt includes flow step descriptions
```javascript
// Example state for VPS creation:
// { action: 'selectVpsDiskType', info: { vpsDetails: { os: 'Windows', zone: 'us-central' } } }
// AI context: "User is creating a VPS: Windows RDP, US Central region, currently choosing storage type (NVMe vs SSD)"
```
**Impact:** AI provides step-specific help immediately

#### Feature 15: AI-Powered Onboarding Assistant
**What:** Replace static onboarding with interactive AI guide for new users.
**Why:** New users browse randomly (we saw this in logs) — need guided discovery.
**How:**
- After /start for new users, activate a special AI mode
- AI asks: "What brings you to Nomadly? I can help you get started:"
- Based on answer, guide user to the right feature with explanation
- Track onboarding completion and first purchase
```javascript
const ONBOARDING_PROMPT = `You are the Nomadly onboarding assistant. Your goal is to understand what the new user needs and guide them to the right feature.

Ask what they're looking for:
- Phone calls/IVR → Cloud IVR + SIP
- Sending SMS → BulkSMS
- Short links → URL Shortener
- Hosting → Anti-Red Hosting
- Selling/buying → Marketplace
- etc.

Be conversational, brief, and end with a specific button to tap.`
```
**Impact:** New users find value faster, reduce "window shopping" pattern

---

## 4. Additional Service Features Collected from Analysis

Beyond AI support, here are service-level improvements identified:

### 4.1 From User Behavior Analysis
| Feature | Evidence | Impact |
|---|---|---|
| **Inline pricing in all flows** | Users abandon when prices aren't shown upfront | Reduce 25+ Back/Cancel actions |
| **Quick retry button on errors** | Users manually retry 6+ times | Reduce frustration |
| **Progress indicators in long flows** | VPS creation has 6 steps, no progress shown | Reduce abandonment |
| **Price comparison view** | Users switch between NVMe/SSD without understanding | Faster decisions |
| **Starter pack for new users** | @DaYungMk browsed 7 features, bought nothing | Improve conversion |
| **Micro-trials for paid features** | "Try 1 free SMS lead" / "1 free domain lookup" | Lower barrier to entry |

### 4.2 Service Reliability
| Feature | Evidence | Impact |
|---|---|---|
| **Error rate monitoring dashboard** | Shortlink bug went unnoticed until user reported | Proactive issue detection |
| **Auto-retry for failed operations** | Users manually retry on transient failures | Better UX |
| **Service health check endpoint** | AI support can't check if services are up | Enable AI diagnostics |
| **Error notification to admin (improved)** | Admin got "undefined" instead of error details | Faster debugging |

### 4.3 Monetization
| Feature | Evidence | Impact |
|---|---|---|
| **First deposit bonus** | Wallet abandonment (users see $0, leave) | Increase deposits |
| **Usage-based free tier** | Users hit paywall on first click | Longer engagement |
| **Bundle discount previews** | Users don't know bundles exist | Cross-sell |
| **Loyalty tier progress in checkout** | Users don't know about tier discounts | Increase spending |

---

## 5. Implementation Priority Matrix

| Feature | Impact | Effort | Priority | Phase |
|---|---|---|---|---|
| F1: Last-action context | 🟢 High | 🟢 Low | **P0** | Tier 1 |
| F2: Recent error context | 🟢 High | 🟢 Low | **P0** | Tier 1 |
| F3: Suggested action buttons | 🟢 High | 🟢 Low | **P0** | Tier 1 |
| F4: Smarter escalation | 🟡 Medium | 🟢 Low | **P1** | Tier 1 |
| F5: Satisfaction rating | 🟡 Medium | 🟢 Low | **P1** | Tier 1 |
| F6: Function calling (tools) | 🟢 High | 🟡 Medium | **P0** | Tier 2 |
| F7: Proactive support | 🟢 High | 🟡 Medium | **P1** | Tier 2 |
| F8: Smart model routing | 🟡 Medium | 🟢 Low | **P1** | Tier 2 |
| F9: Activity trail | 🟡 Medium | 🟡 Medium | **P2** | Tier 2 |
| F10: FAQ cache | 🟡 Medium | 🟡 Medium | **P2** | Tier 2 |
| F11: Agentic AI | 🟢 High | 🔴 High | **P3** | Tier 3 |
| F12: Admin feedback learning | 🟡 Medium | 🟡 Medium | **P3** | Tier 3 |
| F13: Screenshot support | 🟡 Medium | 🟡 Medium | **P2** | Tier 3 |
| F14: Flow-aware support | 🟢 High | 🔴 High | **P2** | Tier 3 |
| F15: AI onboarding | 🟡 Medium | 🔴 High | **P3** | Tier 3 |

---

## 6. Quick Win Implementation Sketch (Tier 1)

### Combined Tier 1 changes to `ai-support.js`:

```javascript
// ── UPGRADE 1: Enhanced getUserContext with last action + recent errors ──
async function getUserContext(chatId) {
  // ... existing context ...
  
  // NEW: User's last action (what they were doing before support)
  const userState = await _db.collection('stateOf').findOne({ _id: chatId })
  if (userState?.val?.action && userState.val.action !== 'supportChat') {
    context.push(`Last action before support: ${userState.val.action}`)
    if (userState.val.info) {
      // Extract key info from flow state
      const info = userState.val.info
      const flowDetails = []
      if (info.provider) flowDetails.push(`provider: ${info.provider}`)
      if (info.url) flowDetails.push(`URL: ${info.url}`)
      if (info.vpsDetails) flowDetails.push(`VPS: ${JSON.stringify(info.vpsDetails).substring(0,100)}`)
      if (flowDetails.length) context.push(`Flow details: ${flowDetails.join(', ')}`)
    }
  }
  
  // NEW: Recent errors (from userErrors collection)
  try {
    const recentErrors = await _db.collection('userErrors')
      .find({ chatId, timestamp: { $gt: new Date(Date.now() - 30*60*1000) } })
      .sort({ timestamp: -1 }).limit(3).toArray()
    if (recentErrors.length > 0) {
      const errStr = recentErrors.map(e => {
        const ago = Math.round((Date.now() - e.timestamp.getTime()) / 60000)
        return `${e.feature}: "${e.error}" (${ago} min ago)`
      }).join('; ')
      context.push(`⚠️ Recent errors: ${errStr}`)
    }
  } catch (e) { /* userErrors collection may not exist yet */ }
  
  // NEW: Hosting status
  try {
    const hosting = await _db.collection('hostOf').findOne({ _id: chatId })
    if (hosting?.val) {
      context.push(`Hosting: ${hosting.val.plan || 'active'}, domain: ${hosting.val.domain || 'none'}`)
    }
  } catch (e) {}
  
  // NEW: Domains
  try {
    const domains = await _db.collection('domainsOf').find({ chatId }).limit(5).toArray()
    if (domains.length) {
      context.push(`Domains: ${domains.map(d => d.domain || d._id).join(', ')}`)
    }
  } catch (e) {}
  
  // NEW: Shortlink activity
  try {
    const links = await _db.collection('linksOf').find({ _id: new RegExp(`^${chatId}/`) })
      .sort({ _id: -1 }).limit(3).toArray()
    if (links.length) {
      context.push(`Recent short links: ${links.length} created`)
    }
  } catch (e) {}
}

// ── UPGRADE 2: Smarter escalation ──
function needsEscalation(message, aiResponse, lang) {
  const lower = message.toLowerCase()
  
  // CRITICAL: always escalate (refunds, legal, account)
  const critical = ['refund', 'money back', 'chargeback', 'scam', 'fraud', 'stolen',
                    'lawsuit', 'legal', 'delete account', 'close account']
  if (critical.some(kw => lower.includes(kw))) return true
  
  // SOFT: only escalate if AI couldn't provide actionable answer
  const soft = ['not working', 'broken', 'error', 'bug']
  if (soft.some(kw => lower.includes(kw))) {
    // If AI gave navigation path (contains →), it handled it
    if (aiResponse && (aiResponse.includes('→') || aiResponse.includes('&#8594;'))) return false
    return true
  }
  
  // HUMAN REQUEST: always honor
  const humanRequest = ['human', 'real person', 'talk to someone', 'manager', 'supervisor']
  if (humanRequest.some(kw => lower.includes(kw))) return true
  
  return false
}

// ── UPGRADE 3: Extract suggested action buttons from AI response ──
function extractActionButtons(aiResponse, lang) {
  const buttonMap = {
    'url shortener': '🔗 URL Shortener',
    'cloud ivr': '📞 Cloud IVR + SIP',
    'wallet': '👛 Wallet',
    'marketplace': '🏪 Marketplace',
    'domains': '🌐 Bulletproof Domains',
    'hosting': '🛡️🔥 Anti-Red Hosting',
    'vps': '🖥️ VPS/RDP',
    'sms leads': '📱 SMS Leads',
    'virtual card': '💳 Virtual Card',
    'email validation': '📧 Email Validation',
    'support': '💬 Support',
    'settings': '🌍 Settings',
  }
  
  const lower = aiResponse.toLowerCase()
  const suggested = []
  for (const [key, button] of Object.entries(buttonMap)) {
    if (lower.includes(key) && suggested.length < 2) {
      suggested.push(button)
    }
  }
  return suggested
}
```

---

## 7. Metrics to Track After Upgrades

| Metric | Current | Target | How to Measure |
|---|---|---|---|
| Escalation rate | ~90% | <40% | `needsEscalation` true/false ratio |
| Satisfaction (👍) | Unknown | >75% | Post-session rating |
| First-response resolution | Unknown | >60% | User ends session after 1 AI response |
| Avg messages per session | ~3 | <2 | Messages in supportChat sessions |
| AI cost per session | ~$0.02 | ~$0.005 | OpenAI API usage / sessions |
| Admin takeover rate | Unknown | <20% | /reply commands / sessions |
| Time to resolution | Unknown | <2min | Session open → /done |

---

## 8. Open Questions

1. Should AI be able to initiate actions (generate OTP, start deposit) or only advise?
2. Budget for AI API costs — is cost optimization (Tier 2 F8/F10) a priority?
3. Should AI support be available 24/7 or only during admin hours?
4. Should we add a "Talk to Human" button in AI responses, or keep /reply admin-only?
5. Is there admin bandwidth to review AI feedback/ratings weekly?

---

*This document serves as the master plan for AI Support intelligence upgrades. Implementation should follow the priority matrix (P0 → P1 → P2 → P3) with Tier 1 features first.*
