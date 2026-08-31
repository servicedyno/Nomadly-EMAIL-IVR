// Verifies the hosting welcome email includes localized Cloudflare nameserver
// instructions ONLY for external domains with >=2 nameservers. No real email
// is sent — we exercise the pure buildEmailHtml/buildNameserverCard helpers.
const assert = require('assert')
const sendEmail = require('../send-email')
const { buildEmailHtml, buildNameserverCard } = sendEmail

let pass = 0
let fail = 0
function check(name, cond) {
  if (cond) { pass++; console.log(`  ✅ ${name}`) }
  else { fail++; console.log(`  ❌ ${name}`) }
}

const response = { username: 'ext12ab3' }
const pin = '482913'
const NS = ['carter.ns.cloudflare.com', 'donna.ns.cloudflare.com']

console.log('\n[1] External domain (en) → NS card present with both nameservers')
{
  const info = {
    email: 'user@proton.me', plan: 'Premium Anti-Red 1-Week',
    website_name: 'external-example.com', username: 'ext12ab3',
    connectExternalDomain: true, cfNameservers: NS, userLanguage: 'en',
  }
  const html = buildEmailHtml(info, response, pin)
  check('contains EN title', html.includes('Update Your Nameservers'))
  check('contains NS1 value', html.includes(NS[0]))
  check('contains NS2 value', html.includes(NS[1]))
  check('mentions domain in intro', html.includes('external-example.com'))
  check('has NS1 label', html.includes('>NS1<'))
  check('has NS2 label', html.includes('>NS2<'))
}

console.log('\n[2] External domain via _isExternalDomain flag (fr) → localized card')
{
  const info = {
    email: 'user@proton.me', plan: 'Premium Anti-Red 1-Month',
    website_name: 'exemple-externe.fr', username: 'ext99zz1',
    _isExternalDomain: true, cfNameservers: NS, userLanguage: 'fr',
  }
  const html = buildEmailHtml(info, response, pin)
  check('contains FR title', html.includes('Mettez à jour vos serveurs de noms'))
  check('contains both NS', html.includes(NS[0]) && html.includes(NS[1]))
}

console.log('\n[3] External domain (zh / hi) → localized titles')
{
  const zh = buildEmailHtml({ website_name: 'x.com', username: 'u', connectExternalDomain: true, cfNameservers: NS, userLanguage: 'zh' }, response, pin)
  const hi = buildEmailHtml({ website_name: 'x.com', username: 'u', connectExternalDomain: true, cfNameservers: NS, userLanguage: 'hi' }, response, pin)
  check('ZH title present', zh.includes('更新您的域名服务器'))
  check('HI title present', hi.includes('अपने नेमसर्वर अपडेट करें'))
}

console.log('\n[4] Internal/registered domain → NO NS card')
{
  const info = {
    email: 'user@proton.me', plan: 'Premium Anti-Red 1-Week',
    website_name: 'registered-with-us.com', username: 'int55cd2',
    connectExternalDomain: false, cfNameservers: NS, userLanguage: 'en',
  }
  const html = buildEmailHtml(info, response, pin)
  check('no NS card title', !html.includes('Update Your Nameservers'))
  check('buildNameserverCard returns empty', buildNameserverCard(info) === '')
  check('still has login details', html.includes('Login Details'))
}

console.log('\n[5] External domain but <2 nameservers → NO NS card (no partial leak)')
{
  const info = {
    website_name: 'external-onlyone.com', username: 'ext11', connectExternalDomain: true,
    cfNameservers: ['only.ns.cloudflare.com'], userLanguage: 'en',
  }
  check('one NS → card empty', buildNameserverCard(info) === '')
  const info2 = { website_name: 'x.com', username: 'y', connectExternalDomain: true, cfNameservers: [], userLanguage: 'en' }
  check('zero NS → card empty', buildNameserverCard(info2) === '')
  const info3 = { website_name: 'x.com', username: 'y', connectExternalDomain: true, userLanguage: 'en' }
  check('undefined NS → card empty', buildNameserverCard(info3) === '')
}

console.log('\n[6] Unknown language falls back to EN card')
{
  const info = { website_name: 'x.com', username: 'y', connectExternalDomain: true, cfNameservers: NS, userLanguage: 'de' }
  check('falls back to EN title', buildNameserverCard(info).includes('Update Your Nameservers'))
}

console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`)
process.exit(fail === 0 ? 0 : 1)
