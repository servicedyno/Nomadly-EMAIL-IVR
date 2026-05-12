# Shortit shortener — provider revert (tiny-url-shortner → url-shortener57)

## Incident
Production user `@Dprincecharles` (6368783336) reported the URL shortener was
returning `https://tinyurl.com/22ssckts` instead of a non-tinyurl short URL
matching their local test result.

## Root cause
Commit `a3e68f31` (2026-05-02) switched the RapidAPI provider in
`js/cuttly.js` from `url-shortener57.p.rapidapi.com` (returns short URLs on
its own non-tinyurl domain) to `tiny-url-shortner.p.rapidapi.com` (returns
tinyurl.com URLs).

## Fix (2026-05-12, second iteration)
- **`js/cuttly.js`** — reverted provider host back to
  `url-shortener57.p.rapidapi.com` (POST `/shorten` → `result_url`).
- **`js/_index.js`** — restored the unconditional RapidAPI call in the
  random-slug flow (lines 15568-15605). My earlier "SELF_URL self-host" patch
  was the wrong fix per user feedback ("it should be through RapidAPI"); that
  patch is now fully reverted.
- **Provider is overridable via env** without a code change:
    - `RAPIDAPI_SHORTENER_HOST` (default `url-shortener57.p.rapidapi.com`)
    - `RAPIDAPI_SHORTENER_PATH` (default `/shorten`)
    - `RAPIDAPI_SHORTENER_FIELD` (default `result_url`)

## Live verification (just ran against the production-grade key)
```
$ node /app/scripts/test_rapidapi_shorten.js https://cnn.com
Calling RapidAPI provider for: https://cnn.com

Short URL : https://goolnk.com/2ry4eb
Host      : goolnk.com
Is tinyurl? false
```
Confirms the reverted provider returns Shortit-compatible non-tinyurl URLs.

## Other code paths (audited — already correct)
- Bitly-paid flow (`_index.js:9433-9474`) — paid product, untouched.
- Custom-alias flow (`_index.js:15672-15705`) — returns SELF_URL/alias.
- Custom-domain flows (`_index.js:15880+`) — returns custom-domain/${slug}.

## Verification
- `node /app/scripts/test_rapidapi_shorten.js https://cnn.com` → `goolnk.com` ✓
- `pytest /app/backend/tests/test_shortener_tinyurl_fix.py` → 4/4 ✓
- All other regression suites still green: 13/13 ✓
- Lint clean on `cuttly.js`, `_index.js`.
- Node service restarts clean.

## Deploy
1. **Save to GitHub** → Railway auto-deploys → next short link is returned
   on `goolnk.com` (or whatever current `url-shortener57` host emits), not
   `tinyurl.com`.
2. If we ever need to swap providers without redeploying, set
   `RAPIDAPI_SHORTENER_HOST`, `RAPIDAPI_SHORTENER_PATH`, and
   `RAPIDAPI_SHORTENER_FIELD` on the Railway service.

## Files changed
- `js/cuttly.js` — provider host/path/field reverted + parametrized.
- `js/_index.js` lines 15568-15605 — earlier SELF_URL patch reverted.
- `backend/tests/test_shortener_tinyurl_fix.py` — now pins the
  url-shortener57 default + env override.
- `scripts/test_rapidapi_shorten.js` — NEW (one-shot live RapidAPI probe).
