# Test Credentials

## SMS App Testing
- **Activation Code / ChatId**: `6687923716`
- **User Name**: `sport_chocolate`
- **Plan**: Expired (no active subscription)
- **Free SMS**: 100 used / 100 limit

## SMS App Web URL
- Browser test: `https://readme-guide-8.preview.emergentagent.com/api/sms-app-web`

## Hosting Panel
- **URL**: `https://readme-guide-8.preview.emergentagent.com/panel`
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

## Panel Local Test Account
- Username: `testuser`
- PIN: `123456`
- Domain: `example-test.com`

## DigitalOcean (WHM host management)
- API token: stored in `/app/backend/.env` as `DIGITALOCEAN_API_TOKEN` (gitignored — never commit)
- Account email: `moxxcompany@gmail.com`
- WHM droplet: `id=557194941`, name `ubuntu-s-1vcpu-2gb-fra1-01`, region `fra1`, IP `209.38.241.9` (also `WHM_HOST` in `.env`)
- Tag: `WHM`
- Image: stock `ubuntu-24-04-x64` (cPanel installed manually on top)
- SSH keys on account: 0 — droplet is password-only auth
- Root SSH password: stored in `/app/backend/.env` as `WHM_ROOT_PASSWORD` (gitignored — never commit)
- Snapshot taken before upcp on 2026-05-01 08:14 UTC: id `226828287` name `pre-upcp-2026-05-01` (16.58 GB)
- License: ACTIVE since 2026-05-01 02:27:02 UTC, package `CPDIRECT-PRO-CLOUD` via cPanel Direct
- WHM API token: stored in `/app/backend/.env` as `WHM_TOKEN` (gitignored — never commit). Token name on server: `nomadly-bot-20260501`. Created via `whmapi1 api_token_create` on 2026-05-01 08:17 UTC after upcp completed.
- 13 cPanel customer accounts intact on host (verified via `whmapi1 listaccts` HTTP 200).
- cPanel/WHM version: `11.134.0.20`
