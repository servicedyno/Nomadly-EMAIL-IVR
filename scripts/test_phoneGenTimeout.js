/**
 * Sanity-check for computePhoneGenTimeout after the fix.
 * Asserts that 3000-lead CNAM jobs no longer pin the ceiling and have headroom.
 */

// Re-implement the formula here (the validatePhoneBulk.js file has heavy imports
// like nanoid that are not needed for this pure-math check).
const PHONE_GEN_TIMEOUT_FLOOR_MS = Number(process.env.PHONE_GEN_TIMEOUT_FLOOR_MS) || 10 * 60 * 1000;
const PHONE_GEN_TIMEOUT_CEILING_MS = Number(process.env.PHONE_GEN_TIMEOUT_CEILING_MS) || 240 * 60 * 1000;
const PHONE_GEN_BUDGET_PER_LEAD_MS = Number(process.env.PHONE_GEN_BUDGET_PER_LEAD_MS) || 1200;
const PHONE_GEN_CNAM_MULTIPLIER = Number(process.env.PHONE_GEN_CNAM_MULTIPLIER) || 2.0;
const PHONE_GEN_SAFETY_BUFFER = Number(process.env.PHONE_GEN_SAFETY_BUFFER) || 1.2;

const computePhoneGenTimeout = (targetCount, cnamEnabled) => {
  const budgetPerLead = cnamEnabled
    ? Math.ceil(PHONE_GEN_BUDGET_PER_LEAD_MS * PHONE_GEN_CNAM_MULTIPLIER)
    : PHONE_GEN_BUDGET_PER_LEAD_MS;
  const raw = Math.ceil(targetCount * budgetPerLead * PHONE_GEN_SAFETY_BUFFER);
  return Math.min(PHONE_GEN_TIMEOUT_CEILING_MS, Math.max(PHONE_GEN_TIMEOUT_FLOOR_MS, raw));
};

const cases = [
  { count: 100,  cnam: false, observedRateMsPerLead: 833,  desc: 'tiny non-CNAM (100)' },
  { count: 100,  cnam: true,  observedRateMsPerLead: 1980, desc: 'tiny CNAM (100)' },
  { count: 500,  cnam: true,  observedRateMsPerLead: 1980, desc: 'small CNAM (500)' },
  { count: 1000, cnam: true,  observedRateMsPerLead: 1980, desc: 'medium CNAM (1000)' },
  { count: 3000, cnam: false, observedRateMsPerLead: 833,  desc: 'large non-CNAM (3000)' },
  { count: 3000, cnam: true,  observedRateMsPerLead: 1980, desc: 'PROD CASE: 3000 CNAM (job f7c619a9)' },
  { count: 5000, cnam: true,  observedRateMsPerLead: 1980, desc: 'extra-large CNAM (5000)' },
  { count: 10000, cnam: true, observedRateMsPerLead: 1980, desc: 'mega CNAM (10000)' },
];

let pass = 0, fail = 0;
console.log('\n=== phoneGenTimeout sanity check ===\n');
console.log('Constants: floor=10min ceiling=240min budget=1200ms cnam_mult=2.0 buffer=1.2x\n');
const pad = (s, n) => String(s).padEnd(n);
const padL = (s, n) => String(s).padStart(n);
console.log(pad('Case', 40), padL('Budget', 10), padL('Expected', 10), padL('Headroom', 12), padL('Verdict', 10));
console.log('-'.repeat(90));
for (const c of cases) {
  const budgetMs = computePhoneGenTimeout(c.count, c.cnam);
  const expectedRealMs = c.count * c.observedRateMsPerLead;
  const headroomPct = ((budgetMs - expectedRealMs) / expectedRealMs) * 100;
  const ok = budgetMs >= expectedRealMs * 1.05; // need at least 5% buffer
  console.log(
    pad(c.desc, 40),
    padL((budgetMs / 60000).toFixed(1) + 'm', 10),
    padL((expectedRealMs / 60000).toFixed(1) + 'm', 10),
    padL(headroomPct.toFixed(1) + '%', 12),
    padL(ok ? 'PASS ✓' : 'FAIL ✗', 10),
  );
  ok ? pass++ : fail++;
}
console.log('-'.repeat(90));
console.log(`\nResult: ${pass} pass, ${fail} fail\n`);
process.exit(fail === 0 ? 0 : 1);
