/**
 * Nomadly SMS App — API Client
 *
 * Resolution order for the API base URL:
 *   1. In a browser (non-Capacitor) → use same-origin with `/api` prefix
 *   2. In the APK → fetch GET /sms-app/config from the baked seed URL once per
 *      launch; if it returns `{apiBase}` use that, otherwise stay on the seed.
 *   3. If the config fetch fails (DNS, offline, server down) → fall through to
 *      the seed URL so the app still works.
 *
 * This gives two layers of protection against the server URL going stale:
 *   • The seed URL (`productionUrl`) should point at a domain YOU control
 *     (e.g. api.nomadly11.sbs → CNAME → current Railway slug). A Railway
 *     rename then becomes a one-record DNS edit, zero APK rebuilds.
 *   • The /sms-app/config endpoint lets the server itself hand out a new
 *     apiBase value on the fly (for blue-green, regional routing, or emergency
 *     cutovers) even if DNS can't be changed quickly.
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
  // Baked seed URL — bake a stable custom domain here once, then let DNS
  // handle future migrations. When rebuilding the APK, this is the one
  // line to check.
  productionUrl: 'https://nomadly-email-ivr-production.up.railway.app',

  _resolvedBase: null,
  _configFetchPromise: null,

  get seedUrl() {
    if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
      return this.productionUrl
    }
    return `${window.location.origin}/api`
  },

  // Returns the effective base URL. Fetches /sms-app/config once per launch;
  // subsequent calls return the memoised value.
  async baseUrl() {
    if (this._resolvedBase) return this._resolvedBase
    if (!this._configFetchPromise) {
      this._configFetchPromise = (async () => {
        try {
          const ctl = new AbortController()
          const t = setTimeout(() => ctl.abort(), 5000)
          const r = await fetch(`${this.seedUrl}/sms-app/config`, { signal: ctl.signal })
          clearTimeout(t)
          if (r.ok) {
            const cfg = await r.json()
            if (cfg && typeof cfg.apiBase === 'string' && cfg.apiBase.trim()) {
              console.log('[API] config endpoint overrode base URL:', cfg.apiBase)
              return cfg.apiBase.replace(/\/+$/, '')
            }
          }
        } catch (e) {
          console.warn('[API] /sms-app/config unreachable — using seed URL:', e.message)
        }
        return this.seedUrl
      })()
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
  async sync(chatId, appVersion = '2.7.2') {
    return this.request('GET', `sms-app/sync/${chatId}?version=${encodeURIComponent(appVersion)}`)
  },
}
