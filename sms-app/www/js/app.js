/**
 * Nomadly SMS App — Main Application Logic
 * Manages screens, campaigns, and SMS sending simulation
 *
 * In Capacitor build: uses native SmsManager plugin
 * In browser: simulates SMS sending for testing
 */

const App = {
  currentCampaign: null,
  editingCampaign: null,
  sendingState: null,
  campaigns: [],

  // ─── Initialization ───
  init() {
    if (Storage.isLoggedIn()) {
      this.showDashboard()
      this.syncData()
    } else {
      this.showScreen('loginScreen')
    }

    // Enter key on login
    document.getElementById('loginCode').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.login()
    })
  },

  // ─── Screen Management ───
  showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'))
    document.getElementById(id).classList.add('active')
  },

  // ─── Toast Notifications ───
  toast(message, type = 'info') {
    const el = document.getElementById('toast')
    el.textContent = message
    el.className = `toast ${type} show`
    setTimeout(() => el.classList.remove('show'), 3000)
  },

  // ─── Modal Management ───
  showLogoutModal() {
    document.getElementById('logoutModal').classList.add('active')
  },
  showDeleteModal() {
    document.getElementById('deleteModal').classList.add('active')
  },
  hideModal(id) {
    document.getElementById(id).classList.remove('active')
  },

  // ─── Login ───
  async login() {
    const code = document.getElementById('loginCode').value.trim()
    if (!code) {
      this.showLoginError('Please enter your activation code')
      return
    }

    this.setLoginLoading(true)
    try {
      const result = await API.authenticate(code)
      if (result.valid) {
        Storage.setCode(code)
        Storage.setUser(result.user)
        this.toast('Connected successfully!', 'success')
        this.showDashboard()
        this.syncData()
      } else {
        this.showLoginError(result.error || 'Invalid code')
      }
    } catch (error) {
      this.showLoginError(error.message || 'Connection failed. Check your internet.')
    } finally {
      this.setLoginLoading(false)
    }
  },

  showLoginError(msg) {
    const el = document.getElementById('loginError')
    el.textContent = msg
    el.style.display = 'block'
    setTimeout(() => el.style.display = 'none', 5000)
  },

  setLoginLoading(loading) {
    document.getElementById('loginBtn').disabled = loading
    document.getElementById('loginBtnText').style.display = loading ? 'none' : 'inline'
    document.getElementById('loginSpinner').style.display = loading ? 'block' : 'none'
  },

  // ─── Logout ───
  async logout() {
    this.hideModal('logoutModal')
    const code = Storage.getCode()
    try {
      await API.logout(code)
    } catch (e) { /* ignore */ }
    Storage.clear()
    this.campaigns = []
    this.showScreen('loginScreen')
    document.getElementById('loginCode').value = ''
    this.toast('Logged out', 'info')
  },

  // ─── Dashboard ───
  showDashboard() {
    this.showScreen('dashboardScreen')
    this.renderDashboard()
  },

  renderDashboard() {
    const user = Storage.getUser()
    const campaigns = this.campaigns.length ? this.campaigns : Storage.getCampaigns()

    // Plan banner
    if (user) {
      const planStatus = document.getElementById('planStatus')
      const planBadge = document.getElementById('planBadge')

      if (user.isSubscribed) {
        const expiry = new Date(user.planExpiry)
        planStatus.textContent = `Active until ${expiry.toLocaleDateString()}`
        planBadge.textContent = user.plan || 'Active'
        planBadge.style.background = 'rgba(34,197,94,0.3)'
      } else if (user.isFreeTrial) {
        planStatus.textContent = `Free Trial: ${user.freeSmsRemaining} SMS left`
        planBadge.textContent = 'Trial'
        planBadge.style.background = 'rgba(245,158,11,0.3)'
      } else {
        planStatus.textContent = 'No active subscription'
        planBadge.textContent = 'Expired'
        planBadge.style.background = 'rgba(239,68,68,0.3)'
      }
    }

    // Stats
    let totalSent = 0, totalFailed = 0, totalContacts = 0
    campaigns.forEach(c => {
      totalSent += c.sentCount || 0
      totalFailed += c.failedCount || 0
      totalContacts += (c.contacts || []).length
    })
    document.getElementById('statCampaigns').textContent = campaigns.length
    document.getElementById('statSent').textContent = totalSent
    document.getElementById('statContacts').textContent = totalContacts
    document.getElementById('statFailed').textContent = totalFailed

    // Campaign list
    const listEl = document.getElementById('campaignList')
    const emptyEl = document.getElementById('emptyState')

    if (campaigns.length === 0) {
      emptyEl.style.display = 'block'
      // Remove any campaign cards
      listEl.querySelectorAll('.campaign-card').forEach(c => c.remove())
      return
    }

    emptyEl.style.display = 'none'
    let html = ''
    campaigns.forEach(c => {
      const progress = c.totalCount > 0 ? Math.round((c.sentCount / c.totalCount) * 100) : 0
      const statusClass = `status-${c.status}`
      const date = new Date(c.createdAt).toLocaleDateString()
      const source = c.source === 'bot' ? '&#x1F916; Bot' : '&#x1F4F1; App'

      html += `
        <div class="campaign-card" onclick="App.showCampaignDetail('${c._id}')">
          <div class="campaign-card-header">
            <span class="campaign-name">${this.escapeHtml(c.name)}</span>
            <span class="campaign-status ${statusClass}">${c.status}</span>
          </div>
          <div class="campaign-meta">
            <span>&#x1F4AC; ${(c.content || []).length} msg</span>
            <span>&#x1F465; ${(c.contacts || []).length}</span>
            <span>&#x2705; ${c.sentCount || 0}</span>
            <span>${source}</span>
          </div>
          ${c.totalCount > 0 ? `
          <div class="campaign-progress">
            <div class="campaign-progress-bar" style="width:${progress}%"></div>
          </div>` : ''}
        </div>
      `
    })
    // Keep empty state in the list but hidden, replace other content
    listEl.innerHTML = `<div class="empty-state" id="emptyState" style="display:none">
      <div class="empty-state-icon">&#x1F4E8;</div>
      <h3>No campaigns yet</h3>
      <p>Create one here or from the Telegram bot</p>
    </div>` + html
  },

  // ─── Sync Data ───
  async syncData() {
    const code = Storage.getCode()
    if (!code) return

    try {
      const data = await API.sync(code)
      if (data.user) Storage.setUser(data.user)
      if (data.campaigns) {
        this.campaigns = data.campaigns
        Storage.setCampaigns(data.campaigns)
      }
      this.renderDashboard()
      this.toast('Synced!', 'success')
    } catch (error) {
      console.error('Sync failed:', error)
      // Use cached data
      this.campaigns = Storage.getCampaigns()
      this.renderDashboard()
    }
  },

  // ─── Campaign Detail ───
  showCampaignDetail(id) {
    const campaign = this.campaigns.find(c => c._id === id)
    if (!campaign) return

    this.currentCampaign = campaign
    this.showScreen('detailScreen')

    document.getElementById('detailTitle').textContent = campaign.name

    const contentHtml = (campaign.content || []).map((c, i) => `
      <div class="content-item">
        <span class="content-num">#${i + 1}</span>
        ${this.escapeHtml(c)}
      </div>
    `).join('')

    const contactsHtml = (campaign.contacts || []).slice(0, 20).map(c => `
      <div class="contact-row">
        <span class="phone">${this.escapeHtml(c.phoneNumber)}</span>
        <span class="name">${this.escapeHtml(c.name || '-')}</span>
      </div>
    `).join('')

    const moreContacts = (campaign.contacts || []).length > 20
      ? `<p style="text-align:center;color:var(--text-muted);margin-top:8px">... and ${campaign.contacts.length - 20} more</p>`
      : ''

    document.getElementById('detailContent').innerHTML = `
      <div class="detail-section">
        <h3>Status</h3>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span class="campaign-status status-${campaign.status}" style="font-size:14px">${campaign.status}</span>
          <span style="color:var(--text-muted);font-size:13px">${new Date(campaign.createdAt).toLocaleString()}</span>
        </div>
        ${campaign.totalCount > 0 ? `
        <div style="margin-top:12px">
          <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--text-secondary);margin-bottom:4px">
            <span>Progress</span>
            <span>${campaign.sentCount || 0} / ${campaign.totalCount}</span>
          </div>
          <div class="campaign-progress" style="height:6px">
            <div class="campaign-progress-bar" style="width:${Math.round(((campaign.sentCount || 0) / campaign.totalCount) * 100)}%"></div>
          </div>
        </div>` : ''}
      </div>

      <div class="detail-section">
        <h3>Messages (${(campaign.content || []).length})</h3>
        ${contentHtml || '<p style="color:var(--text-muted)">No content set</p>'}
      </div>

      <div class="detail-section">
        <h3>Contacts</h3>
        <div class="contacts-count">${(campaign.contacts || []).length}</div>
        <div class="contacts-sample">
          ${contactsHtml || '<p style="color:var(--text-muted);text-align:center">No contacts added</p>'}
          ${moreContacts}
        </div>
      </div>

      <div class="detail-section">
        <h3>Settings</h3>
        <div class="settings-row">
          <span class="settings-label">SMS Gap Time</span>
          <span style="color:var(--text-primary)">${campaign.smsGapTime || 5}s</span>
        </div>
        <div class="settings-row">
          <span class="settings-label">Scheduled</span>
          <span style="color:var(--text-primary)">${campaign.scheduledAt ? new Date(campaign.scheduledAt).toLocaleString() : 'Not scheduled'}</span>
        </div>
        <div class="settings-row">
          <span class="settings-label">Source</span>
          <span style="color:var(--text-primary)">${campaign.source === 'bot' ? '&#x1F916; Telegram Bot' : '&#x1F4F1; App'}</span>
        </div>
      </div>
    `

    // Action buttons based on status
    const actionsEl = document.getElementById('detailActions')
    const canSend = (campaign.contacts || []).length > 0 && (campaign.content || []).length > 0

    if (campaign.status === 'completed') {
      actionsEl.innerHTML = `
        <button class="btn btn-secondary" onclick="App.editCampaign()">&#x270F; Edit & Resend</button>
      `
    } else if (campaign.status === 'sending') {
      actionsEl.innerHTML = `
        <button class="btn btn-warning" onclick="App.startSending()">&#x25B6; Resume Sending</button>
      `
    } else {
      actionsEl.innerHTML = `
        <button class="btn btn-secondary" onclick="App.editCampaign()">&#x270F; Edit</button>
        <button class="btn btn-primary" ${!canSend ? 'disabled' : ''} onclick="App.startSending()">&#x1F680; Send</button>
      `
    }
  },

  // ─── Create Campaign ───
  showCreateCampaign() {
    this.editingCampaign = null
    document.getElementById('editTitle').textContent = 'New Campaign'
    document.getElementById('editName').value = ''
    document.getElementById('editContent').value = ''
    document.getElementById('editContacts').value = ''
    document.getElementById('editGapTime').value = '5'
    document.getElementById('editSchedule').value = ''
    this.showScreen('editScreen')
  },

  // ─── Edit Campaign ───
  editCampaign() {
    const c = this.currentCampaign
    if (!c) return

    this.editingCampaign = c
    document.getElementById('editTitle').textContent = 'Edit Campaign'
    document.getElementById('editName').value = c.name || ''
    document.getElementById('editContent').value = (c.content || []).join('\n---\n')
    document.getElementById('editContacts').value = (c.contacts || []).map(
      ct => ct.name ? `${ct.phoneNumber}, ${ct.name}` : ct.phoneNumber
    ).join('\n')
    document.getElementById('editGapTime').value = c.smsGapTime || 5
    document.getElementById('editSchedule').value = c.scheduledAt
      ? new Date(c.scheduledAt).toISOString().slice(0, 16)
      : ''
    this.showScreen('editScreen')
  },

  cancelEdit() {
    if (this.editingCampaign) {
      this.showCampaignDetail(this.editingCampaign._id)
    } else {
      this.showDashboard()
    }
  },

  // ─── Save Campaign ───
  async saveCampaign() {
    const name = document.getElementById('editName').value.trim()
    const contentRaw = document.getElementById('editContent').value.trim()
    const contactsRaw = document.getElementById('editContacts').value.trim()
    const gapTime = parseInt(document.getElementById('editGapTime').value) || 5
    const scheduleVal = document.getElementById('editSchedule').value

    if (!name) return this.toast('Please enter a campaign name', 'error')
    if (!contentRaw) return this.toast('Please enter message content', 'error')

    // Parse content (split by ---)
    const content = contentRaw.split('---').map(c => c.trim()).filter(c => c)

    // Parse contacts
    const contacts = []
    if (contactsRaw) {
      const lines = contactsRaw.split('\n').filter(l => l.trim())
      for (const line of lines) {
        const parts = line.split(',').map(p => p.trim())
        if (parts.length >= 2 && parts[0].match(/[\d+]/)) {
          contacts.push({ phoneNumber: parts[0], name: parts.slice(1).join(',').trim() })
        } else if (parts[0].match(/[\d+]/)) {
          contacts.push({ phoneNumber: parts[0], name: '' })
        }
      }
    }

    const chatId = Storage.getUser()?.chatId
    if (!chatId) return this.toast('Not authenticated', 'error')

    this.setSaveLoading(true)
    try {
      const data = {
        chatId,
        name,
        content,
        contacts,
        smsGapTime: gapTime,
        scheduledAt: scheduleVal ? new Date(scheduleVal).toISOString() : null,
        source: 'app',
      }

      if (this.editingCampaign) {
        await API.updateCampaign(this.editingCampaign._id, data)
        this.toast('Campaign updated!', 'success')
      } else {
        await API.createCampaign(data)
        this.toast('Campaign created!', 'success')
      }

      await this.syncData()
      this.showDashboard()
    } catch (error) {
      this.toast(error.message || 'Failed to save', 'error')
    } finally {
      this.setSaveLoading(false)
    }
  },

  setSaveLoading(loading) {
    document.getElementById('saveBtn').disabled = loading
    document.getElementById('saveBtnText').style.display = loading ? 'none' : 'inline'
    document.getElementById('saveSpinner').style.display = loading ? 'block' : 'none'
  },

  // ─── Delete Campaign ───
  async confirmDelete() {
    this.hideModal('deleteModal')
    if (!this.currentCampaign) return

    const chatId = Storage.getUser()?.chatId
    try {
      await API.deleteCampaign(this.currentCampaign._id, chatId)
      this.toast('Campaign deleted', 'success')
      this.currentCampaign = null
      await this.syncData()
      this.showDashboard()
    } catch (error) {
      this.toast('Failed to delete', 'error')
    }
  },

  // ─── File Import ───
  importFile() {
    document.getElementById('fileInput').click()
  },

  handleFileImport(event) {
    const file = event.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target.result
      const existingContacts = document.getElementById('editContacts').value
      const separator = existingContacts.trim() ? '\n' : ''
      document.getElementById('editContacts').value = existingContacts + separator + content
      this.toast(`Imported ${content.split('\n').filter(l => l.trim()).length} lines`, 'success')
    }
    reader.readAsText(file)
    event.target.value = '' // Reset
  },

  // ─── SMS Sending ───
  async startSending() {
    const campaign = this.currentCampaign
    if (!campaign) return

    const contacts = campaign.contacts || []
    const content = campaign.content || []
    if (contacts.length === 0 || content.length === 0) {
      return this.toast('Campaign needs content and contacts', 'error')
    }

    // Check subscription
    const user = Storage.getUser()
    if (!user.isSubscribed && !user.isFreeTrial) {
      return this.toast('Subscription required. Subscribe via @NomadlyBot', 'error')
    }

    this.sendingState = {
      campaignId: campaign._id,
      chatId: user.chatId,
      contacts,
      content,
      gapTime: (campaign.smsGapTime || 5) * 1000,
      currentIndex: campaign.lastSentIndex || 0,
      sentCount: campaign.sentCount || 0,
      failedCount: campaign.failedCount || 0,
      totalCount: contacts.length,
      isPaused: false,
      isStopped: false,
    }

    this.showScreen('sendingScreen')
    document.getElementById('sendingTitle').textContent = campaign.name
    this.updateSendingUI()

    // Update status on server
    await API.updateProgress(campaign._id, {
      chatId: user.chatId,
      status: 'sending',
    }).catch(() => {})

    this.sendNextSms()
  },

  async sendNextSms() {
    const s = this.sendingState
    if (!s || s.isPaused || s.isStopped) return

    if (s.currentIndex >= s.totalCount) {
      // Completed
      s.status = 'completed'
      document.getElementById('sendingTitle').textContent = 'Completed!'
      document.getElementById('sendingStatus').textContent = 'All messages sent!'
      document.getElementById('pauseSendBtn').style.display = 'none'
      document.getElementById('stopSendBtn').textContent = '← Back'
      document.getElementById('stopSendBtn').onclick = () => {
        this.syncData()
        this.showDashboard()
      }

      await API.updateProgress(s.campaignId, {
        chatId: s.chatId,
        status: 'completed',
        sentCount: s.sentCount,
        failedCount: s.failedCount,
        lastSentIndex: s.currentIndex,
      }).catch(() => {})
      return
    }

    const contact = s.contacts[s.currentIndex]
    const contentIndex = s.currentIndex % s.content.length
    const message = s.content[contentIndex].replace(/\[name\]/gi, contact.name || '')

    document.getElementById('sendingStatus').textContent =
      `Sending to ${contact.phoneNumber}${contact.name ? ' (' + contact.name + ')' : ''}...`

    try {
      // Try native SMS sending (Capacitor plugin)
      const sent = await this.sendNativeSms(contact.phoneNumber, message)
      if (sent) {
        s.sentCount++
        // Report to server
        API.reportSmsSent(s.chatId).catch(() => {})
      } else {
        s.failedCount++
      }
    } catch (error) {
      console.error('SMS send error:', error)
      s.failedCount++
    }

    s.currentIndex++
    this.updateSendingUI()

    // Sync progress to server periodically (every 10 messages)
    if (s.currentIndex % 10 === 0) {
      API.updateProgress(s.campaignId, {
        chatId: s.chatId,
        sentCount: s.sentCount,
        failedCount: s.failedCount,
        lastSentIndex: s.currentIndex,
        status: 'sending',
      }).catch(() => {})
    }

    // Wait gap time then send next
    setTimeout(() => this.sendNextSms(), s.gapTime)
  },

  async sendNativeSms(phoneNumber, message) {
    // Check if Capacitor native SMS plugin is available
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.DirectSms) {
      try {
        const result = await window.Capacitor.Plugins.DirectSms.send({
          phoneNumber,
          message,
        })
        return result.success
      } catch (e) {
        console.error('Native SMS failed:', e)
        return false
      }
    }

    // Browser fallback: simulate sending (for testing)
    console.log(`[SMS Sim] To: ${phoneNumber}, Msg: ${message.substring(0, 50)}...`)
    await new Promise(r => setTimeout(r, 200))
    // Simulate 95% success rate
    return Math.random() > 0.05
  },

  updateSendingUI() {
    const s = this.sendingState
    if (!s) return

    const percent = s.totalCount > 0 ? Math.round((s.currentIndex / s.totalCount) * 100) : 0
    const circumference = 2 * Math.PI * 70 // r=70
    const offset = circumference - (percent / 100) * circumference

    document.getElementById('progressCircle').setAttribute('stroke-dashoffset', offset)
    document.getElementById('sendingPercent').textContent = `${percent}%`
    document.getElementById('sendingSent').textContent = s.sentCount
    document.getElementById('sendingFailed').textContent = s.failedCount
    document.getElementById('sendingRemaining').textContent = s.totalCount - s.currentIndex
  },

  pauseSending() {
    if (this.sendingState) {
      this.sendingState.isPaused = true
      document.getElementById('pauseSendBtn').style.display = 'none'
      document.getElementById('resumeSendBtn').style.display = 'flex'
      document.getElementById('sendingStatus').textContent = 'Paused'
      document.getElementById('sendingTitle').textContent = 'Paused'

      API.updateProgress(this.sendingState.campaignId, {
        chatId: this.sendingState.chatId,
        status: 'paused',
        sentCount: this.sendingState.sentCount,
        failedCount: this.sendingState.failedCount,
        lastSentIndex: this.sendingState.currentIndex,
      }).catch(() => {})
    }
  },

  resumeSending() {
    if (this.sendingState) {
      this.sendingState.isPaused = false
      document.getElementById('pauseSendBtn').style.display = 'flex'
      document.getElementById('resumeSendBtn').style.display = 'none'
      document.getElementById('sendingTitle').textContent = 'Sending...'

      API.updateProgress(this.sendingState.campaignId, {
        chatId: this.sendingState.chatId,
        status: 'sending',
      }).catch(() => {})

      this.sendNextSms()
    }
  },

  stopSending() {
    if (this.sendingState) {
      this.sendingState.isStopped = true

      API.updateProgress(this.sendingState.campaignId, {
        chatId: this.sendingState.chatId,
        status: 'paused',
        sentCount: this.sendingState.sentCount,
        failedCount: this.sendingState.failedCount,
        lastSentIndex: this.sendingState.currentIndex,
      }).catch(() => {})
    }
    this.sendingState = null
    this.syncData()
    this.showDashboard()
  },

  // ─── Helpers ───
  escapeHtml(str) {
    if (!str) return ''
    const div = document.createElement('div')
    div.textContent = str
    return div.innerHTML
  },
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init())
