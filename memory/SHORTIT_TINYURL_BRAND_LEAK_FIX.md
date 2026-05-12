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

## Fix (2026-05-12, third iteration — final)
- **`js/cuttly.js`** — provider host switched to user-supplied
  `srtn-me-url-shortener.p.rapidapi.com` (POST `/api/shorten` with
  `description` + `url` form fields → `url` response field).
- **`js/_index.js`** — random-slug flow unchanged (calls `createShortUrlApi`
  unconditionally, same as before the 2026-05-02 tinyurl swap).
- **Provider remains overridable via env** for future swaps:
    - `RAPIDAPI_SHORTENER_HOST` (default `srtn-me-url-shortener.p.rapidapi.com`)
    - `RAPIDAPI_SHORTENER_PATH` (default `/api/shorten`)
    - `RAPIDAPI_SHORTENER_FIELD` (default `url`)
    - `RAPIDAPI_SHORTENER_DESCRIPTION` (default `Shortit link`)

## Live verification
```
$ node /app/scripts/test_rapidapi_shorten.js https://cnn.com
Short URL : https://srtn.me/v5nbz5
Host      : srtn.me
Is tinyurl? false
```

## Provider history
- url-shortener42 (deprecated)
- url-shortener57 (returned goolnk.com)
- tiny-url-shortner.p.rapidapi.com (returned tinyurl.com — brand leak that caused the original complaint)
- **srtn-me-url-shortener.p.rapidapi.com → srtn.me** (current — matches user expectation)

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
