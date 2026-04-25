'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

// One tick. Many countdowns. Spawning fifty intervals to display the same
// second is a small kind of waste, but it adds up.

// 0 means "not yet mounted" — SSR and the first client render both emit it,
// so the markup matches. The real time is set inside useEffect.
const TickContext = createContext<number>(0)

export function CountdownTickProvider({ children }: { children: ReactNode }) {
  const [now, setNow] = useState<number>(0)

  useEffect(() => {
    setNow(Math.floor(Date.now() / 1000))
    const id = window.setInterval(() => {
      setNow(Math.floor(Date.now() / 1000))
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  return <TickContext.Provider value={now}>{children}</TickContext.Provider>
}

export function useNowSecs(): number {
  // If the provider is missing, fall back to a local clock so the
  // component still renders. Slightly more setIntervals; no breakage.
  const ctx = useContext(TickContext)
  const [local, setLocal] = useState<number>(0)
  useEffect(() => {
    if (ctx) return
    setLocal(Math.floor(Date.now() / 1000))
    const id = window.setInterval(() => setLocal(Math.floor(Date.now() / 1000)), 1000)
    return () => window.clearInterval(id)
  }, [ctx])
  return ctx || local
}

function formatRemaining(secs: number): string {
  if (secs <= 0) return '0:00'
  const days = Math.floor(secs / 86_400)
  const hours = Math.floor((secs % 86_400) / 3600)
  const mins = Math.floor((secs % 3600) / 60)
  const ss = secs % 60
  if (days > 0) return `${days}d ${hours}h ${mins}m`
  if (hours > 0) return `${hours}h ${mins}m ${ss}s`
  if (mins > 0) return `${mins}m ${ss}s`
  return `0:${ss.toString().padStart(2, '0')}`
}

export interface CountdownTimerProps {
  /** Unix seconds. */
  target: number
  /** Optional label to show when the target has passed. */
  closedLabel?: string
  className?: string
}

export function CountdownTimer({ target, closedLabel = 'closed', className }: CountdownTimerProps) {
  const now = useNowSecs()
  const remaining = target - now
  const text = useMemo(() => {
    // Stable placeholder until the client clock is live — keeps SSR markup steady.
    if (now === 0) return '—'
    if (remaining <= 0) return closedLabel
    return formatRemaining(remaining)
  }, [now, remaining, closedLabel])

  return (
    <span className={className} aria-live="polite" suppressHydrationWarning>
      {text}
    </span>
  )
}
