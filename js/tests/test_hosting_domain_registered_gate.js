#!/usr/bin/env node
/**
 * Static assertions for the 2026-07-06 hosting-purchase bug fix (@HHR2009 incident).
 * 
 * Verifies:
 * FIX 1 — proceedWithEmail persists domainPrice to state
 * FIX 2 — registerDomainAndCreateCpanel tracks domainRegistered flag
 * FIX 3 — all 4 payment paths gate "domain_only" on domainRegistered === true
 */

const fs = require('fs');
const path = require('path');

const indexJs = fs.readFileSync(path.join(__dirname, '../_index.js'), 'utf8');
const crRegisterJs = fs.readFileSync(path.join(__dirname, '../cr-register-domain-&-create-cpanel.js'), 'utf8');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ ${message}`);
    passed++;
  } else {
    console.error(`❌ ${message}`);
    failed++;
  }
}

console.log('═══════════════════════════════════════════════════════════════');
console.log('STATIC ASSERTIONS — Hosting Purchase Bug Fix (2026-07-06)');
console.log('═══════════════════════════════════════════════════════════════\n');

// ============================================================================
// FIX 1 — proceedWithEmail persists domainPrice
// ============================================================================
console.log('FIX 1 — proceedWithEmail persists domainPrice to state\n');

// A1: Exactly ONE saveInfo("domainPrice") inside proceedWithEmail
const saveInfoDomainPriceMatches = indexJs.match(/saveInfo\("domainPrice"/g);
assert(
  saveInfoDomainPriceMatches && saveInfoDomainPriceMatches.length === 1,
  `A1: _index.js contains exactly ONE saveInfo("domainPrice") (found ${saveInfoDomainPriceMatches ? saveInfoDomainPriceMatches.length : 0})`
);

// A2: info.domainPrice = domainPrice inside proceedWithEmail
const infoDomainPriceAssignment = indexJs.includes('info.domainPrice = domainPrice');
assert(
  infoDomainPriceAssignment,
  'A2: _index.js contains "info.domainPrice = domainPrice" assignment'
);

// A3: OLD pattern "info?.domainPrice || info?.price || 0" should NOT exist
const oldPatternMatches = indexJs.match(/info\?\.domainPrice \|\| info\?\.price \|\| 0/g);
assert(
  !oldPatternMatches || oldPatternMatches.length === 0,
  `A3: _index.js does NOT contain old pattern "info?.domainPrice || info?.price || 0" (found ${oldPatternMatches ? oldPatternMatches.length : 0})`
);

// A4: NEW pattern "info?.domainPrice ??" should exist at least 4 times (one per payment path)
const newPatternMatches = indexJs.match(/info\?\.domainPrice \?\?/g);
assert(
  newPatternMatches && newPatternMatches.length >= 4,
  `A4: _index.js contains at least 4 occurrences of new pattern "info?.domainPrice ??" (found ${newPatternMatches ? newPatternMatches.length : 0})`
);

// ============================================================================
// FIX 2 — registerDomainAndCreateCpanel tracks domainRegistered
// ============================================================================
console.log('\nFIX 2 — registerDomainAndCreateCpanel tracks domainRegistered flag\n');

// B1: Init line "let domainRegistered = !!(..."
const domainRegisteredInit = crRegisterJs.includes('let domainRegistered = !!(');
assert(
  domainRegisteredInit,
  'B1: cr-register-domain-&-create-cpanel.js contains "let domainRegistered = !!(..." init line'
);

// B2: Set-on-success line "domainRegistered = true"
const domainRegisteredSetTrue = crRegisterJs.includes('domainRegistered = true');
assert(
  domainRegisteredSetTrue,
  'B2: cr-register-domain-&-create-cpanel.js contains "domainRegistered = true" set-on-success line'
);

// B3: Check that domainRegistered appears in failure return statements
// (excluding early returns like duplicate_provisioning_prevented which happen before domain logic)
// Format: return { success: false, error: '...', domainRegistered }
const linesWithDomainRegistered = crRegisterJs.split('\n').filter(line => 
  line.includes('return { success: false') && line.includes('domainRegistered')
);
assert(
  linesWithDomainRegistered.length >= 3,
  `B3: At least 3 "return { success: false" statements include domainRegistered field (found ${linesWithDomainRegistered.length})`
);

// B4: Final success return includes "domainRegistered: true"
const finalSuccessReturn = crRegisterJs.includes('domainRegistered: true');
assert(
  finalSuccessReturn,
  'B4: cr-register-domain-&-create-cpanel.js final success return includes "domainRegistered: true"'
);

// B5: Cleanup key list includes 'domainPrice'
const cleanupIncludesDomainPrice = crRegisterJs.includes("'domainPrice'");
assert(
  cleanupIncludesDomainPrice,
  "B5: cr-register-domain-&-create-cpanel.js cleanup key list includes 'domainPrice'"
);

// ============================================================================
// FIX 3 — All 4 payment paths gate "domain_only" on domainRegistered === true
// ============================================================================
console.log('\nFIX 3 — All 4 payment paths gate "domain_only" on domainRegistered === true\n');

// C1: At least 4 occurrences of "hostingResult?.domainRegistered === true"
const domainRegisteredGateMatches = indexJs.match(/hostingResult\?\.domainRegistered === true/g);
assert(
  domainRegisteredGateMatches && domainRegisteredGateMatches.length >= 4,
  `C1: _index.js contains at least 4 occurrences of "hostingResult?.domainRegistered === true" (found ${domainRegisteredGateMatches ? domainRegisteredGateMatches.length : 0})`
);

// C2: Verify the 4 payment paths have the gate
// We'll look for the gate appearing after registerDomainAndCreateCpanel calls

// Find all sections with registerDomainAndCreateCpanel followed by domainRegistered check
const registerCallPattern = /registerDomainAndCreateCpanel[\s\S]{0,3000}hostingResult\?\.domainRegistered === true/g;
const registerCallMatches = indexJs.match(registerCallPattern);
assert(
  registerCallMatches && registerCallMatches.length >= 4,
  `C2: At least 4 payment paths have domainRegistered gate after registerDomainAndCreateCpanel (found ${registerCallMatches ? registerCallMatches.length : 0})`
);

// C3: Verify the gate condition structure includes the full check
// Looking for: !info?.existingDomain && !info?.connectExternalDomain && ... && hostingResult?.domainRegistered === true
const fullGateConditionPattern = /!info\?\.existingDomain\s*&&\s*!info\?\.connectExternalDomain[\s\S]{0,200}hostingResult\?\.domainRegistered === true/g;
const fullGateMatches = indexJs.match(fullGateConditionPattern);
assert(
  fullGateMatches && fullGateMatches.length >= 2,
  `C3: At least 2 payment paths have full gate condition with existingDomain/connectExternalDomain checks (found ${fullGateMatches ? fullGateMatches.length : 0})`
);

// ============================================================================
// SUMMARY
// ============================================================================
console.log('\n═══════════════════════════════════════════════════════════════');
console.log(`RESULT: ${passed} passed, ${failed} failed`);
console.log('═══════════════════════════════════════════════════════════════');

process.exit(failed > 0 ? 1 : 0);
