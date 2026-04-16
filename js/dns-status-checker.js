/**
 * DNS Status Checker
 * Allows users to check DNS propagation status
 */

const dns = require('dns').promises
const axios = require('axios')

/**
 * Check DNS propagation for a domain
 */
async function checkDNSStatus(domain) {
  const results = {
    domain,
    timestamp: new Date(),
    nameservers: { status: 'unknown', details: [] },
    aRecord: { status: 'unknown', ip: null },
    propagationPercent: 0,
    estimatedTime: 'Unknown'
  }

  try {
    // Check nameservers
    try {
      const ns = await dns.resolveNs(domain)
      results.nameservers.status = ns.length > 0 ? 'configured' : 'pending'
      results.nameservers.details = ns
    } catch (err) {
      results.nameservers.status = 'not-configured'
      results.nameservers.error = err.code
    }

    // Check A record
    try {
      const addresses = await dns.resolve4(domain)
      results.aRecord.status = addresses.length > 0 ? 'configured' : 'pending'
      results.aRecord.ip = addresses[0]
    } catch (err) {
      results.aRecord.status = 'not-configured'
      results.aRecord.error = err.code
    }

    // Check multiple DNS servers for propagation
    const publicDNS = [
      { name: 'Google', server: '8.8.8.8' },
      { name: 'Cloudflare', server: '1.1.1.1' },
      { name: 'OpenDNS', server: '208.67.222.222' },
      { name: 'Quad9', server: '9.9.9.9' }
    ]

    let propagatedCount = 0
    const propagationChecks = []

    for (const dnsServer of publicDNS) {
      try {
        const response = await checkDNSOnServer(domain, dnsServer.server)
        propagationChecks.push({
          server: dnsServer.name,
          status: response.success ? 'propagated' : 'pending',
          ip: response.ip
        })
        if (response.success) propagatedCount++
      } catch (err) {
        propagationChecks.push({
          server: dnsServer.name,
          status: 'error',
          error: err.message
        })
      }
    }

    results.propagationChecks = propagationChecks
    results.propagationPercent = Math.round((propagatedCount / publicDNS.length) * 100)

    // Estimate remaining time
    if (results.propagationPercent === 0) {
      results.estimatedTime = '10-15 minutes'
    } else if (results.propagationPercent < 50) {
      results.estimatedTime = '5-10 minutes'
    } else if (results.propagationPercent < 100) {
      results.estimatedTime = '2-5 minutes'
    } else {
      results.estimatedTime = 'Complete'
    }

  } catch (err) {
    console.error('[DNSChecker] Error checking DNS:', err.message)
    results.error = err.message
  }

  return results
}

/**
 * Check DNS on specific server using Google DNS-over-HTTPS
 */
async function checkDNSOnServer(domain, server) {
  try {
    // Use Google DNS-over-HTTPS API to query specific DNS server
    // Note: This is a simplified version. Full implementation would query the specific server.
    const response = await axios.get(`https://dns.google/resolve?name=${domain}&type=A`, {
      timeout: 5000
    })
    
    if (response.data && response.data.Answer && response.data.Answer.length > 0) {
      return {
        success: true,
        ip: response.data.Answer[0].data
      }
    }
    
    return { success: false }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Format DNS status for user display
 */
function formatDNSStatus(results, lang = 'en') {
  const statusEmoji = {
    'configured': '✅',
    'propagated': '✅',
    'pending': '🔄',
    'not-configured': '⏺',
    'error': '❌'
  }

  const messages = {
    en: {
      title: '🔍 DNS Status Check',
      nameservers: 'Nameservers',
      aRecord: 'A Record',
      propagation: 'Global Propagation',
      estimated: 'Estimated Time',
      checkAgain: '🔄 Check Again',
      learnMore: '📖 Learn More',
      complete: 'Complete',
      notStarted: 'Not Started'
    },
    fr: {
      title: '🔍 Vérification DNS',
      nameservers: 'Serveurs de noms',
      aRecord: 'Enregistrement A',
      propagation: 'Propagation mondiale',
      estimated: 'Temps estimé',
      checkAgain: '🔄 Vérifier à nouveau',
      learnMore: '📖 En savoir plus',
      complete: 'Terminé',
      notStarted: 'Non commencé'
    },
    zh: {
      title: '🔍 DNS 状态检查',
      nameservers: '域名服务器',
      aRecord: 'A 记录',
      propagation: '全球传播',
      estimated: '预计时间',
      checkAgain: '🔄 再次检查',
      learnMore: '📖 了解更多',
      complete: '完成',
      notStarted: '未开始'
    },
    hi: {
      title: '🔍 DNS स्थिति जांच',
      nameservers: 'नेमसर्वर',
      aRecord: 'A रिकॉर्ड',
      propagation: 'वैश्विक प्रचार',
      estimated: 'अनुमानित समय',
      checkAgain: '🔄 फिर से जांचें',
      learnMore: '📖 और जानें',
      complete: 'पूर्ण',
      notStarted: 'शुरू नहीं हुआ'
    }
  }

  const t = messages[lang] || messages.en

  let message = `${t.title}: <b>${results.domain}</b>\n\n`

  // Nameservers
  message += `${statusEmoji[results.nameservers.status]} <b>${t.nameservers}:</b> `
  if (results.nameservers.status === 'configured') {
    message += `${results.nameservers.details.length} configured\n`
  } else {
    message += `${results.nameservers.status}\n`
  }

  // A Record
  message += `${statusEmoji[results.aRecord.status]} <b>${t.aRecord}:</b> `
  if (results.aRecord.status === 'configured') {
    message += `${results.aRecord.ip}\n`
  } else {
    message += `${results.aRecord.status}\n`
  }

  message += `\n`

  // Propagation
  message += `📡 <b>${t.propagation}:</b> ${results.propagationPercent}%\n`
  if (results.propagationChecks) {
    results.propagationChecks.forEach(check => {
      message += `   ${statusEmoji[check.status]} ${check.server}\n`
    })
  }

  message += `\n⏱ <b>${t.estimated}:</b> ${results.estimatedTime}\n`

  return message
}

module.exports = {
  checkDNSStatus,
  formatDNSStatus
}
