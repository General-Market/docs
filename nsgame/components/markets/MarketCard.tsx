'use client'

import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { UpcomingSlot, MarketState } from '@/lib/markets/hooks.stub'
import { useSourcePrice, payoutMultiplier, formatMultiplier } from '@/lib/markets/hooks'
import { CountdownTimer, useNowSecs } from './CountdownTimer'
import { PulseDot } from './PulseDot'

// One tile. One market. Question, source, countdown, odds, click.

export interface MarketCardProps {
  slot: UpcomingSlot
  state: MarketState | null
  onSelect: (slot: UpcomingSlot) => void
}

const USDC_DECIMALS = 6
const FLASH_MS = 600
// Distinct from FLASH_MS: the pulse is the room breathing, not a tick.
// 3s is long enough to register, short enough to not pile up.
const FILL_PULSE_MS = 3000

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

function formatChangeBp(bp: number | null): string {
  if (bp === null) return ''
  const sign = bp > 0 ? '+' : ''
  return `${sign}${bp} bp`
}

function MarketCardImpl({ slot, state, onSelect }: MarketCardProps) {
  const yesPct = useMemo(() => computeYesPct(state), [state])
  const totalUsdc = useMemo(
    () => state ? formatUsdc(state.totalYes + state.totalNo) : null,
    [state],
  )

  // Live source observation. The component drives the flash duration; the
  // hook only surfaces a direction signal.
  const price = useSourcePrice(slot.sourceId)

  // Flash class flipped on for 600ms after each tick that moved the price.
  const [priceFlash, setPriceFlash] = useState<'up' | 'down' | null>(null)
  useEffect(() => {
    if (!price.ts) return
    if (price.direction === 'up' || price.direction === 'down') {
      setPriceFlash(price.direction)
      const id = window.setTimeout(() => setPriceFlash(null), FLASH_MS)
      return () => window.clearTimeout(id)
    }
    setPriceFlash(null)
  }, [price.ts, price.direction])

  // Pool flash: detect totalYes/totalNo ticks and flash the pool line.
  const [poolFlash, setPoolFlash] = useState<'up' | 'down' | null>(null)
  const prevTotalRef = useRef<bigint | null>(null)
  useEffect(() => {
    const total = state ? state.totalYes + state.totalNo : null
    if (total === null) return
    const prev = prevTotalRef.current
    prevTotalRef.current = total
    if (prev !== null && total !== prev) {
      setPoolFlash(total > prev ? 'up' : 'down')
      const id = window.setTimeout(() => setPoolFlash(null), FLASH_MS)
      return () => window.clearTimeout(id)
    }
    return undefined
  }, [state])

  // Fill pulse: a 3s halo near the title whenever the pool *grows* —
  // someone bet, the room breathes, the card admits other people exist.
  // Driven separately from the numeric pool flash so neighbours can see
  // the room without parsing the digits.
  const [filling, setFilling] = useState(false)
  const prevFillRef = useRef<bigint | null>(null)
  useEffect(() => {
    const total = state ? state.totalYes + state.totalNo : null
    if (total === null) return
    const prev = prevFillRef.current
    prevFillRef.current = total
    if (prev !== null && total > prev) {
      setFilling(true)
      const id = window.setTimeout(() => setFilling(false), FILL_PULSE_MS)
      return () => window.clearTimeout(id)
    }
    return undefined
  }, [state])

  // Multipliers for both sides — small, both shown.
  const yesMult = useMemo(
    () => state ? payoutMultiplier(state.totalYes, state.totalNo, 'yes') : null,
    [state],
  )
  const noMult = useMemo(
    () => state ? payoutMultiplier(state.totalYes, state.totalNo, 'no') : null,
    [state],
  )
  const oneSided = !!state && (
    (state.totalYes === 0n && state.totalNo > 0n) ||
    (state.totalNo === 0n && state.totalYes > 0n)
  )

  // Avoid Date.now() at render — it diverges between SSR and hydration.
  const now = useNowSecs()
  const closed = now > 0 && slot.closeTime <= now

  const sourceShort = slot.sourceName.replace(/^tubes_/, '')

  return (
    <button
      type="button"
      onClick={() => onSelect(slot)}
      className={[
        'group flex w-full flex-col gap-3 rounded-md border border-terminal-border bg-terminal-surface p-3 text-left transition-all',
        'hover:border-terminal-border-strong hover:bg-terminal-surface/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-terminal-border-strong',
        closed ? 'opacity-60' : '',
      ].join(' ')}
      aria-label={`Open bet sheet: ${slot.label}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 font-mono text-label uppercase tracking-[0.1em] text-terminal-fg-faint">
          <PulseDot
            active={filling}
            color="emerald"
            size={6}
            className={filling ? 'opacity-100' : 'opacity-30'}
          />
          {sourceShort}
        </span>
        <span className="font-mono text-label uppercase tracking-[0.08em] text-terminal-fg-faint">
          <CountdownTimer target={slot.closeTime} closedLabel="closed" />
        </span>
      </div>

      <p className="text-body font-medium leading-snug text-terminal-fg line-clamp-3 min-h-[2.6em]">
        {slot.label}
      </p>

      <div
        className={[
          'flex items-center justify-between font-mono text-label rounded px-1.5 py-0.5 -mx-1.5 transition-colors duration-300',
          priceFlash === 'up' ? 'bg-emerald-500/10' : priceFlash === 'down' ? 'bg-rose-500/10' : 'bg-transparent',
        ].join(' ')}
      >
        <span className="text-terminal-fg-muted">
          {sourceShort}: <span className="text-terminal-fg">{price.raw === null ? '—' : price.display}</span>
        </span>
        <span
          className={
            price.changeBp === null || price.changeBp === 0
              ? 'text-terminal-fg-faint'
              : price.changeBp > 0
                ? 'text-emerald-300'
                : 'text-rose-300'
          }
        >
          {formatChangeBp(price.changeBp)}
        </span>
      </div>

      {yesPct === null ? (
        <div className="flex items-center justify-between text-label text-terminal-fg-faint">
          <span className="font-mono uppercase tracking-[0.08em]">no pool yet</span>
          <span className="text-terminal-fg-muted group-hover:text-terminal-fg">make first bet →</span>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-label font-mono">
            <span className="text-emerald-300">YES {yesPct.toFixed(0)}%</span>
            <span className="text-rose-300">NO {(100 - yesPct).toFixed(0)}%</span>
          </div>
          <div className="flex h-1.5 overflow-hidden rounded-full bg-terminal-border">
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
          <div
            className={[
              'flex items-center justify-between rounded px-1.5 py-0.5 -mx-1.5 font-mono text-label transition-colors duration-300',
              poolFlash === 'up' ? 'bg-emerald-500/10' : poolFlash === 'down' ? 'bg-rose-500/10' : 'bg-transparent',
            ].join(' ')}
          >
            {oneSided ? (
              <span className="italic text-terminal-fg-faint">refund · no opposing side</span>
            ) : (
              <span className="text-terminal-fg-muted">
                <span className="text-emerald-300">{formatMultiplier(yesMult)}</span> yes{' '}
                <span className="text-rose-300">{formatMultiplier(noMult)}</span> no
              </span>
            )}
            <span className="text-terminal-fg-faint">pool {totalUsdc} USDC</span>
          </div>
        </div>
      )}
    </button>
  )
}

export const MarketCard = memo(MarketCardImpl)
