'use client'

/**
 * SettlementAnatomy — concrete strip showing what is happening in this
 * source's current batch. Lives between the brand intro and the vault
 * hero on /source/[sourceId]. The page exists to make the wait
 * interesting; this is the line in the page that says how long the
 * wait is and what gets resolved at the end of it.
 *
 * Four stats. No icons. Real numbers. Apple-style typography.
 */

import { useEffect, useMemo, useState } from 'react'
import { useBatches } from '@/hooks/vision/useBatches'

interface Props {
  sourceId: string
}

export function SettlementAnatomy({ sourceId }: Props) {
  const { data: batches } = useBatches()

  const batch = useMemo(() => {
    if (!batches) return null
    return batches.find(b => b.sourceId === sourceId) ?? null
  }, [batches, sourceId])

  // SSR renders before the clock exists. `nowSec === null` means
  // pre-hydration; show an em-dash placeholder. The useEffect mounts
  // the real clock and ticks it once a second.
  const [nowSec, setNowSec] = useState<number | null>(null)
  useEffect(() => {
    setNowSec(Math.floor(Date.now() / 1000))
    const id = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(id)
  }, [])

  if (!batch || batch.tickDuration <= 0) return null

  // Next settlement is the next tick boundary in epoch time. For a 24h
  // batch that's the next UTC midnight; for a 5-minute batch the next
  // round number of minutes. Don't read createdAtTick — the boundary
  // is the same for every batch on the same tick.
  const countdownStr =
    nowSec === null
      ? '—'
      : formatCountdown(
          Math.max(0, Math.ceil(nowSec / batch.tickDuration) * batch.tickDuration - nowSec),
          batch.tickDuration,
        )

  const tvlNum = Number(batch.tvl) / 1e18

  return (
    <section
      aria-label="Settlement details"
      className="border"
      style={{
        background: 'var(--apple-panel)',
        borderColor: 'var(--apple-line)',
        borderRadius: 'var(--apple-r-card)',
        padding: '20px 24px',
      }}
    >
      <div
        className="grid gap-x-8 gap-y-5"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}
      >
        <Stat
          eyebrow="settles in"
          value={countdownStr}
          mono
        />
        <Stat
          eyebrow="markets"
          value={batch.marketCount.toLocaleString('en-US')}
          mono
        />
        <Stat
          eyebrow="players"
          value={batch.playerCount.toLocaleString('en-US')}
          mono
        />
        <Stat
          eyebrow="pool"
          value={formatPool(tvlNum)}
          mono
        />
      </div>

      <p
        className="mt-5"
        style={{
          fontFamily: 'var(--apple-font-text)',
          fontSize: 12,
          lineHeight: 1.5,
          letterSpacing: 'var(--apple-track-tight)',
          color: 'var(--apple-text-tertiary)',
          margin: '20px 0 0',
        }}
      >
        Oracles snapshot {batch.marketCount.toLocaleString('en-US')} prices at the boundary.
        Winners split the pool by share of correct bets.
        Bets are sealed once the round opens.
      </p>
    </section>
  )
}

function Stat({
  eyebrow,
  value,
  mono,
}: {
  eyebrow: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="min-w-0">
      <div
        style={{
          fontFamily: 'var(--apple-font-text)',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 'var(--apple-track-loose)',
          color: 'var(--apple-text-tertiary)',
          textTransform: 'uppercase',
          margin: 0,
        }}
      >
        {eyebrow}
      </div>
      <div
        className="mt-1"
        style={{
          fontFamily: mono
            ? '"SF Mono","JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace'
            : 'var(--apple-font-display)',
          fontSize: 28,
          fontWeight: 500,
          letterSpacing: mono ? '-0.01em' : 'var(--apple-track-tighter)',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.05,
          color: 'var(--apple-text)',
          margin: 0,
        }}
      >
        {value}
      </div>
    </div>
  )
}

function formatCountdown(secs: number, tickDuration: number): string {
  if (secs <= 0) return 'now'

  const d = Math.floor(secs / 86400)
  const h = Math.floor((secs % 86400) / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60

  // Show units that matter for the tick. A 24h batch wants "6h 23m";
  // a 5-minute batch wants "2m 14s". Don't print zero-leading units
  // smaller than the most significant non-zero one.
  if (tickDuration >= 86400) {
    if (d > 0) return `${d}d ${h}h`
    if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`
    return `${m}m ${s.toString().padStart(2, '0')}s`
  }
  if (tickDuration >= 3600) {
    if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`
    return `${m}m ${s.toString().padStart(2, '0')}s`
  }
  return `${m}m ${s.toString().padStart(2, '0')}s`
}

function formatPool(usd: number): string {
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}K`
  return `$${usd.toFixed(0)}`
}
