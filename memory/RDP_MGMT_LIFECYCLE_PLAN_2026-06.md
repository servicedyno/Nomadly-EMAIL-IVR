# RDP Management Lifecycle — Test + 3-Day Grace Auto-Destroy (PLAN for next agent)

_Investigation done 2026-06 (this fork). User PAUSED before implementation and asked to document the plan._
_Respond to the user in ENGLISH only._

## What the user asked (verbatim intent)
1. **"can we test all RDP management like re-install, off, on, restart, renew, etc"** — user chose **option (a): a full LIVE end-to-end test on ONE real DigitalOcean droplet** (real billing, auto-destroy at end).
2. **"ensure droplet destroys if not renewed after 3 days grace period (droplets from DigitalOcean should behave this way because they charge us per hour/min)"** — i.e. an unrenewed/expired RDP droplet must be **DESTROYED (not just powered off)** after a **3-day grace period**, because DO bills powered-off droplets too.

⚠️ **STILL UNANSWERED BY USER:** which **OS** (ws2019/ws2022/ws2025) and **region** (US default / EU) for the live test box. Default to **ws2022 / US** unless the user says otherwise, or ask once with `ask_human`.

---

## PART 1 — RDP management surface (ALL already implemented; verified in code)

### Service methods — `js/digitalocean-rdp-service.js`
| Op | Function | Line | Behaviour |
|----|----------|------|-----------|
| provision | `createInstance` | 1074 | golden fast path |
| status | `getInstance` | 1174 | live DO + agent state |
| **on** | `startInstance` | 1302 | `power_on` → status `active` |
| **off** | `stopInstance` | 1303 | `power_off` → status `suspended` |
| shutdown | `shutdownInstance` | 1304 | graceful `shutdown` → `suspended` |
| **restart** | `restartInstance` | 1305 | `reboot` |
| **reinstall** | `reinstallInstance` | 1243 | DO **rebuild** from golden image, **keeps IP**, can switch edition |
| password reset | `resetPassword` | 1222 | in-place via agent (needs `agent_online`) |
| **renew** | `renewInstance` | 579 | extends `expires_at` by 30×months; powers ON if expired/suspended |
| destroy | `cancelInstance` | 1307 | deletes droplet + volume + secret; sets `doRdpServers.status='destroyed'` |
| expiry sweep | `processExpiries` | 1321 | **hourly** (`setInterval` L378). Today only **powers off** expired → `status='expired'`. **NEVER destroys** ← the billing leak to fix |
- Power helper: `_dropletActionByServer` (L1293). Exports at L1419.

### Reseller API — `js/reseller-api.js`
- `POST /rdp/:id/action` `{action: start|stop|reboot|restart|shutdown}` → `vpsActionHandler` (L514; map L518).
- `POST /rdp/:id/password-reset` (L~560) → `resetPassword`.
- `POST /rdp/:id/reinstall` `{os}` (L580) → `reinstallInstance`.
- `GET /renewals` (L879) lists rdp/vps/domain/hosting; RDP rows read from `vpsPlansOf`.
- **No `POST /rdp/:id/renew` endpoint exists.** RDP renew is only the service method, wired into the bot VPS scheduler (see below). If the user wants API-driven renew, add `POST /rdp/:id/renew {months}` → `prov.renewInstance` (mirror the reinstall handler).

---

## PART 2 — THE 3-DAY GRACE DESTROY (core of the user request)

### CRITICAL: there are TWO expiry engines — reconcile them, do not create a double-destroy
1. **RDP service `processExpiries()`** — `digitalocean-rdp-service.js` L1321-1333. Sweeps `doRdpServers` where `status='active' && expires_at<=now` → `power_off` + `status='expired'`. Runs hourly (L378) **only when `SKIP_WEBHOOK_SYNC!=='true'`** (⇒ **DISABLED on this sandbox**). `expires_at` is set at activation = `activated + 30×duration_months days` (`applyActivation`, L566-571).
2. **Bot VPS scheduler** — `js/_index.js` from **L36640**, operates on `vpsPlansOf` (the customer-facing catalog). This is the authoritative renew/cancel engine:
   - `_isPAYGProvider()` (L36654) → **true for `digitalocean-rdp`**, vultr, azure.
   - Phase 1 (T-24h, L36680): auto-renew if `autoRenewable`; else `PENDING_CANCELLATION`. PAYG NOT early-cancelled.
   - Phase 1.5 (T-5h, L36784): pre-emptive Contabo cancel; **PAYG skipped**.
   - **Phase 2 (end_time<=now && PENDING_CANCELLATION, L36873): `deleteVPSinstance` → DESTROY. For PAYG incl. DO-RDP this destroys AT end_time with ZERO grace.** ← conflicts with the user's 3-day-grace ask.
   - Phase 3 (L36936): stale RUNNING past expiry → PENDING_CANCELLATION.
   - Phase 4 (L36977): T-3d..T-1d reminders.
   - `vpsPlansOf.autoRenewable` **defaults to `false`** (`vm-instance-setup.js` L932). `deleteVPSinstance`→ per-record dispatch → for DO-RDP calls `svc.cancelInstance`.

**Net today:** an unrenewed DO-RDP box is destroyed by the bot scheduler at end_time (0 grace), while the RDP-service sweep would only power it off. To honour the user's **3-day grace** we must pick ONE owner and stop the other from destroying early.

### RECOMMENDED implementation (single owner = RDP-service sweep; lowest risk)
Put the grace logic in **`processExpiries()`** (self-contained, owns `doRdpServers`), and make the bot scheduler DEFER DO-RDP destroy to it.

**A. `js/digitalocean-rdp-service.js`**
1. Add to `T` (L133): `graceDays: 3`.
2. In `init` (L357): store `_db = db` so the sweep can mirror `vpsPlansOf`.
3. Rewrite `processExpiries()`:
   - **Sweep 1** (active past expiry): `power_off` + `{status:'expired', expired_at:new Date()}` + admin alert "expired, will be destroyed in 3 days".
   - **Sweep 2** (grace destroy): find `{status:'expired', do_droplet_id:{$ne:null}, expired_at:{$lte: now - graceDays*86400000}}` → `await cancelInstance(server_id)` + `{destroy_reason:'expired_grace', destroyed_at:new Date()}`; mirror `_db.collection('vpsPlansOf').updateOne({$or:[{contaboInstanceId: extId(id)},{vpsId: extId(id)}]}, {$set:{status:'CANCELLED', cancelledAt:new Date(), cancelReason:'expired_grace'}})`; admin alert.
   - Keep it defensive (try/catch per row, don't throw out of the loop).
4. In `renewInstance` (L579): on reactivation also clear the grace clock → add `expired_at: null` to the `set` object (so renew within grace resets the timer).
   - `vpsPlansOf` linkage for mirroring: RDP records use `contaboInstanceId = vpsId = String(instanceId) = extId(server_id)` (see `vm-instance-setup.js` L910-940). Verify `extId()` returns the `rdp-<uuid>` form that matches those fields.

**B. `js/_index.js` VPS scheduler — stop DO-RDP double-destroy**
- In **Phase 2** (L36873 loop) and Phase 1/1.5 where PAYG is handled: for records where the provider is **`digitalocean-rdp`**, do **NOT** call `deleteVPSinstance` at end_time. Instead power the box off (`provider.stopInstance`) and let the RDP-service grace sweep destroy it after 3 days. Simplest safe change: add a guard `if (providerName === 'digitalocean-rdp') { /* power off + skip destroy; RDP grace sweep owns teardown */ continue }`. Confirm the exact provider-name source (`_detectByPrefix(contaboInstanceId)` or `vpsPlan.provider`).
- Alternative (if the user prefers the bot scheduler to own it): add a `_graceUntil = end_time + 3d` on the DO-RDP record and only destroy when `now >= _graceUntil`. Pick ONE; don't do both.

**DECISION TO CONFIRM WITH USER before coding B:** should the 3-day grace clock start at **subscription end (`expires_at`/`end_time`)** or at the **moment we power it off**? Plan above starts it at expiry (Sweep-1 sets `expired_at`). This is the natural reading of "destroy if not renewed after 3 days".

### Sandbox testing note
`SKIP_WEBHOOK_SYNC='true'` on this pod ⇒ `processExpiries` interval is OFF and the bot scheduler may be gated too. To test the grace path, **call `processExpiries()` manually** (or seed `expired_at` 4 days in the past) rather than waiting on the interval.

---

## PART 3 — LIVE E2E TEST PLAN (user picked option a)

### Existing coverage
`js/ops/rdp_lifecycle_e2e.js` already does: create (golden fast) → NLA login → wait agent → resetPassword → NLA login → reinstall (other edition) → NLA login → destroy. It does **NOT** cover off/on/restart/renew/grace.

### Build `js/ops/rdp_full_mgmt_e2e.js` (extend the existing one)
Provision ONE real droplet, then run in order and assert each:
1. create → active + fast_deploy + NLA login (default pw)
2. wait `agent_online`
3. **stopInstance (off)** → DO droplet `status=off`, `doRdpServers.status='suspended'`
4. **startInstance (on)** → DO `status=active`, `doRdpServers.status='active'`, port 3389 back, NLA login
5. **restartInstance (reboot)** → reboot action completes, 3389 recovers
6. **resetPassword** → new pw, NLA login with new pw
7. **reinstallInstance (other edition)** → active + IP kept + os switched + NLA login (reinstall boots the **user-data** pw; see `rdp_reinstall_check.js`)
8. **renewInstance(1)** → `expires_at` extended ~30 days; `expired_at` cleared
9. **grace-destroy** → set `{status:'expired', expired_at: now-4d}` on the doc, `await svc.processExpiries()`, assert droplet destroyed at DO (404) + `doRdpServers.status='destroyed'`, `destroy_reason='expired_grace'`
10. finally `cancelInstance` (idempotent) — always on SIGINT/TERM/HUP + normal exit (existing scripts already do this)

Run: `node js/ops/rdp_full_mgmt_e2e.js --os ws2022 --region US` (needs nodejs supervisor up — serves `/provision` + agent commands). Set `DO_RDP_GOLDEN_AUTOSYNC=false` in the script (like the others) so it never resumes golden builds.

### Expectations / gotchas
- **Cost:** ~$0.05-0.10, one droplet ~25-30 min. Always destroyed on exit.
- **NLA login checks are INFORMATIONAL** — pod egress to :3389 may be blocked, and the golden-image callback to the sandbox preview host does not resolve (known artifact; backend still declares active ~90s after 3389 opens). Judge PASS on DO/Mongo state, not on NLA.
- Golden images ws2019/ws2022/ws2025 are all `available` → fast path works right now.

### Also add a unit test (no droplet): `js/tests/test_rdp_grace_destroy_2026-06.js`
Mock the DO client + local mongo; assert: expiry → power_off + expired_at set; expired for >3d → cancelInstance called + status destroyed + vpsPlansOf mirrored; renew clears expired_at; expired for <3d → NOT destroyed. Fold into the golden suite pattern.

---

## PART 4 — Regression + verification after coding
- `node js/tests/test_do_rdp_golden_2026-06.js` (currently **91/91** — keep green).
- `node js/tests/verify_rdp_tasks_render.js` (44).
- New `test_rdp_grace_destroy_2026-06.js`.
- If reseller API wiring changed (e.g. added `/rdp/:id/renew`): `testing_agent` for the reseller endpoints (backend only). Use sandbox reseller API key in `memory/test_credentials.md`.
- Then the LIVE `rdp_full_mgmt_e2e.js` once.

---

## GUARDRAILS (do not break)
- 🚧 **Golden image rebuilds are STILL IMPORTING** (3 running; ws2022 importing at DO; ws2019/ws2025 waiting for the import slot). Watcher process `bash /app/memory/_golden_watch.sh` (PID 3277) logs to `memory/golden_rebuild_2026-09-24.log`. **Do NOT restart supervisor/nodejs or interrupt these.** A new fast-path test droplet is independent and safe.
- Production Mongo is LIVE (Railway). Grace-destroy touches `doRdpServers` + `vpsPlansOf` — test on sandbox / a fresh throwaway droplet first.
- `SKIP_WEBHOOK_SYNC='true'` and `BOT_ENVIRONMENT='production'` in `/app/backend/.env` — never change.
- `VPS_RDP_PROVIDER='azure'` in sandbox .env (vault restores it). DO-RDP path is reached via per-record dispatch; the E2E script calls the DO service directly so the env value doesn't block the ops test.
- Prod currently has **0 live DO-RDP orders**. DO inventory = WHM + dynopay + the 3 golden-build droplets (auto-destroyed after import).
- Vault password (handoff): `Katiekendra123@`. Reseller API key: `memory/test_credentials.md`.

## Files to touch
- `js/digitalocean-rdp-service.js` — `T.graceDays`, `_db` in `init`, rewrite `processExpiries`, clear `expired_at` in `renewInstance`.
- `js/_index.js` — VPS scheduler Phase 2 (and PAYG branches) DO-RDP defer-to-grace guard. **Confirm design with user first.**
- (optional) `js/reseller-api.js` — add `POST /rdp/:id/renew` if API-driven renew is wanted.
- New: `js/ops/rdp_full_mgmt_e2e.js`, `js/tests/test_rdp_grace_destroy_2026-06.js`.

## Suggested order of execution
1. Confirm with user: OS/region for live box; grace-clock start point; whether to also add `/rdp/:id/renew`.
2. Implement grace-destroy in the RDP service (Part 2A) + unit test.
3. Reconcile bot scheduler (Part 2B).
4. Regression suites green.
5. Build + run the LIVE full-mgmt E2E once (Part 3); confirm every op + grace-destroy; auto-destroy the box.
6. `finish` + update PRD.md / test_credentials.md.
