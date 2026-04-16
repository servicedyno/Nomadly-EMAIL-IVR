# Quick Start Guide: Browserless Setup for Railway

## 🎯 Goal
Reduce Railway deployment time from **45-160 minutes** to **~5-10 minutes** by using an external browser service instead of bundling Chromium.

---

## ✅ Step 1: Sign Up for Browserless.io (2 minutes)

1. Go to: **https://www.browserless.io/sign-up**
2. Create a free account
3. Free tier includes: **6 hours/month** (plenty for IP whitelisting automation)

---

## ✅ Step 2: Get Your WebSocket Endpoint (1 minute)

After signup, you'll receive a token. Your endpoint will be:

```
wss://chrome.browserless.io?token=YOUR_TOKEN_HERE
```

Example:
```
wss://chrome.browserless.io?token=a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

---

## ✅ Step 3: Add to Railway Environment (1 minute)

1. Open your Railway project dashboard
2. Go to your service → **Variables** tab
3. Add new variable:
   - **Name:** `BROWSER_WS_ENDPOINT`
   - **Value:** `wss://chrome.browserless.io?token=YOUR_TOKEN_HERE`
4. Click **Add**

---

## ✅ Step 4: Deploy to Railway (1 click)

1. Click **Deploy** or push new changes
2. Watch the build complete in **~5-10 minutes** instead of 45-160 minutes! 🎉

---

## 🧪 Testing (Optional)

After deployment, test the IP whitelisting script:

```bash
# In Railway shell or locally with env vars:
export CR_PANEL_EMAIL="hello@ivrpod.com"
export CR_PANEL_PASSWORD="Onlygod1234@"
export BROWSER_WS_ENDPOINT="wss://chrome.browserless.io?token=YOUR_TOKEN"

node js/cr-whitelist-browser.js 203.0.113.42
```

Expected output:
```json
{"success":true,"ip":"203.0.113.42","message":"IP 203.0.113.42 whitelisted in ipaddress1"}
```

---

## 💰 Cost Breakdown

| Item | Before | After |
|------|--------|-------|
| Railway build time | 45-160 min | 5-10 min |
| Browserless.io cost | $0 | $0 (free tier) |
| **Total savings** | - | **90-95% faster builds** ⚡ |

---

## ❓ Troubleshooting

**Error: "WebSocket connection failed"**
- Verify your token is correct in the BROWSER_WS_ENDPOINT variable
- Check Browserless.io dashboard for remaining free hours

**Error: "No BROWSER_WS_ENDPOINT set"**
- Add the environment variable in Railway dashboard
- Make sure it's spelled exactly: `BROWSER_WS_ENDPOINT`

**Need help?**
- See full documentation: `/app/BROWSERLESS_SETUP.md`

---

## 🎉 That's It!

You've successfully optimized your Railway deployments. Enjoy the speed! 🚀
