/**
 * regulatory-flow.js — Document collection flow for Twilio Regulatory Compliance.
 *
 * Handles step-by-step collection of personal info and document uploads
 * via Telegram bot, then creates the full Twilio regulatory bundle.
 *
 * Flow:
 *   1. Payment confirmed → startDocCollection()
 *   2. Collect text inputs (name, DOB, nationality, ID number) one by one
 *   3. Collect document photo uploads one by one
 *   4. When all collected → createAndSubmitBundle()
 *   5. BundleChecker auto-purchases number on approval
 */

const fs = require('fs')
const path = require('path')
const axios = require('axios')
const FormData = require('form-data')
const { getRegConfig, getTotalSteps } = require('./regulatory-config')

const UPLOAD_DIR = '/tmp/regulatory-docs'
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })

/**
 * Initialize the regulatory flow module.
 * @param {Object} deps - Dependencies injected from _index.js
 *   - bot: Telegram bot instance
 *   - db: MongoDB database instance
 *   - state: State collection
 *   - pendingBundles: pendingBundles collection
 *   - twilioService: twilio-service module
 *   - send: send() function
 *   - set: set() function
 *   - get: get() function
 *   - log: log() function
 *   - getCachedTwilioAddress: address cache lookup
 *   - cacheTwilioAddress: address cache save
 */
let deps = {}
function init(dependencies) {
  deps = dependencies
  deps.log('[RegulatoryFlow] Initialized')
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// START: Begin document collection after payment
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Start the document collection flow for a Tier 2+ country.
 * Called after payment is confirmed.
 */
async function startDocCollection(chatId, purchaseData, lang) {
  const { countryCode, numType, countryName, selectedNumber, planKey, price, priceUsd, priceNgn, paymentMethod } = purchaseData
  const config = getRegConfig(countryCode, numType)
  if (!config) {
    deps.log(`[RegulatoryFlow] No doc config for ${countryCode}:${numType}, skipping`)
    return false // Not a doc-required country
  }

  deps.log(`[RegulatoryFlow] Starting doc collection for chatId=${chatId} country=${countryCode}:${numType} tier=${config.tier}`)

  // Create session in DB
  const docSessions = deps.db.collection('docSessions')
  const totalSteps = getTotalSteps(config)
  const textInputs = config.textInputs || []
  const docs = config.docs || []

  // Build ordered step list
  // IMPORTANT: doc objects have their own 'type' field (e.g. 'government_issued_document')
  // which is the Twilio Supporting Document type. We must preserve step type as 'photo'
  // so rename the Twilio doc type to 'twilioDocType' to avoid overwriting step.type.
  const steps = []
  textInputs.forEach((ti, i) => steps.push({ type: 'text', ...ti, index: i }))
  docs.forEach((doc, i) => {
    const { type: twilioDocType, ...rest } = doc
    steps.push({ ...rest, type: 'photo', twilioDocType, index: i })
  })

  const session = {
    chatId,
    countryCode,
    numType,
    countryName,
    selectedNumber,
    planKey,
    price,
    priceUsd: priceUsd || 0,
    priceNgn: priceNgn || 0,
    paymentMethod,
    regulationSid: config.regulationSid,
    endUserFields: config.endUserFields || [],
    lang: lang || 'en',
    steps,
    currentStep: 0,
    collectedData: {},    // text inputs: { first_name: '...', document_number: '...' }
    uploadedDocs: {},     // photo doc keys: { id_photo: { filePath: '...', twilioDocSid: '...' }, ... }
    addressSid: null,
    status: 'collecting',
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  // Remove any existing session for this user
  await docSessions.deleteMany({ chatId, status: 'collecting' })
  await docSessions.insertOne(session)

  // Set bot state to document collection mode
  await deps.set(deps.state, chatId, 'action', 'cpDocCollect')

  // Send intro message
  const introMsg = {
    en: `📋 <b>Document Verification Required</b>\n\n${countryName} requires identity verification to activate your number. Please follow the steps below (${totalSteps} steps).\n\nType /cancel anytime to cancel and get a full refund.`,
    fr: `📋 <b>Vérification de documents requise</b>\n\n${countryName} nécessite une vérification d'identité (${totalSteps} étapes).\n\nTapez /cancel pour annuler.`,
    zh: `📋 <b>需要文件验证</b>\n\n${countryName} 需要身份验证以激活号码（${totalSteps}步）。\n\n输入 /cancel 取消并全额退款。`,
    hi: `📋 <b>दस्तावेज़ सत्यापन आवश्यक</b>\n\n${countryName} में नंबर सक्रिय करने के लिए पहचान सत्यापन चाहिए (${totalSteps} चरण)।\n\n/cancel टाइप करें रद्द करने के लिए।`,
  }
  deps.send(chatId, introMsg[lang] || introMsg.en, { parse_mode: 'HTML' })

  // Send first step prompt
  await sendCurrentStepPrompt(chatId, session)
  return true
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HANDLE: Process incoming messages during collection
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Handle a text message during document collection.
 * Returns true if handled, false if not in doc collection mode.
 */
async function handleTextInput(chatId, text, lang) {
  const docSessions = deps.db.collection('docSessions')
  const session = await docSessions.findOne({ chatId, status: 'collecting' })
  if (!session) return false

  const step = session.steps[session.currentStep]
  if (!step) return false

  // Handle /cancel
  if (text === '/cancel') {
    await cancelSession(chatId, session)
    return true
  }

  // Handle "same" for reuse photo
  if (step.type === 'photo' && text.toLowerCase() === 'same' && step.reusePhoto) {
    const reuseKey = step.reusePhoto
    if (session.uploadedDocs[reuseKey]) {
      deps.log(`[RegulatoryFlow] chatId=${chatId} reusing photo from ${reuseKey} for ${step.key}`)
      session.uploadedDocs[step.key] = { ...session.uploadedDocs[reuseKey], reused: true }
      await docSessions.updateOne({ _id: session._id }, {
        $set: {
          [`uploadedDocs.${step.key}`]: session.uploadedDocs[step.key],
          currentStep: session.currentStep + 1,
          updatedAt: new Date(),
        }
      })
      session.currentStep++
      await advanceOrComplete(chatId, session)
      return true
    }
  }

  // If current step expects text, process it
  if (step.type === 'text') {
    const value = text.trim()
    if (!value) {
      deps.send(chatId, '⚠️ Please provide a valid value.', { parse_mode: 'HTML' })
      return true
    }

    // Validate specific fields
    if (step.key === 'birth_date' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      deps.send(chatId, '⚠️ Invalid date format. Please use YYYY-MM-DD (e.g. 1990-05-15).', { parse_mode: 'HTML' })
      return true
    }
    if (step.key === 'nationality' && !/^[A-Z]{2}$/i.test(value)) {
      deps.send(chatId, '⚠️ Please enter a 2-letter country code (e.g. ZA, US, GB).', { parse_mode: 'HTML' })
      return true
    }

    deps.log(`[RegulatoryFlow] chatId=${chatId} text input: ${step.key}=${value}`)
    await docSessions.updateOne({ _id: session._id }, {
      $set: {
        [`collectedData.${step.key}`]: value.toUpperCase && step.key === 'nationality' ? value.toUpperCase() : value,
        currentStep: session.currentStep + 1,
        updatedAt: new Date(),
      }
    })
    session.collectedData[step.key] = value
    session.currentStep++
    await advanceOrComplete(chatId, session)
    return true
  }

  // If step expects photo but got text (and not "same"), tell user
  if (step.type === 'photo') {
    const hint = step.reusePhoto ? ' Or type <b>same</b> to reuse your previous photo.' : ''
    deps.send(chatId, `📷 Please send a <b>photo</b> for this step.${hint}`, { parse_mode: 'HTML' })
    return true
  }

  return true
}

/**
 * Handle a photo message during document collection.
 * Returns true if handled, false if not in doc collection mode.
 */
async function handlePhotoInput(chatId, msg, lang) {
  const docSessions = deps.db.collection('docSessions')
  const session = await docSessions.findOne({ chatId, status: 'collecting' })
  if (!session) return false

  const step = session.steps[session.currentStep]
  if (!step || step.type !== 'photo') {
    deps.send(chatId, '⚠️ Not expecting a photo at this step. Please follow the current prompt.', { parse_mode: 'HTML' })
    return true
  }

  try {
    // Get highest resolution photo
    const photo = msg.photo[msg.photo.length - 1]
    const fileId = photo.file_id
    deps.send(chatId, '⏳ Processing your document...', { parse_mode: 'HTML' })

    // Download photo from Telegram
    const filePath = await downloadTelegramPhoto(fileId, chatId, step.key)
    deps.log(`[RegulatoryFlow] chatId=${chatId} photo downloaded for ${step.key}: ${filePath}`)

    // Upload to Twilio as Supporting Document
    const docSid = await uploadToTwilio(chatId, session, step, filePath)
    deps.log(`[RegulatoryFlow] chatId=${chatId} uploaded to Twilio: ${docSid} for ${step.key}`)

    // Save
    await docSessions.updateOne({ _id: session._id }, {
      $set: {
        [`uploadedDocs.${step.key}`]: { filePath, twilioDocSid: docSid, uploadedAt: new Date() },
        currentStep: session.currentStep + 1,
        updatedAt: new Date(),
      }
    })
    session.uploadedDocs[step.key] = { filePath, twilioDocSid: docSid }
    session.currentStep++
    await advanceOrComplete(chatId, session)
  } catch (err) {
    deps.log(`[RegulatoryFlow] Photo processing error for chatId=${chatId}: ${err.message}`)
    deps.send(chatId, `❌ Error processing document: ${err.message}\n\nPlease try uploading again.`, { parse_mode: 'HTML' })
  }
  return true
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INTERNAL: Step management
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function sendCurrentStepPrompt(chatId, session) {
  const step = session.steps[session.currentStep]
  if (!step) return

  const lang = session.lang || 'en'
  const totalSteps = session.steps.length
  const stepNum = session.currentStep + 1

  let promptText = (step.prompt && (step.prompt[lang] || step.prompt.en)) || 'Please provide the requested information.'
  promptText = promptText.replace('{step}', stepNum).replace('{total}', totalSteps)

  deps.send(chatId, promptText, { parse_mode: 'HTML' })
}

async function advanceOrComplete(chatId, session) {
  if (session.currentStep >= session.steps.length) {
    // All steps done — now collect/confirm address, then create bundle
    await handleAddressAndBundle(chatId, session)
  } else {
    await sendCurrentStepPrompt(chatId, session)
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADDRESS + BUNDLE: Final steps
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function handleAddressAndBundle(chatId, session) {
  const lang = session.lang || 'en'
  const docSessions = deps.db.collection('docSessions')

  // Check for cached address
  const cachedAddr = await deps.getCachedTwilioAddress(chatId, session.countryCode)
  if (cachedAddr) {
    deps.log(`[RegulatoryFlow] Using cached address ${cachedAddr} for chatId=${chatId}`)
    await docSessions.updateOne({ _id: session._id }, { $set: { addressSid: cachedAddr, updatedAt: new Date() } })
    session.addressSid = cachedAddr
    // Proceed to bundle creation
    await createAndSubmitBundle(chatId, session)
  } else {
    // Need to collect address — switch to address collection mode
    deps.log(`[RegulatoryFlow] No cached address for ${chatId}/${session.countryCode}, prompting for address`)
    await docSessions.updateOne({ _id: session._id }, { $set: { status: 'awaiting_address', updatedAt: new Date() } })
    await deps.set(deps.state, chatId, 'action', 'cpDocAddress')

    const addrPrompt = {
      en: `📍 <b>Final Step: Enter Your Address</b>\n\nPlease enter your full address in this format:\n<code>Street, City, State/Region, PostalCode, CountryCode</code>\n\nExample: <code>123 Main St, Cape Town, WC, 8001, ZA</code>`,
      fr: `📍 <b>Dernière étape: Adresse</b>\n\n<code>Rue, Ville, Région, Code postal, Pays</code>`,
      zh: `📍 <b>最后一步：输入地址</b>\n\n<code>街道, 城市, 州/省, 邮编, 国家代码</code>`,
      hi: `📍 <b>अंतिम चरण: पता दर्ज करें</b>\n\n<code>सड़क, शहर, राज्य, पिन कोड, देश कोड</code>`,
    }
    deps.send(chatId, addrPrompt[lang] || addrPrompt.en, { parse_mode: 'HTML' })
  }
}

/**
 * Handle address text input during doc collection.
 * Called from _index.js when user is in cpDocAddress state.
 */
async function handleAddressInput(chatId, text, lang) {
  const docSessions = deps.db.collection('docSessions')
  const session = await docSessions.findOne({ chatId, status: 'awaiting_address' })
  if (!session) return false

  if (text === '/cancel') {
    await cancelSession(chatId, session)
    return true
  }

  // Parse address: Street, City, Region, PostalCode, CountryCode
  const parts = text.split(',').map(p => p.trim())
  if (parts.length < 4) {
    deps.send(chatId, '⚠️ Please enter address as: <code>Street, City, Region, PostalCode, CountryCode</code>', { parse_mode: 'HTML' })
    return true
  }

  const [street, city, region, postalCode, isoCountry] = parts
  const country = (isoCountry || session.countryCode).toUpperCase()

  try {
    deps.send(chatId, '⏳ Creating address...', { parse_mode: 'HTML' })

    // Create Twilio address
    const addrResult = await deps.twilioService.createAddress(
      session.collectedData.first_name || 'User',
      street,
      city,
      region || '',
      postalCode || '00000',
      country
    )

    if (addrResult.error) throw new Error(addrResult.error)

    // Cache the address
    await deps.cacheTwilioAddress(chatId, country, addrResult.sid)

    // Update session
    await docSessions.updateOne({ _id: session._id }, {
      $set: { addressSid: addrResult.sid, status: 'collecting', updatedAt: new Date() }
    })
    session.addressSid = addrResult.sid

    deps.log(`[RegulatoryFlow] Address created ${addrResult.sid} for chatId=${chatId}`)

    // Now create the bundle
    await createAndSubmitBundle(chatId, session)
  } catch (err) {
    deps.log(`[RegulatoryFlow] Address creation error: ${err.message}`)
    deps.send(chatId, `❌ Error creating address: ${err.message}\n\nPlease try again.`, { parse_mode: 'HTML' })
  }
  return true
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BUNDLE: Create and submit the regulatory bundle
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function createAndSubmitBundle(chatId, session) {
  const lang = session.lang || 'en'
  const docSessions = deps.db.collection('docSessions')

  deps.send(chatId, ({ en: '⏳ Creating regulatory bundle...', fr: '⏳ Création du dossier réglementaire...', zh: '⏳ 正在创建监管包...', hi: '⏳ नियामक बंडल बना रहे हैं...' }[lang] || '⏳ Creating regulatory bundle...'), { parse_mode: 'HTML' })

  try {
    const config = getRegConfig(session.countryCode, session.numType)
    if (!config) throw new Error('No regulatory config found')

    // 1. Create End-User
    const endUserAttrs = {}
    // Merge autoFill defaults first (e.g. business_identity=DIRECT_CUSTOMER)
    if (config.autoFill) {
      Object.assign(endUserAttrs, config.autoFill)
    }
    for (const field of config.endUserFields) {
      if (session.collectedData[field]) {
        endUserAttrs[field] = session.collectedData[field]
      } else if (!endUserAttrs[field]) {
        endUserAttrs[field] = 'N/A'
      }
    }
    // Auto-fill email with service email — users should never receive Twilio emails
    if (config.endUserFields.includes('email') && (!endUserAttrs.email || endUserAttrs.email === 'N/A')) {
      endUserAttrs.email = process.env.NOMADLY_SERVICE_EMAIL || 'support@nomadly.com'
    }

    const endUserResult = await deps.twilioService.createEndUser(
      `${endUserAttrs.first_name || 'User'}-${chatId}`,
      'individual',
      endUserAttrs
    )
    if (endUserResult.error) throw new Error(`End-user: ${endUserResult.error}`)
    deps.log(`[RegulatoryFlow] End-user created: ${endUserResult.sid}`)

    // 2. Create Bundle
    const selfUrl = process.env.SELF_URL || process.env.SELF_URL_PROD
    const bundleCallbackUrl = selfUrl ? `${selfUrl}/twilio/bundle-status` : undefined
    const bundleResult = await deps.twilioService.createBundle(
      `Nomadly-${chatId}-${session.countryCode}-${session.numType}`,
      process.env.NOMADLY_SERVICE_EMAIL || 'support@nomadly.com',
      config.regulationSid,
      bundleCallbackUrl
    )
    if (bundleResult.error) throw new Error(`Bundle: ${bundleResult.error}`)
    deps.log(`[RegulatoryFlow] Bundle created: ${bundleResult.sid}`)

    // 3. Add End-User to bundle
    const addEU = await deps.twilioService.addBundleItem(bundleResult.sid, endUserResult.sid)
    if (addEU.error) throw new Error(`Add end-user: ${addEU.error}`)

    // 4. Add all supporting documents to bundle
    const docSids = {}
    for (const doc of (config.docs || [])) {
      const uploaded = session.uploadedDocs[doc.key]
      if (!uploaded || !uploaded.twilioDocSid) {
        deps.log(`[RegulatoryFlow] Warning: No uploaded doc for ${doc.key}, skipping`)
        continue
      }

      // If doc needs address, update the supporting doc with address_sids
      if (doc.fields && doc.fields.needsAddress && session.addressSid) {
        try {
          await updateSupportingDocAddress(uploaded.twilioDocSid, session.addressSid)
        } catch (e) {
          deps.log(`[RegulatoryFlow] Warning: Could not update address on doc ${uploaded.twilioDocSid}: ${e.message}`)
        }
      }

      const addDoc = await deps.twilioService.addBundleItem(bundleResult.sid, uploaded.twilioDocSid)
      if (addDoc.error) {
        deps.log(`[RegulatoryFlow] Warning: addBundleItem for ${doc.key} failed: ${addDoc.error}`)
      } else {
        docSids[doc.key] = uploaded.twilioDocSid
      }
    }

    // 5. Submit for review
    const submitResult = await deps.twilioService.submitBundle(bundleResult.sid)
    if (submitResult.error) throw new Error(`Submit: ${submitResult.error}`)
    const bundleStatus = submitResult.status || 'pending-review'
    deps.log(`[RegulatoryFlow] Bundle submitted: ${bundleResult.sid} status=${bundleStatus}`)

    // 6. Save to pendingBundles collection
    await deps.db.collection('pendingBundles').insertOne({
      chatId,
      bundleSid: bundleResult.sid,
      endUserSid: endUserResult.sid,
      addressSid: session.addressSid,
      supportingDocSids: docSids,
      regulationSid: config.regulationSid,
      countryCode: session.countryCode,
      countryName: session.countryName,
      numType: session.numType,
      selectedNumber: session.selectedNumber,
      planKey: session.planKey,
      price: session.price,
      priceUsd: session.priceUsd,
      priceNgn: session.priceNgn,
      paymentMethod: session.paymentMethod,
      lang: session.lang,
      status: bundleStatus,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    // 7. Update session status
    await docSessions.updateOne({ _id: session._id }, { $set: { status: 'submitted', bundleSid: bundleResult.sid, updatedAt: new Date() } })
    await deps.set(deps.state, chatId, 'action', 'none')

    // 8. Notify user
    const successMsg = {
      en: `📋 <b>Regulatory Approval Submitted</b>\n\n${session.countryName} number verification submitted (1-3 business days).\nYour <b>$${Number(session.price).toFixed(2)}</b> is held securely. You'll be notified when approved or refunded.`,
      fr: `📋 <b>Approbation soumise</b>\n\nVérification soumise (1-3 jours ouvrables).\nVotre <b>$${Number(session.price).toFixed(2)}</b> est sécurisé.`,
      zh: `📋 <b>监管审批已提交</b>\n\n验证已提交（1-3个工作日）。\n您的 <b>$${Number(session.price).toFixed(2)}</b> 已安全持有。`,
      hi: `📋 <b>नियामक अनुमोदन प्रस्तुत</b>\n\nसत्यापन प्रस्तुत (1-3 कार्य दिवस)।\nआपका <b>$${Number(session.price).toFixed(2)}</b> सुरक्षित है।`,
    }
    deps.send(chatId, successMsg[lang] || successMsg.en, { parse_mode: 'HTML' })

    // Notify admin
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID
    if (adminChatId) {
      try {
        deps.send(Number(adminChatId), `📋 [RegulatoryFlow] Bundle submitted\nchatId: ${chatId}\nbundle: ${bundleResult.sid}\ncountry: ${session.countryCode} ${session.numType}\nnumber: ${session.selectedNumber}\nstatus: ${bundleStatus}`)
      } catch (e) { /* ignore */ }
    }

  } catch (err) {
    deps.log(`[RegulatoryFlow] Bundle creation error for chatId=${chatId}: ${err.message}`)

    // Mark session as failed
    await docSessions.updateOne({ _id: session._id }, { $set: { status: 'failed', error: err.message, updatedAt: new Date() } })
    await deps.set(deps.state, chatId, 'action', 'none')

    const failMsg = {
      en: `❌ <b>Regulatory submission failed</b>\n\n${err.message}\n\nYour payment will be refunded to your wallet. Please try again or contact support.`,
      fr: `❌ <b>Échec de la soumission</b>\n\n${err.message}\n\nVotre paiement sera remboursé.`,
      zh: `❌ <b>监管提交失败</b>\n\n${err.message}\n\n您的付款将退还。`,
      hi: `❌ <b>नियामक प्रस्तुति विफल</b>\n\n${err.message}\n\nआपका भुगतान वापस किया जाएगा।`,
    }
    deps.send(chatId, failMsg[lang] || failMsg.en, { parse_mode: 'HTML' })

    // Refund wallet
    try {
      const users = deps.db.collection('users')
      await users.updateOne({ chatId }, { $inc: { balance: Number(session.price) || 0 } })
      deps.send(chatId, `💰 $${Number(session.price).toFixed(2)} refunded to your wallet.`, { parse_mode: 'HTML' })
    } catch (e) {
      deps.log(`[RegulatoryFlow] Refund error: ${e.message}`)
    }
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPERS: Photo download, Twilio upload, cancel
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function downloadTelegramPhoto(fileId, chatId, docKey) {
  const fileInfo = await deps.bot.getFile(fileId)
  const botToken = process.env.TELEGRAM_BOT_TOKEN_PROD || process.env.TELEGRAM_BOT_TOKEN_DEV
  const fileUrl = `https://api.telegram.org/file/bot${botToken}/${fileInfo.file_path}`

  const ext = path.extname(fileInfo.file_path) || '.jpg'
  const localPath = path.join(UPLOAD_DIR, `${chatId}_${docKey}_${Date.now()}${ext}`)

  const response = await axios.get(fileUrl, { responseType: 'stream', timeout: 30000 })
  const writer = fs.createWriteStream(localPath)
  response.data.pipe(writer)

  return new Promise((resolve, reject) => {
    writer.on('finish', () => resolve(localPath))
    writer.on('error', reject)
  })
}

async function uploadToTwilio(chatId, session, docConfig, filePath) {
  // Build attributes based on doc config
  const attributes = {}
  if (docConfig.fields) {
    if (docConfig.fields.from) {
      for (const field of docConfig.fields.from) {
        attributes[field] = session.collectedData[field] || 'N/A'
      }
    }
    if (docConfig.fields.needsAddress && session.addressSid) {
      attributes.address_sids = [session.addressSid]
    }
  }

  // Upload to Twilio using REST API with multipart/form-data
  const form = new FormData()
  form.append('FriendlyName', `${docConfig.key}-${chatId}-${session.countryCode}`)
  form.append('Type', docConfig.twilioDocType || docConfig.type)
  form.append('Attributes', JSON.stringify(attributes))
  form.append('File', fs.createReadStream(filePath))

  const response = await axios.post(
    'https://numbers.twilio.com/v2/RegulatoryCompliance/SupportingDocuments',
    form,
    {
      auth: {
        username: process.env.TWILIO_ACCOUNT_SID,
        password: process.env.TWILIO_AUTH_TOKEN,
      },
      headers: form.getHeaders(),
      timeout: 60000,
    }
  )

  return response.data.sid
}

async function updateSupportingDocAddress(docSid, addressSid) {
  const form = new FormData()
  form.append('Attributes', JSON.stringify({ address_sids: [addressSid] }))

  await axios.post(
    `https://numbers.twilio.com/v2/RegulatoryCompliance/SupportingDocuments/${docSid}`,
    form,
    {
      auth: {
        username: process.env.TWILIO_ACCOUNT_SID,
        password: process.env.TWILIO_AUTH_TOKEN,
      },
      headers: form.getHeaders(),
      timeout: 30000,
    }
  )
}

async function cancelSession(chatId, session) {
  const docSessions = deps.db.collection('docSessions')
  await docSessions.updateOne({ _id: session._id }, { $set: { status: 'cancelled', updatedAt: new Date() } })
  await deps.set(deps.state, chatId, 'action', 'none')

  const lang = session.lang || 'en'
  const cancelMsg = {
    en: '❌ Document collection cancelled. Your payment will be refunded.',
    fr: '❌ Collecte de documents annulée. Votre paiement sera remboursé.',
    zh: '❌ 文件收集已取消。您的付款将退还。',
    hi: '❌ दस्तावेज़ संग्रह रद्द। आपका भुगतान वापस किया जाएगा।',
  }
  deps.send(chatId, cancelMsg[lang] || cancelMsg.en, { parse_mode: 'HTML' })

  // Refund
  try {
    const users = deps.db.collection('users')
    await users.updateOne({ chatId }, { $inc: { balance: Number(session.price) || 0 } })
    deps.send(chatId, `💰 $${Number(session.price).toFixed(2)} refunded to your wallet.`, { parse_mode: 'HTML' })
  } catch (e) {
    deps.log(`[RegulatoryFlow] Cancel refund error: ${e.message}`)
  }

  // Cleanup uploaded files
  for (const doc of Object.values(session.uploadedDocs || {})) {
    if (doc.filePath) try { fs.unlinkSync(doc.filePath) } catch (e) { /* ignore */ }
  }
}

/**
 * Check if a user is currently in document collection mode.
 */
async function isInDocCollection(chatId) {
  const docSessions = deps.db.collection('docSessions')
  const session = await docSessions.findOne({ chatId, status: { $in: ['collecting', 'awaiting_address'] } })
  return !!session
}

/**
 * Get incomplete doc session for a user (for resume detection).
 * Returns session object or null.
 */
async function getIncompleteSession(chatId) {
  const docSessions = deps.db.collection('docSessions')
  return await docSessions.findOne({ chatId, status: { $in: ['collecting', 'awaiting_address'] } })
}

/**
 * Resume an incomplete doc collection session.
 * Restores bot state and sends the current step prompt.
 */
async function resumeSession(chatId) {
  const docSessions = deps.db.collection('docSessions')
  const session = await docSessions.findOne({ chatId, status: { $in: ['collecting', 'awaiting_address'] } })
  if (!session) return false

  const lang = session.lang || 'en'

  if (session.status === 'awaiting_address') {
    await deps.set(deps.state, chatId, 'action', 'cpDocAddress')
    const addrPrompt = {
      en: `📍 <b>Resuming: Enter Your Address</b>\n\nPlease enter your full address in this format:\n<code>Street, City, State/Region, PostalCode, CountryCode</code>\n\nExample: <code>123 Main St, Cape Town, WC, 8001, ZA</code>`,
      fr: `📍 <b>Reprise: Adresse</b>\n\n<code>Rue, Ville, Région, Code postal, Pays</code>`,
      zh: `📍 <b>继续：输入地址</b>\n\n<code>街道, 城市, 州/省, 邮编, 国家代码</code>`,
      hi: `📍 <b>जारी रखें: पता दर्ज करें</b>\n\n<code>सड़क, शहर, राज्य, पिन कोड, देश कोड</code>`,
    }
    deps.send(chatId, addrPrompt[lang] || addrPrompt.en, { parse_mode: 'HTML' })
  } else {
    // status === 'collecting'
    await deps.set(deps.state, chatId, 'action', 'cpDocCollect')
    const stepNum = session.currentStep + 1
    const totalSteps = session.steps.length
    const resumeMsg = {
      en: `📋 <b>Resuming Verification</b> (Step ${stepNum}/${totalSteps})\n\n${session.countryName} number — type /cancel to cancel and get a full refund.`,
      fr: `📋 <b>Reprise de la vérification</b> (Étape ${stepNum}/${totalSteps})\n\nNuméro ${session.countryName} — /cancel pour annuler.`,
      zh: `📋 <b>继续验证</b>（步骤 ${stepNum}/${totalSteps}）\n\n${session.countryName} 号码 — 输入 /cancel 取消并退款。`,
      hi: `📋 <b>सत्यापन जारी</b> (चरण ${stepNum}/${totalSteps})\n\n${session.countryName} नंबर — /cancel टाइप करें रद्द करने के लिए।`,
    }
    deps.send(chatId, resumeMsg[lang] || resumeMsg.en, { parse_mode: 'HTML' })
    await sendCurrentStepPrompt(chatId, session)
  }
  return true
}

/**
 * Cancel and refund an incomplete doc session (without requiring /cancel inside the flow).
 */
async function cancelAndRefund(chatId) {
  const docSessions = deps.db.collection('docSessions')
  const session = await docSessions.findOne({ chatId, status: { $in: ['collecting', 'awaiting_address'] } })
  if (!session) return false
  await cancelSession(chatId, session)
  return true
}

module.exports = {
  init,
  startDocCollection,
  handleTextInput,
  handlePhotoInput,
  handleAddressInput,
  isInDocCollection,
  getIncompleteSession,
  resumeSession,
  cancelAndRefund,
  createAndSubmitBundle,
}
