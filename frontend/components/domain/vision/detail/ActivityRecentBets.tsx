'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useRecentBets, type BetEventType } from '@/hooks/useRecentBets'
import { useBetsSSE } from '@/hooks/useBetsSSE'

function timeAgo(timestamp: string, nowMs: number): string {
  const t = new Date(timestamp).getTime()
  if (isNaN(t)) return '—'
  const diff = Math.max(0, Math.floor((nowMs - t) / 1000))
  if (diff < 5) return 'now'
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

function useNow(intervalMs: number = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

function truncAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr || '—'
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

const ACTION_LABEL: Record<BetEventType, string> = {
  placed: 'Placed',
  matched: 'Matched',
  won: 'Won',
  lost: 'Lost',
  settled: 'Settled',
}

// won → up/green, lost → down/red, everything else stays quiet so the
// outcomes are the only thing that draws the eye down the column.
function actionClass(type: BetEventType): string {
  if (type === 'won') return 'text-color-up'
  if (type === 'lost') return 'text-color-down'
  return 'text-[var(--apple-text-tertiary,#86868b)]'
}

function dotClass(type: BetEventType): string {
  if (type === 'won') return 'bg-color-up'
  if (type === 'lost') return 'bg-color-down'
  if (type === 'placed' || type === 'matched') return 'bg-[var(--apple-text-tertiary,#86868b)]'
  return 'bg-[var(--apple-divider,#c7c7cc)]'
}

function formatResult(result: string | null): { text: string; positive: boolean } | null {
  if (result == null) return null
  const n = parseFloat(result)
  if (!isFinite(n) || n === 0) return null
  const positive = n > 0
  return { text: `${positive ? '+' : '−'}$${Math.abs(n).toFixed(2)}`, positive }
}

const CARD =
  'border border-[var(--apple-border,rgba(0,0,0,0.08))] bg-[var(--surface,#fff)] rounded-[var(--apple-r-md,12px)] overflow-hidden'

export function ActivityRecentBets() {
  const { events, isLoading, isError } = useRecentBets(20)
  useBetsSSE()
  const now = useNow(1000)

  const sorted = useMemo(
    () =>
      [...events].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      ),
    [events],
  )

  const seenKeysRef = useRef<Set<string> | null>(null)
  const newKeys = useMemo(() => {
    const keys = sorted.map(
      (e) => `${e.betId}-${e.eventType}-${e.walletAddress}-${e.timestamp}`,
    )
    if (seenKeysRef.current === null) {
      seenKeysRef.current = new Set(keys)
      return new Set<string>()
    }
    const fresh = new Set<string>()
    for (const k of keys) {
      if (!seenKeysRef.current.has(k)) {
        fresh.add(k)
        seenKeysRef.current.add(k)
      }
    }
    return fresh
  }, [sorted])

  const showEmpty = !isLoading && (isError || !sorted.length)

  return (
    <div className={CARD}>
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--apple-text-tertiary,#86868b)]">
          Recent Bets
        </h2>
        {!showEmpty && !isLoading && (
          <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--apple-text-tertiary,#86868b)]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-color-up animate-pulse" />
            Live
          </span>
        )}
      </div>

      {isLoading && !sorted.length ? (
        <div className="space-y-px px-5 pb-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-9 animate-pulse rounded bg-[var(--apple-divider,#e8e8ed)]" />
          ))}
        </div>
      ) : showEmpty ? (
        <p className="px-5 pb-5 text-[13px] text-[var(--apple-text-secondary,#6e6e73)]">No bets yet.</p>
      ) : (
        <div className="divide-y divide-[var(--apple-border,rgba(0,0,0,0.06))]">
          <AnimatePresence initial={false}>
            {sorted.map((event) => {
              const key = `${event.betId}-${event.eventType}-${event.walletAddress}-${event.timestamp}`
              const isNew = newKeys.has(key)
              const pnl = formatResult(event.result)
              const odds = event.oddsBps && event.oddsBps > 0 ? (event.oddsBps / 10000).toFixed(2) : null
              return (
                <motion.div
                  key={key}
                  layout
                  initial={isNew ? { opacity: 0, y: -8 } : false}
                  animate={{
                    opacity: 1,
                    y: 0,
                    backgroundColor: isNew
                      ? ['rgba(34,197,94,0.16)', 'rgba(34,197,94,0)']
                      : 'rgba(34,197,94,0)',
                  }}
                  transition={{
                    duration: 0.3,
                    ease: 'easeOut',
                    backgroundColor: { duration: 1.4, ease: 'easeOut' },
                  }}
                  className="flex items-center gap-3 px-5 py-2.5"
                >
                  {/* Trader + portfolio size */}
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass(event.eventType)}`} />
                    <span className="truncate font-mono text-[13px] text-[var(--apple-text,#1d1d1f)]">
                      {truncAddr(event.walletAddress)}
                    </span>
                    {event.portfolioSize > 0 && (
                      <span className="shrink-0 rounded-full bg-[var(--apple-fill,rgba(0,0,0,0.04))] px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-[var(--apple-text-tertiary,#86868b)]">
                        {event.portfolioSize} {event.portfolioSize === 1 ? 'market' : 'markets'}
                      </span>
                    )}
                    {odds && (
                      <span className="shrink-0 font-mono text-[10px] tabular-nums text-[var(--apple-text-tertiary,#86868b)]">
                        {odds}×
                      </span>
                    )}
                  </div>

                  {/* Amount + action/PnL */}
                  <div className="shrink-0 text-right leading-tight">
                    <div className="font-mono text-[13px] font-semibold tabular-nums text-[var(--apple-text,#1d1d1f)]">
                      ${parseFloat(event.amount).toFixed(2)}
                    </div>
                    <div className={`text-[10px] font-semibold uppercase tracking-[0.04em] ${actionClass(event.eventType)}`}>
                      {pnl ? (
                        <span className={pnl.positive ? 'text-color-up' : 'text-color-down'}>
                          {ACTION_LABEL[event.eventType]} {pnl.text}
                        </span>
                      ) : (
                        ACTION_LABEL[event.eventType]
                      )}
                    </div>
                  </div>

                  {/* Time */}
                  <span className="w-8 shrink-0 text-right font-mono text-[10px] tabular-nums text-[var(--apple-text-secondary,#6e6e73)]">
                    {timeAgo(event.timestamp, now)}
                  </span>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
