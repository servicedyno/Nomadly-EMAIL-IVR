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
  fs.writeFileSync(rawPath, Buffer.from(response.data))

  let filename = rawFilename
  let localPath = rawPath
  let finalMimeType = mimeType || 'audio/mpeg'

  // Convert OGG/non-MP3 to MP3 for Twilio compatibility
  // Twilio only supports: MP3, WAV, AIFF, µ-law
  if (ext === 'ogg' || ext === 'opus' || ext === 'mp4' || ext === 'webm') {
    try {
      const mp3Filename = `${chatId}_${id}.mp3`
      const mp3Path = path.join(AUDIO_DIR, mp3Filename)
      execSync(`ffmpeg -i "${rawPath}" -codec:a libmp3lame -b:a 128k -y "${mp3Path}"`, {
        timeout: 30000,
        stdio: 'pipe',
      })
      // Remove original OGG, use MP3
      fs.unlinkSync(rawPath)
      filename = mp3Filename
      localPath = mp3Path
      finalMimeType = 'audio/mpeg'
      log(`[AudioLibrary] Converted ${ext} → MP3: ${mp3Filename}`)
    } catch (e) {
      log(`[AudioLibrary] ffmpeg conversion failed (${ext} → MP3): ${e.message}, keeping original`)
      // Keep original file as fallback
    }
  }

  const size = fs.statSync(localPath).size
  const audioUrl = getAudioUrl(filename)

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
  AUDIO_DIR,
}
