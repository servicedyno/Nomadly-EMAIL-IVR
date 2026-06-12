/**
 * Regression test — Contabo Windows image selection must ALWAYS pick DE
 * (Datacenter Edition), not SE (Standard Edition).
 *
 * Background: 2026-02 incident — Contabo started rejecting SE images on
 * V94/V95 with `cannot use this image with selected product`. Probe matrix:
 *
 *   V94 + 2025-se: ✗      V94 + 2025-de: ✓
 *   V95 + 2025-se: ✗      V95 + 2025-de: ✓
 *
 * The earlier code path picked SE for NVMe products (V91/V94/V97/...) —
 * that convention is now broken. This test guards against re-introducing it.
 */
const fs = require('fs')
const path = require('path')

const src = fs.readFileSync(path.join(__dirname, '..', 'contabo-service.js'), 'utf-8')

let pass = 0
let fail = 0
function ok(name, cond, hint) {
  if (cond) { console.log(`  ✓ ${name}`); pass++ }
  else { console.log(`  ✗ ${name}${hint ? ' — ' + hint : ''}`); fail++ }
}

// 1. Default constant must be DE
ok('DEFAULT_WINDOWS_IMAGE_DE defined',
  /const\s+DEFAULT_WINDOWS_IMAGE_DE\s*=\s*['"]windows-server-2025-de['"]/.test(src))

ok('DEFAULT_WINDOWS_IMAGE points at DE constant',
  /const\s+DEFAULT_WINDOWS_IMAGE\s*=\s*DEFAULT_WINDOWS_IMAGE_DE/.test(src))

// 2. The old SE-for-NVMe constant must be GONE
ok('No DEFAULT_WINDOWS_IMAGE_NVME left (would re-introduce SE-for-NVMe bug)',
  !/DEFAULT_WINDOWS_IMAGE_NVME/.test(src),
  'old NVMe-specific Windows constant still present')

ok('No DEFAULT_WINDOWS_IMAGE_SSD code reference (only allowed inside comments)',
  // Allow the comment reference that explains the migration
  !/^\s*const\s+DEFAULT_WINDOWS_IMAGE_SSD/m.test(src) && !/[^/'"`]DEFAULT_WINDOWS_IMAGE_SSD[^a-zA-Z]/.test(src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')),
  'old SSD-specific Windows constant still has live code reference')

// 3. getDefaultWindowsImageId must NOT branch on isSSDProduct / isNVMeProduct
//    (the bug was: it picked SE for NVMe products)
const getDefBlock = src.match(/async function getDefaultWindowsImageId[\s\S]*?\n}/)
ok('getDefaultWindowsImageId block extractable', !!getDefBlock)
if (getDefBlock) {
  ok('getDefaultWindowsImageId does NOT call isSSDProduct',
    !/isSSDProduct\(productId\)/.test(getDefBlock[0]),
    'still branches on SSD — SE will be selected for NVMe products → 400 cannot use this image')
  ok('getDefaultWindowsImageId does NOT call isNVMeProduct',
    !/isNVMeProduct\(productId\)/.test(getDefBlock[0]),
    'still branches on NVMe — SE will be selected → 400')
  ok('getDefaultWindowsImageId references DE preferred name only',
    /preferredName\s*=\s*DEFAULT_WINDOWS_IMAGE_DE/.test(getDefBlock[0]))
  // Fallback walk must ONLY look for -de suffix images (not -se)
  ok('fallback walk targets -de images only',
    /endsWith\(['"]-de['"]\)/.test(getDefBlock[0]),
    'fallback must filter to DE')
  ok('fallback walk does NOT target -se images',
    !/endsWith\(['"]-se['"]\)/.test(getDefBlock[0]),
    'walking down to SE will hit the 400 wall again')
}

// 4. getCompatibleWindowsImage must NOT swap to SE for NVMe targets
const getCompatBlock = src.match(/async function getCompatibleWindowsImage[\s\S]*?\n}/)
ok('getCompatibleWindowsImage block extractable', !!getCompatBlock)
if (getCompatBlock) {
  ok('getCompatibleWindowsImage does NOT compute targetEdition from product',
    !/targetEdition\s*=\s*isSwitchingToSSD\s*\?\s*['"]de['"]\s*:\s*['"]se['"]/.test(getCompatBlock[0]),
    'old logic still present — would still select SE')
  ok('getCompatibleWindowsImage references -de in candidate name',
    /windows-server-\$\{year\}-de/.test(getCompatBlock[0]) || /-de`/.test(getCompatBlock[0]))
}

// 5. Doc comment must mention the 2026-02 incident so future readers don't revert
ok('comment documents the 2026-02 incident',
  /2026-02/.test(src) && /cannot use this image/i.test(src),
  'incident note missing — future agent might revert SE-for-NVMe')

console.log()
if (fail) { console.error(`❌ ${fail} test(s) failed`); process.exit(1) }
console.log(`✅ All ${pass} Windows-DE-only guards pass`)
