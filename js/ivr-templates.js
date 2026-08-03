// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Inbound Auto-Attendant Templates
// ─────────────────────────────────────────────────
// Lets a user spin up an INBOUND IVR (auto-attendant) menu in one tap by
// reusing the SAME template catalog as the OUTBOUND IVR flow (ivr-outbound.js),
// then filling in the forward destinations. Also supports user-saved templates
// (clone a configured number's menu and re-apply it to other numbers).
//
// Inbound IVR config shape (see _index.js / voice-service.js):
//   num.features.ivr = {
//     enabled, greeting, greetingType,
//     options: { '1': { action:'forward', forwardTo }, ... }
//   }
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const ivrOb = require('./ivr-outbound.js')

// ── Built-in BUSINESS auto-attendant templates (inbound-native) ──
// Unlike the reused outbound scripts, these are proper business menus with
// mixed actions (forward / voicemail). Greetings are caller-facing English
// (standard for business lines); forward options are filled in after apply.
const BUSINESS_TEMPLATES = [
  {
    key: 'biz_sales_support', name: 'Sales & Support', icon: '💼',
    greeting: 'Thank you for calling. For Sales, press 1. For Support, press 2.',
    options: { '1': { action: 'forward', label: 'Sales' }, '2': { action: 'forward', label: 'Support' } },
  },
  {
    key: 'biz_main_menu', name: 'Business Main Menu', icon: '🏢',
    greeting: 'Thank you for calling. For Sales, press 1. For Support, press 2. For Billing, press 3. To speak with an operator, press 0.',
    options: { '1': { action: 'forward', label: 'Sales' }, '2': { action: 'forward', label: 'Support' }, '3': { action: 'forward', label: 'Billing' }, '0': { action: 'forward', label: 'Operator' } },
  },
  {
    key: 'biz_billing', name: 'Billing & Accounts', icon: '💳',
    greeting: 'Thank you for calling our billing line. For payments and account questions, press 1. To leave a message, press 2.',
    options: { '1': { action: 'forward', label: 'Billing' }, '2': { action: 'voicemail', label: 'Voicemail' } },
  },
  {
    key: 'biz_after_hours', name: 'After-Hours Voicemail', icon: '🌙',
    greeting: 'Thanks for calling. We are currently closed. To leave a message, press 1 and we will get back to you.',
    options: { '1': { action: 'voicemail', label: 'Voicemail' } },
  },
  {
    key: 'biz_solo', name: 'Solo / Personal', icon: '👤',
    greeting: 'Hi, thanks for calling. To reach me now, press 1. To leave a voicemail, press 2.',
    options: { '1': { action: 'forward', label: 'My phone' }, '2': { action: 'voicemail', label: 'Voicemail' } },
  },
]
const BUSINESS_CAT_KEY = '__business__'
const BUSINESS_CAT_LABELS = { en: '💼 Business Menus', fr: '💼 Menus Pro', zh: '💼 商务菜单', hi: '💼 बिज़नेस मेनू' }
function businessCatButton(lang) { return BUSINESS_CAT_LABELS[lang] || BUSINESS_CAT_LABELS.en }
function isBusinessCatButton(text) { return Object.values(BUSINESS_CAT_LABELS).includes(text) }

// ── Categories/templates: Business pack first, then the reused outbound catalog ──
function getCategoryButtons(lang) {
  // ivrOb.getCategoryButtons includes 'custom' (no fixed templates) — drop empties.
  const outbound = ivrOb.getCategoryButtons(lang).filter((btnText) => {
    const key = ivrOb.getCategoryByButton(btnText)
    return key && (ivrOb.OUTBOUND_TEMPLATES[key] || []).length > 0
  })
  return [businessCatButton(lang), ...outbound]
}
function getCategoryByButton(buttonText) {
  if (isBusinessCatButton(buttonText)) return BUSINESS_CAT_KEY
  return ivrOb.getCategoryByButton(buttonText)
}
function getTemplateButtons(categoryKey) {
  if (categoryKey === BUSINESS_CAT_KEY) return BUSINESS_TEMPLATES.map(t => `${t.icon} ${t.name}`)
  return ivrOb.getTemplateButtons(categoryKey)
}
function getTemplateByButton(categoryKey, buttonText) {
  if (categoryKey === BUSINESS_CAT_KEY) return BUSINESS_TEMPLATES.find(t => `${t.icon} ${t.name}` === buttonText || t.name === buttonText) || null
  return ivrOb.getTemplateByButton(categoryKey, buttonText)
}
function getTemplateByKey(key) {
  return BUSINESS_TEMPLATES.find(t => t.key === key) || ivrOb.getTemplateByKey(key)
}

// ── Build an inbound IVR config from an outbound template ──
// Greeting = template script text (kept verbatim per product decision — user
// edits the [Placeholders] afterward). Each activeKey becomes a "forward"
// option with a blank destination the user fills in next.
function buildInboundIvrFromTemplate(template) {
  const options = {}
  for (const key of template.activeKeys || []) {
    options[String(key)] = {
      action: 'forward',
      forwardTo: null,
      label: `Press ${key}`,
      fromTemplate: template.key,
    }
  }
  return {
    enabled: true,
    greeting: template.text,
    greetingType: 'custom',
    appliedTemplate: template.key,
    appliedTemplateName: template.name,
    options,
  }
}

// ── Forward options that still need a destination number ──
function pendingForwardKeys(ivrConf) {
  const opts = (ivrConf && ivrConf.options) || {}
  return Object.keys(opts)
    .filter((k) => opts[k] && opts[k].action === 'forward' && !opts[k].forwardTo)
    .sort()
}

// ── Does a greeting still contain [Placeholder] tokens? ──
function greetingHasPlaceholders(text) {
  return /\[[A-Za-z0-9_]+\]/.test(String(text || ''))
}

// ── User-saved templates (stored in the user's state doc: info.savedIvrTemplates) ──
function makeUserTemplate(name, ivrConf) {
  const clean = JSON.parse(
    JSON.stringify({
      greeting: ivrConf.greeting || 'Thank you for calling.',
      greetingType: ivrConf.greetingType || 'custom',
      options: ivrConf.options || {},
    })
  )
  return {
    id: 'ut_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: String(name || 'My Menu').trim().slice(0, 40) || 'My Menu',
    createdAt: new Date().toISOString(),
    config: clean,
  }
}
function buildInboundIvrFromUserTemplate(ut) {
  const cfg = (ut && ut.config) || {}
  return {
    enabled: true,
    greeting: cfg.greeting || 'Thank you for calling.',
    greetingType: cfg.greetingType || 'custom',
    options: JSON.parse(JSON.stringify(cfg.options || {})),
    appliedTemplateName: ut.name,
  }
}

module.exports = {
  getCategoryButtons,
  getCategoryByButton,
  getTemplateButtons,
  getTemplateByButton,
  getTemplateByKey,
  buildInboundIvrFromTemplate,
  buildInboundIvrFromUserTemplate,
  pendingForwardKeys,
  greetingHasPlaceholders,
  makeUserTemplate,
}
