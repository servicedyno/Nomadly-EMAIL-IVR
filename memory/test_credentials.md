# Test Credentials

## SMS App Testing
- **Activation Code / ChatId**: `6687923716`
- **User Name**: `sport_chocolate`
- **Plan**: Expired (no active subscription)
- **Free SMS**: 100 used / 100 limit

## SMS App Web URL
- Browser test: `https://setup-helper-36.preview.emergentagent.com/api/sms-app-web`

## Hosting Panel
- **URL**: `https://setup-helper-36.preview.emergentagent.com/panel`
- **Email**: `hello@ivrpod.com`
- **Password**: `Onlygod1234@`
- **Panel Domain**: `https://panel.1.hostbay.io/panel`

## Visitor Captcha Test Accounts (Gold gating)
- Seed script: `set -a; source /app/backend/.env; set +a; node /app/tests/seed_captcha_accounts.js`
- **Gold**: `goldtest` / PIN `123456` — plan `Golden Anti-Red HostPanel (30 Days)`, domain `goldtest.com`, addon `goldaddon.com`
- **Premium (locked)**: `premtest` / PIN `123456` — plan `Premium Anti-Red HostPanel (30 Days)`, domain `premtest.com`
- Pytest: `pytest /app/backend/tests/test_visitor_captcha_gold.py -v`

## Bot
- Username: @NomadlyBot
## Panel Local Test Account\n- Username: testuser\n- PIN: 123456\n- Domain: example-test.com
