# phoneGenTimeout fix — Railway redeploy instructions

## Summary
- **Bug:** For 3000-lead CNAM orders, the `phoneGenTimeout` ceiling (90 min) was
  pinned exactly at `3000 × 1200ms × 1.5 = 90 min`. With observed prod
  throughput of ~1980ms/lead (vs 1800ms budget), real completion takes ~99 min
  → jobs time out at ~90% done.
- **Fix applied locally to `/app/js/validatePhoneBulk.js`:**
  - `CEILING_MS`: 90 min → **240 min** (configurable via env)
  - `CNAM_MULTIPLIER`: 1.5 → **2.0** (matches observed 1980ms/lead)
  - **NEW `SAFETY_BUFFER`: 1.2×** raw budget (absorbs latency spikes)
  - All five constants overridable via env vars (no rebuild needed for tuning)

## Verification (3000-lead CNAM)
| | Old | New |
|---|---|---|
| Budget | 90 min | **144 min** |
| Observed real (1983ms/lead) | 99 min | 99 min |
| Headroom | **−9 min ✗** | **+45 min ✓ (45%)** |

Sanity-check pass: 7 of 8 realistic cases (only 10k-CNAM mega-order intentionally hits the ceiling guard).
Regression test: `pytest /app/backend/tests/test_phoneGenTimeout_fix.py` → 3/3 pass.

## In-flight job f7c619a9-0d9e-42f4-8b5f-aa912049a98d (one-shot snapshot)
- status: `running`, 1619/3000 (54%), 902 real names
- elapsed: 53.5 min, rate: 30.26 leads/min (~1983ms/lead)
- ETA: ~46 min more → finishes ~99 min total (~08:15 UTC)
- **Old 90-min ceiling hits at ~2723/3000 → ~277-lead shortfall**
- Resume logic in `_index.js:34212-34322` re-loads results from MongoDB on
  startup, so a redeploy mid-job will NOT lose progress.

## Railway redeploy steps (your turn)
1. **(Optional) Set env vars on Railway** (Service `Nomadly-EMAIL-IVR`, env
   `production`) so future tuning needs no code change:
   ```
   PHONE_GEN_TIMEOUT_CEILING_MS=14400000   # 240 min
   PHONE_GEN_CNAM_MULTIPLIER=2.0
   PHONE_GEN_SAFETY_BUFFER=1.2
   ```
   (Even without these env vars, the new code defaults to the same values.)

2. **Push the patched `/app/js/validatePhoneBulk.js` to GitHub** via the
   "Save to Github" button in the chat input. Railway auto-deploys on push.

3. **What happens on redeploy** (verified by reading `_index.js:34212-34322`):
   - Bot restarts → scans `leadJobs` collection for `status: running` jobs
   - Sees f7c619a9 with 1619 results, status=running
   - Calls `validateBulkNumbers(..., resumeData={jobId, results, realNameCount, ...})`
   - Old results preserved; new timeout = 144 min from resume time
   - Job finishes cleanly with 3000/3000

4. **(Optional) Re-check status** after redeploy:
   ```bash
   cd /app && node scripts/check_leadjob.js f7c619a9-0d9e-42f4-8b5f-aa912049a98d
   ```

## Files changed
- `/app/js/validatePhoneBulk.js` — lines 24-44 (constants + formula)
- `/app/scripts/check_leadjob.js` — NEW (mongo health snapshot)
- `/app/scripts/test_phoneGenTimeout.js` — NEW (formula sanity-check)
- `/app/backend/tests/test_phoneGenTimeout_fix.py` — NEW (pytest regression)
- `/app/memory/leadjob_f7c619a9_snapshot.json` — current snapshot
