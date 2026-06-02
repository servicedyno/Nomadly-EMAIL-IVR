# SIP Credential Desync → "403 Forbidden" Fix (2026-06-02)

## Report
Production bot user **@LBHAND23** (chatId `1794625076`) — after buying a CloudIVR (Business) plan,
his SIP credentials failed to register: softphone showed **`Registration Status: Failed — Forbidden 403`**
and the web call client (`1.speechcue.com/call`) showed repeated `Connection error`. Number: `+18886146831`.

## Root cause (verified end-to-end)
The bot **"🔑 SIP Credentials → Reset Password"** handler (`js/_index.js` ~line 26454) created a NEW
Telnyx telephony credential but only persisted `sipUsername` / `sipPassword`. It did **NOT** update
`telnyxSipUsername` / `telnyxSipPassword` / `telnyxCredentialId`.

The SIP screen reads the **username** from `telnyxSipUsername || sipUsername` and the **password** from
`telnyxSipPassword || sipPassword`. After a reset those came from **two different credentials**:
- username = `gencred1lwe4hOV…` (cred `161ab41a`, created at purchase 04:24)
- password presented by the reset flow = the NEW cred `cf5a3abd` (gencred9fLB6a…, created 14:00)

→ username of credential A + password of credential B → SIP digest auth fails → **403 Forbidden**.

### Proof
- Live SIP REGISTER: each credential paired with **its own** password → `200 OK`
  (on both `sip.telnyx.com` and `sip.speechcue.com`). A mismatched pair → `403`.
- `sip.speechcue.com` → `192.76.120.10` (Telnyx); digest realm follows the domain; both domains accept.
- No propagation delay: a freshly created credential registers at +0s.
- Telnyx ignores the `sip_username`/`sip_password` we send and generates both; the returned
  `sip_password` (32-hex) is the real one and is stored correctly.

A second instance of the same bug class: `POST /phone/reset-credentials` (~line 35544) wrote the DB
consistently but its Telegram notification + JSON response showed the **local seed password**
(`newSeedPass`) alongside the **Telnyx gencred username** → same mismatch.

## Fixes
### 1. Production data hotfix (applied live)
Re-synced `+18886146831` so all SIP fields point to credential `161ab41a`:
`sipUsername = telnyxSipUsername = gencred1lwe4hOV…`, `sipPassword = telnyxSipPassword = 5d0b93c3…`.
Verified `200 OK` via live SIP REGISTER. Scan of all 15 active numbers → 0 remaining desynced.

Working creds for the user:
- Domain: `sip.speechcue.com`
- Username: `gencred1lwe4hOVZZJzunVSeh95RTkLYZsRAn9fjC8YOLlZV1`
- Password: `5d0b93c3727b41f3aa5ea8eb656a40be`

### 2. Code fix (needs deploy to Railway)
- **Bot Reset handler** (`js/_index.js` ~26454): now creates the new credential, deletes the stale
  one, and persists **all five** fields together (`sipUsername`, `sipPassword`, `telnyxSipUsername`,
  `telnyxSipPassword`, `telnyxCredentialId`); the confirmation now shows the full matching
  username + password + domain.
- **`/phone/reset-credentials`** (~35544): notification + JSON now return
  `newTelnyxSipPassword` (the password that matches the gencred username), not `newSeedPass`.

## Note
Code fix is in the dev fork only. Deploy via **Save to Github → Railway** to apply in production.
Until deployed, advise the user not to tap "Reset Password" (old buggy path still live in prod).
