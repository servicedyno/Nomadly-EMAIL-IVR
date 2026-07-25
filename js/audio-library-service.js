// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Audio Library Service — Upload, Store, Manage IVR audio files
// Users upload audio via Telegram, files are saved locally + metadata in MongoDB
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const fs = require('fs')
const path = require('path')
const axios = require('axios')
const crypto = require('crypto')
const { log } = require('console')
const { execSync } = require('child_process')

const AUDIO_DIR = path.join(__dirname, 'assets', 'user-audio')

// Ensure directory exists
if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true })
}

let _db = null
let _collection = null

/**
 * Initialize the audio library service
 * @param {object} db - MongoDB database instance
 */
async function initAudioLibrary(db) {
  _db = db
  _collection = db.collection('ivrAudioFiles')
  await _collection.createIndex({ chatId: 1 })
  await _collection.createIndex({ chatId: 1, name: 1 })
  log('[AudioLibrary] Initialized')
}

/**
 * Get the public URL for an audio file
 * @param {string} filename - The filename in the user-audio directory
 * @returns {string} Public URL accessible by Telnyx
 */
function getAudioUrl(filename) {
  const baseUrl = process.env.SELF_URL_PROD || process.env.SELF_URL || ''
  return `${baseUrl}/assets/user-audio/${filename}`
}

/**
 * Identify an audio container from its leading bytes (magic numbers). Uploaded
 * files are routinely MISLABELED by extension/MIME (e.g. Telegram delivers an
 * M4A/AAC file as "audio/mpeg" with a ".mp3" name), so we must trust the bytes.
 * Returns: 'mp3' | 'wav' | 'ogg' | 'flac' | 'mp4' (m4a/aac) | 'unknown'.
 */
function detectAudioFormat(buf) {
  if (!buf || buf.length < 12) return 'unknown'
  const ascii = (start, len) => buf.slice(start, start + len).toString('latin1')
  if (ascii(0, 3) === 'ID3') return 'mp3' // MP3 with ID3v2 tag
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return 'mp3' // raw MP3 frame sync
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WAVE') return 'wav'
  if (ascii(0, 4) === 'OggS') return 'ogg'
  if (ascii(0, 4) === 'fLaC') return 'flac'
  if (ascii(4, 4) === 'ftyp') return 'mp4' // m4a / aac / mp4 container (NOT playable by Twilio)
  return 'unknown'
}

/**
 * Download audio from Telegram and save locally
 * @param {string} fileLink - Telegram file download URL
 * @param {string} chatId - User's chat ID
 * @param {string} originalName - Original filename
 * @param {string} mimeType - MIME type
 * @returns {{ filename, localPath, audioUrl, size }}
 */
async function downloadAndSave(fileLink, chatId, originalName, mimeType) {
  // Determine file extension
  let ext = 'mp3'
  if (mimeType) {
    if (mimeType.includes('ogg')) ext = 'ogg'
    else if (mimeType.includes('wav')) ext = 'wav'
    else if (mimeType.includes('mp4')) ext = 'mp4'
    else if (mimeType.includes('mpeg') || mimeType.includes('mp3')) ext = 'mp3'
  } else if (originalName) {
    const parts = originalName.split('.')
    if (parts.length > 1) ext = parts.pop().toLowerCase()
  }

  const id = crypto.randomUUID().slice(0, 12)
  const rawFilename = `${chatId}_${id}.${ext}`
  const rawPath = path.join(AUDIO_DIR, rawFilename)

  // Download file
  const response = await axios.get(fileLink, { responseType: 'arraybuffer', timeout: 30000 })
  const downloadedBuf = Buffer.from(response.data)
  fs.writeFileSync(rawPath, downloadedBuf)

  let filename = rawFilename
  let localPath = rawPath
  let finalMimeType = mimeType || 'audio/mpeg'

  // ── Decide conversion from the REAL container (magic bytes), not the ext/MIME ──
  // Telephony <Play> (Twilio/Telnyx) only decodes MP3/WAV reliably. Anything else
  // — an M4A/AAC file mislabeled as ".mp3", or ogg/opus/webm/flac — plays as STATIC
  // if served as-is. So detect the true format and transcode everything that isn't
  // already MP3/WAV into real mono MP3. (Fix: @Spirits_Of_The_Ancesters 7898648919 —
  // his imported "MP3" was actually ftypM4A, so every call played static.)
  const realFormat = detectAudioFormat(downloadedBuf)

  if (realFormat !== 'mp3' && realFormat !== 'wav') {
    const mp3Filename = `${chatId}_${id}.mp3`
    const mp3Path = path.join(AUDIO_DIR, mp3Filename)
    // ffmpeg can't edit a file in place; if the raw upload already ends in ".mp3"
    // (the mislabeled-M4A case) write to a temp path first, then move it over.
    const outPath = (mp3Path === rawPath) ? path.join(AUDIO_DIR, `${chatId}_${id}.conv.mp3`) : mp3Path
    try {
      // -vn drops any cover art/video; force mono 44.1k MP3 (telephony-safe).
      execSync(`ffmpeg -i "${rawPath}" -vn -codec:a libmp3lame -ac 1 -ar 44100 -b:a 128k -y "${outPath}"`, {
        timeout: 60000,
        stdio: 'pipe',
      })
      if (fs.existsSync(rawPath)) { try { fs.unlinkSync(rawPath) } catch (_e) { /* ignore */ } }
      if (outPath !== mp3Path) fs.renameSync(outPath, mp3Path)
      filename = mp3Filename
      localPath = mp3Path
      finalMimeType = 'audio/mpeg'
      log(`[AudioLibrary] Transcoded ${realFormat} → MP3 (mono 44.1k): ${mp3Filename}`)
    } catch (e) {
      // Never keep a non-playable file — that IS the "static" bug. Fail loudly so
      // the upload handler tells the user to try again (and a missing ffmpeg is
      // surfaced instead of silently serving garbage that plays as static).
      try { if (fs.existsSync(rawPath)) fs.unlinkSync(rawPath) } catch (_e) { /* ignore */ }
      try { if (fs.existsSync(outPath)) fs.unlinkSync(outPath) } catch (_e) { /* ignore */ }
      log(`[AudioLibrary] ffmpeg transcode FAILED (${realFormat} → MP3): ${e.message}`)
      throw new Error(`Could not process your audio (detected format: ${realFormat}). Please upload a standard MP3 or WAV file.`)
    }
  } else {
    finalMimeType = realFormat === 'wav' ? 'audio/wav' : 'audio/mpeg'
  }

  const size = fs.statSync(localPath).size
  const audioUrl = getAudioUrl(filename)

  // ── Persist the binary to MongoDB (ivrAudioStore) so it SURVIVES Railway
  //    redeploys. Railway's filesystem is EPHEMERAL — a redeploy wipes
  //    /assets/user-audio, and without a DB backup the [AudioRestore]
  //    middleware (js/_index.js) can't restore the file. The URL then serves
  //    the 200 HTML landing page instead of audio, so Twilio <Play> receives
  //    HTML and speaks "an application error has occurred" then hangs up.
  //    Prod bug: @Spirits_Of_The_Ancesters (7898648919) 2026-07-24 — his
  //    imported "bill call" audio was lost on redeploy → every test call
  //    errored out. IVR greetings already back up here; library imports must too.
  try {
    if (_db) {
      const audioBuffer = fs.readFileSync(localPath)
      await _db.collection('ivrAudioStore').updateOne(
        { filename },
        { $set: { filename, buffer: audioBuffer.toString('base64'), audioUrl, mimeType: finalMimeType, source: 'audioLibrary', chatId: String(chatId), updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
        { upsert: true }
      )
      log(`[AudioLibrary] Persisted ${filename} to ivrAudioStore (${(size / 1024).toFixed(1)} KB) — survives redeploys`)
    } else {
      log(`[AudioLibrary] WARN: _db not initialized — ${filename} NOT backed up to ivrAudioStore`)
    }
  } catch (e) {
    log(`[AudioLibrary] ivrAudioStore persist FAILED for ${filename} (non-blocking): ${e.message}`)
  }

  log(`[AudioLibrary] Saved: ${filename} (${(size / 1024).toFixed(1)} KB) for chatId ${chatId}`)
  return { filename, localPath, audioUrl, size }
}

/**
 * Save audio metadata to MongoDB
 * @param {object} params
 * @returns {object} The saved audio document
 */
async function saveAudio({ chatId, name, filename, originalName, duration, mimeType, size, audioUrl, localPath }) {
  const doc = {
    id: crypto.randomUUID(),
    chatId: String(chatId),
    name: name || originalName || filename,
    filename,
    originalName: originalName || filename,
    duration: duration || 0,
    mimeType: mimeType || 'audio/mpeg',
    size: size || 0,
    audioUrl,
    localPath,
    createdAt: new Date(),
  }
  await _collection.insertOne(doc)
  log(`[AudioLibrary] Saved metadata: ${doc.name} (id: ${doc.id}) for chatId ${chatId}`)
  return doc
}

/**
 * List all audio files for a user
 * @param {number|string} chatId
 * @returns {Array} List of audio documents
 */
async function listAudios(chatId) {
  return _collection.find({ chatId: String(chatId) }).sort({ createdAt: -1 }).toArray()
}

/**
 * Get a specific audio by ID
 * @param {string} audioId
 * @returns {object|null}
 */
async function getAudio(audioId) {
  return _collection.findOne({ id: audioId })
}

/**
 * Delete an audio file (both filesystem and MongoDB)
 * @param {string} audioId
 * @param {number|string} chatId - For ownership verification
 * @returns {boolean}
 */
async function deleteAudio(audioId, chatId) {
  const audio = await _collection.findOne({ id: audioId, chatId: String(chatId) })
  if (!audio) return false

  // Delete file from filesystem
  try {
    if (audio.localPath && fs.existsSync(audio.localPath)) {
      fs.unlinkSync(audio.localPath)
    } else if (audio.filename) {
      const fp = path.join(AUDIO_DIR, audio.filename)
      if (fs.existsSync(fp)) fs.unlinkSync(fp)
    }
  } catch (e) {
    log(`[AudioLibrary] File delete error: ${e.message}`)
  }

  await _collection.deleteOne({ id: audioId, chatId: String(chatId) })
  log(`[AudioLibrary] Deleted: ${audio.name} (id: ${audioId}) for chatId ${chatId}`)
  return true
}

/**
 * Rename an audio file
 */
async function renameAudio(audioId, chatId, newName) {
  const result = await _collection.updateOne(
    { id: audioId, chatId: String(chatId) },
    { $set: { name: newName } }
  )
  return result.modifiedCount > 0
}

module.exports = {
  initAudioLibrary,
  downloadAndSave,
  saveAudio,
  listAudios,
  getAudio,
  deleteAudio,
  renameAudio,
  getAudioUrl,
  detectAudioFormat,
  AUDIO_DIR,
}
