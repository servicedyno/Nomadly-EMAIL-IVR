/**
 * Order History Command Handler
 * Displays user's purchase history with transaction tracking
 */

const { getUserTransactions } = require('./transaction-id')
const { translation } = require('./translation')

/**
 * Format transaction history for display
 */
async function handleOrderHistory(bot, chatId, db, lang = 'en') {
  try {
    const transactions = await getUserTransactions(db, chatId, 50)
    
    if (!transactions || transactions.length === 0) {
      const noOrdersMsg = {
        en: '📜 <b>Order History</b>\n\nYou haven\'t made any purchases yet.\n\nStart with our popular services:\n🌐 Domain Registration\n🏠 Web Hosting\n📱 Cloud Phone Numbers',
        fr: '📜 <b>Historique des commandes</b>\n\nVous n\'avez pas encore effectué d\'achats.\n\nCommencez avec nos services populaires:\n🌐 Enregistrement de domaine\n🏠 Hébergement Web\n📱 Numéros de téléphone cloud',
        zh: '📜 <b>订单历史</b>\n\n您还没有进行任何购买。\n\n从我们的热门服务开始:\n🌐 域名注册\n🏠 虚拟主机\n📱 云电话号码',
        hi: '📜 <b>ऑर्डर इतिहास</b>\n\nआपने अभी तक कोई खरीदारी नहीं की है।\n\nहमारी लोकप्रिय सेवाओं से शुरू करें:\n🌐 डोमेन पंजीकरण\n🏠 वेब होस्टिंग\n📱 क्लाउड फोन नंबर'
      }
      
      await bot.sendMessage(chatId, noOrdersMsg[lang] || noOrdersMsg.en, { 
        parse_mode: 'HTML',
        reply_markup: {
          keyboard: [[{ text: '🔙 Main Menu' }]],
          resize_keyboard: true
        }
      })
      return
    }

    // Calculate stats
    const now = new Date()
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    
    const thisMonthTxns = transactions.filter(t => new Date(t.createdAt) >= thisMonthStart)
    const thisMonthTotal = thisMonthTxns.reduce((sum, t) => sum + (t.amount || 0), 0)
    const totalSpent = transactions.reduce((sum, t) => sum + (t.amount || 0), 0)
    
    // Status emojis
    const statusEmoji = {
      'completed': '✅',
      'pending': '⏳',
      'failed': '❌',
      'refunded': '↩️'
    }
    
    // Type labels
    const typeLabels = {
      en: {
        'domain': 'Domain',
        'hosting': 'Hosting',
        'phone': 'Phone Number',
        'wallet-topup': 'Wallet Top-up',
        'vps': 'VPS',
        'leads': 'Leads',
        'sms': 'SMS Service'
      },
      fr: {
        'domain': 'Domaine',
        'hosting': 'Hébergement',
        'phone': 'Numéro de téléphone',
        'wallet-topup': 'Recharge portefeuille',
        'vps': 'VPS',
        'leads': 'Leads',
        'sms': 'Service SMS'
      },
      zh: {
        'domain': '域名',
        'hosting': '主机',
        'phone': '电话号码',
        'wallet-topup': '钱包充值',
        'vps': 'VPS',
        'leads': '潜在客户',
        'sms': '短信服务'
      },
      hi: {
        'domain': 'डोमेन',
        'hosting': 'होस्टिंग',
        'phone': 'फोन नंबर',
        'wallet-topup': 'वॉलेट टॉप-अप',
        'vps': 'VPS',
        'leads': 'लीड्स',
        'sms': 'एसएमएस सेवा'
      }
    }
    
    const labels = typeLabels[lang] || typeLabels.en
    
    const titles = {
      en: '📜 Order History',
      fr: '📜 Historique des commandes',
      zh: '📜 订单历史',
      hi: '📜 ऑर्डर इतिहास'
    }
    
    const thisMonthLabel = {
      en: 'This Month',
      fr: 'Ce mois',
      zh: '本月',
      hi: 'इस महीने'
    }
    
    const totalLabel = {
      en: 'Total Lifetime',
      fr: 'Total',
      zh: '总计',
      hi: 'कुल'
    }
    
    const recentLabel = {
      en: 'Recent Orders',
      fr: 'Commandes récentes',
      zh: '最近订单',
      hi: 'हाल के ऑर्डर'
    }
    
    // Build message
    let msg = `${titles[lang] || titles.en}\n\n`
    msg += `${thisMonthLabel[lang] || thisMonthLabel.en}: ${thisMonthTxns.length} orders, $${thisMonthTotal.toFixed(2)}\n`
    msg += `${totalLabel[lang] || totalLabel.en}: ${transactions.length} orders, $${totalSpent.toFixed(2)}\n\n`
    msg += `${recentLabel[lang] || recentLabel.en}:\n`
    msg += `─────────────────\n`
    
    // Show recent 10 transactions
    const recentTxns = transactions.slice(0, 10)
    recentTxns.forEach(txn => {
      const date = new Date(txn.createdAt)
      const dateStr = date.toLocaleDateString(lang === 'en' ? 'en-US' : lang === 'fr' ? 'fr-FR' : lang === 'zh' ? 'zh-CN' : 'hi-IN')
      const status = statusEmoji[txn.status] || '❓'
      const type = labels[txn.type] || txn.type
      
      msg += `\n${dateStr} - $${txn.amount?.toFixed(2) || '0.00'}\n`
      msg += `${status} ${type}`
      
      // Add details from metadata
      if (txn.metadata) {
        if (txn.metadata.domain) msg += `: ${txn.metadata.domain}`
        else if (txn.metadata.phone) msg += `: ${txn.metadata.phone}`
        else if (txn.metadata.plan) msg += `: ${txn.metadata.plan}`
      }
      
      msg += `\n<code>${txn._id}</code>\n`
    })
    
    if (transactions.length > 10) {
      msg += `\n... and ${transactions.length - 10} more`
    }
    
    // Send with inline keyboard for actions
    await bot.sendMessage(chatId, msg, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📊 Export Full History', callback_data: 'export_history' },
          ],
          [
            { text: '🔙 Main Menu', callback_data: 'main_menu' }
          ]
        ]
      }
    })
    
  } catch (err) {
    console.error('[OrderHistory] Error:', err.message)
    
    const errorMsg = {
      en: '❌ Unable to load order history. Please try again later.',
      fr: '❌ Impossible de charger l\'historique. Réessayez plus tard.',
      zh: '❌ 无法加载订单历史。请稍后再试。',
      hi: '❌ ऑर्डर इतिहास लोड करने में असमर्थ। कृपया बाद में पुनः प्रयास करें।'
    }
    
    await bot.sendMessage(chatId, errorMsg[lang] || errorMsg.en, { parse_mode: 'HTML' })
  }
}

module.exports = {
  handleOrderHistory
}
