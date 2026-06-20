# Twilio 06-16 Post-mortem — final verdict: **no customer impact, no DMs needed**

## What I checked
1. Pulled all log lines containing `Twilio` from 2026-06-13 → 2026-06-20 (Railway environmentLogs, paginated via `anchorDate` + `beforeLimit`).
2. Re-filtered with **specific failure patterns** instead of the broad `Twilio` keyword that produced the misleading 2,208 hit on 06-16. Patterns searched:
   - `Twilio call failed`
   - `Twilio API error`
   - `Twilio authentication`
   - `Twilio number suspended`
   - `IVR failed`
   - `SMS failed`
   - `phone refund`
   - `failed to send sms` / `failed to make call`
   - `subaccount suspended` / `auth token invalid` / `unable to deliver`
   - `Twilio rate limit`, `Twilio: 4xx`, `Twilio: 5xx`, etc.

## What the 06-16 "spike" actually was
The previous RCA report said *"Twilio errors spiked to 2,208 on 06-16"* — that count came from filter=`Twilio` (literal substring), which also matched success/info lines like:

```
[Twilio] SIP dial timeLimit: 7860s (planRemaining=99min, wallet=$4.94, rate=$0.15/min)
[Twilio Sync] Webhook sync complete: 16 updated, 0 failed, 0 credentials recovered
[Twilio] cleanupOrphanDrafts: scanned=0 deleted=0 errors=0
[BulkIVR] Status: ... status=failed duration=0s   ← these are leg-disconnects, not Twilio errors
```

When I re-filter with **error-only** patterns, the picture is completely different.

## Actual customer-impacting Twilio failures, 06-14 → 06-20

| Date | Event | User | Resolution |
|---|---|---|---|
| 2026-06-15 | `[CloudPhone] Twilio purchase failed for 8186560549, refunded $75 to wallet. Balance: $75.94` | `8186560549` | **Already auto-refunded ($75)** |
| 2026-06-16 15:30:33 | `SIP Bridge Call failed 0s` — chatId=1794625076 → +18886146831 | `1794625076` | **Not billed** — destination was a non-Nomadly number; system explicitly says "is correct" |
| 2026-06-16 15:30:51 | `SIP Bridge Call No answer 0s` — same chatId, same destination | `1794625076` | **Not billed** — same scenario |

That's it. **2 unique users, both already handled correctly by the platform.**

## Optional follow-up (low priority)

### User `8186560549` — refund already issued
They paid $75 for a phone number, Twilio purchase failed, system refunded immediately. We *could* send a courtesy message:
```
Hey — your $75 phone-number purchase on 06-15 didn't go through on our carrier's side
and was auto-refunded to your Nomadly wallet. You can retry whenever. Sorry for the
hiccup!
```
But because the refund already landed and they presumably retried successfully (or moved on), this would be more noise than value. **Recommended: SKIP.**

### User `1794625076` — destination didn't pick up
These are normal "call went to a non-Nomadly destination that didn't pick up" events. The customer dialled out from their Nomadly SIP, the destination didn't answer. **No action required.**

## Conclusion

> The 06-16 Twilio "incident" in the previous RCA was a false-positive caused by an overly-broad keyword filter. **Twilio is not a contributor to the sales drop-off**, and **no customer recovery DMs are warranted**.

The previous RCA report (`/app/RAILWAY_6DAY_RCA_REPORT.md`) section #4 has been corrected via this addendum.

## Artifacts
- `/app/logs_prod/_twilio_06_16_users.csv` — full per-row CSV of every Twilio log on 06-16 that matched any failure-keyword (22 rows; verified to be 19 info-noise + 3 informational call-leg events)
- `/app/logs_prod/_twilio_06_16_summary.json` — JSON summary
- `/app/scripts/twilio_06_16_postmortem.py` — analysis script (re-runnable)
