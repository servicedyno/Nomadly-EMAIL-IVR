const { areasOfCountry, carriersOf, countryCodeOf } = require('../areasOfCountry')

const format = (cc, n) => `+${cc}(${n.toString().padStart(2, '0')})`

/* global process */
require('dotenv').config()
const HIDE_BANK_PAYMENT = process.env.HIDE_BANK_PAYMENT
const SELF_URL = process.env.SELF_URL
const FREE_LINKS = Number(process.env.FREE_LINKS)
const SUPPORT_USERNAME = process.env.SUPPORT_USERNAME

// Digital Product Prices (from .env)
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
const APP_SUPPORT_LINK = process.env.APP_SUPPORT_LINK

const PREMIUM_ANTIRED_WEEKLY_PRICE = parseFloat(process.env.PREMIUM_ANTIRED_WEEKLY_PRICE)
const PREMIUM_ANTIRED_CPANEL_PRICE = parseFloat(process.env.PREMIUM_ANTIRED_CPANEL_PRICE)
const GOLDEN_ANTIRED_CPANEL_PRICE = parseFloat(process.env.GOLDEN_ANTIRED_CPANEL_PRICE)
const VPS_HOURLY_PLAN_MINIMUM_AMOUNT_PAYABLE = parseFloat(process.env.VPS_HOURLY_PLAN_MINIMUM_AMOUNT_PAYABLE) || 50

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
 viewAnalytics: '📊 查看分析',
 viewUsers: '👀 查看用户',
 blockUser: '✋ 阻止用户',
 unblockUser: '👌 解除阻止用户',
 messageUsers: '👋 向所有用户发送消息',
 resetDead: '🗑️ Reset Dead Users',
 gift5all: '🎁 Gift $5 All Users',
}
const user = {
 // main keyboards
 cPanelWebHostingPlans: '俄罗斯 HostPanel 托管计划 🔒',
 pleskWebHostingPlans: '俄罗斯 Plesk 托管计划 🔒',
 joinChannel: '📢 加入频道',
 phoneNumberLeads: '🎯 购买线索 | 验证您的号码',
 buyLeads: '🎯 购买线索',
 validateLeads: '✅ 验证号码',
 leadsValidation: '📱 SMS Leads',
 hostingDomainsRedirect: '🛡️🔥 Anti-Red 托管',
 wallet: '👛 钱包',
 urlShortenerMain: '🔗 URL 缩短器',
 domainNames: '🌐 防弹域名',
 viewPlan: '📋 我的计划',
 becomeReseller: '💼 经销商',
 getSupport: '💬 支持',
 cloudPhone: '📞 Cloud IVR + SIP',
 testSip: '🧪 免费测试 SIP',
 vpsPlans: '🖥️ VPS/RDP — 端口25开放🛡️',
 buyPlan: '⚡ 升级计划',
 freeTrialAvailable: '📧🆓 BulkSMS - 免费试用',
 smsAppMain: '📧 BulkSMS',
 smsCreateCampaign: '📱 创建活动',
 smsMyCampaigns: '📋 我的活动',
 smsDownloadApp: '📲 下载应用',
 smsResetLogin: '🔓 重置登录',
 smsHowItWorks: '❓ 使用说明',
 changeSetting: '🌍 设置',
 changeLanguage: '🌍 更改语言',

 // Sub Menu 1: urlShortenerMain
 redSelectUrl: '🔀✂️ 重定向并缩短',
 redBitly: '✂️ Bit.ly',
 redShortit: '✂️ Shortit (试用)',
 urlShortener: '✂️🌐 自定义域名缩短器',
 viewShortLinks: '📊 查看短链接分析',
 activateDomainShortener: '🔗 激活域名用于短链接',

 // Sub Menu 6: Digital Products
 digitalProducts: '🛒 数字产品',
 marketplace: '🏪 市场',
 shippingLabel: '📦 Ship & Mail',
 emailBlast: '📧 群发邮件',
 emailValidation: '📧 邮箱验证',
 serviceBundles: '🎁 服务套餐',
 referEarn: '🤝 推荐赚钱',
 virtualCard: '💳 虚拟卡',

 // Sub Menu 2: domainNames
 buyDomainName: '🛒🌐 购买域名',
 viewDomainNames: '📂 我的域名',
 dnsManagement: '🔧 DNS 管理',

 // Sub Menu 3: cPanel/Plesk WebHostingPlansMain
 freeTrial: '💡 免费试用',
 premiumWeekly: '⚡ Premium Anti-Red (1周)',
 premiumCpanel: '🔷 Premium Anti-Red HostPanel (30 Days)',
 goldenCpanel: '👑 Golden Anti-Red HostPanel (30 Days)',
 contactSupport: '📞 联系支持',

 // Sub Menu 4: VPS Plans
 buyVpsPlan: '⚙️ 创建新的VPS',
 manageVpsPlan: '🖥️ 查看/管理VPS',
 manageVpsSSH: '🔑 SSH密钥',

 // Free Trial
 freeTrialMenuButton: '🚀 免费试用（12小时）',
 getFreeTrialPlanNow: '🛒 立即获取试用计划',
 continueWithDomainNameSBS: websiteName => `➡️ 继续使用 ${websiteName}`,
 searchAnotherDomain: '🔍 搜索其他域名',
 privHostNS: '🏢 PrivHost（快速安全的主机）',
 cloudflareNS: '🛡️ Cloudflare 防护（安全和隐私）',
 backToFreeTrial: '⬅️ 返回免费试用',

 // Paid Plans
 buyPremiumWeekly: '🛒 🛒 购买初级计划',
 buyPremiumCpanel: '🛒 🛒 购买专业计划',
 buyGoldenCpanel: '🛒 🛒 购买商业计划',
 viewPremiumWeekly: '🔷 查看初级计划',
 viewPremiumCpanel: '🔼 查看专业计划',
 viewGoldenCpanel: '👑 查看商业计划',
 backToHostingPlans: '⬅️ 返回主机计划',
 registerANewDomain: '🌐 注册新域名',
 useMyDomain: '📂 使用我的域名',
 connectExternalDomain: '🔗 连接外部域名',
 useExistingDomain: '🔄 使用现有域名',
 backToPremiumWeeklyDetails: '⬅️ 返回初级计划详情',
 backToPremiumCpanelDetails: '⬅️ 返回专业计划详情',
 backToGoldenCpanelDetails: '⬅️ 返回商业计划详情',
 continueWithDomain: websiteName => `➡️ 继续使用 ${websiteName}`,
 enterAnotherDomain: '🔍 输入另一个域名',
 backToPurchaseOptions: '⬅️ 返回购买选项',
 myHostingPlans: '📋 我的托管计划',
 revealCredentials: '🔑 显示凭证',
 renewHostingPlan: '🔄 续费计划',
 upgradeHostingPlan: '⬆️ 升级计划',
 backToMyHostingPlans: '⬅️ 返回我的计划',
 buyLeads: '🎯 购买电话线索',
 validateLeads: '✅ 验证号码',
 shortenLink: '✂️ 缩短链接',
 confirmRenewNow: '✅ 确认并支付',
 cancelRenewNow: '❌ 取消',
 toggleAutoRenew: '🔁 切换自动续费',
}

const u = {
 // other key boards
 deposit: '➕💵 存款',
 withdraw: '➖💵 撤回',
 myTier: '🏆 我的等级',
 txHistory: '📜 交易记录',

 // wallet
 usd: '美元',
 ngn: 'NGN',

 // deposit methods
 depositBank: '🏦 Bank (Naira)',
 depositCrypto: '₿ Crypto',
}
const view = num => Number(num).toFixed(2)
const yesNo = ['是', '否']

const bal = (usd) => `$${view(usd)}`

const dnsEntryFormat = '' // deprecated — A/CNAME now use multi-step wizard

const t = {
 yes: '是',
 no: '否',
 back: '返回',
 cancel: '取消',
 skip: '跳过',
 becomeReseller: (() => {
 const services = ['URL缩短', '域名注册']
 if (process.env.PHONE_SERVICE_ON === 'true') services.push('Cloud IVR')
 if (HIDE_SMS_APP !== 'true') services.push('群发短信')
 if (process.env.OFFSHORE_HOSTING_ON !== 'false') services.push('离岸托管')
 return `<b>成为${CHAT_BOT_BRAND}经销商</b>

以您自己的品牌转售我们的全套服务 — ${services.join('、')}。

每笔销售<b>65/35%</b>利润分成。点击 💬 <b>获取支持</b> 开始合作。`
 })(),
 resetLoginAdmit: `${CHAT_BOT_BRAND} SMS: 您已成功退出您之前的设备。请立即登录。`,
 resetLoginDeny: '好的，不需要进一步操作。',
 resetLogin: `${CHAT_BOT_BRAND} SMS: 您是否试图从之前的设备上注销？`,
 select: `请选择一个选项：`,
 urlShortenerSelect: `缩短、品牌化或追踪您的链接：`,

 // cPanel/Plesk Plans initial select plan text
 selectPlan: `请选择一个计划：`,
 backButton: '⬅️ 返回',
 skipEmail: '跳过（无电子邮件）',
 yesProceedWithThisEmail: email => `➡️ 使用 ${email} 继续`,
 proceedWithPayment: '➡️ 继续付款',
 iHaveSentThePayment: `我已发送付款 ✅`,
 trialAlreadyUsed: `您已经使用了您的免费试用。如果您需要更多的访问权限，请考虑订阅我们的付费计划之一。`,
 oneHourLeftToExpireTrialPlan: `您的 Freedom 计划将在 1 小时后到期。如果您想继续使用我们的服务，请考虑升级到付费计划！`,
 freePlanExpired: `🚫 您的 Freedom 计划已过期。希望您享受了试用期！要继续使用我们的服务，请购买我们的高级计划之一。`,
 freeTrialPlanSelected: hostingType => `
- 免费试用我们的 <b>Freedom 计划</b>！此计划包括一个以 .sbs 结尾的免费域名，有效期为 12 小时。

🚀 <b>Freedom 计划：</b>
<b>- 存储：</b> 1 GB SSD
<b>- 带宽：</b> 10 GB
<b>- 域名：</b> 1 个免费的 .sbs 域名
<b>- 邮箱账户：</b> 1 个邮箱账户
<b>- 数据库：</b> 1 个 MySQL 数据库
<b>- 免费 SSL：</b> 是
<b>- HostPanel 功能：</b> 完全访问 HostPanel，用于管理文件、数据库和邮箱等。
<b>- 时长：</b> 有效期 12 小时
<b>- 适合：</b> 测试和短期项目。
 `,
 getFreeTrialPlan: `请输入您想要的域名（例如：example.sbs）并将其作为消息发送。此域名以 .sbs 结尾，并且在您的试用计划中免费提供。`,
 trialPlanContinueWithDomainNameSBSMatched: websiteName => `域名 ${websiteName} 可用！`,
 trialPlanSBSDomainNotMatched: `您输入的域名未找到。请确保域名正确或尝试使用其他域名。`,
 trialPlanSBSDomainIsPremium: `此域名为高级价格，仅适用于付费计划。请搜索其他域名。`,
 trialPlanGetNowInvalidDomain: `请输入有效的域名，必须以 '.sbs' 结尾。域名应类似于 'example.sbs'，并且在您的试用计划中免费提供。`,
 trialPlanNameserverSelection: websiteName => `请选择您希望为 ${websiteName} 使用的名称服务器提供商。`,
 trialPlanDomainNameMatched: `请提供您的电子邮件地址以创建您的账户并发送您的收据。`,
 confirmEmailBeforeProceedingSBS: email => `您确定要使用此电子邮件 ${email} 订阅 Freedom 计划吗？`,
 trialPlanInValidEmail: `请输入有效的电子邮件。`,
 trialPlanActivationConfirmation: `谢谢！您的免费试用计划将很快激活。请注意，此计划仅在 12 小时内有效。`,
 trialPlanActivationInProgress: `您的免费试用计划正在激活。这可能需要一些时间……`,

 what: `该选项目前不可用。请从下方按钮中选择。`,
 whatNum: `请选择一个有效的数字。`,
 phoneGenTimeout: `超时。`,
 phoneGenNoGoodHits: `请点击 💬 获取支持 或选择其他区号。`,

 subscribeRCS: p => `已订阅！随时通过点击<a href="${SELF_URL}/unsubscribe?a=b&Phone=${p}">链接</a>取消订阅。`,
 unsubscribeRCS: p => `您已取消订阅！要重新订阅，请点击<a href="${SELF_URL}/subscribe?a=b&Phone=${p}">链接</a>。`,
 argsErr: `开发：发送了错误的参数。`,
 showDepositNgnInfo:
 ngn => `请通过点击下方的“付款”按钮汇款 ${ngn} NGN。一旦交易确认，您将立即收到通知，并且您的钱包将更新。

此致, 
${CHAT_BOT_NAME}`,
 askEmail: `请提供用于支付确认的电子邮件。`,
 askValidAmount: '请提供一个有效的数字。',
 askValidEmail: '请提供一个有效的电子邮件。',
 askValidCrypto: '请选择一种有效的加密货币。',
 askValidPayOption: '请选择一个有效的支付选项。',
 chooseSubscription:
 HIDE_SMS_APP === 'true'
 ? `<b>选择您的计划</b>

✅ <b>所有计划包含：</b>
🔗 无限URL缩短
🌐 免费 
📱 号码验证含机主姓名
📞 Cloud IVR 访问

<b>每日</b> — $${PRICE_DAILY}
${DAILY_PLAN_FREE_DOMAINS} 个域名 · ${DAILY_PLAN_FREE_VALIDATIONS.toLocaleString()} 次验证含机主姓名 · 无限链接

<b>每周</b> — $${PRICE_WEEKLY}
${WEEKLY_PLAN_FREE_DOMAINS} 个域名 · ${WEEKLY_PLAN_FREE_VALIDATIONS.toLocaleString()} 次验证含机主姓名 · 无限链接

<b>每月</b> — $${PRICE_MONTHLY}
${MONTHLY_PLAN_FREE_DOMAINS} 个域名 · ${MONTHLY_PLAN_FREE_VALIDATIONS.toLocaleString()} 次验证含机主姓名 · 无限链接

<i>所有计划包含免费 + 无限URL缩短 + 所有USA验证包含机主姓名。</i>`
 : `<b>选择您的计划</b>

✅ <b>所有计划包含：</b>
🔗 无限URL缩短
🌐 免费 
📱 号码验证含机主姓名
📧 BulkSMS 群发短信
📞 Cloud IVR 访问

<b>每日</b> — $${PRICE_DAILY}
${DAILY_PLAN_FREE_DOMAINS} 个域名 · ${DAILY_PLAN_FREE_VALIDATIONS.toLocaleString()} 次验证 · 无限链接 + BulkSMS（3台设备）

<b>每周</b> — $${PRICE_WEEKLY}
${WEEKLY_PLAN_FREE_DOMAINS} 个域名 · ${WEEKLY_PLAN_FREE_VALIDATIONS.toLocaleString()} 次验证 · 无限链接 + BulkSMS（10台设备）

<b>每月</b> — $${PRICE_MONTHLY}
${MONTHLY_PLAN_FREE_DOMAINS} 个域名 · ${MONTHLY_PLAN_FREE_VALIDATIONS.toLocaleString()} 次验证 · 无限链接 + BulkSMS（无限设备）

<i>所有计划包含免费 + 无限URL缩短 + 所有USA验证包含机主姓名。</i>`,

 askCoupon: usd => `价格是 $${usd}。您是否想使用优惠券代码？如果有，请立即输入。否则，您可以按“跳过”。`,
 planAskCoupon: `您是否想使用优惠券代码？如果有，请立即输入。否则，您可以按“跳过”。`,
 enterCoupon: `请输入优惠券代码：`,
 planPrice: (plan, price) => `${plan} 订阅的价格是 $${price}。请选择支付方式。`,
 planNewPrice: (plan, price, newPrice) =>
 `${plan} 订阅的价格现在是 $${view(newPrice)} <s>($${price})</s>。请选择支付方式。`,
 domainPrice: (domain, price) => `${domain} 域名的价格是 $${price} USD。请选择支付方式。`,
 domainNewPrice: (domain, price, newPrice) =>
 `${domain} 域名的价格现在是 $${view(newPrice)} <s>($${price})</s>。请选择支付方式。`,
 couponInvalid: `优惠券代码无效，请重新输入：`,
 lowPrice: `提供的价格低于所需金额。`,
 freeTrialAvailable: (chatId) => `📱 <b>BulkSMS 免费试用 — 100条免费短信</b>\n\n您的激活码：\n<code>${chatId}</code>\n\n📲 <b>下载应用：</b> ${SMS_APP_LINK}\n\n打开应用 → 输入激活码 → 开始发送！\n\n⚡ 试用：仅限1台设备。升级可使用多达10台设备。\n\n需要 eSIM 卡？点击 💬 获取支持`,
 freeTrialNotAvailable: `您已使用过免费试用。`,

 smsAppMenuSubscribed: (chatId) => `📧 <b>BulkSMS — 已激活 ✅</b>\n\n通过手机SIM卡发送短信 — 高送达率，真实发送人ID。\n\n📲 <b>应用：</b> ${SMS_APP_LINK}\n🔑 <b>激活码：</b> <code>${chatId}</code>\n\n在下方或应用中创建活动。\n新用户？点击 <b>❓ 使用说明</b>`,
 smsAppMenuTrial: (chatId, remaining) => `📧 <b>BulkSMS — 免费试用</b>（剩余 ${remaining} 条）\n\n通过手机SIM卡发送短信 — 高送达率，真实发送人ID。\n\n📲 <b>应用：</b> ${SMS_APP_LINK}\n🔑 <b>激活码：</b> <code>${chatId}</code>\n\n新用户？点击 <b>❓ 使用说明</b>`,
 smsAppMenuExpired: `📧 <b>BulkSMS</b>\n\n试用已结束。点击 <b>⚡ 升级计划</b> 继续发送。\n\n新用户？点击 <b>❓ 使用说明</b> 了解BulkSMS。`,

 smsHowItWorks: (chatId) => `📧 <b>BulkSMS — 使用说明</b>\n\nBulkSMS通过<b>您手机的SIM卡</b>发送真实短信 — 不是服务器。高送达率和真实发送人ID。\n\n<b>⚙️ 一次性设置：</b>\n1. 下载应用 → ${SMS_APP_LINK}\n2. 打开 → 输入激活码：<code>${chatId}</code>\n3. 允许短信权限\n\n<b>📤 发送活动：</b>\n• 在这里点击 <b>📱 创建活动</b> 或在应用中创建\n• 添加消息 + 联系人（粘贴或上传文件）\n• 活动同步到应用 → 在手机上点击发送\n\n<b>💡 技巧：</b>\n• 使用 <b>eSIM</b> 作为专用发送线路\n• 多行消息 = 自动轮换\n• <code>[name]</code> = 自动个性化\n• 可以定时发送或立即发送\n\n<b>📋 我的活动</b> 查看所有活动状态。\n<b>🔓 重置登录</b> 切换设备。\n\n需要eSIM？点击 💬 支持`,
 smsCreateCampaignIntro: `📱 <b>创建短信活动</b>\n\n操作步骤：\n\n<b>步骤1：</b>为您的活动命名\n<b>步骤2：</b>编写您的消息\n • 使用 <code>[name]</code> 进行个性化\n • 多行 = 消息轮换\n<b>步骤3：</b>上传联系人\n • 粘贴文本：<code>+1234567890, 张三</code>\n • 或上传 .txt / .csv 文件\n<b>步骤4：</b>设置短信间隔时间\n<b>步骤5：</b>检查并确认 — 发送、定时或保存草稿\n\n活动将同步到 Nomadly SMS 应用进行发送。\n\n<b>开始吧 — 输入活动名称：</b>`,
 smsSchedulePrompt: '⏰ <b>定时活动？</b>\n\n选择此活动何时可用：',
 smsSendNow: '▶️ 立即发送',
 smsScheduleLater: '⏰ 稍后定时',
 smsScheduleTimePrompt: '📅 <b>输入日期和时间</b>\n\n格式：<code>YYYY-MM-DD HH:MM</code>\n（UTC时区）\n\n示例：<code>2025-07-15 09:30</code>',
 smsSaveDraft: '💾 保存草稿',
 smsDefaultGap: '⏱ 默认（5秒）',
 smsGapTimePrompt: '⏱ <b>消息间隔时间</b>\n\n每条短信之间等待多少秒？\n\n• 默认：<b>5秒</b>\n• 范围：1–300秒\n\n输入数字或点击默认按钮：',
 smsMyCampaignsEmpty: '📋 <b>我的活动</b>\n\n暂无活动。点击 <b>📱 创建活动</b> 开始！',
 smsMyCampaignsList: (campaigns) => {
 const statusIcons = { draft: '📝', sending: '📤', completed: '✅', paused: '⏸', scheduled: '📅' }
 const lines = campaigns.slice(0, 10).map((c, i) =>
 `${i + 1}. ${statusIcons[c.status] || '📋'} <b>${c.name}</b>\n ${c.sentCount}/${c.totalCount} 已发送 · ${c.status}`
 )
 return `📋 <b>我的活动</b>\n\n${lines.join('\n\n')}\n\n<i>在 Nomadly SMS 应用中管理活动。</i>`
 },
 planSubscribed:
 HIDE_SMS_APP === 'true'
 ? `您已成功订阅 {{plan}} 计划！享受免费 、无限Shortit链接和免费USA电话号码验证（含机主姓名）。需要 E-sim 卡？请点击 💬 获取支持。`
 : `✅ 已订阅 {{plan}} 计划！

包含：
• 免费 
• 无限 Shortit 链接
• USA 电话验证
• ${SMS_APP_NAME}

📱 设备访问：
 每日 — 3台设备
 每周 — 10台设备
 每月 — 无限设备

📲 下载：${SMS_APP_LINK}
💬 E-sim：点击支持
🔓 切换设备：/resetlogin`,
 alreadySubscribedPlan: days => `您的订阅已激活，并将在 ${days} 天后到期。`,
 payError: `未找到支付会话，请重试或点击 💬 获取支持。了解更多信息，请访问 ${TG_HANDLE}。`,
 chooseFreeDomainText: `<b>好消息！</b> 此域名可随您的订阅免费提供。您想领取吗？`,

 chooseDomainToBuy: text => `<b>获取你的网络角落！</b> 请分享你希望购买的域名，例如“abcpay.com”。${text}`,
 askDomainToUseWithShortener: `将此域名用作<b>自定义短链接</b>？\n\n<b>是</b> — 自动配置 DNS，短链接变为 <code>yourdomain.com/abc</code>。\n\n<b>否</b> — 仅注册。可随时从 DNS 管理中启用。`,
 blockUser: `请分享需要被封锁的用户的用户名。`,
 unblockUser: `请分享需要解封的用户的用户名。`,
 blockedUser: `你目前被封锁，无法使用机器人。请点击 💬 获取支持。更多信息 ${TG_HANDLE}。`,
 greet: `${CHAT_BOT_BRAND} — 缩短URL、注册域名、购买电话线索，从Telegram发展您的业务。

使用${FREE_LINKS}次Shortit试用链接开始 — /start
支持: 点击 💬 获取支持`,

 linkExpired: `您的 ${CHAT_BOT_BRAND} 测试期已结束，您的短链接已停用。我们邀请您订阅以继续访问我们的URL服务和免费域名。选择适当的计划并按照说明订阅。请联系我们的任何问题。
敬启者，
${CHAT_BOT_BRAND}团队
了解更多： ${TG_CHANNEL}`,
 successPayment: `支付成功处理！现在可以关闭此窗口。`,
 welcome: `感谢选择 ${CHAT_BOT_NAME}！请在下面选择一个选项：`,
 welcomeFreeTrial: `${CHAT_BOT_BRAND}欢迎您！您有${FREE_LINKS}次Shortit试用链接来缩短URL。订阅可获得无限Shortit链接、免费 和免费USA电话验证（含机主姓名）。体验${CHAT_BOT_BRAND}的不同！`,
 unknownCommand: `找不到命令。按 /start 或点击 💬 获取支持。了解更多 ${TG_HANDLE}。`,
 support: `请点击 💬 获取支持。了解更多 ${TG_HANDLE}。`,
 joinChannel: `请加入频道 ${TG_CHANNEL}。`,
 dnsPropagated: `{{domain}}的DNS传播已完成，进行无限链接简化。`,
 dnsNotPropagated: `{{domain}}的DNS传播正在进行，您将会在完成后更新。 ✅`,
 domainBoughtSuccess: domain => `域名 ${domain} 现在属于您。谢谢选择我们。

敬启者，
${CHAT_BOT_NAME}`,

 domainBought: `您的域名 {{domain}} 已成功链接到您的账户，DNS传播即将完成。稍后您将自动收到更新。🚀`,
 domainLinking: domain =>
 `正在将域名与您的账户链接中。请注意，DNS更新可能需要最长 30 分钟。您可以在此处检查 DNS 更新状态：https://www.whatsmydns.net/#A/${domain}`,
 errorSavingDomain: `保存域名时出错，请点击 💬 获取支持。更多信息请访问 ${TG_HANDLE}。`,
 chooseDomainToManage: `请选择您要管理的域名。`,
 chooseDomainWithShortener: `请选择或购买您想要连接到短链接的域名。`,
 viewDnsRecords: (records, domain, nameserverType) => {
 let msg = `<b>${domain} 的 DNS 记录</b>\n`

 // NS section — only show for cloudflare or custom NS (hide provider defaults)
 const nsRecs = records['NS']
 if (nsRecs && nsRecs.length && (nameserverType === 'cloudflare' || nameserverType === 'custom')) {
 const provider = nameserverType === 'cloudflare' ? 'Cloudflare' : '自定义'
 msg += `\n<b>域名服务器</b> <i>(${provider})</i>\n`
 for (let i = 0; i < nsRecs.length; i++) {
 msg += ` NS${i + 1}: <code>${nsRecs[i].recordContent || '—'}</code>\n`
 }
 msg += `<i>使用"更新 DNS 记录"来更改。</i>\n`
 }

 const otherTypes = ['A', 'AAAA', 'MX', 'TXT', 'CNAME', 'SRV', 'CAA']
 const typeLabels = {
 A: 'A 记录', AAAA: 'AAAA 记录', CNAME: 'CNAME 记录',
 MX: 'MX 记录', TXT: 'TXT 记录',
 SRV: 'SRV 记录', CAA: 'CAA 记录',
 }
 for (const type of otherTypes) {
 let recs = records[type]
 if (!recs || !recs.length) continue
 if (type === 'CNAME') {
 recs = recs.filter(r => !r.recordContent || !r.recordContent.includes('.up.railway.app'))
 if (!recs.length) continue
 }
 msg += `\n<b>${typeLabels[type]}</b>\n`
 for (const r of recs) {
 const idx = `<b>${r.index}.</b>`
 const host = r.recordName && r.recordName !== domain ? r.recordName : '@'
 if (type === 'MX') {
 const pri = r.priority !== undefined ? ` (优先级:${r.priority})` : ''
 msg += `${idx} MX ${host}${pri} -> ${r.recordContent || '无'}\n`
 } else if (type === 'TXT') {
 const val = r.recordContent ? (r.recordContent.length > 60 ? r.recordContent.substring(0, 60) + '...' : r.recordContent) : '无'
 msg += `${idx} TXT ${host} -> ${val}\n`
 } else if (type === 'SRV') {
 msg += `${idx} SRV ${r.recordName || ''} -> ${r.recordContent || '无'}\n`
 } else {
 msg += `${idx} ${type} ${host} -> ${r.recordContent || '无'}\n`
 }
 }
 }
 const hasAny = ['NS', ...otherTypes].some(t => records[t]?.length)
 if (!hasAny) msg += '\n未找到 DNS 记录。\n'
 return msg
 },

 addDns: '添加 DNS 记录',
 updateDns: '更新 DNS 记录',
 deleteDns: '删除 DNS 记录',
 quickActions: '快速操作',
 activateShortener: '🔗 激活 URL 短链接',
 deactivateShortener: '🔗 停用 URL 短链接',

 // DNS Wizard strings (zh)
 mx: 'MX 记录',
 txt: 'TXT 记录',
 'MX 记录': 'MX',
 'TXT 记录': 'TXT',
 dnsQuickActionMenu: '选择预设配置：',
 dnsQuickAskIp: '请输入服务器 IP 地址 (IPv4)：',
 dnsQuickAskVerificationTxt: '请粘贴提供商给您的 TXT 验证值：',
 dnsQuickAskSubdomainName: '请输入子域名名称（如：api、blog、app）：',
 dnsQuickAskSubdomainTargetType: (full) => `您想如何指向 ${full}？`,
 dnsQuickSubdomainIp: '指向 IP (A)',
 dnsQuickSubdomainDomain: '指向域名 (CNAME)',
 dnsQuickAskSubdomainIp: '请输入 IP 地址：',
 dnsQuickAskSubdomainDomain: '请输入目标域名：',
 dnsQuickSetupProgress: (step, total) => `正在配置 (${step}/${total})...`,
 dnsQuickSetupError: (what) => `创建 ${what} 时出错，请重试。`,
 dnsQuickGoogleDone: (domain) => `已为 ${domain} 配置 Google Workspace！5 条 MX + SPF 已添加。`,
 dnsQuickZohoDone: (domain) => `已为 ${domain} 配置 Zoho Mail！3 条 MX + SPF 已添加。`,
 dnsQuickPointToIpDone: (domain, ip) => `${domain} 现在指向 ${ip}。\nA: ${domain} -> ${ip}\nCNAME: www.${domain} -> ${domain}`,
 dnsQuickVerificationDone: 'TXT 验证记录已添加！',
 dnsQuickSubdomainDone: (sub, target, type) => `${sub} 现在指向 ${target} (${type})`,
 dnsInvalidIpv4: '无效的 IPv4 地址。请输入有效 IP（如：192.168.1.1）：',
 dnsInvalidHostname: '无效的主机名。可使用字母数字、连字符、下划线和点（例如：api、_dmarc、neo1._domainkey）：',
 dnsInvalidMxPriority: '无效的优先级。请输入 1 到 65535 之间的数字：',
 askDnsHostname: {
 A: '<b>添加 A 记录</b>\n\n输入主机名：\ne.g. <b>@</b> 表示根域名，或 <b>api</b>, <b>blog</b>, <b>www</b>',
 CNAME: '<b>添加 CNAME 记录</b>\n\n输入子域名：\ne.g. <b>www</b>, <b>api</b>, <b>blog</b>\n\n注意：CNAME 不能用于根域名 (@)',
 MX: '<b>添加 MX 记录</b>（步骤 1/3）\n\n输入主机名：\ne.g. <b>@</b> 表示根邮箱，或子域名',
 TXT: '<b>添加 TXT 记录</b>（步骤 1/2）\n\n输入主机名：\ne.g. <b>@</b> 表示根域名，或 <b>_dmarc</b>, <b>mail</b>',
 NS: '<b>添加 NS 记录</b>\n\n输入域名服务器：\ne.g. <b>ns1.cloudflare.com</b>',
 AAAA: '<b>添加 AAAA 记录</b>（步骤 1/2）\n\n输入主机名：\ne.g. <b>@</b> 表示根域名，或 <b>api</b>, <b>blog</b>',
 },
 askDnsValue: {
 A: '输入 IPv4 地址：\ne.g. <b>192.168.1.1</b>',
 CNAME: '输入目标域名：\ne.g. <b>myapp.railway.app</b>',
 MX: '<b>步骤 2/3</b> — 输入邮件服务器：\ne.g. <b>ASPMX.L.GOOGLE.COM</b>',
 TXT: '<b>步骤 2/2</b> — 输入 TXT 值：\ne.g. <b>v=spf1 include:_spf.google.com ~all</b>',
 AAAA: '<b>步骤 2/2</b> — 输入 IPv6 地址：\ne.g. <b>2001:db8::1</b>',
 },
 askMxPriority: '<b>步骤 3/3</b> — 输入 MX 优先级（数值越小优先级越高）：\ne.g. <b>10</b> 为主要，<b>20</b> 为备用',
 dnsQuickActions: {
 pointToIp: '指向 IP',
 googleEmail: 'Google Workspace 邮箱',
 zohoEmail: 'Zoho 邮箱',
 verification: '域名验证 (TXT)',
 addSubdomain: '添加子域名',
 },

 // Phase 2: AAAA, SRV, CAA
 aaaa: 'AAAA 记录',
 'AAAA 记录': 'AAAA',
 srvRecord: 'SRV 记录',
 'SRV 记录': 'SRV',
 caaRecord: 'CAA 记录',
 'CAA 记录': 'CAA',
 dnsInvalidIpv6: '无效的 IPv6 地址。请输入有效 IPv6（如：2001:db8::1）：',
 dnsInvalidPort: '无效的端口号。请输入 1 到 65535 之间的数字：',
 dnsInvalidWeight: '无效的权重。请输入 0 到 65535 之间的数字：',
 dnsSrvCaaNotSupported: '您当前的 DNS 提供商（ConnectReseller）不支持 SRV 和 CAA 记录。请切换到 Cloudflare 或 OpenProvider 域名服务器。',
 askSrvService: '<b>添加 SRV 记录</b>（步骤 1/5）\n\n输入服务和协议：\ne.g. <b>_sip._tcp</b>, <b>_http._tcp</b>',
 askSrvTarget: '<b>步骤 2/5</b> — 输入目标主机名：\ne.g. <b>sipserver.example.com</b>',
 askSrvPort: '<b>步骤 3/5</b> — 输入端口号：\ne.g. <b>5060</b>, <b>443</b>',
 askSrvPriority: '<b>步骤 4/5</b> — 输入优先级（数值越小优先级越高）：\ne.g. <b>10</b>',
 askSrvWeight: '<b>步骤 5/5</b> — 输入权重（负载均衡）：\ne.g. <b>100</b>',
 askCaaHostname: '<b>添加 CAA 记录</b>（步骤 1/3）\n\n输入主机名：\ne.g. <b>@</b> 表示根域名',
 askCaaTag: '<b>步骤 2/3</b> — 选择 CAA 标签：',
 caaTagIssue: 'issue — 授权 CA',
 caaTagIssuewild: 'issuewild — 授权通配符',
 caaTagIodef: 'iodef — 违规报告 URL',
 'issue — 授权 CA': 'issue',
 'issuewild — 授权通配符': 'issuewild',
 'iodef — 违规报告 URL': 'iodef',
 askCaaValue: (tag) => {
 if (tag === 'iodef') return '<b>步骤 3/3</b> — 输入报告 URL：\ne.g. <b>mailto:admin@example.com</b>'
 return '<b>步骤 3/3</b> — 输入授权 CA 域名：\ne.g. <b>letsencrypt.org</b>'
 },
 askDnsHostnameAaaa: '请输入主机名（@ 表示根域名，或子域名如 <b>api</b>、<b>blog</b>）：',
 askDnsValueAaaa: '请输入 IPv6 地址（如：<b>2001:db8::1</b>）：',

 // DNS Validation Checker
 checkDns: '检查 DNS',
 dnsChecking: (domain) => `正在检查 <b>${domain}</b> 的 DNS...`,
 dnsRecordLive: (type, value) => `<b>${type}</b> 已生效，解析到 <b>${value}</b>。`,
 dnsRecordPropagating: (type) => `<b>${type}</b> 正在传播中，可能需要 24-48 小时。`,
 dnsHealthTitle: (domain) => `<b>DNS 健康检查 — ${domain}</b>\n`,
 dnsHealthRow: (type, found, count, answers) => {
 if (!found) return ` ${type}: —`
 const vals = answers.slice(0, 2).join(', ')
 const more = answers.length > 2 ? ` +${answers.length - 2} 条` : ''
 return ` ${type}: ${count} 条记录 (${vals}${more})`
 },
 dnsHealthSummary: (resolving, total) => `\n${resolving}/${total} 种记录类型已解析。`,
 dnsCheckError: 'DNS 查询失败，请稍后重试。',
 manageNameservers: '🔄 管理域名服务器',
 manageNsMenu: (domain, nsRecords, nameserverType) => {
 const provider = nameserverType === 'cloudflare' ? 'Cloudflare' : nameserverType === 'custom' ? '自定义' : '提供商默认'
 let msg = `<b>🔄 域名服务器 — ${domain}</b>\n\n`
 msg += `<b>提供商：</b> ${provider}\n\n`
 if (nsRecords && nsRecords.length) {
 msg += `<b>当前域名服务器：</b>\n`
 nsRecords.forEach((ns, i) => { msg += ` NS${i + 1}: <code>${ns.recordContent || '—'}</code>\n` })
 } else { msg += `<i>未找到 NS 记录。</i>\n` }
 msg += `\n请选择操作：`
 return msg
 },
 setCustomNs: '✏️ 自定义域名服务器',
 setCustomNsPrompt: (domain, nsRecords) => {
 let msg = `<b>✏️ 设置 ${domain} 的自定义域名服务器</b>\n\n`
 if (nsRecords && nsRecords.length) {
 msg += `<b>当前：</b>\n`
 nsRecords.forEach((ns, i) => { msg += ` NS${i + 1}: <code>${ns.recordContent || '—'}</code>\n` })
 msg += '\n'
 }
 msg += `输入新的域名服务器（每行一个，最少2个，最多4个）：\n\n<i>示例：\nns1.example.com\nns2.example.com</i>`
 return msg
 },
 switchToCf: '☁️ Switch to Cloudflare',
 switchToCfConfirm: (domain) => `<b>将 ${domain} 切换到 Cloudflare DNS？</b>\n\n这将：\n1. 为您的域名创建 Cloudflare 区域\n2. 将现有 DNS 记录迁移到 Cloudflare\n3. 在注册商处更新域名服务器\n\nDNS 传播可能需要 24-48 小时。\n\n继续？`,
 switchToCfProgress: (domain) => `⏳ 正在将 <b>${domain}</b> 切换到 Cloudflare DNS…`,
 switchToCfSuccess: (domain, ns) => `<b>完成！</b> ${domain} 现在使用 Cloudflare DNS。\n\n<b>新域名服务器：</b>\n${ns.map((n, i) => `NS${i + 1}: <code>${n}</code>`).join('\n')}`,
 switchToCfError: (error) => `❌ 切换到 Cloudflare 失败：${error}`,
 switchToCfAlreadyCf: '此域名已在使用 Cloudflare DNS。',
 switchToProviderDefault: '🏠 切换到提供商 DNS',
 switchToProviderConfirm: (domain) => `<b>将 ${domain} 切换回提供商 DNS？</b>\n\n这将：\n1. 将 DNS 记录从 Cloudflare 迁移到注册商\n2. 恢复默认域名服务器\n3. 删除 Cloudflare 区域\n\nDNS 传播可能需要 24-48 小时。\n\n继续？`,
 switchToProviderProgress: (domain) => `⏳ 正在将 <b>${domain}</b> 切换到提供商 DNS…`,
 switchToProviderSuccess: (domain, ns) => `<b>完成！</b> ${domain} 现在使用提供商 DNS。\n\n<b>新域名服务器：</b>\n${ns.map((n, i) => `NS${i + 1}: <code>${n}</code>`).join('\n')}`,
 switchToProviderError: (error) => `❌ 切换到提供商 DNS 失败：${error}`,
 switchToProviderAlreadyProvider: '此域名已在使用提供商 DNS。',
 updateNsPrompt: (nsRecords, slotIndex) => {
 let msg = `<b>更新域名服务器 — 插槽 NS${slotIndex}</b>\n\n<b>当前排列：</b>\n`
 for (let i = 0; i < nsRecords.length; i++) {
 const marker = (i + 1) === slotIndex ? ' ← 正在更新' : ''
 msg += ` NS${i + 1}: <code>${nsRecords[i].recordContent || '—'}</code>${marker}\n`
 }
 msg += `\n请输入 <b>NS${slotIndex}</b> 的新域名服务器：\n例如 <b>ns1.cloudflare.com</b>`
 return msg
 },

 // Digital Products
 digitalProductsSelect: `🛒 <b>数字产品</b>\n\n经验证的账户通过此机器人<b>快速</b>交付。\n\n<b>电信</b> — Twilio, Telnyx (短信, 语音, SIP)\n<b>云服务</b> — AWS, Google Cloud (完全访问)\n<b>电子邮件</b> — Google Workspace, Zoho Mail, IONOS SMTP\n<b>移动</b> — eSIM T-Mobile\n\n使用加密货币、银行转账或钱包支付。请在下方选择：`,
 dpTwilioMain: `📞 Twilio 主账号 — $${DP_PRICE_TWILIO_MAIN}`,
 dpTwilioSub: `📞 Twilio 子账号 — $${DP_PRICE_TWILIO_SUB}`,
 dpTelnyxMain: `📡 Telnyx 主账号 — $${DP_PRICE_TELNYX_MAIN}`,
 dpTelnyxSub: `📡 Telnyx 子账号 — $${DP_PRICE_TELNYX_SUB}`,
 dpGworkspaceNew: `📧 Google Workspace Admin（新域名）— $${DP_PRICE_GWORKSPACE_NEW}`,
 dpGworkspaceAged: `📧 Google Workspace Admin（老域名）— $${DP_PRICE_GWORKSPACE_AGED}`,
 dpEsim: `📱 eSIM T-Mobile — $${DP_PRICE_ESIM}`,
 dpEsimAirvoice: `📱 eSIM Airvoice (AT&T)`,
 dpAirvoiceSelect: `📱 <b>eSIM Airvoice (AT&T)</b>\n\n📶 AT&T 网络无限通话、短信和数据。\n支持 iOS 和 Android。扫码即可激活。\n\n选择套餐时长：`,
 dpAirvoice1m: `1个月 — $${DP_PRICE_AIRVOICE_1M}`,
 dpAirvoice3m: `3个月 — $${DP_PRICE_AIRVOICE_3M}`,
 dpAirvoice6m: `6个月 — $${DP_PRICE_AIRVOICE_6M}`,
 dpAirvoice1y: `1年 — $${DP_PRICE_AIRVOICE_1Y}`,
 dpZohoNew: `📧 Zoho Mail（新域名）— $${DP_PRICE_ZOHO_NEW}`,
 dpZohoAged: `📧 Zoho Mail（老域名）— $${DP_PRICE_ZOHO_AGED}`,
 dpAwsMain: `☁️ AWS 主账号 — $${DP_PRICE_AWS_MAIN}`,
 dpAwsSub: `☁️ AWS 子账号 — $${DP_PRICE_AWS_SUB}`,
 dpGcloudMain: `🌐 Google Cloud 主账号 — $${DP_PRICE_GCLOUD_MAIN}`,
 dpGcloudSub: `🌐 Google Cloud 子账号 — $${DP_PRICE_GCLOUD_SUB}`,
 dpIonosSmtp: `📧 IONOS SMTP — $${DP_PRICE_IONOS_SMTP}`,
 dpPaymentPrompt: (product, price) => {
 const descriptions = {
 'Twilio Main Account': '完整的 Twilio 主账户，含控制台访问、API 密钥，可开通电话号码、发送 SMS/MMS 和语音通话。\n\n您将收到：登录凭据 + API SID 和 Auth Token。',
 'Twilio Sub-Account': 'Twilio 子账户，含控制台登录和专用 API 凭据，支持 SMS、语音和号码管理。\n\n您将收到：登录凭据、Account SID 和 Auth Token。',
 'Telnyx Main Account': '完整的 Telnyx 主账户，含 Mission Control Portal 访问。开通号码、配置 SIP、消息和语音。\n\n您将收到：登录凭据 + API 密钥。',
 'Telnyx Sub-Account': 'Telnyx 子账户，含 Mission Control Portal 登录和 API 访问，支持消息、语音和号码管理。\n\n您将收到：登录凭据 + API 密钥。',
 'AWS Main Account': '完整的 AWS 根账户，含控制台访问所有服务 — EC2、S3、Lambda、SES 等。\n\n您将收到：根邮箱、密码和 MFA 设置。',
 'AWS Sub-Account': 'AWS 子账户（Organizations 成员），含完整控制台登录和核心服务访问 — EC2、S3、Lambda 等。\n\n您将收到：登录凭据和 IAM 访问。',
 'Google Cloud Main Account': '完整的 Google Cloud 主账户，已启用计费。Compute Engine、Cloud Storage、BigQuery 等全部 GCP 服务。\n\n您将收到：登录凭据。',
 'Google Cloud Sub-Account': 'Google Cloud 项目，含完整控制台登录和编辑器级访问。包含计算、存储和 API 访问。\n\n您将收到：登录凭据和服务账户密钥。',
 'Google Workspace (New Domain)': '在新注册域名上设置 Google Workspace 企业邮箱。@您的域名 邮箱含 Gmail、Drive、Docs 和 Meet。\n\n您将收到：管理员登录 + 域名凭据。',
 'Google Workspace (Aged Domain)': '在老域名上设置 Google Workspace，提升邮件送达率。企业邮箱含完整 Google 套件。\n\n您将收到：管理员登录 + 域名凭据。',
 'Zoho Mail (New Domain)': '在新域名上设置 Zoho Mail 专业邮箱。@您的域名 邮箱含日历、联系人和文件存储。\n\n您将收到：管理员登录 + 域名设置。',
 'Zoho Mail (Aged Domain)': '在老域名上设置 Zoho Mail，提升发件人信誉。专业邮箱含完整 Zoho 套件。\n\n您将收到：管理员登录 + 域名凭据。',
 'eSIM T-Mobile': '📶 <b>1个月 — 无限通话、短信和数据</b>\n支持 iOS 和 Android。扫码即可激活。\n\n您将收到：QR 码或激活详情。',
 'eSIM Airvoice (AT&T) — 1 Month': '📶 <b>1个月 — 无限通话、短信和数据 (AT&T)</b>\n支持 iOS 和 Android。扫码即可激活。\n\n您将收到：QR 码或激活详情。',
 'eSIM Airvoice (AT&T) — 3 Months': '📶 <b>3个月 — 无限通话、短信和数据 (AT&T)</b>\n支持 iOS 和 Android。扫码即可激活。\n\n您将收到：QR 码或激活详情。',
 'eSIM Airvoice (AT&T) — 6 Months': '📶 <b>6个月 — 无限通话、短信和数据 (AT&T)</b>\n支持 iOS 和 Android。扫码即可激活。\n\n您将收到：QR 码或激活详情。',
 'eSIM Airvoice (AT&T) — 1 Year': '📶 <b>1年 — 无限通话、短信和数据 (AT&T)</b>\n支持 iOS 和 Android。扫码即可激活。\n\n您将收到：QR 码或激活详情。',
 }
 const desc = descriptions[product] || ''
 return `💰 <b>订单：${product}</b>\n\n💵 价格：<b>$${price}</b>${desc ? '\n\n' + desc : ''}\n\n请选择支付方式：`
 },
 dpOrderConfirmed: (product, price, orderId) => `✅ <b>订单已确认！</b>\n\n🛒 产品：<b>${product}</b>\n💵 金额：<b>$${price}</b>\n🆔 订单号：<code>${orderId}</code>\n\n您的订单将很快通过此机器人送达。\n如有问题，请联系客服。`,

 // Virtual Card
 vcWelcome: `💳 <b>虚拟借记卡</b>\n\n充值一张虚拟卡。\n\n✅ 全球在线使用\n✅ 即时交付\n✅ $50 – $1,000\n\n选择金额或输入自定义金额：`,
 vcInvalidAmount: `❌ 请输入 <b>$50</b> 到 <b>$1,000</b> 之间的有效金额。`,
 vcAskAddress: `📬 <b>收件地址</b>\n\n请输入完整的国际格式地址：\n\n<i>示例：\n张三\n北京市朝阳区建国路123号\n100022\n中国</i>`,
 vcAddressTooShort: `❌ 地址过短，请填写完整地址，包括姓名、街道、城市、邮编和国家。`,
 vcOrderSummary: (amount, fee, total) => `📋 <b>订单摘要</b>\n\n💳 虚拟卡充值：<b>$${amount}</b>\n💰 服务费：<b>$${fee.toFixed(2)}</b>${amount < 200 ? '（最低$20）' : '（10%）'}\n━━━━━━━━━━━━━━━━━\n💵 <b>总计：$${total.toFixed(2)}</b>\n\n请选择支付方式：`,
 vcOrderConfirmed: (amount, total, orderId) => `✅ <b>虚拟卡订单已确认！</b>\n\n💳 充值金额：<b>$${amount}</b>\n💵 已支付：<b>$${total.toFixed(2)}</b>\n🆔 订单号：<code>${orderId}</code>\n\n⏱ <b>卡片信息将很快在此发送。</b>`,
 leadsFileNumbersOnly: `📄 <b>文件 1 — 电话号码</b>\n您批次中所有已验证的号码。`,
 leadsFileWithNames: (count) => `📄 <b>文件 2 — 号码 + 机主姓名（${count} 条匹配）</b>\n这些线索包含机主的真实姓名。用名字称呼对方——立刻建立信任，大幅提高回复率。`,
 addDnsTxt: '选择记录类型：',
 updateDnsTxt: '选择要更新的记录：',
 deleteDnsTxt: '选择要删除的记录：',
 confirmDeleteDnsTxt: '确定要删除此记录吗？',
 a: `A 记录`,
 cname: `CNAME 记录`,
 ns: `NS 记录`,
 'A 记录': `A`,
 'CNAME 记录': `CNAME`,
 'NS 记录': `NS`,
 askDnsContent: {
 NS: '<b>添加 NS 记录</b>\n\n输入域名服务器：\ne.g. <b>ns1.cloudflare.com</b>',
 'NS Record': '<b>添加 NS 记录</b>\n\n输入域名服务器：\ne.g. <b>ns1.cloudflare.com</b>',
 },
 askUpdateDnsContent: {
 A: (current) => `<b>更新 A Record</b>\n当前: <b>${current || 'N/A'}</b>\n\n输入新值 IPv4 地址:\ne.g. <b>192.168.1.1</b>`,
 'A Record': (current) => `<b>更新 A Record</b>\n当前: <b>${current || 'N/A'}</b>\n\n输入新值 IPv4 地址:\ne.g. <b>192.168.1.1</b>`,
 CNAME: (current) => `<b>更新 CNAME Record</b>\n当前: <b>${current || 'N/A'}</b>\n\n输入新值 目标域名:\ne.g. <b>myapp.railway.app</b>`,
 'CNAME Record': (current) => `<b>更新 CNAME Record</b>\n当前: <b>${current || 'N/A'}</b>\n\n输入新值 目标域名:\ne.g. <b>myapp.railway.app</b>`,
 NS: (current) => `<b>更新 NS Record</b>\n当前: <b>${current || 'N/A'}</b>\n\n输入新值 域名服务器:\ne.g. <b>ns1.cloudflare.com</b>`,
 'NS Record': (current) => `<b>更新 NS Record</b>\n当前: <b>${current || 'N/A'}</b>\n\n输入新值 域名服务器:\ne.g. <b>ns1.cloudflare.com</b>`,
 MX: (current) => `<b>更新 MX Record</b>\n当前: <b>${current || 'N/A'}</b>\n\n输入新值 邮件服务器:\ne.g. <b>ASPMX.L.GOOGLE.COM</b>`,
 'MX Record': (current) => `<b>更新 MX Record</b>\n当前: <b>${current || 'N/A'}</b>\n\n输入新值 邮件服务器:\ne.g. <b>ASPMX.L.GOOGLE.COM</b>`,
 TXT: (current) => {
 const display = current ? (current.length > 50 ? current.substring(0, 50) + '...' : current) : 'N/A'
 return `<b>更新 TXT Record</b>\n当前: <b>${display}</b>\n\n输入新值 TXT 值:\ne.g. <b>v=spf1 include:_spf.google.com ~all</b>`
 },
 'TXT Record': (current) => {
 const display = current ? (current.length > 50 ? current.substring(0, 50) + '...' : current) : 'N/A'
 return `<b>更新 TXT Record</b>\n当前: <b>${display}</b>\n\n输入新值 TXT 值:\ne.g. <b>v=spf1 include:_spf.google.com ~all</b>`
 },
 AAAA: (current) => `<b>更新 AAAA Record</b>\n当前: <b>${current || 'N/A'}</b>\n\n输入新值 IPv6 地址:\ne.g. <b>2001:db8::1</b>`,
 'AAAA Record': (current) => `<b>更新 AAAA Record</b>\n当前: <b>${current || 'N/A'}</b>\n\n输入新值 IPv6 地址:\ne.g. <b>2001:db8::1</b>`,
 },
 dnsRecordSaved: 'DNS 记录添加成功。DNS 更改可能需要最多 24 小时生效。',
 dnsRecordDeleted: '记录已成功删除。',
 dnsRecordUpdated: 'DNS 记录更新成功。DNS 更改可能需要最多 24 小时生效。',
 provideLink: `请输入有效的 URL。例如：https://google.com`,
 comingSoonWithdraw: `提现功能暂未开放。需要帮助？请点击 💬 获取支持。`,
 promoOptOut: `您已取消订阅促销消息。输入 /start_promos 随时重新订阅。`,
 promoOptIn: `您已重新订阅促销消息。您将收到我们最新的优惠和活动！`,
 selectCurrencyToDeposit: `💵 充值金额（最低 $10）：`,
 depositNGN: `请输入 NGN 金额（最低 ≈ 10 美元）。\n您的奈拉将按当前汇率转换为美元：`,
 askEmailForNGN: `请输入支付确认邮件`,
 depositUSD: `请输入 USD 金额，注意最小值为 $10：`,
 selectCryptoToDeposit: `请选择加密货币：`,
 'bank-pay-plan': (priceNGN, plan) =>
 `请点击“付款”按钮，发送 ${priceNGN} NGN。一旦交易确认，您将立即收到通知，您的 ${plan} 计划将顺利激活。

问候，
${CHAT_BOT_NAME}`,
 bankPayDomain: (priceNGN, domain) =>
 `请点击“付款”按钮，发送 ${priceNGN} NGN。一旦交易确认，您将立即收到通知，您的域名 ${domain} 将顺利激活。

问候，
${CHAT_BOT_NAME}`,
 showDepositCryptoInfoPlan: (priceUsd, priceCrypto, tickerView, address, plan) =>
 `💰 <b>支付金额: $${Number(priceUsd).toFixed(2)} USD</b>

请发送 <b>${priceCrypto} ${tickerView}</b> 至:

<code>${address}</code>

您的 ${plan} 计划将在支付确认后自动激活（通常只需几分钟）。

此致,
${CHAT_BOT_NAME}`,
 showDepositCryptoInfoDomain: (priceUsd, priceCrypto, tickerView, address, domain) =>
 `💰 <b>支付金额: $${Number(priceUsd).toFixed(2)} USD</b>

请发送 <b>${priceCrypto} ${tickerView}</b> 至:

<code>${address}</code>

您的域名 ${domain} 将在支付确认后自动激活（通常只需几分钟）。

此致,
${CHAT_BOT_NAME}`,

 showDepositCryptoInfoLeads: (priceUsd, priceCrypto, tickerView, address, label) =>
 `💰 <b>支付金额: $${Number(priceUsd).toFixed(2)} USD</b>

请发送 <b>${priceCrypto} ${tickerView}</b> 至:

<code>${address}</code>

您的 ${label} 将在支付确认后自动交付（通常只需几分钟）。

此致,
${CHAT_BOT_NAME}`,

 showDepositCryptoInfoPhone: (priceUsd, priceCrypto, tickerView, address, phoneNumber) =>
 `💰 <b>支付金额: $${Number(priceUsd).toFixed(2)} USD</b>

请发送 <b>${priceCrypto} ${tickerView}</b> 至:

<code>${address}</code>

您的 Cloud IVR 号码 ${phoneNumber} 将在支付确认后自动激活（通常只需几分钟）。

此致,
${CHAT_BOT_NAME}`,

 showDepositCryptoInfoDigitalProduct: (priceUsd, priceCrypto, tickerView, address, product) =>
 `💰 <b>支付金额: $${Number(priceUsd).toFixed(2)} USD</b>

请发送 <b>${priceCrypto} ${tickerView}</b> 至:

<code>${address}</code>

您的 <b>${product}</b> 订单将在支付确认后自动交付（通常只需几分钟）。

此致,
${CHAT_BOT_NAME}`,

 showDepositCryptoInfo: (priceUsd, priceCrypto, tickerView, address) =>
 `💰 <b>支付金额: $${Number(priceUsd).toFixed(2)} USD</b>\n\n请发送 <b>${priceCrypto} ${tickerView}</b> 至:\n\n<code>${address}</code>\n\n加密支付确认速度很快——通常只需几分钟。确认后，您将立即收到通知，并且您的钱包将更新。\n\n问候,\n${CHAT_BOT_NAME}`,

 confirmationDepositMoney: (amount, usd) =>
 `您的 ${amount}（$${usd}）支付已处理。感谢您选择我们。\n问候,\n${CHAT_BOT_NAME}`,

 showWallet: (usd) => `钱包余额 :\n\n$${view(usd)}`,

 wallet: (usd) => `钱包余额 :\n\n$${view(usd)}\n\n请选择钱包选项:`,

 walletSelectCurrency: (usd) => `钱包余额: $${view(usd)}`,

 walletBalanceLow: `您的钱包余额不足。点击"👛 我的钱包" → "➕💵 充值"进行充值。`,

 sentLessMoney: (expected, got) =>
 `您发送的金额少于预期，所以我们将收到的金额存入您的钱包。我们预期 ${expected} 但收到 ${got}`,

 sentMoreMoney: (expected, got) =>
 `您发送的金额多于预期，因此我们将多余的金额存入您的钱包。我们预期 ${expected} 但收到 ${got}`,

 buyLeadsError: `抱歉，选择的区号不可用，并且您的钱包未收费`,
 buyLeadsProgress: (i, total) => `${((i * 100) / total).toFixed()}% leads 下载中。请稍候。`,

 phoneNumberLeads: `购买经验证的电话线索或验证您自己的号码：`,

 buyLeadsSelectCountry: `请选择国家`,
 buyLeadsSelectSmsVoice: `请选择短信/语音`,
 buyLeadsSelectArea: `请选择区域`,
 buyLeadsSelectAreaCode: `请选择区号`,
 buyLeadsSelectCarrier: `请选择运营商`,
 buyLeadsSelectCnam: `需要每条线索附带<b>电话号码机主姓名</b>吗？每 1,000 条额外 $15 — 绝对值得。`,
 buyLeadsSelectAmount: (min, max) => `您想购买多少 leads？选择或输入一个数量。最小值为 ${min} 最大值为 ${max}`,

 buyLeadsSelectFormat: `选择格式，例如本地 (212) 或国际 (+1212)`,

 buyLeadsSuccess: n => `🎉 <b>完成！</b> 您的 ${n} 条线索已准备好。\n\n您将获得两个文件：\n📄 <b>文件 1</b> — 所有电话号码\n📄 <b>文件 2</b> — 匹配了<b>机主姓名</b>的号码\n\n提示：用姓名个性化您的推广，被称呼姓名的人回复率高2-3倍。`,

 buyLeadsNewPrice: (leads, price, newPrice) => `💰 <b>${leads} 条线索</b> — 仅需 <b>$${view(newPrice)}</b> <s>($${price})</s>\n包含机主姓名。不要错过。`,
 buyLeadsPrice: (leads, price) => `💰 <b>${leads} 条线索</b> — <b>$${price}</b>\n包含机主姓名。随时为您准备。`,

 walletSelectCurrencyConfirm: `确认？`,

 validatorSelectCountry: `请选择国家`,
 validatorPhoneNumber: `请粘贴您的号码或上传包含国家代码的文件。`,
 validatorSelectSmsVoice: n => `${n} 个电话号码找到。请选择短信或语音拨号的选项。`,
 validatorSelectCarrier: `请选择运营商`,
 validatorSelectCnam: `需要验证后的线索附带<b>电话号码机主姓名</b>吗？\n\n知道对方是谁，您就能个性化您的消息——人们会回应自己的名字。每 1,000 条 $15，物超所值。`,
 validatorSelectAmount: (min, max) => `您想验证多少个电话号码？选择或输入一个数量。最小值为 ${min} 最大值为 ${max}`,

 validatorSelectFormat: `选择格式，例如本地 (212) 或国际 (+1212)`,

 validatorSuccess: (n, m) => `${n} 个 leads 被验证了。${m} 个有效的电话号码找到。`,
 validatorProgress: (i, total) => `${((i * 100) / total).toFixed()}% leads 验证中。请稍候。`,
 validatorProgressFull: (i, total) => `${((i * 100) / total).toFixed()}% leads 验证。`,

 validatorError: `抱歉，选择的电话号码不可用，并且您的钱包未收费`,
 validatorErrorFileData: `找到无效的国家电话号码。请上传选定国家的电话号码`,
 validatorErrorNoPhonesFound: `找不到电话号码。请重试。`,

 validatorBulkNumbersStart: `lead 验证已开始，很快就会完成。`,

 // url re-director
 redSelectUrl: `请分享您想要缩短和分析的 URL，例如 https://cnn.com`,
 redSelectRandomCustom: `请选择您的选择，随机或自定义链接`,
 redSelectProvider: `选择链接提供商`,
 redSelectCustomExt: `输入自定义后缀`,

 redValidUrl: `请提供一个有效的 URL，例如 https://google.com`,
 redTakeUrl: url => `您的缩短后的 URL 是: ${url}`,
 redIssueUrlBitly: `链接缩短失败。您的钱包未被扣费。请重试或点击 💬 获取支持。`,
 redIssueSlugCuttly: `您选择的链接名称已被使用，请尝试另一个`,
 redIssueUrlCuttly: `链接缩短失败。请重试或点击 💬 获取支持。`,
 freeLinksExhausted: `您的${FREE_LINKS}次试用链接已用完！订阅即可享受无限链接+免费域名+${DAILY_PLAN_FREE_VALIDATIONS.toLocaleString()}+次验证（含机主姓名）。`,
 subscriptionLeadsHint: `💡 订阅者每个计划可获得${DAILY_PLAN_FREE_VALIDATIONS.toLocaleString()}+次免费验证（含机主姓名）。每天仅需$${PRICE_DAILY}起。`,
 linksRemaining: (count, total) => {
 const base = `您还剩 ${count}/${total || FREE_LINKS} 次Shortit试用链接。`
 if (count <= 2) return `${base}\n\n⚡ <b>仅剩${count}次！</b>订阅即享无限链接 + 免费域名 + ${DAILY_PLAN_FREE_VALIDATIONS.toLocaleString()}+次验证（含机主姓名）。每天仅需$${PRICE_DAILY}起。`
 return base
 },
 redNewPrice: (price, newPrice) => `价格现在为 $${view(newPrice)} <s>($${price})</s>。请选择支付方式。`,
 customLink: '自定义链接',
 randomLink: '随机链接',
 askShortLinkExtension: '请告诉我们您偏好的短链接扩展名：例如 payer',
 linkAlreadyExist: `链接已存在。请键入 'ok' 尝试另一个。`,
 yourShortendUrl: shortUrl => `您的短链接是：${shortUrl}`,

 availablefreeDomain: (plan, available, s) =>
 `请记住，您的 ${plan} 计划包括 ${available} 个免费的${s}。今天就获取您的域名！`,
 shortenedUrlLink: `请分享您希望缩短和分析的URL。例如 https://cnn.com`,
 selectedTrialPlan: `您已选择免费试用计划`,
 userPressedBtn: message => `用户点击了 ${message} 按钮。`,
 userToBlock: userToBlock => `未找到用户 ${userToBlock}。`,
 userBlocked: userToBlock => `用户 ${userToBlock} 已被屏蔽。`,
 checkingDomainAvail: `检查域名可用性...`,
 checkingExistingDomainAvail: `检查现有域名的可用性...`,
 subscribeFirst: `📋 先订阅`,
 freeValidationUsed: (amount, remaining) => `已使用订阅验证了 ${amount} 个USA电话号码！剩余免费验证: ${remaining.toLocaleString()}。`,
 partialFreeValidation: (freeAmount, totalAmount, paidAmount, paidPrice) => `您还有 ${freeAmount.toLocaleString()} 次免费验证。您请求了 ${totalAmount.toLocaleString()} 个号码。\n\n${freeAmount.toLocaleString()} 个将免费处理，剩余 ${paidAmount.toLocaleString()} 个需支付 $${paidPrice}。请在下方完成付款。`,
 notValidHalf: `输入一个有效的后半部分`,
 linkAlreadyExist: `链接已经存在。请尝试其他。`,
 issueGettingPrice: `获取价格时遇到问题`,
 domainInvalid: `域名无效。请尝试其他域名。使用格式 abcpay.com`,
 domainMissingTLD: '缺少域名扩展名。请添加 .com、.net、.org 或其他扩展名。\n\n示例：<b>yourname.com</b>',
 domainTooShort: '域名太短。点前至少需要3个字符。\n\n示例：<b>abc.com</b>',
 domainInvalidChars: '域名包含无效字符。仅使用字母、数字和连字符。\n\n示例：<b>my-site.com</b>',
 domainStartsEndsHyphen: '域名不能以连字符开头或结尾。\n\n示例：<b>mysite.com</b>（不是 -mysite.com 或 mysite-.com）',
 domainSearchTimeout: (domain) => `⏱️ 搜索域名 <b>${domain}</b> 所需时间超过预期。\n\n请稍后重试，如果问题持续存在，请联系客服。`,
 chooseValidPlan: `请选择一个有效的计划`,
 noDomainFound: `未找到域名`,
 chooseValidDomain: `请选择一个有效的域名`,
 failedAudio: '❌ 音频处理失败。请重试。',
 enterBroadcastMessage: '输入消息',
 provide2Nameservers: '请提供至少2个域名服务器，用空格分隔。',
 noDomainSelected: '未选择域名。',
 validInstitutionName: '⚠️ 请输入有效的机构名称（2-100个字符）。',
 validCityName: '⚠️ 请输入有效的城市名称。',
 errorDeletingDns: error => `删除DNS记录时出错，${error}，请再次提供值`,
 selectValidOption: `选择有效选项`,
 cancelled: '已取消。',
 domainActionsMenu: (domain) => `<b>${domain} 的操作</b>\n\n请选择一个选项：`,
 purchaseFailed: '❌ 购买失败。您的钱包已退款。请重试或联系支持。',
 maxDnsRecord: `最多可以添加4个NS记录，您可以更新或删除以前的NS记录`,
 errorSavingDns: error => `保存DNS记录时出错，${error}，请再次提供值`,
 fileError: `处理文件时出错。`,
 ammountIncorrect: `金额不正确`,
 subscriptionExpire: (subscribedPlan, timeEnd) => `您的 ${subscribedPlan} 订阅已过期 ${timeEnd}`,
 plansSubscripedtill: (subscribedPlan, timeEnd) =>
 `您当前订阅的是 ${subscribedPlan} 计划。您的计划有效期至 ${timeEnd}`,
 planNotSubscriped: `您当前没有任何订阅计划。`,
 noShortenedUrlLink: `您还没有缩短的链接。`,
 shortenedLinkText: linksText => `这是您的缩短链接：\n${linksText}`,

 qrCodeText: `这是您的二维码！`,
 scanQrOrUseChat: chatId => `📱 <b>Nomadly SMS 应用</b>\n\n您的激活码：\n<code>${chatId}</code>\n\n📲 下载：${process.env.SMS_APP_LINK || '联系支持'}`,
 domainPurchasedFailed: (domain) => `❌ 域名 <b>${domain}</b> 注册未能完成。请重试，如果问题仍然存在，请联系支持。`,
 noDomainRegistered: '您还没有购买任何域名。',
 registeredDomainList: domainsText => `以下是您购买的域名：\n${domainsText}`,
 selectDomainAction: domain => `<b>${domain}</b>\n\n您想对此域名执行什么操作？`,
 domainActionDns: '🔧 DNS 管理',
 domainActionShortener: '🔗 激活 URL 短链接',
 domainActionDeactivateShortener: '🔗 停用 URL 短链接',
 comingSoon: `即将推出`,

 // --- Missing translations (added for completeness) ---
 Annually: '年度',
 Daily: '每日',
 Hourly: '每小时',
 Monthly: '每月',
 Quarterly: '每季度',
 Weekly: '每周',
 addSubdomain: '添加子域名',
 antiRedDisabled: domain => `❌ <b>${domain}</b> 的 Anti-Red 保护已<b>禁用</b>。\n\n"正在验证您的浏览器"页面将不再显示。其他安全层（IP隐藏、UA阻止）仍然有效。\n\n⚠️ <b>警告：</b>禁用 JS Challenge 会大幅降低您的保护。强烈建议保持启用以获得最大安全性。`,
 antiRedEnabled: domain => `✅ <b>${domain}</b> 的 Anti-Red 保护已<b>启用</b>。\n\n访问者在进入您的网站前会看到短暂的"正在验证浏览器"检查。`,
 antiRedError: '❌ 更新 Anti-Red 保护失败。请重试。',
 antiRedNoCF: domain => `⚠️ <b>${domain}</b> 未使用 Cloudflare。Anti-Red 保护需要 Cloudflare 域名服务器。`,
 antiRedStatusOff: domain => `🛡️ <b>${domain}</b> 的 <b>Anti-Red 保护</b>\n\n状态：<b>❌ 关闭</b>\n\n您的域名未受保护。开启它以阻止扫描器。\n\n⚠️ <b>建议：</b>启用 Anti-Red 保护和 JS Challenge 以获得最大安全性。`,
 antiRedStatusOn: domain => `🛡️ <b>${domain}</b> 的 <b>Anti-Red 保护</b>\n\n状态：<b>✅ 开启</b>\n\n这可以保护您的域名免受钓鱼扫描器的侵害。\n\n⚠️ <b>建议：</b>保持 JS Challenge 启用——它提供最大的安全保护。`,
 antiRedTurnOff: '❌ 关闭保护',
 antiRedTurnOn: '✅ 开启保护',
 antiRedTurningOff: domain => `⏳ 正在为 <b>${domain}</b> 禁用 Anti-Red 保护...`,
 antiRedTurningOn: domain => `⏳ 正在为 <b>${domain}</b> 启用 Anti-Red 保护...`,
 dnsWarningHostedDomain: (domain, plan) => `⚠️ <b>警告：此域名有活跃的托管计划</b>\n\n域名：<b>${domain}</b>\n计划：${plan}\n\n<b>⚠️ 修改 DNS 记录可能会导致您的托管和 Anti-Red 保护失效！</b>\n\nDNS 更改仅在您完全了解影响的情况下进行。错误的更改可能导致您的网站无法访问或丢失安全保护。\n\n<b>您确定要继续吗？</b>`,
 dnsProceedAnyway: '⚠️ 仍然继续',
 dnsCancel: '❌ 取消',
 domainTypeRegistered: '🏷️ 在我们这注册',
 domainTypeExternal: '🌍 外部',
 buyLeads: '🎯 购买电话线索',
 cancelRenewNow: '❌ 取消',
 confirmRenewNow: '✅ 确认并支付',
 domainActionAntiRed: '🛡️ Anti-Red 保护',
 googleEmail: '设置 Google 邮箱',
 pointToIp: '将域名指向IP',
 shortenLink: '✂️ 缩短链接',
 toggleAutoRenew: '🔁 切换自动续费',
 validateLeads: '✅ 验证号码',
 verification: '域名验证 (TXT)',
 walletBalanceLowAmount: (needed, balance) => 
 `您的钱包余额 ($${balance.toFixed(2)}) 不足。\n\n您还需要 <b>$${(needed - balance).toFixed(2)}</b>。点击充值按钮充值。`,
 zohoEmail: '设置 Zoho 邮箱',
 goBackToCoupon: '❌ 返回并应用优惠券',
 errorFetchingCryptoAddress: '获取加密货币地址时出错。请稍后再试。',
 paymentSuccessFul: '✅ 付款已确认 — 正在配置您的服务。',

 // 呼叫转移 (Cloud IVR)
 fwdInsufficientBalance: (walletBal, rate) => `🚫 <b>余额不足</b>\n\n💳 $${(walletBal || 0).toFixed(2)} · 需要 $${rate}/分钟\n👉 通过 👛 钱包 充值 <b>$25</b>。`,
 fwdBlocked: (number) => `🚫 <b>已阻止</b> — ${number} 是高费率目的地。\n点击 💬 <b>获取支持</b> 申请激活。`,
 fwdNotRoutable: (number) => `⚠️ ${number} 不可达。请检查号码或点击 💬 <b>获取支持</b>。`,
 fwdValidating: '⏳ 验证中...',
 fwdEnterNumber: (rate, walletBal) => {
 let text = `输入含国家代码的号码（例：+14155551234）\n💰 <b>$${rate}/分钟</b>`
 if (walletBal !== undefined) {
 text += ` · 💳 $${walletBal.toFixed(2)}`
 if (walletBal < rate) text += `\n⚠️ 请先通过 👛 钱包 充值 <b>$25</b>。`
 }
 return text
 },
 planNotFound: '找不到套餐。',
 noActivePlans: '📋 <b>我的托管计划</b>\n\n您没有活跃的托管计划。购买一个计划开始使用！',
 noRegisteredDomains: '您没有注册域名。请注册新域名或连接外部域名。',
 selectFromDomains: '从已注册的域名中选择：',
 selectDomainFromList: '请从列表中选择域名。',
 enterValidDomain: '请输入有效的域名（例：example.com）。',
 enterCouponCode: '输入优惠码：',
 invalidCoupon: '优惠码无效。请重试或点击跳过。',
 couponAlreadyUsed: '优惠码已使用。请换一个或点击跳过。',
 couponUsedToday: '⚠️ 您今天已使用过此优惠码。',
 keyboardRefreshed: '键盘已刷新！请选择一个选项：',
 supportEnded: '✅ 支持会话已结束。感谢您的联系！',
 noSupportSession: '没有活跃的支持会话。',
 supportMsgReceived: '✉️ 消息已收到！支持人员将尽快回复您。',
 supportMsgSent: '✉️ 消息已发送至支持团队，我们将尽快回复。',
 someIssue: '出现问题',
 dbConnecting: '数据库连接中，请稍后重试',
 chooseValidDomain: '请选择有效的域名',
 dnsCustomOnly: 'DNS记录由您的自定义域名服务器管理。您只能更新域名服务器或切换DNS提供商。',
 noDeleteRecords: '没有可删除的记录。域名服务器记录只能更新。',
 invalidSrvFormat: '格式无效。请使用 <b>_service._protocol</b>（例：_sip._tcp）：',
 insufficientBalance: (usdBal, price) => `⚠️ 钱包余额不足。您有 $${usdBal}，需要 $${price}。\n请先充值。`,
 leadSelectMetro: (target) => `📍 选择 <b>${target}</b> 的城市区域：\n\n选择"所有城市"以获得最大覆盖。`,
 leadSelectArea: (target, city) => `📞 选择 <b>${target}</b> — <b>${city}</b> 的区号：\n\n"混合区号"提供最大号码池。`,
 leadRequestCustom: '📝 <b>自定义线索请求</b>\n\n告诉我们您想要哪个机构或公司的线索。\n我们提供经过验证的真实号码：',
 leadCustomCity: (target) => `🏙️ 您想要哪个城市的线索？\n\n目标：<b>${target}</b>\n\n输入城市名或"全国"：`,
 leadCustomDetails: (target, city) => `📋 其他详细信息？\n\n目标：<b>${target}</b>\n区域：<b>${city}</b>\n\n输入详情或"无"跳过：`,
 leadAllCities: '所有城市',
 leadNationwide: '全国',
 leadNone: '无',
 leadRequestTarget: '📝 自定义目标请求',
 noPendingLeads: '📝 没有待处理的线索请求。',
 backupCreated: '备份创建成功。',
 dataRestored: '数据恢复成功。',
 vpsRefundFailed: (currency, amount, error) => `❌ <b>VPS 部署失败</b>\n\n✅ 已退款 ${currency}${amount}。\n\n错误：${error}`,
 shortenerConflict: (domain, plan) => `❌ 无法激活 — <b>${domain}</b> 有活跃的托管计划（<b>${plan}</b>）。请使用其他域名。`,
 shortenerLinked: (domain) => `✅ <b>${domain}</b> 已关联到短链接。DNS传播约24小时。`,
 shortenerError: (domain, error) => `❌ 短链接激活错误 <b>${domain}</b>：${error}`,
 domainSearching: (domain) => `🔍 搜索 ${domain} 的可用性...`,
 domainNotAvailable: (domain) => `❌ <b>${domain}</b> 不可用。`,
 domainSearchAlts: (baseName) => `🔍 搜索 <b>${baseName}</b> 的替代方案...`,
 domainAltsFound: (altList) => `✅ 可用替代方案：\n\n${altList}\n\n输入域名检查：`,
 dnsLinkError: (domain, error) => `❌ 无法关联 <b>${domain}</b>：${error}`,
 dnsSaveError: (domain, error) => `❌ DNS错误 <b>${domain}</b>：${error}`,
 selectProceedOrCancel: '请选择"继续"或"取消"。',

 // ── Email Blast i18n ──
 ebSendBlast: '📤 发送群发邮件',
 ebMyCampaigns: '📬 我的活动',
 ebAdminPanel: '⚙️ 管理面板',
 ebCancelBtn: '❌ 取消',
 ebCancelled: '❌ 已取消。',
 ebUploadCsvTxt: '📎 请上传 CSV/TXT 文件或粘贴电子邮件地址（每行一个）。',
 ebUploadCsvOnly: '❌ 请上传 <b>.csv</b> 或 <b>.txt</b> 文件。',
 ebUploadHtmlFile: '📎 请上传 <b>.html</b> 文件，或点击 ❌ 取消重新开始。',
 ebTypeOrUpload: '📝 请输入您的邮件内容或上传 HTML 文件。',
 ebEnterSubject: '✏️ 输入新的<b>主题</b>行：',
 ebChooseTextOrHtml: '请选择："📝 输入纯文本" 或 "📎 上传 HTML"',
 ebTypeText: '📝 输入纯文本',
 ebUploadHtml: '📎 上传 HTML',
 ebInvalidEmail: '❌ 无效的电子邮件地址。请输入有效邮箱（例如：you@gmail.com）：',
 ebFailedReadHtml: '❌ 无法读取 HTML 文件。请重试或上传其他文件。',
 ebBundleNotFound: '❌ 未找到套餐。',
 ebCampaignNotFound: '❌ 未找到活动。',
 ebTestSending: (addr) => `⏳ 正在通过 Brevo 发送测试邮件到 <b>${addr}</b>...`,
 ebAddDomainBtn: '➕ 添加域名',
 ebRemoveDomainBtn: '❌ 移除域名',
 ebDashboardBtn: '📊 仪表盘',
 ebManageDomainsBtn: '🌐 管理域名',
 ebManageIpsBtn: '🖥️ 管理IP和预热',
 ebPricingBtn: '💰 定价设置',
 ebSuppressionBtn: '🚫 屏蔽列表',
 ebAddIpBtn: '➕ 添加IP',
 ebPauseIpBtn: '⏸ 暂停IP',
 ebResumeIpBtn: '▶️ 恢复IP',
 ebAdminPanelTitle: '⚙️ <b>邮件管理面板</b>',
 ebNoDomains: '📭 未配置域名。',
 ebDomainRemoved: (d) => `✅ 域名 <b>${d}</b> 已成功移除。\n\nDNS 记录已清理。`,
 ebDomainRemoveFailed: (err) => `❌ 移除失败：${err}`,
 ebInvalidDomain: '❌ 无效的域名。请输入有效域名（例如 example.com）',
 ebInvalidIp: '❌ 无效的IP地址。请输入有效的 IPv4（例如 1.2.3.4）',
 ebSettingUpDomain: (d) => `⏳ 正在设置 <b>${d}</b>...\n\n创建 DNS 记录，生成 DKIM 密钥...`,
 ebNoActiveIps: '没有活跃的IP可以暂停。',
 ebNoPausedIps: '没有已暂停的IP。',
 ebIpPaused: (ip) => `⏸ IP ${ip} 已暂停。`,
 ebIpResumed: (ip) => `▶️ IP ${ip} 已恢复。`,
 ebRateUpdated: (rate) => `✅ 费率已更新为 <b>$${rate}/封</b> （$${(rate * 500).toFixed(0)}/500封）`,
 ebMinUpdated: (min) => `✅ 最低邮件数已更新为 <b>${min}</b>`,
 ebInvalidRate: '❌ 无效。请输入数字，例如 0.10',
 ebInvalidMin: '❌ 无效。请输入数字。',
 ebSelectIpDomain: (ip) => `🖥️ 将IP <b>${ip}</b> 分配到哪个域名？`,

 // ── Audio Library / IVR i18n ──
 audioLibTitle: '🎵 <b>音频库</b>',
 audioLibEmpty: '🎵 <b>音频库</b>\n\n您没有已保存的音频文件。\n\n上传音频文件（MP3、WAV、OGG）用于 IVR 活动。',
 audioLibEmptyShort: '🎵 <b>音频库</b>\n\n没有音频文件。上传一个开始使用。',
 audioUploadBtn: '📎 上传音频',
 audioUploadNewBtn: '📎 上传新音频',
 audioUseTemplateBtn: '📝 使用 IVR 模板',
 audioSelectOption: '请选择一个选项：',
 audioSelectIvr: '选择 IVR 音频：',
 audioReceived: (size) => `✅ 音频已接收！(${size} KB)\n\n为其命名：`,
 audioReceivedShort: '✅ 音频已接收！\n\n请命名：',
 audioSaved: (name) => `✅ 音频已保存为：<b>${name}</b>\n\n您现在可以在 IVR 活动中使用它！`,
 audioDeleted: (name) => `✅ 已删除：<b>${name}</b>`,
 audioGenFailed: (err) => `❌ 音频生成失败：${err}`,
 audioFailedSave: '❌ 无法保存音频问候。请重试。',
 audioMaxImages: '📸 最多5张图片。点击 ✅ 完成上传 继续。',

 // ── Common i18n ──
 chooseOption: '请选择一个选项：',
 refreshStatusBtn: '🔄 刷新状态',
 cancelRefundBtn: '❌ 取消并退款',
 dbConnectRetry: '数据库正在连接中，请稍后重试',
 nsCannotAdd: '无法添加域名服务器记录。使用<b>更新 DNS 记录</b>来更改域名服务器。',
 noSupportSession: '没有活跃的支持会话。',
 noPendingLeads: '📝 没有待处理的潜在客户请求。',
 invalidAmountPositive: '⚠️ 金额必须是正数。',

 // ── Marketplace ──
 mpHome: '🏪 <b>NOMADLY 市场</b>\n\n💰 <b>出售你的数字商品</b> — 60秒发布，即时收款\n🛍️ <b>发现独家优惠</b> — 经验证的卖家，真实交易\n\n🔒 所有购买<b>必须使用</b> @Lockbaybot <b>托管</b>\n⚠️ 切勿直接向卖家或通过卖家的机器人付款 — 仅限托管。\n\n👇 准备好赚钱或购物了吗？',
 mpBrowse: '🔥 浏览优惠',
 mpListProduct: '💰 开始出售',
 mpMyConversations: '💬 我的对话',
 mpMyListings: '📦 我的商品',
 mpAiHelper: '🤖 AI助手',
 mpAiHelperPrompt: '🤖 <b>市场AI助手</b>\n\n询问我有关购买、出售、托管或市场安全的任何问题。\n\n在下方输入您的问题，或点击 ↩️ 返回。',
 mpAiThinking: '🤖 思考中...',
 mpAiScamWarning: '🚨 <b>AI安全警报</b>\n\n⚠️ 此消息可能包含可疑的付款请求。请记住：\n\n🔒 <b>始终使用 @Lockbaybot 托管</b>\n❌ 切勿通过PayPal、CashApp、加密货币或电汇付款\n📢 如果您感到不安全，请输入 /report\n\n您的安全是我们的首要任务。',
 mpUploadImages: '📸 上传产品图片（1-5张）。\n逐张发送。完成后点击 ✅ 上传完成。',
 mpDoneUpload: '✅ 上传完成',
 mpEnterTitle: '📝 输入产品标题（最多100个字符）：',
 mpEnterDesc: '📄 输入产品描述（最多500个字符）：',
 mpEnterPrice: '💰 设置价格（$20 - $5,000 美元）：',
 mpSelectCategory: '🏷️ 选择类别：',
 mpPreview: (title, desc, price, category, imageCount) =>
 `✅ <b>产品预览</b>\n\n📦 <b>${title}</b>\n📄 ${desc}\n💰 <b>$${Number(price).toFixed(2)}</b>\n📂 ${category}\n📸 ${imageCount} 张图片\n\n🔒 通过 @Lockbaybot 托管保护`,
 mpPublish: '✅ 发布',
 mpCancel: '❌ 取消',
 mpEditProduct: '✏️ 编辑',
 mpRemoveProduct: '❌ 删除商品',
 mpMarkSold: '✅ 标记为已售',
 mpProductPublished: '🎉 您的商品已上线！\n\n买家现在可以发现它。\n\n⚠️ <b>提醒：</b>所有销售必须通过 @Lockbaybot 托管。\n\n💡 <b>快速出售技巧：</b>\n• 快速回复咨询\n• 添加清晰的照片和详细描述\n• 设定有竞争力的价格',
 mpProductRemoved: '✅ 商品已删除。',
 mpProductSold: '✅ 商品已标记为已售。',
 mpMaxListings: '❌ 您已达到10个活跃商品的上限。请删除或标记为已售。',
 mpPriceError: '❌ 价格必须在 $20 到 $5,000 美元之间。',
 mpNoImage: '📸 请至少上传一张产品图片。',
 mpImageAsPhoto: '📸 请以照片形式发送，而不是文件。',
 mpOwnProduct: '❌ 您不能咨询自己的商品。',
 mpNoProducts: '📭 未找到产品。稍后再来看看！',
 mpNoListings: '📭 您还没有商品。',
 mpNoConversations: '📭 没有活跃的对话。',
 mpChatStartBuyer: (title, price) =>
 `💬 您正在与卖家讨论 <b>${title}</b>（$${price}）\n\n⚠️ <b>必须使用托管</b> — 输入 /escrow 通过 @Lockbaybot 安全支付\n❌ 切勿直接向卖家或通过其机器人付款。\n\n💡 购买前请索要详情或证明。\n发送 /done 结束聊天。`,
 mpChatStartSeller: (title) =>
 `💬 🔔 一位买家对 <b>${title}</b> 感兴趣！\n🔒 通过 @Lockbaybot 托管保护\n\n💡 提示：快速回复 — 响应快的卖家成交更多。\n在下方回复。发送 /done 结束聊天。`,
 mpMessageSent: '✅ 消息已发送',
 mpSellerChatReady: (title) =>
 `💬 您已进入 <b>${title}</b> 的聊天。\n在下方输入回复。发送 /done 退出, /escrow 开始托管, /price XX 建议价格。`,
 mpBuyerSays: (msg) => `💬 <b>买家：</b> ${msg}`,
 mpSellerSays: (msg) => `💬 <b>卖家：</b> ${msg}`,
 mpChatEnded: '💬 对话已结束。双方已收到通知。',
 mpChatEndedNotify: (title) => `💬 关于 <b>${title}</b> 的对话已关闭。`,
 mpChatInactive: (title) => `💬 关于 <b>${title}</b> 的对话因不活跃已关闭。`,
 mpSellerOffline: '⏳ 卖家24小时未回复。您可以浏览其他商品。',
 mpRateLimit: '⚠️ 消息限制已达到。请稍后再发送。',
 mpOnlyTextPhoto: '⚠️ 市场聊天中只能发送文字和照片。',
 mpPaymentWarning: '🚨 <b>警告：检测到直接付款请求！</b>\n\n❌ 切勿直接向卖家或通过其机器人付款。\n🔒 通过 @Lockbaybot 托管是<b>强制性的</b>。\n📢 如感到不安全，请输入 /report。',
 mpEscrowMsg: (title, price, sellerRef) =>
 `🔒 <b>托管 — 强制性购买</b>\n\n📦 产品：<b>${title}</b>\n💰 价格：<b>$${Number(price).toFixed(2)}</b>\n👤 卖家：<b>${sellerRef}</b>\n\n1. 打开 @Lockbaybot\n2. 与 <b>${sellerRef}</b> 创建 <b>$${Number(price).toFixed(2)}</b> 的托管\n3. 双方确认\n\n⚠️ 切勿在托管之外或通过卖家的机器人付款`,
 mpPriceSuggest: (role, amount) => `💰 <b>${role}</b> 建议：<b>$${amount}</b>`,
 mpPriceUsage: '用法：/price 50 建议 $50',
 mpPriceInvalid: '❌ 金额无效。必须在 $20 到 $5,000 之间。',
 mpReported: '✅ 举报已提交。管理员将审查此对话。',
 mpChatMode: '⚠️ 您正在市场聊天中。发送 /done 退出。',
 mpExistingConv: '💬 您已有关于此产品的活跃对话。恢复中...',
 mpAllCategories: '📋 所有类别',
 mpEditWhat: '✏️ 您想编辑什么？',
 mpEditTitle: '📝 编辑标题',
 mpEditDesc: '📄 编辑描述',
 mpEditPrice: '💰 编辑价格',
 mpTitleUpdated: '✅ 标题已更新。',
 mpDescUpdated: '✅ 描述已更新。',
 mpPriceUpdated: '✅ 价格已更新。',
 mpListingRemoved: '📦 [商品已删除]',
 mpSellerStats: (sales, since) => `⭐ 卖家：${sales} 笔交易 | 加入于 ${since}`,
 mpProductCard: (title, price, category, sellerStats) =>
 `🏷️ <b>${title}</b>\n💰 <b>$${Number(price).toFixed(2)}</b> · ${category}\n${sellerStats}\n🔒 ⚠️ 必须使用托管 — 仅通过 @Lockbaybot 付款`,
 mpProductDetail: (title, desc, price, category, sellerStats, listedAgo) =>
 `📦 <b>${title}</b>\n\n📄 ${desc}\n\n💰 价格：<b>$${Number(price).toFixed(2)}</b>\n📂 ${category}\n${sellerStats}\n📅 发布：${listedAgo}\n\n🔒 <b>必须使用托管</b>\n仅通过 @Lockbaybot 托管付款。切勿直接向卖家或通过其机器人付款。`,
 mpMyListingsHeader: (count, max) => `📦 <b>我的商品</b>（${count}/${max}）`,
 mpConvHeader: '💬 <b>我的对话</b>',
 mpConvItem: (title, role, lastMsg) => `💬 <b>${title}</b>（${role}）— ${lastMsg}`,
 mpDoneCmd: '/done',
 mpEscrowCmd: '/escrow',
 mpPriceCmd: '/price',
 mpReportCmd: '/report',
 mpEnteredChat: (title, price) => `💬 您已进入 <b>${title}</b>（$${price}）的聊天\n发送 /done 退出，/escrow 开始托管，/price XX 建议价格。`,
 mpResumedChat: (title, price, role) => `💬 恢复聊天：<b>${title}</b>（$${price}）— 您是${role}\n⚠️ <b>必须使用托管</b> — 仅通过 @Lockbaybot 付款。切勿直接向卖家或通过其机器人付款。\n\n发送 /done 退出，/escrow 开始托管，/price XX 建议价格。`,
 mpBuyerPhotoCaption: '💬 买家发送了一张照片：',
 mpSellerPhotoCaption: '💬 卖家发送了一张照片：',
 mpChatClosedReset: (title) => `💬 关于 <b>${title}</b> 的对话已被对方关闭。您已返回市场。`,
 mpSellerBusy: (title) => `🆕 <b>${title}</b> 有新的咨询！准备好后点击下方按钮回复。`,
 mpCatDigitalGoods: '💻 数字商品',
 mpCatBnkLogs: '🏦 银行日志',
 mpCatBnkOpening: '🏧 银行开户',
 mpCatTools: '🔧 工具',
 adm_1: '📸 Maximum 5 images. Tap ✅ 完成 Uploading to continue.',
 adm_10: (orderId, buyerName, chatId, product) => `✅ Order <code>${orderId}</code> delivered to ${buyerName} (${chatId}).\nProduct: ${product}`,
 adm_11: (message) => `❌ 错误 delivering order: ${message}`,
 adm_12: (TG_CHANNEL) => `👆 <b>Ad Preview</b>\n\nType <b>/ad post</b> to send this to ${TG_CHANNEL}`,
 adm_13: (totalDead, chatNotFound, userDeactivated, botBlocked, other) => `📊 <b>Dead Users Report</b>\n\nTotal marked dead: <b>${totalDead}</b>\n• chat_not_found: ${chatNotFound}\n• user_deactivated: ${userDeactivated}\n• bot_blocked: ${botBlocked}\n• other: ${other}\n\nCommands:\n<code>/resetdead all</code> — Clear ALL dead entries\n<code>/resetdead blocked</code> — Clear only bot_blocked\n<code>/resetdead notfound</code> — Clear only chat_not_found`,
 adm_14: '❌ Usage: /resetdead all | blocked | notfound',
 adm_15: (modifiedCount, sub) => `✅ Reset <b>${modifiedCount}</b> dead user entries (${sub}).`,
 adm_16: '🔄 Running win-back campaign scan...',
 adm_17: (sent, errors) => `✅ Win-back complete: ${sent} sent, ${errors} errors`,
 adm_18: '✅ Ad posted to channel!',
 adm_19: '❌ Channel ID not configured.',
 adm_2: (length) => `📸 Image ${length}/5 received. Send more or tap ✅ 完成 Uploading.`,
 adm_20: '📦 否 pending digital product orders.',
 adm_21: (message) => `❌ 错误: ${message}`,
 adm_22: (message) => `错误 fetching requests: ${message}`,
 adm_23: '⚠️ Usage: /credit <@username or chatId> <amount>\\n\\nExamples:\\n<code>/credit @john 50</code>\\n<code>/credit 5590563715 25.50</code>',
 adm_24: '⚠️ Amount must be a positive number.',
 adm_25: (userRef) => `⚠️ User <b>${userRef}</b> not found.`,
 adm_26: (toFixed, targetName, targetChatId, v3) => `✅ Credited <b>$${toFixed} USD</b> to <b>${targetName}</b> (${targetChatId})\n\n💳 Their balance: $${v3} USD`,
 adm_27: (message) => `❌ 错误 crediting wallet: ${message}`,
 adm_28: (WELCOME_BONUS_USD) => `🎁 Starting gift of $${WELCOME_BONUS_USD} to all users who haven't received it yet...\nThis may take a while.`,
 adm_29: (gifted, skipped, failed, total) => `✅ <b>Gift Complete!</b>\n\n🎁 Gifted: ${gifted}\n⏭ Skipped (already had): ${skipped}\n❌ 失败: ${failed}\n📊 Total users: ${total}`,
 adm_3: '⚠️ Usage: /reply <chatId> <message>',
 adm_30: (message) => `❌ Gift failed: ${message}`,
 adm_31: '⚠️ Usage: /bal <@username or chatId>\\n\\nExamples:\\n<code>/bal @john</code>\\n<code>/bal 7193881404</code>',
 adm_32: (userRef) => `⚠️ User <b>${userRef}</b> not found.`,
 adm_33: (message) => `❌ 错误 checking balance: ${message}`,
 adm_34: '⚠️ Usage: /mpban <@username or chatId> [reason]\\n\\nExamples:\\n<code>/mpban @john spamming</code>\\n<code>/mpban 8317455811 policy violation</code>',
 adm_35: (userRef) => `⚠️ User <b>${userRef}</b> not found.`,
 adm_36: (targetName, targetChatId, listingsRemoved, reason) => `🚫 <b>市场 Ban Applied</b>\n\n👤 User: <b>${targetName}</b> (${targetChatId})\n📦 Listings removed: <b>${listingsRemoved}</b>\n📝 Reason: <i>${reason}</i>\n\nUser can no longer access or post in marketplace.`,
 adm_37: (message) => `❌ 错误: ${message}`,
 adm_38: '⚠️ Usage: /mpunban <@username or chatId>\\n\\nExamples:\\n<code>/mpunban @john</code>\\n<code>/mpunban 8317455811</code>',
 adm_39: (userRef) => `⚠️ User <b>${userRef}</b> not found.`,
 adm_4: (targetName) => `✅ Reply sent to ${targetName}`,
 adm_40: (targetName, targetChatId) => `✅ <b>市场 Ban Removed</b>\n\n👤 User: <b>${targetName}</b> (${targetChatId})\n\nUser can now access marketplace again.`,
 adm_41: (targetName) => `ℹ️ User <b>${targetName}</b> was not banned from marketplace.`,
 adm_42: (message) => `❌ 错误: ${message}`,
 // === Nested Template Keys ===
 cp_nested_1: (count, numberList) => `📞 <b>批量：${count} 个号码</b>\n${numberList}\n\n选择IVR模板类别：`,
 cp_nested_2: (icon, firstPh, desc, hint) => `\n${icon} <b>[${firstPh}]</b> — ${desc}\n\n<i>${hint}</i>`,
 cp_nested_3: (icon, firstPh, desc, hint) => `${icon} <b>[${firstPh}]</b> — ${desc}\n\n<i>${hint}</i>`,
 cp_nested_4: (currentPh, value, icon, nextPh, desc, hint) => `✅ ${currentPh}: <b>${value}</b>\n\n${icon} <b>[${nextPh}]</b> — ${desc}\n\n<i>${hint}</i>`,
 cp_nested_5: (target, msg) => `❌ 批量呼叫 ${target} 失败：${msg}`,
 cp_nested_6: (refundAmt, walletLine) => `💰 <b>${refundAmt}</b> 已退还至您的钱包。\n${walletLine}`,
 cp_nested_7: (cleanedMsg, balMsg) => `🔄 <b>全新开始！</b>\n\n${cleanedMsg}${balMsg}\n\n您现在可以重新开始购买电话号码。`,
 cp_nested_8: (msg) => `❌ 赢回错误：${msg}`,
 cp_nested_9: (target, city, detailsLine) => `✅ <b>请求已提交！</b>\n\n🎯 目标：<b>${target}</b>\n🏙️ 地区：<b>${city}</b>${detailsLine}\n\n我们的团队将审核您的请求。谢谢！`,
 cp_nested_hint_default: (ph) => `输入 [${ph}] 的值`,
 cp_nested_cleared: (count, refunded) => `✅ 清除了 ${count} 个被拒绝的验证\n💰 $${refunded} 已退还至钱包\n`,
 // === Voice Service ===
 vs_callDisconnectedWallet: (rate, connFee) => `🚫 <b>通话断开</b> — 余额不足（需要$\${rate}/分钟 + $\${connFee}连接费）。通过 👛 钱包充值。`,
 vs_callDisconnectedExhausted: '🚫 <b>通话断开</b> — 余额耗尽。\n通过 👛 钱包充值。',
 vs_outboundCallFailed: (from, to, reason) => `🚫 <b>外呼失败</b>\n📞 \${from} → \${to}\n原因：\${reason}`,
 vs_planMinutesExhausted: (phone, used, limit, overage) => `⚠️ <b>套餐分钟耗尽</b>\n\n📞 \${phone}\n已用：<b>\${used}/\${limit}</b> 分钟\n\${overage}`,
 vs_planSmsExhausted: (phone, used, limit) => `⚠️ <b>套餐短信耗尽</b>\n\n📞 \${phone}\n已用：<b>\${used}/\${limit}</b> 条来电短信`,
 vs_orphanedNumber: (to, from) => `⚠️ <b>孤立号码警报</b>\n\n📞 <code>\${to}</code> 收到来自 <code>\${from}</code> 的来电\n\n❌ 数据库中无所有者 — 来电拒绝。`,
 vs_incomingCallBlocked: (to, from) => `🚫 <b>来电拦截 — 余额为空</b>\n\n📞 \${to}\n👤 来电者：\${from}`,
 vs_overageActive: (charged, rateInfo) => `💰 <b>超额使用</b> — 套餐分钟耗尽。\${charged}（\${rateInfo}）`,
 vs_callEndedExhausted: (elapsed) => `🚫 <b>通话结束</b> — 分钟+余额均耗尽。\n⏱️ ~\${elapsed} 分钟。请充值或升级套餐。`,
 vs_outboundCallBlocked: (from, to, reason) => `🚫 <b>外呼拦截</b>\n📞 \${from} → \${to}\n原因：\${reason}`,
 vs_sipCallBlocked: (rate, connFee) => `🚫 <b>SIP呼叫拦截</b> — 余额不足（需要$\${rate}/分钟 + $\${connFee}连接费）。通过 👛 钱包充值。`,
 vs_freeSipTestCall: (from, to) => `📞 <b>免费SIP测试呼叫</b>\n发起：\${from}\n接收：\${to}`,
 vs_sipOutboundCall: (from, to, planLine) => `📞 <b>SIP外呼</b>\n发起：\${from}\n接收：\${to}\n\${planLine}`,
 vs_lowBalance: (bal, estMin) => `⚠️ <b>余额不足</b> — $\${bal}（约\${estMin}分钟）。通过 👛 钱包充值 <b>$25</b>。`,
 vs_forwardingBlocked: (bal, rate) => `🚫 <b>转接拦截</b> — 余额 $\${bal}（需要$\${rate}/分钟）。通过 👛 钱包充值。`,
 vs_ivrForwardBlocked: (phone, forwardTo, bal) => `🚫 <b>IVR转接拦截 — 余额为空</b>\n\n📞 \${phone}\n📲 转接至：\${forwardTo}\n💰 余额：$\${bal}`,
 vs_lowBalanceIvr: (bal, estMin) => `⚠️ <b>余额不足</b> — $\${bal}（约\${estMin}分钟IVR）。通过 👛 钱包充值。`,
 vs_callForwarded: (to, forwardTo, from, duration, planLine, time) => `📞 <b>来电已转接</b>\n\n📞 \${to} → 📲 \${forwardTo}\n👤 \${from}\n⏱️ \${duration}\n\${planLine}\n🕐 \${time}`,
 vs_forwardFailed: (to, forwardTo, from, time) => `❌ <b>转接失败 — 无应答</b>\n\n📞 \${to} → 📲 \${forwardTo}\n👤 来电者：\${from}\n📲 \${forwardTo} 未接听\n🕐 \${time}`,
 vs_sipCallFailed: (from, to, time) => `❌ <b>SIP呼叫失败 — 转接无应答</b>\n\n📞 发起：\${from}\n📲 接收：\${to}\n🕐 \${time}`,
 vs_sipCallEnded: (from, to, duration, planLine, time) => `📞 <b>SIP通话结束</b>\n\n📞 发起：\${from}\n📲 接收：\${to}\n⏱️ \${duration}\n\${planLine}\n🕐 \${time}`,
 vs_freeTestCallEnded: (from, to, duration, time) => `📞 <b>免费测试通话结束</b>\n\n📞 发起：\${from}\n📲 接收：\${to}\n⏱️ \${duration}\n🕐 \${time}`,
 vs_missedCall: (to, from, time) => `📞 <b>未接来电</b>\n\n📞 号码：\${to}\n👤 来自：\${from}\n🕐 \${time}`,
 vs_ivrCallRouted: (to, from, digit, forwardTo, time) => `📞 <b>IVR来电路由</b>\n\n📞 号码：\${to}\n👤 来自：\${from}\n按键：<b>\${digit}</b> → 转接至 \${forwardTo}\n🕐 \${time}`,
 vs_ivrCall: (to, from, digit, time) => `📞 <b>IVR来电</b>\n\n📞 号码：\${to}\n👤 来自：\${from}\n按键：<b>\${digit}</b> → 播放消息\n🕐 \${time}`,
 vs_newVoicemail: (to, from, duration, time) => `🎙️ <b>新语音信箱</b>\n\n📞 号码：\${to}\n👤 来自：\${from}\n⏱️ 时长：\${duration}\n🕐 \${time}`,
 vs_callRecording: (to, from, duration, time) => `🔴 <b>通话录音</b>\n\n📞 号码：\${to}\n👤 来自：\${from}\n⏱️ 时长：\${duration}\n🕐 \${time}`,
 vs_listen: '收听',
 adm_error_prefix: '❌ 错误：',
 dom_confirm_prompt: '确认？',
 adm_5: '⚠️ Usage: /close <chatId>',
 adm_6: (targetName) => `✅ Closed support session for ${targetName}`,
 adm_7: '⚠️ Usage: /deliver <orderId> <product details/credentials>',
 adm_8: (orderId) => `⚠️ Order <code>${orderId}</code> not found.`,
 adm_9: (orderId) => `⚠️ Order <code>${orderId}</code> was already delivered.`,
 cp_1: '⚠️ NGN存款暂时不可用 (汇率服务中断). 请尝试加密货币.',
 cp_10: (TRIAL_CALLER_ID) => `📢 <b>快速IVR呼叫 — 免费试用</b>\n\n🎁 您有 <b>1 次免费试用呼叫！</b>\n📱 来电显示：<b>${TRIAL_CALLER_ID}</b>（共享）\n\n用自动IVR消息呼叫一个号码。\n\n输入要呼叫的电话号码（含国家代码）：\n<i>示例：+8613812345678</i>`,
 cp_100: '🎚 <b>选择语速</b>:',
 cp_101: '❌ 无效 speed. 输入 a number between <b>0.25</b> and <b>4.0</b>:\\n<i>示例: 0.8 or 1.3</i>',
 cp_102: '请从按钮中选择速度：',
 cp_103: (voiceName, speedLabelDisplay) => `🎤 语音: <b>${voiceName}</b> | 🎚 速度: <b>${speedLabelDisplay}</b>\n\n⏳ 生成音频预览...`,
 cp_104: (message) => `❌ 音频生成失败.\n\n💡 <b>Tip:</b> Try selecting <b>ElevenLabs</b> as the voice provider — it tends to be more reliable.\n\n<i>错误: ${message}</i>`,
 cp_105: '🎙 <b>选择 语音提供商</b>\\n\\nChoose your TTS engine:',
 cp_106: '🎙 <b>选择 语音提供商</b>\\n\\nChoose your TTS engine:',
 cp_107: '🎚 <b>选择语速</b>\\n\\nChoose how fast the voice speaks:',
 cp_108: (holdMusic, v1) => `🎵 Hold Music: <b>${holdMusic}</b>\n${v1}`,
 cp_109: 'What would you like to do?',
 cp_11: (buyLabel) => `📞 <b>批量IVR活动</b>\n\n🔒 This feature requires the <b>Pro</b> plan or higher.\n\nGet a Cloud IVR number first!\n\nTap <b>${buyLabel}</b> to get started.`,
 cp_110: '音频 not ready. 请点击 ✅ 确认 instead.',
 cp_111: '⏭ <b>Skipping preview — Ready to call!</b>',
 cp_112: 'Tap <b>✅ 确认</b> to proceed, <b>🎤 Change 语音</b>, or <b>返回</b>.',
 cp_113: 'What would you like to do?',
 cp_114: '🕐 <b>Schedule Call</b>\\n\\nHow many 分钟 from now should the call go out?\\n\\n<i>Examples: 5, 15, 30, 60</i>',
 cp_115: '请输入1到1440分钟之间的数字。',
 cp_116: (targetNumber, minutes, toLocaleTimeString) => `✅ <b>Call Scheduled!</b>\n\n📞 To: ${targetNumber}\n🕐 In: ${分钟} 分钟 (${toLocaleTimeString} UTC)\n\nYou'll be notified when the call is placed.`,
 cp_117: (toFixed, v1) => `⚠️ <b>余额不足</b>\n\n快速IVR呼叫需要最低余额 <b>$${toFixed} USD</b>。\n\n请充值钱包后重试。`,
 cp_118: '🚫 <b>Call Blocked</b>\\n\\nYour phone number is missing sub-account credentials. Please contact support.',
 cp_119: (batchCount, length, target) => `📞 批量 ${batchCount}/${length}: Calling ${target}...`,
 cp_12: '📞 <b>批量IVR活动</b>\\n\\n用自动IVR消息呼叫多个号码。\\n上传联系人CSV并启动活动。\\n\\n📋 格式要求：一列电话号码\\n📱 格式：+[国家代码][号码]\\n\\n选择模板类别或编写自定义脚本：',
 cp_120: '💾 Want to save this as a Quick Dial preset for next time?',
 cp_121: 'Press <b>/yes</b> to place the call or <b>/cancel</b> to abort.',
 cp_122: (presetName) => `✅ 预设「<b>${presetName}</b>」已保存！\n\n下次在快速IVR菜单中选择它即可跳过配置。`,
 cp_123: '🎵 <b>音频 Library</b>\\n\\nNo audio files. Upload one to get started.',
 cp_124: (audioList) => `🎵 <b>音频 Library</b>\n\n${audioList}`,
 cp_125: '选择 an option:',
 cp_126: (audioList) => `🎵 <b>音频 Library</b>\n\n${audioList}`,
 cp_127: '⏳ Downloading and saving audio...',
 cp_128: 'Please send an audio file (MP3, WAV, OGG) or a voice message.',
 cp_129: 'Send me an audio file or voice message:',
 cp_13: '🎵 <b>音频 Library</b>\\n\\nYou have no saved audio files.\\n\\nUpload an audio file (MP3, WAV, OGG) to use in IVR campaigns.',
 cp_130: (name) => `✅ 音频 saved as: <b>${name}</b>\n\nYou can now use it in Bulk IVR Campaigns!`,
 cp_131: '请从列表中选择来电显示。',
 cp_132: (phoneNumber) => `📱 来电显示: <b>${phoneNumber}</b>\n\n📋 <b>Upload 线索 File</b>\n\nSend a text file (.txt or .csv) with one phone number per line.\nOptional: <code>number,name</code> per line.\n\nOr paste the 个号码 directly (one per line):`,
 cp_133: '选择 the 来电显示:',
 cp_134: (message) => `❌ 失败 to read file: ${message}\n\nTry again or paste 个号码 directly.`,
 cp_135: 'Please send a file or paste phone 个号码.',
 cp_136: (errMsg) => `❌ 否 valid phone 个号码 found.${errMsg}\n\nPlease check format: one number per line, with + country code.`,
 cp_137: (maxLeads, length) => `❌ <b>联系人过多！</b>\n\n每个活动最多 <b>${maxLeads}</b> 个号码。\n您上传了 <b>${length}</b> 个号码。\n\n请减少列表后重试。`,
 cp_138: (length, preview, more, errNote, estCost, toFixed) => `✅ <b>已加载 ${length} 个联系人！</b>\n\n${preview}${more}${errNote}\n💰 预估费用：<b>$${toFixed} USD</b>\n\n确认以启动活动。`,
 cp_139: '📋 Send a leads file or paste 个号码:',
 cp_14: (audioList) => `🎵 <b>音频 Library</b>\n\n${audioList}\n\nUpload a new audio or delete an existing one:`,
 cp_140: '🎵 Send an audio file (MP3, WAV, OGG) or voice message:',
 cp_141: '📝 <b>从模板生成音频</b>\\n\\n选择一个模板类别或编写自定义脚本：',
 cp_142: '音频 not found. 选择 from the list.',
 cp_143: (name) => `🎵 音频: <b>${name}</b>\n\n📋 <b>选择 活动 Mode</b>\n\n🔗 <b>Transfer + Report</b> — When lead presses a key, bridge to your phone + always report\n📊 <b>Report Only</b> — Just track who pressed a key, no transfer + always report\n\nBoth modes report full results (who pressed, who hung up, etc.)`,
 cp_144: '选择 an audio file:',
 cp_145: '选择 IVR 音频:',
 cp_146: '⏳ Saving audio...',
 cp_147: (message) => `❌ Upload failed: ${message}`,
 cp_148: 'Send an audio file or voice message:',
 cp_149: (name) => `✅ Saved as: <b>${name}</b>\n\n📋 <b>选择 活动 Mode</b>\n\n🔗 <b>Transfer + Report</b> — Pressing 1 bridges to your phone\n📊 <b>Report Only</b> — Just track responses\n\nBoth modes always report full results.`,
 cp_15: '📞 <b>新IVR呼叫</b>\\n\\n选择呼出号码（来电显示）：',
 cp_150: '选择 IVR 音频:',
 cp_151: '🔗 <b>转接模式</b>\\n\\n输入当目标按下活动键时转接电话的号码：\\n<i>（您的SIP号码或任何电话号码）</i>\\n<i>示例：+8613812345678</i>',
 cp_152: '📊 <b>Report Only</b> — no transfers, just tracking.\\n\\n🔘 <b>选择 活跃 Keys</b>\\n\\nWhich keys should count as a positive response?\\n\\nPick a preset or enter custom digits:',
 cp_153: '选择 a mode:',
 cp_154: '选择 活动 Mode:',
 cp_155: '输入 a valid phone number with + country code.\\n<i>示例: +41791234567</i>',
 cp_156: (clean) => `🔗 Transfer to: <b>${clean}</b>\n\n🔘 <b>选择 活跃 Keys</b>\n\nWhich keys trigger the transfer?\n\nPick a preset or enter custom digits:`,
 cp_157: '输入 the transfer number:',
 cp_158: '选择 活动 Mode:',
 cp_159: '输入 the digits that count as active keys:\\n<i>示例: 1,3,5 or 1 2 3</i>',
 cp_16: '否 presets to delete.',
 cp_160: '请选择预设或输入数字：',
 cp_161: (join) => `🔘 活动按键: <b>${join}</b>\n\n⚡ <b>Set Concurrency</b>\n\nHow many simultaneous calls? (1-20)\nDefault: <b>10</b>`,
 cp_162: '🔘 <b>选择 活跃 Keys</b>',
 cp_163: '输入 at least one digit (0-9):\\n<i>示例: 1,3,5</i>',
 cp_164: (join) => `🔘 活动按键: <b>${join}</b>\n\n⚡ <b>Set Concurrency</b>\n\nHow many simultaneous calls? (1-20)\nDefault: <b>10</b>`,
 cp_165: '选择 IVR 音频:',
 cp_166: '✍️ <b>自定义脚本</b>\\n\\n输入要朗读的消息。\\n在文本中使用「按1」、「按2」等来定义活动按键。\\n\\n<i>示例：您好，这是来自[公司]的消息。要与客服通话，请按1。</i>',
 cp_167: 'Please select a category:',
 cp_168: '选择 a template:',
 cp_169: '选择 a template category:',
 cp_17: '🗑️ <b>删除 Preset</b>\\n\\nSelect a preset to delete:',
 cp_170: (icon, firstPh, description, generated) => `${icon} <b>[${firstPh}]</b> — ${description}\n\nAuto-generated: <b>${generated}</b>\nTap to accept, regenerate, or type your own:`,
 cp_171: (icon, firstPh, description) => `${icon} <b>[${firstPh}]</b> — ${description}\n\n从列表中选择或输入自定义值：`,
 cp_172: (icon, firstPh, description, hint) => `${icon} <b>[${firstPh}]</b> — ${description}\n\n${sp.hint || '选择 or type a number:'}`,
 cp_174: (placeholders) => `输入 value for <b>[${placeholders}]</b>:`,
 cp_175: (join) => `🔘 活动按键: <b>${join}</b>\n\n🎙 <b>选择 语音提供商</b>\n\nChoose your TTS engine:`,
 cp_176: '选择 a template category:',
 cp_177: '请从按钮中选择模板。',
 cp_178: (icon, name, text, join) => `📋 <b>${icon} ${name}</b>\n\n<i>"${text}"</i>\n\n🔘 活动按键: <b>${join}</b>`,
 cp_179: (icon, firstPh, description, generated) => `\n${icon} <b>[${firstPh}]</b> — ${description}\n\nAuto-generated: <b>${generated}</b>\nTap to accept, regenerate, or type your own:`,
 cp_18: (presetName) => `✅ Preset "${presetName}" deleted.`,
 cp_180: (icon, firstPh, description) => `\n${icon} <b>[${firstPh}]</b> — ${description}\n\n从列表中选择或输入自定义值：`,
 cp_181: (icon, firstPh, description, hint) => `\n${icon} <b>[${firstPh}]</b> — ${description}\n\n${sp.hint || '选择 or type a number:'}`,
 cp_183: (placeholders) => `\nEnter value for <b>[${placeholders}]</b>:`,
 cp_184: '🎙 <b>选择 语音</b>:',
 cp_185: '选择 a template category:',
 cp_186: (icon, currentPh, generated) => `${icon} <b>[${currentPh}]</b> — regenerated: <b>${generated}</b>\nTap to accept, regenerate, or type your own:`,
 cp_187: (currentPh) => `✍️ Type your custom value for <b>[${currentPh}]</b>:`,
 cp_188: (currentPh) => `✍️ Type the callback number for <b>[${currentPh}]</b>:\n<i>示例: +12025551234</i>`,
 cp_189: (currentPh, value, icon, nextPh, description, generated) => `✅ ${currentPh}: <b>${value}</b>\n\n${icon} <b>[${nextPh}]</b> — ${description}\n\nAuto-generated: <b>${generated}</b>\nTap to accept, regenerate, or type your own:`,
 cp_19: 'Preset not found.',
 cp_190: (currentPh, value, icon, nextPh, description) => `✅ ${currentPh}：<b>${value}</b>\n\n${icon} <b>[${nextPh}]</b> — ${description}\n\n从列表中选择或输入自定义值：`,
 cp_191: (currentPh, value, icon, nextPh, description, hint) => `✅ ${currentPh}: <b>${value}</b>\n\n${icon} <b>[${nextPh}]</b> — ${description}\n\n${nextSp.hint || '选择 or type a number:'}`,
 cp_193: (currentPh, value, nextPh) => `✅ ${currentPh}: <b>${value}</b>\n\nEnter value for <b>[${nextPh}]</b>:`,
 cp_194: '✅ All values filled!\\n\\n🎙 <b>选择 语音提供商</b>\\n\\nChoose your TTS engine:',
 cp_195: '选择 a template category:',
 cp_196: 'Please select a voice provider:',
 cp_197: '🎙 <b>选择 语音</b>:',
 cp_198: '🎙 <b>选择 语音提供商</b>\\n\\nChoose your TTS engine:',
 cp_199: 'Please select a voice:',
 cp_2: (toLocaleString) => `⚠️ 最低存款为 ₦${toLocaleString} (≈ $10 USD). 请输入更高金额.`,
 cp_20: (presetName, currentPlan) => `🔒 <b>预设 "${presetName}" 使用OTP收集</b>，需要 <b>Business</b> 套餐。\n\n您当前的套餐：<b>${currentPlan}</b>\n\n通过 🔄 续费/更换套餐 升级，或使用 🔗 转接模式创建新通话。`,
 cp_200: (name) => `🎤 语音: <b>${name}</b>\n\n🎚 <b>选择语速</b>\n\nChoose how fast the voice speaks:`,
 cp_201: '🎙 <b>选择 语音提供商</b>\\n\\nChoose your TTS engine:',
 cp_202: '✍️ 输入 a custom speed multiplier:\\n<i>Examples: 0.6 (very slow), 0.9 (slightly slow), 1.2 (faster), 1.5 (very fast)\\nRange: 0.25 to 4.0</i>',
 cp_203: '🎚 <b>选择语速</b>:',
 cp_204: '❌ 无效 speed. 输入 a number between <b>0.25</b> and <b>4.0</b>:\\n<i>示例: 0.8 or 1.3</i>',
 cp_205: '请从按钮中选择速度：',
 cp_206: (voiceName, speedLabel) => `🎤 语音: <b>${voiceName}</b> | 🎚 速度: <b>${speedLabel}</b>\n\n⏳ 生成中 audio...`,
 cp_207: (message) => `❌ 音频生成失败.\n\n💡 <b>Tip:</b> Try selecting <b>ElevenLabs</b> as the voice provider — it tends to be more reliable.\n\n<i>错误: ${message}</i>`,
 cp_208: '选择 a template category:',
 cp_209: '🎙 <b>选择 语音提供商</b>\\n\\nChoose your TTS engine:',
 cp_21: (presetName, callerId, templateName, voiceName) => `💾 <b>Loaded Preset: ${presetName}</b>\n📱 From: ${callerId}\n🏢 Template: ${templateName}\n🎙 语音: ${voiceName}\n\nEnter the number to call (or multiple separated by commas):\n<i>示例: +12025551234</i>\n<i>批量: +12025551234, +12025555678</i>`,
 cp_210: '🎚 <b>选择语速</b>\\n\\nChoose how fast the voice speaks:',
 cp_211: '❌ 否 audio generated. Try again.',
 cp_212: (audioName, join) => `✅ 音频 saved: <b>${audioName}</b>\n🔘 活动按键 (from template): <b>${join}</b>\n\n📋 <b>选择 活动 Mode</b>\n\n🔗 <b>Transfer + Report</b> — When lead presses a key, bridge to your phone + always report\n📊 <b>Report Only</b> — Just track who pressed a key, no transfer + always report`,
 cp_213: 'Tap <b>✅ Use This 音频</b> or <b>🎤 Change 语音</b>.',
 cp_214: '🔘 <b>选择 活跃 Keys</b>',
 cp_215: '输入 a number between 1 and 20:',
 cp_216: 'Set concurrency (1-20):',
 cp_217: '❌ Missing campaign data. Please start over.',
 cp_218: '⏳ Creating campaign...',
 cp_219: (errorvoice) => `❌ 失败 to start: ${errorvoice}`,
 cp_22: '否 eligible caller ID found.',
 cp_220: '活动 is running! You\'ll see progress updates here.',
 cp_221: (messagevoice) => `❌ 活动 launch failed: ${messagevoice}`,
 cp_222: 'Tap 🚀 Launch 活动 or ↩️ 返回.',
 cp_223: 'Tap for options:',
 cp_224: '活动 in progress. Use the button below:',
 cp_225: '🛒 <b>选择 套餐:</b>',
 cp_226: '🌍 <b>All Available Countries</b>\\n\\nSelect a country:',
 cp_227: (location, numberLines) => `📱 <b>Available Numbers — ${location}</b>\n\n${numberLines}\n\n☎️ = Supports Bulk IVR Campaigns\n\nTap a number to select:`,
 cp_228: (message, numberLines) => `📱 <b>Available Numbers — ${message}</b>\n\n${numberLines}\n\n☎️ = Supports Bulk IVR Campaigns\n\nTap a number to select:`,
 cp_229: (areaCode, numberLines) => `📱 <b>Available Numbers — Area ${areaCode}</b>\n\n${numberLines}\n\n☎️ = Supports Bulk IVR Campaigns\n\nTap a number to select:`,
 cp_23: (phoneNumber, recentNumber) => `📱 From: <b>${phoneNumber}</b>\n📞 To: <b>${recentNumber}</b>\n\nChoose an IVR template category:`,
 cp_230: (location, numberLines) => `📱 <b>More Numbers — ${location}</b>\n\n${numberLines}\n\n☎️ = Supports Bulk IVR Campaigns\n\nTap a number to select:`,
 cp_231: '此套餐尚未推出。请从以下可用套餐中选择。',
 cp_232: (planLabel) => `✅ 套餐: <b>${planLabel}</b>\n\n🌍 选择 a country:`,
 cp_233: '⚠️ Payment processing temporarily unavailable (汇率服务中断). 请重试 later or use crypto.',
 cp_234: (toLocaleString) => `Cloud IVR ₦${toLocaleString}`,
 cp_235: '⚠️ Upgrade session expired. Please start again.',
 cp_236: '⚠️ Payment processing temporarily unavailable (汇率服务中断). 请重试 later or use crypto.',
 cp_237: (toLocaleString) => `套餐 Upgrade ₦${toLocaleString}`,
 cp_238: '⚠️ Upgrade session expired. Please start again.',
 cp_239: '⚠️ 否 rejected verification found. Please start a new number purchase.',
 cp_24: '请从列表中选择有效号码。',
 cp_240: '⚠️ 否 rejected verification found.',
 cp_243: '⬇️ Please choose an option below:',
 cp_244: '⚠️ Please enter at least: <code>Street, City, Country</code>\\n\\nExample: <i>123 Main St, Sydney, Australia</i>',
 cp_245: (countryName, toFixed, showWallet) => `❌ Regulatory setup failed for ${countryName}.\n\n💰 <b>$${toFixed}</b> refunded.\n${showWallet}`,
 cp_246: (toFixed, showWallet) => `❌ Regulatory setup failed.\n\n💰 <b>$${toFixed}</b> refunded.\n${showWallet}`,
 cp_247: (toFixed, showWallet) => `❌ Regulatory setup failed.\n\n💰 <b>$${toFixed}</b> refunded.\n${showWallet}`,
 cp_248: (showWallet) => `❌ Regulatory setup failed.\n\n💰 Your wallet has been refunded.\n${showWallet}`,
 cp_249: '💡 <b>Get the most out of your number</b>\\n\\n📲 <b>Set up call forwarding</b> — ring your real phone\\n🤖 <b>Add IVR greeting</b> — professional auto-attendant\\n💬 <b>启用 短信</b> — send & receive text messages\\n\\nTap Manage Numbers below to configure.',
 cp_25: (phoneNumber) => `📱 来电显示: <b>${phoneNumber}</b>\n\nEnter the phone number to call (or multiple separated by commas):\n<i>示例: +12025551234</i>\n<i>批量: +12025551234, +12025555678</i>`,
 cp_250: '⚠️ Payment processing temporarily unavailable (汇率服务中断). 请重试 later or use crypto.',
 cp_251: (label, toLocaleString) => `${label} ₦${toLocaleString}`,
 cp_252: (numLines) => `📱 <b>选择 which plan to add a number to:</b>\n\n${numLines}`,
 cp_253: (selectedNumber) => `✅ <b>Great news! Your bundle has been approved!</b>\n\n🔄 We're activating your number <code>${selectedNumber}</code> now...`,
 cp_254: '⚠️ Could not refresh status. 请重试.',
 cp_255: '⚠️ This order cannot be cancelled — it\'s already being processed or completed.',
 cp_256: (selectedNumber, toFixed, showWallet) => `✅ <b>订单已取消</b>\n\n您对 <code>${selectedNumber}</code> 的待处理订单已取消。\n\n💰 $${toFixed} 已退回您的钱包。${showWallet ? '\n\n👛 当前余额: $' + showWallet : ''}`,
 cp_257: '⚠️ Could not cancel order. Please contact support.',
 cp_258: 'Please choose an option:',
 cp_259: '🌍 <b>All Available Countries</b>\\n\\nSelect a country:',
 cp_26: '📢 <b>快速IVR呼叫</b>\\n\\n用自动IVR消息呼叫单个号码。\\n\\n选择呼出号码（来电显示）：',
 cp_260: (subNumbersAvailable, numberLines, bulkIvrSupport, tapToSelect) => `${subNumbersAvailable}\n\n${numberLines}\n\n${bulkIvrSupport}\n\n${tapToSelect}`,
 cp_261: (subNumberSelected, numberLines, bulkIvrSupport, tapToSelect) => `${subNumberSelected}\n\n${numberLines}\n\n${bulkIvrSupport}\n\n${tapToSelect}`,
 cp_262: (subNumberArea, numberLines, bulkIvrSupport, tapToSelect) => `${subNumberArea}\n\n${numberLines}\n\n${bulkIvrSupport}\n\n${tapToSelect}`,
 cp_263: (numberLines) => `📱 <b>More Numbers</b>\n\n${numberLines}\n\n☎️ = Supports Bulk IVR\n\nTap to select:`,
 cp_264: (newState, v1) => `🎵 Hold Music: <b>${newState}</b>\n${v1}`,
 cp_265: '输入 a valid URL starting with http:// or https://.',
 cp_266: '📝 Type the greeting callers will hear:',
 cp_267: '🎙️ Send a voice message or audio file.',
 cp_268: '✅ 音频 received. 保存 as greeting?',
 cp_269: '🎤 <b>Custom Greeting</b>\\n\\nChoose how to create your greeting:',
 cp_27: '请输入有效的电话号码，以+开头，10-15位数字。\\n<i>示例：+8613812345678</i>',
 cp_270: (message) => `📋 <b>${message}</b>\n\nSelect a greeting template:`,
 cp_271: (icon, name, text) => `📋 <b>${icon} ${name}</b>\n\n<code>${text}</code>\n\n✏️ 您可以编辑上方文本或按确认继续。`,
 cp_272: '📋 <b>Greeting Templates</b>\\n\\nSelect a category:',
 cp_273: '🌐 选择语音邮件问候语的语言：\\n\\n<i>模板将以此语言朗读。</i>',
 cp_274: '✅ 文本已更新。\\n\\n🌐 选择语音邮件问候语的语言：\\n\\n<i>模板将以此语言朗读。</i>',
 cp_275: '🎤 <b>Custom Greeting</b>\\n\\nChoose:',
 cp_276: '🔄 生成音频预览...',
 cp_277: (voice) => `✅ Preview (${voice})\n\nSave this greeting?`,
 cp_278: (message) => `❌ 音频生成失败: ${message}`,
 cp_279: (translatedText) => `🌐 <b>Translated greeting:</b>\n\n<i>${translatedText}</i>\n\n🎙️ 选择 a voice:`,
 cp_280: '🎙️ 选择 a voice:',
 cp_281: '🎙 选择 a voice provider:',
 cp_282: (message) => `🌐 Translating to ${message}...`,
 cp_283: '🎙 <b>选择 语音提供商</b>\\n\\nChoose your TTS engine:',
 cp_284: '🌐 选择问候语的语言：',
 cp_285: '📝 Type the greeting text:',
 cp_286: (message) => `🌐 选择问候语的语言：\n\n<i>"${message}"</i>`,
 cp_287: '🎙 <b>选择 语音提供商</b>\\n\\nChoose your TTS engine:',
 cp_288: '🌐 选择问候语的语言：',
 cp_289: '📝 Type the greeting text:',
 cp_29: '🔍 Looking up number...',
 cp_290: '🎙️ Send a voice message or audio file.',
 cp_291: '✅ 音频 received. 保存?',
 cp_292: '✅ 语音信箱 greeting saved!',
 cp_293: '🎤 <b>Set IVR Greeting</b>\\n\\nChoose how to create your greeting:',
 cp_294: (usedKeys) => `➕ <b>添加菜单选项</b>\n\n已使用的按键：${usedKeys}\n\n输入按键编号（0-9）和描述。\n<i>示例：1 销售</i>`,
 cp_295: '📝 输入来电者将听到的问候语。\\n\\n<i>示例：「感谢致电Nomadly。按1转销售，按2转客服。」</i>',
 cp_296: '🎙️ Send a voice message or audio file for your IVR greeting.',
 cp_297: '📋 <b>Greeting Templates</b>\\n\\nProfessional templates for financial institutions — fraud hotlines, customer support, after-小时, and more. 选择 a category:',
 cp_298: '选择 an option:',
 cp_299: '🎤 <b>Set IVR Greeting</b>\\n\\nChoose how to create your greeting:',
 cp_3: '🛡️🔥 Anti-Red托管暂时不可用. 请点击 <b>💬 获取支持</b> on the keyboard to reach us.',
 cp_30: (titleCase) => `📋 Found: <b>${titleCase}</b>`,
 cp_300: (message) => `📋 <b>${message}</b>\n\nSelect a greeting template:`,
 cp_301: (icon, name, text) => `📋 <b>${icon} ${name}</b>\n\n<code>${text}</code>\n\n✏️ 您可以编辑上方文本或按确认继续。`,
 cp_302: '📋 <b>Greeting Templates</b>\\n\\nSelect a category:',
 cp_303: '🌐 选择IVR问候语的语言：\\n\\n<i>模板将以此语言朗读。</i>',
 cp_304: '✅ 文本已更新。\\n\\n🌐 选择IVR问候语的语言：\\n\\n<i>模板将以此语言朗读。</i>',
 cp_305: '🎤 <b>Set IVR Greeting</b>\\n\\nChoose how to create your greeting:',
 cp_306: '🔄 生成音频预览...',
 cp_307: (voice) => `✅ Preview generated (${voice})\n\n✅ 保存 this greeting?\n🔄 Try a different voice?\n📝 Re-type the text?`,
 cp_308: (message) => `❌ 音频生成失败: ${message}\n\nTry again or upload your own audio.`,
 cp_309: (translatedText) => `🌐 <b>Translated greeting:</b>\n\n<i>${translatedText}</i>\n\n🎙️ 选择 a voice:`,
 cp_31: '⏳ Regenerating audio for preset (previous audio expired)...',
 cp_310: '🎙️ 选择 a voice for your greeting:',
 cp_311: '🎙 选择 a voice provider:',
 cp_312: (message) => `🌐 Translating to ${message}...`,
 cp_313: '🎙 <b>选择 语音提供商</b>\\n\\nChoose your TTS engine:',
 cp_314: '🌐 选择IVR问候语的语言：',
 cp_315: '📝 Type the greeting callers will hear:',
 cp_316: (message) => `🌐 选择IVR问候语的语言：\n\n<i>"${message}"</i>`,
 cp_317: '✅ 音频 received. 保存 as your IVR greeting?',
 cp_318: '❌ 失败 to process audio. Try again.',
 cp_319: '🎙️ Send a voice message or audio file.',
 cp_32: '⚠️ 音频 regeneration failed. Please set up the call manually.',
 cp_320: '🎙 <b>选择 语音提供商</b>\\n\\nChoose your TTS engine:',
 cp_321: '🌐 选择IVR问候语的语言：',
 cp_322: '📝 Type the greeting callers will hear:',
 cp_323: '🎙️ Send a voice message or audio file.',
 cp_324: '✅ IVR greeting saved!',
 cp_325: '✅ 音频 received. 保存 as your IVR greeting?',
 cp_326: '❌ 失败 to process audio. Try again.',
 cp_327: '选择 an option:',
 cp_328: (key) => `What should happen when a caller presses <b>${key}</b>?`,
 cp_329: (message) => `📋 <b>${message}</b>\n\nSelect a template:`,
 cp_33: '⚠️ 预设音频已过期且无法重新生成。请手动配置通话。',
 cp_330: '📋 选择 a category:',
 cp_331: (icon, name, text) => `📋 <b>${icon} ${name}</b>\n\n<code>${text}</code>\n\n({ en: "✏️ Type your modified version, or tap <b>✅ Use As-Is</b>", fr: "✏️ Tapez votre version modifiée, ou appuyez sur <b>✅ Utiliser tel quel</b>", zh: "✏️ 输入修改版本，或点击 <b>✅ 直接使用</b>", hi: "✏️ अपना संशोधित संस्करण टाइप करें, या <b>✅ जैसा है</b> दबाएं" }[lang] || "✏️ Type your modified version, or tap <b>✅ Use As-Is</b>"):`,
 cp_332: '🌐 选择 the language:\\n\\n<i>The message will be translated automatically.</i>',
 cp_333: '🎙️ Send a voice message or audio file:',
 cp_334: (message) => `🌐 选择 the language:\n\n<i>"${message}"</i>`,
 cp_335: (text) => `📋 <b>Message</b>\n\n<code>${text}</code>\n\n({ en: "✏️ Type your modified version, or tap <b>✅ Use As-Is</b>", fr: "✏️ Tapez votre version modifiée, ou appuyez sur <b>✅ Utiliser tel quel</b>", zh: "✏️ 输入修改版本，或点击 <b>✅ 直接使用</b>", hi: "✏️ अपना संशोधित संस्करण टाइप करें, या <b>✅ जैसा है</b> दबाएं" }[lang] || "✏️ Type your modified version, or tap <b>✅ Use As-Is</b>"):`,
 cp_336: '🔄 生成音频预览...',
 cp_337: (key, voice) => `✅ Preview for key <b>${key}</b> (${voice})\n\nSave this option?`,
 cp_338: (message) => `❌ 音频生成失败: ${message}`,
 cp_339: (translatedText) => `🌐 <b>Translated:</b>\n\n<i>${translatedText}</i>\n\n🎙️ 选择 a voice:`,
 cp_34: '💾 <b>Preset loaded — Ready to call!</b>\\n\\nPress <b>/yes</b> to call or <b>/cancel</b> to abort.',
 cp_340: '🎙️ 选择 a voice:',
 cp_341: '🎙 选择 a voice provider:',
 cp_342: (message) => `🌐 Translating to ${message}...`,
 cp_343: '🎙 <b>选择 语音提供商</b>\\n\\nChoose your TTS engine:',
 cp_344: '🌐 选择 the language:',
 cp_345: '🎙 <b>选择 语音提供商</b>\\n\\nChoose your TTS engine:',
 cp_346: '🌐 选择 the language:',
 cp_347: '📝 Type the message:',
 cp_348: '🎙️ Send a voice message or audio file:',
 cp_35: (templateName, callerId, voiceName, join) => `💾 <b>Loaded Preset: ${templateName}</b>\n📱 From: ${callerId}\n🎙 语音: ${voiceName}\n🔘 活动按键: <b>${join}</b>`,
 cp_36: (icon, firstPh, description, generated) => `\n${icon} <b>[${firstPh}]</b> — ${description}\n\nAuto-generated: <b>${generated}</b>\nTap to accept, regenerate, or type your own:`,
 cp_37: (icon, firstPh, description) => `\n${icon} <b>[${firstPh}]</b> — ${description}\n\n从列表中选择或输入自定义值：`,
 cp_38: (icon, firstPh, description, hint) => `\n${icon} <b>[${firstPh}]</b> — ${description}\n\n${sp.hint || '选择 or type a number:'}`,
 cp_4: (SUPPORT_USERNAME) => `📞 Cloud IVR is coming soon! Contact ${SUPPORT_USERNAME} for updates.`,
 cp_40: (firstPh) => `\nEnter value for <b>[${firstPh}]</b>:`,
 cp_41: '📋 <b>选择通话模式</b>\\n\\n🔗 <b>转接</b> — 目标按下按键时，转接到您的号码\\n🔑 <b>OTP收集</b> — 提示目标输入验证码，您通过Telegram验证\\n\\n两种模式都提供完整结果。',
 cp_42: '输入要拨打的电话号码 (含国家代码):\\n<i>示例: +12025551234</i>',
 cp_43: '✍️ <b>自定义脚本</b>\\n\\n输入您的IVR消息。使用 <b>[方括号]</b> 作为占位符，用「按1」定义活动按键。\\n\\n<i>此文本将转换为语音音频。</i>',
 cp_44: '选择 a template:',
 cp_45: '请从按钮中选择类别。',
 cp_46: '✍️ <b>自定义脚本</b>\\n\\n输入您的IVR消息。使用 <b>[方括号]</b> 作为占位符，用「按1」定义活动按键。\\n\\n<i>此文本将转换为语音音频。</i>',
 cp_47: '📋 <b>占位符完整参考</b>\\n\\n<b>🔤 标准（您输入值）：</b>\\n• <code>[公司]</code> — 您的公司名\\n• <code>[姓名]</code> — 收件人姓名\\n• <code>[产品]</code> — 产品/服务名\\n\\n<b>🔢 自动填充（CSV中的值）：</b>\\n• <code>{col2}</code>、<code>{col3}</code>… — CSV文件的列\\n\\n从以下模板中选择或编写自定义脚本：',
 cp_48: (keyNote) => `${keyNote}\n\nTap <b>✅ Continue</b> to keep these keys, or type new ones:\n<i>示例: 1,2,3 or 1,5,9</i>`,
 cp_49: 'Type your custom IVR script:',
 cp_5: '⚠️ 会话已过期. Please try purchasing again.',
 cp_50: 'Please enter at least one digit (0-9):\\n<i>示例: 1,2,3</i>',
 cp_51: (join) => `🔘 活动按键 updated: <b>${join}</b>`,
 cp_52: (icon, firstPh, description, generated) => `${icon} <b>[${firstPh}]</b> — ${description}\n\nAuto-generated: <b>${generated}</b>\nTap to accept, regenerate, or type your own:`,
 cp_53: (icon, firstPh, description) => `${icon} <b>[${firstPh}]</b> — ${description}\n\n从列表中选择或输入自定义值：`,
 cp_54: (icon, firstPh, description, hint) => `${icon} <b>[${firstPh}]</b> — ${description}\n\n${sp.hint || '选择 or type a number:'}`,
 cp_56: (firstPh) => `输入 value for <b>[${firstPh}]</b>:`,
 cp_57: '📋 <b>选择通话模式</b>\\n\\n🔗 <b>转接</b> — 目标按下按键时，转接到您的号码\\n🔑 <b>OTP收集</b> — 提示目标输入验证码，您通过Telegram验证\\n\\n两种模式都提供完整结果。',
 cp_58: '请从按钮中选择模板。',
 cp_59: (icon, name, text, join) => `📋 <b>${icon} ${name}</b>\n\n<i>"${text}"</i>\n\n🔘 活动按键: <b>${join}</b>`,
 cp_6: '⚠️ 会话已过期. Please try purchasing again.',
 cp_60: (icon, firstPh, description, generated) => `\n${icon} <b>[${firstPh}]</b> — ${description}\n\nAuto-generated: <b>${generated}</b>\nTap to accept, regenerate, or type your own:`,
 cp_61: (icon, firstPh, description) => `\n${icon} <b>[${firstPh}]</b> — ${description}\n\n从列表中选择或输入自定义值：`,
 cp_62: (icon, firstPh, description, hint) => `\n${icon} <b>[${firstPh}]</b> — ${description}\n\n${sp.hint || '选择 or type a number:'}`,
 cp_64: (firstPh) => `\nEnter value for <b>[${firstPh}]</b>:`,
 cp_65: '📋 <b>选择通话模式</b>\\n\\n🔗 <b>转接</b> — 目标按下按键时，转接到您的号码\\n🔑 <b>OTP收集</b> — 提示目标输入验证码，您通过Telegram验证\\n\\n两种模式都提供完整结果。',
 cp_66: (icon, currentPh, generated) => `${icon} <b>[${currentPh}]</b> — regenerated: <b>${generated}</b>\nTap to accept, regenerate, or type your own:`,
 cp_67: (currentPh) => `✍️ Type your custom value for <b>[${currentPh}]</b>:`,
 cp_68: (currentPh) => `✍️ Type the callback number for <b>[${currentPh}]</b>:\n<i>示例: +12025551234</i>`,
 cp_69: (currentPh, value, icon, nextPh, description, generated) => `✅ ${currentPh}: <b>${value}</b>\n\n${icon} <b>[${nextPh}]</b> — ${description}\n\nAuto-generated: <b>${generated}</b>\nTap to accept, regenerate, or type your own:`,
 cp_7: '⚠️ 否 pending session found.',
 cp_70: (currentPh, value, icon, nextPh, description) => `✅ ${currentPh}：<b>${value}</b>\n\n${icon} <b>[${nextPh}]</b> — ${description}\n\n从列表中选择或输入自定义值：`,
 cp_71: (currentPh, value, icon, nextPh, description, hint) => `✅ ${currentPh}: <b>${value}</b>\n\n${icon} <b>[${nextPh}]</b> — ${description}\n\n${nextSp.hint || '选择 or type a number:'}`,
 cp_73: (currentPh, value, nextPh) => `✅ ${currentPh}: <b>${value}</b>\n\nEnter value for <b>[${nextPh}]</b>:`,
 cp_74: '✅ 所有值已设置！\\n\\n📋 <b>选择通话模式</b>\\n\\n🔗 <b>转接</b> — 目标按下按键时，转接到您的号码\\n🔑 <b>OTP收集</b> — 提示目标输入验证码，您通过Telegram验证\\n\\n两种模式都提供完整结果。',
 cp_75: '🔗 <b>转接模式</b>\\n\\n输入当来电者按下活动键时转接电话的号码：\\n<i>（您的SIP号码或任何电话号码）</i>\\n<i>示例：+8613812345678</i>',
 cp_76: '请输入有效的转接号码。',
 cp_77: '🔑 <b>OTP Collection Mode</b>\\n\\nHow many digits should the code be?\\n\\n<i>Default: 6 digits</i>',
 cp_78: '选择 a mode:',
 cp_79: '📋 <b>选择通话模式</b>\\n\\n🔗 <b>转接</b> — 目标按下按键时，转接到您的号码\\n🔑 <b>OTP收集</b> — 提示目标输入验证码，您通过Telegram验证\\n\\n两种模式都提供完整结果。',
 cp_8: (buyPlansHeader, price, minutes, sms, starter, v5, v6, v7, pro, v9, v10, v11, business) => `${buyPlansHeader}\n\n💡 <b>Starter</b> — $${price}/mo (${phoneConfig.plans.starter.分钟} min + ${sms} 短信)\n   • Call forwarding to any number\n   • 短信 forwarded to Telegram\n   • Up to ${starter} extra 个号码\n\n⭐ <b>Pro</b> — $${v5}/mo (${phoneConfig.plans.pro.分钟} min + ${v7} 短信)\n   • All Starter features\n   • 语音信箱 with custom greetings\n   • SIP credentials for softphones\n   • 短信 to Telegram & Email\n   • Webhook integrations\n   • 快速IVR呼叫 (single number)\n   • 批量IVR活动\n   • Up to ${pro} extra 个号码\n\n👑 <b>Business</b> — $${v9}/mo (${phoneConfig.plans.business.分钟 === 'Unlimited' ? 'Unlimited' : phoneConfig.plans.business.分钟} min + ${v11} 短信)\n   • All Pro features\n   • Call 录音 & Analytics\n   • OTP Collection via IVR\n   • IVR Auto-Attendant (inbound calls)\n   • Quick IVR Presets & Recent Calls\n   • IVR Redial Button\n   • Call Scheduling\n   • Custom OTP Messages & Goodbye\n   • Consistent TTS 语音/速度\n   • Priority Support\n   • Up to ${business} extra 个号码`,
 cp_80: '输入 a valid digit count (1-10):',
 cp_81: (length) => `✅ OTP长度: <b>${length} 位</b> (最多3次尝试)\n\n✍️ <b>自定义来电者消息</b>\n\n输入目标在输入验证码前听到的消息：\n\n<i>示例: "请输入您通过短信收到的验证码。"</i>`,
 cp_82: (length) => `✅ OTP length: <b>${length} digits</b> (max 3 attempts)\n\n🎙 <b>选择 语音提供商</b>\n\nChoose your TTS engine:`,
 cp_83: '🔑 <b>OTP Collection Mode</b>\\n\\nHow many digits should the code be?\\n\\n<i>Default: 6 digits</i>',
 cp_84: '🎙 <b>选择 语音提供商</b>\\n\\nChoose your TTS engine:',
 cp_85: '请选择预设或输入数字。',
 cp_86: '选择 an option:',
 cp_87: '✍️ <b>Customize Caller Messages</b>\\n\\nWould you like to customize what callers hear after verification?',
 cp_88: '❌ <b>拒绝消息</b>\\n\\n输入当您<b>拒绝</b>来电者验证码时的语音消息：\\n\\n<i>示例：「验证码错误。再见。」</i>',
 cp_89: '✅ <b>确认消息</b>\\n\\n输入当您<b>确认</b>来电者验证码时的语音消息：\\n\\n<i>示例：「谢谢。您的验证码已确认。」</i>',
 cp_9: (buyLabel) => `📢 <b>快速IVR呼叫</b>\n\nYou've already used your 免费试用呼叫.\n\nSubscribe to Cloud IVR to make unlimited IVR calls with your own 来电显示!\n\nTap <b>${buyLabel}</b> to get started.`,
 cp_90: '✅ Custom messages saved!\\n\\n🎙 <b>选择 语音提供商</b>\\n\\nChoose your TTS engine:',
 cp_91: '请输入有效的电话号码，以+开头。\\n<i>示例：+8613812345678</i>',
 cp_92: '🎙 <b>选择 语音提供商</b>\\n\\nChoose your TTS engine:',
 cp_93: '输入 the number to transfer the caller to when they press a key:\\n<i>示例: +17174794833</i>',
 cp_94: 'Please select a voice provider:',
 cp_95: '🎤 <b>选择语音</b>\\n\\n为IVR音频选择一个语音：',
 cp_96: '🎙 <b>选择 语音提供商</b>\\n\\nChoose your TTS engine:',
 cp_97: (name) => `🎤 语音: <b>${name}</b>\n\n🎚 <b>选择语速</b>\n\nChoose how fast the voice speaks:`,
 cp_98: '🎙 <b>选择 语音提供商</b>\\n\\nChoose your TTS engine:',
 cp_99: '✍️ 输入 a custom speed multiplier:\\n<i>Examples: 0.6 (very slow), 0.9 (slightly slow), 1.2 (faster), 1.5 (very fast)\\nRange: 0.25 to 4.0</i>',
 dns_1: (domain) => `🔗 Deactivating shortener for <b>${domain}</b>…`,
 dns_2: (domain) => `✅ Shortener deactivated for <b>${domain}</b>.`,
 dns_3: '❌ Could not deactivate shortener. 请重试 or contact support.',
 dns_4: '🔄 Removing conflicting record and adding new one...',
 dns_5: '无效 format. Use <b>_service._protocol</b> (e.g. _sip._tcp, _http._tcp):',
 dns_6: '⚠️ Please enter a valid USD amount (minimum $10).',
 dom_1: 'You have no registered domains. Please register a new domain or connect an external domain.',
 dom_2: '📋 <b>My 托管 Plans</b>\\n\\nYou have no active hosting plans. Purchase a plan to get started!',
 dom_3: (savings, domain, chargeUsd, shownPrice, v4) => `🎉 <b>您节省了 $${savings}！</b>\n\n🌐 域名：<b>${domain}</b>\n💰 价格：<b>$${chargeUsd}</b>${shownPrice !== chargeUsd ? ` <s>$${shownPrice}</s>` : ''}\n\n确认以继续购买。`,
 dom_4: (domain, v1) => `💡 <b>${domain} 的下一步？</b>\n\n🔗 <b>激活URL缩短器</b> — 使用 ${domain} 作为短链接域名\n🌐 <b>网站托管</b> — 在 ${domain} 上托管网站\n📋 <b>DNS管理</b> — 管理DNS记录\n\n选择一个选项：`,
 dom_5: (domain, domainCost, APP_SUPPORT_LINK) => `您的域名 <b>${domain}</b> 已成功注册！\n\n💰 已扣费：<b>$${domainCost}</b> 从您的钱包。\n\n如有问题，请联系客服：${APP_SUPPORT_LINK}`,
 dom_6: (showWallet) => `❌ Regulatory setup failed.\n\n💰 Your wallet has been refunded.\n${showWallet}`,
 dom_7: (requested, delivered, requesteddelivered, toFixed, reasonText, v5) => `💰 <b>Partial Refund</b>\n\n📊 Ordered: ${requested} leads\n✅ Delivered: ${delivered} leads\n❌ Undelivered: ${requesteddelivered} leads\n\n💵 Refund: <b>$${toFixed}</b> returned to your wallet\n📝 Reason: ${reasonText}\n\n💰 钱包: $${v5} USD`,
 dom_8: '💡 <b>Maximize your leads</b>\\n\\n📞 <b>Get a Cloud IVR</b> — call these leads with a local number\\n🎯 <b>Buy more leads</b> — target a different area or carrier\\n🔗 <b>Shorten your links</b> — track your outreach campaigns\\n\\nTap an option below.',
 dom_9: (totalPrice, toFixed) => `❌ 钱包余额不足。需要 $${totalPrice}，当前 $${toFixed}。\n\n请充值钱包后重试。`,

 // Post-purchase upsells (hosting & VPS)
 host_5d: (domain) => `💡 <b>您的 ${domain} 主机已上线！</b>\n\n🌐 <b>购买更多域名</b> — 托管更多网站\n📞 <b>Cloud IVR + SIP</b> — 让访客通过虚拟号码致电您\n✂️🌐 <b>自定义域名短链</b> — 用品牌短链跟踪入站流量\n\n请在下方选择一个选项。`,
 vps_5d: '💡 <b>您的 VPS 已就绪！</b>\n\n📧 <b>BulkSMS</b> — 在新 VPS 上托管短信网关\n📞 <b>Cloud IVR + SIP</b> — 配对虚拟号码接收来电\n🌐 <b>防屏蔽域名</b> — 将域名指向您的 VPS\n\n请在下方选择一个选项。',
 ev_1: '🚧 邮件验证 service is currently under maintenance. 请重试 later.',
 ev_10: (message) => `❌ 错误: ${message}`,
 ev_11: '❌ 无效 IPv4 format. Send like: <code>1.2.3.4</code>',
 ev_12: (ipInput) => `✅ IP <code>${ipInput}</code> added to pool.`,
 ev_13: (ipInput) => `✅ IP <code>${ipInput}</code> removed from pool.`,
 ev_14: (message) => `❌ 错误: ${message}`,
 ev_15: '❌ 已取消.',
 ev_16: '❌ 已取消.',
 ev_17: '❌ Please upload a <b>.csv</b> or <b>.txt</b> file.',
 ev_18: (message) => `❌ 失败 to read file: ${message}`,
 ev_19: '📎 Please upload a CSV/TXT file with email addresses.',
 ev_2: '📧 Returning to 邮件验证 menu...',
 ev_20: '❌ 否 valid email addresses found in the file. Please check the format.',
 ev_21: (minEmails, length) => `❌ Minimum <b>${minEmails}</b> emails required. Found only ${length}.`,
 ev_22: (toLocaleString, v1) => `❌ Maximum <b>${toLocaleString}</b> emails allowed. Found ${v1}.`,
 ev_23: '❌ 已取消.',
 ev_24: '📋 Please paste email addresses (one per line or comma-separated).',
 ev_25: '❌ 否 valid email addresses found. Please check format.',
 ev_26: (maxPasteEmails, length) => `❌ Paste mode supports up to <b>${maxPasteEmails}</b> emails. Found ${length}. Use file upload for larger lists.`,
 ev_27: (minEmails, length) => `❌ Minimum <b>${minEmails}</b> emails required. Found only ${length}.`,
 ev_28: '❌ 已取消.',
 ev_29: '❌ 会话已过期. Please start again.',
 ev_3: '⚠️ Could not reach worker',
 ev_30: '❌ 此列表大小不支持免费试用。请选择付款方式。',
 ev_31: '❌ 免费 trial already used. Please choose a payment method.',
 ev_32: '❌ Trial + Pay not available. Please choose a payment method.',
 ev_33: '❌ 免费 trial already used. Please choose a payment method.',
 ev_34: (toFixed, v1) => `⚠️ 额外邮件的USD余额不足。\n💰 需要：<b>$${toFixed}</b>\n\n请充值钱包后重试。`,
 ev_35: (toFixed, v1) => `⚠️ Insufficient USD balance.\n💰 Need: <b>$${toFixed}</b>\n💳 Have: <b>$${v1}</b>\n\nPlease deposit more to your wallet.`,
 ev_36: (toFixed, toLocaleString) => `✅ <b>付款成功!</b>\n\n💵 Charged: <b>$${toFixed}</b>\n📧 Validating: <b>${toLocaleString} emails</b>\n\n⏳ 处理中 will begin shortly. You'll receive progress updates.`,
 ev_37: 'Please choose a payment method:',
 ev_4: (message) => `❌ 错误: ${message}`,
 ev_5: '⚠️ 否 IPs found from cloud provider API or credentials missing.',
 ev_6: (message) => `❌ Cloud API error: ${message}`,
 ev_7: '➕ <b>Add IP</b>\\n\\nSend me the IPv4 address to add (e.g. <code>1.2.3.4</code>):',
 ev_8: (message) => `❌ 错误: ${message}`,
 ev_9: '♻️ All IP health stats reset to healthy.',
 host_1: '❌ Payment processing error. Please contact support.',
 host_10: (startsWith) => `✅ <b>Link shortened!</b>\n\n🔗 <code>${startsWith}</code>\n\n📋 Tap to copy`,
 host_11: (startsWith) => `✅ <b>Link shortened!</b>\n\n🔗 <code>${startsWith}</code>\n\n📋 Tap to copy`,
 host_12: '❌ 错误 creating short link. 请重试.',
 host_13: 'not authorized',
 host_14: 'not authorized',
 host_15: (userToUnblock) => `User ${userToUnblock} not found`,
 host_16: (userToUnblock) => `User ${userToUnblock} has been unblocked.`,
 host_17: 'not authorized',
 host_18: 'not authorized',
 host_19: (previewText, statsText) => `${previewText}\n\n${statsText}\n\nReady to broadcast?`,
 host_2: 'Hello, 管理员! Please select an option:',
 host_20: '🚀 Starting broadcast... This may take a while for large user bases.',
 host_21: (message) => `❌ Broadcast failed: ${message}`,
 host_22: '📤 Broadcast initiated! You\\\'ll receive progress updates.',
 host_23: (message, plan) => `<b>${message}</b> is already on a ${plan}. 选择 a different domain.`,
 host_24: '请从列表中选择域名。',
 host_25: '✅ You are already on the highest plan (Golden Anti-Red). 否 upgrades available.',
 host_26: (toFixed, price) => `⚠️ 余额不足. You have $${toFixed} but need $${price}.`,
 host_27: '请选择一个升级选项。',
 host_28: (toFixed, upgradePrice) => `⚠️ 余额不足. You have $${toFixed} but need $${upgradePrice}.`,
 host_29: (error) => `❌ Upgrade failed: ${error}\nYour wallet has been refunded.`,
 host_3: (toFixed, length) => `💰 Auto-refunded <b>$${toFixed}</b> from ${length} rejected verification(s). You can start a fresh purchase anytime.`,
 host_30: '❌ Upgrade failed. Your wallet has been refunded. 请重试 or contact support.',
 host_31: '🚧 VPS service is coming soon! Stay tuned.',
 host_32: '⚠️ Unable to load referral page. Try again later.',
 host_4: (safeHtml) => `${safeHtml}`,
 host_5: (CHAT_BOT_NAME) => `<b>${CHAT_BOT_NAME} Help</b>\n\n<b>Quick Commands:</b>\n• <code>/shorten URL</code> — Instant short link\n• <code>/shorten URL alias</code> — Custom alias\n• Just paste any URL — Auto-detect & shorten\n\n<b>Features:</b>\n• URL Shortener\n• 域名 Names\n• Phone 线索\n• 钱包 & Payments\n• Web 托管\n\nUse the menu below to get started!`,
 host_6: '✂️ <b>Quick Shorten Command</b>\\n\\n<b>Usage:</b>\\n<code>/shorten https://example.com</code> — Random short link\\n<code>/shorten https://example.com myalias</code> — Custom alias\\n\\nOr just paste any URL and I\'ll offer to shorten it!',
 host_7: '❌ 无效 URL. Please provide a valid URL starting with http:// or https://',
 host_8: (customAlias, preferredDomain) => `❌ Alias <code>${customAlias}</code> is already taken on ${preferredDomain}. Try a different alias.`,
 host_9: (customAlias) => `❌ Alias <code>${customAlias}</code> is already taken. Try a different alias.`,
 ld_1: (toFixed) => `💵 $${toFixed} — `,
 ld_2: '🎯 选择目标机构。\\n真实、已验证的线索，带电话号码持有者姓名 — 非常适合精准营销。',
 ld_3: '📝 <b>请求自定义线索</b>\\n\\n告诉我们您想要定位的机构或公司。\\n\\n<i>示例：「尼日利亚XYZ银行的线索」或「德克萨斯ABC公司的员工」</i>',
 sms_1: (toFixed, v1) => `⚠️ <b>余额不足</b>\n\n💰 Need: <b>$${toFixed}</b>\n👛 Have: <b>$${v1}</b>\n\nPlease top up or choose another payment method.`,
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
 sms_22: (gifted, skipped, failed, total) => `✅ <b>Gift Complete!</b>\n\n🎁 Gifted: ${gifted}\n⏭ Skipped (already had): ${skipped}\n❌ 失败: ${failed}\n📊 Total users: ${total}`,
 sms_23: (message) => `❌ Gift failed: ${message}`,
 sms_24: '✅ 否 active app sessions found — you can login freely.',
 sms_25: '✅ <b>All devices logged out!</b>\\n\\nYou can now login on a new device.',
 sms_26: (buyPlan) => `❌ <b>订阅 Required</b>\n\nYou need an active subscription to create 短信 campaigns.\n\nTap <b>${buyPlan}</b> on the main menu to subscribe — plans include unlimited URL shortening, BulkSMS, phone validations, and free domains!`,
 sms_27: (SMS_APP_LINK, chatId) => `📵 <b>否 活跃 Device</b>\n\nYou need to activate the Nomadly 短信 App on a device before creating campaigns.\n\n1️⃣ Download the app: ${process.env.短信_APP_LINK || 'See 📲 Download App'}\n2️⃣ 输入 activation code: <code>${chatId}</code>\n3️⃣ Come back here to create campaigns`,
 sms_28: (length) => `📱 <b>选择 Device</b>\n\nYou have ${length} active devices. 选择 which device will send this campaign:`,
 sms_29: '❌ 请从下方按钮选择设备。',
 sms_3: (minAmount, maxAmount) => `请输入 ${minAmount} 到 ${maxAmount} 之间的有效金额。`,
 sms_30: '❌ 失败 to load campaigns. 请重试.',
 sms_31: '❌ 活动 name cannot be empty. Please enter a name:',
 sms_32: '✍️ <b>活动内容</b>\\n\\n输入您的短信内容。使用 <code>[name]</code> 来个性化每个联系人的姓名。\\n\\n<i>建议160字符以内</i>',
 sms_33: '📱 <b>创建短信活动</b>\\n\\n输入活动名称：',
 sms_34: '❌ Message content cannot be empty. Please type your 短信 message:',
 sms_35: '❌ Please enter at least one non-empty message line.',
 sms_36: '❌ 文件中未找到有效的电话号码。\\n\\n请上传格式为 +[国家代码][号码] 的文件。',
 sms_37: (length, length1, smsGapTimePrompt) => `👥 <b>${length} contact${length1} loaded from file!</b>\n\n${smsGapTimePrompt}`,
 sms_38: '❌ 失败 to process file. 请重试 or send contacts as text.',
 sms_39: '✍️ <b>活动 Content</b>\\n\\nType your 短信 message. Use <code>[name]</code> to personalize.\\nFor rotation, separate messages with <code>---</code> on its own line.',
 sms_4: (count, v1) => `✅ <b>已加载 ${count} 个联系人！</b>\n\n检查并确认以开始发送。`,
 sms_40: '❌ Please send contacts as text or upload a file.',
 sms_41: '❌ 否 valid phone 个号码 found.\\n\\nPhone 个号码 must contain at least 7 digits (preferably 含国家代码 starting with +).\\n\\nExamples:\\n<code>+18189279992, John\\n+14155551234</code>',
 sms_42: (length, length1, warningLine, smsGapTimePrompt) => `👥 <b>${length} contact${length1} loaded!</b>${warningLine}\n\n${smsGapTimePrompt}`,
 sms_43: '📋 <b>Upload Contacts</b>\\n\\nSend contacts as text or upload a .txt/.csv file:',
 sms_44: '📝 <b>从文件创建活动</b>\\n\\n上传包含电话号码的CSV或TXT文件（每行一个）。\\n\\n<i>格式：+[国家代码][号码]</i>',
 sms_45: (buyPlan) => `❌ <b>免费试用 Exhausted</b>\n\nYou've used all your free 短信. Subscribe to unlock unlimited BulkSMS campaigns!\n\n👉 Tap <b>${buyPlan}</b> to subscribe.`,
 sms_46: '❌ 文件为空或格式无效。请上传有效的CSV或TXT文件。',
 sms_47: '📝 <b>向个别号码发送活动</b>\\n\\n输入电话号码，每行一个。\\n\\n<i>格式：+[国家代码][号码]</i>',
 sms_48: '❌ 失败 to create campaign. 请重试.',
 sms_49: '❌ 未找到有效号码。请输入格式为 +[国家代码][号码] 的号码，每行一个。',
 sms_5: (domain, error) => `❌ Could not link <b>${domain}</b>: ${error}`,
 sms_50: (name, messagePreview, count) => `📋 <b>活动审核</b>\n\n📝 名称：<b>${name}</b>\n💬 消息：<code>${messagePreview}</code>\n📱 联系人：<b>${count}</b>\n\n确认以开始发送。`,
 sms_51: (sent, total) => `📤 发送中... ${sent}/${total}`,
 sms_52: (sent, failed, total) => `✅ <b>活动完成！</b>\n\n📤 已发送：${sent}\n❌ 失败：${failed}\n📊 总计：${total}`,
 sms_53: '❌ 失败 to create scheduled campaign. 请重试.',
 sms_54: (SUPPORT_USERNAME) => `📞 Cloud IVR is coming soon! Contact ${SUPPORT_USERNAME} for updates.`,
 sms_55: '🛡️🔥 Anti-Red托管暂时不可用. 请点击 <b>💬 获取支持</b> on the keyboard to reach us.',
 sms_56: (substring, v1) => `🔗 <b>URL Detected!</b>\n\n<code>${substring}${v1}</code>\n\n⚠️ You have no links 剩余.\n\n👉 Upgrade to shorten URLs!`,
 sms_57: (minEmails, length) => `❌ Too few emails. Minimum is <b>${minEmails}</b>, you provided <b>${length}</b>.`,
 sms_58: '📱 <b>短信活动</b>\\n\\n选择添加联系人的方式：',
 sms_59: (length) => `⏳ Validating ${length} emails...\n\nThis may take a moment.`,
 sms_6: (sanitizeProviderError) => `❌ DNS error: ${sanitizeProviderError}`,
 sms_7: (error) => `❌ DNS error: ${error}`,
 sms_8: (message) => `❌ 错误: ${message}`,
 sms_9: (message) => `❌ 错误: ${message}`,
 util_1: '❌ 操作已过期。请重新开始。',
 util_10: '✅ 操作成功。',
 util_11: '❌ 发生错误。请重试。',
 util_12: '✅ Payment received!',
 util_13: '❌ 此功能在您当前的套餐中不可用。请升级。',
 util_14: '⏳ 请稍候...',
 util_15: (delivered, requested, toFixed) => `💰 <b>Partial Refund</b>\n📊 ${delivered}/${requested} leads delivered\n💵 Refund: <b>$${toFixed}</b> → wallet`,
 util_16: (targetName, length) => `📄 <b>File 1 — ${targetName} Numbers + Real Person Name (${length} matched)</b>`,
 util_17: (targetName, length) => `📄 <b>File 2 — All ${targetName} Phone Numbers (${length} total)</b>`,
 util_18: (ngnIn, toLowerCase) => `✅ Payment received! Your wallet has been credited ₦${ngnIn}. Use wallet to complete your ${toLowerCase} purchase.`,
 util_2: (displayName, chargedDisplay, toUpperCase, toLocaleDateString, toFixed, v5) => `✅ <b>VPS Auto-Renewed</b>\n\n🖥️ <b>${displayName}</b> renewed for 1 month.\n💰 ${chargedDisplay} deducted from ${toUpperCase} wallet.\n📅 New expiry: <b>${toLocaleDateString}</b>\n\n💳 余额: $${toFixed} / ₦${v5}`,
 util_3: '❌ 操作已取消。',
 util_4: '❌ 输入无效。请重试。',
 util_5: '❌ 会话已过期。请重新开始。',
 util_6: (displayName, chargedDisplay, toLocaleDateString, toFixed, v4) => `✅ <b>VPS Auto-Renewed</b>\n\n🖥️ <b>${displayName}</b> renewed for 1 month.\n💰 ${chargedDisplay} deducted.\n📅 New expiry: <b>${toLocaleDateString}</b>\n\n💳 余额: $${toFixed} / ₦${v4}`,
 util_7: (displayName, toFixed) => `🚨 <b>URGENT — VPS 已过期</b>\n\n🖥️ <b>${displayName}</b> has expired.\n💰 余额: $${toFixed}\n\n⚠️ <b>服务器 will be deleted shortly.</b>\nRenew NOW: VPS/RDP → Manage → 📅 续费 Now`,
 util_8: (displayName, expiryDate, planPrice, toFixed, statusIcon, v5) => `🖥️ <b>VPS即将到期 in 3 Days</b>\n\n<b>${displayName}</b> 到期 on <b>${expiryDate}</b>.\n💵 Required: <b>$${planPrice}/mo</b>\n💳 余额: $${toFixed}\n${statusIcon} ${sufficient ? 'Auto-renewal will be attempted 1 day before expiry.' : '余额不足 — top up or renew manually to keep your server!'}`,
 util_9: '💡 使用下方按钮进行导航。',
 vps_1: (message) => `❌ 失败 to read file: ${message}`,
 vps_10: '✏️ 输入 the new <b>Subject</b> line:',
 vps_11: '⚙️ <b>Email 管理员 Panel</b>',
 vps_12: '📭 否 domains configured.',
 vps_13: '🗑 <b>Remove 域名</b>\\n\\nSelect the domain to remove:',
 vps_14: (domainList) => `🌐 <b>Sending Domains</b>\n\n${domainList}`,
 vps_15: (domainToRemove) => `✅ 域名 <b>${domainToRemove}</b> removed successfully.\n\nDNS records cleaned up.`,
 vps_16: (error) => `❌ 失败 to remove: ${result?.error || '域名 not found'}`,
 vps_17: (message) => `❌ 错误 removing domain: ${message}`,
 vps_18: '🌐 返回 to domains.',
 vps_19: '❌ 无效 domain name. Please enter a valid domain (e.g., example.com)',
 vps_2: 'Please choose: "📝 Type Plain Text" or "📎 Upload HTML File"',
 vps_20: (domain) => `⏳ Setting up <b>${domain}</b>...\n\nCreating DNS records, generating DKIM keys...`,
 vps_21: (error) => `❌ 失败: ${error}`,
 vps_22: '⚙️ <b>Email 管理员 Panel</b>',
 vps_23: '否 active IPs to pause.',
 vps_24: '选择 IP to pause:',
 vps_25: (ip) => `⏸ IP ${ip} paused.`,
 vps_26: '否 paused IPs.',
 vps_27: '选择 IP to resume:',
 vps_28: (ip) => `▶️ IP ${ip} resumed.`,
 vps_29: '🖥️ 返回 to IPs.',
 vps_3: '🖥️ <b>VPS服务器</b>\\n\\n选择您的服务器套餐。包含完整root访问权限和控制面板。',
 vps_30: '❌ 无效 IP address. Please enter a valid IPv4 (e.g., 1.2.3.4)',
 vps_31: (trim) => `🖥️ Assign IP <b>${trim}</b> to which domain?`,
 vps_32: '🖥️ 返回 to IPs.',
 vps_33: (ip, domain) => `⏳ Adding IP ${ip} to ${domain} and starting warming...`,
 vps_34: '⚙️ <b>Email 管理员 Panel</b>',
 vps_35: '💲 输入 new rate per email (e.g., 0.10):',
 vps_36: '📉 输入 new minimum emails per campaign:',
 vps_37: '📈 输入 new maximum emails per campaign:',
 vps_38: '💰 返回 to pricing.',
 vps_39: '❌ 无效. 输入 a number like 0.10',
 vps_4: '选择 payment method:',
 vps_40: (rate, toFixed) => `✅ Rate updated to <b>$${rate}/email</b> ($${toFixed} per 500)`,
 vps_41: '💰 返回 to pricing.',
 vps_42: '❌ 无效. 输入 a number.',
 vps_43: (min) => `✅ Minimum emails updated to <b>${min}</b>`,
 vps_44: '💰 返回 to pricing.',
 vps_45: '❌ 无效. 输入 a number.',
 vps_46: (max) => `✅ Maximum emails updated to <b>${max}</b>`,
 vps_47: '⚠️ Payment processing temporarily unavailable (汇率服务中断). 请重试 later or use crypto.',
 vps_48: 'Bank ₦aira + Card 🌐︎',
 vps_49: '💵 输入 the amount you\\\'d like to load ($50 – $1,000):',
 vps_5: '⚠️ Payment processing temporarily unavailable (汇率服务中断). 请重试 later or use crypto.',
 vps_50: '⚠️ Payment processing temporarily unavailable (汇率服务中断). 请重试 later or use crypto.',
 vps_51: 'Bank ₦aira + Card 🌐︎',
 vps_52: (reason) => `🚫 <b>市场 Access Restricted</b>\n\nYou cannot create listings. Your marketplace access has been suspended.\nReason: <i>${reason}</i>`,
 vps_53: (reason) => `🚫 <b>市场 Access Restricted</b>\n\nYou cannot create listings. Your marketplace access has been suspended.\nReason: <i>${reason}</i>`,
 vps_54: '❌ 错误 publishing product. 请重试.',
 vps_55: '🚧 VPS service is coming soon! Stay tuned.',
 vps_56: '🚧 VPS service is coming soon! Stay tuned.',
 vps_57: '会话已过期. Please paste your URL again.',
 vps_58: (displayUrl) => `✅ <b>Link shortened!</b>\n\n🔗 <code>${displayUrl}</code>\n\n📋 Tap to copy`,
 vps_59: (displayUrl) => `✅ <b>Link shortened!</b>\n\n🔗 <code>${displayUrl}</code>\n\n📋 Tap to copy`,
 vps_6: 'Bank ₦aira + Card 🌐︎',
 vps_60: '❌ 错误 creating short link. 请重试.',
 vps_61: 'Please choose an option:',
 vps_62: '会话已过期. Please paste your URL again.',
 vps_63: '❌ 无效 alias. Use only letters, 个号码, and hyphens.',
 vps_64: '❌ Alias must be 2-30 characters long.',
 vps_65: (customAlias) => `❌ Alias <code>${customAlias}</code> is already taken. Try a different one.`,
 vps_66: (displayUrl) => `✅ <b>Link shortened!</b>\n\n🔗 <code>${displayUrl}</code>\n\n📋 Tap to copy`,
 vps_67: (displayUrl) => `✅ <b>Link shortened!</b>\n\n🔗 <code>${displayUrl}</code>\n\n📋 Tap to copy`,
 vps_68: '❌ 错误 creating short link. 请重试.',
 vps_69: '❌ 余额不足。请充值钱包。',
 vps_7: (toLocaleString, price, totalEmails) => `📧 <b>Email Blast Payment</b>\n\n💵 Amount: <b>₦${toLocaleString}</b> (~$${price})\n📬 活动: ${totalEmails} emails\n\n🏦 Complete your payment via the link below:`,
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
 vps_8: '❌ 无效 email address. Please enter a valid email (e.g., you@gmail.com):',
 vps_80: (altList) => `✅ Available alternatives:\n\n${altList}\n\nType any domain name to check:`,
 vps_81: '否 alternatives found. Try a different name:',
 vps_82: (ns) => `无效 nameserver: <code>${ns}</code>\nPlease enter valid nameserver hostnames.`,
 vps_83: '⚠️ Payment processing temporarily unavailable (汇率服务中断). 请重试 later or use crypto.',
 vps_84: 'Bank ₦aira + Card 🌐︎',
 vps_85: '⚠️ Payment processing temporarily unavailable (汇率服务中断). 请重试 later or use crypto.',
 vps_86: 'Bank ₦aira + Card 🌐︎',
 vps_87: '⚠️ Payment processing temporarily unavailable (汇率服务中断). 请重试 later or use crypto.',
 vps_88: 'Bank ₦aira + Card 🌐︎',
 vps_89: '⚠️ Payment processing temporarily unavailable (汇率服务中断). 请重试 later or use crypto.',
 vps_9: (testAddr) => `⏳ Sending test email to <b>${testAddr}</b> via Brevo...`,
 vps_90: 'Bank ₦aira + Card 🌐︎',
 vps_91: '⚠️ Payment processing temporarily unavailable (汇率服务中断). 请重试 later or use crypto.',
 vps_92: 'Bank ₦aira + Card 🌐︎',
 vps_93: 'DNS records are managed by your custom nameserver provider. Use "🔄 Manage Nameservers" to change providers.',
 vps_94: '✅ VPS服务器创建成功！访问详情已发送给您。',
 vps_95: (domain, sanitizeProviderError) => `❌ Could not link <b>${domain}</b>: ${sanitizeProviderError}`,
 vps_96: (domain, sanitizeProviderError) => `❌ DNS error for <b>${domain}</b>: ${sanitizeProviderError}`,
 vps_97: (domain, error) => `❌ DNS error for <b>${domain}</b>: ${error}`,
 vps_98: (message) => `❌ 错误: ${message}`,
 wh_1: (toFixed) => `💰 Excess ₦ credited to wallet: <b>$${toFixed}</b>`,
 wh_10: (length) => `📄 <b>File 1 — Numbers + Real Person Name (${length} matched)</b>`,
 wh_11: (length) => `📄 <b>File 2 — All Phone Numbers (${length} total)</b>`,
 wh_12: (toFixed, toLowerCase) => `✅ Payment received! Your wallet has been credited $${toFixed}. Use wallet to complete your ${toLowerCase} purchase.`,
 wh_13: '✅ Webhook创建成功。',
 wh_14: '❌ Webhook创建失败。请重试。',
 wh_15: '📋 <b>您的Webhooks</b>\\n\\n选择一个webhook进行管理：',
 wh_16: '❌ 未找到webhook。请先创建一个。',
 wh_17: '✅ Crypto payment received!',
 wh_18: '✅ Webhook已删除。',
 wh_19: '❌ Webhook删除失败。',
 wh_2: '🔗 <b>创建Webhook</b>\\n\\n输入您的webhook URL：',
 wh_20: (toFixed) => `💰 Excess crypto credited to wallet: <b>$${toFixed}</b>`,
 wh_21: (delivered, requested, toFixed) => `💰 <b>Partial Refund</b>\n📊 ${delivered}/${requested} leads delivered\n💵 Refund: <b>$${toFixed}</b> → wallet`,
 wh_22: (toFixed, toLowerCase) => `✅ Payment received! Your wallet has been credited $${toFixed}. Use wallet to complete your ${toLowerCase} purchase.`,
 wh_23: '❌ URL无效。请输入以 https:// 开头的有效URL。',
 wh_3: '📝 <b>Webhook名称</b>\\n\\n输入此webhook的名称：',
 wh_4: '📋 <b>Webhook事件</b>\\n\\n选择要监听的事件：',
 wh_5: '✅ Crypto payment received!',
 wh_6: '✅ Webhook更新成功。',
 wh_7: '❌ Webhook更新失败。',
 wh_8: (toFixed) => `💰 Excess crypto credited to wallet: <b>$${toFixed}</b>`,
 wh_9: (requested, delivered, toFixed, v3) => `💰 <b>Partial Refund</b>\n\n📊 Ordered: ${requested} leads\n✅ Delivered: ${delivered}\n💵 Refund: <b>$${toFixed}</b> credited to your wallet\n💰 钱包: $${v3} USD`,
 wlt_1: '⏳ Payment already in progress. 请稍候...',
 wlt_10: '⚠️ Unable to load transaction history. 请重试 later.',
 wlt_11: (amount) => `💵 Deposit <b>$${amount}</b>\n\nSelect payment method:`,
 wlt_12: '⚠️ NGN payments temporarily unavailable (汇率服务中断). 请尝试加密货币.',
 wlt_13: 'Bank ₦aira + Card 🌐︎',
 wlt_2: (balance) => `👛 <b>钱包</b>\n\n💰 余额：<b>$${balance} USD</b>\n\n选择操作：`,
 wlt_3: (priceText, askDomainToUseWithShortener) => `${priceText}${askDomainToUseWithShortener}`,
 wlt_4: '选择 link type:',
 wlt_5: '✏️ 输入 your custom alias (letters, 个号码, hyphens only):',
 wlt_6: '❌ 金额无效。请输入有效金额。',
 wlt_7: (label) => `删除 ${label}?`,
 wlt_8: '⏳ 加载中 transactions...',
 wlt_9: '📜 <b>Transaction History</b>\\n\\nNo transactions found yet. Make a deposit or purchase to see activity here.',
}

const phoneNumberLeads = ['🎯 精准目标线索', '✅📲 验证电话线索']

const buyLeadsSelectCountry = Object.keys(areasOfCountry)
const buyLeadsSelectSmsVoice = ['短信 (价格为 20$/1000)', '语音 (价格为 0$/1000)']
const buyLeadsSelectArea = country => Object.keys(areasOfCountry?.[country])
const buyLeadsSelectAreaCode = (country, area) => {
 const codes = areasOfCountry?.[country]?.[area].map(c => format(countryCodeOf[country], c))
 return codes.length > 1 ? ['Mixed Area Codes'].concat(codes) : codes
}
const _buyLeadsSelectAreaCode = (country, area) => areasOfCountry?.[country]?.[area]
const buyLeadsSelectCnam = yesNo
const buyLeadsSelectCarrier = country => carriersOf[country]
const buyLeadsSelectAmount = ['1000', '2000', '3000', '4000', '5000']
const buyLeadsSelectFormat = ['本地格式', '国际格式']

const validatorSelectCountry = Object.keys(areasOfCountry)
const validatorSelectSmsVoice = ['短信 (价格为 20$/1000)', '语音 (价格为 0$/1000)']
const validatorSelectCarrier = country => carriersOf[country]
const validatorSelectCnam = yesNo
const validatorSelectAmount = ['ALL', '1000', '2000', '3000', '4000', '5000']
const validatorSelectFormat = ['本地格式', '国际格式']

const selectFormatOf = {
 本地格式: 'Local Format',
 国际格式: 'International Format',
}

//redSelectRandomCustom

const redSelectRandomCustom = ['随机短链接']

const redSelectProvider = ['Bit.ly $10', `Shortit（试用 ${FREE_LINKS}）`]

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
 BTC: '₿ 比特币 (BTC)',
 LTC: 'Ł 莱特币 (LTC)',
 DOGE: 'Ð 狗狗币 (DOGE)',
 BCH: 'Ƀ 比特币现金 (BCH)',
 ETH: 'Ξ 以太坊 (ETH)',
 TRON: '🌐 波场 (TRX)',
 'USDT (TRC20)': '₮ 泰达币 (USDT - TRC20)',
 'USDT (ERC20)': '₮ 泰达币 (USDT - ERC20)',
}

/////////////////////////////////////////////////////////////////////////////////////
const _bc = ['返回', '取消']

const payIn = {
 crypto: '加密货币',
 ...(HIDE_BANK_PAYMENT !== 'true' && { bank: '银行 ₦奈拉 + 卡🏦💳' }),
 wallet: '👛 钱包',
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
 item.includes(user.backToPremiumWeeklyDetails) ||
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
 en: '🇬🇧 英语',
 fr: '🇫🇷 法语',
 zh: '🇨🇳 中国人',
 hi: '🇮🇳 印地语',
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
 continueAtHostbay: '🚀 所有服务现已在 Nomadly Bot 上提供 — 域名、线索、Cloud IVR、数字产品等。',
 redirectMessage: '🚀 所有服务现已在 Nomadly Bot 上提供 — 域名、线索、Cloud IVR、数字产品等。',

 serviceAd: `━━━━━━━━━━━━━━━━━━━━━━
⚡ <b>Nomadly</b> — 您的数字工具箱
━━━━━━━━━━━━━━━━━━━━━━

📞 <b>Cloud IVR + SIP</b>
30+ 国家虚拟号码
IVR 自动应答 · 短信 · 语音信箱 · SIP
快速IVR和批量IVR活动

🌐 <b>防弹域名</b>
1,000+ TLDs · DMCA 豁免离岸注册
DNS 管理 · Anti-Red 保护

🛡️ <b>Anti-Red 托管</b>
离岸 HostPanel · 按周和按月
JS Challenge 防护 · SSL 包含

🛒 <b>数字产品</b>
Twilio · Telnyx · AWS · Google Cloud
Google Workspace · Zoho Mail · eSIM

💳 <b>虚拟借记卡</b>
即时虚拟卡 · 全球使用

🎯 <b>验证电话线索</b>
按国家、运营商和区号筛选
高级线索含机主姓名

🔗 <b>短链接服务</b>
品牌链接 · 自定义域名 · 数据分析

━━━━━━━━━━━━━━━━━━━━━━
💰 支付方式：<b>加密货币 · 银行转账 · 钱包</b>
━━━━━━━━━━━━━━━━━━━━━━

🤖 <b>立即开始 →</b> @Nomadlybot
💬 <b>需要帮助？</b> 在机器人中点击获取支持
📢 <b>更新 →</b> ${TG_CHANNEL}`,

 askPreferredLanguage: `🌍 为了确保一切都符合您的首选语言，请在下面选择一种：
 
 您随时可以在设置中更改您的语言。`,
 askValidLanguage: '请选择一个有效的语言：',
 settingsMenuText: '⚙️ <b>设置</b>\n\n在下方管理您的偏好：',
 welcomeMessage: `👋 欢迎来到 ${CHAT_BOT_NAME}！
我们很高兴您来到这里！🎉
让我们帮您快速开始，探索我们提供的所有精彩功能吧！🌟

设置过程简单快捷——让我们开始吧！🚀`,
 askUserEmail: '你的电子邮件是什么？让我们个性化您的体验吧！（例如，davidsen@gmail.com）',
 processUserEmail: `谢谢 😊 我们正在为您设置帐户。
 请稍等片刻，我们正在最终处理细节。 ⏳
 
 我们在后台工作。请按步骤操作！`,
 confirmUserEmail: `✨ 好消息！您的帐户已准备好！ 🎉💃🎉
 
 享受免费试用期的高级功能！`,
 termsAndCond: `📜 进行之前，请查看并接受我们的条款和条件。`,
 acceptTermMsg: `请接受 ${CHAT_BOT_NAME} 的条款和条件以继续使用。`,
 acceptTermButton: '✅ 接受',
 declineTermButton: '❌ 拒绝',
 viewTermsAgainButton: '🔄 查看条款',
 exitSetupButton: '❌ 退出设置',
 acceptedTermsMsg: `✅ 您已成功接受条款和条件！ 🎉
 您已准备好开始使用 ${CHAT_BOT_NAME}。让我们进入有趣的部分！ 🎯`,
 declinedTermsMsg: `⚠️ 您需要接受条款和条件才能继续使用 ${CHAT_BOT_NAME}。 
 请在您准备好的时候再次查看。`,
 userExitMsg: '用户按下了退出按钮。',
 termsAndCondMsg: `<h1>${CHAT_BOT_NAME} 使用条款</h1>
 <p><strong>生效日期：</strong>2022年1月1日</p>
 <p>使用 ${CHAT_BOT_NAME} 即表示您同意这些使用条款。</p>

 <h2>1. 条款接受</h2>
 <p>您必须年满 18 岁或获得监护人同意，并同意这些条款以及我们的隐私政策。</p>

 <h2>2. 提供的服务</h2>
 <p>我们提供域名注册、网站托管以及网站/应用程序设置支持。</p>

 <h2>3. 用户责任</h2>
 <p>提供准确的信息，避免非法活动，并保护您的 Telegram 账户安全。</p>

 <h2>4. 支付条款</h2>
 <p>所有支付均为最终支付，除非另有说明。未支付可能导致服务暂停。</p>

 <h2>5. 服务限制</h2>
 <p>我们可能会施加资源限制或因维护或技术问题而中断服务。</p>

 <h2>6. 终止</h2>
 <p>如有违规或未支付费用，我们可以终止服务。用户可以随时取消，但费用不予退还。</p>

 <h2>7. 责任</h2>
 <p>服务按“现状”提供。我们对数据丢失、中断或用户安全漏洞不承担责任。</p>

 <h2>8. 隐私</h2>
 <p>我们按照隐私政策管理您的数据，仅在法律要求时共享。</p>

 <h2>9. 条款变更</h2>
 <p>我们可能会更新这些条款，继续使用即表示您接受。</p>

 <h2>10. 联系</h2>
 <p>如需支持，请通过 <a href="${APP_SUPPORT_LINK}" target="_blank">${APP_SUPPORT_LINK}</a> 联系我们。</p>

 <p>使用 ${CHAT_BOT_NAME} 即表示您同意这些条款。谢谢！</p>`,
}

const termsAndConditionType = lang => ({
 reply_markup: {
 inline_keyboard: [
 [
 {
 text: '查看条款和条件',
 web_app: {
 url: `${SELF_URL}/terms-condition?lang=${lang}`,
 },
 },
 ],
 ],
 },
})

const planOptions = ['每日', '每周', '每月']
const planOptionsOf = {
 每日: 'Daily',
 每周: 'Weekly',
 每月: 'Monthly',
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
 [t.dnsQuickActions.pointToIp],
 [t.dnsQuickActions.googleEmail],
 [t.dnsQuickActions.zohoEmail],
 [t.dnsQuickActions.verification],
 [t.dnsQuickActions.addSubdomain],
 _bc,
 ],
 },
}

const dnsMxPriorityKeyboard = {
 parse_mode: 'HTML',
 reply_markup: {
 keyboard: [['1'], ['5'], ['10'], ['20'], ['50'], _bc],
 },
}

const dnsSubdomainTargetTypeKeyboard = {
 parse_mode: 'HTML',
 reply_markup: {
 keyboard: [[t.dnsQuickSubdomainIp], [t.dnsQuickSubdomainDomain], _bc],
 },
}

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
}

const dnsSrvDefaultsKeyboard = {
 parse_mode: 'HTML',
 reply_markup: {
 keyboard: [['10'], ['20'], ['50'], _bc],
 },
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
 text: '进行支付',
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
 autoRenew: false,
 storage: '10 GB SSD',
 bandwidth: '100 GB',
 domains: 'Unlimited Domains',
 ssl: 'Free SSL',
 protection: 'Anti-Red scanner IP cloaking, bot detection, scanner UA blocking.',
 panel: `Custom HostPanel with full file, DB & email management.`,
 },
 premiumCpanel: {
 name: 'Premium Anti-Red HostPanel (30 Days)',
 price: PREMIUM_ANTIRED_CPANEL_PRICE,
 duration: '30 days',
 autoRenew: true,
 storage: '50 GB SSD',
 bandwidth: '500 GB',
 domains: 'Unlimited Domains',
 ssl: 'Free SSL',
 protection: 'Anti-Red scanner IP cloaking, JS challenge bot detection, scanner UA & TLS fingerprint blocking.',
 panel: `Custom HostPanel with backups, migration & advanced tools.`,
 },
 goldenCpanel: {
 name: 'Golden Anti-Red HostPanel (30 Days)',
 price: GOLDEN_ANTIRED_CPANEL_PRICE,
 duration: '30 days',
 autoRenew: true,
 storage: '100 GB SSD',
 bandwidth: 'Unlimited',
 domains: 'Unlimited Domains',
 ssl: 'Free SSL + Wildcard',
 protection: 'Maximum Anti-Red: scanner IP cloaking, JS challenge, TLS/JA3 fingerprinting, Cloudflare WAF rules & priority support.',
 panel: `Custom HostPanel with staging, enhanced security & all advanced tools.`,
 },
 }
}
const hostingPlansText = {
 plans: plans,
 generatePlanText: (hostingType, planKey) => {
 const plan = plans(hostingType)[planKey]
 const renewText = plan.autoRenew ? '(auto-renew, can be disabled)' : '(no auto-renew)'
 return `<b>${plan.name}: $${plan.price}</b> ${renewText}

<b>Storage:</b> ${plan.storage}
<b>Bandwidth:</b> ${plan.bandwidth}
<b>Domains:</b> ${plan.domains}
<b>SSL:</b> ${plan.ssl}

<b>Anti-Red Protection:</b>
${plan.protection}

<b>Panel:</b>
${plan.panel}`
 },
 generatePlanStepText: step => {
 const commonSteps = {
 buyText: '不错的选择！您想如何连接域名？\n\n🌐 <b>注册新域名</b>\n📂 <b>使用我的域名</b> — 从您已注册的域名中选择\n🔗 <b>连接外部域名</b> — 使用您在别处拥有的域名',
 registerNewDomainText: '请输入您要注册的域名（例如：example.com）。',
 domainNotFound: '您输入的域名未找到。请确保输入正确或尝试使用其他域名。',
 useExistingDomainText: '请输入您的现有域名（例如：example.com）。',
 connectExternalDomainText: '请输入您的外部域名（例如：example.com）\n\n设置完成后，您需要将域名服务器指向 Cloudflare。',
 useExistingDomainNotFound: '您输入的域名与您的账户无关联。请检查输入是否正确或联系支持。',
 enterYourEmail: '请提供您的电子邮件地址以创建账户并发送收据。',
 invalidEmail: '请提供一个有效的电子邮件地址。',
 paymentConfirmation: '请确认交易以继续购买。',
 paymentSuccess: `我们正在验证您的付款。一旦确认，您将立即收到通知。感谢您的选择！`,
 paymentFailed: '付款失败，请重试。',
 }

 return `${commonSteps[step]}`
 },

 generateDomainFoundText: (websiteName, price) => `域名 ${websiteName} 可用！费用为 $${price}。`,
 generateExistingDomainText: websiteName => `您选择了 ${websiteName} 作为您的域名。`,
 connectExternalDomainText: websiteName => `您想将 <b>${websiteName}</b> 连接为您的域名。\n\n购买后，您需要将域名的名称服务器指向 Cloudflare。`,
 domainNotFound: websiteName => `域名 ${websiteName} 不可用。`,
 nameserverSelectionText: websiteName => `请选择您想为 ${websiteName} 使用的域名服务器提供商。`,
 confirmEmailBeforeProceeding: email => `您确定要继续使用此电子邮件 ${email} 吗？`,

 generateInvoiceText: payload => `
<b>域名注册</b>
<b>- 域名： </b> ${payload.domainName}
<b>- 费用： </b> $${payload?.existingDomain ? '0（使用现有域名）' : payload.domainPrice}
 
<b>网站托管</b>
<b>- 时长： </b> 1 个月
<b>- 费用： </b> $${payload.hostingPrice}
 
<b>总金额：</b>
<b>- 优惠券折扣： </b> $${payload.couponDiscount}
<b>- USD： </b> $${payload?.couponApplied ? payload.newPrice : payload.totalPrice}
<b>- 税费： </b> $0.00
 
<b>付款条款</b>
这是一份预付款发票。请确保在 1 小时内完成付款，以便激活您的域名和托管服务。收到付款后，我们将立即为您激活服务。
`,

 showCryptoPaymentInfo: (priceUsd, priceCrypto, tickerView, address, plan) => `💰 <b>合计: $${Number(priceUsd).toFixed(2)} USD</b>

请发送 <b>${priceCrypto} ${tickerView}</b> 至:

<code>${address}</code>

支付确认后，您的 ${plan} 将自动激活（通常只需几分钟）。`,

 successText: (info, response) =>
 `您的托管已上线。

<b>域名：</b> ${info.website_name}
${info.email ? `<b>电子邮件：</b> ${info.email}\n` : ''}DNS 已通过 Cloudflare 自动配置。`,

 support: (plan, statusCode) => `设置过程中出现问题 ${plan} | ${statusCode}. 
 请点击 💬 获取支持.
 更多信息 ${TG_HANDLE}.`,

 bankPayDomain: (
 priceNGN,
 plan,
 ) => `请支付 ${priceNGN} NGN 并点击“付款”按钮。交易确认后，您将立即收到通知，并且您的 ${plan} 将无缝激活。

此致，
${CHAT_BOT_NAME}`,
}

const vpsBC = ['🔙 返回', '取消']

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
 hourly: '按小时',
 monthly: '每月',
 quaterly: '季度',
 annually: '每年',
}

const vpsPlanMenu = ['按小时', '每月', '季度', '每年']
const vpsConfigurationMenu = ['基本', '标准', '高级', '企业']
const vpsCpanelOptional = ['WHM', 'Plesk', '❌ 跳过控制面板']

const vpsPlanOf = {
 按小时: 'hourly',
 每月: 'monthly',
 季度: 'quaterly',
 每年: 'annually',
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
 incomingCallBlockedWalletEmpty: '⚠️ <b>来电已拦截</b> — 您的钱包为空。请充值以接听电话。',
  overageActive: (chargedStr, region, currency) => `💰 <b>Overage Active</b> — Plan minutes exhausted. ${chargedStr} (${region}) from ${currency} wallet.`,
  callEndedPlanWalletExhausted: (elapsedMin) => `🚫 <b>Call Ended</b> — Plan minutes + wallet exhausted.\n⏱️ ~${elapsedMin} min. Top up wallet or upgrade plan.`,
  incomingCall: (fromPhone, toPhone) => `📞 <b>Incoming Call</b>\n${fromPhone} → ${toPhone}\nRinging your SIP device...`,
  outboundCallingLocked: `🚫 <b>Outbound Calling Locked</b>\n\n`,
 testCallsExpired: '⚠️ 您的测试通话已过期。请订阅套餐以继续。',
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
 back: '🔙 返回',
 skip: '❌ 跳过',
 cancel: '❌ 取消',

 // VPS/RDP choice (Step 1)
 vpsLinuxBtn: '🐧 Linux VPS (SSH)',
 vpsRdpBtn: '🪟 Windows RDP',
 askVpsOrRdp: `🖥️ 您需要什么类型的服务器？

📬 <b>端口25开放</b> — 直接从服务器发送邮件

<strong>🐧 Linux VPS</strong> — SSH访问 · 网站托管 · 开发 · 自动化
<strong>🪟 Windows RDP</strong> — 远程桌面 · Windows 应用和工具`,

 askCountryForUser: `🌍 选择最接近用户的区域：`,
 chooseValidCountry: '请从列表中选择一个国家：',
 askRegionForUser: country => `📍 选择 ${country} 内的数据中心（价格可能因位置而异）。`,
 chooseValidRegion: '请从列表中选择有效的地区：',
 askZoneForUser: region => `📍 选择 ${region} 内的可用区。`,

 chooseValidZone: '请选择列表中的有效区域：',
 confirmZone: (region, zone) => `✅ 您选择了${region}（${zone}）。您要继续选择此项吗？`,
 failedFetchingData: '获取数据时出错，请稍后再试。',
 confirmBtn: `✅ 确认选择`,

 askVpsDiskType: list => `💾 <b>选择存储类型</b>

两种选项价格相同 — 选择对您更重要的：

${list?.map(item => `${item.description}`).join('\n\n')}

👇 点击您的选择：`,

 chooseValidDiskType: '请选择有效的磁盘类型',

 askPlanType: plans => `💳 选择账单周期：

${plans
 .map(
 item =>
 `<strong>• ${item.type === 'Hourly' ? '⏳' : '📅'} ${item.type} –</strong> $${item.originalPrice} ${
 item.discount === 0 ? '(无折扣）' : `（包括 ${item.discount}% 折扣）`
 }`,
 )
 .join('\n')}`,
 planTypeMenu: vpsOptionsOf(vpsPlanMenu),
 // Billing (Monthly only)
 hourlyBillingMessage: '',

 // 配置
 askVpsConfig: list => `⚙️ 选择方案：
 
${list
 .map(
 config =>
 `<strong>• ${config.name}</strong> — ${config.specs.vCPU} vCPU · ${config.specs.RAM}GB RAM · ${config.specs.disk}GB ${config.specs.diskType}`,
 )
 .join('\n')}`,

 validVpsConfig: '请选择一个有效的VPS配置：',

 configMenu: vpsOptionsOf(vpsConfigurationMenu),

 askForCoupon: '🎟️ 有优惠券代码吗？输入它可享受额外折扣（如适用），或者跳过此步骤。任何计费周期折扣已包含在内。',
 couponInvalid: `❌ 无效：代码已过期、不适用或输入错误。请重试。`,
 couponValid: amt => `✅ 有效：应用的折扣：-$${amt}。`,
 skipCouponwarning: `⚠️ 跳过意味着您以后无法再应用折扣。`,
 confirmSkip: '✅ 确认跳过',
 goBackToCoupon: '❌ 返回并应用优惠券',

 askVpsOS: () => `💻 选择 Linux 发行版（默认：Ubuntu）：

<strong>💡 推荐：</strong>
<strong>• Ubuntu</strong> — 通用 & 开发
<strong>• AlmaLinux / Rocky</strong> — 企业级稳定
<strong>• Debian</strong> — 轻量 & 可靠`,
 chooseValidOS: `请选择可用列表中的有效操作系统：`,
 skipOSBtn: '❌ 跳过操作系统选择',
 skipOSwarning: '⚠️ 您的VPS将没有操作系统启动。您需要通过SSH或恢复模式手动安装一个。',

 askVpsCpanel: `🛠️ 选择控制面板以更轻松地管理服务器（可选.

<strong>• ⚙️ WHM –</strong> 推荐用于托管多个网站
<strong>• ⚙️ Plesk –</strong> 适用于管理个人网站和应用程序
<strong>• ❌ 跳过 –</strong> 不安装控制面板`,

 cpanelMenu: vpsOptionsOf(vpsCpanelOptional),
 noControlPanel: vpsCpanelOptional[2],
 skipPanelMessage: '⚠️ 将不会安装控制面板。您可以稍后手动安装。',
 validCpanel: '请选择一个有效的控制面板或跳过。',

 askCpanelOtions: (name, list) => `⚙️ 选择 ${
 name == 'whm' ? 'WHM' : 'Plesk Web Host Edition'
 } 许可证，或选择免费试用（有效期 ${name == 'whm' ? '15' : '7'} 天）。
 
💰 ${name == 'whm' ? 'WHM' : 'Plesk'} 许可证定价：

${list.map(item => `${name == 'whm' ? `<strong>• ${item.name} - </strong>` : ''}${item.label}`).join('\n')}`,

 trialCpanelMessage: panel =>
 `✅ ${panel.name == 'whm' ? 'WHM' : 'Plesk'} 免费试用（${panel.duration} 天）已激活。您可以随时联系支持进行升级。`,

 vpsWaitingTime: '⚙️ 正在获取详细信息... 这只需要一点时间。',
 failedCostRetrieval: '获取成本信息失败... 请稍后再试。',

 errorPurchasingVPS: plan => `在设置您的 ${plan} VPS 计划时出现问题。

请点击 💬 获取支持。
了解更多 ${TG_HANDLE}。`,

 generateBillSummary: vpsDetails => {
 const planPrice = vpsDetails.couponApplied ? vpsDetails.planNewPrice : vpsDetails.plantotalPrice
 const total = vpsDetails.totalPrice || Number(planPrice).toFixed(2)
 const isRDP = vpsDetails.isRDP
 const osLabel = isRDP ? '🪟 Windows Server (RDP)' : (vpsDetails.os?.name || 'Ubuntu')
 
 let summary = `<strong>📋 订单摘要：</strong>

<strong>🖥️ ${vpsDetails.config.name}</strong> — ${vpsDetails.config.specs.vCPU} vCPU · ${vpsDetails.config.specs.RAM}GB RAM · ${vpsDetails.config.specs.disk}GB ${vpsDetails.config.specs.diskType}
<strong>📍 区域：</strong> ${vpsDetails.regionName || vpsDetails.country}
<strong>💻 OS：</strong> ${osLabel}`

 if (isRDP) {
 summary += `\n<strong>🪟 Windows 许可证：</strong> 已包含`
 }
 if (vpsDetails.couponApplied && vpsDetails.couponDiscount > 0) {
 summary += `\n<strong>🎟️ 优惠券：</strong> -$${Number(vpsDetails.couponDiscount).toFixed(2)} USD`
 }
 summary += `\n<strong>🔄 自动续费：</strong> ✅ 启用`
 summary += `\n\n<strong>💰 总计：$${total} USD/月</strong>`
 summary += `\n\n<strong>✅ 是否继续下单？</strong>`
 return summary
 },
 no: '❌ 取消订单',
 yes: '✅ 确认订单',
 askPaymentMethod: '选择支付方式：',

 showDepositCryptoInfoVps: (priceUsd, priceCrypto, tickerView, address, vpsDetails) =>
 `💰 <b>支付金额: $${Number(priceUsd).toFixed(2)} USD</b>

请发送 <b>${priceCrypto} ${tickerView}</b> 至:

<code>${address}</code>

您的 ${vpsDetails?.plan || 'VPS'} 计划将在支付确认后自动激活（通常只需几分钟）。

此致,
${CHAT_BOT_NAME}`,

 extraMoney: '您的按小时计费计划的剩余金额已存入钱包。',
 paymentRecieved: `✅ 支付成功！您的 VPS 正在设置中。详细信息很快将可用，并会通过电子邮件发送给您以方便查看。`,
 paymentFailed: `❌ 支付失败。请检查您的支付方式或重试。`,

 lowWalletBalance: vpsName => `
您的 VPS 计划实例 ${vpsName} 已因余额不足而停止。

请充值您的钱包以继续使用 VPS 计划。`,

 vpsBoughtSuccess: (vpsDetails, response, credentials) => {
 const isRDP = response.isRDP || vpsDetails.isRDP || response.osType === 'Windows'
 const connectInfo = isRDP
 ? ` <strong>• 连接:</strong> 🖥 远程桌面 → <code>${response.host}:3389</code>\n <strong>• 方法:</strong> 打开远程桌面连接 (mstsc) 并输入上述地址。`
 : ` <strong>• 连接:</strong> 💻 <code>ssh ${credentials.username}@${response.host}</code>`
 
 const passwordWarning = isRDP
 ? `\n⚠️ <strong>重要 - 立即保存您的密码！</strong>\n• 出于安全原因，我们以后无法检索它\n• 如果丢失，请从 VPS 管理使用"重置密码"（数据将被保留）\n• 点击上方密码以显示并复制\n`
 : `\n⚠️ <strong>请安全保存您的凭据！</strong>\n`
 
 return `<strong>🎉 ${isRDP ? 'RDP' : 'VPS'} [${response.label}] 已激活！</strong>

<strong>🔑 登录凭据:</strong>
 <strong>• IP:</strong> ${response.host}
 <strong>• 操作系统:</strong> ${vpsDetails.os ? vpsDetails.os.name : (isRDP ? 'Windows Server' : 'Linux')}
 <strong>• 用户名:</strong> ${credentials.username}
 <strong>• 密码:</strong> <tg-spoiler>${credentials.password}</tg-spoiler>（立即更改）

<strong>🔗 连接方式:</strong>
${connectInfo}
${passwordWarning}
📧 这些详细信息也已发送到您的注册电子邮件。请保管好它们。

感谢您选择我们的服务
${CHAT_BOT_NAME}
`
 },
 vpsHourlyPlanRenewed: (vpsName, price) => `
您的 VPS 计划实例 ${vpsName} 已成功续订。
${price}$ 已从您的钱包中扣除。`,

 vpsMonthlyPlanRenewed: (vpsName, planPrice) =>
 `✅ 您的 VPS <b>${vpsName}</b> 已自动续订 1 个月。\n💰 $${planPrice} 已从钱包中扣除。`,

 vpsExpiredNoAutoRenew: (vpsName) =>
 `⚠️ 您的 VPS <b>${vpsName}</b> 已过期。自动续订已禁用。\n请手动续订以继续使用服务。`,

 bankPayVPS: (
 priceNGN,
 plan,
 ) => `请点击“进行支付”以汇款 ${priceNGN} NGN。交易确认后，您将及时收到通知，您的 ${plan} VPS 计划将顺利激活。

此致,
${CHAT_BOT_NAME}`,

 askAutoRenewal: `🔄 启用自动续订，以确保服务不中断？ 

🛑 续订前您将收到提醒，您可以随时禁用。`,
 enable: '✅ 启用',
 skipAutoRenewalWarming: expiresAt =>
 `⚠️ 您的 VPS 将于 ${new Date(expiresAt).toLocaleDateString('zh-CN').replace(/\//g, '-')} ${new Date(
 expiresAt,
 ).toLocaleTimeString('zh-CN', {
 hour: '2-digit',
 minute: '2-digit',
 hour12: false,
 })} 到期，服务可能会中断。`,

 generateSSHKeyBtn: '✅ 生成新密钥',
 linkSSHKeyBtn: '🗂️ 关联现有密钥',
 skipSSHKeyBtn: '❌ 跳过（使用密码登录）',
 noExistingSSHMessage: '🔑 未检测到 SSH 密钥。您想生成新的 SSH 密钥以确保安全访问，还是使用密码登录（安全性较低）？',
 existingSSHMessage: '🔑 您已有 SSH 密钥。请选择一个选项：',
 confirmSkipSSHMsg: `⚠️ 警告：密码登录的安全性较低，容易受到攻击。
🔹 我们强烈建议使用 SSH 密钥。您确定要继续吗？`,
 confirmSkipSSHBtn: '✅ 仍然继续',
 setUpSSHBtn: '🔄 设置 SSH 密钥',
 sshLinkingSkipped: '❌ SSH 密钥关联已跳过，未进行任何更改。',
 newSSHKeyGeneratedMsg: name => `✅ SSH 密钥（${name}）已创建。
⚠️ 请妥善保存此密钥 – 以后可以再次检索。`,
 selectSSHKey: '🗂️ 选择一个现有的 SSH 密钥以关联到您的 VPS：',
 uploadNewKeyBtn: '➕ 上传新密钥',
 cancelLinkingSSHKey: `❌ SSH 密钥关联已取消，未进行任何更改。`,
 selectValidSShKey: '请选择列表中的有效 SSH 密钥。',
 sshKeySavedForVPS: name => `✅ SSH 密钥（${name}）将关联到新的 VPS。`,
 askToUploadSSHKey: `📤 请上传您的 SSH 公钥（.pub 文件）或在下方粘贴密钥。`,
 failedGeneratingSSHKey: '无法生成新的 SSH 密钥。请重试或使用其他方法。',
 newSSHKeyUploadedMsg: name => `✅ SSH 密钥（${name}）已成功上传并将关联到 VPS。`,
 fileTypePub: '文件类型应为 .pub',

 vpsList: list => `<strong>🖥️ 活跃的 VPS 实例：</strong>

${list
 .map(vps => `<strong>• ${vps.name} :</strong> ${vps.status === 'RUNNING' ? '🟢' : '🔴'} ${vps.status}`)
 .join('\n')}
`,
 noVPSfound: '没有活跃的 VPS 实例。请创建一个新的。',
 selectCorrectOption: '请选择列表中的一个选项',
 selectedVpsData: data => `<strong>🖥️ VPS ID：</strong> ${data.name}

<strong>• 计划：</strong> ${data.planDetails.name}
<strong>• vCPUs：</strong> ${data.planDetails.specs.vCPU} | RAM: ${data.planDetails.specs.RAM} GB | 硬盘：${
 data.planDetails.specs.disk
 } GB (${data.diskTypeDetails.type})
<strong>• 操作系统：</strong> ${data.osDetails.name}
<strong>• 控制面板：</strong> ${
 data.cPanelPlanDetails && data.cPanelPlanDetails.type ? data.cPanelPlanDetails.type : '无'
 }
<strong>• 状态：</strong> ${data.status === 'RUNNING' ? '🟢' : '🔴'} ${data.status}
<strong>• 自动续费：</strong> ${data.autoRenewable ? '已启用' : '已禁用'}
<strong>• IP 地址：</strong> ${data.host}`,
 stopVpsBtn: '⏹️ 停止',
 startVpsBtn: '▶️ 启动',
 restartVpsBtn: '🔄 重启',
 deleteVpsBtn: '🗑️ 删除',
 subscriptionBtn: '🔄 订阅',
 VpsLinkedKeysBtn: '🔑 SSH 密钥',
 resetPasswordBtn: '🔑 重置密码',
 reinstallWindowsBtn: '🔄 重装 Windows',
 confirmChangeBtn: '✅ 确认',

 confirmStopVpstext: name => `⚠️ 您确定要停止 VPS <strong>${name}</strong> 吗？`,
 vpsBeingStopped: name => `⚙️ 请稍等，您的 VPS (${name}) 正在停止中`,
 vpsStopped: name => `✅ VPS (${name}) 已停止。`,
 failedStoppingVPS: name => `❌ 停止 VPS (${name}) 失败。

请稍后再试。`,
 vpsBeingStarted: name => `⚙️ 请稍等，您的 VPS (${name}) 正在启动中`,
 vpsStarted: name => `✅ VPS (${name}) 现已运行。`,
 failedStartedVPS: name => `❌ 启动 VPS (${name}) 失败。

请稍后再试。`,
 vpsBeingRestarted: name => `⚙️ 请稍等，您的 VPS (${name}) 正在重启中`,
 vpsRestarted: name => `✅ VPS (${name}) 已成功重启。`,
 failedRestartingVPS: name => `❌ 重启 VPS (${name}) 失败。

请稍后再试。`,
 confirmDeleteVpstext: name => `⚠️ 警告：删除此 VPS ${name} 是永久性的，所有数据将丢失。
 • 未使用的订阅时间不予退款。
 • 自动续订将被取消，不会产生额外费用。
 
您确定要继续吗？`,

 confirmResetPasswordText: name => `🔑 <strong>重置 RDP 密码</strong>

⚠️ <strong>重要提示：</strong>
• 您当前的密码将停止工作
• 将生成新密码
• 所有数据和文件将被保留
• 您需要新密码才能访问 RDP

您确定要重置 <strong>${name}</strong> 的密码吗？`,

 confirmReinstallWindowsText: name => `🔄 <strong>重装 Windows</strong>

⚠️ <strong>严重警告：</strong>
• 这将删除您 RDP 上的所有数据
• 所有文件、程序和设置将被删除
• 将创建全新的 Windows 安装
• 将生成新凭据
• 您的旧密码将不再有效

💾 <strong>建议：</strong> 继续之前请创建备份/快照。

您确定要在 <strong>${name}</strong> 上重装 Windows 吗？`,

 passwordResetInProgress: name => `🔄 正在重置 <strong>${name}</strong> 的密码...

⏱️ 这可能需要 30-60 秒。请稍候。`,

 passwordResetSuccess: (name, ip, username, password) => `✅ <strong>密码重置成功！</strong>

🖥️ <strong>RDP：</strong> ${name}
🌐 <strong>IP：</strong> ${ip}
👤 <strong>用户名：</strong> ${username}
🔑 <strong>新密码：</strong> <code>${password}</code>

⚠️ <strong>重要 - 立即保存此密码！</strong>
• 出于安全原因，我们以后无法检索它
• 如果丢失，您必须再次重置密码（数据将被保留）
• 您的旧密码不再有效

💡 点击密码即可复制。`,

 windowsReinstallInProgress: name => `🔄 正在 <strong>${name}</strong> 上重装 Windows...

⏱️ 此过程需要 5-10 分钟。
📧 完成后您将收到新凭据。`,

 windowsReinstallSuccess: (name, ip, username, password) => `🎉 <strong>Windows 重装成功！</strong>

🖥️ <strong>RDP：</strong> ${name}
🌐 <strong>IP：</strong> ${ip}
👤 <strong>用户名：</strong> ${username}
🔑 <strong>密码：</strong> <code>${password}</code>

⚠️ <strong>严重警告 - 立即保存此密码！</strong>
• 出于安全原因，我们以后无法检索它
• 所有以前的数据已被删除
• 这是全新的 Windows 安装
• 如果丢失此密码，您必须重置它（使用"重置密码"按钮）

💡 点击密码即可复制。
🚀 您的 RDP 已准备好使用这些新凭据！`,

 passwordResetFailed: name => `❌ <strong>密码重置失败</strong>

重置 <strong>${name}</strong> 的密码失败。

请几分钟后重试，如果问题仍然存在，请联系支持。`,

 windowsReinstallFailed: name => `❌ <strong>Windows 重装失败</strong>

在 <strong>${name}</strong> 上重装 Windows 失败。

请几分钟后重试，如果问题仍然存在，请联系支持。`,

 rdpNotSupported: `⚠️ 此功能仅适用于 Windows RDP 实例。

您的 VPS 运行 Linux。请改用 SSH 密钥进行访问管理。`,
 vpsBeingDeleted: name => `⚙️ 请稍等，您的 VPS (${name}) 正在删除中`,
 vpsDeleted: name => `✅ VPS (${name}) 已永久删除。`,
 failedDeletingVPS: name => `❌ 删除 VPS (${name}) 失败。

请稍后再试。`,

 upgradeVpsBtn: '⬆️ 升级',
 upgradeVpsPlanBtn: '⬆️ VPS 计划',
 upgradeVpsDiskBtn: '📀 磁盘类型',
 upgradeVpsDiskTypeBtn: '💾 升级磁盘类型',
 upgradeVPS: '选择升级类型',
 upgradeOptionVPSBtn: to => {
 return `🔼 升级到 ${to}`
 },
 upgradeVpsPlanMsg: options => `⚙️ 选择一个新计划以扩展您的 VPS 资源。
💡 升级增加 vCPUs、RAM 和存储，但无法撤销。

📌 可用的升级：
${options
 .map(
 planDetails =>
 `<strong>• ${planDetails.from} ➡ ${planDetails.to} –</strong> $${planDetails.monthlyPrice}/月 ($${planDetails.hourlyPrice}/小时)`,
 )
 .join('\n')}

💰 账单通知：您的当前计划将因未使用的天数而获得信用，并且新费率将在账单周期的其余部分应用（按比例调整）。`,

 alreadyEnterprisePlan: '⚠️ 您已在最高可用计划（企业版）上。无法进行进一步的升级。',

 alreadyHighestDisk: vpsData => `⚠️ 您已在最高可用磁盘（${vpsData.diskTypeDetails.type}）上。无法进行进一步的升级。`,
 newVpsDiskBtn: type => `升级到 ${type}`,
 upgradeVpsDiskMsg: upgrades => `💾 升级您的存储类型以获得更好的性能。
⚠️ 磁盘升级是永久性的，不能降级。

📌 可用选项：
${upgrades.map(val => `<strong>• ${val.from} ➡ ${val.to} –</strong> +$${val.price}/${val.duration}`).join('\n')}

💰 账单通知：如果在账单周期中途应用升级，将按比例调整当前账单周期未使用的部分。`,
 upgradePlanSummary: (newData, vpsDetails, lowBal) => `<strong>📜 订单摘要：</strong>

<strong>• VPS ID：</strong> ${vpsDetails.name}
<strong>• 旧计划：</strong> ${newData.upgradeOption.from}
<strong>• 新计划：</strong> ${newData.upgradeOption.to}
<strong>• 计费周期：</strong> ${newData.billingCycle}
<strong>• 新计费费率：</strong> $${newData.totalPrice} USD${
 newData.billingCycle === 'Hourly' ? '/小时' : '（已应用按比例调整）'
 }
<strong>• 生效日期：</strong> 立即生效
${
 lowBal
 ? `
💡 注意：您的总费用中包含 $${VPS_HOURLY_PLAN_MINIMUM_AMOUNT_PAYABLE} USD 预存款。在扣除首小时费用后，剩余的预存款将存入您的钱包。
`
 : ''
}
<strong>• 总价格：</strong> $${lowBal ? VPS_HOURLY_PLAN_MINIMUM_AMOUNT_PAYABLE : newData.totalPrice} USD

<strong>✅ 是否继续下单？</strong>`,

 upgradeDiskSummary: (newData, vpsDetails, lowBal) => `<strong>📜 订单摘要：</strong>

<strong>• VPS ID：</strong> ${vpsDetails.name}
<strong>• 旧磁盘类型：</strong> ${newData.upgradeOption.from}
<strong>• 新磁盘类型：</strong> ${newData.upgradeOption.to}
<strong>• 计费周期：</strong> ${newData.billingCycle}
<strong>• 新计费费率：</strong> $${newData.totalPrice} USD${
 newData.billingCycle === 'Hourly' ? '/小时' : '（已应用按比例调整）'
 }
${
 lowBal
 ? `
注意：您的总额包含 $${VPS_HOURLY_PLAN_MINIMUM_AMOUNT_PAYABLE} USD 的押金。扣除第一个小时费率后，剩余押金将计入您的钱包。
`
 : ''
}
<strong>• 总价格：</strong> $${lowBal ? VPS_HOURLY_PLAN_MINIMUM_AMOUNT_PAYABLE : newData.totalPrice} USD

<strong>✅ 是否继续下单？</strong>`,

 vpsSubscriptionData: (vpsData, planExpireDate, panelExpireDate) => `<strong>🗂️ 您的有效订阅：</strong>

<strong>• VPS ${vpsData.name} </strong> – 到期日期：${planExpireDate} (自动续订：${
 vpsData.autoRenewable ? '已启用' : '已禁用'
 })
<strong>• 控制面板 ${vpsData?.cPanelPlanDetails ? vpsData.cPanelPlanDetails.type : '：未选择'} </strong> ${
 vpsData?.cPanelPlanDetails
 ? `${vpsData?.cPanelPlanDetails.status === 'active' ? '- 到期日期：' : '- 已过期：'}${panelExpireDate}`
 : ''
 } `,

 manageVpsSubBtn: '🖥️ 管理VPS订阅',
 manageVpsPanelBtn: '🛠️ 管理控制面板订阅',

 vpsSubDetails: (data, date) => `<strong>📅 VPS订阅详情：</strong>

<strong>• VPS ID：</strong> ${data.name}
<strong>• 计划：</strong> ${data.planDetails.name}
<strong>• 当前到期日期：</strong> ${date}
<strong>• 自动续订：</strong> ${data.autoRenewable ? '启用' : '禁用'}`,

 vpsCPanelDetails: (data, date) => `<strong>📅 控制面板订阅详情：</strong>

<strong>• 关联的 VPS ID：</strong> ${data.name}
<strong>• 控制面板类型：</strong> ${data.cPanelPlanDetails.type} (${data.cPanelPlanDetails.name})
<strong>• 当前到期日期：</strong> ${date}
<strong>• 自动续订：</strong> ${data.autoRenewable ? '已启用' : '已禁用'}
`,

 vpsEnableRenewalBtn: '🔄 启用自动续订',
 vpsDisableRenewalBtn: '❌ 禁用自动续订',
 vpsPlanRenewBtn: '📅 立即续订',
 unlinkVpsPanelBtn: '❌ 取消与VPS的链接',
 bankPayVPSUpgradePlan: (priceNGN, vpsDetails) =>
 `请点击下方的“付款”按钮支付 ${priceNGN} NGN。一旦交易确认，您将立即收到通知，您的新 ${vpsDetails.upgradeOption.to} VPS 方案将无缝激活。`,

 bankPayVPSUpgradeDisk: (priceNGN, vpsDetails) =>
 `请通过点击“付款”来支付 ${priceNGN} NGN。交易确认后，您将立即收到通知，您的VPS计划将以新磁盘类型 ${vpsDetails.upgradeOption.toType} 配置无缝激活。`,

 showDepositCryptoInfoVpsUpgrade: (priceUsd, priceCrypto, tickerView, address) =>
 `💰 <b>支付金额: $${Number(priceUsd).toFixed(2)} USD</b>

请发送 <b>${priceCrypto} ${tickerView}</b> 至:

<code>${address}</code>

您升级的 VPS 计划将在支付确认后自动激活（通常只需几分钟）。

此致,
${CHAT_BOT_NAME}`,

 linkVpsSSHKeyBtn: '➕ 关联新密钥',
 unlinkSSHKeyBtn: '❌ 取消关联密钥',
 downloadSSHKeyBtn: '⬇️ 下载密钥',

 noLinkedKey: name => `⚠️ 当前没有SSH密钥与该VPS [${name}] 关联。

请将SSH密钥关联到您的账户，以启用安全访问。`,

 linkedKeyList: (list, name) => `🗂️ 与VPS ${name} 关联的SSH密钥：

${list.map(val => `<strong>• ${val}</strong>`).join('\n')}`,

 unlinkSSHKeyList: name => `🗂️ 选择一个SSH密钥从VPS [${name}] 中移除：`,

 confirmUnlinkKey: data => `⚠️ 确定要将 [${data.keyForUnlink}] 从 VPS [${data.name}] 解绑吗？`,
 confirmUnlinkBtn: '✅ 确认解绑',
 keyUnlinkedMsg: data => `✅ SSH 密钥 [${data.keyForUnlink}] 已成功从 VPS [${data.name}] 解绑。`,
 failedUnlinkingKey: data => `❌ SSH 密钥解绑失败（VPS: ${data.name}）。 

请稍后重试。`,

 userSSHKeyList: name => `🗂️ 选择一个 SSH 密钥以链接到 VPS [${name}]：`,
 noUserKeyList: `🔑 未检测到 SSH 密钥。是否要上传新的 SSH 密钥？`,
 linkKeyToVpsSuccess: (key, name) => `✅ SSH 密钥 [${key}] 成功链接到 VPS [${name}]。`,
 failedLinkingSSHkeyToVps: (key, name) => `❌ SSH 密钥 [${key}] 绑定到 VPS (${name}) 失败。 

请稍后重试。`,

 selectSSHKeyToDownload: '🗂️ 请选择要下载的 SSH 密钥：',

 disabledAutoRenewal: (data, expiryDate) => `⚠️ 自动续订已禁用。您的 VPS 将于 ${expiryDate} 过期，除非手动续订。
✅ 自动续订已成功禁用。`,

 enabledAutoRenewal: (data, expiryDate) => `✅ 自动续订已启用。您的 VPS 将于 ${expiryDate} 自动续订。`,

 renewVpsPlanConfirmMsg: (data, vpsDetails, expiryDate, lowBal) => `<strong>📜 发票摘要</strong>

<strong>• VPS ID：</strong> ${vpsDetails.name}
<strong>• 计划：</strong> ${vpsDetails.planDetails.name}
<strong>• 计费周期：</strong> ${vpsDetails.billingCycleDetails.type}
<strong>• 当前到期日期：</strong> ${expiryDate}
<strong>• 应付金额：</strong> ${data.totalPrice} USD

${
 lowBal
 ? `注意：您的总金额中包含 $${VPS_HOURLY_PLAN_MINIMUM_AMOUNT_PAYABLE} USD 的押金。第一小时费用扣除后，剩余押金将退还到您的钱包。`
 : ''
}

<strong>• 总价：</strong> $${
 lowBal
 ? VPS_HOURLY_PLAN_MINIMUM_AMOUNT_PAYABLE
 : data.totalPrice
 } USD

<strong>💳 是否继续续订 VPS？</strong>`,

 payNowBtn: '✅ 立即支付',

 vpsChangePaymentRecieved: `✅ 付款成功！您的 VPS 正在配置中，详细信息将很快提供。`,

 bankPayVPSRenewPlan: priceNGN =>
 `请点击下方的“支付”按钮支付 ${priceNGN} NGN。一旦交易确认，您将立即收到通知，您的 VPS 计划将被激活并续订。`,

 renewVpsPanelConfirmMsg: (data, panelDetails, date) => `<strong>💳 是否继续续订控制面板？</strong>

<strong>📜 发票摘要</strong>
 <strong>• 关联的 VPS ID：</strong> ${data.name}
 <strong>• 控制面板：</strong> ${panelDetails.type}
 <strong>• 续订周期：</strong> ${panelDetails.durationValue}${' '}个月
 <strong>• 当前到期日期：</strong> ${date}
 <strong>• 应付金额：</strong> ${data.totalPrice} USD`,

 bankPayVPSRenewCpanel: (priceNGN, vpsDetails) =>
 `请点击下方的“支付”按钮支付 ${priceNGN} NGN。一旦交易确认，您将立即收到通知，您的 VPS 计划将被激活，并且 ${vpsDetails.cPanelPlanDetails.type} 控制面板将被续订。`,

 vpsUnlinkCpanelWarning: vpsDetails =>
 `⚠️ 警告：取消关联将从 VPS ${vpsDetails.name} 中移除 ${vpsDetails.cPanel} 许可证，您将无法使用其功能。是否继续？`,

 unlinkCpanelConfirmed: data => `✅ 控制面板 ${data.cPanel} 已成功从 VPS ${data.name} 取消关联。`,

 errorUpgradingVPS: vpsName => `升级 VPS 计划 ${vpsName} 时出现错误。

请点击 💬 获取支持。
了解更多信息 ${TG_HANDLE}。`,

 vpsUpgradePlanTypeSuccess: vpsDetails => `
✅ VPS ${vpsDetails.name} 已成功升级至 ${vpsDetails.upgradeOption.to}。您的新资源现已可用。`,

 vpsUpgradeDiskTypeSuccess: vpsDetails =>
 `✅ VPS ${vpsDetails.name} 的磁盘已成功升级至 ${vpsDetails.upgradeOption.to}。您的新磁盘类型现已激活。`,

 vpsRenewPlanSuccess: (vpsDetails, expiryDate) =>
 `✅ VPS订阅 ${vpsDetails.name} 已成功续订！

• 新到期日期：${expiryDate}
`,
 vpsRenewCPanelSuccess: (vpsDetails, expiryDate) =>
 `✅ ${vpsDetails.name} 的控制面板订阅已成功续订！

• 新到期日期：${expiryDate}
`,
}

const zh = {
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
 planOptionsOf,
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
 dnsQuickActions: t.dnsQuickActions,
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
 hP: hostingPlansText,
 selectFormatOf,
 vs,
 vp,
 vpsPlanOf,
 vpsCpanelOptional,
}

module.exports = {
 zh,
 setCustomNsPrompt: (domain, nsRecords) => {
 let msg = `<b>✏️ 为 ${domain} 设置自定义名称服务器</b>\n\n`
 if (nsRecords && nsRecords.length) {
 msg += `<b>当前:</b>\n`
 nsRecords.forEach((ns, i) => {
 msg += ` NS${i + 1}: <code>${ns.recordContent || '—'}</code>\n`
 })
 msg += '\n'
 }
 msg += `输入新的名称服务器（每行一个，最少2个，最多4个）:\n\n<i>示例:\nns1.example.com\nns2.example.com</i>`
 return msg
 },
 Hosting: '托管',
}
