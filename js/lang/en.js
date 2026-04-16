const { areasOfCountry, carriersOf, countryCodeOf } = require('../areasOfCountry')

const format = (cc, n) => `+${cc}(${n.toString().padStart(2, '0')})`

/* global process */
require('dotenv').config()
const HIDE_BANK_PAYMENT = process.env.HIDE_BANK_PAYMENT
const SELF_URL = process.env.SELF_URL
const FREE_LINKS = Number(process.env.FREE_LINKS)
const SUPPORT_USERNAME = process.env.SUPPORT_USERNAME

const HIDE_SMS_APP = process.env.HIDE_SMS_APP
const HIDE_BECOME_RESELLER = process.env.HIDE_BECOME_RESELLER
const HIDE_BUNDLES = process.env.HIDE_BUNDLES
const EMAIL_BLAST_ON = process.env.EMAIL_BLAST_ON
const VPS_ENABLED = process.env.VPS_ENABLED
const TG_HANDLE = process.env.TG_HANDLE
const TG_CHANNEL = process.env.TG_CHANNEL
const SMS_APP_NAME = process.env.SMS_APP_NAME
const SMS_APP_LINK = process.env.SMS_APP_LINK
const CHAT_BOT_NAME = process.env.CHAT_BOT_NAME
const CHAT_BOT_BRAND = process.env.CHAT_BOT_BRAND
const SUPPORT_HANDLE = process.env.SUPPORT_HANDLE
const APP_SUPPORT_LINK = process.env.APP_SUPPORT_LINK

const PRICE_DAILY = Number(process.env.PRICE_DAILY_SUBSCRIPTION)
const PRICE_WEEKLY = Number(process.env.PRICE_WEEKLY_SUBSCRIPTION)
const PRICE_MONTHLY = Number(process.env.PRICE_MONTHLY_SUBSCRIPTION)
const DAILY_PLAN_FREE_DOMAINS = Number(process.env.DAILY_PLAN_FREE_DOMAINS)
const WEEKLY_PLAN_FREE_DOMAINS = Number(process.env.WEEKLY_PLAN_FREE_DOMAINS)
const FREE_LINKS_HOURS = Number(process.env.FREE_LINKS_TIME_SECONDS) / 60 / 60
const MONTHLY_PLAN_FREE_DOMAINS = Number(process.env.MONTHLY_PLAN_FREE_DOMAINS)
const DAILY_PLAN_FREE_VALIDATIONS = Number(process.env.DAILY_PLAN_FREE_VALIDATIONS)
const WEEKLY_PLAN_FREE_VALIDATIONS = Number(process.env.WEEKLY_PLAN_FREE_VALIDATIONS)
const MONTHLY_PLAN_FREE_VALIDATIONS = Number(process.env.MONTHLY_PLAN_FREE_VALIDATIONS)

const PREMIUM_ANTIRED_WEEKLY_PRICE = parseFloat(process.env.PREMIUM_ANTIRED_WEEKLY_PRICE)
const PREMIUM_ANTIRED_CPANEL_PRICE = parseFloat(process.env.PREMIUM_ANTIRED_CPANEL_PRICE)
const GOLDEN_ANTIRED_CPANEL_PRICE = parseFloat(process.env.GOLDEN_ANTIRED_CPANEL_PRICE)
const VPS_HOURLY_PLAN_MINIMUM_AMOUNT_PAYABLE = parseFloat(process.env.VPS_HOURLY_PLAN_MINIMUM_AMOUNT_PAYABLE) || 50

// Digital Product Prices
const DP_PRICE_TWILIO_MAIN = Number(process.env.DP_PRICE_TWILIO_MAIN) || 450
const DP_PRICE_TWILIO_SUB = Number(process.env.DP_PRICE_TWILIO_SUB) || 200
const DP_PRICE_TELNYX_MAIN = Number(process.env.DP_PRICE_TELNYX_MAIN) || 400
const DP_PRICE_TELNYX_SUB = Number(process.env.DP_PRICE_TELNYX_SUB) || 150
const DP_PRICE_GWORKSPACE_NEW = Number(process.env.DP_PRICE_GWORKSPACE_NEW) || 100
const DP_PRICE_GWORKSPACE_AGED = Number(process.env.DP_PRICE_GWORKSPACE_AGED) || 150
const DP_PRICE_ZOHO_NEW = Number(process.env.DP_PRICE_ZOHO_NEW) || 100
const DP_PRICE_ZOHO_AGED = Number(process.env.DP_PRICE_ZOHO_AGED) || 150
const DP_PRICE_ESIM = Number(process.env.DP_PRICE_ESIM) || 60
const DP_PRICE_AWS_MAIN = Number(process.env.DP_PRICE_AWS_MAIN) || 400
const DP_PRICE_AWS_SUB = Number(process.env.DP_PRICE_AWS_SUB) || 150
const DP_PRICE_GCLOUD_MAIN = Number(process.env.DP_PRICE_GCLOUD_MAIN) || 300
const DP_PRICE_GCLOUD_SUB = Number(process.env.DP_PRICE_GCLOUD_SUB) || 300
const DP_PRICE_IONOS_SMTP = Number(process.env.DP_PRICE_IONOS_SMTP) || 150
const DP_PRICE_AIRVOICE_1M = Number(process.env.DP_PRICE_AIRVOICE_1M) || 70
const DP_PRICE_AIRVOICE_3M = Number(process.env.DP_PRICE_AIRVOICE_3M) || 120
const DP_PRICE_AIRVOICE_6M = Number(process.env.DP_PRICE_AIRVOICE_6M) || 150
const DP_PRICE_AIRVOICE_1Y = Number(process.env.DP_PRICE_AIRVOICE_1Y) || 180

const npl = {
 // New Zealand
 Spark: ['Spark'],
 Vocus: ['Vocus'],
 '2Degrees/Voyager': ['Voyager'],
 'Skinny Mobile': ['Skinny Mobile'],
 // Australia
 Telstra: ['Telstra'],
 Optus: ['Optus'],
 Vodafone: ['VODAFONE', 'Vodafone'],
 // UK
 EE: ['EE'],
 Three: ['Three'],
 'Virgin/O2': ['Virgin'],
}

const alcazar = {
 'T-mobile': ['T-MOBILE', 'OMNIPOINT', 'METROPCS', 'SPRINT', 'AERIAL'],
 'Metro PCS': ['T-MOBILE', 'OMNIPOINT', 'METROPCS', 'SPRINT', 'AERIAL'],
 Sprint: ['T-MOBILE', 'OMNIPOINT', 'METROPCS', 'SPRINT', 'AERIAL'],
 'Verizon Wireless': ['CELLCO', 'ONVOY'],
 'AT&T': ['CINGULAR'],
}

// Note: these button labels must not mix with each other, other wise it may mess up bot
const admin = {
 viewAnalytics: '📊 View Analytics',
 viewUsers: '👀 View Users',
 blockUser: '✋ Block User',
 unblockUser: '👌 Unblock User',
 messageUsers: '👋 Message all users',
 resetDead: '🗑️ Reset Dead Users',
 gift5all: '🎁 Gift $5 All Users',
}
const user = {
 // main keyboards
 cPanelWebHostingPlans: '🇷🇺 HostPanel Plans 🔒',
 pleskWebHostingPlans: '🇷🇺 Plesk Plans 🔒',
 joinChannel: '📢 Join Channel',
 buyLeads: '🎯 Buy Phone Leads',
 validateLeads: '✅ Validate Numbers',
 phoneNumberLeads: '🎯 Buy Phone Leads',
 leadsValidation: '📱 SMS Leads',
 hostingDomainsRedirect: '🛡️🔥 Anti-Red Hosting',
 wallet: '👛 Wallet',
 urlShortenerMain: '🔗 URL Shortener',
 vpsPlans: '🖥️ VPS/RDP — Port 25 Open🛡️',
 buyPlan: '⚡ Upgrade Plan',
 domainNames: '🌐 Bulletproof Domains',
 viewPlan: '📋 My Plans',
 becomeReseller: '💼 Reseller',
 getSupport: '💬 Support',
 freeTrialAvailable: '📧🆓 BulkSMS -Trial',
 smsAppMain: '📧 BulkSMS',
 smsCreateCampaign: '📱 Create Campaign',
 smsMyCampaigns: '📋 My Campaigns',
 smsDownloadApp: '📲 Download App',
 smsResetLogin: '🔓 Reset Login',
 smsHowItWorks: '❓ How It Works',
 changeSetting: '🌍 Settings',
 changeLanguage: '🌍 Change Language',
 cloudPhone: '📞 Cloud IVR + SIP',
 testSip: '🧪 Test SIP Free',
 digitalProducts: '🛒 Digital Products',
 marketplace: '🏪 Marketplace',
 shippingLabel: '📦 Ship & Mail',
 emailBlast: '📧 Email Blast',
 emailValidation: '📧 Email Validation',
 serviceBundles: '🎁 Service Bundles',
 referEarn: '🤝 Refer & Earn',

 // Sub Menu 1: urlShortenerMain
 shortenLink: '✂️ Shorten a Link',
 redSelectUrl: '🔀✂️ Redirect & Shorten',
 redBitly: '✂️ Bit.ly',
 redShortit: '✂️ Shortit (Trial)',
 urlShortener: '✂️🌐 Custom Domain Shortener',
 viewShortLinks: '📊 View Shortlink Analytics',
 activateDomainShortener: '🔗 Activate Domain for Shortener',

 // Sub Menu 6: Digital Products
 digitalProducts: '🛒 Digital Products',
 virtualCard: '💳 Virtual Card',

 // Sub Menu 2: domainNames
 buyDomainName: '🛒🌐 Buy Domain Names',
 viewDomainNames: '📂 My Domain Names',
 dnsManagement: '🔧 DNS Management',

 // Sub Menu 3: cPanel/Plesk WebHostingPlansMain
 freeTrial: '💡 Free Trial',
 premiumWeekly: '⚡ Premium Anti-Red (1-Week)',
 premiumCpanel: '🔷 Premium Anti-Red HostPanel (30 Days)',
 goldenCpanel: '👑 Golden Anti-Red HostPanel (30 Days)',
 contactSupport: '📞 Contact Support',

 // Sub Menu 4: VPS Plans
 buyVpsPlan: '⚙️ Create New VPS',
 manageVpsPlan: '🖥️ View/Manage VPS',
 manageVpsSSH: '🔑 SSH Keys',

 // Free Trial
 freeTrialMenuButton: '🚀 Free Trial (12 Hours)',
 getFreeTrialPlanNow: '🛒 Get Trial Plan Now',
 continueWithDomainNameSBS: websiteName => `➡️ Continue with ${websiteName}`,
 searchAnotherDomain: `🔍 Search Another Domain`,
 privHostNS: `🏢 PrivHost (Fast & Secure Hosting)`,
 cloudflareNS: `🛡️ Cloudflare Shield (Security & Stealth)`,
 backToFreeTrial: '⬅️ Back To Free Trial',

 // Paid Plans
 buyPremiumWeekly: '🛒 Buy Premium Anti-Red (1-Week)',
 buyPremiumCpanel: '🛒 Buy Premium Anti-Red HostPanel',
 buyGoldenCpanel: '🛒 Buy Golden Anti-Red HostPanel',
 viewPremiumWeekly: '⚡ View Premium Weekly',
 viewPremiumCpanel: '🔷 View Premium HostPanel',
 viewGoldenCpanel: '👑 View Golden HostPanel',
 backToHostingPlans: '⬅️ Back To Hosting Plans',
 registerANewDomain: '🌐 Register a New Domain',
 useMyDomain: '📂 Use My Domain',
 connectExternalDomain: '🔗 Connect External Domain',
 useExistingDomain: '🔄 Use Existing Domain',
 backToPremiumWeeklyDetails: '⬅️ Back to Premium Weekly Details',
 backToPremiumCpanelDetails: '⬅️ Back to Premium HostPanel Details',
 backToGoldenCpanelDetails: '⬅️ Back to Golden HostPanel Details',
 continueWithDomain: websiteName => `➡️ Continue with ${websiteName}`,
 enterAnotherDomain: '🔍 Enter Another Domain',
 backToPurchaseOptions: '⬅️ Back to Purchase Options',
 myHostingPlans: '📋 My Hosting Plans',
 revealCredentials: '🔑 Show Credentials',
 renewHostingPlan: '🔄 Renew Now',
 upgradeHostingPlan: '⬆️ Upgrade Plan',
 confirmRenewNow: '✅ Confirm & Pay',
 cancelRenewNow: '❌ Cancel',
 toggleAutoRenew: '🔁 Toggle Auto-Renew',
 backToMyHostingPlans: '⬅️ Back to My Plans',
}
const u = {
 // other key boards
 deposit: '➕💵 Deposit',
 withdraw: '➖💵 Withdraw',
 myTier: '🏆 My Tier',
 txHistory: '📜 Transactions',

 // wallet
 usd: 'USD',
 ngn: 'NGN',

 // deposit methods
 depositBank: '🏦 Bank (Naira)',
 depositCrypto: '₿ Crypto',
}
const view = num => Number(num).toFixed(2)
const yesNo = ['Yes', 'No']

const bal = (usd) => `$${view(usd)}`

const dnsEntryFormat = '' // deprecated — A/CNAME now use multi-step wizard

const dnsQuickActions = {
 pointToIp: 'Point Domain to IP',
 googleEmail: 'Setup Google Email',
 zohoEmail: 'Setup Zoho Email',
 verification: 'Domain Verification (TXT)',
 addSubdomain: 'Add Subdomain',
}

const t = {
 yes: 'Yes',
 no: 'No',
 back: 'Back',
 cancel: 'Cancel',
 skip: 'Skip',
 becomeReseller: (() => {
 const services = ['URL Shortening', 'Domain Registration']
 if (process.env.PHONE_SERVICE_ON === 'true') services.push('Cloud IVR')
 if (HIDE_SMS_APP !== 'true') services.push('BulkSMS')
 if (process.env.OFFSHORE_HOSTING_ON !== 'false') services.push('Anti-Red Hosting')
 return `<b>Become a ${CHAT_BOT_BRAND} Reseller</b>

Resell our full suite — ${services.join(', ')} — under your brand.

<b>65/35%</b> profit share on every sale. Tap 💬 <b>Get Support</b> to get started.`
 })(),
 resetLoginAdmit: `✅ Logged out of previous device. Please log in now.`,
 resetLoginDeny: 'Ok sure. No further action required.',
 resetLogin: `${CHAT_BOT_BRAND}SMS: Are you trying to log out of your previous device?`,
 select: `Please select an option:`,
 urlShortenerSelect: `Shorten, brand, or track your links:`,

 // cPanel/Plesk Plans initial select plan text
 selectPlan: `Please select a plan:`,
 backButton: '⬅️ Back',
 yesProceedWithThisEmail: email => `Proceed with ${email}`,
 skipEmail: 'Skip (no email)',
 proceedWithPayment: 'Proceed with Payment',
 iHaveSentThePayment: `✅ Check Payment Status`,
 // Free Plan
 trialAlreadyUsed: `Free trial already used. Subscribe to continue with premium features.`,
 oneHourLeftToExpireTrialPlan: `⏰ Your Freedom Plan expires in 1 hour. Upgrade to continue!`,
 freePlanExpired: `🚫 Your Freedom Plan has expired. We hope you enjoyed your trial,
To continue using our services, please buy one of our premium plans.`,
 freeTrialPlanSelected: hostingType => `
<b>Freedom Plan</b> — Free for 12 hours

1 GB SSD · 10 GB Bandwidth · 1 .sbs Domain
1 Email · 1 MySQL DB · Free SSL · HostPanel Access

Enter a .sbs domain to get started.`,
 getFreeTrialPlan: `Enter your desired domain (e.g., example.sbs). Free .sbs domain included.`,
 trialPlanContinueWithDomainNameSBSMatched: websiteName => `<b>${websiteName}</b> is available.`,
 trialPlanSBSDomainNotMatched: `Domain not found. Try a different .sbs domain.`,
 trialPlanSBSDomainIsPremium: `Premium domain — only available with paid plans. Try another.`,
 trialPlanGetNowInvalidDomain: `Enter a valid .sbs domain (e.g., example.sbs).`,
 trialPlanNameserverSelection: websiteName =>
 `Select nameserver provider for <b>${websiteName}</b>`,
 trialPlanDomainNameMatched: `Enter your email for account setup.`,
 confirmEmailBeforeProceedingSBS: email =>
 `Are you sure you want to proceed with this ${email} email for the Freedom Plan subscription?`,
 trialPlanInValidEmail: 'Please provide a valid email',
 trialPlanActivationConfirmation: `✅ Free trial activating now. Valid for 12 hours.`,
 trialPlanActivationInProgress: `Your free trial plan is being activated. This may take a few moments…`,

 what: `That option isn't available right now. Please pick from the buttons below, or type /start to see the full menu.`,
 whatNum: `That doesn't look right. Please enter a valid number.`,
 phoneGenTimeout: 'Timeout',
 phoneGenNoGoodHits: `Please tap 💬 Get Support or select another area code`,

 subscribeRCS: p =>
 `Subscribed! Unsubscribe anytime by clicking the <a href="${SELF_URL}/unsubscribe?a=b&Phone=${p}">link</a>`,
 unsubscribeRCS: p =>
 `You are unsubscribed! To subscribe again click on the <a href="${SELF_URL}/subscribe?a=b&Phone=${p}">link</a>`,
 argsErr: `dev: sent wrong args`,
 showDepositNgnInfo:
 ngn => `Please remit ${ngn} NGN by clicking “Make Payment” below. Once the transaction has been confirmed, you will be promptly notified, and your wallet will be updated.

Best regards,
${CHAT_BOT_NAME}`,

 askEmail: `Please provide an email for payment confirmation.`,
 askEmailForNGN: `Please provide an email for payment confirmation.`,
 askValidAmount: 'Please enter a valid amount.',
 askValidEmail: 'Please provide a valid email',
 askValidCrypto: 'Please choose a valid crypto currency',
 askValidPayOption: 'Please choose a valid payment option',
 chooseSubscription:
 HIDE_SMS_APP === 'true'
 ? `<b>Choose Your Plan</b>

✅ <b>All plans include:</b>
🔗 Unlimited URL shortening
🌐 Free 
📱 Phone number validations with owner names
📞 Cloud IVR access

<b>Daily</b> — $${PRICE_DAILY}
${DAILY_PLAN_FREE_DOMAINS} domain · ${DAILY_PLAN_FREE_VALIDATIONS.toLocaleString()} validations with phone owner names · Unlimited links

<b>Weekly</b> — $${PRICE_WEEKLY}
${WEEKLY_PLAN_FREE_DOMAINS} domains · ${WEEKLY_PLAN_FREE_VALIDATIONS.toLocaleString()} validations with phone owner names · Unlimited links

<b>Monthly</b> — $${PRICE_MONTHLY}
${MONTHLY_PLAN_FREE_DOMAINS} domains · ${MONTHLY_PLAN_FREE_VALIDATIONS.toLocaleString()} validations with phone owner names · Unlimited links

<i>All plans include free + unlimited URL shortening + phone owner names on all USA validations.</i>`
 : `<b>Choose Your Plan</b>

✅ <b>All plans include:</b>
🔗 Unlimited URL shortening
🌐 Free 
📱 Phone validations with owner names
📧 BulkSMS campaigns
📞 Cloud IVR access

<b>Daily</b> — $${PRICE_DAILY}
${DAILY_PLAN_FREE_DOMAINS} domain · ${DAILY_PLAN_FREE_VALIDATIONS.toLocaleString()} validations · Unlimited links + BulkSMS (3 devices)

<b>Weekly</b> — $${PRICE_WEEKLY}
${WEEKLY_PLAN_FREE_DOMAINS} domains · ${WEEKLY_PLAN_FREE_VALIDATIONS.toLocaleString()} validations · Unlimited links + BulkSMS (10 devices)

<b>Monthly</b> — $${PRICE_MONTHLY}
${MONTHLY_PLAN_FREE_DOMAINS} domains · ${MONTHLY_PLAN_FREE_VALIDATIONS.toLocaleString()} validations · Unlimited links + BulkSMS (unlimited devices)

<i>All plans include free + unlimited URL shortening + phone owner names on all USA validations.</i>`,

 askCoupon: usd =>
 `The price is $${usd}. Would you like to apply a coupon code? If you have one, please enter it now. Otherwise, you can press 'Skip'.`,
 planAskCoupon: `Would you like to apply a coupon code? If you have one, please enter it now. Otherwise, you can press 'Skip'.`,
 enterCoupon: `Please enter a coupon code:`,
 planPrice: (plan, price) => `Price of ${plan} subscription is $${price} Please choose payment method.`,
 planNewPrice: (plan, price, newPrice) =>
 `Price of ${plan} subscription is now $${view(newPrice)} <s>($${price})</s> Please choose payment method.`,

 domainPrice: (domain, price) => `Price of ${domain} is ${price} USD. Choose payment method.`,
 domainNewPrice: (domain, price, newPrice) =>
 `Price of ${domain} is now $${view(newPrice)} <s>($${price})</s> Choose payment method.`,

 couponInvalid: `Invalid coupon code, Please enter your coupon code again:`,

 lowPrice: `Sent price less than needed`,

 freeTrialAvailable: (chatId) => `📱 <b>BulkSMS Free Trial — 100 Free SMS</b>\n\nYour activation code:\n<code>${chatId}</code>\n\n📲 <b>Download the app:</b> ${SMS_APP_LINK}\n\nOpen the app → Enter your code → Start sending!\n\n⚡ Trial: 1 device only.\n\n💡 After trial, tap <b>⚡ Upgrade Plan</b> on the main menu to unlock unlimited BulkSMS + URL shortening + validations & more!\n\nNeed eSIM cards? Tap 💬 Get Support`,

 freeTrialNotAvailable: 'You have already used the free trial.\n\nTap <b>⚡ Upgrade Plan</b> to subscribe — includes unlimited BulkSMS, URL shortening, validations, free domains & more!',

 smsAppMenuSubscribed: (chatId) => `📧 <b>BulkSMS — Active ✅</b>\n\nSends SMS from your phone's SIM — high deliverability, real sender ID.\n\n📲 <b>App:</b> ${SMS_APP_LINK}\n🔑 <b>Code:</b> <code>${chatId}</code>\n\nCreate campaigns below or in the app.\nNew here? Tap <b>❓ How It Works</b>`,
 smsAppMenuTrial: (chatId, remaining) => `📧 <b>BulkSMS — Free Trial</b> (${remaining} SMS left)\n\nSends SMS from your phone's SIM — high deliverability, real sender ID.\n\n📲 <b>App:</b> ${SMS_APP_LINK}\n🔑 <b>Code:</b> <code>${chatId}</code>\n\nNew here? Tap <b>❓ How It Works</b>`,
 smsAppMenuExpired: `📧 <b>BulkSMS</b>\n\nYour trial has ended. Tap <b>⚡ Upgrade Plan</b> to continue sending.\n\nNew here? Tap <b>❓ How It Works</b> to learn how BulkSMS works.`,

 smsHowItWorks: (chatId) => `📧 <b>BulkSMS — How It Works</b>\n\nBulkSMS sends real SMS <b>from your phone's SIM card</b> — not a server. This gives you high deliverability and a real sender ID.\n\n<b>⚙️ One-time setup:</b>\n1. Download the app → ${SMS_APP_LINK}\n2. Open it → enter code: <code>${chatId}</code>\n3. Grant SMS permission when prompted\n\n<b>📤 Sending a campaign:</b>\n• Tap <b>📱 Create Campaign</b> here or create in the app\n• Add your message + contacts (paste or upload file)\n• Campaign syncs to the app → tap Send on your phone\n\n<b>💡 Tips:</b>\n• Use an <b>eSIM</b> for a dedicated sending line\n• Separate messages with <code>---</code> on its own line for rotation\n• <code>[name]</code> in your message = auto-personalization\n• Schedule campaigns for later or send immediately\n\n<b>📋 My Campaigns</b> shows all your campaigns + status.\n<b>🔓 Reset Login</b> lets you switch to a new device.\n\nNeed eSIM? Tap 💬 Support`,

 smsCreateCampaignIntro: `📱 <b>Create SMS Campaign</b>\n\nHere's how it works:\n\n<b>Step 1:</b> Name your campaign\n<b>Step 2:</b> Write your message(s)\n • Use <code>[name]</code> to personalize\n • Multiple lines = message rotation\n<b>Step 3:</b> Upload contacts\n • Paste as text: <code>+1234567890, John</code>\n • Or upload a .txt / .csv file\n<b>Step 4:</b> Set SMS gap time (delay between sends)\n<b>Step 5:</b> Review & confirm — send, schedule, or save as draft\n\nThe campaign syncs to the Nomadly SMS App for sending.\n\n<b>Let's start — enter a campaign name:</b>`,

 smsSchedulePrompt: '⏰ <b>Schedule Campaign?</b>\n\nChoose when to make this campaign available:',
 smsSendNow: '▶️ Send Now',
 smsScheduleLater: '⏰ Schedule for Later',
 smsScheduleTimePrompt: '📅 <b>Enter schedule date & time</b>\n\nFormat: <code>YYYY-MM-DD HH:MM</code>\n(UTC timezone)\n\nExample: <code>2025-07-15 09:30</code>',

 smsSaveDraft: '💾 Save Draft',
 smsDefaultGap: '⏱ Default (5 sec)',
 smsGapTimePrompt: '⏱ <b>Delay Between Messages</b>\n\nHow many seconds to wait between each SMS?\n\n• Default: <b>5 seconds</b>\n• Range: 1–300 seconds\n\nType a number or tap the button for default:',

 smsMyCampaignsEmpty: '📋 <b>My Campaigns</b>\n\nYou have no campaigns yet. Tap <b>📱 Create Campaign</b> to get started!',
 smsMyCampaignsList: (campaigns) => {
 const statusIcons = { draft: '📝', sending: '📤', completed: '✅', paused: '⏸', scheduled: '📅' }
 const lines = campaigns.slice(0, 10).map((c, i) =>
 `${i + 1}. ${statusIcons[c.status] || '📋'} <b>${c.name}</b>\n ${c.sentCount}/${c.totalCount} sent · ${c.status}`
 )
 return `📋 <b>My Campaigns</b>\n\n${lines.join('\n\n')}\n\n<i>Manage campaigns in the Nomadly SMS App.</i>`
 },

 planSubscribed:
 HIDE_SMS_APP === 'true'
 ? `✅ Subscribed to {{plan}} Plan!

Included:
• Free 
• Unlimited Shortit links
• USA phone validation

Need E-sim? Tap 💬 Support`
 : `✅ Subscribed to {{plan}} Plan!

Included:
• Free 
• Unlimited Shortit links
• USA phone validation
• ${SMS_APP_NAME} app

📱 Device access:
 Daily — 3 devices
 Weekly — 10 devices
 Monthly — Unlimited devices

📲 Download: ${SMS_APP_LINK}
💬 Get E-sim: Tap Support
🔓 Switch device: /resetlogin`,

 alreadySubscribedPlan: days => `Your subscription is active and expires in ${days}`,

 payError: `❌ Payment session expired. Please try again or tap 💬 Support.`,

 chooseFreeDomainText: `<b>Great News!</b> This domain is available for free with your subscription. Would you like to claim it?`,

 chooseDomainToBuy: text =>
 `<b>🌐 Domain Registration</b>

💰 <b>Pricing starts from $30/year</b>
Exact price depends on domain extension and availability.

<b>📝 Enter your desired domain name</b>
Example: <code>mysite.com</code>

We'll check availability and show you the exact price instantly.${text}`,
 askDomainToUseWithShortener: `Use this domain as a <b>custom URL shortener</b>?\n\n<b>Yes</b> — Auto-configure DNS. Short links become <code>yourdomain.com/abc</code>.\n\n<b>No</b> — Register only. Enable shortener anytime from Manage Domains.`,
 blockUser: `Please share the username of the user that needs to be blocked.`,
 unblockUser: `Please share the username of the user that needs to be unblocked.`,
 blockedUser: `You are currently blocked from using the bot. Please tap 💬 Get Support. Discover more ${TG_HANDLE}.`,

 greet: `${CHAT_BOT_BRAND} — URL shortener, domains, phone leads & more.

🎁 ${FREE_LINKS} free trial links — /start
💬 Support: Tap Get Support`,

 linkExpired: `This short link has expired and is no longer active. Please contact us for any queries.
Best,
${CHAT_BOT_BRAND} Team
Discover more: ${TG_CHANNEL}`,

 successPayment: `Payment Processed Successfully! You can now close this window.`,

 welcome: `Thank you for choosing ${CHAT_BOT_NAME}! Please choose an option below:`,
 welcomeFreeTrial: `Welcome! 🎉

You have ${FREE_LINKS} free Shortit links.

Subscribe for:
• Unlimited URL shortening
• Free 
• USA phone validation

Tap below to get started! ⬇️`,

 unknownCommand: `Command not found. Press /start or tap 💬 Get Support. Discover more ${TG_HANDLE}.`,

 support: `Need help? Tap 💬 Get Support to chat with us. Discover more ${TG_HANDLE}.`,

 joinChannel: `Please Join Channel ${TG_CHANNEL}`,

 dnsPropagated: `DNS Propagation for {{domain}} is completed. You can now use it for URL Shortening.`,

 dnsNotPropagated: `DNS propagation for {{domain}} is in progress and you will be updated once it completes. ✅`,

 domainBoughtSuccess: domain => `Domain ${domain} is now yours. Thank you for choosing us.

Best,
${CHAT_BOT_NAME}`,

 domainBought: `Your domain {{domain}} is now linked to your account while DNS propagates. You will be updated automatically about the status momentarily.🚀`,

 domainLinking: domain =>
 `Linking domain with your account. Please note that DNS updates can take up to 30 minutes. You can check your DNS update status here: https://www.whatsmydns.net/#A/${domain}`,

 errorSavingDomain: `Error saving domain in server, tap 💬 Get Support. Discover more ${TG_HANDLE}.`,

 chooseDomainToManage: `Please select a domain if you wish to manage its DNS settings.`,

 chooseDomainWithShortener: `Please select or buy the domain name you would like to connect with your shortened link.`,

 viewDnsRecords: (records, domain, nameserverType) => {
 let msg = `<b>${domain}</b> — DNS Records\n`

 // NS section — only show for cloudflare or custom NS (hide provider defaults)
 const nsRecs = records['NS']
 if (nsRecs && nsRecs.length && (nameserverType === 'cloudflare' || nameserverType === 'custom')) {
 const provider = nameserverType === 'cloudflare' ? 'Cloudflare' : 'Custom'
 msg += `\n<b>NAMESERVERS</b> <i>(${provider})</i>\n`
 for (let i = 0; i < nsRecs.length; i++) {
 msg += ` NS${i + 1}: <code>${nsRecs[i].recordContent || '—'}</code>\n`
 }
 msg += `<i>Use "🔄 Manage Nameservers" to change.</i>\n`
 }

 // Other record types
 const otherTypes = ['A', 'AAAA', 'MX', 'TXT', 'CNAME', 'SRV', 'CAA']
 for (const type of otherTypes) {
 let recs = records[type]
 if (!recs || !recs.length) continue
 // Hide internal Railway CNAME records from user view
 if (type === 'CNAME') {
 recs = recs.filter(r => !r.recordContent || !r.recordContent.includes('.up.railway.app'))
 if (!recs.length) continue
 }
 msg += `\n<b>${type}</b>\n`
 for (const r of recs) {
 const idx = `<b>${r.index}.</b>`
 const host = r.recordName && r.recordName !== domain ? r.recordName : '@'
 if (type === 'MX') {
 const pri = r.priority !== undefined ? ` [pri:${r.priority}]` : ''
 msg += `${idx} ${host}${pri} → ${r.recordContent || '—'}\n`
 } else if (type === 'TXT') {
 const val = r.recordContent ? (r.recordContent.length > 50 ? r.recordContent.substring(0, 50) + '…' : r.recordContent) : '—'
 msg += `${idx} ${host} → ${val}\n`
 } else if (type === 'SRV') {
 msg += `${idx} ${r.recordName || ''} → ${r.recordContent || '—'}\n`
 } else {
 msg += `${idx} ${host} → ${r.recordContent || '—'}\n`
 }
 }
 }
 const hasAny = ['NS', ...otherTypes].some(t => records[t]?.length)
 if (!hasAny) msg += '\nNo records found.\n'
 return msg
 },
 addDns: 'Add DNS Record',
 updateDns: 'Update DNS Record',
 deleteDns: 'Delete DNS Record',
 quickActions: 'Quick Actions',
 activateShortener: '🔗 Activate for URL Shortener',
 deactivateShortener: '🔗 Deactivate URL Shortener',
 mx: 'MX Record',
 txt: 'TXT Record',
 'MX Record': 'MX',
 'TXT Record': 'TXT',

 // Digital Products
 digitalProductsSelect: `🛒 <b>Digital Products</b>\n\nVerified accounts delivered <b>quickly</b> via this bot.\n\n<b>Telecom</b> — Twilio, Telnyx (SMS, Voice, SIP)\n<b>Cloud</b> — AWS, Google Cloud (Full access)\n<b>Email</b> — Google Workspace, Zoho Mail, IONOS SMTP\n<b>Mobile</b> — eSIM T-Mobile\n\nPay with crypto, bank, or wallet. Select below:`,
 dpTwilioMain: `📞 Twilio Main Account — $${DP_PRICE_TWILIO_MAIN}`,
 dpTwilioSub: `📞 Twilio Sub-Account — $${DP_PRICE_TWILIO_SUB}`,
 dpTelnyxMain: `📡 Telnyx Main Account — $${DP_PRICE_TELNYX_MAIN}`,
 dpTelnyxSub: `📡 Telnyx Sub-Account — $${DP_PRICE_TELNYX_SUB}`,
 dpGworkspaceNew: `📧 Google Workspace Admin (New Domain) — $${DP_PRICE_GWORKSPACE_NEW}`,
 dpGworkspaceAged: `📧 Google Workspace Admin (Aged Domain) — $${DP_PRICE_GWORKSPACE_AGED}`,
 dpEsim: `📱 eSIM T-Mobile — $${DP_PRICE_ESIM}`,
 dpEsimAirvoice: `📱 eSIM Airvoice (AT&T) — from $${DP_PRICE_AIRVOICE_1M}`,
 dpAirvoiceSelect: `📱 <b>eSIM Airvoice (AT&T)</b>\n\n📶 Unlimited talk, text & data on AT&T network.\nWorks on iOS & Android. Scan QR to activate.\n\nSelect plan duration:`,
 dpAirvoice1m: `1 Month — $${DP_PRICE_AIRVOICE_1M}`,
 dpAirvoice3m: `3 Months — $${DP_PRICE_AIRVOICE_3M}`,
 dpAirvoice6m: `6 Months — $${DP_PRICE_AIRVOICE_6M}`,
 dpAirvoice1y: `1 Year — $${DP_PRICE_AIRVOICE_1Y}`,
 dpZohoNew: `📧 Zoho Mail (New Domain) — $${DP_PRICE_ZOHO_NEW}`,
 dpZohoAged: `📧 Zoho Mail (Aged Domain) — $${DP_PRICE_ZOHO_AGED}`,
 dpAwsMain: `☁️ AWS Main Account — $${DP_PRICE_AWS_MAIN}`,
 dpAwsSub: `☁️ AWS Sub-Account — $${DP_PRICE_AWS_SUB}`,
 dpGcloudMain: `🌐 Google Cloud Main — $${DP_PRICE_GCLOUD_MAIN}`,
 dpGcloudSub: `🌐 Google Cloud Sub — $${DP_PRICE_GCLOUD_SUB}`,
 dpIonosSmtp: `📧 IONOS SMTP — $${DP_PRICE_IONOS_SMTP}`,
 dpPaymentPrompt: (product, price) => {
 const descriptions = {
 'Twilio Main Account': 'Full owner-level Twilio account with Console access, API keys, and ability to provision phone numbers, send SMS/MMS, and make voice calls. Includes 2 Sender IDs and $20 credit.\n\nYou receive: login credentials + API SID & Auth Token.',
 'Twilio Sub-Account': 'Twilio sub-account with Console login and dedicated API credentials for SMS, voice, and phone number provisioning. Includes 2 Sender IDs and $20 credit.\n\nYou receive: login credentials, Account SID & Auth Token.',
 'Telnyx Main Account': 'Full owner-level Telnyx account with Mission Control Portal access. Provision numbers, configure SIP trunking, messaging, and voice. Includes 2 Sender IDs and $20 credit.\n\nYou receive: login credentials + API key.',
 'Telnyx Sub-Account': 'Telnyx sub-account with Mission Control Portal login and API access for messaging, voice, and number management. Includes 2 Sender IDs and $20 credit.\n\nYou receive: login credentials + API key.',
 'AWS Main Account': 'Full root-level AWS account with Console access to all services — EC2, S3, Lambda, SES, and more.\n\nYou receive: root email, password, and MFA setup.',
 'AWS Sub-Account': 'AWS sub-account (Organizations member) with full Console login and access to core services — EC2, S3, Lambda, and more.\n\nYou receive: login credentials and IAM access.',
 'Google Cloud Main Account': 'Full owner-level Google Cloud account with billing enabled. Access to Compute Engine, Cloud Storage, BigQuery, and all GCP services.\n\nYou receive: login credentials.',
 'Google Cloud Sub-Account': 'Google Cloud project with full Console login and editor-level access. Compute, storage, and API access included.\n\nYou receive: login credentials and service account key.',
 'Google Workspace (New Domain)': 'Google Workspace business email setup on a freshly registered domain. Custom @yourdomain email with Gmail, Drive, Docs, and Meet.\n\nYou receive: admin login + domain credentials.',
 'Google Workspace (Aged Domain)': 'Google Workspace on an aged/established domain for better deliverability. Business email with full Google suite.\n\nYou receive: admin login + domain credentials.',
 'Zoho Mail (New Domain)': 'Zoho Mail professional email on a new domain. Custom @yourdomain email with calendar, contacts, and file storage.\n\nYou receive: admin login + domain setup.',
 'Zoho Mail (Aged Domain)': 'Zoho Mail on an aged domain for improved sender reputation. Professional email with full Zoho suite.\n\nYou receive: admin login + domain credentials.',
 'eSIM T-Mobile': '📶 <b>1 month — Unlimited talk, text & data</b>\nWorks on iOS & Android. Scan QR to activate.\n\nYou receive: QR code or activation details.',
 'eSIM Airvoice (AT&T) — 1 Month': '📶 <b>1 month — Unlimited talk, text & data (AT&T)</b>\nWorks on iOS & Android. Scan QR to activate.\n\nYou receive: QR code or activation details.',
 'eSIM Airvoice (AT&T) — 3 Months': '📶 <b>3 months — Unlimited talk, text & data (AT&T)</b>\nWorks on iOS & Android. Scan QR to activate.\n\nYou receive: QR code or activation details.',
 'eSIM Airvoice (AT&T) — 6 Months': '📶 <b>6 months — Unlimited talk, text & data (AT&T)</b>\nWorks on iOS & Android. Scan QR to activate.\n\nYou receive: QR code or activation details.',
 'eSIM Airvoice (AT&T) — 1 Year': '📶 <b>1 year — Unlimited talk, text & data (AT&T)</b>\nWorks on iOS & Android. Scan QR to activate.\n\nYou receive: QR code or activation details.',
 }
 const desc = descriptions[product] || ''
 return `💰 <b>Order: ${product}</b>\n\n💵 Price: <b>$${price}</b>${desc ? '\n\n' + desc : ''}\n\nSelect payment method:`
 },
 dpOrderConfirmed: (product, price, orderId) => `✅ <b>Order Confirmed!</b>\n\n🛒 Product: <b>${product}</b>\n💵 Amount: <b>$${price}</b>\n🆔 Order ID: <code>${orderId}</code>\n\n⏱ <b>We'll deliver right here in this chat shortly.</b>\nFor urgent requests, tap 💬 Get Support.\n\n💡 <b>Need more accounts?</b> Browse our full catalog in 🛒 Digital Products.`,

 // Virtual Card
 vcWelcome: `💳 <b>Virtual Debit Card</b>\n\nLoad a virtual card with your chosen amount.\n\n✅ Works online worldwide\n✅ Instant delivery\n✅ $50 – $1,000\n\nSelect an amount or enter a custom one:`,
 vcInvalidAmount: `❌ Please enter a valid amount between <b>$50</b> and <b>$1,000</b>.`,
 vcAskAddress: `📬 <b>Shipping Address</b>\n\nEnter your full address in international format:\n\n<i>Example:\nJohn Doe\n123 Main Street, Apt 4B\nNew York, NY 10001\nUnited States</i>`,
 vcAddressTooShort: `❌ Address seems too short. Please include your full name, street, city, postal code, and country.`,
 vcOrderSummary: (amount, fee, total) => `📋 <b>Order Summary</b>\n\n💳 Virtual Card Load: <b>$${amount}</b>\n💰 Service Fee: <b>$${fee.toFixed(2)}</b>${amount < 200 ? ' (min. $20)' : ' (10%)'}\n━━━━━━━━━━━━━━━━━\n💵 <b>Total: $${total.toFixed(2)}</b>\n\nSelect payment method:`,
 vcOrderConfirmed: (amount, total, orderId) => `✅ <b>Virtual Card Order Confirmed!</b>\n\n💳 Card Load: <b>$${amount}</b>\n💵 Total Paid: <b>$${total.toFixed(2)}</b>\n🆔 Order ID: <code>${orderId}</code>\n\n⏱ <b>Your card details will be delivered right here shortly.</b>\nFor urgent requests, tap 💬 Get Support.`,
 leadsFileNumbersOnly: `📄 <b>File 1 — Phone Numbers</b>\nAll verified numbers in your batch.`,
 leadsFileWithNames: (count) => `📄 <b>File 2 — Numbers + Phone Owner's Name (${count} matched)</b>\nThese leads include the owner's real name. Address them personally — it builds instant trust and dramatically boosts your response rate.`,
 addDnsTxt: 'Select record type:',
 updateDnsTxt: 'Select the record to update:',
 deleteDnsTxt: 'Select the record to delete:',
 confirmDeleteDnsTxt: 'Are you sure you want to delete this record?',
 a: 'A Record',
 cname: 'CNAME Record',
 ns: 'NS Record',
 'A Record': 'A',
 'CNAME Record': 'CNAME',
 'NS Record': 'NS',
 askDnsHostname: {
 A: '<b>Add A Record</b>\n\nEnter hostname:\ne.g. <b>@</b> for root, or <b>api</b>, <b>blog</b>, <b>www</b>',
 CNAME: '<b>Add CNAME Record</b>\n\nEnter subdomain hostname:\ne.g. <b>www</b>, <b>api</b>, <b>blog</b>\n\nNote: CNAME cannot be used for root (@)',
 MX: '<b>Add MX Record</b> (Step 1/3)\n\nEnter hostname:\ne.g. <b>@</b> for root email, or a subdomain',
 TXT: '<b>Add TXT Record</b> (Step 1/2)\n\nEnter hostname:\ne.g. <b>@</b> for root, or <b>_dmarc</b>, <b>mail</b>',
 NS: '<b>Add NS Record</b>\n\nEnter nameserver:\ne.g. <b>ns1.cloudflare.com</b>',
 AAAA: '<b>Add AAAA Record</b> (Step 1/2)\n\nEnter hostname:\ne.g. <b>@</b> for root, or <b>api</b>, <b>blog</b>',
 },
 askDnsValue: {
 A: 'Enter IPv4 address:\ne.g. <b>192.168.1.1</b>',
 CNAME: 'Enter target domain:\ne.g. <b>myapp.railway.app</b>',
 MX: '<b>Step 2/3</b> — Enter mail server:\ne.g. <b>ASPMX.L.GOOGLE.COM</b>',
 TXT: '<b>Step 2/2</b> — Enter TXT value:\ne.g. <b>v=spf1 include:_spf.google.com ~all</b>',
 AAAA: '<b>Step 2/2</b> — Enter IPv6 address:\ne.g. <b>2001:db8::1</b>',
 },
 askMxPriority: '<b>Step 3/3</b> — Enter MX priority (lower = higher preference):\ne.g. <b>10</b> for primary, <b>20</b> for backup',
 askDnsContent: {
 NS: '<b>Add NS Record</b>\n\nEnter nameserver hostname:\ne.g. <b>ns1.cloudflare.com</b>',
 'NS Record': '<b>Add NS Record</b>\n\nEnter nameserver hostname:\ne.g. <b>ns1.cloudflare.com</b>\n\nNote: Max 4 NS records. Use Update if already at limit.',
 },
 askUpdateDnsContent: {
 A: (current) => `<b>Update A Record</b>\nCurrent: <b>${current || 'N/A'}</b>\n\nEnter new IPv4 address:\ne.g. <b>192.168.1.1</b>`,
 'A Record': (current) => `<b>Update A Record</b>\nCurrent: <b>${current || 'N/A'}</b>\n\nEnter new IPv4 address:\ne.g. <b>192.168.1.1</b>`,
 CNAME: (current) => `<b>Update CNAME Record</b>\nCurrent: <b>${current || 'N/A'}</b>\n\nEnter new target domain:\ne.g. <b>myapp.railway.app</b>`,
 'CNAME Record': (current) => `<b>Update CNAME Record</b>\nCurrent: <b>${current || 'N/A'}</b>\n\nEnter new target domain:\ne.g. <b>myapp.railway.app</b>`,
 NS: (current) => `<b>Update NS Record</b>\nCurrent: <b>${current || 'N/A'}</b>\n\nEnter new nameserver:\ne.g. <b>ns1.cloudflare.com</b>`,
 'NS Record': (current) => `<b>Update NS Record</b>\nCurrent: <b>${current || 'N/A'}</b>\n\nEnter new nameserver:\ne.g. <b>ns1.cloudflare.com</b>`,
 MX: (current) => `<b>Update MX Record</b>\nCurrent: <b>${current || 'N/A'}</b>\n\nEnter new mail server:\ne.g. <b>ASPMX.L.GOOGLE.COM</b>`,
 'MX Record': (current) => `<b>Update MX Record</b>\nCurrent: <b>${current || 'N/A'}</b>\n\nEnter new mail server:\ne.g. <b>ASPMX.L.GOOGLE.COM</b>`,
 TXT: (current) => {
 const display = current ? (current.length > 50 ? current.substring(0, 50) + '...' : current) : 'N/A'
 return `<b>Update TXT Record</b>\nCurrent: <b>${display}</b>\n\nEnter new TXT value:\ne.g. <b>v=spf1 include:_spf.google.com ~all</b>`
 },
 'TXT Record': (current) => {
 const display = current ? (current.length > 50 ? current.substring(0, 50) + '...' : current) : 'N/A'
 return `<b>Update TXT Record</b>\nCurrent: <b>${display}</b>\n\nEnter new TXT value:\ne.g. <b>v=spf1 include:_spf.google.com ~all</b>`
 },
 AAAA: (current) => `<b>Update AAAA Record</b>\nCurrent: <b>${current || 'N/A'}</b>\n\nEnter new IPv6 address:\ne.g. <b>2001:db8::1</b>`,
 'AAAA Record': (current) => `<b>Update AAAA Record</b>\nCurrent: <b>${current || 'N/A'}</b>\n\nEnter new IPv6 address:\ne.g. <b>2001:db8::1</b>`,
 },

 dnsRecordSaved: 'Record added successfully. DNS changes may take up to 24h to propagate.',
 dnsRecordDeleted: 'Record deleted successfully.',
 dnsRecordUpdated: 'Record updated successfully. DNS changes may take up to 24h to propagate.',
 // DNS Quick Actions
 dnsQuickActionMenu: 'Choose a preset configuration:',
 dnsQuickAskIp: 'Enter your server IPv4 address:\ne.g. <b>192.168.1.1</b>',
 dnsQuickAskSubdomainName: 'Enter subdomain name:\ne.g. <b>blog</b>, <b>api</b>, <b>shop</b>',
 dnsQuickAskSubdomainTargetType: domain => `What should <b>${domain}</b> point to?`,
 dnsQuickSubdomainIp: 'IP Address',
 dnsQuickSubdomainDomain: 'Domain Name',
 dnsQuickAskSubdomainIp: 'Enter the IPv4 address for the subdomain:',
 dnsQuickAskSubdomainDomain: 'Enter the target domain (e.g. <b>myapp.railway.app</b>):',
 dnsQuickAskVerificationTxt: 'Paste the TXT verification value provided by your service:',
 dnsQuickGoogleDone: domain => `<b>Google Workspace email DNS configured for ${domain}!</b>\n\n5 MX records + SPF TXT record added.\nAllow 24-48h for propagation.`,
 dnsQuickZohoDone: domain => `<b>Zoho Mail email DNS configured for ${domain}!</b>\n\n3 MX records + SPF TXT record added.\nAllow 24-48h for propagation.`,
 dnsQuickPointToIpDone: (domain, ip) => `<b>Done!</b>\n\nA record: ${domain} → ${ip}\nCNAME record: www.${domain} → ${domain}`,
 dnsQuickVerificationDone: 'TXT verification record added!',
 dnsQuickSubdomainDone: (sub, target, type) => `<b>Done!</b> ${type} record created:\n${sub} → ${target}`,
 dnsQuickSetupProgress: (step, total) => `Setting up... (${step}/${total})`,
 dnsQuickSetupError: (step) => `Failed at step: ${step}. Some records may have been created. Please check DNS records and retry.`,
 dnsInvalidIpv4: 'Invalid IPv4 address. Please enter a valid IP (e.g. 192.168.1.1):',
 dnsInvalidHostname: 'Invalid hostname. Use alphanumeric characters, hyphens, underscores and dots (e.g. api, _dmarc, neo1._domainkey):',
 dnsInvalidMxPriority: 'Invalid priority. Enter a number between 1 and 65535:',
 dnsQuickActions,

 // Phase 2: AAAA, SRV, CAA
 aaaa: 'AAAA Record',
 'AAAA Record': 'AAAA',
 srvRecord: 'SRV Record',
 'SRV Record': 'SRV',
 caaRecord: 'CAA Record',
 'CAA Record': 'CAA',
 dnsInvalidIpv6: 'Invalid IPv6 address. Please enter a valid IPv6 (e.g. 2001:db8::1):',
 dnsInvalidPort: 'Invalid port number. Enter a number between 1 and 65535:',
 dnsInvalidWeight: 'Invalid weight. Enter a number between 0 and 65535:',
 dnsSrvCaaNotSupported: 'SRV and CAA records are not supported by your current DNS provider (ConnectReseller). Switch to Cloudflare or OpenProvider nameservers to use these record types.',
 // SRV wizard prompts
 askSrvService: '<b>Add SRV Record</b> (Step 1/5)\n\nEnter service and protocol:\ne.g. <b>_sip._tcp</b>, <b>_http._tcp</b>, <b>_minecraft._tcp</b>',
 askSrvTarget: '<b>Step 2/5</b> — Enter target hostname:\ne.g. <b>sipserver.example.com</b>',
 askSrvPort: '<b>Step 3/5</b> — Enter port number:\ne.g. <b>5060</b>, <b>443</b>, <b>25565</b>',
 askSrvPriority: '<b>Step 4/5</b> — Enter priority (lower = higher preference):\ne.g. <b>10</b>',
 askSrvWeight: '<b>Step 5/5</b> — Enter weight (for load balancing):\ne.g. <b>100</b>',
 // CAA wizard prompts
 askCaaHostname: '<b>Add CAA Record</b> (Step 1/3)\n\nEnter hostname:\ne.g. <b>@</b> for root domain',
 askCaaTag: '<b>Step 2/3</b> — Select the CAA tag:',
 caaTagIssue: 'issue — Authorize a CA',
 caaTagIssuewild: 'issuewild — Authorize wildcard',
 caaTagIodef: 'iodef — Violation report URL',
 'issue — Authorize a CA': 'issue',
 'issuewild — Authorize wildcard': 'issuewild',
 'iodef — Violation report URL': 'iodef',
 askCaaValue: (tag) => {
 if (tag === 'iodef') return '<b>Step 3/3</b> — Enter report URL:\ne.g. <b>mailto:admin@example.com</b>'
 return '<b>Step 3/3</b> — Enter authorized CA domain:\ne.g. <b>letsencrypt.org</b>, <b>digicert.com</b>'
 },
 // Multi-step hostname prompts for new types
 askDnsHostnameAaaa: 'Enter hostname (@ for root, or subdomain like <b>api</b>, <b>blog</b>):',
 askDnsValueAaaa: 'Enter the IPv6 address (e.g. <b>2001:db8::1</b>):',

 // DNS Validation Checker
 checkDns: 'Check DNS',
 dnsChecking: (domain) => `Checking DNS for <b>${domain}</b>...`,
 dnsRecordLive: (type, value) => `<b>${type}</b> record is live, resolving to <b>${value}</b>.`,
 dnsRecordPropagating: (type) => `<b>${type}</b> record is still propagating. This can take up to 24-48h.`,
 dnsHealthTitle: (domain) => `<b>DNS Health Check — ${domain}</b>\n`,
 dnsHealthRow: (type, found, count, answers) => {
 if (!found) return ` ${type}: —`
 const vals = answers.slice(0, 2).join(', ')
 const more = answers.length > 2 ? ` +${answers.length - 2} more` : ''
 return ` ${type}: ${count} record${count > 1 ? 's' : ''} (${vals}${more})`
 },
 dnsHealthSummary: (resolving, total) => `\n${resolving}/${total} record types resolving.`,
 dnsCheckError: 'DNS lookup failed. Please try again later.',

 // Manage Nameservers (consolidated NS menu)
 manageNameservers: '🔄 Manage Nameservers',
 manageNsMenu: (domain, nsRecords, nameserverType) => {
 const provider = nameserverType === 'cloudflare' ? 'Cloudflare' : nameserverType === 'custom' ? 'Custom' : 'Provider Default'
 let msg = `<b>🔄 Nameservers — ${domain}</b>\n\n`
 msg += `<b>Provider:</b> ${provider}\n\n`
 if (nsRecords && nsRecords.length) {
 msg += `<b>Current Nameservers:</b>\n`
 nsRecords.forEach((ns, i) => {
 msg += ` NS${i + 1}: <code>${ns.recordContent || '—'}</code>\n`
 })
 } else {
 msg += `<i>No nameserver records found.</i>\n`
 }
 msg += `\nSelect an action below:`
 return msg
 },
 setCustomNs: '✏️ Set Custom Nameservers',
 setCustomNsPrompt: (domain, nsRecords) => {
 let msg = `<b>✏️ Set Custom Nameservers for ${domain}</b>\n\n`
 if (nsRecords && nsRecords.length) {
 msg += `<b>Current:</b>\n`
 nsRecords.forEach((ns, i) => {
 msg += ` NS${i + 1}: <code>${ns.recordContent || '—'}</code>\n`
 })
 msg += '\n'
 }
 msg += `Enter new nameservers (one per line, min 2, max 4):\n\n<i>Example:\nns1.example.com\nns2.example.com</i>`
 return msg
 },

 // Switch to Cloudflare
 switchToCf: '☁️ Switch to Cloudflare',
 switchToCfConfirm: (domain) => `<b>Switch ${domain} to Cloudflare DNS?</b>\n\nThis will:\n1. Create a Cloudflare zone for your domain\n2. Migrate existing DNS records to Cloudflare\n3. Update your nameservers at the registrar\n\nDNS propagation may take up to 24-48h.\n\nProceed?`,
 switchToCfProgress: (domain) => `⏳ Switching <b>${domain}</b> to Cloudflare DNS…`,
 switchToCfSuccess: (domain, ns) => `<b>Done!</b> ${domain} is now on Cloudflare DNS.\n\n<b>New Nameservers:</b>\n${ns.map((n, i) => `NS${i + 1}: <code>${n}</code>`).join('\n')}`,
 switchToCfError: (error) => `❌ Failed to switch to Cloudflare: ${error}`,
 switchToCfAlreadyCf: 'This domain is already using Cloudflare DNS.',

 // Switch to Provider Default
 switchToProviderDefault: '🏠 Switch to Provider DNS',
 switchToProviderConfirm: (domain) => `<b>Switch ${domain} back to provider DNS?</b>\n\nThis will:\n1. Migrate existing DNS records from Cloudflare to your registrar\n2. Restore default nameservers at your registrar\n3. Remove the Cloudflare zone\n\nDNS propagation may take up to 24-48h.\n\nProceed?`,
 switchToProviderProgress: (domain) => `⏳ Switching <b>${domain}</b> to provider DNS…`,
 switchToProviderSuccess: (domain, ns) => `<b>Done!</b> ${domain} is now on provider DNS.\n\n<b>New Nameservers:</b>\n${ns.map((n, i) => `NS${i + 1}: <code>${n}</code>`).join('\n')}`,
 switchToProviderError: (error) => `❌ Failed to switch to provider DNS: ${error}`,
 switchToProviderAlreadyProvider: 'This domain is already using provider default DNS.',

 // NS update arrangement prompt
 updateNsPrompt: (nsRecords, slotIndex) => {
 let msg = `<b>Update Nameserver — Slot NS${slotIndex}</b>\n\n<b>Current arrangement:</b>\n`
 for (let i = 0; i < nsRecords.length; i++) {
 const marker = (i + 1) === slotIndex ? ' ← updating this' : ''
 msg += ` NS${i + 1}: <code>${nsRecords[i].recordContent || '—'}</code>${marker}\n`
 }
 msg += `\nEnter the new nameserver for <b>NS${slotIndex}</b>:\ne.g. <b>ns1.cloudflare.com</b>`
 return msg
 },

 provideLink: 'Please provide a valid URL. e.g https://google.com',

 comingSoonWithdraw: `Withdrawals are not available yet. Need help? Tap 💬 Get Support.`,
 promoOptOut: `You have been unsubscribed from promotional messages. Type /start_promos to re-subscribe anytime.`,
 promoOptIn: `You have been re-subscribed to promotional messages. You will receive our latest offers and deals!`,

 selectCurrencyToDeposit: `💵 Deposit Amount (min. $10):`,

 depositNGN: `💵 Enter NGN amount (min. ≈ $10 USD)
Auto-converts to USD at current rate.`,

 depositUSD: `Please enter USD Amount, note that minimum value is $10:`,
 selectCryptoToDeposit: `Please choose a crypto currency:`,

 'bank-pay-plan': (
 priceNGN,
 plan,
 ) => `Please remit ${priceNGN} NGN by clicking “Make Payment” below. Once the transaction has been confirmed, you will be promptly notified, and your ${plan} plan will be seamlessly activated.

Best regards,
${CHAT_BOT_NAME}`,

 bankPayDomain: (
 priceNGN,
 domain,
 ) => `Please remit ${priceNGN} NGN by clicking “Make Payment” below. Once the transaction has been confirmed, you will be promptly notified, and your ${domain} domain will be seamlessly activated.

Best regards,
${CHAT_BOT_NAME}`,

 showDepositCryptoInfoPlan: (priceUsd, priceCrypto, tickerView, address, plan) =>
 `💰 <b>Payment Amount: $${Number(priceUsd).toFixed(2)} USD</b>

Send exactly <b>${priceCrypto} ${tickerView}</b> to:

<code>${address}</code>

Your ${plan} plan will activate automatically once payment is confirmed (usually within a few minutes).

Best regards,
${CHAT_BOT_NAME}`,

 showDepositCryptoInfoDomain: (priceUsd, priceCrypto, tickerView, address, domain) =>
 `💰 <b>Payment Amount: $${Number(priceUsd).toFixed(2)} USD</b>

Send exactly <b>${priceCrypto} ${tickerView}</b> to:

<code>${address}</code>

Your ${domain} domain will activate automatically once payment is confirmed (usually within a few minutes).

Best regards,
${CHAT_BOT_NAME}`,

 showDepositCryptoInfoLeads: (priceUsd, priceCrypto, tickerView, address, label) =>
 `💰 <b>Payment Amount: $${Number(priceUsd).toFixed(2)} USD</b>

Send exactly <b>${priceCrypto} ${tickerView}</b> to:

<code>${address}</code>

Your ${label} will be delivered automatically once payment is confirmed (usually within a few minutes).

Best regards,
${CHAT_BOT_NAME}`,

 showDepositCryptoInfoPhone: (priceUsd, priceCrypto, tickerView, address, phoneNumber) =>
 `💰 <b>Payment Amount: $${Number(priceUsd).toFixed(2)} USD</b>

Send exactly <b>${priceCrypto} ${tickerView}</b> to:

<code>${address}</code>

Your Cloud IVR number ${phoneNumber} will be activated automatically once payment is confirmed (usually within a few minutes).

Best regards,
${CHAT_BOT_NAME}`,

 showDepositCryptoInfoDigitalProduct: (priceUsd, priceCrypto, tickerView, address, product) =>
 `💰 <b>Payment Amount: $${Number(priceUsd).toFixed(2)} USD</b>

Send exactly <b>${priceCrypto} ${tickerView}</b> to:

<code>${address}</code>

Your order for <b>${product}</b> will be delivered automatically once payment is confirmed (usually within a few minutes).

Best regards,
${CHAT_BOT_NAME}`,

 showDepositCryptoInfo: (priceUsd, priceCrypto, tickerView, address) =>
 `💰 <b>Payment Amount: $${Number(priceUsd).toFixed(2)} USD</b>

Send exactly <b>${priceCrypto} ${tickerView}</b> to:

<code>${address}</code>

Crypto payments are confirmed quickly — usually within a few minutes. Once confirmed, you will be promptly notified, and your wallet will be updated.

Best regards,
${CHAT_BOT_NAME}`,

 confirmationDepositMoney: (
 amount,
 usd,
 ) => `Your payment of ${amount} ($${usd}) is processed. Thank you for choosing us.
Best,
${CHAT_BOT_NAME}`,

 showWallet: (usd) => `Wallet Balance:

$${view(usd)}`,

 wallet: (usd) => `Wallet Balance:

$${view(usd)}

Select wallet option:`,

 walletSelectCurrency: (usd) => `Your Wallet Balance: $${view(usd)}`,

 walletBalanceLow: `💰 Wallet balance too low. Tap Deposit to top up.`,

 walletBalanceLowAmount: (needed, balance) =>
 `💰 Balance: $${balance.toFixed(2)}
Need: <b>$${(needed - balance).toFixed(2)} more</b>

Tap Deposit ⬇️`,

 sentLessMoney: (expected, got) =>
 `⚠️ Underpayment detected

Expected: <b>${expected}</b>
Received: <b>${got}</b>

Amount credited to wallet.
Service not delivered.`,
 sentMoreMoney: (expected, got) =>
 `💰 Overpayment detected

Expected: <b>${expected}</b>
Received: <b>${got}</b>

Excess refunded to wallet.
Service delivered.`,

 buyLeadsError: 'Unfortunately the selected area code is unavailable and your wallet has not been charged',
 buyLeadsProgress: (i, total) => `${((i * 100) / total).toFixed()}% leads downloaded. Please wait.`,

 phoneNumberLeads: 'Get premium verified leads by target or validate your own numbers:',

 buyLeadsSelectCountry: 'Please select country',
 buyLeadsSelectSmsVoice: 'Please select SMS / Voice',
 buyLeadsSelectArea: 'Please select area',
 buyLeadsSelectAreaCode: 'Please select area code',
 buyLeadsSelectCarrier: 'Please select carrier',
 buyLeadsSelectCnam: `Want the <b>phone owner's name</b> with each lead? It's an extra $15 per 1,000 leads — and it's worth it.`,
 buyLeadsSelectAmount: (min, max) =>
 `How many leads do you want? Select or type a number.\nMinimum: ${min} | Maximum: ${max}\n\n💡 Bigger batches = better coverage. Go big.`,
 buyLeadsSelectFormat: 'Choose format i.e Local (212) or International (+1212)',
 buyLeadsSuccess: n => `🎉 <b>Done!</b> Your ${n} leads are ready.\n\nYou're getting two files:\n📄 <b>File 1</b> — All phone numbers\n📄 <b>File 2</b> — Numbers matched with the <b>phone owner's name</b>\n\nPro tip: Use names to personalize your outreach. People are 2-3x more likely to respond when addressed by name.`,

 buyLeadsNewPrice: (leads, price, newPrice) => `💰 <b>${leads} leads</b> — now just <b>$${view(newPrice)}</b> <s>($${price})</s>\nIncludes phone owner names. Don't miss this deal.`,
 buyLeadsPrice: (leads, price) => `💰 <b>${leads} leads</b> — <b>$${price}</b>\nIncludes phone owner names. Ready when you are.`,

 walletSelectCurrencyConfirm: `Confirm?`,

 // Phone Number validator
 validatorSelectCountry: 'Please select country',
 validatorPhoneNumber: 'Please paste your numbers or upload a file including the country code.',
 validatorSelectSmsVoice: n =>
 `${n} phone numbers found. Please choose the option for SMS or voice call leads validation.`,
 validatorSelectCarrier: 'Please select carrier',
 validatorSelectCnam: `Want the <b>phone owner's name</b> with your validated leads?\n\nKnowing who you're reaching lets you personalize your message — and people respond to their own name. It's $15 per 1,000 leads. Worth every cent.`,
 validatorSelectAmount: (min, max) =>
 `How much from the numbers you want to validate? Select or type a number. Minimum is ${min} and Maximum is ${max}`,
 validatorSelectFormat: 'Choose format i.e Local (212) or International (+1212)',

 validatorSuccess: (n, m) => `${n} leads are validated. ${m} valid phone numbers found.`,
 validatorProgress: (i, total) => `${((i * 100) / total).toFixed()}% leads validate. Please wait.`,
 validatorProgressFull: (i, total) => `${((i * 100) / total).toFixed()}% leads validate.`,

 validatorError: `Unfortunately the selected phone numbers are unavailable and your wallet has not been charged`,
 validatorErrorFileData: `Invalid country phone # found. Please upload phone number for selected country`,
 validatorErrorNoPhonesFound: `No phone numbers found. Try again.`,

 validatorBulkNumbersStart: 'Leads validation has started and will complete soon.',

 // url re-director
 redSelectUrl: 'Kindly share the URL that you would like shortened and analyzed. e.g https://cnn.com',
 redSelectRandomCustom: 'Please select your choice for random or custom link',
 redSelectProvider: 'Choose link provider',
 redSelectCustomExt: 'Enter custom back half',

 redValidUrl: 'Please provide a valid URL. e.g https://google.com',
 redTakeUrl: url => `Your shortened URL is: ${url}`,
 redIssueUrlBitly: `Link shortening failed. Your wallet was not charged. Please try again or tap 💬 Get Support.`,
 redIssueSlugCuttly: `The preferred link name is already taken, try another.`,
 redIssueUrlCuttly: `Link shortening failed. Please try again or tap 💬 Get Support.`,
 freeLinksExhausted: `Your ${FREE_LINKS} trial links are used up!\n\nSubscribe for <b>unlimited links</b> + free domains + ${DAILY_PLAN_FREE_VALIDATIONS.toLocaleString()}+ validations.\n\nPlans from <b>$${PRICE_DAILY}/day</b>. Tap ⚡ Upgrade Plan below to get started.`,
 subscriptionLeadsHint: `💡 Subscribers get ${DAILY_PLAN_FREE_VALIDATIONS.toLocaleString()}+ free validations with phone owner names per plan. Plans from $${PRICE_DAILY}/day.`,
 linksRemaining: (count, total) => {
 const base = `You have ${count} of ${total || FREE_LINKS} trial Shortit link${count !== 1 ? 's' : ''} remaining.`
 if (count <= 2) return `${base}\n\n⚡ <b>${count} link${count !== 1 ? 's' : ''} left!</b> Subscribers get unlimited links + free domains + ${DAILY_PLAN_FREE_VALIDATIONS.toLocaleString()}+ validations. Plans from $${PRICE_DAILY}/day.`
 return base
 },
 redNewPrice: (price, newPrice) => `Price is now $${view(newPrice)} <s>($${price})</s> Please choose payment method.`,
 customLink: 'Custom Link',
 randomLink: 'Random Link',
 askShortLinkExtension: 'Please tell us your preferred short link extension: e.g payer',
 linkAlreadyExist: `Link already exists. Please type 'ok' to try another.`,
 yourShortendUrl: shortUrl => `Your shortened URL is: ${shortUrl}`,

 availablefreeDomain: (plan, available, s) =>
 ` Remember, your ${plan} plan includes ${available} free domain${s}. Let's get your domain today!`,
 shortenedUrlLink: `Kindly share the URL that you would like shortened and analyzed. e.g https://cnn.com`,
 selectedTrialPlan: 'Your have selected Free Trial Plan',
 userPressedBtn: message => `User has Pressed ${message} Button.`,
 userToBlock: userToBlock => `User ${userToBlock} not found`,
 userBlocked: userToBlock => `User ${userToBlock} has been blocked.`,
 checkingDomainAvail: `Checking domain availability...`,
 checkingExistingDomainAvail: `Checking existing domain availability...`,
 subscribeFirst: `📋 Subscribe first`,
 freeValidationUsed: (amount, remaining) => `Validated ${amount} USA phone numbers using your subscription! Remaining free validations: ${remaining.toLocaleString()}.`,
 partialFreeValidation: (freeAmount, totalAmount, paidAmount, paidPrice) => `You have ${freeAmount.toLocaleString()} free validations remaining. Your request is for ${totalAmount.toLocaleString()} numbers.\n\n${freeAmount.toLocaleString()} will be covered free, and the remaining ${paidAmount.toLocaleString()} will cost $${paidPrice}. Please proceed with payment below.`,
 notValidHalf: `Enter a valid back half`,
 linkAlreadyExist: `Link already exists. Please try another.`,
 issueGettingPrice: `We couldn't fetch the price right now. Please try again or tap 💬 Get Support.`,
 domainInvalid: 'Domain name is invalid. Please try another domain name. Use format abcpay.com',
 domainMissingTLD: 'Missing domain extension. Please add .com, .net, .org, or another extension.\n\nExample: <b>yourname.com</b>',
 domainTooShort: 'Domain name is too short. Must be at least 3 characters before the dot.\n\nExample: <b>abc.com</b>',
 domainInvalidChars: 'Domain contains invalid characters. Use only letters, numbers, and hyphens.\n\nExample: <b>my-site.com</b>',
 domainStartsEndsHyphen: 'Domain cannot start or end with a hyphen.\n\nExample: <b>mysite.com</b> (not -mysite.com or mysite-.com)',
 domainSearchTimeout: (domain) => `⏱️ Domain search for <b>${domain}</b> is taking longer than expected.\n\nPlease try again in a moment or contact support if this persists.`,
 chooseValidPlan: 'Please choose a valid plan',
 noDomainFound: 'No domain names found',
 chooseValidDomain: 'Please choose a valid domain',
 failedAudio: '❌ Failed to process audio. Please try again.',
 enterBroadcastMessage: 'Enter message',
 provide2Nameservers: 'Please provide at least 2 nameservers separated by space.',
 noDomainSelected: 'No domain selected.',
 validInstitutionName: '⚠️ Please enter a valid institution name (2-100 characters).',
 validCityName: '⚠️ Please enter a valid city name.',
 errorDeletingDns: error => `Error: ${error}. Please try again.`,
 selectValidOption: 'Please select a valid option.',
 cancelled: 'Cancelled.',
 domainActionsMenu: (domain) => `<b>Actions for ${domain}</b>\n\nSelect an option:`,
 purchaseFailed: '❌ Purchase failed. Your wallet has been refunded. Please try again or contact support.',
 maxDnsRecord: 'Maximum 4 NS records reached. Please update or delete an existing record.',
 errorSavingDns: error => `Error: ${error}. Please try again.`,
 fileError: 'Error occurred while processing the file.',
 ammountIncorrect: 'Amount incorrect',
 subscriptionExpire: (subscribedPlan, timeEnd) => `Your ${subscribedPlan} subscription is expired on ${timeEnd}`,
 plansSubscripedtill: (subscribedPlan, timeEnd) =>
 `You are currently subscribed to the ${subscribedPlan} plan. Your plan is valid till ${timeEnd}`,
 planNotSubscriped: 'You are not currently subscribed to any plan.',
 noShortenedUrlLink: 'You have no shortened links yet.',
 shortenedLinkText: linksText => `Here are your shortened links:\n${linksText}`,

 qrCodeText: 'Here is your QR code!',
 scanQrOrUseChat: chatId => `📱 <b>Nomadly SMS App</b>\n\nYour activation code:\n<code>${chatId}</code>\n\n📲 Download: ${process.env.SMS_APP_LINK || 'Contact support'}`,
 domainPurchasedFailed: (domain) =>
 `❌ Domain registration for <b>${domain}</b> could not be completed. Please try again or contact support if the issue persists.`,

 noDomainRegistered: 'You have no purchased domains yet.',
 registeredDomainList: domainsText => `Here are your purchased domains:\n${domainsText}`,
 selectDomainAction: domain => `<b>${domain}</b>\n\nWhat would you like to do with this domain?`,
 domainActionDns: '🔧 DNS Management',
 domainActionShortener: '🔗 Activate for URL Shortener',
 domainActionDeactivateShortener: '🔗 Deactivate URL Shortener',
 domainActionAntiRed: '🛡️ Anti-Red Protection',
 
 // DNS Management Warning for Hosted Domains
 dnsWarningHostedDomain: (domain, plan) => `⚠️ <b>WARNING: This domain has an active hosting plan</b>\n\nDomain: <b>${domain}</b>\nPlan: ${plan}\n\n<b>⚠️ Modifying DNS records can break your hosting and anti-red protection!</b>\n\nDNS changes should only be made if you fully understand the impact. Incorrect changes may cause your website to become inaccessible or lose security protections.\n\n<b>Are you sure you want to proceed?</b>`,
 dnsProceedAnyway: '⚠️ Proceed Anyway',
 dnsCancel: '❌ Cancel',
 
 // Domain Origin Indicator
 domainTypeRegistered: '🏷️ Registered with us',
 domainTypeExternal: '🌍 External',
 
 antiRedStatusOn: domain => `🛡️ <b>Anti-Red Protection</b> for <b>${domain}</b>\n\nStatus: <b>✅ ON</b>\n\nThis protects your domain from phishing scanners & browser-based red flags. Turn it off only if you know what you're doing.\n\n⚠️ <b>Recommendation:</b> Keep JS Challenge enabled — it provides maximum protection against automated scanners and bots.`,
 antiRedStatusOff: domain => `🛡️ <b>Anti-Red Protection</b> for <b>${domain}</b>\n\nStatus: <b>❌ OFF</b>\n\nYour domain is NOT protected. Turn it on to block scanners and avoid red flags.\n\n⚠️ <b>Recommendation:</b> Enable Anti-Red protection with JS Challenge for maximum security.`,
 antiRedTurnOff: '❌ Turn OFF Protection',
 antiRedTurnOn: '✅ Turn ON Protection',
 antiRedTurningOn: domain => `⏳ Enabling Anti-Red protection for <b>${domain}</b>...`,
 antiRedTurningOff: domain => `⏳ Disabling Anti-Red protection for <b>${domain}</b>...`,
 antiRedEnabled: domain => `✅ Anti-Red protection <b>enabled</b> for <b>${domain}</b>.\n\nVisitors will see a brief "Verifying your browser" check before accessing your site.`,
 antiRedDisabled: domain => `❌ Anti-Red protection <b>disabled</b> for <b>${domain}</b>.\n\nThe "Verifying your browser" page will no longer show. Other security layers (IP cloaking, UA blocking) remain active.\n\n⚠️ <b>Warning:</b> Disabling JS Challenge significantly reduces your protection. We strongly recommend keeping it enabled for maximum security against automated scanners.`,
 antiRedNoCF: domain => `⚠️ <b>${domain}</b> is not using Cloudflare. Anti-Red protection requires Cloudflare nameservers.\n\nGo to DNS Management → Switch to Cloudflare NS first.`,
 antiRedError: '❌ Failed to update Anti-Red protection. Please try again.',
 comingSoon: `Coming Soon`,
 goBackToCoupon: '❌ Go Back & Apply Coupon',
 errorFetchingCryptoAddress: `Error fetching cryptocurrency address. Please try again later.`,
 paymentSuccessFul: '✅ Payment confirmed — provisioning your services now.',

 // Call Forwarding (Cloud IVR)
 fwdInsufficientBalance: (walletBal, rate) => `🚫 <b>Insufficient Balance</b>\n\n💳 $${(walletBal || 0).toFixed(2)} · Need $${rate}/min\n👉 Top up <b>$25</b> via 👛 Wallet to activate forwarding.`,
 fwdBlocked: (number) => `🚫 <b>Blocked</b> — ${number} is a premium destination.\nTap 💬 <b>Get Support</b> to request activation.`,
 fwdNotRoutable: (number) => `⚠️ ${number} is not routable. Check number or tap 💬 <b>Get Support</b>.`,
 fwdValidating: '⏳ Validating destination...',
 fwdEnterNumber: (rate, walletBal) => {
 let text = `Enter forwarding number with country code (e.g. +14155551234)\n💰 <b>$${rate}/min</b>`
 if (walletBal !== undefined) {
 text += ` · 💳 $${walletBal.toFixed(2)}`
 if (walletBal < rate) text += `\n⚠️ Top up <b>$25</b> via 👛 Wallet first.`
 }
 return text
 },
 // ── General inline translations ──
 planNotFound: 'Plan not found.',
 noActivePlans: '📋 <b>My Hosting Plans</b>\n\nYou have no active hosting plans. Purchase a plan to get started!',
 noRegisteredDomains: 'You have no registered domains. Please register a new domain or connect an external domain.',
 selectFromDomains: 'Select a domain from your registered domains:',
 selectDomainFromList: 'Please select a domain from the list.',
 enterValidDomain: 'Please enter a valid domain name (e.g., example.com).',
 enterCouponCode: 'Enter coupon code:',
 invalidCoupon: 'Invalid coupon. Try again or tap Skip.',
 couponAlreadyUsed: 'Coupon already used. Try another or tap Skip.',
 couponUsedToday: '⚠️ You have already used this coupon today.',
 keyboardRefreshed: 'Keyboard refreshed! Please select an option:',
 supportEnded: '✅ Support session ended. Thank you for reaching out!',
 noSupportSession: 'No active support session.',
 supportMsgReceived: '✉️ Message received! A support agent will respond shortly.',
 supportMsgSent: '✉️ Message sent to support. We\'ll respond shortly.',
 someIssue: 'Some Issue',
 dbConnecting: 'Database is connecting, please try again in a moment',
 chooseValidDomain: 'Please choose a valid domain',
 dnsCustomOnly: 'DNS records are managed by your custom nameserver provider. You can only update nameservers or switch DNS provider.',
 noDeleteRecords: 'No deletable records found. Nameserver records can only be updated.',
 invalidSrvFormat: 'Invalid format. Use <b>_service._protocol</b> (e.g. _sip._tcp, _http._tcp):',
 insufficientBalance: (usdBal, price) => `⚠️ Insufficient wallet balance. You have $${usdBal} but need $${price}.\nPlease deposit funds first.`,
 leadSelectMetro: (target) => `📍 Select metro area for <b>${target}</b>:\n\nChoose "All Cities" for maximum reach across all regions.`,
 leadSelectArea: (target, city) => `📞 Select area code for <b>${target}</b> — <b>${city}</b>:\n\n"Mixed Area Codes" gives you the widest pool of verified numbers.`,
 leadRequestCustom: '📝 <b>Request Custom Leads</b>\n\nTell us the institution or company you want targeted leads for.\nWe source real, verified numbers with the phone owner\'s name — from any metro area you need:',
 leadCustomCity: (target) => `🏙️ Which city or area do you want leads from?\n\nTarget: <b>${target}</b>\n\nType the city name or "Nationwide" for all areas:`,
 leadCustomDetails: (target, city) => `📋 Any additional details? (e.g., preferred area codes, carrier, volume needed)\n\nTarget: <b>${target}</b>\nArea: <b>${city}</b>\n\nType details or "None" to skip:`,
 leadAllCities: 'All Cities',
 leadNationwide: 'Nationwide',
 leadNone: 'None',
 leadRequestTarget: '📝 Request Custom Target',
 noPendingLeads: '📝 No pending lead requests.',
 backupCreated: 'Backup created successfully.',
 dataRestored: 'Data restored successfully.',
 vpsRefundFailed: (currency, amount, error) => `❌ <b>VPS provisioning failed</b>\n\n✅ Refund of ${currency}${amount} issued to your wallet.\n\nError: ${error}\n\nPlease contact support if the issue persists.`,
 shortenerConflict: (domain, plan) => `❌ Cannot activate URL shortener — <b>${domain}</b> has an active hosting plan (<b>${plan}</b>).\n\nThe shortener CNAME would replace your hosting A records and take your website offline.\n\nPlease use a different domain, or deactivate your hosting plan first.`,
 shortenerLinked: (domain) => `✅ <b>${domain}</b> linked to URL shortener. DNS may take up to 24h to propagate.`,
 shortenerError: (domain, error) => `❌ Error activating shortener for <b>${domain}</b>: ${error}\n\nPlease try again later.`,
 domainSearching: (domain) => `🔍 Searching availability for ${domain} ...`,
 domainNotAvailable: (domain) => `❌ <b>${domain}</b> is not available.`,
 domainSearchAlts: (baseName) => `🔍 Searching alternatives for <b>${baseName}</b> ...`,
 domainAltsFound: (altList) => `✅ Available alternatives:\n\n${altList}\n\nType any domain name to check:`,
 dnsLinkError: (domain, error) => `❌ Could not link <b>${domain}</b>: ${error}`,
 dnsSaveError: (domain, error) => `❌ DNS error for <b>${domain}</b>: ${error}`,
 selectProceedOrCancel: 'Please select "Proceed Anyway" or "Cancel".',

 // ── Email Blast i18n ──
 ebSendBlast: '📤 Send Email Blast',
 ebMyCampaigns: '📬 My Campaigns',
 ebAdminPanel: '⚙️ Admin Panel',
 ebCancelBtn: '❌ Cancel',
 ebCancelled: '❌ Cancelled.',
 ebUploadCsvTxt: '📎 Please upload a CSV/TXT file or paste email addresses (one per line).',
 ebUploadCsvOnly: '❌ Please upload a <b>.csv</b> or <b>.txt</b> file.',
 ebUploadHtmlFile: '📎 Please upload an <b>.html</b> file, or tap ❌ Cancel to start over.',
 ebTypeOrUpload: '📝 Please type your email message or upload an HTML file.',
 ebEnterSubject: '✏️ Enter the new <b>Subject</b> line:',
 ebChooseTextOrHtml: 'Please choose: "📝 Type Plain Text" or "📎 Upload HTML File"',
 ebTypeText: '📝 Type Plain Text',
 ebUploadHtml: '📎 Upload HTML File',
 ebInvalidEmail: '❌ Invalid email address. Please enter a valid email (e.g., you@gmail.com):',
 ebFailedReadHtml: '❌ Failed to read HTML file. Please try again or upload a different file.',
 ebBundleNotFound: '❌ Bundle not found.',
 ebCampaignNotFound: '❌ Campaign not found.',
 ebTestSending: (addr) => `⏳ Sending test email to <b>${addr}</b> via Brevo...`,
 ebAddDomainBtn: '➕ Add Domain',
 ebRemoveDomainBtn: '❌ Remove Domain',
 ebDashboardBtn: '📊 Dashboard',
 ebManageDomainsBtn: '🌐 Manage Domains',
 ebManageIpsBtn: '🖥️ Manage IPs & Warming',
 ebPricingBtn: '💰 Pricing Settings',
 ebSuppressionBtn: '🚫 Suppression List',
 ebAddIpBtn: '➕ Add IP',
 ebPauseIpBtn: '⏸ Pause IP',
 ebResumeIpBtn: '▶️ Resume IP',
 ebAdminPanelTitle: '⚙️ <b>Email Admin Panel</b>',
 ebNoDomains: '📭 No domains configured.',
 ebDomainRemoved: (d) => `✅ Domain <b>${d}</b> removed successfully.\n\nDNS records cleaned up.`,
 ebDomainRemoveFailed: (err) => `❌ Failed to remove: ${err}`,
 ebInvalidDomain: '❌ Invalid domain name. Please enter a valid domain (e.g., example.com)',
 ebInvalidIp: '❌ Invalid IP address. Please enter a valid IPv4 (e.g., 1.2.3.4)',
 ebSettingUpDomain: (d) => `⏳ Setting up <b>${d}</b>...\n\nCreating DNS records, generating DKIM keys...`,
 ebNoActiveIps: 'No active IPs to pause.',
 ebNoPausedIps: 'No paused IPs.',
 ebIpPaused: (ip) => `⏸ IP ${ip} paused.`,
 ebIpResumed: (ip) => `▶️ IP ${ip} resumed.`,
 ebRateUpdated: (rate) => `✅ Rate updated to <b>$${rate}/email</b> ($${(rate * 500).toFixed(0)} per 500)`,
 ebMinUpdated: (min) => `✅ Minimum emails updated to <b>${min}</b>`,
 ebInvalidRate: '❌ Invalid. Enter a number like 0.10',
 ebInvalidMin: '❌ Invalid. Enter a number.',
 ebSelectIpDomain: (ip) => `🖥️ Assign IP <b>${ip}</b> to which domain?`,

 // ── Audio Library / IVR i18n ──
 audioLibTitle: '🎵 <b>Audio Library</b>',
 audioLibEmpty: '🎵 <b>Audio Library</b>\n\nYou have no saved audio files.\n\nUpload an audio file (MP3, WAV, OGG) to use in IVR campaigns.',
 audioLibEmptyShort: '🎵 <b>Audio Library</b>\n\nNo audio files. Upload one to get started.',
 audioUploadBtn: '📎 Upload Audio',
 audioUploadNewBtn: '📎 Upload New Audio',
 audioUseTemplateBtn: '📝 Use IVR Template',
 audioSelectOption: 'Select an option:',
 audioSelectIvr: 'Select IVR Audio:',
 audioReceived: (size) => `✅ Audio received! (${size} KB)\n\nGive it a name for your library:`,
 audioReceivedShort: '✅ Audio received!\n\nGive it a name:',
 audioSaved: (name) => `✅ Audio saved as: <b>${name}</b>\n\nYou can now use it in IVR campaigns!`,
 audioDeleted: (name) => `✅ Deleted: <b>${name}</b>`,
 audioGenFailed: (err) => `❌ Audio generation failed: ${err}`,
 audioFailedSave: '❌ Failed to save audio greeting. Please try again.',
 audioMaxImages: '📸 Maximum 5 images. Tap ✅ Done Uploading to continue.',

 // ── Common i18n ──
 chooseOption: 'Please choose an option:',
 refreshStatusBtn: '🔄 Refresh Status',
 cancelRefundBtn: '❌ Cancel & Refund',
 dbConnectRetry: 'Database is connecting, please try again in a moment',
 nsCannotAdd: 'Nameserver records cannot be added. Use <b>Update DNS Record</b> to change nameservers.',
 noSupportSession: 'No active support session.',
 noPendingLeads: '📝 No pending lead requests.',
 invalidAmountPositive: '⚠️ Amount must be a positive number.',

 // ── Marketplace ──
 mpHome: '🏪 <b>NOMADLY MARKETPLACE</b>\n\n💰 <b>Sell your digital goods</b> — list in 60 seconds, get paid instantly\n🛍️ <b>Find exclusive deals</b> — verified sellers, real transactions\n\n🔒 <b>ESCROW IS MANDATORY</b> for all purchases via @Lockbaybot\n⚠️ NEVER pay sellers directly or through their bots — use escrow ONLY.\n\n👇 Ready to earn or shop?',
 mpBrowse: '🔥 Browse Deals',
 mpListProduct: '💰 Start Selling',
 mpMyConversations: '💬 My Conversations',
 mpMyListings: '📦 My Listings',
 mpAiHelper: '🤖 Ask AI',
 mpAiHelperPrompt: '🤖 <b>Marketplace AI Assistant</b>\n\nAsk me anything about buying, selling, escrow, or marketplace safety.\n\nType your question below or tap ↩️ Back to return.',
 mpAiThinking: '🤖 Thinking...',
 mpAiScamWarning: '🚨 <b>AI Safety Alert</b>\n\n⚠️ This message may contain a suspicious payment request. Remember:\n\n🔒 <b>ALWAYS use @Lockbaybot escrow</b>\n❌ NEVER send money via PayPal, CashApp, crypto, or wire transfer\n📢 Type /report if you feel unsafe\n\nYour protection is our priority.',
 mpUploadImages: '📸 Upload product images (1-5 photos).\nSend photos one by one. When done, tap ✅ Done Uploading.',
 mpDoneUpload: '✅ Done Uploading',
 mpEnterTitle: '📝 Enter product title (max 100 chars):',
 mpEnterDesc: '📄 Enter product description (max 500 chars):',
 mpEnterPrice: '💰 Set price in USD ($20 - $5,000):',
 mpSelectCategory: '🏷️ Select a category:',
 mpPreview: (title, desc, price, category, imageCount) =>
 `✅ <b>Product Preview</b>\n\n📦 <b>${title}</b>\n📄 ${desc}\n💰 <b>$${Number(price).toFixed(2)}</b>\n📂 ${category}\n📸 ${imageCount} image(s)\n\n🔒 Escrow Protected via @Lockbaybot`,
 mpPublish: '✅ Publish',
 mpCancel: '❌ Cancel',
 mpEditProduct: '✏️ Edit',
 mpRemoveProduct: '❌ Remove Listing',
 mpMarkSold: '✅ Mark as Sold',
 mpProductPublished: '🎉 Your listing is LIVE!\n\nBuyers can now discover it in the marketplace.\n\n⚠️ <b>Reminder:</b> All sales must go through @Lockbaybot escrow.\n\n💡 <b>Tips to sell faster:</b>\n• Respond to inquiries within minutes\n• Add clear photos & detailed descriptions\n• Price competitively',
 mpProductRemoved: '✅ Listing removed.',
 mpProductSold: '✅ Listing marked as sold.',
 mpMaxListings: "❌ You've reached the max of 10 active listings. Remove or mark some as sold to list more.",
 mpPriceError: '❌ Price must be between $20 and $5,000 USD.',
 mpNoImage: '📸 Please upload at least one product image.',
 mpImageAsPhoto: '📸 Please send the image as a photo, not a file.',
 mpOwnProduct: '❌ You cannot inquire about your own listing.',
 mpNoProducts: '📭 No products found. Check back later!',
 mpNoListings: '📭 You have no listings yet.',
 mpNoConversations: '📭 No active conversations.',
 mpChatStartBuyer: (title, price) =>
 `💬 You're chatting with the seller about <b>${title}</b> ($${price})\n\n⚠️ <b>ESCROW IS MANDATORY</b> — type /escrow to pay safely via @Lockbaybot\n❌ Do NOT pay the seller directly or through any external bot.\n\n💡 Ask for details or proof before purchasing.\nSend /done to end chat.`,
 mpChatStartSeller: (title) =>
 `💬 🔔 A buyer is interested in <b>${title}</b>!\n🔒 Escrow-protected via @Lockbaybot\n\n💡 Tip: Respond quickly — fast sellers close more deals.\nReply below. Send /done to end chat.`,
 mpMessageSent: '✅ Message sent',
 mpSellerChatReady: (title) =>
 `💬 You are now in chat for <b>${title}</b>.\nType your reply below. Send /done to exit, /escrow to start escrow, /price XX to suggest price.`,
 mpBuyerSays: (msg) => `💬 <b>Buyer:</b> ${msg}`,
 mpSellerSays: (msg) => `💬 <b>Seller:</b> ${msg}`,
 mpChatEnded: '💬 Conversation ended. Both parties have been notified.',
 mpChatEndedNotify: (title) => `💬 Conversation about <b>${title}</b> has been closed.`,
 mpChatInactive: (title) => `💬 Conversation about <b>${title}</b> has been closed due to inactivity.`,
 mpSellerOffline: "⏳ Seller hasn't responded in 24 hours. You may browse other listings.",
 mpRateLimit: '⚠️ Message limit reached. Please wait before sending more.',
 mpOnlyTextPhoto: '⚠️ Only text and photos can be sent in marketplace chat.',
 mpPaymentWarning: '🚨 <b>WARNING: Direct payment detected!</b>\n\n❌ NEVER send money directly to the seller or through their bot.\n🔒 Escrow via @Lockbaybot is <b>MANDATORY</b> — it\'s the only way to protect your money.\n📢 Type /report if you feel unsafe.',
 mpEscrowMsg: (title, price, sellerRef) =>
 `🔒 <b>ESCROW — MANDATORY PURCHASE</b>\n\n📦 Product: <b>${title}</b>\n💰 Price: <b>$${Number(price).toFixed(2)}</b>\n👤 Seller: <b>${sellerRef}</b>\n\n1. Tap below to open @Lockbaybot\n2. Create escrow with <b>${sellerRef}</b> for <b>$${Number(price).toFixed(2)}</b>\n3. Both parties confirm\n\n⚠️ NEVER pay outside escrow or through seller\'s bot`,
 mpPriceSuggest: (role, amount) => `💰 <b>${role}</b> suggests: <b>$${amount}</b>`,
 mpPriceUsage: 'Usage: /price 50 to suggest $50',
 mpPriceInvalid: '❌ Invalid amount. Must be $20 - $5,000.',
 mpReported: '✅ Report submitted. Admin will review this conversation.',
 mpChatMode: '⚠️ You\'re in a marketplace chat. Send /done to exit first.',
 mpExistingConv: '💬 You already have an active conversation about this product. Resuming...',
 mpAllCategories: '📋 All Categories',
 mpEditWhat: '✏️ What would you like to edit?',
 mpEditTitle: '📝 Edit Title',
 mpEditDesc: '📄 Edit Description',
 mpEditPrice: '💰 Edit Price',
 mpTitleUpdated: '✅ Title updated.',
 mpDescUpdated: '✅ Description updated.',
 mpPriceUpdated: '✅ Price updated.',
 mpListingRemoved: '📦 [Listing Removed]',
 mpSellerStats: (sales, since) => `⭐ Seller: ${sales} sale${sales !== 1 ? 's' : ''} | Joined ${since}`,
 mpProductCard: (title, price, category, sellerStats) =>
 `🏷️ <b>${title}</b>\n💰 <b>$${Number(price).toFixed(2)}</b> · ${category}\n${sellerStats}\n🔒 ⚠️ Escrow Mandatory — pay via @Lockbaybot only`,
 mpProductDetail: (title, desc, price, category, sellerStats, listedAgo) =>
 `📦 <b>${title}</b>\n\n📄 ${desc}\n\n💰 Price: <b>$${Number(price).toFixed(2)}</b>\n📂 ${category}\n${sellerStats}\n📅 Listed: ${listedAgo}\n\n🔒 <b>ESCROW IS MANDATORY</b>\nPay ONLY via @Lockbaybot escrow. Never pay the seller directly or through their bot.`,
 mpMyListingsHeader: (count, max) => `📦 <b>MY LISTINGS</b> (${count}/${max})`,
 mpConvHeader: '💬 <b>MY CONVERSATIONS</b>',
 mpConvItem: (title, role, lastMsg) => `💬 <b>${title}</b> (${role}) — ${lastMsg}`,
 mpDoneCmd: '/done',
 mpEscrowCmd: '/escrow',
 mpPriceCmd: '/price',
 mpReportCmd: '/report',
 mpEnteredChat: (title, price) => `💬 You entered chat for <b>${title}</b> ($${price})\nSend /done to exit, /escrow to start escrow, /price XX to suggest price.`,
 mpResumedChat: (title, price, role) => `💬 Resumed chat: <b>${title}</b> ($${price}) — You are the ${role}\n⚠️ <b>ESCROW MANDATORY</b> — pay only via @Lockbaybot. Never pay seller directly or through their bot.\n\nSend /done to exit, /escrow to start escrow, /price XX to suggest price.`,
 mpBuyerPhotoCaption: '💬 Buyer sent a photo:',
 mpSellerPhotoCaption: '💬 Seller sent a photo:',
 mpChatClosedReset: (title) => `💬 The conversation about <b>${title}</b> was closed by the other party. You have been returned to the marketplace.`,
 mpSellerBusy: (title) => `🆕 New inquiry for <b>${title}</b>! Tap the button below to reply when you\'re ready.`,
 mpCatDigitalGoods: '💻 Digital Goods',
 mpCatBnkLogs: '🏦 Bnk Logs',
 mpCatBnkOpening: '🏧 Bnk Opening',
 mpCatTools: '🔧 Tools',

 // === Cloud Phone/IVR ===
 cp_1: '⚠️ NGN deposits temporarily unavailable (exchange rate service down). Please try crypto.',
 cp_10: (TRIAL_CALLER_ID) => `📢 <b>Quick IVR Call — Free Trial</b>\n\n🎁 You get <b>1 free trial call!</b>\n📱 Caller ID: <b>${TRIAL_CALLER_ID}</b> (shared)\n\nCall a single number with an automated IVR message.\n\nEnter the phone number to call (with country code):\n<i>Example: +12025551234</i>`,
 cp_100: '🎚 <b>Select Speaking Speed</b>:',
 cp_101: '❌ Invalid speed. Enter a number between <b>0.25</b> and <b>4.0</b>:\\n<i>Example: 0.8 or 1.3</i>',
 cp_102: 'Please select a speed from the buttons:',
 cp_103: (voiceName, speedLabelDisplay) => `🎤 Voice: <b>${voiceName}</b> | 🎚 Speed: <b>${speedLabelDisplay}</b>\n\n⏳ Generating audio preview...`,
 cp_104: (message) => `❌ Audio generation failed.\n\n💡 <b>Tip:</b> Try selecting <b>ElevenLabs</b> as the voice provider — it tends to be more reliable.\n\n<i>Error: ${message}</i>`,
 cp_105: '🎙 <b>Select Voice Provider</b>\\n\\nChoose your TTS engine:',
 cp_106: '🎙 <b>Select Voice Provider</b>\\n\\nChoose your TTS engine:',
 cp_107: '🎚 <b>Select Speaking Speed</b>\\n\\nChoose how fast the voice speaks:',
 cp_108: (holdMusic, v1) => `🎵 Hold Music: <b>${holdMusic}</b>\n${v1}`,
 cp_109: 'What would you like to do?',
 cp_11: (buyLabel) => `📞 <b>Bulk IVR Campaign</b>\n\n🔒 This feature requires the <b>Pro</b> plan or higher.\n\nGet a Cloud IVR number first!\n\nTap <b>${buyLabel}</b> to get started.`,
 cp_110: 'Audio not ready. Please tap ✅ Confirm instead.',
 cp_111: '⏭ <b>Skipping preview — Ready to call!</b>',
 cp_112: 'Tap <b>✅ Confirm</b> to proceed, <b>🎤 Change Voice</b>, or <b>Back</b>.',
 cp_113: 'What would you like to do?',
 cp_114: '🕐 <b>Schedule Call</b>\\n\\nHow many minutes from now should the call go out?\\n\\n<i>Examples: 5, 15, 30, 60</i>',
 cp_115: 'Please enter between 1 and 1440 minutes.',
 cp_116: (targetNumber, minutes, toLocaleTimeString) => `✅ <b>Call Scheduled!</b>\n\n📞 To: ${targetNumber}\n🕐 In: ${minutes} minutes (${toLocaleTimeString} UTC)\n\nYou'll be notified when the call is placed.`,
 cp_117: (toFixed, v1) => `⚠️ <b>Insufficient Wallet Balance</b>\n\nQuick IVR calls require a minimum balance of <b>$${toFixed}</b>.\n\nYour balance: <b>$${v1}</b>\n\nPlease top up your wallet and try again.`,
 cp_118: '🚫 <b>Call Blocked</b>\\n\\nYour phone number is missing sub-account credentials. Please contact support.',
 cp_119: (batchCount, length, target) => `📞 Batch ${batchCount}/${length}: Calling ${target}...`,
 cp_12: '📞 <b>Bulk IVR Campaign</b>\\n\\nCall multiple numbers with an automated IVR message.\\nUpload a CSV of leads and launch a campaign.\\n\\n☎️ = Bulk IVR capable numbers\\n\\n📱 Select the Caller ID:',
 cp_120: '💾 Want to save this as a Quick Dial preset for next time?',
 cp_121: 'Press <b>/yes</b> to place the call or <b>/cancel</b> to abort.',
 cp_122: (presetName) => `✅ Preset "<b>${presetName}</b>" saved!\n\nNext time, select it from the Quick IVR menu to skip setup.`,
 cp_123: '🎵 <b>Audio Library</b>\\n\\nNo audio files. Upload one to get started.',
 cp_124: (audioList) => `🎵 <b>Audio Library</b>\n\n${audioList}`,
 cp_125: 'Select an option:',
 cp_126: (audioList) => `🎵 <b>Audio Library</b>\n\n${audioList}`,
 cp_127: '⏳ Downloading and saving audio...',
 cp_128: 'Please send an audio file (MP3, WAV, OGG) or a voice message.',
 cp_129: 'Send me an audio file or voice message:',
 cp_13: '🎵 <b>Audio Library</b>\\n\\nYou have no saved audio files.\\n\\nUpload an audio file (MP3, WAV, OGG) to use in IVR campaigns.',
 cp_130: (name) => `✅ Audio saved as: <b>${name}</b>\n\nYou can now use it in Bulk IVR Campaigns!`,
 cp_131: 'Please select a caller ID from the list.',
 cp_132: (phoneNumber) => `📱 Caller ID: <b>${phoneNumber}</b>\n\n📋 <b>Upload Leads File</b>\n\nSend a text file (.txt or .csv) with one phone number per line.\nOptional: <code>number,name</code> per line.\n\nOr paste the numbers directly (one per line):`,
 cp_133: 'Select the Caller ID:',
 cp_134: (message) => `❌ Failed to read file: ${message}\n\nTry again or paste numbers directly.`,
 cp_135: 'Please send a file or paste phone numbers.',
 cp_136: (errMsg) => `❌ No valid phone numbers found.${errMsg}\n\nPlease check format: one number per line, with + country code.`,
 cp_137: (maxLeads, length) => `❌ <b>Too many leads!</b>\n\nMaximum <b>${maxLeads}</b> numbers per campaign.\nYou uploaded <b>${length}</b>.\n\nPlease reduce your list and try again.`,
 cp_138: (length, preview, more, errNote, estCost, toFixed) => `✅ <b>${length} leads loaded!</b>\n\n${preview}${more}${errNote}\n\n💰 <b>Estimated cost: $${estCost}</b> ($${toFixed}/min per number, min 1 min each — charged whether answered or not)\n\n🎵 <b>Select IVR Audio</b>\n\nChoose from your audio library, upload a new recording, or generate from a template with TTS:`,
 cp_139: '📋 Send a leads file or paste numbers:',
 cp_14: (audioList) => `🎵 <b>Audio Library</b>\n\n${audioList}\n\nUpload a new audio or delete an existing one:`,
 cp_140: '🎵 Send an audio file (MP3, WAV, OGG) or voice message:',
 cp_141: '📝 <b>Generate Audio from Template</b>\\n\\nChoose a template category, or write your own custom script:',
 cp_142: 'Audio not found. Select from the list.',
 cp_143: (name) => `🎵 Audio: <b>${name}</b>\n\n📋 <b>Select Campaign Mode</b>\n\n🔗 <b>Transfer + Report</b> — When lead presses a key, bridge to your phone + always report\n📊 <b>Report Only</b> — Just track who pressed a key, no transfer + always report\n\nBoth modes report full results (who pressed, who hung up, etc.)`,
 cp_144: 'Select an audio file:',
 cp_145: 'Select IVR Audio:',
 cp_146: '⏳ Saving audio...',
 cp_147: (message) => `❌ Upload failed: ${message}`,
 cp_148: 'Send an audio file or voice message:',
 cp_149: (name) => `✅ Saved as: <b>${name}</b>\n\n📋 <b>Select Campaign Mode</b>\n\n🔗 <b>Transfer + Report</b> — Pressing 1 bridges to your phone\n📊 <b>Report Only</b> — Just track responses\n\nBoth modes always report full results.`,
 cp_15: '📞 <b>New IVR Call</b>\\n\\nSelect the number to call FROM (Caller ID):',
 cp_150: 'Select IVR Audio:',
 cp_151: '🔗 <b>Transfer Mode</b>\\n\\nEnter the number to transfer calls when lead presses the active key:\\n<i>(Your SIP number or any phone number)</i>\\n<i>Example: +41791234567</i>',
 cp_152: '📊 <b>Report Only</b> — no transfers, just tracking.\\n\\n🔘 <b>Select Active Keys</b>\\n\\nWhich keys should count as a positive response?\\n\\nPick a preset or enter custom digits:',
 cp_153: 'Select a mode:',
 cp_154: 'Select Campaign Mode:',
 cp_155: 'Enter a valid phone number with + country code.\\n<i>Example: +41791234567</i>',
 cp_156: (clean) => `🔗 Transfer to: <b>${clean}</b>\n\n🔘 <b>Select Active Keys</b>\n\nWhich keys trigger the transfer?\n\nPick a preset or enter custom digits:`,
 cp_157: 'Enter the transfer number:',
 cp_158: 'Select Campaign Mode:',
 cp_159: 'Enter the digits that count as active keys:\\n<i>Example: 1,3,5 or 1 2 3</i>',
 cp_16: 'No presets to delete.',
 cp_160: 'Please select a preset or enter digits:',
 cp_161: (join) => `🔘 Active keys: <b>${join}</b>\n\n⚡ <b>Set Concurrency</b>\n\nHow many simultaneous calls? (1-20)\nDefault: <b>10</b>`,
 cp_162: '🔘 <b>Select Active Keys</b>',
 cp_163: 'Enter at least one digit (0-9):\\n<i>Example: 1,3,5</i>',
 cp_164: (join) => `🔘 Active keys: <b>${join}</b>\n\n⚡ <b>Set Concurrency</b>\n\nHow many simultaneous calls? (1-20)\nDefault: <b>10</b>`,
 cp_165: 'Select IVR Audio:',
 cp_166: '✍️ <b>Custom Script</b>\\n\\nType the message to be spoken.\\nUse "press 1", "press 2" etc. in your text to define active keys.\\n\\n<i>Example: Hello, this is a reminder about your appointment. Press 1 to confirm or press 2 to reschedule.</i>',
 cp_167: 'Please select a category:',
 cp_168: 'Select a template:',
 cp_169: 'Choose a template category:',
 cp_17: '🗑️ <b>Delete Preset</b>\\n\\nSelect a preset to delete:',
 cp_170: (icon, firstPh, description, generated) => `${icon} <b>[${firstPh}]</b> — ${description}\n\nAuto-generated: <b>${generated}</b>\nTap to accept, regenerate, or type your own:`,
 cp_171: (icon, firstPh, description) => `${icon} <b>[${firstPh}]</b> — ${description}\n\nSelect from the list or type your own:`,
 cp_172: (icon, firstPh, description, hint) => `${icon} <b>[${firstPh}]</b> — ${description}\n\n${hint}`,
 cp_174: (placeholders) => `Enter value for <b>[${placeholders}]</b>:`,
 cp_175: (join) => `🔘 Active keys: <b>${join}</b>\n\n🎙 <b>Select Voice Provider</b>\n\nChoose your TTS engine:`,
 cp_176: 'Choose a template category:',
 cp_177: 'Please select a template from the buttons.',
 cp_178: (icon, name, text, join) => `📋 <b>${icon} ${name}</b>\n\n<i>"${text}"</i>\n\n🔘 Active keys: <b>${join}</b>`,
 cp_179: (icon, firstPh, description, generated) => `\n${icon} <b>[${firstPh}]</b> — ${description}\n\nAuto-generated: <b>${generated}</b>\nTap to accept, regenerate, or type your own:`,
 cp_18: (presetName) => `✅ Preset "${presetName}" deleted.`,
 cp_180: (icon, firstPh, description) => `\n${icon} <b>[${firstPh}]</b> — ${description}\n\nSelect from the list or type your own:`,
 cp_181: (icon, firstPh, description, hint) => `\n${icon} <b>[${firstPh}]</b> — ${description}\n\n${hint}`,
 cp_183: (placeholders) => `\nEnter value for <b>[${placeholders}]</b>:`,
 cp_184: '🎙 <b>Select Voice</b>:',
 cp_185: 'Choose a template category:',
 cp_186: (icon, currentPh, generated) => `${icon} <b>[${currentPh}]</b> — regenerated: <b>${generated}</b>\nTap to accept, regenerate, or type your own:`,
 cp_187: (currentPh) => `✍️ Type your custom value for <b>[${currentPh}]</b>:`,
 cp_188: (currentPh) => `✍️ Type the callback number for <b>[${currentPh}]</b>:\n<i>Example: +12025551234</i>`,
 cp_189: (currentPh, value, icon, nextPh, description, generated) => `✅ ${currentPh}: <b>${value}</b>\n\n${icon} <b>[${nextPh}]</b> — ${description}\n\nAuto-generated: <b>${generated}</b>\nTap to accept, regenerate, or type your own:`,
 cp_19: 'Preset not found.',
 cp_190: (currentPh, value, icon, nextPh, description) => `✅ ${currentPh}: <b>${value}</b>\n\n${icon} <b>[${nextPh}]</b> — ${description}\n\nSelect from the list or type your own:`,
 cp_191: (currentPh, value, icon, nextPh, description, hint) => `✅ ${currentPh}: <b>${value}</b>\n\n${icon} <b>[${nextPh}]</b> — ${description}\n\n${hint}`,
 cp_193: (currentPh, value, nextPh) => `✅ ${currentPh}: <b>${value}</b>\n\nEnter value for <b>[${nextPh}]</b>:`,
 cp_194: '✅ All values filled!\\n\\n🎙 <b>Select Voice Provider</b>\\n\\nChoose your TTS engine:',
 cp_195: 'Choose a template category:',
 cp_196: 'Please select a voice provider:',
 cp_197: '🎙 <b>Select Voice</b>:',
 cp_198: '🎙 <b>Select Voice Provider</b>\\n\\nChoose your TTS engine:',
 cp_199: 'Please select a voice:',
 cp_2: (toLocaleString) => `⚠️ Minimum deposit is ₦${toLocaleString} (≈ $10 USD). Please enter a higher amount.`,
 cp_20: (presetName, currentPlan) => `🔒 <b>Preset "${presetName}" uses OTP Collection</b>, which requires the <b>Business</b> plan.\n\nYour current plan: <b>${currentPlan}</b>\n\nUpgrade via 🔄 Renew / Change Plan, or create a new call with 🔗 Transfer mode.`,
 cp_200: (name) => `🎤 Voice: <b>${name}</b>\n\n🎚 <b>Select Speaking Speed</b>\n\nChoose how fast the voice speaks:`,
 cp_201: '🎙 <b>Select Voice Provider</b>\\n\\nChoose your TTS engine:',
 cp_202: '✍️ Enter a custom speed multiplier:\\n<i>Examples: 0.6 (very slow), 0.9 (slightly slow), 1.2 (faster), 1.5 (very fast)\\nRange: 0.25 to 4.0</i>',
 cp_203: '🎚 <b>Select Speaking Speed</b>:',
 cp_204: '❌ Invalid speed. Enter a number between <b>0.25</b> and <b>4.0</b>:\\n<i>Example: 0.8 or 1.3</i>',
 cp_205: 'Please select a speed from the buttons:',
 cp_206: (voiceName, speedLabel) => `🎤 Voice: <b>${voiceName}</b> | 🎚 Speed: <b>${speedLabel}</b>\n\n⏳ Generating audio...`,
 cp_207: (message) => `❌ Audio generation failed.\n\n💡 <b>Tip:</b> Try selecting <b>ElevenLabs</b> as the voice provider — it tends to be more reliable.\n\n<i>Error: ${message}</i>`,
 cp_208: 'Choose a template category:',
 cp_209: '🎙 <b>Select Voice Provider</b>\\n\\nChoose your TTS engine:',
 cp_21: (presetName, callerId, templateName, voiceName) => `💾 <b>Loaded Preset: ${presetName}</b>\n📱 From: ${callerId}\n🏢 Template: ${templateName}\n🎙 Voice: ${voiceName}\n\nEnter the number to call (or multiple separated by commas):\n<i>Example: +12025551234</i>\n<i>Batch: +12025551234, +12025555678</i>`,
 cp_210: '🎚 <b>Select Speaking Speed</b>\\n\\nChoose how fast the voice speaks:',
 cp_211: '❌ No audio generated. Try again.',
 cp_212: (audioName, join) => `✅ Audio saved: <b>${audioName}</b>\n🔘 Active keys (from template): <b>${join}</b>\n\n📋 <b>Select Campaign Mode</b>\n\n🔗 <b>Transfer + Report</b> — When lead presses a key, bridge to your phone + always report\n📊 <b>Report Only</b> — Just track who pressed a key, no transfer + always report`,
 cp_213: 'Tap <b>✅ Use This Audio</b> or <b>🎤 Change Voice</b>.',
 cp_214: '🔘 <b>Select Active Keys</b>',
 cp_215: 'Enter a number between 1 and 20:',
 cp_216: 'Set concurrency (1-20):',
 cp_217: '❌ Missing campaign data. Please start over.',
 cp_218: '⏳ Creating campaign...',
 cp_219: (errorvoice) => `❌ Failed to start: ${errorvoice}`,
 cp_22: 'No eligible caller ID found.',
 cp_220: 'Campaign is running! You\'ll see progress updates here.',
 cp_221: (messagevoice) => `❌ Campaign launch failed: ${messagevoice}`,
 cp_222: 'Tap 🚀 Launch Campaign or ↩️ Back.',
 cp_223: 'Tap for options:',
 cp_224: 'Campaign in progress. Use the button below:',
 cp_225: '🛒 <b>Select Plan:</b>',
 cp_226: '🌍 <b>All Available Countries</b>\\n\\nSelect a country:',
 cp_227: (location, numberLines) => `📱 <b>Available Numbers — ${location}</b>\n\n${numberLines}\n\n☎️ = Supports Bulk IVR Campaigns\n\nTap a number to select:`,
 cp_228: (message, numberLines) => `📱 <b>Available Numbers — ${message}</b>\n\n${numberLines}\n\n☎️ = Supports Bulk IVR Campaigns\n\nTap a number to select:`,
 cp_229: (areaCode, numberLines) => `📱 <b>Available Numbers — Area ${areaCode}</b>\n\n${numberLines}\n\n☎️ = Supports Bulk IVR Campaigns\n\nTap a number to select:`,
 cp_23: (phoneNumber, recentNumber) => `📱 From: <b>${phoneNumber}</b>\n📞 To: <b>${recentNumber}</b>\n\nChoose an IVR template category:`,
 cp_230: (location, numberLines) => `📱 <b>More Numbers — ${location}</b>\n\n${numberLines}\n\n☎️ = Supports Bulk IVR Campaigns\n\nTap a number to select:`,
 cp_231: 'This plan is not yet available. Please choose from the available plans below.',
 cp_232: (planLabel) => `✅ Plan: <b>${planLabel}</b>\n\n🌍 Select a country:`,
 cp_233: '⚠️ Payment processing temporarily unavailable (exchange rate service down). Please try again later or use crypto.',
 cp_234: (toLocaleString) => `Cloud IVR ₦${toLocaleString}`,
 cp_235: '⚠️ Upgrade session expired. Please start again.',
 cp_236: '⚠️ Payment processing temporarily unavailable (exchange rate service down). Please try again later or use crypto.',
 cp_237: (toLocaleString) => `Plan Upgrade ₦${toLocaleString}`,
 cp_238: '⚠️ Upgrade session expired. Please start again.',
 cp_239: '⚠️ No rejected verification found. Please start a new number purchase.',
 cp_24: 'Please select a valid number from the list.',
 cp_240: '⚠️ No rejected verification found.',
 cp_243: '⬇️ Please choose an option below:',
 cp_244: '⚠️ Please enter at least: <code>Street, City, Country</code>\\n\\nExample: <i>123 Main St, Sydney, Australia</i>',
 cp_245: (countryName, toFixed, showWallet) => `❌ Regulatory setup failed for ${countryName}.\n\n💰 <b>$${toFixed}</b> refunded.\n${showWallet}`,
 cp_246: (toFixed, showWallet) => `❌ Regulatory setup failed.\n\n💰 <b>$${toFixed}</b> refunded.\n${showWallet}`,
 cp_247: (toFixed, showWallet) => `❌ Regulatory setup failed.\n\n💰 <b>$${toFixed}</b> refunded.\n${showWallet}`,
 cp_248: (showWallet) => `❌ Regulatory setup failed.\n\n💰 Your wallet has been refunded.\n${showWallet}`,
 cp_249: '💡 <b>Get the most out of your number</b>\\n\\n📲 <b>Set up call forwarding</b> — ring your real phone\\n🤖 <b>Add IVR greeting</b> — professional auto-attendant\\n💬 <b>Enable SMS</b> — send & receive text messages\\n\\nTap Manage Numbers below to configure.',
 cp_25: (phoneNumber) => `📱 Caller ID: <b>${phoneNumber}</b>\n\nEnter the phone number to call (or multiple separated by commas):\n<i>Example: +12025551234</i>\n<i>Batch: +12025551234, +12025555678</i>`,
 cp_250: '⚠️ Payment processing temporarily unavailable (exchange rate service down). Please try again later or use crypto.',
 cp_251: (label, toLocaleString) => `${label} ₦${toLocaleString}`,
 cp_252: (numLines) => `📱 <b>Select which plan to add a number to:</b>\n\n${numLines}`,
 cp_253: (selectedNumber) => `✅ <b>Great news! Your bundle has been approved!</b>\n\n🔄 We're activating your number <code>${selectedNumber}</code> now...`,
 cp_254: '⚠️ Could not refresh status. Please try again.',
 cp_255: '⚠️ This order cannot be cancelled — it\'s already being processed or completed.',
 cp_256: (selectedNumber, toFixed, showWallet) => `✅ <b>Order Cancelled</b>\n\nYour pending order for <code>${selectedNumber}</code> has been cancelled.\n\n💰 <b>$${toFixed}</b> has been refunded to your wallet.\n${showWallet}`,
 cp_257: '⚠️ Could not cancel order. Please contact support.',
 cp_258: 'Please choose an option:',
 cp_259: '🌍 <b>All Available Countries</b>\\n\\nSelect a country:',
 cp_26: '📢 <b>Quick IVR Call</b>\\n\\nCall a single number with an automated IVR message.\\n\\nSelect the number to call FROM (Caller ID):',
 cp_260: (subNumbersAvailable, numberLines, bulkIvrSupport, tapToSelect) => `${subNumbersAvailable}\n\n${numberLines}\n\n${bulkIvrSupport}\n\n${tapToSelect}`,
 cp_261: (subNumberSelected, numberLines, bulkIvrSupport, tapToSelect) => `${subNumberSelected}\n\n${numberLines}\n\n${bulkIvrSupport}\n\n${tapToSelect}`,
 cp_262: (subNumberArea, numberLines, bulkIvrSupport, tapToSelect) => `${subNumberArea}\n\n${numberLines}\n\n${bulkIvrSupport}\n\n${tapToSelect}`,
 cp_263: (numberLines) => `📱 <b>More Numbers</b>\n\n${numberLines}\n\n☎️ = Supports Bulk IVR\n\nTap to select:`,
 cp_264: (newState, v1) => `🎵 Hold Music: <b>${newState}</b>\n${v1}`,
 cp_265: 'Enter a valid URL starting with http:// or https://.',
 cp_266: '📝 Type the greeting callers will hear:',
 cp_267: '🎙️ Send a voice message or audio file.',
 cp_268: '✅ Audio received. Save as greeting?',
 cp_269: '🎤 <b>Custom Greeting</b>\\n\\nChoose how to create your greeting:',
 cp_27: 'Please enter a valid phone number starting with + and 10-15 digits.\\n<i>Example: +12025551234</i>\\n<i>Batch: +12025551234, +12025555678</i>',
 cp_270: (message) => `📋 <b>${message}</b>\n\nSelect a greeting template:`,
 cp_271: (icon, name, text) => `📋 <b>${icon} ${name}</b>\n\n<code>${text}</code>\n\n✏️ You can edit this text — just type your modified version below.\nOr tap <b>✅ Use As-Is</b> to proceed with this greeting.`,
 cp_272: '📋 <b>Greeting Templates</b>\\n\\nSelect a category:',
 cp_273: '🌐 Select the language for your voicemail greeting:\\n\\n<i>The template will be automatically translated to your chosen language.</i>',
 cp_274: '✅ Text updated.\\n\\n🌐 Select the language for your voicemail greeting:\\n\\n<i>The greeting will be automatically translated to your chosen language.</i>',
 cp_275: '🎤 <b>Custom Greeting</b>\\n\\nChoose:',
 cp_276: '🔄 Generating audio preview...',
 cp_277: (voice) => `✅ Preview (${voice})\n\nSave this greeting?`,
 cp_278: (message) => `❌ Audio generation failed: ${message}`,
 cp_279: (translatedText) => `🌐 <b>Translated greeting:</b>\n\n<i>${translatedText}</i>\n\n🎙️ Choose a voice:`,
 cp_280: '🎙️ Choose a voice:',
 cp_281: '🎙 Select a voice provider:',
 cp_282: (message) => `🌐 Translating to ${message}...`,
 cp_283: '🎙 <b>Select Voice Provider</b>\\n\\nChoose your TTS engine:',
 cp_284: '🌐 Select the language for your greeting:',
 cp_285: '📝 Type the greeting text:',
 cp_286: (message) => `🌐 Select the language for your greeting:\n\n<i>"${message}"</i>`,
 cp_287: '🎙 <b>Select Voice Provider</b>\\n\\nChoose your TTS engine:',
 cp_288: '🌐 Select the language for your greeting:',
 cp_289: '📝 Type the greeting text:',
 cp_29: '🔍 Looking up number...',
 cp_290: '🎙️ Send a voice message or audio file.',
 cp_291: '✅ Audio received. Save?',
 cp_292: '✅ Voicemail greeting saved!',
 cp_293: '🎤 <b>Set IVR Greeting</b>\\n\\nChoose how to create your greeting:',
 cp_294: (usedKeys) => `➕ <b>Add Menu Option</b>\n\nUsed keys: ${usedKeys}\n\nEnter the key number (0-9) for this option:`,
 cp_295: '📝 Type the greeting callers will hear.\\n\\n<i>Example: "Thank you for calling Nomadly. Press 1 for sales, press 2 for support."</i>',
 cp_296: '🎙️ Send a voice message or audio file for your IVR greeting.',
 cp_297: '📋 <b>Greeting Templates</b>\\n\\nProfessional templates for financial institutions — fraud hotlines, customer support, after-hours, and more. Select a category:',
 cp_298: 'Choose an option:',
 cp_299: '🎤 <b>Set IVR Greeting</b>\\n\\nChoose how to create your greeting:',
 cp_3: '🛡️🔥 Anti-Red Hosting is currently unavailable. Please tap <b>💬 Get Support</b> on the keyboard to reach us.',
 cp_30: (titleCase) => `📋 Found: <b>${titleCase}</b>`,
 cp_300: (message) => `📋 <b>${message}</b>\n\nSelect a greeting template:`,
 cp_301: (icon, name, text) => `📋 <b>${icon} ${name}</b>\n\n<code>${text}</code>\n\n✏️ You can edit this text — just type your modified version below.\nOr tap <b>✅ Use As-Is</b> to proceed with this greeting.`,
 cp_302: '📋 <b>Greeting Templates</b>\\n\\nSelect a category:',
 cp_303: '🌐 Select the language for your IVR greeting:\\n\\n<i>The template will be automatically translated to your chosen language.</i>',
 cp_304: '✅ Text updated.\\n\\n🌐 Select the language for your IVR greeting:\\n\\n<i>The greeting will be automatically translated to your chosen language.</i>',
 cp_305: '🎤 <b>Set IVR Greeting</b>\\n\\nChoose how to create your greeting:',
 cp_306: '🔄 Generating audio preview...',
 cp_307: (voice) => `✅ Preview generated (${voice})\n\n✅ Save this greeting?\n🔄 Try a different voice?\n📝 Re-type the text?`,
 cp_308: (message) => `❌ Audio generation failed: ${message}\n\nTry again or upload your own audio.`,
 cp_309: (translatedText) => `🌐 <b>Translated greeting:</b>\n\n<i>${translatedText}</i>\n\n🎙️ Choose a voice:`,
 cp_31: '⏳ Regenerating audio for preset (previous audio expired)...',
 cp_310: '🎙️ Choose a voice for your greeting:',
 cp_311: '🎙 Select a voice provider:',
 cp_312: (message) => `🌐 Translating to ${message}...`,
 cp_313: '🎙 <b>Select Voice Provider</b>\\n\\nChoose your TTS engine:',
 cp_314: '🌐 Select the language for your IVR greeting:',
 cp_315: '📝 Type the greeting callers will hear:',
 cp_316: (message) => `🌐 Select the language for your IVR greeting:\n\n<i>"${message}"</i>`,
 cp_317: '✅ Audio received. Save as your IVR greeting?',
 cp_318: '❌ Failed to process audio. Try again.',
 cp_319: '🎙️ Send a voice message or audio file.',
 cp_32: '⚠️ Audio regeneration failed. Please set up the call manually.',
 cp_320: '🎙 <b>Select Voice Provider</b>\\n\\nChoose your TTS engine:',
 cp_321: '🌐 Select the language for your IVR greeting:',
 cp_322: '📝 Type the greeting callers will hear:',
 cp_323: '🎙️ Send a voice message or audio file.',
 cp_324: '✅ IVR greeting saved!',
 cp_325: '✅ Audio received. Save as your IVR greeting?',
 cp_326: '❌ Failed to process audio. Try again.',
 cp_327: 'Choose an option:',
 cp_328: (key) => `What should happen when a caller presses <b>${key}</b>?`,
 cp_329: (message) => `📋 <b>${message}</b>\n\nSelect a template:`,
 cp_33: '⚠️ Preset audio expired and can\'t be regenerated. Please set up the call manually.',
 cp_330: '📋 Select a category:',
 cp_331: (icon, name, text) => `📋 <b>${icon} ${name}</b>\n\n<code>${text}</code>\n\n({ en: "✏️ Type your modified version, or tap <b>✅ Use As-Is</b>", fr: "✏️ Tapez votre version modifiée, ou appuyez sur <b>✅ Utiliser tel quel</b>", zh: "✏️ 输入修改版本，或点击 <b>✅ 直接使用</b>", hi: "✏️ अपना संशोधित संस्करण टाइप करें, या <b>✅ जैसा है</b> दबाएं" }[lang] || "✏️ Type your modified version, or tap <b>✅ Use As-Is</b>"):`,
 cp_332: '🌐 Select the language:\\n\\n<i>The message will be translated automatically.</i>',
 cp_333: '🎙️ Send a voice message or audio file:',
 cp_334: (message) => `🌐 Select the language:\n\n<i>"${message}"</i>`,
 cp_335: (text) => `📋 <b>Message</b>\n\n<code>${text}</code>\n\n({ en: "✏️ Type your modified version, or tap <b>✅ Use As-Is</b>", fr: "✏️ Tapez votre version modifiée, ou appuyez sur <b>✅ Utiliser tel quel</b>", zh: "✏️ 输入修改版本，或点击 <b>✅ 直接使用</b>", hi: "✏️ अपना संशोधित संस्करण टाइप करें, या <b>✅ जैसा है</b> दबाएं" }[lang] || "✏️ Type your modified version, or tap <b>✅ Use As-Is</b>"):`,
 cp_336: '🔄 Generating audio preview...',
 cp_337: (key, voice) => `✅ Preview for key <b>${key}</b> (${voice})\n\nSave this option?`,
 cp_338: (message) => `❌ Audio generation failed: ${message}`,
 cp_339: (translatedText) => `🌐 <b>Translated:</b>\n\n<i>${translatedText}</i>\n\n🎙️ Choose a voice:`,
 cp_34: '💾 <b>Preset loaded — Ready to call!</b>\\n\\nPress <b>/yes</b> to call or <b>/cancel</b> to abort.',
 cp_340: '🎙️ Choose a voice:',
 cp_341: '🎙 Select a voice provider:',
 cp_342: (message) => `🌐 Translating to ${message}...`,
 cp_343: '🎙 <b>Select Voice Provider</b>\\n\\nChoose your TTS engine:',
 cp_344: '🌐 Select the language:',
 cp_345: '🎙 <b>Select Voice Provider</b>\\n\\nChoose your TTS engine:',
 cp_346: '🌐 Select the language:',
 cp_347: '📝 Type the message:',
 cp_348: '🎙️ Send a voice message or audio file:',
 cp_35: (templateName, callerId, voiceName, join) => `💾 <b>Loaded Preset: ${templateName}</b>\n📱 From: ${callerId}\n🎙 Voice: ${voiceName}\n🔘 Active keys: <b>${join}</b>`,
 cp_36: (icon, firstPh, description, generated) => `\n${icon} <b>[${firstPh}]</b> — ${description}\n\nAuto-generated: <b>${generated}</b>\nTap to accept, regenerate, or type your own:`,
 cp_37: (icon, firstPh, description) => `\n${icon} <b>[${firstPh}]</b> — ${description}\n\nSelect from the list or type your own:`,
 cp_38: (icon, firstPh, description, hint) => `\n${icon} <b>[${firstPh}]</b> — ${description}\n\n${hint}`,
 cp_4: (SUPPORT_USERNAME) => `📞 Cloud IVR is coming soon! Contact ${SUPPORT_USERNAME} for updates.`,
 cp_40: (firstPh) => `\nEnter value for <b>[${firstPh}]</b>:`,
 cp_41: '📋 <b>Select Call Mode</b>\\n\\n🔗 <b>Transfer</b> — When target presses the key, bridge them to your number\\n🔑 <b>OTP Collection</b> — Prompt target for a code, you verify via Telegram\\n\\nBoth modes report full results.',
 cp_42: 'Enter the phone number to call (with country code):\\n<i>Example: +12025551234</i>',
 cp_43: '✍️ <b>Custom Script</b>\\n\\nType your IVR message. Use <b>[Brackets]</b> for variables:\\n\\n<b>Standard:</b> [Name], [Company], [Bank], [Amount]\\n<b>Smart (auto-fill):</b> [CardLast4], [CaseID], [ReferenceNum]\\n<b>Smart (pick):</b> [Reason], [Location], [CallBack]\\n\\n<i>Example: Hello [Name]. This is [Bank] security. A charge of $[Amount] was made on card ending [CardLast4]. Case [CaseID]. Press 1 to dispute.</i>\\n\\nType your script:',
 cp_44: 'Select a template:',
 cp_45: 'Please select a category from the buttons.',
 cp_46: '✍️ <b>Custom Script</b>\\n\\nType your IVR message. Use <b>[Brackets]</b> for variables:\\n\\n<b>Standard:</b> [Name], [Company], [Bank], [Amount]\\n<b>Smart (auto-fill):</b> [CardLast4], [CaseID], [ReferenceNum]\\n<b>Smart (pick):</b> [Reason], [Location], [CallBack]\\n\\n<i>Example: Hello [Name]. This is [Bank] security. A charge of $[Amount] was made on card ending [CardLast4]. Case [CaseID]. Press 1 to dispute.</i>\\n\\nType your script:',
 cp_47: '📋 <b>Complete Placeholder Reference</b>\\n\\n<b>🔤 Standard (you type the value):</b>\\n• <code>[Name]</code> — Recipient\'s name\\n• <code>[Bank]</code> — Bank or institution name\\n• <code>[Company]</code> — Company or merchant name\\n• <code>[Amount]</code> — Dollar amount\\n\\n<b>🤖 Smart Auto-Fill (generated for you):</b>\\n• <code>[CardLast4]</code> — Random 4-digit card number\\n• <code>[CaseID]</code> — Random case/reference ID\\n• <code>[ReferenceNum]</code> — Random reference number\\n\\n<b>📋 Smart Pick (choose from presets):</b>\\n• <code>[Reason]</code> — fraud alert, account suspension, unusual activity, etc.\\n• <code>[Location]</code> — City, State format (you type)\\n• <code>[CallBack]</code> — Your Nomadly phone number\\n\\n<b>💡 Tips:</b>\\n• Mix standard + smart placeholders freely\\n• Placeholders are case-sensitive: <code>[Bank]</code> not <code>[bank]</code>\\n• Include "press 1" in your script to auto-detect active keys\\n\\nNow type your script:',
 cp_48: (keyNote) => `${keyNote}\n\nTap <b>✅ Continue</b> to keep these keys, or type new ones:\n<i>Example: 1,2,3 or 1,5,9</i>`,
 cp_49: 'Type your custom IVR script:',
 cp_5: '⚠️ Session expired. Please try purchasing again.',
 cp_50: 'Please enter at least one digit (0-9):\\n<i>Example: 1,2,3</i>',
 cp_51: (join) => `🔘 Active keys updated: <b>${join}</b>`,
 cp_52: (icon, firstPh, description, generated) => `${icon} <b>[${firstPh}]</b> — ${description}\n\nAuto-generated: <b>${generated}</b>\nTap to accept, regenerate, or type your own:`,
 cp_53: (icon, firstPh, description) => `${icon} <b>[${firstPh}]</b> — ${description}\n\nSelect from the list or type your own:`,
 cp_54: (icon, firstPh, description, hint) => `${icon} <b>[${firstPh}]</b> — ${description}\n\n${hint}`,
 cp_56: (firstPh) => `Enter value for <b>[${firstPh}]</b>:`,
 cp_57: '📋 <b>Select Call Mode</b>\\n\\n🔗 <b>Transfer</b> — When target presses the key, bridge them to your number\\n🔑 <b>OTP Collection</b> — Prompt target for a code, you verify via Telegram\\n\\nBoth modes report full results.',
 cp_58: 'Please select a template from the buttons.',
 cp_59: (icon, name, text, join) => `📋 <b>${icon} ${name}</b>\n\n<i>"${text}"</i>\n\n🔘 Active keys: <b>${join}</b>`,
 cp_6: '⚠️ Session expired. Please try purchasing again.',
 cp_60: (icon, firstPh, description, generated) => `\n${icon} <b>[${firstPh}]</b> — ${description}\n\nAuto-generated: <b>${generated}</b>\nTap to accept, regenerate, or type your own:`,
 cp_61: (icon, firstPh, description) => `\n${icon} <b>[${firstPh}]</b> — ${description}\n\nSelect from the list or type your own:`,
 cp_62: (icon, firstPh, description, hint) => `\n${icon} <b>[${firstPh}]</b> — ${description}\n\n${hint}`,
 cp_64: (firstPh) => `\nEnter value for <b>[${firstPh}]</b>:`,
 cp_65: '📋 <b>Select Call Mode</b>\\n\\n🔗 <b>Transfer</b> — When target presses the key, bridge them to your number\\n🔑 <b>OTP Collection</b> — Prompt target for a code, you verify via Telegram\\n\\nBoth modes report full results.',
 cp_66: (icon, currentPh, generated) => `${icon} <b>[${currentPh}]</b> — regenerated: <b>${generated}</b>\nTap to accept, regenerate, or type your own:`,
 cp_67: (currentPh) => `✍️ Type your custom value for <b>[${currentPh}]</b>:`,
 cp_68: (currentPh) => `✍️ Type the callback number for <b>[${currentPh}]</b>:\n<i>Example: +12025551234</i>`,
 cp_69: (currentPh, value, icon, nextPh, description, generated) => `✅ ${currentPh}: <b>${value}</b>\n\n${icon} <b>[${nextPh}]</b> — ${description}\n\nAuto-generated: <b>${generated}</b>\nTap to accept, regenerate, or type your own:`,
 cp_7: '⚠️ No pending session found.',
 cp_70: (currentPh, value, icon, nextPh, description) => `✅ ${currentPh}: <b>${value}</b>\n\n${icon} <b>[${nextPh}]</b> — ${description}\n\nSelect from the list or type your own:`,
 cp_71: (currentPh, value, icon, nextPh, description, hint) => `✅ ${currentPh}: <b>${value}</b>\n\n${icon} <b>[${nextPh}]</b> — ${description}\n\n${hint}`,
 cp_73: (currentPh, value, nextPh) => `✅ ${currentPh}: <b>${value}</b>\n\nEnter value for <b>[${nextPh}]</b>:`,
 cp_74: '✅ All values set!\\n\\n📋 <b>Select Call Mode</b>\\n\\n🔗 <b>Transfer</b> — When target presses the key, bridge them to your number\\n🔑 <b>OTP Collection</b> — Prompt target for a code, you verify via Telegram\\n\\nBoth modes report full results.',
 cp_75: '🔗 <b>Transfer Mode</b>\\n\\nEnter the number to transfer the caller to when they press a key:\\n<i>Example: +17174794833</i>',
 cp_76: '🔒 <b>OTP Collection</b> is not available on the free trial.\\n\\nSubscribe to a <b>Pro</b> or <b>Business</b> plan to use OTP Collection.\\n\\nYou can still use <b>🔗 Transfer</b> mode for your trial call.',
 cp_77: '🔑 <b>OTP Collection Mode</b>\\n\\nHow many digits should the code be?\\n\\n<i>Default: 6 digits</i>',
 cp_78: 'Select a mode:',
 cp_79: '📋 <b>Select Call Mode</b>\\n\\n🔗 <b>Transfer</b> — When target presses the key, bridge them to your number\\n🔑 <b>OTP Collection</b> — Prompt target for a code, you verify via Telegram\\n\\nBoth modes report full results.',
 cp_8: (buyPlansHeader, price, minutes, sms, starter, v5, v6, v7, pro, v9, v10, v11, business) => `${buyPlansHeader}\n\n💡 <b>Starter</b> — $${price}/mo (${minutes} min + ${sms} SMS)\n   • Call forwarding to any number\n   • SMS forwarded to Telegram\n   • Up to ${starter} extra numbers\n\n⭐ <b>Pro</b> — $${v5}/mo (${v6} min + ${v7} SMS)\n   • All Starter features\n   • Voicemail with custom greetings\n   • SIP credentials for softphones\n   • SMS to Telegram & Email\n   • Webhook integrations\n   • Quick IVR Call (single number)\n   • Bulk IVR Campaign\n   • Up to ${pro} extra numbers\n\n👑 <b>Business</b> — $${v9}/mo (${v10} min + ${v11} SMS)\n   • All Pro features\n   • Call Recording & Analytics\n   • OTP Collection via IVR\n   • IVR Auto-Attendant (inbound calls)\n   • Quick IVR Presets & Recent Calls\n   • IVR Redial Button\n   • Call Scheduling\n   • Custom OTP Messages & Goodbye\n   • Consistent TTS Voice/Speed\n   • Priority Support\n   • Up to ${business} extra numbers`,
 cp_80: 'Enter a valid digit count (1-10):',
 cp_81: (length) => `✅ OTP length: <b>${length} digits</b> (max 3 attempts)\n\n✍️ <b>Customize Caller Messages</b>\n\nWould you like to customize what callers hear after verification?\n\n<b>Default Confirm:</b> <i>"Your code has been verified successfully. Thank you. Goodbye."</i>\n<b>Default Reject:</b> <i>"Maximum verification attempts reached. Goodbye."</i>`,
 cp_82: (length) => `✅ OTP length: <b>${length} digits</b> (max 3 attempts)\n\n🎙 <b>Select Voice Provider</b>\n\nChoose your TTS engine:`,
 cp_83: '🔑 <b>OTP Collection Mode</b>\\n\\nHow many digits should the code be?\\n\\n<i>Default: 6 digits</i>',
 cp_84: '🎙 <b>Select Voice Provider</b>\\n\\nChoose your TTS engine:',
 cp_85: '✅ <b>Confirmation Message</b>\\n\\nType what the caller hears when you <b>CONFIRM</b> their code:\\n\\n<i>Example: "Your code has been verified. We\'ve blocked the transaction and secured your account. A specialist will contact you within 24 hours. Thank you for choosing our bank. Goodbye."</i>',
 cp_86: 'Choose an option:',
 cp_87: '✍️ <b>Customize Caller Messages</b>\\n\\nWould you like to customize what callers hear after verification?',
 cp_88: '❌ <b>Rejection Message</b>\\n\\nType what the caller hears when you <b>REJECT</b> their code (max attempts reached):\\n\\n<i>Example: "We were unable to verify your identity. For your security, this session has ended. Please call back or visit your nearest branch for assistance. Goodbye."</i>',
 cp_89: '✅ <b>Confirmation Message</b>\\n\\nType what the caller hears when you <b>CONFIRM</b> their code:',
 cp_9: (buyLabel) => `📢 <b>Quick IVR Call</b>\n\nYou've already used your free trial call.\n\nSubscribe to Cloud IVR to make unlimited IVR calls with your own Caller ID!\n\nTap <b>${buyLabel}</b> to get started.`,
 cp_90: '✅ Custom messages saved!\\n\\n🎙 <b>Select Voice Provider</b>\\n\\nChoose your TTS engine:',
 cp_91: 'Please enter a valid phone number starting with +.\\n<i>Example: +17174794833</i>',
 cp_92: '🎙 <b>Select Voice Provider</b>\\n\\nChoose your TTS engine:',
 cp_93: 'Enter the number to transfer the caller to when they press a key:\\n<i>Example: +17174794833</i>',
 cp_94: 'Please select a voice provider:',
 cp_95: '🎤 <b>Select Voice</b>\\n\\nChoose a voice for the IVR audio:',
 cp_96: '🎙 <b>Select Voice Provider</b>\\n\\nChoose your TTS engine:',
 cp_97: (name) => `🎤 Voice: <b>${name}</b>\n\n🎚 <b>Select Speaking Speed</b>\n\nChoose how fast the voice speaks:`,
 cp_98: '🎙 <b>Select Voice Provider</b>\\n\\nChoose your TTS engine:',
 cp_99: '✍️ Enter a custom speed multiplier:\\n<i>Examples: 0.6 (very slow), 0.9 (slightly slow), 1.2 (faster), 1.5 (very fast)\\nRange: 0.25 to 4.0</i>',

 // === VPS/RDP ===
 vps_1: (message) => `❌ Failed to read file: ${message}`,
 vps_10: '✏️ Enter the new <b>Subject</b> line:',
 vps_11: '⚙️ <b>Email Admin Panel</b>',
 vps_12: '📭 No domains configured.',
 vps_13: '🗑 <b>Remove Domain</b>\\n\\nSelect the domain to remove:',
 vps_14: (domainList) => `🌐 <b>Sending Domains</b>\n\n${domainList}`,
 vps_15: (domainToRemove) => `✅ Domain <b>${domainToRemove}</b> removed successfully.\n\nDNS records cleaned up.`,
 vps_16: (error) => `❌ Failed to remove: ${error}`,
 vps_17: (message) => `❌ Error removing domain: ${message}`,
 vps_18: '🌐 Back to domains.',
 vps_19: '❌ Invalid domain name. Please enter a valid domain (e.g., example.com)',
 vps_2: 'Please choose: "📝 Type Plain Text" or "📎 Upload HTML File"',
 vps_20: (domain) => `⏳ Setting up <b>${domain}</b>...\n\nCreating DNS records, generating DKIM keys...`,
 vps_21: (error) => `❌ Failed: ${error}`,
 vps_22: '⚙️ <b>Email Admin Panel</b>',
 vps_23: 'No active IPs to pause.',
 vps_24: 'Select IP to pause:',
 vps_25: (ip) => `⏸ IP ${ip} paused.`,
 vps_26: 'No paused IPs.',
 vps_27: 'Select IP to resume:',
 vps_28: (ip) => `▶️ IP ${ip} resumed.`,
 vps_29: '🖥️ Back to IPs.',
 vps_3: (totalPrice, toFixed) => `❌ Insufficient balance. You need $${totalPrice} but have $${toFixed}. Please deposit first.`,
 vps_30: '❌ Invalid IP address. Please enter a valid IPv4 (e.g., 1.2.3.4)',
 vps_31: (trim) => `🖥️ Assign IP <b>${trim}</b> to which domain?`,
 vps_32: '🖥️ Back to IPs.',
 vps_33: (ip, domain) => `⏳ Adding IP ${ip} to ${domain} and starting warming...`,
 vps_34: '⚙️ <b>Email Admin Panel</b>',
 vps_35: '💲 Enter new rate per email (e.g., 0.10):',
 vps_36: '📉 Enter new minimum emails per campaign:',
 vps_37: '📈 Enter new maximum emails per campaign:',
 vps_38: '💰 Back to pricing.',
 vps_39: '❌ Invalid. Enter a number like 0.10',
 vps_4: 'Select payment method:',
 vps_40: (rate, toFixed) => `✅ Rate updated to <b>$${rate}/email</b> ($${toFixed} per 500)`,
 vps_41: '💰 Back to pricing.',
 vps_42: '❌ Invalid. Enter a number.',
 vps_43: (min) => `✅ Minimum emails updated to <b>${min}</b>`,
 vps_44: '💰 Back to pricing.',
 vps_45: '❌ Invalid. Enter a number.',
 vps_46: (max) => `✅ Maximum emails updated to <b>${max}</b>`,
 vps_47: '⚠️ Payment processing temporarily unavailable (exchange rate service down). Please try again later or use crypto.',
 vps_48: 'Bank ₦aira + Card 🌐︎',
 vps_49: '💵 Enter the amount you\\\'d like to load ($50 – $1,000):',
 vps_5: '⚠️ Payment processing temporarily unavailable (exchange rate service down). Please try again later or use crypto.',
 vps_50: '⚠️ Payment processing temporarily unavailable (exchange rate service down). Please try again later or use crypto.',
 vps_51: 'Bank ₦aira + Card 🌐︎',
 vps_52: (reason) => `🚫 <b>Marketplace Access Restricted</b>\n\nYou cannot create listings. Your marketplace access has been suspended.\nReason: <i>${reason}</i>`,
 vps_53: (reason) => `🚫 <b>Marketplace Access Restricted</b>\n\nYou cannot create listings. Your marketplace access has been suspended.\nReason: <i>${reason}</i>`,
 vps_54: '❌ Error publishing product. Please try again.',
 vps_55: '🚧 VPS service is coming soon! Stay tuned.',
 vps_56: '🚧 VPS service is coming soon! Stay tuned.',
 vps_57: 'Session expired. Please paste your URL again.',
 vps_58: (displayUrl) => `✅ <b>Link shortened!</b>\n\n🔗 <code>${displayUrl}</code>\n\n📋 Tap to copy`,
 vps_59: (displayUrl) => `✅ <b>Link shortened!</b>\n\n🔗 <code>${displayUrl}</code>\n\n📋 Tap to copy`,
 vps_6: 'Bank ₦aira + Card 🌐︎',
 vps_60: '❌ Error creating short link. Please try again.',
 vps_61: 'Please choose an option:',
 vps_62: 'Session expired. Please paste your URL again.',
 vps_63: '❌ Invalid alias. Use only letters, numbers, and hyphens.',
 vps_64: '❌ Alias must be 2-30 characters long.',
 vps_65: (customAlias) => `❌ Alias <code>${customAlias}</code> is already taken. Try a different one.`,
 vps_66: (displayUrl) => `✅ <b>Link shortened!</b>\n\n🔗 <code>${displayUrl}</code>\n\n📋 Tap to copy`,
 vps_67: (displayUrl) => `✅ <b>Link shortened!</b>\n\n🔗 <code>${displayUrl}</code>\n\n📋 Tap to copy`,
 vps_68: '❌ Error creating short link. Please try again.',
 vps_69: (domain, plan) => `❌ Cannot activate URL shortener — <b>${domain}</b> has an active hosting plan (<b>${plan}</b>).\n\nThe shortener CNAME would replace your hosting A records and take your website offline.\n\nPlease use a different domain, or deactivate your hosting plan first.`,
 vps_7: (toLocaleString, price, totalEmails) => `📧 <b>Email Blast Payment</b>\n\n💵 Amount: <b>₦${toLocaleString}</b> (~$${price})\n📬 Campaign: ${totalEmails} emails\n\n🏦 Complete your payment via the link below:`,
 vps_70: (domain, sanitizeProviderError) => `❌ Could not link <b>${domain}</b>: ${sanitizeProviderError}`,
 vps_71: (domain, sanitizeProviderError) => `❌ DNS error for <b>${domain}</b>: ${sanitizeProviderError}`,
 vps_72: (domain, error) => `❌ DNS error for <b>${domain}</b>: ${error}`,
 vps_73: 'Please choose a valid domain',
 vps_74: (shortUrl) => `Your shortened URL is: ${shortUrl}`,
 vps_75: (shortUrl) => `Your shortened URL is: ${shortUrl}`,
 vps_76: (domain) => `❌ <b>${domain}</b> is blocked and cannot be registered or used due to abuse policy violations.`,
 vps_77: (domain) => `🔍 Searching availability for ${domain} ...`,
 vps_78: (domain) => `❌ <b>${domain}</b> is not available.`,
 vps_79: (baseName) => `🔍 Searching alternatives for <b>${baseName}</b> ...`,
 vps_8: '❌ Invalid email address. Please enter a valid email (e.g., you@gmail.com):',
 vps_80: (altList) => `✅ Available alternatives:\n\n${altList}\n\nType any domain name to check:`,
 vps_81: 'No alternatives found. Try a different name:',
 vps_82: (ns) => `Invalid nameserver: <code>${ns}</code>\nPlease enter valid nameserver hostnames.`,
 vps_83: '⚠️ Payment processing temporarily unavailable (exchange rate service down). Please try again later or use crypto.',
 vps_84: 'Bank ₦aira + Card 🌐︎',
 vps_85: '⚠️ Payment processing temporarily unavailable (exchange rate service down). Please try again later or use crypto.',
 vps_86: 'Bank ₦aira + Card 🌐︎',
 vps_87: '⚠️ Payment processing temporarily unavailable (exchange rate service down). Please try again later or use crypto.',
 vps_88: 'Bank ₦aira + Card 🌐︎',
 vps_89: '⚠️ Payment processing temporarily unavailable (exchange rate service down). Please try again later or use crypto.',
 vps_9: (testAddr) => `⏳ Sending test email to <b>${testAddr}</b> via Brevo...`,
 vps_90: 'Bank ₦aira + Card 🌐︎',
 vps_91: '⚠️ Payment processing temporarily unavailable (exchange rate service down). Please try again later or use crypto.',
 vps_92: 'Bank ₦aira + Card 🌐︎',
 vps_93: 'DNS records are managed by your custom nameserver provider. Use "🔄 Manage Nameservers" to change providers.',
 vps_94: (domain, plan) => `❌ Cannot activate URL shortener — <b>${domain}</b> has an active hosting plan (<b>${plan}</b>).\n\nThe shortener CNAME would replace your hosting A records and take your website offline.\n\nPlease use a different domain, or deactivate your hosting plan first.`,
 vps_95: (domain, sanitizeProviderError) => `❌ Could not link <b>${domain}</b>: ${sanitizeProviderError}`,
 vps_96: (domain, sanitizeProviderError) => `❌ DNS error for <b>${domain}</b>: ${sanitizeProviderError}`,
 vps_97: (domain, error) => `❌ DNS error for <b>${domain}</b>: ${error}`,
 vps_98: (message) => `❌ Error: ${message}`,

 // === Email Validation ===
 ev_1: '🚧 Email Validation service is currently under maintenance. Please try again later.',
 ev_10: (message) => `❌ Error: ${message}`,
 ev_11: '❌ Invalid IPv4 format. Send like: <code>1.2.3.4</code>',
 ev_12: (ipInput) => `✅ IP <code>${ipInput}</code> added to pool.`,
 ev_13: (ipInput) => `✅ IP <code>${ipInput}</code> removed from pool.`,
 ev_14: (message) => `❌ Error: ${message}`,
 ev_15: '❌ Cancelled.',
 ev_16: '❌ Cancelled.',
 ev_17: '❌ Please upload a <b>.csv</b> or <b>.txt</b> file.',
 ev_18: (message) => `❌ Failed to read file: ${message}`,
 ev_19: '📎 Please upload a CSV/TXT file with email addresses.',
 ev_2: '📧 Returning to Email Validation menu...',
 ev_20: '❌ No valid email addresses found in the file. Please check the format.',
 ev_21: (minEmails, length) => `❌ Minimum <b>${minEmails}</b> emails required. Found only ${length}.`,
 ev_22: (toLocaleString, v1) => `❌ Maximum <b>${toLocaleString}</b> emails allowed. Found ${v1}.`,
 ev_23: '❌ Cancelled.',
 ev_24: '📋 Please paste email addresses (one per line or comma-separated).',
 ev_25: '❌ No valid email addresses found. Please check format.',
 ev_26: (maxPasteEmails, length) => `❌ Paste mode supports up to <b>${maxPasteEmails}</b> emails. Found ${length}. Use file upload for larger lists.`,
 ev_27: (minEmails, length) => `❌ Minimum <b>${minEmails}</b> emails required. Found only ${length}.`,
 ev_28: '❌ Cancelled.',
 ev_29: '❌ Session expired. Please start again.',
 ev_3: '⚠️ Could not reach worker',
 ev_30: '❌ Free trial not available for this list size. Please choose a payment method.',
 ev_31: '❌ Free trial already used. Please choose a payment method.',
 ev_32: '❌ Trial + Pay not available. Please choose a payment method.',
 ev_33: '❌ Free trial already used. Please choose a payment method.',
 ev_34: (toFixed, v1) => `⚠️ Insufficient USD balance for extra emails.\n💰 Need: <b>$${toFixed}</b>\n💳 Have: <b>$${v1}</b>\n\nPlease deposit more to your wallet, or pay full price with NGN.`,
 ev_35: (toFixed, v1) => `⚠️ Insufficient USD balance.\n💰 Need: <b>$${toFixed}</b>\n💳 Have: <b>$${v1}</b>\n\nPlease deposit more to your wallet.`,
 ev_36: (toFixed, toLocaleString) => `✅ <b>Payment successful!</b>\n\n💵 Charged: <b>$${toFixed}</b>\n📧 Validating: <b>${toLocaleString} emails</b>\n\n⏳ Processing will begin shortly. You'll receive progress updates.`,
 ev_37: 'Please choose a payment method:',
 ev_4: (message) => `❌ Error: ${message}`,
 ev_5: '⚠️ No IPs found from cloud provider API or credentials missing.',
 ev_6: (message) => `❌ Cloud API error: ${message}`,
 ev_7: '➕ <b>Add IP</b>\\n\\nSend me the IPv4 address to add (e.g. <code>1.2.3.4</code>):',
 ev_8: (message) => `❌ Error: ${message}`,
 ev_9: '♻️ All IP health stats reset to healthy.',

 // === Hosting ===
 host_1: '❌ Payment processing error. Please contact support.',
 host_10: (startsWith) => `✅ <b>Link shortened!</b>\n\n🔗 <code>${startsWith}</code>\n\n📋 Tap to copy`,
 host_11: (startsWith) => `✅ <b>Link shortened!</b>\n\n🔗 <code>${startsWith}</code>\n\n📋 Tap to copy`,
 host_12: '❌ Error creating short link. Please try again.',
 host_13: 'not authorized',
 host_14: 'not authorized',
 host_15: (userToUnblock) => `User ${userToUnblock} not found`,
 host_16: (userToUnblock) => `User ${userToUnblock} has been unblocked.`,
 host_17: 'not authorized',
 host_18: 'not authorized',
 host_19: (previewText, statsText) => `${previewText}\n\n${statsText}\n\nReady to broadcast?`,
 host_2: 'Hello, Admin! Please select an option:',
 host_20: '🚀 Starting broadcast... This may take a while for large user bases.',
 host_21: (message) => `❌ Broadcast failed: ${message}`,
 host_22: '📤 Broadcast initiated! You\\\'ll receive progress updates.',
 host_23: (message, plan) => `<b>${message}</b> is already on a ${plan}. Choose a different domain.`,
 host_24: 'Please select a domain from the list.',
 host_25: '✅ You are already on the highest plan (Golden Anti-Red). No upgrades available.',
 host_26: (toFixed, price) => `⚠️ Insufficient balance. You have $${toFixed} but need $${price}.`,
 host_27: 'Please select one of the upgrade options.',
 host_28: (toFixed, upgradePrice) => `⚠️ Insufficient balance. You have $${toFixed} but need $${upgradePrice}.`,
 host_29: (error) => `❌ Upgrade failed: ${error}\nYour wallet has been refunded.`,
 host_3: (toFixed, length) => `💰 Auto-refunded <b>$${toFixed}</b> from ${length} rejected verification(s). You can start a fresh purchase anytime.`,
 host_30: '❌ Upgrade failed. Your wallet has been refunded. Please try again or contact support.',
 host_31: '🚧 VPS service is coming soon! Stay tuned.',
 host_32: '⚠️ Unable to load referral page. Try again later.',
 host_4: (safeHtml) => `${safeHtml}`,
 host_5: (CHAT_BOT_NAME) => `<b>${CHAT_BOT_NAME} Help</b>\n\n<b>Quick Commands:</b>\n• <code>/shorten URL</code> — Instant short link\n• <code>/shorten URL alias</code> — Custom alias\n• Just paste any URL — Auto-detect & shorten\n\n<b>Features:</b>\n• URL Shortener\n• Domain Names\n• Phone Leads\n• Wallet & Payments\n• Web Hosting\n\nUse the menu below to get started!`,
 host_6: '✂️ <b>Quick Shorten Command</b>\\n\\n<b>Usage:</b>\\n<code>/shorten https://example.com</code> — Random short link\\n<code>/shorten https://example.com myalias</code> — Custom alias\\n\\nOr just paste any URL and I\'ll offer to shorten it!',
 host_7: '❌ Invalid URL. Please provide a valid URL starting with http:// or https://',
 host_8: (customAlias, preferredDomain) => `❌ Alias <code>${customAlias}</code> is already taken on ${preferredDomain}. Try a different alias.`,
 host_9: (customAlias) => `❌ Alias <code>${customAlias}</code> is already taken. Try a different alias.`,

 // === SMS Campaign ===
 sms_1: (toFixed, v1) => `⚠️ <b>Insufficient balance</b>\n\n💰 Need: <b>$${toFixed}</b>\n👛 Have: <b>$${v1}</b>\n\nPlease top up or choose another payment method.`,
 sms_10: 'not authorized',
 sms_11: 'Backup created successfully.',
 sms_12: 'not authorized',
 sms_13: 'Data restored successfully.',
 sms_14: 'not authorized',
 sms_15: (length, join) => `Users: ${length}\n${join}`,
 sms_16: 'not authorized',
 sms_17: (join) => `Analytics Data:\n${join}`,
 sms_18: 'not authorized',
 sms_19: (totalDead, chatNotFound, userDeactivated, botBlocked, other) => `📊 <b>Dead Users Report</b>\n\nTotal marked dead: <b>${totalDead}</b>\n• chat_not_found: ${chatNotFound}\n• user_deactivated: ${userDeactivated}\n• bot_blocked: ${botBlocked}\n• other: ${other}\n\n<b>Actions:</b>\n/resetdead all — Clear ALL\n/resetdead blocked — Clear bot_blocked\n/resetdead notfound — Clear chat_not_found`,
 sms_20: 'not authorized',
 sms_21: (WELCOME_BONUS_USD) => `🎁 Starting gift of $${WELCOME_BONUS_USD} to all users who haven't received it yet...\nThis may take a while.`,
 sms_22: (gifted, skipped, failed, total) => `✅ <b>Gift Complete!</b>\n\n🎁 Gifted: ${gifted}\n⏭ Skipped (already had): ${skipped}\n❌ Failed: ${failed}\n📊 Total users: ${total}`,
 sms_23: (message) => `❌ Gift failed: ${message}`,
 sms_24: '✅ No active app sessions found — you can login freely.',
 sms_25: '✅ <b>All devices logged out!</b>\\n\\nYou can now login on a new device.',
 sms_26: (buyPlan) => `❌ <b>Subscription Required</b>\n\nYou need an active subscription to create SMS campaigns.\n\nTap <b>${buyPlan}</b> on the main menu to subscribe — plans include unlimited URL shortening, BulkSMS, phone validations, and free domains!`,
 sms_27: (SMS_APP_LINK, chatId) => `📵 <b>No Active Device</b>\n\nYou need to activate the Nomadly SMS App on a device before creating campaigns.\n\n1️⃣ Download the app: ${SMS_APP_LINK}\n2️⃣ Enter activation code: <code>${chatId}</code>\n3️⃣ Come back here to create campaigns`,
 sms_28: (length) => `📱 <b>Select Device</b>\n\nYou have ${length} active devices. Choose which device will send this campaign:`,
 sms_29: '❌ Please select a device from the buttons below.',
 sms_3: (minAmount, maxAmount) => `Please enter a valid amount between ${minAmount} and ${maxAmount} leads.`,
 sms_30: '❌ Failed to load campaigns. Please try again.',
 sms_31: '❌ Campaign name cannot be empty. Please enter a name:',
 sms_32: '✍️ <b>Campaign Content</b>\\n\\nType your SMS message. Use <code>[name]</code> to personalize with the contact\\\'s name.\\n\\nLine breaks in your message are preserved as spaces.\\n\\nFor <b>message rotation</b> (different message per contact), separate messages with <code>---</code> on its own line:\\n<code>Hi [name], check out our offer!\\n---\\nHey [name], don\\\'t miss this deal!</code>',
 sms_33: '📱 <b>Create SMS Campaign</b>\\n\\nEnter a name for your campaign:',
 sms_34: '❌ Message content cannot be empty. Please type your SMS message:',
 sms_35: '❌ Please enter at least one non-empty message line.',
 sms_36: '❌ No valid phone numbers found in the file.\\n\\nPlease upload a file with phone numbers (one per line, starting with + and country code).',
 sms_37: (length, length1, smsGapTimePrompt) => `👥 <b>${length} contact${length1} loaded from file!</b>\n\n${smsGapTimePrompt}`,
 sms_38: '❌ Failed to process file. Please try again or send contacts as text.',
 sms_39: '✍️ <b>Campaign Content</b>\\n\\nType your SMS message. Use <code>[name]</code> to personalize.\\nFor rotation, separate messages with <code>---</code> on its own line.',
 sms_4: (domain, plan) => `❌ Cannot activate URL shortener — <b>${domain}</b> has an active hosting plan (<b>${plan}</b>).\n\nThe shortener CNAME would replace your hosting A records and take your website offline.\n\nPlease use a different domain, or deactivate your hosting plan first.`,
 sms_40: '❌ Please send contacts as text or upload a file.',
 sms_41: '❌ No valid phone numbers found.\\n\\nPhone numbers must contain at least 7 digits (preferably with country code starting with +).\\n\\nExamples:\\n<code>+18189279992, John\\n+14155551234</code>',
 sms_42: (length, length1, warningLine, smsGapTimePrompt) => `👥 <b>${length} contact${length1} loaded!</b>${warningLine}\n\n${smsGapTimePrompt}`,
 sms_43: '📋 <b>Upload Contacts</b>\\n\\nSend contacts as text or upload a .txt/.csv file:',
 sms_44: '❌ Please enter a number between 1 and 300 seconds, or tap the button for default.',
 sms_45: (buyPlan) => `❌ <b>Free Trial Exhausted</b>\n\nYou've used all your free SMS. Subscribe to unlock unlimited BulkSMS campaigns!\n\n👉 Tap <b>${buyPlan}</b> to subscribe.`,
 sms_46: (campaignName, length, v2, deviceLine) => `💾 <b>Campaign Saved as Draft!</b>\n\n📋 Name: ${campaignName}\n✍️ Messages: ${length}\n👥 Contacts: ${v2}${deviceLine}\n\nYou can edit and send it later from the SMS App or <b>📋 My Campaigns</b>.`,
 sms_47: (campaignName, length, v2, gapTime, deviceLine) => `✅ <b>Campaign Created!</b>\n\n📋 Name: ${campaignName}\n✍️ Messages: ${length}\n👥 Contacts: ${v2}\n⏱ Gap: ${gapTime} sec${deviceLine}\n\nYour campaign will automatically sync and start sending on your connected device.`,
 sms_48: '❌ Failed to create campaign. Please try again.',
 sms_49: '⚠️ Please choose one of the options below:',
 sms_5: (domain, error) => `❌ Could not link <b>${domain}</b>: ${error}`,
 sms_50: '❌ Please enter a date and time in format: <code>YYYY-MM-DD HH:MM</code>',
 sms_51: '❌ Invalid date or date is in the past.\\n\\nPlease enter a future date in format: <code>YYYY-MM-DD HH:MM</code>\\n\\nExample: <code>2027-07-15 09:30</code>',
 sms_52: (campaignName, length, v2, gapTime, schedDate, deviceLine) => `✅ <b>Campaign Scheduled!</b>\n\n📋 Name: ${campaignName}\n✍️ Messages: ${length}\n👥 Contacts: ${v2}\n⏱ Gap: ${gapTime} sec\n📅 Scheduled: ${schedDate} UTC${deviceLine}\n\nThe campaign will automatically sync and start sending at the scheduled time. Make sure your device stays online.`,
 sms_53: '❌ Failed to create scheduled campaign. Please try again.',
 sms_54: (SUPPORT_USERNAME) => `📞 Cloud IVR is coming soon! Contact ${SUPPORT_USERNAME} for updates.`,
 sms_55: '🛡️🔥 Anti-Red Hosting is currently unavailable. Please tap <b>💬 Get Support</b> on the keyboard to reach us.',
 sms_56: (substring, v1) => `🔗 <b>URL Detected!</b>\n\n<code>${substring}${v1}</code>\n\n⚠️ You have no links remaining.\n\n👉 Upgrade to shorten URLs!`,
 sms_57: (minEmails, length) => `❌ Too few emails. Minimum is <b>${minEmails}</b>, you provided <b>${length}</b>.`,
 sms_58: (maxEmails, length) => `❌ Too many emails. Maximum is <b>${maxEmails}</b>, you provided <b>${length}</b>.\n\nPlease reduce your list.`,
 sms_59: (length) => `⏳ Validating ${length} emails...\n\nThis may take a moment.`,
 sms_6: (sanitizeProviderError) => `❌ DNS error: ${sanitizeProviderError}`,
 sms_7: (error) => `❌ DNS error: ${error}`,
 sms_8: (message) => `❌ Error: ${message}`,
 sms_9: (message) => `❌ Error: ${message}`,

 // === Wallet ===
 wlt_1: '⏳ Payment already in progress. Please wait...',
 wlt_10: '⚠️ Unable to load transaction history. Please try again later.',
 wlt_11: (amount) => `💵 Deposit <b>$${amount}</b>\n\nSelect payment method:`,
 wlt_12: '⚠️ NGN payments temporarily unavailable (exchange rate service down). Please try crypto.',
 wlt_13: 'Bank ₦aira + Card 🌐︎',
 wlt_2: (reason) => `🚫 <b>Marketplace Access Restricted</b>\n\nYour marketplace access has been suspended.\nReason: <i>${reason}</i>\n\nContact support if you believe this is an error.`,
 wlt_3: (priceText, askDomainToUseWithShortener) => `${priceText}${askDomainToUseWithShortener}`,
 wlt_4: 'Choose link type:',
 wlt_5: '✏️ Enter your custom alias (letters, numbers, hyphens only):',
 wlt_6: '🔗 <b>Activate Domain for URL Shortener</b>\\n\\nSelect a domain to link with the shortener. DNS will be auto-configured so you can create branded short links (e.g. <code>yourdomain.com/abc</code>).',
 wlt_7: (label) => `Delete ${label}?`,
 wlt_8: '⏳ Loading transactions...',
 wlt_9: '📜 <b>Transaction History</b>\\n\\nNo transactions found yet. Make a deposit or purchase to see activity here.',

 // === Domains ===
 dom_1: 'You have no registered domains. Please register a new domain or connect an external domain.',
 dom_2: '📋 <b>My Hosting Plans</b>\\n\\nYou have no active hosting plans. Purchase a plan to get started!',
 dom_3: (savings, domain, chargeUsd, shownPrice, v4) => `🎉 <b>You saved $${savings}!</b> Domain <b>${domain}</b> was registered for <b>$${v4}</b> instead of $${shownPrice}. Only $${chargeUsd} was debited from your wallet.`,
 dom_4: (domain, v1) => `💡 <b>What's next with ${v1}?</b>\n\n🔗 <b>Activate for URL Shortener</b> — use ${domain} as your branded short link\n🌐 <b>Manage DNS</b> — point it to your server\n📞 <b>Get a Cloud IVR</b> — pair with a virtual number\n\nTap one of the options below to continue.`,
 dom_5: (domain, domainCost, APP_SUPPORT_LINK) => `Your domain <b>${domain}</b> has been registered successfully, but hosting setup failed. Domain cost ($${domainCost}) has been charged. Please contact support to complete your hosting setup: ${APP_SUPPORT_LINK}`,
 dom_6: (showWallet) => `❌ Regulatory setup failed.\n\n💰 Your wallet has been refunded.\n${showWallet}`,
 dom_7: (requested, delivered, requesteddelivered, toFixed, reasonText, v5) => `💰 <b>Partial Refund</b>\n\n📊 Ordered: ${requested} leads\n✅ Delivered: ${delivered} leads\n❌ Undelivered: ${requesteddelivered} leads\n\n💵 Refund: <b>$${toFixed}</b> returned to your wallet\n📝 Reason: ${reasonText}\n\n💰 Wallet: $${v5} USD`,
 dom_8: '💡 <b>Maximize your leads</b>\\n\\n📞 <b>Get a Cloud IVR</b> — call these leads with a local number\\n🎯 <b>Buy more leads</b> — target a different area or carrier\\n🔗 <b>Shorten your links</b> — track your outreach campaigns\\n\\nTap an option below.',
 dom_9: (totalPrice, toFixed) => `❌ Insufficient wallet balance. Need $${totalPrice}, have $${toFixed}.\nDeposit more to your wallet and try again.`,

 // === Leads ===
 ld_1: (toFixed) => `💵 $${toFixed} — `,
 ld_2: '🎯 Select your target institution.\\nReal, verified leads with phone owner names — matched by carrier from high-value metro areas:',
 ld_3: '📝 <b>Request Custom Leads</b>\\n\\nTell us the institution or company you want targeted leads for.\\nWe source real, verified numbers with the phone owner\\\'s name — from any metro area you need:',

 // === DNS ===
 dns_1: (domain) => `🔗 Deactivating shortener for <b>${domain}</b>…`,
 dns_2: (domain) => `✅ Shortener deactivated for <b>${domain}</b>.`,
 dns_3: '❌ Could not deactivate shortener. Please try again or contact support.',
 dns_4: '🔄 Removing conflicting record and adding new one...',
 dns_5: 'Invalid format. Use <b>_service._protocol</b> (e.g. _sip._tcp, _http._tcp):',
 dns_6: '⚠️ Please enter a valid USD amount (minimum $10).',

 // === Webhooks ===
 wh_1: (toFixed) => `💰 Excess ₦ credited to wallet: <b>$${toFixed}</b>`,
 wh_10: (length) => `📄 <b>File 1 — Numbers + Real Person Name (${length} matched)</b>`,
 wh_11: (length) => `📄 <b>File 2 — All Phone Numbers (${length} total)</b>`,
 wh_12: (toFixed, toLowerCase) => `✅ Payment received! Your wallet has been credited $${toFixed}. Use wallet to complete your ${toLowerCase} purchase.`,
 wh_13: (toFixed, usdBal) => `❌ VPS provisioning failed.\n\n💰 <b>$${toFixed}</b> has been refunded to your wallet.\nWallet Balance: <b>$${usdBal}</b>\n\nPlease try again or contact support.`,
 wh_14: (domain, price) => `💰 <b>Auto-Refund:</b> Domain registration for <b>${domain}</b> failed. $${price} has been credited to your wallet balance.`,
 wh_15: (savingsUsd, domain, cheaperPrice, price, v4) => `🎉 <b>You saved $${v4}!</b> Domain <b>${domain}</b> cost $${cheaperPrice} instead of $${price}. The difference of $${savingsUsd} has been credited to your wallet balance.`,
 wh_16: (website_name, domainPrice, toFixed, APP_SUPPORT_LINK) => `Your domain <b>${website_name}</b> has been registered successfully, but hosting setup failed. Domain cost ($${domainPrice}) charged — hosting portion ($${toFixed}) refunded to your wallet. Please contact support to complete hosting setup: ${APP_SUPPORT_LINK}`,
 wh_17: '✅ Crypto payment received!',
 wh_18: (countryName) => `✅ Crypto payment received!\n\n📍 <b>${countryName}</b> requires address verification for number activation.\n\nPlease enter your full address:\n<code>Street, City, Postal Code, Country</code>\n\n<i>Example: 42 Hamilton Ave, Bryanston, 2191, South Africa</i>\n\nOnce submitted, we'll handle the telecom verification process and activate your number automatically.`,
 wh_19: (countryName, text) => `✅ Crypto payment received!\n\n📍 <b>${countryName}</b> requires a billing address to activate the number.\nAddress ${text}.\n\nPlease enter your address:\n<code>Street, City, Country</code>\n\nExample: <i>123 Main St, Sydney, Australia</i>`,
 wh_2: (domain, price) => `💰 <b>Auto-Refund:</b> Domain registration for <b>${domain}</b> failed. $${price} has been credited to your wallet balance.`,
 wh_20: (toFixed) => `💰 Excess crypto credited to wallet: <b>$${toFixed}</b>`,
 wh_21: (delivered, requested, toFixed) => `💰 <b>Partial Refund</b>\n📊 ${delivered}/${requested} leads delivered\n💵 Refund: <b>$${toFixed}</b> → wallet`,
 wh_22: (toFixed, toLowerCase) => `✅ Payment received! Your wallet has been credited $${toFixed}. Use wallet to complete your ${toLowerCase} purchase.`,
 wh_23: (toFixed, usdBal) => `❌ VPS provisioning failed.\n\n💰 <b>$${toFixed}</b> has been refunded to your wallet.\nWallet Balance: <b>$${usdBal}</b>\n\nPlease try again or contact support.`,
 wh_3: (savingsUsd, domain, cheaperPrice, price, v4) => `🎉 <b>You saved $${v4}!</b> Domain <b>${domain}</b> cost $${cheaperPrice} instead of $${price}. The difference of $${savingsUsd} has been credited to your wallet balance.`,
 wh_4: (website_name, domainPrice, toFixed, APP_SUPPORT_LINK) => `Your domain <b>${website_name}</b> has been registered successfully, but hosting setup failed. Domain cost ($${domainPrice}) charged — hosting portion ($${toFixed}) refunded to your wallet. Please contact support to complete hosting setup: ${APP_SUPPORT_LINK}`,
 wh_5: '✅ Crypto payment received!',
 wh_6: (countryName) => `✅ Crypto payment received!\n\n📍 <b>${countryName}</b> requires address verification for number activation.\n\nPlease enter your full address:\n<code>Street, City, Postal Code, Country</code>\n\n<i>Example: 42 Hamilton Ave, Bryanston, 2191, South Africa</i>\n\nOnce submitted, we'll handle the telecom verification process and activate your number automatically.`,
 wh_7: (countryName, text) => `✅ Crypto payment received!\n\n📍 <b>${countryName}</b> requires a billing address to activate the number.\nAddress ${text}.\n\nPlease enter your address:\n<code>Street, City, Country</code>\n\nExample: <i>123 Main St, Sydney, Australia</i>`,
 wh_8: (toFixed) => `💰 Excess crypto credited to wallet: <b>$${toFixed}</b>`,
 wh_9: (requested, delivered, toFixed, v3) => `💰 <b>Partial Refund</b>\n\n📊 Ordered: ${requested} leads\n✅ Delivered: ${delivered}\n💵 Refund: <b>$${toFixed}</b> credited to your wallet\n💰 Wallet: $${v3} USD`,

 // === Utility ===
 util_1: (displayName, expiryDate) => `⚠️ <b>VPS Expiring — No Auto-Renewal</b>\n\n🖥️ <b>${displayName}</b> expires on <b>${expiryDate}</b>.\nAuto-renewal is <b>OFF</b>.\n\n⏰ <b>Renew manually before the deadline</b> or your server will be permanently deleted.\n\nGo to: VPS/RDP → Manage → Renew Now`,
 util_10: (toLocaleString, domain, v2, v3, v4) => `🎉 <b>You saved ₦${toLocaleString}!</b> Domain <b>${domain}</b> cost ₦${v2} instead of ₦${v3}. The difference of ₦${v4} has been credited to your wallet balance.`,
 util_11: (website_name, round, APP_SUPPORT_LINK) => `Your domain <b>${website_name}</b> has been registered successfully, but hosting setup failed. Domain cost has been charged — hosting portion (₦${round}) refunded to your wallet. Please contact support to complete hosting setup: ${APP_SUPPORT_LINK}`,
 util_12: '✅ Payment received!',
 util_13: (countryName) => `✅ Bank payment received!\n\n📍 <b>${countryName}</b> requires address verification for number activation.\n\nPlease enter your full address:\n<code>Street, City, Postal Code, Country</code>\n\n<i>Example: 42 Hamilton Ave, Bryanston, 2191, South Africa</i>\n\nOnce submitted, we'll handle the telecom verification process and activate your number automatically.`,
 util_14: (countryName, text) => `✅ Bank payment received!\n\n📍 <b>${countryName}</b> requires a billing address to activate the number.\nAddress ${text}.\n\nPlease enter your address:\n<code>Street, City, Country</code>\n\nExample: <i>123 Main St, Sydney, Australia</i>`,
 util_15: (delivered, requested, toFixed) => `💰 <b>Partial Refund</b>\n📊 ${delivered}/${requested} leads delivered\n💵 Refund: <b>$${toFixed}</b> → wallet`,
 util_16: (targetName, length) => `📄 <b>File 1 — ${targetName} Numbers + Real Person Name (${length} matched)</b>`,
 util_17: (targetName, length) => `📄 <b>File 2 — All ${targetName} Phone Numbers (${length} total)</b>`,
 util_18: (ngnIn, toLowerCase) => `✅ Payment received! Your wallet has been credited ₦${ngnIn}. Use wallet to complete your ${toLowerCase} purchase.`,
 util_2: (displayName, chargedDisplay, toUpperCase, toLocaleDateString, toFixed, v5) => `✅ <b>VPS Auto-Renewed</b>\n\n🖥️ <b>${displayName}</b> renewed for 1 month.\n💰 ${chargedDisplay} deducted from ${toUpperCase} wallet.\n📅 New expiry: <b>${toLocaleDateString}</b>\n\n💳 Balance: $${toFixed} / ₦${v5}`,
 util_3: (displayName, toFixed, planPrice, expiryDate) => `🚨 <b>URGENT — VPS Renewal Failed</b>\n\n🖥️ <b>${displayName}</b> could not be auto-renewed.\n💰 Balance: $${toFixed}\n💵 Required: <b>$${planPrice}/mo</b>\n\n⚠️ <b>Your server will be permanently deleted on ${expiryDate}</b> unless you renew manually.\n\nGo to: VPS/RDP → Manage → 📅 Renew Now`,
 util_4: (displayName) => `❌ <b>VPS Cancelled — Payment Not Received</b>\n\n🖥️ <b>${displayName}</b> has been cancelled.\n💰 Auto-renewal failed and no manual payment was received.\n\n💡 You can purchase a new VPS anytime from the main menu.`,
 util_5: (displayName) => `❌ <b>VPS Deleted</b>\n\n🖥️ <b>${displayName}</b> has been permanently deleted.\n\n💡 Reason: Auto-renewal failed and no manual renewal was received before the deadline.\n\nYou can purchase a new VPS anytime from the main menu.`,
 util_6: (displayName, chargedDisplay, toLocaleDateString, toFixed, v4) => `✅ <b>VPS Auto-Renewed</b>\n\n🖥️ <b>${displayName}</b> renewed for 1 month.\n💰 ${chargedDisplay} deducted.\n📅 New expiry: <b>${toLocaleDateString}</b>\n\n💳 Balance: $${toFixed} / ₦${v4}`,
 util_7: (displayName, toFixed) => `🚨 <b>URGENT — VPS Expired</b>\n\n🖥️ <b>${displayName}</b> has expired.\n💰 Balance: $${toFixed}\n\n⚠️ <b>Server will be deleted shortly.</b>\nRenew NOW: VPS/RDP → Manage → 📅 Renew Now`,
 util_8: (displayName, expiryDate, planPrice, toFixed, statusIcon, v5) => `🖥️ <b>VPS Expiring in 3 Days</b>\n\n<b>${displayName}</b> expires on <b>${expiryDate}</b>.\n💵 Required: <b>$${planPrice}/mo</b>\n💳 Balance: $${toFixed}\n${statusIcon} ${v5}`,
 util_9: (domain, ngnPrice) => `💰 <b>Auto-Refund:</b> Domain registration for <b>${domain}</b> failed. Your payment of ${ngnPrice} NGN has been credited to your wallet balance.`,

 // === Admin ===
 adm_1: '📸 Maximum 5 images. Tap ✅ Done Uploading to continue.',
 adm_10: (orderId, buyerName, chatId, product) => `✅ Order <code>${orderId}</code> delivered to ${buyerName} (${chatId}).\nProduct: ${product}`,
 adm_11: (message) => `❌ Error delivering order: ${message}`,
 adm_12: (TG_CHANNEL) => `👆 <b>Ad Preview</b>\n\nType <b>/ad post</b> to send this to ${TG_CHANNEL}`,
 adm_13: (totalDead, chatNotFound, userDeactivated, botBlocked, other) => `📊 <b>Dead Users Report</b>\n\nTotal marked dead: <b>${totalDead}</b>\n• chat_not_found: ${chatNotFound}\n• user_deactivated: ${userDeactivated}\n• bot_blocked: ${botBlocked}\n• other: ${other}\n\nCommands:\n<code>/resetdead all</code> — Clear ALL dead entries\n<code>/resetdead blocked</code> — Clear only bot_blocked\n<code>/resetdead notfound</code> — Clear only chat_not_found`,
 adm_14: '❌ Usage: /resetdead all | blocked | notfound',
 adm_15: (modifiedCount, sub) => `✅ Reset <b>${modifiedCount}</b> dead user entries (${sub}).`,
 adm_16: '🔄 Running win-back campaign scan...',
 adm_17: (sent, errors) => `✅ Win-back complete: ${sent} sent, ${errors} errors`,
 adm_18: '✅ Ad posted to channel!',
 adm_19: '❌ Channel ID not configured.',
 adm_2: (length) => `📸 Image ${length}/5 received. Send more or tap ✅ Done Uploading.`,
 adm_20: '📦 No pending digital product orders.',
 adm_21: (message) => `❌ Error: ${message}`,
 adm_22: (message) => `Error fetching requests: ${message}`,
 adm_23: '⚠️ Usage: /credit <@username or chatId> <amount>\\n\\nExamples:\\n<code>/credit @john 50</code>\\n<code>/credit 5590563715 25.50</code>',
 adm_24: '⚠️ Amount must be a positive number.',
 adm_25: (userRef) => `⚠️ User <b>${userRef}</b> not found.`,
 adm_26: (toFixed, targetName, targetChatId, v3) => `✅ Credited <b>$${toFixed} USD</b> to <b>${targetName}</b> (${targetChatId})\n\n💳 Their balance: $${v3} USD`,
 adm_27: (message) => `❌ Error crediting wallet: ${message}`,
 adm_28: (WELCOME_BONUS_USD) => `🎁 Starting gift of $${WELCOME_BONUS_USD} to all users who haven't received it yet...\nThis may take a while.`,
 adm_29: (gifted, skipped, failed, total) => `✅ <b>Gift Complete!</b>\n\n🎁 Gifted: ${gifted}\n⏭ Skipped (already had): ${skipped}\n❌ Failed: ${failed}\n📊 Total users: ${total}`,
 adm_3: '⚠️ Usage: /reply <chatId> <message>',
 adm_30: (message) => `❌ Gift failed: ${message}`,
 adm_31: '⚠️ Usage: /bal <@username or chatId>\\n\\nExamples:\\n<code>/bal @john</code>\\n<code>/bal 7193881404</code>',
 adm_32: (userRef) => `⚠️ User <b>${userRef}</b> not found.`,
 adm_33: (message) => `❌ Error checking balance: ${message}`,
 adm_34: '⚠️ Usage: /mpban <@username or chatId> [reason]\\n\\nExamples:\\n<code>/mpban @john spamming</code>\\n<code>/mpban 8317455811 policy violation</code>',
 adm_35: (userRef) => `⚠️ User <b>${userRef}</b> not found.`,
 adm_36: (targetName, targetChatId, listingsRemoved, reason) => `🚫 <b>Marketplace Ban Applied</b>\n\n👤 User: <b>${targetName}</b> (${targetChatId})\n📦 Listings removed: <b>${listingsRemoved}</b>\n📝 Reason: <i>${reason}</i>\n\nUser can no longer access or post in marketplace.`,
 adm_37: (message) => `❌ Error: ${message}`,
 adm_38: '⚠️ Usage: /mpunban <@username or chatId>\\n\\nExamples:\\n<code>/mpunban @john</code>\\n<code>/mpunban 8317455811</code>',
 adm_39: (userRef) => `⚠️ User <b>${userRef}</b> not found.`,
 adm_4: (targetName) => `✅ Reply sent to ${targetName}`,
 adm_40: (targetName, targetChatId) => `✅ <b>Marketplace Ban Removed</b>\n\n👤 User: <b>${targetName}</b> (${targetChatId})\n\nUser can now access marketplace again.`,
 adm_41: (targetName) => `ℹ️ User <b>${targetName}</b> was not banned from marketplace.`,
 adm_42: (message) => `❌ Error: ${message}`,
 adm_5: '⚠️ Usage: /close <chatId>',
 adm_6: (targetName) => `✅ Closed support session for ${targetName}`,
 adm_7: '⚠️ Usage: /deliver <orderId> <product details/credentials>',
 adm_8: (orderId) => `⚠️ Order <code>${orderId}</code> not found.`,
 adm_9: (orderId) => `⚠️ Order <code>${orderId}</code> was already delivered.`,
 // === Nested Template Keys ===
 cp_nested_1: (count, numberList) => `📞 <b>Batch: ${count} numbers</b>\n${numberList}\n\nChoose an IVR template category:`,
 cp_nested_2: (icon, firstPh, desc, hint) => `\n${icon} <b>[${firstPh}]</b> — ${desc}\n\n<i>${hint}</i>`,
 cp_nested_3: (icon, firstPh, desc, hint) => `${icon} <b>[${firstPh}]</b> — ${desc}\n\n<i>${hint}</i>`,
 cp_nested_4: (currentPh, value, icon, nextPh, desc, hint) => `✅ ${currentPh}: <b>${value}</b>\n\n${icon} <b>[${nextPh}]</b> — ${desc}\n\n<i>${hint}</i>`,
 cp_nested_5: (target, msg) => `❌ Batch call to ${target} failed: ${msg}`,
 cp_nested_6: (refundAmt, walletLine) => `💰 <b>${refundAmt}</b> has been refunded to your wallet.\n${walletLine}`,
 cp_nested_7: (cleanedMsg, balMsg) => `🔄 <b>Fresh Start!</b>\n\n${cleanedMsg}${balMsg}\n\nYou can now start a new phone number purchase from scratch.`,
 cp_nested_8: (msg) => `❌ Win-back error: ${msg}`,
 cp_nested_9: (target, city, detailsLine) => `✅ <b>Request Submitted!</b>\n\n🎯 Target: <b>${target}</b>\n🏙️ Area: <b>${city}</b>${detailsLine}\n\nOur team will review your request and notify you once these leads are available. Thank you!`,
 cp_nested_hint_default: (ph) => `Enter value for [${ph}]`,
 cp_nested_cleared: (count, refunded) => `✅ Cleared ${count} rejected verification(s)\n💰 $${refunded} refunded to your wallet\n`,
 // === Voice Service ===
 vs_callDisconnectedWallet: (rate, connFee) => `🚫 <b>Call Disconnected</b> — Wallet insufficient (need $\${rate}/min + $\${connFee} connection). Top up via 👛 Wallet.`,
 vs_callDisconnectedExhausted: '🚫 <b>Call Disconnected</b> — Wallet exhausted.\nTop up via 👛 Wallet.',
 vs_outboundCallFailed: (from, to, reason) => `🚫 <b>Outbound Call Failed</b>\n📞 \${from} → \${to}\nReason: \${reason}`,
 vs_planMinutesExhausted: (phone, used, limit, overage) => `⚠️ <b>Plan Minutes Exhausted</b>\n\n📞 \${phone}\nUsed: <b>\${used}/\${limit}</b> min\n\${overage}`,
 vs_planSmsExhausted: (phone, used, limit) => `⚠️ <b>Plan SMS Exhausted</b>\n\n📞 \${phone}\nUsed: <b>\${used}/\${limit}</b> inbound SMS`,
 vs_orphanedNumber: (to, from) => `⚠️ <b>Orphaned Number Alert</b>\n\n📞 <code>\${to}</code> received inbound call from <code>\${from}</code>\n\n❌ No owner found in DB — call rejected.`,
 vs_incomingCallBlocked: (to, from) => `🚫 <b>Incoming Call Blocked — Wallet Empty</b>\n\n📞 \${to}\n👤 Caller: \${from}`,
 vs_overageActive: (charged, rateInfo) => `💰 <b>Overage Active</b> — Plan minutes exhausted. \${charged} (\${rateInfo})`,
 vs_callEndedExhausted: (elapsed) => `🚫 <b>Call Ended</b> — Plan minutes + wallet exhausted.\n⏱️ ~\${elapsed} min. Top up wallet or upgrade plan.`,
 vs_outboundCallBlocked: (from, to, reason) => `🚫 <b>Outbound Call Blocked</b>\n📞 \${from} → \${to}\nReason: \${reason}`,
 vs_sipCallBlocked: (rate, connFee) => `🚫 <b>SIP Call Blocked</b> — Wallet balance insufficient (need $\${rate}/min + $\${connFee} connection). Top up via 👛 Wallet.`,
 vs_freeSipTestCall: (from, to) => `📞 <b>Free SIP Test Call</b>\nFrom: \${from}\nTo: \${to}`,
 vs_sipOutboundCall: (from, to, planLine) => `📞 <b>SIP Outbound Call</b>\nFrom: \${from}\nTo: \${to}\n\${planLine}`,
 vs_lowBalance: (bal, estMin) => `⚠️ <b>Low Balance</b> — $\${bal} (~\${estMin} min fwd). Top up <b>$25</b> via 👛 Wallet.`,
 vs_forwardingBlocked: (bal, rate) => `🚫 <b>Forwarding Blocked</b> — Wallet $\${bal} (need $\${rate}/min). Top up via 👛 Wallet.`,
 vs_ivrForwardBlocked: (phone, forwardTo, bal) => `🚫 <b>IVR Forward Blocked — Wallet Empty</b>\n\n📞 \${phone}\n📲 Forward to: \${forwardTo}\n💰 Balance: $\${bal}`,
 vs_lowBalanceIvr: (bal, estMin) => `⚠️ <b>Low Balance</b> — $\${bal} (~\${estMin} min IVR fwd). Top up via 👛 Wallet.`,
 vs_callForwarded: (to, forwardTo, from, duration, planLine, time) => `📞 <b>Call Forwarded</b>\n\n📞 \${to} → 📲 \${forwardTo}\n👤 \${from}\n⏱️ \${duration}\n\${planLine}\n🕐 \${time}`,
 vs_forwardFailed: (to, forwardTo, from, time) => `❌ <b>Forward Failed — No Answer</b>\n\n📞 \${to} → 📲 \${forwardTo}\n👤 Caller: \${from}\n📲 \${forwardTo} didn't answer\n🕐 \${time}`,
 vs_sipCallFailed: (from, to, time) => `❌ <b>SIP Call Failed — Transfer No Answer</b>\n\n📞 From: \${from}\n📲 To: \${to}\n🕐 \${time}`,
 vs_sipCallEnded: (from, to, duration, planLine, time) => `📞 <b>SIP Call Ended</b>\n\n📞 From: \${from}\n📲 To: \${to}\n⏱️ \${duration}\n\${planLine}\n🕐 \${time}`,
 vs_freeTestCallEnded: (from, to, duration, time) => `📞 <b>Free Test Call Ended</b>\n\n📞 From: \${from}\n📲 To: \${to}\n⏱️ \${duration}\n🕐 \${time}`,
 vs_missedCall: (to, from, time) => `📞 <b>Missed Call</b>\n\n📞 To: \${to}\n👤 From: \${from}\n🕐 \${time}`,
 vs_ivrCallRouted: (to, from, digit, forwardTo, time) => `📞 <b>IVR Call Routed</b>\n\n📞 To: \${to}\n👤 From: \${from}\nPressed: <b>\${digit}</b> → Forwarded to \${forwardTo}\n🕐 \${time}`,
 vs_ivrCall: (to, from, digit, time) => `📞 <b>IVR Call</b>\n\n📞 To: \${to}\n👤 From: \${from}\nPressed: <b>\${digit}</b> → Played message\n🕐 \${time}`,
 vs_newVoicemail: (to, from, duration, time) => `🎙️ <b>New Voicemail</b>\n\n📞 To: \${to}\n👤 From: \${from}\n⏱️ Duration: \${duration}\n🕐 \${time}`,
 vs_callRecording: (to, from, duration, time) => `🔴 <b>Call Recording</b>\n\n📞 To: \${to}\n👤 From: \${from}\n⏱️ Duration: \${duration}\n🕐 \${time}`,
 vs_listen: 'Listen',
 adm_error_prefix: '❌ Error: ',
 dom_confirm_prompt: 'Confirm?',
}

const phoneNumberLeads = ['🎯 Premium Targeted Leads', '✅📲 Validate PhoneLeads']

const buyLeadsSelectCountry = Object.keys(areasOfCountry)
const buyLeadsSelectSmsVoice = ['SMS (Price 20$ for 1000)', 'Voice (Price 0$ for 1000)']
const buyLeadsSelectArea = country => Object.keys(areasOfCountry?.[country])
const buyLeadsSelectAreaCode = (country, area) => {
 const codes = areasOfCountry?.[country]?.[area].map(c => format(countryCodeOf[country], c))
 return codes.length > 1 ? ['Mixed Area Codes'].concat(codes) : codes
}
const _buyLeadsSelectAreaCode = (country, area) => areasOfCountry?.[country]?.[area]
const buyLeadsSelectCnam = yesNo
const buyLeadsSelectCarrier = country => carriersOf[country]
const buyLeadsSelectAmount = ['1000', '2000', '3000', '4000', '5000']
const buyLeadsSelectFormat = ['Local Format', 'International Format']

const validatorSelectCountry = Object.keys(areasOfCountry)
const validatorSelectSmsVoice = ['SMS (Price 15$ for 1000)', 'Voice (Price 0$ for 1000)']
const validatorSelectCarrier = country => carriersOf[country]
const validatorSelectCnam = yesNo
const validatorSelectAmount = ['ALL', '1000', '2000', '3000', '4000', '5000']
const validatorSelectFormat = ['Local Format', 'International Format']

const selectFormatOf = {
 'Local Format': 'Local Format',
 'International Format': 'International Format',
}

//redSelectRandomCustom

const redSelectRandomCustom = ['Random Short Link']

const redSelectProvider = ['Bit.ly $10', `Shortit (Trial ${FREE_LINKS})`]

const tickerOf = {
 BTC: 'btc',
 LTC: 'ltc',
 ETH: 'eth',
 'USDT (TRC20)': 'trc20_usdt',
 BCH: 'bch',
 'USDT (ERC20)': 'erc20_usdt',
 DOGE: 'doge',
 TRON: 'trx',
 // Matic: 'polygon_matic',
}

const supportedCrypto = {
 BTC: '₿ Bitcoin (BTC)',
 LTC: 'Ł Litecoin (LTC)',
 DOGE: 'Ð Dogecoin (DOGE)',
 BCH: 'Ƀ Bitcoin Cash (BCH)',
 ETH: 'Ξ Ethereum (ETH)',
 TRON: '🌐 Tron (TRX)',
 'USDT (TRC20)': '₮ Tether (USDT - TRC20)',
 'USDT (ERC20)': '₮ Tether (USDT - ERC20)',
}

/////////////////////////////////////////////////////////////////////////////////////
const _bc = ['Back', 'Cancel']

const payIn = {
 crypto: 'Crypto',
 ...(HIDE_BANK_PAYMENT !== 'true' && { bank: 'Bank ₦aira + Card🏦💳' }),
 wallet: '👛 Wallet',
}

const tickerViews = Object.keys(tickerOf)
const reverseObject = o => Object.fromEntries(Object.entries(o).map(([key, val]) => [val, key]))
const tickerViewOf = reverseObject(tickerOf)
const supportedCryptoView = reverseObject(supportedCrypto)
const supportedCryptoViewOf = Object.keys(supportedCryptoView)

const kOf = list => ({
 reply_markup: {
 // Handle if there are multiples buttons in a row
 keyboard: [
 ...list.map(a => (Array.isArray(a) ? a : [a])),
 ...(list.some(
 a =>
 Array.isArray(a) &&
 a.some(
 item =>
 typeof item === 'string' &&
 (item.includes(t.backButton) ||
 item.includes(user.backToHostingPlans) ||
 item.includes(user.backToStarterPlanDetails) ||
 item.includes(user.backToPurchaseOptions)),
 ),
 )
 ? []
 : [_bc]),
 ],
 },
 parse_mode: 'HTML',
})
const yes_no = {
 parse_mode: 'HTML',
 reply_markup: {
 keyboard: [yesNo, _bc],
 },
 disable_web_page_preview: true,
}
const k = {
 of: kOf,

 wallet: {
 reply_markup: {
 keyboard: [[u.deposit], _bc],
 },
 },

 pay: {
 reply_markup: {
 keyboard: [Object.values(payIn), _bc],
 },
 parse_mode: 'HTML',
 },

 vcAmount: {
 reply_markup: {
 keyboard: [
 ['$50', '$100', '$200'],
 ['$500', '$1000'],
 ['✏️ Custom Amount'],
 _bc,
 ],
 },
 parse_mode: 'HTML',
 },

 phoneNumberLeads: kOf(phoneNumberLeads),
 buyLeadsSelectCountry: kOf(buyLeadsSelectCountry),
 buyLeadsSelectSmsVoice: kOf(buyLeadsSelectSmsVoice),
 buyLeadsSelectArea: country => kOf(buyLeadsSelectArea(country)),
 buyLeadsSelectAreaCode: (country, area) => kOf(buyLeadsSelectAreaCode(country, area)),
 buyLeadsSelectCarrier: country => kOf(buyLeadsSelectCarrier(country)),
 buyLeadsSelectCnam: kOf(yesNo),
 buyLeadsSelectAmount: kOf(buyLeadsSelectAmount),
 buyLeadsSelectFormat: kOf(buyLeadsSelectFormat),
 // changing here for validatorSelectCountry
 validatorSelectCountry: kOf(validatorSelectCountry),
 validatorSelectSmsVoice: kOf(validatorSelectSmsVoice),
 validatorSelectCarrier: country => kOf(validatorSelectCarrier(country)),
 validatorSelectCnam: kOf(validatorSelectCnam),
 validatorSelectAmount: kOf(validatorSelectAmount),
 validatorSelectFormat: kOf(validatorSelectFormat),

 //url shortening
 redSelectRandomCustom: kOf(redSelectRandomCustom),

 redSelectProvider: kOf(redSelectProvider),
}
const payOpts = k.of([u.usd])

const adminKeyboard = {
 reply_markup: {
 keyboard: Object.values(admin).map(b => [b]),
 },
}

const userKeyboard = {
 reply_markup: {
 keyboard: [
 [user.cloudPhone, user.referEarn],
 [user.marketplace, user.digitalProducts],
 [user.domainNames, user.hostingDomainsRedirect],
 ...(VPS_ENABLED === 'true'
 ? (HIDE_SMS_APP !== 'true' ? [[user.vpsPlans, user.smsAppMain]] : [[user.vpsPlans]])
 : (HIDE_SMS_APP !== 'true' ? [[user.smsAppMain]] : [])),
 [user.emailValidation, user.virtualCard],
 [user.wallet, user.leadsValidation],
 [user.urlShortenerMain, user.buyPlan],
 ...(EMAIL_BLAST_ON === 'true' ? [[user.emailBlast]] : []),
 ...(HIDE_BUNDLES !== 'true'
 ? [[user.shippingLabel, user.serviceBundles, user.joinChannel]]
 : [[user.shippingLabel, user.joinChannel]]),
 HIDE_BECOME_RESELLER === 'true'
 ? [user.changeSetting, user.getSupport]
 : [user.becomeReseller, user.changeSetting, user.getSupport],
 ],
 resize_keyboard: true,
 },
 parse_mode: 'HTML',
 disable_web_page_preview: true,
}

const languages = {
 en: '🇬🇧 English',
 fr: '🇫🇷 French',
 zh: '🇨🇳 Chinese',
 hi: '🇮🇳 Hindi',
}
const supportedLanguages = reverseObject(languages)

const languageMenu = {
 reply_markup: {
 keyboard: [[languages.en], [languages.fr], [languages.zh], [languages.hi]],
 },
 parse_mode: 'HTML',
 disable_web_page_preview: true,
}

const l = {
 continueAtHostbay: '🚀 All services are now available right here on Nomadly Bot — domains, leads, Cloud IVR, digital products & more.',
 redirectMessage: '🚀 All services are now available right here on Nomadly Bot — domains, leads, Cloud IVR, digital products & more.',

 serviceAd: `━━━━━━━━━━━━━━━━━━━━━━
⚡ <b>Nomadly</b> — Your Digital Toolkit
━━━━━━━━━━━━━━━━━━━━━━

📞 <b>Cloud IVR + SIP</b>
Virtual numbers in 30+ countries
IVR Auto-Attendant · SMS · Voicemail · SIP
Quick IVR & Bulk IVR campaigns

🌐 <b>Bulletproof Domains</b>
1,000+ TLDs · DMCA-ignored offshore
DNS management · Anti-Red protection

🛡️ <b>Anti-Red Hosting</b>
Offshore HostPanel · Weekly & monthly
JS Challenge shield · SSL included

🛒 <b>Digital Products</b>
Twilio · Telnyx · AWS · Google Cloud
Google Workspace · Zoho Mail · eSIM

💳 <b>Virtual Debit Cards</b>
Instant virtual cards · Worldwide use

🎯 <b>Verified Phone Leads</b>
Filter by country, carrier & area code
Premium leads with owner names

🔗 <b>URL Shortener</b>
Branded links · Custom domains · Analytics

━━━━━━━━━━━━━━━━━━━━━━
💰 Pay with <b>Crypto · Bank · Wallet</b>
━━━━━━━━━━━━━━━━━━━━━━

🤖 <b>Start Now →</b> @Nomadlybot
💬 <b>Need help?</b> Tap Get Support in the bot
📢 <b>Updates →</b> ${TG_CHANNEL}`,

 askPreferredLanguage: `🌍 To ensure everything is in your preferred language, please select one below:
 
You can always change your language later in the settings.`,
 askValidLanguage: 'Please choose a valid language:',
 settingsMenuText: '⚙️ <b>Settings</b>\n\nManage your preferences below:',
 welcomeMessage: `Welcome to ${CHAT_BOT_NAME}!

Your all-in-one digital toolkit:

<b>Cloud IVR</b> — Virtual numbers in 30+ countries, IVR, SMS, SIP
<b>Domains</b> — 400+ TLDs, DMCA-ignored offshore registration
<b>URL Shortener</b> — ${FREE_LINKS} free branded links to start
<b>Phone Leads</b> — Verified by country, carrier, and area
<b>Digital Products</b> — Twilio, Telnyx, AWS, Workspace, and more

Let's get you set up in 30 seconds.`,
 askUserEmail: 'What’s your email ? Let’s personalize your experience! (e.g., davidsen@gmail.com)',
 processUserEmail: ` Thank you 😊 We’re setting up your account now.
Please hold on for just a moment while we finalize the details. ⏳
 
We’re doing the work behind the scenes. Just follow the steps!`,
 confirmUserEmail: `✨ Great news! Your account is ready! 🎉💃🎉

Enjoy premium features during your free trial period!
`,
 termsAndCond: `📜 Before proceeding, please review and accept our Terms and Conditions.`,
 acceptTermMsg: `Please accept the Terms and Conditions to continue using ${CHAT_BOT_NAME}`,

 acceptTermButton: '✅ Accept',
 declineTermButton: '❌ Decline',
 viewTermsAgainButton: '🔄 View Terms Again',
 exitSetupButton: '❌ Exit Setup',
 acceptedTermsMsg: `You're all set! Here's how to get started:

<b>1.</b> Try your <b>${FREE_LINKS} free short links</b> — tap URL Shortener
<b>2.</b> Get a <b>virtual phone number</b> — tap Cloud IVR
<b>3.</b> Browse <b>verified digital products</b> — tap Digital Products

Everything is inside the menu below.`,
 declinedTermsMsg: `⚠️ You need to accept the Terms and Conditions to continue using ${CHAT_BOT_NAME}. 
Please review them again when you’re ready.`,
 userExitMsg: 'User has pressed exit button.',
 termsAndCondMsg: `<h1>Terms and Conditions for ${CHAT_BOT_NAME}</h1>
 <p><strong>Effective Date:</strong> 01/01/2022</p>
 <p>By using ${CHAT_BOT_NAME}, you agree to these Terms and Conditions.</p>

 <h2>1. Acceptance of Terms</h2>
 <p>You must be 18+ or have guardian consent and agree to these terms and our Privacy Policy.</p>

 <h2>2. Services Provided</h2>
 <p>We offer domain registration, web hosting, and site/app setup support.</p>

 <h2>3. User Responsibilities</h2>
 <p>Provide accurate information, avoid illegal activities, and secure your Telegram account.</p>

 <h2>4. Payment Terms</h2>
 <p>All payments are final unless otherwise stated. Non-payment may lead to service suspension.</p>

 <h2>5. Service Limitations</h2>
 <p>We may impose resource limits or experience downtime due to maintenance or technical issues.</p>

 <h2>6. Termination</h2>
 <p>We can terminate services for violations or non-payment. Users can cancel anytime, but fees are non-refundable.</p>

 <h2>7. Liability</h2>
 <p>Services are “as is.” We’re not liable for data loss, outages, or user security breaches.</p>

 <h2>8. Privacy</h2>
 <p>We handle your data per our Privacy Policy and only share it as legally required.</p>

 <h2>9. Changes to Terms</h2>
 <p>We may update these terms, and continued use implies acceptance.</p>

 <h2>10. Contact</h2>
 <p>For support, reach us at <a href="${APP_SUPPORT_LINK}" target="_blank">${APP_SUPPORT_LINK}</a>.</p>

 <p>By using ${CHAT_BOT_NAME}, you agree to these terms. Thank you!</p>`,
}

const termsAndConditionType = lang => ({
 reply_markup: {
 inline_keyboard: [
 [
 {
 text: 'View Terms And Condition',
 web_app: {
 url: `${SELF_URL}/terms-condition?lang=${lang}`,
 },
 },
 ],
 ],
 },
})

const planOptions = ['Daily', 'Weekly', 'Monthly']
const planOptionsOf = {
 Daily: 'Daily',
 Weekly: 'Weekly',
 Monthly: 'Monthly',
}

const linkOptions = [t.randomLink, t.customLink]

const chooseSubscription = {
 parse_mode: 'HTML',
 reply_markup: {
 keyboard: [...planOptions.map(a => [a]), _bc],
 },
}

const dO = {
 reply_markup: {
 keyboard: [_bc, ['Backup Data'], ['Restore Data']],
 },
}

const bc = {
 parse_mode: 'HTML',
 reply_markup: {
 keyboard: [_bc],
 },
 disable_web_page_preview: true,
}

const dns = {
 parse_mode: 'HTML',
 reply_markup: {
 keyboard: [[t.quickActions], [t.checkDns], [t.addDns], [t.updateDns], [t.deleteDns], [t.switchToCf], [t.activateShortener], _bc],
 },
 disable_web_page_preview: true,
}
const dnsRecordType = {
 parse_mode: 'HTML',
 reply_markup: {
 keyboard: [[t.a], [t.cname], [t.mx], [t.txt], _bc],
 },
 disable_web_page_preview: true,
}
const dnsQuickActionKeyboard = {
 parse_mode: 'HTML',
 reply_markup: {
 keyboard: [
 [dnsQuickActions.pointToIp],
 [dnsQuickActions.googleEmail],
 [dnsQuickActions.zohoEmail],
 [dnsQuickActions.verification],
 [dnsQuickActions.addSubdomain],
 _bc,
 ],
 },
 disable_web_page_preview: true,
}
const dnsMxPriorityKeyboard = {
 parse_mode: 'HTML',
 reply_markup: {
 keyboard: [['1'], ['5'], ['10'], ['20'], ['30'], _bc],
 },
 disable_web_page_preview: true,
}
const dnsSubdomainTargetTypeKeyboard = {
 parse_mode: 'HTML',
 reply_markup: {
 keyboard: [[t.dnsQuickSubdomainIp, t.dnsQuickSubdomainDomain], _bc],
 },
 disable_web_page_preview: true,
}

// Phase 2: Provider-aware record type keyboard (NS excluded — update only)
const getRecordTypeKeyboard = (dnsSource) => {
 const base = [[t.a], [t.aaaa], [t.cname], [t.mx], [t.txt]]
 if (dnsSource !== 'connectreseller') {
 base.push([t.srvRecord], [t.caaRecord])
 }
 base.push(_bc)
 return { parse_mode: 'HTML', reply_markup: { keyboard: base }, disable_web_page_preview: true }
}

const dnsCaaTagKeyboard = {
 parse_mode: 'HTML',
 reply_markup: {
 keyboard: [[t.caaTagIssue], [t.caaTagIssuewild], [t.caaTagIodef], _bc],
 },
 disable_web_page_preview: true,
}

const dnsSrvDefaultsKeyboard = {
 parse_mode: 'HTML',
 reply_markup: {
 keyboard: [['10'], ['20'], ['50'], _bc],
 },
 disable_web_page_preview: true,
}

const linkType = {
 reply_markup: {
 keyboard: [linkOptions, _bc],
 },
}

const show = domains => ({
 reply_markup: {
 keyboard: [[user.buyDomainName], ...domains.map(d => [d]), _bc],
 },
})

const payBank = url => ({
 reply_markup: {
 inline_keyboard: [
 [
 {
 text: 'Make Payment',
 web_app: {
 url,
 },
 },
 ],
 ],
 },
})

const html = (text = t.successPayment) => {
 return `
 <html>
 <body>
 <p style="font-family: 'system-ui';" >${text}</p>
 </body>
 </html>
 `
}
const plans = hostingType => {
 return {
 premiumWeekly: {
 name: 'Premium Anti-Red (1-Week)',
 price: PREMIUM_ANTIRED_WEEKLY_PRICE,
 duration: '7 days',
 storage: '10 GB SSD',
 bandwidth: '100 GB',
 domains: 'Unlimited domains',
 ssl: 'Free SSL',
 protection: 'IP cloaking · Bot detection · UA blocking',
 panel: 'HostPanel — file, DB & email management',
 },
 premiumCpanel: {
 name: 'Premium Anti-Red HostPanel (30 Days)',
 price: PREMIUM_ANTIRED_CPANEL_PRICE,
 duration: '30 days',
 storage: '50 GB SSD',
 bandwidth: '500 GB',
 domains: 'Unlimited domains',
 ssl: 'Free SSL',
 protection: 'IP cloaking · JS challenge · UA & TLS blocking',
 panel: 'HostPanel — backups, migration & advanced tools',
 },
 goldenCpanel: {
 name: 'Golden Anti-Red HostPanel (30 Days)',
 price: GOLDEN_ANTIRED_CPANEL_PRICE,
 duration: '30 days',
 storage: '100 GB SSD',
 bandwidth: 'Unlimited',
 domains: 'Unlimited domains',
 ssl: 'Free SSL + Wildcard',
 protection: 'Full Anti-Red: IP cloaking · JS challenge · TLS/JA3 · WAF rules · Priority support',
 panel: 'HostPanel — staging, security & all advanced tools',
 },
 }
}
const hostingPlansText = {
 plans: plans,
 generatePlanText: (hostingType, planKey) => {
 const plan = plans(hostingType)[planKey]
 return `<b>${plan.name} — $${plan.price}</b>

${plan.storage} · ${plan.bandwidth} · ${plan.domains}
${plan.ssl} · ${plan.protection}
${plan.panel}`
 },
 generatePlanStepText: step => {
 const commonSteps = {
 buyText: 'How would you like to connect a domain?\n\n🌐 <b>Register a New Domain</b>\n📂 <b>Use My Domain</b> — Pick from your domains\n🔗 <b>Connect External Domain</b> — Use a domain you own',
 registerNewDomainText: 'Enter your desired domain (e.g., example.com)',
 domainNotFound: 'Domain not found. Try a different one.',
 useExistingDomainText: 'Enter your domain (e.g., example.com)',
 connectExternalDomainText: 'Enter your external domain (e.g., example.com)\n\nYou\'ll need to point nameservers to Cloudflare after setup.',
 useExistingDomainNotFound: 'This domain isn\'t linked to your account. Try another or contact support.',
 enterYourEmail: 'Enter your email for account setup and receipt.\n\nTap "Skip" to continue without one.',
 invalidEmail: 'Invalid email. Try again.',
 paymentConfirmation: 'Confirm payment to activate your hosting.',
 paymentSuccess: 'Payment received — setting up your hosting now.',
 paymentFailed: 'Payment failed. Please try again.',
 }

 return `${commonSteps[step]}`
 },
 generateDomainFoundText: (websiteName, price) => `<b>${websiteName}</b> is available — $${price}`,
 generateExistingDomainText: websiteName => `Domain set: <b>${websiteName}</b>`,
 connectExternalDomainText: websiteName => `Domain: <b>${websiteName}</b>\n\nNameservers will be pointed to Cloudflare. DNS records auto-configured.`,
 domainNotFound: websiteName => `<b>${websiteName}</b> is not available. Try another.`,
 nameserverSelectionText: websiteName =>
 `Select nameserver provider for <b>${websiteName}</b>`,
 confirmEmailBeforeProceeding: email => `Use <b>${email}</b> for this account?`,

 generateInvoiceText: payload => {
 const domain = payload.existingDomain ? `${payload.domainName} (existing)` : `${payload.domainName} — $${payload.domainPrice}`
 const total = payload.couponApplied ? payload.newPrice : payload.totalPrice
 let text = `<b>${payload.planName || 'Anti-Red HostPanel'}</b> · ${payload.duration || '1 Month'}

Domain: ${domain}
Hosting: $${payload.hostingPrice}`
 if (payload.couponApplied && payload.couponDiscount > 0) {
 text += `\nDiscount: -$${payload.couponDiscount}`
 }
 text += `\n\n<b>Total: $${total}</b>

Pay within 1 hr to activate. Your hosting will be provisioned automatically.`
 return text
 },

 showCryptoPaymentInfo: (priceUsd, priceCrypto, tickerView, address, plan) => `💰 <b>Total: $${Number(priceUsd).toFixed(2)} USD</b>

Send exactly <b>${priceCrypto} ${tickerView}</b> to:

<code>${address}</code>

Your ${plan} activates automatically once payment is confirmed (usually within a few minutes).`,

 successText: (info, response) =>
 `Your hosting is live.

<b>Domain:</b> ${info.website_name}
${info.email ? `<b>Email:</b> ${info.email}\n` : ''}DNS auto-configured via Cloudflare.`,

 support: (plan, statusCode) => `Setup failed for ${plan} (${statusCode}). Tap 💬 Get Support for help.`,

 bankPayDomain: (
 priceNGN,
 plan,
 ) => `Pay <b>${priceNGN} NGN</b> via the button below. Your ${plan} activates automatically once confirmed.`,
}

const vpsBC = ['🔙 Back', 'Cancel']

const vpsOptionsOf = list => ({
 reply_markup: {
 // Handle if there are multiples buttons in a row
 keyboard: [
 ...list.map(a => (Array.isArray(a) ? a : [a])),
 ...(list.some(
 a => Array.isArray(a) && a.some(item => typeof item === 'string' && item.includes(t.goBackToCoupon)),
 )
 ? []
 : [vpsBC]),
 ],
 },
 parse_mode: 'HTML',
})

const vpsPlans = {
 hourly: 'Hourly',
 monthly: 'Monthly',
 quaterly: 'Quaterly',
 annually: 'Annually',
}

const vpsPlanMenu = ['Hourly', 'Monthly', 'Quarterly', 'Annually']
const vpsConfigurationMenu = ['Basic', 'Standard', 'Premium', 'Enterprise']
const vpsCpanelOptional = ['WHM', 'Plesk', '❌ Skip Control Panel']

const vpsPlanOf = {
 Hourly: 'hourly',
 Monthly: 'monthly',
 Quarterly: 'quaterly',
 Annually: 'annually',
}

// Voice Service translations
const vs = {
  callDisconnectedAutoRouted: (usdBal, lowBalTrigger, lowBalResume) => `🚫 <b>Call Disconnected</b> (auto-routed)\n\nWallet: <b>$${usdBal}</b> — below $${lowBalTrigger} threshold.\n💰 Top up at least $${lowBalResume} to resume calling.`,
  callDisconnectedWalletInsufficient: (rate, connFee) => `🚫 <b>Call Disconnected</b> — Wallet insufficient (need $${rate}/min + $${connFee} connect fee).\nTop up via 👛 Wallet.`,
  callDisconnectedWalletExhausted: `🚫 <b>Call Disconnected</b> — Wallet exhausted.\nTop up via 👛 Wallet.`,
  outboundCallFailedRouting: (fromPhone, toPhone) => `🚫 <b>Outbound Call Failed</b>\n📞 ${fromPhone} → ${toPhone}\nReason: Call routing failed. Please try again.`,
  planMinutesExhausted: (phoneNumber, used, limit) => `⚠️ <b>Plan Minutes Exhausted</b>\n\n📞 ${phoneNumber}\nUsed: <b>${used}/${limit}</b> minutes this cycle.\n\nOverage billing is now active from your wallet. Top up or upgrade your plan.`,
  callTypeCharge: (callType, minutesBilled, rate, chargedStr, region, discountLine) => `💰 <b>${callType}</b>: ${minutesBilled} min × $${rate} = <b>${chargedStr}</b> (${region})${discountLine}`,
  overageCharge: (newOverageMin, rate, chargedStr, region, discountLine) => `💰 <b>Overage</b>: ${newOverageMin} min × $${rate} = <b>${chargedStr}</b> (${region})${discountLine}`,
  transferEnded: (forwardPhone, duration, planLine) => `📞 <b>Transfer Ended</b>\n${forwardPhone} — ${duration}\n${planLine}`,
  transferFailed: (forwardPhone, reason) => `❌ <b>Transfer Failed</b>\n📞 ${forwardPhone} — ${reason}`,
  orphanedNumberAlert: (to, from) => `⚠️ <b>Orphaned Number Alert</b>\n\n📞 <code>${to}</code> received inbound call from <code>${from}</code>\n\n❌ No owner found in DB — call rejected.\nThis number may need to be released or re-assigned.`,
  incomingCallBlockedWalletEmpty: (toPhone, fromPhone, inboundRate, region) => `🚫 <b>Incoming Call Blocked — Wallet Empty</b>\n\n📞 ${toPhone}\n👤 Caller: ${fromPhone}\n\nPlan minutes exhausted and wallet balance is insufficient for overage ($${inboundRate}/min ${region}). Top up your wallet or upgrade your plan to resume receiving calls.`,
  overageActive: (chargedStr, region, currency) => `💰 <b>Overage Active</b> — Plan minutes exhausted. ${chargedStr} (${region}) from ${currency} wallet.`,
  callEndedPlanWalletExhausted: (elapsedMin) => `🚫 <b>Call Ended</b> — Plan minutes + wallet exhausted.\n⏱️ ~${elapsedMin} min. Top up wallet or upgrade plan.`,
  incomingCall: (fromPhone, toPhone) => `📞 <b>Incoming Call</b>\n${fromPhone} → ${toPhone}\nRinging your SIP device...`,
  outboundCallingLocked: `🚫 <b>Outbound Calling Locked</b>\n\n`,
  testCallsExpired: `⏰ <b>Test Calls Expired</b>\n\nYour free SIP test has ended. Please disconnect your SIP client to stop retrying.\n\n💡 To make more calls, purchase a Cloud Phone plan from the main menu.`,
  outboundCallBlocked: (fromPhone, toPhone, status) => `🚫 <b>Outbound Call Blocked</b>\n📞 ${fromPhone} → ${toPhone}\nReason: Number is ${status}. Please renew or contact support.`,
  sipCallBlocked: (sipRate, connFee, region, usdBal, ngnBal) => `🚫 <b>SIP Call Blocked</b> — Wallet balance insufficient (need $${sipRate}/min + $${connFee} connect fee ${region}).\nBalance: $${usdBal} / NGN: ₦${ngnBal}\nOutbound calls are billed from wallet. Top up via 👛 Wallet.`,
  freeSipTestCall: (fromPhone, toPhone, remaining, maxDuration) => `📞 <b>Free SIP Test Call</b>\nFrom: ${fromPhone}\nTo: ${toPhone}\n🆓 Free test call (${remaining} remaining, max ${maxDuration}s)`,
  sipOutboundCall: (fromPhone, toPhone, walletLine) => `📞 <b>SIP Outbound Call</b>\nFrom: ${fromPhone}\nTo: ${toPhone}\n${walletLine}`,
  outboundCallFailedTempUnavailable: (fromPhone, toPhone) => `🚫 <b>Outbound Call Failed</b>\n📞 ${fromPhone} → ${toPhone}\nReason: Outbound calling is temporarily unavailable. Please try again later.`,
  sipOutboundCallWithRate: (fromPhone, toPhone, sipRate, connFeeNote, estMinutes) => `📞 <b>SIP Outbound Call</b>\nFrom: ${fromPhone}\nTo: ${toPhone}\nRate: $${sipRate}/min${connFeeNote} (~${estMinutes} min available)`,
  lowBalanceForward: (usdBal, estMinutes) => `⚠️ <b>Low Balance</b> — $${usdBal} (~${estMinutes} min fwd). Top up <b>$25</b> via 👛 Wallet.`,
  forwardingBlocked: (usdBal, fwdRate) => `🚫 <b>Forwarding Blocked</b> — Wallet $${usdBal} (need $${fwdRate}/min).\nTop up <b>$25</b> via 👛 Wallet.`,
  ivrForwardBlocked: (fromPhone, forwardPhone, usdBal, ivrFwdRate, region) => `🚫 <b>IVR Forward Blocked — Wallet Empty</b>\n\n📞 ${fromPhone}\n📲 Forward to: ${forwardPhone}\n\nWallet $${usdBal} (need $${ivrFwdRate}/min ${region}).\nTop up via 👛 Wallet.`,
  lowBalanceIvrForward: (usdBal, estMinutes) => `⚠️ <b>Low Balance</b> — $${usdBal} (~${estMinutes} min IVR fwd). Top up via 👛 Wallet.`,
  sipCallEndedAutoRouted: (fromPhone, toPhone, duration, minutesBilled, rate) => `📞 <b>SIP Call Ended</b> (auto-routed)\n\nFrom: ${fromPhone}\nTo: ${toPhone}\n⏱️ ${duration}\n💰 ${minutesBilled} min × $${rate} billed`,
  ivrCallEndedWalletExhausted: (usdBal, ivrCallRate) => `🚫 <b>IVR Call Ended</b> — Wallet exhausted ($${usdBal}).\nIVR calls cost $${ivrCallRate}/min. Top up via 👛 Wallet.`,
  callNotConnected: `📞 <b>Call not connected</b> — the recipient was busy or didn't answer.\n\n🎁 Your free trial call is still available! Try again anytime.`,
  transferTimeout: (toPhone) => `⏱ <b>Transfer Timeout</b>\n📞 ${toPhone} didn't answer after 30 seconds`,
  transferConnected: (targetNumber, ivrNumber) => `✅ <b>Transfer Connected</b>\n📞 ${targetNumber} connected to ${ivrNumber}`,
}

const vp = {
 of: vpsOptionsOf,
 back: '🔙 Back',
 skip: '❌ Skip',
 cancel: '❌ Cancel',

 // VPS/RDP choice (Step 1)
 vpsLinuxBtn: '🐧 Linux VPS (SSH)',
 vpsRdpBtn: '🪟 Windows RDP',
 askVpsOrRdp: `🖥️ What type of server do you need?

📬 <b>Port 25 Open</b> — Send emails directly from your server

<strong>🐧 Linux VPS</strong> — SSH access · web hosting · dev · automation
<strong>🪟 Windows RDP</strong> — Remote Desktop · Windows apps & tools`,

 //region selection
 askCountryForUser: `🌍 Select a region closest to your users:`,
 chooseValidCountry: 'Please choose country from the list:',
 askRegionForUser: country => `📍 Select a data center within ${country} (Pricing may vary by location.)`,
 chooseValidRegion: 'Please choose valid region from the list:',
 askZoneForUser: region => `📍 Choose the zone within ${region}.`,
 chooseValidZone: 'Please choose valid zone from the list:',
 confirmZone: (region, zone) => `✅ You’ve selected the ${region} (${zone}) Do you want to proceed with this choice?`,
 failedFetchingData: 'Error fetching, Please try again after some time.',
 confirmBtn: `✅ Confirm Selection`,

 // disk type
 askVpsDiskType: list => `💾 <b>Choose Storage Type</b>

Both options cost the same — pick what matters more to you:

${list?.map(item => `${item.description}`).join('\n\n')}

👇 Tap your choice below:`,

 chooseValidDiskType: 'Please choose a valid disk type',

 // plans
 askPlanType: plans => `💳 Choose a billing cycle:

${plans
 .map(
 item =>
 `<strong>• ${item.type === 'Hourly' ? '⏳' : '📅'} ${item.type} –</strong> $${item.originalPrice} ${
 item.discount === 0 ? '(No discount)' : `(includes ${item.discount}% off)`
 }`,
 )
 .join('\n')}`,

 planTypeMenu: vpsOptionsOf(vpsPlanMenu),
 // Billing (Monthly only)
 hourlyBillingMessage: '',

 // configs
 askVpsConfig: list => `⚙️ Pick a plan:
 
${list
 .map(
 config =>
 `<strong>• ${config.name}</strong> — ${config.specs.vCPU} vCPU · ${config.specs.RAM}GB RAM · ${config.specs.disk}GB ${config.specs.diskType}`,
 )
 .join('\n')}`,
 validVpsConfig: 'Please select a valid vps configuration:',
 configMenu: vpsOptionsOf(vpsConfigurationMenu),

 //discount
 askForCoupon: `🎟️ Have a coupon code? Enter it for an extra discount if applicable, or skip this step. Any billing cycle discounts are already included.`,
 couponInvalid: `❌ Invalid: Code expired, not applicable, or incorrect. Try again.`,
 couponValid: amt => `✅ Valid: Discount applied: -$${amt}.`,
 skipCouponwarning: `⚠️ Skipping means you cannot apply a discount later.`,
 confirmSkip: '✅ Confirm Skip',
 goBackToCoupon: '❌ Go Back & Apply Coupon',

 // os
 askVpsOS: () => `💻 Select a Linux distro (default: Ubuntu):

<strong>💡 Recommended:</strong>
<strong>• Ubuntu</strong> — General use & development
<strong>• AlmaLinux / Rocky</strong> — Enterprise stability
<strong>• Debian</strong> — Lightweight & reliable`,
 chooseValidOS: `Please select a valid OS from available list:`,
 skipOSBtn: '❌ Skip OS Selection',
 skipOSwarning: '⚠️ Your VPS will launch without an OS. You’ll need to install one manually via SSH or recovery mode.',

 // cpanel
 askVpsCpanel: `🛠️ Select a control panel for easier server management (optional).

<strong>• ⚙️ WHM –</strong> Recommended for hosting multiple websites
<strong>• ⚙️ Plesk –</strong> Ideal for managing individual websites and applications
<strong>• ❌ Skip –</strong> No control panel
`,
 cpanelMenu: vpsOptionsOf(vpsCpanelOptional),
 noControlPanel: vpsCpanelOptional[2],
 skipPanelMessage: '⚠️ No control panel will be installed. You can install one manually later.',
 validCpanel: 'Please choose a valid control panel or skip it.',
 askCpanelOtions: (name, list) => `⚙️ Choose a ${
 name == 'whm' ? 'WHM' : 'Plesk Web Host Edition'
 } license or select a free trial (valid for ${name == 'whm' ? '15' : '7'} days).

💰 ${name == 'whm' ? 'WHM' : 'Plesk'} License Pricing:

${list.map(item => `${name == 'whm' ? `<strong>• ${item.name} - </strong>` : ''}${item.label}`).join('\n')}`,
 trialCpanelMessage: panel =>
 `✅ ${panel.name == 'whm' ? 'WHM' : 'Plesk'} Free Trial (${
 panel.duration
 } days) activated. You can upgrade anytime by reaching out to support.`,

 vpsWaitingTime: '⚙️ Retrieving Details... This will only take a moment.',
 failedCostRetrieval: 'Failied in retrieving cost information... Please try again after some time.',

 errorPurchasingVPS: plan => `Something went wrong while setting up your ${plan} VPS Plan.

 Please tap 💬 Get Support for assistance.
 Discover more ${TG_HANDLE}.`,

 generateBillSummary: vpsDetails => {
 const planPrice = vpsDetails.couponApplied ? vpsDetails.planNewPrice : vpsDetails.plantotalPrice
 const total = vpsDetails.totalPrice || Number(planPrice).toFixed(2)
 const isRDP = vpsDetails.isRDP
 const osLabel = isRDP ? '🪟 Windows Server (RDP)' : (vpsDetails.os?.name || 'Ubuntu')
 
 let summary = `<strong>📋 Order Summary:</strong>

<strong>🖥️ ${vpsDetails.config.name}</strong> — ${vpsDetails.config.specs.vCPU} vCPU · ${vpsDetails.config.specs.RAM}GB RAM · ${vpsDetails.config.specs.disk}GB ${vpsDetails.config.specs.diskType}
<strong>📍 Region:</strong> ${vpsDetails.regionName || vpsDetails.country}
<strong>💻 OS:</strong> ${osLabel}`

 if (isRDP) {
 summary += `\n<strong>🪟 Windows License:</strong> Included`
 }
 if (vpsDetails.couponApplied && vpsDetails.couponDiscount > 0) {
 summary += `\n<strong>🎟️ Coupon:</strong> -$${Number(vpsDetails.couponDiscount).toFixed(2)} USD`
 }
 summary += `\n<strong>🔄 Auto-Renewal:</strong> ✅ Enabled`
 summary += `\n\n<strong>💰 Total: $${total} USD/mo</strong>`
 summary += `\n\n<strong>✅ Proceed with the order?</strong>`
 return summary
 },

 no: '❌ Cancel Order',
 yes: '✅ Confirm Order',

 askPaymentMethod: 'Choose a payment method:',

 showDepositCryptoInfoVps: (priceUsd, priceCrypto, tickerView, address, vpsDetails) =>
 `💰 <b>Payment Amount: $${Number(priceUsd).toFixed(2)} USD</b>

Send exactly <b>${priceCrypto} ${tickerView}</b> to:

<code>${address}</code>

Your ${vpsDetails?.plan || 'VPS'} plan will activate automatically once payment is confirmed (usually within a few minutes).

Best regards,
${CHAT_BOT_NAME}`,

 extraMoney: 'The remaining amount for your hourly plan has been deposited to wallet.',
 paymentRecieved: `✅ Payment successful!

Your VPS is being set up.
Details will be sent to your email shortly.`,
 paymentFailed: `❌ Payment failed. Please check your payment method or try again.`,

 lowWalletBalance: vpsName => `
Your VPS Plan for instance ${vpsName} has been stopped due to low balance.

Please top up your wallet to continue using your VPS Plan.
`,

 vpsBoughtSuccess: (vpsDetails, response, credentials) => {
 const isRDP = response.isRDP || vpsDetails.isRDP || response.osType === 'Windows'
 const connectInfo = isRDP
 ? ` <strong>• Connect:</strong> 🖥 Remote Desktop → <code>${response.host}:3389</code>\n <strong>• How:</strong> Open Remote Desktop Connection (mstsc) and enter the address above.`
 : ` <strong>• Connect:</strong> 💻 <code>ssh ${credentials.username}@${response.host}</code>`
 
 const passwordWarning = isRDP
 ? `\n⚠️ <strong>IMPORTANT - Save Your Password Now!</strong>\n• We CANNOT retrieve it later for security reasons\n• If lost, use "Reset Password" from VPS management (data preserved)\n• Click the password above to reveal and copy it\n`
 : `\n⚠️ <strong>Save your credentials securely!</strong>\n`
 
 return `<strong>🎉 ${isRDP ? 'RDP' : 'VPS'} [${response.label}] is active!</strong>

<strong>🔑 Login Credentials:</strong>
 <strong>• IP:</strong> ${response.host}
 <strong>• OS:</strong> ${vpsDetails.os ? vpsDetails.os.name : (isRDP ? 'Windows Server' : 'Linux')}
 <strong>• Username:</strong> ${credentials.username}
 <strong>• Password:</strong> <tg-spoiler>${credentials.password}</tg-spoiler> (change immediately)

<strong>🔗 Connection:</strong>
${connectInfo}
${passwordWarning}
📧 These details have also been sent to your registered email. Please keep them secure.

Thank you for choosing our service
${CHAT_BOT_NAME}
`
 },
 vpsHourlyPlanRenewed: (vpsName, price) => `
Your VPS Plan for instance ${vpsName} has been renewed successfully.
${price}$ has been deducted from your wallet.`,

 vpsMonthlyPlanRenewed: (vpsName, planPrice) =>
 `✅ Your VPS <b>${vpsName}</b> has been auto-renewed for 1 month.\n💰 $${planPrice} deducted from wallet.`,

 vpsExpiredNoAutoRenew: (vpsName) =>
 `⚠️ Your VPS <b>${vpsName}</b> has expired. Auto-renewal is disabled.\nPlease renew manually to continue service.`,

 bankPayVPS: (
 priceNGN,
 plan,
 ) => `Please remit ${priceNGN} NGN by clicking “Make Payment” below. Once the transaction has been confirmed, you will be promptly notified, and your ${plan} VPS plan will be seamlessly activated.

Best regards,
${CHAT_BOT_NAME}`,

 askAutoRenewal: `🔄 Enable auto-renewal for uninterrupted service?
 
🛑 You will receive a reminder before renewal. You can disable this anytime.`,
 enable: '✅ Enable',
 skipAutoRenewalWarming: expiresAt =>
 `⚠️ Your VPS will expire on ${new Date(expiresAt).toLocaleDateString('en-GB').replace(/\//g, '-')} ${new Date(
 expiresAt,
 ).toLocaleTimeString('en-GB', {
 hour: '2-digit',
 minute: '2-digit',
 hour12: false,
 })}, and service may be interrupted.`,

 generateSSHKeyBtn: '✅ Generate New Key',
 linkSSHKeyBtn: '🗂️ Link Existing Key',
 skipSSHKeyBtn: '❌ Skip (Use Password Login)',
 noExistingSSHMessage:
 '🔑 No SSH keys detected. Would you like to generate a new SSH key for secure access, or use password login (less secure)?',
 existingSSHMessage: '🔑 You have existing SSH keys. Choose an option:',
 confirmSkipSSHMsg: `⚠️ Warning: Password logins are less secure and vulnerable to attacks.
🔹 We strongly recommend using SSH keys. Are you sure you want to proceed?`,
 confirmSkipSSHBtn: '✅ Proceed Anyway',
 setUpSSHBtn: '🔄 Set Up SSH Key',
 sshLinkingSkipped: '❌ SSH key linking skipped. No changes were made.',
 newSSHKeyGeneratedMsg: name => `✅ SSH key (${name}) created.
⚠️ Save this key securely – it can be retrieved later also.`,
 selectSSHKey: '🗂️ Select an existing SSH key to link with your VPS:',
 uploadNewKeyBtn: '➕ Upload New Key',
 cancelLinkingSSHKey: `❌ SSH key linking canceled. No changes were made.`,
 selectValidSShKey: 'Please select a valid SSH key from the list.',
 sshKeySavedForVPS: name => `✅ SSH key ( ${name} ) will be linked to New VPS.`,
 askToUploadSSHKey: `📤 Upload your SSH public key (.pub file) or paste the key below.`,
 failedGeneratingSSHKey: 'Failed to generate new SSH key. Please try again or different method.',
 newSSHKeyUploadedMsg: name => `✅ SSH key (${name}) successfully uploaded and will be linked to VPS.`,
 fileTypePub: 'File type should be .pub',

 // VPS Management
 vpsList: list => `<strong>🖥️ Active VPS Instances:</strong>

${list
 .map(vps => `<strong>• ${vps.name} :</strong> ${vps.status === 'RUNNING' ? '🟢' : '🔴'} ${vps.status}`)
 .join('\n')}
`,
 noVPSfound: 'No Active VPS instance exists. Create a new one.',
 selectCorrectOption: 'Please select a option from the list',
 selectedVpsData: data => `<strong>🖥️ VPS ID:</strong> ${data.name}

<strong>• Plan:</strong> ${data.planDetails.name}
<strong>• vCPUs:</strong> ${data.planDetails.specs.vCPU} | RAM: ${data.planDetails.specs.RAM} GB | Disk: ${
 data.planDetails.specs.disk
 } GB (${data.diskTypeDetails.type})
<strong>• OS:</strong> ${data.osDetails.name}
<strong>• Control Panel:</strong> ${
 data.cPanelPlanDetails && data.cPanelPlanDetails.type ? data.cPanelPlanDetails.type : 'None'
 }
<strong>• Status:</strong> ${data.status === 'RUNNING' ? '🟢' : '🔴'} ${data.status}
<strong>• Auto-Renewal:</strong> ${data.autoRenewable ? 'Enabled' : 'Disabled'}
<strong>• IP Address:</strong> ${data.host}`,
 stopVpsBtn: '⏹️ Stop',
 startVpsBtn: '▶️ Start',
 restartVpsBtn: '🔄 Restart',
 deleteVpsBtn: '🗑️ Delete',
 subscriptionBtn: '🔄 Subscriptions',
 VpsLinkedKeysBtn: '🔑 SSH Keys',
 resetPasswordBtn: '🔑 Reset Password',
 reinstallWindowsBtn: '🔄 Reinstall Windows',
 confirmChangeBtn: '✅ Confirm',

 confirmStopVpstext: name => `⚠️ Are you sure you want to stop VPS <strong>${name}</strong>?`,
 vpsBeingStopped: name => `⚙️ Please wait while your VPS (${name}) is being stopped`,
 vpsStopped: name => `✅ VPS (${name}) has been stopped.`,
 failedStoppingVPS: name => `❌ Failed to stop VPS (${name}). 

Please Try again after sometime.`,
 vpsBeingStarted: name => `⚙️ Please wait while your VPS (${name}) is being started`,
 vpsStarted: name => `✅ VPS (${name}) his now running.`,
 failedStartedVPS: name => `❌ Failed to start VPS (${name}). 

Please Try again after sometime.`,
 vpsBeingRestarted: name => `⚙️ Please wait while your VPS (${name}) is being restarted`,
 vpsRestarted: name => `✅ VPS (${name}) has been successfully restarted.`,
 failedRestartingVPS: name => `❌ Failed to restart VPS (${name}). 

Please Try again after sometime.`,
 confirmDeleteVpstext: name =>
 `⚠️ Warning: Deleting this VPS ${name} is permanent, and all data will be lost.
 • No refund for unused subscription time.
 • Auto-renewal will be canceled, and no further charges will apply.

Do you want to proceed?`,
 
 confirmResetPasswordText: name => `🔑 <strong>Reset RDP Password</strong>

⚠️ <strong>Important:</strong>
• Your current password will stop working
• A new password will be generated
• All your data and files will be preserved
• You'll need the new password to access RDP

Do you want to reset the password for <strong>${name}</strong>?`,

 confirmReinstallWindowsText: name => `🔄 <strong>Reinstall Windows</strong>

⚠️ <strong>CRITICAL WARNING:</strong>
• This will ERASE ALL DATA on your RDP
• All files, programs, and settings will be deleted
• A fresh Windows installation will be created
• New credentials will be generated
• Your old password will NO LONGER work

💾 <strong>Recommendation:</strong> Create a backup/snapshot before proceeding.

Do you want to reinstall Windows on <strong>${name}</strong>?`,

 passwordResetInProgress: name => `🔄 Resetting password for <strong>${name}</strong>...

⏱️ This may take 30-60 seconds. Please wait.`,

 passwordResetSuccess: (name, ip, username, password) => `✅ <strong>Password Reset Successful!</strong>

🖥️ <strong>RDP:</strong> ${name}
🌐 <strong>IP:</strong> ${ip}
👤 <strong>Username:</strong> ${username}
🔑 <strong>New Password:</strong> <code>${password}</code>

⚠️ <strong>IMPORTANT - Save This Password Now!</strong>
• We cannot retrieve it later for security reasons
• If lost, you must reset your password again (data will be preserved)
• Your old password no longer works

💡 Click the password to copy it.`,

 windowsReinstallInProgress: name => `🔄 Reinstalling Windows on <strong>${name}</strong>...

⏱️ This process takes 5-10 minutes. 
📧 You'll receive new credentials when complete.`,

 windowsReinstallSuccess: (name, ip, username, password) => `🎉 <strong>Windows Reinstalled Successfully!</strong>

🖥️ <strong>RDP:</strong> ${name}
🌐 <strong>IP:</strong> ${ip}
👤 <strong>Username:</strong> ${username}
🔑 <strong>Password:</strong> <code>${password}</code>

⚠️ <strong>CRITICAL - Save This Password Now!</strong>
• We CANNOT retrieve it later for security reasons
• All previous data has been erased
• This is a fresh Windows installation
• If you lose this password, you must reset it (use "Reset Password" button)

💡 Click the password to copy it.
🚀 Your RDP is ready to use with these new credentials!`,

 passwordResetFailed: name => `❌ <strong>Password Reset Failed</strong>

Failed to reset password for <strong>${name}</strong>.

Please try again in a few minutes or contact support if the issue persists.`,

 windowsReinstallFailed: name => `❌ <strong>Windows Reinstall Failed</strong>

Failed to reinstall Windows on <strong>${name}</strong>.

Please try again in a few minutes or contact support if the issue persists.`,

 rdpNotSupported: `⚠️ This feature is only available for Windows RDP instances.

Your VPS is running Linux. Use SSH keys for access management instead.`,
 vpsBeingDeleted: name => `⚙️ Please wait while your VPS (${name}) is being deleted`,
 vpsDeleted: name => `✅ VPS (${name}) has been permanently deleted.`,
 failedDeletingVPS: name => `❌ Failed to delete VPS (${name}). 

Please Try again after sometime.`,
 upgradeVpsBtn: '⬆️ Upgrade',
 upgradeVpsPlanBtn: '⬆️ VPS Plan',
 upgradeVpsDiskBtn: '📀 Disk Type',
 upgradeVpsDiskTypeBtn: '💾 Upgrade Disk Type',
 upgradeVPS: 'Choose upgrade type',
 upgradeOptionVPSBtn: to => {
 return `🔼 Upgrade to ${to}`
 },
 upgradeVpsPlanMsg: options => `⚙️ Choose a new plan to scale your VPS resources.
💡 Upgrading increases vCPUs, RAM, and storage but cannot be reversed.

📌 Available Upgrades:
${options
 .map(
 planDetails =>
 `<strong>• ${planDetails.from} ➡ ${planDetails.to} –</strong> $${planDetails.monthlyPrice}/month ($${planDetails.hourlyPrice}/hour)`,
 )
 .join('\n')}
 
💰 Billing Notice: Your current plan will be credited for unused days, and the new rate will apply for the remainder of the billing cycle (prorated adjustment).`,

 alreadyEnterprisePlan:
 '⚠️ You are already on the highest available plan (Enterprise). No further upgrades are possible.',

 alreadyHighestDisk: vpsData =>
 `⚠️ You are already on the highest available disk (${vpsData.diskTypeDetails.type}). No further upgrades are possible.`,
 newVpsDiskBtn: type => `Upgrade to ${type}`,
 upgradeVpsDiskMsg: upgrades => `💾 Upgrade your storage type for better performance.
⚠️ Disk upgrades are permanent and cannot be downgraded.

📌 Available Options:
${upgrades.map(val => `<strong>• ${val.from} ➡ ${val.to} –</strong> +$${val.price}/${val.duration}`).join('\n')}
 
💰 Billing Notice: If the upgrade is applied mid-cycle, a prorated adjustment will be applied for the unused portion of your current billing period.`,
 upgradePlanSummary: (newData, vpsDetails, lowBal) => `<strong>📜 Order Summary:</strong>

<strong>• VPS ID: </strong> ${vpsDetails.name}
<strong>• Old Plan: </strong> ${newData.upgradeOption.from}
<strong>• New Plan: </strong> ${newData.upgradeOption.to}
<strong>• Billing Cycle: </strong> ${newData.billingCycle}
<strong>• New Billing Rate: </strong> $${newData.totalPrice} USD${
 newData.billingCycle === 'Hourly' ? '/hour' : ' (prorated adjustment applied)'
 }
<strong>• Effective Date: </strong> Immediately
${
 lowBal
 ? `
Note: A $${VPS_HOURLY_PLAN_MINIMUM_AMOUNT_PAYABLE} USD deposit is included in your total. After the first hourly rate is deducted, the remaining deposit will be credited to your wallet.
`
 : ''
}
<strong>• Total Price: </strong> $${lowBal ? VPS_HOURLY_PLAN_MINIMUM_AMOUNT_PAYABLE : newData.totalPrice} USD

<strong>✅ Proceed with the order?</strong>`,
 upgradeDiskSummary: (newData, vpsDetails, lowBal) => `<strong>📜 Order Summary:</strong>

<strong>• VPS ID: </strong> ${vpsDetails.name}
<strong>• Old Disk Type: </strong> ${newData.upgradeOption.from}
<strong>• New Disk type: </strong> ${newData.upgradeOption.to}
<strong>• Billing Cycle: </strong> ${newData.billingCycle}
<strong>• New Billing Rate: </strong> $${newData.totalPrice} USD${
 newData.billingCycle === 'Hourly' ? '/hour' : ' (prorated adjustment applied)'
 }
${
 lowBal
 ? `
Note: A $${VPS_HOURLY_PLAN_MINIMUM_AMOUNT_PAYABLE} USD deposit is included in your total. After the first hourly rate is deducted, the remaining deposit will be credited to your wallet.
`
 : ''
}
<strong>• Total Price: </strong> $${lowBal ? VPS_HOURLY_PLAN_MINIMUM_AMOUNT_PAYABLE : newData.totalPrice} USD

<strong>✅ Proceed with the order?</strong>`,

 vpsSubscriptionData: (vpsData, planExpireDate, panelExpireDate) => `<strong>🗂️ Your Active Subscriptions:</strong>

<strong>• VPS ${vpsData.name} </strong>– Expires: ${planExpireDate} (Auto-Renew: ${
 vpsData.autoRenewable ? 'Enabled' : 'Disabled'
 })
<strong>• Control Panel ${vpsData?.cPanelPlanDetails ? vpsData.cPanelPlanDetails.type : ': Not Selected'} </strong> ${
 vpsData?.cPanelPlanDetails
 ? `${vpsData?.cPanelPlanDetails.status === 'active' ? '- Expires: ' : '- Expired: '}${panelExpireDate}`
 : ''
 } `,

 manageVpsSubBtn: '🖥️ Manage VPS Subscription',
 manageVpsPanelBtn: '🛠️ Manage Control Panel Subscription',

 vpsSubDetails: (data, date) => `<strong>📅 VPS Subscription Details:</strong>

<strong>• VPS ID:</strong> ${data.name}
<strong>• Plan:</strong> ${data.planDetails.name}
<strong>• Current Expiry Date:</strong> ${date}
<strong>• Auto-Renewal:</strong> ${data.autoRenewable ? 'Enabled' : 'Disabled'}`,

 vpsCPanelDetails: (data, date) => `<strong>📅 Control Panel Subscription Details:</strong>

<strong>• Linked VPS ID:</strong> ${data.name}
<strong>• Control Panel Type:</strong> ${data.cPanelPlanDetails.type} (${data.cPanelPlanDetails.name})
<strong>• Current Expiry Date:</strong> ${date}
<strong>• Auto-Renewal:</strong> ${data.autoRenewable ? 'Enabled' : 'Disabled'}
`,

 vpsEnableRenewalBtn: '🔄 Enable Auto-Renew',
 vpsDisableRenewalBtn: '❌ Disable Auto-Renew',
 vpsPlanRenewBtn: '📅 Renew Now',
 unlinkVpsPanelBtn: '❌ Unlink from VPS',
 bankPayVPSUpgradePlan: (priceNGN, vpsDetails) =>
 `Please remit ${priceNGN} NGN by clicking “Make Payment” below. Once the transaction has been confirmed, you will be promptly notified, and your new ${vpsDetails.upgradeOption.to} VPS plan will be seamlessly activated.`,

 bankPayVPSUpgradeDisk: (priceNGN, vpsDetails) =>
 `Please remit ${priceNGN} NGN by clicking “Make Payment” below. Once the transaction has been confirmed, you will be promptly notified, and your VPS plan with new disk type ${vpsDetails.upgradeOption.toType} config will be seamlessly activated.`,

 showDepositCryptoInfoVpsUpgrade: (priceUsd, priceCrypto, tickerView, address) =>
 `💰 <b>Payment Amount: $${Number(priceUsd).toFixed(2)} USD</b>

Send exactly <b>${priceCrypto} ${tickerView}</b> to:

<code>${address}</code>

Your upgraded VPS plan will activate automatically once payment is confirmed (usually within a few minutes).

Best regards,
${CHAT_BOT_NAME}`,

 linkVpsSSHKeyBtn: '➕ Link New Key',
 unlinkSSHKeyBtn: '❌ Unlink Key',
 downloadSSHKeyBtn: '⬇️ Download Key',

 noLinkedKey: name => `⚠️ There is currently no SSH key associated with this VPS [${name}]. 
 
Please link an SSH key to your account to enable secure access.`,
 linkedKeyList: (list, name) => `🗂️ SSH Keys Linked to VPS ${name}:

${list.map(val => `<strong>• ${val}</strong>`).join('\n')}`,

 unlinkSSHKeyList: name => `🗂️ Select an SSH key to remove from VPS [${name}]:`,
 confirmUnlinkKey: data => `⚠️ Are you sure you want to unlink [${data.keyForUnlink}] from VPS [${data.name}]?`,
 confirmUnlinkBtn: '✅ Confirm Unlink',
 keyUnlinkedMsg: data => `✅ SSH key [${data.keyForUnlink}] has been unlinked from VPS [${data.name}].`,
 failedUnlinkingKey: data => `❌ Failed to unlink SSH key form VPS (${data.name}). 

Please Try again after sometime.`,

 userSSHKeyList: name => `🗂️ Select an SSH key to link to VPS [${name}]:`,
 noUserKeyList: `🔑 No SSH keys detected. Would you like to upload a new SSH key?`,
 linkKeyToVpsSuccess: (key, name) => `✅ SSH key [${key}] successfully linked to VPS [${name}].`,
 failedLinkingSSHkeyToVps: (key, name) => `❌ Failed to link SSH key [${key}] to VPS (${name}). 

Please Try again after sometime.`,
 selectSSHKeyToDownload: '🗂️ Select the SSH key you want to download:',
 disabledAutoRenewal: (
 data,
 expiryDate,
 ) => `⚠️ Auto-renewal disabled. Your VPS will expire on ${expiryDate} unless manually renewed.
✅ Auto-renewal successfully disabled.`,
 enabledAutoRenewal: (data, expiryDate) =>
 `✅ Auto-renewal enabled. Your VPS will automatically renew on ${expiryDate}.`,

 renewVpsPlanConfirmMsg: (data, vpsDetails, expiryDate, lowBal) => `<strong>📜 Invoice Summary</strong>

<strong>• VPS ID:</strong> ${vpsDetails.name}
<strong>• Plan:</strong> ${vpsDetails.planDetails.name}
<strong>• Billing Cycle:</strong> ${vpsDetails.billingCycleDetails.type}
<strong>• Current Expiry Date:</strong> ${expiryDate}
<strong>• Amount Due:</strong> ${data.totalPrice} USD

${
 lowBal
 ? `Note: A $${VPS_HOURLY_PLAN_MINIMUM_AMOUNT_PAYABLE} USD deposit is included in your total. After the first hourly rate is deducted, the remaining deposit will be credited to your wallet.`
 : ''
}

<strong>• Total Price: </strong> $${lowBal ? VPS_HOURLY_PLAN_MINIMUM_AMOUNT_PAYABLE : data.totalPrice} USD

<strong>💳 Proceed with VPS renewal?</strong>`,

 payNowBtn: '✅ Pay now',

 vpsChangePaymentRecieved: `✅ Payment successful! Your VPS is being set up. Details will be available shortly.`,

 bankPayVPSRenewPlan: priceNGN =>
 `Please remit ${priceNGN} NGN by clicking “Make Payment” below. Once the transaction has been confirmed, you will be promptly notified, and your VPS plan be seamlessly activated and renewed.`,

 renewVpsPanelConfirmMsg: (data, panelDetails, date) => `<strong>💳 Proceed with Control Panel renewal?</strong>

<strong>📜 Invoice Summary</strong>
 <strong>• Linked VPS ID:</strong> ${data.name}
 <strong>• Control Panel:</strong> ${panelDetails.type}
 <strong>• Renewal Period:</strong> ${panelDetails.durationValue}${' '}Month
 <strong>• Current Expiry Date:</strong> ${date}
 <strong>• Amount Due:</strong> ${data.totalPrice} USD`,

 bankPayVPSRenewCpanel: (priceNGN, vpsDetails) =>
 `Please remit ${priceNGN} NGN by clicking “Make Payment” below. Once the transaction has been confirmed, you will be promptly notified, and your VPS plan be seamlessly activated and ${vpsDetails.cPanelPlanDetails.type} Control Panel will be renewed.`,
 vpsUnlinkCpanelWarning: vpsDetails =>
 `⚠️ Warning: Unlinking will remove the ${vpsDetails.cPanel} license from VPS ${vpsDetails.name}, and you will lose access to its features. Do you want to proceed?`,
 unlinkCpanelConfirmed: data => `✅ Control Panel ${data.cPanel} successfully unlinked from VPS ${data.name}.`,

 errorUpgradingVPS: vpsName => `Something went wrong while upgrading your VPS Plan ${vpsName}.

 Please tap 💬 Get Support for assistance.
 Discover more ${TG_HANDLE}.`,

 vpsUpgradePlanTypeSuccess: vpsDetails => `
 ✅ VPS ${vpsDetails.name} upgraded to ${vpsDetails.upgradeOption.to}. Your new resources are now available.`,

 vpsUpgradeDiskTypeSuccess: vpsDetails =>
 `✅ Disk upgraded to ${vpsDetails.upgradeOption.to} for VPS ${vpsDetails.name}. Your updated disk type is now active.`,

 vpsRenewPlanSuccess: (vpsDetails, expiryDate) =>
 `✅ VPS subscription for ${vpsDetails.name} successfully renewed!

• New Expiry Date: ${expiryDate}
`,
 vpsRenewCPanelSuccess: (vpsDetails, expiryDate) =>
 `✅ Control Panel subscription for ${vpsDetails.name} successfully renewed!

• New Expiry Date: ${expiryDate}
`,
}

const en = {
 k,
 t,
 u,
 dO,
 bc,
 npl,
 dns,
 kOf,
 user,
 show,
 yesNo,
 html,
 payIn,
 admin,
 payOpts,
 yes_no,
 payBank,
 alcazar,
 tickerOf,
 linkType,
 tickerViews,
 linkOptions,
 planOptions,
 tickerViewOf,
 dnsRecordType,
 dnsQuickActionKeyboard,
 dnsMxPriorityKeyboard,
 dnsSubdomainTargetTypeKeyboard,
 dnsQuickActions,
 getRecordTypeKeyboard,
 dnsCaaTagKeyboard,
 dnsSrvDefaultsKeyboard,
 o: userKeyboard,
 phoneNumberLeads,
 aO: adminKeyboard,
 chooseSubscription,
 buyLeadsSelectArea,
 buyLeadsSelectCnam,
 buyLeadsSelectAmount,
 buyLeadsSelectFormat,
 buyLeadsSelectCountry,
 buyLeadsSelectCarrier,
 buyLeadsSelectSmsVoice,
 buyLeadsSelectAreaCode,
 _buyLeadsSelectAreaCode,
 validatorSelectCountry,
 validatorSelectSmsVoice,
 validatorSelectCarrier,
 validatorSelectCnam,
 validatorSelectAmount,
 validatorSelectFormat,
 redSelectRandomCustom,
 redSelectProvider,
 supportedCrypto,
 supportedCryptoView,
 supportedCryptoViewOf,
 languageMenu,
 supportedLanguages,
 l,
 termsAndConditionType,
 planOptionsOf,
 hP: hostingPlansText,
 selectFormatOf,
 vs,
 vp,
 vpsPlanOf,
 vpsCpanelOptional,
}

module.exports = {
 en,
}
s = {
 en,
}
