# Shortit shortener disabled on production

**Date:** 2026-02 (current session)
**Scope:** Disable the "Shortit (Trial)" URL-shortener option and the free-trial shortlinks only on Railway production. Bit.ly and Custom Domain Shortener are untouched.

## Feature flag
- `SHORTIT_ENABLED` — treated as enabled unless explicitly set to the string `false`.
- Default (unset / anything other than `"false"`) → Shortit is **enabled** (local/dev behaviour unchanged).
- `SHORTIT_ENABLED=false` → Shortit button hidden, handler guarded, and new users are no longer granted free-trial shortlinks.

## Code changes (`/app/js/_index.js`)
- L845 — added `const SHORTIT_ENABLED = process.env.SHORTIT_ENABLED !== 'false'`
- L5571 — in first-seen-user init, skip granting `FREE_LINKS` when flag is off (`initial = SHORTIT_ENABLED ? FREE_LINKS : 0`)
- L7492 — `submenu1()` builds keyboard without `user.redShortit` when flag is off
- L11563 — handler for `user.redShortit` returns "⚠️ Shortit is currently unavailable" when flag is off

## Production rollout actions taken
- Railway service `Nomadly-EMAIL-IVR` (project `New Hosting`, env `production`) — `SHORTIT_ENABLED=false` set via GraphQL variableUpsert.
- Production MongoDB `freeShortLinksOf` collection — 242 users with val>0 updated to `val=0`.
- Railway auto-triggered a redeploy on env-var change; deployment status confirmed `SUCCESS`.

## Pending
- Code changes in `/app/js/_index.js` still need to be pushed to `servicedyno/Nomadly-EMAIL-IVR` (`main`) so the flag check is actually wired into prod. User should use the "Save to Github" button to push. After that, Railway will redeploy and the Shortit button will be hidden from the keyboard and handler will be guarded.
- Until the code is pushed, the env var has no effect on the deployed build; the DB zeroing provides a temporary mitigation because downstream free-trial checks already gate at `val === 0`.

## Rollback
1. Railway → Nomadly-EMAIL-IVR → production → set `SHORTIT_ENABLED=true` (or delete the var).
2. (Optional) Reset counters: `db.freeShortLinksOf.updateMany({ val: 0 }, { $set: { val: FREE_LINKS } })`.
