/**
 * Nomadly SMS App — API Client
 *
 * Resolution order for the API base URL:
 *   1. In a browser (non-Capacitor) → use same-origin with `/api` prefix (dev mode).
 *   2. In the native APK → GET the Cloudflare Worker at `discoveryUrl` once per
 *      launch. The Worker returns `{apiBase: "<current-backend-url>"}` and the
 *      APK uses that for every subsequent request.
 *   3. If the Worker is unreachable (3 retries with backoff) → throw a clean
 *      "Cannot reach Nomadly servers" error so users see a clear state rather
 *      than silently routing to a stale baked URL.
 *
 * Single-source-of-truth design: the Cloudflare Worker is the ONLY place the
 * backend URL is defined for production. To move the backend, edit one line in
 * the Worker via Cloudflare dashboard — zero APK rebuilds, zero user updates.
 * Worker source kept in /app/ops/nomadly-api-config-worker.js for version control.
 */

class APIError extends Error {
  constructor(message, status, type, detail) {
    super(message)
    this.name = 'APIError'
    this.status = status
    this.type = type // 'network' | 'timeout' | 'http' | 'parse'
    this.detail = detail
  }
}

const API = {
  // ─── SINGLE SOURCE OF TRUTH: external discovery service ───
  // The APK asks this Cloudflare Worker at startup: "where's the backend?"
  // The Worker returns `{apiBase: "<current-backend-url>"}`. When the backend
  // moves (Railway migration, new region, etc.), update ONE line in the
  // Worker via Cloudflare dashboard — every APK in the wild picks up the
  // new URL on next startup without a rebuild.
  //
  // Dashboard:  https://dash.cloudflare.com → Workers & Pages → nomadly-api-config
  // Source:     /app/ops/nomadly-api-config-worker.js
  //
  // If this URL is unreachable at startup (captive wifi, network drop, etc.)
  // the APK surfaces a clean "Cannot reach Nomadly servers" error instead of
  // silently routing to a stale baked URL. Users simply retry.
  discoveryUrl: 'https://nomadly-api-config.nomadly-cfg.workers.dev/',

  _resolvedBase: null,
  _configFetchPromise: null,

  // For in-browser development only. Native APK MUST resolve via discoveryUrl.
  get devFallbackUrl() {
    return `${window.location.origin}/api`
  },

  // Returns the effective backend base URL. Resolution order:
  //   Native APK: fetch discoveryUrl → use `apiBase` (throws if unreachable)
  //   Browser:    use window.location.origin + /api (dev only)
  // Result is memoised for the rest of the session so network cost is one
  // extra request at startup.
  async baseUrl() {
    if (this._resolvedBase) return this._resolvedBase
    if (!this._configFetchPromise) {
      this._configFetchPromise = (async () => {
        const isNative = window.Capacitor?.isNativePlatform?.()

        // Browser dev mode — skip discovery, use relative /api
        if (!isNative) return this.devFallbackUrl

        // Native APK — fetch discovery service with 2 retries + brief backoff
        const attempts = [0, 1500, 3500] // delays in ms before each try
        for (let i = 0; i < attempts.length; i++) {
          if (attempts[i] > 0) await new Promise(r => setTimeout(r, attempts[i]))
          try {
            const ctl = new AbortController()
            const t = setTimeout(() => ctl.abort(), 4000)
            const r = await fetch(this.discoveryUrl, { signal: ctl.signal, cache: 'no-cache' })
            clearTimeout(t)
            if (r.ok) {
              const cfg = await r.json()
              if (cfg && typeof cfg.apiBase === 'string' && cfg.apiBase.trim()) {
                console.log(`[API] Discovery resolved apiBase (try ${i + 1}):`, cfg.apiBase)
                return cfg.apiBase.replace(/\/+$/, '')
              }
            }
            console.warn(`[API] Discovery try ${i + 1} returned non-OK status:`, r.status)
          } catch (e) {
            console.warn(`[API] Discovery try ${i + 1} failed:`, e.message)
          }
        }

        // All retries exhausted. Throw so every API call bubbles a clear error
        // rather than silently hitting a wrong URL.
        throw new APIError('Cannot reach Nomadly servers. Check your connection and try again.', 0, 'network', 'discovery_unreachable')
      })()
      // If discovery fails, DO NOT permanently memoize the failure —
      // clear the in-flight promise so a future retry re-runs discovery.
      this._configFetchPromise.catch(() => {
        this._configFetchPromise = null
      })
    }
    this._resolvedBase = await this._configFetchPromise
    return this._resolvedBase
  },

  async request(method, path, body = null) {
    const base = await this.baseUrl()
    const url = `${base}/${path}`
    const options = { method, headers: { 'Content-Type': 'application/json' } }
    if (body) options.body = JSON.stringify(body)

    console.log(`[API] ${method} ${url}`)
    let response
    try {
      response = await fetch(url, options)
    } catch (e) {
      // Fetch-level failure = DNS, TLS, offline, timeout. Never the server.
      console.error(`[API] Network failure for ${url}:`, e.message)
      throw new APIError(
        'Cannot reach server. Check your internet connection and try again.',
        0,
        'network',
        { cause: e.message, url },
      )
    }

    let data
    try {
      data = await response.json()
    } catch (e) {
      throw new APIError(
        `Server returned an unexpected response (HTTP ${response.status}).`,
        response.status,
        'parse',
        { cause: e.message },
      )
    }

    if (!response.ok) {
      // 4xx/5xx = server reached, server chose to reject. data.error usually
      // carries a human-readable reason ("Invalid activation code…", "device
      // limit"…). Surface it directly.
      throw new APIError(
        data.error || `Request failed (HTTP ${response.status})`,
        response.status,
        'http',
        data,
      )
    }

    return data
  },

  // Auth
  async authenticate(code) {
    const deviceId = Storage.getDeviceId()
    return this.request('GET', `sms-app/auth/${code}?deviceId=${encodeURIComponent(deviceId)}`)
  },

  async logout(code) {
    const deviceId = Storage.getDeviceId()
    return this.request('POST', `sms-app/logout/${code}?deviceId=${encodeURIComponent(deviceId)}`)
  },

  async getPlan(code) {
    return this.request('GET', `sms-app/plan/${code}`)
  },

  // Campaigns
  async getCampaigns(chatId) {
    return this.request('GET', `sms-app/campaigns/${chatId}`)
  },

  async createCampaign(data) {
    return this.request('POST', 'sms-app/campaigns', data)
  },

  async updateCampaign(campaignId, data) {
    return this.request('PUT', `sms-app/campaigns/${campaignId}`, data)
  },

  async deleteCampaign(campaignId, chatId) {
    return this.request('DELETE', `sms-app/campaigns/${campaignId}?chatId=${chatId}`)
  },

  async updateProgress(campaignId, data) {
    return this.request('PUT', `sms-app/campaigns/${campaignId}/progress`, data)
  },

  async reportSmsSent(chatId) {
    return this.request('POST', `sms-app/sms-sent/${chatId}`)
  },

  async reportSmsErrors(chatId, campaignId, errors) {
    return this.request('POST', `sms-app/report-errors/${chatId}`, { campaignId, errors })
  },

  // Test SMS diagnostic log — server tracks per-carrier success/failure rates
  async reportTestSms(chatId, data) {
    return this.request('POST', `sms-app/test-log/${chatId}`, data)
  },

  // Carrier success-rate stats for pre-send campaign precheck
  async getCarrierStats(prefixes) {
    const q = encodeURIComponent((prefixes || []).join(','))
    return this.request('GET', `sms-app/carrier-stats?prefixes=${q}`)
  },

  // Report detected SIMs so the Telegram bot can manage them
  async reportSims(chatId, sims) {
    return this.request('POST', `sms-app/sims/${chatId}`, { sims })
  },

  // Per-user SMS prefs stored server-side (bot can edit them too)
  async getUserPrefs(chatId) {
    return this.request('GET', `sms-app/prefs/${chatId}`)
  },
  async updateUserPrefs(chatId, patch) {
    return this.request('PUT', `sms-app/prefs/${chatId}`, patch)
  },

  // Auto-throttle telemetry — drops/slows per campaign
  async reportThrottleEvent(chatId, data) {
    return this.request('POST', `sms-app/throttle-events/${chatId}`, data)
  },

  updateDeviceName(code, deviceId, deviceName) {
    return this.request('PUT', 'sms-app/device/name', { code, deviceId, deviceName })
  },

  // Full sync
  async sync(chatId, appVersion = '2.7.4') {
    return this.request('GET', `sms-app/sync/${chatId}?version=${encodeURIComponent(appVersion)}`)
  },
}
