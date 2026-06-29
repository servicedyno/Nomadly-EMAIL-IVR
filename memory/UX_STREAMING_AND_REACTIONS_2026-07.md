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

### #3b — Deposit & purchase reactions (added after follow-up)
- New helper `sendAndReact(chatId, text, emoji, opts)` in `_index.js`: sends via the
  real `bot.sendMessage` (so we get a message_id back) then reacts to that same message.
  Used for async/confirmation events that have NO originating user message. Bots can
  react to their own messages in private chats (verified).
- **Deposit confirmed → 💰** on the confirmation message, all 3 PSP paths:
  Fincra/NGN (`~32986`), BlockBee crypto (`~34075`), DynoPay crypto (`~35055`).
- **Purchase order placed → 🎉** on the order-confirmation message:
  Digital Product (`dpOrderConfirmed`) and Virtual Card (`vcOrderConfirmed`).
  NOT yet added to: Cloud Phone, Domains, Hosting, VPS/RDP, Lead orders (can extend).

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
