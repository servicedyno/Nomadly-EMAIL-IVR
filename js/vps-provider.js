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
 *
 * Detection order (most specific → least specific):
 *   1. record.provider === 'ovh' | 'contabo'  → use it
 *   2. record._ovhServiceName starts with 'vps-' → 'ovh'
 *   3. record.contaboInstanceId is set (numeric)  → 'contabo'
 *   4. Fall back to DEFAULT_PROVIDER
 *
 * @param {Object} vpsRecord - The vpsPlansOf document (or null for "current default")
 */
function getProviderForRecord(vpsRecord) {
  if (!vpsRecord) return getProvider()
  const explicit = (vpsRecord.provider || '').toLowerCase()
  if (explicit === 'ovh' || explicit === 'contabo') return _loadProvider(explicit)
  if (vpsRecord._ovhServiceName || (typeof vpsRecord.contaboInstanceId === 'string' && /^vps-/.test(vpsRecord.contaboInstanceId))) {
    return _loadProvider('ovh')
  }
  if (vpsRecord.contaboInstanceId != null) {
    // Legacy records: Contabo used numeric instanceIds. If contaboInstanceId is
    // a number (or a numeric string), this is a Contabo record.
    return _loadProvider('contabo')
  }
  return getProvider()
}

function listAllProviders() {
  const out = [{ name: DEFAULT_PROVIDER, service: getProvider(), primary: true }]
  const fb = getFallbackProvider()
  if (fb) {
    out.push({ name: DEFAULT_PROVIDER === 'ovh' ? 'contabo' : 'ovh', service: fb, primary: false })
  }
  return out
}

/**
 * Detect which provider owns an instanceId based on format:
 *  - OVH service names look like 'vps-12abc34.vps.ovh.net' (or any string starting with 'vps-')
 *  - Contabo instance IDs are numeric strings (e.g., '203228089')
 * Returns 'ovh' | 'contabo' | null (unknown).
 */
function detectProviderByInstanceId(instanceId) {
  if (instanceId == null) return null
  const s = String(instanceId)
  if (/^vps-/.test(s)) return 'ovh'
  if (/^\d+$/.test(s)) return 'contabo'
  return null
}

/**
 * Return the provider service that owns a given instanceId. Falls back to
 * the default provider when the format is unknown.
 */
function dispatchByInstanceId(instanceId) {
  const name = detectProviderByInstanceId(instanceId)
  if (name === 'ovh' || name === 'contabo') return _loadProvider(name)
  return getProvider()
}

/**
 * Build a smart-routing proxy that mirrors contabo-service.js's surface but
 * dispatches per-instance operations to the right provider based on the
 * instanceId argument. Catalog / list / region ops go to the default provider.
 *
 * Used by vm-instance-setup.js to keep the existing `contabo.X(...)` call
 * patterns while transparently routing OVH calls to OVH and Contabo to Contabo.
 */
const PER_INSTANCE_METHODS = new Set([
  'getInstance', 'cancelInstance',
  'startInstance', 'stopInstance', 'restartInstance', 'shutdownInstance',
  'resetPassword', 'reinstallInstance', 'updateInstanceName', 'upgradeInstance',
  'createSnapshot', 'listSnapshots', 'deleteSnapshot',
])

function buildSmartProxy() {
  return new Proxy({}, {
    get(_target, prop) {
      // Resolve default provider first (also covers PROVIDER, exports, etc.)
      const defaultSvc = getProvider()
      const value = defaultSvc[prop]
      // Non-functions (constants like PRODUCT_CATALOG) return as-is
      if (typeof value !== 'function') return value
      // Functions: if the method operates on a specific instance, route by ID
      return function (...args) {
        if (PER_INSTANCE_METHODS.has(prop) && args.length && args[0] != null) {
          const svc = dispatchByInstanceId(args[0])
          const fn = svc[prop]
          if (typeof fn === 'function') return fn.apply(svc, args)
        }
        return value.apply(defaultSvc, args)
      }
    },
  })
}

module.exports = {
  getProvider,
  getFallbackProvider,
  getProviderForRecord,
  listAllProviders,
  detectProviderByInstanceId,
  dispatchByInstanceId,
  buildSmartProxy,
  DEFAULT_PROVIDER,
  FALLBACK_ENABLED,
}
