'use client'

import { useMemo } from 'react'
import { CountdownTimer, useNowSecs } from './CountdownTimer'
import { SourceIcon } from './SourceIcon'
import { type UserPosition } from '@/lib/markets/positions'
import {
  type MarketState,
  realisedMultiplier,
  pctToDecimalOdd,
  deriveYesPct,
} from '@/lib/markets/hooks'
import { getCatalogEntryByPairIndex } from '@/lib/markets/catalog'

// Kalshi-style position card. The market is described by name (not by
// PDA hash); the row shows your side, your stake, your current value,
// your unrealised P&L, and the status. Settled rows show realised
// payout instead of mark-to-market.

const USDC_DECIMALS = 6

export interface PositionCardProps {
  position: UserPosition
  state: MarketState | null
}

export function PositionCard({ position, state }: PositionCardProps) {
  const entry = getCatalogEntryByPairIndex(position.thresholdBps)
  const now = useNowSecs()

  const sideA = position.side === 'yes'
  const backedName = entry ? (sideA ? entry.displayA : entry.displayB) : 'Side ' + (sideA ? 'A' : 'B')
  const opponentName = entry ? (sideA ? entry.displayB : entry.displayA) : ''
  const slug = entry ? (sideA ? entry.slugA : entry.slugB) : null

  // Status — drives the pill on the right and the colour of the value
  // line. Open positions get a live multiplier; settled positions show
  // the realised payout.
  const isResolved =
    position.state === 'resolved-won' ||
    position.state === 'resolved-lost' ||
    position.state === 'claimed-won' ||
    position.state === 'claimed-lost' ||
    position.state === 'stranded-refund'
  const won = position.state === 'resolved-won' || position.state === 'claimed-won'
  const lost = position.state === 'resolved-lost' || position.state === 'claimed-lost'
  const refund = position.state === 'stranded-refund'
  const settling = position.state === 'settling'
  const live = position.state === 'open' && now < position.closeTime
  const closed = position.state === 'open' && now >= position.closeTime

  // Current pool-implied multiplier for the user's side. Falls back to
  // the audience prior when the pool is empty so the row never reads as
  // "—" while a market is sitting open.
  const yesPct = useMemo(
    () => deriveYesPct(state, entry?.audienceA ?? 0n, entry?.audienceB ?? 0n),
    [state, entry?.audienceA, entry?.audienceB],
  )
  const sidePct = sideA ? yesPct : (100 - yesPct)
  const liveMult = state && (state.totalYes + state.totalNo) > 0n
    ? realisedMultiplier(state.totalYes, state.totalNo, position.side)
    : pctToDecimalOdd(sidePct)

  const stakeUsdc = unitsToFloat(position.amount)

  // Mark-to-market value while open: stake × multiplier. The realised
  // payout for resolved positions comes straight off the claim row.
  let valueUsdc: number | null = null
  let pnlUsdc: number | null = null
  if (won) {
    const claim = position.claimNet
    valueUsdc = claim !== null ? unitsToFloat(claim) : null
    pnlUsdc = valueUsdc !== null ? valueUsdc - stakeUsdc : null
  } else if (lost) {
    valueUsdc = 0
    pnlUsdc = -stakeUsdc
  } else if (refund) {
    valueUsdc = stakeUsdc
    pnlUsdc = 0
  } else if (liveMult !== null) {
    valueUsdc = stakeUsdc * liveMult
    pnlUsdc = valueUsdc - stakeUsdc
  }

  const sideTone = sideA
    ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
    : 'border-rose-500/40 bg-rose-500/15 text-rose-200'

  return (
    <article
      className={[
        'relative overflow-hidden rounded-xl border bg-[linear-gradient(180deg,rgb(24,24,27)_0%,rgb(20,20,23)_100%)] p-3 sm:p-4',
        'transition-[border-color,box-shadow] duration-200',
        won
          ? 'border-emerald-500/30 shadow-[0_0_0_1px_rgb(16_185_129/0.15)]'
          : lost
            ? 'border-rose-500/25'
            : settling
              ? 'border-amber-500/30'
              : 'border-zinc-800 hover:border-zinc-700',
      ].join(' ')}
      aria-label={entry?.label ?? position.market}
    >
      {/* Header — source, pair, status pill */}
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {slug ? (
            <Avatar slug={slug} name={backedName} side={position.side} />
          ) : null}
          <div className="flex min-w-0 flex-col">
            <h3 className="truncate text-[14px] font-semibold leading-tight tracking-tight text-zinc-100">
              {backedName}
            </h3>
            {opponentName ? (
              <p className="truncate font-mono text-[10.5px] text-zinc-500">
                vs {opponentName}
              </p>
            ) : null}
          </div>
        </div>

        <StatusPill
          state={position.state}
          live={live}
          closed={closed}
          settling={settling}
          won={won}
          lost={lost}
          refund={refund}
          closeTime={position.closeTime}
        />
      </header>

      {/* Two-column metrics — stake on the left, value on the right.
          The multiplier rides as a small chip in the value's sub-line so
          the row keeps its hierarchy in narrow side-rails. */}
      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-zinc-800/60 pt-3">
        <Metric
          label="Stake"
          value={`$${formatMoney(stakeUsdc)}`}
          sub={
            <span
              className={[
                'inline-flex items-center rounded border px-1 py-px font-mono text-[9px] font-semibold uppercase tracking-[0.1em]',
                sideTone,
              ].join(' ')}
            >
              {position.side}
            </span>
          }
        />
        <Metric
          label={isResolved ? (won ? 'Won' : refund ? 'Refund' : 'Lost') : 'Value'}
          value={valueUsdc !== null ? `$${formatMoney(valueUsdc)}` : '—'}
          valueClass={
            isResolved
              ? won ? 'text-emerald-300' : lost ? 'text-rose-300' : 'text-zinc-200'
              : 'text-zinc-100'
          }
          sub={
            <span className="flex items-center justify-end gap-1.5 font-mono text-[10px] tabular-nums">
              {pnlUsdc !== null && !refund ? (
                <span
                  className={
                    pnlUsdc > 0
                      ? 'text-emerald-300'
                      : pnlUsdc < 0
                        ? 'text-rose-300'
                        : 'text-zinc-500'
                  }
                >
                  {signedMoney(pnlUsdc)}
                </span>
              ) : null}
              {!isResolved && liveMult !== null ? (
                <span className="text-zinc-500">@ {liveMult.toFixed(2)}×</span>
              ) : null}
            </span>
          }
          align="right"
        />
      </div>
    </article>
  )
}

interface StatusPillProps {
  state: UserPosition['state']
  live: boolean
  closed: boolean
  settling: boolean
  won: boolean
  lost: boolean
  refund: boolean
  closeTime: number
}

function StatusPill({ live, closed, settling, won, lost, refund, closeTime }: StatusPillProps) {
  if (won) return <Pill tone="win">won</Pill>
  if (lost) return <Pill tone="lose">lost</Pill>
  if (refund) return <Pill tone="neutral">refund</Pill>
  if (settling) return <Pill tone="settling">settling</Pill>
  if (closed) return <Pill tone="settling">closed</Pill>
  if (live) {
    return (
      <Pill tone="live">
        <span className="relative inline-flex h-[6px] w-[6px]" aria-hidden>
          <span className="absolute inset-0 inline-flex animate-ping rounded-full bg-red-500 opacity-60" />
          <span className="relative inline-flex h-[6px] w-[6px] rounded-full bg-red-500" />
        </span>
        <span>live</span>
        <span className="text-zinc-500">·</span>
        <span className="tabular-nums">
          <CountdownTimer target={closeTime} closedLabel="0:00" />
        </span>
      </Pill>
    )
  }
  return null
}

function Pill({
  tone,
  children,
}: {
  tone: 'live' | 'settling' | 'win' | 'lose' | 'neutral'
  children: React.ReactNode
}) {
  const cls =
    tone === 'live'
      ? 'border-red-500/30 bg-red-500/10 text-red-300'
      : tone === 'settling'
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
        : tone === 'win'
          ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-200'
          : tone === 'lose'
            ? 'border-rose-500/30 bg-rose-500/15 text-rose-200'
            : 'border-zinc-700 bg-zinc-800/60 text-zinc-300'
  return (
    <span
      className={[
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em]',
        cls,
      ].join(' ')}
    >
      {children}
    </span>
  )
}

function Metric({
  label,
  value,
  sub,
  valueClass = 'text-zinc-100',
  align = 'left',
}: {
  label: string
  value: string
  sub?: React.ReactNode
  valueClass?: string
  align?: 'left' | 'right'
}) {
  return (
    <div className={['flex min-w-0 flex-col gap-1', align === 'right' ? 'items-end text-right' : 'items-start'].join(' ')}>
      <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </span>
      <span className={['font-semibold text-[14px] tabular-nums tracking-tight', valueClass].join(' ')}>
        {value}
      </span>
      {sub ? <span className="leading-none">{sub}</span> : null}
    </div>
  )
}

function Avatar({ slug, name, side }: { slug: string; name: string; side: 'yes' | 'no' }) {
  const ringTone = side === 'yes' ? 'ring-emerald-500/40' : 'ring-rose-500/40'
  return (
    <span
      className={['relative inline-flex h-9 w-9 shrink-0 overflow-hidden rounded-md ring-2', ringTone].join(' ')}
      aria-hidden
    >
      <img
        src={`/models/${slug}.jpg`}
        alt=""
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
        onError={(e) => {
          const img = e.currentTarget
          if (!img.dataset.fallback) {
            img.dataset.fallback = 'svg'
            img.src = `/models/${slug}.svg`
            return
          }
          img.style.display = 'none'
          const fallback = img.nextElementSibling as HTMLElement | null
          if (fallback) fallback.style.display = 'flex'
        }}
      />
      <span className="absolute inset-0 hidden items-center justify-center bg-zinc-800 text-[12px] font-semibold tracking-tight text-zinc-300">
        {initials(name)}
      </span>
    </span>
  )
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '··'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
}

function unitsToFloat(units: bigint): number {
  if (units === 0n) return 0
  return Number(units) / 10 ** USDC_DECIMALS
}

function formatMoney(value: number): string {
  if (!Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  // Cents matter at the small end where a few pennies move the meaning.
  // Above $10 the column would be too wide to read in a narrow rail —
  // the integer is sharp enough.
  const decimals = abs >= 10 ? 0 : 2
  const formatted = abs.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  return value < 0 ? `-${formatted}` : formatted
}

function signedMoney(value: number): string {
  if (!Number.isFinite(value)) return '—'
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  return `${sign}$${formatMoney(Math.abs(value))}`
}
