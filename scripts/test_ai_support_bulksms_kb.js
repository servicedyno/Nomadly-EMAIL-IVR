/**
 * Regression test for the BulkSMS [name] knowledge-base entry added to
 * /app/js/ai-support.js. Ensures the SYSTEM_PROMPT contains the canonical
 * answer so the LLM no longer hallucinates CNAM as the cause of "[name] not
 * working" complaints (the prod incident from chatId 7080940684).
 */

const fs = require('fs');
const src = fs.readFileSync('/app/js/ai-support.js', 'utf8');

let pass = 0, fail = 0;
function t(name, cond, hint) {
  if (cond) { console.log('✓', name); pass++; }
  else { console.error('✗', name, hint ? '— ' + hint : ''); fail++; }
}

t('KB section title is present',
  /\[name\] is not working in my BulkSMS message/.test(src),
  'add "### \"[name] is not working in my BulkSMS message\"…" heading'
);
t('Canonical [name] syntax explicitly listed',
  /canonical\s*syntax.*\[name\]/i.test(src) || /<b>\[name\]<\/b>/.test(src),
  'mention <b>[name]</b> as canonical'
);
t('Variant syntaxes documented as accepted in v2.7.6+',
  /\{name\}/.test(src) && /<name>|&lt;name&gt;/.test(src) && /%name%/.test(src),
  'mention {name}, <name>, %name% are accepted variants'
);
t('Comma + space contact formats both documented',
  /\+\d+.*,.*\bcomma\b/i.test(src) && /single\s+space.*fallback/i.test(src),
  'show "+12128686239,John" and "+12128686239 John" examples'
);
t('Explicitly tells AI NOT to blame CNAM (the prior hallucination)',
  /Do\s*NOT.*CNAM/i.test(src) && /CNAM is only for the Phone Leads/i.test(src),
  'add "Do NOT say [name] uses CNAM" guard rail'
);
t('References the orange warning banner',
  /warning banner|orange.*banner/i.test(src),
  'tell the AI to mention the new review-screen banner'
);
t('Tells user to upgrade to v2.7.6+',
  /v?2\.7\.6/.test(src),
  'recommend the app version that contains the parser fix'
);

console.log(`\nResult: ${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
