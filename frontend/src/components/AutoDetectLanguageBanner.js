import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Globe, X } from 'lucide-react'
import { SUPPORTED_LANGS } from '@/i18n'

const STORAGE_KEY = 'hp.lang'
const DISMISSED_KEY = 'hp.lang.bannerDismissed'

/**
 * One-time banner shown to new visitors whose browser language matches one of
 * our supported non-English locales. Lets them confirm the auto-pick or
 * fall back to English in a single tap. After either action it persists their
 * choice and never shows again.
 *
 * Visibility rules:
 *   1. User has NOT explicitly dismissed/answered the banner before
 *      (`hp.lang.bannerDismissed` flag — set on Keep / Switch / Close).
 *      We deliberately ignore `hp.lang` because i18next-browser-languagedetector
 *      writes it on first visit, which would otherwise suppress the banner.
 *   2. Browser-detected language is one of {fr, zh, hi} (not en)
 *   3. The currently rendered language matches the browser detection
 *      (i.e. i18next has already picked it up via LanguageDetector).
 */
export const AutoDetectLanguageBanner = () => {
  const { t, i18n } = useTranslation()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    let dismissed
    try {
      dismissed = window.localStorage?.getItem(DISMISSED_KEY)
    } catch (_) { /* private mode — treat as fresh */ }
    if (dismissed) return

    const current = (i18n.resolvedLanguage || i18n.language || 'en')
      .split('-')[0]
      .toLowerCase()
    if (current === 'en') return
    if (!SUPPORTED_LANGS.includes(current)) return
    setVisible(true)
  }, [i18n])

  if (!visible) return null

  const current = (i18n.resolvedLanguage || i18n.language || 'en')
    .split('-')[0]
    .toLowerCase()
  const langNativeName = t(`languageNames.${current}`)

  const persistAndHide = (lang) => {
    try {
      window.localStorage?.setItem(STORAGE_KEY, lang)
      window.localStorage?.setItem(DISMISSED_KEY, '1')
    } catch (_) { /* private mode — non-fatal */ }
    setVisible(false)
  }

  const onKeep = () => {
    // Auto-pick is already active — just persist the choice.
    persistAndHide(current)
  }

  const onSwitchToEnglish = () => {
    i18n.changeLanguage('en')
    persistAndHide('en')
  }

  const onClose = () => {
    // Treat close as "keep current choice but don't ask again".
    persistAndHide(current)
  }

  return (
    <div
      data-testid="auto-detect-language-banner"
      className="auto-detect-language-banner"
      role="dialog"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        maxWidth: 'calc(100vw - 32px)',
        background: 'rgba(15, 23, 42, 0.95)',
        color: '#fff',
        padding: '12px 16px',
        borderRadius: 12,
        boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
      <Globe size={18} style={{ flexShrink: 0, opacity: 0.85 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 13 }}>
        <span data-testid="auto-detect-banner-detected">
          {t('banner.detected', { lang: langNativeName })}
        </span>
        <span style={{ opacity: 0.7, fontSize: 12 }}>{t('banner.tagline')}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
        <button
          type="button"
          onClick={onKeep}
          data-testid="auto-detect-banner-keep"
          style={{
            background: '#22c55e',
            color: '#fff',
            border: 'none',
            padding: '6px 12px',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {t('banner.keep', { lang: langNativeName })}
        </button>
        <button
          type="button"
          onClick={onSwitchToEnglish}
          data-testid="auto-detect-banner-switch-en"
          style={{
            background: 'transparent',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.3)',
            padding: '6px 12px',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {t('banner.switchToEnglish')}
        </button>
        <button
          type="button"
          onClick={onClose}
          data-testid="auto-detect-banner-close"
          aria-label="Close"
          style={{
            background: 'transparent',
            color: '#fff',
            border: 'none',
            padding: 4,
            cursor: 'pointer',
            opacity: 0.7,
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}

export default AutoDetectLanguageBanner
