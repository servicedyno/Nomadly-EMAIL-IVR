// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Cloud Phone Config — Texts, keyboards, state actions
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const PHONE_STARTER_PRICE = parseFloat(process.env.PHONE_STARTER_PRICE || '5')
const PHONE_PRO_PRICE = parseFloat(process.env.PHONE_PRO_PRICE || '15')
const PHONE_BUSINESS_PRICE = parseFloat(process.env.PHONE_BUSINESS_PRICE || '30')
const SIP_DOMAIN = process.env.SIP_DOMAIN || 'sip.speechcue.com'
const CALL_PAGE_URL = process.env.CALL_PAGE_URL || 'https://speechcue.com/call'

// ── Configurable plan minutes & SMS from .env ──
const STARTER_MINUTES = parseInt(process.env.PHONE_STARTER_MINUTES || '100', 10)
const STARTER_SMS = parseInt(process.env.PHONE_STARTER_SMS || '50', 10)
const PRO_MINUTES = parseInt(process.env.PHONE_PRO_MINUTES || '500', 10)
const PRO_SMS = parseInt(process.env.PHONE_PRO_SMS || '200', 10)
const BUSINESS_MINUTES = process.env.PHONE_BUSINESS_MINUTES === 'Unlimited' || !process.env.PHONE_BUSINESS_MINUTES ? 'Unlimited' : parseInt(process.env.PHONE_BUSINESS_MINUTES, 10)
const BUSINESS_SMS = parseInt(process.env.PHONE_BUSINESS_SMS || '1000', 10)

// All users always connect to sip.speechcue.com regardless of provider
// Telnyx: DNS A record resolves to Telnyx SIP IP (192.76.120.10)
// Twilio: Dual credentials created on both Telnyx + Twilio so sip.speechcue.com works
function getSipDomainForNumber() {
  return SIP_DOMAIN
}

// ── Plan availability (admin toggle via .env) ──
const PHONE_STARTER_ON = (process.env.PHONE_STARTER_ON || 'true').toLowerCase() === 'true'
const PHONE_PRO_ON = (process.env.PHONE_PRO_ON || 'true').toLowerCase() === 'true'
const PHONE_BUSINESS_ON = (process.env.PHONE_BUSINESS_ON || 'true').toLowerCase() === 'true'

const planAvailability = {
  starter: PHONE_STARTER_ON,
  pro: PHONE_PRO_ON,
  business: PHONE_BUSINESS_ON,
}

const isPlanAvailable = (planKey) => planAvailability[planKey] !== false

const comingSoonFeatures = {
  starter: [
    `${STARTER_MINUTES} minutes/mo + ${STARTER_SMS} SMS`,
    'Call forwarding to any number',
    'SMS forwarded to Telegram',
    'Dedicated local phone number',
  ],
  pro: [
    `${PRO_MINUTES} minutes/mo + ${PRO_SMS} SMS`,
    'Voicemail with custom greetings',
    'SIP credentials for softphones',
    'SMS to Telegram & Email',
    'Webhook integrations',
  ],
  business: [
    `${BUSINESS_MINUTES === 'Unlimited' ? 'Unlimited' : BUSINESS_MINUTES} minutes + ${BUSINESS_SMS} SMS`,
    'IVR / Auto-attendant with AI voice',
    'Call recording & analytics',
    'All Pro features included',
    'Priority support',
  ],
}

const comingSoonText = (planKey) => {
  const plan = plans[planKey] || {}
  const features = comingSoonFeatures[planKey] || []
  const icon = planKey === 'starter' ? '💡' : planKey === 'pro' ? '⭐' : '👑'
  return `${icon} <b>${plan.name || planKey} Plan — Coming Soon!</b>

🚀 We're loading this plan with powerful features:

${features.map(f => `  ✦ ${f}`).join('\n')}

📢 Stay tuned — this plan will be available very soon.
Use /start to check back later!`
}

// ── Overage rates (pay-per-use above plan limits, from .env) ──
const OVERAGE_RATE_SMS = parseFloat(process.env.OVERAGE_RATE_SMS || '0.02')
const OVERAGE_RATE_MIN = parseFloat(process.env.OVERAGE_RATE_MIN || '0.03')
const CALL_FORWARDING_RATE_MIN = parseFloat(process.env.CALL_FORWARDING_RATE_MIN || '0.50')

// ── Premium/high-cost prefixes that are blocked for forwarding ──
// These prefixes have extremely high termination rates ($1+/min) on Telnyx
const BLOCKED_FORWARDING_PREFIXES = [
  // Premium rate service numbers
  '900', '901', '906', '908', '909',   // US/International premium
  // Satellite / VSAT
  '870', '871', '872', '873', '874',   // Inmarsat
  '881', '882', '883',                  // Iridium / Globalstar / other satellite
  // Premium Portuguese prefixes (up to $3.62/min on Telnyx)
  '35176', '351760', '351761',
  // Cuban mobile (very high rates)
  '535',
  // Premium Spanish prefixes
  '3480', '3490',
  // Tunisian premium
  '21680', '21681', '21682',
  // Russian premium
  '7809', '7803',
  // African premium/satellite
  '88216',
  // Shared cost / premium across countries
  '878', '879',
]

function isBlockedPrefix(phoneNumber) {
  const clean = phoneNumber.replace(/[^0-9]/g, '')
  return BLOCKED_FORWARDING_PREFIXES.some(prefix => clean.startsWith(prefix))
}

// ── Button labels ──
const btn = {
  cloudPhone: '📞☁️ Cloud Phone — Speechcue',
  buyPhoneNumber: '🛒 Buy Cloud Phone Plans',
  myNumbers: '📱 My Numbers',
  sipSettings: '📖 SIP Setup Guide',
  usageBilling: '📊 Usage & Billing',

  // Number types
  localNumber: '📍 Local Number',
  tollFreeNumber: '🆓 Toll-Free Number',
  mobileNumber: '📱 Mobile Number',
  nationalNumber: '🌐 National Number',

  // Plans
  starterPlan: PHONE_STARTER_ON ? `💡 Starter — $${PHONE_STARTER_PRICE}/mo` : `💡 Starter — Coming Soon 🔜`,
  proPlan: PHONE_PRO_ON ? `⭐ Pro — $${PHONE_PRO_PRICE}/mo` : `⭐ Pro — Coming Soon 🔜`,
  businessPlan: PHONE_BUSINESS_ON ? `👑 Business — $${PHONE_BUSINESS_PRICE}/mo` : `👑 Business — Coming Soon 🔜`,

  // Management
  callForwarding: '📞 Call Forwarding',
  smsSettings: '📩 SMS Settings',
  smsInbox: '📨 SMS Inbox',
  voicemail: '🎙️ Voicemail',
  sipCredentials: '🔑 SIP Credentials',
  callRecording: '🔴 Call Recording',
  ivrAutoAttendant: '🤖 IVR / Auto-attendant',
  callSmsLogs: '📊 Call & SMS Logs',
  renewChangePlan: '🔄 Renew / Change Plan',
  releaseNumber: '🗑️ Delete Number',

  // Forwarding modes
  alwaysForward: '📞 Always Forward',
  forwardBusy: '📵 Forward When Busy',
  forwardNoAnswer: '⏰ Forward If No Answer',
  disableForwarding: '🚫 Disable Forwarding',
  holdMusicOn: '🎵 Hold Music: ON',
  holdMusicOff: '🎵 Hold Music: OFF',

  // SMS
  smsToTelegram: '📲 SMS to Telegram',
  smsToEmail: '📧 SMS to Email',
  smsWebhook: '🔗 Webhook URL',

  // Voicemail
  enableVoicemail: '✅ Enable Voicemail',
  disableVoicemail: '🚫 Disable Voicemail',
  vmGreeting: '🔊 Greeting',
  vmCustomGreeting: '🎤 Custom Greeting (Audio)',
  vmDefaultGreeting: '🔄 Default Greeting',
  vmToTelegram: '📲 Send to Telegram',
  vmToEmail: '📧 Send to Email',
  vmRingTime: '⏰ Ring Time',

  // SIP
  revealPassword: '👁️ Reveal Password',
  resetPassword: '🔄 Reset Password',
  softphoneGuide: '📖 SIP Setup Guide',

  // Renew
  renewNow: '🔄 Renew Now',
  changePlan: '📦 Change Plan',
  autoRenew: '🔁 Auto-Renew',

  // Misc
  showMore: '🔄 Show More Numbers',
  searchByArea: '🔍 Search by Area Code',
  moreCountries: '🌍 More Countries',
  applyCoupon: '🎟️ Apply Coupon',
  proceedPayment: '✅ Proceed to Payment',
  buyAnother: '🛒 Buy Another Number',
  confirm: '✅ Confirm',
  yesRelease: '⚠️ Yes, Permanently Delete',
  noKeep: '↩️ No, Keep It',
  yesReset: 'Yes, Reset',

  // IVR
  enableIvr: '✅ Enable IVR',
  disableIvr: '🚫 Disable IVR',
  ivrGreeting: '🎤 Set Greeting',
  ivrAddOption: '➕ Add Menu Option',
  ivrRemoveOption: '➖ Remove Option',
  ivrViewOptions: '📋 View Menu Options',
  ivrAnalytics: '📊 IVR Analytics',

  // Recording
  enableRecording: '✅ Enable Recording',
  disableRecording: '🚫 Disable Recording',

  // SMS Inbox
  inboxNewerPage: '◀️ Newer',
  inboxOlderPage: '▶️ Older',
  inboxRefresh: '🔄 Refresh',

  // IVR Outbound Call
  ivrOutboundCall: '📢 IVR Outbound Call',
  ivrOutboundBack: '↩️ Back',

  // Bulk Call Campaign
  bulkCallCampaign: '📞 Bulk Call Campaign',
  audioLibrary: '🎵 Audio Library',

  back: 'Back',
  cancel: 'Cancel',
}

// ── Countries with flag (compliance-free only — no additional registration needed) ──
const countries = [
  { code: 'US', name: '🇺🇸 United States', provider: 'telnyx' },
  { code: 'CA', name: '🇨🇦 Canada', provider: 'telnyx' },
]

// Twilio countries (verified via live API query — instant activation, some need address)
const twilioCountries = [
  { code: 'GB', name: '🇬🇧 United Kingdom', provider: 'twilio', types: ['mobile'] },
  { code: 'IE', name: '🇮🇪 Ireland', provider: 'twilio', types: ['local'] },
  { code: 'IL', name: '🇮🇱 Israel', provider: 'twilio', types: ['local', 'mobile'] },
  { code: 'AU', name: '🇦🇺 Australia', provider: 'twilio', types: ['toll_free', 'mobile'] },
  { code: 'NZ', name: '🇳🇿 New Zealand', provider: 'twilio', types: ['local', 'toll_free'] },
  { code: 'HK', name: '🇭🇰 Hong Kong', provider: 'twilio', types: ['toll_free', 'mobile'] },
  { code: 'NL', name: '🇳🇱 Netherlands', provider: 'twilio', types: ['mobile'] },
  { code: 'IT', name: '🇮🇹 Italy', provider: 'twilio', types: ['toll_free'] },
]

// Combined list for user selection
const allCountries = [...countries, ...twilioCountries]

// Additional countries (shown after "More Countries" button)
const moreCountries = [
  { code: 'PR', name: '🇵🇷 Puerto Rico', provider: 'twilio', types: ['local'] },
  { code: 'TN', name: '🇹🇳 Tunisia', provider: 'twilio', types: ['local'] },
  { code: 'FI', name: '🇫🇮 Finland', provider: 'twilio', types: ['toll_free', 'mobile'] },
  { code: 'MX', name: '🇲🇽 Mexico', provider: 'twilio', types: ['toll_free'] },
  { code: 'CO', name: '🇨🇴 Colombia', provider: 'twilio', types: ['toll_free'] },
  { code: 'BG', name: '🇧🇬 Bulgaria', provider: 'twilio', types: ['toll_free'] },
  { code: 'CZ', name: '🇨🇿 Czech Republic', provider: 'twilio', types: ['local', 'toll_free'] },
  { code: 'EE', name: '🇪🇪 Estonia', provider: 'twilio', types: ['local', 'toll_free', 'mobile'] },
  { code: 'ID', name: '🇮🇩 Indonesia', provider: 'twilio', types: ['toll_free'] },
  { code: 'KE', name: '🇰🇪 Kenya', provider: 'twilio', types: ['local'] },
  { code: 'MY', name: '🇲🇾 Malaysia', provider: 'twilio', types: ['local'] },
  { code: 'PL', name: '🇵🇱 Poland', provider: 'twilio', types: ['mobile'] },
  { code: 'RO', name: '🇷🇴 Romania', provider: 'twilio', types: ['toll_free'] },
  { code: 'SK', name: '🇸🇰 Slovakia', provider: 'twilio', types: ['toll_free'] },
  { code: 'ZA', name: '🇿🇦 South Africa', provider: 'twilio', types: ['local'] },
  { code: 'TH', name: '🇹🇭 Thailand', provider: 'twilio', types: ['toll_free', 'mobile'] },
]

// US popular area codes
const usAreaCodes = [
  { code: '212', city: 'New York' },
  { code: '310', city: 'Los Angeles' },
  { code: '312', city: 'Chicago' },
  { code: '305', city: 'Miami' },
  { code: '713', city: 'Houston' },
  { code: '214', city: 'Dallas' },
  { code: '415', city: 'San Francisco' },
  { code: '206', city: 'Seattle' },
]

const countryByName = {}
;[...allCountries, ...moreCountries].forEach(c => { countryByName[c.name] = c.code })

const areaByLabel = {}
usAreaCodes.forEach(a => { areaByLabel[`${a.city} (${a.code})`] = a.code })

// ── Plans ──
const plans = {
  starter: { name: 'Starter', price: PHONE_STARTER_PRICE, minutes: STARTER_MINUTES, sms: STARTER_SMS, features: ['Call forwarding', 'SMS to Telegram'] },
  pro: { name: 'Pro', price: PHONE_PRO_PRICE, minutes: PRO_MINUTES, sms: PRO_SMS, features: ['Forwarding', 'Voicemail', 'SIP access', 'SMS to Telegram & Email'] },
  business: { name: 'Business', price: PHONE_BUSINESS_PRICE, minutes: BUSINESS_MINUTES, sms: BUSINESS_SMS, features: ['All Pro features', 'Call recording', 'IVR / Auto-attendant'] },
}

// Feature gating per plan — which features each plan unlocks
const planFeatureAccess = {
  starter: {
    callForwarding: true,
    smsToTelegram: true,
    smsToEmail: false,
    smsWebhook: false,
    voicemail: false,
    sipCredentials: false,
    callRecording: false,
    ivr: false,
    ivrOutbound: false,
    bulkCall: false,
  },
  pro: {
    callForwarding: true,
    smsToTelegram: true,
    smsToEmail: true,
    smsWebhook: true,
    voicemail: true,
    sipCredentials: true,
    callRecording: false,
    ivr: false,
    ivrOutbound: true,
    bulkCall: true,
  },
  business: {
    callForwarding: true,
    smsToTelegram: true,
    smsToEmail: true,
    smsWebhook: true,
    voicemail: true,
    sipCredentials: true,
    callRecording: true,
    ivr: true,
    ivrOutbound: true,
    bulkCall: true,
  },
}

const canAccessFeature = (planKey, feature) => {
  return planFeatureAccess[planKey]?.[feature] === true
}

const upgradeMessage = (feature, currentPlan) => {
  const needed = (feature === 'callRecording' || feature === 'ivr') ? 'Business'
    : (feature === 'ivrOutbound' || feature === 'bulkCall') ? 'Pro'
    : 'Pro'
  const featureNames = {
    voicemail: 'Voicemail',
    sipCredentials: 'SIP Credentials',
    smsToEmail: 'SMS to Email',
    smsWebhook: 'SMS Webhook',
    callRecording: 'Call Recording',
    ivr: 'IVR / Auto-attendant',
    ivrOutbound: 'IVR Outbound Call',
    bulkCall: 'Bulk Call Campaign',
  }
  const featureName = featureNames[feature] || feature
  return `🔒 <b>${featureName}</b> requires the <b>${needed}</b> plan or higher.\n\nYour current plan: <b>${currentPlan || 'Starter'}</b>\n\nUpgrade via 🔄 Renew / Change Plan.`
}

const planByButton = {}
planByButton[btn.starterPlan] = 'starter'
planByButton[btn.proPlan] = 'pro'
planByButton[btn.businessPlan] = 'business'

// ── Text messages ──
const txt = {
  hubWelcome: `📞 <b>CloudPhone</b> <i>by Speechcue</i>

Get a virtual number in 30+ countries — in under 2 minutes.

📞 Forward calls to your real phone
💬 Receive SMS directly in Telegram
🌐 Make & receive calls in your browser — no app needed
🤖 Set up IVR auto-attendant
🔗 Connect via SIP softphone

Plans from <b>$${PHONE_STARTER_PRICE}/mo</b> with ${plans.starter.minutes} min + ${plans.starter.sms} SMS included.

Select an option:`,

  selectCountry: '📍 Select country for your new phone number:',

  selectType: (country) => `📱 Select number type for <b>${country}</b>:

<b>📍 Local</b> — Geographic number with area code
<b>🆓 Toll-Free</b> — 800/888/877 prefix, nationwide`,

  selectArea: '🏙️ Select area or enter your preferred area code:',
  enterAreaCode: 'Enter area code (e.g. 415):',

  searching: '🔍 Searching available numbers...',

  noSearchResults: '❌ No numbers available for this criteria. Try a different area or country.',

  showNumbers: (location, numbers) => {
    let text = `📞 Available numbers in <b>${location}</b>:\n\n`
    numbers.forEach((n, i) => {
      const caps = n._capabilities || n.capabilities || {}
      const voice = caps.voice === true || caps.voice === 'True'
      const sms = caps.sms === true || caps.sms === 'True'
      const fax = caps.fax === true || caps.fax === 'True'
      let capLabel = ''
      if (voice) capLabel += '📞'
      if (sms) capLabel += '💬'
      if (fax) capLabel += '📠'
      text += `${i + 1}️⃣  ${formatPhone(n.phone_number)} ${capLabel}\n`
    })
    text += '\n📞 = Voice  💬 = SMS  📠 = Fax\nTap a number to select it.'
    return text
  },

  selectPlan: (number) => {
    let text = `✅ Selected: <b>${formatPhone(number)}</b>\n\n📋 Choose your plan:\n\n`
    if (PHONE_STARTER_ON) {
      text += `<b>💡 Starter — $${PHONE_STARTER_PRICE}/mo</b>\n${plans.starter.minutes} min · ${plans.starter.sms} SMS · ${plans.starter.features.join(' · ')}\n\n`
    }
    if (PHONE_PRO_ON) {
      text += `<b>⭐ Pro — $${PHONE_PRO_PRICE}/mo</b>\n${plans.pro.minutes} min · ${plans.pro.sms} SMS · ${plans.pro.features.join(' · ')}\n\n`
    }
    if (PHONE_BUSINESS_ON) {
      text += `<b>👑 Business — $${PHONE_BUSINESS_PRICE}/mo</b>\n${plans.business.minutes} min · ${plans.business.sms} SMS · ${plans.business.features.join(' · ')}\n\n`
    }
    text += `<i>Outbound & Forwarding: $${CALL_FORWARDING_RATE_MIN}/min from wallet</i>`
    return text
  },

  orderSummary: (number, country, plan, price) => `📋 <b>Order Summary</b>

📞 ${formatPhone(number)} · ${country}
📦 ${plan.name} — $${price}/mo
📩 ${plan.sms} SMS · 📞 ${plan.minutes} min · 📲 Outbound & Fwd $${CALL_FORWARDING_RATE_MIN}/min
⚡ ${plan.features.join(', ')}

💰 Total: <b>$${price}</b> (first month)`,

  paymentPrompt: (price) => `Price: <b>$${price}</b>. Choose payment method:`,

  activated: (number, plan, price, sipUser, sipDomain, expiry) => `🎉 <b>Your Cloud Phone is Active!</b>

📞 Number: ${formatPhone(number)}
📦 Plan: ${plan} ($${price}/mo)
📅 Renewal: ${expiry}

━━━ <b>SIP Credentials</b> ━━━
🌐 Server: ${sipDomain}
👤 Username: ${sipUser}
🔑 Password: ●●●●●●●● (use 🔑 SIP Credentials to reveal)
📡 Port: 5060 (UDP/TCP) | 5061 (TLS)

━━━ <b>Quick Setup</b> ━━━
• Browser: Make & receive calls at <a href="${CALL_PAGE_URL}">${CALL_PAGE_URL.replace('https://', '')}</a> — no sign-up needed
• Softphone: Download Zoiper/Ooma, enter SIP credentials
• SMS: Inbound SMS forwarded to this chat automatically
• Forwarding: Set up via 📱 My Numbers → Call Forwarding`,

  noNumbers: '📱 You don\'t have any phone numbers yet.\n\nTap below to get your first virtual number.',

  myNumbersList: (numbers) => {
    let text = '📱 <b>Your Cloud Phone Numbers:</b>\n\n'
    numbers.forEach((n, i) => {
      const status = n.status === 'active' ? '✅ Active' : n.status === 'suspended' ? '⚠️ Suspended' : '🗑️ Deleted'
      text += `${i + 1}️⃣  ${formatPhone(n.phoneNumber)}  ${status}\n`
      text += `    ${n.plan.charAt(0).toUpperCase() + n.plan.slice(1)} Plan · Renews ${shortDate(n.expiresAt)}\n\n`
    })
    return text
  },

  manageNumber: (n) => {
    const plan = plans[n.plan]
    const minLimit = plan?.minutes === 'Unlimited' ? 'Unlimited' : (plan?.minutes || 0)
    const smsLimit = plan?.sms || 0
    const minUsed = n.minutesUsed || 0
    const smsUsed = n.smsUsed || 0
    const minDisplay = minLimit === 'Unlimited' ? `${minUsed} (Unlimited)` : `${minUsed} / ${minLimit}`
    const smsDisplay = `${smsUsed} / ${smsLimit}`
    const minWarning = minLimit !== 'Unlimited' && minUsed >= minLimit ? `\n💰 <b>Overage active</b> — $${OVERAGE_RATE_MIN}/min from wallet` : ''
    const smsWarning = smsUsed >= smsLimit ? `\n💰 <b>Overage active</b> — $${OVERAGE_RATE_SMS}/SMS from wallet` : ''

    // Dynamic capabilities
    const hasSms = n.capabilities?.sms !== false && n.features?.sms !== false
    const hasFax = n.capabilities?.fax === true
    const hasVoice = n.capabilities?.voice !== false

    let text = `⚙️ Managing: <b>${formatPhone(n.phoneNumber)}</b>\n\nStatus: ${n.status === 'active' ? '✅ Active' : '⚠️ ' + n.status}\nPlan: ${n.plan.charAt(0).toUpperCase() + n.plan.slice(1)} ($${n.planPrice}/mo)`
    if (hasVoice) text += `\n📞 Inbound Minutes: ${minDisplay}${minWarning}`
    if (hasSms) text += `\n📩 Inbound SMS: ${smsDisplay} (receive only)${smsWarning}`
    if (hasFax) text += `\n📠 Fax: Included — inbound faxes forwarded to Telegram`

    // Capabilities badge
    const caps = []
    if (hasVoice) caps.push('Voice')
    if (hasSms) caps.push('SMS')
    if (hasFax) caps.push('Fax')
    text += `\n📋 Capabilities: ${caps.join(' · ')}`

    // Browser call hint
    if (hasVoice) text += `\n\n🌐 <a href="${CALL_PAGE_URL}">Make & receive calls in browser</a>`

    return text
  },

  // Call Forwarding
  forwardingStatus: (number, config, walletBal) => {
    const status = config?.enabled ? '✅ Active' : '❌ Off'
    let text = `📞 <b>Call Forwarding</b> — ${formatPhone(number)}\n\nStatus: ${status}`
    if (config?.enabled) {
      text += `\n📲 ${formatPhone(config.forwardTo)} · ${config.mode}`
      text += `\n🎵 Hold Music: ${config.holdMusic ? 'ON' : 'OFF'}`
    }
    const rate = config?.forwardTo && config.forwardTo.startsWith('+1') ? OVERAGE_RATE_MIN : CALL_FORWARDING_RATE_MIN
    text += `\n💰 Uses plan minutes, then $${rate}/min overage`
    if (walletBal !== undefined) {
      text += ` · 💳 $${walletBal.toFixed(2)}`
    }
    return text
  },
  enterForwardNumber: (walletBal) => {
    let text = `Enter forwarding number with country code (e.g. +14155551234)\n💰 Rate: <b>$${CALL_FORWARDING_RATE_MIN}/min</b>`
    if (walletBal !== undefined) {
      text += ` · 💳 $${walletBal.toFixed(2)}`
      if (walletBal < CALL_FORWARDING_RATE_MIN) text += `\n⚠️ Top up <b>$25</b> via 👛 Wallet first.`
    }
    return text
  },
  forwardingUpdated: (number, forwardTo, mode, walletBal) => {
    let text = `✅ <b>Forwarding Active</b>\n\n📞 ${formatPhone(number)} → ${formatPhone(forwardTo)}\n📋 ${mode} · $${CALL_FORWARDING_RATE_MIN}/min`
    if (walletBal !== undefined) {
      const estMin = Math.floor(walletBal / CALL_FORWARDING_RATE_MIN)
      text += `\n💳 $${walletBal.toFixed(2)} (~${estMin} min)`
      if (walletBal < 25) text += `\n💡 Top up to <b>$25</b> for uninterrupted forwarding.`
    }
    return text
  },
  forwardingBlocked: (number) => `🚫 <b>Blocked</b> — ${formatPhone(number)} is a premium destination.\nTap 💬 <b>Get Support</b> to request activation.`,
  forwardingNotRoutable: (number) => `⚠️ ${formatPhone(number)} is not routable. Check the number or tap 💬 <b>Get Support</b>.`,
  forwardingInsufficientBalance: (walletBal) => `🚫 <b>Insufficient Balance</b>\n\n💳 $${(walletBal || 0).toFixed(2)} · Need $${CALL_FORWARDING_RATE_MIN}/min\n\n👉 Top up <b>$25</b> via 👛 Wallet to activate forwarding.`,
  forwardingDisabled: (number) => `✅ Forwarding disabled for ${formatPhone(number)}.`,

  // SMS Settings
  smsSettingsMenu: (number, config, plan) => {
    const tg = config?.toTelegram ? '✅ ON' : '❌ OFF'
    const em = config?.toEmail ? '✅ ' + config.toEmail : '❌ OFF'
    const wh = config?.webhookUrl ? '✅ Set' : '❌ Not Set'
    const canEmail = canAccessFeature(plan, 'smsToEmail')
    const canWebhook = canAccessFeature(plan, 'smsWebhook')
    const planName = plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : 'Unknown'
    return `📩 <b>Inbound SMS Settings</b> for <b>${formatPhone(number)}</b>

📌 SMS is <b>inbound only</b> — you receive SMS to this number but cannot send outbound.

📲 Forward to Telegram: ${tg}
📧 Forward to Email: ${canEmail ? em : `🔒 Requires Pro plan or higher (current: ${planName})`}
🔗 Webhook URL: ${canWebhook ? wh : `🔒 Requires Pro plan or higher (current: ${planName})`}`
  },
  smsToggled: (channel, state) => `${channel} is now ${state ? '✅ ON' : '❌ OFF'}`,

  // Fax Settings
  faxSettingsMenu: (number, config, provider) => {
    const tg = config?.toTelegram !== false ? '✅ ON' : '❌ OFF'
    if (provider === 'twilio') {
      return `📠 <b>Fax Settings</b> for <b>${formatPhone(number)}</b>\n\n⚠️ <b>Fax is not available for Twilio numbers.</b>\nTwilio discontinued Programmable Fax. Inbound faxes on this number cannot be received.\n\nTo use fax, purchase a Telnyx number with fax capability.`
    }
    return `📠 <b>Fax Settings</b> for <b>${formatPhone(number)}</b>\n\nInbound faxes are received as PDF and forwarded to this Telegram chat.\n\n📲 Forward to Telegram: ${tg}`
  },
  faxToggled: (state) => `📠 Fax to Telegram is now ${state ? '✅ ON' : '❌ OFF'}`,
  faxReceived: (from, to, pages) => `📠 <b>Fax Received</b>\nFrom: ${from}\nTo: ${formatPhone(to)}${pages ? `\nPages: ${pages}` : ''}`,
  faxFailed: (from, to, reason) => `📠 <b>Fax Failed</b>\nFrom: ${from}\nTo: ${formatPhone(to)}\nReason: ${reason || 'Unknown'}`,
  enterEmail: 'Enter the email address to forward SMS messages to:',
  emailSet: (email) => `✅ SMS to Email enabled!\nAll inbound SMS will also be sent to <b>${email}</b>.`,
  enterWebhook: 'Enter your webhook URL (inbound SMS will be POSTed as JSON):',
  webhookSet: (url) => `✅ Webhook URL configured!\nSMS will be POSTed to: ${url}`,

  // Voicemail
  voicemailMenu: (number, config) => {
    if (!config?.enabled) {
      return `🎙️ Voicemail for <b>${formatPhone(number)}</b>\n\nStatus: ❌ Disabled\n\nWhen enabled, unanswered calls will hear a greeting and callers can leave a voice message.`
    }
    const tg = config.forwardToTelegram ? '✅ ON' : '❌ OFF'
    const em = config.forwardToEmail ? '✅ ' + config.forwardToEmail : '❌ OFF'
    let greetInfo = ''
    if (config.greetingType === 'custom' && config.customAudioGreetingUrl) {
      greetInfo = '🎤 Custom Audio'
    } else if (config.greetingType === 'custom' && config.customGreetingText) {
      greetInfo = `📝 Custom: "${config.customGreetingText}"`
    } else {
      greetInfo = '🔊 Default: "You have reached ' + formatPhone(number) + '. Please leave a message after the tone."'
    }
    return `🎙️ Voicemail for <b>${formatPhone(number)}</b>\n\nStatus: ✅ Enabled\n🎤 Greeting: ${greetInfo}\n\n📲 Send to Telegram: ${tg}\n📧 Send to Email: ${em}\n⏰ Ring Time: ${config.ringTimeout || 25}s`
  },
  voicemailEnabled: (number) => `✅ Voicemail enabled for ${formatPhone(number)}!\nRecordings will be sent to this Telegram chat.`,
  voicemailDisabled: (number) => `✅ Voicemail disabled for ${formatPhone(number)}.`,

  vmGreetingMenu: (number, vm) => {
    let current = ''
    if (vm?.greetingType === 'custom' && vm?.customAudioGreetingUrl) {
      current = '🎤 Custom Audio\n📎 Audio file uploaded'
    } else if (vm?.greetingType === 'custom' && vm?.customGreetingText) {
      current = `📝 Custom Text: "${vm.customGreetingText}"`
    } else {
      current = `🔊 Default: "You have reached ${formatPhone(number)}. Please leave a message after the tone."`
    }
    return `🔊 <b>Voicemail Greeting</b> for <b>${formatPhone(number)}</b>\n\nCurrent: ${current}\n\nChoose an option below:`
  },
  vmSendAudioPrompt: '🎤 <b>Custom Audio Greeting</b>\n\nSend a voice message or audio file to use as your voicemail greeting.\n\nCallers will hear this audio when they reach your voicemail.\n\n<i>Tip: Record a professional greeting like "Hi, you\'ve reached [name]. I can\'t answer right now. Please leave a message after the tone."</i>',
  vmAudioSaved: '✅ Custom audio greeting saved! Callers will now hear your uploaded greeting.',
  vmDefaultRestored: '✅ Voicemail greeting reset to default text-to-speech.',
  vmTextGreetingPrompt: 'Enter a custom greeting text (will be read aloud by text-to-speech):',
  vmTextGreetingSet: (text) => `✅ Custom text greeting saved!\n\n"${text}"`,

  // SIP
  sipCredentialsMsg: (number, username, domain) => `🔑 SIP Credentials for <b>${formatPhone(number)}</b>

🌐 SIP Server: ${domain}
👤 Username: <code>${username}</code>
🔑 Password: ●●●●●●●●
📡 Ports: 5060 (UDP/TCP) · 5061 (TLS)
🎵 Codecs: G.711μ, G.711a, Opus`,

  sipRevealed: (password) => `🔑 Password: <code>${password}</code>\n\n⚠️ Save this now — this message will be deleted in 30 seconds.`,
  sipReset: (password) => `✅ SIP password has been reset!\n\n🔑 New Password: <code>${password}</code>\n\n⚠️ Save this now. Update this password on all your SIP devices.`,
  softphoneGuide: (domain) => `📖 <b>SIP Setup Guide</b>

<b>🌐 Browser (Easiest)</b>
Make & receive calls directly in your browser:
<a href="${CALL_PAGE_URL}">${CALL_PAGE_URL.replace('https://', '')}</a>
No sign-up or app install needed — just enter your SIP credentials.

<b>Zoiper</b> (iOS / Android / Desktop)
1. Download from App Store or Google Play
2. Add Account → SIP
3. Enter your SIP credentials (from 🔑 SIP Credentials)
4. Domain: <code>${domain}</code>
5. Save and make a test call

<b>Any SIP Client</b>
Server: <code>${domain}</code>
Port: 5060 (UDP/TCP) or 5061 (TLS)
DTMF: RFC 2833 · Codec: G.711μ

🧪 <b>Free test calls:</b>
Send /testsip here to get your test code`,

  // Renew
  renewMenu: (number, plan, price, expiry, autoRenewOn) => `🔄 Plan for <b>${formatPhone(number)}</b>

Current Plan: ${plan} — $${price}/mo
Renewal Date: ${shortDate(expiry)}
Auto-Renew: ${autoRenewOn ? '✅ ON' : '❌ OFF'}`,

  // Delete
  releaseConfirm: (number) => `🗑️ <b>Delete ${formatPhone(number)}?</b>

⚠️ <b>This cannot be undone.</b>

• Number permanently deleted
• Monthly plan cancelled immediately
• All settings (forwarding, voicemail, SIP) removed
• No refund for remaining days

Are you sure?`,
  releaseConfirmDigits: (digits) => `⚠️ <b>Final confirmation</b>\n\nType the last 4 digits of the number to permanently delete it: <b>${digits}</b>`,
  released: (number) => `✅ ${formatPhone(number)} has been permanently deleted.\n\nPlan cancelled. All settings removed.`,

  // Real-time events
  inboundSms: (to, from, body, time) => `📩 <b>SMS Received</b>

📞 To: ${formatPhone(to)}
👤 From: ${formatPhone(from)}
🕐 ${time}

💬 "${body}"`,

  missedCall: (to, from, time) => `📞 <b>Missed Call</b>

📞 To: ${formatPhone(to)}
👤 From: ${formatPhone(from)}
🕐 ${time}`,

  callForwarded: (to, from, forwardedTo, duration, time) => `📞 <b>Call Forwarded</b>

📞 To: ${formatPhone(to)}
👤 From: ${formatPhone(from)}
📲 Forwarded: ${formatPhone(forwardedTo)}
⏱️ Duration: ${formatDuration(duration)}
🕐 ${time}`,

  newVoicemail: (to, from, duration, time) => `🎙️ <b>New Voicemail</b>

📞 To: ${formatPhone(to)}
👤 From: ${formatPhone(from)}
⏱️ Duration: ${formatDuration(duration)}
🕐 ${time}`,

  // Admin notifications
  adminPurchase: (user, number, plan, price, method) => `🎉 <b>New Phone Number Purchase!</b>\nUser ${user} bought ${formatPhone(number)}\nPlan: ${plan} ($${price}/mo)\nPayment: ${method}`,
  adminRelease: (user, number, plan) => `🗑️ <b>Number Deleted</b>\nUser ${user} deleted ${formatPhone(number)}\nWas: ${plan} Plan`,

  // Expiry reminders
  expiryReminder: (number, days, plan, price, balance) => `🔔 <b>Renewal Reminder</b>

Your Cloud Phone number ${formatPhone(number)} (${plan} Plan) expires in <b>${days} day${days !== 1 ? 's' : ''}</b>.

Wallet Balance: $${balance}
Plan Price: $${price}/mo${balance < price ? '\n\n⚠️ Insufficient balance. Please deposit funds.' : ''}`,

  autoRenewed: (number, plan, price, newExpiry, oldBal, newBal) => `✅ <b>Auto-Renewal Successful</b>

📞 ${formatPhone(number)}
📦 Plan: ${plan} ($${price}/mo)
📅 New expiry: ${shortDate(newExpiry)}
Wallet: $${oldBal} → $${newBal}`,

  autoRenewFailed: (number, plan, price, balance) => `❌ <b>Auto-Renewal Failed</b>

📞 ${formatPhone(number)}
📦 Plan: ${plan} ($${price}/mo)
💰 Wallet: $${balance} (need $${price})

⚠️ Your number is now SUSPENDED. Deposit funds and renew within 7 days.`,

  // IVR / Auto-attendant (Business Plan)
  ivrMenu: (number, config) => {
    if (!config?.enabled) {
      return `🤖 <b>IVR / Auto-attendant</b> for <b>${formatPhone(number)}</b>\n\nStatus: ❌ Disabled\n\nWhen enabled, callers hear a greeting menu and can press keys to reach the right destination.`
    }
    let text = `🤖 <b>IVR / Auto-attendant</b> for <b>${formatPhone(number)}</b>\n\nStatus: ✅ Enabled\n\n🎤 Greeting: "${config.greeting || 'Default'}"\n\n📋 <b>Menu Options:</b>\n`
    if (config.options && Object.keys(config.options).length > 0) {
      Object.entries(config.options).forEach(([key, opt]) => {
        text += `  Press <b>${key}</b> → ${opt.action === 'forward' ? '📲 Forward to ' + formatPhone(opt.forwardTo) : opt.action === 'voicemail' ? '🎙️ Voicemail' : '🔊 ' + (opt.message || 'Play message')}\n`
      })
    } else {
      text += '  No options configured yet.\n'
    }
    return text
  },
  ivrEnabled: (number) => `✅ IVR / Auto-attendant enabled for ${formatPhone(number)}!\n\nCallers will hear your greeting and can press keys to navigate.`,
  ivrDisabled: (number) => `✅ IVR / Auto-attendant disabled for ${formatPhone(number)}.`,
  ivrSetGreeting: 'Enter the IVR greeting message (what callers will hear):\n\nExample: "Thank you for calling. Press 1 for support, press 2 for sales, or stay on the line."',
  ivrGreetingSet: (greeting) => `✅ IVR greeting updated!\n\n"${greeting}"`,
  ivrAddOption: 'Enter the key and action in this format:\n\n<code>KEY ACTION DESTINATION</code>\n\nExamples:\n• <code>1 forward +14155551234</code>\n• <code>2 voicemail</code>\n• <code>3 message We will call you back</code>\n• <code>0 forward +14155559999</code>',
  ivrOptionAdded: (key, action, destination) => `✅ IVR option added!\n\nPress <b>${key}</b> → ${action === 'forward' ? '📲 Forward to ' + formatPhone(destination) : action === 'voicemail' ? '🎙️ Voicemail' : '🔊 ' + destination}`,
  ivrOptionRemoved: (key) => `✅ IVR option for key <b>${key}</b> removed.`,
  ivrInvalidFormat: '❌ Invalid format. Please use:\n<code>KEY ACTION DESTINATION</code>\n\nExample: <code>1 forward +14155551234</code>',

  ivrAnalyticsReport: (number, data) => {
    let text = `📊 <b>IVR Analytics</b> for <b>${formatPhone(number)}</b>\n(Last 30 days)\n\n`
    text += `📞 Total IVR calls: <b>${data.totalCalls}</b>\n`
    if (data.topOption) {
      text += `🏆 Most pressed: Key <b>${data.topOption.digit}</b> (${data.topOption.count} times, ${data.topOption.percent}%)\n`
    }
    text += '\n'
    if (data.optionBreakdown.length > 0) {
      text += '📋 <b>Option Breakdown:</b>\n'
      data.optionBreakdown.forEach(o => {
        const bar = '█'.repeat(Math.max(1, Math.round(o.percent / 10))) + '░'.repeat(Math.max(0, 10 - Math.round(o.percent / 10)))
        text += `  Key <b>${o.digit}</b>: ${bar} ${o.count} (${o.percent}%)\n`
      })
      text += '\n'
    }
    if (data.recentCalls.length > 0) {
      text += '📱 <b>Recent IVR Calls:</b>\n'
      data.recentCalls.forEach(c => {
        text += `  ${formatPhone(c.from)} → Key <b>${c.digit}</b> (${c.action}) ${shortDate(c.time)}\n`
      })
    }
    if (data.totalCalls === 0) text += '\nNo IVR calls recorded yet.'
    return text
  },

  // Call Recording (Business Plan)
  recordingMenu: (number, config) => {
    const enabled = config?.recording === true
    return `🔴 <b>Call Recording</b> for <b>${formatPhone(number)}</b>\n\nStatus: ${enabled ? '✅ Enabled' : '❌ Disabled'}\n\nWhen enabled, all incoming and outgoing calls will be automatically recorded. Recordings are sent to your Telegram chat.`
  },
  recordingEnabled: (number) => `✅ Call recording enabled for ${formatPhone(number)}!\n\nAll calls will be recorded and sent to this chat.`,
  recordingDisabled: (number) => `✅ Call recording disabled for ${formatPhone(number)}.`,

  // SMS Inbox
  smsInboxHeader: (number, total) => `📨 <b>SMS Inbox</b> for <b>${formatPhone(number)}</b>\n\n${total === 0 ? 'No messages received yet.' : `${total} message${total > 1 ? 's' : ''} received:`}`,
  smsInboxEntry: (i, from, name, body, time) => {
    const nameDisplay = name && name !== 'None' ? ` (${name})` : ''
    const bodyPreview = body.length > 80 ? body.substring(0, 80) + '...' : body
    return `\n<b>${i}.</b> ${formatPhone(from)}${nameDisplay}\n   💬 "${bodyPreview}"\n   🕐 ${time}\n`
  },
  smsInboxEmpty: 'No inbound SMS received yet for this number.\n\n<i>When someone texts your number, messages will appear here.</i>',
  smsInboxFooter: (page, totalPages) => totalPages > 1 ? `\n📄 Page ${page}/${totalPages}` : '',
}

// ── Helpers ──
function formatPhone(num) {
  if (!num) return ''
  const clean = num.replace(/[^+\d]/g, '')
  if (clean.startsWith('+1') && clean.length === 12) {
    return `+1 (${clean.slice(2, 5)}) ${clean.slice(5, 8)}-${clean.slice(8)}`
  }
  return clean
}

function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function shortDate(dateStr) {
  if (!dateStr) return 'N/A'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function generateSipUsername() {
  // Random seed for Telnyx API — actual sip_username comes from Telnyx response
  const crypto = require('crypto')
  return 'test_' + crypto.randomBytes(8).toString('hex')
}

function generateSipPassword() {
  // Random seed for Telnyx API — actual sip_password comes from Telnyx response
  const crypto = require('crypto')
  return crypto.randomBytes(16).toString('hex')
}

// ── Multilingual UI messages for Cloud Phone ──
const msg = {
  en: {
    selectOption: 'Please select an option.',
    selectValidCountry: 'Please select a valid country.',
    selectLocalOrTollFree: 'Please select Local or Toll-Free.',
    selectValidArea: 'Please select a valid area or use Search.',
    enterValidAreaCode: 'Enter a valid area code (e.g. 415).',
    tapNumberToSelect: 'Tap a number (1-5) to select.',
    selectPlan: 'Please select a plan.',
    proceedOrBack: 'Please proceed to payment or go back.',
    selectByIndex: 'Select a number by tapping its index.',
    selectForwardMode: 'Select a forwarding mode.',
    enterValidPhone: 'Enter a valid phone number with country code (e.g. +14155551234).',
    enterValidEmail: 'Enter a valid email address.',
    selectValidPlan: 'Select a valid plan.',
    noActiveNumbers: 'No active numbers. Buy one first!',
    purchasingNumber: '🔄 Purchasing your number...',
    purchaseFailed: '❌ Failed to purchase number. Your wallet has been refunded. Please try again or contact support.',
    confirmOrCancel: 'Please confirm or cancel.',
    typeLast4: (digits) => `Type the last 4 digits: ${digits}`,
    noOptionForKey: (key) => `❌ No option found for key "${key}".`,
    enterValidForwardTo: 'Please provide a valid forward-to number. E.g: <code>1 forward +14155551234</code>',
    autoRenewToggled: (state) => `🔁 Auto-Renew is now ${state ? '✅ ON' : '❌ OFF'}`,
    vmTelegramToggled: (state) => `📲 Voicemail to Telegram is now ${state ? '✅ ON' : '❌ OFF'}`,
    ringTimeUpdated: (seconds) => `✅ Ring time updated to ${seconds} seconds.`,
    changePlanHeader: (number, plan, price) => `📦 Change plan for ${formatPhone(number)}\n\nCurrent: ${plan.charAt(0).toUpperCase() + plan.slice(1)} — $${price}/mo`,
    planChanged: (plan, price) => `✅ Plan changed to <b>${plan.charAt(0).toUpperCase() + plan.slice(1)}</b> — $${price}/mo`,
    featuresDisabled: 'Features disabled:',
    noIvrOptions: 'No IVR menu options configured yet.',
    whichKeyRemove: 'Which key do you want to remove?',
    sendVoiceOrText: 'Send a voice message, audio file, or type a custom greeting text.',
    noActivity: 'No activity yet.',
    insufficientBalUpgrade: (needed, bal) => `❌ Insufficient balance. You need $${needed.toFixed(2)} but have $${bal.toFixed(2)}.\n\nPlease top up your wallet first.`,
    sipTestCode: (otp, remaining) => `🔑 <b>Your SIP Test Code</b>\n\n<code>${otp}</code>\n\nEnter this code on the call page to get your free SIP credentials.\n⏱ Expires in 5 minutes.\n📞 ${remaining} test call${remaining !== 1 ? 's' : ''} remaining.\n\n🌐 <a href="${CALL_PAGE_URL}">Open Call Page</a>`,
    sipTestComplete: `📞 <b>SIP Test Complete</b>\n\nYou've used your free test calls. To make unlimited SIP calls, subscribe to a <b>Cloud Phone</b> plan with SIP support.\n\n👉 Tap <b>📞 Cloud Phone + SIP</b> below to browse plans and get your own number with full SIP credentials.\n\n🌐 You can also make & receive calls directly in your browser at <a href="${CALL_PAGE_URL}">${CALL_PAGE_URL.replace('https://', '')}</a>`,
    sipTestReferral: (link) => `\n\n🎁 <b>Want 1 more free test call?</b>\nShare this link with a friend. When they send /testsip, you'll get a bonus call:\n\n${link}`,
    sipTestError: '❌ Could not generate test code. Please try again later.',
    sipTestMenuHint: '🧪 <i>Try SIP calling free — send /testsip</i>',
    buyPlansHeader: `🛒 <b>Buy Cloud Phone Plans</b>\n\nFirst, choose your plan:`,
  },
  fr: {
    selectOption: 'Veuillez sélectionner une option.',
    selectValidCountry: 'Veuillez sélectionner un pays valide.',
    selectLocalOrTollFree: 'Veuillez sélectionner Local ou Sans frais.',
    selectValidArea: 'Veuillez sélectionner une zone ou utiliser Recherche.',
    enterValidAreaCode: 'Entrez un indicatif régional valide (ex: 415).',
    tapNumberToSelect: 'Tapez un numéro (1-5) pour sélectionner.',
    selectPlan: 'Veuillez sélectionner un forfait.',
    proceedOrBack: 'Procédez au paiement ou revenez en arrière.',
    selectByIndex: 'Sélectionnez un numéro en tapant son index.',
    selectForwardMode: 'Sélectionnez un mode de transfert.',
    enterValidPhone: 'Entrez un numéro valide avec indicatif pays (ex: +14155551234).',
    enterValidEmail: 'Entrez une adresse email valide.',
    selectValidPlan: 'Sélectionnez un forfait valide.',
    noActiveNumbers: 'Aucun numéro actif. Achetez-en un d\'abord !',
    purchasingNumber: '🔄 Achat de votre numéro...',
    purchaseFailed: '❌ Échec de l\'achat. Votre portefeuille a été remboursé. Réessayez ou contactez le support.',
    confirmOrCancel: 'Veuillez confirmer ou annuler.',
    typeLast4: (digits) => `Tapez les 4 derniers chiffres : ${digits}`,
    noOptionForKey: (key) => `❌ Aucune option pour la touche "${key}".`,
    enterValidForwardTo: 'Fournissez un numéro valide. Ex: <code>1 forward +14155551234</code>',
    autoRenewToggled: (state) => `🔁 Renouvellement auto : ${state ? '✅ ACTIVÉ' : '❌ DÉSACTIVÉ'}`,
    vmTelegramToggled: (state) => `📲 Messagerie vocale Telegram : ${state ? '✅ ACTIVÉ' : '❌ DÉSACTIVÉ'}`,
    ringTimeUpdated: (seconds) => `✅ Durée de sonnerie : ${seconds} secondes.`,
    changePlanHeader: (number, plan, price) => `📦 Changer de forfait pour ${formatPhone(number)}\n\nActuel : ${plan.charAt(0).toUpperCase() + plan.slice(1)} — $${price}/mois`,
    planChanged: (plan, price) => `✅ Forfait changé : <b>${plan.charAt(0).toUpperCase() + plan.slice(1)}</b> — $${price}/mois`,
    featuresDisabled: 'Fonctionnalités désactivées :',
    noIvrOptions: 'Aucune option de menu IVR configurée.',
    whichKeyRemove: 'Quelle touche voulez-vous supprimer ?',
    sendVoiceOrText: 'Envoyez un message vocal, un fichier audio, ou tapez un texte personnalisé.',
    noActivity: 'Aucune activité pour le moment.',
    insufficientBalUpgrade: (needed, bal) => `❌ Solde insuffisant. Vous avez besoin de $${needed.toFixed(2)} mais n'avez que $${bal.toFixed(2)}.\n\nVeuillez recharger votre portefeuille.`,
    sipTestCode: (otp, remaining) => `🔑 <b>Votre code de test SIP</b>\n\n<code>${otp}</code>\n\nEntrez ce code sur la page d'appel pour obtenir vos identifiants SIP gratuits.\n⏱ Expire dans 5 minutes.\n📞 ${remaining} appel${remaining !== 1 ? 's' : ''} test restant${remaining !== 1 ? 's' : ''}.\n\n🌐 <a href="${CALL_PAGE_URL}">Ouvrir la page d'appel</a>`,
    sipTestComplete: `📞 <b>Test SIP terminé</b>\n\nVous avez utilisé vos appels test gratuits. Pour des appels SIP illimités, souscrivez à un forfait <b>Cloud Phone</b> avec support SIP.\n\n👉 Appuyez sur <b>📞 Cloud Phone + SIP</b> pour parcourir les forfaits.\n\n🌐 Appelez depuis votre navigateur : <a href="${CALL_PAGE_URL}">${CALL_PAGE_URL.replace('https://', '')}</a>`,
    sipTestReferral: (link) => `\n\n🎁 <b>Voulez-vous 1 appel test gratuit de plus ?</b>\nPartagez ce lien avec un ami. Quand il enverra /testsip, vous obtiendrez un appel bonus :\n\n${link}`,
    sipTestError: '❌ Impossible de générer le code test. Veuillez réessayer.',
    sipTestMenuHint: '🧪 <i>Essayez le SIP gratuitement — envoyez /testsip</i>',
    buyPlansHeader: `🛒 <b>Acheter un Forfait Cloud Phone</b>\n\nChoisissez d'abord votre forfait :`,
  },
  zh: {
    selectOption: '请选择一个选项。',
    selectValidCountry: '请选择一个有效的国家。',
    selectLocalOrTollFree: '请选择本地号码或免费号码。',
    selectValidArea: '请选择有效区域或使用搜索。',
    enterValidAreaCode: '输入有效的区号（如 415）。',
    tapNumberToSelect: '点击号码（1-5）进行选择。',
    selectPlan: '请选择一个套餐。',
    proceedOrBack: '请继续付款或返回。',
    selectByIndex: '点击序号选择号码。',
    selectForwardMode: '选择转发模式。',
    enterValidPhone: '输入带国家代码的有效号码（如 +14155551234）。',
    enterValidEmail: '输入有效的电子邮件地址。',
    selectValidPlan: '选择有效的套餐。',
    noActiveNumbers: '没有活跃号码。请先购买一个！',
    purchasingNumber: '🔄 正在购买号码...',
    purchaseFailed: '❌ 购买失败。钱包已退款。请重试或联系客服。',
    confirmOrCancel: '请确认或取消。',
    typeLast4: (digits) => `输入最后4位数字：${digits}`,
    noOptionForKey: (key) => `❌ 未找到按键 "${key}" 的选项。`,
    enterValidForwardTo: '请提供有效的转发号码。例如：<code>1 forward +14155551234</code>',
    autoRenewToggled: (state) => `🔁 自动续费：${state ? '✅ 已开启' : '❌ 已关闭'}`,
    vmTelegramToggled: (state) => `📲 语音邮件转 Telegram：${state ? '✅ 已开启' : '❌ 已关闭'}`,
    ringTimeUpdated: (seconds) => `✅ 响铃时间已更新为 ${seconds} 秒。`,
    changePlanHeader: (number, plan, price) => `📦 更改 ${formatPhone(number)} 的套餐\n\n当前：${plan.charAt(0).toUpperCase() + plan.slice(1)} — $${price}/月`,
    planChanged: (plan, price) => `✅ 套餐已更改为 <b>${plan.charAt(0).toUpperCase() + plan.slice(1)}</b> — $${price}/月`,
    featuresDisabled: '已禁用的功能：',
    noIvrOptions: '尚未配置 IVR 菜单选项。',
    whichKeyRemove: '要删除哪个按键？',
    sendVoiceOrText: '发送语音消息、音频文件，或输入自定义问候语文本。',
    noActivity: '暂无活动记录。',
    insufficientBalUpgrade: (needed, bal) => `❌ 余额不足。需要 $${needed.toFixed(2)}，但仅有 $${bal.toFixed(2)}。\n\n请先充值。`,
    sipTestCode: (otp, remaining) => `🔑 <b>您的SIP测试码</b>\n\n<code>${otp}</code>\n\n在通话页面输入此代码以获取免费SIP凭据。\n⏱ 5分钟后过期。\n📞 剩余 ${remaining} 次测试通话。\n\n🌐 <a href="${CALL_PAGE_URL}">打开通话页面</a>`,
    sipTestComplete: `📞 <b>SIP测试完成</b>\n\n您已使用完免费测试通话。如需无限SIP通话，请订阅支持SIP的 <b>Cloud Phone</b> 套餐。\n\n👉 点击 <b>📞 Cloud Phone + SIP</b> 浏览套餐。\n\n🌐 在浏览器中拨打电话：<a href="${CALL_PAGE_URL}">${CALL_PAGE_URL.replace('https://', '')}</a>`,
    sipTestReferral: (link) => `\n\n🎁 <b>想要再获得1次免费测试通话？</b>\n将此链接分享给朋友。当他们发送 /testsip 时，您将获得一次额外通话：\n\n${link}`,
    sipTestError: '❌ 无法生成测试码。请稍后重试。',
    sipTestMenuHint: '🧪 <i>免费试用SIP通话 — 发送 /testsip</i>',
    buyPlansHeader: `🛒 <b>购买云电话套餐</b>\n\n请先选择您的套餐：`,
  },
  hi: {
    selectOption: 'कृपया एक विकल्प चुनें।',
    selectValidCountry: 'कृपया एक मान्य देश चुनें।',
    selectLocalOrTollFree: 'कृपया लोकल या टोल-फ्री चुनें।',
    selectValidArea: 'कृपया एक मान्य क्षेत्र चुनें या खोज का उपयोग करें।',
    enterValidAreaCode: 'एक मान्य एरिया कोड दर्ज करें (जैसे 415)।',
    tapNumberToSelect: 'चुनने के लिए नंबर (1-5) टैप करें।',
    selectPlan: 'कृपया एक प्लान चुनें।',
    proceedOrBack: 'भुगतान जारी रखें या वापस जाएं।',
    selectByIndex: 'इंडेक्स टैप करके नंबर चुनें।',
    selectForwardMode: 'फॉरवर्डिंग मोड चुनें।',
    enterValidPhone: 'देश कोड के साथ मान्य नंबर दर्ज करें (जैसे +14155551234)।',
    enterValidEmail: 'एक मान्य ईमेल पता दर्ज करें।',
    selectValidPlan: 'एक मान्य प्लान चुनें।',
    noActiveNumbers: 'कोई सक्रिय नंबर नहीं। पहले एक खरीदें!',
    purchasingNumber: '🔄 आपका नंबर खरीदा जा रहा है...',
    purchaseFailed: '❌ खरीदारी विफल। वॉलेट में रिफंड हो गया। कृपया पुनः प्रयास करें या सपोर्ट से संपर्क करें।',
    confirmOrCancel: 'कृपया पुष्टि करें या रद्द करें।',
    typeLast4: (digits) => `अंतिम 4 अंक टाइप करें: ${digits}`,
    noOptionForKey: (key) => `❌ कुंजी "${key}" के लिए कोई विकल्प नहीं मिला।`,
    enterValidForwardTo: 'एक मान्य फॉरवर्ड नंबर दें। उदा: <code>1 forward +14155551234</code>',
    autoRenewToggled: (state) => `🔁 ऑटो-रिन्यू: ${state ? '✅ चालू' : '❌ बंद'}`,
    vmTelegramToggled: (state) => `📲 वॉइसमेल टेलीग्राम: ${state ? '✅ चालू' : '❌ बंद'}`,
    ringTimeUpdated: (seconds) => `✅ रिंग टाइम ${seconds} सेकंड अपडेट।`,
    changePlanHeader: (number, plan, price) => `📦 ${formatPhone(number)} का प्लान बदलें\n\nवर्तमान: ${plan.charAt(0).toUpperCase() + plan.slice(1)} — $${price}/माह`,
    planChanged: (plan, price) => `✅ प्लान <b>${plan.charAt(0).toUpperCase() + plan.slice(1)}</b> — $${price}/माह में बदला`,
    featuresDisabled: 'अक्षम सुविधाएँ:',
    noIvrOptions: 'कोई IVR मेनू विकल्प कॉन्फ़िगर नहीं किया गया।',
    whichKeyRemove: 'कौन सी कुंजी हटानी है?',
    sendVoiceOrText: 'वॉइस मैसेज, ऑडियो फ़ाइल भेजें, या कस्टम ग्रीटिंग टेक्स्ट टाइप करें।',
    noActivity: 'अभी तक कोई गतिविधि नहीं।',
    insufficientBalUpgrade: (needed, bal) => `❌ अपर्याप्त बैलेंस। आपको $${needed.toFixed(2)} चाहिए लेकिन $${bal.toFixed(2)} है।\n\nकृपया पहले वॉलेट में रिचार्ज करें।`,
    sipTestCode: (otp, remaining) => `🔑 <b>आपका SIP टेस्ट कोड</b>\n\n<code>${otp}</code>\n\nमुफ्त SIP क्रेडेंशियल्स पाने के लिए कॉल पेज पर यह कोड दर्ज करें।\n⏱ 5 मिनट में समाप्त।\n📞 ${remaining} टेस्ट कॉल शेष।\n\n🌐 <a href="${CALL_PAGE_URL}">कॉल पेज खोलें</a>`,
    sipTestComplete: `📞 <b>SIP टेस्ट पूरा</b>\n\nआपके मुफ्त टेस्ट कॉल समाप्त हो गए। असीमित SIP कॉल के लिए, SIP सपोर्ट वाला <b>Cloud Phone</b> प्लान लें।\n\n👉 प्लान देखने के लिए <b>📞 Cloud Phone + SIP</b> दबाएं।\n\n🌐 ब्राउज़र में कॉल करें: <a href="${CALL_PAGE_URL}">${CALL_PAGE_URL.replace('https://', '')}</a>`,
    sipTestReferral: (link) => `\n\n🎁 <b>1 और मुफ्त टेस्ट कॉल चाहिए?</b>\nयह लिंक किसी दोस्त को भेजें। जब वे /testsip भेजेंगे, आपको बोनस कॉल मिलेगा:\n\n${link}`,
    sipTestError: '❌ टेस्ट कोड जनरेट नहीं हो सका। कृपया बाद में पुनः प्रयास करें।',
    sipTestMenuHint: '🧪 <i>SIP कॉलिंग मुफ्त आज़माएं — /testsip भेजें</i>',
    buyPlansHeader: `🛒 <b>क्लाउड फ़ोन प्लान खरीदें</b>\n\nपहले अपना प्लान चुनें:`,
  },
}

// ── Translated button labels (for multilingual keyboards) ──
const btnI18n = {
  fr: {
    buyPhoneNumber: '🛒 Acheter un Forfait Cloud Phone',
    myNumbers: '📱 Mes Numéros',
    sipSettings: '📖 Guide SIP',
    usageBilling: '📊 Utilisation & Facturation',
    localNumber: '📍 Numéro Local',
    tollFreeNumber: '🆓 Numéro Gratuit',
    mobileNumber: '📱 Numéro Mobile',
    nationalNumber: '🌐 Numéro National',
    starterPlan: PHONE_STARTER_ON ? `💡 Starter — $${PHONE_STARTER_PRICE}/mois` : '💡 Starter — Bientôt 🔜',
    proPlan: PHONE_PRO_ON ? `⭐ Pro — $${PHONE_PRO_PRICE}/mois` : '⭐ Pro — Bientôt 🔜',
    businessPlan: PHONE_BUSINESS_ON ? `👑 Business — $${PHONE_BUSINESS_PRICE}/mois` : '👑 Business — Bientôt 🔜',
    callForwarding: '📞 Transfert d\'Appels',
    smsSettings: '📩 Paramètres SMS',
    smsInbox: '📨 Boîte SMS',
    voicemail: '🎙️ Messagerie Vocale',
    sipCredentials: '🔑 Identifiants SIP',
    callRecording: '🔴 Enregistrement d\'Appels',
    ivrAutoAttendant: '🤖 SVI / Standard Auto',
    callSmsLogs: '📊 Journaux Appels & SMS',
    renewChangePlan: '🔄 Renouveler / Changer',
    releaseNumber: '🗑️ Supprimer le Numéro',
    alwaysForward: '📞 Toujours Transférer',
    forwardBusy: '📵 Transférer si Occupé',
    forwardNoAnswer: '⏰ Transférer sans Réponse',
    disableForwarding: '🚫 Désactiver le Transfert',
    holdMusicOn: '🎵 Musique d\'Attente: OUI',
    holdMusicOff: '🎵 Musique d\'Attente: NON',
    smsToTelegram: '📲 SMS vers Telegram',
    smsToEmail: '📧 SMS par Email',
    smsWebhook: '🔗 URL Webhook',
    enableVoicemail: '✅ Activer Messagerie',
    disableVoicemail: '🚫 Désactiver Messagerie',
    vmGreeting: '🔊 Message d\'Accueil',
    vmCustomGreeting: '🎤 Accueil Personnalisé',
    vmDefaultGreeting: '🔄 Accueil Par Défaut',
    vmToTelegram: '📲 Envoyer sur Telegram',
    vmToEmail: '📧 Envoyer par Email',
    vmRingTime: '⏰ Temps de Sonnerie',
    revealPassword: '👁️ Révéler le Mot de Passe',
    resetPassword: '🔄 Réinitialiser le Mot de Passe',
    softphoneGuide: '📖 Guide SIP',
    renewNow: '🔄 Renouveler Maintenant',
    changePlan: '📦 Changer de Forfait',
    autoRenew: '🔁 Renouvellement Auto',
    showMore: '🔄 Plus de Numéros',
    searchByArea: '🔍 Chercher par Zone',
    moreCountries: '🌍 Plus de Pays',
    applyCoupon: '🎟️ Appliquer un Coupon',
    proceedPayment: '✅ Procéder au Paiement',
    buyAnother: '🛒 Acheter un Autre Numéro',
    confirm: '✅ Confirmer',
    yesRelease: '⚠️ Oui, Supprimer Définitivement',
    noKeep: '↩️ Non, Garder',
    yesReset: 'Oui, Réinitialiser',
    enableIvr: '✅ Activer le SVI',
    disableIvr: '🚫 Désactiver le SVI',
    ivrGreeting: '🎤 Message d\'Accueil',
    ivrAddOption: '➕ Ajouter une Option',
    ivrRemoveOption: '➖ Supprimer une Option',
    ivrViewOptions: '📋 Voir les Options',
    ivrAnalytics: '📊 Analytiques SVI',
    enableRecording: '✅ Activer l\'Enregistrement',
    disableRecording: '🚫 Désactiver l\'Enregistrement',
    inboxNewerPage: '◀️ Plus Récent',
    inboxOlderPage: '▶️ Plus Ancien',
    inboxRefresh: '🔄 Actualiser',
    ivrOutboundCall: '📢 Appel IVR Sortant',
    ivrOutboundBack: '↩️ Retour',
    bulkCallCampaign: '📞 Campagne d\'Appels en Masse',
    audioLibrary: '🎵 Bibliothèque Audio',
    back: 'Retour',
    cancel: 'Annuler',
  },
  zh: {
    buyPhoneNumber: '🛒 购买云电话套餐',
    myNumbers: '📱 我的号码',
    sipSettings: '📖 SIP 设置指南',
    usageBilling: '📊 使用量与账单',
    localNumber: '📍 本地号码',
    tollFreeNumber: '🆓 免费号码',
    mobileNumber: '📱 手机号码',
    nationalNumber: '🌐 全国号码',
    starterPlan: PHONE_STARTER_ON ? `💡 入门版 — $${PHONE_STARTER_PRICE}/月` : '💡 入门版 — 即将推出 🔜',
    proPlan: PHONE_PRO_ON ? `⭐ 专业版 — $${PHONE_PRO_PRICE}/月` : '⭐ 专业版 — 即将推出 🔜',
    businessPlan: PHONE_BUSINESS_ON ? `👑 商务版 — $${PHONE_BUSINESS_PRICE}/月` : '👑 商务版 — 即将推出 🔜',
    callForwarding: '📞 呼叫转移',
    smsSettings: '📩 短信设置',
    smsInbox: '📨 短信收件箱',
    voicemail: '🎙️ 语音信箱',
    sipCredentials: '🔑 SIP 凭据',
    callRecording: '🔴 通话录音',
    ivrAutoAttendant: '🤖 IVR / 自动应答',
    callSmsLogs: '📊 通话和短信记录',
    renewChangePlan: '🔄 续费 / 更换套餐',
    releaseNumber: '🗑️ 删除号码',
    alwaysForward: '📞 始终转发',
    forwardBusy: '📵 忙时转发',
    forwardNoAnswer: '⏰ 无人接听时转发',
    disableForwarding: '🚫 关闭转发',
    holdMusicOn: '🎵 等待音乐: 开',
    holdMusicOff: '🎵 等待音乐: 关',
    smsToTelegram: '📲 短信转发到 Telegram',
    smsToEmail: '📧 短信转发到邮箱',
    smsWebhook: '🔗 Webhook URL',
    enableVoicemail: '✅ 启用语音信箱',
    disableVoicemail: '🚫 关闭语音信箱',
    vmGreeting: '🔊 问候语',
    vmCustomGreeting: '🎤 自定义语音问候',
    vmDefaultGreeting: '🔄 默认问候语',
    vmToTelegram: '📲 发送到 Telegram',
    vmToEmail: '📧 发送到邮箱',
    vmRingTime: '⏰ 响铃时间',
    revealPassword: '👁️ 显示密码',
    resetPassword: '🔄 重置密码',
    softphoneGuide: '📖 SIP 设置指南',
    renewNow: '🔄 立即续费',
    changePlan: '📦 更换套餐',
    autoRenew: '🔁 自动续费',
    showMore: '🔄 显示更多号码',
    searchByArea: '🔍 按区号搜索',
    moreCountries: '🌍 更多国家',
    applyCoupon: '🎟️ 使用优惠券',
    proceedPayment: '✅ 继续支付',
    buyAnother: '🛒 购买另一个号码',
    confirm: '✅ 确认',
    yesRelease: '⚠️ 是的，永久删除',
    noKeep: '↩️ 不，保留',
    yesReset: '是的，重置',
    enableIvr: '✅ 启用 IVR',
    disableIvr: '🚫 关闭 IVR',
    ivrGreeting: '🎤 设置问候语',
    ivrAddOption: '➕ 添加菜单选项',
    ivrRemoveOption: '➖ 删除选项',
    ivrViewOptions: '📋 查看菜单选项',
    ivrAnalytics: '📊 IVR 分析',
    enableRecording: '✅ 启用录音',
    disableRecording: '🚫 关闭录音',
    inboxNewerPage: '◀️ 较新',
    inboxOlderPage: '▶️ 较旧',
    inboxRefresh: '🔄 刷新',
    ivrOutboundCall: '📢 IVR 外呼',
    ivrOutboundBack: '↩️ 返回',
    bulkCallCampaign: '📞 批量呼叫活动',
    audioLibrary: '🎵 音频库',
    back: '返回',
    cancel: '取消',
  },
  hi: {
    buyPhoneNumber: '🛒 क्लाउड फ़ोन प्लान खरीदें',
    myNumbers: '📱 मेरे नंबर',
    sipSettings: '📖 SIP सेटअप गाइड',
    usageBilling: '📊 उपयोग और बिलिंग',
    localNumber: '📍 लोकल नंबर',
    tollFreeNumber: '🆓 टोल-फ्री नंबर',
    mobileNumber: '📱 मोबाइल नंबर',
    nationalNumber: '🌐 नेशनल नंबर',
    starterPlan: PHONE_STARTER_ON ? `💡 स्टार्टर — $${PHONE_STARTER_PRICE}/माह` : '💡 स्टार्टर — जल्द आ रहा है 🔜',
    proPlan: PHONE_PRO_ON ? `⭐ प्रो — $${PHONE_PRO_PRICE}/माह` : '⭐ प्रो — जल्द आ रहा है 🔜',
    businessPlan: PHONE_BUSINESS_ON ? `👑 बिज़नेस — $${PHONE_BUSINESS_PRICE}/माह` : '👑 बिज़नेस — जल्द आ रहा है 🔜',
    callForwarding: '📞 कॉल फ़ॉरवर्डिंग',
    smsSettings: '📩 SMS सेटिंग्स',
    smsInbox: '📨 SMS इनबॉक्स',
    voicemail: '🎙️ वॉइसमेल',
    sipCredentials: '🔑 SIP क्रेडेंशियल्स',
    callRecording: '🔴 कॉल रिकॉर्डिंग',
    ivrAutoAttendant: '🤖 IVR / ऑटो-अटेंडेंट',
    callSmsLogs: '📊 कॉल और SMS लॉग',
    renewChangePlan: '🔄 नवीनीकरण / प्लान बदलें',
    releaseNumber: '🗑️ नंबर हटाएं',
    alwaysForward: '📞 हमेशा फ़ॉरवर्ड',
    forwardBusy: '📵 व्यस्त होने पर फ़ॉरवर्ड',
    forwardNoAnswer: '⏰ जवाब न होने पर फ़ॉरवर्ड',
    disableForwarding: '🚫 फ़ॉरवर्डिंग बंद करें',
    holdMusicOn: '🎵 होल्ड म्यूज़िक: चालू',
    holdMusicOff: '🎵 होल्ड म्यूज़िक: बंद',
    smsToTelegram: '📲 SMS टेलीग्राम पर',
    smsToEmail: '📧 SMS ईमेल पर',
    smsWebhook: '🔗 Webhook URL',
    enableVoicemail: '✅ वॉइसमेल चालू करें',
    disableVoicemail: '🚫 वॉइसमेल बंद करें',
    vmGreeting: '🔊 ग्रीटिंग',
    vmCustomGreeting: '🎤 कस्टम ग्रीटिंग (ऑडियो)',
    vmDefaultGreeting: '🔄 डिफ़ॉल्ट ग्रीटिंग',
    vmToTelegram: '📲 टेलीग्राम पर भेजें',
    vmToEmail: '📧 ईमेल पर भेजें',
    vmRingTime: '⏰ रिंग टाइम',
    revealPassword: '👁️ पासवर्ड दिखाएं',
    resetPassword: '🔄 पासवर्ड रीसेट करें',
    softphoneGuide: '📖 SIP सेटअप गाइड',
    renewNow: '🔄 अभी नवीनीकरण करें',
    changePlan: '📦 प्लान बदलें',
    autoRenew: '🔁 ऑटो-रिन्यू',
    showMore: '🔄 और नंबर दिखाएं',
    searchByArea: '🔍 एरिया कोड से खोजें',
    moreCountries: '🌍 और देश',
    applyCoupon: '🎟️ कूपन लगाएं',
    proceedPayment: '✅ भुगतान करें',
    buyAnother: '🛒 और एक नंबर खरीदें',
    confirm: '✅ पुष्टि करें',
    yesRelease: '⚠️ हाँ, स्थायी रूप से हटाएं',
    noKeep: '↩️ नहीं, रखें',
    yesReset: 'हाँ, रीसेट करें',
    enableIvr: '✅ IVR चालू करें',
    disableIvr: '🚫 IVR बंद करें',
    ivrGreeting: '🎤 ग्रीटिंग सेट करें',
    ivrAddOption: '➕ विकल्प जोड़ें',
    ivrRemoveOption: '➖ विकल्प हटाएं',
    ivrViewOptions: '📋 विकल्प देखें',
    ivrAnalytics: '📊 IVR एनालिटिक्स',
    enableRecording: '✅ रिकॉर्डिंग चालू करें',
    disableRecording: '🚫 रिकॉर्डिंग बंद करें',
    inboxNewerPage: '◀️ नए',
    inboxOlderPage: '▶️ पुराने',
    inboxRefresh: '🔄 रिफ्रेश',
    ivrOutboundCall: '📢 IVR आउटबाउंड कॉल',
    ivrOutboundBack: '↩️ वापस',
    bulkCallCampaign: '📞 बल्क कॉल अभियान',
    audioLibrary: '🎵 ऑडियो लाइब्रेरी',
    back: 'वापस',
    cancel: 'रद्द करें',
  },
}

// Build reverse lookup: for any button value → which key it belongs to
const _allBtnValueToKey = {}
// Add English btn values
for (const [key, val] of Object.entries(btn)) {
  if (typeof val === 'string') _allBtnValueToKey[val] = key
}
// Add translated btn values
for (const [lang, labels] of Object.entries(btnI18n)) {
  for (const [key, val] of Object.entries(labels)) {
    if (typeof val === 'string') _allBtnValueToKey[val] = key
  }
}

/** Get full translated btn object for a language (falls back to English) */
function getBtn(lang) {
  if (!lang || lang === 'en') return btn
  const translations = btnI18n[lang]
  if (!translations) return btn
  return { ...btn, ...translations }
}

/** Get the translated button label for a specific key */
function getBtnLabel(key, lang) {
  if (!lang || lang === 'en') return btn[key]
  return btnI18n[lang]?.[key] || btn[key]
}

/** Check if a message matches ANY language variant of a button key */
function isBtnMatch(message, key) {
  if (message === btn[key]) return true
  for (const lang of Object.keys(btnI18n)) {
    if (btnI18n[lang][key] === message) return true
  }
  return false
}

/** Given a button value in any language, return its key name (or null) */
function btnKeyOf(message) {
  return _allBtnValueToKey[message] || null
}

// ── Translated txt (user-facing message texts) ──
const txtI18n = {
  fr: {
    hubWelcome: `📞 <b>CloudPhone</b> <i>par Speechcue</i>

Obtenez un numéro virtuel dans plus de 30 pays — en moins de 2 minutes.

📞 Transférez les appels vers votre vrai téléphone
💬 Recevez les SMS directement dans Telegram
🌐 Appelez et recevez des appels dans votre navigateur — sans application
🤖 Configurez un standard automatique IVR
🔗 Connectez via un softphone SIP

Forfaits à partir de <b>$${PHONE_STARTER_PRICE}/mois</b> avec ${plans.starter.minutes} min + ${plans.starter.sms} SMS inclus.

Sélectionnez une option :`,
    selectCountry: '📍 Sélectionnez le pays pour votre nouveau numéro :',
    searching: '🔍 Recherche de numéros disponibles...',
    noSearchResults: '❌ Aucun numéro disponible. Essayez une autre zone ou un autre pays.',
    noNumbers: '📱 Vous n\'avez pas encore de numéro.\n\nAppuyez ci-dessous pour obtenir votre premier numéro virtuel.',
    enterEmail: 'Entrez l\'adresse email pour recevoir les SMS :',
    enterWebhook: 'Entrez votre URL webhook (les SMS seront envoyés en JSON) :',
    ivrTrialUsed: (buyLabel) => `📢 <b>Appel IVR Sortant</b>\n\nVous avez déjà utilisé votre appel d'essai gratuit.\n\nAbonnez-vous à Cloud Phone pour des appels IVR illimités avec votre propre Caller ID !\n\nAppuyez sur <b>${buyLabel}</b> pour commencer.`,
    ivrTrialOffer: (callerId) => `📢 <b>Appel IVR Sortant — Essai Gratuit</b>\n\n🎁 Vous avez <b>1 appel d'essai gratuit !</b>\n📱 Caller ID: <b>${callerId}</b> (partagé)\n\nEntrez le numéro à appeler (avec indicatif pays) :\n<i>Exemple : +33612345678</i>`,
    ivrSelectCallerId: '📢 <b>Appel IVR Sortant</b>\n\nSélectionnez le numéro pour l\'appel (Caller ID) :',
    ivrEnterNumber: (phone) => `📱 Caller ID: <b>${phone}</b>\n\nEntrez le numéro à appeler (avec indicatif pays) :\n<i>Exemple : +33612345678</i>`,
    ivrFoundCnam: (name) => `📋 Trouvé : <b>${name}</b>`,
    ivrSelectCategory: (number) => `📞 Cible : <b>${number}</b>\n\nChoisissez une catégorie de modèle IVR :`,
    ivrCustomScript: `✍️ <b>Script Personnalisé</b>\n\nTapez votre message IVR. Utilisez des <b>[Crochets]</b> pour les variables :\n\n<i>Exemple : Bonjour [Nom]. Ici [Entreprise]. Un paiement de $[Montant] a été débité. Appuyez sur 1 pour contester.</i>\n\nTapez votre script :`,
    ivrEnterValue: (ph) => `Entrez la valeur pour <b>[${ph}]</b> :`,
    ivrValueSaved: (name, value, nextPh) => `✅ ${name} : <b>${value}</b>\n\nEntrez la valeur pour <b>[${nextPh}]</b> :`,
    ivrSelectVoiceProvider: '🎙 <b>Sélectionner le Fournisseur Vocal</b>\n\nChoisissez votre moteur TTS :',
    ivrSelectVoice: '🎤 <b>Sélectionner la Voix</b>\n\nChoisissez une voix pour l\'audio IVR :',
    ivrGeneratingPreview: (voice) => `🎤 Voix : <b>${voice}</b>\n\n⏳ Génération de l'aperçu audio...`,
    ivrHoldMusicStatus: (on) => `🎵 Musique d'Attente : <b>${on ? 'OUI' : 'NON'}</b>\n${on ? 'La cible entendra "Veuillez patienter" + musique avant le transfert.' : 'La cible entend la sonnerie standard pendant le transfert.'}`,
    ivrConfirmPrompt: 'Appuyez sur <b>✅ Confirmer</b> pour continuer, <b>🎤 Changer la Voix</b>, ou <b>Retour</b>.',
    ivrTemplatePreview: (icon, name, text, keys) => `📋 <b>${icon} ${name}</b>\n\n<i>"${text}"</i>\n\n🔘 Touches actives : <b>${keys}</b>`,
    bulkCallNoPlan: (buyLabel) => `📞 <b>Campagne d'Appels en Masse</b>\n\n🔒 Cette fonctionnalité nécessite le forfait <b>Pro</b> ou supérieur.\n\nObtenez d'abord un numéro Cloud Phone !\n\nAppuyez sur <b>${buyLabel}</b> pour commencer.`,
    bulkCallNoNumber: (buyLabel) => `📞 <b>Campagne d'Appels en Masse</b>\n\nVous avez besoin d'un numéro ☎️ capable IVR en masse.\n\nAppuyez sur <b>${buyLabel}</b> et choisissez un numéro avec le badge ☎️.`,
    bulkCallSelect: '📞 <b>Campagne d\'Appels en Masse</b>\n\nLancez des appels IVR automatisés vers plusieurs leads.\n\n☎️ = Numéros capables IVR en masse\n\n📱 Sélectionnez le Caller ID :',
    audioLibEmpty: '🎵 <b>Bibliothèque Audio</b>\n\nVous n\'avez pas de fichiers audio enregistrés.\n\nUploadez un fichier audio (MP3, WAV, OGG) pour les campagnes IVR.',
    audioLibTitle: (list) => `🎵 <b>Bibliothèque Audio</b>\n\n${list}\n\nUploadez un nouveau fichier ou supprimez-en un :`,
    audioUploadPrompt: '🎵 <b>Uploader Audio</b>\n\nEnvoyez-moi un fichier audio (MP3, WAV, OGG) ou un message vocal.\n\nIl sera sauvegardé dans votre bibliothèque pour les campagnes IVR.',
    audioSaved: (name) => `✅ Audio enregistré : <b>${name}</b>\n\nVous pouvez maintenant l'utiliser dans les Campagnes d'Appels en Masse !`,
    audioDeleted: (name) => `✅ Supprimé : <b>${name}</b>`,
    audioNamePrompt: (defaultName) => `✅ Audio reçu !\n\nDonnez-lui un nom :`,
    audioNamePromptLib: (size, defaultName) => `✅ Audio reçu ! (${size} KB)\n\nDonnez-lui un nom pour votre bibliothèque :`,
    audioLibEmptyShort: '🎵 <b>Bibliothèque Audio</b>\n\nAucun fichier audio. Uploadez-en un pour commencer.',
    vmRingPrompt: 'Combien de temps le téléphone doit-il sonner avant la messagerie vocale ?',
    enterValidUrl: 'Entrez une URL valide commençant par http:// ou https://.',
    enterAddress: (countryName, addrText) => `✅ Paiement reçu !\n\n📍 <b>${countryName}</b> nécessite une adresse de facturation pour activer le numéro.\nAdresse ${addrText || 'requise'}.\n\nVeuillez entrer votre adresse :\n<code>Rue, Ville, Pays</code>\n\n<i>Exemple : 123 Rue Principale, Paris, France</i>`,
    invalidAddress: '⚠️ Veuillez entrer au minimum : <code>Rue, Ville, Pays</code>\n\n<i>Exemple : 123 Rue Principale, Paris, France</i>',
    bulkUploadLeads: (phone) => `📱 Caller ID: <b>${phone}</b>\n\n📋 <b>Uploader les Leads</b>\n\nEnvoyez un fichier (.txt ou .csv) avec un numéro par ligne.\nOptionnel : <code>numéro,nom</code> par ligne.\n\nOu collez les numéros directement (un par ligne) :`,
    bulkLeadsLoaded: (count, preview, more, errNote) => `✅ <b>${count} leads chargés !</b>\n\n${preview}${more}${errNote}\n\n🎵 <b>Sélectionner Audio IVR</b>\n\nChoisissez un fichier audio, uploadez-en un, ou générez avec TTS :`,
    bulkTtsHint: '💡 Pour utiliser le TTS, générez d\'abord l\'audio via le flux <b>📢 Appel IVR Sortant</b>, ou uploadez un fichier audio.\n\nSélectionnez dans votre bibliothèque ou uploadez :',
    bulkAudioSelected: (name) => `🎵 Audio : <b>${name}</b>\n\n📋 <b>Mode de Campagne</b>\n\n🔗 <b>Transfert + Rapport</b> — Quand le lead appuie sur 1, pont vers votre SIP/téléphone + rapport\n📊 <b>Rapport Seul</b> — Suivi uniquement + rapport\n\nLes deux modes rapportent les résultats complets.`,
    bulkAudioSavedMode: (name) => `✅ Enregistré : <b>${name}</b>\n\n📋 <b>Mode de Campagne</b>\n\n🔗 <b>Transfert + Rapport</b> — Appuyer sur 1 fait le pont vers votre téléphone\n📊 <b>Rapport Seul</b> — Suivi uniquement\n\nLes deux modes rapportent les résultats.`,
    bulkTransferPrompt: '🔗 <b>Mode Transfert</b>\n\nEntrez le numéro pour transférer quand le lead appuie sur 1 :\n<i>(Votre numéro SIP ou tout numéro de téléphone)</i>',
    bulkConcurrency: (transferTo) => `${transferTo ? `🔗 Transfert vers : <b>${transferTo}</b>\n\n` : `📊 <b>Rapport Seul</b> — pas de transferts.\n\n`}⚡ <b>Concurrence</b>\n\nCombien d'appels simultanés ? (1-20)\nDéfaut : <b>10</b>`,
    bulkRunning: 'La campagne est en cours ! Vous verrez les mises à jour ici.\n\nAppuyez sur <b>🛑 Arrêter</b> pour annuler.',
    bulkCancelled: '🛑 <b>Campagne annulée.</b>\n\nLes appels actifs se termineront, aucun nouvel appel ne sera lancé.',
    btnUploadAudio: '📎 Uploader Audio',
    btnConfirm: '✅ Confirmer',
    btnChangeVoice: '🎤 Changer la Voix',
    btnTransferReport: '🔗 Transfert + Rapport',
    btnReportOnly: '📊 Rapport Seul',
    btnStopCampaign: '🛑 Arrêter la Campagne',
    btnShowStatus: '📊 Afficher le Statut',
    btnUploadNewAudio: '📎 Uploader Nouveau',
    btnBack: '↩️ Retour',
  },
  zh: {
    hubWelcome: `📞 <b>CloudPhone</b> <i>由 Speechcue 提供</i>

在30多个国家获取虚拟号码 — 不到2分钟。

📞 将来电转接到您的真实手机
💬 在 Telegram 中直接接收短信
🌐 在浏览器中拨打和接听电话 — 无需安装应用
🤖 设置 IVR 自动应答
🔗 通过 SIP 软电话连接

套餐起价 <b>$${PHONE_STARTER_PRICE}/月</b>，含 ${plans.starter.minutes} 分钟 + ${plans.starter.sms} 条短信。

请选择一个选项：`,
    selectCountry: '📍 为您的新号码选择国家：',
    searching: '🔍 正在搜索可用号码...',
    noSearchResults: '❌ 没有可用号码。请尝试其他区域或国家。',
    noNumbers: '📱 您还没有电话号码。\n\n点击下方获取您的第一个虚拟号码。',
    enterEmail: '输入用于接收短信的电子邮件地址：',
    enterWebhook: '输入您的 Webhook URL（短信将以 JSON 格式发送）：',
    ivrTrialUsed: (buyLabel) => `📢 <b>IVR 外呼</b>\n\n您已使用了免费试用通话。\n\n订阅 Cloud Phone 即可使用您自己的来电显示进行无限 IVR 通话！\n\n点击 <b>${buyLabel}</b> 开始。`,
    ivrTrialOffer: (callerId) => `📢 <b>IVR 外呼 — 免费试用</b>\n\n🎁 您有 <b>1 次免费试用通话！</b>\n📱 来电显示：<b>${callerId}</b>（共享）\n\n输入要拨打的电话号码（含国际区号）：\n<i>示例：+8613812345678</i>`,
    ivrSelectCallerId: '📢 <b>IVR 外呼</b>\n\n选择拨出号码（来电显示）：',
    ivrEnterNumber: (phone) => `📱 来电显示：<b>${phone}</b>\n\n输入要拨打的电话号码（含国际区号）：\n<i>示例：+8613812345678</i>`,
    ivrFoundCnam: (name) => `📋 查询结果：<b>${name}</b>`,
    ivrSelectCategory: (number) => `📞 目标：<b>${number}</b>\n\n选择 IVR 模板类别：`,
    ivrCustomScript: '✍️ <b>自定义脚本</b>\n\n输入您的 IVR 消息。使用 <b>[方括号]</b> 表示变量：\n\n<i>示例：您好 [姓名]。这里是 [公司]。一笔 $[金额] 的付款已扣除。按 1 争议。</i>\n\n输入您的脚本：',
    ivrEnterValue: (ph) => `输入 <b>[${ph}]</b> 的值：`,
    ivrValueSaved: (name, value, nextPh) => `✅ ${name}：<b>${value}</b>\n\n输入 <b>[${nextPh}]</b> 的值：`,
    ivrSelectVoiceProvider: '🎙 <b>选择语音引擎</b>\n\n选择您的 TTS 引擎：',
    ivrSelectVoice: '🎤 <b>选择语音</b>\n\n为 IVR 音频选择语音：',
    ivrGeneratingPreview: (voice) => `🎤 语音：<b>${voice}</b>\n\n⏳ 正在生成音频预览...`,
    ivrHoldMusicStatus: (on) => `🎵 等待音乐：<b>${on ? '开' : '关'}</b>\n${on ? '目标将听到"请稍候"+ 音乐。' : '目标听到标准回铃音。'}`,
    ivrConfirmPrompt: '点击 <b>✅ 确认</b> 继续，<b>🎤 更换语音</b>，或 <b>返回</b>。',
    ivrTemplatePreview: (icon, name, text, keys) => `📋 <b>${icon} ${name}</b>\n\n<i>"${text}"</i>\n\n🔘 活动按键：<b>${keys}</b>`,
    bulkCallNoPlan: (buyLabel) => `📞 <b>批量呼叫活动</b>\n\n🔒 此功能需要 <b>Pro</b> 或更高套餐。\n\n请先获取 Cloud Phone 号码！\n\n点击 <b>${buyLabel}</b> 开始。`,
    bulkCallNoNumber: (buyLabel) => `📞 <b>批量呼叫活动</b>\n\n您需要一个 ☎️ 支持批量 IVR 的号码。\n\n点击 <b>${buyLabel}</b> 并选择带有 ☎️ 标记的号码。`,
    bulkCallSelect: '📞 <b>批量呼叫活动</b>\n\n向多个线索发起自动 IVR 通话。\n\n☎️ = 支持批量 IVR 的号码\n\n📱 选择来电显示：',
    audioLibEmpty: '🎵 <b>音频库</b>\n\n您没有保存的音频文件。\n\n上传音频文件（MP3、WAV、OGG）用于 IVR 活动。',
    audioLibTitle: (list) => `🎵 <b>音频库</b>\n\n${list}\n\n上传新音频或删除现有音频：`,
    audioUploadPrompt: '🎵 <b>上传音频</b>\n\n发送音频文件（MP3、WAV、OGG）或语音消息。\n\n将保存到您的库中用于 IVR 活动。',
    audioSaved: (name) => `✅ 音频已保存：<b>${name}</b>\n\n现在可以在批量呼叫活动中使用！`,
    audioDeleted: (name) => `✅ 已删除：<b>${name}</b>`,
    audioNamePrompt: () => '✅ 收到音频！\n\n请命名：',
    audioNamePromptLib: (size) => `✅ 收到音频！（${size} KB）\n\n为您的库命名：`,
    audioLibEmptyShort: '🎵 <b>音频库</b>\n\n没有音频文件。上传一个开始。',
    vmRingPrompt: '电话应响铃多长时间后转到语音信箱？',
    enterValidUrl: '请输入有效的 URL，以 http:// 或 https:// 开头。',
    enterAddress: (countryName, addrText) => `✅ 已收到付款！\n\n📍 <b>${countryName}</b> 需要账单地址才能激活号码。\n地址 ${addrText || '必填'}。\n\n请输入您的地址：\n<code>街道, 城市, 国家</code>\n\n<i>示例：中山路123号, 上海, 中国</i>`,
    invalidAddress: '⚠️ 请至少输入：<code>街道, 城市, 国家</code>\n\n<i>示例：中山路123号, 上海, 中国</i>',
    bulkUploadLeads: (phone) => `📱 来电显示：<b>${phone}</b>\n\n📋 <b>上传线索</b>\n\n发送文件（.txt 或 .csv），每行一个号码。\n可选：<code>号码,姓名</code>\n\n或直接粘贴号码（每行一个）：`,
    bulkLeadsLoaded: (count, preview, more, errNote) => `✅ <b>已加载 ${count} 条线索！</b>\n\n${preview}${more}${errNote}\n\n🎵 <b>选择 IVR 音频</b>\n\n从库中选择、上传新文件或使用 TTS 生成：`,
    bulkTtsHint: '💡 要使用 TTS，请先通过 <b>📢 IVR 外呼</b> 生成音频，或上传预录音频。\n\n从库中选择或上传新文件：',
    bulkAudioSelected: (name) => `🎵 音频：<b>${name}</b>\n\n📋 <b>活动模式</b>\n\n🔗 <b>转接 + 报告</b> — 线索按 1 时桥接到您的 SIP/电话 + 报告\n📊 <b>仅报告</b> — 仅追踪 + 报告\n\n两种模式均报告完整结果。`,
    bulkAudioSavedMode: (name) => `✅ 已保存：<b>${name}</b>\n\n📋 <b>活动模式</b>\n\n🔗 <b>转接 + 报告</b> — 按 1 桥接到您的电话\n📊 <b>仅报告</b> — 仅追踪\n\n两种模式均报告完整结果。`,
    bulkTransferPrompt: '🔗 <b>转接模式</b>\n\n输入线索按 1 时转接到的号码：\n<i>（您的 SIP 号码或任何电话号码）</i>',
    bulkConcurrency: (transferTo) => `${transferTo ? `🔗 转接到：<b>${transferTo}</b>\n\n` : '📊 <b>仅报告</b> — 不转接。\n\n'}⚡ <b>并发设置</b>\n\n同时拨打多少通电话？（1-20）\n默认：<b>10</b>`,
    bulkRunning: '活动正在运行！您将看到进度更新。\n\n点击 <b>🛑 停止</b> 取消。',
    bulkCancelled: '🛑 <b>活动已取消。</b>\n\n进行中的通话将完成，不会发起新通话。',
    btnUploadAudio: '📎 上传音频',
    btnConfirm: '✅ 确认',
    btnChangeVoice: '🎤 更换语音',
    btnTransferReport: '🔗 转接 + 报告',
    btnReportOnly: '📊 仅报告',
    btnStopCampaign: '🛑 停止活动',
    btnShowStatus: '📊 显示状态',
    btnUploadNewAudio: '📎 上传新音频',
    btnBack: '↩️ 返回',
  },
  hi: {
    hubWelcome: `📞 <b>CloudPhone</b> <i>Speechcue द्वारा</i>

30 से अधिक देशों में वर्चुअल नंबर प्राप्त करें — 2 मिनट से भी कम में।

📞 कॉल अपने असली फ़ोन पर फ़ॉरवर्ड करें
💬 टेलीग्राम में सीधे SMS प्राप्त करें
🌐 ब्राउज़र में कॉल करें और प्राप्त करें — कोई ऐप नहीं चाहिए
🤖 IVR ऑटो-अटेंडेंट सेट करें
🔗 SIP सॉफ्टफोन से कनेक्ट करें

प्लान <b>$${PHONE_STARTER_PRICE}/माह</b> से शुरू, ${plans.starter.minutes} मिनट + ${plans.starter.sms} SMS शामिल।

एक विकल्प चुनें:`,
    selectCountry: '📍 अपने नए नंबर के लिए देश चुनें:',
    searching: '🔍 उपलब्ध नंबर खोज रहे हैं...',
    noSearchResults: '❌ कोई नंबर उपलब्ध नहीं। कोई और क्षेत्र या देश आज़माएं।',
    noNumbers: '📱 आपके पास अभी तक कोई फ़ोन नंबर नहीं है।\n\nअपना पहला वर्चुअल नंबर पाने के लिए नीचे टैप करें।',
    enterEmail: 'SMS प्राप्त करने के लिए ईमेल पता दर्ज करें:',
    enterWebhook: 'अपना Webhook URL दर्ज करें (SMS JSON में भेजा जाएगा):',
    ivrTrialUsed: (buyLabel) => `📢 <b>IVR आउटबाउंड कॉल</b>\n\nआपने अपना मुफ्त ट्रायल कॉल पहले ही उपयोग कर लिया है।\n\nCloud Phone की सदस्यता लें और अपनी Caller ID से असीमित IVR कॉल करें!\n\n<b>${buyLabel}</b> पर टैप करें।`,
    ivrTrialOffer: (callerId) => `📢 <b>IVR आउटबाउंड कॉल — मुफ्त ट्रायल</b>\n\n🎁 आपके पास <b>1 मुफ्त ट्रायल कॉल है!</b>\n📱 Caller ID: <b>${callerId}</b> (साझा)\n\nकॉल करने के लिए फ़ोन नंबर दर्ज करें (देश कोड के साथ):\n<i>उदाहरण: +919876543210</i>`,
    ivrSelectCallerId: '📢 <b>IVR आउटबाउंड कॉल</b>\n\nकॉल करने के लिए नंबर चुनें (Caller ID):',
    ivrEnterNumber: (phone) => `📱 Caller ID: <b>${phone}</b>\n\nकॉल करने के लिए फ़ोन नंबर दर्ज करें (देश कोड के साथ):\n<i>उदाहरण: +919876543210</i>`,
    ivrFoundCnam: (name) => `📋 मिला: <b>${name}</b>`,
    ivrSelectCategory: (number) => `📞 लक्ष्य: <b>${number}</b>\n\nIVR टेम्पलेट श्रेणी चुनें:`,
    ivrCustomScript: '✍️ <b>कस्टम स्क्रिप्ट</b>\n\nअपना IVR संदेश टाइप करें। वेरिएबल के लिए <b>[कोष्ठक]</b> का उपयोग करें:\n\n<i>उदाहरण: नमस्ते [नाम]। यह [कंपनी] है। $[राशि] का भुगतान चार्ज हुआ। विवाद के लिए 1 दबाएं।</i>\n\nअपनी स्क्रिप्ट टाइप करें:',
    ivrEnterValue: (ph) => `<b>[${ph}]</b> का मान दर्ज करें:`,
    ivrValueSaved: (name, value, nextPh) => `✅ ${name}: <b>${value}</b>\n\n<b>[${nextPh}]</b> का मान दर्ज करें:`,
    ivrSelectVoiceProvider: '🎙 <b>वॉइस प्रोवाइडर चुनें</b>\n\nTTS इंजन चुनें:',
    ivrSelectVoice: '🎤 <b>आवाज़ चुनें</b>\n\nIVR ऑडियो के लिए आवाज़ चुनें:',
    ivrGeneratingPreview: (voice) => `🎤 आवाज़: <b>${voice}</b>\n\n⏳ ऑडियो प्रीव्यू बनाया जा रहा है...`,
    ivrHoldMusicStatus: (on) => `🎵 होल्ड म्यूज़िक: <b>${on ? 'चालू' : 'बंद'}</b>\n${on ? 'लक्ष्य को "कृपया प्रतीक्षा करें" + संगीत सुनाई देगा।' : 'लक्ष्य को स्टैंडर्ड रिंगबैक सुनाई देगी।'}`,
    ivrConfirmPrompt: '<b>✅ पुष्टि करें</b> जारी रखने के लिए, <b>🎤 आवाज़ बदलें</b>, या <b>वापस</b>।',
    ivrTemplatePreview: (icon, name, text, keys) => `📋 <b>${icon} ${name}</b>\n\n<i>"${text}"</i>\n\n🔘 सक्रिय कुंजियाँ: <b>${keys}</b>`,
    bulkCallNoPlan: (buyLabel) => `📞 <b>बल्क कॉल अभियान</b>\n\n🔒 इस सुविधा के लिए <b>Pro</b> या उससे ऊपर का प्लान चाहिए।\n\nपहले Cloud Phone नंबर लें!\n\n<b>${buyLabel}</b> पर टैप करें।`,
    bulkCallNoNumber: (buyLabel) => `📞 <b>बल्क कॉल अभियान</b>\n\nआपको ☎️ बल्क IVR सक्षम नंबर चाहिए।\n\n<b>${buyLabel}</b> पर टैप करें और ☎️ बैज वाला नंबर चुनें।`,
    bulkCallSelect: '📞 <b>बल्क कॉल अभियान</b>\n\nएकाधिक लीड्स पर ऑटोमेटेड IVR कॉल लॉन्च करें।\n\n☎️ = बल्क IVR सक्षम नंबर\n\n📱 Caller ID चुनें:',
    audioLibEmpty: '🎵 <b>ऑडियो लाइब्रेरी</b>\n\nकोई ऑडियो फ़ाइल नहीं।\n\nIVR अभियानों के लिए ऑडियो फ़ाइल (MP3, WAV, OGG) अपलोड करें।',
    audioLibTitle: (list) => `🎵 <b>ऑडियो लाइब्रेरी</b>\n\n${list}\n\nनया अपलोड करें या मौजूदा हटाएं:`,
    audioUploadPrompt: '🎵 <b>ऑडियो अपलोड</b>\n\nमुझे ऑडियो फ़ाइल (MP3, WAV, OGG) या वॉइस मैसेज भेजें।\n\nIVR अभियानों के लिए आपकी लाइब्रेरी में सेव होगी।',
    audioSaved: (name) => `✅ ऑडियो सेव: <b>${name}</b>\n\nअब आप इसे बल्क कॉल अभियानों में उपयोग कर सकते हैं!`,
    audioDeleted: (name) => `✅ हटाया गया: <b>${name}</b>`,
    audioNamePrompt: () => '✅ ऑडियो प्राप्त!\n\nइसे एक नाम दें:',
    audioNamePromptLib: (size) => `✅ ऑडियो प्राप्त! (${size} KB)\n\nलाइब्रेरी के लिए नाम दें:`,
    audioLibEmptyShort: '🎵 <b>ऑडियो लाइब्रेरी</b>\n\nकोई ऑडियो नहीं। शुरू करने के लिए अपलोड करें।',
    vmRingPrompt: 'वॉइसमेल से पहले फ़ोन कितनी देर बजे?',
    enterValidUrl: 'कृपया http:// या https:// से शुरू होने वाला मान्य URL दर्ज करें।',
    enterAddress: (countryName, addrText) => `✅ भुगतान प्राप्त!\n\n📍 <b>${countryName}</b> में नंबर सक्रिय करने के लिए बिलिंग पता आवश्यक है।\nपता ${addrText || 'आवश्यक'}।\n\nकृपया अपना पता दर्ज करें:\n<code>सड़क, शहर, देश</code>\n\n<i>उदाहरण: 123 मुख्य सड़क, मुंबई, भारत</i>`,
    invalidAddress: '⚠️ कृपया कम से कम दर्ज करें: <code>सड़क, शहर, देश</code>\n\n<i>उदाहरण: 123 मुख्य सड़क, मुंबई, भारत</i>',
    bulkUploadLeads: (phone) => `📱 Caller ID: <b>${phone}</b>\n\n📋 <b>लीड्स अपलोड</b>\n\nएक फ़ाइल (.txt या .csv) भेजें, प्रति पंक्ति एक नंबर।\nवैकल्पिक: <code>नंबर,नाम</code>\n\nया सीधे नंबर पेस्ट करें (प्रति पंक्ति एक):`,
    bulkLeadsLoaded: (count, preview, more, errNote) => `✅ <b>${count} लीड्स लोड!</b>\n\n${preview}${more}${errNote}\n\n🎵 <b>IVR ऑडियो चुनें</b>\n\nलाइब्रेरी से चुनें, नया अपलोड करें, या TTS से बनाएं:`,
    bulkTtsHint: '💡 TTS उपयोग करने के लिए, पहले <b>📢 IVR आउटबाउंड कॉल</b> से ऑडियो बनाएं, या प्री-रिकॉर्डेड अपलोड करें।\n\nलाइब्रेरी से चुनें या अपलोड करें:',
    bulkAudioSelected: (name) => `🎵 ऑडियो: <b>${name}</b>\n\n📋 <b>अभियान मोड</b>\n\n🔗 <b>ट्रांसफर + रिपोर्ट</b> — लीड 1 दबाए तो SIP/फ़ोन पर ब्रिज + रिपोर्ट\n📊 <b>केवल रिपोर्ट</b> — ट्रैकिंग + रिपोर्ट\n\nदोनों मोड पूर्ण परिणाम रिपोर्ट करते हैं।`,
    bulkAudioSavedMode: (name) => `✅ सेव: <b>${name}</b>\n\n📋 <b>अभियान मोड</b>\n\n🔗 <b>ट्रांसफर + रिपोर्ट</b> — 1 दबाने पर आपके फ़ोन पर ब्रिज\n📊 <b>केवल रिपोर्ट</b> — ट्रैकिंग\n\nदोनों मोड रिपोर्ट करते हैं।`,
    bulkTransferPrompt: '🔗 <b>ट्रांसफर मोड</b>\n\nलीड 1 दबाए तो कॉल ट्रांसफर के लिए नंबर दर्ज करें:\n<i>(आपका SIP या कोई भी फ़ोन नंबर)</i>',
    bulkConcurrency: (transferTo) => `${transferTo ? `🔗 ट्रांसफर: <b>${transferTo}</b>\n\n` : '📊 <b>केवल रिपोर्ट</b> — कोई ट्रांसफर नहीं।\n\n'}⚡ <b>कॉनकरेंसी</b>\n\nएक साथ कितने कॉल? (1-20)\nडिफ़ॉल्ट: <b>10</b>`,
    bulkRunning: 'अभियान चल रहा है! आपको यहाँ अपडेट दिखेंगे।\n\n<b>🛑 रोकें</b> पर टैप करें।',
    bulkCancelled: '🛑 <b>अभियान रद्द।</b>\n\nसक्रिय कॉल पूरे होंगे, नए कॉल नहीं होंगे।',
    btnUploadAudio: '📎 ऑडियो अपलोड',
    btnConfirm: '✅ पुष्टि करें',
    btnChangeVoice: '🎤 आवाज़ बदलें',
    btnTransferReport: '🔗 ट्रांसफर + रिपोर्ट',
    btnReportOnly: '📊 केवल रिपोर्ट',
    btnStopCampaign: '🛑 अभियान रोकें',
    btnShowStatus: '📊 स्थिति दिखाएं',
    btnUploadNewAudio: '📎 नया अपलोड',
    btnBack: '↩️ वापस',
  },
}

/** Get translated txt object for a language (falls back to English for missing keys) */
function getTxt(lang) {
  if (!lang || lang === 'en') return txt
  const translations = txtI18n[lang]
  if (!translations) return txt
  // Return a proxy-like merged object: translated values override English
  return new Proxy(txt, {
    get(target, prop) {
      if (translations.hasOwnProperty(prop)) return translations[prop]
      return target[prop]
    }
  })
}

function getMsg(lang) {
  return msg[lang] || msg.en
}

module.exports = {
  btn,
  txt,
  msg,
  getMsg,
  getBtn,
  getTxt,
  getBtnLabel,
  isBtnMatch,
  btnKeyOf,
  plans,
  planByButton,
  planFeatureAccess,
  canAccessFeature,
  upgradeMessage,
  isPlanAvailable,
  comingSoonText,
  planAvailability,
  countries,
  twilioCountries,
  allCountries,
  moreCountries,
  countryByName,
  usAreaCodes,
  areaByLabel,
  formatPhone,
  formatDuration,
  shortDate,
  generateSipUsername,
  generateSipPassword,
  PHONE_STARTER_PRICE,
  PHONE_PRO_PRICE,
  PHONE_BUSINESS_PRICE,
  SIP_DOMAIN,
  getSipDomainForNumber,
  OVERAGE_RATE_SMS,
  OVERAGE_RATE_MIN,
  CALL_FORWARDING_RATE_MIN,
  BLOCKED_FORWARDING_PREFIXES,
  isBlockedPrefix,
}
