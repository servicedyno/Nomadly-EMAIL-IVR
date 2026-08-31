// Verifies the hosting welcome email: (1) is fully localized (en/fr/zh/hi)
// across header/greeting/labels/cta/footer/subject, and (2) includes the
// Cloudflare nameserver card ONLY for external domains with >=2 nameservers.
// No real email is sent — we exercise the pure helpers.
const sendEmail = require('../send-email')
const { buildEmailHtml, buildNameserverCard, emailSubject } = sendEmail

let pass = 0, fail = 0
function check(name, cond) {
  if (cond) { pass++; console.log(`  ✅ ${name}`) }
  else { fail++; console.log(`  ❌ ${name}`) }
}

const response = { username: 'ext12ab3' }
const pin = '482913'
const NS = ['carter.ns.cloudflare.com', 'donna.ns.cloudflare.com']

console.log('\n[1] External domain (en) → NS card present with both nameservers')
{
  const info = { email: 'user@proton.me', plan: 'Premium Anti-Red 1-Week', website_name: 'external-example.com', username: 'ext12ab3', connectExternalDomain: true, cfNameservers: NS, userLanguage: 'en' }
  const html = buildEmailHtml(info, response, pin)
  check('EN header title', html.includes('Your Hosting is Live!'))
  check('EN NS card title', html.includes('Update Your Nameservers'))
  check('contains NS1 value', html.includes(NS[0]))
  check('contains NS2 value', html.includes(NS[1]))
  check('EN subject', emailSubject(info).includes('is Live — Login Details Inside'))
}

console.log('\n[2] Full localization — header/greeting/labels/cta/footer/subject per language')
{
  const mk = (lang) => ({ website_name: 'x.com', username: 'u', plan: 'Premium Anti-Red 1-Month', userLanguage: lang })
  const fr = buildEmailHtml(mk('fr'), response, pin)
  check('FR header', fr.includes('Votre hébergement est en ligne !'))
  check('FR greeting', fr.includes('Bonjour'))
  check('FR label Domaine', fr.includes('Domaine'))
  check('FR label Forfait', fr.includes('Forfait'))
  check('FR CTA', fr.includes('Se connecter au panneau'))
  check('FR footer automated', fr.includes('message automatique'))
  check('FR duration 1 mois', fr.includes('1 mois'))
  check('FR subject', emailSubject(mk('fr')).includes('est en ligne'))

  const zh = buildEmailHtml(mk('zh'), response, pin)
  check('ZH header', zh.includes('您的主机已上线'))
  check('ZH label 域名', zh.includes('域名'))
  check('ZH CTA', zh.includes('登录面板'))
  check('ZH footer', zh.includes('自动发送'))
  check('ZH duration 个月', zh.includes('1 个月'))
  check('ZH subject', emailSubject(mk('zh')).includes('已上线'))

  const hi = buildEmailHtml(mk('hi'), response, pin)
  check('HI header', hi.includes('आपकी होस्टिंग लाइव है'))
  check('HI label डोमेन', hi.includes('डोमेन'))
  check('HI CTA', hi.includes('पैनल में लॉगिन करें'))
  check('HI footer', hi.includes('स्वचालित संदेश'))
  check('HI subject', emailSubject(mk('hi')).includes('लाइव है'))
}

console.log('\n[3] External NS card localized (fr/zh/hi)')
{
  const mk = (lang) => ({ website_name: 'x.com', username: 'u', connectExternalDomain: true, cfNameservers: NS, userLanguage: lang })
  check('FR NS title', buildNameserverCard(mk('fr')).includes('Mettez à jour vos serveurs de noms'))
  check('ZH NS title', buildNameserverCard(mk('zh')).includes('更新您的域名服务器'))
  check('HI NS title', buildNameserverCard(mk('hi')).includes('अपने नेमसर्वर अपडेट करें'))
}

console.log('\n[4] Internal/registered domain → NO NS card (still localized shell)')
{
  const info = { plan: 'Premium Anti-Red 1-Week', website_name: 'registered-with-us.com', username: 'int55cd2', connectExternalDomain: false, cfNameservers: NS, userLanguage: 'fr' }
  const html = buildEmailHtml(info, response, pin)
  check('no NS card title', !html.includes('serveurs de noms'))
  check('buildNameserverCard returns empty', buildNameserverCard(info) === '')
  check('still localized (FR login details)', html.includes('Identifiants de connexion'))
}

console.log('\n[5] External domain but <2 nameservers → NO NS card (no partial leak)')
{
  check('one NS → card empty', buildNameserverCard({ website_name: 'x', username: 'y', connectExternalDomain: true, cfNameservers: ['only.ns'], userLanguage: 'en' }) === '')
  check('zero NS → card empty', buildNameserverCard({ website_name: 'x', username: 'y', connectExternalDomain: true, cfNameservers: [], userLanguage: 'en' }) === '')
  check('undefined NS → card empty', buildNameserverCard({ website_name: 'x', username: 'y', connectExternalDomain: true, userLanguage: 'en' }) === '')
}

console.log('\n[6] Unknown language falls back to EN')
{
  const info = { website_name: 'x.com', username: 'y', plan: 'Premium Anti-Red 1-Week', connectExternalDomain: true, cfNameservers: NS, userLanguage: 'de' }
  check('EN header fallback', buildEmailHtml(info, response, pin).includes('Your Hosting is Live!'))
  check('EN NS card fallback', buildNameserverCard(info).includes('Update Your Nameservers'))
}

console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`)
process.exit(fail === 0 ? 0 : 1)
