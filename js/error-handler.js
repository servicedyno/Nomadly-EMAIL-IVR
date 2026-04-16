/**
 * Enhanced Error Notification System
 * Replaces .catch(() => {}) with proper error handling
 */

const TELEGRAM_ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID
const TELEGRAM_DEV_CHAT_ID = process.env.TELEGRAM_DEV_CHAT_ID

// Critical operations that require admin notification
const CRITICAL_OPERATIONS = new Set([
  'refund',
  'payment',
  'domain_registration',
  'hosting_creation',
  'phone_purchase',
  'wallet_deduction',
  'wallet_credit'
])

/**
 * Handle error with proper logging and optional user notification
 */
function handleError(options) {
  const {
    error,
    operation,
    chatId,
    context = {},
    notifyUser = false,
    notifyAdmin = false,
    bot = null,
    severity = 'medium' // 'low', 'medium', 'high', 'critical'
  } = options

  const timestamp = new Date().toISOString()
  const errorMessage = error?.message || error || 'Unknown error'

  // Always log to console
  console.error(`[${timestamp}] [${severity.toUpperCase()}] ${operation} failed:`, errorMessage)
  if (Object.keys(context).length > 0) {
    console.error('[Context]:', JSON.stringify(context, null, 2))
  }

  // Notify admin for critical operations
  if ((notifyAdmin || CRITICAL_OPERATIONS.has(operation) || severity === 'critical') && bot && TELEGRAM_ADMIN_CHAT_ID) {
    const adminMessage = `🚨 <b>${severity === 'critical' ? 'CRITICAL' : 'Error'}: ${operation}</b>\n\n` +
      `User: ${chatId || 'N/A'}\n` +
      `Error: ${errorMessage}\n` +
      `Time: ${timestamp}\n` +
      (context.transactionId ? `Transaction: <code>${context.transactionId}</code>\n` : '') +
      (context.amount ? `Amount: $${context.amount}\n` : '') +
      (Object.keys(context).length > 0 ? `\nContext: <pre>${JSON.stringify(context, null, 2).slice(0, 500)}</pre>` : '')

    bot.sendMessage(TELEGRAM_ADMIN_CHAT_ID, adminMessage, { parse_mode: 'HTML' })
      .catch(err => console.error('[ErrorNotification] Failed to notify admin:', err.message))
  }

  // Notify developer for system-level issues
  if (severity === 'critical' && bot && TELEGRAM_DEV_CHAT_ID && TELEGRAM_DEV_CHAT_ID !== TELEGRAM_ADMIN_CHAT_ID) {
    bot.sendMessage(TELEGRAM_DEV_CHAT_ID, 
      `🔥 CRITICAL: ${operation}\n${errorMessage}\nUser: ${chatId}`, 
      { parse_mode: 'HTML' }
    ).catch(() => {})
  }

  // Optionally notify user
  if (notifyUser && bot && chatId) {
    const userMessage = `❌ <b>Error</b>\n\n` +
      `Something went wrong${context.transactionId ? ` (Transaction: ${context.transactionId})` : ''}.\n\n` +
      `Our team has been notified and will investigate.\n\n` +
      (context.refunded ? `✅ Your payment has been refunded.\n\n` : '') +
      `Please contact support if this persists.`

    bot.sendMessage(chatId, userMessage, { parse_mode: 'HTML' })
      .catch(err => console.error('[ErrorNotification] Failed to notify user:', err.message))
  }
}

/**
 * Wrapper for critical operations with automatic error handling
 */
async function safeExecute(fn, options) {
  const { operation, chatId, context = {}, bot = null } = options

  try {
    return await fn()
  } catch (error) {
    handleError({
      error,
      operation,
      chatId,
      context,
      notifyAdmin: true,
      severity: 'high',
      bot
    })
    throw error // Re-throw so caller can handle
  }
}

/**
 * Safe refund operation with guaranteed notification
 */
async function safeRefund(atomicIncrement, walletOf, chatId, amount, currency, context, bot) {
  try {
    await atomicIncrement(walletOf, chatId, currency === 'NGN' ? 'ngnIn' : 'usdIn', amount)
    
    console.log(`[SafeRefund] ✅ Refunded ${amount} ${currency} to user ${chatId}`)
    
    // Success notification to user
    if (bot) {
      const message = `✅ <b>Refund Processed</b>\n\n` +
        `Amount: <b>${currency === 'NGN' ? '₦' : '$'}${amount.toFixed(2)}</b>\n` +
        (context.transactionId ? `Transaction: <code>${context.transactionId}</code>\n` : '') +
        `\nYour wallet has been credited.`
      
      bot.sendMessage(chatId, message, { parse_mode: 'HTML' })
        .catch(err => console.error('[SafeRefund] Failed to notify user:', err.message))
    }
    
    return { success: true }
  } catch (error) {
    // CRITICAL: Refund failed - escalate immediately
    handleError({
      error,
      operation: 'refund',
      chatId,
      context: { amount, currency, ...context },
      notifyAdmin: true,
      notifyUser: true,
      severity: 'critical',
      bot
    })
    
    return { success: false, error: error.message }
  }
}

module.exports = {
  handleError,
  safeExecute,
  safeRefund,
  CRITICAL_OPERATIONS
}
