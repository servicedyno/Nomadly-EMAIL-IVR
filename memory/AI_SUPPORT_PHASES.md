# AI Support — Phased Upgrade Roadmap

**Source file:** `/app/js/ai-support.js` (~1,440 lines)
**Companion analysis:** `/app/memory/AI_SUPPORT_UPGRADE_PLAN.md` (deeper feature catalog, written July 2025)
**Last updated:** Feb 2026

This doc is the **operational checklist** to extend AI support smartness. Each phase is independently shippable, has its own test surface, and is sized for one PR. Pick the phase, ship it, run the tests, move on.

---

## ✅ Phase 0 — Already shipped (Tier 1 of original plan)

| ID | Feature | File location | Status |
|---|---|---|---|
| F1 | Last-action context injection | `getUserContext` in `ai-support.js` | ✅ Live |
| F2 | Recent error context (30-min window) | `userErrors` collection + context | ✅ Live |
| F3 | Action-button suggestions | `extractActionButtons` | ✅ Live |
| F4 | Smart soft/critical escalation | `needsEscalation` | ✅ Live |
| F5 | Post-session satisfaction rating | `rateSupportSession` + 👍/👎 inline buttons | ✅ Live |

---

## ✅ Phase 1 — Language polish + escalation hardening (SHIPPED Feb 2026)

**Status:** **DONE.** Tests: `js/tests/test_ai_support_phase1.js` — 19/19 pass.

| ID | Gap | Implementation | Test |
|---|---|---|---|
| L1 | `extractActionButtons` only had EN + FR maps; ZH/HI users got EN buttons | Added full ZH and HI button maps (wallet, marketplace, domain, hosting, VPS, SMS leads, virtual card, email validation, blast, digital products) | `L1: ZH/HI/FR/EN button regression` |
| L2 | `MP_HELPER_PROMPT` had no language-aware button labels (MP AI used EN labels for FR/ZH/HI users) | Inlined the 4-language Marketplace button table into the system prompt | `L2: MP_HELPER_PROMPT includes language-aware button labels` |
| L3 | Marketplace AI had no user context (no wallet, no active listings, no conversations) | Added `getMarketplaceContext(chatId)` that injects wallet + 3 active listings + 3 open conversations into the MP system prompt | `L3: getMarketplaceContext function exists and is called by MP AI` |
| L7 | Soft-escalation regex `tap\|click\|press\|go to\|navigate` was English-only — non-EN navigation answers triggered false escalations | Extended regex to `appuyez\|cliquez\|touchez\|allez\|naviguez\|accédez\|点击\|前往\|进入\|टैप\|क्लिक\|दबाएं\|जाएं\|खोलें` | `L7: soft + FR/ZH/HI navigation → no escalation` |
| S6 | `max_tokens: 500` truncated complex answers (e.g., "explain SIP setup end-to-end") | Bumped main `getAiResponse` 500 → **1200**, marketplace 400 → **800** | `S6: main/marketplace token limits` |
| S12 | Same critical keyword repinged the admin every message until session ended (admin noise) | Added in-memory `_escalatedThisSession` `Map<chatId, Set<keyword>>`; cleared in `clearHistory(chatId)`. Backward-compat preserved when `chatId` is omitted | `S12: refund first ping → escalate · second → deduped · clearHistory resets · diff keyword still pings` |

### Files touched in Phase 1
- `/app/js/ai-support.js` — pure changes, no breaking API surface (added `chatId` 4th positional arg to `needsEscalation`, all existing 3-arg callers still work)
- `/app/js/_index.js` — already passes `chatId` to `getAiResponse` which forwards it to `needsEscalation` internally. No call-site change needed.
- `/app/js/tests/test_ai_support_phase1.js` — new (19 tests)

---

## 🔧 Phase 2 — Smart features (NOT STARTED)

**Goal:** Make AI proactively help, route by complexity, and detect frustrated users without keyword triggers.

**Estimated effort:** ~4 hours · 1 PR

### Tasks

#### S5 — Sentiment / frustration detection
- **Why:** A user types `"this is so frustrating, I've wasted $50"` — no critical keyword, AI gives a polite "let's troubleshoot" response, user churns.
- **How:** On each user message, run a 1-call sentiment classifier (`gpt-4.1-nano`, cheap). Score 0-10 frustration. If score ≥ 7 OR cumulative session sentiment trends down 3 messages in a row → force-escalate (regardless of keywords) with a 🚨 admin ping that includes the sentiment trace.
- **Schema:** Reuse the existing `supportRatings` collection or add `supportSentiment` `{ chatId, message, score, timestamp }` for analytics.
- **Implementation hint:**
  ```js
  async function analyzeSentiment(message) {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-nano',
      messages: [
        { role: 'system', content: 'Score user frustration 0-10. JSON only: {"score": N, "reason": "..."}.' },
        { role: 'user', content: message },
      ],
      max_tokens: 50,
      temperature: 0,
    })
    // ... parse JSON
  }
  ```
- **Tests to add:**
  - `getAiResponse` with frustrated message → `escalate: true`
  - Sentiment trace stored under `supportSentiment` collection
  - Cost regression — only one extra nano call per user message

#### S2 — Proactive support triggers
- **Why:** Many users hit an error twice and silently abandon instead of opening Support.
- **How:** Use the existing `userErrors` collection. After **2 errors with the same `feature` within 5 minutes**, auto-DM the user: *"Looks like you're having trouble with `<feature>`. Need help? [💬 Get Help] [🔄 Try Again]"*. The Get Help button opens a support session pre-populated with the error trace. Add a per-feature cooldown (don't spam — once per 30 min per feature).
- **Storage:** Add `userErrors.proactiveOfferSentAt` timestamp.
- **Tests to add:**
  - 2 errors in 5min → DM sent
  - 1 error → no DM
  - Cooldown — second offer suppressed within 30 min

#### S3 — Smart model routing (cost optimization)
- **Why:** ~80% of support questions are FAQ-class. Routing them to `gpt-4.1-nano` instead of `gpt-4.1-mini` cuts that 80% slice ~10× cost-wise.
- **How:** Pre-classifier in `getAiResponse`:
  ```js
  function pickModel(message, context) {
    const simpleFAQ = /how (much|to deposit|do i)|where is|what is|pricing|plans|cost/i
    const hasErrors = context.includes('Recent errors')
    const isComplex = hasErrors || message.length > 200 || /not working|broken|error/i.test(message)
    if (isComplex) return 'gpt-4.1-mini'
    if (simpleFAQ.test(message)) return 'gpt-4.1-nano'
    return 'gpt-4.1-mini' // safe default
  }
  ```
- **Tests to add:** static check that classifier returns expected model for fixture messages.

#### S9 — Real-time service-status check
- **Why:** During a Telnyx outage, AI says "your SIP creds look fine, double-check them" instead of "Telnyx is down — ETA 20min" → user wastes time.
- **How:** Add a `serviceStatus` collection `{ service, status: 'healthy'|'degraded'|'down', message, updatedAt }` editable by admin via `/svc <service> <status> <message>` command. In `getUserContext`, append a banner: *"⚠️ Known issue: Telnyx degraded since 14:32 UTC — ETA 20min"*. AI is instructed to lead with this when relevant.
- **Tests to add:**
  - Set `serviceStatus.sip = degraded` → user message about SIP → AI response includes the outage banner.

---

## 🤖 Phase 3 — Function calling + multimodal (NOT STARTED)

**Goal:** Turn the AI from advisor into agent. Let it actually look up data and read screenshots.

**Estimated effort:** ~6 hours · 1 PR

### Tasks

#### S1 / F6 — OpenAI function calling (tool use)
Tools to wire up (pick the top 5 highest-traffic):

```js
const tools = [
  {
    type: 'function',
    function: {
      name: 'check_wallet_balance',
      description: 'Check user wallet balance and last 5 transactions',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_recent_orders',
      description: 'Look up the user\'s recent orders by type',
      parameters: {
        type: 'object',
        properties: {
          order_type: { type: 'string', enum: ['leads', 'hosting', 'domain', 'vps', 'phone', 'card', 'digital'] },
          limit: { type: 'integer', default: 5 },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_recent_payments',
      description: 'List user\'s recent crypto/bank deposits',
      parameters: { type: 'object', properties: { limit: { type: 'integer', default: 5 } } },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_sip_credentials',
      description: 'Check if user has active SIP creds and their status',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_service_status',
      description: 'Check current operational status of a service',
      parameters: {
        type: 'object',
        properties: {
          service: { type: 'string', enum: ['shortener', 'sip', 'hosting', 'leads', 'email', 'vps', 'twilio', 'telnyx', 'blockbee', 'dynopay'] },
        },
      },
    },
  },
]
```

- Implement each tool as a pure async function (`async function tool_check_wallet(chatId)`) returning a JSON-serializable summary capped at ~150 tokens.
- Loop on `completion.choices[0].finish_reason === 'tool_calls'` until done or max 5 hops.
- Log every tool call to `aiToolCalls` collection for analytics.
- **Tests to add:**
  - Mock OpenAI with `tool_calls` response → verify tool dispatcher invokes correct handler
  - "Where's my last deposit?" → AI invokes `check_recent_payments` and answers with real data

#### S4 — Multimodal / screenshot support
- **Why:** ~30% of Telegram support tickets include a screenshot of an error.
- **How:** When the user sends a photo inside an active support session, download the file, base64-encode, and pass as `image_url` content in the `messages` array (gpt-4.1-mini supports vision). System prompt addition: *"If user sent an image, describe what you see in it briefly, then answer."*
- **Caveats:**
  - Cap image size at 5 MB; downscale on the fly with `sharp` if larger.
  - Strip EXIF.
  - Watch token cost — vision tokens are 3-5× higher.
- **Tests to add:**
  - Static check that the photo handler accepts `image/jpeg` and `image/png`
  - Mock vision response → AI text response references "screenshot shows"

---

## 💾 Phase 4 — Memory + cache (NOT STARTED)

**Goal:** Don't pay full API price for repeat questions; remember user preferences across sessions.

**Estimated effort:** ~4 hours · 1 PR

### Tasks

#### S7 — Embedding-based FAQ cache
- **Why:** ~80% of questions are repeats — same answer, fresh API call every time.
- **How:**
  1. On AI response generation, also create a `text-embedding-3-small` vector of the user's question.
  2. Store `{ chatId, question, embedding, response, lang, ts, hits }` in `aiFaqCache`.
  3. On new question, compute embedding → cosine similarity scan against the user's lang slice of the cache.
  4. If similarity ≥ 0.92 AND age < 30 days, serve cached response (with user-specific variables — wallet balance, plan name — re-templated in).
  5. Else call GPT and cache the result.
- **Cost win:** ~70% cache hit rate × ~$0.005/call ≈ ~80% cost reduction.
- **Tests to add:**
  - Two near-identical questions → second served from cache (no `openai.chat.completions.create` call)
  - Different language same question → no cross-language hit

#### S8 — User profile / preferences memory
- **Why:** Each session is stateless. AI re-introduces basics every time.
- **How:** Add `userProfileFor` collection `{ chatId, lang, tonePref: 'terse'|'detailed', technicalLevel: 'beginner'|'intermediate'|'expert', topInterests: [], lastResolvedIssues: [], updatedAt }`. Update via lightweight inference at end of each session (one-shot classifier on the session transcript). Inject relevant fields into next session's system prompt.
- **Tests to add:**
  - End-of-session classifier produces profile entry
  - Subsequent `getAiResponse` system prompt includes the profile blurb

#### S10 — Conversation summarization (long-session memory)
- **Why:** History capped at 10 messages — long sessions lose early context.
- **How:** Once history exceeds 12 messages, summarize messages 1-8 into a single system message: *"[Summary of earlier turns: user asked about X, tried Y, blocked on Z]"*. Keep last 4 messages verbatim. Re-summarize every 8 new messages.
- **Tests to add:**
  - 15-message session — system message contains the summary; raw messages 1-11 dropped

---

## ❄️ Phase 5 — Backlog (post-Phase-4 ideas)

| ID | Feature | Notes |
|---|---|---|
| F11 | Agentic action execution | Let AI initiate flows (deposit, OTP regenerate, refund) — needs careful safety scoping. |
| F12 | Admin feedback learning loop | Admin upvote/downvote AI replies → fine-tune prompt or add to a "good answers" library. |
| F14 | Flow-aware support | While user is mid-VPS-creation, AI knows the exact step they're on and can resume. |
| F15 | AI-driven onboarding | Replace static welcome flow with an AI guide. |
| (NEW) | Streaming responses | UX win — first chars appear in <500ms instead of 5-10s wait. Requires Telegram message-edit polling. |
| (NEW) | Currency/locale formatting | `Intl.NumberFormat` so FR users see `50,00 $` instead of `$50`. |

---

## 📊 Metrics to track post-launch (each phase)

| Metric | Where |
|---|---|
| Escalation rate (true/false ratio) | `needsEscalation` calls / total support messages |
| Satisfaction (👍 vs 👎) | `supportRatings` collection |
| Cost per session | OpenAI usage / sessions opened |
| Avg messages per session | `aiChatHistory` aggregation |
| Cache hit rate (post Phase 4) | `aiFaqCache.hits` |
| Tool-call usage (post Phase 3) | `aiToolCalls` collection |
| Sentiment-triggered escalations (post Phase 2) | `supportSentiment` where `score ≥ 7` |
| Proactive trigger conversion (post Phase 2) | DM sent → support session opened ratio |

---

## 🗂 Files to touch in each phase (quick reference)

| Phase | Primary file | Test file | New collections |
|---|---|---|---|
| 1 (DONE) | `js/ai-support.js` | `js/tests/test_ai_support_phase1.js` | — |
| 2 | `js/ai-support.js` + new error catch points across `js/_index.js` | `js/tests/test_ai_support_phase2.js` | `supportSentiment`, `serviceStatus`, `userErrors.proactiveOfferSentAt` |
| 3 | `js/ai-support.js` + photo handler in `js/_index.js` | `js/tests/test_ai_support_phase3.js` | `aiToolCalls` |
| 4 | `js/ai-support.js` | `js/tests/test_ai_support_phase4.js` | `aiFaqCache`, `userProfileFor` |

---

## 🧭 Pickup notes for the next agent

1. Phase 1 is **shipped and tested**. Don't redo it.
2. The Tier 1 features in `AI_SUPPORT_UPGRADE_PLAN.md` (F1-F5) are already in code — that document is older, retained for context only.
3. **Phase 2 is the highest-leverage next step** — sentiment + proactive triggers will measurably reduce churn.
4. **Phase 3 is the biggest "smart leap"** — function-calling + screenshots make the AI feel like a real agent.
5. Always preserve backward compatibility on the `needsEscalation(message, lang, aiResponse, chatId?)` signature — there are still callers in `_index.js` that don't pass `chatId`.
6. Keep tests passing: `node js/tests/test_ai_support_phase1.js` + sibling regressions in `test_admin_unmasked_notify.js` + `test_user_facing_localization.js` + `test_call_route_priority.js`.

