# UX Fixes — 2026-02 (post 12h log analysis)

Implemented in `/app/js/_index.js`. Lint-clean, smoke-tested.
Pending push to GitHub via "Save to Github" so Railway redeploys.

## Fixes shipped
1. **Audio-preview progress indicator** — replaces silent 2:20 spinner with live elapsed-time tick (every 8s); auto-cleans on TTS resolve/error.
2. **Wizard draft preservation on Cancel** — any IVR-OB Cancel now snapshots `ivrObData` to `ivrObDraft`. The Quick IVR Call menu surfaces "↩️ Resume Last Draft" if a < 24h-old draft exists. Resume jumps to the right step (placeholder/mode/category) based on what's already filled.
3. **CardLast4 normalization** — strips non-digits and validates exactly 4 digits with friendly error before storing the placeholder value. Fixes "1 9 0 8" → 1908.
4. **Dedup window 2000 ms → 800 ms** — `MSG_DEDUP_WINDOW_MS` reduced so legitimate fast double-taps go through.
5. **Inline "💵 Deposit Funds" CTA** on SMS-Leads paywall — shown when wallet < price; one-tap jump to deposit flow with the shortfall amount printed in the warning line.
6. **Graceful re-render on IVR template-category** — free text no longer dead-ends with "Please select a category from the buttons"; instead the menu re-renders with a soft hint.

## Files touched
- `js/_index.js` (+163 / -6 lines)

## Out of scope (not implemented per user choice)
- Billing changes (Fix 7: no-answer billing; Fix 8: AMD/voicemail billing) — deferred.

## Verification done
- `node --check js/_index.js` → SYNTAX OK
- ESLint → 0 issues
- Module-load smoke test → bot boots successfully with all schedulers initializing
- nodejs supervisor service → RUNNING (no errors)

## Production rollout
Code already auto-committed locally. User must press "Save to Github" → Railway will auto-redeploy with these UX fixes live.
