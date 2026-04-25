'use client'

import { useState, useRef, useEffect } from 'react'
import { useLocale } from 'next-intl'
import { useRouter, usePathname } from '@/i18n/routing'
import { locales, LOCALE_LABELS, type Locale } from '@/i18n/config'

interface LanguageSwitcherProps {
  variant?: 'light' | 'dark'
}

export function LanguageSwitcher({ variant = 'light' }: LanguageSwitcherProps) {
  const isDark = variant === 'dark'
  const locale = useLocale() as Locale
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function switchLocale(next: Locale) {
    setOpen(false)
    router.replace(pathname, { locale: next })
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`text-[11px] font-medium tracking-wide uppercase px-2 py-1 ${
          isDark
            ? 'text-zinc-400 border border-white/10 hover:text-white hover:border-white/20'
            : 'text-zinc-400 border border-zinc-800 hover:text-zinc-100 hover:border-zinc-700'
        } rounded-md transition-colors cursor-pointer`}
      >
        {locale.toUpperCase()}
      </button>

      {open && (
        <div className={`absolute right-0 top-full mt-1 z-50 min-w-[120px] rounded-md border shadow-lg py-1 ${
          isDark
            ? 'bg-zinc-900 border-white/10'
            : 'bg-zinc-900 border-zinc-800'
        }`}>
          {locales.map(l => (
            <button
              key={l}
              onClick={() => switchLocale(l)}
              className={`w-full text-left px-3 py-1.5 text-[12px] font-medium transition-colors ${
                l === locale
                  ? isDark ? 'text-white bg-white/5' : 'text-zinc-100 bg-white/5'
                  : isDark ? 'text-zinc-400 hover:text-white hover:bg-white/5' : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/5'
              }`}
            >
              {LOCALE_LABELS[l]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
