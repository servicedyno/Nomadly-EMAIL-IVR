# CloudInitApply - baked into the Windows image by autounattend FirstLogonCommands
# and run at every boot (scheduled task CloudInitApply, SYSTEM).
#   1. Networking: DigitalOcean serves NO DHCP to droplets. Windows can reach the
#      metadata service link-local, so we give each NIC a temporary 169.254.x.x,
#      read http://169.254.169.254/metadata/v1.json and apply the static public /
#      private addresses + DNS it describes (idempotent, re-checked every boot).
#   2. RDP + firewall on, C: grown to the full disk, autologon secrets removed.
#   3. Per-order Administrator password + callback from KEY=VALUE user-data
#      (http://169.254.169.254/metadata/v1/user-data). Refreshes itself from the
#      backend's /provision/bootscript first, so fixes don't need a new golden image.
#   4. Management agent: registers itself as the CloudInitAgent task (every minute,
#      `apply.ps1 -Agent`) that polls the backend for commands (set_password, reboot)
#      so password resets / reinstalls work in place without touching the disk.
$ErrorActionPreference = "SilentlyContinue"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
New-Item -ItemType Directory -Path "C:\cloudinit" -Force | Out-Null
$logFile = "C:\cloudinit\apply.log"
$cfgFile = "C:\cloudinit\cfg.json"
function Log($m) { Add-Content -Path $logFile -Value ("{0} {1}" -f (Get-Date -Format s), $m) }

function Read-UserDataCfg {
    $cfg = @{}
    $data = ""
    try { $data = [string](Invoke-WebRequest -UseBasicParsing -Uri "http://169.254.169.254/metadata/v1/user-data" -TimeoutSec 8).Content } catch {}
    foreach ($line in ($data -split "`n")) { $line = $line.Trim(); if ($line -match '^([A-Z_]+)=(.*)$') { $cfg[$matches[1]] = $matches[2] } }
    return $cfg
}
function Set-AdminPassword($pw) {
    try { $u = [ADSI]"WinNT://./Administrator,user"; $u.SetPassword([string]$pw); $u.SetInfo(); return @{ ok = $true; msg = 'password applied (ADSI)' } }
    catch { $err = ($_.Exception.Message -replace '\s+', ' ') }
    try { & net user Administrator ([string]$pw) /y | Out-Null; if ($LASTEXITCODE -eq 0) { return @{ ok = $true; msg = 'password applied (net user)' } } } catch {}
    return @{ ok = $false; msg = "SetPassword failed: $err" }
}
# One agent pass: fetch pending commands for this server, execute, report back. Silent when idle.
function Invoke-AgentPoll($cfg) {
    if (-not $cfg["CALLBACK_URL"] -or -not $cfg["SERVER_ID"] -or -not $cfg["CALLBACK_TOKEN"]) { return }
    $api = ($cfg["CALLBACK_URL"] -replace '/callback/?$', '')
    $resp = $null
    try { $resp = Invoke-RestMethod -UseBasicParsing -Uri "$api/commands?server_id=$($cfg['SERVER_ID'])&token=$($cfg['CALLBACK_TOKEN'])" -TimeoutSec 15 } catch { Log "agent: poll failed: $($_.Exception.Message)"; Clear-DnsClientCache; return }
    foreach ($c in @($resp.commands)) {
        if (-not $c -or -not $c.id) { continue }
        $ok = $false; $msg = ''
        if ($c.type -eq 'set_password') { $r = Set-AdminPassword ([string]$c.payload.password); $ok = $r.ok; $msg = $r.msg }
        elseif ($c.type -eq 'reboot') { $ok = $true; $msg = 'rebooting' }
        else { $msg = "unknown command type $($c.type)" }
        Log "agent: command $($c.id) $($c.type) -> ok=$ok $msg"
        $body = @{ server_id = $cfg["SERVER_ID"]; token = $cfg["CALLBACK_TOKEN"]; id = $c.id; ok = $ok; message = $msg } | ConvertTo-Json -Compress
        try { Invoke-RestMethod -UseBasicParsing -Uri "$api/commands/result" -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 15 | Out-Null } catch { Log "agent: result post failed: $($_.Exception.Message)" }
        if ($c.type -eq 'reboot' -and $ok) { & shutdown /r /t 5 /f }
    }
}
function Register-AgentTask {
    try {
        $act = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File `"C:\cloudinit\apply.ps1`" -Agent"
        $trig = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1)
        $set = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 5) -MultipleInstances IgnoreNew -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
        Register-ScheduledTask -TaskName 'CloudInitAgent' -Action $act -Trigger $trig -Settings $set -User 'SYSTEM' -RunLevel Highest -Force | Out-Null
        Log "agent task CloudInitAgent registered (every minute)"
    } catch { Log "agent task registration failed: $($_.Exception.Message)" }
}

# ---- agent mode: `apply.ps1 -Agent` (scheduled every minute) ----
if ($args -contains '-Agent') {
    $cfg = @{}
    if (Test-Path $cfgFile) { try { $j = Get-Content $cfgFile -Raw | ConvertFrom-Json; foreach ($p in $j.PSObject.Properties) { $cfg[$p.Name] = [string]$p.Value } } catch {} }
    if (-not $cfg["CALLBACK_URL"]) { $cfg = Read-UserDataCfg }
    Invoke-AgentPoll $cfg
    exit
}
Log "---- CloudInitApply start ----"

$mdUrl = "http://169.254.169.254/metadata/v1.json"
function Get-Metadata { try { return (Invoke-WebRequest -UseBasicParsing -Uri $mdUrl -TimeoutSec 8).Content | ConvertFrom-Json } catch { return $null } }
function Mask2Prefix($mask) { $b = 0; foreach ($o in $mask.Split('.')) { $v = [int]$o; while ($v -gt 0) { $b += ($v -band 1); $v = $v -shr 1 } }; return $b }
function Get-Nics { Get-NetAdapter | Where-Object { $_.Status -eq 'Up' -and $_.InterfaceDescription -notmatch 'Loopback|Tunnel|isatap|Teredo|Bluetooth' } | Sort-Object ifIndex }

# ---- 1. reach the metadata service ----
$meta = Get-Metadata
$attempt = 0
while (-not $meta -and $attempt -lt 30) {
    $attempt++
    foreach ($a in (Get-Nics)) {
        # Temporary link-local address + explicit /32 on-link route on THIS NIC only.
        if (-not (Get-NetIPAddress -InterfaceIndex $a.ifIndex -AddressFamily IPv4 | Where-Object { $_.IPAddress -eq '169.254.200.10' })) {
            New-NetIPAddress -InterfaceIndex $a.ifIndex -IPAddress 169.254.200.10 -PrefixLength 16 -PolicyStore ActiveStore | Out-Null
        }
        Get-NetRoute -DestinationPrefix '169.254.169.254/32' | Remove-NetRoute -Confirm:$false
        New-NetRoute -DestinationPrefix '169.254.169.254/32' -InterfaceIndex $a.ifIndex -NextHop 0.0.0.0 -PolicyStore ActiveStore | Out-Null
        Start-Sleep -Seconds 2
        $meta = Get-Metadata
        if ($meta) { Log "metadata reached link-local via $($a.Name) ($($a.MacAddress))"; break }
        Remove-NetIPAddress -InterfaceIndex $a.ifIndex -IPAddress 169.254.200.10 -Confirm:$false
    }
    if (-not $meta) { Start-Sleep -Seconds 5 }
}
Get-NetRoute -DestinationPrefix '169.254.169.254/32' | Where-Object { $_.NextHop -eq '0.0.0.0' } | Remove-NetRoute -Confirm:$false
Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -eq '169.254.200.10' } | Remove-NetIPAddress -Confirm:$false

# ---- 2. static addressing from metadata (idempotent) ----
if ($meta) {
    # Public resolvers FIRST: the VPC resolver DO lists in metadata (10.x) timed out for minutes after boot on
    # real droplets, which made every callback fail with "remote name could not be resolved".
    $dns = @('67.207.67.2', '67.207.67.3', '1.1.1.1') + @(@($meta.dns.nameservers) | Where-Object { $_ -and $_ -notmatch '^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)' })
    $dns = @($dns | Select-Object -Unique)
    $ifaces = @()
    foreach ($n in @($meta.interfaces.public))  { if ($n) { $ifaces += @{ n = $n; public = $true } } }
    foreach ($n in @($meta.interfaces.private)) { if ($n) { $ifaces += @{ n = $n; public = $false } } }
    foreach ($e in $ifaces) {
        $n = $e.n
        if (-not $n.mac -or -not $n.ipv4) { continue }
        $mac = ($n.mac -replace '[:-]', '').ToUpper()
        $ad = Get-NetAdapter | Where-Object { ($_.MacAddress -replace '[:-]', '').ToUpper() -eq $mac } | Select-Object -First 1
        if (-not $ad) { Log "no adapter for mac $mac"; continue }
        $ip = $n.ipv4.ip_address; $plen = Mask2Prefix $n.ipv4.netmask; $gw = $n.ipv4.gateway
        $have = Get-NetIPAddress -InterfaceIndex $ad.ifIndex -AddressFamily IPv4 | Where-Object { $_.IPAddress -eq $ip -and $_.PrefixLength -eq $plen }
        if (-not $have) {
            Log "configure $($ad.Name) [$mac] -> $ip/$plen gw=$gw public=$($e.public)"
            Set-NetIPInterface -InterfaceIndex $ad.ifIndex -Dhcp Disabled
            Get-NetIPAddress -InterfaceIndex $ad.ifIndex -AddressFamily IPv4 | Remove-NetIPAddress -Confirm:$false
            Get-NetRoute -InterfaceIndex $ad.ifIndex -AddressFamily IPv4 -DestinationPrefix '0.0.0.0/0' | Remove-NetRoute -Confirm:$false
            if ($e.public -and $gw) { New-NetIPAddress -InterfaceIndex $ad.ifIndex -IPAddress $ip -PrefixLength $plen -DefaultGateway $gw | Out-Null }
            else { New-NetIPAddress -InterfaceIndex $ad.ifIndex -IPAddress $ip -PrefixLength $plen | Out-Null }
        }
        if ($e.public) {
            Set-DnsClientServerAddress -InterfaceIndex $ad.ifIndex -ServerAddresses $dns
            if ($gw -and -not (Get-NetRoute -DestinationPrefix '169.254.169.254/32' -InterfaceIndex $ad.ifIndex)) {
                New-NetRoute -DestinationPrefix '169.254.169.254/32' -InterfaceIndex $ad.ifIndex -NextHop $gw | Out-Null
            }
        }
    }
} else { Log "metadata unreachable - leaving network as is" }

# ---- 2b. per-order settings: KEY=VALUE user-data (separate endpoint - v1.json has no user_data) ----
$cfg = @{}
if ($meta) { $cfg = Read-UserDataCfg }
Log "user-data keys: $($cfg.Keys -join ',')"
if ($cfg["CALLBACK_URL"]) { try { $cfg | ConvertTo-Json -Compress | Set-Content -Path $cfgFile } catch {} }

# ---- 2c. self-update: fetch the current apply.ps1 from the backend so boot logic can be fixed
# without rebuilding the golden image (backend serves it at <callback base>/bootscript). ----
if ($cfg["CALLBACK_URL"] -and -not ($args -contains '-NoRefresh')) {
    $bsUrl = ($cfg["CALLBACK_URL"] -replace '/callback/?$', '/bootscript')
    for ($k = 0; $k -lt 3; $k++) {
        try {
            $fresh = [string](Invoke-WebRequest -UseBasicParsing -Uri $bsUrl -TimeoutSec 15).Content
            $me = [IO.File]::ReadAllText($MyInvocation.MyCommand.Path)
            if ($fresh.Length -gt 1000 -and $fresh -match 'CloudInitApply' -and $fresh -ne $me) {
                [IO.File]::WriteAllText("C:\cloudinit\apply.ps1", $fresh)
                Log "apply.ps1 refreshed from $bsUrl ($($fresh.Length) bytes) - re-running"
                & powershell -ExecutionPolicy Bypass -NoProfile -File "C:\cloudinit\apply.ps1" -NoRefresh
                exit
            }
            break
        } catch { Log "bootscript refresh attempt $k failed: $($_.Exception.Message)"; Clear-DnsClientCache; Start-Sleep -Seconds 5 }
    }
}

# ---- 3. RDP, firewall, disk, autologon hygiene ----
reg add "HKLM\SYSTEM\CurrentControlSet\Control\Terminal Server" /v fDenyTSConnections /t REG_DWORD /d 0 /f | Out-Null
reg add "HKLM\SYSTEM\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp" /v UserAuthentication /t REG_DWORD /d 1 /f | Out-Null
netsh advfirewall firewall set rule group="remote desktop" new enable=Yes | Out-Null
Set-Service TermService -StartupType Automatic; Start-Service TermService
try {
    Update-HostStorageCache
    $part = Get-Partition -DriveLetter C
    $max = (Get-PartitionSupportedSize -DriveLetter C).SizeMax
    if ($max -gt ($part.Size + 512MB)) { Resize-Partition -DriveLetter C -Size $max; Log "C: grown to $([math]::Round($max/1GB)) GB" }
} catch {}
$wl = "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon"
reg add $wl /v AutoAdminLogon /t REG_SZ /d 0 /f | Out-Null
reg delete $wl /v DefaultPassword /f | Out-Null
reg delete $wl /v AutoLogonCount /f | Out-Null

# ---- 4. per-order password + callback ----
$sid = $cfg["SERVER_ID"]
$marker = "C:\cloudinit\applied.txt"
$already = (Test-Path $marker) -and ((Get-Content $marker -ErrorAction SilentlyContinue) -eq $sid)
if ($cfg["ADMIN_PASSWORD"] -and $sid -and -not $already) {
    $pw = [string]$cfg["ADMIN_PASSWORD"]
    $set = $false
    for ($i = 0; $i -lt 6 -and -not $set; $i++) {
        $r = Set-AdminPassword $pw
        $set = $r.ok
        if ($set) { Log "Administrator $($r.msg) for $sid" } else { Log "attempt $i - $($r.msg)"; Start-Sleep -Seconds 10 }
    }
    if ($set) { Set-Content -Path $marker -Value $sid }
    if ($cfg["CALLBACK_URL"] -and $cfg["CALLBACK_TOKEN"]) {
        $msg = if ($set) { "Windows booted from golden image; network + password applied; RDP ready" } else { "Windows booted from golden image; network applied but the password could NOT be set" }
        $body = @{ server_id = $sid; token = $cfg["CALLBACK_TOKEN"]; stage = $(if ($set) { "rdp_ready" } else { "password_failed" }); progress = $(if ($set) { 100 } else { 90 }); message = $msg } | ConvertTo-Json -Compress
        for ($j = 0; $j -lt 20; $j++) {
            try { Invoke-RestMethod -UseBasicParsing -Uri $cfg["CALLBACK_URL"] -Method Post -ContentType "application/json" -Body $body; Log "callback sent"; break } catch { Log "callback attempt $j failed: $($_.Exception.Message)"; Clear-DnsClientCache }
            Start-Sleep -Seconds 10
        }
    }
}

# ---- 5. management agent: every-minute task + one immediate pass (picks up a password queued for a reinstall) ----
if ($cfg["CALLBACK_URL"] -and $sid) {
    Register-AgentTask
    Invoke-AgentPoll $cfg
}
Log "---- CloudInitApply done ----"
