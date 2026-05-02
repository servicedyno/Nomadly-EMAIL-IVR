# @ciroovblzz Production Bug Investigation Report

**Date:** 2026-05-02
**User:** @ciroovblzz (cPanel acct: tdsee735)
**Surface:** Telegram Mini-App Hosting Panel
**Status:** ✅ FIXED (local commit, ready to deploy)

---

## Symptoms Reported

1. **"Error screen after login"** — user lands on file manager, sees a scary banner with text like `timeout of 30000ms exceeded`.
2. **"Upload continues forever"** — user drops `netflix - @ciroovblzz.rar` (4.1 MB), spinner hangs up to 2 minutes, then sometimes shows success when the file never reached cPanel.

---

## Railway Log Evidence (deployment `7be32cd6`, 2026-05-02)

Transient upstream timeouts (cPanel control plane):

```
14:45:18  Fileman::list_files     timeout of 30000ms exceeded
14:45:37  DomainInfo::list_domains timeout of 30000ms exceeded  (×3)
14:48:42  Fileman::list_files     timeout of 30000ms exceeded
14:52:29  Fileman::list_files     timeout of 30000ms exceeded
14:56:39  Upload: netflix - @ciroovblzz.rar (4125.2 KB) → /home/tdsee735/public_html
14:58:22  Upload: netflix - @ciroovblzz.rar (4125.2 KB) → /home/tdsee735/public_html (retry)
14:58:42  Fileman::upload_files   timeout of 120000ms exceeded   ← first attempt
15:00:22  Fileman::upload_files   timeout of 120000ms exceeded   ← second attempt
15:00:54  Fileman::list_files     timeout of 30000ms exceeded
```

Pattern: the WHM/cPanel control plane has intermittent slowness (not a sustained outage). Adjacent calls succeed within seconds of a timeout — so a single automatic retry recovers transparently. The panel was surfacing the raw axios timeout string without any retry or softening.

---

## Root-Cause Chain

| # | Layer | Issue |
|---|-------|-------|
| 1 | Node proxy (`js/cpanel-proxy.js`) | No retry for idempotent reads. A single WHM blip surfaced a scary error to the user. |
| 2 | Frontend (`FileManager.js`) | `fetchFiles` caught the axios error string verbatim and put it in the error banner as `timeout of 30000ms exceeded`. |
| 3 | Frontend (`FileManager.js`) | Non-chunked upload path (≤ 8 MB) never inspected the response body. When cPanel returned `{status: 0, errors: ['timeout…'], data: null}` with HTTP 200, the loop counted the file as successfully uploaded and showed a fake success toast. |
| 4 | Frontend (`FileManager.js`) | `uploadProgress` was a static string — user had no feedback whether the request was alive or stuck, especially painful over the 120s cPanel upload timeout. |

---

## Fixes Shipped

### 1. `js/cpanel-proxy.js` — single retry on transient timeouts for idempotent UAPI reads
Added a `RETRY_SAFE_UAPI` allowlist covering `Fileman::list_files`, `DomainInfo::list_domains`, `DomainInfo::domains_data`, `SSL::installed_hosts`, `StatsBar::get_stats`, `Quota::get_quota_info`, `Fileman::get_file_content`, `DomainInfo::single_domain_data`. On `ECONNABORTED` / `ETIMEDOUT` / `timeout of Nms exceeded`, the proxy waits 500 ms and retries once. Non-idempotent mutations (upload, delete, mkdir, email create, etc.) are NEVER retried.

### 2. `frontend/src/components/panel/shared/cpanelErrors.js` — new shared helper
Centralizes `pickErrorMessage()`, `friendlyMessage()`, `isTransientError()`. Maps raw axios strings (`timeout of Nms exceeded`, `ECONNREFUSED`, `ENOTFOUND`, `socket hang up`…) to localized `errors.cpanelSlow` / `errors.cpanelUnreachable` i18n keys.

### 3. `frontend/src/components/panel/FileManager.js`
- Uses the shared helper for file-list error mapping + upload error mapping.
- Upload loop now inspects `res.errors?.length || res.code === 'CPANEL_DOWN'` in the small-file path (previously only the chunked path did this).
- New `uploadElapsed` state + `setInterval` → progress shows `Uploading foo.rar · 0:23`.
- After 30 seconds of upload, a new `fm-upload-slow` banner surfaces localized "still working" copy.
- Error banner now renders a `Try Again` button (`fm-error-retry`) when the underlying error is transient AND the file list is empty.

### 4. `frontend/src/components/panel/DomainList.js`
- Same friendly-error mapping for `/domains` GET.
- Same `Try Again` button (`dl-error-retry`) on transient failures.

### 5. i18n — 4 locales (en, fr, hi, zh)
Added `errors.cpanelSlow`, `errors.cpanelUnreachable`, `errors.retry`, `errors.uploadSlow`.

---

## Tests

### Backend
`node /app/js/tests/test_cpanel_proxy_retry.js` — **4/4 ✅**
- `list_files` retries once on transient timeout
- `Email::add_pop` (mutation) does NOT retry
- `DomainInfo::list_domains` retries once
- Persistent timeout returns `errors[]` after exactly 2 attempts (no infinite loop)

### Frontend helper
`node /app/frontend/tests/test_cpanel_errors_helper.js` — **10/10 ✅**
- Axios timeouts → `errors.cpanelSlow`
- Connection errors → `errors.cpanelUnreachable`
- Unknown messages pass through untouched
- `CPANEL_DOWN` → localized or generic
- Permanent cPanel errors are not offered for retry
- Edge cases (null, empty) handled

### UI smoke
Preview panel screenshot confirms the login page still renders cleanly. No JS errors in console.

---

## User-Facing Behaviour Changes

| Scenario | Before | After |
|----------|--------|-------|
| WHM blips once on login | Banner: `timeout of 30000ms exceeded` → user abandons | Silent retry succeeds → user sees file list |
| WHM stays slow on login | Banner: `timeout of 30000ms exceeded` | Banner: "Your hosting server is responding slowly right now. Please try again in a moment." + **Try Again** button |
| Upload 4 MB, cPanel times out | Spinner 2 min → fake success toast | Spinner 2 min with elapsed timer `· 1:23`, after 30s a calm "Still working…" banner, on final error: real error + Retry |
| Upload 4 MB, cPanel returns `errors[]` | Silent success (file didn't reach server) | Proper error shown |

---

## Deployment Notes

- Branch / commit: local only (per user request).
- Railway env vars: **no changes required**.
- Rollback: revert the commits that touch `cpanel-proxy.js`, `FileManager.js`, `DomainList.js`, `shared/cpanelErrors.js`, and the 4 `locales/*.json` files.
- Risk: very low — retry is bounded (single retry, idempotent allowlist only), i18n keys are additive, upload error check is strictly additive (previous silent-success was a bug).
