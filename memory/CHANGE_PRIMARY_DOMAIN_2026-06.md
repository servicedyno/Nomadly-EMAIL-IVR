# Change Primary Domain (hosting) + AI-support knowledge — 2026-06

## User need
User bought Anti-Red hosting on a bad/typo primary domain, then bought new domains
from the store, and wanted to REPLACE the primary domain without cancelling & rebuying.
Also wanted AI Support to know how to guide this.

## What shipped
New bot flow under 📋 My Hosting Plans → select plan → **🔄 Change Primary Domain**.

Flow: entry (`viewHostingPlan` action) → `selectDomainToMakePrimary` → `confirmChangePrimaryDomain`.

- **Eligible domains** = domains the user owns that are NOT primary/addon of any OTHER
  plan. Domains that are addons on THIS plan ARE eligible (auto-removed as addon first).
  (User chose option "c".)
- On confirm: `whmService.changePrimaryDomain(cpUser, newDomain)` (WHM `modifyacct`) swaps
  the primary. cPanel removes the old primary automatically. Then:
  - DB `cpanelAccounts` doc updated: `domain` = newDomain, `$pull` newDomain from addons,
    `previousPrimaryDomain` + `primaryChangedAt` recorded.
  - Old domain's CF hosting DNS + anti-red worker cleaned up (best-effort, fire-and-forget).
    Domain stays REGISTERED to user (choice "a").
  - `addonFlow.runDnsAndProtection()` sets up CF DNS + Anti-Red for the new primary
    (fire-and-forget, mirrors addon flow).
  - Same cPanel username/PIN kept. Files in public_html preserved.
- WHM failure → friendly error, no DB change, admin notified.

## Files touched
- `js/_index.js`:
  - actions `selectDomainToMakePrimary`, `confirmChangePrimaryDomain` (in `a` object ~L8229)
  - button `buttons.push([user.changePrimaryDomain])` in `viewHostingPlanDetails`
  - entry handler in `viewHostingPlan` action (~L14267)
  - select + confirm/execute handlers (~L14801, ~L14836)
  - TTS re-upload fix: `cpVmGreetingPreview` reupload now sets action to `cpVmAudioUpload`
    so the re-uploaded voice note isn't dropped by the global voice handler.
- `js/lang/{en,fr,hi,zh}.js`: buttons `changePrimaryDomain`, `confirmChangePrimaryBtn`;
  messages `selectDomainToMakePrimary`, `noEligibleDomainsToMakePrimary`,
  `confirmChangePrimaryDomain`, `changingPrimaryDomain`, `changePrimaryDomainSuccess`,
  `changePrimaryDomainFailed`.
- `js/ai-support.js`: self-service list bullet + dedicated FAQ ("change primary/main domain",
  "bought hosting with wrong domain", "remove old bad domain from hosting").
  NOTE: also fixed a pre-existing 2-byte UTF-8 corruption at file tail (a `━` banner line
  missing its lead byte + lost `// ` prefix) that had been breaking strict UTF-8 reads.

## Reused existing pieces (no reinvention)
- `whmService.changePrimaryDomain(username, newDomain)` → `{success, error}` (whm-service.js:837)
- `addonFlow.runDnsAndProtection({domain,cpUser,whmHost,account,db,bot,lang})` (addon-domain-flow.js)
- `cfService.getZoneByName`, `cfService.cleanupAllHostingRecords`, `antiRedService.removeWorkerRoutes`
- `cpProxy.removeAddonDomain(cpUser,cpPass,domain,sub,mainDomain,host)`

## Verification done
- Syntax valid (node -c) for all touched files; clean Node boot.
- Translation render test: all 6 message keys + 2 button keys render in en/fr/hi/zh.
- Service signatures confirmed.
- Eligibility logic unit test (scripts/test-change-primary-eligibility.js) against a THROWAWAY
  temp collection → PASS (fresh eligible, other-plan excluded, this-plan addon eligible,
  current primary excluded). Temp collection dropped, no residue.
- NOT E2E-tested against live WHM/CF: sandbox shares the PRODUCTION Mongo + would trigger a
  REAL cPanel modifyacct. User to validate the actual swap in production.

## Gotcha for future agents
Do NOT run multiple search_replace edits on the SAME large file (_index.js, lang files) in a
single parallel batch — it caused a write race that dropped/duplicated edits (en.js got a
duplicate `const en` block; _index.js lost the small actions/button edits). Edit the same file
sequentially.
