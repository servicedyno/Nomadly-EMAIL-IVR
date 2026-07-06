# 🔍 Codebase Health Audit — 2026-06-21

Methodology: static analysis across 194,003 lines of JS + Python in /app, plus
git history, dependency tree, MongoDB usage patterns, and a manual review of
the largest files.

---

## TL;DR — Top issues ranked

| # | Issue | Severity | Effort | ROI |
|---|-------|----------|--------|-----|
| 1 | `js/_index.js` is **38,183 lines** in a single file | 🔴 Critical | Weeks | Huge |
| 2 | Hardcoded SIP password in `js/telnyx-service.js:179` | 🔴 Critical | 15 min | Security |
| 3 | **284 silent catches** swallow errors in `_index.js` | 🔴 Critical | Days | Reliability |
| 4 | **76 `.md` files** at repo root (most one-off reports) | 🟠 Major | 1 hr | Clarity |
| 5 | **44 one-off `*_test.js`** files at repo root | 🟠 Major | 1 hr | Clarity |
| 6 | `_index.js.backup` (1.4 MB) committed to git | 🟠 Major | 5 min | Hygiene |
| 7 | **3.8 MB `.apk.bak`** in `/static/` committed | 🟠 Major | 5 min | Repo bloat |
| 8 | **65 timers** (`setInterval` / `setTimeout`) in `_index.js`, untracked | 🟠 Major | 1 day | Reliability |
| 9 | **56 `.find({})` full-scan** queries | 🟠 Major | 1 day | Perf as data grows |
| 10 | **No automated test runner** (`package.json: test: "echo..."`) | 🟠 Major | 1 day | Regression safety |
| 11 | **Synchronous `fs.*Sync`** calls in request handlers | 🟡 Quality | 2 hr | Latency tail |
| 12 | **122 inline `{en, fr, zh, hi}[lang]`** translation dicts | 🟡 Quality | 1 day | Maintainability |
| 13 | **5 other JS files > 2000 lines** | 🟡 Quality | Weeks | Maintainability |
| 14 | Logs/dumps repeatedly committed → GH secret-scanner blocks | 🟡 Quality | 30 min | Velocity |
| 15 | Inconsistent log prefixing (84 `[CloudPhone]`, 62 `[Twilio]`…) | 🟢 Nice-to-have | 1 day | Observability |

---

## 1. 🔴 The monolith problem — `_index.js`

| Metric | Value |
|---|---|
| Lines | **38,183** |
| Functions defined | 313 |
| `if (action === ...)` chains | **387** (a huge implicit switch) |
| `await ` statements | 3,698 |
| `try/catch` blocks | 522 |
| `console.log` / `log()` calls | 921 |
| `db.collection(...)` calls | 128 |
| Inline `{en,fr,zh,hi}[lang]` dicts | 122 |
| Background timers (`setInterval`/`setTimeout`) | 65 |
| Loose `globalThis.<x>` reads/writes | 6 |

**Why this hurts:**
- Single point of failure — every code change risks an unrelated regression in another part of the file.
- Git diffs are unreadable; merge conflicts are common.
- Editor performance degrades; we've already seen tool calls time out on this file.
- The file mixes 30+ concerns: bot router, deposit handler, VPS, domain, phone, leads, hosting, admin endpoints, schedulers…

**Recommended phased split** (lowest-risk first, no behavioural changes):
1. **Extract admin HTTP endpoints** to `js/routes/admin.js` (`/admin/*` endpoints). ~600 lines, single import.
2. **Extract the public HTTP routes** (`/twilio/*`, `/telegram/webhook`, `/dynopay/*`, `/honeypot/*`) to `js/routes/public.js`.
3. **Extract the `/start` handler + main-menu rendering** to `js/handlers/start.js`. Self-contained.
4. **Extract each `if (action === '...')` block** (VPS, Custom Leads, Domain, Phone) into its own `js/handlers/<feature>.js` module. The dispatcher in `_index.js` becomes a `Map<action, handler>`.
5. **Extract schedulers** (the 65 `setInterval`s) into `js/schedulers/index.js` with a single `startAll()` / `stopAll()` lifecycle.
6. **Extract the translation dictionaries** to `js/i18n/<locale>.json` files; replace inline dicts with `t('key.path')`.

After phase 1–2 alone (1-2 days), the file should drop to ~35 k lines. Long term target: < 5 k lines for `_index.js` (just wiring).

---

## 2. 🔴 Hardcoded SIP password (security)

**Location:** `js/telnyx-service.js` line 179:
```js
async function createSIPConnection(name, webhookUrl) {
  const body = {
    active: true,
    connection_name: name,
    user_name: 'nomadlySipMain01',
    password: 'NomadlySIP2026Secure',    // ← hardcoded, low-entropy
    webhook_event_url: webhookUrl,
```

This is the password assigned to **every new Telnyx SIP connection** the bot creates. Anyone with knowledge of the convention can register a softphone to your Telnyx number.

**Fix** (5 minutes):
```js
const body = {
  active: true,
  connection_name: name,
  user_name: process.env.TELNYX_SIP_USERNAME || 'nomadlySipMain01',
  password: process.env.TELNYX_SIP_PASSWORD,   // mandatory from env
  ...
}
```
Add `TELNYX_SIP_PASSWORD=<long-random>` to Railway env vars. **Existing connections need their password rotated in Telnyx console.**

---

## 3. 🔴 Silent error swallowing — 284 of 522 catches

In `_index.js`, **54% of `try/catch` blocks have empty or comment-only catch bodies** (e.g. `catch { /* ignore */ }`, `catch (_) {}`).

These swallow:
- Telegram API errors (user-blocked, message-not-modified — these are real signals)
- MongoDB write failures
- Cron-scheduled background job exceptions
- Race conditions and transient timeouts

**Impact:** Many of the "phantom" bugs users report are likely happening inside these silent catches and we never know.

**Recommended pattern** (don't fix all 284, but at least make them observable):
```js
// Replace silent catches with a one-line log helper:
function silentCatch(label) {
  return (err) => { log(`[SilentCatch] ${label}:`, err?.message || err) }
}

// then:
try { await bot.sendMessage(chatId, msg) }
catch (err) { silentCatch('sendMessage main-menu')(err) }
```

Pair with Sentry / Bugsnag (one-line install) for production observability. Even free tier captures rate-of-errors which is the most useful signal.

---

## 4-7. 🟠 Repo hygiene

| Problem | Where | Fix |
|---|---|---|
| 76 `.md` files at root (one-off reports like `JOHNGAMBINO_BILLING_AUDIT_2026_05_05.md`) | `/app/*.md` | Move to `/app/docs/archive/`; keep only `README.md`, `PRD.md`, current-RCA docs at root |
| 44 `*_test.js` files at root (`ad_command_test.js`, `backend_test.js`, `comprehensive_sip_test.js`…) | `/app/*.js` | Move all to `/app/tests/legacy/`; add `*_test.js` to `.gitignore` if they were never meant to be source |
| `_index.js.backup` (1.4 MB) | `/app/js/` | `git rm`; add `*.backup` to `.gitignore` (Emergent already saves checkpoint history) |
| `nomadly-sms.apk.bak`, `nomadly-sms-v2.1.5.bak` (3.8 MB each) | `/app/static/`, `/app/backend/static/` | `git rm`; these belong in releases / GitHub Releases, not source |
| 15 stray `.csv` / `.txt` dumps in `/app/scripts/` (`ATT_619_*.txt`) | `/app/scripts/` | Move to `/app/scripts/data/` and gitignore that dir |
| Repeated `logs_prod/` re-commits triggering GH secret-scanner | (already fixed via `.gitignore` yesterday) | ✅ Done |

These cleanups alone would shave **~15 MB** from the repo and dramatically reduce the noise in `git log` and search results.

---

## 8. 🟠 Untracked background timers (65 in `_index.js`)

```bash
$ grep -cE "setInterval\(|setTimeout\(" js/_index.js
65
```

These run forever. None are tracked in a registry; none are cleared on shutdown; some may overlap if a slow callback is still running when the next interval fires.

**Common bug pattern**:
```js
setInterval(async () => {
  await db.collection('x').updateMany(...)   // takes 30s when DB is slow
}, 10_000)                                    // fires every 10s → reentrant
```

**Recommended pattern**:
```js
// js/schedulers/index.js
const scheduled = new Set()
export function every(label, ms, fn) {
  let running = false
  const tick = async () => {
    if (running) { log(`[Scheduler] ${label} still running, skipping`); return }
    running = true
    try { await fn() } catch (err) { log(`[Scheduler] ${label} error:`, err.message) }
    finally { running = false }
  }
  const id = setInterval(tick, ms)
  scheduled.add(id)
  return id
}
export function stopAll() { for (const id of scheduled) clearInterval(id); scheduled.clear() }
```

Then `process.on('SIGTERM', stopAll)` makes graceful shutdown work — currently Railway restarts may interrupt an in-flight scheduler write.

---

## 9. 🟠 56 `.find({})` full-table scans

Each one scans the entire collection. At current data scale (~1.5 MB `leadjobs_investigation.json`, presumably similar collection sizes in MongoDB) this is fine. As the bot scales, each scan becomes O(n) on every call.

Top offenders (line numbers in `_index.js`):
```
1580: notifyGroupsCol.find({})
2508: phoneNumbersOf.find({})       ← every periodic phone check?
2589: phoneNumbersOf.find({})       ← scanned again for next loop
3218: chatIdOfPayment.find({})
3763: planEndingTime.find({})       ← every minute, growing each day
3833: planEndingTime.find({})       ← scanned twice in this section
6248: leadRequests.find({})
6392, 6481, 6581: nameOf.find({}) × 3   ← three full scans of the username table
```

**Pattern fix**: replace each `find({})` with an indexed query (`.find({lastChecked: {$lt: ...}})`) or a projection (`.find({}, {_id:1, status:1})`) so we move less data.

The `nameOf` triple-scan in particular is a low-hanging optimisation — cache it once per request.

---

## 10. 🟠 No automated test runner

```json
"scripts": {
  "test": "echo \"Error: no test specified\" && exit 1"
}
```

You have 44 one-off `*_test.js` scripts at root and 9 `backend/tests/*.py` files, but **no test runner orchestrates them**. So nothing breaks the build when something regresses.

Minimal-effort fix (afternoon's work):
1. Add `jest` to devDependencies: `yarn add -D jest`
2. `"test": "jest --testPathPattern='tests/'"` in `package.json`.
3. Move maybe 5 of the most-useful existing test scripts into `tests/` with a tiny jest wrapper. Even 5 tests run in CI > 0 tests run by anyone.
4. Add a `.github/workflows/test.yml` that runs `yarn test` on every PR.

This wouldn't have caught the Fincra outage (it's a credential rotation), but **it would catch the kind of bug that came from yesterday's _index.js edits before they hit production**.

---

## 11. 🟡 Synchronous filesystem calls in request paths

```
/app/js/_index.js:91:   fs.mkdirSync(dir, { recursive: true })
/app/js/_index.js:92:   fs.writeFileSync(localPath, Buffer.from(...))
/app/js/_index.js:17260: fs.writeFileSync(filename, response)
/app/js/_index.js:17263: fs.unlinkSync(filename)
/app/js/_index.js:29913: fs.writeFileSync('backup.json', ...)    ← backup endpoint
/app/js/_index.js:29921: fs.writeFileSync('payments.csv', ...)   ← CSV export
/app/js/_index.js:30168: fs.readFileSync('.env')                  ← admin endpoint
/app/js/_index.js:32464: fs.writeFileSync(fileName, analyticsText)
/app/js/_index.js:34955: fs.writeFileSync(filepath, allNumbers.join('\n'))
/app/js/_index.js:34970: fs.unlinkSync(filepath)
```

Each of these blocks the Node event loop — meaning your bot stops responding to other users while one user is exporting a CSV. The fix is trivial: replace with `fs.promises.writeFile(...)` / `await fsp.unlink(...)`.

The most impactful ones are the **admin export endpoints** (`backup.json`, `payments.csv`) — these write potentially large files synchronously.

---

## 12. 🟡 Inline translation dicts (122 in `_index.js`)

Pattern repeated 122×:
```js
const greeting = { en: 'Hi!', fr: 'Salut!', zh: '嗨!', hi: 'नमस्ते!' }[lang]
```

Problems:
- Hard to audit which strings are translated (no central list)
- Yesterday's UX work softened the EN copy but the FR/ZH/HI versions still have the pushy emoji — **inconsistent UX by language**
- Translators can't work on a flat file

**Recommended**: extract to `js/i18n/<locale>.json`:
```
i18n/en.json   { "greeting": "Hi!" }
i18n/fr.json   { "greeting": "Salut!" }
…
```
Replace each inline dict with `t('greeting')`. Single dependency: `i18next` (or a 20-line custom).

---

## 13. 🟡 Other oversized JS files

| File | Lines | Suggested split |
|---|---:|---|
| `voice-service.js` | 4,943 | Split TTS, STT, IVR-call-control into separate modules |
| `auto-promo.js` | 4,700 | Already domain-cohesive; split by campaign type |
| `phone-config.js` | 3,347 | Probably mostly static data — move to JSON files |
| `cpanel-routes.js` | 2,652 | Acceptable, but tightening would help |
| `anti-red-service.js` | 2,515 | Split the Cloudflare logic from the URL-classifier |

---

## 14. 🟡 Repeated push-protection blocks

In this session alone we got blocked **3 times** by GitHub's secret scanner — twice for log dumps in `logs_prod/`, once for hard-coded SIDs in `scripts/audit_broken_twilio_subs.js`.

**Permanent fix**: add a pre-commit hook (`.husky/pre-commit`) that runs:
```bash
git diff --cached --name-only | xargs -I{} grep -nE "AC[a-f0-9]{32}|SK[a-f0-9]{32}" {} && {
  echo "Twilio SID detected in staged file — aborting commit"
  exit 1
}
```
Plus expand `.gitignore`:
```
*.backup
*.bak
logs_prod/
railway_logs_*.json
scripts/data/
scripts/ATT_*
*_test_output.txt
```

---

## 15. 🟢 Inconsistent log prefix conventions

The top 15 prefixes in `_index.js` show a healthy convention (`[CloudPhone]`, `[Twilio]`, etc.) but it's not enforced. If we standardise on a wrapper:
```js
const log = require('./logger').for('Wallet')
log.info('credited', { chatId, amount })
log.error('credit failed', { err })
```
You get structured JSON logs that Railway / Datadog can index. Currently the logs are all free-text strings, making the 6-day RCAs we've been doing harder than they need to be.

---

## ✅ What's already good

- **No `eval()` / `new Function()`** — no obvious RCE surface in the JS.
- **`npm audit` reports zero high/critical vulnerabilities** — dependency hygiene is OK.
- **All 11 `/admin/*` endpoints have an auth check** (uniform `SESSION_SECRET.slice(0,16)` pattern). Consistent.
- **No multi-`dotenv` race conditions** — `.env` is loaded once in entry files.
- **71 `createIndex` calls** across modules — index discipline exists, just not comprehensive (see issue #9).
- **MongoDB schema is consistent** — `{_id: chatId, val: {...}}` pattern repeated across collections.
- **The frontend is small** (3,832 lines) — easy to keep clean as the bot is the centre of gravity.
- **Admin endpoints are paying off** — `/admin/scanner-block-stats` and `/admin/funnel-stats` we built this week are good observability primitives.

---

## 🎯 Recommended quick-wins (under 1 hour each)

I can execute these in code if you say "yes do it":

| # | What | Risk | Touches |
|---|------|------|---------|
| A | Rotate Telnyx SIP password to an env var; require it at startup | Low | 1 file |
| B | `.gitignore` for `*.backup`, `*.bak`, `logs_prod/`, `railway_logs_*.json`, root dumps | None | 1 file |
| C | `git rm` `_index.js.backup` + the two `.apk.bak` files | None | 3 files |
| D | Add `.husky/pre-commit` Twilio-SID guard so push-protection stops biting us | Low | new file |
| E | Move 76 root `.md` files into `/app/docs/` (one-shot mv); update PRD/README path refs | Low | 76 mvs + 1-2 link edits |
| F | Move 44 root `*_test.js` files into `/app/tests/legacy/` | Low | 44 mvs |
| G | Replace 9 `fs.writeFileSync`/`readFileSync` calls in `_index.js` with `fs.promises` equivalents | Low | 1 file |
| H | Add an in-memory scheduler registry + `SIGTERM` clean shutdown | Medium | new file + small _index.js edit |
| I | Set up `jest` and convert 5 best test scripts into `tests/` | Medium | new files + package.json |
| J | Convert top-10 highest-traffic silent catches to `silentCatch('label')` logging | Medium | _index.js |

## 🗓 Bigger projects (multi-day)

| # | What | Time |
|---|------|------|
| K | Phased split of `_index.js`: admin routes → public routes → /start handler → action handlers | 1-2 weeks |
| L | Extract `js/i18n/<locale>.json` files; replace 122 inline dicts with `t()` calls | 2-3 days |
| M | Add Sentry / Bugsnag for unhandled errors | 2 hours setup, ongoing value |
| N | Replace 56 `.find({})` calls with indexed queries; add the right Mongo indexes | 1-2 days |

---

## How to use this report

1. Pick one row from **Quick-wins (A-J)** you want me to ship today.
2. We measure: re-run `wc -l`, `npm audit`, `grep -c "find({})"` etc. before/after.
3. After 3-4 quick wins land, decide whether to tackle the big monolith split (K) as a multi-session project.

The single most-impactful change available right now is **A (rotate SIP password)** — that closes a real security hole. The single most-rewarding sustained project is **K (split `_index.js`)** because every future change becomes safer.
