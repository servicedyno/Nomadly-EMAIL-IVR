/**
 * Cloudflare Discovery Worker auto-sync.
 *
 * At server startup, compare the `apiBase` currently served by the APK-facing
 * discovery Worker against `SELF_URL_PROD` (the canonical live backend URL
 * from .env). If they differ, re-upload the Worker script so the APK routes
 * new traffic to this instance on next launch.
 *
 * This closes the operational loop:
 *   Railway spins up on a new URL → this backend starts →
 *   it pushes the new URL to the Worker → every APK picks it up automatically.
 *
 * Silent no-ops if CLOUDFLARE_* env vars are missing or SELF_URL_PROD is
 * empty/invalid so dev / preview / self-hosted deployments aren't affected.
 */

const CF_ACCOUNT_ID = 'ed6035ebf6bd3d85f5b26c60189a21e2'
const CF_SCRIPT_NAME = 'nomadly-api-config'
const CF_DISCOVERY_URL = 'https://nomadly-api-config.nomadly-cfg.workers.dev/'

function buildWorkerSource(apiBase) {
  // Keep this template minimal and self-contained — it's served billions of
  // times per user lifecycle. Do not pull in libraries.
  return `// Nomadly SMS App — API Discovery Worker
// Auto-synced by backend on startup. To pin manually, disable backend
// self-sync via DISABLE_CF_DISCOVERY_SYNC=true in the server env.
const API_BASE = ${JSON.stringify(apiBase)}
const SYNCED_AT = ${JSON.stringify(new Date().toISOString())}

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  const payload = { apiBase: API_BASE, version: 1, syncedAt: SYNCED_AT }
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
      ...corsHeaders,
    },
  })
}
`
}

async function syncDiscoveryWorker() {
  try {
    // Safety: require explicit opt-in. Set CF_DISCOVERY_SYNC=true ONLY on the
    // production Railway deployment so preview/dev/local servers can't
    // accidentally overwrite the Worker and break live APK users.
    if (process.env.CF_DISCOVERY_SYNC !== 'true') {
      console.log('[CF-Sync] Disabled (CF_DISCOVERY_SYNC!=true) — skipping')
      return
    }
    if (process.env.DISABLE_CF_DISCOVERY_SYNC === 'true') {
      console.log('[CF-Sync] Disabled via env — skipping')
      return
    }

    const rawUrl = process.env.SELF_URL || ''
    const desiredUrl = String(rawUrl).trim().replace(/\/+$/, '')
    if (!/^https:\/\/.+/.test(desiredUrl)) {
      console.log('[CF-Sync] SELF_URL not set / invalid — skipping')
      return
    }

    const email = process.env.CLOUDFLARE_EMAIL
    const key = process.env.CLOUDFLARE_API_KEY
    if (!email || !key) {
      console.log('[CF-Sync] CLOUDFLARE credentials missing — skipping')
      return
    }

    // Check current Worker response — avoid unnecessary re-deploys.
    try {
      const resp = await fetch(CF_DISCOVERY_URL, {
        headers: { 'cache-control': 'no-cache' },
        signal: AbortSignal.timeout(5000)
      })
      if (resp.ok) {
        const cur = await resp.json()
        if (cur?.apiBase === desiredUrl) {
          console.log('[CF-Sync] Discovery Worker already in sync:', desiredUrl)
          return
        }
        console.log(`[CF-Sync] Drift detected. Worker=${cur?.apiBase || '(none)'} Want=${desiredUrl}`)
      } else {
        console.log(`[CF-Sync] Current Worker returned ${resp.status} — proceeding with sync`)
      }
    } catch (e) {
      console.log('[CF-Sync] Could not read current Worker (network?):', e.message, '— proceeding with sync')
    }

    // PUT the new Worker script.
    const putUrl = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/workers/scripts/${CF_SCRIPT_NAME}`
    const putResp = await fetch(putUrl, {
      method: 'PUT',
      headers: {
        'X-Auth-Email': email,
        'X-Auth-Key': key,
        'Content-Type': 'application/javascript',
      },
      body: buildWorkerSource(desiredUrl),
      signal: AbortSignal.timeout(15000),
    })
    if (!putResp.ok) {
      const txt = await putResp.text().catch(() => '')
      console.error(`[CF-Sync] PUT failed ${putResp.status}:`, txt.slice(0, 300))
      return
    }
    console.log('[CF-Sync] ✅ Discovery Worker updated to:', desiredUrl)
  } catch (e) {
    // Never let sync failures crash the server.
    console.error('[CF-Sync] Unexpected error:', e.message)
  }
}

module.exports = { syncDiscoveryWorker }
