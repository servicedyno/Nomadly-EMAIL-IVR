/**
 * Sanity test for /app/js/i18n.js — the i18n loader extracted in the
 * 2026-06-21 audit pass.  Verifies the public surface plus the locale
 * files we've shipped so far.
 */
const i18n = require('../js/i18n.js')

describe('i18n loader', () => {
  test('SUPPORTED includes en/fr/zh/hi', () => {
    expect(i18n.SUPPORTED).toEqual(expect.arrayContaining(['en', 'fr', 'zh', 'hi']))
  })

  test('for(en) returns a function that resolves a known key', () => {
    const t = i18n.for('en')
    const str = t('start.already_on_menu')
    expect(str).toMatch(/already on the main menu/)
  })

  test('for(fr) returns the French translation', () => {
    const t = i18n.for('fr')
    const str = t('start.already_on_menu')
    expect(str).toMatch(/menu principal/)
  })

  test('for("xx") (unsupported lang) falls back to en', () => {
    const t = i18n.for('xx')
    const str = t('start.already_on_menu')
    expect(str).toMatch(/already on the main menu/)
  })

  test('placeholders interpolate correctly', () => {
    const t = i18n.for('en')
    const str = t('vps.start_404', { name: 'my-server-01' })
    expect(str).toMatch(/my-server-01/)
    expect(str).not.toMatch(/\{name\}/)
  })

  test('missing keys fall through to en, then to the key itself', () => {
    const t = i18n.for('en')
    // Use a key we know does not exist
    const str = t('nonexistent.key.path')
    expect(str).toBe('nonexistent.key.path')
  })

  test('all 4 locales have the same top-level keys', () => {
    const fs = require('fs')
    const en = require('../js/i18n/en.json')
    const tops = Object.keys(en)
    for (const lang of ['fr', 'zh', 'hi']) {
      const tbl = require(`../js/i18n/${lang}.json`)
      for (const k of tops) {
        expect(tbl).toHaveProperty(k)
      }
    }
  })
})
