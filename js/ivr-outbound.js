// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// IVR Outbound Call — Templates, Session Management, Execution
// Allows bot users to place automated IVR calls with TTS audio
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const { log } = require('console')

// ── Trial Caller ID (hostbay_support Telnyx number) ──
const TRIAL_CALLER_ID = '+18556820054'

// ── Outbound IVR Template Categories ──
const OUTBOUND_CATEGORIES = [
  { key: 'payment', name: 'Payment Alerts', icon: '💳' },
  { key: 'security', name: 'Account Security', icon: '🔒' },
  { key: 'delivery', name: 'Delivery & Service', icon: '📦' },
  { key: 'custom', name: 'Custom Script', icon: '✍️' },
]

// ── Outbound IVR Templates ──
// Each template has: key, name, icon, text (with [Placeholders]), activeKeys
const OUTBOUND_TEMPLATES = {
  payment: [
    {
      key: 'pay_notification',
      name: 'Payment Notification',
      icon: '💳',
      text: 'Hello [Name]. This is [Bank] security department. A payment of $[Amount] has been authorized from your account to [Company]. If you authorized this transaction, you may hang up. If you did not authorize this payment, please press 1 to speak with our fraud prevention team immediately.',
      placeholders: ['Name', 'Bank', 'Company', 'Amount'],
      activeKeys: ['1'],
    },
    {
      key: 'pay_suspicious',
      name: 'Suspicious Transaction',
      icon: '🚨',
      text: 'This is [Bank] fraud protection services. We have detected a suspicious transaction of $[Amount] on your account to [Company]. This transaction has been temporarily held for your protection. To confirm this was you, press 1. To report as unauthorized and speak with a representative, press 2.',
      placeholders: ['Bank', 'Company', 'Amount'],
      activeKeys: ['1', '2'],
    },
    {
      key: 'pay_refund',
      name: 'Refund Processing',
      icon: '💰',
      text: 'Hello [Name]. This is [Company] customer service. We are calling to inform you that a refund of $[Amount] is being processed to your [Bank] account. To confirm and expedite this refund, please press 1. For questions about this refund, press 2.',
      placeholders: ['Name', 'Company', 'Bank', 'Amount'],
      activeKeys: ['1', '2'],
    },
    {
      key: 'pay_invoice',
      name: 'Invoice Due',
      icon: '📋',
      text: 'Hello [Name]. This is [Company] billing department. This is a reminder that your invoice of $[Amount] is due. To make a payment now, press 1. To discuss payment arrangements, press 2. To confirm this has already been paid, press 3.',
      placeholders: ['Name', 'Company', 'Amount'],
      activeKeys: ['1', '2', '3'],
    },
  ],
  security: [
    {
      key: 'sec_verification',
      name: 'Account Verification',
      icon: '🔒',
      text: 'This is [Company] security team. We have detected unusual login activity on your account. For your protection, your account access has been temporarily limited. To verify your identity and restore full access, press 1.',
      placeholders: ['Company'],
      activeKeys: ['1'],
    },
    {
      key: 'sec_password',
      name: 'Password Reset Alert',
      icon: '🔑',
      text: 'Hello. This is [Company]. A password reset was recently requested for your account. If you made this request, no action is needed. If you did not request this change, press 1 to secure your account immediately.',
      placeholders: ['Company'],
      activeKeys: ['1'],
    },
    {
      key: 'sec_device',
      name: 'New Device Login',
      icon: '📱',
      text: 'Hello [Name]. This is [Company] security. A new device has been used to access your account. If this was you, you may hang up. If you do not recognize this activity, press 1 to lock your account and speak with security.',
      placeholders: ['Name', 'Company'],
      activeKeys: ['1'],
    },
  ],
  delivery: [
    {
      key: 'del_confirmation',
      name: 'Delivery Confirmation',
      icon: '📦',
      text: 'Hello [Name]. This is [Company]. Your order is scheduled for delivery today. To confirm your delivery address, press 1. To reschedule delivery, press 2.',
      placeholders: ['Name', 'Company'],
      activeKeys: ['1', '2'],
    },
    {
      key: 'del_appointment',
      name: 'Appointment Reminder',
      icon: '📅',
      text: 'Hello [Name]. This is [Company] calling to confirm your upcoming appointment. Press 1 to confirm. Press 2 to reschedule. Press 3 to cancel your appointment.',
      placeholders: ['Name', 'Company'],
      activeKeys: ['1', '2', '3'],
    },
    {
      key: 'del_subscription',
      name: 'Subscription Renewal',
      icon: '🔄',
      text: 'Hello [Name]. This is [Company]. Your subscription of $[Amount] is due for renewal. To confirm automatic renewal, press 1. To cancel or modify your subscription, press 2.',
      placeholders: ['Name', 'Company', 'Amount'],
      activeKeys: ['1', '2'],
    },
  ],
}

// ── Helper Functions ──

function getCategoryButtons() {
  return OUTBOUND_CATEGORIES.map(c => `${c.icon} ${c.name}`)
}

function getCategoryByButton(buttonText) {
  for (const c of OUTBOUND_CATEGORIES) {
    if (buttonText === `${c.icon} ${c.name}`) return c.key
  }
  return null
}

function getTemplateButtons(categoryKey) {
  const templates = OUTBOUND_TEMPLATES[categoryKey] || []
  return templates.map(t => `${t.icon} ${t.name}`)
}

function getTemplateByButton(categoryKey, buttonText) {
  const templates = OUTBOUND_TEMPLATES[categoryKey] || []
  for (const t of templates) {
    if (buttonText === `${t.icon} ${t.name}`) return t
  }
  return null
}

function getTemplateByKey(templateKey) {
  for (const cat of Object.values(OUTBOUND_TEMPLATES)) {
    for (const t of cat) {
      if (t.key === templateKey) return t
    }
  }
  return null
}

/**
 * Fill template placeholders with user-provided values
 * @param {string} text - Template text with [Placeholder] markers
 * @param {object} values - { Placeholder: 'value' }
 * @returns {string} Filled text
 */
function fillTemplate(text, values) {
  let result = text
  for (const [key, val] of Object.entries(values)) {
    result = result.replace(new RegExp(`\\[${key}\\]`, 'g'), val)
  }
  return result
}

/**
 * Extract placeholder names from template text
 * @param {string} text - Template text
 * @returns {string[]} List of placeholder names
 */
function extractPlaceholders(text) {
  const matches = text.match(/\[([^\]]+)\]/g) || []
  const seen = new Set()
  return matches.map(m => m.slice(1, -1)).filter(p => {
    if (seen.has(p)) return false
    seen.add(p)
    return true
  })
}

/**
 * Format call preview message
 */
function formatCallPreview(data) {
  const lines = [
    `<b>Review Your Call</b>`,
    ``,
    `📞 Target: <b>${data.targetNumber}</b>`,
    `📱 Caller ID: <b>${data.callerId}</b>`,
    `⚡ Transfer to: <b>${data.ivrNumber}</b>`,
  ]

  if (data.templateName) {
    lines.push(`📋 Template: <b>${data.templateName}</b>`)
  }

  // Show filled placeholder values
  if (data.placeholderValues && Object.keys(data.placeholderValues).length > 0) {
    for (const [key, val] of Object.entries(data.placeholderValues)) {
      const icon = key === 'Bank' ? '🏦' : key === 'Company' ? '🏢' : key === 'Amount' ? '💲' : key === 'Name' ? '📝' : '📌'
      lines.push(`${icon} ${key}: <b>${val}</b>`)
    }
  }

  lines.push(`🎤 Voice: <b>${data.voiceName || 'Rachel'}</b>`)
  lines.push(`🔘 Transfer key: <b>${data.activeKeys?.join(', ') || '1'}</b>`)
  lines.push(`🎵 Hold Music: <b>${data.holdMusic ? 'ON' : 'OFF'}</b>`)
  lines.push(``)
  lines.push(`Press /yes to place the call`)
  lines.push(`/cancel to abort`)

  return lines.join('\n')
}

/**
 * Format call result notification for bot user
 */
function formatCallNotification(type, data) {
  const time = new Date().toLocaleString()
  const target = data.targetNumber || '?'
  const duration = data.duration || 0
  const mins = duration > 0 ? Math.ceil(duration / 60) : 0
  const durText = duration > 0 ? `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}` : '0:00'

  switch (type) {
    case 'calling':
      return `📞 <b>Calling</b> ...${target}\n📱 From: ${data.callerId}\n🏢 Template: ${data.templateName || 'Custom'}`

    case 'answered':
      return `📞 <b>Call connected</b> — playing IVR message...\n📞 ${target}`

    case 'early_hangup':
      return `📵 <b>Target hung up immediately</b>\n📞 ${target} | Duration: ${durText}\nThe recipient picked up and disconnected right away.`

    case 'no_response':
      return `📵 <b>No response</b> — IVR played but no key pressed\n📞 ${target} | Duration: ${durText}\nThe message was played but the recipient did not interact.`

    case 'busy':
      return `📵 <b>Line busy</b> — ${target} is on another call`

    case 'key_pressed':
      return `🔘 <b>Caller pressed ${data.digit}</b> — Transferring to ${data.ivrNumber}`

    case 'transferred':
      return `🔗 <b>Caller connected</b> to ${data.ivrNumber}`

    case 'hangup':
      return `📵 <b>Call Ended</b> — Recipient hung up\n📞 ${target} | Duration: ${durText}\n🔘 Key pressed: ${data.digitPressed || 'None'}`

    case 'no_answer':
      return `📵 <b>No answer</b> — ${target} did not pick up`

    case 'completed':
      return `✅ <b>Call Completed</b>\n📞 ${target} | Duration: ${durText}\n🔘 Key pressed: ${data.digitPressed || 'None'}\n🔗 Transferred to: ${data.ivrNumber || '?'}`

    case 'transfer_failed':
      return `❌ <b>Transfer Failed</b>\n📞 ${target} | Duration: ${durText}\n🔘 Key pressed: ${data.digitPressed || 'None'}\n🔗 Transfer to ${data.ivrNumber || '?'} — No answer`

    case 'failed':
      return `❌ <b>Call failed</b> — ${target}\n${data.reason || 'Unknown error'}`

    case 'trial_used':
      return `🎁 <b>Trial call complete!</b>\n\nYou used your free IVR trial call. Subscribe to Cloud Phone for unlimited IVR outbound calls with your own Caller ID.\n\nTap 📞☁️ Cloud Phone to get started!`

    default:
      return `📞 Call event: ${type}`
  }
}

module.exports = {
  TRIAL_CALLER_ID,
  OUTBOUND_CATEGORIES,
  OUTBOUND_TEMPLATES,
  getCategoryButtons,
  getCategoryByButton,
  getTemplateButtons,
  getTemplateByButton,
  getTemplateByKey,
  fillTemplate,
  extractPlaceholders,
  formatCallPreview,
  formatCallNotification,
}
