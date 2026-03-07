/**
 * One-time setup: Configure DNS records for initial 2 domains
 * and set up DKIM on the VPS
 * Run: node /app/scripts/setup-email-domains.js
 */

require('dotenv').config({ path: '/app/backend/.env' })
const emailDns = require('../js/email-dns.js')
const crypto = require('crypto')
const { exec } = require('child_process')

const VPS_HOST = '5.189.166.127'
const DKIM_SELECTOR = 'mail2025'
const DOMAINS = ['tracking-assist.com', 'efirstportal.com']

async function configureDkimOnVps(domain, selector, privateKeyPem) {
  const keyDir = `/etc/opendkim/keys/${domain}`
  const keyFile = `${keyDir}/${selector}.private`

  const commands = [
    `mkdir -p ${keyDir}`,
    `cat > ${keyFile} << 'KEYEOF'\n${privateKeyPem}\nKEYEOF`,
    `chown opendkim:opendkim ${keyFile}`,
    `chmod 600 ${keyFile}`,
    `grep -q '${domain}' /etc/opendkim/key.table || echo '${selector}._domainkey.${domain} ${domain}:${selector}:${keyFile}' >> /etc/opendkim/key.table`,
    `grep -q '${domain}' /etc/opendkim/signing.table || echo '*@${domain} ${selector}._domainkey.${domain}' >> /etc/opendkim/signing.table`,
    `grep -q '${domain}' /etc/opendkim/trusted.hosts || echo '*.${domain}' >> /etc/opendkim/trusted.hosts`,
    `systemctl reload opendkim 2>/dev/null || systemctl restart opendkim`
  ].join(' && ')

  return new Promise((resolve) => {
    exec(`sshpass -p 'Onlygod123@' ssh -o StrictHostKeyChecking=no root@${VPS_HOST} '${commands}'`,
      { timeout: 20000 },
      (err, stdout, stderr) => {
        if (err) {
          console.log(`  ❌ DKIM VPS config error for ${domain}:`, err.message)
          resolve(false)
        } else {
          console.log(`  ✅ DKIM configured on VPS for ${domain}`)
          resolve(true)
        }
      }
    )
  })
}

async function setup() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🚀 Setting up Email Blast Domains')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const allIps = [VPS_HOST]

  for (const domain of DOMAINS) {
    console.log(`\n📧 Setting up ${domain}...`)

    // Generate DKIM keys
    console.log('  🔑 Generating DKIM keys...')
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    })

    const pubRaw = publicKey
      .replace(/-----BEGIN PUBLIC KEY-----/, '')
      .replace(/-----END PUBLIC KEY-----/, '')
      .replace(/\n/g, '')
      .trim()

    console.log(`  ✅ DKIM keys generated (2048-bit, selector: ${DKIM_SELECTOR})`)

    // Setup DNS records via Cloudflare
    console.log('  🌐 Creating DNS records via Cloudflare...')
    const dnsResult = await emailDns.setupDomainDns(domain, VPS_HOST, DKIM_SELECTOR, pubRaw, allIps)

    if (dnsResult.success) {
      console.log(`  ✅ Zone ID: ${dnsResult.zoneId}`)
      for (const [key, val] of Object.entries(dnsResult.results)) {
        console.log(`  ✅ ${key}: ${val.action} (${val.success ? 'OK' : 'FAIL'})`)
      }
    } else {
      console.log(`  ❌ DNS setup failed: ${dnsResult.error}`)
      continue
    }

    // Configure DKIM on VPS
    console.log('  🔧 Configuring OpenDKIM on VPS...')
    await configureDkimOnVps(domain, DKIM_SELECTOR, privateKey)

    // Save domain to MongoDB
    console.log('  💾 Saving domain config to MongoDB...')
    const { MongoClient } = require('mongodb')
    const client = new MongoClient(process.env.MONGO_URL)
    await client.connect()
    const db = client.db(process.env.DB_NAME || 'test')

    await db.collection('emailDomains').updateOne(
      { domain },
      { $set: {
        domain,
        cloudflareZoneId: dnsResult.zoneId,
        dkimSelector: DKIM_SELECTOR,
        dkimPrivateKey: privateKey,
        dkimPublicKey: pubRaw,
        assignedIps: [VPS_HOST],
        isActive: true,
        addedBy: process.env.TELEGRAM_ADMIN_CHAT_ID,
        addedAt: new Date(),
        totalSent: 0,
        totalBounced: 0,
        bounceRate: 0
      }},
      { upsert: true }
    )
    console.log(`  ✅ Domain ${domain} saved to MongoDB`)

    // Start warming for the primary IP (if not already started)
    const warmingExists = await db.collection('emailIpWarming').findOne({ ip: VPS_HOST })
    if (!warmingExists) {
      await db.collection('emailIpWarming').insertOne({
        ip: VPS_HOST,
        domain: DOMAINS[0], // primary domain
        startDate: new Date(),
        currentDay: 1,
        stage: 'seed',
        dailyLimit: 20,
        hourlyLimit: 5,
        dailySent: 0,
        hourlySent: 0,
        hourlyResetAt: new Date(),
        totalSent: 0,
        totalBounced: 0,
        bounceRate: 0,
        isWarm: false,
        isPaused: false,
        graduatedAt: null,
        history: []
      })
      console.log(`  ✅ IP warming started for ${VPS_HOST}`)
    } else {
      console.log(`  ℹ️ IP warming already exists for ${VPS_HOST}`)
    }

    // Save default settings
    const settingsExists = await db.collection('emailSettings').findOne({ settingKey: 'email_blast' })
    if (!settingsExists) {
      await db.collection('emailSettings').insertOne({
        settingKey: 'email_blast',
        pricePerEmail: 0.10,
        minEmails: 500,
        maxEmails: 5000,
        globalRatePerMin: 25,
        batchSize: 10,
        maxRetries: 3,
        bounceRateThreshold: 5,
        warmingEnabled: true,
        updatedAt: new Date()
      })
      console.log('  ✅ Default settings saved')
    }

    await client.close()
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🎉 Email Blast Domain Setup Complete!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('\n⚠️ MANUAL STEP: Set rDNS/PTR in Contabo panel:')
  console.log(`   ${VPS_HOST} → mail.tracking-assist.com`)
}

setup().catch(console.error)
