'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { UpcomingSlot, MarketState } from '@/lib/markets/hooks'
import {
  payoutMultiplier,
  formatMultiplier,
  windowLabel,
  compactAudience,
  audienceUnit,
  formatLabel,
} from '@/lib/markets/hooks'
import { CountdownTimer, useNowSecs } from './CountdownTimer'
import { PulseDot } from './PulseDot'

// Two-fighter VS row. The competitor on the left is A (yes); the right
// is B (no). Center divider holds a small mono "vs". Numbers under each
// name read the audience tier and the implied payout if that side wins.

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

interface CompetitorBoxProps {
  side: Side
  name: string
  audience: bigint
  audienceLabel: string
  multiplier: number | null
  active: boolean
  inactive: boolean
  resolved: boolean
  isWinner: boolean
  isLoser: boolean
  refund: boolean
  oneSidedRefund: boolean
  onClick: () => void
}

function CompetitorBox({
  side,
  name,
  audience,
  audienceLabel,
  multiplier,
  active,
  inactive,
  resolved,
  isWinner,
  isLoser,
  refund,
  oneSidedRefund,
  onClick,
}: CompetitorBoxProps) {
  const yes = side === 'yes'

  let surface: string
  if (refund) {
    surface = 'border-zinc-800 bg-zinc-900/60 text-zinc-500'
  } else if (resolved && isWinner) {
    surface = 'border-emerald-500/70 bg-emerald-500/10 text-emerald-100 shadow-[0_0_0_1px_rgb(16_185_129/0.45),inset_0_0_24px_rgb(16_185_129/0.12)]'
  } else if (resolved && isLoser) {
    surface = 'border-zinc-800 bg-zinc-900/40 text-zinc-500 opacity-70'
  } else if (active) {
    surface = yes
      ? 'border-emerald-500/70 bg-[linear-gradient(135deg,rgb(8,52,40)_0%,rgb(8,72,52)_55%,rgb(10,90,66)_100%)] text-emerald-50 shadow-[0_0_0_1px_rgb(16_185_129/0.55),inset_0_0_28px_rgb(16_185_129/0.18)]'
      : 'border-rose-500/70 bg-[linear-gradient(135deg,rgb(60,18,30)_0%,rgb(80,22,38)_55%,rgb(100,28,44)_100%)] text-rose-50 shadow-[0_0_0_1px_rgb(244_63_94/0.55),inset_0_0_28px_rgb(244_63_94/0.18)]'
  } else if (inactive) {
    surface = 'border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-zinc-700'
  } else {
    surface = yes
      ? 'border-zinc-800 bg-[linear-gradient(135deg,rgb(24,24,27)_0%,rgb(24,24,27)_55%,rgb(6,40,30)_100%)] hover:border-emerald-500/50 hover:-translate-y-px hover:shadow-[0_8px_20px_-12px_rgb(0_0_0/0.7)]'
      : 'border-zinc-800 bg-[linear-gradient(135deg,rgb(24,24,27)_0%,rgb(24,24,27)_55%,rgb(50,15,25)_100%)] hover:border-rose-500/50 hover:-translate-y-px hover:shadow-[0_8px_20px_-12px_rgb(0_0_0/0.7)]'
  }

  const accent = yes ? 'text-emerald-400' : 'text-rose-400'

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      disabled={resolved}
      className={[
        'group relative flex flex-1 min-w-0 flex-col gap-1.5 overflow-hidden rounded-lg border px-3 py-3 text-left',
        'transition-[background,box-shadow,border-color,transform] duration-200 ease-out will-change-transform',
        'min-h-[88px]',
        surface,
      ].join(' ')}
    >
      <span className="flex items-center gap-2">
        <span
          aria-hidden
          className={[
            'inline-block h-2 w-2 shrink-0 rounded-full',
            yes ? 'bg-emerald-400' : 'bg-rose-400',
            resolved && isLoser ? 'opacity-30' : '',
          ].join(' ')}
        />
        <span className="truncate text-[14px] font-semibold leading-tight tracking-tight text-zinc-100">
          {name}
        </span>
        {resolved && isWinner ? (
          <span className="ml-auto inline-flex shrink-0 items-center rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-emerald-300">
            won
          </span>
        ) : null}
      </span>
      <span className="text-[11px] tabular-nums text-zinc-500">
        {compactAudience(audience)} {audienceLabel}
      </span>
      <span className="mt-auto flex items-center justify-between gap-2 text-[11px]">
        {oneSidedRefund ? (
          <span className="italic text-zinc-500">refund · no opposing side</span>
        ) : refund ? (
          <span className="italic text-zinc-500">refund</span>
        ) : resolved ? (
          <span className={isWinner ? 'text-emerald-300' : 'text-zinc-500'}>
            {isWinner ? `paid ${formatMultiplier(multiplier)}` : 'lost'}
          </span>
        ) : (
          <>
            <span className="truncate text-zinc-400 group-hover:text-zinc-200">click to bet</span>
            <span className={['shrink-0 tabular-nums font-medium', active ? 'text-zinc-100' : accent].join(' ')}>
              {formatMultiplier(multiplier)}
            </span>
          </>
        )}
      </span>
    </button>
  )
}

export function MarketRow({ slot, state, selected, selectedSide, onSelectSide }: MarketRowProps) {
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

  const now = useNowSecs()
  const closed = now > 0 && slot.closeTime <= now
  const resolved = !!state?.resolved
  const refund = resolved && state?.outcomeYes === null
  const winnerYes = resolved && state?.outcomeYes === true
  const winnerNo = resolved && state?.outcomeYes === false

  let statusLabel: string
  let statusTone: 'live' | 'open' | 'closed' | 'resolved'
  if (refund) {
    statusLabel = 'refund'
    statusTone = 'resolved'
  } else if (winnerYes || winnerNo) {
    statusLabel = winnerYes ? `${slot.displayA} won` : `${slot.displayB} won`
    statusTone = 'resolved'
  } else if (closed) {
    statusLabel = 'settling'
    statusTone = 'closed'
  } else if (state && state.totalYes + state.totalNo > 0n) {
    statusLabel = 'live'
    statusTone = 'live'
  } else {
    statusLabel = 'open'
    statusTone = 'open'
  }

  const cardSurface = selected
    ? 'bg-[linear-gradient(180deg,rgb(28,28,32)_0%,rgb(20,20,23)_100%)] border-zinc-600 shadow-[0_0_0_1px_rgb(82_82_91/0.4),0_12px_28px_-12px_rgb(0_0_0/0.7)]'
    : 'bg-[linear-gradient(180deg,rgb(24,24,27)_0%,rgb(20,20,23)_100%)] border-zinc-800 hover:border-zinc-700 hover:shadow-[0_8px_24px_-12px_rgb(0_0_0/0.7)]'

  const cardFlash =
    poolFlash === 'up' ? 'after:bg-emerald-500/10'
    : poolFlash === 'down' ? 'after:bg-rose-500/10'
    : 'after:bg-transparent'

  const audienceLbl = audienceUnit(slot.board)

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
      <header className="relative flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-2 text-zinc-400">
          <span className="font-mono text-[11px] tabular-nums text-zinc-500">
            #{String(slot.pairIndex).padStart(2, '0')}
          </span>
          <span className="text-zinc-700">·</span>
          <span
            className={[
              'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em]',
              slot.board === 'stars'
                ? 'bg-amber-500/10 text-amber-300'
                : 'bg-sky-500/10 text-sky-300',
            ].join(' ')}
          >
            {slot.board}
          </span>
          <span className="inline-flex items-center rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-zinc-400">
            {windowLabel(slot.windowSecs)} {formatLabel(slot.format)}
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

      <div className="relative mt-4 flex items-stretch gap-2 sm:gap-3">
        <CompetitorBox
          side="yes"
          name={slot.displayA}
          audience={slot.audienceA}
          audienceLabel={audienceLbl}
          multiplier={yesMult}
          active={selected && selectedSide === 'yes'}
          inactive={selected && selectedSide !== 'yes'}
          resolved={resolved}
          isWinner={winnerYes}
          isLoser={winnerNo}
          refund={refund}
          oneSidedRefund={oneSided && state?.totalYes === 0n}
          onClick={() => onSelectSide(slot, 'yes')}
        />
        <span
          aria-hidden
          className="flex shrink-0 items-center justify-center font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-600"
        >
          vs
        </span>
        <CompetitorBox
          side="no"
          name={slot.displayB}
          audience={slot.audienceB}
          audienceLabel={audienceLbl}
          multiplier={noMult}
          active={selected && selectedSide === 'no'}
          inactive={selected && selectedSide !== 'no'}
          resolved={resolved}
          isWinner={winnerNo}
          isLoser={winnerYes}
          refund={refund}
          oneSidedRefund={oneSided && state?.totalNo === 0n}
          onClick={() => onSelectSide(slot, 'no')}
        />
      </div>

      <footer className="relative mt-4 flex items-center justify-between gap-3 text-[12px] text-zinc-500">
        <span>
          pool{' '}
          <span className="tabular-nums text-zinc-200">
            ${formatPoolFloat(totalPoolFloat)}
          </span>
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-600">
          settles {windowLabel(slot.windowSecs)} after open
        </span>
      </footer>
    </article>
  )
}
