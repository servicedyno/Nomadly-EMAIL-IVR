# Twilio — Zero / Low Compliance Countries (2026)

**Generated:** 2026-08-07 (live query against this account's Twilio API)
**Method:** Read-only sweep of `AvailablePhoneNumbers` (`addressRequirements`) + `RegulatoryCompliance/Regulations`
(`end_user` + `supporting_document` requirements) per country, across **local / mobile / toll-free**.
**Scope note:** Twilio's public catalog markets ~100+ countries, but the live API for **this account**
currently exposes **54 countries** with inventory. This report reflects what this account can actually buy today.

## Definitions
- **Strictly zero compliance** = `addressRequirements = none` **AND** no regulatory bundle
  (zero `end_user` fields, zero `supporting_document` uploads). No ID, no address, no bundle.
- **No-docs but address required** = no bundle/ID, but Twilio needs an Address record on file
  (`addressRequirements = any` or `local`). "any" = any global address, unverified.

---

## ✅ Tier 1 — STRICTLY ZERO COMPLIANCE (buy with nothing)
| Country | ISO | Zero-compliance number types |
|---|---|---|
| United States | US | local, toll-free |
| Canada | CA | local, toll-free |
| Puerto Rico | PR | local |
| Israel | IL | local, mobile |
| Sweden | SE | mobile |
| Philippines | PH | mobile |
| Tunisia | TN | local |

**7 countries** require literally zero documentation to provision.

---

## 🟡 Tier 2 — NO ID / NO BUNDLE, but an Address is required
(You just need any Address record attached — no uploads, no verification.)
| Country | ISO | Type (address requirement) |
|---|---|---|
| Netherlands | NL | mobile (any) |
| Finland | FI | mobile (any), toll-free (any) |
| Denmark | DK | mobile (local) |
| Czech Republic | CZ | toll-free (any) |
| Israel | IL | toll-free (any) |
| New Zealand | NZ | toll-free (any) |
| Peru | PE | toll-free (any) |

> This is why the **Netherlands +3197 (mobile)** number worked with no bundle — it only needed an Address, not documents.

---

## ❌ Require a regulatory bundle (ID + supporting documents)
Examples confirmed via API: United Kingdom (all types), Germany, France, Spain, Lithuania, Australia (local/mobile), and most EU local numbers. `addressRequirements = none` alone does **not** guarantee zero compliance — e.g. **GB mobile** shows `none` but still requires a bundle (1 end-user + 2 documents).

## Raw data
Full per-country/per-type detail saved at `/app/tmp_twilio_reg_out.json`.
Regenerate with: `node /app/tmp_twilio_reg.js` (read-only).
