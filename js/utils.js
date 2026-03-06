/*global Buffer process */
const fs = require('fs')
require('dotenv').config()
const axios = require('axios')
const QRCode = require('qrcode')
const { timeOf, freeDomainsOf, freeValidationsOf } = require('./config')
const { getAll, get, set } = require('./db')
const { log } = require('console')
const resolveDns = require('./resolve-cname.js')
const { checkExistingDomain, getNewDomain } = require('./cr-check-domain-available')
const { translation } = require('./translation.js')
const TELEGRAM_DEV_CHAT_ID = process.env.TELEGRAM_DEV_CHAT_ID

const HIDE_SMS_APP = process.env.HIDE_SMS_APP
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const API_KEY_CURRENCY_EXCHANGE = process.env.API_KEY_CURRENCY_EXCHANGE
const UPDATE_DNS_INTERVAL = Number(process.env.UPDATE_DNS_INTERVAL || 60)
const PERCENT_INCREASE_USD_TO_NAIRA = Number(process.env.PERCENT_INCREASE_USD_TO_NAIRA)

// Helper function to get chat IDs - defined early to avoid hoisting issues
const getChatIds = async nameOf => {
  let ans = await getAll(nameOf)
  if (!ans) return []
  return ans.map(a => a._id)
}

function isValidUrl(url) {
  try {
    // More robust URL validation using built-in URL constructor
    if (!url || typeof url !== 'string') return false
    const urlObj = new URL(url)
    return ['http:', 'https:', 'ftp:'].includes(urlObj.protocol)
  } catch (error) {
    // If URL constructor throws, it's invalid
    return false
  }
}

function isNormalUser(chatId) {
  return !isAdmin(chatId) && !isDeveloper(chatId)
}

function isDeveloper(chatId) {
  return chatId === Number(process.env.TELEGRAM_DEVELOPER_CHAT_ID) // Replace with the actual developer's chat ID
}

function isAdmin(chatId) {
  return chatId === Number(process.env.TELEGRAM_ADMIN_CHAT_ID) // Replace with the actual admin's chat ID
}

async function usdToNgn(amountInUSD) {
  try {
    const apiUrl = `https://openexchangerates.org/api/latest.json?app_id=${API_KEY_CURRENCY_EXCHANGE}`

    const response = await axios.get(apiUrl, { timeout: 10000 })
    if (!response?.data?.rates?.['NGN']) {
      console.error('Error usdToNgn: Invalid API response structure')
      // Return fallback rate (1 USD = 1650 NGN)
      return Number(amountInUSD) * 1650
    }
    const usdToNgnRate = response.data.rates['NGN']
    const nairaAmount = Number(amountInUSD) * usdToNgnRate * (1 + PERCENT_INCREASE_USD_TO_NAIRA)
    return Number(nairaAmount.toFixed())
  } catch (error) {
    console.error(`Error usdToNgn: ${error.message}`)
    // Return fallback rate (1 USD = 1650 NGN)
    return Number(amountInUSD) * 1650
  }
}

// usdToNgn(1).then(log);

async function ngnToUsd(ngn) {
  try {
    const apiUrl = `https://openexchangerates.org/api/latest.json?app_id=${API_KEY_CURRENCY_EXCHANGE}`

    const response = await axios.get(apiUrl, { timeout: 10000 })
    if (!response?.data?.rates?.['NGN']) {
      console.error('Error ngnToUsd: Invalid API response structure')
      // Return fallback rate (1 USD = 1650 NGN)
      return Number(ngn) / 1650
    }
    const usdToNgnRate = response.data.rates['NGN']
    const usd = Number(ngn) / (usdToNgnRate * (1 + PERCENT_INCREASE_USD_TO_NAIRA))
    return usd
  } catch (error) {
    console.error(`Error ngnToUsd: ${error.message}`)
    // Return fallback rate (1 USD = 1650 NGN)
    return Number(ngn) / 1650
  }
}

// ngnToUsd(1000).then(log);
const addZero = number => (number < 10 ? '0' + number : number)
const date = (date) => {
  try {
    const currentDate = date ? new Date(date) : new Date()
    if (isNaN(currentDate.getTime())) {
      console.error('Invalid date provided:', date)
      return new Date().toISOString()
    }
    const year = currentDate.getFullYear()
    const month = addZero(currentDate.getMonth() + 1)
    const day = addZero(currentDate.getDate())
    const hours = addZero(currentDate.getHours())
    const minutes = addZero(currentDate.getMinutes())
    const seconds = addZero(currentDate.getSeconds())

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  } catch (error) {
    console.error('Error in date function:', error.message)
    return new Date().toISOString()
  }
}

// Safe JSON stringify that handles circular references
const safeStringify = (obj, replacer = null, space = 2) => {
  try {
    const seen = new WeakSet()
    return JSON.stringify(obj, (key, val) => {
      if (val != null && typeof val === 'object') {
        if (seen.has(val)) {
          return '[Circular]'
        }
        seen.add(val)
      }
      return replacer ? replacer(key, val) : val
    }, space)
  } catch (error) {
    return `[Object stringify error: ${error.message}]`
  }
}

// Enhanced API error handler for better debugging
const handleApiError = (error, context = '') => {
  const errorInfo = {
    context,
    message: error?.message || 'Unknown error',
    status: error?.response?.status,
    statusText: error?.response?.statusText,
    data: error?.response?.data,
    code: error?.code
  }
  
  console.error(`❌ API Error${context ? ` [${context}]` : ''}:`)
  console.error(`   Message: ${errorInfo.message}`)
  
  if (errorInfo.status) {
    console.error(`   HTTP Status: ${errorInfo.status} ${errorInfo.statusText || ''}`)
  }
  
  if (errorInfo.code) {
    console.error(`   Error Code: ${errorInfo.code}`)
  }
  
  if (errorInfo.data) {
    console.error(`   Response Data: ${safeStringify(errorInfo.data)}`)
  }
  
  if (error?.config?.url) {
    console.error(`   URL: ${error.config.url}`)
  }
  
  return errorInfo
}

function today() {
  const currentDate = new Date()
  const day = currentDate.getDate()
  const month = currentDate.getMonth() + 1 // Note: Months are 0-indexed
  const year = currentDate.getFullYear()

  const formattedDate = `${day}-${month}-${year}`
  return formattedDate
}

function week() {
  const currentDate = new Date()
  const startDate = new Date(currentDate.getFullYear(), 0, 1)
  const days = Math.floor((currentDate - startDate) / (24 * 60 * 60 * 1000))
  const weekNumber = Math.ceil(days / 7)

  return year() + ' Week ' + weekNumber
}

function month() {
  const currentDate = new Date()
  return year() + ' Month ' + (currentDate.getMonth() + 1)
}

function year() {
  const currentDate = new Date()
  return 'Year ' + currentDate.getFullYear()
}

function isValidEmail(email) {
  const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  return regex.test(email)
}

function removeProtocolFromDomain(domain) {
  if (!domain || typeof domain !== 'string') {
    return domain || ''
  }
  return domain.toLowerCase().replace('https://', '').replace('http://', '')
}

const regularCheckDns = (bot, chatId, domain, lang) => {
  const checkDnsPropagation = async () => {
    if (await resolveDns(domain)) {
      bot.sendMessage(chatId, translation('t.dnsPropagated', lang).replace('{{domain}}', domain))
      clearInterval(intervalDnsPropagation)
      return
    }
    bot.sendMessage(chatId, translation('t.dnsNotPropagated', lang).replace('{{domain}}', domain))
  }
  const intervalDnsPropagation = setInterval(checkDnsPropagation, UPDATE_DNS_INTERVAL * 1000)

  setTimeout(() => {
    clearInterval(intervalDnsPropagation)
  }, 60 * 60 * 1000)
}

const getRandom = n => Math.floor(Math.random() * n)

const nextNumber = arr => {
  let n = 1
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === n) n++
    else return n
  }
  return n
}

// Import broadcast configuration
const BROADCAST_CONFIG = require('./broadcast-config.js')

// Detect permanent Telegram errors where retrying is pointless
function isPermanentTelegramError(error) {
  const msg = (error.message || '').toLowerCase()
  return msg.includes('chat not found') || msg.includes('user is deactivated') || msg.includes('bot was blocked') || msg.includes('have no rights to send a message')
}

const sendMessageToAllUsers = async (bot, message, method, nameOf, myChatId, db) => {
  try {
    const chatIds = await getChatIds(nameOf)
    
    if (chatIds.length === 0) {
      bot.sendMessage(myChatId, 'No users found to broadcast to.')
      return
    }

    // Pre-filter permanently unreachable users if DB is available
    // Only skip users marked dead who are TRULY permanent (user_deactivated)
    // AND chat_not_found/bot_blocked entries older than 7 days (stale, likely real)
    // Recent entries might be false positives from rate-limiting
    let filteredChatIds = chatIds
    let skippedPermanent = 0
    if (db) {
      const promoOptOut = db.collection('promoOptOut')
      const STALE_THRESHOLD = 7 * 24 * 60 * 60 * 1000 // 7 days
      const staleDate = new Date(Date.now() - STALE_THRESHOLD)
      
      // user_deactivated is always permanent
      const deactivated = await promoOptOut.find({
        optedOut: true,
        reason: 'user_deactivated'
      }).toArray()
      
      // chat_not_found only if older than 7 days (recent ones might be false positives)
      const staleNotFound = await promoOptOut.find({
        optedOut: true,
        reason: 'chat_not_found',
        updatedAt: { $lt: staleDate }
      }).toArray()
      
      const deadSet = new Set([...deactivated, ...staleNotFound].map(r => r._id))
      filteredChatIds = chatIds.filter(id => !deadSet.has(id))
      skippedPermanent = chatIds.length - filteredChatIds.length
    }

    const total = filteredChatIds.length

    // Use configuration constants
    const { BATCH_SIZE, DELAY_BETWEEN_BATCHES, DELAY_BETWEEN_MESSAGES, MAX_RETRIES, RETRY_DELAY } = BROADCAST_CONFIG
    
    const startTime = Date.now()
    bot.sendMessage(myChatId, `Starting broadcast to ${total} users (${skippedPermanent} permanently unreachable skipped)...\nBatch size: ${BATCH_SIZE}\nEstimated time: ${Math.ceil(total / BATCH_SIZE)} seconds`)
    
    let successCount = 0
    let errorCount = 0
    let newlyDeadCount = 0
    let currentBatch = 0
    const totalBatches = Math.ceil(total / BATCH_SIZE)
    
    // Process users in batches
    for (let i = 0; i < total; i += BATCH_SIZE) {
      currentBatch++
      const batch = filteredChatIds.slice(i, i + BATCH_SIZE)
      
      // Send progress update
      bot.sendMessage(myChatId, `Processing batch ${currentBatch}/${totalBatches} (${i + 1}-${Math.min(i + BATCH_SIZE, total)} of ${total})`)
      
      // Process current batch with retry logic
      const batchPromises = batch.map(async (chatId, index) => {
        // Add small delay between messages in the same batch
        await sleep(index * DELAY_BETWEEN_MESSAGES)
        
        // Retry logic for failed messages
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          try {
            if (method === 'sendPhoto') {
              await bot.sendPhoto(chatId, message)
            } else {
              await bot.sendMessage(chatId, message)
            }
            
            successCount++
            return { success: true, chatId, attempts: attempt }
          } catch (error) {
            // For truly permanent errors (user deactivated), skip retries immediately
            // For potentially recoverable errors (bot_blocked, chat_not_found), only mark after all retries fail
            const errMsg = (error.message || '').toLowerCase()
            const isTrulyPermanent = errMsg.includes('user is deactivated')
            const isLikelyPermanent = errMsg.includes('chat not found') || errMsg.includes('bot was blocked') || errMsg.includes('have no rights to send a message')
            
            if (isTrulyPermanent) {
              errorCount++
              newlyDeadCount++
              if (db) {
                await db.collection('promoOptOut').updateOne(
                  { _id: chatId },
                  { $set: { optedOut: true, reason: 'user_deactivated', updatedAt: new Date() } },
                  { upsert: true }
                )
              }
              return { success: false, chatId, error: error.message, permanent: true }
            }
            
            if (isLikelyPermanent && attempt === MAX_RETRIES) {
              // Only mark after ALL retries exhausted (reduces false positives from rate limiting)
              errorCount++
              newlyDeadCount++
              if (db) {
                const reason = errMsg.includes('chat not found') ? 'chat_not_found' : 
                               errMsg.includes('bot was blocked') ? 'bot_blocked' : 'no_rights'
                // Use $inc on failCount to track consecutive failures instead of immediately marking dead
                await db.collection('promoOptOut').updateOne(
                  { _id: chatId },
                  { $set: { reason, updatedAt: new Date() }, $inc: { failCount: 1 } },
                  { upsert: true }
                )
                // Only mark as optedOut after 2+ consecutive broadcast failures
                const record = await db.collection('promoOptOut').findOne({ _id: chatId })
                if (record?.failCount >= 2) {
                  await db.collection('promoOptOut').updateOne(
                    { _id: chatId },
                    { $set: { optedOut: true } }
                  )
                }
              }
              return { success: false, chatId, error: error.message, permanent: true }
            }
            
            if (!isLikelyPermanent && isPermanentTelegramError(error)) {
              errorCount++
              return { success: false, chatId, error: error.message, permanent: true }
            }

            if (attempt === MAX_RETRIES) {
              errorCount++
              log(`Failed to send message to ${chatId} after ${MAX_RETRIES} attempts: ${error.message}`)
              return { success: false, chatId, error: error.message, attempts: attempt }
            } else {
              log(`Attempt ${attempt} failed for ${chatId}, retrying in ${RETRY_DELAY/1000}s...`)
              await sleep(RETRY_DELAY)
            }
          }
        }
      })
      
      // Wait for current batch to complete
      await Promise.allSettled(batchPromises)
      
      // Send batch completion status
      bot.sendMessage(myChatId, `Batch ${currentBatch}/${totalBatches} completed\nSuccess: ${successCount}, Errors: ${errorCount}`)
      
      // Add delay between batches (except for the last batch)
      if (i + BATCH_SIZE < total) {
        await sleep(DELAY_BETWEEN_BATCHES)
      }
    }
    
    // Final summary
    const finalMessage = `Broadcast completed!\n\nFinal Results:\nSuccessfully sent: ${successCount}\nFailed: ${errorCount}\nPermanently unreachable (newly found): ${newlyDeadCount}\nPre-filtered (known dead): ${skippedPermanent}\nSuccess rate: ${((successCount / total) * 100).toFixed(1)}%`
    
    bot.sendMessage(myChatId, finalMessage)
    
    // Log detailed results
    log(`Broadcast completed - Total: ${total}, Success: ${successCount}, Errors: ${errorCount}, NewlyDead: ${newlyDeadCount}, PreFiltered: ${skippedPermanent}`)
    
    // Store broadcast statistics for admin reference
    const broadcastStats = {
      timestamp: new Date().toISOString(),
      totalUsers: chatIds.length,
      filteredUsers: total,
      skippedPermanent,
      successCount,
      errorCount,
      newlyDeadCount,
      successRate: ((successCount / total) * 100).toFixed(1),
      duration: Date.now() - startTime
    }
    
    log(`Broadcast stats:`, broadcastStats)
    
  } catch (error) {
    log(`Broadcast error: ${error.message}`)
    bot.sendMessage(myChatId, `Broadcast failed: ${error.message}`)
  }
}

// Helper function to get broadcast statistics
const getBroadcastStats = async (nameOf) => {
  try {
    const chatIds = await getChatIds(nameOf)
    const total = chatIds.length
    
    return {
      totalUsers: total,
      estimatedBatchTime: Math.ceil(total / BROADCAST_CONFIG.BATCH_SIZE),
      batchSize: BROADCAST_CONFIG.BATCH_SIZE,
      delayBetweenBatches: BROADCAST_CONFIG.DELAY_BETWEEN_BATCHES / 1000,
      maxRetries: BROADCAST_CONFIG.MAX_RETRIES
    }
  } catch (error) {
    log(`Error getting broadcast stats: ${error.message}`)
    return null
  }
}

/**
 * Broadcast a new marketplace listing to ALL bot users (background, non-blocking).
 * Sends the first product image with caption + inline buttons for chat & escrow.
 * Skips the seller who created the listing and known dead users.
 */
const broadcastNewListing = async (bot, product, nameOf, db) => {
  try {
    let chatIds = await getChatIds(nameOf)
    if (!chatIds.length) return

    // Exclude the seller themselves
    chatIds = chatIds.filter(id => String(id) !== String(product.sellerId))

    // Pre-filter dead users
    let skippedPermanent = 0
    if (db) {
      const promoOptOut = db.collection('promoOptOut')
      const STALE_THRESHOLD = 7 * 24 * 60 * 60 * 1000
      const staleDate = new Date(Date.now() - STALE_THRESHOLD)
      const deactivated = await promoOptOut.find({ optedOut: true, reason: 'user_deactivated' }).toArray()
      const staleNotFound = await promoOptOut.find({ optedOut: true, reason: 'chat_not_found', updatedAt: { $lt: staleDate } }).toArray()
      const deadSet = new Set([...deactivated, ...staleNotFound].map(r => r._id))
      const before = chatIds.length
      chatIds = chatIds.filter(id => !deadSet.has(id))
      skippedPermanent = before - chatIds.length
    }

    const total = chatIds.length
    if (!total) return
    log(`[Marketplace Broadcast] Starting — product ${product._id} to ${total} users (${skippedPermanent} dead skipped)`)

    const { BATCH_SIZE, DELAY_BETWEEN_BATCHES, DELAY_BETWEEN_MESSAGES, MAX_RETRIES, RETRY_DELAY } = BROADCAST_CONFIG

    const caption = `🆕 <b>New Listing!</b>\n\n` +
      `🏷️ <b>${product.title}</b>\n` +
      `📄 ${product.description}\n\n` +
      `💰 <b>$${Number(product.price).toFixed(2)}</b>  ·  ${product.category}\n` +
      `👤 Seller: @${product.sellerUsername || 'anonymous'}\n\n` +
      `🔒 Escrow Protected — Buy with confidence`

    const inlineKeyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '💬 Chat with Seller', callback_data: `mp:chat:${product._id}` },
            { text: '🔒 Start Escrow', callback_data: `mp:escrow_product:${product._id}` }
          ]
        ]
      },
      parse_mode: 'HTML'
    }

    const hasImage = product.images && product.images.length > 0
    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < total; i += BATCH_SIZE) {
      const batch = chatIds.slice(i, i + BATCH_SIZE)
      const batchPromises = batch.map(async (cid, index) => {
        await sleep(index * DELAY_BETWEEN_MESSAGES)
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          try {
            if (hasImage) {
              await bot.sendPhoto(cid, product.images[0].fileId, { caption, ...inlineKeyboard })
            } else {
              await bot.sendMessage(cid, caption, inlineKeyboard)
            }
            successCount++
            return
          } catch (error) {
            const errMsg = (error.message || '').toLowerCase()
            const isTrulyPermanent = errMsg.includes('user is deactivated')
            const isLikelyPermanent = errMsg.includes('chat not found') || errMsg.includes('bot was blocked') || errMsg.includes('have no rights to send a message')
            if (isTrulyPermanent) {
              errorCount++
              if (db) {
                await db.collection('promoOptOut').updateOne({ _id: cid }, { $set: { optedOut: true, reason: 'user_deactivated', updatedAt: new Date() } }, { upsert: true })
              }
              return
            }
            if (isLikelyPermanent && attempt === MAX_RETRIES) {
              errorCount++
              if (db) {
                const reason = errMsg.includes('chat not found') ? 'chat_not_found' : errMsg.includes('bot was blocked') ? 'bot_blocked' : 'no_rights'
                await db.collection('promoOptOut').updateOne({ _id: cid }, { $set: { reason, updatedAt: new Date() }, $inc: { failCount: 1 } }, { upsert: true })
                const record = await db.collection('promoOptOut').findOne({ _id: cid })
                if (record?.failCount >= 2) {
                  await db.collection('promoOptOut').updateOne({ _id: cid }, { $set: { optedOut: true } })
                }
              }
              return
            }
            if (attempt === MAX_RETRIES) {
              errorCount++
              return
            }
            await sleep(RETRY_DELAY)
          }
        }
      })
      await Promise.allSettled(batchPromises)
      if (i + BATCH_SIZE < total) await sleep(DELAY_BETWEEN_BATCHES)
    }
    log(`[Marketplace Broadcast] Done — product ${product._id}: ${successCount} sent, ${errorCount} failed out of ${total}`)
  } catch (error) {
    log(`[Marketplace Broadcast] Error: ${error.message}`)
  }
}

const sendQrCode = async (bot, chatId, bb, lang) => {
  const qrCode = await bb.getQrcode()
  const buffer = Buffer.from(qrCode?.qr_code, 'base64')
  fs.writeFileSync('image.png', buffer)
  bot
    ?.sendPhoto(chatId, 'image.png', {
      caption: translation('t.qrCodeText', lang),
    })
    ?.then(() => fs.unlinkSync('image.png'))
    ?.catch(log)
}

const sendQr = async (bot, chatId, text, caption) => {
  const buffer = await QRCode.toDataURL(text)
  fs.writeFileSync('image.png', buffer.split(';base64,').pop(), { encoding: 'base64' })
  bot
    ?.sendPhoto(chatId, 'image.png', { caption })
    ?.then(() => fs.unlinkSync('image.png'))
    ?.catch(log)
}

const generateQr = async (bot, chatId, data, lang) => {
  fs.writeFileSync('image.png', data.split(';base64,').pop(), { encoding: 'base64' })
  bot
    ?.sendPhoto(chatId, 'image.png', {  caption:  translation('t.qrCodeText', lang), })
    ?.then(() => fs.unlinkSync('image.png'))
    ?.catch(log)
}

const getBalance = async (walletOf, chatId) => {
  const wallet = await get(walletOf, chatId)

  const usdBal = (wallet?.usdIn || 0) - (wallet?.usdOut || 0)

  const ngnIn = isNaN(wallet?.ngnIn) ? 0 : Number(wallet?.ngnIn)
  const ngnOut = isNaN(wallet?.ngnOut) ? 0 : Number(wallet?.ngnOut)

  return { usdBal, ngnBal: ngnIn - ngnOut }
}

const MAX_PLAN_DURATION_MS = {
  Daily: 86400 * 1000 * 1.5,    // 1.5 days max (buffer for timezone edge cases)
  Weekly: 7 * 86400 * 1000 * 1.1,  // ~7.7 days max
  Monthly: 31 * 86400 * 1000,      // 31 days max
}

const subscribePlan = async (planEndingTime, freeDomainNamesAvailableFor, planOf, chatId, plan, bot, lang, freeValidationsAvailableFor) => {
  const duration = timeOf[plan]
  if (!duration) {
    console.error(`[subscribePlan] Invalid plan type "${plan}" for chatId ${chatId} — aborting subscription`)
    return
  }

  const endTime = Date.now() + duration
  set(planOf, chatId, plan)
  set(planEndingTime, chatId, endTime)
  set(freeDomainNamesAvailableFor, chatId, freeDomainsOf[plan])
  if (freeValidationsAvailableFor) {
    set(freeValidationsAvailableFor, chatId, freeValidationsOf[plan])
  }
  const t = translation('t', lang)

  log(`[subscribePlan] chatId=${chatId} plan=${plan} expires=${new Date(endTime).toISOString()}`)
  sendMessage(chatId, t.planSubscribed.replace('{{plan}}', plan))
  log('reply:\t' + t.planSubscribed.replace('{{plan}}', plan) + '\tto: ' + chatId)

  HIDE_SMS_APP !== 'true' &&
    sendQr(
      bot,
      chatId,
      `${chatId}`,
      translation('t.scanQrOrUseChat', lang, chatId),
    )
}
const sleep = ms => new Promise(r => setTimeout(r, ms))

const parse = (cc, s) => {
  try {
    if (!s || typeof s !== 'string') return ''
    const cleanedStr = s.replace(`+${cc}`, ``).replace(/[^\d]/g, '')
    const parsed = parseInt(cleanedStr, 10)
    return isNaN(parsed) ? '' : parsed.toString()
  } catch (error) {
    console.error('Error in parse function:', error.message)
    return ''
  }
}

const getInt = str => {
  try {
    if (!str || typeof str !== 'string') return null
    const match = str.match(/\d+/)
    return match ? parseInt(match[0], 10) : null
  } catch (error) {
    console.error('Error in getInt function:', error.message)
    return null
  }
}
// const phoneLen = {
//   1: 11,
//   64: 11,
//   61: 11,
//   44: 12,
// }

// const areaCodeLength = {
//   1: 3,
//   44: 2,
//   64: 2,
//   61: 1,
// }

function extractPhoneNumbers(text, cc) {
  const phoneRegex = /\b(?:\+?\d{1,4}[ -]?)?(?:\(\d{1,}\)[ -]?)?\d{1,}[- ]?\d{1,}[- ]?\d{1,}\b/g
  let phones = text.match(phoneRegex) || []
  phones = phones.map(phoneNumber => phoneNumber.replace(/[\s()-+]/g, ''))
  // phones = phones.filter(phoneNumber => phoneNumber.length === phoneLen[cc])

  const lenBefore = phones.length
  phones = phones.filter(phoneNumber => phoneNumber.startsWith(cc))
  const lenAfter = phones.length

  return { phones, diff: lenBefore - lenAfter }
}

const sendMessage = async (chatId, message, reply_markup) => {
  try {
    console.log({ message, chatId })
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: message,
      ...reply_markup,
    })
  } catch (error) {
    console.error('Error sending message:', { code: error?.message, data: error?.response?.data, chatId, message })
  }
}

// sendMessage(6687923716, 'Hello, world!') // unit test

async function checkFreeTrialTaken(c, chatId) {
  const result = await c.findOne({ _id: chatId })

  // Check if current package is a free plan
  const currentPackage = result?.currentPackage
  if (currentPackage && currentPackage.name === 'Freedom Plan') {
    return 'already-used'
  }

  // Check if any previous package was a free plan
  const previousPackages = result?.previousPackages || []
  const hasUsedFreePlan = previousPackages.some(pkg => pkg.name === 'Freedom Plan')

  if (hasUsedFreePlan) {
    return 'already-used'
  }

  return 'not_taken' // If neither current nor previous packages are 'Freedom Plan'
}

const planCheckExistingDomain = (domainName, hostingType) => checkExistingDomain(domainName, hostingType)

async function planGetNewDomain(message, chatId, send, saveInfo, hostingType, verbose = true) {
  try {
    let modifiedDomain = removeProtocolFromDomain(message)

    const { available, originalPrice, price, chatMessage, domainType, registrar } = await getNewDomain(modifiedDomain, hostingType)
    if (!available) {
      // if(verbose) {
        await send(chatId, chatMessage)
      // }
      return getDefaultDomainResponse()
    }
    if (!originalPrice) {
      await send(TELEGRAM_DEV_CHAT_ID, 'Some issue in getting price')
      if(verbose) {
        await send(chatId, 'Some issue in getting price')
      }
      return getDefaultDomainResponse()
    }

    saveDomainInfo(saveInfo, modifiedDomain, price, originalPrice, registrar)
    return { modifiedDomain, price, domainType, chatMessage, registrar }
  } catch (error) {
    return getDefaultDomainResponse()
  }
}

function getDefaultDomainResponse() {
  return { modifiedDomain: null, price: null, domainType: null }
}

function saveDomainInfo(saveInfo, modifiedDomain, price, originalPrice, registrar) {
  saveInfo('price', price)
  saveInfo('domain', modifiedDomain)
  saveInfo('originalPrice', originalPrice)
  if (registrar) saveInfo('registrar', registrar)
}

// log(format('1', '4'))
// log(format('1', '20'))
// log(format('1', '200'))
// log(format('1', '201'))
// log(format('1', '213'))

// log(parse('1', '+1(04)'))
// log(parse('1', '+1(20)'))
// log(parse('1', '+1(200)'))
// log(parse('1', '+1(201)'))
// log(parse('1', '+1(213)'))

module.exports = {
  getInt,
  parse,
  year,
  week,
  today,
  month,
  date,
  sleep,
  sendMessage,
  isAdmin,
  usdToNgn,
  ngnToUsd,
  getRandom,
  isValidUrl,
  sendQrCode,
  sendQr,
  generateQr,
  getBalance,
  nextNumber,
  isDeveloper,
  isValidEmail,
  isNormalUser,
  subscribePlan,
  MAX_PLAN_DURATION_MS,
  regularCheckDns,
  checkFreeTrialTaken,
  extractPhoneNumbers,
  sendMessageToAllUsers,
  broadcastNewListing,
  getBroadcastStats,
  getChatIds,
  planGetNewDomain,
  planCheckExistingDomain,
  removeProtocolFromDomain,
  safeStringify,
  handleApiError,
}
