# @chemist454 — Cloud IVR "dropped calls" RCA (SIP outbound)

## Who
- Telegram @chemist454 → **chatId 6587790422** (nameOf/chatIdOf, prod db `test` on roundhouse).
- Wallet: in $175 / out $99.81 → ~$75 balance. No owned numbers array (SIP outbound user).
- Caller ID (ANI): **+1 888 330 4418 — a TOLL-FREE number** (Pro plan, Telnyx, bought 2026-09-02).
- Usage: heavy **rapid outbound SIP dialing** to many different US numbers (lead-gen / war-dialer pattern) via softphone registered to Telnyx SIP connection `2898118323872990714` (sip.speechcue.com), credential `gencred0u53hd…`.

## Data (prod walletLedger + Railway logs, ~4 days to 2026-09-21)
- 111 outbound-call hangups analysed. Hangup causes:
  - **originator_cancel / caller: 72 (65%)** — caller side dropped WHILE RINGING (never answered).
  - normal_clearing / callee: 37 (33%) — answered, callee hung up (normal).
  - normal_clearing / caller: 2.
- Duration: p50=9s, p90=33s, max=62s. **Only 1 call ≥60s.** 58 calls were 1–9s.
- No Telnyx 429/rate-limit or API errors in the window (the "429" hits were substrings of call-control-ids).

## Call flow (from prod logs)
1. Softphone dials → Telnyx `call.initiated` (A-leg, direction=outgoing, from_sip_uri=gencred → cleaned +18778570205). Code identifies user, Concurrency-Guard reserves $0.30, charges $0.03 connection fee, issues Telnyx **`transfer`** to route A-leg → destination with `from`=+18883304418 (per-call ANI).
2. Telnyx creates the outbound **PSTN B-leg** and fires ITS OWN `call.initiated` (direction=outgoing, from=+18883304418, **no from_sip_uri / credentialExtracted=false**).
3. Destination rings; if the softphone user gives up first → `originator_cancel`.

## Defects found (code, fixable)
### D1 (PRIMARY) — the outbound PSTN B-leg re-enters the full inbound→outbound SIP pipeline
Because the B-leg arrives as `direction=outgoing` on the SIP connection with no credential, `handleCallInitiated`→`handleOutboundSipCall` treats it as a NEW outbound call:
- Runs `telnyxService.listSIPCredentials(connectionId)` → **"Found 250 Telnyx credentials on connection"** and loops all 250 against the DB on EVERY outbound call.
- Resolves the **WRONG user** via the "most-recent-credential-creation / recent-activity" heuristic (logs show it resolving to random test accounts like 5168006768 / chatId 6277663071).
- Wastes ~3–6s and heavy Telnyx API + DB load per call; the destination starts ringing ~3s late.
- In the general case (when the reverse lookup resolves FAST, e.g. cache hit), the wrong-user's test-call-limit / rate-limit / wallet-cooldown branches can call `hangupCall(bLegCc)` → **tears the PSTN leg down mid-ring = a real drop** and could double-charge a connection fee. (For THIS user the lookup was slow, so the teardown didn't fire, but the latency + wrong-user attribution did.)
- The B-leg is otherwise "untracked" at hangup (billing is on the A-leg session / autoRoutedPendingBilling), so it should never have been re-routed.

**Fix:** tag the transfer's NEW leg with Telnyx `target_leg_client_state` (base64) = `nomadly_pstn_leg`. In `handleCallInitiated`, if `client_state` decodes to that marker → early-return (skip re-routing/reverse-lookup). Backup signal: short-TTL guard keyed `connectionId|destination|ani` set right before `transferCall`. No regression if Telnyx doesn't echo it (falls back to current behaviour).

### D2 (CONTRIBUTING, not code) — toll-free number used as OUTBOUND caller ID
+1888… is a toll-free (inbound) number. Presenting it as ANI on outbound long-distance calls yields poor STIR/SHAKEN attestation and carrier mistreatment (spam-flagging, low answer rates, some carriers drop). This, plus impatient rapid dialing (avg ~14s ring before the caller cancels), is the biggest driver of the *user-perceived* "dropped/failed" calls. Recommend the user dial from a **standard local/long-code DID**, not the toll-free.

## Tooling built this session (read-only)
- `js/ops/prod_lookup_chemist.js` — read-only prod Mongo lookup (chatId, wallet, ledger, calls). Output `investigations/chemist_ivr/`.
- `js/ops/railway_log_pull.js` — read-only Railway GraphQL env-log pager (project New Hosting / env production `889fd56a…` / svc Nomadly-EMAIL-IVR `b9c4ad64…`). Token = project-scoped `API_KEY_RAILWAY`, header `Project-Access-Token`, endpoint `backboard.railway.com/graphql/v2`.
