/**
 * Standardized timeout constants for all API operations
 * Provides consistent timeout behavior across the application
 */

const TIMEOUTS = {
  // Fast operations (8 seconds)
  FAST: 8000,
  PAYMENT_CHECK: 8000,
  BALANCE_CHECK: 8000,
  QUICK_API: 8000,
  
  // Medium operations (15 seconds)
  MEDIUM: 15000,
  DOMAIN_REGISTRATION: 15000,
  DNS_UPDATE: 15000,
  PHONE_PURCHASE: 15000,
  
  // Slow operations (30 seconds)
  SLOW: 30000,
  HOSTING_PROVISION: 30000,
  VPS_CREATION: 30000,
  BULK_OPERATION: 30000,
  
  // Database operations (20 seconds)
  DATABASE: 20000,
  DB_QUERY: 20000,
  DB_TRANSACTION: 20000,
  
  // External service operations
  TWILIO_API: 12000,
  TELNYX_API: 12000,
  CLOUDFLARE_API: 10000,
  BROWSERLESS: 45000, // UI automation needs more time
}

/**
 * Get timeout with warning message for long operations
 * @param {string} operationType - Type of operation (FAST, MEDIUM, SLOW)
 * @param {string} lang - Language code (en, fr, zh, hi)
 * @returns {object} { timeout: number, warningMessage: string|null }
 */
function getTimeoutWithWarning(operationType, lang = 'en') {
  const timeout = TIMEOUTS[operationType] || TIMEOUTS.MEDIUM
  
  const warnings = {
    SLOW: {
      en: '⏳ This may take up to 30 seconds...',
      fr: '⏳ Cela peut prendre jusqu\'à 30 secondes...',
      zh: '⏳ 这可能需要 30 秒...',
      hi: '⏳ इसमें 30 सेकंड तक लग सकते हैं...'
    },
    HOSTING_PROVISION: {
      en: '⏳ Setting up your hosting (up to 30 seconds)...',
      fr: '⏳ Configuration de votre hébergement (jusqu\'à 30 secondes)...',
      zh: '⏳ 正在设置您的主机（最多 30 秒）...',
      hi: '⏳ आपकी होस्टिंग सेट अप हो रही है (30 सेकंड तक)...'
    },
    VPS_CREATION: {
      en: '⏳ Creating your VPS (up to 30 seconds)...',
      fr: '⏳ Création de votre VPS (jusqu\'à 30 secondes)...',
      zh: '⏳ 正在创建您的 VPS（最多 30 秒）...',
      hi: '⏳ आपका VPS बनाया जा रहा है (30 सेकंड तक)...'
    }
  }
  
  const warningMessage = warnings[operationType]?.[lang] || null
  
  return { timeout, warningMessage }
}

/**
 * Format timeout error message for users
 * @param {string} operationType - Type of operation that timed out
 * @param {string} lang - Language code
 * @returns {string} User-friendly timeout message
 */
function getTimeoutErrorMessage(operationType, lang = 'en') {
  const messages = {
    en: {
      FAST: '⏱️ Request timed out. Please try again.',
      MEDIUM: '⏱️ Operation timed out. This is taking longer than expected.\n\n[🔄 Try Again] [💬 Contact Support]',
      SLOW: '⏱️ Operation timed out. The service may be under heavy load.\n\n[🔄 Try Again] [💬 Contact Support]',
      DOMAIN_REGISTRATION: '⏱️ Domain registration timed out. Your payment is safe.\n\n[🔄 Retry Registration] [💬 Contact Support]',
      HOSTING_PROVISION: '⏱️ Hosting setup timed out. We\'re still working on it.\n\nYou\'ll receive credentials via email once ready.\n\n[💬 Contact Support if delayed]',
      VPS_CREATION: '⏱️ VPS creation timed out. The server may still be provisioning.\n\nCheck back in 2-3 minutes or contact support.',
    },
    fr: {
      FAST: '⏱️ Délai dépassé. Veuillez réessayer.',
      MEDIUM: '⏱️ Opération expirée. Cela prend plus de temps que prévu.\n\n[🔄 Réessayer] [💬 Contacter le support]',
      SLOW: '⏱️ Opération expirée. Le service est peut-être surchargé.\n\n[🔄 Réessayer] [💬 Contacter le support]',
    },
    zh: {
      FAST: '⏱️ 请求超时。请重试。',
      MEDIUM: '⏱️ 操作超时。这比预期的时间长。\n\n[🔄 重试] [💬 联系支持]',
      SLOW: '⏱️ 操作超时。服务可能负载过重。\n\n[🔄 重试] [💬 联系支持]',
    },
    hi: {
      FAST: '⏱️ अनुरोध समय समाप्त। कृपया पुन: प्रयास करें।',
      MEDIUM: '⏱️ ऑपरेशन टाइमआउट। यह अपेक्षा से अधिक समय ले रहा है।\n\n[🔄 पुन: प्रयास करें] [💬 सहायता से संपर्क करें]',
      SLOW: '⏱️ ऑपरेशन टाइमआउट। सेवा भारी लोड में हो सकती है।\n\n[🔄 पुन: प्रयास करें] [💬 सहायता से संपर्क करें]',
    }
  }
  
  return messages[lang]?.[operationType] || messages[lang]?.MEDIUM || messages.en.MEDIUM
}

module.exports = {
  TIMEOUTS,
  getTimeoutWithWarning,
  getTimeoutErrorMessage
}
