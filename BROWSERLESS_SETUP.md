# 🚀 External Browser Service Setup for Railway Deployments

## Problem Solved
Previously, deploying to Railway took **45-160 minutes** because the full Puppeteer package (~300MB) installed Chromium and heavy system dependencies on every build.

By switching to `puppeteer-core` (~2MB) and an external browser service, Railway deployments now complete in **~5-10 minutes** ⚡

---

## How It Works

The script `/app/js/cr-whitelist-browser.js` now uses:
- **puppeteer-core**: Lightweight library without bundled Chromium
- **External browser service**: Cloud-hosted browser accessed via WebSocket

---

## Setup Instructions

### Option 1: Browserless.io (Recommended - Has Free Tier)

1. **Sign up for free**: https://www.browserless.io/sign-up
   - Free tier: 6 hours/month (plenty for IP whitelisting automation)
   
2. **Get your WebSocket endpoint**:
   - After signup, you'll receive a token
   - Your endpoint will look like: `wss://chrome.browserless.io?token=YOUR_TOKEN_HERE`

3. **Add to Railway environment**:
   ```bash
   # In Railway dashboard → Variables
   BROWSER_WS_ENDPOINT=wss://chrome.browserless.io?token=YOUR_TOKEN_HERE
   ```

4. **Deploy** - That's it! Railway builds will now be fast ⚡

---

### Option 2: BrowserBase.com (Alternative)

1. Sign up: https://www.browserbase.com
2. Get your API key and project ID
3. Endpoint format: `wss://connect.browserbase.com?apiKey=YOUR_API_KEY&projectId=YOUR_PROJECT_ID`
4. Add as `BROWSER_WS_ENDPOINT` in Railway

---

### Option 3: Self-Hosted Browserless (Advanced)

If you prefer self-hosting:

1. **Deploy browserless/chrome Docker container**:
   ```bash
   docker run -p 3000:3000 browserless/chrome
   ```

2. **Use your endpoint**:
   ```bash
   BROWSER_WS_ENDPOINT=ws://your-browserless-host:3000
   ```

---

## Local Development

For local development, you have two options:

### Option A: Use external browser service (same as production)
```bash
# In .env
BROWSER_WS_ENDPOINT=wss://chrome.browserless.io?token=YOUR_TOKEN
```

### Option B: Use local Chrome (requires manual Chrome installation)
```bash
# Don't set BROWSER_WS_ENDPOINT
# Install Chrome/Chromium locally:
# - Mac: brew install chromium
# - Ubuntu: apt-get install chromium-browser
```

---

## Environment Variable Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `BROWSER_WS_ENDPOINT` | Production: Yes<br>Local: Optional | WebSocket endpoint for external browser service |
| `CR_PANEL_EMAIL` | Yes | ConnectReseller panel login email |
| `CR_PANEL_PASSWORD` | Yes | ConnectReseller panel password |

---

## Cost Analysis

### Before (Full Puppeteer)
- Railway build time: 45-160 minutes
- Cost per deploy: High (build minutes charged)
- Total package size: ~400MB

### After (puppeteer-core + Browserless)
- Railway build time: ~5-10 minutes (90-95% faster) ⚡
- Browserless free tier: 6 hours/month (sufficient for occasional IP whitelisting)
- Total package size: ~10MB

---

## Troubleshooting

**Error: "No BROWSER_WS_ENDPOINT set"**
- Add the `BROWSER_WS_ENDPOINT` environment variable to Railway

**Error: "WebSocket connection failed"**
- Verify your Browserless token is correct
- Check if your free tier hours remain (dashboard shows usage)

**Error: "Browser automation error"**
- Check ConnectReseller credentials in `CR_PANEL_EMAIL` and `CR_PANEL_PASSWORD`
- Test the endpoint manually: `wscat -c "wss://chrome.browserless.io?token=YOUR_TOKEN"`

---

## Testing the Setup

Test IP whitelisting manually:
```bash
# Set credentials
export CR_PANEL_EMAIL="your-email@example.com"
export CR_PANEL_PASSWORD="your-password"
export BROWSER_WS_ENDPOINT="wss://chrome.browserless.io?token=YOUR_TOKEN"

# Run script
node js/cr-whitelist-browser.js 203.0.113.42

# Expected output:
# {"success":true,"ip":"203.0.113.42","message":"IP 203.0.113.42 whitelisted in ipaddress1"}
```

---

## Next Steps

1. ✅ Sign up for Browserless.io free tier
2. ✅ Add `BROWSER_WS_ENDPOINT` to Railway environment variables
3. ✅ Redeploy to Railway
4. ✅ Enjoy 90% faster deployments! 🎉
