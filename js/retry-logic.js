/**
 * Retry Logic Utility
 * Provides automatic retry with user feedback for critical operations
 */

const { log } = require('console')

/**
 * Retry an operation with exponential backoff and user progress updates
 * @param {Function} operation - Async function to retry
 * @param {Object} options - Retry configuration
 * @param {number} options.maxAttempts - Maximum number of attempts (default: 2)
 * @param {number} options.delayMs - Initial delay between retries in ms (default: 3000)
 * @param {string} options.backoffType - 'exponential' or 'linear' (default: 'linear')
 * @param {Function} options.onRetry - Callback function called before each retry
 * @param {Function} options.shouldRetry - Function to determine if error is retryable
 * @returns {Promise} Result of the operation or throws final error
 */
async function retryWithProgress(operation, options = {}) {
  const {
    maxAttempts = 2,
    delayMs = 3000,
    backoffType = 'linear',
    onRetry = null,
    shouldRetry = () => true
  } = options

  let lastError = null
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await operation(attempt)
      return result
    } catch (error) {
      lastError = error
      log(`[Retry] Attempt ${attempt}/${maxAttempts} failed: ${error.message}`)
      
      // Check if we should retry this error
      if (!shouldRetry(error)) {
        log(`[Retry] Error is not retryable, aborting`)
        throw error
      }
      
      // If this was the last attempt, throw the error
      if (attempt >= maxAttempts) {
        log(`[Retry] All ${maxAttempts} attempts exhausted`)
        throw error
      }
      
      // Calculate delay for next attempt
      const delay = backoffType === 'exponential' 
        ? delayMs * Math.pow(2, attempt - 1)
        : delayMs
      
      // Notify about retry if callback provided
      if (onRetry) {
        await onRetry(attempt, maxAttempts, delay, error)
      }
      
      // Wait before next attempt
      await sleep(delay)
    }
  }
  
  // This should never be reached, but just in case
  throw lastError
}

/**
 * Retry wrapper specifically for domain registration
 * @param {Function} domainRegisterFn - Domain registration function
 * @param {string} domain - Domain name to register
 * @param {Object} bot - Telegram bot instance
 * @param {number} chatId - User's chat ID
 * @param {string} lang - Language code
 * @returns {Promise} Registration result
 */
async function retryDomainRegistration(domainRegisterFn, domain, bot, chatId, lang = 'en') {
  const messages = {
    en: {
      retrying: (attempt, max, seconds) => 
        `⏳ <b>Retrying registration...</b>\n\nAttempt: ${attempt}/${max}\nDomain: ${domain}\nNext attempt in ${Math.ceil(seconds/1000)}s...`,
      finalAttempt: '🔄 <b>Final attempt...</b>\n\nPlease wait...'
    },
    fr: {
      retrying: (attempt, max, seconds) => 
        `⏳ <b>Nouvelle tentative...</b>\n\nTentative : ${attempt}/${max}\nDomaine : ${domain}\nProchaine tentative dans ${Math.ceil(seconds/1000)}s...`,
      finalAttempt: '🔄 <b>Dernière tentative...</b>\n\nVeuillez patienter...'
    },
    zh: {
      retrying: (attempt, max, seconds) => 
        `⏳ <b>重试注册...</b>\n\n尝试：${attempt}/${max}\n域名：${domain}\n${Math.ceil(seconds/1000)}秒后重试...`,
      finalAttempt: '🔄 <b>最后一次尝试...</b>\n\n请稍候...'
    },
    hi: {
      retrying: (attempt, max, seconds) => 
        `⏳ <b>पंजीकरण पुनः प्रयास...</b>\n\nप्रयास: ${attempt}/${max}\nडोमेन: ${domain}\n${Math.ceil(seconds/1000)}s में अगला प्रयास...`,
      finalAttempt: '🔄 <b>अंतिम प्रयास...</b>\n\nकृपया प्रतीक्षा करें...'
    }
  }
  
  const msg = messages[lang] || messages.en
  
  return await retryWithProgress(
    domainRegisterFn,
    {
      maxAttempts: 2,
      delayMs: 3000,
      backoffType: 'linear',
      shouldRetry: (error) => {
        // Retry on timeout, network errors, or temporary failures
        const retryableErrors = ['timeout', 'ETIMEDOUT', 'ECONNRESET', 'temporary', 'try again']
        return retryableErrors.some(keyword => 
          error.message?.toLowerCase().includes(keyword.toLowerCase())
        )
      },
      onRetry: async (attempt, maxAttempts, delay, error) => {
        if (bot && chatId) {
          const retryMsg = attempt === maxAttempts - 1 
            ? msg.finalAttempt
            : msg.retrying(attempt, maxAttempts, delay)
          bot.sendMessage(chatId, retryMsg, { parse_mode: 'HTML' }).catch(() => {})
        }
      }
    }
  )
}

/**
 * Retry wrapper for DNS update operations
 * @param {Function} dnsUpdateFn - DNS update function
 * @param {string} domain - Domain name
 * @param {string} recordType - DNS record type (A, CNAME, MX, etc.)
 * @param {Object} bot - Telegram bot instance
 * @param {number} chatId - User's chat ID
 * @param {string} lang - Language code
 * @returns {Promise} DNS update result
 */
async function retryDNSUpdate(dnsUpdateFn, domain, recordType, bot, chatId, lang = 'en') {
  const messages = {
    en: {
      retrying: (attempt, max) => 
        `🔄 <b>DNS Update Retry</b>\n\nAttempt: ${attempt}/${max}\nDomain: ${domain}\nRecord: ${recordType}\n\nRetrying in 2 seconds...`,
    },
    fr: {
      retrying: (attempt, max) => 
        `🔄 <b>Nouvelle tentative DNS</b>\n\nTentative : ${attempt}/${max}\nDomaine : ${domain}\nEnregistrement : ${recordType}\n\nNouvelle tentative dans 2s...`,
    },
    zh: {
      retrying: (attempt, max) => 
        `🔄 <b>DNS 更新重试</b>\n\n尝试：${attempt}/${max}\n域名：${domain}\n记录：${recordType}\n\n2秒后重试...`,
    },
    hi: {
      retrying: (attempt, max) => 
        `🔄 <b>DNS अपडेट पुनः प्रयास</b>\n\nप्रयास: ${attempt}/${max}\nडोमेन: ${domain}\nरिकॉर्ड: ${recordType}\n\n2 सेकंड में पुन: प्रयास...`,
    }
  }
  
  const msg = messages[lang] || messages.en
  
  return await retryWithProgress(
    dnsUpdateFn,
    {
      maxAttempts: 3,
      delayMs: 2000,
      backoffType: 'linear',
      shouldRetry: (error) => {
        // Retry on DNS propagation delays, timeouts, or API limits
        const retryableErrors = ['timeout', 'rate limit', 'propagation', 'not found', 'try again']
        return retryableErrors.some(keyword => 
          error.message?.toLowerCase().includes(keyword.toLowerCase())
        )
      },
      onRetry: async (attempt, maxAttempts, delay) => {
        if (bot && chatId) {
          bot.sendMessage(chatId, msg.retrying(attempt, maxAttempts), { parse_mode: 'HTML' }).catch(() => {})
        }
      }
    }
  )
}

// Helper sleep function
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

module.exports = {
  retryWithProgress,
  retryDomainRegistration,
  retryDNSUpdate
}
