# Feature: Inbound Auto-Attendant Templates (2026-08-03)

## What
Reuse the OUTBOUND IVR template catalog for the INBOUND auto-attendant so a user can
spin up a full menu (greeting + option keys) in one tap, then fill forward numbers.
Also: users can SAVE their configured menu as a reusable template for their other numbers.

## Decisions (from user)
1. Reuse the SAME outbound templates (payment/security/delivery) verbatim as greetings.
2. Transfer options applied BLANK, then a guided step prompts for each forward number.
3. Apply behaviour: apply directly if menu empty; if not empty, show "Replace & Apply" warning.
4. Entry point: "📋 Start from Template" at the IVR menu root (+ on the disabled-state menu).
5. Yes to user-saved templates ("💾 Save as Template" → ⭐ My Saved Templates).

## Files
- NEW js/ivr-templates.js — pure logic: reuses ivr-outbound.js catalog; buildInboundIvrFromTemplate
  (greeting=template.text, each activeKey → {action:'forward', forwardTo:null}); pendingForwardKeys;
  greetingHasPlaceholders; makeUserTemplate / buildInboundIvrFromUserTemplate.
- js/phone-config.js — added buttons pc.ivrUseTemplate + pc.ivrSaveTemplate (en/fr/zh/hi).
- js/_index.js:
  * action consts: cpIvrTplCat, cpIvrTplPick, cpIvrTplApply, cpIvrTplFillDest, cpIvrSaveTplName.
  * _ivrRootMenuRows: added [ivrUseTemplate] at top, [ivrSaveTemplate] when options exist.
  * disabled-state menu now [[enableIvr],[ivrUseTemplate]].
  * entry handlers for pc.ivrUseTemplate / pc.ivrSaveTemplate inside `action===a.cpIvr` block.
  * 5 new action handlers (category → pick → preview/confirm → apply → guided forward-number fill; save).
- User-saved templates persist in the user's state doc field `savedIvrTemplates` (cap 20). No new collection.

## Validation
- ivr-templates.js: unit-tested (categories exclude 'custom'; template→inbound config; forward-key
  detection; placeholder detection; user-template round-trip). Lint clean.
- _index.js / phone-config.js: node --check pass; all helper refs (isBackPress/isCancelPress/
  maybeWarnPreemptedByAlwaysForward/goto.submenu5) verified in scope; ivrAnalytics handler confirmed present.
- NOT conversationally tested: it's a Telegram bot; automated agents (curl/Playwright) can't drive it,
  and booting the full bot runs prod schedulers vs live DB (risky). Recommend live test via DEV bot token.

## Usability pass (done in parallel)
- Audit produced (troubleshoot_agent) — prioritized backlog kept for user approval (most items are
  behaviour changes needing conversational testing).
- Applied 2 safe additive fixes (handler already supports Back): added [↩️ Back] button to the IVR
  "Forward Call" number prompt + its invalid-number error (were empty keyboards / potential dead-ends).
