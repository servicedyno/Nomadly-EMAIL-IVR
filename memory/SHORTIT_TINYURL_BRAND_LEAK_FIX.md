# Shortit branded URLs — tinyurl.com brand-leak fix

## Incident
Production user `@Dprincecharles` (6368783336) reported the URL shortener was
returning `https://tinyurl.com/22ssckts` instead of a Shortit-branded URL on
their own SELF_URL domain. Local testing produced the correct branded URL —
production was wrong.

## Root cause
Commit `a3e68f31` (2026-05-02) switched the RapidAPI provider in
`js/cuttly.js` from `url-shortener57.p.rapidapi.com` (whitelabel) to
`tiny-url-shortner.p.rapidapi.com`. The new provider returns **tinyurl.com**
hashes — the branded short-link product started leaking the foreign brand to
every user on the random-slug flow.

Worse: the random-slug code path at `_index.js:15568-15633` already
**generates** a SELF_URL/${slug} link AND stores `fullUrlOf[shortUrl] = url`
so the Express click handler at `app.get('/:id')` (line ~31796) would happily
serve the 302 redirect. The RapidAPI hop was redundant — it added a foreign
brand, an extra DNS hop, lost click tracking, and incurred a monthly RapidAPI
bill.

## Fix
`js/_index.js:15568-15622` — flipped the default:
- `_shortUrl = __shortUrl` (SELF_URL/${slug}) is now the default.
- The RapidAPI / tinyurl branch is kept behind an env flag
  `SHORTLINK_PROVIDER=rapidapi` as an emergency escape valve in case
  SELF_URL goes down.
- All downstream paths (`send`, `notifyGroup`, DB writes) unchanged — they
  already use `_shortUrl`.

## Why this is also a win
- **Brand**: users see `https://api.<your-domain>/<slug>` instead of
  `https://tinyurl.com/<hash>`.
- **Click tracking restored**: the Railway click handler at `/:id` was
  already wired, just bypassed. Now `clicksOn[lookupKey]` increments again.
- **Cost**: every link now skips RapidAPI → ~$0.001/link saved at scale.
- **Latency**: one less network hop on link creation.
- **Outage resilience**: SELF_URL going down already breaks the rest of the
  bot — no NEW failure mode introduced.

## Other code paths (audited — already correct)
- Bitly-paid flow (`_index.js:9433-9474`) — user explicitly paid for Bitly
  branding; intentional, leave alone.
- Custom-alias flow (`_index.js:15672-15705`) — already returns SELF_URL.
- Custom-domain flows (`_index.js:15880+, 15926+`) — already return
  custom-domain/${slug}.

## Verification
- `pytest /app/backend/tests/test_shortener_tinyurl_fix.py` → 5/5 ✓
- All other regression suites still green: 13/13 ✓
- Lint clean on `_index.js`.
- Node service restarts clean.

## Deploy
1. **Save to GitHub** → Railway auto-deploys the new bot.
2. After deploy, the next random-slug link created from `🔗✂️ URL Shortener`
   will be `${SELF_URL}/<slug>` instead of `https://tinyurl.com/<hash>`.
3. (Optional) If you ever need to revert to RapidAPI without rolling back
   code, set `SHORTLINK_PROVIDER=rapidapi` on the Railway service.

## Files changed
- `js/_index.js` lines 15568-15622 — main fix.
- `backend/tests/test_shortener_tinyurl_fix.py` — NEW (5 assertions).
