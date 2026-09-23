# Plan — Make the Windows RDPs Fast

## The problem you hit
The RDP you tested is the **Starter** plan: **1 vCPU / 2 GB RAM**, on DigitalOcean's
**Basic "Regular" CPU** class (shared, oldest-generation hardware, shared SSD — not NVMe).
Windows Server 2025 on that spec is genuinely slow: the OS alone wants ~2 GB RAM at idle,
so it's constantly starved.

There is no single "fast RDP" switch. Speed comes from four levers, and today all four are
set to the slow/cheap end:

| Lever | Today | Effect |
|---|---|---|
| **Droplet class** | Basic **Regular** (shared, old CPU, SSD) | Sluggish, variable, no NVMe |
| **Minimum size sold** | Starter = **1 vCPU / 2 GB** | Under Windows' floor → always slow |
| **Windows image tuning** | Stock Windows defaults | Visual effects, background services, power-saving all on |
| **RDP connection** | Customer uses default client settings | Wallpaper/animations/no cache → laggy feel |

The catalog also advertises "NVMe" on every plan, which is only true on Premium/Dedicated
droplets — worth correcting either way.

## Objective
Make every RDP the platform sells feel responsive, and make "fast" honest in the catalog —
without over-spending. This changes the **droplet class**, the **plans/specs offered**, the
**Windows image**, and the **connection experience** delivered to customers.

## What will change (recommended defaults — challenge any of these)

### 1. Move RDPs onto faster hardware (droplet class)
Switch the RDP plans from Basic **Regular** to Basic **Premium AMD** — newer CPUs, higher
memory speed, and true **NVMe** disks. This is the best speed-per-dollar and makes the "NVMe"
claim accurate. Cost rises only modestly (~15–20% more than Regular).

Option for the top tiers (Pro/Power): use **Dedicated CPU** instead of shared, for guaranteed
performance under sustained load. This is noticeably pricier (roughly 2–3× the Basic cost) and
is optional.

**Decision:** Premium AMD for all tiers (recommended), or Premium for entry tiers + Dedicated
for Pro/Power, or stay on Basic Regular (cheapest, slowest — not recommended).

### 2. Raise the minimum Windows spec (retire "Starter" as it stands)
1 vCPU / 2 GB is below what Windows Server needs and is the main reason for the slow experience.
Recommended new line-up:

| Plan | Spec | Notes |
|---|---|---|
| Entry | **2 vCPU / 4 GB / 80 GB** | New floor — the current "Standard" |
| Mid | **4 vCPU / 8 GB / 160 GB** | Comfortable for most real work |
| High | **8 vCPU / 16 GB / 320 GB** | Heavy workloads |

The old **1 vCPU / 2 GB Starter** would be removed from the Windows catalog (or kept only as a
clearly-labelled "light use, not recommended for Windows" option).

**Decision:** remove Starter entirely, or keep it with a "not recommended / may be slow" warning.

### 3. Bake performance tuning into the Windows image
Ship the image already optimised so every plan feels faster at no extra infrastructure cost:
- High-Performance power plan (stop CPU down-throttling)
- "Adjust for best performance" (disable animations, transparency, shadows, wallpaper)
- Don't auto-open Server Manager at login; trim unnecessary startup/telemetry/search-indexing
- Tune Windows Defender so it isn't heavily scanning during interactive use
- Server-side Remote Desktop compression/graphics settings tuned for responsiveness

### 4. Give customers an optimised way to connect
Provide a ready-made connection file / clear settings so the customer isn't stuck on laggy
defaults: LAN/high-speed experience preset, bitmap caching on, wallpaper/animations/font-smoothing
off, and guidance on UDP vs TCP if a link is unstable. Also nudge customers to pick the region
closest to them (already offered) to cut latency.

## Cost & pricing impact (your call)
Customer price today is set as **(DigitalOcean monthly cost × 2)**. Faster hardware raises the
DigitalOcean cost, so either the price goes up in step, or the margin shrinks if prices are held.

- Premium AMD: small increase — entry plan's DO cost goes from ~$24 to ~$28/mo.
- Dedicated (if chosen for top tiers): significantly higher DO cost.

**Decision:** keep the ×2 formula (prices rise automatically with the faster hardware), or hold
current customer prices and accept a slightly thinner margin, or set new fixed prices.

## Dependency / timing
Levers **3 and 4** (image tuning + connection) require the same one-time step already pending for
the callback fix: the code change reaching production (via **Save to GitHub** → auto-deploy) and a
**golden-image rebuild** (~a couple of hours). These will be **bundled into that single rebuild** so
the image is only rebuilt once. Levers **1 and 2** (class + plan line-up) also deploy through that
same push, then apply to all new orders.

Your currently-running test RDP can optionally be **resized up** in place (e.g. to 4 vCPU / 8 GB)
so you can feel the difference immediately, before any of the above ships.

## Assumptions
- Existing already-provisioned customer RDPs are left on their current size (this changes what is
  *sold going forward*, not a forced migration of live servers).
- Image tuning and the optimised connection file are wanted as described (no per-item sign-off).
- Windows editions offered (2019/2022/2025) stay the same; this is about speed, not OS choice.

## Out of scope
- Changing cloud providers or adding GPU instances.
- Migrating/rebilling existing running servers.
- Any change to how RDPs are provisioned, activated, or billed beyond spec/class/price.
