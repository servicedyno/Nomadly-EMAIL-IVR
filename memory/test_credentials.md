# Test Credentials

## SMS App Testing
- **Activation Code / ChatId**: `6687923716`
- **User Name**: `sport_chocolate`
- **Plan**: Expired (no active subscription)
- **Free SMS**: 100 used / 100 limit

## Current Pod URL (updated 2026-06-24 — env restored fresh)
- Base: `https://0d627ced-c5c9-4abd-b6f9-166b9199a29d.preview.emergentagent.com`
- Bot mode: DEVELOPMENT (BOT_ENVIRONMENT=development, SKIP_WEBHOOK_SYNC=true, OVH_DRY_RUN=true) — dev bot token in use; prod bot/webhooks untouched.

## SMS App Web URL
- Browser test: `https://0d627ced-c5c9-4abd-b6f9-166b9199a29d.preview.emergentagent.com/api/sms-app-web`

## Hosting Panel
- **URL**: `https://0d627ced-c5c9-4abd-b6f9-166b9199a29d.preview.emergentagent.com/panel`
- **Email**: `hello@ivrpod.com`
- **Password**: `Onlygod1234@`
- **Panel Domain**: `https://panel.1.hostbay.io/panel`

## Visitor Captcha Test Accounts (Gold gating) — also used for Panel V2 redesign tests
- Seed script: `set -a; source /app/backend/.env; set +a; node /app/tests/seed_captcha_accounts.js`
- **Gold**: `goldtest` / PIN `123456` — plan `Golden Anti-Red HostPanel (30 Days)`, domain `goldtest.com`, addon `goldaddon.com`
- **Premium (locked)**: `premtest` / PIN `123456` — plan `Premium Anti-Red HostPanel (30 Days)`, domain `premtest.com`
- Pytest: `pytest /app/backend/tests/test_visitor_captcha_gold.py -v`

## Bot
- Username: @NomadlyBot

## Panel — Throwaway Test Account (domain-mode / set-primary feature, this session)
- Username: `pnldoctest`
- PIN: `123456`
- Primary domain: `primary-doctest.example`
- Addon domain: `addon-doctest.example` (docroot mode: `own`)
- Plan: `Golden Anti-Red HostPanel (1-month)` (Gold)
- NOTE: DB-only seed (NOT a real cPanel account). **Currently REMOVED** (cleaned up after testing).
  Re-seed: `node /app/scripts/seed_paneltest_account.js` · Cleanup: `node /app/scripts/cleanup_paneltest_account.js`.
  Use ONLY for validation/wiring tests — cPanel/WHM-mutating happy paths won't work against it.

## Panel Local Test Account
- Username: `testuser`
- PIN: `123456`
- Domain: `example-test.com`

## DigitalOcean (WHM host management)
- API token: stored in `/app/backend/.env` as `DIGITALOCEAN_API_TOKEN` (gitignored — never commit)
- Account email: `moxxcompany@gmail.com`
- **Active WHM droplet** (after 2026-06-17 migration): `id=578369745`, name `whm2-fra1-20260617-1601`, region `fra1`, IP `68.183.77.106`, AlmaLinux 9
- **Old WHM droplet** (destroyed): `id=557194941`, IP `209.38.241.9` — note: dev pod `.env` may still reference the old IP/ID; production Railway env is authoritative
- **DO Cloud Firewall**: `fa8b27c8-405b-4328-8939-c5d2106d2cea` (`hostbay-tunnel-only`) — attached to droplet 578369745 since 2026-02-20. Inbound: only tcp/22 + ICMP. Re-applied during the post-migration lockdown restore.
- Root SSH password: stored in `/app/backend/.env` as `WHM_ROOT_PASSWORD` (gitignored — never commit)
- WHM API token: stored in `/app/backend/.env` as `WHM_TOKEN` (gitignored — never commit). New token created 2026-06-17 during migration: `FOBFEHSBTFBIJNYYDB7UFO4V2LTZJHNC`
- cPanel/WHM version: `11.136` (fresh install on AlmaLinux 9, 2026-06-17)
- 19 cPanel customer accounts recreated during 2026-06-17 migration
- Cloudflare tunnel on this box: `b395cebc-4b7a-4aba-8ced-e11665c26b30` (replaces historical `f63ce7b5-...`)
