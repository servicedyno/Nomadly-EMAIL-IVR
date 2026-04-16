/**
 * Improved User Messages
 * Better error messages, balance notifications, and user guidance
 */

/**
 * Generate improved insufficient balance message
 */
function getInsufficientBalanceMessage(currentBalance, requiredAmount, currency = 'USD', lang = 'en') {
  const shortfall = requiredAmount - currentBalance
  const symbol = currency === 'NGN' ? '₦' : '$'

  const messages = {
    en: {
      title: '❌ Insufficient Balance',
      current: 'Current',
      required: 'Required',
      shortfall: 'Shortfall',
      addFunds: '💰 Add Funds',
      viewPlans: '📊 View Plans',
      cancel: '❌ Cancel'
    },
    fr: {
      title: '❌ Solde insuffisant',
      current: 'Actuel',
      required: 'Requis',
      shortfall: 'Manquant',
      addFunds: '💰 Ajouter des fonds',
      viewPlans: '📊 Voir les plans',
      cancel: '❌ Annuler'
    },
    zh: {
      title: '❌ 余额不足',
      current: '当前',
      required: '需要',
      shortfall: '缺额',
      addFunds: '💰 添加资金',
      viewPlans: '📊 查看计划',
      cancel: '❌ 取消'
    },
    hi: {
      title: '❌ अपर्याप्त शेष',
      current: 'वर्तमान',
      required: 'आवश्यक',
      shortfall: 'कमी',
      addFunds: '💰 फंड जोड़ें',
      viewPlans: '📊 योजनाएं देखें',
      cancel: '❌ रद्द करें'
    }
  }

  const t = messages[lang] || messages.en

  const message = `${t.title}\n\n` +
    `${t.current}: <b>${symbol}${currentBalance.toFixed(2)}</b>\n` +
    `${t.required}: <b>${symbol}${requiredAmount.toFixed(2)}</b>\n` +
    `${t.shortfall}: <b>${symbol}${shortfall.toFixed(2)}</b>\n\n` +
    `Tap below to add funds and continue.`

  return {
    message,
    keyboard: [
      [t.addFunds],
      [t.viewPlans, t.cancel]
    ]
  }
}

/**
 * Generate DNS propagation information message
 */
function getDNSPropagationMessage(domain, lang = 'en') {
  const messages = {
    en: {
      title: '✅ DNS Configured',
      propagation: '⏰ DNS Propagation',
      typical: '5-15 minutes typically (up to 48h globally)',
      whileWait: 'While you wait:',
      email: '📧 Check email for cPanel credentials',
      guide: '📖 Read our getting started guide',
      tutorial: '🎥 Watch setup tutorial',
      checkStatus: '🔍 Check DNS Status',
      resendCreds: '📧 Resend Credentials',
      support: '💬 Support'
    },
    fr: {
      title: '✅ DNS configuré',
      propagation: '⏰ Propagation DNS',
      typical: '5-15 minutes typiquement (jusqu\'à 48h globalement)',
      whileWait: 'En attendant :',
      email: '📧 Vérifiez vos e-mails pour les identifiants cPanel',
      guide: '📖 Lisez notre guide de démarrage',
      tutorial: '🎥 Regardez le tutoriel',
      checkStatus: '🔍 Vérifier le statut DNS',
      resendCreds: '📧 Renvoyer les identifiants',
      support: '💬 Support'
    },
    zh: {
      title: '✅ DNS 已配置',
      propagation: '⏰ DNS 传播',
      typical: '通常 5-15 分钟（全球最多 48 小时）',
      whileWait: '在等待时：',
      email: '📧 查看电子邮件中的 cPanel 凭据',
      guide: '📖 阅读我们的入门指南',
      tutorial: '🎥 观看设置教程',
      checkStatus: '🔍 检查 DNS 状态',
      resendCreds: '📧 重新发送凭据',
      support: '💬 支持'
    },
    hi: {
      title: '✅ DNS कॉन्फ़िगर किया गया',
      propagation: '⏰ DNS प्रचार',
      typical: 'आमतौर पर 5-15 मिनट (वैश्विक रूप से 48 घंटे तक)',
      whileWait: 'प्रतीक्षा करते समय:',
      email: '📧 cPanel क्रेडेंशियल्स के लिए ईमेल जांचें',
      guide: '📖 हमारी शुरुआती गाइड पढ़ें',
      tutorial: '🎥 सेटअप ट्यूटोरियल देखें',
      checkStatus: '🔍 DNS स्थिति जांचें',
      resendCreds: '📧 क्रेडेंशियल्स पुनः भेजें',
      support: '💬 समर्थन'
    }
  }

  const t = messages[lang] || messages.en

  const message = `${t.title}: <b>${domain}</b>\n\n` +
    `${t.propagation}: ${t.typical}\n\n` +
    `${t.whileWait}\n` +
    `${t.email}\n` +
    `${t.guide}\n` +
    `${t.tutorial}`

  return {
    message,
    keyboard: [
      [t.checkStatus],
      [t.resendCreds, t.support]
    ]
  }
}

/**
 * Generate phone verification status message
 */
function getPhoneVerificationMessage(phoneNumber, hoursAgo, lang = 'en') {
  const messages = {
    en: {
      title: '⏳ Number Verification in Progress',
      phone: 'Phone',
      submitted: 'Submitted',
      why: 'Why verification takes time:',
      check1: '✓ Telecom compliance checks (automated)',
      check2: '✓ Fraud prevention screening',
      check3: '✓ Number availability confirmation',
      timeline: 'Typical timeline:',
      stage1: '• 2-6 hours: Initial check (usually completes here)',
      stage2: '• 6-24 hours: Additional verification if needed',
      stage3: '• 1-3 days: Maximum for complex cases',
      updates: 'Status updates:',
      notify: '✉️ We\'ll notify you immediately when ready',
      checkBack: '🔔 Check back here anytime',
      refresh: '🔄 Refresh Status',
      faq: '❓ FAQ',
      contactSupport: '💬 Contact Support'
    },
    fr: {
      title: '⏳ Vérification du numéro en cours',
      phone: 'Téléphone',
      submitted: 'Soumis',
      why: 'Pourquoi la vérification prend du temps :',
      check1: '✓ Conformité télécom (automatique)',
      check2: '✓ Détection de fraude',
      check3: '✓ Confirmation de disponibilité',
      timeline: 'Délai typique :',
      stage1: '• 2-6 heures : Vérification initiale',
      stage2: '• 6-24 heures : Vérification supplémentaire',
      stage3: '• 1-3 jours : Maximum pour cas complexes',
      updates: 'Mises à jour :',
      notify: '✉️ Notification immédiate à l\'approbation',
      checkBack: '🔔 Vérifiez à tout moment',
      refresh: '🔄 Actualiser le statut',
      faq: '❓ FAQ',
      contactSupport: '💬 Contacter le support'
    },
    zh: {
      title: '⏳ 号码验证进行中',
      phone: '电话',
      submitted: '已提交',
      why: '为什么验证需要时间：',
      check1: '✓ 电信合规检查（自动）',
      check2: '✓ 防欺诈筛选',
      check3: '✓ 号码可用性确认',
      timeline: '典型时间表：',
      stage1: '• 2-6 小时：初步检查（通常在此完成）',
      stage2: '• 6-24 小时：如需额外验证',
      stage3: '• 1-3 天：复杂情况的最长时间',
      updates: '状态更新：',
      notify: '✉️ 准备好后立即通知您',
      checkBack: '🔔 随时查看',
      refresh: '🔄 刷新状态',
      faq: '❓ 常见问题',
      contactSupport: '💬 联系支持'
    },
    hi: {
      title: '⏳ नंबर सत्यापन प्रगति में',
      phone: 'फोन',
      submitted: 'सबमिट किया गया',
      why: 'सत्यापन में समय क्यों लगता है:',
      check1: '✓ टेलीकॉम अनुपालन जांच (स्वचालित)',
      check2: '✓ धोखाधड़ी रोकथाम स्क्रीनिंग',
      check3: '✓ नंबर उपलब्धता पुष्टि',
      timeline: 'विशिष्ट समयरेखा:',
      stage1: '• 2-6 घंटे: प्रारंभिक जांच (आमतौर पर यहां पूर्ण)',
      stage2: '• 6-24 घंटे: यदि आवश्यक हो तो अतिरिक्त सत्यापन',
      stage3: '• 1-3 दिन: जटिल मामलों के लिए अधिकतम',
      updates: 'स्थिति अपडेट:',
      notify: '✉️ तैयार होने पर तुरंत सूचित करेंगे',
      checkBack: '🔔 किसी भी समय वापस जांचें',
      refresh: '🔄 स्थिति रीफ्रेश करें',
      faq: '❓ अक्सर पूछे जाने वाले प्रश्न',
      contactSupport: '💬 समर्थन से संपर्क करें'
    }
  }

  const t = messages[lang] || messages.en

  const message = `${t.title}\n\n` +
    `📞 ${t.phone}: <code>${phoneNumber}</code>\n` +
    `⏱️ ${t.submitted}: ${hoursAgo} hours ago\n\n` +
    `${t.why}\n` +
    `${t.check1}\n` +
    `${t.check2}\n` +
    `${t.check3}\n\n` +
    `${t.timeline}\n` +
    `${t.stage1}\n` +
    `${t.stage2}\n` +
    `${t.stage3}\n\n` +
    `${t.updates}\n` +
    `${t.notify}\n` +
    `${t.checkBack}`

  return {
    message,
    keyboard: [
      [t.refresh],
      [t.faq, t.contactSupport]
    ]
  }
}

/**
 * Generate transaction confirmation message
 */
function getTransactionConfirmation(transactionId, details, lang = 'en') {
  const messages = {
    en: {
      title: '✅ Transaction Successful',
      id: 'Transaction ID',
      support: 'Quote this ID when contacting support',
      viewDetails: '📋 View Details'
    },
    fr: {
      title: '✅ Transaction réussie',
      id: 'ID de transaction',
      support: 'Citez cet ID lorsque vous contactez le support',
      viewDetails: '📋 Voir les détails'
    },
    zh: {
      title: '✅ 交易成功',
      id: '交易 ID',
      support: '联系支持时请引用此 ID',
      viewDetails: '📋 查看详情'
    },
    hi: {
      title: '✅ लेनदेन सफल',
      id: 'लेनदेन ID',
      support: 'समर्थन से संपर्क करते समय इस ID का उल्लेख करें',
      viewDetails: '📋 विवरण देखें'
    }
  }

  const t = messages[lang] || messages.en

  const message = `${t.title}\n\n` +
    `${details}\n\n` +
    `${t.id}: <code>${transactionId}</code>\n\n` +
    `<i>${t.support}</i>`

  return message
}

module.exports = {
  getInsufficientBalanceMessage,
  getDNSPropagationMessage,
  getPhoneVerificationMessage,
  getTransactionConfirmation
}
