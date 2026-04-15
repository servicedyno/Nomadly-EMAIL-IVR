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
 resetDead: '🗑️ Reset Dead Users',
 gift5all: '🎁 Gift $5 All Users',
}

const user = {
 // main keyboards
 cPanelWebHostingPlans: "Plans d'hébergement HostPanel en Russie 🔒",
 pleskWebHostingPlans: "Plans d'hébergement Plesk en Russie 🔒",
 joinChannel: '📢 Rejoindre le canal',
 phoneNumberLeads: '🎯 Acheter des Leads | Vérifier les Vôtres',
 buyLeads: '🎯 Acheter des Leads',
 validateLeads: '✅ Valider les numéros',
 leadsValidation: '📱 SMS Leads',
 hostingDomainsRedirect: '🛡️🔥 Hébergement Anti-Red',
 wallet: '👛 Portefeuille',
 urlShortenerMain: "🔗 Raccourcisseur d'URL",
 vpsPlans: '🖥️ VPS/RDP — Port 25 Ouvert🛡️',
 buyPlan: '⚡ Améliorer le plan',
 domainNames: '🌐 Domaines Blindés',
 viewPlan: '📋 Mes Plans',
 becomeReseller: '💼 Revendeur',
 getSupport: '💬 Support',
 cloudPhone: '📞 Cloud IVR + SIP',
 testSip: '🧪 Tester SIP Gratuit',
 freeTrialAvailable: '📧🆓 SMS en masse - Essai gratuit',
 smsAppMain: '📧 SMS en masse',
 smsCreateCampaign: '📱 Créer une campagne',
 smsMyCampaigns: '📋 Mes campagnes',
 smsDownloadApp: '📲 Télécharger l\'appli',
 smsResetLogin: '🔓 Réinitialiser la connexion',
 smsHowItWorks: '❓ Comment ça marche',
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
 shippingLabel: '📦 Ship & Mail',
 emailBlast: '📧 Email en Masse',
 emailValidation: '📧 Validation d\'Email',
 serviceBundles: '🎁 Packs de Services',
 referEarn: '🤝 Parrainez & Gagnez',
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
 upgradeHostingPlan: '⬆️ Mise à niveau',
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
 txHistory: '📜 Transactions',

 // wallet
 usd: 'USD',
 ngn: 'NGN',

 // deposit methods
 depositBank: '🏦 Bank (Naira)',
 depositCrypto: '₿ Crypto',
}
const view = num => Number(num).toFixed(2)
const yesNo = ['Oui', 'Non']

const bal = (usd) => `$${view(usd)}`

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

✅ <b>Tous les plans incluent :</b>
🔗 Raccourcissement d'URL illimité

📱 Validations de numéros avec noms des propriétaires
📞 Accès Cloud IVR

<b>Quotidien</b> — $${PRICE_DAILY}
${DAILY_PLAN_FREE_DOMAINS} domaine · ${DAILY_PLAN_FREE_VALIDATIONS.toLocaleString()} validations avec noms des propriétaires · Liens illimités

<b>Hebdomadaire</b> — $${PRICE_WEEKLY}
${WEEKLY_PLAN_FREE_DOMAINS} domaines · ${WEEKLY_PLAN_FREE_VALIDATIONS.toLocaleString()} validations avec noms des propriétaires · Liens illimités

<b>Mensuel</b> — $${PRICE_MONTHLY}
${MONTHLY_PLAN_FREE_DOMAINS} domaines · ${MONTHLY_PLAN_FREE_VALIDATIONS.toLocaleString()} validations avec noms des propriétaires · Liens illimités

<i>Tous les plans incluent raccourcissement d'URL illimité + noms des propriétaires sur toutes les validations USA.</i>`
 : `<b>Choisissez votre plan</b>

✅ <b>Tous les plans incluent :</b>
🔗 Raccourcissement d'URL illimité

📱 Validations avec noms des propriétaires
📧 Campagnes BulkSMS
📞 Accès Cloud IVR

<b>Quotidien</b> — $${PRICE_DAILY}
${DAILY_PLAN_FREE_DOMAINS} domaine · ${DAILY_PLAN_FREE_VALIDATIONS.toLocaleString()} validations · Liens + BulkSMS (3 appareils)

<b>Hebdomadaire</b> — $${PRICE_WEEKLY}
${WEEKLY_PLAN_FREE_DOMAINS} domaines · ${WEEKLY_PLAN_FREE_VALIDATIONS.toLocaleString()} validations · Liens + BulkSMS (10 appareils)

<b>Mensuel</b> — $${PRICE_MONTHLY}
${MONTHLY_PLAN_FREE_DOMAINS} domaines · ${MONTHLY_PLAN_FREE_VALIDATIONS.toLocaleString()} validations · Liens + BulkSMS (appareils illimités)

<i>Tous les plans incluent raccourcissement d'URL illimité + noms des propriétaires sur toutes les validations USA.</i>`,

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
 freeTrialAvailable: (chatId) => `📱 <b>Essai gratuit BulkSMS — 100 SMS gratuits</b>\n\nVotre code d'activation :\n<code>${chatId}</code>\n\n📲 <b>Téléchargez l'appli :</b> ${SMS_APP_LINK}\n\nOuvrez l'appli → Entrez votre code → Commencez à envoyer !\n\n⚡ Essai : 1 appareil uniquement. Abonnez-vous pour accès multi-appareils (jusqu'à 10).\n\nBesoin de cartes eSIM ? Appuyez sur 💬 Obtenir de l'aide`,
 freeTrialNotAvailable: `Vous avez déjà utilisé l'essai gratuit.`,

 smsAppMenuSubscribed: (chatId) => `📧 <b>BulkSMS — Actif ✅</b>\n\nEnvoie des SMS depuis la SIM de votre téléphone — haute délivrabilité, vrai ID expéditeur.\n\n📲 <b>Appli :</b> ${SMS_APP_LINK}\n🔑 <b>Code :</b> <code>${chatId}</code>\n\nCréez des campagnes ci-dessous ou dans l'appli.\nNouveau ? Appuyez sur <b>❓ Comment ça marche</b>`,
 smsAppMenuTrial: (chatId, remaining) => `📧 <b>BulkSMS — Essai gratuit</b> (${remaining} SMS restants)\n\nEnvoie des SMS depuis la SIM de votre téléphone — haute délivrabilité, vrai ID expéditeur.\n\n📲 <b>Appli :</b> ${SMS_APP_LINK}\n🔑 <b>Code :</b> <code>${chatId}</code>\n\nNouveau ? Appuyez sur <b>❓ Comment ça marche</b>`,
 smsAppMenuExpired: `📧 <b>BulkSMS</b>\n\nVotre essai est terminé. Appuyez sur <b>⚡ Améliorer le plan</b> pour continuer.\n\nNouveau ? Appuyez sur <b>❓ Comment ça marche</b> pour découvrir BulkSMS.`,

 smsHowItWorks: (chatId) => `📧 <b>BulkSMS — Comment ça marche</b>\n\nBulkSMS envoie de vrais SMS <b>depuis la carte SIM de votre téléphone</b> — pas un serveur. Haute délivrabilité et vrai ID expéditeur.\n\n<b>⚙️ Configuration (une seule fois) :</b>\n1. Téléchargez l'appli → ${SMS_APP_LINK}\n2. Ouvrez → entrez le code : <code>${chatId}</code>\n3. Autorisez les permissions SMS\n\n<b>📤 Envoyer une campagne :</b>\n• Appuyez sur <b>📱 Créer une campagne</b> ici ou dans l'appli\n• Ajoutez message + contacts (coller ou fichier)\n• La campagne se synchronise → appuyez sur Envoyer sur votre téléphone\n\n<b>💡 Astuces :</b>\n• Utilisez une <b>eSIM</b> pour une ligne dédiée\n• Plusieurs lignes de message = rotation automatique\n• <code>[name]</code> = personnalisation automatique\n• Planifiez ou envoyez immédiatement\n\n<b>📋 Mes campagnes</b> affiche toutes vos campagnes.\n<b>🔓 Réinitialiser</b> pour changer d'appareil.\n\nBesoin d'eSIM ? Appuyez sur 💬 Support`,
 smsCreateCampaignIntro: `📱 <b>Créer une campagne SMS</b>\n\nVoici comment ça marche :\n\n<b>Étape 1 :</b> Nommez votre campagne\n<b>Étape 2 :</b> Rédigez votre/vos message(s)\n • Utilisez <code>[name]</code> pour personnaliser\n • Plusieurs lignes = rotation de messages\n<b>Étape 3 :</b> Importez les contacts\n • Collez en texte : <code>+1234567890, Jean</code>\n • Ou téléchargez un fichier .txt / .csv\n<b>Étape 4 :</b> Réglez le délai entre SMS\n<b>Étape 5 :</b> Vérifiez & confirmez — envoyez, planifiez ou enregistrez comme brouillon\n\nLa campagne se synchronise avec l'appli Nomadly SMS pour l'envoi.\n\n<b>Commençons — entrez un nom de campagne :</b>`,
 smsSchedulePrompt: '⏰ <b>Planifier la campagne ?</b>\n\nChoisissez quand rendre cette campagne disponible :',
 smsSendNow: '▶️ Envoyer maintenant',
 smsScheduleLater: '⏰ Planifier pour plus tard',
 smsScheduleTimePrompt: '📅 <b>Entrez la date et l\'heure</b>\n\nFormat : <code>AAAA-MM-JJ HH:MM</code>\n(fuseau UTC)\n\nExemple : <code>2025-07-15 09:30</code>',
 smsSaveDraft: '💾 Enregistrer le brouillon',
 smsDefaultGap: '⏱ Par défaut (5 sec)',
 smsGapTimePrompt: '⏱ <b>Délai entre les messages</b>\n\nCombien de secondes entre chaque SMS ?\n\n• Par défaut : <b>5 secondes</b>\n• Plage : 1–300 secondes\n\nTapez un nombre ou appuyez sur le bouton par défaut :',
 smsMyCampaignsEmpty: '📋 <b>Mes campagnes</b>\n\nVous n\'avez pas encore de campagnes. Appuyez sur <b>📱 Créer une campagne</b> pour commencer !',
 smsMyCampaignsList: (campaigns) => {
 const statusIcons = { draft: '📝', sending: '📤', completed: '✅', paused: '⏸', scheduled: '📅' }
 const lines = campaigns.slice(0, 10).map((c, i) =>
 `${i + 1}. ${statusIcons[c.status] || '📋'} <b>${c.name}</b>\n ${c.sentCount}/${c.totalCount} envoyés · ${c.status}`
 )
 return `📋 <b>Mes campagnes</b>\n\n${lines.join('\n\n')}\n\n<i>Gérez vos campagnes dans l'appli Nomadly SMS.</i>`
 },
 planSubscribed:
 HIDE_SMS_APP === 'true'
 ? `Vous vous êtes abonné avec succès au plan {{plan}} ! Profitez de domaines gratuits, de liens Shortit illimités et de validations de numéros USA gratuites avec noms des propriétaires inclus. Besoin d'une carte E-sim ? Appuyez sur 💬 Obtenir de l'aide.`
 : `✅ Abonné au plan {{plan}} !

Inclus :
• Liens Shortit illimités
• Validation USA avec noms
• \${SMS_APP_NAME}

📱 Accès appareils :
 Quotidien — 3 appareils
 Hebdomadaire — 10 appareils
 Mensuel — Appareils illimités

📲 Télécharger : \${SMS_APP_LINK}
💬 E-sim : Appuyez sur Support
🔓 Changer d'appareil : /resetlogin`,
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
 welcomeFreeTrial: `Bienvenue sur ${CHAT_BOT_BRAND} ! Vous avez ${FREE_LINKS} liens Shortit d'essai pour raccourcir vos URLs. Abonnez-vous pour des liens Shortit illimités, des domaines gratuits et des validations de numéros USA gratuites avec noms des propriétaires. Découvrez la différence ${CHAT_BOT_BRAND} !`,
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

 // NS section — only show for cloudflare or custom NS (hide provider defaults)
 const nsRecs = records['NS']
 if (nsRecs && nsRecs.length && (nameserverType === 'cloudflare' || nameserverType === 'custom')) {
 const provider = nameserverType === 'cloudflare' ? 'Cloudflare' : 'Personnalisé'
 msg += `\n<b>SERVEURS DE NOMS</b> <i>(${provider})</i>\n`
 for (let i = 0; i < nsRecs.length; i++) {
 msg += ` NS${i + 1}: <code>${nsRecs[i].recordContent || '—'}</code>\n`
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
 if (!found) return ` ${type}: —`
 const vals = answers.slice(0, 2).join(', ')
 const more = answers.length > 2 ? ` +${answers.length - 2} de plus` : ''
 return ` ${type}: ${count} enregistrement${count > 1 ? 's' : ''} (${vals}${more})`
 },
 dnsHealthSummary: (resolving, total) => `\n${resolving}/${total} types résolus.`,
 dnsCheckError: 'La vérification DNS a échoué. Réessayez plus tard.',
 manageNameservers: '🔄 Gérer les serveurs de noms',
 manageNsMenu: (domain, nsRecords, nameserverType) => {
 const provider = nameserverType === 'cloudflare' ? 'Cloudflare' : nameserverType === 'custom' ? 'Personnalisé' : 'Fournisseur par défaut'
 let msg = `<b>🔄 Serveurs de noms — ${domain}</b>\n\n`
 msg += `<b>Fournisseur :</b> ${provider}\n\n`
 if (nsRecords && nsRecords.length) {
 msg += `<b>Serveurs de noms actuels :</b>\n`
 nsRecords.forEach((ns, i) => { msg += ` NS${i + 1}: <code>${ns.recordContent || '—'}</code>\n` })
 } else { msg += `<i>Aucun enregistrement NS trouvé.</i>\n` }
 msg += `\nSélectionnez une action :`
 return msg
 },
 setCustomNs: '✏️ Serveurs de noms personnalisés',
 setCustomNsPrompt: (domain, nsRecords) => {
 let msg = `<b>✏️ Serveurs de noms personnalisés pour ${domain}</b>\n\n`
 if (nsRecords && nsRecords.length) {
 msg += `<b>Actuels :</b>\n`
 nsRecords.forEach((ns, i) => { msg += ` NS${i + 1}: <code>${ns.recordContent || '—'}</code>\n` })
 msg += '\n'
 }
 msg += `Entrez les nouveaux serveurs de noms (un par ligne, min 2, max 4) :\n\n<i>Exemple :\nns1.example.com\nns2.example.com</i>`
 return msg
 },
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
 msg += ` NS${i + 1}: <code>${nsRecords[i].recordContent || '—'}</code>${marker}\n`
 }
 msg += `\nEntrez le nouveau serveur de noms pour <b>NS${slotIndex}</b> :\ne.g. <b>ns1.cloudflare.com</b>`
 return msg
 },

 // Digital Products
 digitalProductsSelect: `🛒 <b>Produits numériques</b>\n\nComptes vérifiés livrés <b>rapidement</b> via ce bot.\n\n<b>Télécom</b> — Twilio, Telnyx (SMS, Voix, SIP)\n<b>Cloud</b> — AWS, Google Cloud (Accès complet)\n<b>Email</b> — Google Workspace, Zoho Mail, IONOS SMTP\n<b>Mobile</b> — eSIM T-Mobile\n\nPayez par crypto, virement bancaire ou portefeuille. Sélectionnez ci-dessous :`,
 dpTwilioMain: `📞 Compte Twilio Principal — $${DP_PRICE_TWILIO_MAIN}`,
 dpTwilioSub: `📞 Sous-compte Twilio — $${DP_PRICE_TWILIO_SUB}`,
 dpTelnyxMain: `📡 Compte Telnyx Principal — $${DP_PRICE_TELNYX_MAIN}`,
 dpTelnyxSub: `📡 Sous-compte Telnyx — $${DP_PRICE_TELNYX_SUB}`,
 dpGworkspaceNew: `📧 Google Workspace Admin (Nouveau domaine) — $${DP_PRICE_GWORKSPACE_NEW}`,
 dpGworkspaceAged: `📧 Google Workspace Admin (Domaine ancien) — $${DP_PRICE_GWORKSPACE_AGED}`,
 dpEsim: `📱 eSIM T-Mobile — $${DP_PRICE_ESIM}`,
 dpEsimAirvoice: `📱 eSIM Airvoice (AT&T)`,
 dpAirvoiceSelect: `📱 <b>eSIM Airvoice (AT&T)</b>\n\n📶 Appels, SMS & data illimites sur le reseau AT&T.\nCompatible iOS & Android. Scannez le QR pour activer.\n\nChoisissez la duree :`,
 dpAirvoice1m: `1 Mois — $${DP_PRICE_AIRVOICE_1M}`,
 dpAirvoice3m: `3 Mois — $${DP_PRICE_AIRVOICE_3M}`,
 dpAirvoice6m: `6 Mois — $${DP_PRICE_AIRVOICE_6M}`,
 dpAirvoice1y: `1 An — $${DP_PRICE_AIRVOICE_1Y}`,
 dpZohoNew: `📧 Zoho Mail (Nouveau domaine) — $${DP_PRICE_ZOHO_NEW}`,
 dpZohoAged: `📧 Zoho Mail (Domaine ancien) — $${DP_PRICE_ZOHO_AGED}`,
 dpAwsMain: `☁️ Compte AWS Principal — $${DP_PRICE_AWS_MAIN}`,
 dpAwsSub: `☁️ Sous-compte AWS — $${DP_PRICE_AWS_SUB}`,
 dpGcloudMain: `🌐 Google Cloud Principal — $${DP_PRICE_GCLOUD_MAIN}`,
 dpGcloudSub: `🌐 Google Cloud Sous-compte — $${DP_PRICE_GCLOUD_SUB}`,
 dpIonosSmtp: `📧 IONOS SMTP — $${DP_PRICE_IONOS_SMTP}`,
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
 'eSIM T-Mobile': '📶 <b>1 mois — Appels, SMS & data illimites</b>\nCompatible iOS & Android. Scannez le QR pour activer.\n\nVous recevez : QR code ou details d\'activation.',
 'eSIM Airvoice (AT&T) — 1 Month': '📶 <b>1 mois — Appels, SMS & data illimites (AT&T)</b>\nCompatible iOS & Android. Scannez le QR pour activer.\n\nVous recevez : QR code ou details d\'activation.',
 'eSIM Airvoice (AT&T) — 3 Months': '📶 <b>3 mois — Appels, SMS & data illimites (AT&T)</b>\nCompatible iOS & Android. Scannez le QR pour activer.\n\nVous recevez : QR code ou details d\'activation.',
 'eSIM Airvoice (AT&T) — 6 Months': '📶 <b>6 mois — Appels, SMS & data illimites (AT&T)</b>\nCompatible iOS & Android. Scannez le QR pour activer.\n\nVous recevez : QR code ou details d\'activation.',
 'eSIM Airvoice (AT&T) — 1 Year': '📶 <b>1 an — Appels, SMS & data illimites (AT&T)</b>\nCompatible iOS & Android. Scannez le QR pour activer.\n\nVous recevez : QR code ou details d\'activation.',
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
 selectCurrencyToDeposit: `💵 Montant du dépôt (min. $10) :`,
 depositNGN: `Veuillez entrer le montant NGN (minimum ≈ 10 USD).\nVotre Naira sera converti en USD au taux de change actuel :`,
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

 showWallet: (usd) => `Solde du portefeuille :\n\n$${view(usd)}`,

 wallet: (usd) => `Solde du portefeuille :\n\n$${view(usd)}\n\nSélectionnez l'option du portefeuille :`,

 walletSelectCurrency: (usd) =>
 `Solde du portefeuille : $${view(usd)}`,

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
 `Rappelez-vous, votre plan ${plan} comprend ${available} domaine gratuit${s}. Obtenez votre domaine dès aujourd'hui !`,
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
 cancelled: 'Annulé.',
 domainActionsMenu: (domain) => `<b>Actions pour ${domain}</b>\n\nSélectionnez une option :`,
 purchaseFailed: '❌ Achat échoué. Votre portefeuille a été remboursé. Veuillez réessayer ou contacter le support.',
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
 scanQrOrUseChat: chatId => `📱 <b>Nomadly SMS App</b>\n\nVotre code d'activation :\n<code>${chatId}</code>\n\n📲 Téléchargez : ${process.env.SMS_APP_LINK || 'Contactez le support'}`,
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

 // ── Email Blast i18n ──
 ebSendBlast: '📤 Envoyer Email en Masse',
 ebMyCampaigns: '📬 Mes Campagnes',
 ebAdminPanel: '⚙️ Panneau Admin',
 ebCancelBtn: '❌ Annuler',
 ebCancelled: '❌ Annulé.',
 ebUploadCsvTxt: '📎 Téléchargez un fichier CSV/TXT ou collez les adresses email (une par ligne).',
 ebUploadCsvOnly: '❌ Veuillez télécharger un fichier <b>.csv</b> ou <b>.txt</b>.',
 ebUploadHtmlFile: '📎 Veuillez télécharger un fichier <b>.html</b>, ou appuyez sur ❌ Annuler.',
 ebTypeOrUpload: '📝 Tapez votre message ou téléchargez un fichier HTML.',
 ebEnterSubject: '✏️ Entrez le nouvel <b>Objet</b> :',
 ebChooseTextOrHtml: 'Choisissez : "📝 Texte brut" ou "📎 Télécharger HTML"',
 ebTypeText: '📝 Texte brut',
 ebUploadHtml: '📎 Télécharger HTML',
 ebInvalidEmail: '❌ Adresse email invalide. Entrez un email valide (ex: vous@gmail.com) :',
 ebFailedReadHtml: '❌ Impossible de lire le fichier HTML. Réessayez ou téléchargez un autre fichier.',
 ebBundleNotFound: '❌ Bundle introuvable.',
 ebCampaignNotFound: '❌ Campagne introuvable.',
 ebTestSending: (addr) => `⏳ Envoi d'un email test à <b>${addr}</b> via Brevo...`,
 ebAddDomainBtn: '➕ Ajouter Domaine',
 ebRemoveDomainBtn: '❌ Supprimer Domaine',
 ebDashboardBtn: '📊 Tableau de Bord',
 ebManageDomainsBtn: '🌐 Gérer Domaines',
 ebManageIpsBtn: '🖥️ Gérer IPs & Chauffage',
 ebPricingBtn: '💰 Tarification',
 ebSuppressionBtn: '🚫 Liste de Suppression',
 ebAddIpBtn: '➕ Ajouter IP',
 ebPauseIpBtn: '⏸ Suspendre IP',
 ebResumeIpBtn: '▶️ Reprendre IP',
 ebAdminPanelTitle: '⚙️ <b>Panneau Admin Email</b>',
 ebNoDomains: '📭 Aucun domaine configuré.',
 ebDomainRemoved: (d) => `✅ Domaine <b>${d}</b> supprimé avec succès.\n\nEnregistrements DNS nettoyés.`,
 ebDomainRemoveFailed: (err) => `❌ Échec de la suppression : ${err}`,
 ebInvalidDomain: '❌ Nom de domaine invalide. Entrez un domaine valide (ex: example.com)',
 ebInvalidIp: '❌ Adresse IP invalide. Entrez une IPv4 valide (ex: 1.2.3.4)',
 ebSettingUpDomain: (d) => `⏳ Configuration de <b>${d}</b>...\n\nCréation des enregistrements DNS, génération des clés DKIM...`,
 ebNoActiveIps: 'Aucune IP active à suspendre.',
 ebNoPausedIps: 'Aucune IP en pause.',
 ebIpPaused: (ip) => `⏸ IP ${ip} suspendue.`,
 ebIpResumed: (ip) => `▶️ IP ${ip} reprise.`,
 ebRateUpdated: (rate) => `✅ Tarif mis à jour : <b>$${rate}/email</b> ($${(rate * 500).toFixed(0)} par 500)`,
 ebMinUpdated: (min) => `✅ Minimum d'emails mis à jour : <b>${min}</b>`,
 ebInvalidRate: '❌ Invalide. Entrez un nombre comme 0.10',
 ebInvalidMin: '❌ Invalide. Entrez un nombre.',
 ebSelectIpDomain: (ip) => `🖥️ Assigner l'IP <b>${ip}</b> à quel domaine ?`,

 // ── Audio Library / IVR i18n ──
 audioLibTitle: '🎵 <b>Bibliothèque Audio</b>',
 audioLibEmpty: '🎵 <b>Bibliothèque Audio</b>\n\nVous n\'avez aucun fichier audio.\n\nTéléchargez un fichier audio (MP3, WAV, OGG) pour les campagnes IVR.',
 audioLibEmptyShort: '🎵 <b>Bibliothèque Audio</b>\n\nAucun fichier audio. Téléchargez-en un pour commencer.',
 audioUploadBtn: '📎 Télécharger Audio',
 audioUploadNewBtn: '📎 Nouveau Audio',
 audioUseTemplateBtn: '📝 Utiliser Modèle IVR',
 audioSelectOption: 'Sélectionnez une option :',
 audioSelectIvr: 'Sélectionnez l\'audio IVR :',
 audioReceived: (size) => `✅ Audio reçu ! (${size} Ko)\n\nDonnez-lui un nom pour votre bibliothèque :`,
 audioReceivedShort: '✅ Audio reçu !\n\nDonnez-lui un nom :',
 audioSaved: (name) => `✅ Audio enregistré sous : <b>${name}</b>\n\nVous pouvez maintenant l'utiliser dans les campagnes IVR !`,
 audioDeleted: (name) => `✅ Supprimé : <b>${name}</b>`,
 audioGenFailed: (err) => `❌ Échec de la génération audio : ${err}`,
 audioFailedSave: '❌ Impossible d\'enregistrer le message d\'accueil. Veuillez réessayer.',
 audioMaxImages: '📸 Maximum 5 images. Appuyez sur ✅ Téléchargement terminé pour continuer.',

 // ── Common i18n ──
 chooseOption: 'Veuillez choisir une option :',
 refreshStatusBtn: '🔄 Actualiser le Statut',
 cancelRefundBtn: '❌ Annuler & Rembourser',
 dbConnectRetry: 'La base de données se connecte, veuillez réessayer dans un instant',
 nsCannotAdd: 'Les enregistrements NS ne peuvent pas être ajoutés. Utilisez <b>Mettre à jour les DNS</b> pour changer les serveurs de noms.',
 noSupportSession: 'Aucune session de support active.',
 noPendingLeads: '📝 Aucune demande de leads en attente.',
 invalidAmountPositive: '⚠️ Le montant doit être un nombre positif.',

 // ── Marketplace ──
 mpHome: '🏪 <b>MARCHÉ NOMADLY</b>\n\n💰 <b>Vendez vos produits numériques</b> — publiez en 60 secondes, soyez payé instantanément\n🛍️ <b>Trouvez des offres exclusives</b> — vendeurs vérifiés, transactions réelles\n\n🔒 <b>ESCROW OBLIGATOIRE</b> pour tout achat via @Lockbaybot\n⚠️ Ne payez JAMAIS le vendeur directement ou via son bot — utilisez UNIQUEMENT l\'escrow.\n\n👇 Prêt à gagner ou acheter ?',
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
 mpProductPublished: '🎉 Votre annonce est EN LIGNE !\n\nLes acheteurs peuvent maintenant la découvrir.\n\n⚠️ <b>Rappel :</b> Toutes les ventes doivent passer par l\'escrow @Lockbaybot.\n\n💡 <b>Conseils pour vendre plus vite :</b>\n• Répondez rapidement aux demandes\n• Ajoutez des photos claires et descriptions détaillées\n• Fixez un prix compétitif',
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
 `💬 Vous discutez avec le vendeur de <b>${title}</b> ($${price})\n\n⚠️ <b>ESCROW OBLIGATOIRE</b> — tapez /escrow pour payer via @Lockbaybot\n❌ Ne payez JAMAIS le vendeur directement ou via son bot.\n\n💡 Demandez des détails ou preuves avant d'acheter.\nEnvoyez /done pour quitter.`,
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
 mpPaymentWarning: '🚨 <b>ATTENTION : Paiement direct détecté !</b>\n\n❌ N\'envoyez JAMAIS d\'argent au vendeur directement ou via son bot.\n🔒 L\'escrow via @Lockbaybot est <b>OBLIGATOIRE</b>.\n📢 Tapez /report si vous êtes en danger.',
 mpEscrowMsg: (title, price, sellerRef) =>
 `🔒 <b>ESCROW — ACHAT OBLIGATOIRE</b>\n\n📦 Produit : <b>${title}</b>\n💰 Prix : <b>$${Number(price).toFixed(2)}</b>\n👤 Vendeur : <b>${sellerRef}</b>\n\n1. Ouvrez @Lockbaybot\n2. Créez un escrow avec <b>${sellerRef}</b> pour <b>$${Number(price).toFixed(2)}</b>\n3. Les deux parties confirment\n\n⚠️ Ne payez JAMAIS en dehors de l\'escrow ou via le bot du vendeur`,
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
 `🏷️ <b>${title}</b>\n💰 <b>$${Number(price).toFixed(2)}</b> · ${category}\n${sellerStats}\n🔒 ⚠️ Escrow obligatoire — payez via @Lockbaybot uniquement`,
 mpProductDetail: (title, desc, price, category, sellerStats, listedAgo) =>
 `📦 <b>${title}</b>\n\n📄 ${desc}\n\n💰 Prix : <b>$${Number(price).toFixed(2)}</b>\n📂 ${category}\n${sellerStats}\n📅 Publié : ${listedAgo}\n\n🔒 <b>ESCROW OBLIGATOIRE</b>\nPayez UNIQUEMENT via @Lockbaybot. Ne payez jamais le vendeur directement ou via son bot.`,
 mpMyListingsHeader: (count, max) => `📦 <b>MES ANNONCES</b> (${count}/${max})`,
 mpConvHeader: '💬 <b>MES CONVERSATIONS</b>',
 mpConvItem: (title, role, lastMsg) => `💬 <b>${title}</b> (${role}) — ${lastMsg}`,
 mpDoneCmd: '/done',
 mpEscrowCmd: '/escrow',
 mpPriceCmd: '/price',
 mpReportCmd: '/report',
 mpEnteredChat: (title, price) => `💬 Vous êtes dans le chat pour <b>${title}</b> (${price} $)\nEnvoyez /done pour quitter, /escrow pour démarrer l'escrow, /price XX pour proposer un prix.`,
 mpResumedChat: (title, price, role) => `💬 Chat repris : <b>${title}</b> (${price} $) — Vous êtes ${role}\n⚠️ <b>ESCROW OBLIGATOIRE</b> — payez uniquement via @Lockbaybot. Ne payez jamais le vendeur directement ou via son bot.\n\nEnvoyez /done pour quitter, /escrow pour démarrer l'escrow, /price XX pour proposer un prix.`,
 mpBuyerPhotoCaption: '💬 L\'acheteur a envoyé une photo :',
 mpSellerPhotoCaption: '💬 Le vendeur a envoyé une photo :',
 mpChatClosedReset: (title) => `💬 La conversation sur <b>${title}</b> a été fermée par l'autre partie. Vous avez été redirigé vers le marché.`,
 mpSellerBusy: (title) => `🆕 Nouvelle demande pour <b>${title}</b> ! Appuyez sur le bouton ci-dessous pour répondre quand vous êtes prêt.`,
 mpCatDigitalGoods: '💻 Produits Numériques',
 mpCatBnkLogs: '🏦 Logs Bancaires',
 mpCatBnkOpening: '🏧 Ouverture Bancaire',
 mpCatTools: '🔧 Outils',
 adm_1: '📸 Maximum 5 images. Tap ✅ Terminé Uploading to continue.',
 adm_10: (orderId, buyerName, chatId, product) => `✅ Order <code>${orderId}</code> delivered to ${buyerName} (${commande.chatId}).\nProduct: ${commande.produit}`,
 adm_11: (message) => `❌ Erreur delivering commande: ${message}`,
 adm_12: (TG_CHANNEL) => `👆 <b>Ad Preview</b>\n\nType <b>/ad post</b> to envoyer this to ${TG_CHANNEL}`,
 adm_13: (totalDead, chatNotFound, userDeactivated, botBlocked, other) => `📊 <b>Dead Users Report</b>\n\nTotal marked dead: <b>${totalDead}</b>\n• chat_not_found: ${chatNotFound}\n• utilisateur_deactivated: ${userDeactivated}\n• bot_blocked: ${botBlocked}\n• other: ${other}\n\nCommands:\n<code>/resetdead all</code> — Clear ALL dead entries\n<code>/resetdead blocked</code> — Clear only bot_blocked\n<code>/resetdead notfound</code> — Clear only chat_not_found`,
 adm_14: '❌ Usage: /resetdead all | blocked | notfound',
 adm_15: (modifiedCount, sub) => `✅ Reset <b>${modifiedCount}</b> dead utilisateur entries (${sub}).`,
 adm_16: '🔄 Running win-back campagne scan...',
 adm_17: (sent, errors) => `✅ Win-back complete: ${result.envoyé} envoyé, ${errors} errors`,
 adm_18: '✅ Ad posted to channel!',
 adm_19: '❌ Channel ID not configured.',
 adm_2: (length) => `📸 Image ${length}/5 received. Envoyer more or tap ✅ Terminé Uploading.`,
 adm_20: '📦 Non pending digital produit orders.',
 adm_21: (message) => `❌ Erreur: ${message}`,
 adm_22: (message) => `Erreur fetching requests: ${message}`,
 adm_23: '⚠️ Usage: /credit <@username or chatId> <montant>\\n\\nExamples:\\n<code>/credit @john 50</code>\\n<code>/credit 5590563715 25.50</code>',
 adm_24: '⚠️ Montant must be a positive number.',
 adm_25: (userRef) => `⚠️ Utilisateur <b>${userRef}</b> not found.`,
 adm_26: (toFixed, targetName, targetChatId, v3) => `✅ Credited <b>$${montant.toFixed(2)} USD</b> to <b>${targetName}</b> (${targetChatId})\n\n💳 Their solde: $${v3} USD`,
 adm_27: (message) => `❌ Erreur crediting portefeuille: ${message}`,
 adm_28: (WELCOME_BONUS_USD) => `🎁 Starting gift of $${WELCOME_BONUS_USD} to all utilisateurs who haven't received it yet...\nThis may take a while.`,
 adm_29: (gifted, skipped, failed, total) => `✅ <b>Gift Complete!</b>\n\n🎁 Gifted: ${gifted}\n⏭ Skipped (already had): ${skipped}\n❌ Échoué: ${failed}\n📊 Total utilisateurs: ${total}`,
 adm_3: '⚠️ Usage: /reply <chatId> <message>',
 adm_30: (message) => `❌ Gift failed: ${message}`,
 adm_31: '⚠️ Usage: /bal <@username or chatId>\\n\\nExamples:\\n<code>/bal @john</code>\\n<code>/bal 7193881404</code>',
 adm_32: (userRef) => `⚠️ Utilisateur <b>${userRef}</b> not found.`,
 adm_33: (message) => `❌ Erreur checking solde: ${message}`,
 adm_34: '⚠️ Usage: /mpban <@username or chatId> [reason]\\n\\nExamples:\\n<code>/mpban @john spamming</code>\\n<code>/mpban 8317455811 policy violation</code>',
 adm_35: (userRef) => `⚠️ Utilisateur <b>${userRef}</b> not found.`,
 adm_36: (targetName, targetChatId, listingsRemoved, reason) => `🚫 <b>Marketplace Ban Applied</b>\n\n👤 Utilisateur: <b>${targetName}</b> (${targetChatId})\n📦 Listings removed: <b>${listingsRemoved}</b>\n📝 Reason: <i>${reason}</i>\n\nUser can no longer access or post in marketplace.`,
 adm_37: (message) => `❌ Erreur: ${message}`,
 adm_38: '⚠️ Usage: /mpunban <@username or chatId>\\n\\nExamples:\\n<code>/mpunban @john</code>\\n<code>/mpunban 8317455811</code>',
 adm_39: (userRef) => `⚠️ Utilisateur <b>${userRef}</b> not found.`,
 adm_4: (targetName) => `✅ Reply envoyé à ${targetName}`,
 adm_40: (targetName, targetChatId) => `✅ <b>Marketplace Ban Removed</b>\n\n👤 Utilisateur: <b>${targetName}</b> (${targetChatId})\n\nUser can now access marketplace again.`,
 adm_41: (targetName) => `ℹ️ Utilisateur <b>${targetName}</b> was not banned from marketplace.`,
 adm_42: (message) => `❌ Erreur: ${message}`,
 // === Nested Template Keys ===
 cp_nested_1: (count, numberList) => `📞 <b>Lot : ${count} numéros</b>\n${numberList}\n\nChoisissez une catégorie de modèle SVI :`,
 cp_nested_2: (icon, firstPh, desc, hint) => `\n${icon} <b>[${firstPh}]</b> — ${desc}\n\n<i>${hint}</i>`,
 cp_nested_3: (icon, firstPh, desc, hint) => `${icon} <b>[${firstPh}]</b> — ${desc}\n\n<i>${hint}</i>`,
 cp_nested_4: (currentPh, value, icon, nextPh, desc, hint) => `✅ ${currentPh}: <b>${value}</b>\n\n${icon} <b>[${nextPh}]</b> — ${desc}\n\n<i>${hint}</i>`,
 cp_nested_5: (target, msg) => `❌ Appel en lot vers ${target} échoué : ${msg}`,
 cp_nested_6: (refundAmt, walletLine) => `💰 <b>${refundAmt}</b> a été remboursé dans votre portefeuille.\n${walletLine}`,
 cp_nested_7: (cleanedMsg, balMsg) => `🔄 <b>Nouveau départ !</b>\n\n${cleanedMsg}${balMsg}\n\nVous pouvez maintenant commencer un nouvel achat de numéro de téléphone.`,
 cp_nested_8: (msg) => `❌ Erreur de reconquête : ${msg}`,
 cp_nested_9: (target, city, detailsLine) => `✅ <b>Demande soumise !</b>\n\n🎯 Cible : <b>${target}</b>\n🏙️ Zone : <b>${city}</b>${detailsLine}\n\nNotre équipe examinera votre demande et vous notifiera. Merci !`,
 cp_nested_hint_default: (ph) => `Entrez une valeur pour [${ph}]`,
 cp_nested_cleared: (count, refunded) => `✅ ${count} vérification(s) rejetée(s) effacée(s)\n💰 $${refunded} remboursé\n`,
 // === Voice Service ===
 vs_callDisconnectedWallet: (rate, connFee) => `🚫 <b>Appel déconnecté</b> — Solde insuffisant (besoin de $\${rate}/min + $\${connFee} connexion). Rechargez via 👛 Portefeuille.`,
 vs_callDisconnectedExhausted: '🚫 <b>Appel déconnecté</b> — Solde épuisé.\nRechargez via 👛 Portefeuille.',
 vs_outboundCallFailed: (from, to, reason) => `🚫 <b>Appel sortant échoué</b>\n📞 \${from} → \${to}\nRaison : \${reason}`,
 vs_planMinutesExhausted: (phone, used, limit, overage) => `⚠️ <b>Minutes du forfait épuisées</b>\n\n📞 \${phone}\nUtilisées : <b>\${used}/\${limit}</b> min\n\${overage}`,
 vs_planSmsExhausted: (phone, used, limit) => `⚠️ <b>SMS du forfait épuisés</b>\n\n📞 \${phone}\nUtilisés : <b>\${used}/\${limit}</b> SMS entrants`,
 vs_orphanedNumber: (to, from) => `⚠️ <b>Alerte numéro orphelin</b>\n\n📞 <code>\${to}</code> a reçu un appel de <code>\${from}</code>\n\n❌ Aucun propriétaire trouvé — appel rejeté.`,
 vs_incomingCallBlocked: (to, from) => `🚫 <b>Appel entrant bloqué — Solde vide</b>\n\n📞 \${to}\n👤 Appelant : \${from}`,
 vs_overageActive: (charged, rateInfo) => `💰 <b>Hors forfait actif</b> — Minutes épuisées. \${charged} (\${rateInfo})`,
 vs_callEndedExhausted: (elapsed) => `🚫 <b>Appel terminé</b> — Minutes + solde épuisés.\n⏱️ ~\${elapsed} min. Rechargez ou améliorez votre forfait.`,
 vs_outboundCallBlocked: (from, to, reason) => `🚫 <b>Appel sortant bloqué</b>\n📞 \${from} → \${to}\nRaison : \${reason}`,
 vs_sipCallBlocked: (rate, connFee) => `🚫 <b>Appel SIP bloqué</b> — Solde insuffisant (besoin de $\${rate}/min + $\${connFee} connexion). Rechargez via 👛 Portefeuille.`,
 vs_freeSipTestCall: (from, to) => `📞 <b>Appel test SIP gratuit</b>\nDe : \${from}\nVers : \${to}`,
 vs_sipOutboundCall: (from, to, planLine) => `📞 <b>Appel SIP sortant</b>\nDe : \${from}\nVers : \${to}\n\${planLine}`,
 vs_lowBalance: (bal, estMin) => `⚠️ <b>Solde faible</b> — $\${bal} (~\${estMin} min transfert). Rechargez <b>$25</b> via 👛 Portefeuille.`,
 vs_forwardingBlocked: (bal, rate) => `🚫 <b>Transfert bloqué</b> — Solde $\${bal} (besoin de $\${rate}/min). Rechargez via 👛 Portefeuille.`,
 vs_ivrForwardBlocked: (phone, forwardTo, bal) => `🚫 <b>Transfert SVI bloqué — Solde vide</b>\n\n📞 \${phone}\n📲 Vers : \${forwardTo}\n💰 Solde : $\${bal}`,
 vs_lowBalanceIvr: (bal, estMin) => `⚠️ <b>Solde faible</b> — $\${bal} (~\${estMin} min SVI). Rechargez via 👛 Portefeuille.`,
 vs_callForwarded: (to, forwardTo, from, duration, planLine, time) => `📞 <b>Appel transféré</b>\n\n📞 \${to} → 📲 \${forwardTo}\n👤 \${from}\n⏱️ \${duration}\n\${planLine}\n🕐 \${time}`,
 vs_forwardFailed: (to, forwardTo, from, time) => `❌ <b>Transfert échoué — Pas de réponse</b>\n\n📞 \${to} → 📲 \${forwardTo}\n👤 Appelant : \${from}\n📲 \${forwardTo} n'a pas répondu\n🕐 \${time}`,
 vs_sipCallFailed: (from, to, time) => `❌ <b>Appel SIP échoué — Transfert sans réponse</b>\n\n📞 De : \${from}\n📲 Vers : \${to}\n🕐 \${time}`,
 vs_sipCallEnded: (from, to, duration, planLine, time) => `📞 <b>Appel SIP terminé</b>\n\n📞 De : \${from}\n📲 Vers : \${to}\n⏱️ \${duration}\n\${planLine}\n🕐 \${time}`,
 vs_freeTestCallEnded: (from, to, duration, time) => `📞 <b>Appel test gratuit terminé</b>\n\n📞 De : \${from}\n📲 Vers : \${to}\n⏱️ \${duration}\n🕐 \${time}`,
 vs_missedCall: (to, from, time) => `📞 <b>Appel manqué</b>\n\n📞 Vers : \${to}\n👤 De : \${from}\n🕐 \${time}`,
 vs_ivrCallRouted: (to, from, digit, forwardTo, time) => `📞 <b>Appel SVI routé</b>\n\n📞 Vers : \${to}\n👤 De : \${from}\nTouche : <b>\${digit}</b> → Transféré vers \${forwardTo}\n🕐 \${time}`,
 vs_ivrCall: (to, from, digit, time) => `📞 <b>Appel SVI</b>\n\n📞 Vers : \${to}\n👤 De : \${from}\nTouche : <b>\${digit}</b> → Message joué\n🕐 \${time}`,
 vs_newVoicemail: (to, from, duration, time) => `🎙️ <b>Nouveau message vocal</b>\n\n📞 Vers : \${to}\n👤 De : \${from}\n⏱️ Durée : \${duration}\n🕐 \${time}`,
 vs_callRecording: (to, from, duration, time) => `🔴 <b>Enregistrement d'appel</b>\n\n📞 Vers : \${to}\n👤 De : \${from}\n⏱️ Durée : \${duration}\n🕐 \${time}`,
 vs_listen: 'Écouter',
 adm_error_prefix: '❌ Erreur : ',
 dom_confirm_prompt: 'Confirmer ?',
 adm_5: '⚠️ Usage: /close <chatId>',
 adm_6: (targetName) => `✅ Closed support session for ${targetName}`,
 adm_7: '⚠️ Usage: /deliver <orderId> <produit details/identifiants>',
 adm_8: (orderId) => `⚠️ Order <code>${orderId}</code> not found.`,
 adm_9: (orderId) => `⚠️ Order <code>${orderId}</code> was already delivered.`,
 cp_1: '⚠️ Dépôts NGN temporairement indisponibles (service de taux de change en panne). Veuillez essayer la crypto.',
 cp_10: (TRIAL_CALLER_ID) => `📢 <b>Appel SVI Rapide — Essai Gratuit</b>\n\n🎁 You get <b>1 appel d'essai gratuit!</b>\n📱 ID Appelant: <b>${TRIAL_CALLER_ID}</b> (partagé)\n\nCall a single number with an message SVI automatisé.\n\nEnter the numéro de téléphone to call (avec l'indicatif pays):\n<i>Exemple: +12025551234</i>`,
 cp_100: '🎚 <b>Sélectionnez la vitesse de parole</b>:',
 cp_101: '❌ Vitesse invalide. Entrez a number between <b>0.25</b> and <b>4.0</b>:\\n<i>Exemple: 0.8 or 1.3</i>',
 cp_102: 'Please select a speed from the buttons:',
 cp_103: (voiceName, speedLabelDisplay) => `🎤 Voix: <b>${voiceName}</b> | 🎚 Vitesse: <b>${speedLabelDisplay}</b>\n\n⏳ Génération de l'aperçu audio...`,
 cp_104: (message) => `❌ Échec de la génération audio.\n\n💡 <b>Tip:</b> Try selecting <b>ElevenLabs</b> as the voice provider — it tends to be more reliable.\n\n<i>Erreur: ${message}</i>`,
 cp_105: '🎙 <b>Sélectionnez le fournisseur de voix</b>\\n\\nChoose your TTS engine:',
 cp_106: '🎙 <b>Sélectionnez le fournisseur de voix</b>\\n\\nChoose your TTS engine:',
 cp_107: '🎚 <b>Sélectionnez la vitesse de parole</b>\\n\\nChoose how fast the voice speaks:',
 cp_108: (holdMusic, v1) => `🎵 Hold Music: <b>${holdMusic}</b>\n${ivrObData.holdMusic ? 'Target will hear "Please hold" + music before transfert.' : 'Target hears standard ringback during transfert.'}`,
 cp_109: 'What would you like to do?',
 cp_11: (buyLabel) => `📞 <b>Campagne SVI en masse</b>\n\n🔒 Cette fonctionnalité nécessite the <b>Pro</b> forfait or higher.\n\nGet a SVI Cloud number first!\n\nTap <b>${buyLabel}</b> to get started.`,
 cp_110: 'Audio not ready. Veuillez appuyer sur ✅ Confirmer instead.',
 cp_111: '⏭ <b>Skipping preview — Ready to call!</b>',
 cp_112: 'Tap <b>✅ Confirmer</b> to proceed, <b>🎤 Change Voix</b>, or <b>Retour</b>.',
 cp_113: 'What would you like to do?',
 cp_114: '🕐 <b>Planifier Call</b>\\n\\nHow many minutes from now should the call go out?\\n\\n<i>Examples: 5, 15, 30, 60</i>',
 cp_115: 'Please enter between 1 and 1440 minutes.',
 cp_116: (targetNumber, minutes, toLocaleTimeString) => `✅ <b>Call Planifié!</b>\n\n📞 To: ${targetNumber}\n🕐 In: ${minutes} minutes (${toLocaleTimeString} UTC)\n\nYou'll be notified when the call is placed.`,
 cp_117: (toFixed, v1) => `⚠️ <b>Insufficient Portefeuille Solde</b>\n\nQuick SVI calls require a minimum solde of <b>$${SVI_MIN_WALLET.toFixed(2)}</b>.\n\nYour solde: <b>$${v1}</b>\n\nPlease top up your portefeuille and try again.`,
 cp_118: '🚫 <b>Call Blocked</b>\\n\\nYour numéro de téléphone is missing sub-account identifiants. Please contact support.',
 cp_119: (batchCount, length, target) => `📞 Lot ${batchCount}/${length}: Appel ${target}...`,
 cp_12: '📞 <b>Campagne SVI en masse</b>\\n\\nCall multiple numéros with an message SVI automatisé.\\nUpload a CSV of leads and launch a campagne.\\n\\n☎️ = Bulk SVI capable numéros\\n\\n📱 Sélectionner the ID Appelant:',
 cp_120: '💾 Want to save this as a Quick Dial preset for next time?',
 cp_121: 'Press <b>/yes</b> to place the call or <b>/cancel</b> to abort.',
 cp_122: (presetName) => `✅ Préréglage "<b>${presetName}</b>" saved!\n\nNext time, select it from the Quick SVI menu to skip setup.`,
 cp_123: '🎵 <b>Audio Library</b>\\n\\nNo audio files. Télécharger one to get started.',
 cp_124: (audioList) => `🎵 <b>Audio Library</b>\n\n${audioList}`,
 cp_125: 'Sélectionner an option:',
 cp_126: (audioList) => `🎵 <b>Audio Library</b>\n\n${audioList}`,
 cp_127: '⏳ Downloading and saving audio...',
 cp_128: 'Please envoyer an audio file (MP3, WAV, OGG) or a voice message.',
 cp_129: 'Envoyer me an audio file or voice message:',
 cp_13: '🎵 <b>Audio Library</b>\\n\\nYou have no saved audio files.\\n\\nUpload an audio file (MP3, WAV, OGG) to use in SVI campagnes.',
 cp_130: (name) => `✅ Audio saved as: <b>${name}</b>\n\nYou can now use it in Bulk SVI Campaigns!`,
 cp_131: 'Please select a caller ID from the list.',
 cp_132: (phoneNumber) => `📱 ID Appelant: <b>${phoneNumber}</b>\n\n📋 <b>Télécharger Leads File</b>\n\nSend a text file (.txt or .csv) with one numéro de téléphone per line.\nOptional: <code>number,name</code> per line.\n\nOr paste the numéros directly (one per line):`,
 cp_133: 'Sélectionner the ID Appelant:',
 cp_134: (message) => `❌ Échoué to read file: ${message}\n\nTry again or paste numéros directly.`,
 cp_135: 'Please envoyer a file or paste phone numéros.',
 cp_136: (errMsg) => `❌ Non valide phone numéros found.${errMsg}\n\nPlease check format: one number per line, with + country code.`,
 cp_137: (maxLeads, length) => `❌ <b>Too many leads!</b>\n\nMaximum <b>${maxLeads}</b> numéros per campagne.\nYou uploaded <b>${length}</b>.\n\nPlease reduce your list and try again.`,
 cp_138: (length, preview, more, errNote, estCost, toFixed) => `✅ <b>${length} leads loaded!</b>\n\n${preview}${more}${errNote}\n\n💰 <b>Estimated cost: $${estCost}</b> ($${toFixed}/min per number, min 1 min each — charged whether answered or not)\n\n🎵 <b>Sélectionner SVI Audio</b>\n\nChoose from your audio library, upload a new recording, or generate from a template with TTS:`,
 cp_139: '📋 Envoyer a leads file or paste numéros:',
 cp_14: (audioList) => `🎵 <b>Audio Library</b>\n\n${audioList}\n\nUpload a new audio or delete an existing one:`,
 cp_140: '🎵 Envoyer an audio file (MP3, WAV, OGG) or voice message:',
 cp_141: '📝 <b>Generate Audio from Modèle</b>\\n\\nChoose a catégorie de modèle, or write your own custom script:',
 cp_142: 'Audio not found. Sélectionner from the list.',
 cp_143: (name) => `🎵 Audio: <b>${name}</b>\n\n📋 <b>Sélectionner Campagne Mode</b>\n\n🔗 <b>Transfert + Report</b> — When lead presses a key, bridge to your phone + always report\n📊 <b>Report Only</b> — Just track who pressed a key, no transfert + always report\n\nBoth modes report full résultats (who pressed, who hung up, etc.)`,
 cp_144: 'Sélectionner an audio file:',
 cp_145: 'Sélectionner SVI Audio:',
 cp_146: '⏳ Saving audio...',
 cp_147: (message) => `❌ Télécharger failed: ${message}`,
 cp_148: 'Envoyer an audio file or voice message:',
 cp_149: (name) => `✅ Saved as: <b>${name}</b>\n\n📋 <b>Sélectionner Campagne Mode</b>\n\n🔗 <b>Transfert + Report</b> — Pressing 1 bridges to your phone\n📊 <b>Report Only</b> — Just track responses\n\nBoth modes always report full résultats.`,
 cp_15: '📞 <b>New SVI Call</b>\\n\\nSelect the number to call FROM (ID Appelant):',
 cp_150: 'Sélectionner SVI Audio:',
 cp_151: '🔗 <b>Transfert Mode</b>\\n\\nEnter the number to transfert calls when lead presses the active key:\\n<i>(Your SIP number or any numéro de téléphone)</i>\\n<i>Exemple: +41791234567</i>',
 cp_152: '📊 <b>Report Only</b> — no transfers, just tracking.\\n\\n🔘 <b>Sélectionner Actif Keys</b>\\n\\nWhich keys should count as a positive response?\\n\\nPick a preset or enter custom digits:',
 cp_153: 'Sélectionner a mode:',
 cp_154: 'Sélectionner Campagne Mode:',
 cp_155: 'Entrez a valide numéro de téléphone with + country code.\\n<i>Exemple: +41791234567</i>',
 cp_156: (clean) => `🔗 Transfert to: <b>${clean}</b>\n\n🔘 <b>Sélectionner Actif Keys</b>\n\nWhich keys trigger the transfert?\n\nPick a preset or enter custom digits:`,
 cp_157: 'Entrez the transfert number:',
 cp_158: 'Sélectionner Campagne Mode:',
 cp_159: 'Entrez the digits that count as active keys:\\n<i>Exemple: 1,3,5 or 1 2 3</i>',
 cp_16: 'Non presets to delete.',
 cp_160: 'Please select a preset or enter digits:',
 cp_161: (join) => `🔘 Touches actives: <b>${join}</b>\n\n⚡ <b>Set Concurrency</b>\n\nHow many simultaneous calls? (1-20)\nDefault: <b>10</b>`,
 cp_162: '🔘 <b>Sélectionner Actif Keys</b>',
 cp_163: 'Entrez at least one digit (0-9):\\n<i>Exemple: 1,3,5</i>',
 cp_164: (join) => `🔘 Touches actives: <b>${join}</b>\n\n⚡ <b>Set Concurrency</b>\n\nHow many simultaneous calls? (1-20)\nDefault: <b>10</b>`,
 cp_165: 'Sélectionner SVI Audio:',
 cp_166: '✍️ <b>Script personnalisé</b>\\n\\nType the message to be spoken.\\nUse "press 1", "press 2" etc. in your text to define active keys.\\n\\n<i>Exemple: Hello, this is a reminder à propos your appointment. Press 1 to confirm or press 2 to reschedule.</i>',
 cp_167: 'Please select a category:',
 cp_168: 'Sélectionnez un modèle:',
 cp_169: 'Choisissez a catégorie de modèle:',
 cp_17: '🗑️ <b>Supprimer Préréglage</b>\\n\\nSelect a preset to delete:',
 cp_170: (icon, firstPh, description, generated) => `${icon} <b>[${firstPh}]</b> — ${description}\n\nAuto-generated: <b>${generated}</b>\nTap to accept, regenerate, or type your own:`,
 cp_171: (icon, firstPh, description) => `${icon} <b>[${firstPh}]</b> — ${description}\n\nSelect from the list or type your own:`,
 cp_172: (icon, firstPh, description, hint) => `${icon} <b>[${firstPh}]</b> — ${description}\n\n${sp.hint || 'Sélectionner or type a number:'}`,
 cp_174: (placeholders) => `Entrez value for <b>[${placeholders}]</b>:`,
 cp_175: (join) => `🔘 Touches actives: <b>${join}</b>\n\n🎙 <b>Sélectionnez le fournisseur de voix</b>\n\nChoose your TTS engine:`,
 cp_176: 'Choisissez a catégorie de modèle:',
 cp_177: 'Please select a template from the buttons.',
 cp_178: (icon, name, text, join) => `📋 <b>${icon} ${name}</b>\n\n<i>"${text}"</i>\n\n🔘 Touches actives: <b>${join}</b>`,
 cp_179: (icon, firstPh, description, generated) => `\n${icon} <b>[${firstPh}]</b> — ${description}\n\nAuto-generated: <b>${generated}</b>\nTap to accept, regenerate, or type your own:`,
 cp_18: (presetName) => `✅ Préréglage "${presetName}" deleted.`,
 cp_180: (icon, firstPh, description) => `\n${icon} <b>[${firstPh}]</b> — ${description}\n\nSelect from the list or type your own:`,
 cp_181: (icon, firstPh, description, hint) => `\n${icon} <b>[${firstPh}]</b> — ${description}\n\n${sp.hint || 'Sélectionner or type a number:'}`,
 cp_183: (placeholders) => `\nEnter value for <b>[${placeholders}]</b>:`,
 cp_184: '🎙 <b>Sélectionner Voix</b>:',
 cp_185: 'Choisissez a catégorie de modèle:',
 cp_186: (icon, currentPh, generated) => `${icon} <b>[${currentPh}]</b> — regenerated: <b>${generated}</b>\nTap to accept, regenerate, or type your own:`,
 cp_187: (currentPh) => `✍️ Tapez your custom value for <b>[${currentPh}]</b>:`,
 cp_188: (currentPh) => `✍️ Tapez the callback number for <b>[${currentPh}]</b>:\n<i>Exemple: +12025551234</i>`,
 cp_189: (currentPh, value, icon, nextPh, description, generated) => `✅ ${currentPh}: <b>${value}</b>\n\n${icon} <b>[${nextPh}]</b> — ${description}\n\nAuto-generated: <b>${generated}</b>\nTap to accept, regenerate, or type your own:`,
 cp_19: 'Préréglage not found.',
 cp_190: (currentPh, value, icon, nextPh, description) => `✅ ${currentPh}: <b>${value}</b>\n\n${icon} <b>[${nextPh}]</b> — ${description}\n\nSelect from the list or type your own:`,
 cp_191: (currentPh, value, icon, nextPh, description, hint) => `✅ ${currentPh}: <b>${value}</b>\n\n${icon} <b>[${nextPh}]</b> — ${description}\n\n${nextSp.hint || 'Sélectionner or type a number:'}`,
 cp_193: (currentPh, value, nextPh) => `✅ ${currentPh}: <b>${value}</b>\n\nEnter value for <b>[${nextPh}]</b>:`,
 cp_194: '✅ All values filled!\\n\\n🎙 <b>Sélectionnez le fournisseur de voix</b>\\n\\nChoose your TTS engine:',
 cp_195: 'Choisissez a catégorie de modèle:',
 cp_196: 'Please select a voice provider:',
 cp_197: '🎙 <b>Sélectionner Voix</b>:',
 cp_198: '🎙 <b>Sélectionnez le fournisseur de voix</b>\\n\\nChoose your TTS engine:',
 cp_199: 'Please select a voice:',
 cp_2: (toLocaleString) => `⚠️ Le dépôt minimum est de ₦${toLocaleString} (≈ $10 USD). Veuillez entrer un montant plus élevé.`,
 cp_20: (presetName, currentPlan) => `🔒 <b>Préréglage "${presetName}" uses OTP Collection</b>, which requires the <b>Business</b> forfait.\n\nYour current forfait: <b>${currentPlan}</b>\n\nUpgrade via 🔄 Renouveler / Change Forfait, or create a new call with 🔗 Transfert mode.`,
 cp_200: (name) => `🎤 Voix: <b>${name}</b>\n\n🎚 <b>Sélectionnez la vitesse de parole</b>\n\nChoose how fast the voice speaks:`,
 cp_201: '🎙 <b>Sélectionnez le fournisseur de voix</b>\\n\\nChoose your TTS engine:',
 cp_202: '✍️ Entrez a custom speed multiplier:\\n<i>Examples: 0.6 (very slow), 0.9 (slightly slow), 1.2 (faster), 1.5 (very fast)\\nRange: 0.25 to 4.0</i>',
 cp_203: '🎚 <b>Sélectionnez la vitesse de parole</b>:',
 cp_204: '❌ Vitesse invalide. Entrez a number between <b>0.25</b> and <b>4.0</b>:\\n<i>Exemple: 0.8 or 1.3</i>',
 cp_205: 'Please select a speed from the buttons:',
 cp_206: (voiceName, speedLabel) => `🎤 Voix: <b>${voiceName}</b> | 🎚 Vitesse: <b>${speedLabel}</b>\n\n⏳ Génération en cours audio...`,
 cp_207: (message) => `❌ Échec de la génération audio.\n\n💡 <b>Tip:</b> Try selecting <b>ElevenLabs</b> as the voice provider — it tends to be more reliable.\n\n<i>Erreur: ${message}</i>`,
 cp_208: 'Choisissez a catégorie de modèle:',
 cp_209: '🎙 <b>Sélectionnez le fournisseur de voix</b>\\n\\nChoose your TTS engine:',
 cp_21: (presetName, callerId, templateName, voiceName) => `💾 <b>Préréglage chargé: ${presetName}</b>\n📱 From: ${callerId}\n🏢 Modèle: ${templateName}\n🎙 Voix: ${voiceName}\n\nEnter the number to call (or multiple separated by commas):\n<i>Exemple: +12025551234</i>\n<i>Lot: +12025551234, +12025555678</i>`,
 cp_210: '🎚 <b>Sélectionnez la vitesse de parole</b>\\n\\nChoose how fast the voice speaks:',
 cp_211: '❌ Non audio generated. Try again.',
 cp_212: (audioName, join) => `✅ Audio saved: <b>${audioName}</b>\n🔘 Touches actives (from template): <b>${join}</b>\n\n📋 <b>Sélectionner Campagne Mode</b>\n\n🔗 <b>Transfert + Report</b> — When lead presses a key, bridge to your phone + always report\n📊 <b>Report Only</b> — Just track who pressed a key, no transfert + always report`,
 cp_213: 'Tap <b>✅ Use This Audio</b> or <b>🎤 Change Voix</b>.',
 cp_214: '🔘 <b>Sélectionner Actif Keys</b>',
 cp_215: 'Entrez a number between 1 and 20:',
 cp_216: 'Set concurrency (1-20):',
 cp_217: '❌ Missing campagne data. Please start over.',
 cp_218: '⏳ Creating campagne...',
 cp_219: (errorvoice) => `❌ Échoué to start: ${errorvoice}`,
 cp_22: 'Non eligible caller ID found.',
 cp_220: 'Campagne is running! You\'ll see progress updates here.',
 cp_221: (messagevoice) => `❌ Campagne launch failed: ${messagevoice}`,
 cp_222: 'Tap 🚀 Launch Campagne or ↩️ Retour.',
 cp_223: 'Tap for options:',
 cp_224: 'Campagne in progress. Use the button below:',
 cp_225: '🛒 <b>Sélectionner Forfait:</b>',
 cp_226: '🌍 <b>All Available Countries</b>\\n\\nSelect a country:',
 cp_227: (location, numberLines) => `📱 <b>Available Numbers — ${location}</b>\n\n${numberLines}\n\n☎️ = Supports Bulk SVI Campaigns\n\nTap a number to select:`,
 cp_228: (message, numberLines) => `📱 <b>Available Numbers — ${message}</b>\n\n${numberLines}\n\n☎️ = Supports Bulk SVI Campaigns\n\nTap a number to select:`,
 cp_229: (areaCode, numberLines) => `📱 <b>Available Numbers — Area ${areaCode}</b>\n\n${numberLines}\n\n☎️ = Supports Bulk SVI Campaigns\n\nTap a number to select:`,
 cp_23: (phoneNumber, recentNumber) => `📱 From: <b>${phoneNumber}</b>\n📞 To: <b>${recentNumber}</b>\n\nChoose an SVI catégorie de modèle:`,
 cp_230: (location, numberLines) => `📱 <b>More Numbers — ${location}</b>\n\n${numberLines}\n\n☎️ = Supports Bulk SVI Campaigns\n\nTap a number to select:`,
 cp_231: 'This forfait is not yet available. Please choose from the available plans below.',
 cp_232: (planLabel) => `✅ Forfait: <b>${planLabel}</b>\n\n🌍 Sélectionner a country:`,
 cp_233: '⚠️ Payment processing temporarily unavailable (service de taux de change en panne). Veuillez réessayer plus tard or use crypto.',
 cp_234: (toLocaleString) => `SVI Cloud ₦${toLocaleString}`,
 cp_235: '⚠️ Upgrade session expired. Please start again.',
 cp_236: '⚠️ Payment processing temporarily unavailable (service de taux de change en panne). Veuillez réessayer plus tard or use crypto.',
 cp_237: (toLocaleString) => `Forfait Upgrade ₦${toLocaleString}`,
 cp_238: '⚠️ Upgrade session expired. Please start again.',
 cp_239: '⚠️ Non rejected verification found. Please start a new number purchase.',
 cp_24: 'Please select a valide number from the list.',
 cp_240: '⚠️ Non rejected verification found.',
 cp_243: '⬇️ Please choose an option below:',
 cp_244: '⚠️ Please enter at least: <code>Street, City, Country</code>\\n\\nExample: <i>123 Main St, Sydney, Australia</i>',
 cp_245: (countryName, toFixed, showWallet) => `❌ Regulatory setup failed for ${countryName}.\n\n💰 <b>$${toFixed}</b> refunded.\n${showWallet}`,
 cp_246: (toFixed, showWallet) => `❌ Regulatory setup failed.\n\n💰 <b>$${toFixed}</b> refunded.\n${showWallet}`,
 cp_247: (toFixed, showWallet) => `❌ Regulatory setup failed.\n\n💰 <b>$${toFixed}</b> refunded.\n${showWallet}`,
 cp_248: (showWallet) => `❌ Regulatory setup failed.\n\n💰 Your portefeuille has been refunded.\n${showWallet}`,
 cp_249: '💡 <b>Get the most out of your number</b>\\n\\n📲 <b>Set up call forwarding</b> — ring your real phone\\n🤖 <b>Add SVI greeting</b> — professional auto-attendant\\n💬 <b>Activer SMS</b> — envoyer & receive text messages\\n\\nTap Manage Numbers below to configure.',
 cp_25: (phoneNumber) => `📱 ID Appelant: <b>${phoneNumber}</b>\n\nEnter the numéro de téléphone to call (or multiple separated by commas):\n<i>Exemple: +12025551234</i>\n<i>Lot: +12025551234, +12025555678</i>`,
 cp_250: '⚠️ Payment processing temporarily unavailable (service de taux de change en panne). Veuillez réessayer plus tard or use crypto.',
 cp_251: (label, toLocaleString) => `${label} ₦${toLocaleString}`,
 cp_252: (numLines) => `📱 <b>Sélectionner which forfait to add a number to:</b>\n\n${numLines}`,
 cp_253: (selectedNumber) => `✅ <b>Great news! Your bundle has been approved!</b>\n\n🔄 We're activating your number <code>${selectedNumber}</code> now...`,
 cp_254: '⚠️ Could not refresh statut. Veuillez réessayer.',
 cp_255: '⚠️ This commande cannot be cancelled — it\'s already being processed or completed.',
 cp_256: (selectedNumber, toFixed, showWallet) => `✅ <b>Order Annulé</b>\n\nYour pending commande for <code>${selectedNumber}</code> has been cancelled.\n\n💰 <b>$${toFixed}</b> has been refunded to your portefeuille.\n${showWallet}`,
 cp_257: '⚠️ Could not cancel commande. Please contact support.',
 cp_258: 'Please choose an option:',
 cp_259: '🌍 <b>All Available Countries</b>\\n\\nSelect a country:',
 cp_26: '📢 <b>Appel SVI Rapide</b>\\n\\nCall a single number with an message SVI automatisé.\\n\\nSelect the number to call FROM (ID Appelant):',
 cp_260: (subNumbersAvailable, numberLines, bulkIvrSupport, tapToSelect) => `${subNumbersAvailable}\n\n${numberLines}\n\n${bulkIvrSupport}\n\n${tapToSelect}`,
 cp_261: (subNumberSelected, numberLines, bulkIvrSupport, tapToSelect) => `${subNumberSelected}\n\n${numberLines}\n\n${bulkIvrSupport}\n\n${tapToSelect}`,
 cp_262: (subNumberArea, numberLines, bulkIvrSupport, tapToSelect) => `${subNumberArea}\n\n${numberLines}\n\n${bulkIvrSupport}\n\n${tapToSelect}`,
 cp_263: (numberLines) => `📱 <b>More Numbers</b>\n\n${numberLines}\n\n☎️ = Supports Bulk SVI\n\nTap to select:`,
 cp_264: (newState, v1) => `🎵 Hold Music: <b>${newState}</b>\n${v1}`,
 cp_265: 'Entrez a valide URL starting with http:// or https://.',
 cp_266: '📝 Tapez the greeting callers will hear:',
 cp_267: '🎙️ Envoyer a voice message or audio file.',
 cp_268: '✅ Audio received. Enregistrer as greeting?',
 cp_269: '🎤 <b>Custom Message d\'accueil</b>\\n\\nChoose how to create your greeting:',
 cp_27: 'Please enter a valide numéro de téléphone starting with + and 10-15 digits.\\n<i>Exemple: +12025551234</i>\\n<i>Lot: +12025551234, +12025555678</i>',
 cp_270: (message) => `📋 <b>${message}</b>\n\nSelect a greeting template:`,
 cp_271: (icon, name, text) => `📋 <b>${icon} ${name}</b>\n\n<code>${text}</code>\n\n✏️ You can edit this text — just type your modified version below.\nOr tap <b>✅ Use As-Is</b> to proceed with this greeting.`,
 cp_272: '📋 <b>Message d\'accueil Templates</b>\\n\\nSelect a category:',
 cp_273: '🌐 Sélectionner the language for your voicemail greeting:\\n\\n<i>The template will be automatically translated to your chosen language.</i>',
 cp_274: '✅ Text updated.\\n\\n🌐 Sélectionner the language for your voicemail greeting:\\n\\n<i>The greeting will be automatically translated to your chosen language.</i>',
 cp_275: '🎤 <b>Custom Message d\'accueil</b>\\n\\nChoose:',
 cp_276: '🔄 Génération de l\'aperçu audio...',
 cp_277: (voice) => `✅ Preview (${voice})\n\nSave this greeting?`,
 cp_278: (message) => `❌ Échec de la génération audio: ${message}`,
 cp_279: (translatedText) => `🌐 <b>Translated greeting:</b>\n\n<i>${brouillon.translatedText.length > 300 ? brouillon.translatedText.slice(0, 300) + '...' : brouillon.translatedText}</i>\n\n🎙️ Choisissez a voice:`,
 cp_280: '🎙️ Choisissez a voice:',
 cp_281: '🎙 Sélectionner a voice provider:',
 cp_282: (message) => `🌐 Translating to ${message}...`,
 cp_283: '🎙 <b>Sélectionnez le fournisseur de voix</b>\\n\\nChoose your TTS engine:',
 cp_284: '🌐 Sélectionner the language for your greeting:',
 cp_285: '📝 Tapez the greeting text:',
 cp_286: (message) => `🌐 Sélectionner the language for your greeting:\n\n<i>"${message}"</i>`,
 cp_287: '🎙 <b>Sélectionnez le fournisseur de voix</b>\\n\\nChoose your TTS engine:',
 cp_288: '🌐 Sélectionner the language for your greeting:',
 cp_289: '📝 Tapez the greeting text:',
 cp_29: '🔍 Looking up number...',
 cp_290: '🎙️ Envoyer a voice message or audio file.',
 cp_291: '✅ Audio received. Enregistrer?',
 cp_292: '✅ Messagerie Vocale greeting saved!',
 cp_293: '🎤 <b>Set SVI Message d\'accueil</b>\\n\\nChoose how to create your greeting:',
 cp_294: (usedKeys) => `➕ <b>Add Menu Option</b>\n\nUsed keys: ${usedKeys}\n\nEnter the key number (0-9) for this option:`,
 cp_295: '📝 Tapez the greeting callers will hear.\\n\\n<i>Exemple: "Thank you for calling Nomadly. Press 1 for sales, press 2 for support."</i>',
 cp_296: '🎙️ Envoyer a voice message or audio file for your SVI greeting.',
 cp_297: '📋 <b>Message d\'accueil Templates</b>\\n\\nProfessional templates for financial institutions — fraud hotlines, customer support, after-heures, and more. Sélectionner a category:',
 cp_298: 'Choisissez an option:',
 cp_299: '🎤 <b>Set SVI Message d\'accueil</b>\\n\\nChoose how to create your greeting:',
 cp_3: '🛡️🔥 L\'hébergement Anti-Red est actuellement indisponible. Veuillez appuyer sur <b>💬 Obtenir de l\'aide</b> sur le clavier pour nous contacter.',
 cp_30: (titleCase) => `📋 Found: <b>${titleCase}</b>`,
 cp_300: (message) => `📋 <b>${message}</b>\n\nSelect a greeting template:`,
 cp_301: (icon, name, text) => `📋 <b>${icon} ${name}</b>\n\n<code>${text}</code>\n\n✏️ You can edit this text — just type your modified version below.\nOr tap <b>✅ Use As-Is</b> to proceed with this greeting.`,
 cp_302: '📋 <b>Message d\'accueil Templates</b>\\n\\nSelect a category:',
 cp_303: '🌐 Sélectionner the language for your SVI greeting:\\n\\n<i>The template will be automatically translated to your chosen language.</i>',
 cp_304: '✅ Text updated.\\n\\n🌐 Sélectionner the language for your SVI greeting:\\n\\n<i>The greeting will be automatically translated to your chosen language.</i>',
 cp_305: '🎤 <b>Set SVI Message d\'accueil</b>\\n\\nChoose how to create your greeting:',
 cp_306: '🔄 Génération de l\'aperçu audio...',
 cp_307: (voice) => `✅ Preview generated (${voice})\n\n✅ Enregistrer this greeting?\n🔄 Try a different voice?\n📝 Re-type the text?`,
 cp_308: (message) => `❌ Échec de la génération audio: ${message}\n\nTry again or upload your own audio.`,
 cp_309: (translatedText) => `🌐 <b>Translated greeting:</b>\n\n<i>${brouillon.translatedText.length > 300 ? brouillon.translatedText.slice(0, 300) + '...' : brouillon.translatedText}</i>\n\n🎙️ Choisissez a voice:`,
 cp_31: '⏳ Regenerating audio for preset (previous audio expired)...',
 cp_310: '🎙️ Choisissez a voice for your greeting:',
 cp_311: '🎙 Sélectionner a voice provider:',
 cp_312: (message) => `🌐 Translating to ${message}...`,
 cp_313: '🎙 <b>Sélectionnez le fournisseur de voix</b>\\n\\nChoose your TTS engine:',
 cp_314: '🌐 Sélectionner the language for your SVI greeting:',
 cp_315: '📝 Tapez the greeting callers will hear:',
 cp_316: (message) => `🌐 Sélectionner the language for your SVI greeting:\n\n<i>"${message}"</i>`,
 cp_317: '✅ Audio received. Enregistrer as your SVI greeting?',
 cp_318: '❌ Échoué to process audio. Try again.',
 cp_319: '🎙️ Envoyer a voice message or audio file.',
 cp_32: '⚠️ Audio regeneration failed. Please set up the call manually.',
 cp_320: '🎙 <b>Sélectionnez le fournisseur de voix</b>\\n\\nChoose your TTS engine:',
 cp_321: '🌐 Sélectionner the language for your SVI greeting:',
 cp_322: '📝 Tapez the greeting callers will hear:',
 cp_323: '🎙️ Envoyer a voice message or audio file.',
 cp_324: '✅ SVI greeting saved!',
 cp_325: '✅ Audio received. Enregistrer as your SVI greeting?',
 cp_326: '❌ Échoué to process audio. Try again.',
 cp_327: 'Choisissez an option:',
 cp_328: (key) => `What should happen when a caller presses <b>${key}</b>?`,
 cp_329: (message) => `📋 <b>${message}</b>\n\nSelect a template:`,
 cp_33: '⚠️ Préréglage audio expired and can\'t be regenerated. Please set up the call manually.',
 cp_330: '📋 Sélectionner a category:',
 cp_331: (icon, name, text) => `📋 <b>${icon} ${name}</b>\n\n<code>${text}</code>\n\n({ en: "✏️ Tapez your modified version, or tap <b>✅ Use As-Is</b>", fr: "✏️ Tapez votre version modifiée, ou appuyez sur <b>✅ Utiliser tel quel</b>", zh: "✏️ 输入修改版本，或点击 <b>✅ 直接使用</b>", hi: "✏️ अपना संशोधित संस्करण टाइप करें, या <b>✅ जैसा है</b> दबाएं" }[lang] || "✏️ Tapez your modified version, or tap <b>✅ Use As-Is</b>"):`,
 cp_332: '🌐 Sélectionner the language:\\n\\n<i>The message will be translated automatically.</i>',
 cp_333: '🎙️ Envoyer a voice message or audio file:',
 cp_334: (message) => `🌐 Sélectionner the language:\n\n<i>"${message}"</i>`,
 cp_335: (text) => `📋 <b>Message</b>\n\n<code>${brouillon.text}</code>\n\n({ en: "✏️ Tapez your modified version, or tap <b>✅ Use As-Is</b>", fr: "✏️ Tapez votre version modifiée, ou appuyez sur <b>✅ Utiliser tel quel</b>", zh: "✏️ 输入修改版本，或点击 <b>✅ 直接使用</b>", hi: "✏️ अपना संशोधित संस्करण टाइप करें, या <b>✅ जैसा है</b> दबाएं" }[lang] || "✏️ Tapez your modified version, or tap <b>✅ Use As-Is</b>"):`,
 cp_336: '🔄 Génération de l\'aperçu audio...',
 cp_337: (key, voice) => `✅ Preview for key <b>${brouillon.key}</b> (${voice})\n\nSave this option?`,
 cp_338: (message) => `❌ Échec de la génération audio: ${message}`,
 cp_339: (translatedText) => `🌐 <b>Translated:</b>\n\n<i>${brouillon.translatedText.length > 300 ? brouillon.translatedText.slice(0, 300) + '...' : brouillon.translatedText}</i>\n\n🎙️ Choisissez a voice:`,
 cp_34: '💾 <b>Préréglage loaded — Ready to call!</b>\\n\\nPress <b>/yes</b> to call or <b>/cancel</b> to abort.',
 cp_340: '🎙️ Choisissez a voice:',
 cp_341: '🎙 Sélectionner a voice provider:',
 cp_342: (message) => `🌐 Translating to ${message}...`,
 cp_343: '🎙 <b>Sélectionnez le fournisseur de voix</b>\\n\\nChoose your TTS engine:',
 cp_344: '🌐 Sélectionner the language:',
 cp_345: '🎙 <b>Sélectionnez le fournisseur de voix</b>\\n\\nChoose your TTS engine:',
 cp_346: '🌐 Sélectionner the language:',
 cp_347: '📝 Tapez the message:',
 cp_348: '🎙️ Envoyer a voice message or audio file:',
 cp_35: (templateName, callerId, voiceName, join) => `💾 <b>Préréglage chargé: ${templateName}</b>\n📱 From: ${callerId}\n🎙 Voix: ${voiceName}\n🔘 Touches actives: <b>${join}</b>`,
 cp_36: (icon, firstPh, description, generated) => `\n${icon} <b>[${firstPh}]</b> — ${description}\n\nAuto-generated: <b>${generated}</b>\nTap to accept, regenerate, or type your own:`,
 cp_37: (icon, firstPh, description) => `\n${icon} <b>[${firstPh}]</b> — ${description}\n\nSelect from the list or type your own:`,
 cp_38: (icon, firstPh, description, hint) => `\n${icon} <b>[${firstPh}]</b> — ${description}\n\n${sp.hint || 'Sélectionner or type a number:'}`,
 cp_4: (SUPPORT_USERNAME) => `📞 SVI Cloud is coming soon! Contact ${SUPPORT_USERNAME} for updates.`,
 cp_40: (firstPh) => `\nEnter value for <b>[${firstPh}]</b>:`,
 cp_41: '📋 <b>Sélectionner Call Mode</b>\\n\\n🔗 <b>Transfert</b> — When target presses the key, bridge them to your number\\n🔑 <b>OTP Collection</b> — Prompt target for a code, you verify via Telegram\\n\\nBoth modes report full résultats.',
 cp_42: 'Entrez le numéro de téléphone à appeler (avec l\'indicatif pays):\\n<i>Exemple: +12025551234</i>',
 cp_43: '✍️ <b>Script personnalisé</b>\\n\\nType your SVI message. Use <b>[Brackets]</b> for variables:\\n\\n<b>Standard:</b> [Name], [Company], [Bank], [Montant]\\n<b>Smart (auto-fill):</b> [CardLast4], [CaseID], [ReferenceNum]\\n<b>Smart (pick):</b> [Reason], [Emplacement], [CallBack]\\n\\n<i>Exemple: Hello [Name]. This is [Bank] security. A charge of $[Montant] was made on card ending [CardLast4]. Case [CaseID]. Press 1 to dispute.</i>\\n\\nType your script:',
 cp_44: 'Sélectionnez un modèle:',
 cp_45: 'Please select a category from the buttons.',
 cp_46: '✍️ <b>Script personnalisé</b>\\n\\nType your SVI message. Use <b>[Brackets]</b> for variables:\\n\\n<b>Standard:</b> [Name], [Company], [Bank], [Montant]\\n<b>Smart (auto-fill):</b> [CardLast4], [CaseID], [ReferenceNum]\\n<b>Smart (pick):</b> [Reason], [Emplacement], [CallBack]\\n\\n<i>Exemple: Hello [Name]. This is [Bank] security. A charge of $[Montant] was made on card ending [CardLast4]. Case [CaseID]. Press 1 to dispute.</i>\\n\\nType your script:',
 cp_47: '📋 <b>Complete Placeholder Reference</b>\\n\\n<b>🔤 Standard (you type the value):</b>\\n• <code>[Name]</code> — Recipient\'s name\\n• <code>[Bank]</code> — Bank or institution name\\n• <code>[Company]</code> — Company or merchant name\\n• <code>[Montant]</code> — Dollar montant\\n\\n<b>🤖 Smart Auto-Fill (generated for you):</b>\\n• <code>[CardLast4]</code> — Random 4-digit card number\\n• <code>[CaseID]</code> — Random case/reference ID\\n• <code>[ReferenceNum]</code> — Random reference number\\n\\n<b>📋 Smart Pick (choose from presets):</b>\\n• <code>[Reason]</code> — fraud alert, account suspension, unusual activity, etc.\\n• <code>[Emplacement]</code> — City, State format (you type)\\n• <code>[CallBack]</code> — Your Nomadly numéro de téléphone\\n\\n<b>💡 Tips:</b>\\n• Mix standard + smart placeholders freely\\n• Placeholders are case-sensitive: <code>[Bank]</code> not <code>[bank]</code>\\n• Include "press 1" in your script to auto-detect active keys\\n\\nNow type your script:',
 cp_48: (keyNote) => `${keyNote}\n\nTap <b>✅ Continue</b> to keep these keys, or type new ones:\n<i>Exemple: 1,2,3 or 1,5,9</i>`,
 cp_49: 'Tapez your custom SVI script:',
 cp_5: '⚠️ Session expirée. Please try purchasing again.',
 cp_50: 'Veuillez entrer au moins un chiffre (0-9):\\n<i>Exemple: 1,2,3</i>',
 cp_51: (join) => `🔘 Touches actives mises à jour: <b>${join}</b>`,
 cp_52: (icon, firstPh, description, generated) => `${icon} <b>[${firstPh}]</b> — ${description}\n\nAuto-generated: <b>${generated}</b>\nTap to accept, regenerate, or type your own:`,
 cp_53: (icon, firstPh, description) => `${icon} <b>[${firstPh}]</b> — ${description}\n\nSelect from the list or type your own:`,
 cp_54: (icon, firstPh, description, hint) => `${icon} <b>[${firstPh}]</b> — ${description}\n\n${sp.hint || 'Sélectionner or type a number:'}`,
 cp_56: (firstPh) => `Entrez value for <b>[${firstPh}]</b>:`,
 cp_57: '📋 <b>Sélectionner Call Mode</b>\\n\\n🔗 <b>Transfert</b> — When target presses the key, bridge them to your number\\n🔑 <b>OTP Collection</b> — Prompt target for a code, you verify via Telegram\\n\\nBoth modes report full résultats.',
 cp_58: 'Please select a template from the buttons.',
 cp_59: (icon, name, text, join) => `📋 <b>${icon} ${name}</b>\n\n<i>"${text}"</i>\n\n🔘 Touches actives: <b>${join}</b>`,
 cp_6: '⚠️ Session expirée. Please try purchasing again.',
 cp_60: (icon, firstPh, description, generated) => `\n${icon} <b>[${firstPh}]</b> — ${description}\n\nAuto-generated: <b>${generated}</b>\nTap to accept, regenerate, or type your own:`,
 cp_61: (icon, firstPh, description) => `\n${icon} <b>[${firstPh}]</b> — ${description}\n\nSelect from the list or type your own:`,
 cp_62: (icon, firstPh, description, hint) => `\n${icon} <b>[${firstPh}]</b> — ${description}\n\n${sp.hint || 'Sélectionner or type a number:'}`,
 cp_64: (firstPh) => `\nEnter value for <b>[${firstPh}]</b>:`,
 cp_65: '📋 <b>Sélectionner Call Mode</b>\\n\\n🔗 <b>Transfert</b> — When target presses the key, bridge them to your number\\n🔑 <b>OTP Collection</b> — Prompt target for a code, you verify via Telegram\\n\\nBoth modes report full résultats.',
 cp_66: (icon, currentPh, generated) => `${icon} <b>[${currentPh}]</b> — regenerated: <b>${generated}</b>\nTap to accept, regenerate, or type your own:`,
 cp_67: (currentPh) => `✍️ Tapez your custom value for <b>[${currentPh}]</b>:`,
 cp_68: (currentPh) => `✍️ Tapez the callback number for <b>[${currentPh}]</b>:\n<i>Exemple: +12025551234</i>`,
 cp_69: (currentPh, value, icon, nextPh, description, generated) => `✅ ${currentPh}: <b>${value}</b>\n\n${icon} <b>[${nextPh}]</b> — ${description}\n\nAuto-generated: <b>${generated}</b>\nTap to accept, regenerate, or type your own:`,
 cp_7: '⚠️ Non pending session found.',
 cp_70: (currentPh, value, icon, nextPh, description) => `✅ ${currentPh}: <b>${value}</b>\n\n${icon} <b>[${nextPh}]</b> — ${description}\n\nSelect from the list or type your own:`,
 cp_71: (currentPh, value, icon, nextPh, description, hint) => `✅ ${currentPh}: <b>${value}</b>\n\n${icon} <b>[${nextPh}]</b> — ${description}\n\n${nextSp.hint || 'Sélectionner or type a number:'}`,
 cp_73: (currentPh, value, nextPh) => `✅ ${currentPh}: <b>${value}</b>\n\nEnter value for <b>[${nextPh}]</b>:`,
 cp_74: '✅ All values set!\\n\\n📋 <b>Sélectionner Call Mode</b>\\n\\n🔗 <b>Transfert</b> — When target presses the key, bridge them to your number\\n🔑 <b>OTP Collection</b> — Prompt target for a code, you verify via Telegram\\n\\nBoth modes report full résultats.',
 cp_75: '🔗 <b>Transfert Mode</b>\\n\\nEnter the number to transfert the caller to when they press a key:\\n<i>Exemple: +17174794833</i>',
 cp_76: '🔒 <b>OTP Collection</b> is not available on the gratuit trial.\\n\\nSubscribe to a <b>Pro</b> or <b>Business</b> forfait to use OTP Collection.\\n\\nYou can still use <b>🔗 Transfert</b> mode for your trial call.',
 cp_77: '🔑 <b>OTP Collection Mode</b>\\n\\nHow many digits should the code be?\\n\\n<i>Default: 6 digits</i>',
 cp_78: 'Sélectionner a mode:',
 cp_79: '📋 <b>Sélectionner Call Mode</b>\\n\\n🔗 <b>Transfert</b> — When target presses the key, bridge them to your number\\n🔑 <b>OTP Collection</b> — Prompt target for a code, you verify via Telegram\\n\\nBoth modes report full résultats.',
 cp_8: (buyPlansHeader, price, minutes, sms, starter, v5, v6, v7, pro, v9, v10, v11, business) => `${buyPlansHeader}\n\n💡 <b>Débutant</b> — $${price}/mo (${minutes} min + ${sms} SMS)\n   • Call forwarding to any number\n   • SMS forwarded to Telegram\n   • Up to ${starter} extra numéros\n\n⭐ <b>Pro</b> — $${v5}/mo (${v6} min + ${v7} SMS)\n   • All Débutant features\n   • Messagerie Vocale with custom greetings\n   • SIP identifiants for softphones\n   • SMS to Telegram & Email\n   • Webhook integrations\n   • Appel SVI Rapide (single number)\n   • Campagne SVI en masse\n   • Up to ${pro} extra numéros\n\n👑 <b>Business</b> — $${v9}/mo (${v10} min + ${v11} SMS)\n   • All Pro features\n   • Enregistrement d'appel & Analytics\n   • OTP Collection via SVI\n   • SVI Standard Automatique (inbound calls)\n   • Quick SVI Presets & Recent Calls\n   • SVI Redial Button\n   • Call Scheduling\n   • Custom OTP Messages & Goodbye\n   • Consistent TTS Voix/Vitesse\n   • Priority Support\n   • Up to ${business} extra numéros`,
 cp_80: 'Entrez a valide digit count (1-10):',
 cp_81: (length) => `✅ OTP length: <b>${length} digits</b> (max 3 attempts)\n\n✍️ <b>Customize Caller Messages</b>\n\nWould you like to customize what callers hear after verification?\n\n<b>Default Confirmer:</b> <i>"Your code has been verified successfully. Thank you. Goodbye."</i>\n<b>Default Reject:</b> <i>"Maximum verification attempts reached. Goodbye."</i>`,
 cp_82: (length) => `✅ OTP length: <b>${length} digits</b> (max 3 attempts)\n\n🎙 <b>Sélectionnez le fournisseur de voix</b>\n\nChoose your TTS engine:`,
 cp_83: '🔑 <b>OTP Collection Mode</b>\\n\\nHow many digits should the code be?\\n\\n<i>Default: 6 digits</i>',
 cp_84: '🎙 <b>Sélectionnez le fournisseur de voix</b>\\n\\nChoose your TTS engine:',
 cp_85: '✅ <b>Confirmation Message</b>\\n\\nType what the caller hears when you <b>CONFIRM</b> their code:\\n\\n<i>Exemple: "Your code has been verified. We\'ve blocked the transaction and secured your account. A specialist will contact you within 24 heures. Thank you for choosing our bank. Goodbye."</i>',
 cp_86: 'Choisissez an option:',
 cp_87: '✍️ <b>Customize Caller Messages</b>\\n\\nWould you like to customize what callers hear after verification?',
 cp_88: '❌ <b>Rejection Message</b>\\n\\nType what the caller hears when you <b>REJECT</b> their code (max attempts reached):\\n\\n<i>Exemple: "We were unable to verify your identity. For your security, this session has ended. Please call back or visit your nearest branch for assistance. Goodbye."</i>',
 cp_89: '✅ <b>Confirmation Message</b>\\n\\nType what the caller hears when you <b>CONFIRM</b> their code:',
 cp_9: (buyLabel) => `📢 <b>Appel SVI Rapide</b>\n\nYou've already used your appel d'essai gratuit.\n\nSubscribe to SVI Cloud to make unlimited SVI calls with your own ID Appelant!\n\nTap <b>${buyLabel}</b> to get started.`,
 cp_90: '✅ Custom messages saved!\\n\\n🎙 <b>Sélectionnez le fournisseur de voix</b>\\n\\nChoose your TTS engine:',
 cp_91: 'Please enter a valide numéro de téléphone starting with +.\\n<i>Exemple: +17174794833</i>',
 cp_92: '🎙 <b>Sélectionnez le fournisseur de voix</b>\\n\\nChoose your TTS engine:',
 cp_93: 'Entrez the number to transfert the caller to when they press a key:\\n<i>Exemple: +17174794833</i>',
 cp_94: 'Please select a voice provider:',
 cp_95: '🎤 <b>Sélectionner Voix</b>\\n\\nChoose a voice for the SVI audio:',
 cp_96: '🎙 <b>Sélectionnez le fournisseur de voix</b>\\n\\nChoose your TTS engine:',
 cp_97: (name) => `🎤 Voix: <b>${name}</b>\n\n🎚 <b>Sélectionnez la vitesse de parole</b>\n\nChoose how fast the voice speaks:`,
 cp_98: '🎙 <b>Sélectionnez le fournisseur de voix</b>\\n\\nChoose your TTS engine:',
 cp_99: '✍️ Entrez a custom speed multiplier:\\n<i>Examples: 0.6 (very slow), 0.9 (slightly slow), 1.2 (faster), 1.5 (very fast)\\nRange: 0.25 to 4.0</i>',
 dns_1: (domain) => `🔗 Deactivating shortener for <b>${domaine}</b>…`,
 dns_2: (domain) => `✅ Raccourcisseur deactivated for <b>${domaine}</b>.`,
 dns_3: '❌ Could not deactivate shortener. Veuillez réessayer or contact support.',
 dns_4: '🔄 Removing conflicting enregistrement and adding new one...',
 dns_5: 'Invalide format. Use <b>_service._protocol</b> (e.g. _sip._tcp, _http._tcp):',
 dns_6: '⚠️ Please enter a valide USD montant (minimum $10).',
 dom_1: 'You have no registered domains. Please register a new domaine or connect an external domaine.',
 dom_2: '📋 <b>My Hébergement Plans</b>\\n\\nYou have no active hébergement plans. Purchase a forfait to get started!',
 dom_3: (savings, domain, chargeUsd, shownPrice, v4) => `🎉 <b>You saved $${savings}!</b> Domaine <b>${domaine}</b> was registered for <b>$${v4}</b> instead of $${shownPrice}. Only $${chargeUsd} was debited from your portefeuille.`,
 dom_4: (domain, v1) => `💡 <b>What's next with ${domaine}?</b>\n\n🔗 <b>Activate for URL Raccourcisseur</b> — use ${domaine} as your branded short lien\n🌐 <b>Manage DNS</b> — point it to your serveur\n📞 <b>Get a SVI Cloud</b> — pair with a virtual number\n\nTap one of the options below to continue.`,
 dom_5: (domain, domainCost, APP_SUPPORT_LINK) => `Your domaine <b>${info.domaine}</b> has been registered successfully, but hébergement setup failed. Domaine cost ($${domainCost}) has been charged. Please contact support to complete your hébergement setup: ${APP_SUPPORT_LINK}`,
 dom_6: (showWallet) => `❌ Regulatory setup failed.\n\n💰 Your portefeuille has been refunded.\n${showWallet}`,
 dom_7: (requested, delivered, requesteddelivered, toFixed, reasonText, v5) => `💰 <b>Partial Refund</b>\n\n📊 Ordered: ${requested} leads\n✅ Delivered: ${delivered} leads\n❌ Undelivered: ${requesteddelivered} leads\n\n💵 Refund: <b>$${toFixed}</b> returned to your portefeuille\n📝 Reason: ${reasonText}\n\n💰 Portefeuille: $${v5} USD`,
 dom_8: '💡 <b>Maximize your leads</b>\\n\\n📞 <b>Get a SVI Cloud</b> — call these leads with a local number\\n🎯 <b>Buy more leads</b> — target a different area or opérateur\\n🔗 <b>Shorten your links</b> — track your outreach campagnes\\n\\nTap an option below.',
 dom_9: (totalPrice, toFixed) => `❌ Insufficient portefeuille solde. Need $${campagne.totalPrice}, have $${toFixed}.\nDeposit more to your portefeuille and try again.`,
 ev_1: '🚧 Validation d\'email service is currently under maintenance. Veuillez réessayer plus tard.',
 ev_10: (message) => `❌ Erreur: ${message}`,
 ev_11: '❌ Invalide IPv4 format. Envoyer like: <code>1.2.3.4</code>',
 ev_12: (ipInput) => `✅ IP <code>${ipInput}</code> added to pool.`,
 ev_13: (ipInput) => `✅ IP <code>${ipInput}</code> removed from pool.`,
 ev_14: (message) => `❌ Erreur: ${message}`,
 ev_15: '❌ Annulé.',
 ev_16: '❌ Annulé.',
 ev_17: '❌ Please upload a <b>.csv</b> or <b>.txt</b> file.',
 ev_18: (message) => `❌ Échoué to read file: ${message}`,
 ev_19: '📎 Please upload a CSV/TXT file with email addresses.',
 ev_2: '📧 Returning to Validation d\'email menu...',
 ev_20: '❌ Aucune adresse email valide trouvée in the file. Please check the format.',
 ev_21: (minEmails, length) => `❌ Minimum <b>${minEmails}</b> emails required. Found only ${length}.`,
 ev_22: (toLocaleString, v1) => `❌ Maximum <b>${toLocaleString}</b> emails allowed. Found ${v1}.`,
 ev_23: '❌ Annulé.',
 ev_24: '📋 Please paste email addresses (one per line or comma-separated).',
 ev_25: '❌ Aucune adresse email valide trouvée. Please check format.',
 ev_26: (maxPasteEmails, length) => `❌ Paste mode supports up to <b>${maxPasteEmails}</b> emails. Found ${length}. Use file upload for larger lists.`,
 ev_27: (minEmails, length) => `❌ Minimum <b>${minEmails}</b> emails required. Found only ${length}.`,
 ev_28: '❌ Annulé.',
 ev_29: '❌ Session expirée. Please start again.',
 ev_3: '⚠️ Could not reach worker',
 ev_30: '❌ Gratuit trial not available for this list size. Please choose a payment method.',
 ev_31: '❌ Gratuit trial already used. Please choose a payment method.',
 ev_32: '❌ Trial + Pay not available. Please choose a payment method.',
 ev_33: '❌ Gratuit trial already used. Please choose a payment method.',
 ev_34: (toFixed, v1) => `⚠️ Insufficient USD solde for extra emails.\n💰 Need: <b>$${toFixed}</b>\n💳 Have: <b>$${v1}</b>\n\nPlease dépôt more to your portefeuille, or pay full price with NGN.`,
 ev_35: (toFixed, v1) => `⚠️ Insufficient USD solde.\n💰 Need: <b>$${toFixed}</b>\n💳 Have: <b>$${v1}</b>\n\nPlease dépôt more to your portefeuille.`,
 ev_36: (toFixed, toLocaleString) => `✅ <b>Paiement réussi!</b>\n\n💵 Charged: <b>$${toFixed}</b>\n📧 Validating: <b>${toLocaleString} emails</b>\n\n⏳ En cours de traitement will begin shortly. You'll receive progress updates.`,
 ev_37: 'Please choose a payment method:',
 ev_4: (message) => `❌ Erreur: ${message}`,
 ev_5: '⚠️ Non IPs found from cloud provider API or identifiants missing.',
 ev_6: (message) => `❌ Cloud API error: ${message}`,
 ev_7: '➕ <b>Add IP</b>\\n\\nSend me the IPv4 address to add (e.g. <code>1.2.3.4</code>):',
 ev_8: (message) => `❌ Erreur: ${message}`,
 ev_9: '♻️ All IP statistiques de santé réinitialisées to healthy.',
 host_1: '❌ Payment processing error. Please contact support.',
 host_10: (startsWith) => `✅ <b>Lien shortened!</b>\n\n🔗 <code>${startsWith}</code>\n\n📋 Tap to copy`,
 host_11: (startsWith) => `✅ <b>Lien shortened!</b>\n\n🔗 <code>${startsWith}</code>\n\n📋 Tap to copy`,
 host_12: '❌ Erreur creating short lien. Veuillez réessayer.',
 host_13: 'not authorized',
 host_14: 'not authorized',
 host_15: (userToUnblock) => `Utilisateur ${userToUnblock} not found`,
 host_16: (userToUnblock) => `Utilisateur ${userToUnblock} has been unblocked.`,
 host_17: 'not authorized',
 host_18: 'not authorized',
 host_19: (previewText, statsText) => `${previewText}\n\n${statsText}\n\nReady to diffusion?`,
 host_2: 'Hello, Admin! Please select an option:',
 host_20: '🚀 Starting diffusion... This may take a while for large utilisateur bases.',
 host_21: (message) => `❌ Diffusion failed: ${message}`,
 host_22: '📤 Diffusion initiated! You\\\'ll receive progress updates.',
 host_23: (message, plan) => `<b>${message}</b> is already on a ${existingPlan.forfait}. Choisissez a different domaine.`,
 host_24: 'Please select a domaine from the list.',
 host_25: '✅ You are already on the highest forfait (Golden Anti-Red). Non upgrades available.',
 host_26: (toFixed, price) => `⚠️ Solde insuffisant. You have $${toFixed} but need $${price}.`,
 host_27: 'Please select one of the améliorer options.',
 host_28: (toFixed, upgradePrice) => `⚠️ Solde insuffisant. You have $${toFixed} but need $${upgradePrice}.`,
 host_29: (error) => `❌ Upgrade failed: ${error}\nYour portefeuille has been refunded.`,
 host_3: (toFixed, length) => `💰 Auto-refunded <b>$${toFixed}</b> from ${length} rejected verification(s). You can start a fresh purchase anytime.`,
 host_30: '❌ Upgrade failed. Your portefeuille has been refunded. Veuillez réessayer or contact support.',
 host_31: '🚧 VPS service is coming soon! Stay tuned.',
 host_32: '⚠️ Unable to load referral page. Try again later.',
 host_4: (safeHtml) => `${safeHtml}`,
 host_5: (CHAT_BOT_NAME) => `<b>${CHAT_BOT_NAME} Aide</b>\n\n<b>Quick Commands:</b>\n• <code>/shorten URL</code> — Instant short lien\n• <code>/shorten URL alias</code> — Custom alias\n• Just paste any URL — Auto-detect & shorten\n\n<b>Features:</b>\n• URL Raccourcisseur\n• Domaine Names\n• Phone Leads\n• Portefeuille & Payments\n• Web Hébergement\n\nUse the menu below to get started!`,
 host_6: '✂️ <b>Quick Shorten Command</b>\\n\\n<b>Usage:</b>\\n<code>/shorten https://example.com</code> — Random short lien\\n<code>/shorten https://example.com myalias</code> — Custom alias\\n\\nOr just paste any URL and I\'ll offer to shorten it!',
 host_7: '❌ Invalide URL. Please provide a valide URL starting with http:// or https://',
 host_8: (customAlias, preferredDomain) => `❌ Alias <code>${customAlias}</code> is already taken on ${preferredDomain}. Try a different alias.`,
 host_9: (customAlias) => `❌ Alias <code>${customAlias}</code> is already taken. Try a different alias.`,
 ld_1: (toFixed) => `💵 $${toFixed} — `,
 ld_2: '🎯 Sélectionner your target institution.\\nReal, verified leads with phone owner names — matched by opérateur from high-value metro areas:',
 ld_3: '📝 <b>Request Custom Leads</b>\\n\\nTell us the institution or company you want targeted leads for.\\nWe source real, verified numéros with the phone owner\\\'s name — from any metro area you need:',
 sms_1: (toFixed, v1) => `⚠️ <b>Solde insuffisant</b>\n\n💰 Need: <b>$${toFixed}</b>\n👛 Have: <b>$${v1}</b>\n\nPlease top up or choose another payment method.`,
 sms_10: 'not authorized',
 sms_11: 'Backup created successfully.',
 sms_12: 'not authorized',
 sms_13: 'Data restored successfully.',
 sms_14: 'not authorized',
 sms_15: (length, join) => `Users: ${utilisateurs.length}\n${utilisateurs.join('\n')}`,
 sms_16: 'not authorized',
 sms_17: (join) => `Analytics Data:\n${join}`,
 sms_18: 'not authorized',
 sms_19: (totalDead, chatNotFound, userDeactivated, botBlocked, other) => `📊 <b>Dead Users Report</b>\n\nTotal marked dead: <b>${totalDead}</b>\n• chat_not_found: ${chatNotFound}\n• utilisateur_deactivated: ${userDeactivated}\n• bot_blocked: ${botBlocked}\n• other: ${other}\n\n<b>Actions:</b>\n/resetdead all — Clear ALL\n/resetdead blocked — Clear bot_blocked\n/resetdead notfound — Clear chat_not_found`,
 sms_20: 'not authorized',
 sms_21: (WELCOME_BONUS_USD) => `🎁 Starting gift of $${WELCOME_BONUS_USD} to all utilisateurs who haven't received it yet...\nThis may take a while.`,
 sms_22: (gifted, skipped, failed, total) => `✅ <b>Gift Complete!</b>\n\n🎁 Gifted: ${gifted}\n⏭ Skipped (already had): ${skipped}\n❌ Échoué: ${failed}\n📊 Total utilisateurs: ${total}`,
 sms_23: (message) => `❌ Gift failed: ${message}`,
 sms_24: '✅ Non active app sessions found — you can login freely.',
 sms_25: '✅ <b>All devices logged out!</b>\\n\\nYou can now login on a new device.',
 sms_26: (buyPlan) => `❌ <b>Abonnement Required</b>\n\nYou need an active abonnement to create SMS campagnes.\n\nTap <b>${utilisateur.buyPlan}</b> on the main menu to subscribe — plans include unlimited URL shortening, BulkSMS, phone validations, and gratuit domains!`,
 sms_27: (SMS_APP_LINK, chatId) => `📵 <b>Non Actif Device</b>\n\nYou need to activate the Nomadly SMS App on a device before creating campagnes.\n\n1️⃣ Télécharger the app: ${process.env.SMS_APP_LINK || 'See 📲 Télécharger App'}\n2️⃣ Entrez activation code: <code>${chatId}</code>\n3️⃣ Come back here to create campagnes`,
 sms_28: (length) => `📱 <b>Sélectionner Device</b>\n\nYou have ${length} active devices. Choisissez which device will envoyer this campagne:`,
 sms_29: '❌ Please select a device from the buttons below.',
 sms_3: (minAmount, maxAmount) => `Please enter a valide montant between ${minAmount} and ${maxAmount} leads.`,
 sms_30: '❌ Échoué to load campagnes. Veuillez réessayer.',
 sms_31: '❌ Campagne name cannot be empty. Please enter a name:',
 sms_32: '✍️ <b>Campagne Content</b>\\n\\nType your SMS message. Use <code>[name]</code> to personalize with the contact\\\'s name.\\n\\nLine breaks in your message are preserved as spaces.\\n\\nFor <b>message rotation</b> (different message per contact), separate messages with <code>---</code> on its own line:\\n<code>Hi [name], check out our offer!\\n---\\nHey [name], don\\\'t miss this deal!</code>',
 sms_33: '📱 <b>Create SMS Campagne</b>\\n\\nEnter a name for your campagne:',
 sms_34: '❌ Message content cannot be empty. Please type your SMS message:',
 sms_35: '❌ Please enter at least one non-empty message line.',
 sms_36: '❌ Non valide phone numéros found in the file.\\n\\nPlease upload a file with phone numéros (one per line, starting with + and country code).',
 sms_37: (length, length1, smsGapTimePrompt) => `👥 <b>${length} contact${length1} loaded from file!</b>\n\n${smsGapTimePrompt}`,
 sms_38: '❌ Échoué to process file. Veuillez réessayer or envoyer contacts as text.',
 sms_39: '✍️ <b>Campagne Content</b>\\n\\nType your SMS message. Use <code>[name]</code> to personalize.\\nFor rotation, separate messages with <code>---</code> on its own line.',
 sms_4: (domain, plan) => `❌ Cannot activate URL shortener — <b>${domaine}</b> has an active hébergement forfait (<b>${existingHosting.forfait || 'cPanel'}</b>).\n\nThe shortener CNAME would replace your hébergement A records and take your website offline.\n\nPlease use a different domaine, or deactivate your hébergement forfait first.`,
 sms_40: '❌ Please envoyer contacts as text or upload a file.',
 sms_41: '❌ Non valide phone numéros found.\\n\\nPhone numéros must contain at least 7 digits (preferably avec l\'indicatif pays starting with +).\\n\\nExamples:\\n<code>+18189279992, John\\n+14155551234</code>',
 sms_42: (length, length1, warningLine, smsGapTimePrompt) => `👥 <b>${length} contact${length1} loaded!</b>${warningLine}\n\n${smsGapTimePrompt}`,
 sms_43: '📋 <b>Télécharger Contacts</b>\\n\\nSend contacts as text or upload a .txt/.csv file:',
 sms_44: '❌ Please enter a number between 1 and 300 secondes, or tap the button for default.',
 sms_45: (buyPlan) => `❌ <b>Essai Gratuit Exhausted</b>\n\nYou've used all your gratuit SMS. Subscribe to unlock unlimited BulkSMS campagnes!\n\n👉 Tap <b>${utilisateur.buyPlan}</b> to subscribe.`,
 sms_46: (campaignName, length, v2, deviceLine) => `💾 <b>Campagne Saved as Brouillon!</b>\n\n📋 Name: ${campaignName}\n✍️ Messages: ${length}\n👥 Contacts: ${v2}${deviceLine}\n\nYou can edit and envoyer it later from the SMS App or <b>📋 My Campaigns</b>.`,
 sms_47: (campaignName, length, v2, gapTime, deviceLine) => `✅ <b>Campagne Created!</b>\n\n📋 Name: ${campaignName}\n✍️ Messages: ${length}\n👥 Contacts: ${v2}\n⏱ Gap: ${gapTime} sec${deviceLine}\n\nYour campagne will automatically sync and start sending on your connected device.`,
 sms_48: '❌ Échoué to create campagne. Veuillez réessayer.',
 sms_49: '⚠️ Please choose one of the options below:',
 sms_5: (domain, error) => `❌ Could not lien <b>${domaine}</b>: ${error}`,
 sms_50: '❌ Please enter a date and time in format: <code>YYYY-MM-DD HH:MM</code>',
 sms_51: '❌ Invalide date or date is in the past.\\n\\nPlease enter a future date in format: <code>YYYY-MM-DD HH:MM</code>\\n\\nExample: <code>2027-07-15 09:30</code>',
 sms_52: (campaignName, length, v2, gapTime, schedDate, deviceLine) => `✅ <b>Campagne Planifié!</b>\n\n📋 Name: ${campaignName}\n✍️ Messages: ${length}\n👥 Contacts: ${v2}\n⏱ Gap: ${gapTime} sec\n📅 Planifié: ${schedDate} UTC${deviceLine}\n\nThe campagne will automatically sync and start sending at the scheduled time. Make sure your device stays online.`,
 sms_53: '❌ Échoué to create scheduled campagne. Veuillez réessayer.',
 sms_54: (SUPPORT_USERNAME) => `📞 SVI Cloud is coming soon! Contact ${SUPPORT_USERNAME} for updates.`,
 sms_55: '🛡️🔥 L\'hébergement Anti-Red est actuellement indisponible. Veuillez appuyer sur <b>💬 Obtenir de l\'aide</b> sur le clavier pour nous contacter.',
 sms_56: (substring, v1) => `🔗 <b>URL Detected!</b>\n\n<code>${substring}${v1}</code>\n\n⚠️ You have no links restant.\n\n👉 Passer à shorten URLs!`,
 sms_57: (minEmails, length) => `❌ Too few emails. Minimum is <b>${paramètres.minEmails}</b>, you provided <b>${length}</b>.`,
 sms_58: (maxEmails, length) => `❌ Too many emails. Maximum is <b>${paramètres.maxEmails}</b>, you provided <b>${length}</b>.\n\nPlease reduce your list.`,
 sms_59: (length) => `⏳ Validating ${length} emails...\n\nThis may take a moment.`,
 sms_6: (sanitizeProviderError) => `❌ DNS error: ${sanitizeProviderError(saveErr, 'domaine')}`,
 sms_7: (error) => `❌ DNS error: ${sanitizeProviderError(addResult.error || 'Unknown error', 'domaine')}`,
 sms_8: (message) => `❌ Erreur: ${message}`,
 sms_9: (message) => `❌ Erreur: ${message}`,
 util_1: (displayName, expiryDate) => `⚠️ <b>VPS en expiration — Pas de renouvellement automatique</b>\n\n🖥️ <b>${displayName}</b> expire on <b>${expiryDate}</b>.\nAuto-renouvellement is <b>OFF</b>.\n\n⏰ <b>Renouveler manually before the deadline</b> or your serveur will be permanently deleted.\n\nGo to: VPS/RDP → Manage → Renouveler Now`,
 util_10: (toLocaleString, domain, v2, v3, v4) => `🎉 <b>You saved ₦${toLocaleString}!</b> Domaine <b>${domaine}</b> cost ₦${v2} instead of ₦${v3}. The difference of ₦${v4} has been credited to your portefeuille solde.`,
 util_11: (website_name, round, APP_SUPPORT_LINK) => `Your domaine <b>${website_name}</b> has been registered successfully, but hébergement setup failed. Domaine cost has been charged — hébergement portion (₦${round}) refunded to your portefeuille. Please contact support to complete hébergement setup: ${APP_SUPPORT_LINK}`,
 util_12: '✅ Payment received!',
 util_13: (countryName) => `✅ Bank payment received!\n\n📍 <b>${countryName}</b> requires address verification for number activation.\n\nPlease enter your full address:\n<code>Street, City, Postal Code, Country</code>\n\n<i>Exemple: 42 Hamilton Ave, Bryanston, 2191, South Africa</i>\n\nOnce submitted, we'll handle the telecom verification process and activate your number automatically.`,
 util_14: (countryName, text) => `✅ Bank payment received!\n\n📍 <b>${countryName}</b> requires a billing address to activate the number.\nAddress ${text}.\n\nPlease enter your address:\n<code>Street, City, Country</code>\n\nExample: <i>123 Main St, Sydney, Australia</i>`,
 util_15: (delivered, requested, toFixed) => `💰 <b>Partial Refund</b>\n📊 ${delivered}/${requested} leads delivered\n💵 Refund: <b>$${toFixed}</b> → portefeuille`,
 util_16: (targetName, length) => `📄 <b>File 1 — ${targetName} Numbers + Real Person Name (${length} matched)</b>`,
 util_17: (targetName, length) => `📄 <b>File 2 — All ${targetName} Phone Numbers (${length} total)</b>`,
 util_18: (ngnIn, toLowerCase) => `✅ Payment received! Your portefeuille has been credited ₦${ngnIn}. Use portefeuille to complete your ${toLowerCase} purchase.`,
 util_2: (displayName, chargedDisplay, toUpperCase, toLocaleDateString, toFixed, v5) => `✅ <b>VPS Renouvelé automatiquement</b>\n\n🖥️ <b>${displayName}</b> renewed for 1 month.\n💰 ${chargedDisplay} déduit from ${toUpperCase} portefeuille.\n📅 New expiry: <b>${toLocaleDateString}</b>\n\n💳 Solde: $${toFixed} / ₦${v5}`,
 util_3: (displayName, toFixed, planPrice, expiryDate) => `🚨 <b>URGENT — VPS Renouvellement échoué</b>\n\n🖥️ <b>${displayName}</b> could not be auto-renewed.\n💰 Solde: $${toFixed}\n💵 Required: <b>$${planPrice}/mo</b>\n\n⚠️ <b>Votre serveur will be permanently deleted on ${expiryDate}</b> unless you renouveler manually.\n\nGo to: VPS/RDP → Manage → 📅 Renouveler Now`,
 util_4: (displayName) => `❌ <b>VPS annulé — Paiement non reçu</b>\n\n🖥️ <b>${displayName}</b> has been cancelled.\n💰 Auto-renouvellement failed and no manual payment was received.\n\n💡 You can purchase a new VPS anytime from the main menu.`,
 util_5: (displayName) => `❌ <b>VPS Deleted</b>\n\n🖥️ <b>${displayName}</b> has been permanently deleted.\n\n💡 Reason: Auto-renouvellement failed and no manual renouvellement was received before the deadline.\n\nYou can purchase a new VPS anytime from the main menu.`,
 util_6: (displayName, chargedDisplay, toLocaleDateString, toFixed, v4) => `✅ <b>VPS Renouvelé automatiquement</b>\n\n🖥️ <b>${displayName}</b> renewed for 1 month.\n💰 ${chargedDisplay} déduit.\n📅 New expiry: <b>${toLocaleDateString}</b>\n\n💳 Solde: $${toFixed} / ₦${v4}`,
 util_7: (displayName, toFixed) => `🚨 <b>URGENT — VPS Expiré</b>\n\n🖥️ <b>${displayName}</b> has expired.\n💰 Solde: $${toFixed}\n\n⚠️ <b>Serveur will be deleted shortly.</b>\nRenew NOW: VPS/RDP → Manage → 📅 Renouveler Now`,
 util_8: (displayName, expiryDate, planPrice, toFixed, statusIcon, v5) => `🖥️ <b>VPS en expiration in 3 Days</b>\n\n<b>${displayName}</b> expire on <b>${expiryDate}</b>.\n💵 Required: <b>$${planPrice}/mo</b>\n💳 Solde: $${toFixed}\n${statusIcon} ${sufficient ? 'Auto-renouvellement will be attempted 1 day before expiry.' : 'Solde insuffisant — top up or renouveler manually to keep your serveur!'}`,
 util_9: (domain, ngnPrice) => `💰 <b>Auto-Refund:</b> Domaine registration for <b>${domaine}</b> failed. Your payment of ${ngnPrice} NGN has been credited to your portefeuille solde.`,
 vps_1: (message) => `❌ Échoué to read file: ${message}`,
 vps_10: '✏️ Entrez the new <b>Subject</b> line:',
 vps_11: '⚙️ <b>Email Admin Panel</b>',
 vps_12: '📭 Non domains configured.',
 vps_13: '🗑 <b>Remove Domaine</b>\\n\\nSelect the domaine to remove:',
 vps_14: (domainList) => `🌐 <b>Sending Domains</b>\n\n${domainList}`,
 vps_15: (domainToRemove) => `✅ Domaine <b>${domainToRemove}</b> removed successfully.\n\nDNS records cleaned up.`,
 vps_16: (error) => `❌ Échoué to remove: ${result?.error || 'Domaine not found'}`,
 vps_17: (message) => `❌ Erreur removing domaine: ${message}`,
 vps_18: '🌐 Retour to domains.',
 vps_19: '❌ Invalide domaine name. Please enter a valide domaine (e.g., example.com)',
 vps_2: 'Please choose: "📝 Tapez Plain Text" or "📎 Télécharger HTML File"',
 vps_20: (domain) => `⏳ Setting up <b>${domaine}</b>...\n\nCreating DNS records, generating DKIM keys...`,
 vps_21: (error) => `❌ Échoué: ${error}`,
 vps_22: '⚙️ <b>Email Admin Panel</b>',
 vps_23: 'Non active IPs to pause.',
 vps_24: 'Sélectionner IP to pause:',
 vps_25: (ip) => `⏸ IP ${ip} paused.`,
 vps_26: 'Non paused IPs.',
 vps_27: 'Sélectionner IP to resume:',
 vps_28: (ip) => `▶️ IP ${ip} resumed.`,
 vps_29: '🖥️ Retour to IPs.',
 vps_3: (totalPrice, toFixed) => `❌ Solde insuffisant. You need $${campagne.totalPrice} but have $${toFixed}. Please dépôt first.`,
 vps_30: '❌ Invalide IP address. Please enter a valide IPv4 (e.g., 1.2.3.4)',
 vps_31: (trim) => `🖥️ Assign IP <b>${trim}</b> to which domaine?`,
 vps_32: '🖥️ Retour to IPs.',
 vps_33: (ip, domain) => `⏳ Adding IP ${ip} to ${domaine} and starting warming...`,
 vps_34: '⚙️ <b>Email Admin Panel</b>',
 vps_35: '💲 Entrez new rate per email (e.g., 0.10):',
 vps_36: '📉 Entrez new minimum emails per campagne:',
 vps_37: '📈 Entrez new maximum emails per campagne:',
 vps_38: '💰 Retour to pricing.',
 vps_39: '❌ Invalide. Entrez a number like 0.10',
 vps_4: 'Sélectionner payment method:',
 vps_40: (rate, toFixed) => `✅ Rate updated to <b>$${rate}/email</b> ($${toFixed} per 500)`,
 vps_41: '💰 Retour to pricing.',
 vps_42: '❌ Invalide. Entrez a number.',
 vps_43: (min) => `✅ Minimum emails updated to <b>${min}</b>`,
 vps_44: '💰 Retour to pricing.',
 vps_45: '❌ Invalide. Entrez a number.',
 vps_46: (max) => `✅ Maximum emails updated to <b>${max}</b>`,
 vps_47: '⚠️ Payment processing temporarily unavailable (service de taux de change en panne). Veuillez réessayer plus tard or use crypto.',
 vps_48: 'Bank ₦aira + Card 🌐︎',
 vps_49: '💵 Entrez the montant you\\\'d like to load ($50 – $1,000):',
 vps_5: '⚠️ Payment processing temporarily unavailable (service de taux de change en panne). Veuillez réessayer plus tard or use crypto.',
 vps_50: '⚠️ Payment processing temporarily unavailable (service de taux de change en panne). Veuillez réessayer plus tard or use crypto.',
 vps_51: 'Bank ₦aira + Card 🌐︎',
 vps_52: (reason) => `🚫 <b>Marketplace Access Restricted</b>\n\nYou cannot create listings. Your marketplace access has been suspended.\nReason: <i>${reason}</i>`,
 vps_53: (reason) => `🚫 <b>Marketplace Access Restricted</b>\n\nYou cannot create listings. Your marketplace access has been suspended.\nReason: <i>${reason}</i>`,
 vps_54: '❌ Erreur publishing produit. Veuillez réessayer.',
 vps_55: '🚧 VPS service is coming soon! Stay tuned.',
 vps_56: '🚧 VPS service is coming soon! Stay tuned.',
 vps_57: 'Session expirée. Please paste your URL again.',
 vps_58: (displayUrl) => `✅ <b>Lien shortened!</b>\n\n🔗 <code>${displayUrl}</code>\n\n📋 Tap to copy`,
 vps_59: (displayUrl) => `✅ <b>Lien shortened!</b>\n\n🔗 <code>${displayUrl}</code>\n\n📋 Tap to copy`,
 vps_6: 'Bank ₦aira + Card 🌐︎',
 vps_60: '❌ Erreur creating short lien. Veuillez réessayer.',
 vps_61: 'Please choose an option:',
 vps_62: 'Session expirée. Please paste your URL again.',
 vps_63: '❌ Invalide alias. Use only letters, numéros, and hyphens.',
 vps_64: '❌ Alias must be 2-30 characters long.',
 vps_65: (customAlias) => `❌ Alias <code>${customAlias}</code> is already taken. Try a different one.`,
 vps_66: (displayUrl) => `✅ <b>Lien shortened!</b>\n\n🔗 <code>${displayUrl}</code>\n\n📋 Tap to copy`,
 vps_67: (displayUrl) => `✅ <b>Lien shortened!</b>\n\n🔗 <code>${displayUrl}</code>\n\n📋 Tap to copy`,
 vps_68: '❌ Erreur creating short lien. Veuillez réessayer.',
 vps_69: (domain, plan) => `❌ Cannot activate URL shortener — <b>${domaine}</b> has an active hébergement forfait (<b>${existingHosting.forfait || 'cPanel'}</b>).\n\nThe shortener CNAME would replace your hébergement A records and take your website offline.\n\nPlease use a different domaine, or deactivate your hébergement forfait first.`,
 vps_7: (toLocaleString, price, totalEmails) => `📧 <b>Email Blast Payment</b>\n\n💵 Montant: <b>₦${toLocaleString}</b> (~$${price})\n📬 Campagne: ${campagne.totalEmails} emails\n\n🏦 Complete your payment via the lien below:`,
 vps_70: (domain, sanitizeProviderError) => `❌ Could not lien <b>${domaine}</b>: ${sanitizeProviderError(error, 'domaine')}`,
 vps_71: (domain, sanitizeProviderError) => `❌ DNS error for <b>${domaine}</b>: ${sanitizeProviderError(saveErr, 'domaine')}`,
 vps_72: (domain, error) => `❌ DNS error for <b>${domaine}</b>: ${sanitizeProviderError(addResult.error || 'Unknown error', 'domaine')}`,
 vps_73: 'Please choose a valide domaine',
 vps_74: (shortUrl) => `Your shortened URL is: ${shortUrl}`,
 vps_75: (shortUrl) => `Your shortened URL is: ${shortUrl}`,
 vps_76: (domain) => `❌ <b>${domaine}</b> is blocked and cannot be registered or used due to abuse policy violations.`,
 vps_77: (domain) => `🔍 Searching availability for ${domaine} ...`,
 vps_78: (domain) => `❌ <b>${domaine}</b> is not available.`,
 vps_79: (baseName) => `🔍 Searching alternatives for <b>${baseName}</b> ...`,
 vps_8: '❌ Invalide email address. Please enter a valide email (e.g., you@gmail.com):',
 vps_80: (altList) => `✅ Available alternatives:\n\n${altList}\n\nType any domaine name to check:`,
 vps_81: 'Non alternatives found. Try a different name:',
 vps_82: (ns) => `Invalide serveur de noms: <code>${ns}</code>\nPlease enter valide serveur de noms hostnames.`,
 vps_83: '⚠️ Payment processing temporarily unavailable (service de taux de change en panne). Veuillez réessayer plus tard or use crypto.',
 vps_84: 'Bank ₦aira + Card 🌐︎',
 vps_85: '⚠️ Payment processing temporarily unavailable (service de taux de change en panne). Veuillez réessayer plus tard or use crypto.',
 vps_86: 'Bank ₦aira + Card 🌐︎',
 vps_87: '⚠️ Payment processing temporarily unavailable (service de taux de change en panne). Veuillez réessayer plus tard or use crypto.',
 vps_88: 'Bank ₦aira + Card 🌐︎',
 vps_89: '⚠️ Payment processing temporarily unavailable (service de taux de change en panne). Veuillez réessayer plus tard or use crypto.',
 vps_9: (testAddr) => `⏳ Sending test email to <b>${testAddr}</b> via Brevo...`,
 vps_90: 'Bank ₦aira + Card 🌐︎',
 vps_91: '⚠️ Payment processing temporarily unavailable (service de taux de change en panne). Veuillez réessayer plus tard or use crypto.',
 vps_92: 'Bank ₦aira + Card 🌐︎',
 vps_93: 'DNS records are managed by your custom serveur de noms provider. Use "🔄 Manage Nameservers" to change providers.',
 vps_94: (domain, plan) => `❌ Cannot activate URL shortener — <b>${domaine}</b> has an active hébergement forfait (<b>${existingHosting.forfait || 'cPanel'}</b>).\n\nThe shortener CNAME would replace your hébergement A records and take your website offline.\n\nPlease use a different domaine, or deactivate your hébergement forfait first.`,
 vps_95: (domain, sanitizeProviderError) => `❌ Could not lien <b>${domaine}</b>: ${sanitizeProviderError(error, 'domaine')}`,
 vps_96: (domain, sanitizeProviderError) => `❌ DNS error for <b>${domaine}</b>: ${sanitizeProviderError(saveErr, 'domaine')}`,
 vps_97: (domain, error) => `❌ DNS error for <b>${domaine}</b>: ${sanitizeProviderError(addResult.error || 'Unknown error', 'domaine')}`,
 vps_98: (message) => `❌ Erreur: ${message}`,
 wh_1: (toFixed) => `💰 Excess ₦ credited to portefeuille: <b>$${toFixed}</b>`,
 wh_10: (length) => `📄 <b>File 1 — Numbers + Real Person Name (${length} matched)</b>`,
 wh_11: (length) => `📄 <b>File 2 — All Phone Numbers (${length} total)</b>`,
 wh_12: (toFixed, toLowerCase) => `✅ Payment received! Your portefeuille has been credited $${toFixed}. Use portefeuille to complete your ${toLowerCase} purchase.`,
 wh_13: (toFixed, usdBal) => `❌ VPS provisionnement failed.\n\n💰 <b>$${toFixed}</b> has been refunded to your portefeuille.\nWallet Solde: <b>$${usdBal}</b>\n\nPlease try again or contact support.`,
 wh_14: (domain, price) => `💰 <b>Auto-Refund:</b> Domaine registration for <b>${domaine}</b> failed. $${price} has been credited to your portefeuille solde.`,
 wh_15: (savingsUsd, domain, cheaperPrice, price, v4) => `🎉 <b>You saved $${v4}!</b> Domaine <b>${domaine}</b> cost $${cheaperPrice} instead of $${price}. The difference of $${savingsUsd} has been credited to your portefeuille solde.`,
 wh_16: (website_name, domainPrice, toFixed, APP_SUPPORT_LINK) => `Your domaine <b>${website_name}</b> has been registered successfully, but hébergement setup failed. Domaine cost ($${domainPrice}) charged — hébergement portion ($${toFixed}) refunded to your portefeuille. Please contact support to complete hébergement setup: ${APP_SUPPORT_LINK}`,
 wh_17: '✅ Crypto payment received!',
 wh_18: (countryName) => `✅ Crypto payment received!\n\n📍 <b>${countryName}</b> requires address verification for number activation.\n\nPlease enter your full address:\n<code>Street, City, Postal Code, Country</code>\n\n<i>Exemple: 42 Hamilton Ave, Bryanston, 2191, South Africa</i>\n\nOnce submitted, we'll handle the telecom verification process and activate your number automatically.`,
 wh_19: (countryName, text) => `✅ Crypto payment received!\n\n📍 <b>${countryName}</b> requires a billing address to activate the number.\nAddress ${text}.\n\nPlease enter your address:\n<code>Street, City, Country</code>\n\nExample: <i>123 Main St, Sydney, Australia</i>`,
 wh_2: (domain, price) => `💰 <b>Auto-Refund:</b> Domaine registration for <b>${domaine}</b> failed. $${price} has been credited to your portefeuille solde.`,
 wh_20: (toFixed) => `💰 Excess crypto credited to portefeuille: <b>$${toFixed}</b>`,
 wh_21: (delivered, requested, toFixed) => `💰 <b>Partial Refund</b>\n📊 ${delivered}/${requested} leads delivered\n💵 Refund: <b>$${toFixed}</b> → portefeuille`,
 wh_22: (toFixed, toLowerCase) => `✅ Payment received! Your portefeuille has been credited $${toFixed}. Use portefeuille to complete your ${toLowerCase} purchase.`,
 wh_23: (toFixed, usdBal) => `❌ VPS provisionnement failed.\n\n💰 <b>$${toFixed}</b> has been refunded to your portefeuille.\nWallet Solde: <b>$${usdBal}</b>\n\nPlease try again or contact support.`,
 wh_3: (savingsUsd, domain, cheaperPrice, price, v4) => `🎉 <b>You saved $${v4}!</b> Domaine <b>${domaine}</b> cost $${cheaperPrice} instead of $${price}. The difference of $${savingsUsd} has been credited to your portefeuille solde.`,
 wh_4: (website_name, domainPrice, toFixed, APP_SUPPORT_LINK) => `Your domaine <b>${website_name}</b> has been registered successfully, but hébergement setup failed. Domaine cost ($${domainPrice}) charged — hébergement portion ($${toFixed}) refunded to your portefeuille. Please contact support to complete hébergement setup: ${APP_SUPPORT_LINK}`,
 wh_5: '✅ Crypto payment received!',
 wh_6: (countryName) => `✅ Crypto payment received!\n\n📍 <b>${countryName}</b> requires address verification for number activation.\n\nPlease enter your full address:\n<code>Street, City, Postal Code, Country</code>\n\n<i>Exemple: 42 Hamilton Ave, Bryanston, 2191, South Africa</i>\n\nOnce submitted, we'll handle the telecom verification process and activate your number automatically.`,
 wh_7: (countryName, text) => `✅ Crypto payment received!\n\n📍 <b>${countryName}</b> requires a billing address to activate the number.\nAddress ${text}.\n\nPlease enter your address:\n<code>Street, City, Country</code>\n\nExample: <i>123 Main St, Sydney, Australia</i>`,
 wh_8: (toFixed) => `💰 Excess crypto credited to portefeuille: <b>$${toFixed}</b>`,
 wh_9: (requested, delivered, toFixed, v3) => `💰 <b>Partial Refund</b>\n\n📊 Ordered: ${requested} leads\n✅ Delivered: ${delivered}\n💵 Refund: <b>$${toFixed}</b> credited to your portefeuille\n💰 Portefeuille: $${v3} USD`,
 wlt_1: '⏳ Payment already in progress. Veuillez patienter...',
 wlt_10: '⚠️ Unable to load transaction history. Veuillez réessayer plus tard.',
 wlt_11: (amount) => `💵 Dépôt <b>$${montant}</b>\n\nSelect payment method:`,
 wlt_12: '⚠️ NGN payments temporarily unavailable (service de taux de change en panne). Veuillez essayer la crypto.',
 wlt_13: 'Bank ₦aira + Card 🌐︎',
 wlt_2: (reason) => `🚫 <b>Marketplace Access Restricted</b>\n\nYour marketplace access has been suspended.\nReason: <i>${reason}</i>\n\nContact support if you believe this is an error.`,
 wlt_3: (priceText, askDomainToUseWithShortener) => `${priceText}${askDomainToUseWithShortener}`,
 wlt_4: 'Choisissez lien type:',
 wlt_5: '✏️ Entrez your custom alias (letters, numéros, hyphens only):',
 wlt_6: '🔗 <b>Activate Domaine for URL Raccourcisseur</b>\\n\\nSelect a domaine to lien with the shortener. DNS will be auto-configured so you can create branded short links (e.g. <code>yourdomain.com/abc</code>).',
 wlt_7: (label) => `Supprimer ${label}?`,
 wlt_8: '⏳ Chargement transactions...',
 wlt_9: '📜 <b>Transaction History</b>\\n\\nNo transactions found yet. Make a dépôt or purchase to see activity here.',
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
 phoneNumberLeads: kOf(phoneNumberLeads),
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

const vpsPlanMenu = ["À l'heure", 'Mensuel', 'Trimestriel', 'Annuel']
const vpsConfigurationMenu = ['De base', 'Standard', 'Premium', 'Entreprise']
const vpsCpanelOptional = ['WHM', 'Plesk', '❌ Passer le panneau de contrôle']

const vp = {
 of: vpsOptionsOf,
 back: '🔙 Retour',
 skip: '❌ Passer',
 cancel: '❌ Annuler',

 // VPS/RDP choice (Step 1)
 vpsLinuxBtn: '🐧 Linux VPS (SSH)',
 vpsRdpBtn: '🪟 Windows RDP',
 askVpsOrRdp: `🖥️ De quel type de serveur avez-vous besoin ?

📬 <b>Port 25 Ouvert</b> — Envoyez des emails directement depuis votre serveur

<strong>🐧 Linux VPS</strong> — Accès SSH · hébergement web · dev · automatisation
<strong>🪟 Windows RDP</strong> — Bureau à distance · apps & outils Windows`,

 askCountryForUser: `🌍 Sélectionnez une région proche de vos utilisateurs :`,
 chooseValidCountry: 'Veuillez choisir un pays dans la liste :',
 askRegionForUser: country =>
 `📍 Sélectionnez un centre de données dans ${country} (Les prix peuvent varier selon l’emplacement.)`,
 chooseValidRegion: 'Veuillez choisir une région valide dans la liste :',
 askZoneForUser: region => `📍 Choisissez la zone dans ${region}.`,

 chooseValidZone: 'Veuillez choisir une zone valide dans la liste :',
 confirmZone: (region, zone) => `✅ Vous avez sélectionné ${region} (${zone}). Voulez-vous continuer avec ce choix ?`,
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
 // Billing (Monthly only)
 hourlyBillingMessage: '',

 askVpsConfig:
 list => `⚙️ Choisissez un plan :
 
${list
 .map(
 config =>
 `<strong>• ${config.name}</strong> — ${config.specs.vCPU} vCPU · ${config.specs.RAM}GB RAM · ${config.specs.disk}GB ${config.specs.diskType}`,
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

 askVpsOS: () => `💻 Sélectionnez une distribution Linux (par défaut : Ubuntu) :

<strong>💡 Recommandé :</strong>
<strong>• Ubuntu</strong> — Usage général & développement
<strong>• AlmaLinux / Rocky</strong> — Stabilité entreprise
<strong>• Debian</strong> — Léger & fiable`,
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

 generateBillSummary: vpsDetails => {
 const planPrice = vpsDetails.couponApplied ? vpsDetails.planNewPrice : vpsDetails.plantotalPrice
 const total = vpsDetails.totalPrice || Number(planPrice).toFixed(2)
 const isRDP = vpsDetails.isRDP
 const osLabel = isRDP ? '🪟 Windows Server (RDP)' : (vpsDetails.os?.name || 'Ubuntu')
 
 let summary = `<strong>📋 Résumé de commande :</strong>

<strong>🖥️ ${vpsDetails.config.name}</strong> — ${vpsDetails.config.specs.vCPU} vCPU · ${vpsDetails.config.specs.RAM}GB RAM · ${vpsDetails.config.specs.disk}GB ${vpsDetails.config.specs.diskType}
<strong>📍 Région :</strong> ${vpsDetails.regionName || vpsDetails.country}
<strong>💻 OS :</strong> ${osLabel}`

 if (isRDP) {
 summary += `\n<strong>🪟 Licence Windows :</strong> Incluse`
 }
 if (vpsDetails.couponApplied && vpsDetails.couponDiscount > 0) {
 summary += `\n<strong>🎟️ Coupon :</strong> -$${Number(vpsDetails.couponDiscount).toFixed(2)} USD`
 }
 summary += `\n<strong>🔄 Renouvellement auto :</strong> ✅ Activé`
 summary += `\n\n<strong>💰 Total : $${total} USD/mo</strong>`
 summary += `\n\n<strong>✅ Procéder à la commande ?</strong>`
 return summary
 },

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

 vpsBoughtSuccess: (vpsDetails, response, credentials) => {
 const isRDP = response.isRDP || vpsDetails.isRDP || response.osType === 'Windows'
 const connectInfo = isRDP
 ? ` <strong>• Connexion:</strong> 🖥 Bureau à distance → <code>${response.host}:3389</code>\n <strong>• Comment:</strong> Ouvrez Connexion Bureau à distance (mstsc) et entrez l'adresse ci-dessus.`
 : ` <strong>• Connexion:</strong> 💻 <code>ssh ${credentials.username}@${response.host}</code>`
 
 const passwordWarning = isRDP
 ? `\n⚠️ <strong>IMPORTANT - Enregistrez votre mot de passe maintenant !</strong>\n• Nous NE POUVONS PAS le récupérer plus tard pour des raisons de sécurité\n• Si perdu, utilisez "Réinitialiser le mot de passe" depuis la gestion VPS (données préservées)\n• Cliquez sur le mot de passe ci-dessus pour le révéler et le copier\n`
 : `\n⚠️ <strong>Enregistrez vos identifiants en toute sécurité !</strong>\n`
 
 return `<strong>🎉 ${isRDP ? 'RDP' : 'VPS'} [${response.label}] est actif !</strong>

<strong>🔑 Informations de connexion:</strong>
 <strong>• IP:</strong> ${response.host}
 <strong>• OS:</strong> ${vpsDetails.os ? vpsDetails.os.name : (isRDP ? 'Windows Server' : 'Linux')}
 <strong>• Nom d'utilisateur:</strong> ${credentials.username}
 <strong>• Mot de passe:</strong> <tg-spoiler>${credentials.password}</tg-spoiler> (changez immédiatement)

<strong>🔗 Connexion:</strong>
${connectInfo}
${passwordWarning}
📧 Ces détails ont également été envoyés à votre email enregistré. Veuillez les garder en sécurité.

Merci d'avoir choisi notre service
${CHAT_BOT_NAME}
`
 },
 vpsHourlyPlanRenewed: (vpsName, price) => `
Votre plan VPS pour l'instance ${vpsName} a été renouvelé avec succès.
${price}$ ont été débités de votre portefeuille.`,

 vpsMonthlyPlanRenewed: (vpsName, planPrice) =>
 `✅ Votre VPS <b>${vpsName}</b> a été renouvelé automatiquement pour 1 mois.\n💰 $${planPrice} débités de votre portefeuille.`,

 vpsExpiredNoAutoRenew: (vpsName) =>
 `⚠️ Votre VPS <b>${vpsName}</b> a expiré. Le renouvellement automatique est désactivé.\nVeuillez renouveler manuellement pour continuer le service.`,

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
 resetPasswordBtn: '🔑 Réinitialiser le mot de passe',
 reinstallWindowsBtn: '🔄 Réinstaller Windows',
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
 
 confirmResetPasswordText: name => `🔑 <strong>Réinitialiser le mot de passe RDP</strong>

⚠️ <strong>Important :</strong>
• Votre mot de passe actuel ne fonctionnera plus
• Un nouveau mot de passe sera généré
• Toutes vos données et fichiers seront préservés
• Vous aurez besoin du nouveau mot de passe pour accéder au RDP

Voulez-vous réinitialiser le mot de passe pour <strong>${name}</strong> ?`,

 confirmReinstallWindowsText: name => `🔄 <strong>Réinstaller Windows</strong>

⚠️ <strong>AVERTISSEMENT CRITIQUE :</strong>
• Cela EFFACERA TOUTES LES DONNÉES sur votre RDP
• Tous les fichiers, programmes et paramètres seront supprimés
• Une installation Windows fraîche sera créée
• De nouvelles informations d'identification seront générées
• Votre ancien mot de passe ne fonctionnera PLUS

💾 <strong>Recommandation :</strong> Créez une sauvegarde/instantané avant de continuer.

Voulez-vous réinstaller Windows sur <strong>${name}</strong> ?`,

 passwordResetInProgress: name => `🔄 Réinitialisation du mot de passe pour <strong>${name}</strong>...

⏱️ Cela peut prendre 30 à 60 secondes. Veuillez patienter.`,

 passwordResetSuccess: (name, ip, username, password) => `✅ <strong>Mot de passe réinitialisé avec succès !</strong>

🖥️ <strong>RDP :</strong> ${name}
🌐 <strong>IP :</strong> ${ip}
👤 <strong>Nom d'utilisateur :</strong> ${username}
🔑 <strong>Nouveau mot de passe :</strong> <code>${password}</code>

⚠️ <strong>IMPORTANT - Enregistrez ce mot de passe maintenant !</strong>
• Nous ne pouvons pas le récupérer plus tard pour des raisons de sécurité
• Si perdu, vous devez réinitialiser votre mot de passe à nouveau (les données seront préservées)
• Votre ancien mot de passe ne fonctionne plus

💡 Cliquez sur le mot de passe pour le copier.`,

 windowsReinstallInProgress: name => `🔄 Réinstallation de Windows sur <strong>${name}</strong>...

⏱️ Ce processus prend 5 à 10 minutes.
📧 Vous recevrez de nouvelles informations d'identification une fois terminé.`,

 windowsReinstallSuccess: (name, ip, username, password) => `🎉 <strong>Windows réinstallé avec succès !</strong>

🖥️ <strong>RDP :</strong> ${name}
🌐 <strong>IP :</strong> ${ip}
👤 <strong>Nom d'utilisateur :</strong> ${username}
🔑 <strong>Mot de passe :</strong> <code>${password}</code>

⚠️ <strong>CRITIQUE - Enregistrez ce mot de passe maintenant !</strong>
• Nous NE POUVONS PAS le récupérer plus tard pour des raisons de sécurité
• Toutes les données précédentes ont été effacées
• Ceci est une installation Windows fraîche
• Si vous perdez ce mot de passe, vous devez le réinitialiser (utilisez le bouton "Réinitialiser le mot de passe")

💡 Cliquez sur le mot de passe pour le copier.
🚀 Votre RDP est prêt à être utilisé avec ces nouvelles informations d'identification !`,

 passwordResetFailed: name => `❌ <strong>Échec de la réinitialisation du mot de passe</strong>

Échec de la réinitialisation du mot de passe pour <strong>${name}</strong>.

Veuillez réessayer dans quelques minutes ou contacter le support si le problème persiste.`,

 windowsReinstallFailed: name => `❌ <strong>Échec de la réinstallation de Windows</strong>

Échec de la réinstallation de Windows sur <strong>${name}</strong>.

Veuillez réessayer dans quelques minutes ou contacter le support si le problème persiste.`,

 rdpNotSupported: `⚠️ Cette fonctionnalité n'est disponible que pour les instances Windows RDP.

Votre VPS exécute Linux. Utilisez plutôt les clés SSH pour la gestion des accès.`,
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

<strong>• VPS ${vpsData.name} </strong> – Expire le : ${planExpireDate} (Renouvellement automatique : ${
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
 vs,
 vp,
 vpsPlanOf,
 vpsCpanelOptional,
}

module.exports = {
 fr,
 setCustomNsPrompt: (domain, nsRecords) => {
 let msg = `<b>✏️ Définir des serveurs de noms personnalisés pour ${domain}</b>\n\n`
 if (nsRecords && nsRecords.length) {
 msg += `<b>Actuel:</b>\n`
 nsRecords.forEach((ns, i) => {
 msg += ` NS${i + 1}: <code>${ns.recordContent || '—'}</code>\n`
 })
 msg += '\n'
 }
 msg += `Entrez les nouveaux serveurs de noms (un par ligne, min 2, max 4):\n\n<i>Exemple:\nns1.example.com\nns2.example.com</i>`
 return msg
 },
 Hosting: 'Hébergement',
}
