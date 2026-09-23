# "Make Windows RDPs Fast" — progress & handoff (2026-09-23)

Status: **APPROVED plan, implementation PAUSED by owner before code edits.** Nothing in the fast-plan
code was changed yet. This doc has everything needed to resume precisely.

## Approved decisions (recommended defaults accepted)
- Droplet class: **Premium AMD** for all tiers (newer CPU, NVMe).
- Plan line-up: **remove Starter (1vCPU/2GB)**; keep 3 tiers = Standard(2/4/80) / Pro(4/8/160) / Power(8/16/320).
- Bake image tuning into the golden image (lever 3) + ship an optimised .rdp (lever 4).
- Pricing: keep **×2** formula (prices rise with the faster hardware).
- Resize the owner's running test box up for instant feel (optional, NOT done).

## Verified facts (DO API, live)
- Premium AMD monthly costs: `s-2vcpu-4gb-amd`=$28, `s-4vcpu-8gb-amd`=$56, `s-8vcpu-16gb-amd`=$112 (all NVMe).
- Premium AMD regions: ams3, blr1, fra1, lon1, nyc1, nyc2, sfo3, sgp1, syd1. **NOT in nyc3, tor1.**
- Golden ws2025 image (246641953) currently in: nyc3, ams3, blr1, fra1, lon1, sfo3, sgp1, tor1 (NOT syd1).
- ⇒ Decision: **per-region size** — use `-amd` slug where AMD is available, fall back to Basic (`s-*` non-amd)
  in nyc3/tor1 so those regions don't break. Uniform ×2 pricing off the AMD cost (higher margin in the 2 basic regions).
- A golden **rebuild** transfers the image to all `REGION_TO_DO` regions (incl. syd1) → fixes AU coverage too.

## Exact code changes to make (js/digitalocean-rdp-service.js unless noted)
1. **TIERS (lines 49-54):** delete the `starter` row. Set the 3 remaining rows to:
   - add `do_size_slug` = AMD slug, `do_size_slug_basic` = current basic slug, and bump `monthly_do_cost`:
     - standard: `s-2vcpu-4gb-amd` / `s-2vcpu-4gb` / 28
     - pro:      `s-4vcpu-8gb-amd` / `s-4vcpu-8gb` / 56
     - power:    `s-8vcpu-16gb-amd` / `s-8vcpu-16gb` / 112
   (Prices auto-update via `sellPrice`: Standard $56, Pro $112, Power $224 per month.)
2. **Region-aware size in `createInstance` (line ~991):** add
   `const AMD_REGIONS = new Set(['ams3','blr1','fra1','lon1','nyc1','nyc2','sfo3','sgp1','syd1'])`
   and set `do_size_slug: (AMD_REGIONS.has(region) ? tier.do_size_slug : tier.do_size_slug_basic)`.
   The chosen slug flows to droplet create at lines 563 (golden) & 591 (conversion) via `server.do_size_slug`.
   Keep `diskType:'nvme'` (now accurate for AMD regions). `_products()` still exposes `do_size_slug` for display.
3. **Lever 3 — image tuning in `js/rdp-scripts/apply.ps1`** (insert after the RDP/firewall/disk block, ~line 200,
   idempotent, runs every boot): High-Performance power plan (`powercfg /s SCHEME_MIN`); best-performance visual
   effects (VisualFXSetting=2); disable Server Manager auto-open (`HKLM\...\ServerManager DoNotOpenServerManagerAtLogon=1`);
   disable Windows Search + SysMain services; trim telemetry; set Defender low-priority / exclude nothing dangerous;
   RDP server tuning (`fEnableVirtualizedGraphics`, keep NLA on). All wrapped in try/catch + Log.
4. **Lever 4 — optimised .rdp** in `js/reseller-api.js` `vpsCredsHandler` (~line 546): add `rdp_file` (string) for RDP
   creds with LAN preset: `full address:s:IP:3389`, `username:s:Administrator`, `screen mode id:i:2`, `session bpp:i:32`,
   `compression:i:1`, `bitmapcachepersistenable:i:1`, `connection type:i:6`, `networkautodetect:i:0`,
   `bandwidthautodetect:i:1`, `disable wallpaper:i:1`, `disable menu anims:i:1`, `disable full window drag:i:1`,
   `allow font smoothing:i:1`, `audiomode:i:2`, `redirectclipboard:i:1`. Also surface it in the bot "RDP ready"/
   credentials message (send as a .rdp document) — find the bot RDP-ready copy in vm-instance-setup.js/_index.js.

## Deploy path (same one-time push as the callback fix — bundle both)
Prod deploys from `github.com/servicedyno/Nomadly-EMAIL-IVR` (= git origin). Main agent is NOT allowed to push.
1. Owner clicks **Save to GitHub** → Railway auto-deploys (updates prod code + `/provision/bootscript`).
2. Then run `node js/ops/rdp_golden_build.js build --os ws2025` (or `--os all`) → prod builds a NEW golden image with
   the tuned + DNS-fixed `apply.ps1` baked in (~a couple hours). Watch: `... watch`.
3. Place one fresh ws2025 order to confirm: fast feel + `rdp_ready` callback lands + agent checks in.

## Already DONE earlier this session (context)
- Prod `VPS_RDP_PROVIDER` flip **contabo → digitalocean-rdp** (LIVE, verified). See RDP_BOT_INTEGRATION_TASKS.md.
- Confirmation order live: droplet **603051404 @ 68.183.146.200**, ws2025, **Administrator / grgsM4Q!^nQnyZ6uUq**
  (starter-1m; KEPT for owner testing; optional resize to 4vCPU/8GB not done).
- Callback root-caused to in-guest DNS on the DO Windows box; **DNS safety-net fix already shipped in
  `js/rdp-scripts/apply.ps1`** (forces public resolvers on all up adapters) — deploys via the same push+rebuild above.
- Temp reseller key `temp-rdp-confirm-2026-09-23` minted then DISABLED.
- Leftover inspection droplet 602990345 destroyed. Only prod droplets remain: WHM (578369745), DynoPay (599433401),
  and the kept test box (603051404).

## Ops scripts added (sandbox, read-only unless noted)
`ops/rdp_prod_preflight_readonly.js`, `ops/rdp_prod_flip_provider.js` (WRITE: flips the var),
`ops/rdp_prod_redeploy.js` (WRITE: redeploys), `ops/prod_inspect_readonly.js`, `ops/prod_rdp_order_inspect.js`,
`ops/prod_mint_temp_reseller_key.js` (WRITE: mints a key — already disabled), `scripts/seed_rdp_reseller_e2e.js`.
Railway GraphQL: token=`API_KEY_RAILWAY`, proj `c23ac3d9-...`, env `889fd56a-...`, svc `b9c4ad64-...`.
