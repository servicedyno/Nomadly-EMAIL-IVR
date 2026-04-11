/**
 * Nomadly SMS App — API Client
 * Handles all communication with the server
 * Auto-detects environment: browser testing uses current host, APK uses Railway
 */

const API = {
  // Production Railway URL (used in Capacitor APK builds)
  productionUrl: 'https://nomadlynew-production.up.railway.app',

  get baseUrl() {
    // If running inside Capacitor native app, use Railway URL directly
    if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
      return this.productionUrl
    }
    // Browser testing: use current host with /api prefix for proxy
    const origin = window.location.origin
    return `${origin}/api`
  },

  async request(method, path, body = null) {
    const url = `${this.baseUrl}/${path}`
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' },
    }
    if (body) options.body = JSON.stringify(body)

    try {
      const response = await fetch(url, options)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`)
      return data
    } catch (error) {
      console.error(`[API] ${method} ${path} failed:`, error)
      throw error
    }
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

  // Full sync
  async sync(chatId) {
    return this.request('GET', `sms-app/sync/${chatId}`)
  },
}
