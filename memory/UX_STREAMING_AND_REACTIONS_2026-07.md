# UX Upgrade — Streaming AI Replies (#7) + Message Reactions (#3)  — 2026-07

## What changed
Two modern Telegram Bot API UX features added to the support experience.

### #7 — Streaming AI support replies
- `js/ai-support.js`: new `getAiResponseStreaming(chatId, userMessage, lang, onDelta)`
  - Mirrors `getAiResponse` but uses `openai.chat.completions.create({ ..., stream:true })`.
  - Calls `onDelta(sanitizedPartial)` progressively. **Brand-confidentiality scrub
    (`sanitizeUserText`) is applied to EVERY partial** so banned vendor names never
    flash mid-stream. Same 429-retry + escalation detection as the non-stream version.
  - Exported alongside `getAiResponse`.
- `js/_index.js`: new shared helpers right after `send()`:
  - `aiMarkdownToHtml(text)` — single source for markdown→Telegram-HTML (was duplicated
    at both AI call sites). Safe on PARTIAL text (unbalanced `**`/`` ` ``/`_` stay literal,
    stray `<`/`&` escaped) → no parse errors while streaming.
  - `streamAiReply(chatId, message, lang)` — sends a "💬 Typing…" placeholder (carrying
    the persistent `/done` reply keyboard), streams `editMessageText` edits throttled to
    ~1/sec, does a forced final edit, then (if the AI suggested actions) sends a small
    "👇 Quick actions" message updating the reply keyboard. Returns
    `{ response, safeHtml, escalate, error }` so the existing admin-mirror + escalation
    pipeline is unchanged. On failure it deletes the placeholder and returns
    `{response:null}` so the caller's fallback path is clean.
  - Both AI call sites (primary support branch + the "recent session" fallback branch)
    now call `streamAiReply` instead of `getAiResponse` + manual safeHtml + send.

### #3 — Message reactions (native acknowledgment)
- `js/_index.js`: new `reactToMessage(chatId, messageId, emoji, isBig)` wrapping
  `bot.setMessageReaction` (fire-and-forget; never throws). Only Telegram free-set emoji.
- Wired at 3 reliable touchpoints (all have `msg` in scope inside `bot.on('message')`):
  - Support message received → 👀 ("seen") just before the AI streams.
  - `/done` support session close → 🙏.
  - Welcome-bonus awarded on `/start` → 🎉 (is_big).

### #3b — Deposit & purchase reactions + post-purchase UI cleanup
- New helper `sendAndReact(chatId, text, emoji, opts)`: sends via real `bot.sendMessage`
  (returns message_id) then reacts to that same message. For async/confirmation events
  with no originating user message. Bots can self-react in private chats (verified).
- New helper `purchaseDoneLine(lang, usd)`: compact localized "✅ Purchase complete! ·
  👛 New balance: $X" — replaces the old bare "Wallet Balance:\n\n$X" trailing bubble.
- **Deposit confirmed → 💰** on the confirmation message, all 3 PSP paths:
  Fincra/NGN, BlockBee crypto, DynoPay crypto.
- **Purchase order → 🎉** on a SINGLE clean confirmation message (success path only):
  - plan-pay, domain-pay, hosting-pay, vps-upgrade-plan-pay → bare balance bubble
    replaced by `purchaseDoneLine()` (one tidy message, reacted).
  - digital-product, virtual-card → previously sent TWO bubbles (bare balance +
    OrderConfirmed); now CONSOLIDATED into one message (balance appended as a single
    `👛 Wallet Balance: $X` line via `.replace(/\n+/g,' ')`), reacted.
- **Cloud Phone activation → 🎉** at the TRUE success point: inside the shared
  `postActivationNudge()` (runs only AFTER a number is fully activated, on EVERY payment
  path — wallet/crypto/bundle/address-verified). The "next step — grab your SIP
  credentials" message is sent via `sendAndReact(..., '🎉', ...)`.
- **Leads order delivered → 🎯** at both delivery sites (`_successMsg` "leads are ready"):
  wallet path and crypto/DynoPay path. Fires on actual delivery, not at payment time
  (fully-failed orders never reach `_successMsg`; partial-but-delivered still counts).
- Still NOT reacted (intentional): vps-plan-pay (credentials are the success anchor;
  refunds on failure), and the rare resumed-job crash-recovery leads path (`safeSend`).

## Verified
- `node --check` on both files: OK. Node bot boots clean.
- Offline test (stubbed OpenAI stream + real prod DB, throwaway chatId, cleaned up):
  progressive onDelta, partials+final sanitized, correct shape — ALL PASS.
- Markdown converter partial-safety: balanced/safe HTML on all fragment cases.

## NOT yet validated (needs live Telegram)
- Visual streaming, the 👀/🙏/🎉 reactions, and the quick-actions keyboard require a real
  chat with the **dev bot** (`TELEGRAM_BOT_TOKEN_DEV`). In this dev sandbox the dev bot
  has NO webhook set (SKIP_WEBHOOK_SYNC=true), so it doesn't receive updates until a
  webhook is manually set to `<pod>/api/telegram/webhook`.

## Notes / library
- `node-telegram-bot-api@0.67.0` already exposes `setMessageReaction` and `editMessageText`.
- No library upgrade required.

## Code cleanups (2026-07)
- Centralized markdown→Telegram-HTML into a single `aiMarkdownToHtml()` in `_index.js`
  (removed the two duplicated inline regex blocks that lived at each AI call site).
- Extracted `buildAiMessages(chatId, userMessage, lang)` in `ai-support.js` — the system
  prompt + language instruction + context + history construction now lives in ONE place,
  shared by `getAiResponse` and `getAiResponseStreaming` (~16 lines of dup removed).
- Verified both AI call sites have no orphaned vars (`suggestedButtons`/`keyboardRows`/
  `safeHtml` are now owned by `streamAiReply`).
- Verified: `node --check` on both files, bot boots clean, and an offline test confirms
  both the streaming and non-streaming paths still work + sanitize after the refactor.
- Pre-existing (NOT from this work): 2 ESLint `no-empty` warnings in ai-support.js
  (~lines 1246, 1347) in the original getUserContext/getConversationHistory region.
