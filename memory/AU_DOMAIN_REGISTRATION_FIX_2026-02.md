# Fix v2 — `.au` / `.com.au` Domain Registration via OpenProvider (2026-02 — ROUND 2)

## What happened in round 1
The first fix (committed in `/app/js/op-service.js` and deployed to Railway as commit `68495b26` / deployment `6e76544a`) sent OpenProvider an `additional_data` block with **8 fields whose names were hallucinated by a web search**:

```
eligibility_name, eligibility_id_type, eligibility_id, eligibility_type,
registrant_name, registrant_id_type, registrant_id, policy_reason
```

OpenProvider still rejected with the same code 374 / `Domain 'additionalData' parameter is missing` because **none of those field names exist in OP's schema** — they were copy-pasted from an unrelated source (OpenSRS / generic .au reseller docs).

User `6550622589` paid $58.50 (after coupon) at 10:06:42 UTC; registration failed at 10:06:47 UTC with the wrong-schema payload.

## Source of truth (this time, from OP's own wiki)
- https://doc.openprovider.eu/API_Format_Additional_Data — the canonical "Format specification > additionalData" table
- https://support.openprovider.eu/hc/en-us/articles/13435440668306--com-au — OP's .com.au KB article

For **`.au` / `.com.au` / `.net.au` / `.org.au`** OP's API expects exactly:

| Field | Purpose | Allowed values |
|---|---|---|
| `eligibility_type` | What makes the registrant eligible | `Company`, `RegisteredBusiness`, `SoleTrader`, `Partnership`, `TrademarkOwner`, `PendingTMOwner`, `CitizenResident`, `IncorporatedAssociation`, `Club`, `NonProfitOrganisation`, `Charity`, `TradeUnion`, `IndustryBody`, `CommercialStatutoryBody`, `PoliticalParty`, `Other` |
| `eligibility_type_relationship` | How the domain relates to the registrant | `"1"` = exact match / acronym / trademark · `"2"` = closely & substantially connected |
| `id_type` | Type of ID document | `ABN`, `ACN`, `ARBN`, `OTHER`, `TM`, `TAS`, `VIC`, `NSW`, `ACT`, `QLD`, `NT`, `WA`, `SA` |
| `id_number` | The actual ID, digits only | e.g. `002510054` for an ACN |

For **`.id.au`** only `eligibility_type` + `eligibility_type_relationship` are required (no id_type / id_number).

Per OP's KB Common Errors: **when `eligibility_type = Company`, use `ACN` not `ABN`** — the registry blocks ABN-on-Company combos with `"The provided registrantID value for the provided registrantID type is blocked by the registry"`.

## Fix applied
1. `/app/js/op-service.js::_buildAuAdditionalData(tld)` now emits exactly the 4 (or 2 for `.id.au`) correct fields, with `id_type` defaulting to `ACN` when `eligibility_type === 'Company'`.
2. New env var **`AU_ELIGIBILITY_RELATIONSHIP="2"`** (default) replaces the unused `AU_POLICY_REASON`.
3. Changed env var **`AU_REGISTRANT_ID_TYPE="ACN"`** (was `ABN`).
4. Updated unit test `/app/js/tests/test_au_additional_data.js` — 9 assertions covering the 4-field schema, the 2-field `.id.au` exception, fail-fast, and no-regression on other TLDs. All pass with zero network calls.

## Deploy state
- ✅ `/app/backend/.env` updated locally
- ✅ Railway production env: `AU_REGISTRANT_ID_TYPE=ACN`, `AU_ELIGIBILITY_RELATIONSHIP=2` pushed via `variableCollectionUpsert`, readback confirms
- ❌ **Code patch needs ONE MORE "Save to Github"** to get the corrected `op-service.js` onto the Railway-connected git repo. Until that happens, production still runs the buggy 8-field code from commit `68495b26`.

## Known follow-up risks (in order of likelihood)
1. **Local-presence requirement** (OP TLD restrictions say *"Local presence required: yes; OP does not provide it"*). Our owner/admin handle `JC960450-US` is a US-based contact. After the schema fix, OP may reject with a "local address required" error. If so, we need to create an AU-based contact handle (similar to how `BK921363-CA` is used for `.ca`).
2. **ABR validation** — OP will validate ACN `002510054` against the Australian Business Register to ensure it's an active company. If the ACN doesn't match APPLE PTY LTD or is inactive, OP returns a different (data, not code) error.
3. **The bot needs `id_type='ACN'` in the schema** but Telegram users might be told the registrant is "ABN 46002510054" — that's fine because OP just needs ONE valid ID; we send ACN by default and ABN as a fallback only if the user explicitly changes `AU_REGISTRANT_ID_TYPE` in env.
