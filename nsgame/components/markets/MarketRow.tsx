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

  // The percentage carries the weight; the multiplier and label are subordinate.
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'group flex items-center justify-between gap-4 rounded-lg border px-4 py-3 text-left transition-all',
        active
          ? yes
            ? 'border-emerald-500 bg-emerald-50 shadow-[0_0_0_1px_rgb(16_185_129)] '
            : 'border-rose-500 bg-rose-50 shadow-[0_0_0_1px_rgb(244_63_94)]'
          : yes
            ? 'border-zinc-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/40'
            : 'border-zinc-200 bg-white hover:border-rose-300 hover:bg-rose-50/40',
      ].join(' ')}
    >
      <span className="flex min-w-0 flex-col">
        <span
          className={[
            'text-[11px] font-medium uppercase tracking-[0.12em]',
            yes ? 'text-emerald-700' : 'text-rose-700',
          ].join(' ')}
        >
          {label}
        </span>
        <span className="mt-0.5 flex items-baseline gap-1">
          <span
            className={[
              'text-[22px] font-semibold tabular-nums leading-none tracking-tight',
              pct === null ? 'text-zinc-300' : yes ? 'text-emerald-700' : 'text-rose-700',
            ].join(' ')}
          >
            {pct === null ? '—' : pct.toFixed(0)}
          </span>
          <span
            className={[
              'text-[12px] font-medium',
              pct === null ? 'text-zinc-300' : yes ? 'text-emerald-600/70' : 'text-rose-600/70',
            ].join(' ')}
          >
            ¢
          </span>
        </span>
      </span>
      <span className="flex flex-col items-end">
        {oneSided ? (
          <span className="text-[11px] italic text-zinc-400">refund</span>
        ) : (
          <>
            <span className="text-[10px] uppercase tracking-[0.1em] text-zinc-400">
              payout
            </span>
            <span
              className={[
                'mt-0.5 text-[13px] font-medium tabular-nums',
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
        'rounded-xl border bg-white p-5 transition-all',
        selected
          ? 'border-zinc-900 shadow-[0_0_0_1px_rgb(24_24_27)]'
          : 'border-zinc-200/80 hover:border-zinc-300 hover:shadow-card',
      ].join(' ')}
      aria-label={slot.label}
    >
      <header className="flex items-center justify-between gap-3">
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

      <h3 className="mt-3 text-[16px] font-semibold leading-snug tracking-tight text-zinc-900">
        {slot.label}
      </h3>

      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
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

      <footer className="mt-4 flex items-center justify-between gap-3 text-[12px] text-zinc-500">
        <span>
          Pool <span className="tabular-nums text-zinc-800">${totalPool}</span>
        </span>
        <span className="flex items-center gap-1.5 text-zinc-500">
          {price.raw === null ? (
            <span className="text-zinc-400">—</span>
          ) : (
            <>
              <span className="text-zinc-500">{sourceShort}</span>
              <span className="tabular-nums text-zinc-800">{price.display}</span>
              {price.changeBp !== null && price.changeBp !== 0 ? (
                <span
                  className={[
                    'tabular-nums',
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
