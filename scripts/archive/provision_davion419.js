#!/usr/bin/env node
/**
 * One-off operator action: provision davion419's two replacement VPS instances
 *
 * Configurations chosen (per operator confirmation, 2026-06-11):
 *   1. Linux  : V91 Cloud VPS 10 NVMe, US-East, Ubuntu 24.04 (image d64d5c6c-…)
 *               (V93 — his old Linux SKU — is no longer in the catalog, V91 is the
 *                closest entry-level replacement)
 *   2. Windows: V94 Cloud VPS 20 NVMe, US-East, Windows Server 2025 SE (RDP)
 *               (same productId & region he had on the deleted #203220843)
 *
 * Mimics the bot's `buyVPSPlanFullProcess` end-to-end EXCEPT:
 *   - no wallet debit (charged to operator / Contabo billing, not user wallet)
 *   - tags the vpsPlansOf record with `_operatorProvision: true` for audit
 *
 * Side effects:
 *   - 2× Contabo `createInstance` calls (real money on Contabo billing)
 *   - 2× `cancelInstance` (auto-cancel-on-create, matches bot default of autoRenewable=false)
 *   - 2× vpsPlansOf docs inserted via createVPSInstance
 *   - 1× state update for chatId 404562920 (userVPSDetails set to current list)
 *   - 2× Telegram messages to davion419 via PRODUCTION bot token
 *   - 1× audit log entry
 */
require('dotenv').config({ path: '/app/.env' })
const { MongoClient } = require('mongodb')

const CHAT_ID = '404562920'
const TG_USERNAME = 'davion419'
const PROD_TOKEN = process.env.TELEGRAM_BOT_TOKEN_PROD
if (!PROD_TOKEN) { console.error('TELEGRAM_BOT_TOKEN_PROD not set'); process.exit(1) }

async function sendTelegram(text) {
  const r = await fetch(`https://api.telegram.org/bot${PROD_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'HTML', disable_web_page_preview: true })
  })
  const j = await r.json()
  if (!j.ok) console.error('Telegram error:', j)
  return j
}

function fmtSpecs(p, isRDP) {
  const cpu = p.cpuCores
  const ram = (p.ramMb/1024).toFixed(0) + ' GB'
  const disk = (p.diskMb/1024).toFixed(0) + ' GB ' + (p.diskType||'').toUpperCase()
  return `${cpu} vCPU • ${ram} RAM • ${disk}` + (isRDP ? ' • Windows Server 2025' : ' • Ubuntu 24.04')
}

async function pollForIp(contabo, instanceId, maxAttempts = 12) {
  for (let i = 1; i <= maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 10000)) // 10s between polls
    try {
      const live = await contabo.getInstance(instanceId)
      const ip = live?.ipConfig?.v4?.ip
      const user = live?.defaultUser
      if (ip && ip !== '0.0.0.0' && ip !== 'provisioning...') {
        console.log(`  ✓ IP resolved on attempt ${i}: ${ip} (defaultUser=${user||'?'})`)
        return { ip, defaultUser: user, status: live.status }
      }
      console.log(`  … poll ${i}/${maxAttempts}: status=${live?.status}, ip=${ip||'-'}`)
    } catch (e) {
      console.log(`  … poll ${i}/${maxAttempts}: ${e.message}`)
    }
  }
  return null
}

;(async () => {
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`  Provisioning 2 VPS for @${TG_USERNAME} (chatId=${CHAT_ID})`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

  // Wire up the prod MongoDB
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db(process.env.DB_NAME)
  const vpsPlansOf = db.collection('vpsPlansOf')
  const stateCol = db.collection('state')
  const operatorAudit = db.collection('operatorAudit')

  // Initialize vm-instance-setup with the production DB so its internal _vpsPlansOf
  // reference points at production (NOT the dev pod's empty collection).
  const vmSetup = require('/app/js/vm-instance-setup.js')
  vmSetup.initVpsDb(db)
  const { createVPSInstance } = vmSetup
  const contabo = require('/app/js/contabo-service.js')

  // ─── 1) Linux: V91 Cloud VPS 10 NVMe US-East — Ubuntu 24.04 ───
  const v91 = contabo.getProduct('V91')
  const v91Price = contabo.calculatePrice(v91, 'US-east', false)
  console.log(`\n[1/2] LINUX  V91 US-east Ubuntu 24.04 → \$${v91Price.totalWithMarkup.toFixed(2)}/mo`)
  console.log(`      Specs: ${fmtSpecs(v91, false)}`)

  const linuxDetails = {
    config: { _id: 'V91', name: 'Cloud VPS 10', cpuCores: v91.cpuCores, ramMb: v91.ramMb, diskMb: v91.diskMb, diskType: 'nvme' },
    productId: 'V91',
    zone: 'US-east',
    region: 'US-east',
    country: '🇺🇸 US East',
    diskType: 'nvme',
    plan: 'Monthly',
    plantotalPrice: v91Price.totalWithMarkup,
    totalPrice: v91Price.totalWithMarkup,
    monthlyPrice: v91Price.totalWithMarkup,
    os: { id: 'd64d5c6c-9dda-4e38-8174-0ee282474d8a', name: 'Ubuntu 24.04', osType: 'Linux', isRDP: false, version: '24.04' },
    isRDP: false,
    osType: 'Linux',
  }
  const linuxRes = await createVPSInstance(CHAT_ID, linuxDetails)
  if (!linuxRes.success) {
    console.error(`❌ Linux provision FAILED: ${linuxRes.error}`)
    await operatorAudit.insertOne({ at: new Date(), op: 'provision_davion419', step: 'linux', status: 'failed', error: linuxRes.error })
    process.exit(2)
  }
  console.log(`✅ Linux Contabo instance ${linuxRes.data.contaboInstanceId} accepted`)

  console.log(`   Polling for IP…`)
  const linuxLive = await pollForIp(contabo, linuxRes.data.contaboInstanceId)
  if (linuxLive?.ip) {
    linuxRes.data.host = linuxLive.ip
    if (linuxLive.defaultUser) linuxRes.data.credentials.username = linuxLive.defaultUser
    await vpsPlansOf.updateOne(
      { contaboInstanceId: linuxRes.data.contaboInstanceId },
      { $set: { host: linuxLive.ip, defaultUser: linuxLive.defaultUser, status: linuxLive.status || 'provisioning' } }
    )
  }
  await vpsPlansOf.updateOne(
    { contaboInstanceId: linuxRes.data.contaboInstanceId },
    { $set: { _operatorProvision: true, _operatorReason: 'replace_v93_davion419_2026-06-11', _operatorAt: new Date() } }
  )

  // ─── 2) Windows RDP: V94 Cloud VPS 20 NVMe US-East — Windows Server 2025 ───
  const v94 = contabo.getProduct('V94')
  const v94Price = contabo.calculatePrice(v94, 'US-east', true)
  console.log(`\n[2/2] WINDOWS V94 US-east Windows Server 2025 RDP → \$${v94Price.totalWithMarkup.toFixed(2)}/mo`)
  console.log(`      Specs: ${fmtSpecs(v94, true)}`)

  const winDetails = {
    config: { _id: 'V94', name: 'Cloud VPS 20', cpuCores: v94.cpuCores, ramMb: v94.ramMb, diskMb: v94.diskMb, diskType: 'nvme' },
    productId: 'V94',
    zone: 'US-east',
    region: 'US-east',
    country: '🇺🇸 US East',
    diskType: 'nvme',
    plan: 'Monthly',
    plantotalPrice: v94Price.totalWithMarkup,
    totalPrice: v94Price.totalWithMarkup,
    monthlyPrice: v94Price.totalWithMarkup,
    os: { name: 'Windows Server 2025', osType: 'Windows', isRDP: true },
    isRDP: true,
    osType: 'Windows',
  }
  const winRes = await createVPSInstance(CHAT_ID, winDetails)
  if (!winRes.success) {
    console.error(`❌ Windows provision FAILED: ${winRes.error}`)
    await operatorAudit.insertOne({ at: new Date(), op: 'provision_davion419', step: 'windows', status: 'failed', error: winRes.error, linuxOk: linuxRes.data.contaboInstanceId })
    // Don't exit — Linux is already provisioned, still need to notify user about it
  } else {
    console.log(`✅ Windows Contabo instance ${winRes.data.contaboInstanceId} accepted`)
    console.log(`   Polling for IP…`)
    const winLive = await pollForIp(contabo, winRes.data.contaboInstanceId)
    if (winLive?.ip) {
      winRes.data.host = winLive.ip
      if (winLive.defaultUser) winRes.data.credentials.username = winLive.defaultUser
      await vpsPlansOf.updateOne(
        { contaboInstanceId: winRes.data.contaboInstanceId },
        { $set: { host: winLive.ip, defaultUser: winLive.defaultUser, status: winLive.status || 'provisioning' } }
      )
    }
    await vpsPlansOf.updateOne(
      { contaboInstanceId: winRes.data.contaboInstanceId },
      { $set: { _operatorProvision: true, _operatorReason: 'replace_v94_davion419_2026-06-11', _operatorAt: new Date() } }
    )
  }

  // ─── 3) Refresh state.userVPSDetails so the bot's UX shows them ───
  const allUserVps = await vpsPlansOf.find({ chatId: CHAT_ID, status: { $ne: 'DELETED' } }).toArray()
  const userVPSDetails = allUserVps.map(v => ({
    _id: String(v.contaboInstanceId),
    name: v.name,
    label: v.label,
    host: v.host,
    region: v.region,
    productId: v.productId,
    osType: v.osType,
    isRDP: v.isRDP,
    contaboInstanceId: v.contaboInstanceId,
    plan: v.plan,
    planPrice: v.planPrice,
    start_time: v.start_time,
    end_time: v.end_time,
    autoRenewable: v.autoRenewable || false,
    subscription: { subscriptionEnd: v.end_time },
  }))
  await stateCol.updateOne(
    { _id: CHAT_ID },
    { $set: { userVPSDetails, action: 'none', lastUpdated: new Date(), processingPayment: false }, $unset: { vpsDetails: '' } }
  )
  console.log(`\n📝 state.userVPSDetails updated with ${userVPSDetails.length} VPS records`)

  // ─── 4) Telegram notification to davion419 via PROD bot ───
  console.log(`\n📨 Sending Telegram notification via prod bot…`)
  const linuxBlock = `<b>🐧 Linux VPS — Cloud VPS 10 NVMe (US-East)</b>
🖥 IP: <code>${linuxRes.data.host || 'provisioning…'}</code>
👤 Username: <code>${linuxRes.data.credentials.username}</code>
🔐 Password: <code>${linuxRes.data.credentials.password}</code>
📦 Specs: ${fmtSpecs(v91, false)}
🆔 Instance ID: <code>${linuxRes.data.contaboInstanceId}</code>`

  const winBlock = winRes.success ? `<b>🪟 Windows VPS — Cloud VPS 20 NVMe RDP (US-East)</b>
🖥 IP: <code>${winRes.data.host || 'provisioning…'}</code>
👤 Username: <code>${winRes.data.credentials.username}</code>
🔐 Password: <code>${winRes.data.credentials.password}</code>
📦 Specs: ${fmtSpecs(v94, true)}
🆔 Instance ID: <code>${winRes.data.contaboInstanceId}</code>` : `<b>🪟 Windows VPS provision FAILED</b> — support has been notified.`

  const msg = `🎉 <b>Your VPS instances are ready!</b>

We've reprovisioned 2 servers on your account at no cost — they replace the ones that recently expired.

${linuxBlock}

${winBlock}

💡 <i>If the IP shows "provisioning…" please give it 2-3 minutes — it will appear in your VPS list shortly.</i>

🔒 Save these credentials now and rotate the passwords once you log in. We don't keep a copy you can retrieve later.

Type /vps to see them in the bot anytime.`

  await sendTelegram(msg)

  // ─── 5) Audit log ───
  await operatorAudit.insertOne({
    at: new Date(),
    op: 'provision_davion419',
    chatId: CHAT_ID,
    linux: linuxRes.success ? { instanceId: linuxRes.data.contaboInstanceId, host: linuxRes.data.host, productId: 'V91', region: 'US-east', priceMo: v91Price.totalWithMarkup } : null,
    windows: winRes.success ? { instanceId: winRes.data.contaboInstanceId, host: winRes.data.host, productId: 'V94', region: 'US-east', priceMo: v94Price.totalWithMarkup, isRDP: true } : { error: winRes.error },
    walletDebited: false,
    note: 'Operator one-off — replaces deleted V94 #203220843 and stopped/cancelled V93 #203228089'
  })

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`  DONE`)
  console.log(`  Linux  : ${linuxRes.success ? `#${linuxRes.data.contaboInstanceId}  ip=${linuxRes.data.host}` : 'FAILED'}`)
  console.log(`  Windows: ${winRes.success ? `#${winRes.data.contaboInstanceId}  ip=${winRes.data.host}` : 'FAILED'}`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  await client.close()
  process.exit(0)
})().catch(e => { console.error('FATAL:', e); process.exit(99) })
