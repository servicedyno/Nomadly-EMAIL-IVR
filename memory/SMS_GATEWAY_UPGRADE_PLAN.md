# Nomadly SMS Gateway — Web Services & API Upgrade Plan
## Competitive Analysis: SemySMS.net Feature Parity + Beyond

**Document Version:** 1.0
**Created:** July 2025
**Status:** Planning — Awaiting Implementation
**Reference:** https://semysms.net

---

## 1. Executive Summary

This document outlines a comprehensive upgrade plan to transform Nomadly's SMS App from a Telegram-bot-managed Android SMS sender into a full-featured **SMS Gateway platform** with web dashboard, public REST API, webhooks, contact management, analytics, and advanced features — achieving feature parity with SemySMS.net while leveraging Nomadly's existing infrastructure (Telegram bot, subscription system, wallet payments).

---

## 2. Current State — Nomadly SMS App

### 2.1 What Exists Today

| Component | Details |
|---|---|
| **Android App** | Capacitor hybrid app (`sms-app/`) with native SMS sending (foreground + background Java service) |
| **Campaign System** | CRUD via bot + app, message rotation (`---` delimiter), gap time (1-300s), scheduling |
| **Server Sync** | Campaigns sync between app ↔ server via `/sms-app/sync/:chatId` |
| **Subscription** | Free trial (100 SMS) + paid plans via Telegram bot, enforced on all write endpoints |
| **APK Distribution** | `/sms-app/download` endpoint, version tracking, update notifications |
| **Diagnostics** | `/sms-app/diagnostics/:chatId` — device info, campaign stats, error breakdown |
| **Auth** | `chatId`-based auth via `/sms-app/auth/:code` with device ID binding |

### 2.2 Existing API Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/sms-app/auth/:code` | GET | Authenticate device by chatId |
| `/sms-app/logout/:code` | POST | Logout device |
| `/sms-app/plan/:code` | GET | Get plan info |
| `/sms-app/campaigns/:chatId` | GET | List campaigns |
| `/sms-app/campaigns` | POST | Create campaign |
| `/sms-app/campaigns/:id` | PUT | Update campaign |
| `/sms-app/campaigns/:id` | DELETE | Delete campaign |
| `/sms-app/campaigns/:id/progress` | PUT | Update sending progress |
| `/sms-app/sms-sent/:chatId` | POST | Report SMS sent |
| `/sms-app/sync/:chatId` | GET | Full sync (campaigns, plan, settings) |
| `/sms-app/report-errors/:chatId` | POST | Report sending errors |
| `/sms-app/diagnostics/:chatId` | GET | Full diagnostics |
| `/sms-app/download` | GET | Download APK |
| `/sms-app/download/info` | GET | APK version info |

### 2.3 Key Files

| File | Purpose |
|---|---|
| `js/sms-app-service.js` | Server-side SMS app endpoints |
| `js/_index.js` | Main bot logic + Express routes |
| `sms-app/www/js/app.js` | Android app main logic |
| `sms-app/www/js/api.js` | Android app API client |
| `sms-app/android/app/src/main/java/.../DirectSmsPlugin.java` | Native foreground SMS |
| `sms-app/android/app/src/main/java/.../SmsBackgroundService.java` | Native background SMS |

---

## 3. Competitive Analysis — SemySMS.net

### 3.1 SemySMS Complete Feature Set

**Core Platform:**
- Web-based SMS gateway using Android phones as SMS modems
- 334,858 devices connected, 1.96 billion messages sent
- Free tier (1 msg/min) + Premium ($6.99/mo or $6.99/5K messages)

**Feature Categories:**

#### A. Device Management
- Link Android phones via 6-digit code
- Multiple devices per account (distributed network)
- Device monitoring: battery %, Android version, last active, manufacturer
- Per-device speed configuration
- Per-device SMS limits (min/hour/day/week/month)
- Archive/unarchive devices
- Separate device types: SMS, WhatsApp, WhatsApp Business

#### B. SMS Operations
- Send single SMS (API + web)
- Send bulk SMS (API + web)
- Receive incoming SMS
- Track delivery status: queued → sent to phone → sent → delivered
- Cancel pending (unsent) SMS
- Delete outgoing/incoming SMS history
- Message priority system (0 to 1,000,000)

#### C. Campaign/Mailing System
- Bulk SMS campaigns with contact groups
- Message scheduling: specific day/time, frequency, repetitions
- Rate limiting: per min/hour/day/week/month
- Template tags: `[name]`, `[surname]`, custom fields auto-replaced
- Variative template engine: different message variants in same campaign
- Real-time campaign status tracking

#### D. Contact Management
- Import contacts from Excel/XLS files
- Contact groups/lists
- Export contacts from app
- Contact fields: name, surname, phone, custom fields
- Auto-create contacts on send

#### E. Webhook System
- **Incoming SMS webhook:** POST to URL with id, date, phone, msg, type, id_device
- **Incoming SMS → Phone:** Forward to another phone number with keyword filtering
- **Incoming SMS → Telegram:** Forward to Telegram chat/bot with keyword filtering
- **Delivery Status webhook:** POST with id, phone, msg, is_send, send_date, is_delivered, delivered_date

#### F. Analytics & Reporting
- Real-time message statistics
- Campaign delivery reports
- Device activity monitoring
- Message count tracking (sent/received/failed)

#### G. Advanced Features
- **Ping SMS / Silent SMS:** Binary SMS invisible to recipient — checks if phone is active
- **USSD Requests:** Send USSD commands (e.g., check balance) via `[ussd]` tag
- **WhatsApp Integration:** Send/receive WhatsApp + WhatsApp Business messages (no root)
- **WhatsApp Images:** Send images via `<img>URL</img>` tags
- **Multi-device load balancing:** Round-robin distribution across devices

### 3.2 SemySMS API Reference

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/3/user.php` | GET | token | Account info (plan, premium status, message count) |
| `/api/3/sms.php` | GET/POST | token | Send single SMS (device, phone, msg, priority) |
| `/api/3/sms_more.php` | POST | token | Send batch SMS (JSON array) |
| `/api/3/outbox_sms.php` | GET | token | List outgoing SMS (filter by device/date/phone/id) |
| `/api/3/inbox_sms.php` | GET | token | List incoming SMS (filter by device/date/phone/id) |
| `/api/3/devices.php` | GET | token | List devices (filter by archive/id) |
| `/api/3/cancel_sms.php` | GET | token | Cancel unsent SMS |
| `/api/3/del_outbox_sms.php` | GET | token | Delete outgoing SMS records |
| `/api/3/del_inbox_sms.php` | GET | token | Delete incoming SMS records |

**Authentication:** All endpoints use `token` parameter (private API key per account).

**Key API Parameters:**
- `device` — device ID or `active` (use all active devices with round-robin)
- `phone` — international format with country code
- `msg` — up to 1000 characters
- `priority` — integer 0-1,000,000 (higher = sent first)
- `start_id` / `end_id` — ID range filter
- `date_start` / `date_end` — date range filter
- `my_id` — external system reference ID

### 3.3 SemySMS Pricing Model

| Plan | Price | Devices | Features |
|---|---|---|---|
| Free | $0 | Unlimited | 1 msg/min speed limit, no API |
| Monthly | $6.99 | 2 (pro-rated) | Full speed, API, premium features |
| Yearly | $69.99 | 2 (pro-rated) | Full speed, API, premium features |
| 5,000 messages | $6.99 | Unlimited | Full speed, API, premium features |
| 50,000 messages | $69.99 | Unlimited | Full speed, API, premium features |

---

## 4. Gap Analysis — What Nomadly Needs

### 4.1 Feature Comparison Matrix

| Feature | SemySMS | Nomadly | Gap |
|---|---|---|---|
| Web Dashboard | ✅ Full | ❌ None | **BUILD** |
| Public REST API | ✅ 9 endpoints | ❌ Internal only | **BUILD** |
| API Documentation | ✅ Interactive docs | ❌ None | **BUILD** |
| Token-based Auth | ✅ API token | ❌ chatId only | **BUILD** |
| Multi-device Support | ✅ Unlimited | ⚠️ 1 per user | **UPGRADE** |
| Device Monitoring | ✅ Battery/status/version | ⚠️ Basic version only | **UPGRADE** |
| Device Link Code | ✅ 6-digit code | ✅ chatId-based | **ADAPT** |
| Contact Management | ✅ Excel import, groups | ❌ In-campaign only | **BUILD** |
| Campaign CRUD | ✅ Web + API | ✅ Bot + App | **ADD WEB** |
| Message Rotation | ✅ Variative engine | ✅ `---` delimiter | ✅ Done |
| Template Tags | ✅ [name], [surname], custom | ⚠️ [name] only | **UPGRADE** |
| Scheduling | ✅ Recurrence + time windows | ⚠️ Single schedule | **UPGRADE** |
| Rate Limiting | ✅ min/hour/day/week/month | ⚠️ Gap time only | **BUILD** |
| Incoming SMS | ✅ Capture + view | ❌ None | **BUILD** |
| Webhook: Incoming SMS | ✅ URL/Phone/Telegram | ❌ None | **BUILD** |
| Webhook: Delivery Status | ✅ Sent/Delivered | ❌ None | **BUILD** |
| Delivery Tracking | ✅ Per-message status | ⚠️ Counts only | **UPGRADE** |
| Analytics Dashboard | ✅ Real-time stats | ❌ None | **BUILD** |
| Campaign Reports | ✅ Detailed reports | ❌ None | **BUILD** |
| Priority Queue | ✅ 0-1M priority | ❌ None | **BUILD** |
| Cancel Pending SMS | ✅ Cancel unsent | ❌ None | **BUILD** |
| Delete SMS History | ✅ Delete records | ❌ None | **BUILD** |
| Ping SMS / Silent SMS | ✅ Binary SMS | ❌ None | **BUILD** |
| USSD Requests | ✅ Via [ussd] tag | ❌ None | **BUILD** |
| WhatsApp Integration | ✅ Send/receive | ❌ None | **BUILD** |
| WhatsApp Images | ✅ `<img>` tags | ❌ None | **BUILD** |
| Multi-device Load Balancing | ✅ Round-robin | ❌ None | **BUILD** |
| Subscription System | ✅ By time or count | ✅ Via Telegram bot | ✅ Done |
| APK Distribution | ❌ Side-load only | ✅ Auto-update system | ✅ Done |

---

## 5. Implementation Plan — 5 Phases

### Phase 1: Web Dashboard + Public API (Foundation) 🏗️
**Priority:** CRITICAL — Everything else depends on this
**Estimated Effort:** Large

#### 1.1 API Token System
- Generate unique API tokens per user (stored in MongoDB `apiTokens` collection)
- Token management: create, revoke, regenerate
- Rate limiting per token
- Token displayed in Telegram bot settings + web dashboard

#### 1.2 Public REST API (9 Endpoints)
Map to existing data while adding new capabilities:

| New Endpoint | Method | Maps To |
|---|---|---|
| `POST /api/sms-gateway/v1/user` | GET | Account info, plan, message count |
| `POST /api/sms-gateway/v1/sms` | POST | Send single SMS → queue to device |
| `POST /api/sms-gateway/v1/sms/batch` | POST | Send multiple SMS |
| `GET /api/sms-gateway/v1/outbox` | GET | List outgoing SMS with filters |
| `GET /api/sms-gateway/v1/inbox` | GET | List incoming SMS with filters |
| `GET /api/sms-gateway/v1/devices` | GET | List linked devices |
| `POST /api/sms-gateway/v1/sms/cancel` | POST | Cancel pending SMS |
| `DELETE /api/sms-gateway/v1/outbox` | DELETE | Delete outgoing records |
| `DELETE /api/sms-gateway/v1/inbox` | DELETE | Delete incoming records |

#### 1.3 Web Dashboard (React)
New route: `/sms-dashboard` or `/sms`

**Pages:**
- **Dashboard** — Overview: messages sent/received today, device status, recent activity
- **Devices** — List devices, link new device, monitor status/battery
- **Send SMS** — Single SMS form (device, phone, message, priority)
- **Campaigns** — Create/manage bulk campaigns
- **Outbox** — Sent message history with status (queued/sent/delivered/failed)
- **Inbox** — Received messages (future: Phase 3)
- **Contacts** — Contact management (future: Phase 2)
- **Settings** — API token, webhook URLs, preferences
- **API Docs** — Interactive documentation

#### 1.4 Device Management Upgrade
- Multi-device support (link multiple phones per account)
- Device link code system (generate code in web → enter in app)
- Device status monitoring (battery, last active, Android version, SMS speed)
- Device enable/disable/archive
- Per-device SMS speed configuration

#### 1.5 API Documentation Page
- Static page at `/sms/docs` or `/api-docs`
- All endpoints with parameters, examples, response formats
- Code snippets (cURL, Python, PHP, Node.js)
- Authentication guide
- Webhook setup instructions

#### 1.6 New MongoDB Collections

```
apiTokens: { _id, chatId, token, createdAt, lastUsed, isActive }
smsOutbox: { _id, chatId, deviceId, phone, msg, status, priority, createdAt, sentAt, deliveredAt, errorMsg, campaignId, externalId }
smsInbox: { _id, chatId, deviceId, phone, msg, receivedAt, type, isRead, webhookSent }
smsDevices: { _id, chatId, deviceName, linkCode, isActive, isArchived, lastActive, battery, androidVersion, manufacturer, smsSpeed, limitConfig, type }
smsContacts: { _id, chatId, groupId, name, surname, phone, customFields, createdAt }
smsContactGroups: { _id, chatId, name, contactCount, createdAt }
smsWebhooks: { _id, chatId, deviceId, type, url, telegramChatId, phoneForward, keywords, isActive }
```

---

### Phase 2: Contact Management + Enhanced Campaigns 📋
**Priority:** HIGH
**Depends on:** Phase 1

#### 2.1 Contact Database
- MongoDB-backed contact storage per user
- Fields: name, surname, phone, email, custom fields (key-value)
- Bulk import from CSV/Excel (XLSX) files
- Export contacts to CSV
- Deduplication by phone number

#### 2.2 Contact Groups
- Create/rename/delete groups
- Add/remove contacts from groups
- Group-based campaign targeting
- Smart groups (auto-filter by criteria)

#### 2.3 Enhanced Template Tags
- `[name]` — first name
- `[surname]` — last name  
- `[phone]` — recipient phone
- `[custom:fieldname]` — custom contact fields
- Preview with sample data before sending

#### 2.4 Advanced Scheduling
- One-time schedule (specific date/time)
- Recurring: daily, weekly, monthly
- Time windows (only send between 9am-6pm)
- Timezone support per campaign
- Auto-retry failed messages

#### 2.5 Rate Limiting Configuration
- Per-device limits: messages per minute/hour/day/week/month
- Per-campaign limits
- Global account limits
- Automatic throttling when limits approached
- Limit usage tracking in dashboard

---

### Phase 3: Incoming SMS + Webhooks 📨
**Priority:** HIGH
**Depends on:** Phase 1

#### 3.1 Incoming SMS Capture
- Android app captures incoming SMS and syncs to server
- New sync endpoint for incoming messages
- Inbox view in web dashboard
- Mark as read/unread
- Search and filter

#### 3.2 Webhook: Incoming SMS → URL
- Configure URL per device in settings
- POST request with: id, date, phone, msg, type, id_device
- Retry logic (3 attempts with exponential backoff)
- Webhook delivery logs

#### 3.3 Webhook: Incoming SMS → Phone
- Forward incoming SMS to another phone number
- Keyword filtering (only forward if message contains specific words)
- JSON config: `{"phone": "+1234567890", "words": ["keyword1", "keyword2"]}`

#### 3.4 Webhook: Incoming SMS → Telegram
- Forward to Telegram chat via Nomadly bot or custom bot
- Keyword filtering
- JSON config: `{"telegram": "chatId", "bot_token": "optional", "words": [...]}`

#### 3.5 Delivery Status Webhooks
- Configure status webhook URL per device
- POST on "sent" status
- POST on "delivered" status
- Combined notification if both arrive simultaneously
- Parameters: id, id_device, phone, msg, is_send, send_date, is_delivered, delivered_date

#### 3.6 Android App Updates
- New plugin: `IncomingSmsPlugin` — captures received SMS
- Background service for incoming SMS monitoring
- Sync incoming messages to server
- Delivery report capture (sent confirmation from Android)

---

### Phase 4: Analytics + Advanced Features 📊
**Priority:** MEDIUM
**Depends on:** Phases 1-3

#### 4.1 Analytics Dashboard
- Messages sent/received per day/week/month (chart)
- Delivery rate (sent vs delivered vs failed)
- Campaign performance comparison
- Device utilization stats
- Peak sending hours heatmap

#### 4.2 Campaign Reports
- Per-campaign delivery breakdown
- Per-recipient status tracking
- Export reports to CSV/PDF
- Scheduled email reports

#### 4.3 Priority Queue System
- Priority field (0-1,000,000) on each message
- Higher priority = sent first
- Campaign-level priority
- API priority parameter
- Dashboard priority override

#### 4.4 Multi-Device Load Balancing
- `device=active` parameter → use all active devices
- Round-robin distribution across devices
- Weighted distribution (based on device speed/battery)
- Automatic failover (skip offline devices)
- Per-device queue management

#### 4.5 Message Operations
- Cancel pending (queued but not sent) messages
- Bulk cancel by campaign/device/date range
- Delete outgoing/incoming SMS records
- Bulk delete with filters

---

### Phase 5: Premium Features ⭐
**Priority:** LOW (nice-to-have)
**Depends on:** Phases 1-4

#### 5.1 Ping SMS / Silent SMS
- Binary SMS that doesn't display on recipient phone
- Check if phone number is active/reachable
- Delivery report = phone is on, No delivery = phone off
- Premium feature (costs extra credits)
- API endpoint: `POST /api/sms-gateway/v1/ping`

#### 5.2 USSD Requests
- Send USSD commands (e.g., `*100#` to check balance)
- Prefix message with `[ussd]` tag
- Capture USSD response and return to user
- Requires Android 8.0+
- Use case: check prepaid balance, activate plans

#### 5.3 WhatsApp Integration
- Send WhatsApp messages (no root, accessibility service)
- Send WhatsApp Business messages
- Separate device type for WhatsApp
- Image support via `<img>URL</img>` tags
- Receive WhatsApp messages
- WhatsApp-specific webhook forwarding
- Pause configuration between WhatsApp messages (min 5s)

---

## 6. Architecture Overview

### 6.1 Updated Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      Kubernetes Ingress                          │
│  /api/sms-gateway/*  →  FastAPI (8001) → Node.js (5000)         │
│  /sms/*              →  React Frontend (3000) — SMS Dashboard    │
│  /api/*              →  FastAPI (8001) → Node.js (5000) (existing│)
│  /*                  →  React Frontend (3000) (existing)         │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Android App │────▶│  Node.js API │────▶│   MongoDB    │
│  (Capacitor) │◀────│  (Port 5000) │◀────│  (Port 27017)│
│              │     │              │     │              │
│ • Send SMS   │     │ • REST API   │     │ • smsOutbox  │
│ • Recv SMS   │     │ • Webhooks   │     │ • smsInbox   │
│ • Sync       │     │ • Campaigns  │     │ • smsDevices │
│ • Background │     │ • Queue      │     │ • apiTokens  │
└──────────────┘     │ • Analytics  │     │ • smsContacts│
                     └──────────────┘     └──────────────┘
                           │
                     ┌─────┴─────┐
                     │  Webhooks  │
                     │ • URL POST │
                     │ • Telegram │
                     │ • Phone FWD│
                     └───────────┘
```

### 6.2 New File Structure

```
/app/
├── js/
│   ├── sms-gateway/                    ← NEW: SMS Gateway module
│   │   ├── sms-gateway-routes.js       ← Public API routes
│   │   ├── sms-gateway-service.js      ← Business logic
│   │   ├── sms-gateway-auth.js         ← Token auth middleware
│   │   ├── sms-gateway-webhooks.js     ← Webhook delivery engine
│   │   ├── sms-gateway-queue.js        ← Priority queue & load balancer
│   │   ├── sms-gateway-contacts.js     ← Contact management
│   │   ├── sms-gateway-analytics.js    ← Analytics & reporting
│   │   └── sms-gateway-docs.js         ← API docs data
│   ├── sms-app-service.js              ← EXISTING: upgrade for multi-device
│   └── _index.js                       ← EXISTING: add gateway routes
├── frontend/src/
│   ├── pages/
│   │   ├── sms/                        ← NEW: SMS Dashboard pages
│   │   │   ├── SmsDashboard.js         ← Overview/home
│   │   │   ├── SmsDevices.js           ← Device management
│   │   │   ├── SmsSend.js              ← Send single SMS
│   │   │   ├── SmsCampaigns.js         ← Campaign management
│   │   │   ├── SmsOutbox.js            ← Sent messages
│   │   │   ├── SmsInbox.js             ← Received messages
│   │   │   ├── SmsContacts.js          ← Contact management
│   │   │   ├── SmsAnalytics.js         ← Analytics dashboard
│   │   │   ├── SmsSettings.js          ← Settings & API token
│   │   │   └── SmsApiDocs.js           ← API documentation
│   │   └── ...existing pages
│   └── components/
│       └── sms/                        ← NEW: SMS components
│           ├── SmsLayout.js            ← Dashboard layout/nav
│           ├── DeviceCard.js           ← Device status card
│           ├── MessageTable.js         ← Message list table
│           ├── CampaignWizard.js       ← Campaign creation wizard
│           ├── ContactImport.js        ← Excel/CSV import
│           └── AnalyticsChart.js       ← Chart components
└── sms-app/                            ← EXISTING: Android app updates
    └── android/app/src/main/java/
        └── com/nomadly/sms/
            ├── plugins/
            │   ├── DirectSmsPlugin.java       ← EXISTING
            │   └── IncomingSmsPlugin.java      ← NEW: capture incoming
            └── services/
                ├── SmsBackgroundService.java   ← EXISTING
                └── IncomingSmsReceiver.java    ← NEW: BroadcastReceiver
```

---

## 7. API Specification (Phase 1)

### 7.1 Authentication

All API requests require a valid API token in the header:
```
Authorization: Bearer <api_token>
```
Or as query parameter: `?token=<api_token>`

### 7.2 Endpoints

#### GET /api/sms-gateway/v1/user
**Response:**
```json
{
  "code": 0,
  "id_user": "7304424395",
  "username": "flmzv2",
  "is_premium": true,
  "plan": "monthly",
  "plan_expires": "2026-05-16T00:00:00Z",
  "messages_sent": 1250,
  "messages_remaining": null,
  "devices_count": 3,
  "devices_active": 2
}
```

#### POST /api/sms-gateway/v1/sms
**Request:**
```json
{
  "device": "dev_abc123",
  "phone": "+19105551234",
  "msg": "Hello [name], your order is ready!",
  "priority": 100,
  "name": "John",
  "surname": "Doe"
}
```
**Response:**
```json
{
  "code": 0,
  "id": "msg_uuid_here",
  "status": "queued"
}
```

#### POST /api/sms-gateway/v1/sms/batch
**Request:**
```json
{
  "data": [
    {"device": "dev_abc123", "phone": "+19105551234", "msg": "Hello John"},
    {"device": "dev_abc123", "phone": "+19105555678", "msg": "Hello Jane"}
  ]
}
```
**Response:**
```json
{
  "code": 0,
  "data": [
    {"id": "msg_uuid_1", "phone": "+19105551234", "status": "queued"},
    {"id": "msg_uuid_2", "phone": "+19105555678", "status": "queued"}
  ]
}
```

#### GET /api/sms-gateway/v1/outbox
**Parameters:** `device`, `start_id`, `end_id`, `date_start`, `date_end`, `phone`, `limit`, `offset`
**Response:**
```json
{
  "code": 0,
  "count": 1,
  "data": [
    {
      "id": "msg_uuid",
      "phone": "+19105551234",
      "msg": "Hello John",
      "device": "dev_abc123",
      "status": "delivered",
      "created_at": "2026-04-16T16:40:11Z",
      "sent_at": "2026-04-16T16:40:15Z",
      "delivered_at": "2026-04-16T16:40:18Z",
      "is_error": false,
      "error_msg": null,
      "campaign_id": null,
      "priority": 0
    }
  ]
}
```

#### GET /api/sms-gateway/v1/inbox
**Parameters:** `device`, `start_id`, `end_id`, `date_start`, `date_end`, `phone`, `limit`, `offset`
**Response:**
```json
{
  "code": 0,
  "count": 1,
  "data": [
    {
      "id": "msg_uuid",
      "phone": "+19105551234",
      "msg": "Yes, I confirm",
      "device": "dev_abc123",
      "received_at": "2026-04-16T16:45:00Z",
      "type": 0
    }
  ]
}
```

#### GET /api/sms-gateway/v1/devices
**Parameters:** `is_archived`, `list_id`
**Response:**
```json
{
  "code": 0,
  "count": 2,
  "data": [
    {
      "id": "dev_abc123",
      "name": "Samsung Galaxy S24",
      "is_active": true,
      "is_archived": false,
      "last_active": "2026-04-16T16:50:00Z",
      "battery": 85,
      "android_version": "14",
      "manufacturer": "Samsung",
      "sms_speed": 5,
      "limit_config": {"period": "hour", "limit": 100, "used": 45},
      "type": 0
    }
  ]
}
```

#### POST /api/sms-gateway/v1/sms/cancel
**Parameters:** `device`, `id_sms` (or `campaign_id` to cancel all in campaign)
**Response:**
```json
{"code": 0, "cancelled": 15}
```

#### DELETE /api/sms-gateway/v1/outbox
**Parameters:** Same filters as GET outbox
**Response:**
```json
{"code": 0, "deleted": 50}
```

#### DELETE /api/sms-gateway/v1/inbox
**Parameters:** Same filters as GET inbox
**Response:**
```json
{"code": 0, "deleted": 10}
```

### 7.3 Error Codes

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | Invalid token |
| 2 | Missing required parameter |
| 3 | Device not found |
| 4 | Phone number invalid |
| 5 | Message too long (>1000 chars) |
| 6 | Rate limit exceeded |
| 7 | Subscription required |
| 8 | Insufficient credits |
| 9 | Device offline |
| 10 | Internal error |

### 7.4 Webhook Payloads

**Incoming SMS Webhook (POST to configured URL):**
```json
{
  "id": "msg_uuid",
  "date": "2026-04-16T16:45:00Z",
  "phone": "+19105551234",
  "msg": "Reply text here",
  "type": 0,
  "id_device": "dev_abc123"
}
```

**Delivery Status Webhook (POST to configured URL):**
```json
{
  "id": "msg_uuid",
  "id_device": "dev_abc123",
  "phone": "+19105551234",
  "msg": "Original message text",
  "is_send": 1,
  "send_date": "2026-04-16T16:40:15Z",
  "is_delivered": 1,
  "delivered_date": "2026-04-16T16:40:18Z"
}
```

---

## 8. Nomadly Competitive Advantages Over SemySMS

Features Nomadly already has that SemySMS doesn't:

| Feature | Details |
|---|---|
| **Telegram Bot Integration** | Full campaign management via Telegram — no web needed |
| **Wallet Payment System** | Crypto + fiat wallet for seamless payments |
| **Background SMS Service** | Native Java background service — sends even with screen off |
| **APK Auto-Update** | Built-in version checking and update notifications |
| **URL Shortener Integration** | Built-in link shortening for SMS campaigns |
| **Subscription via Telegram** | Users subscribe directly in chat — zero friction |
| **i18n Support** | English, French, Chinese, Hindi |
| **Campaign Diagnostics** | Deep error reporting and diagnostics per user |

---

## 9. Pricing Strategy (Recommendation)

| Plan | Price | Devices | Messages | API | Features |
|---|---|---|---|---|---|
| **Free** | $0 | 1 | 100 trial SMS | ❌ | Basic send only |
| **Starter** | $9.99/mo | 2 | 5,000/mo | ✅ | Full API, web dashboard |
| **Pro** | $29.99/mo | 5 | 25,000/mo | ✅ | + Webhooks, contacts, analytics |
| **Business** | $79.99/mo | Unlimited | 100,000/mo | ✅ | + Priority support, WhatsApp |
| **Pay-per-use** | $0.002/msg | Unlimited | Pay as you go | ✅ | All features |

---

## 10. Implementation Timeline (Estimated)

| Phase | Scope | Estimated Sessions |
|---|---|---|
| **Phase 1** | Web Dashboard + API + Docs + Device Management | 3-4 sessions |
| **Phase 2** | Contacts + Enhanced Campaigns + Rate Limiting | 2-3 sessions |
| **Phase 3** | Incoming SMS + Webhooks + App Updates | 2-3 sessions |
| **Phase 4** | Analytics + Priority Queue + Load Balancing | 2 sessions |
| **Phase 5** | Ping SMS + USSD + WhatsApp | 2-3 sessions |

**Total estimated: 11-15 development sessions**

---

## 11. Open Questions

1. Should the web dashboard require separate login or use Telegram-based auth (login via bot)?
2. Should API tokens be tied to chatId or allow separate API-only accounts?
3. Should we support both SemySMS-compatible API format AND modern REST format?
4. Priority for WhatsApp integration vs other features?
5. Should incoming SMS require a new Android app permission flow?
6. Pricing model: follow SemySMS (cheap) or position premium (higher price, more features)?

---

## 12. References

- **SemySMS Website:** https://semysms.net
- **SemySMS API Docs:** https://semysms.net/api.php
- **SemySMS Pricing:** https://semysms.net/price.php
- **SemySMS Blog/Guides:** https://semysms.net/blog.php
- **Nomadly SMS App Code:** `/app/sms-app/`, `/app/js/sms-app-service.js`
- **Nomadly Bot Code:** `/app/js/_index.js`
