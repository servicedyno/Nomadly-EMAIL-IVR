/**
 * Email Blast Configuration
 * Centralized config for the Email Blast feature — pricing, limits, button labels, and defaults.
 */

const EMAIL_BLAST_CONFIG = {
  // ━━━ Pricing ━━━
  pricing: {
    defaultRatePerEmail: 0.003,  // $0.003/email
    minCharge: 1.00,             // Minimum campaign charge $1
    maxEmailsPerCampaign: 100000 // Max 100k emails per campaign
  },

  // ━━━ Sending Limits ━━━
  sending: {
    queueIntervalMs: 30000,      // Queue processor runs every 30s
    throttleDelayMs: 100,        // 100ms between emails
    maxBouncePct: 5,             // Auto-pause on >5% bounce rate
    progressNotifyPct: 20,       // Notify user every 20%
    maxRetries: 3                // Max retries per failed email
  },

  // ━━━ VPS / SMTP ━━━
  vps: {
    host: '5.189.166.127',
    smtpPort: 25,
    sshUser: 'root',
    sshPort: 22,
    dkimKeyBits: 2048
  },

  // ━━━ Warming Schedule (8 stages) ━━━
  warming: {
    stages: [
      { stage: 1, dailyLimit: 50,   hourlyMax: 10,  daysRequired: 7  },
      { stage: 2, dailyLimit: 100,  hourlyMax: 20,  daysRequired: 7  },
      { stage: 3, dailyLimit: 250,  hourlyMax: 50,  daysRequired: 7  },
      { stage: 4, dailyLimit: 500,  hourlyMax: 100, daysRequired: 7  },
      { stage: 5, dailyLimit: 1000, hourlyMax: 200, daysRequired: 7  },
      { stage: 6, dailyLimit: 2500, hourlyMax: 500, daysRequired: 7  },
      { stage: 7, dailyLimit: 5000, hourlyMax: 800, daysRequired: 7  },
      { stage: 8, dailyLimit: 10000, hourlyMax: 1500, daysRequired: -1 } // Final stage
    ],
    graduationBounceMaxPct: 2,  // Must have <2% bounce to graduate
    pauseBounceThresholdPct: 5  // Auto-pause IP on >5% bounce
  },

  // ━━━ Telegram Button Labels ━━━
  buttons: {
    // User flow
    uploadList: '📧 Email Blast',
    selectPlainText: '📝 Type Plain Text',
    selectHtmlFile: '📎 Upload HTML File',
    sendTestEmail: '📧 Send Test Email',
    payAndSend: '✅ Pay & Send',
    edit: '✏️ Edit',
    editContent: '✏️ Edit Content',
    cancel: '❌ Cancel',
    back: '🔙 Back',
    looksGood: '✅ Looks Good — Continue to Payment',
    sendAnotherTest: '📧 Send Another Test',
    continueAnyway: '✅ Continue to Payment Anyway',
    tryAgain: '📧 Try Again',

    // Admin flow
    dashboard: '📊 Dashboard',
    manageDomains: '🌐 Manage Domains',
    manageIps: '🖥️ Manage IPs & Warming',
    pricingSettings: '💰 Pricing Settings',
    suppressionList: '🚫 Suppression List',
    addDomain: '➕ Add Domain',
    removeDomain: '❌ Remove Domain',
    addIp: '➕ Add IP',
    assignIpToDomain: '🔗 Assign IP to Domain',
    pauseIp: '⏸ Pause',
    resumeIp: '▶️ Resume'
  },

  // ━━━ Action Constants ━━━
  actions: {
    ebMenu: 'ebMenu',
    ebUploadList: 'ebUploadList',
    ebEnterSubject: 'ebEnterSubject',
    ebEnterFromName: 'ebEnterFromName',
    ebSelectContentType: 'ebSelectContentType',
    ebEnterContent: 'ebEnterContent',
    ebPreview: 'ebPreview',
    ebTestEmail: 'ebTestEmail',
    ebTestEmailSent: 'ebTestEmailSent',
    ebPayment: 'ebPayment',
    ebAdminMenu: 'ebAdminMenu',
    ebAdminDomains: 'ebAdminDomains',
    ebAdminAddDomain: 'ebAdminAddDomain',
    ebAdminRemoveDomain: 'ebAdminRemoveDomain',
    ebAdminIps: 'ebAdminIps',
    ebAdminAddIp: 'ebAdminAddIp',
    ebAdminAssignIpDomain: 'ebAdminAssignIpDomain',
    ebAdminPricing: 'ebAdminPricing',
    ebAdminPricingRate: 'ebAdminPricingRate',
    ebAdminPricingMin: 'ebAdminPricingMin',
    ebAdminPricingMax: 'ebAdminPricingMax',
    bankPayEmailBlast: 'bank-pay-email-blast'
  },

  // ━━━ Campaign Statuses ━━━
  statuses: {
    draft: 'draft',
    queued: 'queued',
    sending: 'sending',
    paused: 'paused',
    completed: 'completed',
    cancelled: 'cancelled',
    failed: 'failed'
  }
};

module.exports = EMAIL_BLAST_CONFIG;
