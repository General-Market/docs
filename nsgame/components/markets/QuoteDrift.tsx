'use client'

import { useMemo } from 'react'
import { useNowSecs } from './CountdownTimer'
import { SparkLine } from './SparkLine'
import type { QuoteDriftEntry } from '@/lib/markets/hooks'

// Quote history. Newest first. Each row carries the implied YES odds at
// the instant the bet landed — the trail of how the pool got to where it
// is. Above the list, a running YES% sparkline.

const USDC_DECIMALS = 6

function formatUsdcUnits(units: bigint): string {
  if (units === 0n) return '0'
  const base = 10n ** BigInt(USDC_DECIMALS)
  const whole = units / base
  const frac = units % base
  if (frac === 0n) return whole.toString()
  const fracStr = frac.toString().padStart(USDC_DECIMALS, '0').replace(/0+$/, '')
  return fracStr ? `${whole.toString()}.${fracStr}` : whole.toString()
}

function timeAgo(secs: number, now: number): string {
  const diff = Math.max(0, now - secs)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86_400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86_400)}d ago`
}

export interface QuoteDriftProps {
  entries: QuoteDriftEntry[]
  className?: string
  limit?: number
}

export function QuoteDrift({ entries, className = '', limit = 6 }: QuoteDriftProps) {
  const now = useNowSecs()

  // Sparkline takes the running YES% in chronological order.
  const yesPctSeries = useMemo(() => {
    const ascending = entries.slice().reverse()
    return ascending.map(e => e.yesPctAfter)
  }, [entries])

  const trend: 'up' | 'down' | 'flat' = useMemo(() => {
    if (yesPctSeries.length < 2) return 'flat'
    const last = yesPctSeries[yesPctSeries.length - 1]!
    if (last > 50) return 'up'
    if (last < 50) return 'down'
    return 'flat'
  }, [yesPctSeries])

  if (entries.length === 0) return null

  const visible = entries.slice(0, limit)

  return (
    <div className={['border-t border-zinc-200 px-4 py-3', className].join(' ')}>
      <div className="mb-2 flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
          quote drift
        </p>
        {yesPctSeries.length >= 2 ? (
          <SparkLine values={yesPctSeries} width={64} height={14} trend={trend} />
        ) : null}
      </div>
      <ul className="space-y-1.5">
        {visible.map(e => (
          <li
            key={e.sig}
            className="flex items-center gap-2 font-mono text-[11px]"
          >
            <span
              className={[
                'inline-flex h-4 items-center rounded px-1 text-[10px] font-semibold uppercase',
                e.side === 'yes'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-rose-50 text-rose-700',
              ].join(' ')}
            >
              {e.side}
            </span>
            <span className="tabular-nums text-zinc-700">{formatUsdcUnits(e.amount)}</span>
            <span className="truncate text-zinc-500">
              {e.owner.slice(0, 4)}…{e.owner.slice(-4)}
            </span>
            <span className="ml-auto whitespace-nowrap tabular-nums text-zinc-400">
              {now > 0 ? timeAgo(e.ts, now) : '—'}
            </span>
            <span
              className={[
                'w-12 text-right tabular-nums',
                e.yesPctAfter > 50
                  ? 'text-emerald-700'
                  : e.yesPctAfter < 50
                    ? 'text-rose-700'
                    : 'text-zinc-500',
              ].join(' ')}
            >
              {Math.round(e.yesPctAfter)}% YES
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
