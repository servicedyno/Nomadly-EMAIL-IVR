/**
 * Transaction ID Generation & Management
 * Provides unique IDs for all transactions to improve support resolution
 */

const { randomUUID } = require('crypto')

/**
 * Generate a transaction ID
 * Format: TXN-YYYYMMDD-XXXXX (e.g., TXN-20260416-A7K9M)
 */
function generateTransactionId() {
  const date = new Date()
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '')
  const random = randomUUID().slice(0, 5).toUpperCase()
  return `TXN-${dateStr}-${random}`
}

/**
 * Build standardized discount/tier metadata for a product SALE.
 * Lets the Sales & Profit dashboard show list price, loyalty + coupon discounts
 * and membership tier, and compute ACCURATE profit (cost anchored to the LIST
 * price so every dollar of discount comes straight out of margin).
 *
 * Reconstructs listPrice from the net paid + discounts:
 *   listPrice = amountPaid + loyaltyDiscount + couponDiscount
 * (holds regardless of the order coupon/loyalty were applied).
 *
 * Defensive by design — NEVER throws (returns {} on any problem) so it can be
 * safely spread into any purchase flow's metadata without risk.
 *
 * @param {object} info       checkout session (loyaltyDiscount, couponApplied, couponDiscount, couponCode, loyaltyTierKey)
 * @param {number} amountPaid net amount actually charged after all discounts
 */
function buildSaleMeta(info, amountPaid) {
  try {
    const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100
    const paid = r2(amountPaid)
    const loyaltyDiscount = Math.max(0, r2(info && info.loyaltyDiscount))
    const couponDiscount = (info && info.couponApplied) ? Math.max(0, r2(info && info.couponDiscount)) : 0
    const totalDiscount = r2(loyaltyDiscount + couponDiscount)
    const listPrice = r2(paid + totalDiscount)
    return {
      listPrice,
      loyaltyTier: (info && info.loyaltyTierKey) ? String(info.loyaltyTierKey) : 'bronze',
      loyaltyDiscount,
      couponCode: (info && info.couponApplied && info.couponCode) ? String(info.couponCode) : null,
      couponDiscount,
      totalDiscount,
    }
  } catch (_) {
    return {}
  }
}

/**
 * Store transaction metadata in DB
 */
async function logTransaction(db, transactionData) {
  const { chatId, type, amount, currency, status, metadata = {} } = transactionData
  
  const transaction = {
    _id: transactionData.transactionId || generateTransactionId(),
    chatId: String(chatId),
    type, // 'domain', 'hosting', 'phone', 'wallet-topup', etc.
    amount: amount || 0,
    currency: currency || 'USD',
    status, // 'pending', 'completed', 'failed', 'refunded'
    metadata,
    createdAt: new Date(),
    updatedAt: new Date()
  }

  try {
    await db.collection('transactions').updateOne(
      { _id: transaction._id },
      { $set: transaction },
      { upsert: true }
    )
    return transaction._id
  } catch (err) {
    console.error('[TransactionID] Failed to log transaction:', err.message)
    return transaction._id // Still return ID even if logging fails
  }
}

/**
 * Update transaction status
 */
async function updateTransactionStatus(db, transactionId, status, additionalData = {}) {
  try {
    await db.collection('transactions').updateOne(
      { _id: transactionId },
      { 
        $set: { 
          status, 
          updatedAt: new Date(),
          ...additionalData
        } 
      }
    )
  } catch (err) {
    console.error('[TransactionID] Failed to update status:', err.message)
  }
}

/**
 * Get user's recent transactions
 */
async function getUserTransactions(db, chatId, limit = 10) {
  try {
    const transactions = await db.collection('transactions')
      .find({ chatId: String(chatId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray()
    return transactions
  } catch (err) {
    console.error('[TransactionID] Failed to fetch transactions:', err.message)
    return []
  }
}

/**
 * Get transaction by ID
 */

module.exports = {
  generateTransactionId,
  logTransaction,
  updateTransactionStatus,
  getUserTransactions,
  buildSaleMeta,
}
