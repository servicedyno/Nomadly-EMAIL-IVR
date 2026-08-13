'use strict'
/**
 * vps-secret-store.js — durable storage for provider "password secrets".
 *
 * ─── WHY THIS EXISTS ─────────────────────────────────────────────────────
 * Contabo has a real secrets API, so the bot's VPS flow was written as:
 *      createSecret(name, password, 'password') → secretId
 *      createInstance({ rootPassword: secretId })
 *      vpsPlansOf.rootPasswordSecretId = secretId
 *
 * DigitalOcean and Vultr have no such API, so those services fabricated ids
 * (`do-pwd-…`, `vultr-pwd-…`) and kept the plaintext in a per-process
 * `new Map()`. The id was persisted to Mongo but the password only ever lived
 * in RAM, so **every Railway redeploy silently destroyed every VPS password**
 * on the platform — `rootPasswordSecretId` pointed at nothing and the
 * password could never be shown to the customer again.
 *
 * This module keeps the same tiny API but backs it with Mongo
 * (`vpsPasswordSecrets`), with the in-process Map retained purely as a cache.
 * If the store was never initialised (unit tests, standalone scripts) it
 * degrades to cache-only instead of throwing.
 */

const _cache = new Map() // secretId → { password, name, createdAt }
let _col = null

const log = (...a) => console.log('[VpsSecretStore]', ...a)

/** Called once from _index.js right after the Mongo connection is ready. */
function initSecretStore(db) {
  try {
    if (!db || typeof db.collection !== 'function') return false
    _col = db.collection('vpsPasswordSecrets')
    if (typeof _col.createIndex === 'function') {
      _col.createIndex({ createdAt: 1 }).catch(() => {})
    }
    log('initialised (collection=vpsPasswordSecrets)')
    return true
  } catch (e) {
    log('init failed — falling back to in-memory cache only:', e.message || e)
    _col = null
    return false
  }
}

function isReady() { return !!_col }

/** Persist a secret. Never throws — a storage hiccup must not fail a purchase. */
async function putSecret(secretId, password, meta = {}) {
  if (!secretId || password == null) return false
  const rec = {
    password: String(password),
    name: meta.name || secretId,
    provider: meta.provider || null,
    createdAt: new Date(),
  }
  _cache.set(secretId, { ...rec, createdAt: Date.now() })
  if (!_col) return false
  try {
    await _col.updateOne({ _id: secretId }, { $set: rec }, { upsert: true })
    return true
  } catch (e) {
    log(`putSecret(${secretId}) failed: ${e.message || e}`)
    return false
  }
}

/** Resolve a secretId back to its plaintext password (cache → Mongo). */
async function getSecretPassword(secretId) {
  if (!secretId) return null
  const cached = _cache.get(secretId)
  if (cached?.password) return cached.password
  if (!_col) return null
  try {
    const doc = await _col.findOne({ _id: secretId })
    if (doc?.password) {
      _cache.set(secretId, { password: doc.password, name: doc.name, createdAt: Date.now() })
      return doc.password
    }
  } catch (e) {
    log(`getSecretPassword(${secretId}) failed: ${e.message || e}`)
  }
  return null
}

/** Metadata only — used by provider getSecret() shims. */
async function getSecretMeta(secretId) {
  if (!secretId) return null
  const cached = _cache.get(secretId)
  if (cached) return { id: secretId, name: cached.name || secretId, type: 'password' }
  if (!_col) return null
  try {
    const doc = await _col.findOne({ _id: secretId })
    return doc ? { id: secretId, name: doc.name || secretId, type: 'password' } : null
  } catch (_) {
    return null
  }
}

async function deleteSecret(secretId) {
  _cache.delete(secretId)
  if (!_col) return true
  try {
    await _col.deleteOne({ _id: secretId })
  } catch (_) { /* noop */ }
  return true
}

/** Test helper — drops the in-process cache so Mongo reads are exercised. */
function _clearCache() { _cache.clear() }

module.exports = {
  initSecretStore,
  isReady,
  putSecret,
  getSecretPassword,
  getSecretMeta,
  deleteSecret,
  _clearCache,
}
