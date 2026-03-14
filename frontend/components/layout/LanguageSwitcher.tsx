'use client'

import { useTransition } from 'react'
import { useLocale } from 'next-intl'
import { useRouter, usePathname } from '@/i18n/routing'
import { locales, LOCALE_LABELS, type Locale } from '@/i18n/config'

export function LanguageSwitcher() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  function onSelectChange(newLocale: string) {
    document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=${365 * 24 * 60 * 60};samesite=lax`
    startTransition(() => {
      router.replace(pathname, { locale: newLocale as Locale })
    })
  }

  return (
    <select
      value={locale}
      onChange={(e) => onSelectChange(e.target.value)}
      disabled={isPending}
      className="bg-transparent text-xs border border-border-light rounded px-2 py-1 text-text-secondary hover:text-black cursor-pointer disabled:opacity-50"
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
