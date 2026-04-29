/**
 * react-i18next configuration.
 *
 * Loads English / French / Chinese / Hindi translations and detects the user's
 * preferred language via:
 *   1. localStorage('hp.lang') — manual choice persists across sessions
 *   2. browser navigator.language
 *   3. fallback: 'en'
 */
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import en from './locales/en.json'
import fr from './locales/fr.json'
import zh from './locales/zh.json'
import hi from './locales/hi.json'

export const SUPPORTED_LANGS = ['en', 'fr', 'zh', 'hi']

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
      zh: { translation: zh },
      hi: { translation: hi },
    },
    supportedLngs: SUPPORTED_LANGS,
    fallbackLng: 'en',
    nonExplicitSupportedLngs: true, // map zh-Hans → zh, en-US → en, etc.
    interpolation: {
      escapeValue: false, // React already escapes
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'hp.lang',
      caches: ['localStorage'],
    },
  })

export default i18n
