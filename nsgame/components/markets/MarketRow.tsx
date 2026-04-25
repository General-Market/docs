'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { UpcomingSlot, MarketState } from '@/lib/markets/hooks'
import { useSourcePrice, payoutMultiplier, formatMultiplier } from '@/lib/markets/hooks'
import { CountdownTimer, useNowSecs } from './CountdownTimer'
import { SourceIcon } from './SourceIcon'
import { PulseDot } from './PulseDot'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'

// Fat market row, dark surface. Header, title, two outcome buttons,
// footer. Cards breathe a little — gradients, soft rings, numbers that
// roll. The motion is a confession: the price means something to
// someone.

export type Side = 'yes' | 'no'

export interface MarketRowProps {
  slot: UpcomingSlot
  state: MarketState | null
  selected: boolean
  selectedSide: Side | null
  onSelectSide: (slot: UpcomingSlot, side: Side) => void
}

const USDC_DECIMALS = 6
const FLASH_MS = 700

function poolUnitsToFloat(units: bigint): number {
  if (units === 0n) return 0
  return Number(units / 10n ** BigInt(USDC_DECIMALS))
}

function formatPoolFloat(n: number): string {
  if (n <= 0) return '0'
  if (n < 1) return '<1'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return Math.round(n).toString()
}

function computeYesPct(state: MarketState | null): number | null {
  if (!state) return null
  const total = state.totalYes + state.totalNo
  if (total === 0n) return null
  return Number((state.totalYes * 1000n) / total) / 10
}

interface OutcomeButtonProps {
  side: Side
  label: string
  pct: number | null
  multiplier: number | null
  active: boolean
  oneSided: boolean
  onClick: () => void
}

function OutcomeButton({ side, label, pct, multiplier, active, oneSided, onClick }: OutcomeButtonProps) {
  const yes = side === 'yes'

  // Detect value moves to flash a soft tint that fades back over 700ms.
  const [moved, setMoved] = useState<'up' | 'down' | null>(null)
  const prevPctRef = useRef<number | null>(null)
  useEffect(() => {
    const prev = prevPctRef.current
    prevPctRef.current = pct
    if (prev === null || pct === null || prev === pct) return
    setMoved(pct > prev ? 'up' : 'down')
    const id = window.setTimeout(() => setMoved(null), FLASH_MS)
    return () => window.clearTimeout(id)
  }, [pct])

  // Base: dark zinc surface with a faint diagonal sweep into the side hue.
  const baseGradient = yes
    ? 'bg-[linear-gradient(135deg,rgb(24,24,27)_0%,rgb(24,24,27)_55%,rgb(6,40,30)_100%)]'
    : 'bg-[linear-gradient(135deg,rgb(24,24,27)_0%,rgb(24,24,27)_55%,rgb(50,15,25)_100%)]'

  const hoverGradient = yes
    ? 'hover:bg-[linear-gradient(135deg,rgb(24,24,27)_0%,rgb(8,52,40)_60%,rgb(8,72,52)_100%)]'
    : 'hover:bg-[linear-gradient(135deg,rgb(24,24,27)_0%,rgb(60,18,30)_60%,rgb(80,22,38)_100%)]'

  const activeGradient = yes
    ? 'bg-[linear-gradient(135deg,rgb(8,52,40)_0%,rgb(8,72,52)_55%,rgb(10,90,66)_100%)]'
    : 'bg-[linear-gradient(135deg,rgb(60,18,30)_0%,rgb(80,22,38)_55%,rgb(100,28,44)_100%)]'

  const ringColor = yes
    ? 'ring-emerald-400/60 shadow-[0_0_0_1px_rgb(16_185_129/0.55),inset_0_0_28px_rgb(16_185_129/0.18)]'
    : 'ring-rose-400/60 shadow-[0_0_0_1px_rgb(244_63_94/0.55),inset_0_0_28px_rgb(244_63_94/0.18)]'

  const flashTint =
    moved === 'up' && yes ? 'before:bg-emerald-400/20'
    : moved === 'down' && yes ? 'before:bg-rose-400/15'
    : moved === 'up' && !yes ? 'before:bg-rose-400/20'
    : moved === 'down' && !yes ? 'before:bg-emerald-400/15'
    : 'before:bg-transparent'

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'group relative flex items-center justify-between gap-4 overflow-hidden rounded-lg border px-4 py-3 text-left',
        'transition-[background,box-shadow,border-color,transform] duration-200 ease-out will-change-transform',
        'before:pointer-events-none before:absolute before:inset-0 before:transition-[background] before:duration-700 before:ease-out',
        flashTint,
        active
          ? `${activeGradient} ${ringColor} ${yes ? 'border-emerald-500/70' : 'border-rose-500/70'} ring-1`
          : `${baseGradient} ${hoverGradient} ${yes ? 'border-zinc-800 hover:border-emerald-500/50' : 'border-zinc-800 hover:border-rose-500/50'} hover:-translate-y-px hover:shadow-[0_8px_20px_-12px_rgb(0_0_0/0.7)]`,
      ].join(' ')}
    >
      <span className="relative flex min-w-0 flex-col">
        <span
          className={[
            'text-[11px] font-medium uppercase tracking-[0.12em] transition-colors duration-200',
            yes ? 'text-emerald-400' : 'text-rose-400',
            active ? 'opacity-100' : 'opacity-90 group-hover:opacity-100',
          ].join(' ')}
        >
          {label}
        </span>
        <span className="mt-0.5 flex items-baseline gap-1">
          <span
            className={[
              'text-[24px] font-semibold tabular-nums leading-none tracking-tight transition-colors duration-300',
              pct === null
                ? 'text-zinc-700'
                : yes
                  ? active ? 'text-emerald-200' : 'text-emerald-300'
                  : active ? 'text-rose-200' : 'text-rose-300',
            ].join(' ')}
          >
            {pct === null ? (
              '—'
            ) : (
              <AnimatedNumber value={pct} decimals={0} duration={500} />
            )}
          </span>
          <span
            className={[
              'text-[13px] font-medium transition-colors duration-300',
              pct === null ? 'text-zinc-700' : yes ? 'text-emerald-400/80' : 'text-rose-400/80',
            ].join(' ')}
          >
            ¢
          </span>
        </span>
      </span>
      <span className="relative flex flex-col items-end">
        {oneSided ? (
          <span className="text-[11px] italic text-zinc-500">refund</span>
        ) : (
          <>
            <span className="text-[10px] uppercase tracking-[0.1em] text-zinc-500">
              payout
            </span>
            <span
              className={[
                'mt-0.5 text-[13px] font-medium tabular-nums transition-colors duration-300',
                active
                  ? yes ? 'text-emerald-200' : 'text-rose-200'
                  : 'text-zinc-300',
              ].join(' ')}
            >
              {formatMultiplier(multiplier)}
            </span>
          </>
        )}
      </span>
    </button>
  )
}

export function MarketRow({ slot, state, selected, selectedSide, onSelectSide }: MarketRowProps) {
  const yesPct = useMemo(() => computeYesPct(state), [state])
  const noPct = yesPct === null ? null : 100 - yesPct

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

  const totalPoolFloat = useMemo(
    () => state ? poolUnitsToFloat(state.totalYes + state.totalNo) : 0,
    [state],
  )

  const [poolFlash, setPoolFlash] = useState<'up' | 'down' | null>(null)
  const prevPoolRef = useRef<bigint | null>(null)
  useEffect(() => {
    const cur = state ? state.totalYes + state.totalNo : null
    const prev = prevPoolRef.current
    prevPoolRef.current = cur
    if (cur === null || prev === null || cur === prev) return
    setPoolFlash(cur > prev ? 'up' : 'down')
    const id = window.setTimeout(() => setPoolFlash(null), FLASH_MS)
    return () => window.clearTimeout(id)
  }, [state])

  const price = useSourcePrice(slot.sourceId)

  const [priceFlash, setPriceFlash] = useState<'up' | 'down' | null>(null)
  useEffect(() => {
    if (!price.ts || (price.direction !== 'up' && price.direction !== 'down')) return
    setPriceFlash(price.direction)
    const id = window.setTimeout(() => setPriceFlash(null), FLASH_MS)
    return () => window.clearTimeout(id)
  }, [price.ts, price.direction])

  const now = useNowSecs()
  const closed = now > 0 && slot.closeTime <= now
  const resolved = !!state?.resolved

  let statusLabel: string
  let statusTone: 'live' | 'open' | 'closed' | 'resolved'
  if (resolved) {
    statusLabel = `resolved · ${state?.outcomeYes ? 'YES' : 'NO'}`
    statusTone = 'resolved'
  } else if (closed) {
    statusLabel = 'closed · settling'
    statusTone = 'closed'
  } else if (state && state.totalYes + state.totalNo > 0n) {
    statusLabel = 'live'
    statusTone = 'live'
  } else {
    statusLabel = 'open'
    statusTone = 'open'
  }

  const sourceShort = slot.sourceName.toLowerCase()

  const iconId = (slot.sourceId >= 1 && slot.sourceId <= 5
    ? (slot.sourceId as 1 | 2 | 3 | 4 | 5)
    : null)

  const cardSurface = selected
    ? 'bg-[linear-gradient(180deg,rgb(28,28,32)_0%,rgb(20,20,23)_100%)] border-zinc-600 shadow-[0_0_0_1px_rgb(82_82_91/0.4),0_12px_28px_-12px_rgb(0_0_0/0.7)]'
    : 'bg-[linear-gradient(180deg,rgb(24,24,27)_0%,rgb(20,20,23)_100%)] border-zinc-800 hover:border-zinc-700 hover:shadow-[0_8px_24px_-12px_rgb(0_0_0/0.7)]'

  const cardFlash =
    poolFlash === 'up' ? 'after:bg-emerald-500/10'
    : poolFlash === 'down' ? 'after:bg-rose-500/10'
    : 'after:bg-transparent'

  return (
    <article
      className={[
        'group/card relative overflow-hidden rounded-xl border p-5',
        'transition-[box-shadow,border-color,transform] duration-300 ease-out',
        'after:pointer-events-none after:absolute after:inset-0 after:rounded-xl after:transition-[background] after:duration-700 after:ease-out',
        cardSurface,
        cardFlash,
      ].join(' ')}
      aria-label={slot.label}
    >
      <header className="relative flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-zinc-400">
          {iconId ? <SourceIcon sourceId={iconId} className="h-4 w-4" /> : null}
          <span className="text-[12px] font-medium tracking-tight text-zinc-300">
            {sourceShort}
          </span>
          <span className="text-zinc-700">·</span>
          <span className="text-[11px] tabular-nums text-zinc-500">
            {slot.thresholdBps >= 0 ? '+' : ''}{slot.thresholdBps} bp
          </span>
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          {statusTone === 'live' ? <PulseDot active color="amber" /> : null}
          <span
            className={
              statusTone === 'live'
                ? 'font-medium text-amber-400'
                : statusTone === 'closed'
                  ? 'text-zinc-500'
                  : statusTone === 'resolved'
                    ? 'text-zinc-300'
                    : 'text-zinc-500'
            }
          >
            {statusLabel}
          </span>
          {!closed && !resolved ? (
            <>
              <span className="text-zinc-700">·</span>
              <span className="tabular-nums text-zinc-400">
                <CountdownTimer target={slot.closeTime} closedLabel="closed" />
              </span>
            </>
          ) : null}
        </span>
      </header>

      <h3 className="relative mt-3 text-[16px] font-semibold leading-snug tracking-tight text-zinc-100">
        {slot.label}
      </h3>

      <div className="relative mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <OutcomeButton
          side="yes"
          label="Yes"
          pct={yesPct}
          multiplier={yesMult}
          active={selected && selectedSide === 'yes'}
          oneSided={oneSided && state?.totalNo === 0n}
          onClick={() => onSelectSide(slot, 'yes')}
        />
        <OutcomeButton
          side="no"
          label="No"
          pct={noPct}
          multiplier={noMult}
          active={selected && selectedSide === 'no'}
          oneSided={oneSided && state?.totalYes === 0n}
          onClick={() => onSelectSide(slot, 'no')}
        />
      </div>

      <footer className="relative mt-4 flex items-center justify-between gap-3 text-[12px] text-zinc-500">
        <span>
          Pool{' '}
          <span className="tabular-nums text-zinc-200">
            $<AnimatedNumber value={totalPoolFloat} decimals={0} duration={600} formatFn={formatPoolFloat} />
          </span>
        </span>
        <span
          className={[
            'flex items-center gap-1.5 rounded px-1.5 py-0.5 -mx-1.5 transition-[background] duration-700 ease-out',
            priceFlash === 'up' ? 'bg-emerald-500/10' : priceFlash === 'down' ? 'bg-rose-500/10' : 'bg-transparent',
          ].join(' ')}
        >
          {price.raw === null ? (
            <span className="text-zinc-600">—</span>
          ) : (
            <>
              <span className="text-zinc-500">{sourceShort}</span>
              <span className="tabular-nums text-zinc-200">{price.display}</span>
              {price.changeBp !== null && price.changeBp !== 0 ? (
                <span
                  className={[
                    'tabular-nums transition-colors duration-300',
                    price.changeBp > 0 ? 'text-emerald-400' : 'text-rose-400',
                  ].join(' ')}
                >
                  {price.changeBp > 0 ? '+' : ''}{price.changeBp}bp
                </span>
              ) : null}
            </>
          )}
        </span>
      </footer>
    </article>
  )
}
