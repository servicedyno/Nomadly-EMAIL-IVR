# Self-healing VPS guard — design notes

## Function: `selfHealRenewedAfterCancelVPS()`
Lives in `/app/js/_index.js`. Scheduled every 30 minutes via `node-schedule` cron `*/30 * * * *`.

## Purpose
Prevents and self-recovers from the **renewed-after-cancel** failure class — the bug pattern that hit @davion419 (chatId 404562920) on 2026-05-10 when Contabo's auto-renew fired before our DB-side cancellation propagated to the Contabo API, costing ~€27 and giving the user a month of free VPS access.

## Detection
A `vpsPlansOf` doc is treated as needing intervention if **all** of:
1. `status ∈ {CANCELLED, DELETED}`
2. `contaboInstanceId` resolves to a live Contabo instance
3. Live instance status is `running | installing | provisioning | pending_payment`
4. **Either**:
   - `live.cancelDate > plan.end_time + 2 days` ← bug class A: Contabo auto-renewed before our cancel landed
   - `live.cancelDate == null` ← bug class B: our cancel never propagated (e.g. pending_payment refusal)

## Actions (running/installing/provisioning state)
1. Set `_selfHealAttemptedAt` (idempotency / 6h backoff)
2. `contabo.resetPassword(...)` — rotates Administrator/root password
3. Wait 45s for password-reset reboot to settle
4. `contabo.shutdownInstance(...)` with up to 3 retries; `"already stopped"` 400 counts as success
5. Insert into `vpsPlansOf_revoked` collection (archive); delete from `vpsPlansOf`
6. Send admin Telegram alert with summary

## Actions (pending_payment state)
Contabo API **refuses** `/cancel` on pending_payment instances (returns HTTP 500). Auto-action is impossible, so the guard:
1. Set `_selfHealAttemptedAt` + `_selfHealReason: pending_payment_manual_required`
2. Send admin Telegram alert with instructions to cancel via `my.contabo.com`

## Idempotency
- Plans with `_selfHealAttemptedAt` set within the last 6 hours are skipped (avoids spam during multi-minute heal sequence).
- After a successful heal, the doc is moved out of `vpsPlansOf` → guard never sees it again.

## Files
- Guard code: `/app/js/_index.js` lines 27365-27590
- Cron registration: `/app/js/_index.js` line 27366
- Static simulation (read-only): `/app/js/test_selfheal_logic.js`
- Audit collection: MongoDB `vpsPlansOf_revoked` (production "test" DB)

## Verification done
- `node --check js/_index.js` ✅ syntax pass
- `eslint js/_index.js` ✅ no new issues
- Bot restarted via `supervisorctl restart nodejs` ✅ clean startup, no fatal errors
- Read-only simulation against PRODUCTION DB correctly identifies `203250431` (chat 7163210105) as `pending_payment_manual_required`
- Read-only simulation correctly skips already-archived @davion419 doc (no longer in vpsPlansOf after manual revocation)
