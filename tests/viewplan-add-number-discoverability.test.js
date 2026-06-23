/**
 * Regression test for the @kathyserious 2026-06-23 incident:
 *
 *   "@kathyserious can't find how to add additional phone numbers to her
 *   CloudIVR plan."
 *
 * Root cause: the Settings → "📋 My Plans" view was a read-only HTML text
 * dump — no buttons. She tapped "1" expecting it to select her plan but the
 * bot rejected it as "Unrecognized message" and bounced her to the main menu.
 * The "➕ Add Number to Plan" button was buried 4 levels deep, only reachable
 * via Cloud IVR + SIP → 📋 My Plans (NOT the Settings entry point).
 *
 * Fix: when the user has active Cloud IVR numbers, the global viewPlan
 * handler now stashes cpNumbers/cpPendingBundlesList, sets state.action =
 * cpMyNumbers, and renders the same number-selector keyboard the Cloud IVR
 * submenu shows — so tapping "1" routes to the manage menu where
 * "➕ Add Number to Plan" lives.
 *
 * These tests assert the handler-shape contract: the produced message has the
 * right keyboard and the right state hand-off.
 */

/* global describe, test, expect */

const fs = require('fs')
const path = require('path')

const SOURCE = fs.readFileSync(path.join(__dirname, '..', 'js', '_index.js'), 'utf-8')

describe('@kathyserious regression — viewPlan → tap "1" → manage', () => {

  test('viewPlan handler hoists activeCpNumbers + cpPendingBundlesData for downstream keyboard', () => {
    // The variables must be declared BEFORE the section-building loops so
    // they're in scope for the keyboard render at the bottom.
    expect(SOURCE).toMatch(/let\s+activeCpNumbers\s*=\s*\[\]/)
    expect(SOURCE).toMatch(/let\s+cpPendingBundlesData\s*=\s*\[\]/)
  })

  test('viewPlan filters BOTH active and suspended numbers (parity with cpMyNumbers handler)', () => {
    // The cpMyNumbers handler at line 20856 filters `n.status === 'active' ||
    // n.status === 'suspended'`. The viewPlan handler must match — otherwise
    // suspended numbers stashed in cpNumbers won't line up with the rendered
    // button index.
    const viewPlanIdx = SOURCE.indexOf("if (message === user.viewPlan)")
    expect(viewPlanIdx).toBeGreaterThan(0)
    const slice = SOURCE.slice(viewPlanIdx, viewPlanIdx + 5000)
    expect(slice).toMatch(/n\.status === 'active' \|\| n\.status === 'suspended'/)
  })

  test('viewPlan persists cpNumbers + cpPendingBundlesList + sets cpMyNumbers action', () => {
    const viewPlanIdx = SOURCE.indexOf("if (message === user.viewPlan)")
    const slice = SOURCE.slice(viewPlanIdx, viewPlanIdx + 8000)
    expect(slice).toMatch(/saveInfo\(\s*['"]cpNumbers['"]\s*,\s*activeCpNumbers/)
    expect(slice).toMatch(/saveInfo\(\s*['"]cpPendingBundlesList['"]\s*,\s*cpPendingBundlesData/)
    expect(slice).toMatch(/set\(state,\s*chatId,\s*['"]action['"]\s*,\s*a\.cpMyNumbers/)
  })

  test('viewPlan renders number-selector buttons (1, 2, ...) + buyAnother row', () => {
    const viewPlanIdx = SOURCE.indexOf("if (message === user.viewPlan)")
    const slice = SOURCE.slice(viewPlanIdx, viewPlanIdx + 8000)
    expect(slice).toMatch(/numBtns = activeCpNumbers\.map\(\(_,\s*i\)\s*=>\s*String\(i\s*\+\s*1\)\)/)
    expect(slice).toMatch(/pendingBtns = cpPendingBundlesData\.map\(\(_,\s*i\)\s*=>\s*`P\$\{i\s*\+\s*1\}`\)/)
    expect(slice).toMatch(/allBtns\.push\(\[pc\.buyAnother\]\)/)
  })

  test('viewPlan still works (no keyboard) when user has NO Cloud IVR numbers', () => {
    // The interactive keyboard must be GATED on `activeCpNumbers.length > 0`
    // so users with only VPS/hosting plans don't see a misleading
    // CloudIVR-tagged keyboard.
    const viewPlanIdx = SOURCE.indexOf("if (message === user.viewPlan)")
    const slice = SOURCE.slice(viewPlanIdx, viewPlanIdx + 8000)
    expect(slice).toMatch(/if\s*\(\s*activeCpNumbers\.length\s*>\s*0\s*\)/)
  })

  test('viewPlan inline tip text guides the user (multi-language)', () => {
    const viewPlanIdx = SOURCE.indexOf("if (message === user.viewPlan)")
    const slice = SOURCE.slice(viewPlanIdx, viewPlanIdx + 8000)
    // Each of the 4 supported languages must have a localized tip
    expect(slice).toMatch(/en:\s*['"`].*Tap a number.*Buy Another/i)
    expect(slice).toMatch(/fr:\s*['"`].*Touchez.*num/i)
    expect(slice).toMatch(/zh:\s*['"`].*[点击]/)
    expect(slice).toMatch(/hi:\s*['"`].*टैप/)
  })

  test('cpMyNumbers handler exists and processes numeric "1" tap (downstream route)', () => {
    // The fix only works if the cpMyNumbers handler at line 24837 still routes
    // numeric taps to cpManageNumber. Lock that in.
    const cpMyNumbersIdx = SOURCE.indexOf("if (action === a.cpMyNumbers)")
    expect(cpMyNumbersIdx).toBeGreaterThan(0)
    const slice = SOURCE.slice(cpMyNumbersIdx, cpMyNumbersIdx + 4000)
    expect(slice).toMatch(/parseInt\(message\)\s*-\s*1/)        // 1-indexed selector
    expect(slice).toMatch(/cpNumbers/)                            // reads from stashed state
  })

  test('cpManageNumber renders ➕ Add Number to Plan button for primary numbers under sub-limit', () => {
    // buildManageMenu adds pc.addNumber when !isSubNumber && subLimit > 0 && subCount < subLimit
    expect(SOURCE).toMatch(/!num\.isSubNumber && subLimit > 0 && subCount < subLimit/)
    expect(SOURCE).toMatch(/rows\.push\(\[pc\.addNumber\]\)/)
  })

  test('pc.addNumber tap routes to cpSubAddCountry (sub-number purchase flow)', () => {
    const addIdx = SOURCE.indexOf('if (message === pc.addNumber)')
    expect(addIdx).toBeGreaterThan(0)
    const slice = SOURCE.slice(addIdx, addIdx + 1500)
    expect(slice).toMatch(/saveInfo\(\s*['"]cpSubParentNumber['"]/)
    expect(slice).toMatch(/saveInfo\(\s*['"]cpSubParentPlan['"]/)
    expect(slice).toMatch(/set\(state,\s*chatId,\s*['"]action['"]\s*,\s*a\.cpSubAddCountry/)
  })

  test('Pro plan sub-number limit is 15 (so Kathy with 0 sub-numbers can add)', () => {
    const phoneConfigSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'phone-config.js'), 'utf-8')
    expect(phoneConfigSrc).toMatch(/SUB_NUMBER_LIMITS\s*=\s*\{\s*starter:\s*3,\s*pro:\s*15,\s*business:\s*30\s*\}/)
  })
})
