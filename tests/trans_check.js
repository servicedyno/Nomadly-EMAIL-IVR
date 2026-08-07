const { translation } = require('/app/js/translation.js');
const langs = ['en','fr','zh','hi'];
const failures = [];
const checks = [
  ['t.ivrTrialNudge', []],
  ['t.fwdEnterNumber', [0.5, 25, 0.15]],
  ['t.fwdConfirm', ['+1x','+1y','Always',0.5,25,50]],
  ['t.fwdConfirmBtn', []],
];
for (const lang of langs) {
  for (const [key, args] of checks) {
    const v = translation(key, lang, ...args);
    if (!v || typeof v !== 'string' || v === key) failures.push(`${lang}.${key}: raw/empty (${JSON.stringify(v).slice(0,80)})`);
    else if (v.includes('\\n')) failures.push(`${lang}.${key}: literal backslash-n`);
    else console.log(`OK ${lang}.${key} len=${v.length}`);
  }
}
for (const lang of langs) {
  const mod = require(`/app/js/lang/${lang}.js`);
  const vs = mod[lang].vs;
  const v = typeof vs.lowBalanceForward === 'function' ? vs.lowBalanceForward('1.20', 8) : vs.lowBalanceForward;
  if (!v || typeof v !== 'string') failures.push(`${lang}.vs.lowBalanceForward empty`);
  else if (v.includes('\\n')) failures.push(`${lang}.vs.lowBalanceForward literal backslash-n`);
  else console.log(`OK ${lang}.vs.lowBalanceForward len=${v.length}`);
}
console.log('\nFAILURES:', failures.length);
failures.forEach(f => console.log(' -', f));
process.exit(failures.length ? 1 : 0);
