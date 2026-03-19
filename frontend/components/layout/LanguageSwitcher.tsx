'use client'

import { useLocale } from 'next-intl'
import { usePathname } from '@/i18n/routing'
import { locales, LOCALE_LABELS, defaultLocale } from '@/i18n/config'

interface LanguageSwitcherProps {
  variant?: 'light' | 'dark'
}

export function LanguageSwitcher({ variant = 'light' }: LanguageSwitcherProps) {
  const locale = useLocale()
  const pathname = usePathname()
  const isDark = variant === 'dark'

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
      className={`bg-transparent text-[11px] font-medium tracking-wide uppercase rounded-md px-2 py-1 cursor-pointer transition-colors appearance-none ${
        isDark
          ? 'text-zinc-400 hover:text-zinc-200 border border-white/10'
          : 'text-zinc-500 hover:text-zinc-800 border border-zinc-200'
      }`}
      aria-label="Language"
    >
      {locales.map((l) => (
        <option key={l} value={l} className="bg-white text-black normal-case">
          {LOCALE_LABELS[l]}
        </option>
      ))}
    </select>
  )
}
