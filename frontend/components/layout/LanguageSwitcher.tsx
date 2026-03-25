'use client'

interface LanguageSwitcherProps {
  variant?: 'light' | 'dark'
}

export function LanguageSwitcher({ variant = 'light' }: LanguageSwitcherProps) {
  const isDark = variant === 'dark'

  return (
    <span
      className={`text-[11px] font-medium tracking-wide uppercase px-2 py-1 ${
        isDark
          ? 'text-zinc-400 border border-white/10'
          : 'text-zinc-500 border border-zinc-200'
      } rounded-md`}
    >
      EN
    </span>
  )
}
