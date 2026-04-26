'use client'

import { useEffect, useState } from 'react'
import { useRecentBets, type RecentBetEvent } from '@/hooks/useRecentBets'
import { pairById } from '@/lib/markets/pairs'
import { payoutMultiplier } from '@/lib/markets/hooks'
import { SourceIcon } from './SourceIcon'

// A network-wide ledger of bets placed across every market. The shape
// mirrors what every casino settled on long ago — game, user, time,
// stake, multiplier, payout. The rows fit together because the columns
// have stopped trying to be different from anyone else's columns.

const USDC_DECIMALS = 6
const ROWS = 12

export interface LastTradesTableProps {
  className?: string
}

export function LastTradesTable({ className = '' }: LastTradesTableProps) {
  const { events, isLoading } = useRecentBets(ROWS)

  // Keep a wall clock so "Xs ago" doesn't lie to a user staring at the
  // screen. A minute-tick is enough — sub-minute values cap at "59s".
  const [nowSecs, setNowSecs] = useState<number>(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const id = window.setInterval(() => setNowSecs(Math.floor(Date.now() / 1000)), 30_000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <section className={className} aria-label="Last trades">
      <header className="mb-3 flex items-end justify-between gap-3">
        <div className="space-y-1">
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
            trades · live ledger
            <span className="relative inline-flex h-[6px] w-[6px]" aria-hidden>
              <span className="absolute inset-0 inline-flex animate-ping rounded-full bg-emerald-500 opacity-60" />
              <span className="relative inline-flex h-[6px] w-[6px] rounded-full bg-emerald-500" />
            </span>
          </p>
          <h2 className="text-[18px] font-semibold tracking-tight text-zinc-100">
            Money changed hands<span className="text-rose-500">.</span>
          </h2>
        </div>
      </header>

      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60">
        {/* Column titles. Hidden below sm — mobile rows label themselves
            inline so the table still reads without a header. */}
        <div className="hidden sm:grid grid-cols-[minmax(0,2.2fr)_minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,1.2fr)] items-center gap-3 border-b border-zinc-800 bg-zinc-900/80 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
          <span>Game</span>
          <span>User</span>
          <span>Time</span>
          <span className="text-right">Bet</span>
          <span className="text-right">Multiplier</span>
          <span className="text-right">Payout</span>
        </div>

        {events.length === 0 && !isLoading ? (
          <p className="px-4 py-6 text-center font-mono text-[12px] text-zinc-500">
            The book is empty. Someone has to be first.
          </p>
        ) : null}

        {events.length === 0 && isLoading ? (
          <div className="divide-y divide-zinc-800/60">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/60">
            {events.map(ev => (
              <Row key={ev.signature} event={ev} nowSecs={nowSecs} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

interface RowProps {
  event: RecentBetEvent
  nowSecs: number
}

function Row({ event, nowSecs }: RowProps) {
  const pair = event.thresholdBps != null ? pairById(event.thresholdBps) : undefined
  const sideLabel = event.side === 0 ? 'yes' : 'no'
  const backedName = pair
    ? event.side === 0 ? pair.displayA : pair.displayB
    : '—'
  const opponentName = pair
    ? event.side === 0 ? pair.displayB : pair.displayA
    : ''
  const amount = safeBig(event.amount)

  // Pools are summed across the whole market — the indexer carries them
  // even after the on-chain account is closed. payoutMultiplier returns
  // null when the side is empty, which is what "—" used to mean.
  const totalYes = safeBig(event.totalYes)
  const totalNo = safeBig(event.totalNo)
  const hasPools = totalYes > 0n || totalNo > 0n
  const mult = hasPools ? payoutMultiplier(totalYes, totalNo, sideLabel) : null

  // Three states for the right-hand columns:
  //  1. Resolved + winning side → realised payout (green).
  //  2. Resolved + losing side  → −stake (red), the actual loss.
  //  3. Live                    → potential payout at current pools.
  const won = event.resolved && event.outcomeYes !== null
    && ((sideLabel === 'yes' && event.outcomeYes === true)
      || (sideLabel === 'no' && event.outcomeYes === false))
  const lost = event.resolved && event.outcomeYes !== null && !won

  let payout: number | null = null
  if (event.resolved && event.outcomeYes === null) {
    // Refund — every side gets its stake back at 1.0×.
    payout = Number(amount) / 10 ** USDC_DECIMALS
  } else if (won && mult !== null) {
    payout = estimatedPayout(amount, mult)
  } else if (lost) {
    payout = -(Number(amount) / 10 ** USDC_DECIMALS)
  } else if (mult !== null) {
    payout = estimatedPayout(amount, mult)
  }

  const payoutTone = payout === null
    ? 'text-zinc-500'
    : payout < 0
      ? 'text-rose-300'
      : event.resolved
        ? 'text-emerald-300'
        : 'text-zinc-200'

  const tone = sideLabel === 'yes'
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
    : 'border-rose-500/30 bg-rose-500/10 text-rose-300'

  const sourceIconId = sourceIconFromPair(event.thresholdBps)
  const blockTime = event.timestamp != null ? Number(event.timestamp) : null
  const ts = relTime(blockTime, nowSecs)

  return (
    <div
      className={[
        // Mobile: 3-col compressed grid (Game · Bet · Payout). Desktop:
        // the same six-column grid the header advertises.
        'grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2 px-3 py-2',
        'sm:grid-cols-[minmax(0,2.2fr)_minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,1.2fr)] sm:gap-3 sm:px-4 sm:py-2.5',
        'items-center text-[12px] text-zinc-300',
      ].join(' ')}
    >
      {/* Game */}
      <div className="flex min-w-0 items-center gap-2">
        {sourceIconId ? (
          <SourceIcon sourceId={sourceIconId} className="h-4 w-4 shrink-0 rounded" />
        ) : null}
        <span className="flex min-w-0 flex-col">
          <span className="flex min-w-0 items-center gap-1.5">
            <span
              className={[
                'inline-flex shrink-0 items-center rounded border px-1 py-px font-mono text-[9px] font-semibold uppercase tracking-[0.1em]',
                tone,
              ].join(' ')}
            >
              {sideLabel}
            </span>
            <span className="truncate font-medium text-zinc-100">{backedName}</span>
          </span>
          {opponentName ? (
            <span className="truncate font-mono text-[10px] text-zinc-500">
              vs {opponentName}
            </span>
          ) : null}
        </span>
      </div>

      {/* User · desktop only */}
      <div className="hidden sm:block min-w-0 font-mono text-[11px] tabular-nums text-zinc-400">
        <span className="inline-flex items-center gap-1">
          <span aria-hidden className="text-zinc-600">·</span>
          {shortAddr(event.walletAddress)}
        </span>
      </div>

      {/* Time · desktop only */}
      <div className="hidden sm:block font-mono text-[11px] tabular-nums text-zinc-500">
        {ts}
      </div>

      {/* Bet — visible on every breakpoint */}
      <div className="text-right">
        <span className="block font-mono text-[12px] font-semibold tabular-nums text-zinc-100">
          {formatUsdc(amount)}
        </span>
        <span className="block font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-500 sm:hidden">
          {ts}
        </span>
      </div>

      {/* Multiplier · desktop only */}
      <div className="hidden sm:block text-right font-mono text-[12px] tabular-nums text-zinc-300">
        {formatMultiplier(mult)}
      </div>

      {/* Payout — visible on every breakpoint */}
      <div className="text-right">
        <span
          className={[
            'block font-mono text-[12px] font-semibold tabular-nums',
            payoutTone,
          ].join(' ')}
        >
          {payout !== null ? formatUsdcDecimal(payout) : '—'}
        </span>
        <span className="block font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-500 sm:hidden">
          {formatMultiplier(mult)}
        </span>
      </div>
    </div>
  )
}

function SkeletonRow() {
  return (
    <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2 px-3 py-2 sm:grid-cols-[minmax(0,2.2fr)_minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,1.2fr)] sm:gap-3 sm:px-4 sm:py-2.5">
      <div className="flex items-center gap-2">
        <span className="h-4 w-4 rounded bg-zinc-800" />
        <span className="h-3 w-32 rounded bg-zinc-800" />
      </div>
      <span className="hidden sm:block h-3 w-16 rounded bg-zinc-800" />
      <span className="hidden sm:block h-3 w-12 rounded bg-zinc-800" />
      <span className="ml-auto h-3 w-14 rounded bg-zinc-800" />
      <span className="hidden sm:block ml-auto h-3 w-10 rounded bg-zinc-800" />
      <span className="ml-auto h-3 w-16 rounded bg-zinc-800" />
    </div>
  )
}

function safeBig(s: string | null | undefined): bigint {
  if (!s) return 0n
  try { return BigInt(s) } catch { return 0n }
}

// 6-decimal USDC → "$1,234.56", trimmed to dollars when whole.
function formatUsdc(units: bigint): string {
  if (units === 0n) return '$0'
  const negative = units < 0n
  const abs = negative ? -units : units
  const base = 10n ** BigInt(USDC_DECIMALS)
  const whole = abs / base
  const frac = abs % base
  const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  let out: string
  if (frac === 0n) {
    out = wholeStr
  } else {
    const fracStr = frac.toString().padStart(USDC_DECIMALS, '0').slice(0, 2)
    // Trim "00" tails — "$12.50" stays, "$12.00" goes back to "$12".
    out = fracStr === '00' ? wholeStr : `${wholeStr}.${fracStr}`
  }
  return `${negative ? '-' : ''}$${out}`
}

// Float → "$1,234.56" with two decimals when small, no decimals at scale.
function formatUsdcDecimal(value: number): string {
  if (!Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  const decimals = abs >= 1000 ? 0 : 2
  const formatted = abs.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  return `${value < 0 ? '-' : ''}$${formatted}`
}

// (units * multiplier) / 1e6 → potential payout in dollars, as float.
// Multiplier is a number, units is a bigint — bridge through Number once
// the unit count is small enough to fit safely.
function estimatedPayout(units: bigint, mult: number): number {
  if (units === 0n || !Number.isFinite(mult)) return 0
  return (Number(units) / 10 ** USDC_DECIMALS) * mult
}

function formatMultiplier(m: number | null): string {
  if (m === null || !Number.isFinite(m)) return '—'
  if (m >= 100) return `${m.toFixed(0)}×`
  return `${m.toFixed(2)}×`
}

function shortAddr(addr: string | null): string {
  if (!addr) return '—'
  if (addr.length <= 9) return addr
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`
}

function relTime(blockTime: number | null, nowSecs: number): string {
  if (blockTime === null) return '—'
  const diff = Math.max(0, nowSecs - blockTime)
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

// Stars run pair indices 1..15 (xvideos), cams 16..25 (chaturbate).
function sourceIconFromPair(pairIndex: number | null): 1 | 4 | null {
  if (pairIndex == null) return null
  if (pairIndex >= 1 && pairIndex <= 15) return 1
  if (pairIndex >= 16 && pairIndex <= 25) return 4
  return null
}
