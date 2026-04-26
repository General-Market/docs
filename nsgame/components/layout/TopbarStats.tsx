'use client'

import { useState, useEffect } from 'react'

interface GlobalStats {
  totalMarkets: number | null
  totalSettled: number | null
  /** Optional. Recent-activity count over the last hour. Degrades silently. */
  betsLastHour: number | null
}

interface RawGlobalStats {
  totalMarkets?: unknown
  totalSettled?: unknown
  betsLastHour?: unknown
  /** Tolerated alternate keys from the indexer. */
  bets_last_hour?: unknown
  betsLast1h?: unknown
}

function pickPositiveNumber(...values: unknown[]): number | null {
  for (const v of values) {
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v
  }
  return null
}

export function TopbarStats() {
  const [stats, setStats] = useState<GlobalStats | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/vision/stats/global')
      .then(r => (r.ok ? r.json() : null))
      .then((d: RawGlobalStats | null) => {
        if (cancelled || !d) return
        setStats({
          totalMarkets: pickPositiveNumber(d.totalMarkets),
          totalSettled: pickPositiveNumber(d.totalSettled),
          betsLastHour: pickPositiveNumber(
            d.betsLastHour,
            d.bets_last_hour,
            d.betsLast1h,
          ),
        })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (
    !stats ||
    (stats.totalMarkets == null &&
      stats.totalSettled == null &&
      stats.betsLastHour == null)
  ) {
    return <span className="tabular-nums">&mdash;</span>
  }

  const segments: React.ReactNode[] = []
  if (stats.totalMarkets != null) {
    segments.push(
      <span key="markets">
        <span className="font-bold">{stats.totalMarkets.toLocaleString()}</span> markets
      </span>,
    )
  }
  if (stats.totalSettled != null) {
    segments.push(
      <span key="settlements">
        <span className="font-bold">{stats.totalSettled.toLocaleString()}</span> settlements
      </span>,
    )
  }
  if (stats.betsLastHour != null) {
    segments.push(
      <span key="recent">
        <span className="font-bold">{stats.betsLastHour.toLocaleString()}</span> bets in last hour
      </span>,
    )
  }

  return (
    <span className="tabular-nums">
      {segments.map((seg, i) => (
        <span key={i}>
          {i > 0 && <span className="mx-2 text-text-muted/40">·</span>}
          {seg}
        </span>
      ))}
    </span>
  )
}
