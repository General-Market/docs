'use client'

import { useLocale } from 'next-intl'
import { usePathname } from '@/i18n/routing'
import { locales, LOCALE_LABELS, defaultLocale } from '@/i18n/config'

export function LanguageSwitcher() {
  const locale = useLocale()
  const pathname = usePathname()

  function onSelectChange(newLocale: string) {
    if (newLocale === locale) return

    document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=${365 * 24 * 60 * 60};samesite=lax`

    // Hard navigation — locale switch changes every string on the page,
    // and useLocale() doesn't update reliably on soft navigation.
    const targetPath = newLocale === defaultLocale
      ? pathname || '/'
      : `/${newLocale}${pathname === '/' ? '' : pathname}`

    window.location.href = targetPath
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
