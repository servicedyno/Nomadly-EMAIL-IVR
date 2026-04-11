/**
 * Nomadly SMS App — Local Storage Manager
 * Handles persistent storage for offline capability
 */

const Storage = {
  get(key) {
    try {
      const val = localStorage.getItem(`nomadly_${key}`)
      return val ? JSON.parse(val) : null
    } catch { return null }
  },

  set(key, value) {
    localStorage.setItem(`nomadly_${key}`, JSON.stringify(value))
  },

  remove(key) {
    localStorage.removeItem(`nomadly_${key}`)
  },

  // User session
  getUser() { return this.get('user') },
  setUser(user) { this.set('user', user) },
  getCode() { return this.get('code') },
  setCode(code) { this.set('code', code) },

  // Device ID — unique per installation, persists across sessions
  getDeviceId() {
    let id = this.get('deviceId')
    if (!id) {
      id = 'dev-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 8)
      this.set('deviceId', id)
    }
    return id
  },

  // Campaigns cache
  getCampaigns() { return this.get('campaigns') || [] },
  setCampaigns(campaigns) { this.set('campaigns', campaigns) },

  isLoggedIn() { return !!this.getCode() && !!this.getUser() },

  clear() {
    // Preserve deviceId across logouts
    const deviceId = this.get('deviceId')
    const keys = Object.keys(localStorage).filter(k => k.startsWith('nomadly_'))
    keys.forEach(k => localStorage.removeItem(k))
    if (deviceId) this.set('deviceId', deviceId)
  },
}
