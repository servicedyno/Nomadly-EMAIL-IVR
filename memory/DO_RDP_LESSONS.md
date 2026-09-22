# DO Windows RDP — lessons learned (2026-09-22)

1. **Never snapshot a converted Windows droplet as the golden image.** DO keeps `distribution: Ubuntu`
   on the snapshot and *create/rebuild from it errors* every time (~45 s, droplet auto-deleted, `power_on` refused).
   Use Custom Images (`POST /v2/images`, `distribution: "Unknown"`, qcow2 served from the build droplet).
2. `certutil -f -decode` of a 900-char-per-line base64 file **silently produced nothing on WS2019** (fine on WS2022).
   apply.ps1 now ships on the answer ISO (`cloudinit\apply.ps1`) and FirstLogonCommands `copy` it from the CD.
3. Guest→host "marker" HTTP pings under QEMU slirp never arrived on any edition. Don't rely on in-guest
   telemetry; verify the disk offline (ntfs-3g ro mount) after the guest shuts itself down.
4. `dd` of 32 GB through the page cache can evict bash/curl → the post-copy `report`/reboot hangs and Ubuntu stays up
   forever. Use `iflag=direct oflag=direct`, sysrq `s`+`u` first, then only builtins (`echo b > /proc/sysrq-trigger`).
   Rescue for a stuck droplet: DO `power_cycle` (worked for WS2025 on 2026-09-22).
5. `gd-2vcpu-8gb` is regularly out of stock in nyc3 → fallback chain of 50 GB-disk sizes read from `GET /v2/regions`.
   `gd-2vcpu-8gb-intel` has a 60 GB disk → NOT a valid fallback (snapshot min_disk would exceed the Starter tier).
6. The FastAPI proxy re-serializes JSON (`{"ok": true}` with a space) — never string-match `"ok":true` in shell.
7. Reseller API key for sandbox tests: see memory/test_credentials.md (`golden e2e sandbox key`).
8. **WS2025 (24H2 Setup) appends a WinRE recovery partition AFTER the Windows partition** even with a
   single-partition answer file. The offline verify used to mount the *last* partition (`tail -1`) → the
   700 MB recovery partition → "apply.ps1 MISSING / no Panther logs" (2 failed ws2025 builds, 2026-09-22).
   Fix: locate the OS partition by content (`Windows/System32`), then `sfdisk --delete` every trailing
   partition so C: stays last and apply.ps1's `Resize-Partition` can grow it on 50–320 GB customer disks.
   Layout is now echoed in the verify messages (`Layout: sda1 31.3G ntfs ...`).
