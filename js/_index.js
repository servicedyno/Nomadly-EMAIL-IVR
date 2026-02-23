/*global process */
// =====================================================
// EARLY EXPRESS SERVER FOR RAILWAY HEALTH CHECKS
// Start HTTP server immediately to pass health checks
// =====================================================
require('dotenv').config()
const express = require('express')
const cors = require('cors')

const earlyApp = express()
earlyApp.use(cors())
earlyApp.use(express.json())
earlyApp.use('/assets', express.static(require('path').join(__dirname, 'assets')))

let appReady = false
let serverStartTime = new Date()

// Health check endpoints - respond immediately
earlyApp.get('/', (req, res) => {
  res.status(200).send(`
    <html>
      <body style="background-color: white;">
        <p style="font-family: 'system-ui';">Nomadly — shorten URLs, register domains, buy phone leads, and grow your business. All from Telegram.

Get started with 5 trial Shortit links — /start
Support: @nomadly_support</p>
      </body>
    </html>
  `)
})

earlyApp.get('/health', (req, res) => {
  res.status(200).json({
    status: appReady ? 'healthy' : 'starting',
    database: appReady ? 'connected' : 'connecting',
    uptime: ((new Date() - serverStartTime) / (1000 * 60 * 60)).toFixed(2) + ' hours'
  })
})

// Start early server immediately
const PORT = process.env.PORT || 5000
const earlyServer = earlyApp.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Early health check server started on port ${PORT}`)
})

// =====================================================
// MAIN APPLICATION CODE CONTINUES BELOW
// =====================================================

const {
  rem,
  html,
  tickerOf,
  discountOn,
  tickerViewOf,
  buyLeadsSelectCountry,
  priceOf,
  buyLeadsSelectArea,
  buyLeadsSelectAreaCode,
  buyLeadsSelectCarrier,
  buyLeadsSelectFormat,
  _buyLeadsSelectAreaCode,
  buyLeadsSelectAmount,
  validatorSelectCountry,
  validatorSelectCarrier,
  validatorSelectAmount,
  validatorSelectFormat,
  dynopayActions,
  tickerOfDyno,
  tickerViewOfDyno,
  continueAtHostbayKeyboard,
  freeDomainsOf,
  freeValidationsOf,
  view,
  targetLeadsTargets,
  targetLeadsCities,
  targetLeadsAreaCodes,
  targetLeadsAreaCodeButtons,
  DP_PRICE_TWILIO_MAIN,
  DP_PRICE_TWILIO_SUB,
  DP_PRICE_TELNYX_MAIN,
  DP_PRICE_TELNYX_SUB,
  DP_PRICE_GWORKSPACE_NEW,
  DP_PRICE_GWORKSPACE_AGED,
  DP_PRICE_ZOHO_NEW,
  DP_PRICE_ZOHO_AGED,
  DP_PRICE_ESIM,
  DP_PRICE_AWS_MAIN,
  DP_PRICE_AWS_SUB,
  DP_PRICE_GCLOUD_MAIN,
  DP_PRICE_GCLOUD_SUB,
} = require('./config.js')
const { user: configUser } = require('./config.js')
const createShortBitly = require('./bitly.js')
const { createShortUrlApi, analyticsCuttly } = require('./cuttly.js')
const {
  week,
  year,
  month,
  today,
  isAdmin,
  usdToNgn,
  ngnToUsd,
  isValidUrl,
  nextNumber,
  getBalance,
  sendQrCode,
  isDeveloper,
  isValidEmail,
  subscribePlan,
  regularCheckDns,
  sendMessageToAllUsers,
  getBroadcastStats,
  parse,
  extractPhoneNumbers,
  sendQr,
  sleep,
  sendMessage,
  checkFreeTrialTaken,
  removeProtocolFromDomain,
  planCheckExistingDomain,
  planGetNewDomain,
  generateQr,
  date,
} = require('./utils.js')
const fs = require('fs')
const axios = require('axios')
const { log } = require('console')
const { MongoClient, ServerApiVersion } = require('mongodb')
const { customAlphabet } = require('nanoid')
const TelegramBot = require('node-telegram-bot-api')
const { createCheckout } = require('./pay-fincra.js')
const viewDNSRecords = require('./cr-view-dns-records.js')
const { deleteDNSRecord } = require('./cr-dns-record-del.js')
const { buyDomainOnline } = require('./cr-domain-register.js')
const { saveServerInDomain } = require('./cr-dns-record-add.js')
const { updateDNSRecord } = require('./cr-dns-record-update.js')
const { checkDomainPriceOnline } = require('./cr-domain-price-get.js')
const domainService = require('./domain-service.js')
const dnsChecker = require('./dns-checker.js')

// Auto-check DNS after record add/update (non-blocking)
const dnsAutoCheck = async (send, chatId, t, domain, recordType, recordValue) => {
  try {
    const fqdn = domain
    const result = await dnsChecker.checkRecord(fqdn, recordType, recordValue)
    if (result.live) {
      const displayVal = result.answers?.[0]?.data || recordValue
      send(chatId, t.dnsRecordLive(recordType, displayVal), { parse_mode: 'HTML' })
    } else {
      send(chatId, t.dnsRecordPropagating(recordType), { parse_mode: 'HTML' })
    }
  } catch (e) {
    // Silent fail — don't block the user flow
  }
}
const { saveDomainInServerRailway, saveDomainInServerRender } = require('./rl-save-domain-in-server.js')
const { get, set, del, increment, atomicIncrement, getAll, decrement, insert } = require('./db.js')
const { getRegisteredDomainNames } = require('./cr-domain-purchased-get.js')
const { getCryptoDepositAddress, convert } = require('./pay-blockbee.js')
const { validateBulkNumbers, isRealPersonName } = require('./validatePhoneBulk.js')
const { countryCodeOf, areasOfCountry } = require('./areasOfCountry.js')
const { validatePhoneBulkFile } = require('./validatePhoneBulkFile.js')
const createCustomShortUrlCuttly = require('./customCuttly.js')
const schedule = require('node-schedule')
const loyalty = require('./loyalty-service.js')
const { registerDomainAndCreateCpanel } = require('./cr-register-domain-&-create-cpanel.js')
const { isEmail } = require('validator')
const { 
  getDynopayCryptoAddress,
} = require('./pay-dynopay.js')
const { translation } = require('./translation.js')
const { safeStringify } = require('./utils.js')
const { 
  fetchAvailableCountries,
  fetchAvailableRegionsOfCountry,
  fetchAvailableZones,
  createVPSInstance,
  sendVPSCredentialsEmail,
  getExpiryDateVps,
  changeVpsInstanceStatus,
  fetchAvailableDiskTpes,
  fetchAvailableOS,
  registerVpsTelegram,
  fetchUserSSHkeyList,
  generateNewSSHkey,
  uploadSSHPublicKey,
  fetchAvailableVPSConfigs,
  fetchSelectedCpanelOptions,
  attachSSHKeysToVM,
  fetchUserVPSList,
  fetchVPSDetails,
  deleteVPSinstance,
  setVpsSshCredentials,
  unlinkSSHKeyFromVps,
  changeVpsAutoRenewal,
  downloadSSHKeyFile,
  checkMissingEmailForNameword,
  addUserEmailForNameWord,
  getVpsUpgradePrice,
  upgradeVPSPlanType,
  fetchVpsUpgradeOptions,
  upgradeVPSDiskType,
  renewVPSPlan,
  renewVPSCPanel
} = require('./vm-instance-setup.js')
const { console } = require('inspector')
const BROADCAST_CONFIG = require('./broadcast-config.js')
const { initAutoPromo } = require('./auto-promo.js')
const { initDailyCoupons } = require('./daily-coupons.js')
const telnyxApi = require('./telnyx-service.js')
const twilioService = require('./twilio-service.js')
const { handleInboundSms, initSmsLimits } = require('./sms-service.js')
const { handleVoiceWebhook, initVoiceService, getIvrAnalytics, incrementSmsUsed, isSmsLimitReached, pendingBridges } = require('./voice-service.js')
const { initCnamService, lookupCnam, batchLookupCnam } = require('./cnam-service.js')
const phoneConfig = require('./phone-config.js')
const ttsService = require('./tts-service.js')
const { initPhoneScheduler } = require('./phone-scheduler.js')
const crAutoWhitelist = require('./cr-auto-whitelist.js')
const { initScheduler: initHostingScheduler } = require('./hosting-scheduler.js')
const { initPhoneTestRoutes, generateTestOtp, checkTestCredentialCall, getOrCreateReferralCode, trackReferral } = require('./phone-test-routes.js')
const antiRedService = require('./anti-red-service.js')

process.env['NTBA_FIX_350'] = 1

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Twilio address / surcharge helpers (module-scope for use in both loadData & bot.on)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function needsTwilioAddress(countryCode, provider) {
  if (provider !== 'twilio') return false
  const cc = twilioService.NO_COMPLIANCE_COUNTRIES.find(c => c.code === countryCode)
  return cc?.addrReq?.includes('any') || cc?.addrReq?.includes('local') || false
}

function getAddressLocationText(countryCode) {
  const cc = twilioService.NO_COMPLIANCE_COUNTRIES.find(c => c.code === countryCode)
  if (cc?.addrReq?.includes('local')) return { type: 'local', text: `must be located in <b>${cc.name.replace(/^.{1,4}\s/, '')}</b>` }
  if (cc?.addrReq?.includes('any')) return { type: 'any', text: 'can be from <b>any country</b> worldwide' }
  return null
}

// Get number monthly cost surcharge (>= $5 = surcharge, < $5 = free with plan)
function getNumberSurcharge(countryCode, numberType) {
  const cc = twilioService.NO_COMPLIANCE_COUNTRIES.find(c => c.code === countryCode)
  const monthlyPrice = cc?.prices?.[numberType] || 0
  return monthlyPrice >= twilioService.NUMBER_COST_FREE_THRESHOLD ? monthlyPrice : 0
}

// Load environment variables from .env file first
require('dotenv').config()
const DB_NAME = process.env.DB_NAME
const SELF_URL = process.env.SELF_URL
const NOT_TRY_CR = process.env.NOT_TRY_CR
const RATE_LEAD = Number(process.env.RATE_LEAD)
const PRICE_BITLY_LINK = Number(process.env.PRICE_BITLY_LINK)
const RATE_LEAD_VALIDATOR = Number(process.env.RATE_LEAD_VALIDATOR)
const RATE_CNAM_VALIDATOR = Number(process.env.RATE_CNAM_VALIDATOR)
const FREE_LINKS = Number(process.env.FREE_LINKS)
const HOSTED_ON = process.env.HOSTED_ON

const CHAT_BOT_NAME = process.env.CHAT_BOT_NAME
const REST_APIS_ON = process.env.REST_APIS_ON
const TELEGRAM_BOT_ON = process.env.TELEGRAM_BOT_ON
const BLOCKBEE_CRYTPO_PAYMENT_ON = process.env.BLOCKBEE_CRYTPO_PAYMENT_ON
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_DEV_CHAT_ID = process.env.TELEGRAM_DEV_CHAT_ID
const TELEGRAM_ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID
const FREE_LINKS_TIME_SECONDS = Number(process.env.FREE_LINKS_TIME_SECONDS) * 1000 // to milliseconds
const TELEGRAM_DOMAINS_SHOW_CHAT_ID = Number(process.env.TELEGRAM_DOMAINS_SHOW_CHAT_ID)
const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 5)

// HOSTING ENVIRONMENT
const PREMIUM_ANTIRED_WEEKLY_PRICE = parseFloat(process.env.PREMIUM_ANTIRED_WEEKLY_PRICE)
const GOLDEN_ANTIRED_CPANEL_PRICE = parseFloat(process.env.GOLDEN_ANTIRED_CPANEL_PRICE)
const PREMIUM_ANTIRED_CPANEL_PRICE = parseFloat(process.env.PREMIUM_ANTIRED_CPANEL_PRICE)
const VPS_HOURLY_PLAN_MINIMUM_AMOUNT_PAYABLE = parseFloat(process.env.VPS_HOURLY_PLAN_MINIMUM_AMOUNT_PAYABLE)
const HOSTING_TRIAL_PLAN_ON = process.env.HOSTING_TRIAL_PLAN_ON

if (!DB_NAME || !RATE_LEAD_VALIDATOR || !HOSTED_ON || !TELEGRAM_BOT_ON || !REST_APIS_ON || !CHAT_BOT_NAME) {
  return log('Service is paused because some ENV variable is missing')
}

let bot

// Initialize bot with webhooks (no polling)
if (TELEGRAM_BOT_ON === 'true') {
  bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { webHook: false })
  log('TELEGRAM_BOT_ON: ' + TELEGRAM_BOT_ON)
  log('Bot initialized with webhook support')
  log('Bot ran away! ' + new Date())
} else {
  bot = {
    on: () => {
    }, sendMessage: () => {
    }, sendPhoto: () => {
    }, sendDocument: () => {
    }, processUpdate: () => {
    },
  }
  log('TELEGRAM_BOT_ON: ' + TELEGRAM_BOT_ON)
  log('Bot ran away! ' + new Date())
}

// Auto-detect when bot is added to or removed from groups
bot?.on('my_chat_member', async update => {
  try {
    const chat = update.chat
    const newStatus = update.new_chat_member?.status
    const chatType = chat?.type

    if (chatType !== 'group' && chatType !== 'supergroup') return

    if (newStatus === 'member' || newStatus === 'administrator') {
      // Bot was added to a group — register it
      if (notifyGroupsCol?.updateOne) {
        await notifyGroupsCol.updateOne(
          { _id: chat.id },
          { $set: { _id: chat.id, title: chat.title, addedAt: new Date().toISOString() } },
          { upsert: true }
        )
        log('Registered group for notifications: ' + chat.title + ' (' + chat.id + ')')
        bot?.sendMessage(chat.id, `${CHAT_BOT_NAME} is now active in this group! You will receive live event notifications here.`)?.catch(() => {})
      }
    } else if (newStatus === 'left' || newStatus === 'kicked') {
      // Bot was removed from a group — unregister it
      if (notifyGroupsCol?.deleteOne) {
        await notifyGroupsCol.deleteOne({ _id: chat.id })
        log('Unregistered group from notifications: ' + chat.title + ' (' + chat.id + ')')
      }
    }
  } catch (e) {
    log('my_chat_member handler error: ' + e.message)
  }
})

const send = (chatId, message, options) => {

// Unified coupon validator — checks static codes + daily auto-generated codes
async function resolveCoupon(code, chatId) {
  // 1. Check static coupons first
  const staticDiscount = discountOn[code]
  if (!isNaN(staticDiscount)) return { discount: staticDiscount, type: 'static' }

  // 2. Check daily auto-generated coupons
  if (dailyCouponSystem) {
    const result = await dailyCouponSystem.validateDailyCoupon(code, chatId)
    if (result?.error === 'already_used') return { error: 'already_used' }
    if (result?.discount) return { discount: result.discount, type: 'daily', code }
  }

  return null
}
  // Auto-detect HTML in message and add parse_mode if not already set
  const opts = options || {}
  if (typeof message === 'string' && !opts.parse_mode && /<\/?(?:b|i|u|s|code|pre|a)\b/.test(message)) {
    opts.parse_mode = 'HTML'
  }
  // Cross-device: auto-inject resize_keyboard for all custom keyboards
  if (opts?.reply_markup?.keyboard && !opts.reply_markup.resize_keyboard) {
    opts.reply_markup.resize_keyboard = true
  }
  log('reply: ' + message + ' ' + (opts?.reply_markup?.keyboard?.map(i => i) || '') + '\tto: ' + chatId + '\n')
  bot?.sendMessage(chatId, message, opts)?.catch(e => log(e.message + ': ' + chatId))
}

// Mask username: show first 2 chars + ***
const maskName = name => {
  if (!name || typeof name !== 'string') return 'User***'
  return name.length <= 2 ? name + '***' : name.slice(0, 2) + '***'
}

// Send event notification to all registered groups + configured fallback targets
const TELEGRAM_NOTIFY_GROUP_ID = process.env.TELEGRAM_NOTIFY_GROUP_ID
const notifyGroup = async (message) => {
  try {
    const taggedMessage = message + `\n— <b>${CHAT_BOT_NAME}</b>`
    const sentTo = new Set()

    // 1. Always send to configured notification group (if set)
    if (TELEGRAM_NOTIFY_GROUP_ID) {
      const gid = Number(TELEGRAM_NOTIFY_GROUP_ID)
      sentTo.add(gid)
      bot?.sendMessage(gid, taggedMessage, { parse_mode: 'HTML' })?.catch(e => {
        log('Configured notify group error (' + gid + '): ' + e.message)
      })
    }

    // 2. Always send to admin chat as fallback
    if (TELEGRAM_ADMIN_CHAT_ID && !sentTo.has(Number(TELEGRAM_ADMIN_CHAT_ID))) {
      sentTo.add(Number(TELEGRAM_ADMIN_CHAT_ID))
      bot?.sendMessage(TELEGRAM_ADMIN_CHAT_ID, taggedMessage, { parse_mode: 'HTML' })?.catch(e => {
        log('Admin notify error: ' + e.message)
      })
    }

    // 3. Send to all auto-registered groups from notifyGroups collection
    if (notifyGroupsCol?.find) {
      const groups = await notifyGroupsCol.find({}).toArray()
      for (const group of groups) {
        if (sentTo.has(group._id)) continue // skip duplicates
        sentTo.add(group._id)
        bot?.sendMessage(group._id, taggedMessage, { parse_mode: 'HTML' })?.catch(e => {
          log('Group notify error for ' + group._id + ': ' + e.message)
          if (e.message?.includes('bot was kicked') || e.message?.includes('chat not found') || e.message?.includes('bot is not a member')) {
            notifyGroupsCol.deleteOne({ _id: group._id })
            log('Removed group ' + group._id + ' from notifyGroups')
          }
        })
      }
    }
  } catch (e) {
    log('notifyGroup error: ' + e.message)
  }
}

// variables to implement core functionality
let state = {},
  walletOf = {},
  linksOf = {},
  expiryOf = {},
  fullUrlOf = {},
  maskOf = {},
  domainsOf = {},
  chatIdBlocked = {},
  planEndingTime = {},
  chatIdOfPayment = {},
  chatIdOfDynopayPayment = {},
  vpsPlansOf = {},
  totalShortLinks = {},
  freeShortLinksOf = {},
  freeSmsCountOf = {},
  clicksOfSms = {},
  freeDomainNamesAvailableFor = {},
  freeValidationsAvailableFor = {},
  hostingTransactions = {},
  vpsTransactions = {},
  notifyGroupsCol = {},
  phoneNumbersOf = {},
  phoneTransactions = {},
  phoneLogs = {},
  ivrAnalytics = {},
  cnamCache = {}
  let digitalOrdersCol = {}


// variables to view system information
let nameOf = {},
  planOf = {},
  payments = {},
  clicksOf = {},
  clicksOn = {},
  loginCountOf = {},
  chatIdOf = {},
  canLogin = {}

// Support chat & lead request collections
let supportSessions = {},
  leadRequests = {},
  cpanelAccounts = {}

// Daily coupon system reference
let dailyCouponSystem = null

// some info to use with bot
let adminDomains = [],
  connect_reseller_working = true,
  ip_whitelist_message_sent = false,
  last_cr_check_time = 0

let autoPromo = null

// Telnyx resources (set during init)
let telnyxResources = { sipConnectionId: null, messagingProfileId: null, callControlAppId: null }
let twilioResources = { sipDomainSid: null, sipDomainName: null, credentialListSid: null, accountSid: null }

// restoreData(); // can be use when there is no db

let db
const loadData = async () => {
  db = client.db(DB_NAME)

  // variables to implement core functionality
  state = db.collection('state')
  linksOf = db.collection('linksOf')
  walletOf = db.collection('walletOf')
  expiryOf = db.collection('expiryOf')
  maskOf = db.collection('maskOf')
  fullUrlOf = db.collection('fullUrlOf')
  domainsOf = db.collection('domainsOf')
  loginCountOf = db.collection('loginCountOf')
  canLogin = db.collection('canLogin')
  chatIdBlocked = db.collection('chatIdBlocked')
  planEndingTime = db.collection('planEndingTime')
  chatIdOfPayment = db.collection('chatIdOfPayment')
  chatIdOfDynopayPayment = db.collection('chatIdOfDynopayPayment')
  vpsPlansOf = db.collection('vpsPlansOf')
  totalShortLinks = db.collection('totalShortLinks')
  freeShortLinksOf = db.collection('freeShortLinksOf')
  freeSmsCountOf = db.collection('freeSmsCountOf')
  clicksOfSms = db.collection('clicksOfSms')
  hostingTransactions = db.collection('hostingTransactions')
  vpsTransactions = db.collection('vpsTransactions')
  notifyGroupsCol = db.collection('notifyGroups')
  phoneNumbersOf = db.collection('phoneNumbersOf')
  phoneTransactions = db.collection('phoneTransactions')
  phoneLogs = db.collection('phoneLogs')
  ivrAnalytics = db.collection('ivrAnalytics')
  cnamCache = db.collection('cnamCache')
  digitalOrdersCol = db.collection('digitalOrders')

  freeDomainNamesAvailableFor = db.collection('freeDomainNamesAvailableFor')
  freeValidationsAvailableFor = db.collection('freeValidationsAvailableFor')
  supportSessions = db.collection('supportSessions')
  leadRequests = db.collection('leadRequests')
  cpanelAccounts = db.collection('cpanelAccounts')

  // variables to view system information
  nameOf = db.collection('nameOf')
  planOf = db.collection('planOf')
  payments = db.collection('payments')
  clicksOf = db.collection('clicksOf')
  clicksOn = db.collection('clicksOn')
  chatIdOf = db.collection('chatIdOf')

  log(`DB Connected lala. May peace be with you and Lord's mercy and blessings.`)

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Shared Twilio Purchase Helper — used by wallet, bank, crypto flows
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  async function executeTwilioPurchase(chatId, selectedNumber, planKey, price, countryCode, countryName, numType, paymentMethod, addressSid) {
    const plan = phoneConfig.plans[planKey]
    const name = await get(nameOf, chatId)
    const surcharge = getNumberSurcharge(countryCode, numType)

    // 1. Get or create sub-account
    let userData = await get(phoneNumbersOf, chatId)
    let subSid = userData?.twilioSubAccountSid
    let subToken = userData?.twilioSubAccountToken

    if (!subSid) {
      const subAccount = await twilioService.createSubAccount(`Nomadly-${chatId}-${name || 'user'}`)
      if (subAccount.error) return { error: `Could not create phone account: ${subAccount.error}` }
      subSid = subAccount.accountSid
      subToken = subAccount.authToken
      if (userData) {
        userData.twilioSubAccountSid = subSid
        userData.twilioSubAccountToken = subToken
        await set(phoneNumbersOf, chatId, userData)
      } else {
        await set(phoneNumbersOf, chatId, { numbers: [], twilioSubAccountSid: subSid, twilioSubAccountToken: subToken })
      }
    }

    // 2. Buy number on main account with optional address
    const buyResult = await twilioService.buyNumber(selectedNumber, null, null, SELF_URL, addressSid || null)
    if (buyResult.error) return { error: buyResult.error }

    // 3. Transfer to sub-account
    if (subSid && buyResult.sid) {
      const transferResult = await twilioService.transferNumberToSubAccount(buyResult.sid, subSid)
      if (transferResult.success) {
        log(`[CloudPhone] Number ${selectedNumber} transferred to sub-account ${subSid}`)
        await twilioService.updateSubAccountNumberWebhooks(subSid, buyResult.sid, SELF_URL)
      }
    }

    // 4. SIP credentials (dual: Twilio + Telnyx)
    let sipUsername = phoneConfig.generateSipUsername()
    let sipPassword = phoneConfig.generateSipPassword()
    if (telnyxResources?.sipConnectionId) {
      const telnyxCred = await telnyxApi.createSIPCredential(telnyxResources.sipConnectionId, sipUsername, sipPassword)
      if (telnyxCred?.sip_username) {
        sipUsername = telnyxCred.sip_username
        sipPassword = telnyxCred.sip_password || sipPassword
        log(`[CloudPhone] Using Telnyx-generated SIP credentials: ${sipUsername}`)
      }
    }
    if (twilioResources?.credentialListSid) {
      await twilioService.addSipCredential(twilioResources.credentialListSid, sipUsername, sipPassword)
    }

    // 5. Save to DB
    const expiresAt = new Date()
    expiresAt.setMonth(expiresAt.getMonth() + 1)
    const numberDoc = {
      phoneNumber: selectedNumber,
      telnyxOrderId: null,
      twilioNumberSid: buyResult.sid,
      twilioSubAccountSid: (await get(phoneNumbersOf, chatId))?.twilioSubAccountSid || null,
      provider: 'twilio',
      country: countryCode,
      countryName: countryName,
      type: numType || 'local',
      plan: planKey,
      planPrice: price,
      purchaseDate: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      autoRenew: true,
      status: 'active',
      sipUsername,
      sipPassword,
      sipDomain: phoneConfig.SIP_DOMAIN,
      messagingProfileId: null,
      connectionId: null,
      addressSid: addressSid || null,
      numberSurcharge: surcharge,
      smsUsed: 0,
      minutesUsed: 0,
      features: {
        sms: true,
        callForwarding: { enabled: false, mode: 'disabled', forwardTo: null, ringTimeout: 25 },
        voicemail: { enabled: false, greetingType: 'default', customGreetingUrl: null, forwardToTelegram: true, forwardToEmail: null, ringTimeout: 25 },
        smsForwarding: { toTelegram: true, toEmail: null, webhookUrl: null },
        recording: false,
      }
    }

    userData = await get(phoneNumbersOf, chatId)
    if (userData?.numbers) { userData.numbers.push(numberDoc) }
    else { userData = userData || {}; userData.numbers = [numberDoc] }
    await set(phoneNumbersOf, chatId, userData)

    await phoneTransactions.insertOne({ chatId, phoneNumber: selectedNumber, action: 'purchase', plan: planKey, amount: price, paymentMethod, timestamp: new Date().toISOString() })
    notifyGroup(phoneConfig.txt.adminPurchase(maskName(name), selectedNumber, plan?.name || planKey, price, paymentMethod))

    return { success: true, sipUsername, sipPassword, expiresAt, plan }
  }

  // Get or create cached Twilio address for a country
  async function getCachedTwilioAddress(chatId, countryCode) {
    const userData = await get(phoneNumbersOf, chatId)
    return userData?.twilioAddresses?.[countryCode] || null
  }

  async function cacheTwilioAddress(chatId, countryCode, addressSid) {
    const userData = await get(phoneNumbersOf, chatId) || {}
    if (!userData.twilioAddresses) userData.twilioAddresses = {}
    userData.twilioAddresses[countryCode] = addressSid
    await set(phoneNumbersOf, chatId, userData)
  }

  // needsTwilioAddress, getAddressLocationText, getNumberSurcharge — moved to module scope (line ~221)

  //
  // sendMessage(6687923716, 'bot started')
  // buyDomainFullProcess(6687923716, 'ehtesham.sbs')

  // set(freeShortLinksOf, 6687923716, 20)
  // Bohut zalil karaya is galat line nai : await set(wallet **** 00)
  // {
  //   await del(walletOf, 6687923716)
  //   await set(walletOf, 6687923716, 'usdIn', 100)
  //   await set(walletOf, 6687923716, 'ngnIn', 100000)
  //   const w = await get(walletOf, 6687923716)
  //   log({ w })
  // }
  // {
  //   await del(walletOf, 5590563715)
  //   await set(walletOf, 5590563715, 'usdIn', 100)
  //   await set(walletOf, 5590563715, 'ngnIn', 100000)
  //   const w = await get(walletOf, 5590563715)
  //   log({ w })
  // }

  // 5590563715, 5168006768 chat id client
  // 6687923716 chat id testing
  // set(walletOf, 6687923716, { usdIn: 100, ngnIn: 100000 })
  // set(planEndingTime, 6687923716, 0)
  // set(freeShortLinksOf, 6687923716, FREE_LINKS)
  // adminDomains = await getPurchasedDomains(TELEGRAM_DOMAINS_SHOW_CHAT_ID)

  // Initialize auto-promo system only when Telegram bot is actually enabled
  if (TELEGRAM_BOT_ON === 'true') {
    autoPromo = initAutoPromo(bot, db, nameOf, state)
    log('[AutoPromo] System loaded successfully')
    dailyCouponSystem = initDailyCoupons(db, bot, nameOf, state)
    log('[DailyCoupon] System loaded successfully')
    // Link coupon system to promo for coupon-in-promo messages
    autoPromo.setDailyCouponSystem(dailyCouponSystem)
  } else {
    log('[AutoPromo] Skipped — Telegram bot is disabled')
  }

  // Initialize Telnyx Cloud Phone resources
  if (process.env.TELNYX_API_KEY && process.env.PHONE_SERVICE_ON === 'true') {
    try {
      telnyxResources = await telnyxApi.initializeTelnyxResources(SELF_URL)
      log('[CloudPhone] Telnyx resources initialized')
    } catch (e) {
      log('[CloudPhone] Telnyx init error:', e.message)
    }
  } else {
    log('[CloudPhone] Skipped — TELNYX_API_KEY or PHONE_SERVICE_ON not set')
  }

  // Initialize Twilio Cloud Phone resources
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.PHONE_SERVICE_ON === 'true') {
    try {
      twilioResources = await twilioService.initializeTwilioResources(SELF_URL)
      if (twilioResources) {
        log(`[CloudPhone] Twilio initialized — SIP: ${twilioResources.sipDomainName}`)

        // Sync all Twilio number webhooks to current SELF_URL (runs in background)
        ;(async () => {
          try {
            const allUsers = await db.collection('phoneNumbersOf').find({}).toArray()
            let updated = 0, failed = 0
            for (const user of allUsers) {
              const numbers = (user.val?.numbers || []).filter(n => n.provider === 'twilio' && n.status === 'active' && n.twilioNumberSid)
              if (!numbers.length) continue
              const subSid = user.val?.twilioSubAccountSid
              const subToken = user.val?.twilioSubAccountToken
              for (const num of numbers) {
                try {
                  if (subSid && subToken) {
                    await twilioService.updateSubAccountNumberWebhooks(subSid, num.twilioNumberSid, SELF_URL)
                  } else {
                    await twilioService.updateNumberWebhooks(num.twilioNumberSid, SELF_URL)
                  }
                  updated++
                } catch (e) { failed++; log(`[Twilio Sync] Failed ${num.phoneNumber}: ${e.message}`) }
              }
            }
            log(`[Twilio Sync] Webhook sync complete: ${updated} updated, ${failed} failed`)
          } catch (e) { log(`[Twilio Sync] Error: ${e.message}`) }
        })()
      }
    } catch (e) {
      log('[CloudPhone] Twilio init error:', e.message)
    }
  }

  // Initialize Cloud Phone scheduler (expiry, usage tracking, monthly reset)
  if (process.env.PHONE_SERVICE_ON === 'true') {
    initPhoneScheduler({
      bot,
      phoneNumbersOf,
      phoneTransactions,
      phoneLogs,
      walletOf,
      payments,
      nameOf,
      notifyGroup,
      maskName,
      nanoid,
    })
    log('[CloudPhone] Scheduler initialized')
  }

  // Initialize Hosting Auto-Renew Scheduler
  initHostingScheduler({ bot, db, whmService: require('./whm-service.js') })
  log('[HostingScheduler] Initialized')

  // Initialize Voice Service (IVR, Recording, Call handling)
  if (process.env.PHONE_SERVICE_ON === 'true') {
    initVoiceService({
      bot,
      phoneNumbersOf,
      phoneLogs,
      telnyxApi,
      telnyxResources,
      ivrAnalytics,
      walletOf,
      payments,
      nanoid,
      twilioSipDomainName: twilioResources?.sipDomainName || null,
      selfUrl: SELF_URL,
    })
    log('[CloudPhone] Voice Service initialized with IVR + Recording + Overage')

    // Initialize Phone Test routes (Speechcue SIP test page)
    initPhoneTestRoutes(app, db, telnyxApi, telnyxResources.sipConnectionId)
  }

  // Initialize SMS Service limits (real-time enforcement)
  if (process.env.PHONE_SERVICE_ON === 'true') {
    initSmsLimits({
      incrementSmsUsed,
      isSmsLimitReached,
      walletOf,
      payments,
      nanoid,
      bot,
    })
    log('[CloudPhone] SMS Service limits initialized with overage billing')
  }

  // Initialize CNAM Service
  if (process.env.PHONE_SERVICE_ON === 'true') {
    initCnamService({ cnamCache })
    log('[CloudPhone] CNAM Service initialized')
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Scheduled auto-cleanup: reset stale user states every 6 hours
  // Users idle in a flow for >24h get reset to 'none' so they see fresh keyboards
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000 // 24 hours
  const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000 // every 6 hours

  async function cleanupStaleStates() {
    try {
      const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS)
      // Reset users who have a non-'none' action and whose lastUpdated is older than 24h
      const result = await state.updateMany(
        {
          action: { $exists: true, $ne: 'none' },
          $or: [
            { lastUpdated: { $lt: cutoff } },
            { lastUpdated: { $exists: false } } // legacy entries without timestamp
          ]
        },
        { $set: { action: 'none' } }
      )
      if (result.modifiedCount > 0) {
        log(`[StateCleanup] Reset ${result.modifiedCount} stale user states (idle >24h)`)
      }
    } catch (err) {
      log(`[StateCleanup] Error: ${err.message}`)
    }
  }

  // Run once on startup, then every 6 hours
  cleanupStaleStates()
  setInterval(cleanupStaleStates, CLEANUP_INTERVAL_MS)
  log(`[StateCleanup] Scheduled every ${CLEANUP_INTERVAL_MS / 3600000}h (stale threshold: ${STALE_THRESHOLD_MS / 3600000}h)`)
}

const client = new MongoClient(process.env.MONGO_URL, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  maxPoolSize: 10,
  minPoolSize: 2,
  maxIdleTimeMS: 15000,
  connectTimeoutMS: 20000,
  socketTimeoutMS: 30000,
  serverSelectionTimeoutMS: 20000,
  heartbeatFrequencyMS: 10000,
  retryWrites: true,
  retryReads: true,
  waitQueueTimeoutMS: 15000,
})

let isDbConnected = false

client.on('connectionPoolCleared', () => {
  log('⚠️ MongoDB connection pool cleared')
  isDbConnected = false
})

client.on('connectionPoolReady', () => {
  log('✅ MongoDB connection pool ready')
  isDbConnected = true
})

let consecutiveHeartbeatFailures = 0

client.on('serverHeartbeatFailed', (event) => {
  consecutiveHeartbeatFailures++
  // Only log every 3rd failure to reduce noise — single blips recover silently
  if (consecutiveHeartbeatFailures >= 3) {
    log(`❌ MongoDB heartbeat failed (${consecutiveHeartbeatFailures}x):`, event.failure?.message || 'unknown error')
  }
  isDbConnected = false
})

client.on('serverHeartbeatSucceeded', () => {
  if (!isDbConnected || consecutiveHeartbeatFailures > 0) {
    if (consecutiveHeartbeatFailures >= 3) {
      log(`✅ MongoDB heartbeat restored (was down for ${consecutiveHeartbeatFailures} beats)`)
    }
    isDbConnected = true
    consecutiveHeartbeatFailures = 0
  }
})

const connectWithRetry = async (retryCount = 0) => {
  const maxRetries = 5
  const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 30000)
  
  try {
    await client.connect()
    isDbConnected = true
    await loadData()
  } catch (err) {
    log(`❌ DB connection failed (attempt ${retryCount + 1}/${maxRetries}):`, err?.message)
    isDbConnected = false
    
    if (retryCount < maxRetries - 1) {
      log(`🔄 Retrying in ${retryDelay / 1000} seconds...`)
      setTimeout(() => connectWithRetry(retryCount + 1), retryDelay)
    } else {
      log('❌ Max retries reached. Please check your MongoDB connection.')
    }
  }
}

// Start Express server immediately so Railway health check passes while DB connects
// Note: startServer() will be called after all functions are defined at end of file

connectWithRetry()

const isDbHealthy = () => isDbConnected


async function sendRemindersForExpiringPackages() {
  const now = new Date()
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000)
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
  const threeDaysMinusFive = new Date(now.getTime() + (3 * 24 * 60 - 5) * 60 * 1000)

  try {
    // ── Freedom Plan: 1-hour reminder ──
    const users = await state.find({
      'currentPackage.name': 'Freedom Plan',
      'currentPackage.expiresAt': { $lte: oneHourFromNow, $gt: now },
      'reminders.beforeExpireReminderSent': false,
    }).toArray()

    for (const user of users) {
      const lang = user?.userLanguage ?? 'en'
      send(user._id, translation('t.oneHourLeftToExpireTrialPlan', lang))

      await state.updateOne(
        { _id: user._id },
        { $set: { 'reminders.beforeExpireReminderSent': true } },
      )
    }

    // ── Freedom Plan: expired ──
    const expiredUsers = await state.find({
      'currentPackage.name': 'Freedom Plan',
      'currentPackage.expiresAt': { $lte: now },
      'reminders.expireReminderSent': false,
      'currentPackage.isActive': true,
    }).toArray()

    for (const user of expiredUsers) {
      const lang = user?.userLanguage ?? 'en'
      send(user._id, translation('t.freePlanExpired', lang))

      await state.updateOne(
        { _id: user._id },
        {
          $set: {
            'reminders.expireReminderSent': true,
            'currentPackage.isActive': false,
          },
        },
      )
    }

    // ── Bot Plan (Daily/Weekly/Monthly): 3-day expiry reminder ──
    try {
      const allPlanUsers = await planEndingTime.find({}).toArray()
      for (const entry of allPlanUsers) {
        const chatId = entry._id
        const rawTime = entry.val
        if (!rawTime || rawTime <= now.getTime()) continue

        const msLeft = rawTime - now.getTime()
        const daysLeft = msLeft / (1000 * 60 * 60 * 24)

        // Send 3-day reminder (check within 2.9 - 3.1 day window)
        if (daysLeft > 2.9 && daysLeft <= 3.1) {
          const userState = await state.findOne({ _id: String(chatId) })
          if (userState?.reminders?.botPlan3DayReminderSent) continue

          const plan = await get(planOf, chatId)
          if (!plan) continue
          const lang = userState?.userLanguage ?? 'en'
          const expiryDate = new Date(rawTime).toLocaleDateString()

          const msgs = {
            en: `📋 <b>Subscription Expiring Soon</b>\n\n📦 ${plan} expires in <b>3 days</b> (${expiryDate}).\n\nRenew now to keep your benefits active.`,
            fr: `📋 <b>Abonnement bientôt expiré</b>\n\n📦 ${plan} expire dans <b>3 jours</b> (${expiryDate}).\n\nRenouvelez pour garder vos avantages.`,
            hi: `📋 <b>सदस्यता जल्द समाप्त</b>\n\n📦 ${plan} <b>3 दिनों</b> में समाप्त होगा (${expiryDate}).\n\nअभी नवीनीकरण करें।`,
            zh: `📋 <b>订阅即将到期</b>\n\n📦 ${plan} 将在 <b>3天</b> 后到期 (${expiryDate})。\n\n请立即续订。`,
          }
          send(chatId, msgs[lang] || msgs.en, { parse_mode: 'HTML' })
          await state.updateOne(
            { _id: String(chatId) },
            { $set: { 'reminders.botPlan3DayReminderSent': true } },
            { upsert: true }
          )
          log(`[Reminders] 3-day bot plan reminder sent to ${chatId}`)
        }

        // Reset the flag when user renews (days > 3.5)
        if (daysLeft > 3.5) {
          await state.updateOne(
            { _id: String(chatId) },
            { $set: { 'reminders.botPlan3DayReminderSent': false } },
          )
        }
      }
    } catch (e) {
      console.error('Error in bot plan reminders:', e.message)
    }

    // ── VPS Plans: 3-day expiry reminder ──
    try {
      const allVps = await vpsPlansOf.find({}).toArray()
      for (const entry of allVps) {
        const chatId = entry._id
        const plans = entry.val?.plans || entry.plans || []
        for (const vps of plans) {
          if (vps.status !== 'active') continue
          const expiresAt = vps.expiresAt || vps.subscriptionEnd
          if (!expiresAt) continue

          const msLeft = new Date(expiresAt).getTime() - now.getTime()
          const daysLeft = msLeft / (1000 * 60 * 60 * 24)

          if (daysLeft > 2.9 && daysLeft <= 3.1 && !vps._reminder3DaySent) {
            const userState = await state.findOne({ _id: String(chatId) })
            const lang = userState?.userLanguage ?? 'en'
            const name = vps.name || vps.hostname || 'VPS'
            const expiryDate = new Date(expiresAt).toLocaleDateString()

            const msgs = {
              en: `🖥️ <b>VPS Expiring Soon</b>\n\n${name} expires in <b>3 days</b> (${expiryDate}).\nRenew to avoid service interruption.`,
              fr: `🖥️ <b>VPS bientôt expiré</b>\n\n${name} expire dans <b>3 jours</b> (${expiryDate}).\nRenouvelez pour éviter l'interruption.`,
              hi: `🖥️ <b>VPS जल्द समाप्त</b>\n\n${name} <b>3 दिनों</b> में समाप्त (${expiryDate}).\nनवीनीकरण करें।`,
              zh: `🖥️ <b>VPS即将到期</b>\n\n${name} 将在 <b>3天</b> 后到期 (${expiryDate})。\n请续订。`,
            }
            send(chatId, msgs[lang] || msgs.en, { parse_mode: 'HTML' })
            vps._reminder3DaySent = true
            await vpsPlansOf.updateOne(
              { _id: chatId },
              { $set: { [`val.plans`]: plans } }
            )
            log(`[Reminders] 3-day VPS reminder sent to ${chatId} for ${name}`)
          }
        }
      }
    } catch (e) {
      console.error('Error in VPS reminders:', e.message)
    }

  } catch (error) {
    console.error('Error sending reminders:', error)
  }
}

schedule.scheduleJob('*/5 * * * *', function() {
  sendRemindersForExpiringPackages()
})

// ─── Periodic Anti-Red Worker deployment (fail-safe) ────
// Runs every 6 hours to catch any CF-proxied domains missing the Worker route
const { deploySharedWorkerRoute } = require('./anti-red-service')

schedule.scheduleJob('0 */6 * * *', async function() {
  try {
    log('[AntiRed-Cron] Starting periodic Worker route check...')
    const domains = []
    const cursor = db.collection('registeredDomains').find()
    while (await cursor.hasNext()) {
      const doc = await cursor.next()
      const val = doc.val || {}
      if (val.cfZoneId && val.nameserverType === 'cloudflare') {
        domains.push({ domain: String(doc._id), zoneId: val.cfZoneId })
      }
    }
    log(`[AntiRed-Cron] Found ${domains.length} CF-proxied domains`)

    let deployed = 0, already = 0, failed = 0
    for (const { domain, zoneId } of domains) {
      const result = await deploySharedWorkerRoute(domain, zoneId)
      if (result.success) {
        if (result.status === 'already_deployed') already++
        else deployed++
      } else {
        failed++
        log(`[AntiRed-Cron] Failed for ${domain}: ${result.error || 'unknown'}`)
      }
      // Rate limit: 100ms between API calls
      await new Promise(r => setTimeout(r, 100))
    }
    log(`[AntiRed-Cron] Done. Deployed: ${deployed}, Already: ${already}, Failed: ${failed}`)
  } catch (err) {
    log(`[AntiRed-Cron] Error: ${err.message}`)
  }
})

bot?.on('message', async msg => {
  const chatId = msg?.chat?.id
  const chatType = msg?.chat?.type
  const isGroupChat = chatType === 'group' || chatType === 'supergroup'
  let message = msg?.text || ''
  
  // Auto-register group for event notifications if not already registered
  // Then ignore the message (bot only sends notifications to groups, never responds)
  if (isGroupChat) {
    if (notifyGroupsCol?.updateOne && chatId) {
      notifyGroupsCol.updateOne(
        { _id: chatId },
        { $set: { _id: chatId, title: msg?.chat?.title || 'Unknown Group', addedAt: new Date().toISOString(), source: 'auto-detected' } },
        { upsert: true }
      ).then(() => {
        log(`[NotifyGroups] Auto-registered group: ${msg?.chat?.title} (${chatId})`)
      }).catch(() => {})
    }
    return
  }

  // ── Handle voice/audio messages for voicemail custom greeting ──
  if ((msg?.voice || msg?.audio) && chatId) {
    const userInfo = await get(state, chatId)
    if (userInfo?.action === 'cpVmAudioUpload') {
      try {
        const fileId = msg.voice?.file_id || msg.audio?.file_id
        const fileLink = await bot.getFileLink(fileId)
        const infoData = await get(state, chatId + '_info')
        const num = infoData?.cpActiveNumber
        if (num) {
          const vm = num.features?.voicemail || {}
          vm.greetingType = 'custom'
          vm.customAudioGreetingUrl = fileLink
          vm.customGreetingText = null
          await updatePhoneNumberFeature(phoneNumbersOf, chatId, num.phoneNumber, 'voicemail', vm)
          num.features.voicemail = vm
          await set(state, chatId + '_info', { ...infoData, cpActiveNumber: num })
          const pc = phoneConfig.btn
          send(chatId, phoneConfig.txt.vmAudioSaved)
          await set(state, chatId, { ...userInfo, action: 'cpVoicemail' })
          const btns = vm.enabled
            ? [['🔊 Greeting'],
               ['📲 VM to Telegram ' + (vm.forwardToTelegram !== false ? '✅ ON' : '❌ OFF')],
               ['📧 VM to Email ' + (vm.forwardToEmail ? '✅ ' + vm.forwardToEmail : '❌ OFF')],
               [`⏰ Ring Time: ${vm.ringTimeout || 25}s`],
               [pc.disableVoicemail]]
            : [[pc.enableVoicemail]]
          return send(chatId, phoneConfig.txt.voicemailMenu(num.phoneNumber, vm), { reply_markup: { keyboard: btns }, parse_mode: 'HTML' })
        }
      } catch (e) {
        log(`[Voice] Audio greeting upload error: ${e.message}`)
        return send(chatId, t.failedAudio)
      }
    }
    // If not in audio upload state, ignore voice/audio messages
    return
  }
  
  log('message: ' + message + '\tfrom: ' + chatId + ' ' + msg?.from?.username)

  // ═══════════════════════════════════════════════════
  // Admin support commands — /reply <chatId> <message> and /close <chatId>
  // Handled early so admin can reply from anywhere in the bot
  // ═══════════════════════════════════════════════════
  if (isAdmin(chatId) && message.startsWith('/reply ')) {
    const parts = message.substring(7).split(' ')
    const targetChatId = Number(parts[0])
    const replyText = parts.slice(1).join(' ')
    if (!targetChatId || !replyText) {
      return send(chatId, '⚠️ Usage: /reply <chatId> <message>')
    }
    const targetName = await get(nameOf, targetChatId)
    send(targetChatId, `💬 <b>Support:</b>\n${replyText}`, { parse_mode: 'HTML', reply_markup: { keyboard: [['/done']], resize_keyboard: true } })
    send(chatId, `✅ Reply sent to ${targetName || targetChatId}`)
    // Re-open support session so user's next message goes to admin
    await set(supportSessions, targetChatId, Date.now())
    await set(state, targetChatId, 'action', 'supportChat')
    log(`[Support] Admin replied to ${targetChatId}: ${replyText} — session re-opened`)
    return
  }

  if (isAdmin(chatId) && message.startsWith('/close ')) {
    const targetChatId = Number(message.substring(7).trim())
    if (!targetChatId) return send(chatId, '⚠️ Usage: /close <chatId>')
    const session = await get(supportSessions, targetChatId)
    if (session) {
      await set(supportSessions, targetChatId, 0)
      // Reset user action if they're still in support mode
      const userInfo = await get(state, targetChatId)
      if (userInfo?.action === 'supportChat') {
        await set(state, targetChatId, 'action', 'none')
      }
    }
    const targetName = await get(nameOf, targetChatId)
    send(targetChatId, '✅ Support session closed. Use the menu below to continue.', translation('o', 'en'))
    send(chatId, `✅ Closed support session for ${targetName || targetChatId}`)
    log(`[Support] Admin closed session for ${targetChatId}`)
    return
  }

  // Admin: /deliver <orderId> <product details> — deliver digital product to buyer
  if (isAdmin(chatId) && message.startsWith('/deliver ')) {
    const parts = message.substring(9).split(' ')
    const orderId = parts[0]
    const deliveryText = parts.slice(1).join(' ')
    if (!orderId || !deliveryText) {
      return send(chatId, '⚠️ Usage: /deliver <orderId> <product details/credentials>')
    }
    try {
      const order = await digitalOrdersCol.findOne({ orderId })
      if (!order) return send(chatId, `⚠️ Order <code>${orderId}</code> not found.`, { parse_mode: 'HTML' })
      if (order.status === 'delivered') return send(chatId, `⚠️ Order <code>${orderId}</code> was already delivered.`, { parse_mode: 'HTML' })

      // Send product to buyer
      send(order.chatId, `📦 <b>Order Delivered!</b>\n\n🆔 Order: <code>${orderId}</code>\n🛒 Product: <b>${order.product}</b>\n\n<b>Your product details:</b>\n${deliveryText}\n\nThank you for your purchase! For any issues, contact support.`, { parse_mode: 'HTML' })

      // Update order status
      await digitalOrdersCol.updateOne({ orderId }, { $set: { status: 'delivered', deliveredAt: new Date(), deliveryContent: deliveryText } })

      const buyerName = order.name || order.chatId
      send(chatId, `✅ Order <code>${orderId}</code> delivered to ${buyerName} (${order.chatId}).\nProduct: ${order.product}`, { parse_mode: 'HTML' })
      log(`[DigitalProducts] Admin delivered order ${orderId} to ${order.chatId}`)
    } catch (e) {
      send(chatId, `❌ Error delivering order: ${e.message}`)
      log(`[DigitalProducts] Deliver error: ${e.message}`)
    }
    return
  }

  // Admin: /orders — list pending digital product orders
  if (isAdmin(chatId) && message === '/orders') {
    try {
      const pending = await digitalOrdersCol.find({ status: 'pending' }).sort({ createdAt: -1 }).limit(20).toArray()
      if (pending.length === 0) return send(chatId, '📦 No pending digital product orders.')
      let msg = `📦 <b>Pending Orders (${pending.length})</b>\n\n`
      for (const o of pending) {
        const age = Math.round((Date.now() - new Date(o.createdAt).getTime()) / 60000)
        msg += `🆔 <code>${o.orderId}</code>\n👤 ${o.name || o.chatId} (${o.chatId})\n📦 ${o.product} — $${o.price}\n⏱ ${age}m ago\n📩 <code>/deliver ${o.orderId} [details]</code>\n\n`
      }
      send(chatId, msg, { parse_mode: 'HTML' })
    } catch (e) {
      send(chatId, `❌ Error: ${e.message}`)
    }
    return
  }

  // Admin: /requests — list pending lead requests
  if (isAdmin(chatId) && message === '/requests') {
    try {
      const allRequests = await leadRequests.find({}).toArray()
      const pending = allRequests.filter(r => r.val && r.val.status === 'pending')
      if (pending.length === 0) {
        return send(chatId, '📝 No pending lead requests.')
      }
      let msg = `📝 <b>Pending Lead Requests (${pending.length})</b>\n\n`
      pending.slice(0, 20).forEach((r, i) => {
        const v = r.val
        msg += `${i + 1}. <b>${v.target}</b> — ${v.city}\n   From: ${v.username} (${v.chatId})\n   Details: ${v.details || 'none'}\n   Date: ${v.createdAt?.slice(0, 10) || 'unknown'}\n   ID: <code>${r._id}</code>\n\n`
      })
      if (pending.length > 20) msg += `... and ${pending.length - 20} more`
      return send(chatId, msg, { parse_mode: 'HTML' })
    } catch (err) {
      return send(chatId, `Error fetching requests: ${err.message}`)
    }
  }

  // Admin: /credit <username|chatId> <amount> — credit USD to a user's wallet
  if (isAdmin(chatId) && message.startsWith('/credit ')) {
    const parts = message.substring(8).trim().split(/\s+/)
    if (parts.length < 2) {
      return send(chatId, '⚠️ Usage: /credit <@username or chatId> <amount>\n\nExamples:\n<code>/credit @john 50</code>\n<code>/credit 5590563715 25.50</code>', { parse_mode: 'HTML' })
    }
    const userRef = parts[0].replace('@', '')
    const amount = parseFloat(parts[1])
    if (isNaN(amount) || amount <= 0) {
      return send(chatId, '⚠️ Amount must be a positive number.')
    }
    try {
      let targetChatId = null
      let targetName = null

      // Check if userRef is a chatId (numeric) or username (string)
      if (/^\d+$/.test(userRef)) {
        targetChatId = Number(userRef)
        targetName = await get(nameOf, targetChatId)
      } else {
        // Lookup by username in nameOf collection
        const allNames = await nameOf.find({}).toArray()
        const match = allNames.find(n => typeof n.val === 'string' && n.val.toLowerCase() === userRef.toLowerCase())
        if (match) {
          targetChatId = match._id
          targetName = match.val
        }
      }

      if (!targetChatId) {
        return send(chatId, `⚠️ User <b>${userRef}</b> not found.`, { parse_mode: 'HTML' })
      }

      // Credit the wallet
      await addFundsTo(walletOf, targetChatId, 'usd', amount, 'en')
      const { usdBal, ngnBal } = await getBalance(walletOf, targetChatId)

      // Notify user
      sendMessage(targetChatId, `💰 <b>Wallet Credited!</b>\n\nYou received <b>$${amount.toFixed(2)} USD</b> from admin.\n\n💳 New Balance: <b>$${usdBal.toFixed(2)} USD</b>`, { parse_mode: 'HTML' })

      // Confirm to admin
      send(chatId, `✅ Credited <b>$${amount.toFixed(2)} USD</b> to <b>${targetName || 'Unknown'}</b> (${targetChatId})\n\n💳 Their balance: $${usdBal.toFixed(2)} USD / ₦${ngnBal.toFixed(2)} NGN`, { parse_mode: 'HTML' })
      log(`[Admin] Credited $${amount} to ${targetName || targetChatId} (${targetChatId})`)
    } catch (e) {
      send(chatId, `❌ Error crediting wallet: ${e.message}`)
      log(`[Admin] Credit error: ${e.message}`)
    }
    return
  }

  // Throttle Connect Reseller IP check to once per hour instead of every message
  const now_cr = Date.now()
  if (NOT_TRY_CR === undefined && now_cr - last_cr_check_time > 3600000) {
    last_cr_check_time = now_cr
    tryConnectReseller()
  }

  // License check cached at startup to avoid blocking every message

  if (!db) return send(chatId, 'Database is connecting, please try again in a moment')
  // ConnectReseller status never blocks the bot — domain ops fallback to OpenProvider
  if (!connect_reseller_working && NOT_TRY_CR === undefined) {
    tryConnectReseller() // non-blocking background retry
  }

  const nameOfChatId = await get(nameOf, chatId)
  const currentUsername = msg?.from?.username || null
  const username = currentUsername || nameOfChatId || nanoid()

  const blocked = await get(chatIdBlocked, chatId)
  if (blocked) return send(chatId, translation('t.blockedUser', 'en'), rem)

  if (!nameOfChatId) {
    // First interaction — save username
    set(nameOf, chatId, username)
    set(chatIdOf, username, chatId)
  } else if (currentUsername && currentUsername !== nameOfChatId) {
    // Username changed — update both mappings
    log(`[UsernameSync] ${chatId} changed username: ${nameOfChatId} → ${currentUsername}`)
    set(nameOf, chatId, currentUsername)
    set(chatIdOf, currentUsername, chatId)
    // Remove old username → chatId mapping to avoid stale lookups
    chatIdOf.deleteOne({ _id: nameOfChatId }).catch(() => {})
  }

  let freeLinks = await get(freeShortLinksOf, chatId)
  if (freeLinks === null || freeLinks === undefined) {
    set(freeShortLinksOf, chatId, FREE_LINKS)
    freeLinks = FREE_LINKS
  }

  // Ensure wallet exists for every user (uses $setOnInsert so deposits are never overwritten)
  const existingWallet = await get(walletOf, chatId)
  if (!existingWallet) {
    try {
      await walletOf.updateOne(
        { _id: chatId },
        { $setOnInsert: { usdIn: 0, usdOut: 0, ngnIn: 0, ngnOut: 0 } },
        { upsert: true }
      )
    } catch (e) { /* wallet may have been created by concurrent deposit — safe to ignore */ }
  }

  const userSubscribed = await isSubscribed(chatId)

  let info = await get(state, chatId)
  const saveInfo = async (label, data) => {
    await set(state, chatId, label, data)
    info = await get(state, chatId)
  }

  const action = info?.action

  const trans = (key, ...args) => {
    const lang = info?.userLanguage || 'en';
    const result = translation(key, lang, ...args)
    if (key === 'o' && result?.reply_markup?.keyboard) {
      const shortenerLabels = {
        en: { unlimited: 'URL Shortener — Unlimited', free: n => `URL Shortener — ${n} Free Link${n !== 1 ? 's' : ''}`, zero: 'URL Shortener — 0 Links Left' },
        fr: { unlimited: "Raccourcisseur d'URL — Illimité", free: n => `Raccourcisseur d'URL — ${n} Essai${n !== 1 ? 's' : ''}`, zero: "Raccourcisseur d'URL — 0 Essais" },
        hi: { unlimited: 'URL छोटा करें — असीमित', free: n => `URL छोटा करें — ${n} मुफ्त लिंक`, zero: 'URL छोटा करें — 0 लिंक शेष' },
        zh: { unlimited: 'URL 缩短器 — 无限', free: n => `URL 缩短器 — ${n}次免费`, zero: 'URL 缩短器 — 0次剩余' },
      }
      const sl = shortenerLabels[lang] || shortenerLabels.en
      const label = userSubscribed
        ? `🔗✂️ ${sl.unlimited}`
        : freeLinks > 0
          ? `🔗✂️ ${sl.free(freeLinks)}`
          : `🔗✂️ ${sl.zero}`
      return {
        ...result,
        reply_markup: {
          ...result.reply_markup,
          keyboard: result.reply_markup.keyboard.map((row) =>
            row.length === 1 && typeof row[0] === 'string' && row[0].startsWith('🔗')
              ? [label]
              : [...row]
          )
        }
      }
    }
    return result
  };

  const user = trans('user')
  const t = trans('t')
  const u = trans('u')
  const bc = trans('bc')
  const k = trans('k')
  const aO = trans('aO')
  const admin = trans('admin')
  const payIn = trans('payIn')
  const hP = trans('hP')
  const vp = trans('vp')
  const buyLeadsSelectCnam = trans('buyLeadsSelectCnam')

  // ━━━ Main Menu Greeting with Balance & Tier ━━━
  const getMainMenuGreeting = async () => {
    const lang = info?.userLanguage || 'en'
    try {
      const { usdBal, ngnBal } = await getBalance(walletOf, chatId)
      const tierInfo = await loyalty.getUserTier(walletOf, chatId)
      const greetings = {
        en: { welcome: 'Welcome', hi: 'Hey', balance: 'Balance', tier: 'Tier', discount: 'off all purchases', noDiscount: 'Start spending to unlock discounts', selectOption: 'Select an option below' },
        fr: { welcome: 'Bienvenue', hi: 'Salut', balance: 'Solde', tier: 'Niveau', discount: 'sur tous les achats', noDiscount: 'Commencez vos achats pour debloquer des reductions', selectOption: 'Choisissez une option' },
        zh: { welcome: '欢迎', hi: '你好', balance: '余额', tier: '等级', discount: '所有购买折扣', noDiscount: '开始消费以解锁折扣', selectOption: '请选择一个选项' },
        hi: { welcome: 'स्वागत है', hi: 'नमस्ते', balance: 'शेष', tier: 'स्तर', discount: 'सभी खरीदारी पर छूट', noDiscount: 'छूट पाने के लिए खर्च शुरू करें', selectOption: 'नीचे एक विकल्प चुनें' },
      }
      const g = greetings[lang] || greetings.en
      const name = msg?.from?.first_name || username
      const usdStr = `$${Math.max(0, usdBal).toFixed(2)}`
      const tierName = loyalty.TIERS[tierInfo.key]?.name || 'Bronze'
      const tierBadge = tierInfo.badge || '🥉'
      const discountLine = tierInfo.discountPercent > 0
        ? `${tierInfo.discountPercent}% ${g.discount}`
        : g.noDiscount

      // Check if user has free trial IVR call available (only for users without active phone plan)
      const userData = await get(phoneNumbersOf, chatId)
      const hasActivePlan = (userData?.numbers || []).some(n => n.status === 'active')
      let freeTrialLine = ''
      if (!hasActivePlan) {
        const trialKey = `ivrTrialUsed_${chatId}`
        const trialUsed = await get(state, trialKey)
        if (!trialUsed) {
          freeTrialLine = `\n📞 <i>You have a free trial Outbound IVR Call! Tap CloudPhone to try it.</i>\n`
        }
      }

      // Check if user has tried SIP test yet
      const testCreds = await db.collection('testCredentials').find({ chatId }).toArray()
      const totalTestCalls = testCreds.reduce((sum, c) => sum + (c.callsMade || 0), 0)
      let sipTestLine = ''
      if (totalTestCalls === 0) {
        sipTestLine = `\n🧪 <i>Try SIP calling free — send /testsip</i>\n`
      }

      return `${g.hi}, <b>${name}</b>\n\n` +
        `${tierBadge} ${tierName}  <b>${usdStr}</b>\n` +
        `<i>${discountLine}</i>` +
        `${freeTrialLine}${sipTestLine}\n` +
        `${g.selectOption}`
    } catch (e) {
      return t.welcome || 'Welcome! Please select an option:'
    }
  }

  // actions
  const a = {
    // submenu
    submenu1: 'submenu1',
    submenu2: 'submenu2',

    // cPanel Plans SubMenu
    submenu3: 'submenu3',
    // Free Trial Actions
    freeTrial: 'freeTrial',
    getPlanNow: 'getPlanNow',
    domainAvailableContinue: 'domainAvailableContinue',
    continueWithDomainNameSBS: 'continueWithDomainNameSBS',
    nameserverSelectionSBS: 'nameserverSelectionSBS',
    proceedSearchAnotherDomain: 'proceedSearchAnotherDomain',
    confirmEmailBeforeProceedingSBS: 'confirmEmailBeforeProceedingSBS',

    // Plans
    premiumWeekly: 'premiumWeekly',
    premiumCpanel: 'premiumCpanel',
    goldenCpanel: 'goldenCpanel',

    // Plan Actions
    registerNewDomain: 'registerNewDomain',
    registerNewDomainFound: 'registerNewDomainFound',
    useExistingDomain: 'useExistingDomain',
    useExistingDomainFound: 'useExistingDomainFound',
    useMyDomain: 'useMyDomain',
    selectMyDomain: 'selectMyDomain',
    connectExternalDomain: 'connectExternalDomain',
    connectExternalDomainFound: 'connectExternalDomainFound',
    domainNotFound: 'domainNotFound',
    nameserverSelection: 'nameserverSelection',
    enterYourEmail: 'enterYourEmail',
    confirmEmailBeforeProceeding: 'confirmEmailBeforeProceeding',
    proceedWithEmail: 'proceedWithEmail',
    proceedWithPaymentProcess: 'proceedWithPaymentProcess',
    plansAskCoupon: 'plansAskCoupon',
    skipCoupon: 'skipCoupon',
    myHostingPlans: 'myHostingPlans',
    viewHostingPlan: 'viewHostingPlan',
    confirmRenewNow: 'confirmRenewNow',

    askDomainToUseWithShortener: 'askDomainToUseWithShortener',
    domainNsSelect: 'domainNsSelect',
    domainCustomNsEntry: 'domainCustomNsEntry',

    selectCurrencyToWithdraw: 'selectCurrencyToWithdraw',

    selectCurrencyToDeposit: 'selectCurrencyToDeposit',

    depositNGN: 'depositNGN',
    askEmailForNGN: 'askEmailForNGN',
    showDepositNgnInfo: 'showDepositNgnInfo',

    depositUSD: 'depositUSD',
    selectCryptoToDeposit: 'selectCryptoToDeposit',
    showDepositCryptoInfo: 'showDepositCryptoInfo',

    walletSelectCurrency: 'walletSelectCurrency',
    walletSelectCurrencyConfirm: 'walletSelectCurrencyConfirm',

    walletPayUsd: 'walletPayUsd',
    walletPayNgn: 'walletPayNgn',

    askCoupon: 'askCoupon',

    phoneNumberLeads: 'phoneNumberLeads',

    // buyLeads
    buyLeadsSelectCountry: 'buyLeadsSelectCountry',
    buyLeadsSelectSmsVoice: 'buyLeadsSelectSmsVoice',
    buyLeadsSelectArea: 'buyLeadsSelectArea',
    buyLeadsSelectAreaCode: 'buyLeadsSelectAreaCode',
    buyLeadsSelectCarrier: 'buyLeadsSelectCarrier',
    buyLeadsSelectCnam: 'buyLeadsSelectCnam',
    buyLeadsSelectAmount: 'buyLeadsSelectAmount',
    buyLeadsSelectFormat: 'buyLeadsSelectFormat',
    //targetLeads
    targetSelectTarget: 'targetSelectTarget',
    targetSelectCity: 'targetSelectCity',
    targetSelectAreaCode: 'targetSelectAreaCode',
    targetLeadsConfirm: 'targetLeadsConfirm',
    // Custom lead request
    customLeadRequestName: 'customLeadRequestName',
    customLeadRequestCity: 'customLeadRequestCity',
    customLeadRequestDetails: 'customLeadRequestDetails',
    // Support chat
    supportChat: 'supportChat',
    //validatePhoneNumbers
    validatorSelectCountry: 'validatorSelectCountry',
    validatorPhoneNumber: 'validatorPhoneNumber',
    validatorSelectSmsVoice: ' validatorSelectSmsVoice',
    validatorSelectCarrier: 'validatorSelectCarrier',
    validatorSelectCnam: 'validatorSelectCnam',
    validatorSelectAmount: 'validatorSelectAmount',
    validatorSelectFormat: 'validatorSelectFormat',

    // Short link
    redSelectUrl: 'redSelectUrl',
    redSelectRandomCustom: 'redSelectRandomCustom',
    redSelectProvider: 'redSelectProvider',
    redSelectCustomExt: 'redSelectCustomExt',

    // user setup
    addUserLanguage: 'addUserLanguage',
    updateUserLanguage: 'updateUserLanguage',
    askUserEmail: 'askUserEmail',
    askUserTerms: 'askUserTerms',

    //vps plans
    submenu4: 'submenu4',
    askCountryForVPS: 'askCountryForVPS',
    askRegionAreaForVPS: 'askRegionAreaForVPS',
    askZoneForVPS: 'askZoneForVPS',
    confirmZoneForVPS: 'confirmZoneForVPS',
    askUserVpsPlan: 'askUserVpsPlan',
    askVpsConfig: 'askVpsConfig',
    askVPSPlanAutoRenewal: 'askVPSPlanAutoRenewal',
    askVpsOS: 'askVpsOS',
    askVpsCpanel: 'askVpsCpanel',
    askVpsCpanelLicense: 'askVpsCpanelLicense',
    askCouponForVPSPlan: 'askCouponForVPSPlan',
    skipCouponVps: 'skipCouponVps',
    askVpsDiskType: 'askVpsDiskType',
    vpsAskSSHKey: 'vpsAskSSHKey',
    vpsLinkSSHKey: 'vpsLinkSSHKey',
    askUploadSSHPublicKey: 'askUploadSSHPublicKey',
    askSkipSSHkeyconfirmation: 'askSkipSSHkeyconfirmation',
    proceedWithVpsPayment: 'proceedWithVpsPayment',

    //vps management
    getUserAllVmIntances: 'getUserAllVmIntances',
    getVPSDetails: 'getVPSDetails',
    confirmStopVps: 'confirmStopVps',
    confirmDeleteVps: 'confirmDeleteVps',
    upgradeVpsInstance: 'upgradeVpsInstance',
    upgradeVpsPlan: 'upgradeVpsPlan',
    askVpsUpgradePayment: 'askVpsUpgradePayment',
    vpsSubscription: 'vpsSubscription',
    manageVpsSub: 'manageVpsSub',
    manageVpsPanel: 'manageVpsPanel',
    vpsLinkedSSHkeys: 'vpsLinkedSSHkeys',
    vpsUnlinkSSHKey: 'vpsUnlinkSSHKey',
    confirmVpsUnlinkSSHKey: 'confirmVpsUnlinkSSHKey',
    vpslinkNewSSHKey: 'vpslinkNewSSHKey',
    uploadSShKeyToAttach : 'uploadSShKeyToAttach',
    downloadSSHKey: 'downloadSSHKey',
    confirmVPSRenewDetails: 'confirmVPSRenewDetails',

    // Digital Products
    submenu6: 'submenu6',
    digitalProductPay: 'digital-product-pay',

    // Cloud Phone
    submenu5: 'submenu5',
    cpSelectCountry: 'cpSelectCountry',
    cpSelectType: 'cpSelectType',
    cpSelectArea: 'cpSelectArea',
    cpEnterAreaCode: 'cpEnterAreaCode',
    cpSelectNumber: 'cpSelectNumber',
    cpSelectPlan: 'cpSelectPlan',
    cpOrderSummary: 'cpOrderSummary',
    cpMyNumbers: 'cpMyNumbers',
    cpManageNumber: 'cpManageNumber',
    cpCallForwarding: 'cpCallForwarding',
    cpEnterForwardNumber: 'cpEnterForwardNumber',
    cpSmsSettings: 'cpSmsSettings',
    cpEnterEmail: 'cpEnterEmail',
    cpEnterWebhook: 'cpEnterWebhook',
    cpVoicemail: 'cpVoicemail',
    cpSipCredentials: 'cpSipCredentials',
    cpRenewPlan: 'cpRenewPlan',
    cpChangePlan: 'cpChangePlan',
    cpReleaseConfirm: 'cpReleaseConfirm',
    cpEnterAddress: 'cpEnterAddress',
    cpReleaseDigits: 'cpReleaseDigits',
    cpIvr: 'cpIvr',
    cpIvrGreeting: 'cpIvrGreeting',
    cpIvrTemplate: 'cpIvrTemplate',
    cpIvrTemplateEdit: 'cpIvrTemplateEdit',
    cpIvrGreetingVoice: 'cpIvrGreetingVoice',
    cpIvrGreetingProvider: 'cpIvrGreetingProvider',
    cpIvrGreetingPreview: 'cpIvrGreetingPreview',
    cpIvrAddOption: 'cpIvrAddOption',
    cpIvrOptionKey: 'cpIvrOptionKey',
    cpIvrOptionAction: 'cpIvrOptionAction',
    cpIvrOptionMsg: 'cpIvrOptionMsg',
    cpIvrOptionVoice: 'cpIvrOptionVoice',
    cpIvrOptionProvider: 'cpIvrOptionProvider',
    cpIvrOptionPreview: 'cpIvrOptionPreview',
    cpIvrRemoveOption: 'cpIvrRemoveOption',
    cpCallRecording: 'cpCallRecording',
    cpFaxSettings: 'cpFaxSettings',
    cpSmsInbox: 'cpSmsInbox',
    cpVmGreeting: 'cpVmGreeting',
    cpVmAudioUpload: 'cpVmAudioUpload',
    cpVmTemplate: 'cpVmTemplate',
    cpVmTemplateEdit: 'cpVmTemplateEdit',
    cpVmGreetingVoice: 'cpVmGreetingVoice',
    cpVmGreetingProvider: 'cpVmGreetingProvider',
    cpVmGreetingPreview: 'cpVmGreetingPreview',
    cpVmTextGreeting: 'cpVmTextGreeting',

    // IVR Outbound Call
    ivrObStart: 'ivrObStart',
    ivrObSelectCallerId: 'ivrObSelectCallerId',
    ivrObEnterTarget: 'ivrObEnterTarget',
    ivrObSelectCategory: 'ivrObSelectCategory',
    ivrObSelectTemplate: 'ivrObSelectTemplate',
    ivrObFillPlaceholder: 'ivrObFillPlaceholder',
    ivrObEnterIvrNumber: 'ivrObEnterIvrNumber',
    ivrObSelectProvider: 'ivrObSelectProvider',
    ivrObSelectVoice: 'ivrObSelectVoice',
    ivrObAudioPreview: 'ivrObAudioPreview',
    ivrObCallPreview: 'ivrObCallPreview',
    ivrObCustomScript: 'ivrObCustomScript',
  }

  const firstSteps = [
    'block-user',
    'unblock-user',
    admin.messageUsers,
    admin.broadcastSettings,

    'choose-subscription',
    user.wallet,
    a.phoneNumberLeads,

    a.submenu1,
    a.submenu2,
    // cPanel Plans SubMenu
    a.submenu3,
    'displayMainMenuButtons',

    a.submenu4,
    a.submenu5,
    a.submenu6
  ]
  const goto = {
    askCoupon: action => {
      send(chatId, t.askCoupon(info?.price), k.of([t.skip]))
      set(state, chatId, 'action', a.askCoupon + action)
    },
    'domain-pay': () => {
      const { domain, price, couponApplied, newPrice } = info
      const payKeyboard = k.of([
        Object.values(payIn),
        ['🎟️ Apply Coupon'],
      ])
      couponApplied
        ? send(chatId, t.domainNewPrice(domain, price, newPrice), k.pay)
        : send(chatId, t.domainPrice(domain, price), payKeyboard)
      set(state, chatId, 'action', 'domain-pay')
    },
    'hosting-pay': () => {
      const payload = {
        domainName: info.website_name,
        domainPrice: info.price,
        existingDomain: info.existingDomain,
        couponDiscount: info.couponDiscount,
        totalPrice: info.totalPrice,
        couponApplied: info.couponApplied,
        hostingPrice: info.hostingPrice,
        newPrice: info.newPrice,
        planName: info.planName || info.plan,
        duration: info.duration || (info.plan && info.plan.includes('1-Week') ? '1 Week' : '1 Month'),
      }
      const payKeyboard = info.couponApplied
        ? k.pay
        : k.of([
            Object.values(payIn),
            ['🎟️ Apply Coupon'],
            [t.backButton],
          ])
      set(state, chatId, 'action', 'hosting-pay')
      send(chatId, hP.generateInvoiceText(payload), payKeyboard)
    },
    'vps-plan-pay' : async () => {
      set(state, chatId, 'action', 'vps-plan-pay')
      const { usdBal, ngnBal } = await getBalance(walletOf, chatId)
      send(chatId, t.showWallet(usdBal, ngnBal))
      send(chatId, vp.askPaymentMethod, k.pay)
    },
    'vps-upgrade-plan-pay' : async () => {
      set(state, chatId, 'action', 'vps-upgrade-plan-pay')
      const { usdBal, ngnBal } = await getBalance(walletOf, chatId)
      const lowBalance = info.vpsDetails?.billingCycle === 'Hourly' && usdBal < info.vpsDetails.totalPrice
      send(chatId, t.showWallet(usdBal, ngnBal))
      send(chatId, vp.askPaymentMethod, info.vpsDetails?.billingCycle === 'Hourly' && !lowBalance ? k.of([payIn.wallet]) : k.pay)
    },
    // ━━━ Cloud Phone goto functions ━━━
    submenu5: () => {
      set(state, chatId, 'action', a.submenu5)
      const pc = phoneConfig.btn
      send(chatId, phoneConfig.txt.hubWelcome, k.of([
        [pc.ivrOutboundCall],
        [pc.buyPhoneNumber],
        [pc.myNumbers],
        [pc.sipSettings],
        [pc.usageBilling],
      ]))
    },
    'phone-pay': async () => {
      set(state, chatId, 'action', 'phone-pay')
      const { usdBal, ngnBal } = await getBalance(walletOf, chatId)
      send(chatId, t.showWallet(usdBal, ngnBal))
      send(chatId, phoneConfig.txt.paymentPrompt(info.cpPrice), k.pay)
    },
    // ━━━ Digital Products goto functions ━━━
    submenu6: () => {
      set(state, chatId, 'action', a.submenu6)
      send(chatId, t.digitalProductsSelect, k.of([
        [t.dpTwilioMain, t.dpTwilioSub],
        [t.dpTelnyxMain, t.dpTelnyxSub],
        [t.dpAwsMain, t.dpAwsSub],
        [t.dpGcloudMain, t.dpGcloudSub],
        [t.dpGworkspaceNew, t.dpGworkspaceAged],
        [t.dpZohoNew, t.dpZohoAged],
        [t.dpEsim],
      ]))
    },
    'digital-product-pay': () => {
      set(state, chatId, 'action', a.digitalProductPay)
      const product = info?.dpProductName
      const price = info?.dpPrice
      send(chatId, t.dpPaymentPrompt(product, price), k.pay)
    },
    'leads-pay': async () => {
      set(state, chatId, 'action', 'leads-pay')
      const price = info?.couponApplied ? info?.newPrice : info?.price
      const { usdBal, ngnBal } = await getBalance(walletOf, chatId)
      send(chatId, t.showWallet(usdBal, ngnBal))
      const amount = info?.amount || 0
      send(chatId, `💰 <b>Payment for ${info?.lastStep === a.validatorSelectFormat ? 'Phone Validation' : 'Phone Leads'}</b>\n\n📦 Quantity: <b>${amount.toLocaleString()}</b>\n💵 Total: <b>$${Number(price).toFixed(2)}</b>\n\nSelect payment method:`, k.pay)
    },
    'choose-domain-to-buy': async () => {
      let text = ``
      if (await isSubscribed(chatId)) {
        const plan = await get(planOf, chatId)
        const available = (await get(freeDomainNamesAvailableFor, chatId)) || 0
        const s = available === 1 ? '' : 's'
        text =
          available <= 0
            ? ``
            : t.availablefreeDomain(plan, available, s)
      }
      set(state, chatId, 'action', 'choose-domain-to-buy')
      send(chatId, t.chooseDomainToBuy(text), bc)
    },
    askDomainToUseWithShortener: async () => {
      await set(state, chatId, 'action', a.askDomainToUseWithShortener)
      const domain = info?.domain || ''
      const price = info?.price || ''
      const priceText = domain && price ? `✅ <b>${domain}</b> — <b>$${price}</b>\n\n` : ''
      send(chatId, `${priceText}${t.askDomainToUseWithShortener}`, trans('yes_no'))
    },
    domainNsSelect: () => {
      set(state, chatId, 'action', a.domainNsSelect)
      const domain = info?.domain || ''
      send(chatId, `Select DNS for <b>${domain}</b>:\n\n<b>${configUser.nsProviderDefault}</b> — Default nameservers\n<b>${configUser.nsCloudflare}</b> — Enhanced security & performance\n<b>${configUser.nsCustom}</b> — Use your own nameservers`, k.of([[configUser.nsProviderDefault, configUser.nsCloudflare], [configUser.nsCustom]]))
    },
    domainCustomNsEntry: () => {
      set(state, chatId, 'action', a.domainCustomNsEntry)
      send(chatId, `Enter your custom nameservers separated by space.\n\nExample: <code>ns1.example.com ns2.example.com</code>\n\nMinimum 2 nameservers required.`, k.of([]))
    },
    'plan-pay': () => {
      const { plan, price, couponApplied, newPrice } = info
      couponApplied
        ? send(chatId, t.planNewPrice(plan, price, newPrice), k.pay)
        : send(chatId, t.planPrice(plan, price), k.pay)
      set(state, chatId, 'action', 'plan-pay')
    },
    'choose-subscription': () => {
      set(state, chatId, 'action', 'choose-subscription')
      send(chatId, t.chooseSubscription, trans('chooseSubscription'))
    },
    'choose-url-to-shorten': async () => {
      set(state, chatId, 'action', 'choose-url-to-shorten')
      send(chatId, t.shortenedUrlLink, bc)
      adminDomains = await getPurchasedDomains(TELEGRAM_DOMAINS_SHOW_CHAT_ID)
    },
    'choose-domain-with-shorten': domains => {
      send(chatId, t.chooseDomainWithShortener, trans('show', domains))
      set(state, chatId, 'action', 'choose-domain-with-shorten')
    },
    'choose-link-type': () => {
      send(chatId, `Choose link type:`, trans('linkType'))
      set(state, chatId, 'action', 'choose-link-type')
    },
    'quick-activate-domain-shortener': async () => {
      const domains = await getPurchasedDomains(chatId)
      if (!domains || domains.length === 0) {
        send(chatId, `You don't have any domains yet. Buy a domain first, then activate it for the shortener.`)
        return goto.submenu1()
      }
      set(state, chatId, 'action', 'quick-activate-domain-shortener')
      send(chatId, `🔗 <b>Activate Domain for URL Shortener</b>\n\nSelect a domain to link with the shortener. DNS will be auto-configured so you can create branded short links (e.g. <code>yourdomain.com/abc</code>).`, trans('k.of', [...domains.map(d => [d])]))
    },
    'get-free-domain': () => {
      send(chatId, t.chooseFreeDomainText,  trans('yes_no'))
      set(state, chatId, 'action', 'get-free-domain')
    },

    'choose-domain-to-manage': async () => {
      const domains = await getPurchasedDomains(chatId)
      set(state, chatId, 'action', 'choose-domain-to-manage')
      send(chatId, t.chooseDomainToManage, trans('show', domains))
    },

    'select-dns-record-id-to-delete': () => {
      const records = info?.dnsRecords || []
      // Filter out NS records — nameservers can only be updated, not deleted
      const deletableRecords = records.map((r, i) => ({ ...r, originalIndex: i })).filter(r => r.recordType !== 'NS')
      if (deletableRecords.length === 0) {
        send(chatId, 'No deletable records found. Nameserver records can only be updated.', { parse_mode: 'HTML' })
        return
      }
      const recordBtns = deletableRecords.map((r) => {
        const label = r.recordContent || '—'
        const short = label.length > 30 ? label.substring(0, 28) + '..' : label
        return [`${r.originalIndex + 1}. ${r.recordType} → ${short}`]
      })
      const keyboard = { parse_mode: 'HTML', reply_markup: { keyboard: [...recordBtns, [t.back, t.cancel]] } }
      send(chatId, t.deleteDnsTxt, keyboard)
      set(state, chatId, 'action', 'select-dns-record-id-to-delete')
    },

    'confirm-dns-record-id-to-delete': () => {
      const records = info?.dnsRecords || []
      const delId = info?.delId
      const rec = records[delId]
      const label = rec ? `<b>${rec.recordType}</b> → ${rec.recordContent || '—'}` : 'this record'
      send(chatId, `Delete ${label}?`, trans('yes_no'))
      set(state, chatId, 'action', 'confirm-dns-record-id-to-delete')
    },

    'choose-dns-action': async () => {
      const domain = info?.domainToManage

      // Use unified domain service to route DNS to correct provider
      const dnsResult = await domainService.viewDNSRecords(domain, db)
      const source = dnsResult?.source || 'connectreseller'
      const records = dnsResult?.records || []
      const domainNameId = dnsResult?.domainNameId || null
      const cfZoneId = dnsResult?.cfZoneId || null

      // Get domain metadata for nameserverType
      const domainMeta = await domainService.getDomainMeta(domain, db)
      const nameserverType = domainMeta?.nameserverType || (source === 'cloudflare' ? 'cloudflare' : 'provider')

      const toSave = records?.map((r) => ({
        dnszoneID: r.dnszoneID || null,
        dnszoneRecordID: r.dnszoneRecordID || null,
        cfRecordId: r.cfRecordId || null,
        recordType: r.recordType,
        nsId: r.nsId || null,
        recordContent: r.recordContent,
        recordName: r.recordName || null,
        isNameserver: r.isNameserver || false,
      }))

      const categorizeRecords = (records) => {
        return records.reduce((acc, record, index) => {
          const type = record.recordType;
          if (!acc[type]) {
            acc[type] = [];
          }
          acc[type].push({ index: index+1, ...record });
          return acc;
        }, {});
      };
      const categorizedRecords = categorizeRecords(records);

      // Detect if shortener is active (CNAME pointing to railway)
      const shortenerActive = records.some(r =>
        r.recordType === 'CNAME' && r.recordContent && r.recordContent.includes('.up.railway.app')
      )
      set(state, chatId, 'shortenerActive', shortenerActive)

      set(state, chatId, 'dnsRecords', toSave)
      set(state, chatId, 'dnsSource', source)
      set(state, chatId, 'cfZoneId', cfZoneId)
      set(state, chatId, 'domainNameId', domainNameId)
      set(state, chatId, 'nameserverType', nameserverType)
      set(state, chatId, 'action', 'choose-dns-action')

      // Dynamic keyboard
      const shortenerBtn = shortenerActive ? t.deactivateShortener : t.activateShortener
      const _bc = [t.backButton || '⬅️ Back']
      const kbRows = [[t.quickActions], [t.checkDns], [t.addDns], [t.updateDns], [t.deleteDns]]
      // Only show "Switch to Cloudflare" if not already on CF
      if (nameserverType !== 'cloudflare') {
        kbRows.push([t.switchToCf])
      }
      kbRows.push([shortenerBtn], _bc)
      const dnsKeyboard = {
        parse_mode: 'HTML',
        reply_markup: { keyboard: kbRows },
        disable_web_page_preview: true,
      }
      send(chatId, t.viewDnsRecords(categorizedRecords, domain, nameserverType), dnsKeyboard)
    },

    'type-dns-record-data-to-add': recordType => {
      send(chatId, t.askDnsContent[recordType], bc)
      set(state, chatId, 'recordType', recordType)
      set(state, chatId, 'action', 'type-dns-record-data-to-add')
    },

    'select-dns-record-id-to-update': () => {
      const records = info?.dnsRecords || []
      let nsSlotCounter = 0
      const recordBtns = records.map((r, i) => {
        const label = r.recordContent || '—'
        const short = label.length > 30 ? label.substring(0, 28) + '..' : label
        if (r.recordType === 'NS') {
          nsSlotCounter++
          return [`${i + 1}. NS${nsSlotCounter}: ${short}`]
        }
        return [`${i + 1}. ${r.recordType} → ${short}`]
      })
      const keyboard = { parse_mode: 'HTML', reply_markup: { keyboard: [...recordBtns, [t.back, t.cancel]] } }
      send(chatId, t.updateDnsTxt, keyboard)
      set(state, chatId, 'action', 'select-dns-record-id-to-update')
    },
    'type-dns-record-data-to-update': (id, recordType, currentValue) => {
      set(state, chatId, 'dnsRecordIdToUpdate', id)
      set(state, chatId, 'action', 'type-dns-record-data-to-update')

      // For NS records, show full arrangement context
      if (recordType === 'NS') {
        const records = info?.dnsRecords || []
        const nsRecords = records.filter(r => r.recordType === 'NS')
        const nsIndex = nsRecords.findIndex((r, i) => records.indexOf(r) === id || i === records.slice(0, id + 1).filter(x => x.recordType === 'NS').length - 1)
        const slotNum = nsIndex >= 0 ? nsIndex + 1 : 1
        if (t.updateNsPrompt) {
          send(chatId, t.updateNsPrompt(nsRecords, slotNum), bc)
        } else {
          send(chatId, `<b>Update Nameserver NS${slotNum}</b>\nCurrent: <b>${currentValue || 'N/A'}</b>\n\nEnter new nameserver:`, bc)
        }
        return
      }

      const prompt = t.askUpdateDnsContent[recordType]
      if (typeof prompt === 'function') {
        send(chatId, prompt(currentValue), bc)
      } else if (prompt) {
        send(chatId, prompt, bc)
      } else {
        send(chatId, `<b>Update ${recordType} Record</b>\n\nEnter new value:`, bc)
      }
    },

    'select-dns-record-type-to-add': () => {
      set(state, chatId, 'action', 'select-dns-record-type-to-add')
      const dnsSource = info?.dnsSource || ''
      const dynamicKeyboard = trans('getRecordTypeKeyboard', dnsSource)
      // Fall back to static keyboard if dynamic not available
      const keyboard = (dynamicKeyboard && typeof dynamicKeyboard === 'object' && dynamicKeyboard.reply_markup) ? dynamicKeyboard : trans('dnsRecordType')
      send(chatId, t.addDnsTxt, keyboard)
    },

    // DNS Wizard: Quick Actions
    'dns-quick-action-menu': () => {
      set(state, chatId, 'action', 'dns-quick-action-menu')
      send(chatId, t.dnsQuickActionMenu, trans('dnsQuickActionKeyboard'))
    },
    'dns-quick-point-to-ip': () => {
      set(state, chatId, 'action', 'dns-quick-point-to-ip')
      send(chatId, t.dnsQuickAskIp, bc)
    },
    'dns-quick-verification': () => {
      set(state, chatId, 'action', 'dns-quick-verification')
      send(chatId, t.dnsQuickAskVerificationTxt, bc)
    },
    'dns-quick-subdomain-name': () => {
      set(state, chatId, 'action', 'dns-quick-subdomain-name')
      send(chatId, t.dnsQuickAskSubdomainName, bc)
    },
    'dns-quick-subdomain-target': () => {
      const sub = info?.dnsSubdomainName || 'subdomain'
      const domain = info?.domainToManage || ''
      set(state, chatId, 'action', 'dns-quick-subdomain-target')
      send(chatId, t.dnsQuickAskSubdomainTargetType(`${sub}.${domain}`), trans('dnsSubdomainTargetTypeKeyboard'))
    },
    'dns-quick-subdomain-ip': () => {
      set(state, chatId, 'action', 'dns-quick-subdomain-ip')
      send(chatId, t.dnsQuickAskSubdomainIp, bc)
    },
    'dns-quick-subdomain-domain': () => {
      set(state, chatId, 'action', 'dns-quick-subdomain-domain')
      send(chatId, t.dnsQuickAskSubdomainDomain, bc)
    },

    // DNS Wizard: Multi-step add record
    'dns-add-hostname': (recordType) => {
      set(state, chatId, 'dnsAddRecordType', recordType)
      set(state, chatId, 'action', 'dns-add-hostname')
      send(chatId, t.askDnsHostname[recordType], bc)
    },
    'dns-add-value': (recordType) => {
      set(state, chatId, 'action', 'dns-add-value')
      send(chatId, t.askDnsValue[recordType], bc)
    },
    'dns-add-mx-priority': () => {
      set(state, chatId, 'action', 'dns-add-mx-priority')
      send(chatId, t.askMxPriority, trans('dnsMxPriorityKeyboard'))
    },

    // DNS Wizard: SRV multi-step
    'dns-srv-service': () => {
      set(state, chatId, 'action', 'dns-srv-service')
      send(chatId, t.askSrvService, bc)
    },
    'dns-srv-target': () => {
      set(state, chatId, 'action', 'dns-srv-target')
      send(chatId, t.askSrvTarget, bc)
    },
    'dns-srv-port': () => {
      set(state, chatId, 'action', 'dns-srv-port')
      send(chatId, t.askSrvPort, bc)
    },
    'dns-srv-priority': () => {
      set(state, chatId, 'action', 'dns-srv-priority')
      send(chatId, t.askSrvPriority, trans('dnsSrvDefaultsKeyboard'))
    },
    'dns-srv-weight': () => {
      set(state, chatId, 'action', 'dns-srv-weight')
      send(chatId, t.askSrvWeight, bc)
    },

    // DNS Wizard: CAA multi-step
    'dns-caa-hostname': () => {
      set(state, chatId, 'action', 'dns-caa-hostname')
      send(chatId, t.askCaaHostname, bc)
    },
    'dns-caa-tag': () => {
      set(state, chatId, 'action', 'dns-caa-tag')
      send(chatId, t.askCaaTag, trans('dnsCaaTagKeyboard'))
    },
    'dns-caa-value': () => {
      const tag = info?.dnsCaaTag || 'issue'
      set(state, chatId, 'action', 'dns-caa-value')
      send(chatId, t.askCaaValue(tag), bc)
    },

    //
    //
    [admin.messageUsers]: () => {
      send(chatId, t.enterBroadcastMessage, bc)
      set(state, chatId, 'action', admin.messageUsers)
    },
    adminConfirmMessage: () => {
      send(chatId, 'Confirm?',  trans('yes_no'))
      set(state, chatId, 'action', 'adminConfirmMessage')
    },
    broadcastSettings: () => {
      const configText = `⚙️ Broadcast Configuration\n\n📊 Current Settings:\n• Batch Size: ${BROADCAST_CONFIG.BATCH_SIZE} users\n• Delay Between Batches: ${BROADCAST_CONFIG.DELAY_BETWEEN_BATCHES/1000}s\n• Delay Between Messages: ${BROADCAST_CONFIG.DELAY_BETWEEN_MESSAGES}ms\n• Max Retries: ${BROADCAST_CONFIG.MAX_RETRIES}\n• Retry Delay: ${BROADCAST_CONFIG.RETRY_DELAY/1000}s\n\n📝 To modify settings, edit js/broadcast-config.js file`
      
      send(chatId, configText, aO)
      set(state, chatId, 'action', 'none')
    },
    //
    //
    //

    [user.wallet]: async () => {
      set(state, chatId, 'action', user.wallet)
      const { usdBal, ngnBal } = await getBalance(walletOf, chatId)
      // Show tier badge alongside wallet
      const tierInfo = await loyalty.getUserTier(walletOf, chatId)
      const tierLine = loyalty.formatWalletTierLine(tierInfo, info?.userLanguage || 'en')
      send(chatId, t.wallet(usdBal, ngnBal) + tierLine, k.of([[u.deposit], [u.myTier], [t.back]]))
    },
    //
    [a.selectCurrencyToDeposit]: () => {
      set(state, chatId, 'action', a.selectCurrencyToDeposit)
      send(chatId, t.selectCurrencyToDeposit, trans('payOpts'))
    },
    //
    [a.depositNGN]: () => {
      send(chatId, t.depositNGN, bc)
      set(state, chatId, 'action', a.depositNGN)
    },
    [a.askEmailForNGN]: () => {
      send(chatId, t.askEmailForNGN, bc)
      set(state, chatId, 'action', a.askEmailForNGN)
    },
    showDepositNgnInfo: async () => {
      const ref = nanoid()
      const { depositAmountNgn: ngn, email } = info

      log({ ref })
      set(chatIdOfPayment, ref, { chatId, ngnIn: ngn, endpoint: `/bank-wallet` })
      const { url, error } = await createCheckout(ngn, `/ok?a=b&ref=${ref}&`, email, username, ref)

      set(state, chatId, 'action', 'none')
      if (error) return send(chatId, error, trans('o'))
      console.log('showDepositNgnInfo', url)
      send(chatId, t.showDepositNgnInfo(ngn), trans('payBank', url))
      return send(chatId, `Bank ₦aira + Card 🌐︎`, trans('o'))
    },
    //
    [a.depositUSD]: () => {
      send(chatId, t.depositUSD, bc)
      set(state, chatId, 'action', a.depositUSD)
    },
    [a.selectCryptoToDeposit]: () => {
      set(state, chatId, 'action', a.selectCryptoToDeposit)
      send(chatId, t.selectCryptoToDeposit, trans('k.of', trans('supportedCryptoViewOf')))
    },
    showDepositCryptoInfo: async () => {
      const ref = nanoid()
      const { amount, tickerView, userLanguage } = info
      const ticker = tickerOf[tickerView]
      if (BLOCKBEE_CRYTPO_PAYMENT_ON === 'true') {
        const { address, bb } = await getCryptoDepositAddress(ticker, chatId, SELF_URL, `/crypto-wallet?a=b&ref=${ref}&`)
        if (!address) return send(chatId, t.errorFetchingCryptoAddress, trans('o'))
        log({ ref })
        sendQrCode(bot, chatId, bb, userLanguage ?? 'en')
        set(chatIdOfPayment, ref, { chatId })
        set(state, chatId, 'action', 'none')
        const usdIn = await convert(amount, 'usd', ticker)
        send(chatId, t.showDepositCryptoInfo(usdIn, tickerView, address), trans('o'))
      } else {
        const tickerDyno = tickerOfDyno[tickerView]
        const redirect_url = `${SELF_URL}/dynopay/crypto-wallet`
        const meta_data = {
          "product_name": dynopayActions.walletFund,
          "refId" : ref
        }
        const { qr_code, address } = await getDynopayCryptoAddress(amount, tickerDyno, redirect_url, meta_data)
        if (!address) return send(chatId, t.errorFetchingCryptoAddress, trans('o'))
        await generateQr(bot, chatId, qr_code, userLanguage ?? 'en')
        set(chatIdOfDynopayPayment, ref, { chatId, action: dynopayActions.walletFund, address })
        set(state, chatId, 'action', 'none')
        const usdIn = await convert(amount, 'usd', ticker)
        send(chatId, t.showDepositCryptoInfo(usdIn, tickerView, address), trans('o'))
      }
    },

    //
    selectCurrencyToWithdraw: () => {
      send(chatId, t.comingSoonWithdraw)
    },
    //
    //
    walletSelectCurrency: async (plan = false) => {
      if (
        action.includes(a.buyLeadsSelectFormat) ||
        action.includes(a.validatorSelectFormat) ||
        action.includes(a.redSelectRandomCustom)
      ) {
        if (plan) {
          const { amount, totalPrice, couponApplied, newPrice } = info
          couponApplied
          ? send(chatId, t.buyLeadsNewPrice(amount, totalPrice, newPrice), trans('payOpts'))
          : send(chatId, t.buyLeadsPrice(amount, totalPrice), trans('payOpts'))
        } else {
          const { amount, price, couponApplied, newPrice } = info
          couponApplied
          ? send(chatId, t.buyLeadsNewPrice(amount, price, newPrice), trans('payOpts'))
          : send(chatId, t.buyLeadsPrice(amount, price), trans('payOpts'))
        }

      }

      // Apply loyalty discount to the price
      const basePrice = info?.couponApplied ? info.newPrice : (info?.totalPrice || info?.price || 0)
      if (basePrice > 0) {
        const discountInfo = await loyalty.applyDiscount(walletOf, chatId, basePrice)
        if (discountInfo.discount > 0) {
          await saveInfo('loyaltyDiscount', discountInfo.discount)
          await saveInfo('preLoyaltyPrice', basePrice)
          const discountedPrice = discountInfo.finalPrice
          // Update the stored price to the discounted price
          if (info?.couponApplied) {
            await saveInfo('newPrice', discountedPrice)
          } else if (info?.totalPrice) {
            await saveInfo('totalPrice', discountedPrice)
          }
          await saveInfo('price', discountedPrice)
          send(chatId, loyalty.formatCheckoutDiscount(discountInfo, discountedPrice, info?.userLanguage || 'en'), { parse_mode: 'HTML' })
        }
      }

      set(state, chatId, 'action', a.walletSelectCurrency)
      const { usdBal, ngnBal } = await getBalance(walletOf, chatId)
      send(chatId, t.walletSelectCurrency(usdBal, ngnBal), trans('payOpts'))
    },
    walletSelectCurrencyConfirm: async () => {
      const { price, couponApplied, newPrice, coin } = info
      const p = couponApplied ? newPrice : price

      let text = ''
      if (coin === u.ngn) text = t.confirmNgn(p, await usdToNgn(p))

      send(chatId, text + t.walletSelectCurrencyConfirm,  trans('yes_no'))
      set(state, chatId, 'action', a.walletSelectCurrencyConfirm)
    },
    //
    phoneNumberLeads: () => {
      send(chatId, t.phoneNumberLeads, k.phoneNumberLeads)
      set(state, chatId, 'action', a.phoneNumberLeads)
    },
    //
    //
    // buyLeads
    buyLeadsSelectCountry: () => {
      send(chatId, t.buyLeadsSelectCountry, k.buyLeadsSelectCountry)
      set(state, chatId, 'action', a.buyLeadsSelectCountry)
    },
    buyLeadsSelectSmsVoice: () => {
      send(chatId, t.buyLeadsSelectSmsVoice, k.buyLeadsSelectSmsVoice)
      set(state, chatId, 'action', a.buyLeadsSelectSmsVoice)
    },
    buyLeadsSelectArea: () => {
      send(chatId, t.buyLeadsSelectArea, k.buyLeadsSelectArea(info?.country))
      set(state, chatId, 'action', a.buyLeadsSelectArea)
    },
    buyLeadsSelectAreaCode: () => {
      send(
        chatId,
        t.buyLeadsSelectAreaCode,
        k.buyLeadsSelectAreaCode(info?.country, ['USA', 'Canada'].includes(info?.country) ? info?.area : 'Area Codes'),
      )
      set(state, chatId, 'action', a.buyLeadsSelectAreaCode)
    },
    buyLeadsSelectCarrier: () => {
      send(chatId, t.buyLeadsSelectCarrier, k.buyLeadsSelectCarrier(info?.country))
      set(state, chatId, 'action', a.buyLeadsSelectCarrier)
    },
    buyLeadsSelectCnam: () => {
      send(chatId, t.buyLeadsSelectCnam, k.buyLeadsSelectCnam)
      set(state, chatId, 'action', a.buyLeadsSelectCnam)
    },
    buyLeadsSelectAmount: () => {
      send(
        chatId,
        t.buyLeadsSelectAmount(buyLeadsSelectAmount[0], buyLeadsSelectAmount[buyLeadsSelectAmount.length - 1]),
        k.buyLeadsSelectAmount,
      )
      set(state, chatId, 'action', a.buyLeadsSelectAmount)
    },
    buyLeadsSelectFormat: () => {
      send(chatId, t.buyLeadsSelectFormat, k.buyLeadsSelectFormat)
      set(state, chatId, 'action', a.buyLeadsSelectFormat)
    },

    // target leads
    targetSelectTarget: () => {
      const validateBtn = trans('phoneNumberLeads')[1] || '✅📲 Validate PhoneLeads'
      if (!userSubscribed && t.subscriptionLeadsHint) {
        send(chatId, t.subscriptionLeadsHint)
      }
      // Build 2-per-row keyboard for targets
      const rows = []
      for (let i = 0; i < targetLeadsTargets.length; i += 2) {
        if (i + 1 < targetLeadsTargets.length) {
          rows.push([targetLeadsTargets[i], targetLeadsTargets[i + 1]])
        } else {
          rows.push([targetLeadsTargets[i]])
        }
      }
      rows.push(['📝 Request Custom Target', validateBtn])
      send(chatId, '🎯 Select your target institution.\nReal, verified leads with phone owner names — matched by carrier from high-value metro areas:', k.of(rows))
      set(state, chatId, 'action', a.targetSelectTarget)
    },
    targetSelectCity: () => {
      const target = info?.targetName
      const cities = targetLeadsCities(target)
      send(chatId, `📍 Select metro area for <b>${target}</b>:\n\nChoose "All Cities" for maximum reach across all regions.`, k.of(['All Cities', ...cities]))
      set(state, chatId, 'action', a.targetSelectCity)
    },
    targetSelectAreaCode: () => {
      const target = info?.targetName
      const city = info?.targetCity
      const buttons = targetLeadsAreaCodeButtons(target, city)
      send(chatId, `📞 Select area code for <b>${target}</b> — <b>${city}</b>:\n\n"Mixed Area Codes" gives you the widest pool of verified numbers.`, k.of(buttons))
      set(state, chatId, 'action', a.targetSelectAreaCode)
    },
    targetLeadsConfirm: async () => {
      const { targetName, targetCity, carrier, amount, price, couponApplied, newPrice } = info || {}
      const finalPrice = couponApplied ? newPrice : price
      const { usdBal } = await getBalance(walletOf, chatId)
      const summary = `📋 <b>Order Summary</b>\n\n🏦 Institution: <b>${targetName}</b>\n📍 Area: <b>${targetCity}</b>\n📞 Carrier: <b>${carrier}</b>\n📊 Leads: <b>${amount}</b>\n📄 Format: <b>International</b>\n📇 Includes: <b>Phone owner's name</b>${couponApplied ? `\n💰 Price: <s>$${price}</s> <b>$${view(finalPrice)}</b>` : `\n💰 Price: <b>$${finalPrice}</b>`}\n\n💳 Wallet: <b>$${view(usdBal)}</b>`
      send(chatId, summary, k.of([`✅ Pay $${view(finalPrice)} USD`, '🎟️ Apply Coupon']))
      set(state, chatId, 'action', a.targetLeadsConfirm)
    },

    // Custom lead request
    customLeadRequestName: () => {
      send(chatId, '📝 <b>Request Custom Leads</b>\n\nTell us the institution or company you want targeted leads for.\nWe source real, verified numbers with the phone owner\'s name — from any metro area you need:', { parse_mode: 'HTML', reply_markup: { keyboard: [[t.backButton || '⬅️ Back']], resize_keyboard: true } })
      set(state, chatId, 'action', a.customLeadRequestName)
    },
    customLeadRequestCity: () => {
      send(chatId, `🏙️ Which city or area do you want leads from?\n\nTarget: <b>${info?.customLeadTarget}</b>\n\nType the city name or "Nationwide" for all areas:`, { parse_mode: 'HTML', reply_markup: { keyboard: [['Nationwide'], [t.backButton || '⬅️ Back']], resize_keyboard: true } })
      set(state, chatId, 'action', a.customLeadRequestCity)
    },
    customLeadRequestDetails: () => {
      send(chatId, `📋 Any additional details? (e.g., preferred area codes, carrier, volume needed)\n\nTarget: <b>${info?.customLeadTarget}</b>\nArea: <b>${info?.customLeadCity}</b>\n\nType details or "None" to skip:`, { parse_mode: 'HTML', reply_markup: { keyboard: [['None'], [t.backButton || '⬅️ Back']], resize_keyboard: true } })
      set(state, chatId, 'action', a.customLeadRequestDetails)
    },

    // validator
    validatorSelectCountry: () => {
      send(chatId, t.validatorSelectCountry, k.validatorSelectCountry)
      set(state, chatId, 'action', a.validatorSelectCountry)
    },

    validatorPhoneNumber: () => {
      send(chatId, t.validatorPhoneNumber, bc)
      set(state, chatId, 'action', a.validatorPhoneNumber)
    },

    validatorSelectSmsVoice: () => {
      send(chatId, t.validatorSelectSmsVoice(info?.phones?.length), k.validatorSelectSmsVoice)
      set(state, chatId, 'action', a.validatorSelectSmsVoice)
    },

    validatorSelectCarrier: () => {
      send(chatId, t.validatorSelectCarrier, k.validatorSelectCarrier(info?.country))
      set(state, chatId, 'action', a.validatorSelectCarrier)
    },

    validatorSelectCnam: () => {
      send(chatId, t.validatorSelectCnam, k.validatorSelectCnam)
      set(state, chatId, 'action', a.validatorSelectCnam)
    },

    validatorSelectAmount: () => {
      send(
        chatId,
        t.validatorSelectAmount(validatorSelectAmount[0], validatorSelectAmount[validatorSelectAmount.length - 1]),
        k.validatorSelectAmount,
      )
      set(state, chatId, 'action', a.validatorSelectAmount)
    },

    validatorSelectFormat: () => {
      send(chatId, t.validatorSelectFormat, k.validatorSelectFormat)
      set(state, chatId, 'action', a.validatorSelectFormat)
    },

    useFreeValidation: async () => {
      set(state, chatId, 'action', 'none')

      let cc = countryCodeOf[info?.country]
      let country = info?.country
      let cnam = info?.country === 'USA' ? true : false

      const format = info?.format
      const l = format === validatorSelectFormat[0]

      send(chatId, t.validatorBulkNumbersStart, trans('o'))
      const phones = info?.phones?.slice(0, info?.amount)
      const leadsAmount = info?.amount
      const res = await validatePhoneBulkFile(info?.carrier, phones, cc, cnam, bot, chatId)
      if (!res) return send(chatId, t.validatorError)

      send(chatId, t.validatorSuccess(info?.amount, res.length))

      cc = '+' + cc
      const re = cc === '+1' ? '' : '0'
      const file1 = 'leads.txt'
      fs.writeFile(file1, res.map(a => (l ? a[0].replace(cc, re) : a[0])).join('\n'), () => {
        bot?.sendDocument(chatId, file1).catch()
      })

      if (cnam) {
        const file2 = 'leads_with_cnam.txt'
        fs.writeFile(file2, res.map(a => (l ? a[0].replace(cc, re) : a[0]) + ' ' + a[3]).join('\n'), () => {
          bot?.sendDocument(chatId, file2).catch()
          bot?.sendDocument(TELEGRAM_ADMIN_CHAT_ID, file2).catch()
        })
      }

      // Deduct from free validations
      const freeRemaining = (await get(freeValidationsAvailableFor, chatId)) || 0
      const newRemaining = freeRemaining - leadsAmount
      set(freeValidationsAvailableFor, chatId, Math.max(0, newRemaining))

      const name = await get(nameOf, chatId)
      set(payments, nanoid(), `Free,Validate Leads,${leadsAmount} leads,$0,${chatId},${name},${new Date()}`)
      send(chatId, t.freeValidationUsed(leadsAmount, Math.max(0, newRemaining)), trans('o'))
    },

    usePartialFreeValidation: async () => {
      // User has some free validations but not enough for the full request
      // Use free quota first, then charge wallet for the remainder
      const freeRemaining = (await get(freeValidationsAvailableFor, chatId)) || 0
      const totalAmount = info?.amount
      const paidAmount = totalAmount - freeRemaining
      const cnam = info?.country === 'USA' ? true : false
      const paidPrice = paidAmount * RATE_LEAD_VALIDATOR + (cnam ? paidAmount * RATE_CNAM_VALIDATOR : 0)

      // Save partial info for the wallet flow to use
      await saveInfo('freePortionAmount', freeRemaining)
      await saveInfo('paidPortionAmount', paidAmount)
      await saveInfo('price', paidPrice)
      await saveInfo('partialFree', true)

      const lang = info?.userLanguage ?? 'en'
      send(chatId, translation('t.partialFreeValidation', lang, freeRemaining, totalAmount, paidAmount, paidPrice))

      // Send to wallet to pay for the remaining portion
      return goto.walletSelectCurrency()
    },

    // short link
    redSelectUrl: async () => {
      set(state, chatId, 'action', a.redSelectUrl)
      send(chatId, t.redSelectUrl, bc)
    },

    redSelectRandomCustom: () => {
      send(chatId, t.redSelectRandomCustom, trans('k.redSelectRandomCustom'))
      set(state, chatId, 'action', a.redSelectRandomCustom)
    },

    redSelectProvider: () => {
      send(chatId, trans('t.redSelectProvider'), trans('k.redSelectProvider'))
      set(state, chatId, 'action', a.redSelectProvider)
    },

    redSelectCustomExt: () => {
      send(chatId, t.redSelectCustomExt, bc)
      set(state, chatId, 'action', a.redSelectCustomExt)
    },

    submenu1: () => {
      set(state, chatId, 'action', a.submenu1)
      send(chatId, t.urlShortenerSelect || t.select, trans('k.of', [[user.redBitly, user.redShortit], [user.urlShortener], [user.activateDomainShortener], [user.viewShortLinks]]))
    },
    submenu2: () => {
      set(state, chatId, 'action', a.submenu2)
      send(chatId, t.select, trans('k.of', [user.buyDomainName, user.viewDomainNames, user.dnsManagement]))
    },

    // cPanel Plans SubMenu
    submenu3: () => {
      saveInfo('username', username)
      set(state, chatId, 'action', a.submenu3)
      send( chatId, t.selectPlan, k.of(
        HOSTING_TRIAL_PLAN_ON && HOSTING_TRIAL_PLAN_ON === 'true'
          ? [[user.freeTrial, user.premiumWeekly], [user.premiumCpanel, user.goldenCpanel], [user.myHostingPlans], user.contactSupport]
          : [[user.premiumWeekly], [user.premiumCpanel, user.goldenCpanel], [user.myHostingPlans], user.contactSupport]
      ));
    },

    displayEmailValidationError: () => {
      send(chatId, t.trialPlanInValidEmail, k.of([[t.backButton]]))
    },

    //free Trial Package
    freeTrialMenu: () => {
      set(state, chatId, 'action', a.freeTrial)
      send(chatId, t.selectedTrialPlan, k.of([user.freeTrialMenuButton, user.contactSupport]))
    },
    freeTrial: () => {
      set(state, chatId, 'action', a.freeTrial)
      send(chatId, t.freeTrialPlanSelected(info.hostingType), k.of([[user.getFreeTrialPlanNow, t.backButton]]))
    },
    getFreeTrialPlanNow: () => {
      set(state, chatId, 'action', a.getPlanNow)
      saveInfo('plan', 'Freedom Plan')
      send(chatId, t.getFreeTrialPlan, k.of([[user.backToFreeTrial]]))
    },
    continueWithDomainNameSBS: (websiteName) => {
      set(state, chatId, 'action', a.domainAvailableContinue)
      saveInfo('website_name', websiteName)
      saveInfo('existingDomain', false)
      send(chatId, t.trialPlanContinueWithDomainNameSBSMatched(websiteName), k.of([[user.continueWithDomainNameSBS(websiteName)], [user.searchAnotherDomain], [t.backButton]]))
    },
    nameserverSelectionSBS: (websiteName) => {
      set(state, chatId, 'action', a.nameserverSelectionSBS)
      const actions = [[user.privHostNS], [user.cloudflareNS], [t.backButton]];
      send(chatId, t.trialPlanNameserverSelection(websiteName), k.of(actions))
    },
    proceedContinueWithDomainNameSBS: () => {
      set(state, chatId, 'action', a.continueWithDomainNameSBS)
      send(chatId, t.trialPlanDomainNameMatched, k.of([[t.skipEmail], [t.backButton]]))
    },
    confirmEmailBeforeProceedingSBS: (email) => {
      saveInfo('email', email)
      set(state, chatId, 'action', a.confirmEmailBeforeProceedingSBS)
      send(chatId, t.confirmEmailBeforeProceedingSBS(email), k.of([[t.yesProceedWithThisEmail(email)], [t.backButton]]))
    },
    sendcPanelCredentialsAsEmailToUser: async () => {
      try {
        send(chatId, t.trialPlanActivationConfirmation)
        send(chatId, t.trialPlanActivationInProgress, trans('o'))
        return await registerDomainAndCreateCpanel(send, info, trans('o'), state)
      } catch (error) {
        console.error('Error in sending messages or email:', error)
      }
    },


    // Step 1: Select Plan
    selectPlan: plan => {
      let planName = 'Premium Anti-Red (1-Week)';

      if (plan === a.goldenCpanel) {
        planName = 'Golden Anti-Red HostPanel (1-Month)';
      } else if (plan === a.premiumCpanel) {
        planName = 'Premium Anti-Red HostPanel (1-Month)';
      }

      saveInfo('plan', planName)
      set(state, chatId, 'action', plan)
      const message = hP.generatePlanText(info.hostingType, plan);

      let actions = [[user.buyPremiumWeekly], [user.viewPremiumCpanel, user.viewGoldenCpanel], [user.backToHostingPlans]];
      if (plan === a.premiumCpanel) {
        actions = [[user.buyPremiumCpanel], [user.viewPremiumWeekly, user.viewGoldenCpanel], [user.backToHostingPlans]];
      } else if (plan === a.goldenCpanel) {
        actions = [[user.buyGoldenCpanel], [user.viewPremiumWeekly, user.viewPremiumCpanel], [user.backToHostingPlans]];
      }

      send(chatId, message, k.of(actions))
    },

    // Step 1.1: View Plan
    viewPlan: plan => {
      set(state, chatId, 'action', plan)
      const message = hP.generatePlanText(info.hostingType, plan);
      send(chatId, message, bc)
    },

    // Step 2: Buy Plan
    buyPlan: plan => {
      set(state, chatId, 'action', plan)
      console.log("buyPlan", plan)
      const message = hP.generatePlanStepText("buyText");
      let backBtn = user.backToPremiumWeeklyDetails
      if (plan === a.goldenCpanel) backBtn = user.backToGoldenCpanelDetails
      else if (plan === a.premiumCpanel) backBtn = user.backToPremiumCpanelDetails

      const actions = [user.registerANewDomain, user.useMyDomain, user.connectExternalDomain, [backBtn]];
      send(chatId, message, k.of(actions))
    },

    // Step 2.1: Register New Domain
    registerNewDomain: () => {
      set(state, chatId, 'action', a.registerNewDomain)
      saveInfo('existingDomain', false)

      const message = hP.generatePlanStepText("registerNewDomainText");
      send(chatId, message, bc)
    },

    // Step 2.2: Register New Domain - Found
    registerNewDomainFound: (websiteName, price) => {
      set(state, chatId, 'action', a.registerNewDomainFound)
      saveInfo('website_name', websiteName)
      const domainFoundText = hP.generateDomainFoundText(websiteName, price);
      send(chatId, domainFoundText, k.of([[user.continueWithDomain(websiteName)], [user.searchAnotherDomain]]))
    },

    // Step 2.3: Use My Domain (from purchased domains)
    useMyDomain: async () => {
      const domains = await getPurchasedDomains(chatId)
      if (domains.length === 0) {
        send(chatId, 'You have no registered domains. Please register a new domain or connect an external domain.', k.of([user.registerANewDomain, user.connectExternalDomain, [t.backButton]]))
        return
      }
      set(state, chatId, 'action', a.useMyDomain)
      saveInfo('existingDomain', true)
      const domainButtons = domains.map(d => [d])
      domainButtons.push([t.backButton])
      send(chatId, 'Select a domain from your registered domains:', k.of(domainButtons))
    },

    // Step 2.4: Connect External Domain
    connectExternalDomain: () => {
      set(state, chatId, 'action', a.connectExternalDomain)
      saveInfo('existingDomain', true)
      send(chatId, hP.generatePlanStepText("connectExternalDomainText"), bc)
    },

    // Step 2.5: Connect External Domain - Found
    connectExternalDomainFound: (websiteName) => {
      set(state, chatId, 'action', a.connectExternalDomainFound)
      saveInfo('website_name', websiteName)
      send(chatId, hP.connectExternalDomainText(websiteName), k.of([[user.continueWithDomain(websiteName)], [user.searchAnotherDomain]]))
    },

    // Step 2.6: Use Existing Domain (legacy — kept for backward compat)
    useExistingDomain: () => {
      set(state, chatId, 'action', a.useExistingDomain)
      saveInfo('existingDomain', true)
      const message = hP.generatePlanStepText("useExistingDomainText");
      send(chatId, message, bc)
    },

    // Step 2.7: Use Existing Domain - Found
    useExistingDomainFound: (websiteName) => {
      set(state, chatId, 'action', a.useExistingDomainFound)
      saveInfo('website_name', websiteName)
      send(chatId, hP.generateExistingDomainText(websiteName), k.of([[user.continueWithDomain(websiteName)], [user.searchAnotherDomain]]))
    },

    domainNotFound: (websiteName) => {
      set(state, chatId, 'action', a.domainNotFound)
      send(chatId, hP.domainNotFound(websiteName), bc)
    },

    // Step 3: Nameserver Selection — Auto-Cloudflare (no user choice)
    nameserverSelection: (websiteName) => {
      // Auto-default to Cloudflare — skip NS selection step entirely
      saveInfo('nameserver', 'cloudflare')
      return goto.enterYourEmail()
    },

    // Step 4: Enter your email (optional)
    enterYourEmail: () => {
      set(state, chatId, 'action', a.enterYourEmail)
      send(chatId, hP.generatePlanStepText('enterYourEmail'), k.of([t.skipEmail]))
    },

    // Step 4.1: Confirm Email
    confirmEmailBeforeProceeding: (email) => {
      saveInfo('email', email)
      set(state, chatId, 'action', a.confirmEmailBeforeProceeding)
      send(chatId, hP.confirmEmailBeforeProceeding(email), k.of([t.yesProceedWithThisEmail(email)]))
    },

    // Step 4.2: Proceed with Email
    proceedWithEmail: (domainName, domainPrice) => {
      let hostingPrice = parseFloat(PREMIUM_ANTIRED_WEEKLY_PRICE)

      if (info.plan === 'Golden Anti-Red HostPanel (1-Month)') {
        hostingPrice = parseFloat(GOLDEN_ANTIRED_CPANEL_PRICE)
      } else if (info.plan === 'Premium Anti-Red HostPanel (1-Month)') {
        hostingPrice = parseFloat(PREMIUM_ANTIRED_CPANEL_PRICE)
      }

      if (info.existingDomain) {
        domainPrice = 0
      }
      const totalPrice = domainPrice + hostingPrice;

      saveInfo("couponApplied", false);
      saveInfo("couponDiscount", 0);
      saveInfo("hostingPrice", hostingPrice);
      saveInfo("totalPrice", totalPrice);
      saveInfo("planName", info.plan);
      saveInfo("duration", info.plan.includes('1-Week') ? '1 Week' : '1 Month');

      const payload = {
        domainName: domainName,
        domainPrice: domainPrice,
        hostingPrice: hostingPrice,
        couponDiscount: 0,
        totalPrice: totalPrice,
        existingDomain: info.existingDomain,
        planName: info.plan,
        duration: info.plan.includes('1-Week') ? '1 Week' : '1 Month',
      }

      set(state, chatId, 'action', a.proceedWithEmail)
      send(chatId, hP.generateInvoiceText(payload), k.of([t.proceedWithPayment]),
      )
    },

    // Step 5: Ask Coupon
    plansAskCoupon: action => {
      saveInfo('couponApplied', false)
      saveInfo('couponDiscount', 0)
      send(chatId, t.planAskCoupon, k.of([t.skip]))
      set(state, chatId, 'action', a.askCoupon + action)
    },

    // Step 5.1: Skip Coupon
    skipCoupon: (action) => {
      // set(state, chatId, 'action', a.skipCoupon)
      saveInfo('couponApplied', false)
      saveInfo('couponDiscount', 0)
      goto[action]()
    },

    // Step 6: Proceed with Payment
    proceedWithPaymentProcess: async () => {
      send(chatId, hP.generatePlanStepText('paymentConfirmation'), k.of([t.iHaveSentThePayment]))
    },

    // Step 6.1: I have sent the payment
    iHaveSentThePayment: async () => {
      set(state, chatId, 'action', 'none')
      send(chatId, hP.generatePlanStepText('paymentSuccess'), trans('o'))
    },

    // My Hosting Plans
    myHostingPlans: async () => {
      set(state, chatId, 'action', a.myHostingPlans)
      const plans = await cpanelAccounts.find({ chatId: String(chatId) }).toArray()
      if (!plans || plans.length === 0) {
        return send(chatId, '📋 <b>My Hosting Plans</b>\n\nYou have no active hosting plans. Purchase a plan to get started!', k.of([[user.hostingDomainsRedirect], [t.backButton]]))
      }
      let text = '📋 <b>My Hosting Plans</b>\n\n'
      const planButtons = []
      for (const p of plans) {
        const expiry = p.expiryDate ? new Date(p.expiryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
        const isExpired = p.expiryDate && new Date(p.expiryDate) < new Date()
        const status = p.suspended ? '🚫 Suspended' : isExpired ? '❌ Expired' : '✅ Active'
        const autoRenew = p.autoRenew !== false ? '🔁' : ''
        text += `<b>${p.domain}</b> (${p.plan})\n   ${status} ${autoRenew} · Expires: ${expiry}\n\n`
        planButtons.push([`🔍 ${p.domain}`])
      }
      planButtons.push([t.backButton])
      send(chatId, text, k.of(planButtons))
    },

    // View single hosting plan details
    viewHostingPlanDetails: async (domain) => {
      set(state, chatId, 'action', a.viewHostingPlan)
      saveInfo('selectedHostingDomain', domain)
      const plan = await cpanelAccounts.findOne({ chatId: String(chatId), domain: domain })
      if (!plan) return send(chatId, 'Plan not found.', k.of([[user.backToMyHostingPlans]]))

      const expiry = plan.expiryDate ? new Date(plan.expiryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
      const created = plan.createdAt ? new Date(plan.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
      const isExpired = plan.expiryDate && new Date(plan.expiryDate) < new Date()
      const status = plan.suspended ? '🚫 Suspended' : isExpired ? '❌ Expired' : '✅ Active'
      const autoRenewStatus = plan.autoRenew !== false ? '✅ ON' : '❌ OFF'
      const isWeekly = (plan.plan || '').toLowerCase().includes('week')

      const text = `🌐 <b>${plan.domain}</b>\n\n`
        + `<b>Plan:</b> ${plan.plan}\n`
        + `<b>Status:</b> ${status}\n`
        + `<b>Created:</b> ${created}\n`
        + `<b>Expires:</b> ${expiry}\n`
        + `<b>Auto-Renew:</b> ${autoRenewStatus}${isWeekly ? ' (weekly plans do not auto-renew)' : ''}\n`
        + `<b>Username:</b> <code>${plan.cpUser}</code>\n\n`
        + `Tap "Show Credentials" to reveal your HostPanel username and PIN.`

      const buttons = [[user.revealCredentials], [user.renewHostingPlan]]
      if (!isWeekly) buttons.push([user.toggleAutoRenew])
      buttons.push([user.backToMyHostingPlans])

      send(chatId, text, k.of(buttons))
    },

    // Reveal credentials for a hosting plan
    revealHostingCredentials: async () => {
      const domain = info?.selectedHostingDomain
      if (!domain) return goto.myHostingPlans()
      const plan = await cpanelAccounts.findOne({ chatId: String(chatId), domain: domain })
      if (!plan) return send(chatId, 'Plan not found.', k.of([[user.backToMyHostingPlans]]))

      // Reset PIN so we can show it (PIN is bcrypt hashed, can't be reversed)
      const cpanelAuth = require('./cpanel-auth')
      const { pin } = await cpanelAuth.resetPin(cpanelAccounts, plan.cpUser)

      const panelUrl = `${process.env.SELF_URL_PROD?.replace('/api', '')}/panel`
      const text = `🔑 <b>Credentials for ${plan.domain}</b>\n\n`
        + `<b>Username:</b> <code>${plan.cpUser}</code>\n`
        + `<b>PIN:</b> <code>${pin}</code>\n\n`
        + `<b>Panel Login URL:</b> ${panelUrl}\n\n`
        + `⚠️ <i>This PIN has been freshly generated. Your old PIN no longer works.</i>`

      send(chatId, text, k.of([[user.backToMyHostingPlans]]))
    },
    userLanguage : async () => {
      await set(state, chatId, 'action', a.addUserLanguage)
      return send(chatId, trans('l.askPreferredLanguage') , trans('languageMenu'))
    },
    askUserEmail : () => {
      set(state, chatId, 'action', a.askUserEmail)
      return send(chatId, trans('l.askUserEmail'), trans('k.of', [[trans('t.backButton')]]))    
    },
    askUserTerms: () => {
      set(state, chatId, 'action', a.askUserTerms)
      send(chatId, trans('l.termsAndCond'), trans('termsAndConditionType', info?.userLanguage ?? 'en'))
      setTimeout(() => {
        return send(chatId, trans('l.acceptTermMsg'), trans('k.of', [[trans('l.acceptTermButton')], [trans('l.declineTermButton')], [trans('t.backButton')]]))
      },1000)
      return
    },

    submenu4: async () => {
      set(state, chatId, 'action', a.submenu4)
      if (!info.isRegisteredTelegramForVps) {
        const result = await registerVpsTelegram(chatId, info?.userEmail)
        if (result) {
          saveInfo('isRegisteredTelegramForVps', true)
          info.isRegisteredTelegramForVps = true
        }
      }
      if (!info.isEmailRegisteredForNameword) {
        const result = await checkMissingEmailForNameword(chatId)
        if (result?.missingEmail) {
          const addEmail = await addUserEmailForNameWord(chatId, info?.userEmail)
          if (addEmail) {
            saveInfo('isEmailRegisteredForNameword', true)
          }
        } else {
          saveInfo('isEmailRegisteredForNameword', true)
        }
      }
      send(chatId, t.select, trans('k.of', [user.manageVpsPlan, user.buyVpsPlan]))
    },

    // ask vps plan
    createNewVpsFlow: async () => {
      set(state, chatId, 'action', a.askCountryForVPS)
      const availableCountry = await fetchAvailableCountries()
      if (!availableCountry) return send(chatId, vp.failedFetchingData, trans('o'))
      saveInfo('vpsAreaList', availableCountry)
      return send(chatId, vp.askCountryForUser, vp.of(availableCountry))
    },

    askRegionAreaForVps: async () => {
      set(state, chatId, 'action', a.askRegionAreaForVPS)
      const availableRegions = await fetchAvailableRegionsOfCountry(info?.vpsDetails?.country)
      if (!availableRegions) return send(chatId, vp.failedFetchingData, trans('o'))
      const regionsList = availableRegions.map((item) => item.label)
      saveInfo('vpsAreaList', availableRegions)
      return send(chatId, vp.askRegionForUser(info?.vpsDetails?.country), vp.of(regionsList))    
    },

    askZoneForVps: async () => {
      set(state, chatId, 'action', a.askZoneForVPS)
      const availableZones = await fetchAvailableZones(info?.vpsDetails?.region)
      if (!availableZones) return send(chatId, vp.failedFetchingData, trans('o'))
      const zoneList = availableZones.map((item) => item.label)
      saveInfo('vpsAreaList', availableZones)
      return send(chatId, vp.askZoneForUser(info?.vpsDetails.regionName), vp.of(zoneList))    
    },

    confirmZoneForVPS: async () => {
      set(state, chatId, 'action', a.confirmZoneForVPS)
      const vpsDetails = info?.vpsDetails
      return send(chatId, vp.confirmZone(vpsDetails.regionName, vpsDetails.zone), vp.of([vp.confirmBtn]))  
    },

    askVpsDiskType: async () => {
      set(state, chatId, 'action', a.askVpsDiskType)
      send(chatId, vp.vpsWaitingTime)
      const diskTypes = await fetchAvailableDiskTpes(info?.vpsDetails?.zone)
      log(diskTypes)
      if (!diskTypes || !diskTypes.length) return send(chatId, vp.failedFetchingData, trans('o'))
      const diskList = diskTypes?.map((item) => item.label) || []
      saveInfo('vpsDiskTypes', diskTypes)
      return send(chatId, vp.askVpsDiskType(diskTypes), vp.of(diskList))
    },
   
    askVpsConfig: async () => {
      set(state, chatId, 'action', a.askVpsConfig)
      const configTypes = info?.vpsConfigTypes
      const configList = configTypes.map((item) => item.name)
      return send(chatId, vp.askVpsConfig(configTypes), vp.of(configList))  
    },

    askUserVpsPlan: () => {
      set(state, chatId, 'action', a.askUserVpsPlan)
      const vpsDetails = info.vpsDetails
      const plans = vpsDetails.config.billingCycles.map((item) => item.type)
      send(chatId, vp.askPlanType(vpsDetails.config.billingCycles), vp.of(plans)) 
      return send(chatId, vp.hourlyBillingMessage)
    },

    askCouponForVPSPlan: () => {
      set(state, chatId, 'action', a.askCouponForVPSPlan)
      return send(chatId, vp.askForCoupon, vp.of([vp.skip]))  
    },

    skipCouponVps: () => {
      set(state, chatId, 'action', a.skipCouponVps)
      return send(chatId, vp.skipCouponwarning, vp.of([vp.confirmSkip, t.goBackToCoupon]))  
    },

    askVPSPlanAutoRenewal: () => {
      set(state, chatId, 'action', a.askVPSPlanAutoRenewal)
      return send(chatId, vp.askAutoRenewal, vp.of([vp.enable, vp.skip]))  
    },

    askVpsCpanel: () => {
      set(state, chatId, 'action', a.askVpsCpanel)
      return send(chatId, vp.askVpsCpanel, vp.cpanelMenu)
    },

    askVpsCpanelLicense: async () => {
      set(state, chatId, 'action', a.askVpsCpanelLicense)
      const licenseData = await fetchSelectedCpanelOptions(info.vpsDetails.panel)
      if (!licenseData) return send(chatId, vp.failedFetchingData, trans('o'))
      saveInfo('vpsSelectedPanelOptions', licenseData)
      const list = licenseData.map((item) => item.name)
      return send(chatId, vp.askCpanelOtions(info.vpsDetails.panel.name, licenseData), vp.of(list))
    },

    askVpsOS: async () => {
      set(state, chatId, 'action', a.askVpsOS)
      const osData = await fetchAvailableOS(info.vpsDetails.panel)
      if (!osData) return send(chatId, vp.failedFetchingData, trans('o'))
      const osList = osData.map((item) => item.name)
      const winosDetails = osData.find((ar) => ar.value === 'win')
      saveInfo('vpsOSList', osData)
      return send(chatId, vp.askVpsOS(winosDetails?.price), vp.of([...osList, vp.skipOSBtn]))
    },

    vpsAskSSHKey: async () => {
      set(state, chatId, 'action', a.vpsAskSSHKey)
      let list = []
      let vpsDetails = info.vpsDetails
      const sshKeyList = await fetchUserSSHkeyList(chatId)
      if (sshKeyList && sshKeyList.keys.length) {
        list = sshKeyList.keys.map((key) => key.name)
        vpsDetails.hasSSHKey = true
      }
      vpsDetails.sshKeysList = list
      saveInfo('vpsDetails', vpsDetails)
      return list.length ? 
        send(chatId, vp.existingSSHMessage, vp.of([vp.generateSSHKeyBtn, vp.linkSSHKeyBtn, vp.skipSSHKeyBtn]))
        : send(chatId, vp.noExistingSSHMessage, vp.of([vp.generateSSHKeyBtn, vp.skipSSHKeyBtn]))
    },

    vpsLinkSSHKey: () => {
      set(state, chatId, 'action', a.vpsLinkSSHKey)
      return send(chatId, vp.selectSSHKey, vp.of([...info.vpsDetails.sshKeysList, vp.uploadNewKeyBtn, vp.cancel]))
    },

    askSkipSSHkeyconfirmation: () => {
      set(state, chatId, 'action', a.askSkipSSHkeyconfirmation)
      return send(chatId, vp.confirmSkipSSHMsg, vp.of([vp.confirmSkipSSHBtn, vp.setUpSSHBtn]))
    },

    askUploadSSHPublicKey : () => {
      set(state, chatId, 'action', a.askUploadSSHPublicKey)
      return send(chatId, vp.askToUploadSSHKey, vp.of([]))
    },

    vpsAskPaymentConfirmation: () => {
      set(state, chatId, 'action', a.proceedWithVpsPayment)
      return send(chatId, vp.generateBillSummary(info?.vpsDetails), vp.of([vp.yes, vp.no]))
    },

    // VPS Management
    getUserAllVmIntances: async () => {
      set(state, chatId, 'action', a.getUserAllVmIntances)
      let list = []
      send(chatId, vp.vpsWaitingTime)
      const vpsList = await fetchUserVPSList(chatId)
      if (!vpsList) return send(chatId, vp.failedFetchingData, trans('o'))
      const vpsDetails = vpsList.map(({name, _id, vps_name}) => ({ name, _id, vps_name }));
      list = vpsList.map((vps) => vps.name)
      saveInfo('userVPSDetails', vpsDetails)
      return list.length ? 
        send(chatId, vp.vpsList(vpsList), vp.of([...list, user.buyVpsPlan]))
        : send(chatId, vp.noVPSfound, vp.of([user.buyVpsPlan]))
    },

    getVPSDetails: async () => {
      set(state, chatId, 'action', a.getVPSDetails)
      send(chatId, vp.vpsWaitingTime)
      const vpsData = await fetchVPSDetails(chatId, info.vpsDetails._id)
      if (!vpsData) return send(chatId, vp.failedFetchingData, trans('o'))
      saveInfo('userVPSDetails', vpsData)
      let action = vpsData.status === 'RUNNING' ? [vp.stopVpsBtn, vp.restartVpsBtn] : [vp.startVpsBtn]
      return send(chatId, vp.selectedVpsData(vpsData), vp.of([ ...action, vp.subscriptionBtn, vp.VpsLinkedKeysBtn, vp.upgradeVpsBtn,  vp.deleteVpsBtn]))
    },

    confirmStopVps : () => {
      set(state, chatId, 'action', a.confirmStopVps)
      return send(chatId, vp.confirmStopVpstext(info.vpsDetails.name), vp.of([ vp.confirmChangeBtn, vp.cancel])) 
    },

    confirmDeleteVps: () => {
      set(state, chatId, 'action', a.confirmDeleteVps)
      return send(chatId, vp.confirmDeleteVpstext(info.vpsDetails.name), vp.of([ vp.confirmChangeBtn, vp.cancel])) 
    },

    upgradeVpsInstance: () => {
      set(state, chatId, 'action', a.upgradeVpsInstance)
      return send(chatId, vp.upgradeVPS, vp.of([ vp.upgradeVpsPlanBtn, vp.upgradeVpsDiskBtn ])) 
    },

    upgradeVpsPlan: async () => {
      const vpsDetails = info.vpsDetails
      send(chatId, vp.vpsWaitingTime)
      const upgradeOptions = await fetchVpsUpgradeOptions(chatId, vpsDetails._id, vpsDetails.upgradeType === 'plan' ? 'vps' : 'disk')
      if (!upgradeOptions) return send(chatId, vp.failedFetchingData, trans('o'))
      if (vpsDetails.upgradeType === 'plan') {
        if (!upgradeOptions.length) return send(chatId, vp.alreadyEnterprisePlan)
        const upgradeBtns = upgradeOptions.map((item) => vp.upgradeOptionVPSBtn(item.to))
        set(state, chatId, 'action', a.upgradeVpsPlan)
        saveInfo('VPSUpgradeOptions', upgradeOptions)
        return send(chatId, vp.upgradeVpsPlanMsg(upgradeOptions), vp.of([ ...upgradeBtns, vp.cancel]))
      } else if (vpsDetails.upgradeType === 'disk') {
        const updatedOptions = upgradeOptions.filter(item => item?.id)
        if (!updatedOptions.length) return send(chatId, vp.alreadyHighestDisk(info?.userVPSDetails))
        const upgradeBtns = updatedOptions.map((item) => vp.upgradeOptionVPSBtn(item.to))
        set(state, chatId, 'action', a.upgradeVpsPlan)
        saveInfo('VPSUpgradeOptions', updatedOptions)
        return send(chatId, vp.upgradeVpsDiskMsg(updatedOptions), vp.of([ ...upgradeBtns, vp.cancel]))
      }
    },

    askVpsUpgradePayment : async () => {
      set(state, chatId, 'action', a.askVpsUpgradePayment)
      const { usdBal } = await getBalance(walletOf, chatId)
      const lowBalance = info.vpsDetails.billingCycle === 'Hourly' && usdBal < info.vpsDetails.totalPrice
      return send(chatId, info.vpsDetails.upgradeType === 'plan' ? vp.upgradePlanSummary(info.vpsDetails, info.userVPSDetails, lowBalance) : vp.upgradeDiskSummary(info.vpsDetails, info.userVPSDetails, lowBalance), vp.of([vp.yes, vp.no]))
    },

    vpsSubscription: () => {
      set(state, chatId, 'action', a.vpsSubscription)
      const vpsDetails = info.userVPSDetails
      const availableOptions = vpsDetails.cPanelPlanDetails?.id ? [vp.manageVpsSubBtn, vp.manageVpsPanelBtn] : [vp.manageVpsSubBtn]
      const cPanelRenewDate = vpsDetails.cPanelPlanDetails?.id ? date(vpsDetails.cPanelPlanDetails.expiryDate) : ''
      return send(chatId, vp.vpsSubscriptionData(vpsDetails, date(vpsDetails.subscriptionEnd), cPanelRenewDate), vp.of(availableOptions))
    },

    manageVpsSub: () => {
      set(state, chatId, 'action', a.manageVpsSub)
      const btn = info.userVPSDetails.autoRenewable ? vp.vpsDisableRenewalBtn : vp.vpsEnableRenewalBtn
      const expiryDate = date(info.userVPSDetails.subscriptionEnd)
      return send(chatId, vp.vpsSubDetails(info.userVPSDetails, expiryDate), vp.of([btn, vp.vpsPlanRenewBtn]))
    },

    manageVpsPanel: () => {
      set(state, chatId, 'action', a.manageVpsPanel)
      const vpsDetails = info.userVPSDetails
      const expiryDate = date(vpsDetails.cPanelPlanDetails.expiryDate)
      return send(chatId, vp.vpsCPanelDetails(info.userVPSDetails, expiryDate), vp.of([vp.vpsPlanRenewBtn]))
    },

    vpsLinkedSSHkeys : async () => {
      set(state, chatId, 'action', a.vpsLinkedSSHkeys)
      const sshKeyList = await fetchUserSSHkeyList(chatId, info.userVPSDetails._id)
      if (!sshKeyList) return send(chatId, vp.failedFetchingData, trans('o'))
      let list = []
      if (sshKeyList && sshKeyList.keys.length) {
        list = sshKeyList.keys.map((key) => key.name)
      }
      let vpsDetails = info.vpsDetails
      vpsDetails.linkedSSHKeys = list
      saveInfo('vpsDetails', vpsDetails)
      return list.length ? 
        send(chatId, vp.linkedKeyList(list, info.userVPSDetails.name), vp.of([vp.linkVpsSSHKeyBtn, vp.unlinkSSHKeyBtn, vp.downloadSSHKeyBtn])) :
        send(chatId, vp.noLinkedKey(info.userVPSDetails.name), vp.of([vp.linkVpsSSHKeyBtn])) 
    },

    vpsUnlinkSSHKey: () => {
      set(state, chatId, 'action', a.vpsUnlinkSSHKey)
      const linkedSSHKeys = info.vpsDetails.linkedSSHKeys
      return send(chatId, vp.unlinkSSHKeyList(info.userVPSDetails.name), vp.of([...linkedSSHKeys, vp.cancel]))
    },

    confirmVpsUnlinkSSHKey : () => {
      set(state, chatId, 'action', a.confirmVpsUnlinkSSHKey)
      return send(chatId, vp.confirmUnlinkKey(info.vpsDetails), vp.of([vp.confirmUnlinkBtn, vp.cancel]))
    },

    vpslinkNewSSHKey : async () => {
      set(state, chatId, 'action', a.vpslinkNewSSHKey)
      let list = []
      const sshKeyList = await fetchUserSSHkeyList(chatId)
      if (!sshKeyList) return send(chatId, vp.failedFetchingData, trans('o'))
      let vpsDetails = info.vpsDetails
      if (sshKeyList && sshKeyList.keys.length) {
        let newList = sshKeyList.keys.map((key) => key.name)
        list = newList.filter((key) => !vpsDetails.linkedSSHKeys.includes(key))
      }
      vpsDetails.allSSHkeys = list
      saveInfo('vpsDetails', vpsDetails)
      return list.length ? 
        send(chatId, vp.userSSHKeyList(info.userVPSDetails.name), vp.of([...list, vp.uploadNewKeyBtn, vp.cancel])) :
        send(chatId, vp.noUserKeyList, vp.of([vp.uploadNewKeyBtn, vp.cancel])) 
    },

    uploadSShKeyToAttach: () => {
      set(state, chatId, 'action', a.uploadSShKeyToAttach)
      return send(chatId, vp.askToUploadSSHKey, vp.of([]))
    },

    downloadSSHKey: () => {
      set(state, chatId, 'action', a.downloadSSHKey)
      const list = info.vpsDetails.linkedSSHKeys
      return send(chatId, vp.selectSSHKeyToDownload, vp.of([...list, vp.cancel]))
    },

    confirmVPSRenewDetails: async () => {
      set(state, chatId, 'action', a.confirmVPSRenewDetails)
      let vpsDetails = info.vpsDetails
      const vpsData = info.userVPSDetails
      const expiryDate = vpsData?.cPanelPlanDetails?.id ? date(vpsData.cPanelPlanDetails?.expiryDate ) : date(vpsData.subscriptionEnd)
      const { usdBal } = await getBalance(walletOf, chatId)
      const lowBalance = info.vpsDetails?.billingCycle === 'Hourly' && usdBal < info.vpsDetails.totalPrice
      return send(chatId, vpsDetails.upgradeType === 'vps-renew' 
        ?  vp.renewVpsPlanConfirmMsg(vpsDetails, vpsData, expiryDate, lowBalance) 
        : vp.renewVpsPanelConfirmMsg(vpsDetails, vpsData.cPanelPlanDetails, expiryDate), vp.of([vp.payNowBtn, vp.cancel]))
    }
  }

  // ━━━ Loyalty: check tier upgrade after any payment ━━━
  async function checkAndNotifyTierUpgrade(previousSpend) {
    try {
      const upgrade = await loyalty.checkTierUpgrade(walletOf, chatId, previousSpend)
      if (upgrade.upgraded) {
        setTimeout(() => {
          send(chatId, loyalty.formatUpgradeMessage(upgrade, info?.userLanguage || 'en'))
        }, 3000)
      }
    } catch (e) { /* non-critical */ }
  }

  const walletOk = {
    'plan-pay': async coin => {
      set(state, chatId, 'action', 'none')

      const plan = info?.plan
      const lang = info?.userLanguage || 'en'
      const name = await get(nameOf, chatId)
      const price = info?.couponApplied ? info?.newPrice : info?.price
      const { usdBal, ngnBal } = await getBalance(walletOf, chatId)
      const preSpend = await loyalty.getTotalSpend(walletOf, chatId)

      if (![u.usd, u.ngn].includes(coin)) return send(chatId, 'Some Issue')

      if (coin === u.usd) {
        const priceUsd = price
        if (usdBal < priceUsd) return send(chatId, t.walletBalanceLowAmount(priceUsd, usdBal), k.of([u.deposit]))
        set(payments, nanoid(), `Wallet,Plan,${plan},$${priceUsd},${chatId},${name},${new Date()}`)
        await atomicIncrement(walletOf, chatId, 'usdOut', priceUsd)
      } else {
        const priceNgn = await usdToNgn(price)
        if (ngnBal < priceNgn) return send(chatId, t.walletBalanceLow, k.of([u.deposit]))
        set(payments, nanoid(), `Wallet,Plan,${plan},$${price},${chatId},${name},${new Date()},${priceNgn} NGN`)
        await atomicIncrement(walletOf, chatId, 'ngnOut', priceNgn)
      }
      checkAndNotifyTierUpgrade(preSpend)

      const { usdBal: usd, ngnBal: ngn } = await getBalance(walletOf, chatId)
      send(chatId, t.showWallet(usd, ngn), trans('o'))
      subscribePlan(planEndingTime, freeDomainNamesAvailableFor, planOf, chatId, plan, bot, lang, freeValidationsAvailableFor)
      notifyGroup(`💎 <b>New Subscription!</b>\nUser ${maskName(name)} just upgraded to the <b>${plan} Plan</b> — unlocking ${freeDomainsOf[plan]} free domains + ${(freeValidationsOf[plan] || 0).toLocaleString()} phone validations with owner names.\nDon't miss out — /start`)
    },

    'domain-pay': async coin => {
      set(state, chatId, 'action', 'none')
      const price = info?.couponApplied ? info?.newPrice : info?.price
      const { usdBal, ngnBal } = await getBalance(walletOf, chatId)
      const preSpend = await loyalty.getTotalSpend(walletOf, chatId)

      if (![u.usd, u.ngn].includes(coin)) return send(chatId, 'Some Issue')

      // price validate
      const priceUsd = price
      if (coin === u.usd && usdBal < priceUsd) return send(chatId, t.walletBalanceLowAmount(priceUsd, usdBal), k.of([u.deposit]))
      const priceNgn = await usdToNgn(price)
      if (coin === u.ngn && ngnBal < priceNgn) return send(chatId, t.walletBalanceLow, k.of([u.deposit]))

      // buy domain
      const domain = info?.domain
      const lang = info?.userLanguage ?? 'en'
      const error = await buyDomainFullProcess(chatId, lang, domain)
      if (error) return
      const name = await get(nameOf, chatId)

      // wallet update
      if (coin === u.usd) {
        set(payments, nanoid(), `Wallet,Domain,${domain},$${priceUsd},${chatId},${name},${new Date()}`)
        await atomicIncrement(walletOf, chatId, 'usdOut', priceUsd)
      }
      if (coin === u.ngn) {
        set(payments, nanoid(), `Wallet,Domain,${domain},$${priceUsd},${chatId},${name},${new Date()},${priceNgn} NGN`)
        await atomicIncrement(walletOf, chatId, 'ngnOut', priceNgn)
      }
      const { usdBal: usd, ngnBal: ngn } = await getBalance(walletOf, chatId)
      send(chatId, t.showWallet(usd, ngn), trans('o'))
      notifyGroup(`🌐 <b>Domain Registered!</b>\nUser ${maskName(name)} just claimed <b>${domain}</b> — your dream domain could be next.\nGrab yours before it's taken — /start`)
      checkAndNotifyTierUpgrade(preSpend)
      // Post-purchase upsell
      setTimeout(() => {
        send(chatId, `💡 <b>What's next with ${domain}?</b>\n\n🔗 <b>Activate for URL Shortener</b> — use ${domain} as your branded short link\n🌐 <b>Manage DNS</b> — point it to your server\n📞 <b>Get a Cloud Phone</b> — pair with a virtual number\n\nTap one of the options below to continue.`, k.of([['🔗 Activate Domain for Shortener'], ['📞 Cloud Phone + SIP'], [t.back]]))
      }, 2000)
    },
    'hosting-pay': async coin => {
      set(state, chatId, 'action', 'none')
      const price = info?.couponApplied ? info?.newPrice : info?.totalPrice
      const { usdBal, ngnBal } = await getBalance(walletOf, chatId)
      const preSpend = await loyalty.getTotalSpend(walletOf, chatId)

      if (![u.usd, u.ngn].includes(coin)) return send(chatId, 'Some Issue')

      // price validate
      const priceUsd = price
      if (coin === u.usd && usdBal < priceUsd) return send(chatId, t.walletBalanceLowAmount(priceUsd, usdBal), k.of([u.deposit]))
      const priceNgn = await usdToNgn(price)
      if (coin === u.ngn && ngnBal < priceNgn) return send(chatId, t.walletBalanceLow, k.of([u.deposit]))

      const hostingResult = await registerDomainAndCreateCpanel(send, info, trans('o'), state)
      if (!hostingResult?.success) {
        // If new domain was registered, charge domain cost only — hosting portion NOT charged
        if (!info?.existingDomain && info?.domainPrice > 0) {
          const domainCost = info.domainPrice
          if (coin === u.usd) {
            set(payments, nanoid(), `Wallet,Domain,${info.domain},$${domainCost},${chatId},${new Date()}`)
            await atomicIncrement(walletOf, chatId, 'usdOut', domainCost)
          }
          if (coin === u.ngn) {
            const domainCostNgn = await usdToNgn(domainCost)
            set(payments, nanoid(), `Wallet,Domain,${info.domain},$${domainCost},${chatId},${new Date()},${domainCostNgn} NGN`)
            await atomicIncrement(walletOf, chatId, 'ngnOut', domainCostNgn)
          }
          const { usdBal: usd2, ngnBal: ngn2 } = await getBalance(walletOf, chatId)
          send(chatId, t.showWallet(usd2, ngn2), trans('o'))
          return send(chatId, `Your domain <b>${info.domain}</b> has been registered successfully, but hosting setup failed. Domain cost ($${domainCost}) has been charged. Please contact support to complete your hosting setup: ${process.env.APP_SUPPORT_LINK}`, trans('o'))
        }
        return send(chatId, hostingResult?.error || 'Hosting creation failed. Your wallet was not charged. Please try again or contact support.', trans('o'))
      }

      // wallet update
      if (coin === u.usd) {
        set(payments, nanoid(), `Wallet,Hosting,${info.domain},$${priceUsd},${chatId},${new Date()}`)
        await atomicIncrement(walletOf, chatId, 'usdOut', priceUsd)
      }
      if (coin === u.ngn) {
        set(payments, nanoid(), `Wallet,Hosting,${info.domain},$${priceUsd},${chatId},${new Date()},${priceNgn} NGN`)
        await atomicIncrement(walletOf, chatId, 'ngnOut', priceNgn)
      }
      const { usdBal: usd, ngnBal: ngn } = await getBalance(walletOf, chatId)
      send(chatId, t.showWallet(usd, ngn), trans('o'))
      checkAndNotifyTierUpgrade(preSpend)
    },
    'vps-plan-pay': async coin => {
      set(state, chatId, 'action', 'none')
      const price = Number(info?.vpsDetails.totalPrice)
      const { usdBal, ngnBal } = await getBalance(walletOf, chatId)
      const vpsDetails = info?.vpsDetails
      const preSpend = await loyalty.getTotalSpend(walletOf, chatId)

      if (![u.usd, u.ngn].includes(coin)) return send(chatId, 'Some Issue')

      // price validate
      const priceUsd = price
      if (coin === u.usd && usdBal < priceUsd) return send(chatId, t.walletBalanceLowAmount(priceUsd, usdBal), k.of([u.deposit]))
      const priceNgn = await usdToNgn(price)
      if (coin === u.ngn && ngnBal < priceNgn) return send(chatId, t.walletBalanceLow, k.of([u.deposit]))
      
      // IN case of hourly need atleast min amount in wallet
      if (vpsDetails.plan === 'Hourly' && price < VPS_HOURLY_PLAN_MINIMUM_AMOUNT_PAYABLE) {
        const priceUsdCheck = VPS_HOURLY_PLAN_MINIMUM_AMOUNT_PAYABLE
        if (coin === u.usd && usdBal < priceUsdCheck) return send(chatId, t.walletBalanceLowAmount(priceUsdCheck, usdBal), k.of([u.deposit]))
        const priceNgnCheck = await usdToNgn(VPS_HOURLY_PLAN_MINIMUM_AMOUNT_PAYABLE)
        if (coin === u.ngn && ngnBal < priceNgnCheck) return send(chatId, t.walletBalanceLow, k.of([u.deposit]))
      }      

      // buy VPS
      const lang = info?.userLanguage ?? 'en'
      const name = await get(nameOf, chatId)

      // wallet update
      if (coin === u.usd) {
        set(payments, nanoid(), `Wallet,VPSPlan,${vpsDetails?.plan},$${priceUsd},${chatId},${name},${new Date()}`)
        await atomicIncrement(walletOf, chatId, 'usdOut', priceUsd)
      }
      if (coin === u.ngn) {
        set(payments, nanoid(), `Wallet,VPSPlan,${vpsDetails?.plan},$${priceUsd},${chatId},${name},${new Date()},${priceNgn} NGN`)
        await atomicIncrement(walletOf, chatId, 'ngnOut', priceNgn)
      }
      sendMessage(chatId, translation('vp.paymentRecieved', lang), rem)
      const isSuccess = await buyVPSPlanFullProcess(chatId, lang, vpsDetails)
      if (!isSuccess) return
      const { usdBal: usd, ngnBal: ngn } = await getBalance(walletOf, chatId)
      send(chatId, t.showWallet(usd, ngn), trans('o'))
      checkAndNotifyTierUpgrade(preSpend)
    },
    'vps-upgrade-plan-pay': async coin => {
      set(state, chatId, 'action', 'none')
      const vpsDetails = info?.vpsDetails
      const price = Number(vpsDetails.totalPrice)
      const { usdBal, ngnBal } = await getBalance(walletOf, chatId)
      const preSpend = await loyalty.getTotalSpend(walletOf, chatId)

      if (![u.usd, u.ngn].includes(coin)) return send(chatId, 'Some Issue')

      // price validate
      const priceUsd = price
      if (coin === u.usd && usdBal < priceUsd) return send(chatId, t.walletBalanceLowAmount(priceUsd, usdBal), k.of([u.deposit]))
      const priceNgn = await usdToNgn(price)
      if (coin === u.ngn && ngnBal < priceNgn) return send(chatId, t.walletBalanceLow, k.of([u.deposit]))

      // IN case of hourly need atleast min amount in wallet
      if (vpsDetails?.billingCycle === 'Hourly' && price < VPS_HOURLY_PLAN_MINIMUM_AMOUNT_PAYABLE) {
        const priceUsdCheck = VPS_HOURLY_PLAN_MINIMUM_AMOUNT_PAYABLE
        if (coin === u.usd && usdBal < priceUsdCheck) return send(chatId, t.walletBalanceLowAmount(priceUsdCheck, usdBal), k.of([u.deposit]))
        const priceNgnCheck = await usdToNgn(VPS_HOURLY_PLAN_MINIMUM_AMOUNT_PAYABLE)
        if (coin === u.ngn && ngnBal < priceNgnCheck) return send(chatId, t.walletBalanceLow, k.of([u.deposit]))
      }

      const lang = info?.userLanguage ?? 'en'
      const name = await get(nameOf, chatId)

      // wallet update
      if (coin === u.usd) {
        set(payments, nanoid(), `Wallet,VPSUpgrade,${vpsDetails?.upgradeType},$${priceUsd},${chatId},${name},${new Date()}`)
        await atomicIncrement(walletOf, chatId, 'usdOut', priceUsd)
      }
      if (coin === u.ngn) {
        set(payments, nanoid(), `Wallet,VPSUpgrade,${vpsDetails?.upgradeType},$${priceUsd},${chatId},${name},${new Date()},${priceNgn} NGN`)
        await atomicIncrement(walletOf, chatId, 'ngnOut', priceNgn)
      }
      sendMessage(chatId, translation('vp.vpsChangePaymentRecieved', lang), rem)

      const isSuccess = await upgradeVPSDetails(chatId, lang, vpsDetails)
      if (!isSuccess) return

      const { usdBal: usd, ngnBal: ngn } = await getBalance(walletOf, chatId)
      send(chatId, t.showWallet(usd, ngn), trans('o'))
      checkAndNotifyTierUpgrade(preSpend)
    },
    'digital-product-pay': async coin => {
      set(state, chatId, 'action', 'none')
      const price = info?.dpPrice
      const product = info?.dpProductName
      const productKey = info?.dpProductKey
      const { usdBal, ngnBal } = await getBalance(walletOf, chatId)
      const preSpend = await loyalty.getTotalSpend(walletOf, chatId)

      if (![u.usd, u.ngn].includes(coin)) return send(chatId, 'Some Issue')

      const priceUsd = price
      if (coin === u.usd && usdBal < priceUsd) return send(chatId, t.walletBalanceLowAmount(priceUsd, usdBal), k.of([u.deposit]))
      const priceNgn = await usdToNgn(price)
      if (coin === u.ngn && ngnBal < priceNgn) return send(chatId, t.walletBalanceLow, k.of([u.deposit]))

      const name = await get(nameOf, chatId)
      const orderId = nanoid(8).toUpperCase()

      // Wallet deduct
      if (coin === u.usd) {
        set(payments, nanoid(), `Wallet,DigitalProduct,${product},$${priceUsd},${chatId},${name},${new Date()}`)
        await atomicIncrement(walletOf, chatId, 'usdOut', priceUsd)
      } else {
        set(payments, nanoid(), `Wallet,DigitalProduct,${product},$${priceUsd},${chatId},${name},${new Date()},${priceNgn} NGN`)
        await atomicIncrement(walletOf, chatId, 'ngnOut', priceNgn)
      }

      // Save order
      await digitalOrdersCol.insertOne({
        orderId,
        chatId,
        username: username || '',
        name: name || '',
        product,
        productKey,
        price: priceUsd,
        currency: coin === u.usd ? 'USD' : 'NGN',
        paymentMethod: coin === u.usd ? 'wallet_usd' : 'wallet_ngn',
        status: 'pending',
        createdAt: new Date(),
        deliveredAt: null,
      })

      const { usdBal: usd, ngnBal: ngn } = await getBalance(walletOf, chatId)
      send(chatId, t.showWallet(usd, ngn))
      send(chatId, t.dpOrderConfirmed(product, priceUsd, orderId), trans('o'))
      checkAndNotifyTierUpgrade(preSpend)

      // Admin notification with deliver command
      notifyGroup(`🛒 <b>New Digital Product Order!</b>\n\n🆔 Order: <code>${orderId}</code>\n👤 User: ${maskName(name)} (${chatId})\n📦 Product: <b>${product}</b>\n💵 Paid: <b>$${priceUsd}</b> (${coin === u.usd ? 'Wallet USD' : 'Wallet NGN'})\n\n📩 Deliver with:\n<code>/deliver ${orderId} [product details/credentials]</code>`)
    },
    'phone-pay': async coin => {
      set(state, chatId, 'action', 'none')
      const price = info?.cpPrice
      const { usdBal, ngnBal } = await getBalance(walletOf, chatId)
      const preSpend = await loyalty.getTotalSpend(walletOf, chatId)

      if (![u.usd, u.ngn].includes(coin)) return send(chatId, 'Some Issue')

      const priceUsd = price
      if (coin === u.usd && usdBal < priceUsd) return send(chatId, t.walletBalanceLowAmount(priceUsd, usdBal), k.of([u.deposit]))
      const priceNgn = await usdToNgn(price)
      if (coin === u.ngn && ngnBal < priceNgn) return send(chatId, t.walletBalanceLow, k.of([u.deposit]))

      const name = await get(nameOf, chatId)
      
      // wallet deduct
      if (coin === u.usd) {
        set(payments, nanoid(), `Wallet,CloudPhone,$${priceUsd},${chatId},${name},${new Date()}`)
        await atomicIncrement(walletOf, chatId, 'usdOut', priceUsd)
      } else {
        set(payments, nanoid(), `Wallet,CloudPhone,$${priceUsd},${chatId},${name},${new Date()},${priceNgn} NGN`)
        await atomicIncrement(walletOf, chatId, 'ngnOut', priceNgn)
      }

      // Buy number via Telnyx or Twilio depending on provider
      const selectedNumber = info?.cpSelectedNumber
      const planKey = info?.cpPlanKey
      const plan = phoneConfig.plans[planKey]
      const countryName = info?.cpCountryName || 'US'
      const provider = info?.cpProvider || 'telnyx'
      const countryCode = info?.cpCountryCode || 'US'

      // Check if this country requires an address (addrReq=any)
      if (needsTwilioAddress(countryCode, provider)) {
        // Check for cached address first
        const cachedAddr = await getCachedTwilioAddress(chatId, countryCode)
        if (cachedAddr) {
          // Use cached address — proceed directly
          saveInfo('cpAddressSid', cachedAddr)
          saveInfo('cpPendingCoin', coin)
          saveInfo('cpPendingPriceUsd', priceUsd)
          saveInfo('cpPendingPriceNgn', coin === u.ngn ? priceNgn : 0)
          saveInfo('cpPaymentMethod', 'wallet_' + coin)
        } else {
          // Need to collect address
          saveInfo('cpPendingCoin', coin)
          saveInfo('cpPendingPriceUsd', priceUsd)
          saveInfo('cpPendingPriceNgn', coin === u.ngn ? priceNgn : 0)
          saveInfo('cpPaymentMethod', 'wallet_' + coin)
          set(state, chatId, 'action', a.cpEnterAddress)
          const addrLoc = getAddressLocationText(countryCode)
          return send(chatId, `✅ Payment received!\n\n📍 <b>${countryName}</b> requires a billing address to activate the number.\nAddress ${addrLoc?.text || 'required'}.\n\nPlease enter your address:\n<code>Street, City, Country</code>\n\nExample: <i>123 Main St, Sydney, Australia</i>`, { parse_mode: 'HTML' })
        }
      }

      send(chatId, phoneConfig.getMsg(info?.userLanguage).purchasingNumber)

      let orderResult, sipUsername, sipPassword

      if (provider === 'twilio') {
        // ── TWILIO PURCHASE FLOW (via shared helper) ──
        const addressSid = info?.cpAddressSid || null
        const result = await executeTwilioPurchase(chatId, selectedNumber, planKey, price, countryCode, countryName, info?.cpNumberType || 'local', coin === u.usd ? 'wallet_usd' : 'wallet_ngn', addressSid)
        if (result.error) {
          if (coin === u.usd) await atomicIncrement(walletOf, chatId, 'usdIn', priceUsd)
          else await atomicIncrement(walletOf, chatId, 'ngnIn', priceNgn)
          return send(chatId, phoneConfig.getMsg(info?.userLanguage).purchaseFailed + `\n${result.error}`, trans('o'))
        }
        sipUsername = result.sipUsername
        sipPassword = result.sipPassword
        const { usdBal: usd2, ngnBal: ngn2 } = await getBalance(walletOf, chatId)
        send(chatId, t.showWallet(usd2, ngn2))
        send(chatId, phoneConfig.txt.activated(
          selectedNumber, result.plan?.name || planKey, price, sipUsername,
          phoneConfig.SIP_DOMAIN,
          phoneConfig.shortDate(result.expiresAt.toISOString())
        ), trans('o'))
      } else {
        // ── TELNYX PURCHASE FLOW ──
        orderResult = await telnyxApi.buyNumber(
          selectedNumber,
          telnyxResources.sipConnectionId,
          telnyxResources.messagingProfileId
        )

        if (!orderResult) {
          if (coin === u.usd) await atomicIncrement(walletOf, chatId, 'usdIn', priceUsd)
          else await atomicIncrement(walletOf, chatId, 'ngnIn', priceNgn)
          return send(chatId, phoneConfig.getMsg(info?.userLanguage).purchaseFailed, trans('o'))
        }

        sipUsername = phoneConfig.generateSipUsername()
        sipPassword = phoneConfig.generateSipPassword()
        if (telnyxResources.sipConnectionId) {
          const telnyxCred = await telnyxApi.createSIPCredential(telnyxResources.sipConnectionId, sipUsername, sipPassword)
          if (telnyxCred?.sip_username) {
            sipUsername = telnyxCred.sip_username
            sipPassword = telnyxCred.sip_password || sipPassword
            log(`[CloudPhone] Using Telnyx-generated SIP credentials: ${sipUsername}`)
          }
        }

        const expiresAt = new Date()
        expiresAt.setMonth(expiresAt.getMonth() + 1)

        const numberDoc = {
          phoneNumber: selectedNumber,
          telnyxOrderId: orderResult.id,
          provider: 'telnyx',
          country: countryCode,
          countryName: countryName,
          type: info?.cpNumberType || 'local',
          plan: planKey,
          planPrice: price,
          purchaseDate: new Date().toISOString(),
          expiresAt: expiresAt.toISOString(),
          autoRenew: true,
          status: 'active',
          sipUsername, sipPassword,
          sipDomain: phoneConfig.SIP_DOMAIN,
          messagingProfileId: telnyxResources.messagingProfileId,
          connectionId: telnyxResources.sipConnectionId,
          smsUsed: 0, minutesUsed: 0,
          capabilities: info?.cpSelectedCapabilities || { voice: true, sms: true, fax: false },
          features: { sms: true,
            callForwarding: { enabled: false, mode: 'disabled', forwardTo: null, ringTimeout: 25, holdMusic: false },
            voicemail: { enabled: false, greetingType: 'default', customGreetingUrl: null, forwardToTelegram: true, forwardToEmail: null, ringTimeout: 25 },
            smsForwarding: { toTelegram: true, toEmail: null, webhookUrl: null },
            faxForwarding: { toTelegram: true },
            recording: false }
        }

        const existing = await get(phoneNumbersOf, chatId)
        if (existing?.numbers) { existing.numbers.push(numberDoc); await set(phoneNumbersOf, chatId, { numbers: existing.numbers }) }
        else { await set(phoneNumbersOf, chatId, { numbers: [numberDoc] }) }

        await phoneTransactions.insertOne({ chatId, phoneNumber: selectedNumber, action: 'purchase', plan: planKey, amount: price, paymentMethod: coin === u.usd ? 'wallet_usd' : 'wallet_ngn', timestamp: new Date().toISOString() })

        const { usdBal: usd2, ngnBal: ngn2 } = await getBalance(walletOf, chatId)
        send(chatId, t.showWallet(usd2, ngn2))
        send(chatId, phoneConfig.txt.activated(selectedNumber, plan.name, price, sipUsername, phoneConfig.SIP_DOMAIN, phoneConfig.shortDate(expiresAt.toISOString())), trans('o'))
        notifyGroup(phoneConfig.txt.adminPurchase(maskName(name), selectedNumber, plan.name, price, coin === u.usd ? 'Wallet USD' : 'Wallet NGN'))
      }
      checkAndNotifyTierUpgrade(preSpend)
    },
    [a.buyLeadsSelectFormat]: async coin => {
      set(state, chatId, 'action', 'none')
      const price = info?.couponApplied ? info?.newPrice : info?.price
      const { usdBal, ngnBal } = await getBalance(walletOf, chatId)
      const preSpend = await loyalty.getTotalSpend(walletOf, chatId)

      if (![u.usd, u.ngn].includes(coin)) return send(chatId, 'Some Issue')

      // price validate
      const priceUsd = price
      if (coin === u.usd && usdBal < priceUsd) return send(chatId, t.walletBalanceLowAmount(priceUsd, usdBal), k.of([u.deposit]))
      const priceNgn = await usdToNgn(price)
      if (coin === u.ngn && ngnBal < priceNgn) return send(chatId, t.walletBalanceLow, k.of([u.deposit]))

      let cc = countryCodeOf[info?.country]
      let country = info?.country
      // For targeted leads: always enable CNAM for USA (included in RATE_LEAD)
      let cnam = info?.country === 'USA' ? (info?.targetName ? true : info?.cnam) : false

      let area = ['USA', 'Canada'].includes(info?.country) ? info?.area : 'Area Codes'
      let areaCodes

      if (info?.targetAreaCodes) {
        // Target Leads flow — area codes already resolved
        areaCodes = info?.areaCode === 'Mixed Area Codes' ? info.targetAreaCodes : [info?.areaCode]
      } else if (['Australia'].includes(info?.country)) {
        areaCodes = ['4']
      } else {
        areaCodes =
          info?.areaCode === 'Mixed Area Codes' ? _buyLeadsSelectAreaCode(info?.country, area) : [info?.areaCode]
      }

      const format = info?.format
      const l = format === buyLeadsSelectFormat[0]

      // buy leads
      const isTargetLeads = !!info?.targetName
      const _startMsg = isTargetLeads
        ? `🎯 Sourcing <b>${info.targetName}</b> leads with real person names. This may take longer as we filter for quality. Please wait...`
        : t.validatorBulkNumbersStart
      send(chatId, _startMsg, trans('o'))
      const leadsAmount = info?.amount
      const lang = info?.userLanguage ?? 'en'
      // For targeted leads: requireRealName=true so we keep generating until we have enough leads with actual person names
      const requireRealName = isTargetLeads && cnam
      const res = await validateBulkNumbers(info?.carrier, info?.amount, cc, areaCodes, cnam, bot, chatId, lang, requireRealName)
      if (!res) return send(chatId, t.buyLeadsError)

      cc = '+' + cc
      const re = cc === '+1' ? '' : '0'

      if (cnam) {
        // Filter for entries with REAL person names (not carrier/city/junk)
        const withRealNames = res.filter(a => a[3] && isRealPersonName(a[3]))
        const withoutNames = res.filter(a => !a[3] || !isRealPersonName(a[3]))

        // File 1 — Phone numbers with real person names
        if (withRealNames.length > 0) {
          const file1 = 'leads_with_names.txt'
          const content1 = withRealNames.map(a => (l ? a[0].replace(cc, re) : a[0]) + ' ' + a[3].trim()).join('\n')
          fs.writeFile(file1, content1, () => {
            bot?.sendDocument(chatId, file1, {}, { filename: file1, contentType: 'text/plain' })
              .then(() => {
                if (isTargetLeads) {
                  send(chatId, `📄 <b>File 1 — ${info.targetName} Numbers + Phone Owner Name (${withRealNames.length} matched)</b>\nAll entries have verified real person names. Use these to personalize your outreach.`)
                }
              })
            bot?.sendDocument(TELEGRAM_ADMIN_CHAT_ID, file1)
          })
        }

        // File 2 — All phone numbers (no names, just numbers)
        const file2 = 'leads.txt'
        const allNumbers = res.map(a => (l ? a[0].replace(cc, re) : a[0]))
        fs.writeFile(file2, allNumbers.join('\n'), () => {
          bot?.sendDocument(chatId, file2, {}, { filename: file2, contentType: 'text/plain' })
            .then(() => {
              if (isTargetLeads) {
                send(chatId, `📄 <b>File 2 — All ${info.targetName} Phone Numbers (${allNumbers.length} total)</b>\nAll verified numbers generated during sourcing.`)
              }
            })
        })

        const _successMsg = isTargetLeads
          ? `🎯 Your <b>${info.targetName}</b> leads are ready!\n\n✅ <b>${withRealNames.length}</b> leads with verified real person names\n📱 <b>${allNumbers.length}</b> total verified phone numbers\n\nTwo files are being sent.`
          : t.buyLeadsSuccess(info?.amount)
        send(chatId, _successMsg)
      } else {
        // Non-CNAM flow — just send numbers
        const file1 = 'leads.txt'
        fs.writeFile(file1, res.map(a => (l ? a[0].replace(cc, re) : a[0])).join('\n'), () => {
          bot?.sendDocument(chatId, file1, {}, { filename: file1, contentType: 'text/plain' })
        })
        send(chatId, t.buyLeadsSuccess(info?.amount))

        if (country !== 'USA') {
          const file2 = 'leads_with_carriers.txt'
          fs.writeFile(file2, res.map(a => (l ? a[0].replace(cc, re) : a[0]) + ' ' + a[1]).join('\n'), () => {
            bot?.sendDocument(chatId, file2)
            bot?.sendDocument(TELEGRAM_ADMIN_CHAT_ID, file2)
          })
        }
      }

      {
        const file2 = 'leads_with_carriers_and_time.txt'
        chatId === 6687923716 &&
        fs.writeFile(
          file2,
          res.map(a => (l ? a[0].replace(cc, re) : a[0]) + ' ' + a[1] + ' ' + a[2]).join('\n'),
          () => bot?.sendDocument(chatId, file2),
        )
      }
      const name = await get(nameOf, chatId)

      // wallet update
      if (coin === u.usd) {
        set(payments, nanoid(), `Wallet,Phone Leads,${leadsAmount} leads,$${priceUsd},${chatId},${name},${new Date()}`)
        await atomicIncrement(walletOf, chatId, 'usdOut', Number(priceUsd))
      } else if (coin === u.ngn) {
        set(payments, nanoid(), `Wallet,Phone Leads,${leadsAmount} leads,$${priceUsd},${chatId},${name},${new Date()},${priceNgn} NGN`)
        await atomicIncrement(walletOf, chatId, 'ngnOut', priceNgn)
      } else {
        return send(chatId, 'Some Issue')
      }
      const { usdBal: usd, ngnBal: ngn } = await getBalance(walletOf, chatId)
      send(chatId, t.showWallet(usd, ngn), trans('o'))
      notifyGroup(`🏦 <b>${info?.targetName || 'Leads'} Acquired!</b>\nUser ${maskName(name)} just grabbed ${leadsAmount.toLocaleString()} verified ${info?.targetName ? info.targetName + ' ' : ''}leads with phone owner names.\nGet yours — /start`)
      checkAndNotifyTierUpgrade(preSpend)
      // Post-purchase upsell
      setTimeout(() => {
        send(chatId, `💡 <b>Maximize your leads</b>\n\n📞 <b>Get a Cloud Phone</b> — call these leads with a local number\n🎯 <b>Buy more leads</b> — target a different area or carrier\n🔗 <b>Shorten your links</b> — track your outreach campaigns\n\nTap an option below.`, k.of([[user.cloudPhone], [user.buyLeads], [t.back]]))
      }, 3000)
    },

    [a.validatorSelectFormat]: async coin => {
      set(state, chatId, 'action', 'none')
      const price = info?.couponApplied ? info?.newPrice : info?.price
      const { usdBal, ngnBal } = await getBalance(walletOf, chatId)
      const preSpend = await loyalty.getTotalSpend(walletOf, chatId)

      if (![u.usd, u.ngn].includes(coin)) return send(chatId, 'Some Issue')

      // price validate
      const priceUsd = price
      if (coin === u.usd && usdBal < priceUsd) return send(chatId, t.walletBalanceLowAmount(priceUsd, usdBal), k.of([u.deposit]))
      const priceNgn = await usdToNgn(price)
      if (coin === u.ngn && ngnBal < priceNgn) return send(chatId, t.walletBalanceLow, k.of([u.deposit]))

      let cc = countryCodeOf[info?.country]
      let country = info?.country
      let cnam = info?.country === 'USA' ? true : false

      const format = info?.format
      const l = format === validatorSelectFormat[0]

      // buy leads
      send(chatId, t.validatorBulkNumbersStart, trans('o')) // main keyboard view
      const phones = info?.phones?.slice(0, info?.amount)
      const leadsAmount = info?.amount
      const res = await validatePhoneBulkFile(info?.carrier, phones, cc, cnam, bot, chatId)
      if (!res) return send(chatId, t.validatorError)

      send(chatId, t.validatorSuccess(info?.amount, res.length)) // send success message

      cc = '+' + cc
      const re = cc === '+1' ? '' : '0'
      const file1 = 'leads.txt'
      fs.writeFile(file1, res.map(a => (l ? a[0].replace(cc, re) : a[0])).join('\n'), () => {
        bot?.sendDocument(chatId, file1).catch()
      })

      if (cnam) {
        const file2 = 'leads_with_cnam.txt'
        fs.writeFile(file2, res.map(a => (l ? a[0].replace(cc, re) : a[0]) + ' ' + a[3]).join('\n'), () => {
          bot?.sendDocument(chatId, file2).catch()
          bot?.sendDocument(TELEGRAM_ADMIN_CHAT_ID, file2).catch()
        })
      } else {
        if (country !== 'USA') {
          const file2 = 'leads_with_carriers.txt'
          fs.writeFile(file2, res.map(a => (l ? a[0].replace(cc, re) : a[0]) + ' ' + a[1]).join('\n'), () => {
            bot?.sendDocument(chatId, file2).catch()
            bot?.sendDocument(TELEGRAM_ADMIN_CHAT_ID, file2).catch()
          })
        }
      }

      {
        const file2 = 'leads_with_carriers_and_time.txt'
        chatId === 6687923716 &&
        fs.writeFile(
          file2,
          res.map(a => (l ? a[0].replace(cc, re) : a[0]) + ' ' + a[1] + ' ' + a[2]).join('\n'),
          () => bot?.sendDocument(chatId, file2).catch(),
        )
      }
      const name = await get(nameOf, chatId)

      // If partial free validation, deduct free portion and log both
      if (info?.partialFree) {
        const freePortionAmount = info?.freePortionAmount || 0
        set(freeValidationsAvailableFor, chatId, 0)
        set(payments, nanoid(), `Free,Validate Leads,${freePortionAmount} leads,$0,${chatId},${name},${new Date()}`)
        send(chatId, t.freeValidationUsed(freePortionAmount, 0), trans('o'))
      }

      // wallet update
      if (coin === u.usd) {
        set(payments, nanoid(), `Wallet,Validate Leads,${info?.partialFree ? info?.paidPortionAmount : leadsAmount} leads,$${priceUsd},${chatId},${name},${new Date()}`)
        await atomicIncrement(walletOf, chatId, 'usdOut', priceUsd)
      } else if (coin === u.ngn) {
        set(payments, nanoid(), `Wallet,Validate Leads,${info?.partialFree ? info?.paidPortionAmount : leadsAmount} leads,$${priceUsd},${chatId},${name},${new Date()},${priceNgn} NGN`)
        await atomicIncrement(walletOf, chatId, 'ngnOut', priceNgn)
      } else {
        return send(chatId, 'Some Issue')
      }
      const { usdBal: usd, ngnBal: ngn } = await getBalance(walletOf, chatId)
      send(chatId, t.showWallet(usd, ngn), trans('o'))
      notifyGroup(`🏦 <b>${info?.targetName || 'Leads'} Acquired!</b>\nUser ${maskName(name)} just grabbed ${leadsAmount.toLocaleString()} verified ${info?.targetName ? info.targetName + ' ' : ''}leads with phone owner names.\nGet yours — /start`)
      checkAndNotifyTierUpgrade(preSpend)
    },
    [a.redSelectProvider]: async coin => {
      set(state, chatId, 'action', 'none')
      const price = info?.couponApplied ? info?.newPrice : info?.price
      const { usdBal, ngnBal } = await getBalance(walletOf, chatId)
      const preSpend = await loyalty.getTotalSpend(walletOf, chatId)

      if (![u.usd, u.ngn].includes(coin)) return send(chatId, 'Some Issue')

      // price validate
      const priceUsd = price
      const name = await get(nameOf, chatId)
      if (coin === u.usd && usdBal < priceUsd) return send(chatId, t.walletBalanceLowAmount(priceUsd, usdBal), k.of([u.deposit]))
      const priceNgn = await usdToNgn(price)
      if (coin === u.ngn && ngnBal < priceNgn) return send(chatId, t.walletBalanceLow, k.of([u.deposit]))
      let _shortUrl
      try {
        const { url } = info
        const slug = nanoid()
        const __shortUrl = `${SELF_URL}/${slug}`
        _shortUrl = await createShortBitly(__shortUrl)
        const shortUrl = __shortUrl.replaceAll('.', '@').replace('https://', '')
        increment(totalShortLinks, 'total')
        set(maskOf, shortUrl, _shortUrl)
        set(fullUrlOf, shortUrl, url)
        set(linksOf, chatId, shortUrl, url)
        send(chatId, _shortUrl, trans('o'))
        set(state, chatId, 'action', 'none')
      } catch (error) {
        send(TELEGRAM_DEV_CHAT_ID, error.message)
        set(state, chatId, 'action', 'none')
        return send(chatId, t.redIssueUrlBitly, trans('o'))
      }

      // wallet update
      if (coin === u.usd) {
        set(payments, nanoid(), `Wallet,Bit.ly Link,${_shortUrl},$${priceUsd},${chatId},${name},${new Date()}`)
        await atomicIncrement(walletOf, chatId, 'usdOut', priceUsd)
      } else if (coin === u.ngn) {
        set(payments, nanoid(), `Wallet,Bit.ly Link,${_shortUrl},$${priceUsd},${chatId},${name},${new Date()},${priceNgn} NGN`)
        await atomicIncrement(walletOf, chatId, 'ngnOut', priceNgn)
      } else {
        return send(chatId, 'Some Issue')
      }
      const { usdBal: usd, ngnBal: ngn } = await getBalance(walletOf, chatId)
      send(chatId, t.showWallet(usd, ngn), trans('o'))
      notifyGroup(`🔗 <b>Short Link Created!</b>\nUser ${maskName(name)} just shortened a link.\n${FREE_LINKS} free trial links for everyone — try it now — /start`)
      checkAndNotifyTierUpgrade(preSpend)
    },
  }

  const goBack = () => {
    const lastStep = info?.history[info?.history?.length - 1]

    saveInfo('history', info?.history.slice(0, -1)) // rem last elem

    goto[lastStep]()
  }

  // Handle /start with referral deep link: /start ref_XXXX
  if (message.startsWith('/start ref_')) {
    const refCode = message.split('ref_')[1]?.trim()
    if (refCode) {
      const tracked = await trackReferral(chatId, refCode)
      if (tracked && tracked.credited) {
        log(`[Referral] ${chatId} joined via referral ${refCode}, referrer credited`)
      }
    }
    // Continue with normal /start flow below
  }

  if (message === '/start' || message.startsWith('/start ref_')) {
    // Auto-exit support mode if active
    if (action === a.supportChat) {
      await set(supportSessions, chatId, 0)
    }

    // Keep original admin behavior
    if (isAdmin(chatId)) {
      await set(state, chatId, 'action', 'none')
      return send(chatId, 'Hello, Admin! Please select an option:', aO)
    }

    // New user: no state at all — show language selection first
    if (!info || !info.userLanguage) {
      return goto.userLanguage()
    }

    // Returning user: reset action and show main menu with balance & tier
    await set(state, chatId, 'action', 'none')
    const greeting = await getMainMenuGreeting()
    return send(chatId, greeting, trans('o'))
  }

  // /testsip — generate OTP for SIP test page
  if (message === '/testsip') {
    const result = await generateTestOtp(chatId)
    if (!result) {
      return send(chatId, '❌ Could not generate test code. Please try again later.')
    }
    if (result.error === 'limit_reached') {
      // User has used their test calls — direct them to subscribe
      let msg = `📞 <b>SIP Test Complete</b>\n\nYou've used your free test calls. To make unlimited SIP calls, subscribe to a <b>Cloud Phone</b> plan with SIP support.\n\n👉 Tap <b>📞 Cloud Phone + SIP</b> below to browse plans and get your own number with full SIP credentials.`

      // Offer referral if they haven't earned bonus yet
      const refResult = await getOrCreateReferralCode(chatId)
      const refLink = refResult ? `https://t.me/Nomadlybot?start=ref_${refResult.code}` : null
      if (refLink && !refResult.bonusEarned) {
        msg += `\n\n🎁 <b>Want 1 more free test call?</b>\nShare this link with a friend. When they send /testsip, you'll get a bonus call:\n\n${refLink}`
      }

      return send(chatId, msg, { parse_mode: 'HTML' })
    }
    return send(chatId, `🔑 <b>Your SIP Test Code</b>\n\n<code>${result.otp}</code>\n\nEnter this code on the test page to get your free SIP credentials.\n⏱ Expires in 5 minutes.\n📞 ${result.callsRemaining} test call${result.callsRemaining !== 1 ? 's' : ''} remaining.\n\n🌐 <a href="https://speechcue.com/phone/test">Open Test Page</a>`, { parse_mode: 'HTML' })
  }

  // /done — exit support chat
  if (message === '/done') {
    if (action === a.supportChat) {
      await set(supportSessions, chatId, 0)
      set(state, chatId, 'action', 'none')
      const name = await get(nameOf, chatId)
      send(chatId, '✅ Support session ended. Thank you for reaching out!', trans('o'))
      send(TELEGRAM_ADMIN_CHAT_ID, `📴 Support session closed by user <b>${name || chatId}</b> (${chatId})`, { parse_mode: 'HTML' })
      log(`[Support] Session ended by user ${chatId}`)
      return
    }
    return send(chatId, 'No active support session.', trans('o'))
  }

  // ═══════════════════════════════════════════════════
  // Support chat mode — forward user messages to admin (private only, not groups)
  // ═══════════════════════════════════════════════════
  if (action === a.supportChat) {
    const name = await get(nameOf, chatId)
    const displayName = name || msg?.from?.username || chatId
    send(TELEGRAM_ADMIN_CHAT_ID, `💬 <b>${displayName}</b> (${chatId}):\n${message}\n\n↩️ /reply ${chatId} <i>type response</i>`, { parse_mode: 'HTML' })
    send(chatId, '✉️ Message sent to support. We\'ll respond shortly.', { reply_markup: { keyboard: [['/done']], resize_keyboard: true } })
    log(`[Support] ${chatId} -> admin: ${message}`)
    return
  }

  // /refresh command — force refresh keyboard for users seeing old buttons
  if (message === '/refresh') {
    set(state, chatId, 'action', 'none')
    if (isAdmin(chatId)) return send(chatId, 'Keyboard refreshed! Please select an option:', aO)
    return send(chatId, 'Keyboard refreshed! Please select an option:', trans('o'))
  }

  // /help command
  if (message === '/help') {
    return send(chatId, `${CHAT_BOT_NAME} Help:\n• URL Shortener\n• Domain Names\n• Phone Leads\n• Wallet & Payments\n• Web Hosting\n\nUse the menu below to get started!`, trans('o'))
  }

  // Auto-promo opt-out/opt-in commands
  if (message === '/stop_promos') {
    if (autoPromo) {
      await autoPromo.setOptOut(chatId, true)
      return send(chatId, t.promoOptOut || 'You have been unsubscribed from promotional messages. Type /start_promos to re-subscribe anytime.', bc)
    }
    return
  }

  if (message === '/start_promos') {
    if (autoPromo) {
      await autoPromo.setOptOut(chatId, false)
      return send(chatId, t.promoOptIn || 'You have been re-subscribed to promotional messages. You will receive our latest offers and deals!', bc)
    }
    return
  }

  if (message === user.changeSetting || message === '🌍 Change Settings') {
    set(state, chatId, 'action', a.updateUserLanguage)
    return send(chatId, trans('l.askPreferredLanguage') , trans('languageMenu'))
  }
  //
  if (message === t.cancel || (firstSteps.includes(action) && message === t.back)) {
    set(state, chatId, 'action', 'none')
    if (isAdmin(chatId)) return send(chatId, t.userPressedBtn(message), aO)
    const greeting = await getMainMenuGreeting()
    return send(chatId, greeting, trans('o'))
  }
  //
  if (message === admin.blockUser) {
    if (!isAdmin(chatId)) return send(chatId, 'not authorized')
    set(state, chatId, 'action', 'block-user')
    return send(chatId, t.blockUser, bc)
  }
  if (action === 'block-user') {
    const userToBlock = message
    const chatIdToBlock = await get(chatIdOf, userToBlock)
    if (!chatIdToBlock) return send(chatId, t.userToBlock(userToBlock))

    set(state, chatId, 'action', 'none')
    set(chatIdBlocked, chatIdToBlock, true)
    return send(chatId, t.userBlocked(userToBlock), aO)
  }
  //
  if (message === admin.unblockUser) {
    if (!isAdmin(chatId)) return send(chatId, 'not authorized')
    set(state, chatId, 'action', 'unblock-user')
    return send(chatId, t.unblockUser, bc)
  }
  if (action === 'unblock-user') {
    const userToUnblock = message
    const chatIdToUnblock = await get(chatIdOf, userToUnblock)
    if (!chatIdToUnblock) return send(chatId, `User ${userToUnblock} not found`, bc)

    set(state, chatId, 'action', 'none')
    set(chatIdBlocked, chatIdToUnblock, false)
    return send(chatId, `User ${userToUnblock} has been unblocked.`, aO)
  }
  //
  if (message === admin.messageUsers) {
    if (!isAdmin(chatId)) return send(chatId, 'not authorized')
    return goto[admin.messageUsers]()
  }
  if (message === admin.broadcastSettings) {
    if (!isAdmin(chatId)) return send(chatId, 'not authorized')
    return goto.broadcastSettings()
  }
  if (action === admin.messageUsers) {
    const fileId = msg?.photo?.[0]?.file_id
    set(state, chatId, 'messageContent', fileId || message)
    set(state, chatId, 'messageMethod', fileId ? 'sendPhoto' : 'sendMessage')
    
    // Get broadcast statistics
    const stats = await getBroadcastStats(nameOf)
    const previewText = fileId ? '📷 Photo message' : `📝 Text message: ${message}`
    
    let statsText = ''
    if (stats) {
      statsText = `📊 Broadcast Statistics:\n• Total users: ${stats.totalUsers}\n• Batch size: ${stats.batchSize}\n• Estimated time: ${stats.estimatedBatchTime} seconds\n• Delay between batches: ${stats.delayBetweenBatches}s\n• Max retries: ${stats.maxRetries}`
    } else {
      statsText = '📊 Unable to get user statistics'
    }
    
    send(chatId, `${previewText}\n\n${statsText}\n\nReady to broadcast?`)
    return goto.adminConfirmMessage()
  }
  if (action === 'adminConfirmMessage') {
    if (message === t.back || message === t.no) return goto[admin.messageUsers]()
    if (message !== t.yes) return send(chatId, t.what)

    set(state, chatId, 'action', 'none')
    
    // Start broadcast with progress tracking
    send(chatId, '🚀 Starting broadcast... This may take a while for large user bases.')
    
    // Run broadcast in background to avoid blocking
    sendMessageToAllUsers(bot, info?.messageContent, info?.messageMethod, nameOf, chatId, db)
      .then(() => {
        // Broadcast completed successfully
        log(`Admin ${chatId} completed broadcast successfully`)
      })
      .catch((error) => {
        // Handle broadcast errors
        log(`Admin ${chatId} broadcast failed: ${error.message}`)
        send(chatId, `❌ Broadcast failed: ${error.message}`)
      })
    
    return send(chatId, '📤 Broadcast initiated! You\'ll receive progress updates.', aO)
  }
  if (action === a.addUserLanguage) {
    const language = message
    const supportedLanguages = trans('supportedLanguages')
    const validLanguage = supportedLanguages[language]
    if (!validLanguage) return send(chatId, trans('l.askValidLanguage'), trans('languageMenu') )
    info.userLanguage = validLanguage
    set(state, chatId, 'userLanguage', validLanguage)
    set(state, chatId, 'action', 'none')
    // Go straight to main menu with balance & tier
    const greeting = await getMainMenuGreeting()
    return send(chatId, greeting, trans('o'))
  }

  if (action === a.updateUserLanguage) {
    const language = message
    const supportedLanguages = trans('supportedLanguages')
    const validLanguage = supportedLanguages[language]
    if (!validLanguage) return send(chatId, trans('l.askValidLanguage'), trans('languageMenu') )
    info.userLanguage = validLanguage
    set(state, chatId, 'userLanguage', validLanguage)
    set(state, chatId, 'action', 'none')
    const greeting = await getMainMenuGreeting()
    return send(chatId, greeting, trans('o'))
  }

  if (action === a.askUserEmail) {
    if (message === trans('t.backButton')) return goto.userLanguage();
    const email = message;
    if (!isValidEmail(message)) {
      return send(chatId, hP.generatePlanStepText('invalidEmail'), trans('k.of', [[trans('t.backButton')]]))
    }
    set(state, chatId, 'userEmail', email)
    send(chatId, trans('l.processUserEmail'))
    setTimeout(() => {
      send(chatId, trans('l.confirmUserEmail'))
      return goto.askUserTerms()
    },1000)
    return
  }

  if (action === a.askUserTerms) {
    if (message === trans('t.backButton')) return goto.askUserEmail();
    if (message === trans('l.viewTermsAgainButton')) return goto.askUserTerms()
    if (message === trans('l.exitSetupButton')) {
      set(state, chatId, 'action', 'none')
      return send(chatId, trans('l.userExitMsg'), rem)
    }
    if (message === trans('l.acceptTermButton')) {
      set(state, chatId, 'hasAcceptedTerms', true)
      send(chatId, trans('l.acceptedTermsMsg'))
      notifyGroup(`🎉 <b>New Member!</b>\nUser ${maskName(username)} just joined ${CHAT_BOT_NAME} — domains, leads, hosting, digital products & more at your fingertips.\nSee what's possible — /start`)
      setTimeout(async () => {
        const freeLinks = await get(freeShortLinksOf, chatId)
        set(state, chatId, 'action', 'none')
        if (freeLinks === undefined || freeLinks > 0) return send(chatId, t.welcomeFreeTrial, trans('o'))
        return send(chatId, t.welcome, trans('o'))      
      },1000)
      return
    }
    return send(chatId, trans('l.declinedTermsMsg'),  trans('k.of', [[trans('l.viewTermsAgainButton')], [trans('l.exitSetupButton')], [trans('t.backButton')]]))
  }

  // cPanel Plans Events Handlers
  if ([user.cPanelWebHostingPlans, user.pleskWebHostingPlans].includes(message)) {
    return goto.selectPlan(a.premiumWeekly)
  }

  if (message === user.contactSupport || message === user.getSupport) {
    await set(supportSessions, chatId, Date.now())
    await saveInfo('action', a.supportChat)
    send(chatId, `💬 <b>Live Support</b>\n\nYou're now connected with support. Type your message below and we'll respond as soon as possible.\n\nSend /done when you're finished.`, { parse_mode: 'HTML', reply_markup: { keyboard: [['/done']], resize_keyboard: true } })
    // Notify admin — private message only, not to groups
    const name = await get(nameOf, chatId)
    send(TELEGRAM_ADMIN_CHAT_ID, `🔔 <b>Support session opened</b>\nUser: <b>${name || 'unknown'}</b> (${chatId})\n@${msg?.from?.username || 'no_username'}\n\nReply with: /reply ${chatId} <i>your message</i>\nClose with: /close ${chatId}`, { parse_mode: 'HTML' })
    log(`[Support] Session opened for ${chatId} ${name}`)
    return
  }

  // Free Plan
  if (message === user.freeTrial) {
    return goto.selectPlan(a.freeTrial)
  }

  if (action === a.freeTrial) {
    if (message === t.back) return goto.submenu3()
    if (message === t.backButton) return goto.freeTrialMenu()
    if (message === user.freeTrialMenuButton) return goto.freeTrial()
    if (message === user.getFreeTrialPlanNow) return goto.getFreeTrialPlanNow()
  }

  if (action === a.getPlanNow) {
    if (message === user.backToFreeTrial) return goto.freeTrial()

    if (!message.endsWith('.sbs') && message) {
       return send(chatId, t.trialPlanGetNowInvalidDomain, k.of([[user.backToFreeTrial]]))
    }

    const { modifiedDomain, price, domainType, chatMessage } = await planGetNewDomain(message, chatId, send, saveInfo, info.hostingType,false);

    if (modifiedDomain === null || price === null) {
      return send(chatId, chatMessage)
    }

    if (domainType === 'Premium') {
      return send(chatId, t.trialPlanSBSDomainIsPremium)
    }

    return goto.continueWithDomainNameSBS(modifiedDomain)
  }

  if (action === a.domainAvailableContinue) {
    if (message === t.backButton || message === user.searchAnotherDomain) return goto.getFreeTrialPlanNow()
    if ((message === user.continueWithDomainNameSBS(info.website_name))) {
      // Auto-set Cloudflare NS — skip NS selection
      saveInfo('nameserver', 'cloudflare')
      return goto.proceedContinueWithDomainNameSBS()
    }
  }

  if (action === a.continueWithDomainNameSBS) {
    if (message === t.backButton) return goto.continueWithDomainNameSBS(info.website_name)
    // Skip email for free trial
    if (message === t.skipEmail) {
      saveInfo('email', null)
      return goto.sendcPanelCredentialsAsEmailToUser()
    }
    if (!isEmail(message)) return goto.displayEmailValidationError()
    return goto.confirmEmailBeforeProceedingSBS(message)
  }

  if (action === a.confirmEmailBeforeProceedingSBS) {
    if (message === t.backButton) return goto.proceedContinueWithDomainNameSBS()
    if (message === t.yesProceedWithThisEmail(info.email)) return goto.sendcPanelCredentialsAsEmailToUser()
  }


  // Premium Anti-Red Weekly Plan
  if (message === user.premiumWeekly) {
    return goto.selectPlan(a.premiumWeekly)
  }

  if (action === a.premiumWeekly) {
    if (message === user.backToHostingPlans) return goto.submenu3()
    if (message === user.buyPremiumWeekly) return goto.buyPlan(action)
    if (message === user.backToPremiumWeeklyDetails) return goto.selectPlan(a.premiumWeekly)
    if (message === user.registerANewDomain) return goto.registerNewDomain()
    if (message === user.useMyDomain) return goto.useMyDomain()
    if (message === user.connectExternalDomain) return goto.connectExternalDomain()
    if (message === user.useExistingDomain) return goto.useExistingDomain()
    if (message === user.viewPremiumCpanel) return goto.selectPlan(a.premiumCpanel)
    if (message === user.viewGoldenCpanel) return goto.selectPlan(a.goldenCpanel)
  }


  // Golden Anti-Red cPanel Plan
  if (message === user.goldenCpanel) {
    return goto.selectPlan(a.goldenCpanel)
  }

  if (action === a.goldenCpanel) {
    if (message === user.backToHostingPlans) return goto.submenu3()
    if (message === user.buyGoldenCpanel) return goto.buyPlan(action)
    if (message === user.backToGoldenCpanelDetails) return goto.selectPlan(a.goldenCpanel)
    if (message === user.registerANewDomain) return goto.registerNewDomain()
    if (message === user.useMyDomain) return goto.useMyDomain()
    if (message === user.connectExternalDomain) return goto.connectExternalDomain()
    if (message === user.useExistingDomain) return goto.useExistingDomain()
    if (message === user.viewPremiumWeekly) return goto.selectPlan(a.premiumWeekly)
    if (message === user.viewPremiumCpanel) return goto.selectPlan(a.premiumCpanel)
  }


  // Premium Anti-Red cPanel Plan
  if (message === user.premiumCpanel) {
    return goto.selectPlan(a.premiumCpanel)
  }

  if (action === a.premiumCpanel) {
    if (message === user.backToHostingPlans) return goto.submenu3()
    if (message === user.buyPremiumCpanel) return goto.buyPlan(action)
    if (message === user.backToPremiumCpanelDetails) return goto.selectPlan(a.premiumCpanel)
    if (message === user.registerANewDomain) return goto.registerNewDomain()
    if (message === user.useMyDomain) return goto.useMyDomain()
    if (message === user.connectExternalDomain) return goto.connectExternalDomain()
    if (message === user.useExistingDomain) return goto.useExistingDomain()
    if (message === user.viewGoldenCpanel) return goto.selectPlan(a.goldenCpanel)
    if (message === user.viewPremiumWeekly) return goto.selectPlan(a.premiumWeekly)
  }


  if (action === a.registerNewDomain) {
    if (message === t.back) return goto.buyPlan(a.premiumWeekly)
    send(chatId, t.checkingDomainAvail)
    const { modifiedDomain, price } = await planGetNewDomain(message, chatId, send, saveInfo, info.hostingType);
    if (modifiedDomain === null || price === null) return
    return goto.registerNewDomainFound(modifiedDomain, price)
  }

  if (action === a.useExistingDomain) {
    if (message === t.back) return goto.submenu3()
    send(chatId, t.checkingExistingDomainAvail)
    let modifiedDomain = removeProtocolFromDomain(message)
    const { available, chatMessage } = await planCheckExistingDomain(modifiedDomain, info.hostingType)
    if (!available) {
      send(chatId, chatMessage)
      return goto.domainNotFound(modifiedDomain)
    }

    return goto.useExistingDomainFound(modifiedDomain)
  }

  // Use My Domain — user selects from their purchased domains
  if (action === a.useMyDomain) {
    if (message === t.backButton || message === t.back) return goto.buyPlan(a.premiumWeekly)
    // User tapped a domain name from the list
    const domains = await getPurchasedDomains(chatId)
    if (domains.includes(message)) {
      saveInfo('website_name', message)
      saveInfo('existingDomain', true)
      saveInfo('nameserver', 'cloudflare')
      // Check if domain is already used by a hosting plan
      const existingPlan = await cpanelAccounts.findOne({ domain: message })
      if (existingPlan) {
        return send(chatId, `<b>${message}</b> is already on a ${existingPlan.plan}. Choose a different domain.`, k.of([[t.backButton]]))
      }
      return goto.enterYourEmail()
    }
    return send(chatId, 'Please select a domain from the list.', k.of([[t.backButton]]))
  }

  // Connect External Domain — user types a domain they own elsewhere
  if (action === a.connectExternalDomain) {
    if (message === t.back || message === t.backButton) return goto.buyPlan(a.premiumWeekly)
    let modifiedDomain = removeProtocolFromDomain(message)
    // Validate it looks like a domain
    if (!modifiedDomain || !modifiedDomain.includes('.')) {
      return send(chatId, 'Please enter a valid domain name (e.g., example.com).', bc)
    }
    // Check if domain is already used by a hosting plan
    const existingPlan = await cpanelAccounts.findOne({ domain: modifiedDomain })
    if (existingPlan) {
      return send(chatId, `<b>${modifiedDomain}</b> is already on a hosting plan. Enter a different domain.`, bc)
    }
    return goto.connectExternalDomainFound(modifiedDomain)
  }

  // Connect External Domain — confirm
  if (action === a.connectExternalDomainFound) {
    if (message === t.back || message === user.searchAnotherDomain) return goto.connectExternalDomain()
    if (message === user.continueWithDomain(info.website_name)) {
      saveInfo('nameserver', 'cloudflare')
      return goto.enterYourEmail()
    }
  }

  if (action === a.domainNotFound) {
    if (message === t.back) return goto.buyPlan(a.premiumWeekly)
    if (message === user.searchAnotherDomain) return goto.registerNewDomain()
    if (message === user.continueWithDomain(info.website_name)) return goto.enterYourEmail()
  }

  if (action === a.registerNewDomainFound) {
    if (message === t.back || message === user.searchAnotherDomain) return goto.registerNewDomain()
    if (message === user.continueWithDomain(info.website_name)) {
      await saveInfo('continue_domain_last_state', 'registerNewDomain')
      // Auto-set Cloudflare NS — skip NS selection
      saveInfo('nameserver', 'cloudflare')
      return goto.enterYourEmail()
    }
  }

  if (action === a.useExistingDomainFound) {
    if (message === t.back || message === user.searchAnotherDomain) return goto.useExistingDomain()
    if (message === user.continueWithDomain(info.website_name)) {
      await saveInfo('continue_domain_last_state', 'useExistingDomain')
      // Auto-set Cloudflare NS — skip NS selection
      saveInfo('nameserver', 'cloudflare')
      return goto.enterYourEmail()
    }
  }

  // NS selection handler is now a no-op pass-through (auto-cloudflare in goto)
  if (action === a.nameserverSelection) {
    saveInfo('nameserver', 'cloudflare')
    return goto.enterYourEmail()
  }

  if (action === a.enterYourEmail) {
    if (message === t.back) {
      // Go back to the domain step, not NS selection
      if (info?.continue_domain_last_state === 'registerNewDomain') return goto.registerNewDomainFound(info.website_name, info.price)
      else if (info?.continue_domain_last_state === 'useExistingDomain') return goto.useExistingDomainFound(info.website_name)
      return goto.buyPlan(a.premiumWeekly)
    }

    // Skip email — proceed without email
    if (message === t.skipEmail) {
      saveInfo('email', null)
      return goto.proceedWithEmail(info.website_name, info.price)
    }

    if (!isValidEmail(message)) {
      return send(chatId, hP.generatePlanStepText('invalidEmail'), k.of([t.skipEmail]))
    }
    return goto.confirmEmailBeforeProceeding(message)
  }

  if (action === a.confirmEmailBeforeProceeding) {
    if (message === t.back) return goto.enterYourEmail()
    if (message === t.yesProceedWithThisEmail(info.email)) return goto.proceedWithEmail(info.website_name, info.price)
  }

  if (action === a.proceedWithEmail) {
    if (message === t.back) return goto.enterYourEmail()
    if (message === t.proceedWithPayment) {
      return goto['hosting-pay']()
    }
  }

  // 123456
  if (action === a.proceedWithPaymentProcess) {
    if (message === t.back) return goto['hosting-pay']()
    if (message === t.iHaveSentThePayment) return goto.iHaveSentThePayment()
  }

  // My Hosting Plans — entry point
  if (message === user.myHostingPlans) {
    return goto.myHostingPlans()
  }

  // My Hosting Plans — select a plan to view
  if (action === a.myHostingPlans) {
    if (message === t.backButton || message === t.back) return goto.submenu3()
    // Check if user tapped a plan button (format: "🔍 domain.com")
    const domainMatch = message.match(/^🔍\s+(.+)$/)
    if (domainMatch) {
      return goto.viewHostingPlanDetails(domainMatch[1])
    }
    if (message === user.hostingDomainsRedirect) return goto.submenu3()
  }

  // View Hosting Plan — actions
  if (action === a.viewHostingPlan) {
    if (message === user.backToMyHostingPlans) return goto.myHostingPlans()
    if (message === user.revealCredentials) return goto.revealHostingCredentials()
    if (message === user.toggleAutoRenew) {
      const domain = info?.selectedHostingDomain
      if (!domain) return goto.myHostingPlans()
      const plan = await cpanelAccounts.findOne({ chatId: String(chatId), domain })
      if (!plan) return send(chatId, 'Plan not found.', k.of([[user.backToMyHostingPlans]]))
      const newAutoRenew = plan.autoRenew === false ? true : false
      await cpanelAccounts.updateOne({ _id: plan._id }, { $set: { autoRenew: newAutoRenew } })
      const statusText = newAutoRenew ? '✅ Auto-Renew is now <b>ON</b>. Your plan will be renewed automatically when it expires.' : '❌ Auto-Renew is now <b>OFF</b>. Your plan will expire and be suspended after grace period.'
      await send(chatId, statusText)
      return goto.viewHostingPlanDetails(domain)
    }
    if (message === user.renewHostingPlan) {
      const domain = info?.selectedHostingDomain
      if (!domain) return goto.myHostingPlans()
      const plan = await cpanelAccounts.findOne({ chatId: String(chatId), domain })
      if (!plan) return send(chatId, 'Plan not found.', k.of([[user.backToMyHostingPlans]]))

      const { getPlanPrice, getPlanDuration } = require('./hosting-scheduler')
      const price = getPlanPrice(plan.plan)
      const duration = getPlanDuration(plan.plan)
      const { usdBal } = await getBalance(walletOf, chatId)
      const expiry = plan.expiryDate ? new Date(plan.expiryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
      const isExpired = plan.expiryDate && new Date(plan.expiryDate) < new Date()

      const text = `<b>Renew Plan — ${plan.plan}</b>\n\n`
        + `<b>Domain:</b> ${domain}\n`
        + `<b>Current Expiry:</b> ${expiry}${isExpired ? ' (EXPIRED)' : ''}\n`
        + `<b>Duration:</b> ${duration} days\n`
        + `<b>Price:</b> $${price}\n\n`
        + `<b>Your Wallet Balance:</b> $${usdBal.toFixed(2)}\n`
        + (usdBal >= price
          ? `\n✅ You have sufficient funds. Tap <b>"Confirm & Pay"</b> to renew now.`
          : `\n⚠️ Insufficient funds. You need $${(price - usdBal).toFixed(2)} more. Please deposit first.`)

      set(state, chatId, 'action', a.confirmRenewNow)
      const buttons = usdBal >= price
        ? [[user.confirmRenewNow], [user.cancelRenewNow]]
        : [[trans('u.deposit')], [user.cancelRenewNow]]
      return send(chatId, text, k.of(buttons))
    }
  }

  // Confirm Renew Now — wallet deduction
  if (action === a.confirmRenewNow) {
    if (message === user.cancelRenewNow) return goto.viewHostingPlanDetails(info?.selectedHostingDomain)
    if (message === user.confirmRenewNow) {
      const domain = info?.selectedHostingDomain
      if (!domain) return goto.myHostingPlans()
      const plan = await cpanelAccounts.findOne({ chatId: String(chatId), domain })
      if (!plan) return send(chatId, 'Plan not found.', k.of([[user.backToMyHostingPlans]]))

      const { getPlanPrice, getPlanDuration } = require('./hosting-scheduler')
      const price = getPlanPrice(plan.plan)
      const duration = getPlanDuration(plan.plan)
      const { usdBal } = await getBalance(walletOf, chatId)

      if (usdBal < price) {
        return send(chatId, `⚠️ Insufficient wallet balance. You have $${usdBal.toFixed(2)} but need $${price}.\nPlease deposit funds first.`, k.of([[trans('u.deposit')], [user.cancelRenewNow]]))
      }

      // Deduct from wallet
      await atomicIncrement(walletOf, chatId, 'usdOut', price)

      // Extend expiry
      const now = new Date()
      const currentExpiry = plan.expiryDate ? new Date(plan.expiryDate) : now
      const baseDate = currentExpiry > now ? currentExpiry : now
      const newExpiry = new Date(baseDate.getTime() + duration * 24 * 60 * 60 * 1000)

      await cpanelAccounts.updateOne(
        { _id: plan._id },
        {
          $set: {
            expiryDate: newExpiry,
            expiryNotified: false,
            lastRenewedAt: now,
            suspended: false,
            renewalCount: (plan.renewalCount || 0) + 1,
          },
        }
      )

      // Unsuspend if was suspended
      if (plan.suspended) {
        try {
          const whmService = require('./whm-service')
          await whmService.unsuspendAccount(plan.cpUser)
        } catch (_) {}
      }

      // Re-deploy anti-red protection (non-blocking)
      try {
        const antiRedSvc = require('./anti-red-service')
        antiRedSvc.deployFullProtection(plan.cpUser, domain, plan.plan).catch(() => {})
      } catch (_) {}

      const newExpiryStr = newExpiry.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      const { usdBal: newBal } = await getBalance(walletOf, chatId)

      await send(chatId,
        `✅ <b>Plan Renewed Successfully!</b>\n\n`
        + `<b>Plan:</b> ${plan.plan}\n`
        + `<b>Domain:</b> ${domain}\n`
        + `<b>Charged:</b> $${price}\n`
        + `<b>New Expiry:</b> ${newExpiryStr}\n`
        + `<b>Remaining Balance:</b> $${newBal.toFixed(2)}\n\n`
        + `Anti-Red protection has been refreshed.`
      )
      return goto.viewHostingPlanDetails(domain)
    }
  }

  // shortURL — Bit.ly (paid)
  if (message === user.redBitly) {
    const redSelectProviderOptions = trans('redSelectProvider')
    saveInfo('provider', redSelectProviderOptions[0])
    return goto.redSelectUrl()
  }

  // shortURL — Shortit (trial/free)
  if (message === user.redShortit) {
    const redSelectProviderOptions = trans('redSelectProvider')
    saveInfo('provider', redSelectProviderOptions[1])
    return goto.redSelectUrl()
  }

  // shortURL (legacy)
  if (message === user.redSelectUrl) {
    return goto.redSelectUrl()
  }

  //VPS plans
  if (message === user.vpsPlans) {
    return goto.submenu4()
  }

  // ━━━ Digital Products ━━━
  if (message === user.digitalProducts) {
    return goto.submenu6()
  }

  // Digital Products: product selection
  if (action === a.submenu6) {
    if (message === t.back || message === t.cancel) return goto.displayMainMenuButtons()

    const dpProducts = {
      [t.dpTwilioMain]:     { name: 'Twilio Main Account',            key: 'twilio_main',      price: DP_PRICE_TWILIO_MAIN },
      [t.dpTwilioSub]:      { name: 'Twilio Sub-Account',             key: 'twilio_sub',       price: DP_PRICE_TWILIO_SUB },
      [t.dpTelnyxMain]:     { name: 'Telnyx Main Account',            key: 'telnyx_main',      price: DP_PRICE_TELNYX_MAIN },
      [t.dpTelnyxSub]:      { name: 'Telnyx Sub-Account',             key: 'telnyx_sub',       price: DP_PRICE_TELNYX_SUB },
      [t.dpAwsMain]:        { name: 'AWS Main Account',               key: 'aws_main',         price: DP_PRICE_AWS_MAIN },
      [t.dpAwsSub]:         { name: 'AWS Sub-Account',                key: 'aws_sub',          price: DP_PRICE_AWS_SUB },
      [t.dpGcloudMain]:     { name: 'Google Cloud Main Account',      key: 'gcloud_main',      price: DP_PRICE_GCLOUD_MAIN },
      [t.dpGcloudSub]:      { name: 'Google Cloud Sub-Account',       key: 'gcloud_sub',       price: DP_PRICE_GCLOUD_SUB },
      [t.dpGworkspaceNew]:  { name: 'Google Workspace (New Domain)',   key: 'gworkspace_new',   price: DP_PRICE_GWORKSPACE_NEW },
      [t.dpGworkspaceAged]: { name: 'Google Workspace (Aged Domain)',  key: 'gworkspace_aged',  price: DP_PRICE_GWORKSPACE_AGED },
      [t.dpZohoNew]:        { name: 'Zoho Mail (New Domain)',          key: 'zoho_new',         price: DP_PRICE_ZOHO_NEW },
      [t.dpZohoAged]:       { name: 'Zoho Mail (Aged Domain)',         key: 'zoho_aged',        price: DP_PRICE_ZOHO_AGED },
      [t.dpEsim]:           { name: 'eSIM T-Mobile',                   key: 'esim_tmobile',     price: DP_PRICE_ESIM },
    }

    const selected = dpProducts[message]
    if (!selected) return send(chatId, t.selectValidOption)

    await saveInfo('dpProductName', selected.name)
    await saveInfo('dpProductKey', selected.key)
    await saveInfo('dpPrice', selected.price)
    await saveInfo('lastStep', a.digitalProductPay)

    return goto['digital-product-pay']()
  }

  // Digital Products: payment method selection
  if (action === a.digitalProductPay) {
    if (message === t.back) return goto.submenu6()

    const payOption = message

    if (payOption === payIn.crypto) {
      set(state, chatId, 'action', 'crypto-pay-digital-product')
      return send(chatId, t.selectCryptoToDeposit, trans('k.of', trans('supportedCryptoViewOf')))
    }

    if (payOption === payIn.bank) {
      set(state, chatId, 'action', 'bank-pay-digital-product')
      return send(chatId, t.askEmail, bc)
    }

    if (payOption === payIn.wallet) {
      set(state, chatId, 'lastStep', 'digital-product-pay')
      return goto.walletSelectCurrency()
    }

    return send(chatId, t.askValidPayOption)
  }

  // Digital Products: bank payment
  if (action === 'bank-pay-digital-product') {
    if (message === t.back) return goto['digital-product-pay']()
    const email = message
    const price = info?.dpPrice
    const product = info?.dpProductName
    if (!isValidEmail(email)) return send(chatId, t.askValidEmail)

    const ref = nanoid()
    log({ ref })
    set(state, chatId, 'action', 'none')
    const priceNGN = Number(await usdToNgn(price))
    const orderId = nanoid(8).toUpperCase()

    // Save order
    const name = await get(nameOf, chatId)
    await digitalOrdersCol.insertOne({
      orderId,
      chatId,
      username: username || '',
      name: name || '',
      product,
      productKey: info?.dpProductKey,
      price,
      currency: 'NGN',
      paymentMethod: 'bank',
      paymentRef: ref,
      status: 'pending_payment',
      createdAt: new Date(),
      deliveredAt: null,
    })

    set(chatIdOfPayment, ref, { chatId, price, product, orderId, endpoint: '/bank-pay-digital-product' })
    notifyGroup(`🛒 <b>New Digital Product Order!</b>\n\n🆔 Order: <code>${orderId}</code>\n👤 User: ${maskName(name)} (${chatId})\n📦 Product: <b>${product}</b>\n💵 Price: <b>$${price}</b>\n💳 Payment: Bank\n⏳ Awaiting payment\n\n📩 After payment confirms:\n<code>/deliver ${orderId} [details]</code>`)
    const { url, error } = await createCheckout(priceNGN, `/ok?a=b&ref=${ref}&`, email, username, ref)
    if (error) return send(chatId, error, trans('o'))
    send(chatId, `Bank ₦aira + Card 🌐︎`, trans('o'))
    return send(chatId, `<a href="${url}">Click here to pay ₦${priceNGN.toLocaleString()}</a>`, { parse_mode: 'HTML', disable_web_page_preview: true })
  }

  // Digital Products: crypto payment
  if (action === 'crypto-pay-digital-product') {
    if (message === t.back) return goto['digital-product-pay']()
    const supportedCryptoView = trans('supportedCryptoView')
    const tickerKey = supportedCryptoView[message]
    if (!tickerKey) return send(chatId, t.askValidCrypto)
    const ticker = tickerOf[tickerKey]
    await saveInfo('cryptoTicker', ticker)

    const price = info?.dpPrice
    const product = info?.dpProductName
    const orderId = nanoid(8).toUpperCase()
    const name = await get(nameOf, chatId)
    const ref = nanoid()

    await digitalOrdersCol.insertOne({
      orderId,
      chatId,
      username: username || '',
      name: name || '',
      product,
      productKey: info?.dpProductKey,
      price,
      currency: 'crypto',
      paymentMethod: `crypto_${tickerKey}`,
      status: 'pending_payment',
      createdAt: new Date(),
      deliveredAt: null,
    })

    await saveInfo('dpOrderId', orderId)
    set(state, chatId, 'action', 'none')

    if (BLOCKBEE_CRYTPO_PAYMENT_ON === 'true') {
      const { address, bb } = await getCryptoDepositAddress(ticker, chatId, SELF_URL, `/crypto-pay-digital-product?a=b&ref=${ref}&`)
      if (!address) return send(chatId, t.errorFetchingCryptoAddress, trans('o'))
      set(chatIdOfPayment, ref, { chatId, price, product, orderId })
      log({ ref })
      await sendQrCode(bot, chatId, bb, info?.userLanguage ?? 'en')
      const priceCrypto = await convert(price, 'usd', ticker)
      send(chatId, t.showDepositCryptoInfoDigitalProduct(priceCrypto, tickerKey, address, product), trans('o'))
    } else {
      const coin = tickerOfDyno[tickerKey]
      const redirect_url = `${SELF_URL}/dynopay/crypto-pay-digital-product`
      const meta_data = { "product_name": "payDigitalProduct", "refId": ref }
      const { qr_code, address } = await getDynopayCryptoAddress(price, coin, redirect_url, meta_data)
      if (!address) return send(chatId, t.errorFetchingCryptoAddress, trans('o'))
      set(chatIdOfDynopayPayment, ref, { chatId, price, product, orderId, action: 'payDigitalProduct', address })
      log({ ref })
      await generateQr(bot, chatId, qr_code, info?.userLanguage ?? 'en')
      const priceCrypto = await convert(price, 'usd', ticker)
      send(chatId, t.showDepositCryptoInfoDigitalProduct(priceCrypto, tickerKey, address, product), trans('o'))
    }

    return notifyGroup(`🛒 <b>New Digital Product Order!</b>\n\n🆔 Order: <code>${orderId}</code>\n👤 User: ${maskName(name)} (${chatId})\n📦 Product: <b>${product}</b>\n💵 Price: <b>$${price}</b> (Crypto: ${tickerKey})\n⏳ Awaiting crypto payment\n\n📩 After payment confirms:\n<code>/deliver ${orderId} [details]</code>`)
  }

  if (message === user.buyVpsPlan) {
    return goto.createNewVpsFlow()
  }

  if (action === a.askCountryForVPS) {
    if (message === vp.back) return goto.submenu4()
    const areaList = info?.vpsAreaList
    if (!areaList.includes(message)) return send(chatId, vp.chooseValidCountry, vp.of(areaList))
    const vpsDetails = {
      country: message
    }
    info.vpsDetails = vpsDetails
    saveInfo('vpsDetails', vpsDetails)
    return goto.askRegionAreaForVps()
  }

  if (action === a.askRegionAreaForVPS) {
    if (message === vp.back) return goto.createNewVpsFlow()
    const areaList = info?.vpsAreaList
    const regionsList = areaList.map((item) => item.label)
    if (!regionsList.includes(message)) return send(chatId, vp.chooseValidRegion, vp.of(regionsList))
    let vpsDetails = info?.vpsDetails
    const regionDetails = areaList.find((ar) => ar.label === message)
    vpsDetails.region = regionDetails.value
    vpsDetails.regionName = regionDetails.label
    info.vpsDetails = vpsDetails
    saveInfo('vpsDetails', vpsDetails)
    return goto.askZoneForVps()
  }

  if (action === a.askZoneForVPS) {
    if (message === vp.back) return goto.askRegionAreaForVps()
    const areaList = info?.vpsAreaList
    const zoneList = areaList.map((item) => item.label)
    if (!zoneList.includes(message)) return send(chatId, vp.chooseValidZone, vp.of(zoneList))
    let vpsDetails = info?.vpsDetails
    const zoneDetails = areaList.find((ar) => ar.label === message)
    vpsDetails.zone = zoneDetails.name
    vpsDetails.zoneName = zoneDetails.label
    info.vpsDetails = vpsDetails
    saveInfo('vpsDetails', vpsDetails)
    saveInfo('vpsAreaList', null)
    return goto.confirmZoneForVPS()
  }

  if (action === a.confirmZoneForVPS) {
    if (message === vp.back) return goto.askZoneForVps()
    if (message === vp.confirmBtn) return goto.askVpsDiskType()
    return goto.confirmZoneForVPS()
  }

  if (action === a.askVpsDiskType) {
    if (message === vp.back) return goto.askZoneForVps()
    const options = info?.vpsDiskTypes
    const diskList = options?.map((item) => item?.label) || [];
    if (!diskList || !diskList.length) return send(chatId, vp.failedFetchingData, trans('o'))
    if (!diskList.includes(message)) return send (chatId, vp.chooseValidDiskType, vp.of(diskList))
    let vpsDetails = info?.vpsDetails
    const diskDetails = options.find((op) => op.label === message)
    vpsDetails.diskType = diskDetails.value
    vpsDetails.diskLabel = message
    vpsDetails.diskTypeId = diskDetails._id
    send(chatId, vp.vpsWaitingTime)
    const configTypes = await fetchAvailableVPSConfigs(chatId, vpsDetails)
    if (!configTypes) return send(chatId, vp.failedFetchingData, trans('o'))
    info.vpsDetails = vpsDetails
    info.vpsConfigTypes = configTypes
    saveInfo('vpsConfigTypes', configTypes)
    saveInfo('vpsDetails', vpsDetails)
    return goto.askVpsConfig()
  }

    // save vps configs
  if (action === a.askVpsConfig) {
    if (message === vp.back) return goto.askVpsDiskType()
    const vpsConfigurations = info?.vpsConfigTypes
    const configTypes = vpsConfigurations.map((item) => item.name)
    if (!configTypes.includes(message)) return send(chatId, vp.validVpsConfig, vp.of(configTypes))
    let vpsDetails = info?.vpsDetails
    const selectedConfigType = vpsConfigurations.find((item) => item.name === message)
    vpsDetails.config = selectedConfigType
    info.vpsDetails = vpsDetails
    saveInfo('vpsDetails', vpsDetails)
    return goto.askUserVpsPlan()
  }

  // save vps plan
  if (action === a.askUserVpsPlan) {
    if (message === vp.back) return goto.askVpsConfig()
    let vpsDetails = info?.vpsDetails
    const plans = vpsDetails.config.billingCycles.map((item) => item.type)
    if (!plans.includes(message)) return send(chatId, t.chooseValidPlan, vp.of(plans))
    const plan = vpsDetails.config.billingCycles.find(item => item.type === message)
    vpsDetails.plan = message
    vpsDetails.billingCycleId = plan._id
    vpsDetails.plantotalPrice = plan.originalPrice
    vpsDetails.couponApplied = false
    vpsDetails.couponDiscount = 0
    vpsDetails.planNewPrice = 0
    info.vpsDetails = vpsDetails
    saveInfo('vpsDetails', vpsDetails)
    return vpsDetails.plan != 'Hourly' ? goto.askCouponForVPSPlan() : goto.askVpsCpanel()
  }

  if (action === a.askCouponForVPSPlan) {
    if (message === vp.back) return goto.askUserVpsPlan()
    let vpsDetails = info.vpsDetails
    const coupon = message.toUpperCase()
    if (message === vp.skip) {
      vpsDetails.couponApplied = false
      vpsDetails.couponDiscount = 0
      vpsDetails.planNewPrice = 0
      info.vpsDetails = vpsDetails
      await saveInfo('vpsDetails', vpsDetails)
      return goto.skipCouponVps()
    }
    const couponResult = await resolveCoupon(coupon, chatId)
    if (!couponResult) return send(chatId, vp.couponInvalid)
    if (couponResult.error === 'already_used') return send(chatId, '⚠️ You have already used this coupon today.')
    const discount = couponResult.discount
    const couponDiscount = (vpsDetails.plantotalPrice * discount) / 100;
    const newPrice = vpsDetails.plantotalPrice - couponDiscount;
    vpsDetails.couponApplied = true
    vpsDetails.couponDiscount = couponDiscount
    vpsDetails.planNewPrice = newPrice

    info.vpsDetails = vpsDetails
    await saveInfo('vpsDetails', vpsDetails)
    if (couponResult.type === 'daily') await dailyCouponSystem.markCouponUsed(couponResult.code, chatId)
    send(chatId, vp.couponValid(couponDiscount))
    return vpsDetails.plan != 'Hourly' ? goto.askVPSPlanAutoRenewal() : goto.askVpsCpanel()
  }

  if (action === a.skipCouponVps) {
    let vpsDetails = info?.vpsDetails
    if (message === t.goBackToCoupon || message === vp.back) return goto.askCouponForVPSPlan()
    return vpsDetails.plan != 'Hourly' ? goto.askVPSPlanAutoRenewal() : goto.askVpsCpanel()
  }

  if (action === a.askVPSPlanAutoRenewal) {
    if (message === vp.back) return goto.askCouponForVPSPlan()
    if (message !== vp.skip && message !== vp.enable) return send(chatId, t.selectValidOption, vp.of([vp.enable, t.skip])) 
    let vpsDetails = info.vpsDetails
    vpsDetails.autoRenewalPlan = message === vp.enable ? true : false
    info.vpsDetails = vpsDetails
    await saveInfo('vpsDetails', vpsDetails)
    const expiresAt = getExpiryDateVps(vpsDetails.plan)
    if (message === vp.skip) {
      send(chatId, vp.skipAutoRenewalWarming(expiresAt))
    }
    return goto.askVpsCpanel()
  }

  if (action === a.askVpsCpanel) {
    let vpsDetails = info?.vpsDetails
    if (message === vp.back) return vpsDetails.plan != 'Hourly' ? goto.askVPSPlanAutoRenewal() : goto.askUserVpsPlan()
    const cpanels = trans('vpsCpanelOptional')
    if (!cpanels.includes(message)) return send (chatId, vp.validCpanel, vp.cpanelMenu)
    vpsDetails.panel = message === vp.noControlPanel ? null : {
      name: message === 'WHM' ? 'whm' : 'plesk'
    }
    vpsDetails.selectedCpanelPrice = 0
    info.vpsDetails = vpsDetails
    saveInfo('vpsDetails', vpsDetails)
    if (message === vp.noControlPanel) {
      send (chatId, vp.skipPanelMessage)
      return goto.askVpsOS()
    }
    return goto.askVpsCpanelLicense()
  }

  if (action === a.askVpsCpanelLicense) {
    let vpsDetails = info?.vpsDetails
    if (message === vp.back) return goto.askVpsCpanel()
    const options = info.vpsSelectedPanelOptions
    const list = options.map((item) => item.name)
    if (!list.includes(message)) return send(chatId, vp.askCpanelOtions(vpsDetails.panel.name, options), vp.of(list))
    const selectedOptionDetails = options.find((ar) => ar.name === message)
    vpsDetails.panel.license = selectedOptionDetails.id
    vpsDetails.panel.licenseName = selectedOptionDetails.name
    vpsDetails.panel.pricePerMonth = selectedOptionDetails.price
    vpsDetails.panel.id = selectedOptionDetails._id
    vpsDetails.panel.duration= selectedOptionDetails.durationValue
    vpsDetails.selectedCpanelPrice = selectedOptionDetails.price
    info.vpsDetails = vpsDetails
    saveInfo('vpsDetails', vpsDetails)
    if (message.toLowerCase().includes('trial')) {
      send(chatId, vp.trialCpanelMessage(vpsDetails.panel))
    }
    return goto.askVpsOS()
  }

  if (action === a.askVpsOS) {
    let vpsDetails = info?.vpsDetails
    if (message === vp.back) return goto.askVpsCpanel()
    const osData = info?.vpsOSList
    const osList = osData.map((item) => item.name)     
    if (!osList.includes(message) && message != vp.skipOSBtn) return send(chatId, vp.chooseValidOS, vp.of([...osList, vp.skipOSBtn]))
    const osDetails = osData.find((ar) => ar.name ===  (message === vp.skipOSBtn ? 'Ubuntu' : message))
    vpsDetails.os = {
      name: osDetails.name,
      value: osDetails.value,
      pricePerMonth: osDetails.price,
      id: osDetails._id
    }
    vpsDetails.selectedOSPrice = osDetails.price
    const planPrice = vpsDetails.couponApplied ? vpsDetails.planNewPrice : vpsDetails.plantotalPrice
    const OSprice = vpsDetails.selectedOSPrice
    const selectedCpanelPrice = vpsDetails.selectedCpanelPrice
    const totalPrice = Number(selectedCpanelPrice) + Number(planPrice) + Number(OSprice)
    vpsDetails.totalPrice = totalPrice.toFixed(2)
    info.vpsDetails = vpsDetails
    saveInfo('vpsDetails', vpsDetails)
    return goto.vpsAskSSHKey()
  }

  if (action === a.vpsAskSSHKey) {
    if (message === vp.back) return goto.askVpsOS()
    const vpsDetails = info.vpsDetails
    if (message === vp.skipSSHKeyBtn) return goto.askSkipSSHkeyconfirmation()
    if (message === vp.generateSSHKeyBtn) {
      const newSShKey = await generateNewSSHkey(chatId)
      if (!newSShKey) {
        send(chatId, vp.failedGeneratingSSHKey)
        return goto.vpsAskSSHKey()
      }
      vpsDetails.sshKeyName = newSShKey.sshKeyName
      info.vpsDetails = vpsDetails
      saveInfo('vpsDetails', vpsDetails)
      send(chatId, vp.newSSHKeyGeneratedMsg(newSShKey.sshKeyName))
      return goto.vpsAskPaymentConfirmation()
    }
    if (message === vp.linkSSHKeyBtn) return goto.vpsLinkSSHKey()
    return send(chatId, t.selectValidOption, vpsDetails?.hasSSHKey 
      ? vp.of([vp.generateSSHKeyBtn, vp.linkSSHKeyBtn , vp.skipSSHKeyBtn]) : vp.of([vp.generateSSHKeyBtn , vp.skipSSHKeyBtn]))
  }

  if (action === a.askSkipSSHkeyconfirmation) {
    if (message === vp.back || message === vp.setUpSSHBtn) return goto.vpsAskSSHKey()
    let vpsDetails = info.vpsDetails
    if (message === vp.confirmSkipSSHBtn) {
      vpsDetails.sshKeyName = null
      info.vpsDetails = vpsDetails
      saveInfo('vpsDetails', vpsDetails)
      send(chatId, vp.sshLinkingSkipped)
      return goto.vpsAskPaymentConfirmation()
    }
    return send(chatId, t.selectValidOption, vp.of([vp.confirmSkipSSHBtn, vp.setUpSSHBtn]))
  }

  if (action === a.vpsLinkSSHKey) {
    if (message === vp.back) return goto.vpsAskSSHKey()
    let vpsDetails = info.vpsDetails
    if (message === vp.cancel) {
      vpsDetails.sshKeyName = null
      info.vpsDetails = vpsDetails
      saveInfo('vpsDetails', vpsDetails)
      send(chatId, vp.cancelLinkingSSHKey)
      return goto.vpsAskPaymentConfirmation()
    }
    if (message === vp.uploadNewKeyBtn) {
      return goto.askUploadSSHPublicKey()
    }
    const sshKeyList = vpsDetails.sshKeysList
    if (!sshKeyList.includes(message)) return send(chatId, vp.selectValidSShKey, vp.of([...sshKeyList, vp.uploadNewKeyBtn, vp.cancel]))
    vpsDetails.sshKeyName = message
    info.vpsDetails = vpsDetails
    saveInfo('vpsDetails', vpsDetails)
    send(chatId, vp.sshKeySavedForVPS(message))
    return goto.vpsAskPaymentConfirmation()
  }

  if (action === a.askUploadSSHPublicKey) {
    if (message === vp.back) return goto.vpsLinkSSHKey()
    let vpsDetails = info.vpsDetails
    let newSShKey;
    if (msg.document) {
      try {
        if (!msg.document?.file_name.includes('.pub')) return send(chatId, vp.fileTypePub)
        const fileLink = await bot?.getFileLink(msg.document.file_id)
        const content = (await axios.get(fileLink, { responseType: 'text' }))?.data
        newSShKey = await uploadSSHPublicKey(chatId, content)
      } catch (error) {
        console.error('Error:', error.message)
        return send(chatId, t.fileError)
      }
    } else if (message.length) {
      newSShKey = await uploadSSHPublicKey(chatId, message)
    }
    if (!newSShKey) {
      send(chatId, vp.failedGeneratingSSHKey)
      return goto.vpsAskSSHKey()
    }
    vpsDetails.sshKeyName = newSShKey.sshKeyName
    info.vpsDetails = vpsDetails
    saveInfo('vpsDetails', vpsDetails)
    send(chatId, vp.newSSHKeyUploadedMsg(newSShKey.sshKeyName))
    return goto.vpsAskPaymentConfirmation()
  }
  
  if (action === a.proceedWithVpsPayment) {
    if (message === vp.back) return goto.vpsAskSSHKey()
    if (message === vp.no) {
      saveInfo('vpsDetails', null)
      set(state, chatId, 'action', 'none')
      return send(chatId, t.welcome, trans('o'))
    }
    if (message === vp.yes) return goto['vps-plan-pay']()
    send(chatId, t.selectValidOption)
  }

  if (message === user.manageVpsPlan) {
    return goto.getUserAllVmIntances()
  }

  if (action === a.getUserAllVmIntances) {
    if (message === vp.back) return goto.submenu4()
    if (message === user.buyVpsPlan) return goto.createNewVpsFlow()
    const list = info?.userVPSDetails?.map((item) => item?.name) || [];
    if (!list?.includes(message)) return send(chatId, vp.selectCorrectOption, vp.of([...list, user.buyVpsPlan]))
    const selectedVPS = info?.userVPSDetails?.find((item) => item.name ===  message)
    info.vpsDetails = selectedVPS
    saveInfo('vpsDetails', selectedVPS)
    return goto.getVPSDetails()
  }

  if (action === a.getVPSDetails) {
    if (message === vp.back) return goto.getUserAllVmIntances()
    const userVPSDetails = info.userVPSDetails
    if (message === vp.stopVpsBtn) return goto.confirmStopVps()
    if (message === vp.deleteVpsBtn) return goto.confirmDeleteVps()
    if (message === vp.upgradeVpsBtn) return goto.upgradeVpsInstance()
    if (message === vp.subscriptionBtn) return goto.vpsSubscription()
    if (message === vp.VpsLinkedKeysBtn) return goto.vpsLinkedSSHkeys()
    if (message === vp.startVpsBtn) {
      send(chatId, vp.vpsBeingStarted(userVPSDetails.name))
      const changeVpsStatus = await changeVpsInstanceStatus(userVPSDetails, 'start')
      if (changeVpsStatus.success) {
        await vpsPlansOf.updateOne(
          { vpsId: userVPSDetails._id },
          { $set: { 'status': 'RUNNING' } },
        )
        send(chatId, vp.vpsStarted(userVPSDetails.name))
      } else {
        send(chatId, vp.failedStartedVPS(userVPSDetails.name))
      }
      return goto.getVPSDetails()
    }
    if (message === vp.restartVpsBtn) {
      send(chatId, vp.vpsBeingRestarted(userVPSDetails.name))
      const changeVpsStatus = await changeVpsInstanceStatus(userVPSDetails, 'restart')
      if (changeVpsStatus.success) {
        send(chatId, vp.vpsRestarted(userVPSDetails.name))
      } else {
        send(chatId, vp.failedRestartingVPS(userVPSDetails.name))
      }
      return goto.getVPSDetails()
    }
    return send(chatId, vp.selectCorrectOption)
  }

  if (action === a.confirmStopVps) {
    if (message === vp.back) return goto.getVPSDetails()
    if (message === vp.cancel) return goto.getUserAllVmIntances()
    if (message === vp.confirmChangeBtn) {
      const userVPSDetails = info.userVPSDetails
      send(chatId, vp.vpsBeingStopped(userVPSDetails.name))
      const changeVpsStatus = await changeVpsInstanceStatus(userVPSDetails, 'stop')
      if (changeVpsStatus.success) {
        await vpsPlansOf.updateOne(
          { vpsId: userVPSDetails._id },
          { $set: { 'status': 'TERMINATED' } },
        )
        send(chatId, vp.vpsStopped(userVPSDetails.name))
      } else {
        send(chatId, vp.failedStoppingVPS(userVPSDetails.name))
      }
      return goto.getVPSDetails()
    }
    return send(chatId, vp.selectCorrectOption, vp.of([ vp.confirmChangeBtn, vp.cancel]))
  }

  if (action === a.confirmDeleteVps) {
    if (message === vp.back) return goto.getVPSDetails()
    if (message === vp.cancel) return goto.getUserAllVmIntances()
    if (message === vp.confirmChangeBtn) {
      const userVPSDetails = info.userVPSDetails
      send(chatId, vp.vpsBeingDeleted(userVPSDetails.name))
      const deleteVpsStatus = await deleteVPSinstance(chatId, userVPSDetails._id)
      if (deleteVpsStatus.success) {
        await vpsPlansOf.deleteOne(
          { vpsId: userVPSDetails._id }
        )
        send(chatId, vp.vpsDeleted(userVPSDetails.name))
      } else {
        send(chatId, vp.failedDeletingVPS(userVPSDetails.name))
      }
      return goto.getUserAllVmIntances()
    }
    return send(chatId, vp.selectCorrectOption, vp.of([ vp.confirmChangeBtn, vp.cancel]))
  }

  if (action === a.upgradeVpsInstance) {
    if (message === vp.back) return goto.getVPSDetails()
    if (message !== vp.upgradeVpsDiskBtn && message !== vp.upgradeVpsPlanBtn) {
      return send(chatId, vp.selectCorrectOption, vp.of([ vp.upgradeVpsPlanBtn, vp.upgradeVpsDiskBtn ]))
    }
    let vpsDetails = info.vpsDetails
    if (message === vp.upgradeVpsPlanBtn) {
      vpsDetails.upgradeType = 'plan'
    } else if (message === vp.upgradeVpsDiskBtn) {
      vpsDetails.upgradeType = 'disk'
    }
    info.vpsDetails = vpsDetails
    saveInfo('vpsDetails', vpsDetails)
    return goto.upgradeVpsPlan()
  }

  if (action === a.upgradeVpsPlan) {
    if (message === vp.back) return goto.upgradeVpsInstance()
    if (message === vp.cancel) return goto.getVPSDetails()
    const vpsDetails = info.vpsDetails
    const upgradeOptions = info.VPSUpgradeOptions
    const upgradeBtns = upgradeOptions.map((item) => vp.upgradeOptionVPSBtn(item.to))
    if (!upgradeBtns.includes(message)) return send(chatId, vp.selectCorrectOption, vp.of([ ...upgradeBtns, vp.cancel]))
    const selectedUpgrade = upgradeOptions.find(item => vp.upgradeOptionVPSBtn(item.to) === message)
    vpsDetails.upgradeOption = selectedUpgrade
    vpsDetails.billingCycle = info.userVPSDetails.billingCycleDetails.type
    if (vpsDetails.upgradeType === 'plan') {
      vpsDetails.totalPrice = getVpsUpgradePrice(vpsDetails)
    } else if ( vpsDetails.upgradeType === 'disk') {
      if (vpsDetails.billingCycle === 'Hourly') {
        vpsDetails.totalPrice = (Number(info.userVPSDetails.price) + Number(selectedUpgrade.price)).toFixed(2)
      } else {
        vpsDetails.totalPrice = selectedUpgrade.price
      }
    }
    info.vpsDetails = vpsDetails
    saveInfo('vpsDetails', vpsDetails)
    return goto.askVpsUpgradePayment()
  }

  if (action === a.askVpsUpgradePayment) {
    if (message === vp.back) return goto.upgradeVpsInstance()
    if (message === vp.no) {
      set(state, chatId, 'action', 'none')
      return goto.getVPSDetails()
    }
    if (message === vp.yes) return goto['vps-upgrade-plan-pay']()
    send(chatId, t.selectValidOption)
  }

  if (action === a.vpsSubscription) {
    if (message === vp.back) return goto.getVPSDetails()
    if (message !== vp.manageVpsSubBtn && message !== vp.manageVpsPanelBtn) {
      const availableOptions = info.userVPSDetails.cPanel ? [vp.manageVpsSubBtn, vp.manageVpsPanelBtn] : [vp.manageVpsSubBtn]
      return send(chatId, vp.selectCorrectOption, vp.of(availableOptions))
    }
    if (message === vp.manageVpsSubBtn) return goto.manageVpsSub()
    if (message === vp.manageVpsPanelBtn) return goto.manageVpsPanel()
  }

  if (action === a.manageVpsSub) {
    if (message === vp.back) return goto.vpsSubscription()
    if (message === vp.vpsDisableRenewalBtn || message === vp.vpsEnableRenewalBtn) {
      let vpsDetails = info.userVPSDetails
      const changeAutoRenewal = await changeVpsAutoRenewal(chatId, vpsDetails)
      if (changeAutoRenewal) {
        vpsDetails.autoRenewable = changeAutoRenewal.autoRenewable
        saveInfo('userVPSDetails', vpsDetails)
        const expiryDate = date(changeAutoRenewal.subscriptionEnd)
        send(chatId, message === vp.vpsDisableRenewalBtn ? vp.disabledAutoRenewal(vpsDetails, expiryDate) : vp.enabledAutoRenewal(vpsDetails, expiryDate))
      } else {
        send(chatId, vp.failedDeletingVPS(vpsDetails.name))
      }
      return goto.vpsSubscription()
    }
    if (message === vp.vpsPlanRenewBtn) {
      let vpsDetails = info.vpsDetails
      vpsDetails.upgradeType = 'vps-renew'
      vpsDetails.totalPrice = info.userVPSDetails.price
      vpsDetails.billingCycle = info.userVPSDetails.billingCycleDetails.type
      info.vpsDetails = vpsDetails
      saveInfo('vpsDetails', vpsDetails)
      return goto.confirmVPSRenewDetails()
    }
    return send(chatId, vp.selectCorrectOption)
  }

  if (action === a.manageVpsPanel) {
    if (message === vp.back) return goto.vpsSubscription()
    if (message === vp.vpsPlanRenewBtn) {
      let vpsDetails = info.vpsDetails
      vpsDetails.upgradeType = 'vps-cPanel-renew'
      vpsDetails.totalPrice = info.userVPSDetails.cPanelPlanDetails.price
      vpsDetails.billingCycle = null
      info.vpsDetails = vpsDetails
      saveInfo('vpsDetails', vpsDetails)
      return goto.confirmVPSRenewDetails()
    }
    return send(chatId, vp.selectCorrectOption)
  }

  if (action === a.confirmVPSRenewDetails) {
    let vpsDetails = info.vpsDetails
    if (message === vp.back) return vpsDetails.upgradeType === 'vps-renew' ? goto.manageVpsSub() : goto.manageVpsPanel()
    if (message === vp.payNowBtn) return goto['vps-upgrade-plan-pay']()
    return send(chatId, vp.selectCorrectOption)
  }

  if (action === a.vpsLinkedSSHkeys) {
    if (message === vp.back) return goto.getVPSDetails()
    if (message === vp.unlinkSSHKeyBtn) return goto.vpsUnlinkSSHKey()
    if (message === vp.linkVpsSSHKeyBtn) return goto.vpslinkNewSSHKey()
    if (message === vp.downloadSSHKeyBtn) return goto.downloadSSHKey()
    return goto.vpsLinkedSSHkeys()
  }

  if (action === a.vpsUnlinkSSHKey) {
    if (message === vp.back) return goto.vpsLinkedSSHkeys()
    let vpsDetails = info.vpsDetails
    const linkedSSHKeys = vpsDetails.linkedSSHKeys
    if (message === vp.cancel) return goto.getVPSDetails()
    if (!linkedSSHKeys.includes(message)) return goto.vpsUnlinkSSHKey()
    vpsDetails.keyForUnlink = message
    info.vpsDetails = vpsDetails
    saveInfo('vpsDetails', vpsDetails)
    return goto.confirmVpsUnlinkSSHKey()
  }

  if (action === a.confirmVpsUnlinkSSHKey) {
    if (message === vp.back) return goto.vpsUnlinkSSHKey()
    if (message === vp.cancel) return goto.vpsLinkedSSHkeys()
    if (message === vp.confirmUnlinkBtn) {
      const vpsDetails = info.vpsDetails
      const unlinkKey = await unlinkSSHKeyFromVps(chatId, vpsDetails.keyForUnlink, info.userVPSDetails)
      if (unlinkKey) {
        send(chatId, vp.keyUnlinkedMsg(vpsDetails))
      } else {
        send(chatId, vp.failedUnlinkingKey(vpsDetails))
      }
      return goto.vpsLinkedSSHkeys()
    }
    return send(chatId, vp.selectCorrectOption, vp.of([vp.confirmUnlinkBtn, vp.cancel]))
  }

  if (action === a.vpslinkNewSSHKey) {
    if (message === vp.back) return goto.vpsLinkedSSHkeys()
    if (message === vp.cancel) return goto.getVPSDetails()
    if (message === vp.uploadNewKeyBtn) return goto.uploadSShKeyToAttach()
    let vpsDetails = info.vpsDetails
    let allSSHkeys = vpsDetails.allSSHkeys
    if (!allSSHkeys.includes(message)) return send(chatId, vp.selectCorrectOption, vp.of([...allSSHkeys, vp.uploadNewKeyBtn, vp.cancel]))
    const data = {
      zone: info.userVPSDetails.zone,
      vpsId: info.userVPSDetails._id,
      sshKeys: [ message ],
      telegramId: chatId,
    }
    const linkedKey = await attachSSHKeysToVM(data)
    if (linkedKey) {
      send(chatId, vp.linkKeyToVpsSuccess(message, vpsDetails.name))
    } else {
      send(chatId, vp.failedLinkingSSHkeyToVps(message, vpsDetails.name))
    }
    return goto.vpsLinkedSSHkeys()
  }

  if (action === a.uploadSShKeyToAttach) {
    if (message === vp.back) return goto.vpslinkNewSSHKey()
    let vpsDetails = info.vpsDetails
    let newSShKey;
    if (msg.document) {
      try {
        if (!msg.document?.file_name.includes('.pub')) return send(chatId, vp.fileTypePub)
        const fileLink = await bot?.getFileLink(msg.document.file_id)
        const content = (await axios.get(fileLink, { responseType: 'text' }))?.data
        newSShKey = await uploadSSHPublicKey(chatId, content)
      } catch (error) {
        console.error('Error:', error.message)
        return send(chatId, t.fileError)
      }
    } else if (message.length) {
      newSShKey = await uploadSSHPublicKey(chatId, message)
    }
    if (!newSShKey) {
      send(chatId, vp.failedGeneratingSSHKey)
      return goto.vpslinkNewSSHKey()
    }
    const data = {
      zone: info.userVPSDetails.zone,
      vpsId: info.userVPSDetails._id,
      sshKeys: [ newSShKey.sshKeyName ],
      telegramId: chatId,
    }
    const linkedKey = await attachSSHKeysToVM(data)
    if (linkedKey) {
      send(chatId, vp.linkKeyToVpsSuccess(newSShKey.sshKeyName, vpsDetails.name))
    } else {
      send(chatId, vp.failedLinkingSSHkeyToVps(newSShKey.sshKeyName, vpsDetails.name))
    }
    return goto.vpslinkNewSSHKey()
  }

  if (action === a.downloadSSHKey) {
    if (message === vp.back) return goto.vpsLinkedSSHkeys()
    if (message === vp.cancel) return goto.getVPSDetails()
    let vpsDetails = info.vpsDetails
    let linkedSSHKeys = vpsDetails.linkedSSHKeys
    if (!linkedSSHKeys.includes(message)) return send(chatId, vp.selectCorrectOption, vp.of([...linkedSSHKeys, vp.cancel]))
    const response = await downloadSSHKeyFile(chatId, message)
    if (response) {
      const filename = `${message}.ppk`
      fs.writeFileSync(filename, response)
      bot
        ?.sendDocument(chatId, filename)
        ?.then(() => fs.unlinkSync(filename))
        ?.catch(log)
    }
    return goto.vpsLinkedSSHkeys()
  }

  if (action === a.redSelectUrl) {
    if (message === t.back) return goto.submenu1()
    if (!isValidUrl(message)) return send(chatId, t.redValidUrl, bc)
    saveInfo('url', message)
    return goto.redSelectRandomCustom()
  }

  if (action === a.redSelectProvider) {
    if (message === t.back) return goto.redSelectUrl()
    if (message === user.buyPlan) return goto['choose-subscription']()
    const redSelectProvider = trans('redSelectProvider')
    if (!redSelectProvider.includes(message)) return send(chatId, t.what)
    saveInfo('provider', message)
    // bitly
    if (message === redSelectProvider[0]) {
      return goto.redSelectRandomCustom()
    }
    // cuttly
    if (redSelectProvider[1] === message) {
      return goto.redSelectRandomCustom()
    }
  }
  if (action === a.redSelectRandomCustom) {
    if (message === t.back) return goto.redSelectUrl()

    const redSelectRandomCustom = trans('redSelectRandomCustom')

    if (!redSelectRandomCustom.includes(message)) return send(chatId, t.what)
    saveInfo('format', message)

    // Check if Bitly (paid) provider was selected — route through wallet payment
    const redSelectProviderOptions = trans('redSelectProvider')
    if (info.provider === redSelectProviderOptions[0]) {
      await saveInfo('price', PRICE_BITLY_LINK)
      return goto.askCoupon(a.redSelectProvider)
    }

    // random (free provider)
    if (redSelectRandomCustom[0] === message) {

      // Check if user has free links or is subscribed
      if (!(await isSubscribed(chatId)) && !(await freeLinksAvailable(chatId))) {
        return send(chatId, t.freeLinksExhausted, k.of([user.buyPlan]))
      }

      try {
        const { url } = info
        let _shortUrl, shortUrl
        if (process.env.LINK_TO_SELF_SERVER === 'false') {
          _shortUrl = await createShortUrlApi(url)
          shortUrl = _shortUrl.replaceAll('.', '@').replace('https://', '')
          set(linksOf, chatId, shortUrl, url)
        } else {
          const slug = nanoid()
          const __shortUrl = `${SELF_URL}/${slug}`
          _shortUrl = await createShortUrlApi(__shortUrl)
          shortUrl = __shortUrl.replaceAll('.', '@').replace('https://', '')
          const shortUrlLink = _shortUrl.replaceAll('.', '@').replace('https://', '')
          set(linksOf, chatId, shortUrlLink, url)
        }
        increment(totalShortLinks, 'total')
        set(maskOf, shortUrl, _shortUrl)
        set(fullUrlOf, shortUrl, url)

        const name = await get(nameOf, chatId)
        notifyGroup(`🔗 <b>Short Link Created!</b>\nUser ${maskName(name)} just shortened a link.\n${FREE_LINKS} free trial links for everyone — try it now — /start`)

        // Decrement free links counter for non-subscribed users
        if (!(await isSubscribed(chatId))) {
          await decrement(freeShortLinksOf, chatId)
          const remaining = (await get(freeShortLinksOf, chatId)) || 0
          freeLinks = remaining
          set(state, chatId, 'action', 'none')
          send(chatId, _shortUrl, trans('o'))
          if (remaining <= 2) {
            return send(chatId, t.linksRemaining(remaining, FREE_LINKS), k.of([user.buyPlan]))
          }
          return send(chatId, t.linksRemaining(remaining, FREE_LINKS))
        }

        set(state, chatId, 'action', 'none')
        return send(chatId, _shortUrl, trans('o'))
      } catch (error) {
        send(TELEGRAM_ADMIN_CHAT_ID, error?.response?.data)
        set(state, chatId, 'action', 'none')
        return send(chatId, t.redIssueUrlCuttly, trans('o'))
      }
    }

    // custom
    if (redSelectRandomCustom[1] === message) return goto.redSelectCustomExt()
  }
  if (action === a.redSelectCustomExt) {
    if (message === t.back) return goto.redSelectRandomCustom()

    // Check if user has free links or is subscribed
    if (!(await isSubscribed(chatId)) && !(await freeLinksAvailable(chatId))) {
      return send(chatId, t.freeLinksExhausted, k.of([user.buyPlan]))
    }

    if (!isValidUrl(`https://abc.com/${message}`)) return send(chatId, t.notValidHalf)
    try {
      const { url } = info
      const slug = nanoid()
      const __shortUrl = `${SELF_URL}/${slug}`
      const _shortUrl = await createCustomShortUrlCuttly(__shortUrl, message)
      const shortUrl = __shortUrl.replaceAll('.', '@').replace('https://', '')
      increment(totalShortLinks, 'total')
      set(maskOf, shortUrl, _shortUrl)
      set(fullUrlOf, shortUrl, url)
      set(linksOf, chatId, shortUrl, url)

      const name = await get(nameOf, chatId)
      notifyGroup(`🔗 <b>Short Link Created!</b>\nUser ${maskName(name)} just shortened a link.\n${FREE_LINKS} free trial links for everyone — try it now — /start`)

      // Decrement free links counter for non-subscribed users
      if (!(await isSubscribed(chatId))) {
        await decrement(freeShortLinksOf, chatId)
        const remaining = (await get(freeShortLinksOf, chatId)) || 0
        freeLinks = remaining
        set(state, chatId, 'action', 'none')
        send(chatId, _shortUrl, trans('o'))
        if (remaining <= 2) {
          return send(chatId, t.linksRemaining(remaining, FREE_LINKS), k.of([user.buyPlan]))
        }
        return send(chatId, t.linksRemaining(remaining, FREE_LINKS))
      }

      set(state, chatId, 'action', 'none')
      return send(chatId, _shortUrl, trans('o'))
    } catch (error) {
      if (error?.response?.data?.url?.status === 3) {
        return send(chatId, t.redIssueSlugCuttly)
      }

      send(
        TELEGRAM_ADMIN_CHAT_ID,
        'cuttly issue: status:' + error?.response?.data?.url?.status + ' ' + error?.response?.data,
      )
      set(state, chatId, 'action', 'none')
      return send(chatId, t.redIssueUrlCuttly, trans('o'))
    }
  }

  if (action === a.askCoupon + a.redSelectProvider) {
    if (message === t.back) return goto.redSelectProvider()
    if (message === t.skip) {
      saveInfo('lastStep', a.redSelectProvider)
      return (await saveInfo('couponApplied', false)) || goto.walletSelectCurrency()
    }

    const { price } = info
    const coupon = message.toUpperCase()
    const couponResult = await resolveCoupon(coupon, chatId)
    if (!couponResult) return send(chatId, t.couponInvalid)
    if (couponResult.error === 'already_used') return send(chatId, '⚠️ You have already used this coupon today.')

    const newPrice = price - (price * couponResult.discount) / 100
    send(chatId, t.redNewPrice(price, newPrice), k.pay)
    await saveInfo('newPrice', newPrice)
    await saveInfo('couponApplied', true)
    await saveInfo('lastStep', a.redSelectProvider)
    if (couponResult.type === 'daily') await dailyCouponSystem.markCouponUsed(couponResult.code, chatId)

    return goto.walletSelectCurrency()
  }

  if (message === user.urlShortener) {
    return goto['choose-url-to-shorten']()
  }
  if (message === user.activateDomainShortener) {
    return goto['quick-activate-domain-shortener']()
  }
  if (action === 'quick-activate-domain-shortener') {
    if (message === t.back || message === t.cancel) return goto.submenu1()

    const domain = message.toLowerCase()
    const domains = await getPurchasedDomains(chatId)
    if (!domains.includes(domain)) {
      return send(chatId, t.selectValidOption || 'Please choose a valid domain from the list.')
    }

    send(chatId, `🔗 Activating shortener for <b>${domain}</b>…`, { parse_mode: 'HTML' })

    try {
      const { server, error, recordType } =
        process.env.HOSTED_ON === 'render'
          ? await saveDomainInServerRender(domain)
          : await saveDomainInServerRailway(domain)

      if (error) {
        return send(chatId, `❌ Could not link <b>${domain}</b>: ${error}`, { parse_mode: 'HTML' })
      }

      send(chatId, `⏳ Configuring DNS for <b>${domain}</b>…`, { parse_mode: 'HTML' })

      const dnsResult = await domainService.viewDNSRecords(domain, db)
      const source = dnsResult?.source || 'connectreseller'

      if (source === 'openprovider') {
        await sleep(10000)
        const addResult = await domainService.addDNSRecord(domain, recordType, server, '', db)
        if (addResult.error || !addResult.success) {
          return send(chatId, `❌ DNS error for <b>${domain}</b>: ${addResult.error || 'Unknown error'}`, { parse_mode: 'HTML' })
        }
      } else {
        await sleep(65000)
        const { error: saveErr } = await saveServerInDomain(domain, server, recordType)
        if (saveErr) {
          return send(chatId, `❌ DNS error for <b>${domain}</b>: ${saveErr}`, { parse_mode: 'HTML' })
        }
      }

      send(chatId, `✅ <b>${domain}</b> linked to URL shortener. DNS may take up to 24h to propagate.`, { parse_mode: 'HTML' })
      const lang = info?.userLanguage || 'en'
      regularCheckDns(bot, chatId, domain, lang)
    } catch (e) {
      log(`[QuickActivateShortener] Error for ${domain}: ${e.message}`)
      send(chatId, `❌ Error activating shortener for <b>${domain}</b>: ${e.message}\n\nPlease try again later.`)
    }
    return
  }
  if (action === 'choose-url-to-shorten') {
    if (message === t.back) return goto.submenu1()
    if (!isValidUrl(message)) return send(chatId, t.provideLink, bc)

    set(state, chatId, 'url', message)

    const domains = await getPurchasedDomains(chatId)
    return goto['choose-domain-with-shorten']([...domains, ...adminDomains])
  }
  if (action === 'choose-domain-with-shorten') {
    if (message === t.back) return goto['choose-url-to-shorten']()
    if (message === user.buyDomainName) return goto['choose-domain-to-buy']()

    const domain = message.toLowerCase()
    const domains = await getPurchasedDomains(chatId)
    if (!(domains.includes(domain) || adminDomains.includes(domain))) {
      return send(chatId, 'Please choose a valid domain')
    }
    set(state, chatId, 'selectedDomain', message)
    return goto['choose-link-type']()
  }
  if (action === 'choose-link-type') {
    if (message === t.back) return goto['choose-domain-with-shorten'](await getPurchasedDomains(chatId))
    const linkOptions = trans('linkOptions')
    if (!linkOptions.includes(message)) return send(chatId, t.what)

    if (message === t.customLink) {
      set(state, chatId, 'action', 'shorten-custom')
      return send(chatId, t.askShortLinkExtension, bc)
    }

    // Random Link
    const url = info?.url
    const domain = info?.selectedDomain
    const shortUrl = domain + '/' + nanoid()
    if (await get(fullUrlOf, shortUrl)) {
      send(chatId, t.linkAlreadyExist)
      return
    }

    const shortUrlSanitized = shortUrl.replaceAll('.', '@')
    increment(totalShortLinks, 'total')
    set(state, chatId, 'action', 'none')
    set(fullUrlOf, shortUrlSanitized, url)
    set(linksOf, chatId, shortUrlSanitized, url)
    send(chatId, t.yourShortendUrl(shortUrl), trans('o'))
    return
  }
  if (action === 'shorten-custom') {
    if (message === t.back) return goto['choose-link-type']()

    const url = info?.url
    const domain = info?.selectedDomain
    const shortUrl = domain + '/' + message

    if (!isValidUrl('https://' + shortUrl)) return send(chatId, t.provideLink)
    if (await get(fullUrlOf, shortUrl)) return send(chatId, t.linkAlreadyExist)

    const shortUrlSanitized = shortUrl.replaceAll('.', '@')
    increment(totalShortLinks, 'total')
    set(state, chatId, 'action', 'none')
    set(fullUrlOf, shortUrlSanitized, url)
    set(linksOf, chatId, shortUrlSanitized, url)
    send(chatId, `Your shortened URL is: ${shortUrl}`, trans('o'))
    return
  }
  //
  //
  if (message === user.buyDomainName) {
    return goto['choose-domain-to-buy']()
  }
  if (action === 'choose-domain-to-buy') {
    if (message === t.back) return goto.submenu2()
    let domain = message.toLowerCase()
    domain = domain.replace('https://', '')
    domain = domain.replace('http://', '')

    const domainRegex = /^(?:(?!-)[A-Za-z0-9-]{1,63}(?<!-)\.)+[A-Za-z]{2,6}$/
    if (!domainRegex.test(domain))
      return send(chatId, t.domainInvalid)
    send(chatId, `🔍 Searching availability for ${domain} ...`)
    const { available, price, originalPrice, registrar, message: msg } = await domainService.checkDomainPrice(domain, db)
    if (!available) {
      // Suggest alternative TLDs
      const baseName = domain.split('.')[0]
      send(chatId, `❌ <b>${domain}</b> is not available.`)
      send(chatId, `🔍 Searching alternatives for <b>${baseName}</b> ...`)
      const alts = await domainService.checkAlternativeTLDs(baseName, db)
      if (alts.length > 0) {
        const altList = alts.map(a => `  <b>${a.domain}</b> — $${a.price}`).join('\n')
        send(chatId, `✅ Available alternatives:\n\n${altList}\n\nType any domain name to check:`)
      } else {
        send(chatId, `No alternatives found. Try a different name:`)
      }
      return
    }
    if (!originalPrice) {
      send(TELEGRAM_DEV_CHAT_ID, t.issueGettingPrice)
      return send(chatId, t.issueGettingPrice)
    }
    await saveInfo('price', price)
    await saveInfo('domain', domain)
    await saveInfo('originalPrice', originalPrice)
    await saveInfo('registrar', registrar)
    return goto.askDomainToUseWithShortener()
  }
  if (action === a.askDomainToUseWithShortener) {
    const yesNo = trans('yesNo')
    if (message === t.back) return goto['choose-domain-to-buy']()
    if (!yesNo.includes(message)) return send(chatId, t.what)
    saveInfo('askDomainToUseWithShortener', message === yesNo[0])

    // Yes = shortener: skip NS selection, use provider_default for reliable Railway CNAME linking
    if (message === yesNo[0]) {
      saveInfo('nsChoice', 'provider_default')

      if ((info?.domain?.endsWith('.sbs') || info?.domain?.endsWith('.xyz')) && (await isSubscribed(chatId))) {
        const available = (await get(freeDomainNamesAvailableFor, chatId)) || 0
        if (available > 0) return goto['get-free-domain']()
      }

      return goto['domain-pay']()
    }

    // No = no shortener: show NS selection
    return goto.domainNsSelect()
  }
  if (action === a.domainNsSelect) {
    if (message === t.back) return goto.askDomainToUseWithShortener()
    if (message === configUser.nsProviderDefault) {
      saveInfo('nsChoice', 'provider_default')
    } else if (message === configUser.nsCloudflare) {
      saveInfo('nsChoice', 'cloudflare')
    } else if (message === configUser.nsCustom) {
      return goto.domainCustomNsEntry()
    } else {
      return send(chatId, t.what)
    }

    if ((info?.domain?.endsWith('.sbs') || info?.domain?.endsWith('.xyz')) && (await isSubscribed(chatId))) {
      const available = (await get(freeDomainNamesAvailableFor, chatId)) || 0
      if (available > 0) return goto['get-free-domain']()
    }

    return goto['domain-pay']()
  }
  if (action === a.domainCustomNsEntry) {
    if (message === t.back) return goto.domainNsSelect()
    const nsParts = message.trim().split(/\s+/)
    if (nsParts.length < 2) {
      return send(chatId, t.provide2Nameservers)
    }
    // Basic validation
    const nsRegex = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    for (const ns of nsParts) {
      if (!nsRegex.test(ns)) {
        return send(chatId, `Invalid nameserver: <code>${ns}</code>\nPlease enter valid nameserver hostnames.`)
      }
    }
    saveInfo('nsChoice', 'custom')
    saveInfo('customNS', nsParts)

    if ((info?.domain?.endsWith('.sbs') || info?.domain?.endsWith('.xyz')) && (await isSubscribed(chatId))) {
      const available = (await get(freeDomainNamesAvailableFor, chatId)) || 0
      if (available > 0) return goto['get-free-domain']()
    }

    return goto['domain-pay']()
  }
  if (action === a.askCoupon + 'choose-domain-to-buy') {
    if (message === t.back) return goto['domain-pay']()
    if (message === t.skip) return goto.skipCoupon('domain-pay')

    const { price } = info

    const coupon = message.toUpperCase()
    const couponResult = await resolveCoupon(coupon, chatId)
    if (!couponResult) return send(chatId, t.couponInvalid)
    if (couponResult.error === 'already_used') return send(chatId, '⚠️ You have already used this coupon today.')

    const newPrice = price - (price * couponResult.discount) / 100
    await saveInfo('newPrice', newPrice)
    await saveInfo('couponApplied', true)
    if (couponResult.type === 'daily') await dailyCouponSystem.markCouponUsed(couponResult.code, chatId)

    return goto['domain-pay']()
  }

  // Coupon for domain
  if (action === a.askCoupon + 'choose-hosting-to-buy') {
    if (message === t.back) return goto.proceedWithEmail(info.website_name, info.price)
    if (message === t.skip) return goto.skipCoupon('hosting-pay')

    const { totalPrice } = info

    const coupon = message.toUpperCase()
    const couponResult = await resolveCoupon(coupon, chatId)
    if (!couponResult) return send(chatId, t.couponInvalid)
    if (couponResult.error === 'already_used') return send(chatId, '⚠️ You have already used this coupon today.')

    const couponDiscount = (totalPrice * couponResult.discount) / 100;
    const newPrice = totalPrice - couponDiscount;

    await saveInfo('couponApplied', true)
    await saveInfo('couponDiscount', couponDiscount)
    await saveInfo('newPrice', newPrice)
    if (couponResult.type === 'daily') await dailyCouponSystem.markCouponUsed(couponResult.code, chatId)

    return goto['hosting-pay']()
  }
  if (action === 'domain-pay') {
    if (message === t.back) {
      // Go back to NS selection if shortener=No, otherwise to shortener question
      if (info?.askDomainToUseWithShortener === false) return goto.domainNsSelect()
      return goto.askDomainToUseWithShortener()
    }

    // Handle coupon inline
    if (message === '🎟️ Apply Coupon') {
      return goto.askCoupon('choose-domain-to-buy')
    }

    const payOption = message

    if (payOption === payIn.crypto) {
      set(state, chatId, 'action', 'crypto-pay-domain')
      return send(chatId, t.selectCryptoToDeposit, trans('k.of', trans('supportedCryptoViewOf')))
    }

    if (payOption === payIn.bank) {
      set(state, chatId, 'action', 'bank-pay-domain')
      return send(chatId, t.askEmail, bc)
    }

    if (payOption === payIn.wallet) {
      set(state, chatId, 'lastStep', 'domain-pay')
      return goto.walletSelectCurrency()
    }

    return send(chatId, t.askValidPayOption)
  }
  if (action === 'bank-pay-domain') {
    if (message === t.back) return goto['domain-pay']()
    const email = message
    const price = info?.price
    const domain = info?.domain
    if (!isValidEmail(email)) return send(chatId, t.askValidEmail)

    const ref = nanoid()

    log({ ref })
    set(state, chatId, 'action', 'none')
    const priceNGN = Number(await usdToNgn(price))
    set(chatIdOfPayment, ref, { chatId, price, domain, endpoint: `/bank-pay-domain` })
    const { url, error } = await createCheckout(priceNGN, `/ok?a=b&ref=${ref}&`, email, username, ref)
    if (error) return send(chatId, error, trans('o'))
    send(chatId, `Bank ₦aira + Card 🌐︎`, trans('o'))
    console.log('showDepositNgnInfo', url)
    return send(chatId, t.bankPayDomain(priceNGN, domain), trans('payBank', url))
  }
  if (action === 'crypto-pay-domain') {
    if (message === t.back) return goto['domain-pay']()
      const tickerView = message
      const supportedCryptoView = trans('supportedCryptoView')
      const ticker = supportedCryptoView[tickerView]
      if (!ticker) return send(chatId, t.askValidCrypto)
      const price = info?.couponApplied ? info?.newPrice : info?.price
      const domain = info?.domain
      const ref = nanoid()
      if (BLOCKBEE_CRYTPO_PAYMENT_ON === 'true') {
        const coin = tickerOf[ticker]
        const { address, bb } = await getCryptoDepositAddress(coin, chatId, SELF_URL, `/crypto-pay-domain?a=b&ref=${ref}&`)
        if (!address) return send(chatId, t.errorFetchingCryptoAddress, trans('o'))
        set(chatIdOfPayment, ref, { chatId, price, domain })
        saveInfo('ref', ref)
        log({ ref })
        await sendQrCode(bot, chatId, bb, info?.userLanguage ?? 'en')
        set(state, chatId, 'action', 'none')
        const priceCrypto = await convert(price, 'usd', coin)
        return send(chatId, t.showDepositCryptoInfoDomain(priceCrypto, ticker, address, domain), trans('o'))
      } else {
        const coin = tickerOfDyno[ticker]
        const redirect_url = `${SELF_URL}/dynopay/crypto-pay-domain`
        const meta_data = {
          "product_name": dynopayActions.payDomain,
          "refId" : ref
        }
        const { qr_code, address } = await getDynopayCryptoAddress(price, coin, redirect_url, meta_data)
        if (!address) return send(chatId, t.errorFetchingCryptoAddress, trans('o'))
        set(chatIdOfDynopayPayment, ref, { chatId, price, domain, action: dynopayActions.payDomain, address })
        saveInfo('ref', ref)
        log({ ref })
        await generateQr(bot, chatId, qr_code, info?.userLanguage ?? 'en')
        set(state, chatId, 'action', 'none')
        const priceCrypto = await convert(price, 'usd',  tickerOf[ticker])
        return send(chatId, t.showDepositCryptoInfoDomain(priceCrypto, ticker, address, domain), trans('o'))
      }
  }

  // Hosting payment
  if (action === 'hosting-pay') {
    if (message === t.back || message === t.backButton || message === '⬅️ Back') return goto.proceedWithEmail()
    
    // Handle Apply Coupon button
    if (message === '🎟️ Apply Coupon') {
      set(state, chatId, 'action', 'hosting-apply-coupon')
      return send(chatId, 'Enter coupon code:', k.of([t.skip]))
    }
    
    const payOption = message

    if (payOption === payIn.crypto) {
      set(state, chatId, 'action', 'crypto-pay-hosting')
      return send(chatId, t.selectCryptoToDeposit, trans('k.of', trans('supportedCryptoViewOf')))
    }

    if (payOption === payIn.bank) {
      set(state, chatId, 'action', 'bank-pay-hosting')
      return send(chatId, t.askEmail, bc)
    }

    if (payOption === payIn.wallet) {
      set(state, chatId, 'lastStep', 'hosting-pay')
      return goto.walletSelectCurrency(true)
    }

    return send(chatId, t.askValidPayOption)
  }
  if (action === 'hosting-apply-coupon') {
    if (message === t.skip || message === t.back) return goto['hosting-pay']()
    const couponResult = await resolveCoupon(message, chatId)
    if (!couponResult) return send(chatId, 'Invalid coupon. Try again or tap Skip.', k.of([t.skip]))
    if (couponResult.error === 'already_used') return send(chatId, 'Coupon already used. Try another or tap Skip.', k.of([t.skip]))
    const discount = couponResult.discount
    saveInfo('couponApplied', true)
    saveInfo('couponDiscount', discount)
    saveInfo('newPrice', info.totalPrice - discount)
    if (couponResult.type === 'daily') await dailyCouponSystem.markCouponUsed(couponResult.code, chatId)
    return goto['hosting-pay']()
  }
  if (action === 'bank-pay-hosting') {
    if (message === t.back) return goto['hosting-pay']()
    const email = message
    const price = info?.totalPrice
    const domain = info?.domain
    if (!isValidEmail(email)) return send(chatId, t.askValidEmail)

    const ref = nanoid()

    log({ ref })
    set(state, chatId, 'action', a.proceedWithPaymentProcess)
    const priceNGN = Number(await usdToNgn(price))
    set(chatIdOfPayment, ref, { chatId, price, domain, endpoint: `/bank-pay-hosting` })
    const { url, error } = await createCheckout(priceNGN, `/ok?a=b&ref=${ref}&`, email, username, ref)
    if (error) return send(chatId, error, trans('o'))
    send(chatId, `Bank ₦aira + Card 🌐︎`, trans('o'))
    console.log('showDepositNgnInfo', url)
    return send(chatId, hP.bankPayDomain(priceNGN, info.plan), trans('payBank', url), k.of([t.iHaveSentThePayment]))
  }
  if (action === 'crypto-pay-hosting') {
    if (message === t.back) return goto['hosting-pay']()
    const tickerView = message
    const supportedCryptoView = trans('supportedCryptoView')
    const ticker = supportedCryptoView[tickerView]
    if (!ticker) return send(chatId, t.askValidCrypto)
    const price = info?.couponApplied ? info?.newPrice : info?.totalPrice
    const domain = info?.domain
    const plan = info?.plan
    const ref = nanoid()
    if (BLOCKBEE_CRYTPO_PAYMENT_ON === 'true') {
      const coin = tickerOf[ticker]
      const { address, bb } = await getCryptoDepositAddress(coin, chatId, SELF_URL, `/crypto-pay-hosting?a=b&ref=${ref}&`)
      if (!address) return send(chatId, t.errorFetchingCryptoAddress, trans('o'))
      set(chatIdOfPayment, ref, { chatId, price, domain })
      log({ ref })
      await sendQrCode(bot, chatId, bb, info?.userLanguage ?? 'en')
      set(state, chatId, 'action', a.proceedWithPaymentProcess)
      const priceCrypto = await convert(price, 'usd', coin)
      return send(chatId, hP.showCryptoPaymentInfo(priceCrypto, ticker, address, plan), k.of([t.iHaveSentThePayment]))
    } else {
      const coin = tickerOfDyno[ticker]
      if (!coin) return send(chatId, t.askValidCrypto)
      const redirect_url = `${SELF_URL}/dynopay/crypto-pay-hosting`
      const meta_data = {
        "product_name": dynopayActions.payHosting,
        "refId" : ref
      }
      const { qr_code, address } = await getDynopayCryptoAddress(price, coin, redirect_url, meta_data)
      if (!address) return send(chatId, t.errorFetchingCryptoAddress, trans('o'))
      set(chatIdOfDynopayPayment, ref, { chatId, price, domain, action: dynopayActions.payHosting, address })
      log({ ref })
      await generateQr(bot, chatId, qr_code, info?.userLanguage ?? 'en')
      set(state, chatId, 'action', a.proceedWithPaymentProcess)
      const priceCrypto = await convert(price, 'usd', tickerOf[ticker])
      return send(chatId, hP.showCryptoPaymentInfo(priceCrypto, ticker, address, plan), k.of([t.iHaveSentThePayment]))
    }
  }
  if (action === 'get-free-domain') {
    if (message === t.back || message === t.no) return goto['choose-domain-to-buy']()
    if (message !== t.yes) return send(chatId, t.what)

    const domain = info?.domain
    const lang = info?.userLanguage ?? 'en'
    const error = await buyDomainFullProcess(chatId, lang, domain)
    if (!error) decrement(freeDomainNamesAvailableFor, chatId)

    return set(state, chatId, 'action', 'none')
  }
  //
  //

  // VPS Payments
  if (action === 'vps-plan-pay') {
    if (message === t.back) return goto.vpsAskPaymentConfirmation()
    const payOption = message

    if (payOption === payIn.crypto) {
      set(state, chatId, 'action', 'crypto-pay-vps')
      return send(chatId, t.selectCryptoToDeposit, trans('k.of', trans('supportedCryptoViewOf')))
    }

    if (payOption === payIn.bank) {
      set(state, chatId, 'action', 'bank-pay-vps')
      return send(chatId, t.askEmail, bc)
    }

    if (payOption === payIn.wallet) {
      set(state, chatId, 'lastStep', 'vps-plan-pay')
      return goto.walletSelectCurrency(true)
    }

    return send(chatId, t.askValidPayOption)
  }

  if (action === 'bank-pay-vps') {
    if (message === t.back) return goto['vps-plan-pay']()
    const email = message
    const vpsDetails = info?.vpsDetails
    const price = vpsDetails.plan === 'Hourly' && vpsDetails.totalPrice < VPS_HOURLY_PLAN_MINIMUM_AMOUNT_PAYABLE ? VPS_HOURLY_PLAN_MINIMUM_AMOUNT_PAYABLE || 50 : vpsDetails?.totalPrice
    if (!isValidEmail(email)) return send(chatId, t.askValidEmail)

    const ref = nanoid()

    log({ ref })
    set(state, chatId, 'action', 'none')
    const priceNGN = Number(await usdToNgn(price))
    set(chatIdOfPayment, ref, { chatId, price, vpsDetails, endpoint: `/bank-pay-vps` })
    const { url, error } = await createCheckout(priceNGN, `/ok?a=b&ref=${ref}&`, email, username, ref)
    if (error) return send(chatId, error, trans('o'))
    send(chatId, `Bank ₦aira + Card 🌐︎`, trans('o'))
    console.log('showDepositNgnInfo', url)
    return send(chatId, vp.bankPayVPS(priceNGN, vpsDetails.plan), trans('payBank', url))
  }
  if (action === 'crypto-pay-vps') {
    if (message === t.back) return goto['vps-plan-pay']()
    const tickerView = message
    const supportedCryptoView = trans('supportedCryptoView')
    const ticker = supportedCryptoView[tickerView]
    if (!ticker) return send(chatId, t.askValidCrypto)
    const vpsDetails = info.vpsDetails
    const price = vpsDetails.plan === 'Hourly' && vpsDetails.totalPrice < VPS_HOURLY_PLAN_MINIMUM_AMOUNT_PAYABLE  ? VPS_HOURLY_PLAN_MINIMUM_AMOUNT_PAYABLE || 50 : vpsDetails?.totalPrice
    const ref = nanoid()
    if (BLOCKBEE_CRYTPO_PAYMENT_ON === 'true') {
      const coin = tickerOf[ticker]
      set(chatIdOfPayment, ref, { chatId, price, vpsDetails })
      const { address, bb } = await getCryptoDepositAddress(coin, chatId, SELF_URL, `/crypto-pay-vps?a=b&ref=${ref}&`)
      if (!address) return send(chatId, t.errorFetchingCryptoAddress, trans('o'))
      log({ ref })
      await sendQrCode(bot, chatId, bb, info?.userLanguage ?? 'en')
      set(state, chatId, 'action', 'none')
      const priceCrypto = await convert(price, 'usd', coin)
      return send(chatId, vp.showDepositCryptoInfoVps(priceCrypto, ticker, address, vpsDetails), trans('o'))
    } else {
      const coin = tickerOfDyno[ticker]
      const redirect_url = `${SELF_URL}/dynopay/crypto-pay-vps`
      const meta_data = {
        "product_name": dynopayActions.payVps,
        "refId" : ref
      }
      const { qr_code, address } = await getDynopayCryptoAddress(price, coin, redirect_url, meta_data)
      if (!address) return send(chatId, t.errorFetchingCryptoAddress, trans('o'))
      set(chatIdOfDynopayPayment, ref, { chatId, price, vpsDetails, action: dynopayActions.payVps, address })
      log({ ref })
      await generateQr(bot, chatId, qr_code, info?.userLanguage ?? 'en')
      set(state, chatId, 'action', 'none')
      const priceCrypto = await convert(price, 'usd', tickerOf[ticker])
      return send(chatId, vp.showDepositCryptoInfoVps(priceCrypto, ticker, address, vpsDetails), trans('o'))
    }
  }
  //

  //upgrade Plan payments
  if (action === 'vps-upgrade-plan-pay') {
    if (message === t.back) return info.vpsDetails.upgradeType === 'vps-renew' || info.vpsDetails.upgradeType === 'vps-cPanel-renew' ? goto.confirmVPSRenewDetails()
      : goto.askVpsUpgradePayment()
    const payOption = message

    if (payOption === payIn.crypto) {
      set(state, chatId, 'action', 'crypto-pay-vps-upgrade')
      return send(chatId, t.selectCryptoToDeposit, trans('k.of', trans('supportedCryptoViewOf')))
    }

    if (payOption === payIn.bank) {
      set(state, chatId, 'action', 'bank-pay-vps-upgrade')
      return send(chatId, t.askEmail, bc)
    }

    if (payOption === payIn.wallet) {
      set(state, chatId, 'lastStep', 'vps-upgrade-plan-pay')
      return goto.walletSelectCurrency(true)
    }

    return send(chatId, t.askValidPayOption)
  }

  if (action === 'bank-pay-vps-upgrade') {
    if (message === t.back) return goto['vps-upgrade-plan-pay']()
    const email = message
    const vpsDetails = info?.vpsDetails
    const price = vpsDetails?.billingCycle === 'Hourly' && vpsDetails.totalPrice < VPS_HOURLY_PLAN_MINIMUM_AMOUNT_PAYABLE ? VPS_HOURLY_PLAN_MINIMUM_AMOUNT_PAYABLE || 50 : vpsDetails?.totalPrice
    if (!isValidEmail(email)) return send(chatId, t.askValidEmail)

    const ref = nanoid()

    log({ ref })
    set(state, chatId, 'action', 'none')
    const priceNGN = Number(await usdToNgn(price))
    set(chatIdOfPayment, ref, { chatId, price, vpsDetails, endpoint: `/bank-pay-upgrade-vps` })
    const { url, error } = await createCheckout(priceNGN, `/ok?a=b&ref=${ref}&`, email, username, ref)
    if (error) return send(chatId, error, trans('o'))
    send(chatId, `Bank ₦aira + Card 🌐︎`, trans('o'))
    console.log('showDepositNgnInfo', url)
    if (vpsDetails.upgradeType === 'plan') {
      return send(chatId, vp.bankPayVPSUpgradePlan(priceNGN, vpsDetails), trans('payBank', url))
    } else if (vpsDetails.upgradeType === 'disk') {
      return send(chatId, vp.bankPayVPSUpgradeDisk(priceNGN, vpsDetails), trans('payBank', url))
    } else if (vpsDetails.upgradeType === 'vps-renew') {
      return send(chatId, vp.bankPayVPSRenewPlan(priceNGN, vpsDetails), trans('payBank', url))
    } else if (vpsDetails.upgradeType === 'vps-cPanel-renew') {
      return send(chatId, vp.bankPayVPSRenewCpanel(priceNGN, vpsDetails), trans('payBank', url))
    }
  }

  if (action === 'crypto-pay-vps-upgrade') {
    if (message === t.back) return goto['vps-upgrade-plan-pay']()
    const tickerView = message
    const supportedCryptoView = trans('supportedCryptoView')
    const ticker = supportedCryptoView[tickerView]
    if (!ticker) return send(chatId, t.askValidCrypto)
    const vpsDetails = info.vpsDetails
    const price = vpsDetails?.billingCycle === 'Hourly' && vpsDetails.totalPrice < VPS_HOURLY_PLAN_MINIMUM_AMOUNT_PAYABLE  ? VPS_HOURLY_PLAN_MINIMUM_AMOUNT_PAYABLE || 50 : vpsDetails?.totalPrice
    const ref = nanoid()
    if (BLOCKBEE_CRYTPO_PAYMENT_ON === 'true') {
      const coin = tickerOf[ticker]
      set(chatIdOfPayment, ref, { chatId, price, vpsDetails })
      const { address, bb } = await getCryptoDepositAddress(coin, chatId, SELF_URL, `/crypto-pay-upgrade-vps?a=b&ref=${ref}&`)
      if (!address) return send(chatId, t.errorFetchingCryptoAddress, trans('o'))
      log({ ref })
      await sendQrCode(bot, chatId, bb, info?.userLanguage ?? 'en')
      set(state, chatId, 'action', 'none')
      const priceCrypto = await convert(price, 'usd', coin)
      return send(chatId, vp.showDepositCryptoInfoVpsUpgrade(priceCrypto, ticker, address), trans('o'))
    } else {
      const coin = tickerOfDyno[ticker]
      const redirect_url = `${SELF_URL}/dynopay/crypto-pay-upgrade-vps`
      const meta_data = {
        "product_name": dynopayActions.payVps,
        "refId" : ref
      }
      const { qr_code, address } = await getDynopayCryptoAddress(price, coin, redirect_url, meta_data)
      if (!address) return send(chatId, t.errorFetchingCryptoAddress, trans('o'))
      set(chatIdOfDynopayPayment, ref, { chatId, price, vpsDetails, action: dynopayActions.payVps, address })
      log({ ref })
      await generateQr(bot, chatId, qr_code, info?.userLanguage ?? 'en')
      set(state, chatId, 'action', 'none')
      const priceCrypto = await convert(price, 'usd', tickerOf[ticker])
      return send(chatId, vp.showDepositCryptoInfoVpsUpgrade(priceCrypto, ticker, address), trans('o'))
    }
  }
  //
  if (message === user.buyPlan) {
    return goto['choose-subscription']()
  }
  if (action === 'choose-subscription') {
    const planOptionsOf = trans('planOptionsOf')
    const planOptions = trans('planOptions')
    if (!planOptions.includes(message)) return send(chatId, t.chooseValidPlan, trans('chooseSubscription'))
    const plan = planOptionsOf[message]
    await saveInfo('plan', plan)
    await saveInfo('price', priceOf[plan])
    return goto.askCoupon('choose-subscription')
  }
  if (action === a.askCoupon + 'choose-subscription') {
    if (message === t.back) return goto['choose-subscription']()
    const price = priceOf[info?.plan]
    saveInfo('price', price)
    if (message === t.skip) return (await saveInfo('couponApplied', false)) || goto['plan-pay']()

    const coupon = message.toUpperCase()
    const couponResult = await resolveCoupon(coupon, chatId)
    if (!couponResult) return send(chatId, t.couponInvalid)
    if (couponResult.error === 'already_used') return send(chatId, '⚠️ You have already used this coupon today.')

    const newPrice = price - (price * couponResult.discount) / 100
    await saveInfo('newPrice', newPrice)
    await saveInfo('couponApplied', true)
    if (couponResult.type === 'daily') await dailyCouponSystem.markCouponUsed(couponResult.code, chatId)

    return goto['plan-pay']()
  }
  if (action === 'plan-pay') {
    if (message === t.back) return goto.askCoupon('choose-subscription')
    const payOption = message
    if (payOption === payIn.crypto) {
      set(state, chatId, 'action', 'crypto-pay-plan')
      return send(chatId, t.selectCryptoToDeposit, trans('k.of', trans('supportedCryptoViewOf')))
    }
    if (payOption === payIn.bank) {
      set(state, chatId, 'action', 'bank-pay-plan')
      return send(chatId, t.askEmail, bc)
    }
    if (payOption === payIn.wallet) {
      set(state, chatId, 'lastStep', 'plan-pay')
      return goto.walletSelectCurrency()
    }
    return send(chatId, t.askValidPayOption)
  }
  if (action === 'bank-pay-plan') {
    if (message === t.back) return goto['plan-pay']()

    const email = message
    if (!isValidEmail(email)) return send(chatId, t.askValidEmail)

    const { plan } = info
    const price = info?.couponApplied ? info?.newPrice : info?.price
    const priceNGN = Number(await usdToNgn(price))

    const ref = nanoid()
    set(state, chatId, 'action', 'none')
    set(chatIdOfPayment, ref, { chatId, price, plan, endpoint: `/bank-pay-plan` })
    const { url, error } = await createCheckout(priceNGN, `/ok?a=b&ref=${ref}&`, email, username, ref)

    log({ ref })
    if (error) return send(chatId, error, trans('o'))
    send(chatId, `Bank ₦aira + Card 🌐︎`, trans('o'))
    console.log('showDepositNgnInfo', url)
    return send(chatId, t['bank-pay-plan'](priceNGN, plan), trans('payBank', url))
  }
  if (action === 'crypto-pay-plan') {
    if (message === t.back) return goto['plan-pay']()

    const ref = nanoid()
    const tickerView = message
    const supportedCryptoView = trans('supportedCryptoView')
    const ticker = supportedCryptoView[tickerView]
    if (!ticker) return send(chatId, t.askValidCrypto)
    const { plan } = info
    const price = info?.couponApplied ? info?.newPrice : info?.price 
    if (BLOCKBEE_CRYTPO_PAYMENT_ON === 'true') {
      const coin = tickerOf[ticker]
      const { address, bb } = await getCryptoDepositAddress(coin, chatId, SELF_URL, `/crypto-pay-plan?a=b&ref=${ref}&`)
      if (!address) return send(chatId, t.errorFetchingCryptoAddress, trans('o'))
      set(chatIdOfPayment, ref, { chatId, price, plan })
      log({ ref })
      await sendQrCode(bot, chatId, bb, info?.userLanguage ?? 'en')
      set(state, chatId, 'action', 'none')
      const priceCrypto = await convert(price, 'usd', coin)
      return send(chatId, t.showDepositCryptoInfoPlan(priceCrypto, ticker, address, plan), trans('o'))
    } else {
      const coin = tickerOfDyno[ticker]
      if (!coin) return send(chatId, t.askValidCrypto)
      const redirect_url = `${SELF_URL}/dynopay/crypto-pay-plan`
      const meta_data = {
        "product_name": dynopayActions.payPlan,
        "refId" : ref
      }
      const { qr_code, address } = await getDynopayCryptoAddress(price, coin, redirect_url, meta_data)
      if (!address) return send(chatId, t.errorFetchingCryptoAddress, trans('o'))
      set(chatIdOfDynopayPayment, ref, { chatId, price, plan, action: dynopayActions.payPlan, address })
      log({ ref })
      await generateQr(bot, chatId, qr_code, info?.userLanguage ?? 'en')
      const priceCrypto = await convert(price, 'usd', tickerOf[ticker])
      return send(chatId, t.showDepositCryptoInfoPlan(priceCrypto, ticker, address, plan), trans('o'))
    }
  }
  //
  //
  if (message === user.dnsManagement && action !== 'view-domain-actions') {
    if (!(await ownsDomainName(chatId))) {
      send(chatId, t.noDomainFound, k.of([[user.buyDomainName], [t.back]]))
      return
    }

    return goto['choose-domain-to-manage']()
  }
  if (action === 'choose-domain-to-manage') {
    if (message === t.back) return goto.submenu2()
    const domain = message.toLowerCase()

    const domains = await getPurchasedDomains(chatId)
    if (!domains.includes(domain)) {
      return send(chatId, t.chooseValidDomain)
    }

    await set(state, chatId, 'domainToManage', domain)
    info = await get(state, chatId)

    return goto['choose-dns-action']()
  }
  if (action === 'choose-dns-action') {
    if (message === t.back || message === t.backButton || message === '⬅️ Back') return goto['choose-domain-to-manage']()

    if (![t.addDns, t.updateDns, t.deleteDns, t.activateShortener, t.deactivateShortener, t.quickActions, t.checkDns, t.switchToCf].includes(message)) return send(chatId, t.selectValidOption)

    if (message === t.switchToCf) {
      const domain = info?.domainToManage
      const nsType = info?.nameserverType
      if (nsType === 'cloudflare') {
        return send(chatId, t.switchToCfAlreadyCf || 'Already using Cloudflare.')
      }
      send(chatId, t.switchToCfConfirm(domain), trans('yes_no'))
      set(state, chatId, 'action', 'confirm-switch-to-cloudflare')
      return
    }

    if (message === t.quickActions) return goto['dns-quick-action-menu']()

    if (message === t.checkDns) {
      const domain = info?.domainToManage
      if (!domain) return send(chatId, t.selectValidOption)
      send(chatId, t.dnsChecking(domain), { parse_mode: 'HTML' })
      try {
        const result = await dnsChecker.healthCheck(domain)
        let msg = t.dnsHealthTitle(domain)
        for (const type of ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS']) {
          const r = result.results[type]
          msg += t.dnsHealthRow(type, r.found, r.count, r.answers) + '\n'
        }
        msg += t.dnsHealthSummary(result.resolving, result.total)
        return send(chatId, msg, { parse_mode: 'HTML' })
      } catch (e) {
        return send(chatId, t.dnsCheckError)
      }
    }

    if (message === t.activateShortener) {
      const domain = info?.domainToManage
      if (!domain) return send(chatId, t.noDomainSelected)
      send(chatId, `🔗 Activating shortener for <b>${domain}</b>…`, { parse_mode: 'HTML' })
      
      try {
        const { server, error, recordType } =
          process.env.HOSTED_ON === 'render'
            ? await saveDomainInServerRender(domain)
            : await saveDomainInServerRailway(domain)

        if (error) {
          return send(chatId, `❌ Could not link <b>${domain}</b>: ${error}`, { parse_mode: 'HTML' })
        }

        send(chatId, `⏳ Configuring DNS for <b>${domain}</b>…`, { parse_mode: 'HTML' })

        const dnsResult = await domainService.viewDNSRecords(domain, db)
        const source = dnsResult?.source || 'connectreseller'

        if (source === 'openprovider') {
          await sleep(10000)
          const addResult = await domainService.addDNSRecord(domain, recordType, server, '', db)
          if (addResult.error || !addResult.success) {
            return send(chatId, `❌ DNS error for <b>${domain}</b>: ${addResult.error || 'Unknown error'}`, { parse_mode: 'HTML' })
          }
        } else {
          await sleep(65000)
          const { error: saveErr } = await saveServerInDomain(domain, server, recordType)
          if (saveErr) {
            return send(chatId, `❌ DNS error for <b>${domain}</b>: ${saveErr}`, { parse_mode: 'HTML' })
          }
        }

        send(chatId, `✅ <b>${domain}</b> linked to URL shortener. DNS may take up to 24h to propagate.`, { parse_mode: 'HTML' })
        const lang = info?.userLanguage || 'en'
        regularCheckDns(bot, chatId, domain, lang)
      } catch (e) {
        log(`[ActivateShortener] Error for ${domain}: ${e.message}`)
        send(chatId, `❌ Error: ${e.message}`, { parse_mode: 'HTML' })
      }
      return
    }

    if (message === t.deactivateShortener) {
      const domain = info?.domainToManage
      if (!domain) return send(chatId, t.noDomainSelected)
      send(chatId, `🔗 Deactivating shortener for <b>${domain}</b>…`, { parse_mode: 'HTML' })

      try {
        // 1. Remove domain from Railway
        const { removeDomainFromRailway } = require('./rl-save-domain-in-server.js')
        const removeResult = await removeDomainFromRailway(domain)
        if (removeResult?.error) {
          log(`[DeactivateShortener] Railway removal warning for ${domain}: ${removeResult.error}`)
        }

        // 2. Find and delete the CNAME record pointing to railway
        const dnsResult = await domainService.viewDNSRecords(domain, db)
        const records = dnsResult?.records || []
        const railwayCname = records.find(r =>
          r.recordType === 'CNAME' && r.recordContent && r.recordContent.includes('.up.railway.app')
        )

        if (railwayCname) {
          const deleteResult = await domainService.deleteDNSRecord(domain, railwayCname, db)
          if (deleteResult?.error) {
            log(`[DeactivateShortener] DNS delete warning for ${domain}: ${deleteResult.error}`)
          }
        }

        send(chatId, `✅ Shortener deactivated for <b>${domain}</b>.`, { parse_mode: 'HTML' })
        return goto['choose-dns-action']()
      } catch (e) {
        log(`[DeactivateShortener] Error for ${domain}: ${e.message}`)
        send(chatId, `❌ Could not deactivate shortener. Please try again or contact support.`, { parse_mode: 'HTML' })
      }
      return
    }

    if (message === t.deleteDns) return goto['select-dns-record-id-to-delete']()

    if (message === t.updateDns) return goto['select-dns-record-id-to-update']()

    if (message === t.addDns) return goto['select-dns-record-type-to-add']()
  }
  // Switch to Cloudflare confirmation handler
  if (action === 'confirm-switch-to-cloudflare') {
    if (message === t.back || message === t.no || message === 'No') return goto['choose-dns-action']()
    if (message !== t.yes && message !== 'Yes') return send(chatId, t.what)

    const domain = info?.domainToManage
    if (!domain) return send(chatId, t.noDomainSelected)

    send(chatId, t.switchToCfProgress(domain), { parse_mode: 'HTML' })

    try {
      const result = await domainService.switchToCloudflare(domain, db)
      if (result.error) {
        send(chatId, t.switchToCfError(result.error), { parse_mode: 'HTML' })
        return goto['choose-dns-action']()
      }
      send(chatId, t.switchToCfSuccess(domain, result.nameservers), { parse_mode: 'HTML' })
    } catch (e) {
      log(`[SwitchToCF] Error for ${domain}: ${e.message}`)
      send(chatId, t.switchToCfError(e.message), { parse_mode: 'HTML' })
    }
    return goto['choose-dns-action']()
  }
  //
  if (action === 'select-dns-record-id-to-delete') {
    if (message === t.back || message === t.cancel) return goto['choose-dns-action']()

    // Parse record number from button text like "1. NS → value" or plain number
    const match = message.match(/^(\d+)/)
    const id = match ? Number(match[1]) : NaN
    if (isNaN(id) || !(id > 0 && id <= info?.dnsRecords.length)) return send(chatId, t.selectValidOption)

    set(state, chatId, 'delId', id - 1) // User See id as 1,2,3 and we see as 0,1,2
    return goto['confirm-dns-record-id-to-delete']()
  }
  if (action === 'confirm-dns-record-id-to-delete') {
    if (message === t.back || message === t.no) return goto['select-dns-record-id-to-delete']()
    if (message !== t.yes) return send(chatId, t.what)

    const { domainNameId, dnsRecords, domainToManage, delId, dnsSource } = info
    if(!!dnsRecords && !!dnsRecords?.[delId]) {
      const record = dnsRecords[delId]

      // NS records can NEVER be deleted — only updated
      if (record.recordType === 'NS') {
        return send(chatId, `Nameserver records cannot be deleted. Use <b>Update DNS Record</b> to change nameservers.`, { parse_mode: 'HTML' })
      }

      if (dnsSource === 'cloudflare' && record.cfRecordId) {
        const result = await domainService.deleteDNSRecord(domainToManage, record, db)
        if (!result.success) return send(chatId, t.errorDeletingDns(result.error || 'Cloudflare delete failed'))
      } else if (dnsSource === 'openprovider') {
        const result = await domainService.deleteDNSRecord(domainToManage, record, db)
        if (result.error || !result.success) return send(chatId, t.errorDeletingDns(result.error || 'Delete failed'))
      } else {
        const nsRecords = dnsRecords.filter(r => r.recordType === 'NS')
        const { dnszoneID, dnszoneRecordID, nsId } = record
        const { error } = await deleteDNSRecord(dnszoneID, dnszoneRecordID, domainToManage, domainNameId, nsId, nsRecords)
        if (error) return send(chatId, t.errorDeletingDns(error))
      }
  
      send(chatId, t.dnsRecordDeleted)
    } else {
      send(chatId, t.errorDeletingDns("NO DNS Record ID Found"))
    }
    return goto['choose-dns-action']()
  }
  if (action === 'select-dns-record-type-to-add') {
    if (message === t.back) return goto['choose-dns-action']()

    const recordType = message
    // NS records cannot be added — only updated
    if (recordType === t.ns || recordType === 'NS Record') {
      return send(chatId, `Nameserver records cannot be added. Use <b>Update DNS Record</b> to change nameservers.`, { parse_mode: 'HTML' })
    }
    // SRV has its own multi-step flow
    if (recordType === t.srvRecord) {
      const dnsSource = info?.dnsSource || ''
      if (dnsSource === 'connectreseller') return send(chatId, t.dnsSrvCaaNotSupported)
      return goto['dns-srv-service']()
    }
    // CAA has its own multi-step flow
    if (recordType === t.caaRecord) {
      const dnsSource = info?.dnsSource || ''
      if (dnsSource === 'connectreseller') return send(chatId, t.dnsSrvCaaNotSupported)
      return goto['dns-caa-hostname']()
    }
    // A, CNAME, MX, TXT, AAAA all use multi-step wizard (hostname → value → [priority])
    const wizardTypes = [t.a, t.cname, t.mx, t.txt, t.aaaa]
    if (wizardTypes.includes(recordType)) {
      const realType = t[recordType] // e.g. 'A Record' -> 'A', 'CNAME Record' -> 'CNAME'
      return goto['dns-add-hostname'](realType)
    }

    return send(chatId, t.selectValidOption)
  }
  if (action === 'type-dns-record-data-to-add') {
    if (message === t.back) return goto['select-dns-record-type-to-add']()

    const domain = info?.domainToManage
    const dnsSource = info?.dnsSource
    let recordType = info?.recordType
    let newRecordDetails = null
    if (t[recordType] !== 'NS') {
      newRecordDetails = message.split(" ")
      if (!newRecordDetails || newRecordDetails.length < 2 || newRecordDetails.length > 3) return send(chatId, t.selectValidOption)
      if (!['A', 'CNAME'].includes(newRecordDetails[0].toLocaleUpperCase()))return send(chatId, t.selectValidOption)
    }
    const recordContent = newRecordDetails ? newRecordDetails[newRecordDetails.length -1 ] : message
    const hostName = newRecordDetails && newRecordDetails.length === 3 ? newRecordDetails[1] : null
    const dnsRecords = info?.dnsRecords
    const nsRecords = dnsRecords?.filter(r => r.recordType === 'NS')
    const domainNameId = info?.domainNameId

    if (nsRecords.length >= 4 && t[recordType] === 'NS') {
      send(chatId, t.maxDnsRecord)
      return goto['choose-dns-action']()
    }

    if (dnsSource === 'cloudflare') {
      const result = await domainService.addDNSRecord(domain, t[recordType], recordContent, hostName || '', db)
      if (result.error || !result.success) {
        const m = t.errorSavingDns(result.error || 'Cloudflare add failed')
        return send(chatId, m)
      }
    } else {
      const nextId = nextNumber(nsRecords.map(r => r.nsId))
      const { error } = await saveServerInDomain(domain, recordContent, t[recordType], domainNameId, nextId, nsRecords, hostName)
      if (error) {
        const m = t.errorSavingDns(error)
        return send(chatId, m)
      }
    }

    send(chatId, t.dnsRecordSaved)
    dnsAutoCheck(send, chatId, t, domain, t[recordType], recordContent)
    return goto['choose-dns-action']()
  }
  //
  if (action === 'select-dns-record-id-to-update') {
    if (message === t.back || message === t.cancel) return goto['choose-dns-action']()

    const dnsRecords = info?.dnsRecords
    // Parse record number from button text like "1. A → 1.2.3.4" or plain number
    const match = message.match(/^(\d+)/)
    let id = match ? Number(match[1]) : NaN
    if (isNaN(id) || !(id > 0 && id <= dnsRecords.length)) {
      return send(chatId, t.selectValidOption)
    }
    id-- // User See id as 1,2,3 and we see as 0,1,2
    const record = dnsRecords[id]
    return goto['type-dns-record-data-to-update'](id, record?.recordType, record?.recordContent)
  }
  if (action === 'type-dns-record-data-to-update') {
    if (message === t.back) return goto['select-dns-record-id-to-update']()

    const dnsRecords = info?.dnsRecords
    const domainNameId = info?.domainNameId
    const domain = info?.domainToManage
    const dnsSource = info?.dnsSource
    const id = info?.dnsRecordIdToUpdate

    const { dnszoneID, dnszoneRecordID, recordType, nsId, cfRecordId, recordName } = dnsRecords[id]

    // New: accept plain value input for all record types
    const recordContent = message.trim()

    // Validate input based on record type
    if (recordType === 'A') {
      const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
      const match = recordContent.match(ipv4Regex)
      if (!match || [match[1], match[2], match[3], match[4]].some(n => Number(n) > 255)) {
        return send(chatId, t.dnsInvalidIpv4)
      }
    }
    if (recordType === 'AAAA') {
      if (!recordContent.includes(':')) {
        return send(chatId, t.dnsInvalidIpv6)
      }
    }

    if (dnsSource === 'cloudflare' && cfRecordId) {
      const result = await domainService.updateDNSRecord(domain, {
        cfRecordId,
        recordType,
        recordName: recordName || domain,
        recordValue: recordContent,
      }, db)
      if (result.error || !result.success) {
        return send(chatId, t.errorSavingDns(result.error || 'Update failed'))
      }
    } else if (recordType === 'NS') {
      // NS records: always update at the registrar level
      const nsRecords = dnsRecords.filter(r => r.recordType === 'NS')
      const nsIdx = nsRecords.findIndex(r => dnsRecords.indexOf(r) === id)
      const nsSlot = nsIdx >= 0 ? nsIdx + 1 : (nsId || 1)

      if (dnsSource === 'openprovider' || info?.nameserverType === 'cloudflare') {
        // Use domainService for OP or CF-managed OP domains
        const result = await domainService.updateNameserverAtRegistrar(domain, nsSlot, recordContent, db)
        if (result.error) return send(chatId, t.errorSavingDns(result.error))
        if (result.useDefaultCR) {
          // Fallback to CR direct
          const { error } = await updateDNSRecord(dnszoneID, dnszoneRecordID, domain, recordType, recordContent, domainNameId, nsId, nsRecords, null)
          if (error) return send(chatId, t.errorSavingDns(error))
        }
      } else {
        // ConnectReseller direct
        const { error } = await updateDNSRecord(dnszoneID, dnszoneRecordID, domain, recordType, recordContent, domainNameId, nsId, nsRecords, null)
        if (error) return send(chatId, t.errorSavingDns(error))
      }
    } else if (dnsSource === 'openprovider') {
      // Non-NS records on OP: use domainService routing
      const result = await domainService.updateDNSRecord(domain, {
        recordType,
        recordName: recordName || domain,
        recordValue: recordContent,
        recordContent: dnsRecords[id]?.recordContent,
        ttl: 300,
      }, db)
      if (result.error || !result.success) {
        return send(chatId, t.errorSavingDns(result.error || 'Update failed'))
      }
    } else {
      // ConnectReseller non-NS records
      // Extract hostname from recordName by stripping the domain suffix
      const crHostName = recordName && recordName !== domain && recordName.endsWith('.' + domain)
        ? recordName.slice(0, -(domain.length + 1))
        : null
      const { error } = await updateDNSRecord(
        dnszoneID,
        dnszoneRecordID,
        domain,
        recordType,
        recordContent,
        domainNameId,
        nsId,
        dnsRecords.filter(r => r.recordType === 'NS'),
        crHostName
      )
      if (error) {
        return send(chatId, t.errorSavingDns(error))
      }
    }

    send(chatId, t.dnsRecordUpdated)
    const checkName = recordName || domain
    dnsAutoCheck(send, chatId, t, checkName, recordType, recordContent)
    return goto['choose-dns-action']()
  }
  //
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DNS WIZARD: Quick Actions + Multi-step Add
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (action === 'dns-quick-action-menu') {
    if (message === t.back || message === t.cancel) return goto['choose-dns-action']()
    const qa = t.dnsQuickActions || {}
    if (message === qa.pointToIp) return goto['dns-quick-point-to-ip']()
    if (message === qa.googleEmail) {
      // Auto-create 5 MX + 1 SPF TXT for Google Workspace
      const domain = info?.domainToManage
      const googleMX = [
        { server: 'ASPMX.L.GOOGLE.COM', priority: 1 },
        { server: 'ALT1.ASPMX.L.GOOGLE.COM', priority: 5 },
        { server: 'ALT2.ASPMX.L.GOOGLE.COM', priority: 5 },
        { server: 'ALT3.ASPMX.L.GOOGLE.COM', priority: 10 },
        { server: 'ALT4.ASPMX.L.GOOGLE.COM', priority: 10 },
      ]
      const spfValue = 'v=spf1 include:_spf.google.com ~all'
      let step = 0
      const total = googleMX.length + 1
      for (const mx of googleMX) {
        step++
        send(chatId, t.dnsQuickSetupProgress(step, total))
        const result = await domainService.addDNSRecord(domain, 'MX', mx.server, '', db, mx.priority)
        if (!result.success) {
          return send(chatId, t.dnsQuickSetupError(`MX ${mx.server}`))
        }
      }
      step++
      send(chatId, t.dnsQuickSetupProgress(step, total))
      const txtResult = await domainService.addDNSRecord(domain, 'TXT', spfValue, '', db)
      if (!txtResult.success) {
        return send(chatId, t.dnsQuickSetupError('SPF TXT'))
      }
      send(chatId, t.dnsQuickGoogleDone(domain))
      return goto['choose-dns-action']()
    }
    if (message === qa.zohoEmail) {
      // Auto-create 3 MX + 1 SPF TXT for Zoho Mail
      const domain = info?.domainToManage
      const zohoMX = [
        { server: 'mx.zoho.com', priority: 10 },
        { server: 'mx2.zoho.com', priority: 20 },
        { server: 'mx3.zoho.com', priority: 50 },
      ]
      const spfValue = 'v=spf1 include:zoho.com ~all'
      let step = 0
      const total = zohoMX.length + 1
      for (const mx of zohoMX) {
        step++
        send(chatId, t.dnsQuickSetupProgress(step, total))
        const result = await domainService.addDNSRecord(domain, 'MX', mx.server, '', db, mx.priority)
        if (!result.success) {
          return send(chatId, t.dnsQuickSetupError(`MX ${mx.server}`))
        }
      }
      step++
      send(chatId, t.dnsQuickSetupProgress(step, total))
      const txtResult = await domainService.addDNSRecord(domain, 'TXT', spfValue, '', db)
      if (!txtResult.success) {
        return send(chatId, t.dnsQuickSetupError('SPF TXT'))
      }
      send(chatId, t.dnsQuickZohoDone(domain))
      return goto['choose-dns-action']()
    }
    if (message === qa.verification) return goto['dns-quick-verification']()
    if (message === qa.addSubdomain) return goto['dns-quick-subdomain-name']()
    return send(chatId, t.selectValidOption)
  }

  if (action === 'dns-quick-point-to-ip') {
    if (message === t.back || message === t.cancel) return goto['dns-quick-action-menu']()
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
    const match = message.match(ipv4Regex)
    if (!match || [match[1], match[2], match[3], match[4]].some(n => Number(n) > 255)) {
      return send(chatId, t.dnsInvalidIpv4)
    }
    const domain = info?.domainToManage
    const ip = message.trim()
    // Create A @ → IP
    const aResult = await domainService.addDNSRecord(domain, 'A', ip, '', db)
    if (!aResult.success) return send(chatId, t.dnsQuickSetupError('A record'))
    // Create CNAME www → domain
    const cnameResult = await domainService.addDNSRecord(domain, 'CNAME', domain, 'www', db)
    if (!cnameResult.success) return send(chatId, t.dnsQuickSetupError('CNAME www'))
    send(chatId, t.dnsQuickPointToIpDone(domain, ip))
    return goto['choose-dns-action']()
  }

  if (action === 'dns-quick-verification') {
    if (message === t.back || message === t.cancel) return goto['dns-quick-action-menu']()
    const domain = info?.domainToManage
    const txtValue = message.trim()
    const result = await domainService.addDNSRecord(domain, 'TXT', txtValue, '', db)
    if (!result.success) return send(chatId, t.dnsQuickSetupError('TXT verification'))
    send(chatId, t.dnsQuickVerificationDone)
    return goto['choose-dns-action']()
  }

  if (action === 'dns-quick-subdomain-name') {
    if (message === t.back || message === t.cancel) return goto['dns-quick-action-menu']()
    const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/
    if (!hostnameRegex.test(message.trim())) {
      return send(chatId, t.dnsInvalidHostname)
    }
    await set(state, chatId, 'dnsSubdomainName', message.trim())
    info = await get(state, chatId)
    return goto['dns-quick-subdomain-target']()
  }

  if (action === 'dns-quick-subdomain-target') {
    if (message === t.back || message === t.cancel) return goto['dns-quick-subdomain-name']()
    if (message === t.dnsQuickSubdomainIp) return goto['dns-quick-subdomain-ip']()
    if (message === t.dnsQuickSubdomainDomain) return goto['dns-quick-subdomain-domain']()
    return send(chatId, t.selectValidOption)
  }

  if (action === 'dns-quick-subdomain-ip') {
    if (message === t.back || message === t.cancel) return goto['dns-quick-subdomain-target']()
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
    const match = message.match(ipv4Regex)
    if (!match || [match[1], match[2], match[3], match[4]].some(n => Number(n) > 255)) {
      return send(chatId, t.dnsInvalidIpv4)
    }
    const domain = info?.domainToManage
    const subName = info?.dnsSubdomainName
    const result = await domainService.addDNSRecord(domain, 'A', message.trim(), subName, db)
    if (!result.success) return send(chatId, t.dnsQuickSetupError(`A ${subName}`))
    send(chatId, t.dnsQuickSubdomainDone(`${subName}.${domain}`, message.trim(), 'A'))
    return goto['choose-dns-action']()
  }

  if (action === 'dns-quick-subdomain-domain') {
    if (message === t.back || message === t.cancel) return goto['dns-quick-subdomain-target']()
    const domain = info?.domainToManage
    const subName = info?.dnsSubdomainName
    const target = message.trim()
    const result = await domainService.addDNSRecord(domain, 'CNAME', target, subName, db)
    if (!result.success) return send(chatId, t.dnsQuickSetupError(`CNAME ${subName}`))
    send(chatId, t.dnsQuickSubdomainDone(`${subName}.${domain}`, target, 'CNAME'))
    return goto['choose-dns-action']()
  }

  // DNS Wizard: Multi-step add record (MX, TXT)
  if (action === 'dns-add-hostname') {
    if (message === t.back || message === t.cancel) return goto['select-dns-record-type-to-add']()
    const recordType = info?.dnsAddRecordType
    let hostname = message.trim()
    // NS doesn't need hostname step — skip
    if (recordType === 'NS') {
      hostname = ''
    } else if (hostname !== '@') {
      // Validate hostname — allows alphanumeric, hyphens, underscores, and dots
      // Underscores are valid for DKIM (_domainkey), DMARC (_dmarc), ACME (_acme-challenge), etc.
      // Dots are valid for multi-label subdomains (neo1._domainkey, mail._domainkey)
      const hostnameRegex = /^[a-zA-Z0-9_]([a-zA-Z0-9_.:-]*[a-zA-Z0-9_])?$/
      if (!hostnameRegex.test(hostname)) {
        return send(chatId, t.dnsInvalidHostname)
      }
      // CNAME can't be @ (root)
      if (recordType === 'CNAME' && hostname === '@') {
        return send(chatId, t.dnsInvalidHostname)
      }
    }
    // Map @ to empty string for root
    const hostToStore = hostname === '@' ? '' : hostname
    await set(state, chatId, 'dnsAddHostname', hostToStore)
    info = await get(state, chatId)
    return goto['dns-add-value'](recordType)
  }

  if (action === 'dns-add-value') {
    if (message === t.back || message === t.cancel) return goto['select-dns-record-type-to-add']()
    const recordType = info?.dnsAddRecordType
    const hostname = info?.dnsAddHostname || ''
    const value = message.trim()

    // Validate based on record type
    if (recordType === 'A') {
      const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
      const match = value.match(ipv4Regex)
      if (!match || [match[1], match[2], match[3], match[4]].some(n => Number(n) > 255)) {
        return send(chatId, t.dnsInvalidIpv4)
      }
    }

    // AAAA IPv6 validation
    if (recordType === 'AAAA') {
      const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$|^::([0-9a-fA-F]{1,4}:){0,5}[0-9a-fA-F]{0,4}$|^([0-9a-fA-F]{1,4}:){1,6}:$/
      if (!ipv6Regex.test(value) && !value.includes(':')) {
        return send(chatId, t.dnsInvalidIpv6)
      }
    }

    if (recordType === 'MX') {
      // Store value, go to priority step
      await set(state, chatId, 'dnsAddValue', value)
      info = await get(state, chatId)
      return goto['dns-add-mx-priority']()
    }

    // For A, CNAME, TXT — create record immediately
    const domain = info?.domainToManage
    const result = await domainService.addDNSRecord(domain, recordType, value, hostname, db)
    if (!result.success) {
      return send(chatId, t.errorSavingDns(result.error || 'Failed'))
    }
    send(chatId, t.dnsRecordSaved)
    const checkName = hostname ? `${hostname}.${domain}` : domain
    dnsAutoCheck(send, chatId, t, checkName, recordType, value)
    return goto['choose-dns-action']()
  }

  if (action === 'dns-add-mx-priority') {
    if (message === t.back || message === t.cancel) return goto['select-dns-record-type-to-add']()
    const priority = Number(message.trim())
    if (isNaN(priority) || priority < 1 || priority > 65535) {
      return send(chatId, t.dnsInvalidMxPriority)
    }
    const domain = info?.domainToManage
    const hostname = info?.dnsAddHostname || ''
    const value = info?.dnsAddValue
    const result = await domainService.addDNSRecord(domain, 'MX', value, hostname, db, priority)
    if (!result.success) {
      return send(chatId, t.errorSavingDns(result.error || 'Failed'))
    }
    send(chatId, t.dnsRecordSaved)
    const checkName = hostname ? `${hostname}.${domain}` : domain
    dnsAutoCheck(send, chatId, t, checkName, 'MX', value)
    return goto['choose-dns-action']()
  }
  //
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Phase 2: SRV Record Wizard
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (action === 'dns-srv-service') {
    if (message === t.back || message === t.cancel) return goto['select-dns-record-type-to-add']()
    const srvInput = message.trim()
    // Parse service and protocol (e.g. _sip._tcp or _http._tcp)
    const srvMatch = srvInput.match(/^(_[a-zA-Z0-9-]+)\.(_[a-zA-Z]+)$/)
    if (!srvMatch) {
      return send(chatId, 'Invalid format. Use <b>_service._protocol</b> (e.g. _sip._tcp, _http._tcp):')
    }
    await set(state, chatId, 'dnsSrvService', srvMatch[1])
    await set(state, chatId, 'dnsSrvProto', srvMatch[2])
    info = await get(state, chatId)
    return goto['dns-srv-target']()
  }

  if (action === 'dns-srv-target') {
    if (message === t.back || message === t.cancel) return goto['dns-srv-service']()
    const target = message.trim()
    await set(state, chatId, 'dnsSrvTarget', target)
    info = await get(state, chatId)
    return goto['dns-srv-port']()
  }

  if (action === 'dns-srv-port') {
    if (message === t.back || message === t.cancel) return goto['dns-srv-target']()
    const port = Number(message.trim())
    if (isNaN(port) || port < 1 || port > 65535) {
      return send(chatId, t.dnsInvalidPort)
    }
    await set(state, chatId, 'dnsSrvPort', port)
    info = await get(state, chatId)
    return goto['dns-srv-priority']()
  }

  if (action === 'dns-srv-priority') {
    if (message === t.back || message === t.cancel) return goto['dns-srv-port']()
    const priority = Number(message.trim())
    if (isNaN(priority) || priority < 0 || priority > 65535) {
      return send(chatId, t.dnsInvalidMxPriority)
    }
    await set(state, chatId, 'dnsSrvPriority', priority)
    info = await get(state, chatId)
    return goto['dns-srv-weight']()
  }

  if (action === 'dns-srv-weight') {
    if (message === t.back || message === t.cancel) return goto['dns-srv-priority']()
    const weight = Number(message.trim())
    if (isNaN(weight) || weight < 0 || weight > 65535) {
      return send(chatId, t.dnsInvalidWeight)
    }
    const domain = info?.domainToManage
    const service = info?.dnsSrvService
    const proto = info?.dnsSrvProto
    const target = info?.dnsSrvTarget
    const port = info?.dnsSrvPort
    const priority = info?.dnsSrvPriority
    const srvName = `${service}.${proto}.${domain}`
    const extraData = { service, proto, srvName, priority, weight, port }
    const result = await domainService.addDNSRecord(domain, 'SRV', target, '', db, priority, extraData)
    if (!result.success) {
      return send(chatId, t.errorSavingDns ? t.errorSavingDns(result.error || 'Failed') : `Error: ${result.error || 'Failed'}`)
    }
    send(chatId, t.dnsRecordSaved)
    dnsAutoCheck(send, chatId, t, srvName, 'SRV', target)
    return goto['choose-dns-action']()
  }

  //
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Phase 2: CAA Record Wizard
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (action === 'dns-caa-hostname') {
    if (message === t.back || message === t.cancel) return goto['select-dns-record-type-to-add']()
    let hostname = message.trim()
    if (hostname !== '@') {
      const hostnameRegex = /^[a-zA-Z0-9_]([a-zA-Z0-9_.:-]*[a-zA-Z0-9_])?$/
      if (!hostnameRegex.test(hostname)) {
        return send(chatId, t.dnsInvalidHostname)
      }
    }
    const hostToStore = hostname === '@' ? '' : hostname
    await set(state, chatId, 'dnsCaaHostname', hostToStore)
    info = await get(state, chatId)
    return goto['dns-caa-tag']()
  }

  if (action === 'dns-caa-tag') {
    if (message === t.back || message === t.cancel) return goto['dns-caa-hostname']()
    // Accept localized tag labels and map to real tag
    const realTag = t[message]
    if (!['issue', 'issuewild', 'iodef'].includes(realTag)) {
      return send(chatId, t.selectValidOption)
    }
    await set(state, chatId, 'dnsCaaTag', realTag)
    info = await get(state, chatId)
    return goto['dns-caa-value']()
  }

  if (action === 'dns-caa-value') {
    if (message === t.back || message === t.cancel) return goto['dns-caa-tag']()
    const value = message.trim()
    const domain = info?.domainToManage
    const hostname = info?.dnsCaaHostname || ''
    const tag = info?.dnsCaaTag || 'issue'
    const extraData = { flags: 0, tag }
    const name = hostname ? `${hostname}.${domain}` : domain
    const result = await domainService.addDNSRecord(domain, 'CAA', value, hostname, db, undefined, extraData)
    if (!result.success) {
      return send(chatId, t.errorSavingDns ? t.errorSavingDns(result.error || 'Failed') : `Error: ${result.error || 'Failed'}`)
    }
    send(chatId, t.dnsRecordSaved)
    dnsAutoCheck(send, chatId, t, name, 'CAA', value)
    return goto['choose-dns-action']()
  }
  //
  //
  //
  if (message === user.wallet) {
    return goto[user.wallet]()
  }
  if (action === user.wallet) {
    if (message === u.deposit) return goto[a.selectCurrencyToDeposit]() // can be combine in one line with object
    if (message === u.withdraw) return goto.wallet() // Withdraw removed — redirect to wallet
    if (message === u.myTier || message === '🏆 My Tier') {
      const tierInfo = await loyalty.getUserTier(walletOf, chatId)
      return send(chatId, loyalty.formatTierStatus(tierInfo, info?.userLanguage || 'en'), k.of([[u.deposit], [t.back]]))
    }
    return send(chatId, t.what)
  }

  if (message === u.deposit) return goto[a.selectCurrencyToDeposit]()

  if (action === a.selectCurrencyToDeposit) {
    if (message === t.back) return goto[user.wallet]()
    if (message === u.usd) return goto[a.depositUSD]()
    if (message === u.ngn) return goto[a.depositNGN]()
    return send(chatId, t.what, trans('payOpts'))
  }

  if (action === a.depositNGN) {
    if (message === t.back) return goto[a.selectCurrencyToDeposit]()

    const amount = message
    if (isNaN(amount)) return send(chatId, t.askValidAmount)
    await saveInfo('depositAmountNgn', Number(amount))
    return goto[a.askEmailForNGN]()
  }
  if (action === a.askEmailForNGN) {
    if (message === t.back) return goto[a.depositNGN]()

    const email = message
    if (!isValidEmail(email)) return send(chatId, t.askValidEmail)
    await saveInfo('email', email)
    return goto.showDepositNgnInfo()
  }

  if (action === a.depositUSD) {
    if (message === t.back) return goto[a.selectCurrencyToDeposit]()

    const amount = Number(message)
    if (isNaN(amount) || amount < 10) return send(chatId, t.whatNum)
    await saveInfo('amount', amount)

    return goto[a.selectCryptoToDeposit]()
  }
  if (action === a.selectCryptoToDeposit) {
    if (message === t.back) return goto[a.depositUSD]()

    const tickerView = message
    const supportedCryptoView = trans('supportedCryptoView')
    const ticker = supportedCryptoView[tickerView]
    if (!ticker) return send(chatId, t.askValidCrypto)
    await saveInfo('tickerView', ticker)
    return goto.showDepositCryptoInfo()
  }
  //
  //
  if (action === a.walletSelectCurrency) {
    if (message === t.back) return goto[info?.lastStep]()

    const coin = message
    if (![u.usd, u.ngn].includes(coin)) return send(chatId, t.what)
    await saveInfo('coin', coin)

    return goto.walletSelectCurrencyConfirm()
  }
  if (action === a.walletSelectCurrencyConfirm) {
    if (message === t.back || message === t.no) return goto[a.walletSelectCurrency]()

    if (message !== t.yes) return send(chatId, t.what)

    try {
      return walletOk[info?.lastStep](info?.coin)
    } catch (error) {
      return sendMessage(chatId, 'Error code 209 ' + error?.message)
    }
  }

  //
  //
  if (message === user.urlShortenerMain || message.startsWith('🔗✂️') || message.startsWith('🔗 URL')) {
    return goto.submenu1()
  }
  if (message === user.domainNames || message.startsWith('🌐 Register Bulletproof Domain') || message.startsWith('🌐 Register Domain')) {
    return goto.submenu2()
  }
  if (message === user.phoneNumberLeads || message === user.buyLeads || message === '🎯 Buy Valid Leads | Verify Yours' || message === '🎯 Buy Phone Leads') {
    return goto.targetSelectTarget()
  }
  if (message === user.validateLeads || message === '✅ Validate Numbers') {
    return goto.validatorSelectCountry()
  }
  if (message === user.hostingDomainsRedirect || message.startsWith('🛡️🔥 Anti-Red Hosting') || message.startsWith('🌐 Register Bulletproof') || message.startsWith('🌐 Offshore Hosting') || message.startsWith('🌐 Anti-Red Hosting') || message.startsWith('🌐 Hosting')) {
    if (process.env.OFFSHORE_HOSTING_ON === 'false') {
      return send(chatId, `🛡️🔥 Anti-Red Hosting is currently unavailable. Please tap <b>💬 Get Support</b> on the keyboard to reach us.`, trans('o'))
    }
    return goto.submenu3()
  }
  if (message === user.cloudPhone || message === phoneConfig.btn.cloudPhone || message === '📞☁️ Cloud Phone + SIP') {
    if (process.env.PHONE_SERVICE_ON !== 'true') {
      return send(chatId, `📞 Cloud Phone is coming soon! Contact ${process.env.SUPPORT_USERNAME || '@support'} for updates.`, trans('o'))
    }
    return goto.submenu5()
  }

  // 🧪 Test SIP Free button — trigger /testsip flow
  if (message === user.testSip || message === '🧪 Test SIP Free') {
    const result = await generateTestOtp(chatId)
    if (!result) {
      return send(chatId, '❌ Could not generate test code. Please try again later.', trans('o'))
    }
    if (result.error === 'limit_reached') {
      let msg = `📞 <b>SIP Test Complete</b>\n\nYou've used your free test calls. To make unlimited SIP calls, subscribe to a <b>Cloud Phone</b> plan with SIP support.\n\n👉 Tap <b>📞 Cloud Phone + SIP</b> below to browse plans and get your own number with full SIP credentials.`
      const refResult = await getOrCreateReferralCode(chatId)
      const refLink = refResult ? `https://t.me/Nomadlybot?start=ref_${refResult.code}` : null
      if (refLink && !refResult.bonusEarned) {
        msg += `\n\n🎁 <b>Want 1 more free test call?</b>\nShare this link with a friend. When they send /testsip, you'll get a bonus call:\n\n${refLink}`
      }
      return send(chatId, msg, { parse_mode: 'HTML' })
    }
    return send(chatId, `🔑 <b>Your SIP Test Code</b>\n\n<code>${result.otp}</code>\n\nEnter this code on the test page to get your free SIP credentials.\n⏱ Expires in 5 minutes.\n📞 ${result.callsRemaining} test call${result.callsRemaining !== 1 ? 's' : ''} remaining.\n\n🌐 <a href="https://speechcue.com/phone/test">Open Test Page</a>`, { parse_mode: 'HTML' })
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CLOUD PHONE — STATE MACHINE HANDLERS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  if (action === a.submenu5) {
    const pc = phoneConfig.btn
    if (message === t.back || message === pc.back || message === t.cancel || message === pc.cancel) return send(chatId, t.userPressedBtn(message), trans('o'))
    if (message === pc.buyPhoneNumber) {
      set(state, chatId, 'action', a.cpSelectCountry)
      const countryBtns = phoneConfig.allCountries.map(c => c.name)
      const rows = []
      for (let i = 0; i < countryBtns.length; i += 2) {
        rows.push(countryBtns.slice(i, i + 2))
      }
      if (phoneConfig.moreCountries.length > 0) rows.push([pc.moreCountries])
      return send(chatId, phoneConfig.txt.selectCountry, k.of(rows))
    }
    if (message === pc.myNumbers) {
      const userData = await get(phoneNumbersOf, chatId)
      const numbers = (userData?.numbers || []).filter(n => n.status === 'active' || n.status === 'suspended')
      if (!numbers.length) {
        return send(chatId, phoneConfig.txt.noNumbers, k.of([[pc.buyPhoneNumber]]))
      }
      set(state, chatId, 'action', a.cpMyNumbers)
      await saveInfo('cpNumbers', numbers)
      const numBtns = numbers.map((_, i) => String(i + 1))
      return send(chatId, phoneConfig.txt.myNumbersList(numbers), k.of([numBtns, [pc.buyAnother]]))
    }
    if (message === pc.ivrOutboundCall) {
      // IVR Outbound Call — available to all users (trial for non-subscribers)
      const ivrOb = require('./ivr-outbound.js')
      const userData = await get(phoneNumbersOf, chatId)
      const numbers = (userData?.numbers || []).filter(n => n.status === 'active')
      const hasNumbers = numbers.length > 0

      // Check trial usage
      const trialKey = `ivrTrialUsed_${chatId}`
      const trialUsed = await get(state, trialKey)

      if (!hasNumbers) {
        // Non-subscriber path
        if (trialUsed) {
          return send(chatId, `📢 <b>IVR Outbound Call</b>\n\nYou've already used your free trial call.\n\nSubscribe to Cloud Phone to make unlimited IVR calls with your own Caller ID!\n\nTap <b>${pc.buyPhoneNumber}</b> to get started.`, k.of([[pc.buyPhoneNumber]]))
        }
        // Trial path — auto-assign caller ID
        await saveInfo('ivrObData', { callerId: ivrOb.TRIAL_CALLER_ID, isTrial: true })
        set(state, chatId, 'action', a.ivrObEnterTarget)
        return send(chatId, `📢 <b>IVR Outbound Call — Free Trial</b>\n\n🎁 You get <b>1 free trial call!</b>\n📱 Caller ID: <b>${ivrOb.TRIAL_CALLER_ID}</b> (shared)\n\nEnter the phone number to call (with country code):\n<i>Example: +12025551234</i>`, k.of([]))
      }

      // Subscriber path — select caller ID from their numbers
      set(state, chatId, 'action', a.ivrObSelectCallerId)
      await saveInfo('ivrObData', { isTrial: false })
      const numBtns = numbers.map(n => n.phoneNumber)
      const rows = numBtns.map(n => [n])
      return send(chatId, `📢 <b>IVR Outbound Call</b>\n\nSelect the number to call FROM (Caller ID):`, k.of(rows))
    }
    if (message === pc.sipSettings) {
      return send(chatId, phoneConfig.txt.softphoneGuide(phoneConfig.SIP_DOMAIN), k.of([]))
    }
    if (message === pc.usageBilling) {
      // Show overall usage if they have numbers
      const userData = await get(phoneNumbersOf, chatId)
      const numbers = (userData?.numbers || []).filter(n => n.status === 'active')
      if (!numbers.length) return send(chatId, phoneConfig.getMsg(info?.userLanguage).noActiveNumbers, k.of([[pc.buyPhoneNumber]]))
      // Show list to pick a number
      set(state, chatId, 'action', a.cpMyNumbers)
      await saveInfo('cpNumbers', numbers)
      const numBtns = numbers.map((_, i) => String(i + 1))
      return send(chatId, phoneConfig.txt.myNumbersList(numbers), k.of([numBtns]))
    }
    return send(chatId, phoneConfig.getMsg(info?.userLanguage).selectOption)
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // IVR OUTBOUND CALL — Full conversational flow
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (action === a.ivrObSelectCallerId) {
    if (message === 'Cancel' || message === t.cancel || message === t.back) return goto.submenu5()
    const userData = await get(phoneNumbersOf, chatId)
    const numbers = (userData?.numbers || []).filter(n => n.status === 'active')
    const found = numbers.find(n => n.phoneNumber === message)
    if (!found) return send(chatId, `Please select a valid number from the list.`)
    const ivrObData = info?.ivrObData || {}
    ivrObData.callerId = found.phoneNumber
    ivrObData.callerProvider = found.provider || 'telnyx'
    await saveInfo('ivrObData', ivrObData)
    set(state, chatId, 'action', a.ivrObEnterTarget)
    return send(chatId, `📱 Caller ID: <b>${found.phoneNumber}</b>\n\nEnter the phone number to call (with country code):\n<i>Example: +12025551234</i>`, k.of([]))
  }

  if (action === a.ivrObEnterTarget) {
    if (message === 'Cancel' || message === t.cancel) return goto.submenu5()
    if (message === t.back) {
      const ivrObData = info?.ivrObData || {}
      if (ivrObData.isTrial) return goto.submenu5()
      // Back → caller ID selection
      set(state, chatId, 'action', a.ivrObSelectCallerId)
      const userData = await get(phoneNumbersOf, chatId)
      const numbers = (userData?.numbers || []).filter(n => n.status === 'active')
      const numBtns = numbers.map(n => n.phoneNumber)
      const rows = numBtns.map(n => [n])
      return send(chatId, `📢 <b>IVR Outbound Call</b>\n\nSelect the number to call FROM (Caller ID):`, k.of(rows))
    }
    const clean = message.replace(/[^+\d]/g, '')
    if (!clean.match(/^\+\d{10,15}$/)) {
      return send(chatId, `Please enter a valid phone number starting with + and 10-15 digits.\n<i>Example: +12025551234</i>`, k.of([]))
    }
    const ivrObData = info?.ivrObData || {}
    ivrObData.targetNumber = clean
    ivrObData.suggestedName = null

    // CNAM lookup for US/CA numbers (+1)
    if (clean.startsWith('+1') && clean.length >= 11) {
      send(chatId, `🔍 Looking up number...`)
      try {
        const rawName = await lookupCnam(clean)
        if (rawName && rawName.trim().length > 1) {
          // Skip generic/useless results
          const generic = ['wireless caller', 'unknown', 'unavailable', 'no name', 'caller', 'n/a', 'private']
          const lower = rawName.trim().toLowerCase()
          if (!generic.some(g => lower === g || lower.startsWith(g))) {
            // Title-case: "JOHN SMITH" → "John Smith"
            const titleCase = rawName.trim().replace(/\b\w+/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            ivrObData.suggestedName = titleCase
            send(chatId, `📋 Found: <b>${titleCase}</b>`)
          }
        }
      } catch (e) { /* silent — no name found */ }
    }

    await saveInfo('ivrObData', ivrObData)
    set(state, chatId, 'action', a.ivrObSelectCategory)
    const ivrOb = require('./ivr-outbound.js')
    const catBtns = ivrOb.getCategoryButtons()
    const rows = catBtns.map(b => [b])
    return send(chatId, `📞 Target: <b>${clean}</b>\n\nChoose an IVR template category:`, k.of(rows))
  }

  if (action === a.ivrObSelectCategory) {
    if (message === 'Cancel' || message === t.cancel) return goto.submenu5()
    if (message === t.back) {
      // Back → enter target number
      set(state, chatId, 'action', a.ivrObEnterTarget)
      return send(chatId, `Enter the phone number to call (with country code):\n<i>Example: +12025551234</i>`, k.of([]))
    }
    const ivrOb = require('./ivr-outbound.js')
    const cat = ivrOb.getCategoryByButton(message)
    if (!cat) return send(chatId, `Please select a category from the buttons.`)
    const ivrObData = info?.ivrObData || {}

    if (cat === 'custom') {
      // Custom script — ask user to type their script
      ivrObData.category = 'custom'
      await saveInfo('ivrObData', ivrObData)
      set(state, chatId, 'action', a.ivrObCustomScript)
      return send(chatId, `✍️ <b>Custom Script</b>\n\nType your IVR message. Use <b>[Brackets]</b> for variables:\n\n<i>Example: Hello [Name]. This is [Company]. A payment of $[Amount] was charged. Press 1 to dispute.</i>\n\nType your script:`, k.of([]))
    }

    ivrObData.category = cat
    await saveInfo('ivrObData', ivrObData)
    set(state, chatId, 'action', a.ivrObSelectTemplate)
    const tmplBtns = ivrOb.getTemplateButtons(cat)
    const rows = tmplBtns.map(b => [b])
    rows.push(['↩️ Back'])
    return send(chatId, `Select a template:`, k.of(rows))
  }

  if (action === a.ivrObCustomScript) {
    if (message === 'Cancel' || message === t.cancel) return goto.submenu5()
    if (message === t.back) {
      // Back → category selection
      set(state, chatId, 'action', a.ivrObSelectCategory)
      const ivrOb = require('./ivr-outbound.js')
      const catBtns = ivrOb.getCategoryButtons()
      const rows = catBtns.map(b => [b])
      return send(chatId, `Choose an IVR template category:`, k.of(rows))
    }
    const ivrOb = require('./ivr-outbound.js')
    const ivrObData = info?.ivrObData || {}
    ivrObData.customScript = message
    ivrObData.templateName = 'Custom Script'
    // Extract placeholders from custom script
    const placeholders = ivrOb.extractPlaceholders(message)
    // Extract active keys from script (look for "press X" patterns)
    const keyMatches = message.match(/press\s+(\d)/gi) || []
    const activeKeys = [...new Set(keyMatches.map(m => m.replace(/press\s+/i, '')))]
    ivrObData.activeKeys = activeKeys.length > 0 ? activeKeys : ['1']
    ivrObData.templateText = message
    ivrObData.placeholders = placeholders
    await saveInfo('ivrObData', ivrObData)

    if (placeholders.length > 0) {
      ivrObData.placeholderValues = {}
      ivrObData.placeholderIndex = 0
      await saveInfo('ivrObData', ivrObData)
      set(state, chatId, 'action', a.ivrObFillPlaceholder)
      const firstPh = placeholders[0]
      const rows = []
      if (firstPh === 'Name' && ivrObData.suggestedName) {
        rows.push([ivrObData.suggestedName])
        rows.push(['Dear Customer'])
      }
      return send(chatId, `Enter value for <b>[${firstPh}]</b>:`, k.of(rows))
    }

    // No placeholders — skip to IVR number
    set(state, chatId, 'action', a.ivrObEnterIvrNumber)
    return send(chatId, `Enter the number to transfer the caller to when they press a key:\n<i>Example: +17174794833</i>`, k.of([]))
  }

  if (action === a.ivrObSelectTemplate) {
    if (message === '↩️ Back' || message === t.back) {
      set(state, chatId, 'action', a.ivrObSelectCategory)
      const ivrOb = require('./ivr-outbound.js')
      const catBtns = ivrOb.getCategoryButtons()
      const rows = catBtns.map(b => [b])
      return send(chatId, `Choose an IVR template category:`, k.of(rows))
    }
    if (message === 'Cancel' || message === t.cancel) return goto.submenu5()
    const ivrOb = require('./ivr-outbound.js')
    const ivrObData = info?.ivrObData || {}
    const template = ivrOb.getTemplateByButton(ivrObData.category, message)
    if (!template) return send(chatId, `Please select a template from the buttons.`)

    ivrObData.templateKey = template.key
    ivrObData.templateName = template.name
    ivrObData.templateText = template.text
    ivrObData.placeholders = template.placeholders || []
    ivrObData.activeKeys = template.activeKeys || ['1']
    ivrObData.placeholderValues = {}
    ivrObData.placeholderIndex = 0
    await saveInfo('ivrObData', ivrObData)

    // Show template preview
    send(chatId, `📋 <b>${template.icon} ${template.name}</b>\n\n<i>"${template.text}"</i>\n\n🔘 Active keys: <b>${template.activeKeys.join(', ')}</b>`)

    if (ivrObData.placeholders.length > 0) {
      set(state, chatId, 'action', a.ivrObFillPlaceholder)
      const firstPh = ivrObData.placeholders[0]
      const rows = []
      if (firstPh === 'Name' && ivrObData.suggestedName) {
        rows.push([ivrObData.suggestedName])
        rows.push(['Dear Customer'])
      }
      return send(chatId, `\nEnter value for <b>[${firstPh}]</b>:`, k.of(rows))
    }

    // No placeholders — skip to IVR number
    set(state, chatId, 'action', a.ivrObEnterIvrNumber)
    return send(chatId, `Enter the number to transfer the caller to when they press a key:\n<i>Example: +17174794833</i>`, k.of([]))
  }

  if (action === a.ivrObFillPlaceholder) {
    if (message === 'Cancel' || message === t.cancel) return goto.submenu5()
    if (message === t.back) {
      // Back → category selection (restarting template flow)
      set(state, chatId, 'action', a.ivrObSelectCategory)
      const ivrOb = require('./ivr-outbound.js')
      const catBtns = ivrOb.getCategoryButtons()
      const rows = catBtns.map(b => [b])
      return send(chatId, `Choose an IVR template category:`, k.of(rows))
    }
    const ivrObData = info?.ivrObData || {}
    const placeholders = ivrObData.placeholders || []
    const idx = ivrObData.placeholderIndex || 0

    if (idx < placeholders.length) {
      ivrObData.placeholderValues[placeholders[idx]] = message
      ivrObData.placeholderIndex = idx + 1
      await saveInfo('ivrObData', ivrObData)

      if (idx + 1 < placeholders.length) {
        // Build keyboard for next placeholder
        const nextPh = placeholders[idx + 1]
        const rows = []
        // If next placeholder is "Name" and we have a CNAM suggestion, show it
        if (nextPh === 'Name' && ivrObData.suggestedName) {
          rows.push([ivrObData.suggestedName])
          rows.push(['Dear Customer'])
        }
        return send(chatId, `✅ ${placeholders[idx]}: <b>${message}</b>\n\nEnter value for <b>[${nextPh}]</b>:`, k.of(rows))
      }
    }

    // All placeholders filled — go to IVR number
    set(state, chatId, 'action', a.ivrObEnterIvrNumber)
    return send(chatId, `✅ All values set!\n\nEnter the number to transfer the caller to when they press a key:\n<i>Example: +17174794833</i>`, k.of([]))
  }

  if (action === a.ivrObEnterIvrNumber) {
    if (message === 'Cancel' || message === t.cancel) return goto.submenu5()
    if (message === t.back) {
      // Back → category selection
      set(state, chatId, 'action', a.ivrObSelectCategory)
      const ivrOb = require('./ivr-outbound.js')
      const catBtns = ivrOb.getCategoryButtons()
      const rows = catBtns.map(b => [b])
      return send(chatId, `Choose an IVR template category:`, k.of(rows))
    }
    const clean = message.replace(/[^+\d]/g, '')
    if (!clean.match(/^\+\d{10,15}$/)) {
      return send(chatId, `Please enter a valid phone number starting with +.\n<i>Example: +17174794833</i>`, k.of([]))
    }
    const ivrObData = info?.ivrObData || {}
    ivrObData.ivrNumber = clean
    await saveInfo('ivrObData', ivrObData)
    set(state, chatId, 'action', a.ivrObSelectProvider)
    const ttsService = require('./tts-service.js')
    const providerBtns = ttsService.getProviderButtons().map(b => [b])
    return send(chatId, `🎙 <b>Select Voice Provider</b>\n\nChoose your TTS engine:`, k.of(providerBtns))
  }

  if (action === a.ivrObSelectProvider) {
    if (message === 'Cancel' || message === t.cancel) return goto.submenu5()
    if (message === t.back) {
      // Back → enter IVR number
      set(state, chatId, 'action', a.ivrObEnterIvrNumber)
      return send(chatId, `Enter the number to transfer the caller to when they press a key:\n<i>Example: +17174794833</i>`, k.of([]))
    }
    const ttsService = require('./tts-service.js')
    const providerKey = ttsService.getProviderByButton(message)
    if (!providerKey) {
      const providerBtns = ttsService.getProviderButtons().map(b => [b])
      return send(chatId, `Please select a voice provider:`, k.of(providerBtns))
    }
    const ivrObData = info?.ivrObData || {}
    ivrObData.ttsProvider = providerKey
    await saveInfo('ivrObData', ivrObData)
    set(state, chatId, 'action', a.ivrObSelectVoice)
    const voiceBtns = ttsService.getVoiceButtons('en', providerKey)
    const rows = []
    for (let i = 0; i < voiceBtns.length; i += 2) {
      rows.push(voiceBtns.slice(i, i + 2))
    }
    return send(chatId, `🎤 <b>Select Voice</b>\n\nChoose a voice for the IVR audio:`, k.of(rows))
  }

  if (action === a.ivrObSelectVoice) {
    if (message === 'Cancel' || message === t.cancel) return goto.submenu5()
    if (message === t.back) {
      // Back → provider selection
      set(state, chatId, 'action', a.ivrObSelectProvider)
      const ttsService = require('./tts-service.js')
      const providerBtns = ttsService.getProviderButtons().map(b => [b])
      return send(chatId, `🎙 <b>Select Voice Provider</b>\n\nChoose your TTS engine:`, k.of(providerBtns))
    }
    const ttsService = require('./tts-service.js')
    const voiceKey = ttsService.getVoiceKeyByButton(message)
    const voice = ttsService.VOICES[voiceKey] || ttsService.VOICES[ttsService.DEFAULT_VOICE]
    const ivrObData = info?.ivrObData || {}
    ivrObData.voiceKey = voiceKey
    ivrObData.voiceName = voice.name
    await saveInfo('ivrObData', ivrObData)

    // Generate audio preview
    set(state, chatId, 'action', a.ivrObAudioPreview)
    send(chatId, `🎤 Voice: <b>${voice.name}</b>\n\n⏳ Generating audio preview...`)

    try {
      const ivrOb = require('./ivr-outbound.js')
      const filledText = ivrOb.fillTemplate(ivrObData.templateText, ivrObData.placeholderValues || {})
      const result = await ttsService.generateTTS(filledText, voiceKey)
      ivrObData.audioPath = result.audioPath
      ivrObData.audioUrl = result.audioUrl
      ivrObData.filledText = filledText
      await saveInfo('ivrObData', ivrObData)

      // Send audio preview with action keyboard attached (avoids slow separate keyboard message)
      const previewKeyboard = k.of([['✅ Confirm'], ['🎤 Change Voice'], [ivrObData.holdMusic ? '🎵 Hold Music: ON' : '🔇 Hold Music: OFF']])
      await bot.sendAudio(chatId, result.audioPath, {
        caption: `🔊 <b>Audio Preview</b>\n\nListen to the IVR message that will play to the call receiver.\n\nHappy with it? Tap <b>✅ Confirm</b> to proceed.\nWant a different voice? Tap <b>🎤 Change Voice</b>.`,
        parse_mode: 'HTML',
        reply_markup: previewKeyboard.reply_markup,
      })
      return
    } catch (err) {
      log(`[IVR-OB] TTS error: ${err.message}`)
      return send(chatId, `❌ Audio generation failed: ${err.message}\n\nPlease try again or choose a different voice.`, k.of([['🎤 Change Voice']]))
    }
  }

  if (action === a.ivrObAudioPreview) {
    if (message === 'Cancel' || message === t.cancel) return goto.submenu5()
    if (message === t.back) {
      // Back → voice selection
      set(state, chatId, 'action', a.ivrObSelectProvider)
      const ttsService = require('./tts-service.js')
      const providerBtns = ttsService.getProviderButtons().map(b => [b])
      return send(chatId, `🎙 <b>Select Voice Provider</b>\n\nChoose your TTS engine:`, k.of(providerBtns))
    }
    if (message === '🎤 Change Voice') {
      set(state, chatId, 'action', a.ivrObSelectProvider)
      const ttsService = require('./tts-service.js')
      const providerBtns = ttsService.getProviderButtons().map(b => [b])
      return send(chatId, `🎙 <b>Select Voice Provider</b>\n\nChoose your TTS engine:`, k.of(providerBtns))
    }
    // Toggle hold music
    if (message === '🎵 Hold Music: ON' || message === '🔇 Hold Music: OFF') {
      const ivrObData = info?.ivrObData || {}
      ivrObData.holdMusic = !ivrObData.holdMusic
      await saveInfo('ivrObData', ivrObData)
      send(chatId, `🎵 Hold Music: <b>${ivrObData.holdMusic ? 'ON' : 'OFF'}</b>\n${ivrObData.holdMusic ? 'Target will hear "Please hold" + music before transfer.' : 'Target hears standard ringback during transfer.'}`, { parse_mode: 'HTML' })
      return send(chatId, `What would you like to do?`, k.of([['✅ Confirm'], ['🎤 Change Voice'], [ivrObData.holdMusic ? '🎵 Hold Music: ON' : '🔇 Hold Music: OFF']]))
    }
    if (message === '✅ Confirm') {
      // Show call preview
      const ivrOb = require('./ivr-outbound.js')
      const ivrObData = info?.ivrObData || {}
      set(state, chatId, 'action', a.ivrObCallPreview)
      const preview = ivrOb.formatCallPreview(ivrObData)
      return send(chatId, preview, k.of([['/yes']]))
    }
    return send(chatId, `Tap <b>✅ Confirm</b> to proceed, <b>🎤 Change Voice</b>, or <b>Back</b>.`, k.of([['✅ Confirm'], ['🎤 Change Voice'], [(info?.ivrObData?.holdMusic) ? '🎵 Hold Music: ON' : '🔇 Hold Music: OFF']]))
  }

  if (action === a.ivrObCallPreview) {
    if (message === 'Cancel' || message === t.cancel) return goto.submenu5()
    if (message === t.back) {
      // Back → audio preview / hold music toggle
      set(state, chatId, 'action', a.ivrObAudioPreview)
      const ivrObData = info?.ivrObData || {}
      return send(chatId, `What would you like to do?`, k.of([['✅ Confirm'], ['🎤 Change Voice'], [ivrObData.holdMusic ? '🎵 Hold Music: ON' : '🔇 Hold Music: OFF']]))
    }
    if (message === '/yes') {
      const ivrObData = info?.ivrObData || {}
      const voiceService = require('./voice-service.js')
      const ivrOb = require('./ivr-outbound.js')

      // Notify: calling
      send(chatId, ivrOb.formatCallNotification('calling', ivrObData))

      // Place the call
      const result = await voiceService.initiateOutboundIvrCall({
        chatId,
        callerId: ivrObData.callerId,
        targetNumber: ivrObData.targetNumber,
        ivrNumber: ivrObData.ivrNumber,
        audioUrl: ivrObData.audioUrl,
        activeKeys: ivrObData.activeKeys,
        templateName: ivrObData.templateName,
        placeholderValues: ivrObData.placeholderValues,
        voiceName: ivrObData.voiceName,
        isTrial: ivrObData.isTrial || false,
        holdMusic: ivrObData.holdMusic || false,
      })

      if (result.error) {
        send(chatId, ivrOb.formatCallNotification('failed', { ...ivrObData, reason: result.error }))
        return goto.submenu5()
      }

      // Mark trial as used if applicable
      if (ivrObData.isTrial) {
        const trialKey = `ivrTrialUsed_${chatId}`
        await set(state, trialKey, true)
      }

      // Reset to hub
      return set(state, chatId, 'action', a.submenu5)
    }
    if (message === '/cancel') return goto.submenu5()
    return send(chatId, `Press <b>/yes</b> to place the call or <b>/cancel</b> to abort.`)
  }

  // ── BUY FLOW: Select Country ──
  if (action === a.cpSelectCountry) {
    const pc = phoneConfig.btn
    if (message === t.back || message === pc.back) return goto.submenu5()
    // Handle "More Countries" button
    if (message === pc.moreCountries) {
      const allBtns = [...phoneConfig.allCountries, ...phoneConfig.moreCountries].map(c => c.name)
      const rows = []
      for (let i = 0; i < allBtns.length; i += 2) rows.push(allBtns.slice(i, i + 2))
      return send(chatId, `🌍 <b>All Available Countries</b>\n\nSelect a country:`, k.of(rows))
    }
    const countryCode = phoneConfig.countryByName[message]
    if (!countryCode) return send(chatId, phoneConfig.getMsg(info?.userLanguage).selectValidCountry)
    // Determine provider for this country
    const countryEntry = phoneConfig.allCountries.find(c => c.name === message) || phoneConfig.moreCountries.find(c => c.name === message)
    const provider = countryEntry?.provider || 'telnyx'
    await saveInfo('cpCountryCode', countryCode)
    await saveInfo('cpCountryName', message)
    await saveInfo('cpProvider', provider)
    set(state, chatId, 'action', a.cpSelectType)
    // Show available types for this country
    const types = countryEntry?.types || ['local', 'toll_free']
    const typeBtns = []
    if (types.includes('local')) typeBtns.push([pc.localNumber])
    if (types.includes('mobile')) typeBtns.push([pc.mobileNumber])
    if (types.includes('national')) typeBtns.push([pc.nationalNumber])
    if (types.includes('toll_free')) typeBtns.push([pc.tollFreeNumber])
    return send(chatId, phoneConfig.txt.selectType(message), k.of(typeBtns))
  }

  // ── BUY FLOW: Select Type ──
  if (action === a.cpSelectType) {
    const pc = phoneConfig.btn
    if (message === t.back || message === pc.back) {
      set(state, chatId, 'action', a.cpSelectCountry)
      const countryBtns = phoneConfig.allCountries.map(c => c.name)
      const rows = []
      for (let i = 0; i < countryBtns.length; i += 2) rows.push(countryBtns.slice(i, i + 2))
      if (phoneConfig.moreCountries.length > 0) rows.push([pc.moreCountries])
      return send(chatId, phoneConfig.txt.selectCountry, k.of(rows))
    }
    let numberType = null
    if (message === pc.localNumber) numberType = 'local'
    if (message === pc.tollFreeNumber) numberType = 'toll_free'
    if (message === (pc.mobileNumber || '📱 Mobile Number')) numberType = 'mobile'
    if (message === (pc.nationalNumber || '🌐 National Number')) numberType = 'national'
    if (!numberType) return send(chatId, phoneConfig.getMsg(info?.userLanguage).selectLocalOrTollFree)
    await saveInfo('cpNumberType', numberType)

    const cc = info?.cpCountryCode || 'US'
    const provider = info?.cpProvider || 'telnyx'

    // If US + Telnyx, show area codes. Otherwise, skip to search.
    if (cc === 'US' && numberType === 'local' && provider === 'telnyx') {
      set(state, chatId, 'action', a.cpSelectArea)
      const areaBtns = phoneConfig.usAreaCodes.map(a => `${a.city} (${a.code})`)
      const rows = []
      for (let i = 0; i < areaBtns.length; i += 2) rows.push(areaBtns.slice(i, i + 2))
      rows.push([pc.searchByArea])
      return send(chatId, phoneConfig.txt.selectArea, k.of(rows))
    }
    // Non-US or toll-free: search directly
    set(state, chatId, 'action', a.cpSelectNumber)
    send(chatId, phoneConfig.txt.searching)
    let results
    if (provider === 'twilio') {
      results = await twilioService.searchNumbers(cc, numberType, 5)
    } else {
      results = await telnyxApi.searchNumbers(cc, numberType, null, 5)
    }
    if (!results.length) return send(chatId, phoneConfig.txt.noSearchResults, k.of([]))
    await saveInfo('cpSearchResults', results)
    const location = info?.cpCountryName || cc
    const numBtns = results.map((_, i) => String(i + 1))
    return send(chatId, phoneConfig.txt.showNumbers(location, results), k.of([numBtns, [pc.showMore]]))
  }

  // ── BUY FLOW: Select Area ──
  if (action === a.cpSelectArea) {
    const pc = phoneConfig.btn
    if (message === t.back || message === pc.back) {
      set(state, chatId, 'action', a.cpSelectType)
      return send(chatId, phoneConfig.txt.selectType(info?.cpCountryName || ''), k.of([[pc.localNumber], [pc.tollFreeNumber]]))
    }
    if (message === pc.searchByArea) {
      set(state, chatId, 'action', a.cpEnterAreaCode)
      return send(chatId, phoneConfig.txt.enterAreaCode)
    }
    const areaCode = phoneConfig.areaByLabel[message]
    if (!areaCode) return send(chatId, phoneConfig.getMsg(info?.userLanguage).selectValidArea)
    await saveInfo('cpAreaCode', areaCode)
    await saveInfo('cpAreaName', message)

    set(state, chatId, 'action', a.cpSelectNumber)
    send(chatId, phoneConfig.txt.searching)
    const results = await telnyxApi.searchNumbers(info?.cpCountryCode || 'US', info?.cpNumberType || 'local', areaCode, 5)
    if (!results.length) return send(chatId, phoneConfig.txt.noSearchResults, k.of([]))
    await saveInfo('cpSearchResults', results)
    const numBtns = results.map((_, i) => String(i + 1))
    return send(chatId, phoneConfig.txt.showNumbers(message, results), k.of([numBtns, [pc.showMore]]))
  }

  // ── BUY FLOW: Enter Area Code ──
  if (action === a.cpEnterAreaCode) {
    const pc = phoneConfig.btn
    if (message === t.back || message === pc.back) {
      set(state, chatId, 'action', a.cpSelectArea)
      const areaBtns = phoneConfig.usAreaCodes.map(a => `${a.city} (${a.code})`)
      const rows = []
      for (let i = 0; i < areaBtns.length; i += 2) rows.push(areaBtns.slice(i, i + 2))
      rows.push([pc.searchByArea])
      return send(chatId, phoneConfig.txt.selectArea, k.of(rows))
    }
    const areaCode = message.replace(/\D/g, '')
    if (!areaCode || areaCode.length < 2) return send(chatId, phoneConfig.getMsg(info?.userLanguage).enterValidAreaCode)
    await saveInfo('cpAreaCode', areaCode)
    await saveInfo('cpAreaName', `Area ${areaCode}`)

    set(state, chatId, 'action', a.cpSelectNumber)
    send(chatId, phoneConfig.txt.searching)
    const results = await telnyxApi.searchNumbers(info?.cpCountryCode || 'US', info?.cpNumberType || 'local', areaCode, 5)
    if (!results.length) return send(chatId, phoneConfig.txt.noSearchResults + '\nTry a different area code.', k.of([]))
    await saveInfo('cpSearchResults', results)
    const numBtns = results.map((_, i) => String(i + 1))
    return send(chatId, phoneConfig.txt.showNumbers(`Area ${areaCode}`, results), k.of([numBtns, [pc.showMore]]))
  }

  // ── BUY FLOW: Select Number ──
  if (action === a.cpSelectNumber) {
    const pc = phoneConfig.btn
    if (message === t.back || message === pc.back) {
      const cc = info?.cpCountryCode || 'US'
      if (cc === 'US' && info?.cpNumberType === 'local') {
        set(state, chatId, 'action', a.cpSelectArea)
        const areaBtns = phoneConfig.usAreaCodes.map(a => `${a.city} (${a.code})`)
        const rows = []
        for (let i = 0; i < areaBtns.length; i += 2) rows.push(areaBtns.slice(i, i + 2))
        rows.push([pc.searchByArea])
        return send(chatId, phoneConfig.txt.selectArea, k.of(rows))
      }
      set(state, chatId, 'action', a.cpSelectType)
      return send(chatId, phoneConfig.txt.selectType(info?.cpCountryName || ''), k.of([[pc.localNumber], [pc.tollFreeNumber]]))
    }
    if (message === pc.showMore) {
      send(chatId, phoneConfig.txt.searching)
      const provider = info?.cpProvider || 'telnyx'
      let results
      if (provider === 'twilio') {
        results = await twilioService.searchNumbers(info?.cpCountryCode || 'US', info?.cpNumberType || 'local', 5)
      } else {
        results = await telnyxApi.searchNumbers(info?.cpCountryCode || 'US', info?.cpNumberType || 'local', info?.cpAreaCode, 5)
      }
      if (!results.length) return send(chatId, phoneConfig.txt.noSearchResults, k.of([]))
      await saveInfo('cpSearchResults', results)
      const location = info?.cpAreaName || info?.cpCountryName || ''
      const numBtns = results.map((_, i) => String(i + 1))
      return send(chatId, phoneConfig.txt.showNumbers(location, results), k.of([numBtns, [pc.showMore]]))
    }
    const idx = parseInt(message) - 1
    const results = info?.cpSearchResults || []
    if (isNaN(idx) || idx < 0 || idx >= results.length) return send(chatId, phoneConfig.getMsg(info?.userLanguage).tapNumberToSelect)
    const selected = results[idx]
    await saveInfo('cpSelectedNumber', selected.phone_number)
    // Store capabilities from search results (Telnyx returns features array)
    const caps = selected._capabilities || {
      voice: (selected.features || []).some(f => f.name === 'voice'),
      sms: (selected.features || []).some(f => f.name === 'sms'),
      mms: (selected.features || []).some(f => f.name === 'mms'),
      fax: (selected.features || []).some(f => f.name === 'fax'),
    }
    await saveInfo('cpSelectedCapabilities', caps)

    set(state, chatId, 'action', a.cpSelectPlan)
    // Show capabilities in plan selection
    const capLabels = []
    if (caps.voice) capLabels.push('Voice')
    if (caps.sms) capLabels.push('SMS')
    if (caps.fax) capLabels.push('Fax')
    // Only show available plans (hide Coming Soon)
    const availablePlanBtns = []
    if (phoneConfig.isPlanAvailable('starter')) availablePlanBtns.push([pc.starterPlan])
    if (phoneConfig.isPlanAvailable('pro')) availablePlanBtns.push([pc.proPlan])
    if (phoneConfig.isPlanAvailable('business')) availablePlanBtns.push([pc.businessPlan])
    return send(chatId, phoneConfig.txt.selectPlan(selected.phone_number) + `\n📋 Capabilities: ${capLabels.join(' · ')}${caps.fax ? '\n📠 Fax included — inbound faxes will be forwarded to Telegram' : ''}`, k.of(availablePlanBtns))
  }

  // ── BUY FLOW: Select Plan ──
  if (action === a.cpSelectPlan) {
    const pc = phoneConfig.btn
    if (message === t.back || message === pc.back) {
      set(state, chatId, 'action', a.cpSelectNumber)
      const results = info?.cpSearchResults || []
      if (!results.length) return goto.submenu5()
      const location = info?.cpAreaName || info?.cpCountryName || ''
      const numBtns = results.map((_, i) => String(i + 1))
      return send(chatId, phoneConfig.txt.showNumbers(location, results), k.of([numBtns, [pc.showMore]]))
    }
    const planKey = phoneConfig.planByButton[message]
    if (!planKey) return send(chatId, phoneConfig.getMsg(info?.userLanguage).selectPlan)

    // Check if plan is available
    if (!phoneConfig.isPlanAvailable(planKey)) {
      const availBtns = []
      if (phoneConfig.isPlanAvailable('starter')) availBtns.push([pc.starterPlan])
      if (phoneConfig.isPlanAvailable('pro')) availBtns.push([pc.proPlan])
      if (phoneConfig.isPlanAvailable('business')) availBtns.push([pc.businessPlan])
      return send(chatId, `This plan is not yet available. Please choose from the available plans below.`, k.of(availBtns))
    }

    const plan = phoneConfig.plans[planKey]
    const numberType = info?.cpNumberType || 'local'
    const countryCode = info?.cpCountryCode || 'US'
    const surcharge = getNumberSurcharge(countryCode, numberType)
    const totalPrice = plan.price + surcharge

    await saveInfo('cpPlanKey', planKey)
    await saveInfo('cpPrice', totalPrice)
    await saveInfo('price', totalPrice)
    await saveInfo('cpNumberSurcharge', surcharge)
    await saveInfo('cpPlanBasePrice', plan.price)

    set(state, chatId, 'action', a.cpOrderSummary)
    let summaryText = phoneConfig.txt.orderSummary(
      info?.cpSelectedNumber, info?.cpCountryName || 'US', plan, totalPrice
    )
    if (surcharge > 0) {
      summaryText += `\n\n💰 <b>Number Cost:</b> $${surcharge.toFixed(2)}/mo (added to plan)\n📋 Plan: $${plan.price}/mo + Number: $${surcharge.toFixed(2)}/mo = <b>$${totalPrice.toFixed(2)}/mo</b>`
    }
    return send(chatId, summaryText, k.of([[pc.proceedPayment], [pc.applyCoupon]]))
  }

  // ── BUY FLOW: Order Summary → Payment ──
  if (action === a.cpOrderSummary) {
    const pc = phoneConfig.btn
    if (message === t.back || message === pc.back) {
      set(state, chatId, 'action', a.cpSelectPlan)
      const availBtns2 = []
      if (phoneConfig.isPlanAvailable('starter')) availBtns2.push([pc.starterPlan])
      if (phoneConfig.isPlanAvailable('pro')) availBtns2.push([pc.proPlan])
      if (phoneConfig.isPlanAvailable('business')) availBtns2.push([pc.businessPlan])
      return send(chatId, phoneConfig.txt.selectPlan(info?.cpSelectedNumber), k.of(availBtns2))
    }
    if (message === pc.applyCoupon) {
      return goto.askCoupon('cpOrderSummary')
    }
    if (message === pc.proceedPayment) {
      return goto['phone-pay']()
    }
    return send(chatId, phoneConfig.getMsg(info?.userLanguage).proceedOrBack)
  }

  // ── PHONE PAY ──
  if (action === 'phone-pay') {
    if (message === t.back) {
      set(state, chatId, 'action', a.cpOrderSummary)
      const plan = phoneConfig.plans[info?.cpPlanKey]
      const totalPrice = info?.cpPrice || plan?.price
      const surcharge = info?.cpNumberSurcharge || 0
      let summaryText = phoneConfig.txt.orderSummary(
        info?.cpSelectedNumber, info?.cpCountryName || 'US', plan, totalPrice
      )
      if (surcharge > 0) {
        summaryText += `\n\n💰 <b>Number Cost:</b> $${surcharge.toFixed(2)}/mo (added to plan)\n📋 Plan: $${info?.cpPlanBasePrice || plan?.price}/mo + Number: $${surcharge.toFixed(2)}/mo = <b>$${totalPrice.toFixed ? totalPrice.toFixed(2) : totalPrice}/mo</b>`
      }
      return send(chatId, summaryText, k.of([[phoneConfig.btn.proceedPayment], [phoneConfig.btn.applyCoupon]]))
    }
    const payOption = message
    if (payOption === payIn.crypto) {
      set(state, chatId, 'action', 'crypto-pay-phone')
      return send(chatId, t.selectCryptoToDeposit, trans('k.of', trans('supportedCryptoViewOf')))
    }
    if (payOption === payIn.bank) {
      set(state, chatId, 'action', 'bank-pay-phone')
      return send(chatId, t.askEmail, bc)
    }
    if (payOption === payIn.wallet) {
      set(state, chatId, 'lastStep', 'phone-pay')
      return goto.walletSelectCurrency()
    }
    return send(chatId, t.askValidPayOption)
  }
  if (action === 'bank-pay-phone') {
    if (message === t.back) return goto['phone-pay']()
    const email = message
    const price = info?.cpPrice
    if (!isValidEmail(email)) return send(chatId, t.askValidEmail)
    const ref = nanoid()
    set(state, chatId, 'action', 'none')
    const priceNGN = Number(await usdToNgn(price))
    set(chatIdOfPayment, ref, { chatId, price, cpData: { selectedNumber: info?.cpSelectedNumber, planKey: info?.cpPlanKey, provider: info?.cpProvider || 'telnyx', countryCode: info?.cpCountryCode || 'US', countryName: info?.cpCountryName || 'US' }, endpoint: '/bank-pay-phone' })
    const { url, error } = await createCheckout(priceNGN, `/ok?a=b&ref=${ref}&`, email, username, ref)
    if (error) return send(chatId, error, trans('o'))
    return send(chatId, `Cloud Phone ₦${priceNGN.toLocaleString()}`, trans('payBank', url))
  }
  if (action === 'crypto-pay-phone') {
    if (message === t.back) return goto['phone-pay']()
    const tickerView = message
    const supportedCryptoView = trans('supportedCryptoView')
    const ticker = supportedCryptoView[tickerView]
    if (!ticker) return send(chatId, t.askValidCrypto)
    const price = info?.cpPrice
    const ref = nanoid()
    if (BLOCKBEE_CRYTPO_PAYMENT_ON === 'true') {
      const coin = tickerOf[ticker]
      set(chatIdOfPayment, ref, { chatId, price, cpData: { selectedNumber: info?.cpSelectedNumber, planKey: info?.cpPlanKey, provider: info?.cpProvider || 'telnyx', countryCode: info?.cpCountryCode || 'US', countryName: info?.cpCountryName || 'US' } })
      const url = await generateBlockBeeAddress(price, coin, `${SELF_URL}/crypto-pay-phone?ref=${ref}`, { chatId, coin })
      if (!url) return send(chatId, t.cryptoPayError)
      await sendQrCode(bot, chatId, url, info?.userLanguage ?? 'en')
      set(state, chatId, 'action', 'none')
      const priceCrypto = await convert(price, 'usd', coin)
      return send(chatId, t.showDepositCryptoInfoPhone(priceCrypto, ticker, url, info?.cpSelectedNumber || 'Cloud Phone'), trans('o'))
    } else {
      const coin = tickerOfDyno[ticker]
      const redirect_url = `${SELF_URL}/dynopay/crypto-pay-phone`
      const meta_data = {
        "product_name": dynopayActions.payPhone,
        "refId": ref
      }
      const { qr_code, address } = await getDynopayCryptoAddress(price, coin, redirect_url, meta_data)
      if (!address) return send(chatId, t.errorFetchingCryptoAddress, trans('o'))
      set(chatIdOfDynopayPayment, ref, { chatId, price, cpData: { selectedNumber: info?.cpSelectedNumber, planKey: info?.cpPlanKey, provider: info?.cpProvider || 'telnyx', countryCode: info?.cpCountryCode || 'US', countryName: info?.cpCountryName || 'US' }, action: dynopayActions.payPhone, address })
      saveInfo('ref', ref)
      log({ ref })
      await generateQr(bot, chatId, qr_code, info?.userLanguage ?? 'en')
      set(state, chatId, 'action', 'none')
      const priceCrypto = await convert(price, 'usd', tickerOf[ticker])
      return send(chatId, t.showDepositCryptoInfoPhone(priceCrypto, ticker, address, info?.cpSelectedNumber || 'Cloud Phone'), trans('o'))
    }
  }

  // ── ADDRESS COLLECTION (for addrReq=any countries like AU, FI, etc.) ──
  if (action === a.cpEnterAddress) {
    const lang = info?.userLanguage ?? 'en'
    const addressInput = message.trim()

    // Parse: "Street, City, Country"
    const parts = addressInput.split(',').map(p => p.trim()).filter(Boolean)
    if (parts.length < 2) {
      return send(chatId, '⚠️ Please enter at least: <code>Street, City, Country</code>\n\nExample: <i>123 Main St, Sydney, Australia</i>', { parse_mode: 'HTML' })
    }

    const street = parts[0]
    const city = parts[1]
    const region = parts.length >= 4 ? parts[2] : ''
    const countryCode = info?.cpCountryCode || 'US'
    const customerName = await get(nameOf, chatId) || `User-${chatId}`

    send(chatId, phoneConfig.getMsg(lang).purchasingNumber)

    // Create Twilio Address
    const addrResult = await twilioService.createAddress(customerName, street, city, region, '', countryCode, null, null)
    if (addrResult.error) {
      log(`[CloudPhone] Address creation failed: ${addrResult.error}`)
      // Refund to wallet with duplicate protection
      const coin = info?.cpPendingCoin
      const priceUsd = info?.cpPendingPriceUsd
      const priceNgn = info?.cpPendingPriceNgn
      if (coin && priceUsd) {
        if (coin === u.usd) await atomicIncrement(walletOf, chatId, 'usdIn', priceUsd)
        else if (coin === u.ngn && priceNgn) await atomicIncrement(walletOf, chatId, 'ngnIn', priceNgn)
        // Clear pending to prevent duplicate refund
        await saveInfo('cpPendingCoin', null)
        await saveInfo('cpPendingPriceUsd', null)
        await saveInfo('cpPendingPriceNgn', null)
        const { usdBal: refUsd, ngnBal: refNgn } = await getBalance(walletOf, chatId)
        log(`[CloudPhone] Address failed for ${chatId}, refunded $${priceUsd} to wallet. Balance: $${refUsd}`)
        set(state, chatId, 'action', 'none')
        return send(chatId, `❌ Address creation failed.\n\n💰 <b>$${Number(priceUsd).toFixed(2)}</b> has been refunded to your wallet.\n${t.showWallet(refUsd, refNgn)}`, { parse_mode: 'HTML' })
      }
      set(state, chatId, 'action', 'none')
      return send(chatId, `❌ Address creation failed: ${addrResult.error}\nYour wallet has been refunded.`, { parse_mode: 'HTML' })
    }

    const addressSid = addrResult.sid

    // Cache address for future purchases in this country
    await cacheTwilioAddress(chatId, countryCode, addressSid)

    // Execute Twilio purchase via shared helper
    const selectedNumber = info?.cpSelectedNumber
    const planKey = info?.cpPlanKey
    const price = info?.cpPrice
    const countryName = info?.cpCountryName || ''
    const paymentMethod = info?.cpPaymentMethod || 'wallet'

    const result = await executeTwilioPurchase(chatId, selectedNumber, planKey, price, countryCode, countryName, info?.cpNumberType || 'local', paymentMethod, addressSid)
    if (result.error) {
      // Refund to wallet — only if not already refunded
      const coin = info?.cpPendingCoin
      const priceUsd = info?.cpPendingPriceUsd
      const priceNgn = info?.cpPendingPriceNgn
      if (coin && priceUsd) {
        if (coin === u.usd) await atomicIncrement(walletOf, chatId, 'usdIn', priceUsd)
        else if (coin === u.ngn && priceNgn) await atomicIncrement(walletOf, chatId, 'ngnIn', priceNgn)
        // Clear pending to prevent duplicate refund
        await saveInfo('cpPendingCoin', null)
        await saveInfo('cpPendingPriceUsd', null)
        await saveInfo('cpPendingPriceNgn', null)
        const { usdBal: refUsd, ngnBal: refNgn } = await getBalance(walletOf, chatId)
        log(`[CloudPhone] Twilio purchase failed for ${chatId}, refunded $${priceUsd} to wallet. Balance: $${refUsd}`)
        set(state, chatId, 'action', 'none')
        send(chatId, phoneConfig.getMsg(lang).purchaseFailed + `\n\n💰 <b>$${Number(priceUsd).toFixed(2)}</b> has been refunded to your wallet.\n${t.showWallet(refUsd, refNgn)}`, trans('o'))
      } else {
        set(state, chatId, 'action', 'none')
        send(chatId, phoneConfig.getMsg(lang).purchaseFailed + `\n${result.error}`, trans('o'))
      }
      return
    }

    set(state, chatId, 'action', 'none')
    const { usdBal: usd, ngnBal: ngn } = await getBalance(walletOf, chatId)
    send(chatId, phoneConfig.txt.purchaseSuccess(selectedNumber, result.plan, result.sipUsername, result.sipPassword, phoneConfig.SIP_DOMAIN, result.expiresAt), { parse_mode: 'HTML' })
    send(chatId, t.showWallet(usd, ngn))
    checkAndNotifyTierUpgrade(preSpend || 0)
    // Post-purchase upsell: guide user to set up their number
    setTimeout(() => {
      const pc = phoneConfig.btn
      send(chatId, `💡 <b>Get the most out of your number</b>\n\n📲 <b>Set up call forwarding</b> — ring your real phone\n🤖 <b>Add IVR greeting</b> — professional auto-attendant\n💬 <b>Enable SMS</b> — send & receive text messages\n\nTap Manage Numbers below to configure.`, k.of([[pc.myNumbers], [pc.back]]))
    }, 2000)
    return
  }

  // ── LEADS PAY (Crypto / Bank / Wallet for both Buy Leads & Validate Leads) ──
  if (action === 'leads-pay') {
    if (message === t.back) {
      const lastStep = info?.lastStep
      if (lastStep === a.validatorSelectFormat) return goto.validatorSelectFormat()
      if (info?.targetName) return goto.targetLeadsConfirm()
      return goto.buyLeadsSelectFormat()
    }
    const payOption = message
    if (payOption === payIn.crypto) {
      set(state, chatId, 'action', 'crypto-pay-leads')
      return send(chatId, t.selectCryptoToDeposit, trans('k.of', trans('supportedCryptoViewOf')))
    }
    if (payOption === payIn.bank) {
      set(state, chatId, 'action', 'bank-pay-leads')
      return send(chatId, t.askEmail, bc)
    }
    if (payOption === payIn.wallet) {
      return goto.walletSelectCurrency()
    }
    return send(chatId, t.askValidPayOption)
  }
  if (action === 'bank-pay-leads') {
    if (message === t.back) return goto['leads-pay']()
    const email = message
    const price = info?.couponApplied ? info?.newPrice : info?.price
    if (!isValidEmail(email)) return send(chatId, t.askValidEmail)
    const ref = nanoid()
    set(state, chatId, 'action', 'none')
    const priceNGN = Number(await usdToNgn(price))
    const lastStep = info?.lastStep
    set(chatIdOfPayment, ref, { chatId, price, lastStep, leadsData: { amount: info?.amount, country: info?.country, state: info?.stateName, area: info?.areaCode, carrier: info?.carrier, targetName: info?.targetName, couponApplied: info?.couponApplied, format: info?.format, cnamMode: info?.targetName ? true : info?.cnam }, endpoint: '/bank-pay-leads' })
    const { url, error } = await createCheckout(priceNGN, `/ok?a=b&ref=${ref}&`, email, username, ref)
    if (error) return send(chatId, error, trans('o'))
    const label = lastStep === a.validatorSelectFormat ? 'Phone Validation' : 'Phone Leads'
    return send(chatId, `${label} ₦${priceNGN.toLocaleString()}`, trans('payBank', url))
  }
  if (action === 'crypto-pay-leads') {
    if (message === t.back) return goto['leads-pay']()
    const tickerView = message
    const supportedCryptoView = trans('supportedCryptoView')
    const ticker = supportedCryptoView[tickerView]
    if (!ticker) return send(chatId, t.askValidCrypto)
    const price = info?.couponApplied ? info?.newPrice : info?.price
    const ref = nanoid()
    const lastStep = info?.lastStep
    const leadsData = { amount: info?.amount, country: info?.country, state: info?.stateName, area: info?.areaCode, carrier: info?.carrier, targetName: info?.targetName, couponApplied: info?.couponApplied, format: info?.format, cnamMode: info?.targetName ? true : info?.cnam }
    const label = lastStep === a.validatorSelectFormat ? 'Phone Validation' : 'Phone Leads'
    if (BLOCKBEE_CRYTPO_PAYMENT_ON === 'true') {
      const coin = tickerOf[ticker]
      set(chatIdOfPayment, ref, { chatId, price, lastStep, leadsData })
      const url = await generateBlockBeeAddress(price, coin, `${SELF_URL}/crypto-pay-leads?ref=${ref}`, { chatId, coin })
      if (!url) return send(chatId, t.cryptoPayError)
      await sendQrCode(bot, chatId, url, info?.userLanguage ?? 'en')
      set(state, chatId, 'action', 'none')
      const priceCrypto = await convert(price, 'usd', coin)
      return send(chatId, t.showDepositCryptoInfoLeads(priceCrypto, ticker, url, label), trans('o'))
    } else {
      const coin = tickerOfDyno[ticker]
      const redirect_url = `${SELF_URL}/dynopay/crypto-pay-leads`
      const meta_data = { "product_name": dynopayActions.payLeads, "refId": ref }
      const { qr_code, address } = await getDynopayCryptoAddress(price, coin, redirect_url, meta_data)
      if (!address) return send(chatId, t.errorFetchingCryptoAddress, trans('o'))
      set(chatIdOfDynopayPayment, ref, { chatId, price, lastStep, leadsData, action: dynopayActions.payLeads, address })
      saveInfo('ref', ref)
      log({ ref })
      await generateQr(bot, chatId, qr_code, info?.userLanguage ?? 'en')
      set(state, chatId, 'action', 'none')
      const priceCrypto = await convert(price, 'usd', tickerOf[ticker])
      return send(chatId, t.showDepositCryptoInfoLeads(priceCrypto, ticker, address, label), trans('o'))
    }
  }

  // Helper: Build feature-gated manage menu keyboard
  function buildManageMenu(num) {
    const pc = phoneConfig.btn
    const plan = num.plan || 'starter'
    const hasSms = num.capabilities?.sms !== false && num.features?.sms !== false
    const hasFax = num.capabilities?.fax === true
    const rows = []
    // Communication
    if (hasSms) {
      rows.push([pc.callForwarding, pc.smsSettings])
      rows.push([pc.smsInbox])
    } else {
      rows.push([pc.callForwarding])
    }
    if (phoneConfig.canAccessFeature(plan, 'voicemail')) rows.push([pc.voicemail])
    // SIP — always visible so users can find credentials (shows upgrade prompt if Starter)
    rows.push([pc.sipCredentials])
    // Advanced (plan-gated)
    if (phoneConfig.canAccessFeature(plan, 'callRecording')) rows.push([pc.callRecording])
    if (phoneConfig.canAccessFeature(plan, 'ivr')) rows.push([pc.ivrAutoAttendant])
    // Fax
    if (hasFax) rows.push(['📠 Fax Settings'])
    // Logs & Billing
    rows.push([pc.callSmsLogs])
    rows.push([pc.renewChangePlan, pc.releaseNumber])
    return rows
  }

  // ━━━ MY NUMBERS ━━━

  // Helper: Show SMS Inbox with CNAM lookups + pagination
  async function showSmsInbox(chatId, num, page = 1) {
    const pc = phoneConfig.btn
    const perPage = 5
    const cleanNum = num.phoneNumber.replace(/[^+\d]/g, '')

    // Query SMS logs
    const totalCount = await phoneLogs.countDocuments({ phoneNumber: cleanNum, type: 'sms', direction: 'inbound' })
    const totalPages = Math.max(1, Math.ceil(totalCount / perPage))
    const skip = (page - 1) * perPage
    const messages = await phoneLogs.find({ phoneNumber: cleanNum, type: 'sms', direction: 'inbound' })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(perPage)
      .toArray()

    if (!messages.length && page === 1) {
      return send(chatId, phoneConfig.txt.smsInboxEmpty, k.of([[pc.inboxRefresh]]))
    }

    // Batch CNAM lookup for sender numbers
    const uniqueFroms = [...new Set(messages.map(m => m.from).filter(Boolean))]
    let cnamResults = {}
    try {
      cnamResults = await batchLookupCnam(uniqueFroms)
    } catch (e) {
      log(`[SmsInbox] CNAM batch lookup error: ${e.message}`)
    }

    // Build inbox text
    let text = phoneConfig.txt.smsInboxHeader(num.phoneNumber, totalCount)
    messages.forEach((m, i) => {
      const senderName = cnamResults[m.from] || null
      const time = m.timestamp ? new Date(m.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'
      text += phoneConfig.txt.smsInboxEntry(skip + i + 1, m.from, senderName, m.body || '(no content)', time)
    })
    text += phoneConfig.txt.smsInboxFooter(page, totalPages)

    // Build pagination buttons
    const navBtns = []
    if (page > 1) navBtns.push(pc.inboxNewerPage)
    navBtns.push(pc.inboxRefresh)
    if (page < totalPages) navBtns.push(pc.inboxOlderPage)

    return send(chatId, text, k.of([navBtns, [pc.back]]))
  }
  if (action === a.cpMyNumbers) {
    const pc = phoneConfig.btn
    if (message === t.back || message === pc.back) return goto.submenu5()
    if (message === pc.buyAnother || message === pc.buyPhoneNumber) {
      set(state, chatId, 'action', a.cpSelectCountry)
      const countryBtns = phoneConfig.countries.map(c => c.name)
      const rows = []
      for (let i = 0; i < countryBtns.length; i += 2) rows.push(countryBtns.slice(i, i + 2))
      if (phoneConfig.moreCountries.length > 0) rows.push([pc.moreCountries])
      return send(chatId, phoneConfig.txt.selectCountry, k.of(rows))
    }
    const idx = parseInt(message) - 1
    const numbers = info?.cpNumbers || []
    if (isNaN(idx) || idx < 0 || idx >= numbers.length) return send(chatId, phoneConfig.getMsg(info?.userLanguage).selectByIndex)
    const num = numbers[idx]
    await saveInfo('cpActiveNumber', num)
    set(state, chatId, 'action', a.cpManageNumber)
    return send(chatId, phoneConfig.txt.manageNumber(num), k.of(buildManageMenu(num)))
  }

  // ━━━ MANAGE NUMBER ━━━
  if (action === a.cpManageNumber) {
    const pc = phoneConfig.btn
    const num = info?.cpActiveNumber
    if (!num) return goto.submenu5()
    if (message === t.back || message === pc.back) {
      // Go back to my numbers list
      const userData = await get(phoneNumbersOf, chatId)
      const numbers = (userData?.numbers || []).filter(n => n.status === 'active' || n.status === 'suspended')
      await saveInfo('cpNumbers', numbers)
      set(state, chatId, 'action', a.cpMyNumbers)
      const numBtns = numbers.map((_, i) => String(i + 1))
      return send(chatId, phoneConfig.txt.myNumbersList(numbers), k.of([numBtns, [pc.buyAnother]]))
    }

    // Call Forwarding
    if (message === pc.callForwarding) {
      set(state, chatId, 'action', a.cpCallForwarding)
      const fwd = num.features?.callForwarding || {}
      let walletBal = 0
      try { const { usdBal } = await getBalance(walletOf, chatId); walletBal = usdBal } catch (e) {}
      const holdLabel = fwd.holdMusic ? pc.holdMusicOn : pc.holdMusicOff
      const btns = fwd.enabled
        ? [[pc.alwaysForward], [pc.forwardBusy], [pc.forwardNoAnswer], [holdLabel], ['📲 Change Forward-To Number'], [pc.disableForwarding]]
        : [[pc.alwaysForward], [pc.forwardBusy], [pc.forwardNoAnswer]]
      return send(chatId, phoneConfig.txt.forwardingStatus(num.phoneNumber, fwd, walletBal), k.of(btns))
    }

    // SMS Settings
    if (message === pc.smsSettings) {
      set(state, chatId, 'action', a.cpSmsSettings)
      const smsConf = num.features?.smsForwarding || {}
      const tgLabel = `📲 SMS to Telegram ${smsConf.toTelegram !== false ? '✅ ON' : '❌ OFF'}`
      const smsBtns = [[tgLabel]]
      if (phoneConfig.canAccessFeature(num.plan, 'smsToEmail')) {
        const emLabel = `📧 SMS to Email ${smsConf.toEmail ? '✅ ' + smsConf.toEmail : '❌ OFF'}`
        smsBtns.push([emLabel])
      } else {
        smsBtns.push([`🔒 SMS to Email (Pro+)`])
      }
      if (phoneConfig.canAccessFeature(num.plan, 'smsWebhook')) {
        const whLabel = `🔗 Webhook URL ${smsConf.webhookUrl ? '✅ Set' : '❌ Not Set'}`
        smsBtns.push([whLabel])
      } else {
        smsBtns.push([`🔒 Webhook URL (Pro+)`])
      }
      return send(chatId, phoneConfig.txt.smsSettingsMenu(num.phoneNumber, smsConf, num.plan), k.of(smsBtns))
    }

    // SMS Inbox
    if (message === pc.smsInbox) {
      set(state, chatId, 'action', a.cpSmsInbox)
      await saveInfo('cpInboxPage', 1)
      return showSmsInbox(chatId, num, 1)
    }

    // Voicemail — Pro/Business only (gated by buildManageMenu, but double-check)
    if (message === pc.voicemail) {
      if (!phoneConfig.canAccessFeature(num.plan, 'voicemail')) {
        return send(chatId, phoneConfig.upgradeMessage('voicemail', num.plan), k.of(buildManageMenu(num)))
      }
      set(state, chatId, 'action', a.cpVoicemail)
      const vm = num.features?.voicemail || {}
      const btns = vm.enabled
        ? [['🔊 Greeting'],
           ['📲 VM to Telegram ' + (vm.forwardToTelegram !== false ? '✅ ON' : '❌ OFF')],
           ['📧 VM to Email ' + (vm.forwardToEmail ? '✅ ' + vm.forwardToEmail : '❌ OFF')],
           [`⏰ Ring Time: ${vm.ringTimeout || 25}s`],
           [pc.disableVoicemail]]
        : [[pc.enableVoicemail]]
      return send(chatId, phoneConfig.txt.voicemailMenu(num.phoneNumber, vm), k.of(btns))
    }

    // SIP Credentials — Pro/Business only
    if (message === pc.sipCredentials) {
      if (num.sipDisabled || !phoneConfig.canAccessFeature(num.plan, 'sipCredentials')) {
        return send(chatId, phoneConfig.upgradeMessage('sipCredentials', num.plan), k.of(buildManageMenu(num)))
      }
      set(state, chatId, 'action', a.cpSipCredentials)
      const numSipDomain = phoneConfig.getSipDomainForNumber()
      return send(chatId, phoneConfig.txt.sipCredentialsMsg(num.phoneNumber, num.sipUsername, numSipDomain), k.of([
        [pc.revealPassword], [pc.resetPassword], [pc.softphoneGuide]
      ]))
    }

    // Call Recording — Business only
    if (message === pc.callRecording) {
      if (!phoneConfig.canAccessFeature(num.plan, 'callRecording')) {
        return send(chatId, phoneConfig.upgradeMessage('callRecording', num.plan), k.of(buildManageMenu(num)))
      }
      set(state, chatId, 'action', a.cpCallRecording)
      const isEnabled = num.features?.recording === true
      return send(chatId, phoneConfig.txt.recordingMenu(num.phoneNumber, num.features), k.of(
        isEnabled ? [[pc.disableRecording]] : [[pc.enableRecording]]
      ))
    }

    // IVR / Auto-attendant — Business only
    if (message === pc.ivrAutoAttendant) {
      if (!phoneConfig.canAccessFeature(num.plan, 'ivr')) {
        return send(chatId, phoneConfig.upgradeMessage('ivr', num.plan), k.of(buildManageMenu(num)))
      }
      set(state, chatId, 'action', a.cpIvr)
      const ivrConf = num.features?.ivr || {}
      const btns = ivrConf.enabled
        ? [[pc.ivrGreeting], [pc.ivrAddOption], [pc.ivrRemoveOption], [pc.ivrViewOptions], [pc.ivrAnalytics], [pc.disableIvr]]
        : [[pc.enableIvr]]
      return send(chatId, phoneConfig.txt.ivrMenu(num.phoneNumber, ivrConf), k.of(btns))
    }

    // Fax Settings
    if (message === '📠 Fax Settings') {
      set(state, chatId, 'action', a.cpFaxSettings)
      const faxConf = num.features?.faxForwarding || { toTelegram: true }
      const provider = num.provider || 'telnyx'
      if (provider === 'twilio') {
        // Twilio deprecated fax — inform user
        return send(chatId, phoneConfig.txt.faxSettingsMenu(num.phoneNumber, faxConf, 'twilio'), k.of([]))
      }
      const tgLabel = `📲 Fax to Telegram ${faxConf.toTelegram !== false ? '✅ ON' : '❌ OFF'}`
      return send(chatId, phoneConfig.txt.faxSettingsMenu(num.phoneNumber, faxConf, provider), k.of([[tgLabel]]))
    }

    // Call & SMS Logs
    if (message === pc.callSmsLogs) {
      const logs = await phoneLogs.find({ phoneNumber: num.phoneNumber.replace(/[^+\d]/g, '') }).sort({ timestamp: -1 }).limit(15).toArray()
      let text = `📊 <b>Recent Activity</b> — ${phoneConfig.formatPhone(num.phoneNumber)}\n\n`
      if (!logs.length) {
        text += phoneConfig.getMsg(info?.userLanguage).noActivity
      } else {
        logs.forEach(l => {
          const time = phoneConfig.shortDate(l.timestamp)
          const from = phoneConfig.formatPhone(l.from || '?')
          if (l.type === 'sms') {
            const preview = (l.body || '').substring(0, 40)
            text += `📩 ${from} — "${preview}${l.body?.length > 40 ? '...' : ''}"\n   ${time}\n`
          } else if (l.type === 'voicemail') {
            text += `🎙️ ${from} — Voicemail ${phoneConfig.formatDuration(l.duration)}\n   ${time}\n`
          } else if (l.type === 'forwarded') {
            text += `📲 ${from} — Forwarded ${phoneConfig.formatDuration(l.duration)}\n   ${time}\n`
          } else if (l.type === 'missed') {
            text += `📞 ${from} — Missed Call\n   ${time}\n`
          } else if (l.type === 'call_recording') {
            text += `🔴 ${from} — Recorded ${phoneConfig.formatDuration(l.duration)}\n   ${time}\n`
          } else if (l.type === 'fax') {
            text += `📠 ${from} — Fax${l.pages ? ` (${l.pages} pages)` : ''}\n   ${time}\n`
          } else {
            text += `📞 ${from} — ${l.type || 'Call'} ${phoneConfig.formatDuration(l.duration)}\n   ${time}\n`
          }
        })
      }
      return send(chatId, text, k.of([]))
    }

    // Renew / Change Plan
    if (message === pc.renewChangePlan) {
      set(state, chatId, 'action', a.cpRenewPlan)
      const plan = phoneConfig.plans[num.plan] || { name: num.plan, price: num.planPrice }
      return send(chatId, phoneConfig.txt.renewMenu(num.phoneNumber, plan.name, num.planPrice, num.expiresAt, num.autoRenew), k.of([
        ['🔄 Renew Now ($' + num.planPrice + ')'],
        [pc.changePlan],
        ['🔁 Auto-Renew: ' + (num.autoRenew ? '✅ ON' : '❌ OFF')],
      ]))
    }

    // Release Number
    if (message === pc.releaseNumber) {
      set(state, chatId, 'action', a.cpReleaseConfirm)
      return send(chatId, phoneConfig.txt.releaseConfirm(num.phoneNumber), k.of([
        [pc.yesRelease, pc.noKeep]
      ]))
    }

    return send(chatId, phoneConfig.getMsg(info?.userLanguage).selectOption)
  }

  // ━━━ CALL FORWARDING ━━━
  if (action === a.cpCallForwarding) {
    const pc = phoneConfig.btn
    const num = info?.cpActiveNumber
    if (!num) return goto.submenu5()
    if (message === t.back || message === pc.back) {
      set(state, chatId, 'action', a.cpManageNumber)
      return send(chatId, phoneConfig.txt.manageNumber(num), k.of(buildManageMenu(num)))
    }
    if (message === pc.disableForwarding) {
      await updatePhoneNumberFeature(phoneNumbersOf, chatId, num.phoneNumber, 'callForwarding', { enabled: false, mode: 'disabled', forwardTo: null })
      num.features.callForwarding = { enabled: false, mode: 'disabled', forwardTo: null }
      await saveInfo('cpActiveNumber', num)
      send(chatId, phoneConfig.txt.forwardingDisabled(num.phoneNumber))
      set(state, chatId, 'action', a.cpManageNumber)
      return send(chatId, phoneConfig.txt.manageNumber(num), k.of(buildManageMenu(num)))
    }
    // ── Toggle Hold Music ──
    if (message === pc.holdMusicOn || message === pc.holdMusicOff) {
      const fwd = num.features?.callForwarding || {}
      const newState = !fwd.holdMusic
      await updatePhoneNumberFeature(phoneNumbersOf, chatId, num.phoneNumber, 'callForwarding', { ...fwd, holdMusic: newState })
      num.features.callForwarding = { ...fwd, holdMusic: newState }
      await saveInfo('cpActiveNumber', num)
      send(chatId, `🎵 Hold Music: <b>${newState ? 'ON' : 'OFF'}</b>\n${newState ? 'Callers will hear hold music while being connected.' : 'Callers will hear standard ringback tone.'}`, { parse_mode: 'HTML' })
      // Refresh menu
      let walletBal = 0
      try { const { usdBal } = await getBalance(walletOf, chatId); walletBal = usdBal } catch (e) {}
      const holdLabel = newState ? pc.holdMusicOn : pc.holdMusicOff
      const btns = [[pc.alwaysForward], [pc.forwardBusy], [pc.forwardNoAnswer], [holdLabel], ['📲 Change Forward-To Number'], [pc.disableForwarding]]
      return send(chatId, phoneConfig.txt.forwardingStatus(num.phoneNumber, num.features.callForwarding, walletBal), k.of(btns))
    }
    let mode = null
    if (message === pc.alwaysForward) mode = 'always'
    if (message === pc.forwardBusy) mode = 'busy'
    if (message === pc.forwardNoAnswer) mode = 'no_answer'
    if (message === '📲 Change Forward-To Number') mode = num.features?.callForwarding?.mode || 'always'
    if (mode) {
      await saveInfo('cpForwardMode', mode)
      // Check wallet balance before proceeding
      let walletBal = 0
      try {
        const { usdBal } = await getBalance(walletOf, chatId)
        walletBal = usdBal
      } catch (e) {}
      if (walletBal < phoneConfig.CALL_FORWARDING_RATE_MIN) {
        send(chatId, t.fwdInsufficientBalance(walletBal, phoneConfig.CALL_FORWARDING_RATE_MIN), { parse_mode: 'HTML' })
        set(state, chatId, 'action', a.cpManageNumber)
        return send(chatId, phoneConfig.txt.manageNumber(num), k.of(buildManageMenu(num)))
      }
      set(state, chatId, 'action', a.cpEnterForwardNumber)
      return send(chatId, t.fwdEnterNumber(phoneConfig.CALL_FORWARDING_RATE_MIN, walletBal), { parse_mode: 'HTML' })
    }
    return send(chatId, phoneConfig.getMsg(info?.userLanguage).selectForwardMode)
  }
  if (action === a.cpEnterForwardNumber) {
    const pc = phoneConfig.btn
    const num = info?.cpActiveNumber
    if (!num) return goto.submenu5()
    if (message === t.back || message === pc.back) {
      set(state, chatId, 'action', a.cpCallForwarding)
      const fwd = num.features?.callForwarding || {}
      let walletBal = 0
      try { const { usdBal } = await getBalance(walletOf, chatId); walletBal = usdBal } catch (e) {}
      const holdLabel = fwd.holdMusic ? pc.holdMusicOn : pc.holdMusicOff
      const btns = fwd.enabled
        ? [[pc.alwaysForward], [pc.forwardBusy], [pc.forwardNoAnswer], [holdLabel], ['📲 Change Forward-To Number'], [pc.disableForwarding]]
        : [[pc.alwaysForward], [pc.forwardBusy], [pc.forwardNoAnswer]]
      return send(chatId, phoneConfig.txt.forwardingStatus(num.phoneNumber, fwd, walletBal), k.of(btns))
    }
    const forwardTo = message.replace(/[^+\d]/g, '')
    if (!forwardTo || forwardTo.length < 7) return send(chatId, phoneConfig.getMsg(info?.userLanguage).enterValidPhone)

    // ── Block premium-rate prefixes ──
    if (phoneConfig.isBlockedPrefix(forwardTo)) {
      return send(chatId, t.fwdBlocked(forwardTo), { parse_mode: 'HTML' })
    }

    // ── Re-check wallet balance ──
    let walletBal = 0
    try { const { usdBal } = await getBalance(walletOf, chatId); walletBal = usdBal } catch (e) {}
    if (walletBal < phoneConfig.CALL_FORWARDING_RATE_MIN) {
      send(chatId, t.fwdInsufficientBalance(walletBal, phoneConfig.CALL_FORWARDING_RATE_MIN), { parse_mode: 'HTML' })
      set(state, chatId, 'action', a.cpManageNumber)
      return send(chatId, phoneConfig.txt.manageNumber(num), k.of(buildManageMenu(num)))
    }

    // ── Validate destination is routable via Telnyx ──
    send(chatId, t.fwdValidating)
    const validation = await telnyxApi.validateForwardingDestination(forwardTo)
    if (!validation.valid) {
      return send(chatId, t.fwdNotRoutable(forwardTo), { parse_mode: 'HTML' })
    }

    const mode = info?.cpForwardMode || 'always'
    const existingFwd = num.features?.callForwarding || {}
    await updatePhoneNumberFeature(phoneNumbersOf, chatId, num.phoneNumber, 'callForwarding', { enabled: true, mode, forwardTo, ringTimeout: 25, holdMusic: existingFwd.holdMusic || false })
    num.features.callForwarding = { enabled: true, mode, forwardTo, ringTimeout: 25, holdMusic: existingFwd.holdMusic || false }
    await saveInfo('cpActiveNumber', num)
    const modeLabel = mode === 'always' ? 'Always Forward' : mode === 'busy' ? 'Forward When Busy' : 'Forward If No Answer'
    send(chatId, phoneConfig.txt.forwardingUpdated(num.phoneNumber, forwardTo, modeLabel, walletBal), { parse_mode: 'HTML' })
    set(state, chatId, 'action', a.cpManageNumber)
    return send(chatId, phoneConfig.txt.manageNumber(num), k.of(buildManageMenu(num)))
  }

  // ━━━ SMS SETTINGS ━━━
  if (action === a.cpSmsSettings) {
    const pc = phoneConfig.btn
    const num = info?.cpActiveNumber
    if (!num) return goto.submenu5()
    if (message === t.back || message === pc.back) {
      set(state, chatId, 'action', a.cpManageNumber)
      return send(chatId, phoneConfig.txt.manageNumber(num), k.of(buildManageMenu(num)))
    }
    const smsConf = num.features?.smsForwarding || {}
    // Toggle Telegram
    if (message.startsWith('📲 SMS to Telegram')) {
      const newState = smsConf.toTelegram === false
      await updatePhoneNumberFeature(phoneNumbersOf, chatId, num.phoneNumber, 'smsForwarding', { ...smsConf, toTelegram: newState })
      num.features.smsForwarding = { ...smsConf, toTelegram: newState }
      await saveInfo('cpActiveNumber', num)
      send(chatId, phoneConfig.txt.smsToggled('📲 SMS to Telegram', newState))
      const tgLabel = `📲 SMS to Telegram ${newState ? '✅ ON' : '❌ OFF'}`
      const smsBtns = [[tgLabel]]
      if (phoneConfig.canAccessFeature(num.plan, 'smsToEmail')) {
        smsBtns.push([`📧 SMS to Email ${smsConf.toEmail ? '✅ ' + smsConf.toEmail : '❌ OFF'}`])
      } else {
        smsBtns.push([`🔒 SMS to Email (Pro+)`])
      }
      if (phoneConfig.canAccessFeature(num.plan, 'smsWebhook')) {
        smsBtns.push([`🔗 Webhook URL ${smsConf.webhookUrl ? '✅ Set' : '❌ Not Set'}`])
      } else {
        smsBtns.push([`🔒 Webhook URL (Pro+)`])
      }
      return send(chatId, phoneConfig.txt.smsSettingsMenu(num.phoneNumber, { ...smsConf, toTelegram: newState }, num.plan), k.of(smsBtns))
    }
    // Locked features — show upgrade message
    if (message.startsWith('🔒 SMS to Email')) {
      return send(chatId, phoneConfig.upgradeMessage('smsToEmail', num.plan))
    }
    if (message.startsWith('🔒 Webhook URL')) {
      return send(chatId, phoneConfig.upgradeMessage('smsWebhook', num.plan))
    }
    // Email (gated)
    if (message.startsWith('📧 SMS to Email')) {
      if (!phoneConfig.canAccessFeature(num.plan, 'smsToEmail')) {
        return send(chatId, phoneConfig.upgradeMessage('smsToEmail', num.plan))
      }
      set(state, chatId, 'action', a.cpEnterEmail)
      return send(chatId, phoneConfig.txt.enterEmail)
    }
    // Webhook (gated)
    if (message.startsWith('🔗 Webhook URL')) {
      if (!phoneConfig.canAccessFeature(num.plan, 'smsWebhook')) {
        return send(chatId, phoneConfig.upgradeMessage('smsWebhook', num.plan))
      }
      set(state, chatId, 'action', a.cpEnterWebhook)
      return send(chatId, phoneConfig.txt.enterWebhook)
    }
    return send(chatId, phoneConfig.getMsg(info?.userLanguage).selectOption)
  }
  if (action === a.cpEnterEmail) {
    const pc = phoneConfig.btn
    const num = info?.cpActiveNumber
    if (!num) return goto.submenu5()
    if (message === t.back || message === pc.back) {
      set(state, chatId, 'action', a.cpSmsSettings)
      const smsConf = num.features?.smsForwarding || {}
      const tgLabel = `📲 SMS to Telegram ${smsConf.toTelegram !== false ? '✅ ON' : '❌ OFF'}`
      const emLabel = `📧 SMS to Email ${smsConf.toEmail ? '✅ ' + smsConf.toEmail : '❌ OFF'}`
      const whLabel = `🔗 Webhook URL ${smsConf.webhookUrl ? '✅ Set' : '❌ Not Set'}`
      return send(chatId, phoneConfig.txt.smsSettingsMenu(num.phoneNumber, smsConf), k.of([[tgLabel], [emLabel], [whLabel]]))
    }
    if (!isValidEmail(message)) return send(chatId, phoneConfig.getMsg(info?.userLanguage).enterValidEmail)
    const smsConf = num.features?.smsForwarding || {}
    await updatePhoneNumberFeature(phoneNumbersOf, chatId, num.phoneNumber, 'smsForwarding', { ...smsConf, toEmail: message })
    num.features.smsForwarding = { ...smsConf, toEmail: message }
    await saveInfo('cpActiveNumber', num)
    send(chatId, phoneConfig.txt.emailSet(message))
    set(state, chatId, 'action', a.cpManageNumber)
    return send(chatId, phoneConfig.txt.manageNumber(num), k.of(buildManageMenu(num)))
  }
  if (action === a.cpEnterWebhook) {
    const pc = phoneConfig.btn
    const num = info?.cpActiveNumber
    if (!num) return goto.submenu5()
    if (message === t.back || message === pc.back) {
      set(state, chatId, 'action', a.cpSmsSettings)
      const smsConf = num.features?.smsForwarding || {}
      const tgLabel = `📲 SMS to Telegram ${smsConf.toTelegram !== false ? '✅ ON' : '❌ OFF'}`
      const emLabel = `📧 SMS to Email ${smsConf.toEmail ? '✅ ' + smsConf.toEmail : '❌ OFF'}`
      const whLabel = `🔗 Webhook URL ${smsConf.webhookUrl ? '✅ Set' : '❌ Not Set'}`
      return send(chatId, phoneConfig.txt.smsSettingsMenu(num.phoneNumber, smsConf), k.of([[tgLabel], [emLabel], [whLabel]]))
    }
    if (!message.startsWith('http')) return send(chatId, 'Enter a valid URL starting with http:// or https://.')
    const smsConf = num.features?.smsForwarding || {}
    await updatePhoneNumberFeature(phoneNumbersOf, chatId, num.phoneNumber, 'smsForwarding', { ...smsConf, webhookUrl: message })
    num.features.smsForwarding = { ...smsConf, webhookUrl: message }
    await saveInfo('cpActiveNumber', num)
    send(chatId, phoneConfig.txt.webhookSet(message))
    set(state, chatId, 'action', a.cpManageNumber)
    return send(chatId, phoneConfig.txt.manageNumber(num), k.of(buildManageMenu(num)))
  }

  // ━━━ SMS INBOX ━━━
  if (action === a.cpSmsInbox) {
    const pc = phoneConfig.btn
    const num = info?.cpActiveNumber
    if (!num) return goto.submenu5()
    if (message === t.back || message === pc.back) {
      set(state, chatId, 'action', a.cpManageNumber)
      return send(chatId, phoneConfig.txt.manageNumber(num), k.of(buildManageMenu(num)))
    }
    if (message === pc.inboxRefresh) {
      await saveInfo('cpInboxPage', 1)
      return showSmsInbox(chatId, num, 1)
    }
    if (message === pc.inboxOlderPage) {
      const page = (info?.cpInboxPage || 1) + 1
      await saveInfo('cpInboxPage', page)
      return showSmsInbox(chatId, num, page)
    }
    if (message === pc.inboxNewerPage) {
      const page = Math.max(1, (info?.cpInboxPage || 1) - 1)
      await saveInfo('cpInboxPage', page)
      return showSmsInbox(chatId, num, page)
    }
    return send(chatId, phoneConfig.getMsg(info?.userLanguage).selectOption)
  }

  // ━━━ FAX SETTINGS ━━━
  if (action === a.cpFaxSettings) {
    const pc = phoneConfig.btn
    const num = info?.cpActiveNumber
    if (!num) return goto.submenu5()
    if (message === t.back || message === pc.back) {
      set(state, chatId, 'action', a.cpManageNumber)
      return send(chatId, phoneConfig.txt.manageNumber(num), k.of(buildManageMenu(num)))
    }
    const faxConf = num.features?.faxForwarding || { toTelegram: true }
    // Toggle Telegram forwarding
    if (message.startsWith('📲 Fax to Telegram')) {
      const newState = faxConf.toTelegram === false
      await updatePhoneNumberFeature(phoneNumbersOf, chatId, num.phoneNumber, 'faxForwarding', { ...faxConf, toTelegram: newState })
      num.features = num.features || {}
      num.features.faxForwarding = { ...faxConf, toTelegram: newState }
      await saveInfo('cpActiveNumber', num)
      send(chatId, phoneConfig.txt.faxToggled(newState))
      const tgLabel = `📲 Fax to Telegram ${newState ? '✅ ON' : '❌ OFF'}`
      return send(chatId, phoneConfig.txt.faxSettingsMenu(num.phoneNumber, { ...faxConf, toTelegram: newState }, num.provider || 'telnyx'), k.of([[tgLabel]]))
    }
    return send(chatId, phoneConfig.getMsg(info?.userLanguage).selectOption)
  }

  // ━━━ VOICEMAIL ━━━
  if (action === a.cpVoicemail) {
    const pc = phoneConfig.btn
    const num = info?.cpActiveNumber
    if (!num) return goto.submenu5()
    if (message === t.back || message === pc.back) {
      set(state, chatId, 'action', a.cpManageNumber)
      return send(chatId, phoneConfig.txt.manageNumber(num), k.of(buildManageMenu(num)))
    }
    if (message === pc.enableVoicemail) {
      await updatePhoneNumberFeature(phoneNumbersOf, chatId, num.phoneNumber, 'voicemail', { enabled: true, greetingType: 'default', forwardToTelegram: true, forwardToEmail: null, ringTimeout: 25 })
      num.features.voicemail = { enabled: true, greetingType: 'default', forwardToTelegram: true, forwardToEmail: null, ringTimeout: 25 }
      await saveInfo('cpActiveNumber', num)
      send(chatId, phoneConfig.txt.voicemailEnabled(num.phoneNumber))
      set(state, chatId, 'action', a.cpManageNumber)
      return send(chatId, phoneConfig.txt.manageNumber(num), k.of(buildManageMenu(num)))
    }
    if (message === pc.disableVoicemail) {
      await updatePhoneNumberFeature(phoneNumbersOf, chatId, num.phoneNumber, 'voicemail', { enabled: false })
      num.features.voicemail = { enabled: false }
      await saveInfo('cpActiveNumber', num)
      send(chatId, phoneConfig.txt.voicemailDisabled(num.phoneNumber))
      set(state, chatId, 'action', a.cpManageNumber)
      return send(chatId, phoneConfig.txt.manageNumber(num), k.of(buildManageMenu(num)))
    }
    // Greeting management
    if (message === pc.vmGreeting || message === '🔊 Greeting') {
      set(state, chatId, 'action', a.cpVmGreeting)
      const vm = num.features?.voicemail || {}
      return send(chatId, phoneConfig.txt.vmGreetingMenu(num.phoneNumber, vm), k.of([
        [pc.vmCustomGreeting],
        [pc.vmDefaultGreeting],
        [pc.back]
      ]))
    }
    // Toggle VM to Telegram
    if (message.startsWith('📲 VM to Telegram')) {
      const vm = num.features?.voicemail || {}
      const newState = vm.forwardToTelegram === false
      await updatePhoneNumberFeature(phoneNumbersOf, chatId, num.phoneNumber, 'voicemail', { ...vm, forwardToTelegram: newState })
      num.features.voicemail = { ...vm, forwardToTelegram: newState }
      await saveInfo('cpActiveNumber', num)
      send(chatId, phoneConfig.getMsg(info?.userLanguage).vmTelegramToggled(newState))
    }
    // Ring time
    if (message.startsWith('⏰ Ring Time')) {
      return send(chatId, 'How long should the phone ring before voicemail?', k.of([['15s', '20s', '25s', '30s']]))
    }
    const ringMatch = message.match(/^(\d+)s$/)
    if (ringMatch) {
      const seconds = parseInt(ringMatch[1])
      const vm = num.features?.voicemail || {}
      await updatePhoneNumberFeature(phoneNumbersOf, chatId, num.phoneNumber, 'voicemail', { ...vm, ringTimeout: seconds })
      num.features.voicemail = { ...vm, ringTimeout: seconds }
      await saveInfo('cpActiveNumber', num)
      send(chatId, phoneConfig.getMsg(info?.userLanguage).ringTimeUpdated(seconds))
      set(state, chatId, 'action', a.cpManageNumber)
      return send(chatId, phoneConfig.txt.manageNumber(num), k.of(buildManageMenu(num)))
    }
    return send(chatId, phoneConfig.getMsg(info?.userLanguage).selectOption)
  }

  // ━━━ VOICEMAIL GREETING ━━━
  if (action === a.cpVmGreeting) {
    const pc = phoneConfig.btn
    const num = info?.cpActiveNumber
    if (!num) return goto.submenu5()
    if (message === t.back || message === pc.back || message === t.cancel) {
      set(state, chatId, 'action', a.cpVoicemail)
      const vm = num.features?.voicemail || {}
      const btns = vm.enabled
        ? [['🔊 Greeting'],
           ['📲 VM to Telegram ' + (vm.forwardToTelegram !== false ? '✅ ON' : '❌ OFF')],
           ['📧 VM to Email ' + (vm.forwardToEmail ? '✅ ' + vm.forwardToEmail : '❌ OFF')],
           [`⏰ Ring Time: ${vm.ringTimeout || 25}s`],
           [pc.disableVoicemail]]
        : [[pc.enableVoicemail]]
      return send(chatId, phoneConfig.txt.voicemailMenu(num.phoneNumber, vm), k.of(btns))
    }
    if (message === pc.vmCustomGreeting) {
      set(state, chatId, 'action', a.cpVmAudioUpload)
      await saveInfo('cpTtsDraft', { type: 'vmGreeting' })
      return send(chatId, `🎤 <b>Custom Greeting</b>\n\nChoose how to create your greeting:`, k.of([
        ['📋 Use Template'],
        ['📝 Type Text (AI Voice)'],
        ['🎙️ Upload Audio'],
      ]))
    }
    if (message === pc.vmDefaultGreeting) {
      const vm = num.features?.voicemail || {}
      vm.greetingType = 'default'
      vm.customAudioGreetingUrl = null
      vm.customGreetingText = null
      await updatePhoneNumberFeature(phoneNumbersOf, chatId, num.phoneNumber, 'voicemail', vm)
      num.features.voicemail = vm
      await saveInfo('cpActiveNumber', num)
      send(chatId, `✅ Default greeting restored.`)
      set(state, chatId, 'action', a.cpVoicemail)
      const btns = [['🔊 Greeting'],
           ['📲 VM to Telegram ' + (vm.forwardToTelegram !== false ? '✅ ON' : '❌ OFF')],
           ['📧 VM to Email ' + (vm.forwardToEmail ? '✅ ' + vm.forwardToEmail : '❌ OFF')],
           [`⏰ Ring Time: ${vm.ringTimeout || 25}s`],
           [pc.disableVoicemail]]
      return send(chatId, phoneConfig.txt.voicemailMenu(num.phoneNumber, vm), k.of(btns))
    }
    return send(chatId, phoneConfig.txt.vmGreetingMenu(num.phoneNumber, num.features?.voicemail || {}), k.of([
      [pc.vmCustomGreeting], [pc.vmDefaultGreeting],
    ]))
  }

  // ━━━ VOICEMAIL CUSTOM GREETING (TTS / Upload / Template) ━━━
  if (action === a.cpVmAudioUpload) {
    const pc = phoneConfig.btn
    const num = info?.cpActiveNumber
    if (!num) return goto.submenu5()
    if (message === t.back || message === pc.back || message === t.cancel) {
      set(state, chatId, 'action', a.cpVmGreeting)
      return send(chatId, phoneConfig.txt.vmGreetingMenu(num.phoneNumber, num.features?.voicemail || {}), k.of([
        [pc.vmCustomGreeting], [pc.vmDefaultGreeting],
      ]))
    }
    const draft = info?.cpTtsDraft || {}
    if (message === '📝 Type Text (AI Voice)') {
      draft.method = 'tts'
      await saveInfo('cpTtsDraft', draft)
      set(state, chatId, 'action', a.cpVmGreetingVoice)
      return send(chatId, `📝 Type the greeting callers will hear:`, k.of([]))
    }
    if (message === '🎙️ Upload Audio') {
      draft.method = 'upload'
      await saveInfo('cpTtsDraft', draft)
      set(state, chatId, 'action', a.cpVmGreetingPreview)
      return send(chatId, `🎙️ Send a voice message or audio file.`, k.of([]))
    }
    if (message === '📋 Use Template') {
      set(state, chatId, 'action', a.cpVmTemplate)
      draft.method = 'template'
      await saveInfo('cpTtsDraft', draft)
      const catBtns = ttsService.getTemplateCategoryButtons().map(b => [b])
      return send(chatId, `📋 <b>Greeting Templates</b>\n\nProfessional templates for voicemail, customer support, financial institutions, and more. Select a category:`, k.of(catBtns))
    }
    if (msg?.voice || msg?.audio) {
      const fileId = msg.voice?.file_id || msg.audio?.file_id
      try {
        const localPath = await ttsService.downloadTelegramAudio(bot, fileId, 'vm_greeting')
        draft.audioPath = localPath
        draft.method = 'uploaded'
        await saveInfo('cpTtsDraft', draft)
        await bot.sendVoice(chatId, localPath)
        set(state, chatId, 'action', a.cpVmGreetingPreview)
        return send(chatId, `✅ Audio received. Save as greeting?`, k.of([['✅ Save Greeting'], ['🎙️ Re-upload']]))
      } catch (e) {
        return send(chatId, `❌ Failed. Try again.`, k.of([]))
      }
    }
    return send(chatId, `Choose:`, k.of([['📋 Use Template'], ['📝 Type Text (AI Voice)'], ['🎙️ Upload Audio']]))
  }

  // ── VM Template: Select category → select template → edit → proceed ──
  if (action === a.cpVmTemplate) {
    const pc = phoneConfig.btn
    const num = info?.cpActiveNumber
    if (!num) return goto.submenu5()
    if (message === t.back || message === pc.back || message === t.cancel) {
      set(state, chatId, 'action', a.cpVmAudioUpload)
      return send(chatId, `🎤 <b>Custom Greeting</b>\n\nChoose how to create your greeting:`, k.of([
        ['📋 Use Template'], ['📝 Type Text (AI Voice)'], ['🎙️ Upload Audio'],
      ]))
    }
    const draft = info?.cpTtsDraft || {}
    // Step 1: User selects a category
    if (!draft.templateCategory) {
      const catKey = ttsService.getCategoryByButton(message)
      if (!catKey) {
        const catBtns = ttsService.getTemplateCategoryButtons().map(b => [b])
        return send(chatId, `📋 Select a template category:`, k.of(catBtns))
      }
      draft.templateCategory = catKey
      await saveInfo('cpTtsDraft', draft)
      const tplBtns = ttsService.getTemplateButtons(catKey).map(b => [b])
      return send(chatId, `📋 <b>${message}</b>\n\nSelect a greeting template:`, k.of(tplBtns))
    }
    // Step 2: User selects a specific template
    const tpl = ttsService.getTemplateByButton(draft.templateCategory, message)
    if (!tpl) {
      const tplBtns = ttsService.getTemplateButtons(draft.templateCategory).map(b => [b])
      return send(chatId, `Select a template:`, k.of(tplBtns))
    }
    draft.templateKey = tpl.key
    draft.text = tpl.text
    await saveInfo('cpTtsDraft', draft)
    set(state, chatId, 'action', a.cpVmTemplateEdit)
    return send(chatId, `📋 <b>${tpl.icon} ${tpl.name}</b>\n\n<code>${tpl.text}</code>\n\n✏️ You can edit this text — just type your modified version below.\nOr tap <b>✅ Use As-Is</b> to proceed with this greeting.`, k.of([['✅ Use As-Is']]))
  }

  // ── VM Template: Edit text then proceed to language → voice ──
  if (action === a.cpVmTemplateEdit) {
    const pc = phoneConfig.btn
    const num = info?.cpActiveNumber
    if (!num) return goto.submenu5()
    if (message === t.back || message === pc.back || message === t.cancel) {
      const draft = info?.cpTtsDraft || {}
      draft.templateCategory = null
      draft.templateKey = null
      draft.text = null
      await saveInfo('cpTtsDraft', draft)
      set(state, chatId, 'action', a.cpVmTemplate)
      const catBtns = ttsService.getTemplateCategoryButtons().map(b => [b])
      return send(chatId, `📋 <b>Greeting Templates</b>\n\nSelect a category:`, k.of(catBtns))
    }
    const draft = info?.cpTtsDraft || {}
    if (message === '✅ Use As-Is') {
      // Proceed to language selection with template text
      draft.lang = null
      draft.voice = null
      await saveInfo('cpTtsDraft', draft)
      set(state, chatId, 'action', a.cpVmGreetingVoice)
      const langBtns = ttsService.getLanguageButtons()
      const langRows = []
      for (let i = 0; i < langBtns.length; i += 2) langRows.push(langBtns.slice(i, i + 2))
      return send(chatId, `🌐 Select the language for your voicemail greeting:\n\n<i>The template will be automatically translated to your chosen language.</i>`, k.of(langRows))
    }
    // User typed modified text
    draft.text = message
    draft.lang = null
    draft.voice = null
    await saveInfo('cpTtsDraft', draft)
    set(state, chatId, 'action', a.cpVmGreetingVoice)
    const langBtns = ttsService.getLanguageButtons()
    const langRows = []
    for (let i = 0; i < langBtns.length; i += 2) langRows.push(langBtns.slice(i, i + 2))
    return send(chatId, `✅ Text updated.\n\n🌐 Select the language for your voicemail greeting:\n\n<i>The greeting will be automatically translated to your chosen language.</i>`, k.of(langRows))
  }

  // ━━━ VM GREETING: Text → Language → Provider → Voice selection ━━━
  if (action === a.cpVmGreetingVoice) {
    const pc = phoneConfig.btn
    const num = info?.cpActiveNumber
    if (!num) return goto.submenu5()
    if (message === t.back || message === pc.back || message === t.cancel) {
      set(state, chatId, 'action', a.cpVmAudioUpload)
      return send(chatId, `🎤 <b>Custom Greeting</b>\n\nChoose:`, k.of([['📋 Use Template'], ['📝 Type Text (AI Voice)'], ['🎙️ Upload Audio']]))
    }
    const draft = info?.cpTtsDraft || {}
    // Step 3: Voice selected → generate TTS
    if (draft.text && draft.lang && draft.ttsProvider && !draft.voice) {
      const voiceKey = ttsService.getVoiceKeyByButton(message, draft.lang)
      draft.voice = voiceKey
      await saveInfo('cpTtsDraft', draft)
      send(chatId, '🔄 Generating audio preview...')
      try {
        const result = await ttsService.generateTTS(draft.text, voiceKey, draft.lang)
        draft.audioPath = result.audioPath
        draft.audioUrl = result.audioUrl
        await saveInfo('cpTtsDraft', draft)
        await bot.sendVoice(chatId, result.audioPath)
        set(state, chatId, 'action', a.cpVmGreetingPreview)
        return send(chatId, `✅ Preview (${result.voice})\n\nSave this greeting?`, k.of([
          ['✅ Save Greeting'], ['🔄 Try Different Voice'], ['🌐 Change Language'], ['📝 Re-type Text'],
        ]))
      } catch (e) {
        log(`[TTS] Error: ${e.message}`)
        return send(chatId, `❌ Audio generation failed: ${e.message}`, k.of([['📋 Use Template'], ['📝 Type Text (AI Voice)'], ['🎙️ Upload Audio']]))
      }
    }
    // Step 2: Provider selected → show voices
    if (draft.text && draft.lang && !draft.ttsProvider) {
      const providerKey = ttsService.getProviderByButton(message)
      if (providerKey) {
        draft.ttsProvider = providerKey
        await saveInfo('cpTtsDraft', draft)
        const voiceBtns = ttsService.getVoiceButtons(draft.lang, providerKey).map(v => [v])
        if (draft.lang !== 'en' && draft.translatedText) {
          return send(chatId, `🌐 <b>Translated greeting:</b>\n\n<i>${draft.translatedText.length > 300 ? draft.translatedText.slice(0, 300) + '...' : draft.translatedText}</i>\n\n🎙️ Choose a voice:`, k.of(voiceBtns))
        }
        return send(chatId, `🎙️ Choose a voice:`, k.of(voiceBtns))
      }
      const providerBtns = ttsService.getProviderButtons().map(b => [b])
      return send(chatId, `🎙 Select a voice provider:`, k.of(providerBtns))
    }
    // Step 1: Language selected → show provider selection
    if (draft.text && !draft.lang) {
      const langCode = ttsService.getLanguageByButton(message)
      if (langCode) {
        // Translate if non-English
        if (langCode !== 'en') {
          send(chatId, `🌐 Translating to ${message}...`)
          const translated = await ttsService.translateText(draft.text, langCode)
          draft.translatedText = translated
          draft.originalText = draft.text
          draft.text = translated
        }
        draft.lang = langCode
        draft.ttsProvider = null
        await saveInfo('cpTtsDraft', draft)
        const providerBtns = ttsService.getProviderButtons().map(b => [b])
        return send(chatId, `🎙 <b>Select Voice Provider</b>\n\nChoose your TTS engine:`, k.of(providerBtns))
      }
      const langBtns = ttsService.getLanguageButtons()
      const langRows = []
      for (let i = 0; i < langBtns.length; i += 2) langRows.push(langBtns.slice(i, i + 2))
      return send(chatId, `🌐 Select the language for your greeting:`, k.of(langRows))
    }
    const vmButtons = [pc.vmCustomGreeting, pc.vmDefaultGreeting, pc.enableVoicemail, pc.disableVoicemail]
    if (vmButtons.includes(message)) return send(chatId, `📝 Type the greeting text:`, k.of([]))
    draft.text = message
    draft.lang = null
    draft.voice = null
    draft.ttsProvider = null
    await saveInfo('cpTtsDraft', draft)
    const langBtns = ttsService.getLanguageButtons()
    const langRows = []
    for (let i = 0; i < langBtns.length; i += 2) langRows.push(langBtns.slice(i, i + 2))
    return send(chatId, `🌐 Select the language for your greeting:\n\n<i>"${message.length > 80 ? message.slice(0, 80) + '...' : message}"</i>`, k.of(langRows))
  }

  // ━━━ VM GREETING: Preview & Save ━━━
  if (action === a.cpVmGreetingPreview) {
    const pc = phoneConfig.btn
    const num = info?.cpActiveNumber
    if (!num) return goto.submenu5()
    if (message === t.back || message === pc.back || message === t.cancel) {
      set(state, chatId, 'action', a.cpVmGreeting)
      return send(chatId, phoneConfig.txt.vmGreetingMenu(num.phoneNumber, num.features?.voicemail || {}), k.of([
        [pc.vmCustomGreeting], [pc.vmDefaultGreeting],
      ]))
    }
    const draft = info?.cpTtsDraft || {}
    if (message === '🔄 Try Different Voice') {
      draft.voice = null; draft.audioPath = null; draft.ttsProvider = null
      await saveInfo('cpTtsDraft', draft)
      set(state, chatId, 'action', a.cpVmGreetingVoice)
      const providerBtns = ttsService.getProviderButtons().map(b => [b])
      return send(chatId, `🎙 <b>Select Voice Provider</b>\n\nChoose your TTS engine:`, k.of(providerBtns))
    }
    if (message === '🌐 Change Language') {
      draft.lang = null; draft.voice = null; draft.audioPath = null; draft.ttsProvider = null
      await saveInfo('cpTtsDraft', draft)
      set(state, chatId, 'action', a.cpVmGreetingVoice)
      const langBtns = ttsService.getLanguageButtons()
      const langRows = []
      for (let i = 0; i < langBtns.length; i += 2) langRows.push(langBtns.slice(i, i + 2))
      return send(chatId, `🌐 Select the language for your greeting:`, k.of(langRows))
    }
    if (message === '📝 Re-type Text') {
      draft.text = null; draft.voice = null; draft.audioPath = null
      await saveInfo('cpTtsDraft', draft)
      set(state, chatId, 'action', a.cpVmGreetingVoice)
      return send(chatId, `📝 Type the greeting text:`, k.of([]))
    }
    if (message === '🎙️ Re-upload') {
      draft.audioPath = null; draft.method = 'upload'
      await saveInfo('cpTtsDraft', draft)
      return send(chatId, `🎙️ Send a voice message or audio file.`, k.of([]))
    }
    if (msg?.voice || msg?.audio) {
      const fileId = msg.voice?.file_id || msg.audio?.file_id
      try {
        const localPath = await ttsService.downloadTelegramAudio(bot, fileId, 'vm_greeting')
        draft.audioPath = localPath; draft.method = 'uploaded'
        await saveInfo('cpTtsDraft', draft)
        await bot.sendVoice(chatId, localPath)
        return send(chatId, `✅ Audio received. Save?`, k.of([['✅ Save Greeting'], ['🎙️ Re-upload']]))
      } catch (e) {
        return send(chatId, `❌ Failed. Try again.`, k.of([]))
      }
    }
    if (message === '✅ Save Greeting') {
      const vm = num.features?.voicemail || {}
      vm.greetingType = 'custom'
      if (draft.audioPath) {
        vm.customAudioGreetingUrl = draft.audioUrl || draft.audioPath
        vm.customGreetingText = draft.text || null
        vm.greetingVoice = draft.voice || null
      } else if (draft.text) {
        vm.customGreetingText = draft.text
        vm.customAudioGreetingUrl = null
      }
      await updatePhoneNumberFeature(phoneNumbersOf, chatId, num.phoneNumber, 'voicemail', vm)
      num.features.voicemail = vm
      await saveInfo('cpActiveNumber', num)
      await saveInfo('cpTtsDraft', null)
      send(chatId, `✅ Voicemail greeting saved!`)
      set(state, chatId, 'action', a.cpVoicemail)
      const btns = [['🔊 Greeting'],
           ['📲 VM to Telegram ' + (vm.forwardToTelegram !== false ? '✅ ON' : '❌ OFF')],
           ['📧 VM to Email ' + (vm.forwardToEmail ? '✅ ' + vm.forwardToEmail : '❌ OFF')],
           [`⏰ Ring Time: ${vm.ringTimeout || 25}s`],
           [pc.disableVoicemail]]
      return send(chatId, phoneConfig.txt.voicemailMenu(num.phoneNumber, vm), k.of(btns))
    }
    return send(chatId, `Choose:`, k.of([['✅ Save Greeting'], ['🔄 Try Different Voice'], ['📝 Re-type Text']]))
  }

  // ━━━ CALL RECORDING (Business) ━━━
  if (action === a.cpCallRecording) {
    const pc = phoneConfig.btn
    const num = info?.cpActiveNumber
    if (!num) return goto.submenu5()
    if (message === t.back || message === pc.back) {
      set(state, chatId, 'action', a.cpManageNumber)
      return send(chatId, phoneConfig.txt.manageNumber(num), k.of(buildManageMenu(num)))
    }
    if (message === pc.enableRecording) {
      await updatePhoneNumberFeature(phoneNumbersOf, chatId, num.phoneNumber, 'recording', true)
      num.features = num.features || {}
      num.features.recording = true
      await saveInfo('cpActiveNumber', num)
      send(chatId, phoneConfig.txt.recordingEnabled(num.phoneNumber))
      set(state, chatId, 'action', a.cpManageNumber)
      return send(chatId, phoneConfig.txt.manageNumber(num), k.of(buildManageMenu(num)))
    }
    if (message === pc.disableRecording) {
      await updatePhoneNumberFeature(phoneNumbersOf, chatId, num.phoneNumber, 'recording', false)
      num.features = num.features || {}
      num.features.recording = false
      await saveInfo('cpActiveNumber', num)
      send(chatId, phoneConfig.txt.recordingDisabled(num.phoneNumber))
      set(state, chatId, 'action', a.cpManageNumber)
      return send(chatId, phoneConfig.txt.manageNumber(num), k.of(buildManageMenu(num)))
    }
    return send(chatId, phoneConfig.getMsg(info?.userLanguage).selectOption)
  }

  // ━━━ IVR / AUTO-ATTENDANT (Business) ━━━
  if (action === a.cpIvr) {
    const pc = phoneConfig.btn
    const num = info?.cpActiveNumber
    if (!num) return goto.submenu5()
    if (message === t.back || message === pc.back) {
      set(state, chatId, 'action', a.cpManageNumber)
      return send(chatId, phoneConfig.txt.manageNumber(num), k.of(buildManageMenu(num)))
    }
    if (message === pc.enableIvr) {
      const ivrConf = { enabled: true, greeting: 'Thank you for calling. Please listen to the following options.', options: {} }
      await updatePhoneNumberFeature(phoneNumbersOf, chatId, num.phoneNumber, 'ivr', ivrConf)
      num.features = num.features || {}
      num.features.ivr = ivrConf
      await saveInfo('cpActiveNumber', num)
      send(chatId, phoneConfig.txt.ivrEnabled(num.phoneNumber))
      return send(chatId, phoneConfig.txt.ivrMenu(num.phoneNumber, ivrConf), k.of([
        [pc.ivrGreeting], [pc.ivrAddOption], [pc.ivrRemoveOption], [pc.ivrViewOptions], [pc.ivrAnalytics], [pc.disableIvr]
      ]))
    }
    if (message === pc.disableIvr) {
      await updatePhoneNumberFeature(phoneNumbersOf, chatId, num.phoneNumber, 'ivr', { enabled: false })
      num.features = num.features || {}
      num.features.ivr = { enabled: false }
      await saveInfo('cpActiveNumber', num)
      send(chatId, phoneConfig.txt.ivrDisabled(num.phoneNumber))
      set(state, chatId, 'action', a.cpManageNumber)
      return send(chatId, phoneConfig.txt.manageNumber(num), k.of(buildManageMenu(num)))
    }
    if (message === pc.ivrGreeting) {
      set(state, chatId, 'action', a.cpIvrGreeting)
      return send(chatId, `🎤 <b>Set IVR Greeting</b>\n\nChoose how to create your greeting:`, k.of([
        ['📋 Use Template'],
        ['📝 Type Text (AI Voice)'],
        ['🎙️ Upload Audio'],
      ]))
    }
    if (message === pc.ivrAddOption) {
      set(state, chatId, 'action', a.cpIvrOptionKey)
      await saveInfo('cpIvrDraft', {})
      const ivrConf = num.features?.ivr || {}
      const usedKeys = Object.keys(ivrConf.options || {}).join(', ') || 'none'
      return send(chatId, `➕ <b>Add Menu Option</b>\n\nUsed keys: ${usedKeys}\n\nEnter the key number (0-9) for this option:`, k.of([['0','1','2','3','4','5','6','7','8','9']]))
    }
    if (message === pc.ivrRemoveOption) {
      set(state, chatId, 'action', a.cpIvrRemoveOption)
      const ivrConf = num.features?.ivr || {}
      const keys = Object.keys(ivrConf.options || {})
      if (!keys.length) return send(chatId, phoneConfig.getMsg(info?.userLanguage).noIvrOptions, k.of([
        [pc.ivrGreeting], [pc.ivrAddOption], [pc.ivrRemoveOption], [pc.ivrViewOptions], [pc.ivrAnalytics], [pc.disableIvr]
      ]))
      return send(chatId, phoneConfig.getMsg(info?.userLanguage).whichKeyRemove, k.of([keys.map(k2 => `Key ${k2}`)]))
    }
    if (message === pc.ivrViewOptions) {
      const ivrConf = num.features?.ivr || {}
      return send(chatId, phoneConfig.txt.ivrMenu(num.phoneNumber, ivrConf), k.of([
        [pc.ivrGreeting], [pc.ivrAddOption], [pc.ivrRemoveOption], [pc.ivrViewOptions], [pc.ivrAnalytics], [pc.disableIvr]
      ]))
    }
    if (message === pc.ivrAnalytics) {
      const analytics = await getIvrAnalytics(num.phoneNumber, 30)
      return send(chatId, phoneConfig.txt.ivrAnalyticsReport(num.phoneNumber, analytics), k.of([
        [pc.ivrGreeting], [pc.ivrAddOption], [pc.ivrRemoveOption], [pc.ivrViewOptions], [pc.ivrAnalytics], [pc.disableIvr]
      ]))
    }
    return send(chatId, phoneConfig.getMsg(info?.userLanguage).selectOption)
  }

  // ── IVR Greeting: Choose method ──
  if (action === a.cpIvrGreeting) {
    const pc = phoneConfig.btn
    const num = info?.cpActiveNumber
    if (!num) return goto.submenu5()
    if (message === t.back || message === pc.back || message === t.cancel) {
      set(state, chatId, 'action', a.cpIvr)
      const ivrConf = num.features?.ivr || {}
      return send(chatId, phoneConfig.txt.ivrMenu(num.phoneNumber, ivrConf), k.of([
        [pc.ivrGreeting], [pc.ivrAddOption], [pc.ivrRemoveOption], [pc.ivrViewOptions], [pc.ivrAnalytics], [pc.disableIvr]
      ]))
    }
    if (message === '📝 Type Text (AI Voice)') {
      set(state, chatId, 'action', a.cpIvrGreetingVoice)
      await saveInfo('cpTtsDraft', { type: 'ivrGreeting' })
      return send(chatId, `📝 Type the greeting callers will hear.\n\n<i>Example: "Thank you for calling Nomadly. Press 1 for sales, press 2 for support."</i>`, k.of([]))
    }
    if (message === '🎙️ Upload Audio') {
      set(state, chatId, 'action', a.cpIvrGreetingPreview)
      await saveInfo('cpTtsDraft', { type: 'ivrGreeting', method: 'upload' })
      return send(chatId, `🎙️ Send a voice message or audio file for your IVR greeting.`, k.of([]))
    }
    if (message === '📋 Use Template') {
      set(state, chatId, 'action', a.cpIvrTemplate)
      await saveInfo('cpTtsDraft', { type: 'ivrGreeting', method: 'template' })
      const catBtns = ttsService.getTemplateCategoryButtons().map(b => [b])
      return send(chatId, `📋 <b>Greeting Templates</b>\n\nProfessional templates for financial institutions — fraud hotlines, customer support, after-hours, and more. Select a category:`, k.of(catBtns))
    }
    return send(chatId, `Choose an option:`, k.of([['📋 Use Template'], ['📝 Type Text (AI Voice)'], ['🎙️ Upload Audio']]))
  }

  // ── IVR Template: Select category → select template → edit → proceed ──
  if (action === a.cpIvrTemplate) {
    const pc = phoneConfig.btn
    const num = info?.cpActiveNumber
    if (!num) return goto.submenu5()
    if (message === t.back || message === pc.back || message === t.cancel) {
      set(state, chatId, 'action', a.cpIvrGreeting)
      return send(chatId, `🎤 <b>Set IVR Greeting</b>\n\nChoose how to create your greeting:`, k.of([
        ['📋 Use Template'], ['📝 Type Text (AI Voice)'], ['🎙️ Upload Audio'],
      ]))
    }
    const draft = info?.cpTtsDraft || {}
    // Step 1: User selects a category
    if (!draft.templateCategory) {
      const catKey = ttsService.getCategoryByButton(message)
      if (!catKey) {
        const catBtns = ttsService.getTemplateCategoryButtons().map(b => [b])
        return send(chatId, `📋 Select a template category:`, k.of(catBtns))
      }
      draft.templateCategory = catKey
      await saveInfo('cpTtsDraft', draft)
      const tplBtns = ttsService.getTemplateButtons(catKey).map(b => [b])
      return send(chatId, `📋 <b>${message}</b>\n\nSelect a greeting template:`, k.of(tplBtns))
    }
    // Step 2: User selects a specific template
    const tpl = ttsService.getTemplateByButton(draft.templateCategory, message)
    if (!tpl) {
      const tplBtns = ttsService.getTemplateButtons(draft.templateCategory).map(b => [b])
      return send(chatId, `Select a template:`, k.of(tplBtns))
    }
    draft.templateKey = tpl.key
    draft.text = tpl.text
    await saveInfo('cpTtsDraft', draft)
    set(state, chatId, 'action', a.cpIvrTemplateEdit)
    return send(chatId, `📋 <b>${tpl.icon} ${tpl.name}</b>\n\n<code>${tpl.text}</code>\n\n✏️ You can edit this text — just type your modified version below.\nOr tap <b>✅ Use As-Is</b> to proceed with this greeting.`, k.of([['✅ Use As-Is']]))
  }

  // ── IVR Template: Edit text then proceed to language → voice ──
  if (action === a.cpIvrTemplateEdit) {
    const pc = phoneConfig.btn
    const num = info?.cpActiveNumber
    if (!num) return goto.submenu5()
    if (message === t.back || message === pc.back || message === t.cancel) {
      const draft = info?.cpTtsDraft || {}
      draft.templateCategory = null
      draft.templateKey = null
      draft.text = null
      await saveInfo('cpTtsDraft', draft)
      set(state, chatId, 'action', a.cpIvrTemplate)
      const catBtns = ttsService.getTemplateCategoryButtons().map(b => [b])
      return send(chatId, `📋 <b>Greeting Templates</b>\n\nSelect a category:`, k.of(catBtns))
    }
    const draft = info?.cpTtsDraft || {}
    if (message === '✅ Use As-Is') {
      // Proceed to language selection with template text
      draft.lang = null
      draft.voice = null
      await saveInfo('cpTtsDraft', draft)
      set(state, chatId, 'action', a.cpIvrGreetingVoice)
      const langBtns = ttsService.getLanguageButtons()
      const langRows = []
      for (let i = 0; i < langBtns.length; i += 2) langRows.push(langBtns.slice(i, i + 2))
      return send(chatId, `🌐 Select the language for your IVR greeting:\n\n<i>The template will be automatically translated to your chosen language.</i>`, k.of(langRows))
    }
    // User typed modified text
    draft.text = message
    draft.lang = null
    draft.voice = null
    await saveInfo('cpTtsDraft', draft)
    set(state, chatId, 'action', a.cpIvrGreetingVoice)
    const langBtns = ttsService.getLanguageButtons()
    const langRows = []
    for (let i = 0; i < langBtns.length; i += 2) langRows.push(langBtns.slice(i, i + 2))
    return send(chatId, `✅ Text updated.\n\n🌐 Select the language for your IVR greeting:\n\n<i>The greeting will be automatically translated to your chosen language.</i>`, k.of(langRows))
  }

  // ── IVR Greeting: Enter text → select language → select provider → select voice ──
  if (action === a.cpIvrGreetingVoice) {
    const pc = phoneConfig.btn
    const num = info?.cpActiveNumber
    if (!num) return goto.submenu5()
    if (message === t.back || message === pc.back || message === t.cancel) {
      set(state, chatId, 'action', a.cpIvrGreeting)
      return send(chatId, `🎤 <b>Set IVR Greeting</b>\n\nChoose how to create your greeting:`, k.of([
        ['📋 Use Template'], ['📝 Type Text (AI Voice)'], ['🎙️ Upload Audio'],
      ]))
    }
    const draft = info?.cpTtsDraft || {}
    // Step 3: Voice selected → generate TTS
    if (draft.text && draft.lang && draft.ttsProvider && !draft.voice) {
      const voiceKey = ttsService.getVoiceKeyByButton(message, draft.lang)
      draft.voice = voiceKey
      await saveInfo('cpTtsDraft', draft)
      send(chatId, '🔄 Generating audio preview...')
      try {
        const result = await ttsService.generateTTS(draft.text, voiceKey, draft.lang)
        draft.audioPath = result.audioPath
        draft.audioUrl = result.audioUrl
        await saveInfo('cpTtsDraft', draft)
        await bot.sendVoice(chatId, result.audioPath)
        set(state, chatId, 'action', a.cpIvrGreetingPreview)
        return send(chatId, `✅ Preview generated (${result.voice})\n\n✅ Save this greeting?\n🔄 Try a different voice?\n📝 Re-type the text?`, k.of([
          ['✅ Save Greeting'],
          ['🔄 Try Different Voice'],
          ['🌐 Change Language'],
          ['📝 Re-type Text'],
        ]))
      } catch (e) {
        log(`[TTS] Error: ${e.message}`)
        return send(chatId, `❌ Audio generation failed: ${e.message}\n\nTry again or upload your own audio.`, k.of([
          ['📝 Type Text (AI Voice)'], ['🎙️ Upload Audio'],
        ]))
      }
    }
    // Step 2: Provider selected → show voices
    if (draft.text && draft.lang && !draft.ttsProvider) {
      const providerKey = ttsService.getProviderByButton(message)
      if (providerKey) {
        draft.ttsProvider = providerKey
        await saveInfo('cpTtsDraft', draft)
        const voiceBtns = ttsService.getVoiceButtons(draft.lang, providerKey).map(v => [v])
        if (draft.lang !== 'en' && draft.translatedText) {
          return send(chatId, `🌐 <b>Translated greeting:</b>\n\n<i>${draft.translatedText.length > 300 ? draft.translatedText.slice(0, 300) + '...' : draft.translatedText}</i>\n\n🎙️ Choose a voice:`, k.of(voiceBtns))
        }
        return send(chatId, `🎙️ Choose a voice for your greeting:`, k.of(voiceBtns))
      }
      const providerBtns = ttsService.getProviderButtons().map(b => [b])
      return send(chatId, `🎙 Select a voice provider:`, k.of(providerBtns))
    }
    // Step 1: Language selected → show provider selection
    if (draft.text && !draft.lang) {
      const langCode = ttsService.getLanguageByButton(message)
      if (langCode) {
        if (langCode !== 'en') {
          send(chatId, `🌐 Translating to ${message}...`)
          const translated = await ttsService.translateText(draft.text, langCode)
          draft.translatedText = translated
          draft.originalText = draft.text
          draft.text = translated
        }
        draft.lang = langCode
        draft.ttsProvider = null
        await saveInfo('cpTtsDraft', draft)
        const providerBtns = ttsService.getProviderButtons().map(b => [b])
        return send(chatId, `🎙 <b>Select Voice Provider</b>\n\nChoose your TTS engine:`, k.of(providerBtns))
      }
      const langBtns = ttsService.getLanguageButtons()
      const langRows = []
      for (let i = 0; i < langBtns.length; i += 2) langRows.push(langBtns.slice(i, i + 2))
      return send(chatId, `🌐 Select the language for your IVR greeting:`, k.of(langRows))
    }
    const ivrButtons = [pc.ivrGreeting, pc.ivrAddOption, pc.ivrRemoveOption, pc.ivrViewOptions, pc.ivrAnalytics, pc.disableIvr, pc.enableIvr]
    if (ivrButtons.includes(message)) {
      return send(chatId, `📝 Type the greeting callers will hear:`, k.of([]))
    }
    draft.text = message
    draft.lang = null
    draft.voice = null
    draft.ttsProvider = null
    await saveInfo('cpTtsDraft', draft)
    const langBtns = ttsService.getLanguageButtons()
    const langRows = []
    for (let i = 0; i < langBtns.length; i += 2) langRows.push(langBtns.slice(i, i + 2))
    return send(chatId, `🌐 Select the language for your IVR greeting:\n\n<i>"${message.length > 80 ? message.slice(0, 80) + '...' : message}"</i>`, k.of(langRows))
  }

  // ── IVR Greeting: Preview & Save ──
  if (action === a.cpIvrGreetingPreview) {
    const pc = phoneConfig.btn
    const num = info?.cpActiveNumber
    if (!num) return goto.submenu5()
    if (message === t.back || message === pc.back || message === t.cancel) {
      set(state, chatId, 'action', a.cpIvr)
      const ivrConf = num.features?.ivr || {}
      return send(chatId, phoneConfig.txt.ivrMenu(num.phoneNumber, ivrConf), k.of([
        [pc.ivrGreeting], [pc.ivrAddOption], [pc.ivrRemoveOption], [pc.ivrViewOptions], [pc.ivrAnalytics], [pc.disableIvr]
      ]))
    }
    const draft = info?.cpTtsDraft || {}

    // Handle audio upload
    if (draft.method === 'upload') {
      if (msg?.voice || msg?.audio) {
        const fileId = msg.voice?.file_id || msg.audio?.file_id
        try {
          const localPath = await ttsService.downloadTelegramAudio(bot, fileId, 'ivr_greeting')
          draft.audioPath = localPath
          draft.method = 'uploaded'
          await saveInfo('cpTtsDraft', draft)
          await bot.sendVoice(chatId, localPath)
          return send(chatId, `✅ Audio received. Save as your IVR greeting?`, k.of([
            ['✅ Save Greeting'],
            ['🎙️ Re-upload'],
          ]))
        } catch (e) {
          return send(chatId, `❌ Failed to process audio. Try again.`, k.of([]))
        }
      }
      return send(chatId, `🎙️ Send a voice message or audio file.`, k.of([]))
    }

    if (message === '🔄 Try Different Voice') {
      draft.voice = null
      draft.audioPath = null
      draft.ttsProvider = null
      await saveInfo('cpTtsDraft', draft)
      set(state, chatId, 'action', a.cpIvrGreetingVoice)
      const providerBtns = ttsService.getProviderButtons().map(b => [b])
      return send(chatId, `🎙 <b>Select Voice Provider</b>\n\nChoose your TTS engine:`, k.of(providerBtns))
    }
    if (message === '🌐 Change Language') {
      draft.lang = null
      draft.voice = null
      draft.audioPath = null
      draft.ttsProvider = null
      await saveInfo('cpTtsDraft', draft)
      set(state, chatId, 'action', a.cpIvrGreetingVoice)
      const langBtns = ttsService.getLanguageButtons()
      const langRows = []
      for (let i = 0; i < langBtns.length; i += 2) langRows.push(langBtns.slice(i, i + 2))
      return send(chatId, `🌐 Select the language for your IVR greeting:`, k.of(langRows))
    }
    if (message === '📝 Re-type Text') {
      draft.text = null
      draft.voice = null
      draft.audioPath = null
      await saveInfo('cpTtsDraft', draft)
      set(state, chatId, 'action', a.cpIvrGreetingVoice)
      return send(chatId, `📝 Type the greeting callers will hear:`, k.of([]))
    }
    if (message === '🎙️ Re-upload') {
      draft.audioPath = null
      draft.method = 'upload'
      await saveInfo('cpTtsDraft', draft)
      return send(chatId, `🎙️ Send a voice message or audio file.`, k.of([]))
    }
    if (message === '✅ Save Greeting') {
      const ivrConf = num.features?.ivr || { enabled: true, options: {} }
      if (draft.audioPath) {
        ivrConf.greetingType = 'audio'
        ivrConf.greetingAudioPath = draft.audioPath
        ivrConf.greetingAudioUrl = draft.audioUrl || null
        ivrConf.greeting = draft.text || null
        ivrConf.greetingVoice = draft.voice || null
      } else {
        ivrConf.greeting = draft.text || ivrConf.greeting
      }
      await updatePhoneNumberFeature(phoneNumbersOf, chatId, num.phoneNumber, 'ivr', ivrConf)
      num.features.ivr = ivrConf
      await saveInfo('cpActiveNumber', num)
      await saveInfo('cpTtsDraft', null)
      send(chatId, `✅ IVR greeting saved!`)
      set(state, chatId, 'action', a.cpIvr)
      return send(chatId, phoneConfig.txt.ivrMenu(num.phoneNumber, ivrConf), k.of([
        [pc.ivrGreeting], [pc.ivrAddOption], [pc.ivrRemoveOption], [pc.ivrViewOptions], [pc.ivrAnalytics], [pc.disableIvr]
      ]))
    }
    // If user sends voice/audio in preview state
    if (msg?.voice || msg?.audio) {
      const fileId = msg.voice?.file_id || msg.audio?.file_id
      try {
        const localPath = await ttsService.downloadTelegramAudio(bot, fileId, 'ivr_greeting')
        draft.audioPath = localPath
        draft.method = 'uploaded'
        await saveInfo('cpTtsDraft', draft)
        await bot.sendVoice(chatId, localPath)
        return send(chatId, `✅ Audio received. Save as your IVR greeting?`, k.of([
          ['✅ Save Greeting'],
          ['🎙️ Re-upload'],
        ]))
      } catch (e) {
        return send(chatId, `❌ Failed to process audio. Try again.`, k.of([]))
      }
    }
    return send(chatId, `Choose an option:`, k.of([['✅ Save Greeting'], ['🔄 Try Different Voice'], ['📝 Re-type Text']]))
  }

  // (IVR Add Option — step-by-step wizard: cpIvrOptionKey → cpIvrOptionAction → cpIvrOptionMsg → cpIvrOptionVoice → cpIvrOptionPreview)

  // ── IVR Option: Step 1 — Select key number (0-9) ──
  if (action === a.cpIvrOptionKey) {
    const pc = phoneConfig.btn
    const num = info?.cpActiveNumber
    if (!num) return goto.submenu5()
    if (message === t.back || message === pc.back || message === t.cancel) {
      set(state, chatId, 'action', a.cpIvr)
      const ivrConf = num.features?.ivr || {}
      return send(chatId, phoneConfig.txt.ivrMenu(num.phoneNumber, ivrConf), k.of([
        [pc.ivrGreeting], [pc.ivrAddOption], [pc.ivrRemoveOption], [pc.ivrViewOptions], [pc.ivrAnalytics], [pc.disableIvr]
      ]))
    }
    const key = message.trim()
    if (!/^[0-9]$/.test(key)) {
      const ivrConf = num.features?.ivr || {}
      const usedKeys = Object.keys(ivrConf.options || {}).join(', ') || 'none'
      return send(chatId, `➕ <b>Add Menu Option</b>\n\nUsed keys: ${usedKeys}\n\nEnter a number (0-9):`, k.of([['0','1','2','3','4','5','6','7','8','9']]))
    }
    const ivrConf = num.features?.ivr || {}
    if (ivrConf.options?.[key]) {
      return send(chatId, `⚠️ Key <b>${key}</b> is already assigned. Remove it first, or pick a different key.\n\nUsed keys: ${Object.keys(ivrConf.options).join(', ')}`, k.of([['0','1','2','3','4','5','6','7','8','9']]))
    }
    await saveInfo('cpIvrDraft', { key })
    set(state, chatId, 'action', a.cpIvrOptionAction)
    return send(chatId, `🔢 Key <b>${key}</b> selected.\n\nWhat should happen when a caller presses <b>${key}</b>?`, k.of([
      ['📞 Forward Call'],
      ['💬 Play Message'],
      ['📬 Send to Voicemail'],
    ]))
  }

  // ── IVR Option: Step 2 — Select action type ──
  if (action === a.cpIvrOptionAction) {
    const pc = phoneConfig.btn
    const num = info?.cpActiveNumber
    if (!num) return goto.submenu5()
    if (message === t.back || message === pc.back || message === t.cancel) {
      set(state, chatId, 'action', a.cpIvrOptionKey)
      const ivrConf = num.features?.ivr || {}
      const usedKeys = Object.keys(ivrConf.options || {}).join(', ') || 'none'
      return send(chatId, `➕ <b>Add Menu Option</b>\n\nUsed keys: ${usedKeys}\n\nEnter the key number (0-9):`, k.of([['0','1','2','3','4','5','6','7','8','9']]))
    }
    const draft = info?.cpIvrDraft || {}
    if (message === '📞 Forward Call') {
      draft.action = 'forward'
      await saveInfo('cpIvrDraft', draft)
      set(state, chatId, 'action', a.cpIvrOptionMsg)
      return send(chatId, `📞 <b>Forward Call</b>\n\nEnter the phone number to forward calls to:\n\n<i>Example: +15551234567</i>`, k.of([]))
    }
    if (message === '💬 Play Message') {
      draft.action = 'message'
      await saveInfo('cpIvrDraft', draft)
      set(state, chatId, 'action', a.cpIvrOptionMsg)
      return send(chatId, `💬 <b>Play Message</b>\n\nHow do you want to create the message?`, k.of([
        ['📋 Use Template'],
        ['📝 Type Text (AI Voice)'],
        ['🎙️ Upload Audio'],
      ]))
    }
    if (message === '📬 Send to Voicemail') {
      draft.action = 'voicemail'
      await saveInfo('cpIvrDraft', draft)
      // Save directly
      const ivrConf = num.features?.ivr || { enabled: true, options: {} }
      if (!ivrConf.options) ivrConf.options = {}
      ivrConf.options[draft.key] = { action: 'voicemail' }
      await updatePhoneNumberFeature(phoneNumbersOf, chatId, num.phoneNumber, 'ivr', ivrConf)
      num.features.ivr = ivrConf
      await saveInfo('cpActiveNumber', num)
      await saveInfo('cpIvrDraft', null)
      send(chatId, `✅ Key <b>${draft.key}</b> → Send to Voicemail — saved!`)
      set(state, chatId, 'action', a.cpIvr)
      return send(chatId, phoneConfig.txt.ivrMenu(num.phoneNumber, ivrConf), k.of([
        [pc.ivrGreeting], [pc.ivrAddOption], [pc.ivrRemoveOption], [pc.ivrViewOptions], [pc.ivrAnalytics], [pc.disableIvr]
      ]))
    }
    return send(chatId, `Select an action for this key:`, k.of([['📞 Forward Call'], ['💬 Play Message'], ['📬 Send to Voicemail']]))
  }

  // ── IVR Option: Step 3 — Enter message text / forward number / upload ──
  if (action === a.cpIvrOptionMsg) {
    const pc = phoneConfig.btn
    const num = info?.cpActiveNumber
    if (!num) return goto.submenu5()
    if (message === t.back || message === pc.back || message === t.cancel) {
      set(state, chatId, 'action', a.cpIvrOptionAction)
      return send(chatId, `What should happen when a caller presses <b>${(info?.cpIvrDraft || {}).key}</b>?`, k.of([
        ['📞 Forward Call'], ['💬 Play Message'], ['📬 Send to Voicemail'],
      ]))
    }
    const draft = info?.cpIvrDraft || {}

    // ── FORWARD CALL: user enters phone number ──
    if (draft.action === 'forward') {
      const phone = message.replace(/[^+\d]/g, '')
      if (phone.length < 7 || phone.length > 16) {
        return send(chatId, `❌ Invalid phone number. Enter a valid number (e.g. +15551234567):`, k.of([]))
      }
      draft.forwardTo = phone
      await saveInfo('cpIvrDraft', draft)
      // Save immediately
      const ivrConf = num.features?.ivr || { enabled: true, options: {} }
      if (!ivrConf.options) ivrConf.options = {}
      ivrConf.options[draft.key] = { action: 'forward', forwardTo: phone }
      await updatePhoneNumberFeature(phoneNumbersOf, chatId, num.phoneNumber, 'ivr', ivrConf)
      num.features.ivr = ivrConf
      await saveInfo('cpActiveNumber', num)
      await saveInfo('cpIvrDraft', null)
      send(chatId, `✅ Key <b>${draft.key}</b> → Forward to <b>${phone}</b> — saved!`)
      set(state, chatId, 'action', a.cpIvr)
      return send(chatId, phoneConfig.txt.ivrMenu(num.phoneNumber, ivrConf), k.of([
        [pc.ivrGreeting], [pc.ivrAddOption], [pc.ivrRemoveOption], [pc.ivrViewOptions], [pc.ivrAnalytics], [pc.disableIvr]
      ]))
    }

    // ── PLAY MESSAGE: sub-options ──
    if (draft.action === 'message') {
      // Template selection
      if (message === '📋 Use Template') {
        draft.method = 'template'
        draft.templateCategory = null
        await saveInfo('cpIvrDraft', draft)
        const catBtns = ttsService.getTemplateCategoryButtons().map(b => [b])
        return send(chatId, `📋 <b>Message Templates</b>\n\nSelect a category:`, k.of(catBtns))
      }
      // Template category selected
      if (draft.method === 'template' && !draft.templateCategory) {
        const catKey = ttsService.getCategoryByButton(message)
        if (catKey) {
          draft.templateCategory = catKey
          await saveInfo('cpIvrDraft', draft)
          const tplBtns = ttsService.getTemplateButtons(catKey).map(b => [b])
          return send(chatId, `📋 <b>${message}</b>\n\nSelect a template:`, k.of(tplBtns))
        }
        const catBtns = ttsService.getTemplateCategoryButtons().map(b => [b])
        return send(chatId, `📋 Select a category:`, k.of(catBtns))
      }
      // Template selected from category
      if (draft.method === 'template' && draft.templateCategory && !draft.text) {
        const tpl = ttsService.getTemplateByButton(draft.templateCategory, message)
        if (tpl) {
          draft.text = tpl.text
          draft.templateKey = tpl.key
          await saveInfo('cpIvrDraft', draft)
          return send(chatId, `📋 <b>${tpl.icon} ${tpl.name}</b>\n\n<code>${tpl.text}</code>\n\n✏️ Type your modified version, or tap <b>✅ Use As-Is</b>:`, k.of([['✅ Use As-Is']]))
        }
        const tplBtns = ttsService.getTemplateButtons(draft.templateCategory).map(b => [b])
        return send(chatId, `Select a template:`, k.of(tplBtns))
      }
      // Template "Use As-Is" or user edited text → go to language selection
      if (draft.method === 'template' && draft.text && !draft.lang) {
        if (message !== '✅ Use As-Is') {
          draft.text = message // User edited
        }
        draft.lang = null
        draft.voice = null
        await saveInfo('cpIvrDraft', draft)
        set(state, chatId, 'action', a.cpIvrOptionVoice)
        const langBtns = ttsService.getLanguageButtons()
        const langRows = []
        for (let i = 0; i < langBtns.length; i += 2) langRows.push(langBtns.slice(i, i + 2))
        return send(chatId, `🌐 Select the language:\n\n<i>The message will be translated automatically.</i>`, k.of(langRows))
      }
      // Type Text
      if (message === '📝 Type Text (AI Voice)') {
        draft.method = 'tts'
        await saveInfo('cpIvrDraft', draft)
        return send(chatId, `📝 Type the message callers will hear when they press <b>${draft.key}</b>:`, k.of([]))
      }
      // Upload Audio
      if (message === '🎙️ Upload Audio') {
        draft.method = 'upload'
        await saveInfo('cpIvrDraft', draft)
        return send(chatId, `🎙️ Send a voice message or audio file:`, k.of([]))
      }
      // Handle audio upload
      if (msg?.voice || msg?.audio) {
        const fileId = msg.voice?.file_id || msg.audio?.file_id
        try {
          const localPath = await ttsService.downloadTelegramAudio(bot, fileId, 'ivr_option')
          draft.audioPath = localPath
          draft.method = 'uploaded'
          await saveInfo('cpIvrDraft', draft)
          await bot.sendVoice(chatId, localPath)
          set(state, chatId, 'action', a.cpIvrOptionPreview)
          return send(chatId, `✅ Audio received for key <b>${draft.key}</b>. Save this?`, k.of([['✅ Save Option'], ['🎙️ Re-upload']]))
        } catch (e) {
          return send(chatId, `❌ Failed. Try again.`, k.of([]))
        }
      }
      // User typed TTS text
      if (draft.method === 'tts' && message) {
        draft.text = message
        draft.lang = null
        draft.voice = null
        await saveInfo('cpIvrDraft', draft)
        set(state, chatId, 'action', a.cpIvrOptionVoice)
        const langBtns = ttsService.getLanguageButtons()
        const langRows = []
        for (let i = 0; i < langBtns.length; i += 2) langRows.push(langBtns.slice(i, i + 2))
        return send(chatId, `🌐 Select the language:\n\n<i>"${message.length > 80 ? message.slice(0, 80) + '...' : message}"</i>`, k.of(langRows))
      }
      return send(chatId, `Choose:`, k.of([['📋 Use Template'], ['📝 Type Text (AI Voice)'], ['🎙️ Upload Audio']]))
    }
    return send(chatId, `Unexpected state. Try again.`, k.of([]))
  }

  // ── IVR Option: Step 4 — Language + Provider + Voice selection for TTS ──
  if (action === a.cpIvrOptionVoice) {
    const pc = phoneConfig.btn
    const num = info?.cpActiveNumber
    if (!num) return goto.submenu5()
    if (message === t.back || message === pc.back || message === t.cancel) {
      const draft = info?.cpIvrDraft || {}
      draft.lang = null; draft.voice = null; draft.audioPath = null; draft.ttsProvider = null
      await saveInfo('cpIvrDraft', draft)
      set(state, chatId, 'action', a.cpIvrOptionMsg)
      if (draft.method === 'template') {
        return send(chatId, `📋 <b>Message</b>\n\n<code>${draft.text}</code>\n\n✏️ Type your modified version, or tap <b>✅ Use As-Is</b>:`, k.of([['✅ Use As-Is']]))
      }
      return send(chatId, `📝 Type the message callers will hear when they press <b>${draft.key}</b>:`, k.of([]))
    }
    const draft = info?.cpIvrDraft || {}
    // Step 3: Voice selection (after provider was picked)
    if (draft.text && draft.lang && draft.ttsProvider && !draft.voice) {
      const voiceKey = ttsService.getVoiceKeyByButton(message, draft.lang)
      draft.voice = voiceKey
      await saveInfo('cpIvrDraft', draft)
      send(chatId, '🔄 Generating audio preview...')
      try {
        const result = await ttsService.generateTTS(draft.text, voiceKey, draft.lang)
        draft.audioPath = result.audioPath
        draft.audioUrl = result.audioUrl
        await saveInfo('cpIvrDraft', draft)
        await bot.sendVoice(chatId, result.audioPath)
        set(state, chatId, 'action', a.cpIvrOptionPreview)
        return send(chatId, `✅ Preview for key <b>${draft.key}</b> (${result.voice})\n\nSave this option?`, k.of([
          ['✅ Save Option'], ['🔄 Try Different Voice'], ['🌐 Change Language'], ['📝 Re-type Text'],
        ]))
      } catch (e) {
        log(`[TTS] Error: ${e.message}`)
        draft.voice = null
        await saveInfo('cpIvrDraft', draft)
        return send(chatId, `❌ Audio generation failed: ${e.message}`, k.of([['📝 Type Text (AI Voice)'], ['🎙️ Upload Audio']]))
      }
    }
    // Step 2: Provider selection (after language was picked)
    if (draft.text && draft.lang && !draft.ttsProvider) {
      const providerKey = ttsService.getProviderByButton(message)
      if (providerKey) {
        draft.ttsProvider = providerKey
        await saveInfo('cpIvrDraft', draft)
        const voiceBtns = ttsService.getVoiceButtons(draft.lang, providerKey).map(v => [v])
        if (draft.lang !== 'en' && draft.translatedText) {
          return send(chatId, `🌐 <b>Translated:</b>\n\n<i>${draft.translatedText.length > 300 ? draft.translatedText.slice(0, 300) + '...' : draft.translatedText}</i>\n\n🎙️ Choose a voice:`, k.of(voiceBtns))
        }
        return send(chatId, `🎙️ Choose a voice:`, k.of(voiceBtns))
      }
      const providerBtns = ttsService.getProviderButtons().map(b => [b])
      return send(chatId, `🎙 Select a voice provider:`, k.of(providerBtns))
    }
    // Step 1: Language selection
    if (draft.text && !draft.lang) {
      const langCode = ttsService.getLanguageByButton(message)
      if (langCode) {
        if (langCode !== 'en') {
          send(chatId, `🌐 Translating to ${message}...`)
          const translated = await ttsService.translateText(draft.text, langCode)
          draft.translatedText = translated
          draft.originalText = draft.text
          draft.text = translated
        }
        draft.lang = langCode
        draft.ttsProvider = null
        await saveInfo('cpIvrDraft', draft)
        const providerBtns = ttsService.getProviderButtons().map(b => [b])
        return send(chatId, `🎙 <b>Select Voice Provider</b>\n\nChoose your TTS engine:`, k.of(providerBtns))
      }
      const langBtns = ttsService.getLanguageButtons()
      const langRows = []
      for (let i = 0; i < langBtns.length; i += 2) langRows.push(langBtns.slice(i, i + 2))
      return send(chatId, `🌐 Select the language:`, k.of(langRows))
    }
    return send(chatId, `Type the message text:`, k.of([]))
  }

  // ── IVR Option: Step 5 — Preview & Save ──
  if (action === a.cpIvrOptionPreview) {
    const pc = phoneConfig.btn
    const num = info?.cpActiveNumber
    if (!num) return goto.submenu5()
    if (message === t.back || message === pc.back || message === t.cancel) {
      set(state, chatId, 'action', a.cpIvr)
      const ivrConf = num.features?.ivr || {}
      return send(chatId, phoneConfig.txt.ivrMenu(num.phoneNumber, ivrConf), k.of([
        [pc.ivrGreeting], [pc.ivrAddOption], [pc.ivrRemoveOption], [pc.ivrViewOptions], [pc.ivrAnalytics], [pc.disableIvr]
      ]))
    }
    const draft = info?.cpIvrDraft || {}
    if (message === '🔄 Try Different Voice') {
      draft.voice = null; draft.audioPath = null; draft.ttsProvider = null
      await saveInfo('cpIvrDraft', draft)
      set(state, chatId, 'action', a.cpIvrOptionVoice)
      const providerBtns = ttsService.getProviderButtons().map(b => [b])
      return send(chatId, `🎙 <b>Select Voice Provider</b>\n\nChoose your TTS engine:`, k.of(providerBtns))
    }
    if (message === '🌐 Change Language') {
      draft.lang = null; draft.voice = null; draft.audioPath = null; draft.ttsProvider = null
      if (draft.originalText) draft.text = draft.originalText
      await saveInfo('cpIvrDraft', draft)
      set(state, chatId, 'action', a.cpIvrOptionVoice)
      const langBtns = ttsService.getLanguageButtons()
      const langRows = []
      for (let i = 0; i < langBtns.length; i += 2) langRows.push(langBtns.slice(i, i + 2))
      return send(chatId, `🌐 Select the language:`, k.of(langRows))
    }
    if (message === '📝 Re-type Text') {
      draft.text = null; draft.voice = null; draft.audioPath = null; draft.originalText = null; draft.translatedText = null
      await saveInfo('cpIvrDraft', draft)
      set(state, chatId, 'action', a.cpIvrOptionMsg)
      return send(chatId, `📝 Type the message:`, k.of([]))
    }
    if (message === '🎙️ Re-upload') {
      draft.audioPath = null; draft.method = 'upload'
      await saveInfo('cpIvrDraft', draft)
      set(state, chatId, 'action', a.cpIvrOptionMsg)
      return send(chatId, `🎙️ Send a voice message or audio file:`, k.of([]))
    }
    // Handle audio in preview state
    if (msg?.voice || msg?.audio) {
      const fileId = msg.voice?.file_id || msg.audio?.file_id
      try {
        const localPath = await ttsService.downloadTelegramAudio(bot, fileId, 'ivr_option')
        draft.audioPath = localPath; draft.method = 'uploaded'
        await saveInfo('cpIvrDraft', draft)
        await bot.sendVoice(chatId, localPath)
        return send(chatId, `✅ Audio received for key <b>${draft.key}</b>. Save this?`, k.of([['✅ Save Option'], ['🎙️ Re-upload']]))
      } catch (e) {
        return send(chatId, `❌ Failed. Try again.`, k.of([]))
      }
    }
    if (message === '✅ Save Option') {
      const ivrConf = num.features?.ivr || { enabled: true, options: {} }
      if (!ivrConf.options) ivrConf.options = {}
      const optionData = { action: draft.action }
      if (draft.action === 'message') {
        optionData.message = draft.text || 'Thank you for calling.'
        if (draft.audioPath) optionData.audioPath = draft.audioPath
        if (draft.audioUrl) optionData.audioUrl = draft.audioUrl
        if (draft.voice) optionData.voice = draft.voice
        if (draft.lang) optionData.language = draft.lang
      }
      ivrConf.options[draft.key] = optionData
      await updatePhoneNumberFeature(phoneNumbersOf, chatId, num.phoneNumber, 'ivr', ivrConf)
      num.features.ivr = ivrConf
      await saveInfo('cpActiveNumber', num)
      await saveInfo('cpIvrDraft', null)
      const actionLabel = draft.action === 'message' ? 'Play Message' : draft.action === 'forward' ? 'Forward Call' : 'Voicemail'
      send(chatId, `✅ Key <b>${draft.key}</b> → ${actionLabel} — saved!`)
      set(state, chatId, 'action', a.cpIvr)
      return send(chatId, phoneConfig.txt.ivrMenu(num.phoneNumber, ivrConf), k.of([
        [pc.ivrGreeting], [pc.ivrAddOption], [pc.ivrRemoveOption], [pc.ivrViewOptions], [pc.ivrAnalytics], [pc.disableIvr]
      ]))
    }
    return send(chatId, `Choose:`, k.of([['✅ Save Option'], ['🔄 Try Different Voice'], ['📝 Re-type Text']]))
  }

  // IVR Remove Option
  if (action === a.cpIvrRemoveOption) {
    const pc = phoneConfig.btn
    const num = info?.cpActiveNumber
    if (!num) return goto.submenu5()
    if (message === t.back || message === pc.back) {
      set(state, chatId, 'action', a.cpIvr)
      const ivrConf = num.features?.ivr || {}
      return send(chatId, phoneConfig.txt.ivrMenu(num.phoneNumber, ivrConf), k.of([
        [pc.ivrGreeting], [pc.ivrAddOption], [pc.ivrRemoveOption], [pc.ivrViewOptions], [pc.ivrAnalytics], [pc.disableIvr]
      ]))
    }
    const keyMatch = message.match(/Key\s*(\S+)/)
    const key = keyMatch ? keyMatch[1] : message.trim()
    const ivrConf = num.features?.ivr || { enabled: true, options: {} }
    if (ivrConf.options?.[key]) {
      delete ivrConf.options[key]
      await updatePhoneNumberFeature(phoneNumbersOf, chatId, num.phoneNumber, 'ivr', ivrConf)
      num.features.ivr = ivrConf
      await saveInfo('cpActiveNumber', num)
      send(chatId, phoneConfig.txt.ivrOptionRemoved(key))
    } else {
      send(chatId, phoneConfig.getMsg(info?.userLanguage).noOptionForKey(key))
    }
    set(state, chatId, 'action', a.cpIvr)
    return send(chatId, phoneConfig.txt.ivrMenu(num.phoneNumber, ivrConf), k.of([
      [pc.ivrGreeting], [pc.ivrAddOption], [pc.ivrRemoveOption], [pc.ivrViewOptions], [pc.ivrAnalytics], [pc.disableIvr]
    ]))
  }

  // ━━━ SIP CREDENTIALS ━━━
  if (action === a.cpSipCredentials) {
    const pc = phoneConfig.btn
    const num = info?.cpActiveNumber
    if (!num) return goto.submenu5()
    if (message === t.back || message === pc.back) {
      set(state, chatId, 'action', a.cpManageNumber)
      return send(chatId, phoneConfig.txt.manageNumber(num), k.of(buildManageMenu(num)))
    }
    if (message === pc.revealPassword) {
      const msg = await bot?.sendMessage(chatId, phoneConfig.txt.sipRevealed(num.sipPassword), { parse_mode: 'HTML' })
      // Auto-delete after 30 seconds
      if (msg?.message_id) {
        setTimeout(() => {
          bot?.deleteMessage(chatId, msg.message_id)?.catch(() => {})
        }, 30000)
      }
      return
    }
    if (message === pc.resetPassword) {
      const newPassword = phoneConfig.generateSipPassword()
      let actualUsername = num.sipUsername
      let actualPassword = newPassword
      // Create new SIP credential on Telnyx and use returned credentials
      if (telnyxResources.sipConnectionId) {
        const telnyxCred = await telnyxApi.createSIPCredential(telnyxResources.sipConnectionId, num.sipUsername, newPassword)
        if (telnyxCred?.sip_password) {
          actualPassword = telnyxCred.sip_password
          if (telnyxCred.sip_username && telnyxCred.sip_username !== num.sipUsername) {
            actualUsername = telnyxCred.sip_username
            await updatePhoneNumberField(phoneNumbersOf, chatId, num.phoneNumber, 'sipUsername', actualUsername)
            num.sipUsername = actualUsername
          }
          log(`[CloudPhone] Password reset — using Telnyx credentials for ${num.phoneNumber}`)
        }
      }
      await updatePhoneNumberField(phoneNumbersOf, chatId, num.phoneNumber, 'sipPassword', actualPassword)
      num.sipPassword = actualPassword
      await saveInfo('cpActiveNumber', num)
      // Also update Twilio credential list if it's a Twilio number
      if (num.provider === 'twilio' && twilioResources?.credentialListSid) {
        await twilioService.addSipCredential(twilioResources.credentialListSid, actualUsername, actualPassword)
      }
      const msg = await bot?.sendMessage(chatId, phoneConfig.txt.sipReset(actualPassword), { parse_mode: 'HTML' })
      if (msg?.message_id) {
        setTimeout(() => {
          bot?.deleteMessage(chatId, msg.message_id)?.catch(() => {})
        }, 60000)
      }
      return
    }
    if (message === pc.softphoneGuide) {
      const numSipDomain = phoneConfig.getSipDomainForNumber()
      return send(chatId, phoneConfig.txt.softphoneGuide(numSipDomain), k.of([]))
    }
    return send(chatId, phoneConfig.getMsg(info?.userLanguage).selectOption)
  }

  // ━━━ RENEW / CHANGE PLAN ━━━
  if (action === a.cpRenewPlan) {
    const pc = phoneConfig.btn
    const num = info?.cpActiveNumber
    if (!num) return goto.submenu5()
    if (message === t.back || message === pc.back) {
      set(state, chatId, 'action', a.cpManageNumber)
      return send(chatId, phoneConfig.txt.manageNumber(num), k.of(buildManageMenu(num)))
    }
    // Toggle Auto-Renew
    if (message.startsWith('🔁 Auto-Renew')) {
      const newState = !num.autoRenew
      await updatePhoneNumberField(phoneNumbersOf, chatId, num.phoneNumber, 'autoRenew', newState)
      num.autoRenew = newState
      await saveInfo('cpActiveNumber', num)
      send(chatId, phoneConfig.getMsg(info?.userLanguage).autoRenewToggled(newState))
      const plan = phoneConfig.plans[num.plan] || { name: num.plan, price: num.planPrice }
      return send(chatId, phoneConfig.txt.renewMenu(num.phoneNumber, plan.name, num.planPrice, num.expiresAt, newState), k.of([
        ['🔄 Renew Now ($' + num.planPrice + ')'],
        [pc.changePlan],
        ['🔁 Auto-Renew: ' + (newState ? '✅ ON' : '❌ OFF')],
      ]))
    }
    // Renew Now
    if (message.startsWith('🔄 Renew Now')) {
      await saveInfo('cpPrice', num.planPrice)
      await saveInfo('cpPlanKey', num.plan)
      await saveInfo('cpSelectedNumber', num.phoneNumber)
      await saveInfo('price', num.planPrice)
      return goto['phone-pay']()
    }
    // Change Plan
    if (message === pc.changePlan) {
      set(state, chatId, 'action', a.cpChangePlan)
      const currentPlan = num.plan
      const btns = []
      if (currentPlan !== 'starter' && phoneConfig.isPlanAvailable('starter')) btns.push([`💡 Downgrade to Starter — $${phoneConfig.PHONE_STARTER_PRICE}/mo`])
      if (currentPlan !== 'starter' && !phoneConfig.isPlanAvailable('starter')) btns.push([`💡 Starter — Coming Soon 🔜`])
      if (currentPlan !== 'pro' && phoneConfig.isPlanAvailable('pro')) btns.push([`⭐ ${currentPlan === 'starter' ? 'Upgrade' : 'Change'} to Pro — $${phoneConfig.PHONE_PRO_PRICE}/mo`])
      if (currentPlan !== 'pro' && !phoneConfig.isPlanAvailable('pro')) btns.push([`⭐ Pro — Coming Soon 🔜`])
      if (currentPlan !== 'business' && phoneConfig.isPlanAvailable('business')) btns.push([`👑 Upgrade to Business — $${phoneConfig.PHONE_BUSINESS_PRICE}/mo`])
      if (currentPlan !== 'business' && !phoneConfig.isPlanAvailable('business')) btns.push([`👑 Business — Coming Soon 🔜`])
      return send(chatId, phoneConfig.getMsg(info?.userLanguage).changePlanHeader(num.phoneNumber, num.plan, num.planPrice), k.of(btns))
    }
    return send(chatId, phoneConfig.getMsg(info?.userLanguage).selectOption)
  }
  if (action === a.cpChangePlan) {
    const pc = phoneConfig.btn
    const num = info?.cpActiveNumber
    if (!num) return goto.submenu5()
    if (message === t.back || message === pc.back) {
      set(state, chatId, 'action', a.cpRenewPlan)
      const plan = phoneConfig.plans[num.plan] || { name: num.plan, price: num.planPrice }
      return send(chatId, phoneConfig.txt.renewMenu(num.phoneNumber, plan.name, num.planPrice, num.expiresAt, num.autoRenew), k.of([
        ['🔄 Renew Now ($' + num.planPrice + ')'],
        [pc.changePlan],
        ['🔁 Auto-Renew: ' + (num.autoRenew ? '✅ ON' : '❌ OFF')],
      ]))
    }

    // Block "Coming Soon" plans
    if (message.includes('Coming Soon')) {
      const comingPlan = message.includes('Starter') ? 'starter' : message.includes('Pro') ? 'pro' : message.includes('Business') ? 'business' : null
      if (comingPlan) {
        return send(chatId, phoneConfig.comingSoonText(comingPlan), k.of([
          [pc.changePlan],
        ]))
      }
    }


    // Check if this is a confirmation of a pending plan change
    if (message === '✅ Confirm Change' && info?.cpPendingPlan) {
      const newPlan = info.cpPendingPlan
      const oldPlan = num.plan
      const newPrice = phoneConfig.plans[newPlan].price
      const oldPrice = phoneConfig.plans[oldPlan]?.price || num.planPrice

      // Determine if upgrade or downgrade
      const planOrder = { starter: 1, pro: 2, business: 3 }
      const isUpgrade = (planOrder[newPlan] || 0) > (planOrder[oldPlan] || 0)

      // For upgrades: charge pro-rated difference for remaining days
      if (isUpgrade) {
        const expiresAt = num.expiresAt ? new Date(num.expiresAt) : null
        let chargeAmount = 0
        if (expiresAt && expiresAt > new Date()) {
          const daysRemaining = Math.ceil((expiresAt - new Date()) / (1000 * 60 * 60 * 24))
          const daysInMonth = 30
          const dailyDiff = (newPrice - oldPrice) / daysInMonth
          chargeAmount = Math.max(0, parseFloat((dailyDiff * daysRemaining).toFixed(2)))
        } else {
          chargeAmount = newPrice - oldPrice
        }

        if (chargeAmount > 0) {
          let walletBal = 0
          try { const { usdBal } = await getBalance(walletOf, chatId); walletBal = usdBal } catch (e) {}
          if (walletBal < chargeAmount) {
            await saveInfo('cpPendingPlan', null)
            send(chatId, phoneConfig.getMsg(info?.userLanguage).insufficientBalUpgrade(chargeAmount, walletBal))
            set(state, chatId, 'action', a.cpManageNumber)
            return send(chatId, phoneConfig.txt.manageNumber(num), k.of(buildManageMenu(num)))
          }
          // Deduct the pro-rated amount
          await atomicIncrement(walletOf, chatId, 'usdBal', -chargeAmount)
        }
      }
      // For downgrades: no refund, change takes effect immediately

      await updatePhoneNumberField(phoneNumbersOf, chatId, num.phoneNumber, 'plan', newPlan)
      await updatePhoneNumberField(phoneNumbersOf, chatId, num.phoneNumber, 'planPrice', newPrice)
      num.plan = newPlan
      num.planPrice = newPrice

      // Auto-disable features the new plan doesn't support
      const downgradeNotices = []
      if (!phoneConfig.canAccessFeature(newPlan, 'sipCredentials') && !num.sipDisabled) {
        await updatePhoneNumberField(phoneNumbersOf, chatId, num.phoneNumber, 'sipDisabled', true)
        num.sipDisabled = true
        downgradeNotices.push('🔑 SIP Credentials have been disabled')
      }
      if (!phoneConfig.canAccessFeature(newPlan, 'ivr') && num.features?.ivr?.enabled) {
        await updatePhoneNumberFeature(phoneNumbersOf, chatId, num.phoneNumber, 'ivr', { enabled: false })
        num.features = num.features || {}
        num.features.ivr = { enabled: false }
        downgradeNotices.push('🤖 IVR / Auto-attendant has been disabled')
      }
      if (!phoneConfig.canAccessFeature(newPlan, 'callRecording') && num.features?.recording === true) {
        await updatePhoneNumberFeature(phoneNumbersOf, chatId, num.phoneNumber, 'recording', false)
        num.features = num.features || {}
        num.features.recording = false
        downgradeNotices.push('🔴 Call Recording has been disabled')
      }
      if (!phoneConfig.canAccessFeature(newPlan, 'voicemail') && num.features?.voicemail?.enabled) {
        await updatePhoneNumberFeature(phoneNumbersOf, chatId, num.phoneNumber, 'voicemail', { enabled: false })
        num.features = num.features || {}
        num.features.voicemail = { enabled: false }
        downgradeNotices.push('🎙️ Voicemail has been disabled')
      }
      if (!phoneConfig.canAccessFeature(newPlan, 'smsToEmail') && num.features?.smsForwarding?.toEmail) {
        const smsConf = num.features?.smsForwarding || {}
        smsConf.toEmail = null
        smsConf.webhookUrl = null
        await updatePhoneNumberFeature(phoneNumbersOf, chatId, num.phoneNumber, 'smsForwarding', smsConf)
        num.features.smsForwarding = smsConf
        downgradeNotices.push('📧 SMS to Email & Webhook have been disabled')
      }

      // Re-enable SIP if upgrading to a plan that supports it
      if (phoneConfig.canAccessFeature(newPlan, 'sipCredentials') && num.sipDisabled) {
        await updatePhoneNumberField(phoneNumbersOf, chatId, num.phoneNumber, 'sipDisabled', false)
        num.sipDisabled = false
      }

      await saveInfo('cpActiveNumber', num)
      await saveInfo('cpPendingPlan', null)
      const m = phoneConfig.getMsg(info?.userLanguage)
      let confirmMsg = m.planChanged(newPlan, newPrice)
      if (downgradeNotices.length > 0) {
        confirmMsg += `\n\n⚠️ <b>${m.featuresDisabled}</b>\n` + downgradeNotices.join('\n')
      }
      send(chatId, confirmMsg)
      set(state, chatId, 'action', a.cpManageNumber)
      return send(chatId, phoneConfig.txt.manageNumber(num), k.of(buildManageMenu(num)))
    }

    let newPlan = null
    if (message.includes('Starter')) newPlan = 'starter'
    if (message.includes('Pro')) newPlan = 'pro'
    if (message.includes('Business')) newPlan = 'business'
    if (!newPlan) return send(chatId, phoneConfig.getMsg(info?.userLanguage).selectValidPlan)
    const oldPlan = num.plan

    // Check what features will be lost on downgrade
    const lostFeatures = []
    if (!phoneConfig.canAccessFeature(newPlan, 'sipCredentials') && phoneConfig.canAccessFeature(oldPlan, 'sipCredentials')) {
      lostFeatures.push('🔑 SIP Credentials')
    }
    if (!phoneConfig.canAccessFeature(newPlan, 'ivr') && phoneConfig.canAccessFeature(oldPlan, 'ivr')) {
      lostFeatures.push('🤖 IVR / Auto-attendant')
    }
    if (!phoneConfig.canAccessFeature(newPlan, 'callRecording') && phoneConfig.canAccessFeature(oldPlan, 'callRecording')) {
      lostFeatures.push('🔴 Call Recording')
    }
    if (!phoneConfig.canAccessFeature(newPlan, 'voicemail') && phoneConfig.canAccessFeature(oldPlan, 'voicemail')) {
      lostFeatures.push('🎙️ Voicemail')
    }
    if (!phoneConfig.canAccessFeature(newPlan, 'smsToEmail') && phoneConfig.canAccessFeature(oldPlan, 'smsToEmail')) {
      lostFeatures.push('📧 SMS to Email & Webhook')
    }

    // If downgrading with feature loss, show warning first
    if (lostFeatures.length > 0) {
      const newPrice = phoneConfig.plans[newPlan].price
      const oldPlanMinutes = phoneConfig.plans[oldPlan]?.minutes || 0
      const newPlanMinutes = phoneConfig.plans[newPlan]?.minutes || 0
      const oldPlanSms = phoneConfig.plans[oldPlan]?.sms || 0
      const newPlanSms = phoneConfig.plans[newPlan]?.sms || 0

      let warningMsg = `⚠️ <b>Downgrade Warning</b>\n\n`
      warningMsg += `${oldPlan.charAt(0).toUpperCase() + oldPlan.slice(1)} → <b>${newPlan.charAt(0).toUpperCase() + newPlan.slice(1)}</b> ($${newPrice}/mo)\n\n`
      warningMsg += `<b>Features you will lose:</b>\n${lostFeatures.join('\n')}\n\n`
      warningMsg += `<b>Limits change:</b>\n`
      warningMsg += `📞 Minutes: ${oldPlanMinutes} → ${newPlanMinutes}\n`
      warningMsg += `📩 SMS: ${oldPlanSms} → ${newPlanSms}\n\n`
      warningMsg += `These features will be <b>immediately disabled</b>.\n⚠️ <b>No refund</b> for the remaining billing period.\n\nContinue?`

      await saveInfo('cpPendingPlan', newPlan)
      return send(chatId, warningMsg, k.of([['✅ Confirm Change', pc.back]]))
    }

    // No feature loss (upgrade or same-tier) — show what they'll gain and confirm
    const newPrice = phoneConfig.plans[newPlan].price
    const gainedFeatures = []
    if (phoneConfig.canAccessFeature(newPlan, 'sipCredentials') && !phoneConfig.canAccessFeature(oldPlan, 'sipCredentials')) {
      gainedFeatures.push('🔑 SIP Credentials')
    }
    if (phoneConfig.canAccessFeature(newPlan, 'voicemail') && !phoneConfig.canAccessFeature(oldPlan, 'voicemail')) {
      gainedFeatures.push('🎙️ Voicemail')
    }
    if (phoneConfig.canAccessFeature(newPlan, 'smsToEmail') && !phoneConfig.canAccessFeature(oldPlan, 'smsToEmail')) {
      gainedFeatures.push('📧 SMS to Email & Webhook')
    }
    if (phoneConfig.canAccessFeature(newPlan, 'callRecording') && !phoneConfig.canAccessFeature(oldPlan, 'callRecording')) {
      gainedFeatures.push('🔴 Call Recording')
    }
    if (phoneConfig.canAccessFeature(newPlan, 'ivr') && !phoneConfig.canAccessFeature(oldPlan, 'ivr')) {
      gainedFeatures.push('🤖 IVR / Auto-attendant')
    }

    const oldPlanObj = phoneConfig.plans[oldPlan]
    const newPlanObj = phoneConfig.plans[newPlan]

    // Calculate pro-rated charge
    const expiresAt = num.expiresAt ? new Date(num.expiresAt) : null
    let chargeAmount = 0
    if (expiresAt && expiresAt > new Date()) {
      const daysRemaining = Math.ceil((expiresAt - new Date()) / (1000 * 60 * 60 * 24))
      const daysInMonth = 30
      const dailyDiff = (newPrice - (oldPlanObj?.price || num.planPrice)) / daysInMonth
      chargeAmount = Math.max(0, parseFloat((dailyDiff * daysRemaining).toFixed(2)))
    } else {
      chargeAmount = newPrice - (oldPlanObj?.price || num.planPrice)
    }

    // Check wallet balance
    let walletBal = 0
    try { const { usdBal } = await getBalance(walletOf, chatId); walletBal = usdBal } catch (e) {}

    let upgradeMsg = `⬆️ <b>Upgrade Preview</b>\n\n`
    upgradeMsg += `${oldPlan.charAt(0).toUpperCase() + oldPlan.slice(1)} → <b>${newPlan.charAt(0).toUpperCase() + newPlan.slice(1)}</b> ($${newPrice}/mo)\n\n`
    if (gainedFeatures.length > 0) {
      upgradeMsg += `<b>New features you'll unlock:</b>\n${gainedFeatures.join('\n')}\n\n`
    }
    upgradeMsg += `<b>Limits upgrade:</b>\n`
    upgradeMsg += `📞 Minutes: ${oldPlanObj?.minutes || 0} → ${newPlanObj?.minutes === 'Unlimited' ? 'Unlimited' : newPlanObj?.minutes || 0}\n`
    upgradeMsg += `📩 SMS: ${oldPlanObj?.sms || 0} → ${newPlanObj?.sms || 0}\n\n`
    if (chargeAmount > 0) {
      upgradeMsg += `💰 <b>Pro-rated charge: $${chargeAmount.toFixed(2)}</b>\n`
      upgradeMsg += `👛 Wallet: $${walletBal.toFixed(2)}`
      if (walletBal < chargeAmount) {
        upgradeMsg += ` ⚠️ <b>Insufficient — top up $${(chargeAmount - walletBal).toFixed(2)} first</b>`
      }
      upgradeMsg += `\n\n`
    }
    upgradeMsg += `Confirm upgrade?`

    await saveInfo('cpPendingPlan', newPlan)
    return send(chatId, upgradeMsg, k.of([['✅ Confirm Change', pc.back]]))
  }

  // ━━━ RELEASE NUMBER ━━━
  if (action === a.cpReleaseConfirm) {
    const pc = phoneConfig.btn
    const num = info?.cpActiveNumber
    if (!num) return goto.submenu5()
    if (message === pc.noKeep || message === t.back) {
      set(state, chatId, 'action', a.cpManageNumber)
      return send(chatId, phoneConfig.txt.manageNumber(num), k.of(buildManageMenu(num)))
    }
    if (message === pc.yesRelease) {
      const last4 = num.phoneNumber.replace(/\D/g, '').slice(-4)
      set(state, chatId, 'action', a.cpReleaseDigits)
      return send(chatId, phoneConfig.txt.releaseConfirmDigits(last4))
    }
    return send(chatId, phoneConfig.getMsg(info?.userLanguage).confirmOrCancel)
  }
  if (action === a.cpReleaseDigits) {
    const pc = phoneConfig.btn
    const num = info?.cpActiveNumber
    if (!num) return goto.submenu5()
    if (message === t.back || message === pc.back) {
      set(state, chatId, 'action', a.cpReleaseConfirm)
      return send(chatId, phoneConfig.txt.releaseConfirm(num.phoneNumber), k.of([[pc.yesRelease, pc.noKeep]]))
    }
    const last4 = num.phoneNumber.replace(/\D/g, '').slice(-4)
    if (message !== last4) return send(chatId, phoneConfig.getMsg(info?.userLanguage).typeLast4(last4))

    // Release on provider
    if (num.provider === 'twilio' && num.twilioNumberSid) {
      // Twilio number — may be on sub-account
      const userData = await get(phoneNumbersOf, chatId)
      const subSid = userData?.twilioSubAccountSid
      const subToken = userData?.twilioSubAccountToken
      await twilioService.releaseNumber(num.twilioNumberSid, subSid, subToken)
    } else if (num.telnyxOrderId) {
      const ok = await telnyxApi.releaseNumber(num.telnyxOrderId)
      if (!ok) await telnyxApi.releaseByPhoneNumber(num.phoneNumber)
    } else {
      await telnyxApi.releaseByPhoneNumber(num.phoneNumber)
    }

    // Update DB
    await updatePhoneNumberField(phoneNumbersOf, chatId, num.phoneNumber, 'status', 'released')
    const name = await get(nameOf, chatId)
    notifyGroup(phoneConfig.txt.adminRelease(maskName(name), num.phoneNumber, num.plan))
    
    // Log transaction
    await phoneTransactions.insertOne({
      chatId, phoneNumber: num.phoneNumber,
      action: 'release', plan: num.plan,
      amount: 0, paymentMethod: 'none',
      timestamp: new Date().toISOString(),
    })

    send(chatId, phoneConfig.txt.released(num.phoneNumber), trans('o'))
    return
  }
  if (action === a.phoneNumberLeads) {
    const phoneNumberLeads = trans('phoneNumberLeads')
    if (phoneNumberLeads[1] === message) return goto.validatorSelectCountry()
    if (phoneNumberLeads[0] === message) return goto.targetSelectTarget()

    return send(chatId, t.what)
  }
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // TARGET LEADS HANDLERS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (action === a.targetSelectTarget) {
    if (message === t.back) return goto.displayMainMenuButtons ? goto.displayMainMenuButtons() : send(chatId, t.userPressedBtn(message), isAdmin(chatId) ? aO : trans('o'))
    const validateBtn = trans('phoneNumberLeads')[1] || '✅📲 Validate PhoneLeads'
    if (message === validateBtn) return goto.validatorSelectCountry()
    if (message === '📝 Request Custom Target') return goto.customLeadRequestName()
    if (!targetLeadsTargets.includes(message)) return send(chatId, t.what)
    await saveInfo('targetName', message)
    await saveInfo('country', 'USA')
    return goto.targetSelectCity()
  }
  if (action === a.targetSelectCity) {
    if (message === t.back) return goto.targetSelectTarget()
    const target = info?.targetName
    const validCities = ['All Cities', ...targetLeadsCities(target)]
    if (!validCities.includes(message)) return send(chatId, t.what)
    await saveInfo('targetCity', message)
    if (message === 'All Cities') {
      const allCodes = targetLeadsAreaCodes(target, 'All Cities')
      await saveInfo('areaCode', 'Mixed Area Codes')
      await saveInfo('targetAreaCodes', allCodes)
      await saveInfo('cameFrom', a.targetSelectAreaCode)
      return goto.buyLeadsSelectCarrier()
    }
    return goto.targetSelectAreaCode()
  }
  if (action === a.targetSelectAreaCode) {
    if (message === t.back) return goto.targetSelectCity()
    const target = info?.targetName
    const city = info?.targetCity
    const validButtons = targetLeadsAreaCodeButtons(target, city)
    if (!validButtons.includes(message)) return send(chatId, t.what)

    let areaCodes
    if (message === 'Mixed Area Codes') {
      areaCodes = targetLeadsAreaCodes(target, city)
    } else {
      areaCodes = [parse('1', message)]
    }
    await saveInfo('areaCode', message === 'Mixed Area Codes' ? message : parse('1', message))
    await saveInfo('targetAreaCodes', areaCodes)
    await saveInfo('cameFrom', a.targetSelectAreaCode)
    return goto.buyLeadsSelectCarrier()
  }
  if (action === a.targetLeadsConfirm) {
    if (message === t.back) return goto.buyLeadsSelectAmount()
    if (message === '🎟️ Apply Coupon') {
      return goto.askCoupon(a.buyLeadsSelectFormat)
    }
    if (message.startsWith('✅ Pay') || message.startsWith('✅ Confirm')) {
      return goto['leads-pay']()
    }
    return send(chatId, t.what)
  }
  // ═══════════════════════════════════════════════════
  // Custom Lead Request Flow
  // ═══════════════════════════════════════════════════
  if (action === a.customLeadRequestName) {
    if (message === (t.backButton || '⬅️ Back')) return goto.targetSelectTarget()
    if (message.length < 2 || message.length > 100) return send(chatId, t.validInstitutionName)
    await saveInfo('customLeadTarget', message)
    return goto.customLeadRequestCity()
  }
  if (action === a.customLeadRequestCity) {
    if (message === (t.backButton || '⬅️ Back')) return goto.customLeadRequestName()
    if (message.length < 2 || message.length > 100) return send(chatId, t.validCityName)
    await saveInfo('customLeadCity', message)
    return goto.customLeadRequestDetails()
  }
  if (action === a.customLeadRequestDetails) {
    if (message === (t.backButton || '⬅️ Back')) return goto.customLeadRequestCity()
    const details = message === 'None' ? '' : message
    const target = info?.customLeadTarget
    const city = info?.customLeadCity
    const name = await get(nameOf, chatId)

    // Save request to DB
    const requestId = nanoid()
    await set(leadRequests, requestId, {
      chatId,
      username: name || msg?.from?.username || 'unknown',
      target,
      city,
      details,
      status: 'pending',
      createdAt: new Date().toISOString()
    })

    // Notify admin — direct message only, not groups
    send(TELEGRAM_ADMIN_CHAT_ID, `📝 <b>New Lead Request</b>\n\nFrom: <b>${name || 'unknown'}</b> (${chatId})\n@${msg?.from?.username || 'no_username'}\n\n🎯 Target: <b>${target}</b>\n🏙️ Area: <b>${city}</b>\n📋 Details: ${details || '<i>none</i>'}\n\nID: <code>${requestId}</code>`, { parse_mode: 'HTML' })

    // Confirm to user
    set(state, chatId, 'action', 'none')
    send(chatId, `✅ <b>Request Submitted!</b>\n\n🎯 Target: <b>${target}</b>\n🏙️ Area: <b>${city}</b>${details ? `\n📋 Details: ${details}` : ''}\n\nOur team will review your request and notify you once these leads are available. Thank you!`, { parse_mode: 'HTML', ...trans('o') })
    log(`[LeadRequest] ${chatId} requested: ${target} — ${city} (${details || 'no details'})`)
    return
  }
  if (action === a.buyLeadsSelectCountry) {
    if (message === t.back) goto.phoneNumberLeads()
    if (!buyLeadsSelectCountry.includes(message)) return send(chatId, t.what)
    if (areasOfCountry[message] && Object.keys(areasOfCountry[message]).length === 0) return send(chatId, t.comingSoon)
    saveInfo('country', message)
    return goto.buyLeadsSelectSmsVoice()
  }
  if (action === a.buyLeadsSelectSmsVoice) {
    if (message === t.back) return goto.buyLeadsSelectCountry()
    const buyLeadsSelectSmsVoice = trans('buyLeadsSelectSmsVoice')
    if (buyLeadsSelectSmsVoice[1] === message) return send(chatId, t.comingSoon)
    if (!buyLeadsSelectSmsVoice.includes(message)) return send(chatId, t.what)
    saveInfo('smsVoice', message)
    saveInfo('cameFrom', a.buyLeadsSelectSmsVoice)
    if (['Australia'].includes(info?.country)) return goto.buyLeadsSelectCarrier()
    if (['USA', 'Canada'].includes(info?.country)) return goto.buyLeadsSelectArea()
    return goto.buyLeadsSelectAreaCode()
  }
  if (action === a.buyLeadsSelectArea) {
    if (message === t.back) return goto.buyLeadsSelectSmsVoice()
    if (!buyLeadsSelectArea(info?.country).includes(message)) return send(chatId, t.what)
    await saveInfo('area', message)
    saveInfo('cameFrom', a.buyLeadsSelectArea)
    return goto.buyLeadsSelectAreaCode()
  }
  if (action === a.buyLeadsSelectAreaCode) {
    if (message === t.back) return ['USA', 'Canada'].includes(info?.country) ? goto.buyLeadsSelectArea() : goto.buyLeadsSelectSmsVoice()
    const areaCodes = buyLeadsSelectAreaCode(
      info?.country,
      ['USA', 'Canada'].includes(info?.country) ? info?.area : 'Area Codes',
    )
    if (!areaCodes.includes(message)) return send(chatId, t.what)

    let cc = countryCodeOf[info?.country]
    saveInfo('areaCode', message === 'Mixed Area Codes' ? message : parse(cc, message))

    return goto.buyLeadsSelectCarrier()
  }
  if (action === a.buyLeadsSelectCarrier) {
    if (message === t.back) {
      if (info?.targetName) {
        return info?.targetCity === 'All Cities' ? goto.targetSelectCity() : goto.targetSelectAreaCode()
      }
      return ['Australia'].includes(info?.country) ? goto.buyLeadsSelectSmsVoice() : goto.buyLeadsSelectAreaCode()
    }
    if (!buyLeadsSelectCarrier(info?.country).includes(message)) return send(chatId, t.what)
    saveInfo('carrier', message)
    saveInfo('cameFrom', a.buyLeadsSelectCarrier)
    return goto.buyLeadsSelectAmount()
  }
  if (action === a.buyLeadsSelectCnam) {
    if (message === t.back) return goto.buyLeadsSelectCarrier()
    if (!buyLeadsSelectCnam.includes(message)) return send(chatId, t.what)
    saveInfo('cnam', message === t.yes)
    saveInfo('cameFrom', a.buyLeadsSelectCnam)
    return goto.buyLeadsSelectAmount()
  }
  if (action === a.buyLeadsSelectAmount) {
    if (message === t.back) return goto?.[info?.cameFrom]()

    const amount = Number(message)
    if (chatId === 6687923716) {
      if (isNaN(amount)) return send(chatId, t.whatNum)
    } else if (
      isNaN(amount) ||
      amount < Number(buyLeadsSelectAmount[0]) ||
      amount > Number(buyLeadsSelectAmount[buyLeadsSelectAmount.length - 1])
    )
      return send(chatId, t.whatNum)

    saveInfo('amount', amount)
    const price = amount * RATE_LEAD
    await saveInfo('price', price)
    if (info?.targetName) {
      await saveInfo('format', 'International Format')
      await saveInfo('lastStep', a.buyLeadsSelectFormat)
      return goto.targetLeadsConfirm()
    }
    return goto.buyLeadsSelectFormat()
  }
  if (action === a.buyLeadsSelectFormat) {
    if (message === t.back) return goto.buyLeadsSelectAmount()
    const buyLeadsSelectFormatType = trans('buyLeadsSelectFormat')
    if (!buyLeadsSelectFormatType.includes(message)) return send(chatId, t.what)
    const formatType = trans('selectFormatOf') 
    saveInfo('format', formatType[message])
    return goto.askCoupon(a.buyLeadsSelectFormat)
  }
  if (action === a.askCoupon + a.buyLeadsSelectFormat) {
    if (message === t.back) {
      if (info?.targetName) return goto.targetLeadsConfirm()
      return goto.buyLeadsSelectFormat()
    }
    if (message === t.skip) {
      saveInfo('lastStep', a.buyLeadsSelectFormat)
      await saveInfo('couponApplied', false)
      if (info?.targetName) return goto.targetLeadsConfirm()
      return goto['leads-pay']()
    }

    const { price } = info

    const coupon = message.toUpperCase()
    const couponResult = await resolveCoupon(coupon, chatId)

    if (!couponResult) return send(chatId, t.couponInvalid)
    if (couponResult.error === 'already_used') return send(chatId, '⚠️ You have already used this coupon today.')

    const newPrice = price - (price * couponResult.discount) / 100
    await saveInfo('newPrice', newPrice)
    await saveInfo('couponApplied', true)

    await saveInfo('lastStep', a.buyLeadsSelectFormat)
    if (couponResult.type === 'daily') await dailyCouponSystem.markCouponUsed(couponResult.code, chatId)

    if (info?.targetName) return goto.targetLeadsConfirm()
    return goto['leads-pay']()
  }

  //phone number validator
  if (action === a.validatorSelectCountry) {
    if (message === t.back) return goto.phoneNumberLeads()
    if (!validatorSelectCountry.includes(message)) return send(chatId, t.what)
    saveInfo('country', message)
    return goto.validatorPhoneNumber()
  }

  // get phone on file
  if (action === a.validatorPhoneNumber) {
    if (message === t.back) return goto.validatorSelectCountry()
    let content

    if (msg.document) {
      try {
        const fileLink = await bot?.getFileLink(msg.document.file_id)
        content = (await axios.get(fileLink, { responseType: 'text' }))?.data
      } catch (error) {
        console.error('Error:', error.message)
        return send(chatId, t.fileError)
      }
    } else {
      content = message
    }

    let cc = countryCodeOf[info?.country]
    const { phones, diff } = extractPhoneNumbers(content, cc)
    if (phones < diff) return send(chatId, t.validatorErrorFileData) // good phones are less than bad ones
    if (phones.length === 0) return send(chatId, t.validatorErrorNoPhonesFound)
    await saveInfo('phones', phones)
    saveInfo('amount', phones.length)

    return goto.validatorSelectSmsVoice()
  }

  if (action === a.validatorSelectSmsVoice) {
    if (message === t.back) return goto.validatorPhoneNumber()
    const validatorSelectSmsVoice = trans('validatorSelectSmsVoice')
    if (validatorSelectSmsVoice[1] === message) return send(chatId, t.comingSoon)
    if (!validatorSelectSmsVoice.includes(message)) return send(chatId, t.what)
    saveInfo('smsVoice', message)
    return goto.validatorSelectCarrier() //////
  }

  if (action === a.validatorSelectCarrier) {
    if (message === t.back) return goto.validatorSelectSmsVoice()
    if (!validatorSelectCarrier(info?.country).includes(message)) return send(chatId, t.what)
    saveInfo('carrier', message)
    saveInfo('history', [...(info?.history || []), a.validatorSelectCarrier])
    if (!['USA'].includes(info?.country) && info?.phones.length < 2000) {
      return goto.validatorSelectFormat()
    }
    if (!['USA'].includes(info?.country)) return goto.validatorSelectAmount()
    // CNAM (phone owner name) is always included for USA — skip opt-in
    saveInfo('cnam', true)
    if (info?.phones.length < 2000) {
      const cnam = true
      const price = info?.amount * RATE_LEAD_VALIDATOR + (cnam ? info?.amount * RATE_CNAM_VALIDATOR : 0)
      saveInfo('price', price)
      return goto.validatorSelectFormat()
    }
    return goto.validatorSelectAmount()
  }
  if (action === a.validatorSelectCnam) {
    if (message === t.back) return goBack()
    const validatorSelectCnam = trans('validatorSelectCnam')
    if (!validatorSelectCnam.includes(message)) return send(chatId, t.what)
    saveInfo('cnam', message === t.yes)
    saveInfo('history', [...(info?.history || []), a.validatorSelectCnam])

    if (info?.phones.length < 2000) {
      let cnam = info?.country === 'USA' ? true : false
      const price = info?.amount * RATE_LEAD_VALIDATOR + (cnam ? info?.amount * RATE_CNAM_VALIDATOR : 0)
      saveInfo('price', price)

      return goto.validatorSelectFormat()
    }

    return goto.validatorSelectAmount()
  }

  if (action === a.validatorSelectAmount) {
    if (message === t.back) return goBack()
    let amount = message
    if (message.toLowerCase() === 'all') {
      amount = info?.phones.length
    }
    if (isNaN(amount)) return send(chatId, t.ammountIncorrect)
    saveInfo('amount', Number(amount))
    saveInfo('history', [...(info?.history || []), a.validatorSelectAmount])
    let cnam = info?.country === 'USA' ? info?.cnam : false
    const price = amount * RATE_LEAD_VALIDATOR + (cnam ? amount * RATE_CNAM_VALIDATOR : 0)
    saveInfo('price', price)
    return goto.validatorSelectFormat()
  }
  if (action === a.validatorSelectFormat) {
    if (message === t.back) return goBack()
    const validatorSelectFormatType = trans('validatorSelectFormat')
    if (!validatorSelectFormatType.includes(message)) return send(chatId, t.what)
    const formatType = trans('selectFormatOf') 
    saveInfo('format', formatType[message])
    return goto.askCoupon(a.validatorSelectFormat)
  }
  if (action === a.askCoupon + a.validatorSelectFormat) {
    if (message === t.back) return goto.validatorSelectFormat()

    // Check for free USA validations before going to payment
    const _checkFreeValidation = async () => {
      if (info?.country === 'USA' && (await isSubscribed(chatId))) {
        const freeRemaining = (await get(freeValidationsAvailableFor, chatId)) || 0
        if (freeRemaining >= info?.amount) {
          return 'full' // all validations covered by free quota
        }
        if (freeRemaining > 0) {
          return 'partial' // some free, rest must be paid
        }
      }
      return false
    }

    if (message === t.skip) {
      saveInfo('lastStep', a.validatorSelectFormat)
      await saveInfo('couponApplied', false)
      const freeCheck = await _checkFreeValidation()
      if (freeCheck === 'full') {
        return goto.useFreeValidation()
      }
      if (freeCheck === 'partial') {
        return goto.usePartialFreeValidation()
      }
      return goto['leads-pay']()
    }

    const { price } = info

    const coupon = message.toUpperCase()
    const couponResult = await resolveCoupon(coupon, chatId)
    if (!couponResult) return send(chatId, t.couponInvalid)
    if (couponResult.error === 'already_used') return send(chatId, '⚠️ You have already used this coupon today.')

    const newPrice = price - (price * couponResult.discount) / 100
    await saveInfo('newPrice', newPrice)
    await saveInfo('couponApplied', true)

    await saveInfo('lastStep', a.validatorSelectFormat)
    if (couponResult.type === 'daily') await dailyCouponSystem.markCouponUsed(couponResult.code, chatId)

    const freeCheck2 = await _checkFreeValidation()
    if (freeCheck2 === 'full') {
      return goto.useFreeValidation()
    }
    if (freeCheck2 === 'partial') {
      return goto.usePartialFreeValidation()
    }
    return goto['leads-pay']()
  }

  if (message === user.joinChannel) {
    return send(chatId, t.joinChannel)
  }

  if (message === user.viewPlan) {
    // ── Aggregate all subscriptions ──
    let sections = []
    let hasAnySub = false

    // 1. Bot Subscription (Daily/Weekly/Monthly plan)
    const subscribedPlan = await get(planOf, chatId)
    if (subscribedPlan) {
      const rawTime = await get(planEndingTime, chatId)
      const timeEnd = new Date(rawTime)
      const MAX_REASONABLE_MS = 31 * 86400 * 1000
      if (rawTime > Date.now() + MAX_REASONABLE_MS) {
        log(`[viewPlan] Anomalous planEndingTime for chatId ${chatId}: ${timeEnd.toISOString()} — auto-expiring`)
        set(planEndingTime, chatId, 0)
        sections.push(`📦 <b>Bot Plan:</b> ${subscribedPlan} — ❌ Expired`)
      } else if (await isSubscribed(chatId)) {
        const daysLeft = Math.ceil((rawTime - Date.now()) / 86400000)
        sections.push(`📦 <b>Bot Plan:</b> ${subscribedPlan}\n   ✅ Active · Expires ${timeEnd.toLocaleDateString()} (${daysLeft}d left)`)
        hasAnySub = true
      } else {
        sections.push(`📦 <b>Bot Plan:</b> ${subscribedPlan} — ❌ Expired ${timeEnd.toLocaleDateString()}`)
      }
    }

    // 2. Cloud Phone Numbers
    try {
      const phoneData = await get(phoneNumbersOf, chatId)
      const numbers = phoneData?.numbers || []
      const activeNums = numbers.filter(n => n.status === 'active')
      if (activeNums.length > 0) {
        hasAnySub = true
        let cpText = `📞 <b>CloudPhone:</b> ${activeNums.length} number${activeNums.length > 1 ? 's' : ''}`
        activeNums.forEach(n => {
          const plan = n.plan ? n.plan.charAt(0).toUpperCase() + n.plan.slice(1) : '—'
          const exp = n.expiresAt ? new Date(n.expiresAt).toLocaleDateString() : '—'
          const dLeft = n.expiresAt ? Math.ceil((new Date(n.expiresAt) - Date.now()) / 86400000) : 0
          cpText += `\n   ${phoneConfig.formatPhone(n.phoneNumber)} · ${plan} · ${exp}${dLeft > 0 ? ` (${dLeft}d)` : ''}`
        })
        sections.push(cpText)
      }
    } catch (e) {}

    // 3. VPS Plans
    try {
      const vpsData = await vpsPlansOf.findOne({ _id: String(chatId) })
      const vpsPlans = vpsData?.val?.plans || vpsData?.plans || []
      if (vpsPlans.length > 0) {
        let vpsText = `🖥️ <b>VPS:</b> ${vpsPlans.length} server${vpsPlans.length > 1 ? 's' : ''}`
        vpsPlans.forEach(v => {
          const exp = v.expiresAt ? new Date(v.expiresAt).toLocaleDateString() : '—'
          const name = v.name || v.hostname || v.planType || 'VPS'
          const status = v.status === 'active' ? '✅' : '❌'
          vpsText += `\n   ${status} ${name} · ${exp}`
          hasAnySub = true
        })
        sections.push(vpsText)
      }
    } catch (e) {}

    // 4. Hosting Plans (from cpanelAccounts)
    try {
      const hostingPlans = await cpanelAccounts.find({ chatId: String(chatId) }).toArray()
      if (hostingPlans.length > 0) {
        let hostingText = `🌐 <b>Hosting:</b> ${hostingPlans.length} plan${hostingPlans.length > 1 ? 's' : ''}`
        for (const hp of hostingPlans) {
          const exp = hp.expiryDate ? new Date(hp.expiryDate).toLocaleDateString() : '—'
          const isExpired = hp.expiryDate && new Date(hp.expiryDate) < new Date()
          const status = isExpired ? '❌' : '✅'
          hostingText += `\n   ${status} ${hp.domain} (${hp.plan}) · ${exp}`
          if (!isExpired) hasAnySub = true
        }
        sections.push(hostingText)
      }
    } catch (e) {}

    if (sections.length === 0) {
      send(chatId, t.planNotSubscriped)
      return
    }

    const header = hasAnySub ? '📋 <b>My Subscriptions</b>\n' : '📋 <b>My Subscriptions</b>\n\n<i>No active subscriptions.</i>\n'
    send(chatId, header + '\n' + sections.join('\n\n'), { parse_mode: 'HTML' })
    return
  }
  if (message === user.becomeReseller) {
    return send(chatId, t.becomeReseller)
  }
  if (message === user.viewShortLinks) {
    const links = await getShortLinks(chatId)
    if (links.length === 0) {
      send(chatId, t.noShortenedUrlLink, k.of([[user.urlShortener], [t.back]]))
      return
    }

    const linksText = formatLinks(links.slice(-20)).join('\n\n')
    send(chatId, t.shortenedLinkText(linksText), k.of([[user.urlShortener], [t.back]]))
    return
  }
  if (message === user.viewDomainNames) {
    const purchasedDomains = await getPurchasedDomains(chatId)
    if (purchasedDomains.length === 0) {
      send(chatId, t.noDomainRegistered, k.of([[user.buyDomainName], [t.back]]))
      return
    }

    const domainsText = purchasedDomains.join('\n')
    set(state, chatId, 'action', 'view-domain-select')
    send(chatId, t.registeredDomainList(domainsText), k.of([...purchasedDomains.map(d => [d]), [user.buyDomainName], [t.back]]))
    return
  }
  if (action === 'view-domain-select') {
    if (message === t.back) return goto.submenu2()
    if (message === user.buyDomainName) {
      set(state, chatId, 'action', 'none')
      // Fall through to existing buyDomainName handler below
    } else {
      const domain = message.toLowerCase()
      const purchasedDomains = await getPurchasedDomains(chatId)
      if (!purchasedDomains.includes(domain)) {
        return send(chatId, t.chooseValidDomain || 'Please select a valid domain.')
      }

      await set(state, chatId, 'domainToManage', domain)
      info = await get(state, chatId)

      // Check if shortener is active on this domain
      const dnsResult = await domainService.viewDNSRecords(domain, db)
      const records = dnsResult?.records || []
      const shortenerActive = records.some(r =>
        r.recordType === 'CNAME' && r.recordContent && r.recordContent.includes('.up.railway.app')
      )

      const shortenerBtn = shortenerActive ? t.domainActionDeactivateShortener : t.domainActionShortener
      set(state, chatId, 'action', 'view-domain-actions')
      send(chatId, t.selectDomainAction(domain), k.of([[t.domainActionDns], [shortenerBtn], [t.back]]))
      return
    }
  }
  if (action === 'view-domain-actions') {
    if (message === t.back) {
      // Go back to domain list
      const purchasedDomains = await getPurchasedDomains(chatId)
      const domainsText = purchasedDomains.join('\n')
      set(state, chatId, 'action', 'view-domain-select')
      return send(chatId, t.registeredDomainList(domainsText), k.of([...purchasedDomains.map(d => [d]), [user.buyDomainName], [t.back]]))
    }
    if (message === t.domainActionDns) {
      // Route directly to DNS actions — domain is already selected
      return goto['choose-dns-action']()
    }
    if (message === t.domainActionShortener) {
      // Activate shortener directly — domain is already selected
      set(state, chatId, 'action', 'choose-dns-action')
      const domain = info?.domainToManage
      if (!domain) return send(chatId, t.noDomainSelected || 'No domain selected.')
      send(chatId, `🔗 Activating shortener for <b>${domain}</b>...`, { parse_mode: 'HTML' })
      try {
        const { server, error, recordType } =
          process.env.HOSTED_ON === 'render'
            ? await saveDomainInServerRender(domain)
            : await saveDomainInServerRailway(domain)
        if (error) return send(chatId, `❌ Could not link <b>${domain}</b>: ${error}`, { parse_mode: 'HTML' })
        send(chatId, `⏳ Configuring DNS for <b>${domain}</b>...`, { parse_mode: 'HTML' })
        const dnsResult = await domainService.viewDNSRecords(domain, db)
        const source = dnsResult?.source || 'connectreseller'
        if (source === 'openprovider') {
          await sleep(10000)
          const addResult = await domainService.addDNSRecord(domain, recordType, server, '', db)
          if (addResult.error || !addResult.success) return send(chatId, `❌ DNS error: ${addResult.error || 'Unknown error'}`, { parse_mode: 'HTML' })
        } else {
          await sleep(65000)
          const { error: saveErr } = await saveServerInDomain(domain, server, recordType)
          if (saveErr) return send(chatId, `❌ DNS error: ${saveErr}`, { parse_mode: 'HTML' })
        }
        send(chatId, `✅ <b>${domain}</b> linked to URL shortener. DNS may take up to 24h to propagate.`, { parse_mode: 'HTML' })
        const lang = info?.userLanguage || 'en'
        regularCheckDns(bot, chatId, domain, lang)
      } catch (e) {
        log(`[ActivateShortener] Error for ${domain}: ${e.message}`)
        send(chatId, `❌ Error: ${e.message}`, { parse_mode: 'HTML' })
      }
      return
    }
    if (message === t.domainActionDeactivateShortener) {
      // Deactivate shortener directly — domain is already selected
      set(state, chatId, 'action', 'choose-dns-action')
      const domain = info?.domainToManage
      if (!domain) return send(chatId, t.noDomainSelected || 'No domain selected.')
      send(chatId, `🔗 Deactivating shortener for <b>${domain}</b>...`, { parse_mode: 'HTML' })
      try {
        const { removeDomainFromRailway } = require('./rl-save-domain-in-server.js')
        const removeResult = await removeDomainFromRailway(domain)
        if (removeResult?.error) log(`[DeactivateShortener] Railway removal warning: ${removeResult.error}`)
        const dnsResult = await domainService.viewDNSRecords(domain, db)
        const records = dnsResult?.records || []
        const railwayCname = records.find(r => r.recordType === 'CNAME' && r.recordContent && r.recordContent.includes('.up.railway.app'))
        if (railwayCname) {
          const deleteResult = await domainService.deleteDNSRecord(domain, railwayCname, db)
          if (deleteResult?.error) log(`[DeactivateShortener] DNS delete warning: ${deleteResult.error}`)
        }
        send(chatId, `✅ <b>${domain}</b> unlinked from URL shortener.`, { parse_mode: 'HTML' })
      } catch (e) {
        log(`[DeactivateShortener] Error for ${domain}: ${e.message}`)
        send(chatId, `❌ Error: ${e.message}`, { parse_mode: 'HTML' })
      }
      return
    }
    return send(chatId, t.selectValidOption || 'Please select a valid option.')
  }
  if (message === 'Backup Data') {
    if (!isDeveloper(chatId)) return send(chatId, 'not authorized')

    backupTheData()
    return send(chatId, 'Backup created successfully.')
  }
  if (message === 'Restore Data') {
    if (!isDeveloper(chatId)) return send(chatId, 'not authorized')

    restoreData()
    return send(chatId, 'Data restored successfully.')
  }
  if (message === admin.viewUsers) {
    if (!isAdmin(chatId)) return send(chatId, 'not authorized')

    const users = await getUsers()
    return send(chatId, `Users: ${users.length}\n${users.join('\n')}`)
  }
  if (message === admin.viewAnalytics) {
    if (!isAdmin(chatId)) return send(chatId, 'not authorized')

    const analyticsData = await getAnalytics()
    send(chatId, `Analytics Data:\n${analyticsData.join('\n')}`)
    return
  }
  if (message === user.freeTrialAvailable) {
    sendQr(
      bot,
      chatId,
      `${chatId}`,
      t.scanQrOrUseChat(chatId),
    )
    return send(chatId, t.freeTrialAvailable)
  }
  if (action === 'listen_reset_login') {
    if (message === t.yes) {
      const loginData = (await get(loginCountOf, Number(chatId))) || { loginCount: 0, canLogin: true }
      await set(loginCountOf, Number(chatId), { loginCount: loginData.loginCount, canLogin: true })
      send(chatId, t.resetLoginAdmit, trans('o'))
    } else {
      send(chatId, t.resetLoginDeny, trans('o'))
    }
    return
  }

  // ── Fuzzy matching for old/stale keyboard buttons ──
  // Users with cached Telegram keyboards may send old labels; route them to the correct flow
  const msgLower = message.toLowerCase()
  if (msgLower.includes('phone leads') || msgLower.includes('targeted leads') || msgLower.includes('buy valid leads') || msgLower.includes('verify yours') || msgLower.includes('leads & validation') || msgLower.includes('leads | verify')) {
    return goto.targetSelectTarget()
  }
  if (msgLower.includes('url shortener') || msgLower.includes('shorten') || msgLower.startsWith('🔗')) {
    return goto.submenu1()
  }
  if (msgLower.includes('domain name') || msgLower.includes('register domain') || msgLower.includes('bulletproof domain')) {
    return goto.submenu2()
  }
  if (msgLower.includes('cloud phone') || msgLower.includes('sip')) {
    if (process.env.PHONE_SERVICE_ON !== 'true') {
      return send(chatId, `📞 Cloud Phone is coming soon! Contact ${process.env.SUPPORT_USERNAME || '@support'} for updates.`, trans('o'))
    }
    return goto.submenu5()
  }
  if (msgLower.includes('digital product')) {
    return goto.submenu6()
  }
  if (msgLower.includes('my wallet') || msgLower.includes('wallet')) {
    return goto[a.walletSelectCurrency]?.() || send(chatId, t.welcome, trans('o'))
  }
  if (msgLower.includes('my plan') || msgLower.includes('my subscription') || msgLower.includes('subscribe here')) {
    return send(chatId, t.welcome, trans('o'))
  }
  if (msgLower.includes('offshore hosting') || msgLower.includes('anti-red hosting') || msgLower.includes('web hosting')) {
    if (process.env.OFFSHORE_HOSTING_ON === 'false') {
      return send(chatId, `🛡️🔥 Anti-Red Hosting is currently unavailable. Please tap <b>💬 Get Support</b> on the keyboard to reach us.`, trans('o'))
    }
    return goto.submenu3()
  }
  if (msgLower.includes('become a reseller') || msgLower.includes('reseller')) {
    return goto.submenu4?.() || send(chatId, t.welcome, trans('o'))
  }
  if (msgLower.includes('get support') || msgLower.includes('support')) {
    return goto.openSupportSession?.() || send(chatId, t.welcome, trans('o'))
  }
  if (msgLower.includes('change setting') || msgLower.includes('settings') || msgLower.includes('language')) {
    return goto.settings?.() || send(chatId, t.welcome, trans('o'))
  }
  // Catch stale "Back to..." hosting navigation buttons regardless of current action
  if (msgLower.includes('back to hosting plans') || msgLower.includes('back to hosting')) {
    return goto.submenu3()
  }
  if (msgLower.includes('back to free trial')) {
    return goto.freeTrialMenu?.() || goto.submenu3()
  }
  if (msgLower.includes('back to my plans') || msgLower.includes('my hosting plans')) {
    return goto.myHostingPlans?.() || goto.submenu3()
  }
  if (msgLower.includes('back to starter plan') || msgLower.includes('back to pro plan') || msgLower.includes('back to business plan') || msgLower.includes('back to purchase')) {
    return goto.submenu3()
  }
  // Generic "Back" or "Cancel" with no active action → return to main menu
  if (message === 'Back' || message === 'Cancel' || message === '⬅️ Back' || msgLower === 'back' || msgLower === 'cancel') {
    set(state, chatId, 'action', 'none')
    const greeting = await getMainMenuGreeting()
    return send(chatId, greeting, isAdmin(chatId) ? aO : trans('o'))
  }

  // Fallback: unrecognized message — check for recent support session before resetting
  const recentSession = await get(supportSessions, chatId)
  if (recentSession && recentSession > 0 && (Date.now() - recentSession) < 3600000) {
    // User had a support session within the last hour — forward to admin as safety net
    const displayName = name || msg?.from?.username || chatId
    send(TELEGRAM_ADMIN_CHAT_ID, `⚠️ <b>Missed support message</b>\n👤 <b>${displayName}</b> (${chatId}):\n${message}\n\n<i>Session was inactive but user appears to still need help.</i>\n\n↩️ /reply ${chatId} <i>type response</i>`, { parse_mode: 'HTML' })
    // Re-open session for them
    await set(supportSessions, chatId, Date.now())
    await set(state, chatId, 'action', 'supportChat')
    send(chatId, '✉️ Message sent to support. We\'ll respond shortly.', { reply_markup: { keyboard: [['/done']], resize_keyboard: true } })
    log(`[Support] Fallback: forwarded unrecognized message from ${chatId} to admin (recent session detected)`)
    return
  }
  set(state, chatId, 'action', 'none')
  log(`[reset] Unrecognized message from ${chatId}: "${message}" (was action: ${action || 'none'}). Resetting to main menu.`)
  return send(chatId, t.what + '\n' + t.welcome, isAdmin(chatId) ? aO : trans('o'))
})?.then(a => console.log(a))?.catch(b => console.log('the error: ', b))

async function getPurchasedDomains(chatId) {
  let ans = await get(domainsOf, chatId)
  if (!ans) return []

  ans = Object.keys(ans).map(d => d.replaceAll('@', '.')) // de sanitize due to mongo db
  return ans.filter(d => d !== '_id')
}

async function getUsers() {
  let ans = await getAll(chatIdOf)
  if (!ans) return []

  return ans.map(a => a._id)
}

// new Date('2023-9-5'), new Date('2023-9'), new Date('2023')
async function getAnalytics() {
  let ans = await getAll(clicksOf)
  if (!ans) return []
  return ans.map(a => `${a._id}: ${a.val} click${a.val === 1 ? '' : 's'}`).sort((a, b) => a.localeCompare(b))
}


async function getAnalyticsOfAllSms() {
  let ans = await getAll(clicksOfSms)
  if (!ans) return []
  return ans.map(a => `${a._id}, ${a.val}`).sort((a, b) => a.localeCompare(b))
}

async function getShortLinks(chatId) {
  let ans = await get(linksOf, chatId)
  if (!ans) return []

  ans = Object.keys(ans).map(d => ({ shorter: d, url: ans[d] }))
  ans = ans.filter(d => d.shorter !== '_id')

  let ret = []
  for (let i = 0; i < ans.length; i++) {
    const link = ans[i]

    if (link.shorter.includes('ap1s@net')) {
      const lastPart = link.shorter.substring(link.shorter.lastIndexOf('/') + 1)
      let clicks = ((await analyticsCuttly(lastPart)) === 'No such url' ? 0 : (await analyticsCuttly(lastPart))) || 0
      const shorter = (await get(maskOf, link.shorter)) || link.shorter.replaceAll('@', '.')
      ret.push({ clicks, shorter, url: link.url })
    } else {
      let clicks = (await get(clicksOn, link.shorter)) || 0
      const shorter = (await get(maskOf, link.shorter)) || link.shorter.replaceAll('@', '.')
      ret.push({ clicks, shorter, url: link.url })
    }

  }

  return ret
}

async function ownsDomainName(chatId) {
  return (await getPurchasedDomains(chatId)).length > 0
}

async function isValid(link) {
  const time = await get(expiryOf, link)
  if (time === undefined) return true

  return time > Date.now()
}

async function isSubscribed(chatId) {
  const time = await get(planEndingTime, chatId)
  if (!time || time <= Date.now()) return false

  // Sanity check: no plan should be valid more than 31 days from now
  const MAX_REASONABLE_MS = 31 * 86400 * 1000
  if (time > Date.now() + MAX_REASONABLE_MS) {
    log(`[isSubscribed] Anomalous planEndingTime for chatId ${chatId}: ${new Date(time).toISOString()} — treating as expired`)
    // Auto-fix: expire the corrupted plan
    set(planEndingTime, chatId, 0)
    return false
  }

  return true
}

async function freeLinksAvailable(chatId) {
  const freeLinks = (await get(freeShortLinksOf, chatId)) || 0
  return freeLinks > 0
}


async function backupTheData() {
  const backupData = {
    state: await getAll(state),
    linksOf: await getAll(linksOf),
    walletOf: await getAll(walletOf),
    expiryOf: await getAll(expiryOf),
    fullUrlOf: await getAll(fullUrlOf),
    domainsOf: await getAll(domainsOf),
    loginCountOf: await getAll(loginCountOf),
    canLogin: await getAll(canLogin),
    chatIdBlocked: await getAll(chatIdBlocked),
    planEndingTime: await getAll(planEndingTime),
    chatIdOfPayment: await getAll(chatIdOfPayment),
    totalShortLinks: await getAll(totalShortLinks),
    freeShortLinksOf: await getAll(freeShortLinksOf),
    freeDomainNamesAvailableFor: await getAll(freeDomainNamesAvailableFor),
    freeValidationsAvailableFor: await getAll(freeValidationsAvailableFor),
    freeSmsCountOf: await getAll(freeSmsCountOf),
    clicksOfSms: await getAll(clicksOfSms),
    payments: await getAll(payments),
    clicksOf: await getAll(clicksOf),
    clicksOn: await getAll(clicksOn),
    chatIdOf: await getAll(chatIdOf),
    nameOf: await getAll(nameOf),
    planOf: await getAll(planOf),
  }
  const backupJSON = JSON.stringify(backupData, null, 2)
  fs.writeFileSync('backup.json', backupJSON, 'utf-8')
}

async function backupPayments() {
  const data = await getAll(payments)

  const head = 'Mode, Product, Name, Price, ChatId, User Name, Time,Currency\n'
  const backup = data.map(a => a.val).join('\n')
  fs.writeFileSync('payments.csv', head + backup, 'utf-8')
}

async function buyDomain(chatId, domain, registrar, nsChoice, customNS) {
  // ref https://www.mongodb.com/docs/manual/core/dot-dollar-considerations
  const domainSanitizedForDb = domain.replaceAll('.', '@')

  // Use unified domain service for registration
  registrar = registrar || 'ConnectReseller'
  nsChoice = nsChoice || 'provider_default'

  const result = await domainService.registerDomain(domain, registrar, nsChoice, db, chatId, customNS)
  if (result.success) {
    set(domainsOf, chatId, domainSanitizedForDb, true)
  }

  return result
}

const formatLinks = links => {
  return links.map(d => `${d.clicks} ${d.clicks === 1 ? 'click' : 'clicks'} → ${d.shorter} → ${d.url}`)
}

const buyDomainFullProcess = async (chatId, lang, domain) => {
  try {
    sendMessage(chatId, translation('t.paymentSuccessFul', lang), rem)
    let info = await get(state, chatId)
    let registrar = info?.registrar || 'ConnectReseller'
    const nsChoice = info?.nsChoice || 'provider_default'
    const customNS = info?.customNS || null
    const buyResult = await buyDomain(chatId, domain, registrar, nsChoice, customNS)
    if (buyResult.error) {
      const m = translation('t.domainPurchasedFailed', lang, domain, buyResult.error)
      log(m)
      sendMessage(TELEGRAM_DEV_CHAT_ID, m)
      sendMessage(chatId, m)
      return m
    }
    // Use the actual registrar from result (may differ if CR→OP fallback occurred)
    registrar = buyResult.registrar || registrar
    send(chatId, translation('t.domainBoughtSuccess', lang, domain), translation('o', lang))

    // Post-registration NS update for custom or Cloudflare
    if (nsChoice === 'custom' && customNS && customNS.length >= 2 && registrar === 'ConnectReseller') {
      sendMessage(chatId, `Updating nameservers to: ${customNS.join(', ')} ...`)
      await sleep(60000) // Wait for CR to propagate
      await domainService.postRegistrationNSUpdate(domain, registrar, nsChoice, customNS, db)
    } else if (nsChoice === 'custom' && customNS && customNS.length >= 2 && registrar === 'OpenProvider') {
      // OP sets NS at registration, but verify and update if needed
      sendMessage(chatId, `Verifying nameservers: ${customNS.join(', ')} ...`)
      await sleep(10000)
      await domainService.postRegistrationNSUpdate(domain, registrar, nsChoice, customNS, db)
    } else if (nsChoice === 'cloudflare' && registrar === 'ConnectReseller') {
      const cfNS = await require('./cf-service').getAccountNameservers()
      sendMessage(chatId, `Updating nameservers to Cloudflare: ${cfNS.join(', ')} ...`)
      await sleep(60000)
      await domainService.postRegistrationNSUpdate(domain, registrar, nsChoice, cfNS, db)
    } else if (nsChoice === 'cloudflare' && registrar === 'OpenProvider') {
      // OP sets CF NS at registration, but verify and update if needed
      const cfNS = await require('./cf-service').getAccountNameservers()
      sendMessage(chatId, `Verifying Cloudflare nameservers: ${cfNS.join(', ')} ...`)
      await sleep(10000)
      await domainService.postRegistrationNSUpdate(domain, registrar, nsChoice, cfNS, db)
    }

    if (info?.askDomainToUseWithShortener === false) return

    // Link domain to Railway/Render for URL shortener
    const { server, error, recordType } =
      process.env.HOSTED_ON === 'render'
        ? await saveDomainInServerRender(domain)
        : await saveDomainInServerRailway(domain)

    if (error) {
      const m = translation('t.errorSavingDomain', lang)
      sendMessage(chatId, m)
      return m
    }
    sendMessage(chatId, translation('t.domainLinking', lang, domain))

    // Add DNS record via the correct service based on registrar
    // Note: nsChoice is always 'provider_default' here (shortener=Yes forces it)
    if (registrar === 'OpenProvider') {
      // OP domains: add DNS record via OpenProvider DNS zone API
      await sleep(10000)
      const addResult = await domainService.addDNSRecord(domain, recordType, server, '', db)
      if (addResult.error || !addResult.success) {
        const m = `Error saving DNS record for domain: ${addResult.error || 'Unknown error'}`
        sendMessage(chatId, m)
        return m
      }
    } else {
      // ConnectReseller with provider_default
      await sleep(65000)
      const { error: saveServerInDomainError } = await saveServerInDomain(domain, server, recordType)
      console.log("###saveServerInDomainError", saveServerInDomainError)
      if (saveServerInDomainError) {
        const m = `Error saving server in domain ${saveServerInDomainError}`
        sendMessage(chatId, m)
        return m
      }
    }
    sendMessage(chatId, translation('t.domainBought', lang).replaceAll('{{domain}}', domain))
    regularCheckDns(bot, chatId, domain, lang)
    return false // error = false
  } catch (error) {
    const errorMessage = `err buyDomainFullProcess ${error?.message} ${safeStringify(error?.response?.data)}`
    sendMessage(TELEGRAM_DEV_CHAT_ID, errorMessage)
    console.error(errorMessage)
    return errorMessage
  }
}

schedule.scheduleJob('*/5 * * * *', function() {
  checkVPSPlansExpiryandPayment()
})

async function checkVPSPlansExpiryandPayment() {
  const now = new Date()
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000)

  try {
    const expiredHourlyVpsPlans = await vpsPlansOf.find({
      'plan': 'Hourly',
      'end_time': { $lte: now },
      'status' : 'RUNNING'
    }).toArray()

    for ( const vpsPlan of expiredHourlyVpsPlans) {
      const { chatId, _id, planPrice, plan, vpsId, label } = vpsPlan
      const info = await state.findOne({ _id: parseFloat(chatId) })
      const { usdBal } = await getBalance(walletOf, chatId)
      if (usdBal < planPrice) {
        try {
          let payload = {
            _id: vpsId
          }
          const stopVPS = await changeVpsInstanceStatus(payload, 'stop')
          if (stopVPS.success) {
            await vpsPlansOf.updateOne(
              { _id: _id },
              { $set: { 'status': 'TERMINATED' } },
            )
            return send(chatId, translation('vp.lowWalletBalance', info?.userLanguage, label))
          }
        } catch (error) {
          console.log(error)
        }
      } else {
        await vpsPlansOf.updateOne(
          { _id: _id },
          { $set: { 'end_time': oneHourFromNow } },
        )
        set(payments, nanoid(), `Wallet,VPSPlan,${plan},$${planPrice},${chatId},${new Date()}`)
        send(chatId, translation('vp.vpsHourlyPlanRenewed', info?.userLanguage, label, planPrice))
        await atomicIncrement(walletOf, chatId, 'usdOut', Number(planPrice))
        const { usdBal: usd, ngnBal: ngn } = await getBalance(walletOf, chatId)
        send(chatId, translation('t.showWallet', info?.userLanguage, usd, ngn))
      }
    }
  } catch (error) {
    console.error('Error sending reminders:', error)
  }
}

const buyVPSPlanFullProcess = async (chatId, lang, vpsDetails) => {
  try {
    const vmInstance = await createVPSInstance(chatId, vpsDetails)
    if (!vmInstance.success) {
      const m = translation('vp.errorPurchasingVPS', lang, vpsDetails.plan)
      log(m)
      sendMessage(TELEGRAM_DEV_CHAT_ID, m)
      sendMessage(chatId, m)
      return false
    }
    const { data: vpsData } = vmInstance
    const now = new Date()
    let info = await get(state, chatId)

    await vpsPlansOf.insertOne({
      chatId: chatId,
      name: vpsData.vps_name,
      label: vpsData.label,
      vpsId: vpsData._id,
      start_time: now, 
      end_time: new Date(vpsData.subscription.subscriptionEnd), 
      plan: vpsDetails.plan,
      planPrice: vpsDetails.plantotalPrice, 
      status: vpsData.status,
      timestamp: new Date()
    });
    await sleep(10000)

    if (vpsDetails.sshKeyName) {
      const data = {
        zone: vpsDetails.zone,
        vpsId: vpsData._id,
        sshKeys: [ vpsDetails.sshKeyName],
        telegramId: chatId,
      }
      await attachSSHKeysToVM(data)
    }

    await sleep(30000)
    const credentials = await setVpsSshCredentials(vpsData.host)

    set(state, info._id, 'action', 'none')
    send(chatId, translation('vp.vpsBoughtSuccess', lang, vpsDetails, vpsData, credentials?.data), translation('o', lang))
    try {
      await sendVPSCredentialsEmail(info, vpsData, vpsDetails, credentials?.data)
    } catch (error) {
      log('Error sending email:', error)
      send(TELEGRAM_DEV_CHAT_ID, 'Error sending email', translation('o'))
    }

    return true
  } catch (error) {
    const errorMessage = `err buyVPSPlanFullProcess ${error?.message} ${safeStringify(error?.response?.data)}`
    const m = translation('vp.errorPurchasingVPS', lang, vpsDetails.plan)
    sendMessage(chatId, m)
    sendMessage(TELEGRAM_DEV_CHAT_ID, errorMessage)
    console.error(errorMessage)
    return false
  }
}

const upgradeVPSDetails = async (chatId, lang, vpsDetails) => {
  try {
    log(vpsDetails)
    const vmInstanceDetails = await fetchVPSDetails(chatId, vpsDetails._id)
    if (!vmInstanceDetails) {
      const m = translation('vp.errorUpgradingVPS', lang, vpsDetails.name)
      log(m)
      sendMessage(TELEGRAM_DEV_CHAT_ID, m)
      sendMessage(chatId, m)
      return false
    }
    let vmInstanceUpgrade;
    let message = ''
    switch (vpsDetails.upgradeType) {
      case 'plan':
        vmInstanceUpgrade = await upgradeVPSPlanType(chatId, vpsDetails)
        if (vmInstanceUpgrade.success) {
          await vpsPlansOf.updateOne(
            { vpsId: vpsDetails._id },
            { $set: { 'planPrice': vmInstanceUpgrade.data.price } },
          )
        }
        message = translation('vp.vpsUpgradePlanTypeSuccess', lang, vpsDetails)
        break;
      case 'disk':
        vmInstanceUpgrade = await upgradeVPSDiskType(chatId, vpsDetails)
        if (vmInstanceUpgrade.success) {
          await vpsPlansOf.updateOne(
            { vpsId: vpsDetails._id },
            { $set: { 'planPrice': vmInstanceUpgrade.data.subscription.price } },
          )
        }
        message = translation('vp.vpsUpgradeDiskTypeSuccess', lang, vpsDetails)
        break;
      case 'vps-renew':
        vmInstanceUpgrade = await renewVPSPlan(chatId, vmInstanceDetails.subscription_id)
        if (vmInstanceUpgrade.success) {
          await vpsPlansOf.updateOne(
            { vpsId: vpsDetails._id },
            { $set: { 
              'end_time': new Date(vmInstanceUpgrade.data.subscriptionEnd), 
              'status': 'RUNNING'
            }},
          )
          const expiryDate = date(vmInstanceUpgrade.data.subscriptionEnd)
          message = translation('vp.vpsRenewPlanSuccess', lang, vmInstanceDetails, expiryDate)
        }
      case 'vps-cPanel-renew':
        vmInstanceUpgrade = await renewVPSCPanel(chatId, vmInstanceDetails.subscription_id)
        if (vmInstanceUpgrade.success) {
          const expiryDate = date(vmInstanceUpgrade.data.cPanel.expiryDate)
          message = translation('vp.vpsRenewCPanelSuccess', lang, vmInstanceDetails, expiryDate)
        }
      default:
        break;
    }
    if (!vmInstanceUpgrade?.success) {
      const m = translation('vp.errorPurchasingVPS', lang, vpsDetails.name)
      log(m)
      sendMessage(TELEGRAM_DEV_CHAT_ID, m)
      sendMessage(chatId, m)
      return false
    }

    set(state, chatId, 'action', 'none')
    send(chatId, message, translation('o', lang))
    return true
  } catch (error) {
    const errorMessage = `err buyUPgradingVPSProcess ${error?.message} ${safeStringify(error?.response?.data)}`
    const m = translation('vp.errorPurchasingVPS', lang, vpsDetails.name)
    sendMessage(chatId, m)
    sendMessage(TELEGRAM_DEV_CHAT_ID, errorMessage)
    console.error(errorMessage)
    return false
  }
}

// ── Cloud Phone DB helpers ──
async function updatePhoneNumberFeature(col, chatId, phoneNumber, featureKey, value) {
  const userData = await get(col, chatId)
  if (!userData?.numbers) return
  const nums = userData.numbers
  const idx = nums.findIndex(n => n.phoneNumber === phoneNumber)
  if (idx === -1) return
  nums[idx].features = nums[idx].features || {}
  nums[idx].features[featureKey] = value
  await set(col, chatId, { numbers: nums })
}

async function updatePhoneNumberField(col, chatId, phoneNumber, fieldKey, value) {
  const userData = await get(col, chatId)
  if (!userData?.numbers) return
  const nums = userData.numbers
  const idx = nums.findIndex(n => n.phoneNumber === phoneNumber)
  if (idx === -1) return
  nums[idx][fieldKey] = value
  await set(col, chatId, { numbers: nums })
}

const auth = async (req, res, next) => {
  log(req.hostname + req.originalUrl)
  const ref = req?.query?.ref || req?.body?.data?.reference // first for crypto and second for webhook fincra
  const pay = await get(chatIdOfPayment, ref)
  if (!pay) return log(translation('t.payError', 'en')) || res.send(html(translation('t.payError', 'en')))
  req.pay = { ...pay, ref }
  next()
}

const authDyno = async (req, res, next) => {
  log('=== DYNOPAY WEBHOOK RECEIVED ===')
  log('URL:', req.hostname + req.originalUrl)
  log('Full request body:', JSON.stringify(req.body, null, 2))
  
  // Skip pending events — they don't carry meta_data yet
  if (req.body?.event === 'payment.pending' || req.body?.status === 'pending') {
    log('Skipping pending payment event (no meta_data yet)')
    return res.send(html('OK'))
  }

  const { meta_data } = req.body
  const ref = meta_data?.refId
  
  log('Extracted refId:', ref)
  
  const pay = await get(chatIdOfDynopayPayment, ref)
  log('Payment data found for ref:', ref, '=', pay ? 'YES' : 'NO')
  
  if (!pay) {
    log('ERROR: Payment session not found for ref:', ref)
    return res.send(html(translation('t.payError', 'en')))
  }
  
  log('Payment session authenticated successfully:', pay)
  req.pay = { ...pay, ref }
  next()
}

// Use the early app that's already listening
const app = earlyApp
// Strip /api prefix from incoming requests (Emergent ingress sends /api/* to port 8001 without stripping)
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    req.url = req.url.replace(/^\/api/, '')
  }
  next()
})
app.set('json spaces', 2)

// ── cPanel Panel Routes ──
const { createCpanelRoutes } = require('./cpanel-routes')
app.use('/panel', createCpanelRoutes(() => cpanelAccounts))

const addFundsTo = async (walletOf, chatId, coin, valueIn, lang) => {
  if (!['usd', 'ngn'].includes(coin)) throw Error('Dev Please Debug')

  const key = `${coin}In`
  await atomicIncrement(walletOf, chatId, key, valueIn)
  const { usdBal, ngnBal } = await getBalance(walletOf, chatId)
  sendMessage(chatId, translation('t.showWallet', lang, usdBal, ngnBal))
}
//
// ━━━ Loyalty Tier: Webhook helper ━━━
async function webhookTierCheck(chatId, preSpend, lang) {
  try {
    const upgrade = await loyalty.checkTierUpgrade(walletOf, chatId, preSpend)
    if (upgrade.upgraded) {
      sendMessage(chatId, loyalty.formatUpgradeMessage(upgrade, lang || 'en'))
    }
  } catch (e) { /* non-critical */ }
}
//
const bankApis = {
  '/bank-pay-plan': async (req, res, ngnIn) => {
    // Validate
    const { ref, chatId, price, plan } = req.pay || {}
    if (!ref || !chatId || !price || !plan) return log(translation('t.argsErr')) || res.send(html(translation('t.argsErr')))
    if (('' + ref + chatId + price + plan).includes('undefined')) return log(translation('t.argsErr')) || res.send(html(translation('t.argsErr')))
    const info = await state.findOne({ _id: parseFloat(chatId) })
    const lang = info?.userLanguage ?? 'en'
    const preSpend = await loyalty.getTotalSpend(walletOf, chatId)

    // Logs
    del(chatIdOfPayment, ref)
    const usdIn = await ngnToUsd(ngnIn)
    const name = await get(nameOf, chatId)
    set(payments, ref, `Bank, Plan, ${plan}, $${usdIn}, ${chatId}, ${name}, ${new Date()}, ₦${ngnIn}`)

    // Update Wallet
    const ngnPrice = await usdToNgn(price)
    if (usdIn * 1.06 < price) {
      sendMessage(chatId, translation('t.sentLessMoney', lang, `${ngnPrice} NGN`, `${ngnIn} NGN`))
      addFundsTo(walletOf, chatId, 'ngn', ngnIn, lang)
      return res.send(html(translation('t.lowPrice')))
    }
    if (ngnIn > ngnPrice) {
      addFundsTo(walletOf, chatId, 'ngn', ngnIn - ngnPrice, lang)
      sendMessage(chatId, translation('t.sentLessMoney', lang, `${ngnPrice} NGN`, `${ngnIn} NGN`))
    }

    // Subscribe Plan
    subscribePlan(planEndingTime, freeDomainNamesAvailableFor, planOf, chatId, plan, bot, lang, freeValidationsAvailableFor)
    notifyGroup(`💎 <b>New Subscription!</b>\nUser ${maskName(name)} just upgraded to the <b>${plan} Plan</b> — unlocking ${freeDomainsOf[plan]} free domains + ${(freeValidationsOf[plan] || 0).toLocaleString()} phone validations.\nDon't miss out — /start`)
    webhookTierCheck(chatId, preSpend, lang)
    res.send(html())
  },
  '/bank-pay-domain': async (req, res, ngnIn) => {
    // Validate
    const { ref, chatId, price, domain } = req.pay || {}
    if (!ref || !chatId || !price || !domain) return log(translation('t.argsErr')) || res.send(html(translation('t.argsErr')))
    const info = await state.findOne({ _id: parseFloat(chatId) })
    const lang = info?.userLanguage ?? 'en'
    const preSpend = await loyalty.getTotalSpend(walletOf, chatId)

    // Logs
    del(chatIdOfPayment, ref)
    const usdIn = await ngnToUsd(ngnIn)
    const name = await get(nameOf, chatId)
    set(payments, ref, `Bank, Domain, ${domain}, $${usdIn}, ${chatId}, ${name}, ${new Date()}, ₦${ngnIn}`)

    // Update Wallet
    const ngnPrice = await usdToNgn(price)
    if (usdIn * 1.06 < price) {
      sendMessage(chatId, translation('t.sentLessMoney', lang, `${ngnPrice} NGN`, `${ngnIn} NGN`))
      addFundsTo(walletOf, chatId, 'ngn', ngnIn, lang)
      return res.send(html(translation('t.lowPrice')))
    }
    if (ngnIn > ngnPrice) {
      addFundsTo(walletOf, chatId, 'ngn', ngnIn - ngnPrice, lang)
      sendMessage(chatId, translation('t.sentMoreMoney', lang, `${ngnPrice} NGN`, `${ngnIn} NGN`))
    }

    // Buy Domain
    const error = await buyDomainFullProcess(chatId, lang, domain)
    if (error) return res.send(html(error))
    notifyGroup(`🌐 <b>Domain Registered!</b>\nUser ${maskName(name)} just claimed <b>${domain}</b> — your dream domain could be next.\nGrab yours before it's taken — /start`)
    webhookTierCheck(chatId, preSpend, lang)
    res.send(html())
  },
  '/bank-pay-hosting': async (req, res, ngnIn) => {
    // Validate
    const { ref, chatId, price } = req.pay
    const response = req?.query
    if (!ref || !chatId || !price) return log(translation('t.argsErr')) || res.send(html(translation('t.argsErr')))
    const info = await state.findOne({ _id: parseFloat(chatId) })
    const lang = info?.userLanguage ?? 'en'
    const preSpend = await loyalty.getTotalSpend(walletOf, chatId)

    // Logs
    del(chatIdOfPayment, ref)
    const usdIn = await ngnToUsd(ngnIn)
    await insert(hostingTransactions, chatId, "bank", response)

    // Update Wallet
    const ngnPrice = await usdToNgn(price)
    if (usdIn * 1.06 < price) {
      sendMessage(chatId, translation('t.sentLessMoney', lang, `${ngnPrice} NGN`, `${ngnIn} NGN`))
      addFundsTo(walletOf, chatId, 'ngn', ngnIn, lang)
      return res.send(html(translation('t.lowPrice')))
    }
    if (ngnIn > ngnPrice) {
      addFundsTo(walletOf, chatId, 'ngn', ngnIn - ngnPrice, lang)
      sendMessage(chatId, translation('t.sentMoreMoney', lang, `${ngnPrice} NGN`, `${ngnIn} NGN`))
    }

    // Buy Domain Hosting
    const hostingResult = await registerDomainAndCreateCpanel(send, info, translation('o', lang), state)
    if (!hostingResult?.success) {
      // If new domain was registered, refund only hosting portion (domain is consumed)
      if (!info?.existingDomain && info?.domainPrice > 0) {
        const hostingNgn = ngnIn - (await usdToNgn(info.domainPrice))
        if (hostingNgn > 0) addFundsTo(walletOf, chatId, 'ngn', hostingNgn, lang)
        sendMessage(chatId, `Your domain <b>${info?.website_name}</b> has been registered successfully, but hosting setup failed. Domain cost has been charged — hosting portion (₦${Math.round(hostingNgn)}) refunded to your wallet. Please contact support to complete hosting setup: ${process.env.APP_SUPPORT_LINK}`)
      } else {
        addFundsTo(walletOf, chatId, 'ngn', ngnIn, lang)
        sendMessage(chatId, hostingResult?.error || 'Hosting creation failed. Full payment refunded to your NGN wallet.')
      }
      return res.send(html(hostingResult?.error || 'Hosting creation failed'))
    }
    webhookTierCheck(chatId, preSpend, lang)
    res.send(html())
  },
  '/bank-pay-vps': async (req, res, ngnIn) => {
    // Validate
    const { ref, chatId, price, vpsDetails } = req.pay
    const response = req?.query
    if (!ref || !chatId || !price ) return log(translation('t.argsErr')) || res.send(html(translation('t.argsErr')))
    const info = await state.findOne({ _id: parseFloat(chatId) })
    const lang = info?.userLanguage ?? 'en'
    const preSpend = await loyalty.getTotalSpend(walletOf, chatId)

    // Logs
    del(chatIdOfPayment, ref)
    const usdIn = await ngnToUsd(ngnIn)
    let transaction = {
      plan: vpsDetails.plan,
      type: 'new-plan',
      response: response
    }
    await insert(vpsTransactions, chatId, "bank", transaction)

    const totalPrice = Number(vpsDetails?.totalPrice)
    sendMessage(chatId, translation('vp.paymentRecieved', lang))
    // Update Wallet
    const ngnPrice = await usdToNgn(price)
    if (usdIn * 1.06 < price) {
      sendMessage(chatId, translation('t.sentLessMoney', lang, `${ngnPrice} NGN`, `${ngnIn} NGN`))
      addFundsTo(walletOf, chatId, 'ngn', ngnIn, lang)
      return res.send(html(translation('t.lowPrice')))
    }
    if (ngnIn > ngnPrice) {
      addFundsTo(walletOf, chatId, 'ngn', ngnIn - ngnPrice, lang)
      sendMessage(chatId, translation('t.sentMoreMoney', lang, `${ngnPrice} NGN`, `${ngnIn} NGN`))
    }

    if (vpsDetails.plan === 'Hourly') {
      addFundsTo(walletOf, chatId, 'usd', usdIn - totalPrice, lang)
      sendMessage(chatId, translation('vp.extraMoney', lang))
    }

    // Buy VPS
    const isSuccess = await buyVPSPlanFullProcess(chatId, lang, vpsDetails)
    if (!isSuccess) return res.send(html(error))
    webhookTierCheck(chatId, preSpend, lang)
    res.send(html())
  },
  '/bank-pay-upgrade-vps': async (req, res, ngnIn) => {
    // Validate
    const { ref, chatId, price, vpsDetails } = req.pay
    const response = req?.query
    if (!ref || !chatId || !price ) return log(translation('t.argsErr')) || res.send(html(translation('t.argsErr')))
    const info = await state.findOne({ _id: parseFloat(chatId) })
    const lang = info?.userLanguage ?? 'en'
    const preSpend = await loyalty.getTotalSpend(walletOf, chatId)

    // Logs
    del(chatIdOfPayment, ref)
    const usdIn = await ngnToUsd(ngnIn)
    let transaction = {
      type: vpsDetails.upgradeType === 'plan' ? 'upgarde-plan' : 'upgrade-disk',
      response : response
    }
    await insert(vpsTransactions, chatId, "bank", transaction)
    const totalPrice = Number(vpsDetails?.totalPrice)
    sendMessage(chatId, translation('vp.vpsChangePaymentRecieved', lang))
    // Update Wallet
    const ngnPrice = await usdToNgn(price)
    if (usdIn * 1.06 < price) {
      sendMessage(chatId, translation('t.sentLessMoney', lang, `${ngnPrice} NGN`, `${ngnIn} NGN`))
      addFundsTo(walletOf, chatId, 'ngn', ngnIn, lang)
      return res.send(html(translation('t.lowPrice')))
    }
    if (ngnIn > ngnPrice) {
      addFundsTo(walletOf, chatId, 'ngn', ngnIn - ngnPrice, lang)
      sendMessage(chatId, translation('t.sentMoreMoney', lang, `${ngnPrice} NGN`, `${ngnIn} NGN`))
    }

    if (vpsDetails?.billingCycle === 'Hourly') {
      addFundsTo(walletOf, chatId, 'usd', usdIn - totalPrice, lang)
      sendMessage(chatId, translation('vp.extraMoney', lang))
    }
    // Upgrade VPS plan or disk
    const isSuccess = await upgradeVPSDetails(chatId, lang, vpsDetails)
    if (!isSuccess) return res.send(html(error))
    webhookTierCheck(chatId, preSpend, lang)
    res.send(html())
  },
  '/bank-pay-phone': async (req, res, ngnIn) => {
    const { ref, chatId, price, cpData } = req.pay || {}
    if (!ref || !chatId || !price || !cpData) return log(translation('t.argsErr')) || res.send(html(translation('t.argsErr')))
    const info = await state.findOne({ _id: parseFloat(chatId) })
    const lang = info?.userLanguage ?? 'en'
    const preSpend = await loyalty.getTotalSpend(walletOf, chatId)
    del(chatIdOfPayment, ref)
    const usdIn = await ngnToUsd(ngnIn)
    const name = await get(nameOf, chatId)
    set(payments, ref, `Bank,CloudPhone,${cpData.selectedNumber},$${usdIn},${chatId},${name},${new Date()},₦${ngnIn}`)
    const ngnPrice = await usdToNgn(price)
    if (usdIn * 1.06 < price) {
      sendMessage(chatId, translation('t.sentLessMoney', lang, `${ngnPrice} NGN`, `${ngnIn} NGN`))
      addFundsTo(walletOf, chatId, 'ngn', ngnIn, lang)
      return res.send(html(translation('t.lowPrice')))
    }
    if (ngnIn > ngnPrice) {
      addFundsTo(walletOf, chatId, 'ngn', ngnIn - ngnPrice, lang)
      sendMessage(chatId, translation('t.sentMoreMoney', lang, `${ngnPrice} NGN`, `${ngnIn} NGN`))
    }

    const selectedNumber = cpData.selectedNumber
    const planKey = cpData.planKey
    const plan = phoneConfig.plans[planKey]
    const provider = cpData.provider || 'telnyx'
    const countryCode = cpData.countryCode || info?.cpCountryCode || 'US'
    const countryName = cpData.countryName || info?.cpCountryName || 'US'

    if (provider === 'twilio') {
      // Check if address is needed and cached
      if (needsTwilioAddress(countryCode, provider)) {
        const cachedAddr = await getCachedTwilioAddress(chatId, countryCode)
        if (cachedAddr) {
          // Use cached address — proceed with purchase
          sendMessage(chatId, phoneConfig.getMsg(lang).purchasingNumber)
          const result = await executeTwilioPurchase(chatId, selectedNumber, planKey, price, countryCode, countryName, info?.cpNumberType || 'local', 'bank_ngn', cachedAddr)
          if (result.error) {
            addFundsTo(walletOf, chatId, 'ngn', ngnIn, lang)
            return res.send(html(phoneConfig.getMsg(lang).purchaseFailed))
          }
          sendMessage(chatId, phoneConfig.txt.activated(selectedNumber, result.plan?.name || planKey, price, result.sipUsername, phoneConfig.SIP_DOMAIN, phoneConfig.shortDate(result.expiresAt.toISOString())))
          return res.send(html())
        } else {
          // Need address — save state, prompt user
          await state.updateOne({ _id: parseFloat(chatId) }, { $set: {
            action: 'cpEnterAddress',
            cpPendingCoin: 'bank_ngn',
            cpPendingPriceUsd: price,
            cpPendingPriceNgn: ngnPrice,
            cpPaymentMethod: 'bank_ngn',
          }}, { upsert: true })
          const addrLoc = getAddressLocationText(countryCode)
          sendMessage(chatId, `✅ Bank payment received!\n\n📍 <b>${countryName}</b> requires a billing address to activate the number.\nAddress ${addrLoc?.text || 'required'}.\n\nPlease enter your address:\n<code>Street, City, Country</code>\n\nExample: <i>123 Main St, Sydney, Australia</i>`, { parse_mode: 'HTML' })
          return res.send(html())
        }
      }
      // No address needed — direct Twilio purchase
      sendMessage(chatId, phoneConfig.getMsg(lang).purchasingNumber)
      const result = await executeTwilioPurchase(chatId, selectedNumber, planKey, price, countryCode, countryName, info?.cpNumberType || 'local', 'bank_ngn', null)
      if (result.error) {
        addFundsTo(walletOf, chatId, 'ngn', ngnIn, lang)
        return res.send(html(phoneConfig.getMsg(lang).purchaseFailed))
      }
      sendMessage(chatId, phoneConfig.txt.activated(selectedNumber, result.plan?.name || planKey, price, result.sipUsername, phoneConfig.SIP_DOMAIN, phoneConfig.shortDate(result.expiresAt.toISOString())))
      return res.send(html())
    }

    // ── TELNYX PURCHASE ──
    sendMessage(chatId, phoneConfig.getMsg(lang).purchasingNumber)
    const orderResult = await telnyxApi.buyNumber(selectedNumber, telnyxResources.sipConnectionId, telnyxResources.messagingProfileId)
    if (!orderResult) {
      addFundsTo(walletOf, chatId, 'ngn', ngnIn, lang)
      return res.send(html(phoneConfig.getMsg(lang).purchaseFailed))
    }
    let sipUsername = phoneConfig.generateSipUsername()
    let sipPassword = phoneConfig.generateSipPassword()
    if (telnyxResources.sipConnectionId) {
      const telnyxCred = await telnyxApi.createSIPCredential(telnyxResources.sipConnectionId, sipUsername, sipPassword)
      if (telnyxCred?.sip_username) {
        sipUsername = telnyxCred.sip_username
        sipPassword = telnyxCred.sip_password || sipPassword
        log(`[CloudPhone] Using Telnyx-generated SIP credentials: ${sipUsername}`)
      }
    }
    const expiresAt = new Date()
    expiresAt.setMonth(expiresAt.getMonth() + 1)
    const numberDoc = {
      phoneNumber: selectedNumber, telnyxOrderId: orderResult.id,
      country: countryCode, countryName: countryName,
      type: info?.cpNumberType || 'local', plan: planKey, planPrice: price,
      purchaseDate: new Date().toISOString(), expiresAt: expiresAt.toISOString(),
      autoRenew: true, status: 'active', sipUsername, sipPassword,
      sipDomain: phoneConfig.SIP_DOMAIN, provider: 'telnyx',
      messagingProfileId: telnyxResources.messagingProfileId,
      connectionId: telnyxResources.sipConnectionId, smsUsed: 0, minutesUsed: 0,
      features: { sms: true, callForwarding: { enabled: false, mode: 'disabled', forwardTo: null, ringTimeout: 25 },
        voicemail: { enabled: false, greetingType: 'default', customGreetingUrl: null, forwardToTelegram: true, forwardToEmail: null, ringTimeout: 25 },
        smsForwarding: { toTelegram: true, toEmail: null, webhookUrl: null }, recording: false }
    }
    const existing = await get(phoneNumbersOf, chatId)
    if (existing?.numbers) { existing.numbers.push(numberDoc); await set(phoneNumbersOf, chatId, { numbers: existing.numbers }) }
    else { await set(phoneNumbersOf, chatId, { numbers: [numberDoc] }) }
    await phoneTransactions.insertOne({ chatId, phoneNumber: selectedNumber, action: 'purchase', plan: planKey, amount: price, paymentMethod: 'bank_ngn', timestamp: new Date().toISOString() })
    sendMessage(chatId, phoneConfig.txt.activated(selectedNumber, plan.name, price, sipUsername, phoneConfig.SIP_DOMAIN, phoneConfig.shortDate(expiresAt.toISOString())))
    notifyGroup(phoneConfig.txt.adminPurchase(maskName(name), selectedNumber, plan.name, price, 'Bank NGN'))
    webhookTierCheck(chatId, preSpend, lang)
    res.send(html())
  },
  '/bank-pay-leads': async (req, res, ngnIn) => {
    const { ref, chatId, price, lastStep, leadsData } = req.pay || {}
    if (!ref || !chatId || !price || !lastStep) return log(translation('t.argsErr')) || res.send(html(translation('t.argsErr')))
    const info = await state.findOne({ _id: parseFloat(chatId) })
    const lang = info?.userLanguage ?? 'en'
    const preSpend = await loyalty.getTotalSpend(walletOf, chatId)
    del(chatIdOfPayment, ref)
    const usdIn = await ngnToUsd(ngnIn)
    const name = await get(nameOf, chatId)
    const isValidator = lastStep === 'validatorSelectFormat'
    const label = isValidator ? 'Validation' : 'Leads'
    set(payments, ref, `Bank,${label},$${usdIn},${chatId},${name},${new Date()},₦${ngnIn}`)
    const ngnPrice = await usdToNgn(price)
    if (usdIn * 1.06 < price) {
      sendMessage(chatId, translation('t.sentLessMoney', lang, `${ngnPrice} NGN`, `${ngnIn} NGN`))
      addFundsTo(walletOf, chatId, 'ngn', ngnIn, lang)
      return res.send(html(translation('t.lowPrice')))
    }
    if (ngnIn > ngnPrice) {
      addFundsTo(walletOf, chatId, 'ngn', ngnIn - ngnPrice, lang)
      sendMessage(chatId, translation('t.sentMoreMoney', lang, `${ngnPrice} NGN`, `${ngnIn} NGN`))
    }
    try {
      const ld = leadsData || {}
      let cc = countryCodeOf[ld.country]
      // For targeted leads: always enable CNAM for USA; for validator: respect user opt-in
      const cnam = ld.country === 'USA' ? (isValidator ? ld.cnamMode : (ld.targetName ? true : ld.cnamMode)) : false
      const format = ld.format
      const l = format === buyLeadsSelectFormat[0]
      if (isValidator) {
        sendMessage(chatId, translation('t.validatorBulkNumbersStart', lang))
        const phones = info?.phones?.slice(0, ld.amount)
        const result = await validatePhoneBulkFile(ld.carrier, phones, cc, cnam, bot, chatId)
        if (!result) return sendMessage(chatId, translation('t.validatorError', lang)) || res.send(html())
        sendMessage(chatId, translation('t.validatorSuccess', lang, ld.amount, result.length))
        cc = '+' + cc; const re = cc === '+1' ? '' : '0'
        fs.writeFile('leads.txt', result.map(a => (l ? a[0].replace(cc, re) : a[0])).join('\n'), () => bot?.sendDocument(chatId, 'leads.txt').catch(() => {}))
        if (cnam) { fs.writeFile('leads_with_cnam.txt', result.map(a => (l ? a[0].replace(cc, re) : a[0]) + ' ' + a[3]).join('\n'), () => { bot?.sendDocument(chatId, 'leads_with_cnam.txt').catch(() => {}); bot?.sendDocument(TELEGRAM_ADMIN_CHAT_ID, 'leads_with_cnam.txt').catch(() => {}) }) }
        else if (ld.country !== 'USA') { fs.writeFile('leads_with_carriers.txt', result.map(a => (l ? a[0].replace(cc, re) : a[0]) + ' ' + a[1]).join('\n'), () => { bot?.sendDocument(chatId, 'leads_with_carriers.txt').catch(() => {}); bot?.sendDocument(TELEGRAM_ADMIN_CHAT_ID, 'leads_with_carriers.txt').catch(() => {}) }) }
      } else {
        const isTargetLeads = !!ld.targetName
        const _startMsg = isTargetLeads ? `🎯 Sourcing <b>${ld.targetName}</b> leads with real person names. Please wait...` : translation('t.validatorBulkNumbersStart', lang)
        sendMessage(chatId, _startMsg)
        let areaCodes
        if (info?.targetAreaCodes) { areaCodes = ld.area === 'Mixed Area Codes' ? info.targetAreaCodes : [ld.area] }
        else if (['Australia'].includes(ld.country)) { areaCodes = ['4'] }
        else { areaCodes = ld.area === 'Mixed Area Codes' ? _buyLeadsSelectAreaCode(ld.country, ld.area) : [ld.area] }
        const requireRealName = isTargetLeads && cnam
        const result = await validateBulkNumbers(ld.carrier, ld.amount, cc, areaCodes, cnam, bot, chatId, lang, requireRealName)
        if (!result) return sendMessage(chatId, translation('t.buyLeadsError', lang)) || res.send(html())
        cc = '+' + cc; const re = cc === '+1' ? '' : '0'
        if (cnam) {
          const withRealNames = result.filter(a => a[3] && isRealPersonName(a[3]))
          const allNumbers = result.map(a => (l ? a[0].replace(cc, re) : a[0]))
          // File 1 — Numbers with real names
          if (withRealNames.length > 0) {
            fs.writeFile('leads_with_names.txt', withRealNames.map(a => (l ? a[0].replace(cc, re) : a[0]) + ' ' + a[3].trim()).join('\n'), () => {
              bot?.sendDocument(chatId, 'leads_with_names.txt').catch(() => {})
              if (isTargetLeads) sendMessage(chatId, `📄 <b>File 1 — ${ld.targetName} Numbers + Real Person Name (${withRealNames.length} matched)</b>`)
              bot?.sendDocument(TELEGRAM_ADMIN_CHAT_ID, 'leads_with_names.txt').catch(() => {})
            })
          }
          // File 2 — All numbers
          fs.writeFile('leads.txt', allNumbers.join('\n'), () => {
            bot?.sendDocument(chatId, 'leads.txt').catch(() => {})
            if (isTargetLeads) sendMessage(chatId, `📄 <b>File 2 — All ${ld.targetName} Phone Numbers (${allNumbers.length} total)</b>`)
          })
          const _successMsg = isTargetLeads
            ? `🎯 <b>${ld.targetName}</b> leads ready!\n✅ ${withRealNames.length} with real person names\n📱 ${allNumbers.length} total verified numbers`
            : translation('t.buyLeadsSuccess', lang, ld.amount)
          sendMessage(chatId, _successMsg)
        } else {
          fs.writeFile('leads.txt', result.map(a => (l ? a[0].replace(cc, re) : a[0])).join('\n'), () => { bot?.sendDocument(chatId, 'leads.txt').catch(() => {}) })
          sendMessage(chatId, translation('t.buyLeadsSuccess', lang, ld.amount))
          if (ld.country !== 'USA') { fs.writeFile('leads_with_carriers.txt', result.map(a => (l ? a[0].replace(cc, re) : a[0]) + ' ' + a[1]).join('\n'), () => { bot?.sendDocument(chatId, 'leads_with_carriers.txt').catch(() => {}); bot?.sendDocument(TELEGRAM_ADMIN_CHAT_ID, 'leads_with_carriers.txt').catch(() => {}) }) }
        }
      }
      set(payments, nanoid(), `Bank,${label},${ld.amount} leads,$${price},${chatId},${name},${new Date()},₦${ngnIn}`)
      notifyGroup(`🏦 <b>${ld.targetName || label} Acquired!</b>\nUser ${maskName(name)} just grabbed ${ld.amount?.toLocaleString()} verified ${ld.targetName ? ld.targetName + ' ' : ''}leads with phone owner names via bank.\nGet yours — /start`)
      webhookTierCheck(chatId, preSpend, lang)
    } catch (e) {
      log(`[bank-pay-leads] Error: ${e.message}`)
      sendMessage(chatId, `✅ Payment received! Your wallet has been credited ₦${ngnIn}. Use wallet to complete your ${label.toLowerCase()} purchase.`)
      addFundsTo(walletOf, chatId, 'ngn', ngnIn, lang)
    }
    res.send(html())
  },
  '/bank-pay-digital-product': async (req, res, ngnIn) => {
    const { ref, chatId, price, product, orderId } = req.pay || {}
    if (!ref || !chatId || !price || !product || !orderId) return log(translation('t.argsErr')) || res.send(html(translation('t.argsErr')))
    const info = await state.findOne({ _id: parseFloat(chatId) })
    const lang = info?.userLanguage ?? 'en'
    const preSpend = await loyalty.getTotalSpend(walletOf, chatId)

    del(chatIdOfPayment, ref)
    const usdIn = await ngnToUsd(ngnIn)
    const name = await get(nameOf, chatId)
    set(payments, ref, `Bank,DigitalProduct,${product},$${usdIn},${chatId},${name},${new Date()},${ngnIn} NGN`)

    const ngnPrice = await usdToNgn(price)
    if (usdIn * 1.06 < price) {
      sendMessage(chatId, translation('t.sentLessMoney', lang, `${ngnPrice} NGN`, `${ngnIn} NGN`))
      addFundsTo(walletOf, chatId, 'ngn', ngnIn, lang)
      return res.send(html(translation('t.lowPrice')))
    }
    if (ngnIn > ngnPrice) {
      addFundsTo(walletOf, chatId, 'ngn', ngnIn - ngnPrice, lang)
      sendMessage(chatId, translation('t.sentMoreMoney', lang, `${ngnPrice} NGN`, `${ngnIn} NGN`))
    }

    await digitalOrdersCol.updateOne({ orderId }, { $set: { status: 'pending', paymentConfirmedAt: new Date() } })
    send(chatId, translation('t.dpOrderConfirmed', lang, product, price, orderId), translation('o', lang))
    notifyGroup(`🛒 <b>Digital Product Paid!</b>\n\n🆔 Order: <code>${orderId}</code>\n👤 User: ${maskName(name)} (${chatId})\n📦 Product: <b>${product}</b>\n💵 Paid: <b>$${price}</b> (Bank)\n\n📩 Deliver with:\n<code>/deliver ${orderId} [details]</code>`)
    webhookTierCheck(chatId, preSpend, lang)
    res.send(html())
  },
  '/bank-wallet': async (req, res, ngnIn) => {
    // Validate
    const { ref, chatId } = req.pay
    if (!ref || !chatId) return log(translation('t.argsErr')) || res.send(html(translation('t.argsErr')))
    const info = await state.findOne({ _id: parseFloat(chatId) })
    const lang = info?.userLanguage ?? 'en'

    // Update Wallet
    const usdIn = await ngnToUsd(ngnIn)
    addFundsTo(walletOf, chatId, 'ngn', ngnIn, lang)
    sendMessage(chatId, translation('t.confirmationDepositMoney', lang, `${ngnIn} NGN`, usdIn))

    // Logs
    res.send(html())
    del(chatIdOfPayment, ref)
    const name = await get(nameOf, chatId)
    set(payments, ref, `Bank,Wallet,wallet,$${usdIn},${chatId},${name},${new Date()},${ngnIn} NGN`)
    notifyGroup(`💰 <b>Wallet Top-Up!</b>\nUser ${maskName(name)} just loaded their wallet and is ready to buy domains, leads & more.\nFund yours in seconds — /start`)
  },
}
//
//
app.post('/webhook', auth, (req, res) => {
  const value = req?.body?.data?.amountReceived
  const coin = req?.body?.data?.currency
  const endpoint = req?.pay?.endpoint
  if (coin !== 'NGN' || isNaN(value) || !bankApis[endpoint]) return log(translation('t.argsErr')) || res.send(html(translation('t.argsErr')))

  bankApis[endpoint](req, res, Number(value))
})

app.get('/open-api-key', async (req, res) => {
  // Require auth header to prevent unauthorized access
  const authHeader = req.headers['x-api-auth'] || req.query?.auth
  const expectedAuth = process.env.APP_OPEN_API_AUTH || process.env.TELEGRAM_BOT_TOKEN
  if (!authHeader || authHeader !== expectedAuth) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const openApiKey = process.env.APP_OPEN_API_KEY
  const length = Math.ceil(openApiKey.length / 3)
  const piece1 = openApiKey.substring(0, length)
  const piece2 = openApiKey.substring(length, length * 2)
  const piece3 = openApiKey.substring(length * 2)

  const responseJson = {
    piece1: piece1,
    piece2: piece3,
    piece3: piece2,
  }

  res.json(responseJson)
})

app.get('/bot-link', async (req, res) => {
  res.send(process.env.APP_SUPPORT_LINK)
})

app.get('/free-sms-count/:chatId', async (req, res) => {
  const chatId = req?.params?.chatId
  let _count = (await get(freeSmsCountOf, Number(chatId))) || 0
  res.send('' + _count)
})

app.get('/increment-free-sms-count/:chatId', async (req, res) => {
  const chatId = req?.params?.chatId
  const name = await get(nameOf, Number(chatId))

  increment(freeSmsCountOf, Number(chatId))
  increment(clicksOfSms, chatId + ', ' + name + ', ' + today())
  increment(clicksOfSms, chatId + ', ' + name + ', ' + week())
  increment(clicksOfSms, chatId + ', ' + name + ', ' + month())
  increment(clicksOfSms, chatId + ', ' + name + ', ' + year())

  increment(clicksOfSms, 'total, total, ' + today())
  increment(clicksOfSms, 'total, total, ' + week())
  increment(clicksOfSms, 'total, total, ' + month())
  increment(clicksOfSms, 'total, total, ' + year())
  res.send('ok')
})


app.get('/analytics-of-all-sms', async (req, res) => {
  const analyticsData = await getAnalyticsOfAllSms()
  const analyticsText = `chat id, name, date, sms sent\n${analyticsData.join('\n')}`
  const fileName = 'analytics.csv'
  fs.writeFileSync(fileName, analyticsText, 'utf-8')
  res.setHeader('Content-Disposition', `attachment; filename=${fileName}`)
  res.setHeader('Content-Type', 'application/json')
  fs.createReadStream(fileName).pipe(res)
})
app.get('/login-count/:chatId', async (req, res) => {
  const chatId = req?.params?.chatId
  const loginData = (await get(loginCountOf, Number(chatId))) || { loginCount: 0, canLogin: true }
  if (!loginData.canLogin) {
    const info = await state.findOne({ _id: parseFloat(chatId) })
    const lang = info?.userLanguage ?? 'en'
    send(Number(chatId), translation('t.resetLogin', lang), translation('yes_no', lang))
    // sendMessage(Number(chatId), t.resetLogin, yes_no)
    await set(state, Number(chatId), 'action', 'listen_reset_login')
  }
  res.json(loginData)
})

app.get('/increment-login-count/:chatId', async (req, res) => {
  const chatId = req?.params?.chatId

  const loginData = (await get(loginCountOf, Number(chatId))) || { loginCount: 0, canLogin: true }
  await set(loginCountOf, Number(chatId), { loginCount: loginData.loginCount + 1, canLogin: false })

  res.send('ok')
})

app.get('/decrement-login-count/:chatId', async (req, res) => {
  const chatId = req?.params?.chatId

  const loginData = (await get(loginCountOf, Number(chatId))) || { loginCount: 0, canLogin: true }

  if (loginData.canLogin) return res.send('!ok')

  await set(loginCountOf, Number(chatId), { loginCount: loginData.loginCount - 1, canLogin: true })

  res.send('ok')
})
app.get('/phone-numbers-demo-link', async (req, res) => {
  res.send(process.env.APP_PHONE_NUMBERS_DEMO_LINK)
})

app.get('/content-demo-link', async (req, res) => {
  res.send(process.env.APP_CONTENT_DEMO_LINK)
})

app.get('/free-sms', async (req, res) => {
  res.send(process.env.APP_FREE_SMS)
})

app.get('/crypto-pay-plan', auth, async (req, res) => {
  // Validate
  const { ref, chatId, price, plan } = req.pay
  const coin = req?.query?.coin
  const value = req?.query?.value_coin

  console.log({ method: '/crypto-pay-plan', ref, chatId, plan, price, coin, value })

  if (!ref || !chatId || !plan || !price || !coin || !value) return log(translation('t.argsErr')) || res.send(html(translation('t.argsErr')))

  const info = await state.findOne({ _id: parseFloat(chatId) })
  const lang = info?.userLanguage ?? 'en'
  const preSpend = await loyalty.getTotalSpend(walletOf, chatId)

  // Logs
  del(chatIdOfPayment, ref)
  const name = await get(nameOf, chatId)
  set(payments, ref, `Crypto,Plan,${plan},$${price},${chatId},${name},${new Date()},${value} ${coin}`)

  // Update Wallet
  const usdIn = await convert(value, coin, 'usd')
  const usdNeed = usdIn * 1.06
  console.log(`usdIn ${usdIn}, usdNeed ${usdNeed}, Crypto, Plan, ${chatId}, ${name}`)
  if (usdNeed < price) {
    sendMessage(chatId, translation('t.sentLessMoney', lang, `$${price}`, `$${usdIn}`))
    addFundsTo(walletOf, chatId, 'usd', usdIn, lang)
    return res.send(html(translation('t.lowPrice')))
  }
  console.log(`usdIn > price = ${usdIn > price}`)
  if (usdIn > price) {
    addFundsTo(walletOf, chatId, 'usd', usdIn - price, lang)
    sendMessage(chatId, translation('t.sentMoreMoney', lang, `$${price}`, `$${usdIn}`))
  }

  // Subscribe Plan
  subscribePlan(planEndingTime, freeDomainNamesAvailableFor, planOf, chatId, plan, bot, lang, freeValidationsAvailableFor)
  notifyGroup(`💎 <b>New Subscription!</b>\nUser ${maskName(name)} just upgraded to the <b>${plan} Plan</b> — unlocking ${freeDomainsOf[plan]} free domains + ${(freeValidationsOf[plan] || 0).toLocaleString()} phone validations.\nDon't miss out — /start`)
  webhookTierCheck(chatId, preSpend, lang)
  res.send(html())
})
app.get('/crypto-pay-domain', auth, async (req, res) => {
  // Validate
  const { ref, chatId, price, domain } = req.pay
  const coin = req?.query?.coin
  const value = req?.query?.value_coin
  if (!ref || !chatId || !domain || !price || !coin || !value) return log(translation('t.argsErr')) || res.send(html(translation('t.argsErr')))
  const info = await state.findOne({ _id: parseFloat(chatId) })
  const lang = info?.userLanguage ?? 'en'
  const preSpend = await loyalty.getTotalSpend(walletOf, chatId)
  // Logs
  del(chatIdOfPayment, ref)
  const name = await get(nameOf, chatId)
  set(payments, ref, `Crypto,Domain,${domain},$${price},${chatId},${name},${new Date()},${value} ${coin}`)

  // Update Wallet
  const usdIn = await convert(value, coin, 'usd')
  if (usdIn * 1.06 < price) {
    sendMessage(chatId, translation('t.sentLessMoney', lang, `$${price}`, `$${usdIn}`))
    addFundsTo(walletOf, chatId, 'usd', usdIn, lang)
    return res.send(html(translation('t.lowPrice')))
  }
  if (usdIn > price) {
    addFundsTo(walletOf, chatId, 'usd', usdIn - price, lang)
    sendMessage(chatId, translation('t.sentMoreMoney', lang, `$${price}`, `$${usdIn}`))
  }

  // Buy Domain
  const error = await buyDomainFullProcess(chatId, lang, domain)
  if (error) return res.send(html(error))
  notifyGroup(`🌐 <b>Domain Registered!</b>\nUser ${maskName(name)} just claimed <b>${domain}</b> — your dream domain could be next.\nGrab yours before it's taken — /start`)
  webhookTierCheck(chatId, preSpend, lang)
  res.send(html())
})

// Hosting
app.get('/crypto-pay-hosting', auth, async (req, res) => {
  // Validate
  const { ref, chatId, price } = req.pay
  const coin = req?.query?.coin
  const value = req?.query?.value_coin
  const response = req?.query

  if (!ref || !chatId || !price || !coin || !value) return log(translation('t.argsErr')) || res.send(html(translation('t.argsErr')))
  const info = await state.findOne({ _id: parseFloat(chatId) })
  const lang = info?.userLanguage ?? 'en'
  const preSpend = await loyalty.getTotalSpend(walletOf, chatId)

    // Logs
  del(chatIdOfPayment, ref)
  await insert(hostingTransactions, chatId, "blockbee", response)
  // Update Wallet
  const usdIn = await convert(value, coin, 'usd')
  if (usdIn * 1.06 < price) {
    sendMessage(chatId, translation('t.sentLessMoney', lang, `$${price}`, `$${usdIn}`))
    addFundsTo(walletOf, chatId, 'usd', usdIn, lang)
    return res.send(html(translation('t.lowPrice')))
  }
  if (usdIn > price) {
    addFundsTo(walletOf, chatId, 'usd', usdIn - price, lang)
    sendMessage(chatId, translation('t.sentMoreMoney', lang, `$${price}`, `$${usdIn}`))
  }

  const hostingResult = await registerDomainAndCreateCpanel(send, info, translation('o', lang), state)
  if (!hostingResult?.success) {
    // If new domain was registered, refund only hosting portion (domain is consumed)
    if (!info?.existingDomain && info?.domainPrice > 0) {
      const hostingRefund = usdIn - info.domainPrice
      if (hostingRefund > 0) addFundsTo(walletOf, chatId, 'usd', hostingRefund, lang)
      sendMessage(chatId, `Your domain <b>${info?.website_name}</b> has been registered successfully, but hosting setup failed. Domain cost ($${info.domainPrice}) charged — hosting portion ($${hostingRefund.toFixed(2)}) refunded to your wallet. Please contact support to complete hosting setup: ${process.env.APP_SUPPORT_LINK}`)
    } else {
      addFundsTo(walletOf, chatId, 'usd', usdIn, lang)
      sendMessage(chatId, hostingResult?.error || 'Hosting creation failed. Full payment refunded to your USD wallet.')
    }
    return res.send(html(hostingResult?.error || 'Hosting creation failed'))
  }
  webhookTierCheck(chatId, preSpend, lang)
  res.send(html())
})

// Cloud Phone — BlockBee callback
app.get('/crypto-pay-phone', auth, async (req, res) => {
  const { ref, chatId, price, cpData } = req.pay
  const coin = req?.query?.coin
  const value = req?.query?.value_coin
  if (!ref || !chatId || !price || !coin || !value || !cpData) return log(translation('t.argsErr')) || res.send(html(translation('t.argsErr')))
  const info = await state.findOne({ _id: parseFloat(chatId) })
  const lang = info?.userLanguage ?? 'en'
  const preSpend = await loyalty.getTotalSpend(walletOf, chatId)
  del(chatIdOfPayment, ref)
  const name = await get(nameOf, chatId)
  set(payments, ref, `Crypto,CloudPhone,${cpData.selectedNumber},$${price},${chatId},${name},${new Date()},${value} ${coin}`)
  const usdIn = await convert(value, coin, 'usd')
  if (usdIn * 1.06 < price) {
    sendMessage(chatId, translation('t.sentLessMoney', lang, `$${price}`, `$${usdIn}`))
    addFundsTo(walletOf, chatId, 'usd', usdIn, lang)
    return res.send(html(translation('t.lowPrice')))
  }
  if (usdIn > price) {
    addFundsTo(walletOf, chatId, 'usd', usdIn - price, lang)
    sendMessage(chatId, translation('t.sentMoreMoney', lang, `$${price}`, `$${usdIn}`))
  }

  const selectedNumber = cpData.selectedNumber
  const planKey = cpData.planKey
  const plan = phoneConfig.plans[planKey]
  const provider = cpData.provider || 'telnyx'
  const countryCode = cpData.countryCode || info?.cpCountryCode || 'US'
  const countryName = cpData.countryName || info?.cpCountryName || 'US'

  if (provider === 'twilio') {
    if (needsTwilioAddress(countryCode, provider)) {
      const cachedAddr = await getCachedTwilioAddress(chatId, countryCode)
      if (cachedAddr) {
        sendMessage(chatId, phoneConfig.getMsg(lang).purchasingNumber)
        const result = await executeTwilioPurchase(chatId, selectedNumber, planKey, price, countryCode, countryName, info?.cpNumberType || 'local', 'crypto_' + coin, cachedAddr)
        if (result.error) { addFundsTo(walletOf, chatId, 'usd', Number(price), lang); return res.send(html(phoneConfig.getMsg(lang).purchaseFailed)) }
        sendMessage(chatId, phoneConfig.txt.activated(selectedNumber, result.plan?.name || planKey, price, result.sipUsername, phoneConfig.SIP_DOMAIN, phoneConfig.shortDate(result.expiresAt.toISOString())))
        return res.send(html())
      } else {
        await state.updateOne({ _id: parseFloat(chatId) }, { $set: {
          action: 'cpEnterAddress', cpPendingCoin: 'crypto_' + coin, cpPendingPriceUsd: price, cpPendingPriceNgn: 0, cpPaymentMethod: 'crypto_' + coin,
        }}, { upsert: true })
        const addrLoc = getAddressLocationText(countryCode)
        sendMessage(chatId, `✅ Crypto payment received!\n\n📍 <b>${countryName}</b> requires a billing address to activate the number.\nAddress ${addrLoc?.text || 'required'}.\n\nPlease enter your address:\n<code>Street, City, Country</code>\n\nExample: <i>123 Main St, Sydney, Australia</i>`, { parse_mode: 'HTML' })
        return res.send(html())
      }
    }
    sendMessage(chatId, phoneConfig.getMsg(lang).purchasingNumber)
    const result = await executeTwilioPurchase(chatId, selectedNumber, planKey, price, countryCode, countryName, info?.cpNumberType || 'local', 'crypto_' + coin, null)
    if (result.error) { addFundsTo(walletOf, chatId, 'usd', Number(price), lang); return res.send(html(phoneConfig.getMsg(lang).purchaseFailed)) }
    sendMessage(chatId, phoneConfig.txt.activated(selectedNumber, result.plan?.name || planKey, price, result.sipUsername, phoneConfig.SIP_DOMAIN, phoneConfig.shortDate(result.expiresAt.toISOString())))
    return res.send(html())
  }

  // ── TELNYX ──
  sendMessage(chatId, phoneConfig.getMsg(lang).purchasingNumber)
  const orderResult = await telnyxApi.buyNumber(selectedNumber, telnyxResources.sipConnectionId, telnyxResources.messagingProfileId)
  if (!orderResult) { addFundsTo(walletOf, chatId, 'usd', Number(price), lang); return res.send(html(phoneConfig.getMsg(lang).purchaseFailed)) }
  const sipUsername = phoneConfig.generateSipUsername()
  const sipPassword = phoneConfig.generateSipPassword()
  if (telnyxResources.sipConnectionId) await telnyxApi.createSIPCredential(telnyxResources.sipConnectionId, sipUsername, sipPassword)
  const expiresAt = new Date(); expiresAt.setMonth(expiresAt.getMonth() + 1)
  const numberDoc = {
    phoneNumber: selectedNumber, telnyxOrderId: orderResult.id, country: countryCode, countryName,
    type: info?.cpNumberType || 'local', plan: planKey, planPrice: price,
    purchaseDate: new Date().toISOString(), expiresAt: expiresAt.toISOString(),
    autoRenew: true, status: 'active', sipUsername, sipPassword,
    sipDomain: phoneConfig.SIP_DOMAIN, provider: 'telnyx',
    messagingProfileId: telnyxResources.messagingProfileId, connectionId: telnyxResources.sipConnectionId,
    smsUsed: 0, minutesUsed: 0,
    features: { sms: true, callForwarding: { enabled: false, mode: 'disabled', forwardTo: null, ringTimeout: 25 },
      voicemail: { enabled: false, greetingType: 'default', customGreetingUrl: null, forwardToTelegram: true, forwardToEmail: null, ringTimeout: 25 },
      smsForwarding: { toTelegram: true, toEmail: null, webhookUrl: null }, recording: false }
  }
  const existing = await get(phoneNumbersOf, chatId)
  if (existing?.numbers) { existing.numbers.push(numberDoc); await set(phoneNumbersOf, chatId, { numbers: existing.numbers }) }
  else { await set(phoneNumbersOf, chatId, { numbers: [numberDoc] }) }
  await phoneTransactions.insertOne({ chatId, phoneNumber: selectedNumber, action: 'purchase', plan: planKey, amount: price, paymentMethod: 'crypto_' + coin, timestamp: new Date().toISOString() })
  sendMessage(chatId, phoneConfig.txt.activated(selectedNumber, plan.name, price, sipUsername, phoneConfig.SIP_DOMAIN, phoneConfig.shortDate(expiresAt.toISOString())))
  notifyGroup(phoneConfig.txt.adminPurchase(maskName(name), selectedNumber, plan.name, price, 'Crypto ' + coin))
  webhookTierCheck(chatId, preSpend, lang)
  res.send(html())
})

// ── DynoPay Crypto Payment for Phone ──

// Buy Leads / Validate Leads — BlockBee callback
app.get('/crypto-pay-leads', auth, async (req, res) => {
  const { ref, chatId, price, lastStep, leadsData } = req.pay
  const coin = req?.query?.coin
  const value = req?.query?.value_coin
  if (!ref || !chatId || !price || !coin || !value || !lastStep) return log(translation('t.argsErr')) || res.send(html(translation('t.argsErr')))
  const info = await state.findOne({ _id: parseFloat(chatId) })
  const lang = info?.userLanguage ?? 'en'
  const preSpend = await loyalty.getTotalSpend(walletOf, chatId)
  del(chatIdOfPayment, ref)
  const name = await get(nameOf, chatId)
  const isValidator = lastStep === 'validatorSelectFormat'
  const label = isValidator ? 'Validation' : 'Leads'
  set(payments, ref, `Crypto,${label},$${price},${chatId},${name},${new Date()},${value} ${coin}`)
  const usdIn = await convert(value, coin, 'usd')
  if (usdIn * 1.06 < price) {
    sendMessage(chatId, translation('t.sentLessMoney', lang, `$${price}`, `$${usdIn}`))
    addFundsTo(walletOf, chatId, 'usd', usdIn, lang)
    return res.send(html(translation('t.lowPrice')))
  }
  if (usdIn > price) {
    addFundsTo(walletOf, chatId, 'usd', usdIn - price, lang)
    sendMessage(chatId, translation('t.sentMoreMoney', lang, `$${price}`, `$${usdIn}`))
  }
  try {
    const ld = leadsData || {}
    let cc = countryCodeOf[ld.country]
    // For targeted leads: always enable CNAM for USA; for validator: respect user opt-in
    const cnam = ld.country === 'USA' ? (isValidator ? ld.cnamMode : (ld.targetName ? true : ld.cnamMode)) : false
    const format = ld.format
    const l = format === buyLeadsSelectFormat[0]
    if (isValidator) {
      sendMessage(chatId, translation('t.validatorBulkNumbersStart', lang))
      const phones = info?.phones?.slice(0, ld.amount)
      const result = await validatePhoneBulkFile(ld.carrier, phones, cc, cnam, bot, chatId)
      if (!result) return sendMessage(chatId, translation('t.validatorError', lang)) || res.send(html())
      sendMessage(chatId, translation('t.validatorSuccess', lang, ld.amount, result.length))
      cc = '+' + cc; const re = cc === '+1' ? '' : '0'
      const file1 = 'leads.txt'
      fs.writeFile(file1, result.map(a => (l ? a[0].replace(cc, re) : a[0])).join('\n'), () => bot?.sendDocument(chatId, file1).catch(() => {}))
      if (cnam) { const f2 = 'leads_with_cnam.txt'; fs.writeFile(f2, result.map(a => (l ? a[0].replace(cc, re) : a[0]) + ' ' + a[3]).join('\n'), () => { bot?.sendDocument(chatId, f2).catch(() => {}); bot?.sendDocument(TELEGRAM_ADMIN_CHAT_ID, f2).catch(() => {}) }) }
      else if (ld.country !== 'USA') { const f2 = 'leads_with_carriers.txt'; fs.writeFile(f2, result.map(a => (l ? a[0].replace(cc, re) : a[0]) + ' ' + a[1]).join('\n'), () => { bot?.sendDocument(chatId, f2).catch(() => {}); bot?.sendDocument(TELEGRAM_ADMIN_CHAT_ID, f2).catch(() => {}) }) }
    } else {
      const isTargetLeads = !!ld.targetName
      const _startMsg = isTargetLeads ? '🎯 Sourcing leads with real person names. Please wait...' : translation('t.validatorBulkNumbersStart', lang)
      sendMessage(chatId, _startMsg)
      let areaCodes
      if (info?.targetAreaCodes) { areaCodes = ld.area === 'Mixed Area Codes' ? info.targetAreaCodes : [ld.area] }
      else if (['Australia'].includes(ld.country)) { areaCodes = ['4'] }
      else { areaCodes = ld.area === 'Mixed Area Codes' ? _buyLeadsSelectAreaCode(ld.country, ld.area) : [ld.area] }
      const requireRealName = isTargetLeads && cnam
      const result = await validateBulkNumbers(ld.carrier, ld.amount, cc, areaCodes, cnam, bot, chatId, lang, requireRealName)
      if (!result) return sendMessage(chatId, translation('t.buyLeadsError', lang)) || res.send(html())
      cc = '+' + cc; const re = cc === '+1' ? '' : '0'
      if (cnam) {
        const withRealNames = result.filter(a => a[3] && isRealPersonName(a[3]))
        const allNumbers = result.map(a => (l ? a[0].replace(cc, re) : a[0]))
        if (withRealNames.length > 0) {
          fs.writeFile('leads_with_names.txt', withRealNames.map(a => (l ? a[0].replace(cc, re) : a[0]) + ' ' + a[3].trim()).join('\n'), () => {
            bot?.sendDocument(chatId, 'leads_with_names.txt').catch(() => {})
            if (isTargetLeads) sendMessage(chatId, `📄 <b>File 1 — Numbers + Real Person Name (${withRealNames.length} matched)</b>`)
            bot?.sendDocument(TELEGRAM_ADMIN_CHAT_ID, 'leads_with_names.txt').catch(() => {})
          })
        }
        fs.writeFile('leads.txt', allNumbers.join('\n'), () => {
          bot?.sendDocument(chatId, 'leads.txt').catch(() => {})
          if (isTargetLeads) sendMessage(chatId, `📄 <b>File 2 — All Phone Numbers (${allNumbers.length} total)</b>`)
        })
        const _successMsg = isTargetLeads
          ? `🎯 Leads ready!\n✅ ${withRealNames.length} with real person names\n📱 ${allNumbers.length} total verified numbers`
          : translation('t.buyLeadsSuccess', lang, ld.amount)
        sendMessage(chatId, _successMsg)
      } else {
        fs.writeFile('leads.txt', result.map(a => (l ? a[0].replace(cc, re) : a[0])).join('\n'), () => { bot?.sendDocument(chatId, 'leads.txt').catch(() => {}) })
        sendMessage(chatId, translation('t.buyLeadsSuccess', lang, ld.amount))
        if (ld.country !== 'USA') { const f2 = 'leads_with_carriers.txt'; fs.writeFile(f2, result.map(a => (l ? a[0].replace(cc, re) : a[0]) + ' ' + a[1]).join('\n'), () => { bot?.sendDocument(chatId, f2).catch(() => {}); bot?.sendDocument(TELEGRAM_ADMIN_CHAT_ID, f2).catch(() => {}) }) }
      }
    }
    set(payments, nanoid(), `Crypto,${label},${ld.amount} leads,$${price},${chatId},${name},${new Date()},${coin}`)
    notifyGroup(`🏦 <b>${ld.targetName || label} Acquired!</b>\nUser ${maskName(name)} just grabbed ${ld.amount?.toLocaleString()} verified ${ld.targetName ? ld.targetName + ' ' : ''}leads with phone owner names via crypto.\nGet yours — /start`)
    webhookTierCheck(chatId, preSpend, lang)
  } catch (e) {
    log(`[crypto-pay-leads] Error: ${e.message}`)
    sendMessage(chatId, `✅ Payment received! Your wallet has been credited $${Number(price).toFixed(2)}. Use wallet to complete your ${label.toLowerCase()} purchase.`)
    addFundsTo(walletOf, chatId, 'usd', Number(price), lang)
  }
  res.send(html())
})

app.get('/crypto-pay-vps', auth, async (req, res) => {
  // Validate
  const { ref, chatId, price, vpsDetails } = req.pay
  const coin = req?.query?.coin
  const value = req?.query?.value_coin
  const response = req?.query
  if (!ref || !chatId || !price || !coin || !value) return log(translation('t.argsErr')) || res.send(html(translation('t.argsErr')))
  const info = await state.findOne({ _id: parseFloat(chatId) })
  const lang = info?.userLanguage ?? 'en'
  const totalPrice = Number(vpsDetails?.totalPrice)
  const preSpend = await loyalty.getTotalSpend(walletOf, chatId)

  sendMessage(chatId, translation('vp.paymentRecieved', lang))
  // Logs
  del(chatIdOfPayment, ref)
  let transaction = {
    type: 'new-plan',
    response : response
  }
  await insert(vpsTransactions, chatId, "blockbee", transaction)

  // Update Wallet
  const usdIn = await convert(value, coin, 'usd')
  if (usdIn * 1.06 < price) {
    sendMessage(chatId, translation('t.sentLessMoney', lang, `$${price}`, `$${usdIn}`))
    addFundsTo(walletOf, chatId, 'usd', Number(usdIn), lang)
    return res.send(html(translation('t.lowPrice')))
  }
  if (usdIn > price) {
    addFundsTo(walletOf, chatId, 'usd', Number(usdIn) - Number(price), lang)
    sendMessage(chatId, translation('t.sentMoreMoney', lang, `$${price}`, `$${usdIn}`))
  }

  if (vpsDetails.plan === 'Hourly') {
    addFundsTo(walletOf, chatId, 'usd', Number(usdIn) - totalPrice, lang)
    sendMessage(chatId, translation('vp.extraMoney', lang))
  }

  const isSuccess = await buyVPSPlanFullProcess(chatId, lang, vpsDetails)
  if (!isSuccess) return res.send(html(error))
  webhookTierCheck(chatId, preSpend, lang)
  res.send(html())
})

app.get('/crypto-pay-upgrade-vps', auth, async (req, res) => {
  // Validate
  const { ref, chatId, price, vpsDetails } = req.pay
  const coin = req?.query?.coin
  const value = req?.query?.value_coin
  const response = req?.query
  if (!ref || !chatId || !price || !coin || !value) return log(translation('t.argsErr')) || res.send(html(translation('t.argsErr')))
  const info = await state.findOne({ _id: parseFloat(chatId) })
  const lang = info?.userLanguage ?? 'en'
  const totalPrice = Number(vpsDetails?.totalPrice)
  const preSpend = await loyalty.getTotalSpend(walletOf, chatId)

  sendMessage(chatId, translation('vp.vpsChangePaymentRecieved', lang))
  // Logs
  del(chatIdOfPayment, ref)
  let transaction = {
    type: vpsDetails.upgradeType === 'plan' ? 'upgrade-plan' : 'upgrade-disk',
    response: response
  }
  await insert(vpsTransactions, chatId, "blockbee", transaction)

  // Update Wallet
  const usdIn = await convert(value, coin, 'usd')
  if (usdIn * 1.06 < price) {
    sendMessage(chatId, translation('t.sentLessMoney', lang, `$${price}`, `$${usdIn}`))
    addFundsTo(walletOf, chatId, 'usd', Number(usdIn), lang)
    return res.send(html(translation('t.lowPrice')))
  }
  if (usdIn > price) {
    addFundsTo(walletOf, chatId, 'usd', Number(usdIn) - Number(price), lang)
    sendMessage(chatId, translation('t.sentMoreMoney', lang, `$${price}`, `$${usdIn}`))
  }

  if (vpsDetails?.billingCycle === 'Hourly') {
    addFundsTo(walletOf, chatId, 'usd', usdIn - totalPrice, lang)
    sendMessage(chatId, translation('vp.extraMoney', lang))
  }

  // Upgrade VPS plan or disk
  const isSuccess = await upgradeVPSDetails(chatId, lang, vpsDetails)
  if (!isSuccess) return res.send(html(error))
  webhookTierCheck(chatId, preSpend, lang)
  res.send(html())
})


// BlockBee callback: Digital Product crypto payment confirmed
app.get('/crypto-pay-digital-product', auth, async (req, res) => {
  const { ref, chatId, price, product, orderId } = req.pay
  const coin = req?.query?.coin
  const value = req?.query?.value_coin
  if (!ref || !chatId || !price || !product || !orderId || !coin || !value) return log(translation('t.argsErr')) || res.send(html(translation('t.argsErr')))
  const info = await state.findOne({ _id: parseFloat(chatId) })
  const lang = info?.userLanguage ?? 'en'
  const preSpend = await loyalty.getTotalSpend(walletOf, chatId)
  del(chatIdOfPayment, ref)
  const name = await get(nameOf, chatId)
  set(payments, ref, `Crypto,DigitalProduct,${product},$${price},${chatId},${name},${new Date()},${value} ${coin}`)
  const usdIn = await convert(value, coin, 'usd')
  if (usdIn * 1.06 < price) {
    sendMessage(chatId, translation('t.sentLessMoney', lang, `$${price}`, `$${usdIn}`))
    addFundsTo(walletOf, chatId, 'usd', usdIn, lang)
    return res.send(html(translation('t.lowPrice')))
  }
  if (usdIn > price) {
    addFundsTo(walletOf, chatId, 'usd', usdIn - price, lang)
    sendMessage(chatId, translation('t.sentMoreMoney', lang, `$${price}`, `$${usdIn}`))
  }
  await digitalOrdersCol.updateOne({ orderId }, { $set: { status: 'pending', paymentConfirmedAt: new Date() } })
  send(chatId, translation('t.dpOrderConfirmed', lang, product, price, orderId), translation('o', lang))
  notifyGroup(`🛒 <b>Digital Product Paid!</b>\n\n🆔 Order: <code>${orderId}</code>\n👤 User: ${maskName(name)} (${chatId})\n📦 Product: <b>${product}</b>\n💵 Paid: <b>$${price}</b> (Crypto)\n\n📩 Deliver with:\n<code>/deliver ${orderId} [details]</code>`)
  webhookTierCheck(chatId, preSpend, lang)
  res.send(html())
})


app.get('/crypto-wallet', auth, async (req, res) => {
  // Validate
  const { ref, chatId } = req.pay
  const coin = req?.query?.coin
  const value = req?.query?.value_coin
  if (!ref || !chatId || !coin || !value) return log(translation('t.argsErr')) || res.send(html(translation('t.argsErr')))
  const info = await state.findOne({ _id: parseFloat(chatId) })
  const lang = info?.userLanguage ?? 'en'

  // Update Wallet
  const usdIn = await convert(value, coin, 'usd')
  addFundsTo(walletOf, chatId, 'usd', usdIn, lang)
  sendMessage(chatId, translation('t.confirmationDepositMoney', lang, value + ' ' + tickerViewOf[coin], usdIn))

  // Logs
  res.send(html())
  del(chatIdOfPayment, ref)
  const name = await get(nameOf, chatId)
  set(payments, ref, `Crypto,Wallet,wallet,$${usdIn},${chatId},${name},${new Date()},${value} ${coin}`)
  notifyGroup(`💰 <b>Wallet Top-Up!</b>\nUser ${maskName(name)} just loaded their wallet and is ready to buy domains, leads & more.\nFund yours in seconds — /start`)
})

// Dynopay Pay plan
app.post('/dynopay/crypto-pay-plan', authDyno, async (req, res) => {
  // Validate
  const { ref, chatId, price, plan } = req.pay
  const { amount:value , currency:coin, payment_id:id } = req.body

  log({ method: 'dynopay/crypto-pay-plan', ref, chatId, plan, price, coin, value })

  if (!ref || !chatId || !plan || !price || !coin || !value) return log(translation('t.argsErr')) || res.send(html(translation('t.argsErr')))
  const info = await state.findOne({ _id: parseFloat(chatId) })
  const lang = info?.userLanguage ?? 'en'
  const preSpend = await loyalty.getTotalSpend(walletOf, chatId)

  // Logs
  del(chatIdOfDynopayPayment, ref)
  const name = await get(nameOf, chatId)
  set(payments, ref, `Crypto,Plan,${plan},$${price},${chatId},${name},${new Date()},${value} ${coin},transaction,${id}`)

  const ticker = tickerViewOfDyno[coin]
  const usdIn = await convert(value, ticker , 'usd')  
  const usdNeed = usdIn * 1.06
  console.log(`usdIn ${usdIn}, usdNeed ${usdNeed}, Crypto, Plan, ${chatId}, ${name}`)
  if (usdNeed < price) {
    sendMessage(chatId, translation('t.sentLessMoney', lang, `$${price}`, `$${usdIn}`))
    addFundsTo(walletOf, chatId, 'usd', usdIn, lang)
    return res.send(html(translation('t.lowPrice')))
  }
  console.log(`usdIn > price = ${usdIn > price}`)
  if (usdIn > price) {
    addFundsTo(walletOf, chatId, 'usd', usdIn - price, lang)
    sendMessage(chatId, translation('t.sentMoreMoney', lang, `$${price}`, `$${usdIn}`))
  }

  // Subscribe Plan
  subscribePlan(planEndingTime, freeDomainNamesAvailableFor, planOf, chatId, plan, bot, lang, freeValidationsAvailableFor)
  notifyGroup(`💎 <b>New Subscription!</b>\nUser ${maskName(name)} just upgraded to the <b>${plan} Plan</b> — unlocking ${freeDomainsOf[plan]} free domains + ${(freeValidationsOf[plan] || 0).toLocaleString()} phone validations.\nDon't miss out — /start`)
  webhookTierCheck(chatId, preSpend, lang)
  res.send(html())
})

// Dynopay Domain
app.post('/dynopay/crypto-pay-domain', authDyno, async (req, res) => {
  // Validate
  const { ref, chatId, price, domain } = req.pay
  const { amount:value , currency:coin, payment_id:id } = req.body

  log({ method: 'dynopay/crypto-pay-domain', ref, chatId, domain, price, coin, value })

  if (!ref || !chatId || !domain || !price || !coin || !value) return log(translation('t.argsErr')) || res.send(html(translation('t.argsErr')))

  const info = await state.findOne({ _id: parseFloat(chatId) })
  const lang = info?.userLanguage ?? 'en'
  const preSpend = await loyalty.getTotalSpend(walletOf, chatId)

  // Logs
  del(chatIdOfDynopayPayment, ref)
  const name = await get(nameOf, chatId)
  set(payments, ref, `Crypto,Domain,${domain},$${price},${chatId},${name},${new Date()},${value} ${coin},transaction,${id}`)

  // Update Wallet
  const ticker = tickerViewOfDyno[coin]
  const usdIn = await convert(value, ticker , 'usd')
  if (usdIn * 1.06 < price) {
    sendMessage(chatId, translation('t.sentLessMoney', lang, `$${price}`, `$${usdIn}`))
    addFundsTo(walletOf, chatId, 'usd', usdIn, lang)
    return res.send(html(translation('t.lowPrice')))
  }
  if (usdIn > price) {
    addFundsTo(walletOf, chatId, 'usd', usdIn - price, lang)
    sendMessage(chatId, translation('t.sentMoreMoney', lang, `$${price}`, `$${usdIn}`))
  }

  // Buy Domain
  const error = await buyDomainFullProcess(chatId, lang, domain)
  if (error) return res.send(html(error))
  notifyGroup(`🌐 <b>Domain Registered!</b>\nUser ${maskName(name)} just claimed <b>${domain}</b> — your dream domain could be next.\nGrab yours before it's taken — /start`)
  webhookTierCheck(chatId, preSpend, lang)
  res.send(html())
})

// Dynopay Hosting
app.post('/dynopay/crypto-pay-hosting', authDyno, async (req, res) => {
  // Validate
  const { ref, chatId, price } = req.pay
  const { amount:value , currency:coin } = req.body

  log({ method: 'dynopay/crypto-pay-hosting', ref, chatId, price, coin, value })

  if (!ref || !chatId || !price || !coin || !value) return log(translation('t.argsErr')) || res.send(html(translation('t.argsErr')))
  const info = await state.findOne({ _id: parseFloat(chatId) })
  const lang = info?.userLanguage ?? 'en'
  const preSpend = await loyalty.getTotalSpend(walletOf, chatId)
    // Logs
  del(chatIdOfDynopayPayment, ref)
  await insert(hostingTransactions, chatId, "dynopay", req.body)
  // Update Wallet
  const ticker = tickerViewOfDyno[coin]
  const usdIn = await convert(value, ticker , 'usd')
  if (usdIn * 1.06 < price) {
    sendMessage(chatId, translation('t.sentLessMoney', lang, `$${price}`, `$${usdIn}`))
    addFundsTo(walletOf, chatId, 'usd', usdIn, lang)
    return res.send(html(translation('t.lowPrice')))
  }
  if (usdIn > price) {
    addFundsTo(walletOf, chatId, 'usd', usdIn - price, lang)
    sendMessage(chatId, translation('t.sentMoreMoney', lang, `$${price}`, `$${usdIn}`))
  }

  const hostingResult = await registerDomainAndCreateCpanel(send, info, translation('o', lang), state)
  if (!hostingResult?.success) {
    // If new domain was registered, refund only hosting portion (domain is consumed)
    if (!info?.existingDomain && info?.domainPrice > 0) {
      const hostingRefund = usdIn - info.domainPrice
      if (hostingRefund > 0) addFundsTo(walletOf, chatId, 'usd', hostingRefund, lang)
      sendMessage(chatId, `Your domain <b>${info?.website_name}</b> has been registered successfully, but hosting setup failed. Domain cost ($${info.domainPrice}) charged — hosting portion ($${hostingRefund.toFixed(2)}) refunded to your wallet. Please contact support to complete hosting setup: ${process.env.APP_SUPPORT_LINK}`)
    } else {
      addFundsTo(walletOf, chatId, 'usd', usdIn, lang)
      sendMessage(chatId, hostingResult?.error || 'Hosting creation failed. Full payment refunded to your USD wallet.')
    }
    return res.send(html(hostingResult?.error || 'Hosting creation failed'))
  }
  webhookTierCheck(chatId, preSpend, lang)
  res.send(html())
})

// Dynopay Cloud Phone
app.post('/dynopay/crypto-pay-phone', authDyno, async (req, res) => {
  const { ref, chatId, price, cpData } = req.pay
  const { amount:value, currency:coin, payment_id:id } = req.body
  log({ method: 'dynopay/crypto-pay-phone', ref, chatId, price, coin, value })
  if (!ref || !chatId || !price || !coin || !value || !cpData) return log(translation('t.argsErr')) || res.send(html(translation('t.argsErr')))
  const info = await state.findOne({ _id: parseFloat(chatId) })
  const lang = info?.userLanguage ?? 'en'
  const preSpend = await loyalty.getTotalSpend(walletOf, chatId)
  del(chatIdOfDynopayPayment, ref)
  const name = await get(nameOf, chatId)
  set(payments, ref, `Crypto,CloudPhone,${cpData.selectedNumber},$${price},${chatId},${name},${new Date()},${value} ${coin},transaction,${id}`)
  const ticker = tickerViewOfDyno[coin]
  const usdIn = await convert(value, ticker, 'usd')
  if (usdIn * 1.06 < price) {
    sendMessage(chatId, translation('t.sentLessMoney', lang, `$${price}`, `$${usdIn}`))
    addFundsTo(walletOf, chatId, 'usd', usdIn, lang)
    return res.send(html(translation('t.lowPrice')))
  }
  if (usdIn > price) {
    addFundsTo(walletOf, chatId, 'usd', usdIn - price, lang)
    sendMessage(chatId, translation('t.sentMoreMoney', lang, `$${price}`, `$${usdIn}`))
  }

  const selectedNumber = cpData.selectedNumber
  const planKey = cpData.planKey
  const plan = phoneConfig.plans[planKey]
  const provider = cpData.provider || 'telnyx'
  const countryCode = cpData.countryCode || info?.cpCountryCode || 'US'
  const countryName = cpData.countryName || info?.cpCountryName || 'US'

  if (provider === 'twilio') {
    if (needsTwilioAddress(countryCode, provider)) {
      const cachedAddr = await getCachedTwilioAddress(chatId, countryCode)
      if (cachedAddr) {
        sendMessage(chatId, phoneConfig.getMsg(lang).purchasingNumber)
        const result = await executeTwilioPurchase(chatId, selectedNumber, planKey, price, countryCode, countryName, info?.cpNumberType || 'local', 'crypto_dynopay_' + coin, cachedAddr)
        if (result.error) { addFundsTo(walletOf, chatId, 'usd', Number(price), lang); return res.send(html(phoneConfig.getMsg(lang).purchaseFailed)) }
        sendMessage(chatId, phoneConfig.txt.activated(selectedNumber, result.plan?.name || planKey, price, result.sipUsername, phoneConfig.SIP_DOMAIN, phoneConfig.shortDate(result.expiresAt.toISOString())))
        return res.send(html())
      } else {
        await state.updateOne({ _id: parseFloat(chatId) }, { $set: {
          action: 'cpEnterAddress', cpPendingCoin: 'crypto_dynopay_' + coin, cpPendingPriceUsd: price, cpPendingPriceNgn: 0, cpPaymentMethod: 'crypto_dynopay_' + coin,
        }}, { upsert: true })
        const addrLoc = getAddressLocationText(countryCode)
        sendMessage(chatId, `✅ Crypto payment received!\n\n📍 <b>${countryName}</b> requires a billing address to activate the number.\nAddress ${addrLoc?.text || 'required'}.\n\nPlease enter your address:\n<code>Street, City, Country</code>\n\nExample: <i>123 Main St, Sydney, Australia</i>`, { parse_mode: 'HTML' })
        return res.send(html())
      }
    }
    sendMessage(chatId, phoneConfig.getMsg(lang).purchasingNumber)
    const result = await executeTwilioPurchase(chatId, selectedNumber, planKey, price, countryCode, countryName, info?.cpNumberType || 'local', 'crypto_dynopay_' + coin, null)
    if (result.error) { addFundsTo(walletOf, chatId, 'usd', Number(price), lang); return res.send(html(phoneConfig.getMsg(lang).purchaseFailed)) }
    sendMessage(chatId, phoneConfig.txt.activated(selectedNumber, result.plan?.name || planKey, price, result.sipUsername, phoneConfig.SIP_DOMAIN, phoneConfig.shortDate(result.expiresAt.toISOString())))
    return res.send(html())
  }

  // ── TELNYX ──
  sendMessage(chatId, phoneConfig.getMsg(lang).purchasingNumber)
  const orderResult = await telnyxApi.buyNumber(selectedNumber, telnyxResources.sipConnectionId, telnyxResources.messagingProfileId)
  if (!orderResult) { addFundsTo(walletOf, chatId, 'usd', Number(price), lang); return res.send(html(phoneConfig.getMsg(lang).purchaseFailed)) }
  const sipUsername = phoneConfig.generateSipUsername()
  const sipPassword = phoneConfig.generateSipPassword()
  if (telnyxResources.sipConnectionId) await telnyxApi.createSIPCredential(telnyxResources.sipConnectionId, sipUsername, sipPassword)
  const expiresAt = new Date(); expiresAt.setMonth(expiresAt.getMonth() + 1)
  const numberDoc = {
    phoneNumber: selectedNumber, telnyxOrderId: orderResult.id, country: countryCode, countryName,
    type: info?.cpNumberType || 'local', plan: planKey, planPrice: price,
    purchaseDate: new Date().toISOString(), expiresAt: expiresAt.toISOString(),
    autoRenew: true, status: 'active', sipUsername, sipPassword,
    sipDomain: phoneConfig.SIP_DOMAIN, provider: 'telnyx',
    messagingProfileId: telnyxResources.messagingProfileId, connectionId: telnyxResources.sipConnectionId,
    smsUsed: 0, minutesUsed: 0,
    features: { sms: true, callForwarding: { enabled: false, mode: 'disabled', forwardTo: null, ringTimeout: 25 },
      voicemail: { enabled: false, greetingType: 'default', customGreetingUrl: null, forwardToTelegram: true, forwardToEmail: null, ringTimeout: 25 },
      smsForwarding: { toTelegram: true, toEmail: null, webhookUrl: null }, recording: false }
  }
  const existing = await get(phoneNumbersOf, chatId)
  if (existing?.numbers) { existing.numbers.push(numberDoc); await set(phoneNumbersOf, chatId, { numbers: existing.numbers }) }
  else { await set(phoneNumbersOf, chatId, { numbers: [numberDoc] }) }
  await phoneTransactions.insertOne({ chatId, phoneNumber: selectedNumber, action: 'purchase', plan: planKey, amount: price, paymentMethod: 'crypto_dynopay_' + coin, timestamp: new Date().toISOString() })
  sendMessage(chatId, phoneConfig.txt.activated(selectedNumber, plan.name, price, sipUsername, phoneConfig.SIP_DOMAIN, phoneConfig.shortDate(expiresAt.toISOString())))
  notifyGroup(phoneConfig.txt.adminPurchase(maskName(name), selectedNumber, plan.name, price, 'Crypto DynoPay'))
  webhookTierCheck(chatId, preSpend, lang)
  res.send(html())
})

// Dynopay Leads / Validation
app.post('/dynopay/crypto-pay-leads', authDyno, async (req, res) => {
  const { ref, chatId, price, lastStep, leadsData } = req.pay
  const { amount:value, currency:coin, payment_id:id } = req.body
  log({ method: 'dynopay/crypto-pay-leads', ref, chatId, price, coin, value })
  if (!ref || !chatId || !price || !coin || !value || !lastStep) return log(translation('t.argsErr')) || res.send(html(translation('t.argsErr')))
  const info = await state.findOne({ _id: parseFloat(chatId) })
  const lang = info?.userLanguage ?? 'en'
  const preSpend = await loyalty.getTotalSpend(walletOf, chatId)
  del(chatIdOfDynopayPayment, ref)
  const name = await get(nameOf, chatId)
  const isValidator = lastStep === 'validatorSelectFormat'
  const label = isValidator ? 'Validation' : 'Leads'
  set(payments, ref, `Crypto,${label},$${price},${chatId},${name},${new Date()},${value} ${coin},transaction,${id}`)
  const ticker = tickerViewOfDyno[coin]
  const usdIn = await convert(value, ticker, 'usd')
  if (usdIn * 1.06 < price) {
    sendMessage(chatId, translation('t.sentLessMoney', lang, `$${price}`, `$${usdIn}`))
    addFundsTo(walletOf, chatId, 'usd', usdIn, lang)
    return res.send(html(translation('t.lowPrice')))
  }
  if (usdIn > price) {
    addFundsTo(walletOf, chatId, 'usd', usdIn - price, lang)
    sendMessage(chatId, translation('t.sentMoreMoney', lang, `$${price}`, `$${usdIn}`))
  }
  try {
    const ld = leadsData || {}
    let cc = countryCodeOf[ld.country]
    // For targeted leads: always enable CNAM for USA; for validator: respect user opt-in
    const cnam = ld.country === 'USA' ? (isValidator ? ld.cnamMode : (ld.targetName ? true : ld.cnamMode)) : false
    const format = ld.format
    const l = format === buyLeadsSelectFormat[0]
    if (isValidator) {
      sendMessage(chatId, translation('t.validatorBulkNumbersStart', lang))
      const phones = info?.phones?.slice(0, ld.amount)
      const result = await validatePhoneBulkFile(ld.carrier, phones, cc, cnam, bot, chatId)
      if (!result) return sendMessage(chatId, translation('t.validatorError', lang)) || res.send(html())
      sendMessage(chatId, translation('t.validatorSuccess', lang, ld.amount, result.length))
      cc = '+' + cc; const re = cc === '+1' ? '' : '0'
      fs.writeFile('leads.txt', result.map(a => (l ? a[0].replace(cc, re) : a[0])).join('\n'), () => bot?.sendDocument(chatId, 'leads.txt').catch(() => {}))
      if (cnam) { fs.writeFile('leads_with_cnam.txt', result.map(a => (l ? a[0].replace(cc, re) : a[0]) + ' ' + a[3]).join('\n'), () => { bot?.sendDocument(chatId, 'leads_with_cnam.txt').catch(() => {}); bot?.sendDocument(TELEGRAM_ADMIN_CHAT_ID, 'leads_with_cnam.txt').catch(() => {}) }) }
      else if (ld.country !== 'USA') { fs.writeFile('leads_with_carriers.txt', result.map(a => (l ? a[0].replace(cc, re) : a[0]) + ' ' + a[1]).join('\n'), () => { bot?.sendDocument(chatId, 'leads_with_carriers.txt').catch(() => {}); bot?.sendDocument(TELEGRAM_ADMIN_CHAT_ID, 'leads_with_carriers.txt').catch(() => {}) }) }
    } else {
      const _startMsg = ld.targetName ? '🎯 Sourcing real data in progress. Please wait...' : translation('t.validatorBulkNumbersStart', lang)
      sendMessage(chatId, _startMsg)
      let areaCodes
      if (info?.targetAreaCodes) { areaCodes = ld.area === 'Mixed Area Codes' ? info.targetAreaCodes : [ld.area] }
      else if (['Australia'].includes(ld.country)) { areaCodes = ['4'] }
      else { areaCodes = ld.area === 'Mixed Area Codes' ? _buyLeadsSelectAreaCode(ld.country, ld.area) : [ld.area] }
      const result = await validateBulkNumbers(ld.carrier, ld.amount, cc, areaCodes, cnam, bot, chatId, lang)
      if (!result) return sendMessage(chatId, translation('t.buyLeadsError', lang)) || res.send(html())
      const _successMsg = ld.targetName ? `🎯 Your ${ld.amount} targeted leads are ready — including phone owner names where matched.` : translation('t.buyLeadsSuccess', lang, ld.amount)
      sendMessage(chatId, _successMsg)
      cc = '+' + cc; const re = cc === '+1' ? '' : '0'
      const isTargetLeads = !!ld.targetName
      fs.writeFile('leads.txt', result.map(a => (l ? a[0].replace(cc, re) : a[0])).join('\n'), () => {
        bot?.sendDocument(chatId, 'leads.txt').catch(() => {})
        if (isTargetLeads) sendMessage(chatId, translation('t.leadsFileNumbersOnly', lang))
      })
      if (cnam) {
        const withNames = result.filter(a => a[3] && a[3].trim() && a[3].trim().toLowerCase() !== 'unknown')
        if (withNames.length > 0) {
          fs.writeFile('leads_with_names.txt', withNames.map(a => (l ? a[0].replace(cc, re) : a[0]) + ' ' + a[3]).join('\n'), () => {
            bot?.sendDocument(chatId, 'leads_with_names.txt').catch(() => {})
            if (isTargetLeads) sendMessage(chatId, translation('t.leadsFileWithNames', lang, withNames.length))
            bot?.sendDocument(TELEGRAM_ADMIN_CHAT_ID, 'leads_with_names.txt').catch(() => {})
          })
        }
      }
      else if (ld.country !== 'USA') { fs.writeFile('leads_with_carriers.txt', result.map(a => (l ? a[0].replace(cc, re) : a[0]) + ' ' + a[1]).join('\n'), () => { bot?.sendDocument(chatId, 'leads_with_carriers.txt').catch(() => {}); bot?.sendDocument(TELEGRAM_ADMIN_CHAT_ID, 'leads_with_carriers.txt').catch(() => {}) }) }
    }
    set(payments, nanoid(), `Crypto,${label},${ld.amount} leads,$${price},${chatId},${name},${new Date()},DynoPay ${coin}`)
    notifyGroup(`🏦 <b>${ld.targetName || label} Acquired!</b>\nUser ${maskName(name)} just grabbed ${ld.amount?.toLocaleString()} verified ${ld.targetName ? ld.targetName + ' ' : ''}leads with phone owner names via crypto.\nGet yours — /start`)
    webhookTierCheck(chatId, preSpend, lang)
  } catch (e) {
    log(`[dynopay-crypto-pay-leads] Error: ${e.message}`)
    sendMessage(chatId, `✅ Payment received! Your wallet has been credited $${Number(price).toFixed(2)}. Use wallet to complete your ${label.toLowerCase()} purchase.`)
    addFundsTo(walletOf, chatId, 'usd', Number(price), lang)
  }
  res.send(html())
})

// Dynopay VPS
app.post('/dynopay/crypto-pay-vps', authDyno, async (req, res) => {
  // Validate
  const { ref, chatId, price, vpsDetails } = req.pay
  const { amount:value , currency:coin } = req.body

  log({ method: 'dynopay/crypto-pay-vps', ref, chatId, price, coin, value })

  if (!ref || !chatId || !price || !coin || !value) return log(translation('t.argsErr')) || res.send(html(translation('t.argsErr')))

  const info = await state.findOne({ _id: parseFloat(chatId) })
  const lang = info?.userLanguage ?? 'en'
  const totalPrice = vpsDetails?.totalPrice
  const preSpend = await loyalty.getTotalSpend(walletOf, chatId)

  sendMessage(chatId, translation('vp.paymentRecieved', lang))
  // Logs
  del(chatIdOfDynopayPayment, ref)
  const name = await get(nameOf, chatId)
  let transaction = {
    type: 'new-plan',
    response: req.body
  }
  await insert(vpsTransactions, chatId, "dynopay", transaction)

  // Update Wallet
  const ticker = tickerViewOfDyno[coin]
  const usdIn = await convert(value, ticker , 'usd')
  if (usdIn * 1.06 < price) {
    sendMessage(chatId, translation('t.sentLessMoney', lang, `$${price}`, `$${usdIn}`))
    addFundsTo(walletOf, chatId, 'usd', Number(usdIn), lang)
    return res.send(html(translation('t.lowPrice')))
  }
  if (usdIn > price) {
    addFundsTo(walletOf, chatId, 'usd', Number(usdIn) - Number(price), lang)
    sendMessage(chatId, translation('t.sentMoreMoney', lang, `$${price}`, `$${usdIn}`))
  }

  if (vpsDetails.plan === 'Hourly') {
    addFundsTo(walletOf, chatId, 'usd', Number(usdIn) - Number(totalPrice), lang)
    sendMessage(chatId, translation('vp.extraMoney', lang))
  }

  const isSuccess = await buyVPSPlanFullProcess(chatId, lang, vpsDetails)
  if (!isSuccess) return res.send(html(error))
  webhookTierCheck(chatId, preSpend, lang)
  res.send(html())
})

// Dynopay Upgrade VPS
app.post('/dynopay/crypto-pay-upgrade-vps', authDyno, async (req, res) => {
  // Validate
  const { ref, chatId, price, vpsDetails } = req.pay
  const { amount:value , currency:coin } = req.body

  log({ method: 'dynopay/crypto-pay-upgrade-vps', ref, chatId, price, coin, value })

  if (!ref || !chatId || !price || !coin || !value) return log(translation('t.argsErr')) || res.send(html(translation('t.argsErr')))

  const info = await state.findOne({ _id: parseFloat(chatId) })
  const lang = info?.userLanguage ?? 'en'
  const totalPrice = Number(vpsDetails?.totalPrice)
  const preSpend = await loyalty.getTotalSpend(walletOf, chatId)

  sendMessage(chatId, translation('vp.vpsChangePaymentRecieved', lang))
  // Logs
  del(chatIdOfDynopayPayment, ref)
  let transaction = {
    type: vpsDetails.upgradeType === 'plan' ? 'upgrade-plan' : 'upgrade-disk',
    response: req.body
  }
  await insert(vpsTransactions, chatId, "dynopay", transaction)

  // Update Wallet
  const ticker = tickerViewOfDyno[coin]
  const usdIn = await convert(value, ticker , 'usd')
  if (usdIn * 1.06 < price) {
    sendMessage(chatId, translation('t.sentLessMoney', lang, `$${price}`, `$${usdIn}`))
    addFundsTo(walletOf, chatId, 'usd', Number(usdIn), lang)
    return res.send(html(translation('t.lowPrice')))
  }
  if (usdIn > price) {
    addFundsTo(walletOf, chatId, 'usd', Number(usdIn) - Number(price), lang)
    sendMessage(chatId, translation('t.sentMoreMoney', lang, `$${price}`, `$${usdIn}`))
  }

  if (vpsDetails?.billingCycle === 'Hourly') {
    addFundsTo(walletOf, chatId, 'usd', Number(usdIn) - Number(totalPrice), lang)
    sendMessage(chatId, translation('vp.extraMoney', lang))
  }

  const isSuccess = await upgradeVPSDetails(chatId, lang, vpsDetails)
  if (!isSuccess) return res.send(html(error))
  webhookTierCheck(chatId, preSpend, lang)
  res.send(html())
})


// Dynopay Digital Product
app.post('/dynopay/crypto-pay-digital-product', authDyno, async (req, res) => {
  const { ref, chatId, price, product, orderId } = req.pay
  const { amount: value, currency: coin, payment_id: id } = req.body
  log({ method: 'dynopay/crypto-pay-digital-product', ref, chatId, product, price, coin, value })
  if (!ref || !chatId || !product || !price || !coin || !value) return log(translation('t.argsErr')) || res.send(html(translation('t.argsErr')))
  const info = await state.findOne({ _id: parseFloat(chatId) })
  const lang = info?.userLanguage ?? 'en'
  const preSpend = await loyalty.getTotalSpend(walletOf, chatId)
  del(chatIdOfDynopayPayment, ref)
  const name = await get(nameOf, chatId)
  set(payments, ref, `Crypto,DigitalProduct,${product},$${price},${chatId},${name},${new Date()},${value} ${coin},transaction,${id}`)
  const ticker = tickerViewOfDyno[coin]
  const usdIn = await convert(value, ticker, 'usd')
  if (usdIn * 1.06 < price) {
    sendMessage(chatId, translation('t.sentLessMoney', lang, `$${price}`, `$${usdIn}`))
    addFundsTo(walletOf, chatId, 'usd', usdIn, lang)
    return res.send(html(translation('t.lowPrice')))
  }
  if (usdIn > price) {
    addFundsTo(walletOf, chatId, 'usd', usdIn - price, lang)
    sendMessage(chatId, translation('t.sentMoreMoney', lang, `$${price}`, `$${usdIn}`))
  }
  await digitalOrdersCol.updateOne({ orderId }, { $set: { status: 'pending', paymentConfirmedAt: new Date() } })
  send(chatId, translation('t.dpOrderConfirmed', lang, product, price, orderId), translation('o', lang))
  notifyGroup(`🛒 <b>Digital Product Paid!</b>\n\n🆔 Order: <code>${orderId}</code>\n👤 User: ${maskName(name)} (${chatId})\n📦 Product: <b>${product}</b>\n💵 Paid: <b>$${price}</b> (Crypto)\n\n📩 Deliver with:\n<code>/deliver ${orderId} [details]</code>`)
  webhookTierCheck(chatId, preSpend, lang)
  res.send(html())
})


// Dynopay wallet 
app.post('/dynopay/crypto-wallet', authDyno, async (req, res) => {
  log('=== DYNOPAY WALLET WEBHOOK PROCESSING START ===')
  
  // Validate
  const { ref, chatId } = req.pay
  const { amount:value , currency:coin, payment_id:id } = req.body
  
  log('Extracted data - ref:', ref, 'chatId:', chatId, 'coin:', coin, 'value:', value, 'transaction_id:', id)
  
  if (!ref || !chatId || !coin || !value) {
    log('ERROR: Missing required fields - ref:', ref, 'chatId:', chatId, 'coin:', coin, 'value:', value)
    return res.send(html(translation('t.argsErr')))
  }
  
  const info = await state.findOne({ _id: parseFloat(chatId) })
  const lang = info?.userLanguage ?? 'en'
  log('User language:', lang)

  // Update Wallet
  const ticker = tickerViewOfDyno[coin]
  log('Currency mapping - coin:', coin, '-> ticker:', ticker)
  
  if (!ticker) {
    log('ERROR: Unknown currency received from Dynopay:', coin)
    log('Supported currencies:', Object.keys(tickerViewOfDyno))
    return res.send(html('Currency not supported: ' + coin))
  }
  
  // Use base_amount (confirmed USD) from DynoPay when fee_payer is company
  // This prevents users losing money due to fee deduction + re-conversion variance
  const baseAmount = req.body.base_amount
  const feePayer = req.body.fee_payer
  let usdIn

  if (baseAmount && feePayer === 'company') {
    usdIn = parseFloat(baseAmount)
    log('Using DynoPay base_amount (fee_payer=company):', baseAmount, 'USD')
  } else {
    log('Converting', value, ticker, 'to USD (no base_amount or fee_payer != company)...')
    usdIn = await convert(value, ticker , 'usd')
    log('Conversion result:', value, ticker, '= $' + usdIn, 'USD')
  }
  
  log('Crediting wallet for chatId:', chatId, 'amount: $' + usdIn)
  await addFundsTo(walletOf, chatId, 'usd', usdIn, lang)
  log('Wallet credited successfully!')
  
  log('Sending confirmation message to user...')
  sendMessage(chatId, translation('t.confirmationDepositMoney' , lang, value + ' ' + coin, usdIn))
  log('Confirmation message sent')

  // Logs
  res.send(html())
  del(chatIdOfDynopayPayment, ref)
  const name = await get(nameOf, chatId)
  set(payments, ref, `Crypto,Wallet,wallet,$${usdIn},${chatId},${name},${new Date()},${value} ${coin},transaction,${id}`)
  notifyGroup(`💰 <b>Wallet Top-Up!</b>\nUser ${maskName(name)} just loaded their wallet and is ready to buy domains, leads & more.\nFund yours in seconds — /start`)
  
  log('=== DYNOPAY WALLET WEBHOOK PROCESSING COMPLETE ===')
})

//
// Override the early health check routes with full functionality
app.get('/', (req, res) => {
  // Return 200 OK for health checks even during startup
  res.status(200).send(html(translation('t.greet')))
})

app.get('/terms-condition', (req, res) => {
  const { lang } = req.query
  res.send(html(translation('l.termsAndCondMsg', lang)))
})

app.get('/ok', (req, res) => {
  res.send(html('ok'))
})
app.get('/woo', (req, res) => {
  log(req.hostname + req.originalUrl)
  res.send(html('woo'))
})
app.get('/health', async (req, res) => {
  // Always return 200 for Railway health checks
  // Report actual DB status in the response body
  const dbHealthy = isDbHealthy()
  appReady = dbHealthy // Update global appReady flag
  
  res.status(200).json({
    status: dbHealthy ? 'healthy' : 'starting',
    database: dbHealthy ? 'connected' : 'connecting',
    uptime: ((new Date() - serverStartTime) / (1000 * 60 * 60)).toFixed(2) + ' hours'
  })
})
app.get('/json1444', async (req, res) => {
  await backupTheData()
  const fileName = 'backup.json'
  res.setHeader('Content-Disposition', `attachment; filename=${fileName}`)
  res.setHeader('Content-Type', 'application/json')
  fs.createReadStream(fileName).pipe(res)
})
app.get('/payments12341234', async (req, res) => {
  await backupPayments()
  const fileName = 'payments.csv'
  res.setHeader('Content-Disposition', `attachment; filename=${fileName}`)
  res.setHeader('Content-Type', 'application/json')
  fs.createReadStream(fileName).pipe(res)
})
app.get('/uptime', (req, res) => {
  let now = new Date()
  let uptimeInMilliseconds = now - serverStartTime
  let uptimeInHours = uptimeInMilliseconds / (1000 * 60 * 60)
  res.send(html(`Server has been running for ${uptimeInHours.toFixed(2)} hours.`))
})
//
app.get('/subscribe', (req, res) => {
  const phone = req?.query?.Phone
  const name = req?.query?.['full-name']

  log({ phone, name })
  res.send(html(translation('t.subscribeRCS', null, phone)))
})
app.get('/unsubscribe', (req, res) => {
  const phone = req?.query?.Phone

  log({ phone })
  res.send(html(translation('t.subscribeRCS', null, phone)))
})

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADMIN: Reset all user keyboards
// Clears stale action states and sends fresh keyboard to all users
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
app.get('/admin/reset-keyboards', async (req, res) => {
  const adminKey = req?.query?.key
  if (adminKey !== process.env.SESSION_SECRET?.slice(0, 16)) {
    return res.status(403).json({ error: 'Unauthorized' })
  }

  try {
    // Step 1: Reset all users' action state to 'none'
    const resetResult = await state.updateMany(
      { action: { $exists: true, $ne: 'none' } },
      { $set: { action: 'none' } }
    )
    log(`[reset-keyboards] Reset ${resetResult.modifiedCount} user states to 'none'`)

    // Step 2: Get all user chatIds from nameOf collection
    const allUsers = await nameOf.find({}).toArray()
    const chatIds = allUsers.map(u => u._id).filter(id => typeof id === 'number')

    // Step 3: Send fresh keyboard to all users in batches
    const BATCH_SIZE = 25
    const DELAY_MS = 1000
    let sent = 0
    let failed = 0

    for (let i = 0; i < chatIds.length; i += BATCH_SIZE) {
      const batch = chatIds.slice(i, i + BATCH_SIZE)
      const promises = batch.map(async (cid) => {
        try {
          const userInfo = await get(state, cid)
          const lang = userInfo?.userLanguage || 'en'
          const keyboard = translation('o', lang)
          await bot?.sendMessage(cid, translation('t.welcome', lang), keyboard)
          sent++
        } catch (e) {
          failed++
          if (e.message?.includes('bot was blocked') || e.message?.includes('chat not found')) {
            log(`[reset-keyboards] User ${cid} blocked/not found, skipping`)
          }
        }
      })
      await Promise.all(promises)
      if (i + BATCH_SIZE < chatIds.length) {
        await new Promise(r => setTimeout(r, DELAY_MS))
      }
    }

    const result = {
      success: true,
      statesReset: resetResult.modifiedCount,
      totalUsers: chatIds.length,
      keyboardsSent: sent,
      failed: failed,
    }
    log('[reset-keyboards] Complete:', JSON.stringify(result))
    res.json(result)
  } catch (error) {
    log('[reset-keyboards] Error:', error.message)
    res.status(500).json({ error: error.message })
  }
})

// Quick state-only reset (no message sent to users)
app.get('/admin/reset-states', async (req, res) => {
  const adminKey = req?.query?.key
  if (adminKey !== process.env.SESSION_SECRET?.slice(0, 16)) {
    return res.status(403).json({ error: 'Unauthorized' })
  }

  try {
    const resetResult = await state.updateMany(
      { action: { $exists: true, $ne: 'none' } },
      { $set: { action: 'none' } }
    )
    log(`[reset-states] Reset ${resetResult.modifiedCount} user states`)
    res.json({ success: true, statesReset: resetResult.modifiedCount })
  } catch (error) {
    log('[reset-states] Error:', error.message)
    res.status(500).json({ error: error.message })
  }
})

app.get('/planInfo', async (req, res) => {
  if (process.env.OLD_APP_ACTIVE === 'false') return res.send('old app off now')

  const chatId = Number(req?.query?.code)
  if (isNaN(chatId)) return res.status(400).json({ msg: 'Issue in datatype' })
  const name = await get(nameOf, chatId)

  if (!name) return res.json({ planExpiry: 'invalid' })
  const loginData = (await get(loginCountOf, Number(chatId))) || { loginCount: 0, canLogin: true }
  return res.json({
    pauseTime: 10 * 1000,
    planExpiry: (await get(planEndingTime, chatId)) || 0,
    loginCount: loginData.loginCount,
  })
})

app.get('/planInfoTwo', async (req, res) => {
  const chatId = Number(req?.query?.code)
  if (isNaN(chatId)) return res.status(400).json({ msg: 'Issue in datatype' })
  const name = await get(nameOf, chatId)

  if (!name) return res.json({ planExpiry: 'invalid' })
  const loginData = (await get(loginCountOf, Number(chatId))) || { loginCount: 0, canLogin: true }
  return res.json({
    pauseTime: 10 * 1000,
    planExpiry: (await get(planEndingTime, chatId)) || 0,
    loginCount: loginData.loginCount,
    name,
  })
})
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DOMAIN DNS SYNC API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const { runDomainSync, syncSingleDomain } = require('./domain-sync')

// Run full domain DNS sync
app.get('/domain-sync/run', async (req, res) => {
  try {
    log('[API] Domain sync triggered')
    const report = await runDomainSync(db)
    res.json({ success: true, report })
  } catch (error) {
    log('[API] Domain sync error:', error.message)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Get last sync report
app.get('/domain-sync/report', async (req, res) => {
  try {
    const lastReport = await db.collection('domainSyncResults')
      .find({})
      .sort({ _id: -1 })
      .limit(1)
      .toArray()
    res.json({ success: true, report: lastReport[0] || null })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// Sync a single domain
app.get('/domain-sync/single/:domain', async (req, res) => {
  try {
    const domain = req.params.domain
    const doc = await db.collection('registeredDomains').findOne({ _id: domain })
    if (!doc) return res.status(404).json({ success: false, error: 'Domain not found in database' })
    const result = await syncSingleDomain(doc, db)
    res.json({ success: true, result })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// List all domains with their sync status
app.get('/domain-sync/list', async (req, res) => {
  try {
    const domains = await db.collection('registeredDomains').find({}, {
      projection: {
        '_id': 1, 'val.registrar': 1, 'val.provider': 1, 'val.nameserverType': 1,
        'val.cfZoneId': 1, 'val.status': 1, 'val.opStatus': 1, 'val.cfStatus': 1,
        'val.lastSyncedAt': 1, 'val.ownerChatId': 1, 'val.opExpiry': 1,
        'val.liveDnsRecords': 1,
      }
    }).toArray()
    res.json({ success: true, count: domains.length, domains })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

//
app.get('/:id', async (req, res) => {
  const id = req?.params?.id
  if (id === '') return res.json({ message: 'Salam', from: req.hostname })

  // Build lookup key from SELF_URL (works on both Railway and Emergent)
  // On Railway: SELF_URL = "https://app.railway.app" → key = "app@railway@app/slug"
  // On Emergent: SELF_URL = "https://pod.emergentagent.com/api" → key = "pod@...@com/api/slug"
  const selfUrlPath = (process.env.SELF_URL || '').replace('https://', '').replace('http://', '')
  const selfKey = `${selfUrlPath}/${id}`.replaceAll('.', '@')
  let url = await get(fullUrlOf, selfKey)
  let lookupKey = selfKey

  // Fallback: try custom domain lookup (e.g., goog.link/abc → goog@link/abc)
  if (!url) {
    const customKey = `${req.hostname}/${id}`.replaceAll('.', '@')
    url = await get(fullUrlOf, customKey)
    lookupKey = customKey
  }

  if (!url) return res.status(404).send(html('Link not found'))
  if (!(await isValid(lookupKey))) return res.status(404).send(html(translation('t.linkExpired')))

  res.redirect(url)
  increment(clicksOf, 'total')
  increment(clicksOf, today())
  increment(clicksOf, week())
  increment(clicksOf, month())
  increment(clicksOf, year())
  increment(clicksOn, lookupKey)
})

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TELNYX WEBHOOK ENDPOINTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Telnyx SMS Webhook — receives inbound SMS
app.post('/telnyx/sms-webhook', async (req, res) => {
  try {
    log('📩 Telnyx SMS webhook received')
    await handleInboundSms(req.body, bot, phoneNumbersOf, phoneLogs)
    res.sendStatus(200)
  } catch (error) {
    log('Telnyx SMS webhook error:', error.message)
    res.sendStatus(200) // Always 200 to prevent retries
  }
})

// Telnyx Voice Webhook — receives call events
app.post('/telnyx/voice-webhook', async (req, res) => {
  try {
    log('📞 Telnyx voice webhook received:', req.body?.data?.event_type || 'unknown')
    await handleVoiceWebhook(req, res)
  } catch (error) {
    log('Telnyx voice webhook error:', error.message)
    res.sendStatus(200)
  }
})

// Telnyx Fax Webhook — receives inbound fax events
app.post('/telnyx/fax-webhook', async (req, res) => {
  res.sendStatus(200)
  try {
    const event = req.body?.data || req.body
    const eventType = event?.event_type || event?.type
    const payload = event?.payload || event
    log(`📠 Telnyx fax webhook: ${eventType}`)

    if (eventType === 'fax.received') {
      await handleInboundFax(payload)
    } else if (eventType === 'fax.failed') {
      const to = payload?.to || ''
      const from = payload?.from || ''
      const reason = payload?.failure_reason || 'Unknown'
      log(`📠 Fax failed: ${from} → ${to}: ${reason}`)
      // Find number owner and notify
      const allUsers = await db.collection('phoneNumbersOf').find({}).toArray()
      for (const user of allUsers) {
        const numbers = user.val?.numbers || []
        const match = numbers.find(n => n.phoneNumber === to && n.status === 'active')
        if (match) {
          const faxFwd = match.features?.faxForwarding
          if (faxFwd?.toTelegram !== false) {
            bot?.sendMessage(user._id, phoneConfig.txt.faxFailed(from, to, reason), { parse_mode: 'HTML' }).catch(() => {})
          }
          break
        }
      }
    }
  } catch (error) {
    log('Telnyx fax webhook error:', error.message)
  }
})

// Handle inbound fax — download PDF and forward to Telegram
async function handleInboundFax(payload) {
  const to = payload?.to || ''
  const from = payload?.from || ''
  const mediaUrl = payload?.media_url || ''
  const faxId = payload?.fax_id || payload?.id || ''
  const pages = payload?.page_count || null
  log(`📠 Fax received: ${from} → ${to}, media: ${mediaUrl}, id: ${faxId}`)

  // Find the number owner
  const allUsers = await db.collection('phoneNumbersOf').find({}).toArray()
  let owner = null, num = null
  for (const user of allUsers) {
    const numbers = user.val?.numbers || []
    const match = numbers.find(n => n.phoneNumber === to && n.status === 'active')
    if (match) { owner = user._id; num = match; break }
  }

  if (!owner || !num) {
    log(`📠 Fax received for unknown number: ${to}`)
    return
  }

  const faxFwd = num.features?.faxForwarding
  if (faxFwd?.toTelegram === false) {
    log(`📠 Fax forwarding disabled for ${to}`)
    return
  }

  // Notify user
  bot?.sendMessage(owner, phoneConfig.txt.faxReceived(from, to, pages), { parse_mode: 'HTML' }).catch(() => {})

  // Download and send the PDF
  if (mediaUrl) {
    try {
      const axios = require('axios')
      const TELNYX_API_KEY = process.env.TELNYX_API_KEY
      const pdfRes = await axios.get(mediaUrl, {
        responseType: 'arraybuffer',
        headers: TELNYX_API_KEY ? { 'Authorization': `Bearer ${TELNYX_API_KEY}` } : {},
        timeout: 30000
      })
      const pdfBuffer = Buffer.from(pdfRes.data)
      const filename = `fax_${from.replace(/[^+\d]/g, '')}_${new Date().toISOString().slice(0, 10)}.pdf`
      await bot?.sendDocument(owner, pdfBuffer, { caption: `📠 Fax from ${from}` }, { filename, contentType: 'application/pdf' })
    } catch (dlErr) {
      log(`📠 Fax PDF download/send error: ${dlErr.message}`)
      // Fallback: send the URL directly
      bot?.sendMessage(owner, `📠 Fax PDF available at:\n${mediaUrl}\n\n(Auto-download failed: ${dlErr.message})`, { parse_mode: 'HTML' }).catch(() => {})
    }
  } else if (faxId) {
    // Try to fetch media via Telnyx fax API
    try {
      const axios = require('axios')
      const TELNYX_API_KEY = process.env.TELNYX_API_KEY
      const faxRes = await axios.get(`https://api.telnyx.com/v2/faxes/${faxId}`, {
        headers: { 'Authorization': `Bearer ${TELNYX_API_KEY}` }
      })
      const faxMediaUrl = faxRes.data?.data?.media_url
      if (faxMediaUrl) {
        const pdfRes = await axios.get(faxMediaUrl, {
          responseType: 'arraybuffer',
          headers: { 'Authorization': `Bearer ${TELNYX_API_KEY}` },
          timeout: 30000
        })
        const pdfBuffer = Buffer.from(pdfRes.data)
        const filename = `fax_${from.replace(/[^+\d]/g, '')}_${new Date().toISOString().slice(0, 10)}.pdf`
        await bot?.sendDocument(owner, pdfBuffer, { caption: `📠 Fax from ${from}` }, { filename, contentType: 'application/pdf' })
      } else {
        bot?.sendMessage(owner, `📠 Fax received but no PDF available. Fax ID: ${faxId}`, { parse_mode: 'HTML' }).catch(() => {})
      }
    } catch (e) {
      log(`📠 Fax API fetch error: ${e.message}`)
      bot?.sendMessage(owner, `📠 Fax received but PDF retrieval failed. Fax ID: ${faxId}`, { parse_mode: 'HTML' }).catch(() => {})
    }
  }

  // Log the fax
  await db.collection('phoneLogs').insertOne({
    chatId: parseFloat(owner),
    type: 'fax',
    direction: 'inbound',
    from,
    to,
    phoneNumber: to.replace(/[^+\d]/g, ''),
    faxId,
    pages,
    mediaUrl: mediaUrl || null,
    timestamp: new Date().toISOString()
  }).catch(e => log(`📠 Fax log error: ${e.message}`))
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TWILIO WEBHOOKS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Twilio Inbound Voice Webhook (PSTN calls to Twilio numbers)
// Enhanced with IVR, voicemail, and call recording (feature parity with Telnyx)
app.post('/twilio/voice-webhook', async (req, res) => {
  const VoiceResponse = require('twilio').twiml.VoiceResponse
  try {
    const { To, From, CallSid } = req.body || {}
    log(`📞 [Twilio] Inbound call: ${From} → ${To} (${CallSid})`)

    // Find the number owner
    const allUsers = await db.collection('phoneNumbersOf').find({}).toArray()
    let owner = null, num = null
    for (const user of allUsers) {
      const numbers = user.val?.numbers || []
      const match = numbers.find(n => n.phoneNumber === To && n.provider === 'twilio' && n.status === 'active')
      if (match) { owner = user._id; num = match; break }
    }

    const response = new VoiceResponse()

    if (!num || !owner) {
      response.say('This number is not currently active.')
      response.hangup()
      return res.type('text/xml').send(response.toString())
    }

    const chatId = owner
    const fwdConfig = num.features?.callForwarding
    const vmConfig = num.features?.voicemail
    const recordingEnabled = num.features?.recording === true

    // Check minute limit
    const planLimits = phoneConfig.plans[num.plan]
    const minuteLimit = planLimits?.minutes || Infinity
    if (minuteLimit !== Infinity && (num.minutesUsed || 0) >= minuteLimit) {
      response.say('This number has reached its monthly minute limit.')
      response.hangup()
      bot?.sendMessage(chatId, `🚫 <b>Call Blocked</b> — Minute limit reached (${num.minutesUsed}/${minuteLimit} min).\nUpgrade your plan for more minutes.`, { parse_mode: 'HTML' }).catch(() => {})
      return res.type('text/xml').send(response.toString())
    }

    // Call Forwarding with wallet check
    if (fwdConfig?.enabled && fwdConfig.forwardTo) {
      const RATE = parseFloat(process.env.CALL_FORWARDING_RATE_MIN || '0.50')
      const { usdBal } = await getBalance(walletOf, chatId)
      if (usdBal < RATE) {
        // Insufficient balance — fall through to voicemail if enabled
        if (vmConfig?.enabled) {
          bot?.sendMessage(chatId, `🚫 <b>Call Forwarding Blocked</b> — Wallet $${usdBal.toFixed(2)} (need $${RATE}/min). Sending to voicemail.`, { parse_mode: 'HTML' }).catch(() => {})
        } else {
          response.say('Your wallet balance is insufficient for call forwarding. Please try again later.')
          response.hangup()
          bot?.sendMessage(chatId, `🚫 <b>Call Forwarding Blocked</b> — Wallet $${usdBal.toFixed(2)} (need $${RATE}/min).\nTop up via Wallet.`, { parse_mode: 'HTML' }).catch(() => {})
          return res.type('text/xml').send(response.toString())
        }
      } else {
        // Forward the call
        const ringTimeout = fwdConfig.ringTimeout || 25
        const dialOpts = {
          callerId: To,
          timeout: ringTimeout,
          action: `${SELF_URL}/twilio/voice-dial-status?chatId=${chatId}&from=${encodeURIComponent(From)}&to=${encodeURIComponent(To)}`
        }
        if (recordingEnabled) dialOpts.record = 'record-from-answer-dual'
        if (recordingEnabled) dialOpts.recordingStatusCallback = `${SELF_URL}/twilio/recording-status`
        const dial = response.dial(dialOpts)
        dial.number(fwdConfig.forwardTo)
        bot?.sendMessage(chatId, `📞 <b>Incoming Call</b>\nFrom: ${From}\nForwarding to: ${fwdConfig.forwardTo}`, { parse_mode: 'HTML' }).catch(() => {})
        return res.type('text/xml').send(response.toString())
      }
    }

    // Voicemail — if enabled and no forwarding (or forwarding failed due to balance)
    if (vmConfig?.enabled) {
      const greeting = vmConfig.greetingType === 'custom' && vmConfig.customGreetingUrl
        ? null
        : 'The person you are calling is unavailable. Please leave a message after the beep.'
      if (vmConfig.customGreetingUrl && vmConfig.greetingType === 'custom') {
        response.play(vmConfig.customGreetingUrl)
      } else {
        response.say(greeting)
      }
      response.record({
        maxLength: 120,
        action: `${SELF_URL}/twilio/voicemail-complete?chatId=${chatId}&from=${encodeURIComponent(From)}&to=${encodeURIComponent(To)}`,
        transcribe: false,
        playBeep: true,
        timeout: 5
      })
      response.say('No message recorded. Goodbye.')
      response.hangup()
      return res.type('text/xml').send(response.toString())
    }

    // No forwarding and no voicemail — just notify
    response.say('The person you are calling is unavailable. Please try again later.')
    response.hangup()
    bot?.sendMessage(chatId, `📞 <b>Missed Call</b>\nFrom: ${From}\nTo: ${To}`, { parse_mode: 'HTML' }).catch(() => {})

    res.type('text/xml').send(response.toString())
  } catch (error) {
    log('[Twilio] Voice webhook error:', error.message)
    const VR = new VoiceResponse()
    VR.say('An error occurred. Please try again.')
    VR.hangup()
    res.type('text/xml').send(VR.toString())
  }
})

// Twilio Dial Status Callback — handles forwarded call result (no answer → voicemail)
// Also handles SIP bridge and SIP outbound call results
app.post('/twilio/voice-dial-status', async (req, res) => {
  const VoiceResponse = require('twilio').twiml.VoiceResponse
  try {
    const { DialCallStatus, DialCallDuration } = req.body || {}
    const { chatId, from, to, type } = req.query || {}
    const response = new VoiceResponse()

    log(`[Twilio] Dial status: ${DialCallStatus} (${DialCallDuration || 0}s) chatId=${chatId} type=${type || 'forward'}`)

    if (DialCallStatus === 'completed') {
      // Call was answered and completed — bill the call
      const duration = parseInt(DialCallDuration || '0')
      const minutes = duration > 0 ? Math.ceil(duration / 60) : 0
      if (minutes > 0 && chatId && to) {
        try {
          const userData = await get(phoneNumbersOf, chatId)
          const numbers = userData?.numbers || []
          const num = numbers.find(n => n.phoneNumber === decodeURIComponent(to) && n.provider === 'twilio')
          if (num) {
            const RATE = parseFloat(process.env.CALL_FORWARDING_RATE_MIN || '0.50')
            // Determine destination: for SIP calls use 'from' param (the dialed number), for forwards use forwardTo config
            const destination = type === 'sip_bridge' || type === 'sip_outbound'
              ? decodeURIComponent(from || '')
              : (num.features?.callForwarding?.forwardTo || '')
            const isUSCA = destination.replace(/[^+\d]/g, '').startsWith('+1')
            const rate = isUSCA ? parseFloat(process.env.OVERAGE_RATE_MIN || '0.04') : RATE
            const cost = minutes * rate
            await atomicIncrement(walletOf, chatId, 'usdOut', cost)
            num.minutesUsed = (num.minutesUsed || 0) + minutes
            await set(phoneNumbersOf, chatId, { numbers })
            const label = type === 'sip_bridge' ? 'SIP Bridge Call' : type === 'sip_outbound' ? 'SIP Outbound Call' : 'Forwarded Call'
            log(`[Twilio] ${label} billed: ${minutes} min × $${rate}/min = $${cost.toFixed(2)} (${isUSCA ? 'US/CA' : 'Intl'})`)
            bot?.sendMessage(chatId, `📞 <b>${label} Ended</b>\n📲 ${destination}\n⏱️ ${minutes} min — $${cost.toFixed(2)} deducted (${isUSCA ? 'US/CA' : 'Intl'} rate)`, { parse_mode: 'HTML' }).catch(() => {})
          }
        } catch (e) { log(`[Twilio] Call billing error: ${e.message}`) }
      }
      response.hangup()
      return res.type('text/xml').send(response.toString())
    }

    // Call was not answered (no-answer, busy, failed, canceled)
    const decodedFrom = decodeURIComponent(from || 'unknown')
    const decodedTo = decodeURIComponent(to || '')

    // For SIP bridge/outbound calls: notify user about the failure
    if (type === 'sip_bridge' || type === 'sip_outbound') {
      const label = type === 'sip_bridge' ? 'SIP Bridge Call' : 'SIP Outbound Call'
      const reason = DialCallStatus === 'no-answer' ? 'No answer'
        : DialCallStatus === 'busy' ? 'Line busy'
        : DialCallStatus === 'failed' ? 'Call failed'
        : DialCallStatus === 'canceled' ? 'Cancelled'
        : DialCallStatus || 'Unknown'
      bot?.sendMessage(chatId, `❌ <b>${label} Failed</b>\n📲 ${decodedFrom} — ${reason}`, { parse_mode: 'HTML' }).catch(() => {})
      response.say(`The call could not be completed. ${reason}.`)
      response.hangup()
      return res.type('text/xml').send(response.toString())
    }

    // For forwarded calls: check if voicemail is enabled
    if (chatId && to) {
      const userData = await get(phoneNumbersOf, chatId)
      const numbers = userData?.numbers || []
      const num = numbers.find(n => n.phoneNumber === decodedTo && n.provider === 'twilio')
      const vmConfig = num?.features?.voicemail

      // Notify user about the forward failure
      const fwdTo = num?.features?.callForwarding?.forwardTo || 'unknown'
      const reason = DialCallStatus === 'no-answer' ? 'No answer'
        : DialCallStatus === 'busy' ? 'Line busy'
        : DialCallStatus === 'failed' ? 'Call failed'
        : DialCallStatus === 'canceled' ? 'Cancelled'
        : DialCallStatus || 'Unknown'
      bot?.sendMessage(chatId, `❌ <b>Forward Failed</b> — ${reason}\nFrom: ${decodedFrom}\n📲 ${fwdTo} didn't answer`, { parse_mode: 'HTML' }).catch(() => {})

      if (vmConfig?.enabled) {
        const greeting = vmConfig.greetingType === 'custom' && vmConfig.customGreetingUrl
          ? null
          : 'The person you are calling is unavailable. Please leave a message after the beep.'
        if (vmConfig.customGreetingUrl && vmConfig.greetingType === 'custom') {
          response.play(vmConfig.customGreetingUrl)
        } else {
          response.say(greeting)
        }
        response.record({
          maxLength: 120,
          action: `${SELF_URL}/twilio/voicemail-complete?chatId=${chatId}&from=${encodeURIComponent(from || '')}&to=${encodeURIComponent(to || '')}`,
          transcribe: false,
          playBeep: true,
          timeout: 5
        })
        response.say('No message recorded. Goodbye.')
        response.hangup()
        return res.type('text/xml').send(response.toString())
      }

      // No voicemail — just end
    }

    response.say('The person you are calling is unavailable. Goodbye.')
    response.hangup()
    res.type('text/xml').send(response.toString())
  } catch (error) {
    log('[Twilio] Dial status error:', error.message)
    const VR = new VoiceResponse()
    VR.hangup()
    res.type('text/xml').send(VR.toString())
  }
})

// Twilio Voicemail Recording Complete
app.post('/twilio/voicemail-complete', async (req, res) => {
  const VoiceResponse = require('twilio').twiml.VoiceResponse
  try {
    const { RecordingUrl, RecordingDuration, RecordingSid } = req.body || {}
    const { chatId, from, to } = req.query || {}
    log(`[Twilio] Voicemail recorded: ${RecordingSid} (${RecordingDuration}s) for chatId=${chatId}`)

    if (chatId && RecordingUrl) {
      const duration = parseInt(RecordingDuration || '0')
      const audioUrl = `${RecordingUrl}.mp3`

      // Send voicemail to Telegram
      bot?.sendMessage(chatId, `🎤 <b>New Voicemail</b>\nFrom: ${decodeURIComponent(from || 'unknown')}\nTo: ${decodeURIComponent(to || '')}\nDuration: ${duration}s`, { parse_mode: 'HTML' }).catch(() => {})
      bot?.sendAudio(chatId, audioUrl, { caption: `Voicemail from ${decodeURIComponent(from || 'unknown')} (${duration}s)` }).catch((e) => {
        // If audio send fails, send URL as message
        bot?.sendMessage(chatId, `🎤 Voicemail audio: ${audioUrl}`, { parse_mode: 'HTML' }).catch(() => {})
      })

      // Store voicemail record
      await db.collection('phoneLogs').insertOne({
        chatId: parseFloat(chatId),
        type: 'voicemail',
        provider: 'twilio',
        from: decodeURIComponent(from || ''),
        to: decodeURIComponent(to || ''),
        recordingUrl: audioUrl,
        recordingSid: RecordingSid,
        duration,
        timestamp: new Date().toISOString()
      })
    }

    const response = new VoiceResponse()
    response.say('Your message has been recorded. Goodbye.')
    response.hangup()
    res.type('text/xml').send(response.toString())
  } catch (error) {
    log('[Twilio] Voicemail complete error:', error.message)
    const VR = new VoiceResponse()
    VR.hangup()
    res.type('text/xml').send(VR.toString())
  }
})

// Twilio Recording Status Callback (for call recording feature)
app.post('/twilio/recording-status', async (req, res) => {
  try {
    const { RecordingSid, RecordingUrl, RecordingDuration, RecordingStatus, CallSid } = req.body || {}
    log(`[Twilio] Recording status: ${RecordingSid} — ${RecordingStatus} (${RecordingDuration}s)`)

    if (RecordingStatus === 'completed' && RecordingUrl) {
      const audioUrl = `${RecordingUrl}.mp3`
      const duration = parseInt(RecordingDuration || '0')

      // Store recording
      await db.collection('phoneLogs').insertOne({
        type: 'call_recording',
        provider: 'twilio',
        callSid: CallSid,
        recordingSid: RecordingSid,
        recordingUrl: audioUrl,
        duration,
        timestamp: new Date().toISOString()
      })
    }

    res.sendStatus(200)
  } catch (error) {
    log('[Twilio] Recording status error:', error.message)
    res.sendStatus(200)
  }
})

// Twilio SIP Voice Webhook (Outbound SIP calls)
app.post('/twilio/sip-voice', async (req, res) => {
  const VoiceResponse = require('twilio').twiml.VoiceResponse
  try {
    const { To, From, CallSid } = req.body || {}
    log(`📞 [Twilio] SIP voice: ${From} → ${To} (${CallSid})`)

    const response = new VoiceResponse()

    // Parse SIP URI to get destination/bridge ID
    // SIP format: sip:+1234567890@domain or sip:bridge_xyz@domain
    let destinationOrBridgeId = To
    if (To?.startsWith('sip:')) {
      destinationOrBridgeId = To.replace('sip:', '').split('@')[0]
    }

    // ━━━ BRIDGE CALL: Routed from Telnyx SIP for Twilio number outbound ━━━
    if (destinationOrBridgeId?.startsWith('bridge_')) {
      const bridgeId = destinationOrBridgeId
      const bridge = pendingBridges[bridgeId]

      if (!bridge) {
        log(`[Twilio] Bridge ${bridgeId} not found or expired`)
        response.say('Call routing session expired. Please try again.')
        response.hangup()
        return res.type('text/xml').send(response.toString())
      }

      log(`[Twilio] Bridge found: ${bridge.twilioNumber} → ${bridge.destination}`)

      // Clean up the pending bridge
      delete pendingBridges[bridgeId]

      // Place the outbound PSTN call through Twilio with proper caller ID
      const recordingEnabled = bridge.num?.features?.recording === true
      const dialOpts = {
        callerId: bridge.twilioNumber,
        timeout: 30,
        action: `${bridge.selfUrl}/twilio/voice-dial-status?chatId=${bridge.chatId}&from=${encodeURIComponent(bridge.destination)}&to=${encodeURIComponent(bridge.twilioNumber)}&type=sip_bridge`,
      }
      if (recordingEnabled) {
        dialOpts.record = 'record-from-answer-dual'
        dialOpts.recordingStatusCallback = `${bridge.selfUrl}/twilio/recording-status`
      }
      const dial = response.dial(dialOpts)
      dial.number(bridge.destination)

      log(`[Twilio] Bridge call: ${bridge.twilioNumber} → ${bridge.destination} (callerId=${bridge.twilioNumber})`)
      return res.type('text/xml').send(response.toString())
    }

    // ━━━ REGULAR SIP OUTBOUND: Direct Twilio SIP call (existing flow) ━━━
    let destinationNumber = destinationOrBridgeId

    // Find the SIP user by their From SIP URI
    let sipUsername = From
    if (From?.startsWith('sip:')) {
      sipUsername = From.replace('sip:', '').split('@')[0]
    }

    // Look up user by SIP username
    const allUsers = await db.collection('phoneNumbersOf').find({}).toArray()
    let owner = null, num = null
    for (const user of allUsers) {
      const numbers = user.val?.numbers || []
      const match = numbers.find(n => n.sipUsername === sipUsername && n.provider === 'twilio' && n.status === 'active')
      if (match) { owner = user._id; num = match; break }
    }

    if (!num || !owner) {
      response.say('SIP credentials not recognized.')
      response.hangup()
      return res.type('text/xml').send(response.toString())
    }

    // Wallet balance check — same rate as call forwarding
    const RATE = parseFloat(process.env.CALL_FORWARDING_RATE_MIN || '0.50')
    const chatId = owner
    const { usdBal } = await getBalance(walletOf, chatId)

    if (usdBal < RATE) {
      response.say('Insufficient wallet balance for outbound calls. Please top up.')
      response.hangup()
      bot?.sendMessage(chatId, `🚫 <b>SIP Call Blocked</b> — Wallet $${usdBal.toFixed(2)} (need $${RATE}/min).\nTop up via 👛 Wallet.`, { parse_mode: 'HTML' }).catch(() => {})
      return res.type('text/xml').send(response.toString())
    }

    // Place outbound call
    const recordingEnabled = num.features?.recording === true
    const dialOpts = { callerId: num.phoneNumber, timeout: 30, action: `${SELF_URL}/twilio/voice-dial-status?chatId=${chatId}&from=${encodeURIComponent(destinationNumber)}&to=${encodeURIComponent(num.phoneNumber)}&type=sip_outbound` }
    if (recordingEnabled) {
      dialOpts.record = 'record-from-answer-dual'
      dialOpts.recordingStatusCallback = `${SELF_URL}/twilio/recording-status`
    }
    const dial = response.dial(dialOpts)
    dial.number(destinationNumber)

    const estMinutes = Math.floor(usdBal / RATE)
    bot?.sendMessage(chatId, `📞 <b>SIP Outbound Call</b>\nFrom: ${num.phoneNumber}\nTo: ${destinationNumber}\nRate: $${RATE}/min (~${estMinutes} min available)`, { parse_mode: 'HTML' }).catch(() => {})

    res.type('text/xml').send(response.toString())
  } catch (error) {
    log('[Twilio] SIP voice error:', error.message)
    const VR = new VoiceResponse()
    VR.say('An error occurred.')
    VR.hangup()
    res.type('text/xml').send(VR.toString())
  }
})

// Twilio Voice Status Callback (call duration billing + no-answer safety net)
app.post('/twilio/voice-status', async (req, res) => {
  try {
    const { CallSid, CallDuration, CallStatus, To, From } = req.body || {}
    const duration = parseInt(CallDuration || '0')

    log(`[Twilio] Voice status: ${CallSid} — ${CallStatus} (${duration}s)`)

    if (CallStatus === 'completed' && duration > 0) {
      const minutes = Math.ceil(duration / 60)

      // Find owner and deduct from wallet with destination-based rate
      const allUsers = await db.collection('phoneNumbersOf').find({}).toArray()
      for (const user of allUsers) {
        const numbers = user.val?.numbers || []
        const match = numbers.find(n => (n.phoneNumber === To || n.phoneNumber === From) && n.provider === 'twilio')
        if (match) {
          const chatId = user._id
          // Determine destination for rate: the number that is NOT the user's number
          const destination = match.phoneNumber === To ? From : To
          const isUSCA = (destination || '').replace(/[^+\d]/g, '').startsWith('+1')
          const rate = isUSCA ? parseFloat(process.env.OVERAGE_RATE_MIN || '0.04') : parseFloat(process.env.CALL_FORWARDING_RATE_MIN || '0.50')
          const cost = minutes * rate
          await atomicIncrement(walletOf, chatId, 'usdOut', cost)
          // Increment minutes used
          match.minutesUsed = (match.minutesUsed || 0) + minutes
          await set(phoneNumbersOf, chatId, user.val)
          bot?.sendMessage(chatId, `📊 <b>Call Ended</b> — ${minutes} min — $${cost.toFixed(2)} deducted (${isUSCA ? 'US/CA' : 'Intl'} $${rate}/min)\nBalance updated.`, { parse_mode: 'HTML' }).catch(() => {})
          break
        }
      }
    } else if (CallStatus === 'no-answer' || CallStatus === 'busy' || CallStatus === 'failed' || CallStatus === 'canceled') {
      // Safety net: notify user when call didn't connect
      // (Primary no-answer handling is in /twilio/voice-dial-status, this catches edge cases)
      const reason = CallStatus === 'no-answer' ? 'No answer'
        : CallStatus === 'busy' ? 'Line busy'
        : CallStatus === 'failed' ? 'Call failed'
        : 'Cancelled'
      log(`[Twilio] Call not completed: ${CallSid} — ${reason} (${From} → ${To})`)

      // Try to find the owner and notify
      const allUsers = await db.collection('phoneNumbersOf').find({}).toArray()
      for (const user of allUsers) {
        const numbers = user.val?.numbers || []
        const match = numbers.find(n => (n.phoneNumber === To || n.phoneNumber === From) && n.provider === 'twilio')
        if (match) {
          const chatId = user._id
          const destination = match.phoneNumber === To ? From : To
          bot?.sendMessage(chatId, `❌ <b>Call Not Connected</b>\n📞 ${destination} — ${reason}`, { parse_mode: 'HTML' }).catch(() => {})
          break
        }
      }
    }
    res.sendStatus(200)
  } catch (error) {
    log('[Twilio] Voice status error:', error.message)
    res.sendStatus(200)
  }
})

// Twilio SMS Webhook
app.post('/twilio/sms-webhook', async (req, res) => {
  const MessagingResponse = require('twilio').twiml.MessagingResponse
  try {
    const { To, From, Body } = req.body || {}
    log(`💬 [Twilio] SMS: ${From} → ${To}: ${(Body || '').substring(0, 50)}`)

    // Find owner
    const allUsers = await db.collection('phoneNumbersOf').find({}).toArray()
    for (const user of allUsers) {
      const numbers = user.val?.numbers || []
      const match = numbers.find(n => n.phoneNumber === To && n.provider === 'twilio' && n.status === 'active')
      if (match) {
        const chatId = user._id
        const fwd = match.features?.smsForwarding
        if (fwd?.toTelegram !== false) {
          bot?.sendMessage(chatId, `💬 <b>SMS Received</b>\nFrom: ${From}\nTo: ${To}\n\n${Body || '(empty)'}`, { parse_mode: 'HTML' }).catch(() => {})
        }
        // Increment SMS usage
        match.smsUsed = (match.smsUsed || 0) + 1
        await set(phoneNumbersOf, chatId, user.val)
        break
      }
    }

    const response = new MessagingResponse()
    res.type('text/xml').send(response.toString())
  } catch (error) {
    log('[Twilio] SMS webhook error:', error.message)
    res.sendStatus(200)
  }
})

// Telegram Webhook Endpoint
app.post('/telegram/webhook', (req, res) => {
  try {
    log('📨 Telegram webhook received')
    bot.processUpdate(req.body)
    res.sendStatus(200)
  } catch (error) {
    log('❌ Webhook processing error:', error.message)
    res.sendStatus(500)
  }
})

// Setup Telegram webhook
const setupTelegramWebhook = async () => {
  if (TELEGRAM_BOT_ON !== 'true') {
    log('⏭️  Telegram bot disabled, skipping webhook setup')
    return
  }

  try {
    const webhookUrl = `${SELF_URL}/telegram/webhook`
    
    // Delete any existing webhook first
    await bot.deleteWebHook()
    log('🗑️  Deleted old webhook')
    
    // Set the new webhook with all required update types
    await bot.setWebHook(webhookUrl, {
      allowed_updates: JSON.stringify(['message', 'callback_query', 'my_chat_member'])
    })
    log('✅ Telegram webhook set successfully')
    log(`📡 Webhook URL: ${webhookUrl}`)
    
    // Verify webhook was set
    const webhookInfo = await bot.getWebHookInfo()
    log('📊 Webhook info:', JSON.stringify(webhookInfo, null, 2))
    
    if (webhookInfo.url === webhookUrl) {
      log('✅ Webhook verification passed')
    } else {
      log('⚠️  Webhook URL mismatch!')
      log('Expected:', webhookUrl)
      log('Got:', webhookInfo.url)
    }
  } catch (error) {
    log('❌ Failed to set up Telegram webhook:', error.message)
    log('Error details:', error)
  }
}

const startServer = async () => {
  // Server already started early for health checks
  // Just mark app as ready and set up webhook
  appReady = true
  log(`✅ Main application ready! Server already listening on port ${PORT}`)
  
  // Set up Telegram webhook
  await setupTelegramWebhook()
}

const tryConnectReseller = async () => {
  try {
    const working = await crAutoWhitelist.testConnection()
    if (working) {
      connect_reseller_working = true
      log('Connect Reseller API is working')
    } else {
      connect_reseller_working = false
      // Auto-whitelist handles notification + retry
      if (!ip_whitelist_message_sent) {
        ip_whitelist_message_sent = true
        crAutoWhitelist.autoWhitelist({
          bot,
          adminChatId: TELEGRAM_ADMIN_CHAT_ID,
          devChatId: TELEGRAM_DEV_CHAT_ID,
        }).then(result => {
          if (result.success) connect_reseller_working = true
        })
      }
    }
  } catch (error) {
    connect_reseller_working = false
    log('Connect Reseller check error:', error?.message)
  }
}

// Run auto-whitelist on startup (handles IP detection, testing, notification, and retry)
crAutoWhitelist.autoWhitelist({
  bot,
  adminChatId: TELEGRAM_ADMIN_CHAT_ID,
  devChatId: TELEGRAM_DEV_CHAT_ID,
}).then(result => {
  connect_reseller_working = result.success
  if (result.success) {
    log('[CR-Whitelist] Startup check passed — API working')
  } else {
    log(`[CR-Whitelist] Startup check: IP ${result.ip} needs whitelisting — auto-retrying`)
  }
})

// Start Express server after all functions are defined
if (REST_APIS_ON === 'true') startServer()
