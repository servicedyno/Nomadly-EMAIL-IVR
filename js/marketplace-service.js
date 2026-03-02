// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Marketplace Service — P2P product listings, chat relay, escrow
// Collections: marketplaceProducts, marketplaceConversations, marketplaceMessages
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const crypto = require('crypto')
const { log } = require('console')

let _db = null
let _products = null
let _conversations = null
let _messages = null

const CATEGORIES = ['💻 Digital Goods', '🏦 Bnk Logs', '🏧 Bnk Opening', '🔧 Tools']
const MIN_PRICE = 20
const MAX_PRICE = 5000
const MAX_LISTINGS = 10
const MAX_TITLE = 100
const MAX_DESC = 500
const MAX_IMAGES = 5
const MSG_RATE_LIMIT = 30 // per conversation per hour
const INACTIVITY_CLOSE_HOURS = 72
const SELLER_OFFLINE_HOURS = 24

// Payment pattern detection (anti-scam)
const PAYMENT_PATTERNS = [
  /paypal|cashapp|cash\s*app|venmo|zelle|western\s*union|moneygram/i,
  /\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b/,     // Bitcoin
  /\b0x[a-fA-F0-9]{40}\b/,                      // Ethereum
  /\bT[A-Za-z1-9]{33}\b/,                       // USDT/TRC20
  /send\s*(to|me|payment|money|funds)/i,
  /pay\s*(me|directly|outside|first)/i,
  /no\s*escrow/i,
  /wire\s*transfer/i,
]

/**
 * Initialize marketplace service
 */
async function initMarketplace(db) {
  _db = db
  _products = db.collection('marketplaceProducts')
  _conversations = db.collection('marketplaceConversations')
  _messages = db.collection('marketplaceMessages')

  // Create indexes
  await _products.createIndex({ sellerId: 1, status: 1 })
  await _products.createIndex({ category: 1, status: 1 })
  await _products.createIndex({ status: 1, createdAt: -1 })
  await _conversations.createIndex({ buyerId: 1, status: 1 })
  await _conversations.createIndex({ sellerId: 1, status: 1 })
  await _conversations.createIndex({ productId: 1, buyerId: 1 })
  await _conversations.createIndex({ lastMessageAt: 1 })
  await _messages.createIndex({ conversationId: 1, timestamp: 1 })

  log('[Marketplace] Initialized')
}

// ── Product CRUD ──

async function createProduct({ sellerId, sellerUsername, title, description, price, category, images }) {
  const product = {
    _id: crypto.randomUUID(),
    sellerId,
    sellerUsername: sellerUsername || 'anonymous',
    title: (title || '').slice(0, MAX_TITLE),
    description: (description || '').slice(0, MAX_DESC),
    price: Number(price),
    currency: 'USD',
    category,
    images: images || [],
    status: 'active',
    views: 0,
    inquiries: 0,
    escrowsStarted: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  await _products.insertOne(product)
  log(`[Marketplace] Product created: ${product._id} by ${sellerId}`)
  return product
}

async function getProduct(productId) {
  return _products.findOne({ _id: productId })
}

async function updateProduct(productId, updates) {
  updates.updatedAt = new Date().toISOString()
  await _products.updateOne({ _id: productId }, { $set: updates })
  return _products.findOne({ _id: productId })
}

async function deleteProduct(productId) {
  await _products.updateOne({ _id: productId }, { $set: { status: 'removed', updatedAt: new Date().toISOString() } })
}

async function markProductSold(productId) {
  await _products.updateOne({ _id: productId }, { $set: { status: 'sold', updatedAt: new Date().toISOString() } })
}

async function getUserProducts(sellerId) {
  return _products.find({ sellerId, status: { $in: ['active', 'sold'] } }).sort({ createdAt: -1 }).toArray()
}

async function getActiveProductCount(sellerId) {
  return _products.countDocuments({ sellerId, status: 'active' })
}

async function browseProducts({ category, page = 0, limit = 5 }) {
  const filter = { status: 'active' }
  if (category && category !== 'all') filter.category = category
  const total = await _products.countDocuments(filter)
  const products = await _products.find(filter).sort({ createdAt: -1 }).skip(page * limit).limit(limit).toArray()
  return { products, total, page, totalPages: Math.ceil(total / limit) }
}

async function incrementProductViews(productId) {
  await _products.updateOne({ _id: productId }, { $inc: { views: 1 } })
}

async function incrementProductInquiries(productId) {
  await _products.updateOne({ _id: productId }, { $inc: { inquiries: 1 } })
}

async function incrementProductEscrows(productId) {
  await _products.updateOne({ _id: productId }, { $inc: { escrowsStarted: 1 } })
}

// ── Conversation CRUD ──

async function createConversation({ productId, productTitle, originalPrice, buyerId, sellerId }) {
  const conv = {
    _id: crypto.randomUUID(),
    productId,
    productTitle: productTitle || '',
    originalPrice: Number(originalPrice) || 0,
    agreedPrice: Number(originalPrice) || 0,
    buyerId,
    sellerId,
    status: 'active',
    lastMessageAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    messageCount: 0,
    escrowStartedAt: null,
  }
  await _conversations.insertOne(conv)
  await incrementProductInquiries(productId)
  log(`[Marketplace] Conversation created: ${conv._id} (buyer: ${buyerId}, seller: ${sellerId})`)
  return conv
}

async function getConversation(conversationId) {
  return _conversations.findOne({ _id: conversationId })
}

async function findConversation(productId, buyerId) {
  return _conversations.findOne({ productId, buyerId, status: { $in: ['active', 'escrow_started'] } })
}

async function getUserConversations(userId) {
  return _conversations.find({
    $or: [{ buyerId: userId }, { sellerId: userId }],
    status: { $in: ['active', 'escrow_started'] },
  }).sort({ lastMessageAt: -1 }).toArray()
}

async function updateConversation(conversationId, updates) {
  await _conversations.updateOne({ _id: conversationId }, { $set: updates })
  return _conversations.findOne({ _id: conversationId })
}

async function closeConversation(conversationId) {
  await _conversations.updateOne({ _id: conversationId }, { $set: { status: 'closed', closedAt: new Date().toISOString() } })
}

async function markEscrowStarted(conversationId) {
  await _conversations.updateOne({ _id: conversationId }, {
    $set: { status: 'escrow_started', escrowStartedAt: new Date().toISOString() }
  })
  const conv = await getConversation(conversationId)
  if (conv) await incrementProductEscrows(conv.productId)
  return conv
}

// ── Messages ──

async function addMessage({ conversationId, senderId, senderRole, text, type = 'text' }) {
  const msg = {
    _id: crypto.randomUUID(),
    conversationId,
    senderId,
    senderRole,
    type,
    text: text || '',
    timestamp: new Date().toISOString(),
  }
  await _messages.insertOne(msg)
  await _conversations.updateOne({ _id: conversationId }, {
    $set: { lastMessageAt: msg.timestamp },
    $inc: { messageCount: 1 },
  })
  return msg
}

async function getRecentMessageCount(conversationId, withinHours = 1) {
  const since = new Date(Date.now() - withinHours * 60 * 60 * 1000).toISOString()
  return _messages.countDocuments({ conversationId, timestamp: { $gte: since } })
}

// ── Anti-Scam ──

function detectPaymentPattern(text) {
  if (!text || typeof text !== 'string') return false
  return PAYMENT_PATTERNS.some(pattern => pattern.test(text))
}

// ── Auto-close stale conversations ──

async function closeStaleConversations() {
  const cutoff = new Date(Date.now() - INACTIVITY_CLOSE_HOURS * 60 * 60 * 1000).toISOString()
  const stale = await _conversations.find({
    status: 'active',
    lastMessageAt: { $lt: cutoff },
  }).toArray()
  for (const conv of stale) {
    await closeConversation(conv._id)
  }
  return stale
}

// ── Seller stats ──

async function getSellerStats(sellerId) {
  const sold = await _products.countDocuments({ sellerId, status: 'sold' })
  const firstProduct = await _products.findOne({ sellerId }, { sort: { createdAt: 1 }, projection: { createdAt: 1 } })
  return {
    salesCount: sold,
    memberSince: firstProduct?.createdAt || new Date().toISOString(),
  }
}

module.exports = {
  initMarketplace,
  // Products
  createProduct,
  getProduct,
  updateProduct,
  deleteProduct,
  markProductSold,
  getUserProducts,
  getActiveProductCount,
  browseProducts,
  incrementProductViews,
  // Conversations
  createConversation,
  getConversation,
  findConversation,
  getUserConversations,
  updateConversation,
  closeConversation,
  markEscrowStarted,
  // Messages
  addMessage,
  getRecentMessageCount,
  // Anti-scam
  detectPaymentPattern,
  // Maintenance
  closeStaleConversations,
  getSellerStats,
  // Constants
  CATEGORIES,
  MIN_PRICE,
  MAX_PRICE,
  MAX_LISTINGS,
  MAX_TITLE,
  MAX_DESC,
  MAX_IMAGES,
  MSG_RATE_LIMIT,
  SELLER_OFFLINE_HOURS,
}
