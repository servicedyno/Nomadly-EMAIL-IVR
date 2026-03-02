# 🏪 Nomadly Marketplace — Feature Plan & UX Design
**Version:** 1.0
**Date:** March 2026
**Status:** Planning

---

## 1. Overview

Add a **peer-to-peer marketplace** to the Nomadly Telegram bot where sellers can list goods with images and prices, buyers can browse, chat with sellers through the bot (anonymized relay), and complete purchases via **escrow protection** through @Lockbaybot.

### Core Principle
> "It must be clear to the buyer that it is safe to buy because it's escrow-protected."

Every product listing, conversation, and purchase prompt will prominently display the 🔒 escrow badge.

---

## 2. User Flows

### 2.1 Seller Flow

```
Main Menu → 🏪 Marketplace
  → 📦 My Listings (view/edit/delete own products)
  → ➕ List New Product
      → 📸 Upload Product Image(s) (1-5 photos)
      → 📝 Enter Product Title (max 100 chars)
      → 📄 Enter Description (max 500 chars)
      → 💰 Set Price (USD)
      → 🏷️ Select Category
      → ✅ Confirm & Publish
  → 💬 My Conversations (view active buyer chats)
  → 📊 My Sales Stats
```

### 2.2 Buyer Flow

```
Main Menu → 🏪 Marketplace
  → 🔍 Browse Marketplace
      → Select Category or "All"
      → View product cards (image + title + price + 🔒 Escrow Protected)
      → Tap product → Full details view
          → 💬 Chat with Seller
          → 🔒 Start Escrow (links to @Lockbaybot)
  → 💬 My Conversations (view active seller chats)
  → 🛒 My Purchases
```

### 2.3 Chat Relay Flow (Anonymized)

```
Buyer taps "💬 Chat with Seller" on a product
  → Bot creates a conversation thread
  → Bot sends to Buyer: "💬 You're now chatting about [Product]. Type your message."
  → Bot sends to Seller: "💬 New inquiry about [Product] from a buyer. Type your reply."

Buyer types message → Bot relays to Seller: "💬 Buyer: [message]"
Seller types reply → Bot relays to Buyer: "💬 Seller: [reply]"

Either party can:
  → /done — End conversation
  → 🔒 Start Escrow — Redirect to @Lockbaybot with deal details
```

### 2.4 Escrow Flow

```
Either party clicks "🔒 Start Escrow"
  → Bot generates deep link: https://t.me/Lockbaybot?start=deal_{productId}_{buyerId}_{sellerId}_{price}
  → Bot sends both parties:
      "🔒 Escrow initiated for [Product] at $[Price]
       👉 Tap below to complete on @Lockbaybot"
      [🔒 Open Escrow on Lockbay] (inline button → deep link)
```

---

## 3. UI/UX Design (Telegram Bot Interface)

### 3.1 Main Menu Addition

**Current:**
```
📞 Cloud IVR + SIP    | 📱 Test SIP
🛒 Digital Products   | 💳 Virtual Card
🌐 Domain Names
🔗 URL Shortener
🎯 Buy Leads         | ✅ Validate
🛡️ Anti-Red Hosting
💰 Wallet            | 📋 Plans
⚙️ Settings          | 💬 Support
```

**New (add marketplace row):**
```
📞 Cloud IVR + SIP    | 📱 Test SIP
🛒 Digital Products   | 💳 Virtual Card
🏪 Marketplace                          ← NEW
🌐 Domain Names
🔗 URL Shortener
...
```

### 3.2 Marketplace Home Screen

```
🏪 Marketplace

🔒 All transactions are escrow-protected via @Lockbaybot

Browse products from verified sellers. Your money is held safely
in escrow until you confirm delivery.

[🔍 Browse Products]
[➕ List a Product]
[💬 My Conversations]
[📦 My Listings]
[↩️ Back]
```

### 3.3 Product Card (Browse View)

For each product in the listing, bot sends a **photo message** with caption:

```
📸 [Product Image]

🏷️ Product Title Here
💰 $50.00
📍 Category: Electronics
⭐ Seller: @username (5 sales)
🔒 Escrow Protected

[💬 Chat with Seller] [🔒 Start Escrow]
[➡️ Next] [↩️ Back to Browse]
```

### 3.4 Full Product Detail View

```
📸 [Product Image 1/3]

📦 Product Title Here

📄 Full description of the product goes here. Can be up to
500 characters with details about condition, specs, etc.

💰 Price: $50.00
📍 Category: Electronics
⭐ Seller: @username
📊 Seller stats: 5 completed sales | Joined Jan 2026
🔒 ESCROW PROTECTED — Your payment is held safely until delivery confirmed

[💬 Chat with Seller]
[🔒 Start Escrow — $50.00]
[📸 More Photos]
[↩️ Back]
```

### 3.5 Chat Interface

**Buyer side:**
```
💬 Chat about: iPhone 14 Pro (Listed at $50.00)
🔒 This transaction is escrow-protected

Seller: Hi! The phone is in great condition, barely used.
You: Can you do $45?
Seller: Meet me at $47 and we have a deal.
You: Deal! Let's start escrow.

[🔒 Start Escrow — $47.00]  [/done End Chat]
```

**Seller side:**
```
💬 Inquiry about: iPhone 14 Pro ($50.00)
🔒 Escrow-protected transaction

Buyer: Can you do $45?
You: Meet me at $47 and we have a deal.
Buyer: Deal! Let's start escrow.

[🔒 Start Escrow — $47.00]  [/done End Chat]
```

### 3.6 Escrow Initiation Message

```
🔒 ESCROW PROTECTION ACTIVE

📦 Product: iPhone 14 Pro
💰 Agreed Price: $47.00
👤 Buyer: [Anonymous ID]
🏪 Seller: @username

Your money is held safely by @Lockbaybot until:
✅ Buyer confirms product received
✅ Or dispute is resolved by Lockbay team

👉 Tap below to proceed to @Lockbaybot:

[🔒 Open Escrow on @Lockbaybot]
```

---

## 4. Database Schema

### 4.1 Collection: `marketplaceProducts`

```json
{
  "_id": "uuid-v4",
  "sellerId": 1005284399,          // Telegram chatId
  "sellerUsername": "@pirate_script",
  "title": "iPhone 14 Pro",
  "description": "Barely used, 256GB, Space Black",
  "price": 50.00,
  "currency": "USD",
  "category": "Electronics",
  "images": [
    { "fileId": "telegram_file_id_1", "url": "/assets/marketplace/img1.jpg" },
    { "fileId": "telegram_file_id_2", "url": "/assets/marketplace/img2.jpg" }
  ],
  "status": "active",              // active | sold | removed
  "createdAt": "2026-03-01T...",
  "updatedAt": "2026-03-01T...",
  "views": 0,
  "inquiries": 0,
  "escrowsStarted": 0
}
```

### 4.2 Collection: `marketplaceConversations`

```json
{
  "_id": "uuid-v4",
  "productId": "uuid-v4",
  "buyerId": 8490263518,
  "sellerId": 1005284399,
  "agreedPrice": null,              // Set when either clicks Start Escrow
  "status": "active",               // active | closed | escrow_started
  "lastMessageAt": "2026-03-01T...",
  "createdAt": "2026-03-01T...",
  "messageCount": 0
}
```

### 4.3 Collection: `marketplaceMessages`

```json
{
  "_id": "uuid-v4",
  "conversationId": "uuid-v4",
  "senderId": 8490263518,
  "senderRole": "buyer",            // buyer | seller
  "text": "Can you do $45?",
  "timestamp": "2026-03-01T..."
}
```

---

## 5. Technical Implementation Plan

### Phase 1: Core Marketplace (MVP)

**Backend — New Service File: `js/marketplace-service.js`**

| Function | Description |
|----------|-------------|
| `createProduct(sellerId, data)` | Create new product listing |
| `getProduct(productId)` | Get single product |
| `listProducts(category, page)` | Paginated product browse |
| `getSellerProducts(sellerId)` | Get seller's own listings |
| `updateProduct(productId, data)` | Edit listing |
| `removeProduct(productId)` | Soft-delete listing |
| `createConversation(productId, buyerId)` | Start buyer-seller chat |
| `getConversation(convId)` | Get conversation details |
| `getUserConversations(chatId)` | Get user's active conversations |
| `addMessage(convId, senderId, text)` | Add message to conversation |
| `getMessages(convId, limit)` | Get recent messages |
| `startEscrow(convId, price)` | Mark conversation as escrow_started |
| `getSellerStats(sellerId)` | Get seller's sales stats |

**Bot Handlers — Add to `js/_index.js`**

| Action | Handler |
|--------|---------|
| `marketplace` | Main marketplace menu |
| `mpBrowse` | Browse products (paginated) |
| `mpBrowseCategory` | Category selection |
| `mpViewProduct` | Full product detail |
| `mpListProduct` | Start listing flow |
| `mpListImage` | Upload product image(s) |
| `mpListTitle` | Enter product title |
| `mpListDesc` | Enter description |
| `mpListPrice` | Set price |
| `mpListCategory` | Select category |
| `mpListConfirm` | Confirm and publish |
| `mpMyListings` | View own listings |
| `mpEditProduct` | Edit a listing |
| `mpChat` | Active conversation mode (relay) |
| `mpConversations` | List conversations |
| `mpEscrow` | Initiate escrow |

**Language Files — Add translations for all 4 languages (en, fr, zh, hi)**

### Phase 2: Chat Relay System

- When a user is in `mpChat` mode, ALL messages are relayed to the other party
- Bot prefixes messages with role: "💬 Buyer:" or "💬 Seller:"
- User exits chat with `/done` or `↩️ Back` button
- Either party can click "🔒 Start Escrow" at any time
- Price can be updated in conversation before escrow

### Phase 3: Escrow Integration with @Lockbaybot

- Generate deep link: `https://t.me/Lockbaybot?start=escrow_{productId}_{price}_{buyerId}_{sellerId}`
- Send inline keyboard button to both parties
- Track escrow status in conversation document

---

## 6. Categories

```
📱 Electronics
💻 Digital Goods
🎮 Gaming
👕 Fashion
🏠 Home & Garden
📚 Books & Media
🔧 Services
🎨 Art & Collectibles
🔗 Crypto & Finance
📦 Other
```

---

## 7. Safety & Trust Features

1. **🔒 Escrow Badge** — Shown on every product card, chat header, and purchase prompt
2. **Seller Stats** — Number of completed sales, account age
3. **Anonymous Chat** — Buyers and sellers communicate without revealing identity
4. **Report System** — Users can report suspicious listings
5. **Auto-moderation** — Price limits ($1-$10,000), image required, no duplicate listings
6. **Escrow Reminder** — Bot reminds both parties: "Never send payment outside escrow"

---

## 8. File Changes Summary

| File | Changes |
|------|---------|
| `js/marketplace-service.js` | **NEW** — All marketplace CRUD + chat logic |
| `js/_index.js` | Add marketplace actions, handlers, chat relay, escrow flow |
| `js/lang/en.js` | Add marketplace translations + menu button |
| `js/lang/fr.js` | Add marketplace translations (French) |
| `js/lang/zh.js` | Add marketplace translations (Chinese) |
| `js/lang/hi.js` | Add marketplace translations (Hindi) |

---

## 9. Implementation Order

1. ✅ Create `marketplace-service.js` with all DB operations
2. ✅ Add marketplace translations to all 4 language files
3. ✅ Add marketplace button to main menu
4. ✅ Implement seller listing flow (upload → title → desc → price → category → publish)
5. ✅ Implement browse flow (categories → paginated products → product detail)
6. ✅ Implement chat relay system (buyer ↔ seller via bot)
7. ✅ Implement escrow initiation (deep link to @Lockbaybot)
8. ✅ Add "My Listings" and "My Conversations" management
9. ✅ Test end-to-end flow

---

## 10. Escrow Deep Link Format

```
https://t.me/Lockbaybot?start=nm_{productId}_{buyerChatId}_{sellerChatId}_{priceInCents}
```

Example:
```
https://t.me/Lockbaybot?start=nm_a1b2c3d4_8490263518_1005284399_5000
```

The `nm_` prefix identifies this as a Nomadly marketplace escrow request.

---

## 11. Anti-Abuse Rules

- Max 20 active listings per seller
- Max 5 images per product
- Min price: $1, Max price: $10,000
- Product images must be photos (not documents)
- Duplicate title detection within same seller
- Rate limit: Max 5 new listings per hour
- Chat rate limit: Max 30 messages per conversation per hour
- Auto-close inactive conversations after 48 hours
