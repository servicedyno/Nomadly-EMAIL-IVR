# Shortit shortener — production status

**Last update:** 2026-02 (current session, re-enabled with srtn.me provider)

## Current production state
- `SHORTIT_ENABLED=true` on Railway (Nomadly-EMAIL-IVR / production)
- 242 existing users restored to `freeShortLinksOf.val = 5` (FREE_LINKS)
- Latest deployed commit on prod: `c0738d94`
  - ✅ Contains the `SHORTIT_ENABLED` feature flag (button shown again)
  - ⚠️ **Still calls old `tiny-url-shortner.p.rapidapi.com` provider** in `customCuttly.js`
- Local HEAD `dbd6db49` has the new srtn.me provider — **not yet pushed to GitHub**

## Provider (in local HEAD, pending push)
- New endpoint: `https://srtn-me-url-shortener.p.rapidapi.com/api/shorten`
- Method: `POST` form-urlencoded
- Body: `url=<longUrl>&description=<optional>`
- Response: `{"url": "https://srtn.me/<6-char-random>"}`
- Tested live: `cnn.com → https://srtn.me/vmwq5b → 302 → https://www.cnn.com/` ✅
- **No custom alias support** on BASIC tier — alias param silently ignored. Bot's vanity-alias UX still uses internal `clicksOn` collection.

## Feature flag (local HEAD)
- `SHORTIT_ENABLED = process.env.SHORTIT_ENABLED !== 'false'`
- Default: enabled (any value other than the literal `"false"`)
- Guards 3 sites in `js/_index.js`:
  - L845 — flag definition
  - L5571 — skip granting `FREE_LINKS` on first-seen-user when off
  - L7492 — hide `user.redShortit` button in `submenu1()` keyboard when off
  - L11563 — handler returns "Shortit is currently unavailable" when off

## Pending
- Push local commit `dbd6db49` to `servicedyno/Nomadly-EMAIL-IVR:main` via "Save to Github" so srtn.me reaches production. After push, Railway auto-redeploys.

## Rollback recipes
**To disable Shortit again:**
- Railway → set `SHORTIT_ENABLED=false`
- (optional) MongoDB: `db.freeShortLinksOf.updateMany({val:{$gt:0}}, {$set:{val:0}})`

**To revert provider to old tiny-url-shortner:**
- `git revert dbd6db49` then push.
