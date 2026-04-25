'use client'

import { useMemo } from 'react'
import { type ActivityEvent, useGlobalActivity } from '@/lib/markets/activity'
import { useNowSecs } from './CountdownTimer'
import { PulseDot } from './PulseDot'
import { SourceIcon } from './SourceIcon'

// A network-wide feed — bets, resolutions, claims, every wallet, mixed
// and slot-ordered. The right rail's heartbeat. Denser than MyPositions
// because it is a feed and not a dashboard.

const USDC_DECIMALS = 6
const MAX_DESKTOP = 10
const MAX_COMPACT = 5

function formatUsdc(units: bigint | undefined): string {
  if (units === undefined) return '—'
  if (units === 0n) return '0'
  const negative = units < 0n
  const abs = negative ? -units : units
  const base = 10n ** BigInt(USDC_DECIMALS)
  const whole = abs / base
  const frac = abs % base
  let out: string
  if (frac === 0n) {
    out = whole.toString()
  } else {
    const fracStr = frac.toString().padStart(USDC_DECIMALS, '0').replace(/0+$/, '')
    out = fracStr ? `${whole.toString()}.${fracStr}` : whole.toString()
  }
  return negative ? `-${out}` : out
}

function shortAddr(addr: string | null): string {
  if (!addr) return '—'
  if (addr.length <= 9) return addr
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`
}

function pairLabel(pairIndex: number | null): string {
  if (pairIndex === null) return '#??'
  return `#${pairIndex.toString().padStart(2, '0')}`
}

function relativeTime(blockTime: number | null, nowSecs: number): string {
  if (blockTime === null) return '—'
  const diff = Math.max(0, nowSecs - blockTime)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

// Stars run pair indices 1..15, cams 16..25 — matches lib/markets/pairs.ts.
function iconSourceId(pairIndex: number | null): 1 | 4 | null {
  if (pairIndex === null) return null
  if (pairIndex >= 1 && pairIndex <= 15) return 1
  if (pairIndex >= 16 && pairIndex <= 25) return 4
  return null
}

// Compact score rendering — ±1.2M, ±34K, ±567. The final_price column is
// a u128 (signed score in the program's accounting). For the feed we
// only need a rough magnitude.
function formatScore(value: bigint | undefined): string {
  if (value === undefined) return '—'
  const negative = value < 0n
  const abs = negative ? -value : value
  let out: string
  if (abs >= 1_000_000n) {
    const m = Number(abs / 1_000n) / 1_000
    out = `${m.toFixed(1)}M`
  } else if (abs >= 1_000n) {
    const k = Number(abs) / 1_000
    out = `${k.toFixed(1)}K`
  } else {
    out = abs.toString()
  }
  const sign = negative ? '-' : '+'
  return `${sign}${out}`
}

interface RowProps {
  event: ActivityEvent
  nowSecs: number
}

function ActivityRow({ event, nowSecs }: RowProps) {
  const iconId = iconSourceId(event.pairIndex)
  const ts = relativeTime(event.blockTime, nowSecs)
  const pair = pairLabel(event.pairIndex)

  if (event.kind === 'bet') {
    const sideClass = event.side === 'yes'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
      : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
    return (
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <span className="flex shrink-0 items-center gap-1">
          {iconId ? <SourceIcon sourceId={iconId} className="h-3 w-3" /> : null}
          <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-500">bet</span>
        </span>
        <span className="font-mono text-[10px] tabular-nums text-zinc-400">
          {shortAddr(event.owner)}
        </span>
        <span className="font-mono text-[10px] tabular-nums text-zinc-200">
          {formatUsdc(event.amount)} <span className="text-zinc-500">USDC</span>
        </span>
        <span
          className={[
            'inline-flex items-center rounded border px-1 py-px font-mono text-[9px] font-semibold uppercase tracking-[0.1em]',
            sideClass,
          ].join(' ')}
        >
          {event.side ?? '—'}
        </span>
        <span className="font-mono text-[10px] tabular-nums text-zinc-500">{pair}</span>
        <span className="ml-auto font-mono text-[10px] tabular-nums text-zinc-600">{ts}</span>
      </div>
    )
  }

  if (event.kind === 'resolved') {
    const winLabel = event.outcomeYes ? 'A' : 'B'
    return (
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <span className="flex shrink-0 items-center gap-1">
          {iconId ? <SourceIcon sourceId={iconId} className="h-3 w-3" /> : null}
          <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-500">resolved</span>
        </span>
        <span className="font-mono text-[10px] tabular-nums text-zinc-500">{pair}</span>
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-200">
          {winLabel}
        </span>
        <span className="font-mono text-[10px] tabular-nums text-zinc-400">
          {formatScore(event.finalPrice)}
        </span>
        <span className="ml-auto font-mono text-[10px] tabular-nums text-zinc-600">{ts}</span>
      </div>
    )
  }

  // claim
  const won = event.stranded === false && (event.net ?? 0n) > 0n
  const refund = event.stranded === true
  const verb = refund ? 'refund' : won ? 'won' : 'lost'
  const verbClass = refund
    ? 'text-zinc-400'
    : won
      ? 'text-emerald-300'
      : 'text-rose-300'
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5">
      <span className="flex shrink-0 items-center gap-1">
        {iconId ? <SourceIcon sourceId={iconId} className="h-3 w-3" /> : null}
        <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-500">claim</span>
      </span>
      <span className="font-mono text-[10px] tabular-nums text-zinc-400">
        {shortAddr(event.owner)}
      </span>
      <span className={['font-mono text-[10px] font-semibold uppercase tracking-[0.08em]', verbClass].join(' ')}>
        {verb}
      </span>
      <span className="font-mono text-[10px] tabular-nums text-zinc-200">
        {formatUsdc(event.net)} <span className="text-zinc-500">USDC</span>
      </span>
      <span className="font-mono text-[10px] tabular-nums text-zinc-500">{pair}</span>
      <span className="ml-auto font-mono text-[10px] tabular-nums text-zinc-600">{ts}</span>
    </div>
  )
}

export interface GlobalActivityProps {
  /** Compact mode (mobile sheet): cap at 5 rows, tighter chrome. */
  compact?: boolean
  className?: string
}

export function GlobalActivity({ compact = false, className = '' }: GlobalActivityProps) {
  const limit = compact ? MAX_COMPACT : MAX_DESKTOP
  const { events, loading } = useGlobalActivity(limit)
  const nowSecs = useNowSecs()

  const visible = useMemo(() => events.slice(0, limit), [events, limit])
  const empty = !loading && visible.length === 0

  return (
    <section
      className={[
        'flex flex-col rounded-md border border-zinc-800 bg-zinc-900',
        className,
      ].join(' ')}
      aria-label="Live activity"
    >
      <header className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
          live activity
        </span>
        <PulseDot active color="amber" size={6} />
      </header>

      {empty ? (
        <p className="px-3 py-3 font-mono text-[11px] text-zinc-500">
          no activity yet. someone has to start.
        </p>
      ) : (
        <div className="divide-y divide-zinc-800/60">
          {visible.map(ev => (
            <ActivityRow key={ev.signature} event={ev} nowSecs={nowSecs} />
          ))}
        </div>
      )}
    </section>
  )
}
