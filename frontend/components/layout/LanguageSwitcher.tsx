'use client'

import { useLocale, useTranslations } from 'next-intl'
import { usePathname, useRouter } from '@/i18n/routing'
import { locales, LOCALE_LABELS } from '@/i18n/config'

interface LanguageSwitcherProps {
  variant?: 'light' | 'dark'
}

export function LanguageSwitcher({ variant = 'light' }: LanguageSwitcherProps) {
  const t = useTranslations('common')
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()
  const isDark = variant === 'dark'

  function onSelectChange(newLocale: string) {
    if (newLocale === locale) return

    document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=${365 * 24 * 60 * 60};samesite=lax`

    // Soft navigation — preserves SSE connection, client state, and cached data.
    // next-intl 4.x useRouter handles locale prefix rewriting.
    router.replace(pathname || '/', { locale: newLocale })
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
      aria-label={t('aria.language')}
    >
      {locales.map((l) => (
        <option key={l} value={l} className="bg-white text-black normal-case">
          {LOCALE_LABELS[l]}
        </option>
      ))}
    </select>
  )
}
