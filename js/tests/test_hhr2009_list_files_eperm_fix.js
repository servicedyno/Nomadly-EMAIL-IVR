/**
 * Regression test — @HHR2009 File Manager "It's not allowing" (2026-08-04)
 *
 * Production audit (Railway deployment 63c777a5-d81d-4aeb-9083-e956130146e4)
 * showed user @HHR2009 (chatId 1960615421) hitting a "It's not allowing"
 * dead-end in the panel File Manager. The bot logged 9 EPERM errors
 * between 17:53–18:29 UTC:
 *
 *   [cPanel Proxy] Fileman::list_files error (500):
 *     "/usr/local/cpanel/uapi" exited with status 1 (EPERM). [EPERM]
 *
 * The /panel/files (list) endpoint was the ONLY EPERM-affected route WITHOUT
 * a WHM-root fallback ladder (mkdir/delete/extract all have one) — so
 * transient quota-accounting blips (the dominant real-world EPERM cause)
 * could not self-recover, and ops received no visibility into which cpUser
 * was affected because the friendly path had no log line.
 *
 * Fix: cpanel-routes.js /files handler now mirrors /files/mkdir:
 *   1. Try user-level list_files (unchanged).
 *   2. If result looks like EPERM (uapi status-1 / http 500 / EPERM reason),
 *      try WHM-root fallback via /cpanel?cpanel_jsonapi_func=list_files,
 *      retried on EPERM class only, with backoffs [0, 800, 1600]ms.
 *   3. If WHM-root also fails EPERM → route through _replyEperm() which
 *      logs "[Panel] open folder blocked by broken-homedir EPERM
 *      (user: <cpUser>) — ops paged, friendly message returned" and pages
 *      ops with the fixquotas / fixhomedirperms command.
 *
 * This test uses static / import-time assertions (no live WHM/DB call) so
 * it runs offline and finishes in <1s. Live end-to-end verification is out
 * of scope here — it would require the actual production WHM box to
 * simulate a broken-homedir user, which is not safe from a dev pod.
 */

const assert = require('assert')

// Route registration + basic wiring
process.env.WHM_HOST = 'whm.test.local'
process.env.WHM_TOKEN = 'FAKE_TOKEN_FOR_LINT_ONLY'
const cp = require('../cpanel-proxy')
const routesModule = require('../cpanel-routes')

let failures = 0
function check(name, cond, detail) {
  if (cond) {
    console.log(`  ✅ ${name}`)
  } else {
    failures++
    console.error(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

// ── 1. Route module exports the createCpanelRoutes factory ─────────────
console.log('\n[1] Route factory exported')
check('createCpanelRoutes is a function', typeof routesModule.createCpanelRoutes === 'function')

// ── 2. cPanel-proxy still exposes the EPERM helpers the route depends on ─
console.log('\n[2] Helpers the /files EPERM path depends on')
check('looksLikeUapiPermFailure exported', typeof cp.looksLikeUapiPermFailure === 'function')
check('getEpermUserMessage exported',       typeof cp.getEpermUserMessage === 'function')
check('getEpermLocalizedMessages exported', typeof cp.getEpermLocalizedMessages === 'function')
check('alertEpermRepairNeeded exported',    typeof cp.alertEpermRepairNeeded === 'function')

// ── 3. The @HHR2009 error string still classifies as EPERM ─────────────
console.log('\n[3] @HHR2009 production error string classifies as EPERM')
const HHR2009_ERROR = '"/usr/local/cpanel/uapi" exited with status 1 (EPERM).'
check('looksLikeUapiPermFailure(exact production string) === true',
  cp.looksLikeUapiPermFailure(HHR2009_ERROR) === true,
  `got: ${cp.looksLikeUapiPermFailure(HHR2009_ERROR)}`)
check('looksLikeUapiPermFailure("EPERM") === true',
  cp.looksLikeUapiPermFailure('EPERM') === true)

// ── 4. Friendly user message covers all supported languages ────────────
console.log('\n[4] Friendly EPERM message is calm and multilingual')
const enMsg = cp.getEpermUserMessage('en')
check('English message reassures user', /permission|files.*safe|try again/i.test(enMsg))
check('English message does NOT leak "EPERM"', !/EPERM/i.test(enMsg))
check('English message does NOT leak "status 1"', !/status\s*1/i.test(enMsg))
check('English message does NOT leak "uapi"', !/uapi/i.test(enMsg))
const langs = cp.getEpermLocalizedMessages()
check('localized messages include en/fr/zh/hi',
  ['en', 'fr', 'zh', 'hi'].every(l => typeof langs[l] === 'string' && langs[l].length > 20))

// ── 5. Route source contains the fallback ladder for /files ────────────
console.log('\n[5] Route source has WHM-root fallback + logging for list_files')
const fs = require('fs')
const routeSrc = fs.readFileSync(require.resolve('../cpanel-routes.js'), 'utf8')

// Extract the /files (list) handler — from `router.get('/files',` up to the
// closing `res.json(result)` and closing paren/brace of the arrow fn.
const filesHandlerMatch = routeSrc.match(/router\.get\('\/files',[\s\S]*?res\.json\(result\)\s*\}\)/)
check('/files handler present in source', !!filesHandlerMatch)
const filesHandler = filesHandlerMatch ? filesHandlerMatch[0] : ''

check('/files handler references _makeWhmApi', /_makeWhmApi\(/.test(filesHandler),
  'no WHM-root fallback wiring found in /files')
check('/files handler calls Fileman::list_files via WHM json-api',
  /cpanel_jsonapi_func:\s*'list_files'/.test(filesHandler) &&
  /cpanel_jsonapi_module:\s*'Fileman'/.test(filesHandler),
  'WHM-root fallback does not target Fileman::list_files')
check('/files handler retries on EPERM class (backoff ladder)',
  /BACKOFFS\s*=\s*\[[^\]]*800[^\]]*1600/.test(filesHandler) ||
  /\[0[,\s]+800[,\s]+1600\]/.test(filesHandler),
  'backoff ladder not found')
check('/files handler logs user-level EPERM with cpUser (audit trail)',
  /log\(`\[Panel\] list_files[\s\S]*?user:\s*\$\{req\.cpUser\}/.test(filesHandler),
  'no [Panel] list_files … user: log line found')
check('/files handler logs successful WHM-fallback recovery',
  /list_files succeeded via WHM fallback/.test(filesHandler),
  'no success log for WHM fallback')
check('/files handler falls through to _replyEperm on persistent EPERM',
  /_replyEperm\(res,\s*req,\s*'open folder'\)/.test(filesHandler),
  'no _replyEperm(open folder) call — friendly + ops-page path missing')

// ── 6. _replyEperm (the friendly path) is wired correctly ──────────────
console.log('\n[6] _replyEperm logs cpUser + calls alertEpermRepairNeeded')
const replyEpermMatch = routeSrc.match(/function\s+_replyEperm\s*\([\s\S]*?\n\}/)
check('_replyEperm function present', !!replyEpermMatch)
const replyEpermSrc = replyEpermMatch ? replyEpermMatch[0] : ''
check('_replyEperm calls alertEpermRepairNeeded',
  /alertEpermRepairNeeded\(/.test(replyEpermSrc))
check('_replyEperm logs `blocked by broken-homedir EPERM (user:` for audit',
  /blocked by broken-homedir EPERM \(user:/.test(replyEpermSrc))
check('_replyEperm returns code:CPANEL_UAPI_EPERM to client',
  /code:\s*'CPANEL_UAPI_EPERM'/.test(replyEpermSrc))
check('_replyEperm returns localized messages',
  /localizedMessages:/.test(replyEpermSrc))

// ── 7. Other EPERM-sensitive routes still handle EPERM (parity) ────────
console.log('\n[7] mkdir/delete/extract still emit EPERM handling')
check(`delete item routes through _replyEperm`,
  /_replyEperm\(res,\s*req,\s*'delete item'\)/.test(routeSrc),
  `regression: delete item EPERM path removed`)
check(`extract archive routes through _replyEperm`,
  /_replyEperm\(res,\s*req,\s*'extract archive'\)/.test(routeSrc),
  `regression: extract archive EPERM path removed`)
// mkdir uses inline (not _replyEperm) — verify the alertEpermRepairNeeded call
check(`create folder still pages ops on EPERM (inline)`,
  /alertEpermRepairNeeded\(\{\s*op:\s*'create folder'/.test(routeSrc),
  'regression: create folder EPERM handler removed from mkdir')

// ── Summary ─────────────────────────────────────────────────────────────
console.log('')
if (failures === 0) {
  console.log(`✅ ALL CHECKS PASSED — /files EPERM handler now matches mkdir/extract parity`)
  console.log(`   @HHR2009 (chatId 1960615421) File Manager "It's not allowing" regression covered.`)
  process.exit(0)
} else {
  console.error(`❌ ${failures} CHECK(S) FAILED`)
  process.exit(1)
}
