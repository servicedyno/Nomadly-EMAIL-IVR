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
}
const user = {
  // main keyboards
  cPanelWebHostingPlans: 'Russia HostPanel Hosting Plans 🔒',
  pleskWebHostingPlans: 'Russia Plesk Hosting Plans 🔒',
  joinChannel: '📢 Join Channel',
  buyLeads: '🎯 Buy Phone Leads',
  validateLeads: '✅ Validate Numbers',
  phoneNumberLeads: '🎯 Buy Phone Leads',
  leadsValidation: '🎯 Leads & Validation',
  hostingDomainsRedirect: '🛡️🔥 Anti-Red Hosting',
  wallet: '👛 Wallet',
  urlShortenerMain: '🔗 URL Shortener',
  vpsPlans: 'Buy Bulletproof VPS🛡️ - Hourly/Monthly',
  buyPlan: '⚡ Upgrade Plan',
  domainNames: '🌐 Bulletproof Domains',
  viewPlan: '📋 My Plans',
  becomeReseller: '💼 Reseller',
  getSupport: '💬 Support',
  freeTrialAvailable: '📧🆓 BulkSMS -Trial',
  changeSetting: '🌍 Settings',
  changeLanguage: '🌍 Change Language',
  cloudPhone: '📞 Cloud IVR + SIP',
  testSip: '🧪 Test SIP Free',
  digitalProducts: '🛒 Digital Products',
  marketplace: '🏪 Marketplace',
  shippingLabel: '📦 Shipping Label',

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

  // wallet
  usd: 'USD',
  ngn: 'NGN',
}
const view = num => Number(num).toFixed(2)
const yesNo = ['Yes', 'No']

const bal = (usd, ngn) =>
  HIDE_BANK_PAYMENT !== 'true'
    ? `$${view(usd)}
₦${view(ngn)}`
    : `$${view(usd)}`

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
  resetLoginAdmit: `${CHAT_BOT_BRAND} SMS: You have been successfully logged out of your previous device.Please login now`,
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
  trialAlreadyUsed: `You have already utilized your free trial. If you need more access, please consider subscribing to one of our paid plans.`,
  oneHourLeftToExpireTrialPlan: `Your Freedom Plan will expire in 1 hour. If you’d like to continue using our services, consider upgrading to a paid plan!`,
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
  trialPlanActivationConfirmation: `Thank you! Your free trial plan will be activated shortly. Please note, this plan will be active for 12 hours only.`,
  trialPlanActivationInProgress: `Your free trial plan is being activated. This may take a few moments…`,

  what: `That option isn't available right now. Please pick from the buttons below.`,
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
  askValidAmount: 'Please enter a valid amount.',
  askValidEmail: 'Please provide a valid email',
  askValidCrypto: 'Please choose a valid crypto currency',
  askValidPayOption: 'Please choose a valid payment option',
  chooseSubscription:
    HIDE_SMS_APP === 'true'
      ? `<b>Choose Your Plan</b>

<b>Daily</b> — $${PRICE_DAILY}
${DAILY_PLAN_FREE_DOMAINS} domain · ${DAILY_PLAN_FREE_VALIDATIONS.toLocaleString()} validations with phone owner names · Unlimited links

<b>Weekly</b> — $${PRICE_WEEKLY}
${WEEKLY_PLAN_FREE_DOMAINS} domains · ${WEEKLY_PLAN_FREE_VALIDATIONS.toLocaleString()} validations with phone owner names · Unlimited links

<b>Monthly</b> — $${PRICE_MONTHLY}
${MONTHLY_PLAN_FREE_DOMAINS} domains · ${MONTHLY_PLAN_FREE_VALIDATIONS.toLocaleString()} validations with phone owner names · Unlimited links

<i>All plans include free .sbs/.xyz domains + unlimited URL shortening + phone owner names on all USA validations.</i>`
      : `<b>Choose Your Plan</b>

<b>Daily</b> — $${PRICE_DAILY}
${DAILY_PLAN_FREE_DOMAINS} domain · ${DAILY_PLAN_FREE_VALIDATIONS.toLocaleString()} validations with phone owner names · Unlimited links + BulkSMS

<b>Weekly</b> — $${PRICE_WEEKLY}
${WEEKLY_PLAN_FREE_DOMAINS} domains · ${WEEKLY_PLAN_FREE_VALIDATIONS.toLocaleString()} validations with phone owner names · Unlimited links + BulkSMS

<b>Monthly</b> — $${PRICE_MONTHLY}
${MONTHLY_PLAN_FREE_DOMAINS} domains · ${MONTHLY_PLAN_FREE_VALIDATIONS.toLocaleString()} validations with phone owner names · Unlimited links + BulkSMS

<i>All plans include free .sbs/.xyz domains + unlimited URL shortening + phone owner names on all USA validations.</i>`,

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

  freeTrialAvailable: `Your BulkSMS free trial is now enabled. Please download the ${SMS_APP_NAME} Android App here: ${SMS_APP_LINK}. Need E-sim cards? Tap 💬 Get Support`,

  freeTrialNotAvailable: 'You have already used the free trial',

  planSubscribed:
    HIDE_SMS_APP === 'true'
      ? `You have successfully subscribed to our {{plan}} plan! Enjoy free ".sbs/.xyz" domains, unlimited Shortit links, and free USA phone number validations with phone owner names included. Need E-sim card? Tap 💬 Get Support`
      : `You have successfully subscribed to our {{plan}} plan! Enjoy free ".sbs/.xyz" domains, unlimited Shortit links, free USA phone validations with phone owner names included, and ${SMS_APP_NAME}. Please download the app here: ${SMS_APP_LINK}. Need E-sim card? Tap 💬 Get Support`,

  alreadySubscribedPlan: days => `Your subscription is active and expires in ${days}`,

  payError: `Payment session not found, please try again or tap 💬 Get Support. Discover more ${TG_HANDLE}.`,

  chooseFreeDomainText: `<b>Great News!</b> This domain is available for free with your subscription. Would you like to claim it?`,

  chooseDomainToBuy: text =>
    `<b>Claim Your Corner of the Web!</b>  Please share the domain name you wish to purchase, like "abcpay.com".${text}`,
  askDomainToUseWithShortener: `Use this domain as a <b>custom URL shortener</b>?\n\n<b>Yes</b> — Auto-configure DNS. Short links become <code>yourdomain.com/abc</code>.\n\n<b>No</b> — Register only. Enable shortener anytime from Manage Domains.`,
  blockUser: `Please share the username of the user that needs to be blocked.`,
  unblockUser: `Please share the username of the user that needs to be unblocked.`,
  blockedUser: `You are currently blocked from using the bot. Please tap 💬 Get Support. Discover more ${TG_HANDLE}.`,

  greet: `${CHAT_BOT_BRAND} — shorten URLs, register domains, buy phone leads, and grow your business. All from Telegram.

Get started with ${FREE_LINKS} trial Shortit links — /start
Support: Tap 💬 Get Support`,

  linkExpired: `This short link has expired and is no longer active. Please contact us for any queries.
Best,
${CHAT_BOT_BRAND} Team
Discover more: ${TG_CHANNEL}`,

  successPayment: `Payment Processed Successfully! You can now close this window.`,

  welcome: `Thank you for choosing ${CHAT_BOT_NAME}! Please choose an option below:`,
  welcomeFreeTrial: `Welcome to ${CHAT_BOT_BRAND}! You have ${FREE_LINKS} trial Shortit links to shorten URLs. Subscribe for unlimited Shortit links, free ".sbs/.xyz" domains and free USA phone validations with phone owner names. Experience the ${CHAT_BOT_BRAND} difference!`,

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

    // NS section — special display with slot labels, no action index
    const nsRecs = records['NS']
    if (nsRecs && nsRecs.length) {
      const provider = nameserverType === 'cloudflare' ? 'Cloudflare' : 'Registrar'
      msg += `\n<b>NAMESERVERS</b> <i>(${provider})</i>\n`
      for (let i = 0; i < nsRecs.length; i++) {
        msg += `  NS${i + 1}: <code>${nsRecs[i].recordContent || '—'}</code>\n`
      }
      msg += `<i>Use "Update DNS Record" to change.</i>\n`
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
  digitalProductsSelect: `🛒 <b>Digital Products</b>\n\nVerified accounts delivered <b>quickly</b> via this bot.\n\n<b>Telecom</b> — Twilio, Telnyx (SMS, Voice, SIP)\n<b>Cloud</b> — AWS, Google Cloud (Full access)\n<b>Email</b> — Google Workspace, Zoho Mail\n<b>Mobile</b> — eSIM T-Mobile\n\nPay with crypto, bank, or wallet. Select below:`,
  dpTwilioMain: `📞 Twilio Main Account — $${DP_PRICE_TWILIO_MAIN}`,
  dpTwilioSub: `📞 Twilio Sub-Account — $${DP_PRICE_TWILIO_SUB}`,
  dpTelnyxMain: `📡 Telnyx Main Account — $${DP_PRICE_TELNYX_MAIN}`,
  dpTelnyxSub: `📡 Telnyx Sub-Account — $${DP_PRICE_TELNYX_SUB}`,
  dpGworkspaceNew: `📧 Google Workspace (New Domain) — $${DP_PRICE_GWORKSPACE_NEW}`,
  dpGworkspaceAged: `📧 Google Workspace (Aged Domain) — $${DP_PRICE_GWORKSPACE_AGED}`,
  dpEsim: `📱 eSIM T-Mobile — $${DP_PRICE_ESIM}`,
  dpZohoNew: `📧 Zoho Mail (New Domain) — $${DP_PRICE_ZOHO_NEW}`,
  dpZohoAged: `📧 Zoho Mail (Aged Domain) — $${DP_PRICE_ZOHO_AGED}`,
  dpAwsMain: `☁️ AWS Main Account — $${DP_PRICE_AWS_MAIN}`,
  dpAwsSub: `☁️ AWS Sub-Account — $${DP_PRICE_AWS_SUB}`,
  dpGcloudMain: `🌐 Google Cloud Main — $${DP_PRICE_GCLOUD_MAIN}`,
  dpGcloudSub: `🌐 Google Cloud Sub — $${DP_PRICE_GCLOUD_SUB}`,
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
      'eSIM T-Mobile': 'T-Mobile eSIM with active data plan. No physical SIM needed — activate instantly on any eSIM-compatible device.\n\nYou receive: QR code or activation details.',
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
    if (!found) return `  ${type}: —`
    const vals = answers.slice(0, 2).join(', ')
    const more = answers.length > 2 ? ` +${answers.length - 2} more` : ''
    return `  ${type}: ${count} record${count > 1 ? 's' : ''} (${vals}${more})`
  },
  dnsHealthSummary: (resolving, total) => `\n${resolving}/${total} record types resolving.`,
  dnsCheckError: 'DNS lookup failed. Please try again later.',

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
      msg += `  NS${i + 1}: <code>${nsRecords[i].recordContent || '—'}</code>${marker}\n`
    }
    msg += `\nEnter the new nameserver for <b>NS${slotIndex}</b>:\ne.g. <b>ns1.cloudflare.com</b>`
    return msg
  },

  provideLink: 'Please provide a valid URL. e.g https://google.com',

  comingSoonWithdraw: `Withdrawals are not available yet. Need help? Tap 💬 Get Support.`,
  promoOptOut: `You have been unsubscribed from promotional messages. Type /start_promos to re-subscribe anytime.`,
  promoOptIn: `You have been re-subscribed to promotional messages. You will receive our latest offers and deals!`,

  selectCurrencyToDeposit: `Please select currency to deposit`,

  depositNGN: `Please enter NGN Amount:`,
  askEmailForNGN: `Please provide an email for payment confirmation`,

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

  showWallet: (usd, ngn) => `Wallet Balance:

${bal(usd, ngn)}`,

  wallet: (usd, ngn) => `Wallet Balance:

${bal(usd, ngn)}

Select wallet option:`,

  walletSelectCurrency: (usd, ngn) => `Please select currency to pay from your Wallet Balance:

${bal(usd, ngn)}`,

  walletBalanceLow: `Your wallet balance is too low. Tap Deposit below to top up, then your purchase will resume automatically.`,

  walletBalanceLowAmount: (needed, balance) => 
    `Your wallet balance ($${balance.toFixed(2)}) is too low for this purchase.\n\nYou need <b>$${(needed - balance).toFixed(2)} more</b>. Tap Deposit below to top up.`,

  sentLessMoney: (expected, got) =>
    `You sent less money than expected so we credited amount received into your wallet. We expected ${expected} but received ${got}`,
  sentMoreMoney: (expected, got) =>
    `You sent more money than expected so we credited the extra amount into your wallet. We expected ${expected} but received ${got}`,

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

  confirmNgn: (usd, ngn) => `${usd} USD ≈ ${ngn} NGN `,
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
    ` Remember, your ${plan} plan includes ${available} free ".sbs/.xyz" domain${s}. Let's get your domain today!`,
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
  scanQrOrUseChat: chatId => `Scan QR with sms marketing app to login. You can also use this code to login: ${chatId}`,
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

  // ── Marketplace ──
  mpHome: '🏪 <b>NOMADLY MARKETPLACE</b>\n\n💰 <b>Sell your digital goods</b> — list in 60 seconds, get paid instantly\n🛍️ <b>Find exclusive deals</b> — verified sellers, real transactions\n\n🔒 Every purchase is <b>escrow-protected</b> via @Lockbaybot\nYour money stays safe until you confirm delivery.\n\n👇 Ready to earn or shop?',
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
  mpProductPublished: '🎉 Your listing is LIVE!\n\nBuyers can now discover it in the marketplace.\n\n💡 <b>Tips to sell faster:</b>\n• Respond to inquiries within minutes\n• Add clear photos & detailed descriptions\n• Price competitively\n\n💰 You get paid instantly when buyers confirm delivery.',
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
    `💬 You're chatting with the seller about <b>${title}</b> ($${price})\n🔒 Escrow-protected via @Lockbaybot\n\n💡 Tip: Ask for details, samples, or proof before purchasing.\nType /escrow when ready to pay safely.\nSend /done to end chat.`,
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
  mpPaymentWarning: '🚨 Warning: It looks like someone is asking for direct payment.\nAlways use @Lockbaybot escrow to protect your money.',
  mpEscrowMsg: (title, price, sellerRef) =>
    `🔒 <b>ESCROW — START YOUR PROTECTED PURCHASE</b>\n\n📦 Product: <b>${title}</b>\n💰 Agreed Price: <b>$${Number(price).toFixed(2)}</b>\n👤 Seller: <b>${sellerRef}</b>\n\nTo complete this purchase safely:\n1. Tap the button below to open @Lockbaybot\n2. Create a new escrow with seller <b>${sellerRef}</b> for <b>$${Number(price).toFixed(2)}</b>\n3. Both parties confirm in @Lockbaybot\n\n⚠️ NEVER send payment outside of escrow`,
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
    `🏷️ <b>${title}</b>\n💰 <b>$${Number(price).toFixed(2)}</b>  ·  ${category}\n${sellerStats}\n🔒 Buy with confidence — Escrow Protected`,
  mpProductDetail: (title, desc, price, category, sellerStats, listedAgo) =>
    `📦 <b>${title}</b>\n\n📄 ${desc}\n\n💰 Price: <b>$${Number(price).toFixed(2)}</b>\n📂 ${category}\n${sellerStats}\n📅 Listed: ${listedAgo}\n\n🔒 <b>100% BUYER PROTECTION</b>\nPay safely via @Lockbaybot escrow — your money is held until you confirm delivery.`,
  mpMyListingsHeader: (count, max) => `📦 <b>MY LISTINGS</b> (${count}/${max})`,
  mpConvHeader: '💬 <b>MY CONVERSATIONS</b>',
  mpConvItem: (title, role, lastMsg) => `💬 <b>${title}</b> (${role}) — ${lastMsg}`,
  mpDoneCmd: '/done',
  mpEscrowCmd: '/escrow',
  mpPriceCmd: '/price',
  mpReportCmd: '/report',
  mpEnteredChat: (title, price) => `💬 You entered chat for <b>${title}</b> ($${price})\nSend /done to exit, /escrow to start escrow, /price XX to suggest price.`,
  mpResumedChat: (title, price, role) => `💬 Resumed chat: <b>${title}</b> ($${price}) — You are the ${role}\n🔒 Escrow-protected via @Lockbaybot\n\nSend /done to exit, /escrow to start escrow, /price XX to suggest price.`,
  mpBuyerPhotoCaption: '💬 Buyer sent a photo:',
  mpSellerPhotoCaption: '💬 Seller sent a photo:',
  mpChatClosedReset: (title) => `💬 The conversation about <b>${title}</b> was closed by the other party. You have been returned to the marketplace.`,
  mpSellerBusy: (title) => `🆕 New inquiry for <b>${title}</b>! Tap the button below to reply when you\'re ready.`,
  mpCatDigitalGoods: '💻 Digital Goods',
  mpCatBnkLogs: '🏦 Bnk Logs',
  mpCatBnkOpening: '🏧 Bnk Opening',
  mpCatTools: '🔧 Tools',
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
const payOpts = HIDE_BANK_PAYMENT !== 'true' ? k.of([u.usd, u.ngn]) : k.of([u.usd])

const adminKeyboard = {
  reply_markup: {
    keyboard: Object.values(admin).map(b => [b]),
  },
}

const userKeyboard = {
  reply_markup: {
    keyboard: [
      [user.cloudPhone],
      [user.marketplace, user.digitalProducts],
      [user.shippingLabel, user.virtualCard],
      [user.domainNames, user.hostingDomainsRedirect],
      [user.urlShortenerMain, user.leadsValidation],
      ...(HIDE_SMS_APP === 'true' ? [] : [[user.freeTrialAvailable]]),
      [user.wallet, user.viewPlan],
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

const vp = {
  of: vpsOptionsOf,
  back: '🔙 Back',
  skip: '❌ Skip',
  cancel: '❌ Cancel',

  //region selection
  askCountryForUser: `🌍 Choose the best region for optimal performance and low latency.

💡 Lower latency = Faster response times. Choose a region closest to your users for the best performance.`,
  chooseValidCountry: 'Please choose country from the list:',
  askRegionForUser: country => `📍 Select a data center within ${country} (Pricing may vary by location.)`,
  chooseValidRegion: 'Please choose valid region from the list:',
  askZoneForUser: region => `📍 Choose the zone within ${region}.`,
  chooseValidZone: 'Please choose valid zone from the list:',
  confirmZone: (region, zone) => `✅  You’ve selected the ${region} (${zone}) Do you want to proceed with this choice?`,
  failedFetchingData: 'Error fetching, Please try again after some time.',
  confirmBtn: `✅ Confirm Selection`,

  // disk type
  askVpsDiskType: list => `💾 Choose your storage type based on performance and budget:

${list?.map(item => `• ${item.description}`).join('\n')}`,

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
  hourlyBillingMessage: `⚠️ A $${VPS_HOURLY_PLAN_MINIMUM_AMOUNT_PAYABLE} USD refundable deposit is required for hourly billing. This ensures uninterrupted service and is refunded if unused.
  
✅ Billing is deducted from your wallet balance every hour.
🔹 Monthly licenses (Windows/WHM/Plesk) are billed upfront.`,

  // configs
  askVpsConfig: list => `⚙️ Pick a VPS plan based on your needs (Hourly or Monthly billing available):
  
${list
  .map(
    config =>
      `<strong>• ${config.name} -</strong> ${config.specs.vCPU} vCPU, ${config.specs.RAM}GB RAM, ${config.specs.disk}GB Disk`,
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
  askVpsOS: price => `💡 Default OS: Ubuntu (Linux) (if no selection is made).
💻 Select an OS (Windows Server adds $${price}/month).

<strong>💡 Recommended: </strong>
<strong>• Ubuntu –</strong> Best for general use and development
<strong>• CentOS –</strong> Stable for enterprise applications
<strong>• Windows Server –</strong> For Windows-based applications (+$${price}/month)`,
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

  generateBillSummary: vpsDetails => `<strong>📋 Final Cost Breakdown:</strong>

<strong>•📅 Disk Type –</strong> ${vpsDetails.diskType}
<strong>•🖥️ VPS Plan:</strong> ${vpsDetails.config.name}
<strong>•📅 Billing Cycle (${vpsDetails.plan} Plan) –</strong> $${vpsDetails.plantotalPrice} USD
<strong>•💻 OS License (${vpsDetails.os ? vpsDetails.os.name : 'Not Selected'}) –</strong> $${
    vpsDetails.selectedOSPrice
  } USD
<strong>•🛠️ Control Panel (${
    vpsDetails.panel
      ? `${vpsDetails.panel.name == 'whm' ? 'WHM' : 'Plesk'} ${vpsDetails.panel.licenseName}`
      : 'Not Selected'
  }) –</strong> $${vpsDetails.selectedCpanelPrice} USD
<strong>•🎟️ Coupon Discount –</strong> -$${vpsDetails.couponDiscount} USD
<strong>•🔄 Auto-Renewal –</strong>  ${
    vpsDetails.plan === 'Hourly' ? '⏳ Hourly' : vpsDetails.autoRenewalPlan ? '✅ Enabled' : '❌ Disabled'
  }

${
  vpsDetails.plan === 'Hourly'
    ? `Note: A $${VPS_HOURLY_PLAN_MINIMUM_AMOUNT_PAYABLE} USD deposit is included in your total. After the first hourly rate is deducted, the remaining deposit will be credited to your wallet.`
    : ''
}

<strong>💰 Total:</strong> $${
    vpsDetails.plan === 'Hourly' && vpsDetails.totalPrice < VPS_HOURLY_PLAN_MINIMUM_AMOUNT_PAYABLE
      ? VPS_HOURLY_PLAN_MINIMUM_AMOUNT_PAYABLE
      : vpsDetails.totalPrice
  } USD

<strong>✅ Proceed with the order?</strong>`,

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
  paymentRecieved: `✅ Payment successful! Your VPS is being set up. Details will be available shortly and sent to your email for your convenience.`,
  paymentFailed: `❌ Payment failed. Please check your payment method or try again.`,

  lowWalletBalance: vpsName => `
Your VPS Plan for instance ${vpsName} has been stopped due to low balance.

Please top up your wallet to continue using your VPS Plan.
`,

  vpsBoughtSuccess: (vpsDetails, response, credentials) =>
    `<strong>🎉 VPS [${response.label}] is active!</strong>

<strong>🔑 Login Credentials:</strong>
  <strong>• IP:</strong> ${response.host}
  <strong>• OS:</strong> ${vpsDetails.os ? vpsDetails.os.name : 'Not Selected'}
  <strong>• Username:</strong> ${credentials.username}
  <strong>• Password:</strong> ${credentials.password} (change immediately).

📧 These details have also been sent to your registered email. Please keep them secure.

⚙️ Control Panel Installation (WHM/Plesk)
If you ordered WHM or Plesk, installation is in progress. Your control panel login details will be sent separately once setup is complete.

Thank you for choosing our service
${CHAT_BOT_NAME}
`,
  vpsHourlyPlanRenewed: (vpsName, price) => `
Your VPS Plan for instance ${vpsName} has been renewed successfully.
${price}$ has been deducted from your wallet.`,

  bankPayVPS: (
    priceNGN,
    plan,
  ) => `Please remit ${priceNGN} NGN by clicking “Make Payment” below. Once the transaction has been confirmed, you will be promptly notified, and your  ${plan} VPS plan will be seamlessly activated.

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
        •       No refund for unused subscription time.
        •       Auto-renewal will be canceled, and no further charges will apply.

Do you want to proceed?`,
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

<strong>• VPS ${vpsData.name} </strong>– Expires: ${planExpireDate}  (Auto-Renew: ${
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
  vp,
  vpsPlanOf,
  vpsCpanelOptional,
}

module.exports = {
  en,
}
