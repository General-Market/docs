'use client'

import { useTransition } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'

// Time-window selector. Four pills, one active. Updates the URL via
// router.replace so server components re-render with the new window.
// Default of 7d is set server-side; the client never invents a window.

export type LeaderboardWindow = '24h' | '7d' | '30d' | 'all'

const OPTIONS: ReadonlyArray<{ id: LeaderboardWindow; label: string }> = [
  { id: '24h', label: '24h' },
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
  { id: 'all', label: 'all' },
]

interface WindowToggleProps {
  active: LeaderboardWindow
}

export function WindowToggle({ active }: WindowToggleProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  function setWindow(next: LeaderboardWindow) {
    if (next === active) return
    const params = new URLSearchParams(searchParams.toString())
    if (next === '7d') params.delete('window')
    else params.set('window', next)
    const qs = params.toString()
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    })
  }

  return (
    <div
      role="tablist"
      aria-label="Time window"
      className={[
        'inline-flex items-center gap-0.5 rounded-md border border-zinc-800 bg-zinc-900/60 p-0.5',
        pending ? 'opacity-70' : '',
      ].join(' ')}
    >
      {OPTIONS.map(opt => {
        const isActive = opt.id === active
        return (
          <button
            key={opt.id}
            role="tab"
            aria-selected={isActive}
            type="button"
            onClick={() => setWindow(opt.id)}
            className={[
              'inline-flex h-7 min-w-[44px] items-center justify-center rounded px-2 font-mono text-[11px] uppercase tracking-[0.1em] transition-colors',
              isActive
                ? 'bg-zinc-100 text-zinc-950'
                : 'text-zinc-400 hover:text-zinc-100',
            ].join(' ')}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
