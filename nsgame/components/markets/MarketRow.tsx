'use client'

import { useMemo } from 'react'
import type { UpcomingSlot, MarketState } from '@/lib/markets/hooks'
import { useSourcePrice, payoutMultiplier, formatMultiplier } from '@/lib/markets/hooks'
import { CountdownTimer, useNowSecs } from './CountdownTimer'
import { SourceIcon } from './SourceIcon'
import { PulseDot } from './PulseDot'

// Fat market row. Header, title, two outcome rows, footer. Replaces the
// small card for the single-column list view.

export type Side = 'yes' | 'no'

export interface MarketRowProps {
  slot: UpcomingSlot
  state: MarketState | null
  selected: boolean
  selectedSide: Side | null
  onSelectSide: (slot: UpcomingSlot, side: Side) => void
}

const USDC_DECIMALS = 6

function formatPool(units: bigint): string {
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

  const baseChip = yes
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : 'bg-rose-50 text-rose-700 border-rose-200'
  const activeChip = yes
    ? 'bg-emerald-500 text-white border-emerald-500'
    : 'bg-rose-500 text-white border-rose-500'

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-left transition-colors',
        active
          ? yes
            ? 'border-emerald-500 bg-emerald-50/60'
            : 'border-rose-500 bg-rose-50/60'
          : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50',
      ].join(' ')}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span
          className={[
            'inline-flex h-5 items-center justify-center rounded border px-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em]',
            active ? activeChip : baseChip,
          ].join(' ')}
        >
          {label}
        </span>
        <span className="font-mono text-[11px] tabular-nums text-zinc-500">
          {pct === null ? 'no pool' : `${pct.toFixed(0)}%`}
        </span>
      </span>
      <span className="flex items-center gap-2">
        {oneSided ? (
          <span className="font-mono text-[11px] italic text-zinc-500">refund</span>
        ) : null}
        <span
          className={[
            'inline-flex h-6 items-center rounded-md px-2 font-mono text-[12px] font-semibold tabular-nums',
            yes
              ? active
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 text-emerald-700'
              : active
                ? 'bg-rose-600 text-white'
                : 'bg-rose-50 text-rose-700',
          ].join(' ')}
        >
          {formatMultiplier(multiplier)}
        </span>
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

  const totalPool = useMemo(
    () => state ? formatPool(state.totalYes + state.totalNo) : '0',
    [state],
  )

  const price = useSourcePrice(slot.sourceId)

  const now = useNowSecs()
  const closed = now > 0 && slot.closeTime <= now
  const resolved = !!state?.resolved

  // Status label: live vs open vs closed vs resolved.
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

  // Map sourceId narrowly for SourceIcon.
  const iconId = (slot.sourceId >= 1 && slot.sourceId <= 5
    ? (slot.sourceId as 1 | 2 | 3 | 4 | 5)
    : null)

  return (
    <article
      className={[
        'rounded-md border bg-white p-4 transition-colors',
        selected ? 'border-zinc-900' : 'border-zinc-200 hover:border-zinc-300',
      ].join(' ')}
      aria-label={slot.label}
    >
      <header className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-zinc-700">
          {iconId ? <SourceIcon sourceId={iconId} className="h-4 w-4" /> : null}
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]">
            {sourceShort}
          </span>
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-500">
          aggregate · {slot.thresholdBps >= 0 ? '+' : ''}{slot.thresholdBps} bps
        </span>
      </header>

      <h3 className="mt-3 text-[15px] font-semibold leading-snug text-zinc-900 sm:text-base">
        {slot.label}
      </h3>

      <p className="mt-1.5 flex items-center gap-2 font-mono text-[11px] text-zinc-600">
        {statusTone === 'live' ? (
          <PulseDot active color="amber" />
        ) : null}
        <span
          className={
            statusTone === 'live'
              ? 'text-amber-700'
              : statusTone === 'closed'
                ? 'text-zinc-500'
                : statusTone === 'resolved'
                  ? 'text-zinc-700'
                  : 'text-zinc-600'
          }
        >
          {statusLabel}
        </span>
        {!closed && !resolved ? (
          <span className="text-zinc-500">
            · closes in <CountdownTimer target={slot.closeTime} closedLabel="closed" />
          </span>
        ) : null}
      </p>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <OutcomeButton
          side="yes"
          label="YES"
          pct={yesPct}
          multiplier={yesMult}
          active={selected && selectedSide === 'yes'}
          oneSided={oneSided && state?.totalNo === 0n}
          onClick={() => onSelectSide(slot, 'yes')}
        />
        <OutcomeButton
          side="no"
          label="NO"
          pct={noPct}
          multiplier={noMult}
          active={selected && selectedSide === 'no'}
          oneSided={oneSided && state?.totalYes === 0n}
          onClick={() => onSelectSide(slot, 'no')}
        />
      </div>

      <footer className="mt-3 flex items-center justify-between gap-3 font-mono text-[11px] text-zinc-500">
        <span>
          pool · <span className="tabular-nums text-zinc-700">{totalPool}</span> USDC
        </span>
        <span className="text-zinc-500">
          {price.raw === null
            ? '—'
            : <>
                {sourceShort}: <span className="tabular-nums text-zinc-700">{price.display}</span>
                {price.changeBp !== null && price.changeBp !== 0 ? (
                  <span
                    className={[
                      'ml-1.5',
                      price.changeBp > 0 ? 'text-emerald-700' : 'text-rose-700',
                    ].join(' ')}
                  >
                    {price.changeBp > 0 ? '+' : ''}{price.changeBp} bp
                  </span>
                ) : null}
              </>
          }
        </span>
      </footer>
    </article>
  )
}
