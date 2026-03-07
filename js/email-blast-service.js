/**
 * Email Blast Service — Core sending engine
 * Handles: campaign CRUD, queue processing, Nodemailer + DKIM, domain/IP rotation,
 * bounce handling, throttling, suppression list, progress notifications
 */

const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const emailWarming = require('./email-warming');
const emailDns = require('./email-dns');

let _db = null;
let _bot = null;
let _campaignsCol = null;
let _domainsCol = null;
let _suppressionsCol = null;
let _settingsCol = null;
let _queueInterval = null;
let _transporters = {}; // keyed by ip

const SMTP_USER = 'nomadlybot@mail.tracking-assist.com';
const SMTP_PASS = 'N0m4dly_Bl4st_2025!';
const VPS_HOST  = '5.189.166.127';
const DKIM_SELECTOR = 'mail2025';

const DEFAULT_SETTINGS = {
  settingKey: 'email_blast',
  pricePerEmail: 0.10,
  minEmails: 500,
  maxEmails: 5000,
  globalRatePerMin: 25,
  batchSize: 10,
  maxRetries: 3,
  bounceRateThreshold: 5,
  warmingEnabled: true
};

// ─── Initialization ─────────────────────────────────────

async function initEmailBlast(db, bot) {
  _db = db;
  _bot = bot;
  _campaignsCol = db.collection('emailCampaigns');
  _domainsCol = db.collection('emailDomains');
  _suppressionsCol = db.collection('emailSuppressions');
  _settingsCol = db.collection('emailSettings');

  // Ensure indexes
  await _campaignsCol.createIndex({ chatId: 1, status: 1 });
  await _campaignsCol.createIndex({ status: 1 });
  await _suppressionsCol.createIndex({ email: 1 }, { unique: true });
  await _domainsCol.createIndex({ domain: 1 }, { unique: true });

  // Init warming
  emailWarming.initWarming(db, bot);

  // Ensure default settings exist
  const existing = await _settingsCol.findOne({ settingKey: 'email_blast' });
  if (!existing) {
    await _settingsCol.insertOne({ ...DEFAULT_SETTINGS, updatedAt: new Date() });
  }

  // Start queue processor (every 30 seconds)
  _queueInterval = setInterval(processQueue, 30 * 1000);

  console.log('[EmailBlast] Service initialized — queue processor running every 30s');
}

// ─── Settings ───────────────────────────────────────────

async function getSettings() {
  return (await _settingsCol.findOne({ settingKey: 'email_blast' })) || DEFAULT_SETTINGS;
}

async function updateSettings(updates) {
  await _settingsCol.updateOne(
    { settingKey: 'email_blast' },
    { $set: { ...updates, updatedAt: new Date() } },
    { upsert: true }
  );
}

// ─── Domain Management ──────────────────────────────────

async function addDomain(domain, addedBy) {
  // Check if domain already exists
  const existing = await _domainsCol.findOne({ domain });
  if (existing) return { success: false, error: 'Domain already exists' };

  // Generate DKIM key pair
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  const pubRaw = publicKey
    .replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replace(/\n/g, '')
    .trim();

  // Get all active IPs for SPF
  const allIps = await getAllActiveIps();

  // Setup DNS via Cloudflare
  const dnsResult = await emailDns.setupDomainDns(domain, VPS_HOST, DKIM_SELECTOR, pubRaw, allIps);
  if (!dnsResult.success) {
    return { success: false, error: dnsResult.error };
  }

  // Store domain config
  const doc = {
    domain,
    cloudflareZoneId: dnsResult.zoneId,
    dkimSelector: DKIM_SELECTOR,
    dkimPrivateKey: privateKey,
    dkimPublicKey: pubRaw,
    assignedIps: [VPS_HOST],
    isActive: true,
    addedBy,
    addedAt: new Date(),
    totalSent: 0,
    totalBounced: 0,
    bounceRate: 0
  };

  await _domainsCol.insertOne(doc);

  // Configure OpenDKIM on VPS for this domain
  await configureDkimOnVps(domain, DKIM_SELECTOR, privateKey);

  return { success: true, domain, dnsResult };
}

async function removeDomain(domain) {
  const doc = await _domainsCol.findOne({ domain });
  if (!doc) return { success: false, error: 'Domain not found' };

  // Remove DNS records
  await emailDns.removeDomainDns(domain, doc.dkimSelector);

  // Remove from DB
  await _domainsCol.deleteOne({ domain });
  return { success: true };
}

async function getDomains() {
  return _domainsCol.find({}).toArray();
}

async function getActiveDomains() {
  return _domainsCol.find({ isActive: true }).toArray();
}

async function getAllActiveIps() {
  const warming = await emailWarming.getAllWarming();
  const ips = warming.map(w => w.ip);
  if (!ips.includes(VPS_HOST)) ips.push(VPS_HOST);
  return ips;
}

/**
 * Configure OpenDKIM on VPS for a domain (via SSH command execution)
 * Uses base64 encoding for key transfer to avoid heredoc/quoting corruption.
 */
async function configureDkimOnVps(domain, selector, privateKeyPem) {
  const { exec } = require('child_process');
  const keyDir = `/etc/opendkim/keys/${domain}`;
  const keyFile = `${keyDir}/${selector}.private`;

  // Base64-encode the PEM key to safely transfer over SSH (avoids heredoc issues)
  const keyB64 = Buffer.from(privateKeyPem).toString('base64');

  const commands = [
    `mkdir -p ${keyDir}`,
    // Deploy key via base64 decode (safe against quoting corruption)
    `echo '${keyB64}' | base64 -d > ${keyFile}`,
    `chown opendkim:opendkim ${keyFile}`,
    `chmod 600 ${keyFile}`,
    // Append to key.table if not already there
    `grep -q '${domain}' /etc/opendkim/key.table || echo '${selector}._domainkey.${domain} ${domain}:${selector}:${keyFile}' >> /etc/opendkim/key.table`,
    // Append to signing.table if not already there
    `grep -q '${domain}' /etc/opendkim/signing.table || echo '*@${domain} ${selector}._domainkey.${domain}' >> /etc/opendkim/signing.table`,
    // Append to trusted.hosts if not already there
    `grep -q '${domain}' /etc/opendkim/trusted.hosts || echo '*.${domain}' >> /etc/opendkim/trusted.hosts`,
    // Reload opendkim
    `systemctl reload opendkim 2>/dev/null || systemctl restart opendkim`
  ].join(' && ');

  return new Promise((resolve) => {
    exec(`sshpass -p 'Onlygod123@' ssh -o StrictHostKeyChecking=no root@${VPS_HOST} "${commands}"`,
      { timeout: 15000 },
      (err, stdout, stderr) => {
        if (err) {
          console.log(`[EmailBlast] DKIM VPS config error for ${domain}:`, err.message);
          resolve(false);
        } else {
          console.log(`[EmailBlast] DKIM configured on VPS for ${domain}`);
          resolve(true);
        }
      }
    );
  });
}

// ─── Nodemailer Transporters ────────────────────────────

function getTransporter(ip) {
  if (!_transporters[ip]) {
    _transporters[ip] = nodemailer.createTransport({
      host: VPS_HOST,
      port: 587,
      secure: false,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      },
      tls: { rejectUnauthorized: false },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      localAddress: undefined // For future: bind to specific local IP if needed
    });
  }
  return _transporters[ip];
}

// ─── Campaign Management ────────────────────────────────

async function createCampaign(chatId, emails, subject, bodyHtml, bodyText, fromName) {
  const settings = await getSettings();
  const campaignId = uuidv4();

  const doc = {
    campaignId,
    chatId,
    status: 'pending_payment',
    emails,
    totalEmails: emails.length,
    sentCount: 0,
    deliveredCount: 0,
    bouncedCount: 0,
    failedCount: 0,
    subject,
    bodyHtml,
    bodyText: bodyText || '',
    fromName: fromName || 'Nomadly',
    pricePerEmail: settings.pricePerEmail,
    totalPrice: parseFloat((emails.length * settings.pricePerEmail).toFixed(2)),
    paymentMethod: null,
    paymentCoin: null,
    createdAt: new Date(),
    startedAt: null,
    completedAt: null,
    lastProgressUpdate: null,
    currentBatchIndex: 0
  };

  await _campaignsCol.insertOne(doc);
  return doc;
}

async function getCampaign(campaignId) {
  return _campaignsCol.findOne({ campaignId });
}

async function getUserCampaigns(chatId) {
  return _campaignsCol.find({ chatId }).sort({ createdAt: -1 }).limit(10).toArray();
}

async function startCampaign(campaignId, paymentMethod, paymentCoin) {
  await _campaignsCol.updateOne({ campaignId }, {
    $set: {
      status: 'queued',
      paymentMethod,
      paymentCoin,
      startedAt: new Date()
    }
  });
}

async function pauseCampaign(campaignId) {
  await _campaignsCol.updateOne({ campaignId }, { $set: { status: 'paused' } });
}

async function resumeCampaign(campaignId) {
  await _campaignsCol.updateOne({ campaignId }, { $set: { status: 'queued' } });
}

async function cancelCampaign(campaignId) {
  await _campaignsCol.updateOne({ campaignId }, { $set: { status: 'cancelled' } });
}

// ─── Queue Processor ────────────────────────────────────

let _processing = false;

async function processQueue() {
  if (_processing) return;
  _processing = true;

  try {
    const settings = await getSettings();

    // Find campaigns that need sending
    const campaigns = await _campaignsCol.find({
      status: { $in: ['queued', 'sending'] }
    }).toArray();

    for (const campaign of campaigns) {
      if (campaign.status === 'queued') {
        await _campaignsCol.updateOne({ campaignId: campaign.campaignId }, { $set: { status: 'sending' } });
      }

      await sendBatch(campaign, settings);
    }
  } catch (err) {
    console.log('[EmailBlast] Queue processor error:', err.message);
  } finally {
    _processing = false;
  }
}

async function sendBatch(campaign, settings) {
  const batchSize = settings.batchSize || 10;
  const startIdx = campaign.currentBatchIndex;
  const endIdx = Math.min(startIdx + batchSize, campaign.totalEmails);

  if (startIdx >= campaign.totalEmails) {
    // Campaign complete
    await _campaignsCol.updateOne({ campaignId: campaign.campaignId }, {
      $set: { status: 'completed', completedAt: new Date() }
    });

    // Notify user
    if (_bot) {
      const c = await getCampaign(campaign.campaignId);
      const deliveryRate = c.totalEmails > 0 ? ((c.deliveredCount / c.totalEmails) * 100).toFixed(1) : 0;
      _bot.sendMessage(campaign.chatId,
        `\u2705 <b>Email Campaign Complete!</b>\n\n` +
        `\u{1F4E4} Sent: ${c.sentCount}\n` +
        `\u2705 Delivered: ${c.deliveredCount} (${deliveryRate}%)\n` +
        `\u21A9\uFE0F Bounced: ${c.bouncedCount}\n` +
        `\u274C Failed: ${c.failedCount}\n` +
        `\u23F1 Duration: ${getTimeDiff(c.startedAt, c.completedAt)}`,
        { parse_mode: 'HTML' }
      ).catch(() => {});
    }
    return;
  }

  // Get active domains for rotation
  const domains = await getActiveDomains();
  if (domains.length === 0) {
    console.log('[EmailBlast] No active domains — pausing campaigns');
    return;
  }

  const batch = campaign.emails.slice(startIdx, endIdx);
  let sent = 0;
  let bounced = 0;
  let failed = 0;

  for (let i = 0; i < batch.length; i++) {
    const email = batch[i];

    // Pick domain (round-robin)
    const domainIdx = (startIdx + i) % domains.length;
    const domain = domains[domainIdx];

    // Pick IP from domain's assigned IPs
    const ip = domain.assignedIps[0] || VPS_HOST;

    // Check warming limits
    const warmCheck = await emailWarming.canSend(ip);
    if (!warmCheck.canSend) {
      // Can't send more from this IP right now — stop batch
      console.log(`[EmailBlast] IP ${ip} limit reached: ${warmCheck.reason}`);
      break;
    }

    // Check suppression list
    const suppressed = await _suppressionsCol.findOne({ email });
    if (suppressed) {
      failed++;
      sent++; // count as processed
      continue;
    }

    try {
      const transporter = getTransporter(ip);

      const mailOpts = {
        from: `"${campaign.fromName}" <noreply@${domain.domain}>`,
        to: email,
        subject: campaign.subject,
        text: campaign.bodyText || stripHtml(campaign.bodyHtml),
        html: campaign.bodyHtml,
        headers: {
          'List-Unsubscribe': `<mailto:unsubscribe@${domain.domain}?subject=unsubscribe>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
        },
        dkim: {
          domainName: domain.domain,
          keySelector: domain.dkimSelector,
          privateKey: domain.dkimPrivateKey
        }
      };

      await transporter.sendMail(mailOpts);
      sent++;

      // Record warming stats
      await emailWarming.recordSent(ip, 1, 0);

    } catch (err) {
      const errMsg = err.message || '';
      // Check if it's a bounce
      if (errMsg.includes('550') || errMsg.includes('551') || errMsg.includes('553') || errMsg.includes('554')) {
        bounced++;
        // Add to suppression list
        await _suppressionsCol.updateOne(
          { email },
          { $set: { email, reason: 'hard_bounce', bounceCode: errMsg.substring(0, 3), campaignId: campaign.campaignId, addedAt: new Date() } },
          { upsert: true }
        );
        await emailWarming.recordSent(ip, 1, 1);
      } else {
        failed++;
      }
      sent++;
    }

    // Throttle: small delay between emails
    await sleep(100);
  }

  // Update campaign progress
  const newIdx = startIdx + sent;
  const deliveredInBatch = sent - bounced - failed;

  await _campaignsCol.updateOne({ campaignId: campaign.campaignId }, {
    $inc: {
      sentCount: sent,
      deliveredCount: deliveredInBatch,
      bouncedCount: bounced,
      failedCount: failed
    },
    $set: { currentBatchIndex: newIdx }
  });

  // Update domain stats
  for (const d of domains) {
    await _domainsCol.updateOne({ domain: d.domain }, {
      $inc: { totalSent: Math.ceil(sent / domains.length) }
    });
  }

  // Check bounce rate for auto-pause
  const updatedCampaign = await getCampaign(campaign.campaignId);
  if (updatedCampaign.sentCount > 50) {
    const br = (updatedCampaign.bouncedCount / updatedCampaign.sentCount) * 100;
    if (br > (settings.bounceRateThreshold || 5)) {
      await pauseCampaign(campaign.campaignId);
      if (_bot) {
        _bot.sendMessage(campaign.chatId,
          `\u26A0\uFE0F <b>Campaign Auto-Paused</b>\nBounce rate: ${br.toFixed(1)}% (threshold: ${settings.bounceRateThreshold}%)\nSent: ${updatedCampaign.sentCount}/${updatedCampaign.totalEmails}`,
          { parse_mode: 'HTML' }
        ).catch(() => {});
      }
    }
  }

  // Send progress update (every 20% or every 5 minutes)
  const pct = Math.floor((newIdx / campaign.totalEmails) * 100);
  const lastPct = Math.floor((startIdx / campaign.totalEmails) * 100);
  const milestone = Math.floor(pct / 20) > Math.floor(lastPct / 20);

  if (milestone && _bot) {
    _bot.sendMessage(campaign.chatId,
      `\u{1F4CA} <b>Campaign Progress</b>\n${pct}% complete (${newIdx}/${campaign.totalEmails})\nDelivered: ${updatedCampaign.deliveredCount} | Bounced: ${updatedCampaign.bouncedCount}`,
      { parse_mode: 'HTML' }
    ).catch(() => {});
    await _campaignsCol.updateOne({ campaignId: campaign.campaignId }, { $set: { lastProgressUpdate: new Date() } });
  }
}

// ─── Suppression List ───────────────────────────────────

async function getSuppressionCount() {
  return _suppressionsCol.countDocuments({});
}

async function isEmailSuppressed(email) {
  return !!(await _suppressionsCol.findOne({ email }));
}

async function addSuppression(email, reason = 'manual') {
  await _suppressionsCol.updateOne(
    { email },
    { $set: { email, reason, addedAt: new Date() } },
    { upsert: true }
  );
}

async function clearSuppressions() {
  return _suppressionsCol.deleteMany({});
}

async function getSuppressionList(limit = 50) {
  return _suppressionsCol.find({}).sort({ addedAt: -1 }).limit(limit).toArray();
}

// ─── IP Management (for admin) ──────────────────────────

async function addIpToDomain(ip, domain) {
  // Add IP to domain's assigned IPs
  await _domainsCol.updateOne({ domain }, { $addToSet: { assignedIps: ip } });

  // Start warming for the new IP
  const warmResult = await emailWarming.startWarming(ip, domain);

  // Update SPF records for all domains with this IP
  const allIps = await getAllActiveIps();
  const allDomains = await getDomains();
  for (const d of allDomains) {
    await emailDns.updateSpf(d.domain, allIps);
  }

  // Add to trusted hosts on VPS
  const { exec } = require('child_process');
  exec(`sshpass -p 'Onlygod123@' ssh -o StrictHostKeyChecking=no root@${VPS_HOST} "grep -q '${ip}' /etc/opendkim/trusted.hosts || echo '${ip}' >> /etc/opendkim/trusted.hosts && systemctl reload opendkim 2>/dev/null || true"`,
    { timeout: 10000 }, () => {});

  return warmResult;
}

// ─── Analytics ──────────────────────────────────────────

async function getAnalytics() {
  const totalCampaigns = await _campaignsCol.countDocuments({});
  const activeCampaigns = await _campaignsCol.countDocuments({ status: { $in: ['queued', 'sending'] } });
  const completedCampaigns = await _campaignsCol.countDocuments({ status: 'completed' });

  const pipeline = [
    { $match: { status: 'completed' } },
    { $group: {
      _id: null,
      totalSent: { $sum: '$sentCount' },
      totalDelivered: { $sum: '$deliveredCount' },
      totalBounced: { $sum: '$bouncedCount' },
      totalRevenue: { $sum: '$totalPrice' }
    }}
  ];

  const agg = await _campaignsCol.aggregate(pipeline).toArray();
  const stats = agg[0] || { totalSent: 0, totalDelivered: 0, totalBounced: 0, totalRevenue: 0 };
  const suppressionCount = await getSuppressionCount();
  const domains = await getDomains();
  const warming = await emailWarming.getAllWarming();

  return {
    totalCampaigns,
    activeCampaigns,
    completedCampaigns,
    ...stats,
    deliveryRate: stats.totalSent > 0 ? ((stats.totalDelivered / stats.totalSent) * 100).toFixed(1) : 0,
    suppressionCount,
    domainCount: domains.length,
    ipCount: warming.length
  };
}

// ─── Helpers ────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function getTimeDiff(start, end) {
  if (!start || !end) return 'N/A';
  const ms = new Date(end) - new Date(start);
  const hours = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  if (hours > 24) return `${Math.floor(hours / 24)} days, ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

module.exports = {
  initEmailBlast,
  getSettings,
  updateSettings,
  addDomain,
  removeDomain,
  getDomains,
  getActiveDomains,
  addIpToDomain,
  createCampaign,
  getCampaign,
  getUserCampaigns,
  startCampaign,
  pauseCampaign,
  resumeCampaign,
  cancelCampaign,
  getSuppressionCount,
  isEmailSuppressed,
  addSuppression,
  clearSuppressions,
  getSuppressionList,
  getAnalytics,
  DKIM_SELECTOR,
  VPS_HOST,
  DEFAULT_SETTINGS
};
