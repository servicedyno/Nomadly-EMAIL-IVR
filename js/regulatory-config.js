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
 */

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

  // ═══ Tier 1: End-user name only (auto-filled, no upload) ═══
  'NL:mobile': {
    tier: 1,
    regulationSid: 'RN094a796ec7631e296e7900a5a8b02031',
    endUserFields: ['first_name', 'last_name'],
    docs: [],
  },
  'FI:mobile': {
    tier: 1,
    regulationSid: 'RN2be8cb3ea08d9dcc15061e9b7ac491f3',
    endUserFields: ['first_name', 'last_name'],
    docs: [],
  },

  // ═══ Tier 2: 1 document upload (ID for name proof) ═══
  'EE:local': {
    tier: 2,
    regulationSid: 'RN6adcd07a287f1476d92c22d06947115b',
    endUserFields: ['first_name', 'last_name'],
    textInputs: [],
    docs: [
      {
        key: 'id_photo',
        requirement: 'name_info',
        type: 'government_issued_document',
        fields: { from: ['first_name', 'last_name'] },
        prompt: {
          en: '📷 <b>Step {step}/{total}: Upload Government ID or Passport</b>\n\nSend a clear photo showing your <b>full name</b>.',
          fr: '📷 <b>Étape {step}/{total}: Téléchargez votre pièce d\'identité</b>\n\nEnvoyez une photo claire montrant votre <b>nom complet</b>.',
          zh: '📷 <b>步骤 {step}/{total}：上传身份证或护照</b>\n\n请发送一张清晰显示<b>全名</b>的照片。',
          hi: '📷 <b>चरण {step}/{total}: सरकारी ID या पासपोर्ट अपलोड करें</b>\n\nअपना <b>पूरा नाम</b> दिखाने वाली स्पष्ट फ़ोटो भेजें।',
        },
      },
    ],
  },
  'EE:mobile': {
    tier: 2,
    regulationSid: 'RN88c2810570ee6cdea58d97e5db9b9c0f',
    endUserFields: ['first_name', 'last_name'],
    textInputs: [],
    docs: [
      {
        key: 'id_photo',
        requirement: 'name_info',
        type: 'government_issued_document',
        fields: { from: ['first_name', 'last_name'] },
        prompt: {
          en: '📷 <b>Step {step}/{total}: Upload Government ID or Passport</b>\n\nSend a clear photo showing your <b>full name</b>.',
          fr: '📷 <b>Étape {step}/{total}: Téléchargez votre pièce d\'identité</b>\n\nEnvoyez une photo claire montrant votre <b>nom complet</b>.',
          zh: '📷 <b>步骤 {step}/{total}：上传身份证或护照</b>\n\n请发送一张清晰显示<b>全名</b>的照片。',
          hi: '📷 <b>चरण {step}/{total}: सरकारी ID या पासपोर्ट अपलोड करें</b>\n\nअपना <b>पूरा नाम</b> दिखाने वाली स्पष्ट फ़ोटो भेजें।',
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
      { key: 'email', prompt: { en: '📧 Enter your email address:', fr: '📧 Entrez votre adresse email :', zh: '📧 输入您的电子邮箱：', hi: '📧 अपना ईमेल पता दर्ज करें:' } },
      { key: 'phone_number', prompt: { en: '📱 Enter your phone number (with country code, e.g. +44...):', fr: '📱 Entrez votre numéro (+code pays) :', zh: '📱 输入您的电话号码（含国家代码）：', hi: '📱 अपना फ़ोन नंबर दर्ज करें (देश कोड सहित):' } },
    ],
    docs: [
      {
        key: 'id_photo',
        requirement: 'proof_of_identity',
        type: 'government_issued_document',
        fields: { from: ['first_name', 'last_name'] },
        prompt: {
          en: '📷 <b>Step {step}/{total}: Upload ID Proof</b>\n\nSend a photo of your <b>Government ID or Passport</b> (showing full name).',
          fr: '📷 <b>Étape {step}/{total}: Preuve d\'identité</b>\n\nEnvoyez une photo de votre <b>pièce d\'identité</b>.',
          zh: '📷 <b>步骤 {step}/{total}：上传身份证明</b>\n\n请发送<b>政府身份证或护照</b>的照片。',
          hi: '📷 <b>चरण {step}/{total}: पहचान प्रमाण अपलोड करें</b>\n\n<b>सरकारी ID या पासपोर्ट</b> की फ़ोटो भेजें।',
        },
      },
      {
        key: 'address_proof',
        requirement: 'individual_address_info',
        type: 'individual_address',
        fields: { needsAddress: true },
        prompt: {
          en: '📷 <b>Step {step}/{total}: Upload Address Proof</b>\n\nSend a photo of a <b>utility bill, bank statement, or government letter</b> showing your address.',
          fr: '📷 <b>Étape {step}/{total}: Preuve d\'adresse</b>\n\nEnvoyez une photo d\'une <b>facture ou relevé</b> montrant votre adresse.',
          zh: '📷 <b>步骤 {step}/{total}：上传地址证明</b>\n\n请发送<b>水电费账单或银行对账单</b>照片。',
          hi: '📷 <b>चरण {step}/{total}: पता प्रमाण अपलोड करें</b>\n\n<b>बिजली बिल, बैंक स्टेटमेंट</b> की फ़ोटो भेजें।',
        },
      },
    ],
  },
  'IE:local': {
    tier: 3,
    regulationSid: 'RNc2b0d6e647462e65bcc1479e7130315d',
    endUserFields: ['first_name', 'last_name', 'email'],
    textInputs: [
      { key: 'email', prompt: { en: '📧 Enter your email address:', fr: '📧 Entrez votre adresse email :', zh: '📧 输入您的电子邮箱：', hi: '📧 अपना ईमेल पता दर्ज करें:' } },
    ],
    docs: [
      {
        key: 'id_photo',
        requirement: 'proof_of_identity_info',
        type: 'government_issued_document',
        fields: { from: ['first_name', 'last_name'] },
        prompt: {
          en: '📷 <b>Step {step}/{total}: Upload ID Proof</b>\n\nSend a photo of your <b>Government ID</b> (name visible).',
          fr: '📷 <b>Étape {step}/{total}: Preuve d\'identité</b>\n\nEnvoyez une photo de votre <b>pièce d\'identité</b>.',
          zh: '📷 <b>步骤 {step}/{total}：上传身份证明</b>\n\n请发送<b>政府身份证</b>照片。',
          hi: '📷 <b>चरण {step}/{total}: पहचान प्रमाण</b>\n\n<b>सरकारी ID</b> की फ़ोटो भेजें।',
        },
      },
      {
        key: 'address_proof',
        requirement: 'individual_address_info',
        type: 'utility_bill',
        fields: { needsAddress: true },
        prompt: {
          en: '📷 <b>Step {step}/{total}: Upload Address Proof</b>\n\nSend a photo of a <b>utility bill, tax notice, or rent receipt</b> showing your Irish address (must include Eircode).',
          fr: '📷 <b>Étape {step}/{total}: Preuve d\'adresse</b>\n\nEnvoyez une photo d\'une <b>facture</b> avec votre adresse irlandaise.',
          zh: '📷 <b>步骤 {step}/{total}：上传地址证明</b>\n\n请发送包含爱尔兰地址的<b>账单</b>照片。',
          hi: '📷 <b>चरण {step}/{total}: पता प्रमाण</b>\n\nआयरिश पता दिखाने वाले <b>बिल</b> की फ़ोटो भेजें।',
        },
      },
    ],
  },
  'AU:mobile': {
    tier: 3,
    regulationSid: 'RN6a355ad38b79bb02b8a50d28cb7b9c4b',
    endUserFields: ['first_name', 'last_name'],
    textInputs: [],
    docs: [
      {
        key: 'id_photo',
        requirement: 'name_info',
        type: 'government_issued_document',
        fields: { from: ['first_name', 'last_name'] },
        prompt: {
          en: '📷 <b>Step {step}/{total}: Upload Government ID or Passport</b>\n\nSend a clear photo showing your <b>full name</b>.',
          fr: '📷 <b>Étape {step}/{total}: Pièce d\'identité</b>\n\nEnvoyez une photo avec votre <b>nom complet</b>.',
          zh: '📷 <b>步骤 {step}/{total}：上传身份证或护照</b>\n\n请发送显示<b>全名</b>的照片。',
          hi: '📷 <b>चरण {step}/{total}: ID या पासपोर्ट</b>\n\n<b>पूरा नाम</b> दिखाने वाली फ़ोटो भेजें।',
        },
      },
      {
        key: 'address_proof',
        requirement: 'address_proof_of_address_info',
        type: 'utility_bill',
        fields: { needsAddress: true },
        prompt: {
          en: '📷 <b>Step {step}/{total}: Upload Address Proof</b>\n\nSend a photo of a <b>utility bill, tax notice, or rent receipt</b> showing your Australian address.',
          fr: '📷 <b>Étape {step}/{total}: Preuve d\'adresse</b>\n\nEnvoyez une photo d\'une <b>facture</b> avec votre adresse australienne.',
          zh: '📷 <b>步骤 {step}/{total}：上传地址证明</b>\n\n请发送包含澳大利亚地址的<b>账单</b>照片。',
          hi: '📷 <b>चरण {step}/{total}: पता प्रमाण</b>\n\nऑस्ट्रेलियाई पता दिखाने वाले <b>बिल</b> की फ़ोटो भेजें।',
        },
      },
    ],
  },
  'NZ:local': {
    tier: 3,
    regulationSid: 'RNe2f0ecbb762d18238fed0634e5af27d9',
    endUserFields: ['first_name', 'last_name'],
    textInputs: [],
    docs: [
      {
        key: 'id_photo',
        requirement: 'name_info',
        type: 'government_issued_document',
        fields: { from: ['first_name', 'last_name'] },
        prompt: {
          en: '📷 <b>Step {step}/{total}: Upload Government ID or Passport</b>\n\nSend a clear photo showing your <b>full name</b>.',
          fr: '📷 <b>Étape {step}/{total}: Pièce d\'identité</b>\n\nEnvoyez une photo avec votre <b>nom complet</b>.',
          zh: '📷 <b>步骤 {step}/{total}：上传身份证或护照</b>\n\n请发送显示<b>全名</b>的照片。',
          hi: '📷 <b>चरण {step}/{total}: ID या पासपोर्ट</b>\n\n<b>पूरा नाम</b> दिखाने वाली फ़ोटो भेजें।',
        },
      },
      {
        key: 'address_proof',
        requirement: 'address_proof_info',
        type: 'utility_bill',
        fields: { needsAddress: true },
        prompt: {
          en: '📷 <b>Step {step}/{total}: Upload Address Proof</b>\n\nSend a photo of a <b>utility bill, tax notice, or rent receipt</b> showing your address.',
          fr: '📷 <b>Étape {step}/{total}: Preuve d\'adresse</b>\n\nEnvoyez une photo d\'une <b>facture</b> avec votre adresse.',
          zh: '📷 <b>步骤 {step}/{total}：上传地址证明</b>\n\n请发送包含地址的<b>账单</b>照片。',
          hi: '📷 <b>चरण {step}/{total}: पता प्रमाण</b>\n\nपता दिखाने वाले <b>बिल</b> की फ़ोटो भेजें।',
        },
      },
    ],
  },
  'HK:mobile': {
    tier: 3,
    regulationSid: 'RN4ff8a1464f14f638da9d9f53a0f53e16',
    endUserFields: ['first_name', 'last_name', 'birth_date'],
    textInputs: [
      { key: 'birth_date', prompt: { en: '📅 Enter your date of birth (YYYY-MM-DD):', fr: '📅 Entrez votre date de naissance (AAAA-MM-JJ) :', zh: '📅 输入您的出生日期（YYYY-MM-DD）：', hi: '📅 अपनी जन्म तिथि दर्ज करें (YYYY-MM-DD):' } },
    ],
    docs: [
      {
        key: 'id_photo',
        requirement: 'name_info',
        type: 'passport',
        fields: { from: ['first_name', 'last_name', 'birth_date'] },
        prompt: {
          en: '📷 <b>Step {step}/{total}: Upload Passport or ID Card</b>\n\nSend a photo showing your <b>name and date of birth</b>.',
          fr: '📷 <b>Étape {step}/{total}: Passeport ou carte d\'identité</b>\n\nEnvoyez une photo montrant <b>nom et date de naissance</b>.',
          zh: '📷 <b>步骤 {step}/{total}：上传护照或身份证</b>\n\n请发送显示<b>姓名和出生日期</b>的照片。',
          hi: '📷 <b>चरण {step}/{total}: पासपोर्ट या ID कार्ड</b>\n\n<b>नाम और जन्म तिथि</b> दिखाने वाली फ़ोटो भेजें।',
        },
      },
      {
        key: 'address_proof',
        requirement: 'address_proof_info',
        type: 'utility_bill',
        fields: { needsAddress: true },
        prompt: {
          en: '📷 <b>Step {step}/{total}: Upload Address Proof</b>\n\nSend a photo of a <b>utility bill or bank statement</b> (issued within last 3 months).',
          fr: '📷 <b>Étape {step}/{total}: Preuve d\'adresse</b>\n\nEnvoyez une <b>facture</b> (moins de 3 mois).',
          zh: '📷 <b>步骤 {step}/{total}：上传地址证明</b>\n\n请发送<b>最近3个月内的账单</b>照片。',
          hi: '📷 <b>चरण {step}/{total}: पता प्रमाण</b>\n\n<b>3 महीने के भीतर का बिल</b> की फ़ोटो भेजें।',
        },
      },
    ],
  },
  'CZ:local': {
    tier: 3,
    regulationSid: 'RN70bc36ffeee3549155743b66860930ec',
    endUserFields: ['first_name', 'last_name', 'birth_date'],
    textInputs: [
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
          en: '📷 <b>Step {step}/{total}: Upload Address Proof</b>\n\nSend a photo of a <b>utility bill, tax notice, or ID showing local address</b>.',
          fr: '📷 <b>Étape {step}/{total}: Preuve d\'adresse</b>\n\nEnvoyez une photo avec votre <b>adresse locale</b>.',
          zh: '📷 <b>步骤 {step}/{total}：上传地址证明</b>\n\n请发送显示<b>当地地址的账单</b>照片。',
          hi: '📷 <b>चरण {step}/{total}: पता प्रमाण</b>\n\nस्थानीय पता दिखाने वाले <b>बिल</b> की फ़ोटो भेजें。',
        },
      },
    ],
  },
  'MY:local': {
    tier: 3,
    regulationSid: 'RNb24b8f081b299f6efb9fa30c5730184a',
    endUserFields: ['first_name', 'last_name'],
    textInputs: [],
    docs: [
      {
        key: 'id_photo',
        requirement: 'name_info',
        type: 'government_issued_document',
        fields: { from: ['first_name', 'last_name'] },
        prompt: {
          en: '📷 <b>Step {step}/{total}: Upload Government ID or Passport</b>\n\nSend a clear photo showing your <b>full name</b>.',
          fr: '📷 <b>Étape {step}/{total}: Pièce d\'identité</b>\n\nEnvoyez une photo avec votre <b>nom complet</b>.',
          zh: '📷 <b>步骤 {step}/{total}：上传身份证或护照</b>\n\n请发送显示<b>全名</b>的照片。',
          hi: '📷 <b>चरण {step}/{total}: ID या पासपोर्ट</b>\n\n<b>पूरा नाम</b> दिखाने वाली फ़ोटो भेजें。',
        },
      },
      {
        key: 'address_proof',
        requirement: 'address_proof_info',
        type: 'government_issued_document',
        fields: { needsAddress: true },
        prompt: {
          en: '📷 <b>Step {step}/{total}: Upload Address Proof</b>\n\nSend a photo of a <b>Government ID showing local address, work permit, or student ID</b>.',
          fr: '📷 <b>Étape {step}/{total}: Preuve d\'adresse locale</b>\n\nEnvoyez une photo d\'un <b>document avec adresse locale</b>.',
          zh: '📷 <b>步骤 {step}/{total}：上传地址证明</b>\n\n请发送<b>显示当地地址的证件</b>照片。',
          hi: '📷 <b>चरण {step}/{total}: पता प्रमाण</b>\n\nस्थानीय पता दिखाने वाले <b>दस्तावेज़</b> की फ़ोटो भेजें。',
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
      { key: 'document_number', prompt: { en: '🔢 Enter your PESEL / National ID number:', fr: '🔢 Entrez votre numéro PESEL / ID :', zh: '🔢 输入您的PESEL/身份证号码：', hi: '🔢 अपना PESEL/राष्ट्रीय ID नंबर दर्ज करें:' } },
    ],
    docs: [
      {
        key: 'id_photo',
        requirement: ['name_info', 'identity_doc_no_info'], // Combined: one doc covers both
        type: 'government_issued_document',
        fields: { from: ['first_name', 'last_name', 'document_number'] },
        prompt: {
          en: '📷 <b>Step {step}/{total}: Upload Government ID or Passport</b>\n\nSend a photo showing your <b>full name and PESEL/ID number</b>.',
          fr: '📷 <b>Étape {step}/{total}: Pièce d\'identité</b>\n\nEnvoyez une photo montrant <b>nom et numéro PESEL</b>.',
          zh: '📷 <b>步骤 {step}/{total}：上传身份证或护照</b>\n\n请发送显示<b>全名和PESEL号码</b>的照片。',
          hi: '📷 <b>चरण {step}/{total}: ID या पासपोर्ट</b>\n\n<b>पूरा नाम और PESEL नंबर</b> दिखाने वाली फ़ोटो भेजें।',
        },
      },
    ],
  },
  'ZA:local': {
    tier: 4,
    regulationSid: 'RNfdbc42b99946ad45548d7f7e036036e9',
    endUserFields: ['first_name', 'last_name', 'nationality'],
    textInputs: [
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
          en: '📷 <b>Step {step}/{total}: Upload Government ID</b>\n\nSend a photo of your <b>government-issued photo ID</b> (showing full name and document number).',
          fr: '📷 <b>Étape {step}/{total}: Pièce d\'identité officielle</b>\n\nEnvoyez une photo de votre <b>pièce d\'identité</b> (nom et numéro).',
          zh: '📷 <b>步骤 {step}/{total}：上传政府身份证</b>\n\n请发送<b>政府颁发的带照片ID</b>（显示姓名和证件号码）。',
          hi: '📷 <b>चरण {step}/{total}: सरकारी ID अपलोड करें</b>\n\n<b>सरकारी फ़ोटो ID</b> भेजें（नाम और दस्तावेज़ संख्या दिखाएं）।',
        },
      },
      {
        key: 'address_proof',
        requirement: 'address_proof_info',
        type: 'tax_document',
        fields: { needsAddress: true },
        prompt: {
          en: '📷 <b>Step {step}/{total}: Upload Address Proof</b>\n\nSend a photo of a <b>tax invoice, phone bill, or driver\'s license</b> (issued within last 3 months, showing local SA address).',
          fr: '📷 <b>Étape {step}/{total}: Preuve d\'adresse</b>\n\nEnvoyez une <b>facture fiscale ou téléphonique</b> (moins de 3 mois).',
          zh: '📷 <b>步骤 {step}/{total}：上传地址证明</b>\n\n请发送<b>3个月内的税单或电话账单</b>照片。',
          hi: '📷 <b>चरण {step}/{total}: पता प्रमाण</b>\n\n<b>3 महीने के भीतर का टैक्स बिल या फ़ोन बिल</b> भेजें。',
        },
      },
    ],
  },
  'KE:local': {
    tier: 4,
    regulationSid: 'RNf43905e9964bd0aed907a5e5ec305bde',
    endUserFields: ['first_name', 'last_name', 'birth_date'],
    textInputs: [
      { key: 'birth_date', prompt: { en: '📅 Enter your date of birth (YYYY-MM-DD):', fr: '📅 Date de naissance (AAAA-MM-JJ) :', zh: '📅 出生日期（YYYY-MM-DD）：', hi: '📅 जन्म तिथि (YYYY-MM-DD):' } },
    ],
    docs: [
      {
        key: 'id_photo',
        requirement: ['proof_of_identity_info', 'proof_of_date_of_birth_info'], // Combined: one doc covers both
        type: 'government_issued_document',
        fields: { from: ['first_name', 'last_name', 'birth_date'] },
        prompt: {
          en: '📷 <b>Step {step}/{total}: Upload Government ID or Passport</b>\n\nSend a photo showing your <b>full name and date of birth</b>.',
          fr: '📷 <b>Étape {step}/{total}: Pièce d\'identité</b>\n\nEnvoyez une photo montrant <b>nom et date de naissance</b>.',
          zh: '📷 <b>步骤 {step}/{total}：上传身份证或护照</b>\n\n请发送显示<b>全名和出生日期</b>的照片。',
          hi: '📷 <b>चरण {step}/{total}: ID या पासपोर्ट</b>\n\n<b>पूरा नाम और जन्म तिथि</b> दिखाने वाली फ़ोटो भेजें।',
        },
      },
      {
        key: 'address_proof',
        requirement: 'proof_of_local_address_info',
        type: 'utility_bill',
        fields: { needsAddress: true },
        prompt: {
          en: '📷 <b>Step {step}/{total}: Upload Local Address Proof</b>\n\nSend a photo of a <b>utility bill, tax notice, or rent receipt</b> showing your Kenyan address.',
          fr: '📷 <b>Étape {step}/{total}: Preuve d\'adresse locale</b>\n\nEnvoyez une <b>facture</b> avec votre adresse kenyane.',
          zh: '📷 <b>步骤 {step}/{total}：上传本地地址证明</b>\n\n请发送显示<b>肯尼亚地址的账单</b>照片。',
          hi: '📷 <b>चरण {step}/{total}: स्थानीय पता प्रमाण</b>\n\nकेन्याई पता दिखाने वाले <b>बिल</b> की फ़ोटो भेजें。',
        },
      },
    ],
  },
  'TH:mobile': {
    tier: 4,
    regulationSid: 'RN018e13df8a6e314c7ff5be1358090b68',
    endUserFields: ['first_name', 'last_name', 'phone_number', 'identification_document_number'],
    textInputs: [
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
          en: '📷 <b>Step {step}/{total}: Upload ID Card or Passport</b>\n\nSend a photo of your <b>Thai ID card or passport</b> (showing name and ID number).',
          fr: '📷 <b>Étape {step}/{total}: Carte d\'identité ou passeport</b>\n\nEnvoyez une photo de votre <b>pièce d\'identité thaïlandaise</b>.',
          zh: '📷 <b>步骤 {step}/{total}：上传ID卡或护照</b>\n\n请发送<b>泰国身份证或护照</b>照片。',
          hi: '📷 <b>चरण {step}/{total}: ID कार्ड या पासपोर्ट</b>\n\n<b>थाई ID कार्ड या पासपोर्ट</b> की फ़ोटो भेजें。',
        },
      },
      {
        key: 'address_proof',
        requirement: 'proof_of_address_info',
        type: 'utility_bill',
        fields: { needsAddress: true },
        prompt: {
          en: '📷 <b>Step {step}/{total}: Upload Address Proof</b>\n\nSend a photo of a <b>utility bill, tax notice, or rent receipt</b>.',
          fr: '📷 <b>Étape {step}/{total}: Preuve d\'adresse</b>\n\nEnvoyez une <b>facture ou avis d\'imposition</b>.',
          zh: '📷 <b>步骤 {step}/{total}：上传地址证明</b>\n\n请发送<b>账单或税单</b>照片。',
          hi: '📷 <b>चरण {step}/{total}: पता प्रमाण</b>\n\n<b>बिल या टैक्स नोटिस</b> की फ़ोटो भेजें。',
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

module.exports = {
  COUNTRY_REGS,
  getRegConfig,
  needsDocUpload,
  getTotalSteps,
}
