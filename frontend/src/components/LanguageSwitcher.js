import React from 'react'
import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGS } from '@/i18n'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Globe, Check } from 'lucide-react'

/**
 * Compact language picker — drops into headers / settings panels.
 * Persists choice via i18next-browser-languagedetector → localStorage('hp.lang').
 */
export const LanguageSwitcher = () => {
  const { t, i18n } = useTranslation()
  const current = (i18n.resolvedLanguage || i18n.language || 'en').split('-')[0]

  const onPick = (lang) => {
    i18n.changeLanguage(lang)
    try {
      window.localStorage?.setItem('hp.lang', lang)
    } catch (_) { /* private mode — ignore */ }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          data-testid="language-switcher-trigger"
          className="gap-2"
        >
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline">
            {t(`languageNames.${current}`)}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {SUPPORTED_LANGS.map((lang) => (
          <DropdownMenuItem
            key={lang}
            onClick={() => onPick(lang)}
            data-testid={`language-switcher-option-${lang}`}
            className="gap-2"
          >
            <Check
              className={`h-4 w-4 ${current === lang ? 'opacity-100' : 'opacity-0'}`}
            />
            {t(`languageNames.${lang}`)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default LanguageSwitcher
