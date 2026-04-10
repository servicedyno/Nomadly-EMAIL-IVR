/**
 * MongoDB Collections Schema Documentation
 * Central reference for all database collections used in the application
 * 
 * Last Updated: April 10, 2026
 * Total Collections: 91
 */

module.exports = {
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // VPS/RDP SERVICE COLLECTIONS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  vpsPlansOf: {
    description: 'Active VPS and RDP instances',
    fields: {
      chatId: 'Telegram user ID',
      name: 'Instance name (e.g., vm-instance-xyz)',
      label: 'User-friendly label',
      vpsId: 'Internal VPS ID',
      contaboInstanceId: 'Contabo API instance ID',
      status: 'RUNNING | STOPPED | EXPIRED | CANCELLED | PENDING_CANCELLATION',
      plan: 'Monthly | Yearly | Hourly',
      planPrice: 'Price in USD',
      start_time: 'Subscription start date',
      end_time: 'Subscription end date',
      host: 'IP address',
      productId: 'Contabo product ID',
      region: 'Server region',
      isRDP: 'Boolean - true for Windows RDP, false for Linux',
      osType: 'Windows | Linux',
      rootPasswordSecretId: 'Contabo secret ID for password (RDP only)',
      sshKeySecretId: 'Contabo secret ID for SSH keys (Linux only)',
      lastPasswordReset: 'Timestamp of last password reset',
      lastReinstall: 'Timestamp of last OS reinstall',
      imageId: 'OS image ID',
      defaultUser: 'Administrator | root'
    },
    indexes: ['chatId', 'status', 'end_time', 'chatId+status'],
    related: ['vpsTransactions']
  },

  vpsTransactions: {
    description: 'VPS payment transactions',
    fields: {
      chatId: 'Telegram user ID',
      dynopay: 'DynoPay payment reference',
      bank: 'Bank payment reference',
      timestamp: 'Transaction date'
    },
    indexes: ['chatId', 'timestamp']
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DOMAIN SERVICE COLLECTIONS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  domainsOf: {
    description: 'Registered domains per user',
    fields: {
      _id: 'chatId',
      domains: 'Array of domain names'
    },
    indexes: ['chatId']
  },

  freeDomainNamesAvailableFor: {
    description: 'Free domain allocation tracking',
    fields: {
      _id: 'chatId',
      val: 'Number of free domains available'
    }
  },

  registeredDomains: {
    description: 'All registered domains with metadata',
    fields: {
      val: 'Domain name and details'
    }
  },

  domainDnsCache: {
    description: 'DNS status cache for domains',
    fields: {
      checkedAt: 'Last DNS check timestamp',
      consecutiveMisses: 'Failed DNS checks count',
      firstMissAt: 'First DNS failure timestamp',
      pointsToUs: 'Boolean - DNS points to our servers'
    }
  },

  dnsRecords: {
    description: 'Custom DNS records',
    fields: {
      val: 'DNS record data'
    }
  },

  blockedDomains: {
    description: 'Blocked/banned domains',
    fields: {
      domain: 'Domain name',
      blockedAt: 'Block timestamp',
      reason: 'Block reason',
      reportedBy: 'Reporter user ID'
    }
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // HOSTING SERVICE COLLECTIONS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  hostingTransactions: {
    description: 'Hosting payment transactions',
    fields: {
      chatId: 'Telegram user ID',
      blockbee: 'Blockbee payment reference',
      timestamp: 'Transaction date'
    },
    indexes: ['chatId', 'timestamp']
  },

  cpanelAccounts: {
    description: 'cPanel hosting accounts',
    fields: {
      chatId: 'Telegram user ID',
      domain: 'Primary domain',
      username: 'cPanel username',
      plan: 'Hosting plan type'
    }
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PHONE/LEAD GENERATION COLLECTIONS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  phoneNumbersOf: {
    description: 'User cloud phone numbers',
    fields: {
      _id: 'chatId',
      val: 'Phone number details'
    }
  },

  phoneTransactions: {
    description: 'Phone number purchase transactions',
    fields: {
      chatId: 'Telegram user ID',
      phoneNumber: 'Purchased phone number',
      action: 'buy | renew | port',
      plan: 'Monthly | Yearly',
      amount: 'Price in USD',
      paymentMethod: 'wallet | crypto',
      timestamp: 'Transaction date'
    }
  },

  phoneLogs: {
    description: 'SMS and call logs for cloud phones',
    fields: {
      phoneNumber: 'Cloud phone number',
      chatId: 'Owner chatId',
      type: 'sms | call',
      direction: 'inbound | outbound',
      from: 'Sender number',
      to: 'Recipient number',
      body: 'Message content (SMS only)',
      timestamp: 'Log timestamp'
    },
    indexes: ['chatId', 'phoneNumber', 'timestamp']
  },

  cnamCache: {
    description: 'Caller name lookup cache',
    fields: {
      phone: 'Phone number',
      name: 'Caller name',
      source: 'Data source',
      updatedAt: 'Cache timestamp'
    },
    indexes: ['phone', 'updatedAt'],
    note: 'Largest collection (27,565+ documents)'
  },

  ivrAnalytics: {
    description: 'IVR system analytics',
    fields: {
      phoneNumber: 'IVR phone number',
      callCount: 'Total calls',
      avgDuration: 'Average call duration',
      timestamp: 'Analytics timestamp'
    }
  },

  ivrAudioFiles: {
    description: 'IVR audio file storage',
    fields: {
      audioId: 'Unique audio ID',
      chatId: 'Owner chatId',
      fileUrl: 'Audio file URL'
    }
  },

  freeValidationsAvailableFor: {
    description: 'Free lead validation credits per user',
    fields: {
      _id: 'chatId',
      val: 'Number of free validations'
    }
  },

  leadRequests: {
    description: 'Lead generation requests',
    fields: {
      val: 'Request details'
    }
  },

  leadJobs: {
    description: 'Background lead generation jobs',
    fields: {
      jobId: 'Unique job ID',
      chatId: 'Requester chatId',
      status: 'pending | processing | complete',
      progress: 'Job progress percentage'
    }
  },

  phoneReviews: {
    description: 'User reviews for cloud phones',
    fields: {
      stars: 'Rating (1-5)',
      comment: 'Review text',
      name: 'Reviewer name',
      createdAt: 'Review timestamp'
    }
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // USER & WALLET COLLECTIONS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  walletOf: {
    description: 'User wallet balances (atomic operations)',
    fields: {
      _id: 'chatId',
      usdIn: 'Total USD deposited',
      usdOut: 'Total USD spent',
      ngnIn: 'Total NGN deposited',
      ngnOut: 'Total NGN spent'
    },
    note: 'Uses atomic $inc for thread-safe wallet operations'
  },

  state: {
    description: 'User conversation state for bot flows',
    fields: {
      _id: 'chatId',
      action: 'Current bot action/state',
      userLanguage: 'User selected language',
      lastUpdated: 'Last state change timestamp'
    },
    indexes: ['lastUpdated']
  },

  nameOf: {
    description: 'User display names',
    fields: {
      _id: 'chatId',
      val: 'User full name'
    }
  },

  chatIdOf: {
    description: 'Telegram chatId mappings',
    fields: {
      _id: 'chatId',
      val: 'Additional user metadata'
    }
  },

  loginCountOf: {
    description: 'User login tracking',
    fields: {
      _id: 'chatId',
      val: 'Login count',
      lastLogin: 'Last login timestamp'
    }
  },

  canLogin: {
    description: 'Login permission flags',
    fields: {
      _id: 'chatId',
      val: 'Boolean - can login'
    }
  },

  chatIdBlocked: {
    description: 'Blocked users',
    fields: {
      _id: 'chatId',
      val: 'Block reason'
    }
  },

  welcomeBonuses: {
    description: 'New user welcome bonuses',
    fields: {
      chatId: 'Telegram user ID',
      awardedAt: 'Bonus award timestamp',
      bonusAmount: 'Bonus amount in USD'
    }
  },

  balanceNotifyHistory: {
    description: 'Low balance notification tracking',
    fields: {
      _id: 'chatId',
      escalationCount: 'Notification count',
      level: 'Escalation level',
      ts: 'Last notification timestamp',
      windowStart: 'Notification window start'
    }
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PAYMENT & TRANSACTION COLLECTIONS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  payments: {
    description: 'All payment records (CRITICAL - 6,966+ documents)',
    fields: {
      _id: 'Payment ID',
      val: 'Payment details string',
      timestamp: 'Payment timestamp'
    },
    indexes: ['chatId', 'timestamp', 'chatId+timestamp'],
    note: 'Main payment tracking collection - MUST be properly documented'
  },

  chatIdOfPayment: {
    description: 'Payment session tracking',
    fields: {
      _id: 'Payment reference',
      val: 'chatId'
    }
  },

  chatIdOfDynopayPayment: {
    description: 'DynoPay payment session tracking',
    fields: {
      _id: 'DynoPay reference',
      val: 'chatId'
    }
  },

  paymentIntents: {
    description: 'Pending payment intents',
    fields: {
      ref: 'Payment reference',
      chatId: 'User chatId',
      amount: 'Payment amount',
      type: 'domain | hosting | vps | leads',
      domain: 'Domain (if applicable)',
      plan: 'Plan type',
      provider: 'dynopay | blockbee',
      status: 'pending | completed | failed',
      createdAt: 'Intent creation time',
      expiresAt: 'Intent expiration time'
    }
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // LINK SHORTENING COLLECTIONS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  linksOf: {
    description: 'Short links mapping',
    fields: {
      _id: 'Short code',
      fullUrl: 'Original URL',
      chatId: 'Creator chatId'
    }
  },

  expiryOf: {
    description: 'Link expiration timestamps',
    fields: {
      _id: 'Short code',
      val: 'Expiry timestamp'
    }
  },

  maskOf: {
    description: 'Custom link masks',
    fields: {
      _id: 'Short code',
      val: 'Custom mask'
    }
  },

  fullUrlOf: {
    description: 'Full URL storage',
    fields: {
      _id: 'Short code',
      val: 'Full URL'
    }
  },

  totalShortLinks: {
    description: 'Total links count per user',
    fields: {
      _id: 'chatId',
      val: 'Total links created'
    }
  },

  freeShortLinksOf: {
    description: 'Free link credits per user',
    fields: {
      _id: 'chatId',
      val: 'Free links remaining'
    }
  },

  clicksOf: {
    description: 'Click tracking',
    fields: {
      _id: 'Short code',
      val: 'Click count',
      timestamp: 'Last click time'
    }
  },

  clicksOn: {
    description: 'Detailed click logs',
    fields: {
      _id: 'Click ID',
      val: 'Click details',
      timestamp: 'Click timestamp'
    }
  },

  shortenerActivations: {
    description: 'Custom domain activations for link shortener',
    fields: {
      chatId: 'User chatId',
      domain: 'Custom domain',
      status: 'pending | active | failed',
      createdAt: 'Activation request time'
    }
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SMS SERVICE COLLECTIONS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  freeSmsCountOf: {
    description: 'Free SMS credits per user',
    fields: {
      _id: 'chatId',
      val: 'Free SMS remaining'
    }
  },

  clicksOfSms: {
    description: 'SMS link click tracking',
    fields: {
      _id: 'SMS ID',
      val: 'Click count'
    }
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // MARKETING & ENGAGEMENT COLLECTIONS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  promoResponses: {
    description: 'Automated promo message responses',
    fields: {
      date: 'Promo send date',
      chatId: 'User chatId',
      respondedAt: 'Response timestamp',
      responseCount: 'Total responses',
      theme: 'Promo theme/category'
    }
  },

  promoStats: {
    description: 'Promo campaign statistics',
    fields: {
      theme: 'Promo theme',
      lang: 'Language',
      variation: 'Promo variation',
      usedAI: 'Boolean - used AI generation',
      total: 'Total sent',
      success: 'Successful sends',
      errors: 'Failed sends',
      skipped: 'Skipped users',
      timestamp: 'Campaign timestamp'
    }
  },

  promoOptOut: {
    description: 'User promo preferences',
    fields: {
      _id: 'chatId',
      optedOut: 'Boolean - opted out',
      updatedAt: 'Preference change time',
      reason: 'Opt-out reason'
    }
  },

  winbackCampaigns: {
    description: 'User re-engagement campaigns',
    fields: {
      chatId: 'Inactive user chatId',
      code: 'Discount code',
      discount: 'Discount percentage',
      daysSinceActive: 'Days since last activity',
      sentAt: 'Campaign send time',
      converted: 'Boolean - user converted'
    }
  },

  winbackCodes: {
    description: 'Win-back discount codes',
    fields: {
      code: 'Unique code',
      chatId: 'User chatId',
      discount: 'Discount percentage',
      expiresAt: 'Code expiration',
      used: 'Boolean - code used',
      createdAt: 'Code creation time'
    }
  },

  welcomeCoupons: {
    description: 'Welcome discount coupons',
    fields: {
      code: 'Coupon code',
      chatId: 'User chatId',
      discount: 'Discount amount',
      expiresAt: 'Expiration timestamp',
      used: 'Boolean - coupon used',
      type: 'percentage | fixed',
      createdAt: 'Creation timestamp'
    }
  },

  dailyCoupons: {
    description: 'Daily discount coupons',
    fields: {
      date: 'Coupon date',
      codes: 'Array of codes',
      createdAt: 'Creation timestamp'
    }
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ANALYTICS & TRACKING COLLECTIONS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  userConversion: {
    description: 'User conversion funnel tracking',
    fields: {
      chatId: 'User chatId',
      stage: 'Funnel stage',
      convertedAt: 'Conversion timestamp'
    }
  },

  browseTracking: {
    description: 'User browse behavior',
    fields: {
      chatId: 'User chatId',
      browseCount: 'Total browses',
      createdAt: 'First browse',
      lang: 'User language',
      lastBrowseAt: 'Last browse timestamp',
      lastCategory: 'Last browsed category'
    }
  },

  abandonedCarts: {
    description: 'Abandoned purchase tracking',
    fields: {
      chatId: 'User chatId',
      action: 'Abandoned action',
      category: 'Product category',
      completed: 'Boolean - eventually completed',
      productInfo: 'Product details',
      reachedAt: 'Cart creation time',
      status: 'pending | recovered | expired',
      completedAt: 'Completion timestamp',
      abandonedAt: 'Abandonment timestamp',
      lang: 'User language'
    }
  },

  cartRecoveryStats: {
    description: 'Cart recovery campaign statistics',
    fields: {
      date: 'Stats date',
      categories: 'Product categories',
      nudgesSent: 'Recovery messages sent'
    }
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // REFERRAL & REWARDS COLLECTIONS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  referrals: {
    description: 'User referral tracking',
    fields: {
      _id: 'chatId (referred user)',
      referrerChatId: 'Referrer chatId',
      referrerUsername: 'Referrer username',
      joinedAt: 'Referral join time',
      cumulativeSpend: 'Total spend by referred user',
      rewardPaid: 'Reward paid to referrer'
    }
  },

  referralClicks: {
    description: 'Referral link clicks',
    fields: {
      referrerChatId: 'Referrer chatId',
      referrerCode: 'Referral code',
      clickedAt: 'Click timestamp',
      expiresAt: 'Link expiration',
      converted: 'Boolean - click converted to signup'
    }
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // MARKETPLACE COLLECTIONS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  marketplaceProducts: {
    description: 'User-listed marketplace products',
    fields: {
      productId: 'Unique product ID',
      sellerId: 'Seller chatId',
      title: 'Product title',
      description: 'Product description',
      price: 'Product price',
      category: 'Product category',
      status: 'active | sold | removed'
    }
  },

  marketplaceMessages: {
    description: 'Marketplace chat messages',
    fields: {
      conversationId: 'Conversation ID',
      senderId: 'Sender chatId',
      senderRole: 'buyer | seller',
      type: 'text | image | file',
      text: 'Message content',
      timestamp: 'Message timestamp'
    }
  },

  marketplaceConversations: {
    description: 'Marketplace conversation threads',
    fields: {
      conversationId: 'Unique conversation ID',
      buyerId: 'Buyer chatId',
      sellerId: 'Seller chatId',
      productId: 'Product ID',
      status: 'active | closed'
    }
  },

  marketplaceBans: {
    description: 'Banned marketplace users',
    fields: {
      userId: 'Banned user chatId',
      bannedAt: 'Ban timestamp',
      bannedBy: 'Admin chatId',
      reason: 'Ban reason'
    }
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SUPPORT & AI COLLECTIONS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  aiSupportChats: {
    description: 'AI support chat history',
    fields: {
      chatId: 'User chatId',
      role: 'user | assistant',
      content: 'Message content',
      createdAt: 'Message timestamp'
    }
  },

  supportSessions: {
    description: 'Human support sessions',
    fields: {
      _id: 'Session ID',
      val: 'Session details'
    }
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SCHEDULING & BACKGROUND JOBS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  scheduledEvents: {
    description: 'Scheduled background tasks',
    fields: {
      chatId: 'User chatId (if applicable)',
      type: 'Event type',
      createdAt: 'Event creation time',
      fireAt: 'Scheduled execution time',
      lang: 'User language',
      status: 'pending | processing | complete | failed',
      updatedAt: 'Last update time',
      processingAt: 'Processing start time',
      firedAt: 'Actual execution time'
    }
  },

  bulkCallCampaigns: {
    description: 'Bulk calling campaigns',
    fields: {
      campaignId: 'Unique campaign ID',
      chatId: 'Campaign owner',
      status: 'pending | running | complete',
      totalCalls: 'Total calls to make',
      completedCalls: 'Calls completed'
    }
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // MISC COLLECTIONS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  planOf: {
    description: 'User subscription plans',
    fields: {
      _id: 'chatId',
      val: 'Plan type'
    }
  },

  planEndingTime: {
    description: 'Plan expiration timestamps',
    fields: {
      _id: 'chatId',
      val: 'Expiration timestamp'
    }
  },

  notifyGroups: {
    description: 'Notification groups/channels',
    fields: {
      addedAt: 'Group add timestamp',
      source: 'Group source',
      title: 'Group title'
    }
  },

  digitalOrders: {
    description: 'Digital product orders',
    fields: {
      orderId: 'Unique order ID',
      chatId: 'Buyer chatId',
      productType: 'Product type',
      status: 'pending | complete'
    }
  },

  pendingBundles: {
    description: 'Pending bundle purchases',
    fields: {
      chatId: 'User chatId',
      bundleType: 'Bundle type',
      status: 'pending | complete'
    }
  },

  suspensionEvents: {
    description: 'Service suspension tracking',
    fields: {
      provider: 'Service provider',
      detailId: 'Service ID',
      chatId: 'User chatId',
      phoneNumber: 'Affected phone number',
      status: 'suspended | resolved',
      friendlyName: 'Service name',
      detectedAt: 'Detection timestamp',
      notifiedUser: 'Boolean - user notified',
      notifiedAdmin: 'Boolean - admin notified',
      resolved: 'Boolean - issue resolved'
    }
  },

  resurrectionStats: {
    description: 'Inactive user resurrection stats',
    fields: {
      tested: 'Users tested',
      resurrected: 'Users re-engaged',
      stillDead: 'Users still inactive',
      timestamp: 'Stats timestamp'
    }
  },

  emailSettings: {
    description: 'Email service configuration',
    fields: {
      settingKey: 'Setting name',
      pricePerEmail: 'Cost per email',
      minEmails: 'Minimum emails',
      maxEmails: 'Maximum emails',
      globalRatePerMin: 'Rate limit',
      batchSize: 'Batch size',
      maxRetries: 'Max retry attempts',
      bounceRateThreshold: 'Bounce threshold',
      warmingEnabled: 'Boolean - IP warming enabled',
      updatedAt: 'Last update time'
    }
  },

  emailValidationJobs: {
    description: 'Email validation background jobs',
    fields: {
      jobId: 'Unique job ID',
      status: 'pending | processing | complete',
      emailCount: 'Total emails to validate'
    }
  },

  domainSyncResults: {
    description: 'Domain synchronization results',
    fields: {
      total: 'Total domains synced',
      synced: 'Successfully synced',
      errors: 'Sync errors',
      providerBreakdown: 'Stats by provider',
      statusBreakdown: 'Stats by status',
      dnsIssues: 'DNS issues found',
      results: 'Detailed results',
      startedAt: 'Sync start time',
      completedAt: 'Sync completion time',
      durationMs: 'Sync duration in ms'
    }
  },

  systemMetrics: {
    description: 'System performance metrics',
    fields: {
      metricType: 'Metric type',
      value: 'Metric value',
      timestamp: 'Metric timestamp'
    }
  },

  // Empty/Test Collections (candidates for cleanup)
  testCredentials: { description: 'Test credentials (EMPTY - can be removed)' },
  testOtps: { description: 'Test OTP codes (EMPTY - can be removed)' },
  testReferrals: { description: 'Test referrals (EMPTY - can be removed)' },
  emailCampaigns: { description: 'Email campaigns (EMPTY - can be removed)' },
  broadcastJobs: { description: 'Broadcast jobs (EMPTY - can be removed)' },
  webhookLogs: { description: 'Webhook logs (EMPTY - can be removed)' },
  processedWebhooks: { description: 'Processed webhooks (EMPTY - can be removed)' },
  idempotencyKeys: { description: 'Idempotency keys (EMPTY - can be removed)' },
  provisioningJobs: { description: 'Provisioning jobs (EMPTY - can be removed)' },
  sshKeysOf: { description: 'SSH keys (EMPTY - can be removed)' },
  emailSuppressions: { description: 'Email suppressions (EMPTY - can be removed)' },
  systemAlerts: { description: 'System alerts (EMPTY - can be removed)' },
  honeypotTriggers: { description: 'Honeypot triggers (EMPTY - can be removed)' },
  docSessions: { description: 'Doc sessions (minimal usage)' },
  emailIpWarming: { description: 'Email IP warming (minimal usage)' },
  
};
