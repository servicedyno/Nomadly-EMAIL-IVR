# 🏪 Nomadly Marketplace — Feature Plan & UX Design
**Version:** 2.0
**Date:** March 2026
**Status:** Planning → Ready for Implementation

---

## 1. Overview

Add a **peer-to-peer marketplace** to the Nomadly Telegram bot where sellers can list goods with images and prices, buyers can browse, chat with sellers through the bot (anonymized relay), and complete purchases via **escrow protection** through @Lockbaybot.

### Core Principle
> "It must be clear to the buyer that it is safe to buy because it's escrow-protected."

Every product listing, conversation, and purchase prompt will prominently display the 🔒 escrow badge.

---

## 2. Categories

```
💻 Digital Goods
🏦 Bnk Logs
🏧 Bnk Opening
🔧 Tools
```

**Pricing:** USD only — Min $20, Max $5,000
**Listings:** Max 10 active per seller

---

## 3. User Flows

### 3.1 Seller Flow

```
Main Menu → 🏪 Marketplace
  → 📦 My Listings
      → View all own listings (active/sold)
      → Tap listing →
          ✏️ Edit (title, desc, price, images)
          ❌ Remove Listing
          ✅ Mark as Sold
  → ➕ List New Product
      → 📸 Upload Product Image(s) (1-5 photos)
      → 📝 Enter Product Title (max 100 chars)
      → 📄 Enter Description (max 500 chars)
      → 💰 Set Price ($20 - $5,000 USD)
      → 🏷️ Select Category (Digital Goods / Bnk Logs / Bnk Opening / Tools)
      → ✅ Preview & Publish
  → 💬 My Conversations (view active buyer chats)
```

### 3.2 Buyer Flow

```
Main Menu → 🏪 Marketplace
  → 🔍 Browse Marketplace
      → Select Category or "All"
      → Paginated product cards (5 per page)
      → Tap product → Full detail view
          → 💬 Chat with Seller
          → 🔒 Start Escrow (→ @Lockbaybot)
  → 💬 My Conversations (view active chats)
```

### 3.3 Chat Relay Flow (Anonymized)

```
Buyer taps "💬 Chat with Seller" on a product
  → Bot checks: not own product, no existing conversation for same product+buyer
  → Bot creates conversation thread
  → Bot to Buyer: "💬 You're now chatting about [Product Title] ($XX)
                    🔒 Escrow-protected via @Lockbaybot
                    Type your message below. Send /done to end chat."
  → Bot to Seller: "💬 New inquiry about [Product Title] from a buyer.
                     🔒 Escrow-protected via @Lockbaybot
                     Reply below. Send /done to end chat."

Buyer types → Bot relays to Seller: "💬 Buyer says: [message]"
Seller types → Bot relays to Buyer: "💬 Seller says: [reply]"

Special commands in chat:
  /done        — End conversation (both parties notified)
  /escrow      — Start escrow (same as button)
  /price XX    — Suggest new price (shown to both parties)
  ↩️ Back      — Exit chat mode (conversation stays open)
```

### 3.4 Escrow Flow

```
Either party clicks "🔒 Start Escrow" or sends /escrow
  → Bot sends BOTH parties:

    🔒 ESCROW — START YOUR PROTECTED PURCHASE

    📦 Product: [Title]
    💰 Agreed Price: $XX.XX
    👤 Seller: [anonymous ref]

    To complete this purchase safely:
    1. Tap the button below to open @Lockbaybot
    2. Create a new escrow with the product details
    3. Both parties confirm in @Lockbaybot

    ⚠️ NEVER send payment outside of escrow

    [🔒 Open @Lockbaybot]  (inline button → https://t.me/Lockbaybot)

  → Conversation marked as "escrow_started"
  → Seller prompted to mark listing as sold once escrow completes
```

---

## 4. UI/UX Design (Telegram Bot)

### 4.1 Main Menu Addition

Add new row after Digital Products:
```
📞 Cloud IVR + SIP    | 📱 Test SIP
🛒 Digital Products   | 💳 Virtual Card
🏪 Marketplace                          ← NEW
🌐 Domain Names
...
```

### 4.2 Marketplace Home Screen

```
🏪 MARKETPLACE

🔒 All transactions are escrow-protected via @Lockbaybot
Your money is held safely until you confirm delivery.

⚠️ Never send payment outside of escrow.

[🔍 Browse Products]
[➕ List a Product]
[💬 My Conversations]
[📦 My Listings]
[↩️ Back]
```

### 4.3 Product Card (Browse)

Each product sent as a **photo message** with inline buttons:

```
📸 [Product Image]

🏷️ Premium CC Checker Tool
💰 $120.00
📂 Tools
⭐ Seller: 3 sales | Joined Feb 2026
🔒 Escrow Protected via @Lockbaybot

[💬 Chat with Seller]  [🔒 Start Escrow]
[⬅️ Prev] [1/12] [Next ➡️]
[↩️ Back to Categories]
```

### 4.4 Full Product Detail View

```
📸 [Product Image 1]

📦 Premium CC Checker Tool

📄 High quality tool, freshly updated daily.
Works with all major banks. Lifetime updates included.

💰 Price: $120.00
📂 Category: Tools
⭐ Seller: 3 completed sales | Member since Feb 2026
📅 Listed: 2 hours ago
🔒 ESCROW PROTECTED — Pay safely via @Lockbaybot

[💬 Chat with Seller]
[🔒 Start Escrow]
[📸 More Photos (3)]
[↩️ Back]
```

### 4.5 Chat Interface

**Buyer sees:**
```
💬 Chat: Premium CC Checker Tool ($120.00)
🔒 Protected by @Lockbaybot escrow

💬 Seller: Hey! This is the latest version, updated today.
💬 You: Does it support Chase?
💬 Seller: Yes, all US banks. I can do $100 if you buy now.
💬 You: Deal.

[🔒 Start Escrow — $100]  [/done]
```

**Seller sees:**
```
💬 Inquiry: Premium CC Checker Tool ($120.00)
🔒 Protected by @Lockbaybot escrow

💬 Buyer: Does it support Chase?
💬 You: Yes, all US banks. I can do $100 if you buy now.
💬 Buyer: Deal.

[🔒 Start Escrow — $100]  [/done]
```

### 4.6 My Listings View

```
📦 MY LISTINGS (3/10)

1. ✅ Premium CC Checker Tool — $120 (2 inquiries)
2. ✅ Fresh Bank Logs Pack — $250 (0 inquiries)
3. 🟡 SOLD: Office365 Accounts — $45

[➕ List New Product]
[↩️ Back]
```

Tap on listing → Edit/Remove/Mark Sold menu.

---

## 5. Database Schema

### 5.1 Collection: `marketplaceProducts`

```json
{
  "_id": "uuid-v4",
  "sellerId": 1005284399,
  "sellerUsername": "pirate_script",
  "title": "Premium CC Checker Tool",
  "description": "High quality, freshly updated daily...",
  "price": 120.00,
  "currency": "USD",
  "category": "Tools",
  "images": [
    { "fileId": "AgACAgIAAxk...", "uniqueId": "AQADAgAT..." }
  ],
  "status": "active",
  "views": 12,
  "inquiries": 2,
  "escrowsStarted": 1,
  "createdAt": "2026-03-01T...",
  "updatedAt": "2026-03-01T..."
}
```

### 5.2 Collection: `marketplaceConversations`

```json
{
  "_id": "uuid-v4",
  "productId": "uuid-v4",
  "productTitle": "Premium CC Checker Tool",
  "originalPrice": 120.00,
  "agreedPrice": 100.00,
  "buyerId": 8490263518,
  "sellerId": 1005284399,
  "status": "active",
  "lastMessageAt": "2026-03-01T...",
  "createdAt": "2026-03-01T...",
  "messageCount": 6,
  "escrowStartedAt": null
}
```

### 5.3 Collection: `marketplaceMessages`

```json
{
  "_id": "uuid-v4",
  "conversationId": "uuid-v4",
  "senderId": 8490263518,
  "senderRole": "buyer",
  "type": "text",
  "text": "Does it support Chase?",
  "timestamp": "2026-03-01T..."
}
```

---

## 6. Edge Cases & Handling

### 6.1 Conversation State Management

| Edge Case | Handling |
|-----------|----------|
| **User in chat but uses other bot features** | When user is in `mpChat` action, ALL text messages are relayed. User must send `/done` or tap `↩️ Back` to exit chat mode first. Other bot buttons (like 💰 Wallet) will show "⚠️ You're in a marketplace chat. Send /done to exit first." |
| **Multiple conversations for same product** | Allowed — seller can chat with multiple buyers about the same product. Each is a separate conversation thread. |
| **Buyer chats about own product** | Blocked — "❌ You cannot inquire about your own listing." |
| **Product removed during active conversation** | Conversation stays open but product link shows "[Listing Removed]". Escrow can still be started since Lockbay handles details independently. |
| **Seller edits price during conversation** | Buyer is notified: "ℹ️ Seller updated the listing price to $XX. Your conversation continues." Agreed price in conversation is separate from listing price. |

### 6.2 Listing Edge Cases

| Edge Case | Handling |
|-----------|----------|
| **10 listing limit reached** | "❌ You've reached the max of 10 active listings. Remove or mark some as sold to list more." |
| **Price outside $20-$5,000** | "❌ Price must be between $20 and $5,000 USD." with retry prompt. |
| **No image uploaded** | Required — at least 1 image. "📸 Please upload at least one product image." |
| **Very long title/description** | Title truncated at 100 chars, description at 500 chars with warning. |
| **Duplicate title by same seller** | Allowed — seller might have variants. Not blocked. |
| **Image is a document not photo** | "📸 Please send the image as a photo, not a file." |

### 6.3 Chat Relay Edge Cases

| Edge Case | Handling |
|-----------|----------|
| **Seller offline > 24 hours** | After 24h of no seller reply, buyer gets: "⏳ Seller hasn't responded in 24 hours. You may browse other listings." |
| **Buyer spam (excessive messages)** | Rate limit: max 30 messages per conversation per hour. After limit: "⚠️ Message limit reached. Please wait before sending more." |
| **Empty message** | Ignored — not relayed. |
| **Photos/media in chat** | Supported — images are relayed. Documents and other media are blocked: "⚠️ Only text and photos can be sent in marketplace chat." |
| **Both parties in chat simultaneously** | Works fine — bot relays in real-time to both. |
| **Conversation auto-close** | After 72 hours of inactivity (no messages from either party), conversation auto-closes. Both notified: "💬 Conversation about [Product] has been closed due to inactivity." |

### 6.4 Escrow Edge Cases

| Edge Case | Handling |
|-----------|----------|
| **No agreed price** | If /price was never used, escrow button shows listing price. Either party can still negotiate on Lockbay. |
| **Escrow started but buyer doesn't complete on Lockbay** | We can't track Lockbay status. After escrow link sent, conversation stays in "escrow_started" state. Seller must manually mark as sold. |
| **Multiple escrow starts** | Allowed — button can be tapped multiple times to re-open Lockbay link. |
| **Seller marks as sold but escrow not started** | Allowed — seller might have sold outside the platform. Listing moves to "sold" status. |

### 6.5 Security Edge Cases

| Edge Case | Handling |
|-----------|----------|
| **Seller asks buyer to pay outside escrow** | Every chat session has a pinned reminder: "⚠️ NEVER send payment outside of @Lockbaybot escrow." If bot detects payment-related patterns (PayPal, CashApp, BTC address, "send to"), auto-warn: "🚨 Warning: Always use @Lockbaybot escrow for safe transactions." |
| **Report abuse** | Users can send /report in a conversation to flag it. Admin (TELEGRAM_ADMIN_CHAT_ID) gets notification with conversation details. |
| **Banned seller** | If seller is banned, all listings are deactivated and conversations closed. |

### 6.6 /price Command Edge Cases

| Edge Case | Handling |
|-----------|----------|
| **`/price` without amount** | "Usage: `/price 50` to suggest $50" |
| **`/price` with invalid amount** | "❌ Invalid amount. Must be $20 - $5,000." |
| **`/price` from buyer** | Bot shows both: "💰 Buyer suggests: $XX" + inline button `[🔒 Start Escrow — $XX]` |
| **`/price` from seller** | Bot shows both: "💰 Seller offers: $XX" + inline button `[🔒 Start Escrow — $XX]` |
| **Agreed price tracking** | Last `/price` accepted by either party (or original listing price) is stored as `agreedPrice` on conversation. |

---

## 7. Anti-Scam Messaging

These messages appear in key locations:

**On every product card:**
> 🔒 Escrow Protected via @Lockbaybot

**On marketplace home:**
> 🔒 All transactions are escrow-protected via @Lockbaybot
> Your money is held safely until you confirm delivery.
> ⚠️ Never send payment outside of escrow.

**On every chat session start:**
> 🔒 This conversation is escrow-protected.
> ⚠️ NEVER send payment directly. Always use @Lockbaybot.

**On escrow initiation:**
> Your money is held safely by @Lockbaybot until:
> ✅ Buyer confirms product received
> ✅ Or dispute is resolved by Lockbay team

**Auto-warning when payment patterns detected:**
> 🚨 Warning: It looks like someone is asking for direct payment.
> Always use @Lockbaybot escrow to protect your money.

---

## 8. File Changes Summary

| File | Changes |
|------|---------|
| `js/marketplace-service.js` | **NEW** — All marketplace DB operations + chat relay logic |
| `js/_index.js` | Add ~25 marketplace action handlers, chat relay, escrow flow |
| `js/lang/en.js` | Add marketplace translations + menu button + user keyboard |
| `js/lang/fr.js` | Add marketplace translations (French) |
| `js/lang/zh.js` | Add marketplace translations (Chinese) |
| `js/lang/hi.js` | Add marketplace translations (Hindi) |

---

## 9. Implementation Order

```
Phase 1 — Core Service + Database
  ├── Create marketplace-service.js (CRUD + conversation + message ops)
  ├── Add translations to all 4 language files
  └── Add 🏪 Marketplace button to main menu keyboard

Phase 2 — Seller Listing Flow
  ├── ➕ List New Product (images → title → desc → price → category → publish)
  ├── 📦 My Listings (view own listings)
  └── Edit / Remove / Mark Sold operations

Phase 3 — Buyer Browse Flow
  ├── 🔍 Browse by category + "All" option
  ├── Paginated product cards with photos
  └── Full product detail view

Phase 4 — Chat Relay System
  ├── 💬 Start conversation (buyer → seller)
  ├── Message relay (bot as intermediary)
  ├── /done, /price, /report commands
  ├── Auto-warning for direct payment patterns
  └── 💬 My Conversations (list + resume)

Phase 5 — Escrow Integration
  ├── 🔒 Start Escrow button + link to @Lockbaybot
  ├── Escrow initiation message to both parties
  └── Mark listing as sold flow
```

---

## 10. Payment Pattern Detection (Anti-Scam)

Regex patterns to detect direct payment requests in chat:

```
/paypal|cashapp|cash\s*app|venmo|zelle|western\s*union|moneygram/i
/\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b/          — Bitcoin address
/\b0x[a-fA-F0-9]{40}\b/                          — Ethereum address
/\bT[A-Za-z1-9]{33}\b/                           — USDT/TRC20 address
/send\s*(to|me|payment|money|funds)/i
/pay\s*(me|directly|outside|first)/i
/no\s*escrow/i
/wire\s*transfer/i
```

When detected → auto-warning message + flag conversation for admin review.
