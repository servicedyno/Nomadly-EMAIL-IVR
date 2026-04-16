/**
 * Smart Recommendations System
 * Suggests relevant services based on user's purchase history
 */

/**
 * Generate recommendations after domain purchase
 */
function getRecommendationsAfterDomain(domain, lang = 'en') {
  const messages = {
    en: {
      title: '🎉 Domain Registered Successfully!',
      domain: 'Domain',
      complete: '📦 Complete Your Setup',
      subtitle: 'Most users also add:',
      hosting: {
        title: '☑️ Premium Hosting',
        price: '$4.99/mo',
        desc: '→ Launch your website',
        badge: '🔥 Popular'
      },
      email: {
        title: '☑️ Professional Email',
        price: '$2.99/mo',
        desc: `→ Get you@${domain}`,
        badge: '⭐ Recommended'
      },
      shortener: {
        title: '☑️ URL Shortener',
        price: 'Free',
        desc: '→ Create branded short links',
        badge: '✨ Free'
      },
      total: 'Total',
      buttons: {
        addRecommended: '✅ Add Recommended',
        addHosting: '🏠 Add Hosting Only',
        skip: '⏭️ Skip for Now'
      }
    },
    fr: {
      title: '🎉 Domaine enregistré avec succès !',
      domain: 'Domaine',
      complete: '📦 Complétez votre configuration',
      subtitle: 'La plupart des utilisateurs ajoutent également :',
      hosting: {
        title: '☑️ Hébergement Premium',
        price: '$4.99/mois',
        desc: '→ Lancez votre site web',
        badge: '🔥 Populaire'
      },
      email: {
        title: '☑️ Email professionnel',
        price: '$2.99/mois',
        desc: `→ Obtenez vous@${domain}`,
        badge: '⭐ Recommandé'
      },
      shortener: {
        title: '☑️ Raccourcisseur d\'URL',
        price: 'Gratuit',
        desc: '→ Créez des liens courts de marque',
        badge: '✨ Gratuit'
      },
      total: 'Total',
      buttons: {
        addRecommended: '✅ Ajouter recommandé',
        addHosting: '🏠 Ajouter hébergement uniquement',
        skip: '⏭️ Passer pour l\'instant'
      }
    },
    zh: {
      title: '🎉 域名注册成功！',
      domain: '域名',
      complete: '📦 完成您的设置',
      subtitle: '大多数用户还添加：',
      hosting: {
        title: '☑️ 高级主机',
        price: '$4.99/月',
        desc: '→ 启动您的网站',
        badge: '🔥 热门'
      },
      email: {
        title: '☑️ 专业电子邮件',
        price: '$2.99/月',
        desc: `→ 获取您@${domain}`,
        badge: '⭐ 推荐'
      },
      shortener: {
        title: '☑️ URL 短链接',
        price: '免费',
        desc: '→ 创建品牌短链接',
        badge: '✨ 免费'
      },
      total: '总计',
      buttons: {
        addRecommended: '✅ 添加推荐',
        addHosting: '🏠 仅添加主机',
        skip: '⏭️ 暂时跳过'
      }
    },
    hi: {
      title: '🎉 डोमेन सफलतापूर्वक पंजीकृत!',
      domain: 'डोमेन',
      complete: '📦 अपना सेटअप पूरा करें',
      subtitle: 'अधिकांश उपयोगकर्ता यह भी जोड़ते हैं:',
      hosting: {
        title: '☑️ प्रीमियम होस्टिंग',
        price: '$4.99/माह',
        desc: '→ अपनी वेबसाइट लॉन्च करें',
        badge: '🔥 लोकप्रिय'
      },
      email: {
        title: '☑️ व्यावसायिक ईमेल',
        price: '$2.99/माह',
        desc: `→ आप@${domain} प्राप्त करें`,
        badge: '⭐ अनुशंसित'
      },
      shortener: {
        title: '☑️ URL शॉर्टनर',
        price: 'मुफ़्त',
        desc: '→ ब्रांडेड शॉर्ट लिंक बनाएं',
        badge: '✨ मुफ़्त'
      },
      total: 'कुल',
      buttons: {
        addRecommended: '✅ अनुशंसित जोड़ें',
        addHosting: '🏠 केवल होस्टिंग जोड़ें',
        skip: '⏭️ अभी के लिए छोड़ें'
      }
    }
  }

  const t = messages[lang] || messages.en
  const totalPrice = 7.98 // $4.99 + $2.99

  const message = `${t.title}\n\n` +
    `<b>${t.domain}:</b> ${domain}\n\n` +
    `${t.complete}\n\n` +
    `${t.subtitle}\n` +
    `${t.hosting.title} - <b>${t.hosting.price}</b> ${t.hosting.badge}\n` +
    `${t.hosting.desc}\n\n` +
    `${t.email.title} - <b>${t.email.price}</b> ${t.email.badge}\n` +
    `${t.email.desc}\n\n` +
    `${t.shortener.title} - <b>${t.shortener.price}</b> ${t.shortener.badge}\n` +
    `${t.shortener.desc}\n\n` +
    `<b>${t.total}:</b> $${totalPrice.toFixed(2)}`

  return {
    message,
    keyboard: [
      [t.buttons.addRecommended],
      [t.buttons.addHosting],
      [t.buttons.skip]
    ],
    prices: {
      hosting: 4.99,
      email: 2.99,
      total: totalPrice
    }
  }
}

/**
 * Generate recommendations after hosting purchase
 */
function getRecommendationsAfterHosting(domain, lang = 'en') {
  const messages = {
    en: {
      title: '🎉 Hosting Activated!',
      enhance: '🚀 Enhance Your Setup',
      subtitle: 'Popular add-ons for your website:',
      email: {
        title: '📧 Professional Email',
        price: '$2.99/mo',
        desc: `→ you@${domain}`,
        value: '90% of sites use this'
      },
      cdn: {
        title: '⚡ CDN + DDoS Protection',
        price: '$9.99/mo',
        desc: '→ Faster loading, secure from attacks',
        value: 'Recommended for business sites'
      },
      backup: {
        title: '💾 Daily Backups',
        price: '$4.99/mo',
        desc: '→ Automatic daily backups',
        value: 'Peace of mind'
      },
      buttons: {
        addEmail: '📧 Add Email ($2.99)',
        addAll: '✅ Add All ($17.97)',
        skip: '⏭️ Maybe Later'
      }
    },
    fr: {
      title: '🎉 Hébergement activé !',
      enhance: '🚀 Améliorez votre configuration',
      subtitle: 'Modules complémentaires populaires pour votre site :',
      email: {
        title: '📧 Email professionnel',
        price: '$2.99/mois',
        desc: `→ vous@${domain}`,
        value: '90% des sites l\'utilisent'
      },
      cdn: {
        title: '⚡ CDN + Protection DDoS',
        price: '$9.99/mois',
        desc: '→ Chargement plus rapide, sécurisé',
        value: 'Recommandé pour les sites professionnels'
      },
      backup: {
        title: '💾 Sauvegardes quotidiennes',
        price: '$4.99/mois',
        desc: '→ Sauvegardes automatiques quotidiennes',
        value: 'Tranquillité d\'esprit'
      },
      buttons: {
        addEmail: '📧 Ajouter email ($2.99)',
        addAll: '✅ Tout ajouter ($17.97)',
        skip: '⏭️ Peut-être plus tard'
      }
    },
    zh: {
      title: '🎉 主机已激活！',
      enhance: '🚀 增强您的设置',
      subtitle: '您网站的热门附加组件：',
      email: {
        title: '📧 专业电子邮件',
        price: '$2.99/月',
        desc: `→ 您@${domain}`,
        value: '90% 的网站使用此功能'
      },
      cdn: {
        title: '⚡ CDN + DDoS 保护',
        price: '$9.99/月',
        desc: '→ 加载更快，防止攻击',
        value: '推荐商业网站使用'
      },
      backup: {
        title: '💾 每日备份',
        price: '$4.99/月',
        desc: '→ 自动每日备份',
        value: '安心保障'
      },
      buttons: {
        addEmail: '📧 添加电子邮件 ($2.99)',
        addAll: '✅ 全部添加 ($17.97)',
        skip: '⏭️ 稍后再说'
      }
    },
    hi: {
      title: '🎉 होस्टिंग सक्रिय!',
      enhance: '🚀 अपने सेटअप को बढ़ाएं',
      subtitle: 'आपकी वेबसाइट के लिए लोकप्रिय ऐड-ऑन:',
      email: {
        title: '📧 व्यावसायिक ईमेल',
        price: '$2.99/माह',
        desc: `→ आप@${domain}`,
        value: '90% साइटें इसका उपयोग करती हैं'
      },
      cdn: {
        title: '⚡ CDN + DDoS सुरक्षा',
        price: '$9.99/माह',
        desc: '→ तेज़ लोडिंग, हमलों से सुरक्षित',
        value: 'व्यवसाय साइटों के लिए अनुशंसित'
      },
      backup: {
        title: '💾 दैनिक बैकअप',
        price: '$4.99/माह',
        desc: '→ स्वचालित दैनिक बैकअप',
        value: 'मन की शांति'
      },
      buttons: {
        addEmail: '📧 ईमेल जोड़ें ($2.99)',
        addAll: '✅ सभी जोड़ें ($17.97)',
        skip: '⏭️ शायद बाद में'
      }
    }
  }

  const t = messages[lang] || messages.en
  const totalPrice = 17.97 // $2.99 + $9.99 + $4.99

  const message = `${t.title}\n\n` +
    `${t.enhance}\n\n` +
    `${t.subtitle}\n\n` +
    `${t.email.title} - <b>${t.email.price}</b>\n` +
    `${t.email.desc}\n` +
    `<i>${t.email.value}</i>\n\n` +
    `${t.cdn.title} - <b>${t.cdn.price}</b>\n` +
    `${t.cdn.desc}\n` +
    `<i>${t.cdn.value}</i>\n\n` +
    `${t.backup.title} - <b>${t.backup.price}</b>\n` +
    `${t.backup.desc}\n` +
    `<i>${t.backup.value}</i>`

  return {
    message,
    keyboard: [
      [t.buttons.addEmail],
      [t.buttons.addAll],
      [t.buttons.skip]
    ],
    prices: {
      email: 2.99,
      cdn: 9.99,
      backup: 4.99,
      total: totalPrice
    }
  }
}

/**
 * Generate recommendations after phone purchase
 */
function getRecommendationsAfterPhone(phoneNumber, lang = 'en') {
  const messages = {
    en: {
      title: '📱 Phone Number Activated!',
      number: 'Number',
      maximize: '📈 Maximize Your Phone Service',
      subtitle: 'Popular upgrades:',
      additional: {
        title: '📱 Additional Numbers',
        price: 'From $8.99/mo',
        desc: '→ Separate lines for different purposes',
        value: '60% of users add 2+ numbers'
      },
      sms: {
        title: '💬 SMS Service',
        price: '$5.99/mo',
        desc: '→ Send/receive text messages',
        value: 'Essential for 2FA & notifications'
      },
      callRecording: {
        title: '🎙️ Call Recording',
        price: '$3.99/mo',
        desc: '→ Record important calls',
        value: 'Great for business'
      },
      buttons: {
        addSMS: '💬 Add SMS ($5.99)',
        addNumber: '📱 Add Another Number',
        skip: '⏭️ Not Now'
      }
    },
    fr: {
      title: '📱 Numéro de téléphone activé !',
      number: 'Numéro',
      maximize: '📈 Maximisez votre service téléphonique',
      subtitle: 'Mises à niveau populaires :',
      additional: {
        title: '📱 Numéros supplémentaires',
        price: 'À partir de $8.99/mois',
        desc: '→ Lignes séparées pour différents usages',
        value: '60% des utilisateurs ajoutent 2+ numéros'
      },
      sms: {
        title: '💬 Service SMS',
        price: '$5.99/mois',
        desc: '→ Envoyer/recevoir des SMS',
        value: 'Essentiel pour 2FA et notifications'
      },
      callRecording: {
        title: '🎙️ Enregistrement d\'appels',
        price: '$3.99/mois',
        desc: '→ Enregistrer les appels importants',
        value: 'Idéal pour les entreprises'
      },
      buttons: {
        addSMS: '💬 Ajouter SMS ($5.99)',
        addNumber: '📱 Ajouter un autre numéro',
        skip: '⏭️ Pas maintenant'
      }
    },
    zh: {
      title: '📱 电话号码已激活！',
      number: '号码',
      maximize: '📈 最大化您的电话服务',
      subtitle: '热门升级：',
      additional: {
        title: '📱 附加号码',
        price: '从 $8.99/月起',
        desc: '→ 不同用途的独立线路',
        value: '60% 的用户添加 2+ 号码'
      },
      sms: {
        title: '💬 短信服务',
        price: '$5.99/月',
        desc: '→ 发送/接收短信',
        value: '对于 2FA 和通知至关重要'
      },
      callRecording: {
        title: '🎙️ 通话录音',
        price: '$3.99/月',
        desc: '→ 录制重要通话',
        value: '非常适合商业用途'
      },
      buttons: {
        addSMS: '💬 添加短信 ($5.99)',
        addNumber: '📱 添加另一个号码',
        skip: '⏭️ 暂时不需要'
      }
    },
    hi: {
      title: '📱 फोन नंबर सक्रिय!',
      number: 'नंबर',
      maximize: '📈 अपनी फोन सेवा को अधिकतम करें',
      subtitle: 'लोकप्रिय अपग्रेड:',
      additional: {
        title: '📱 अतिरिक्त नंबर',
        price: '$8.99/माह से',
        desc: '→ विभिन्न उद्देश्यों के लिए अलग लाइनें',
        value: '60% उपयोगकर्ता 2+ नंबर जोड़ते हैं'
      },
      sms: {
        title: '💬 एसएमएस सेवा',
        price: '$5.99/माह',
        desc: '→ टेक्स्ट संदेश भेजें/प्राप्त करें',
        value: '2FA और सूचनाओं के लिए आवश्यक'
      },
      callRecording: {
        title: '🎙️ कॉल रिकॉर्डिंग',
        price: '$3.99/माह',
        desc: '→ महत्वपूर्ण कॉल रिकॉर्ड करें',
        value: 'व्यवसाय के लिए बढ़िया'
      },
      buttons: {
        addSMS: '💬 एसएमएस जोड़ें ($5.99)',
        addNumber: '📱 एक और नंबर जोड़ें',
        skip: '⏭️ अभी नहीं'
      }
    }
  }

  const t = messages[lang] || messages.en

  const message = `${t.title}\n\n` +
    `<b>${t.number}:</b> ${phoneNumber}\n\n` +
    `${t.maximize}\n\n` +
    `${t.subtitle}\n\n` +
    `${t.additional.title} - <b>${t.additional.price}</b>\n` +
    `${t.additional.desc}\n` +
    `<i>${t.additional.value}</i>\n\n` +
    `${t.sms.title} - <b>${t.sms.price}</b>\n` +
    `${t.sms.desc}\n` +
    `<i>${t.sms.value}</i>\n\n` +
    `${t.callRecording.title} - <b>${t.callRecording.price}</b>\n` +
    `${t.callRecording.desc}\n` +
    `<i>${t.callRecording.value}</i>`

  return {
    message,
    keyboard: [
      [t.buttons.addSMS],
      [t.buttons.addNumber],
      [t.buttons.skip]
    ],
    prices: {
      sms: 5.99,
      callRecording: 3.99,
      additionalNumber: 8.99
    }
  }
}

module.exports = {
  getRecommendationsAfterDomain,
  getRecommendationsAfterHosting,
  getRecommendationsAfterPhone
}
