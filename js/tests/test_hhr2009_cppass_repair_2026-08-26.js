/**
 * Regression test — @HHR2009 (chatId 1960615421, cpUser nnliae74)
 * 2026-08-26 22:54Z follow-up: WHM-root multipart upload fallback failed
 * because WHM's /json-api/cpanel gateway silently drops multipart bodies
 * before forwarding them to the impersonated cPanel context.
 *
 * Repro (from Railway logs, deployment 3719705c):
 *   22:53:56  [Panel] list_files succeeded via WHM fallback (8 entries)      ← previous fix works
 *   22:54:06  [Panel] Deleted file: Evite_Guest_Access.zip                    ← delete works
 *   22:54:27  [cPanel Proxy] Fileman::upload_files error (401): ... [AUTH]
 *   22:54:27  [Panel] Chunk upload user-level auth-broken (401) → WHM-root fallback
 *   22:54:29  [Panel] Chunk upload WHM-root fallback failed:
 *             setup_Unassigned.msi — "You must specify at least one file to upload."
 *   22:54:49  (retry — same failure)
 *
 * Root cause: WHM /json-api/cpanel gateway doesn't proxy multipart bodies
 * (Fileman::upload_files needs multipart/form-data; the file field is
 * silently stripped between WHM and the impersonated cPanel session).
 *
 * Fix: instead of trying to work around the gateway limitation, rotate the
 * user's cPanel password via WHM /passwd (root token), save the new
 * encrypted pass to Mongo, and retry the ORIGINAL user-level UAPI upload
 * with the fresh pass. Same code path as normal — no gateway multipart
 * surface. Idempotent + rate-limited (60-min cool-down per account).
 */
'use strict'

const assert = require('assert')
const path = require('path')
const fs = require('fs')

const routesSrc = fs.readFileSync(path.resolve(__dirname, '..', 'cpanel-routes.js'), 'utf8')

let passed = 0, failed = 0
function check(name, cond, detail = '') {
  if (cond) { console.log(`  ✅ ${name}`); passed++ }
  else { console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); failed++ }
}

// ─── 1. _repairCpPass helper is defined and structured correctly ────────
console.log('\n[1] _repairCpPass helper is defined')
check('_repairCpPass function defined', /async function _repairCpPass/.test(routesSrc))
check('takes (getCpanelCol, cpUser, whmHost) params', /async function _repairCpPass\(getCpanelCol,\s*cpUser,\s*whmHost\)/.test(routesSrc))
check('has 60-minute COOL_DOWN_MS constant', /COOL_DOWN_MS\s*=\s*60\s*\*\s*60\s*\*\s*1000/.test(routesSrc))
check('checks cpPassRotatedAt on the account doc', /doc\.cpPassRotatedAt/.test(routesSrc))

// ─── 2. Password generation is safe ──────────────────────────────────────
console.log('\n[2] Password generation is crypto-safe')
check('uses crypto.randomBytes (not Math.random)', /crypto\.randomBytes\(32\)/.test(routesSrc))
check('alphabet is [A-Za-z0-9] (URL-safe)', /'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'/.test(routesSrc))
check('generates 24-char password', /for\s*\(let i = 0; i < 24; i\+\+\)\s*newPass \+= alphabet/.test(routesSrc))

// ─── 3. WHM /passwd call shape ───────────────────────────────────────────
console.log('\n[3] WHM /passwd call shape')
check('calls whmApi.get(\'/passwd\', ...)', /whmApi\.get\(['"]\/passwd['"]\s*,/.test(routesSrc))
check('passes user + password params', /user:\s*cpUser[\s\S]{0,80}password:\s*newPass/.test(routesSrc))
check('sets db_pass_update:0 (don\'t touch MySQL passwords)', /db_pass_update:\s*0/.test(routesSrc))
check('checks metadata.result === 1 for success', /res\.data\?\.metadata\?\.result === 1/.test(routesSrc))

// ─── 4. Mongo persistence uses same AES-GCM as storeCredentials ─────────
console.log('\n[4] Mongo persistence via cpanel-auth.encrypt (matches storeCredentials)')
check('imports cpanel-auth encrypt', /const cpAuth = require\(['"]\.\/cpanel-auth['"]\)/.test(routesSrc))
check('encrypts new pass via cpAuth.encrypt', /cpAuth\.encrypt\(newPass\)/.test(routesSrc))
check('writes cpPass_encrypted', /cpPass_encrypted:\s*encPass\.encrypted/.test(routesSrc))
check('writes cpPass_iv', /cpPass_iv:\s*encPass\.iv/.test(routesSrc))
check('writes cpPass_tag', /cpPass_tag:\s*encPass\.tag/.test(routesSrc))
check('stamps cpPassRotatedAt with a Date', /cpPassRotatedAt:\s*new Date\(\)/.test(routesSrc))
check('stamps rotation reason (audit)', /cpPassLastRotateReason:\s*['"]CPANEL_AUTH_FAILURE['"]/.test(routesSrc))

// ─── 5. Callers (single + chunk upload) use _repairCpPass + retry ────────
console.log('\n[5] Upload paths use _repairCpPass + retry with fresh pass')
check('single-shot upload gates on _isAuthBroken', /Upload user-level auth-broken[\s\S]{0,400}_repairCpPass\(getCpanelCol/.test(routesSrc))
check('chunk upload gates on _isAuthBroken', /Chunk upload user-level auth-broken[\s\S]{0,400}_repairCpPass\(getCpanelCol/.test(routesSrc))
check('single-shot retries cpProxy.uploadFile with repair.cpPass', /const retry = await cpProxy\.uploadFile\(req\.cpUser, repair\.cpPass/.test(routesSrc))
check('chunk retries cpProxy.uploadFile with repair.cpPass', (routesSrc.match(/cpProxy\.uploadFile\(req\.cpUser, repair\.cpPass/g) || []).length >= 2)
check('single-shot refreshes req.cpPass so any subsequent op uses the new pass', /req\.cpPass = repair\.cpPass/.test(routesSrc))
check('logs "cpPass repair + retry" reason tag', /cpPass repair \+ retry/.test(routesSrc))
check('logs rotated flag ("rotated=true|false") for post-repair success', /rotated=\$\{repair\.rotated\}/.test(routesSrc))

// ─── 6. Failure branches emit precise "via" tags for observability ──────
console.log('\n[6] Failure paths return precise "via" tags')
check('emits via:cppass-repair-failed when repair fails', /via:\s*['"]cppass-repair-failed['"]/.test(routesSrc))
check('emits via:cppass-repaired-retry-failed when repair OK but retry fails', /via:\s*['"]cppass-repaired-retry-failed['"]/.test(routesSrc))

// ─── 7. Cool-down semantics — doesn't churn on transient blips ──────────
console.log('\n[7] Cool-down keeps us from churning on transient WHM blips')
check('inside cool-down: decrypt cached pass and return with rotated:false', /rotated:\s*false,\s*reason:\s*`cool-down/.test(routesSrc))
check('cool-down reason includes minutes left', /minsLeft/.test(routesSrc))

// ─── 8. Backward-compat — uploadFileAsRoot removed from upload flow ─────
console.log('\n[8] uploadFileAsRoot no longer used in the upload flow (kept for legacy compat)')
check('no more Upload user-level auth-broken → uploadFileAsRoot', !/Upload user-level auth-broken[\s\S]{0,500}uploadFileAsRoot/.test(routesSrc))
check('no more Chunk upload user-level auth-broken → uploadFileAsRoot', !/Chunk upload user-level auth-broken[\s\S]{0,500}uploadFileAsRoot/.test(routesSrc))
check('cpProxy.uploadFileAsRoot still exported (proxy still has it — not used in routes)', /uploadFileAsRoot/.test(fs.readFileSync(path.resolve(__dirname, '..', 'cpanel-proxy.js'), 'utf8')))

// ─── 9. Regression: EPERM path + WHM-root fallback for list/mkdir/delete/extract preserved ─
console.log('\n[9] Regression safety — non-upload ops still use WHM-root impersonation')
check('list_files still uses WHM fallback ladder', /list_files user-level failed[\s\S]{0,200}WHM fallback/.test(routesSrc))
check('mkdir still uses WHM fallback ladder', /mkdir user-level failed[\s\S]{0,200}WHM fallback/.test(routesSrc))
check('extract still uses WHM fallback ladder', /extract user-level failed[\s\S]{0,200}WHM fallback/.test(routesSrc))
check('EPERM classifier preserved (_isEpermReason)', /function _isEpermReason/.test(routesSrc))
check('_isAuthBroken preserved', /function _isAuthBroken/.test(routesSrc))

// ─── 10. Log line anchor (searchable in Railway) ────────────────────────
console.log('\n[10] Ops-searchable log anchor')
check('log line references @HHR2009 pattern', /rotated cpPass for[\s\S]{0,100}@HHR2009 pattern/.test(routesSrc))
check('log line explains why (WHM rejecting cached pass)', /WHM was rejecting cached pass/.test(routesSrc))

console.log(`\n──────────────────────────────────────────────`)
console.log(`  ${passed} passed, ${failed} failed`)
console.log(`──────────────────────────────────────────────`)
if (failed > 0) process.exit(1)
process.exit(0)
