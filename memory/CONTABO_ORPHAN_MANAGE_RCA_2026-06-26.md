# Contabo "unable to manage VPS" RCA — 2026-06-26

## Symptom (user report)
Existing users who had VPS can no longer **manage** their VPS (start/stop/reset password/
reinstall/etc.). User noted the VPS "came from the Contabo account `hosting@dyno.pt`" (the
creds currently in `.env`).

## Investigation (read-only: prod Mongo + Railway logs + live Contabo API)
- Contabo OAuth with `.env` creds (`hosting@dyno.pt`, client `INT-15074667`) **WORKS** (token OK).
- The current Contabo account holds **only 6 instances**.
- `vpsPlansOf` has **17 records** → 15 Contabo, 1 Azure, 1 DigitalOcean.
- Of the 15 Contabo records: **5 PRESENT** on current account (manageable), **10 ORPHANED**
  → `GET /compute/instances/<id>` returns **404 "Entry Instances not found by instanceId"**.

### Root cause
The Contabo account `hosting@dyno.pt` was **reset/recovered during the "vendor-block-2026-06"
event** (a NEW Contabo account was provisioned — see `compReason:
vendor-block-2026-06-recovery-new-contabo-account`). Instances created **before** the reset are
gone from the account. DB still points to those old numeric instance IDs, so every per-record
Contabo management call (`getInstance/start/stop/resetPassword/reinstallInstance/...`) hits the
current account and gets **404**. Routing is NOT the bug — `getProviderForRecord()` correctly
sends numeric IDs to Contabo; the instances simply no longer exist there.

## Affected users (NON-deleted orphaned VPS = think they own an active VPS but can't manage it)
| instanceId | chatId | status | isRDP | price | created |
|---|---|---|---|---|---|
| 203310799 | 6996287179 | provisioning | no | 14.85 | 2026-05-19 |
| 203306676 | 8737445617 | provisioning | no | 47.76 | 2026-05-17 |
| 203257831 | 6980445843 | provisioning | RDP | 46.35 | 2026-04-25 |
| 203255263 | 6773929524 | provisioning | no | 20.25 | 2026-04-24 |
| 203250218 | 7163210105 | INSTALLING | RDP | 58.14 | 2026-04-22 |
| 203250427 | 7163210105 | INSTALLING | RDP | 58.14 | 2026-04-22 |
| 203368045 | 404562920 | pending_payment | RDP | 32.25(comp) | 2026-06-12 |
| 203368052 | 404562920 | pending_payment | RDP | 32.25(comp) | 2026-06-12 |

(5 distinct PAID users + davion419's 2 comp'd RDPs.)

## 5 PRESENT (still manageable) on hosting@dyno.pt
203369342 (7776668174, pending_payment), 203370442 (7776668174, RUNNING),
203370900 (8625434794, RUNNING), 203378282 (404562920, pending_payment RDP — never provisioned),
203378302 (404562920, RUNNING Linux).

## Fix candidates
1. **Code hardening** — graceful 404 handling across ALL VPS management actions (only `start`
   currently explains 404), flag orphaned records, alert admin. + admin diagnostic endpoint
   `/api/admin/vps-orphan-scan` to list orphaned instances/affected users. (non-destructive, testable)
2. **Remediation** for affected paid users — re-provision equivalent VPS on the working provider
   (DigitalOcean Linux / Azure RDP) and update DB, OR refund wallets. (spends money — needs owner OK)

## Notes
- RDP→Azure, VPS→DigitalOcean, Contabo fallback disabled (live prod env confirmed). New buys avoid Contabo.
- Old Contabo account creds are NOT available (account was blocked) → old instances unrecoverable.

## RESOLUTION (2026-06-26)
- @davion419 re-provisioned ONE Azure RDP `az-nmdcbaec20f3` (RDP 10 / D2s_v6, US-west/westus3),
  IP **20.125.117.70**, user **nomadly**, pwd `9_dsauo=6ZGtDGN3thcf` (he can also Reset Password from
  the bot now). Tagged comp (no wallet charge). His 3 dead RDP records hidden → bot shows ONE RDP +
  his working Linux VPS. Verified manageable via /api/admin/vps-manageability-check (testing agent).
- Azure robustness shipped: `createInstanceWithFallback` (live SKUs-API region rotation + capacity-409
  retry), full orphan-free cleanup (deleted 15 pre-existing orphan resources), provider-aware
  `fetchVPSDetails`, correct Azure admin-username display ("nomadly" not "Administrator").
- STILL OPEN (operator approved Option A re-provision, pending go-ahead): 5 paid users with orphaned
  Contabo VPS — 6996287179 (V92 Linux), 8737445617 (V97 Linux), 6980445843 (V92 RDP),
  6773929524 (V92 Linux), 7163210105 (V95 RDP ×2). All-users scan: manageable=5, orphaned=8.
