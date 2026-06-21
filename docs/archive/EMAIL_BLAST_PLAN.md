# 📧 Nomadly Email Blast Service — Implementation Plan

## Status: AWAITING APPROVAL
**Date:** July 2025
**Domains:** tracking-assist.com, efirstportal.com
**VPS:** Contabo 5.189.166.127 (Ubuntu 24.04, 8GB RAM)

---

## 1. Overview

Add a complete Email Blast service to the Nomadly Telegram Bot where users can:
- Upload an email list (500–5,000 recipients)
- Bot validates the list and shows cost summary
- User pays via existing payment methods (Wallet, Bank, Crypto, DynoPay)
- Emails are queued and sent with domain/IP rotation
- User receives delivery notification when campaign completes

Admin can:
- Add/remove sending domains from the bot
- Configure pricing
- Monitor IP warming progress
- View campaign stats
- Manage suppression list

---

## 2. Architecture

```
┌──────────────────────────────────────────────┐
│  EMERGENT POD (Telegram Bot = The Engine)     │
│                                               │
│  ┌─────────────┐  ┌──────────────────────┐   │
│  │ Telegram UI  │  │  Email Blast Service │   │
│  │ User flow    │  │  - Campaign mgmt     │   │
│  │ Admin flow   │  │  - Email validation  │   │
│  │ Payment      │  │  - Queue processor   │   │
│  └──────┬───────┘  │  - Domain rotation   │   │
│         │          │  - IP rotation       │   │
│         │          │  - DKIM signing      │   │
│         │          │  - Warming scheduler │   │
│         │          │  - Bounce handling   │   │
│         │          │  - Analytics         │   │
│         │          └──────────┬───────────┘   │
│         │                     │               │
│  ┌──────┴─────────────────────┴────────┐      │
│  │  MongoDB (existing)                  │      │
│  │  - emailCampaigns                    │      │
│  │  - emailDomains                      │      │
│  │  - emailSuppressions                 │      │
│  │  - emailIpWarming                    │      │
│  │  - emailSettings                     │      │
│  └─────────────────────────────────────┘      │
│                     │                          │
│  ┌──────────────────┴──────────────────┐      │
│  │  Cloudflare API                      │      │
│  │  Auto-create SPF/DKIM/DMARC/A/MX    │      │
│  └─────────────────────────────────────┘      │
└──────────────────────┬───────────────────────┘
                       │ SMTP (port 587, TLS, authenticated)
                       ▼
┌──────────────────────────────────────────────┐
│  CONTABO VPS (5.189.166.127)                  │
│                                               │
│  Postfix MTA — authenticated relay            │
│  ┌─────────────────────────────────────┐      │
│  │  IP 1: 5.189.166.127 (primary)      │      │
│  │  IP 2: x.x.x.x (to be purchased)   │      │
│  │  IP 3: x.x.x.x (to be purchased)   │      │
│  │  ...more IPs as needed              │      │
│  └─────────────────────────────────────┘      │
│  Each IP:                                     │
│  - Own rDNS/PTR record                        │
│  - Own Postfix transport                      │
│  - Own warming schedule                       │
│  - Mapped to specific domain(s)               │
│                                               │
│  Port 25 outbound → Gmail/Yahoo/Outlook       │
└──────────────────────────────────────────────┘
```

---

## 3. VPS Setup (Phase 1)

### 3.1 Postfix Installation & Configuration
- Install Postfix as "Internet Site" MTA
- Configure authenticated SMTP submission on port 587
- SASL authentication (bot authenticates with username/password)
- TLS encryption via Let's Encrypt certificates
- Configure firewall (UFW): open ports 22, 25, 587, 80 (certbot)

### 3.2 Multi-IP Configuration
- Primary IP: 5.189.166.127 (already active)
- Additional IPs: purchased by admin from Contabo panel (~$3/mo each)
- Each IP configured as a Postfix transport
- iptables SNAT rules ensure outbound traffic uses correct IP
- Postfix sender_dependent_default_transport_maps for domain→IP mapping

### 3.3 rDNS/PTR Records
- **Must be set by admin** in Contabo control panel (I'll provide exact values)
- Each IP needs PTR pointing to mail hostname:
  - IP1 → mail1.tracking-assist.com
  - IP2 → mail2.tracking-assist.com
  - IP3 → mail1.efirstportal.com
  - etc.

### 3.4 Testing
- Verify SMTP connectivity from bot to VPS on port 587
- Test authenticated send
- Verify TLS handshake
- Test port 25 outbound delivery to Gmail/Yahoo

---

## 4. DNS Setup (Phase 2)

### 4.1 Automated via Cloudflare API
For each sending domain, the bot creates:

| Record Type | Name | Value | Purpose |
|-------------|------|-------|---------|
| A | mail.tracking-assist.com | 5.189.166.127 | Mail server hostname |
| MX | tracking-assist.com | mail.tracking-assist.com (pri 10) | Mail exchange |
| TXT | tracking-assist.com | `v=spf1 ip4:5.189.166.127 ip4:IP2 ip4:IP3 ~all` | SPF authentication |
| TXT | mail2025._domainkey.tracking-assist.com | `v=DKIM1; k=rsa; p=PUBLIC_KEY` | DKIM signing |
| TXT | _dmarc.tracking-assist.com | `v=DMARC1; p=quarantine; rua=mailto:dmarc@tracking-assist.com` | DMARC policy |

Same for efirstportal.com. When admin adds a new domain from the bot, all records are auto-created.

### 4.2 DKIM Key Generation
- 2048-bit RSA key pairs generated in Node.js (`crypto.generateKeyPairSync`)
- Private key stored in MongoDB (emailDomains collection)
- Public key published to Cloudflare DNS automatically
- Selector format: `mail2025` (rotated annually)

---

## 5. IP Warming System (Phase 3) ⭐

### 5.1 Warming Schedule (per IP)

| Day | Daily Limit | Hourly Max | Stage |
|-----|------------|------------|-------|
| 1–3 | 20 | 5 | 🟡 Seed — send to own/team emails |
| 4–7 | 50 | 10 | 🟡 Foundation |
| 8–14 | 100 | 20 | 🟠 Ramp-up |
| 15–21 | 300 | 50 | 🟠 Building |
| 22–30 | 800 | 120 | 🔵 Scaling |
| 31–45 | 2,000 | 300 | 🔵 Maturing |
| 46–60 | 5,000 | 750 | 🟢 Warm |
| 61+ | 10,000+ | 1,500 | 🟢 Full capacity |

### 5.2 How It Works
- MongoDB collection `emailIpWarming` tracks each IP:
  ```
  {
    ip: "5.189.166.127",
    domain: "tracking-assist.com",
    startDate: "2025-07-10",
    currentDay: 15,
    stage: "building",
    dailySent: 180,
    dailyLimit: 300,
    hourlySent: 32,
    hourlyLimit: 50,
    totalSent: 2400,
    bounceRate: 0.8,
    isWarm: false,
    isPaused: false,
    graduatedAt: null
  }
  ```

### 5.3 Warming Logic
- **Before sending**: Check if IP's daily/hourly limit is reached → if yes, queue for next hour/day or use another warm IP
- **After sending**: Increment counters, check bounce rate
- **Auto-graduation**: When IP completes 60-day schedule with < 2% bounce rate → marked as `isWarm: true`
- **Auto-pause**: If bounce rate > 5% for any IP → pause warming, alert admin
- **Smart routing**: During warming, campaigns are distributed across IPs proportionally to their current capacity
  - Example: IP1 (warm, 10k/day capacity) + IP2 (day 15, 300/day capacity) → IP1 gets 97% of traffic

### 5.4 Admin Warming Controls (Telegram)
```
📊 IP Warming Status

IP 5.189.166.127 (tracking-assist.com)
  Stage: 🟠 Building (Day 15/60)
  Today: 180/300 sent
  Bounce rate: 0.8%
  Status: Active ✅

IP x.x.x.x (efirstportal.com)
  Stage: 🟡 Foundation (Day 5/60)
  Today: 35/50 sent
  Bounce rate: 0.2%
  Status: Active ✅

[⏸ Pause IP] [▶️ Resume IP] [📈 Full Stats]
```

### 5.5 Warming + Campaign Interaction
- When user submits a 5,000-email campaign but total warm IP capacity is only 1,500/day:
  - Bot shows: "⏳ Your campaign will take ~4 days to complete due to IP warming limits"
  - Campaign drips across multiple days automatically
  - User gets daily progress updates
  - Final notification when 100% delivered

---

## 6. Email Validation (Phase 4)

### 6.1 Four-Layer Validation
1. **Syntax check** — regex validates email format
2. **MX record lookup** — `dns.resolveMx()` verifies domain accepts mail
3. **Disposable email filter** — block 10,000+ known temp email domains (maintained list)
4. **SMTP RCPT TO** — connect to recipient's mail server, verify address exists (optional, configurable)

### 6.2 Validation Results
```
📋 Validation Results

✅ Valid: 4,720 emails
❌ Invalid: 180 emails (syntax errors, no MX)
🚫 Disposable: 45 emails (temp email services)
⚠️ Risky: 55 emails (catch-all domains)

Proceed with 4,720 valid emails?
💰 Cost: $472.00 ($0.10/email)
```

---

## 7. Campaign Flow — User (Phase 5)

### 7.1 Telegram User Flow

```
User taps: 📧 Email Blast

Step 1: Upload Email List
  → "📤 Send me a CSV or TXT file with email addresses (min 500, max 5,000)"
  → User uploads file
  → Bot parses and validates

Step 2: Validation Report
  → "✅ 4,720 valid / ❌ 280 removed"
  → "Removed: 180 invalid syntax, 45 disposable, 55 risky"

Step 3: Email Content
  → "📝 Now send me the email content"
  → Option A: Plain text message
  → Option B: HTML file upload
  → "What should the Subject line be?"
  → "What From Name? (e.g., 'Nomadly Team')"

Step 4: Preview
  → Bot shows preview: From, Subject, first 200 chars of body
  → [✅ Looks Good] [✏️ Edit] [❌ Cancel]

Step 5: Cost Summary
  → "💰 Campaign Summary:"
  → "   Recipients: 4,720"
  → "   Rate: $0.10/email"
  → "   Total: $472.00"
  → "   Est. delivery: ~4 days (warming in progress)"
  → [👛 Wallet] [🏦 Bank] [₿ Crypto]

Step 6: Payment
  → Existing payment flow (wallet deduction / bank / crypto / DynoPay)
  → On success: campaign queued

Step 7: Progress Updates
  → "📤 Campaign started! Sending 4,720 emails..."
  → "📊 Progress: 1,200/4,720 (25%) — Day 1"
  → "📊 Progress: 2,700/4,720 (57%) — Day 2"
  → "📊 Progress: 4,000/4,720 (85%) — Day 3"

Step 8: Completion
  → "✅ Campaign Complete!"
  → "   📤 Sent: 4,720"
  → "   ✅ Delivered: 4,590 (97.2%)"
  → "   ↩️ Bounced: 130 (2.8%)"
  → "   ⏱ Duration: 3.5 days"
```

### 7.2 Campaign States
- `pending_validation` → validating email list
- `pending_content` → waiting for email body/subject
- `pending_payment` → waiting for payment
- `queued` → paid, waiting to send
- `sending` → actively sending in batches
- `paused` → auto-paused (warming limit or bounce rate)
- `completed` → all emails sent
- `cancelled` → user or admin cancelled
- `failed` → unrecoverable error

---

## 8. Admin Controls (Phase 6)

### 8.1 Admin Telegram Menu
```
⚙️ Email Blast Admin

[📊 Dashboard]        — active campaigns, queue size, daily stats
[🌐 Manage Domains]   — add/remove sending domains
[🖥️ Manage IPs]       — view IPs, warming status, add IP
[💰 Pricing]          — configure rate per email, min/max
[🚫 Suppression List] — view/clear bounced addresses
[📈 Analytics]        — delivery rates, bounce rates, by domain/IP
```

### 8.2 Admin — Add Domain Flow
```
Admin taps: ➕ Add Domain
  → "Enter the domain name (must be on Cloudflare):"
  → Admin enters: "newdomain.com"
  → Bot via Cloudflare API:
     ✅ Created A record: mail.newdomain.com → 5.189.166.127
     ✅ Created MX record
     ✅ Generated DKIM keys (2048-bit)
     ✅ Created SPF record
     ✅ Created DKIM TXT record
     ✅ Created DMARC record
  → "✅ Domain newdomain.com is ready for sending!"
  → "⚠️ Assign an IP and start warming before using in campaigns"
```

### 8.3 Admin — Add IP Flow
```
Admin taps: ➕ Add IP
  → "Enter the new IP address:"
  → Admin enters: "x.x.x.x"
  → "Assign to domain:" [tracking-assist.com] [efirstportal.com]
  → Bot configures Postfix transport for the new IP (via SSH)
  → Bot updates SPF record via Cloudflare API
  → Bot starts warming schedule
  → "✅ IP x.x.x.x added and warming started!"
  → "⚠️ Set rDNS in Contabo panel: x.x.x.x → mail.tracking-assist.com"
```

### 8.4 Admin — Configure Pricing
```
Admin taps: 💰 Pricing
  → Current: $0.10/email | Min: 500 | Max: 5,000
  → [💲 Change Rate] [📉 Change Min] [📈 Change Max]
  → Admin enters new rate: "0.08"
  → "✅ Rate updated to $0.08/email ($40 per 500)"
```

---

## 9. Sending Engine (Phase 7)

### 9.1 Queue Processor
- Runs as a background interval in the bot (every 30 seconds)
- Picks next batch of emails from queued campaigns
- Checks IP warming limits before sending
- Distributes across domains/IPs (round-robin weighted by capacity)
- Batch size: 10-50 emails per cycle (configurable)
- Uses Nodemailer with DKIM signing per domain

### 9.2 Domain + IP Rotation
```
Campaign: 4,720 emails

Domain Pool:
  tracking-assist.com → IP 5.189.166.127 (warm, 10k/day)
  efirstportal.com    → IP x.x.x.x (day 15, 300/day)

Rotation strategy:
  Email 1 → tracking-assist.com via IP1
  Email 2 → efirstportal.com via IP2
  Email 3 → tracking-assist.com via IP1
  ...round-robin, respecting each IP's daily limit
```

### 9.3 Email Headers (for deliverability)
Every email includes:
- `From`: configured sender name + domain
- `Reply-To`: configurable
- `List-Unsubscribe`: `<mailto:unsubscribe@domain.com>` (Gmail/Yahoo required)
- `List-Unsubscribe-Post`: `List-Unsubscribe=One-Click`
- `X-Mailer`: removed (reduces spam score)
- `Message-ID`: proper format with sending domain
- `MIME-Version`: 1.0
- `Content-Type`: multipart/alternative (HTML + plain text)
- DKIM signature (Nodemailer-signed, 2048-bit)

### 9.4 Throttling
- Per-IP hourly/daily limits (from warming schedule)
- Per-domain limits
- Global rate limit (configurable, default 25/min for Contabo)
- Exponential backoff on temporary SMTP errors (4xx)
- Immediate skip on permanent errors (5xx) → add to suppression list

---

## 10. Bounce Handling (Phase 8)

### 10.1 Detection Methods
- **Nodemailer errors**: SMTP rejection during send (immediate bounce)
- **DSN headers**: Request delivery status notifications
- **Bounce address**: Set `Return-Path` to a monitored address

### 10.2 Bounce Classification
| Type | Action | Example |
|------|--------|---------|
| Hard bounce (550, 551, 552, 553) | Add to suppression list, never send again | "User unknown", "Mailbox not found" |
| Soft bounce (421, 450, 451, 452) | Retry up to 3 times with backoff | "Too many connections", "Mailbox full" |
| Spam complaint | Add to suppression list + alert admin | Recipient marked as spam |

### 10.3 Auto-Protection
- If campaign bounce rate > 5% → auto-pause campaign, alert admin
- If IP bounce rate > 5% → pause IP warming, alert admin
- If domain bounce rate > 10% → disable domain, alert admin

---

## 11. MongoDB Collections

### 11.1 emailCampaigns
```javascript
{
  campaignId: "uuid",
  chatId: 12345,           // Telegram user
  status: "sending",       // pending_validation|pending_content|pending_payment|queued|sending|paused|completed|cancelled|failed
  emails: ["a@b.com"],     // validated email list
  totalEmails: 4720,
  sentCount: 1200,
  deliveredCount: 1180,
  bouncedCount: 20,
  failedCount: 0,
  subject: "Hello!",
  bodyHtml: "<p>...</p>",
  bodyText: "...",
  fromName: "Nomadly Team",
  pricePerEmail: 0.10,
  totalPrice: 472.00,
  paymentMethod: "wallet",
  paymentCoin: "usd",
  createdAt: Date,
  startedAt: Date,
  completedAt: Date,
  lastProgressUpdate: Date,
  currentBatchIndex: 240     // tracks where we are in the list
}
```

### 11.2 emailDomains
```javascript
{
  domain: "tracking-assist.com",
  cloudflareZoneId: "xxx",
  dkimSelector: "mail2025",
  dkimPrivateKey: "-----BEGIN RSA PRIVATE KEY-----...",
  dkimPublicKey: "v=DKIM1; k=rsa; p=...",
  assignedIps: ["5.189.166.127"],
  spfRecord: "v=spf1 ip4:5.189.166.127 ~all",
  isActive: true,
  addedBy: 5590563715,      // admin chatId
  addedAt: Date,
  totalSent: 15000,
  bounceRate: 1.2
}
```

### 11.3 emailIpWarming
```javascript
{
  ip: "5.189.166.127",
  domain: "tracking-assist.com",
  startDate: Date,
  currentDay: 15,
  stage: "building",        // seed|foundation|rampup|building|scaling|maturing|warm
  dailyLimit: 300,
  hourlyLimit: 50,
  dailySent: 180,
  hourlySent: 32,
  hourlyResetAt: Date,
  totalSent: 2400,
  bounceRate: 0.8,
  isWarm: false,
  isPaused: false,
  graduatedAt: null,
  history: [
    { date: "2025-07-10", sent: 20, bounced: 0 },
    { date: "2025-07-11", sent: 20, bounced: 0 },
    ...
  ]
}
```

### 11.4 emailSuppressions
```javascript
{
  email: "bad@example.com",
  reason: "hard_bounce",     // hard_bounce|soft_bounce_max|spam_complaint|manual
  bounceCode: "550",
  campaignId: "uuid",
  addedAt: Date
}
```

### 11.5 emailSettings
```javascript
{
  settingKey: "email_blast",
  pricePerEmail: 0.10,       // $0.10/email
  minEmails: 500,
  maxEmails: 5000,
  globalRatePerMin: 25,      // Contabo limit
  batchSize: 10,
  maxRetries: 3,
  bounceRateThreshold: 5,    // pause at 5%
  warmingEnabled: true,
  updatedBy: 5590563715,
  updatedAt: Date
}
```

---

## 12. File Structure (New Files)

```
/app/js/
├── email-blast-service.js     ← Core service: queue processor, sending engine,
│                                 domain/IP rotation, bounce handling, analytics
├── email-validation.js        ← 4-layer email validation (syntax, MX, disposable, SMTP)
├── email-warming.js           ← IP warming scheduler, limits, auto-graduation
├── email-dns.js               ← Cloudflare API: create/update/delete DNS records
│                                 (SPF, DKIM, DMARC, A, MX)
├── email-config.js            ← Button labels, action constants, translations
└── disposable-domains.json    ← 10,000+ disposable email domains list
```

**Modified Files:**
```
/app/js/_index.js              ← Add Telegram flows (user + admin), payment integration,
│                                 action handlers, menu buttons
/app/js/phone-config.js        ← Add button constants for email blast
/app/js/lang/en.js             ← English translations
/app/js/lang/fr.js             ← French translations
/app/js/lang/zh.js             ← Chinese translations
/app/js/lang/hi.js             ← Hindi translations
```

---

## 13. Implementation Phases & Order

### Phase 1: VPS Setup (SSH into Contabo)
1. Install Postfix + configure as authenticated relay
2. Configure TLS (Let's Encrypt)
3. Configure firewall (UFW)
4. Create SMTP auth user for bot
5. Test: send test email from bot → VPS → Gmail
**Test:** `curl` or `swaks` test from bot to VPS, verify delivery to Gmail inbox

### Phase 2: DNS + DKIM (Cloudflare API)
1. Build email-dns.js — Cloudflare API wrapper
2. Generate DKIM keys for tracking-assist.com and efirstportal.com
3. Create all DNS records (A, MX, SPF, DKIM, DMARC) for both domains
4. Verify DNS propagation
**Test:** `dig` queries to verify records, send DKIM-signed test email, check mail-tester.com score

### Phase 3: IP Warming System
1. Build email-warming.js
2. Implement warming schedule (8 stages, 60 days)
3. Daily/hourly limit enforcement
4. Auto-graduation logic
5. Admin warming status commands
**Test:** Create warming entry for primary IP, verify limits are enforced

### Phase 4: Email Validation
1. Build email-validation.js
2. Syntax + MX + disposable filter + SMTP check
3. Parse CSV/TXT file uploads
**Test:** Validate test email list, verify valid/invalid classification

### Phase 5: Sending Engine + Queue
1. Build email-blast-service.js
2. MongoDB campaign CRUD
3. Queue processor (background interval)
4. Domain/IP rotation
5. DKIM signing via Nodemailer
6. Throttling + retry logic
7. Bounce detection + suppression list
**Test:** Queue test campaign, verify batch sending, verify rotation

### Phase 6: Telegram User Flow
1. Add button constants + action constants
2. Upload email list handler
3. Email content/subject handler
4. Preview handler
5. Cost summary + payment integration
6. Progress notification system
7. Completion notification
**Test:** Full end-to-end user flow via Telegram

### Phase 7: Admin Controls
1. Admin menu (Dashboard, Domains, IPs, Pricing, Suppressions, Analytics)
2. Add/remove domain flow
3. Add IP + assign domain flow
4. Configure pricing flow
5. Warming status display
**Test:** Admin adds domain, verifies DNS created, views warming status

### Phase 8: Translations
1. Add all new strings to en.js, fr.js, zh.js, hi.js
**Test:** Switch language, verify all strings display correctly

---

## 14. Pricing Configuration

| Setting | Default | Admin Configurable |
|---------|---------|-------------------|
| Rate per email | $0.10 | ✅ Yes |
| Minimum emails | 500 | ✅ Yes |
| Maximum emails | 5,000 | ✅ Yes |
| Global send rate | 25/min | ✅ Yes |

**Example costs:**
- 500 emails = $50.00
- 1,000 emails = $100.00
- 5,000 emails = $500.00

---

## 15. What Admin Needs To Do Manually

1. **Buy additional IPs** from Contabo control panel (~$3/mo each)
2. **Set rDNS/PTR records** for each IP in Contabo control panel
   - I'll tell you exactly what to set for each IP
3. **Ensure sending domains are on Cloudflare** (already confirmed ✅)

Everything else is automated by the bot.

---

## 16. Security Considerations

- SMTP auth credentials stored in backend/.env (not in code)
- DKIM private keys stored in MongoDB (encrypted at rest)
- Bot-to-VPS SMTP uses TLS encryption
- Firewall restricts VPS port 587 to bot's IP only (optional)
- Rate limiting prevents abuse
- Admin-only access for configuration changes
- Suppression list prevents sending to known-bad addresses

---

## 17. Deliverability Checklist

- [x] SPF authentication
- [x] DKIM signing (2048-bit)
- [x] DMARC policy
- [x] rDNS/PTR records
- [x] TLS encryption
- [x] List-Unsubscribe header (Gmail/Yahoo 2024 requirement)
- [x] IP warming (60-day schedule)
- [x] Domain rotation
- [x] IP rotation
- [x] Email validation (pre-send)
- [x] Bounce handling + suppression list
- [x] Throttled sending
- [x] Proper MIME (HTML + plain text)
- [x] Clean Message-ID format

---

## AWAITING YOUR APPROVAL

Please review and confirm:
1. ✅ Overall architecture
2. ✅ IP warming schedule (60-day, 8 stages)
3. ✅ Pricing ($0.10/email, admin configurable)
4. ✅ User flow (upload → validate → pay → send → notify)
5. ✅ Admin controls (domains, IPs, pricing, warming, analytics)
6. ✅ Implementation order (Phases 1-8)

**Any changes or additions before I start building?**
