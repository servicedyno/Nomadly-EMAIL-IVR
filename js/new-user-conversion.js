// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// New User Conversion Engine
// 5 features to convert new users into paying customers:
// 1. Guided Onboarding Sequence (interactive 3-step intro)
// 2. First-Purchase Deposit Bonus ($5 on first deposit ≥$20)
// 3. Time-Limited Welcome Offer (25% off, sent 2h after signup)
// 4. Browse-Based Follow-Up (personalized nudge after browsing)
// 5. Social Proof (purchase counts in product menus, ×30 multiplier)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const { customAlphabet } = require('nanoid')
const generateCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6)
const log = (...args) => console.log(new Date().toISOString().slice(11, 19), ...args)

// ━━━ Config ━━━
const FIRST_DEPOSIT_BONUS_USD = 5
const FIRST_DEPOSIT_MIN_USD = 20
const WELCOME_OFFER_DELAY_MS = 2 * 60 * 60 * 1000 // 2 hours
const WELCOME_OFFER_DISCOUNT = 25 // percent
const WELCOME_OFFER_EXPIRY_HOURS = 24
const BROWSE_FOLLOWUP_DELAY_MS = 2 * 60 * 60 * 1000 // 2 hours
const SOCIAL_PROOF_MULTIPLIER = 3
const SOCIAL_PROOF_REFRESH_MS = 60 * 60 * 1000 // 1 hour

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FEATURE 1: Guided Onboarding Sequence
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const ONBOARDING_MESSAGES = {
  en: {
    step1: (name, amount) =>
      `🎉 <b>Welcome, ${name}!</b>\n\n` +
      `You've got <b>$${amount}</b> in your wallet to start with!\n\n` +
      `Here are 3 things to try right now:\n\n` +
      `📞 <b>Free IVR Test Call</b> — hear a custom voice menu in action\n` +
      `🛡️ <b>Anti-Red Hosting</b> — bulletproof sites that never go down\n` +
      `🌐 <b>Bulletproof Domains</b> — register domains with full DNS control\n\n` +
      `👇 <b>Pick one to explore:</b>`,
    step1Buttons: [['📞 Try Free IVR Call'], ['🛡️ See Hosting Plans'], ['🌐 Browse Domains'], ['⏭️ Skip — Show Full Menu']],
    depositNudge: (balance) =>
      `💡 <b>Pro tip:</b> Top up your wallet to unlock all services.\n\n` +
      `Your balance: <b>$${balance}</b>\n` +
      `💸 Deposit <b>$20+</b> and get <b>$${FIRST_DEPOSIT_BONUS_USD} extra FREE!</b>\n\n` +
      `Tap 👛 <b>My Wallet</b> in the menu to deposit.`,
  },
  fr: {
    step1: (name, amount) =>
      `🎉 <b>Bienvenue, ${name} !</b>\n\n` +
      `Vous avez <b>$${amount}</b> dans votre portefeuille !\n\n` +
      `Voici 3 choses à essayer maintenant :\n\n` +
      `📞 <b>Appel IVR gratuit</b> — testez un menu vocal personnalisé\n` +
      `🛡️ <b>Hébergement Anti-Red</b> — sites blindés qui ne tombent jamais\n` +
      `🌐 <b>Domaines blindés</b> — enregistrez des domaines avec contrôle DNS\n\n` +
      `👇 <b>Choisissez pour explorer :</b>`,
    step1Buttons: [['📞 Essayer l\'appel IVR'], ['🛡️ Voir les plans d\'hébergement'], ['🌐 Parcourir les domaines'], ['⏭️ Passer — Menu complet']],
    depositNudge: (balance) =>
      `💡 <b>Astuce :</b> Rechargez votre portefeuille pour tout débloquer.\n\n` +
      `Votre solde : <b>$${balance}</b>\n` +
      `💸 Déposez <b>$20+</b> et recevez <b>$${FIRST_DEPOSIT_BONUS_USD} GRATUITS !</b>\n\n` +
      `Appuyez sur 👛 <b>Mon portefeuille</b> pour déposer.`,
  },
  zh: {
    step1: (name, amount) =>
      `🎉 <b>欢迎，${name}！</b>\n\n` +
      `您的钱包已有 <b>$${amount}</b>！\n\n` +
      `现在可以尝试以下3项功能：\n\n` +
      `📞 <b>免费IVR测试通话</b> — 体验自定义语音菜单\n` +
      `🛡️ <b>防封主机</b> — 永不宕机的网站\n` +
      `🌐 <b>防封域名</b> — 注册域名，完全DNS控制\n\n` +
      `👇 <b>选择一个探索：</b>`,
    step1Buttons: [['📞 免费IVR通话'], ['🛡️ 查看主机方案'], ['🌐 浏览域名'], ['⏭️ 跳过 — 完整菜单']],
    depositNudge: (balance) =>
      `💡 <b>提示：</b>充值钱包解锁所有服务。\n\n` +
      `余额：<b>$${balance}</b>\n` +
      `💸 充值 <b>$20+</b> 额外获得 <b>$${FIRST_DEPOSIT_BONUS_USD} 免费！</b>\n\n` +
      `点击 👛 <b>我的钱包</b> 充值。`,
  },
  hi: {
    step1: (name, amount) =>
      `🎉 <b>स्वागत है, ${name}!</b>\n\n` +
      `आपके वॉलेट में <b>$${amount}</b> हैं!\n\n` +
      `अभी 3 चीज़ें आज़माएं:\n\n` +
      `📞 <b>मुफ्त IVR टेस्ट कॉल</b> — कस्टम वॉइस मेनू सुनें\n` +
      `🛡️ <b>एंटी-रेड होस्टिंग</b> — कभी डाउन न होने वाली साइट\n` +
      `🌐 <b>बुलेटप्रूफ डोमेन</b> — पूर्ण DNS नियंत्रण के साथ\n\n` +
      `👇 <b>एक्सप्लोर करने के लिए चुनें:</b>`,
    step1Buttons: [['📞 मुफ्त IVR कॉल'], ['🛡️ होस्टिंग प्लान'], ['🌐 डोमेन ब्राउज़ करें'], ['⏭️ छोड़ें — पूरा मेनू']],
    depositNudge: (balance) =>
      `💡 <b>टिप:</b> सभी सेवाएं अनलॉक करने के लिए वॉलेट रिचार्ज करें।\n\n` +
      `बैलेंस: <b>$${balance}</b>\n` +
      `💸 <b>$20+</b> जमा करें और <b>$${FIRST_DEPOSIT_BONUS_USD} अतिरिक्त मुफ्त पाएं!</b>\n\n` +
      `👛 <b>मेरा वॉलेट</b> पर टैप करें।`,
  },
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FEATURE 3: Time-Limited Welcome Offer Messages
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const WELCOME_OFFER_MESSAGES = {
  en: (code) =>
    `🔥 <b>Special Offer for You!</b>\n\n` +
    `We noticed you haven't made your first purchase yet.\n\n` +
    `Here's an exclusive <b>${WELCOME_OFFER_DISCOUNT}% OFF</b> your first order!\n\n` +
    `🎟️ Coupon Code: <code>${code}</code>\n` +
    `⏰ Expires in <b>${WELCOME_OFFER_EXPIRY_HOURS} hours</b>\n\n` +
    `Works on: Hosting, Domains, Cloud Phone, VPS, Digital Products & more.\n\n` +
    `👇 Tap /start and browse our services!`,
  fr: (code) =>
    `🔥 <b>Offre spéciale pour vous !</b>\n\n` +
    `Nous avons remarqué que vous n'avez pas encore fait d'achat.\n\n` +
    `Voici <b>${WELCOME_OFFER_DISCOUNT}% de réduction</b> exclusive sur votre première commande !\n\n` +
    `🎟️ Code : <code>${code}</code>\n` +
    `⏰ Expire dans <b>${WELCOME_OFFER_EXPIRY_HOURS} heures</b>\n\n` +
    `Valable sur : Hébergement, Domaines, Cloud Phone, VPS et plus.\n\n` +
    `👇 Tapez /start pour explorer !`,
  zh: (code) =>
    `🔥 <b>专属优惠！</b>\n\n` +
    `您还没有进行首次购买。\n\n` +
    `专属 <b>${WELCOME_OFFER_DISCOUNT}% 折扣</b>！\n\n` +
    `🎟️ 优惠码：<code>${code}</code>\n` +
    `⏰ <b>${WELCOME_OFFER_EXPIRY_HOURS}小时</b>后过期\n\n` +
    `适用于：主机、域名、云电话、VPS、数字产品等。\n\n` +
    `👇 输入 /start 开始探索！`,
  hi: (code) =>
    `🔥 <b>आपके लिए विशेष ऑफ़र!</b>\n\n` +
    `आपने अभी तक पहली खरीदारी नहीं की है।\n\n` +
    `विशेष <b>${WELCOME_OFFER_DISCOUNT}% छूट</b> आपके पहले ऑर्डर पर!\n\n` +
    `🎟️ कूपन कोड: <code>${code}</code>\n` +
    `⏰ <b>${WELCOME_OFFER_EXPIRY_HOURS} घंटे</b> में समाप्त\n\n` +
    `होस्टिंग, डोमेन, क्लाउड फ़ोन, VPS और अधिक पर लागू।\n\n` +
    `👇 /start टैप करें और एक्सप्लोर करें!`,
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FEATURE 4: Browse-Based Follow-Up Messages
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const BROWSE_FOLLOWUP_MESSAGES = {
  hosting: {
    en: `🛡️ <b>Still thinking about hosting?</b>\n\nOur Anti-Red hosting has <b>99.9% uptime</b> and zero takedowns — your sites stay live no matter what.\n\n🔥 Plans from just <b>$30/week</b>.\n\n💡 You may have a daily coupon waiting — type /start and look for 🎟️!\n\n👇 Tap /start → 🛡️ Anti-Red Hosting`,
    fr: `🛡️ <b>Vous hésitez encore pour l'hébergement ?</b>\n\nNotre hébergement Anti-Red offre un <b>uptime de 99.9%</b> et zéro suppression — vos sites restent en ligne quoi qu'il arrive.\n\n🔥 À partir de seulement <b>$30/semaine</b>.\n\n💡 Vous avez peut-être un coupon en attente — tapez /start et cherchez 🎟️ !\n\n👇 Tapez /start → 🛡️ Hébergement Anti-Red`,
    zh: `🛡️ <b>还在考虑主机？</b>\n\n我们的防封主机拥有 <b>99.9%</b> 在线率，零封禁——无论如何您的网站都能保持运行。\n\n🔥 低至 <b>$30/周</b>。\n\n💡 您可能有每日优惠券——输入 /start 查看 🎟️！\n\n👇 输入 /start → 🛡️ 防封主机`,
    hi: `🛡️ <b>अभी भी होस्टिंग के बारे में सोच रहे हैं?</b>\n\nहमारी एंटी-रेड होस्टिंग <b>99.9% अपटाइम</b> और शून्य टेकडाउन — आपकी साइट हमेशा लाइव रहेगी।\n\n🔥 सिर्फ <b>$30/सप्ताह</b> से प्लान शुरू।\n\n💡 आपके लिए डेली कूपन हो सकता है — /start टैप करें और 🎟️ देखें!\n\n👇 /start → 🛡️ एंटी-रेड होस्टिंग`,
  },
  domains: {
    en: `🌐 <b>Those domains won't wait forever!</b>\n\nBulletproof domains with full DNS management, free with hosting plans.\n\n🔥 Domains from <b>$30</b>. Some premium names sell fast!\n\n👇 Tap /start → 🌐 Bulletproof Domains`,
    fr: `🌐 <b>Ces domaines ne resteront pas longtemps !</b>\n\nDomaines blindés avec gestion DNS complète, gratuits avec les plans d'hébergement.\n\n🔥 Domaines à partir de <b>$30</b>. Certains noms premium partent vite !\n\n👇 Tapez /start → 🌐 Domaines blindés`,
    zh: `🌐 <b>域名不会一直等你！</b>\n\n防封域名，完整DNS管理，主机套餐免费赠送。\n\n🔥 域名低至 <b>$30</b>。热门域名抢购很快！\n\n👇 输入 /start → 🌐 防封域名`,
    hi: `🌐 <b>ये डोमेन हमेशा उपलब्ध नहीं रहेंगे!</b>\n\nपूर्ण DNS प्रबंधन के साथ बुलेटप्रूफ डोमेन, होस्टिंग प्लान के साथ मुफ्त।\n\n🔥 डोमेन <b>$30</b> से शुरू। कुछ प्रीमियम नाम तेज़ी से बिकते हैं!\n\n👇 /start → 🌐 बुलेटप्रूफ डोमेन`,
  },
  cloudphone: {
    en: `📞 <b>Your virtual phone number is waiting!</b>\n\nGet a real number in 30+ countries — calls, SMS, IVR, voicemail, SIP.\n\n🔥 Plans from <b>$50/month</b> with included minutes & SMS.\n🆓 Haven't tried the free IVR test call yet? Do it now!\n\n👇 Tap /start → 📞 Cloud IVR + SIP`,
    fr: `📞 <b>Votre numéro virtuel vous attend !</b>\n\nObtenez un vrai numéro dans 30+ pays — appels, SMS, IVR, messagerie vocale, SIP.\n\n🔥 Forfaits dès <b>$50/mois</b> avec minutes et SMS inclus.\n🆓 Vous n'avez pas encore essayé l'appel IVR gratuit ? Faites-le maintenant !\n\n👇 Tapez /start → 📞 Cloud IVR + SIP`,
    zh: `📞 <b>您的虚拟号码在等着您！</b>\n\n在30多个国家获取真实号码——通话、短信、IVR、语音信箱、SIP。\n\n🔥 套餐低至 <b>$50/月</b>，含通话分钟数和短信。\n🆓 还没试过免费IVR测试通话？现在就体验！\n\n👇 输入 /start → 📞 云IVR + SIP`,
    hi: `📞 <b>आपका वर्चुअल नंबर इंतज़ार कर रहा है!</b>\n\n30+ देशों में असली नंबर पाएं — कॉल, SMS, IVR, वॉइसमेल, SIP।\n\n🔥 <b>$50/माह</b> से प्लान, मिनट्स और SMS शामिल।\n🆓 अभी तक मुफ्त IVR टेस्ट कॉल नहीं किया? अभी करें!\n\n👇 /start → 📞 क्लाउड IVR + SIP`,
  },
  digitalproducts: {
    en: `📦 <b>Digital products you were looking at...</b>\n\nVerified accounts, instant delivery, escrow protection.\n\nTwilio, Telnyx, AWS, Google Cloud — all verified and ready.\n\n👇 Tap /start → 📦 Digital Products`,
    fr: `📦 <b>Les produits numériques que vous regardiez...</b>\n\nComptes vérifiés, livraison instantanée, protection escrow.\n\nTwilio, Telnyx, AWS, Google Cloud — tous vérifiés et prêts.\n\n👇 Tapez /start → 📦 Produits numériques`,
    zh: `📦 <b>您之前看的数字产品...</b>\n\n认证账户，即时交付，托管保护。\n\nTwilio、Telnyx、AWS、Google Cloud——全部认证，即刻可用。\n\n👇 输入 /start → 📦 数字产品`,
    hi: `📦 <b>आप जो डिजिटल प्रोडक्ट देख रहे थे...</b>\n\nसत्यापित अकाउंट, तुरंत डिलीवरी, एस्क्रो सुरक्षा।\n\nTwilio, Telnyx, AWS, Google Cloud — सभी सत्यापित और तैयार।\n\n👇 /start → 📦 डिजिटल प्रोडक्ट`,
  },
  vps: {
    en: `🖥️ <b>Need a VPS?</b>\n\nOffshore VPS servers in multiple regions — full root access, any OS.\n\n🔥 Plans starting from <b>$25/month</b>.\n\n👇 Tap /start → 🖥️ VPS Plans`,
    fr: `🖥️ <b>Besoin d'un VPS ?</b>\n\nServeurs VPS offshore dans plusieurs régions — accès root complet, tout OS.\n\n🔥 Forfaits à partir de <b>$25/mois</b>.\n\n👇 Tapez /start → 🖥️ Plans VPS`,
    zh: `🖥️ <b>需要VPS？</b>\n\n多地区离岸VPS服务器——完整root权限，支持任何操作系统。\n\n🔥 套餐低至 <b>$25/月</b>。\n\n👇 输入 /start → 🖥️ VPS方案`,
    hi: `🖥️ <b>VPS चाहिए?</b>\n\nकई क्षेत्रों में ऑफशोर VPS सर्वर — पूर्ण रूट एक्सेस, कोई भी OS।\n\n🔥 <b>$25/माह</b> से प्लान शुरू।\n\n👇 /start → 🖥️ VPS प्लान`,
  },
  general: {
    en: `👋 <b>Hey! We noticed you were exploring our services.</b>\n\nHere's what's popular right now:\n\n🛡️ Anti-Red Hosting — from $30/week\n🌐 Bulletproof Domains — from $30\n📞 Cloud Phone — from $50/month\n\n💡 Check if you have a daily coupon: /start → 🎟️\n\n👇 Tap /start to continue browsing!`,
    fr: `👋 <b>Hé ! Nous avons remarqué que vous exploriez nos services.</b>\n\nVoici ce qui est populaire en ce moment :\n\n🛡️ Hébergement Anti-Red — dès $30/semaine\n🌐 Domaines blindés — dès $30\n📞 Cloud Phone — dès $50/mois\n\n💡 Vérifiez si vous avez un coupon : /start → 🎟️\n\n👇 Tapez /start pour continuer !`,
    zh: `👋 <b>嗨！我们注意到您在浏览我们的服务。</b>\n\n以下是当前热门服务：\n\n🛡️ 防封主机 — $30/周起\n🌐 防封域名 — $30起\n📞 云电话 — $50/月起\n\n💡 查看是否有每日优惠券：/start → 🎟️\n\n👇 输入 /start 继续浏览！`,
    hi: `👋 <b>अरे! हमने देखा कि आप हमारी सेवाएं एक्सप्लोर कर रहे थे।</b>\n\nअभी लोकप्रिय सेवाएं:\n\n🛡️ एंटी-रेड होस्टिंग — $30/सप्ताह से\n🌐 बुलेटप्रूफ डोमेन — $30 से\n📞 क्लाउड फ़ोन — $50/माह से\n\n💡 डेली कूपन चेक करें: /start → 🎟️\n\n👇 /start टैप करें और ब्राउज़ करें!`,
  },
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FEATURE 5: Social Proof — cached purchase counts
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const SOCIAL_PROOF_LABELS = {
  en: {
    hosting: (n) => `🔥 ${n} users bought hosting this week`,
    domains: (n) => `🌐 ${n} domains registered this week`,
    cloudphone: (n) => `📞 ${n} phone numbers activated this week`,
    digitalproducts: (n) => `📦 ${n} digital products sold this week`,
    vps: (n) => `🖥️ ${n} VPS servers deployed this week`,
    virtualcard: (n) => `💳 ${n} virtual cards created this week`,
    general: (n) => `⭐ ${n} purchases this week`,
  },
  fr: {
    hosting: (n) => `🔥 ${n} utilisateurs ont acheté de l'hébergement cette semaine`,
    domains: (n) => `🌐 ${n} domaines enregistrés cette semaine`,
    cloudphone: (n) => `📞 ${n} numéros activés cette semaine`,
    digitalproducts: (n) => `📦 ${n} produits numériques vendus cette semaine`,
    vps: (n) => `🖥️ ${n} serveurs VPS déployés cette semaine`,
    virtualcard: (n) => `💳 ${n} cartes virtuelles créées cette semaine`,
    general: (n) => `⭐ ${n} achats cette semaine`,
  },
  zh: {
    hosting: (n) => `🔥 本周 ${n} 用户购买了主机`,
    domains: (n) => `🌐 本周注册 ${n} 个域名`,
    cloudphone: (n) => `📞 本周激活 ${n} 个电话号码`,
    digitalproducts: (n) => `📦 本周售出 ${n} 个数字产品`,
    vps: (n) => `🖥️ 本周部署 ${n} 台VPS服务器`,
    virtualcard: (n) => `💳 本周创建 ${n} 张虚拟卡`,
    general: (n) => `⭐ 本周 ${n} 笔交易`,
  },
  hi: {
    hosting: (n) => `🔥 इस हफ्ते ${n} यूज़र्स ने होस्टिंग खरीदी`,
    domains: (n) => `🌐 इस हफ्ते ${n} डोमेन रजिस्टर हुए`,
    cloudphone: (n) => `📞 इस हफ्ते ${n} फ़ोन नंबर एक्टिवेट हुए`,
    digitalproducts: (n) => `📦 इस हफ्ते ${n} डिजिटल प्रोडक्ट बिके`,
    vps: (n) => `🖥️ इस हफ्ते ${n} VPS सर्वर डिप्लॉय हुए`,
    virtualcard: (n) => `💳 इस हफ्ते ${n} वर्चुअल कार्ड बने`,
    general: (n) => `⭐ इस हफ्ते ${n} खरीदारी`,
  },
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Main init function
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function initNewUserConversion(bot, db, stateCol, walletOfCol, paymentsCol) {
  const conversionCol = db.collection('userConversion')
  const welcomeCouponsCol = db.collection('welcomeCoupons')
  const browseTrackingCol = db.collection('browseTracking')
  const scheduledEventsCol = db.collection('scheduledEvents')
  const promoOptOutCol = db.collection('promoOptOut')

  // Helper: check if user opted out of promos
  async function isOptedOut(chatId) {
    try {
      const record = await promoOptOutCol.findOne({ _id: parseFloat(chatId) })
      return record?.optedOut === true
    } catch { return false }
  }

  // Indexes
  conversionCol.createIndex({ chatId: 1 }, { unique: true }).catch(() => {})
  welcomeCouponsCol.createIndex({ code: 1 }).catch(() => {})
  welcomeCouponsCol.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch(() => {})
  browseTrackingCol.createIndex({ chatId: 1 }).catch(() => {})
  scheduledEventsCol.createIndex({ chatId: 1, type: 1 }).catch(() => {})
  scheduledEventsCol.createIndex({ status: 1, fireAt: 1 }).catch(() => {})

  // In-memory caches (social proof only — timers are now MongoDB-persisted)
  let socialProofCache = {}             // category → count (multiplied)
  let socialProofLastRefresh = 0

  // ═══════════════════════════════════════════════════════════════════
  // FEATURE 1: Guided Onboarding
  // ═══════════════════════════════════════════════════════════════════

  async function sendGuidedOnboarding(chatId, name, lang = 'en', welcomeAmount = 3) {
    try {
      const msgs = ONBOARDING_MESSAGES[lang] || ONBOARDING_MESSAGES.en

      // Mark user as in onboarding
      await conversionCol.updateOne(
        { chatId: parseFloat(chatId) },
        {
          $set: {
            chatId: parseFloat(chatId),
            onboardingStarted: true,
            onboardingCompleted: false,
            joinedAt: new Date(),
            lang,
          },
          $setOnInsert: {
            firstDepositBonusAwarded: false,
            welcomeOfferSent: false,
            hasPurchased: false,
          }
        },
        { upsert: true }
      )

      // Send step 1 with buttons — delayed slightly so it comes after welcome bonus
      setTimeout(() => {
        const stepMsg = msgs.step1(name, welcomeAmount.toFixed(2))
        log('reply: ' + stepMsg + ' ' + JSON.stringify(msgs.step1Buttons) + '\tto: ' + chatId)
        bot.sendMessage(chatId, stepMsg, {
          parse_mode: 'HTML',
          reply_markup: {
            keyboard: msgs.step1Buttons,
            resize_keyboard: true,
            one_time_keyboard: true,
          }
        }).catch(() => {})
      }, 2000)

      log(`[Conversion] Onboarding started for ${chatId} (lang: ${lang})`)
    } catch (err) {
      log(`[Conversion] Onboarding error: ${err.message}`)
    }
  }

  // Handle onboarding button responses — returns true if handled
  async function handleOnboardingResponse(chatId, message) {
    try {
      const record = await conversionCol.findOne({ chatId: parseFloat(chatId), onboardingStarted: true, onboardingCompleted: false })
      if (!record) return false

      const msg = message || ''

      // Check if it's an onboarding button
      const isIvrButton = msg.includes('IVR') || msg.includes('通话') || msg.includes('कॉल')
      const isHostingButton = msg.includes('Hosting') || msg.includes('hébergement') || msg.includes('主机') || msg.includes('होस्टिंग')
      const isDomainButton = msg.includes('Domain') || msg.includes('domaine') || msg.includes('域名') || msg.includes('डोमेन')
      const isSkipButton = msg.includes('Skip') || msg.includes('Passer') || msg.includes('跳过') || msg.includes('छोड़')

      if (!isIvrButton && !isHostingButton && !isDomainButton && !isSkipButton) return false

      // Mark onboarding as completed
      await conversionCol.updateOne(
        { chatId: parseFloat(chatId) },
        { $set: { onboardingCompleted: true, onboardingChoice: msg, completedAt: new Date() } }
      )

      // Return the action to take (caller will handle navigation)
      if (isIvrButton) return 'goto_cloudphone'
      if (isHostingButton) return 'goto_hosting'
      if (isDomainButton) return 'goto_domains'
      return 'goto_menu' // skip
    } catch (err) {
      return false
    }
  }

  // Send deposit nudge after user browses a product
  async function sendDepositNudge(chatId, lang = 'en', balance = 0) {
    try {
      const msgs = ONBOARDING_MESSAGES[lang] || ONBOARDING_MESSAGES.en
      const nudgeMsg = msgs.depositNudge(Math.max(0, balance).toFixed(2))
      log('reply: ' + nudgeMsg + '\tto: ' + chatId)
      await bot.sendMessage(chatId, nudgeMsg, { parse_mode: 'HTML' })
    } catch (err) {
      // Non-critical
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // FEATURE 2: First-Purchase Deposit Bonus
  // ═══════════════════════════════════════════════════════════════════

  async function checkFirstDepositBonus(chatId, depositAmountUsd) {
    try {
      if (depositAmountUsd < FIRST_DEPOSIT_MIN_USD) return null

      const cid = parseFloat(chatId)
      // Atomic check: only award if not already awarded
      const result = await conversionCol.findOneAndUpdate(
        { chatId: cid, firstDepositBonusAwarded: { $ne: true } },
        {
          $set: { firstDepositBonusAwarded: true, firstDepositAt: new Date(), firstDepositAmount: depositAmountUsd },
        },
        { returnDocument: 'after' }
      )

      // If firstDepositBonusAwarded was already true, result.value will still show true
      // but the update won't match, so we check if the update actually happened
      if (!result || !result.firstDepositAt || Math.abs(new Date(result.firstDepositAt).getTime() - Date.now()) > 5000) {
        return null // Already awarded previously
      }

      log(`[Conversion] First deposit bonus: $${FIRST_DEPOSIT_BONUS_USD} for chatId=${cid} (deposited $${depositAmountUsd})`)
      return { awarded: true, amount: FIRST_DEPOSIT_BONUS_USD }
    } catch (err) {
      log(`[Conversion] First deposit bonus error: ${err.message}`)
      return null
    }
  }

  function getFirstDepositBonusMessage(lang = 'en') {
    const msgs = {
      en: `🎉 <b>First Deposit Bonus!</b>\n\n$${FIRST_DEPOSIT_BONUS_USD} has been added to your wallet as a thank-you for your first deposit!\n\n💡 Start shopping: /start`,
      fr: `🎉 <b>Bonus premier dépôt !</b>\n\n$${FIRST_DEPOSIT_BONUS_USD} ajoutés à votre portefeuille pour votre premier dépôt !\n\n💡 Commencez : /start`,
      zh: `🎉 <b>首充奖励！</b>\n\n$${FIRST_DEPOSIT_BONUS_USD} 已作为首充奖励添加到您的钱包！\n\n💡 开始购物：/start`,
      hi: `🎉 <b>पहली जमा बोनस!</b>\n\n$${FIRST_DEPOSIT_BONUS_USD} आपके पहले डिपॉज़िट के लिए वॉलेट में जोड़ दिए गए!\n\n💡 शॉपिंग शुरू करें: /start`,
    }
    return msgs[lang] || msgs.en
  }

  // ═══════════════════════════════════════════════════════════════════
  // FEATURE 3: Time-Limited Welcome Offer
  // ═══════════════════════════════════════════════════════════════════

  async function scheduleWelcomeOffer(chatId, lang = 'en') {
    try {
      const cid = parseFloat(chatId)
      const fireAt = new Date(Date.now() + WELCOME_OFFER_DELAY_MS)

      // Persist to MongoDB — upsert so re-scheduling replaces any existing timer
      await scheduledEventsCol.updateOne(
        { chatId: cid, type: 'welcome_offer' },
        {
          $set: {
            chatId: cid,
            type: 'welcome_offer',
            lang,
            fireAt,
            status: 'pending',
            updatedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true }
      )

      log(`[Conversion] Welcome offer scheduled for ${cid} in ${WELCOME_OFFER_DELAY_MS / 60000} min`)
    } catch (err) {
      log(`[Conversion] Schedule welcome offer error: ${err.message}`)
    }
  }

  async function sendWelcomeOffer(chatId, lang = 'en') {
    try {
      const cid = parseFloat(chatId)

      // Check if user already purchased, was offered, or is inactive
      const record = await conversionCol.findOne({ chatId: cid })
      if (record?.hasPurchased || record?.welcomeOfferSent || record?.inactive) {
        log(`[Conversion] Skipping welcome offer for ${cid} — already purchased, offered, or inactive`)
        return
      }

      // Check promo opt-out
      if (await isOptedOut(cid)) {
        log(`[Conversion] Skipping welcome offer for ${cid} — user opted out of promos`)
        return
      }

      // Generate unique coupon code
      const code = `WELCOME${WELCOME_OFFER_DISCOUNT}-${generateCode()}`
      const expiresAt = new Date(Date.now() + WELCOME_OFFER_EXPIRY_HOURS * 60 * 60 * 1000)

      // Save coupon
      await welcomeCouponsCol.insertOne({
        code,
        chatId: cid,
        discount: WELCOME_OFFER_DISCOUNT,
        expiresAt,
        used: false,
        type: 'welcome_offer',
        createdAt: new Date(),
      })

      // Mark as sent
      await conversionCol.updateOne(
        { chatId: cid },
        { $set: { welcomeOfferSent: true, welcomeOfferCode: code, welcomeOfferSentAt: new Date() } },
        { upsert: true }
      )

      // Send message
      const msgFn = WELCOME_OFFER_MESSAGES[lang] || WELCOME_OFFER_MESSAGES.en
      const offerMsg = msgFn(code)
      log('reply: ' + offerMsg + '\tto: ' + chatId)
      
      try {
        await bot.sendMessage(chatId, offerMsg, { parse_mode: 'HTML' })
        log(`[Conversion] ✅ Welcome offer sent to ${cid}: ${code} (${WELCOME_OFFER_DISCOUNT}% off, expires ${expiresAt.toISOString()})`)
      } catch (sendErr) {
        // Handle "chat not found" / "bot blocked" errors — mark user as inactive
        if (sendErr.response?.body?.error_code === 400 && 
            (sendErr.message?.includes('chat not found') || 
             sendErr.message?.includes('bot was blocked') ||
             sendErr.message?.includes('user is deactivated'))) {
          log(`[Conversion] ❌ User ${cid} blocked/deleted bot — marking inactive`)
          await conversionCol.updateOne(
            { chatId: cid },
            { $set: { inactive: true, inactiveSince: new Date() } },
            { upsert: true }
          )
        } else {
          log(`[Conversion] ❌ Send failed for ${cid}: ${sendErr.message}`)
        }
      }
    } catch (err) {
      log(`[Conversion] Welcome offer error for ${chatId}: ${err.message}`)
    }
  }

  // Validate a welcome coupon — called from existing coupon validator
  async function validateWelcomeCoupon(code, chatId) {
    try {
      const upperCode = code.toUpperCase()

      // First check if coupon exists at all (regardless of used/expired status)
      const anyCoupon = await welcomeCouponsCol.findOne({ code: upperCode })
      if (!anyCoupon) return null  // Not a welcome coupon — let other validators handle it

      // Check if already used
      if (anyCoupon.used) return { error: 'already_used' }

      // Check if expired
      if (anyCoupon.expiresAt && anyCoupon.expiresAt < new Date()) return { error: 'expired' }

      // Must be used by the same user it was issued to
      if (anyCoupon.chatId && anyCoupon.chatId !== parseFloat(chatId)) return { error: 'wrong_user' }

      return { discount: anyCoupon.discount, code: anyCoupon.code, type: 'welcome_offer' }
    } catch (err) {
      return null
    }
  }

  // Mark welcome coupon as used
  async function markWelcomeCouponUsed(code, chatId) {
    try {
      await welcomeCouponsCol.updateOne(
        { code: code.toUpperCase() },
        { $set: { used: true, usedBy: parseFloat(chatId), usedAt: new Date() } }
      )
    } catch (err) {
      // Non-critical
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // FEATURE 4: Browse-Based Follow-Up
  // ═══════════════════════════════════════════════════════════════════

  async function trackBrowse(chatId, category, lang = 'en') {
    try {
      const cid = parseFloat(chatId)

      // Save browse event
      await browseTrackingCol.updateOne(
        { chatId: cid },
        {
          $set: { lastBrowseAt: new Date(), lastCategory: category, lang },
          $inc: { [`browseCount.${category}`]: 1 },
          $setOnInsert: { chatId: cid, createdAt: new Date() }
        },
        { upsert: true }
      )

      // Reset/start follow-up timer — persisted in MongoDB
      await scheduledEventsCol.updateOne(
        { chatId: cid, type: 'browse_followup' },
        {
          $set: {
            chatId: cid,
            type: 'browse_followup',
            lang,
            fireAt: new Date(Date.now() + BROWSE_FOLLOWUP_DELAY_MS),
            status: 'pending',
            updatedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true }
      )
    } catch (err) {
      // Non-critical
    }
  }

  async function sendBrowseFollowUp(chatId, lang = 'en') {
    try {
      const cid = parseFloat(chatId)

      // Only send to users who went through the conversion onboarding
      const record = await conversionCol.findOne({ chatId: cid })
      if (!record?.onboardingStarted) {
        log(`[Conversion] Skipping browse follow-up for ${cid} — not a conversion-onboarded user`)
        return
      }

      // Check if user has made a purchase or is inactive
      if (record?.hasPurchased || record?.inactive) return

      // Check promo opt-out
      if (await isOptedOut(cid)) {
        log(`[Conversion] Skipping browse follow-up for ${cid} — user opted out of promos`)
        return
      }

      // Check browse tracking
      const tracking = await browseTrackingCol.findOne({ chatId: cid })
      if (!tracking || !tracking.browseCount || tracking.followUpSent) return

      // Find most-browsed category
      let topCategory = 'general'
      let topCount = 0
      for (const [cat, count] of Object.entries(tracking.browseCount)) {
        if (count > topCount) {
          topCategory = cat
          topCount = count
        }
      }

      const messages = BROWSE_FOLLOWUP_MESSAGES[topCategory] || BROWSE_FOLLOWUP_MESSAGES.general
      const message = messages[lang] || messages.en

      log('reply: ' + message + '\tto: ' + chatId)
      
      try {
        await bot.sendMessage(chatId, message, { parse_mode: 'HTML', disable_web_page_preview: true })

        // Clear tracking so we don't spam
        await browseTrackingCol.updateOne(
          { chatId: cid },
          { $set: { followUpSent: true, followUpSentAt: new Date(), browseCount: {} } }
        )

        log(`[Conversion] ✅ Browse follow-up sent to ${cid} for category: ${topCategory}`)
      } catch (sendErr) {
        // Handle "chat not found" / "bot blocked" errors — mark user as inactive
        if (sendErr.response?.body?.error_code === 400 && 
            (sendErr.message?.includes('chat not found') || 
             sendErr.message?.includes('bot was blocked') ||
             sendErr.message?.includes('user is deactivated'))) {
          log(`[Conversion] ❌ User ${cid} blocked/deleted bot — marking inactive`)
          await conversionCol.updateOne(
            { chatId: cid },
            { $set: { inactive: true, inactiveSince: new Date() } },
            { upsert: true }
          )
        } else {
          log(`[Conversion] ❌ Send failed for ${cid}: ${sendErr.message}`)
        }
      }
    } catch (err) {
      log(`[Conversion] Browse follow-up error: ${err.message}`)
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // FEATURE 5: Social Proof
  // ═══════════════════════════════════════════════════════════════════

  async function refreshSocialProof() {
    try {
      // Count payments by category from the payments collection
      // Payment format stored as val: "Method,Category,Product,$Price,ChatId,Name,Date"
      const allPayments = await paymentsCol.find({}).toArray()

      const counts = {
        hosting: 0,
        domains: 0,
        cloudphone: 0,
        digitalproducts: 0,
        vps: 0,
        virtualcard: 0,
        general: 0,
      }

      for (const payment of allPayments) {
        const valStr = String(payment.val || '').toLowerCase()
        if (!valStr) continue

        // Parse category from the comma-separated value (2nd field)
        const parts = valStr.split(',')
        const category = (parts[1] || '').trim()

        if (category === 'plan' || category === 'hosting') counts.hosting++
        else if (category === 'domain' || category === ' domain') counts.domains++
        else if (category === 'cloudphone') counts.cloudphone++
        else if (category === 'digitalproduct') counts.digitalproducts++
        else if (category === 'vpsplan' || category === 'vpsupgrade') counts.vps++
        else if (category === 'virtualcard') counts.virtualcard++
        else if (category !== 'wallet') counts.general++ // skip wallet deposits from general
      }

      // Apply multiplier with per-category adjustments.
      // hosting & domains were unrealistically inflated — cap them at 20% of the
      // default multiplier so the "X registered this week" line looks believable.
      const PER_CATEGORY_FACTOR = { hosting: 0.2, domains: 0.2 }
      for (const key of Object.keys(counts)) {
        const factor = PER_CATEGORY_FACTOR[key] != null ? PER_CATEGORY_FACTOR[key] : 1
        counts[key] = Math.max(Math.round(counts[key] * SOCIAL_PROOF_MULTIPLIER * factor), 15) // minimum 15
      }

      socialProofCache = counts
      socialProofLastRefresh = Date.now()
      log(`[Conversion] Social proof refreshed: ${JSON.stringify(counts)}`)
    } catch (err) {
      log(`[Conversion] Social proof refresh error: ${err.message}`)
      // Use fallback counts
      if (Object.keys(socialProofCache).length === 0) {
        socialProofCache = {
          hosting: 15, domains: 18, cloudphone: 30,
          digitalproducts: 75, vps: 20, virtualcard: 35, general: 90,
        }
      }
    }
  }

  // Get social proof text for a product category
  function getSocialProof(category, lang = 'en') {
    // Refresh if stale
    if (Date.now() - socialProofLastRefresh > SOCIAL_PROOF_REFRESH_MS) {
      refreshSocialProof().catch(() => {})
    }

    const count = socialProofCache[category] || socialProofCache.general || 30
    const labels = SOCIAL_PROOF_LABELS[lang] || SOCIAL_PROOF_LABELS.en
    const labelFn = labels[category] || labels.general
    return labelFn ? labelFn(count) : ''
  }

  // ═══════════════════════════════════════════════════════════════════
  // Mark user as purchased (called from payment completion handlers)
  // ═══════════════════════════════════════════════════════════════════

  async function markPurchased(chatId) {
    try {
      const cid = parseFloat(chatId)
      await conversionCol.updateOne(
        { chatId: cid },
        { $set: { hasPurchased: true, firstPurchaseAt: new Date() } },
        { upsert: true }
      )

      // Cancel all pending scheduled events for this user
      await scheduledEventsCol.updateMany(
        { chatId: cid, status: 'pending' },
        { $set: { status: 'cancelled', cancelledAt: new Date() } }
      )
    } catch (err) {
      // Non-critical
    }
  }

  // Cancel all pending events — called on /stop_promos
  async function cancelScheduledEvents(chatId) {
    try {
      const cid = parseFloat(chatId)
      const result = await scheduledEventsCol.updateMany(
        { chatId: cid, status: 'pending' },
        { $set: { status: 'cancelled', cancelledAt: new Date(), cancelReason: 'promo_opt_out' } }
      )
      if (result.modifiedCount > 0) {
        log(`[Conversion] Cancelled ${result.modifiedCount} scheduled event(s) for ${cid} (promo opt-out)`)
      }
    } catch (err) {
      // Non-critical
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // PERSISTENT TIMER PROCESSOR — polls MongoDB every 60s for due events
  // Survives server restarts; recovers any pending timers automatically
  // ═══════════════════════════════════════════════════════════════════

  const POLL_INTERVAL_MS = 60 * 1000 // Check every 60 seconds

  async function processScheduledEvents() {
    try {
      const now = new Date()

      // Find all pending events whose fireAt has passed
      const dueEvents = await scheduledEventsCol.find({
        status: 'pending',
        fireAt: { $lte: now },
      }).toArray()

      for (const event of dueEvents) {
        try {
          // Mark as processing to prevent duplicate firings
          const lockResult = await scheduledEventsCol.updateOne(
            { _id: event._id, status: 'pending' },
            { $set: { status: 'processing', processingAt: now } }
          )
          // If another instance already locked it, skip
          if (lockResult.modifiedCount === 0) continue

          if (event.type === 'welcome_offer') {
            await sendWelcomeOffer(event.chatId, event.lang || 'en')
          } else if (event.type === 'browse_followup') {
            await sendBrowseFollowUp(event.chatId, event.lang || 'en')
          }

          // Mark as fired
          await scheduledEventsCol.updateOne(
            { _id: event._id },
            { $set: { status: 'fired', firedAt: new Date() } }
          )
        } catch (eventErr) {
          log(`[Conversion] Error processing event ${event._id}: ${eventErr.message}`)
          // Mark as failed so it doesn't block future polls
          await scheduledEventsCol.updateOne(
            { _id: event._id },
            { $set: { status: 'failed', error: eventErr.message, failedAt: new Date() } }
          ).catch(() => {})
        }
      }

      if (dueEvents.length > 0) {
        log(`[Conversion] Processed ${dueEvents.length} scheduled event(s)`)
      }
    } catch (err) {
      log(`[Conversion] Scheduled event processor error: ${err.message}`)
    }
  }

  // Start the polling loop — also recovers any timers from before a restart
  setInterval(() => processScheduledEvents(), POLL_INTERVAL_MS)
  // Run once on startup to catch any events that were due during downtime
  setTimeout(() => processScheduledEvents(), 5000)

  // Initial social proof load
  setTimeout(() => refreshSocialProof(), 10000)
  // Refresh every hour
  setInterval(() => refreshSocialProof(), SOCIAL_PROOF_REFRESH_MS)

  log(`[Conversion] New User Conversion Engine initialized — 5 features active`)
  log(`[Conversion] First deposit bonus: $${FIRST_DEPOSIT_BONUS_USD} (min $${FIRST_DEPOSIT_MIN_USD}), Welcome offer: ${WELCOME_OFFER_DISCOUNT}% (2h delay), Social proof: ×${SOCIAL_PROOF_MULTIPLIER}`)

  return {
    // Feature 1: Guided Onboarding
    sendGuidedOnboarding,
    handleOnboardingResponse,
    sendDepositNudge,

    // Feature 2: First-Purchase Bonus
    checkFirstDepositBonus,
    getFirstDepositBonusMessage,
    FIRST_DEPOSIT_BONUS_USD,

    // Feature 3: Welcome Offer
    scheduleWelcomeOffer,
    validateWelcomeCoupon,
    markWelcomeCouponUsed,

    // Feature 4: Browse Follow-Up
    trackBrowse,

    // Feature 5: Social Proof
    getSocialProof,
    refreshSocialProof,

    // Shared
    markPurchased,
    cancelScheduledEvents,
  }
}

module.exports = { initNewUserConversion }
