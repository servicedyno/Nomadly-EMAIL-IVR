/**
 * vps-provider.js — Multi-provider VPS abstraction layer.
 *
 * Reads env vars to decide which VPS backend to use:
 *   VPS_DEFAULT_PROVIDER       = "ovh" | "contabo"   (default: "ovh" as of 2026-02)
 *   VPS_CONTABO_FALLBACK_ENABLED = "true" | "false"  (default: "false")
 *
 * Both services export identical method signatures (see ovh-service.js and
 * contabo-service.js), so callers like vm-instance-setup.js only need to
 * call `getProvider()` and forget which one is active.
 *
 * Fallback semantics:
 * - When CONTABO_FALLBACK is enabled AND the primary provider trips its
 *   circuit breaker, the abstraction transparently routes createInstance()
 *   calls to Contabo. All other ops still go to the primary (because
 *   instance IDs only exist on the provider that created them).
 *
 * Each per-record op (getInstance, deleteInstance, etc.) should be routed
 * by the `provider` field on the vpsPlansOf record, so the *DB record* is
 * authoritative; this abstraction layer is only for the create-time choice.
 */

'use strict'
require('dotenv').config()

const DEFAULT_PROVIDER  = String(process.env.VPS_DEFAULT_PROVIDER || 'ovh').toLowerCase()
const FALLBACK_ENABLED  = String(process.env.VPS_CONTABO_FALLBACK_ENABLED || 'false').toLowerCase() === 'true'

let _primary  = null
let _fallback = null

function _loadProvider(name) {
  if (name === 'ovh')     return require('./ovh-service')
  if (name === 'contabo') return require('./contabo-service')
  throw new Error(`Unknown VPS provider: ${name}`)
}

function getProvider() {
  if (!_primary) _primary = _loadProvider(DEFAULT_PROVIDER)
  return _primary
}

function getFallbackProvider() {
  if (!FALLBACK_ENABLED) return null
  if (!_fallback) {
    const fbName = DEFAULT_PROVIDER === 'ovh' ? 'contabo' : 'ovh'
    _fallback = _loadProvider(fbName)
  }
  return _fallback
}

/**
 * Resolve the provider that owns a given record. Used by ops that act on
 * an existing instance (getInstance, deleteInstance, etc.).
 * @param {Object} vpsRecord - The vpsPlansOf document (or null for "current default")
 */
function getProviderForRecord(vpsRecord) {
  const name = (vpsRecord?.provider || DEFAULT_PROVIDER).toLowerCase()
  return _loadProvider(name)
}

function listAllProviders() {
  const out = [{ name: DEFAULT_PROVIDER, service: getProvider(), primary: true }]
  const fb = getFallbackProvider()
  if (fb) {
    out.push({ name: DEFAULT_PROVIDER === 'ovh' ? 'contabo' : 'ovh', service: fb, primary: false })
  }
  return out
}

module.exports = {
  getProvider,
  getFallbackProvider,
  getProviderForRecord,
  listAllProviders,
  DEFAULT_PROVIDER,
  FALLBACK_ENABLED,
}
