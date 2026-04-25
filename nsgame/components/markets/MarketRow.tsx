'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { UpcomingSlot, MarketState } from '@/lib/markets/hooks'
import { useSourcePrice, payoutMultiplier, formatMultiplier } from '@/lib/markets/hooks'
import { CountdownTimer, useNowSecs } from './CountdownTimer'
import { SourceIcon } from './SourceIcon'
import { PulseDot } from './PulseDot'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'

// Fat market row. Header, title, two outcome buttons, footer. Cards
// breathe a little — gradients, soft rings, numbers that roll. The
// motion is a confession: the price means something to someone.

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

function formatPool(units: bigint): string {
  if (units === 0n) return '0'
  const whole = units / 10n ** BigInt(USDC_DECIMALS)
  if (units < 10n ** BigInt(USDC_DECIMALS)) return '<1'
  if (whole >= 1_000_000n) return `${(Number(whole) / 1_000_000).toFixed(1)}M`
  if (whole >= 1_000n) return `${(Number(whole) / 1_000).toFixed(1)}k`
  return whole.toString()
}

function poolUnitsToFloat(units: bigint): number {
  if (units === 0n) return 0
  // Float only — used by AnimatedNumber. Truncate to whole USDC.
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

  const baseGradient = yes
    ? 'bg-[linear-gradient(135deg,rgb(255,255,255)_0%,rgb(255,255,255)_55%,rgb(236,253,245)_100%)]'
    : 'bg-[linear-gradient(135deg,rgb(255,255,255)_0%,rgb(255,255,255)_55%,rgb(255,241,242)_100%)]'

  const hoverGradient = yes
    ? 'hover:bg-[linear-gradient(135deg,rgb(255,255,255)_0%,rgb(236,253,245)_60%,rgb(209,250,229)_100%)]'
    : 'hover:bg-[linear-gradient(135deg,rgb(255,255,255)_0%,rgb(255,241,242)_60%,rgb(254,205,211)_100%)]'

  const activeGradient = yes
    ? 'bg-[linear-gradient(135deg,rgb(236,253,245)_0%,rgb(209,250,229)_55%,rgb(167,243,208)_100%)]'
    : 'bg-[linear-gradient(135deg,rgb(255,241,242)_0%,rgb(254,205,211)_55%,rgb(253,164,175)_100%)]'

  const ringColor = yes
    ? 'ring-emerald-400/70 shadow-[0_0_0_1px_rgb(16_185_129/0.5),inset_0_0_24px_rgb(16_185_129/0.12)]'
    : 'ring-rose-400/70 shadow-[0_0_0_1px_rgb(244_63_94/0.5),inset_0_0_24px_rgb(244_63_94/0.12)]'

  const flashTint =
    moved === 'up' && yes ? 'before:bg-emerald-200/60'
    : moved === 'down' && yes ? 'before:bg-rose-200/40'
    : moved === 'up' && !yes ? 'before:bg-rose-200/60'
    : moved === 'down' && !yes ? 'before:bg-emerald-200/40'
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
          ? `${activeGradient} ${ringColor} ${yes ? 'border-emerald-500' : 'border-rose-500'} ring-1`
          : `${baseGradient} ${hoverGradient} ${yes ? 'border-zinc-200 hover:border-emerald-300' : 'border-zinc-200 hover:border-rose-300'} hover:-translate-y-px hover:shadow-card`,
      ].join(' ')}
    >
      <span className="relative flex min-w-0 flex-col">
        <span
          className={[
            'text-[11px] font-medium uppercase tracking-[0.12em] transition-colors duration-200',
            yes ? 'text-emerald-700' : 'text-rose-700',
            active ? 'opacity-100' : 'opacity-80 group-hover:opacity-100',
          ].join(' ')}
        >
          {label}
        </span>
        <span className="mt-0.5 flex items-baseline gap-1">
          <span
            className={[
              'text-[24px] font-semibold tabular-nums leading-none tracking-tight transition-colors duration-300',
              pct === null ? 'text-zinc-300' : yes ? 'text-emerald-700' : 'text-rose-700',
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
              pct === null ? 'text-zinc-300' : yes ? 'text-emerald-600/80' : 'text-rose-600/80',
            ].join(' ')}
          >
            ¢
          </span>
        </span>
      </span>
      <span className="relative flex flex-col items-end">
        {oneSided ? (
          <span className="text-[11px] italic text-zinc-400">refund</span>
        ) : (
          <>
            <span className="text-[10px] uppercase tracking-[0.1em] text-zinc-400">
              payout
            </span>
            <span
              className={[
                'mt-0.5 text-[13px] font-medium tabular-nums transition-colors duration-300',
                active ? (yes ? 'text-emerald-700' : 'text-rose-700') : 'text-zinc-700',
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

  // Detect pool moves for a card-wide tint sweep.
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

  // Flash on price tick.
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

  // Card surface gradient — base, hover, selected.
  const cardSurface = selected
    ? 'bg-[linear-gradient(180deg,rgb(255,255,255)_0%,rgb(250,250,250)_100%)] border-zinc-900/80 shadow-[0_0_0_1px_rgb(24_24_27/0.4),0_8px_24px_-12px_rgb(24_24_27/0.25)]'
    : 'bg-[linear-gradient(180deg,rgb(255,255,255)_0%,rgb(250,250,250)_100%)] border-zinc-200/80 hover:border-zinc-300 hover:shadow-[0_4px_16px_-8px_rgb(24_24_27/0.18)]'

  const cardFlash =
    poolFlash === 'up' ? 'after:bg-emerald-200/35'
    : poolFlash === 'down' ? 'after:bg-rose-200/35'
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
        <span className="flex items-center gap-2 text-zinc-600">
          {iconId ? <SourceIcon sourceId={iconId} className="h-4 w-4" /> : null}
          <span className="text-[12px] font-medium tracking-tight text-zinc-700">
            {sourceShort}
          </span>
          <span className="text-zinc-300">·</span>
          <span className="text-[11px] tabular-nums text-zinc-500">
            {slot.thresholdBps >= 0 ? '+' : ''}{slot.thresholdBps} bp
          </span>
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          {statusTone === 'live' ? <PulseDot active color="amber" /> : null}
          <span
            className={
              statusTone === 'live'
                ? 'font-medium text-amber-700'
                : statusTone === 'closed'
                  ? 'text-zinc-500'
                  : statusTone === 'resolved'
                    ? 'text-zinc-700'
                    : 'text-zinc-500'
            }
          >
            {statusLabel}
          </span>
          {!closed && !resolved ? (
            <>
              <span className="text-zinc-300">·</span>
              <span className="tabular-nums text-zinc-500">
                <CountdownTimer target={slot.closeTime} closedLabel="closed" />
              </span>
            </>
          ) : null}
        </span>
      </header>

      <h3 className="relative mt-3 text-[16px] font-semibold leading-snug tracking-tight text-zinc-900">
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
          <span className="tabular-nums text-zinc-800">
            $<AnimatedNumber value={totalPoolFloat} decimals={0} duration={600} formatFn={formatPoolFloat} />
          </span>
        </span>
        <span
          className={[
            'flex items-center gap-1.5 rounded px-1.5 py-0.5 -mx-1.5 transition-[background] duration-700 ease-out',
            priceFlash === 'up' ? 'bg-emerald-50' : priceFlash === 'down' ? 'bg-rose-50' : 'bg-transparent',
          ].join(' ')}
        >
          {price.raw === null ? (
            <span className="text-zinc-400">—</span>
          ) : (
            <>
              <span className="text-zinc-500">{sourceShort}</span>
              <span className="tabular-nums text-zinc-800">{price.display}</span>
              {price.changeBp !== null && price.changeBp !== 0 ? (
                <span
                  className={[
                    'tabular-nums transition-colors duration-300',
                    price.changeBp > 0 ? 'text-emerald-600' : 'text-rose-600',
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
