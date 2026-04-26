'use client'

import { useMemo } from 'react'
import type { UserPosition } from '@/lib/markets/positions'
import { getCatalogEntryByPairIndex } from '@/lib/markets/catalog'
import { SourceIcon } from './SourceIcon'
import { DualTimer } from './DualTimer'
import { WinShimmer } from './WinShimmer'

// One position. One card. Mirrors MarketCard's chrome — same border,
// same padding, same source pill — so the popup feels continuous with
// the main grid. The double timer takes the place of the single
// countdown, since a position cares about both close and settlement.

const USDC_DECIMALS = 6

function formatUsdc(units: bigint): string {
  if (units === 0n) return '0'
  const base = 10n ** BigInt(USDC_DECIMALS)
  const whole = units / base
  const frac = units % base
  if (frac === 0n) return whole.toString()
  const fracStr = frac.toString().padStart(USDC_DECIMALS, '0').replace(/0+$/, '')
  return fracStr ? `${whole.toString()}.${fracStr}` : whole.toString()
}

function thresholdLabel(bps: number): string {
  if (Math.abs(bps) >= 100) return `${bps > 0 ? '+' : ''}${(bps / 100).toFixed(2)}%`
  return `${bps > 0 ? '+' : ''}${bps}bp`
}

export interface PositionMarketCardProps {
  position: UserPosition
  now: number
}

export function PositionMarketCard({ position, now }: PositionMarketCardProps) {
  const catalog = useMemo(
    () => getCatalogEntryByPairIndex(position.thresholdBps),
    [position.thresholdBps],
  )

  const iconId = position.sourceId >= 1 && position.sourceId <= 5
    ? (position.sourceId as 1 | 2 | 3 | 4 | 5)
    : null
  const sourceShort = (catalog?.sourceName ?? `src ${position.sourceId}`).replace(/^tubes_/, '')
  const title = catalog?.label ?? `pair ${thresholdLabel(position.thresholdBps)}`

  const sideClass = position.side === 'yes'
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
    : 'border-rose-500/30 bg-rose-500/10 text-rose-300'

  const isOpen = position.state === 'open'
  const isSettling = position.state === 'settling'
  const isWon = position.state === 'resolved-won' || position.state === 'claimed-won'
  const isLost = position.state === 'resolved-lost' || position.state === 'claimed-lost'
  const isRefund = position.state === 'stranded-refund'
  const isLive = isOpen && now > 0 && now < position.closeTime
  const showTimer = isOpen || isSettling

  const stateLabel = isLive
    ? 'live'
    : isOpen
      ? 'closed'
      : isSettling
        ? 'settling'
        : isWon
          ? 'won'
          : isLost
            ? 'lost'
            : isRefund
              ? 'refund'
              : ''

  const stateClass = isLive || isWon
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
    : isLost
      ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
      : isSettling
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
        : 'border-zinc-700 bg-zinc-800 text-zinc-400'

  const claimNet = position.claimNet
  const winningsLine = isWon && claimNet !== null && claimNet > 0n
    ? `+${formatUsdc(claimNet)} USDC`
    : isRefund && claimNet !== null
      ? `refund ${formatUsdc(claimNet)} USDC`
      : null

  const card = (
    <div
      className={[
        'flex w-full flex-col gap-3 rounded-md border border-zinc-800 bg-zinc-900 p-3',
        !isLive && !isSettling && !isWon ? 'opacity-90' : '',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-500">
          {iconId ? <SourceIcon sourceId={iconId} className="h-3.5 w-3.5" /> : null}
          {sourceShort}
        </span>
        <span
          className={[
            'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.1em]',
            stateClass,
          ].join(' ')}
        >
          {isLive || isSettling ? (
            <span
              aria-hidden
              className={[
                'h-1.5 w-1.5 animate-pulse rounded-full',
                isLive ? 'bg-emerald-400' : 'bg-amber-400',
              ].join(' ')}
            />
          ) : null}
          {stateLabel}
        </span>
      </div>

      <p className="text-sm font-medium leading-snug text-zinc-100 line-clamp-3 min-h-[2.6em]">
        {title}
      </p>

      <div className="flex items-center justify-between font-mono text-[11px]">
        <span
          className={[
            'inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em]',
            sideClass,
          ].join(' ')}
        >
          {position.side}
        </span>
        <span className="flex items-baseline gap-1.5 tabular-nums">
          <span className="text-zinc-100">{formatUsdc(position.amount)}</span>
          <span className="text-[10px] uppercase tracking-[0.08em] text-zinc-500">
            USDC stake
          </span>
        </span>
      </div>

      {winningsLine ? (
        <div
          className={[
            'rounded px-1.5 py-1 text-center font-mono text-[11px]',
            isWon ? 'bg-emerald-500/10 text-emerald-300' : 'bg-zinc-800 text-zinc-400',
          ].join(' ')}
        >
          {winningsLine}
        </div>
      ) : null}

      {showTimer ? (
        <DualTimer
          closeTime={position.closeTime}
          settlementTime={position.settlementTime}
        />
      ) : null}
    </div>
  )

  const payoutDisplay = isWon && claimNet !== null && claimNet > 0n
    ? formatUsdc(claimNet)
    : undefined

  return (
    <WinShimmer active={position.justWon === true} payout={payoutDisplay}>
      {card}
    </WinShimmer>
  )
}
