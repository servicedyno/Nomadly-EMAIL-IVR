# Railway Production Environment Variables Checklist

## ✅ Currency Exchange API Configuration

**Required for NGN ↔ USD conversion in payment system**

### Environment Variable
```
API_KEY_CURRENCY_EXCHANGE=3082ac7c273f44b182f17e06b6d50490
```

### Purpose
- Converts NGN bank payments to USD wallet credits
- Uses OpenExchangeRates.org API
- Implements 10-minute cache to reduce API calls

### Where It's Used
- `/app/js/utils.js` - Functions: `ngnToUsd()`, `usdToNgn()`
- Called by all bank payment webhooks
- Called when displaying NGN estimates to users

### How to Add to Railway

1. Go to your Railway project dashboard
2. Select your service (backend/nodejs)
3. Navigate to **Variables** tab
4. Click **+ New Variable**
5. Add:
   - **Key**: `API_KEY_CURRENCY_EXCHANGE`
   - **Value**: `3082ac7c273f44b182f17e06b6d50490`
6. Click **Add** and redeploy

### Verification

After deployment, check logs for:
```
[ExchangeRate] API fetch failed
```

If you see this error, the key is missing or invalid.

---

## 📌 Other Important Environment Variables

Ensure these are also set in Railway production:

### MongoDB
```
MONGO_URL=mongodb://[your-production-mongo-connection-string]
DB_NAME=nomadlyDB
```

### Telegram Bot
```
TELEGRAM_BOT_TOKEN=[your-production-bot-token]
TELEGRAM_ADMIN_CHAT_ID=[admin-chat-id]
```

### Payment Gateways
```
FINCRA_API_KEY=[your-fincra-key]
BLOCKBEE_API_KEY=[your-blockbee-key]
DYNOPAY_API_KEY=[your-dynopay-key]
```

### Other
```
PERCENT_INCREASE_USD_TO_NAIRA=0.00
NODE_ENV=production
```

---

## 🧪 Testing After Deployment

1. **Test NGN → USD Conversion**:
   - Initiate a bank NGN deposit
   - Verify it converts and credits USD wallet

2. **Test Exchange Rate API**:
   - Check backend logs for successful rate fetches
   - Ensure no error messages about API failures

3. **Monitor Cache**:
   - Exchange rates cached for 10 minutes
   - Reduces API costs while maintaining accuracy

---

## 🔒 Security Notes

- Keep API keys secret
- Use Railway's encrypted environment variables
- Never commit keys to git
- Rotate keys periodically

---

**Last Updated**: 2026-04-11
