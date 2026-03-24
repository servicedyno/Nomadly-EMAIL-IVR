# Adding Email Validation Environment Variables to Railway

The Railway API key in your `.env` points to an account with only "Moxx Website" project. Your Nomadly/Speechcue bot is likely deployed on a different Railway account.

## 🎯 Three Options to Add Email Validation Variables

---

## ✅ OPTION 1: Railway CLI (Recommended - Easiest)

### 1. Install Railway CLI
```bash
npm i -g @railway/cli
```

### 2. Authenticate with Your Railway Account
```bash
railway login
```
This will open a browser to authenticate with the Railway account that has your Nomadly bot deployed.

### 3. Link to Your Project
```bash
cd /path/to/your/nomadly/project
railway link
```
Select your Nomadly/Speechcue project from the list.

### 4. Run the Auto-Push Script
```bash
bash /app/scripts/push-email-validation-env-to-railway.sh
```

This will automatically set all 18 email validation variables and trigger a redeploy.

---

## 🔧 OPTION 2: Manual Railway Dashboard

1. Go to https://railway.app/dashboard
2. Select your Nomadly/Speechcue project
3. Click on your service
4. Go to "Variables" tab
5. Add these variables:

```env
EMAIL_VALIDATION_ON=true
EV_TIER_1_MAX=1000
EV_TIER_1_PRICE=0.005
EV_TIER_2_MAX=10000
EV_TIER_2_PRICE=0.004
EV_TIER_3_MAX=50000
EV_TIER_3_PRICE=0.003
EV_TIER_4_MAX=100000
EV_TIER_4_PRICE=0.002
EV_MIN_EMAILS=10
EV_MAX_EMAILS=100000
EV_MAX_PASTE=100
EV_WORKER_URL=http://5.189.166.127:8787
EV_WORKER_SECRET=ev-worker-secret-2026
EV_WORKER_BATCH=100
EV_WORKER_TIMEOUT=120000
EV_USE_DIRECT_SMTP=false
EV_DOMAIN_CONCURRENCY=10
EV_PROGRESS_INTERVAL=20
```

6. Railway will automatically redeploy after adding variables

---

## 🔌 OPTION 3: Railway API (If You Have the Correct API Key)

### 1. Get Your Railway API Key
- Go to https://railway.app/account/tokens
- Create a new token for your Nomadly project's account
- Copy the token

### 2. Update the API Key in Your Environment
```bash
export API_KEY_RAILWAY="your-new-railway-api-key"
```

### 3. Get Your Project ID
```bash
python3 /app/scripts/push_ev_vars_to_railway.py
```
This will list all projects under your account. Find your Nomadly/Speechcue project ID.

### 4. Push Variables
```bash
python3 /app/scripts/push_ev_vars_to_railway.py \
  --project-id <YOUR_PROJECT_ID> \
  --env production
```

---

## 📋 What These Variables Do

| Variable | Purpose | Value |
|----------|---------|-------|
| `EMAIL_VALIDATION_ON` | Feature flag to enable email validation | `true` |
| `EV_TIER_*_MAX` | Max emails per tier for tiered pricing | 1k, 10k, 50k, 100k |
| `EV_TIER_*_PRICE` | Price per email for each tier | $0.005 → $0.002 |
| `EV_MIN_EMAILS` | Minimum emails per validation job | 10 |
| `EV_MAX_EMAILS` | Maximum emails per validation job | 100,000 |
| `EV_MAX_PASTE` | Max emails when pasting directly | 100 |
| `EV_WORKER_URL` | Contabo VPS SMTP worker endpoint | http://5.189.166.127:8787 |
| `EV_WORKER_SECRET` | Authentication secret for worker | ev-worker-secret-2026 |
| `EV_WORKER_BATCH` | Emails per batch to worker | 100 |
| `EV_WORKER_TIMEOUT` | Worker request timeout (ms) | 120000 (2 min) |
| `EV_USE_DIRECT_SMTP` | Use direct SMTP (requires port 25) | false (use VPS worker) |
| `EV_DOMAIN_CONCURRENCY` | Concurrent domain checks | 10 |
| `EV_PROGRESS_INTERVAL` | Progress notification frequency (emails) | Every 20 emails |

---

## 🔍 Verify Deployment

After variables are added, Railway will automatically redeploy. Check logs:

```bash
railway logs
```

Look for:
```
[EmailValidation] Service initialized
EMAIL_VALIDATION_ON: true
```

---

## 🚨 Important Notes

1. **Contabo VPS Worker**: The email validation worker is already running on Contabo VPS (5.189.166.127:8787). Make sure this IP is accessible from Railway.

2. **Port 25 Restriction**: Railway blocks outbound port 25 (SMTP), which is why we use the external Contabo worker.

3. **Auto-Redeploy**: Railway automatically redeploys when you add/change environment variables. This takes 2-3 minutes.

4. **Cost**: Email validation pricing is configurable via these variables. Current config:
   - 1-1,000 emails: $0.005/email
   - 1,001-10,000: $0.004/email
   - 10,001-50,000: $0.003/email
   - 50,001-100,000: $0.002/email

---

## 📞 Need Help?

If you encounter issues:
1. Check Railway deployment logs: `railway logs`
2. Verify VPS worker is running: `curl http://5.189.166.127:8787/health`
3. Check bot logs for `[EmailValidation] Service initialized`

