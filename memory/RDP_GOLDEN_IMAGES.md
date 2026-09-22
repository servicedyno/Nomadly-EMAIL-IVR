# Windows RDP on DigitalOcean — Golden Images runbook

Code: `js/digitalocean-rdp-service.js` (orchestrator), `js/rdp-scripts/` (droplet payloads),
`js/ops/rdp_golden_build.js` (CLI), `js/ops/rdp_golden_e2e.js` (customer-order E2E), `js/ops/rdp_do_preflight.js`
(platform probe), tests `js/tests/test_do_rdp_golden_2026-06.js` (61 assertions, fake DO API + local Mongo).

## Facts established by live probes / builds (2026-09-22)
- `/dev/kvm` IS available on DigitalOcean droplets → QEMU/KVM Windows install works.
- DigitalOcean serves **NO DHCP** to (stock/snapshot) droplets → a stock Windows would have no IP.
- The metadata service `169.254.169.254` IS reachable **link-local** (APIPA-style route) and via the gateway.
  → `apply.ps1` gives each NIC a temporary 169.254.200.10, reads `/metadata/v1.json`, applies the static
    public/private IPv4 + DNS by MAC, adds a host route to the metadata IP via the gateway. Idempotent, every boot.
    Proven on real DO hardware (WS2022 + WS2025 booted with RDP answering after the disk copy).
- The upstream repo's QEMU flow installed Windows onto the disk Ubuntu + the ISOs run from → impossible.
  → We attach a 32 GB block-storage volume as the install target.
- **Droplet SNAPSHOTS of a Windows disk are unusable**: DO inherits `distribution: Ubuntu` from the build
  droplet and the *create droplet from snapshot* (and `rebuild`) action **errors ~45 s in** (droplet auto-
  deleted; `power_on` refused). Reproduced 4× (with/without ssh key, agent, transfers idle). DO evidently
  post-processes "known distro" images (mount/inject) and fails on NTFS.
  → Golden images are **DigitalOcean Custom Images** (`POST /v2/images` with `distribution: "Unknown"`, imported
    from a qcow2 the build droplet serves over HTTP) — the same route as DO Solutions' own
    `do-win-image-builder`. `min_disk_size` = 32 GB (qcow2 virtual size) ⇒ fits every tier.
- The first-boot "marker" telemetry (guest curl → host 10.0.2.2:18080) never fired on any edition → replaced
  by an **offline check**: after Windows shuts itself down (last FirstLogonCommand = `shutdown /s`), the volume
  is mounted read-only with ntfs-3g and `C:\cloudinit\apply.ps1` (sha256 must match) +
  `C:\Windows\System32\Tasks\CloudInitApply` must exist. Authoritative gate before anything ships.
- Direct (customer, non-golden) conversion writes the finished volume over the boot disk. That copy hung once
  (32 GB streaming through the page cache evicted bash/curl). Now: sysrq `s` + `u` (remount-ro), then
  `dd iflag=direct oflag=direct`, then only bash builtins (`echo b > /proc/sysrq-trigger`).
- Build size `gd-2vcpu-8gb` is periodically out of stock in nyc3 (`422 Size is not available`) → the builder
  reads the region's live `sizes` and falls back through `c-4`, `m-2vcpu-16gb`, … (all 50 GB disk).
- Drivers: only THIS edition's `viostor/vioscsi/NetKVM/Balloon` are put in `$WinPEDriver$` on the answer ISO.
- WS2025 offline install under QEMU took 55 min vs 10 min for WS2022/WS2019 (same size). Budget 2 h per build.

## Build pipeline (resumable phase machine, state in Mongo `doRdpImageBuilds`)
creating (size fallback) → booting → converting (droplet: ISO → QEMU install → QEMU first boot until RDP answers →
Windows self-shutdown → offline NTFS verify → `qemu-img convert` to qcow2 → `python3 -m http.server 80` →
callback `image_ready` with `image_url`) → importing (`POST /v2/images` custom image, poll NEW→pending→available,
≤ 240 min) → registering (`doRdpOsOptions.golden_*`, delete build droplet, delete superseded golden-* images incl.
legacy snapshots) → transferring (sequential image transfer to every mapped region) → done.
On any pod start: `syncGoldenFromDO()` registers the newest **custom** image `golden-<os>-*` per edition (DO is the
source of truth) and `resumeBuilds()` continues interrupted builds. Auto-sync every 6 h. Disable with
`DO_RDP_GOLDEN_AUTOSYNC=false`.

## Customer fast path
`provisionServer`: create droplet from `golden_image_id` with KEY=VALUE user-data → `apply.ps1` (boot task) sets
network + Administrator password + calls back `rdp_ready`; backend also polls 3389. If DO deletes the droplet
(create action errored) the order **falls back to the full conversion automatically** and logs why.

## Admin endpoints (key = first 16 chars of SESSION_SECRET, `?key=`)
- `GET  /api/admin/rdp-golden/status`
- `POST /api/admin/rdp-golden/build`    `{ "confirm": true, "os_id": "all|ws2019|ws2022|ws2025", "region"?, "regions": "all"|[...], "keep_on_failure"? }`
- `POST /api/admin/rdp-golden/sync`
- `POST /api/admin/rdp-golden/transfer` `{ "os_id", "regions": "all"|[...] }`
- `POST /api/admin/rdp-golden/cancel`   `{ "build_id" }`
CLI: `node js/ops/rdp_golden_build.js status|watch|build|sync|transfer|cancel` (see header for flags).
E2E: `node js/ops/rdp_golden_e2e.js --os ws2022 --region US --plan starter-1m` (creates + destroys one droplet,
verifies the per-order password with `xfreerdp +auth-only`; exit 0 only on a fast-path success).
Debug a running build: VNC `<ip>:5901`, password = build doc `vnc_password` (status output) — e.g.
`vncdo -s IP::5901 -p PW capture shot.png`. On-droplet log: `/root/win-convert/convert.log`; in Windows: `C:\cloudinit\apply.log`.

## Reseller API
- `GET /rdp/plans` → `default_os`, `os_options[{id,name,default,fast_deploy,eta_minutes,fast_deploy_regions}]`
- `POST /rdp` accepts `os` (ws2019|ws2022|ws2025, default ws2022); result has `os`, `fast_deploy`, `eta_minutes`.
- Fast path only when `golden_status=available` AND tier disk ≥ min_disk AND region in `golden_regions`;
  otherwise full conversion (+ on-demand image transfer to that region for next time).

## Costs
Build ≈ $0.20–0.40 per edition (droplet 2–3 h incl. import + volume). Custom image storage $0.06/GB/mo per
region copy (~12 GB ⇒ ~$0.70/mo per edition per region; 3 editions × 9 regions ≈ $20/mo).
