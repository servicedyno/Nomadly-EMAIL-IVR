// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Text-to-Speech Service — EdenAI + ElevenLabs
// Generates audio from text, returns downloadable URL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const axios = require('axios')
const fs = require('fs')
const path = require('path')
const { log } = require('console')

const EDENAI_API_KEY = process.env.EDENAI_API_KEY
const AUDIO_DIR = path.join(__dirname, '..', 'audio_cache')

// Ensure audio cache directory exists
if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true })
}

// Supported TTS languages — EdenAI + ElevenLabs support 74 languages
const TTS_LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', name: 'Português', flag: '🇧🇷' },
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
  { code: 'pl', name: 'Polski', flag: '🇵🇱' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
  { code: 'sv', name: 'Svenska', flag: '🇸🇪' },
  { code: 'da', name: 'Dansk', flag: '🇩🇰' },
  { code: 'no', name: 'Norsk', flag: '🇳🇴' },
  { code: 'fi', name: 'Suomi', flag: '🇫🇮' },
  { code: 'el', name: 'Ελληνικά', flag: '🇬🇷' },
]

// ── TTS Providers ──
const TTS_PROVIDERS = {
  openai:     { key: 'openai',     name: 'OpenAI',      icon: '🟢', desc: 'Best' },
  elevenlabs: { key: 'elevenlabs', name: 'ElevenLabs',  icon: '🔵', desc: '' },
}

// Curated ElevenLabs voices — mapped via EdenAI option parameter with voice_id
const ELEVENLABS_VOICES = {
  rachel:  { name: 'Rachel',  desc: 'Calm, professional female',      voiceId: '21m00Tcm4TlvDq8ikWAM', gender: 'F', provider: 'elevenlabs' },
  sarah:   { name: 'Sarah',   desc: 'Soft, friendly female',          voiceId: 'EXAVITQu4vr4xnSDxMaL', gender: 'F', provider: 'elevenlabs' },
  laura:   { name: 'Laura',   desc: 'Upbeat, energetic female',       voiceId: 'FGY2WhTYpPnrIDTdsKH5', gender: 'F', provider: 'elevenlabs' },
  emily:   { name: 'Emily',   desc: 'Young, clear female',            voiceId: 'LcfcDJNUP1GQjkzn1xUU', gender: 'F', provider: 'elevenlabs' },
  domi:    { name: 'Domi',    desc: 'Strong, expressive female',      voiceId: 'AZnzlk1XvdvUeBnXmlld', gender: 'F', provider: 'elevenlabs' },
  dorothy: { name: 'Dorothy', desc: 'Warm, pleasant female',          voiceId: 'ThT5KcBeYPX3keUQqHPh', gender: 'F', provider: 'elevenlabs' },
  glinda:  { name: 'Glinda',  desc: 'Witty, sophisticated female',    voiceId: 'z9fAnlkpzviPz146aGWa', gender: 'F', provider: 'elevenlabs' },
  drew:    { name: 'Drew',    desc: 'Confident, warm male',           voiceId: '29vD33N1CtxCmqQRPOHJ', gender: 'M', provider: 'elevenlabs' },
  charlie: { name: 'Charlie', desc: 'Casual, natural Australian male',voiceId: 'IKne3meq5aSn9XLyUdCD', gender: 'M', provider: 'elevenlabs' },
  clyde:   { name: 'Clyde',   desc: 'Deep, authoritative male',       voiceId: '2EiwWnXFnvU5JabPnv8n', gender: 'M', provider: 'elevenlabs' },
  adam:    { name: 'Adam',    desc: 'Clear, deep male',               voiceId: 'pNInz6obpgDQGcFmaJgB', gender: 'M', provider: 'elevenlabs' },
  josh:    { name: 'Josh',    desc: 'Young, dynamic male',            voiceId: 'TxGEqnHWrfWFTfGW9XjX', gender: 'M', provider: 'elevenlabs' },
  arnold:  { name: 'Arnold',  desc: 'Crisp, clear male',              voiceId: 'VR6AewLTigWG4xSOukaG', gender: 'M', provider: 'elevenlabs' },
  sam:     { name: 'Sam',     desc: 'Raspy, authentic male',          voiceId: 'yoZ06aMxZJJ28mfd3POQ', gender: 'M', provider: 'elevenlabs' },
  thomas:  { name: 'Thomas',  desc: 'Calm, collected male',           voiceId: 'GBv7mTt0atIp3Br8iCZE', gender: 'M', provider: 'elevenlabs' },
}

// OpenAI voices via EdenAI — passed through provider_params
const OPENAI_VOICES = {
  alloy:   { name: 'Alloy',   desc: 'Most used',              voiceId: 'alloy',   gender: 'N', provider: 'openai' },
  echo:    { name: 'Echo',    desc: 'Warm, deep male',           voiceId: 'echo',    gender: 'M', provider: 'openai' },
  fable:   { name: 'Fable',   desc: 'Expressive, British',       voiceId: 'fable',   gender: 'N', provider: 'openai' },
  onyx:    { name: 'Onyx',    desc: 'Deep, authoritative male',  voiceId: 'onyx',    gender: 'M', provider: 'openai' },
  nova:    { name: 'Nova',    desc: 'Warm, friendly female',     voiceId: 'nova',    gender: 'F', provider: 'openai' },
  shimmer: { name: 'Shimmer', desc: 'Clear, pleasant female',    voiceId: 'shimmer', gender: 'F', provider: 'openai' },
}

// Combined lookup — used for key resolution
const ALL_VOICES = { ...OPENAI_VOICES, ...ELEVENLABS_VOICES }

// Legacy alias — keep backward compat for code that references VOICES
const VOICES = ALL_VOICES
const GENERIC_VOICES = VOICES

const DEFAULT_VOICE = 'rachel'
const DEFAULT_PROVIDER = 'openai'

/**
 * Get TTS provider selection buttons for Telegram keyboard
 */
function getProviderButtons() {
  return Object.values(TTS_PROVIDERS).map(p => p.desc ? `${p.icon} ${p.name} — ${p.desc}` : `${p.icon} ${p.name}`)
}

function getProviderByButton(buttonText) {
  for (const p of Object.values(TTS_PROVIDERS)) {
    if (buttonText.startsWith(`${p.icon} ${p.name}`)) return p.key
  }
  return null
}

// ── Retry & Fallback Configuration ──
const TTS_TIMEOUT_MS = 90000        // 90s — EdenAI can be slow, successful calls observed at 60-120s
const TTS_DOWNLOAD_TIMEOUT_MS = 30000 // 30s for downloading audio file after generation
const TTS_MAX_RETRIES = 1           // 1 automatic retry on transient errors
const TTS_RETRY_DELAY_MS = 3000     // 3s backoff between retries

// Fallback voice mapping: if requested provider fails, try the other provider with a similar voice
const PROVIDER_FALLBACK = {
  openai: { provider: 'elevenlabs', voiceKey: 'rachel', label: 'ElevenLabs Rachel' },
  elevenlabs: { provider: 'openai', voiceKey: 'alloy', label: 'OpenAI Alloy' },
}

/**
 * Check if an error is transient (network/timeout) and worth retrying
 */
function isTransientError(err) {
  const msg = (err.message || '').toLowerCase()
  return (
    msg.includes('stream has been aborted') ||
    msg.includes('socket hang up') ||
    msg.includes('econnreset') ||
    msg.includes('econnrefused') ||
    msg.includes('etimedout') ||
    msg.includes('timeout') ||
    msg.includes('network error') ||
    msg.includes('aborted') ||
    err.code === 'ECONNABORTED' ||
    err.code === 'ECONNRESET' ||
    err.code === 'ETIMEDOUT'
  )
}

/**
 * Call EdenAI TTS API for a specific provider/voice (single attempt)
 */
async function _callEdenAI(text, provider, voiceId, gender, language) {
  const requestBody = {
    providers: provider,
    text: text.trim(),
    language: language,
    option: gender === 'M' ? 'MALE' : 'FEMALE',
  }
  if (provider === 'openai') {
    requestBody.provider_params = { openai: { voice: voiceId } }
  } else {
    requestBody.provider_params = { elevenlabs: { voice_id: voiceId } }
  }

  const res = await axios.post('https://api.edenai.run/v2/audio/text_to_speech', requestBody, {
    headers: {
      Authorization: `Bearer ${EDENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    timeout: TTS_TIMEOUT_MS,
  })

  const result = res.data?.[provider]
  if (!result || result.status === 'fail') {
    throw new Error(result?.error?.message || `EdenAI TTS failed (${provider})`)
  }
  return result
}

/**
 * Call EdenAI TTS with automatic retry on transient errors
 */
async function _callEdenAIWithRetry(text, provider, voiceId, gender, language) {
  let lastErr
  for (let attempt = 0; attempt <= TTS_MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        log(`[TTS] Retry ${attempt}/${TTS_MAX_RETRIES} for ${provider}...`)
        await new Promise(r => setTimeout(r, TTS_RETRY_DELAY_MS))
      }
      return await _callEdenAI(text, provider, voiceId, gender, language)
    } catch (err) {
      lastErr = err
      if (!isTransientError(err)) {
        // Non-transient error (API key invalid, bad request) — don't retry
        log(`[TTS] Non-transient error from ${provider}: ${err.message}`)
        throw err
      }
      log(`[TTS] Transient error from ${provider} (attempt ${attempt + 1}): ${err.message}`)
    }
  }
  throw lastErr
}

/**
 * Save EdenAI TTS result to local file + user-audio for self-hosted URL
 */
function _saveAudioResult(result, voiceKey) {
  const filename = `tts_${Date.now()}_${voiceKey}.mp3`
  const audioPath = path.join(AUDIO_DIR, filename)

  if (result.audio_resource_url) {
    // Download audio from EdenAI CDN — use sync download via blocking
    // (handled in caller with async download)
    return { audioPath, filename, needsDownload: true, downloadUrl: result.audio_resource_url }
  } else if (result.audio) {
    const buffer = Buffer.from(result.audio, 'base64')
    fs.writeFileSync(audioPath, buffer)
    return { audioPath, filename, needsDownload: false }
  } else {
    throw new Error('No audio data in EdenAI response')
  }
}

/**
 * Generate TTS audio via EdenAI with retry + provider fallback
 *
 * Flow:
 *   1. Try requested provider with 1 automatic retry on transient errors
 *   2. If all retries fail → auto-fallback to the other provider
 *   3. Return result with fallbackUsed flag so callers can inform the user
 *
 * @param {string} text - Text to convert
 * @param {string} voiceKey - Voice key from ALL_VOICES
 * @param {string} langCode - Language code (default 'en')
 * @returns {{ audioPath: string, audioUrl: string|null, voice: string, fallbackUsed: boolean, fallbackProvider: string|null }}
 */
async function generateTTS(text, voiceKey = DEFAULT_VOICE, langCode = null) {
  if (!EDENAI_API_KEY) throw new Error('EDENAI_API_KEY not configured')
  if (!text || text.trim().length === 0) throw new Error('Text cannot be empty')

  const voice = ALL_VOICES[voiceKey] || ALL_VOICES[DEFAULT_VOICE]
  const language = langCode || 'en'
  const provider = voice.provider || 'elevenlabs'

  let result = null
  let usedProvider = provider
  let usedVoiceName = voice.name
  let usedVoiceKey = voiceKey
  let fallbackUsed = false

  // ── Step 1: Try the requested provider with retry ──
  try {
    result = await _callEdenAIWithRetry(text, provider, voice.voiceId, voice.gender, language)
  } catch (primaryErr) {
    log(`[TTS] Primary provider ${provider} failed after retries: ${primaryErr.message}`)

    // ── Step 2: Fallback to other provider ──
    const fb = PROVIDER_FALLBACK[provider]
    if (fb) {
      const fbVoice = ALL_VOICES[fb.voiceKey]
      if (fbVoice) {
        log(`[TTS] Falling back to ${fb.label}...`)
        try {
          result = await _callEdenAI(text, fb.provider, fbVoice.voiceId, fbVoice.gender, language)
          usedProvider = fb.provider
          usedVoiceName = fbVoice.name
          usedVoiceKey = fb.voiceKey
          fallbackUsed = true
          log(`[TTS] Fallback to ${fb.label} succeeded`)
        } catch (fbErr) {
          log(`[TTS] Fallback ${fb.label} also failed: ${fbErr.message}`)
          // Throw a combined error with guidance
          throw new Error(
            `Both ${provider} and ${fb.provider} failed. ` +
            `${provider}: ${primaryErr.message}. ` +
            `${fb.provider}: ${fbErr.message}. ` +
            `Please try again in a moment.`
          )
        }
      } else {
        throw primaryErr
      }
    } else {
      throw primaryErr
    }
  }

  // ── Step 3: Save audio file ──
  const filename = `tts_${Date.now()}_${usedVoiceKey}.mp3`
  const audioPath = path.join(AUDIO_DIR, filename)

  if (result.audio_resource_url) {
    const audioRes = await axios.get(result.audio_resource_url, { responseType: 'arraybuffer', timeout: TTS_DOWNLOAD_TIMEOUT_MS })
    fs.writeFileSync(audioPath, Buffer.from(audioRes.data))
  } else if (result.audio) {
    const buffer = Buffer.from(result.audio, 'base64')
    fs.writeFileSync(audioPath, buffer)
  } else {
    throw new Error('No audio data in EdenAI response')
  }

  // Also save in user-audio/ for self-hosted URL (avoids CloudFront expiration)
  const userAudioDir = path.join(__dirname, 'assets', 'user-audio')
  if (!fs.existsSync(userAudioDir)) fs.mkdirSync(userAudioDir, { recursive: true })
  const userAudioFilename = `tts_${Date.now()}_${usedVoiceKey}.mp3`
  const userAudioPath = path.join(userAudioDir, userAudioFilename)
  fs.copyFileSync(audioPath, userAudioPath)

  const baseUrl = process.env.SELF_URL_PROD || process.env.SELF_URL || ''
  const selfHostedUrl = `${baseUrl}/assets/user-audio/${userAudioFilename}`

  const fallbackNote = fallbackUsed ? ` [FALLBACK from ${provider} → ${usedProvider}]` : ''
  log(`[TTS] Generated: ${filename} (provider: ${usedProvider}, voice: ${usedVoiceName}, ${text.length} chars)${fallbackNote}`)

  return {
    audioPath,
    audioUrl: selfHostedUrl,
    voice: usedVoiceName,
    fallbackUsed,
    fallbackProvider: fallbackUsed ? usedProvider : null,
  }
}

/**
 * Download a Telegram audio/voice file to local storage
 * @param {object} bot - Telegram bot instance
 * @param {string} fileId - Telegram file ID
 * @param {string} prefix - Filename prefix
 * @returns {string} Local file path
 */
async function downloadTelegramAudio(bot, fileId, prefix = 'upload') {
  const file = await bot.getFile(fileId)
  const fileUrl = `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`
  const ext = path.extname(file.file_path) || '.ogg'
  const filename = `${prefix}_${Date.now()}${ext}`
  const localPath = path.join(AUDIO_DIR, filename)

  const res = await axios.get(fileUrl, { responseType: 'arraybuffer', timeout: 15000 })
  fs.writeFileSync(localPath, Buffer.from(res.data))
  log(`[TTS] Downloaded Telegram audio: ${filename}`)
  return localPath
}

/**
 * Get voice options formatted for Telegram keyboard
 * @param {string} langCode - Language code (unused now, kept for compat)
 * @param {string} providerKey - 'openai' or 'elevenlabs' (default: show all)
 */
function getVoiceButtons(langCode = 'en', providerKey = null) {
  const voiceMap = providerKey === 'openai' ? OPENAI_VOICES
    : providerKey === 'elevenlabs' ? ELEVENLABS_VOICES
    : ALL_VOICES
  const females = Object.entries(voiceMap).filter(([, v]) => v.gender === 'F')
  const males = Object.entries(voiceMap).filter(([, v]) => v.gender === 'M')
  const neutrals = Object.entries(voiceMap).filter(([, v]) => v.gender === 'N')
  return [...neutrals, ...females, ...males].map(([key, v]) => `${v.name} — ${v.desc}`)
}

function getVoiceKeyByButton(buttonText, langCode = 'en') {
  for (const [key, v] of Object.entries(ALL_VOICES)) {
    if (buttonText.startsWith(v.name)) return key
  }
  return DEFAULT_VOICE
}

/**
 * Get language buttons for Telegram keyboard
 */
function getLanguageButtons() {
  return TTS_LANGUAGES.map(l => `${l.flag} ${l.name}`)
}

function getLanguageByButton(buttonText) {
  for (const l of TTS_LANGUAGES) {
    if (buttonText === `${l.flag} ${l.name}`) return l.code
  }
  return null
}

// Clean old audio files (>24h)
function cleanOldAudio() {
  try {
    const files = fs.readdirSync(AUDIO_DIR)
    const cutoff = Date.now() - 24 * 60 * 60 * 1000
    for (const f of files) {
      const fp = path.join(AUDIO_DIR, f)
      const stat = fs.statSync(fp)
      if (stat.mtimeMs < cutoff) {
        fs.unlinkSync(fp)
      }
    }
  } catch (e) { /* ignore */ }
}
setInterval(cleanOldAudio, 6 * 60 * 60 * 1000)

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// IVR Greeting Templates — Financial Institutions
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const TEMPLATE_CATEGORIES = [
  { key: 'financial', name: 'Financial Services', icon: '🏦' },
  { key: 'support', name: 'Customer Support', icon: '🎧' },
  { key: 'voicemail', name: 'Voicemail Greetings', icon: '📞' },
]

const GREETING_TEMPLATES = {
  financial: [
    {
      key: 'fin_welcome',
      name: 'General Welcome',
      icon: '🏦',
      text: 'Thank you for calling [Company Name]. For account inquiries, press 1. For customer support, press 2. For fraud reporting, press 3. To repeat this menu, press 9. To speak with a representative, press 0.',
    },
    {
      key: 'fin_fraud',
      name: 'Fraud Hotline',
      icon: '🚨',
      text: 'Thank you for calling our Fraud Prevention Hotline. If you suspect unauthorized activity on your account, press 1. To report a lost or stolen card, press 2. For identity theft concerns, press 3. For all other inquiries, press 0. Your security is our top priority.',
    },
    {
      key: 'fin_support',
      name: 'Customer Support',
      icon: '🎧',
      text: 'Welcome to Customer Support. For balance inquiries and recent transactions, press 1. For transaction disputes, press 2. For loan or credit services, press 3. For online and mobile banking assistance, press 4. To return to the main menu, press 9.',
    },
    {
      key: 'fin_afterhours',
      name: 'After Hours',
      icon: '🌙',
      text: 'Thank you for calling [Company Name]. Our offices are currently closed. Our business hours are Monday through Friday, 9 AM to 5 PM. For urgent fraud concerns, press 1 to reach our 24-hour fraud team. Otherwise, please leave a message after the tone and we will return your call on the next business day.',
    },
    {
      key: 'fin_loans',
      name: 'Loan Services',
      icon: '💰',
      text: 'Thank you for calling our Loan Services Department. For mortgage inquiries, press 1. For personal loan applications, press 2. For auto loan services, press 3. To check your existing loan status, press 4. To speak with a loan officer, press 0.',
    },
    {
      key: 'fin_collections',
      name: 'Collections',
      icon: '📋',
      text: 'You have reached the Collections Department. For payment arrangements, press 1. To make a payment now, press 2. To dispute an account balance, press 3. To speak with a representative, press 0. Please note this call may be recorded for quality and compliance purposes.',
    },
    {
      key: 'fin_wire',
      name: 'Wire & Transfers',
      icon: '🔄',
      text: 'Thank you for calling Wire Transfer Services. For domestic wire transfers, press 1. For international wire transfers, press 2. To check the status of an existing transfer, press 3. For ACH and direct deposit inquiries, press 4. To speak with a specialist, press 0.',
    },
    {
      key: 'fin_invest',
      name: 'Investment Services',
      icon: '📈',
      text: 'Welcome to Investment Services. For portfolio inquiries, press 1. For trading and brokerage, press 2. For retirement and IRA accounts, press 3. For wealth management, press 4. To speak with a financial advisor, press 0.',
    },
  ],
  support: [
    {
      key: 'sup_general',
      name: 'General Support',
      icon: '🎧',
      text: 'Thank you for calling [Company Name] Customer Support. For technical assistance, press 1. For billing inquiries, press 2. For account changes, press 3. For general information, press 4. To speak with an agent, press 0.',
    },
    {
      key: 'sup_tech',
      name: 'Technical Support',
      icon: '🔧',
      text: 'Welcome to Technical Support. For internet and connectivity issues, press 1. For software and application help, press 2. For hardware troubleshooting, press 3. For service outage updates, press 4. To speak with a technician, press 0.',
    },
    {
      key: 'sup_billing',
      name: 'Billing Department',
      icon: '💳',
      text: 'You have reached the Billing Department. For payment inquiries, press 1. To make a payment, press 2. To dispute a charge, press 3. For refund requests, press 4. To speak with a billing specialist, press 0.',
    },
    {
      key: 'sup_callback',
      name: 'Callback Request',
      icon: '📲',
      text: 'Thank you for calling [Company Name]. We are experiencing higher than normal call volume. Your call is important to us. To request a callback, press 1. To continue holding, press 2. To leave a voicemail, press 3. Our estimated wait time is approximately 10 minutes.',
    },
  ],
  voicemail: [
    {
      key: 'vm_professional',
      name: 'Professional',
      icon: '💼',
      text: 'You have reached [Your Name] at [Company Name]. I am unable to take your call right now. Please leave your name, number, and a brief message, and I will return your call as soon as possible. Thank you.',
    },
    {
      key: 'vm_afterhours',
      name: 'After Hours',
      icon: '🌙',
      text: 'Thank you for calling [Company Name]. Our office is currently closed. Our regular business hours are Monday through Friday, 9 AM to 5 PM. Please leave a message and we will return your call on the next business day.',
    },
    {
      key: 'vm_outofoffice',
      name: 'Out of Office',
      icon: '✈️',
      text: 'Hi, you have reached [Your Name]. I am currently out of the office and will return on [Date]. For immediate assistance, please contact [Colleague Name] at [Number]. Otherwise, leave a message and I will get back to you upon my return.',
    },
    {
      key: 'vm_holiday',
      name: 'Holiday Greeting',
      icon: '🎄',
      text: 'Thank you for calling [Company Name]. We are currently closed for the holidays. We will reopen on [Date]. For emergencies, please email [Email]. Wishing you a wonderful holiday season. Please leave a message after the tone.',
    },
    {
      key: 'vm_personal',
      name: 'Personal Short',
      icon: '📱',
      text: 'Hi, this is [Your Name]. I cannot take your call right now. Please leave a message and I will call you back. Thanks.',
    },
    {
      key: 'vm_sales',
      name: 'Sales Team',
      icon: '🤝',
      text: 'Thank you for calling the [Company Name] Sales Team. We are sorry we missed your call. Please leave your name, number, and what you are interested in, and a sales representative will follow up with you shortly.',
    },
  ],
}

/**
 * Get template category buttons for Telegram keyboard
 */
function getTemplateCategoryButtons() {
  return TEMPLATE_CATEGORIES.map(c => `${c.icon} ${c.name}`)
}

function getCategoryByButton(buttonText) {
  for (const c of TEMPLATE_CATEGORIES) {
    if (buttonText === `${c.icon} ${c.name}`) return c.key
  }
  return null
}

/**
 * Get template buttons for a specific category
 */
function getTemplateButtons(categoryKey) {
  const templates = GREETING_TEMPLATES[categoryKey] || []
  return templates.map(t => `${t.icon} ${t.name}`)
}

function getTemplateByButton(categoryKey, buttonText) {
  const templates = GREETING_TEMPLATES[categoryKey] || []
  for (const t of templates) {
    if (buttonText === `${t.icon} ${t.name}`) return t
  }
  return null
}

/**
 * Translate text to target language using OpenAI
 */
async function translateText(text, targetLangCode) {
  if (targetLangCode === 'en') return text
  const langName = TTS_LANGUAGES.find(l => l.code === targetLangCode)?.name || targetLangCode
  let OpenAI = null
  try { OpenAI = require('openai') } catch { return text }
  if (!OpenAI || !process.env.APP_OPEN_API_KEY) return text
  try {
    const ai = new OpenAI({ apiKey: process.env.APP_OPEN_API_KEY })
    const res = await ai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: `Translate the following IVR phone greeting to ${langName}. Keep the same structure, tone, and press-key references. Replace [Company Name] as-is in the translation. Return ONLY the translated text, nothing else.` },
        { role: 'user', content: text },
      ],
      max_tokens: 500,
      temperature: 0.3,
    })
    return res.choices?.[0]?.message?.content?.trim() || text
  } catch (e) {
    log(`[TTS] Translation error: ${e.message}`)
    return text
  }
}

module.exports = {
  generateTTS,
  downloadTelegramAudio,
  getVoiceButtons,
  getVoiceKeyByButton,
  getLanguageButtons,
  getLanguageByButton,
  getTemplateCategoryButtons,
  getCategoryByButton,
  getTemplateButtons,
  getTemplateByButton,
  getProviderButtons,
  getProviderByButton,
  translateText,
  VOICES,
  ALL_VOICES,
  ELEVENLABS_VOICES,
  OPENAI_VOICES,
  TTS_PROVIDERS,
  GENERIC_VOICES,
  TTS_LANGUAGES,
  GREETING_TEMPLATES,
  TEMPLATE_CATEGORIES,
  DEFAULT_VOICE,
  DEFAULT_PROVIDER,
  AUDIO_DIR,
}
