# Comp VPS Provisioning — Operator Guide

## What
Admin endpoint that provisions **N free VPS instances for a user** by re-using
their saved purchase intent (`state.vpsDetails`), **without deducting their
wallet**. Each instance is tagged with a `comp` audit trail in `vpsPlansOf`.

## When to use
- A user got stuck mid-purchase (e.g. vendor outage) and you want to comp them
- Refund-as-VPS instead of cash refund
- Beta/influencer comps

The user receives the standard Telegram credentials DM + email — same delivery
path as a real purchase. They cannot tell from the bot UI that this was a
comp; the only difference is the `comp:true` flag in their `vpsPlansOf` record.

## Trigger (production)

```bash
ADMIN_KEY=$(node -e "console.log(process.env.SESSION_SECRET.slice(0,16))")
# Or read SESSION_SECRET from Railway env and take first 16 chars.

curl -X POST 'https://nomadly-email-ivr-production.up.railway.app/admin/comp-vps?key=ADMIN_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "chatId":     "404562920",
    "count":      2,
    "compReason": "vendor-block-2026-02 — Contabo POST was down when user attempted purchase"
  }'
```

### Optional override
If the user has no saved `state.vpsDetails` (or you want different specs),
pass the full spec in the body:

```jsonc
{
  "chatId":     "404562920",
  "count":      2,
  "compReason": "...",
  "vpsDetails": {
    "config": { "_id": "V94", "name": "Cloud VPS 20", "cpuCores": 6, "ramGb": 12, "diskGb": 100 },
    "region": "US-west",
    "zone":   "US-west",
    "isRDP":  true,
    "os":     { "isRDP": true, "value": "win", "osType": "Windows", "id": null },
    "plan":   "Monthly",
    "totalPrice": "32.25",
    "plantotalPrice": 32.25
  }
}
```

## Response

```jsonc
{
  "success":     true,                   // false if ANY instance failed
  "chatId":      "404562920",
  "requested":   2,
  "provisioned": [
    { "instanceId": 203320842, "host": "147.93.4.242", "productId": "V94", "isRDP": true, "osType": "Windows", "plan": "Monthly", "displayName": "nomadly-404562920-1775790000123" },
    { "instanceId": 203320843, "host": "147.93.4.243", "productId": "V94", "isRDP": true, "osType": "Windows", "plan": "Monthly", "displayName": "nomadly-404562920-1775790002146" }
  ],
  "errors":      [],
  "compReason":  "vendor-block-2026-02 — ...",
  "productId":   "V94",
  "region":      "US-west",
  "isRDP":       true
}
```

## Safety rails baked in
- **Auth-gated** — requires `?key=<SESSION_SECRET[0:16]>` (same scheme as
  other `/admin/*` endpoints).
- **Required-field validation** — `chatId` + `compReason` (≥3 chars) must
  be present in the body.
- **Hard count cap of 10** — `count` is clamped to `[1, 10]` to prevent
  slip-of-the-finger billing storms.
- **Per-instance failure isolation** — if instance #2 fails, instance #1
  is still provisioned and reported in `provisioned[]`. No double-billing
  rollback risk.
- **Cancel-on-create** — the underlying `createVPSInstance` already
  schedules a Contabo cancel for end-of-period (autoRenewable=false by
  default), so the comp does NOT roll into a paid month-2 charge.
- **No wallet touch** — the endpoint deliberately does NOT call any
  wallet-debit helper. Verified by static guard in
  `js/tests/test_admin_comp_vps_endpoint.js`.

## Audit query
Find all comped instances:
```js
db.vpsPlansOf.find({ comp: true })
              .sort({ compAt: -1 })
              .project({ chatId: 1, contaboInstanceId: 1, compReason: 1, compAt: 1, compIndex: 1, compOfTotal: 1, productId: 1, host: 1 })
```

## Real Contabo billing impact
The comp creates real Contabo instances and the **operator's Contabo
account is billed** at standard per-instance rates (not the bot's markup
price). For a V94 + Windows + non-EU region: ~$19/mo per instance.
The instances cancel-on-create so the bill stops after 1 month.

## Tests
Static guards: `node js/tests/test_admin_comp_vps_endpoint.js` → 19/19 pass.

## Source
Endpoint definition: `js/_index.js` (search for `app.post('/admin/comp-vps'`).
