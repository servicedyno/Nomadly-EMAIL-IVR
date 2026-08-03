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

// ── Categories/templates: reuse outbound, but only those that actually have templates ──
function getCategoryButtons(lang) {
  // ivrOb.getCategoryButtons includes 'custom' (no fixed templates) — drop empties.
  return ivrOb.getCategoryButtons(lang).filter((btnText) => {
    const key = ivrOb.getCategoryByButton(btnText)
    return key && (ivrOb.OUTBOUND_TEMPLATES[key] || []).length > 0
  })
}
function getCategoryByButton(buttonText) {
  return ivrOb.getCategoryByButton(buttonText)
}
function getTemplateButtons(categoryKey) {
  return ivrOb.getTemplateButtons(categoryKey)
}
function getTemplateByButton(categoryKey, buttonText) {
  return ivrOb.getTemplateByButton(categoryKey, buttonText)
}
function getTemplateByKey(key) {
  return ivrOb.getTemplateByKey(key)
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
