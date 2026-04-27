/**
 * Regression test — "Last changed: X ago" on Manage-Number screen.
 *
 *   - `formatRelativeTime` returns sensible strings across 4 locales
 *   - `cpTxt.manageNumber(...)` includes the 🕒 line when `num.updatedAt` is set
 *   - `cpTxt.manageNumber(...)` OMITS the 🕒 line when `num.updatedAt` is absent
 *     (prevents confusing empty timestamps on legacy records)
 *
 * Run: `node js/tests/test_last_changed_timestamp.js`
 */

const pc = require('../phone-config')

let fails = 0
const assert = (cond, msg) => { if (cond) { console.log(`  ✅ ${msg}`) } else { console.log(`  ❌ ${msg}`); fails++ } }

const makeNum = (minsAgo) => ({
  phoneNumber: '+18005551212',
  plan: 'starter',
  planPrice: 5,
  status: 'active',
  capabilities: { voice: true, sms: true, fax: false },
  features: {},
  minutesUsed: 0,
  smsUsed: 0,
  updatedAt: minsAgo == null ? null : new Date(Date.now() - minsAgo * 60_000).toISOString(),
})

const EXPECT = {
  en: { 0: 'just now',   2: '2 mins ago',   65: '1 hr ago',       1560: '1 day ago',  11520: '1 wk ago' },
  fr: { 0: 'à l’instant', 2: 'il y a 2 min', 65: 'il y a 1 h',    1560: 'il y a 1 j', 11520: 'il y a 1 sem' },
  zh: { 0: '刚刚',        2: '2 分钟前',      65: '1 小时前',       1560: '1 天前',     11520: '1 周前' },
  hi: { 0: 'अभी अभी',    2: '2 मिनट पहले',  65: '1 घंटे पहले',    1560: '1 दिन पहले', 11520: '1 सप्ताह पहले' },
}

console.log('─── Locale rendering ───')
for (const lang of ['en', 'fr', 'zh', 'hi']) {
  const t = pc.getTxt(lang)
  for (const [mins, expected] of Object.entries(EXPECT[lang])) {
    const n = makeNum(Number(mins))
    const out = t.manageNumber(n, 0, 0, [n])
    assert(out.includes('🕒'), `${lang}/${mins}m: 🕒 line present`)
    assert(out.includes(expected), `${lang}/${mins}m: renders "${expected}"`)
  }
}

console.log('\n─── Null updatedAt hides the line ───')
for (const lang of ['en', 'fr', 'zh', 'hi']) {
  const t = pc.getTxt(lang)
  const n = makeNum(null)
  const out = t.manageNumber(n, 0, 0, [n])
  assert(!out.includes('🕒'), `${lang}: no 🕒 line when updatedAt is null`)
}

console.log('\n─── Summary ───')
if (fails === 0) {
  console.log('\n✅ All assertions passed.')
  process.exit(0)
} else {
  console.log(`\n❌ ${fails} assertions failed.`)
  process.exit(1)
}
