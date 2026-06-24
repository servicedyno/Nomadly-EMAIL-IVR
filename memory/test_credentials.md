# Test Credentials

## Persistent E2E Test VMs (provisioned 2026-06-24)

### 🟢 DigitalOcean — Linux VPS (Cloud VPS 10)
- **instanceId**: `do-579957871`
- **Provider**: DigitalOcean (Frankfurt / fra1)
- **Specs**: 1 vCPU / 1 GB RAM / 25 GB SSD
- **OS**: Ubuntu 24.04 LTS
- **IP**: `104.248.38.55`
- **SSH**: `ssh root@104.248.38.55`
- **Username**: `root`
- **Original password**: `AyUIrf00hW2g2eD7CpBGAa1!`
- **Note**: Password was rotated during lifecycle tests. Latest set by lifecycle script — check `/tmp/lifecycle2.log` for the most recent value, or re-run resetPassword.
- **Cost**: ~$0.21/day while running
- **To deprovision**: `node -e "require('/app/js/digitalocean-service').cancelInstance('do-579957871').then(r=>console.log(r))"`

### 🟢 Azure — Windows RDP (Standard_D2s_v6)
- **instanceId**: `az-nmda6ebb8575`
- **Provider**: Azure (westeurope)
- **Specs**: 2 vCPU / 8 GB RAM / 127 GB Premium SSD
- **OS**: Windows Server 2022 Datacenter (Gen2)
- **IP**: `20.73.174.102`
- **RDP**: `mstsc /v:20.73.174.102`
- **Username**: `e2erdptest`
- **Original password**: `BLV7QgBjaR6%mU)mm6Vz`
- **Note**: Password was rotated during lifecycle tests. Latest set by lifecycle script — check `/tmp/lifecycle2.log` for the most recent value, or re-run resetPassword via Azure VMAccessAgent.
- **Cost**: ~$3.96/day while running
- **To deprovision**: `node -e "require('/app/js/azure-service').cancelInstance('az-nmda6ebb8575').then(r=>console.log(r))"`

## Lifecycle Operations — Verified Working (both providers)
- ✅ getInstance (read status)
- ✅ stopInstance (power off)
- ✅ startInstance (power on)
- ✅ restartInstance (graceful reboot)
- ✅ resetPassword (new password via provider API)
- ✅ updateInstanceName (rename label)
- ✅ createSnapshot / listSnapshots / deleteSnapshot
- ✅ listRegions / listProducts

## Provider Routing (current production config)
- **VPS_DEFAULT_PROVIDER**: `digitalocean` (Linux / VPS purchases)
- **VPS_RDP_PROVIDER**: `azure` (Windows / RDP purchases)
- Existing Vultr/Contabo instances continue working via per-record routing.
