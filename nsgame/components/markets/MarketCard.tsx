'use client'

import { useMemo } from 'react'
import type { UpcomingSlot, MarketState } from '@/lib/markets/hooks.stub'
import { CountdownTimer, useNowSecs } from './CountdownTimer'

// One tile. One market. Question, source, countdown, odds, click.

export interface MarketCardProps {
  slot: UpcomingSlot
  state: MarketState | null
  onSelect: (slot: UpcomingSlot) => void
}

const USDC_DECIMALS = 6

function formatUsdc(units: bigint): string {
  if (units === 0n) return '0'
  const whole = units / 10n ** BigInt(USDC_DECIMALS)
  if (units < 10n ** BigInt(USDC_DECIMALS)) return '<1'
  if (whole >= 1_000_000n) return `${(Number(whole) / 1_000_000).toFixed(1)}M`
  if (whole >= 1_000n) return `${(Number(whole) / 1_000).toFixed(1)}k`
  return whole.toString()
}

function computeYesPct(state: MarketState | null): number | null {
  if (!state) return null
  const total = state.totalYes + state.totalNo
  if (total === 0n) return null
  // Round to 1% — odds visualised, not auctioned.
  return Number((state.totalYes * 1000n) / total) / 10
}

export function MarketCard({ slot, state, onSelect }: MarketCardProps) {
  const yesPct = useMemo(() => computeYesPct(state), [state])
  const totalUsdc = useMemo(
    () => state ? formatUsdc(state.totalYes + state.totalNo) : null,
    [state],
  )

  // Avoid Date.now() at render — it diverges between SSR and hydration.
  const now = useNowSecs()
  const closed = now > 0 && slot.closeTime <= now

  return (
    <button
      type="button"
      onClick={() => onSelect(slot)}
      className={[
        'group flex w-full flex-col gap-3 rounded-md border border-zinc-200 bg-white p-3 text-left transition-all',
        'hover:border-zinc-400 hover:shadow-card-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900',
        closed ? 'opacity-60' : '',
      ].join(' ')}
      aria-label={`Open bet sheet: ${slot.label}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-500">
          {slot.sourceName.replace(/^tubes_/, '')}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-zinc-500">
          <CountdownTimer target={slot.closeTime} closedLabel="closed" />
        </span>
      </div>

      <p className="text-sm font-medium leading-snug text-zinc-900 line-clamp-3 min-h-[2.6em]">
        {slot.label}
      </p>

      {yesPct === null ? (
        <div className="flex items-center justify-between text-[11px] text-zinc-500">
          <span className="font-mono uppercase tracking-[0.08em]">no pool yet</span>
          <span className="text-zinc-700 group-hover:text-zinc-900">make first bet →</span>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-emerald-700">YES {yesPct.toFixed(0)}%</span>
            <span className="text-rose-700">NO {(100 - yesPct).toFixed(0)}%</span>
          </div>
          <div className="flex h-1.5 overflow-hidden rounded-full bg-zinc-100">
            <span
              className="block h-full bg-emerald-500"
              style={{ width: `${yesPct}%` }}
              aria-hidden
            />
            <span
              className="block h-full bg-rose-500"
              style={{ width: `${100 - yesPct}%` }}
              aria-hidden
            />
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
            <span className="uppercase tracking-[0.08em]">pool</span>
            <span>{totalUsdc} USDC</span>
          </div>
        </div>
      )}
    </button>
  )
}
