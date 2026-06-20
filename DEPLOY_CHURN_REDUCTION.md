# Reducing Railway Deploy Churn

## The problem
Last 7 days of commits → deploys to `Nomadly-EMAIL-IVR`:

| Day | Auto-commits | Railway deploys¹ |
|----:|------------:|------------------:|
| 06-16 | 15 | 9 |
| 06-17 | 22 | 15 |
| 06-18 | 22 | 6 |
| 06-19 | **29** | **15** |
| 06-20 (partial) | 9 | 4 |
| **Total** | **97** | **49** |

¹ Counted from Railway `deployments(...)` GraphQL query — slightly lower than commits because rapid back-to-back pushes get coalesced into a single deploy.

Every commit on the Emergent agent triggers `auto-commit for <uuid>` → push → Railway redeploy. Each deploy takes 30–90s during which the Telegram webhook URL returns 5xx/connection-refused → Telegram retries delivery 1–2× → updates that miss the retry window are **silently dropped**.

29 deploys on 06-19 = roughly **30 minutes of webhook downtime in one day**.

## Why this hurts sales
- Mid-flow checkout pages (deposit confirmation, OTP entry) get killed mid-handshake
- Telegram drops updates after retries are exhausted → users think the bot is "ignoring" them
- Crypto webhook callbacks (BlockBee/DynoPay) that land during a deploy may fail and trigger refund/dispute logic later

## Recommended fix — promote-to-prod branch

This is the cleanest, lowest-friction change. Estimated effort: **5 minutes**.

### 1. Create a long-lived `production` branch
```bash
cd /app
git checkout main && git pull
git checkout -b production
git push origin production
```

### 2. Point Railway at the new branch
In Railway dashboard:
1. Open `Nomadly-EMAIL-IVR` service → **Settings** → **Source**
2. Change **Branch** from `main` to `production`
3. (Optional but recommended) Toggle **Auto Deploys** OFF for a manual-promote workflow, or keep it ON if you want push-to-prod to redeploy.

Repeat for `HostingBotNew` and `LockbayNewFIX` (they have less churn, but the same pattern protects them).

### 3. Promote when ready
After a batch of confirmed-good changes on `main`:
```bash
git checkout production
git merge --ff-only main      # or `git merge main` if not a fast-forward
git push origin production
```
This becomes **one Railway deploy per batch**, no matter how many auto-commits landed on `main` in between.

### 4. (Optional) Add a tiny pre-push guard
A simple wrapper script to remind yourself before pushing to production. Save as `/app/scripts/promote-to-prod.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
git fetch origin
AHEAD=$(git rev-list --count origin/production..origin/main)
echo "main is $AHEAD commits ahead of production"
git log --oneline origin/production..origin/main | head -20
read -p "Promote these $AHEAD commits to production? [y/N] " yn
[[ $yn == [yY] ]] || { echo "aborted"; exit 1; }
git push origin origin/main:production
```

## Alternative — manual-deploy only
If even the promote-to-prod branch feels heavy, simply turn off auto-deploys in Railway:
- Settings → Source → **Auto Deploys: OFF**
- Click the **Deploy** button manually when you're ready

This is the safest option but requires you to remember to hit Deploy.

## Why other ideas don't work as well
- **"Reduce deploy time"** — nixpacks needs to rebuild on every push; you'd shave seconds, not the bulk of downtime.
- **"Skip deploys for doc-only commits"** — Railway doesn't natively detect this; would need a CI gate on every push. More overhead than it's worth.
- **"Run two replicas with rolling deploys"** — Railway Pro supports replicas but the Telegram webhook still binds to a single URL; you'd need a separate edge router. Big lift.

## Measurement
After switching, you can verify the improvement with the analyzer script:
```bash
python3 /app/scripts/analyze_railway_6day.py | head -30
```
Watch the next-week "deploys per day" column on Nomadly-EMAIL-IVR drop from ~7 to ~1–2.

## What I did NOT change
This file is a **recommendation only**. I haven't created the `production` branch or modified Railway service settings — both require you to act in the Railway dashboard / GitHub. No code changed in this step.
