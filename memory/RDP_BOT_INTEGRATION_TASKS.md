# DO Windows RDP → Telegram bot + Reseller API full lifecycle (2026-09-23)

Goal: sell and manage DigitalOcean golden-image Windows RDPs natively in the Telegram bot (same
provider abstraction as Contabo/Vultr/Azure) and expose the same management on the Reseller API.
Approved by owner 2026-09-23 00:45 UTC (all items + 1/2/3-month plans in bot AND API + live E2E + rebuild all 3 images in parallel).

## Respond in ENGLISH only.

## Design decisions
- Bot-facing instance ids are `rdp-<uuid>` (`extId` / `normId` in digitalocean-rdp-service.js); `doRdpServers.server_id` stays the bare UUID.
  vps-provider.js routes `rdp-*` and `provider: 'digitalocean-rdp'` to the DO-RDP service. Existing reseller records with bare UUIDs keep working (`normId`).
- Password reset is IN PLACE via the in-guest agent (`apply.ps1 -Agent`, scheduled every minute, polls `GET /provision/commands`, posts `POST /provision/commands/result`).
  Existing golden images pick the agent up automatically: apply.ps1 self-refreshes from `/provision/bootscript` at every boot.
- Reinstall = DO `rebuild` of the SAME droplet from the chosen golden image (IP kept, disk wiped, ~3 min). The new password is queued as an agent command so it lands right after first boot (user-data is immutable on DO and still carries the original password).
- Durations 1/2/3 months: productId `<tier>-<N>m`, price = monthly × N × 2 (linear). Bot gets a duration step; `vpsPlansOf.durationMonths` drives expiry + renewal length; `renewInstance()` pushes `doRdpServers.expires_at` so the DO sweep never powers off a renewed server.

## Tasks (status verified 2026-06 at handoff — see "Verified current state" below)
### A. Provider wiring (js/vps-provider.js, js/vm-instance-setup.js, js/digitalocean-rdp-service.js)
- [x] A1 `_loadProvider('digitalocean-rdp')`, `detectProviderByInstanceId` (`rdp-`), `providerNameForRecord`, `dispatchByInstanceId`, `passwordResetImpact` (in-place)
- [x] A2 vm-instance-setup: bot status = `live.botStatus || live.status`; destructive-cancel guards include `digitalocean-rdp`; RDP regions; NVMe-only disk step; `listProducts(..., {monthlyOnly:false})` + duration-aware expiry/`durationMonths`/`plan`
- [x] A3 DO-RDP: `applyActivation` keeps `expires_at`/`activated_at` on reinstall; `/callback rdp_ready` pending-password rule; `renewInstance(id, months)`; `getInstance` exposes `durationMonths`, `agentOnline`
  (A = +304 lines in digitalocean-rdp-service.js, +57 in vm-instance-setup.js, +15 in vps-provider.js — NOT yet live-verified)
### B. Bot purchase flow (js/_index.js + lang/{en,fr,zh,hi}.js)
- [x] B1 RDP: region → tier → **duration** (`askRdpDuration`, `rdpDurationBtn`, line ~12077) → coupon → Windows edition → summary → pay
- [x] B2 Order summary shows edition + duration
- [x] B3 Post-payment "RDP ready" gated on DO-RDP `active`
- [~] B4 Renewal scheduler extends by `durationMonths` / `provider.renewInstance` — VERIFY wiring in the renewal cron
### C. Bot management (js/_index.js)
- [x] C1 Start/Stop/Restart/Show password via smart proxy for `rdp-*` ids
- [x] C2 Reset Password → `provider.resetPassword` (line ~20496; agent-confirmed, `dataPreserved`) + offline error copy
- [x] C3 Reinstall Windows → `confirmReinstallWindows`/`askReinstallEdition` (line ~9375, ~12302, ~20570) → `provider.reinstallInstance`; IP-kept + ~3 min copy
### D. Reseller API + docs (js/reseller-api.js, js/apidoc-page.js)  ← ★ MAIN REMAINING GAP ★
- [ ] D1 `POST /rdp/:id/password-reset` → `{ password, username, method:'agent' }`  **MISSING**
- [ ] D2 `POST /rdp/:id/reinstall {os}` → `{ os, ip, eta_minutes, password }`, updates `vpsPlansOf.osId/rootPasswordSecretId/status`  **MISSING**
- [ ] D3 `GET /rdp/:id` includes `agent_online`; docs for both new endpoints + agent note  **NOT DONE**
  NOTE: `vpsActionHandler` (reseller-api.js:495-507) only maps start/stop/reboot/restart/shutdown; it returns 400 `invalid_action` for reset_password/reinstall and has NO osId/edition handling. Add dedicated routes (do NOT overload /action) next to lines 543-546.
### E. Tests
- [x] E1 Unit suite `js/tests/test_do_rdp_golden_2026-06.js` — **84 passed, 0 failed** (re-run confirmed at handoff)
- [ ] E2 testing_agent: reseller RDP API (new endpoints) + bot handler smoke — NOT DONE (user asked to end session without agent testing)
- [ ] E3 Live E2E on one real droplet (`js/ops/rdp_lifecycle_e2e.js`): buy → active → reset password → NLA login → reinstall (other edition) → login → delete — NOT DONE
### F. Golden images
- [ ] F1 Start builds for ws2019 + ws2022 + ws2025 in parallel — **NOT triggered this session; VERIFY current image state first via goldenStatus/syncGoldenFromDO before rebuilding** (owner approved parallel rebuild)
- [ ] F2 Verify images `available` + transferred to all 9 regions; update PRD/CHANGELOG

## Verified current state (2026-06 handoff — read this first)
- All key files pass `node -c` syntax check (js/_index.js, js/vps-provider.js, js/digitalocean-rdp-service.js, js/reseller-api.js). App is NOT broken. `nodejs` supervisor process is RUNNING.
- Unit tests: `node js/tests/test_do_rdp_golden_2026-06.js` → 84 passed, 0 failed.
- Bot integration (A/B/C) is substantially implemented in js/_index.js (+32 lines) and the DO-RDP service (+304). Handlers present: `askRdpDuration`, `rdpDurationBtn`, `confirmReinstallWindows`, `askReinstallEdition`, `resetPasswordBtn`→`confirmResetPassword`, `reinstallWindowsBtn`→`confirmReinstallWindows`, `provider.resetPassword`, `provider.reinstallInstance`. Not yet live-verified.
- Reseller API (D) is the biggest gap — password-reset and reinstall endpoints DO NOT EXIST yet. This is the highest-value remaining code task.
- All 4 lang files (en/fr/hi/zh) already carry the new RDP/reinstall/reset keys (+48 lines each).

## Recommended next-agent order
1. D1/D2/D3 — add reseller `POST /rdp/:id/password-reset` and `POST /rdp/:id/reinstall`, add `agent_online` to `GET /rdp/:id`, document both in apidoc-page.js.
2. Verify B4 renewal wiring calls `provider.renewInstance`.
3. F1 — check golden image state (`goldenStatus`), then start the 3 parallel rebuilds the owner approved.
4. E2 (testing_agent on reseller RDP API + bot smoke), then E3 live E2E on one real droplet, then delete it.

## Uncommitted files on disk at handoff
- Modified: js/_index.js, js/digitalocean-rdp-service.js, js/vm-instance-setup.js, js/vps-provider.js, js/reseller-api.js(unchanged for D), js/lang/{en,fr,hi,zh}.js, js/rdp-scripts/apply.ps1, js/tests/test_do_rdp_golden_2026-06.js
- New logs: memory/rdp_apply_log_ws2019_bug_repro.log, memory/rdp_golden_e2e_ws2019.log, memory/rdp_golden_e2e_ws2022.log, memory/rdp_status_api_e2e_ws2019.log

## Credentials
- Vault passphrase: `Katiekendra123@`
- DigitalOcean API key + Telegram Bot API key are in `.env`.

## Status log
- 2026-09-23 00:50 UTC — doc created, implementation starting (A → B → C → D → E → F)
- 2026-06 (fork handoff) — verified state: A/B/C substantially done in code (not live-verified); E1 84/84 passing; app healthy. Reseller API D endpoints still MISSING. Golden rebuilds (F1) not triggered. E2/E3 not done. Session ended per owner request WITHOUT agent testing.
