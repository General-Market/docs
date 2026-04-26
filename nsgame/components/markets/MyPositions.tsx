'use client'

import { useMemo, useState } from 'react'
import { useWallet } from '@/hooks/useWallet'
import { useUserPositions, type UserPosition } from '@/lib/markets/positions'
import { useNowSecs } from './CountdownTimer'
import { SourceIcon } from './SourceIcon'
import { WinShimmer } from './WinShimmer'
import { PositionMarketCard } from './PositionMarketCard'

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

function formatRemaining(secs: number): string {
  if (secs <= 0) return '0:00'
  const hours = Math.floor(secs / 3600)
  const mins = Math.floor((secs % 3600) / 60)
  const ss = secs % 60
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`
  }
  return `${mins}:${ss.toString().padStart(2, '0')}`
}

function shortMarket(pda: string): string {
  return `${pda.slice(0, 4)}…${pda.slice(-4)}`
}

function thresholdLabel(bps: number): string {
  // Threshold lives as basis points. Render as ±N bp; for big values fall
  // back to a percent so the column stays narrow.
  if (Math.abs(bps) >= 100) return `${bps > 0 ? '+' : ''}${(bps / 100).toFixed(2)}%`
  return `${bps > 0 ? '+' : ''}${bps}bp`
}

function sourceShortName(sourceId: number): string {
  // Light heuristic — the indexer doesn't expose a name, only the id.
  // Keep it terse; the icon carries most of the recognition load.
  return `src ${sourceId}`
}

interface RowProps {
  position: UserPosition
  now: number
}

function PositionRow({ position, now }: RowProps) {
  const iconId = (position.sourceId >= 1 && position.sourceId <= 5
    ? (position.sourceId as 1 | 2 | 3 | 4 | 5)
    : null)

  const sideClass = position.side === 'yes'
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
    : 'border-rose-500/30 bg-rose-500/10 text-rose-300'

  const isLive = position.state === 'open' && now < position.closeTime
  const settlementLeft = Math.max(0, position.settlementTime - now)

  return (
    <div className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-2">
      <span className="flex shrink-0 items-center gap-1.5 text-zinc-300">
        {iconId ? <SourceIcon sourceId={iconId} className="h-3.5 w-3.5" /> : null}
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-400">
          {sourceShortName(position.sourceId)}
        </span>
      </span>
      <span className="hidden font-mono text-[10px] text-zinc-500 sm:inline">
        {thresholdLabel(position.thresholdBps)}
      </span>
      <span
        className={[
          'inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.1em]',
          sideClass,
        ].join(' ')}
      >
        {position.side}
      </span>
      <span className="ml-auto flex items-center gap-2">
        <span className="font-mono text-[11px] tabular-nums text-zinc-100">
          {formatUsdcUnits(position.amount)}
        </span>
        {position.state === 'open' && isLive ? (
          <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.08em] text-emerald-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" aria-hidden />
            live
          </span>
        ) : null}
        {position.state === 'settling' ? (
          <span className="flex items-center gap-1 font-mono text-[10px] tabular-nums text-amber-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" aria-hidden />
            settles in {formatRemaining(settlementLeft)}
          </span>
        ) : null}
      </span>
    </div>
  )
}

function ResolvedRow({ position, now }: RowProps) {
  void now
  const iconId = (position.sourceId >= 1 && position.sourceId <= 5
    ? (position.sourceId as 1 | 2 | 3 | 4 | 5)
    : null)

  const won =
    position.state === 'resolved-won' || position.state === 'claimed-won'
  const refund = position.state === 'stranded-refund'

  const pillClass = won
    ? 'bg-emerald-500 text-zinc-950'
    : refund
      ? 'bg-zinc-800 text-zinc-300'
      : 'bg-rose-500 text-zinc-950'
  const pillLabel = won ? 'won' : refund ? 'refund' : 'lost'

  const claimNet = position.claimNet
  const winningsLine = won && claimNet !== null && claimNet > 0n
    ? `winnings: ${formatUsdcUnits(claimNet)} USDC`
    : refund && claimNet !== null
      ? `refunded: ${formatUsdcUnits(claimNet)} USDC`
      : null

  const payoutDisplay = won && claimNet !== null && claimNet > 0n
    ? formatUsdcUnits(claimNet)
    : undefined

  const row = (
    <div className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-2">
      <span className="flex shrink-0 items-center gap-1.5 text-zinc-300">
        {iconId ? <SourceIcon sourceId={iconId} className="h-3.5 w-3.5" /> : null}
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-400">
          {sourceShortName(position.sourceId)}
        </span>
      </span>
      <span className="hidden font-mono text-[10px] text-zinc-500 sm:inline">
        {thresholdLabel(position.thresholdBps)}
      </span>
      <span
        className={[
          'inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.1em]',
          pillClass,
        ].join(' ')}
      >
        {pillLabel}
      </span>
      <span className="ml-auto flex flex-col items-end gap-0.5">
        <span className="font-mono text-[11px] tabular-nums text-zinc-300">
          {formatUsdcUnits(position.amount)} in
        </span>
        {winningsLine ? (
          <span
            className={[
              'font-mono text-[10px] tabular-nums',
              won ? 'text-emerald-300' : 'text-zinc-500',
            ].join(' ')}
          >
            {winningsLine}
          </span>
        ) : null}
      </span>
    </div>
  )

  return (
    <WinShimmer active={position.justWon === true} payout={payoutDisplay}>
      {row}
    </WinShimmer>
  )
}

export interface MyPositionsProps {
  /** Compact summary mode — single line, click to expand. */
  compact?: boolean
  /** Suppress the section header (caller already renders one). */
  hideHeader?: boolean
  /**
   * Render mode for the body. Cards mirror the main-grid MarketCard with
   * the close+settlement double timer; rows are the dense one-line
   * summary kept for the compact sidebar variant.
   */
  variant?: 'rows' | 'cards'
  /** Pivot the user away from the empty state — close the modal, scroll
   *  to the markets feed, whatever the host needs. */
  onEmptyPivot?: () => void
  className?: string
}

export function MyPositions({ compact = false, hideHeader = false, variant, onEmptyPivot, className = '' }: MyPositionsProps) {
  const { address } = useWallet()
  const { positions } = useUserPositions(address)
  const now = useNowSecs()
  const [expanded, setExpanded] = useState<boolean>(false)

  const buckets = useMemo(() => {
    const open: UserPosition[] = []
    const settling: UserPosition[] = []
    const resolved: UserPosition[] = []
    for (const p of positions) {
      if (p.state === 'open') open.push(p)
      else if (p.state === 'settling') settling.push(p)
      else resolved.push(p)
    }
    return { open, settling, resolved }
  }, [positions])

  const wonCount = useMemo(
    () => buckets.resolved.filter(p => p.state === 'resolved-won' || p.state === 'claimed-won').length,
    [buckets.resolved],
  )

  if (!address) return null

  const total = positions.length
  const empty = total === 0
  const bodyVariant: 'rows' | 'cards' = variant ?? (compact ? 'rows' : 'cards')

  // Compact mobile mode: a single header row that expands on tap.
  if (compact) {
    if (empty) {
      return (
        <div
          className={[
            'flex items-center justify-between gap-3 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2',
            className,
          ].join(' ')}
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-300">
            No bets yet. The room is open.
          </p>
          {onEmptyPivot ? (
            <button
              type="button"
              onClick={onEmptyPivot}
              className="inline-flex h-7 shrink-0 items-center rounded border border-zinc-700 bg-zinc-900 px-2 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-200 transition-colors hover:border-zinc-500 hover:text-zinc-50"
            >
              See markets
            </button>
          ) : null}
        </div>
      )
    }
    return (
      <div
        className={[
          'rounded-md border border-zinc-800 bg-zinc-900',
          className,
        ].join(' ')}
      >
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="flex w-full items-center justify-between px-3 py-2 text-left"
          aria-expanded={expanded}
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
            my positions
          </span>
          <span className="font-mono text-[10px] text-zinc-300">
            {buckets.open.length} open · {buckets.settling.length} settling · {wonCount} won
          </span>
        </button>
        {expanded ? (
          <div className="space-y-3 border-t border-zinc-800 px-3 py-3">
            <PositionsBody buckets={buckets} now={now} variant={bodyVariant} />
          </div>
        ) : null}
      </div>
    )
  }

  // Desktop full panel.
  return (
    <section
      className={[
        'flex flex-col rounded-md border border-zinc-800 bg-zinc-900',
        className,
      ].join(' ')}
      aria-label="My positions"
    >
      {!hideHeader ? (
        <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
            my positions
          </span>
          {!empty ? (
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 font-mono text-[10px] tabular-nums text-zinc-300">
              {total}
            </span>
          ) : null}
        </header>
      ) : null}

      {empty ? (
        <div className="flex flex-col items-start gap-3 px-4 py-6">
          <p className="text-[13px] text-zinc-300">
            No bets yet. The room is open.
          </p>
          {onEmptyPivot ? (
            <button
              type="button"
              onClick={onEmptyPivot}
              className="inline-flex h-8 items-center rounded-md border border-zinc-700 bg-zinc-900 px-3 font-mono text-[11px] uppercase tracking-[0.12em] text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-800 hover:text-zinc-50"
            >
              See markets
            </button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3 px-3 py-3">
          <PositionsBody buckets={buckets} now={now} variant={bodyVariant} />
        </div>
      )}
    </section>
  )
}

interface BodyProps {
  buckets: {
    open: UserPosition[]
    settling: UserPosition[]
    resolved: UserPosition[]
  }
  now: number
  variant: 'rows' | 'cards'
}

function PositionsBody({ buckets, now, variant }: BodyProps) {
  const renderItem = (p: UserPosition, kind: 'open' | 'settling' | 'resolved') => {
    if (variant === 'cards') {
      return <PositionMarketCard key={p.betSig} position={p} now={now} />
    }
    if (kind === 'resolved') {
      return <ResolvedRow key={p.betSig} position={p} now={now} />
    }
    return <PositionRow key={p.betSig} position={p} now={now} />
  }

  // Cards breathe on a one-column stack so the dual timer stays legible;
  // rows stay tight for the sidebar's compact summary.
  const listClass = variant === 'cards' ? 'space-y-2' : 'space-y-1.5'

  return (
    <>
      {buckets.open.length > 0 ? (
        <div className="space-y-1.5">
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-400">
            open
          </p>
          <div className={listClass}>
            {buckets.open.map(p => renderItem(p, 'open'))}
          </div>
        </div>
      ) : null}

      {buckets.settling.length > 0 ? (
        <div className="space-y-1.5">
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-400">
            settling
          </p>
          <div className={listClass}>
            {buckets.settling.map(p => renderItem(p, 'settling'))}
          </div>
        </div>
      ) : null}

      {buckets.resolved.length > 0 ? (
        <div className="space-y-1.5">
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-400">
            resolved
          </p>
          <div className={listClass}>
            {buckets.resolved.map(p => renderItem(p, 'resolved'))}
          </div>
        </div>
      ) : null}
    </>
  )
}

// Suppress unused warning for shortMarket — kept for possible explorer link
// follow-ups; the row currently uses sourceShortName.
void shortMarket
