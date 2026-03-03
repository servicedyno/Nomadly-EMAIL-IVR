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
  viewAnalytics: '📊 Voir les statistiques',
  viewUsers: '👀 Voir les utilisateurs',
  blockUser: '✋ Bloquer l’utilisateur',
  unblockUser: '👌 Débloquer l’utilisateur',
  messageUsers: '👋 Envoyer un message à tous les utilisateurs',
}

const user = {
  // main keyboards
  cPanelWebHostingPlans: "Plans d'hébergement HostPanel en Russie 🔒",
  pleskWebHostingPlans: "Plans d'hébergement Plesk en Russie 🔒",
  joinChannel: '📢 Rejoindre le canal',
  phoneNumberLeads: '🎯 Acheter des Leads | Vérifier les Vôtres',
  buyLeads: '🎯 Acheter des Leads',
  validateLeads: '✅ Valider les numéros',
  leadsValidation: '🎯 Leads & Validation',
  hostingDomainsRedirect: '🛡️🔥 Hébergement Anti-Red',
  wallet: '👛 Portefeuille',
  urlShortenerMain: "🔗 Raccourcisseur d'URL",
  vpsPlans: 'Acheter un VPS Bulletproof🛡️ - Horaire/Mensuel',
  buyPlan: '⚡ Améliorer le plan',
  domainNames: '🌐 Domaines Blindés',
  viewPlan: '📋 Mes Plans',
  becomeReseller: '💼 Revendeur',
  getSupport: '💬 Support',
  cloudPhone: '📞 Cloud IVR + SIP',
  testSip: '🧪 Tester SIP Gratuit',
  freeTrialAvailable: '📧🆓 SMS en masse - Essai gratuit',
  changeSetting: '🌍 Paramètres',
  changeLanguage: '🌍 Changer de langue',

  // Sub Menu 1: urlShortenerMain
  redSelectUrl: '🔀✂️ Rediriger et raccourcir',
  redBitly: '✂️ Bit.ly',
  redShortit: '✂️ Shortit (Essai)',
  urlShortener: '✂️🌐 Raccourcisseur de domaine personnalisé',
  viewShortLinks: '📊 Voir les analyses des raccourcis',
  activateDomainShortener: '🔗 Activer un domaine pour le raccourcisseur',

  // Sub Menu 6: Digital Products
  digitalProducts: '🛒 Produits numériques',
  marketplace: '🏪 Marché',
  shippingLabel: '📦 Étiquette d\'expédition',
  virtualCard: '💳 Carte Virtuelle',

  // Sub Menu 2: domainNames
  buyDomainName: '🛒🌐 Acheter des noms de domaine',
  viewDomainNames: '📂 Mes noms de domaine',
  dnsManagement: '🔧 Gestion DNS',

  // Sub Menu 3: cPanel/Plesk WebHostingPlansMain
  freeTrial: '💡 Essai gratuit',
  premiumWeekly: '⚡ Premium Anti-Red (1 Semaine)',
  premiumCpanel: '🔷 Premium Anti-Red HostPanel (30 Days)',
  goldenCpanel: '👑 Golden Anti-Red HostPanel (30 Days)',
  contactSupport: '📞 Contacter le support',

  // Sub Menu 4: VPS Plans
  buyVpsPlan: '⚙️ Créer un nouveau VPS',
  manageVpsPlan: '🖥️ Afficher/Gérer le VPS',
  manageVpsSSH: '🔑 Clés SSH',

  // Free Trial
  freeTrialMenuButton: '🚀 Essai gratuit (12 heures)',
  getFreeTrialPlanNow: "🛒 Obtenir le plan d'essai maintenant",
  continueWithDomainNameSBS: websiteName => `➡️ Continuer avec ${websiteName}`,
  searchAnotherDomain: '🔍 Rechercher un autre domaine',
  privHostNS: '🏢 PrivHost (Hébergement rapide et sécurisé)',
  cloudflareNS: '🛡️ Bouclier Cloudflare (Sécurité et discrétion)',
  backToFreeTrial: "⬅️ Retour à l'essai gratuit",

  // Paid Plans
  buyPremiumWeekly: '🛒 Acheter Premium Anti-Red (1 Semaine)',
  buyPremiumCpanel: '🛒 Acheter Premium Anti-Red HostPanel (30 Days)',
  buyGoldenCpanel: '🛒 Acheter Golden Anti-Red HostPanel (30 Days)',
  viewPremiumWeekly: '🔷 Voir Premium Weekly',
  viewPremiumCpanel: '🔼 Voir Premium HostPanel',
  viewGoldenCpanel: '👑 Voir Golden HostPanel',
  backToHostingPlans: "⬅️ Retour aux plans d'hébergement",
  registerANewDomain: '🌐 Enregistrer un nouveau domaine',
  useMyDomain: '📂 Utiliser Mon Domaine',
  connectExternalDomain: '🔗 Connecter un Domaine Externe',
  useExistingDomain: '🔄 Utiliser un domaine existant',
  backToPremiumWeeklyDetails: '⬅️ Retour aux détails Premium Weekly',
  backToPremiumCpanelDetails: '⬅️ Retour aux détails Premium HostPanel',
  backToGoldenCpanelDetails: '⬅️ Retour aux détails Golden HostPanel',
  continueWithDomain: websiteName => `➡️ Continuer avec ${websiteName}`,
  enterAnotherDomain: '🔍 Entrer un autre domaine',
  backToPurchaseOptions: "⬅️ Retour aux options d'achat",
  myHostingPlans: '📋 Mes Plans d\'Hébergement',
  revealCredentials: '🔑 Afficher les Identifiants',
  renewHostingPlan: '🔄 Renouveler le Plan',
  backToMyHostingPlans: '⬅️ Retour à Mes Plans',
  buyLeads: '🎯 Acheter des Leads Téléphoniques',
  validateLeads: '✅ Valider les Numéros',
  shortenLink: '✂️ Raccourcir un Lien',
  confirmRenewNow: '✅ Confirmer & Payer',
  cancelRenewNow: '❌ Annuler',
  toggleAutoRenew: '🔁 Activer/Désactiver le Renouvellement Auto',
}

const u = {
  // other key boards
  deposit: '➕💵 Dépôt',
  withdraw: '➖💵 Retirer',
  myTier: '🏆 Mon Niveau',

  // wallet
  usd: 'USD',
  ngn: 'NGN',
}
const view = num => Number(num).toFixed(2)
const yesNo = ['Oui', 'Non']

const bal = (usd, ngn) =>
  HIDE_BANK_PAYMENT !== 'true'
    ? `$${view(usd)}
₦${view(ngn)}`
    : `$${view(usd)}`

const dnsEntryFormat = '' // deprecated — A/CNAME now use multi-step wizard

const t = {
  yes: 'Oui',
  no: 'Non',
  back: 'Retour',
  cancel: 'Annuler',
  skip: 'Ignorer',
  becomeReseller: (() => {
    const services = ['Raccourcissement URL', 'Enregistrement de domaines']
    if (process.env.PHONE_SERVICE_ON === 'true') services.push('Cloud IVR')
    if (HIDE_SMS_APP !== 'true') services.push('BulkSMS')
    if (process.env.OFFSHORE_HOSTING_ON !== 'false') services.push('Hébergement Anti-Red')
    return `<b>Devenez revendeur ${CHAT_BOT_BRAND}</b>

Revendez notre suite complète — ${services.join(', ')} — sous votre marque.

<b>65/35%</b> de partage des bénéfices. Appuyez sur 💬 <b>Obtenir de l'aide</b> pour commencer.`
  })(),
  resetLoginAdmit: `${CHAT_BOT_BRAND} SMS: You have been successfully logged out of your previous device.Please login now`,
  resetLoginDeny: 'Ok sure. No further action required.',
  resetLogin: `${CHAT_BOT_BRAND}SMS: Are you trying to log out of your previous device?`,
  select: `Veuillez sélectionner une option :`,
  urlShortenerSelect: `Raccourcir, personnaliser ou suivre vos liens :`,
  selectPlan: `Veuillez sélectionner un plan :`,
  backButton: '⬅️ Retour',
  yesProceedWithThisEmail: email => `Continuer avec ${email}`,
  skipEmail: 'Ignorer (pas d\'email)',
  proceedWithPayment: 'Continuer avec le paiement',
  iHaveSentThePayment: `J'ai envoyé le paiement ✅`,
  trialAlreadyUsed: `Vous avez déjà utilisé votre essai gratuit. Si vous avez besoin de plus d'accès, veuillez envisager de souscrire à l'un de nos plans payants.`,
  oneHourLeftToExpireTrialPlan: `Votre plan Freedom expirera dans 1 heure. Si vous souhaitez continuer à utiliser nos services, envisagez de passer à un plan payant !`,
  freePlanExpired: `🚫 Votre plan Freedom a expiré. Nous espérons que vous avez apprécié votre essai. Pour continuer à utiliser nos services, veuillez acheter l'un de nos plans premium.`,
  freeTrialPlanSelected: hostingType => `
- Essayez notre <b>Plan Freedom</b> gratuitement ! Ce plan comprend un domaine gratuit se terminant par .sbs et sera actif pendant 12 heures.

🚀 <b>Plan Freedom :</b>
<b>- Stockage :</b> 1 Go SSD
<b>- Bande passante :</b> 10 Go
<b>- Domaines :</b> 1 domaine gratuit .sbs
<b>- Comptes email :</b> 1 compte email
<b>- Bases de données :</b> 1 base de données MySQL
<b>- SSL gratuit :</b> Oui
<b>- Fonctionnalités HostPanel :</b> Accès complet à HostPanel pour gérer les fichiers, la base de données et les emails, etc.
<b>- Durée :</b> Actif pendant 12 heures
<b>- Idéal pour :</b> Tests et projets de courte durée.
`,

  getFreeTrialPlan: `Veuillez entrer le nom de domaine souhaité (par exemple, example.sbs) et l'envoyer en tant que message. Ce domaine se terminera par .sbs et est gratuit avec votre plan d'essai.`,
  trialPlanContinueWithDomainNameSBSMatched: websiteName => `Le domaine ${websiteName} est disponible !`,
  trialPlanSBSDomainNotMatched: `Le domaine que vous avez entré est introuvable. Veuillez vérifier le domaine ou en essayer un autre.`,
  trialPlanSBSDomainIsPremium: `Le domaine est à prix premium et uniquement disponible avec un plan payant. Veuillez rechercher un autre domaine.`,
  trialPlanGetNowInvalidDomain: `Veuillez entrer un nom de domaine valide qui se termine par '.sbs'. Le domaine devrait ressembler à 'example.sbs' et est gratuit avec votre plan d'essai.`,
  trialPlanNameserverSelection: websiteName =>
    `Veuillez sélectionner le fournisseur de serveur de noms que vous souhaitez utiliser pour ${websiteName}.`,
  trialPlanDomainNameMatched: `Veuillez fournir votre adresse e-mail pour créer votre compte et recevoir votre reçu.`,
  confirmEmailBeforeProceedingSBS: email =>
    `Êtes-vous sûr de vouloir continuer avec cet e-mail ${email} pour l'abonnement au Plan Freedom ?`,
  trialPlanInValidEmail: `Veuillez fournir une adresse e-mail valide.`,
  trialPlanActivationConfirmation: `Merci ! Votre plan d'essai gratuit sera activé sous peu. Veuillez noter que ce plan sera actif uniquement pendant 12 heures.`,
  trialPlanActivationInProgress: `Votre plan d'essai gratuit est en cours d'activation. Cela peut prendre quelques instants...`,
  what: `Cette option n'est pas disponible. Veuillez choisir parmi les boutons ci-dessous.`,
  whatNum: `Veuillez choisir un numéro valide.`,
  phoneGenTimeout: `Délai expiré.`,
  phoneGenNoGoodHits: `Veuillez appuyer sur 💬 Obtenir de l'aide ou sélectionner un autre indicatif régional.`,

  subscribeRCS: p =>
    `Abonné ! Désabonnez-vous à tout moment en cliquant sur le <a href="${SELF_URL}/unsubscribe?a=b&Phone=${p}">lien</a>.`,
  unsubscribeRCS: p =>
    `Vous êtes désabonné ! Pour vous abonner à nouveau, cliquez sur le <a href="${SELF_URL}/subscribe?a=b&Phone=${p}">lien</a>.`,
  argsErr: `dev : arguments incorrects envoyés`,
  showDepositNgnInfo:
    ngn => `Veuillez envoyer ${ngn} NGN en cliquant sur “Effectuer le paiement” ci-dessous. Une fois la transaction confirmée, vous serez rapidement notifié, et votre portefeuille sera mis à jour.

Cordialement,  
${CHAT_BOT_NAME}`,
  askEmail: `Veuillez fournir un e-mail pour la confirmation du paiement.`,
  askValidAmount: 'Veuillez fournir un montant valide.',
  askValidEmail: 'Veuillez fournir un e-mail valide.',
  askValidCrypto: 'Veuillez choisir une crypto-monnaie valide.',
  askValidPayOption: 'Veuillez choisir une option de paiement valide.',
  chooseSubscription:
    HIDE_SMS_APP === 'true'
      ? `<b>Choisissez votre plan</b>

<b>Quotidien</b> — $${PRICE_DAILY}
${DAILY_PLAN_FREE_DOMAINS} domaine · ${DAILY_PLAN_FREE_VALIDATIONS.toLocaleString()} validations avec noms des propriétaires · Liens illimités

<b>Hebdomadaire</b> — $${PRICE_WEEKLY}
${WEEKLY_PLAN_FREE_DOMAINS} domaines · ${WEEKLY_PLAN_FREE_VALIDATIONS.toLocaleString()} validations avec noms des propriétaires · Liens illimités

<b>Mensuel</b> — $${PRICE_MONTHLY}
${MONTHLY_PLAN_FREE_DOMAINS} domaines · ${MONTHLY_PLAN_FREE_VALIDATIONS.toLocaleString()} validations avec noms des propriétaires · Liens illimités

<i>Tous les plans incluent des domaines .sbs/.xyz gratuits + raccourcissement d'URL illimité + noms des propriétaires sur toutes les validations USA.</i>`
      : `<b>Choisissez votre plan</b>

<b>Quotidien</b> — $${PRICE_DAILY}
${DAILY_PLAN_FREE_DOMAINS} domaine · ${DAILY_PLAN_FREE_VALIDATIONS.toLocaleString()} validations avec noms des propriétaires · Liens + SMS illimités

<b>Hebdomadaire</b> — $${PRICE_WEEKLY}
${WEEKLY_PLAN_FREE_DOMAINS} domaines · ${WEEKLY_PLAN_FREE_VALIDATIONS.toLocaleString()} validations avec noms des propriétaires · Liens + SMS illimités

<b>Mensuel</b> — $${PRICE_MONTHLY}
${MONTHLY_PLAN_FREE_DOMAINS} domaines · ${MONTHLY_PLAN_FREE_VALIDATIONS.toLocaleString()} validations avec noms des propriétaires · Liens + SMS illimités

<i>Tous les plans incluent des domaines .sbs/.xyz gratuits + raccourcissement d'URL illimité + noms des propriétaires sur toutes les validations USA.</i>`,

  askCoupon: usd =>
    `Le prix est de $${usd}. Souhaitez-vous utiliser un code promo ? Si vous en avez un, veuillez l'entrer maintenant. Sinon, appuyez sur "Passer".`,
  planAskCoupon: `Souhaitez-vous utiliser un code promo ? Si vous en avez un, veuillez l'entrer maintenant. Sinon, appuyez sur "Passer".`,
  enterCoupon: `Veuillez entrer un code promo :`,
  planPrice: (plan, price) =>
    `Le prix de l'abonnement ${plan} est de $${price}. Veuillez choisir une méthode de paiement.`,
  planNewPrice: (plan, price, newPrice) =>
    `Le prix de l'abonnement ${plan} est désormais $${view(
      newPrice,
    )} <s>($${price})</s>. Veuillez choisir une méthode de paiement.`,
  domainPrice: (domain, price) =>
    `Le prix du domaine ${domain} est de $${price} USD. Veuillez choisir une méthode de paiement.`,
  domainNewPrice: (domain, price, newPrice) =>
    `Le prix du domaine ${domain} est désormais $${view(
      newPrice,
    )} <s>($${price})</s>. Veuillez choisir une méthode de paiement.`,
  couponInvalid: `Code promo invalide. Veuillez entrer un autre code promo :`,
  lowPrice: `Prix inférieur au minimum requis.`,
  freeTrialAvailable: `Votre essai gratuit BulkSMS est maintenant activé. Veuillez télécharger l'application Android ${SMS_APP_NAME} ici : ${SMS_APP_LINK}. Besoin de cartes E-sim ? Appuyez sur 💬 Obtenir de l'aide.`,
  freeTrialNotAvailable: `Vous avez déjà utilisé l'essai gratuit.`,
  planSubscribed:
    HIDE_SMS_APP === 'true'
      ? `Vous vous êtes abonné avec succès au plan {{plan}} ! Profitez de domaines ".sbs/.xyz" gratuits, de liens Shortit illimités et de validations de numéros USA gratuites avec noms des propriétaires inclus. Besoin d'une carte E-sim ? Appuyez sur 💬 Obtenir de l'aide.`
      : `Vous vous êtes abonné avec succès au plan {{plan}} ! Profitez de domaines ".sbs/.xyz" gratuits, de liens Shortit illimités, de validations USA gratuites avec noms des propriétaires inclus et de ${SMS_APP_NAME}. Téléchargez l'application ici : ${SMS_APP_LINK}. Besoin d'une carte E-sim ? Appuyez sur 💬 Obtenir de l'aide.`,
  alreadySubscribedPlan: days => `Votre abonnement est actif et expire dans ${days} jours.`,
  payError: `Session de paiement introuvable. Veuillez réessayer ou appuyer sur 💬 Obtenir de l'aide. Découvrez plus sur ${TG_HANDLE}.`,
  chooseFreeDomainText: `<b>Bonne nouvelle !</b> Ce domaine est disponible gratuitement avec votre abonnement. Souhaitez-vous le réclamer ?`,

  chooseDomainToBuy: text =>
    `<b>Réclamez votre coin du web !</b> Veuillez partager le nom de domaine que vous souhaitez acheter, par exemple "abcpay.com". ${text}`,
  askDomainToUseWithShortener: `Utiliser ce domaine comme <b>raccourcisseur d'URL</b> ?\n\n<b>Oui</b> — DNS auto-configuré. Liens courts : <code>votredomaine.com/abc</code>.\n\n<b>Non</b> — Enregistrement seul. Activable plus tard depuis Gestion DNS.`,
  blockUser: `Veuillez partager le nom d'utilisateur de l'utilisateur à bloquer.`,
  unblockUser: `Veuillez partager le nom d'utilisateur de l'utilisateur à débloquer.`,
  blockedUser: `Vous êtes actuellement bloqué d'utiliser le bot. Veuillez appuyer sur 💬 Obtenir de l'aide. Découvrez plus ${TG_HANDLE}.`,
  greet: `${CHAT_BOT_BRAND} — raccourcissez vos URLs, enregistrez des domaines, achetez des leads et developpez votre activite. Directement depuis Telegram.
Commencez avec ${FREE_LINKS} liens Shortit d'essai — /start
Support: Appuyez sur 💬 Obtenir de l'aide`,
  linkExpired: `Votre essai ${CHAT_BOT_BRAND} a pris fin et votre lien raccourci est désactivé. Nous vous invitons à vous abonner pour maintenir l'accès à notre service d'URL et aux noms de domaine gratuits. Choisissez un plan approprié et suivez les instructions pour vous abonner. Veuillez nous contacter pour toute question.
Cordialement,
L'équipe ${CHAT_BOT_BRAND}
Découvrez plus : ${TG_CHANNEL}`,
  successPayment: `Paiement traité avec succès ! Vous pouvez maintenant fermer cette fenêtre.`,
  welcome: `Merci d'avoir choisi ${CHAT_BOT_NAME} ! Veuillez choisir une option ci-dessous :`,
  welcomeFreeTrial: `Bienvenue sur ${CHAT_BOT_BRAND} ! Vous avez ${FREE_LINKS} liens Shortit d'essai pour raccourcir vos URLs. Abonnez-vous pour des liens Shortit illimités, des domaines ".sbs/.xyz" gratuits et des validations de numéros USA gratuites avec noms des propriétaires. Découvrez la différence ${CHAT_BOT_BRAND} !`,
  unknownCommand: `Commande introuvable. Appuyez sur /start ou veuillez appuyer sur 💬 Obtenir de l'aide. Découvrez plus ${TG_HANDLE}.`,
  support: `Veuillez appuyer sur 💬 Obtenir de l'aide. Découvrez plus ${TG_HANDLE}.`,
  joinChannel: `Veuillez rejoindre la chaîne ${TG_CHANNEL}.`,
  dnsPropagated: `La propagation DNS pour {{domain}} est terminée pour un raccourcissement d'URL illimité.`,
  dnsNotPropagated: `La propagation DNS pour {{domain}} est en cours et vous serez mis à jour une fois terminée. ✅`,
  domainBoughtSuccess: domain => `Le domaine ${domain} est maintenant à vous. Merci de nous avoir choisi.

Cordialement,
${CHAT_BOT_NAME}`,

  domainBought: `Votre domaine {{domain}} est désormais lié à votre compte tandis que la propagation DNS est en cours. Vous serez mis à jour automatiquement très bientôt.🚀`,
  domainLinking: domain =>
    `Lien du domaine avec votre compte. Veuillez noter que la mise à jour DNS peut prendre jusqu'à 30 minutes. Vous pouvez vérifier le statut de votre mise à jour DNS ici : https://www.whatsmydns.net/#A/${domain}`,
  errorSavingDomain: `Erreur lors de l'enregistrement du domaine sur le serveur, veuillez appuyer sur 💬 Obtenir de l'aide. Découvrez plus ${TG_HANDLE}.`,
  chooseDomainToManage: `Veuillez sélectionner un domaine si vous souhaitez gérer ses paramètres DNS.`,
  chooseDomainWithShortener: `Veuillez sélectionner ou acheter le nom de domaine que vous souhaitez relier à votre lien raccourci.`,
  viewDnsRecords: (records, domain, nameserverType) => {
    let msg = `<b>Enregistrements DNS pour ${domain}</b>\n`

    // NS section — special display
    const nsRecs = records['NS']
    if (nsRecs && nsRecs.length) {
      const provider = nameserverType === 'cloudflare' ? 'Cloudflare' : 'Registraire'
      msg += `\n<b>SERVEURS DE NOMS</b> <i>(${provider})</i>\n`
      for (let i = 0; i < nsRecs.length; i++) {
        msg += `  NS${i + 1}: <code>${nsRecs[i].recordContent || '—'}</code>\n`
      }
      msg += `<i>Utilisez "Modifier DNS" pour changer.</i>\n`
    }

    const otherTypes = ['A', 'AAAA', 'MX', 'TXT', 'CNAME', 'SRV', 'CAA']
    const typeLabels = {
      A: 'Enregistrements A', AAAA: 'Enregistrements AAAA', CNAME: 'Enregistrements CNAME',
      MX: 'Enregistrements MX', TXT: 'Enregistrements TXT',
      SRV: 'Enregistrements SRV', CAA: 'Enregistrements CAA',
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
          const pri = r.priority !== undefined ? ` (pri:${r.priority})` : ''
          msg += `${idx} MX ${host}${pri} -> ${r.recordContent || 'AUCUN'}\n`
        } else if (type === 'TXT') {
          const val = r.recordContent ? (r.recordContent.length > 60 ? r.recordContent.substring(0, 60) + '...' : r.recordContent) : 'AUCUN'
          msg += `${idx} TXT ${host} -> ${val}\n`
        } else if (type === 'SRV') {
          msg += `${idx} SRV ${r.recordName || ''} -> ${r.recordContent || 'AUCUN'}\n`
        } else {
          msg += `${idx} ${type} ${host} -> ${r.recordContent || 'AUCUN'}\n`
        }
      }
    }
    const hasAny = ['NS', ...otherTypes].some(t => records[t]?.length)
    if (!hasAny) msg += '\nAucun enregistrement DNS trouve.\n'
    return msg
  },

  addDns: `Ajouter un enregistrement DNS`,
  updateDns: `Mettre à jour un enregistrement DNS`,
  deleteDns: `Supprimer un enregistrement DNS`,
  activateShortener: '🔗 Activer pour le raccourcisseur d\'URL',
  deactivateShortener: '🔗 Désactiver le raccourcisseur d\'URL',
  quickActions: 'Actions rapides',

  // DNS Wizard strings (fr)
  mx: 'Enregistrement MX',
  txt: 'Enregistrement TXT',
  'Enregistrement MX': 'MX',
  'Enregistrement TXT': 'TXT',
  dnsQuickActionMenu: 'Choisissez une configuration prédéfinie :',
  dnsQuickAskIp: 'Entrez l\'adresse IP du serveur (IPv4) :',
  dnsQuickAskVerificationTxt: 'Collez la valeur TXT de vérification de votre fournisseur :',
  dnsQuickAskSubdomainName: 'Entrez le nom du sous-domaine (ex: api, blog, app) :',
  dnsQuickAskSubdomainTargetType: (full) => `Comment souhaitez-vous pointer ${full} ?`,
  dnsQuickSubdomainIp: 'Pointer vers une IP (A)',
  dnsQuickSubdomainDomain: 'Pointer vers un domaine (CNAME)',
  dnsQuickAskSubdomainIp: 'Entrez l\'adresse IP :',
  dnsQuickAskSubdomainDomain: 'Entrez le domaine cible :',
  dnsQuickSetupProgress: (step, total) => `Configuration en cours (${step}/${total})...`,
  dnsQuickSetupError: (what) => `Erreur lors de la création de ${what}. Veuillez réessayer.`,
  dnsQuickGoogleDone: (domain) => `Google Workspace configuré pour ${domain} ! 5 enregistrements MX + SPF ajoutés.`,
  dnsQuickZohoDone: (domain) => `Zoho Mail configuré pour ${domain} ! 3 enregistrements MX + SPF ajoutés.`,
  dnsQuickPointToIpDone: (domain, ip) => `${domain} pointe maintenant vers ${ip}.\nA: ${domain} → ${ip}\nCNAME: www.${domain} → ${domain}`,
  dnsQuickVerificationDone: 'Enregistrement TXT de vérification ajouté !',
  dnsQuickSubdomainDone: (sub, target, type) => `${sub} pointe maintenant vers ${target} (${type})`,
  dnsInvalidIpv4: 'Adresse IPv4 invalide. Entrez une IP valide (ex: 192.168.1.1) :',
  dnsInvalidHostname: 'Nom d\'hôte invalide. Utilisez des caractères alphanumériques, tirets, underscores et points (ex: api, _dmarc, neo1._domainkey) :',
  dnsInvalidMxPriority: 'Priorité invalide. Entrez un nombre entre 1 et 65535 :',
  askDnsHostname: {
    A: '<b>Ajouter un enregistrement A</b>\n\nEntrez le nom d\'hôte :\ne.g. <b>@</b> pour racine, ou <b>api</b>, <b>blog</b>, <b>www</b>',
    CNAME: '<b>Ajouter un enregistrement CNAME</b>\n\nEntrez le sous-domaine :\ne.g. <b>www</b>, <b>api</b>, <b>blog</b>\n\nNote : CNAME ne peut pas être utilisé pour la racine (@)',
    MX: '<b>Ajouter un enregistrement MX</b> (Étape 1/3)\n\nEntrez le nom d\'hôte :\ne.g. <b>@</b> pour email racine, ou un sous-domaine',
    TXT: '<b>Ajouter un enregistrement TXT</b> (Étape 1/2)\n\nEntrez le nom d\'hôte :\ne.g. <b>@</b> pour racine, ou <b>_dmarc</b>, <b>mail</b>',
    NS: '<b>Ajouter un enregistrement NS</b>\n\nEntrez le serveur de noms :\ne.g. <b>ns1.cloudflare.com</b>',
    AAAA: '<b>Ajouter un enregistrement AAAA</b> (Étape 1/2)\n\nEntrez le nom d\'hôte :\ne.g. <b>@</b> pour racine, ou <b>api</b>, <b>blog</b>',
  },
  askDnsValue: {
    A: 'Entrez l\'adresse IPv4 :\ne.g. <b>192.168.1.1</b>',
    CNAME: 'Entrez le domaine cible :\ne.g. <b>myapp.railway.app</b>',
    MX: '<b>Étape 2/3</b> — Entrez le serveur de messagerie :\ne.g. <b>ASPMX.L.GOOGLE.COM</b>',
    TXT: '<b>Étape 2/2</b> — Entrez la valeur TXT :\ne.g. <b>v=spf1 include:_spf.google.com ~all</b>',
    AAAA: '<b>Étape 2/2</b> — Entrez l\'adresse IPv6 :\ne.g. <b>2001:db8::1</b>',
  },
  askMxPriority: '<b>Étape 3/3</b> — Entrez la priorité MX (plus bas = plus prioritaire) :\ne.g. <b>10</b> pour primaire, <b>20</b> pour sauvegarde',
  dnsQuickActions: {
    pointToIp: 'Pointer vers une IP',
    googleEmail: 'Email Google Workspace',
    zohoEmail: 'Email Zoho',
    verification: 'Vérification de domaine (TXT)',
    addSubdomain: 'Ajouter un sous-domaine',
  },

  // Phase 2: AAAA, SRV, CAA
  aaaa: 'Enregistrement AAAA',
  'Enregistrement AAAA': 'AAAA',
  srvRecord: 'Enregistrement SRV',
  'Enregistrement SRV': 'SRV',
  caaRecord: 'Enregistrement CAA',
  'Enregistrement CAA': 'CAA',
  dnsInvalidIpv6: 'Adresse IPv6 invalide. Entrez une IPv6 valide (ex: 2001:db8::1) :',
  dnsInvalidPort: 'Numéro de port invalide. Entrez un nombre entre 1 et 65535 :',
  dnsInvalidWeight: 'Poids invalide. Entrez un nombre entre 0 et 65535 :',
  dnsSrvCaaNotSupported: 'Les enregistrements SRV et CAA ne sont pas pris en charge par votre fournisseur DNS actuel (ConnectReseller). Passez aux serveurs de noms Cloudflare ou OpenProvider.',
  askSrvService: '<b>Ajouter un enregistrement SRV</b> (Étape 1/5)\n\nEntrez le service et le protocole :\ne.g. <b>_sip._tcp</b>, <b>_http._tcp</b>',
  askSrvTarget: '<b>Étape 2/5</b> — Entrez le nom d\'hôte cible :\ne.g. <b>sipserver.example.com</b>',
  askSrvPort: '<b>Étape 3/5</b> — Entrez le numéro de port :\ne.g. <b>5060</b>, <b>443</b>',
  askSrvPriority: '<b>Étape 4/5</b> — Entrez la priorité (plus bas = plus prioritaire) :\ne.g. <b>10</b>',
  askSrvWeight: '<b>Étape 5/5</b> — Entrez le poids (équilibrage de charge) :\ne.g. <b>100</b>',
  askCaaHostname: '<b>Ajouter un enregistrement CAA</b> (Étape 1/3)\n\nEntrez le nom d\'hôte :\ne.g. <b>@</b> pour le domaine racine',
  askCaaTag: '<b>Étape 2/3</b> — Sélectionnez le tag CAA :',
  caaTagIssue: 'issue — Autoriser une AC',
  caaTagIssuewild: 'issuewild — Autoriser wildcard',
  caaTagIodef: 'iodef — URL de rapport de violation',
  'issue — Autoriser une AC': 'issue',
  'issuewild — Autoriser wildcard': 'issuewild',
  'iodef — URL de rapport de violation': 'iodef',
  askCaaValue: (tag) => {
    if (tag === 'iodef') return '<b>Étape 3/3</b> — Entrez l\'URL de rapport :\ne.g. <b>mailto:admin@example.com</b>'
    return '<b>Étape 3/3</b> — Entrez le domaine de l\'AC autorisée :\ne.g. <b>letsencrypt.org</b>'
  },
  askDnsHostnameAaaa: 'Entrez le nom d\'hôte (@ pour racine, ou sous-domaine comme <b>api</b>, <b>blog</b>) :',
  askDnsValueAaaa: 'Entrez l\'adresse IPv6 (ex: <b>2001:db8::1</b>) :',

  // DNS Validation Checker
  checkDns: 'Vérifier DNS',
  dnsChecking: (domain) => `Vérification DNS pour <b>${domain}</b>...`,
  dnsRecordLive: (type, value) => `<b>${type}</b> est actif, résolution vers <b>${value}</b>.`,
  dnsRecordPropagating: (type) => `<b>${type}</b> est en cours de propagation. Cela peut prendre 24-48h.`,
  dnsHealthTitle: (domain) => `<b>Bilan DNS — ${domain}</b>\n`,
  dnsHealthRow: (type, found, count, answers) => {
    if (!found) return `  ${type}: —`
    const vals = answers.slice(0, 2).join(', ')
    const more = answers.length > 2 ? ` +${answers.length - 2} de plus` : ''
    return `  ${type}: ${count} enregistrement${count > 1 ? 's' : ''} (${vals}${more})`
  },
  dnsHealthSummary: (resolving, total) => `\n${resolving}/${total} types résolus.`,
  dnsCheckError: 'La vérification DNS a échoué. Réessayez plus tard.',
  switchToCf: '☁️ Switch to Cloudflare',
  switchToCfConfirm: (domain) => `<b>Basculer ${domain} vers Cloudflare DNS ?</b>\n\nCela va :\n1. Créer une zone Cloudflare pour votre domaine\n2. Migrer les enregistrements DNS existants vers Cloudflare\n3. Mettre à jour vos serveurs de noms chez le registraire\n\nLa propagation DNS peut prendre 24-48h.\n\nContinuer ?`,
  switchToCfProgress: (domain) => `⏳ Basculement de <b>${domain}</b> vers Cloudflare DNS…`,
  switchToCfSuccess: (domain, ns) => `<b>Terminé !</b> ${domain} utilise maintenant Cloudflare DNS.\n\n<b>Nouveaux serveurs de noms :</b>\n${ns.map((n, i) => `NS${i + 1}: <code>${n}</code>`).join('\n')}`,
  switchToCfError: (error) => `❌ Échec du basculement vers Cloudflare : ${error}`,
  switchToCfAlreadyCf: 'Ce domaine utilise déjà Cloudflare DNS.',
  switchToProviderDefault: '🏠 Passer au DNS du fournisseur',
  switchToProviderConfirm: (domain) => `<b>Basculer ${domain} vers le DNS du fournisseur ?</b>\n\nCela va :\n1. Migrer les enregistrements DNS de Cloudflare vers votre registraire\n2. Restaurer les serveurs de noms par défaut\n3. Supprimer la zone Cloudflare\n\nLa propagation DNS peut prendre 24-48h.\n\nContinuer ?`,
  switchToProviderProgress: (domain) => `⏳ Basculement de <b>${domain}</b> vers le DNS du fournisseur…`,
  switchToProviderSuccess: (domain, ns) => `<b>Terminé !</b> ${domain} utilise maintenant le DNS du fournisseur.\n\n<b>Nouveaux serveurs de noms :</b>\n${ns.map((n, i) => `NS${i + 1}: <code>${n}</code>`).join('\n')}`,
  switchToProviderError: (error) => `❌ Échec du basculement vers le DNS du fournisseur : ${error}`,
  switchToProviderAlreadyProvider: 'Ce domaine utilise déjà le DNS du fournisseur.',
  updateNsPrompt: (nsRecords, slotIndex) => {
    let msg = `<b>Modifier Serveur de Noms — Slot NS${slotIndex}</b>\n\n<b>Disposition actuelle :</b>\n`
    for (let i = 0; i < nsRecords.length; i++) {
      const marker = (i + 1) === slotIndex ? ' ← modification' : ''
      msg += `  NS${i + 1}: <code>${nsRecords[i].recordContent || '—'}</code>${marker}\n`
    }
    msg += `\nEntrez le nouveau serveur de noms pour <b>NS${slotIndex}</b> :\ne.g. <b>ns1.cloudflare.com</b>`
    return msg
  },

  // Digital Products
  digitalProductsSelect: `🛒 <b>Produits numériques</b>\n\nComptes vérifiés livrés <b>rapidement</b> via ce bot.\n\n<b>Télécom</b> — Twilio, Telnyx (SMS, Voix, SIP)\n<b>Cloud</b> — AWS, Google Cloud (Accès complet)\n<b>Email</b> — Google Workspace, Zoho Mail\n<b>Mobile</b> — eSIM T-Mobile\n\nPayez par crypto, virement bancaire ou portefeuille. Sélectionnez ci-dessous :`,
  dpTwilioMain: `📞 Compte Twilio Principal — $${DP_PRICE_TWILIO_MAIN}`,
  dpTwilioSub: `📞 Sous-compte Twilio — $${DP_PRICE_TWILIO_SUB}`,
  dpTelnyxMain: `📡 Compte Telnyx Principal — $${DP_PRICE_TELNYX_MAIN}`,
  dpTelnyxSub: `📡 Sous-compte Telnyx — $${DP_PRICE_TELNYX_SUB}`,
  dpGworkspaceNew: `📧 Google Workspace (Nouveau domaine) — $${DP_PRICE_GWORKSPACE_NEW}`,
  dpGworkspaceAged: `📧 Google Workspace (Domaine ancien) — $${DP_PRICE_GWORKSPACE_AGED}`,
  dpEsim: `📱 eSIM T-Mobile — $${DP_PRICE_ESIM}`,
  dpZohoNew: `📧 Zoho Mail (Nouveau domaine) — $${DP_PRICE_ZOHO_NEW}`,
  dpZohoAged: `📧 Zoho Mail (Domaine ancien) — $${DP_PRICE_ZOHO_AGED}`,
  dpAwsMain: `☁️ Compte AWS Principal — $${DP_PRICE_AWS_MAIN}`,
  dpAwsSub: `☁️ Sous-compte AWS — $${DP_PRICE_AWS_SUB}`,
  dpGcloudMain: `🌐 Google Cloud Principal — $${DP_PRICE_GCLOUD_MAIN}`,
  dpGcloudSub: `🌐 Google Cloud Sous-compte — $${DP_PRICE_GCLOUD_SUB}`,
  dpPaymentPrompt: (product, price) => {
    const descriptions = {
      'Twilio Main Account': 'Compte Twilio principal avec acces Console, cles API, numeros de telephone, SMS/MMS et appels vocaux. Comprend 2 Sender IDs et $20 de credit.\n\nVous recevez : identifiants de connexion + API SID & Auth Token.',
      'Twilio Sub-Account': 'Sous-compte Twilio avec connexion Console et identifiants API pour SMS, voix et numeros. Comprend 2 Sender IDs et $20 de credit.\n\nVous recevez : identifiants de connexion, Account SID & Auth Token.',
      'Telnyx Main Account': 'Compte Telnyx principal avec acces Mission Control Portal. Numeros, SIP, messagerie et voix. Comprend 2 Sender IDs et $20 de credit.\n\nVous recevez : identifiants de connexion + cle API.',
      'Telnyx Sub-Account': 'Sous-compte Telnyx avec connexion Mission Control Portal et acces API pour messagerie, voix et numeros. Comprend 2 Sender IDs et $20 de credit.\n\nVous recevez : identifiants de connexion + cle API.',
      'AWS Main Account': 'Compte AWS root avec acces Console a tous les services — EC2, S3, Lambda, SES, etc.\n\nVous recevez : email root, mot de passe et configuration MFA.',
      'AWS Sub-Account': 'Sous-compte AWS (Organizations) avec connexion Console et acces aux services principaux — EC2, S3, Lambda, etc.\n\nVous recevez : identifiants de connexion et acces IAM.',
      'Google Cloud Main Account': 'Compte Google Cloud principal avec facturation activee. Compute Engine, Cloud Storage, BigQuery et tous les services GCP.\n\nVous recevez : identifiants de connexion.',
      'Google Cloud Sub-Account': 'Projet Google Cloud avec connexion Console et acces editeur. Compute, stockage et API inclus.\n\nVous recevez : identifiants de connexion et cle de compte de service.',
      'Google Workspace (New Domain)': 'Email professionnel Google Workspace sur un nouveau domaine. Email @votredomaine avec Gmail, Drive, Docs et Meet.\n\nVous recevez : connexion admin + identifiants domaine.',
      'Google Workspace (Aged Domain)': 'Google Workspace sur un domaine age pour une meilleure delivrabilite. Email avec suite Google complete.\n\nVous recevez : connexion admin + identifiants domaine.',
      'Zoho Mail (New Domain)': 'Email professionnel Zoho Mail sur un nouveau domaine. Email @votredomaine avec calendrier, contacts et stockage.\n\nVous recevez : connexion admin + configuration domaine.',
      'Zoho Mail (Aged Domain)': 'Zoho Mail sur un domaine age pour une meilleure reputation. Email avec suite Zoho complete.\n\nVous recevez : connexion admin + identifiants domaine.',
      'eSIM T-Mobile': 'eSIM T-Mobile avec forfait data actif. Pas de SIM physique — activation instantanee.\n\nVous recevez : QR code ou details d\'activation.',
    }
    const desc = descriptions[product] || ''
    return `💰 <b>Commande : ${product}</b>\n\n💵 Prix : <b>$${price}</b>${desc ? '\n\n' + desc : ''}\n\nSélectionnez le mode de paiement :`
  },
  dpOrderConfirmed: (product, price, orderId) => `✅ <b>Commande confirmée !</b>\n\n🛒 Produit : <b>${product}</b>\n💵 Montant : <b>$${price}</b>\n🆔 ID de commande : <code>${orderId}</code>\n\nVotre commande sera livrée via ce bot sous peu.\nPour toute question, contactez le support.`,

  // Virtual Card
  vcWelcome: `💳 <b>Carte de Débit Virtuelle</b>\n\nChargez une carte virtuelle du montant de votre choix.\n\n✅ Fonctionne en ligne dans le monde entier\n✅ Livraison instantanée\n✅ 50$ – 1 000$\n\nSélectionnez un montant ou entrez un montant personnalisé :`,
  vcInvalidAmount: `❌ Veuillez entrer un montant valide entre <b>50$</b> et <b>1 000$</b>.`,
  vcAskAddress: `📬 <b>Adresse de livraison</b>\n\nEntrez votre adresse complète au format international :\n\n<i>Exemple :\nJean Dupont\n123 Rue Principale, Apt 4B\nParis, 75001\nFrance</i>`,
  vcAddressTooShort: `❌ L'adresse semble trop courte. Veuillez inclure nom, rue, ville, code postal et pays.`,
  vcOrderSummary: (amount, fee, total) => `📋 <b>Récapitulatif</b>\n\n💳 Charge carte virtuelle : <b>${amount}$</b>\n💰 Frais de service : <b>${fee.toFixed(2)}$</b>${amount < 200 ? ' (min. 20$)' : ' (10%)'}\n━━━━━━━━━━━━━━━━━\n💵 <b>Total : ${total.toFixed(2)}$</b>\n\nChoisissez le mode de paiement :`,
  vcOrderConfirmed: (amount, total, orderId) => `✅ <b>Commande de carte virtuelle confirmée !</b>\n\n💳 Charge : <b>${amount}$</b>\n💵 Total payé : <b>${total.toFixed(2)}$</b>\n🆔 ID : <code>${orderId}</code>\n\n⏱ <b>Les détails de votre carte seront livrés ici sous peu.</b>`,
  leadsFileNumbersOnly: `📄 <b>Fichier 1 — Numéros de téléphone</b>\nTous les numéros vérifiés de votre lot.`,
  leadsFileWithNames: (count) => `📄 <b>Fichier 2 — Numéros + Nom du propriétaire (${count} correspondances)</b>\nCes leads incluent le vrai nom du propriétaire. Adressez-vous à eux personnellement — cela crée une confiance instantanée et augmente considérablement votre taux de réponse.`,
  addDnsTxt: "Sélectionnez le type d'enregistrement :",
  updateDnsTxt: "Sélectionnez l'enregistrement à modifier :",
  deleteDnsTxt: "Sélectionnez l'enregistrement à supprimer :",
  confirmDeleteDnsTxt: "Êtes-vous sûr de vouloir supprimer cet enregistrement ?",
  a: `Enregistrement A`,
  cname: `Enregistrement CNAME`,
  ns: `Enregistrement NS`,
  'Enregistrement A': `A`,
  'Enregistrement CNAME': `CNAME`,
  'Enregistrement NS': `NS`,
  askDnsContent: {
    NS: '<b>Ajouter un enregistrement NS</b>\n\nEntrez le serveur de noms :\ne.g. <b>ns1.cloudflare.com</b>',
    'NS Record': '<b>Ajouter un enregistrement NS</b>\n\nEntrez le serveur de noms :\ne.g. <b>ns1.cloudflare.com</b>',
  },
  askUpdateDnsContent: {
    A: (current) => `<b>Mettre à jour A Record</b>\nActuel: <b>${current || 'N/A'}</b>\n\nEntrez la nouvelle valeur adresse IPv4:\ne.g. <b>192.168.1.1</b>`,
    'A Record': (current) => `<b>Mettre à jour A Record</b>\nActuel: <b>${current || 'N/A'}</b>\n\nEntrez la nouvelle valeur adresse IPv4:\ne.g. <b>192.168.1.1</b>`,
    CNAME: (current) => `<b>Mettre à jour CNAME Record</b>\nActuel: <b>${current || 'N/A'}</b>\n\nEntrez la nouvelle valeur domaine cible:\ne.g. <b>myapp.railway.app</b>`,
    'CNAME Record': (current) => `<b>Mettre à jour CNAME Record</b>\nActuel: <b>${current || 'N/A'}</b>\n\nEntrez la nouvelle valeur domaine cible:\ne.g. <b>myapp.railway.app</b>`,
    NS: (current) => `<b>Mettre à jour NS Record</b>\nActuel: <b>${current || 'N/A'}</b>\n\nEntrez la nouvelle valeur serveur de noms:\ne.g. <b>ns1.cloudflare.com</b>`,
    'NS Record': (current) => `<b>Mettre à jour NS Record</b>\nActuel: <b>${current || 'N/A'}</b>\n\nEntrez la nouvelle valeur serveur de noms:\ne.g. <b>ns1.cloudflare.com</b>`,
    MX: (current) => `<b>Mettre à jour MX Record</b>\nActuel: <b>${current || 'N/A'}</b>\n\nEntrez la nouvelle valeur serveur de messagerie:\ne.g. <b>ASPMX.L.GOOGLE.COM</b>`,
    'MX Record': (current) => `<b>Mettre à jour MX Record</b>\nActuel: <b>${current || 'N/A'}</b>\n\nEntrez la nouvelle valeur serveur de messagerie:\ne.g. <b>ASPMX.L.GOOGLE.COM</b>`,
    TXT: (current) => {
      const display = current ? (current.length > 50 ? current.substring(0, 50) + '...' : current) : 'N/A'
      return `<b>Mettre à jour TXT Record</b>\nActuel: <b>${display}</b>\n\nEntrez la nouvelle valeur valeur TXT:\ne.g. <b>v=spf1 include:_spf.google.com ~all</b>`
    },
    'TXT Record': (current) => {
      const display = current ? (current.length > 50 ? current.substring(0, 50) + '...' : current) : 'N/A'
      return `<b>Mettre à jour TXT Record</b>\nActuel: <b>${display}</b>\n\nEntrez la nouvelle valeur valeur TXT:\ne.g. <b>v=spf1 include:_spf.google.com ~all</b>`
    },
    AAAA: (current) => `<b>Mettre à jour AAAA Record</b>\nActuel: <b>${current || 'N/A'}</b>\n\nEntrez la nouvelle valeur adresse IPv6:\ne.g. <b>2001:db8::1</b>`,
    'AAAA Record': (current) => `<b>Mettre à jour AAAA Record</b>\nActuel: <b>${current || 'N/A'}</b>\n\nEntrez la nouvelle valeur adresse IPv6:\ne.g. <b>2001:db8::1</b>`,
  },
  dnsRecordSaved: "Enregistrement ajouté avec succès. Les modifications DNS peuvent prendre jusqu'à 24h pour se propager.",
  dnsRecordDeleted: 'Enregistrement supprimé avec succès.',
  dnsRecordUpdated: "Enregistrement mis à jour avec succès. Les modifications DNS peuvent prendre jusqu'à 24h pour se propager.",
  provideLink: `Veuillez fournir une URL valide. ex https://google.com`,
  comingSoonWithdraw: `Les retraits ne sont pas encore disponibles. Besoin d'aide ? Appuyez sur 💬 Obtenir de l'aide.`,
  promoOptOut: `Vous avez été désabonné des messages promotionnels. Tapez /start_promos pour vous réabonner à tout moment.`,
  promoOptIn: `Vous êtes de nouveau abonné aux messages promotionnels. Vous recevrez nos dernières offres et promotions !`,
  selectCurrencyToDeposit: `Veuillez sélectionner la devise à déposer`,
  depositNGN: `Veuillez entrer le montant NGN :`,
  askEmailForNGN: `Veuillez fournir un email pour la confirmation du paiement`,
  depositUSD: `Veuillez entrer le montant USD, notez que la valeur minimum est de 10 USD :`,
  selectCryptoToDeposit: `Veuillez choisir une cryptomonnaie :`,
  'bank-pay-plan': (priceNGN, plan) =>
    `Veuillez envoyer ${priceNGN} NGN en cliquant sur "Faire le paiement" ci-dessous. Une fois la transaction confirmée, vous serez notifié immédiatement et votre plan ${plan} sera activé sans encombre.

Cordialement,
${CHAT_BOT_NAME}`,
  bankPayDomain: (priceNGN, domain) =>
    `Veuillez envoyer ${priceNGN} NGN en cliquant sur "Faire le paiement" ci-dessous. Une fois la transaction confirmée, vous serez notifié immédiatement et votre domaine ${domain} sera activé sans encombre.

Cordialement,
${CHAT_BOT_NAME}`,
  showDepositCryptoInfoPlan: (priceUsd, priceCrypto, tickerView, address, plan) =>
    `💰 <b>Montant du paiement : ${Number(priceUsd).toFixed(2)} $ USD</b>

Envoyez exactement <b>${priceCrypto} ${tickerView}</b> à :

<code>${address}</code>

Votre plan ${plan} sera activé automatiquement une fois le paiement confirmé (généralement en quelques minutes).

Cordialement,
${CHAT_BOT_NAME}`,
  showDepositCryptoInfoDomain: (priceUsd, priceCrypto, tickerView, address, domain) =>
    `💰 <b>Montant du paiement : ${Number(priceUsd).toFixed(2)} $ USD</b>

Envoyez exactement <b>${priceCrypto} ${tickerView}</b> à :

<code>${address}</code>

Votre domaine ${domain} sera activé automatiquement une fois le paiement confirmé (généralement en quelques minutes).

Cordialement,
${CHAT_BOT_NAME}`,

  showDepositCryptoInfoLeads: (priceUsd, priceCrypto, tickerView, address, label) =>
    `💰 <b>Montant du paiement : ${Number(priceUsd).toFixed(2)} $ USD</b>

Envoyez exactement <b>${priceCrypto} ${tickerView}</b> à :

<code>${address}</code>

Vos ${label} seront livrés automatiquement une fois le paiement confirmé (généralement en quelques minutes).

Cordialement,
${CHAT_BOT_NAME}`,

  showDepositCryptoInfoPhone: (priceUsd, priceCrypto, tickerView, address, phoneNumber) =>
    `💰 <b>Montant du paiement : ${Number(priceUsd).toFixed(2)} $ USD</b>

Envoyez exactement <b>${priceCrypto} ${tickerView}</b> à :

<code>${address}</code>

Votre numéro Cloud IVR ${phoneNumber} sera activé automatiquement une fois le paiement confirmé (généralement en quelques minutes).

Cordialement,
${CHAT_BOT_NAME}`,

  showDepositCryptoInfoDigitalProduct: (priceUsd, priceCrypto, tickerView, address, product) =>
    `💰 <b>Montant du paiement : ${Number(priceUsd).toFixed(2)} $ USD</b>

Envoyez exactement <b>${priceCrypto} ${tickerView}</b> à :

<code>${address}</code>

Votre commande pour <b>${product}</b> sera livrée automatiquement une fois le paiement confirmé (généralement en quelques minutes).

Cordialement,
${CHAT_BOT_NAME}`,

  showDepositCryptoInfo: (priceUsd, priceCrypto, tickerView, address) =>
    `💰 <b>Montant du paiement : $${Number(priceUsd).toFixed(2)} USD</b>\n\nEnvoyez exactement <b>${priceCrypto} ${tickerView}</b> à :\n\n<code>${address}</code>\n\nLes paiements crypto sont confirmés rapidement — généralement en quelques minutes. Une fois confirmé, vous serez notifié rapidement et votre portefeuille sera mis à jour.\n\nCordialement,\n${CHAT_BOT_NAME}`,

  confirmationDepositMoney: (amount, usd) =>
    `Votre paiement de ${amount} ($${usd}) a été traité. Merci de nous avoir choisi.\nCordialement,\n${CHAT_BOT_NAME}`,

  showWallet: (usd, ngn) => `Solde du portefeuille :\n\n${bal(usd, ngn)}`,

  wallet: (usd, ngn) => `Solde du portefeuille :\n\n${bal(usd, ngn)}\n\nSélectionnez l'option du portefeuille :`,

  walletSelectCurrency: (usd, ngn) =>
    `Veuillez sélectionner la devise pour payer à partir de votre solde de portefeuille :\n\n${bal(usd, ngn)}`,

  walletBalanceLow: `Votre solde est insuffisant. Appuyez sur "👛 Mon portefeuille" → "➕💵 Déposer" pour recharger.`,

  sentLessMoney: (expected, got) =>
    `Vous avez envoyé moins d'argent que prévu, donc nous avons crédité le montant reçu dans votre portefeuille. Nous attendions ${expected} mais nous avons reçu ${got}`,

  sentMoreMoney: (expected, got) =>
    `Vous avez envoyé plus d'argent que prévu, donc nous avons crédité le montant supplémentaire dans votre portefeuille. Nous attendions ${expected} mais nous avons reçu ${got}`,

  buyLeadsError: `Malheureusement, le code régional sélectionné est indisponible et votre portefeuille n'a pas été facturé`,
  buyLeadsProgress: (i, total) => `${((i * 100) / total).toFixed()}% de leads téléchargés. Veuillez patienter.`,

  phoneNumberLeads: `Obtenez des leads premium vérifiés par cible ou validez vos propres numéros :`,

  buyLeadsSelectCountry: `Veuillez sélectionner un pays`,
  buyLeadsSelectSmsVoice: `Veuillez sélectionner SMS / Voix`,
  buyLeadsSelectArea: `Veuillez sélectionner une zone`,
  buyLeadsSelectAreaCode: `Veuillez sélectionner un code régional`,
  buyLeadsSelectCarrier: `Veuillez sélectionner un opérateur`,
  buyLeadsSelectCnam: `Voulez-vous le <b>nom du propriétaire du téléphone</b> avec chaque lead ? C'est 15 $ de plus par 1 000 leads — et ça vaut le coup.`,
  buyLeadsSelectAmount: (min, max) =>
    `Combien de leads souhaitez-vous acheter ? Sélectionnez ou saisissez un nombre. Le minimum est de ${min} et le maximum est de ${max}`,

  buyLeadsSelectFormat: `Choisissez le format, par exemple Local (212) ou International (+1212)`,

  buyLeadsSuccess: n => `🎉 <b>Terminé !</b> Vos ${n} leads sont prêts.\n\nVous recevez deux fichiers :\n📄 <b>Fichier 1</b> — Tous les numéros de téléphone\n📄 <b>Fichier 2</b> — Numéros avec le <b>nom du propriétaire</b>\n\nAstuce : Utilisez les noms pour personnaliser votre approche. Les gens répondent 2 à 3 fois plus quand on les appelle par leur nom.`,

  buyLeadsNewPrice: (leads, price, newPrice) =>
    `💰 <b>${leads} leads</b> — maintenant seulement <b>$${view(newPrice)}</b> <s>($${price})</s>\nInclut les noms des propriétaires. Ne ratez pas cette offre.`,
  buyLeadsPrice: (leads, price) => `💰 <b>${leads} leads</b> — <b>$${price}</b>\nInclut les noms des propriétaires. Prêt quand vous l'êtes.`,

  confirmNgn: (usd, ngn) => `${usd} USD ≈ ${ngn} NGN `,

  walletSelectCurrencyConfirm: `Confirmer ?`,

  validatorSelectCountry: `Veuillez sélectionner un pays`,
  validatorPhoneNumber: `Veuillez coller vos numéros ou télécharger un fichier incluant le code du pays.`,
  validatorSelectSmsVoice: n =>
    `${n} numéros de téléphone trouvés. Veuillez choisir l'option pour la validation des leads par SMS ou appel vocal.`,
  validatorSelectCarrier: `Veuillez sélectionner un opérateur`,
  validatorSelectCnam: `Voulez-vous le <b>nom du propriétaire du téléphone</b> avec vos leads validés ?\n\nConnaître qui vous contactez permet de personnaliser votre message — les gens répondent à leur propre nom. 15 $ par 1 000 leads. Ça vaut chaque centime.`,
  validatorSelectAmount: (min, max) =>
    `Combien de numéros souhaitez-vous valider ? Sélectionnez ou saisissez un nombre. Le minimum est de ${min} et le maximum est de ${max}`,

  validatorSelectFormat: `Choisissez le format, par exemple Local (212) ou International (+1212)`,

  validatorSuccess: (n, m) => `${n} leads sont validés. ${m} numéros de téléphone valides trouvés.`,
  validatorProgress: (i, total) => `${((i * 100) / total).toFixed()}% de leads validés. Veuillez patienter.`,
  validatorProgressFull: (i, total) => `${((i * 100) / total).toFixed()}% de leads validés.`,

  validatorError: `Malheureusement, les numéros de téléphone sélectionnés sont indisponibles et votre portefeuille n'a pas été facturé`,
  validatorErrorFileData: `Numéro de téléphone de pays invalide trouvé. Veuillez télécharger le numéro de téléphone pour le pays sélectionné`,
  validatorErrorNoPhonesFound: `Aucun numéro de téléphone trouvé. Réessayez.`,

  validatorBulkNumbersStart: `La validation des leads a commencé et sera bientôt terminée.`,

  // url re-director
  redSelectUrl: `Veuillez partager l'URL que vous souhaitez raccourcir et analyser. ex : https://cnn.com`,
  redSelectRandomCustom: `Veuillez sélectionner votre choix pour un lien aléatoire ou personnalisé`,
  redSelectProvider: `Choisissez le fournisseur de lien`,
  redSelectCustomExt: `Entrez le suffixe personnalisé`,

  redValidUrl: `Veuillez fournir une URL valide. ex : https://google.com`,
  redTakeUrl: url => `Votre URL raccourcie est : ${url}`,
  redIssueUrlBitly: `Le raccourcissement a échoué. Votre portefeuille n'a pas été débité. Réessayez ou appuyez sur 💬 Obtenir de l'aide.`,
  redIssueSlugCuttly: `Le nom de lien préféré est déjà pris, essayez un autre.`,
  redIssueUrlCuttly: `Le raccourcissement a échoué. Réessayez ou appuyez sur 💬 Obtenir de l'aide.`,
  freeLinksExhausted: `Vos ${FREE_LINKS} liens d'essai sont épuisés ! Abonnez-vous pour des liens illimités + domaines gratuits + ${DAILY_PLAN_FREE_VALIDATIONS.toLocaleString()}+ validations avec noms des propriétaires.`,
  subscriptionLeadsHint: `💡 Les abonnés obtiennent ${DAILY_PLAN_FREE_VALIDATIONS.toLocaleString()}+ validations gratuites avec noms des propriétaires par plan. À partir de $${PRICE_DAILY}/jour.`,
  linksRemaining: (count, total) => {
    const base = `Il vous reste ${count} sur ${total || FREE_LINKS} lien${count !== 1 ? 's' : ''} Shortit d'essai.`
    if (count <= 2) return `${base}\n\n⚡ <b>Plus que ${count} lien${count !== 1 ? 's' : ''} !</b> Abonnez-vous pour des liens illimités + domaines gratuits + ${DAILY_PLAN_FREE_VALIDATIONS.toLocaleString()}+ validations avec noms des propriétaires. Dès $${PRICE_DAILY}/jour.`
    return base
  },
  redNewPrice: (price, newPrice) =>
    `Le prix est maintenant de $${view(newPrice)} <s>($${price})</s>. Veuillez choisir la méthode de paiement.`,
  customLink: 'Lien personnalisé',
  randomLink: 'Lien aléatoire',
  askShortLinkExtension: 'Veuillez nous indiquer votre extension de lien court préférée : par exemple payer',
  linkAlreadyExist: `Le lien existe déjà. Veuillez taper 'ok' pour essayer un autre.`,
  yourShortendUrl: shortUrl => `Votre URL raccourcie est : ${shortUrl}`,

  availablefreeDomain: (plan, available, s) =>
    `Rappelez-vous, votre plan ${plan} comprend ${available} domaine ".sbs/.xyz" gratuit${s}. Obtenez votre domaine dès aujourd'hui !`,
  shortenedUrlLink: `Veuillez partager l'URL que vous souhaitez raccourcir et analyser. e.g https://cnn.com`,
  selectedTrialPlan: `Vous avez sélectionné le plan d'essai gratuit`,
  userPressedBtn: message => `L'utilisateur a appuyé sur le bouton ${message}.`,
  userToBlock: userToBlock => `L'utilisateur ${userToBlock} n'a pas été trouvé.`,
  userBlocked: userToBlock => `L'utilisateur ${userToBlock} a été bloqué.`,
  checkingDomainAvail: `Vérification de la disponibilité du domaine...`,
  checkingExistingDomainAvail: `Vérification de la disponibilité du domaine existant...`,
  subscribeFirst: `📋 Abonnez-vous d'abord`,
  freeValidationUsed: (amount, remaining) => `${amount} numéros USA validés avec votre abonnement ! Validations gratuites restantes : ${remaining.toLocaleString()}.`,
  partialFreeValidation: (freeAmount, totalAmount, paidAmount, paidPrice) => `Il vous reste ${freeAmount.toLocaleString()} validations gratuites. Votre demande porte sur ${totalAmount.toLocaleString()} numéros.\n\n${freeAmount.toLocaleString()} seront couverts gratuitement, et les ${paidAmount.toLocaleString()} restants coûteront $${paidPrice}. Veuillez procéder au paiement ci-dessous.`,
  notValidHalf: `Entrez une partie arrière valide`,
  linkAlreadyExist: `Le lien existe déjà. Veuillez en essayer un autre.`,
  issueGettingPrice: `Problème pour obtenir le prix`,
  domainInvalid: `Le nom de domaine est invalide. Veuillez en essayer un autre. Utilisez le format abcpay.com`,
  chooseValidPlan: `Veuillez choisir un plan valide`,
  noDomainFound: `Aucun nom de domaine trouvé`,
  chooseValidDomain: `Veuillez choisir un domaine valide`,
  failedAudio: '❌ Échec du traitement audio. Veuillez réessayer.',
  enterBroadcastMessage: 'Entrez le message',
  provide2Nameservers: 'Veuillez fournir au moins 2 serveurs DNS séparés par un espace.',
  noDomainSelected: 'Aucun domaine sélectionné.',
  validInstitutionName: '⚠️ Veuillez entrer un nom d\'institution valide (2-100 caractères).',
  validCityName: '⚠️ Veuillez entrer un nom de ville valide.',
  errorDeletingDns: error =>
    `Erreur lors de la suppression de l'enregistrement DNS, ${error}, Veuillez fournir à nouveau la valeur`,
  selectValidOption: `sélectionnez une option valide`,
  maxDnsRecord: `Un maximum de 4 enregistrements NS peut être ajouté, vous pouvez mettre à jour ou supprimer les enregistrements NS précédents`,
  errorSavingDns: error =>
    `Erreur lors de la sauvegarde de l'enregistrement DNS, ${error}, Veuillez fournir à nouveau la valeur`,
  fileError: `Erreur lors du traitement du fichier.`,
  ammountIncorrect: `Montant incorrect`,
  subscriptionExpire: (subscribedPlan, timeEnd) => `Votre abonnement ${subscribedPlan} est expiré le ${timeEnd}`,
  plansSubscripedtill: (subscribedPlan, timeEnd) =>
    `Vous êtes actuellement abonné au plan ${subscribedPlan}. Votre plan est valide jusqu'au ${timeEnd}`,
  planNotSubscriped: `Vous n'êtes actuellement abonné à aucun plan.`,
  noShortenedUrlLink: `Vous n'avez encore aucun lien raccourci.`,
  shortenedLinkText: linksText => `Voici vos liens raccourcis :\n${linksText}`,
  qrCodeText: `Voici votre code QR !`,
  scanQrOrUseChat: chatId =>
    `Scannez le QR avec l'application de marketing SMS pour vous connecter. Vous pouvez également utiliser ce code pour vous connecter : ${chatId}`,
  domainPurchasedFailed: (domain) =>
    `❌ L'enregistrement du domaine <b>${domain}</b> n'a pas pu être complété. Veuillez réessayer ou contacter le support si le problème persiste.`,
  noDomainRegistered: `Vous n'avez pas encore acheté de domaines.`,
  registeredDomainList: domainsText => `Voici vos domaines achetés :\n${domainsText}`,
  selectDomainAction: domain => `<b>${domain}</b>\n\nQue souhaitez-vous faire avec ce domaine ?`,
  domainActionDns: '🔧 Gestion DNS',
  domainActionShortener: '🔗 Activer pour le raccourcisseur',
  domainActionDeactivateShortener: '🔗 Désactiver le raccourcisseur',
  comingSoon: `Bientôt disponible`,

  // --- Missing translations (added for completeness) ---
  Annually: 'annuellement',
  Daily: 'Quotidien',
  Hourly: 'par heure',
  Monthly: 'Mensuel',
  Quarterly: 'trimestriel',
  Weekly: 'Hebdomadaire',
  addSubdomain: 'Ajouter un sous-domaine',
  antiRedDisabled: domain => `❌ Protection Anti-Red <b>désactivée</b> pour <b>${domain}</b>.\n\nLa page "Vérification de votre navigateur" ne s'affichera plus. Les autres couches de sécurité (masquage IP, blocage UA) restent actives.\n\n⚠️ <b>Avertissement :</b> La désactivation du JS Challenge réduit considérablement votre protection. Nous recommandons fortement de le garder activé.`,
  antiRedEnabled: domain => `✅ Protection Anti-Red <b>activée</b> pour <b>${domain}</b>.\n\nLes visiteurs verront une brève vérification "Vérification de votre navigateur" avant d'accéder à votre site.`,
  antiRedError: '❌ Échec de la mise à jour de la protection Anti-Red. Veuillez réessayer.',
  antiRedNoCF: domain => `⚠️ <b>${domain}</b> n'utilise pas Cloudflare. La protection Anti-Red nécessite les serveurs de noms Cloudflare.\n\nAllez dans Gestion DNS → Passez d'abord aux NS Cloudflare.`,
  antiRedStatusOff: domain => `🛡️ <b>Protection Anti-Red</b> pour <b>${domain}</b>\n\nStatut : <b>❌ DÉSACTIVÉ</b>\n\nVotre domaine n'est PAS protégé. Activez-la pour bloquer les scanners.\n\n⚠️ <b>Recommandation :</b> Activez la protection Anti-Red avec JS Challenge pour une sécurité maximale.`,
  antiRedStatusOn: domain => `🛡️ <b>Protection Anti-Red</b> pour <b>${domain}</b>\n\nStatut : <b>✅ ACTIVÉ</b>\n\nCela protège votre domaine contre les scanners de phishing.\n\n⚠️ <b>Recommandation :</b> Gardez le JS Challenge activé pour une protection maximale.`,
  antiRedTurnOff: '❌ Désactiver la protection',
  antiRedTurnOn: '✅ Activer la protection',
  antiRedTurningOff: domain => `⏳ Désactivation de la protection Anti-Red pour <b>${domain}</b>...`,
  antiRedTurningOn: domain => `⏳ Activation de la protection Anti-Red pour <b>${domain}</b>...`,
  dnsWarningHostedDomain: (domain, plan) => `⚠️ <b>ATTENTION : Ce domaine a un plan d'hébergement actif</b>\n\nDomaine : <b>${domain}</b>\nPlan : ${plan}\n\n<b>⚠️ La modification des enregistrements DNS peut casser votre hébergement et la protection anti-red !</b>\n\nLes modifications DNS ne doivent être effectuées que si vous comprenez parfaitement l'impact. Des modifications incorrectes peuvent rendre votre site inaccessible ou supprimer les protections de sécurité.\n\n<b>Êtes-vous sûr de vouloir continuer ?</b>`,
  dnsProceedAnyway: '⚠️ Continuer quand même',
  dnsCancel: '❌ Annuler',
  domainTypeRegistered: '🏷️ Enregistré chez nous',
  domainTypeExternal: '🌍 Externe',
  buyLeads: '🎯 Acheter des leads téléphoniques',
  cancelRenewNow: '❌ Annuler',
  confirmRenewNow: '✅ Confirmer & Payer',
  domainActionAntiRed: '🛡️ Protection Anti-Red',
  googleEmail: 'Configurer Google Email',
  pointToIp: 'Pointer le domaine vers IP',
  shortenLink: '✂️ Raccourcir un lien',
  toggleAutoRenew: '🔁 Activer/Désactiver le renouvellement automatique',
  validateLeads: '✅ Valider les numéros',
  verification: 'Vérification du domaine (TXT)',
  walletBalanceLowAmount: (needed, balance) => 
    `Votre solde ($${balance.toFixed(2)}) est insuffisant.\n\nIl vous manque <b>$${(needed - balance).toFixed(2)}</b>. Appuyez sur Dépôt pour recharger.`,
  zohoEmail: 'Configurer Zoho Email',
  goBackToCoupon: '❌ Retourner & Appliquer le Coupon',
  errorFetchingCryptoAddress:
    "Erreur lors de la récupération de l'adresse de la cryptomonnaie. Veuillez réessayer plus tard.",
  paymentSuccessFul: '✅ Paiement confirmé — provisionnement de vos services en cours.',

  // Renvoi d'appels (Cloud IVR)
  fwdInsufficientBalance: (walletBal, rate) => `🚫 <b>Solde insuffisant</b>\n\n💳 $${(walletBal || 0).toFixed(2)} · Requis $${rate}/min\n👉 Rechargez <b>$25</b> via 👛 Portefeuille.`,
  fwdBlocked: (number) => `🚫 <b>Bloqué</b> — ${number} est une destination premium.\nAppuyez 💬 <b>Obtenir de l'aide</b>.`,
  fwdNotRoutable: (number) => `⚠️ ${number} non joignable. Vérifiez ou appuyez 💬 <b>Obtenir de l'aide</b>.`,
  fwdValidating: '⏳ Validation en cours...',
  fwdEnterNumber: (rate, walletBal) => {
    let text = `Entrez le numéro avec indicatif pays (ex: +14155551234)\n💰 <b>$${rate}/min</b>`
    if (walletBal !== undefined) {
      text += ` · 💳 $${walletBal.toFixed(2)}`
      if (walletBal < rate) text += `\n⚠️ Rechargez <b>$25</b> via 👛 Portefeuille d'abord.`
    }
    return text
  },
  planNotFound: 'Forfait introuvable.',
  noActivePlans: '📋 <b>Mes Forfaits Hébergement</b>\n\nVous n\'avez aucun forfait actif. Achetez un forfait pour commencer !',
  noRegisteredDomains: 'Vous n\'avez aucun domaine enregistré. Veuillez enregistrer un nouveau domaine ou connecter un domaine externe.',
  selectFromDomains: 'Sélectionnez un domaine parmi vos domaines enregistrés :',
  selectDomainFromList: 'Veuillez sélectionner un domaine dans la liste.',
  enterValidDomain: 'Veuillez entrer un nom de domaine valide (ex : example.com).',
  enterCouponCode: 'Entrez le code coupon :',
  invalidCoupon: 'Coupon invalide. Réessayez ou appuyez sur Passer.',
  couponAlreadyUsed: 'Coupon déjà utilisé. Essayez-en un autre ou appuyez sur Passer.',
  couponUsedToday: '⚠️ Vous avez déjà utilisé ce coupon aujourd\'hui.',
  keyboardRefreshed: 'Clavier actualisé ! Veuillez sélectionner une option :',
  supportEnded: '✅ Session de support terminée. Merci de nous avoir contactés !',
  noSupportSession: 'Aucune session de support active.',
  supportMsgReceived: '✉️ Message reçu ! Un agent de support vous répondra sous peu.',
  supportMsgSent: '✉️ Message envoyé au support. Nous vous répondrons sous peu.',
  someIssue: 'Un problème est survenu',
  dbConnecting: 'La base de données se connecte, veuillez réessayer dans un instant',
  chooseValidDomain: 'Veuillez choisir un domaine valide',
  dnsCustomOnly: 'Les enregistrements DNS sont gérés par votre fournisseur personnalisé. Vous pouvez uniquement mettre à jour les serveurs de noms ou changer de fournisseur.',
  noDeleteRecords: 'Aucun enregistrement supprimable. Les enregistrements NS ne peuvent être que mis à jour.',
  invalidSrvFormat: 'Format invalide. Utilisez <b>_service._protocol</b> (ex : _sip._tcp) :',
  insufficientBalance: (usdBal, price) => `⚠️ Solde insuffisant. Vous avez $${usdBal} mais il faut $${price}.\nDéposez des fonds d'abord.`,
  leadSelectMetro: (target) => `📍 Zone métro pour <b>${target}</b> :\n\nChoisissez "Toutes les Villes" pour une couverture maximale.`,
  leadSelectArea: (target, city) => `📞 Indicatif pour <b>${target}</b> — <b>${city}</b> :\n\n"Indicatifs Mixtes" donne le plus grand pool.`,
  leadRequestCustom: '📝 <b>Leads Personnalisés</b>\n\nIndiquez l\'institution ou entreprise cible.\nNous fournissons des numéros vérifiés avec le nom du propriétaire :',
  leadCustomCity: (target) => `🏙️ Quelle ville ?\n\nCible : <b>${target}</b>\n\nTapez le nom ou "National" :`,
  leadCustomDetails: (target, city) => `📋 Détails supplémentaires ?\n\nCible : <b>${target}</b>\nZone : <b>${city}</b>\n\nTapez ou "Aucun" :`,
  leadAllCities: 'Toutes les Villes',
  leadNationwide: 'National',
  leadNone: 'Aucun',
  leadRequestTarget: '📝 Demande Cible Perso',
  noPendingLeads: '📝 Aucune demande en attente.',
  backupCreated: 'Sauvegarde créée.',
  dataRestored: 'Données restaurées.',
  vpsRefundFailed: (currency, amount, error) => `❌ <b>VPS échoué</b>\n\n✅ Remboursement ${currency}${amount}.\n\nErreur : ${error}`,
  shortenerConflict: (domain, plan) => `❌ Impossible — <b>${domain}</b> a un hébergement actif (<b>${plan}</b>). Utilisez un autre domaine.`,
  shortenerLinked: (domain) => `✅ <b>${domain}</b> lié au raccourcisseur. Propagation DNS ~24h.`,
  shortenerError: (domain, error) => `❌ Erreur raccourcisseur <b>${domain}</b> : ${error}`,
  domainSearching: (domain) => `🔍 Recherche pour ${domain}...`,
  domainNotAvailable: (domain) => `❌ <b>${domain}</b> indisponible.`,
  domainSearchAlts: (baseName) => `🔍 Recherche d'alternatives pour <b>${baseName}</b>...`,
  domainAltsFound: (altList) => `✅ Alternatives :\n\n${altList}\n\nTapez un domaine :`,
  dnsLinkError: (domain, error) => `❌ Impossible de lier <b>${domain}</b> : ${error}`,
  dnsSaveError: (domain, error) => `❌ Erreur DNS <b>${domain}</b> : ${error}`,
  selectProceedOrCancel: 'Sélectionnez "Continuer" ou "Annuler".',

  // ── Marketplace ──
  mpHome: '🏪 <b>MARCHÉ NOMADLY</b>\n\n💰 <b>Vendez vos produits numériques</b> — publiez en 60 secondes, soyez payé instantanément\n🛍️ <b>Trouvez des offres exclusives</b> — vendeurs vérifiés, transactions réelles\n\n🔒 Chaque achat est <b>protégé par escrow</b> via @Lockbaybot\nVotre argent reste en sécurité jusqu\'à confirmation de livraison.\n\n👇 Prêt à gagner ou acheter ?',
  mpBrowse: '🔥 Parcourir les offres',
  mpListProduct: '💰 Commencer à vendre',
  mpMyConversations: '💬 Mes conversations',
  mpMyListings: '📦 Mes annonces',
  mpAiHelper: '🤖 Aide IA',
  mpAiHelperPrompt: '🤖 <b>Assistant IA du Marché</b>\n\nPosez-moi toute question sur l\'achat, la vente, l\'escrow ou la sécurité.\n\nÉcrivez votre question ci-dessous ou appuyez sur ↩️ Retour.',
  mpAiThinking: '🤖 Réflexion en cours...',
  mpAiScamWarning: '🚨 <b>Alerte Sécurité IA</b>\n\n⚠️ Ce message peut contenir une demande de paiement suspecte. Rappel :\n\n🔒 <b>TOUJOURS utiliser l\'escrow @Lockbaybot</b>\n❌ NE JAMAIS envoyer d\'argent via PayPal, CashApp, crypto ou virement\n📢 Tapez /report si vous vous sentez en danger\n\nVotre protection est notre priorité.',
  mpUploadImages: '📸 Téléchargez les images du produit (1 à 5 photos).\nEnvoyez les photos une par une. Appuyez sur ✅ Téléchargement terminé quand c\'est fait.',
  mpDoneUpload: '✅ Téléchargement terminé',
  mpEnterTitle: '📝 Entrez le titre du produit (max 100 caractères) :',
  mpEnterDesc: '📄 Entrez la description (max 500 caractères) :',
  mpEnterPrice: '💰 Fixez le prix en USD (20 $ - 5 000 $) :',
  mpSelectCategory: '🏷️ Sélectionnez une catégorie :',
  mpPreview: (title, desc, price, category, imageCount) =>
    `✅ <b>Aperçu du produit</b>\n\n📦 <b>${title}</b>\n📄 ${desc}\n💰 <b>$${Number(price).toFixed(2)}</b>\n📂 ${category}\n📸 ${imageCount} image(s)\n\n🔒 Protégé par escrow via @Lockbaybot`,
  mpPublish: '✅ Publier',
  mpCancel: '❌ Annuler',
  mpEditProduct: '✏️ Modifier',
  mpRemoveProduct: '❌ Supprimer l\'annonce',
  mpMarkSold: '✅ Marquer comme vendu',
  mpProductPublished: '🎉 Votre annonce est EN LIGNE !\n\nLes acheteurs peuvent maintenant la découvrir.\n\n💡 <b>Conseils pour vendre plus vite :</b>\n• Répondez rapidement aux demandes\n• Ajoutez des photos claires et descriptions détaillées\n• Fixez un prix compétitif\n\n💰 Vous êtes payé instantanément quand l\'acheteur confirme la livraison.',
  mpProductRemoved: '✅ Annonce supprimée.',
  mpProductSold: '✅ Annonce marquée comme vendue.',
  mpMaxListings: '❌ Vous avez atteint le maximum de 10 annonces actives. Supprimez-en ou marquez-en comme vendues.',
  mpPriceError: '❌ Le prix doit être entre 20 $ et 5 000 $ USD.',
  mpNoImage: '📸 Veuillez télécharger au moins une image.',
  mpImageAsPhoto: '📸 Envoyez l\'image comme photo, pas comme fichier.',
  mpOwnProduct: '❌ Vous ne pouvez pas contacter votre propre annonce.',
  mpNoProducts: '📭 Aucun produit trouvé. Revenez plus tard !',
  mpNoListings: '📭 Vous n\'avez pas encore d\'annonces.',
  mpNoConversations: '📭 Aucune conversation active.',
  mpChatStartBuyer: (title, price) =>
    `💬 Vous discutez avec le vendeur de <b>${title}</b> ($${price})\n🔒 Protégé par escrow via @Lockbaybot\n\n💡 Conseil : Demandez des détails ou des preuves avant d'acheter.\nTapez /escrow quand vous êtes prêt à payer en toute sécurité.\nEnvoyez /done pour quitter.`,
  mpChatStartSeller: (title) =>
    `💬 🔔 Un acheteur s'intéresse à <b>${title}</b> !\n🔒 Protégé par escrow via @Lockbaybot\n\n💡 Conseil : Répondez vite — les vendeurs rapides concluent plus de ventes.\nRépondez ci-dessous. Envoyez /done pour quitter.`,
  mpMessageSent: '✅ Message envoyé',
  mpSellerChatReady: (title) =>
    `💬 Vous êtes en chat pour <b>${title}</b>.\nÉcrivez votre réponse. Envoyez /done pour quitter, /escrow pour démarrer l'escrow, /price XX pour proposer un prix.`,
  mpBuyerSays: (msg) => `💬 <b>Acheteur :</b> ${msg}`,
  mpSellerSays: (msg) => `💬 <b>Vendeur :</b> ${msg}`,
  mpChatEnded: '💬 Conversation terminée. Les deux parties ont été notifiées.',
  mpChatEndedNotify: (title) => `💬 La conversation sur <b>${title}</b> a été fermée.`,
  mpChatInactive: (title) => `💬 La conversation sur <b>${title}</b> a été fermée pour inactivité.`,
  mpSellerOffline: '⏳ Le vendeur n\'a pas répondu depuis 24 heures.',
  mpRateLimit: '⚠️ Limite de messages atteinte. Veuillez patienter.',
  mpOnlyTextPhoto: '⚠️ Seuls le texte et les photos sont autorisés.',
  mpPaymentWarning: '🚨 Attention : quelqu\'un semble demander un paiement direct.\nUtilisez toujours l\'escrow @Lockbaybot.',
  mpEscrowMsg: (title, price, sellerRef) =>
    `🔒 <b>ESCROW — ACHAT PROTÉGÉ</b>\n\n📦 Produit : <b>${title}</b>\n💰 Prix convenu : <b>$${Number(price).toFixed(2)}</b>\n👤 Vendeur : ${sellerRef}\n\nPour acheter en toute sécurité :\n1. Ouvrez @Lockbaybot\n2. Créez un escrow avec les détails du produit\n3. Les deux parties confirment\n\n⚠️ N\'envoyez JAMAIS de paiement en dehors de l\'escrow`,
  mpPriceSuggest: (role, amount) => `💰 <b>${role}</b> propose : <b>$${amount}</b>`,
  mpPriceUsage: 'Usage : /price 50 pour proposer 50 $',
  mpPriceInvalid: '❌ Montant invalide. Doit être entre 20 $ et 5 000 $.',
  mpReported: '✅ Signalement envoyé. L\'admin examinera cette conversation.',
  mpChatMode: '⚠️ Vous êtes dans un chat marketplace. Envoyez /done pour quitter.',
  mpExistingConv: '💬 Vous avez déjà une conversation active. Reprise...',
  mpAllCategories: '📋 Toutes les catégories',
  mpEditWhat: '✏️ Que souhaitez-vous modifier ?',
  mpEditTitle: '📝 Modifier le titre',
  mpEditDesc: '📄 Modifier la description',
  mpEditPrice: '💰 Modifier le prix',
  mpTitleUpdated: '✅ Titre mis à jour.',
  mpDescUpdated: '✅ Description mise à jour.',
  mpPriceUpdated: '✅ Prix mis à jour.',
  mpListingRemoved: '📦 [Annonce supprimée]',
  mpSellerStats: (sales, since) => `⭐ Vendeur : ${sales} vente${sales !== 1 ? 's' : ''} | Inscrit ${since}`,
  mpProductCard: (title, price, category, sellerStats) =>
    `🏷️ <b>${title}</b>\n💰 <b>$${Number(price).toFixed(2)}</b>  ·  ${category}\n${sellerStats}\n🔒 Achat en confiance — Escrow Protégé`,
  mpProductDetail: (title, desc, price, category, sellerStats, listedAgo) =>
    `📦 <b>${title}</b>\n\n📄 ${desc}\n\n💰 Prix : <b>$${Number(price).toFixed(2)}</b>\n📂 ${category}\n${sellerStats}\n📅 Publié : ${listedAgo}\n\n🔒 <b>PROTECTION ACHETEUR 100%</b>\nPayez en toute sécurité via @Lockbaybot — votre argent est conservé jusqu'à confirmation de livraison.`,
  mpMyListingsHeader: (count, max) => `📦 <b>MES ANNONCES</b> (${count}/${max})`,
  mpConvHeader: '💬 <b>MES CONVERSATIONS</b>',
  mpConvItem: (title, role, lastMsg) => `💬 <b>${title}</b> (${role}) — ${lastMsg}`,
  mpDoneCmd: '/done',
  mpEscrowCmd: '/escrow',
  mpPriceCmd: '/price',
  mpReportCmd: '/report',
  mpEnteredChat: (title, price) => `💬 Vous êtes dans le chat pour <b>${title}</b> (${price} $)\nEnvoyez /done pour quitter, /escrow pour démarrer l'escrow, /price XX pour proposer un prix.`,
  mpResumedChat: (title, price, role) => `💬 Chat repris : <b>${title}</b> (${price} $) — Vous êtes ${role}\n🔒 Protégé par escrow via @Lockbaybot\n\nEnvoyez /done pour quitter, /escrow pour démarrer l'escrow, /price XX pour proposer un prix.`,
  mpBuyerPhotoCaption: '💬 L\'acheteur a envoyé une photo :',
  mpSellerPhotoCaption: '💬 Le vendeur a envoyé une photo :',
  mpChatClosedReset: (title) => `💬 La conversation sur <b>${title}</b> a été fermée par l'autre partie. Vous avez été redirigé vers le marché.`,
  mpSellerBusy: (title) => `🆕 Nouvelle demande pour <b>${title}</b> ! Appuyez sur le bouton ci-dessous pour répondre quand vous êtes prêt.`,
  mpCatDigitalGoods: '💻 Produits Numériques',
  mpCatBnkLogs: '🏦 Logs Bancaires',
  mpCatBnkOpening: '🏧 Ouverture Bancaire',
  mpCatTools: '🔧 Outils',
}

const phoneNumberLeads = ['🎯 Leads Premium Ciblés', '✅📲 Valider les leads téléphoniques']

const buyLeadsSelectCountry = Object.keys(areasOfCountry)
const buyLeadsSelectSmsVoice = ['SMS (Prix 20$ pour 1000)', 'Voix (Prix 0$ pour 1000)']
const buyLeadsSelectArea = country => Object.keys(areasOfCountry?.[country])
const buyLeadsSelectAreaCode = (country, area) => {
  const codes = areasOfCountry?.[country]?.[area].map(c => format(countryCodeOf[country], c))
  return codes.length > 1 ? ['Mixed Area Codes'].concat(codes) : codes
}
const _buyLeadsSelectAreaCode = (country, area) => areasOfCountry?.[country]?.[area]
const buyLeadsSelectCnam = yesNo
const buyLeadsSelectCarrier = country => carriersOf[country]
const buyLeadsSelectAmount = ['1000', '2000', '3000', '4000', '5000']
const buyLeadsSelectFormat = ['Format Local', 'Format International']

const validatorSelectCountry = Object.keys(areasOfCountry)
const validatorSelectSmsVoice = ['SMS (Prix 20$ pour 1000)', 'Voix (Prix 0$ pour 1000)']
const validatorSelectCarrier = country => carriersOf[country]
const validatorSelectCnam = yesNo
const validatorSelectAmount = ['ALL', '1000', '2000', '3000', '4000', '5000']
const validatorSelectFormat = ['Format Local', 'Format International']

const selectFormatOf = {
  'Format Local': 'Local Format',
  'Format International': 'International Format',
}

//redSelectRandomCustom

const redSelectRandomCustom = ['Lien court aléatoire']

const redSelectProvider = ['Bit.ly 10 $', `Shortit (Essai ${FREE_LINKS})`]

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
const _bc = ['Retour', 'Annuler']

const payIn = {
  crypto: 'Crypto',
  ...(HIDE_BANK_PAYMENT !== 'true' && { bank: 'Banque ₦aira + Carte🏦💳' }),
  wallet: '👛 Portefeuille',
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
  en: '🇬🇧 Anglais',
  fr: '🇫🇷 Français',
  zh: '🇨🇳 Chinois',
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
  continueAtHostbay: '🚀 Tous les services sont maintenant disponibles ici sur Nomadly Bot — domaines, leads, Cloud IVR, produits digitaux et plus.',
  redirectMessage: '🚀 Tous les services sont maintenant disponibles ici sur Nomadly Bot — domaines, leads, Cloud IVR, produits digitaux et plus.',

  serviceAd: `━━━━━━━━━━━━━━━━━━━━━━
⚡ <b>Nomadly</b> — Votre Boîte à Outils Numérique
━━━━━━━━━━━━━━━━━━━━━━

📞 <b>Cloud IVR + SIP</b>
Numéros virtuels dans 30+ pays
Standard auto · SMS · Messagerie vocale · SIP
Campagnes IVR rapide et en masse

🌐 <b>Domaines Blindés</b>
1 000+ TLDs · Enregistrement offshore DMCA-ignoré
Gestion DNS · Protection Anti-Red

🛡️ <b>Hébergement Anti-Red</b>
HostPanel offshore · Hebdomadaire et mensuel
Bouclier JS Challenge · SSL inclus

🛒 <b>Produits Numériques</b>
Twilio · Telnyx · AWS · Google Cloud
Google Workspace · Zoho Mail · eSIM

💳 <b>Cartes Virtuelles</b>
Cartes virtuelles instantanées · Utilisation mondiale

🎯 <b>Leads Téléphoniques Vérifiés</b>
Filtrer par pays, opérateur et indicatif
Leads premium avec noms des propriétaires

🔗 <b>Raccourcisseur d'URL</b>
Liens de marque · Domaines personnalisés · Analyses

━━━━━━━━━━━━━━━━━━━━━━
💰 Payez avec <b>Crypto · Virement · Portefeuille</b>
━━━━━━━━━━━━━━━━━━━━━━

🤖 <b>Commencer →</b> @Nomadlybot
💬 <b>Besoin d'aide ?</b> Appuyez sur Obtenir de l'aide
📢 <b>Mises à jour →</b> ${TG_CHANNEL}`,

  askPreferredLanguage: `🌍 Pour garantir que tout est dans votre langue préférée, veuillez en sélectionner une ci-dessous :
  
  Vous pouvez toujours changer votre langue plus tard dans les paramètres.`,
  askValidLanguage: 'Veuillez choisir une langue valide :',
  settingsMenuText: '⚙️ <b>Paramètres</b>\n\nGérez vos préférences ci-dessous :',
  welcomeMessage: `👋 Bienvenue sur le ${CHAT_BOT_NAME} !
  Nous sommes ravis de vous avoir ici ! 🎉
  Commençons afin que vous puissiez explorer toutes les fonctionnalités passionnantes que nous proposons. 🌟
  
  Ce setup est rapide et facile—plongeons dedans ! 🚀`,
  askUserEmail: 'Quel est votre email ? Personnalisons votre expérience ! (par exemple, davidsen@gmail.com)',
  processUserEmail: ` Merci 😊 Nous configurons votre compte maintenant.
  Veuillez patienter un instant pendant que nous finalisons les détails. ⏳
   
  Nous faisons le travail en arrière-plan. Suivez simplement les étapes !`,
  confirmUserEmail: `✨ Excellente nouvelle ! Votre compte est prêt ! 🎉💃🎉
  
  Profitez des fonctionnalités premium pendant votre période d'essai gratuite !`,
  termsAndCond: `📜 Avant de continuer, veuillez examiner et accepter nos conditions générales.`,
  acceptTermButton: '✅ Accepter',
  declineTermButton: '❌ Refuser',
  viewTermsAgainButton: '🔄 Revoir les termes',
  exitSetupButton: '❌ Quitter le setup',
  acceptedTermsMsg: `✅ Vous avez accepté avec succès les conditions générales ! 🎉
  Vous êtes prêt à commencer à utiliser ${CHAT_BOT_NAME}. Passons à la partie amusante ! 🎯`,
  declinedTermsMsg: `⚠️ Vous devez accepter les conditions générales pour continuer à utiliser ${CHAT_BOT_NAME}. 
  Veuillez les revoir quand vous serez prêt.`,
  userExitMsg: 'L’utilisateur a appuyé sur le bouton de sortie.',

  acceptTermMsg: `Veuillez accepter les conditions générales pour continuer à utiliser ${CHAT_BOT_NAME}`,
  termsAndCondMsg: `<h1>Conditions Générales pour ${CHAT_BOT_NAME}</h1>
        <p><strong>Date d’effet :</strong> 01/01/2022</p>
        <p>En utilisant ${CHAT_BOT_NAME}, vous acceptez ces Conditions Générales.</p>

        <h2>1. Acceptation des Conditions</h2>
        <p>Vous devez avoir 18 ans ou plus, ou avoir le consentement d’un tuteur, et accepter ces conditions ainsi que notre Politique de Confidentialité.</p>

        <h2>2. Services Fournis</h2>
        <p>Nous proposons l’enregistrement de domaines, l’hébergement web et le support pour la configuration de sites/applications.</p>

        <h2>3. Responsabilités de l’Utilisateur</h2>
        <p>Fournir des informations exactes, éviter les activités illégales et sécuriser votre compte Telegram.</p>

        <h2>4. Conditions de Paiement</h2>
        <p>Tous les paiements sont définitifs sauf indication contraire. Le non-paiement peut entraîner la suspension des services.</p>

        <h2>5. Limitations des Services</h2>
        <p>Nous pouvons imposer des limites de ressources ou subir des interruptions dues à la maintenance ou à des problèmes techniques.</p>

        <h2>6. Résiliation</h2>
        <p>Nous pouvons résilier les services en cas de violation ou de non-paiement. Les utilisateurs peuvent annuler à tout moment, mais les frais ne sont pas remboursables.</p>

        <h2>7. Responsabilité</h2>
        <p>Les services sont fournis « en l’état ». Nous ne sommes pas responsables des pertes de données, des pannes ou des violations de sécurité des utilisateurs.</p>

        <h2>8. Confidentialité</h2>
        <p>Nous gérons vos données conformément à notre Politique de Confidentialité et ne les partageons que si la loi l’exige.</p>

        <h2>9. Modifications des Conditions</h2>
        <p>Nous pouvons mettre à jour ces conditions, et l’utilisation continue implique votre acceptation.</p>

        <h2>10. Contact</h2>
        <p>Pour toute assistance, contactez-nous à <a href="${APP_SUPPORT_LINK}" target="_blank">${APP_SUPPORT_LINK}</a>.</p>

        <p>En utilisant ${CHAT_BOT_NAME}, vous acceptez ces conditions. Merci !</p>
`,
}

const termsAndConditionType = lang => ({
  reply_markup: {
    inline_keyboard: [
      [
        {
          text: 'Voir les termes et conditions',
          web_app: {
            url: `${SELF_URL}/terms-condition?lang=${lang}`,
          },
        },
      ],
    ],
  },
})

const planOptions = ['Quotidien', 'Hebdomadaire', 'Mensuel']
const planOptionsOf = {
  Quotidien: 'Daily',
  Hebdomadaire: 'Weekly',
  Mensuel: 'Monthly',
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
          text: 'Effectuer le paiement',
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
      buyText: 'Comment souhaitez-vous connecter un domaine ?\n\n🌐 Enregistrer un nouveau domaine\n📂 Utiliser mon domaine\n🔗 Connecter un domaine externe',
      registerNewDomainText: 'Veuillez entrer le nom de domaine que vous souhaitez enregistrer (ex. : exemple.com).',
      domainNotFound: 'Le domaine que vous avez entré est introuvable. Veuillez vérifier ou essayer un autre.',
      useExistingDomainText: 'Veuillez entrer le nom de votre domaine existant (ex. : exemple.com).',
      connectExternalDomainText: 'Veuillez entrer votre domaine externe (ex. : exemple.com)\n\nAprès la configuration, vous devrez pointer les serveurs de noms vers Cloudflare.',
      useExistingDomainNotFound:
        'Le domaine que vous avez entré n’est pas associé à votre compte. Veuillez vérifier ou contacter le support.',
      enterYourEmail: 'Veuillez fournir votre adresse email pour créer votre compte et recevoir votre reçu.',
      invalidEmail: 'Veuillez fournir une adresse email valide.',
      paymentConfirmation: 'Veuillez confirmer la transaction pour continuer votre achat.',
      paymentSuccess: `Nous vérifions votre paiement. Vous serez informé dès que celui-ci sera confirmé. Merci de nous avoir choisi !`,
      paymentFailed: 'Le paiement a échoué. Veuillez réessayer.',
    }

    return `${commonSteps[step]}`
  },

  generateDomainFoundText: (websiteName, price) =>
    `Le domaine ${websiteName} est disponible ! Le coût est de $${price}.`,
  generateExistingDomainText: websiteName => `Vous avez sélectionné ${websiteName} comme votre domaine.`,
  connectExternalDomainText: websiteName => `Vous souhaitez connecter <b>${websiteName}</b> comme votre domaine.\n\nAprès l'achat, vous devrez pointer les serveurs de noms de votre domaine vers Cloudflare.`,
  domainNotFound: websiteName => `Le domaine ${websiteName} n'est pas disponible.`,
  nameserverSelectionText: websiteName =>
    `Veuillez sélectionner le fournisseur de serveur de noms que vous souhaitez utiliser pour ${websiteName}.`,
  confirmEmailBeforeProceeding: email => `Êtes-vous sûr de vouloir continuer avec cet email : ${email} ?`,

  generateInvoiceText: payload => `
<b>Enregistrement de domaine</b>
<b>- Domaine : </b> ${payload.domainName}
<b>- Prix : </b> $${payload?.existingDomain ? '0 (utilisation d’un domaine existant)' : payload.domainPrice}
  
<b>Hébergement Web</b>
<b>- Durée : </b> 1 mois
<b>- Prix : </b> $${payload.hostingPrice}
  
<b>Montant total dû :</b>
<b>- Réduction par coupon : </b> $${payload.couponDiscount}
<b>- USD : </b> $${payload?.couponApplied ? payload.newPrice : payload.totalPrice}
<b>- Taxe : </b> $0.00
  
<b>Conditions de paiement</b>
Ceci est une facture de prépaiement. Veuillez vous assurer que le paiement est effectué dans l'heure afin d'activer vos services de domaine et d'hébergement. Une fois le paiement reçu, nous procéderons à l'activation de votre service.
`,

  showCryptoPaymentInfo: (priceUsd, priceCrypto, tickerView, address, plan) => `💰 <b>Total : ${Number(priceUsd).toFixed(2)} $ USD</b>

Envoyez exactement <b>${priceCrypto} ${tickerView}</b> à :

<code>${address}</code>

Votre ${plan} sera activé automatiquement une fois le paiement confirmé (généralement en quelques minutes).`,

  successText: (info, response) =>
    `Votre hébergement est en ligne.

<b>Domaine :</b> ${info.website_name}
${info.email ? `<b>Email :</b> ${info.email}\n` : ''}DNS auto-configuré via Cloudflare.`,

  support: (
    plan,
    statusCode,
  ) => `Quelque chose s'est mal passé lors de la configuration de votre ${plan} | ${statusCode}. 
                                              Veuillez appuyer sur 💬 Obtenir de l'aide.
                                              Découvrez plus sur ${TG_HANDLE}.`,

  bankPayDomain: (
    priceNGN,
    plan,
  ) => `Veuillez virer ${priceNGN} NGN en cliquant sur “Faire le paiement” ci-dessous. Une fois la transaction confirmée, vous serez immédiatement notifié, et votre ${plan} sera activé sans problème.

Cordialement,
${CHAT_BOT_NAME}`,
}

const vpsBC = ['🔙 Retour', 'Annuler']

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
  hourly: "À l'heure",
  monthly: 'Mensuel',
  quaterly: 'Trimestriel',
  annually: 'Annuel',
}

const vpsPlanOf = {
  "À l'heure": 'hourly',
  Mensuel: 'monthly',
  Trimestriel: 'quaterly',
  Annuel: 'annually',
}

const vpsPlanMenu = ["À l'heure", 'Mensuel', 'Trimestriel', 'Annuel']
const vpsConfigurationMenu = ['De base', 'Standard', 'Premium', 'Entreprise']
const vpsCpanelOptional = ['WHM', 'Plesk', '❌ Passer le panneau de contrôle']

const vp = {
  of: vpsOptionsOf,
  back: '🔙 Retour',
  skip: '❌ Passer',
  cancel: '❌ Annuler',

  askCountryForUser: `🌍 Choisissez la meilleure région pour des performances optimales et une faible latence.

💡 Moins de latence = Temps de réponse plus rapides. Choisissez une région proche de vos utilisateurs pour de meilleures performances.`,
  chooseValidCountry: 'Veuillez choisir un pays dans la liste :',
  askRegionForUser: country =>
    `📍 Sélectionnez un centre de données dans ${country} (Les prix peuvent varier selon l’emplacement.)`,
  chooseValidRegion: 'Veuillez choisir une région valide dans la liste :',
  askZoneForUser: region => `📍 Choisissez la zone dans ${region}.`,

  chooseValidZone: 'Veuillez choisir une zone valide dans la liste :',
  confirmZone: (region, zone) => `✅  Vous avez sélectionné ${region} (${zone}). Voulez-vous continuer avec ce choix ?`,
  failedFetchingData: 'Erreur lors de la récupération, veuillez réessayer dans quelques instants.',
  confirmBtn: `✅ Confirmer la sélection`,

  askVpsDiskType: list => `💾 Choisissez votre type de stockage en fonction des performances et du budget :

${list?.map(item => `• ${item.description}`).join('\n')}`,

  chooseValidDiskType: 'Veuillez choisir un type de disque valide',

  askPlanType: plans => `💳 Choisissez un cycle de facturation :

${plans
  .map(
    item =>
      `<strong>• ${item.type === 'Hourly' ? '⏳' : '📅'} ${item.type} –</strong> $${item.originalPrice} ${
        item.discount === 0 ? '(Aucune réduction)' : `(Inclut ${item.discount}% de réduction)`
      }`,
  )
  .join('\n')}`,
  planTypeMenu: vpsOptionsOf(vpsPlanMenu),
  hourlyBillingMessage: `⚠️ Un dépôt remboursable de $${VPS_HOURLY_PLAN_MINIMUM_AMOUNT_PAYABLE} USD est requis pour la facturation horaire. Cela garantit un service ininterrompu et est remboursé s'il n'est pas utilisé.
  
✅ La facturation est déduite du solde de votre portefeuille chaque heure.
🔹 Les licences mensuelles (Windows/WHM/Plesk) sont facturées à l'avance.`,

  askVpsConfig:
    list => `⚙️ Choisissez un plan VPS en fonction de vos besoins (Facturation à l'heure ou au mois disponible) :
  
${list
  .map(
    config =>
      `<strong>• ${config.name} -</strong>  ${config.specs.vCPU} vCPU, ${config.specs.RAM}GB RAM, ${config.specs.disk}GB Disque`,
  )
  .join('\n')}`,

  validVpsConfig: 'Veuillez sélectionner une configuration VPS valide :',

  configMenu: vpsOptionsOf(vpsConfigurationMenu),

  askForCoupon:
    '🎟️ Vous avez un code promo ? Entrez-le pour une réduction supplémentaire si applicable, ou passez cette étape. Les réductions du cycle de facturation sont déjà incluses.',
  couponInvalid: `❌ Invalide : Code expiré, non applicable ou incorrect. Veuillez réessayer.`,
  couponValid: amt => `✅ Valide : réduction appliquée : -$${amt}.`,
  skipCouponwarning: `⚠️ Passer cette étape signifie que vous ne pourrez pas appliquer de réduction plus tard.`,
  confirmSkip: "✅ Confirmer l'ignorance",
  goBackToCoupon: '❌ Retourner et appliquer le coupon',

  askVpsOS: price => `💡 Système d'exploitation par défaut : Ubuntu (Linux) (si aucune sélection n'est effectuée).
💻 Sélectionnez un système d'exploitation (Windows Server ajoute ${price} $/mois).

<strong>💡 Recommandé : </strong>
<strong>• Ubuntu –</strong> Idéal pour un usage général et le développement
<strong>• CentOS –</strong> Stable pour les applications d'entreprise
<strong>• Windows Server –</strong> Pour les applications basées sur Windows (+${price} $/mois)`,
  chooseValidOS: `Veuillez sélectionner un OS valide dans la liste disponible :`,
  skipOSBtn: "❌ Passer la sélection de l'OS",
  skipOSwarning:
    '⚠️ Votre VPS sera lancé sans OS. Vous devrez en installer un manuellement via SSH ou en mode de récupération.',

  askVpsCpanel: `🛠️ Sélectionnez un panneau de contrôle pour une gestion plus facile du serveur (optionnel).

<strong>• ⚙️ WHM –</strong> Recommandé pour l'hébergement de plusieurs sites web
<strong>• ⚙️ Plesk –</strong> Idéal pour gérer des sites et applications individuels
<strong>• ❌ Ignorer –</strong> Aucun panneau de contrôle`,

  cpanelMenu: vpsOptionsOf(vpsCpanelOptional),
  noControlPanel: vpsCpanelOptional[2],
  skipPanelMessage: '⚠️ Aucun panneau de contrôle ne sera installé. Vous pourrez en ajouter un manuellement plus tard.',
  validCpanel: 'Veuillez choisir un panneau de contrôle valide ou l’ignorer.',

  askCpanelOtions: (name, list) => `⚙️ Choisissez une ${
    name == 'whm' ? 'WHM' : 'Plesk Web Host Edition'
  } licence ou sélectionnez un essai gratuit (valable ${name == 'whm' ? '15' : '7'} jours).

💰 Tarification de la licence ${name == 'whm' ? 'WHM' : 'Plesk'} :

${list.map(item => `${name == 'whm' ? `<strong>• ${item.name} - </strong>` : ''}${item.label}`).join('\n')}`,

  trialCpanelMessage: panel =>
    `✅ ${panel.name == 'whm' ? 'WHM' : 'Plesk'} Essai gratuit (${
      panel.duration
    } jours) activé. Vous pouvez passer à une version payante à tout moment en contactant le support.`,

  vpsWaitingTime: "⚙️ Récupération des détails... Cela ne prendra qu'un instant.",
  failedCostRetrieval: 'Échec de la récupération des informations de coût... Veuillez réessayer après un moment.',

  errorPurchasingVPS: plan => `Une erreur est survenue lors de la configuration de votre plan VPS ${plan}.

Veuillez appuyer sur 💬 Obtenir de l'aide.
Découvrez-en plus sur ${TG_HANDLE}.`,

  generateBillSummary: vpsDetails => `<strong>📋 Détail final des coûts :</strong>

<strong>•📅 Type de disque –</strong> ${vpsDetails.diskType}
<strong>•🖥️ Plan VPS :</strong> ${vpsDetails.config.name}
<strong>•📅 Cycle de facturation (${vpsDetails.plan} Plan) –</strong> $${vpsDetails.plantotalPrice} USD
<strong>•💻 Licence OS (${vpsDetails.os ? vpsDetails.os.name : 'Non sélectionné'}) –</strong> $${
    vpsDetails.selectedOSPrice
  } USD
<strong>•🛠️ Panneau de contrôle (${
    vpsDetails.panel
      ? `${vpsDetails.panel.name == 'whm' ? 'WHM' : 'Plesk'} ${vpsDetails.panel.licenseName}`
      : 'Non sélectionné'
  }) –</strong> $${vpsDetails.selectedCpanelPrice} USD
<strong>•🎟️ Remise coupon –</strong> -$${vpsDetails.couponDiscount} USD
<strong>•🔄 Renouvellement automatique –</strong>  ${
    vpsDetails.plan === 'Hourly' ? '⏳ Horaire' : vpsDetails.autoRenewalPlan ? '✅ Activé' : '❌ Désactivé'
  }

${
  vpsDetails.plan === 'Hourly'
    ? `Remarque : Un dépôt de $${VPS_HOURLY_PLAN_MINIMUM_AMOUNT_PAYABLE} USD est inclus dans votre total. Après la première déduction horaire, le reste du dépôt sera crédité sur votre portefeuille.`
    : ''
}

<strong>💰 Total :</strong> $${
    vpsDetails.plan === 'Hourly' && vpsDetails.totalPrice < VPS_HOURLY_PLAN_MINIMUM_AMOUNT_PAYABLE
      ? VPS_HOURLY_PLAN_MINIMUM_AMOUNT_PAYABLE
      : vpsDetails.totalPrice
  } USD

<strong>✅ Procéder à la commande ?</strong>`,

  no: '❌ Annuler la commande',
  yes: '✅ Confirmer la commande',

  askPaymentMethod: 'Choisissez une méthode de paiement :',

  showDepositCryptoInfoVps: (priceUsd, priceCrypto, tickerView, address, vpsDetails) =>
    `💰 <b>Montant du paiement : ${Number(priceUsd).toFixed(2)} $ USD</b>

Envoyez exactement <b>${priceCrypto} ${tickerView}</b> à :

<code>${address}</code>

Votre plan ${vpsDetails?.plan || 'VPS'} sera activé automatiquement une fois le paiement confirmé (généralement en quelques minutes).

Cordialement,
${CHAT_BOT_NAME}`,

  extraMoney: 'Le montant restant pour votre plan horaire a été déposé dans votre portefeuille.',
  paymentRecieved: `✅ Paiement réussi ! Votre VPS est en cours de configuration. Les détails seront bientôt disponibles et envoyés à votre adresse email pour votre commodité.`,
  paymentFailed: `❌ Échec du paiement. Veuillez vérifier votre méthode de paiement ou réessayer.`,

  lowWalletBalance: vpsName => `
Votre plan VPS pour l'instance ${vpsName} a été arrêté en raison d'un solde insuffisant.

Veuillez recharger votre portefeuille pour continuer à utiliser votre plan VPS.`,

  vpsBoughtSuccess: (vpsDetails, response) =>
    `<strong>🎉 VPS [${response.label}] est actif !</strong>

<strong>🔑 Informations de connexion:</strong>
  <strong>• IP:</strong> ${response.host}
  <strong>• OS:</strong> ${vpsDetails.os ? vpsDetails.os.name : 'Non sélectionné'}
  <strong>• Nom d'utilisateur:</strong> ${credentials.username}
  <strong>• Mot de passe:</strong> ${credentials.password} (changez immédiatement).
    
📧 Ces détails ont également été envoyés à votre email enregistré. Veuillez les garder en sécurité.

⚙️ Installation du panneau de contrôle (WHM/Plesk)
Si vous avez commandé WHM ou Plesk, l'installation est en cours. Vos identifiants de connexion au panneau de contrôle vous seront envoyés séparément une fois l'installation terminée.

Merci d'avoir choisi notre service
${CHAT_BOT_NAME}
`,
  vpsHourlyPlanRenewed: (vpsName, price) => `
Votre plan VPS pour l'instance ${vpsName} a été renouvelé avec succès.
${price}$ ont été débités de votre portefeuille.`,

  bankPayVPS: (
    priceNGN,
    plan,
  ) => `Veuillez envoyer ${priceNGN} NGN en cliquant sur "Effectuer le paiement" ci-dessous. Une fois la transaction confirmée, vous serez rapidement notifié et votre ${plan} plan VPS sera activé.

Cordialement,
${CHAT_BOT_NAME}`,

  askAutoRenewal: `🔄 Activer le renouvellement automatique pour un service ininterrompu ?  

🛑 Vous recevrez un rappel avant le renouvellement. Vous pouvez le désactiver à tout moment.`,
  enable: '✅ Activer',
  skipAutoRenewalWarming: expiresAt =>
    `⚠️ Votre VPS expirera le ${new Date(expiresAt).toLocaleDateString('fr-FR').replace(/\//g, '-')} à ${new Date(
      expiresAt,
    ).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })}, et le service pourrait être interrompu.`,

  generateSSHKeyBtn: '✅ Générer une nouvelle clé',
  linkSSHKeyBtn: '🗂️ Lier une clé existante',
  skipSSHKeyBtn: '❌ Ignorer (Utiliser la connexion par mot de passe)',
  noExistingSSHMessage:
    '🔑 Aucune clé SSH détectée. Souhaitez-vous générer une nouvelle clé SSH pour un accès sécurisé, ou utiliser la connexion par mot de passe (moins sécurisée) ?',
  existingSSHMessage: '🔑 Vous avez des clés SSH existantes. Choisissez une option :',
  confirmSkipSSHMsg: `⚠️ Avertissement : Les connexions par mot de passe sont moins sécurisées et vulnérables aux attaques.
  🔹 Nous vous recommandons fortement d'utiliser des clés SSH. Êtes-vous sûr de vouloir continuer ?`,
  confirmSkipSSHBtn: '✅ Continuer quand même',
  setUpSSHBtn: '🔄 Configurer la clé SSH',
  sshLinkingSkipped: '❌ Liaison de clé SSH ignorée. Aucun changement effectué.',
  newSSHKeyGeneratedMsg: name => `✅ Clé SSH (${name}) créée.
⚠️ Enregistrez cette clé en toute sécurité – elle peut être récupérée plus tard.`,
  selectSSHKey: '🗂️ Sélectionnez une clé SSH existante à lier à votre VPS :',
  uploadNewKeyBtn: '➕ Télécharger une nouvelle clé',
  cancelLinkingSSHKey: `❌ Liaison de clé SSH annulée. Aucun changement effectué.`,
  selectValidSShKey: 'Veuillez sélectionner une clé SSH valide dans la liste.',
  sshKeySavedForVPS: name => `✅ La clé SSH (${name}) sera liée au nouveau VPS.`,
  askToUploadSSHKey: `📤 Téléchargez votre clé publique SSH (.pub) ou collez la clé ci-dessous.`,
  failedGeneratingSSHKey:
    'Échec de la génération d’une nouvelle clé SSH. Veuillez réessayer ou utiliser une autre méthode.',
  newSSHKeyUploadedMsg: name => `✅ Clé SSH (${name}) téléchargée avec succès et sera liée au VPS.`,
  fileTypePub: 'Le type de fichier doit être .pub',

  vpsList: list => `<strong>🖥️ Instances VPS actives :</strong>

${list
  .map(vps => `<strong>• ${vps.name} :</strong> ${vps.status === 'RUNNING' ? '🟢' : '🔴'} ${vps.status}`)
  .join('\n')}
`,
  noVPSfound: "Aucune instance VPS active n'existe. Créez-en une nouvelle.",
  selectCorrectOption: 'Veuillez sélectionner une option dans la liste',
  selectedVpsData: data => `<strong>🖥️ ID du VPS :</strong> ${data.name}

<strong>• Plan :</strong> ${data.planDetails.name}
<strong>• vCPUs :</strong> ${data.planDetails.specs.vCPU} | RAM : ${data.planDetails.specs.RAM} Go | Disque : ${
    data.planDetails.specs.disk
  } Go (${data.diskTypeDetails.type})
<strong>• OS :</strong> ${data.osDetails.name}
<strong>• Panneau de contrôle :</strong> ${
    data.cPanelPlanDetails && data.cPanelPlanDetails.type ? data.cPanelPlanDetails.type : 'Aucun'
  }
<strong>• Statut :</strong> ${data.status === 'RUNNING' ? '🟢' : '🔴'} ${data.status}
<strong>• Renouvellement automatique :</strong> ${data.autoRenewable ? 'Activé' : 'Désactivé'}
<strong>• Adresse IP :</strong> ${data.host}`,
  stopVpsBtn: '⏹️ Arrêter',
  startVpsBtn: '▶️ Démarrer',
  restartVpsBtn: '🔄 Redémarrer',
  deleteVpsBtn: '🗑️ Supprimer',
  subscriptionBtn: '🔄 Abonnements',
  VpsLinkedKeysBtn: '🔑 Clés SSH',
  confirmChangeBtn: '✅ Confirmer',

  confirmStopVpstext: name => `⚠️ Êtes-vous sûr de vouloir arrêter le VPS <strong>${name}</strong> ?`,
  vpsBeingStopped: name => `⚙️ Veuillez patienter pendant que votre VPS (${name}) est en cours d\'arrêt`,
  vpsStopped: name => `✅ Le VPS (${name}) a été arrêté.`,
  failedStoppingVPS: name => `❌ Échec de l\'arrêt du VPS (${name}).

Veuillez réessayer après un certain temps.`,
  vpsBeingStarted: name => `⚙️ Veuillez patienter pendant que votre VPS (${name}) est en cours de démarrage`,
  vpsStarted: name => `✅ Le VPS (${name}) est maintenant en cours d\'exécution.`,
  failedStartedVPS: name => `❌ Échec du démarrage du VPS (${name}).

Veuillez réessayer après un certain temps.`,
  vpsBeingRestarted: name => `⚙️ Veuillez patienter pendant que votre VPS (${name}) est en cours de redémarrage`,
  vpsRestarted: name => `✅ Le VPS (${name}) a été redémarré avec succès.`,
  failedRestartingVPS: name => `❌ Échec du redémarrage du VPS (${name}).

Veuillez réessayer après un certain temps.`,
  confirmDeleteVpstext: name =>
    `⚠️ Avertissement : La suppression de ce VPS ${name} est permanente et toutes les données seront perdues.
    • Aucun remboursement pour le temps d'abonnement non utilisé.
    • Le renouvellement automatique sera annulé et aucun frais supplémentaire ne s'appliquera.
    
  Voulez-vous continuer ?`,
  vpsBeingDeleted: name => `⚙️ Veuillez patienter pendant que votre VPS (${name}) est en cours de suppression`,
  vpsDeleted: name => `✅ Le VPS (${name}) a été supprimé de manière permanente.`,
  failedDeletingVPS: name => `❌ Échec de la suppression du VPS (${name}).

Veuillez réessayer après un certain temps.`,

  upgradeVpsBtn: '⬆️ Mettre à niveau',
  upgradeVpsPlanBtn: '⬆️ Plan VPS',
  upgradeVpsDiskBtn: '📀 Type de disque',
  upgradeVpsDiskTypeBtn: '💾 Mettre à niveau le type de disque',
  upgradeVPS: 'Choisissez le type de mise à niveau',
  upgradeOptionVPSBtn: to => {
    return `🔼 Mettre à niveau vers ${to}`
  },
  upgradeVpsPlanMsg: options => `⚙️ Choisissez un nouveau plan pour augmenter les ressources de votre VPS.
💡 La mise à niveau augmente les vCPUs, la RAM et le stockage, mais elle ne peut pas être annulée.

📌 Mises à niveau disponibles :
${options
  .map(
    planDetails =>
      `<strong>• ${planDetails.from} ➡ ${planDetails.to} –</strong> $${planDetails.monthlyPrice}/mois ($${planDetails.hourlyPrice}/heure)`,
  )
  .join('\n')}

💰 Avis de facturation : Votre plan actuel sera crédité pour les jours inutilisés, et le nouveau tarif s'appliquera pour le reste du cycle de facturation (ajustement au prorata).`,

  alreadyEnterprisePlan:
    "⚠️ Vous êtes déjà sur le plan le plus élevé (Entreprise). Aucune autre mise à niveau n'est possible.",

  alreadyHighestDisk: vpsData =>
    `⚠️ Vous êtes déjà sur le disque le plus élevé disponible (${vpsData.diskTypeDetails.type}). Aucune autre mise à niveau n\'est possible.`,
  newVpsDiskBtn: type => `Mettre à niveau vers ${type}`,
  upgradeVpsDiskMsg: upgrades => `💾 Mettez à niveau votre type de stockage pour de meilleures performances.
⚠️ Les mises à niveau de disque sont permanentes et ne peuvent pas être rétrogradées.

📌 Options disponibles :
${upgrades.map(val => `<strong>• ${val.from} ➡ ${val.to} –</strong> +$${val.price}/${val.duration}`).join('\n')}

💰 Avis de facturation : Si la mise à niveau est appliquée en cours de cycle, un ajustement au prorata sera appliqué pour la portion inutilisée de votre période de facturation actuelle.`,
  upgradePlanSummary: (newData, vpsDetails, lowBal) => `<strong>📜 Résumé de la commande :</strong>

<strong>• ID VPS : </strong> ${vpsDetails.name}
<strong>• Ancien plan : </strong> ${newData.upgradeOption.from}
<strong>• Nouveau plan : </strong> ${newData.upgradeOption.to}
<strong>• Cycle de facturation : </strong> ${newData.billingCycle}
<strong>• Nouveau tarif de facturation : </strong> $${newData.totalPrice} USD${
    newData.billingCycle === 'Hourly' ? '/heure' : ' (ajustement proratisé appliqué)'
  }
<strong>• Date d'effet : </strong> Immédiatement
${
  lowBal
    ? `
💡 Remarque : Un dépôt de $${VPS_HOURLY_PLAN_MINIMUM_AMOUNT_PAYABLE} USD est inclus dans votre total. Après la première déduction du tarif horaire, le dépôt restant sera crédité sur votre portefeuille.
`
    : ''
}
<strong>• Prix total : </strong> $${lowBal ? VPS_HOURLY_PLAN_MINIMUM_AMOUNT_PAYABLE : newData.totalPrice} USD

<strong>✅ Confirmer la commande ?</strong>`,

  upgradeDiskSummary: (newData, vpsDetails, lowBal) => `<strong>📜 Résumé de la commande :</strong>

<strong>• VPS ID :</strong> ${vpsDetails.name}
<strong>• Ancien type de disque :</strong> ${newData.upgradeOption.from}
<strong>• Nouveau type de disque :</strong> ${newData.upgradeOption.to}
<strong>• Cycle de facturation :</strong> ${newData.billingCycle}
<strong>• Nouveau tarif :</strong> $${newData.totalPrice} USD${
    newData.billingCycle === 'Hourly' ? '/heure' : ' (ajustement au prorata appliqué)'
  }
${
  lowBal
    ? `
Note : Un dépôt de $${VPS_HOURLY_PLAN_MINIMUM_AMOUNT_PAYABLE} USD est inclus dans votre total. Après la première déduction horaire, le dépôt restant sera crédité dans votre portefeuille.
`
    : ''
}
<strong>• Prix total :</strong> $${lowBal ? VPS_HOURLY_PLAN_MINIMUM_AMOUNT_PAYABLE : newData.totalPrice} USD

<strong>✅ Confirmer la commande ?</strong>`,

  vpsSubscriptionData: (vpsData, planExpireDate, panelExpireDate) => `<strong>🗂️ Vos abonnements actifs :</strong>

<strong>• VPS ${vpsData.name} </strong> – Expire le : ${planExpireDate}  (Renouvellement automatique : ${
    vpsData.autoRenewable ? 'Activé' : 'Désactivé'
  })
<strong>• Panneau de contrôle ${
    vpsData?.cPanelPlanDetails ? vpsData.cPanelPlanDetails.type : ': Non sélectionné'
  } </strong> ${
    vpsData?.cPanelPlanDetails
      ? `${vpsData?.cPanelPlanDetails.status === 'active' ? '- Expire le : ' : '- Expiré le : '}${panelExpireDate}`
      : ''
  } `,

  manageVpsSubBtn: "🖥️ Gérer l'abonnement VPS",
  manageVpsPanelBtn: "🛠️ Gérer l'abonnement au panneau de contrôle",

  vpsSubDetails: (data, date) => `<strong>📅 Détails de l\'abonnement VPS :</strong>

<strong>• VPS ID :</strong> ${data.name}
<strong>• Plan :</strong> ${data.planDetails.name}
<strong>• Date d\'expiration actuelle :</strong> ${date}
<strong>• Renouvellement automatique :</strong> ${data.autoRenewable ? 'Activé' : 'Désactivé'}`,

  vpsCPanelDetails: (data, date) => `<strong>📅 Détails de l'abonnement au panneau de contrôle :</strong>

<strong>• ID VPS lié :</strong> ${data.name}
<strong>• Type de panneau de contrôle :</strong> ${data.cPanelPlanDetails.type} (${data.cPanelPlanDetails.name})
<strong>• Date d'expiration actuelle :</strong> ${date}
<strong>• Renouvellement automatique :</strong> ${data.autoRenewable ? 'Activé' : 'Désactivé'}
`,

  vpsEnableRenewalBtn: '🔄 Activer le renouvellement automatique',
  vpsDisableRenewalBtn: '❌ Désactiver le renouvellement automatique',
  vpsPlanRenewBtn: '📅 Renouveler maintenant',
  unlinkVpsPanelBtn: '❌ Dissocier du VPS',
  bankPayVPSUpgradePlan: (priceNGN, vpsDetails) =>
    `Veuillez effectuer un paiement de ${priceNGN} NGN en cliquant sur "Effectuer le paiement" ci-dessous. Une fois la transaction confirmée, vous serez immédiatement informé, et votre nouveau plan VPS ${vpsDetails.upgradeOption.to} sera activé sans interruption.`,

  bankPayVPSUpgradeDisk: (priceNGN, vpsDetails) =>
    `Veuillez verser ${priceNGN} NGN en cliquant sur “Effectuer le paiement” ci-dessous. Une fois la transaction confirmée, vous serez rapidement informé, et votre plan VPS avec le nouveau type de disque ${vpsDetails.upgradeOption.toType} sera activé sans problème.`,

  showDepositCryptoInfoVpsUpgrade: (priceUsd, priceCrypto, tickerView, address) =>
    `💰 <b>Montant du paiement : ${Number(priceUsd).toFixed(2)} $ USD</b>

Envoyez exactement <b>${priceCrypto} ${tickerView}</b> à :

<code>${address}</code>

Votre plan VPS mis à niveau sera activé automatiquement une fois le paiement confirmé (généralement en quelques minutes).

Cordialement,
${CHAT_BOT_NAME}`,

  linkVpsSSHKeyBtn: '➕ Lier une nouvelle clé',
  unlinkSSHKeyBtn: '❌ Dissocier la clé',
  downloadSSHKeyBtn: '⬇️ Télécharger la clé',

  noLinkedKey: name => `⚠️ Il n\'y a actuellement aucune clé SSH associée à ce VPS [${name}]. 

Veuillez lier une clé SSH à votre compte pour permettre un accès sécurisé.`,

  linkedKeyList: (list, name) => `🗂️ Clés SSH liées au VPS ${name} :

${list.map(val => `<strong>• ${val}</strong>`).join('\n')}`,

  unlinkSSHKeyList: name => `🗂️ Sélectionnez une clé SSH à supprimer du VPS [${name}] :`,
  confirmUnlinkKey: data => `⚠️ Êtes-vous sûr de vouloir dissocier [${data.keyForUnlink}] du VPS [${data.name}] ?`,
  confirmUnlinkBtn: '✅ Confirmer la dissociation',
  keyUnlinkedMsg: data => `✅ La clé SSH [${data.keyForUnlink}] a été dissociée du VPS [${data.name}].`,
  failedUnlinkingKey: data => `❌ Échec de la dissociation de la clé SSH du VPS (${data.name}). 

Veuillez réessayer plus tard.`,

  userSSHKeyList: name => `🗂️ Sélectionnez une clé SSH à lier au VPS [${name}] :`,
  noUserKeyList: `🔑 Aucune clé SSH détectée. Voulez-vous en télécharger une nouvelle ?`,
  linkKeyToVpsSuccess: (key, name) => `✅ La clé SSH [${key}] a été liée avec succès au VPS [${name}].`,
  failedLinkingSSHkeyToVps: (key, name) => `❌ Échec de la liaison de la clé SSH [${key}] au VPS (${name}). 

Veuillez réessayer plus tard.`,

  selectSSHKeyToDownload: '🗂️ Sélectionnez la clé SSH que vous souhaitez télécharger :',

  disabledAutoRenewal: (
    data,
    expiryDate,
  ) => `⚠️ Le renouvellement automatique est désactivé. Votre VPS expirera le ${expiryDate} à moins d'un renouvellement manuel.
✅ Renouvellement automatique désactivé avec succès.`,

  enabledAutoRenewal: (data, expiryDate) =>
    `✅ Renouvellement automatique activé. Votre VPS sera automatiquement renouvelé le ${expiryDate}.`,

  renewVpsPlanConfirmMsg: (data, vpsDetails, expiryDate, lowBal) => `<strong>📜 Résumé de la facture</strong>

<strong>• ID VPS :</strong> ${vpsDetails.name}
<strong>• Plan :</strong> ${vpsDetails.planDetails.name}
<strong>• Cycle de facturation :</strong> ${vpsDetails.billingCycleDetails.type}
<strong>• Date d'expiration actuelle :</strong> ${expiryDate}
<strong>• Montant dû :</strong> ${data.totalPrice} USD

${
  lowBal
    ? `Remarque : Un dépôt de $${VPS_HOURLY_PLAN_MINIMUM_AMOUNT_PAYABLE} USD est inclus dans votre total. Après la déduction du premier tarif horaire, le reste du dépôt sera crédité sur votre portefeuille.`
    : ''
}

<strong>• Prix total :</strong> $${
    lowBal
      ? VPS_HOURLY_PLAN_MINIMUM_AMOUNT_PAYABLE
      : data.totalPrice
  } USD

<strong>💳 Procéder au renouvellement du VPS ?</strong>`,

  payNowBtn: '✅ Payer maintenant',

  vpsChangePaymentRecieved: `✅ Paiement réussi ! Votre VPS est en cours de configuration. Les détails seront bientôt disponibles.`,

  bankPayVPSRenewPlan: priceNGN =>
    `Veuillez envoyer ${priceNGN} NGN en cliquant sur "Effectuer le paiement" ci-dessous. Une fois la transaction confirmée, vous serez immédiatement notifié et votre plan VPS sera activé et renouvelé.`,

  renewVpsPanelConfirmMsg: (
    data,
    panelDetails,
    date,
  ) => `<strong>💳 Procéder au renouvellement du panneau de contrôle ?</strong>

<strong>📜 Résumé de la facture</strong>
  <strong>• ID VPS lié :</strong> ${data.name}
  <strong>• Panneau de contrôle :</strong> ${panelDetails.type}
  <strong>• Période de renouvellement :</strong> ${panelDetails.durationValue}${' '}Mois
  <strong>• Date d'expiration actuelle :</strong> ${date}
  <strong>• Montant dû :</strong> ${data.totalPrice} USD`,

  bankPayVPSRenewCpanel: (priceNGN, vpsDetails) =>
    `Veuillez envoyer ${priceNGN} NGN en cliquant sur "Effectuer le paiement" ci-dessous. Une fois la transaction confirmée, vous serez immédiatement notifié et votre plan VPS sera activé et le panneau de contrôle ${vpsDetails.cPanelPlanDetails.type} sera renouvelé.`,

  vpsUnlinkCpanelWarning: vpsDetails =>
    `⚠️ Avertissement : Dissocier supprimera la licence ${vpsDetails.cPanel} du VPS ${vpsDetails.name}, et vous perdrez l'accès à ses fonctionnalités. Voulez-vous continuer ?`,

  unlinkCpanelConfirmed: data => `✅ Panneau de contrôle ${data.cPanel} dissocié avec succès du VPS ${data.name}.`,

  errorUpgradingVPS: vpsName => `Une erreur s'est produite lors de la mise à niveau de votre plan VPS ${vpsName}.

Veuillez appuyer sur 💬 Obtenir de l'aide.
En savoir plus ${TG_HANDLE}.`,

  vpsUpgradePlanTypeSuccess: vpsDetails => `
✅ VPS ${vpsDetails.name} mis à niveau vers ${vpsDetails.upgradeOption.to}. Vos nouvelles ressources sont maintenant disponibles.`,

  vpsUpgradeDiskTypeSuccess: vpsDetails =>
    `✅ Disque mis à niveau vers ${vpsDetails.upgradeOption.to} pour le VPS ${vpsDetails.name}. Votre nouveau type de disque est maintenant actif.`,
  vpsRenewPlanSuccess: (vpsDetails, expiryDate) =>
    `✅ L'abonnement VPS pour ${vpsDetails.name} a été renouvelé avec succès !

• Nouvelle date d'expiration : ${expiryDate}
`,
  vpsRenewCPanelSuccess: (vpsDetails, expiryDate) =>
    `✅ Abonnement au panneau de contrôle pour ${vpsDetails.name} renouvelé avec succès !

• Nouvelle date d'expiration : ${expiryDate}
`,
}

const fr = {
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
  vp,
  vpsPlanOf,
  vpsCpanelOptional,
}

module.exports = {
  fr,
}
