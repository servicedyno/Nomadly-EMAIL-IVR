/**
 * regulatory-config.js — Twilio Regulatory Compliance Requirements for all bot countries.
 *
 * Generated from live Twilio Regulations API query.
 * Maps country+numType → required end-user fields + supporting documents.
 *
 * Tiers:
 *   0 = No docs (instant buy)
 *   1 = End-user name only (no upload)
 *   2 = 1 document upload
 *   3 = 2 document uploads
 *   4 = 3+ document uploads or special fields
 *
 * IMPORTANT: Users must provide ALL info themselves. Nothing is pulled from Telegram profile.
 */

// Common text inputs reused across all Tier 2+ countries
const NAME_INPUTS = [
  { key: 'first_name', prompt: { en: '👤 Enter your <b>first name</b> (as shown on your ID):', fr: '👤 Entrez votre <b>prénom</b> (tel que sur votre pièce d\'identité) :', zh: '👤 输入您的<b>名字</b>（与证件一致）：', hi: '👤 अपना <b>पहला नाम</b> दर्ज करें (ID पर जैसा है):' } },
  { key: 'last_name', prompt: { en: '👤 Enter your <b>last name</b> (as shown on your ID):', fr: '👤 Entrez votre <b>nom de famille</b> (tel que sur votre pièce d\'identité) :', zh: '👤 输入您的<b>姓氏</b>（与证件一致）：', hi: '👤 अपना <b>उपनाम</b> दर्ज करें (ID पर जैसा है):' } },
]

/**
 * Country-specific rejection guidance — shown to users when their bundle is rejected.
 * Maps country:numType → per-document specific instructions for re-upload.
 */
const REJECTION_GUIDANCE = {
  'IE:local': {
    id_photo: {
      en: '🔹 <b>Government ID</b> — Ireland requires one of:\n• Valid <b>passport</b> (bio page, not expired)\n• National <b>ID card</b> (front side)\n• Irish <b>driving licence</b>\n\n⚠️ Must clearly show: full name, photo, date of birth/expiry.\nPhoto must be flat, no glare, all 4 corners visible.',
    },
    address_proof: {
      en: '🔹 <b>Address Proof</b> — Ireland requires one of:\n• <b>Utility bill</b> (electricity, gas, water, broadband) — <b>not</b> mobile phone bill\n• <b>Bank statement</b>\n• <b>Revenue / tax notice</b>\n• <b>Rent receipt</b> from registered landlord\n\n⚠️ Must be dated <b>within the last 3 months</b>.\nMust show your <b>full name + Irish address with Eircode</b>.\nNo screenshots — photo of the <b>physical document</b> or official PDF.',
    },
  },
  'GB:mobile': {
    id_photo: {
      en: '🔹 <b>Government ID</b> — UK requires one of:\n• Valid <b>passport</b> (bio page)\n• UK <b>driving licence</b> (photocard)\n• <b>Biometric Residence Permit</b> (BRP)\n\n⚠️ Must clearly show: full name, photo, and document number.\nPhoto must be flat, no glare, all 4 corners visible.',
    },
    address_proof: {
      en: '🔹 <b>Address Proof</b> — UK requires one of:\n• <b>Utility bill</b> (gas, electricity, water) — <b>not</b> mobile phone bill\n• <b>Bank or building society statement</b>\n• <b>Council tax bill</b>\n• <b>HMRC correspondence</b>\n\n⚠️ Must be dated <b>within the last 3 months</b>.\nMust show your <b>full name + UK address with postcode</b>.\nNo screenshots — photo of the <b>physical document</b> or official PDF.',
    },
  },
  'AU:mobile': {
    id_photo: {
      en: '🔹 <b>Government ID</b> — Australia requires one of:\n• Valid <b>passport</b> (bio page)\n• Australian <b>driver licence</b>\n• <b>Proof of Age card</b>\n• <b>ImmiCard</b>\n\n⚠️ Must clearly show: full name, photo, and document number.\nPhoto must be flat, unobstructed, all 4 corners visible.',
    },
    address_proof: {
      en: '🔹 <b>Address Proof</b> — Australia requires one of:\n• <b>Utility bill</b> (electricity, gas, water, internet)\n• <b>Bank statement</b>\n• <b>ATO tax notice</b>\n• <b>Rates notice</b> from local council\n\n⚠️ Must be dated <b>within the last 3 months</b>.\nMust show your <b>full name + Australian address</b>.\nNo screenshots — photo of the <b>physical document</b> or official PDF.',
    },
  },
  'NZ:local': {
    id_photo: {
      en: '🔹 <b>Government ID</b> — New Zealand requires one of:\n• Valid <b>passport</b> (bio page)\n• NZ <b>driver licence</b>\n• <b>Firearms licence</b>\n\n⚠️ Must clearly show: full name, photo, and document number.\nPhoto must be flat, all 4 corners visible.',
    },
    address_proof: {
      en: '🔹 <b>Address Proof</b> — New Zealand requires one of:\n• <b>Utility bill</b> (power, water, gas, internet)\n• <b>Bank statement</b>\n• <b>IRD correspondence</b>\n• <b>Tenancy agreement</b>\n\n⚠️ Must be dated <b>within the last 3 months</b>.\nMust show your <b>full name + NZ address</b>.\nNo screenshots — photo of the <b>physical document</b> or official PDF.',
    },
  },
  'HK:mobile': {
    id_photo: {
      en: '🔹 <b>Passport or ID Card</b> — Hong Kong requires one of:\n• Valid <b>passport</b> (bio page showing name + DOB)\n• <b>HKID card</b> (front side)\n\n⚠️ Must clearly show: full name, date of birth, photo.\nPhoto must be flat, no glare, all 4 corners visible.',
    },
    address_proof: {
      en: '🔹 <b>Address Proof</b> — Hong Kong requires one of:\n• <b>Utility bill</b> (CLP/HK Electric, Towngas, Water Supplies)\n• <b>Bank statement</b>\n• <b>Government correspondence</b>\n\n⚠️ Must be dated <b>within the last 3 months</b>.\nMust show your <b>full name + HK address</b>.\nNo screenshots — photo of the <b>physical document</b> or official PDF.',
    },
  },
  'CZ:local': {
    address_proof: {
      en: '🔹 <b>Address Proof</b> — Czech Republic requires one of:\n• <b>Utility bill</b> (electricity, gas, water)\n• <b>Bank statement</b>\n• Czech <b>ID card</b> showing address\n• <b>Tax notice</b>\n\n⚠️ Must be dated <b>within the last 3 months</b>.\nMust show your <b>full name + Czech Republic address</b>.\nNo screenshots — photo of the <b>physical document</b> or official PDF.',
    },
  },
  'MY:local': {
    id_photo: {
      en: '🔹 <b>Passport</b> — Malaysia requires:\n• Valid <b>passport</b> (bio page showing full name, nationality, photo)\n\n⚠️ Must not be expired. Photo must be flat, all 4 corners visible.',
    },
    address_proof: {
      en: '🔹 <b>Address Proof</b> — Malaysia requires one of:\n• <b>MyKad</b> (Malaysian IC) showing address\n• <b>Work permit</b> showing local address\n• <b>Utility bill</b> with Malaysian address\n\n⚠️ Must show your <b>full name + Malaysian address</b>.\nMust be dated <b>within the last 3 months</b> (for bills).\nNo screenshots — photo of the <b>physical document</b> or official PDF.',
    },
  },
  'PL:mobile': {
    id_photo: {
      en: '🔹 <b>Government ID</b> — Poland requires one of:\n• Valid <b>passport</b> (bio page)\n• Polish <b>dowód osobisty</b> (national ID card)\n\n⚠️ Must clearly show: full name, PESEL number, and photo.\nPhoto must be flat, no glare, all 4 corners visible.',
    },
  },
  'ZA:local': {
    id_photo: {
      en: '🔹 <b>Government ID</b> — South Africa requires one of:\n• Valid <b>passport</b> (bio page)\n• South African <b>ID card</b> or <b>Smart ID</b>\n• <b>Temporary ID certificate</b>\n\n⚠️ Must clearly show: full name, ID/document number, and photo.\nPhoto must be flat, no glare, all 4 corners visible.',
    },
    address_proof: {
      en: '🔹 <b>Address Proof</b> — South Africa requires one of:\n• <b>Tax invoice</b> from SARS\n• <b>Utility bill</b> (Eskom, municipality)\n• <b>Phone bill</b> (landline, not mobile)\n• <b>Driver\'s licence card</b> showing address\n\n⚠️ Must be dated <b>within the last 3 months</b>.\nMust show your <b>full name + South African address</b>.\nNo screenshots — photo of the <b>physical document</b> or official PDF.',
    },
  },
  'KE:local': {
    id_photo: {
      en: '🔹 <b>Government ID</b> — Kenya requires one of:\n• Valid <b>passport</b> (bio page showing name + DOB)\n• Kenyan <b>national ID card</b> (Huduma Namba)\n\n⚠️ Must clearly show: full name, date of birth, and photo.\nPhoto must be flat, no glare, all 4 corners visible.',
    },
    address_proof: {
      en: '🔹 <b>Address Proof</b> — Kenya requires one of:\n• <b>Utility bill</b> (KPLC, water, internet)\n• <b>Bank statement</b>\n• <b>KRA PIN certificate</b>\n• <b>Rent receipt</b>\n\n⚠️ Must be dated <b>within the last 3 months</b>.\nMust show your <b>full name + Kenyan address</b>.\nNo screenshots — photo of the <b>physical document</b> or official PDF.',
    },
  },
  'TH:mobile': {
    id_photo: {
      en: '🔹 <b>ID Card or Passport</b> — Thailand requires one of:\n• Valid <b>passport</b> (bio page)\n• Thai <b>national ID card</b> (บัตรประชาชน)\n\n⚠️ Must clearly show: full name, ID number, and photo.\nPhoto must be flat, no glare, all 4 corners visible.',
    },
    address_proof: {
      en: '🔹 <b>Address Proof</b> — Thailand requires one of:\n• <b>Utility bill</b> (MEA/PEA electricity, water, internet)\n• <b>Bank statement</b>\n• <b>Hor Ror 3 (house registration)</b>\n• <b>Tax correspondence</b>\n\n⚠️ Must be dated <b>within the last 3 months</b>.\nMust show your <b>full name + Thai address</b>.\nNo screenshots — photo of the <b>physical document</b> or official PDF.',
    },
  },
  'EE:local': {
    id_photo: {
      en: '🔹 <b>Government ID</b> — Estonia requires one of:\n• Valid <b>passport</b> (bio page)\n• Estonian <b>ID card</b>\n• <b>Residence permit card</b>\n\n⚠️ Must clearly show: full name, photo, and document number.\nPhoto must be flat, no glare, all 4 corners visible.',
    },
  },
  'EE:mobile': {
    id_photo: {
      en: '🔹 <b>Government ID</b> — Estonia requires one of:\n• Valid <b>passport</b> (bio page)\n• Estonian <b>ID card</b>\n• <b>Residence permit card</b>\n\n⚠️ Must clearly show: full name, photo, and document number.\nPhoto must be flat, no glare, all 4 corners visible.',
    },
  },
}

// ── General photo tips appended to all document prompts ──
const PHOTO_TIPS = {
  en: '\n\n💡 <b>Tips for approval:</b>\n• Take a clear, well-lit photo\n• All 4 corners of the document must be visible\n• No blur, glare, or shadows on text\n• Do not crop or edit the image\n• <b>No screenshots</b> — use camera to photograph the document',
  fr: '\n\n💡 <b>Conseils :</b>\n• Photo claire et bien éclairée\n• Les 4 coins du document doivent être visibles\n• Pas de flou ni de reflets\n• Ne pas recadrer l\'image\n• <b>Pas de captures d\'écran</b>',
  zh: '\n\n💡 <b>拍照提示：</b>\n• 清晰、光线充足\n• 文件4个角都要可见\n• 无模糊、无反光\n• 不要裁剪或编辑\n• <b>不要截图</b>——用相机拍摄',
  hi: '\n\n💡 <b>अनुमोदन के लिए सुझाव:</b>\n• स्पष्ट, अच्छी रोशनी वाली फ़ोटो लें\n• दस्तावेज़ के सभी 4 कोने दिखने चाहिए\n• कोई धुंधलापन या चमक नहीं\n• छवि को क्रॉप न करें\n• <b>स्क्रीनशॉट नहीं</b> — कैमरे से फ़ोटो लें',
}

const COUNTRY_REGS = {
  // ═══ Tier 0: No documents needed ═══
  'US:local':     { tier: 0 },
  'US:toll_free': { tier: 0 },
  'CA:local':     { tier: 0 },
  'CA:toll_free': { tier: 0 },
  'IL:local':     { tier: 0 },
  'IL:mobile':    { tier: 0 },
  'PR:local':     { tier: 0 },
  'TN:local':     { tier: 0 },
  // All toll-free numbers — no regulations
  'AU:toll_free': { tier: 0 },
  'NZ:toll_free': { tier: 0 },
  'HK:toll_free': { tier: 0 },
  'IT:toll_free': { tier: 0 },
  'FI:toll_free': { tier: 0 },
  'MX:toll_free': { tier: 0 },
  'CO:toll_free': { tier: 0 },
  'BG:toll_free': { tier: 0 },
  'CZ:toll_free': { tier: 0 },
  'EE:toll_free': { tier: 0 },
  'ID:toll_free': { tier: 0 },
  'RO:toll_free': { tier: 0 },
  'SK:toll_free': { tier: 0 },
  'TH:toll_free': { tier: 0 },

  // ═══ Tier 1: End-user name only (no upload, but user must provide name) ═══
  'NL:mobile': {
    tier: 1,
    regulationSid: 'RN094a796ec7631e296e7900a5a8b02031',
    endUserFields: ['first_name', 'last_name'],
    textInputs: [...NAME_INPUTS],
    docs: [],
  },
  'FI:mobile': {
    tier: 1,
    regulationSid: 'RN2be8cb3ea08d9dcc15061e9b7ac491f3',
    endUserFields: ['first_name', 'last_name'],
    textInputs: [...NAME_INPUTS],
    docs: [],
  },

  // ═══ Tier 2: 1 document upload (ID for name proof) ═══
  'EE:local': {
    tier: 2,
    regulationSid: 'RN6adcd07a287f1476d92c22d06947115b',
    endUserFields: ['first_name', 'last_name'],
    textInputs: [...NAME_INPUTS],
    docs: [
      {
        key: 'id_photo',
        requirement: 'name_info',
        type: 'government_issued_document',
        fields: { from: ['first_name', 'last_name'] },
        prompt: {
          en: '📷 <b>Step {step}/{total}: Upload Government ID</b>\n\n🇪🇪 <b>Estonia</b> accepts one of:\n• Valid <b>passport</b> (bio data page)\n• Estonian <b>ID card</b> (front side)\n• <b>Residence permit card</b>\n\n⚠️ Must clearly show your <b>full name</b> and <b>photo</b>.\nDocument must <b>not be expired</b>.',
          fr: '📷 <b>Étape {step}/{total}: Pièce d\'identité</b>\n\n🇪🇪 <b>Estonie</b> — passeport valide, carte d\'identité ou permis de séjour.\nDoit montrer votre <b>nom complet</b> et <b>photo</b>.',
          zh: '📷 <b>步骤 {step}/{total}：上传身份证件</b>\n\n🇪🇪 <b>爱沙尼亚</b>接受：有效护照、身份证或居留证。\n必须显示<b>全名</b>和<b>照片</b>。',
          hi: '📷 <b>चरण {step}/{total}: सरकारी ID अपलोड करें</b>\n\n🇪🇪 <b>एस्टोनिया</b> — वैध पासपोर्ट, ID कार्ड, या निवास परमिट।\n<b>पूरा नाम</b> और <b>फ़ोटो</b> दिखना चाहिए।',
        },
      },
    ],
  },
  'EE:mobile': {
    tier: 2,
    regulationSid: 'RN88c2810570ee6cdea58d97e5db9b9c0f',
    endUserFields: ['first_name', 'last_name'],
    textInputs: [...NAME_INPUTS],
    docs: [
      {
        key: 'id_photo',
        requirement: 'name_info',
        type: 'government_issued_document',
        fields: { from: ['first_name', 'last_name'] },
        prompt: {
          en: '📷 <b>Step {step}/{total}: Upload Government ID</b>\n\n🇪🇪 <b>Estonia</b> accepts one of:\n• Valid <b>passport</b> (bio data page)\n• Estonian <b>ID card</b> (front side)\n• <b>Residence permit card</b>\n\n⚠️ Must clearly show your <b>full name</b> and <b>photo</b>.\nDocument must <b>not be expired</b>.',
          fr: '📷 <b>Étape {step}/{total}: Pièce d\'identité</b>\n\n🇪🇪 <b>Estonie</b> — passeport valide, carte d\'identité ou permis de séjour.\nDoit montrer votre <b>nom complet</b> et <b>photo</b>.',
          zh: '📷 <b>步骤 {step}/{total}：上传身份证件</b>\n\n🇪🇪 <b>爱沙尼亚</b>接受：有效护照、身份证或居留证。\n必须显示<b>全名</b>和<b>照片</b>。',
          hi: '📷 <b>चरण {step}/{total}: सरकारी ID अपलोड करें</b>\n\n🇪🇪 <b>एस्टोनिया</b> — वैध पासपोर्ट, ID कार्ड, या निवास परमिट।\n<b>पूरा नाम</b> और <b>फ़ोटो</b> दिखना चाहिए।',
        },
      },
    ],
  },

  // ═══ Tier 3: 2 document uploads ═══
  'GB:mobile': {
    tier: 3,
    regulationSid: 'RNbda16e54b024fc1d8a0213f5477dc624',
    endUserFields: ['first_name', 'last_name', 'email', 'phone_number'],
    textInputs: [
      ...NAME_INPUTS,
      { key: 'phone_number', prompt: { en: '📱 Enter your phone number (with country code, e.g. +44...):', fr: '📱 Entrez votre numéro (+code pays) :', zh: '📱 输入您的电话号码（含国家代码）：', hi: '📱 अपना फ़ोन नंबर दर्ज करें (देश कोड सहित):' } },
    ],
    docs: [
      {
        key: 'id_photo',
        requirement: 'proof_of_identity',
        type: 'government_issued_document',
        fields: { from: ['first_name', 'last_name'] },
        prompt: {
          en: '📷 <b>Step {step}/{total}: Upload ID Proof</b>\n\n🇬🇧 <b>United Kingdom</b> accepts one of:\n• Valid <b>passport</b> (bio data page)\n• UK <b>driving licence</b> (photocard front)\n• <b>Biometric Residence Permit</b> (BRP)\n\n⚠️ Must clearly show: <b>full name</b>, <b>photo</b>, and <b>document number</b>.\nDocument must <b>not be expired</b>.',
          fr: '📷 <b>Étape {step}/{total}: Preuve d\'identité</b>\n\n🇬🇧 <b>Royaume-Uni</b> — passeport, permis de conduire UK, ou BRP.\nNom complet, photo et numéro de document requis.',
          zh: '📷 <b>步骤 {step}/{total}：上传身份证明</b>\n\n🇬🇧 <b>英国</b>接受：护照、英国驾照或BRP。\n必须显示全名、照片和证件号码。',
          hi: '📷 <b>चरण {step}/{total}: पहचान प्रमाण</b>\n\n🇬🇧 <b>यूके</b> — पासपोर्ट, ड्राइविंग लाइसेंस, या BRP।\nपूरा नाम, फ़ोटो और दस्तावेज़ संख्या दिखनी चाहिए।',
        },
      },
      {
        key: 'address_proof',
        requirement: 'individual_address_info',
        type: 'individual_address',
        fields: { needsAddress: true },
        prompt: {
          en: '📷 <b>Step {step}/{total}: Upload Address Proof</b>\n\n🇬🇧 <b>United Kingdom</b> accepts one of:\n• <b>Utility bill</b> (gas, electricity, water) — ❌ <b>not</b> mobile phone bill\n• <b>Bank or building society statement</b>\n• <b>Council tax bill</b>\n• <b>HMRC correspondence</b>\n\n⚠️ Must be dated <b>within the last 3 months</b>.\nMust show your <b>full name</b> + <b>UK address with postcode</b>.\n❌ No screenshots — photograph the <b>physical document</b> or use the official PDF.',
          fr: '📷 <b>Étape {step}/{total}: Preuve d\'adresse</b>\n\n🇬🇧 <b>Royaume-Uni</b> — facture de services, relevé bancaire, ou taxe d\'habitation.\nDaté de <b>moins de 3 mois</b>. Nom + adresse UK avec code postal.',
          zh: '📷 <b>步骤 {step}/{total}：上传地址证明</b>\n\n🇬🇧 <b>英国</b>接受：水电气账单、银行对账单或市政税单。\n<b>3个月内</b>，显示全名和英国邮编地址。',
          hi: '📷 <b>चरण {step}/{total}: पता प्रमाण</b>\n\n🇬🇧 <b>यूके</b> — यूटिलिटी बिल, बैंक स्टेटमेंट, या काउंसिल टैक्स बिल।\n<b>3 महीने</b> के भीतर, पूरा नाम + UK पता + पोस्टकोड।',
        },
      },
    ],
  },
  'IE:local': {
    tier: 3,
    regulationSid: 'RNc2b0d6e647462e65bcc1479e7130315d',
    endUserFields: ['first_name', 'last_name', 'email', 'business_identity', 'is_subassigned'],
    autoFill: { business_identity: 'DIRECT_CUSTOMER', is_subassigned: 'NO' },
    textInputs: [
      ...NAME_INPUTS,
    ],
    docs: [
      {
        key: 'id_photo',
        requirement: 'proof_of_identity_info',
        type: 'government_issued_document',
        fields: { from: ['first_name', 'last_name'] },
        prompt: {
          en: '📷 <b>Step {step}/{total}: Upload ID Proof</b>\n\n🇮🇪 <b>Ireland</b> accepts one of:\n• Valid <b>passport</b> (bio data page)\n• <b>National ID card</b> (front side)\n• Irish <b>driving licence</b> (photocard)\n\n⚠️ Must clearly show: <b>full name</b>, <b>photo</b>, and <b>date of birth or expiry</b>.\nDocument must <b>not be expired</b>.\n❌ Do NOT send a photo of a credit card, student ID, or work badge.',
          fr: '📷 <b>Étape {step}/{total}: Preuve d\'identité</b>\n\n🇮🇪 <b>Irlande</b> — passeport valide, carte d\'identité nationale, ou permis de conduire irlandais.\nNom complet, photo et date requis. Document <b>non expiré</b>.',
          zh: '📷 <b>步骤 {step}/{total}：上传身份证明</b>\n\n🇮🇪 <b>爱尔兰</b>接受：有效护照、国民身份证或爱尔兰驾照。\n必须显示全名、照片和出生/有效日期。<b>不得过期</b>。',
          hi: '📷 <b>चरण {step}/{total}: पहचान प्रमाण</b>\n\n🇮🇪 <b>आयरलैंड</b> — पासपोर्ट, राष्ट्रीय ID कार्ड, या ड्राइविंग लाइसेंस।\nपूरा नाम, फ़ोटो और तारीख दिखनी चाहिए। <b>समय सीमा समाप्त नहीं</b>।',
        },
      },
      {
        key: 'address_proof',
        requirement: 'individual_address_info',
        type: 'utility_bill',
        fields: { needsAddress: true },
        prompt: {
          en: '📷 <b>Step {step}/{total}: Upload Address Proof</b>\n\n🇮🇪 <b>Ireland</b> accepts one of:\n• <b>Utility bill</b> (ESB, Bord Gáis, Irish Water, broadband) — ❌ <b>not</b> mobile phone bill\n• <b>Bank statement</b>\n• <b>Revenue notice</b> (from Revenue.ie)\n• <b>Rent receipt</b> from registered landlord\n• <b>Title deed</b>\n\n⚠️ Must be dated <b>within the last 3 months</b>.\nMust show your <b>full name</b> + <b>Irish address with Eircode</b>.\nAddress must be in the same region as the phone number prefix.\n❌ No screenshots — photograph the <b>physical document</b> or use the official PDF.',
          fr: '📷 <b>Étape {step}/{total}: Preuve d\'adresse</b>\n\n🇮🇪 <b>Irlande</b> — facture de services (ESB, Bord Gáis), relevé bancaire, ou avis fiscal.\nDaté de <b>moins de 3 mois</b>. Nom + adresse irlandaise avec <b>Eircode</b>.',
          zh: '📷 <b>步骤 {step}/{total}：上传地址证明</b>\n\n🇮🇪 <b>爱尔兰</b>接受：水电气账单（ESB等）、银行对账单或税务通知。\n<b>3个月内</b>，显示全名 + 爱尔兰地址（含<b>Eircode</b>）。',
          hi: '📷 <b>चरण {step}/{total}: पता प्रमाण</b>\n\n🇮🇪 <b>आयरलैंड</b> — यूटिलिटी बिल (ESB, Bord Gáis), बैंक स्टेटमेंट, या राजस्व नोटिस।\n<b>3 महीने</b> के भीतर, पूरा नाम + आयरिश पता + <b>Eircode</b>।',
        },
      },
    ],
  },
  'AU:mobile': {
    tier: 3,
    regulationSid: 'RN6a355ad38b79bb02b8a50d28cb7b9c4b',
    endUserFields: ['first_name', 'last_name'],
    textInputs: [...NAME_INPUTS],
    docs: [
      {
        key: 'id_photo',
        requirement: 'name_info',
        type: 'government_issued_document',
        fields: { from: ['first_name', 'last_name'] },
        prompt: {
          en: '📷 <b>Step {step}/{total}: Upload Government ID</b>\n\n🇦🇺 <b>Australia</b> accepts one of:\n• Valid <b>passport</b> (bio data page)\n• Australian <b>driver licence</b>\n• <b>Proof of Age card</b>\n• <b>ImmiCard</b>\n\n⚠️ Must clearly show your <b>full name</b> and <b>photo</b>.\nDocument must <b>not be expired</b>.',
          fr: '📷 <b>Étape {step}/{total}: Pièce d\'identité</b>\n\n🇦🇺 <b>Australie</b> — passeport, permis de conduire AU, ou ImmiCard.\nNom complet et photo requis. <b>Non expiré</b>.',
          zh: '📷 <b>步骤 {step}/{total}：上传政府身份证</b>\n\n🇦🇺 <b>澳大利亚</b>接受：护照、驾照或ImmiCard。\n必须显示全名和照片。<b>不得过期</b>。',
          hi: '📷 <b>चरण {step}/{total}: सरकारी ID</b>\n\n🇦🇺 <b>ऑस्ट्रेलिया</b> — पासपोर्ट, ड्राइवर लाइसेंस, या ImmiCard।\nपूरा नाम और फ़ोटो। <b>समाप्त नहीं</b>।',
        },
      },
      {
        key: 'address_proof',
        requirement: 'address_proof_of_address_info',
        type: 'utility_bill',
        fields: { needsAddress: true },
        prompt: {
          en: '📷 <b>Step {step}/{total}: Upload Address Proof</b>\n\n🇦🇺 <b>Australia</b> accepts one of:\n• <b>Utility bill</b> (electricity, gas, water, internet) — ❌ <b>not</b> mobile phone bill\n• <b>Bank statement</b>\n• <b>ATO tax notice</b>\n• <b>Rates notice</b> from local council\n\n⚠️ Must be dated <b>within the last 3 months</b>.\nMust show your <b>full name</b> + <b>Australian address</b>.\n❌ No screenshots — photograph the <b>physical document</b> or use the official PDF.',
          fr: '📷 <b>Étape {step}/{total}: Preuve d\'adresse</b>\n\n🇦🇺 <b>Australie</b> — facture, relevé bancaire, ou avis ATO.\nDaté de <b>moins de 3 mois</b>. Nom + adresse australienne.',
          zh: '📷 <b>步骤 {step}/{total}：上传地址证明</b>\n\n🇦🇺 <b>澳大利亚</b>接受：水电气账单、银行对账单或ATO税单。\n<b>3个月内</b>，显示全名和澳大利亚地址。',
          hi: '📷 <b>चरण {step}/{total}: पता प्रमाण</b>\n\n🇦🇺 <b>ऑस्ट्रेलिया</b> — यूटिलिटी बिल, बैंक स्टेटमेंट, या ATO नोटिस।\n<b>3 महीने</b> के भीतर, पूरा नाम + ऑस्ट्रेलियाई पता।',
        },
      },
    ],
  },
  'NZ:local': {
    tier: 3,
    regulationSid: 'RNe2f0ecbb762d18238fed0634e5af27d9',
    endUserFields: ['first_name', 'last_name'],
    textInputs: [...NAME_INPUTS],
    docs: [
      {
        key: 'id_photo',
        requirement: 'name_info',
        type: 'government_issued_document',
        fields: { from: ['first_name', 'last_name'] },
        prompt: {
          en: '📷 <b>Step {step}/{total}: Upload Government ID</b>\n\n🇳🇿 <b>New Zealand</b> accepts one of:\n• Valid <b>passport</b> (bio data page)\n• NZ <b>driver licence</b>\n\n⚠️ Must clearly show your <b>full name</b> and <b>photo</b>.\nDocument must <b>not be expired</b>.',
          fr: '📷 <b>Étape {step}/{total}: Pièce d\'identité</b>\n\n🇳🇿 <b>Nouvelle-Zélande</b> — passeport ou permis de conduire NZ.\nNom complet et photo. <b>Non expiré</b>.',
          zh: '📷 <b>步骤 {step}/{total}：上传身份证件</b>\n\n🇳🇿 <b>新西兰</b>接受：护照或驾照。\n必须显示全名和照片。<b>不得过期</b>。',
          hi: '📷 <b>चरण {step}/{total}: सरकारी ID</b>\n\n🇳🇿 <b>न्यूज़ीलैंड</b> — पासपोर्ट या NZ ड्राइवर लाइसेंस।\nपूरा नाम और फ़ोटो। <b>समाप्त नहीं</b>।',
        },
      },
      {
        key: 'address_proof',
        requirement: 'address_proof_info',
        type: 'utility_bill',
        fields: { needsAddress: true },
        prompt: {
          en: '📷 <b>Step {step}/{total}: Upload Address Proof</b>\n\n🇳🇿 <b>New Zealand</b> accepts one of:\n• <b>Utility bill</b> (power, water, gas, internet) — ❌ <b>not</b> mobile phone bill\n• <b>Bank statement</b>\n• <b>IRD correspondence</b>\n• <b>Tenancy agreement</b>\n\n⚠️ Must be dated <b>within the last 3 months</b>.\nMust show your <b>full name</b> + <b>New Zealand address</b>.\n❌ No screenshots — photograph the <b>physical document</b> or use the official PDF.',
          fr: '📷 <b>Étape {step}/{total}: Preuve d\'adresse</b>\n\n🇳🇿 <b>Nouvelle-Zélande</b> — facture, relevé bancaire, ou IRD.\nDaté de <b>moins de 3 mois</b>. Nom + adresse NZ.',
          zh: '📷 <b>步骤 {step}/{total}：上传地址证明</b>\n\n🇳🇿 <b>新西兰</b>接受：水电气账单、银行对账单或IRD通信。\n<b>3个月内</b>，显示全名和NZ地址。',
          hi: '📷 <b>चरण {step}/{total}: पता प्रमाण</b>\n\n🇳🇿 <b>न्यूज़ीलैंड</b> — यूटिलिटी बिल, बैंक स्टेटमेंट, या IRD।\n<b>3 महीने</b> के भीतर, पूरा नाम + NZ पता।',
        },
      },
    ],
  },
  'HK:mobile': {
    tier: 3,
    regulationSid: 'RN4ff8a1464f14f638da9d9f53a0f53e16',
    endUserFields: ['first_name', 'last_name', 'birth_date'],
    textInputs: [
      ...NAME_INPUTS,
      { key: 'birth_date', prompt: { en: '📅 Enter your date of birth (YYYY-MM-DD):', fr: '📅 Entrez votre date de naissance (AAAA-MM-JJ) :', zh: '📅 输入您的出生日期（YYYY-MM-DD）：', hi: '📅 अपनी जन्म तिथि दर्ज करें (YYYY-MM-DD):' } },
    ],
    docs: [
      {
        key: 'id_photo',
        requirement: 'name_info',
        type: 'passport',
        fields: { from: ['first_name', 'last_name', 'birth_date'] },
        prompt: {
          en: '📷 <b>Step {step}/{total}: Upload Passport or ID Card</b>\n\n🇭🇰 <b>Hong Kong</b> accepts one of:\n• Valid <b>passport</b> (bio data page)\n• <b>HKID card</b> (front side)\n\n⚠️ Must clearly show: <b>full name</b>, <b>date of birth</b>, and <b>photo</b>.\nDocument must <b>not be expired</b>.',
          fr: '📷 <b>Étape {step}/{total}: Passeport ou carte d\'identité</b>\n\n🇭🇰 <b>Hong Kong</b> — passeport ou HKID.\nNom, date de naissance et photo requis.',
          zh: '📷 <b>步骤 {step}/{total}：上传护照或身份证</b>\n\n🇭🇰 <b>香港</b>接受：有效护照或HKID卡。\n必须显示<b>姓名</b>、<b>出生日期</b>和<b>照片</b>。',
          hi: '📷 <b>चरण {step}/{total}: पासपोर्ट या ID कार्ड</b>\n\n🇭🇰 <b>हॉन्ग कॉन्ग</b> — पासपोर्ट या HKID।\nनाम, जन्म तिथि और फ़ोटो दिखना चाहिए।',
        },
      },
      {
        key: 'address_proof',
        requirement: 'address_proof_info',
        type: 'utility_bill',
        fields: { needsAddress: true },
        prompt: {
          en: '📷 <b>Step {step}/{total}: Upload Address Proof</b>\n\n🇭🇰 <b>Hong Kong</b> accepts one of:\n• <b>Utility bill</b> (CLP, HK Electric, Towngas, Water Supplies)\n• <b>Bank statement</b>\n• <b>Government correspondence</b>\n\n⚠️ Must be dated <b>within the last 3 months</b>.\nMust show your <b>full name</b> + <b>Hong Kong address</b>.\n❌ No screenshots — photograph the <b>physical document</b> or use the official PDF.',
          fr: '📷 <b>Étape {step}/{total}: Preuve d\'adresse</b>\n\n🇭🇰 <b>Hong Kong</b> — facture de services, relevé bancaire, ou correspondance officielle.\nDaté de <b>moins de 3 mois</b>.',
          zh: '📷 <b>步骤 {step}/{total}：上传地址证明</b>\n\n🇭🇰 <b>香港</b>接受：水电气账单、银行对账单或政府信函。\n<b>3个月内</b>，显示全名和香港地址。',
          hi: '📷 <b>चरण {step}/{total}: पता प्रमाण</b>\n\n🇭🇰 <b>हॉन्ग कॉन्ग</b> — यूटिलिटी बिल, बैंक स्टेटमेंट, या सरकारी पत्र।\n<b>3 महीने</b> के भीतर, पूरा नाम + HK पता।',
        },
      },
    ],
  },
  'CZ:local': {
    tier: 3,
    regulationSid: 'RN70bc36ffeee3549155743b66860930ec',
    endUserFields: ['first_name', 'last_name', 'birth_date'],
    textInputs: [
      ...NAME_INPUTS,
      { key: 'birth_date', prompt: { en: '📅 Enter your date of birth (YYYY-MM-DD):', fr: '📅 Date de naissance (AAAA-MM-JJ) :', zh: '📅 出生日期（YYYY-MM-DD）：', hi: '📅 जन्म तिथि (YYYY-MM-DD):' } },
      { key: 'birth_registration_number', prompt: { en: '🔢 Enter your birth registration number:', fr: '🔢 Numéro d\'enregistrement de naissance :', zh: '🔢 出生登记号码：', hi: '🔢 जन्म पंजीकरण संख्या:' } },
    ],
    docs: [
      {
        key: 'address_proof',
        requirement: 'address_proof_info',
        type: 'utility_bill',
        fields: { needsAddress: true },
        prompt: {
          en: '📷 <b>Step {step}/{total}: Upload Address Proof</b>\n\n🇨🇿 <b>Czech Republic</b> accepts one of:\n• <b>Utility bill</b> (electricity, gas, water)\n• <b>Bank statement</b>\n• Czech <b>ID card</b> showing address\n• <b>Tax notice</b>\n\n⚠️ Must be dated <b>within the last 3 months</b> (for bills).\nMust show your <b>full name</b> + <b>Czech Republic address</b>.\n❌ No screenshots — photograph the <b>physical document</b> or use the official PDF.',
          fr: '📷 <b>Étape {step}/{total}: Preuve d\'adresse</b>\n\n🇨🇿 <b>République tchèque</b> — facture, relevé bancaire, carte d\'identité CZ, ou avis fiscal.\nDaté de <b>moins de 3 mois</b>. Nom + adresse CZ.',
          zh: '📷 <b>步骤 {step}/{total}：上传地址证明</b>\n\n🇨🇿 <b>捷克共和国</b>接受：水电气账单、银行对账单、捷克ID卡或税单。\n<b>3个月内</b>，显示全名和捷克地址。',
          hi: '📷 <b>चरण {step}/{total}: पता प्रमाण</b>\n\n🇨🇿 <b>चेक गणराज्य</b> — यूटिलिटी बिल, बैंक स्टेटमेंट, या CZ ID कार्ड।\n<b>3 महीने</b> के भीतर, पूरा नाम + चेक पता।',
        },
      },
    ],
  },
  'MY:local': {
    tier: 3,
    regulationSid: 'RNb24b8f081b299f6efb9fa30c5730184a',
    endUserFields: ['first_name', 'last_name'],
    textInputs: [...NAME_INPUTS],
    docs: [
      {
        key: 'id_photo',
        requirement: 'name_info',
        type: 'passport',
        fields: { from: ['first_name', 'last_name'] },
        prompt: {
          en: '📷 <b>Step {step}/{total}: Upload Passport</b>\n\n🇲🇾 <b>Malaysia</b> requires:\n• Valid <b>passport</b> (bio data page showing full name, nationality, and photo)\n\n⚠️ Must <b>not be expired</b>.\nThe name must match what you entered above.',
          fr: '📷 <b>Étape {step}/{total}: Passeport</b>\n\n🇲🇾 <b>Malaisie</b> — passeport valide (page bio, nom, nationalité, photo). <b>Non expiré</b>.',
          zh: '📷 <b>步骤 {step}/{total}：上传护照</b>\n\n🇲🇾 <b>马来西亚</b>要求：有效护照（显示全名、国籍和照片）。<b>不得过期</b>。',
          hi: '📷 <b>चरण {step}/{total}: पासपोर्ट</b>\n\n🇲🇾 <b>मलेशिया</b> — वैध पासपोर्ट (बायो पेज, नाम, राष्ट्रीयता, फ़ोटो)। <b>समाप्त नहीं</b>।',
        },
      },
      {
        key: 'address_proof',
        requirement: 'address_proof_info',
        type: 'government_issued_document',
        fields: { needsAddress: true },
        prompt: {
          en: '📷 <b>Step {step}/{total}: Upload Address Proof</b>\n\n🇲🇾 <b>Malaysia</b> accepts one of:\n• <b>MyKad</b> (Malaysian IC) showing address\n• <b>Work permit</b> with local address\n• <b>Utility bill</b> with Malaysian address\n\n⚠️ Must show your <b>full name</b> + <b>Malaysian address</b>.\nFor bills, must be dated <b>within the last 3 months</b>.\n❌ No screenshots — photograph the <b>physical document</b> or use the official PDF.',
          fr: '📷 <b>Étape {step}/{total}: Preuve d\'adresse</b>\n\n🇲🇾 <b>Malaisie</b> — MyKad, permis de travail, ou facture avec adresse malaisienne.\nNom + adresse locale.',
          zh: '📷 <b>步骤 {step}/{total}：上传地址证明</b>\n\n🇲🇾 <b>马来西亚</b>接受：MyKad、工作许可或带有马来西亚地址的账单。\n显示全名和马来西亚地址。',
          hi: '📷 <b>चरण {step}/{total}: पता प्रमाण</b>\n\n🇲🇾 <b>मलेशिया</b> — MyKad, कार्य परमिट, या यूटिलिटी बिल।\nपूरा नाम + मलेशियाई पता।',
        },
      },
    ],
  },

  // ═══ Tier 4: Heavy documentation ═══
  'PL:mobile': {
    tier: 4,
    regulationSid: 'RN233736af8eb71fba1d9b8a92ab711533',
    endUserFields: ['first_name', 'last_name'],
    textInputs: [
      ...NAME_INPUTS,
      { key: 'document_number', prompt: { en: '🔢 Enter your PESEL / National ID number:', fr: '🔢 Entrez votre numéro PESEL / ID :', zh: '🔢 输入您的PESEL/身份证号码：', hi: '🔢 अपना PESEL/राष्ट्रीय ID नंबर दर्ज करें:' } },
    ],
    docs: [
      {
        key: 'id_photo',
        requirement: ['name_info', 'identity_doc_no_info'], // Combined: one doc covers both
        type: 'government_issued_document',
        fields: { from: ['first_name', 'last_name', 'document_number'] },
        prompt: {
          en: '📷 <b>Step {step}/{total}: Upload Government ID</b>\n\n🇵🇱 <b>Poland</b> accepts one of:\n• Valid <b>passport</b> (bio data page)\n• Polish <b>dowód osobisty</b> (national ID card, front side)\n\n⚠️ Must clearly show: <b>full name</b>, <b>PESEL number</b>, and <b>photo</b>.\nDocument must <b>not be expired</b>.',
          fr: '📷 <b>Étape {step}/{total}: Pièce d\'identité</b>\n\n🇵🇱 <b>Pologne</b> — passeport ou dowód osobisty.\nNom, PESEL et photo requis. <b>Non expiré</b>.',
          zh: '📷 <b>步骤 {step}/{total}：上传身份证件</b>\n\n🇵🇱 <b>波兰</b>接受：护照或dowód osobisty。\n必须显示全名、PESEL号码和照片。<b>不得过期</b>。',
          hi: '📷 <b>चरण {step}/{total}: सरकारी ID</b>\n\n🇵🇱 <b>पोलैंड</b> — पासपोर्ट या dowód osobisty।\nपूरा नाम, PESEL और फ़ोटो। <b>समाप्त नहीं</b>।',
        },
      },
    ],
  },
  'ZA:local': {
    tier: 4,
    regulationSid: 'RNfdbc42b99946ad45548d7f7e036036e9',
    endUserFields: ['first_name', 'last_name', 'nationality'],
    textInputs: [
      ...NAME_INPUTS,
      { key: 'nationality', prompt: { en: '🌍 Enter your nationality (2-letter code, e.g. ZA, US, GB):', fr: '🌍 Nationalité (code 2 lettres) :', zh: '🌍 国籍（2位代码，如 ZA、US）：', hi: '🌍 राष्ट्रीयता (2-अक्षर कोड, जैसे ZA):' } },
      { key: 'document_number', prompt: { en: '🔢 Enter your ID / passport document number:', fr: '🔢 Numéro de document ID / passeport :', zh: '🔢 身份证/护照号码：', hi: '🔢 ID/पासपोर्ट दस्तावेज़ संख्या:' } },
    ],
    docs: [
      {
        key: 'id_photo',
        requirement: ['name_info', 'identity_doc_no_info'], // Combined: one doc covers both
        type: 'government_issued_document',
        fields: { from: ['first_name', 'last_name', 'document_number'] },
        prompt: {
          en: '📷 <b>Step {step}/{total}: Upload Government ID</b>\n\n🇿🇦 <b>South Africa</b> accepts one of:\n• Valid <b>passport</b> (bio data page)\n• SA <b>Smart ID card</b> (front side)\n• SA <b>green ID book</b> (photo page)\n\n⚠️ Must clearly show: <b>full name</b>, <b>ID/document number</b>, and <b>photo</b>.\nDocument must <b>not be expired</b>.',
          fr: '📷 <b>Étape {step}/{total}: Pièce d\'identité</b>\n\n🇿🇦 <b>Afrique du Sud</b> — passeport, Smart ID, ou green ID book.\nNom, numéro de document et photo. <b>Non expiré</b>.',
          zh: '📷 <b>步骤 {step}/{total}：上传政府身份证</b>\n\n🇿🇦 <b>南非</b>接受：护照、Smart ID卡或绿色ID本。\n全名、证件号码和照片。<b>不得过期</b>。',
          hi: '📷 <b>चरण {step}/{total}: सरकारी ID</b>\n\n🇿🇦 <b>दक्षिण अफ्रीका</b> — पासपोर्ट, Smart ID, या green ID book।\nपूरा नाम, दस्तावेज़ संख्या और फ़ोटो। <b>समाप्त नहीं</b>।',
        },
      },
      {
        key: 'address_proof',
        requirement: 'address_proof_info',
        type: 'tax_document',
        fields: { needsAddress: true },
        prompt: {
          en: '📷 <b>Step {step}/{total}: Upload Address Proof</b>\n\n🇿🇦 <b>South Africa</b> accepts one of:\n• <b>SARS tax invoice</b> or notice\n• <b>Utility bill</b> (Eskom, municipality water/electricity)\n• <b>Landline phone bill</b> (❌ <b>not</b> mobile phone bill)\n• <b>Driver\'s licence card</b> showing address\n\n⚠️ Must be dated <b>within the last 3 months</b>.\nMust show your <b>full name</b> + <b>South African address</b>.\n❌ No screenshots — photograph the <b>physical document</b> or use the official PDF.',
          fr: '📷 <b>Étape {step}/{total}: Preuve d\'adresse</b>\n\n🇿🇦 <b>Afrique du Sud</b> — facture SARS, Eskom, ou permis de conduire.\nDaté de <b>moins de 3 mois</b>. Nom + adresse SA.',
          zh: '📷 <b>步骤 {step}/{total}：上传地址证明</b>\n\n🇿🇦 <b>南非</b>接受：SARS税单、Eskom账单或驾照卡。\n<b>3个月内</b>，显示全名和南非地址。',
          hi: '📷 <b>चरण {step}/{total}: पता प्रमाण</b>\n\n🇿🇦 <b>दक्षिण अफ्रीका</b> — SARS टैक्स, Eskom बिल, या ड्राइवर लाइसेंस कार्ड।\n<b>3 महीने</b> के भीतर, पूरा नाम + SA पता।',
        },
      },
    ],
  },
  'KE:local': {
    tier: 4,
    regulationSid: 'RNf43905e9964bd0aed907a5e5ec305bde',
    endUserFields: ['first_name', 'last_name', 'birth_date'],
    textInputs: [
      ...NAME_INPUTS,
      { key: 'birth_date', prompt: { en: '📅 Enter your date of birth (YYYY-MM-DD):', fr: '📅 Date de naissance (AAAA-MM-JJ) :', zh: '📅 出生日期（YYYY-MM-DD）：', hi: '📅 जन्म तिथि (YYYY-MM-DD):' } },
    ],
    docs: [
      {
        key: 'id_photo',
        requirement: ['proof_of_identity_info', 'proof_of_date_of_birth_info'], // Combined: one doc covers both
        type: 'government_issued_document',
        fields: { from: ['first_name', 'last_name', 'birth_date'] },
        prompt: {
          en: '📷 <b>Step {step}/{total}: Upload Government ID</b>\n\n🇰🇪 <b>Kenya</b> accepts one of:\n• Valid <b>passport</b> (bio data page showing name + date of birth)\n• Kenyan <b>national ID card</b> (Huduma Namba)\n\n⚠️ Must clearly show: <b>full name</b>, <b>date of birth</b>, and <b>photo</b>.\nDocument must <b>not be expired</b>.',
          fr: '📷 <b>Étape {step}/{total}: Pièce d\'identité</b>\n\n🇰🇪 <b>Kenya</b> — passeport ou carte Huduma Namba.\nNom, date de naissance et photo. <b>Non expiré</b>.',
          zh: '📷 <b>步骤 {step}/{total}：上传身份证件</b>\n\n🇰🇪 <b>肯尼亚</b>接受：护照或Huduma Namba卡。\n全名、出生日期和照片。<b>不得过期</b>。',
          hi: '📷 <b>चरण {step}/{total}: सरकारी ID</b>\n\n🇰🇪 <b>केन्या</b> — पासपोर्ट या Huduma Namba कार्ड।\nपूरा नाम, जन्म तिथि और फ़ोटो। <b>समाप्त नहीं</b>।',
        },
      },
      {
        key: 'address_proof',
        requirement: 'proof_of_local_address_info',
        type: 'utility_bill',
        fields: { needsAddress: true },
        prompt: {
          en: '📷 <b>Step {step}/{total}: Upload Local Address Proof</b>\n\n🇰🇪 <b>Kenya</b> accepts one of:\n• <b>Utility bill</b> (KPLC electricity, water, internet)\n• <b>Bank statement</b>\n• <b>KRA PIN certificate</b>\n• <b>Rent receipt</b>\n\n⚠️ Must be dated <b>within the last 3 months</b>.\nMust show your <b>full name</b> + <b>Kenyan address</b>.\n❌ No screenshots — photograph the <b>physical document</b> or use the official PDF.',
          fr: '📷 <b>Étape {step}/{total}: Preuve d\'adresse locale</b>\n\n🇰🇪 <b>Kenya</b> — facture KPLC, relevé bancaire, ou KRA PIN.\nDaté de <b>moins de 3 mois</b>. Nom + adresse kenyane.',
          zh: '📷 <b>步骤 {step}/{total}：上传本地地址证明</b>\n\n🇰🇪 <b>肯尼亚</b>接受：KPLC电费、银行对账单或KRA PIN证书。\n<b>3个月内</b>，显示全名和肯尼亚地址。',
          hi: '📷 <b>चरण {step}/{total}: स्थानीय पता प्रमाण</b>\n\n🇰🇪 <b>केन्या</b> — KPLC बिल, बैंक स्टेटमेंट, या KRA PIN।\n<b>3 महीने</b> के भीतर, पूरा नाम + केन्याई पता।',
        },
      },
    ],
  },
  'TH:mobile': {
    tier: 4,
    regulationSid: 'RN018e13df8a6e314c7ff5be1358090b68',
    endUserFields: ['first_name', 'last_name', 'phone_number', 'identification_document_number'],
    textInputs: [
      ...NAME_INPUTS,
      { key: 'phone_number', prompt: { en: '📱 Enter your phone number (with country code):', fr: '📱 Numéro de téléphone (avec code pays) :', zh: '📱 电话号码（含国家代码）：', hi: '📱 फ़ोन नंबर (देश कोड सहित):' } },
      { key: 'identification_document_number', prompt: { en: '🔢 Enter your Thai ID or passport number:', fr: '🔢 Numéro d\'identité thaïlandaise ou passeport :', zh: '🔢 泰国身份证或护照号码：', hi: '🔢 थाई ID या पासपोर्ट नंबर:' } },
    ],
    docs: [
      {
        key: 'id_photo',
        requirement: 'proof_of_identity_info',
        type: 'passport',
        fields: { from: ['first_name', 'last_name', 'identification_document_number'] },
        prompt: {
          en: '📷 <b>Step {step}/{total}: Upload ID Card or Passport</b>\n\n🇹🇭 <b>Thailand</b> accepts one of:\n• Valid <b>passport</b> (bio data page)\n• Thai <b>national ID card</b> (บัตรประชาชน, front side)\n\n⚠️ Must clearly show: <b>full name</b>, <b>ID number</b>, and <b>photo</b>.\nDocument must <b>not be expired</b>.',
          fr: '📷 <b>Étape {step}/{total}: Carte d\'identité ou passeport</b>\n\n🇹🇭 <b>Thaïlande</b> — passeport ou carte d\'identité thaïlandaise.\nNom, numéro et photo. <b>Non expiré</b>.',
          zh: '📷 <b>步骤 {step}/{total}：上传ID卡或护照</b>\n\n🇹🇭 <b>泰国</b>接受：护照或泰国身份证。\n全名、ID号码和照片。<b>不得过期</b>。',
          hi: '📷 <b>चरण {step}/{total}: ID कार्ड या पासपोर्ट</b>\n\n🇹🇭 <b>थाईलैंड</b> — पासपोर्ट या थाई ID कार्ड।\nपूरा नाम, ID नंबर और फ़ोटो। <b>समाप्त नहीं</b>।',
        },
      },
      {
        key: 'address_proof',
        requirement: 'proof_of_address_info',
        type: 'utility_bill',
        fields: { needsAddress: true },
        prompt: {
          en: '📷 <b>Step {step}/{total}: Upload Address Proof</b>\n\n🇹🇭 <b>Thailand</b> accepts one of:\n• <b>Utility bill</b> (MEA/PEA electricity, water, internet)\n• <b>Bank statement</b>\n• <b>House registration</b> (ทะเบียนบ้าน)\n• <b>Tax correspondence</b>\n\n⚠️ Must be dated <b>within the last 3 months</b>.\nMust show your <b>full name</b> + <b>Thai address</b>.\n❌ No screenshots — photograph the <b>physical document</b> or use the official PDF.',
          fr: '📷 <b>Étape {step}/{total}: Preuve d\'adresse</b>\n\n🇹🇭 <b>Thaïlande</b> — facture, relevé bancaire, ou enregistrement de maison.\nDaté de <b>moins de 3 mois</b>. Nom + adresse thaïlandaise.',
          zh: '📷 <b>步骤 {step}/{total}：上传地址证明</b>\n\n🇹🇭 <b>泰国</b>接受：水电账单、银行对账单或房屋登记。\n<b>3个月内</b>，显示全名和泰国地址。',
          hi: '📷 <b>चरण {step}/{total}: पता प्रमाण</b>\n\n🇹🇭 <b>थाईलैंड</b> — यूटिलिटी बिल, बैंक स्टेटमेंट, या हाउस रजिस्ट्रेशन।\n<b>3 महीने</b> के भीतर, पूरा नाम + थाई पता।',
        },
      },
    ],
  },
}

/**
 * Get regulatory config for a country + number type.
 * Returns null for Tier 0 (no docs needed) or if not found.
 */
function getRegConfig(countryCode, numType) {
  const key = `${countryCode}:${numType}`
  const config = COUNTRY_REGS[key]
  if (!config || config.tier === 0) return null
  return config
}

/**
 * Check if a country+numType needs document uploads (Tier 2+).
 */
function needsDocUpload(countryCode, numType) {
  const config = getRegConfig(countryCode, numType)
  return config && config.tier >= 2
}

/**
 * Get the total number of steps (text inputs + photo docs + address if needed).
 */
function getTotalSteps(config) {
  const textSteps = (config.textInputs || []).length
  const docSteps = (config.docs || []).length
  // Address step is always needed (collected separately)
  return textSteps + docSteps
}

/**
 * Get country-specific rejection guidance for a given doc key.
 * Returns an object with language keys, or null if no specific guidance.
 */
function getRejectionGuidance(countryCode, numType, docKey) {
  const key = `${countryCode}:${numType}`
  const guidance = REJECTION_GUIDANCE[key]
  if (!guidance) return null
  return guidance[docKey] || null
}

/**
 * Get ALL rejection guidance for a country+numType.
 * Returns array of { docKey, guidance } objects.
 */
function getAllRejectionGuidance(countryCode, numType) {
  const key = `${countryCode}:${numType}`
  const guidance = REJECTION_GUIDANCE[key]
  if (!guidance) return []
  return Object.entries(guidance).map(([docKey, g]) => ({ docKey, guidance: g }))
}

module.exports = {
  COUNTRY_REGS,
  REJECTION_GUIDANCE,
  PHOTO_TIPS,
  getRegConfig,
  needsDocUpload,
  getTotalSteps,
  getRejectionGuidance,
  getAllRejectionGuidance,
}
