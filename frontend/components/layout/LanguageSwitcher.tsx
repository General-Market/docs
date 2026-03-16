'use client'

import { useLocale } from 'next-intl'
import { locales, LOCALE_LABELS, defaultLocale } from '@/i18n/config'

export function LanguageSwitcher() {
  const locale = useLocale()

  function onSelectChange(newLocale: string) {
    if (newLocale === locale) return

    document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=${365 * 24 * 60 * 60};samesite=lax`

    // Strip any existing locale prefix from the current path
    const currentPath = window.location.pathname
    const localeRegex = /^\/(en|ko|ja|zh)(\/|$)/
    const match = currentPath.match(localeRegex)
    const basePath = match
      ? currentPath.slice(match[1].length + 1) || '/'
      : currentPath

    // Default locale has no prefix (localePrefix: 'as-needed')
    const targetPath = newLocale === defaultLocale
      ? basePath
      : `/${newLocale}${basePath === '/' ? '' : basePath}`

    // Middleware uses rewrite (not redirect), so the browser URL may already
    // equal targetPath even though the locale changed. Force reload in that case.
    if (targetPath === currentPath) {
      window.location.reload()
    } else {
      window.location.pathname = targetPath
    }
  }

  return (
    <select
      value={locale}
      onChange={(e) => onSelectChange(e.target.value)}
      className="bg-transparent text-xs border border-border-light rounded px-2 py-1 text-text-secondary hover:text-black cursor-pointer"
      aria-label="Language"
    >
      {locales.map((l) => (
        <option key={l} value={l} className="bg-white text-black">
          {LOCALE_LABELS[l]}
        </option>
      ))}
    </select>
  )
}
