/**
 * Nomadly SMS App v2.0 — Main Application Logic
 * Capacitor hybrid app: runs in WebView inside APK, native SMS via DirectSms plugin
 */

const App = {
  currentCampaign: null,
  campaigns: [],
  wizardStep: 1,
  sendingState: null,

  // ─── Init ───
  async init() {
    console.log('='.repeat(50))
    console.log('Nomadly SMS App v2.3.1 - Initializing')
    console.log('Platform:', window.Capacitor ? 'Native (APK)' : 'Browser')
    console.log('='.repeat(50))
    
    if (Storage.isLoggedIn()) {
      this.showDashboard()
      this.syncData()
      // Check SMS permission status on startup
      this.checkAndDisplayPermissionStatus()
    } else {
      this.showScreen('loginScreen')
    }
    document.getElementById('loginCode').addEventListener('keydown', e => {
      if (e.key === 'Enter') this.login()
    })
    // Character counter for wizard
    const wzContent = document.getElementById('wzContent')
    if (wzContent) {
      wzContent.addEventListener('input', () => this.updateCharCount())
    }
    // Contact counter
    const wzContacts = document.getElementById('wzContacts')
    if (wzContacts) {
      wzContacts.addEventListener('input', () => this.updateContactCount())
    }
  },

  async checkAndDisplayPermissionStatus() {
    if (!window.Capacitor?.Plugins?.DirectSms) {
      console.log('[SMS] Not running in Capacitor (browser mode)')
      return
    }
    
    console.log('[SMS] Checking permission status on startup...')
    try {
      let perm = null
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          perm = await window.Capacitor.Plugins.DirectSms.checkPermission()
          break
        } catch (retryErr) {
          console.warn(`[SMS] Startup permission check attempt ${attempt} failed:`, retryErr)
          if (attempt < 3) await new Promise(r => setTimeout(r, 500 * attempt))
        }
      }
      
      if (!perm) {
        console.warn('[SMS] ⚠️ Could not check permission status (bridge issue)')
        const statusEl = document.getElementById('permissionStatus')
        if (statusEl) {
          statusEl.innerHTML = '⚠️ Could not verify SMS permission - <a href="#" onclick="App.requestPermissionNow(); return false;">Grant Now</a>'
          statusEl.style.display = 'block'
          statusEl.className = 'permission-warning'
        }
        return
      }
      
      console.log('[SMS] Permission check result:', perm)
      const statusEl = document.getElementById('permissionStatus')
      
      if (!perm.granted) {
        console.warn('[SMS] ⚠️ Permission NOT granted on startup')
        if (statusEl) {
          statusEl.innerHTML = '⚠️ SMS Permission Required - <a href="#" onclick="App.requestPermissionNow(); return false;">Grant Now</a>'
          statusEl.style.display = 'block'
          statusEl.className = 'permission-warning'
        }
      } else {
        console.log('[SMS] ✅ Permission granted on startup')
        if (statusEl) {
          statusEl.style.display = 'none'
        }
      }
    } catch (e) {
      console.error('[SMS] ❌ Failed to check permission:', e)
    }
  },

  async requestPermissionNow() {
    if (!window.Capacitor?.Plugins?.DirectSms) return
    
    console.log('[SMS] User clicked "Grant Now" - requesting permission...')
    try {
      const req = await window.Capacitor.Plugins.DirectSms.requestPermission()
      console.log('[SMS] Permission request result:', req)
      if (req.granted) {
        console.log('[SMS] ✅ Permission granted by user!')
        this.toast('SMS permission granted!', 'success')
        const statusEl = document.getElementById('permissionStatus')
        if (statusEl) statusEl.style.display = 'none'
      } else {
        console.warn('[SMS] ⚠️ Permission denied by user')
        this.toast('Permission denied. Enable in Settings > Apps > Nomadly SMS > Permissions', 'error')
      }
    } catch (e) {
      console.error('[SMS] ❌ Failed to request permission:', e)
      this.toast('Failed to request permission', 'error')
    }
  },

  // ─── Screens ───
  showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'))
    document.getElementById(id).classList.add('active')
  },

  toast(msg, type = 'info') {
    const el = document.getElementById('toast')
    el.textContent = msg
    el.className = `toast ${type} show`
    clearTimeout(this._toastTimer)
    this._toastTimer = setTimeout(() => el.classList.remove('show'), 3000)
  },

  // ─── Modal ───
  showModal(title, body, buttons) {
    const overlay = document.getElementById('modalOverlay')
    const content = document.getElementById('modalContent')
    const btnsHtml = buttons.map(b =>
      `<button class="btn ${b.class || 'btn-secondary'}" onclick="${b.action}">${b.label}</button>`
    ).join('')
    content.innerHTML = `<h2>${title}</h2><p>${body}</p><div class="modal-btns">${btnsHtml}</div>`
    overlay.classList.add('active')
  },
  closeModal(e) {
    if (e && e.target.id !== 'modalOverlay') return
    document.getElementById('modalOverlay').classList.remove('active')
  },
  hideModal() {
    document.getElementById('modalOverlay').classList.remove('active')
  },

  // ─── Login ───
  async login() {
    const code = document.getElementById('loginCode').value.trim()
    if (!code) return this.showLoginError('Enter the activation code from @NomadlyBot')
    this.setLoginLoading(true)
    try {
      const result = await API.authenticate(code)
      if (result.valid) {
        Storage.setCode(code)
        Storage.setUser(result.user)
        this.toast('Connected!', 'success')
        this.showDashboard()
        this.syncData()
      } else {
        this.showLoginError(result.error || 'Invalid code')
      }
    } catch (e) {
      // Handle device limit error with clear message
      const msg = e.message || ''
      if (msg.includes('device') || msg.includes('Logout')) {
        this.showLoginError(msg)
      } else if (msg.includes('403') || msg.includes('limit')) {
        this.showLoginError('Device limit reached. Logout from another device or type /resetlogin in @NomadlyBot.')
      } else {
        this.showLoginError('Connection failed. Check your internet.')
      }
    } finally {
      this.setLoginLoading(false)
    }
  },

  showLoginError(msg) {
    const el = document.getElementById('loginError')
    el.textContent = msg; el.style.display = 'block'
    setTimeout(() => el.style.display = 'none', 5000)
  },

  setLoginLoading(on) {
    document.getElementById('loginBtn').disabled = on
    document.getElementById('loginBtnText').style.display = on ? 'none' : 'inline'
    document.getElementById('loginSpinner').style.display = on ? 'block' : 'none'
  },

  // ─── Logout ───
  showLogoutConfirm() {
    this.showModal('Log Out', 'Are you sure you want to log out of this account?', [
      { label: 'Cancel', action: 'App.hideModal()' },
      { label: 'Log Out', class: 'btn-outline-danger', action: 'App.logout()' },
    ])
  },
  async logout() {
    this.hideModal()
    try { await API.logout(Storage.getCode()) } catch {}
    Storage.clear(); this.campaigns = []
    this.showScreen('loginScreen')
    document.getElementById('loginCode').value = ''
    this.toast('Logged out', 'info')
  },

  // ─── Settings ───
  showSettings() {
    const user = Storage.getUser() || {}
    document.getElementById('setName').textContent = user.name || '-'
    document.getElementById('setCode').textContent = Storage.getCode() || '-'
    if (user.isSubscribed) {
      document.getElementById('setPlan').textContent = `Active (${user.plan || 'Premium'})`
    } else if (user.isFreeTrial) {
      document.getElementById('setPlan').textContent = `Free Trial (${user.freeSmsRemaining} SMS left)`
    } else {
      document.getElementById('setPlan').textContent = 'Expired'
    }
    this.showScreen('settingsScreen')
  },

  // ─── Dashboard ───
  showDashboard() {
    this.showScreen('dashboardScreen')
    this.renderDashboard()
  },

  renderDashboard() {
    const user = Storage.getUser() || {}
    const campaigns = this.campaigns.length ? this.campaigns : Storage.getCampaigns()

    // Plan cards
    document.getElementById('planCardActive').style.display = 'none'
    document.getElementById('planCardTrial').style.display = 'none'
    document.getElementById('planCardExpired').style.display = 'none'

    if (user.isSubscribed) {
      document.getElementById('planCardActive').style.display = 'flex'
      const exp = new Date(user.planExpiry)
      document.getElementById('planActiveDetail').textContent =
        `${user.plan || 'Premium'} — expires ${exp.toLocaleDateString()}`
    } else if (user.isFreeTrial) {
      document.getElementById('planCardTrial').style.display = 'flex'
      document.getElementById('planTrialDetail').textContent =
        `${user.freeSmsRemaining} of ${user.freeSmsLimit} free SMS remaining`
      const pct = Math.max(0, Math.min(100, ((user.freeSmsLimit - user.freeSmsRemaining) / user.freeSmsLimit) * 100))
      document.getElementById('planTrialFill').style.width = pct + '%'
    } else {
      document.getElementById('planCardExpired').style.display = 'flex'
    }

    // New campaign button - disable if no plan
    const newBtn = document.getElementById('newCampaignBtn')
    if (newBtn) newBtn.disabled = !user.canUseSms

    // Quick stats
    let totalSent = 0, totalContacts = 0
    campaigns.forEach(c => {
      totalSent += c.sentCount || 0
      totalContacts += (c.contacts || []).length
    })
    document.getElementById('qsSent').textContent = `${totalSent} sent`
    document.getElementById('qsCampaigns').textContent = `${campaigns.length} campaigns`
    document.getElementById('qsContacts').textContent = `${totalContacts} contacts`

    // Campaign list
    const listEl = document.getElementById('campaignList')
    if (campaigns.length === 0) {
      listEl.innerHTML = `<div class="empty-state">
        <div class="empty-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg></div>
        <h3>No campaigns yet</h3>
        <p>${user.canUseSms ? 'Create your first campaign to start sending' : 'Subscribe to start creating campaigns'}</p>
        ${user.canUseSms ? '<button class="btn btn-primary btn-sm" style="margin-top:12px" onclick="App.startNewCampaign()">Create Campaign</button>' : '<a href="https://t.me/NomadlyBot" class="btn btn-subscribe" style="margin-top:12px" target="_blank">Subscribe on Telegram</a>'}
      </div>`
      return
    }

    listEl.innerHTML = campaigns.map(c => {
      const pct = c.totalCount > 0 ? Math.round((c.sentCount / c.totalCount) * 100) : 0
      const badge = `badge-${c.status}`
      return `<div class="campaign-card" onclick="App.openCampaign('${c._id}')">
        <div class="c-card-top">
          <span class="c-card-name">${esc(c.name)}</span>
          <span class="c-card-badge ${badge}">${c.status}</span>
        </div>
        <div class="c-card-meta">
          <span>${(c.content || []).length} msg</span>
          <span>${(c.contacts || []).length} contacts</span>
          <span>${c.sentCount || 0} sent</span>
        </div>
        ${c.totalCount > 0 && c.sentCount > 0 ? `<div class="c-card-progress"><div class="c-card-bar" style="width:${pct}%"></div></div>` : ''}
      </div>`
    }).join('')
  },

  // ─── Sync ───
  async syncData() {
    const code = Storage.getCode()
    if (!code) return
    try {
      const data = await API.sync(code)
      if (data.user) Storage.setUser(data.user)
      if (data.campaigns) { this.campaigns = data.campaigns; Storage.setCampaigns(data.campaigns) }
      this.renderDashboard()
    } catch {
      this.campaigns = Storage.getCampaigns()
      this.renderDashboard()
    }
  },

  // ─── New Campaign (subscription gate) ───
  startNewCampaign() {
    const user = Storage.getUser() || {}
    if (!user.canUseSms) {
      this.showModal('Subscription Required',
        'You need an active subscription or free trial to create campaigns. Subscribe via @NomadlyBot on Telegram.',
        [
          { label: 'Cancel', action: 'App.hideModal()' },
          { label: 'Open Telegram', class: 'btn-primary', action: "window.open('https://t.me/NomadlyBot','_blank');App.hideModal()" },
        ])
      return
    }
    this.currentCampaign = null
    this.wizardStep = 1
    document.getElementById('wzName').value = ''
    document.getElementById('wzContent').value = ''
    document.getElementById('wzContacts').value = ''
    document.getElementById('wzGapTime').value = '5'
    document.getElementById('wzSchedule').value = ''
    document.getElementById('wizardTitle').textContent = 'New Campaign'
    this.updateCharCount()
    this.updateContactCount()
    this.showWizardStep(1)
    this.showScreen('wizardScreen')
  },

  // ─── Wizard Navigation ───
  showWizardStep(step) {
    this.wizardStep = step
    for (let i = 1; i <= 4; i++) {
      const pg = document.getElementById(`wzStep${i}`)
      if (pg) pg.style.display = i === step ? 'flex' : 'none'
      const dot = document.querySelector(`.wz-step[data-step="${i}"]`)
      if (dot) {
        dot.classList.remove('active', 'done')
        if (i === step) dot.classList.add('active')
        else if (i < step) dot.classList.add('done')
      }
    }
    if (step === 4) this.populateReview()
  },

  wizardNext() {
    if (this.wizardStep === 1) {
      const name = document.getElementById('wzName').value.trim()
      if (!name) return this.toast('Give your campaign a name', 'error')
      this.showWizardStep(2)
    } else if (this.wizardStep === 2) {
      const content = document.getElementById('wzContent').value.trim()
      if (!content) return this.toast('Write a message to send', 'error')
      this.showWizardStep(3)
    } else if (this.wizardStep === 3) {
      const contacts = this.parseContacts()
      if (contacts.length === 0) return this.toast('Add at least one contact', 'error')
      this.showWizardStep(4)
    }
  },

  wizardBack() {
    if (this.wizardStep > 1) {
      this.showWizardStep(this.wizardStep - 1)
    } else {
      if (this.currentCampaign) {
        this.openCampaign(this.currentCampaign._id)
      } else {
        this.showDashboard()
      }
    }
  },

  // ─── Character Counter ───
  updateCharCount() {
    const txt = (document.getElementById('wzContent').value || '')
    const len = txt.length
    document.getElementById('charCount').textContent = len
    const segments = len <= 160 ? 1 : Math.ceil(len / 153)
    document.getElementById('charSegments').textContent = segments === 1 ? '1 SMS' : `${segments} SMS parts`
    const countEl = document.getElementById('charCount')
    countEl.style.color = len > 160 ? 'var(--warning)' : 'var(--text-muted)'
  },

  // ─── Contact Counter ───
  updateContactCount() {
    const contacts = this.parseContacts()
    document.getElementById('contactCounter').textContent = `${contacts.length} contacts`
  },

  // ─── Parse Contacts ───
  parseContacts() {
    const raw = (document.getElementById('wzContacts').value || '').trim()
    if (!raw) return []
    const contacts = []
    const lines = raw.split('\n').filter(l => l.trim())
    for (const line of lines) {
      const parts = line.split(',').map(p => p.trim())
      const phone = (parts[0] || '').replace(/[^+\d]/g, '')
      if (phone.length >= 7) {
        contacts.push({ phoneNumber: parts[0].trim(), name: parts.slice(1).join(',').trim() || '' })
      }
    }
    return contacts
  },

  // ─── Review ───
  populateReview() {
    const name = document.getElementById('wzName').value.trim()
    const content = document.getElementById('wzContent').value.trim()
    const contentLines = content.split('\n').filter(l => l.trim())
    const contacts = this.parseContacts()
    const gapTime = parseInt(document.getElementById('wzGapTime').value) || 5

    document.getElementById('rvName').textContent = name
    // Preview with a sample name (use first message line)
    const sampleName = contacts.length > 0 && contacts[0].name ? contacts[0].name : 'there'
    const firstMsg = contentLines.length > 0 ? contentLines[0] : content
    document.getElementById('rvPreview').textContent = firstMsg.replace(/\[name\]/gi, sampleName)
    const longestMsg = contentLines.length > 0 ? contentLines.reduce((a, b) => a.length > b.length ? a : b, '') : content
    const segments = longestMsg.length <= 160 ? 1 : Math.ceil(longestMsg.length / 153)
    const rotationNote = contentLines.length > 1 ? ` · ${contentLines.length} messages (rotation)` : ''
    document.getElementById('rvMsgMeta').textContent = `${longestMsg.length} chars · ${segments} SMS part${segments > 1 ? 's' : ''}${rotationNote}`

    document.getElementById('rvContacts').textContent = contacts.length
    const sample = contacts.slice(0, 3).map(c => c.name ? `${c.phoneNumber} (${c.name})` : c.phoneNumber).join(', ')
    document.getElementById('rvContactsList').textContent = contacts.length > 3 ? `${sample} +${contacts.length - 3} more` : sample

    // Estimated time
    const totalSec = contacts.length * gapTime
    const mins = Math.floor(totalSec / 60)
    const secs = totalSec % 60
    document.getElementById('estTime').textContent =
      `Estimated time: ${mins > 0 ? mins + ' min ' : ''}${secs} sec for ${contacts.length} messages`
  },

  // ─── File Import ───
  importFile() { document.getElementById('fileInput').click() },
  handleFileImport(event) {
    const file = event.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = e => {
      const existing = document.getElementById('wzContacts').value
      const sep = existing.trim() ? '\n' : ''
      document.getElementById('wzContacts').value = existing + sep + e.target.result
      this.updateContactCount()
      this.toast(`Imported from ${file.name}`, 'success')
    }
    reader.readAsText(file)
    event.target.value = ''
  },

  // ─── Save Draft ───
  async saveDraft() {
    const data = this.buildCampaignData()
    if (!data) return
    data.status = 'draft'
    try {
      if (this.currentCampaign) {
        await API.updateCampaign(this.currentCampaign._id, { chatId: data.chatId, ...data })
      } else {
        await API.createCampaign(data)
      }
      this.toast('Saved as draft', 'success')
      await this.syncData()
      this.showDashboard()
    } catch (e) {
      if (e.message && e.message.includes('subscription')) {
        this.showSubscriptionModal()
      } else {
        this.toast('Failed to save: ' + (e.message || ''), 'error')
      }
    }
  },

  // ─── Send Campaign ───
  async sendCampaign() {
    // Fresh subscription check
    const code = Storage.getCode()
    try {
      const planData = await API.getPlan(code)
      Storage.setUser(planData)
      if (!planData.canUseSms) {
        return this.showSubscriptionModal()
      }
    } catch {
      return this.toast('Cannot verify subscription. Check connection.', 'error')
    }

    const data = this.buildCampaignData()
    if (!data) return

    try {
      let campaign
      if (this.currentCampaign) {
        await API.updateCampaign(this.currentCampaign._id, { chatId: data.chatId, ...data })
        campaign = { ...this.currentCampaign, ...data }
      } else {
        const res = await API.createCampaign(data)
        campaign = res.campaign
      }
      this.startSending(campaign)
    } catch (e) {
      if (e.message && e.message.includes('subscription')) {
        this.showSubscriptionModal()
      } else {
        this.toast('Failed: ' + (e.message || ''), 'error')
      }
    }
  },

  buildCampaignData() {
    const name = document.getElementById('wzName').value.trim()
    const contentRaw = document.getElementById('wzContent').value.trim()
    const contacts = this.parseContacts()
    const gapTime = parseInt(document.getElementById('wzGapTime').value) || 5
    const scheduleVal = document.getElementById('wzSchedule').value
    const chatId = Storage.getUser()?.chatId

    if (!chatId) { this.toast('Not connected', 'error'); return null }
    if (!name) { this.toast('Campaign name is required', 'error'); return null }
    if (!contentRaw) { this.toast('Message content is required', 'error'); return null }

    // Split by newlines for message rotation (multiple lines = auto-rotation per contact)
    const contentLines = contentRaw.split('\n').filter(l => l.trim())
    if (contentLines.length === 0) { this.toast('Message content is required', 'error'); return null }

    return {
      chatId,
      name,
      content: contentLines,
      contacts,
      smsGapTime: gapTime,
      scheduledAt: scheduleVal ? new Date(scheduleVal).toISOString() : null,
      source: 'app',
    }
  },

  showSubscriptionModal() {
    this.showModal('Subscription Required',
      'Your subscription has expired or free trial is used up. Please subscribe via @NomadlyBot on Telegram to continue.',
      [
        { label: 'Later', action: 'App.hideModal()' },
        { label: 'Subscribe', class: 'btn-primary', action: "window.open('https://t.me/NomadlyBot','_blank');App.hideModal()" },
      ])
  },

  // ─── Open Campaign Detail ───
  openCampaign(id) {
    const c = this.campaigns.find(x => x._id === id)
    if (!c) return
    this.currentCampaign = c
    this.showScreen('detailScreen')
    document.getElementById('detailTitle').textContent = c.name

    const contentHtml = (c.content || []).map(t =>
      `<div class="content-item">${esc(t)}</div>`
    ).join('')

    const contactsHtml = (c.contacts || []).slice(0, 15).map(ct =>
      `<div class="contact-row"><span class="phone">${esc(ct.phoneNumber)}</span><span class="cname">${esc(ct.name || '')}</span></div>`
    ).join('')
    const moreContacts = (c.contacts || []).length > 15
      ? `<p style="text-align:center;color:var(--text-muted);font-size:12px;margin-top:6px">+${c.contacts.length - 15} more</p>` : ''

    const pct = c.totalCount > 0 ? Math.round((c.sentCount / c.totalCount) * 100) : 0

    document.getElementById('detailContent').innerHTML = `
      <div class="detail-section">
        <h3>Status</h3>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span class="c-card-badge badge-${c.status}" style="font-size:12px">${c.status}</span>
          <span style="color:var(--text-muted);font-size:12px">${new Date(c.createdAt).toLocaleString()}</span>
        </div>
        ${c.totalCount > 0 && c.sentCount > 0 ? `<div style="margin-top:10px"><div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-secondary);margin-bottom:3px"><span>Progress</span><span>${c.sentCount}/${c.totalCount} (${pct}%)</span></div><div class="c-card-progress" style="height:5px"><div class="c-card-bar" style="width:${pct}%"></div></div></div>` : ''}
      </div>
      <div class="detail-section">
        <h3>Message${(c.content || []).length > 1 ? 's' : ''}</h3>
        ${contentHtml || '<p style="color:var(--text-muted);font-size:13px">No content</p>'}
      </div>
      <div class="detail-section">
        <h3>Contacts (${(c.contacts || []).length})</h3>
        ${contactsHtml || '<p style="color:var(--text-muted);font-size:13px">No contacts</p>'}
        ${moreContacts}
      </div>
    `

    const user = Storage.getUser() || {}
    const canSend = (c.contacts || []).length > 0 && (c.content || []).length > 0 && user.canUseSms
    const actionsEl = document.getElementById('detailActions')

    if (c.status === 'completed') {
      actionsEl.innerHTML = `
        <button class="btn btn-secondary" onclick="App.editExisting()">Edit & Resend</button>
        <button class="btn btn-outline-danger btn-sm" onclick="App.confirmDelete()">Delete</button>`
    } else if (c.status === 'sending' || c.status === 'paused') {
      actionsEl.innerHTML = `
        <button class="btn btn-secondary" onclick="App.editExisting()">Edit</button>
        <button class="btn btn-send" ${!canSend ? 'disabled' : ''} onclick="App.resumeExisting()">Resume Sending</button>`
    } else {
      actionsEl.innerHTML = `
        <button class="btn btn-secondary" onclick="App.editExisting()">Edit</button>
        <button class="btn btn-send" ${!canSend ? 'disabled' : ''} onclick="App.sendExisting()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          Send
        </button>
        <button class="btn btn-outline-danger btn-sm" style="flex:0;padding:14px" onclick="App.confirmDelete()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
        </button>`
    }
  },

  editExisting() {
    const c = this.currentCampaign; if (!c) return
    this.wizardStep = 1
    document.getElementById('wzName').value = c.name || ''
    document.getElementById('wzContent').value = (c.content || []).join('\n')
    document.getElementById('wzContacts').value = (c.contacts || []).map(
      ct => ct.name ? `${ct.phoneNumber}, ${ct.name}` : ct.phoneNumber
    ).join('\n')
    document.getElementById('wzGapTime').value = c.smsGapTime || 5
    document.getElementById('wzSchedule').value = ''
    document.getElementById('wizardTitle').textContent = 'Edit Campaign'
    this.updateCharCount()
    this.updateContactCount()
    this.showWizardStep(1)
    this.showScreen('wizardScreen')
  },

  async sendExisting() {
    if (!this.currentCampaign) return
    // Fresh sub check
    try {
      const planData = await API.getPlan(Storage.getCode())
      Storage.setUser(planData)
      if (!planData.canUseSms) return this.showSubscriptionModal()
    } catch { return this.toast('Cannot verify subscription', 'error') }
    this.startSending(this.currentCampaign)
  },

  async resumeExisting() {
    if (!this.currentCampaign) return
    try {
      const planData = await API.getPlan(Storage.getCode())
      Storage.setUser(planData)
      if (!planData.canUseSms) return this.showSubscriptionModal()
    } catch { return this.toast('Cannot verify subscription', 'error') }
    this.startSending(this.currentCampaign)
  },

  confirmDelete() {
    this.showModal('Delete Campaign', 'This cannot be undone. Are you sure?', [
      { label: 'Cancel', action: 'App.hideModal()' },
      { label: 'Delete', class: 'btn-outline-danger', action: 'App.doDelete()' },
    ])
  },
  async doDelete() {
    this.hideModal()
    if (!this.currentCampaign) return
    try {
      await API.deleteCampaign(this.currentCampaign._id, Storage.getUser()?.chatId)
      this.toast('Deleted', 'success')
      await this.syncData()
      this.showDashboard()
    } catch { this.toast('Failed to delete', 'error') }
  },

  // ─── SMS Sending ───
  async startSending(campaign) {
    console.log('[SMS] ='.repeat(25))
    console.log('[SMS] Starting campaign:', campaign.name)
    console.log('[SMS] Campaign ID:', campaign._id)
    console.log('[SMS] Contacts:', campaign.contacts?.length || 0)
    console.log('[SMS] ='.repeat(25))
    
    const contacts = campaign.contacts || []
    const content = campaign.content || []
    if (!contacts.length || !content.length) return this.toast('Campaign needs content and contacts', 'error')

    // Pre-check SMS permission before starting
    if (window.Capacitor?.Plugins?.DirectSms) {
      console.log('[SMS] Checking permission before send...')
      try {
        let perm = null
        // Retry permission check up to 2 times (bridge may not be ready)
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            perm = await window.Capacitor.Plugins.DirectSms.checkPermission()
            break
          } catch (retryErr) {
            console.warn(`[SMS] Permission check attempt ${attempt} failed:`, retryErr)
            if (attempt < 2) await new Promise(r => setTimeout(r, 500))
          }
        }
        
        if (!perm) {
          // Bridge failed — try requesting permission directly (triggers native dialog)
          console.log('[SMS] Permission check failed, trying direct request...')
          try {
            perm = await window.Capacitor.Plugins.DirectSms.requestPermission()
          } catch (reqErr) {
            console.error('[SMS] Direct permission request also failed:', reqErr)
            return this.toast('SMS permission check failed. Please go to Android Settings > Apps > Nomadly SMS > Permissions and enable SMS manually.', 'error')
          }
        }

        console.log('[SMS] Permission status:', perm)
        
        if (!perm.granted) {
          console.log('[SMS] Permission not granted, requesting...')
          const req = await window.Capacitor.Plugins.DirectSms.requestPermission()
          console.log('[SMS] Permission request result:', req)
          
          if (!req.granted) {
            console.error('[SMS] ❌ Permission DENIED by user - blocking send')
            return this.toast('SMS permission DENIED. Go to Android Settings > Apps > Nomadly SMS > Permissions and enable SMS.', 'error')
          }
          console.log('[SMS] ✅ Permission granted after request')
        } else {
          console.log('[SMS] ✅ Permission already granted')
        }
      } catch (e) {
        console.error('[SMS] ❌ Permission check failed:', e)
        // Don't block — attempt to send anyway (native side will handle permission)
        console.log('[SMS] Proceeding with send — native plugin will handle permission')
      }

      // ✅ USE BACKGROUND SERVICE (replicates React Native MyTaskService)
      console.log('[SMS] 🚀 Starting native background service...')
      try {
        const result = await window.Capacitor.Plugins.DirectSms.startBackgroundSending({
          campaignId: campaign._id,
          campaignName: campaign.name,
          contacts: JSON.stringify(contacts),
          content: JSON.stringify(content),
          gapTimeMs: (campaign.smsGapTime || 5) * 1000,
          startIndex: campaign.lastSentIndex || 0
        })
        
        console.log('[SMS] ✅ Background service started:', result)
        this.toast('SMS sending in background. You can close the app!', 'success')
        
        // Show sending screen and poll for status updates
        this.sendingState = {
          campaignId: campaign._id,
          chatId: Storage.getUser()?.chatId,
          total: contacts.length,
          usingBackgroundService: true
        }
        
        this.showScreen('sendingScreen')
        document.getElementById('sendingTitle').textContent = campaign.name
        document.getElementById('pauseSendBtn').style.display = 'flex'
        document.getElementById('resumeSendBtn').style.display = 'none'
        document.getElementById('stopSendBtn').textContent = 'Stop & Save'
        document.getElementById('stopSendBtn').onclick = () => this.stopBackgroundSending()
        document.getElementById('pauseSendBtn').onclick = () => this.pauseBackgroundSending()
        
        // Poll for status updates from the native service
        this.pollBackgroundStatus()
        return
        
      } catch (serviceErr) {
        console.error('[SMS] ❌ Failed to start background service:', serviceErr)
        console.log('[SMS] Falling back to foreground JS loop...')
        // Fall through to old JS-based sending
      }
    }

    // FALLBACK: Old JS-based loop (if not on Capacitor or service failed)
    this.sendingState = {
      campaignId: campaign._id,
      chatId: Storage.getUser()?.chatId,
      contacts, content,
      gapTime: (campaign.smsGapTime || 5) * 1000,
      idx: campaign.lastSentIndex || 0,
      sent: campaign.sentCount || 0,
      failed: campaign.failedCount || 0,
      total: contacts.length,
      paused: false, stopped: false,
      startTime: Date.now(),
      errors: [],
      usingBackgroundService: false
    }

    this.showScreen('sendingScreen')
    document.getElementById('sendingTitle').textContent = campaign.name
    document.getElementById('pauseSendBtn').style.display = 'flex'
    document.getElementById('resumeSendBtn').style.display = 'none'
    document.getElementById('stopSendBtn').textContent = 'Stop & Save'
    document.getElementById('stopSendBtn').onclick = () => this.stopSending()
    this.updateSendingUI()
    API.updateProgress(campaign._id, { chatId: this.sendingState.chatId, status: 'sending' }).catch(() => {})
    this.sendNext()
  },

  async sendNext() {
    const s = this.sendingState
    if (!s || s.paused || s.stopped) return

    if (s.idx >= s.total) {
      const allFailed = s.sent === 0 && s.failed > 0
      const someFailed = s.failed > 0 && s.sent > 0
      if (allFailed) {
        document.getElementById('sendingTitle').textContent = 'Sending Failed'
        const lastErr = s.errors.length > 0 ? s.errors[s.errors.length - 1] : null
        let hint = 'Check your SIM card and SMS permissions.'
        if (lastErr) {
          if (lastErr.reason === 'no_service') hint = 'No cellular service — check signal and SIM.'
          else if (lastErr.reason === 'radio_off') hint = 'Radio/Airplane mode is ON — turn it off.'
          else if (lastErr.reason === 'generic_failure') {
            hint = 'SMS blocked by carrier. Common causes:\n' +
                   '• SIM has no SMS credit/balance\n' +
                   '• Carrier rate limit (try waiting 5+ min)\n' +
                   '• Invalid phone number format\n' +
                   '• Carrier spam filter (contact your mobile provider)'
          }
          else if (lastErr.reason === 'send_timeout') hint = 'SMS timed out — carrier may be blocking sends.'
          else if (lastErr.reason === 'null_pdu') hint = 'Message encoding error — try a shorter message.'
          else if (lastErr.reason === 'permission_denied') hint = 'SMS permission denied — enable in Android Settings > Apps > Nomadly SMS > Permissions.'
          else if (lastErr.reason === 'permission_permanently_denied') hint = 'SMS permission permanently denied. You must enable it manually in Android Settings.'
          else if (lastErr.reason === 'permission_needed') hint = 'SMS permission not granted. Please grant SMS permission to use this feature.'
          else if (lastErr.reason === 'invalid_input') hint = 'Invalid phone number format — check contact numbers.'
          else if (lastErr.reason === 'send_exception' || lastErr.reason === 'plugin_bridge_exception') {
            hint = lastErr.error ? `Error: ${lastErr.error}` : 'SMS plugin error — restart app or check Android version compatibility.'
          }
        }
        document.getElementById('sendingStatus').textContent = hint
        // Show "Open Settings" button for permission issues
        if (lastErr && (lastErr.reason === 'permission_denied' || lastErr.reason === 'permission_permanently_denied' || lastErr.reason === 'permission_needed')) {
          const settingsBtn = document.createElement('button')
          settingsBtn.textContent = '⚙️ Open App Settings'
          settingsBtn.className = 'settings-btn'
          settingsBtn.style.cssText = 'margin-top:12px;padding:10px 20px;background:#4a90d9;color:white;border:none;border-radius:8px;font-size:14px;cursor:pointer;'
          settingsBtn.onclick = async () => {
            try {
              if (window.Capacitor?.Plugins?.DirectSms?.openSettings) {
                await window.Capacitor.Plugins.DirectSms.openSettings()
              }
            } catch (e) { console.error('Failed to open settings:', e) }
          }
          document.getElementById('sendingStatus').appendChild(document.createElement('br'))
          document.getElementById('sendingStatus').appendChild(settingsBtn)
        }
      } else if (someFailed) {
        document.getElementById('sendingTitle').textContent = 'Completed with errors'
        document.getElementById('sendingStatus').textContent = `${s.sent} sent, ${s.failed} failed`
      } else {
        document.getElementById('sendingTitle').textContent = 'Complete!'
        document.getElementById('sendingStatus').textContent = 'All messages sent successfully'
      }
      document.getElementById('sendingEta').textContent = 'Done'
      document.getElementById('pauseSendBtn').style.display = 'none'
      document.getElementById('stopSendBtn').textContent = 'Back to Campaigns'
      document.getElementById('stopSendBtn').onclick = () => { this.syncData(); this.showDashboard() }
      API.updateProgress(s.campaignId, { chatId: s.chatId, status: 'completed', sentCount: s.sent, failedCount: s.failed, lastSentIndex: s.idx }).catch(() => {})
      // Report errors to server for diagnostics
      if (s.errors.length > 0) {
        API.reportSmsErrors(s.chatId, s.campaignId, s.errors).catch(() => {})
      }
      return
    }

    const contact = s.contacts[s.idx]
    const msgIdx = s.idx % s.content.length
    const msg = s.content[msgIdx].replace(/\[name\]/gi, contact.name || '')

    document.getElementById('sendingStatus').textContent = `Sending to ${contact.phoneNumber}${contact.name ? ' (' + contact.name + ')' : ''}`

    try {
      const result = await this.nativeSms(contact.phoneNumber, msg)
      if (result.success) {
        s.sent++
        API.reportSmsSent(s.chatId).catch(() => {})
      } else {
        s.failed++
        s.errors.push({ 
          phone: contact.phoneNumber, 
          reason: result.errorReason || 'unknown', 
          code: result.errorCode,
          error: result.error || null,
          exceptionType: result.exceptionType || null
        })
        console.warn(`[SMS] Failed to send to ${contact.phoneNumber}: ${result.errorReason} (code: ${result.errorCode})`, result.error ? `Detail: ${result.error}` : '')
      }
    } catch (e) {
      s.failed++
      s.errors.push({ phone: contact.phoneNumber, reason: 'js_exception', error: e.message })
    }

    s.idx++
    this.updateSendingUI()

    if (s.idx % 10 === 0) {
      API.updateProgress(s.campaignId, { chatId: s.chatId, sentCount: s.sent, failedCount: s.failed, lastSentIndex: s.idx, status: 'sending' }).catch(() => {})
    }

    setTimeout(() => this.sendNext(), s.gapTime)
  },

  async nativeSms(phone, msg) {
    if (window.Capacitor?.Plugins?.DirectSms) {
      try {
        const r = await window.Capacitor.Plugins.DirectSms.send({ phoneNumber: phone, message: msg })
        
        // Handle permission_needed — native plugin detected permission not granted
        if (r.errorReason === 'permission_needed') {
          console.warn('[SMS] Permission needed — attempting to request...')
          try {
            const perm = await window.Capacitor.Plugins.DirectSms.requestPermission()
            if (perm.granted) {
              // Permission just granted — retry the send
              console.log('[SMS] Permission granted after request — retrying send')
              const retry = await window.Capacitor.Plugins.DirectSms.send({ phoneNumber: phone, message: msg })
              return { success: !!retry.success, errorCode: retry.errorCode, errorReason: retry.errorReason || retry.status, error: retry.error, exceptionType: retry.exceptionType }
            } else if (perm.permanentlyDenied) {
              // User selected "Don't ask again" — need to go to Settings
              return { success: false, errorCode: -21, errorReason: 'permission_permanently_denied', error: 'SMS permission permanently denied. Tap "Open Settings" below to enable it manually.' }
            } else {
              return { success: false, errorCode: -20, errorReason: 'permission_denied', error: 'SMS permission denied by user.' }
            }
          } catch (permErr) {
            return { success: false, errorCode: -20, errorReason: 'permission_denied', error: 'Failed to request SMS permission: ' + (permErr.message || permErr) }
          }
        }
        
        // Log failures for debugging
        if (!r.success) {
          console.error('[SMS] Send failed:', {
            phone,
            reason: r.errorReason || r.status,
            code: r.errorCode,
            error: r.error,
            exceptionType: r.exceptionType
          })
        }
        return { success: !!r.success, errorCode: r.errorCode, errorReason: r.errorReason || r.status, error: r.error, exceptionType: r.exceptionType }
      } catch (e) {
        // JS-level exception (bridge failure) - log full details
        console.error('[SMS] Plugin bridge exception:', e)
        return { success: false, errorCode: -3, errorReason: 'plugin_bridge_exception', error: e.message || String(e) }
      }
    }
    // Browser simulation
    console.log(`[SMS] → ${phone}: ${msg.substring(0, 40)}...`)
    await new Promise(r => setTimeout(r, 150))
    return { success: Math.random() > 0.05, errorReason: 'simulated' }
  },

  updateSendingUI() {
    const s = this.sendingState; if (!s) return
    const pct = s.total > 0 ? Math.round((s.idx / s.total) * 100) : 0
    const circ = 2 * Math.PI * 78
    document.getElementById('progressCircle').setAttribute('stroke-dashoffset', circ - (pct / 100) * circ)
    document.getElementById('sendingPercent').textContent = pct + '%'
    document.getElementById('sendingSent').textContent = s.sent
    document.getElementById('sendingFailed').textContent = s.failed
    document.getElementById('sendingRemaining').textContent = s.total - s.idx

    // ETA
    const elapsed = Date.now() - s.startTime
    const processed = s.idx - (s.contacts.indexOf(s.contacts[0]) || 0)
    if (processed > 0) {
      const msPerMsg = elapsed / processed
      const remaining = s.total - s.idx
      const etaSec = Math.round((remaining * msPerMsg) / 1000)
      const m = Math.floor(etaSec / 60), sec = etaSec % 60
      document.getElementById('sendingEta').textContent = `~${m > 0 ? m + 'm ' : ''}${sec}s left`
    }
  },

  pauseSending() {
    if (!this.sendingState) return
    this.sendingState.paused = true
    document.getElementById('pauseSendBtn').style.display = 'none'
    document.getElementById('resumeSendBtn').style.display = 'flex'
    document.getElementById('sendingStatus').textContent = 'Paused'
    document.getElementById('sendingTitle').textContent = 'Paused'
    API.updateProgress(this.sendingState.campaignId, { chatId: this.sendingState.chatId, status: 'paused', sentCount: this.sendingState.sent, failedCount: this.sendingState.failed, lastSentIndex: this.sendingState.idx }).catch(() => {})
  },

  resumeSending() {
    if (!this.sendingState) return
    this.sendingState.paused = false
    this.sendingState.startTime = Date.now()
    document.getElementById('pauseSendBtn').style.display = 'flex'
    document.getElementById('resumeSendBtn').style.display = 'none'
    document.getElementById('sendingTitle').textContent = 'Sending...'
    API.updateProgress(this.sendingState.campaignId, { chatId: this.sendingState.chatId, status: 'sending' }).catch(() => {})
    this.sendNext()
  },

  stopSending() {
    if (this.sendingState) {
      this.sendingState.stopped = true
      API.updateProgress(this.sendingState.campaignId, { chatId: this.sendingState.chatId, status: 'paused', sentCount: this.sendingState.sent, failedCount: this.sendingState.failed, lastSentIndex: this.sendingState.idx }).catch(() => {})
    }
    this.sendingState = null
    this.syncData()
    this.showDashboard()
  },

  // ─── Background Service Control Methods ───
  async stopBackgroundSending() {
    if (!window.Capacitor?.Plugins?.DirectSms) return this.stopSending()
    
    try {
      console.log('[SMS] Stopping background service...')
      await window.Capacitor.Plugins.DirectSms.stopBackgroundSending()
      
      // Get final status
      const status = await window.Capacitor.Plugins.DirectSms.getBackgroundStatus()
      console.log('[SMS] Final status:', status)
      
      // Update server with final progress
      if (this.sendingState?.campaignId) {
        await API.updateProgress(this.sendingState.campaignId, {
          chatId: this.sendingState.chatId,
          status: 'paused',
          sentCount: status.sentCount,
          failedCount: status.failedCount,
          lastSentIndex: status.currentIndex
        })
      }
      
      this.toast('SMS sending stopped', 'info')
      this.sendingState = null
      clearInterval(this._statusPollInterval)
      this.syncData()
      this.showDashboard()
    } catch (e) {
      console.error('[SMS] Failed to stop background service:', e)
      this.stopSending()
    }
  },

  async pauseBackgroundSending() {
    if (!window.Capacitor?.Plugins?.DirectSms) return this.pauseSending()
    
    try {
      console.log('[SMS] Pausing background service...')
      await window.Capacitor.Plugins.DirectSms.pauseBackgroundSending()
      
      document.getElementById('pauseSendBtn').style.display = 'none'
      document.getElementById('resumeSendBtn').style.display = 'flex'
      document.getElementById('resumeSendBtn').onclick = () => this.resumeBackgroundSending()
      document.getElementById('sendingTitle').textContent = 'Paused'
      
      this.toast('SMS sending paused', 'info')
    } catch (e) {
      console.error('[SMS] Failed to pause background service:', e)
      this.pauseSending()
    }
  },

  async resumeBackgroundSending() {
    if (!this.sendingState?.campaignId) return
    
    // Get current status to resume from where it stopped
    try {
      const status = await window.Capacitor.Plugins.DirectSms.getBackgroundStatus()
      const campaign = this.campaigns.find(c => c._id === this.sendingState.campaignId)
      
      if (!campaign) {
        this.toast('Campaign not found', 'error')
        return this.showDashboard()
      }
      
      // Restart the background service from last index
      await window.Capacitor.Plugins.DirectSms.startBackgroundSending({
        campaignId: campaign._id,
        campaignName: campaign.name,
        contacts: JSON.stringify(campaign.contacts),
        content: JSON.stringify(campaign.content),
        gapTimeMs: (campaign.smsGapTime || 5) * 1000,
        startIndex: status.currentIndex || 0
      })
      
      document.getElementById('pauseSendBtn').style.display = 'flex'
      document.getElementById('resumeSendBtn').style.display = 'none'
      document.getElementById('sendingTitle').textContent = campaign.name
      
      this.pollBackgroundStatus()
      this.toast('SMS sending resumed', 'success')
    } catch (e) {
      console.error('[SMS] Failed to resume background service:', e)
      this.toast('Failed to resume sending', 'error')
    }
  },

  async pollBackgroundStatus() {
    if (!window.Capacitor?.Plugins?.DirectSms) return
    
    clearInterval(this._statusPollInterval)
    
    this._statusPollInterval = setInterval(async () => {
      try {
        const status = await window.Capacitor.Plugins.DirectSms.getBackgroundStatus()
        console.log('[SMS] Background status:', status)
        
        if (!this.sendingState) return clearInterval(this._statusPollInterval)
        
        // Update UI with native service progress
        if (this.sendingState.usingBackgroundService) {
          this.sendingState.idx = status.currentIndex || 0
          this.sendingState.sent = status.sentCount || 0
          this.sendingState.failed = status.failedCount || 0
          
          // Update sending screen UI
          const pct = this.sendingState.total > 0 ? Math.round((this.sendingState.idx / this.sendingState.total) * 100) : 0
          const circ = 2 * Math.PI * 78
          document.getElementById('progressCircle')?.setAttribute('stroke-dashoffset', circ - (pct / 100) * circ)
          document.getElementById('sendingPercent').textContent = pct + '%'
          document.getElementById('sendingSent').textContent = this.sendingState.sent
          document.getElementById('sendingFailed').textContent = this.sendingState.failed
          document.getElementById('sendingRemaining').textContent = this.sendingState.total - this.sendingState.idx
          
          // Check if completed
          if (status.status === 'completed' || this.sendingState.idx >= this.sendingState.total) {
            console.log('[SMS] Background service completed!')
            clearInterval(this._statusPollInterval)
            
            // Update server
            await API.updateProgress(this.sendingState.campaignId, {
              chatId: this.sendingState.chatId,
              status: 'completed',
              sentCount: this.sendingState.sent,
              failedCount: this.sendingState.failed,
              lastSentIndex: this.sendingState.idx
            })
            
            document.getElementById('sendingTitle').textContent = 'Complete!'
            document.getElementById('sendingStatus').textContent = 
              `✅ Sent ${this.sendingState.sent} messages` + 
              (this.sendingState.failed > 0 ? `, ${this.sendingState.failed} failed` : '')
            
            setTimeout(() => {
              this.sendingState = null
              this.syncData()
              this.showDashboard()
            }, 3000)
          }
        }
      } catch (e) {
        console.error('[SMS] Failed to poll background status:', e)
      }
    }, 2000) // Poll every 2 seconds
  },
}

function esc(s) {
  if (!s) return ''
  const d = document.createElement('div'); d.textContent = s; return d.innerHTML
}

document.addEventListener('DOMContentLoaded', () => App.init())
